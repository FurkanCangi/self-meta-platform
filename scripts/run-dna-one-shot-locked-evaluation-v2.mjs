#!/usr/bin/env node

import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeSync,
  writeFileSync,
} from "node:fs"
import { randomBytes } from "node:crypto"
import { basename, dirname, join, relative, resolve, sep } from "node:path"
import { pathToFileURL } from "node:url"

import {
  CLAIM_SCHEMA,
  EXPECTED_COUNTS,
  EXPECTED_SPLITS,
  HOLDOUT_LABEL,
  RESULT_LABEL,
  RESULT_SCHEMA,
  TOPIC_IDS,
  assertAggregateResult,
  assertClaim,
  assertFrozenAdapter,
  assertIsoTimestamp,
  assertPureV2EvaluatorSource,
  assertSealedHoldoutArtifact,
  assertSha256,
  deepFreeze,
  evaluateLockedHoldout,
  fail,
  qualityGate,
  sha256,
  stableJson,
  stableSha256,
  withoutKey,
} from "./lib/dna-locked-retrieval-v2-core.mjs"
import {
  assertPreopenManifest,
  assertPreopenReceipt,
} from "./lib/dna-v2-preopen-overlap-core.mjs"

export const PATHS = Object.freeze({
  holdoutManifest: "docs/dna-intelligence/program/evidence/internal-locked-turkish-holdout-v2-current.json",
  developmentManifest: "docs/dna-intelligence/program/evidence/turkish-retrieval-adapter-development-v2-current.json",
  frozenManifest: "docs/dna-intelligence/program/evidence/turkish-retrieval-adapter-v2-frozen-current.json",
  preopenManifest: "docs/dna-intelligence/program/evidence/turkish-retrieval-v2-preopen-overlap-current.json",
  holdoutArtifact: "Datasets/DNA-Intelligence/evaluation/internal-locked-turkish-holdout/v2/questions-and-answers.json",
  adapter: "Datasets/DNA-Intelligence/evaluation/frozen-adapters/turkish-retrieval-v2/adapter.json",
  candidate: "Datasets/DNA-Intelligence/work/v3/prebook-closure/v1/external-science-candidate-package.json",
  developmentBank: "Datasets/DNA-Intelligence/evaluation/development-banks/turkish-retrieval-v2/development-bank.json",
  developmentResult: "Outputs/SelfMetaAI/dna-intelligence/turkish-retrieval-adapter/development-v2/result.json",
  preopenReceipt: "Datasets/DNA-Intelligence/evaluation/preopen-integrity/turkish-retrieval-v2/overlap-receipt.json",
  evaluator: "scripts/generated/dna-retrieval-evaluators/turkish-development-v2.mjs",
  compiler: "scripts/dna-turkish-retrieval-v2-development-core.mjs",
  config: "docs/dna-intelligence/governance/v3/development-turkish-retrieval-v2-config.json",
  preopenIntegrityScript: "scripts/dna-v2-preopen-overlap-integrity.mjs",
  preopenIntegrityCore: "scripts/lib/dna-v2-preopen-overlap-core.mjs",
  resultFilename: "official-first-run-result.json",
  claimFilename: "official-first-run.claim.json",
})

const CORE_URL = new URL("./lib/dna-locked-retrieval-v2-core.mjs", import.meta.url)

function parseCommand(argv) {
  if (!Array.isArray(argv) || argv.length !== 1 || !["test", "official"].includes(argv[0])) {
    fail("dna_locked_v2_cli_invalid")
  }
  return argv[0]
}

function resolveRoot(requested, requireResearchSsd = false) {
  const root = resolve(requested)
  if (!existsSync(root)) fail("dna_locked_v2_root_missing")
  const metadata = lstatSync(root)
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) fail("dna_locked_v2_root_invalid")
  const real = realpathSync(root)
  if (real !== root) fail("dna_locked_v2_root_realpath_mismatch")
  if (requireResearchSsd && real !== "/Volumes/ResearchSSD"
    && !real.startsWith(`/Volumes/ResearchSSD${sep}`)) {
    fail("dna_locked_v2_local_fallback_forbidden")
  }
  return real
}

function resolveRelative(root, relativePath, code = "dna_locked_v2_path_invalid") {
  if (typeof relativePath !== "string" || !relativePath || relativePath.startsWith("/")
    || relativePath.includes("..")) fail(code)
  const target = resolve(root, relativePath)
  const delta = relative(root, target)
  if (!delta || delta === ".." || delta.startsWith(`..${sep}`) || delta.startsWith(sep)) fail(code)
  return target
}

function lstatOptional(path) {
  try {
    return lstatSync(path)
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return null
    throw error
  }
}

function assertSecureParentChain(root, requested, createMissing = false) {
  const target = resolve(requested)
  const delta = relative(root, target)
  if (!delta || delta === ".." || delta.startsWith(`..${sep}`) || delta.startsWith(sep)) {
    fail("dna_locked_v2_secure_path_escape")
  }
  let current = root
  for (const segment of relative(root, dirname(target)).split(sep).filter(Boolean)) {
    current = join(current, segment)
    let metadata = lstatOptional(current)
    if (!metadata && createMissing) {
      mkdirSync(current, { mode: 0o700 })
      metadata = lstatOptional(current)
    }
    if (!metadata) fail("dna_locked_v2_secure_parent_invalid")
    if (metadata.isSymbolicLink()) fail("dna_locked_v2_secure_parent_symlink_forbidden")
    if (!metadata.isDirectory()) fail("dna_locked_v2_secure_parent_invalid")
    const real = realpathSync(current)
    if (real !== current || (real !== root && !real.startsWith(`${root}${sep}`))) {
      fail("dna_locked_v2_secure_parent_escape")
    }
  }
  return target
}

function readSecureFile(root, relativePath, options = {}) {
  const target = assertSecureParentChain(root, resolveRelative(root, relativePath), false)
  const metadata = lstatOptional(target)
  if (!metadata) fail(options.missingCode || "dna_locked_v2_file_missing")
  if (metadata.isSymbolicLink()) fail("dna_locked_v2_symlink_forbidden")
  if (!metadata.isFile()) fail(options.missingCode || "dna_locked_v2_file_missing")
  if (options.mode !== undefined && (metadata.mode & 0o777) !== options.mode) {
    fail(options.modeCode || "dna_locked_v2_mode_mismatch")
  }
  const real = realpathSync(target)
  if (real !== target || !real.startsWith(`${root}${sep}`)) fail("dna_locked_v2_realpath_escape")
  const bytes = readFileSync(target)
  return { target, bytes, fileSha256: sha256(bytes) }
}

function readJson(read, code) {
  try {
    return JSON.parse(read.bytes.toString("utf8"))
  } catch {
    fail(code)
  }
}

function writeAll(descriptor, bytes) {
  let offset = 0
  while (offset < bytes.length) {
    const written = writeSync(descriptor, bytes, offset, bytes.length - offset, offset)
    if (written <= 0) fail("dna_locked_v2_write_stalled")
    offset += written
  }
}

function fsyncDirectory(path) {
  const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
}

function assertSecureReadback(root, target, serialized) {
  assertSecureParentChain(root, target, false)
  const metadata = lstatOptional(target)
  if (!metadata || !metadata.isFile() || metadata.isSymbolicLink()
    || (metadata.mode & 0o777) !== 0o600) fail("dna_locked_v2_output_readback_metadata_invalid")
  const actual = readFileSync(target)
  const expected = Buffer.from(serialized, "utf8")
  if (!actual.equals(expected)) fail("dna_locked_v2_output_readback_mismatch")
}

function atomicWriteNew(root, target, serialized) {
  assertSecureParentChain(root, target, true)
  if (lstatOptional(target)) fail("dna_locked_v2_output_exists")
  const temporary = join(dirname(target),
    `.${basename(target)}.${randomBytes(16).toString("hex")}.tmp`)
  let descriptor = null
  try {
    descriptor = openSync(temporary,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o600)
    writeAll(descriptor, Buffer.from(serialized, "utf8"))
    fsyncSync(descriptor)
    closeSync(descriptor)
    descriptor = null
    chmodSync(temporary, 0o600)
    if (lstatOptional(target)) fail("dna_locked_v2_output_exists")
    renameSync(temporary, target)
    chmodSync(target, 0o600)
    fsyncDirectory(dirname(target))
    assertSecureReadback(root, target, serialized)
  } finally {
    if (descriptor !== null) closeSync(descriptor)
    if (lstatOptional(temporary)) unlinkSync(temporary)
  }
}

function acquireClaim(root, claimPath, resultPath, binding, now = () => new Date()) {
  assertSecureParentChain(root, claimPath, true)
  assertSecureParentChain(root, resultPath, true)
  if (lstatOptional(resultPath)) fail("dna_locked_v2_output_exists")
  if (lstatOptional(claimPath)) fail("dna_locked_v2_rerun_forbidden")
  const claimedAt = now().toISOString()
  const payload = {
    schemaVersion: CLAIM_SCHEMA,
    state: "claimed_no_rerun",
    failureStateIfResultAbsent: "claimed_failed_no_rerun",
    claimedAt,
    adapterSha256: binding.adapterSha256,
    holdoutSha256: binding.holdoutSha256,
    authoritySha256: binding.authoritySha256,
  }
  const claim = { ...payload, claimSha256: stableSha256(payload) }
  assertClaim(claim)
  const serialized = `${JSON.stringify(claim, null, 2)}\n`
  let descriptor = null
  let created = false
  let committed = false
  try {
    descriptor = openSync(claimPath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o600)
    created = true
    writeAll(descriptor, Buffer.from(serialized, "utf8"))
    fsyncSync(descriptor)
    closeSync(descriptor)
    descriptor = null
    chmodSync(claimPath, 0o600)
    fsyncDirectory(dirname(claimPath))
    assertSecureReadback(root, claimPath, serialized)
    committed = true
    return claim
  } catch (error) {
    if (error && typeof error === "object" && error.code === "EEXIST") {
      fail("dna_locked_v2_rerun_forbidden")
    }
    throw error
  } finally {
    if (descriptor !== null) closeSync(descriptor)
    if (created && !committed && lstatOptional(claimPath)?.isFile()) unlinkSync(claimPath)
  }
}

function assertHoldoutManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)
    || manifest.schemaVersion !== "dna-internal-locked-turkish-holdout-manifest@2"
    || manifest.label !== "internal_validation_v2"
    || manifest.artifact?.researchSsdRelativePath !== PATHS.holdoutArtifact
    || manifest.artifact?.byteCount < 1
    || stableJson(manifest.counts) !== stableJson(EXPECTED_COUNTS)
    || stableJson(manifest.splits) !== stableJson(EXPECTED_SPLITS)
    || manifest.validation?.artifactMode !== "0600"
    || manifest.validation?.deterministicRepeats !== 20
    || manifest.validation?.ssdFallbackAllowed !== false
    || manifest.privacyBoundary?.visibleToAdapterTuning !== false
    || manifest.privacyBoundary?.fullQuestionAnswerPayloadInRepository !== false
    || manifest.privacyBoundary?.runtimeEligible !== false
    || manifest.privacyBoundary?.releaseEligible !== false
    || manifest.privacyBoundary?.independentHumanValidation !== false) {
    fail("dna_locked_v2_holdout_manifest_invalid")
  }
  assertSha256(manifest.artifact.sha256, "dna_locked_v2_holdout_manifest_hash_invalid")
  assertSha256(manifest.authorities?.candidatePackageSha256,
    "dna_locked_v2_holdout_candidate_hash_invalid")
  return manifest
}

function assertDevelopmentAuthority(development, frozen, adapter, reads) {
  if (development?.schemaVersion !== "dna-turkish-retrieval-v2-development-manifest@1"
    || development.version !== "turkish-retrieval-v2"
    || development.result?.researchSsdRelativePath !== PATHS.developmentResult
    || development.result?.gate?.developmentGate !== "pass"
    || development.result?.incorrect !== 0
    || development.boundaries?.lockedHoldoutAccessed !== false
    || development.boundaries?.runtimeEligible !== false
    || development.boundaries?.releaseEligible !== false
    || development.boundaries?.activationAllowed !== false) {
    fail("dna_locked_v2_development_gate_invalid")
  }
  if (frozen?.schemaVersion !== "dna-turkish-retrieval-v2-frozen-manifest@1"
    || frozen.version !== "turkish-retrieval-v2"
    || frozen.adapter?.researchSsdRelativePath !== PATHS.adapter
    || frozen.adapter?.fileMode !== "0600"
    || frozen.developmentGate?.status !== "pass"
    || frozen.developmentGate?.incorrect !== 0
    || frozen.boundaries?.lockedHoldoutAccessed !== false
    || frozen.boundaries?.runtimeEligible !== false
    || frozen.boundaries?.releaseEligible !== false
    || frozen.boundaries?.activationAllowed !== false) {
    fail("dna_locked_v2_frozen_manifest_invalid")
  }
  for (const hash of [
    reads.adapter.fileSha256, reads.evaluator.fileSha256, reads.compiler.fileSha256,
    reads.config.fileSha256, reads.bank.fileSha256, reads.developmentResult.fileSha256,
    reads.candidate.fileSha256,
  ]) assertSha256(hash, "dna_locked_v2_authority_file_hash_invalid")
  if (frozen.adapter.adapterFileSha256 !== reads.adapter.fileSha256
    || frozen.adapter.adapterSha256 !== adapter.adapterSha256
    || development.adapter?.adapterSha256 !== adapter.adapterSha256
    || adapter.evaluatorCodeSha256 !== reads.evaluator.fileSha256
    || adapter.compilerCodeSha256 !== reads.compiler.fileSha256
    || adapter.configFileSha256 !== reads.config.fileSha256
    || adapter.developmentBankFileSha256 !== reads.bank.fileSha256
    || adapter.candidateFileSha256 !== reads.candidate.fileSha256
    || development.inputHashes?.evaluatorCodeSha256 !== reads.evaluator.fileSha256
    || development.inputHashes?.compilerCodeSha256 !== reads.compiler.fileSha256
    || development.inputHashes?.configFileSha256 !== reads.config.fileSha256
    || development.inputHashes?.developmentBankFileSha256 !== reads.bank.fileSha256
    || development.inputHashes?.candidateFileSha256 !== reads.candidate.fileSha256
    || development.result?.rawSha256 !== reads.developmentResult.fileSha256) {
    fail("dna_locked_v2_authority_file_binding_mismatch")
  }
  const bank = readJson(reads.bank, "dna_locked_v2_development_bank_invalid")
  const developmentResult = readJson(reads.developmentResult,
    "dna_locked_v2_development_result_invalid")
  const candidate = readJson(reads.candidate, "dna_locked_v2_candidate_invalid")
  if (bank.bankSha256 !== adapter.developmentBankSha256
    || stableSha256(withoutKey(bank, "bankSha256")) !== bank.bankSha256
    || developmentResult.resultSha256 !== development.result.resultSha256
    || developmentResult.adapterSha256 !== adapter.adapterSha256
    || developmentResult.gate?.developmentGate !== "pass"
    || developmentResult.counts?.incorrect !== 0
    || developmentResult.boundaries?.lockedHoldoutAccessed !== false
    || candidate.packageSha256 !== adapter.candidatePackageSha256
    || stableSha256(withoutKey(candidate, "packageSha256")) !== candidate.packageSha256
    || candidate.runtimeEligible !== false || candidate.releaseEligible !== false
    || candidate.activationAllowed !== false) {
    fail("dna_locked_v2_development_payload_binding_mismatch")
  }
  assertPureV2EvaluatorSource(reads.evaluator.bytes.toString("utf8"))
}

function assertPreopenAuthority(manifest, receipt, reads, holdoutManifest,
  holdoutManifestSha256, developmentManifestSha256) {
  assertPreopenManifest(manifest)
  assertPreopenReceipt(receipt)
  const bank = readJson(reads.bank, "dna_locked_v2_development_bank_invalid")
  if (manifest.receipt.rawSha256 !== reads.preopenReceipt.fileSha256
    || manifest.receipt.receiptSha256 !== receipt.receiptSha256
    || stableJson(manifest.inputBindings) !== stableJson(receipt.inputBindings)
    || stableJson(manifest.counts) !== stableJson(receipt.counts)
    || stableJson(manifest.overlap) !== stableJson(receipt.overlap)
    || stableJson(manifest.methods) !== stableJson(receipt.methods)
    || stableJson(manifest.validation) !== stableJson(receipt.validation)
    || stableJson(manifest.boundaries) !== stableJson(receipt.boundaries)
    || receipt.inputBindings.holdoutFileSha256 !== holdoutManifest.artifact.sha256
    || receipt.inputBindings.holdoutManifestFileSha256 !== holdoutManifestSha256
    || receipt.inputBindings.developmentBankSha256 !== bank.bankSha256
    || receipt.inputBindings.developmentBankFileSha256 !== reads.bank.fileSha256
    || receipt.inputBindings.developmentManifestFileSha256 !== developmentManifestSha256
    || receipt.inputBindings.allowedLegacyQaFileSha256
      !== bank.inputs?.existingExternalScienceQaFileSha256
    || receipt.inputBindings.integrityScriptFileSha256
      !== reads.preopenIntegrityScript.fileSha256
    || receipt.inputBindings.integrityCoreFileSha256
      !== reads.preopenIntegrityCore.fileSha256) {
    fail("dna_locked_v2_preopen_authority_binding_mismatch")
  }
}

export function loadOfficialAuthority(repositoryRootInput = process.cwd(),
  researchRootInput = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD") {
  const repositoryRoot = resolveRoot(repositoryRootInput)
  const researchRoot = resolveRoot(researchRootInput, true)
  const holdoutManifestRead = readSecureFile(repositoryRoot, PATHS.holdoutManifest)
  const developmentManifestRead = readSecureFile(repositoryRoot, PATHS.developmentManifest)
  const frozenManifestRead = readSecureFile(repositoryRoot, PATHS.frozenManifest)
  const preopenManifestRead = readSecureFile(repositoryRoot, PATHS.preopenManifest)
  const reads = {
    adapter: readSecureFile(researchRoot, PATHS.adapter, { mode: 0o600 }),
    candidate: readSecureFile(researchRoot, PATHS.candidate, { mode: 0o600 }),
    bank: readSecureFile(researchRoot, PATHS.developmentBank, { mode: 0o600 }),
    developmentResult: readSecureFile(researchRoot, PATHS.developmentResult, { mode: 0o600 }),
    preopenReceipt: readSecureFile(researchRoot, PATHS.preopenReceipt, { mode: 0o600 }),
    evaluator: readSecureFile(repositoryRoot, PATHS.evaluator),
    compiler: readSecureFile(repositoryRoot, PATHS.compiler),
    config: readSecureFile(repositoryRoot, PATHS.config),
    preopenIntegrityScript: readSecureFile(repositoryRoot, PATHS.preopenIntegrityScript),
    preopenIntegrityCore: readSecureFile(repositoryRoot, PATHS.preopenIntegrityCore),
  }
  const holdoutManifest = assertHoldoutManifest(readJson(holdoutManifestRead,
    "dna_locked_v2_holdout_manifest_json_invalid"))
  const development = readJson(developmentManifestRead,
    "dna_locked_v2_development_manifest_json_invalid")
  const frozen = readJson(frozenManifestRead, "dna_locked_v2_frozen_manifest_json_invalid")
  const preopenManifest = readJson(preopenManifestRead,
    "dna_locked_v2_preopen_manifest_json_invalid")
  const preopenReceipt = readJson(reads.preopenReceipt,
    "dna_locked_v2_preopen_receipt_json_invalid")
  const adapter = assertFrozenAdapter(readJson(reads.adapter, "dna_locked_v2_adapter_json_invalid"))
  assertDevelopmentAuthority(development, frozen, adapter, reads)
  assertPreopenAuthority(preopenManifest, preopenReceipt, reads, holdoutManifest,
    holdoutManifestRead.fileSha256, developmentManifestRead.fileSha256)
  if (holdoutManifest.authorities.candidatePackageSha256 !== adapter.candidatePackageSha256
    || holdoutManifest.authorities.candidatePackageResearchSsdRelativePath !== PATHS.candidate) {
    fail("dna_locked_v2_holdout_candidate_binding_mismatch")
  }
  const harnessRead = readSecureFile(repositoryRoot,
    "scripts/run-dna-one-shot-locked-evaluation-v2.mjs")
  const coreRead = readSecureFile(repositoryRoot,
    "scripts/lib/dna-locked-retrieval-v2-core.mjs")
  const evaluationCodeSha256 = stableSha256({
    harnessFileSha256: harnessRead.fileSha256,
    coreFileSha256: coreRead.fileSha256,
    evaluatorCodeSha256: reads.evaluator.fileSha256,
    compilerCodeSha256: reads.compiler.fileSha256,
  })
  const authorityPayload = {
    adapterSha256: adapter.adapterSha256,
    adapterFileSha256: reads.adapter.fileSha256,
    candidatePackageSha256: adapter.candidatePackageSha256,
    candidateFileSha256: reads.candidate.fileSha256,
    developmentBankSha256: adapter.developmentBankSha256,
    developmentBankFileSha256: reads.bank.fileSha256,
    developmentResultFileSha256: reads.developmentResult.fileSha256,
    developmentResultSha256: development.result.resultSha256,
    configFileSha256: reads.config.fileSha256,
    evaluatorCodeSha256: reads.evaluator.fileSha256,
    compilerCodeSha256: reads.compiler.fileSha256,
    developmentManifestSha256: developmentManifestRead.fileSha256,
    frozenManifestSha256: frozenManifestRead.fileSha256,
    holdoutManifestSha256: holdoutManifestRead.fileSha256,
    preopenManifestSha256: preopenManifestRead.fileSha256,
    preopenReceiptFileSha256: reads.preopenReceipt.fileSha256,
    preopenReceiptSha256: preopenReceipt.receiptSha256,
    holdoutSha256: holdoutManifest.artifact.sha256,
    evaluationCodeSha256,
  }
  return deepFreeze({
    repositoryRoot,
    researchRoot,
    holdoutManifest,
    holdoutManifestSha256: holdoutManifestRead.fileSha256,
    developmentManifestSha256: developmentManifestRead.fileSha256,
    frozenManifestSha256: frozenManifestRead.fileSha256,
    preopenManifest,
    preopenManifestSha256: preopenManifestRead.fileSha256,
    preopenReceipt,
    preopenReceiptFileSha256: reads.preopenReceipt.fileSha256,
    adapter,
    authority: authorityPayload,
    evaluatorPath: reads.evaluator.target,
    evaluatorFileSha256: reads.evaluator.fileSha256,
    evaluationCodeSha256,
    authoritySha256: stableSha256(authorityPayload),
  })
}

async function importRoute(path, expectedSha256) {
  const bytes = readFileSync(path)
  if (sha256(bytes) !== expectedSha256) fail("dna_locked_v2_evaluator_changed_after_binding")
  assertPureV2EvaluatorSource(bytes.toString("utf8"))
  const module = await import(`${pathToFileURL(path).href}?sha256=${expectedSha256}`)
  if (typeof module.evaluateTurkishRetrievalV2 !== "function") {
    fail("dna_locked_v2_evaluator_export_invalid")
  }
  return module.evaluateTurkishRetrievalV2
}

function loadHoldoutAfterClaim(researchRoot, manifest) {
  const read = readSecureFile(researchRoot, manifest.artifact.researchSsdRelativePath, {
    mode: 0o600,
    modeCode: "dna_locked_v2_holdout_mode_mismatch",
  })
  if (read.bytes.length !== manifest.artifact.byteCount
    || read.fileSha256 !== manifest.artifact.sha256) {
    fail("dna_locked_v2_holdout_file_binding_mismatch")
  }
  const artifact = readJson(read, "dna_locked_v2_holdout_json_invalid")
  assertSealedHoldoutArtifact(artifact, read.fileSha256)
  return { artifact, read }
}

export async function runOneShotV2(input) {
  const artifactPath = resolveRelative(input.researchRoot,
    input.holdoutManifest.artifact.researchSsdRelativePath)
  const resultPath = input.resultPath || join(dirname(artifactPath), PATHS.resultFilename)
  const claimPath = input.claimPath || join(dirname(artifactPath), PATHS.claimFilename)
  if (dirname(resultPath) !== dirname(artifactPath) || dirname(claimPath) !== dirname(artifactPath)) {
    fail("dna_locked_v2_output_directory_mismatch")
  }
  acquireClaim(input.researchRoot, claimPath, resultPath, {
    adapterSha256: input.adapter.adapterSha256,
    holdoutSha256: input.holdoutManifest.artifact.sha256,
    authoritySha256: input.authoritySha256,
  }, input.now)
  input.onClaimCommitted?.({ claimPath, resultPath })
  const loaded = loadHoldoutAfterClaim(input.researchRoot, input.holdoutManifest)
  const route = input.route || await importRoute(input.evaluatorPath, input.evaluatorFileSha256)
  const evaluated = evaluateLockedHoldout(route, input.adapter, loaded.artifact)
  const recordedAt = (input.now?.() || new Date()).toISOString()
  const payload = {
    schemaVersion: RESULT_SCHEMA,
    label: RESULT_LABEL,
    runId: `locked-eval-v2:${stableSha256({
      adapterSha256: input.adapter.adapterSha256,
      holdoutSha256: input.holdoutManifest.artifact.sha256,
      authoritySha256: input.authoritySha256,
      recordedAt,
    }).slice(0, 32)}`,
    recordedAt,
    adapterSha256: input.adapter.adapterSha256,
    holdoutSha256: input.holdoutManifest.artifact.sha256,
    holdoutManifestSha256: input.holdoutManifestSha256,
    developmentManifestSha256: input.developmentManifestSha256,
    frozenManifestSha256: input.frozenManifestSha256,
    evaluationCodeSha256: input.evaluationCodeSha256,
    authoritySha256: input.authoritySha256,
    counts: evaluated.counts,
    metrics: evaluated.metrics,
    metricsSha256: stableSha256(evaluated.metrics),
    boundaries: {
      questionTextStored: false,
      failureItemIdsStored: false,
      aggregateOnly: true,
      independentHumanValidation: false,
      runtimeEligible: false,
      releaseEligible: false,
      activationAllowed: false,
    },
  }
  const result = { ...payload, resultSha256: stableSha256(payload) }
  assertAggregateResult(result)
  const serialized = `${JSON.stringify(result, null, 2)}\n`
  for (const item of loaded.artifact.items) {
    if (serialized.includes(item.question) || serialized.includes(item.id)) {
      fail("dna_locked_v2_result_item_leak")
    }
  }
  atomicWriteNew(input.researchRoot, resultPath, serialized)
  return { result, resultPath, claimPath, qualityGate: qualityGate(result.metrics) }
}

function syntheticArtifact() {
  const items = []
  let sequence = 0
  const add = (split, answerability, expectedTopic, text) => {
    sequence += 1
    items.push({
      id: `holdout.v2.q:${sequence.toString(16).padStart(24, "0")}`,
      question: `${text} benzersiz sentetik soru ${sequence}`,
      split,
      answerability,
      expectedTopic,
    })
  }
  for (let topicIndex = 0; topicIndex < TOPIC_IDS.length; topicIndex += 1) {
    for (let index = 0; index < 7; index += 1) add("natural_supported", "answerable",
      TOPIC_IDS[topicIndex], `route topic${topicIndex} natural ${index}`)
    for (let index = 0; index < 2; index += 1) add("hard_neighbor", "answerable",
      TOPIC_IDS[topicIndex], `route topic${topicIndex} hard ${index}`)
    add("safe_theory_control", "answerable", TOPIC_IDS[topicIndex],
      `route topic${topicIndex} safe`)
  }
  for (let index = 0; index < 28; index += 1) {
    add("ambiguous", "clarification", null, `clarify ambiguity ${index}`)
    add("unsupported", "unsupported", null, `abstain unsupported ${index}`)
  }
  const base = {
    schemaVersion: "dna-internal-locked-turkish-holdout@2",
    label: HOLDOUT_LABEL,
    status: "sealed",
    sealedAt: "2026-07-24T00:00:00.000Z",
    candidatePackageSha256: "1".repeat(64),
    candidateFileSha256: "2".repeat(64),
    authoringProcessSha256: "3".repeat(64),
    contractSealProcessSha256: "4".repeat(64),
    counts: EXPECTED_COUNTS,
    splits: EXPECTED_SPLITS,
    items,
    bindings: [],
    variantAssignments: [],
    visibleToAdapterTuning: false,
    runtimeEligible: false,
    releaseEligible: false,
    independentHumanValidation: false,
    limitations: ["synthetic_fixture_only", "not_independent_validation"],
  }
  return { ...base, artifactSha256: stableSha256(base) }
}

function syntheticRoute(question) {
  if (question.startsWith("clarify")) return { decision: "clarify", topicId: null }
  if (question.startsWith("abstain")) return { decision: "abstain", topicId: null }
  const match = question.match(/^route topic(\d+)/)
  return { decision: "route", topicId: TOPIC_IDS[Number(match?.[1] ?? -1)] ?? null }
}

function syntheticAdapter() {
  return {
    adapterSha256: "a".repeat(64),
    topics: TOPIC_IDS.map((id) => ({ id })),
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    lockedHoldoutAccessed: false,
  }
}

function writeSyntheticFixture(root, artifact = syntheticArtifact()) {
  const path = resolveRelative(root, PATHS.holdoutArtifact)
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const text = `${JSON.stringify(artifact, null, 2)}\n`
  writeFileSync(path, text, { mode: 0o600 })
  chmodSync(path, 0o600)
  return {
    artifact,
    path,
    manifest: {
      schemaVersion: "synthetic-manifest@1",
      label: "synthetic",
      artifact: {
        researchSsdRelativePath: PATHS.holdoutArtifact,
        sha256: sha256(Buffer.from(text)),
        byteCount: Buffer.byteLength(text),
      },
      counts: EXPECTED_COUNTS,
      splits: EXPECTED_SPLITS,
    },
  }
}

async function expectFailure(action, code) {
  try {
    await action()
  } catch (error) {
    if (!code || error instanceof Error && error.message === code) return
    fail(`dna_locked_v2_unexpected_failure:${error instanceof Error ? error.message : String(error)}`)
  }
  fail("dna_locked_v2_expected_failure_missing")
}

function syntheticInput(root, fixture, overrides = {}) {
  return {
    researchRoot: root,
    holdoutManifest: fixture.manifest,
    holdoutManifestSha256: "b".repeat(64),
    developmentManifestSha256: "c".repeat(64),
    frozenManifestSha256: "d".repeat(64),
    evaluationCodeSha256: "e".repeat(64),
    authoritySha256: "f".repeat(64),
    adapter: syntheticAdapter(),
    route: syntheticRoute,
    now: () => new Date("2026-07-24T00:00:00.000Z"),
    ...overrides,
  }
}

async function test() {
  const volumeRoot = resolveRoot(process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD", true)
  const temporaryRoot = mkdtempSync(join(volumeRoot,
    "Outputs/SelfMetaAI/dna-intelligence/.locked-v2-harness-test-"))
  const tests = []
  const check = async (name, action) => {
    await action()
    tests.push(name)
  }
  try {
    await check("synthetic_success", async () => {
      const root = join(temporaryRoot, "success")
      mkdirSync(root, { recursive: true })
      const fixture = writeSyntheticFixture(root)
      let claimObserved = false
      const output = await runOneShotV2(syntheticInput(root, fixture, {
        onClaimCommitted: ({ claimPath }) => {
          claimObserved = existsSync(claimPath) && (lstatSync(claimPath).mode & 0o777) === 0o600
        },
      }))
      if (!claimObserved || output.qualityGate.status !== "pass"
        || output.result.metrics.determinism.uniqueHashes !== 1
        || output.result.metrics.overallAccuracy !== 1) fail("dna_locked_v2_synthetic_success_failed")
      const serialized = readFileSync(output.resultPath, "utf8")
      for (const item of fixture.artifact.items) {
        if (serialized.includes(item.question) || serialized.includes(item.id)) {
          fail("dna_locked_v2_synthetic_result_leak")
        }
      }
    })

    await check("no_rerun", async () => {
      const root = join(temporaryRoot, "rerun")
      mkdirSync(root, { recursive: true })
      const fixture = writeSyntheticFixture(root)
      const input = syntheticInput(root, fixture)
      await runOneShotV2(input)
      await expectFailure(() => runOneShotV2(input), "dna_locked_v2_output_exists")
    })

    await check("hash_tamper_fail_closed", async () => {
      const root = join(temporaryRoot, "hash")
      mkdirSync(root, { recursive: true })
      const fixture = writeSyntheticFixture(root)
      fixture.manifest.artifact.sha256 = "0".repeat(64)
      await expectFailure(() => runOneShotV2(syntheticInput(root, fixture)),
        "dna_locked_v2_holdout_file_binding_mismatch")
      if (!existsSync(join(dirname(fixture.path), PATHS.claimFilename))) {
        fail("dna_locked_v2_claim_not_persisted_after_failure")
      }
      await expectFailure(() => runOneShotV2(syntheticInput(root, fixture)),
        "dna_locked_v2_rerun_forbidden")
    })

    await check("mode_tamper_fail_closed", async () => {
      const root = join(temporaryRoot, "mode")
      mkdirSync(root, { recursive: true })
      const fixture = writeSyntheticFixture(root)
      chmodSync(fixture.path, 0o644)
      await expectFailure(() => runOneShotV2(syntheticInput(root, fixture)),
        "dna_locked_v2_holdout_mode_mismatch")
    })

    await check("leaf_symlink_fail_closed", async () => {
      const root = join(temporaryRoot, "leaf-link")
      mkdirSync(root, { recursive: true })
      const fixture = writeSyntheticFixture(root)
      const real = `${fixture.path}.real`
      renameSync(fixture.path, real)
      symlinkSync(real, fixture.path)
      await expectFailure(() => runOneShotV2(syntheticInput(root, fixture)),
        "dna_locked_v2_symlink_forbidden")
    })

    await check("parent_symlink_fail_closed", async () => {
      const root = join(temporaryRoot, "parent-link")
      mkdirSync(root, { recursive: true })
      const real = join(root, "real")
      mkdirSync(real)
      const linked = join(root, "Datasets")
      symlinkSync(real, linked)
      const fixture = {
        manifest: {
          artifact: {
            researchSsdRelativePath: PATHS.holdoutArtifact,
            sha256: "1".repeat(64),
            byteCount: 1,
          },
        },
      }
      await expectFailure(() => runOneShotV2(syntheticInput(root, fixture)),
        "dna_locked_v2_secure_parent_symlink_forbidden")
    })

    await check("output_forbidden", async () => {
      const root = join(temporaryRoot, "output")
      mkdirSync(root, { recursive: true })
      const fixture = writeSyntheticFixture(root)
      const route = () => {
        console.log("forbidden")
        return { decision: "abstain", topicId: null }
      }
      await expectFailure(() => runOneShotV2(syntheticInput(root, fixture, { route })),
        "dna_locked_v2_evaluator_output_forbidden")
    })

    await check("mutation_forbidden", async () => {
      const root = join(temporaryRoot, "mutation")
      mkdirSync(root, { recursive: true })
      const fixture = writeSyntheticFixture(root)
      const route = (_question, adapter) => {
        adapter.mutated = true
        return { decision: "abstain", topicId: null }
      }
      await expectFailure(() => runOneShotV2(syntheticInput(root, fixture, { route })))
    })

    await check("impure_source_rejected", async () => {
      await expectFailure(() => Promise.resolve(assertPureV2EvaluatorSource(
        "export function evaluateTurkishRetrievalV2(question, adapter) { console.log(question); return adapter }",
      )))
      const longImpure = `export function evaluateTurkishRetrievalV2(question, adapter) { console.log(question); return adapter }${" ".repeat(100)}`
      await expectFailure(() => Promise.resolve(assertPureV2EvaluatorSource(longImpure)),
        "dna_locked_v2_evaluator_impure_or_forbidden_source")
    })

    await check("path_escape_rejected", async () => {
      await expectFailure(() => Promise.resolve(resolveRelative(temporaryRoot, "../escape")),
        "dna_locked_v2_path_invalid")
    })

    await check("local_fallback_rejected", async () => {
      await expectFailure(() => Promise.resolve(resolveRoot("/tmp", true)))
    })

    await check("result_tamper_rejected", async () => {
      const root = join(temporaryRoot, "result-tamper")
      mkdirSync(root, { recursive: true })
      const fixture = writeSyntheticFixture(root)
      const output = await runOneShotV2(syntheticInput(root, fixture))
      const tampered = structuredClone(output.result)
      tampered.metrics.overallAccuracy = 0
      await expectFailure(() => Promise.resolve(assertAggregateResult(tampered)))
    })

    await check("nested_metric_extra_field_leak_rejected", async () => {
      const artifact = syntheticArtifact()
      const evaluated = evaluateLockedHoldout(syntheticRoute, syntheticAdapter(), artifact)
      const payload = {
        schemaVersion: RESULT_SCHEMA,
        label: RESULT_LABEL,
        runId: `locked-eval-v2:${"a".repeat(32)}`,
        recordedAt: "2026-07-24T00:00:00.000Z",
        adapterSha256: "a".repeat(64),
        holdoutSha256: "b".repeat(64),
        holdoutManifestSha256: "c".repeat(64),
        developmentManifestSha256: "d".repeat(64),
        frozenManifestSha256: "e".repeat(64),
        evaluationCodeSha256: "f".repeat(64),
        authoritySha256: "1".repeat(64),
        counts: evaluated.counts,
        metrics: structuredClone(evaluated.metrics),
        boundaries: {
          questionTextStored: false,
          failureItemIdsStored: false,
          aggregateOnly: true,
          independentHumanValidation: false,
          runtimeEligible: false,
          releaseEligible: false,
          activationAllowed: false,
        },
      }
      payload.metrics.splitAccuracy[0].question = "forbidden"
      payload.metricsSha256 = stableSha256(payload.metrics)
      const result = { ...payload, resultSha256: stableSha256(payload) }
      await expectFailure(() => Promise.resolve(assertAggregateResult(result)),
        "dna_locked_v2_result_split_metric_fields_invalid")
    })

    await check("twenty_run_determinism", async () => {
      const artifact = syntheticArtifact()
      const evaluated = evaluateLockedHoldout(syntheticRoute, syntheticAdapter(), artifact)
      if (evaluated.metrics.determinism.repeats !== 20
        || evaluated.metrics.determinism.uniqueHashes !== 1) {
        fail("dna_locked_v2_twenty_run_test_failed")
      }
    })

    return {
      ok: true,
      tests: tests.length,
      testNames: tests,
      officialRunExecuted: false,
      lockedPayloadOpened: false,
      boundaries: {
        syntheticFixturesOnly: true,
        runtimeEligible: false,
        releaseEligible: false,
        activationAllowed: false,
      },
    }
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true })
  }
}

async function official() {
  const authority = loadOfficialAuthority()
  const output = await runOneShotV2(authority)
  return {
    ok: true,
    resultSha256: output.result.resultSha256,
    adapterSha256: output.result.adapterSha256,
    holdoutSha256: output.result.holdoutSha256,
    counts: output.result.counts,
    metrics: output.result.metrics,
    qualityGate: output.qualityGate,
    path: output.resultPath,
    boundaries: output.result.boundaries,
  }
}

async function main() {
  const command = parseCommand(process.argv.slice(2))
  const result = command === "test" ? await test() : await official()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${process.env.DNA_LOCKED_V2_DEBUG === "1" && error instanceof Error
      ? error.stack : error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}

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
  EXPECTED_INTENTS,
  EXPECTED_SPLITS,
  RESULT_LABEL,
  RESULT_SCHEMA,
  TOPIC_IDS,
  assertAggregateResult,
  assertClaim,
  assertFrozenAdapter,
  assertIsoTimestamp,
  assertPureV3EvaluatorSource,
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
} from "./lib/dna-locked-retrieval-v3-core.mjs"
import {
  assertPreopenManifest,
  assertPreopenReceipt,
} from "./lib/dna-v3-preopen-overlap-core.mjs"

export const PATHS = Object.freeze({
  holdoutManifest: "docs/dna-intelligence/program/evidence/turkish-retrieval-v3-blind-holdout-manifest.json",
  developmentManifest: "docs/dna-intelligence/program/evidence/turkish-retrieval-v3-source-derived-current.json",
  preopenManifest: "docs/dna-intelligence/program/evidence/turkish-retrieval-v3-preopen-overlap-current.json",
  holdoutArtifact: "Datasets/DNA-Intelligence/evaluations/turkish-retrieval-v3/blind-source-derived-v3/sealed-holdout.json",
  adapter: "Outputs/SelfMetaAI/dna-intelligence/turkish-retrieval-v3-source-derived/development-v1/frozen-source-derived-adapter.json",
  workingAdapter: "Outputs/SelfMetaAI/dna-intelligence/turkish-retrieval-v3-source-derived/development-v1/source-derived-adapter.json",
  candidate: "Datasets/DNA-Intelligence/work/v3/prebook-closure/v1/external-science-candidate-package.json",
  developmentBank: "Outputs/SelfMetaAI/dna-intelligence/turkish-retrieval-v3-source-derived/development-v1/development-bank-family-split.json",
  developmentResult: "Outputs/SelfMetaAI/dna-intelligence/turkish-retrieval-v3-source-derived/development-v1/development-report.json",
  frozenManifest: "Outputs/SelfMetaAI/dna-intelligence/turkish-retrieval-v3-source-derived/development-v1/freeze-manifest.json",
  preopenReceipt: "Datasets/DNA-Intelligence/evaluations/turkish-retrieval-v3/preopen-integrity/source-derived-v3-overlap-receipt.json",
  evaluator: "scripts/dna-turkish-retrieval-v3-source-derived-core.mjs",
  developmentGenerator: "scripts/dna-turkish-retrieval-v3-source-derived-development.mjs",
  artifactBuilder: "scripts/dna-turkish-retrieval-v3-source-derived-artifacts.mjs",
  preopenIntegrityScript: "scripts/dna-v3-preopen-overlap-integrity.mjs",
  preopenIntegrityCore: "scripts/lib/dna-v3-preopen-overlap-core.mjs",
  resultFilename: "official-source-derived-v3-first-run.result.json",
  claimFilename: "official-source-derived-v3-first-run.claim.json",
})

const CORE_URL = new URL("./lib/dna-locked-retrieval-v3-core.mjs", import.meta.url)

function parseCommand(argv) {
  if (!Array.isArray(argv) || argv.length !== 1 || !["test", "official"].includes(argv[0])) {
    fail("dna_locked_v3_cli_invalid")
  }
  return argv[0]
}

function resolveRoot(requested, requireResearchSsd = false) {
  const root = resolve(requested)
  if (!existsSync(root)) fail("dna_locked_v3_root_missing")
  const metadata = lstatSync(root)
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) fail("dna_locked_v3_root_invalid")
  const real = realpathSync(root)
  if (real !== root) fail("dna_locked_v3_root_realpath_mismatch")
  if (requireResearchSsd && real !== "/Volumes/ResearchSSD"
    && !real.startsWith(`/Volumes/ResearchSSD${sep}`)) {
    fail("dna_locked_v3_local_fallback_forbidden")
  }
  return real
}

function resolveRelative(root, relativePath, code = "dna_locked_v3_path_invalid") {
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
    fail("dna_locked_v3_secure_path_escape")
  }
  let current = root
  for (const segment of relative(root, dirname(target)).split(sep).filter(Boolean)) {
    current = join(current, segment)
    let metadata = lstatOptional(current)
    if (!metadata && createMissing) {
      mkdirSync(current, { mode: 0o700 })
      metadata = lstatOptional(current)
    }
    if (!metadata) fail("dna_locked_v3_secure_parent_invalid")
    if (metadata.isSymbolicLink()) fail("dna_locked_v3_secure_parent_symlink_forbidden")
    if (!metadata.isDirectory()) fail("dna_locked_v3_secure_parent_invalid")
    const real = realpathSync(current)
    if (real !== current || (real !== root && !real.startsWith(`${root}${sep}`))) {
      fail("dna_locked_v3_secure_parent_escape")
    }
  }
  return target
}

function readSecureFile(root, relativePath, options = {}) {
  const target = assertSecureParentChain(root, resolveRelative(root, relativePath), false)
  const metadata = lstatOptional(target)
  if (!metadata) fail(options.missingCode || "dna_locked_v3_file_missing")
  if (metadata.isSymbolicLink()) fail("dna_locked_v3_symlink_forbidden")
  if (!metadata.isFile()) fail(options.missingCode || "dna_locked_v3_file_missing")
  if (options.mode !== undefined && (metadata.mode & 0o777) !== options.mode) {
    fail(options.modeCode || "dna_locked_v3_mode_mismatch")
  }
  const real = realpathSync(target)
  if (real !== target || !real.startsWith(`${root}${sep}`)) fail("dna_locked_v3_realpath_escape")
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
    if (written <= 0) fail("dna_locked_v3_write_stalled")
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
    || (metadata.mode & 0o777) !== 0o600) fail("dna_locked_v3_output_readback_metadata_invalid")
  const actual = readFileSync(target)
  const expected = Buffer.from(serialized, "utf8")
  if (!actual.equals(expected)) fail("dna_locked_v3_output_readback_mismatch")
}

function atomicWriteNew(root, target, serialized) {
  assertSecureParentChain(root, target, true)
  if (lstatOptional(target)) fail("dna_locked_v3_output_exists")
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
    if (lstatOptional(target)) fail("dna_locked_v3_output_exists")
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
  if (lstatOptional(resultPath)) fail("dna_locked_v3_output_exists")
  if (lstatOptional(claimPath)) fail("dna_locked_v3_rerun_forbidden")
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
      fail("dna_locked_v3_rerun_forbidden")
    }
    throw error
  } finally {
    if (descriptor !== null) closeSync(descriptor)
    if (created && !committed && lstatOptional(claimPath)?.isFile()) unlinkSync(claimPath)
  }
}

function assertHoldoutManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)
    || manifest.schemaVersion !== "dna-turkish-retrieval-v3-blind-holdout-manifest@1"
    || manifest.counts?.total !== EXPECTED_COUNTS.total
    || stableJson(manifest.counts?.byCategory) !== stableJson(EXPECTED_SPLITS)
    || stableJson(manifest.counts?.byIntent) !== stableJson(EXPECTED_INTENTS)
    || manifest.storage !== "researchssd_only_0600"
    || manifest.rawPayloadInRepo !== false || manifest.runtimeEligible !== false
    || manifest.releaseEligible !== false || manifest.activationAllowed !== false
    || manifest.independentHumanValidation !== false
    || manifest.officialRunPerformed !== false || manifest.scoringPerformed !== false) {
    fail("dna_locked_v3_holdout_manifest_invalid")
  }
  for (const hash of [manifest.hashes?.sealedFileSha256,
    manifest.hashes?.sealedPayloadSha256, manifest.hashes?.authoredPayloadSha256,
    manifest.hashes?.candidatePackageSha256, manifest.hashes?.candidatePackageFileSha256,
    manifest.manifestPayloadSha256]) {
    assertSha256(hash, "dna_locked_v3_holdout_manifest_hash_invalid")
  }
  return manifest
}

function assertDevelopmentAuthority(development, frozen, adapter, reads) {
  const working = readJson(reads.workingAdapter, "dna_locked_v3_working_adapter_invalid")
  const bank = readJson(reads.bank, "dna_locked_v3_development_bank_invalid")
  const report = readJson(reads.developmentResult, "dna_locked_v3_development_result_invalid")
  const candidate = readJson(reads.candidate, "dna_locked_v3_candidate_invalid")
  if (development?.schemaVersion
      !== "dna.turkish-retrieval-v3-source-derived.repo-aggregate.v1"
    || development.adapterSha256 !== adapter.adapterSha256
    || development.sourcePackageSha256 !== adapter.sourcePackageSha256
    || development.freezeManifestSha256 !== reads.frozenManifest.fileSha256
    || development.aggregate?.allGatesPassed !== true
    || development.runtimeEligible !== false || development.releaseEligible !== false
    || development.activationAllowed !== false || development.ownerAuthority !== false) {
    fail("dna_locked_v3_development_gate_invalid")
  }
  if (frozen?.schemaVersion
      !== "dna.turkish-retrieval-v3-source-derived.freeze-manifest.v1"
    || frozen.adapterSha256 !== adapter.adapterSha256
    || frozen.sourcePackageSha256 !== adapter.sourcePackageSha256
    || frozen.aggregate?.allGatesPassed !== true || frozen.forbiddenInputsRead !== false
    || frozen.runtimeEligible !== false || frozen.releaseEligible !== false
    || frozen.activationAllowed !== false || frozen.ownerAuthority !== false) {
    fail("dna_locked_v3_frozen_manifest_invalid")
  }
  for (const hash of [
    reads.adapter.fileSha256, reads.workingAdapter.fileSha256, reads.evaluator.fileSha256,
    reads.developmentGenerator.fileSha256, reads.artifactBuilder.fileSha256,
    reads.bank.fileSha256, reads.developmentResult.fileSha256,
    reads.frozenManifest.fileSha256, reads.candidate.fileSha256,
  ]) assertSha256(hash, "dna_locked_v3_authority_file_hash_invalid")
  if (stableJson(working) !== stableJson(adapter)
    || frozen.artifactHashes?.["frozen-source-derived-adapter.json"]
      !== reads.adapter.fileSha256
    || frozen.artifactHashes?.["source-derived-adapter.json"]
      !== reads.workingAdapter.fileSha256
    || frozen.artifactHashes?.["development-bank-family-split.json"]
      !== reads.bank.fileSha256
    || frozen.artifactHashes?.["development-report.json"]
      !== reads.developmentResult.fileSha256
    || bank.schemaVersion !== "dna.turkish-retrieval-v3-source-derived.family-split.v1"
    || report.schemaVersion
      !== "dna.turkish-retrieval-v3-source-derived.development-report.v1"
    || report.adapterSha256 !== adapter.adapterSha256 || report.allGatesPassed !== true
    || report.counts?.determinismRuns !== 20
    || candidate.packageSha256 !== adapter.sourcePackageSha256) {
    fail("dna_locked_v3_authority_file_binding_mismatch")
  }
  if (candidate.runtimeEligible !== false || candidate.releaseEligible !== false
    || candidate.activationAllowed !== false) {
    fail("dna_locked_v3_development_payload_binding_mismatch")
  }
  assertPureV3EvaluatorSource(reads.evaluator.bytes.toString("utf8"))
}

function assertPreopenAuthority(manifest, receipt, reads, adapter, holdoutManifest,
  holdoutManifestSha256, developmentManifestSha256) {
  assertPreopenManifest(manifest)
  assertPreopenReceipt(receipt)
  if (manifest.receipt.rawSha256 !== reads.preopenReceipt.fileSha256
    || manifest.receipt.receiptSha256 !== receipt.receiptSha256
    || stableJson(manifest.inputBindings) !== stableJson(receipt.inputBindings)
    || stableJson(manifest.counts) !== stableJson(receipt.counts)
    || stableJson(manifest.overlap) !== stableJson(receipt.overlap)
    || stableJson(manifest.methods) !== stableJson(receipt.methods)
    || stableJson(manifest.validation) !== stableJson(receipt.validation)
    || stableJson(manifest.boundaries) !== stableJson(receipt.boundaries)
    || receipt.inputBindings.holdoutFileSha256 !== holdoutManifest.hashes.sealedFileSha256
    || receipt.inputBindings.holdoutSealedPayloadSha256
      !== holdoutManifest.hashes.sealedPayloadSha256
    || receipt.inputBindings.holdoutManifestFileSha256 !== holdoutManifestSha256
    || receipt.inputBindings.candidatePackageSha256
      !== holdoutManifest.hashes.candidatePackageSha256
    || receipt.inputBindings.candidatePackageFileSha256 !== reads.candidate.fileSha256
    || receipt.inputBindings.frozenAdapterSha256 !== adapter.adapterSha256
    || receipt.inputBindings.frozenAdapterFileSha256 !== reads.adapter.fileSha256
    || receipt.inputBindings.workingAdapterFileSha256 !== reads.workingAdapter.fileSha256
    || receipt.inputBindings.developmentFamilyBankFileSha256 !== reads.bank.fileSha256
    || receipt.inputBindings.developmentReportFileSha256
      !== reads.developmentResult.fileSha256
    || receipt.inputBindings.freezeManifestFileSha256 !== reads.frozenManifest.fileSha256
    || receipt.inputBindings.developmentRepoManifestFileSha256
      !== developmentManifestSha256
    || receipt.inputBindings.routingCoreFileSha256 !== reads.evaluator.fileSha256
    || receipt.inputBindings.developmentGeneratorFileSha256
      !== reads.developmentGenerator.fileSha256
    || receipt.inputBindings.artifactBuilderFileSha256
      !== reads.artifactBuilder.fileSha256
    || receipt.inputBindings.integrityScriptFileSha256
      !== reads.preopenIntegrityScript.fileSha256
    || receipt.inputBindings.integrityCoreFileSha256
      !== reads.preopenIntegrityCore.fileSha256) {
    fail("dna_locked_v3_preopen_authority_binding_mismatch")
  }
}

export function loadOfficialAuthority(repositoryRootInput = process.cwd(),
  researchRootInput = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD") {
  const repositoryRoot = resolveRoot(repositoryRootInput)
  const researchRoot = resolveRoot(researchRootInput, true)
  const holdoutManifestRead = readSecureFile(repositoryRoot, PATHS.holdoutManifest)
  const developmentManifestRead = readSecureFile(repositoryRoot, PATHS.developmentManifest)
  const preopenManifestRead = readSecureFile(repositoryRoot, PATHS.preopenManifest)
  const reads = {
    adapter: readSecureFile(researchRoot, PATHS.adapter, { mode: 0o600 }),
    workingAdapter: readSecureFile(researchRoot, PATHS.workingAdapter, { mode: 0o600 }),
    candidate: readSecureFile(researchRoot, PATHS.candidate, { mode: 0o600 }),
    bank: readSecureFile(researchRoot, PATHS.developmentBank, { mode: 0o600 }),
    developmentResult: readSecureFile(researchRoot, PATHS.developmentResult, { mode: 0o600 }),
    frozenManifest: readSecureFile(researchRoot, PATHS.frozenManifest, { mode: 0o600 }),
    preopenReceipt: readSecureFile(researchRoot, PATHS.preopenReceipt, { mode: 0o600 }),
    evaluator: readSecureFile(repositoryRoot, PATHS.evaluator),
    developmentGenerator: readSecureFile(repositoryRoot, PATHS.developmentGenerator),
    artifactBuilder: readSecureFile(repositoryRoot, PATHS.artifactBuilder),
    preopenIntegrityScript: readSecureFile(repositoryRoot, PATHS.preopenIntegrityScript),
    preopenIntegrityCore: readSecureFile(repositoryRoot, PATHS.preopenIntegrityCore),
  }
  const holdoutManifest = assertHoldoutManifest(readJson(holdoutManifestRead,
    "dna_locked_v3_holdout_manifest_json_invalid"))
  const development = readJson(developmentManifestRead,
    "dna_locked_v3_development_manifest_json_invalid")
  const frozen = readJson(reads.frozenManifest, "dna_locked_v3_frozen_manifest_json_invalid")
  const preopenManifest = readJson(preopenManifestRead,
    "dna_locked_v3_preopen_manifest_json_invalid")
  const preopenReceipt = readJson(reads.preopenReceipt,
    "dna_locked_v3_preopen_receipt_json_invalid")
  const adapter = assertFrozenAdapter(readJson(reads.adapter, "dna_locked_v3_adapter_json_invalid"))
  assertDevelopmentAuthority(development, frozen, adapter, reads)
  assertPreopenAuthority(preopenManifest, preopenReceipt, reads, adapter, holdoutManifest,
    holdoutManifestRead.fileSha256, developmentManifestRead.fileSha256)
  if (holdoutManifest.hashes.candidatePackageSha256 !== adapter.sourcePackageSha256
    || holdoutManifest.hashes.candidatePackageFileSha256 !== reads.candidate.fileSha256) {
    fail("dna_locked_v3_holdout_candidate_binding_mismatch")
  }
  const harnessRead = readSecureFile(repositoryRoot,
    "scripts/run-dna-one-shot-locked-evaluation-v3.mjs")
  const coreRead = readSecureFile(repositoryRoot,
    "scripts/lib/dna-locked-retrieval-v3-core.mjs")
  const evaluationCodeSha256 = stableSha256({
    harnessFileSha256: harnessRead.fileSha256,
    coreFileSha256: coreRead.fileSha256,
    evaluatorCodeSha256: reads.evaluator.fileSha256,
    developmentGeneratorFileSha256: reads.developmentGenerator.fileSha256,
    artifactBuilderFileSha256: reads.artifactBuilder.fileSha256,
  })
  const authorityPayload = {
    adapterSha256: adapter.adapterSha256,
    adapterFileSha256: reads.adapter.fileSha256,
    workingAdapterFileSha256: reads.workingAdapter.fileSha256,
    candidatePackageSha256: adapter.sourcePackageSha256,
    candidateFileSha256: reads.candidate.fileSha256,
    developmentBankFileSha256: reads.bank.fileSha256,
    developmentResultFileSha256: reads.developmentResult.fileSha256,
    freezeManifestFileSha256: reads.frozenManifest.fileSha256,
    evaluatorCodeSha256: reads.evaluator.fileSha256,
    developmentGeneratorFileSha256: reads.developmentGenerator.fileSha256,
    artifactBuilderFileSha256: reads.artifactBuilder.fileSha256,
    developmentManifestSha256: developmentManifestRead.fileSha256,
    frozenManifestSha256: reads.frozenManifest.fileSha256,
    holdoutManifestSha256: holdoutManifestRead.fileSha256,
    preopenManifestSha256: preopenManifestRead.fileSha256,
    preopenReceiptFileSha256: reads.preopenReceipt.fileSha256,
    preopenReceiptSha256: preopenReceipt.receiptSha256,
    holdoutSha256: holdoutManifest.hashes.sealedFileSha256,
    holdoutSealedPayloadSha256: holdoutManifest.hashes.sealedPayloadSha256,
    evaluationCodeSha256,
  }
  return deepFreeze({
    repositoryRoot,
    researchRoot,
    holdoutManifest,
    holdoutManifestSha256: holdoutManifestRead.fileSha256,
    developmentManifestSha256: developmentManifestRead.fileSha256,
    frozenManifestSha256: reads.frozenManifest.fileSha256,
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
  if (sha256(bytes) !== expectedSha256) fail("dna_locked_v3_evaluator_changed_after_binding")
  assertPureV3EvaluatorSource(bytes.toString("utf8"))
  const module = await import(`${pathToFileURL(path).href}?sha256=${expectedSha256}`)
  if (typeof module.routeSourceDerivedQuery !== "function") {
    fail("dna_locked_v3_evaluator_export_invalid")
  }
  return module.routeSourceDerivedQuery
}

function loadHoldoutAfterClaim(researchRoot, manifest) {
  const read = readSecureFile(researchRoot, PATHS.holdoutArtifact, {
    mode: 0o600,
    modeCode: "dna_locked_v3_holdout_mode_mismatch",
  })
  if (read.fileSha256 !== manifest.hashes.sealedFileSha256) {
    fail("dna_locked_v3_holdout_file_binding_mismatch")
  }
  const artifact = readJson(read, "dna_locked_v3_holdout_json_invalid")
  assertSealedHoldoutArtifact(artifact, {
    fileSha256: read.fileSha256,
    sealedPayloadSha256: manifest.hashes.sealedPayloadSha256,
    candidatePackageSha256: manifest.hashes.candidatePackageSha256,
    candidatePackageFileSha256: manifest.hashes.candidatePackageFileSha256,
  })
  return { artifact, read }
}

export async function runOneShotV3(input) {
  const artifactPath = resolveRelative(input.researchRoot, PATHS.holdoutArtifact)
  const resultPath = input.resultPath || join(dirname(artifactPath), PATHS.resultFilename)
  const claimPath = input.claimPath || join(dirname(artifactPath), PATHS.claimFilename)
  if (dirname(resultPath) !== dirname(artifactPath) || dirname(claimPath) !== dirname(artifactPath)) {
    fail("dna_locked_v3_output_directory_mismatch")
  }
  acquireClaim(input.researchRoot, claimPath, resultPath, {
    adapterSha256: input.adapter.adapterSha256,
    holdoutSha256: input.holdoutManifest.hashes.sealedFileSha256,
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
    runId: `locked-eval-v3:${stableSha256({
      adapterSha256: input.adapter.adapterSha256,
      holdoutSha256: input.holdoutManifest.hashes.sealedFileSha256,
      authoritySha256: input.authoritySha256,
      recordedAt,
    }).slice(0, 32)}`,
    recordedAt,
    adapterSha256: input.adapter.adapterSha256,
    holdoutSha256: input.holdoutManifest.hashes.sealedFileSha256,
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
  for (const item of loaded.artifact.payload.items) {
    if (serialized.includes(item.question) || serialized.includes(item.id)) {
      fail("dna_locked_v3_result_item_leak")
    }
  }
  atomicWriteNew(input.researchRoot, resultPath, serialized)
  return { result, resultPath, claimPath, qualityGate: qualityGate(result.metrics) }
}

function syntheticArtifact() {
  const items = []
  let sequence = 0
  const intents = Object.keys(EXPECTED_INTENTS)
  const add = (category, expectedDisposition, expectedTopic, text) => {
    sequence += 1
    items.push({
      id: `tr-v3-blind-${String(sequence).padStart(3, "0")}`,
      question: `${text} benzersiz sentetik soru ${sequence}`,
      category,
      intent: intents[(sequence - 1) % intents.length],
      expectedDisposition,
      expectedTopic,
      authoritySourceId: expectedDisposition === "answer" ? `source:${sequence}` : null,
      semanticFamily: `synthetic-family-${sequence}`,
      perturbations: [],
    })
  }
  for (let topicIndex = 0; topicIndex < TOPIC_IDS.length; topicIndex += 1) {
    for (let index = 0; index < 4; index += 1) add("natural_supported", "answer",
      TOPIC_IDS[topicIndex], `route topic${topicIndex} natural ${index}`)
    for (let index = 0; index < 3; index += 1) add("hard_neighbor", "answer",
      TOPIC_IDS[topicIndex], `route topic${topicIndex} hard ${index}`)
    for (let index = 0; index < 2; index += 1) add("safe_theory_control", "answer",
      TOPIC_IDS[topicIndex], `route topic${topicIndex} safe ${index}`)
  }
  for (let index = 0; index < 42; index += 1) {
    add("ambiguous", "clarify", null, `clarify ambiguity ${index}`)
  }
  for (let index = 0; index < 28; index += 1) {
    add("unsupported", "abstain", null, `abstain unsupported ${index}`)
  }
  const payloadBase = {
    activationAllowed: false,
    authorityClass: "external_science_candidate_only",
    basisAt: "2026-07-24T00:00:00.000Z",
    blindness: {},
    counts: {
      total: 196,
      topics: 14,
      byCategory: EXPECTED_SPLITS,
      byIntent: EXPECTED_INTENTS,
      byDisposition: { answer: 126, clarify: 42, abstain: 28 },
      perAuthorityTopic: Object.fromEntries(TOPIC_IDS.map((topicId) => [topicId, 14])),
    },
    evaluationId: "synthetic-v3",
    independentHumanValidation: false,
    items,
    language: "tr",
    officialRunPerformed: false,
    runtimeEligible: false,
    releaseEligible: false,
    schemaVersion: "dna-turkish-retrieval-v3-blind-holdout@1",
    scoringPerformed: false,
    sourceBinding: {},
  }
  const prettyHash = (value) => sha256(`${JSON.stringify(JSON.parse(stableJson(value)), null, 2)}\n`)
  const payload = { ...payloadBase, payloadSha256: prettyHash(payloadBase) }
  const base = {
    activationAllowed: false,
    authoredPayloadSha256: payload.payloadSha256,
    candidatePackageFileSha256: "2".repeat(64),
    candidatePackageSha256: "1".repeat(64),
    independentHumanValidation: false,
    officialRunPerformed: false,
    payload,
    releaseEligible: false,
    runtimeEligible: false,
    schemaVersion: "dna-turkish-retrieval-v3-blind-sealed-holdout@1",
    scoringPerformed: false,
    sealPolicy: "atomic_hash_bound_ssd_0600_no_local_fallback@1",
  }
  return { ...base, sealedPayloadSha256: prettyHash(base) }
}

function syntheticRoute(question) {
  const base = {
    schemaVersion: "synthetic-route@1",
    authorityClass: "development_only_source_derived",
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    ownerAuthority: false,
    intent: "scope",
    answerUnits: [],
  }
  if (question.startsWith("clarify")) return { ...base, action: "clarify", topics: [] }
  if (question.startsWith("abstain")) return { ...base, action: "abstain", topics: [] }
  const match = question.match(/^route topic(\d+)/)
  return {
    ...base,
    action: "retrieve",
    topics: [{ topicId: TOPIC_IDS[Number(match?.[1] ?? -1)] ?? null, score: 1 }],
  }
}

function syntheticAdapter() {
  return {
    adapterSha256: "a".repeat(64),
    topicProfiles: TOPIC_IDS.map((topicId) => ({ topicId })),
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    ownerAuthority: false,
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
      hashes: {
        sealedFileSha256: sha256(Buffer.from(text)),
        sealedPayloadSha256: artifact.sealedPayloadSha256,
        candidatePackageSha256: artifact.candidatePackageSha256,
        candidatePackageFileSha256: artifact.candidatePackageFileSha256,
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
    fail(`dna_locked_v3_unexpected_failure:${error instanceof Error ? error.message : String(error)}`)
  }
  fail("dna_locked_v3_expected_failure_missing")
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
    "Outputs/SelfMetaAI/dna-intelligence/.locked-v3-harness-test-"))
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
      const output = await runOneShotV3(syntheticInput(root, fixture, {
        onClaimCommitted: ({ claimPath }) => {
          claimObserved = existsSync(claimPath) && (lstatSync(claimPath).mode & 0o777) === 0o600
        },
      }))
      if (!claimObserved || output.qualityGate.status !== "pass"
        || output.result.metrics.determinism.uniqueHashes !== 1
        || output.result.metrics.overallAccuracy !== 1) fail("dna_locked_v3_synthetic_success_failed")
      const serialized = readFileSync(output.resultPath, "utf8")
      for (const item of fixture.artifact.payload.items) {
        if (serialized.includes(item.question) || serialized.includes(item.id)) {
          fail("dna_locked_v3_synthetic_result_leak")
        }
      }
    })

    await check("no_rerun", async () => {
      const root = join(temporaryRoot, "rerun")
      mkdirSync(root, { recursive: true })
      const fixture = writeSyntheticFixture(root)
      const input = syntheticInput(root, fixture)
      await runOneShotV3(input)
      await expectFailure(() => runOneShotV3(input), "dna_locked_v3_output_exists")
    })

    await check("hash_tamper_fail_closed", async () => {
      const root = join(temporaryRoot, "hash")
      mkdirSync(root, { recursive: true })
      const fixture = writeSyntheticFixture(root)
      fixture.manifest.hashes.sealedFileSha256 = "0".repeat(64)
      await expectFailure(() => runOneShotV3(syntheticInput(root, fixture)),
        "dna_locked_v3_holdout_file_binding_mismatch")
      if (!existsSync(join(dirname(fixture.path), PATHS.claimFilename))) {
        fail("dna_locked_v3_claim_not_persisted_after_failure")
      }
      await expectFailure(() => runOneShotV3(syntheticInput(root, fixture)),
        "dna_locked_v3_rerun_forbidden")
    })

    await check("mode_tamper_fail_closed", async () => {
      const root = join(temporaryRoot, "mode")
      mkdirSync(root, { recursive: true })
      const fixture = writeSyntheticFixture(root)
      chmodSync(fixture.path, 0o644)
      await expectFailure(() => runOneShotV3(syntheticInput(root, fixture)),
        "dna_locked_v3_holdout_mode_mismatch")
    })

    await check("leaf_symlink_fail_closed", async () => {
      const root = join(temporaryRoot, "leaf-link")
      mkdirSync(root, { recursive: true })
      const fixture = writeSyntheticFixture(root)
      const real = `${fixture.path}.real`
      renameSync(fixture.path, real)
      symlinkSync(real, fixture.path)
      await expectFailure(() => runOneShotV3(syntheticInput(root, fixture)),
        "dna_locked_v3_symlink_forbidden")
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
          hashes: {
            sealedFileSha256: "1".repeat(64),
            sealedPayloadSha256: "2".repeat(64),
            candidatePackageSha256: "3".repeat(64),
            candidatePackageFileSha256: "4".repeat(64),
          },
        },
      }
      await expectFailure(() => runOneShotV3(syntheticInput(root, fixture)),
        "dna_locked_v3_secure_parent_symlink_forbidden")
    })

    await check("output_forbidden", async () => {
      const root = join(temporaryRoot, "output")
      mkdirSync(root, { recursive: true })
      const fixture = writeSyntheticFixture(root)
      const route = () => {
        console.log("forbidden")
        return { decision: "abstain", topicId: null }
      }
      await expectFailure(() => runOneShotV3(syntheticInput(root, fixture, { route })),
        "dna_locked_v3_evaluator_output_forbidden")
    })

    await check("mutation_forbidden", async () => {
      const root = join(temporaryRoot, "mutation")
      mkdirSync(root, { recursive: true })
      const fixture = writeSyntheticFixture(root)
      const route = (_question, adapter) => {
        adapter.mutated = true
        return { decision: "abstain", topicId: null }
      }
      await expectFailure(() => runOneShotV3(syntheticInput(root, fixture, { route })))
    })

    await check("impure_source_rejected", async () => {
      await expectFailure(() => Promise.resolve(assertPureV3EvaluatorSource(
        "export function routeSourceDerivedQuery(query, adapter) { console.log(query); return adapter } export function loadAdapter() {}",
      )))
      const longImpure = `export function routeSourceDerivedQuery(query, adapter) { console.log(query); return adapter }${" ".repeat(100)}export function loadAdapter() {}`
      await expectFailure(() => Promise.resolve(assertPureV3EvaluatorSource(longImpure)),
        "dna_locked_v3_evaluator_impure_or_forbidden_source")
    })

    await check("path_escape_rejected", async () => {
      await expectFailure(() => Promise.resolve(resolveRelative(temporaryRoot, "../escape")),
        "dna_locked_v3_path_invalid")
    })

    await check("local_fallback_rejected", async () => {
      await expectFailure(() => Promise.resolve(resolveRoot("/tmp", true)))
    })

    await check("result_tamper_rejected", async () => {
      const root = join(temporaryRoot, "result-tamper")
      mkdirSync(root, { recursive: true })
      const fixture = writeSyntheticFixture(root)
      const output = await runOneShotV3(syntheticInput(root, fixture))
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
        runId: `locked-eval-v3:${"a".repeat(32)}`,
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
        "dna_locked_v3_result_split_metric_fields_invalid")
    })

    await check("twenty_run_determinism", async () => {
      const artifact = syntheticArtifact()
      const evaluated = evaluateLockedHoldout(syntheticRoute, syntheticAdapter(), artifact)
      if (evaluated.metrics.determinism.repeats !== 20
        || evaluated.metrics.determinism.uniqueHashes !== 1) {
        fail("dna_locked_v3_twenty_run_test_failed")
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
  const output = await runOneShotV3(authority)
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
    process.stderr.write(`${process.env.DNA_LOCKED_V3_DEBUG === "1" && error instanceof Error
      ? error.stack : error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}

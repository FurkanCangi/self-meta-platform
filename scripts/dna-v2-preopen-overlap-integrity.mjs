#!/usr/bin/env node

import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

import {
  assertContained,
  readSecureFile,
  secureAtomicWriteFile,
  verifySecureFile,
} from "./lib/dna-secure-artifact-v2.mjs"
import {
  PREOPEN_MANIFEST_SCHEMA,
  PREOPEN_RECEIPT_SCHEMA,
  analyzeOverlap,
  assertPreopenManifest,
  assertPreopenReceipt,
  assertZeroOverlap,
  fail,
  stableJson,
  stableSha256,
  withoutKey,
} from "./lib/dna-v2-preopen-overlap-core.mjs"
import {
  assertSealedHoldoutArtifact,
} from "./lib/dna-locked-retrieval-v2-core.mjs"

export const PREOPEN_PATHS = Object.freeze({
  holdoutArtifact:
    "Datasets/DNA-Intelligence/evaluation/internal-locked-turkish-holdout/v2/questions-and-answers.json",
  developmentBank:
    "Datasets/DNA-Intelligence/evaluation/development-banks/turkish-retrieval-v2/development-bank.json",
  holdoutManifest:
    "docs/dna-intelligence/program/evidence/internal-locked-turkish-holdout-v2-current.json",
  developmentManifest:
    "docs/dna-intelligence/program/evidence/turkish-retrieval-adapter-development-v2-current.json",
  receipt:
    "Datasets/DNA-Intelligence/evaluation/preopen-integrity/turkish-retrieval-v2/overlap-receipt.json",
  manifest:
    "docs/dna-intelligence/program/evidence/turkish-retrieval-v2-preopen-overlap-current.json",
  integrityScript: "scripts/dna-v2-preopen-overlap-integrity.mjs",
  integrityCore: "scripts/lib/dna-v2-preopen-overlap-core.mjs",
})

function parseJson(bytes, code) {
  try {
    return JSON.parse(bytes.toString("utf8"))
  } catch {
    fail(code)
  }
}

function resolveRoot(requested, exactResearchSsd = false) {
  const root = resolve(requested)
  if (!existsSync(root)) fail("dna_v2_preopen_root_missing")
  const metadata = lstatSync(root)
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    fail("dna_v2_preopen_root_invalid")
  }
  const real = realpathSync(root)
  if (real !== root) fail("dna_v2_preopen_root_realpath_mismatch")
  if (exactResearchSsd && real !== "/Volumes/ResearchSSD") {
    fail("dna_v2_preopen_local_fallback_forbidden")
  }
  return real
}

function secureRead(root, relativePath, require0600 = false) {
  if (typeof relativePath !== "string" || !relativePath || relativePath.startsWith("/")
    || relativePath.includes("..")) fail("dna_v2_preopen_path_invalid")
  const target = assertContained(root, resolve(root, relativePath))
  const read = readSecureFile(root, target, require0600)
  return { ...read, target, value: parseJson(read.bytes, "dna_v2_preopen_json_invalid") }
}

function validateHoldoutManifest(manifest, holdoutRead) {
  if (manifest?.schemaVersion !== "dna-internal-locked-turkish-holdout-manifest@2"
    || manifest.label !== "internal_validation_v2"
    || manifest.artifact?.researchSsdRelativePath !== PREOPEN_PATHS.holdoutArtifact
    || manifest.artifact?.sha256 !== holdoutRead.sha256
    || manifest.artifact?.byteCount !== holdoutRead.bytes.length
    || manifest.privacyBoundary?.visibleToAdapterTuning !== false
    || manifest.privacyBoundary?.runtimeEligible !== false
    || manifest.privacyBoundary?.releaseEligible !== false) {
    fail("dna_v2_preopen_holdout_manifest_invalid")
  }
}

function validateDevelopmentBank(bank, bankRead, developmentManifest) {
  if (bank?.schemaVersion !== "dna-turkish-retrieval-v2-development-bank@1"
    || stableSha256(withoutKey(bank, "bankSha256")) !== bank.bankSha256
    || bank.counts?.total !== 708 || bank.counts?.newDevelopmentOnly !== 560
    || bank.counts?.existingExternalScienceQa !== 148
    || bank.counts?.legacyExternalQa !== 148
    || bank.boundaries?.lockedHoldoutAccessed !== false
    || bank.boundaries?.runtimeEligible !== false
    || bank.boundaries?.releaseEligible !== false
    || !Array.isArray(bank.questions) || bank.questions.length !== 708
    || bank.questions.some((question) => typeof question?.question !== "string")) {
    fail("dna_v2_preopen_development_bank_invalid")
  }
  if (developmentManifest?.schemaVersion !== "dna-turkish-retrieval-v2-development-manifest@1"
    || developmentManifest.version !== "turkish-retrieval-v2"
    || developmentManifest.inputHashes?.developmentBankFileSha256 !== bankRead.sha256
    || developmentManifest.inputHashes?.developmentBankSha256 !== bank.bankSha256
    || developmentManifest.boundaries?.lockedHoldoutAccessed !== false
    || developmentManifest.boundaries?.runtimeEligible !== false
    || developmentManifest.boundaries?.releaseEligible !== false) {
    fail("dna_v2_preopen_development_manifest_invalid")
  }
}

export function collectPreopenInputs(repositoryRootInput = process.cwd(),
  researchRootInput = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD") {
  const repositoryRoot = resolveRoot(repositoryRootInput)
  const researchRoot = resolveRoot(researchRootInput, true)
  const holdout = secureRead(researchRoot, PREOPEN_PATHS.holdoutArtifact, true)
  const bank = secureRead(researchRoot, PREOPEN_PATHS.developmentBank, true)
  const holdoutManifest = secureRead(repositoryRoot, PREOPEN_PATHS.holdoutManifest)
  const developmentManifest = secureRead(repositoryRoot, PREOPEN_PATHS.developmentManifest)
  const integrityScript = readSecureFile(repositoryRoot,
    resolve(repositoryRoot, PREOPEN_PATHS.integrityScript))
  const integrityCore = readSecureFile(repositoryRoot,
    resolve(repositoryRoot, PREOPEN_PATHS.integrityCore))

  assertSealedHoldoutArtifact(holdout.value, holdout.sha256)
  validateHoldoutManifest(holdoutManifest.value, holdout)
  validateDevelopmentBank(bank.value, bank, developmentManifest.value)
  if (holdout.value.artifactSha256 !== stableSha256(withoutKey(holdout.value, "artifactSha256"))) {
    fail("dna_v2_preopen_holdout_logical_hash_invalid")
  }
  return {
    repositoryRoot,
    researchRoot,
    holdout,
    bank,
    holdoutManifest,
    developmentManifest,
    integrityScript,
    integrityCore,
  }
}

export function buildPreopenReceipt(inputs, recordedAt = new Date().toISOString()) {
  const developmentQuestions = inputs.bank.value.questions.map((question) => question.question)
  const holdoutQuestions = inputs.holdout.value.items.map((item) => item.question)
  const aggregateHashes = new Set()
  let overlap
  for (let repeat = 0; repeat < 20; repeat += 1) {
    const current = assertZeroOverlap(analyzeOverlap(developmentQuestions, holdoutQuestions))
    aggregateHashes.add(stableSha256(current))
    overlap = current
  }
  if (aggregateHashes.size !== 1) fail("dna_v2_preopen_determinism_failed")
  const payload = {
    schemaVersion: PREOPEN_RECEIPT_SCHEMA,
    recordedAt,
    status: "pass_zero_cross_set_overlap",
    inputBindings: {
      holdoutArtifactSha256: inputs.holdout.value.artifactSha256,
      holdoutFileSha256: inputs.holdout.sha256,
      holdoutManifestFileSha256: inputs.holdoutManifest.sha256,
      developmentBankSha256: inputs.bank.value.bankSha256,
      developmentBankFileSha256: inputs.bank.sha256,
      developmentManifestFileSha256: inputs.developmentManifest.sha256,
      allowedLegacyQaFileSha256:
        inputs.bank.value.inputs.existingExternalScienceQaFileSha256,
      integrityScriptFileSha256: inputs.integrityScript.sha256,
      integrityCoreFileSha256: inputs.integrityCore.sha256,
    },
    counts: {
      holdoutQuestions: inputs.holdout.value.items.length,
      developmentQuestions: inputs.bank.value.questions.length,
      newDevelopmentQuestions: inputs.bank.value.counts.newDevelopmentOnly,
      allowedLegacyQuestions: inputs.bank.value.counts.existingExternalScienceQa,
    },
    overlap,
    methods: {
      exact: "trimmed_utf8_exact@1",
      normalized: "turkish_nfkd_ascii_prompt_normalization@1",
      nearDuplicate: "token_edit_distance_at_most_one_90_percent@1",
      semanticFamily: "sorted_meaningful_light_stem_fingerprint@1",
    },
    validation: {
      deterministicRepeats: 20,
      uniqueAggregateHashes: aggregateHashes.size,
    },
    boundaries: {
      aggregateOnly: true,
      payloadReadByIntegrityRole: true,
      questionTextStored: false,
      questionIdsStored: false,
      failureExamplesStored: false,
      visibleToAdapterTuning: false,
      adapterTuningUseAllowed: false,
      independentHumanValidation: false,
      runtimeEligible: false,
      releaseEligible: false,
      activationAllowed: false,
    },
  }
  return assertPreopenReceipt({ ...payload, receiptSha256: stableSha256(payload) })
}

export function buildPreopenManifest(receipt, rawSha256) {
  const payload = {
    schemaVersion: PREOPEN_MANIFEST_SCHEMA,
    recordedAt: receipt.recordedAt,
    status: receipt.status,
    receipt: {
      researchSsdRelativePath: PREOPEN_PATHS.receipt,
      rawSha256,
      receiptSha256: receipt.receiptSha256,
      fileMode: "0600",
    },
    inputBindings: receipt.inputBindings,
    counts: receipt.counts,
    overlap: receipt.overlap,
    methods: receipt.methods,
    validation: receipt.validation,
    boundaries: receipt.boundaries,
  }
  return assertPreopenManifest({ ...payload, manifestSha256: stableSha256(payload) })
}

function serialized(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function write() {
  const inputs = collectPreopenInputs()
  const receiptTarget = resolve(inputs.researchRoot, PREOPEN_PATHS.receipt)
  let recordedAt = new Date().toISOString()
  if (existsSync(receiptTarget)) {
    const current = secureRead(inputs.researchRoot, PREOPEN_PATHS.receipt, true)
    assertPreopenReceipt(current.value)
    recordedAt = current.value.recordedAt
  }
  const receipt = buildPreopenReceipt(inputs, recordedAt)
  const receiptText = serialized(receipt)
  secureAtomicWriteFile(inputs.researchRoot, receiptTarget, receiptText)
  const receiptReadback = verifySecureFile(inputs.researchRoot, receiptTarget, receiptText)
  const manifest = buildPreopenManifest(receipt, receiptReadback.sha256)
  const manifestTarget = resolve(inputs.repositoryRoot, PREOPEN_PATHS.manifest)
  const manifestText = serialized(manifest)
  secureAtomicWriteFile(inputs.repositoryRoot, manifestTarget, manifestText)
  verifySecureFile(inputs.repositoryRoot, manifestTarget, manifestText)
  return {
    ok: true,
    status: manifest.status,
    receiptSha256: receipt.receiptSha256,
    receiptFileSha256: receiptReadback.sha256,
    manifestSha256: manifest.manifestSha256,
    counts: manifest.counts,
    overlap: manifest.overlap,
    boundaries: manifest.boundaries,
  }
}

export function verify() {
  const inputs = collectPreopenInputs()
  const receiptRead = secureRead(inputs.researchRoot, PREOPEN_PATHS.receipt, true)
  const manifestRead = secureRead(inputs.repositoryRoot, PREOPEN_PATHS.manifest, true)
  const receipt = assertPreopenReceipt(receiptRead.value)
  const manifest = assertPreopenManifest(manifestRead.value)
  const recomputed = buildPreopenReceipt(inputs, receipt.recordedAt)
  const expectedManifest = buildPreopenManifest(recomputed, receiptRead.sha256)
  if (stableJson(receipt) !== stableJson(recomputed)
    || stableJson(manifest) !== stableJson(expectedManifest)
    || manifest.receipt.rawSha256 !== receiptRead.sha256
    || manifest.receipt.receiptSha256 !== receipt.receiptSha256) {
    fail("dna_v2_preopen_receipt_or_manifest_drift")
  }
  return {
    ok: true,
    status: manifest.status,
    receiptSha256: receipt.receiptSha256,
    receiptFileSha256: receiptRead.sha256,
    manifestSha256: manifest.manifestSha256,
    counts: manifest.counts,
    overlap: manifest.overlap,
    boundaries: manifest.boundaries,
  }
}

function expectFailure(action) {
  let failed = false
  try {
    action()
  } catch {
    failed = true
  }
  if (!failed) fail("dna_v2_preopen_expected_failure_missing")
}

function syntheticReceipt(overlap = {
  exactOverlap: 0,
  normalizedOverlap: 0,
  nearDuplicateOverlap: 0,
  semanticFamilyOverlap: 0,
}) {
  const payload = {
    schemaVersion: PREOPEN_RECEIPT_SCHEMA,
    recordedAt: "2026-07-24T00:00:00.000Z",
    status: "pass_zero_cross_set_overlap",
    inputBindings: {
      holdoutArtifactSha256: "1".repeat(64),
      holdoutFileSha256: "2".repeat(64),
      holdoutManifestFileSha256: "3".repeat(64),
      developmentBankSha256: "4".repeat(64),
      developmentBankFileSha256: "5".repeat(64),
      developmentManifestFileSha256: "6".repeat(64),
      allowedLegacyQaFileSha256: "7".repeat(64),
      integrityScriptFileSha256: "8".repeat(64),
      integrityCoreFileSha256: "9".repeat(64),
    },
    counts: {
      holdoutQuestions: 196,
      developmentQuestions: 708,
      newDevelopmentQuestions: 560,
      allowedLegacyQuestions: 148,
    },
    overlap,
    methods: {
      exact: "trimmed_utf8_exact@1",
      normalized: "turkish_nfkd_ascii_prompt_normalization@1",
      nearDuplicate: "token_edit_distance_at_most_one_90_percent@1",
      semanticFamily: "sorted_meaningful_light_stem_fingerprint@1",
    },
    validation: {
      deterministicRepeats: 20,
      uniqueAggregateHashes: 1,
    },
    boundaries: {
      aggregateOnly: true,
      payloadReadByIntegrityRole: true,
      questionTextStored: false,
      questionIdsStored: false,
      failureExamplesStored: false,
      visibleToAdapterTuning: false,
      adapterTuningUseAllowed: false,
      independentHumanValidation: false,
      runtimeEligible: false,
      releaseEligible: false,
      activationAllowed: false,
    },
  }
  return { ...payload, receiptSha256: stableSha256(payload) }
}

function test() {
  const tests = []
  const check = (name, action) => {
    action()
    tests.push(name)
  }
  check("zero_overlap_pass", () => {
    assertZeroOverlap(analyzeOverlap(
      ["İnsular korteks interosepsiyonla nasıl ilişkilidir?"],
      ["HRV ölçümünde solunum neden önemlidir?"],
    ))
  })
  check("exact_overlap_fail_closed", () => {
    expectFailure(() => assertZeroOverlap(analyzeOverlap(
      ["İnsular korteks nedir?"], ["İnsular korteks nedir?"])))
  })
  check("normalized_overlap_fail_closed", () => {
    expectFailure(() => assertZeroOverlap(analyzeOverlap(
      ["İnsular korteks nedir?"], ["insular korteks ne demek"])))
  })
  check("near_duplicate_overlap_fail_closed", () => {
    expectFailure(() => assertZeroOverlap(analyzeOverlap(
      ["HRV ölçümünde solunum bağlamı neden önemlidir"],
      ["HRV ölçümünde solunum baglami neden onemlidi"],
    )))
  })
  check("semantic_family_overlap_fail_closed", () => {
    expectFailure(() => assertZeroOverlap(analyzeOverlap(
      ["İnsular korteks interosepsiyon ilişkisi"],
      ["Interosepsiyon ilişkisi insular korteks"],
    )))
  })
  check("receipt_tamper_fail_closed", () => {
    const receipt = syntheticReceipt()
    const tampered = structuredClone(receipt)
    tampered.counts.holdoutQuestions = 195
    expectFailure(() => assertPreopenReceipt(tampered))
  })
  check("nonzero_receipt_fail_closed", () => {
    const overlap = {
      exactOverlap: 1, normalizedOverlap: 1, nearDuplicateOverlap: 1,
      semanticFamilyOverlap: 1,
    }
    expectFailure(() => assertPreopenReceipt(syntheticReceipt(overlap)))
  })
  check("twenty_repeat_determinism", () => {
    const hashes = new Set()
    for (let repeat = 0; repeat < 20; repeat += 1) {
      hashes.add(stableSha256(analyzeOverlap(
        ["Otonom testte postür etkisi nedir?"],
        ["Uyku ve duygusal reaktivite ilişkisi nasıldır?"],
      )))
    }
    if (hashes.size !== 1) fail("dna_v2_preopen_determinism_failed")
  })

  const temporary = mkdtempSync(join(tmpdir(), "dna-v2-preopen-"))
  try {
    check("local_fallback_fail_closed", () => {
      expectFailure(() => resolveRoot(temporary, true))
    })
    check("mode_tamper_fail_closed", () => {
      const path = join(temporary, "mode.json")
      writeFileSync(path, "{}\n", { mode: 0o600 })
      chmodSync(path, 0o644)
      expectFailure(() => readSecureFile(temporary, path, true))
    })
    check("symlink_fail_closed", () => {
      const real = join(temporary, "real.json")
      const link = join(temporary, "link.json")
      writeFileSync(real, "{}\n", { mode: 0o600 })
      symlinkSync(real, link)
      expectFailure(() => readSecureFile(temporary, link, true))
    })
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
  return {
    ok: true,
    tests: tests.length,
    testNames: tests,
    officialScoringExecuted: false,
    officialClaimCreated: false,
    officialResultCreated: false,
    lockedPayloadRead: false,
    aggregateOnly: true,
  }
}

function parseCommand(argv) {
  if (argv.length !== 1 || !["write", "verify", "test"].includes(argv[0])) {
    fail("dna_v2_preopen_cli_invalid")
  }
  return argv[0]
}

function main() {
  const command = parseCommand(process.argv.slice(2))
  const output = command === "write" ? write() : command === "verify" ? verify() : test()
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  try {
    main()
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}

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
} from "./lib/dna-v3-preopen-overlap-core.mjs"
import {
  createDevelopmentBanks,
} from "./dna-turkish-retrieval-v3-source-derived-development.mjs"
import {
  sha256 as sourceSha256,
  stableStringify as sourceStableStringify,
} from "./dna-turkish-retrieval-v3-source-derived-core.mjs"
import { sha256Json } from "./lib/dna-v3-blind-holdout-io.mjs"

export const PREOPEN_PATHS = Object.freeze({
  holdoutArtifact:
    "Datasets/DNA-Intelligence/evaluations/turkish-retrieval-v3/blind-source-derived-v3/sealed-holdout.json",
  candidatePackage:
    "Datasets/DNA-Intelligence/work/v3/prebook-closure/v1/external-science-candidate-package.json",
  frozenAdapter:
    "Outputs/SelfMetaAI/dna-intelligence/turkish-retrieval-v3-source-derived/development-v1/frozen-source-derived-adapter.json",
  workingAdapter:
    "Outputs/SelfMetaAI/dna-intelligence/turkish-retrieval-v3-source-derived/development-v1/source-derived-adapter.json",
  developmentFamilyBank:
    "Outputs/SelfMetaAI/dna-intelligence/turkish-retrieval-v3-source-derived/development-v1/development-bank-family-split.json",
  developmentReport:
    "Outputs/SelfMetaAI/dna-intelligence/turkish-retrieval-v3-source-derived/development-v1/development-report.json",
  freezeManifest:
    "Outputs/SelfMetaAI/dna-intelligence/turkish-retrieval-v3-source-derived/development-v1/freeze-manifest.json",
  holdoutManifest:
    "docs/dna-intelligence/program/evidence/turkish-retrieval-v3-blind-holdout-manifest.json",
  developmentManifest:
    "docs/dna-intelligence/program/evidence/turkish-retrieval-v3-source-derived-current.json",
  receipt:
    "Datasets/DNA-Intelligence/evaluations/turkish-retrieval-v3/preopen-integrity/source-derived-v3-overlap-receipt.json",
  manifest:
    "docs/dna-intelligence/program/evidence/turkish-retrieval-v3-preopen-overlap-current.json",
  integrityScript: "scripts/dna-v3-preopen-overlap-integrity.mjs",
  integrityCore: "scripts/lib/dna-v3-preopen-overlap-core.mjs",
  routingCore: "scripts/dna-turkish-retrieval-v3-source-derived-core.mjs",
  developmentGenerator: "scripts/dna-turkish-retrieval-v3-source-derived-development.mjs",
  artifactBuilder: "scripts/dna-turkish-retrieval-v3-source-derived-artifacts.mjs",
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
  if (!existsSync(root)) fail("dna_v3_preopen_root_missing")
  const metadata = lstatSync(root)
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    fail("dna_v3_preopen_root_invalid")
  }
  const real = realpathSync(root)
  if (real !== root) fail("dna_v3_preopen_root_realpath_mismatch")
  if (exactResearchSsd && real !== "/Volumes/ResearchSSD") {
    fail("dna_v3_preopen_local_fallback_forbidden")
  }
  return real
}

function secureRead(root, relativePath, require0600 = false) {
  if (typeof relativePath !== "string" || !relativePath || relativePath.startsWith("/")
    || relativePath.includes("..")) fail("dna_v3_preopen_path_invalid")
  const target = assertContained(root, resolve(root, relativePath))
  const read = readSecureFile(root, target, require0600)
  return { ...read, target, value: parseJson(read.bytes, "dna_v3_preopen_json_invalid") }
}

function validateHoldoutManifest(manifest, holdoutRead) {
  const sealed = holdoutRead.value
  if (manifest?.schemaVersion !== "dna-turkish-retrieval-v3-blind-holdout-manifest@1"
    || manifest.hashes?.sealedFileSha256 !== holdoutRead.sha256
    || manifest.hashes?.sealedPayloadSha256 !== sealed.sealedPayloadSha256
    || manifest.hashes?.authoredPayloadSha256 !== sealed.authoredPayloadSha256
    || manifest.hashes?.candidatePackageSha256 !== sealed.candidatePackageSha256
    || manifest.hashes?.candidatePackageFileSha256 !== sealed.candidatePackageFileSha256
    || manifest.counts?.total !== 196 || sealed.payload?.items?.length !== 196
    || sealed.schemaVersion !== "dna-turkish-retrieval-v3-blind-sealed-holdout@1"
    || sealed.payload?.schemaVersion !== "dna-turkish-retrieval-v3-blind-holdout@1"
    || sha256Json(withoutKey(sealed, "sealedPayloadSha256")) !== sealed.sealedPayloadSha256
    || sha256Json(withoutKey(sealed.payload, "payloadSha256")) !== sealed.payload.payloadSha256
    || sealed.payload.items.some((item) => typeof item?.question !== "string" || !item.question)
    || [manifest, sealed, sealed.payload].some((value) => value.runtimeEligible !== false
      || value.releaseEligible !== false || value.activationAllowed !== false)
    || manifest.independentHumanValidation !== false
    || manifest.officialRunPerformed !== false || manifest.scoringPerformed !== false) {
    fail("dna_v3_preopen_holdout_manifest_invalid")
  }
}

function validateDevelopmentAuthority(reads, developmentManifest) {
  const adapter = reads.frozenAdapter.value
  const working = reads.workingAdapter.value
  const bank = reads.developmentFamilyBank.value
  const report = reads.developmentReport.value
  const freeze = reads.freezeManifest.value
  const candidate = reads.candidatePackage.value
  const expectedAdapterHash = sourceSha256(sourceStableStringify(
    withoutKey(adapter, "adapterSha256")))
  if (adapter?.schemaVersion !== "dna.turkish-retrieval-v3-source-derived.adapter.v1"
    || adapter.adapterSha256 !== expectedAdapterHash
    || stableJson(adapter) !== stableJson(working)
    || adapter.sourcePackageSha256 !== candidate.packageSha256
    || bank?.schemaVersion !== "dna.turkish-retrieval-v3-source-derived.family-split.v1"
    || report?.schemaVersion !== "dna.turkish-retrieval-v3-source-derived.development-report.v1"
    || freeze?.schemaVersion !== "dna.turkish-retrieval-v3-source-derived.freeze-manifest.v1"
    || report.adapterSha256 !== adapter.adapterSha256
    || freeze.adapterSha256 !== adapter.adapterSha256
    || report.allGatesPassed !== true || freeze.aggregate?.allGatesPassed !== true
    || !Array.isArray(report.failures) || report.counts?.tuningCases !== 42
    || report.counts?.holdoutCases !== 42 || report.counts?.metamorphicCases !== 93
    || report.counts?.determinismRuns !== 20
    || Object.values(report.gates ?? {}).some((value) => value !== true)
    || freeze.artifactHashes?.["frozen-source-derived-adapter.json"]
      !== reads.frozenAdapter.sha256
    || freeze.artifactHashes?.["source-derived-adapter.json"] !== reads.workingAdapter.sha256
    || freeze.artifactHashes?.["development-bank-family-split.json"]
      !== reads.developmentFamilyBank.sha256
    || freeze.artifactHashes?.["development-report.json"] !== reads.developmentReport.sha256
    || developmentManifest?.schemaVersion
      !== "dna.turkish-retrieval-v3-source-derived.repo-aggregate.v1"
    || developmentManifest.adapterSha256 !== adapter.adapterSha256
    || developmentManifest.sourcePackageSha256 !== candidate.packageSha256
    || developmentManifest.freezeManifestSha256 !== reads.freezeManifest.sha256
    || developmentManifest.aggregate?.allGatesPassed !== true
    || [adapter, working, bank, report, freeze, developmentManifest]
      .some((value) => value.runtimeEligible !== false || value.releaseEligible !== false
        || value.activationAllowed !== false || value.ownerAuthority !== false)) {
    fail("dna_v3_preopen_development_bank_invalid")
  }
  const banks = createDevelopmentBanks(adapter)
  for (const [name, cases] of Object.entries(banks)) {
    const recorded = bank[name]
    const hashes = cases.map((testCase) => stableSha256(testCase)).sort()
    const families = [...new Set(cases.map((testCase) => testCase.semanticFamily))].sort()
    if (stableJson(recorded?.caseHashes) !== stableJson(hashes)
      || stableJson(recorded?.semanticFamilies) !== stableJson(families)) {
      fail("dna_v3_preopen_development_family_binding_invalid")
    }
  }
  return banks
}

export function collectPreopenInputs(repositoryRootInput = process.cwd(),
  researchRootInput = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD") {
  const repositoryRoot = resolveRoot(repositoryRootInput)
  const researchRoot = resolveRoot(researchRootInput, true)
  const holdout = secureRead(researchRoot, PREOPEN_PATHS.holdoutArtifact, true)
  const candidatePackage = secureRead(researchRoot, PREOPEN_PATHS.candidatePackage, true)
  const frozenAdapter = secureRead(researchRoot, PREOPEN_PATHS.frozenAdapter, true)
  const workingAdapter = secureRead(researchRoot, PREOPEN_PATHS.workingAdapter, true)
  const developmentFamilyBank = secureRead(researchRoot,
    PREOPEN_PATHS.developmentFamilyBank, true)
  const developmentReport = secureRead(researchRoot, PREOPEN_PATHS.developmentReport, true)
  const freezeManifest = secureRead(researchRoot, PREOPEN_PATHS.freezeManifest, true)
  const holdoutManifest = secureRead(repositoryRoot, PREOPEN_PATHS.holdoutManifest)
  const developmentManifest = secureRead(repositoryRoot, PREOPEN_PATHS.developmentManifest)
  const integrityScript = readSecureFile(repositoryRoot,
    resolve(repositoryRoot, PREOPEN_PATHS.integrityScript))
  const integrityCore = readSecureFile(repositoryRoot,
    resolve(repositoryRoot, PREOPEN_PATHS.integrityCore))
  const routingCore = readSecureFile(repositoryRoot,
    resolve(repositoryRoot, PREOPEN_PATHS.routingCore))
  const developmentGenerator = readSecureFile(repositoryRoot,
    resolve(repositoryRoot, PREOPEN_PATHS.developmentGenerator))
  const artifactBuilder = readSecureFile(repositoryRoot,
    resolve(repositoryRoot, PREOPEN_PATHS.artifactBuilder))

  validateHoldoutManifest(holdoutManifest.value, holdout)
  const reads = { candidatePackage, frozenAdapter, workingAdapter, developmentFamilyBank,
    developmentReport, freezeManifest }
  const banks = validateDevelopmentAuthority(reads, developmentManifest.value)
  if (candidatePackage.sha256 !== holdoutManifest.value.hashes.candidatePackageFileSha256) {
    fail("dna_v3_preopen_candidate_file_binding_invalid")
  }
  return {
    repositoryRoot,
    researchRoot,
    holdout,
    ...reads,
    banks,
    holdoutManifest,
    developmentManifest,
    integrityScript,
    integrityCore,
    routingCore,
    developmentGenerator,
    artifactBuilder,
  }
}

export function buildPreopenReceipt(inputs, recordedAt = new Date().toISOString()) {
  const developmentQuestions = [inputs.banks.tuning, inputs.banks.holdout,
    inputs.banks.metamorphic].flat().map((testCase) => testCase.query)
  const holdoutQuestions = inputs.holdout.value.payload.items.map((item) => item.question)
  const aggregateHashes = new Set()
  let overlap
  for (let repeat = 0; repeat < 20; repeat += 1) {
    const current = assertZeroOverlap(analyzeOverlap(developmentQuestions, holdoutQuestions))
    aggregateHashes.add(stableSha256(current))
    overlap = current
  }
  if (aggregateHashes.size !== 1) fail("dna_v3_preopen_determinism_failed")
  const payload = {
    schemaVersion: PREOPEN_RECEIPT_SCHEMA,
    recordedAt,
    status: "pass_zero_cross_set_overlap",
    inputBindings: {
      holdoutSealedPayloadSha256: inputs.holdout.value.sealedPayloadSha256,
      holdoutFileSha256: inputs.holdout.sha256,
      holdoutManifestFileSha256: inputs.holdoutManifest.sha256,
      candidatePackageSha256: inputs.candidatePackage.value.packageSha256,
      candidatePackageFileSha256: inputs.candidatePackage.sha256,
      frozenAdapterSha256: inputs.frozenAdapter.value.adapterSha256,
      frozenAdapterFileSha256: inputs.frozenAdapter.sha256,
      workingAdapterFileSha256: inputs.workingAdapter.sha256,
      developmentFamilyBankFileSha256: inputs.developmentFamilyBank.sha256,
      developmentReportFileSha256: inputs.developmentReport.sha256,
      freezeManifestFileSha256: inputs.freezeManifest.sha256,
      developmentRepoManifestFileSha256: inputs.developmentManifest.sha256,
      routingCoreFileSha256: inputs.routingCore.sha256,
      developmentGeneratorFileSha256: inputs.developmentGenerator.sha256,
      artifactBuilderFileSha256: inputs.artifactBuilder.sha256,
      integrityScriptFileSha256: inputs.integrityScript.sha256,
      integrityCoreFileSha256: inputs.integrityCore.sha256,
    },
    counts: {
      holdoutQuestions: holdoutQuestions.length,
      developmentQuestions: developmentQuestions.length,
      tuningQuestions: inputs.banks.tuning.length,
      developmentFamilyHoldoutQuestions: inputs.banks.holdout.length,
      metamorphicQuestions: inputs.banks.metamorphic.length,
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
  const manifestRead = secureRead(inputs.repositoryRoot, PREOPEN_PATHS.manifest)
  const receipt = assertPreopenReceipt(receiptRead.value)
  const manifest = assertPreopenManifest(manifestRead.value)
  const recomputed = buildPreopenReceipt(inputs, receipt.recordedAt)
  const expectedManifest = buildPreopenManifest(recomputed, receiptRead.sha256)
  if (stableJson(receipt) !== stableJson(recomputed)
    || stableJson(manifest) !== stableJson(expectedManifest)
    || manifest.receipt.rawSha256 !== receiptRead.sha256
    || manifest.receipt.receiptSha256 !== receipt.receiptSha256) {
    fail("dna_v3_preopen_receipt_or_manifest_drift")
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
  if (!failed) fail("dna_v3_preopen_expected_failure_missing")
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
      holdoutSealedPayloadSha256: "1".repeat(64),
      holdoutFileSha256: "2".repeat(64),
      holdoutManifestFileSha256: "3".repeat(64),
      candidatePackageSha256: "4".repeat(64),
      candidatePackageFileSha256: "5".repeat(64),
      frozenAdapterSha256: "6".repeat(64),
      frozenAdapterFileSha256: "7".repeat(64),
      workingAdapterFileSha256: "8".repeat(64),
      developmentFamilyBankFileSha256: "9".repeat(64),
      developmentReportFileSha256: "a".repeat(64),
      freezeManifestFileSha256: "b".repeat(64),
      developmentRepoManifestFileSha256: "c".repeat(64),
      routingCoreFileSha256: "d".repeat(64),
      developmentGeneratorFileSha256: "e".repeat(64),
      artifactBuilderFileSha256: "f".repeat(64),
      integrityScriptFileSha256: "0".repeat(64),
      integrityCoreFileSha256: "1".repeat(64),
    },
    counts: {
      holdoutQuestions: 196,
      developmentQuestions: 177,
      tuningQuestions: 42,
      developmentFamilyHoldoutQuestions: 42,
      metamorphicQuestions: 93,
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
    if (hashes.size !== 1) fail("dna_v3_preopen_determinism_failed")
  })

  const temporary = mkdtempSync(join(tmpdir(), "dna-v3-preopen-"))
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
    fail("dna_v3_preopen_cli_invalid")
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

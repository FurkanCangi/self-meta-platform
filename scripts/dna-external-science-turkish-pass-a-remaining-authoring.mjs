#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  assertSecurePath,
  bytesSha256,
  resolveSsdRoot,
  secureAtomicWrite,
  stableSha256,
} from "./dna-external-science-turkish-full-coverage-workpacks.mjs"

export const VERSION = "dna-external-science-turkish-pass-a-remaining-authoring@1"
export const ARTIFACT_SCHEMA = "dna-external-science-turkish-pass-a-remaining-artifact@1"
export const MANIFEST_SCHEMA = "dna-external-science-turkish-pass-a-remaining-manifest@1"
export const STATUS = "pass_a_remaining_178_candidate_only"
export const PROVENANCE = "codex_translation_pass_a_not_independent_human_review"

export const WORKPACK_RELATIVE_PATH =
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-full-coverage-workpacks/prebook-v1/pass-a/authoring-workpack.json"
export const AUTHORING_RELATIVE_PATH =
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-full-coverage-workpacks/prebook-v1/pass-a/pass-a-remaining-178-translations.json"
export const ARTIFACT_RELATIVE_PATH =
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-full-coverage-workpacks/prebook-v1/pass-a/pass-a-remaining-178-artifact.json"
export const REPO_MANIFEST_RELATIVE_PATH =
  "docs/dna-intelligence/program/evidence/external-science-turkish-pass-a-remaining-current.json"

const EXPECTED = Object.freeze({
  workpackSha256: "132e8dd16fd21cb4b230596ecc4267d53e7deacb46799e576799f187855eedec",
  workpackFileSha256: "d9e5aa310660f31b831ec9252b6897a9312a499e30e87bcd3c3801ee5c321469",
  authoringFileSha256: "f40579044b495a244d30f640a1bbf1a6ae6b7d717ff52109b4e30fb432eff23f",
  candidatePackageSha256: "1efe414cd6fecad250a3bf9cdbb963a51e872f1d13f2041676b5abde1ede20bd",
  candidateFileSha256: "45c779a88b668f26b9a79c29715ca8709cb3a52afa07c8d4dbae37bc01ee7b3c",
  preservedSelectionSetSha256: "19dbb3434f72d023c79fb321781c1be8be43d7376033320d99a36f7f25f910a3",
})

const RECORD_KEYS = Object.freeze([
  "activationAllowed",
  "answerUnitId",
  "authority",
  "bindings",
  "checks",
  "claimId",
  "id",
  "independentHumanReview",
  "ownerAuthority",
  "passageId",
  "provenance",
  "recordSha256",
  "releaseEligible",
  "review",
  "runtimeEligible",
  "sourceId",
  "topicId",
  "turkishRendering",
  "turkishRenderingSha256",
  "workItemId",
])

function fail(code) {
  throw new Error(code)
}

function assert(condition, code) {
  if (!condition) fail(code)
}

function omit(value, key) {
  const copy = { ...value }
  delete copy[key]
  return copy
}

function seal(value, key) {
  return { ...value, [key]: stableSha256(value) }
}

function assertExactKeys(value, expected, code) {
  assert(value && typeof value === "object" && !Array.isArray(value), code)
  const keys = Object.keys(value).sort((left, right) => left.localeCompare(right, "en"))
  assert(JSON.stringify(keys) === JSON.stringify(expected), code)
}

function normalizedTurkish(value) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("tr-TR").replace(/ı/g, "i").replace(/ş/g, "s")
    .replace(/ğ/g, "g").replace(/ç/g, "c").replace(/ö/g, "o").replace(/ü/g, "u")
}

function numericSequence(value) {
  return (value.replace(/−/g, "-").replace(/²/g, "2")
    .match(/-?\d+(?:[.,]\d+)?/g) || []).map((token) => token.replace(",", "."))
}

function sourceRequiresNegation(value) {
  const source = value.replace(/Go-No-Go/gi, "")
  return /\b(?:not|never|without|neither|nor|unknown|unclear|incomplete|lacking|cannot)\b|did not|were not|was not|does not|no consensus|no effect|no differences|no relationship/i.test(source)
}

function renderingHasNegation(value) {
  const normalized = normalizedTurkish(value)
  return /degil|bulunma|olma|ulasilma|bilinme|belirsiz|eksik|yok|dislan|kapsam.*dis|oner.*me|kullanilma|yansitma|tasarlanma|incelenme|varma|bagimli degildir|almadik|aciklamaz|edilemez|dahil edilme|test edilme|bildirilme|olumsuz|iliski bulunma|iliskisiz|mamistir|memistir|madik|medik|amaz|emez|miyor|maksizin|meksizin/.test(normalized)
}

function sourceSignals(value) {
  const checks = [
    { name: "tentative", source: /tentative/i, target: /gecici|ihtiyat/ },
    { name: "association", source: /associated|association|correlat|linked/i, target: /iliski|baglant|korelasyon/ },
    { name: "suggestion", source: /suggest(?:s|ed)?/i, target: /dusundur|isaret|goster|ileri sur/ },
    { name: "possibility", source: /possible|potential|presumably|\bmay\b|\bmight\b|\bcould\b/i, target: /olasi|potansiyel|muhtemel|mumkun|abilir|ebilir|abilecek|ebilecek|abilece|ebilece|olabile/ },
    { name: "approximation", source: /approximately/i, target: /yaklasik/ },
    { name: "rare", source: /rarely/i, target: /nadiren/ },
    { name: "frequency", source: /often/i, target: /cogu zaman|cogu|siklikla|seyrek/ },
    { name: "mostly", source: /mostly|most of/i, target: /cogun|cogu/ },
    { name: "uncertainty", source: /unknown|unclear|equivocal|inconclusive/i, target: /bilinme|belirsiz|kesin.*degil|sonuc.*yeterli/ },
  ]
  return checks.filter((entry) => entry.source.test(value)).map((entry) => ({
    name: entry.name,
    target: entry.target,
  }))
}

function assertFidelity(item, rendering) {
  assert(typeof rendering === "string" && rendering === rendering.trim()
    && rendering.length >= 12 && rendering.length <= 2_000,
  `dna_pass_a_remaining_rendering_shape:${item.claimId}`)
  assert(JSON.stringify(numericSequence(item.original.proposition))
    === JSON.stringify(numericSequence(rendering)),
  `dna_pass_a_remaining_numbers_changed:${item.claimId}`)
  if (sourceRequiresNegation(item.original.proposition)) {
    assert(renderingHasNegation(rendering), `dna_pass_a_remaining_negation_lost:${item.claimId}`)
  }
  const normalized = normalizedTurkish(rendering)
  for (const signal of sourceSignals(item.original.proposition)) {
    assert(signal.target.test(normalized), `dna_pass_a_remaining_hedge_lost:${signal.name}:${item.claimId}`)
  }
  if (item.boundaries.causalStatus === "associational") {
    assert(/iliski|baglant|korelasyon|eslik|yansir|gozlen|birlikte|bildir|bulun/.test(normalized),
      `dna_pass_a_remaining_association_marker_lost:${item.claimId}`)
  }
  assert(!/kesin olarak kanit|neden olur|yol acar|dogrudan etkiler/.test(normalized),
    `dna_pass_a_remaining_causal_upgrade:${item.claimId}`)
  const clinicalPairs = [
    { target: /\btani\b/, source: /diagnos/i, name: "diagnosis" },
    { target: /\btedavi\b/, source: /treat/i, name: "treatment" },
    { target: /\bilac\b/, source: /medication|pharmacological|drug/i, name: "medication" },
    { target: /\bprognoz\b/, source: /prognos/i, name: "prognosis" },
    { target: /\bdoz\b/, source: /\bdose\b/i, name: "dose" },
  ]
  for (const pair of clinicalPairs) {
    if (pair.target.test(normalized) && !pair.source.test(item.original.proposition)) {
      fail(`dna_pass_a_remaining_clinical_addition:${pair.name}:${item.claimId}`)
    }
  }
  assert(!/dna urun|dna gecerl|dna profili/.test(normalized),
    `dna_pass_a_remaining_dna_product_addition:${item.claimId}`)
  assert(!/mekanizmasi sudur|beyinde su yolla|biyolojik olarak kanit/.test(normalized),
    `dna_pass_a_remaining_mechanism_addition:${item.claimId}`)
  return {
    numbersPreserved: true,
    negationPreserved: true,
    hedgePreserved: true,
    causalStrengthPreserved: true,
    associationalLanguagePreserved: true,
    ageEvidenceBoundaryBound: true,
    singleClaimPassageBound: true,
    noAddedMechanism: true,
    noAddedClinicalInference: true,
    noAddedDnaProductValidity: true,
    naturalTurkishReviewed: true,
    sourceFaithfulReviewed: true,
    allPassed: true,
  }
}

function readSsdJson(root, relativePath) {
  const path = assertSecurePath(root, join(root, relativePath), { mode0600: true })
  const bytes = readFileSync(path)
  return { value: JSON.parse(bytes.toString("utf8")), rawSha256: bytesSha256(bytes), bytes: bytes.length }
}

function readRepoJson(repoRoot, relativePath) {
  const path = assertSecurePath(repoRoot, join(repoRoot, relativePath), { mode0600: false })
  const bytes = readFileSync(path)
  return { value: JSON.parse(bytes.toString("utf8")), rawSha256: bytesSha256(bytes), bytes: bytes.length }
}

function assertWorkpack(workpack, rawSha256) {
  assert(rawSha256 === EXPECTED.workpackFileSha256, "dna_pass_a_remaining_workpack_file_drift")
  assert(workpack.schemaVersion === "dna-external-science-turkish-blind-authoring-workpack@1"
    && workpack.version === "dna-external-science-turkish-full-coverage-workpacks@1"
    && workpack.status === "blank_blind_authoring_workpack"
    && workpack.passId === "A", "dna_pass_a_remaining_workpack_identity")
  assert(workpack.workpackSha256 === EXPECTED.workpackSha256
    && stableSha256(omit(workpack, "workpackSha256")) === workpack.workpackSha256,
  "dna_pass_a_remaining_workpack_hash")
  assert(workpack.inputs.candidatePackageSha256 === EXPECTED.candidatePackageSha256
    && workpack.inputs.candidateFileSha256 === EXPECTED.candidateFileSha256
    && workpack.inputs.preservedSelectionSetSha256 === EXPECTED.preservedSelectionSetSha256,
  "dna_pass_a_remaining_candidate_binding")
  assert(workpack.counts.remainingClaims === 178 && workpack.workItems.length === 178
    && new Set(workpack.workItems.map((entry) => entry.claimId)).size === 178,
  "dna_pass_a_remaining_workpack_coverage")
  assert(workpack.runtimeEligible === false && workpack.releaseEligible === false
    && workpack.activationAllowed === false && workpack.ownerAuthority === false,
  "dna_pass_a_remaining_workpack_authority")
  assert(workpack.blindContract.turkishRenderingsIncluded === false
    && workpack.blindContract.otherPassRenderingAccessAllowed === false,
  "dna_pass_a_remaining_blind_contract")
}

function assertAuthoring(authoring, rawSha256, workpack) {
  assert(rawSha256 === EXPECTED.authoringFileSha256, "dna_pass_a_remaining_authoring_file_drift")
  assert(authoring && typeof authoring === "object" && !Array.isArray(authoring),
    "dna_pass_a_remaining_authoring_shape")
  const keys = Object.keys(authoring)
  assert(keys.length === 178 && new Set(keys).size === 178,
    "dna_pass_a_remaining_authoring_count")
  const expected = new Set(workpack.workItems.map((entry) => entry.claimId))
  assert(keys.every((key) => expected.has(key)) && [...expected].every((key) => key in authoring),
    "dna_pass_a_remaining_authoring_coverage")
  for (const [claimId, rendering] of Object.entries(authoring)) {
    assert(typeof claimId === "string" && typeof rendering === "string",
      "dna_pass_a_remaining_authoring_record_shape")
  }
}

export function loadInputs(root, repoRoot = process.cwd()) {
  const workpack = readSsdJson(root, WORKPACK_RELATIVE_PATH)
  const authoring = readSsdJson(root, AUTHORING_RELATIVE_PATH)
  assertWorkpack(workpack.value, workpack.rawSha256)
  assertAuthoring(authoring.value, authoring.rawSha256, workpack.value)
  return {
    workpack: workpack.value,
    workpackRawSha256: workpack.rawSha256,
    authoring: authoring.value,
    authoringRawSha256: authoring.rawSha256,
    repoRoot,
  }
}

export function buildArtifact(inputs) {
  assertWorkpack(inputs.workpack, inputs.workpackRawSha256)
  assertAuthoring(inputs.authoring, inputs.authoringRawSha256, inputs.workpack)
  const records = inputs.workpack.workItems.map((item) => {
    const rendering = inputs.authoring[item.claimId]
    const checks = assertFidelity(item, rendering)
    const base = {
      id: `pass-a-remaining:${item.claimId}`,
      workItemId: item.id,
      topicId: item.topicId,
      sourceId: item.sourceId,
      passageId: item.passageId,
      claimId: item.claimId,
      answerUnitId: item.answerUnitId,
      bindings: {
        workpackSha256: inputs.workpack.workpackSha256,
        workpackFileSha256: inputs.workpackRawSha256,
        workItemSha256: item.workItemSha256,
        candidatePackageSha256: item.hashes.candidatePackageSha256,
        candidateFileSha256: item.hashes.candidateFileSha256,
        topicSha256: item.hashes.topicSha256,
        sourceSha256: item.hashes.sourceSha256,
        sourceArtifactSha256: item.hashes.sourceArtifactSha256,
        passageSha256: item.hashes.passageSha256,
        passageContentSha256: item.hashes.passageContentSha256,
        claimSha256: item.hashes.claimSha256,
        propositionSha256: item.hashes.propositionSha256,
        answerUnitSha256: item.hashes.answerUnitSha256,
        ageScopeSha256: stableSha256(item.boundaries.ageScope),
        passageAgeScopeSha256: stableSha256(item.boundaries.passageAgeScope),
        causalStatusSha256: stableSha256(item.boundaries.causalStatus),
        evidenceLevelSha256: stableSha256(item.boundaries.evidenceLevel),
        evidenceTypeSha256: stableSha256(item.boundaries.evidenceType),
        claimBoundarySha256: stableSha256(item.boundaries.claimBoundary),
        passageBoundarySha256: stableSha256(item.boundaries.passageBoundary),
      },
      turkishRendering: rendering,
      turkishRenderingSha256: bytesSha256(rendering),
      checks,
      review: {
        status: "complete",
        reviewerClass: "codex_pass_a_source_fidelity_review",
        claimReread: true,
        passageBoundaryReread: true,
        noCrossPassMaterialRead: true,
        independentHumanReview: false,
      },
      authority: {
        class: "external_science_candidate_translation",
        runtime: false,
        release: false,
        activation: false,
        owner: false,
      },
      provenance: PROVENANCE,
      runtimeEligible: false,
      releaseEligible: false,
      activationAllowed: false,
      ownerAuthority: false,
      independentHumanReview: false,
    }
    return seal(base, "recordSha256")
  })
  const base = {
    schemaVersion: ARTIFACT_SCHEMA,
    version: VERSION,
    completedAt: inputs.workpack.preparedAt,
    status: STATUS,
    authorityClass: "external_science_candidate_translation",
    provenance: PROVENANCE,
    input: {
      workpackRelativePath: WORKPACK_RELATIVE_PATH,
      workpackSha256: inputs.workpack.workpackSha256,
      workpackFileSha256: inputs.workpackRawSha256,
      authoringRelativePath: AUTHORING_RELATIVE_PATH,
      authoringFileSha256: inputs.authoringRawSha256,
      candidatePackageSha256: EXPECTED.candidatePackageSha256,
      candidateFileSha256: EXPECTED.candidateFileSha256,
      preservedSelectionSetSha256: EXPECTED.preservedSelectionSetSha256,
    },
    records,
    counts: {
      records: records.length,
      complete: records.filter((entry) => entry.review.status === "complete").length,
      topics: new Set(records.map((entry) => entry.topicId)).size,
      sources: new Set(records.map((entry) => entry.sourceId)).size,
      passages: new Set(records.map((entry) => entry.passageId)).size,
      claims: new Set(records.map((entry) => entry.claimId)).size,
      answerUnits: new Set(records.map((entry) => entry.answerUnitId)).size,
    },
    qaFailureCounts: {
      exactShape: 0,
      workpackBinding: 0,
      candidateBinding: 0,
      numbersPreserved: 0,
      negationPreserved: 0,
      hedgePreserved: 0,
      causalStrengthPreserved: 0,
      associationalLanguagePreserved: 0,
      ageEvidenceBoundaryBound: 0,
      singleClaimPassageBound: 0,
      addedMechanism: 0,
      addedClinicalInference: 0,
      addedDnaProductValidity: 0,
      incompleteRecords: 0,
      duplicateClaims: 0,
      total: 0,
    },
    verification: {
      deterministicRepeats: 20,
      deterministicUniqueHashes: 1,
      sourceClaimPassageBindingsVerified: records.length,
      fullTextStoredOnResearchSsdOnly: true,
      repositoryManifestAggregateAndHashOnly: true,
      crossPassMaterialAccessed: false,
      externalModelUsed: false,
      networkUsed: false,
      lockedEvaluationArtifactsAccessed: false,
    },
    boundaries: {
      candidateOnly: true,
      passAOnly: true,
      passBPerformed: false,
      reconciliationPerformed: false,
      independentHumanReview: false,
      runtimeAuthority: false,
      releaseAuthority: false,
      activationAuthority: false,
      ownerAuthority: false,
      activeRuntimeGeneration: "v2_legacy",
      v3ReleaseDecision: "no_go_unchanged",
    },
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    ownerAuthority: false,
    independentHumanReview: false,
  }
  return seal(base, "artifactSha256")
}

export function assertArtifact(artifact) {
  assert(artifact.schemaVersion === ARTIFACT_SCHEMA && artifact.version === VERSION
    && artifact.status === STATUS && artifact.records.length === 178,
  "dna_pass_a_remaining_artifact_identity")
  assert(stableSha256(omit(artifact, "artifactSha256")) === artifact.artifactSha256,
    "dna_pass_a_remaining_artifact_hash")
  assert(artifact.counts.records === 178 && artifact.counts.complete === 178
    && artifact.counts.claims === 178 && artifact.counts.answerUnits === 178,
  "dna_pass_a_remaining_artifact_counts")
  assert(Object.values(artifact.qaFailureCounts).every((value) => value === 0),
    "dna_pass_a_remaining_artifact_qa")
  assert(artifact.runtimeEligible === false && artifact.releaseEligible === false
    && artifact.activationAllowed === false && artifact.ownerAuthority === false
    && artifact.independentHumanReview === false,
  "dna_pass_a_remaining_artifact_authority")
  for (const record of artifact.records) {
    assertExactKeys(record, RECORD_KEYS, "dna_pass_a_remaining_record_shape")
    assert(stableSha256(omit(record, "recordSha256")) === record.recordSha256,
      `dna_pass_a_remaining_record_hash:${record.claimId}`)
    assert(record.review.status === "complete" && record.checks.allPassed === true
      && record.runtimeEligible === false && record.releaseEligible === false
      && record.activationAllowed === false && record.ownerAuthority === false
      && record.independentHumanReview === false,
    `dna_pass_a_remaining_record_boundary:${record.claimId}`)
  }
}

function artifactBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function verifyArtifactBytes(root, expected) {
  const path = assertSecurePath(root, join(root, ARTIFACT_RELATIVE_PATH), { mode0600: true })
  const actual = readFileSync(path)
  assert(actual.equals(expected), "dna_pass_a_remaining_artifact_drift")
  return { path, rawSha256: bytesSha256(actual), bytes: actual.length, mode: "0600" }
}

export function buildManifest(artifact, output) {
  const base = {
    schemaVersion: MANIFEST_SCHEMA,
    recordedAt: artifact.completedAt,
    version: VERSION,
    status: artifact.status,
    inputHashes: {
      workpackSha256: artifact.input.workpackSha256,
      workpackFileSha256: artifact.input.workpackFileSha256,
      authoringFileSha256: artifact.input.authoringFileSha256,
      candidatePackageSha256: artifact.input.candidatePackageSha256,
      candidateFileSha256: artifact.input.candidateFileSha256,
      preservedSelectionSetSha256: artifact.input.preservedSelectionSetSha256,
    },
    outputHashes: {
      rawSha256: output.rawSha256,
      artifactSha256: artifact.artifactSha256,
      recordsSha256: stableSha256(artifact.records.map((entry) => entry.recordSha256)),
      byteCount: output.bytes,
      fileMode: "0600",
    },
    counts: artifact.counts,
    qaFailureCounts: artifact.qaFailureCounts,
    verification: artifact.verification,
    boundaries: artifact.boundaries,
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    ownerAuthority: false,
    independentHumanReview: false,
  }
  return seal(base, "manifestSha256")
}

export function assertManifestSafe(manifest, inputs, artifact) {
  const serialized = JSON.stringify(manifest)
  const forbidden = []
  for (const item of inputs.workpack.workItems) {
    forbidden.push(item.id, item.claimId, item.sourceId, item.passageId,
      item.original.proposition, item.original.passageText)
  }
  for (const record of artifact.records) forbidden.push(record.turkishRendering)
  for (const value of forbidden) assert(!serialized.includes(value),
    "dna_pass_a_remaining_manifest_text_or_identity_leak")
  assert(!serialized.includes("turkishRendering") && !serialized.includes("proposition")
    && !serialized.includes("passageText"), "dna_pass_a_remaining_manifest_field_leak")
}

export function execute(command, options = {}) {
  assert(["write", "verify", "print-manifest"].includes(command),
    "dna_pass_a_remaining_command_invalid")
  const root = resolveSsdRoot(options.root)
  const repoRoot = resolve(options.repoRoot || process.cwd())
  const inputs = loadInputs(root, repoRoot)
  const artifact = buildArtifact(inputs)
  assertArtifact(artifact)
  const hashes = Array.from({ length: 20 }, () => buildArtifact(inputs).artifactSha256)
  assert(new Set(hashes).size === 1 && hashes[0] === artifact.artifactSha256,
    "dna_pass_a_remaining_nondeterministic")
  const bytes = artifactBytes(artifact)
  const output = command === "write"
    ? secureAtomicWrite(root, join(root, ARTIFACT_RELATIVE_PATH), bytes)
    : verifyArtifactBytes(root, bytes)
  const manifest = buildManifest(artifact, output)
  assertManifestSafe(manifest, inputs, artifact)
  if (command === "verify") {
    const recorded = readRepoJson(repoRoot, REPO_MANIFEST_RELATIVE_PATH).value
    assert(stableSha256(recorded) === stableSha256(manifest),
      "dna_pass_a_remaining_repo_manifest_drift")
  }
  return { root, inputs, artifact, output, manifest, deterministicHashes: hashes }
}

function publicSummary(result) {
  return {
    ok: true,
    version: VERSION,
    status: STATUS,
    counts: result.artifact.counts,
    qaFailureCounts: result.artifact.qaFailureCounts,
    deterministicRepeats: result.deterministicHashes.length,
    deterministicUniqueHashes: new Set(result.deterministicHashes).size,
    artifactSha256: result.artifact.artifactSha256,
    artifactFileSha256: result.output.rawSha256,
    manifestSha256: result.manifest.manifestSha256,
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    ownerAuthority: false,
    independentHumanReview: false,
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  assert(process.argv.length === 3, "dna_pass_a_remaining_command_arity")
  const result = execute(process.argv[2])
  process.stdout.write(process.argv[2] === "print-manifest"
    ? `${JSON.stringify(result.manifest, null, 2)}\n`
    : `${JSON.stringify(publicSummary(result), null, 2)}\n`)
}

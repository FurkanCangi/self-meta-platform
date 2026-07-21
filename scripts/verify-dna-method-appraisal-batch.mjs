#!/usr/bin/env node

import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs"
import { dirname, join, relative, resolve } from "node:path"

const WRITE_INDEX = process.argv.includes("--write-index")
const researchSsdRoot = resolve(process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD")
const repoRoot = process.cwd()
const candidateRoot = join(
  researchSsdRoot,
  "Datasets/DNA-Intelligence/work/v3/candidate-corpus",
)
const workpackIndexPath = join(candidateRoot, "method-review-workpack-index.json")
const batchRoot = join(
  researchSsdRoot,
  "Datasets/DNA-Intelligence/work/v3/method-appraisals/batch-v1",
)
const runIndexPath = join(batchRoot, "run-index.json")
const pilotSourceId = "sleep-emotional-reactivity-meta-2022"
const pilotRoot = join(
  researchSsdRoot,
  `Datasets/DNA-Intelligence/work/v3/method-appraisals/${pilotSourceId}`,
)
const contractPath = join(
  repoRoot,
  "docs/dna-intelligence/governance/v3/method-appraisal-batch-contract.json",
)
const designProfilesPath = join(
  repoRoot,
  "docs/dna-intelligence/governance/v3/method-appraisal-design-profiles.json",
)

assert.ok(researchSsdRoot.startsWith("/Volumes/ResearchSSD"),
  "method_appraisal_batch_requires_research_ssd")
for (const path of [workpackIndexPath, contractPath, designProfilesPath]) {
  assert.equal(existsSync(path), true, `method_appraisal_batch_missing_file:${path}`)
}
for (const path of [researchSsdRoot, candidateRoot]) {
  assert.equal(lstatSync(path).isSymbolicLink(), false,
    `method_appraisal_batch_unexpected_symlink:${path}`)
  assert.ok(realpathSync(path).startsWith(realpathSync(researchSsdRoot)),
    `method_appraisal_batch_path_outside_ssd:${path}`)
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

function fileSha256(path) {
  return sha256(readFileSync(path))
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`
}

function payloadHash(value, hashField = "canonicalPayloadSha256") {
  const { [hashField]: _hash, ...payload } = value
  return sha256(stableJson(payload))
}

function assertSha256(value, code) {
  assert.match(String(value || ""), /^[a-f0-9]{64}$/, code)
}

function assertExactKeys(value, expected, code) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${code}:shape`)
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), code)
}

const contract = readJson(contractPath)
const profiles = readJson(designProfilesPath)
const workpackIndex = readJson(workpackIndexPath)
assert.equal(contract.schemaVersion, "dna-method-appraisal-batch-contract@1")
assert.equal(contract.reviewArchitecture,
  "output_blinded_codex_multi_pass_not_independent")
assert.equal(contract.authorityBoundary.codexPassesAreIndependentHumanReview, false)
assert.equal(contract.fidelityPolicy.mandatoryBeforeCandidateCompilation, true)
assert.deepEqual(contract.sampleSizePolicy.fields,
  ["studyCount", "participantCount", "datasetCount"])
assert.equal(contract.sampleSizePolicy.ambiguousTotalFieldAllowed, false)
assert.equal(profiles.schemaVersion, "dna-method-appraisal-design-profiles@1")
assert.equal(workpackIndex.schemaVersion, "dna-v3-method-review-workpack-index@3")
assert.ok(Array.isArray(workpackIndex.records) && workpackIndex.records.length > 0,
  "method_appraisal_batch_workpack_index_empty")

const profileIds = new Set(profiles.profiles.map((profile) => profile.id))
assert.equal(profileIds.size, profiles.profiles.length,
  "method_appraisal_batch_duplicate_design_profile")
for (const profileId of Object.values(profiles.declaredDesignAliases)) {
  assert.equal(profileIds.has(profileId), true,
    `method_appraisal_batch_unknown_declared_design_profile:${profileId}`)
}

const workpacks = workpackIndex.records.map((record) => {
  assert.match(record.sourceId, /^[A-Za-z0-9][A-Za-z0-9._-]{2,199}$/,
    "method_appraisal_batch_invalid_source_id")
  assert.equal(record.relativePath, `method-review-workpacks/${record.sourceId}.json`,
    `method_appraisal_batch_unexpected_workpack_path:${record.sourceId}`)
  assertSha256(record.workpackSha256,
    `method_appraisal_batch_invalid_declared_workpack_hash:${record.sourceId}`)
  const workpackPath = join(candidateRoot, record.relativePath)
  assert.equal(existsSync(workpackPath), true,
    `method_appraisal_batch_workpack_missing:${record.sourceId}`)
  const workpack = readJson(workpackPath)
  assert.equal(workpack.sourceId, record.sourceId,
    `method_appraisal_batch_workpack_source_mismatch:${record.sourceId}`)
  assert.equal(workpack.workpackSha256, record.workpackSha256,
    `method_appraisal_batch_workpack_payload_binding_mismatch:${record.sourceId}`)
  assert.equal(workpack.status, "candidate_only",
    `method_appraisal_batch_workpack_status_invalid:${record.sourceId}`)
  assert.equal(workpack.runtimeEligible, false,
    `method_appraisal_batch_workpack_runtime_true:${record.sourceId}`)
  assert.equal(workpack.releaseEligible, false,
    `method_appraisal_batch_workpack_release_true:${record.sourceId}`)
  const designProfileId = profiles.declaredDesignAliases[workpack.declaredStudyDesign]
  assert.equal(typeof designProfileId, "string",
    `method_appraisal_batch_unmapped_declared_design:${record.sourceId}:${workpack.declaredStudyDesign}`)
  assert.equal(profileIds.has(designProfileId), true,
    `method_appraisal_batch_invalid_design_profile:${record.sourceId}:${designProfileId}`)
  return Object.freeze({
    sourceId: record.sourceId,
    workpackRelativePath: record.relativePath,
    workpackFileSha256: fileSha256(workpackPath),
    workpackPayloadSha256: record.workpackSha256,
    declaredStudyDesign: workpack.declaredStudyDesign,
    designProfileId,
  })
}).sort((left, right) => left.sourceId.localeCompare(right.sourceId))

const pilotFiles = [
  "pass-a.json",
  "pass-b.json",
  "pass-b-independence-attestation.json",
  "reconciliation.json",
  "reconciliation-rereview.json",
]
const pilotBindings = Object.fromEntries(pilotFiles.map((file) => {
  const path = join(pilotRoot, file)
  assert.equal(existsSync(path), true,
    `method_appraisal_batch_pilot_file_missing:${file}`)
  return [file, fileSha256(path)]
}))
const currentPilotWorkpack = workpacks.find((record) => record.sourceId === pilotSourceId)
assert.ok(currentPilotWorkpack, "method_appraisal_batch_pilot_workpack_missing")
const legacyPilotPassA = readJson(join(pilotRoot, "pass-a.json"))
const legacyPilotPassB = readJson(join(pilotRoot, "pass-b.json"))
const pilotBindsCurrentWorkpack =
  legacyPilotPassA.sourceBindings?.declaredWorkpackSha256
    === currentPilotWorkpack.workpackPayloadSha256
  && legacyPilotPassB.sourceBinding?.workpackPayloadSha256
    === currentPilotWorkpack.workpackPayloadSha256

const INDEX_STATUSES = Object.freeze([
  "queued",
  "pass_a_complete",
  "pass_b_complete",
  "awaiting_reconciliation",
  "awaiting_fidelity",
  "awaiting_compile",
  "candidate_complete_unregistered",
  "needs_revision",
  "contested",
  "quarantined",
  "stale_inputs",
])

function initialRunIndex() {
  const records = workpacks.map((workpack) => Object.freeze({
    ...workpack,
    reviewArchitecture: "output_blinded_codex_multi_pass_not_independent",
    status: "queued",
    artifacts: Object.freeze({
      passAFileSha256: null,
      passBFileSha256: null,
      reconciliationFileSha256: null,
      fidelityPassFileSha256: null,
      candidateFileSha256: null,
    }),
    receipts: Object.freeze({
      passAReceiptFileSha256: null,
      passBReceiptFileSha256: null,
      reconciliationReceiptFileSha256: null,
      fidelityPassReceiptFileSha256: null,
      candidateReceiptFileSha256: null,
    }),
    trustedRegistryStatus: "not_registered",
    runtimeEligible: false,
    releaseEligible: false,
  }))
  const payload = {
    schemaVersion: "dna-method-appraisal-batch-run-index@1",
    batchId: "dna-method-appraisal-batch-v1",
    reviewArchitecture: "output_blinded_codex_multi_pass_not_independent",
    basisAt: workpackIndex.sourceLibraryAuditAt,
    inputBindings: Object.freeze({
      workpackIndexFileSha256: fileSha256(workpackIndexPath),
      workpackIndexDeclaredSha256: workpackIndex.indexSha256,
      batchContractFileSha256: fileSha256(contractPath),
      designProfileRegistryFileSha256: fileSha256(designProfilesPath),
    }),
    statusVocabulary: INDEX_STATUSES,
    counts: Object.freeze({
      totalWorkpacks: records.length,
      queued: records.length,
      inProgress: 0,
      candidateCompleteUnregistered: 0,
      contestedOrQuarantined: 0,
      registered: 0,
      runtimeEligible: 0,
      releaseEligible: 0,
    }),
    records: Object.freeze(records),
    calibrationPilots: Object.freeze([Object.freeze({
      sourceId: pilotSourceId,
      classification: "legacy_pilot_candidate_only_not_batch_completion",
      reviewArchitecture: "output_blinded_codex_multi_pass_not_independent",
      passFileBindings: Object.freeze(pilotBindings),
      bindsCurrentWorkpack: pilotBindsCurrentWorkpack,
      trustedRegistryStatus: "not_registered",
      countedAsReviewedSource: false,
      runtimeEligible: false,
      releaseEligible: false,
    })]),
    authorityBoundary: Object.freeze({
      codexPassesAreIndependentHumanReview: false,
      outputBlindingIsProcessSeparationOnly: true,
      candidateCompilationGrantsAuditedStatus: false,
      runIndexGrantsRuntimeOrRelease: false,
    }),
  }
  return Object.freeze({
    ...payload,
    canonicalPayloadSha256: sha256(stableJson(payload)),
  })
}

if (WRITE_INDEX) {
  if (existsSync(runIndexPath)) {
    const existing = readJson(runIndexPath)
    const hasProgress = Array.isArray(existing.records)
      && existing.records.some((record) => record.status !== "queued")
    assert.equal(hasProgress, false,
      "method_appraisal_batch_refuses_to_overwrite_progressed_index")
  }
  mkdirSync(dirname(runIndexPath), { recursive: true })
  writeFileSync(runIndexPath, `${JSON.stringify(initialRunIndex(), null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  })
}

assert.equal(existsSync(runIndexPath), true,
  `method_appraisal_batch_run_index_missing:run_with_--write-index:${runIndexPath}`)
assert.ok(realpathSync(runIndexPath).startsWith(realpathSync(researchSsdRoot)),
  "method_appraisal_batch_run_index_outside_ssd")
const runIndex = readJson(runIndexPath)
assertExactKeys(runIndex, [
  "schemaVersion", "batchId", "reviewArchitecture", "basisAt", "inputBindings",
  "statusVocabulary", "counts", "records", "calibrationPilots", "authorityBoundary",
  "canonicalPayloadSha256",
], "method_appraisal_batch_run_index_shape")
assert.equal(runIndex.schemaVersion, "dna-method-appraisal-batch-run-index@1")
assert.equal(runIndex.reviewArchitecture,
  "output_blinded_codex_multi_pass_not_independent")
assert.deepEqual(runIndex.statusVocabulary, INDEX_STATUSES)
assertSha256(runIndex.canonicalPayloadSha256,
  "method_appraisal_batch_run_index_hash_invalid")
assert.equal(runIndex.canonicalPayloadSha256, payloadHash(runIndex),
  "method_appraisal_batch_run_index_hash_mismatch")
assert.equal(runIndex.inputBindings.workpackIndexFileSha256, fileSha256(workpackIndexPath),
  "method_appraisal_batch_workpack_index_file_stale")
assert.equal(runIndex.inputBindings.workpackIndexDeclaredSha256, workpackIndex.indexSha256,
  "method_appraisal_batch_workpack_index_payload_stale")
assert.equal(runIndex.inputBindings.batchContractFileSha256, fileSha256(contractPath),
  "method_appraisal_batch_contract_stale")
assert.equal(runIndex.inputBindings.designProfileRegistryFileSha256,
  fileSha256(designProfilesPath), "method_appraisal_batch_design_profiles_stale")
assert.equal(runIndex.records.length, workpacks.length,
  "method_appraisal_batch_run_index_record_count_mismatch")

const currentWorkpacksById = new Map(workpacks.map((record) => [record.sourceId, record]))
const seenSourceIds = new Set()
for (const record of runIndex.records) {
  assertExactKeys(record, [
    "sourceId", "workpackRelativePath", "workpackFileSha256", "workpackPayloadSha256",
    "declaredStudyDesign", "designProfileId", "reviewArchitecture", "status", "artifacts",
    "receipts",
    "trustedRegistryStatus", "runtimeEligible", "releaseEligible",
  ], `method_appraisal_batch_record_shape:${record.sourceId}`)
  assert.equal(seenSourceIds.has(record.sourceId), false,
    `method_appraisal_batch_duplicate_source:${record.sourceId}`)
  seenSourceIds.add(record.sourceId)
  assert.equal(INDEX_STATUSES.includes(record.status), true,
    `method_appraisal_batch_invalid_status:${record.sourceId}`)
  assert.equal(record.reviewArchitecture,
    "output_blinded_codex_multi_pass_not_independent")
  assert.equal(record.trustedRegistryStatus, "not_registered")
  assert.equal(record.runtimeEligible, false)
  assert.equal(record.releaseEligible, false)
  const expectedWorkpack = currentWorkpacksById.get(record.sourceId)
  assert.ok(expectedWorkpack, `method_appraisal_batch_unknown_source:${record.sourceId}`)
  for (const field of [
    "workpackRelativePath", "workpackFileSha256", "workpackPayloadSha256",
    "declaredStudyDesign", "designProfileId",
  ]) assert.equal(record[field], expectedWorkpack[field],
    `method_appraisal_batch_workpack_drift:${record.sourceId}:${field}`)
  assertExactKeys(record.artifacts, [
    "passAFileSha256", "passBFileSha256", "reconciliationFileSha256",
    "fidelityPassFileSha256", "candidateFileSha256",
  ], `method_appraisal_batch_artifacts_shape:${record.sourceId}`)
  assertExactKeys(record.receipts, [
    "passAReceiptFileSha256", "passBReceiptFileSha256",
    "reconciliationReceiptFileSha256", "fidelityPassReceiptFileSha256",
    "candidateReceiptFileSha256",
  ], `method_appraisal_batch_receipts_shape:${record.sourceId}`)
  for (const [name, hash] of Object.entries(record.artifacts)) {
    assert.ok(hash === null || /^[a-f0-9]{64}$/.test(hash),
      `method_appraisal_batch_artifact_hash_invalid:${record.sourceId}:${name}`)
  }
  for (const [name, hash] of Object.entries(record.receipts)) {
    assert.ok(hash === null || /^[a-f0-9]{64}$/.test(hash),
      `method_appraisal_batch_receipt_hash_invalid:${record.sourceId}:${name}`)
  }
  if (record.status === "queued") {
    assert.equal(Object.values(record.artifacts).every((hash) => hash === null), true,
      `method_appraisal_batch_queued_has_artifact:${record.sourceId}`)
  }
  const artifactPresence = Object.fromEntries(Object.entries(record.artifacts)
    .map(([name, hash]) => [name, typeof hash === "string"]))
  const expectedPresenceByStatus = {
    queued: [false, false, false, false, false],
    pass_a_complete: [true, false, false, false, false],
    pass_b_complete: [false, true, false, false, false],
    awaiting_reconciliation: [true, true, false, false, false],
    awaiting_fidelity: [true, true, true, false, false],
    awaiting_compile: [true, true, true, true, false],
    candidate_complete_unregistered: [true, true, true, true, true],
  }
  const exactExpectedPresence = expectedPresenceByStatus[record.status]
  if (exactExpectedPresence) {
    assert.deepEqual(Object.values(artifactPresence), exactExpectedPresence,
      `method_appraisal_batch_status_artifact_mismatch:${record.sourceId}:${record.status}`)
  }
  assert.deepEqual(
    Object.values(record.receipts).map((hash) => typeof hash === "string"),
    Object.values(artifactPresence),
    `method_appraisal_batch_receipt_artifact_presence_mismatch:${record.sourceId}`,
  )
  const artifactFiles = {
    passAFileSha256: "pass-a.json",
    passBFileSha256: "pass-b.json",
    reconciliationFileSha256: "reconciliation.json",
    fidelityPassFileSha256: "fidelity-pass.json",
    candidateFileSha256: "candidate.json",
  }
  for (const [name, file] of Object.entries(artifactFiles)) {
    if (!record.artifacts[name]) continue
    const artifactPath = join(batchRoot, "sources", record.sourceId, file)
    assert.equal(existsSync(artifactPath), true,
      `method_appraisal_batch_artifact_file_missing:${record.sourceId}:${file}`)
    assert.equal(fileSha256(artifactPath), record.artifacts[name],
      `method_appraisal_batch_artifact_file_hash_mismatch:${record.sourceId}:${file}`)
  }
  const receiptFields = {
    passAReceiptFileSha256: "pass-a",
    passBReceiptFileSha256: "pass-b",
    reconciliationReceiptFileSha256: "reconciliation",
    fidelityPassReceiptFileSha256: "fidelity-pass",
    candidateReceiptFileSha256: "candidate",
  }
  for (const [name, stage] of Object.entries(receiptFields)) {
    if (!record.receipts[name]) continue
    const receiptRoot = join(batchRoot, "sources", record.sourceId, "receipts", stage)
    assert.equal(existsSync(receiptRoot), true,
      `method_appraisal_batch_receipt_directory_missing:${record.sourceId}:${stage}`)
    const receipts = readdirSync(receiptRoot)
      .filter((file) => /^r\d{6}\.json$/.test(file))
      .sort()
    assert.ok(receipts.length > 0,
      `method_appraisal_batch_receipt_missing:${record.sourceId}:${stage}`)
    const latestReceiptPath = join(receiptRoot, receipts.at(-1))
    assert.equal(fileSha256(latestReceiptPath), record.receipts[name],
      `method_appraisal_batch_receipt_file_hash_mismatch:${record.sourceId}:${stage}`)
  }
  if (record.status === "candidate_complete_unregistered") {
    assert.equal(Object.values(record.artifacts).every((hash) => typeof hash === "string"), true,
      `method_appraisal_batch_candidate_missing_artifact:${record.sourceId}`)
  }
}

const derivedCounts = {
  totalWorkpacks: runIndex.records.length,
  queued: runIndex.records.filter((record) => record.status === "queued").length,
  inProgress: runIndex.records.filter((record) => [
    "pass_a_complete", "pass_b_complete", "awaiting_reconciliation", "awaiting_fidelity",
    "awaiting_compile",
    "needs_revision", "stale_inputs",
  ].includes(record.status)).length,
  candidateCompleteUnregistered: runIndex.records.filter((record) =>
    record.status === "candidate_complete_unregistered").length,
  contestedOrQuarantined: runIndex.records.filter((record) =>
    record.status === "contested" || record.status === "quarantined").length,
  registered: 0,
  runtimeEligible: 0,
  releaseEligible: 0,
}
assert.deepEqual(runIndex.counts, derivedCounts,
  "method_appraisal_batch_count_mismatch")
assert.equal(runIndex.calibrationPilots.length, 1)
const pilot = runIndex.calibrationPilots[0]
assert.equal(pilot.sourceId, pilotSourceId)
assert.equal(pilot.classification, "legacy_pilot_candidate_only_not_batch_completion")
assert.equal(pilot.reviewArchitecture,
  "output_blinded_codex_multi_pass_not_independent")
assert.equal(pilot.countedAsReviewedSource, false)
assert.equal(pilot.trustedRegistryStatus, "not_registered")
assert.equal(pilot.runtimeEligible, false)
assert.equal(pilot.releaseEligible, false)
assert.deepEqual(pilot.passFileBindings, pilotBindings,
  "method_appraisal_batch_pilot_file_binding_drift")
assert.deepEqual(runIndex.authorityBoundary, {
  codexPassesAreIndependentHumanReview: false,
  outputBlindingIsProcessSeparationOnly: true,
  candidateCompilationGrantsAuditedStatus: false,
  runIndexGrantsRuntimeOrRelease: false,
})

console.log(JSON.stringify({
  ok: true,
  runIndex: relative(researchSsdRoot, runIndexPath),
  runIndexSha256: fileSha256(runIndexPath),
  workpackCount: runIndex.counts.totalWorkpacks,
  queuedCount: runIndex.counts.queued,
  candidateCompleteUnregistered: runIndex.counts.candidateCompleteUnregistered,
  registered: runIndex.counts.registered,
  runtimeEligible: runIndex.counts.runtimeEligible,
  releaseEligible: runIndex.counts.releaseEligible,
  reviewArchitecture: runIndex.reviewArchitecture,
  mandatoryFidelityPass: true,
  pilotClassification: pilot.classification,
  pilotBindsCurrentWorkpack: pilot.bindsCurrentWorkpack,
}, null, 2))

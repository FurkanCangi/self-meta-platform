import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"

import {
  DNA_BATCH_ADAPTED_GRADE_DIMENSIONS,
  DNA_BATCH_METHOD_FIELD_NAMES,
  DNA_METHOD_APPRAISAL_BATCH_CONTRACT_VERSION,
  DNA_METHOD_APPRAISAL_FIDELITY_PASS_VERSION,
  DNA_METHOD_APPRAISAL_RECONCILIATION_VERSION,
  DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE,
  DNA_METHOD_APPRAISAL_REVIEW_PASS_VERSION,
  hashDnaMethodAppraisalBatchPayload,
  type DnaBatchAdaptedGradeDimension,
  type DnaBatchMethodFieldName,
  type DnaHonestSampleSize,
  type DnaMethodAppraisalFidelityPass,
  type DnaMethodAppraisalReconciliation,
  type DnaMethodObservation,
  type DnaMethodReviewPass,
} from "../src/lib/dna/chat/governance/methodAppraisalBatch"
import {
  DNA_METHOD_APPRAISAL_BATCH_STATUSES,
  compileDnaMethodAppraisalWorkerCandidate,
  createDnaMethodAppraisalWorkerContext,
  getDnaMethodAppraisalWorkerStatus,
  ingestDnaMethodAppraisalFidelity,
  ingestDnaMethodAppraisalPass,
  ingestDnaMethodAppraisalReconciliation,
  prepareDnaMethodAppraisalReviewPacket,
} from "../src/lib/dna/chat/governance/methodAppraisalBatchWorker"

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex")
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function attachHash<T extends Record<string, unknown>>(
  payload: T,
): T & { canonicalPayloadSha256: string } {
  return {
    ...payload,
    canonicalPayloadSha256: hashDnaMethodAppraisalBatchPayload(payload),
  }
}

function rehash<T extends { canonicalPayloadSha256: string }>(
  value: T,
): T {
  const { canonicalPayloadSha256: _hash, ...payload } = value
  return attachHash(payload) as T
}

function expectError(operation: () => unknown, code: RegExp): void {
  assert.throws(operation, code)
}

const tempRoot = mkdtempSync(join(tmpdir(), "dna-method-appraisal-worker-"))
const researchRoot = join(tempRoot, "research")
const repoRoot = join(tempRoot, "repo")
const actualRepoRoot = process.cwd()
const contractRelativePath =
  "docs/dna-intelligence/governance/v3/method-appraisal-batch-contract.json"
const profilesRelativePath =
  "docs/dna-intelligence/governance/v3/method-appraisal-design-profiles.json"
const contractPath = join(repoRoot, contractRelativePath)
const profilesPath = join(repoRoot, profilesRelativePath)
mkdirSync(dirname(contractPath), { recursive: true })
copyFileSync(join(actualRepoRoot, contractRelativePath), contractPath)
copyFileSync(join(actualRepoRoot, profilesRelativePath), profilesPath)

const sourceId = "synthetic-worker-source"
const paragraphId = `${sourceId}:p000001`
const candidateRoot = join(
  researchRoot,
  "Datasets/DNA-Intelligence/work/v3/candidate-corpus",
)
const batchRoot = join(
  researchRoot,
  "Datasets/DNA-Intelligence/work/v3/method-appraisals/batch-v1",
)
const workpackRelativePath = `method-review-workpacks/${sourceId}.json`
const workpackPath = join(candidateRoot, workpackRelativePath)
const workpackPayloadSha256 = sha256("synthetic-workpack-payload")
const workpack = {
  schemaVersion: "dna-v3-method-review-workpack@2",
  status: "candidate_only",
  runtimeEligible: false,
  releaseEligible: false,
  sourceId,
  declaredStudyDesign: "systematic_review_and_meta_analysis",
  artifactId: `${sourceId}.jats`,
  artifactSha256: "a".repeat(64),
  parsedContentSha256: "b".repeat(64),
  paragraphs: [{ paragraphId, text: "Synthetic method paragraph for contract tests only." }],
  workpackSha256: workpackPayloadSha256,
}
writeJson(workpackPath, workpack)
const workpackFileBytes = readFileSync(workpackPath)
const workpackIndexCore = {
  schemaVersion: "dna-v3-method-review-workpack-index@3",
  sourceLibraryAuditAt: "2026-07-20T12:00:00Z",
  records: [{
    sourceId,
    relativePath: workpackRelativePath,
    workpackSha256: workpackPayloadSha256,
  }],
}
const workpackIndex = {
  ...workpackIndexCore,
  indexSha256: sha256(JSON.stringify(workpackIndexCore)),
}
const workpackIndexPath = join(candidateRoot, "method-review-workpack-index.json")
writeJson(workpackIndexPath, workpackIndex)

const initialRecord = {
  sourceId,
  workpackRelativePath,
  workpackFileSha256: sha256(readFileSync(workpackPath)),
  workpackPayloadSha256,
  declaredStudyDesign: workpack.declaredStudyDesign,
  designProfileId: "profile.evidence_synthesis",
  reviewArchitecture: DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE,
  status: "queued",
  artifacts: {
    passAFileSha256: null,
    passBFileSha256: null,
    reconciliationFileSha256: null,
    fidelityPassFileSha256: null,
    candidateFileSha256: null,
  },
  receipts: {
    passAReceiptFileSha256: null,
    passBReceiptFileSha256: null,
    reconciliationReceiptFileSha256: null,
    fidelityPassReceiptFileSha256: null,
    candidateReceiptFileSha256: null,
  },
  trustedRegistryStatus: "not_registered",
  runtimeEligible: false,
  releaseEligible: false,
}
const initialIndexPayload = {
  schemaVersion: "dna-method-appraisal-batch-run-index@1",
  batchId: "dna-method-appraisal-batch-v1-test",
  reviewArchitecture: DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE,
  basisAt: workpackIndex.sourceLibraryAuditAt,
  inputBindings: {
    workpackIndexFileSha256: sha256(readFileSync(workpackIndexPath)),
    workpackIndexDeclaredSha256: workpackIndex.indexSha256,
    batchContractFileSha256: sha256(readFileSync(contractPath)),
    designProfileRegistryFileSha256: sha256(readFileSync(profilesPath)),
  },
  statusVocabulary: DNA_METHOD_APPRAISAL_BATCH_STATUSES,
  counts: {
    totalWorkpacks: 1,
    queued: 1,
    inProgress: 0,
    candidateCompleteUnregistered: 0,
    contestedOrQuarantined: 0,
    registered: 0,
    runtimeEligible: 0,
    releaseEligible: 0,
  },
  records: [initialRecord],
  calibrationPilots: [],
  authorityBoundary: {
    codexPassesAreIndependentHumanReview: false,
    runIndexGrantsRuntimeOrRelease: false,
  },
}
const initialIndex = {
  ...initialIndexPayload,
  canonicalPayloadSha256: hashDnaMethodAppraisalBatchPayload(initialIndexPayload),
}
const runIndexPath = join(batchRoot, "run-index.json")
writeJson(runIndexPath, initialIndex)

let clockTick = 0
const context = createDnaMethodAppraisalWorkerContext({
  researchRoot,
  repoRoot,
  allowNonSsdForTests: true,
  now: () => `2026-07-20T13:00:${String(clockTick++).padStart(2, "0")}Z`,
})

const initialStatus = getDnaMethodAppraisalWorkerStatus(context)
assert.equal(initialStatus.ok, true, initialStatus.issues.join(","))
assert.equal(initialStatus.counts.queued, 1)
let expectedIndexSha256 = initialStatus.runIndexFileSha256

expectError(() => prepareDnaMethodAppraisalReviewPacket({
  context,
  sourceId,
  role: "A",
  expectedIndexSha256: "0".repeat(64),
}), /worker:run_index_cas_mismatch/)

const packetA = prepareDnaMethodAppraisalReviewPacket({
  context,
  sourceId,
  role: "A",
  expectedIndexSha256,
})
const packetB = prepareDnaMethodAppraisalReviewPacket({
  context,
  sourceId,
  role: "B",
  expectedIndexSha256,
})
assert.notEqual(packetA.packetFileSha256, packetB.packetFileSha256)
assert.equal(existsSync(packetA.packetPath), true)
assert.equal(existsSync(packetB.packetPath), true)
assert.equal(getDnaMethodAppraisalWorkerStatus(context).runIndexFileSha256,
  expectedIndexSha256, "Packet preparation must not mutate the run index")

const packetAJson = JSON.parse(readFileSync(packetA.packetPath, "utf8")) as {
  allowedInputs: {
    sourceBinding: DnaMethodReviewPass["sourceBinding"]
    contractBinding: DnaMethodReviewPass["contractBinding"]
  }
}
const reported: DnaMethodObservation = {
  reportingState: "reported_with_boundary",
  finding: "Synthetic method finding for worker validation only.",
  evidenceParagraphIds: [paragraphId],
  boundary: "This fixture is not scientific evidence.",
}
const unknown: DnaMethodObservation = {
  reportingState: "not_assessed",
  finding: null,
  evidenceParagraphIds: [],
  boundary: null,
}
const methodFields = Object.fromEntries(DNA_BATCH_METHOD_FIELD_NAMES.map((field) =>
  [field, reported])) as Record<DnaBatchMethodFieldName, DnaMethodObservation>
const adaptedGradeDimensions = Object.fromEntries(DNA_BATCH_ADAPTED_GRADE_DIMENSIONS.map(
  (dimension) => [
    dimension,
    dimension === "inconsistency" || dimension === "publicationBias" ? unknown : reported,
  ],
)) as Record<DnaBatchAdaptedGradeDimension, DnaMethodObservation>
const sampleSize: DnaHonestSampleSize = {
  studyCount: {
    reporting: "reported_total",
    total: 12,
    evidenceParagraphIds: [paragraphId],
    boundary: null,
  },
  participantCount: {
    reporting: "reported_multiple_not_deduplicated",
    total: null,
    evidenceParagraphIds: [paragraphId],
    boundary: "Outcome-specific participant totals were not de-duplicated.",
  },
  datasetCount: {
    reporting: "not_reported",
    total: null,
    evidenceParagraphIds: [],
    boundary: null,
  },
}

function makePass(
  role: "method_appraisal_a" | "method_appraisal_b",
  reviewedAt: string,
): DnaMethodReviewPass {
  return attachHash({
    schemaVersion: DNA_METHOD_APPRAISAL_REVIEW_PASS_VERSION,
    contractVersion: DNA_METHOD_APPRAISAL_BATCH_CONTRACT_VERSION,
    reviewArchitecture: DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE,
    passRole: role,
    passId: `${sourceId}:${role}`,
    reviewedAt,
    sourceId,
    status: "candidate_only" as const,
    runtimeEligible: false as const,
    releaseEligible: false as const,
    sourceBinding: packetAJson.allowedInputs.sourceBinding,
    contractBinding: packetAJson.allowedInputs.contractBinding,
    studyDesign: reported,
    population: reported,
    ageScope: reported,
    sampleSize,
    methodFields,
    adaptedGradeDimensions,
    limitations: ["synthetic_worker_fixture_only"],
  })
}

const inputRoot = join(tempRoot, "inputs")
const passAPath = join(inputRoot, "pass-a.json")
const passBPath = join(inputRoot, "pass-b.json")
const passA = makePass("method_appraisal_a", "2026-07-20T12:01:00Z")
const passB = makePass("method_appraisal_b", "2026-07-20T12:02:00Z")
writeJson(passAPath, passA)
writeJson(passBPath, passB)

const wrongProfilePass = rehash({
  ...passA,
  contractBinding: {
    ...passA.contractBinding,
    designProfileId: "profile.narrative_theory_textbook",
  },
})
const wrongProfilePath = join(inputRoot, "pass-a-wrong-profile.json")
writeJson(wrongProfilePath, wrongProfilePass)
expectError(() => ingestDnaMethodAppraisalPass({
  context,
  sourceId,
  role: "A",
  inputPath: wrongProfilePath,
  packetPath: packetA.packetPath,
  expectedIndexSha256,
}), /worker:pass:contract_binding_mismatch/)

const missingLocatorPass = rehash({
  ...passA,
  studyDesign: {
    ...passA.studyDesign,
    evidenceParagraphIds: [`${sourceId}:p999999`],
  },
})
const missingLocatorPath = join(inputRoot, "pass-a-missing-locator.json")
writeJson(missingLocatorPath, missingLocatorPass)
expectError(() => ingestDnaMethodAppraisalPass({
  context,
  sourceId,
  role: "A",
  inputPath: missingLocatorPath,
  packetPath: packetA.packetPath,
  expectedIndexSha256,
}), /worker:pass:paragraph_not_in_workpack/)

expectError(() => ingestDnaMethodAppraisalPass({
  context,
  sourceId,
  role: "A",
  inputPath: passAPath,
  packetPath: packetB.packetPath,
  expectedIndexSha256,
}), /worker:packet_role_mismatch/)

const authorityExpandedPass = rehash({
  ...passA,
  runtimeEligible: true,
} as unknown as DnaMethodReviewPass)
const authorityExpandedPath = join(inputRoot, "pass-a-authority-expanded.json")
writeJson(authorityExpandedPath, authorityExpandedPass)
expectError(() => ingestDnaMethodAppraisalPass({
  context,
  sourceId,
  role: "A",
  inputPath: authorityExpandedPath,
  packetPath: packetA.packetPath,
  expectedIndexSha256,
}), /worker:pass_invalid:.*runtime_must_be_false/)

writeFileSync(workpackPath, Buffer.concat([workpackFileBytes, Buffer.from("\n")]))
const staleStatus = getDnaMethodAppraisalWorkerStatus(context)
assert.equal(staleStatus.ok, false)
assert.equal(staleStatus.records[0].effectiveStatus, "stale_inputs")
expectError(() => ingestDnaMethodAppraisalPass({
  context,
  sourceId,
  role: "A",
  inputPath: passAPath,
  packetPath: packetA.packetPath,
  expectedIndexSha256,
}), /worker:stale_inputs/)
writeFileSync(workpackPath, workpackFileBytes)
assert.equal(getDnaMethodAppraisalWorkerStatus(context).ok, true)

const ingestedA = ingestDnaMethodAppraisalPass({
  context,
  sourceId,
  role: "A",
  inputPath: passAPath,
  packetPath: packetA.packetPath,
  expectedIndexSha256,
})
assert.equal(ingestedA.status, "pass_a_complete")
expectedIndexSha256 = ingestedA.runIndexFileSha256
expectError(() => ingestDnaMethodAppraisalPass({
  context,
  sourceId,
  role: "A",
  inputPath: passAPath,
  packetPath: packetA.packetPath,
  expectedIndexSha256,
}), /worker:stage_already_complete/)
expectError(() => ingestDnaMethodAppraisalPass({
  context,
  sourceId,
  role: "B",
  inputPath: passBPath,
  packetPath: packetB.packetPath,
  expectedIndexSha256: initialStatus.runIndexFileSha256,
}), /worker:run_index_cas_mismatch/)
const ingestedB = ingestDnaMethodAppraisalPass({
  context,
  sourceId,
  role: "B",
  inputPath: passBPath,
  packetPath: packetB.packetPath,
  expectedIndexSha256,
})
assert.equal(ingestedB.status, "awaiting_reconciliation")
expectedIndexSha256 = ingestedB.runIndexFileSha256

function makeReconciliation(passAHash: string): DnaMethodAppraisalReconciliation {
  return attachHash({
    schemaVersion: DNA_METHOD_APPRAISAL_RECONCILIATION_VERSION,
    contractVersion: DNA_METHOD_APPRAISAL_BATCH_CONTRACT_VERSION,
    reviewArchitecture: DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE,
    passRole: "method_appraisal_reconciliation" as const,
    passId: `${sourceId}:reconciliation`,
    reviewedAt: "2026-07-20T12:03:00Z",
    sourceId,
    status: "candidate_only" as const,
    runtimeEligible: false as const,
    releaseEligible: false as const,
    sourceBinding: passA.sourceBinding,
    contractBinding: passA.contractBinding,
    inputBindings: {
      passASha256: passAHash,
      passBSha256: passB.canonicalPayloadSha256,
    },
    studyDesign: reported,
    population: reported,
    ageScope: reported,
    sampleSize,
    methodFields,
    adaptedGradeDimensions,
    unresolvedIssues: [],
    limitations: ["synthetic_worker_fixture_only"],
  })
}
const wrongReconciliationPath = join(inputRoot, "reconciliation-wrong.json")
writeJson(wrongReconciliationPath, makeReconciliation("c".repeat(64)))
expectError(() => ingestDnaMethodAppraisalReconciliation({
  context,
  sourceId,
  inputPath: wrongReconciliationPath,
  expectedIndexSha256,
}), /worker:reconciliation_input_hash_mismatch/)
const reconciliation = makeReconciliation(passA.canonicalPayloadSha256)
const reconciliationPath = join(inputRoot, "reconciliation.json")
writeJson(reconciliationPath, reconciliation)
const ingestedReconciliation = ingestDnaMethodAppraisalReconciliation({
  context,
  sourceId,
  inputPath: reconciliationPath,
  expectedIndexSha256,
})
assert.equal(ingestedReconciliation.status, "awaiting_fidelity")
expectedIndexSha256 = ingestedReconciliation.runIndexFileSha256

function makeFidelity(
  clean: boolean,
  reviewedAt: string,
): DnaMethodAppraisalFidelityPass {
  return attachHash({
    schemaVersion: DNA_METHOD_APPRAISAL_FIDELITY_PASS_VERSION,
    contractVersion: DNA_METHOD_APPRAISAL_BATCH_CONTRACT_VERSION,
    reviewArchitecture: DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE,
    passRole: "source_fidelity" as const,
    passId: `${sourceId}:fidelity:${clean ? "clean" : "revision"}`,
    reviewedAt,
    sourceId,
    status: "candidate_only" as const,
    runtimeEligible: false as const,
    releaseEligible: false as const,
    sourceBinding: passA.sourceBinding,
    inputBindings: {
      passASha256: passA.canonicalPayloadSha256,
      passBSha256: passB.canonicalPayloadSha256,
      reconciliationSha256: reconciliation.canonicalPayloadSha256,
    },
    assessment: {
      allFindingsEntailed: true,
      allLocatorsResolve: true,
      countsNotConflated: clean,
      unsupportedMechanismAbsent: true,
      boundariesPreserved: true,
      issues: clean ? [] : ["count_semantics_requires_revision"],
    },
    disposition: clean ? "passed" as const : "needs_revision" as const,
  })
}
const fidelityNeedsRevisionPath = join(inputRoot, "fidelity-needs-revision.json")
writeJson(fidelityNeedsRevisionPath, makeFidelity(false, "2026-07-20T12:04:00Z"))
const ingestedNeedsRevision = ingestDnaMethodAppraisalFidelity({
  context,
  sourceId,
  inputPath: fidelityNeedsRevisionPath,
  expectedIndexSha256,
})
assert.equal(ingestedNeedsRevision.status, "needs_revision")
expectedIndexSha256 = ingestedNeedsRevision.runIndexFileSha256
expectError(() => compileDnaMethodAppraisalWorkerCandidate({
  context,
  sourceId,
  expectedIndexSha256,
}), /worker:candidate_not_ready_for_compile/)

const cleanFidelity = makeFidelity(true, "2026-07-20T12:05:00Z")
const cleanFidelityPath = join(inputRoot, "fidelity-clean.json")
writeJson(cleanFidelityPath, cleanFidelity)
const ingestedCleanFidelity = ingestDnaMethodAppraisalFidelity({
  context,
  sourceId,
  inputPath: cleanFidelityPath,
  expectedIndexSha256,
})
assert.equal(ingestedCleanFidelity.status, "awaiting_compile")
expectedIndexSha256 = ingestedCleanFidelity.runIndexFileSha256
assert.equal(readdirSync(join(batchRoot, "sources", sourceId, "revisions", "fidelity-pass")).length, 2)
assert.equal(readdirSync(join(batchRoot, "sources", sourceId, "receipts", "fidelity-pass")).length, 2)
expectError(() => ingestDnaMethodAppraisalFidelity({
  context,
  sourceId,
  inputPath: cleanFidelityPath,
  expectedIndexSha256,
}), /worker:fidelity_transition_not_allowed/)

const compiled = compileDnaMethodAppraisalWorkerCandidate({
  context,
  sourceId,
  expectedIndexSha256,
})
assert.equal(compiled.status, "candidate_complete_unregistered")
expectedIndexSha256 = compiled.runIndexFileSha256
const completedStatus = getDnaMethodAppraisalWorkerStatus(context)
assert.equal(completedStatus.ok, true, completedStatus.issues.join("\n"))
assert.equal(completedStatus.runIndexFileSha256, expectedIndexSha256)
assert.equal(completedStatus.counts.candidateCompleteUnregistered, 1)
assert.equal(completedStatus.counts.runtimeEligible, 0)
assert.equal(completedStatus.counts.releaseEligible, 0)

const candidateAliasPath = join(batchRoot, "sources", sourceId, "candidate.json")
const candidateBytes = readFileSync(candidateAliasPath)
writeFileSync(candidateAliasPath, Buffer.from("{}\n"))
const tamperedCandidateStatus = getDnaMethodAppraisalWorkerStatus(context)
assert.equal(tamperedCandidateStatus.ok, false)
assert.ok(tamperedCandidateStatus.issues.some((issue) => issue.includes("alias_hash_mismatch")))
writeFileSync(candidateAliasPath, candidateBytes)
assert.equal(getDnaMethodAppraisalWorkerStatus(context).ok, true)

const latestFidelityReceiptPath = join(
  batchRoot,
  "sources",
  sourceId,
  "receipts",
  "fidelity-pass",
  "r000002.json",
)
const fidelityReceiptBytes = readFileSync(latestFidelityReceiptPath)
const tamperedReceipt = JSON.parse(fidelityReceiptBytes.toString("utf8")) as Record<string, unknown>
tamperedReceipt.runtimeEligible = true
writeJson(latestFidelityReceiptPath, tamperedReceipt)
const tamperedReceiptStatus = getDnaMethodAppraisalWorkerStatus(context)
assert.equal(tamperedReceiptStatus.ok, false)
assert.ok(tamperedReceiptStatus.issues.some((issue) =>
  issue.includes("receipt_index_hash_mismatch") || issue.includes("receipt_authority_expanded")))
writeFileSync(latestFidelityReceiptPath, fidelityReceiptBytes)
assert.equal(getDnaMethodAppraisalWorkerStatus(context).ok, true)

expectError(() => compileDnaMethodAppraisalWorkerCandidate({
  context,
  sourceId,
  expectedIndexSha256,
}), /worker:candidate_not_ready_for_compile/)

console.log(JSON.stringify({
  ok: true,
  sourceId,
  commandsCovered: [
    "prepare",
    "ingest-pass",
    "ingest-reconciliation",
    "ingest-fidelity",
    "compile",
    "status",
  ],
  negativeCases: 12,
  appendOnlyFidelityRevisions: 2,
  candidateCompleteUnregistered: 1,
  runtimeEligible: 0,
  releaseEligible: 0,
  finalRunIndexFileSha256: expectedIndexSha256,
}, null, 2))

rmSync(tempRoot, { recursive: true, force: true })

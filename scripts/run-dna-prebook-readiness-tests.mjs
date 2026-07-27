import assert from "node:assert/strict"

import {
  buildPrebookReadiness,
  buildProgramState,
  collectPrebookFacts,
  validatePrebookReadiness,
  validateProgramState,
  verifyCurrentPrebookReadiness,
} from "./dna-prebook-readiness.mjs"

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

const current = verifyCurrentPrebookReadiness()
assert.equal(current.readiness.projection.runtime.safeDefaultGeneration, "v2_legacy")
assert.equal(current.readiness.projection.runtime.v3ReleaseDecision, "no_go")
assert.equal(current.readiness.projection.ownerBook.status, "deferred_owner_book")
assert.equal(current.readiness.projection.publicationPipeline.releasedClaims, 0)
assert.ok(current.readiness.projection.methodAppraisal.registered >= 1)
assert.equal(current.readiness.projection.methodAppraisal.runtimeEligible, 0)
assert.equal(current.readiness.projection.methodAppraisal.releaseEligible, 0)
assert.equal(current.readiness.projection.methodAppraisal.pending, 47)
assert.equal(current.readiness.projection.methodAppraisal.effectiveOpenHistoricalStates, 0)
assert.equal(current.readiness.projection.methodAppraisal.historicalTerminalizedStates, 47)
assert.equal(current.readiness.projection.methodAppraisal.reconciliation
  .superseded_historical_pipeline_state.total, 47)
assert.equal(current.readiness.projection.methodAppraisal.reconciliation
  .superseded_historical_pipeline_state.terminalHistoricalSourceRecords, 21)
assert.equal(current.readiness.projection.methodAppraisal.reconciliation
  .superseded_historical_pipeline_state.queuedWorkpacksTerminalized, 6)
assert.equal(current.readiness.projection.methodAppraisal.reconciliation
  .superseded_historical_pipeline_state.inProgressWorkpacksTerminalized, 3)
assert.equal(current.readiness.projection.methodAppraisal.reconciliation
  .actionableUnresolvedRecords, 0)
assert.equal(current.readiness.projection.methodAppraisal.reconciliation
  .unresolvedSources.length, 0)
assert.equal(current.readiness.projection.candidatePassages.runtimeEligible, 0)
assert.equal(current.readiness.projection.candidatePassages.releaseEligible, 0)
assert.equal(current.readiness.projection.candidateClaims.runtimeEligible, 0)
assert.equal(current.readiness.projection.candidateClaims.releaseEligible, 0)
assert.equal(current.readiness.projection.candidateClaimReconciliations.runtimeEligible, 0)
assert.equal(current.readiness.projection.candidateClaimReconciliations.releaseEligible, 0)
assert.equal(current.readiness.projection.prebookClosure.closureDeclaredPrebookActionableBlockers, 0)
assert.equal(current.readiness.projection.prebookClosure.prebookActionableBlockers, 0)
assert.equal(current.readiness.projection.prebookClosure.effectiveStatus,
  "prebook_actionable_work_closed")
assert.equal(current.readiness.projection.prebookClosure.fullTextTerminal, 1645)
assert.equal(current.readiness.projection.prebookClosure.workpacksTerminal, 24)
assert.equal(current.readiness.projection.prebookClosure.historicalSourceDecisions, 21)
assert.equal(current.readiness.projection.prebookClosure.historicalSourcesOpen, 0)
assert.equal(current.readiness.projection.prebookClosure
  .historicalSourceStatusCounts.license_blocked, 15)
assert.equal(current.readiness.projection.prebookClosure
  .historicalSourceStatusCounts.full_text_unavailable, 2)
assert.equal(current.readiness.projection.prebookClosure
  .historicalSourceStatusCounts.quarantined, 4)
assert.equal(current.readiness.projection.prebookClosure.blindClaimsCovered, 746)
assert.equal(current.readiness.projection.prebookClosure.candidateClaims, 220)
assert.equal(current.readiness.projection.prebookClosure.draftBenchmarkItems, 2400)
assert.equal(current.readiness.projection.prebookClosure.draftVariations, 10000)
assert.equal(current.readiness.projection.prebookClosure.runtimeEligible, false)
assert.equal(current.readiness.projection.prebookClosure.releaseEligible, false)
const officialV3 = current.readiness.projection.prebookEngineeringEvidence
  .lockedEvaluationV3OfficialFirstRun
assert.equal(officialV3.state, "official_v3_holdout_consumed_fail_no_tuning_or_rerun")
assert.equal(officialV3.overallAccuracy, 0.346939)
assert.equal(officialV3.qualityGate, "fail")
assert.equal(officialV3.holdoutConsumed, true)
assert.equal(officialV3.noTuningOrRerun, true)
assert.equal(officialV3.questionPayloadReadByReadinessGenerator, false)
assert.equal(officialV3.resultPayloadReadByReadinessGenerator, false)
assert.equal(officialV3.runtimeEligible, false)
assert.equal(officialV3.releaseEligible, false)
assert.equal(officialV3.activationAllowed, false)
const turkishFullCoverage = current.readiness.projection.prebookEngineeringEvidence
  .turkishFullCoverage
assert.deepEqual(Object.keys(turkishFullCoverage), [
  "candidateClaims",
  "remainingClaims",
  "turkish_full_coverage_reconciled",
  "workpacks",
  "passA",
  "passAAudit",
  "passB",
  "passBAudit",
  "remainingReconciliation",
  "fullReconciliationCoverage",
  "aggregateManifestsOnly",
  "independentHumanValidation",
  "ownerAuthority",
  "runtimeEligible",
  "releaseEligible",
  "activationAllowed",
])
assert.equal(turkishFullCoverage.candidateClaims, 220)
assert.equal(turkishFullCoverage.remainingClaims, 178)
assert.equal(turkishFullCoverage.turkish_full_coverage_reconciled, true)
assert.equal(turkishFullCoverage.passA.counts.complete, 178)
assert.equal(turkishFullCoverage.passAAudit.counts.statusCounts.pass, 178)
assert.equal(turkishFullCoverage.passB.counts.renderings, 178)
assert.equal(turkishFullCoverage.passBAudit.counts.statusCounts.pass, 173)
assert.equal(turkishFullCoverage.passBAudit.counts.statusCounts.needs_revision, 5)
assert.equal(turkishFullCoverage.remainingReconciliation.counts.terminal, 178)
assert.deepEqual(turkishFullCoverage.remainingReconciliation.decisionCounts, {
  exact_match: 15,
  prefer_a: 8,
  prefer_b: 29,
  quarantine: 0,
  reconciled_revision: 1,
  semantically_equivalent: 125,
})
assert.equal(turkishFullCoverage.fullReconciliationCoverage.counts.exactUnion, 220)
assert.equal(turkishFullCoverage.fullReconciliationCoverage.counts.missingClaims, 0)
assert.equal(turkishFullCoverage.fullReconciliationCoverage.exactCandidateCoverage, true)
assert.equal(turkishFullCoverage.aggregateManifestsOnly, true)
assert.equal(turkishFullCoverage.independentHumanValidation, false)
assert.equal(turkishFullCoverage.ownerAuthority, false)
assert.equal(turkishFullCoverage.runtimeEligible, false)
assert.equal(turkishFullCoverage.releaseEligible, false)
assert.equal(turkishFullCoverage.activationAllowed, false)
for (const manifest of [
  officialV3,
  turkishFullCoverage.workpacks,
  turkishFullCoverage.passA,
  turkishFullCoverage.passAAudit,
  turkishFullCoverage.passB,
  turkishFullCoverage.passBAudit,
  turkishFullCoverage.remainingReconciliation,
  turkishFullCoverage.fullReconciliationCoverage,
]) {
  assert.match(manifest.manifestRawBytesSha256, /^[a-f0-9]{64}$/)
  assert.match(manifest.manifestSha256, /^[a-f0-9]{64}$/)
}
assert.deepEqual({
  lockedEvaluationV3: officialV3.manifestRawBytesSha256,
  workpacks: turkishFullCoverage.workpacks.manifestRawBytesSha256,
  passA: turkishFullCoverage.passA.manifestRawBytesSha256,
  passAAudit: turkishFullCoverage.passAAudit.manifestRawBytesSha256,
  passB: turkishFullCoverage.passB.manifestRawBytesSha256,
  passBAudit: turkishFullCoverage.passBAudit.manifestRawBytesSha256,
  remainingReconciliation:
    turkishFullCoverage.remainingReconciliation.manifestRawBytesSha256,
  fullReconciliationCoverage:
    turkishFullCoverage.fullReconciliationCoverage.manifestRawBytesSha256,
}, {
  lockedEvaluationV3:
    "4af58a4b4b20f9087b45988526e5fdb3deb5930771adfbca0500bd412de22ca3",
  workpacks: "e1ae073ee36e2a886f009673f94d07ac7c442238f430d000f55136a2cb9dd42d",
  passA: "260a697d224cf971f4156d8d8ed1a2868e576fdb07149cd658a2c890a2391208",
  passAAudit: "ea557be5979078007f5480d44f8088257327bdf6115025692c99030df24373df",
  passB: "3c70d4f4d092e85885e418288cbd748c05f9bc04051f1438b0d3714102df6369",
  passBAudit: "06f0309a51309d0dea7b315fa103262304fd9460246ec3bd0193b6a449886871",
  remainingReconciliation:
    "72baf783b44679102c476fe7559402b871cda23a0417a98b32aee9fe4f3f98f2",
  fullReconciliationCoverage:
    "cb400382c76f0cc07b5604613e6b6d51f59e1d14ddf64ad2283ba4ab2defb10c",
})
assert.equal(current.facts.history.some((entry) =>
  /(?:v1|v2|internal-locked-turkish-holdout)/.test(entry.path)
  && /turkish-retrieval|locked-turkish-holdout/.test(entry.path)), false)
assert.equal(current.readiness.projection.prebookEngineeringEvidence
  .ownerBookReviewBundle.ownerApproval, false)

const freshFacts = collectPrebookFacts({ generatedAt: "2026-07-20T00:00:00.000Z" })
const generatedReadiness = buildPrebookReadiness(freshFacts)
const generatedState = buildProgramState(freshFacts, generatedReadiness)
assert.deepEqual(buildPrebookReadiness(freshFacts), generatedReadiness)
assert.deepEqual(buildProgramState(freshFacts, generatedReadiness), generatedState)
assert.equal(validatePrebookReadiness(generatedReadiness, freshFacts), true)
assert.equal(validateProgramState(generatedState, generatedReadiness, freshFacts), true)

const driftedCount = clone(generatedReadiness)
driftedCount.projection.sourceIntegrity.pending += 1
assert.throws(
  () => validatePrebookReadiness(driftedCount, freshFacts),
  /prebook_readiness_projection_hash_mismatch/,
)

const forgedRelease = clone(generatedReadiness)
forgedRelease.orderedProgramTruth.releaseDecision = "go"
assert.throws(
  () => validatePrebookReadiness(forgedRelease, freshFacts),
  /prebook_readiness_release_decision_must_be_no_go/,
)

const changedUnderlyingFacts = clone(freshFacts)
changedUnderlyingFacts.sourceIntegrity.pending += 1
assert.throws(
  () => validatePrebookReadiness(generatedReadiness, changedUnderlyingFacts),
  /prebook_readiness_current_artifact_drift/,
)

const forgedPrebookClosure = clone(generatedReadiness)
forgedPrebookClosure.projection.prebookClosure.prebookActionableBlockers = 1
assert.throws(
  () => validatePrebookReadiness(forgedPrebookClosure, freshFacts),
  /prebook_readiness_projection_hash_mismatch/,
)

const reopenedHistoricalBlockers = clone(generatedReadiness)
reopenedHistoricalBlockers.projection.methodAppraisal.reconciliation.actionableUnresolvedRecords = 1
assert.throws(
  () => validatePrebookReadiness(reopenedHistoricalBlockers, freshFacts),
  /prebook_readiness_projection_hash_mismatch/,
)

const forgedCandidateAuthority = clone(generatedReadiness)
forgedCandidateAuthority.projection.prebookEngineeringEvidence
  .turkishFullCoverage.runtimeEligible = true
assert.throws(
  () => validatePrebookReadiness(forgedCandidateAuthority, freshFacts),
  /prebook_readiness_projection_hash_mismatch/,
)

const forgedOfficialV3Result = clone(generatedReadiness)
forgedOfficialV3Result.projection.prebookEngineeringEvidence
  .lockedEvaluationV3OfficialFirstRun.qualityGate = "pass"
assert.throws(
  () => validatePrebookReadiness(forgedOfficialV3Result, freshFacts),
  /prebook_readiness_projection_hash_mismatch/,
)

const forgedFullCoverage = clone(generatedReadiness)
forgedFullCoverage.projection.prebookEngineeringEvidence
  .turkishFullCoverage.turkish_full_coverage_reconciled = false
assert.throws(
  () => validatePrebookReadiness(forgedFullCoverage, freshFacts),
  /prebook_readiness_projection_hash_mismatch/,
)

const forgedCoverageManifestHash = clone(generatedReadiness)
forgedCoverageManifestHash.projection.prebookEngineeringEvidence
  .turkishFullCoverage.fullReconciliationCoverage.manifestRawBytesSha256 = "0".repeat(64)
assert.throws(
  () => validatePrebookReadiness(forgedCoverageManifestHash, freshFacts),
  /prebook_readiness_projection_hash_mismatch/,
)

const forgedReconciliationCount = clone(generatedReadiness)
forgedReconciliationCount.projection.prebookEngineeringEvidence
  .turkishFullCoverage.remainingReconciliation.counts.terminal = 177
assert.throws(
  () => validatePrebookReadiness(forgedReconciliationCount, freshFacts),
  /prebook_readiness_projection_hash_mismatch/,
)

const mislabeledHistory = clone(generatedReadiness)
mislabeledHistory.historicalEvidence[0].authority = "current_generated_readiness"
assert.throws(
  () => validatePrebookReadiness(mislabeledHistory, freshFacts),
  /prebook_readiness_historical_evidence_mislabeled/,
)

const legacyCompletionClaim = clone(generatedState)
legacyCompletionClaim.completedPhases = [0, 1, 2]
assert.throws(
  () => validateProgramState(legacyCompletionClaim, generatedReadiness, freshFacts),
  /prebook_program_state_legacy_completed_phases_forbidden/,
)

const forgedV3State = clone(generatedState)
forgedV3State.releaseStatus.decision = "go"
assert.throws(
  () => validateProgramState(forgedV3State, generatedReadiness, freshFacts),
  /prebook_program_state_release_truth_invalid/,
)

console.log(JSON.stringify({
  ok: true,
  productionSnapshotVerified: true,
  deterministicGeneratorVerified: true,
  negativeTamperTests: 13,
  sourceIntegrity: `${freshFacts.sourceIntegrity.verified_clean}_clean_${freshFacts.sourceIntegrity.pending}_pending`,
  candidateWorkpacks: freshFacts.candidateCorpus.methodReviewWorkpacks,
  registeredMethodAppraisals: freshFacts.methodAppraisal.registered,
  candidatePassages: freshFacts.candidatePassages.candidatePassages,
  candidateClaims: freshFacts.candidateClaims.candidateClaims,
  exactConsensusCandidates: freshFacts.candidateClaimReconciliations.exactConsensus,
  historicalPendingMethodAppraisals: freshFacts.methodAppraisal.pending,
  supersededHistoricalPipelineRecords:
    freshFacts.methodAppraisal.reconciliation.superseded_historical_pipeline_state.total,
  historicalSourceDecisions: freshFacts.prebookClosure.historicalSourceDecisions,
  officialV3LockedQualityGate: freshFacts.prebookEngineeringEvidence
    .lockedEvaluationV3OfficialFirstRun.qualityGate,
  turkishFullCoverageReconciled: freshFacts.prebookEngineeringEvidence
    .turkishFullCoverage.turkish_full_coverage_reconciled,
  prebookActionableBlockers: freshFacts.prebookClosure.prebookActionableBlockers,
  prebookDraftBenchmark: freshFacts.prebookClosure.draftBenchmarkItems,
  prebookDraftVariations: freshFacts.prebookClosure.draftVariations,
  runtime: "v2_legacy",
  v3: "no_go",
}, null, 2))

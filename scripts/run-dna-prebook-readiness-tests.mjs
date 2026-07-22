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
assert.equal(current.readiness.projection.candidatePassages.runtimeEligible, 0)
assert.equal(current.readiness.projection.candidatePassages.releaseEligible, 0)
assert.equal(current.readiness.projection.candidateClaims.runtimeEligible, 0)
assert.equal(current.readiness.projection.candidateClaims.releaseEligible, 0)
assert.equal(current.readiness.projection.candidateClaimReconciliations.runtimeEligible, 0)
assert.equal(current.readiness.projection.candidateClaimReconciliations.releaseEligible, 0)
assert.equal(current.readiness.projection.prebookClosure.prebookActionableBlockers, 0)
assert.equal(current.readiness.projection.prebookClosure.fullTextTerminal, 1645)
assert.equal(current.readiness.projection.prebookClosure.workpacksTerminal, 24)
assert.equal(current.readiness.projection.prebookClosure.blindClaimsCovered, 746)
assert.equal(current.readiness.projection.prebookClosure.candidateClaims, 220)
assert.equal(current.readiness.projection.prebookClosure.draftBenchmarkItems, 2400)
assert.equal(current.readiness.projection.prebookClosure.draftVariations, 10000)
assert.equal(current.readiness.projection.prebookClosure.runtimeEligible, false)
assert.equal(current.readiness.projection.prebookClosure.releaseEligible, false)

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
  negativeTamperTests: 7,
  sourceIntegrity: `${freshFacts.sourceIntegrity.verified_clean}_clean_${freshFacts.sourceIntegrity.pending}_pending`,
  candidateWorkpacks: freshFacts.candidateCorpus.methodReviewWorkpacks,
  registeredMethodAppraisals: freshFacts.methodAppraisal.registered,
  candidatePassages: freshFacts.candidatePassages.candidatePassages,
  candidateClaims: freshFacts.candidateClaims.candidateClaims,
  exactConsensusCandidates: freshFacts.candidateClaimReconciliations.exactConsensus,
  prebookActionableBlockers: freshFacts.prebookClosure.prebookActionableBlockers,
  prebookDraftBenchmark: freshFacts.prebookClosure.draftBenchmarkItems,
  prebookDraftVariations: freshFacts.prebookClosure.draftVariations,
  runtime: "v2_legacy",
  v3: "no_go",
}, null, 2))

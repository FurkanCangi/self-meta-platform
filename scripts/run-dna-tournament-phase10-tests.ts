import assert from "node:assert/strict"

import {
  DNA_TOURNAMENT_COMPONENT_ENV,
  resolveDnaTournamentComponentPlan,
  shouldUseDnaTournamentCandidate,
} from "../src/lib/dna/chat/tournament/componentFlags"

const defaults = resolveDnaTournamentComponentPlan({})
assert.equal(defaults.stage, "local_shadow")
assert.equal(defaults.publicAnswerMutationAllowed, false)
assert.equal(defaults.legacyFallbackGuaranteed, true)
assert.ok(Object.values(defaults.components).every((value) => value === false))

const dependencyFailure = resolveDnaTournamentComponentPlan({
  DNA_TOURNAMENT_CANARY_STAGE: "100",
  DNA_TOURNAMENT_RERANKER_ENABLED: "1",
  DNA_TOURNAMENT_LUNA_REALIZATION_ENABLED: "1",
})
assert.equal(dependencyFailure.components.reranker, false)
assert.equal(dependencyFailure.components.lunaRealization, false)
assert.equal(dependencyFailure.publicAnswerMutationAllowed, false)
assert.ok(dependencyFailure.blockedReasons.includes("reranker_requires_embedding"))
assert.ok(dependencyFailure.blockedReasons.includes("independent_human_evaluation_pending"))

const shadow = resolveDnaTournamentComponentPlan({
  DNA_TOURNAMENT_CANARY_STAGE: "production_shadow",
  DNA_TOURNAMENT_EMBEDDING_ENABLED: "1",
  DNA_TOURNAMENT_RERANKER_ENABLED: "1",
  DNA_TOURNAMENT_CONTROLLED_NLG_ENABLED: "1",
})
assert.equal(shadow.components.embedding, true)
assert.equal(shadow.components.reranker, true)
assert.equal(shadow.publicAnswerMutationAllowed, false)

const released = resolveDnaTournamentComponentPlan({
  DNA_TOURNAMENT_CANARY_STAGE: "10",
  DNA_TOURNAMENT_HUMAN_EVALUATION_COMPLETE: "1",
  DNA_TOURNAMENT_PRODUCTION_WINNER: "S1",
  DNA_TOURNAMENT_RELEASE_ATTESTATION_SHA256: "a".repeat(64),
  DNA_CHAT_LUNA_ENABLED: "1",
  DNA_TOURNAMENT_LUNA_FALLBACK_ENABLED: "1",
  [DNA_TOURNAMENT_COMPONENT_ENV.controlledNlg]: "1",
})
assert.equal(released.publicAnswerMutationAllowed, true)
assert.equal(released.components.lunaFallback, true)
assert.equal(released.components.controlledNlg, true)
assert.deepEqual(released.blockedReasons, [])
const stableDecision = shouldUseDnaTournamentCandidate({ plan: released, stableAnonymousId: "stable-01" })
assert.equal(stableDecision, shouldUseDnaTournamentCandidate({ plan: released, stableAnonymousId: "stable-01" }))

const full = resolveDnaTournamentComponentPlan({
  DNA_TOURNAMENT_CANARY_STAGE: "100",
  DNA_TOURNAMENT_HUMAN_EVALUATION_COMPLETE: "1",
  DNA_TOURNAMENT_PRODUCTION_WINNER: "S2",
  DNA_TOURNAMENT_RELEASE_ATTESTATION_SHA256: "b".repeat(64),
})
assert.equal(shouldUseDnaTournamentCandidate({ plan: full, stableAnonymousId: "any" }), true)
const internal = resolveDnaTournamentComponentPlan({
  DNA_TOURNAMENT_CANARY_STAGE: "internal",
  DNA_TOURNAMENT_HUMAN_EVALUATION_COMPLETE: "1",
  DNA_TOURNAMENT_PRODUCTION_WINNER: "S5",
  DNA_TOURNAMENT_RELEASE_ATTESTATION_SHA256: "c".repeat(64),
})
assert.equal(shouldUseDnaTournamentCandidate({ plan: internal, stableAnonymousId: "any" }), false)
assert.equal(shouldUseDnaTournamentCandidate({ plan: internal, stableAnonymousId: "any", internalAuthorized: true }), true)

console.log(JSON.stringify({ ok: true, assertions: 28, defaultStage: defaults.stage }))

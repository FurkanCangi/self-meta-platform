import assert from "node:assert/strict"

import {
  DNA_S13_QUERY_FRAME_VERSION,
  DNA_S13_REALIZATION_VERSION,
  preservesDnaS13QuestionMeaning,
  validateDnaS13QueryFrame,
  validateDnaS13Realization,
  type DnaS13Claim,
  type DnaS13QueryFrame,
  type DnaS13RetrievalPackage,
} from "../src/lib/dna/chat/s13/contracts"
import {
  DNA_S13_CONTEXT_TTL_MS,
  openDnaS13ConversationState,
  sealDnaS13ConversationState,
} from "../src/lib/dna/chat/s13/contextToken"
import { createDnaS13AnswerPlan, createDnaS13RequiredSlots } from "../src/lib/dna/chat/s13/planner"
import { runDnaS13Pipeline } from "../src/lib/dna/chat/s13/pipeline"
import { validateDnaS13GroundedRealization } from "../src/lib/dna/chat/s13/validator"
import { resolveDnaTournamentComponentPlan } from "../src/lib/dna/chat/tournament/componentFlags"

const topics = ["ans.hrv", "ans.interoception"]
const parsed = validateDnaS13QueryFrame({
  normalizedQuestion: "HRV çocuklarda nasıl ölçülür?",
  responseDepth: "standard",
  uncertain: false,
  subquestions: [{
    id: "q1",
    question: "HRV çocuklarda nasıl ölçülür?",
    intent: "scientific_question",
    topicId: "ans.hrv",
    focus: "measurement",
    questionType: "measurement",
    followUp: false,
    correction: false,
    comparisonTargetTopicIds: [],
    answerabilityHint: "supported",
  }],
}, topics)
assert.ok(parsed)
assert.equal(parsed?.version, DNA_S13_QUERY_FRAME_VERSION)
assert.equal(preservesDnaS13QuestionMeaning("HRV çocuklarda nasıl ölçülür?", parsed!), true)
assert.equal(preservesDnaS13QuestionMeaning("HRV yetişkinlerde nasıl ölçülür?", parsed!), false)

assert.equal(validateDnaS13QueryFrame({
  normalizedQuestion: "İki konu",
  responseDepth: "standard",
  uncertain: false,
  subquestions: [1, 2, 3],
}, topics), null, "QueryFrame must contain at most two subquestions")
assert.equal(validateDnaS13QueryFrame({
  normalizedQuestion: "HRV ile interosepsiyonu karşılaştır",
  responseDepth: "standard",
  uncertain: false,
  subquestions: [{
    id: "q1", question: "Karşılaştır", intent: "scientific_question", topicId: "ans.hrv",
    focus: "comparison", questionType: "comparison", followUp: false, correction: false,
    comparisonTargetTopicIds: ["ans.hrv"], answerabilityHint: "supported",
  }],
}, topics), null, "A comparison must have exactly two targets")

const secret = "s13-context-secret-for-tests-at-least-32-bytes"
const now = 1_786_200_000_000
const token = sealDnaS13ConversationState({
  topicIds: ["ans.hrv", "ans.interoception"],
  focus: "comparison",
  questionType: "comparison",
  responseDepth: "deep",
  secret,
  now,
})
assert.equal(token.includes("ans.hrv"), false)
assert.equal(token.includes("claim"), false)
assert.deepEqual(openDnaS13ConversationState({ token, secret, now: now + 1_000 })?.topicIds, topics)
assert.equal(openDnaS13ConversationState({ token: `${token}x`, secret, now: now + 1_000 }), null)
assert.equal(openDnaS13ConversationState({ token, secret, now: now + DNA_S13_CONTEXT_TTL_MS }), null)

const claims: DnaS13Claim[] = [{
  id: "claim.hrv.measurement",
  text: "HRV ölçümü, kalp atımları arasındaki zaman değişkenliğini uygun kayıt ve artefakt kontrolüyle inceler.",
  passageId: "passage.hrv.1",
  sourceIds: ["source.hrv.1"],
  topicId: "ans.hrv",
  focus: "measurement",
}]
const slots = createDnaS13RequiredSlots({ frame: parsed!, claimsBySubquestion: { q1: claims } })
assert.equal(slots.length, 1)
assert.deepEqual(slots[0]?.requiredClaimIds, [claims[0]?.id])
const plan = createDnaS13AnswerPlan(slots)
assert.deepEqual(plan.orderedSlotIds, ["slot-1"])

const validRealization = validateDnaS13Realization({
  answer: claims[0]?.text,
  coveredSlots: ["slot-1"],
  usedClaimIds: [claims[0]?.id],
  usedSourceIds: ["source.hrv.1"],
  unsupportedAddition: false,
})
assert.ok(validRealization)
assert.equal(validRealization?.version, DNA_S13_REALIZATION_VERSION)
assert.equal(validateDnaS13GroundedRealization({ realization: validRealization!, claims, slots }).pass, true)

const invented = validateDnaS13Realization({
  answer: `${claims[0]?.text} Kesin olarak hastalığa neden olur ve 20 dakikada ölçülür.`,
  coveredSlots: ["slot-1"],
  usedClaimIds: [claims[0]?.id],
  usedSourceIds: ["source.hrv.1"],
  unsupportedAddition: false,
})!
const inventedValidation = validateDnaS13GroundedRealization({ realization: invented, claims, slots })
assert.equal(inventedValidation.pass, false)
assert.ok(inventedValidation.failureCodes.includes("invented_number"))
assert.ok(inventedValidation.failureCodes.includes("causality_escalated"))

const retrieval: DnaS13RetrievalPackage = {
  engine: "S1",
  confidence: 0.8,
  runnerUpMargin: 0.2,
  lexicalTopicId: "ans.hrv",
  ftrlTopicId: "ans.hrv",
  claims,
  slots,
}
async function runPipelineAssertions() {
let realizationCall = 0
const repaired = await runDnaS13Pipeline({
  variant: "S13-A",
  deterministicFallback: "fallback",
  query: async () => parsed!,
  retrieveS1: () => retrieval,
  retrieveS2: () => retrieval,
  realize: async () => {
    realizationCall += 1
    return realizationCall === 1 ? invented : validRealization
  },
})
assert.equal(repaired.status, "repaired")
assert.equal(repaired.providerCalls, 3)
assert.equal(repaired.answer, claims[0]?.text)

const permanentFailure = await runDnaS13Pipeline({
  variant: "S13-A",
  deterministicFallback: "fallback",
  query: async () => parsed!,
  retrieveS1: () => retrieval,
  retrieveS2: () => retrieval,
  realize: async () => invented,
})
assert.equal(permanentFailure.status, "deterministic_fallback")
assert.equal(permanentFailure.providerCalls, 3)
assert.equal(permanentFailure.answer, "fallback")

const s13Shadow = resolveDnaTournamentComponentPlan({
  DNA_TOURNAMENT_CANARY_STAGE: "production_shadow",
  DNA_CHAT_LUNA_ENABLED: "1",
  DNA_S13_ENABLED: "1",
  DNA_S13_QUERY_ENABLED: "1",
  DNA_S13_REALIZATION_ENABLED: "1",
  DNA_S13_REPAIR_ENABLED: "1",
})
assert.equal(s13Shadow.components.s13Master, true)
assert.equal(s13Shadow.components.s13Query, true)
assert.equal(s13Shadow.publicAnswerMutationAllowed, false)

const s13MutationBlocked = resolveDnaTournamentComponentPlan({
  DNA_TOURNAMENT_CANARY_STAGE: "10",
  DNA_CHAT_LUNA_ENABLED: "1",
  DNA_S13_ENABLED: "1",
  DNA_S13_QUERY_ENABLED: "1",
  DNA_S13_REALIZATION_ENABLED: "1",
  DNA_TOURNAMENT_PRODUCTION_WINNER: "S13_A",
})
assert.equal(s13MutationBlocked.publicAnswerMutationAllowed, false)
assert.ok(s13MutationBlocked.blockedReasons.includes("independent_human_evaluation_pending"))

console.log(JSON.stringify({
  ok: true,
  assertions: 32,
  queryFrameVersion: DNA_S13_QUERY_FRAME_VERSION,
  contextTtlMs: DNA_S13_CONTEXT_TTL_MS,
  maximumProviderCalls: permanentFailure.providerCalls,
}))
}

void runPipelineAssertions().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

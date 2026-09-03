import assert from "node:assert/strict"

import {
  applyStudentRequestContract,
  buildStudentStateCandidateEnvelope,
  createEmptyStudentConversationState,
  interpretStudentRequest,
  observeStudentRequestFacts,
  type StudentConversationState,
} from "../src/lib/dna/chat/studentFirst"

const HARNESS_VERSION = "dna-student-evidence-first-core-tests@1" as const

function observe(message: string, state = createEmptyStudentConversationState(), turnId = "B1-TEST") {
  return observeStudentRequestFacts({ turnId, message, state })
}

function append(state: StudentConversationState, turnId: string, message: string): StudentConversationState {
  const contract = interpretStudentRequest({ turnId, message, state })
  return applyStudentRequestContract(state, contract)
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort()
}

const explicitDefinition = observe("hocam öz düzenleme ne demek çok akademik olmadan anlatır mısın")
assert.deepEqual(explicitDefinition.explicitTargetIds, ["self_regulation"])
assert.equal(explicitDefinition.semanticTaskCandidates.includes("define"), true)
assert.equal(explicitDefinition.conversationAction, "start")
assert.equal(explicitDefinition.presentation.language, "plain_student")

const contextOnlyRecovery = observe("öğretmen yavaş konuşunca çocuk göreve dönüyor")
assert.deepEqual(contextOnlyRecovery.explicitTargetIds, [])
assert.deepEqual(contextOnlyRecovery.contextTargetIds, ["recovery"])

const inflectedRecovery = observe("kendi kendine toparlanıp göreve dönmesini soruyorum")
assert.deepEqual(inflectedRecovery.explicitTargetIds, ["recovery"])
assert.deepEqual(inflectedRecovery.contextTargetIds, [])

const inflectedScientificTargets = observe("duygu düzenlemeyi değil interosepsiyonda beden sinyalini soruyorum")
assert.deepEqual(inflectedScientificTargets.explicitTargetIds, ["emotion_regulation", "interoception"])
assert.deepEqual(inflectedScientificTargets.rejectedTargetIds, ["emotion_regulation"])

const ambiguousOrdinaryLanguage = [
  "bu çocuk hemen bağımsız olsun istiyorum",
  "oyuncak dikkatini çekince masaya geldi",
  "çocuk yönergeye dikkat etsin sonra başlasın",
  "odasını organize etsin ve çantasını hazırlasın",
  "motivasyonu artsın diye onu övdüm",
  "önce sakinleşsin sonra etkinliğe geçsin",
  "kendini kontrol edip sırasını beklesin",
] as const
for (const [index, message] of ambiguousOrdinaryLanguage.entries()) {
  const facts = observe(message, createEmptyStudentConversationState(), `B1-NEG-${index + 1}`)
  assert.deepEqual(facts.explicitTargetIds, [], `${message}: ordinary goal/behavior language must not create a scientific target`)
  assert.equal(JSON.stringify(facts).includes(message), false, "raw message must not be retained in observed facts")
}

const explicitAttention = observe("burada dikkat mi öz düzenleme mi düşünmeliyiz")
assert.deepEqual(explicitAttention.explicitTargetIds, ["attention", "self_regulation"])
assert.equal(explicitAttention.semanticTaskCandidates.includes("compare"), true)

const compareAndExample = observe("planlama ile çalışma belleğini aynı örnekte ayrı ayrı göster")
assert.deepEqual(compareAndExample.explicitTargetIds, ["planning", "working_memory"])
assert.equal(compareAndExample.semanticTaskCandidates.includes("compare"), true)
assert.equal(compareAndExample.semanticTaskCandidates.includes("example"), true)
assert.equal(compareAndExample.presentation.grouping, "separate_each")
assert.equal(compareAndExample.presentation.example, "brief")
assert.equal(compareAndExample.presentation.exampleScope, "shared")

let treatmentState = createEmptyStudentConversationState()
treatmentState = append(treatmentState, "B1-TREAT-T01", "eş düzenleme ne demek")
treatmentState = append(treatmentState, "B1-TREAT-T02", "yok arousal kısmını sormuyorum eş düzenleme tarafını soruyorum")
assert.deepEqual(treatmentState.activeTargetIds, ["coregulation"])
const treatmentFacts = observe(
  "bu çocuğa hemen bağımsız olsun diye hangi terapiyi uygulayayım",
  treatmentState,
  "B1-TREAT-T03",
)
const treatmentEnvelope = buildStudentStateCandidateEnvelope({ facts: treatmentFacts, state: treatmentState })
assert.equal(treatmentFacts.safetyIntent, "treatment_selection")
assert.deepEqual(treatmentFacts.explicitTargetIds, [])
assert.deepEqual(treatmentEnvelope.allowedFocusTargetIds, ["coregulation"])
assert.equal(treatmentEnvelope.allowedFocusTargetIds.includes("self_regulation"), false)
assert.deepEqual(treatmentEnvelope.allowedReferentTurnIds, [], "treatment boundary must not inherit an old case referent")
assert.equal(treatmentEnvelope.targetCandidates.find((row) => row.targetId === "coregulation")?.eligibilityReason, "single_active_treatment_context")

const explicitTreatmentFacts = observe(
  "beden sinyalini daha iyi fark etsin diye interosepsiyon için hangi terapiyi seçeyim",
  treatmentState,
  "B1-TREAT-T04",
)
const explicitTreatmentEnvelope = buildStudentStateCandidateEnvelope({ facts: explicitTreatmentFacts, state: treatmentState })
assert.deepEqual(explicitTreatmentEnvelope.allowedFocusTargetIds, ["interoception"])
assert.equal(explicitTreatmentEnvelope.allowedFocusTargetIds.includes("coregulation"), false)

let summaryState = createEmptyStudentConversationState()
summaryState = append(summaryState, "B1-SUM-T01", "öz düzenleme ne demek")
summaryState = append(summaryState, "B1-SUM-T02", "dikkat ne demek")
const broadSummaryFacts = observe("konuştuklarımızı üç cümlede özetle", summaryState, "B1-SUM-T03")
const broadSummaryEnvelope = buildStudentStateCandidateEnvelope({ facts: broadSummaryFacts, state: summaryState })
assert.deepEqual(sorted(broadSummaryEnvelope.allowedFocusTargetIds), ["attention", "self_regulation"])
assert.deepEqual(broadSummaryEnvelope.allowedReferentTurnIds, [])

const scopedSummaryFacts = observe("sadece öz düzenlemeyi üç cümlede özetle", summaryState, "B1-SUM-T04")
const scopedSummaryEnvelope = buildStudentStateCandidateEnvelope({ facts: scopedSummaryFacts, state: summaryState })
assert.deepEqual(scopedSummaryEnvelope.allowedFocusTargetIds, ["self_regulation"])

let exampleState = createEmptyStudentConversationState()
exampleState = append(exampleState, "B1-REF-T01", "eş düzenleme ne demek")
exampleState = append(exampleState, "B1-REF-T02", "eş düzenlemeyi çocuk üzerinden örnekle anlat")
const caseFacts = observe("bu çocuk için tek gözlemle kesin diyebilir miyiz", exampleState, "B1-REF-T03")
const caseEnvelope = buildStudentStateCandidateEnvelope({ facts: caseFacts, state: exampleState })
assert.equal(caseFacts.semanticTaskCandidates.includes("case_reasoning"), true)
assert.deepEqual(caseEnvelope.allowedReferentTurnIds, ["B1-REF-T02"])
assert.equal(caseEnvelope.referentCandidates[0]?.role, "case_entity")

const returnFacts = observe("ilk anlattığın öz düzenleme konusuna dönelim", summaryState, "B1-RETURN-T01")
const returnEnvelope = buildStudentStateCandidateEnvelope({ facts: returnFacts, state: summaryState })
assert.equal(returnFacts.conversationAction, "return")
assert.equal(returnEnvelope.allowedReferentTurnIds.includes("B1-SUM-T01"), true)

console.log(JSON.stringify({
  ok: true,
  gate: "STUDENT_EVIDENCE_FIRST_R1_LOCAL",
  version: HARNESS_VERSION,
  providerCalls: 0,
  rawMessagesPersisted: 0,
  explicitTargetContrasts: 6,
  ordinaryLanguageNegativeContrasts: ambiguousOrdinaryLanguage.length,
  multiActContrasts: 1,
  treatmentFalseFocusContrasts: 2,
  summaryScopeContrasts: 2,
  referentEnvelopeContrasts: 2,
}, null, 2))

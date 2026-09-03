import assert from "node:assert/strict"

import {
  applyStudentRequestContract,
  createEmptyStudentConversationState,
  resolveStudentEvidenceFirstRequest,
  type StudentConversationState,
  type StudentEvidenceFirstResolutionResult,
  type StudentRequestContract,
} from "../src/lib/dna/chat/studentFirst"

const HARNESS_VERSION = "dna-student-evidence-first-metamorphic@1" as const

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  const a = [...new Set(left)].sort()
  const b = [...new Set(right)].sort()
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function resolve(
  turnId: string,
  message: string,
  state = createEmptyStudentConversationState(),
): Extract<StudentEvidenceFirstResolutionResult, { ok: true }> {
  const result = resolveStudentEvidenceFirstRequest({ turnId, message, state })
  if (!result.ok) throw new Error(`${turnId}: ${result.reason}${"failureCode" in result ? `/${result.failureCode}` : ""}`)
  assert.equal(JSON.stringify({ facts: result.facts, envelope: result.envelope }).includes(message), false, `${turnId}: raw message retained`)
  return result
}

function append(state: StudentConversationState, turnId: string, message: string): StudentConversationState {
  return applyStudentRequestContract(state, resolve(turnId, message, state).contract)
}

function assertTargets(contract: StudentRequestContract, expected: readonly string[], label: string) {
  assert.equal(sameSet(contract.targetIds, expected), true, `${label}: expected ${expected.join(",")}, received ${contract.targetIds.join(",")}`)
}

const explicitMorphology = [
  ["öz düzenlemeyi açıkla", "self_regulation"],
  ["öz denetimi kısaca anlat", "self_control"],
  ["dikkat ne demek", "attention"],
  ["yürütücü işlevleri öğrenci gibi anlat", "executive_functions"],
  ["inhibisyonu açıklar mısın", "inhibition"],
  ["çalışma belleğine örnek ver", "working_memory"],
  ["planlamayı anlat", "planning"],
  ["bilişsel esnekliği açıkla", "cognitive_flexibility"],
  ["eş düzenlemeyi kısaca anlat", "coregulation"],
  ["arousalın anlamı ne", "arousal"],
  ["duyusal düzenlemeyi anlat", "sensory_regulation"],
  ["duyusal modülasyonu açıkla", "sensory_modulation"],
  ["duygu düzenlemesini anlat", "emotion_regulation"],
  ["interosepsiyonda neye bakarız", "interoception"],
  ["reaktiviteyi açıkla", "reactivity"],
  ["toparlanıp dönmesini toparlanma açısından anlat", "recovery"],
] as const
for (const [index, [message, targetId]] of explicitMorphology.entries()) {
  assertTargets(resolve(`B1-MORPH-${index + 1}`, message).contract, [targetId], message)
}

const keyboardVariants = [
  ["oz düzenleme ne demek", "self_regulation"],
  ["self-regülasyonu anlat", "self_regulation"],
  ["ko regulasyonu açıkla", "coregulation"],
  ["eş-regülasyonu anlat", "coregulation"],
  ["dürtü kontrolünü açıkla", "inhibition"],
  ["dürtüyü durdurmak ne demek", "inhibition"],
  ["interosepsion ne demek", "interoception"],
  ["duyusal modulasyonu anlat", "sensory_modulation"],
  ["toparlanıyorsa ne düşünürüz", "recovery"],
] as const
for (const [index, [message, targetId]] of keyboardVariants.entries()) {
  assertTargets(resolve(`B1-KEY-${index + 1}`, message).contract, [targetId], message)
}

let activeCoregulation = createEmptyStudentConversationState()
activeCoregulation = append(activeCoregulation, "B1-FALSE-T00", "eş düzenleme ne demek")
const ordinaryBehaviorMessages = [
  "bu çocuk bağımsız olsun istiyorum",
  "çocuk yönergeye dikkat etsin",
  "dikkatini toplayıp masaya gelsin",
  "önce bir plan yapsın sonra başlasın",
  "kendini kontrol edip sırasını beklesin",
  "duygusunu düzenleyip devam etsin",
  "önce sakinleşsin sonra etkinliğe geçsin",
  "daha organize hareket etsin",
  "motivasyonu biraz artsın",
  "daha sabırlı olsun",
  "sırasını beklemeyi öğrensin",
  "oyuna geri dönsün",
  "göreve geri dönsün",
  "bedenini daha iyi fark etsin",
  "uyaranlara alışsın",
  "daha az tepki versin",
  "biraz daha esnek davransın",
  "hafızası güçlensin",
  "dürtüsünü kontrol etsin",
  "uyanık kalıp derse katılsın",
] as const
for (const [index, message] of ordinaryBehaviorMessages.entries()) {
  const result = resolve(`B1-FALSE-${index + 1}`, message, activeCoregulation)
  assert.deepEqual(result.facts.explicitTargetIds, [], `${message}: behavior language became explicit target`)
  assertTargets(result.contract, ["coregulation"], message)
}

const treatmentNoiseMessages = [
  "hemen bağımsız olsun diye hangi terapiyi uygulayayım",
  "dikkatini toplasın diye hangi terapiyi seçeyim",
  "sakinleşsin diye hangi tedaviyi seçeyim",
  "daha organize olsun diye ne uygulayayım",
  "motivasyonu artsın diye hangi terapiyi uygulayayım",
  "kendini kontrol etsin diye hangi tedaviyi seçeyim",
  "göreve dönsün diye hangi terapiyi seçeyim",
  "daha az tepki versin diye ne uygulayayım",
  "bedenini fark etsin diye hangi terapiyi uygulayayım",
  "uyanık kalsın diye hangi tedaviyi seçeyim",
  "esnek davransın diye hangi terapiyi seçeyim",
  "hafızası güçlensin diye ne uygulayayım",
] as const
for (const [index, message] of treatmentNoiseMessages.entries()) {
  const result = resolve(`B1-TREAT-NOISE-${index + 1}`, message, activeCoregulation)
  assert.equal(result.contract.semanticTask, "treatment_boundary")
  assertTargets(result.contract, ["coregulation"], message)
  assert.equal(result.contract.referent.turnId, null)
  assert.deepEqual(result.contract.obligations.map((row) => row.kind), [
    "refuse_treatment_selection",
    "offer_safe_assessment_frame",
  ])
}

const multiActMessages = [
  ["planlama ile çalışma belleğini karşılaştır ve bir örnek ver", ["planning", "working_memory"]],
  ["arousal ile duygu düzenlemeyi ayır ve çocuk örneği ver", ["arousal", "emotion_regulation"]],
  ["öz düzenleme ve öz denetimin farkını örnekle anlat", ["self_regulation", "self_control"]],
  ["inhibisyon ile planlamayı aynı örnekte ayrı ayrı göster", ["inhibition", "planning"]],
  ["interosepsiyonla duygu düzenlemeyi karşılaştır bir de örnek ver", ["interoception", "emotion_regulation"]],
  ["eş düzenleme ile arousal farkını çocuk örneğiyle anlat", ["coregulation", "arousal"]],
  ["duyusal düzenleme ve duyusal modülasyonu ayır, örnek ver", ["sensory_regulation", "sensory_modulation"]],
  ["dikkat ile çalışma belleğini karşılaştır ve sınıftan örnek ver", ["attention", "working_memory"]],
  ["bilişsel esneklik ve planlamayı aynı örnekte göster", ["cognitive_flexibility", "planning"]],
  ["reaktivite ile toparlanma farkını anlat ve örnek ver", ["reactivity", "recovery"]],
] as const
for (const [index, [message, targets]] of multiActMessages.entries()) {
  const result = resolve(`B1-MULTI-${index + 1}`, message)
  assert.equal(result.contract.semanticTask, "compare", message)
  assert.equal(result.contract.requestedSemanticTasks.includes("example"), true, message)
  assertTargets(result.contract, targets, message)
  const kinds = result.contract.obligations.map((row) => row.kind)
  for (const kind of ["distinguish_targets", "explain_relation", "give_concrete_example", "bind_example_to_target"] as const) {
    assert.equal(kinds.includes(kind), true, `${message}: missing ${kind}`)
  }
  const sharedRequested = /aynı örnekte/u.test(message)
  assert.equal(result.contract.presentation.exampleScope, sharedRequested ? "shared" : "independent", message)
  assert.equal(kinds.includes("use_shared_scenario"), sharedRequested, `${message}: shared scenario obligation mismatch`)
}

let summaryState = createEmptyStudentConversationState()
summaryState = append(summaryState, "B1-SUMMARY-T01", "öz düzenleme ne demek")
summaryState = append(summaryState, "B1-SUMMARY-T02", "dikkat ne demek")
summaryState = append(summaryState, "B1-SUMMARY-T03", "planlama ne demek")
const broadSummaries = [
  "konuştuklarımızı özetle",
  "üç cümlede toparla",
  "öğrenci özeti yap",
  "neyi biliyoruz neyi bilmiyoruz gözlemde neye bakarım özetle",
] as const
for (const [index, message] of broadSummaries.entries()) {
  const result = resolve(`B1-SUMMARY-BROAD-${index + 1}`, message, summaryState)
  assertTargets(result.contract, ["self_regulation", "attention", "planning"], message)
  assert.equal(result.contract.conversationAction, "summarize_session")
}
const scopedSummaries = [
  ["sadece dikkati özetle", ["attention"]],
  ["öz düzenlemeyi kısaca toparla", ["self_regulation"]],
  ["dikkat ve planlamayı öğrenci özeti yap", ["attention", "planning"]],
] as const
for (const [index, [message, targets]] of scopedSummaries.entries()) {
  assertTargets(resolve(`B1-SUMMARY-SCOPED-${index + 1}`, message, summaryState).contract, targets, message)
}

let discourseState = createEmptyStudentConversationState()
discourseState = append(discourseState, "B1-DISC-T01", "öz düzenleme ne demek")
discourseState = append(discourseState, "B1-DISC-T02", "dikkat ne demek")
const explicitReturn = resolve("B1-DISC-T03", "öz düzenleme konusuna geri dönelim", discourseState)
assert.equal(explicitReturn.contract.conversationAction, "return")
assertTargets(explicitReturn.contract, ["self_regulation"], "explicit return")
assert.equal(explicitReturn.contract.referent.turnId, "B1-DISC-T01")

const repair = resolve("B1-DISC-T04", "yok dikkat tarafını sormuyorum öz düzenlemeyi soruyorum", discourseState)
assert.equal(repair.contract.conversationAction, "repair")
assertTargets(repair.contract, ["self_regulation"], "repair")
assert.deepEqual(repair.contract.rejectedTargetIds, ["attention"])

const simplify = resolve("B1-DISC-T05", "bunu öğrenci arkadaşına anlatır gibi yeniden söyle", discourseState)
assert.equal(simplify.contract.conversationAction, "continue")
assertTargets(simplify.contract, ["attention"], "simplify")
assert.equal(simplify.contract.presentation.preserveMeaning, true)
assert.equal(simplify.contract.referent.turnId, "B1-DISC-T02")

let caseState = createEmptyStudentConversationState()
caseState = append(caseState, "B1-CASE-T01", "interosepsiyon ne demek")
caseState = append(caseState, "B1-CASE-T02", "interosepsiyonu çocuk üzerinden örnekle anlat")
const caseFollowUp = resolve("B1-CASE-T03", "bu çocuk için tek gözlemle kesin diyebilir miyiz", caseState)
assert.equal(caseFollowUp.contract.semanticTask, "case_reasoning")
assert.equal(caseFollowUp.contract.referent.turnId, "B1-CASE-T02")
assertTargets(caseFollowUp.contract, ["interoception"], "case follow-up")

const ambiguousReturn = resolveStudentEvidenceFirstRequest({
  turnId: "B1-DISC-T06",
  message: "konulardan birine geri dönelim",
  state: discourseState,
})
assert.equal(ambiguousReturn.ok, false)
if (ambiguousReturn.ok || ambiguousReturn.reason !== "closed_slot_failure") throw new Error("expected typed return ambiguity")
assert.equal(ambiguousReturn.failureCode, "referent_choice_required")

const total = explicitMorphology.length + keyboardVariants.length + ordinaryBehaviorMessages.length +
  treatmentNoiseMessages.length + multiActMessages.length + broadSummaries.length + scopedSummaries.length + 5

console.log(JSON.stringify({
  ok: true,
  gate: "STUDENT_EVIDENCE_FIRST_R3_METAMORPHIC_LOCAL",
  version: HARNESS_VERSION,
  total,
  passed: total,
  failed: 0,
  providerCalls: 0,
  rawMessagesPersisted: 0,
  families: {
    explicitMorphology: explicitMorphology.length,
    keyboardVariants: keyboardVariants.length,
    ordinaryBehaviorFalseFocus: ordinaryBehaviorMessages.length,
    treatmentFalseFocus: treatmentNoiseMessages.length,
    multiAct: multiActMessages.length,
    broadSummary: broadSummaries.length,
    scopedSummary: scopedSummaries.length,
    discourseAndReferent: 5,
  },
}, null, 2))

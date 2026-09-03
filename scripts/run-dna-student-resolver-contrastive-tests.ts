import assert from "node:assert/strict"

import {
  applyStudentRequestContract,
  compileStudentRequestContract,
  createEmptyStudentConversationState,
  resolveStudentConversationAction,
  type StudentConversationState,
  type StudentPresentationRequest,
  type StudentSemanticFrame,
  type StudentSemanticTask,
} from "../src/lib/dna/chat/studentFirst"

const presentation: StudentPresentationRequest = Object.freeze({
  depth: "standard",
  language: "standard",
  format: "prose",
  example: "none",
  exampleScope: "independent",
  grouping: "integrated",
  requestedSentenceCount: null,
  preserveMeaning: false,
})

function acts(...enabled: readonly StudentSemanticTask[]): StudentSemanticFrame["semanticActs"] {
  const selected = new Set(enabled)
  return Object.freeze({
    define: selected.has("define"),
    explain: selected.has("explain"),
    compare: selected.has("compare"),
    example: selected.has("example"),
    case_reasoning: selected.has("case_reasoning"),
    summarize: selected.has("summarize"),
    observe: selected.has("observe"),
    evidence: selected.has("evidence"),
    treatment_boundary: selected.has("treatment_boundary"),
  })
}

function frame(input: Partial<StudentSemanticFrame> & Pick<StudentSemanticFrame, "semanticActs">): StudentSemanticFrame {
  return Object.freeze({
    semanticActs: input.semanticActs,
    conversationAction: input.conversationAction ?? "continue",
    focusTargetIds: Object.freeze([...(input.focusTargetIds ?? [])]),
    contextTargetIds: Object.freeze([...(input.contextTargetIds ?? [])]),
    rejectedTargetIds: Object.freeze([...(input.rejectedTargetIds ?? [])]),
    referentTurnId: input.referentTurnId ?? null,
    referentRole: input.referentRole ?? (input.referentTurnId ? "utterance" : "none"),
    presentation: Object.freeze({ ...presentation, ...(input.presentation ?? {}) }),
    summaryExtras: input.summaryExtras ?? Object.freeze({ unknown: false, observationFocus: false }),
    observationExtras: input.observationExtras ?? Object.freeze({ singleObservationLimit: false, additionalContext: false }),
  })
}

function kinds(contract: ReturnType<typeof compileStudentRequestContract>): string[] {
  return contract.obligations.map((row) => row.kind)
}

let state: StudentConversationState = createEmptyStudentConversationState()
const start = compileStudentRequestContract("RESOLVER-T01", frame({
  semanticActs: acts("define", "explain"),
  conversationAction: "start",
  focusTargetIds: ["executive_functions"],
}), state)
state = applyStudentRequestContract(state, start)
const comparison = compileStudentRequestContract("RESOLVER-T02", frame({
  semanticActs: acts("compare", "observe"),
  focusTargetIds: ["inhibition"],
  referentTurnId: "RESOLVER-T01",
  observationExtras: { singleObservationLimit: true, additionalContext: true },
}), state)
assert.equal(comparison.semanticTask, "compare", "explicit comparison must outrank contextual observation")
assert.deepEqual(comparison.targetIds, ["executive_functions", "inhibition"])
assert.deepEqual(kinds(comparison), ["distinguish_targets", "explain_relation", "state_single_observation_limit", "name_additional_context"])
state = applyStudentRequestContract(state, comparison)

const pureObservation = compileStudentRequestContract("RESOLVER-T03", frame({
  semanticActs: acts("observe"),
  focusTargetIds: ["inhibition"],
}), state)
assert.equal(pureObservation.semanticTask, "observe", "observation-only requests must remain observation")
assert.deepEqual(kinds(pureObservation), ["state_single_observation_limit", "name_additional_context"])

const exampleReferenceObservation = compileStudentRequestContract("RESOLVER-T03B", frame({
  semanticActs: acts("explain", "observe"),
  focusTargetIds: ["inhibition"],
  presentation: { ...presentation, example: "concrete" },
}), state)
assert.deepEqual(exampleReferenceObservation.requestedSemanticTasks, ["explain", "observe"])
assert.equal(exampleReferenceObservation.presentation.example, "none", "mentioning an existing example must not request a new example")
assert.deepEqual(kinds(exampleReferenceObservation), ["state_single_observation_limit", "name_additional_context"])

const comparisonWithExample = compileStudentRequestContract("RESOLVER-T03C", frame({
  semanticActs: acts("compare", "example"),
  focusTargetIds: ["planning", "working_memory"],
  presentation: { ...presentation, example: "concrete" },
}), state)
assert.equal(comparisonWithExample.semanticTask, "compare")
assert.deepEqual(comparisonWithExample.requestedSemanticTasks, ["compare", "example"])
assert.deepEqual(kinds(comparisonWithExample), [
  "distinguish_targets",
  "explain_relation",
  "give_concrete_example",
  "bind_example_to_target",
])

const componentExplanation = compileStudentRequestContract("RESOLVER-T04", frame({
  semanticActs: acts("case_reasoning"),
  focusTargetIds: ["planning", "inhibition", "emotion_regulation"],
  presentation: { ...presentation, grouping: "separate_each" },
}), state)
assert.equal(componentExplanation.semanticTask, "explain", "explicit component-wise grouping must outrank contextual case framing")
assert.deepEqual(componentExplanation.componentTargetIds, ["planning", "inhibition", "emotion_regulation"])
assert.deepEqual(kinds(componentExplanation), ["define_target", "cover_requested_component", "cover_requested_component", "cover_requested_component"])

const pureCase = compileStudentRequestContract("RESOLVER-T05", frame({
  semanticActs: acts("case_reasoning"),
  focusTargetIds: ["inhibition"],
}), state)
assert.equal(pureCase.semanticTask, "case_reasoning", "case-only inference limits must remain case reasoning")
assert.deepEqual(kinds(pureCase), ["state_single_observation_limit", "name_additional_context"])

const implicitExample = compileStudentRequestContract("RESOLVER-T06", frame({
  semanticActs: acts("example"),
  presentation: { ...presentation, example: "concrete" },
}), state)
assert.equal(implicitExample.semanticTask, "example")
assert.deepEqual(implicitExample.referent, { kind: "active", role: "utterance", turnId: "RESOLVER-T02", targetIds: ["executive_functions", "inhibition"] })
assert.deepEqual(implicitExample.targetIds, ["executive_functions", "inhibition"])
assert.deepEqual(kinds(implicitExample), ["give_concrete_example", "bind_example_to_target"])
const exampleState = applyStudentRequestContract(state, implicitExample)

const compatibleObservation = compileStudentRequestContract("RESOLVER-T06B", frame({
  semanticActs: acts("observe"),
  focusTargetIds: ["inhibition"],
}), exampleState)
assert.deepEqual(compatibleObservation.referent, {
  kind: "active",
  role: "case_entity",
  turnId: "RESOLVER-T06",
  targetIds: ["executive_functions", "inhibition"],
}, "a repeated compatible target in a context-binding task must retain the latest behavior/example anchor")
assert.deepEqual(compatibleObservation.targetIds, ["inhibition"])

const unrelatedObservation = compileStudentRequestContract("RESOLVER-T06C", frame({
  semanticActs: acts("observe"),
  focusTargetIds: ["interoception"],
}), exampleState)
assert.deepEqual(unrelatedObservation.referent, {
  kind: "none",
  role: "none",
  turnId: null,
  targetIds: [],
}, "an unrelated new observation target must not inherit the latest referent")
assert.deepEqual(unrelatedObservation.targetIds, ["interoception"])

const compatibleExplanationContinuation = compileStudentRequestContract("RESOLVER-T06D", frame({
  semanticActs: acts("explain"),
  focusTargetIds: ["inhibition"],
}), exampleState)
assert.deepEqual(compatibleExplanationContinuation.referent, {
  kind: "active",
  role: "utterance",
  turnId: "RESOLVER-T06",
  targetIds: ["executive_functions", "inhibition"],
}, "a same-target explanatory continuation must retain the immediately previous utterance")
assert.deepEqual(compatibleExplanationContinuation.targetIds, ["inhibition"])

const unrelatedExplanation = compileStudentRequestContract("RESOLVER-T06E", frame({
  semanticActs: acts("explain"),
  focusTargetIds: ["interoception"],
}), exampleState)
assert.deepEqual(unrelatedExplanation.referent, {
  kind: "none",
  role: "none",
  turnId: null,
  targetIds: [],
}, "an unrelated explanation must not inherit the latest utterance")

const compatibleRepairExplanation = compileStudentRequestContract("RESOLVER-T06F", frame({
  semanticActs: acts("explain"),
  conversationAction: "repair",
  focusTargetIds: ["inhibition"],
}), exampleState)
assert.equal(compatibleRepairExplanation.referent.turnId, null, "repair must not receive an inferred continue referent")

const compatibleStartExplanation = compileStudentRequestContract("RESOLVER-T06G", frame({
  semanticActs: acts("explain"),
  conversationAction: "start",
  focusTargetIds: ["inhibition"],
}), exampleState)
assert.equal(compatibleStartExplanation.referent.turnId, null, "start must not receive an inferred continue referent")

const explicitExample = compileStudentRequestContract("RESOLVER-T07", frame({
  semanticActs: acts("example"),
  focusTargetIds: ["coregulation"],
  presentation: { ...presentation, example: "concrete" },
}), state)
assert.deepEqual(explicitExample.referent, { kind: "none", role: "none", turnId: null, targetIds: [] }, "an explicit new example target must not inherit an unrelated referent")
assert.deepEqual(explicitExample.targetIds, ["coregulation"])

let targetRoleState = createEmptyStudentConversationState()
const targetRoleAnchor = compileStudentRequestContract("TARGET-ROLE-T01", frame({
  semanticActs: acts("define"),
  conversationAction: "start",
  focusTargetIds: ["coregulation"],
}), targetRoleState)
targetRoleState = applyStudentRequestContract(targetRoleState, targetRoleAnchor)
const contextualRecoveryExample = compileStudentRequestContract("TARGET-ROLE-T02", frame({
  semanticActs: acts("example"),
  focusTargetIds: [],
  contextTargetIds: ["recovery"],
  presentation: { ...presentation, example: "concrete" },
}), targetRoleState)
assert.deepEqual(contextualRecoveryExample.targetIds, ["coregulation"], "case behavior context must not become an answer-driving target")
assert.deepEqual(contextualRecoveryExample.contextTargetIds, ["recovery"])
assert.deepEqual(contextualRecoveryExample.referent, {
  kind: "active",
  role: "utterance",
  turnId: "TARGET-ROLE-T01",
  targetIds: ["coregulation"],
})
const explicitRecoveryFocus = compileStudentRequestContract("TARGET-ROLE-T03", frame({
  semanticActs: acts("define"),
  focusTargetIds: ["recovery"],
}), targetRoleState)
assert.deepEqual(explicitRecoveryFocus.targetIds, ["recovery"], "an explicit recovery question must remain answer-driving")
assert.deepEqual(explicitRecoveryFocus.contextTargetIds, [])

const implicitSimplification = compileStudentRequestContract("RESOLVER-T08", frame({
  semanticActs: acts("explain"),
  presentation: { ...presentation, language: "plain_student", preserveMeaning: true },
}), state)
assert.deepEqual(implicitSimplification.referent, { kind: "active", role: "utterance", turnId: "RESOLVER-T02", targetIds: ["executive_functions", "inhibition"] })
assert.deepEqual(implicitSimplification.targetIds, ["executive_functions", "inhibition"])
assert.ok(kinds(implicitSimplification).includes("preserve_target_while_simplifying"))

const treatmentBoundary = compileStudentRequestContract("RESOLVER-T09", frame({
  semanticActs: acts("treatment_boundary", "explain"),
  focusTargetIds: ["interoception"],
  presentation: { ...presentation, grouping: "separate_each" },
}), state)
assert.equal(treatmentBoundary.semanticTask, "treatment_boundary", "treatment safety must outrank discourse presentation")
assert.equal(treatmentBoundary.safetyIntent, "treatment_selection")
assert.deepEqual(kinds(treatmentBoundary), ["refuse_treatment_selection", "offer_safe_assessment_frame"])

let repairState: StudentConversationState = createEmptyStudentConversationState()
const repairStart = compileStudentRequestContract("REPAIR-T01", frame({
  semanticActs: acts("define"),
  conversationAction: "start",
  focusTargetIds: ["self_regulation"],
}), repairState)
repairState = applyStudentRequestContract(repairState, repairStart)
const repairComparison = compileStudentRequestContract("REPAIR-T02", frame({
  semanticActs: acts("compare"),
  focusTargetIds: ["attention", "self_regulation"],
}), repairState)
repairState = applyStudentRequestContract(repairState, repairComparison)
const repaired = compileStudentRequestContract("REPAIR-T03", frame({
  semanticActs: acts("compare"),
  conversationAction: "repair",
  focusTargetIds: ["attention", "self_regulation", "recovery"],
  rejectedTargetIds: ["attention"],
  referentTurnId: "REPAIR-T02",
}), repairState)
assert.deepEqual(repaired.targetIds, ["self_regulation", "recovery"], "a rejected target must not re-enter through referent union")
assert.deepEqual(repaired.comparisonTargetIds, ["self_regulation", "recovery"])
assert.ok(kinds(repaired).includes("honor_rejected_target"))
repairState = applyStudentRequestContract(repairState, repaired)

const repairSummary = compileStudentRequestContract("REPAIR-T04", frame({
  semanticActs: acts("summarize"),
  conversationAction: "summarize_session",
  rejectedTargetIds: ["attention"],
}), repairState)
assert.deepEqual(repairSummary.rejectedTargetIds, [], "historical rejection copied by a summary frame must not become a current-turn rejection")
assert.ok(repairSummary.targetIds.includes("attention"), "current-turn rejection must not erase a historically discussed target from session summary")
assert.ok(repairSummary.targetIds.includes("self_regulation"))
assert.ok(repairSummary.targetIds.includes("recovery"))
const summaryState = applyStudentRequestContract(repairState, repairSummary)
assert.ok(summaryState.rejectedTargetIds.includes("attention"), "historical rejection memory must survive a summary turn")

const noisyContinueRejection = compileStudentRequestContract("REPAIR-T05", frame({
  semanticActs: acts("define"),
  conversationAction: "continue",
  focusTargetIds: ["recovery"],
  rejectedTargetIds: ["attention"],
}), repairState)
assert.deepEqual(noisyContinueRejection.rejectedTargetIds, [], "continue cannot expose provider-carried historical rejection")

const noisyReturnRejection = compileStudentRequestContract("REPAIR-T06", frame({
  semanticActs: acts("define"),
  conversationAction: "return",
  focusTargetIds: ["self_regulation"],
  rejectedTargetIds: ["attention"],
  referentTurnId: "REPAIR-T01",
}), repairState)
assert.deepEqual(noisyReturnRejection.rejectedTargetIds, [], "return cannot expose provider-carried historical rejection")

let compareState: StudentConversationState = createEmptyStudentConversationState()
const compareStart = compileStudentRequestContract("COMPARE-T01", frame({
  semanticActs: acts("define"),
  conversationAction: "start",
  focusTargetIds: ["executive_functions"],
}), compareState)
compareState = applyStudentRequestContract(compareState, compareStart)

const singleSideCompare = compileStudentRequestContract("COMPARE-T02", frame({
  semanticActs: acts("compare"),
  focusTargetIds: ["inhibition"],
}), compareState)
assert.deepEqual(singleSideCompare.referent, { kind: "active", role: "utterance", turnId: "COMPARE-T01", targetIds: ["executive_functions"] })
assert.deepEqual(singleSideCompare.targetIds, ["executive_functions", "inhibition"], "one explicit comparison side must be completed from the latest referent")

const completeOverlappingCompare = compileStudentRequestContract("COMPARE-T03", frame({
  semanticActs: acts("compare"),
  focusTargetIds: ["executive_functions", "inhibition"],
}), compareState)
assert.deepEqual(completeOverlappingCompare.referent, { kind: "active", role: "utterance", turnId: "COMPARE-T01", targetIds: ["executive_functions"] })
assert.deepEqual(completeOverlappingCompare.targetIds, ["executive_functions", "inhibition"], "a complete explicit pair must not be expanded by its conversational referent")

let priorExtraState: StudentConversationState = createEmptyStudentConversationState()
const priorExtra = compileStudentRequestContract("COMPARE-T04", frame({
  semanticActs: acts("explain"),
  conversationAction: "start",
  focusTargetIds: ["self_regulation", "self_control"],
}), priorExtraState)
priorExtraState = applyStudentRequestContract(priorExtraState, priorExtra)
const completePairWithPriorExtra = compileStudentRequestContract("COMPARE-T05", frame({
  semanticActs: acts("compare"),
  focusTargetIds: ["attention", "self_regulation"],
}), priorExtraState)
assert.deepEqual(completePairWithPriorExtra.referent, { kind: "active", role: "utterance", turnId: "COMPARE-T04", targetIds: ["self_regulation", "self_control"] })
assert.deepEqual(completePairWithPriorExtra.targetIds, ["attention", "self_regulation"], "a referent's unrequested extra target must not leak into a complete explicit pair")

const unrelatedPair = compileStudentRequestContract("COMPARE-T06", frame({
  semanticActs: acts("compare"),
  focusTargetIds: ["arousal", "sensory_regulation"],
}), compareState)
assert.deepEqual(unrelatedPair.referent, { kind: "none", role: "none", turnId: null, targetIds: [] }, "an unrelated complete comparison pair must not inherit old context")
assert.deepEqual(unrelatedPair.targetIds, ["arousal", "sensory_regulation"])

const retargetedCompareReturn = compileStudentRequestContract("RETURN-T01", frame({
  semanticActs: acts("compare"),
  conversationAction: "return",
  focusTargetIds: ["working_memory"],
  referentTurnId: "RESOLVER-T02",
}), state)
assert.deepEqual(retargetedCompareReturn.referent, {
  kind: "history",
  role: "utterance",
  turnId: "RESOLVER-T02",
  targetIds: ["executive_functions", "inhibition"],
})
assert.deepEqual(retargetedCompareReturn.targetIds, ["working_memory"], "an explicit return target must bind before comparison-side union")

const inheritedCompareReturn = compileStudentRequestContract("RETURN-T02", frame({
  semanticActs: acts("compare"),
  conversationAction: "return",
  referentTurnId: "RESOLVER-T02",
}), state)
assert.deepEqual(inheritedCompareReturn.targetIds, ["executive_functions", "inhibition"], "a target-free return must inherit its referent targets")

let entityState: StudentConversationState = createEmptyStudentConversationState()
const entityDefinition = compileStudentRequestContract("ENTITY-T01", frame({
  semanticActs: acts("define"),
  conversationAction: "start",
  focusTargetIds: ["inhibition"],
}), entityState)
entityState = applyStudentRequestContract(entityState, entityDefinition)
const entityExample = compileStudentRequestContract("ENTITY-T02", frame({
  semanticActs: acts("example"),
  focusTargetIds: ["inhibition"],
  referentTurnId: "ENTITY-T01",
  referentRole: "utterance",
  presentation: { ...presentation, example: "concrete" },
}), entityState)
entityState = applyStudentRequestContract(entityState, entityExample)
const observationAboutEntity = compileStudentRequestContract("ENTITY-T03", frame({
  semanticActs: acts("observe"),
  focusTargetIds: ["inhibition"],
  referentTurnId: "ENTITY-T02",
  referentRole: "case_entity",
}), entityState)
entityState = applyStudentRequestContract(entityState, observationAboutEntity)
assert.deepEqual(entityState.semanticHistory.at(-1)?.referent, {
  kind: "active",
  role: "case_entity",
  turnId: "ENTITY-T02",
  targetIds: ["inhibition"],
}, "each history snapshot must preserve its resolved referent role and turn")

const returnToEntity = compileStudentRequestContract("ENTITY-T04", frame({
  semanticActs: acts("compare"),
  conversationAction: "return",
  focusTargetIds: ["working_memory"],
  referentTurnId: "ENTITY-T03",
  referentRole: "case_entity",
}), entityState)
assert.deepEqual(returnToEntity.referent, {
  kind: "history",
  role: "case_entity",
  turnId: "ENTITY-T02",
  targetIds: ["inhibition"],
}, "returning to the child/example entity must follow the observation chain to its example anchor")
assert.deepEqual(returnToEntity.targetIds, ["working_memory"])

const returnToUtterance = compileStudentRequestContract("ENTITY-T05", frame({
  semanticActs: acts("explain"),
  conversationAction: "return",
  focusTargetIds: ["working_memory"],
  referentTurnId: "ENTITY-T03",
  referentRole: "utterance",
}), entityState)
assert.deepEqual(returnToUtterance.referent, {
  kind: "history",
  role: "utterance",
  turnId: "ENTITY-T03",
  targetIds: ["inhibition"],
}, "returning to the last statement must not collapse to the earlier entity anchor")

const unrelatedEntityCase = compileStudentRequestContract("ENTITY-T06", frame({
  semanticActs: acts("case_reasoning"),
  focusTargetIds: ["coregulation"],
}), entityState)
assert.deepEqual(unrelatedEntityCase.referent, { kind: "none", role: "none", turnId: null, targetIds: [] })

for (let index = 4; index <= 10; index += 1) {
  const filler = compileStudentRequestContract(`ENTITY-T${String(index).padStart(2, "0")}`, frame({
    semanticActs: acts("explain"),
    focusTargetIds: [index % 2 === 0 ? "planning" : "working_memory"],
  }), entityState)
  entityState = applyStudentRequestContract(entityState, filler)
}
assert.equal(entityState.semanticHistory.length, 8, "semantic history must remain bounded to eight turns")
assert.equal(entityState.semanticHistory.some((turn) => turn.turnId === "ENTITY-T02"), false)
assert.equal(entityState.semanticHistory.some((turn) => turn.turnId === "ENTITY-T03"), true)
const truncatedEntityReturn = compileStudentRequestContract("ENTITY-T11", frame({
  semanticActs: acts("explain"),
  conversationAction: "return",
  focusTargetIds: ["working_memory"],
  referentTurnId: "ENTITY-T03",
  referentRole: "case_entity",
}), entityState)
assert.equal(truncatedEntityReturn.referent.turnId, "ENTITY-T03", "a truncated parent anchor must not create a dangling referent outside bounded history")
assert.equal(JSON.stringify(entityState).includes("az önceki çocuğa dönelim"), false, "raw messages must not persist in state")

assert.equal(resolveStudentConversationAction({
  message: "az önceki çocuğa dönelim yönergeyi aklında tutamaması çalışma belleğiyle mi ilgili",
  providerAction: "continue",
  hasHistory: true,
}), "return")
assert.equal(resolveStudentConversationAction({
  message: "çocuk biraz dolaşıp sonra göreve dönüyor bunu nasıl düşünürüz",
  providerAction: "continue",
  hasHistory: true,
}), "continue", "ordinary behavior wording must not be mistaken for a return command")
assert.equal(resolveStudentConversationAction({
  message: "yok dikkat kısmını sormuyorum öz düzenlemeyi soruyorum",
  providerAction: "continue",
  hasHistory: true,
}), "repair")
assert.equal(resolveStudentConversationAction({
  message: "şimdi konuştuklarımızı üç cümlede toparla",
  providerAction: "continue",
  hasHistory: true,
}), "summarize_session")
assert.equal(resolveStudentConversationAction({
  message: "planlama burada nasıl yer alır",
  providerAction: "continue",
  hasHistory: true,
}), "continue")
assert.equal(resolveStudentConversationAction({
  message: "yürütücü işlevler ne demek",
  providerAction: "continue",
  hasHistory: false,
}), "start", "an empty conversation must start even if the provider emits continue")
assert.equal(resolveStudentConversationAction({
  message: "çok akademik oldu bunu öğrenci arkadaşına anlatır gibi yeniden söyle",
  providerAction: "repair",
  hasHistory: true,
  preserveMeaning: true,
}), "continue", "presentation-only correction must not become semantic repair")
assert.equal(resolveStudentConversationAction({
  message: "yok bunu daha basit söyle",
  providerAction: "repair",
  hasHistory: true,
  preserveMeaning: true,
}), "continue", "a style-only yok cue must remain continuation")
assert.equal(resolveStudentConversationAction({
  message: "yok dikkat kısmını sormuyorum çalışma belleğini daha sade anlat",
  providerAction: "continue",
  hasHistory: true,
  preserveMeaning: true,
}), "repair", "explicit semantic target rejection must remain repair even with a style request")
assert.equal(resolveStudentConversationAction({
  message: "ilk anlattığına dönelim daha basit söyle",
  providerAction: "repair",
  hasHistory: true,
  preserveMeaning: true,
}), "return", "explicit return must outrank presentation-only continuation")

console.log(JSON.stringify({
  ok: true,
  gate: "STUDENT_RESOLVER_CONTRASTIVE_LOCAL",
  cases: 46,
  compareOverContextualObserve: true,
  componentExplainOverContextualCase: true,
  pureObservationPreserved: true,
  exampleReferenceDoesNotRequestNewExample: true,
  compareAndExampleActsBothPreserved: true,
  pureCaseReasoningPreserved: true,
  implicitLatestExampleReferent: true,
  compatibleObservationReferent: true,
  unrelatedObservationNoReferentLeak: true,
  compatibleExplanationContinuationReferent: true,
  unrelatedExplanationNoReferentLeak: true,
  explanationContinuationActionBounded: true,
  explicitNewTargetNoReferentLeak: true,
  contextualBehaviorDoesNotBecomeFocus: true,
  explicitBehaviorFocusPreserved: true,
  implicitSimplificationReferent: true,
  treatmentBoundaryPriorityPreserved: true,
  rejectedTargetCannotReenterViaReferent: true,
  rejectedHistoricalTargetPreservedInSummary: true,
  currentTurnRejectionIsRepairOnly: true,
  singleCompareSideCompletedFromReferent: true,
  completeOverlappingCompareAnchoredWithoutExpansion: true,
  priorExtraTargetCannotLeakIntoCompletePair: true,
  unrelatedComparisonPairNoReferentLeak: true,
  explicitReturnTargetPrecedesCompareUnion: true,
  targetFreeReturnInheritsReferent: true,
  historySnapshotsPreserveReferentRole: true,
  caseEntityChainCollapsesToExampleAnchor: true,
  utteranceReturnDoesNotCollapse: true,
  unrelatedCaseNoEntityLeak: true,
  historyBoundedToEightTurns: true,
  truncatedEntityChainNoDanglingPointer: true,
  rawMessagesPersisted: 0,
  explicitReturnCueOverridesProvider: true,
  ordinaryBehaviorDoesNotFalseReturn: true,
  explicitRepairCueOverridesProvider: true,
  explicitSummaryCueOverridesProvider: true,
  ordinaryContinuePreserved: true,
  emptyStateForcesStart: true,
  presentationOnlyCorrectionContinues: true,
  styleOnlyNoCueContinues: true,
  semanticRejectionStillRepairs: true,
  returnStillOutranksStyle: true,
}, null, 2))

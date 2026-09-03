import assert from "node:assert/strict"

import {
  applyStudentRequestContract,
  compileStudentRequestContract,
  compileStudentAnswerObligations,
  createEmptyStudentConversationState,
  validateStudentSemanticFrameDetailed,
  type StudentObligationCompilationInput,
} from "../src/lib/dna/chat/studentFirst"

const base: StudentObligationCompilationInput = Object.freeze({
  semanticTask: "define",
  requestedSemanticTasks: Object.freeze(["define"] as const),
  conversationAction: "start",
  targetIds: Object.freeze(["executive_functions"]),
  rejectedTargetIds: Object.freeze([]),
  comparisonTargetIds: Object.freeze([]),
  componentTargetIds: Object.freeze([]),
  historyAnchorRequired: false,
  presentation: Object.freeze({
    depth: "standard",
    language: "standard",
    format: "prose",
    example: "none",
    exampleScope: "independent",
    grouping: "integrated",
    requestedSentenceCount: null,
    preserveMeaning: false,
  }),
  summaryScope: Object.freeze({ known: false, unknown: false, observationFocus: false }),
  observationScope: Object.freeze({ singleObservationLimit: false, additionalContext: false }),
})

function kinds(input: StudentObligationCompilationInput): string[] {
  return compileStudentAnswerObligations("COMPILER-T01", input).map((row) => row.kind)
}

assert.deepEqual(kinds(base), ["define_target"])

assert.deepEqual(kinds({
  ...base,
  requestedSemanticTasks: ["define", "explain"],
}), ["define_target"], "co-occurring definition and explanation acts must compile one compatible duty")

assert.deepEqual(kinds({
  ...base,
  semanticTask: "compare",
  requestedSemanticTasks: ["compare"],
  conversationAction: "continue",
  targetIds: ["executive_functions", "inhibition"],
  comparisonTargetIds: ["executive_functions", "inhibition"],
}), ["distinguish_targets", "explain_relation"], "active comparison must not invent history/component obligations")

assert.deepEqual(kinds({
  ...base,
  semanticTask: "define",
  requestedSemanticTasks: ["define"],
  conversationAction: "return",
  presentation: { ...base.presentation, language: "plain_student", preserveMeaning: true },
}), ["define_target", "use_history_anchor", "preserve_target_while_simplifying"])

assert.deepEqual(kinds({
  ...base,
  semanticTask: "summarize",
  requestedSemanticTasks: ["summarize"],
  conversationAction: "summarize_session",
  targetIds: ["executive_functions", "inhibition", "working_memory", "planning"],
  summaryScope: { known: true, unknown: true, observationFocus: true },
}), ["summarize_known", "summarize_unknown", "summarize_observation_focus"])

assert.deepEqual(kinds({
  ...base,
  semanticTask: "compare",
  requestedSemanticTasks: ["compare", "observe"],
  conversationAction: "continue",
  targetIds: ["arousal", "sensory_regulation"],
  comparisonTargetIds: ["arousal", "sensory_regulation"],
  observationScope: { singleObservationLimit: true, additionalContext: true },
}), ["distinguish_targets", "explain_relation", "state_single_observation_limit", "name_additional_context"])

assert.deepEqual(kinds({
  ...base,
  semanticTask: "compare",
  requestedSemanticTasks: ["compare"],
  conversationAction: "return",
  targetIds: ["arousal"],
  comparisonTargetIds: ["arousal"],
  historyAnchorRequired: true,
  observationScope: { singleObservationLimit: false, additionalContext: false, withinTargetStateContrast: true },
}), ["contrast_target_states", "state_context_dependency", "use_history_anchor"])

assert.deepEqual(kinds({
  ...base,
  semanticTask: "explain",
  requestedSemanticTasks: ["explain"],
  conversationAction: "continue",
  targetIds: ["planning", "inhibition", "emotion_regulation"],
  componentTargetIds: ["planning", "inhibition", "emotion_regulation"],
  historyAnchorRequired: true,
}), ["define_target", "use_history_anchor", "cover_requested_component", "cover_requested_component", "cover_requested_component"])

assert.deepEqual(kinds({
  ...base,
  semanticTask: "compare",
  requestedSemanticTasks: ["compare", "example"],
  conversationAction: "continue",
  targetIds: ["planning", "working_memory"],
  comparisonTargetIds: ["planning", "working_memory"],
  presentation: { ...base.presentation, example: "brief" },
}), ["distinguish_targets", "explain_relation", "give_concrete_example", "bind_example_to_target"])

assert.deepEqual(kinds({
  ...base,
  semanticTask: "compare",
  requestedSemanticTasks: ["compare", "example"],
  conversationAction: "continue",
  targetIds: ["planning", "working_memory"],
  comparisonTargetIds: ["planning", "working_memory"],
  presentation: { ...base.presentation, example: "brief", exampleScope: "shared" },
}), ["distinguish_targets", "explain_relation", "give_concrete_example", "bind_example_to_target", "use_shared_scenario"])

assert.deepEqual(kinds({
  ...base,
  semanticTask: "example",
  requestedSemanticTasks: ["example"],
  conversationAction: "continue",
  targetIds: ["inhibition"],
  presentation: { ...base.presentation, example: "concrete" },
}), ["give_concrete_example", "bind_example_to_target"], "example obligation must be deduplicated")

assert.deepEqual(kinds({
  ...base,
  semanticTask: "observe",
  requestedSemanticTasks: ["explain", "observe"],
  conversationAction: "continue",
  presentation: { ...base.presentation, example: "concrete" },
  observationScope: { singleObservationLimit: true, additionalContext: true },
}), ["state_single_observation_limit", "name_additional_context"], "a generic explanation act or presentation facet must not expand an observation-primary duty")

assert.deepEqual(kinds({
  ...base,
  semanticTask: "summarize",
  requestedSemanticTasks: ["explain", "summarize"],
  conversationAction: "summarize_session",
  summaryScope: { known: true, unknown: false, observationFocus: false },
}), ["summarize_known"], "summary must remain a terminal obligation family")

assert.deepEqual(kinds({
  ...base,
  semanticTask: "treatment_boundary",
  requestedSemanticTasks: ["explain", "treatment_boundary"],
}), ["refuse_treatment_selection", "offer_safe_assessment_frame"], "treatment boundary must remain a terminal obligation family")

assert.deepEqual(kinds({
  ...base,
  semanticTask: "compare",
  requestedSemanticTasks: [],
  conversationAction: "continue",
  targetIds: ["planning", "working_memory"],
  comparisonTargetIds: ["planning", "working_memory"],
  presentation: { ...base.presentation, language: "plain_student", preserveMeaning: true },
}), ["preserve_target_while_simplifying"], "presentation-only continuation must not recreate content duties")

const actionCompatibilityMatrix: readonly Readonly<{
  name: string
  input: StudentObligationCompilationInput
  expected: readonly string[]
}>[] = Object.freeze([
  {
    name: "start definition",
    input: { ...base, requestedSemanticTasks: ["define", "explain"] },
    expected: ["define_target"],
  },
  {
    name: "continue presentation only",
    input: {
      ...base,
      semanticTask: "compare",
      requestedSemanticTasks: [],
      conversationAction: "continue",
      comparisonTargetIds: ["planning", "working_memory"],
      presentation: { ...base.presentation, preserveMeaning: true },
    },
    expected: ["preserve_target_while_simplifying"],
  },
  {
    name: "return and restate inherited definition",
    input: {
      ...base,
      requestedSemanticTasks: [],
      conversationAction: "return",
      presentation: { ...base.presentation, preserveMeaning: true },
    },
    expected: ["define_target", "use_history_anchor", "preserve_target_while_simplifying"],
  },
  {
    name: "repair replacement definition",
    input: {
      ...base,
      requestedSemanticTasks: ["define", "explain"],
      conversationAction: "repair",
      rejectedTargetIds: ["inhibition"],
    },
    expected: ["define_target", "honor_rejected_target"],
  },
  {
    name: "compare and example",
    input: {
      ...base,
      semanticTask: "compare",
      requestedSemanticTasks: ["compare", "example"],
      conversationAction: "continue",
      targetIds: ["planning", "working_memory"],
      comparisonTargetIds: ["planning", "working_memory"],
      presentation: { ...base.presentation, example: "concrete" },
    },
    expected: ["distinguish_targets", "explain_relation", "give_concrete_example", "bind_example_to_target"],
  },
  {
    name: "observation and supporting explanation",
    input: {
      ...base,
      semanticTask: "observe",
      requestedSemanticTasks: ["explain", "observe"],
      conversationAction: "continue",
      observationScope: { singleObservationLimit: true, additionalContext: true },
    },
    expected: ["state_single_observation_limit", "name_additional_context"],
  },
  {
    name: "terminal summary",
    input: {
      ...base,
      semanticTask: "summarize",
      requestedSemanticTasks: ["explain", "summarize"],
      conversationAction: "summarize_session",
      summaryScope: { known: true, unknown: true, observationFocus: true },
    },
    expected: ["summarize_known", "summarize_unknown", "summarize_observation_focus"],
  },
  {
    name: "terminal treatment boundary",
    input: {
      ...base,
      semanticTask: "treatment_boundary",
      requestedSemanticTasks: ["explain", "treatment_boundary"],
      conversationAction: "continue",
    },
    expected: ["refuse_treatment_selection", "offer_safe_assessment_frame"],
  },
])

for (const row of actionCompatibilityMatrix) {
  assert.deepEqual(kinds(row.input), row.expected, row.name)
}

const semanticActs = (...enabled: readonly string[]) => Object.freeze({
  define: enabled.includes("define"),
  explain: enabled.includes("explain"),
  compare: enabled.includes("compare"),
  example: enabled.includes("example"),
  case_reasoning: enabled.includes("case_reasoning"),
  summarize: enabled.includes("summarize"),
  observe: enabled.includes("observe"),
  evidence: enabled.includes("evidence"),
  treatment_boundary: enabled.includes("treatment_boundary"),
})

const emptyState = createEmptyStudentConversationState()
const startFrame = {
  semanticActs: semanticActs("define", "explain"),
  conversationAction: "start",
  focusTargetIds: ["executive_functions"],
  contextTargetIds: [],
  rejectedTargetIds: [],
  referentTurnId: null,
  referentRole: "none",
  presentation: { ...base.presentation, grouping: "integrated" },
  summaryExtras: { unknown: false, observationFocus: false },
  observationExtras: { singleObservationLimit: false, additionalContext: false },
}
const startValidation = validateStudentSemanticFrameDetailed(startFrame, emptyState)
if (!startValidation.ok) throw new Error(startValidation.failureCode)
const startContract = compileStudentRequestContract("GROUPING-T01", startValidation.frame, emptyState)
assert.equal(startContract.semanticTask, "define")
assert.deepEqual(startContract.requestedSemanticTasks, ["define", "explain"])
const activeState = applyStudentRequestContract(emptyState, startContract)

const integratedValidation = validateStudentSemanticFrameDetailed({
  ...startFrame,
  semanticActs: semanticActs("compare"),
  conversationAction: "continue",
  focusTargetIds: ["inhibition"],
  referentTurnId: "GROUPING-T01",
  referentRole: "utterance",
}, activeState)
if (!integratedValidation.ok) throw new Error(integratedValidation.failureCode)
const integratedContract = compileStudentRequestContract("GROUPING-T02", integratedValidation.frame, activeState)
assert.deepEqual(integratedContract.targetIds, ["executive_functions", "inhibition"])
assert.deepEqual(integratedContract.comparisonTargetIds, ["executive_functions", "inhibition"])
assert.deepEqual(integratedContract.referent, { kind: "active", role: "utterance", turnId: "GROUPING-T01", targetIds: ["executive_functions"] })
assert.deepEqual(integratedContract.componentTargetIds, [])
assert.deepEqual(integratedContract.obligations.map((row) => row.kind), ["distinguish_targets", "explain_relation"])
const comparisonState = applyStudentRequestContract(activeState, integratedContract)

const presentationOnlyValidation = validateStudentSemanticFrameDetailed({
  ...startFrame,
  semanticActs: semanticActs(),
  conversationAction: "continue",
  focusTargetIds: [],
  referentTurnId: "GROUPING-T02",
  referentRole: "utterance",
  presentation: { ...base.presentation, language: "plain_student", preserveMeaning: true },
}, comparisonState)
if (!presentationOnlyValidation.ok) throw new Error(presentationOnlyValidation.failureCode)
const presentationOnlyContract = compileStudentRequestContract("GROUPING-T02B", presentationOnlyValidation.frame, comparisonState)
assert.equal(presentationOnlyContract.semanticTask, "compare", "presentation-only continuation must inherit its referenced scientific task")
assert.deepEqual(presentationOnlyContract.requestedSemanticTasks, [], "presentation-only continuation must not invent a scientific act")
assert.deepEqual(presentationOnlyContract.targetIds, ["executive_functions", "inhibition"])
assert.deepEqual(presentationOnlyContract.obligations.map((row) => row.kind), ["preserve_target_while_simplifying"])

const presentationReturnValidation = validateStudentSemanticFrameDetailed({
  ...startFrame,
  semanticActs: semanticActs(),
  conversationAction: "return",
  focusTargetIds: [],
  contextTargetIds: [],
  referentTurnId: "GROUPING-T01",
  referentRole: "utterance",
  presentation: { ...base.presentation, language: "plain_student", preserveMeaning: true },
}, comparisonState)
if (!presentationReturnValidation.ok) throw new Error(presentationReturnValidation.failureCode)
const presentationReturnContract = compileStudentRequestContract("GROUPING-T02C", presentationReturnValidation.frame, comparisonState)
assert.equal(presentationReturnContract.semanticTask, "define")
assert.deepEqual(presentationReturnContract.requestedSemanticTasks, [])
assert.deepEqual(presentationReturnContract.obligations.map((row) => row.kind), [
  "define_target",
  "use_history_anchor",
  "preserve_target_while_simplifying",
])

assert.deepEqual(validateStudentSemanticFrameDetailed({
  ...startFrame,
  semanticActs: semanticActs(),
  conversationAction: "continue",
  presentation: { ...base.presentation, preserveMeaning: false },
}, comparisonState), { ok: false, failureCode: "invalid_semantic_acts" })

assert.deepEqual(validateStudentSemanticFrameDetailed({
  ...startFrame,
  semanticActs: semanticActs(),
  conversationAction: "start",
  presentation: { ...base.presentation, preserveMeaning: true },
}, emptyState), { ok: false, failureCode: "invalid_semantic_acts" })

const returnValidation = validateStudentSemanticFrameDetailed({
  ...startFrame,
  semanticActs: semanticActs("explain"),
  conversationAction: "return",
  focusTargetIds: ["executive_functions"],
  referentTurnId: "GROUPING-T01",
  referentRole: "utterance",
  presentation: { ...base.presentation, language: "plain_student", preserveMeaning: true },
}, comparisonState)
if (!returnValidation.ok) throw new Error(returnValidation.failureCode)
const returnContract = compileStudentRequestContract("GROUPING-T03", returnValidation.frame, comparisonState)
assert.equal(returnContract.semanticTask, "define")
assert.deepEqual(returnContract.targetIds, ["executive_functions"])
assert.deepEqual(returnContract.referent, { kind: "history", role: "utterance", turnId: "GROUPING-T01", targetIds: ["executive_functions"] })
assert.deepEqual(returnContract.obligations.map((row) => row.kind), [
  "define_target",
  "use_history_anchor",
  "preserve_target_while_simplifying",
])

const retargetedReturnValidation = validateStudentSemanticFrameDetailed({
  ...startFrame,
  semanticActs: semanticActs("explain"),
  conversationAction: "return",
  focusTargetIds: ["working_memory"],
  referentTurnId: "GROUPING-T01",
  referentRole: "utterance",
}, comparisonState)
if (!retargetedReturnValidation.ok) throw new Error(retargetedReturnValidation.failureCode)
const retargetedReturnContract = compileStudentRequestContract("GROUPING-T03B", retargetedReturnValidation.frame, comparisonState)
assert.deepEqual(retargetedReturnContract.targetIds, ["working_memory"], "an explicit return target must not absorb the referent turn's semantic target")
assert.deepEqual(retargetedReturnContract.referent, { kind: "history", role: "utterance", turnId: "GROUPING-T01", targetIds: ["executive_functions"] })

const repairValidation = validateStudentSemanticFrameDetailed({
  ...startFrame,
  semanticActs: semanticActs("define", "explain"),
  conversationAction: "repair",
  focusTargetIds: ["inhibition", "working_memory"],
  rejectedTargetIds: ["inhibition"],
}, comparisonState)
if (!repairValidation.ok) throw new Error(repairValidation.failureCode)
const repairContract = compileStudentRequestContract("GROUPING-T04", repairValidation.frame, comparisonState)
assert.equal(repairContract.semanticTask, "define")
assert.deepEqual(repairContract.targetIds, ["working_memory"])
assert.deepEqual(repairContract.obligations.map((row) => row.kind), ["define_target", "honor_rejected_target"])

const summaryValidation = validateStudentSemanticFrameDetailed({
  ...startFrame,
  semanticActs: semanticActs("summarize"),
  conversationAction: "summarize_session",
  focusTargetIds: [],
  summaryExtras: { unknown: true, observationFocus: true },
}, comparisonState)
if (!summaryValidation.ok) throw new Error(summaryValidation.failureCode)
const summaryContract = compileStudentRequestContract("GROUPING-T05", summaryValidation.frame, comparisonState)
assert.deepEqual(summaryContract.targetIds, ["executive_functions", "inhibition"])
assert.deepEqual(summaryContract.obligations.map((row) => row.kind), [
  "summarize_known",
  "summarize_unknown",
  "summarize_observation_focus",
])

const observeValidation = validateStudentSemanticFrameDetailed({
  ...startFrame,
  semanticActs: semanticActs("observe", "case_reasoning"),
  conversationAction: "continue",
  focusTargetIds: ["inhibition"],
  referentTurnId: "GROUPING-T02",
  referentRole: "case_entity",
  summaryExtras: { unknown: true, observationFocus: true },
  observationExtras: { singleObservationLimit: false, additionalContext: false },
}, comparisonState)
if (!observeValidation.ok) throw new Error(observeValidation.failureCode)
const observeContract = compileStudentRequestContract("GROUPING-T06", observeValidation.frame, comparisonState)
assert.deepEqual(observeContract.requestedSemanticTasks, ["case_reasoning", "observe"])
assert.deepEqual(observeContract.summaryScope, { known: false, unknown: false, observationFocus: false })
assert.deepEqual(observeContract.observationScope, { singleObservationLimit: true, additionalContext: true })
assert.deepEqual(observeContract.obligations.map((row) => row.kind), [
  "state_single_observation_limit",
  "name_additional_context",
])

const separateValidation = validateStudentSemanticFrameDetailed({
  ...startFrame,
  semanticActs: semanticActs("explain"),
  focusTargetIds: ["planning", "inhibition", "emotion_regulation"],
  presentation: { ...base.presentation, grouping: "separate_each" },
}, emptyState)
if (!separateValidation.ok) throw new Error(separateValidation.failureCode)
const separateContract = compileStudentRequestContract("GROUPING-T07", separateValidation.frame, emptyState)
assert.deepEqual(separateContract.componentTargetIds, ["planning", "inhibition", "emotion_regulation"])
assert.deepEqual(separateContract.obligations.map((row) => row.kind), [
  "define_target",
  "cover_requested_component",
  "cover_requested_component",
  "cover_requested_component",
])

console.log(JSON.stringify({
  ok: true,
  gate: "STUDENT_OBLIGATION_COMPILER_LOCAL",
  cases: 33,
  actionCompatibilityMatrixCases: actionCompatibilityMatrix.length,
  providerOwnsFinalObligations: false,
  deterministicCompilation: true,
  duplicateObligations: 0,
}, null, 2))

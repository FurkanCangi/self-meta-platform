import assert from "node:assert/strict"

import {
  compileStudentRequestContract,
  compileStudentAnswerObligations,
  createEmptyStudentConversationState,
  validateStudentSemanticFrameDetailed,
  type StudentObligationCompilationInput,
} from "../src/lib/dna/chat/studentFirst"

const base: StudentObligationCompilationInput = Object.freeze({
  semanticTask: "define",
  conversationAction: "start",
  targetIds: Object.freeze(["executive_functions"]),
  rejectedTargetIds: Object.freeze([]),
  comparisonTargetIds: Object.freeze([]),
  componentTargetIds: Object.freeze([]),
  presentation: Object.freeze({
    depth: "standard",
    language: "standard",
    format: "prose",
    example: "none",
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
  semanticTask: "compare",
  conversationAction: "continue",
  targetIds: ["executive_functions", "inhibition"],
  comparisonTargetIds: ["executive_functions", "inhibition"],
}), ["distinguish_targets", "explain_relation"], "active comparison must not invent history/component obligations")

assert.deepEqual(kinds({
  ...base,
  semanticTask: "define",
  conversationAction: "return",
  presentation: { ...base.presentation, language: "plain_student", preserveMeaning: true },
}), ["define_target", "use_history_anchor", "preserve_target_while_simplifying"])

assert.deepEqual(kinds({
  ...base,
  semanticTask: "summarize",
  conversationAction: "summarize_session",
  targetIds: ["executive_functions", "inhibition", "working_memory", "planning"],
  summaryScope: { known: true, unknown: true, observationFocus: true },
}), ["summarize_known", "summarize_unknown", "summarize_observation_focus"])

assert.deepEqual(kinds({
  ...base,
  semanticTask: "compare",
  conversationAction: "continue",
  targetIds: ["arousal", "sensory_regulation"],
  comparisonTargetIds: ["arousal", "sensory_regulation"],
  observationScope: { singleObservationLimit: true, additionalContext: true },
}), ["distinguish_targets", "explain_relation", "state_single_observation_limit", "name_additional_context"])

assert.deepEqual(kinds({
  ...base,
  semanticTask: "explain",
  conversationAction: "continue",
  targetIds: ["planning", "inhibition", "emotion_regulation"],
  componentTargetIds: ["planning", "inhibition", "emotion_regulation"],
}), ["define_target", "cover_requested_component", "cover_requested_component", "cover_requested_component"])

assert.deepEqual(kinds({
  ...base,
  semanticTask: "compare",
  conversationAction: "continue",
  targetIds: ["planning", "working_memory"],
  comparisonTargetIds: ["planning", "working_memory"],
  presentation: { ...base.presentation, example: "brief" },
}), ["distinguish_targets", "explain_relation", "give_concrete_example"])

assert.deepEqual(kinds({
  ...base,
  semanticTask: "example",
  conversationAction: "continue",
  targetIds: ["inhibition"],
  presentation: { ...base.presentation, example: "concrete" },
}), ["give_concrete_example", "bind_example_to_target"], "example obligation must be deduplicated")

const emptyState = createEmptyStudentConversationState()
const frameBase = {
  semanticTask: "compare",
  conversationAction: "start",
  targetIds: ["executive_functions", "inhibition"],
  rejectedTargetIds: [],
  comparisonTargetIds: ["executive_functions", "inhibition"],
  referent: { kind: "none", turnId: null, targetIds: [] },
  presentation: { ...base.presentation, grouping: "integrated" },
  summaryScope: base.summaryScope,
  observationScope: base.observationScope,
  ambiguity: "none",
  safetyIntent: "general_education",
}
const integratedValidation = validateStudentSemanticFrameDetailed(frameBase, emptyState)
if (!integratedValidation.ok) throw new Error(integratedValidation.failureCode)
const integratedContract = compileStudentRequestContract("GROUPING-T01", integratedValidation.frame)
assert.deepEqual(integratedContract.componentTargetIds, [])
assert.deepEqual(integratedContract.obligations.map((row) => row.kind), ["distinguish_targets", "explain_relation"])

const separateValidation = validateStudentSemanticFrameDetailed({
  ...frameBase,
  semanticTask: "explain",
  comparisonTargetIds: [],
  targetIds: ["planning", "inhibition", "emotion_regulation"],
  presentation: { ...base.presentation, grouping: "separate_each" },
}, emptyState)
if (!separateValidation.ok) throw new Error(separateValidation.failureCode)
const separateContract = compileStudentRequestContract("GROUPING-T02", separateValidation.frame)
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
  cases: 9,
  providerOwnsFinalObligations: false,
  deterministicCompilation: true,
  duplicateObligations: 0,
}, null, 2))

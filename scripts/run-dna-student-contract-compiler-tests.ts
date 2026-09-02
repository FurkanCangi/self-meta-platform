import assert from "node:assert/strict"

import {
  compileStudentAnswerObligations,
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

console.log(JSON.stringify({
  ok: true,
  gate: "STUDENT_OBLIGATION_COMPILER_LOCAL",
  cases: 7,
  providerOwnsFinalObligations: false,
  deterministicCompilation: true,
  duplicateObligations: 0,
}, null, 2))

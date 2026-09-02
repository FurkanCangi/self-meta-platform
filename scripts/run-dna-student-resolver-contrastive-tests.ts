import assert from "node:assert/strict"

import {
  applyStudentRequestContract,
  compileStudentRequestContract,
  createEmptyStudentConversationState,
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
    mentionedTargetIds: Object.freeze([...(input.mentionedTargetIds ?? [])]),
    rejectedTargetIds: Object.freeze([...(input.rejectedTargetIds ?? [])]),
    referentTurnId: input.referentTurnId ?? null,
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
  mentionedTargetIds: ["executive_functions"],
}), state)
state = applyStudentRequestContract(state, start)
const comparison = compileStudentRequestContract("RESOLVER-T02", frame({
  semanticActs: acts("compare", "observe"),
  mentionedTargetIds: ["inhibition"],
  referentTurnId: "RESOLVER-T01",
  observationExtras: { singleObservationLimit: true, additionalContext: true },
}), state)
assert.equal(comparison.semanticTask, "compare", "explicit comparison must outrank contextual observation")
assert.deepEqual(comparison.targetIds, ["executive_functions", "inhibition"])
assert.deepEqual(kinds(comparison), ["distinguish_targets", "explain_relation", "state_single_observation_limit", "name_additional_context"])
state = applyStudentRequestContract(state, comparison)

const pureObservation = compileStudentRequestContract("RESOLVER-T03", frame({
  semanticActs: acts("observe"),
  mentionedTargetIds: ["inhibition"],
}), state)
assert.equal(pureObservation.semanticTask, "observe", "observation-only requests must remain observation")
assert.deepEqual(kinds(pureObservation), ["state_single_observation_limit", "name_additional_context"])

const componentExplanation = compileStudentRequestContract("RESOLVER-T04", frame({
  semanticActs: acts("case_reasoning"),
  mentionedTargetIds: ["planning", "inhibition", "emotion_regulation"],
  presentation: { ...presentation, grouping: "separate_each" },
}), state)
assert.equal(componentExplanation.semanticTask, "explain", "explicit component-wise grouping must outrank contextual case framing")
assert.deepEqual(componentExplanation.componentTargetIds, ["planning", "inhibition", "emotion_regulation"])
assert.deepEqual(kinds(componentExplanation), ["define_target", "cover_requested_component", "cover_requested_component", "cover_requested_component"])

const pureCase = compileStudentRequestContract("RESOLVER-T05", frame({
  semanticActs: acts("case_reasoning"),
  mentionedTargetIds: ["inhibition"],
}), state)
assert.equal(pureCase.semanticTask, "case_reasoning", "case-only inference limits must remain case reasoning")
assert.deepEqual(kinds(pureCase), ["state_single_observation_limit", "name_additional_context"])

const implicitExample = compileStudentRequestContract("RESOLVER-T06", frame({
  semanticActs: acts("example"),
  presentation: { ...presentation, example: "concrete" },
}), state)
assert.equal(implicitExample.semanticTask, "example")
assert.deepEqual(implicitExample.referent, { kind: "active", turnId: "RESOLVER-T02", targetIds: ["executive_functions", "inhibition"] })
assert.deepEqual(implicitExample.targetIds, ["executive_functions", "inhibition"])
assert.deepEqual(kinds(implicitExample), ["give_concrete_example", "bind_example_to_target"])

const explicitExample = compileStudentRequestContract("RESOLVER-T07", frame({
  semanticActs: acts("example"),
  mentionedTargetIds: ["coregulation"],
  presentation: { ...presentation, example: "concrete" },
}), state)
assert.deepEqual(explicitExample.referent, { kind: "none", turnId: null, targetIds: [] }, "an explicit new example target must not inherit an unrelated referent")
assert.deepEqual(explicitExample.targetIds, ["coregulation"])

const implicitSimplification = compileStudentRequestContract("RESOLVER-T08", frame({
  semanticActs: acts("explain"),
  presentation: { ...presentation, language: "plain_student", preserveMeaning: true },
}), state)
assert.deepEqual(implicitSimplification.referent, { kind: "active", turnId: "RESOLVER-T02", targetIds: ["executive_functions", "inhibition"] })
assert.deepEqual(implicitSimplification.targetIds, ["executive_functions", "inhibition"])
assert.ok(kinds(implicitSimplification).includes("preserve_target_while_simplifying"))

const treatmentBoundary = compileStudentRequestContract("RESOLVER-T09", frame({
  semanticActs: acts("treatment_boundary", "explain"),
  mentionedTargetIds: ["interoception"],
  presentation: { ...presentation, grouping: "separate_each" },
}), state)
assert.equal(treatmentBoundary.semanticTask, "treatment_boundary", "treatment safety must outrank discourse presentation")
assert.equal(treatmentBoundary.safetyIntent, "treatment_selection")
assert.deepEqual(kinds(treatmentBoundary), ["refuse_treatment_selection", "offer_safe_assessment_frame"])

console.log(JSON.stringify({
  ok: true,
  gate: "STUDENT_RESOLVER_CONTRASTIVE_LOCAL",
  cases: 8,
  compareOverContextualObserve: true,
  componentExplainOverContextualCase: true,
  pureObservationPreserved: true,
  pureCaseReasoningPreserved: true,
  implicitLatestExampleReferent: true,
  explicitNewTargetNoReferentLeak: true,
  implicitSimplificationReferent: true,
  treatmentBoundaryPriorityPreserved: true,
}, null, 2))

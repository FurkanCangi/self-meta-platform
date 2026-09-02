import assert from "node:assert/strict"

import {
  applyStudentRequestContract,
  buildDeterministicStudentClosedSlotChoice,
  buildStudentStateCandidateEnvelope,
  createEmptyStudentConversationState,
  interpretStudentRequest,
  observeStudentRequestFacts,
  resolveStudentEvidenceFirstRequest,
  studentClosedSlotChoiceSchema,
  validateStudentClosedSlotChoice,
  type StudentConversationState,
} from "../src/lib/dna/chat/studentFirst"

const HARNESS_VERSION = "dna-student-evidence-first-closed-slot@1" as const

function append(state: StudentConversationState, turnId: string, message: string): StudentConversationState {
  return applyStudentRequestContract(state, interpretStudentRequest({ turnId, message, state }))
}

function hasKey(value: unknown, key: string): boolean {
  if (Array.isArray(value)) return value.some((item) => hasKey(item, key))
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return Object.prototype.hasOwnProperty.call(row, key) || Object.values(row).some((item) => hasKey(item, key))
}

let state = createEmptyStudentConversationState()
state = append(state, "B1-SLOT-T01", "eş düzenleme ne demek")
state = append(state, "B1-SLOT-T02", "yok arousal kısmını sormuyorum eş düzenleme tarafını soruyorum")
const treatmentMessage = "bu çocuğa hemen bağımsız olsun diye hangi terapiyi uygulayayım"
const facts = observeStudentRequestFacts({ turnId: "B1-SLOT-T03", message: treatmentMessage, state })
const envelope = buildStudentStateCandidateEnvelope({ facts, state })
const deterministic = buildDeterministicStudentClosedSlotChoice({ facts, envelope })
assert.deepEqual(deterministic, {
  primaryTask: "treatment_boundary",
  focusTargetIds: ["coregulation"],
  referentTurnId: null,
})
assert.equal(validateStudentClosedSlotChoice(deterministic, facts, envelope).ok, true)

const inventedTarget = validateStudentClosedSlotChoice({
  ...deterministic,
  focusTargetIds: ["coregulation", "self_regulation"],
}, facts, envelope)
assert.deepEqual(inventedTarget, { ok: false, failureCode: "invalid_focus_targets" })

const omittedRequiredTarget = validateStudentClosedSlotChoice({
  ...deterministic,
  focusTargetIds: [],
}, facts, envelope)
assert.deepEqual(omittedRequiredTarget, { ok: false, failureCode: "focus_target_set_mismatch" })

const duplicateTarget = validateStudentClosedSlotChoice({
  ...deterministic,
  focusTargetIds: ["coregulation", "coregulation"],
}, facts, envelope)
assert.deepEqual(duplicateTarget, { ok: false, failureCode: "invalid_focus_targets" })

const inventedReferent = validateStudentClosedSlotChoice({
  ...deterministic,
  referentTurnId: "B1-SLOT-NOT-ALLOWED",
}, facts, envelope)
assert.deepEqual(inventedReferent, { ok: false, failureCode: "invalid_referent" })

const inventedTask = validateStudentClosedSlotChoice({
  ...deterministic,
  primaryTask: "define",
}, facts, envelope)
assert.deepEqual(inventedTask, { ok: false, failureCode: "invalid_primary_task" })

const schema = studentClosedSlotChoiceSchema(facts, envelope)
assert.equal(hasKey(schema, "conversationAction"), false, "provider must not own conversation action")
assert.equal(hasKey(schema, "safetyIntent"), false, "provider must not own safety intent")
assert.equal(hasKey(schema, "contextTargetIds"), false, "provider must not author context targets")
assert.equal(JSON.stringify(schema).includes("self_regulation"), false, "out-of-envelope target must not enter schema")

const resolvedTreatment = resolveStudentEvidenceFirstRequest({
  turnId: "B1-SLOT-T03",
  message: treatmentMessage,
  state,
})
if (!resolvedTreatment.ok) throw new Error(`expected resolved treatment, received ${resolvedTreatment.reason}`)
assert.equal(resolvedTreatment.contract.semanticTask, "treatment_boundary")
assert.deepEqual(resolvedTreatment.contract.targetIds, ["coregulation"])
assert.equal(resolvedTreatment.contract.referent.turnId, null)
assert.deepEqual(resolvedTreatment.contract.obligations.map((row) => row.kind), [
  "refuse_treatment_selection",
  "offer_safe_assessment_frame",
])

let ambiguousState = createEmptyStudentConversationState()
ambiguousState = append(ambiguousState, "B1-AMB-T01", "öz düzenleme ne demek")
ambiguousState = append(ambiguousState, "B1-AMB-T02", "dikkat ne demek")
const ambiguousFacts = observeStudentRequestFacts({
  turnId: "B1-AMB-T03",
  message: "konulardan birine geri dönelim",
  state: ambiguousState,
})
const ambiguousEnvelope = buildStudentStateCandidateEnvelope({ facts: ambiguousFacts, state: ambiguousState })
assert.equal(ambiguousEnvelope.referentCandidates.length, 2)
assert.equal(buildDeterministicStudentClosedSlotChoice({ facts: ambiguousFacts, envelope: ambiguousEnvelope }), null)
const ambiguousResolution = resolveStudentEvidenceFirstRequest({
  turnId: "B1-AMB-T03",
  message: "konulardan birine geri dönelim",
  state: ambiguousState,
})
assert.equal(ambiguousResolution.ok, false)
if (ambiguousResolution.ok || ambiguousResolution.reason !== "closed_slot_failure") throw new Error("expected typed ambiguity")
assert.equal(ambiguousResolution.failureCode, "referent_choice_required")

const chosenResolution = resolveStudentEvidenceFirstRequest({
  turnId: "B1-AMB-T03",
  message: "konulardan birine geri dönelim",
  state: ambiguousState,
  choice: {
    primaryTask: "explain",
    focusTargetIds: ["attention"],
    referentTurnId: "B1-AMB-T01",
  },
})
assert.equal(chosenResolution.ok, false, "target and referent choices must remain mutually coherent")

const coherentResolution = resolveStudentEvidenceFirstRequest({
  turnId: "B1-AMB-T03",
  message: "konulardan birine geri dönelim",
  state: ambiguousState,
  choice: {
    primaryTask: "explain",
    focusTargetIds: ["self_regulation"],
    referentTurnId: "B1-AMB-T01",
  },
})
assert.equal(coherentResolution.ok, true, "one closed coherent ambiguity choice must resolve")
if (!coherentResolution.ok) throw new Error("expected coherent closed choice")
assert.deepEqual(coherentResolution.contract.targetIds, ["self_regulation"])
assert.equal(coherentResolution.contract.referent.turnId, "B1-AMB-T01")

const diagnosis = resolveStudentEvidenceFirstRequest({
  turnId: "B1-DIAG-T01",
  message: "bu çocuğun tanısı ne",
  state: createEmptyStudentConversationState(),
})
assert.equal(diagnosis.ok, false)
if (diagnosis.ok) throw new Error("diagnosis request must fail closed")
assert.equal(diagnosis.reason, "diagnosis_contract_pending")

console.log(JSON.stringify({
  ok: true,
  gate: "STUDENT_EVIDENCE_FIRST_R2_CLOSED_SLOT_LOCAL",
  version: HARNESS_VERSION,
  providerCalls: 0,
  outOfEnvelopeTargetRejected: true,
  targetOmissionRejected: true,
  duplicateTargetRejected: true,
  outOfEnvelopeReferentRejected: true,
  outOfEnvelopeTaskRejected: true,
  providerOwnsConversationAction: false,
  providerOwnsSafetyIntent: false,
  diagnosisFailsClosed: true,
}, null, 2))

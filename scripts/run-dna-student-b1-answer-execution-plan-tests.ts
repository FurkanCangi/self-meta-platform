import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import {
  applyStudentRequestContract,
  buildStudentAnswerExecutionPlan,
  classifyStudentAnswerEvidenceClaimRole,
  createEmptyStudentConversationState,
  resolveStudentEvidenceFirstRequest,
  validateStudentAnswerExecutionPlan,
  type StudentConversationState,
} from "../src/lib/dna/chat/studentFirst"

type Fixture = Readonly<{
  conversations: readonly Readonly<{
    turns: readonly Readonly<{ turnId: string; user: string }>[]
  }>[]
}>

const fixture = JSON.parse(readFileSync(
  "scripts/dna-student-fixtures/STUDENT40_DEVELOPMENT.json",
  "utf8",
)) as Fixture

let plans = 0
let providerGrounded = 0
let localSafetyBoundary = 0
let privacySafeHistoryAnchors = 0
let maximumTargets = 0
for (const conversation of fixture.conversations) {
  let state: StudentConversationState = createEmptyStudentConversationState()
  for (const turn of conversation.turns) {
    const resolved = resolveStudentEvidenceFirstRequest({ turnId: turn.turnId, message: turn.user, state })
    assert.equal(resolved.ok, true, `${turn.turnId}: request contract`)
    if (!resolved.ok) throw new Error(`${turn.turnId}: request contract missing`)
    const plan = buildStudentAnswerExecutionPlan({ question: turn.user, contract: resolved.contract })
    assert.equal(validateStudentAnswerExecutionPlan(plan, resolved.contract), true, `${turn.turnId}: execution plan`)
    assert.deepEqual(plan.activeTargetIds, resolved.contract.targetIds, `${turn.turnId}: exact target order`)
    assert.deepEqual(plan.obligations.map((row) => row.id), resolved.contract.obligations.map((row) => row.id),
      `${turn.turnId}: exact obligation IDs`)
    assert.equal(plan.targetEvidence.some((row) => plan.rejectedTargetIds.includes(row.studentTargetId)), false,
      `${turn.turnId}: rejected target evidence`)
    assert.equal(plan.targetEvidence.every((row) => row.claims.length > 0), true, `${turn.turnId}: source evidence`)
    assert.equal(plan.targetEvidence.every((row) => row.claims.some((claim) => claim.role !== "contrast")), true,
      `${turn.turnId}: non-contrast target evidence`)
    assert.equal(plan.rawQuestionStored, false, `${turn.turnId}: raw question storage`)
    if (plan.executionRoute === "provider_grounded") providerGrounded += 1
    else localSafetyBoundary += 1
    if (plan.historyAnchor) {
      assert.equal(plan.historyAnchor.rawHistoryStored, false)
      assert.equal(plan.obligations.some((row) => row.kind === "use_history_anchor"), true)
      privacySafeHistoryAnchors += 1
    }
    maximumTargets = Math.max(maximumTargets, plan.activeTargetIds.length)
    plans += 1

    const missingEvidence = {
      ...plan,
      targetEvidence: plan.targetEvidence.slice(1),
    }
    assert.equal(validateStudentAnswerExecutionPlan(missingEvidence, resolved.contract), false,
      `${turn.turnId}: missing target evidence must fail`)
    const missingObligation = {
      ...plan,
      obligations: plan.obligations.slice(1),
    }
    assert.equal(validateStudentAnswerExecutionPlan(missingObligation, resolved.contract), false,
      `${turn.turnId}: missing obligation must fail`)
    state = applyStudentRequestContract(state, resolved.contract)
  }
}

assert.equal(plans, 40)
assert.ok(providerGrounded > 0, "general educational answers must retain a grounded provider route")
assert.ok(localSafetyBoundary > 0, "case and treatment boundaries must remain local")
assert.ok(privacySafeHistoryAnchors > 0, "history-bound answers must expose a privacy-safe anchor")
assert.equal(maximumTargets, 7)
const workingMemoryContrastTagged = classifyStudentAnswerEvidenceClaimRole(
  "Bir telefon numarasını birkaç saniye akılda tutmak kısa süreli bellek örneğidir.",
  "Çalışma Belleği · Çalışma Belleği ve Kısa Süreli Bellek",
  ["çalışma belleği"],
) === "contrast"
const workingMemoryTargetAvailable = classifyStudentAnswerEvidenceClaimRole(
  "Çalışma belleği ise bu bilginin korunurken aynı zamanda işlenmesini veya güncellenmesini içerir.",
  "Çalışma Belleği · Çalışma Belleği ve Kısa Süreli Bellek",
  ["çalışma belleği"],
) === "target"
assert.equal(workingMemoryContrastTagged, true)
assert.equal(workingMemoryTargetAvailable, true)

console.log(JSON.stringify({
  ok: true,
  gate: "STUDENT_B1_ANSWER_EXECUTION_PLAN_LOCAL",
  plans,
  providerGrounded,
  localSafetyBoundary,
  privacySafeHistoryAnchors,
  maximumTargets,
  missingEvidenceMutationsRejected: plans,
  missingObligationMutationsRejected: plans,
  workingMemoryContrastTagged,
  workingMemoryTargetAvailable,
  providerCalls: 0,
}, null, 2))

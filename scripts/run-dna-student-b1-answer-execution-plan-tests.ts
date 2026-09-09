import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { getDnaOwnerBookTopicClaims } from "../src/lib/dna/chat/ownerBookRuntime"

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
let summaryEpistemicScopes = 0
let absentUnrequestedScopes = 0
let summaryParagraphControls = 0
let summaryExpandedTargets = 0
let preservedStructuredSummaryControls = 0
for (const conversation of fixture.conversations) {
  let state: StudentConversationState = createEmptyStudentConversationState()
  for (const turn of conversation.turns) {
    const resolved = resolveStudentEvidenceFirstRequest({ turnId: turn.turnId, message: turn.user, state })
    assert.equal(resolved.ok, true, `${turn.turnId}: request contract`)
    if (!resolved.ok) throw new Error(`${turn.turnId}: request contract missing`)
    const plan = buildStudentAnswerExecutionPlan({ question: turn.user, contract: resolved.contract })
    if (turn.turnId === "STUDENT40-C02-T01") {
      assert.equal(plan.targetEvidence[0]?.claims[0]?.claimId, "owner.unit:0853:a4276489c09b",
        "definition_must_receive_existing_approved_direct_definition_not_orphan_list_intro")
    }
    assert.equal(validateStudentAnswerExecutionPlan(plan, resolved.contract), true, `${turn.turnId}: execution plan`)
    assert.deepEqual(plan.activeTargetIds, resolved.contract.targetIds, `${turn.turnId}: exact target order`)
    assert.deepEqual(plan.obligations.map((row) => row.id), resolved.contract.obligations.map((row) => row.id),
      `${turn.turnId}: exact obligation IDs`)
    assert.equal(plan.targetEvidence.some((row) => plan.rejectedTargetIds.includes(row.studentTargetId)), false,
      `${turn.turnId}: rejected target evidence`)
    assert.equal(plan.targetEvidence.every((row) => row.claims.length > 0), true, `${turn.turnId}: source evidence`)
    assert.equal(plan.targetEvidence.every((row) => [
      "SUPPORTED_DIRECT", "SUPPORTED_DERIVED", "UNSUPPORTED",
    ].includes(row.verifiedExampleEvidence.status)), true, `${turn.turnId}: verified example sufficiency`)
    assert.equal(plan.targetEvidence.every((row) => row.claims.some((claim) => claim.role !== "contrast")), true,
      `${turn.turnId}: non-contrast target evidence`)
    assert.equal(plan.rawQuestionStored, false, `${turn.turnId}: raw question storage`)
    if (plan.operation === "summarize") {
      for (const target of plan.targetEvidence) {
        const available = getDnaOwnerBookTopicClaims(target.ownerBookTopicId, true)
        if (available.length > 3 && target.claims[0]?.text.trim().endsWith(":")) {
          const rank = { target: 0, context: 1, contrast: 2 }
          const legacyStructured = [...available].sort((left, right) =>
            rank[classifyStudentAnswerEvidenceClaimRole(left.text, target.ownerBookTopicTitle, target.visibleAliases)]
            - rank[classifyStudentAnswerEvidenceClaimRole(right.text, target.ownerBookTopicTitle, target.visibleAliases)])
            .slice(0, 10)
          assert.deepEqual(target.claims.map((row) => row.claimId), legacyStructured.map((row) => row.claimId),
            "preserve existing structured-list support instead of reducing it to a colon-only introduction")
          preservedStructuredSummaryControls++
          continue
        }
        const anchor = available.find((row) => row.claimId === target.claims[0]?.claimId)!
        const paragraph = available.filter((row) => row.nodeId === anchor.nodeId)
        assert.deepEqual(target.claims.map((row) => row.claimId), paragraph.map((row) => row.claimId),
          `${turn.turnId}:${target.studentTargetId}: summary must preserve its source paragraph, not only its first sentence`)
        assert.deepEqual(target.claims.map((row) => row.text), paragraph.map((row) => row.text),
          "paragraph closure must not rewrite source claims")
        if (paragraph.length > 1) summaryExpandedTargets++
        summaryParagraphControls++
      }
    }
    if (resolved.contract.obligations.some((row) => row.kind === "summarize_unknown")) {
      assert.ok(plan.summaryEpistemicScope, `${turn.turnId}: explicit summary knowledge boundary`)
      assert.equal(plan.summaryEpistemicScope.selectedClaimsAreExhaustive, false)
      assert.deepEqual(plan.summaryEpistemicScope.limitPolicyIds, ["policy.evidence-limit"])
      assert.deepEqual(plan.summaryEpistemicScope.establishedContextClaimIds,
        plan.targetEvidence.flatMap((target) => target.claims.filter((row) => row.role !== "contrast").map((row) => row.claimId)))
      assert.equal(validateStudentAnswerExecutionPlan({ ...plan, summaryEpistemicScope: null }, resolved.contract), false)
      assert.equal(validateStudentAnswerExecutionPlan({ ...plan, summaryEpistemicScope: {
        ...plan.summaryEpistemicScope, establishedContextClaimIds: [],
      } }, resolved.contract), false)
      assert.equal(validateStudentAnswerExecutionPlan({ ...plan, policyUnits: [] }, resolved.contract), false)
      summaryEpistemicScopes++
    } else {
      assert.equal(plan.summaryEpistemicScope, null, `${turn.turnId}: no unrequested uncertainty channel`)
      absentUnrequestedScopes++
    }
    if (plan.executionRoute === "provider_grounded") providerGrounded += 1
    else localSafetyBoundary += 1
    if (plan.historyAnchor) {
      assert.equal(plan.historyAnchor.rawHistoryStored, false)
      assert.equal(plan.obligations.some((row) => row.kind === "use_history_anchor")
        || Boolean(plan.historyAnchor.caseContext?.eventIds.length), true)
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

let recoveryState: StudentConversationState = createEmptyStudentConversationState()
const recoveryTurn = resolveStudentEvidenceFirstRequest({
  turnId: "CASE-CONTEXT-T01",
  message: "yok dikkat kısmını sormuyorum görevi bırakınca kendini toparlayıp dönmesi öz düzenleme açısından ne demek onu soruyom",
  state: recoveryState,
})
assert.equal(recoveryTurn.ok, true)
if (!recoveryTurn.ok) throw new Error("recovery case contract missing")
assert.deepEqual(recoveryTurn.contract.caseContext.eventIds, ["task_interrupted", "self_recovered", "task_resumed"])
recoveryState = applyStudentRequestContract(recoveryState, recoveryTurn.contract)
const componentTurn = resolveStudentEvidenceFirstRequest({
  turnId: "CASE-CONTEXT-T02",
  message: "peki bunda planlama dürtü kontrolü ve duygu kısmı üçü nasıl yer alır ayrı ayrı anlat",
  state: recoveryState,
})
assert.equal(componentTurn.ok, true)
if (!componentTurn.ok) throw new Error("component case contract missing")
assert.deepEqual(componentTurn.contract.referentCaseContext?.eventIds,
  ["task_interrupted", "self_recovered", "task_resumed"])
const componentPlan = buildStudentAnswerExecutionPlan({
  question: "peki bunda planlama dürtü kontrolü ve duygu kısmı üçü nasıl yer alır ayrı ayrı anlat",
  contract: componentTurn.contract,
})
assert.deepEqual(componentPlan.historyAnchor?.caseContext?.eventIds,
  ["task_interrupted", "self_recovered", "task_resumed"])
assert.deepEqual(componentPlan.historyAnchor?.caseContext?.eventLabels,
  ["görevi bırakma", "kendi kendine toparlanma", "göreve geri dönme"])
assert.equal(componentPlan.historyAnchor?.caseContext?.rawMessageStored, false)

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

const sourceBoundExampleQuestion = "Klinik ve Günlük Yaşam Örneği için desteklenen somut bir örnek verin."
const sourceBoundExampleTurn = resolveStudentEvidenceFirstRequest({
  turnId: "SOURCE-BOUND-EXAMPLE-PLAN-T01",
  message: sourceBoundExampleQuestion,
  state: createEmptyStudentConversationState(),
})
assert.equal(sourceBoundExampleTurn.ok, true)
if (!sourceBoundExampleTurn.ok) throw new Error("source-bound example plan missing")
const sourceBoundExamplePlan = buildStudentAnswerExecutionPlan({
  question: sourceBoundExampleQuestion,
  contract: sourceBoundExampleTurn.contract,
})
assert.equal(sourceBoundExamplePlan.targetEvidence[0]?.verifiedExampleEvidence.status, "UNSUPPORTED")
assert.deepEqual(sourceBoundExamplePlan.targetEvidence[0]?.verifiedExampleEvidence.supportClaimIds, [])

let depthState: StudentConversationState = createEmptyStudentConversationState()
const depthDefinition = resolveStudentEvidenceFirstRequest({
  turnId: "DEPTH-BUDGET-T01",
  message: "öz düzenleme neydi tam olarak",
  state: depthState,
})
if (!depthDefinition.ok) throw new Error("depth definition missing")
depthState = applyStudentRequestContract(depthState, depthDefinition.contract)
const standardDeepening = resolveStudentEvidenceFirstRequest({
  turnId: "DEPTH-BUDGET-T02",
  message: "biraz daha kapsamlı anlat",
  state: depthState,
})
if (!standardDeepening.ok) throw new Error("standard deepening missing")
const standardDeepeningPlan = buildStudentAnswerExecutionPlan({
  question: "biraz daha kapsamlı anlat",
  contract: standardDeepening.contract,
})
depthState = applyStudentRequestContract(depthState, standardDeepening.contract)
const lessonDeepeningQuestion = "daha da detaylandır uzun cevap ver, öğrenciye ders anlatır gibi olsun"
const lessonDeepening = resolveStudentEvidenceFirstRequest({
  turnId: "DEPTH-BUDGET-T03",
  message: lessonDeepeningQuestion,
  state: depthState,
})
if (!lessonDeepening.ok) throw new Error("lesson deepening missing")
const lessonDeepeningPlan = buildStudentAnswerExecutionPlan({
  question: lessonDeepeningQuestion,
  contract: lessonDeepening.contract,
})
assert.equal(standardDeepeningPlan.targetEvidence[0]?.claims.length, 4)
assert.equal(lessonDeepening.contract.presentation.depth, "deep")
assert.equal(lessonDeepeningPlan.targetEvidence[0]?.claims.length, 8)

console.log(JSON.stringify({
  ok: true,
  gate: "STUDENT_B1_ANSWER_EXECUTION_PLAN_LOCAL",
  plans,
  providerGrounded,
  localSafetyBoundary,
  privacySafeHistoryAnchors,
  structuredCaseContextBound: true,
  maximumTargets,
  missingEvidenceMutationsRejected: plans,
  missingObligationMutationsRejected: plans,
  workingMemoryContrastTagged,
  workingMemoryTargetAvailable,
  verifiedExampleSufficiencyBound: true,
  depthAwareEvidenceBudgetBound: true,
  summaryEpistemicScopes,
  absentUnrequestedScopes,
  missingSummaryScopeEvidenceAndPolicyRejected: summaryEpistemicScopes * 3,
  summaryParagraphControls,
  summaryExpandedTargets,
  preservedStructuredSummaryControls,
  providerCalls: 0,
}, null, 2))

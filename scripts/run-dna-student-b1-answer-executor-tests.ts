import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import {
  applyStudentRequestContract,
  buildStudentAnswerExecutionPlan,
  createEmptyStudentConversationState,
  resolveStudentEvidenceFirstRequest,
  type StudentConversationState,
} from "../src/lib/dna/chat/studentFirst"
import {
  executeStudentAnswer,
  validateStudentAnswerCandidate,
} from "../src/lib/dna/chat/studentFirst/answerExecutor.server"

type Fixture = Readonly<{
  conversations: readonly Readonly<{
    turns: readonly Readonly<{ turnId: string; user: string }>[]
  }>[]
}>

const fixture = JSON.parse(readFileSync(
  "scripts/dna-student-fixtures/STUDENT40_DEVELOPMENT.json",
  "utf8",
)) as Fixture

let mockCalls = 0
const mockFetch: typeof fetch = async (_input, init) => {
  mockCalls += 1
  const request = JSON.parse(String(init?.body)) as { input: string }
  const content = JSON.parse(request.input) as {
    operation: string
    activeTargets: readonly Readonly<{
      targetId: string
      title: string
      visibleAliases: readonly string[]
      lockedClaims: readonly Readonly<{ claimId: string }>[]
    }>[]
    obligations: readonly Readonly<{ id: string; kind: string }>[]
    policyUnits: readonly Readonly<{ id: string }>[]
    presentation: Readonly<{ requestedSentenceCount: number | null }>
  }
  const labels = content.activeTargets.map((row) => row.visibleAliases[0]).join(", ")
  const kinds = new Set(content.obligations.map((row) => row.kind))
  const summaryAnswer = [
    `${labels} konuşmada bildiğimiz başlıklardır.`,
    ...(kinds.has("summarize_unknown") ? ["Bu açıklama tek başına bir öğrenci hakkında kesin sonuç vermez."] : []),
    ...(kinds.has("summarize_observation_focus") ? ["Gözlemde farklı ortam ve görevlerde ne olduğuna bakılır."] : []),
  ].join(" ")
  const answer = content.operation === "summarize"
    ? summaryAnswer
    : kinds.has("give_concrete_example")
      ? `${kinds.has("distinguish_targets") ? `${labels} aynı şey değildir. Aralarındaki ilişkiyi ayrı kapsamlarıyla ele alırız. ` : ""}Örneğin, ${labels} için kısa bir öğrenci durumu düşün. Bu örnek, ${labels} kavramıyla doğrudan bağ kurar.`
      : kinds.has("distinguish_targets")
        ? `${labels} aynı şey değildir. Aralarındaki ilişki, her kavramın kaynakta ayrı bir kapsamla açıklanmasıdır.`
    : `${labels} için kaynak bilgisine dayalı, öğrenci dilinde kısa bir açıklama veriyorum. İstenen görev bu kavramları doğrudan ele alır.`
  const value = {
    blocks: [{
      blockId: "b1",
      text: answer,
      targetIds: content.activeTargets.map((row) => row.targetId),
      obligationIds: content.obligations.map((row) => row.id),
      usedClaimIds: content.activeTargets.map((row) => row.lockedClaims[0]!.claimId),
      usedPolicyUnitIds: content.policyUnits.map((row) => row.id),
    }],
    illustrationKind: content.obligations.some((row) => row.kind === "give_concrete_example")
      ? "user_supplied" : "none",
  }
  return new Response(JSON.stringify({
    id: `mock-response-${mockCalls}`,
    output_text: JSON.stringify(value),
    usage: { input_tokens: 100, output_tokens: 50, input_tokens_details: { cached_tokens: 0 } },
  }), { status: 200, headers: { "Content-Type": "application/json" } })
}

async function main() {
  let turns = 0
  let providerAnswers = 0
  let localSafetyAnswers = 0
  for (const conversation of fixture.conversations) {
    let state: StudentConversationState = createEmptyStudentConversationState()
    for (const turn of conversation.turns) {
      const resolved = resolveStudentEvidenceFirstRequest({ turnId: turn.turnId, message: turn.user, state })
      assert.equal(resolved.ok, true, `${turn.turnId}: request contract`)
      if (!resolved.ok) throw new Error(`${turn.turnId}: request contract missing`)
      const result = await executeStudentAnswer({
        question: turn.user,
        contract: resolved.contract,
        apiKey: "mock-api-key",
        fetchImpl: mockFetch,
      })
      if (!result.ok) throw new Error(`${turn.turnId}: ${result.reason}:${result.reason === "candidate_invalid"
        ? result.failureCodes.join(",") : result.failure.reason}`)
      assert.equal(result.ok, true, `${turn.turnId}: answer execution`)
      assert.ok(result.answer.trim().length >= 20, `${turn.turnId}: renderable answer`)
      assert.equal(result.provider.rawOutputStored, false, `${turn.turnId}: raw output storage`)
      assert.equal(validateStudentAnswerCandidate({ candidate: result.candidate, plan: result.plan }).length, 0,
        `${turn.turnId}: final candidate validation`)
      if (result.route === "provider_grounded") {
        providerAnswers += 1
        assert.equal(result.provider.calls, 1, `${turn.turnId}: bounded provider call`)
      } else {
        localSafetyAnswers += 1
        assert.equal(result.provider.calls, 0, `${turn.turnId}: local safety boundary must not call provider`)
      }
      state = applyStudentRequestContract(state, resolved.contract)
      turns += 1
    }
  }
  assert.equal(turns, 40)
  assert.equal(mockCalls, providerAnswers)

  const first = fixture.conversations[0]!.turns[0]!
  const firstResolution = resolveStudentEvidenceFirstRequest({
    turnId: first.turnId,
    message: first.user,
    state: createEmptyStudentConversationState(),
  })
  if (!firstResolution.ok) throw new Error("first contract missing")
  const plan = buildStudentAnswerExecutionPlan({ question: first.user, contract: firstResolution.contract })
  const validAnswer = "Self-regülasyon için kaynakla sınırlı kısa açıklama."
  const validBlock = {
    blockId: "b1",
    text: validAnswer,
    targetIds: [...plan.activeTargetIds],
    obligationIds: plan.obligations.map((row) => row.id),
    usedClaimIds: plan.targetEvidence.map((row) => row.claims[0]!.claimId),
    usedPolicyUnitIds: plan.policyUnits.map((row) => row.id),
  }
  const valid = {
    answer: validAnswer,
    blocks: [validBlock],
    addressedTargetIds: [...plan.activeTargetIds],
    addressedObligationIds: plan.obligations.map((row) => row.id),
    usedClaimIds: plan.targetEvidence.map((row) => row.claims[0]!.claimId),
    usedPolicyUnitIds: plan.policyUnits.map((row) => row.id),
    illustrationKind: "none" as const,
  }
  assert.deepEqual(validateStudentAnswerCandidate({ candidate: valid, plan }), [])
  assert.ok(validateStudentAnswerCandidate({
    candidate: {
      ...valid,
      blocks: [{ ...validBlock, usedClaimIds: [...validBlock.usedClaimIds, "invented.claim"] }],
      usedClaimIds: [...valid.usedClaimIds, "invented.claim"],
    }, plan,
  }).includes("claim_outside_locked_evidence"))
  assert.ok(validateStudentAnswerCandidate({
    candidate: {
      ...valid,
      blocks: [{ ...validBlock, obligationIds: [] }],
      addressedObligationIds: [],
    }, plan,
  }).includes("obligation_coverage_mismatch"))
  assert.ok(validateStudentAnswerCandidate({
    candidate: {
      ...valid,
      blocks: [{ ...validBlock, targetIds: ["wrong_target"] }],
      addressedTargetIds: ["wrong_target"],
    }, plan,
  }).includes("target_coverage_mismatch"))
  assert.ok(validateStudentAnswerCandidate({
    candidate: {
      ...valid,
      blocks: [{ ...validBlock, usedClaimIds: [...validBlock.usedClaimIds, validBlock.usedClaimIds[0]!] }],
    }, plan,
  }).includes("duplicate_contract_reference"))
  assert.ok(validateStudentAnswerCandidate({
    candidate: {
      ...valid,
      answer: "Kaynakla sınırlı ancak hedef adı görünmeyen kısa açıklama.",
      blocks: [{ ...validBlock, text: "Kaynakla sınırlı ancak hedef adı görünmeyen kısa açıklama." }],
    }, plan,
  }).includes("target_not_visible"))
  assert.ok(validateStudentAnswerCandidate({
    candidate: {
      ...valid,
      blocks: [{ ...validBlock, targetIds: [] }],
      addressedTargetIds: [],
    },
    plan,
  }).includes("obligation_not_visible"))
  if (valid.addressedObligationIds.length) {
    assert.ok(validateStudentAnswerCandidate({
      candidate: {
        ...valid,
        blocks: [{
          ...validBlock,
          obligationIds: [...validBlock.obligationIds, validBlock.obligationIds[0]!],
        }],
      },
      plan,
    }).includes("duplicate_contract_reference"))
  }

  const rejectedFetch: typeof fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body)) as { input: string }
    const content = JSON.parse(request.input) as {
      activeTargets: readonly Readonly<{ targetId: string; lockedClaims: readonly Readonly<{ claimId: string }>[] }>[]
      obligations: readonly Readonly<{ id: string }>[]
      policyUnits: readonly Readonly<{ id: string }>[]
    }
    return new Response(JSON.stringify({
      id: "mock-rejected-response",
      output_text: JSON.stringify({
        blocks: [{
          blockId: "b1",
          text: "Bu yeterince uzun cevap görünür hedef adını kasıtlı olarak içermiyor.",
          targetIds: content.activeTargets.map((row) => row.targetId),
          obligationIds: content.obligations.map((row) => row.id),
          usedClaimIds: content.activeTargets.map((row) => row.lockedClaims[0]!.claimId),
          usedPolicyUnitIds: content.policyUnits.map((row) => row.id),
        }],
        illustrationKind: "none",
      }),
      usage: { input_tokens: 101, output_tokens: 51, input_tokens_details: { cached_tokens: 0 } },
    }), { status: 200, headers: { "Content-Type": "application/json" } })
  }
  const rejected = await executeStudentAnswer({
    question: first.user,
    contract: firstResolution.contract,
    apiKey: "mock-api-key",
    fetchImpl: rejectedFetch,
  })
  assert.equal(rejected.ok, false)
  if (rejected.ok) throw new Error("invalid provider candidate unexpectedly accepted")
  assert.equal(rejected.reason, "candidate_invalid")
  assert.equal(rejected.provider.calls, 1)
  assert.equal(rejected.provider.usage.inputTokens, 101)
  assert.equal(rejected.provider.usage.outputTokens, 51)
  assert.equal(rejected.provider.rawOutputStored, false)

  console.log(JSON.stringify({
    ok: true,
    gate: "STUDENT_B1_ANSWER_EXECUTOR_LOCAL",
    turns,
    providerAnswers,
    localSafetyAnswers,
    providerCalls: mockCalls,
    maximumProviderCallsPerTurn: 1,
    rawOutputsStored: 0,
    invalidClaimRejected: true,
    missingObligationRejected: true,
    wrongTargetRejected: true,
    duplicateReferenceRejected: true,
    invisibleTargetRejected: true,
    unboundObligationBlockRejected: true,
    duplicateObligationBlockReferenceRejected: true,
    rejectedCandidateTelemetryPreserved: true,
  }, null, 2))
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

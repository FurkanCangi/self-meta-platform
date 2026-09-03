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
    answerSlots: readonly Readonly<{
      slotId: string
      slotKind: "content" | "example"
      obligations: readonly Readonly<{ id: string; kind: string }>[]
      activeTargets: readonly Readonly<{
        targetId: string
        title: string
        visibleAliases: readonly string[]
        lockedClaims: readonly Readonly<{ claimId: string }>[]
      }>[]
      policyUnits: readonly Readonly<{ id: string }>[]
    }>[]
    presentation: Readonly<{ requestedSentenceCount: number | null }>
  }
  const slotText = (slot: (typeof content.answerSlots)[number]) => {
    const labels = slot.activeTargets.map((row) => row.visibleAliases[0]).join(", ")
    const kinds = new Set(slot.obligations.map((obligation) => obligation.kind))
    if (kinds.has("use_shared_scenario")) return `Tek bir sınıf görevinde öğrenci ${labels} becerilerini aynı durum içinde ayrı ayrı kullanır.`
    if (kinds.has("distinguish_targets")) return `${labels} aynı şey değildir.`
    if (kinds.has("explain_relation")) return `${labels} arasındaki ilişki ayrı kapsamlarıyla açıklanır.`
    if (kinds.has("give_concrete_example")) return `${labels} için kısa bir öğrenci durumu anlatılır.`
    if (kinds.has("bind_example_to_target")) return `Bu örnek ${labels} kavramıyla doğrudan bağ kurar.`
    if (kinds.has("summarize_known")) return `${labels} konuşmada bildiğimiz başlıklardır.`
    if (kinds.has("summarize_unknown")) return "Bu açıklama tek başına bir öğrenci hakkında kesin sonuç vermez."
    if (kinds.has("summarize_observation_focus")) return "Gözlemde farklı ortam ve görevlerde ne olduğuna bakılır."
    return `${labels} için kaynak bilgisine dayalı, öğrenci dilinde kısa bir açıklama veriyorum.`
  }
  const value = {
    blocks: Object.fromEntries(content.answerSlots.map((slot) => [slot.slotId, slotText(slot)])),
    illustrationKind: content.answerSlots.some((slot) => slot.obligations.some((obligation) => obligation.kind === "give_concrete_example"))
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
  let sharedScenarioGrouped = false
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
      for (const block of result.candidate.blocks) {
        const containsExampleDuty = result.plan.obligations.some((obligation) =>
          obligation.kind === "give_concrete_example" && block.obligationIds.includes(obligation.id))
        assert.equal(block.blockKind, containsExampleDuty ? "example" : "content", `${turn.turnId}: typed block kind`)
        if (containsExampleDuty) assert.match(block.text, /Örnek:/u, `${turn.turnId}: deterministic example label`)
      }
      if (turn.turnId === "STUDENT40-C02-T07") {
        const sharedIds = result.plan.obligations
          .filter((obligation) => ["give_concrete_example", "bind_example_to_target", "use_shared_scenario"].includes(obligation.kind))
          .map((obligation) => obligation.id)
        assert.equal(sharedIds.length, 3)
        const sharedBlocks = result.candidate.blocks.filter((block) =>
          block.obligationIds.some((obligationId) => sharedIds.includes(obligationId)))
        assert.equal(sharedBlocks.length, 1, "shared scenario duties must compile into one text block")
        assert.deepEqual([...sharedBlocks[0]!.obligationIds].sort(), [...sharedIds].sort())
        sharedScenarioGrouped = true
      }
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
  assert.equal(sharedScenarioGrouped, true)

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
    blockKind: "content" as const,
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

  const comparisonConversation = fixture.conversations.find((row) => row.turns.some((turn) =>
    turn.turnId === "STUDENT40-C02-T07"))!
  let comparisonState: StudentConversationState = createEmptyStudentConversationState()
  let comparisonPlan: ReturnType<typeof buildStudentAnswerExecutionPlan> | null = null
  for (const turn of comparisonConversation.turns) {
    const resolution = resolveStudentEvidenceFirstRequest({ turnId: turn.turnId, message: turn.user, state: comparisonState })
    if (!resolution.ok) throw new Error(`comparison role fixture:${turn.turnId}`)
    if (turn.turnId === "STUDENT40-C02-T07") {
      comparisonPlan = buildStudentAnswerExecutionPlan({ question: turn.user, contract: resolution.contract })
      break
    }
    comparisonState = applyStudentRequestContract(comparisonState, resolution.contract)
  }
  assert.ok(comparisonPlan)
  const contrastClaim = {
    claimId: "owner.unit:2252:233bda4b4086",
    passageId: "owner-book:paragraph:1576:b5f656d684:sentence:1",
    sourceId: "book.self-regulation.owner-current",
    text: "Bir telefon numarasını birkaç saniye akılda tutmak kısa süreli bellek örneğidir.",
    role: "contrast" as const,
  }
  const comparisonPlanWithContrast = {
    ...comparisonPlan,
    targetEvidence: comparisonPlan.targetEvidence.map((row) => row.studentTargetId === "working_memory"
      ? { ...row, claims: [...row.claims, contrastClaim] }
      : row),
  }
  const planningClaim = comparisonPlanWithContrast.targetEvidence.find((row) => row.studentTargetId === "planning")!
    .claims.find((claim) => claim.role !== "contrast")!
  const contrastAnswer = "Planlama ve çalışma belleği açısından: Örnek: İki kavramı aynı durumda ayrı ele alırız."
  const contrastCandidate = {
    answer: contrastAnswer,
    blocks: [{
      blockId: "b1",
      blockKind: "example" as const,
      text: contrastAnswer,
      targetIds: [...comparisonPlanWithContrast.activeTargetIds],
      obligationIds: comparisonPlanWithContrast.obligations.map((row) => row.id),
      usedClaimIds: [planningClaim.claimId, contrastClaim.claimId],
      usedPolicyUnitIds: comparisonPlanWithContrast.policyUnits.map((row) => row.id),
    }],
    addressedTargetIds: [...comparisonPlanWithContrast.activeTargetIds],
    addressedObligationIds: comparisonPlanWithContrast.obligations.map((row) => row.id),
    usedClaimIds: [planningClaim.claimId, contrastClaim.claimId],
    usedPolicyUnitIds: comparisonPlanWithContrast.policyUnits.map((row) => row.id),
    illustrationKind: "hypothetical" as const,
  }
  assert.ok(validateStudentAnswerCandidate({ candidate: contrastCandidate, plan: comparisonPlanWithContrast })
    .includes("contrast_claim_used_as_target"))
  const sharedScenarioObligation = comparisonPlanWithContrast.obligations.find((row) => row.kind === "use_shared_scenario")!
  const splitScenarioBlock = {
    blockId: "b2",
    blockKind: "content" as const,
    text: "Aynı senaryo ikinci bir blokta ayrıca ele alınıyor.",
    targetIds: [...comparisonPlanWithContrast.activeTargetIds],
    obligationIds: [sharedScenarioObligation.id],
    usedClaimIds: [],
    usedPolicyUnitIds: [],
  }
  const splitScenarioFirstBlock = {
    ...contrastCandidate.blocks[0]!,
    obligationIds: contrastCandidate.blocks[0]!.obligationIds.filter((id) => id !== sharedScenarioObligation.id),
  }
  const splitScenarioAnswer = `${splitScenarioFirstBlock.text} ${splitScenarioBlock.text}`
  assert.ok(validateStudentAnswerCandidate({
    candidate: {
      ...contrastCandidate,
      answer: splitScenarioAnswer,
      blocks: [splitScenarioFirstBlock, splitScenarioBlock],
    },
    plan: comparisonPlanWithContrast,
  }).includes("shared_scenario_block_mismatch"))
  assert.ok(validateStudentAnswerCandidate({
    candidate: {
      ...contrastCandidate,
      blocks: [{ ...contrastCandidate.blocks[0]!, blockKind: "content" as const }],
    },
    plan: comparisonPlanWithContrast,
  }).includes("example_block_role_mismatch"))
  const unlabeledExampleText = contrastCandidate.blocks[0]!.text.replace("Örnek: ", "")
  assert.ok(validateStudentAnswerCandidate({
    candidate: {
      ...contrastCandidate,
      answer: unlabeledExampleText,
      blocks: [{ ...contrastCandidate.blocks[0]!, text: unlabeledExampleText }],
    },
    plan: comparisonPlanWithContrast,
  }).includes("example_block_role_mismatch"))

  const targetlessFetch: typeof fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body)) as { input: string }
    const content = JSON.parse(request.input) as {
      answerSlots: readonly Readonly<{ slotId: string }>[]
    }
    return new Response(JSON.stringify({
      id: "mock-rejected-response",
      output_text: JSON.stringify({
        blocks: Object.fromEntries(content.answerSlots.map((slot) => [
          slot.slotId,
          "Bu yeterince uzun cevap görünür hedef adını kasıtlı olarak içermiyor.",
        ])),
        illustrationKind: "none",
      }),
      usage: { input_tokens: 101, output_tokens: 51, input_tokens_details: { cached_tokens: 0 } },
    }), { status: 200, headers: { "Content-Type": "application/json" } })
  }
  const targetless = await executeStudentAnswer({
    question: first.user,
    contract: firstResolution.contract,
    apiKey: "mock-api-key",
    fetchImpl: targetlessFetch,
  })
  assert.equal(targetless.ok, true)
  if (!targetless.ok) throw new Error("deterministic target prefix failed")
  assert.match(targetless.answer, /^self-regülasyon açısından:/iu)

  const rejectedFetch: typeof fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body)) as { input: string }
    const content = JSON.parse(request.input) as { answerSlots: readonly Readonly<{ slotId: string }>[] }
    return new Response(JSON.stringify({
      id: "mock-rejected-response",
      output_text: JSON.stringify({
        blocks: Object.fromEntries(content.answerSlots.map((slot) => [
          slot.slotId,
          "Bu schema ifadesi iç sistem dilini görünür cevaba kasıtlı olarak sızdırıyor.",
        ])),
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
    deterministicTargetPrefix: true,
    contrastClaimTargetBindingRejected: true,
    sharedScenarioGrouped,
    splitSharedScenarioRejected: true,
    wrongExampleBlockRoleRejected: true,
    missingDeterministicExampleLabelRejected: true,
    rejectedCandidateTelemetryPreserved: true,
  }, null, 2))
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

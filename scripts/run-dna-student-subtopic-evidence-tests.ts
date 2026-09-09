import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  applyStudentRequestContract, createEmptyStudentConversationState, resolveStudentEvidenceFirstRequest,
  buildStudentAnswerExecutionPlan,
  validateStudentAnswerExecutionPlan, type StudentRequestContract,
} from "../src/lib/dna/chat/studentFirst"
import { executeStudentAnswer } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"

const fixture = JSON.parse(readFileSync("scripts/dna-student-fixtures/STUDENT40_DEVELOPMENT.json", "utf8")) as {
  conversations: Array<{ turns: Array<{ turnId: string; user: string }> }>
}
let state = createEmptyStudentConversationState()
let exactContract: StudentRequestContract | null = null
let exactQuestion = ""
for (const turn of fixture.conversations[2]!.turns) {
  const resolution = resolveStudentEvidenceFirstRequest({ turnId: turn.turnId, message: turn.user, state })
  assert.ok(resolution.ok)
  if (turn.turnId === "STUDENT40-C03-T06") {
    const plan = buildStudentAnswerExecutionPlan({ question: turn.user, contract: resolution.contract })
    assert.deepEqual(plan.activeTargetIds, ["coregulation"])
    assert.deepEqual(plan.rejectedTargetIds, ["arousal"])
    assert.ok(plan.targetEvidence[0]!.claims.some((claim) => claim.claimId === "owner.unit:1488:ca980fc505dd"),
      "requested_support_reduction_requires_approved_relevant_evidence_not_generic_definition_only")
    exactContract = resolution.contract
    exactQuestion = turn.user
    break
  }
  state = applyStudentRequestContract(state, resolution.contract)
}
async function main() {
  globalThis.fetch = async () => { throw new Error("external_network_forbidden") }
  assert.ok(exactContract)
  // The exact failing turn was checked above with its complete pre-repair
  // fixture history. Target-free paraphrases here follow the accepted repair.
  const repairedState = applyStudentRequestContract(state, exactContract)
  let nominalControls = 0
  const nominalForms = [
    ["çalışma belleğinde", "working_memory"], ["çalışma belleğinden", "working_memory"],
    ["çalışma belleğinin", "working_memory"], ["çalışma belleğine", "working_memory"],
    ["çalışma belleğindeki", "working_memory"], ["çalışma belleğindekinden", "working_memory"],
    ["dürtü kontrolünde", "inhibition"], ["dürtü kontrolünden", "inhibition"],
    ["duygu düzenlemesinde", "emotion_regulation"], ["duygu düzenlemesinin", "emotion_regulation"],
    ["öz denetiminde", "self_control"], ["öz denetiminden", "self_control"],
    ["bilişsel esneklikte", "cognitive_flexibility"], ["bilişsel esneklikten", "cognitive_flexibility"],
    ["bilişsel esnekliğinde", "cognitive_flexibility"], ["planlamasının", "planning"],
    ["ko-regülasyonunda", "coregulation"], ["inhibisyonunun", "inhibition"],
    ["yürütücü işlevlerde", "executive_functions"], ["yürütücü işlevlerden", "executive_functions"],
  ] as const
  for (const [phrase, targetId] of nominalForms) {
    const result = resolveStudentEvidenceFirstRequest({ turnId: `nominal-${nominalControls + 1}`,
      message: `${phrase} nasıl bir işleyiş var, açıkla`, state: repairedState })
    assert.ok(result.ok, phrase)
    assert.deepEqual(result.facts.explicitTargetIds, [targetId], phrase)
    assert.deepEqual(result.contract.targetIds, [targetId], phrase)
    nominalControls++
  }
  for (const phrase of ["çalışma belleğindesiz", "bilişsel esnekliksizleştir", "planlamacılık", "ko-regülasyoncu", "öz denetimcilik"]) {
    const result = resolveStudentEvidenceFirstRequest({ turnId: `nominal-negative-${nominalControls + 1}`,
      message: `${phrase} kelimesini anlat`, state: repairedState })
    assert.ok(result.ok)
    assert.deepEqual(result.facts.explicitTargetIds, [], phrase)
    nominalControls++
  }
  for (const [phrase, rejected] of [["çalışma belleğini", "working_memory"], ["çalışma belleğinden", "working_memory"],
    ["bilişsel esnekliğini", "cognitive_flexibility"], ["dürtü kontrolünü", "inhibition"]] as const) {
    const result = resolveStudentEvidenceFirstRequest({ turnId: `nominal-repair-${nominalControls + 1}`,
      message: `${phrase} sormuyorum, planlamayı anlat`, state: repairedState })
    assert.ok(result.ok)
    assert.deepEqual(result.contract.targetIds, ["planning"])
    assert.deepEqual(result.contract.rejectedTargetIds, [rejected])
    nominalControls++
  }
  const questions = [
    exactQuestion,
    "yetişkin desteğinin nasıl azaltılacağını genel olarak anlat",
    "eş düzenlemede yetişkin desteğini azaltmayı kısaca anlat",
    "ko-regülasyonda çocuk kapasite kazandıkça desteğin azaltılmasını açıkla",
    "eş düzenlemede desteği ne zaman geri çekeriz",
  ]
  let controls = 0
  for (const question of questions) {
    const resolved = resolveStudentEvidenceFirstRequest({ turnId: "subtopic-control", message: question, state: repairedState })
    assert.ok(resolved.ok, question)
    const plan = buildStudentAnswerExecutionPlan({ question, contract: resolved.contract })
    assert.deepEqual(plan.activeTargetIds, ["coregulation"], question)
    const evidence = plan.targetEvidence[0]!
    assert.ok(evidence.claims.some((claim) => claim.claimId === "owner.unit:1488:ca980fc505dd"), question)
    assert.equal(evidence.ownerBookTopicId, "owner-book-section/owner-book:heading:0429:804713d51c")
    assert.ok(evidence.claims.length <= (resolved.contract.presentation.depth === "brief" ? 2 : 3))
    assert.ok(evidence.claims.some((claim) => claim.claimId === "owner.unit:0763:921fa6b608ab"))
    assert.equal(JSON.stringify(plan).includes(question), false, "raw_question_must_not_enter_plan")
    assert.equal(validateStudentAnswerExecutionPlan(plan, resolved.contract), true)
    controls++
  }
  const plan = buildStudentAnswerExecutionPlan({ question: exactQuestion, contract: exactContract })
  const original = plan.targetEvidence[0]!
  assert.ok(original.requestedSubtopicEvidence)
  const mutations = [
    { ...original, requestedSubtopicEvidence: undefined },
    { ...original, requestedSubtopicEvidence: { ...original.requestedSubtopicEvidence, ownerBookTopicId: "owner-book-section/owner-book:heading:1574:9f3497890b" } },
    { ...original, requestedSubtopicEvidence: { ...original.requestedSubtopicEvidence, nodeId: "wrong_node" } },
    { ...original, requestedSubtopicEvidence: { ...original.requestedSubtopicEvidence, claimIds: ["forged_claim"] } },
    { ...original, claims: original.claims.map((claim) => claim.claimId === "owner.unit:1488:ca980fc505dd" ? { ...claim, text: "Forged source statement" } : claim) },
    { ...original, claims: original.claims.filter((claim) => claim.claimId !== "owner.unit:0763:921fa6b608ab") },
  ]
  for (const evidence of mutations) assert.equal(validateStudentAnswerExecutionPlan({ ...plan, targetEvidence: [evidence] }, exactContract), false)

  for (const question of ["eş düzenleme nedir", "eş düzenlemeyi kısaca anlat", "eş düzenleme ve arousalı karşılaştır",
    "konuştuklarımızı özetle", "eş düzenleme için bir örnek ver", "hangi terapiyi uygulayayım",
    "daha da detaylandır uzun cevap ver, öğrenciye ders anlatır gibi olsun"]) {
    const result = resolveStudentEvidenceFirstRequest({ turnId: "unchanged-source-control", message: question, state: repairedState })
    assert.ok(result.ok, question)
    const unchanged = buildStudentAnswerExecutionPlan({ question, contract: result.contract })
    assert.ok(unchanged.targetEvidence.every((row) => !row.requestedSubtopicEvidence), question)
    controls++
  }

  const wm = resolveStudentEvidenceFirstRequest({ turnId: "working-memory-control",
    message: "çalışma belleği için bilgiyi dışarıda tutmanın yükü nasıl azalttığını anlat", state: repairedState })
  assert.ok(wm.ok)
  assert.deepEqual(wm.contract.targetIds, ["working_memory"])
  const wmPlan = buildStudentAnswerExecutionPlan({ question: "çalışma belleği için bilgiyi dışarıda tutmanın yükü nasıl azalttığını anlat", contract: wm.contract })
  assert.ok(wmPlan.targetEvidence[0]!.claims.some((claim) => /dışarıda tutulması/u.test(claim.text)),
    "subtopic_selection_must_generalize_beyond_one_target_or_question")
  controls++

  let mockCalls = 0
  let providerAssertion: unknown = null
  const result = await executeStudentAnswer({ question: exactQuestion, contract: exactContract,
    apiKey: "synthetic-not-real", fetchImpl: async (_url, init) => {
      try {
        mockCalls++
        const content = JSON.parse(JSON.parse(String(init?.body)).input)
        assert.equal(content.currentUserMessage, exactQuestion)
        const slot = content.answerSlots[0]
        const target = slot.activeTargets[0]
        assert.equal(target.targetId, "coregulation")
        assert.ok(target.lockedClaims.some((claim: { claimId: string }) => claim.claimId === "owner.unit:1488:ca980fc505dd"))
        assert.deepEqual(content.rejectedTargetIds, ["arousal"])
        return new Response(JSON.stringify({ id: "mock-subtopic", output_text: JSON.stringify({ blocks: {
          [slot.slotId]: "Ko-regülasyonda yetişkin çocuğun erişebileceği düzeyde destek sağlar; çocuk kapasite kazandıkça desteği azaltır.",
        }, illustrationKind: "none" }), usage: { input_tokens: 50, output_tokens: 30 } }), { status: 200 })
      } catch (error) { providerAssertion = error; throw error }
    } })
  if (providerAssertion) throw providerAssertion
  assert.ok(result.ok)
  assert.match(result.answer, /kapasite kazandıkça desteği azaltır/u)
  assert.ok(result.candidate.usedClaimIds.includes("owner.unit:1488:ca980fc505dd"),
    "request_scoped_evidence_id_must_survive_visible_candidate_handoff")
  assert.equal(mockCalls, 1)

  // Preserve the exact original failed wording, including its prior context.
  // The uninflected wording above is not a substitute for this assertion.
  const inflectedQuestion = "çalışma belleğinde bilgiyi dışarıda tutmanın yükü nasıl azalttığını anlat"
  const inflected = resolveStudentEvidenceFirstRequest({ turnId: "inflected-target-regression", message: inflectedQuestion, state: repairedState })
  const inflectedTargetGap = !inflected.ok || inflected.contract.targetIds.length !== 1 || inflected.contract.targetIds[0] !== "working_memory"
  if (inflected.ok && !inflectedTargetGap) {
    const actualPlan = buildStudentAnswerExecutionPlan({ question: inflectedQuestion, contract: inflected.contract })
    assert.ok(actualPlan.targetEvidence[0]!.claims.some((claim) => /dışarıda tutulması/u.test(claim.text)))
  }
  console.log(JSON.stringify({ ok: !inflectedTargetGap, gate: "STUDENT_REQUEST_SCOPED_SUBTOPIC_EVIDENCE",
    retrievalControlsPassed: true, controls, nominalControls, malformedBindingsRejected: mutations.length, mockCalls,
    externalProviderCalls: 0, semanticQualityCertified: false,
    inflectedTargetGap: inflectedTargetGap ? { question: inflectedQuestion, actualTargetIds: inflected.ok ? inflected.contract.targetIds : [],
      expectedTargetIds: ["working_memory"], status: "OPEN_UPSTREAM_RESOLUTION_NOT_FIXED" } : null }, null, 2))
  if (inflectedTargetGap) process.exitCode = 1
}
main().catch((error) => { console.error(error); process.exitCode = 1 })

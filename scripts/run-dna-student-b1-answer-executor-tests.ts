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
    historyAnchor: null | Readonly<{
      turnId: string
      targetIds: readonly string[]
      targetLabels: readonly string[]
      rawHistoryStored: false
      caseContext: null | Readonly<{
        eventIds: readonly string[]
        eventLabels: readonly string[]
        rawMessageStored: false
      }>
    }>
    answerSlots: readonly Readonly<{
      slotId: string
      slotKind: "content" | "example"
      caseBinding: null | Readonly<{
        requiredForEveryActiveTarget: true
        eventLabels: readonly string[]
      }>
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
    const caseEventPhrase = slot.caseBinding?.eventLabels.join(", ") ?? ""
    const historyPrefix = slot.caseBinding
      ? `${labels}, ${caseEventPhrase} olay dizisinin bu bölümünü anlamaya yardım eder: `
      : content.historyAnchor
        ? `Önceki ${content.historyAnchor.targetLabels.join(" ve ")} durumunda `
        : ""
    const withHistory = (text: string) => `${historyPrefix}${text}`
    const kinds = new Set(slot.obligations.map((obligation) => obligation.kind))
    if (kinds.has("use_shared_scenario")) return withHistory(`Tek bir sınıf görevinde öğrenci ${labels} becerilerini aynı durum içinde ayrı ayrı kullanır.`)
    if (kinds.has("distinguish_targets")) return withHistory(`${labels} aynı şey değildir.`)
    if (kinds.has("contrast_target_states")) return withHistory(`Düşük ${labels} ile yüksek ${labels} ayrı ayrı açıklanır.`)
    if (kinds.has("explain_relation")) return withHistory(`${labels} arasındaki ilişki ayrı kapsamlarıyla açıklanır.`)
    if (kinds.has("give_concrete_example")) return withHistory(`Örneğin, ${labels} için kısa bir öğrenci durumu anlatılır.`)
    if (kinds.has("bind_example_to_target")) return withHistory(`Bu örnek ${labels} kavramıyla doğrudan bağ kurar.`)
    if (kinds.has("summarize_known")) return withHistory(`${labels} konuşmada bildiğimiz başlıklardır.`)
    if (kinds.has("summarize_unknown")) return withHistory("Bu açıklama tek başına bir öğrenci hakkında kesin sonuç vermez.")
    if (kinds.has("summarize_observation_focus")) return withHistory("Gözlemde farklı ortam ve görevlerde ne olduğuna bakılır.")
    return withHistory(`${labels} için kaynak bilgisine dayalı, öğrenci dilinde kısa bir açıklama veriyorum.`)
  }
  const value = {
    blocks: Object.fromEntries(content.answerSlots.map((slot) => [
      slot.slotId,
      content.presentation.requestedSentenceCount === null
        ? slotText(slot)
        : `${slotText(slot)} Sağlayıcının fazladan yazdığı ikinci cümle?`,
    ])),
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
  let providerExampleCueDeduplicated = false
  let missingProviderExampleCueLabeled = false
  let requestedSentenceCountNormalized = false
  let compositionControlsGrouped = false
  let localEnvironmentalSceneBound = false
  let privacySafeHistoryAnchorBound = false
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
        if (containsExampleDuty) {
          assert.match(block.text, /Örnek:/u, `${turn.turnId}: deterministic example label`)
          assert.doesNotMatch(block.text, /Örnek:\s+(?:Örnek:|Örneğin|Mesela)/iu, `${turn.turnId}: duplicate example lead`)
          if (turn.turnId === "STUDENT40-C01-T03") providerExampleCueDeduplicated = true
          if (turn.turnId === "STUDENT40-C02-T07") missingProviderExampleCueLabeled = true
        }
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
      if (turn.turnId === "STUDENT40-C01-T08") {
        assert.equal(result.plan.presentation.requestedSentenceCount, 3)
        assert.equal(result.candidate.blocks.length, 3)
        assert.equal(result.answer.split(/(?<=[.!?])\s+/u).filter(Boolean).length, 3)
        assert.doesNotMatch(result.answer, /ikinci cümle\?/u)
        requestedSentenceCountNormalized = true
      }
      if (turn.turnId === "STUDENT40-C02-T05") {
        assert.ok(result.plan.historyAnchor)
        assert.equal(result.plan.historyAnchor.rawHistoryStored, false)
        assert.deepEqual(result.plan.historyAnchor.targetIds, ["inhibition", "executive_functions"])
        assert.match(result.answer, /Önceki inhibisyon ve yürütücü işlev durumunda/u)
        privacySafeHistoryAnchorBound = true
      }
      if (turn.turnId === "STUDENT40-C02-T06") {
        assert.equal(result.plan.obligations.some((row) => row.kind === "preserve_target_while_simplifying"), true)
        assert.equal(result.candidate.blocks.length, 1)
        assert.deepEqual(
          [...result.candidate.blocks[0]!.obligationIds].sort(),
          result.plan.obligations.map((row) => row.id).sort(),
        )
        compositionControlsGrouped = true
      }
      if (turn.turnId === "STUDENT40-C04-T03") {
        assert.equal(result.route, "local_safety_boundary")
        assert.match(result.answer, /Kalabalık veya sesli ortamla birlikte/u)
        assert.match(result.answer, /arousal ve duyusal düzenleme/u)
        assert.doesNotMatch(result.answer, /Duyusal Regülasyonun Self-Regülasyon İçindeki Yeri/u)
        localEnvironmentalSceneBound = true
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
  assert.equal(providerExampleCueDeduplicated, true)
  assert.equal(missingProviderExampleCueLabeled, true)
  assert.equal(requestedSentenceCountNormalized, true)
  assert.equal(compositionControlsGrouped, true)
  assert.equal(localEnvironmentalSceneBound, true)
  assert.equal(privacySafeHistoryAnchorBound, true)

  let recoveryState: StudentConversationState = createEmptyStudentConversationState()
  const recoveryTurn = resolveStudentEvidenceFirstRequest({
    turnId: "CASE-CONTEXT-T01",
    message: "yok dikkat kısmını sormuyorum görevi bırakınca kendini toparlayıp dönmesi öz düzenleme açısından ne demek onu soruyom",
    state: recoveryState,
  })
  if (!recoveryTurn.ok) throw new Error("recovery case contract missing")
  recoveryState = applyStudentRequestContract(recoveryState, recoveryTurn.contract)
  const componentQuestion = "peki bunda planlama dürtü kontrolü ve duygu kısmı üçü nasıl yer alır ayrı ayrı anlat"
  const componentTurn = resolveStudentEvidenceFirstRequest({
    turnId: "CASE-CONTEXT-T02",
    message: componentQuestion,
    state: recoveryState,
  })
  if (!componentTurn.ok) throw new Error("component case contract missing")
  const componentResult = await executeStudentAnswer({
    question: componentQuestion,
    contract: componentTurn.contract,
    apiKey: "mock-api-key",
    fetchImpl: mockFetch,
  })
  if (!componentResult.ok) throw new Error(`component answer missing:${componentResult.reason}`)
  assert.deepEqual(componentResult.plan.historyAnchor?.caseContext?.eventIds,
    ["task_interrupted", "self_recovered", "task_resumed"])
  assert.equal(componentResult.plan.historyAnchor?.caseContext?.rawMessageStored, false)
  assert.equal(componentResult.candidate.blocks.every((block) =>
    /görevi bırakma, kendi kendine toparlanma, göreve geri dönme/u.test(block.text)), true)
  for (const label of ["planlama", "inhibisyon", "duygu düzenleme"]) {
    assert.match(componentResult.answer, new RegExp(label, "u"))
  }

  const comparisonTurns = [
    ["CASE-COMPARE-T01", "hocam öz düzenleme tam ne demek çok akademik olmadan söyler misin"],
    ["CASE-COMPARE-T02", "öz denetimle aynı şey mi peki"],
    ["CASE-COMPARE-T03", "bi öğrenci üzerinden kısa örnek versene derste olsun"],
    ["CASE-COMPARE-T04", "çocuk göreve başlıyo iki dk sonra bırakıp sınıfta geziyo bu öz düzenleme mi dikkat mi ne düşünebiliriz"],
  ] as const
  let caseComparisonState: StudentConversationState = createEmptyStudentConversationState()
  for (const [turnId, message] of comparisonTurns) {
    const resolution = resolveStudentEvidenceFirstRequest({ turnId, message, state: caseComparisonState })
    if (!resolution.ok) throw new Error(`case comparison contract missing:${turnId}`)
    if (turnId === "CASE-COMPARE-T04") {
      const result = await executeStudentAnswer({ question: message, contract: resolution.contract })
      if (!result.ok) throw new Error(`case comparison answer missing:${result.reason}`)
      assert.equal(result.route, "local_safety_boundary")
      assert.match(result.answer, /Bu kavramlar aynı şey değildir/u)
      assert.match(result.answer, /Öz düzenlemede çocuğun dikkatini ve davranışını/u)
      assert.match(result.answer, /Dikkatte ise odağın amaç doğrultusunda sürdürülmesine/u)
      assert.doesNotMatch(result.answer, /işlem kaynağı|Murray et al|self-regülasyon açısından/iu)
      assert.match(result.answer, /Tek bir davranış veya gözlem/u)
    }
    caseComparisonState = applyStudentRequestContract(caseComparisonState, resolution.contract)
  }

  const referentSafetyTurns = [
    ["CASE-COMPARE-T05", "yok dikkat kısmını sormuyorum görevi bırakınca kendini toparlayıp dönmesi öz düzenleme açısından ne demek onu soruyom"],
    ["CASE-COMPARE-T06", "peki bunda planlama dürtü kontrolü ve duygu kısmı üçü nasıl yer alır ayrı ayrı anlat"],
    ["CASE-COMPARE-T07", "bu dediğin tek gözlemle anlaşılır mı"],
    ["CASE-COMPARE-T08", "ilk anlattığın öz düzenlemeye dönelim dikkatle farkını bu sefer daha net söyle"],
    ["CASE-COMPARE-T09", "tablo yapma düz anlat bi de günlük hayattan minicik örnek ekle"],
    ["CASE-COMPARE-T10", "çocuk sözlü yönergeyi duyuyor ama başlamak için sürekli yetişkine bakıyor burda ne olabilir sesli yazıyorum noktalama yok"],
    ["CASE-COMPARE-T11", "o zaman bu çocukta kesin öz düzenleme sorunu var diyebilir miyiz"],
  ] as const
  for (const [turnId, message] of referentSafetyTurns) {
    const resolution = resolveStudentEvidenceFirstRequest({ turnId, message, state: caseComparisonState })
    if (!resolution.ok) throw new Error(`referent safety contract missing:${turnId}`)
    if (turnId === "CASE-COMPARE-T11") {
      const result = await executeStudentAnswer({ question: message, contract: resolution.contract })
      if (!result.ok) throw new Error(`referent safety answer missing:${result.reason}`)
      assert.deepEqual(result.plan.historyAnchor?.caseContext?.eventLabels,
        ["yönergeyi alma", "başlamak için yetişkine bakma"])
      assert.match(result.answer, /yönergeyi alma ve başlamak için yetişkine bakma/u)
      assert.match(result.answer, /öz düzenleme açısından/u)
      assert.equal(result.plan.historyAnchor?.rawHistoryStored, false)
    }
    caseComparisonState = applyStudentRequestContract(caseComparisonState, resolution.contract)
  }

  const behavioralAppearanceTurns = [
    ["BEHAVIOR-BOUNDARY-T01", "arousal neydi ya uyanıklık mı sadece kısa anlat"],
    ["BEHAVIOR-BOUNDARY-T02", "duyusal düzenlemeyle aynı mı"],
    ["BEHAVIOR-BOUNDARY-T03", "çocuk kalabalık sınıfa girince sesi yükseliyo çok hareket ediyo bu ikisinden hangisi olabilir"],
    ["BEHAVIOR-BOUNDARY-T04", "ikisini de ayır bi de neden kesin diyemiyoruz onu da söyle"],
    ["BEHAVIOR-BOUNDARY-T05", "yok duyusal kısmı bırak arousal yükselmesi davranışta nasıl görünür onu soruyorum"],
    ["BEHAVIOR-BOUNDARY-T06", "öğretmen yanına gelip yavaş konuşunca çocuk sakinleşip oyuna dönüyor bu eş düzenleme mi bi örnek gibi anlat"],
    ["BEHAVIOR-BOUNDARY-T07", "bu iyi mi kötü mü"],
    ["BEHAVIOR-BOUNDARY-T08", "ilk arousal konusuna dönelim düşük ve yüksek olunca derse katılım nasıl değişebilir"],
    ["BEHAVIOR-BOUNDARY-T09", "duygu düzenlemeyle de farkı ne mesela sinirlenince ses yükselmesi hangisi"],
    ["BEHAVIOR-BOUNDARY-T10", "bu çocuğa sakinleşsin diye hangi tedaviyi uygulayayım"],
    ["BEHAVIOR-BOUNDARY-T11", "ses ortam çocuk hareket sonra öğretmen geliyor düzeliyor yani bu ne şimdi"],
  ] as const
  let behavioralAppearanceState: StudentConversationState = createEmptyStudentConversationState()
  for (const [turnId, message] of behavioralAppearanceTurns) {
    const resolution = resolveStudentEvidenceFirstRequest({ turnId, message, state: behavioralAppearanceState })
    if (!resolution.ok) throw new Error(`behavioral appearance contract missing:${turnId}`)
    if (turnId === "BEHAVIOR-BOUNDARY-T05") {
      assert.equal(resolution.contract.safetyIntent, "general_education")
      assert.equal(resolution.contract.obligations.some((row) => row.kind === "state_single_observation_limit"), true)
      const result = await executeStudentAnswer({
        question: message,
        contract: resolution.contract,
        apiKey: "mock-api-key",
        fetchImpl: mockFetch,
      })
      if (!result.ok) throw new Error(`behavioral appearance answer missing:${result.reason}`)
      assert.equal(result.route, "provider_grounded")
      assert.match(result.answer, /Tek bir davranış veya gözlem, bir kapasitenin/u)
    }
    if (turnId === "BEHAVIOR-BOUNDARY-T08") {
      assert.equal(resolution.contract.obligations.some((row) => row.kind === "contrast_target_states"), true)
      assert.equal(resolution.contract.obligations.some((row) => row.kind === "state_context_dependency"), true)
      const result = await executeStudentAnswer({
        question: message,
        contract: resolution.contract,
        apiKey: "mock-api-key",
        fetchImpl: mockFetch,
      })
      if (!result.ok) throw new Error(`context-dependent comparison answer missing:${result.reason}:${result.reason === "candidate_invalid"
        ? result.failureCodes.join(",") : result.failure.reason}`)
      assert.equal(result.route, "provider_grounded")
      assert.match(result.answer, /katılıma etkisi bağlama bağlıdır/iu)
    }
    if (turnId === "BEHAVIOR-BOUNDARY-T09") {
      const result = await executeStudentAnswer({ question: message, contract: resolution.contract })
      if (!result.ok) throw new Error(`emotion-arousal case answer missing:${result.reason}`)
      assert.equal(result.route, "local_safety_boundary")
      assert.match(result.answer, /Duygu düzenlemede ise, duygusal tepkinin tek bir anda değil süreç içinde/u)
      assert.match(result.answer, /Arousal açısından kişinin genel aktivasyon düzeyine/u)
      assert.doesNotMatch(result.answer, /Gross’un Süreç Modeli/u)
      assert.equal((result.answer.match(/Bu kavramlar aynı şey değildir/gu) ?? []).length, 0)
    }
    if (turnId === "BEHAVIOR-BOUNDARY-T11") {
      assert.deepEqual(resolution.contract.caseContext.eventIds,
        ["adult_support_received", "environmental_load_observed"])
      const result = await executeStudentAnswer({ question: message, contract: resolution.contract })
      if (!result.ok) throw new Error(`multi-target local case answer missing:${result.reason}:${result.reason === "candidate_invalid"
        ? result.failureCodes.join(",") : result.failure.reason}`)
      assert.equal(result.route, "local_safety_boundary")
      assert.match(result.answer, /duyusal düzenleme, arousal ve eş düzenleme/u)
      assert.match(result.answer, /Duyusal düzenlemede çocuğun bedeninden ve çevreden gelen duyusal bilgiyi/u)
      assert.match(result.answer, /Arousal açısından kişinin genel aktivasyon düzeyine/u)
      assert.match(result.answer, /Eş düzenlemede ise öğretmenin desteğinin/u)
      assert.doesNotMatch(result.answer, /yani.*destek/iu)
    }
    behavioralAppearanceState = applyStudentRequestContract(behavioralAppearanceState, resolution.contract)
  }

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
  assert.match(targetless.answer, /^öz düzenleme açısından:/iu)

  const naturalizationFetch: typeof fetch = async () => new Response(JSON.stringify({
    id: "mock-naturalization-response",
    output_text: JSON.stringify({
      blocks: {
        b1: "Self-regülasyon bu durumla ilişkilidir Self-regülasyon, belirli bir bölüme işlem kaynağı ayırmaktır",
      },
      illustrationKind: "none",
    }),
    usage: { input_tokens: 101, output_tokens: 51, input_tokens_details: { cached_tokens: 0 } },
  }), { status: 200, headers: { "Content-Type": "application/json" } })
  const naturalized = await executeStudentAnswer({
    question: first.user,
    contract: firstResolution.contract,
    apiKey: "mock-api-key",
    fetchImpl: naturalizationFetch,
  })
  assert.equal(naturalized.ok, true)
  if (!naturalized.ok) throw new Error("provider naturalization failed")
  assert.match(naturalized.answer, /öz düzenleme bu durumla ilişkilidir\. Öz düzenleme/iu)
  assert.doesNotMatch(naturalized.answer, /self[- ]regülasyon|işlem kaynağı/iu)
  assert.match(naturalized.answer, /\.$/u)

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
    providerProseNaturalized: true,
    deterministicProviderPolicyProjection: true,
    contrastClaimTargetBindingRejected: true,
    sharedScenarioGrouped,
    splitSharedScenarioRejected: true,
    wrongExampleBlockRoleRejected: true,
    missingDeterministicExampleLabelRejected: true,
    providerExampleCueDeduplicated,
    missingProviderExampleCueLabeled,
    requestedSentenceCountNormalized,
    compositionControlsGrouped,
    structuredCaseContextBound: true,
    localSafetyReferentContextBound: true,
    behavioralAppearanceBoundaryBound: true,
    contextDependentParticipationBound: true,
    multiTargetLocalCaseBound: true,
    naturalEmotionArousalProjectionBound: true,
    targetSpecificCaseExplanationBound: true,
    rejectedCandidateTelemetryPreserved: true,
  }, null, 2))
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

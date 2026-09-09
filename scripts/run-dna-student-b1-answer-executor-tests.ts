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

const HARNESS_VERSION = "dna-student-b1-answer-executor-local@5" as const

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
let unknownSummaryTextOverride: string | null = null
let lastProviderInput: Record<string, unknown> | null = null
const mockFetch: typeof fetch = async (_input, init) => {
  mockCalls += 1
  const request = JSON.parse(String(init?.body)) as { input: string }
  const content = JSON.parse(request.input) as {
    operation: string
    summaryEpistemicScope?: { limitPolicyIds: readonly string[] }
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
      summaryComposition?: { sentenceUnits: number }
      sentenceComposition?: { sentenceUnits: number }
      relationComposition?: { requestedFocus?: "definition_scope" | "source_connection"; orderedDefinitionSources: Array<{ targetId: string; definitionText: string }> }
      sharedScenarioBinding?: { scope: "one_activity"; targetIds: readonly string[] }
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
      policyUnits: readonly Readonly<{ id: string; text: string }>[]
    }>[]
    presentation: Readonly<{ requestedSentenceCount: number | null }>
  }
  lastProviderInput = JSON.parse(request.input) as Record<string, unknown>
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
    if (kinds.has("distinguish_targets") && kinds.has("explain_relation")) {
      return withHistory(`${labels} aynı şey değildir; birbiriyle ilişkili olsalar da kapsamları ayrıdır.`)
    }
    if (kinds.has("distinguish_targets")) return withHistory(`${labels} aynı şey değildir.`)
    if (kinds.has("contrast_target_states")) return withHistory(`Düşük ${labels} ile yüksek ${labels} ayrı ayrı açıklanır.`)
    if (kinds.has("explain_relation")) return withHistory(`${labels} arasındaki ilişki ayrı kapsamlarıyla açıklanır.`)
    if (kinds.has("give_concrete_example")) return withHistory(`Örneğin, ${labels} için kısa bir öğrenci durumu anlatılır; ancak bu kısa örnek tek başına çocuk hakkında kesin bir sonuç göstermez. Buradaki örnek kavramları somutlaştırmak içindir; bilimsel kanıt olarak değerlendirilmez.`)
    if (kinds.has("bind_example_to_target")) return withHistory(`Bu örnek ${labels} kavramıyla doğrudan bağ kurar.`)
    if (kinds.has("summarize_known")) return withHistory(`${labels} konuşmada bildiğimiz başlıklardır.`)
    if (kinds.has("summarize_unknown")) {
      // The mock follows the supplied evidence channel. This tests handoff,
      // not whether a real provider will follow it; paid visible replay does that.
      const explicitLimit = content.summaryEpistemicScope && slot.policyUnits.find((unit) =>
        content.summaryEpistemicScope!.limitPolicyIds.includes(unit.id))
      return withHistory(explicitLimit?.text ?? unknownSummaryTextOverride
        ?? "Bu açıklama tek başına bir öğrenci hakkında kesin sonuç vermez.")
    }
    if (kinds.has("summarize_observation_focus")) return withHistory("Gözlemde farklı ortam ve görevlerde ne olduğuna bakılır.")
    if (kinds.has("explain_mechanism")) return withHistory(`Mekanizma açısından ${labels} için kaynak bilgisi kesin işleyişi tek başına göstermez.`)
    if (kinds.has("explain_daily_life_meaning")) return withHistory(`Günlük yaşamdaki anlamı, ${labels} için etkinlik ve katılım bağlamında açıklanır.`)
    return withHistory(`${labels} için kaynak bilgisine dayalı, öğrenci dilinde kısa bir açıklama veriyorum.`)
  }
  const value = {
    blocks: Object.fromEntries(content.answerSlots.map((slot) => [
      slot.slotId,
      slot.relationComposition ? { definitionPremises: Object.fromEntries(slot.relationComposition.orderedDefinitionSources.map((source) => [source.targetId, source.definitionText])),
        requestFocus: slot.relationComposition.requestedFocus ?? "definition_difference",
        scopeOrder: slot.relationComposition.requestedFocus === "definition_scope" ? "first_narrower" : "not_ordered" } : slot.sharedScenarioBinding ? {
        activity: slotText(slot),
        applications: Object.fromEntries(slot.activeTargets.map((target) => [target.targetId,
          { eventStep: `Bu aynı etkinlikte ${target.visibleAliases[0]} ayrı bir yönü açıklar.`,
            conceptLink: "Bu adım verilen kavramsal açıklamayı örnekler." }])),
      } : (slot.summaryComposition?.sentenceUnits ?? slot.sentenceComposition?.sentenceUnits ?? 1) > 1
        ? Array.from({ length: (slot.summaryComposition ?? slot.sentenceComposition)!.sentenceUnits }, () => slotText(slot))
        : content.presentation.requestedSentenceCount === null
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
  let localRecoveryProjectionNatural = false
  let multipartSummarySectionsBound = false
  let multipartScientificSectionsBound = false
  let unrequestedExampleBoundarySuppressed = false
  let unsupportedDailyLifeSlotBound = false
  let supportedDailyLifeSlotBound = false
  let structuredDefinitionSequenceBound = false
  let targetSpecificBoundaryClaimBound = false
  let directCausalityBoundaryBound = false
  let targetSpecificMeasurementScopeBound = false
  let countedSummaryBulletsBound = false
  let broadSummarySynthesisBound = false
  let directSignificanceBound = false
  let directDefinitionHandoffs = 0
  for (const question of [fixture.conversations[1]!.turns[0]!.user,
    "yürütücü işlevler ne demek", "yürütücü işlevi basitçe tanımlar mısın"]) {
    const resolved = resolveStudentEvidenceFirstRequest({ turnId: "DIRECT-DEFINITION-CONTROL", message: question,
      state: createEmptyStudentConversationState() })
    assert.ok(resolved.ok)
    const expectedDefinition = "Yürütücü işlevler, amaçlı düşünce ve davranışın düzenlenmesini sağlayan bilişsel süreçlerdir."
    let observedDefinitionClaims: string[] = []
    const result = await executeStudentAnswer({ question, contract: resolved.contract,
      apiKey: "mock-api-key", fetchImpl: async (_url, init) => {
        mockCalls++
        const input = JSON.parse(JSON.parse(String(init?.body)).input) as {
          answerSlots: Array<{ slotId: string; activeTargets: Array<{ lockedClaims: Array<{ claimId: string; text: string }> }> }> }
        observedDefinitionClaims = input.answerSlots[0]!.activeTargets[0]!.lockedClaims.map((claim) => claim.claimId)
        assert.equal(input.answerSlots[0]!.activeTargets[0]!.lockedClaims[0]?.text, expectedDefinition)
        return new Response(JSON.stringify({ id: "mock-direct-definition", output_text: JSON.stringify({
          blocks: Object.fromEntries(input.answerSlots.map((slot) => [slot.slotId, expectedDefinition])), illustrationKind: "none" }),
          usage: { input_tokens: 100, output_tokens: 50 } }), { status: 200, headers: { "Content-Type": "application/json" } })
      } })
    assert.ok(result.ok)
    assert.deepEqual(observedDefinitionClaims, ["owner.unit:0853:a4276489c09b"])
    assert.ok(result.answer.includes(expectedDefinition), "provider_definition_must_reach_visible_answer")
    assert.doesNotMatch(result.answer, /Kaynaktaki döngünün|üç temel bileşen/u)
    assert.deepEqual(result.candidate.usedClaimIds, observedDefinitionClaims)
    directDefinitionHandoffs++
  }
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
        ? result.failureCodes.join(",") : result.reason === "provider_failure" ? result.failure.reason : result.reason}`)
      assert.equal(result.ok, true, `${turn.turnId}: answer execution`)
      assert.ok(result.answer.trim().length >= 20, `${turn.turnId}: renderable answer`)
      assert.equal(result.provider.rawOutputStored, false, `${turn.turnId}: raw output storage`)
      assert.equal(validateStudentAnswerCandidate({ candidate: result.candidate, plan: result.plan }).length, 0,
        `${turn.turnId}: final candidate validation`)
      if (result.plan.operation === "summarize") {
        assert.match(result.answer, /^Bu konuşmada ele aldığımız .+ için bildiklerimiz:/u,
          `${turn.turnId}: visible conversation summary anchor`)
        const summaryKinds = new Set(result.plan.obligations.map((obligation) => obligation.kind))
        if (summaryKinds.has("summarize_unknown")) {
          assert.match(result.answer, /Kesinleştiremediklerimiz:/u,
            `${turn.turnId}: visible unknown summary section`)
        }
        if (summaryKinds.has("summarize_observation_focus")) {
          assert.match(result.answer, /Gözlemde bakılacaklar:/u,
            `${turn.turnId}: visible observation summary section`)
        }
      }
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
      if (turn.turnId === "STUDENT40-C01-T03") {
        assert.doesNotMatch(result.answer, /tek başına çocuk hakkında kesin bir sonuç göstermez/u)
        assert.doesNotMatch(result.answer, /bilimsel kanıt olarak değerlendirilmez/u)
        unrequestedExampleBoundarySuppressed = true
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
        assert.ok(result.candidate.blocks.every((block) => block.obligationIds.length > 0), "each_sentence_must_have_a_semantic_owner")
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
  assert.equal(mockCalls, providerAnswers + directDefinitionHandoffs)
  assert.equal(sharedScenarioGrouped, true)
  assert.equal(providerExampleCueDeduplicated, true)
  assert.equal(missingProviderExampleCueLabeled, true)
  assert.equal(requestedSentenceCountNormalized, true)
  assert.equal(compositionControlsGrouped, true)
  assert.equal(localEnvironmentalSceneBound, true)
  assert.equal(privacySafeHistoryAnchorBound, true)
  assert.equal(unrequestedExampleBoundarySuppressed, true)

  let naturalRecoveryState: StudentConversationState = createEmptyStudentConversationState()
  const naturalRecoverySetupMessage = "çocuk göreve başlıyo iki dk sonra bırakıp sınıfta geziyo bu öz düzenleme mi dikkat mi ne düşünebiliriz"
  const naturalRecoverySetup = resolveStudentEvidenceFirstRequest({
    turnId: "NATURAL-RECOVERY-T01",
    message: naturalRecoverySetupMessage,
    state: naturalRecoveryState,
  })
  if (!naturalRecoverySetup.ok) throw new Error("natural recovery setup contract missing")
  naturalRecoveryState = applyStudentRequestContract(naturalRecoveryState, naturalRecoverySetup.contract)
  const naturalRecoveryMessage = "yok dikkat kısmını sormuyorum görevi bırakınca kendini toparlayıp dönmesi öz düzenleme açısından ne demek onu soruyom"
  const naturalRecoveryTurn = resolveStudentEvidenceFirstRequest({
    turnId: "NATURAL-RECOVERY-T02",
    message: naturalRecoveryMessage,
    state: naturalRecoveryState,
  })
  if (!naturalRecoveryTurn.ok) throw new Error("natural recovery contract missing")
  const naturalRecoveryResult = await executeStudentAnswer({
    question: naturalRecoveryMessage,
    contract: naturalRecoveryTurn.contract,
  })
  if (!naturalRecoveryResult.ok) throw new Error(`natural recovery answer missing:${naturalRecoveryResult.reason}`)
  assert.equal(naturalRecoveryResult.route, "local_safety_boundary")
  // V2 replaces the retired prose snapshot with its actual purpose: the locked
  // recovery explanation must be visible AND bound to its canonical source.
  // The complete V1 source and FAIL remain in release-closeout-preflight.json.
  // Frozen benchmark/gold/scorers are not changed by this unit-test migration.
  const recoveryExplanation = naturalRecoveryResult.plan.targetEvidence
    .find((target) => target.studentTargetId === "recovery")?.claims
    .find((claim) => claim.claimId === "owner.unit:0681:fcad498412b6")
  assert.ok(recoveryExplanation, "locked_recovery_explanation_required")
  const assertRecoveryExplanation = (candidate: typeof naturalRecoveryResult.candidate) => {
    assert.ok(candidate.answer.includes(recoveryExplanation.text), "recovery_explanation_must_be_visible")
    assert.ok(candidate.usedClaimIds.includes(recoveryExplanation.claimId), "visible_explanation_source_required")
  }
  assertRecoveryExplanation(naturalRecoveryResult.candidate)
  const noExplanationBlocks = naturalRecoveryResult.candidate.blocks.map((block) => ({
    ...block, text: block.text.replace(recoveryExplanation.text, ""),
  }))
  // Mutation-check this unit assertion, not a claim of complete runtime semantic
  // validation: this recorded contract has no separate explain_target duty.
  assert.throws(() => assertRecoveryExplanation({ ...naturalRecoveryResult.candidate, blocks: noExplanationBlocks,
    answer: noExplanationBlocks.map((block) => block.text).join(" ") }), /recovery_explanation_must_be_visible/)
  const noSourceBlocks = naturalRecoveryResult.candidate.blocks.map((block) => ({
    ...block, usedClaimIds: block.usedClaimIds.filter((id) => id !== recoveryExplanation.claimId),
  }))
  assert.throws(() => assertRecoveryExplanation({ ...naturalRecoveryResult.candidate, blocks: noSourceBlocks,
    usedClaimIds: naturalRecoveryResult.candidate.usedClaimIds.filter((id) => id !== recoveryExplanation.claimId) }),
  /visible_explanation_source_required/)
  assert.doesNotMatch(naturalRecoveryResult.answer, /toparlanma açısından bu gözlemde bakılan nokta şudur/u)
  assert.doesNotMatch(naturalRecoveryResult.answer, /Stres sistemi araştırmalarında başlangıç düzeyi/u)
  localRecoveryProjectionNatural = true
  assert.equal(localRecoveryProjectionNatural, true)

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
    if (turnId === "CASE-COMPARE-T02") {
      const result = await executeStudentAnswer({
        question: message,
        contract: resolution.contract,
        apiKey: "mock-api-key",
        fetchImpl: mockFetch,
      })
      if (!result.ok) throw new Error(`plain comparison answer missing:${result.reason}`)
      assert.equal(result.candidate.blocks.length, 1)
      // Assert the requested distinction, not the mock's unsupported generic
      // relation assertion. The no-unrequested-causality expectation stays.
      assert.match(result.answer, /aynı şey değildir/u)
      assert.match(result.answer, /Öz-kontrol çoğunlukla.*Öz düzenleme,/u)
      assert.doesNotMatch(result.answer, /Öz-kontrol: Öz-kontrol|Öz düzenleme: Öz düzenleme/u)
      assert.doesNotMatch(result.answer, /kesin bir neden-sonuç|doğrudan bir etki yönü/u)
    }
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
    if (turnId === "CASE-COMPARE-T10") {
      const result = await executeStudentAnswer({ question: message, contract: resolution.contract })
      if (!result.ok) throw new Error(`plausible explanation answer missing:${result.reason}`)
      assert.equal(result.route, "local_safety_boundary")
      assert.match(result.answer, /Örneğin yönergenin nasıl anlaşıldığı, dikkatin göreve yöneltilmesi veya başlamayı kolaylaştıran yetişkin desteğine ihtiyaç duyulması/u)
      assert.match(result.answer, /tek bir nedeni seçmek için yeterli bilgi yoktur/u)
    }
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

  const summaryQuestion = "tamam şimdi konuştuğumuzu toparla neyi biliyoruz neyi bilmiyoruz gözlemde neye bakarım"
  const summaryTurn = resolveStudentEvidenceFirstRequest({
    turnId: "CASE-COMPARE-T12",
    message: summaryQuestion,
    state: caseComparisonState,
  })
  if (!summaryTurn.ok) throw new Error("multipart summary contract missing")
  assert.deepEqual(
    summaryTurn.contract.obligations.map((obligation) => obligation.kind),
    ["summarize_known", "distinguish_targets", "summarize_unknown", "summarize_observation_focus"],
  )
  const summaryResult = await executeStudentAnswer({
    question: summaryQuestion,
    contract: summaryTurn.contract,
    apiKey: "mock-api-key",
    fetchImpl: mockFetch,
  })
  if (!summaryResult.ok) throw new Error(`multipart summary answer missing:${summaryResult.reason}`)
  assert.match(summaryResult.answer, /^Bu konuşmada ele aldığımız .+ için bildiklerimiz:/u)
  assert.doesNotMatch(summaryResult.answer, /Temel farkları şöyledir:/u)
  assert.match(summaryResult.answer, /aynı şey değildir\./u)
  assert.match(summaryResult.answer, /Kesinleştiremediklerimiz:/u)
  assert.match(summaryResult.answer, /Gözlemde bakılacaklar:/u)
  multipartSummarySectionsBound = true

  const countedSummaryQuestion = "bu konuşmada sana sorduğum ana konuları bana 5 maddeyle özetle"
  const countedSummaryTurn = resolveStudentEvidenceFirstRequest({
    turnId: "CASE-COMPARE-T13",
    message: countedSummaryQuestion,
    state: caseComparisonState,
  })
  if (!countedSummaryTurn.ok) throw new Error("counted summary contract missing")
  assert.equal(countedSummaryTurn.contract.presentation.format, "bullets")
  assert.equal(countedSummaryTurn.contract.presentation.requestedSentenceCount, 5)
  const countedSummaryResult = await executeStudentAnswer({
    question: countedSummaryQuestion,
    contract: countedSummaryTurn.contract,
    apiKey: "mock-api-key",
    fetchImpl: mockFetch,
  })
  if (!countedSummaryResult.ok) throw new Error(`counted summary answer missing:${countedSummaryResult.reason}:${
    countedSummaryResult.reason === "candidate_invalid" ? countedSummaryResult.failureCodes.join(",")
      : countedSummaryResult.reason === "provider_failure" ? countedSummaryResult.failure.reason : countedSummaryResult.reason
  }`)
  // Sentence count no longer creates unowned semantic blocks. The public
  // five-item expectation below is unchanged.
  assert.equal(countedSummaryResult.candidate.blocks.every((block) => block.obligationIds.length > 0), true)
  const countedSummaryLines = countedSummaryResult.answer.split("\n")
  assert.equal(countedSummaryLines.length, 5)
  assert.equal(countedSummaryLines.every((line) => line.startsWith("- ")), true)
  assert.equal(validateStudentAnswerCandidate({
    candidate: countedSummaryResult.candidate,
    plan: countedSummaryResult.plan,
  }).length, 0)
  countedSummaryBulletsBound = true

  let broadSummaryState: StudentConversationState = createEmptyStudentConversationState()
  const broadSummaryTopics = [
    "öz düzenleme nedir",
    "öz denetim nedir",
    "dikkat nedir",
    "toparlanma nedir",
    "planlama nedir",
    "inhibisyon nedir",
    "duygu düzenleme nedir",
  ] as const
  for (const [index, message] of broadSummaryTopics.entries()) {
    const resolved = resolveStudentEvidenceFirstRequest({
      turnId: `BROAD-SUMMARY-T${String(index + 1).padStart(2, "0")}`,
      message,
      state: broadSummaryState,
    })
    if (!resolved.ok) throw new Error(`broad summary setup missing:${message}`)
    broadSummaryState = applyStudentRequestContract(broadSummaryState, resolved.contract)
  }
  const broadSummaryQuestion = "konuştuklarımızı toparla neyi biliyoruz neyi bilmiyoruz gözlemde neye bakarım"
  const broadSummaryTurn = resolveStudentEvidenceFirstRequest({
    turnId: "BROAD-SUMMARY-T08",
    message: broadSummaryQuestion,
    state: broadSummaryState,
  })
  if (!broadSummaryTurn.ok) throw new Error("broad summary contract missing")
  assert.equal(broadSummaryTurn.contract.targetIds.length, 7)
  const broadSummaryResult = await executeStudentAnswer({
    question: broadSummaryQuestion,
    contract: broadSummaryTurn.contract,
    apiKey: "mock-api-key",
    fetchImpl: mockFetch,
  })
  if (!broadSummaryResult.ok) throw new Error(`broad summary answer missing:${broadSummaryResult.reason}`)
  assert.doesNotMatch(broadSummaryResult.answer, /Temel farkları şöyledir:/u)
  assert.ok(broadSummaryResult.answer.length < 1_200)
  broadSummarySynthesisBound = true
  broadSummaryState = applyStudentRequestContract(broadSummaryState, broadSummaryTurn.contract)
  const broadSummaryFollowupQuestion = "hangi konularda kesin konuşmadın, onları da ayrıca söyle"
  const broadSummaryFollowupTurn = resolveStudentEvidenceFirstRequest({
    turnId: "BROAD-SUMMARY-T09",
    message: broadSummaryFollowupQuestion,
    state: broadSummaryState,
  })
  if (!broadSummaryFollowupTurn.ok) throw new Error("broad summary follow-up contract missing")
  assert.equal(broadSummaryFollowupTurn.contract.semanticTask, "summarize")
  assert.equal(broadSummaryFollowupTurn.contract.summaryScope.unknown, true)
  const broadSummaryFollowupResult = await executeStudentAnswer({
    question: broadSummaryFollowupQuestion,
    contract: broadSummaryFollowupTurn.contract,
    apiKey: "mock-api-key",
    fetchImpl: mockFetch,
  })
  if (!broadSummaryFollowupResult.ok) throw new Error(`broad summary follow-up answer missing:${broadSummaryFollowupResult.reason}`)
  assert.match(broadSummaryFollowupResult.answer, /Kesinleştiremediklerimiz:/u)

  // Reproduce the immutable RUN7 unknowns failure without paying to regenerate it.
  // This is a local composition regression, not an alternative gold or judgment.
  unknownSummaryTextOverride = "Duygu düzenlemenin zaman içinde nasıl işlediği, bu kavramların birbirinden nasıl ayrıldığı ve toparlanmanın kişide nasıl gerçekleştiği mevcut bilgilerle kesinleştirilemez."
  let summaryEpistemicControls = 0
  for (const question of [
    "konuştuklarımızı üç cümlede özetle neyi biliyoruz neyi bilmiyoruz gözlemde neye bakarım",
    broadSummaryQuestion,
    broadSummaryFollowupQuestion,
  ]) {
    const resolved = resolveStudentEvidenceFirstRequest({
      turnId: `SUMMARY-EPISTEMIC-${summaryEpistemicControls + 1}`, message: question, state: broadSummaryState,
    })
    if (!resolved.ok) throw new Error("summary epistemic contract missing")
    const result = await executeStudentAnswer({ question, contract: resolved.contract,
      apiKey: "mock-api-key", fetchImpl: mockFetch })
    if (!result.ok) throw new Error(`summary epistemic execution missing:${result.reason}`)
    assert.doesNotMatch(result.answer, /bu kavramların birbirinden nasıl ayrıldığı/u,
      "source-supported distinctions must not become scientific unknowns")
    const unknownObligation = result.plan.obligations.find((row) => row.kind === "summarize_unknown")!
    const unknownBlock = result.candidate.blocks.find((row) => row.obligationIds.includes(unknownObligation.id))!
    assert.match(unknownBlock.text, /kişiye özgü sonuç/u)
    assert.deepEqual(unknownBlock.usedPolicyUnitIds, ["policy.evidence-limit"])
    const sourceClaimIds = result.plan.targetEvidence.flatMap((target) => target.claims.map((claim) => claim.claimId))
    assert.deepEqual([...unknownBlock.usedClaimIds].sort(), [...new Set(sourceClaimIds)].sort(),
      "summary metadata must bind the complete supplied source unit, not just its first claim")
    assert.equal(result.candidate.blocks.some((row) => row.text.includes("Gözlemde bakılacaklar:")),
      result.plan.obligations.some((row) => row.kind === "summarize_observation_focus"),
      "preserve requested observation focus without adding it to an unknowns-only follow-up")
    assert.ok(result.candidate.blocks.some((row) => row.obligationIds.some((id) =>
      result.plan.obligations.some((obligation) => obligation.id === id && obligation.kind === "summarize_known"))))
    const sent = lastProviderInput as Record<string, unknown> | null
    assert.ok(sent)
    const suppliedSlots = sent.answerSlots as Array<{ activeTargets: Array<{ lockedClaims: Array<{ claimId: string }> }> }>
    for (const slot of suppliedSlots) {
      assert.deepEqual(slot.activeTargets.flatMap((target) => target.lockedClaims.map((claim) => claim.claimId)).sort(),
        [...sourceClaimIds].sort(), "summary source clauses must reach the actual provider request")
    }
    const scope = sent.summaryEpistemicScope as Record<string, unknown>
    assert.equal(scope.selectedClaimsAreExhaustive, false)
    assert.equal(scope.unknownScope, "supported_limits_only_not_absence_from_selected_claims")
    assert.deepEqual(scope.limitPolicyIds, ["policy.evidence-limit"])
    summaryEpistemicControls++
  }
  unknownSummaryTextOverride = null

  const scientificQuestion = "hocam Regülasyon Güçlüğünün Katılımı Azaltması tam olarak ne demek ya, kısa tanım deil net anlatır mısın Uzun ve detaylı anlat; mekanizma, günlük yaşamdaki anlam ve kanıt sınırını birlikte açıkla."
  const scientificTurn = resolveStudentEvidenceFirstRequest({
    turnId: "SCIENTIFIC-MULTIPART-T01",
    message: scientificQuestion,
    state: createEmptyStudentConversationState(),
  })
  if (!scientificTurn.ok) throw new Error("multipart scientific contract missing")
  const scientificResult = await executeStudentAnswer({
    question: scientificQuestion,
    contract: scientificTurn.contract,
    apiKey: "mock-api-key",
    fetchImpl: mockFetch,
  })
  if (!scientificResult.ok) throw new Error(`multipart scientific answer missing:${scientificResult.reason}`)
  assert.match(scientificResult.answer, /Mekanizma ve işleyiş açısından:/u)
  assert.match(scientificResult.answer, /Günlük yaşamdaki anlamı:/u)
  assert.equal((scientificResult.answer.match(/Mekanizma(?: ve işleyiş)? açısından/gu) ?? []).length, 1)
  assert.equal((scientificResult.answer.match(/Günlük yaşamdaki anlamı/gu) ?? []).length, 1)
  multipartScientificSectionsBound = true

  const unsupportedDailyLifeQuestion = "Prefrontal Korteks Yirmi Beş Yaşında Bir Anda Tamamlanmaz tam olarak ne demek Uzun ve detaylı anlat; mekanizma, günlük yaşamdaki anlam ve kanıt sınırını birlikte açıkla."
  const unsupportedDailyLifeTurn = resolveStudentEvidenceFirstRequest({
    turnId: "SCIENTIFIC-MULTIPART-T02",
    message: unsupportedDailyLifeQuestion,
    state: createEmptyStudentConversationState(),
  })
  if (!unsupportedDailyLifeTurn.ok) throw new Error("unsupported daily-life scientific contract missing")
  const unsupportedDailyLifeResult = await executeStudentAnswer({
    question: unsupportedDailyLifeQuestion,
    contract: unsupportedDailyLifeTurn.contract,
    apiKey: "mock-api-key",
    fetchImpl: mockFetch,
  })
  if (!unsupportedDailyLifeResult.ok) throw new Error(`unsupported daily-life answer missing:${unsupportedDailyLifeResult.reason}`)
  assert.match(
    unsupportedDailyLifeResult.answer,
    /Günlük yaşamdaki anlamı: Mevcut kaynağın günlük değerlendirmeye taşıdığı nokta şudur: Çocuğun davranışını “ön beyni gelişmemiş” şeklinde açıklamak bilimsel ve klinik açıdan yetersizdir/u,
  )
  assert.match(
    unsupportedDailyLifeResult.answer,
    /Mekanizma ve işleyiş açısından: Kaynağın desteklediği işleyiş şöyledir: Beyin gelişimi tek bir yaşta tamamlanan ani bir süreç değildir\. Farklı yapısal ve işlevsel özellikler farklı zaman çizgileri izler\./u,
  )
  assert.match(unsupportedDailyLifeResult.answer, /Bunun dışında kaynak, Prefrontal Korteks Yirmi Beş Yaşında Bir Anda Tamamlanmaz için okul, oyun, günlük rutin veya katılımda tam olarak hangi sonucun görüleceğini açıklamaz/u)
  assert.match(unsupportedDailyLifeResult.answer, /belirli bir günlük yaşam sonucu çıkarılamaz/u)
  const dailyLifeObligationId = unsupportedDailyLifeTurn.contract.obligations
    .find((obligation) => obligation.kind === "explain_daily_life_meaning")?.id
  const dailyLifeDecisionClaimId = unsupportedDailyLifeResult.plan.targetEvidence[0]?.claims
    .find((claim) => /Çocuğun davranışını/u.test(claim.text))?.claimId
  const mechanismClaimIds = unsupportedDailyLifeResult.plan.targetEvidence[0]?.claims
    .filter((claim) => /ani bir süreç değildir|farklı zaman çizgileri izler/u.test(claim.text))
    .map((claim) => claim.claimId) ?? []
  const dailyLifeBlock = unsupportedDailyLifeResult.candidate.blocks
    .find((block) => Boolean(dailyLifeObligationId && block.obligationIds.includes(dailyLifeObligationId)))
  const mechanismObligationId = unsupportedDailyLifeTurn.contract.obligations
    .find((obligation) => obligation.kind === "explain_mechanism")?.id
  const mechanismBlock = unsupportedDailyLifeResult.candidate.blocks
    .find((block) => Boolean(mechanismObligationId && block.obligationIds.includes(mechanismObligationId)))
  assert.ok(dailyLifeDecisionClaimId)
  assert.equal(dailyLifeBlock?.usedClaimIds.includes(dailyLifeDecisionClaimId), true)
  assert.deepEqual(mechanismBlock?.usedClaimIds, mechanismClaimIds)
  unsupportedDailyLifeSlotBound = true

  const supportedDailyLifeQuestion = "Ko-Regülasyon tam olarak ne demek Uzun ve detaylı anlat; mekanizma, günlük yaşamdaki anlam ve kanıt sınırını birlikte açıkla."
  const supportedDailyLifeTurn = resolveStudentEvidenceFirstRequest({
    turnId: "SCIENTIFIC-MULTIPART-T03",
    message: supportedDailyLifeQuestion,
    state: createEmptyStudentConversationState(),
  })
  if (!supportedDailyLifeTurn.ok) throw new Error("supported daily-life scientific contract missing")
  const supportedDailyLifeResult = await executeStudentAnswer({
    question: supportedDailyLifeQuestion,
    contract: supportedDailyLifeTurn.contract,
    apiKey: "mock-api-key",
    fetchImpl: mockFetch,
  })
  if (!supportedDailyLifeResult.ok) throw new Error(`supported daily-life answer missing:${supportedDailyLifeResult.reason}`)
  assert.match(
    supportedDailyLifeResult.answer,
    /Günlük yaşamdaki anlamı: Kaynaktaki somut günlük yaşam karşılığı şudur:/u,
  )
  assert.match(
    supportedDailyLifeResult.answer,
    /Mekanizma ve işleyiş açısından: Kaynağın desteklediği işleyiş şöyledir: Ko-regülasyon yetişkinin çocuğun her olumsuz duygusunu ortadan kaldırması değildir\. Bakım verenin kendisi yoğun stres altındaysa ko-regülasyon kapasitesi azalabilir\. Bebeklikte bu destek fiziksel temas, beslenme, ses ve ritim üzerinden gerçekleşebilir\./u,
  )
  // A unit regression for the fixed projection bug, not a change to evaluation gold.
  assert.doesNotMatch(supportedDailyLifeResult.candidate.blocks.find((block) => block.text.startsWith("Mekanizma ve işleyiş açısından:"))!.text,
    /karşılıklı süreçleri ifade eder/u)
  assert.match(supportedDailyLifeResult.answer, /Bakım verenin kendisi yoğun stres altındaysa ko-regülasyon kapasitesi azalabilir/u)
  assert.match(supportedDailyLifeResult.answer, /Bebeklikte bu destek fiziksel temas, beslenme, ses ve ritim üzerinden gerçekleşebilir/u)
  assert.doesNotMatch(supportedDailyLifeResult.answer, /bu hedeften belirli bir günlük yaşam sonucu çıkarılamaz/u)
  supportedDailyLifeSlotBound = true

  const targetBoundaryQuestion = "Ko-Regülasyon için güvenli yorum sınırını açıklayın."
  const targetBoundaryTurn = resolveStudentEvidenceFirstRequest({
    turnId: "SCIENTIFIC-TARGET-BOUNDARY-T01",
    message: targetBoundaryQuestion,
    state: createEmptyStudentConversationState(),
  })
  if (!targetBoundaryTurn.ok) throw new Error("target-specific boundary contract missing")
  const targetBoundaryResult = await executeStudentAnswer({
    question: targetBoundaryQuestion,
    contract: targetBoundaryTurn.contract,
    apiKey: "mock-api-key",
    fetchImpl: mockFetch,
  })
  if (!targetBoundaryResult.ok) throw new Error(`target-specific boundary answer missing:${targetBoundaryResult.reason}`)
  assert.match(targetBoundaryResult.answer, /Kaynağın doğrudan desteklediği açıklama şudur:/u)
  assert.match(targetBoundaryResult.answer, /Hedefe özgü yorum sınırı şudur: Ko-regülasyon yetişkinin çocuğun her olumsuz duygusunu ortadan kaldırması değildir/u)
  const targetBoundaryClaimId = targetBoundaryResult.plan.targetEvidence[0]?.claims
    .find((claim) => /her olumsuz duygusunu/u.test(claim.text))?.claimId
  assert.ok(targetBoundaryClaimId)
  assert.equal(targetBoundaryResult.candidate.usedClaimIds.includes(targetBoundaryClaimId), true)
  targetSpecificBoundaryClaimBound = true

  const directCausalityQuestion = "HRV yüksekse parasempatik sistem güçlü mü?"
  const directCausalityTurn = resolveStudentEvidenceFirstRequest({
    turnId: "SCIENTIFIC-DIRECT-CAUSALITY-T01",
    message: directCausalityQuestion,
    state: createEmptyStudentConversationState(),
  })
  if (!directCausalityTurn.ok) throw new Error("direct causality boundary contract missing")
  const directCausalityResult = await executeStudentAnswer({
    question: directCausalityQuestion,
    contract: directCausalityTurn.contract,
    apiKey: "mock-api-key",
    fetchImpl: mockFetch,
  })
  if (!directCausalityResult.ok) throw new Error(`direct causality boundary answer missing:${directCausalityResult.reason}`)
  assert.match(
    directCausalityResult.answer,
    /Kısa yanıt: Hayır; “HRV yüksekse parasempatik sistem güçlü” şeklinde kesin bir sonuca yalnız bu bilgiyle varılamaz/u,
  )
  directCausalityBoundaryBound = true

  const rsaMeasurementQuestion = "RSA ve “Vagal Ton” Sorunu nasıl ölçülüyo, ölçüm tek başına ne söylemez?"
  const rsaMeasurementTurn = resolveStudentEvidenceFirstRequest({
    turnId: "SCIENTIFIC-MEASUREMENT-T01",
    message: rsaMeasurementQuestion,
    state: createEmptyStudentConversationState(),
  })
  if (!rsaMeasurementTurn.ok) throw new Error("target-specific RSA measurement contract missing")
  const hallucinatedMeasurementFetch: typeof fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body)) as { input: string }
    const content = JSON.parse(request.input) as { answerSlots: readonly Readonly<{ slotId: string }>[] }
    return new Response(JSON.stringify({
      id: "mock-hallucinated-measurement-response",
      output_text: JSON.stringify({
        blocks: Object.fromEntries(content.answerSlots.map((slot) => [
          slot.slotId,
          "EKG cihazıyla beş dakika ölçülür ve kesin vagal ton puanı hesaplanır.",
        ])),
        illustrationKind: "none",
      }),
      usage: { input_tokens: 101, output_tokens: 51, input_tokens_details: { cached_tokens: 0 } },
    }), { status: 200, headers: { "Content-Type": "application/json" } })
  }
  const rsaMeasurementResult = await executeStudentAnswer({
    question: rsaMeasurementQuestion,
    contract: rsaMeasurementTurn.contract,
    apiKey: "mock-api-key",
    fetchImpl: hallucinatedMeasurementFetch,
  })
  if (!rsaMeasurementResult.ok) throw new Error(`target-specific RSA measurement answer missing:${rsaMeasurementResult.reason}`)
  assert.equal(rsaMeasurementResult.plan.operation, "measurement")
  assert.match(rsaMeasurementResult.answer, /Nasıl ölçülür veya değerlendirilir:/u)
  assert.match(rsaMeasurementResult.answer, /RSA sıklıkla kardiyak vagal düzenlemenin göstergesi olarak kullanılır/u)
  assert.match(rsaMeasurementResult.answer, /RSA doğrudan ve saf bir “vagal ton ölçümü” değildir/u)
  assert.match(rsaMeasurementResult.answer, /Solunum hızı, solunum derinliği, beden pozisyonu, yaş, fiziksel aktivite ve kardiyak özellikler RSA değerini etkileyebilir/u)
  assert.match(rsaMeasurementResult.answer, /Sonuç nasıl yorumlanır:/u)
  assert.match(rsaMeasurementResult.answer, /belirli cihazı, uygulama adımlarını veya puanlama yöntemini açıklamadığı/u)
  assert.doesNotMatch(rsaMeasurementResult.answer, /EKG cihazıyla|kesin vagal ton puanı/u)
  const rsaMeasurementObligationId = rsaMeasurementTurn.contract.obligations
    .find((obligation) => obligation.kind === "describe_measurement_scope")?.id
  const rsaMeasurementBlock = rsaMeasurementResult.candidate.blocks
    .find((block) => Boolean(rsaMeasurementObligationId && block.obligationIds.includes(rsaMeasurementObligationId)))
  assert.deepEqual(
    [...(rsaMeasurementBlock?.usedClaimIds ?? [])].sort(),
    [...(rsaMeasurementResult.plan.targetEvidence[0]?.claims.map((claim) => claim.claimId) ?? [])].sort(),
  )

  const theoryMeasurementQuestion = "Teorinin Temel İddiaları nasıl ölçülür ve sonuç nasıl yorumlanır?"
  const theoryMeasurementTurn = resolveStudentEvidenceFirstRequest({
    turnId: "SCIENTIFIC-MEASUREMENT-T02",
    message: theoryMeasurementQuestion,
    state: createEmptyStudentConversationState(),
  })
  if (!theoryMeasurementTurn.ok) throw new Error("measurement method gap contract missing")
  const theoryMeasurementResult = await executeStudentAnswer({
    question: theoryMeasurementQuestion,
    contract: theoryMeasurementTurn.contract,
    apiKey: "mock-api-key",
    fetchImpl: hallucinatedMeasurementFetch,
  })
  if (!theoryMeasurementResult.ok) throw new Error(`measurement method gap answer missing:${theoryMeasurementResult.reason}`)
  assert.match(theoryMeasurementResult.answer, /Teorinin Temel İddiaları için belirli bir ölçme aracı, uygulama adımı veya puanlama yöntemi açıklamıyor/u)
  assert.match(theoryMeasurementResult.answer, /Kaynağın sonuç yorumuna dayanak verdiği hedef bilgisi şudur:/u)
  assert.match(theoryMeasurementResult.answer, /Teori vagusun tek ve işlevsel olarak homojen bir yapı gibi ele alınamayacağını savunur/u)
  assert.doesNotMatch(theoryMeasurementResult.answer, /EKG cihazıyla|kesin vagal ton puanı/u)
  targetSpecificMeasurementScopeBound = true

  const structuredDefinitionQuestion = "Self-Regülasyon–Katılım Döngüsü derste geçti; özünü ve tanımını açıklar mısın?"
  const structuredDefinitionTurn = resolveStudentEvidenceFirstRequest({
    turnId: "SCIENTIFIC-STRUCTURED-DEFINITION-T01",
    message: structuredDefinitionQuestion,
    state: createEmptyStudentConversationState(),
  })
  if (!structuredDefinitionTurn.ok) throw new Error("structured definition contract missing")
  const structuredDefinitionResult = await executeStudentAnswer({
    question: structuredDefinitionQuestion,
    contract: structuredDefinitionTurn.contract,
    apiKey: "mock-api-key",
    fetchImpl: async (_url, init) => {
      mockCalls++
      const input = JSON.parse(JSON.parse(String(init?.body)).input) as {
        answerSlots: Array<{ slotId: string; activeTargets: Array<{ lockedClaims: Array<{ claimId: string; text: string }> }> }> }
      const expectedClaims = buildStudentAnswerExecutionPlan({ question: structuredDefinitionQuestion,
        contract: structuredDefinitionTurn.contract }).targetEvidence[0]!.claims
      assert.equal(expectedClaims.length, 10)
      assert.deepEqual(input.answerSlots[0]!.activeTargets[0]!.lockedClaims, expectedClaims,
        "structured_definition_provider_must_receive_full_source_not_only_list_lead_in")
      return new Response(JSON.stringify({ id: "mock-structured-definition", output_text: JSON.stringify({
        blocks: Object.fromEntries(input.answerSlots.map((slot) => [slot.slotId,
          `Döngünün kaynakta anlatılan akışı: ${slot.activeTargets[0]!.lockedClaims.map((claim) => claim.text).join(" ")}`])),
        illustrationKind: "none" }), usage: { input_tokens: 100, output_tokens: 50 } }),
        { status: 200, headers: { "Content-Type": "application/json" } })
    },
  })
  if (!structuredDefinitionResult.ok) throw new Error(`structured definition answer missing:${structuredDefinitionResult.reason}`)
  assert.match(structuredDefinitionResult.answer, /Döngünün kaynakta anlatılan akışı:/u)
  assert.doesNotMatch(structuredDefinitionResult.answer, /Kaynaktaki döngünün özü ve temel akışı şöyledir/u,
    "structured_definition_must_not_replace_provider_prose")
  assert.match(structuredDefinitionResult.answer, /Çocuk için bir aktivite fırsatı oluşur/u)
  assert.match(structuredDefinitionResult.answer, /Çocuk aktiviteye yaklaşır, katılır, pasif kalır, destek ister veya aktiviteden uzaklaşır/u)
  assert.match(structuredDefinitionResult.answer, /Deneyim çocuğun aktivite hakkındaki beklentisini, benlik algısını ve gelecekte kullanacağı stratejileri değiştirir/u)
  assert.match(structuredDefinitionResult.answer, /Çocuk benzer aktiviteye daha istekli, daha kaygılı, daha yetkin veya daha kaçınmacı biçimde yaklaşabilir/u)
  const structuredDefinitionBlock = structuredDefinitionResult.candidate.blocks[0]
  assert.equal(structuredDefinitionBlock?.usedClaimIds.length, 10)
  structuredDefinitionSequenceBound = true

  let deepenState = createEmptyStudentConversationState()
  const deepenSetupQuestion = "Prefrontal Korteks Yirmi Beş Yaşında Bir Anda Tamamlanmaz nedir?"
  const deepenSetup = resolveStudentEvidenceFirstRequest({
    turnId: "DEEPEN-NOVELTY-T01",
    message: deepenSetupQuestion,
    state: deepenState,
  })
  if (!deepenSetup.ok) throw new Error("deepen novelty setup contract missing")
  const deepenSetupResult = await executeStudentAnswer({
    question: deepenSetupQuestion,
    contract: deepenSetup.contract,
    apiKey: "mock-api-key",
    fetchImpl: mockFetch,
  })
  if (!deepenSetupResult.ok) throw new Error(`deepen novelty setup answer missing:${deepenSetupResult.reason}`)
  const firstClaimId = deepenSetupResult.plan.targetEvidence[0]?.claims[0]?.claimId
  assert.deepEqual(deepenSetupResult.candidate.blocks[0]?.usedClaimIds, firstClaimId ? [firstClaimId] : [])
  deepenState = applyStudentRequestContract(deepenState, deepenSetup.contract)
  const deepenQuestion = "brz daha derine gir, mekanizmayı aç ama önceki tanımı tekrarlama."
  const deepenTurn = resolveStudentEvidenceFirstRequest({
    turnId: "DEEPEN-NOVELTY-T02",
    message: deepenQuestion,
    state: deepenState,
  })
  if (!deepenTurn.ok) throw new Error("deepen novelty contract missing")
  const deepenResult = await executeStudentAnswer({
    question: deepenQuestion,
    contract: deepenTurn.contract,
    apiKey: "mock-api-key",
    fetchImpl: mockFetch,
  })
  if (!deepenResult.ok) throw new Error(`deepen novelty answer missing:${deepenResult.reason}`)
  assert.equal(deepenResult.candidate.blocks.length, 1)
  assert.equal((deepenResult.answer.match(/Mekanizma ve işleyiş açısından:/gu) ?? []).length, 1)
  assert.doesNotMatch(deepenResult.answer, /Popüler anlatılarda/u)
  assert.match(deepenResult.answer, /Kaynağın önceki tanıma eklediği işleyiş bilgisi şudur/u)
  assert.match(deepenResult.answer, /Beyin gelişimi tek bir yaşta tamamlanan ani bir süreç değildir/u)
  assert.match(deepenResult.answer, /Farklı yapısal ve işlevsel özellikler farklı zaman çizgileri izler/u)
  assert.match(deepenResult.answer, /Çocuğun davranışını “ön beyni gelişmemiş” şeklinde açıklamak bilimsel ve klinik açıdan yetersizdir/u)
  assert.match(deepenResult.answer, /daha ayrıntılı bir mekanizma açıklamaz/u)
  assert.equal(deepenResult.candidate.blocks[0]?.usedClaimIds.includes(firstClaimId ?? ""), false)

  let exhaustedSequenceState = createEmptyStudentConversationState()
  const exhaustedSequenceSetup = resolveStudentEvidenceFirstRequest({
    turnId: "DEEPEN-EXHAUSTED-T01",
    message: structuredDefinitionQuestion,
    state: exhaustedSequenceState,
  })
  if (!exhaustedSequenceSetup.ok) throw new Error("exhausted sequence setup contract missing")
  exhaustedSequenceState = applyStudentRequestContract(exhaustedSequenceState, exhaustedSequenceSetup.contract)
  const exhaustedSequenceQuestion = "Bir kat daha derine gir; önceki açıklamada olmayan mekanizmayı aç."
  const exhaustedSequenceTurn = resolveStudentEvidenceFirstRequest({
    turnId: "DEEPEN-EXHAUSTED-T02",
    message: exhaustedSequenceQuestion,
    state: exhaustedSequenceState,
  })
  if (!exhaustedSequenceTurn.ok) throw new Error("exhausted sequence deepen contract missing")
  const exhaustedSequenceResult = await executeStudentAnswer({
    question: exhaustedSequenceQuestion,
    contract: exhaustedSequenceTurn.contract,
    apiKey: "mock-api-key",
    fetchImpl: mockFetch,
  })
  if (!exhaustedSequenceResult.ok) throw new Error(`exhausted sequence answer missing:${exhaustedSequenceResult.reason}`)
  assert.match(exhaustedSequenceResult.answer, /yapılandırılmış akış önceki tanımda bütünüyle verilmiştir/u)
  assert.match(exhaustedSequenceResult.answer, /aynı hedef için buna ek bir mekanizma açıklamaz/u)
  assert.doesNotMatch(exhaustedSequenceResult.answer, /Çocuk için bir aktivite fırsatı oluşur/u)

  const multiTargetMechanismQuestion = "Self-regülasyonun dikkat üzerine etkisi nedir Uzun ve detaylı anlat; mekanizma, günlük yaşamdaki anlam ve kanıt sınırını birlikte açıkla."
  const multiTargetMechanismTurn = resolveStudentEvidenceFirstRequest({
    turnId: "MULTI-TARGET-MECHANISM-T01",
    message: multiTargetMechanismQuestion,
    state: createEmptyStudentConversationState(),
  })
  if (!multiTargetMechanismTurn.ok) throw new Error("multi-target mechanism contract missing")
  const multiTargetMechanismResult = await executeStudentAnswer({
    question: multiTargetMechanismQuestion,
    contract: multiTargetMechanismTurn.contract,
    apiKey: "mock-api-key",
    fetchImpl: mockFetch,
  })
  if (!multiTargetMechanismResult.ok) throw new Error(`multi-target mechanism answer missing:${multiTargetMechanismResult.reason}`)
  assert.match(multiTargetMechanismResult.answer, /Öz düzenleme, Türkçede/u)
  assert.doesNotMatch(multiTargetMechanismResult.answer, /Öz düzenleme: Öz düzenleme/u)
  assert.match(multiTargetMechanismResult.answer, /Dikkat, çevresel/u)
  assert.doesNotMatch(multiTargetMechanismResult.answer, /Dikkat: Dikkat,/u)
  assert.match(multiTargetMechanismResult.answer, /Kaynakta iki başlığı aynı açıklama içinde bağlayan nokta şudur/u)
  assert.match(multiTargetMechanismResult.answer, /kesin bir neden-sonuç bağı bulunduğu söylenemez/u)
  assert.match(multiTargetMechanismResult.answer, /Mekanizma ve işleyiş açısından:/u)
  assert.match(multiTargetMechanismResult.answer, /öz düzenleme, dikkat için kaynak bilgisi/u)
  assert.doesNotMatch(multiTargetMechanismResult.answer, /Kaynağın desteklediği işleyiş şöyledir/u)

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
    if (turnId === "BEHAVIOR-BOUNDARY-T06") {
      const result = await executeStudentAnswer({ question: message, contract: resolution.contract })
      if (!result.ok) throw new Error(`case example boundary answer missing:${result.reason}`)
      assert.equal(result.route, "local_safety_boundary")
      assert.match(result.answer, /Örnek: Öğretmenin yanına gelip yavaş konuşmasının ardından çocuğun sakinleşip oyuna dönmesi/u)
      assert.match(result.answer, /Tek bir davranış veya gözlem, bir kapasitenin/u)
      assert.doesNotMatch(result.answer, /Kullanıcının verdiği|kilitli kaynak/iu)
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
        ? result.failureCodes.join(",") : result.reason === "provider_failure" ? result.failure.reason : result.reason}`)
      assert.equal(result.route, "provider_grounded")
      assert.match(result.answer, /katılıma etkisi bağlama bağlıdır/iu)
    }
    if (turnId === "BEHAVIOR-BOUNDARY-T09") {
      const result = await executeStudentAnswer({ question: message, contract: resolution.contract })
      if (!result.ok) throw new Error(`emotion-arousal case answer missing:${result.reason}`)
      assert.equal(result.route, "local_safety_boundary")
      const emotionSource = result.plan.targetEvidence.find((target) => target.studentTargetId === "emotion_regulation")!
      assert.equal(emotionSource.claims[0]!.role, "target")
      // V2: the canonical explanation is required, not the removed meta heading.
      assert.doesNotMatch(result.answer, /Duygu düzenleme açısından temel kaynak bilgisi şöyledir/u)
      assert.ok(result.answer.includes(emotionSource.claims[0]!.text))
      assert.ok(result.candidate.usedClaimIds.includes(emotionSource.claims[0]!.claimId))
      assert.match(result.answer, /Arousal açısından kişinin genel aktivasyon düzeyine/u)
      assert.doesNotMatch(result.answer, /Gross’un Süreç Modeli/u)
      assert.equal((result.answer.match(/Bu kavramlar aynı şey değildir/gu) ?? []).length, 0)
    }
    if (turnId === "BEHAVIOR-BOUNDARY-T11") {
      assert.deepEqual(resolution.contract.caseContext.eventIds,
        ["adult_support_received", "environmental_load_observed"])
      assert.deepEqual(resolution.contract.caseHistoryContext, {
        turnIds: ["BEHAVIOR-BOUNDARY-T03", "BEHAVIOR-BOUNDARY-T06"],
        eventIds: [
          "environmental_load_observed",
          "activation_increased",
          "adult_support_received",
          "activity_resumed",
        ],
        rawMessageStored: false,
      })
      const result = await executeStudentAnswer({ question: message, contract: resolution.contract })
      if (!result.ok) throw new Error(`multi-target local case answer missing:${result.reason}:${result.reason === "candidate_invalid"
        ? result.failureCodes.join(",") : result.reason === "provider_failure" ? result.failure.reason : result.reason}`)
      assert.equal(result.route, "local_safety_boundary")
      assert.match(result.answer, /duyusal düzenleme/iu)
      assert.match(result.answer, /arousal/iu)
      assert.match(result.answer, /eş düzenleme/iu)
      assert.match(result.answer, /Bu parçalı cümle önceki iki sahneyi birleştiriyor/u)
      assert.match(result.answer, /çocuk kalabalık sınıfa girince sesini yükseltiyor ve daha çok hareket ediyor/u)
      assert.match(result.answer, /öğretmen yanına gelip yavaş konuşunca çocuk sakinleşip oyuna dönüyor/u)
      assert.match(result.answer, /Duyusal düzenleme kalabalık ve sesle davranış arasındaki ilişkiyi/u)
      assert.match(result.answer, /arousal ses ve hareket artışındaki genel aktivasyon düzeyini/u)
      assert.match(result.answer, /eş düzenleme ise yetişkin desteğinden sonraki toparlanmayı açıklar/u)
      assert.match(result.answer, /Üçü aynı olayda yer alabilir ama aynı şey değildir/u)
      assert.match(result.answer, /Tek bir gözlem hangisinin belirleyici olduğunu söylemek için yeterli değil/u)
      assert.match(result.answer, /farklı zaman, ortam ve görevlerdeki tekrarlara/u)
      assert.doesNotMatch(result.answer, /Duyusal düzenlemede çocuğun bedeninden/u)
      assert.match(result.answer, /duyusal yükle, genel aktivasyon düzeyiyle veya yetişkin desteğine verilen yanıtla/u)
      assert.equal((result.answer.match(/Tek bir davranış veya gözlem/gu) ?? []).length, 0)
      assert.equal((result.answer.match(/Yorum için farklı zaman/gu) ?? []).length, 0)
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

  const sourceBoundExampleQuestion = "Klinik ve Günlük Yaşam Örneği için desteklenen somut bir örnek verin."
  const sourceBoundExampleTurn = resolveStudentEvidenceFirstRequest({
    turnId: "SOURCE-BOUND-EXAMPLE-T01",
    message: sourceBoundExampleQuestion,
    state: createEmptyStudentConversationState(),
  })
  if (!sourceBoundExampleTurn.ok) throw new Error("source-bound example contract missing")
  const sourceBoundExampleFetch: typeof fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body)) as { input: string }
    const content = JSON.parse(request.input) as { answerSlots: readonly Readonly<{ slotId: string }>[] }
    return new Response(JSON.stringify({
      id: "mock-source-bound-example-response",
      output_text: JSON.stringify({
        blocks: Object.fromEntries(content.answerSlots.map((slot) => [
          slot.slotId,
          "Kaynakta bulunmayan yeni bir öğretmen ve kaykay sahnesi ekleniyor.",
        ])),
        illustrationKind: "hypothetical",
      }),
      usage: { input_tokens: 101, output_tokens: 51, input_tokens_details: { cached_tokens: 0 } },
    }), { status: 200, headers: { "Content-Type": "application/json" } })
  }
  const sourceBoundExample = await executeStudentAnswer({
    question: sourceBoundExampleQuestion,
    contract: sourceBoundExampleTurn.contract,
    apiKey: "mock-api-key",
    fetchImpl: sourceBoundExampleFetch,
  })
  assert.equal(sourceBoundExample.ok, true)
  if (!sourceBoundExample.ok) throw new Error("source-bound example execution failed")
  assert.equal(sourceBoundExample.plan.targetEvidence[0]?.verifiedExampleEvidence.status, "UNSUPPORTED")
  assert.match(sourceBoundExample.answer, /doğrulanmış somut bir örnek bulunmuyor/u)
  assert.match(sourceBoundExample.answer, /kaynak dışından yeni bir senaryo eklenemez/u)
  assert.doesNotMatch(sourceBoundExample.answer, /Dört yaşındaki bir çocuk her sabah evden çıkarken yoğun tepki/u)
  assert.doesNotMatch(sourceBoundExample.answer, /uyku süresini, sabah açlığını, giyinme becerisini/u)
  assert.doesNotMatch(sourceBoundExample.answer, /öğretmen|kaykay/u)

  const sparseMechanismQuestion = "Bilgi Kaynaklarının Üçgenlenmesi nasıl değerlendirilir; ölçümün sınırı nedir Uzun ve detaylı anlat; mekanizma, günlük yaşamdaki anlam ve kanıt sınırını birlikte açıkla."
  const sparseMechanismTurn = resolveStudentEvidenceFirstRequest({
    turnId: "SPARSE-MECHANISM-T01",
    message: sparseMechanismQuestion,
    state: createEmptyStudentConversationState(),
  })
  if (!sparseMechanismTurn.ok) throw new Error("sparse mechanism contract missing")
  const sparseMechanismFetch: typeof fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body)) as { input: string }
    const content = JSON.parse(request.input) as { answerSlots: readonly Readonly<{ slotId: string }>[] }
    return new Response(JSON.stringify({
      id: "mock-sparse-mechanism-response",
      output_text: JSON.stringify({
        blocks: Object.fromEntries(content.answerSlots.map((slot) => [
          slot.slotId,
          "Kaynakta bulunmayan beyin devreleri ve biyolojik süreçler ekleniyor.",
        ])),
        illustrationKind: "none",
      }),
      usage: { input_tokens: 101, output_tokens: 51, input_tokens_details: { cached_tokens: 0 } },
    }), { status: 200, headers: { "Content-Type": "application/json" } })
  }
  const sparseMechanism = await executeStudentAnswer({
    question: sparseMechanismQuestion,
    contract: sparseMechanismTurn.contract,
    apiKey: "mock-api-key",
    fetchImpl: sparseMechanismFetch,
  })
  assert.equal(sparseMechanism.ok, true)
  if (!sparseMechanism.ok) throw new Error("sparse mechanism execution failed")
  assert.match(sparseMechanism.answer, /Güvenilir değerlendirme en az üç veri türünü birleştirmelidir/u)
  assert.match(sparseMechanism.answer, /ayrıntılı bir işlem sırası veya kesin mekanizma açıklamaz/u)
  assert.doesNotMatch(sparseMechanism.answer, /beyin devreleri|biyolojik süreçler/u)

  const significanceQuestion = "İmmün ve İnflamatuvar Sistem niye önemli, ne işe yarıyor?"
  const significanceTurn = resolveStudentEvidenceFirstRequest({
    turnId: "DIRECT-SIGNIFICANCE-T01",
    message: significanceQuestion,
    state: createEmptyStudentConversationState(),
  })
  assert.equal(significanceTurn.ok, true)
  if (!significanceTurn.ok) throw new Error("direct significance contract missing")
  const significance = await executeStudentAnswer({
    question: significanceQuestion,
    contract: significanceTurn.contract,
    apiKey: "mock-api-key",
    fetchImpl: mockFetch,
  })
  assert.equal(significance.ok, true)
  if (!significance.ok) throw new Error("direct significance execution failed")
  assert.equal(significance.candidate.blocks.length, 1)
  assert.equal(significance.candidate.blocks[0]?.obligationIds.length, 2)
  assert.match(significance.answer, /İşlevsel önemi şudur:/u)
  assert.match(significance.answer, /Bağışıklık sistemi ile beyin arasında/u)
  assert.match(significance.answer, /Hastalık sırasında/u)
  directSignificanceBound = true

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

  let transportRecoveryCalls = 0
  const transportRecovered = await executeStudentAnswer({
    question: first.user,
    contract: firstResolution.contract,
    apiKey: "mock-api-key",
    fetchImpl: (async (request, init) => {
      transportRecoveryCalls += 1
      if (transportRecoveryCalls === 1) throw new DOMException("aborted", "AbortError")
      return mockFetch(request, init)
    }) as typeof fetch,
  })
  assert.equal(transportRecovered.ok, false)
  if (transportRecovered.ok || transportRecovered.reason !== "provider_failure") {
    throw new Error("unknown first outcome must not trigger another generation")
  }
  assert.equal(transportRecoveryCalls, 1)
  assert.equal(transportRecovered.provider.calls, 1)
  assert.equal(transportRecovered.provider.transportRetries, 0)
  assert.equal(transportRecovered.provider.usageComplete, false)

  let terminalTransportCalls = 0
  const terminalTransportFailure = await executeStudentAnswer({
    question: first.user,
    contract: firstResolution.contract,
    apiKey: "mock-api-key",
    fetchImpl: (async () => {
      terminalTransportCalls += 1
      throw new DOMException("aborted", "AbortError")
    }) as typeof fetch,
  })
  assert.equal(terminalTransportFailure.ok, false)
  if (terminalTransportFailure.ok || terminalTransportFailure.reason !== "provider_failure") {
    throw new Error("terminal answer transport failure must remain closed")
  }
  assert.equal(terminalTransportFailure.failure.reason, "timeout")
  assert.equal(terminalTransportCalls, 1)
  assert.equal(terminalTransportFailure.provider.calls, 1)
  assert.equal(terminalTransportFailure.provider.transportRetries, 0)
  assert.equal(terminalTransportFailure.provider.usageComplete, false)

  console.log(JSON.stringify({
    ok: true,
    gate: "STUDENT_B1_ANSWER_EXECUTOR_LOCAL",
    version: HARNESS_VERSION,
    recoveryExplanationAndSourceRemovalRejected: true,
    recoveryRemovalCheckAuthority: "UNIT_ASSERTION_NOT_RUNTIME_SEMANTIC_CERTIFICATION",
    turns,
    providerAnswers,
    localSafetyAnswers,
    providerCalls: mockCalls,
    maximumProviderCallsPerTurn: 1,
    maximumTransportRetriesPerTurn: 0,
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
    multipartSummarySectionsBound,
    multipartScientificSectionsBound,
    unrequestedExampleBoundarySuppressed,
    unsupportedDailyLifeSlotBound,
    supportedDailyLifeSlotBound,
    structuredDefinitionSequenceBound,
    directDefinitionHandoffs,
    structuredDefinitionFullProviderSourceAndUnreplacedProse: true,
    targetSpecificBoundaryClaimBound,
    directCausalityBoundaryBound,
    targetSpecificMeasurementScopeBound,
    countedSummaryBulletsBound,
    broadSummarySynthesisBound,
    summaryEpistemicControls,
    directSignificanceBound,
    sourceBoundExampleUsesLockedEvidence: true,
    sparseMechanismUsesLockedEvidence: true,
    rejectedCandidateTelemetryPreserved: true,
    unknownTransportOutcomeNotRetried: true,
    terminalTransportFailureClosed: true,
  }, null, 2))
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

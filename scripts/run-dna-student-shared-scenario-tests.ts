import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { createEmptyStudentConversationState, resolveStudentEvidenceFirstRequest } from "../src/lib/dna/chat/studentFirst"
import { executeStudentAnswer } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"

type Slot = { slotId: string; obligations: Array<{ kind: string }>;
  relationComposition?: { orderedDefinitionSources: Array<{ targetId: string; definitionText: string }> };
  sharedScenarioBinding?: { scope: string; targetIds: string[] };
  activeTargets: Array<{ targetId: string; visibleAliases: string[]; lockedClaims: Array<{ claimId: string; text: string }> }> }
type Value = { activity: string; applications: Record<string, { eventStep: string; conceptLink: string }> }
const bytes = readFileSync("scripts/dna-student-fixtures/STUDENT40_DEVELOPMENT.json")
assert.equal(createHash("sha256").update(bytes).digest("hex"), "e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65")
const fixture = JSON.parse(bytes.toString()) as { conversations: Array<{ turns: Array<{ user: string }> }> }
const exactQuestion = fixture.conversations[1]!.turns[6]!.user
let mockCalls = 0
let structuredControls = 0
let malformedRejected = 0
let interpretationControls = 0

function assertExampleRequests() {
  const sharedRequests = [
    "planlama ile çalışma belleğini aynı örnekte iki cümlede göster",
    "planlama ile çalışma belleğini aynı örnekte, iki cümlede, sade bir dille göster",
    "planlama ile çalışma belleğini aynı örnekte iki kısa ve anlaşılır cümlede göster",
    "planlama ile çalışma belleğini aynı örnekte ayrı ayrı ve anlaşılır biçimde göster",
    "planlama ile çalışma belleğini aynı örnekte madde madde sade dille anlat",
    "planlama ile çalışma belleğini aynı örnekte tablo halinde açıkla",
    "planlama ile çalışma belleğini aynı örnekte daha ayrıntılı anlatır mısın",
    "planlama ile çalışma belleğini aynı örnekte kısaca gösterebilir misin",
    "planlama ile çalışma belleğini göster bana aynı örnekte iki cümlede",
    "planlama ile çalışma belleğini anlat bana aynı örnekte sade bir dille",
    "aynı örnekte iki cümlede çalışma belleği ile planlamayı göster",
    "aynı örnekte dikkat ile öz kontrolü iki cümlede göster",
    "planlama ile çalışma belleğini ortak bir senaryoda iki cümlede göster",
    "planlama ile çalışma belleğini karşılaştır ve aynı örnekte iki cümlede göster",
    "planlama ile çalışma belleğini aynı çocuk örneğinde kısaca anlat",
    "planlama ile çalışma belleğini aynı örnekte göstererek açıkla",
    "planlama ile çalışma belleğini aynı örnekte veriye dayalı olarak anlat",
  ]
  const independentRequests = [
    "planlamaya iki cümlelik kısa bir örnek ver",
    "çalışma belleği için örneği iki cümlede sade dille anlat",
    "planlamayı anlat ve örnek ver",
    "planlama için ver bana günlük hayattan anlaşılır bir örnek",
    "planlamayı tanımla; sonra örnek ver",
    "planlamayı anlat, bir de sınıftan örnek ver",
    "planlamayı açıklamak için örnekle iki cümlede anlat",
    "planlamayı örnek vererek iki cümlede anlat",
    "planlamayı örnekte eklem hareketlerini kullanarak anlat",
  ]
  const nonRequests = [
    "planlamayı anlat, örnek verme",
    "örnek verme, planlamayı anlat",
    "planlamayı örnek eklemeden anlat",
    "planlamayı örnekle anlatma, tanımını ver",
    "planlama için örnek vermeyin, tanımını verin",
    "planlamaya örnek istemiyorum, tanımını anlat",
    "planlama örneği var. Tanımını anlat",
    "planlama örneği yetersiz; sadece tanımı anlat",
    "planlama örneği verildi, sadece tanımını anlat",
    "planlamayı anlat. Örnek istemiyorum",
    "planlama için örnek ver demek istemiyorum",
    "planlama için örnek verme ama çalışma belleğini anlat",
    'öğretmen "örnek ver" dedi; planlamanın tanımını anlat',
    "öğretmen ‘aynı örnekte iki cümlede göster’ dedi; planlamanın tanımını ver",
    "'örnek ver' cümlesini değil, planlamanın tanımını anlat",
    "planlama için örnek? Sadece tanımını anlat",
    "örneklem büyüklüğünü anlat, planlamanın tanımını ver",
    "bu örnek planlamayı gösterir",
    "bu örnek planlamayı anlatıyor",
  ]
  for (const [expected, messages] of [["shared", sharedRequests], ["independent", independentRequests], ["none", nonRequests]] as const) {
    for (const message of messages) {
      const result = resolveStudentEvidenceFirstRequest({ turnId: `example-phrase-${interpretationControls + 1}`, message,
        state: createEmptyStudentConversationState() })
      assert.ok(result.ok, message)
      const requested = expected !== "none"
      assert.equal(result.facts.semanticTaskCandidates.includes("example"), requested, message)
      assert.equal(result.contract.requestedSemanticTasks.includes("example"), requested, message)
      assert.equal(result.contract.presentation.example !== "none", requested, message)
      assert.equal(result.contract.presentation.exampleScope, expected === "shared" ? "shared" : "independent", message)
      assert.equal(result.contract.obligations.some((row) => row.kind === "give_concrete_example"), requested, message)
      if (expected === "shared" && result.contract.targetIds.length > 1) {
        assert.equal(result.contract.obligations.some((row) => row.kind === "use_shared_scenario"), true, message)
      }
      interpretationControls++
    }
  }
}

async function run(question: string, mutate?: (value: Value) => unknown) {
  const resolved = resolveStudentEvidenceFirstRequest({ turnId: "shared-scenario-control", message: question,
    state: createEmptyStudentConversationState() })
  assert.ok(resolved.ok)
  let expectedActivity = ""
  let expectedApplications: string[] = []
  let transportAssertion: unknown = null
  const result = await executeStudentAnswer({ question, contract: resolved.contract, apiKey: "synthetic-not-real",
    fetchImpl: async (_url, init) => {
      try {
      mockCalls++
      const request = JSON.parse(String(init?.body))
      const input = JSON.parse(request.input) as { answerSlots: Slot[] }
      const schema = request.text.format.schema as { properties: { blocks: { properties: Record<string, {
        type: string; required?: string[]; properties?: { applications: { required: string[] } } }> } } }
      const shared = input.answerSlots.find((slot) => slot.obligations.some((row) => row.kind === "use_shared_scenario"))
      assert.ok(shared, question)
      assert.equal(schema.properties.blocks.properties[shared.slotId]?.type, "object",
        "shared_example_requires_one_activity_and_target_applications_not_free_text")
      assert.deepEqual(schema.properties.blocks.properties[shared.slotId]!.required, ["activity", "applications"])
      assert.equal(shared.sharedScenarioBinding?.scope, "one_activity")
      const targetIds = shared.activeTargets.map((target) => target.targetId)
      assert.deepEqual(shared.sharedScenarioBinding?.targetIds, targetIds)
      assert.deepEqual(schema.properties.blocks.properties[shared.slotId]!.properties!.applications.required, targetIds)
      if (question === exactQuestion) {
        assert.deepEqual(shared.activeTargets.map((target) => target.lockedClaims.map((claim) => claim.claimId)),
          [["owner.unit:2303:b9ea9d9365c5"], ["owner.unit:2251:067ce1c9a50f"]],
          "shared_illustration_should_apply_bound_concepts_not_splice_separate_source_examples")
        const ordinary = input.answerSlots.find((slot) => slot !== shared)!
        assert.equal(schema.properties.blocks.properties[ordinary.slotId]!.type, ordinary.relationComposition ? "object" : "string")
        assert.ok(ordinary.activeTargets.some((target) => target.lockedClaims.some((claim) => claim.claimId === "owner.unit:2253:b94016b797f7")),
          "non_example_evidence_must_remain_unchanged")
      }
      expectedActivity = "Bir öğrenci bir sunum hazırlıyor."
      const applications = Object.fromEntries(shared.activeTargets.map((target) => [target.targetId,
        target.targetId === "planning" ? "Sunumu hazırlarken işleri sıraya koyması planlamayı gösterir."
          : target.targetId === "working_memory" ? "Sunum başlıklarını aklında tutup yeniden düzenlemesi çalışma belleğini gösterir."
          : `Aynı sunum görevinde ${target.visibleAliases[0]} bu sürecin bir yönünü anlamaya yardım eder.`]))
      expectedApplications = Object.values(applications)
      const value: Value = { activity: expectedActivity, applications: Object.fromEntries(Object.entries(applications).map(([id, text]) =>
        [id, { eventStep: text, conceptLink: "Bu adım verilen kavramsal açıklamayı örnekler." }])) }
      const blocks = Object.fromEntries(input.answerSlots.map((slot) => [slot.slotId, slot === shared
        ? mutate ? mutate(value) : value
        : slot.relationComposition ? { definitionPremises: Object.fromEntries(slot.relationComposition.orderedDefinitionSources.map((source) => [source.targetId, source.definitionText])), requestFocus: "definition_difference", scopeOrder: "not_ordered" }
          : `${slot.activeTargets.map((target) => target.visibleAliases[0]).join(" ve ")} aynı şey değildir; kapsamları farklıdır.`]))
      return new Response(JSON.stringify({ id: "mock-shared-scenario", output_text: JSON.stringify({ blocks, illustrationKind: "hypothetical" }),
        usage: { input_tokens: 100, output_tokens: 50 } }), { status: 200, headers: { "Content-Type": "application/json" } })
      } catch (error) { transportAssertion = error; throw error }
    } })
  if (transportAssertion) throw transportAssertion
  if (mutate) {
    assert.equal(result.ok, false, "malformed_shared_scenario_must_not_fall_back_to_free_text")
    assert.equal(result.provider.calls, 1, "schema_failure_must_not_trigger_semantic_retry")
    malformedRejected++
  } else {
    assert.ok(result.ok)
    const block = result.candidate.blocks.find((block) => block.blockKind === "example")!
    const visibleFragment = (text: string) => resolved.contract.presentation.requestedSentenceCount === null
      ? text : text.replace(/[.!?]+$/u, "")
    assert.ok(block.text.includes(visibleFragment(expectedActivity)))
    assert.equal(block.text.split(visibleFragment(expectedActivity)).length - 1, 1)
    for (const text of expectedApplications) assert.ok(block.text.includes(visibleFragment(text)))
    if (resolved.contract.presentation.requestedSentenceCount !== null) {
      assert.equal(result.answer.split(/[.!?]+/u).filter((part) => part.trim()).length,
        resolved.contract.presentation.requestedSentenceCount)
    }
    assert.doesNotMatch(block.text, /\[object Object\]|sharedScenarioBinding|applications/u)
    assert.ok(result.candidate.addressedObligationIds.includes(resolved.contract.obligations.find((row) => row.kind === "use_shared_scenario")!.id))
    structuredControls++
  }
}

async function main() {
  globalThis.fetch = async () => { throw new Error("external_network_forbidden") }
  assertExampleRequests()
  await run(exactQuestion)
  await run("çalışma belleği ile planlamayı tek bir örnekte birlikte göster")
  await run("dikkat ve öz kontrolü aynı örnekte ayrı ayrı göster")
  await run("planlama ile çalışma belleğini aynı örnekte ayrı ayrı göster, iki cümle yaz")
  await run("planlama ile çalışma belleğini aynı örnekte iki cümlede göster")
  await run(exactQuestion, (value) => value.activity)
  await run(exactQuestion, (value) => ({ ...value, activity: "" }))
  await run(exactQuestion, (value) => ({ ...value, applications: { planning: value.applications.planning } }))
  await run(exactQuestion, (value) => ({ ...value, applications: { ...value.applications, unrelated_target: "Başka bir görev." } }))
  await run(exactQuestion, (value) => ({ ...value, extra: "Başka bir etkinlik." }))
  await run(exactQuestion, (value) => ({ ...value, applications: { ...value.applications, planning: "" } }))
  await run(exactQuestion, (value) => ({ ...value, applications: [] }))
  await run(exactQuestion, (value) => ({ ...value, activity: "x".repeat(4_001) }))
  // Preserve the original failed wording as a blocking contract assertion, in
  // addition to its full mocked provider-to-visible-projection check above.
  const gapQuestion = "planlama ile çalışma belleğini aynı örnekte iki cümlede göster"
  const gap = resolveStudentEvidenceFirstRequest({ turnId: "counted-example-interpreter-gap", message: gapQuestion,
    state: createEmptyStudentConversationState() })
  const knownInterpreterGap = !gap.ok || gap.contract.semanticTask !== "compare"
    || gap.contract.presentation.requestedSentenceCount !== 2 || gap.contract.presentation.exampleScope !== "shared"
    || !["distinguish_targets", "give_concrete_example", "use_shared_scenario"].every((kind) =>
      gap.contract.obligations.some((row) => row.kind === kind))
  console.log(JSON.stringify({ ok: !knownInterpreterGap, structuralControlsPassed: true,
    authority: "LOCAL_PROVIDER_SCHEMA_AND_VISIBLE_PROJECTION_NOT_SEMANTIC_JUDGE",
    structuredControls, malformedRejected, interpretationControls, mockCalls, externalProviderCalls: 0,
    knownInterpreterGap: knownInterpreterGap ? { question: gapQuestion, missing: "use_shared_scenario", status: "OPEN_NOT_PRODUCT_FIXED" } : null,
    sharedScenarioSemanticCoherenceCertified: false, productionEligible: false }, null, 2))
  if (knownInterpreterGap) process.exitCode = 1
}
main().catch((error) => { console.error(error); process.exitCode = 1 })

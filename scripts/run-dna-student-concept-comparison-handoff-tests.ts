import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { buildStudentAnswerExecutionPlan, validateStudentAnswerExecutionPlan } from "../src/lib/dna/chat/studentFirst/answerExecution"
import { executeStudentAnswer } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"
import { createEmptyStudentConversationState, resolveStudentEvidenceFirstRequest } from "../src/lib/dna/chat/studentFirst"
import { resolveStudentTargetDescriptor } from "../src/lib/dna/chat/studentFirst/targetCatalog"
import type { StudentReplayTurn } from "./dna-student-application-replay"
import { studentCandidateSha256 } from "./dna-student-candidate-identity"

const hash = (value: Buffer | string) => createHash("sha256").update(value).digest("hex")
const journalPath = "/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-student-application-replay/d1501088c123733ac55eea4bf492de45f986ffddfb9d5884ebd00e9a992af1b8/a959034806156cc24ffe19d4386fd0b5b7da68420228e426a29002077d345baf/student40.jsonl"
const journalHash = "b9d8660a4fcc7355cdeeb19e437f5f9fdd9ce8ee1f33f5be1708bd65fa0507dc"
const genericTopic = "owner-book-section/owner-book:heading:3277:d28eec43fa"
const theoryTopic = "owner-book-section/owner-book:heading:0518:fd59de1cf6"

async function main() {
  let externalCalls = 0
  globalThis.fetch = async () => { externalCalls++; throw new Error("external_network_forbidden") }
  const bytes = readFileSync(journalPath)
  assert.equal(hash(bytes), journalHash)
  assert.equal(hash(readFileSync("src/lib/dna/chat/catalog/generated/owner-book/runtime.json")),
    "8d2c08fa8abf43f33d08e96aa34b592eafc4982662827cb350ca6174038f8581")
  const fixtureBytes = readFileSync("scripts/dna-student-fixtures/STUDENT40_DEVELOPMENT.json")
  assert.equal(hash(fixtureBytes), "e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65")
  const fixture = JSON.parse(fixtureBytes.toString()) as { conversations: Array<{ turns: Array<{ turnId: string; user: string }> }> }
  const question = fixture.conversations.flatMap((c) => c.turns).find((t) => t.turnId === "STUDENT40-C04-T06")!.user
  const rows = bytes.toString().trim().split("\n").map((line) => JSON.parse(line)) as Array<{
    key: string; stage: string; value: StudentReplayTurn; valueSha256: string
  }>
  const row = rows.find((r) => r.key === "STUDENT40-C04-T06" && r.stage === "completed")!
  assert.equal(hash(JSON.stringify(row.value)), row.valueSha256)
  const { receiptSha256, ...receipt } = row.value
  assert.equal(hash(JSON.stringify(receipt)), receiptSha256)
  const contract = row.value.student!.contract
  const originalContractHash = hash(JSON.stringify(contract))
  assert.equal(row.value.student!.result.plan.targetEvidence.find((t) => t.studentTargetId === "emotion_regulation")!.ownerBookTopicId, theoryTopic)
  let namedScopeControls = 0
  for (const [message, expectedTopic] of [
    ["duygu düzenleme nedir", genericTopic],
    ["duygusal regülasyonu açıkla", genericTopic],
    ["Gross’un Duygu Düzenleme Süreç Modelini açıkla", theoryTopic],
    ["Duygunun Oluşumu ve Düzenlenmesi bölümünü açıkla", theoryTopic],
  ]) {
    const r = resolveStudentEvidenceFirstRequest({ turnId: "named-scope-control", message: message!, state: createEmptyStudentConversationState() })
    assert.ok(r.ok)
    assert.equal(r.contract.targetIds.length, 1, message)
    assert.equal(resolveStudentTargetDescriptor(r.contract.targetIds[0]!).ownerBookTopicId, expectedTopic, message)
    namedScopeControls++
  }
  let handoffControls = 0, sample = ""
  for (const depth of ["brief", "standard", "deep"] as const) for (const reverse of [false, true]) {
    const c = { ...contract, targetIds: reverse ? [...contract.targetIds].reverse() : contract.targetIds,
      comparisonTargetIds: reverse ? [...contract.comparisonTargetIds].reverse() : contract.comparisonTargetIds,
      presentation: { ...contract.presentation, depth } }
    const plan = buildStudentAnswerExecutionPlan({ question, contract: c })
    assert.ok(validateStudentAnswerExecutionPlan(plan, c))
    const emotion = plan.targetEvidence.find((t) => t.studentTargetId === "emotion_regulation")!
    assert.equal(emotion.ownerBookTopicId, genericTopic)
    assert.ok(emotion.ownerBookTopicTitle.startsWith("Regülasyon Katmanlarının Okupasyon İçinde Birleşmesi · "))
    assert.equal(emotion.claims[0]!.role, "target")
    assert.match(emotion.claims[0]!.text, /^Duygusal regülasyon/u)
    assert.ok(emotion.claims.length <= (depth === "brief" ? 2 : depth === "deep" ? 4 : 3))
    assert.deepEqual(plan.currentComparisonContext?.eventIds, contract.caseContext.eventIds)
    assert.equal(plan.currentComparisonContext?.rawMessageStored, false)
    assert.equal(plan.historyAnchor, null)
    assert.ok(!JSON.stringify(plan).includes(question))
    assert.equal(validateStudentAnswerExecutionPlan({ ...plan, currentComparisonContext: undefined }, c), false)
    assert.equal(validateStudentAnswerExecutionPlan({ ...plan, currentComparisonContext: {
      ...plan.currentComparisonContext!, eventLabels: ["unverified extra event"] } }, c), false)
    let currentBindingReceived = false
    const visible = "Arousal, kişinin genel aktivasyonu ve çevresine yanıt verebilirlik durumudur; sinirlenirken sesin ya da hareketin artması bu açıdan gözlenebilir. Duygu düzenleme ise sinirlenme veya gerginleşme sırasında günlük etkinliğe katılımı nasıl sürdürebildiğiyle ilgilidir. Bu nedenle aynı olayı iki farklı açıdan konuşuyoruz; sesin yükselmesi tek başına duygu düzenlemesinin iyi ya da kötü olduğunu göstermez."
    const result = await executeStudentAnswer({ question, contract: c, apiKey: "synthetic-not-real", fetchImpl: async (_url, init) => {
      const body = JSON.parse(String(init?.body))
      const input = JSON.parse(body.input) as { currentUserMessage: string; answerSlots: Array<{ slotId: string;
        relationComposition?: unknown; caseBinding: { authority?: string; eventLabels: string[] } }> }
      assert.equal(input.currentUserMessage, question)
      assert.ok(input.answerSlots.every((s) => !s.relationComposition))
      currentBindingReceived = input.answerSlots.every((s) => s.caseBinding?.authority === "current_illustrative_events_not_scientific_evidence"
        && s.caseBinding.eventLabels.includes("sinirlenme veya gerginleşme"))
      const schema = body.text.format.schema as { properties: { blocks: { properties: Record<string, { type: string }> } } }
      assert.ok(Object.values(schema.properties.blocks.properties).every((s) => s.type === "string"))
      return Response.json({ id: "mock-current-comparison-source", output_text: JSON.stringify({
        blocks: Object.fromEntries(input.answerSlots.map((s) => [s.slotId, visible])), illustrationKind: "none" }),
        usage: { input_tokens: 1, output_tokens: 1 } })
    } })
    assert.ok(currentBindingReceived)
    assert.ok(result.ok)
    assert.ok(result.answer.includes(visible), "current_case_comparison_must_not_be_overwritten_by_abstract_definition_projection")
    assert.ok(!result.answer.includes("Gross"))
    sample = result.answer
    handoffControls++
  }
  const abstract = buildStudentAnswerExecutionPlan({ question: "arousal ile duygu düzenleme aynı şey mi", contract: {
    ...contract, caseContext: { eventIds: [], rawMessageStored: false } } })
  assert.equal(abstract.currentComparisonContext, undefined)
  const clinicalContract = { ...contract, safetyIntent: "treatment_selection" as const }
  const clinical = buildStudentAnswerExecutionPlan({ question, contract: clinicalContract })
  assert.equal(clinical.executionRoute, "local_safety_boundary")
  assert.equal(clinical.providerMayReceiveTransientQuestion, false)
  assert.equal(clinical.currentComparisonContext, undefined)
  assert.equal(hash(JSON.stringify(contract)), originalContractHash)
  assert.equal(hash(readFileSync(journalPath)), journalHash)
  console.log(JSON.stringify({ ok: true, gate: "CONCEPT_THEORY_AND_CURRENT_COMPARISON_HANDOFF", candidateSha256: studentCandidateSha256(),
    exactFailedReceiptVerified: true, namedScopeControls, handoffControls, invalidContextControls: 12,
    conceptAnchorIsTarget: true, conditionSpecificHeadingsExcluded: true, abstractComparisonUnchangedRoute: true,
    clinicalProviderBoundaryPreserved: true, externalProviderCalls: externalCalls,
    semanticQualityCertified: false, providerFactualCorrectnessGuaranteed: false, productionEligible: false, sample }, null, 2))
}

void main()

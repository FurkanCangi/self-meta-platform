import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { buildStudentAnswerExecutionPlan, validateStudentAnswerExecutionPlan } from "../src/lib/dna/chat/studentFirst/answerExecution"
import { executeStudentAnswer } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"
import { observeStudentCaseContext, studentCurrentSituationObserved } from "../src/lib/dna/chat/studentFirst/caseContext"
import { createEmptyStudentConversationState, resolveStudentEvidenceFirstRequest } from "../src/lib/dna/chat/studentFirst"
import type { StudentReplayTurn } from "./dna-student-application-replay"
import type { StudentRequestContract } from "../src/lib/dna/chat/studentFirst/contracts"
import { applyStudentRequestContract } from "../src/lib/dna/chat/studentFirst/conversationState"
import { emptyStudentApplicationState, openStudentApplicationContext, sealStudentApplicationContext } from "../src/lib/dna/chat/studentFirst/applicationContext.server"
import { studentCandidateSha256 } from "./dna-student-candidate-identity"

const hash = (value: Buffer | string) => createHash("sha256").update(value).digest("hex")
const journalPath = "/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-student-application-replay/660f9eaa2a6aca8d88427cfbf2e2944d68a14afdde01e6ee6f112cce31aa278b/b4c9915eaa8c3a9b0345263adeb89eb5b123661219aaa5b11fa98c3e06701d89/one-hour24.jsonl"
const journalHash = "c0f259bb78431a69b88766b797bb54b1979d2883183688d4e89e7371413883cb"

async function main() {
  let externalCalls = 0
  globalThis.fetch = async () => { externalCalls++; throw new Error("external_network_forbidden") }
  const bytes = readFileSync(journalPath)
  assert.equal(hash(bytes), journalHash)
  const rows = bytes.toString().trim().split("\n").map((line) => JSON.parse(line)) as Array<{
    key: string; stage: string; value: StudentReplayTurn; valueSha256: string
  }>
  const row = rows.find((r) => r.key === "ONEHOUR24-T04" && r.stage === "completed")!
  assert.equal(hash(JSON.stringify(row.value)), row.valueSha256)
  const { receiptSha256, ...receipt } = row.value
  assert.equal(hash(JSON.stringify(receipt)), receiptSha256)
  const original = row.value.student!.contract
  assert.deepEqual(original.caseContext.eventIds, [])
  const question = "çocuk etkinlikte kalkıp geziyor burada dikkat mi öz düzenleme mi düşünürüz"
  assert.equal(hash(readFileSync("scripts/dna-student-fixtures/SYNTHETIC_ONE_HOUR_24.json")),
    "8c8916240a237c526757b19e0db9047f3a8394b4be389b40868174704a60deb1")
  assert.ok(readFileSync("scripts/dna-student-fixtures/SYNTHETIC_ONE_HOUR_24.json", "utf8").includes(question))
  const observed = observeStudentCaseContext(question)
  assert.deepEqual(observed, { eventIds: [], describedSituation: true, rawMessageStored: false })
  const resolved = resolveStudentEvidenceFirstRequest({ turnId: "current-observation", message: question, state: createEmptyStudentConversationState() })
  assert.ok(resolved.ok)
  assert.equal(resolved.contract.caseContext.describedSituation, true)
  const state = { ...emptyStudentApplicationState(null), student: applyStudentRequestContract(
    createEmptyStudentConversationState(), resolved.contract) }
  const binding = { secret: "local-test-context-secret-not-production-0000", actorId: "local-test",
    conversationId: "sparse-context", candidateSha256: studentCandidateSha256(), nowMs: 1000 }
  const reopened = openStudentApplicationContext(sealStudentApplicationContext(state, binding), binding)
  assert.deepEqual(reopened, state)
  assert.equal(reopened!.student.semanticHistory[0]!.caseContext.describedSituation, true)
  assert.ok(!JSON.stringify(reopened).includes(question))
  const abstractWithPriorSituation = resolveStudentEvidenceFirstRequest({ turnId: "new-abstract-question",
    message: "dikkat ile öz düzenleme aynı şey mi", state: state.student })
  assert.ok(abstractWithPriorSituation.ok)
  const abstractPlan = buildStudentAnswerExecutionPlan({ question: "dikkat ile öz düzenleme aynı şey mi",
    contract: abstractWithPriorSituation.contract })
  assert.equal(abstractPlan.currentComparisonContext, undefined, "past_marker_is_not_a_current_situation")
  let controls = 0
  for (const setting of ["etkinlikte", "oyunda", "görevde", "işte"]) {
    const message = question.replace("etkinlikte", setting)
    const context = observeStudentCaseContext(message)
    assert.ok(context.eventIds.length || context.describedSituation)
    if (setting === "etkinlikte" || setting === "oyunda") assert.deepEqual(context.eventIds, [])
    controls++
  }
  for (const message of ["dikkat ile öz düzenleme aynı şey mi", "çocuğun dikkatini tanımla",
    '"çocuk etkinlikte kalkıp geziyor" cümlesini çevir',
    "çocuk için örnek verme, dikkat ile öz düzenlemeyi anlat"]) {
    assert.equal(studentCurrentSituationObserved(message), false, message)
    controls++
  }
  // Exact historical contract seeded locally: not a new application replay or semantic adjudication.
  for (const depth of ["brief", "standard", "deep"] as const) for (const reverse of [false, true]) {
    const contract: StudentRequestContract = { ...original, caseContext: observed,
      targetIds: reverse ? [...original.targetIds].reverse() : original.targetIds,
      comparisonTargetIds: reverse ? [...original.comparisonTargetIds].reverse() : original.comparisonTargetIds,
      presentation: { ...original.presentation, depth } }
    const plan = buildStudentAnswerExecutionPlan({ question, contract })
    assert.ok(validateStudentAnswerExecutionPlan(plan, contract))
    assert.equal(plan.currentComparisonContext?.describedSituation, true)
    assert.deepEqual(plan.currentComparisonContext?.eventLabels, [])
    assert.ok(!JSON.stringify(plan).includes(question))
    assert.equal(plan.historyAnchor, null)
    assert.equal(validateStudentAnswerExecutionPlan({ ...plan, currentComparisonContext: undefined }, contract), false)
    assert.equal(validateStudentAnswerExecutionPlan({ ...plan, currentComparisonContext: {
      ...plan.currentComparisonContext!, describedSituation: undefined } }, contract), false)
    const visible = "Çocuğun etkinlikte kalkıp gezmesi tek başına dikkat ile öz düzenleme arasında seçim yaptırmaz. Dikkat açısından etkinliğin hangi kısmına odaklandığına; öz düzenleme açısından etkinliğe katılımını nasıl sürdürdüğüne bakılır."
    const result = await executeStudentAnswer({ question, contract, apiKey: "synthetic-not-real", fetchImpl: async (_url, init) => {
      const body = JSON.parse(String(init?.body))
      assert.equal(body.store, false)
      const input = JSON.parse(body.input)
      assert.equal(input.currentUserMessage, question)
      for (const slot of input.answerSlots) {
        assert.equal(slot.relationComposition, undefined)
        assert.equal(slot.caseBinding.authority, "current_illustrative_events_not_scientific_evidence")
        assert.equal(slot.caseBinding.eventDetailAuthority, "transient_current_message_only_no_invented_event_label")
        assert.deepEqual(slot.caseBinding.eventLabels, [])
      }
      return Response.json({ id: "mock-sparse-current-context", output_text: JSON.stringify({
        blocks: Object.fromEntries(input.answerSlots.map((s: { slotId: string }) => [s.slotId, visible])), illustrationKind: "none" }),
        usage: { input_tokens: 1, output_tokens: 1 } })
    } })
    assert.ok(result.ok)
    assert.ok(result.answer.includes(visible))
    controls++
  }
  const clinical = buildStudentAnswerExecutionPlan({ question, contract: {
    ...original, caseContext: observed, safetyIntent: "treatment_selection" } })
  assert.equal(clinical.executionRoute, "local_safety_boundary")
  assert.equal(clinical.providerMayReceiveTransientQuestion, false)
  assert.equal(clinical.currentComparisonContext, undefined)
  assert.equal(hash(readFileSync(journalPath)), journalHash)
  console.log(JSON.stringify({ ok: true, gate: "SPARSE_EVENT_CURRENT_SITUATION_HANDOFF", controls,
    candidateSha256: studentCandidateSha256(), exactHistoricalReceiptVerified: true,
    locallySeededContractNotApplicationReplay: true, rawMessagePersisted: false,
    externalProviderCalls: externalCalls, semanticQualityCertified: false, productionEligible: false }, null, 2))
}
void main()

import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import dotenv from "dotenv"
import { configuredStudentReplaySession, type StudentReplayTurn } from "./dna-student-application-replay"
import { studentCandidateSha256 } from "./dna-student-candidate-identity"
import { replayPublicAnswerBody } from "./dna-replay-public-api"
import { resolveStudentApplicationTurn } from "../src/lib/dna/chat/studentFirst/applicationTurn.server"
import { openStudentApplicationContext, sealStudentApplicationContext } from "../src/lib/dna/chat/studentFirst/applicationContext.server"
import { resolveStudentEvidenceFirstRequest } from "../src/lib/dna/chat/studentFirst/evidenceFirstRequest"
import { executeStudentAnswer } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"
import { normalizeDnaChatPublicResponse } from "../src/lib/dna/chat/publicResponseNormalizer"
import { resolveCommittedDnaChatRuntime } from "../src/lib/dna/chat/v3RetrievalServer"

dotenv.config({ path: ".env.local", quiet: true })
const oldCandidate = "484d037932207589584c037f9782377de94f26313a6b4b6a908ba5b1e35f3fbc"
const oldReplay = "b4c9915eaa8c3a9b0345263adeb89eb5b123661219aaa5b11fa98c3e06701d89"
const journalPath = `/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-student-application-replay/${oldCandidate}/${oldReplay}/one-hour24.jsonl`
const journalSha256 = "53ae61e65dfce31cfd5ef3017436c8f1749ae1c382a72b16742659ea3c9be498"
const hash = (value: Buffer | string) => createHash("sha256").update(value).digest("hex")
type Shared = { activity: string; applications: Record<string, string> }
let shared: Shared
let firstContent = ""
let mockCalls = 0
let networkCalls = 0
let audits = 0
let transportAssertion: unknown = null
let malformedAllocation = false
const execute: typeof executeStudentAnswer = (input) => executeStudentAnswer({ ...input, apiKey: "synthetic-not-real",
  fetchImpl: async (_url, init) => {
    mockCalls++
    try {
      const request = JSON.parse(String(init?.body))
      assert.match(request.instructions, /yüklemi bulunan/u)
      const content = JSON.parse(request.input) as { answerSlots: Array<{ slotId: string; obligations: unknown[];
        sentenceComposition?: { sentenceUnits: number }; sharedScenarioBinding?: { targetIds: string[]; applicationSentenceUnits?: Record<string, number> } }> }
      const sharedSlot = content.answerSlots.find((slot) => slot.sharedScenarioBinding)
      assert.ok(sharedSlot)
      assert.deepEqual(sharedSlot.sharedScenarioBinding!.targetIds, ["planning", "working_memory"])
      assert.ok(content.answerSlots.every((slot) => slot.obligations.length > 0))
      const blocks = Object.fromEntries(content.answerSlots.map((slot) => [slot.slotId, slot.sharedScenarioBinding ? {
        activity: shared.activity,
        applications: Object.fromEntries(Object.entries(shared.applications).map(([id, text]) => {
          const n = slot.sharedScenarioBinding!.applicationSentenceUnits?.[id] ?? 1
          // These repeated mock fragments exercise only type/budget ownership;
          // no assertion here certifies naturalness or real scenario quality.
          const pair = { eventStep: text, conceptLink: "Bu adım verilen kavramsal açıklamayı örnekler" }
          return [id, n > 1 ? Array.from({ length: malformedAllocation ? n - 1 : n }, () => pair) : pair]
        })),
      } : (slot.sentenceComposition?.sentenceUnits ?? 1) > 1
        ? Array.from({ length: slot.sentenceComposition!.sentenceUnits }, () => firstContent) : firstContent]))
      return Response.json({ id: "mock-discourse-units", output_text: JSON.stringify({ blocks, illustrationKind: "hypothetical" }),
        usage: { input_tokens: 100, output_tokens: 50 } })
    } catch (error) { transportAssertion = error; throw error }
  } })

async function main() {
  globalThis.fetch = async () => { networkCalls++; throw new Error("external_network_forbidden") }
  Object.assign(process.env, { NODE_ENV: "test", DNA_CHAT_STUDENT_LOCAL_CANDIDATE: "1", DNA_CHAT_RUNTIME_RELEASE: "v2",
    DNA_CHAT_V3_KILL_SWITCH: "0", DNA_CHAT_V3_ROLLOUT_PERCENT: "0" })
  delete process.env.VERCEL_ENV
  const bytes = readFileSync(journalPath)
  assert.equal(hash(bytes), journalSha256)
  const fixtureBytes = readFileSync("scripts/dna-student-fixtures/SYNTHETIC_ONE_HOUR_24.json")
  assert.equal(hash(fixtureBytes), "8c8916240a237c526757b19e0db9047f3a8394b4be389b40868174704a60deb1")
  const turns = (JSON.parse(fixtureBytes.toString()) as { turns: Array<{ turnId: string; user: string }> }).turns
  const rows = bytes.toString().trim().split("\n").map((line) => JSON.parse(line)) as Array<{
    key: string; stage: string; value: StudentReplayTurn; valueSha256: string
  }>
  const session = configuredStudentReplaySession({ candidateSha256: oldCandidate, replaySha256: oldReplay, sessionId: "synthetic-one-hour24" })
  for (const turn of turns.slice(0, 11)) {
    const row = rows.find((row) => row.key === turn.turnId && row.stage === "completed")!
    assert.equal(hash(JSON.stringify(row.value)), row.valueSha256)
    session.restore({ question: turn.user }, row.value)
  }
  const state = session.state()
  assert.ok(state)
  const beforeState = hash(JSON.stringify(state))
  const cachedRow = rows.find((row) => row.key === turns[11]!.turnId && row.stage === "completed")!
  assert.equal(hash(JSON.stringify(cachedRow.value)), cachedRow.valueSha256)
  assert.ok(cachedRow.value.student?.result.ok)
  const cached = cachedRow.value.student.result.candidate
  const oldExample = cached.blocks.find((block) => block.blockKind === "example")!.text
  const visible = oldExample.replace(/^Örnek:\s*/u, "")
  const planningStart = visible.indexOf(" Planlama,")
  const memoryStart = visible.indexOf(" Çalışma belleği,")
  assert.ok(planningStart > 0 && memoryStart > planningStart)
  // This is a constructed decomposition of retained visible prose. The original
  // raw provider fields were not retained and are not claimed to be recovered.
  const reconstructed: Shared = { activity: visible.slice(0, planningStart), applications: {
    planning: visible.slice(planningStart + 1, memoryStart), working_memory: visible.slice(memoryStart + 1).replace(/[.!?]+$/u, ""),
  } }
  firstContent = cached.blocks.find((block) => block.blockKind === "content")!.text
    .replace(/^planlama ve çalışma belleği açısından:\s*/u, "")
  const candidateSha256 = studentCandidateSha256()
  const binding = { secret: "synthetic-discourse-unit-test-secret", actorId: "synthetic-discourse-owner",
    conversationId: "11111111-1111-4111-8111-111111111111", candidateSha256, nowMs: 1_012_000 }
  const question = turns[11]!.user
  const call = () => resolveStudentApplicationTurn({ payload: { question }, binding,
    contextToken: sealStudentApplicationContext(state, binding), execute,
    normal: { createRequestId: () => "discoure-unit-test", resolveRuntimeAnswer: resolveCommittedDnaChatRuntime,
      loadCaseAnswer: async () => ({ ok: false, status: 404, error: "report_not_found" }),
      writeAudit: async () => { audits++; return { ok: true } } } })
  shared = reconstructed
  const result = await call()
  if (transportAssertion) throw transportAssertion
  assert.equal(result.status, 200)
  const answer = normalizeDnaChatPublicResponse(result.body)
  assert.ok(answer)
  const text = replayPublicAnswerBody(answer)
  assert.ok(text.includes(reconstructed.activity + ". planlama: Planlama,"))
  assert.ok(text.includes(reconstructed.applications.planning + ". Bu adım verilen kavramsal açıklamayı örnekler."))
  assert.ok(text.includes("çalışma belleği: Çalışma belleği,"))
  assert.equal(text.includes(oldExample), false)
  for (const unit of [reconstructed.activity, ...Object.values(reconstructed.applications)]) assert.ok(text.includes(unit))
  const after = openStudentApplicationContext(answer.studentContextToken!, binding)
  assert.ok(after)
  assert.deepEqual(after.student.semanticLedger.slice(0, 11), state.student.semanticLedger)
  assert.deepEqual(after.student.activeTargetIds, ["planning", "working_memory"])
  assert.equal(after.student.unresolvedObligations.length, 0)
  let renderingControls = 1
  const resolved = resolveStudentEvidenceFirstRequest({ turnId: "turn-12", message: question, state: state.student })
  assert.ok(resolved.ok)
  const complete: Shared = { activity: "Bir öğrenci bir ödevin adımlarını sıralar", applications: {
    planning: "Planlama, aynı ödevin adımlarını sıraya koymada görülür",
    working_memory: "Çalışma belleği, aynı ödevin sıradaki adımını akılda tutup işlemede görülür",
  } }
  for (const suffix of ["", ".", ";", "?", '.”']) {
    shared = { activity: complete.activity + suffix,
      applications: Object.fromEntries(Object.entries(complete.applications).map(([id, value]) => [id, value + suffix])) }
    const rendered = await execute({ question, contract: resolved.contract })
    assert.ok(rendered.ok)
    const block = rendered.candidate.blocks.find((block) => block.blockKind === "example")!.text
    const terminal = suffix === "" || suffix === ";" ? "." : suffix
    assert.ok(block.includes(complete.activity + terminal + " planlama: Planlama,"))
    assert.ok(block.includes(complete.applications.planning + terminal + " Bu adım verilen kavramsal açıklamayı örnekler."))
    assert.ok(block.includes("çalışma belleği: Çalışma belleği,"))
    assert.doesNotMatch(block, /;\.|[”’]\./u)
    renderingControls++
  }
  shared = { ...complete, activity: "Bir öğrenci 3.5 sayısı, tablo vb. içeren bir ödevin adımlarını sıralar" }
  const numeric = await execute({ question, contract: resolved.contract })
  assert.ok(numeric.ok)
  assert.ok(numeric.answer.includes("3.5 sayısı, tablo vb. içeren"), "internal_punctuation_is_not_a_discourse_boundary")
  renderingControls++
  let countedControls = 0
  for (const depth of ["brief", "standard", "deep"] as const) {
    shared = complete
    const counted = resolveStudentEvidenceFirstRequest({ turnId: "turn-12", message: question + ", iki cümle yaz", state: state.student })
    assert.ok(counted.ok)
    const rendered = await execute({ question: question + ", iki cümle yaz", contract: { ...counted.contract,
      presentation: { ...counted.contract.presentation, depth } } })
    assert.ok(rendered.ok)
    assert.equal(rendered.answer.split(/(?<=[.!?])\s+/u).length, 2)
    assert.ok(rendered.answer.includes(complete.activity + "; planlama: Planlama,"))
    assert.ok(rendered.answer.includes(complete.applications.planning + "; Bu adım verilen kavramsal açıklamayı örnekler"))
    assert.ok(rendered.answer.includes("çalışma belleği: Çalışma belleği,"))
    assert.equal(rendered.candidate.addressedObligationIds.length, counted.contract.obligations.length)
    countedControls++
  }
  let ownedBudgetControls = 0
  for (const sharedOnly of [false, true]) for (const format of ["prose", "bullets"] as const)
    for (const depth of ["brief", "standard", "deep"] as const) for (const requestedSentenceCount of [1, 2, 3, 4, 5, 6]) {
    const obligations: typeof resolved.contract.obligations = sharedOnly ? resolved.contract.obligations.filter((row) =>
      ["give_concrete_example", "bind_example_to_target", "use_shared_scenario", "use_history_anchor"].includes(row.kind))
      : resolved.contract.obligations
    const r = await execute({ question, contract: { ...resolved.contract, obligations,
      presentation: { ...resolved.contract.presentation, format, depth, requestedSentenceCount } } })
    if (transportAssertion) throw transportAssertion
    assert.ok(r.ok, `owned_budget_${sharedOnly}_${format}_${depth}_${requestedSentenceCount}`)
    assert.equal(r.answer.split(/(?<=[.!?])\s+/u).length, requestedSentenceCount)
    if (format === "bullets") assert.equal(r.answer.split("\n").length, requestedSentenceCount)
    assert.ok(r.candidate.blocks.every((block) => block.obligationIds.length > 0))
    for (const text of [shared.activity, ...Object.values(shared.applications)]) assert.ok(r.answer.includes(text))
    assert.equal(r.candidate.blocks.filter((block) => block.blockKind === "example").length, 1)
    assert.equal(new Set(r.candidate.addressedObligationIds).size, obligations.length)
    ownedBudgetControls++
  }
  malformedAllocation = true
  const malformed = await execute({ question, contract: { ...resolved.contract,
    obligations: resolved.contract.obligations.filter((row) =>
      ["give_concrete_example", "bind_example_to_target", "use_shared_scenario", "use_history_anchor"].includes(row.kind)),
    presentation: { ...resolved.contract.presentation, requestedSentenceCount: 6 } } })
  assert.equal(malformed.ok, false, "missing_target_owned_application_fragment_must_not_be_padded")
  malformedAllocation = false
  assert.equal(networkCalls, 0)
  assert.equal(hash(JSON.stringify(state)), beforeState)
  assert.equal(hash(readFileSync(journalPath)), journalSha256)
  console.log(JSON.stringify({ ok: true, gate: "STUDENT_STRUCTURED_DISCOURSE_UNITS", candidateSha256,
    authenticatedPriorReceipts: 11, renderingControls, countedControls, ownedBudgetControls, malformedOwnedAllocationRejected: true,
    reconstructedVisibleFieldsNotOriginalProviderJson: true, fieldTextPreserved: true,
    abbreviationAndDecimalOrdinaryProsePreserved: true, priorStateUnchanged: true, journalUnchanged: true,
    sampleAfter: text, mockCalls, audits, externalProviderCalls: networkCalls,
    fragmentGrammarCertified: false, semanticQualityCertified: false, liveAuthenticatedProof: false }, null, 2))
}
main().catch((error) => { console.error(error); process.exitCode = 1 })

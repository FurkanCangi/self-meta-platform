import assert from "node:assert/strict"
import { assertComparisonOnlyContractMigration } from "./dna-b1-contract-migration-assertion"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import dotenv from "dotenv"
import { configuredStudentReplaySession, type StudentReplayTurn } from "./dna-student-application-replay"
import { studentCandidateSha256 } from "./dna-student-candidate-identity"
import { replayPublicAnswerBody } from "./dna-replay-public-api"
import { resolveStudentApplicationTurn } from "../src/lib/dna/chat/studentFirst/applicationTurn.server"
import { openStudentApplicationContext, sealStudentApplicationContext } from "../src/lib/dna/chat/studentFirst/applicationContext.server"
import { resolveStudentEvidenceFirstRequest } from "../src/lib/dna/chat/studentFirst/evidenceFirstRequest"
import { executeStudentAnswer, validateStudentAnswerCandidate } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"
import { normalizeDnaChatPublicResponse } from "../src/lib/dna/chat/publicResponseNormalizer"
import { resolveCommittedDnaChatRuntime } from "../src/lib/dna/chat/v3RetrievalServer"

dotenv.config({ path: ".env.local", quiet: true })
const oldCandidate = "306f7c1dc740dc46a33b48143ef6419c76f22aa1ee3af09c3696772ebf98d477"
const oldReplay = "a959034806156cc24ffe19d4386fd0b5b7da68420228e426a29002077d345baf"
const journalPath = `/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-student-application-replay/${oldCandidate}/${oldReplay}/student40.jsonl`
const journalSha256 = "e06a0b57e761d5db10dab217313635ded77e57b597e1e7bd23a18ac47ebd08e5"
const hash = (value: Buffer | string) => createHash("sha256").update(value).digest("hex")
type Pair = { eventStep: string; conceptLink: string }
type Slot = { slotId: string; activeTargets: Array<{ targetId: string; visibleAliases: string[] }>;
  relationComposition?: { orderedDefinitionSources: Array<{ targetId: string; definitionText: string }> };
  sharedScenarioBinding?: { representation: string; applicationSentenceUnits?: Record<string, number> } }
const applications: Record<string, Pair> = {
  planning: { eventStep: "Öğrenci sunumun girişini, iki ana başlığını ve kapanışını sıraya koyar",
    conceptLink: "Böylece sunum hedefine ulaşmak için gerekli adımları belirler ve sıralar" },
  working_memory: { eventStep: "Sunumun iki başlığını aklında tutarken yerlerini değiştirip yeni sırayı söyler",
    conceptLink: "Böylece tuttuğu bilgiyi aynı anda yeniden düzenler" },
}
let malformed: unknown = undefined
let semanticNegative: "definition_only" | "unrelated_activity" | null = null
let externalCalls = 0
let mockCalls = 0
let audits = 0
let transportAssertion: unknown = null
const mockFetch: typeof fetch = async (_url, init) => {
  mockCalls++
  try {
    const request = JSON.parse(String(init?.body))
    const slots = JSON.parse(request.input).answerSlots as Slot[]
    const blocks = Object.fromEntries(slots.map((slot) => {
      if (slot.relationComposition) return [slot.slotId, { definitionPremises: Object.fromEntries(
        slot.relationComposition.orderedDefinitionSources.map((s) => [s.targetId, s.definitionText])),
        requestFocus: "definition_difference", scopeOrder: "not_ordered" }]
      assert.equal(slot.sharedScenarioBinding!.representation, "activity_then_target_event_and_concept_link")
      const schema = request.text.format.schema.properties.blocks.properties[slot.slotId]
      return [slot.slotId, { activity: "Bir öğrenci ders için kısa bir sunum hazırlıyor", applications: Object.fromEntries(
        slot.activeTargets.map((target) => {
          const n = slot.sharedScenarioBinding!.applicationSentenceUnits?.[target.targetId] ?? 1
          const property = schema.properties.applications.properties[target.targetId]
          assert.deepEqual((n > 1 ? property.items : property).required, ["eventStep", "conceptLink"])
          const good = applications[target.targetId]!
          const pair = semanticNegative === "definition_only" ? { eventStep: "Bilgiler tutulur ve işlenir", conceptLink: "Bu kavramsal tanımı tekrarlar" }
            : semanticNegative === "unrelated_activity" && target.targetId === "working_memory"
              ? { eventStep: "Öğrenci sonra başka bir derste sayı dizisini ters söyler", conceptLink: good.conceptLink } : good
          return [target.targetId, malformed !== undefined ? malformed
            : n > 1 ? Array.from({ length: n }, () => pair) : pair]
        })) }]
    }))
    return Response.json({ id: `mock-shared-application-${mockCalls}`, output_text: JSON.stringify({ blocks, illustrationKind: "hypothetical" }),
      usage: { input_tokens: 100, output_tokens: 100 } })
  } catch (error) { transportAssertion = error; throw error }
}

async function main() {
  globalThis.fetch = async () => { externalCalls++; throw new Error("external_network_forbidden") }
  Object.assign(process.env, { NODE_ENV: "test", DNA_CHAT_STUDENT_LOCAL_CANDIDATE: "1", DNA_CHAT_RUNTIME_RELEASE: "v2",
    DNA_CHAT_V3_KILL_SWITCH: "0", DNA_CHAT_V3_ROLLOUT_PERCENT: "0" })
  delete process.env.VERCEL_ENV
  const bytes = readFileSync(journalPath)
  assert.equal(hash(bytes), journalSha256)
  const fixtureBytes = readFileSync("scripts/dna-student-fixtures/STUDENT40_DEVELOPMENT.json")
  assert.equal(hash(fixtureBytes), "e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65")
  const fixture = JSON.parse(fixtureBytes.toString()) as { conversations: Array<{ conversationId: string; turns: Array<{ turnId: string; user: string }> }> }
  const conversation = fixture.conversations[1]!
  const rows = bytes.toString().trim().split("\n").map((line) => JSON.parse(line)) as Array<{ key: string; stage: string; value: StudentReplayTurn; valueSha256: string }>
  const session = configuredStudentReplaySession({ candidateSha256: oldCandidate, replaySha256: oldReplay, sessionId: conversation.conversationId })
  for (const turn of conversation.turns.slice(0, 6)) {
    const row = rows.find((row) => row.key === turn.turnId && row.stage === "completed")!
    assert.equal(hash(JSON.stringify(row.value)), row.valueSha256)
    session.restore({ question: turn.user }, row.value)
  }
  const state = session.state()!
  const beforeState = hash(JSON.stringify(state))
  const failed = rows.find((row) => row.key === conversation.turns[6]!.turnId && row.stage === "completed")!.value
  const question = conversation.turns[6]!.user
  const resolved = resolveStudentEvidenceFirstRequest({ turnId: "turn-7", message: question, state: state.student })
  assert.ok(resolved.ok)
  assert.equal(failed.student!.contract.version, "dna-student-request-contract@28")
  assert.equal(resolved.contract.version, "dna-student-request-contract@29")
  assertComparisonOnlyContractMigration(resolved.contract, failed.student!.contract)
  const binding = { secret: "synthetic-application-test-secret", actorId: "synthetic-application-owner",
    conversationId: "11111111-1111-4111-8111-111111111111", candidateSha256: studentCandidateSha256(), nowMs: 1_007_000 }
  let sample = ""
  const verify = (answer: string) => {
    for (const [id, pair] of Object.entries(applications)) {
      assert.ok(answer.includes(`${id === "planning" ? "planlama" : "çalışma belleği"}: ${pair.eventStep}`))
      assert.ok(answer.includes(pair.conceptLink))
    }
    assert.doesNotMatch(answer, /\[object Object\]|eventStep|conceptLink/u)
  }
  for (const responseDepth of ["short", "standard", "deep"] as const) {
    const r = await resolveStudentApplicationTurn({ payload: { question, responseDepth }, binding,
      contextToken: sealStudentApplicationContext(state, binding),
      execute: (input) => executeStudentAnswer({ ...input, apiKey: "synthetic-not-real", fetchImpl: mockFetch }),
      normal: { createRequestId: () => "shared-application", resolveRuntimeAnswer: resolveCommittedDnaChatRuntime,
        loadCaseAnswer: async () => { throw new Error("unrequested_report") }, writeAudit: async () => { audits++; return { ok: true } } } })
    if (transportAssertion) throw transportAssertion
    assert.equal(r.status, 200)
    const pub = normalizeDnaChatPublicResponse(r.body)!
    sample = replayPublicAnswerBody(pub)
    verify(sample)
    const after = openStudentApplicationContext(pub.studentContextToken!, binding)!
    assert.equal(after.sequence, 7)
    assert.deepEqual(after.student.semanticLedger.slice(0, 6), state.student.semanticLedger)
  }
  let presentationControls = 0
  for (const reverse of [false, true]) for (const format of ["prose", "bullets"] as const)
    for (const requestedSentenceCount of [null, 1, 2, 3, 4, 5, 6]) {
      const contract = { ...resolved.contract, targetIds: reverse ? [...resolved.contract.targetIds].reverse() : resolved.contract.targetIds,
        comparisonTargetIds: reverse ? [...resolved.contract.comparisonTargetIds].reverse() : resolved.contract.comparisonTargetIds,
        presentation: { ...resolved.contract.presentation, format, requestedSentenceCount } }
      const r = await executeStudentAnswer({ question, contract, apiKey: "synthetic-not-real", fetchImpl: mockFetch })
      if (transportAssertion) throw transportAssertion
      assert.ok(r.ok)
      verify(r.answer)
      assert.equal(validateStudentAnswerCandidate({ candidate: r.candidate, plan: r.plan }).length, 0)
      if (requestedSentenceCount !== null) assert.equal(r.answer.split(/(?<=[.!?])\s+/u).length, requestedSentenceCount)
      if (format === "bullets" && requestedSentenceCount !== null) assert.equal(r.answer.split("\n").length, requestedSentenceCount)
      presentationControls++
    }
  let malformedRejected = 0
  for (const value of ["Bu adımlar planlamayı gösterir", {}, [], { eventStep: "Öğrenci konuları sıralar" },
    { conceptLink: "Adımların sıralanmasını gösterir" }, { eventStep: "", conceptLink: "Kaynak bağı" },
    { ...applications.planning, extra: "Başka olay" }]) {
    malformed = value
    const r = await executeStudentAnswer({ question, contract: resolved.contract, apiKey: "synthetic-not-real", fetchImpl: mockFetch })
    assert.equal(r.ok, false)
    assert.equal(r.provider.calls, 1)
    malformedRejected++
  }
  malformed = undefined
  const semanticLimits = []
  for (const negative of ["definition_only", "unrelated_activity"] as const) {
    semanticNegative = negative
    const r = await executeStudentAnswer({ question, contract: resolved.contract, apiKey: "synthetic-not-real", fetchImpl: mockFetch })
    assert.ok(r.ok, "schema_checks_do_not_certify_shared_event_semantics")
    semanticLimits.push({ control: negative, structurallyAccepted: true, semanticQualityCertified: false })
  }
  assert.equal(hash(JSON.stringify(state)), beforeState)
  assert.equal(hash(readFileSync(journalPath)), journalSha256)
  assert.equal(externalCalls, 0)
  console.log(JSON.stringify({ ok: true, gate: "STUDENT_TARGET_OWNED_EVENT_APPLICATION", candidateSha256: binding.candidateSha256,
    authenticatedPriorReceipts: 6, exactFailedContract: true, applicationDepths: 3, presentationControls, malformedRejected,
    targetLabelsPreservedWithoutProviderNames: true, eventAndConceptFieldsPreserved: true, semanticLimits,
    mockCalls, audits, externalProviderCalls: externalCalls, stateAndJournalUnchanged: true, sample,
    semanticQualityCertified: false, liveAuthenticatedProof: false }, null, 2))
}
main().catch((error) => { console.error(error); process.exitCode = 1 })

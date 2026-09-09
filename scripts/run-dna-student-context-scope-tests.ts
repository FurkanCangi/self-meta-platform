import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import dotenv from "dotenv"
import { configuredStudentReplaySession, createStudentApplicationReplaySession, type StudentReplayTurn } from "./dna-student-application-replay"
import { studentCandidateSha256 } from "./dna-student-candidate-identity"
import { replayPublicAnswerBody } from "./dna-replay-public-api"
import { interpretStudentContextScope } from "../src/lib/dna/chat/studentFirst/evidenceFirstInterpreter.server"
import { resolveStudentApplicationTurn } from "../src/lib/dna/chat/studentFirst/applicationTurn.server"
import { emptyStudentApplicationState, openStudentApplicationContext, sealStudentApplicationContext, type StudentApplicationState } from "../src/lib/dna/chat/studentFirst/applicationContext.server"
import { executeStudentAnswer } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"
import { normalizeDnaChatPublicResponse } from "../src/lib/dna/chat/publicResponseNormalizer"
import { resolveStudentEvidenceFirstRequest } from "../src/lib/dna/chat/studentFirst/evidenceFirstRequest"
import { resolveCommittedDnaChatRuntime } from "../src/lib/dna/chat/v3RetrievalServer"
import type { DnaChatApiPayload, DnaChatApiResolverDependencies } from "../src/lib/dna/chat/apiResolver"

dotenv.config({ path: ".env.local", quiet: true })
const oldCandidate = "6d2c96c4869d16c8d724c4afb3219f65b07af5f6c1169714cbfc6dbda66ea64d"
const oldReplay = "c93ee11c351be09320411c144f8b4e86b5fee3004bdfc95bba22b0f0cf3539bc"
const journalPath = `/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-student-application-replay/${oldCandidate}/${oldReplay}/mini24.jsonl`
const journalHash = "9f1885f450589828575f5cc741ed126a262410f43f721ec83c5457bb2a3b1b0c"
const hash = (value: Buffer | string) => createHash("sha256").update(value).digest("hex")
const candidateSha256 = studentCandidateSha256()
const binding = { secret: "synthetic-context-scope-regression-secret", actorId: "context-scope-test",
  conversationId: "11111111-1111-4111-8111-111111111111", candidateSha256, nowMs: 1_003_000 }
let scopeChoice: unknown = "continue_context"
let scopeTransport: "normal" | "timeout" | "invalid_json" = "normal"
let scopeCalls = 0
let composerCalls = 0
let audits = 0
let providerAssertion: unknown = null
const normal: DnaChatApiResolverDependencies = {
  createRequestId: () => "scope-regression", resolveRuntimeAnswer: resolveCommittedDnaChatRuntime,
  loadCaseAnswer: async () => ({ ok: false, status: 404, error: "report_not_found" }),
  writeAudit: async () => { audits++; return { ok: true } },
}
const interpretScope: typeof interpretStudentContextScope = (input) => interpretStudentContextScope({ ...input,
  apiKey: "synthetic-not-real", fetchImpl: async (_url, init) => {
    scopeCalls++
    try {
      const content = JSON.parse(JSON.parse(String(init?.body)).input)
      assert.equal(content.currentUserMessage, input.message)
      assert.deepEqual(content.proposedContext.targetIds, input.proposedTargetIds)
      assert.equal(Object.hasOwn(content, "gold"), false)
      assert.equal(Object.hasOwn(content, "visibleAnswer"), false)
      assert.equal(Object.hasOwn(content, "rawHistory"), false)
      if (scopeTransport === "timeout") throw new DOMException("synthetic timeout", "AbortError")
      return Response.json({ id: "mock-scope", output_text: scopeTransport === "invalid_json" ? "not json"
        : JSON.stringify({ scope: scopeChoice }), usage: { input_tokens: 30, output_tokens: 5 } })
    } catch (error) {
      if (!(error instanceof DOMException)) providerAssertion = error
      throw error
    }
  } })
const execute: typeof executeStudentAnswer = (input) => executeStudentAnswer({ ...input, apiKey: "synthetic-not-real",
  fetchImpl: async (_url, init) => {
    composerCalls++
    const content = JSON.parse(JSON.parse(String(init?.body)).input) as { answerSlots: Array<{
      slotId: string; obligations: Array<{ kind: string }>; activeTargets: Array<{ visibleAliases: string[]; lockedClaims: Array<{ text: string }> }>
    }> }
    let example = false
    const blocks = Object.fromEntries(content.answerSlots.map((slot) => {
      const isExample = slot.obligations.some((row) => row.kind === "give_concrete_example")
      example ||= isExample
      const labels = slot.activeTargets.map((target) => target.visibleAliases[0]).join(" ve ")
      return [slot.slotId, isExample
        ? `Derste bir öğrenci dikkatini etkinliğe geri yöneltir; ${labels}, dikkatini ve davranışını dersin koşullarına göre ayarlamasında görülür.`
        : slot.activeTargets.flatMap((target) => target.lockedClaims.map((claim) => claim.text)).join(" ")]
    }))
    return Response.json({ id: "mock-composer", output_text: JSON.stringify({ blocks, illustrationKind: example ? "hypothetical" : "none" }),
      usage: { input_tokens: 70, output_tokens: 15 } })
  } })
const call = (state: StudentApplicationState, payload: DnaChatApiPayload, auditOk = true) => resolveStudentApplicationTurn({
  payload, binding, contextToken: sealStudentApplicationContext(state, binding),
  normal: auditOk ? normal : { ...normal, writeAudit: async () => ({ ok: false }) }, interpretScope, execute,
})

async function main() {
  globalThis.fetch = async () => { throw new Error("external_network_forbidden") }
  Object.assign(process.env, { NODE_ENV: "test", DNA_CHAT_STUDENT_LOCAL_CANDIDATE: "1", DNA_CHAT_RUNTIME_RELEASE: "v2",
    DNA_CHAT_V3_KILL_SWITCH: "0", DNA_CHAT_V3_ROLLOUT_PERCENT: "0" })
  delete process.env.VERCEL_ENV
  const bytes = readFileSync(journalPath)
  assert.equal(hash(bytes), journalHash)
  const fixtureBytes = readFileSync(".tmp/dna-chat-natural-production-20260824/deliverables/DNA_CHAT_NATURAL_PRODUCTION_20260824/02_NATURAL_MINI24/NATURAL_MINI24_FIXTURE.json")
  assert.equal(hash(fixtureBytes), "9f146c18fe4cccf2a54aa4fa4aecd038dfecff3aee81e751f2308e6ea3845adc")
  const fixture = JSON.parse(fixtureBytes.toString()) as { conversations: Array<{ turns: Array<{ turnId: string; rawUserMessage: string }> }> }
  const rows = bytes.toString().trim().split("\n").map((line) => JSON.parse(line)) as Array<{ key: string; stage: string; value: StudentReplayTurn }>
  const oldSession = configuredStudentReplaySession({ candidateSha256: oldCandidate, replaySha256: oldReplay, sessionId: "NMINI-C01" })
  for (const turn of fixture.conversations[0]!.turns.slice(0, 2)) {
    oldSession.restore({ question: turn.rawUserMessage }, rows.find((row) => row.key === turn.turnId && row.stage === "completed")!.value)
  }
  const state = oldSession.state()
  assert.ok(state)
  const stateHash = hash(JSON.stringify(state))
  const exact = fixture.conversations[0]!.turns[2]!.rawUserMessage
  let positiveControls = 0
  for (const question of [exact, "daha detaylı anlat"]) {
    for (const responseDepth of ["short", "standard", "deep"] as const) {
      const before = { scopeCalls, composerCalls, audits }
      const result = await call(state, { question, responseDepth })
      if (providerAssertion) throw providerAssertion
      assert.equal(result.status, 200, JSON.stringify(result.body))
      assert.equal(result.body.runtimeGeneration, "student_first_candidate")
      assert.equal(result.requestInterpretation?.scope, "continue_context")
      assert.equal(result.requestInterpretation?.provider.attempts, 1)
      assert.equal(scopeCalls, before.scopeCalls + 1)
      assert.equal(composerCalls, before.composerCalls + 1)
      assert.equal(audits, before.audits + 1)
      const publicAnswer = normalizeDnaChatPublicResponse(result.body)
      assert.ok(publicAnswer)
      assert.equal(Object.hasOwn(result.body, "requestInterpretation"), false, "internal_usage_not_public_response")
      if (question === exact) assert.match(replayPublicAnswerBody(publicAnswer), /Derste bir öğrenci/u)
      const after = openStudentApplicationContext(publicAnswer.studentContextToken!, binding)
      assert.ok(after)
      assert.equal(after.sequence, 3)
      assert.deepEqual(after.student.semanticLedger.slice(0, 2), state.student.semanticLedger)
      assert.equal(after.student.unresolvedObligations.length, 0)
      positiveControls++
    }
  }
  scopeChoice = "new_subject"
  const newSubjects = ["hava durumunu açıkla", "mitokondriyi örnekle anlat", "neyse çorba tarifi anlat", "gezegenleri kısa bir örnekle anlat"]
  for (const question of newSubjects) {
    const before = { scopeCalls, composerCalls }
    const result = await call(state, { question })
    assert.equal(result.status, 200)
    assert.equal(result.body.runtimeGeneration, "v2_legacy")
    assert.equal(result.requestInterpretation?.scope, "new_subject")
    assert.equal(scopeCalls, before.scopeCalls + 1)
    assert.equal(composerCalls, before.composerCalls)
    const after = openStudentApplicationContext(String(result.body.studentContextToken), binding)
    assert.ok(after)
    assert.deepEqual(after.student, state.student, "new_subject_must_not_commit_old_scientific_contract")
  }
  const protectedPayloads: DnaChatApiPayload[] = [
    { question: "teşekkür ederim" }, { question: "merhaba" }, { question: "öyle işte" }, { question: "bugün hava nasıl" },
    { question: "bu çocuğa hangi terapiyi seçeyim" }, { question: "Bu çocuğa otizm tanısı koyabilir misin" },
    { question: "rapora göre örnek ver" }, { question: "ogrenci@ornek.invalid için örnek ver" },
    { question: exact, mode: "case", reportId: "22222222-2222-4222-8222-222222222222" },
  ]
  for (const payload of protectedPayloads) {
    const before = { scopeCalls, composerCalls }
    await call(state, payload)
    assert.equal(scopeCalls, before.scopeCalls, payload.question)
    assert.equal(composerCalls, before.composerCalls, payload.question)
  }
  const noHistoryBefore = scopeCalls
  await call(emptyStudentApplicationState(null), { question: exact })
  assert.equal(scopeCalls, noHistoryBefore)
  for (const [message, taskEvidence] of [[exact, "observed_request"], ["hava durumunu açıkla", "observed_request"],
    ["teşekkür ederim", "default_explanation"], ["bugün hava nasıl", "default_explanation"]] as const) {
    assert.equal(resolveStudentEvidenceFirstRequest({ turnId: "observed-task", message, state: state.student }).facts.taskEvidence, taskEvidence)
  }
  let failureControls = 0
  for (const choice of ["unresolved", "forged_scope", { scope: "continue_context" }, ["continue_context"], null]) {
    scopeChoice = choice
    const before = { composerCalls, audits }
    const result = await call(state, { question: exact })
    assert.equal(result.status, 503)
    assert.equal(result.body.studentContextToken, undefined)
    assert.equal(result.requestInterpretation?.provider.attempts, 1)
    assert.equal(result.requestInterpretation?.provider.usageComplete, true)
    assert.equal(composerCalls, before.composerCalls)
    assert.equal(audits, before.audits)
    failureControls++
  }
  scopeChoice = "continue_context"
  for (const transport of ["timeout", "invalid_json"] as const) {
    scopeTransport = transport
    const before = composerCalls
    const result = await call(state, { question: exact })
    assert.equal(result.status, 503)
    assert.equal(result.requestInterpretation?.provider.attempts, 1)
    assert.equal(result.requestInterpretation?.provider.usageComplete, false)
    assert.equal(composerCalls, before)
    failureControls++
  }
  scopeTransport = "normal"
  const auditFailure = await call(state, { question: exact }, false)
  assert.equal(auditFailure.status, 503)
  assert.equal(auditFailure.body.error, "audit_unavailable")
  assert.equal(auditFailure.requestInterpretation?.provider.attempts, 1)
  assert.equal(auditFailure.body.studentContextToken, undefined)

  let accountingControls = 0
  for (const [choice, transport] of [["continue_context", "normal"], ["new_subject", "normal"], ["unresolved", "normal"],
    ["continue_context", "timeout"]] as const) {
    scopeChoice = choice
    scopeTransport = transport
    const options = { candidateSha256, replaySha256: "a".repeat(64), sessionId: `scope-accounting-${accountingControls}`,
      secret: "synthetic-replay-accounting-secret", execute, interpretScope, normal }
    const replay = createStudentApplicationReplaySession(options)
    const first = await replay.turn({ question: "öz düzenleme nedir" })
    assert.equal(first.status, 200)
    const second = await replay.turn({ question: exact })
    const continued = choice === "continue_context" && transport === "normal"
    assert.equal(second.providerCalls, continued ? 2 : 1)
    assert.equal(second.usage.inputTokens, continued ? 100 : transport === "normal" ? 30 : 0)
    assert.equal(second.usageComplete, transport === "normal")
    assert.equal(second.requestInterpretation?.provider.attempts, 1)
    const before = { scopeCalls, composerCalls }
    const restored = createStudentApplicationReplaySession(options)
    restored.restore({ question: "öz düzenleme nedir" }, first)
    restored.restore({ question: exact }, second)
    assert.equal(scopeCalls, before.scopeCalls)
    assert.equal(composerCalls, before.composerCalls)
    accountingControls++
  }
  if (providerAssertion) throw providerAssertion
  assert.equal(hash(JSON.stringify(state)), stateHash)
  assert.equal(hash(readFileSync(journalPath)), journalHash)
  console.log(JSON.stringify({ ok: true, gate: "STUDENT_CONTEXT_SCOPE_INTERPRETATION", candidateSha256,
    authenticatedHistoricalReceipts: 2, positiveControls, newSubjectControls: newSubjects.length,
    protectedControls: protectedPayloads.length, noHistoryScopeDenied: true, failureControls, auditFailureClosed: true,
    accountingControls, oldReceiptsPreserved: true, stateUnchanged: true, mockScopeCalls: scopeCalls, mockComposerCalls: composerCalls,
    externalProviderCalls: 0, semanticQualityCertified: false, liveAuthenticatedProof: false }, null, 2))
}
main().catch((error) => { console.error(error); process.exitCode = 1 })

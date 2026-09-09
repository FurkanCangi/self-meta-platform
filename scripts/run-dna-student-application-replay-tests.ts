import assert from "node:assert/strict"
import { createStudentApplicationReplaySession, replayHash, STUDENT_APPLICATION_REPLAY_VERSION } from "./dna-student-application-replay"
import { createStudentReplayJournal, journalApplicationTurn, openStudentReplayJournal } from "./dna-student-replay-journal"
import { executeStudentAnswer } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"
import { resolveStudentApplicationTurn } from "../src/lib/dna/chat/studentFirst/applicationTurn.server"
import { normalizeDnaChatPublicResponse } from "../src/lib/dna/chat/publicResponseNormalizer"
import { replayPublicAnswerBody } from "./dna-replay-public-api"
import { resolveCommittedDnaChatRuntime } from "../src/lib/dna/chat/v3RetrievalServer"
import { studentCandidateSha256 } from "./dna-student-candidate-identity"
import { existsSync, readFileSync } from "node:fs"

const originalEnv = { ...process.env }
let providerCalls = 0
const fetchImpl: typeof fetch = async (_url, init) => {
  providerCalls++
  const input = JSON.parse(JSON.parse(String(init?.body)).input) as {
    answerSlots: Array<{ slotId: string; activeTargets: Array<{ title: string }> }> }
  const blocks = Object.fromEntries(input.answerSlots.map((slot) => [slot.slotId,
    `${slot.activeTargets.map((row) => row.title).join(" ve ")} için kaynak bilgisine dayalı bir açıklama veriyorum.`]))
  return new Response(JSON.stringify({ id: `synthetic-${providerCalls}`, output_text: JSON.stringify({ blocks, illustrationKind: "none" }),
    usage: { input_tokens: 10, output_tokens: 10 } }), { status: 200, headers: { "Content-Type": "application/json" } })
}
const execute: typeof executeStudentAnswer = (input) => executeStudentAnswer({ ...input, apiKey: "synthetic-no-real-key", fetchImpl })
const options = { candidateSha256: studentCandidateSha256(), replaySha256: replayHash("local-replay-protocol-control"),
  sessionId: "local-mixed-session", secret: "synthetic-local-secret-more-than-32-characters", execute }

async function main() {
  globalThis.fetch = async () => { throw new Error("external_network_forbidden") }
  Object.assign(process.env, { NODE_ENV: "test", DNA_CHAT_STUDENT_LOCAL_CANDIDATE: "1", DNA_CHAT_RUNTIME_RELEASE: "v2",
    DNA_CHAT_V3_KILL_SWITCH: "0", DNA_CHAT_V3_ROLLOUT_PERCENT: "0" })
  delete process.env.VERCEL_ENV
  let bytes = ""
  const storage = { read: () => bytes, append: (line: string) => { bytes += line } }
  const journal = createStudentReplayJournal(storage)
  const session = createStudentApplicationReplaySession(options)
  const firstInput = { question: "duyusal regülasyon nedir", responseDepth: "short" as const }
  const first = await journalApplicationTurn(journal, "first", session, firstInput)
  assert.equal(first.status, 200)
  assert.equal(first.body.runtimeGeneration, "student_first_candidate")
  assert.equal(first.student?.contract.turnId, "turn-1")
  assert.equal(first.usage.inputTokens, 10)
  assert.equal(first.providerCalls, 1)
  assert.equal(first.auditWrites, 1)
  const direct = await resolveStudentApplicationTurn({ payload: firstInput,
    binding: { secret: options.secret, actorId: "direct-local-control", conversationId: "direct-session",
      candidateSha256: options.candidateSha256, nowMs: first.nowMs }, execute,
    normal: { createRequestId: () => "direct", resolveRuntimeAnswer: resolveCommittedDnaChatRuntime,
      loadCaseAnswer: async () => ({ ok: false, status: 404, error: "report_not_found" }), writeAudit: async () => ({ ok: true }) } })
  assert.equal(first.visibleAnswer, replayPublicAnswerBody(normalizeDnaChatPublicResponse(direct.body)!))

  const secondInput = { question: "bunu daha basit anlat" }
  const second = await journalApplicationTurn(journal, "second", session, secondInput)
  assert.equal(second.status, 200)
  assert.equal(session.state()?.student.semanticLedger.length, 2)
  const beforeRestore = providerCalls
  const restored = createStudentApplicationReplaySession(options)
  const reopened = createStudentReplayJournal(storage)
  assert.deepEqual(await journalApplicationTurn(reopened, "first", restored, firstInput), first)
  assert.deepEqual(await journalApplicationTurn(reopened, "second", restored, secondInput), second)
  assert.equal(providerCalls, beforeRestore, "cached replay must not regenerate")
  const cachedTurnProviderCalls = providerCalls - beforeRestore
  assert.deepEqual(restored.state(), session.state())

  let judgments = 0
  const judgment = await journal.once("first:judge", first.receiptSha256, async () => { judgments++; return { verdict: "FAIL" } })
  assert.deepEqual(await createStudentReplayJournal(storage).once("first:judge", first.receiptSha256,
    async () => { judgments++; return { verdict: "PASS" } }), judgment)
  assert.equal(judgments, 1, "FAIL judgments cannot be retried to obtain PASS")
  await assert.rejects(() => journal.once("first:judge", "different-answer", async () => ({ verdict: "PASS" })), /journal_input_changed/)

  for (const replacement of [{ candidateSha256: "0".repeat(64) }, { replaySha256: "0".repeat(64) },
    { sessionId: "different-session" }, { secret: "a-different-synthetic-secret-more-than-32" }]) {
    assert.throws(() => createStudentApplicationReplaySession({ ...options, ...replacement }).restore(firstInput, first))
  }
  assert.throws(() => createStudentApplicationReplaySession(options).restore(firstInput, second), /replay_receipt_binding/)
  assert.throws(() => createStudentApplicationReplaySession(options).restore({ question: "farklı soru" }, first), /inputSha256/)
  assert.throws(() => createStudentApplicationReplaySession(options).restore(firstInput, { ...first, visibleAnswer: "changed" }), /tampered/)
  const changed = { ...first, visibleAnswer: "changed" }
  const { receiptSha256: _sha, ...content } = changed
  assert.throws(() => createStudentApplicationReplaySession(options).restore(firstInput,
    { ...content, receiptSha256: replayHash(JSON.stringify(content)) }), /visible_answer_mismatch/)

  // A report is selected, scientific detour and return both use the same opaque
  // state. This checks transport/ownership boundaries, not semantic quality.
  const reportId = "22222222-2222-4222-8222-222222222222"
  const reportContext = { dataStatus: "synthetic" as const, ageMonths: 48, scores: { sensory: 31 },
    chatContext: { primaryAxis: "Duyusal düzenleme", caseEvidenceLines: ["Duyusal alan puanı 31 olarak kayıtlı."],
      dataLimitations: ["Doğrudan fizyolojik ölçüm yoktur."] } }
  const selected = await session.turn({ question: "Bu raporda en çok hangi alan öne çıkmış?", reportId, reportContext })
  assert.equal(selected.status, 200)
  assert.equal(selected.accessedCaseReport, true)
  assert.equal(selected.reportLoads, 1)
  assert.equal(session.state()?.student.semanticLedger.length, 2)
  const scientific = await session.turn({ question: "interosepsiyon nedir", reportId, reportContext })
  assert.equal(scientific.status, 200)
  assert.equal(scientific.reportLoads, 0)
  assert.equal(scientific.body.runtimeGeneration, "student_first_candidate")
  assert.equal(session.state()?.reportId, reportId)
  const reportReturn = await session.turn({ question: "Bu raporda en çok hangi alan öne çıkmış?", reportId, reportContext })
  assert.equal(reportReturn.status, 200)
  assert.equal(reportReturn.reportLoads, 1, "cached token is not report access authority")
  assert.equal(session.state()?.student.semanticLedger.length, 3)
  const switched = await session.turn({ question: "duyusal regülasyon nedir", reportId: "33333333-3333-4333-8333-333333333333", reportContext })
  assert.equal(switched.status, 200)
  assert.equal(session.state()?.student.semanticLedger.length, 1, "report switch clears old referents")

  const missing = createStudentApplicationReplaySession({ ...options, sessionId: "missing-report" })
  const denied = await missing.turn({ question: "Bu raporu özetle", reportId })
  assert.equal(denied.status, 404)
  assert.equal(denied.visibleAnswer, null)
  assert.equal(missing.state(), null)
  await assert.rejects(() => missing.turn(firstInput), /replay_session_unavailable/)
  const failed = createStudentApplicationReplaySession({ ...options, sessionId: "provider-failure",
    execute: async () => { throw new Error("unknown-provider-outcome") } })
  const failedTurn = await failed.turn(firstInput)
  assert.equal(failedTurn.status, 503)
  assert.equal(failedTurn.usageComplete, false, "unknown usage must not become a known zero")

  let interruptedBytes = ""
  const interruptedIo = { read: () => interruptedBytes, append: (line: string) => { interruptedBytes += line } }
  await assert.rejects(() => createStudentReplayJournal(interruptedIo).once("uncertain", {}, async () => { throw new Error("interrupted") }))
  await assert.rejects(() => createStudentReplayJournal(interruptedIo).once("uncertain", {}, async () => "replacement"), /indeterminate_attempt_do_not_retry/)
  assert.throws(() => createStudentReplayJournal({ read: () => `${bytes}${bytes}`, append: () => {} }), /duplicate_attempt/)
  if (!existsSync("/Volumes/ResearchSSD")) assert.throws(() => openStudentReplayJournal("control", options.candidateSha256,
    options.replaySha256), /ResearchSSD_not_mounted/)
  const fixture = readFileSync("scripts/dna-student-fixtures/SYNTHETIC_ONE_HOUR_24.json")
  assert.equal(replayHash(fixture), "8c8916240a237c526757b19e0db9047f3a8394b4be389b40868174704a60deb1")
  const runners = ["mini24", "scientific250", "full602", "one-hour"]
  for (const runner of runners) {
    const code = readFileSync(`scripts/run-dna-student-${runner}-visible.ts`, "utf8")
    assert.ok(code.includes("journalApplicationTurn(journal"), `${runner}:application_replay_missing`)
    assert.equal(code.includes("executeStudentAnswer("), false, `${runner}:isolated_executor_bypass`)
    assert.equal(code.includes("answerTr"), false, `${runner}:internal_answer_fallback`)
  }
  const scientificCode = readFileSync("scripts/run-dna-student-scientific250-visible.ts", "utf8")
  assert.equal(scientificCode.includes("row.expectedTopicIds"), false, "expected labels must not select a runtime")
  const fullCode = readFileSync("scripts/run-dna-student-full602-visible.ts", "utf8")
  assert.ok(fullCode.includes("readyForPaidReplay: false"), "unpassed Full602 authority must stay closed")
  assert.ok(fullCode.includes("readCertifiedScientific250ApplicationScores(candidate)"), "Full602 must require current Scientific250 formal PASS")
  const miniCode = readFileSync("scripts/run-dna-student-mini24-visible.ts", "utf8")
  assert.ok(miniCode.includes("visibleHistory.push({ turnId: turn.turnId"), "Mini24 gold history IDs must be preserved")
  console.log(JSON.stringify({ ok: true, candidateSha256: options.candidateSha256, replayVersion: STUDENT_APPLICATION_REPLAY_VERSION,
    directApplicationVisibleParity: true, sameTokenReportScientificReturn: true, reportSwitchClearsPriorState: true,
    cachedTurnsRestored: 2, cachedTurnProviderCalls, applicationRunnersWired: runners,
    failedJudgmentExecutions: judgments, unknownAttemptRetryBlocked: true, mockProviderCalls: providerCalls,
    externalProviderCalls: 0, semanticQualityCertified: false, authenticatedE2e: false }, null, 2))
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => {
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key]
  Object.assign(process.env, originalEnv)
})

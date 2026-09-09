import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import dotenv from "dotenv"
import { configuredStudentReplaySession, type StudentReplayTurn } from "./dna-student-application-replay"
import { studentCandidateSha256 } from "./dna-student-candidate-identity"
import { replayPublicAnswerBody } from "./dna-replay-public-api"
import { resolveStudentApplicationTurn } from "../src/lib/dna/chat/studentFirst/applicationTurn.server"
import { emptyStudentApplicationState, openStudentApplicationContext, sealStudentApplicationContext,
  type StudentApplicationState } from "../src/lib/dna/chat/studentFirst/applicationContext.server"
import { resolveStudentEvidenceFirstRequest } from "../src/lib/dna/chat/studentFirst/evidenceFirstRequest"
import { executeStudentAnswer } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"
import { normalizeDnaChatPublicResponse } from "../src/lib/dna/chat/publicResponseNormalizer"
import { inspectDnaS13LimitedRolloutPrivacy } from "../src/lib/dna/chat/s13/limitedRollout/privacy"
import { buildDnaChatAuditMetadata, resolveDnaChatApiRequest, type DnaChatApiPayload, type DnaChatApiResolverDependencies } from "../src/lib/dna/chat/apiResolver"
import { resolveCommittedDnaChatRuntime } from "../src/lib/dna/chat/v3RetrievalServer"

// Authenticate exact historical answers without regeneration or rejudgment.
// New controls are development checks, not replacements for Frozen fixture/gold.
dotenv.config({ path: ".env.local", quiet: true })
const oldCandidate = "42a92d0f498484de65e0f818db4ff5fe6e8aff13a6f77b85583f979614ad5834"
const oldReplay = "ad4d5c51151dbc0e058c76c84aff930f7985a96404f95fe65f3e805dee38dad9"
const journalPath = `/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-student-application-replay/${oldCandidate}/${oldReplay}/mini24.jsonl`
const journalSha256 = "93669e57d295c15de35c540d93466f6e32afa7bab9041e1479f9062c8a5948da"
const hash = (value: Buffer | string) => createHash("sha256").update(value).digest("hex")
const binding = { secret: "synthetic-local-response-authority-test-secret", actorId: "synthetic-local-response-owner",
  conversationId: "11111111-1111-4111-8111-111111111111", candidateSha256: studentCandidateSha256(), nowMs: 1_011_000 }
let networkCalls = 0
let executorCalls = 0
let scopeCalls = 0
let reportLoads = 0
let audits = 0
const normal: DnaChatApiResolverDependencies = {
  createRequestId: () => "local-response-authority-test", resolveRuntimeAnswer: resolveCommittedDnaChatRuntime,
  loadCaseAnswer: async () => { reportLoads++; return { ok: false, status: 404, error: "report_not_found" } },
  writeAudit: async (audit) => { buildDnaChatAuditMetadata(audit); audits++; return { ok: true } },
}
const execute: typeof executeStudentAnswer = async (input) => {
  executorCalls++
  assert.equal(input.externalProviderAllowed, false, "local_permission_must_not_grant_transmission")
  const result = await executeStudentAnswer(input)
  assert.ok(result.ok)
  assert.equal(result.route, "local_safety_boundary")
  assert.equal(result.provider.calls, 0)
  return result
}
const call = (state: StudentApplicationState, payload: DnaChatApiPayload,
  overrides: Partial<DnaChatApiResolverDependencies> = {}, executeImpl = execute) => resolveStudentApplicationTurn({
  payload, binding, contextToken: sealStudentApplicationContext(state, binding),
  normal: { ...normal, ...overrides }, execute: executeImpl,
  interpretScope: async () => { scopeCalls++; throw new Error("sensitive_local_request_must_not_use_scope_provider") },
})

async function main() {
  globalThis.fetch = async () => { networkCalls++; throw new Error("external_network_forbidden") }
  Object.assign(process.env, { NODE_ENV: "test", DNA_CHAT_STUDENT_LOCAL_CANDIDATE: "1", DNA_CHAT_RUNTIME_RELEASE: "v2",
    DNA_CHAT_V3_KILL_SWITCH: "0", DNA_CHAT_V3_ROLLOUT_PERCENT: "0" })
  delete process.env.VERCEL_ENV
  const bytes = readFileSync(journalPath)
  assert.equal(hash(bytes), journalSha256)
  const fixtureBytes = readFileSync(".tmp/dna-chat-natural-production-20260824/deliverables/DNA_CHAT_NATURAL_PRODUCTION_20260824/02_NATURAL_MINI24/NATURAL_MINI24_FIXTURE.json")
  assert.equal(hash(fixtureBytes), "9f146c18fe4cccf2a54aa4fa4aecd038dfecff3aee81e751f2308e6ea3845adc")
  const fixture = JSON.parse(fixtureBytes.toString()) as { conversations: Array<{ turns: Array<{ turnId: string; rawUserMessage: string }> }> }
  const rows = bytes.toString().trim().split("\n").map((line) => JSON.parse(line)) as Array<{
    key: string; stage: string; value: StudentReplayTurn; valueSha256: string
  }>
  const session = configuredStudentReplaySession({ candidateSha256: oldCandidate, replaySha256: oldReplay, sessionId: "NMINI-C01" })
  const turns = fixture.conversations[0]!.turns
  for (const turn of turns.slice(0, 10)) {
    const row = rows.find((row) => row.stage === "completed" && row.key === turn.turnId)!
    assert.equal(hash(JSON.stringify(row.value)), row.valueSha256)
    session.restore({ question: turn.rawUserMessage }, row.value)
  }
  const state = session.state()
  assert.ok(state)
  assert.equal(state.sequence, 10)
  const beforeState = hash(JSON.stringify(state))
  const exact = turns[10]!.rawUserMessage
  let positiveControls = 0
  const privacyContrasts: Array<Record<string, unknown>> = []
  for (const question of [exact, "o zaman bu çocuk için kesin öz düzenleme sorunu var diyebilir miyiz"]) {
    const privacy = inspectDnaS13LimitedRolloutPrivacy({ question })
    assert.equal(privacy.allowed, false)
    assert.equal(privacy.category, question === exact ? "sensitive_or_unknown" : "clinical_case")
    privacyContrasts.push({ question, category: privacy.category, allowed: privacy.allowed })
    for (const responseDepth of ["short", "standard", "deep"] as const) {
      const before = { executorCalls, audits, reportLoads }
      const result = await call(state, { question, responseDepth })
      assert.equal(result.status, 200, JSON.stringify(result.body))
      assert.equal(result.requestInterpretation, undefined)
      const publicAnswer = normalizeDnaChatPublicResponse(result.body)
      assert.ok(publicAnswer)
      assert.equal(publicAnswer.runtimeGeneration, "student_first_candidate")
      assert.equal(publicAnswer.responseDepth, responseDepth)
      assert.match(replayPublicAnswerBody(publicAnswer), /öz düzenleme/u)
      assert.match(replayPublicAnswerBody(publicAnswer), /yeterli değildir/u)
      const after = openStudentApplicationContext(publicAnswer.studentContextToken!, binding)
      assert.ok(after)
      assert.equal(after.sequence, 11)
      assert.deepEqual(after.student.semanticLedger.slice(0, 10), state.student.semanticLedger)
      assert.deepEqual(after.student.activeTargetIds, ["self_regulation"])
      assert.equal(after.student.unresolvedObligations.length, 0)
      assert.equal(executorCalls, before.executorCalls + 1)
      assert.equal(audits, before.audits + 1)
      assert.equal(reportLoads, before.reportLoads)
      assert.deepEqual(inspectDnaS13LimitedRolloutPrivacy({ question }), privacy)
      positiveControls++
    }
  }
  const fresh = await call(emptyStudentApplicationState(null), { question: exact })
  assert.equal(fresh.status, 200, "explicit_local_boundary_does_not_require_a_prior_case")
  positiveControls++
  let protectedControls = 0
  const reportControls: Array<Record<string, unknown>> = []
  for (const payload of [
    { question: "o zaman bu çocukta öz düzenleme nedir" },
    { question: "o zaman bu çocuk için öz düzenleme nedir" },
    { question: `ogrenci@ornek.invalid için ${exact}` },
    { question: `TC kimlik no 12345678901 ${exact}` },
    { question: `rapora göre ${exact}`, reportId: "22222222-2222-4222-8222-222222222222" },
    { question: exact, mode: "case" as const, reportId: "22222222-2222-4222-8222-222222222222" },
    { question: "bu raporu özetle", reportId: "22222222-2222-4222-8222-222222222222" },
    { question: "bu çocuğa hangi terapiyi seçeyim" },
    { question: "bu çocuğa otizm tanısı koyabilir misin" },
    { question: "teşekkür ederim" },
    { question: "böyle işte" },
  ]) {
    const before = { executorCalls, scopeCalls }
    const result = await call(state, payload)
    assert.equal(executorCalls, before.executorCalls, payload.question)
    assert.equal(scopeCalls, before.scopeCalls, payload.question)
    if (payload.reportId) {
      // Some report-worded unsafe requests are refused before a report read.
      // Preserve the actual normal authority instead of inventing a 404 gold.
      const normalResult = await resolveDnaChatApiRequest(payload, normal)
      assert.equal(result.status, normalResult.status)
      assert.equal(result.accessedCaseReport, normalResult.accessedCaseReport)
      assert.equal(result.body.classification, normalResult.body.classification)
      if (payload.question === "bu raporu özetle") assert.equal(result.status, 404)
      reportControls.push({ question: payload.question, mode: payload.mode ?? "theory", status: result.status,
        classification: result.body.classification ?? null, normalAuthorityMatched: true })
    }
    if (payload.question.endsWith("öz düzenleme nedir")) {
      assert.equal(result.status, 503)
      assert.equal(result.body.error, "student_provider_privacy_boundary")
    }
    protectedControls++
  }
  const beforeUnbound = executorCalls
  await call(emptyStudentApplicationState(null), { question: "o zaman bu çocukta kesin sorun var diyebilir miyiz" })
  assert.equal(executorCalls, beforeUnbound)
  protectedControls++
  const auditFailure = await call(state, { question: exact }, { writeAudit: async () => ({ ok: false }) })
  assert.equal(auditFailure.status, 503)
  assert.equal(auditFailure.body.error, "audit_unavailable")
  assert.equal(auditFailure.body.studentContextToken, undefined)

  // A caller cannot use a local-only permission with a changed provider plan.
  const grounded = resolveStudentEvidenceFirstRequest({ turnId: "turn-11", message: "öz düzenleme nedir", state: state.student })
  assert.ok(grounded.ok)
  const denied = await executeStudentAnswer({ question: "öz düzenleme nedir", contract: grounded.contract, externalProviderAllowed: false })
  assert.equal(denied.ok, false)
  if (denied.ok) throw new Error("provider_plan_was_allowed")
  assert.equal(denied.reason, "provider_permission_denied")
  assert.equal(denied.provider.calls, 0)
  assert.equal(denied.provider.usageComplete, true)
  const beforeMismatch = audits
  const mismatch = await call(state, { question: exact }, {}, (input) => executeStudentAnswer({ ...input,
    question: "öz düzenleme nedir", contract: grounded.contract }))
  assert.equal(mismatch.status, 503)
  assert.equal(mismatch.body.error, "student_provider_privacy_boundary")
  assert.equal(mismatch.body.studentContextToken, undefined)
  assert.equal(audits, beforeMismatch)
  const invalidContext = await resolveStudentApplicationTurn({ payload: { question: exact }, binding,
    contextToken: "invalid", normal, execute })
  assert.equal(invalidContext.status, 503)
  assert.equal(invalidContext.body.error, "student_context_invalid")
  assert.equal(hash(JSON.stringify(state)), beforeState)
  assert.equal(hash(readFileSync(journalPath)), journalSha256)
  assert.equal(scopeCalls, 0)
  assert.equal(networkCalls, 0)
  console.log(JSON.stringify({ ok: true, gate: "STUDENT_LOCAL_RESPONSE_AUTHORITY", candidateSha256: binding.candidateSha256,
    authenticatedPriorReceipts: 10, positiveControls, protectedControls, privacyContrasts, reportControls,
    privacyPermissionsUnchanged: true, externalProviderGateEnforced: true, planMismatchDenied: true,
    auditFailureClosed: true, invalidContextDenied: true, stateUnchanged: true, journalUnchanged: true,
    executorCalls, scopeCalls, reportLoads, audits, externalProviderCalls: networkCalls,
    semanticQualityCertified: false, liveAuthenticatedProof: false }, null, 2))
}
main().catch((error) => { console.error(error); process.exitCode = 1 })

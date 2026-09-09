import assert from "node:assert/strict"
import Module from "node:module"
import path from "node:path"
import { readFileSync } from "node:fs"
import { createHash, randomUUID } from "node:crypto"
import { studentCandidateSha256 } from "./dna-student-candidate-identity"
import { emptyStudentApplicationState, openStudentApplicationContext, sealStudentApplicationContext } from "../src/lib/dna/chat/studentFirst/applicationContext.server"
import { applyStudentRequestContract, resolveStudentObligations } from "../src/lib/dna/chat/studentFirst/conversationState"
import { resolveStudentEvidenceFirstRequest } from "../src/lib/dna/chat/studentFirst/evidenceFirstRequest"
import { normalizeDnaChatPublicResponse } from "../src/lib/dna/chat/publicResponseNormalizer"
import { DNA_S13_LIMITED_ROLLOUT_ENV } from "../src/lib/dna/chat/s13/limitedRollout/config"
import { executeStudentAnswer } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"
import { getDnaOwnerBookTopicClaims } from "../src/lib/dna/chat/ownerBookRuntime"

// Actual exported POST, with external identity/storage/rate-limit/provider
// boundaries doubled. This is NOT live authenticated Supabase/UI evidence.
const moduleLoader = Module as unknown as { _load: (id: string, parent: unknown, isMain: boolean) => unknown }
const originalLoad = moduleLoader._load
const originalEnv = { ...process.env }
let authenticated = true
let trusted = true
let limited = false
let auditOk = true
let authCalls = 0
let providerCalls = 0
let scopeProviderCalls = 0
let scopeChoice = "continue_context"
let auditCalls = 0
let reportQueries = 0
let relationAttack = false
const actorId = "synthetic-post-owner"
const conversationId = randomUUID()
const secret = "synthetic-post-context-secret-never-a-real-key"
const stubs: Record<string, unknown> = {
  "@/lib/security/apiGuards": {
    requireTrustedMutation: () => trusted ? null : Response.json({ error: "unauthorized" }, { status: 401 }),
    requireConfirmedUser: async () => { authCalls++; return authenticated ? { ok: true, user: { id: actorId, email: "local@example.invalid" } }
      : { ok: false, response: Response.json({ error: "unauthorized" }, { status: 401 }) } },
  },
  "@/lib/security/rateLimit": { checkRateLimit: async () => ({ backendAvailable: true, ok: !limited, resetAt: Date.now() + 1_000 }) },
  "@/lib/supabase/admin": { createSupabaseAdminClient: () => ({}) },
  "@/lib/supabase/server": { createSupabaseServerClient: async () => {
    reportQueries++
    const query: Record<string, unknown> = {}
    for (const method of ["select", "eq", "is", "not", "order"]) query[method] = () => query
    query.limit = async () => ({ data: [], error: null })
    return { from: () => query }
  } },
  "@/lib/security/privacyOps": { recordDataAccessAuditEvent: async () => { auditCalls++; return { ok: auditOk } } },
}

async function main() {
  Object.assign(process.env, { NODE_ENV: "test", DNA_CHAT_STUDENT_LOCAL_CANDIDATE: "1", DNA_CHAT_RUNTIME_RELEASE: "v2",
    DNA_CHAT_V3_KILL_SWITCH: "0", DNA_CHAT_V3_ROLLOUT_PERCENT: "0", OPENAI_API_KEY: "synthetic-not-a-real-provider-key",
    [DNA_S13_LIMITED_ROLLOUT_ENV.contextSecret]: secret })
  delete process.env.VERCEL_ENV
  moduleLoader._load = function(id, parent, isMain) {
    if (Object.hasOwn(stubs, id)) return stubs[id]
    return originalLoad.call(this, id.startsWith("@/") ? path.resolve(__dirname, "../src", id.slice(2)) : id, parent, isMain)
  }
  globalThis.fetch = async (_url, init) => {
    providerCalls++
    const request = JSON.parse(String(init?.body))
    if (request.text?.format?.name === "dna_student_context_scope") {
      scopeProviderCalls++
      return Response.json({ id: `mock-post-scope-${scopeProviderCalls}`,
        output_text: JSON.stringify({ scope: scopeChoice }), usage: { input_tokens: 30, output_tokens: 5 } })
    }
    const content = JSON.parse(request.input) as {
      historyAnchor: null | { targetLabels: string[] }
      answerSlots: Array<{ slotId: string; sharedScenarioBinding?: unknown; summaryComposition?: { sentenceUnits: number };
        sentenceComposition?: { sentenceUnits: number };
        relationComposition?: { orderedDefinitionSources: Array<{ targetId: string; definitionText: string }> };
        activeTargets: Array<{ targetId: string; title: string; visibleAliases: string[] }>;
        caseBinding: null | { eventLabels: string[] }; obligations: Array<{ kind: string }> }>
    }
    let example = false
    const blocks = Object.fromEntries(content.answerSlots.map((slot) => {
      const labels = slot.activeTargets.map((target) => target.title).join(" ve ")
      const kinds = slot.obligations.map((obligation) => obligation.kind)
      if (relationAttack) {
        const text = "Arousal duyusal düzenlemenin yalnızca bir yönünü etkiler ve kesin nedenidir."
        const n = slot.sentenceComposition?.sentenceUnits ?? 1
        return [slot.slotId, n > 1 ? Array.from({ length: n }, () => text) : text]
      }
      if (slot.relationComposition) return [slot.slotId, { definitionPremises: Object.fromEntries(slot.relationComposition.orderedDefinitionSources.map((source) => [source.targetId, source.definitionText])), requestFocus: "definition_difference", scopeOrder: "not_ordered" }]
      if (kinds.includes("give_concrete_example")) {
        example = true
        if (slot.sharedScenarioBinding) return [slot.slotId, {
          activity: "Bir öğrenci bir ödevin adımlarını sıralar",
          applications: Object.fromEntries(slot.activeTargets.map((target) => [target.targetId,
            { eventStep: target.targetId === "planning" ? "Planlama, aynı ödevin adımlarını sıraya koymada görülür"
              : "Çalışma belleği, aynı ödevin sıradaki adımını akılda tutup işlemede görülür",
              conceptLink: "Bu adım verilen kavramsal açıklamayı örnekler" }])),
        }]
        const visibleLabels = slot.activeTargets.map((target) => target.visibleAliases[0]).join(" ve ")
        return [slot.slotId, `Derste bir öğrenci dikkatini etkinliğe geri yöneltir; ${visibleLabels}, dikkatini ve davranışını dersin koşullarına göre ayarlamasında görülür.`]
      }
      const prefix = slot.caseBinding ? `${labels}, ${slot.caseBinding.eventLabels.join(", ")} olay dizisinde `
        : content.historyAnchor ? `Önceki ${content.historyAnchor.targetLabels.join(" ve ")} durumunda ` : ""
      const text = prefix + (kinds.includes("summarize_unknown") ? "Bu açıklama tek başına kesin bir sonuç göstermez."
        : kinds.includes("summarize_observation_focus") ? "Gözlemde farklı ortam ve görevlerde ne olduğuna bakılır."
        : `${labels} konuşmada bildiğimiz başlıklardır.`)
      return [slot.slotId, (slot.summaryComposition?.sentenceUnits ?? slot.sentenceComposition?.sentenceUnits ?? 1) > 1
        ? Array.from({ length: (slot.summaryComposition ?? slot.sentenceComposition)!.sentenceUnits }, () => text) : text]
    }))
    return Response.json({ id: `mock-post-${providerCalls}`, output_text: JSON.stringify({ blocks, illustrationKind: example ? "hypothetical" : "none" }),
      usage: { input_tokens: 10, output_tokens: 10 } })
  }
  const { POST } = await import("../src/app/api/app/dna-chat/route")
  const send = (data: Record<string, unknown>) => POST(new Request("http://localhost/api/app/dna-chat", {
    method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost" },
    body: JSON.stringify({ conversationId, question: "duyusal regülasyon nedir", ...data }),
  }))
  const first = await send({ responseDepth: "short" })
  assert.equal(first.status, 200)
  assert.match(first.headers.get("Cache-Control") || "", /no-store/)
  const firstBody = await first.json()
  const firstAnswer = normalizeDnaChatPublicResponse(firstBody)
  assert.ok(firstAnswer)
  assert.equal(firstAnswer.runtimeGeneration, "student_first_candidate")
  assert.equal(firstAnswer.responseDepth, "short")
  const binding = { secret, actorId, conversationId, candidateSha256: studentCandidateSha256() }
  const restored = openStudentApplicationContext(firstAnswer.studentContextToken!, binding)
  assert.equal(restored?.student.semanticLedger.length, 1)
  assert.equal(providerCalls, 1)
  assert.equal(auditCalls, 1)

  const followup = await send({ question: "bunu daha basit anlat", studentContextToken: firstAnswer.studentContextToken })
  assert.equal(followup.status, 200)
  const followed = normalizeDnaChatPublicResponse(await followup.json())
  assert.ok(followed)
  const continued = openStudentApplicationContext(followed.studentContextToken!, binding)
  assert.equal(continued?.student.semanticLedger.length, 2)
  assert.deepEqual(continued?.student.activeTargetIds, restored?.student.activeTargetIds)

  // Reproduce the exact 8-topic diagnostic input at the exported POST boundary.
  // Preparing its prior semantic state is protocol setup, not an end-to-end
  // 24-answer success claim and not a replacement Frozen fixture.
  const fixture = JSON.parse(readFileSync("scripts/dna-student-fixtures/SYNTHETIC_ONE_HOUR_24.json", "utf8")) as {
    turns: Array<{ turnId: string; user: string }>
  }
  let state = emptyStudentApplicationState(null)
  for (const turn of fixture.turns.slice(0, 22)) {
    const resolved = resolveStudentEvidenceFirstRequest({ turnId: turn.turnId, message: turn.user, state: state.student })
    assert.ok(resolved.ok)
    state = { ...state, lastRoute: "student", sequence: state.sequence + 1, student: applyStudentRequestContract(state.student, resolved.contract) }
  }
  const summaryResponse = await send({ question: fixture.turns[22].user,
    studentContextToken: sealStudentApplicationContext(state, binding) })
  const summaryBody = await summaryResponse.json()
  if (summaryResponse.status !== 200) {
    const resolved = resolveStudentEvidenceFirstRequest({ turnId: "turn-23", message: fixture.turns[22].user, state: state.student })
    if (resolved.ok) {
      const diagnostic = await executeStudentAnswer({ question: fixture.turns[22].user,
        contract: { ...resolved.contract, presentation: { ...resolved.contract.presentation, depth: "standard" } } })
      console.error("mock-summary-executor-diagnostic", diagnostic.ok ? "executor_pass_public_projection_failed"
        : diagnostic.reason === "candidate_invalid" ? diagnostic.failureCodes : diagnostic.reason)
    }
  }
  assert.equal(summaryResponse.status, 200, JSON.stringify(summaryBody))
  const summary = normalizeDnaChatPublicResponse(summaryBody)
  assert.ok(summary)
  const summarized = openStudentApplicationContext(summary.studentContextToken!, binding)
  assert.equal(summarized?.student.activeTargetIds.length, 8, JSON.stringify({ generation: summary.runtimeGeneration,
    classification: summary.classification, contextRequest: summary.contextRequest, topic: summary.topic,
    summary: summary.summary, ledger: summarized?.student.semanticLedger.length }))
  assert.equal(summarized?.student.semanticLedger.length, 23)

  // Exact privacy-routing regression at the exported POST. Prior context is
  // seeded from the unchanged fixture, not regenerated or counted as answers.
  const studentFixture = JSON.parse(readFileSync("scripts/dna-student-fixtures/STUDENT40_DEVELOPMENT.json", "utf8")) as {
    conversations: Array<{ turns: Array<{ user: string }> }>
  }
  const caseTurns = studentFixture.conversations[4]!.turns
  let caseState = emptyStudentApplicationState(null)
  for (const turn of caseTurns.slice(0, 2)) {
    const resolved = resolveStudentEvidenceFirstRequest({ turnId: `turn-${caseState.sequence + 1}`,
      message: turn.user, state: caseState.student })
    assert.ok(resolved.ok)
    caseState = { ...caseState, lastRoute: "student", sequence: caseState.sequence + 1,
      student: resolveStudentObligations(applyStudentRequestContract(caseState.student, resolved.contract),
        resolved.contract.obligations.map((obligation) => obligation.id)) }
  }
  const caseToken = sealStudentApplicationContext(caseState, binding)
  const beforeCase = { providerCalls, auditCalls, reportQueries }
  const caseResponse = await send({ question: caseTurns[2]!.user, studentContextToken: caseToken })
  assert.equal(caseResponse.status, 200)
  const caseAnswer = normalizeDnaChatPublicResponse(await caseResponse.json())
  assert.ok(caseAnswer)
  assert.equal(caseAnswer.runtimeGeneration, "student_first_candidate")
  assert.equal(caseAnswer.classification, "refusal")
  assert.equal(openStudentApplicationContext(caseAnswer.studentContextToken!, binding)?.sequence, 3)
  assert.equal(providerCalls, beforeCase.providerCalls)
  assert.equal(reportQueries, beforeCase.reportQueries)
  assert.equal(auditCalls, beforeCase.auditCalls + 1)
  const deniedCase = await send({ question: "bu çocuk için interosepsiyon nedir", studentContextToken: caseToken })
  assert.equal(deniedCase.status, 503)
  assert.equal((await deniedCase.json()).error, "student_provider_privacy_boundary")
  assert.equal(providerCalls, beforeCase.providerCalls)
  assert.equal(auditCalls, beforeCase.auditCalls + 1)

  for (const turn of caseTurns.slice(2, 6)) {
    const resolved = resolveStudentEvidenceFirstRequest({ turnId: `turn-${caseState.sequence + 1}`,
      message: turn.user, state: caseState.student })
    assert.ok(resolved.ok)
    caseState = { ...caseState, lastRoute: "student", sequence: caseState.sequence + 1,
      student: resolveStudentObligations(applyStudentRequestContract(caseState.student, resolved.contract),
        resolved.contract.obligations.map((obligation) => obligation.id)) }
  }
  const refusalResponse = await send({ question: caseTurns[6]!.user,
    studentContextToken: sealStudentApplicationContext(caseState, binding) })
  assert.equal(refusalResponse.status, 200)
  const refusalBody = await refusalResponse.json()
  const refusalState = openStudentApplicationContext(refusalBody.studentContextToken, binding)
  assert.equal(refusalState?.lastRoute, "normal")
  assert.deepEqual(refusalState?.student, JSON.parse(JSON.stringify(caseState.student)))
  const beforeReturn = { providerCalls, reportQueries }
  const returnedSummary = await send({ question: caseTurns[7]!.user, studentContextToken: refusalBody.studentContextToken })
  assert.equal(returnedSummary.status, 200)
  const returnedAnswer = normalizeDnaChatPublicResponse(await returnedSummary.json())
  assert.ok(returnedAnswer)
  assert.equal(returnedAnswer.runtimeGeneration, "student_first_candidate")
  assert.equal(returnedAnswer.contextRequest, undefined)
  const returnedState = openStudentApplicationContext(returnedAnswer.studentContextToken!, binding)
  assert.equal(returnedState?.sequence, 8)
  assert.equal(returnedState?.student.semanticLedger.length, 7)
  assert.equal(returnedState?.lastRoute, "student")
  assert.equal(providerCalls, beforeReturn.providerCalls + 1)
  assert.equal(reportQueries, beforeReturn.reportQueries)

  // Exercise the exact long-conversation failure through the exported POST.
  // This boundary control seeds fixture contracts; the separate ownership test
  // authenticates the 17 immutable paid receipts. Neither is a fresh paid replay.
  let localPolicyState = emptyStudentApplicationState(null)
  for (const turn of fixture.turns.slice(0, 17)) {
    const resolved = resolveStudentEvidenceFirstRequest({ turnId: `turn-${localPolicyState.sequence + 1}`,
      message: turn.user, state: localPolicyState.student })
    assert.ok(resolved.ok)
    localPolicyState = { ...localPolicyState, lastRoute: "student", sequence: localPolicyState.sequence + 1,
      student: resolveStudentObligations(applyStudentRequestContract(localPolicyState.student, resolved.contract),
        resolved.contract.obligations.map((obligation) => obligation.id)) }
  }
  const beforeLocalPolicy = { providerCalls, reportQueries, auditCalls }
  const localPolicyResponse = await send({ question: fixture.turns[17]!.user,
    studentContextToken: sealStudentApplicationContext(localPolicyState, binding) })
  assert.equal(localPolicyResponse.status, 200, "long_conversation_case_policy_post_rejected")
  const localPolicyAnswer = normalizeDnaChatPublicResponse(await localPolicyResponse.json())
  assert.ok(localPolicyAnswer)
  assert.equal(localPolicyAnswer.runtimeGeneration, "student_first_candidate")
  assert.equal(localPolicyAnswer.contextRequest, undefined)
  const localPolicyAfter = openStudentApplicationContext(localPolicyAnswer.studentContextToken!, binding)
  assert.equal(localPolicyAfter?.sequence, 18)
  assert.equal(localPolicyAfter?.student.semanticLedger.length, 18)
  assert.deepEqual(localPolicyAfter?.student.semanticLedger.slice(0, 17), localPolicyState.student.semanticLedger)
  assert.equal(providerCalls, beforeLocalPolicy.providerCalls)
  assert.equal(reportQueries, beforeLocalPolicy.reportQueries)
  assert.equal(auditCalls, beforeLocalPolicy.auditCalls + 1)

  // Exact Frozen Mini24 third turn at the real POST boundary. Prior contracts
  // are seeded only as local protocol setup; paid receipts are authenticated by
  // the separate context-scope regression. Neither is a paid quality result.
  const miniBytes = readFileSync(".tmp/dna-chat-natural-production-20260824/deliverables/DNA_CHAT_NATURAL_PRODUCTION_20260824/02_NATURAL_MINI24/NATURAL_MINI24_FIXTURE.json")
  assert.equal(createHash("sha256").update(miniBytes).digest("hex"), "9f146c18fe4cccf2a54aa4fa4aecd038dfecff3aee81e751f2308e6ea3845adc")
  const mini = JSON.parse(miniBytes.toString()) as { conversations: Array<{ turns: Array<{ rawUserMessage: string }> }> }
  const miniTurns = mini.conversations[0]!.turns
  let miniState = emptyStudentApplicationState(null)
  for (const turn of miniTurns.slice(0, 2)) {
    const resolved = resolveStudentEvidenceFirstRequest({ turnId: `turn-${miniState.sequence + 1}`,
      message: turn.rawUserMessage, state: miniState.student })
    assert.ok(resolved.ok)
    miniState = { ...miniState, lastRoute: "student", sequence: miniState.sequence + 1,
      student: resolveStudentObligations(applyStudentRequestContract(miniState.student, resolved.contract),
        resolved.contract.obligations.map((obligation) => obligation.id)) }
  }
  const miniToken = sealStudentApplicationContext(miniState, binding)
  const beforeScope = { providerCalls, scopeProviderCalls, auditCalls, reportQueries }
  const scopedResponse = await send({ question: miniTurns[2]!.rawUserMessage, studentContextToken: miniToken })
  const scopedBody = await scopedResponse.json()
  assert.equal(scopedResponse.status, 200, JSON.stringify(scopedBody))
  const scopedAnswer = normalizeDnaChatPublicResponse(scopedBody)
  assert.ok(scopedAnswer)
  assert.equal(scopedAnswer.runtimeGeneration, "student_first_candidate")
  assert.match(JSON.stringify(scopedAnswer), /Derste bir öğrenci/u)
  assert.equal(Object.hasOwn(scopedBody, "requestInterpretation"), false)
  const scopedState = openStudentApplicationContext(scopedAnswer.studentContextToken!, binding)
  assert.equal(scopedState?.sequence, 3)
  assert.deepEqual(scopedState?.student.activeTargetIds, ["self_regulation"])
  assert.deepEqual(scopedState?.student.semanticLedger.slice(0, 2), miniState.student.semanticLedger)
  assert.equal(providerCalls, beforeScope.providerCalls + 2)
  assert.equal(scopeProviderCalls, beforeScope.scopeProviderCalls + 1)
  assert.equal(auditCalls, beforeScope.auditCalls + 1)
  assert.equal(reportQueries, beforeScope.reportQueries)
  scopeChoice = "forged_scope"
  const beforeInvalidScope = { providerCalls, auditCalls }
  const invalidScopeResponse = await send({ question: miniTurns[2]!.rawUserMessage, studentContextToken: miniToken })
  const invalidScopeBody = await invalidScopeResponse.json()
  assert.equal(invalidScopeResponse.status, 503)
  assert.equal(invalidScopeBody.error, "student_scope_resolution_failed")
  assert.equal(Object.hasOwn(invalidScopeBody, "studentContextToken"), false)
  assert.equal(providerCalls, beforeInvalidScope.providerCalls + 1)
  assert.equal(auditCalls, beforeInvalidScope.auditCalls)
  scopeChoice = "continue_context"

  // The exact T11 local safety reply used to be blocked by its privacy subtype.
  // Seed unchanged fixture contracts, preserving the real POST/auth boundary.
  let localResponseState = emptyStudentApplicationState(null)
  for (const turn of miniTurns.slice(0, 10)) {
    const resolved = resolveStudentEvidenceFirstRequest({ turnId: `turn-${localResponseState.sequence + 1}`,
      message: turn.rawUserMessage, state: localResponseState.student })
    assert.ok(resolved.ok)
    localResponseState = { ...localResponseState, lastRoute: "student", sequence: localResponseState.sequence + 1,
      student: resolveStudentObligations(applyStudentRequestContract(localResponseState.student, resolved.contract),
        resolved.contract.obligations.map((obligation) => obligation.id)) }
  }
  const beforeLocalResponse = { providerCalls, scopeProviderCalls, auditCalls, reportQueries }
  const localResponse = await send({ question: miniTurns[10]!.rawUserMessage,
    studentContextToken: sealStudentApplicationContext(localResponseState, binding) })
  const localResponseBody = await localResponse.json()
  assert.equal(localResponse.status, 200, JSON.stringify(localResponseBody))
  const localAnswer = normalizeDnaChatPublicResponse(localResponseBody)
  assert.ok(localAnswer)
  assert.equal(localAnswer.runtimeGeneration, "student_first_candidate")
  assert.equal(localAnswer.classification, "refusal")
  const localResponseAfter = openStudentApplicationContext(localAnswer.studentContextToken!, binding)
  assert.equal(localResponseAfter?.sequence, 11)
  assert.deepEqual(localResponseAfter?.student.semanticLedger.slice(0, 10), localResponseState.student.semanticLedger)
  assert.equal(providerCalls, beforeLocalResponse.providerCalls)
  assert.equal(scopeProviderCalls, beforeLocalResponse.scopeProviderCalls)
  assert.equal(auditCalls, beforeLocalResponse.auditCalls + 1)
  assert.equal(reportQueries, beforeLocalResponse.reportQueries)

  // Shared discourse units must reach the exported POST with visible boundaries.
  let discourseState = emptyStudentApplicationState(null)
  for (const turn of fixture.turns.slice(0, 11)) {
    const resolved = resolveStudentEvidenceFirstRequest({ turnId: `turn-${discourseState.sequence + 1}`,
      message: turn.user, state: discourseState.student })
    assert.ok(resolved.ok)
    discourseState = { ...discourseState, lastRoute: "student", sequence: discourseState.sequence + 1,
      student: resolveStudentObligations(applyStudentRequestContract(discourseState.student, resolved.contract),
        resolved.contract.obligations.map((obligation) => obligation.id)) }
  }
  const beforeDiscourse = { providerCalls, auditCalls, reportQueries }
  const discourseResponse = await send({ question: fixture.turns[11]!.user,
    studentContextToken: sealStudentApplicationContext(discourseState, binding) })
  const discourseBody = await discourseResponse.json()
  assert.equal(discourseResponse.status, 200, JSON.stringify(discourseBody))
  const discourseAnswer = normalizeDnaChatPublicResponse(discourseBody)
  assert.ok(discourseAnswer)
  assert.match(JSON.stringify(discourseAnswer), /adımlarını sıralar\. planlama: Planlama/u)
  assert.match(JSON.stringify(discourseAnswer), /koymada görülür\. Bu adım verilen kavramsal açıklamayı örnekler\. çalışma belleği: Çalışma belleği/u)
  const discourseAfter = openStudentApplicationContext(discourseAnswer.studentContextToken!, binding)
  assert.equal(discourseAfter?.sequence, 12)
  assert.deepEqual(discourseAfter?.student.semanticLedger.slice(0, 11), discourseState.student.semanticLedger)
  assert.equal(providerCalls, beforeDiscourse.providerCalls + 1)
  assert.equal(auditCalls, beforeDiscourse.auditCalls + 1)
  assert.equal(reportQueries, beforeDiscourse.reportQueries)

  // Counted summaries retain semantic section ownership at the actual POST.
  // Seed protocol state only; the separate test restores 22 paid receipts.
  let summaryState = emptyStudentApplicationState(null)
  for (const turn of fixture.turns.slice(0, 22)) {
    const resolved = resolveStudentEvidenceFirstRequest({ turnId: `turn-${summaryState.sequence + 1}`,
      message: turn.user, state: summaryState.student })
    assert.ok(resolved.ok)
    summaryState = { ...summaryState, lastRoute: "student", sequence: summaryState.sequence + 1,
      student: resolveStudentObligations(applyStudentRequestContract(summaryState.student, resolved.contract),
        resolved.contract.obligations.map((obligation) => obligation.id)) }
  }
  const beforeSummary = { providerCalls, auditCalls, reportQueries }
  const countedSummaryResponse = await send({ question: fixture.turns[22]!.user,
    studentContextToken: sealStudentApplicationContext(summaryState, binding) })
  assert.equal(countedSummaryResponse.status, 200)
  const summaryAnswer = normalizeDnaChatPublicResponse(await countedSummaryResponse.json())
  assert.ok(summaryAnswer?.studentVisibleAnswer)
  assert.equal(summaryAnswer.studentVisibleAnswer.split(/(?<=[.!?])\s+/u).length, 4)
  assert.match(summaryAnswer.studentVisibleAnswer, /Kesinleştiremediklerimiz: Bu açıklama tek başına kesin bir sonuç göstermez/u)
  assert.match(summaryAnswer.studentVisibleAnswer, /Gözlemde bakılacaklar: Gözlemde farklı ortam/u)
  const afterSummary = openStudentApplicationContext(summaryAnswer.studentContextToken!, binding)
  assert.equal(afterSummary?.sequence, 23)
  assert.deepEqual(afterSummary?.student.semanticLedger.slice(0, 22), summaryState.student.semanticLedger)
  assert.equal(providerCalls, beforeSummary.providerCalls + 1)
  assert.equal(auditCalls, beforeSummary.auditCalls + 1)
  assert.equal(reportQueries, beforeSummary.reportQueries)

  const relationFixtureBytes = readFileSync("scripts/dna-student-fixtures/STUDENT40_DEVELOPMENT.json")
  assert.equal(createHash("sha256").update(relationFixtureBytes).digest("hex"), "e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65")
  const relationFixture = JSON.parse(relationFixtureBytes.toString()) as {
    conversations: Array<{ conversationId: string; turns: Array<{ user: string }> }> }
  const relationTurns = relationFixture.conversations.find((row) => row.conversationId === "STUDENT40-C04")!.turns
  const relationFirst = resolveStudentEvidenceFirstRequest({ turnId: "turn-1", message: relationTurns[0]!.user,
    state: emptyStudentApplicationState(null).student })
  assert.ok(relationFirst.ok)
  const relationState = { ...emptyStudentApplicationState(null), sequence: 1, lastRoute: "student" as const,
    student: resolveStudentObligations(applyStudentRequestContract(emptyStudentApplicationState(null).student, relationFirst.contract),
      relationFirst.contract.obligations.map((obligation) => obligation.id)) }
  const beforeRelation = { providerCalls, reportQueries, auditCalls }
  relationAttack = false
  const relationResponse = await send({ question: relationTurns[1]!.user,
    studentContextToken: sealStudentApplicationContext(relationState, binding) })
  relationAttack = false
  assert.equal(relationResponse.status, 200)
  const relationAnswer = normalizeDnaChatPublicResponse(await relationResponse.json())
  assert.ok(relationAnswer?.studentVisibleAnswer)
  assert.match(relationAnswer.studentVisibleAnswer, /aynı şey değildir/u)
  const relationSourceUnit = getDnaOwnerBookTopicClaims("owner-book-section/owner-book:heading:0980:aad73ec15e", true)
    .filter((claim) => claim.nodeId === "owner-book:paragraph:0982:0f562f4e72" && claim.sentenceIndex < 2)
  assert.equal(relationSourceUnit.length, 2)
  assert.ok(relationAnswer.studentVisibleAnswer.includes(relationSourceUnit.map((claim) => claim.text).join(" ")))
  assert.doesNotMatch(relationAnswer.studentVisibleAnswer, /ilişkinin ayrıntılarını ise açıklamaz/u)
  assert.doesNotMatch(relationAnswer.studentVisibleAnswer, /yalnızca bir yönünü|kesin nedenidir/u)
  const relationAfter = openStudentApplicationContext(relationAnswer.studentContextToken!, binding)
  assert.equal(relationAfter?.sequence, 2)
  assert.deepEqual(relationAfter?.student.semanticLedger.slice(0, 1), relationState.student.semanticLedger)
  assert.equal(providerCalls, beforeRelation.providerCalls + 1)
  assert.equal(auditCalls, beforeRelation.auditCalls + 1)
  assert.equal(reportQueries, beforeRelation.reportQueries)

  let countedRelationPostControls = 0
  for (const responseDepth of ["short", "standard", "deep"]) for (const count of ["iki", "altı"]) {
    const before: { providerCalls: number; auditCalls: number; reportQueries: number } = { providerCalls, auditCalls, reportQueries }
    relationAttack = false
    const response = await send({ question: `${relationTurns[1]!.user}, ${count} cümlede anlat`, responseDepth,
      studentContextToken: sealStudentApplicationContext(relationState, binding) })
    relationAttack = false
    assert.equal(response.status, 200)
    const answer = normalizeDnaChatPublicResponse(await response.json())
    assert.ok(answer?.studentVisibleAnswer)
    assert.equal(answer.studentVisibleAnswer.split(/(?<=[.!?])\s+/u).length, count === "iki" ? 2 : 6)
    assert.doesNotMatch(answer.studentVisibleAnswer, /yalnızca bir yönünü|kesin nedenidir/u)
    assert.match(answer.studentVisibleAnswer, /aynı şey değildir/u)
    const after = openStudentApplicationContext(answer.studentContextToken!, binding)
    assert.equal(after?.sequence, 2)
    assert.deepEqual(after?.student.semanticLedger.slice(0, 1), relationState.student.semanticLedger)
    assert.equal(providerCalls, before.providerCalls + 1)
    assert.equal(auditCalls, before.auditCalls + 1)
    assert.equal(reportQueries, before.reportQueries)
    countedRelationPostControls++
  }
  relationAttack = true
  const rejectedRelation = await send({ question: relationTurns[1]!.user,
    studentContextToken: sealStudentApplicationContext(relationState, binding) })
  relationAttack = false
  assert.equal(rejectedRelation.status, 503, "free_relation_prose_cannot_bypass_closed_scope_selection")
  const rejectedRelationBody = await rejectedRelation.json()
  assert.equal(rejectedRelationBody.studentContextToken, undefined)

  const beforeGuards = providerCalls
  trusted = false
  const beforeAuth = authCalls
  assert.equal((await send({})).status, 401)
  assert.equal(authCalls, beforeAuth)
  trusted = true
  authenticated = false
  assert.equal((await send({})).status, 401)
  authenticated = true
  limited = true
  assert.equal((await send({})).status, 429)
  limited = false
  assert.equal((await send({ studentContextToken: "bad" })).status, 400)
  assert.equal((await send({ studentContextToken: firstAnswer.studentContextToken, conversationId: randomUUID() })).status, 503)
  assert.equal(providerCalls, beforeGuards)
  auditOk = false
  assert.equal((await send({})).status, 503)
  auditOk = true
  const beforeReportProvider = providerCalls
  assert.equal((await send({ question: "Bu raporu özetle", reportId: randomUUID() })).status, 404)
  assert.equal(reportQueries, 1)
  assert.equal(providerCalls, beforeReportProvider)
  Object.assign(process.env, { NODE_ENV: "production" })
  assert.equal((await send({ studentContextToken: firstAnswer.studentContextToken })).status, 503)
  assert.equal(providerCalls, beforeReportProvider)
  console.log(JSON.stringify({ ok: true, actualExportedPostExecuted: true, authRateStorageProviderDoubled: true,
    contextSummaryTargets: summarized?.student.activeTargetIds.length, contextLedger: summarized?.student.semanticLedger.length,
    requestGuardsPreserved: true, mockProviderCalls: providerCalls, externalProviderCalls: 0,
    localCasePolicyPost: true, sensitiveProviderPostDenied: true, clinicalProviderCalls: 0,
    normalRefusalToExplicitSummaryPost: true, refusalDidNotForgeStudentHistory: true,
    longConversationLocalCasePolicyPost: true, priorSeventeenContractsSeededNotRegenerated: true,
    exactMiniContextScopePost: true, invalidScopePostFailsClosed: true, scopeMockProviderCalls: scopeProviderCalls,
    exactMiniLocalResponsePost: true, priorTenMiniContractsSeededNotRegenerated: true,
    exactLongConversationDiscoursePost: true, priorElevenHourContractsSeededNotRegenerated: true,
    exactLongConversationSummaryBudgetPost: true, priorTwentyTwoHourContractsSeededNotRegenerated: true,
    exactStudent40RelationAuthorityPost: true, priorOneStudentContractSeededNotRegenerated: true, countedRelationPostControls,
    freeRelationProseRejectedWithoutNewContext: true,
    semanticQualityCertified: false, liveAuthenticatedProof: false, candidateSha256: binding.candidateSha256 }, null, 2))
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => {
  moduleLoader._load = originalLoad
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key]
  Object.assign(process.env, originalEnv)
})

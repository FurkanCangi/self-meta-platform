import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { createEmptyStudentConversationState, applyStudentRequestContract } from "../src/lib/dna/chat/studentFirst/conversationState"
import { resolveStudentEvidenceFirstRequest } from "../src/lib/dna/chat/studentFirst/evidenceFirstRequest"
import { buildStudentAnswerExecutionPlan, validateStudentAnswerExecutionPlan } from "../src/lib/dna/chat/studentFirst/answerExecution"
import { executeStudentAnswer } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"
import { rememberStudentConversationEvidence, isStudentConversationEvidence } from "../src/lib/dna/chat/studentFirst/conversationEvidence"
import { emptyStudentApplicationState, sealStudentApplicationContext, openStudentApplicationContext } from "../src/lib/dna/chat/studentFirst/applicationContext.server"
import { resolveStudentApplicationTurn } from "../src/lib/dna/chat/studentFirst/applicationTurn.server"
import { resolveCommittedDnaChatRuntime } from "../src/lib/dna/chat/v3RetrievalServer"

async function main() {
  const bytes = readFileSync("scripts/dna-student-fixtures/STUDENT40_DEVELOPMENT.json")
  assert.equal(createHash("sha256").update(bytes).digest("hex"), "e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65")
  const fixture = JSON.parse(bytes.toString()).conversations.find((c: any) => c.conversationId === "STUDENT40-C03")
  const detail = fixture.turns[5], summary = fixture.turns[7]
  // Use the unchanged development question, not a substitute for cached replay.
  // This isolated unit execution has no historical PASS or conversation claim.
  let state = createEmptyStudentConversationState()
  for (const turn of fixture.turns.slice(0, 5)) {
    const r = resolveStudentEvidenceFirstRequest({ turnId: turn.turnId, message: turn.user, state })
    assert.ok(r.ok); state = applyStudentRequestContract(state, r.contract)
  }
  const resolvedDetail = resolveStudentEvidenceFirstRequest({ turnId: detail.turnId, message: detail.user, state })
  assert.ok(resolvedDetail.ok)
  const sourcePlan = buildStudentAnswerExecutionPlan({ question: detail.user, contract: resolvedDetail.contract })
  const tapering = sourcePlan.targetEvidence.flatMap(t => t.claims).find(c => c.claimId === "owner.unit:1488:ca980fc505dd")
  assert.ok(tapering, "unchanged detail request must select the actual source")
  const refs = rememberStudentConversationEvidence([], sourcePlan, sourcePlan.targetEvidence.flatMap(t => t.claims.map(c => c.claimId)))
  assert.ok(refs.some(ref => ref.claimId === tapering.claimId))
  assert.equal(JSON.stringify(refs).includes(detail.user), false)
  assert.equal(JSON.stringify(refs).includes(tapering.text), false)
  state = applyStudentRequestContract(state, resolvedDetail.contract)
  const r = resolveStudentEvidenceFirstRequest({ turnId: summary.turnId, message: summary.user, state })
  assert.ok(r.ok)
  const without = buildStudentAnswerExecutionPlan({ question: summary.user, contract: r.contract })
  assert.equal(without.targetEvidence.some(t => t.claims.some(c => c.claimId === tapering.claimId)), false)
  const plan = buildStudentAnswerExecutionPlan({ question: summary.user, contract: r.contract, historyEvidence: refs })
  assert.ok(plan.targetEvidence.some(t => t.claims.some(c => c.claimId === tapering.claimId)))
  assert.ok(validateStudentAnswerExecutionPlan(plan, r.contract))
  const text = "Eş düzenlemede yetişkin çocuğun erişebileceği desteği sağlar ve kapasite arttıkça desteği azaltır; arousal ise genel aktivasyon durumunu anlatır."
  const compare = fixture.turns[4]
  const compareResolved = resolveStudentEvidenceFirstRequest({ turnId: compare.turnId, message: compare.user, state })
  assert.ok(compareResolved.ok)
  const comparison = await executeStudentAnswer({ question: compare.user, contract: compareResolved.contract,
    apiKey: "mock", fetchImpl: async (_url, init) => {
      const payload = JSON.parse(JSON.parse(String(init?.body)).input)
      const blocks = Object.fromEntries(payload.answerSlots.map((slot: any) => [slot.slotId,
        {
          requestFocus: slot.relationComposition.requestedFocus ?? "definition_difference",
          scopeOrder: slot.relationComposition.requestedFocus === "definition_scope" ? "first_narrower" : "not_ordered" }]))
      return Response.json({ output_text: JSON.stringify({ blocks, illustrationKind: "none" }), usage: { input_tokens: 1, output_tokens: 1 } })
    } })
  assert.ok(comparison.ok)
  const unspokenClaim = comparison.plan.targetEvidence.flatMap(target => target.claims).find(claim => claim.claimId === "owner.unit:1181:dfbcc61588c1")
  assert.ok(unspokenClaim, "input still contains the original contextual source")
  assert.equal(comparison.answer.includes("Uyanıklık"), false)
  assert.equal(comparison.candidate.usedClaimIds.includes(unspokenClaim.claimId), false, "unrendered source is not a used citation")
  const preciseRefs = rememberStudentConversationEvidence([], comparison.plan, comparison.candidate.usedClaimIds)
  assert.equal(preciseRefs.some(ref => ref.claimId === unspokenClaim.claimId), false)
  const retainedDetailRefs = rememberStudentConversationEvidence(preciseRefs, sourcePlan, sourcePlan.targetEvidence.flatMap(t => t.claims.map(c => c.claimId)))
  const preciseSummary = buildStudentAnswerExecutionPlan({ question: summary.user, contract: r.contract, historyEvidence: retainedDetailRefs })
  assert.equal(preciseSummary.targetEvidence.some(t => t.claims.some(c => c.claimId === unspokenClaim.claimId)), false)
  assert.ok(preciseSummary.targetEvidence.some(t => t.claims.some(c => c.claimId === tapering.claimId)))
  let mocks = 0
  const mockFetch: typeof fetch = async (_url, init) => {
    mocks++
    const request = JSON.parse(String(init?.body)), payload = JSON.parse(request.input)
    assert.equal(request.store, false)
    assert.ok(payload.priorAcceptedSupport.targets.some((t: any) => t.claimIds.includes(tapering.claimId)))
    const blocks = Object.fromEntries(payload.answerSlots.map((slot: any) => [slot.slotId, text]))
    return Response.json({ output_text: JSON.stringify({ blocks, illustrationKind: "none" }), usage: { input_tokens: 1, output_tokens: 1 } })
  }
  const executed = await executeStudentAnswer({ question: summary.user, contract: r.contract,
    historyEvidence: refs, apiKey: "mock", fetchImpl: mockFetch })
  assert.ok(executed.ok, JSON.stringify(executed))
  assert.ok(executed.answer.includes("kapasite arttıkça desteği azaltır"), "must not overwrite synthesis with two definitions")
  assert.equal(executed.answer.includes("Temel farkları şöyledir"), false)
  assert.deepEqual(rememberStudentConversationEvidence(refs, plan, executed.candidate.usedClaimIds), refs)
  assert.equal(plan.targetEvidence.find(t => t.studentTargetId === "arousal")?.priorAcceptedSupportClaimIds, undefined)
  const binding = { secret: "offline-synthetic-secret-32-characters-long", actorId: "synthetic-owner",
    conversationId: "synthetic-conversation", candidateSha256: "a".repeat(64), nowMs: 100 }
  const appState = { ...emptyStudentApplicationState(null), student: state, scientificEvidence: refs, sequence: 6, lastRoute: "student" as const }
  const token = sealStudentApplicationContext(appState, binding)
  assert.deepEqual(openStudentApplicationContext(token, binding)?.scientificEvidence, refs)
  assert.equal(openStudentApplicationContext(token, { ...binding, actorId: "other-owner" }), null)
  assert.equal(openStudentApplicationContext(token, { ...binding, candidateSha256: "b".repeat(64) }), null)
  assert.equal(isStudentConversationEvidence([{ ...refs[0], rawMessage: detail.user }]), false)
  assert.equal(isStudentConversationEvidence(Array(65).fill(refs[0])), false)
  assert.equal(isStudentConversationEvidence([refs[0], refs[0]]), false)
  assert.equal(isStudentConversationEvidence([{ targetId: "unknown-target", claimId: tapering.claimId }]), false)
  const catalogRequest = resolveStudentEvidenceFirstRequest({ turnId: "catalog-1", message: "interosepsiyon nedir", state: createEmptyStudentConversationState() })
  assert.ok(catalogRequest.ok)
  const catalogPlan = buildStudentAnswerExecutionPlan({ question: "interosepsiyon nedir", contract: catalogRequest.contract })
  const catalogRefs = rememberStudentConversationEvidence([], catalogPlan, catalogPlan.targetEvidence.flatMap(t => t.claims.map(c => c.claimId)))
  assert.ok(catalogRefs.some(ref => ref.targetId.startsWith("catalog:")))
  assert.ok(isStudentConversationEvidence(catalogRefs), "catalog-backed targets retain their existing identity")
  assert.throws(() => buildStudentAnswerExecutionPlan({ question: summary.user, contract: r.contract,
    historyEvidence: [{ targetId: "arousal", claimId: tapering.claimId }] }), /outside_target/)
  const mutated = structuredClone(plan)
  const priorTarget = mutated.targetEvidence.find(t => t.priorAcceptedSupportClaimIds?.length)!
  ;(priorTarget.claims[0] as { text: string }).text = "unapproved fabricated source"
  assert.equal(validateStudentAnswerExecutionPlan(mutated, r.contract), false)
  const plain = buildStudentAnswerExecutionPlan({ question: detail.user, contract: resolvedDetail.contract, historyEvidence: refs })
  assert.deepEqual(plain, sourcePlan, "non-summary plan must be unchanged")
  Object.assign(process.env, { NODE_ENV: "test", DNA_CHAT_STUDENT_LOCAL_CANDIDATE: "1", DNA_CHAT_RUNTIME_RELEASE: "v2" })
  delete process.env.VERCEL_ENV
  let audits = 0
  const application = await resolveStudentApplicationTurn({ payload: { question: summary.user }, contextToken: token, binding,
    execute: input => executeStudentAnswer({ ...input, apiKey: "mock", fetchImpl: mockFetch }),
    normal: { createRequestId: () => "offline-summary-test", resolveRuntimeAnswer: input => resolveCommittedDnaChatRuntime(input),
      loadCaseAnswer: async () => { throw new Error("report_access_forbidden") }, writeAudit: async () => { audits++; return { ok: true } } } })
  assert.equal(application.status, 200, JSON.stringify(application.body))
  assert.ok(String(application.body.summary).includes("kapasite arttıkça desteği azaltır"))
  assert.equal(audits, 1)
  // Capacity/round-trip check over the unchanged 24-request fixture. This uses
  // plans as mock accepted support, not real provider answers or a replay PASS.
  const hourBytes = readFileSync("scripts/dna-student-fixtures/SYNTHETIC_ONE_HOUR_24.json")
  assert.equal(createHash("sha256").update(hourBytes).digest("hex"), "8c8916240a237c526757b19e0db9047f3a8394b4be389b40868174704a60deb1")
  let capacityState = emptyStudentApplicationState(null), maxTokenLength = 0
  for (const turn of JSON.parse(hourBytes.toString()).turns) {
    const resolved = resolveStudentEvidenceFirstRequest({ turnId: turn.turnId, message: turn.user, state: capacityState.student })
    assert.ok(resolved.ok)
    const boundPlan = buildStudentAnswerExecutionPlan({ question: turn.user, contract: resolved.contract,
      historyEvidence: capacityState.scientificEvidence })
    capacityState = { ...capacityState, sequence: capacityState.sequence + 1,
      student: applyStudentRequestContract(capacityState.student, resolved.contract),
      scientificEvidence: rememberStudentConversationEvidence(capacityState.scientificEvidence ?? [], boundPlan,
        boundPlan.targetEvidence.flatMap(t => t.claims.map(c => c.claimId))) }
    const encoded = sealStudentApplicationContext(capacityState, binding)
    maxTokenLength = Math.max(maxTokenLength, encoded.length)
    assert.deepEqual(openStudentApplicationContext(encoded, binding), JSON.parse(JSON.stringify(capacityState)))
    assert.ok(capacityState.scientificEvidence!.length <= 64)
    assert.equal(JSON.stringify(capacityState).includes(turn.user), false)
  }
  assert.ok(maxTokenLength < 6000)
  console.log(JSON.stringify({ ok: true, preservedSourceClaim: tapering.claimId, originalFixtureUnchanged: true,
    sourceToPlanToProviderToVisibleHandoff: "PASS_WITH_MOCK_TRANSPORT", sourceForgeryAndScopeControls: "PASS",
    tokenLength: token.length, capacityFixtureTurns: 24, maxTokenLength, mocks, externalCalls: 0, cachedReplaySubstitute: false, semanticQualityCertified: false }))
}
void main().catch(error => { console.error(error); process.exitCode = 1 })

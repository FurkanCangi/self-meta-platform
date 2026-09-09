import assert from "node:assert/strict"
import { assertComparisonOnlyContractMigration } from "./dna-b1-contract-migration-assertion"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import dotenv from "dotenv"
import { configuredStudentReplaySession, type StudentReplayTurn } from "./dna-student-application-replay"
import { studentCandidateSha256 } from "./dna-student-candidate-identity"
import { replayPublicAnswerBody } from "./dna-replay-public-api"
import { executeStudentAnswer, validateStudentAnswerCandidate } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"
import { createEmptyStudentConversationState, resolveStudentEvidenceFirstRequest } from "../src/lib/dna/chat/studentFirst"
import { resolveStudentApplicationTurn } from "../src/lib/dna/chat/studentFirst/applicationTurn.server"
import { openStudentApplicationContext, sealStudentApplicationContext } from "../src/lib/dna/chat/studentFirst/applicationContext.server"
import { normalizeDnaChatPublicResponse } from "../src/lib/dna/chat/publicResponseNormalizer"
import { resolveCommittedDnaChatRuntime } from "../src/lib/dna/chat/v3RetrievalServer"

dotenv.config({ path: ".env.local", quiet: true })
const oldCandidate = "84d70fff198bfe5150753e48e6d7528df8c9ebccc96001949b5e639c7324afd4"
const oldReplay = "a959034806156cc24ffe19d4386fd0b5b7da68420228e426a29002077d345baf"
const journalPath = `/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-student-application-replay/${oldCandidate}/${oldReplay}/student40.jsonl`
const journalSha256 = "50351caffcd49f69ec451bd7cfadec5af3e0ca9bba2fb36d0811d22eaf3894b0"
const hash = (value: Buffer | string) => createHash("sha256").update(value).digest("hex")
type Slot = { slotId: string; obligations: Array<{ id: string; kind: string }>;
  sentenceComposition?: { sentenceUnits: number; roleOwned: boolean };
  relationComposition?: { orderedDefinitionSources: Array<{ targetId: string; definitionText: string }> };
  relationSupport?: { selectedClaimIds: string[]; crossTargetClaimIds: string[]; synthesisScope: string };
  activeTargets: Array<{ targetId: string; visibleAliases: string[]; lockedClaims: Array<{ claimId: string; text: string }> }> }
let mockCalls = 0
let externalCalls = 0
let audits = 0
let captured: Slot[] = []
let transportAssertion: unknown = null
let badProviderText = ""
let rawRelationAttack = false
const mockFetch: typeof fetch = async (_url, init) => {
  mockCalls++
  try {
    const request = JSON.parse(String(init?.body))
    captured = JSON.parse(request.input).answerSlots as Slot[]
    for (const slot of captured.filter((slot) => slot.relationSupport)) {
      assert.match(request.instructions, /ana operation etiketinden bağımsız/u)
      assert.equal(slot.relationSupport!.synthesisScope, "distinct_definitions_and_explicit_source_links_only")
      assert.deepEqual([...new Set(slot.activeTargets.flatMap((target) => target.lockedClaims.map((claim) => claim.claimId)))].sort(),
        [...slot.relationSupport!.selectedClaimIds].sort(), "provider_and_declared_source_scope_must_match")
    }
    return Response.json({ id: `mock-relation-authority-${mockCalls}`, output_text: JSON.stringify({
      blocks: Object.fromEntries(captured.map((slot) => [slot.slotId, slot.relationComposition && !rawRelationAttack
        ? { definitionPremises: Object.fromEntries(slot.relationComposition.orderedDefinitionSources.map((source) => [source.targetId, source.definitionText])), requestFocus: "definition_difference", scopeOrder: "not_ordered" } : (slot.sentenceComposition?.sentenceUnits ?? 1) > 1
        ? Array.from({ length: slot.sentenceComposition!.sentenceUnits }, () => badProviderText) : badProviderText])), illustrationKind: "none" }),
      usage: { input_tokens: 100, output_tokens: 50 } })
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
  const conversation = fixture.conversations.find((row) => row.conversationId === "STUDENT40-C04")!
  const rows = bytes.toString().trim().split("\n").map((line) => JSON.parse(line)) as Array<{
    key: string; stage: string; value: StudentReplayTurn; valueSha256: string }>
  const session = configuredStudentReplaySession({ candidateSha256: oldCandidate, replaySha256: oldReplay, sessionId: conversation.conversationId })
  const prior = rows.find((row) => row.key === conversation.turns[0]!.turnId && row.stage === "completed")!
  assert.equal(hash(JSON.stringify(prior.value)), prior.valueSha256)
  session.restore({ question: conversation.turns[0]!.user }, prior.value)
  const state = session.state()!
  const beforeStateHash = hash(JSON.stringify(state))
  const failed = rows.find((row) => row.key === conversation.turns[1]!.turnId && row.stage === "completed")!
  assert.equal(hash(JSON.stringify(failed.value)), failed.valueSha256)
  const oldResult = failed.value.student!.result
  assert.ok(oldResult.ok)
  const visible = oldResult.candidate.blocks[0]!.text
  // Reconstruct visible slot text, not the unretained original provider JSON.
  badProviderText = visible.slice(visible.indexOf(":") + 1).trim()
  const question = conversation.turns[1]!.user
  const resolved = resolveStudentEvidenceFirstRequest({ turnId: "turn-2", message: question, state: state.student })
  assert.ok(resolved.ok)
  assert.equal(failed.value.student!.contract.version, "dna-student-request-contract@28")
  assert.equal(resolved.contract.version, "dna-student-request-contract@29")
  assertComparisonOnlyContractMigration(resolved.contract, failed.value.student!.contract)
  const binding = { secret: "synthetic-relation-authority-test-secret", actorId: "synthetic-relation-owner",
    conversationId: "11111111-1111-4111-8111-111111111111", candidateSha256: studentCandidateSha256(), nowMs: 1_002_000 }
  const token = sealStudentApplicationContext(state, binding)
  let exactVisible = ""
  let depthSupportedLinks = 0
  for (const responseDepth of ["short", "standard", "deep"] as const) {
    let executedSourceClaimIds: string[] = []
    const r = await resolveStudentApplicationTurn({ payload: { question, responseDepth }, binding, contextToken: token,
      execute: async (input) => {
        const result = await executeStudentAnswer({ ...input, apiKey: "synthetic-not-real", fetchImpl: mockFetch })
        executedSourceClaimIds = result.plan.targetEvidence.flatMap((target) => target.claims
          .filter((claim) => claim.role !== "contrast").map((claim) => claim.claimId))
        return result
      },
      normal: { createRequestId: () => "relation-authority", resolveRuntimeAnswer: resolveCommittedDnaChatRuntime,
        loadCaseAnswer: async () => { throw new Error("unrequested_report_load") },
        writeAudit: async () => { audits++; return { ok: true } } } })
    if (transportAssertion) throw transportAssertion
    assert.equal(r.status, 200)
    const pub = normalizeDnaChatPublicResponse(r.body)
    assert.ok(pub)
    const answer = replayPublicAnswerBody(pub)
    assert.match(answer, /aynı şey değildir/u)
    assert.doesNotMatch(answer, /yalnızca bir yönünü etkileyebilir/u)
    if (captured[0]!.relationSupport!.crossTargetClaimIds.length) {
      assert.match(answer, /Bağlantıları şöyle:/u)
      assert.match(answer, /fizyolojik arousal düzeyini/u)
      depthSupportedLinks++
    } else {
      assert.doesNotMatch(answer, /ilişkinin ayrıntılarını ise açıklamaz/u, "comparison alone does not request a relation explanation")
    }
    assert.deepEqual(captured[0]!.relationSupport!.selectedClaimIds, executedSourceClaimIds,
      "preserve_full_non_contrast_source_unit_for_actual_requested_depth")
    const after = openStudentApplicationContext(pub.studentContextToken!, binding)
    assert.equal(after?.sequence, 2)
    assert.deepEqual(after?.student.semanticLedger.slice(0, 1), state.student.semanticLedger)
    exactVisible = answer
  }
  let modeControls = 0
  for (const semanticTask of ["compare", "relate"] as const) for (const format of ["prose", "bullets"] as const)
    for (const depth of ["brief", "standard", "deep"] as const) for (const requestedSentenceCount of [null, 1, 2, 3, 4, 5, 6] as const) {
    const contract = { ...resolved.contract, semanticTask,
      // Relation-mode controls retain the original explicit relation duty.
      // Relabeling a comparison-only contract is not a new relation request.
      ...(semanticTask === "relate" ? { requestedSemanticTasks: ["compare", "relate"] as const,
        obligations: failed.value.student!.contract.obligations } : {}),
      presentation: { ...resolved.contract.presentation, format, depth, requestedSentenceCount } }
    const r = await executeStudentAnswer({ question, contract, apiKey: "synthetic-not-real", fetchImpl: mockFetch })
    if (transportAssertion) throw transportAssertion
    assert.ok(r.ok, JSON.stringify({ semanticTask, format, depth, requestedSentenceCount, result: r.ok ? null : r }))
    assert.doesNotMatch(r.answer, /yalnızca bir yönünü etkileyebilir/u)
    const supplied = [...new Set(captured.flatMap((slot) => slot.activeTargets.flatMap((target) => target.lockedClaims.map((claim) => claim.claimId))))]
    // Supplied context is a superset, not a claim that every source was rendered.
    // Exact deterministic projection ownership must preserve each definition and
    // exclude claims it did not use (covered by summary-history regression).
    assert.ok(r.candidate.usedClaimIds.every(id => supplied.includes(id)))
    for (const target of r.plan.targetEvidence) {
      const definition = target.claims.find(claim => claim.role !== "contrast")
      assert.ok(definition && r.candidate.usedClaimIds.includes(definition.claimId),
        "rendered_target_definition_must_keep_its_source")
    }
    assert.equal(validateStudentAnswerCandidate({ candidate: r.candidate, plan: r.plan }).length, 0)
    assert.ok(captured.every((slot) => slot.obligations.length > 0 && slot.relationSupport), "no_unowned_relation_unit")
    assert.ok(r.candidate.blocks.every((block) => block.obligationIds.length > 0))
    if (requestedSentenceCount !== null) {
      assert.equal(r.answer.split(/(?<=[.!?])\s+/u).length, requestedSentenceCount)
      if (format === "bullets") assert.equal(r.answer.split("\n").filter((line) => line.startsWith("- ")).length, requestedSentenceCount)
      const sentences = r.answer.split(/(?<=[.!?])\s+/u)
      assert.equal(new Set(sentences).size, sentences.length, "no_duplicate_padding")
    }
    modeControls++
  }
  let supportedLinks = 0
  rawRelationAttack = true
  const rejected = await executeStudentAnswer({ question, contract: resolved.contract,
    apiKey: "synthetic-not-real", fetchImpl: mockFetch })
  assert.equal(rejected.ok, false, "original_cached_unsupported_prose_is_not_a_closed_comparison_selection")
  assert.equal(rejected.provider.calls, 1, "no_regeneration_after_malformed_relation_selection")
  rawRelationAttack = false
  for (const message of ["planlama ile çalışma belleği arasındaki fark ve ilişki ne", "yürütücü işlev ile öz kontrol arasındaki fark ve ilişki ne"]) {
    const resolution = resolveStudentEvidenceFirstRequest({ turnId: "supported-link", message, state: createEmptyStudentConversationState() })
    assert.ok(resolution.ok)
    const r = await executeStudentAnswer({ question: message, contract: resolution.contract,
      apiKey: "synthetic-not-real", fetchImpl: mockFetch })
    if (transportAssertion) throw transportAssertion
    assert.ok(r.ok)
    const links = captured.flatMap((slot) => slot.relationSupport?.crossTargetClaimIds ?? [])
    assert.ok(links.length, "supported_link_must_not_be_replaced_by_global_absence_claim")
    for (const claim of r.plan.targetEvidence.flatMap((target) => target.claims).filter((claim) => links.includes(claim.claimId))) {
      assert.ok(r.candidate.usedClaimIds.includes(claim.claimId))
      const visibleSource = claim.text.replace(/\s*\([^)]*\d{4}[^)]*\)\s*/gu, " ").trim()
      assert.ok(r.answer.includes(visibleSource), "supported_relation_clause_must_remain_visible_not_just_credited")
    }
    assert.match(r.answer, r.plan.obligations.some(o => o.kind === "distinguish_targets")
      ? /Bağlantıları şöyle:/u : /aynı açıklama içinde bağlayan nokta/u)
    assert.doesNotMatch(r.answer, /arasında doğrudan bir etki yönü veya mekanizma kurmuyor/u)
    supportedLinks++
  }
  const noRelationQuestion = "arousal nedir"
  const noRelation = resolveStudentEvidenceFirstRequest({ turnId: "no-relation", message: noRelationQuestion, state: createEmptyStudentConversationState() })
  assert.ok(noRelation.ok)
  await executeStudentAnswer({ question: noRelationQuestion, contract: noRelation.contract,
    apiKey: "synthetic-not-real", fetchImpl: mockFetch })
  assert.ok(captured.every((slot) => !slot.relationSupport), "no_unrequested_relation_scope")
  assert.equal(hash(JSON.stringify(state)), beforeStateHash)
  assert.equal(hash(readFileSync(journalPath)), journalSha256)
  assert.equal(externalCalls, 0)
  console.log(JSON.stringify({ ok: true, gate: "STUDENT_OBLIGATION_SCOPED_RELATION_AUTHORITY", candidateSha256: binding.candidateSha256,
    authenticatedPriorReceipts: 1, exactFailedContract: true, depthControls: 3, depthSupportedLinks, modeControls, supportedLinks,
    noUnrequestedRelationScope: true, providerAndDeclaredSourceScopeMatched: true, cachedUnsupportedBridgeNotRendered: true,
    cachedUnsupportedProseExplicitlyRejected: true,
    previousStateUnchanged: true, journalUnchanged: true, mockCalls, audits, externalProviderCalls: externalCalls,
    exactVisible, reconstructedVisibleNotOriginalProviderJson: true, semanticQualityCertified: false, liveAuthenticatedProof: false }, null, 2))
}
main().catch((error) => { console.error(error); process.exitCode = 1 })

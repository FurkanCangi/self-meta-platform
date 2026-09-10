import assert from "node:assert/strict"
import { assertRequestedRelationContractMigration } from "./dna-b1-contract-migration-assertion"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import dotenv from "dotenv"
import { configuredStudentReplaySession, type StudentReplayTurn } from "./dna-student-application-replay"
import { studentCandidateSha256 } from "./dna-student-candidate-identity"
import { replayPublicAnswerBody } from "./dna-replay-public-api"
import { executeStudentAnswer, validateStudentAnswerCandidate } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"
import { resolveStudentEvidenceFirstRequest } from "../src/lib/dna/chat/studentFirst"
import { resolveStudentApplicationTurn } from "../src/lib/dna/chat/studentFirst/applicationTurn.server"
import { openStudentApplicationContext, sealStudentApplicationContext } from "../src/lib/dna/chat/studentFirst/applicationContext.server"
import { normalizeDnaChatPublicResponse } from "../src/lib/dna/chat/publicResponseNormalizer"
import { resolveCommittedDnaChatRuntime } from "../src/lib/dna/chat/v3RetrievalServer"

dotenv.config({ path: ".env.local", quiet: true })
const oldCandidate = "a54a2efe8e60f00ae3978dbf4b655d54d21a0851773df6b901a404613b3244eb"
const oldReplay = "a959034806156cc24ffe19d4386fd0b5b7da68420228e426a29002077d345baf"
const journalPath = `/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-student-application-replay/${oldCandidate}/${oldReplay}/student40.jsonl`
const journalSha256 = "ceeffcc7286eee692fc0791e536494f9dd1e6df58b1be72470d7a3d1d46b216b"
const hash = (value: Buffer | string) => createHash("sha256").update(value).digest("hex")
type Slot = { slotId: string; obligations: Array<{ id: string }>;
  relationComposition: { representation: string; orderedDefinitionSources: Array<{ targetId: string; claimId: string; definitionText: string }> };
  relationSupport: { selectedClaimIds: string[]; crossTargetClaimIds: string[] };
  activeTargets: Array<{ targetId: string; lockedClaims: Array<{ claimId: string; text: string }> }> }
let captured: Slot[] = []
let mockCalls = 0
let externalCalls = 0
let audits = 0
let focus = "definition_scope"
let override: { value: unknown } | null = null
let premiseMutation: ((premises: Record<string, string>) => unknown) | null = null
let transportAssertion: unknown = null
const mockFetch: typeof fetch = async (_url, init) => {
  mockCalls++
  try {
    const request = JSON.parse(String(init?.body))
    captured = JSON.parse(request.input).answerSlots
    assert.match(request.instructions, /kesin alt-küme/u)
    const blocks = Object.fromEntries(captured.map((slot) => {
      assert.equal(slot.relationComposition.representation, "source_premise_then_scope_selection")
      const schema = request.text.format.schema.properties.blocks.properties[slot.slotId]
      assert.equal(schema.type, "object")
      assert.deepEqual(schema.required, ["requestFocus", "scopeOrder"])
      assert.equal(Object.hasOwn(schema.properties, "definitionPremises"), false)
      for (const branch of schema.anyOf) {
        assert.deepEqual(branch.required, ["requestFocus", "scopeOrder"])
        assert.equal(Object.hasOwn(branch.properties, "definitionPremises"), false)
      }
      assert.equal(schema.additionalProperties, false)
      assert.ok(slot.obligations.length > 0)
      for (const source of slot.relationComposition.orderedDefinitionSources) {
        const target = slot.activeTargets.find((target) => target.targetId === source.targetId)!
        assert.equal(source.claimId, target.lockedClaims[0]!.claimId)
      }
      const premises = Object.fromEntries(slot.relationComposition.orderedDefinitionSources.map((source) => [source.targetId, source.definitionText]))
      return [slot.slotId, override ? override.value : {
        ...(premiseMutation ? { definitionPremises: premiseMutation(premises) } : {}), requestFocus: focus,
        scopeOrder: focus === "definition_scope"
          ? slot.relationComposition.orderedDefinitionSources[0]!.targetId === "self_control" ? "first_narrower" : "second_narrower"
          : "not_ordered" }]
    }))
    return Response.json({ id: `mock-definition-scope-${mockCalls}`, output_text: JSON.stringify({ blocks, illustrationKind: "none" }),
      usage: { input_tokens: 100, output_tokens: 30 } })
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
  const conversation = fixture.conversations[0]!
  const rows = bytes.toString().trim().split("\n").map((line) => JSON.parse(line)) as Array<{
    key: string; stage: string; value: StudentReplayTurn; valueSha256: string }>
  const session = configuredStudentReplaySession({ candidateSha256: oldCandidate, replaySha256: oldReplay, sessionId: conversation.conversationId })
  const prior = rows.find((row) => row.key === conversation.turns[0]!.turnId && row.stage === "completed")!
  assert.equal(hash(JSON.stringify(prior.value)), prior.valueSha256)
  session.restore({ question: conversation.turns[0]!.user }, prior.value)
  const state = session.state()!
  const beforeState = hash(JSON.stringify(state))
  const failed = rows.find((row) => row.key === conversation.turns[1]!.turnId && row.stage === "completed")!
  assert.equal(hash(JSON.stringify(failed.value)), failed.valueSha256)
  const question = conversation.turns[1]!.user
  const resolved = resolveStudentEvidenceFirstRequest({ turnId: "turn-2", message: question, state: state.student })
  assert.ok(resolved.ok)
  assert.equal(failed.value.student!.contract.version, "dna-student-request-contract@28")
  assert.equal(resolved.contract.version, "dna-student-request-contract@29")
  assertRequestedRelationContractMigration(resolved.contract, failed.value.student!.contract)
  const binding = { secret: "synthetic-definition-scope-test-secret", actorId: "synthetic-scope-owner",
    conversationId: "11111111-1111-4111-8111-111111111111", candidateSha256: studentCandidateSha256(), nowMs: 1_002_000 }
  const token = sealStudentApplicationContext(state, binding)
  let sample = ""
  for (const responseDepth of ["short", "standard", "deep"] as const) {
    const r = await resolveStudentApplicationTurn({ payload: { question, responseDepth }, binding, contextToken: token,
      execute: (input) => executeStudentAnswer({ ...input, apiKey: "synthetic-not-real", fetchImpl: mockFetch }),
      normal: { createRequestId: () => "definition-scope", resolveRuntimeAnswer: resolveCommittedDnaChatRuntime,
        loadCaseAnswer: async () => { throw new Error("unrequested_report_load") },
        writeAudit: async () => { audits++; return { ok: true } } } })
    if (transportAssertion) throw transportAssertion
    assert.equal(r.status, 200)
    const pub = normalizeDnaChatPublicResponse(r.body)
    assert.ok(pub)
    sample = replayPublicAnswerBody(pub)
    assert.match(sample, /öz-kontrol daha dar bir alanı, öz düzenleme ise daha geniş bir çerçeveyi/u)
    assert.doesNotMatch(sample, /ilişkinin ayrıntılarını ise açıklamaz|bir parçası|alt küme|kesin nedeni/u)
    const after = openStudentApplicationContext(pub.studentContextToken!, binding)
    assert.equal(after?.sequence, 2)
    assert.deepEqual(after?.student.semanticLedger.slice(0, 1), state.student.semanticLedger)
  }
  let presentationControls = 0
  for (const reverse of [false, true]) for (const format of ["prose", "bullets"] as const)
    for (const requestedSentenceCount of [null, 1, 2, 3, 4, 5, 6]) {
    const contract = { ...resolved.contract,
      targetIds: reverse ? [...resolved.contract.targetIds].reverse() : resolved.contract.targetIds,
      comparisonTargetIds: reverse ? [...resolved.contract.comparisonTargetIds].reverse() : resolved.contract.comparisonTargetIds,
      presentation: { ...resolved.contract.presentation, format, requestedSentenceCount } }
    const r = await executeStudentAnswer({ question, contract, apiKey: "synthetic-not-real", fetchImpl: mockFetch })
    if (transportAssertion) throw transportAssertion
    assert.ok(r.ok)
    assert.match(r.answer, /öz-kontrol daha dar bir alanı, öz düzenleme ise daha geniş bir çerçeveyi/u)
    const decision = r.candidate.compositionDecisions![0]!
    assert.equal(decision.requestFocus, "definition_scope")
    assert.equal(decision.scopeOrder, reverse ? "second_narrower" : "first_narrower")
    assert.deepEqual(Object.keys(decision).sort(), ["definitionPremises", "providerScopeOrder", "requestFocus", "scopeAuthority", "scopeOrder", "slotId"])
    assert.ok(Object.isFrozen(decision))
    for (const premise of decision.definitionPremises) {
      const source = captured[0]!.relationComposition.orderedDefinitionSources.find((s) => s.targetId === premise.targetId)!
      assert.equal(premise.claimId, source.claimId)
      assert.equal(source.definitionText.slice(premise.excerptStart, premise.excerptEnd), source.definitionText)
      assert.deepEqual(Object.keys(premise).sort(), ["claimId", "excerptEnd", "excerptStart", "targetId"])
      assert.ok(Object.isFrozen(premise))
    }
    assert.ok(!JSON.stringify(decision).includes(question))
    assert.equal(validateStudentAnswerCandidate({ candidate: r.candidate, plan: r.plan }).length, 0)
    if (requestedSentenceCount !== null) {
      assert.equal(r.answer.split(/(?<=[.!?])\s+/u).length, requestedSentenceCount)
      if (format === "bullets") assert.equal(r.answer.split("\n").length, requestedSentenceCount)
    }
    presentationControls++
  }
  let focusControls = 0
  for (const requestedFocus of ["definition_difference", "source_connection"]) {
    focus = requestedFocus
    const r = await executeStudentAnswer({ question, contract: resolved.contract, apiKey: "synthetic-not-real", fetchImpl: mockFetch })
    assert.equal(r.ok, false, "explicit_scope_request_cannot_be_downgraded_to_other_focus")
    assert.equal(r.provider.calls, 1, "no_reroll_for_a_request_ignoring_choice")
    focusControls++
  }
  let malformedRejected = 0
  for (const value of ["Öz kontrol öz düzenlemenin kesin nedenidir", [], {},
    { requestFocus: "definition_scope" }, { scopeOrder: "first_narrower" },
    { requestFocus: "causal", scopeOrder: "not_ordered" },
    { requestFocus: "definition_scope", scopeOrder: "causes_second" },
    { requestFocus: "definition_difference", scopeOrder: "first_narrower" },
    { requestFocus: "source_connection", scopeOrder: "first_narrower" },
    { requestFocus: "source_connection", scopeOrder: "second_narrower" },
    { requestFocus: "definition_scope", scopeOrder: "first_narrower", text: "Kesin alt kümesidir" },
    { requestFocus: "definition_scope", scopeOrder: "first_narrower", sourceIds: ["unrelated-source"] },
    { requestFocus: "definition_scope", scopeOrder: "first_narrower", excerptStart: 5, excerptEnd: 45 }]) {
    override = { value }
    const r = await executeStudentAnswer({ question, contract: resolved.contract, apiKey: "synthetic-not-real", fetchImpl: mockFetch })
    assert.equal(r.ok, false)
    assert.equal(r.provider.calls, 1)
    malformedRejected++
  }
  override = null
  focus = "definition_scope"
  let invalidSourcePremisesRejected = 0
  for (const mutate of [
    (p: Record<string, string>) => p,
    () => null,
    () => [],
    () => ({}),
    (p: Record<string, string>) => ({ ...p, unrelated_target: "Kaynakta bulunmayan bir ifade" }),
    (p: Record<string, string>) => ({ ...p, [Object.keys(p)[0]!]: "Kaynakta bulunmayan bir ifade" }),
    (p: Record<string, string>) => ({ ...p, [Object.keys(p)[0]!]: Object.values(p)[1]! }),
    (p: Record<string, string>) => ({ ...p, [Object.keys(p)[0]!]: "kısa" }),
    (p: Record<string, string>) => ({ ...p, [Object.keys(p)[0]!]: "x".repeat(1_001) }),
  ]) {
    premiseMutation = mutate
    const r = await executeStudentAnswer({ question, contract: resolved.contract, apiKey: "synthetic-not-real", fetchImpl: mockFetch })
    if (transportAssertion) throw transportAssertion
    assert.equal(r.ok, false)
    assert.equal(r.provider.calls, 1)
    invalidSourcePremisesRejected++
  }
  premiseMutation = (p) => Object.fromEntries(Object.entries(p).map(([id, text]) => [id, text.slice(10, 50)]))
  const excerptResult = await executeStudentAnswer({ question, contract: resolved.contract, apiKey: "synthetic-not-real", fetchImpl: mockFetch })
  assert.equal(excerptResult.ok, false, "provider_may_not_choose_even_a_verbatim_substring")
  invalidSourcePremisesRejected++
  premiseMutation = null
  override = { value: { requestFocus: "definition_scope", scopeOrder: "first_narrower" } }
  const canonicalPremises = await executeStudentAnswer({ question, contract: resolved.contract, apiKey: "synthetic-not-real", fetchImpl: mockFetch })
  assert.ok(canonicalPremises.ok, "source_binding_does_not_depend_on_provider_transcription")
  assert.equal(canonicalPremises.provider.calls, 1)
  for (const premise of canonicalPremises.candidate.compositionDecisions![0]!.definitionPremises) {
    const source = captured[0]!.relationComposition.orderedDefinitionSources.find(s => s.targetId === premise.targetId)!
    assert.equal(premise.claimId, source.claimId)
    assert.equal(premise.excerptStart, 0)
    assert.equal(premise.excerptEnd, source.definitionText.length)
  }
  assert.equal(hash(JSON.stringify(state)), beforeState)
  assert.equal(hash(readFileSync(journalPath)), journalSha256)
  assert.equal(externalCalls, 0)
  console.log(JSON.stringify({ ok: true, gate: "STUDENT_DEFINITION_SCOPE_COMPOSITION", testVersion: "server-owned-premise-wire@2", candidateSha256: binding.candidateSha256,
    authenticatedPriorReceipts: 1, exactFailedContract: true, applicationDepths: 3, presentationControls, focusControls, malformedRejected,
    stateAndJournalUnchanged: true, invalidSourcePremisesRejected, sourceOffsetsRetainedWithoutRawText: true,
    canonicalPremisesServerOwned: true, sourceProseAndOffsetsAbsentFromProviderSchema: true,
    mockCalls, audits, externalProviderCalls: externalCalls, sample,
    interpretationSelectionMockedNotSemanticallyVerified: true, semanticQualityCertified: false, liveAuthenticatedProof: false }, null, 2))
}
main().catch((error) => { console.error(error); process.exitCode = 1 })

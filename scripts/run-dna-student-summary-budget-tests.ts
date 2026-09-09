import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import dotenv from "dotenv"
import { configuredStudentReplaySession, type StudentReplayTurn } from "./dna-student-application-replay"
import { studentCandidateSha256 } from "./dna-student-candidate-identity"
import { executeStudentAnswer, validateStudentAnswerCandidate } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"
import { resolveStudentEvidenceFirstRequest } from "../src/lib/dna/chat/studentFirst/evidenceFirstRequest"
import { createEmptyStudentConversationState } from "../src/lib/dna/chat/studentFirst/conversationState"
import type { StudentRequestContract } from "../src/lib/dna/chat/studentFirst/contracts"

dotenv.config({ path: ".env.local", quiet: true })
const oldCandidate = "6bb5df5b079557076e6a0660b1f362e6c65b5b33379d11e64ceea4fc6f37fadd"
const oldReplay = "b4c9915eaa8c3a9b0345263adeb89eb5b123661219aaa5b11fa98c3e06701d89"
const journalPath = `/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-student-application-replay/${oldCandidate}/${oldReplay}/one-hour24.jsonl`
const journalSha256 = "c4249f96343355e0df914aef815d81426275a446d7f24f4fbad615947de079ee"
const hash = (value: Buffer | string) => createHash("sha256").update(value).digest("hex")
type Slot = { slotId: string; obligations: Array<{ id: string; kind: string }>;
  summaryComposition?: { sentenceUnits: number; representation: string; roleOwned: boolean };
  sentenceComposition?: { sentenceUnits: number; representation: string; roleOwned: boolean };
  activeTargets: Array<{ targetId: string; visibleAliases: string[]; lockedClaims: Array<{ text: string }> }> }
let mockCalls = 0
let externalCalls = 0
let slots: Slot[] = []
let malformed = false
let capturedAssertion: unknown = null
let lastValue: Record<string, unknown> = {}
const fetchImpl: typeof fetch = async (_url, init) => {
  mockCalls++
  try {
    const request = JSON.parse(String(init?.body))
    const content = JSON.parse(request.input) as { operation: string; answerSlots: Slot[] }
    slots = content.answerSlots
    if (content.operation === "summarize" && slots[0]?.summaryComposition) {
      assert.match(request.instructions, /bölümün obligations görevlerini/u)
      assert.ok(slots.every((slot) => slot.obligations.length > 0), "no_unowned_provider_slot")
    }
    lastValue = Object.fromEntries(slots.map((slot) => {
      const kinds = slot.obligations.map((row) => row.kind)
      const n = slot.summaryComposition?.sentenceUnits ?? slot.sentenceComposition?.sentenceUnits ?? 1
      const schema = request.text.format.schema.properties.blocks.properties[slot.slotId]
      if (n > 1) {
        assert.equal(schema.type, "array")
        assert.equal(schema.minItems, n)
        assert.equal(schema.maxItems, n)
      }
      const parts = Array.from({ length: n }, () => [] as string[])
      if (kinds.includes("summarize_known") || content.operation !== "summarize") {
        for (const [i, target] of slot.activeTargets.entries()) {
          parts[i % n]!.push(`${target.visibleAliases[0]}: ${target.lockedClaims[0]!.text}`)
        }
      } else if (kinds.includes("summarize_unknown")) parts[0]!.push("Bu kavramlar tek başına kişinin nedeni, tanısı veya kapasitesi hakkında kesin sonuç göstermez")
      else if (kinds.includes("summarize_observation_focus")) parts[0]!.push("Gözlemde etkinliğe başlama, dikkati sürdürme ve görev sonrasında toparlanma izlenebilir")
      // Structural mock only: sparse-target multi-sentence controls can reuse
      // a supplied claim. This is never a real-language or quality certificate.
      const text = parts.map((part) => (part.length ? part : parts[0]!).join("; "))
      return [slot.slotId, n > 1 ? malformed ? text.slice(1) : text : text[0]]
    }))
    return Response.json({ id: `mock-summary-budget-${mockCalls}`,
      output_text: JSON.stringify({ blocks: lastValue, illustrationKind: "none" }),
      usage: { input_tokens: 100, output_tokens: 50 } })
  } catch (error) { capturedAssertion = error; throw error }
}

async function main() {
  globalThis.fetch = async () => { externalCalls++; throw new Error("external_network_forbidden") }
  const bytes = readFileSync(journalPath)
  assert.equal(hash(bytes), journalSha256)
  const fixtureBytes = readFileSync("scripts/dna-student-fixtures/SYNTHETIC_ONE_HOUR_24.json")
  assert.equal(hash(fixtureBytes), "8c8916240a237c526757b19e0db9047f3a8394b4be389b40868174704a60deb1")
  const turns = (JSON.parse(fixtureBytes.toString()) as { turns: Array<{ turnId: string; user: string }> }).turns
  const rows = bytes.toString().trim().split("\n").map((line) => JSON.parse(line)) as Array<{
    key: string; stage: string; value: StudentReplayTurn; valueSha256: string }>
  const session = configuredStudentReplaySession({ candidateSha256: oldCandidate, replaySha256: oldReplay, sessionId: "synthetic-one-hour24" })
  for (const turn of turns.slice(0, 22)) {
    const row = rows.find((row) => row.key === turn.turnId && row.stage === "completed")!
    assert.equal(hash(JSON.stringify(row.value)), row.valueSha256)
    session.restore({ question: turn.user }, row.value)
  }
  const state = session.state()!
  const stateHash = hash(JSON.stringify(state))
  const cached = rows.find((row) => row.key === "ONEHOUR24-T23" && row.stage === "completed")!
  assert.equal(hash(JSON.stringify(cached.value)), cached.valueSha256)
  const question = turns[22]!.user
  const resolved = resolveStudentEvidenceFirstRequest({ turnId: "turn-23", message: question, state: state.student })
  assert.ok(resolved.ok)
  assert.equal(cached.value.student!.contract.version, "dna-student-request-contract@28")
  assert.equal(resolved.contract.version, "dna-student-request-contract@29")
  // Preserve every historical semantic field; only the optional-field schema version changed.
  assert.deepEqual({ ...resolved.contract, version: cached.value.student!.contract.version }, cached.value.student!.contract)
  const execute = async (contract: StudentRequestContract, message = question) => {
    const r = await executeStudentAnswer({ question: message, contract, apiKey: "synthetic-not-real", fetchImpl })
    if (capturedAssertion) throw capturedAssertion
    return r
  }
  const exact = await execute(resolved.contract)
  assert.ok(exact.ok, JSON.stringify(exact.ok ? {} : { reason: exact.reason, codes: exact.reason === "candidate_invalid" ? exact.failureCodes : [] }))
  assert.deepEqual(slots.map((slot) => slot.summaryComposition!.sentenceUnits), [2, 1, 1])
  assert.deepEqual(slots.map((slot) => slot.obligations.map((row) => row.kind)), [
    ["summarize_known", "distinguish_targets"], ["summarize_unknown"], ["summarize_observation_focus"]])
  assert.equal(exact.candidate.blocks.length, 3)
  assert.equal(exact.answer.split(/(?<=[.!?])\s+/u).length, 4)
  assert.match(exact.candidate.blocks[1]!.text, /^Kesinleştiremediklerimiz: Bu kavramlar/u)
  assert.match(exact.candidate.blocks[2]!.text, /^Gözlemde bakılacaklar: Gözlemde etkinliğe/u)
  const exactSample = exact.answer
  let countedControls = 0
  for (const format of ["prose", "bullets"] as const) for (const depth of ["brief", "standard", "deep"] as const) {
    for (const requestedSentenceCount of [1, 2, 3, 4, 5, 6]) {
      const r = await execute({ ...resolved.contract, presentation: {
        ...resolved.contract.presentation, format, depth, requestedSentenceCount } })
      assert.ok(r.ok, `counted_${format}_${depth}_${requestedSentenceCount}`)
      assert.equal(r.answer.split(/(?<=[.!?])\s+/u).length, requestedSentenceCount)
      if (format === "bullets") {
        assert.equal(r.answer.split("\n").length, requestedSentenceCount)
        assert.ok(r.answer.split("\n").every((line) => line.startsWith("- ")))
      }
      assert.ok(r.candidate.blocks.every((block) => block.obligationIds.length > 0))
      assert.equal(new Set(r.candidate.blocks.flatMap((block) => block.obligationIds)).size, resolved.contract.obligations.length)
      assert.deepEqual(r.plan.policyUnits, exact.plan.policyUnits)
      assert.deepEqual(r.plan.targetEvidence, exact.plan.targetEvidence)
      assert.equal(validateStudentAnswerCandidate({ candidate: r.candidate, plan: r.plan }).length, 0)
      countedControls++
    }
  }
  const prose = await execute({ ...resolved.contract, presentation: { ...resolved.contract.presentation, requestedSentenceCount: null } })
  assert.ok(prose.ok)
  assert.ok(slots.every((slot) => !slot.summaryComposition))
  malformed = true
  const rejected = await execute(resolved.contract)
  assert.equal(rejected.ok, false, "missing_allocated_sentence_must_not_be_silently_padded")
  malformed = false
  const simpleQuestion = "öz düzenlemeyi üç cümlede açıkla"
  const simple = resolveStudentEvidenceFirstRequest({ turnId: "non-summary", message: simpleQuestion, state: createEmptyStudentConversationState() })
  assert.ok(simple.ok)
  const simpleResult = await execute(simple.contract, simpleQuestion)
  assert.ok(simpleResult.ok)
  assert.ok(slots.every((slot) => !slot.summaryComposition && slot.sentenceComposition?.roleOwned
    && slot.obligations.length > 0), "non_summary_uses_its_own_owned_sentence_contract")
  assert.equal(simpleResult.answer.split(/(?<=[.!?])\s+/u).length, 3)
  assert.equal(hash(JSON.stringify(state)), stateHash)
  assert.equal(hash(readFileSync(journalPath)), journalSha256)
  assert.equal(externalCalls, 0)
  console.log(JSON.stringify({ ok: true, gate: "STUDENT_OBLIGATION_OWNED_SUMMARY_BUDGET", candidateSha256: studentCandidateSha256(),
    authenticatedPriorReceipts: 22, exactCachedContract: true, countedControls, ordinarySummaryPreserved: true,
    nonSummaryOwnedProtocolIntegrated: true, malformedAllocationRejected: true, providerRoleSlotsHaveOwners: true,
    originalSourceAndPolicyPreserved: true, oldStateUnchanged: true, oldJournalUnchanged: true,
    mockCalls, externalProviderCalls: externalCalls, exactSample, semanticQualityCertified: false, liveAuthenticatedProof: false }, null, 2))
}
main().catch((error) => { console.error(error); process.exitCode = 1 })

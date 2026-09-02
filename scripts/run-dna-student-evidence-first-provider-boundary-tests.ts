import assert from "node:assert/strict"

import {
  applyStudentRequestContract,
  createEmptyStudentConversationState,
  interpretStudentRequest,
  type StudentConversationState,
} from "../src/lib/dna/chat/studentFirst"
import {
  DNA_STUDENT_EVIDENCE_FIRST_MAX_PROVIDER_CALLS_PER_TURN,
  DNA_STUDENT_EVIDENCE_FIRST_MAX_TRANSPORT_RETRIES_PER_TURN,
  interpretStudentRequestWithEvidenceFirstProvider,
} from "../src/lib/dna/chat/studentFirst/evidenceFirstInterpreter.server"

const HARNESS_VERSION = "dna-student-evidence-first-provider-boundary@1" as const

function append(state: StudentConversationState, turnId: string, message: string): StudentConversationState {
  return applyStudentRequestContract(state, interpretStudentRequest({ turnId, message, state }))
}

function providerPayload(value: unknown, id = "resp_b1") {
  return {
    id,
    output_text: JSON.stringify(value),
    usage: { input_tokens: 31, output_tokens: 7, input_tokens_details: { cached_tokens: 11 } },
  }
}

async function main() {
let deterministicState = createEmptyStudentConversationState()
deterministicState = append(deterministicState, "B1-PROVIDER-T01", "eş düzenleme ne demek")
let deterministicCalls = 0
const deterministic = await interpretStudentRequestWithEvidenceFirstProvider({
  turnId: "B1-PROVIDER-T02",
  message: "bu çocuğa bağımsız olsun diye hangi terapiyi uygulayayım",
  state: deterministicState,
  apiKey: "test-key-not-a-secret",
  fetchImpl: (async () => {
    deterministicCalls += 1
    throw new Error("deterministic request must not call provider")
  }) as typeof fetch,
})
assert.equal(deterministic.ok, true)
if (!deterministic.ok) throw new Error("expected deterministic evidence-first resolution")
assert.equal(deterministicCalls, 0)
assert.equal(deterministic.provider.attempts, 0)
assert.deepEqual(deterministic.contract.targetIds, ["coregulation"])

let ambiguousState = createEmptyStudentConversationState()
ambiguousState = append(ambiguousState, "B1-PROVIDER-A01", "öz düzenleme ne demek")
ambiguousState = append(ambiguousState, "B1-PROVIDER-A02", "dikkat ne demek")
let validCalls = 0
let capturedSchema: unknown = null
const valid = await interpretStudentRequestWithEvidenceFirstProvider({
  turnId: "B1-PROVIDER-A03",
  message: "konulardan birine geri dönelim",
  state: ambiguousState,
  apiKey: "test-key-not-a-secret",
  fetchImpl: (async (_url, init) => {
    validCalls += 1
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    const text = body.text as Record<string, unknown>
    const format = text.format as Record<string, unknown>
    capturedSchema = format.schema
    return new Response(JSON.stringify(providerPayload({
      primaryTask: "explain",
      focusTargetIds: ["self_regulation"],
      referentTurnId: "B1-PROVIDER-A01",
    })), { status: 200, headers: { "content-type": "application/json" } })
  }) as typeof fetch,
})
assert.equal(valid.ok, true)
if (!valid.ok) throw new Error("expected bounded provider choice")
assert.equal(validCalls, 1)
assert.deepEqual(valid.contract.targetIds, ["self_regulation"])
assert.equal(valid.contract.referent.turnId, "B1-PROVIDER-A01")
assert.deepEqual(valid.provider.usage, { inputTokens: 31, cachedInputTokens: 11, outputTokens: 7 })
assert.equal(JSON.stringify(capturedSchema).includes("conversationAction"), false)
assert.equal(JSON.stringify(capturedSchema).includes("safetyIntent"), false)
assert.equal(JSON.stringify(capturedSchema).includes("treatment_selection"), false)

const incoherent = await interpretStudentRequestWithEvidenceFirstProvider({
  turnId: "B1-PROVIDER-A03",
  message: "konulardan birine geri dönelim",
  state: ambiguousState,
  apiKey: "test-key-not-a-secret",
  fetchImpl: (async () => new Response(JSON.stringify(providerPayload({
    primaryTask: "explain",
    focusTargetIds: ["attention"],
    referentTurnId: "B1-PROVIDER-A01",
  }, "resp_incoherent")), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch,
})
assert.equal(incoherent.ok, false)
if (incoherent.ok || incoherent.reason !== "closed_slot_failure") throw new Error("expected incoherent choice rejection")
assert.equal(incoherent.failureCode, "focus_target_set_mismatch")
assert.equal(incoherent.provider.attempts, 1)

let transportCalls = 0
const transport = await interpretStudentRequestWithEvidenceFirstProvider({
  turnId: "B1-PROVIDER-A03",
  message: "konulardan birine geri dönelim",
  state: ambiguousState,
  apiKey: "test-key-not-a-secret",
  fetchImpl: (async () => {
    transportCalls += 1
    throw new DOMException("aborted", "AbortError")
  }) as typeof fetch,
})
assert.equal(transport.ok, false)
if (transport.ok || transport.reason !== "provider_failure") throw new Error("expected bounded transport failure")
assert.equal(transport.failure.reason, "timeout")
assert.equal(transportCalls, DNA_STUDENT_EVIDENCE_FIRST_MAX_PROVIDER_CALLS_PER_TURN)
assert.equal(transport.provider.transportRetries, DNA_STUDENT_EVIDENCE_FIRST_MAX_TRANSPORT_RETRIES_PER_TURN)
assert.equal(transport.provider.usageComplete, false)

console.log(JSON.stringify({
  ok: true,
  gate: "STUDENT_EVIDENCE_FIRST_R2_PROVIDER_BOUNDARY_LOCAL",
  version: HARNESS_VERSION,
  deterministicProviderCalls: deterministicCalls,
  boundedAmbiguityProviderCalls: validCalls,
  providerOwnsConversationAction: false,
  providerOwnsSafetyIntent: false,
  incoherentChoiceRejected: true,
  transportRetriesBounded: true,
  maxProviderCallsPerTurn: DNA_STUDENT_EVIDENCE_FIRST_MAX_PROVIDER_CALLS_PER_TURN,
  rawProviderOutputReused: false,
}, null, 2))
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})

import assert from "node:assert/strict"

import { resolveDnaChatApiRequest } from "../src/lib/dna/chat/apiResolver"
import { resolveDnaChat } from "../src/lib/dna/chat/engine"
import {
  DNA_CHAT_RUNTIME_RELEASE_GATE_VERSION,
  DNA_V2_LEGACY_RUNTIME_ROLLBACK_POLICY,
  evaluateDnaChatRuntimeRelease,
} from "../src/lib/dna/chat/governance/runtimeReleaseGate"

async function main() {
const currentV2 = evaluateDnaChatRuntimeRelease({
  generation: "v2_legacy",
  engineVersion: "dna-chat-engine@2",
})
assert.deepEqual(currentV2, {
  gateVersion: DNA_CHAT_RUNTIME_RELEASE_GATE_VERSION,
  allowed: true,
  generation: "v2_legacy",
  blockCode: null,
})
assert.equal(Object.isFrozen(DNA_V2_LEGACY_RUNTIME_ROLLBACK_POLICY), true)
assert.equal(Object.isFrozen(DNA_V2_LEGACY_RUNTIME_ROLLBACK_POLICY.allowedEngineVersions), true)

assert.equal(evaluateDnaChatRuntimeRelease({
  generation: "v2_legacy",
  engineVersion: "dna-chat-engine@3",
}).blockCode, "legacy_engine_not_allowlisted")

assert.equal(evaluateDnaChatRuntimeRelease({
  generation: "v3",
  engineVersion: "dna-chat-engine@3",
  candidateIds: [],
}).blockCode, "v3_candidate_ids_required")

assert.equal(evaluateDnaChatRuntimeRelease({
  generation: "v3",
  engineVersion: "dna-chat-engine@3",
  candidateIds: ["forged.not-released"],
}).blockCode, "v3_candidate_not_released")

assert.equal(evaluateDnaChatRuntimeRelease({
  generation: "v3",
  engineVersion: "dna-chat-engine@2",
  candidateIds: ["forged.not-released"],
}).blockCode, "v3_engine_not_allowlisted")

assert.equal(evaluateDnaChatRuntimeRelease({
  generation: "v3",
  engineVersion: "dna-chat-engine@3",
  candidateIds: ["duplicate", "duplicate"],
}).blockCode, "v3_duplicate_candidate_id")

assert.equal(evaluateDnaChatRuntimeRelease({
  generation: "v4",
  engineVersion: "dna-chat-engine@4",
}).blockCode, "unsupported_generation")

assert.equal(evaluateDnaChatRuntimeRelease(null).blockCode, "invalid_descriptor")

let auditCalls = 0
const forgedAnswer = {
  ...resolveDnaChat({ question: "HRV nedir?" }),
  engineVersion: "dna-chat-engine@3" as never,
}
const forgedApiResult = await resolveDnaChatApiRequest({
  question: "Son raporumu özetle.",
  reportId: "synthetic-owned-report",
}, {
  createRequestId: () => "must-not-be-created",
  loadCaseAnswer: async () => ({ ok: true, answer: forgedAnswer }),
  writeAudit: async () => {
    auditCalls += 1
    return { ok: true }
  },
})
assert.equal(forgedApiResult.status, 500)
assert.deepEqual(forgedApiResult.body, { ok: false, error: "dna_chat_failed" })
assert.equal(auditCalls, 0, "Engellenen motor yanıtı audit/public response sınırına ulaşmamalı")

console.log(JSON.stringify({
  ok: true,
  gateVersion: DNA_CHAT_RUNTIME_RELEASE_GATE_VERSION,
  v2LegacyRollbackAllowed: true,
  v3EmptyBlocked: true,
  forgedCandidateBlocked: true,
  forgedEngineBlockedAtApiBoundary: true,
  unknownGenerationBlocked: true,
}, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

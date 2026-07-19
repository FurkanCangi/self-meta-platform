import assert from "node:assert/strict"

import { resolveDnaChatApiRequest } from "../src/lib/dna/chat/apiResolver"
import {
  isDnaChatEngineResponseAuthentic,
  resolveDnaChat,
} from "../src/lib/dna/chat/engine"
import {
  DNA_CHAT_RUNTIME_RELEASE_GATE_VERSION,
  DNA_V2_LEGACY_RUNTIME_ROLLBACK_POLICY,
  evaluateDnaChatRuntimeRelease,
} from "../src/lib/dna/chat/governance/runtimeReleaseGate"
import {
  DNA_CURRENT_V3_RELEASE_CANDIDATES,
  DNA_CURRENT_V3_RELEASE_PACKAGE,
} from "../src/lib/dna/chat/governance/releaseCompiler"

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
assert.equal(Object.isFrozen(DNA_CURRENT_V3_RELEASE_CANDIDATES), true)
assert.deepEqual(DNA_CURRENT_V3_RELEASE_CANDIDATES, [])

assert.equal(evaluateDnaChatRuntimeRelease({
  generation: "v2_legacy",
  engineVersion: "dna-chat-engine@3",
}).blockCode, "legacy_engine_not_allowlisted")

assert.equal(evaluateDnaChatRuntimeRelease({
  generation: "v3",
  engineVersion: "dna-chat-engine@3",
  releasePackageInputSha256: DNA_CURRENT_V3_RELEASE_PACKAGE.inputSha256,
  candidates: [],
}).blockCode, "v3_candidate_authorizations_required")

assert.equal(evaluateDnaChatRuntimeRelease({
  generation: "v3",
  engineVersion: "dna-chat-engine@3",
  releasePackageInputSha256: DNA_CURRENT_V3_RELEASE_PACKAGE.inputSha256,
  candidates: [{
    candidateId: "forged.not-released",
    authorizationDigest: "a".repeat(64),
  }],
}).blockCode, "v3_candidate_not_released")

assert.equal(evaluateDnaChatRuntimeRelease({
  generation: "v3",
  engineVersion: "dna-chat-engine@3",
  releasePackageInputSha256: DNA_CURRENT_V3_RELEASE_PACKAGE.inputSha256,
  candidates: [{
    candidateId: "forged.rich-runtime-input",
    authorizationDigest: "a".repeat(64),
    claimId: "claim.must-not-be-caller-supplied",
  }],
}).blockCode, "v3_candidate_authorizations_required")

assert.equal(evaluateDnaChatRuntimeRelease({
  generation: "v3",
  engineVersion: "dna-chat-engine@2",
  releasePackageInputSha256: DNA_CURRENT_V3_RELEASE_PACKAGE.inputSha256,
  candidates: [{
    candidateId: "forged.not-released",
    authorizationDigest: "a".repeat(64),
  }],
}).blockCode, "v3_engine_not_allowlisted")

assert.equal(evaluateDnaChatRuntimeRelease({
  generation: "v3",
  engineVersion: "dna-chat-engine@3",
  releasePackageInputSha256: DNA_CURRENT_V3_RELEASE_PACKAGE.inputSha256,
  candidates: [
    { candidateId: "duplicate", authorizationDigest: "a".repeat(64) },
    { candidateId: "duplicate", authorizationDigest: "b".repeat(64) },
  ],
}).blockCode, "v3_duplicate_candidate_id")

assert.equal(evaluateDnaChatRuntimeRelease({
  generation: "v3",
  engineVersion: "dna-chat-engine@3",
  releasePackageInputSha256: "f".repeat(64),
  candidates: [{ candidateId: "forged.not-released", authorizationDigest: "a".repeat(64) }],
}).blockCode, "v3_release_package_hash_mismatch")

assert.equal(evaluateDnaChatRuntimeRelease({
  generation: "v4",
  engineVersion: "dna-chat-engine@4",
}).blockCode, "unsupported_generation")

assert.equal(evaluateDnaChatRuntimeRelease(null).blockCode, "invalid_descriptor")

const authenticAnswer = resolveDnaChat({ question: "İnsular korteks nedir?" })
assert.equal(isDnaChatEngineResponseAuthentic(authenticAnswer), true)
authenticAnswer.summary = `${authenticAnswer.summary} Sonradan değiştirildi.`
assert.equal(isDnaChatEngineResponseAuthentic(authenticAnswer), false)

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

const forgedAllowlistedAnswer = {
  ...resolveDnaChat({ question: "HRV nedir?" }),
}
const forgedAllowlistedApiResult = await resolveDnaChatApiRequest({
  question: "Son raporumu özetle.",
  reportId: "synthetic-owned-report",
}, {
  createRequestId: () => "must-not-be-created-for-allowlisted-forgery",
  loadCaseAnswer: async () => ({ ok: true, answer: forgedAllowlistedAnswer }),
  writeAudit: async () => {
    auditCalls += 1
    return { ok: true }
  },
})
assert.equal(forgedAllowlistedAnswer.engineVersion, "dna-chat-engine@2")
assert.equal(forgedAllowlistedApiResult.status, 500)
assert.deepEqual(forgedAllowlistedApiResult.body, { ok: false, error: "dna_chat_failed" })
assert.equal(
  auditCalls,
  0,
  "Allowlist motor sürümü taşıyan sahte yanıt audit/public response sınırına ulaşmamalı",
)

console.log(JSON.stringify({
  ok: true,
  gateVersion: DNA_CHAT_RUNTIME_RELEASE_GATE_VERSION,
  v2LegacyRollbackAllowed: true,
  v3EmptyBlocked: true,
  forgedCandidateBlocked: true,
  releasePackageHashBound: true,
  candidateAuthorizationDigestRequired: true,
  runtimeInputRestrictedToCandidateAndAuthorization: true,
  forgedEngineBlockedAtApiBoundary: true,
  forgedAllowlistedResponseBlockedAtApiBoundary: true,
  unknownGenerationBlocked: true,
}, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

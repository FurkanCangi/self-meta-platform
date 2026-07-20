import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

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
import {
  DNA_CHAT_RUNTIME_SELECTION_VERSION,
  selectDnaChatRuntime,
} from "../src/lib/dna/chat/runtimeSelection"
import committedManifest from "../src/lib/dna/chat/catalog/generated/v3/manifest.json"
import committedSources from "../src/lib/dna/chat/catalog/generated/v3/sources.json"
import committedPassages from "../src/lib/dna/chat/catalog/generated/v3/passages.json"
import committedClaims from "../src/lib/dna/chat/catalog/generated/v3/claims.json"
import committedLinks from "../src/lib/dna/chat/catalog/generated/v3/claim-passage-links.json"
import committedLexicalIndex from "../src/lib/dna/chat/catalog/generated/v3/lexical-index.json"
import {
  DNA_CURRENT_V3_EVALUATION_RELEASE_ATTESTATION,
  createDnaV3EvaluationReleaseAttestation,
  evaluateDnaV3EvaluationReleaseAttestation,
} from "../src/lib/dna/chat/evaluation/evaluationReleaseAttestation"
import {
  DNA_EVALUATION_ENGINE_CLOSURE_EXCLUSIONS,
  DNA_EVALUATION_ENGINE_SOURCE_FILES,
  assertCurrentDnaEvaluationEngineSourceClosure,
  computeDnaEvaluationEngineCodeHash,
  computeDnaEvaluationEngineSourceListHash,
} from "../src/lib/dna/chat/evaluation/evaluationGovernance"
import { DNA_CURRENT_V3_ENGINE_CODE_AUTHORITY } from "../src/lib/dna/chat/evaluation/generated/currentEngineCodeAuthority"
import {
  canBeginDnaChatReportSelection,
  createDnaChatReportSelectionCoordinator,
} from "../src/lib/dna/chat/conversationPolicy"

async function main() {
const exactEngineSourceClosure = assertCurrentDnaEvaluationEngineSourceClosure(process.cwd())
assert.equal(exactEngineSourceClosure.length, 116)
assert.deepEqual(DNA_EVALUATION_ENGINE_CLOSURE_EXCLUSIONS, [
  "src/lib/dna/chat/evaluation/generated/currentEngineCodeAuthority.ts",
], "Yalnız self-referential generated authority closure dışında kalabilir")
assert.equal(
  (DNA_EVALUATION_ENGINE_SOURCE_FILES as readonly string[]).includes(
    "src/lib/dna/chat/evaluation/generated/currentEngineCodeAuthority.ts",
  ),
  false,
  "Kendi hash'ini taşıyan generated authority self-referential closure'a girmemeli",
)
assert.match(
  readFileSync(join(process.cwd(),
    "src/lib/dna/chat/governance/runtimeReleaseGate.ts"), "utf8"),
  /evaluation\/generated\/currentEngineCodeAuthority/,
  "Tek closure istisnası gerçek runtime gate trust-root importuna bağlı kalmalı",
)
for (const requiredEngineAuthoritySource of [
  "src/app/dna-asistani/DnaAssistantClient.tsx",
  "src/lib/dna/chat/catalog/generated/v3/server.ts",
  "src/lib/dna/chat/catalog/generated/v3/types.ts",
  "src/lib/dna/chat/conversationPolicy.ts",
  "src/lib/dna/chat/evaluation/evaluationGates.ts",
  "src/lib/dna/chat/evaluation/evaluationGovernance.ts",
  "src/lib/dna/chat/index.ts",
  "src/lib/dna/chat/release/previewPromotion.ts",
  "src/lib/dna/chat/release/runtimeDeploymentAuthorization.ts",
  "src/lib/dna/reportPrivacy.ts",
  "src/lib/security/apiGuards.ts",
  "src/lib/security/privacyOps.ts",
  "src/lib/security/rateLimit.ts",
  "src/lib/supabase/admin.ts",
  "src/lib/supabase/server.ts",
  "scripts/run-dna-evaluation-release-check.ts",
] as const) {
  assert.ok(
    DNA_EVALUATION_ENGINE_SOURCE_FILES.includes(requiredEngineAuthoritySource),
    `Engine-code authority kapsamı kritik kaynağı korumalı: ${requiredEngineAuthoritySource}`,
  )
}
for (const removedCriticalDependency of [
  "src/lib/dna/reportPrivacy.ts",
  "src/lib/security/privacyOps.ts",
  "src/lib/dna/chat/release/runtimeDeploymentAuthorization.ts",
] as const) {
  assert.throws(
    () => assertCurrentDnaEvaluationEngineSourceClosure(
      process.cwd(),
      DNA_EVALUATION_ENGINE_SOURCE_FILES.filter((file) => file !== removedCriticalDependency),
    ),
    /dna_evaluation_engine_source_closure_mismatch/,
    `Kritik transitive dependency listeden çıkarıldığında kapı kapanmalı: ${removedCriticalDependency}`,
  )
}
assert.equal(
  computeDnaEvaluationEngineSourceListHash(),
  DNA_CURRENT_V3_ENGINE_CODE_AUTHORITY.sourceListSha256,
  "Committed V3 source-list authority must match the evaluator's exact file set",
)
const currentEngineCodeHash = computeDnaEvaluationEngineCodeHash((relativePath) =>
  readFileSync(join(process.cwd(), relativePath), "utf8"))
assert.equal(
  currentEngineCodeHash,
  DNA_CURRENT_V3_ENGINE_CODE_AUTHORITY.engineCodeHash,
  "Committed V3 code authority must match current executable/privacy/UI source bytes",
)
for (const mutatedCriticalDependency of [
  "src/lib/dna/reportPrivacy.ts",
  "src/lib/security/privacyOps.ts",
  "src/lib/dna/chat/release/runtimeDeploymentAuthorization.ts",
] as const) {
  assert.notEqual(
    computeDnaEvaluationEngineCodeHash((relativePath) => {
      const source = readFileSync(join(process.cwd(), relativePath), "utf8")
      return relativePath === mutatedCriticalDependency ? `${source}\n// forged no-op\n` : source
    }),
    currentEngineCodeHash,
    `Kritik dependency byte değişikliği engine hash'ini değiştirmeli: ${mutatedCriticalDependency}`,
  )
}
const reportSelectionCoordinator = createDnaChatReportSelectionCoordinator()
const firstReportSelection = reportSelectionCoordinator.claim({
  reportId: "report.runtime-race.001",
  pendingReportQuestion: "Bekleyen rapor sorusu",
})
const duplicateReportSelection = reportSelectionCoordinator.claim({
  reportId: "report.runtime-race.001",
  pendingReportQuestion: "Bekleyen rapor sorusu",
})
assert.deepEqual(firstReportSelection?.resubmitQuestions, ["Bekleyen rapor sorusu"])
assert.equal(duplicateReportSelection, null,
  "Aynı tick içindeki ikinci rapor seçimi bekleyen soruyu yeniden tüketememeli")
assert.equal(reportSelectionCoordinator.isInFlight(), true)
reportSelectionCoordinator.release()
assert.equal(reportSelectionCoordinator.isInFlight(), false)
assert.equal(canBeginDnaChatReportSelection({
  sending: false,
  reportsLoading: false,
  selectionInFlight: false,
}), true)
for (const blockedState of [
  { sending: true, reportsLoading: false, selectionInFlight: false },
  { sending: false, reportsLoading: true, selectionInFlight: false },
  { sending: false, reportsLoading: false, selectionInFlight: true },
]) {
  assert.equal(canBeginDnaChatReportSelection(blockedState), false,
    "Gönderim/yükleme/seçim devam ederken rapor seçimi fail-closed kalmalı")
}
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

assert.deepEqual(selectDnaChatRuntime({
  runtimeEligible: committedManifest.runtimeEligible,
  releaseAllowed: false,
  manifestCounts: {
    sources: committedManifest.counts.included.sources,
    passages: committedManifest.counts.included.passages,
    claims: committedManifest.counts.included.claims,
    claimPassageLinks: committedManifest.counts.included.claimPassageLinks,
    lexicalEntries: committedManifest.counts.included.lexicalEntries,
  },
  loadedCounts: {
    sources: committedSources.length,
    passages: committedPassages.length,
    claims: committedClaims.length,
    claimPassageLinks: committedLinks.length,
    lexicalEntries: committedLexicalIndex.entries.length,
  },
}), {
  selectionVersion: DNA_CHAT_RUNTIME_SELECTION_VERSION,
  generation: "v2_legacy",
  reason: "v3_package_empty",
})

const releasedFixtureCounts = {
  sources: 1,
  passages: 1,
  claims: 1,
  claimPassageLinks: 1,
  lexicalEntries: 1,
}
assert.deepEqual(selectDnaChatRuntime({
  runtimeEligible: true,
  releaseAllowed: true,
  manifestCounts: releasedFixtureCounts,
  loadedCounts: releasedFixtureCounts,
}), {
  selectionVersion: DNA_CHAT_RUNTIME_SELECTION_VERSION,
  generation: "v3",
  reason: "v3_released_package_ready",
})
assert.equal(selectDnaChatRuntime({
  runtimeEligible: true,
  releaseAllowed: false,
  manifestCounts: releasedFixtureCounts,
  loadedCounts: releasedFixtureCounts,
}).generation, "blocked", "Gate reddi V2'ye sessizce düşmemeli")
assert.equal(selectDnaChatRuntime({
  runtimeEligible: true,
  releaseAllowed: true,
  manifestCounts: releasedFixtureCounts,
  loadedCounts: { ...releasedFixtureCounts, passages: 0 },
}).generation, "blocked", "Eksik yayımlanmış paket çalıştırılmamalı")
assert.equal(Object.isFrozen(DNA_V2_LEGACY_RUNTIME_ROLLBACK_POLICY), true)
assert.equal(Object.isFrozen(DNA_V2_LEGACY_RUNTIME_ROLLBACK_POLICY.allowedEngineVersions), true)
assert.equal(Object.isFrozen(DNA_CURRENT_V3_RELEASE_CANDIDATES), true)
assert.deepEqual(DNA_CURRENT_V3_RELEASE_CANDIDATES, [])
assert.equal(DNA_CURRENT_V3_EVALUATION_RELEASE_ATTESTATION, null,
  "Değerlendirme GO kanıtı yokken V3 attestation sahte biçimde mevcut görünmemeli")

const syntheticEvaluationAttestation = createDnaV3EvaluationReleaseAttestation({
  schemaVersion: "dna-v3-evaluation-release-attestation@1",
  decision: "go",
  packageSha256: "1".repeat(64),
  releasePackageInputSha256: "2".repeat(64),
  engineVersion: "dna-chat-engine@3",
  engineCodeHash: "3".repeat(64),
  benchmarkSha256: "4".repeat(64),
  variationSha256: "5".repeat(64),
  runId: "evaluation.synthetic.release-1",
  evaluatedAt: "2026-07-19T00:00:00.000Z",
  statuses: Object.freeze({
    sourceIntegration: "pass",
    retrieval: "pass",
    citation: "pass",
    safety: "pass",
    cases: "pass",
  }),
})
assert.deepEqual(evaluateDnaV3EvaluationReleaseAttestation(syntheticEvaluationAttestation, {
  packageSha256: "1".repeat(64),
  releasePackageInputSha256: "2".repeat(64),
  engineVersion: "dna-chat-engine@3",
  engineCodeHash: "3".repeat(64),
}), { valid: true, blockCode: null })
assert.equal(evaluateDnaV3EvaluationReleaseAttestation(
  syntheticEvaluationAttestation,
  {
    packageSha256: "9".repeat(64),
    releasePackageInputSha256: "2".repeat(64),
    engineVersion: "dna-chat-engine@3",
    engineCodeHash: "3".repeat(64),
  },
).blockCode, "evaluation_attestation_binding_mismatch")
assert.equal(evaluateDnaV3EvaluationReleaseAttestation(
  Object.freeze({ ...syntheticEvaluationAttestation, engineCodeHash: "8".repeat(64) }),
  {
    packageSha256: "1".repeat(64),
    releasePackageInputSha256: "2".repeat(64),
    engineVersion: "dna-chat-engine@3",
    engineCodeHash: "3".repeat(64),
  },
).blockCode, "evaluation_attestation_invalid")
assert.equal(evaluateDnaV3EvaluationReleaseAttestation(
  syntheticEvaluationAttestation,
  {
    packageSha256: "1".repeat(64),
    releasePackageInputSha256: "2".repeat(64),
    engineVersion: "dna-chat-engine@3",
    engineCodeHash: "8".repeat(64),
  },
).blockCode, "evaluation_attestation_binding_mismatch")

assert.equal(evaluateDnaChatRuntimeRelease({
  generation: "v2_legacy",
  engineVersion: "dna-chat-engine@3",
}).blockCode, "legacy_engine_not_allowlisted")

assert.equal(evaluateDnaChatRuntimeRelease({
  generation: "v3",
  engineVersion: "dna-chat-engine@3",
  packageSha256: committedManifest.packageSha256,
  releasePackageInputSha256: DNA_CURRENT_V3_RELEASE_PACKAGE.inputSha256,
  candidates: [],
}).blockCode, "v3_candidate_authorizations_required")

assert.equal(evaluateDnaChatRuntimeRelease({
  generation: "v3",
  engineVersion: "dna-chat-engine@3",
  packageSha256: committedManifest.packageSha256,
  releasePackageInputSha256: DNA_CURRENT_V3_RELEASE_PACKAGE.inputSha256,
  candidates: [{
    candidateId: "forged.not-released",
    authorizationDigest: "a".repeat(64),
  }],
}).blockCode, "v3_candidate_not_released")

assert.equal(evaluateDnaChatRuntimeRelease({
  generation: "v3",
  engineVersion: "dna-chat-engine@3",
  packageSha256: committedManifest.packageSha256,
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
  packageSha256: committedManifest.packageSha256,
  releasePackageInputSha256: DNA_CURRENT_V3_RELEASE_PACKAGE.inputSha256,
  candidates: [{
    candidateId: "forged.not-released",
    authorizationDigest: "a".repeat(64),
  }],
}).blockCode, "v3_engine_not_allowlisted")

assert.equal(evaluateDnaChatRuntimeRelease({
  generation: "v3",
  engineVersion: "dna-chat-engine@3",
  packageSha256: committedManifest.packageSha256,
  releasePackageInputSha256: DNA_CURRENT_V3_RELEASE_PACKAGE.inputSha256,
  candidates: [
    { candidateId: "duplicate", authorizationDigest: "a".repeat(64) },
    { candidateId: "duplicate", authorizationDigest: "b".repeat(64) },
  ],
}).blockCode, "v3_duplicate_candidate_id")

assert.equal(evaluateDnaChatRuntimeRelease({
  generation: "v3",
  engineVersion: "dna-chat-engine@3",
  packageSha256: committedManifest.packageSha256,
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
  emptyCommittedPackageSelectsV2: true,
  releasedNonemptyFixtureSelectsV3: true,
  invalidReleasedPackageFailsClosed: true,
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

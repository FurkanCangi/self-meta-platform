import assert from "node:assert/strict"
import { createHash, generateKeyPairSync, sign } from "node:crypto"
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  DNA_CURRENT_V3_RELEASE_EVIDENCE_BUNDLE,
  DNA_RELEASE_EVIDENCE_ROW_VERSION,
  createDnaReleaseEvidenceBundle,
  dnaReleaseMarketingClaimBindingSha256,
  validateDnaReleaseEvidenceArtifactVerification,
  validateDnaReleaseEvidenceBundle,
  verifyDnaReleaseEvidenceBundleArtifacts,
  type DnaReleaseEvidenceArtifact,
} from "../src/lib/dna/chat/release/releaseEvidenceBundle"
import {
  DNA_MARKETING_EVIDENCE_MANIFEST_VERSION,
  dnaMarketingEvidenceManifestContentSha256,
  type DnaMarketingEvidenceManifest,
} from "../src/lib/dna/chat/operations/marketingEvidence"
import {
  evaluateCurrentDnaV3ReleaseHardNoGo,
  evaluateDnaReleaseHardNoGo,
  type DnaReleaseHardNoGoSignals,
} from "../src/lib/dna/chat/release/hardNoGo"
import {
  DNA_CHAT_RUNTIME_RELEASE_ENV,
  DNA_CHAT_V3_KILL_SWITCH_ENV,
  DNA_CHAT_V3_ROLLOUT_PERCENT_ENV,
  DNA_V2_ROLLBACK_TARGET,
  decideDnaRuntimeReleaseExecution,
  readDnaRuntimeReleaseConfiguration,
} from "../src/lib/dna/chat/release/runtimeReleaseMode"
import {
  DNA_CHAT_PRODUCTION_PROMOTION_RECEIPT_ENV,
  DNA_VERCEL_ENV,
  DNA_VERCEL_GIT_COMMIT_SHA_ENV,
  DNA_VERCEL_URL_ENV,
  evaluateCurrentDnaRuntimeDeploymentAuthorization,
  verifyDnaRuntimeDeploymentAuthorization,
  verifyDnaRuntimePromotionReceipt,
} from "../src/lib/dna/chat/release/runtimeDeploymentAuthorization"
import {
  DNA_CURRENT_V3_PREVIEW_VERIFICATION_MANIFEST,
  DNA_CURRENT_V3_PRODUCTION_VERIFICATION_MANIFEST,
  DNA_CURRENT_EXTERNAL_LIVE_OBSERVATION_TRUST_ROOTS,
  DNA_EXTERNAL_LIVE_OBSERVATION_ATTESTATION_VERSION,
  DNA_EXTERNAL_LIVE_OBSERVATION_TRUST_ROOT_VERSION,
  DNA_PREVIEW_CHECK_ARTIFACT_VERSION,
  DNA_PREVIEW_DEPLOYMENT_ARTIFACT_VERSION,
  DNA_PRODUCTION_CHECK_ARTIFACT_VERSION,
  DNA_PRODUCTION_DEPLOYMENT_ARTIFACT_VERSION,
  DNA_REQUIRED_PREVIEW_CHECKS,
  DNA_REQUIRED_PRODUCTION_CHECKS,
  createDnaPreviewVerificationManifest,
  createDnaProductionVerificationManifest,
  deriveDnaExternalLiveObservationAggregateHashes,
  dnaExternalLiveObservationSigningBytes,
  evaluateDnaPreviewPromotion,
  verifyDnaProductionDeploymentEvidence,
  validateDnaPreviewVerificationManifest,
  validateDnaProductionVerificationManifest,
  verifyDnaExternalLiveObservationAttestation,
  verifyDnaPreviewVerificationArtifacts,
  verifyDnaProductionVerificationArtifacts,
} from "../src/lib/dna/chat/release/previewPromotion"
import {
  DNA_CURRENT_V3_STAGED_ROLLOUT_AUTHORIZATION,
  DNA_CURRENT_V3_STAGED_ROLLOUT_EVIDENCE_VERIFICATION,
  DNA_CURRENT_V3_STAGED_ROLLOUT_POLICY,
  createDnaStagedRolloutAuthorization,
  createDnaStagedRolloutPolicy,
  evaluateCurrentDnaStagedRolloutAuthorization,
  evaluateDnaStagedRolloutHealth,
  validateDnaStagedRolloutAuthorization,
  validateDnaStagedRolloutEvidenceVerification,
  verifyDnaStagedRolloutHealthEvidence,
  type DnaStagedRolloutHealthEvidenceFile,
} from "../src/lib/dna/chat/release/stagedRollout"

function digest(label: string): string {
  return createHash("sha256").update(label, "utf8").digest("hex")
}

const artifactKinds: DnaReleaseEvidenceArtifact["kind"][] = [
  "test_manifest",
  "row_results",
  "category_results",
  "security_results",
  "cross_account_results",
  "performance_results",
  "marketing_evidence",
]
const evidenceRoot = mkdtempSync(join(tmpdir(), "dna-v3-release-evidence-"))
const syntheticRelease = {
  releaseId: "dna-v3.synthetic.release-1",
  runId: "release-run.synthetic.001",
  gitSha: "1".repeat(40),
  engineVersion: "dna-chat-engine@3",
  engineSourceCodeSha256: digest("engine"),
  runtimePackVersion: "dna-v3-static-package@1",
  packageSha256: digest("package"),
  packageCounts: { sources: 2, passages: 2, claims: 2, claimPassageLinks: 2 },
} as const
const boundRow = (
  kind: DnaReleaseEvidenceArtifact["kind"],
  recordId: string,
  fields: Readonly<Record<string, unknown>>,
) => ({
  schemaVersion: DNA_RELEASE_EVIDENCE_ROW_VERSION,
  kind,
  releaseId: syntheticRelease.releaseId,
  runId: syntheticRelease.runId,
  gitSha: syntheticRelease.gitSha,
  engineVersion: syntheticRelease.engineVersion,
  engineSourceCodeSha256: syntheticRelease.engineSourceCodeSha256,
  runtimePackVersion: syntheticRelease.runtimePackVersion,
  packageSha256: syntheticRelease.packageSha256,
  recordId,
  ...fields,
})
const securityChecks = [
  "evaluation_attestation_integrity", "locked_benchmark_integrity",
  "critical_safety_clinical_answer", "unreported_case_finding",
  "uncited_material_claim", "fabricated_or_wrong_source",
  "live_claim_without_passage", "metadata_only_source_use",
  "active_retracted_source", "license_violation", "audit_fail_open",
  "pending_content_published", "critical_ux_warning", "kill_switch_configuration",
] as const
const crossAccountScenarios = [
  "foreign_owner_direct_id", "foreign_owner_list", "foreign_role_matrix",
  "uuid_enumeration", "expired_session", "direct_rls",
] as const
const performanceRows = [
  ["determinism_repeat_runs", 20, 20, "count", "local"],
  ["determinism_distinct_output_hash_count", 1, 20, "count", "local"],
  ["engine_p95_ms", 10, 100, "ms", "local"],
  ["mock_api_p95_ms", 20, 100, "ms", "mock"],
  ["production_api_p95_ms", 200, 100, "ms", "production"],
  ["production_api_p99_ms", 500, 100, "ms", "production"],
  ["deep_response_max_bytes", 20_000, 100, "bytes", "local"],
  ["concurrent_request_count", 32, 32, "count", "local"],
  ["concurrent_failure_count", 0, 32, "count", "local"],
  ["forbidden_runtime_import_count", 0, 1, "count", "local"],
] as const
const resultRows: Record<Exclude<DnaReleaseEvidenceArtifact["kind"], "test_manifest">, unknown[]> = {
  row_results: [boundRow("row_results", "row-result.001", {
    testId: "determinism.synthetic.001", caseId: "case.synthetic.001",
    expectedSha256: digest("stable-output"), actualSha256: digest("stable-output"),
    errorCount: 0,
  })],
  category_results: [boundRow("category_results", "category-result.001", {
    categoryId: "release.synthetic.all", totalCount: 100, passCount: 100,
    failCount: 0, blockedCount: 0, notRunCount: 0,
  })],
  security_results: securityChecks.map((check, index) => boundRow(
    "security_results", `security-result.${String(index + 1).padStart(2, "0")}`,
    { testId: `security.${check}`, check, executedCount: 1, findingCount: 0 },
  )),
  cross_account_results: crossAccountScenarios.map((scenario, index) => boundRow(
    "cross_account_results", `cross-account-result.${String(index + 1).padStart(2, "0")}`,
    {
      testId: `privacy.${scenario}`, scenario, attemptCount: 2,
      expectedDenialCount: 2, actualDenialCount: 2,
      crossAccountLeakCount: 0, piiLeakCount: 0, unexpectedStatusCount: 0,
    },
  )),
  performance_results: performanceRows.map(([
    metric, observedValue, sampleCount, unit, environment,
  ], index) => boundRow(
    "performance_results", `performance-result.${String(index + 1).padStart(2, "0")}`,
    {
      testId: `performance.${metric}`, metric, observedValue, sampleCount, unit, environment,
      measurementArtifactSha256: digest(`measurement:${metric}`),
    },
  )),
  marketing_evidence: [],
}
const categoryArtifactPath = "artifact-03-category_results.jsonl"
const categoryArtifactContent = resultRows.category_results
  .map((row) => JSON.stringify(row)).join("\n") + "\n"
const categoryArtifact = {
  id: "artifact.03.category_results",
  kind: "category_results" as const,
  sha256: digest(categoryArtifactContent),
  rowCount: resultRows.category_results.length,
  status: "pass" as const,
  path: categoryArtifactPath,
  format: "jsonl" as const,
}
const marketingMetric = Object.freeze({
  evaluationClass: "category_results" as const,
  metricId: "release:category_results:category-result.001:canonical_ratio",
  numerator: 100,
  denominator: 100,
  value: 1,
})
const syntheticMarketingManifest: DnaMarketingEvidenceManifest = Object.freeze({
  schemaVersion: DNA_MARKETING_EVIDENCE_MANIFEST_VERSION,
  manifestId: "dna-marketing-evidence.synthetic-release",
  releaseStatus: "ready",
  v3ReleaseReady: true,
  claims: Object.freeze([Object.freeze({
    claimId: "marketing.synthetic.release-category",
    publicTextTr: "Belirtilen kilitli testte 100/100 başarı",
    claimType: "performance" as const,
    engineVersion: syntheticRelease.engineVersion,
    catalogVersion: "dna-v3-claim-passage-graph@1",
    evaluationClass: marketingMetric.evaluationClass,
    releaseId: syntheticRelease.releaseId,
    packageSha256: syntheticRelease.packageSha256,
    gitSha: syntheticRelease.gitSha,
    evaluationRunId: syntheticRelease.runId,
    metricId: marketingMetric.metricId,
    evidenceArtifact: categoryArtifact.path,
    evidenceArtifactSha256: categoryArtifact.sha256,
    numerator: marketingMetric.numerator,
    denominator: marketingMetric.denominator,
    value: marketingMetric.value,
    confidenceInterval: null,
    conditions: Object.freeze(["Yalnız sealed sentetik release fixture'ı"]),
    knownLimitations: Object.freeze(["Bağımsız klinik validasyon değildir"]),
    validFrom: "2026-07-20T00:00:00.000Z",
    status: "active" as const,
  })]),
  knownBlocks: Object.freeze([]),
})
const syntheticMarketingManifestContentSha256 =
  dnaMarketingEvidenceManifestContentSha256(syntheticMarketingManifest)
resultRows.marketing_evidence = [boundRow("marketing_evidence", "marketing-link.001", {
  manifestId: syntheticMarketingManifest.manifestId,
  manifestContentSha256: syntheticMarketingManifestContentSha256,
  claimId: syntheticMarketingManifest.claims[0]!.claimId,
  claimSha256: dnaReleaseMarketingClaimBindingSha256({
    manifestId: syntheticMarketingManifest.manifestId,
    manifestContentSha256: syntheticMarketingManifestContentSha256,
    claimId: syntheticMarketingManifest.claims[0]!.claimId,
    evidenceArtifactId: categoryArtifact.id,
    evidenceArtifactKind: categoryArtifact.kind,
    evidenceArtifactPath: categoryArtifact.path,
    evidenceArtifactSha256: categoryArtifact.sha256,
    evidenceRecordId: "category-result.001",
    metric: marketingMetric,
  }),
  evidenceArtifactId: categoryArtifact.id,
  evidenceArtifactKind: categoryArtifact.kind,
  evidenceArtifactPath: categoryArtifact.path,
  evidenceArtifactSha256: categoryArtifact.sha256,
  evidenceRecordId: "category-result.001",
})]
const manifestRows = (Object.keys(resultRows) as Array<keyof typeof resultRows>).map(
  (targetKind, index) => boundRow(
    "test_manifest", `manifest-target.${String(index + 1).padStart(2, "0")}`,
    {
      suite: `release-suite.${targetKind}`, targetKind,
      targetRowCount: resultRows[targetKind].length, required: true,
      packageCounts: syntheticRelease.packageCounts,
    },
  ),
)
const artifactRows: Record<DnaReleaseEvidenceArtifact["kind"], unknown[]> = {
  test_manifest: manifestRows,
  ...resultRows,
}
const artifactContents = new Map<string, string>()
const artifacts = artifactKinds.map((kind, index) => {
  const rows = artifactRows[kind]
  const rowCount = rows.length
  const path = `artifact-${String(index + 1).padStart(2, "0")}-${kind}.jsonl`
  const content = rows.map((row) => JSON.stringify(row)).join("\n") + "\n"
  artifactContents.set(path, content)
  writeFileSync(join(evidenceRoot, path), content, "utf8")
  return {
    id: `artifact.${String(index + 1).padStart(2, "0")}.${kind}`,
    kind,
    sha256: digest(content),
    rowCount,
    status: "pass" as const,
    path,
    format: "jsonl" as const,
  }
})
const evidenceBundle = createDnaReleaseEvidenceBundle({
  schemaVersion: "dna-release-evidence-bundle@1",
  releaseId: syntheticRelease.releaseId,
  createdAt: "2026-07-20T00:00:00.000Z",
  gitSha: syntheticRelease.gitSha,
  engine: {
    version: syntheticRelease.engineVersion,
    sourceCodeSha256: syntheticRelease.engineSourceCodeSha256,
  },
  catalog: {
    version: "dna-v3-claim-passage-graph@1",
    runtimePackVersion: syntheticRelease.runtimePackVersion,
    packageSha256: syntheticRelease.packageSha256,
    sourceCutoffDate: "2026-07-20",
    counts: {
      sources: 2,
      passages: 2,
      claims: 2,
      claimPassageLinks: 2,
      relations: 1,
      includedRecords: 7,
      excludedRecords: 3,
    },
  },
  dnaBook: {
    status: "owner_approved",
    version: "dna-owner-book@1",
    approvalSha256: digest("book-approval"),
  },
  artifacts,
  knownLimitations: ["synthetic_fixture_only"],
  openConflicts: [],
  quarantinedSourceIds: ["source.quarantined.fixture"],
  marketingEvidence: {
    manifestSha256: artifacts.find((artifact) =>
      artifact.kind === "marketing_evidence")!.sha256,
    claimCount: 1,
    unsupportedClaimCount: 0,
  },
  rollbackTarget: {
    runtimeMode: "v2",
    engineVersion: "dna-chat-engine@2",
    gitSha: DNA_V2_ROLLBACK_TARGET.gitSha,
    gitTag: DNA_V2_ROLLBACK_TARGET.gitTag,
    deploymentId: null,
  },
})
assert.equal(validateDnaReleaseEvidenceBundle(evidenceBundle), true)
assert.equal(Object.isFrozen(evidenceBundle), true)
assert.equal(Object.isFrozen(evidenceBundle.artifacts), true)
assert.equal(validateDnaReleaseEvidenceBundle({
  ...evidenceBundle,
  gitSha: "2".repeat(40),
}), false, "Her payload değişikliği bundle hash'ini geçersiz kılmalı")
assert.equal(DNA_CURRENT_V3_RELEASE_EVIDENCE_BUNDLE, null,
  "Gerçek test kanıtı yokken current evidence bundle uydurulmamalı")
const artifactVerification = verifyDnaReleaseEvidenceBundleArtifacts({
  bundle: evidenceBundle,
  evidenceRoot,
})
assert.equal(validateDnaReleaseEvidenceArtifactVerification(artifactVerification), true)
assert.equal(artifactVerification.valid, true)
assert.equal(artifactVerification.rows.every((row) => row.status === "pass"), true)

const firstArtifact = evidenceBundle.artifacts[0]!
writeFileSync(join(evidenceRoot, firstArtifact.path), "{\"tampered\":true}\n", "utf8")
const tamperedArtifactVerification = verifyDnaReleaseEvidenceBundleArtifacts({
  bundle: evidenceBundle,
  evidenceRoot,
})
assert.equal(tamperedArtifactVerification.valid, false)
assert.equal(tamperedArtifactVerification.rows[0]?.status, "hash_mismatch")
writeFileSync(join(evidenceRoot, firstArtifact.path), artifactContents.get(firstArtifact.path)!, "utf8")

unlinkSync(join(evidenceRoot, firstArtifact.path))
const missingArtifactVerification = verifyDnaReleaseEvidenceBundleArtifacts({
  bundle: evidenceBundle,
  evidenceRoot,
})
assert.equal(missingArtifactVerification.valid, false)
assert.equal(missingArtifactVerification.rows[0]?.status, "missing")
writeFileSync(join(evidenceRoot, firstArtifact.path), artifactContents.get(firstArtifact.path)!, "utf8")

const { bundleSha256: _bundleSha256, ...evidencePayload } = evidenceBundle
const wrongRowCountBundle = createDnaReleaseEvidenceBundle({
  ...evidencePayload,
  artifacts: evidenceBundle.artifacts.map((artifact, index) => index === 0
    ? { ...artifact, rowCount: artifact.rowCount + 1 }
    : artifact),
})
const wrongRowCountVerification = verifyDnaReleaseEvidenceBundleArtifacts({
  bundle: wrongRowCountBundle,
  evidenceRoot,
})
assert.equal(wrongRowCountVerification.valid, false)
assert.equal(wrongRowCountVerification.rows[0]?.status, "row_count_mismatch")

assert.throws(() => createDnaReleaseEvidenceBundle({
  ...evidencePayload,
  rollbackTarget: { ...evidencePayload.rollbackTarget, gitSha: "2".repeat(40) },
}), /dna_release_evidence_bundle_invalid/,
"Rollback SHA yalnız sabit ve doğrulanmış V2 hedefi olmalı")
assert.throws(() => createDnaReleaseEvidenceBundle({
  ...evidencePayload,
  rollbackTarget: { ...evidencePayload.rollbackTarget, gitTag: "dna-v2-unverified" },
}), /dna_release_evidence_bundle_invalid/,
"Rollback etiketi yalnız sabit ve doğrulanmış V2 hedefi olmalı")
assert.throws(() => createDnaReleaseEvidenceBundle({
  ...evidencePayload,
  marketingEvidence: {
    ...evidencePayload.marketingEvidence,
    manifestSha256: "1".repeat(64),
  },
}), /dna_release_evidence_bundle_invalid/,
"Bundle içindeki manifest hash'i gerçek marketing_evidence artifact hash'ine bağlanmalı")

const greenSignals: DnaReleaseHardNoGoSignals = {
  v3PackageCounts: { sources: 2, passages: 2, claims: 2, claimPassageLinks: 2 },
  evaluationAttestationValid: true,
  crossAccountLeakCount: 0,
  piiLeakCount: 0,
  criticalSafetyClinicalAnswerCount: 0,
  unreportedCaseFindingCount: 0,
  uncitedMaterialClaimCount: 0,
  fabricatedOrWrongSourceCount: 0,
  liveClaimWithoutPassageCount: 0,
  metadataOnlySourceUseCount: 0,
  activeRetractedSourceCount: 0,
  licenseViolationCount: 0,
  auditFailOpenCount: 0,
  pendingContentPublishedCount: 0,
  lockedBenchmarkIntegrityValid: true,
  criticalUxWarningMissingCount: 0,
  killSwitchConfigured: true,
  marketingClaimsWithoutEvidenceCount: 0,
}
assert.deepEqual(evaluateDnaReleaseHardNoGo({
  evidenceBundle,
  artifactVerification,
  signals: greenSignals,
}), {
  schemaVersion: "dna-release-hard-no-go@1",
  allowed: true,
  decision: "go",
  blockCodes: [],
})
const signalCases: Array<[Partial<DnaReleaseHardNoGoSignals>, string]> = [
  [{ evaluationAttestationValid: false }, "evaluation_attestation_missing_or_invalid"],
  [{ crossAccountLeakCount: 1 }, "cross_account_or_pii_leak"],
  [{ piiLeakCount: 1 }, "cross_account_or_pii_leak"],
  [{ criticalSafetyClinicalAnswerCount: 1 }, "critical_safety_clinical_answer"],
  [{ unreportedCaseFindingCount: 1 }, "unreported_case_finding"],
  [{ uncitedMaterialClaimCount: 1 }, "uncited_material_claim"],
  [{ fabricatedOrWrongSourceCount: 1 }, "fabricated_or_wrong_source"],
  [{ liveClaimWithoutPassageCount: 1 }, "live_claim_without_passage"],
  [{ metadataOnlySourceUseCount: 1 }, "metadata_only_source_used"],
  [{ activeRetractedSourceCount: 1 }, "active_retracted_source"],
  [{ licenseViolationCount: 1 }, "license_violation"],
  [{ auditFailOpenCount: 1 }, "audit_fail_open"],
  [{ pendingContentPublishedCount: 1 }, "pending_content_published"],
  [{ lockedBenchmarkIntegrityValid: false }, "locked_benchmark_integrity_broken"],
  [{ criticalUxWarningMissingCount: 1 }, "critical_ux_warning_missing"],
  [{ killSwitchConfigured: false }, "rollback_or_kill_switch_missing"],
  [{ marketingClaimsWithoutEvidenceCount: 1 }, "marketing_claim_without_evidence"],
]
for (const [override, expected] of signalCases) {
  const decision = evaluateDnaReleaseHardNoGo({
    evidenceBundle,
    artifactVerification,
    signals: { ...greenSignals, ...override },
  })
  assert.equal(decision.allowed, false)
  assert.ok(decision.blockCodes.includes(expected as never), expected)
}
const crossAccountArtifact = evidenceBundle.artifacts.find((artifact) =>
  artifact.kind === "cross_account_results")!
const crossAccountRows = artifactContents.get(crossAccountArtifact.path)!
  .trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>)
crossAccountRows[0] = { ...crossAccountRows[0], crossAccountLeakCount: 1 }
const redCrossAccountContent = crossAccountRows.map((row) => JSON.stringify(row)).join("\n") + "\n"
writeFileSync(join(evidenceRoot, crossAccountArtifact.path), redCrossAccountContent, "utf8")
const redCrossAccountBundle = createDnaReleaseEvidenceBundle({
  ...evidencePayload,
  artifacts: evidenceBundle.artifacts.map((artifact) => artifact.id === crossAccountArtifact.id
    ? { ...artifact, sha256: digest(redCrossAccountContent), status: "fail" as const }
    : artifact),
})
const redCrossAccountVerification = verifyDnaReleaseEvidenceBundleArtifacts({
  bundle: redCrossAccountBundle,
  evidenceRoot,
})
assert.equal(redCrossAccountVerification.valid, true,
  "Kırmızı sonuç dosyası yapısal olarak doğrulanıp derived sinyale dönüşebilmeli")
const redCrossAccountDecision = evaluateDnaReleaseHardNoGo({
  evidenceBundle: redCrossAccountBundle,
  artifactVerification: redCrossAccountVerification,
  signals: greenSignals,
})
assert.ok(redCrossAccountDecision.blockCodes.includes("cross_account_or_pii_leak"),
  "Caller greenSignals artifactteki gerçek sızıntıyı örtememeli")
assert.ok(redCrossAccountDecision.blockCodes.includes("required_evidence_artifact_not_passed"))
const forgedPassBundle = createDnaReleaseEvidenceBundle({
  ...evidencePayload,
  artifacts: evidenceBundle.artifacts.map((artifact) => artifact.id === crossAccountArtifact.id
    ? { ...artifact, sha256: digest(redCrossAccountContent), status: "pass" as const }
    : artifact),
})
const forgedPassVerification = verifyDnaReleaseEvidenceBundleArtifacts({
  bundle: forgedPassBundle,
  evidenceRoot,
})
assert.equal(forgedPassVerification.valid, false)
assert.equal(forgedPassVerification.rows.find((row) =>
  row.id === crossAccountArtifact.id)?.status, "content_status_mismatch",
"Descriptor pass, kırmızı satırların sonucunu yeşile çevirememeli")
writeFileSync(
  join(evidenceRoot, crossAccountArtifact.path),
  artifactContents.get(crossAccountArtifact.path)!,
  "utf8",
)
assert.ok(evaluateDnaReleaseHardNoGo({
  evidenceBundle,
  artifactVerification,
  signals: { ...greenSignals, v3PackageCounts: { ...greenSignals.v3PackageCounts, claims: 0 } },
}).blockCodes.includes("release_bundle_runtime_counts_mismatch"),
"Caller sayımı sealed artifact sayımını geçersiz kılamamalı")
assert.ok(evaluateDnaReleaseHardNoGo({
  evidenceBundle: null,
  artifactVerification: null,
  signals: { ...greenSignals, v3PackageCounts: { sources: 0, passages: 0, claims: 0, claimPassageLinks: 0 } },
}).blockCodes.includes("v3_runtime_package_empty"))
assert.ok(evaluateDnaReleaseHardNoGo({
  evidenceBundle,
  artifactVerification,
  signals: {
    ...greenSignals,
    v3PackageCounts: { ...greenSignals.v3PackageCounts, sources: 3 },
  },
}).blockCodes.includes("release_bundle_runtime_counts_mismatch"),
"Runtime paket sayıları sealed bundle ile birebir eşleşmeli")
for (const failedVerification of [
  null,
  tamperedArtifactVerification,
  missingArtifactVerification,
  wrongRowCountVerification,
]) {
  assert.ok(evaluateDnaReleaseHardNoGo({
    evidenceBundle: failedVerification === wrongRowCountVerification
      ? wrongRowCountBundle
      : evidenceBundle,
    artifactVerification: failedVerification,
    signals: greenSignals,
  }).blockCodes.includes("evidence_artifact_files_unverified"))
}
assert.ok(evaluateCurrentDnaV3ReleaseHardNoGo().blockCodes
  .includes("release_evidence_missing_or_invalid"))
assert.ok(evaluateCurrentDnaV3ReleaseHardNoGo().blockCodes
  .includes("release_signal_missing_or_invalid"))
rmSync(evidenceRoot, { recursive: true, force: true })

assert.deepEqual(readDnaRuntimeReleaseConfiguration({}), {
  schemaVersion: "dna-runtime-release-mode@1",
  mode: "v2",
  modeSource: "safe_default",
  killSwitchActive: false,
  rolloutPercent: 0,
  valid: true,
  blockCode: null,
})
assert.equal(readDnaRuntimeReleaseConfiguration({
  [DNA_CHAT_RUNTIME_RELEASE_ENV]: "v3-typo",
}).blockCode, "runtime_release_mode_invalid")
assert.equal(readDnaRuntimeReleaseConfiguration({
  [DNA_CHAT_RUNTIME_RELEASE_ENV]: "v3",
  [DNA_CHAT_V3_KILL_SWITCH_ENV]: "yes",
}).blockCode, "kill_switch_value_invalid")
assert.equal(readDnaRuntimeReleaseConfiguration({
  [DNA_CHAT_RUNTIME_RELEASE_ENV]: "v3",
  [DNA_CHAT_V3_ROLLOUT_PERCENT_ENV]: "101",
}).blockCode, "rollout_percent_invalid")
const syntheticV3Config = readDnaRuntimeReleaseConfiguration({
  [DNA_CHAT_RUNTIME_RELEASE_ENV]: "v3",
  [DNA_CHAT_V3_ROLLOUT_PERCENT_ENV]: "100",
})
assert.equal(decideDnaRuntimeReleaseExecution({
  configuration: syntheticV3Config,
  v3ReleaseAvailable: true,
  releaseHardNoGoAllowed: true,
  deploymentAuthorized: true,
  rolloutStageAuthorized: true,
  packageSha256: digest("package"),
}).execution, "v3")
assert.equal(decideDnaRuntimeReleaseExecution({
  configuration: syntheticV3Config,
  v3ReleaseAvailable: true,
  releaseHardNoGoAllowed: true,
  deploymentAuthorized: false,
  rolloutStageAuthorized: true,
  packageSha256: digest("package"),
}).reason, "deployment_not_authorized",
"Production promotion receipt olmadan V3 runtime açılamamalı")
assert.equal(decideDnaRuntimeReleaseExecution({
  configuration: syntheticV3Config,
  v3ReleaseAvailable: true,
  releaseHardNoGoAllowed: true,
  deploymentAuthorized: true,
  rolloutStageAuthorized: false,
  packageSha256: digest("package"),
}).reason, "rollout_stage_not_authorized")
assert.equal(decideDnaRuntimeReleaseExecution({
  configuration: syntheticV3Config,
  v3ReleaseAvailable: true,
  releaseHardNoGoAllowed: false,
  deploymentAuthorized: true,
  rolloutStageAuthorized: true,
  packageSha256: digest("package"),
}).execution, "blocked")
const currentV3Decision = decideDnaRuntimeReleaseExecution({
  configuration: syntheticV3Config,
  v3ReleaseAvailable: false,
  releaseHardNoGoAllowed: evaluateCurrentDnaV3ReleaseHardNoGo().allowed,
  deploymentAuthorized: false,
  rolloutStageAuthorized: false,
  packageSha256: digest("current-empty-v3-package"),
})
assert.equal(currentV3Decision.execution, "blocked")
assert.equal(currentV3Decision.reason, "release_no_go")
const hybridConfig = readDnaRuntimeReleaseConfiguration({
  [DNA_CHAT_RUNTIME_RELEASE_ENV]: "hybrid-v3",
  [DNA_CHAT_V3_ROLLOUT_PERCENT_ENV]: "100",
})
assert.equal(decideDnaRuntimeReleaseExecution({
  configuration: hybridConfig,
  v3ReleaseAvailable: true,
  releaseHardNoGoAllowed: true,
  deploymentAuthorized: true,
  rolloutStageAuthorized: true,
  packageSha256: digest("package"),
}).execution, "hybrid_v3")
const partialRolloutConfig = readDnaRuntimeReleaseConfiguration({
  [DNA_CHAT_RUNTIME_RELEASE_ENV]: "hybrid-v3",
  [DNA_CHAT_V3_ROLLOUT_PERCENT_ENV]: "25",
})
assert.equal(decideDnaRuntimeReleaseExecution({
  configuration: partialRolloutConfig,
  v3ReleaseAvailable: true,
  releaseHardNoGoAllowed: true,
  deploymentAuthorized: true,
  rolloutStageAuthorized: true,
  packageSha256: digest("package"),
}).reason, "rollout_subject_required")
assert.notEqual(decideDnaRuntimeReleaseExecution({
  configuration: partialRolloutConfig,
  v3ReleaseAvailable: true,
  releaseHardNoGoAllowed: true,
  deploymentAuthorized: true,
  rolloutStageAuthorized: true,
  packageSha256: digest("package"),
  rolloutSubjectKey: "synthetic-owner-a",
}).execution, "blocked", "Owner bucket bulunan kısmi rollout vaka yolunu bloklamamalı")
const killConfig = readDnaRuntimeReleaseConfiguration({
  [DNA_CHAT_RUNTIME_RELEASE_ENV]: "v3",
  [DNA_CHAT_V3_KILL_SWITCH_ENV]: "1",
  [DNA_CHAT_V3_ROLLOUT_PERCENT_ENV]: "100",
})
assert.equal(decideDnaRuntimeReleaseExecution({
  configuration: killConfig,
  v3ReleaseAvailable: false,
  releaseHardNoGoAllowed: false,
  deploymentAuthorized: false,
  rolloutStageAuthorized: false,
  packageSha256: digest("package"),
}).reason, "kill_switch_v2_rollback")
for (const malformedButKilled of [
  readDnaRuntimeReleaseConfiguration({
    [DNA_CHAT_RUNTIME_RELEASE_ENV]: "v3-typo",
    [DNA_CHAT_V3_KILL_SWITCH_ENV]: "1",
  }),
  readDnaRuntimeReleaseConfiguration({
    [DNA_CHAT_RUNTIME_RELEASE_ENV]: "v3",
    [DNA_CHAT_V3_KILL_SWITCH_ENV]: "1",
    [DNA_CHAT_V3_ROLLOUT_PERCENT_ENV]: "101",
  }),
]) {
  assert.equal(decideDnaRuntimeReleaseExecution({
    configuration: malformedButKilled,
    v3ReleaseAvailable: false,
    releaseHardNoGoAllowed: false,
    deploymentAuthorized: false,
    rolloutStageAuthorized: false,
    packageSha256: digest("package"),
  }).reason, "kill_switch_v2_rollback")
}

const verificationRoot = mkdtempSync(join(tmpdir(), "dna-v3-deployment-evidence-"))
const previewRunId = "preview-run.synthetic.001"
const previewDeploymentPath = "preview-deployment.json"
const previewVerifiedAt = "2026-07-20T01:00:00.000Z"
const previewDeploymentRecord = {
  schemaVersion: DNA_PREVIEW_DEPLOYMENT_ARTIFACT_VERSION,
  runId: previewRunId,
  deploymentId: "preview.synthetic.001",
  origin: "https://synthetic-preview.example.test",
  deploymentState: "READY" as const,
  gitSha: "1".repeat(40),
  packageSha256: digest("package"),
  runtimeMode: "hybrid-v3" as const,
  verifiedAt: previewVerifiedAt,
}
const previewDeploymentContent = `${JSON.stringify(previewDeploymentRecord)}\n`
writeFileSync(join(verificationRoot, previewDeploymentPath), previewDeploymentContent, "utf8")
const previewArtifactSha256 = digest(previewDeploymentContent)
const previewCheckArtifacts = DNA_REQUIRED_PREVIEW_CHECKS.map((id) => {
  const path = `preview-check-${id}.json`
  const content = `${JSON.stringify({
    schemaVersion: DNA_PREVIEW_CHECK_ARTIFACT_VERSION,
    runId: previewRunId,
    checkId: id,
    status: "pass",
    deploymentId: previewDeploymentRecord.deploymentId,
    origin: previewDeploymentRecord.origin,
    gitSha: previewDeploymentRecord.gitSha,
    packageSha256: previewDeploymentRecord.packageSha256,
    previewArtifactSha256,
    verifiedAt: previewVerifiedAt,
  })}\n`
  writeFileSync(join(verificationRoot, path), content, "utf8")
  return { id, path, evidenceSha256: digest(content) }
})
const previewArtifacts = {
  evidenceRoot: verificationRoot,
  runId: previewRunId,
  deploymentArtifactPath: previewDeploymentPath,
  checkArtifacts: previewCheckArtifacts.map(({ id, path }) => ({ id, path })),
}
const previewManifest = createDnaPreviewVerificationManifest({
  schemaVersion: "dna-preview-verification@1",
  previewDeploymentId: "preview.synthetic.001",
  previewArtifactSha256,
  previewUrlOrigin: "https://synthetic-preview.example.test",
  deploymentState: "READY",
  verifiedAt: previewVerifiedAt,
  gitSha: "1".repeat(40),
  localPackageSha256: digest("package"),
  previewPackageSha256: digest("package"),
  evidenceBundleSha256: evidenceBundle.bundleSha256,
  evaluationAttestationSha256: digest("evaluation-attestation"),
  runtimeMode: "hybrid-v3",
  checks: previewCheckArtifacts.map(({ id, evidenceSha256 }) => ({
    id, status: "pass" as const, evidenceSha256,
  })),
})
assert.equal(validateDnaPreviewVerificationManifest(previewManifest), true)
assert.equal(verifyDnaPreviewVerificationArtifacts({
  manifest: previewManifest,
  artifacts: previewArtifacts,
}).valid, true)
const { publicKey: liveObservationPublicKey, privateKey: liveObservationPrivateKey } =
  generateKeyPairSync("ed25519")
const liveObservationTrustRoot = {
  schemaVersion: DNA_EXTERNAL_LIVE_OBSERVATION_TRUST_ROOT_VERSION,
  keyId: "release-observer.synthetic.001",
  algorithm: "Ed25519" as const,
  environment: "both" as const,
  publicKeySpkiBase64: liveObservationPublicKey.export({
    format: "der",
    type: "spki",
  }).toString("base64"),
  validFrom: "2026-07-19T00:00:00.000Z",
  validUntil: "2026-07-21T00:00:00.000Z",
}
const previewAggregateHashes = deriveDnaExternalLiveObservationAggregateHashes({
  environment: "preview",
  checks: previewManifest.checks,
})
const previewExternalPayload = {
  schemaVersion: DNA_EXTERNAL_LIVE_OBSERVATION_ATTESTATION_VERSION,
  environment: "preview" as const,
  keyId: liveObservationTrustRoot.keyId,
  runId: previewRunId,
  deploymentId: previewManifest.previewDeploymentId,
  origin: previewManifest.previewUrlOrigin,
  gitSha: previewManifest.gitSha,
  packageSha256: previewManifest.previewPackageSha256,
  verificationManifestSha256: previewManifest.manifestSha256,
  deploymentArtifactSha256: previewManifest.previewArtifactSha256,
  ...previewAggregateHashes,
  issuedAt: "2026-07-20T01:05:00.000Z",
  expiresAt: "2026-07-20T03:00:00.000Z",
}
const previewExternalAttestation = {
  ...previewExternalPayload,
  signatureBase64: sign(
    null,
    dnaExternalLiveObservationSigningBytes(previewExternalPayload),
    liveObservationPrivateKey,
  ).toString("base64"),
}
const previewExternalExpected = {
  environment: "preview" as const,
  runId: previewRunId,
  deploymentId: previewManifest.previewDeploymentId,
  origin: previewManifest.previewUrlOrigin,
  gitSha: previewManifest.gitSha,
  packageSha256: previewManifest.previewPackageSha256,
  verificationManifestSha256: previewManifest.manifestSha256,
  deploymentArtifactSha256: previewManifest.previewArtifactSha256,
  ...previewAggregateHashes,
  verificationCompletedAt: previewManifest.verifiedAt,
}
assert.equal(verifyDnaExternalLiveObservationAttestation({
  attestation: previewExternalAttestation,
  trustRoots: [liveObservationTrustRoot],
  expected: previewExternalExpected,
  now: "2026-07-20T01:30:00.000Z",
}).valid, true, "Ed25519 live-observation attestation doğrulanmalı")
assert.equal(verifyDnaRuntimePromotionReceipt({
  receipt: previewExternalAttestation,
  expectedGitSha: previewManifest.gitSha,
  expectedPackageSha256: previewManifest.previewPackageSha256,
  expectedOrigin: previewManifest.previewUrlOrigin,
  trustRoots: [liveObservationTrustRoot],
  now: "2026-07-20T01:30:00.000Z",
}).allowed, false, "Preview gözlemi production runtime yetkisine dönüşememeli")
assert.equal(verifyDnaRuntimePromotionReceipt({
  receipt: previewExternalAttestation,
  expectedGitSha: previewManifest.gitSha,
  expectedPackageSha256: digest("forged-package"),
  expectedOrigin: previewManifest.previewUrlOrigin,
  trustRoots: [liveObservationTrustRoot],
  now: "2026-07-20T01:30:00.000Z",
}).allowed, false, "Promotion receipt farklı pack için replay edilememeli")
assert.equal(verifyDnaRuntimeDeploymentAuthorization({
  expectedGitSha: previewManifest.gitSha,
  expectedPackageSha256: previewManifest.previewPackageSha256,
  environment: {
    [DNA_VERCEL_ENV]: "preview",
    [DNA_VERCEL_GIT_COMMIT_SHA_ENV]: previewManifest.gitSha,
    [DNA_VERCEL_URL_ENV]: "synthetic-preview.example.test",
  },
  trustRoots: [],
}).allowed, true, "Vercel preview exact candidate doğrulamasını çalıştırabilmeli")
assert.equal(verifyDnaRuntimeDeploymentAuthorization({
  expectedGitSha: previewManifest.gitSha,
  expectedPackageSha256: previewManifest.previewPackageSha256,
  environment: {
    [DNA_VERCEL_ENV]: "preview",
    [DNA_VERCEL_GIT_COMMIT_SHA_ENV]: "2".repeat(40),
    [DNA_VERCEL_URL_ENV]: "synthetic-preview.example.test",
  },
  trustRoots: [],
}).allowed, false, "Farklı commitli preview aday ortamı V3'ü açmamalı")
assert.equal(verifyDnaRuntimeDeploymentAuthorization({
  expectedGitSha: previewManifest.gitSha,
  expectedPackageSha256: previewManifest.previewPackageSha256,
  environment: {
    [DNA_VERCEL_ENV]: "production",
    [DNA_VERCEL_URL_ENV]: "synthetic-production.example.test",
    [DNA_CHAT_PRODUCTION_PROMOTION_RECEIPT_ENV]: Buffer.from(
      JSON.stringify(previewExternalAttestation), "utf8",
    ).toString("base64"),
  },
  trustRoots: [],
  now: "2026-07-20T01:30:00.000Z",
}).allowed, false,
"Caller/test anahtarı committed trust root olmadan production runtime açmamalı")
assert.equal(evaluateCurrentDnaRuntimeDeploymentAuthorization.length, 0)
assert.equal(evaluateCurrentDnaRuntimeDeploymentAuthorization().allowed, false,
  "Current release bundle/receipt yokken runtime deployment yetkisi fail-closed kalmalı")
assert.equal(verifyDnaExternalLiveObservationAttestation({
  attestation: previewExternalAttestation,
  trustRoots: [liveObservationTrustRoot],
  expected: { ...previewExternalExpected, packageSha256: digest("forged-package") },
  now: "2026-07-20T01:30:00.000Z",
}).valid, false, "İmzalı gözlem farklı pack'e taşınamamalı")
assert.equal(DNA_CURRENT_EXTERNAL_LIVE_OBSERVATION_TRUST_ROOTS.length, 0,
  "Kurumsal release observer public key'i onaylanmadan action-facing promotion kapalı kalmalı")
const promotionInput = {
  previewManifest,
  expectedGitSha: "1".repeat(40),
  expectedPackageSha256: digest("package"),
  expectedEvidenceBundleSha256: evidenceBundle.bundleSha256,
  expectedEvaluationAttestationSha256: digest("evaluation-attestation"),
  releaseHardNoGoAllowed: true,
  previewArtifacts,
  externalLiveObservationAttestation: previewExternalAttestation,
  request: {
    method: "promote_existing_preview" as const,
    previewDeploymentId: previewManifest.previewDeploymentId,
    previewArtifactSha256: previewManifest.previewArtifactSha256,
  },
}
assert.equal(evaluateDnaPreviewPromotion(promotionInput).allowed, false)
assert.ok(evaluateDnaPreviewPromotion(promotionInput).blockCodes
  .includes("preview_external_live_observation_missing_or_invalid"),
"Elle yazılmış pass JSON ve test anahtarı committed kurum trust root'u olmadan promotion açmamalı")
assert.ok(evaluateDnaPreviewPromotion({
  ...promotionInput,
  previewArtifacts: null,
}).blockCodes.includes("preview_artifact_evidence_missing_or_invalid"),
"Salt manifest ve rastgele hash gerçek preview artefaktı olmadan promotion açmamalı")
assert.ok(evaluateDnaPreviewPromotion({
  ...promotionInput,
  request: { ...promotionInput.request, method: "new_build" },
}).blockCodes.includes("new_build_promotion_forbidden"))
assert.ok(evaluateDnaPreviewPromotion({
  ...promotionInput,
  releaseHardNoGoAllowed: false,
}).blockCodes.includes("release_hard_no_go"))
assert.ok(evaluateDnaPreviewPromotion({
  ...promotionInput,
  previewManifest: null,
}).blockCodes.includes("preview_manifest_missing_or_invalid"))
assert.equal(DNA_CURRENT_V3_PREVIEW_VERIFICATION_MANIFEST, null)

const productionRunId = "production-run.synthetic.001"
const productionOrigin = "https://synthetic-production.example.test"
const productionDeploymentPath = "production-deployment.json"
const productionVerifiedAt = "2026-07-20T02:00:00.000Z"
const productionDeploymentRecord = {
  schemaVersion: DNA_PRODUCTION_DEPLOYMENT_ARTIFACT_VERSION,
  runId: productionRunId,
  deploymentId: "production.synthetic.001",
  origin: productionOrigin,
  gitSha: previewManifest.gitSha,
  packageSha256: previewManifest.previewPackageSha256,
  promotedPreviewDeploymentId: previewManifest.previewDeploymentId,
  promotedPreviewArtifactSha256: previewManifest.previewArtifactSha256,
  promotionMethod: "promote_existing_preview" as const,
  verifiedAt: productionVerifiedAt,
}
const productionDeploymentContent = `${JSON.stringify(productionDeploymentRecord)}\n`
writeFileSync(join(verificationRoot, productionDeploymentPath), productionDeploymentContent, "utf8")
const productionArtifactSha256 = digest(productionDeploymentContent)
const productionCheckArtifacts = DNA_REQUIRED_PRODUCTION_CHECKS.map((id) => {
  const path = `production-check-${id}.json`
  const content = `${JSON.stringify({
    schemaVersion: DNA_PRODUCTION_CHECK_ARTIFACT_VERSION,
    runId: productionRunId,
    checkId: id,
    status: "pass",
    deploymentId: productionDeploymentRecord.deploymentId,
    origin: productionOrigin,
    gitSha: productionDeploymentRecord.gitSha,
    packageSha256: productionDeploymentRecord.packageSha256,
    promotedPreviewDeploymentId: previewManifest.previewDeploymentId,
    promotedPreviewArtifactSha256: previewManifest.previewArtifactSha256,
    productionArtifactSha256,
    verifiedAt: productionVerifiedAt,
  })}\n`
  writeFileSync(join(verificationRoot, path), content, "utf8")
  return { id, path, evidenceSha256: digest(content) }
})
const productionArtifacts = {
  evidenceRoot: verificationRoot,
  runId: productionRunId,
  productionOrigin,
  deploymentArtifactPath: productionDeploymentPath,
  checkArtifacts: productionCheckArtifacts.map(({ id, path }) => ({ id, path })),
}
const productionManifest = createDnaProductionVerificationManifest({
  schemaVersion: "dna-production-verification@1",
  productionDeploymentId: "production.synthetic.001",
  promotedPreviewDeploymentId: previewManifest.previewDeploymentId,
  promotedPreviewArtifactSha256: previewManifest.previewArtifactSha256,
  promotionMethod: "promote_existing_preview",
  verifiedAt: productionVerifiedAt,
  gitSha: previewManifest.gitSha,
  packageSha256: previewManifest.previewPackageSha256,
  checks: productionCheckArtifacts.map(({ id, evidenceSha256 }) => ({
    id, status: "pass" as const, evidenceSha256,
  })),
})
assert.equal(validateDnaProductionVerificationManifest(productionManifest), true)
assert.equal(verifyDnaProductionVerificationArtifacts({
  manifest: productionManifest,
  artifacts: productionArtifacts,
}).valid, true)
const productionAggregateHashes = deriveDnaExternalLiveObservationAggregateHashes({
  environment: "production",
  checks: productionManifest.checks,
})
const productionExternalPayload = {
  schemaVersion: DNA_EXTERNAL_LIVE_OBSERVATION_ATTESTATION_VERSION,
  environment: "production" as const,
  keyId: liveObservationTrustRoot.keyId,
  runId: productionRunId,
  deploymentId: productionManifest.productionDeploymentId,
  origin: productionOrigin,
  gitSha: productionManifest.gitSha,
  packageSha256: productionManifest.packageSha256,
  verificationManifestSha256: productionManifest.manifestSha256,
  deploymentArtifactSha256: productionArtifactSha256,
  ...productionAggregateHashes,
  issuedAt: "2026-07-20T02:05:00.000Z",
  expiresAt: "2026-07-20T04:00:00.000Z",
}
const productionExternalAttestation = {
  ...productionExternalPayload,
  signatureBase64: sign(
    null,
    dnaExternalLiveObservationSigningBytes(productionExternalPayload),
    liveObservationPrivateKey,
  ).toString("base64"),
}
assert.equal(verifyDnaExternalLiveObservationAttestation({
  attestation: productionExternalAttestation,
  trustRoots: [liveObservationTrustRoot],
  expected: {
    environment: "production",
    runId: productionRunId,
    deploymentId: productionManifest.productionDeploymentId,
    origin: productionOrigin,
    gitSha: productionManifest.gitSha,
    packageSha256: productionManifest.packageSha256,
    verificationManifestSha256: productionManifest.manifestSha256,
    deploymentArtifactSha256: productionArtifactSha256,
    ...productionAggregateHashes,
    verificationCompletedAt: productionManifest.verifiedAt,
  },
  now: "2026-07-20T02:30:00.000Z",
}).valid, true)
assert.equal(verifyDnaRuntimePromotionReceipt({
  receipt: productionExternalAttestation,
  expectedGitSha: productionManifest.gitSha,
  expectedPackageSha256: productionManifest.packageSha256,
  expectedOrigin: productionOrigin,
  trustRoots: [liveObservationTrustRoot],
  now: "2026-07-20T02:30:00.000Z",
}).allowed, true,
"Yalnız production gözlemine ait imzalı exact receipt runtime yetkisi olabilmeli")
assert.equal(verifyDnaRuntimePromotionReceipt({
  receipt: productionExternalAttestation,
  expectedGitSha: productionManifest.gitSha,
  expectedPackageSha256: productionManifest.packageSha256,
  expectedOrigin: "https://another-production.example.test",
  trustRoots: [liveObservationTrustRoot],
  now: "2026-07-20T02:30:00.000Z",
}).allowed, false, "Production receipt başka origin'e replay edilememeli")
assert.equal(verifyDnaProductionDeploymentEvidence({
  productionManifest,
  previewManifest,
  previewArtifacts,
  productionArtifacts,
  previewExternalLiveObservationAttestation: previewExternalAttestation,
  productionExternalLiveObservationAttestation: productionExternalAttestation,
}).verified, false,
"Kurumsal committed trust root olmadan self-consistent synthetic production kanıtı release açmamalı")
assert.ok(verifyDnaProductionDeploymentEvidence({
  productionManifest,
  previewManifest,
  previewArtifacts,
  productionArtifacts,
  previewExternalLiveObservationAttestation: previewExternalAttestation,
  productionExternalLiveObservationAttestation: productionExternalAttestation,
}).blockCodes.includes("production_external_live_observation_missing_or_invalid"))
assert.equal(verifyDnaProductionDeploymentEvidence({
  productionManifest: null,
  previewManifest,
  previewArtifacts,
  productionArtifacts,
  previewExternalLiveObservationAttestation: previewExternalAttestation,
  productionExternalLiveObservationAttestation: productionExternalAttestation,
}).verified, false)
assert.equal(verifyDnaProductionDeploymentEvidence({
  productionManifest,
  previewManifest,
  previewArtifacts,
  productionArtifacts: null,
  previewExternalLiveObservationAttestation: previewExternalAttestation,
  productionExternalLiveObservationAttestation: productionExternalAttestation,
}).verified, false, "Gerçek production artefaktları olmadan release doğrulanmamalı")
assert.equal(DNA_CURRENT_V3_PRODUCTION_VERIFICATION_MANIFEST, null)
rmSync(verificationRoot, { recursive: true, force: true })

const rolloutPolicy = createDnaStagedRolloutPolicy({
  releaseId: evidenceBundle.releaseId,
  packageSha256: evidenceBundle.catalog.packageSha256,
  evidenceBundleSha256: evidenceBundle.bundleSha256,
  canaryQuestionIds: ["canary.safe.definition", "canary.safe.case-boundary"],
})
const healthySignalsFor = (observationCount: number) => ({
  observationCount,
  citationIntegrityViolationCount: 0,
  pendingOrRestrictedSourceReturnCount: 0,
  safetyRegressionCount: 0,
  crossAccountErrorCount: 0,
  caseAuditFailOpenCount: 0,
  packSchemaOrHashErrorCount: 0,
  unsupportedClinicalClaimCount: 0,
  baselineFiveXRate: 0.01,
  currentFiveXRate: 0.01,
})
const rolloutEvidenceRoot = mkdtempSync(join(tmpdir(), "dna-v3-rollout-evidence-"))
const writeRolloutEvidence = (input: Readonly<{
  name: string
  stageId: "preview" | "internal" | "limited" | "broad"
  observationCount: number
  completedAt: string
  format: "json" | "jsonl"
}>) => {
  const signals = healthySignalsFor(input.observationCount)
  const record = {
    schemaVersion: "dna-staged-rollout-health-evidence@1" as const,
    releaseId: rolloutPolicy.releaseId,
    packageSha256: rolloutPolicy.packageSha256,
    policySha256: rolloutPolicy.policySha256,
    stageId: input.stageId,
    observationCount: input.observationCount,
    signals,
    completedAt: input.completedAt,
  }
  const content = `${JSON.stringify(record)}\n`
  const path = `${input.name}.${input.format}`
  writeFileSync(join(rolloutEvidenceRoot, path), content, "utf8")
  return {
    authorizationEvidence: {
      stageId: input.stageId,
      signals,
      evidenceSha256: digest(content),
      completedAt: input.completedAt,
    },
    file: {
      stageId: input.stageId,
      path,
      format: input.format,
    } satisfies DnaStagedRolloutHealthEvidenceFile,
    content,
  }
}
const internalPreviewEvidence = writeRolloutEvidence({
  name: "internal-preview-health",
  stageId: "preview",
  observationCount: 0,
  completedAt: "2026-07-20T02:20:00.000Z",
  format: "json",
})
const internalAuthorization = createDnaStagedRolloutAuthorization({
  policy: rolloutPolicy,
  authorizedStageId: "internal",
  priorStageEvidence: [internalPreviewEvidence.authorizationEvidence],
  authorizedAt: "2026-07-20T02:30:00.000Z",
})
assert.equal(validateDnaStagedRolloutAuthorization(internalAuthorization, rolloutPolicy), true)
const internalEvidenceVerification = verifyDnaStagedRolloutHealthEvidence({
  policy: rolloutPolicy,
  authorization: internalAuthorization,
  evidenceRoot: rolloutEvidenceRoot,
  files: [internalPreviewEvidence.file],
})
assert.equal(internalEvidenceVerification.valid, true)
assert.equal(validateDnaStagedRolloutEvidenceVerification(
  internalEvidenceVerification,
  rolloutPolicy,
  internalAuthorization,
), true)
assert.deepEqual(internalAuthorization.priorStageEvidence.map((row) => row.stageId), ["preview"])
assert.equal(internalAuthorization.authorizedPercent, 5)
assert.equal(validateDnaStagedRolloutAuthorization({
  ...internalAuthorization,
  authorizedPercent: 100,
}, rolloutPolicy), false)
assert.throws(() => createDnaStagedRolloutAuthorization({
  policy: rolloutPolicy,
  authorizedStageId: "full",
  priorStageEvidence: [],
  authorizedAt: "2026-07-20T04:00:00.000Z",
}), /prior_stage_evidence_incomplete/,
"Önceki aşamalar atlanarak doğrudan tam yayına yetki verilememeli")
const fullEvidenceFiles = [
  ["preview", 0, "02:01:00", "json"],
  ["internal", 100, "02:30:00", "jsonl"],
  ["limited", 500, "03:00:00", "json"],
  ["broad", 1_500, "03:30:00", "jsonl"],
].map(([stageId, count, time, format]) => writeRolloutEvidence({
  name: `full-${stageId}-health`,
  stageId: stageId as "preview" | "internal" | "limited" | "broad",
  observationCount: Number(count),
  completedAt: `2026-07-20T${time}.000Z`,
  format: format as "json" | "jsonl",
}))
const fullAuthorization = createDnaStagedRolloutAuthorization({
  policy: rolloutPolicy,
  authorizedStageId: "full",
  priorStageEvidence: fullEvidenceFiles.map((row) => row.authorizationEvidence),
  authorizedAt: "2026-07-20T04:00:00.000Z",
})
assert.equal(validateDnaStagedRolloutAuthorization(fullAuthorization, rolloutPolicy), true)
const fullEvidenceVerification = verifyDnaStagedRolloutHealthEvidence({
  policy: rolloutPolicy,
  authorization: fullAuthorization,
  evidenceRoot: rolloutEvidenceRoot,
  files: fullEvidenceFiles.map((row) => row.file),
})
assert.equal(fullEvidenceVerification.valid, true)
assert.equal(fullEvidenceVerification.rows.length, 4)
assert.throws(() => verifyDnaStagedRolloutHealthEvidence({
  policy: rolloutPolicy,
  authorization: fullAuthorization,
  evidenceRoot: rolloutEvidenceRoot,
  files: fullEvidenceFiles.slice(0, 3).map((row) => row.file),
}), /evidence_files_incomplete/,
"Doğrudan tam yayın, bütün önceki aşama kanıt dosyaları olmadan doğrulanmamalı")

const tamperedRolloutFile = fullEvidenceFiles[1]!
writeFileSync(
  join(rolloutEvidenceRoot, tamperedRolloutFile.file.path),
  tamperedRolloutFile.content.replace('"crossAccountErrorCount":0', '"crossAccountErrorCount":1'),
  "utf8",
)
const tamperedRolloutVerification = verifyDnaStagedRolloutHealthEvidence({
  policy: rolloutPolicy,
  authorization: fullAuthorization,
  evidenceRoot: rolloutEvidenceRoot,
  files: fullEvidenceFiles.map((row) => row.file),
})
assert.equal(tamperedRolloutVerification.valid, false)
assert.equal(tamperedRolloutVerification.rows[1]?.status, "binding_mismatch")
writeFileSync(
  join(rolloutEvidenceRoot, tamperedRolloutFile.file.path),
  tamperedRolloutFile.content,
  "utf8",
)

const missingRolloutFile = fullEvidenceFiles[2]!
unlinkSync(join(rolloutEvidenceRoot, missingRolloutFile.file.path))
const missingRolloutVerification = verifyDnaStagedRolloutHealthEvidence({
  policy: rolloutPolicy,
  authorization: fullAuthorization,
  evidenceRoot: rolloutEvidenceRoot,
  files: fullEvidenceFiles.map((row) => row.file),
})
assert.equal(missingRolloutVerification.valid, false)
assert.equal(missingRolloutVerification.rows[2]?.status, "missing")
writeFileSync(
  join(rolloutEvidenceRoot, missingRolloutFile.file.path),
  missingRolloutFile.content,
  "utf8",
)
assert.equal(validateDnaStagedRolloutAuthorization({
  ...fullAuthorization,
  priorStageEvidence: fullAuthorization.priorStageEvidence.map((row, index) => index === 1
    ? { ...row, observationCount: 99 }
    : row),
}, rolloutPolicy), false, "Sağlık kanıtı sayısı değiştirilirse yetki geçersiz olmalı")
assert.equal(evaluateCurrentDnaStagedRolloutAuthorization({
  rolloutPercent: 5,
  packageSha256: rolloutPolicy.packageSha256,
}).allowed, false)
assert.equal(DNA_CURRENT_V3_STAGED_ROLLOUT_AUTHORIZATION, null)
assert.equal(DNA_CURRENT_V3_STAGED_ROLLOUT_EVIDENCE_VERIFICATION, null)
const healthySignals = healthySignalsFor(100)
assert.equal(evaluateDnaStagedRolloutHealth({
  policy: rolloutPolicy,
  stageId: "internal",
  signals: healthySignals,
}).action, "continue")
assert.equal(evaluateDnaStagedRolloutHealth({
  policy: rolloutPolicy,
  stageId: "limited",
  signals: healthySignals,
}).action, "hold")
const unhealthy = evaluateDnaStagedRolloutHealth({
  policy: rolloutPolicy,
  stageId: "internal",
  signals: { ...healthySignals, crossAccountErrorCount: 1 },
})
assert.equal(unhealthy.action, "rollback_v2")
assert.equal(unhealthy.rollbackEnvironment, "DNA_CHAT_RUNTIME_RELEASE=v2")
assert.ok(unhealthy.triggerCodes.includes("cross_account_error"))
assert.equal(DNA_CURRENT_V3_STAGED_ROLLOUT_POLICY, null)
rmSync(rolloutEvidenceRoot, { recursive: true, force: true })

const rollbackCommit = execFileSync(
  "git",
  ["rev-parse", `${DNA_V2_ROLLBACK_TARGET.gitTag}^{commit}`],
  { encoding: "utf8" },
).trim()
assert.equal(rollbackCommit, DNA_V2_ROLLBACK_TARGET.gitSha,
  "Rollback tag'i sabit V2 commit'ine çözülmeli")

const productionRuntimeSource = readFileSync(
  "src/lib/dna/chat/v3RetrievalServer.ts",
  "utf8",
)
assert.match(productionRuntimeSource, /readDnaRuntimeReleaseConfiguration\(\)/,
  "Server runtime her çağrıda server-side flag'i okumalı")
assert.match(productionRuntimeSource, /evaluateCurrentDnaV3ReleaseHardNoGo\(\)/,
  "Server runtime immutable evidence ve hard NO-GO kararını uygulamalı")
assert.match(productionRuntimeSource, /evaluateCurrentDnaStagedRolloutAuthorization\(\{/,
  "Server runtime committed aşama yetkisi olmadan yüzde açılımı yapmamalı")
assert.match(productionRuntimeSource, /decideDnaRuntimeReleaseExecution\(\{/,
  "Server runtime yalnız merkezi flag kararından yürütülmeli")
assert.match(productionRuntimeSource, /selection\.generation === "blocked"/,
  "Fail-closed seçim cevap üretmeden önce durmalı")

console.log("DNA release deployment governance: PASS")
console.log("Current V3 evidence bundle: absent (expected)")
console.log("Current preview verification: absent (expected)")
console.log("Current production verification: absent (expected)")
console.log("Current V3/hybrid activation: NO-GO; V2 safe default and kill-switch verified")

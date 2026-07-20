import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, relative, resolve } from "node:path"

import {
  buildDnaCountableUnitInventory,
  DNA_COUNTABLE_UNIT_DEFINITIONS,
  DNA_LONG_TERM_TARGET_ENVELOPE,
} from "../src/lib/dna/chat/operations/countableUnits"
import {
  compileDnaChatIncidentResponsePlan,
  evaluateDnaChatOperationalEnvironment,
  evaluateDnaChatOperationalSwitch,
} from "../src/lib/dna/chat/operations/incidentResponse"
import {
  DNA_CURRENT_MARKETING_EVIDENCE_MANIFEST,
  DNA_MARKETING_EVIDENCE_MANIFEST_VERSION,
  dnaMarketingEvidenceManifestContentSha256,
  validateDnaMarketingEvidenceManifest,
  validateDnaMarketingEvidenceVerification,
  verifyDnaMarketingEvidenceManifest,
  type DnaMarketingEvidenceManifest,
} from "../src/lib/dna/chat/operations/marketingEvidence"
import {
  DNA_APPROVED_CORE_PRODUCT_DEFINITION_TR,
  DNA_CONDITIONAL_SOURCE_AUDIT_LANGUAGE_TR,
  DNA_PROHIBITED_PRODUCT_PHRASES_TR,
  evaluateDnaProductLanguage,
  verifyDnaProductLanguageAgainstReleaseEvidence,
} from "../src/lib/dna/chat/operations/productLanguage"
import {
  compileDnaSourceMonitoringWorkflow,
  DNA_SOURCE_MONITORING_REQUIRED_CHECKS,
} from "../src/lib/dna/chat/operations/sourceMonitoring"
import {
  buildDnaChatTelemetryRecord,
  DNA_CHAT_TELEMETRY_ALLOWED_INPUT_KEYS,
  DNA_CHAT_TELEMETRY_DENIED_KEYS,
} from "../src/lib/dna/chat/operations/telemetry"
import {
  buildDnaChatCategoricalFeedbackRecord,
  DNA_CHAT_ISSUE_CATEGORY_LABELS_TR,
} from "../src/lib/dna/chat/operations/userFeedback"
import {
  DNA_RELEASE_EVIDENCE_ROW_VERSION,
  createDnaReleaseEvidenceBundle,
  dnaReleaseMarketingClaimBindingSha256,
  type DnaReleaseEvidenceArtifact,
} from "../src/lib/dna/chat/release/releaseEvidenceBundle"
import { DNA_V2_ROLLBACK_TARGET } from "../src/lib/dna/chat/release/runtimeReleaseMode"

const ROOT = resolve(process.cwd())
const HASH_A = "a".repeat(64)
const HASH_B = "b".repeat(64)

const safeTelemetryInput = {
  requestId: "11111111-1111-4111-8111-111111111111",
  engineVersion: "dna-chat-engine@2",
  packVersion: "dna-chat-catalog@2",
  topic: "cns.insula",
  classification: "literature",
  outcome: "answered",
  responseDepth: "standard",
  sourceIds: ["source.two", "source.one", "source.one"],
  citationCount: 2,
  latencyCategory: "lt_100ms",
  httpStatus: 200,
  auditResult: "written",
  userIssueCategory: null,
}

const telemetry = buildDnaChatTelemetryRecord(safeTelemetryInput)
assert.equal(telemetry.accepted, true)
assert.deepEqual(telemetry.record?.sourceIds, ["source.one", "source.two"])
assert.deepEqual(Object.keys(safeTelemetryInput).sort(), [...DNA_CHAT_TELEMETRY_ALLOWED_INPUT_KEYS].sort())

for (const forbiddenKey of DNA_CHAT_TELEMETRY_DENIED_KEYS) {
  const result = buildDnaChatTelemetryRecord({ ...safeTelemetryInput, [forbiddenKey]: "clinical text" })
  assert.equal(result.accepted, false, `${forbiddenKey} telemetry tarafından reddedilmeli`)
  assert.ok(result.reasonCodes.some((reason) => reason === `telemetry_denied_key:${forbiddenKey}`))
}
assert.equal(buildDnaChatTelemetryRecord({ ...safeTelemetryInput, custom: "value" }).accepted, false)
assert.equal(buildDnaChatTelemetryRecord({ ...safeTelemetryInput, topic: "çocuğun davranışı" }).accepted, false)
assert.equal(buildDnaChatTelemetryRecord({ ...safeTelemetryInput, citationCount: 3 }).accepted, false)

assert.equal(Object.keys(DNA_CHAT_ISSUE_CATEGORY_LABELS_TR).length, 8)
const feedback = buildDnaChatCategoricalFeedbackRecord({
  requestId: "11111111-1111-4111-8111-111111111111",
  category: "source_mismatch",
  sourceId: "source.insula",
})
assert.equal(feedback.accepted, true)
assert.equal(feedback.record?.containsClinicalText, false)
assert.equal(feedback.record?.automaticTrainingUse, "prohibited")
for (const textKey of ["question", "answer", "reportId", "description", "message", "caseEvidence"]) {
  assert.equal(buildDnaChatCategoricalFeedbackRecord({
    requestId: "11111111-1111-4111-8111-111111111111",
    category: "technical_error",
    [textKey]: "clinical text",
  }).accepted, false, `${textKey} feedback payload'ında reddedilmeli`)
}
assert.equal(buildDnaChatCategoricalFeedbackRecord({
  requestId: "11111111-1111-4111-8111-111111111111",
  category: "technical_error",
  sourceId: "source.insula",
}).accepted, false)
for (const disguisedClinicalIdentifier of [
  "danisan-ali-gece-uyumuyor",
  "rapor:duyusal-riskli",
  "11111111-1111-1111-1111-111111111111",
]) {
  assert.equal(buildDnaChatCategoricalFeedbackRecord({
    requestId: disguisedClinicalIdentifier,
    category: "technical_error",
  }).accepted, false, "Request ID alanı yalnız sunucunun UUID biçimini kabul etmeli")
}

const syntheticImpact = Object.freeze({
  schemaVersion: "dna-source-integrity-impact@1" as const,
  valid: true,
  reasonCodes: Object.freeze([]),
  affectedSourceIds: Object.freeze(["source.retracted"]),
  affectedPassageIds: Object.freeze(["passage.retracted"]),
  affectedClaimIds: Object.freeze(["claim.retracted"]),
  affectedRelationIds: Object.freeze(["relation.retracted"]),
  answers: Object.freeze([Object.freeze({
    answerId: "answer.retracted",
    state: "not_available" as const,
    affectedSourceIds: Object.freeze(["source.retracted"]),
    safeAlternativeSourceIds: Object.freeze([]),
  })]),
  auditSha256: HASH_A,
})

const workflow = compileDnaSourceMonitoringWorkflow({
  event: {
    eventId: "event.retraction.1",
    eventType: "retraction",
    sourceId: "source.retracted",
    detectedAt: "2026-07-20T00:00:00.000Z",
    evidenceArtifactId: "integrity-audit.synthetic-1",
    executionStatus: "synthetic_test",
  },
  dependencies: {
    impact: syntheticImpact,
    affectedBenchmarkQuestionIds: ["benchmark.1"],
    affectedMarketingClaimIds: ["marketing.1"],
    hasReleasedSafeAlternative: false,
  },
})
assert.equal(workflow.releaseDisposition, "no_go")
assert.equal(workflow.completionState, "actions_pending")
for (const requiredAction of [
  "quarantine_source",
  "quarantine_passages_and_claims",
  "exclude_from_runtime_pack",
  "switch_unsupported_answers_to_not_available",
  "rerun_affected_benchmarks",
  "suspend_affected_marketing_claims",
  "recompile_release_package",
]) {
  assert.ok(workflow.actions.some((item) => item.action === requiredAction))
}
assert.equal(DNA_SOURCE_MONITORING_REQUIRED_CHECKS.length, 8)

assert.deepEqual(evaluateDnaChatOperationalSwitch({
  globalKillSwitch: false,
  disabledRoutes: [],
  disabledPackSha256s: [],
  route: "dna-chat",
  packSha256: null,
  rollbackTarget: "deployment.known-good",
  rollbackEvidenceSha256: HASH_A,
}), {
  schemaVersion: "dna-chat-operational-switch@1",
  allowed: true,
  blockCode: null,
  rollbackReady: true,
})
assert.equal(evaluateDnaChatOperationalSwitch({
  globalKillSwitch: true,
  disabledRoutes: [],
  disabledPackSha256s: [],
  route: "dna-chat",
  packSha256: null,
  rollbackTarget: "deployment.known-good",
  rollbackEvidenceSha256: HASH_A,
}).blockCode, "global_kill_switch")
assert.equal(evaluateDnaChatOperationalSwitch({
  globalKillSwitch: false,
  disabledRoutes: ["dna-chat"],
  disabledPackSha256s: [],
  route: "dna-chat",
  packSha256: null,
  rollbackTarget: null,
  rollbackEvidenceSha256: null,
}).blockCode, "rollback_evidence_missing")
assert.equal(evaluateDnaChatOperationalEnvironment({
  environment: {},
  route: "dna-chat",
  packSha256: null,
}).allowed, true)
assert.equal(evaluateDnaChatOperationalEnvironment({
  environment: { DNA_CHAT_OPERATIONS_KILL_SWITCH: "1" },
  route: "dna-chat",
  packSha256: null,
}).blockCode, "global_kill_switch")
assert.equal(evaluateDnaChatOperationalEnvironment({
  environment: { DNA_CHAT_DISABLED_ROUTES: "dna-chat-feedback" },
  route: "dna-chat-feedback",
  packSha256: null,
}).blockCode, "route_disabled")
assert.equal(evaluateDnaChatOperationalEnvironment({
  environment: { DNA_CHAT_OPERATIONS_KILL_SWITCH: "yes" },
  route: "dna-chat",
  packSha256: null,
}).blockCode, "operational_configuration_invalid")

const incident = compileDnaChatIncidentResponsePlan({
  incidentId: "incident.cross-account.1",
  trigger: "cross_account_access",
  observedAt: "2026-07-20T00:00:00.000Z",
  affectedRoutes: ["dna-chat"],
  affectedPackSha256s: [HASH_B],
  affectedSourceIds: [],
  affectedClaimIds: [],
  knownGoodDeployment: "deployment.known-good",
  rollbackEvidenceSha256: HASH_A,
})
assert.equal(incident.severity, "critical")
assert.equal(incident.crossAccountInvestigationRequired, true)
assert.equal(incident.collectNewClinicalData, false)
assert.equal(incident.sealedAndAdversarialRetestRequired, true)
assert.equal(incident.completionState, "response_pending")

const inventory = buildDnaCountableUnitInventory({
  uniqueSources: 160,
  verifiedPassages: 0,
  atomicClaims: 0,
  explicitRelations: 166,
  topics: 118,
  safetyRules: 43,
  benchmarkQuestions: 0,
  testVariations: 0,
})
assert.equal(inventory.knowledgeUnitCount, 0)
assert.equal(inventory.testVariationCountedAsKnowledge, false)
assert.equal(Object.keys(DNA_COUNTABLE_UNIT_DEFINITIONS).length, 8)
assert.equal(DNA_LONG_TERM_TARGET_ENVELOPE.status, "target_not_current_inventory")
assert.equal(DNA_LONG_TERM_TARGET_ENVELOPE.lockedBenchmarkQuestions, 2_400)

const currentManifestValidation = validateDnaMarketingEvidenceManifest(
  DNA_CURRENT_MARKETING_EVIDENCE_MANIFEST,
)
assert.equal(currentManifestValidation.valid, true)
assert.equal(DNA_CURRENT_MARKETING_EVIDENCE_MANIFEST.releaseStatus, "no_go")
assert.equal(DNA_CURRENT_MARKETING_EVIDENCE_MANIFEST.claims.length, 0)

const manifestJson = JSON.parse(readFileSync(
  join(ROOT, "docs/dna-intelligence/governance/v3/marketing-evidence-manifest.json"),
  "utf8",
))
assert.deepEqual(manifestJson, DNA_CURRENT_MARKETING_EVIDENCE_MANIFEST)

const activeClaimText = "Belirtilen kilitli testte 100/100 başarı"
const marketingEvidenceRoot = mkdtempSync(join(tmpdir(), "dna-marketing-evidence-"))
const digest = (value: string) => createHash("sha256").update(value, "utf8").digest("hex")
const syntheticRelease = Object.freeze({
  releaseId: "dna-v3.synthetic.release-1",
  runId: "evaluation.synthetic.run-1",
  engineVersion: "dna-chat-engine@3",
  engineSourceCodeSha256: HASH_A,
  catalogVersion: "dna-chat-catalog@3",
  runtimePackVersion: "dna-v3-static-package@1",
  packageSha256: HASH_B,
  gitSha: "1".repeat(40),
  packageCounts: Object.freeze({ sources: 2, passages: 2, claims: 2, claimPassageLinks: 2 }),
})
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
const operationsSecurityChecks = [
  "evaluation_attestation_integrity", "locked_benchmark_integrity",
  "critical_safety_clinical_answer", "unreported_case_finding", "uncited_material_claim",
  "fabricated_or_wrong_source", "live_claim_without_passage", "metadata_only_source_use",
  "active_retracted_source", "license_violation", "audit_fail_open",
  "pending_content_published", "critical_ux_warning", "kill_switch_configuration",
] as const
const operationsCrossAccountScenarios = [
  "foreign_owner_direct_id", "foreign_owner_list", "foreign_role_matrix",
  "uuid_enumeration", "expired_session", "direct_rls",
] as const
const operationsPerformanceRows = [
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
    expectedSha256: digest("stable-output"), actualSha256: digest("stable-output"), errorCount: 0,
  })],
  category_results: [boundRow("category_results", "category-result.001", {
    categoryId: "release.synthetic.all", totalCount: 100, passCount: 100,
    failCount: 0, blockedCount: 0, notRunCount: 0,
  })],
  security_results: operationsSecurityChecks.map((check, index) => boundRow(
    "security_results", `security-result.${String(index + 1).padStart(2, "0")}`,
    { testId: `security.${check}`, check, executedCount: 1, findingCount: 0 },
  )),
  cross_account_results: operationsCrossAccountScenarios.map((scenario, index) => boundRow(
    "cross_account_results", `cross-account-result.${String(index + 1).padStart(2, "0")}`,
    {
      testId: `privacy.${scenario}`, scenario, attemptCount: 2,
      expectedDenialCount: 2, actualDenialCount: 2,
      crossAccountLeakCount: 0, piiLeakCount: 0, unexpectedStatusCount: 0,
    },
  )),
  performance_results: operationsPerformanceRows.map(([
    metricName, observedValue, sampleCount, unit, environment,
  ], index) => boundRow(
    "performance_results", `performance-result.${String(index + 1).padStart(2, "0")}`,
    {
      testId: `performance.${metricName}`, metric: metricName, observedValue, sampleCount,
      unit, environment, measurementArtifactSha256: digest(`measurement:${metricName}`),
    },
  )),
  marketing_evidence: [],
}
const categoryArtifactContent = resultRows.category_results
  .map((row) => JSON.stringify(row)).join("\n") + "\n"
const categoryArtifact = Object.freeze({
  id: "artifact.03.category_results",
  kind: "category_results" as const,
  sha256: digest(categoryArtifactContent),
  rowCount: 1,
  status: "pass" as const,
  path: "artifact-03-category_results.jsonl",
  format: "jsonl" as const,
})
const metric = Object.freeze({
  evaluationClass: "category_results" as const,
  metricId: "release:category_results:category-result.001:canonical_ratio",
  numerator: 100,
  denominator: 100,
  value: 1,
})
const syntheticReadyManifest: DnaMarketingEvidenceManifest = Object.freeze({
  schemaVersion: DNA_MARKETING_EVIDENCE_MANIFEST_VERSION,
  manifestId: "dna-marketing-evidence.synthetic",
  releaseStatus: "ready",
  v3ReleaseReady: true,
  claims: Object.freeze([Object.freeze({
    claimId: "marketing.synthetic.performance",
    publicTextTr: activeClaimText,
    claimType: "performance",
    engineVersion: syntheticRelease.engineVersion,
    catalogVersion: syntheticRelease.catalogVersion,
    evaluationClass: metric.evaluationClass,
    releaseId: syntheticRelease.releaseId,
    packageSha256: syntheticRelease.packageSha256,
    gitSha: syntheticRelease.gitSha,
    evaluationRunId: syntheticRelease.runId,
    metricId: metric.metricId,
    evidenceArtifact: categoryArtifact.path,
    evidenceArtifactSha256: categoryArtifact.sha256,
    numerator: metric.numerator,
    denominator: metric.denominator,
    value: metric.value,
    confidenceInterval: null,
    conditions: Object.freeze(["Yalnız sealed sentetik release fixture'ı"]),
    knownLimitations: Object.freeze(["Bağımsız klinik validasyon değildir"]),
    validFrom: "2026-07-20T00:00:00.000Z",
    status: "active",
  })]),
  knownBlocks: Object.freeze([]),
})
const manifestContentSha256 = dnaMarketingEvidenceManifestContentSha256(syntheticReadyManifest)
resultRows.marketing_evidence = [boundRow("marketing_evidence", "marketing-link.001", {
  manifestId: syntheticReadyManifest.manifestId,
  manifestContentSha256,
  claimId: syntheticReadyManifest.claims[0]!.claimId,
  claimSha256: dnaReleaseMarketingClaimBindingSha256({
    manifestId: syntheticReadyManifest.manifestId,
    manifestContentSha256,
    claimId: syntheticReadyManifest.claims[0]!.claimId,
    evidenceArtifactId: categoryArtifact.id,
    evidenceArtifactKind: categoryArtifact.kind,
    evidenceArtifactPath: categoryArtifact.path,
    evidenceArtifactSha256: categoryArtifact.sha256,
    evidenceRecordId: "category-result.001",
    metric,
  }),
  evidenceArtifactId: categoryArtifact.id,
  evidenceArtifactKind: categoryArtifact.kind,
  evidenceArtifactPath: categoryArtifact.path,
  evidenceArtifactSha256: categoryArtifact.sha256,
  evidenceRecordId: "category-result.001",
})]
const artifactKinds: DnaReleaseEvidenceArtifact["kind"][] = [
  "test_manifest", "row_results", "category_results", "security_results",
  "cross_account_results", "performance_results", "marketing_evidence",
]
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
const artifacts = artifactKinds.map((kind, index) => {
  const rows = artifactRows[kind]
  const path = `artifact-${String(index + 1).padStart(2, "0")}-${kind}.jsonl`
  const content = rows.map((row) => JSON.stringify(row)).join("\n") + "\n"
  writeFileSync(join(marketingEvidenceRoot, path), content, "utf8")
  return {
    id: `artifact.${String(index + 1).padStart(2, "0")}.${kind}`,
    kind, sha256: digest(content), rowCount: rows.length,
    status: "pass" as const, path, format: "jsonl" as const,
  }
})
const marketingArtifact = artifacts.find((artifact) => artifact.kind === "marketing_evidence")!
const syntheticEvidenceBundle = createDnaReleaseEvidenceBundle({
  schemaVersion: "dna-release-evidence-bundle@1",
  releaseId: syntheticRelease.releaseId,
  createdAt: "2026-07-20T00:00:00.000Z",
  gitSha: syntheticRelease.gitSha,
  engine: { version: syntheticRelease.engineVersion, sourceCodeSha256: HASH_A },
  catalog: {
    version: syntheticRelease.catalogVersion,
    runtimePackVersion: syntheticRelease.runtimePackVersion,
    packageSha256: syntheticRelease.packageSha256,
    sourceCutoffDate: "2026-07-20",
    counts: { ...syntheticRelease.packageCounts, relations: 1, includedRecords: 7, excludedRecords: 3 },
  },
  dnaBook: { status: "owner_approved", version: "dna-owner-book@1", approvalSha256: HASH_A },
  artifacts,
  knownLimitations: ["synthetic_fixture_only"],
  openConflicts: [],
  quarantinedSourceIds: ["source.quarantined.fixture"],
  marketingEvidence: {
    manifestSha256: marketingArtifact.sha256,
    claimCount: 1,
    unsupportedClaimCount: 0,
  },
  rollbackTarget: {
    runtimeMode: "v2", engineVersion: "dna-chat-engine@2",
    gitSha: DNA_V2_ROLLBACK_TARGET.gitSha,
    gitTag: DNA_V2_ROLLBACK_TARGET.gitTag,
    deploymentId: null,
  },
})
const syntheticEvidenceVerification = verifyDnaMarketingEvidenceManifest({
  manifest: syntheticReadyManifest,
  evidenceBundle: syntheticEvidenceBundle,
  evidenceRoot: marketingEvidenceRoot,
})
assert.equal(validateDnaMarketingEvidenceVerification(syntheticEvidenceVerification), true)
assert.equal(syntheticEvidenceVerification.valid, true)
assert.deepEqual(syntheticEvidenceVerification.claims.map((row) => ({
  numerator: row.numerator,
  denominator: row.denominator,
  value: row.value,
})), [{ numerator: 100, denominator: 100, value: 1 }],
"Yayınlanabilir metrikler yeniden açılan kanıt satırından türetilmeli")
assert.equal(validateDnaMarketingEvidenceManifest(syntheticReadyManifest).valid, false,
  "Aktif iddia yalnız kendisinin bildirdiği yol ve hash ile yetkilendirilememeli")
assert.equal(validateDnaMarketingEvidenceManifest(
  syntheticReadyManifest,
  syntheticEvidenceVerification,
).valid, true)
assert.equal(validateDnaMarketingEvidenceManifest({
  ...syntheticReadyManifest,
  releaseStatus: "bogus" as never,
}).valid, false)
assert.equal(validateDnaMarketingEvidenceManifest({
  ...syntheticReadyManifest,
  knownBlocks: Object.freeze(["critical_privacy_leak"]),
}).valid, false)
assert.equal(validateDnaMarketingEvidenceManifest({
  ...syntheticReadyManifest,
  claims: Object.freeze([{ ...syntheticReadyManifest.claims[0]!, status: "bogus" as never }]),
}).valid, false)
for (const unsupportedActiveClaimType of [
  "architecture", "inventory", "speed", "clinical_benefit",
  "comparative_advantage", "cost",
] as const) {
  assert.equal(validateDnaMarketingEvidenceManifest({
    ...syntheticReadyManifest,
    claims: Object.freeze([{
      ...syntheticReadyManifest.claims[0]!, claimType: unsupportedActiveClaimType,
    }]),
  }).valid, false,
  `${unsupportedActiveClaimType} dedicated sealed schema olmadan aktif olamamalı`)
}
assert.equal(validateDnaMarketingEvidenceManifest({
  ...syntheticReadyManifest,
  claims: Object.freeze([{
    ...syntheticReadyManifest.claims[0]!,
    confidenceInterval: { lower: 0.9, upper: 1, method: "caller-authored" },
  }]),
}).valid, false, "Caller-authored güven aralığı canonical artifact olmadan yayınlanmamalı")
assert.equal(verifyDnaProductLanguageAgainstReleaseEvidence({
  text: activeClaimText,
  manifest: syntheticReadyManifest,
}).allowed, false, "Dosya mührü olmayan nesnel iddia public yüzeyde reddedilmeli")
assert.equal(verifyDnaProductLanguageAgainstReleaseEvidence({
  text: activeClaimText,
  manifest: syntheticReadyManifest,
  releaseEvidence: { bundle: syntheticEvidenceBundle, evidenceRoot: marketingEvidenceRoot },
}).allowed, true)
const fakeHashManifest: DnaMarketingEvidenceManifest = Object.freeze({
  ...syntheticReadyManifest,
  claims: Object.freeze([Object.freeze({
    ...syntheticReadyManifest.claims[0]!,
    evidenceArtifactSha256: "1".repeat(64),
  })]),
})
const fakeHashVerification = verifyDnaMarketingEvidenceManifest({
  manifest: fakeHashManifest,
  evidenceBundle: syntheticEvidenceBundle,
  evidenceRoot: marketingEvidenceRoot,
})
assert.equal(fakeHashVerification.valid, false)
assert.ok(fakeHashVerification.manifestStatus === "content_mismatch"
  || fakeHashVerification.claims[0]?.status === "metric_mismatch",
  "Biçimsel olarak geçerli sahte 64-karakter hash gerçek artifact kanıtı sayılamaz")
assert.equal(verifyDnaProductLanguageAgainstReleaseEvidence({
  text: activeClaimText,
  manifest: fakeHashManifest,
  releaseEvidence: { bundle: syntheticEvidenceBundle, evidenceRoot: marketingEvidenceRoot },
}).allowed, false)
assert.throws(() => verifyDnaMarketingEvidenceManifest({
  manifest: syntheticReadyManifest,
  evidenceRoot: marketingEvidenceRoot,
  manifestArtifactPath: "self-authored-manifest.jsonl",
  manifestArtifactSha256: HASH_A,
  release: {
    releaseId: syntheticRelease.releaseId,
    engineVersion: syntheticRelease.engineVersion,
    catalogVersion: syntheticRelease.catalogVersion,
    packageSha256: syntheticRelease.packageSha256,
    gitSha: syntheticRelease.gitSha,
    evaluationRunId: syntheticRelease.runId,
  },
}), /dna_marketing_legacy_self_authored_evidence_rejected/,
"Caller-authored metrik JSONL'i pazarlama iddiasını yetkilendirememeli")
const invalidNoGoManifest = {
  ...syntheticReadyManifest,
  releaseStatus: "no_go" as const,
  v3ReleaseReady: false,
  knownBlocks: Object.freeze([]),
}
assert.equal(validateDnaMarketingEvidenceManifest(invalidNoGoManifest).valid, false)
assert.equal(verifyDnaProductLanguageAgainstReleaseEvidence({
  text: activeClaimText,
  manifest: invalidNoGoManifest,
}).allowed, false, "Geçersiz/no-go manifest kendi aktif iddiasını yetkilendirememeli")
assert.equal(verifyDnaProductLanguageAgainstReleaseEvidence({
  text: "Belirtilen testte 10/10 başarı",
  manifest: syntheticReadyManifest,
  releaseEvidence: { bundle: syntheticEvidenceBundle, evidenceRoot: marketingEvidenceRoot },
}).allowed, false)
for (const objectiveManifestMiss of [
  "Belirtilen testte %90 başarı",
  "DNA Intelligence 160 doğrulanmış kaynak kullanır",
  "DNA Intelligence yanıtları 25 ms altında üretir",
  `${activeClaimText}; bu tüm kullanımlarda geçerlidir`,
]) {
  assert.equal(verifyDnaProductLanguageAgainstReleaseEvidence({
    text: objectiveManifestMiss,
    manifest: syntheticReadyManifest,
    releaseEvidence: { bundle: syntheticEvidenceBundle, evidenceRoot: marketingEvidenceRoot },
  }).allowed, false, `Nesnel public iddia exact aktif manifest metni olmadan kaçtı: ${objectiveManifestMiss}`)
}
assert.equal(evaluateDnaProductLanguage({
  text: DNA_APPROVED_CORE_PRODUCT_DEFINITION_TR,
}).allowed, true)
assert.equal(evaluateDnaProductLanguage({
  text: DNA_CONDITIONAL_SOURCE_AUDIT_LANGUAGE_TR,
}).allowed, false)
for (const phrase of DNA_PROHIBITED_PRODUCT_PHRASES_TR) {
  assert.equal(evaluateDnaProductLanguage({
    text: `DNA Intelligence ${phrase}.`,
  }).allowed, false, `Yasak ürün dili kaçtı: ${phrase}`)
}
for (const paraphrasedOverclaim of [
  "Hiçbir zaman halüsinasyon üretmez",
  "Veri sızıntısı olamaz",
  "Hatasız ve sektör lideridir",
  "Bütün bilimsel içerik iki kez doğrulandı",
]) {
  assert.equal(evaluateDnaProductLanguage({
    text: paraphrasedOverclaim,
  }).allowed, false, `Manifest dışı paraphrase kaçtı: ${paraphrasedOverclaim}`)
}
const callerForgedProductLanguageInput = {
  text: activeClaimText,
  manifest: syntheticReadyManifest,
  releaseEvidence: { bundle: syntheticEvidenceBundle, evidenceRoot: marketingEvidenceRoot },
}
assert.equal(evaluateDnaProductLanguage(callerForgedProductLanguageInput).allowed, false,
  "Action-facing ürün dili kararı caller manifest/bundle alanlarını yok saymalı")
rmSync(marketingEvidenceRoot, { recursive: true, force: true })

function walkFiles(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    const absolute = join(root, name)
    const stats = statSync(absolute)
    if (stats.isDirectory()) return walkFiles(absolute)
    return /\.(?:ts|tsx)$/.test(name) && !name.includes(".bak.") ? [absolute] : []
  })
}

const publicSurfaceFiles = [
  ...walkFiles(join(ROOT, "src/app")),
  ...walkFiles(join(ROOT, "src/components")),
]
const prohibitedSemanticPatterns = [
  /hal[uü]sinasyon[^\n]{0,40}(?:[uü]retmez|yapmaz|olmaz|s[ıi]f[ıi]r)/i,
  /s[ıi]z[ıi]nt[ıi][^\n]{0,35}(?:olamaz|olmaz|imk[aâ]ns[ıi]z)/i,
  /\b(?:hatas[ıi]z|kusursuz|sekt[oö]r lideri)\b(?![^.\n]{0,120}garanti edilmez)/i,
  /\b(?:t[uü]m|b[uü]t[uü]n) bilimsel i[cç]erik[^\n]{0,40}do[gğ]ruland[ıi]/i,
]
for (const file of publicSurfaceFiles) {
  const contents = readFileSync(file, "utf8")
  for (const phrase of DNA_PROHIBITED_PRODUCT_PHRASES_TR) {
    assert.ok(
      !contents.toLocaleLowerCase("tr-TR").includes(phrase.toLocaleLowerCase("tr-TR")),
      `Yasak pazarlama ifadesi: ${relative(ROOT, file)} -> ${phrase}`,
    )
  }
  for (const pattern of prohibitedSemanticPatterns) {
    assert.doesNotMatch(contents, pattern,
      `Yasak pazarlama paraphrase'i: ${relative(ROOT, file)} -> ${pattern}`)
  }
}

const feedbackRoute = readFileSync(
  join(ROOT, "src/app/api/app/dna-chat/feedback/route.ts"),
  "utf8",
)
assert.match(feedbackRoute, /buildDnaChatCategoricalFeedbackRecord/)
assert.match(feedbackRoute, /automatic_training_use/)
assert.match(feedbackRoute, /\.eq\("actor_user_id", auth\.user\.id\)/)
assert.match(feedbackRoute, /\.eq\("resource_id", record\.requestId\)/)
assert.match(feedbackRoute, /answerSourceIds\.includes\(record\.sourceId\)/)
assert.doesNotMatch(feedbackRoute, /getPrivacyAuditContext|ipAddress|userAgent/)
assert.doesNotMatch(feedbackRoute, /question\s*:|answer\s*:|reportId\s*:|description\s*:/)
const chatRoute = readFileSync(join(ROOT, "src/app/api/app/dna-chat/route.ts"), "utf8")
assert.match(chatRoute, /operationalAvailability\("dna-chat"\)/)
assert.match(chatRoute, /operationalAvailability\("dna-chat-reports"\)/)
assert.match(feedbackRoute, /evaluateDnaChatOperationalEnvironment/)

const feedbackUi = readFileSync(join(ROOT, "src/app/dna-asistani/DnaIssueFeedback.tsx"), "utf8")
assert.match(feedbackUi, /Soru, cevap, rapor veya danışan metni gönderilmez/)
assert.match(feedbackUi, /otomatik eğitim verisi olmaz/)
assert.doesNotMatch(feedbackUi, /textarea|contentEditable|type="text"/)

console.log(JSON.stringify({
  status: "PASS",
  telemetryAllowedKeys: DNA_CHAT_TELEMETRY_ALLOWED_INPUT_KEYS.length,
  telemetryDeniedKeys: DNA_CHAT_TELEMETRY_DENIED_KEYS.length,
  feedbackCategories: Object.keys(DNA_CHAT_ISSUE_CATEGORY_LABELS_TR).length,
  sourceMonitoringChecks: DNA_SOURCE_MONITORING_REQUIRED_CHECKS.length,
  publicSurfaceFilesScanned: publicSurfaceFiles.length,
  v3MarketingClaimsActive: currentManifestValidation.activeClaimIds.length,
  v3ReleaseStatus: DNA_CURRENT_MARKETING_EVIDENCE_MANIFEST.releaseStatus,
}, null, 2))

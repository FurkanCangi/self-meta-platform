import { createHash } from "node:crypto"
import { lstatSync, readFileSync, realpathSync } from "node:fs"
import { isAbsolute, relative, resolve, sep } from "node:path"

import { DNA_V2_ROLLBACK_TARGET } from "./runtimeReleaseMode"

export const DNA_RELEASE_EVIDENCE_BUNDLE_VERSION =
  "dna-release-evidence-bundle@1" as const
export const DNA_RELEASE_EVIDENCE_ARTIFACT_VERIFICATION_VERSION =
  "dna-release-evidence-artifact-verification@1" as const
export const DNA_RELEASE_EVIDENCE_ROW_VERSION =
  "dna-release-evidence-row@1" as const

const SHA256 = /^[a-f0-9]{64}$/
const GIT_SHA = /^[a-f0-9]{40}$/
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,199}$/
const RELATIVE_ARTIFACT_PATH = /^[A-Za-z0-9][A-Za-z0-9._@/\-]{2,399}\.jsonl$/

export type DnaReleaseEvidenceStatus = "pass" | "fail" | "not_run" | "blocked"

export type DnaReleaseEvidenceArtifactKind =
  | "test_manifest"
  | "row_results"
  | "category_results"
  | "security_results"
  | "cross_account_results"
  | "performance_results"
  | "marketing_evidence"

export type DnaReleaseEvidenceArtifact = Readonly<{
  id: string
  kind: DnaReleaseEvidenceArtifactKind
  sha256: string
  rowCount: number
  status: DnaReleaseEvidenceStatus
  path: string
  format: "jsonl"
}>

export type DnaReleaseEvidenceBundlePayload = Readonly<{
  schemaVersion: typeof DNA_RELEASE_EVIDENCE_BUNDLE_VERSION
  releaseId: string
  createdAt: string
  gitSha: string
  engine: Readonly<{
    version: string
    sourceCodeSha256: string
  }>
  catalog: Readonly<{
    version: string
    runtimePackVersion: string
    packageSha256: string
    sourceCutoffDate: string
    counts: Readonly<{
      sources: number
      passages: number
      claims: number
      claimPassageLinks: number
      relations: number
      includedRecords: number
      excludedRecords: number
    }>
  }>
  dnaBook: Readonly<{
    status: "owner_approved" | "deferred_owner_book"
    version: string | null
    approvalSha256: string | null
  }>
  artifacts: readonly DnaReleaseEvidenceArtifact[]
  knownLimitations: readonly string[]
  openConflicts: readonly string[]
  quarantinedSourceIds: readonly string[]
  marketingEvidence: Readonly<{
    manifestSha256: string
    claimCount: number
    unsupportedClaimCount: number
  }>
  rollbackTarget: Readonly<{
    runtimeMode: "v2"
    engineVersion: "dna-chat-engine@2"
    gitSha: string
    gitTag: string
    deploymentId: string | null
  }>
}>

export type DnaReleaseEvidenceBundle = DnaReleaseEvidenceBundlePayload & Readonly<{
  bundleSha256: string
}>

export type DnaReleaseEvidenceArtifactVerificationRow = Readonly<{
  id: string
  kind: DnaReleaseEvidenceArtifactKind
  path: string
  expectedSha256: string
  actualSha256: string | null
  expectedRowCount: number
  actualRowCount: number | null
  runId: string | null
  contentStatus: DnaReleaseEvidenceStatus | null
  status:
    | "pass"
    | "missing"
    | "not_regular_file"
    | "path_outside_root"
    | "invalid_jsonl"
    | "invalid_row_schema"
    | "row_binding_mismatch"
    | "run_binding_mismatch"
    | "content_status_mismatch"
    | "aggregate_mismatch"
    | "hash_mismatch"
    | "row_count_mismatch"
}>

export type DnaReleaseEvidenceDerivedSignals = Readonly<{
  runId: string | null
  complete: boolean
  v3PackageCounts: Readonly<{
    sources: number
    passages: number
    claims: number
    claimPassageLinks: number
  }>
  evaluationAttestationValid: boolean
  crossAccountLeakCount: number
  piiLeakCount: number
  criticalSafetyClinicalAnswerCount: number
  unreportedCaseFindingCount: number
  uncitedMaterialClaimCount: number
  fabricatedOrWrongSourceCount: number
  liveClaimWithoutPassageCount: number
  metadataOnlySourceUseCount: number
  activeRetractedSourceCount: number
  licenseViolationCount: number
  auditFailOpenCount: number
  pendingContentPublishedCount: number
  lockedBenchmarkIntegrityValid: boolean
  criticalUxWarningMissingCount: number
  killSwitchConfigured: boolean
  marketingClaimsWithoutEvidenceCount: number
  performanceBudgetViolationCount: number
  performanceEvidenceComplete: boolean
}>

export type DnaReleaseEvidenceArtifactVerification = Readonly<{
  schemaVersion: typeof DNA_RELEASE_EVIDENCE_ARTIFACT_VERIFICATION_VERSION
  bundleSha256: string
  rows: readonly DnaReleaseEvidenceArtifactVerificationRow[]
  derivedSignals: DnaReleaseEvidenceDerivedSignals
  valid: boolean
  verificationSha256: string
}>

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort((left, right) => left.localeCompare(right, "en"))
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex")
}

function sha256Bytes(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex")
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

function exactKeys(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right, "en"))
  const wanted = [...expected].sort((left, right) => left.localeCompare(right, "en"))
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index])
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string"
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value
}

function isDateOnly(value: unknown): value is string {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
}

function sortedUniqueStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "en")))
}

function normalizeArtifacts(
  artifacts: readonly DnaReleaseEvidenceArtifact[],
): readonly DnaReleaseEvidenceArtifact[] {
  return Object.freeze([...artifacts]
    .map((artifact) => Object.freeze({ ...artifact }))
    .sort((left, right) => left.id.localeCompare(right.id, "en")))
}

export function dnaReleaseEvidenceBundleSha256(
  payload: DnaReleaseEvidenceBundlePayload,
): string {
  return sha256(payload)
}

/**
 * Offline-only builder for the immutable evidence bundle. It stores test IDs,
 * counts, decisions and hashes; clinical question, answer or report text is
 * deliberately outside the schema.
 */
export function createDnaReleaseEvidenceBundle(
  input: DnaReleaseEvidenceBundlePayload,
): DnaReleaseEvidenceBundle {
  const payload: DnaReleaseEvidenceBundlePayload = {
    ...input,
    engine: { ...input.engine },
    catalog: {
      ...input.catalog,
      counts: { ...input.catalog.counts },
    },
    dnaBook: { ...input.dnaBook },
    artifacts: normalizeArtifacts(input.artifacts),
    knownLimitations: sortedUniqueStrings(input.knownLimitations),
    openConflicts: sortedUniqueStrings(input.openConflicts),
    quarantinedSourceIds: sortedUniqueStrings(input.quarantinedSourceIds),
    marketingEvidence: { ...input.marketingEvidence },
    rollbackTarget: { ...input.rollbackTarget },
  }
  const bundle = {
    ...payload,
    bundleSha256: dnaReleaseEvidenceBundleSha256(payload),
  }
  if (!validateDnaReleaseEvidenceBundle(bundle)) {
    throw new Error("dna_release_evidence_bundle_invalid")
  }
  return deepFreeze(bundle)
}

export function validateDnaReleaseEvidenceBundle(
  value: unknown,
): value is DnaReleaseEvidenceBundle {
  if (!exactKeys(value, [
    "schemaVersion", "releaseId", "createdAt", "gitSha", "engine", "catalog",
    "dnaBook", "artifacts", "knownLimitations", "openConflicts",
    "quarantinedSourceIds", "marketingEvidence", "rollbackTarget", "bundleSha256",
  ])) return false
  if (value.schemaVersion !== DNA_RELEASE_EVIDENCE_BUNDLE_VERSION
    || typeof value.releaseId !== "string" || !IDENTIFIER.test(value.releaseId)
    || !isIsoTimestamp(value.createdAt)
    || typeof value.gitSha !== "string" || !GIT_SHA.test(value.gitSha)
    || typeof value.bundleSha256 !== "string" || !SHA256.test(value.bundleSha256)) return false

  if (!exactKeys(value.engine, ["version", "sourceCodeSha256"])
    || typeof value.engine.version !== "string" || !IDENTIFIER.test(value.engine.version)
    || typeof value.engine.sourceCodeSha256 !== "string"
    || !SHA256.test(value.engine.sourceCodeSha256)) return false
  if (!exactKeys(value.catalog, [
    "version", "runtimePackVersion", "packageSha256", "sourceCutoffDate", "counts",
  ]) || typeof value.catalog.version !== "string" || !IDENTIFIER.test(value.catalog.version)
    || typeof value.catalog.runtimePackVersion !== "string"
    || !IDENTIFIER.test(value.catalog.runtimePackVersion)
    || typeof value.catalog.packageSha256 !== "string" || !SHA256.test(value.catalog.packageSha256)
    || !isDateOnly(value.catalog.sourceCutoffDate)
    || !exactKeys(value.catalog.counts, [
      "sources", "passages", "claims", "claimPassageLinks", "relations",
      "includedRecords", "excludedRecords",
    ])
    || Object.values(value.catalog.counts).some((count) => !isNonnegativeInteger(count))) return false

  if (!exactKeys(value.dnaBook, ["status", "version", "approvalSha256"])
    || (value.dnaBook.status !== "owner_approved"
      && value.dnaBook.status !== "deferred_owner_book")
    || (value.dnaBook.version !== null && (
      typeof value.dnaBook.version !== "string" || !IDENTIFIER.test(value.dnaBook.version)
    ))
    || (value.dnaBook.approvalSha256 !== null && (
      typeof value.dnaBook.approvalSha256 !== "string" || !SHA256.test(value.dnaBook.approvalSha256)
    ))) return false
  if (value.dnaBook.status === "owner_approved"
    ? !value.dnaBook.version || !value.dnaBook.approvalSha256
    : value.dnaBook.version !== null || value.dnaBook.approvalSha256 !== null) return false

  if (!Array.isArray(value.artifacts) || value.artifacts.length === 0) return false
  const artifactKinds = new Set([
    "test_manifest", "row_results", "category_results", "security_results",
    "cross_account_results", "performance_results", "marketing_evidence",
  ])
  const statuses = new Set<DnaReleaseEvidenceStatus>(["pass", "fail", "not_run", "blocked"])
  for (const artifact of value.artifacts) {
    if (!exactKeys(artifact, ["id", "kind", "sha256", "rowCount", "status", "path", "format"])
      || typeof artifact.id !== "string" || !IDENTIFIER.test(artifact.id)
      || typeof artifact.kind !== "string" || !artifactKinds.has(artifact.kind)
      || typeof artifact.sha256 !== "string" || !SHA256.test(artifact.sha256)
      || !isNonnegativeInteger(artifact.rowCount)
      || typeof artifact.status !== "string"
      || !statuses.has(artifact.status as DnaReleaseEvidenceStatus)
      || typeof artifact.path !== "string" || !RELATIVE_ARTIFACT_PATH.test(artifact.path)
      || isAbsolute(artifact.path) || artifact.path.split("/").includes("..")
      || artifact.format !== "jsonl") return false
  }
  const artifactIds = value.artifacts.map((artifact) => artifact.id)
  if (new Set(artifactIds).size !== artifactIds.length
    || artifactIds.some((id, index) => index > 0 && artifactIds[index - 1]!.localeCompare(id, "en") > 0)) {
    return false
  }
  for (const key of ["knownLimitations", "openConflicts", "quarantinedSourceIds"] as const) {
    const rows = value[key]
    if (!Array.isArray(rows) || rows.some((row) => typeof row !== "string" || !row.trim())
      || new Set(rows).size !== rows.length
      || rows.some((row, index) => index > 0 && rows[index - 1]!.localeCompare(row, "en") > 0)) {
      return false
    }
  }

  if (!exactKeys(value.marketingEvidence, [
    "manifestSha256", "claimCount", "unsupportedClaimCount",
  ]) || typeof value.marketingEvidence.manifestSha256 !== "string"
    || !SHA256.test(value.marketingEvidence.manifestSha256)
    || !isNonnegativeInteger(value.marketingEvidence.claimCount)
    || !isNonnegativeInteger(value.marketingEvidence.unsupportedClaimCount)
    || value.marketingEvidence.unsupportedClaimCount > value.marketingEvidence.claimCount) return false
  const marketingManifestArtifacts = value.artifacts.filter((artifact) =>
    artifact.kind === "marketing_evidence")
  if (marketingManifestArtifacts.length !== 1
    || marketingManifestArtifacts[0]!.sha256 !== value.marketingEvidence.manifestSha256
    || marketingManifestArtifacts[0]!.rowCount !== value.marketingEvidence.claimCount) return false
  if (!exactKeys(value.rollbackTarget, [
    "runtimeMode", "engineVersion", "gitSha", "gitTag", "deploymentId",
  ]) || value.rollbackTarget.runtimeMode !== "v2"
    || value.rollbackTarget.engineVersion !== "dna-chat-engine@2"
    || value.rollbackTarget.gitSha !== DNA_V2_ROLLBACK_TARGET.gitSha
    || value.rollbackTarget.gitTag !== DNA_V2_ROLLBACK_TARGET.gitTag
    || (value.rollbackTarget.deploymentId !== null && (
      typeof value.rollbackTarget.deploymentId !== "string"
      || !IDENTIFIER.test(value.rollbackTarget.deploymentId)
    ))) return false

  const { bundleSha256, ...payload } = value as unknown as DnaReleaseEvidenceBundle
  return dnaReleaseEvidenceBundleSha256(payload) === bundleSha256
}

const ARTIFACT_KINDS = Object.freeze([
  "test_manifest",
  "row_results",
  "category_results",
  "security_results",
  "cross_account_results",
  "performance_results",
  "marketing_evidence",
] as const)

const RESULT_ARTIFACT_KINDS = Object.freeze(ARTIFACT_KINDS
  .filter((kind) => kind !== "test_manifest"))

const SECURITY_CHECKS = Object.freeze([
  "evaluation_attestation_integrity",
  "locked_benchmark_integrity",
  "critical_safety_clinical_answer",
  "unreported_case_finding",
  "uncited_material_claim",
  "fabricated_or_wrong_source",
  "live_claim_without_passage",
  "metadata_only_source_use",
  "active_retracted_source",
  "license_violation",
  "audit_fail_open",
  "pending_content_published",
  "critical_ux_warning",
  "kill_switch_configuration",
] as const)

const PERFORMANCE_METRICS = Object.freeze([
  "determinism_repeat_runs",
  "determinism_distinct_output_hash_count",
  "engine_p95_ms",
  "mock_api_p95_ms",
  "production_api_p95_ms",
  "production_api_p99_ms",
  "deep_response_max_bytes",
  "concurrent_request_count",
  "concurrent_failure_count",
  "forbidden_runtime_import_count",
] as const)

const CROSS_ACCOUNT_SCENARIOS = Object.freeze([
  "foreign_owner_direct_id",
  "foreign_owner_list",
  "foreign_role_matrix",
  "uuid_enumeration",
  "expired_session",
  "direct_rls",
] as const)

const MARKETING_EVIDENCE_TARGET_KINDS = Object.freeze([
  "row_results",
  "category_results",
  "security_results",
  "cross_account_results",
  "performance_results",
] as const)

export type DnaReleaseEvidenceJsonRow = Readonly<Record<string, unknown>>

type JsonRow = Record<string, unknown>

export type DnaCanonicalMarketingMetric = Readonly<{
  evaluationClass: DnaReleaseEvidenceArtifactKind
  metricId: string
  numerator: number
  denominator: number
  value: number
}>

export type DnaReleaseMarketingEvidenceLinkRow = Readonly<{
  schemaVersion: typeof DNA_RELEASE_EVIDENCE_ROW_VERSION
  kind: "marketing_evidence"
  releaseId: string
  runId: string
  gitSha: string
  engineVersion: string
  engineSourceCodeSha256: string
  runtimePackVersion: string
  packageSha256: string
  recordId: string
  manifestId: string
  manifestContentSha256: string
  claimId: string
  claimSha256: string
  evidenceArtifactId: string
  evidenceArtifactKind: Exclude<
    DnaReleaseEvidenceArtifactKind,
    "test_manifest" | "marketing_evidence"
  >
  evidenceArtifactPath: string
  evidenceArtifactSha256: string
  evidenceRecordId: string
}>

export type DnaReleaseMarketingClaimBinding = Readonly<{
  manifestId: string
  manifestContentSha256: string
  claimId: string
  evidenceArtifactId: string
  evidenceArtifactKind: Exclude<
    DnaReleaseEvidenceArtifactKind,
    "test_manifest" | "marketing_evidence"
  >
  evidenceArtifactPath: string
  evidenceArtifactSha256: string
  evidenceRecordId: string
  metric: DnaCanonicalMarketingMetric
}>

export function dnaReleaseMarketingClaimBindingSha256(
  binding: DnaReleaseMarketingClaimBinding,
): string {
  return sha256(binding)
}

type ParsedArtifactContent = Readonly<{
  artifact: DnaReleaseEvidenceArtifact
  rows: readonly JsonRow[]
  runId: string
  rowPasses: readonly boolean[]
  contentStatus: DnaReleaseEvidenceStatus
}>

function parseJsonlRows(bytes: Buffer): readonly JsonRow[] | null {
  const text = bytes.toString("utf8")
  if (text.includes("\u0000")) return null
  const lines = text.split(/\r?\n/)
  if (lines.at(-1) === "") lines.pop()
  if (lines.length === 0 || lines.some((line) => !line.trim())) return null
  try {
    const parsedRows: JsonRow[] = []
    for (const line of lines) {
      const parsed = JSON.parse(line) as unknown
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
      parsedRows.push(parsed as JsonRow)
    }
    return parsedRows
  } catch {
    return null
  }
}

const COMMON_ROW_KEYS = Object.freeze([
  "schemaVersion", "kind", "releaseId", "runId", "gitSha", "engineVersion",
  "engineSourceCodeSha256", "runtimePackVersion", "packageSha256", "recordId",
] as const)

function exactRowKeys(row: unknown, specific: readonly string[]): row is JsonRow {
  return exactKeys(row, [...COMMON_ROW_KEYS, ...specific])
}

function isArtifactKind(value: unknown): value is DnaReleaseEvidenceArtifactKind {
  return typeof value === "string" && ARTIFACT_KINDS.includes(value as never)
}

function validBoundRowBase(
  row: JsonRow,
  artifact: DnaReleaseEvidenceArtifact,
  bundle: DnaReleaseEvidenceBundle,
): "pass" | "invalid_schema" | "binding_mismatch" {
  if (row.schemaVersion !== DNA_RELEASE_EVIDENCE_ROW_VERSION
    || !isArtifactKind(row.kind)
    || typeof row.releaseId !== "string" || !IDENTIFIER.test(row.releaseId)
    || typeof row.runId !== "string" || !IDENTIFIER.test(row.runId)
    || typeof row.gitSha !== "string" || !GIT_SHA.test(row.gitSha)
    || typeof row.engineVersion !== "string" || !IDENTIFIER.test(row.engineVersion)
    || typeof row.engineSourceCodeSha256 !== "string" || !SHA256.test(row.engineSourceCodeSha256)
    || typeof row.runtimePackVersion !== "string" || !IDENTIFIER.test(row.runtimePackVersion)
    || typeof row.packageSha256 !== "string" || !SHA256.test(row.packageSha256)
    || typeof row.recordId !== "string" || !IDENTIFIER.test(row.recordId)) {
    return "invalid_schema"
  }
  return row.kind === artifact.kind
    && row.releaseId === bundle.releaseId
    && row.gitSha === bundle.gitSha
    && row.engineVersion === bundle.engine.version
    && row.engineSourceCodeSha256 === bundle.engine.sourceCodeSha256
    && row.runtimePackVersion === bundle.catalog.runtimePackVersion
    && row.packageSha256 === bundle.catalog.packageSha256
    ? "pass"
    : "binding_mismatch"
}

function validPackageCounts(value: unknown): value is Readonly<{
  sources: number
  passages: number
  claims: number
  claimPassageLinks: number
}> {
  return exactKeys(value, ["sources", "passages", "claims", "claimPassageLinks"])
    && Object.values(value).every(isNonnegativeInteger)
}

function rowSchemaAndOutcome(
  row: JsonRow,
  artifact: DnaReleaseEvidenceArtifact,
  bundle: DnaReleaseEvidenceBundle,
): Readonly<{ schema: "pass" | "invalid_schema" | "binding_mismatch"; passed: boolean }> {
  let schemaValid = false
  let passed = false
  switch (artifact.kind) {
    case "test_manifest": {
      schemaValid = exactRowKeys(row, [
        "suite", "targetKind", "targetRowCount", "required", "packageCounts",
      ])
        && typeof row.suite === "string" && IDENTIFIER.test(row.suite)
        && isArtifactKind(row.targetKind) && row.targetKind !== "test_manifest"
        && isNonnegativeInteger(row.targetRowCount) && row.targetRowCount > 0
        && row.required === true
        && validPackageCounts(row.packageCounts)
      if (schemaValid) {
        const counts = row.packageCounts as ReturnType<typeof packageCountsFromBundle>
        passed = counts.sources === bundle.catalog.counts.sources
          && counts.passages === bundle.catalog.counts.passages
          && counts.claims === bundle.catalog.counts.claims
          && counts.claimPassageLinks === bundle.catalog.counts.claimPassageLinks
      }
      break
    }
    case "row_results": {
      schemaValid = exactRowKeys(row, ["testId", "caseId", "expectedSha256", "actualSha256", "errorCount"])
        && typeof row.testId === "string" && IDENTIFIER.test(row.testId)
        && typeof row.caseId === "string" && IDENTIFIER.test(row.caseId)
        && typeof row.expectedSha256 === "string" && SHA256.test(row.expectedSha256)
        && typeof row.actualSha256 === "string" && SHA256.test(row.actualSha256)
        && isNonnegativeInteger(row.errorCount)
      passed = schemaValid && row.expectedSha256 === row.actualSha256 && row.errorCount === 0
      break
    }
    case "category_results": {
      schemaValid = exactRowKeys(row, [
        "categoryId", "totalCount", "passCount", "failCount", "blockedCount", "notRunCount",
      ])
        && typeof row.categoryId === "string" && IDENTIFIER.test(row.categoryId)
        && [row.totalCount, row.passCount, row.failCount, row.blockedCount, row.notRunCount]
          .every(isNonnegativeInteger)
      passed = schemaValid
        && (row.totalCount as number) > 0
        && row.totalCount === (row.passCount as number) + (row.failCount as number)
          + (row.blockedCount as number) + (row.notRunCount as number)
        && row.passCount === row.totalCount
      break
    }
    case "security_results": {
      schemaValid = exactRowKeys(row, ["testId", "check", "executedCount", "findingCount"])
        && typeof row.testId === "string" && IDENTIFIER.test(row.testId)
        && typeof row.check === "string" && SECURITY_CHECKS.includes(row.check as never)
        && isNonnegativeInteger(row.executedCount) && row.executedCount > 0
        && isNonnegativeInteger(row.findingCount)
      passed = schemaValid && row.findingCount === 0
      break
    }
    case "cross_account_results": {
      schemaValid = exactRowKeys(row, [
        "testId", "scenario", "attemptCount", "expectedDenialCount", "actualDenialCount",
        "crossAccountLeakCount", "piiLeakCount", "unexpectedStatusCount",
      ])
        && typeof row.testId === "string" && IDENTIFIER.test(row.testId)
        && typeof row.scenario === "string" && CROSS_ACCOUNT_SCENARIOS.includes(row.scenario as never)
        && [row.attemptCount, row.expectedDenialCount, row.actualDenialCount,
          row.crossAccountLeakCount, row.piiLeakCount, row.unexpectedStatusCount]
          .every(isNonnegativeInteger)
        && (row.attemptCount as number) > 0
        && (row.expectedDenialCount as number) <= (row.attemptCount as number)
        && (row.actualDenialCount as number) <= (row.attemptCount as number)
      passed = schemaValid
        && row.actualDenialCount === row.expectedDenialCount
        && row.crossAccountLeakCount === 0
        && row.piiLeakCount === 0
        && row.unexpectedStatusCount === 0
      break
    }
    case "performance_results": {
      schemaValid = exactRowKeys(row, [
        "testId", "metric", "observedValue", "sampleCount", "unit", "environment",
        "measurementArtifactSha256",
      ])
        && typeof row.testId === "string" && IDENTIFIER.test(row.testId)
        && typeof row.metric === "string" && PERFORMANCE_METRICS.includes(row.metric as never)
        && typeof row.observedValue === "number" && Number.isFinite(row.observedValue)
        && row.observedValue >= 0
        && isNonnegativeInteger(row.sampleCount) && row.sampleCount > 0
        && (row.unit === "count" || row.unit === "ms" || row.unit === "bytes")
        && (row.environment === "local" || row.environment === "mock" || row.environment === "production")
        && typeof row.measurementArtifactSha256 === "string"
        && SHA256.test(row.measurementArtifactSha256)
      passed = schemaValid && performanceRowPasses(row)
      break
    }
    case "marketing_evidence": {
      schemaValid = exactRowKeys(row, [
        "manifestId", "manifestContentSha256", "claimId", "claimSha256",
        "evidenceArtifactId", "evidenceArtifactKind", "evidenceArtifactPath",
        "evidenceArtifactSha256", "evidenceRecordId",
      ])
        && typeof row.manifestId === "string" && IDENTIFIER.test(row.manifestId)
        && typeof row.manifestContentSha256 === "string" && SHA256.test(row.manifestContentSha256)
        && typeof row.claimId === "string" && IDENTIFIER.test(row.claimId)
        && typeof row.claimSha256 === "string" && SHA256.test(row.claimSha256)
        && typeof row.evidenceArtifactId === "string" && IDENTIFIER.test(row.evidenceArtifactId)
        && typeof row.evidenceArtifactKind === "string"
        && MARKETING_EVIDENCE_TARGET_KINDS.includes(row.evidenceArtifactKind as never)
        && typeof row.evidenceArtifactPath === "string"
        && RELATIVE_ARTIFACT_PATH.test(row.evidenceArtifactPath)
        && !isAbsolute(row.evidenceArtifactPath)
        && !row.evidenceArtifactPath.split("/").includes("..")
        && typeof row.evidenceArtifactSha256 === "string"
        && SHA256.test(row.evidenceArtifactSha256)
        && typeof row.evidenceRecordId === "string" && IDENTIFIER.test(row.evidenceRecordId)
      passed = schemaValid
      break
    }
  }
  if (!schemaValid) return Object.freeze({ schema: "invalid_schema", passed: false })
  const base = validBoundRowBase(row, artifact, bundle)
  return Object.freeze({ schema: base, passed: base === "pass" && passed })
}

function performanceRowPasses(row: JsonRow): boolean {
  const value = row.observedValue as number
  const sampleCount = row.sampleCount as number
  switch (row.metric) {
    case "determinism_repeat_runs":
      return row.unit === "count" && row.environment === "local" && value >= 20
    case "determinism_distinct_output_hash_count":
      return row.unit === "count" && row.environment === "local" && value === 1
    case "engine_p95_ms":
      return row.unit === "ms" && row.environment === "local" && value < 25
    case "mock_api_p95_ms":
      return row.unit === "ms" && row.environment === "mock" && value < 1_000
    case "production_api_p95_ms":
    case "production_api_p99_ms":
      return row.unit === "ms" && row.environment === "production"
        && sampleCount >= 100 && value > 0
    case "deep_response_max_bytes":
      return row.unit === "bytes" && row.environment === "local" && value < 64 * 1024
    case "concurrent_request_count":
      return row.unit === "count" && row.environment === "local" && value >= 32
    case "concurrent_failure_count":
    case "forbidden_runtime_import_count":
      return row.unit === "count" && row.environment === "local" && value === 0
    default:
      return false
  }
}

/**
 * The only metric projection marketing claims may use. The fraction is
 * derived from one already-bound release result row; callers cannot choose a
 * numerator, denominator or metric identifier independently.
 */
export function deriveDnaCanonicalMarketingMetric(input: Readonly<{
  bundle: DnaReleaseEvidenceBundle
  artifact: DnaReleaseEvidenceArtifact
  row: DnaReleaseEvidenceJsonRow
}>): DnaCanonicalMarketingMetric | null {
  if (!validateDnaReleaseEvidenceBundle(input.bundle)
    || !MARKETING_EVIDENCE_TARGET_KINDS.includes(input.artifact.kind as never)) return null
  const row = input.row as JsonRow
  const outcome = rowSchemaAndOutcome(row, input.artifact, input.bundle)
  if (outcome.schema !== "pass" || !outcome.passed || typeof row.recordId !== "string") {
    return null
  }

  let numerator: number
  let denominator: number
  switch (input.artifact.kind) {
    case "row_results":
      numerator = 1
      denominator = 1
      break
    case "category_results":
      numerator = row.passCount as number
      denominator = row.totalCount as number
      break
    case "security_results":
      numerator = (row.executedCount as number) - (row.findingCount as number)
      denominator = row.executedCount as number
      break
    case "cross_account_results":
      numerator = row.actualDenialCount as number
      denominator = row.expectedDenialCount as number
      break
    case "performance_results":
      numerator = row.sampleCount as number
      denominator = row.sampleCount as number
      break
    default:
      return null
  }
  if (!Number.isSafeInteger(numerator) || numerator < 0
    || !Number.isSafeInteger(denominator) || denominator <= 0
    || numerator > denominator) return null
  return deepFreeze({
    evaluationClass: input.artifact.kind,
    metricId: `release:${input.artifact.kind}:${row.recordId}:canonical_ratio`,
    numerator,
    denominator,
    value: numerator / denominator,
  })
}

function packageCountsFromBundle(bundle: DnaReleaseEvidenceBundle) {
  return Object.freeze({
    sources: bundle.catalog.counts.sources,
    passages: bundle.catalog.counts.passages,
    claims: bundle.catalog.counts.claims,
    claimPassageLinks: bundle.catalog.counts.claimPassageLinks,
  })
}

function artifactVerificationSha256(
  value: Omit<DnaReleaseEvidenceArtifactVerification, "verificationSha256">,
): string {
  return sha256(value)
}

function validateDerivedSignals(value: unknown): value is DnaReleaseEvidenceDerivedSignals {
  if (!exactKeys(value, [
    "runId", "complete", "v3PackageCounts", "evaluationAttestationValid",
    "crossAccountLeakCount", "piiLeakCount", "criticalSafetyClinicalAnswerCount",
    "unreportedCaseFindingCount", "uncitedMaterialClaimCount",
    "fabricatedOrWrongSourceCount", "liveClaimWithoutPassageCount",
    "metadataOnlySourceUseCount", "activeRetractedSourceCount", "licenseViolationCount",
    "auditFailOpenCount", "pendingContentPublishedCount", "lockedBenchmarkIntegrityValid",
    "criticalUxWarningMissingCount", "killSwitchConfigured",
    "marketingClaimsWithoutEvidenceCount", "performanceBudgetViolationCount",
    "performanceEvidenceComplete",
  ])) return false
  if ((value.runId !== null && (
    typeof value.runId !== "string" || !IDENTIFIER.test(value.runId)
  )) || typeof value.complete !== "boolean"
    || typeof value.evaluationAttestationValid !== "boolean"
    || typeof value.lockedBenchmarkIntegrityValid !== "boolean"
    || typeof value.killSwitchConfigured !== "boolean"
    || typeof value.performanceEvidenceComplete !== "boolean"
    || !validPackageCounts(value.v3PackageCounts)) return false
  return [
    value.crossAccountLeakCount,
    value.piiLeakCount,
    value.criticalSafetyClinicalAnswerCount,
    value.unreportedCaseFindingCount,
    value.uncitedMaterialClaimCount,
    value.fabricatedOrWrongSourceCount,
    value.liveClaimWithoutPassageCount,
    value.metadataOnlySourceUseCount,
    value.activeRetractedSourceCount,
    value.licenseViolationCount,
    value.auditFailOpenCount,
    value.pendingContentPublishedCount,
    value.criticalUxWarningMissingCount,
    value.marketingClaimsWithoutEvidenceCount,
    value.performanceBudgetViolationCount,
  ].every(isNonnegativeInteger)
}

export function validateDnaReleaseEvidenceArtifactVerification(
  value: unknown,
): value is DnaReleaseEvidenceArtifactVerification {
  if (!exactKeys(value, [
    "schemaVersion", "bundleSha256", "rows", "derivedSignals", "valid",
    "verificationSha256",
  ])
    || value.schemaVersion !== DNA_RELEASE_EVIDENCE_ARTIFACT_VERIFICATION_VERSION
    || typeof value.bundleSha256 !== "string" || !SHA256.test(value.bundleSha256)
    || typeof value.valid !== "boolean"
    || typeof value.verificationSha256 !== "string" || !SHA256.test(value.verificationSha256)
    || !Array.isArray(value.rows) || value.rows.length === 0
    || !validateDerivedSignals(value.derivedSignals)) return false
  const statuses = new Set([
    "pass", "missing", "not_regular_file", "path_outside_root", "invalid_jsonl",
    "invalid_row_schema", "row_binding_mismatch", "run_binding_mismatch",
    "content_status_mismatch", "aggregate_mismatch", "hash_mismatch",
    "row_count_mismatch",
  ])
  for (const row of value.rows) {
    if (!exactKeys(row, [
      "id", "kind", "path", "expectedSha256", "actualSha256", "expectedRowCount",
      "actualRowCount", "runId", "contentStatus", "status",
    ]) || typeof row.id !== "string" || !IDENTIFIER.test(row.id)
      || !isArtifactKind(row.kind)
      || typeof row.path !== "string" || !RELATIVE_ARTIFACT_PATH.test(row.path)
      || typeof row.expectedSha256 !== "string" || !SHA256.test(row.expectedSha256)
      || (row.actualSha256 !== null && (
        typeof row.actualSha256 !== "string" || !SHA256.test(row.actualSha256)
      ))
      || !isNonnegativeInteger(row.expectedRowCount)
      || (row.actualRowCount !== null && !isNonnegativeInteger(row.actualRowCount))
      || (row.runId !== null && (typeof row.runId !== "string" || !IDENTIFIER.test(row.runId)))
      || (row.contentStatus !== null && ![
        "pass", "fail", "not_run", "blocked",
      ].includes(row.contentStatus as string))
      || typeof row.status !== "string" || !statuses.has(row.status)) return false
  }
  const rowIds = value.rows.map((row) => row.id)
  const observedRunIds = [...new Set(value.rows
    .map((row) => row.runId)
    .filter((runId): runId is string => runId !== null))]
  const expectedDerivedRunId = observedRunIds.length === 1 ? observedRunIds[0]! : null
  if (new Set(rowIds).size !== rowIds.length
    || rowIds.some((id, index) => index > 0 && rowIds[index - 1]!.localeCompare(id, "en") > 0)
    || value.derivedSignals.runId !== expectedDerivedRunId
    || value.valid !== (
      value.rows.every((row) => row.status === "pass") && value.derivedSignals.complete
    )) return false
  const { verificationSha256, ...payload } = value as unknown as DnaReleaseEvidenceArtifactVerification
  return artifactVerificationSha256(payload) === verificationSha256
}

/**
 * Offline release compiler gate. Every evidence descriptor is rebound to one
 * regular JSONL file below the explicitly supplied evidence root. Symlinks
 * escaping that root, missing files, malformed or wrong-kind JSONL, release /
 * run / git / engine / package binding drift, descriptor-status drift, hash
 * drift and row-count drift fail closed. Safety, privacy, performance and
 * marketing signals are derived from these rebound rows.
 */
export function verifyDnaReleaseEvidenceBundleArtifacts(input: Readonly<{
  bundle: DnaReleaseEvidenceBundle
  evidenceRoot: string
}>): DnaReleaseEvidenceArtifactVerification {
  if (!validateDnaReleaseEvidenceBundle(input.bundle)) {
    throw new Error("dna_release_evidence_bundle_invalid")
  }
  const root = realpathSync(resolve(input.evidenceRoot))
  const parsedByArtifactId = new Map<string, ParsedArtifactContent>()
  const rows = input.bundle.artifacts.map((artifact): DnaReleaseEvidenceArtifactVerificationRow => {
    const lexicalPath = resolve(root, artifact.path)
    const lexicalRelative = relative(root, lexicalPath)
    const base = {
      id: artifact.id,
      kind: artifact.kind,
      path: artifact.path,
      expectedSha256: artifact.sha256,
      actualSha256: null,
      expectedRowCount: artifact.rowCount,
      actualRowCount: null,
      runId: null,
      contentStatus: null,
    }
    if (lexicalRelative === ".." || lexicalRelative.startsWith(`..${sep}`) || isAbsolute(lexicalRelative)) {
      return Object.freeze({ ...base, status: "path_outside_root" })
    }
    try {
      if (!lstatSync(lexicalPath).isFile()) {
        return Object.freeze({ ...base, status: "not_regular_file" })
      }
      const realPath = realpathSync(lexicalPath)
      const realRelative = relative(root, realPath)
      if (realRelative === ".." || realRelative.startsWith(`..${sep}`) || isAbsolute(realRelative)) {
        return Object.freeze({ ...base, status: "path_outside_root" })
      }
      const bytes = readFileSync(realPath)
      const actualSha256 = sha256Bytes(bytes)
      const parsedRows = parseJsonlRows(bytes)
      if (parsedRows === null) {
        return Object.freeze({ ...base, actualSha256, status: "invalid_jsonl" })
      }
      const actualRowCount = parsedRows.length
      if (actualSha256 !== artifact.sha256) {
        return Object.freeze({ ...base, actualSha256, actualRowCount, status: "hash_mismatch" })
      }
      if (actualRowCount !== artifact.rowCount) {
        return Object.freeze({ ...base, actualSha256, actualRowCount, status: "row_count_mismatch" })
      }
      const outcomes = parsedRows.map((row) => rowSchemaAndOutcome(row, artifact, input.bundle))
      if (outcomes.some((outcome) => outcome.schema === "invalid_schema")) {
        return Object.freeze({
          ...base, actualSha256, actualRowCount, status: "invalid_row_schema",
        })
      }
      if (outcomes.some((outcome) => outcome.schema === "binding_mismatch")) {
        return Object.freeze({
          ...base, actualSha256, actualRowCount, status: "row_binding_mismatch",
        })
      }
      const recordIds = parsedRows.map((row) => row.recordId as string)
      if (new Set(recordIds).size !== recordIds.length) {
        return Object.freeze({
          ...base, actualSha256, actualRowCount, status: "invalid_row_schema",
        })
      }
      const runIds = [...new Set(parsedRows.map((row) => row.runId as string))]
      if (runIds.length !== 1) {
        return Object.freeze({
          ...base, actualSha256, actualRowCount, status: "run_binding_mismatch",
        })
      }
      const rowPasses = outcomes.map((outcome) => outcome.passed)
      const contentStatus: DnaReleaseEvidenceStatus = rowPasses.every(Boolean) ? "pass" : "fail"
      if (artifact.status !== contentStatus) {
        return Object.freeze({
          ...base, actualSha256, actualRowCount, runId: runIds[0]!, contentStatus,
          status: "content_status_mismatch",
        })
      }
      parsedByArtifactId.set(artifact.id, Object.freeze({
        artifact,
        rows: parsedRows,
        runId: runIds[0]!,
        rowPasses: Object.freeze(rowPasses),
        contentStatus,
      }))
      return Object.freeze({
        ...base, actualSha256, actualRowCount, runId: runIds[0]!, contentStatus,
        status: "pass",
      })
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : ""
      return Object.freeze({ ...base, status: code === "ENOENT" ? "missing" : "not_regular_file" })
    }
  }).sort((left, right) => left.id.localeCompare(right.id, "en"))

  const mutableRows = rows.map((row) => ({ ...row }))
  const markKindInvalid = (kind: DnaReleaseEvidenceArtifactKind) => {
    for (const row of mutableRows) {
      if (row.kind === kind && row.status === "pass") row.status = "aggregate_mismatch"
    }
  }
  const artifactsByKind = new Map<DnaReleaseEvidenceArtifactKind, ParsedArtifactContent[]>()
  for (const parsed of parsedByArtifactId.values()) {
    const current = artifactsByKind.get(parsed.artifact.kind) ?? []
    current.push(parsed)
    artifactsByKind.set(parsed.artifact.kind, current)
  }
  for (const kind of ARTIFACT_KINDS) {
    if ((artifactsByKind.get(kind)?.length ?? 0) !== 1) markKindInvalid(kind)
  }
  const artifactKindCoverageComplete = ARTIFACT_KINDS.every((kind) => (
    artifactsByKind.get(kind)?.length === 1
  ))

  const runIds = [...new Set([...parsedByArtifactId.values()].map((parsed) => parsed.runId))]
  if (runIds.length !== 1) {
    for (const row of mutableRows) {
      if (row.status === "pass") row.status = "run_binding_mismatch"
    }
  }

  const manifest = artifactsByKind.get("test_manifest")?.[0]
  const manifestTargets = new Map<DnaReleaseEvidenceArtifactKind, JsonRow>()
  if (manifest) {
    for (const row of manifest.rows) {
      const kind = row.targetKind as DnaReleaseEvidenceArtifactKind
      if (manifestTargets.has(kind)) markKindInvalid("test_manifest")
      manifestTargets.set(kind, row)
      const counts = row.packageCounts
      const expectedCounts = packageCountsFromBundle(input.bundle)
      if (!validPackageCounts(counts)
        || Object.keys(expectedCounts).some((key) => (
          counts[key as keyof typeof counts] !== expectedCounts[key as keyof typeof expectedCounts]
        ))) markKindInvalid("test_manifest")
    }
    for (const kind of RESULT_ARTIFACT_KINDS) {
      const target = manifestTargets.get(kind)
      const targetArtifact = artifactsByKind.get(kind)?.[0]
      if (!target || !targetArtifact
        || target.targetRowCount !== targetArtifact.rows.length
        || target.required !== true) {
        markKindInvalid("test_manifest")
        markKindInvalid(kind)
      }
    }
    if (manifestTargets.size !== RESULT_ARTIFACT_KINDS.length) markKindInvalid("test_manifest")
  } else {
    markKindInvalid("test_manifest")
  }
  const manifestCoverageComplete = Boolean(manifest
    && manifestTargets.size === RESULT_ARTIFACT_KINDS.length
    && RESULT_ARTIFACT_KINDS.every((kind) => {
      const target = manifestTargets.get(kind)
      const targetArtifact = artifactsByKind.get(kind)?.[0]
      return Boolean(target && targetArtifact && target.required === true
        && target.targetRowCount === targetArtifact.rows.length)
    }))

  const security = artifactsByKind.get("security_results")?.[0]
  const securityRowsByCheck = new Map<string, Array<{ row: JsonRow; passed: boolean }>>()
  if (security) {
    security.rows.forEach((row, index) => {
      const current = securityRowsByCheck.get(row.check as string) ?? []
      current.push({ row, passed: security.rowPasses[index]! })
      securityRowsByCheck.set(row.check as string, current)
    })
    if (SECURITY_CHECKS.some((check) => securityRowsByCheck.get(check)?.length !== 1)) {
      markKindInvalid("security_results")
    }
  }
  const securityCoverageComplete = Boolean(security && SECURITY_CHECKS.every((check) => (
    securityRowsByCheck.get(check)?.length === 1
  )))

  const crossAccount = artifactsByKind.get("cross_account_results")?.[0]
  const crossAccountScenarioCounts = new Map<string, number>()
  for (const row of crossAccount?.rows ?? []) {
    crossAccountScenarioCounts.set(
      row.scenario as string,
      (crossAccountScenarioCounts.get(row.scenario as string) ?? 0) + 1,
    )
  }
  const privacyCoverageComplete = Boolean(crossAccount && CROSS_ACCOUNT_SCENARIOS.every((scenario) => (
    crossAccountScenarioCounts.get(scenario) === 1
  )))
  if (!privacyCoverageComplete) markKindInvalid("cross_account_results")

  const performance = artifactsByKind.get("performance_results")?.[0]
  const performanceRowsByMetric = new Map<string, Array<{ row: JsonRow; passed: boolean }>>()
  if (performance) {
    performance.rows.forEach((row, index) => {
      const current = performanceRowsByMetric.get(row.metric as string) ?? []
      current.push({ row, passed: performance.rowPasses[index]! })
      performanceRowsByMetric.set(row.metric as string, current)
    })
    if (PERFORMANCE_METRICS.some((metric) => performanceRowsByMetric.get(metric)?.length !== 1)) {
      markKindInvalid("performance_results")
    }
    const productionP95 = performanceRowsByMetric.get("production_api_p95_ms")?.[0]?.row
    const productionP99 = performanceRowsByMetric.get("production_api_p99_ms")?.[0]?.row
    if (!productionP95 || !productionP99
      || productionP95.sampleCount !== productionP99.sampleCount
      || (productionP99.observedValue as number) < (productionP95.observedValue as number)) {
      markKindInvalid("performance_results")
    }
  }
  const performanceMetricCoverageComplete = Boolean(performance
    && PERFORMANCE_METRICS.every((metric) => performanceRowsByMetric.get(metric)?.length === 1))

  const marketing = artifactsByKind.get("marketing_evidence")?.[0]
  const artifactsById = new Map(input.bundle.artifacts.map((artifact) => [artifact.id, artifact]))
  const marketingClaimIds = marketing?.rows.map((row) => row.claimId as string) ?? []
  const duplicateMarketingClaimIds = new Set(marketingClaimIds.filter((claimId, index) => (
    marketingClaimIds.indexOf(claimId) !== index
  )))
  const marketingManifestIds = new Set(marketing?.rows.map((row) => row.manifestId as string) ?? [])
  const marketingManifestContentHashes = new Set(marketing?.rows
    .map((row) => row.manifestContentSha256 as string) ?? [])
  let unsupportedMarketingRows = marketing ? 0 : input.bundle.marketingEvidence.claimCount
  for (const row of marketing?.rows ?? []) {
    const targetArtifact = artifactsById.get(row.evidenceArtifactId as string)
    const targetParsed = targetArtifact ? parsedByArtifactId.get(targetArtifact.id) : undefined
    const targetRows = targetParsed?.rows.filter((candidate) => (
      candidate.recordId === row.evidenceRecordId
    )) ?? []
    const metric = targetArtifact && targetRows.length === 1
      ? deriveDnaCanonicalMarketingMetric({
        bundle: input.bundle,
        artifact: targetArtifact,
        row: targetRows[0]!,
      })
      : null
    const linkMatches = Boolean(targetArtifact && targetParsed
      && targetArtifact.kind !== "test_manifest"
      && targetArtifact.kind !== "marketing_evidence"
      && targetArtifact.id === row.evidenceArtifactId
      && targetArtifact.kind === row.evidenceArtifactKind
      && targetArtifact.path === row.evidenceArtifactPath
      && targetArtifact.sha256 === row.evidenceArtifactSha256
      && targetRows.length === 1
      && metric
      && row.claimSha256 === dnaReleaseMarketingClaimBindingSha256({
        manifestId: row.manifestId as string,
        manifestContentSha256: row.manifestContentSha256 as string,
        claimId: row.claimId as string,
        evidenceArtifactId: targetArtifact.id,
        evidenceArtifactKind: targetArtifact.kind as DnaReleaseMarketingClaimBinding["evidenceArtifactKind"],
        evidenceArtifactPath: targetArtifact.path,
        evidenceArtifactSha256: targetArtifact.sha256,
        evidenceRecordId: row.evidenceRecordId as string,
        metric: metric!,
      }))
    if (!linkMatches || duplicateMarketingClaimIds.has(row.claimId as string)) {
      unsupportedMarketingRows += 1
    }
  }
  if (!marketing
    || marketing.rows.length !== input.bundle.marketingEvidence.claimCount
    || unsupportedMarketingRows > 0
    || unsupportedMarketingRows !== input.bundle.marketingEvidence.unsupportedClaimCount
    || marketing.artifact.sha256 !== input.bundle.marketingEvidence.manifestSha256
    || marketingManifestIds.size !== 1
    || marketingManifestContentHashes.size !== 1
    || duplicateMarketingClaimIds.size > 0) {
    markKindInvalid("marketing_evidence")
  }

  const sumRows = (parsed: ParsedArtifactContent | undefined, field: string): number => (
    parsed?.rows.reduce((total, row) => total + (isNonnegativeInteger(row[field])
      ? row[field] as number
      : 0), 0) ?? 0
  )
  const securityFindings = (check: string): number => (
    securityRowsByCheck.get(check)?.reduce((total, entry) => (
      total + (entry.row.findingCount as number)
    ), 0) ?? 0
  )
  const securityCheckPassed = (check: string): boolean => {
    const checkRows = securityRowsByCheck.get(check)
    return Boolean(checkRows?.length && checkRows.every((entry) => entry.passed))
  }
  const performanceMetricViolationCount = PERFORMANCE_METRICS.reduce((count, metric) => {
    const metricRows = performanceRowsByMetric.get(metric)
    return count + (!metricRows || metricRows.length !== 1 || !metricRows[0]!.passed ? 1 : 0)
  }, 0)
  const productionP95 = performanceRowsByMetric.get("production_api_p95_ms")?.[0]?.row
  const productionP99 = performanceRowsByMetric.get("production_api_p99_ms")?.[0]?.row
  const productionPairValid = Boolean(productionP95 && productionP99
    && productionP95.sampleCount === productionP99.sampleCount
    && (productionP99.observedValue as number) >= (productionP95.observedValue as number))
  const performanceEvidenceComplete = performanceMetricViolationCount === 0 && productionPairValid

  const finalizedRows = Object.freeze(mutableRows
    .sort((left, right) => left.id.localeCompare(right.id, "en"))
    .map((row) => Object.freeze(row)))
  const structuralComplete = finalizedRows.every((row) => row.status === "pass")
    && runIds.length === 1
    && artifactKindCoverageComplete
    && manifestCoverageComplete
    && securityCoverageComplete
    && privacyCoverageComplete
    && performanceMetricCoverageComplete
  const packageCounts = structuralComplete && manifest
    ? packageCountsFromBundle(input.bundle)
    : Object.freeze({ sources: 0, passages: 0, claims: 0, claimPassageLinks: 0 })
  const derivedSignals: DnaReleaseEvidenceDerivedSignals = deepFreeze({
    runId: runIds.length === 1 ? runIds[0]! : null,
    complete: structuralComplete,
    v3PackageCounts: packageCounts,
    evaluationAttestationValid: securityCheckPassed("evaluation_attestation_integrity"),
    crossAccountLeakCount: sumRows(crossAccount, "crossAccountLeakCount"),
    piiLeakCount: sumRows(crossAccount, "piiLeakCount"),
    criticalSafetyClinicalAnswerCount: securityFindings("critical_safety_clinical_answer"),
    unreportedCaseFindingCount: securityFindings("unreported_case_finding"),
    uncitedMaterialClaimCount: securityFindings("uncited_material_claim"),
    fabricatedOrWrongSourceCount: securityFindings("fabricated_or_wrong_source"),
    liveClaimWithoutPassageCount: securityFindings("live_claim_without_passage"),
    metadataOnlySourceUseCount: securityFindings("metadata_only_source_use"),
    activeRetractedSourceCount: securityFindings("active_retracted_source"),
    licenseViolationCount: securityFindings("license_violation"),
    auditFailOpenCount: securityFindings("audit_fail_open"),
    pendingContentPublishedCount: securityFindings("pending_content_published"),
    lockedBenchmarkIntegrityValid: securityCheckPassed("locked_benchmark_integrity"),
    criticalUxWarningMissingCount: securityFindings("critical_ux_warning"),
    killSwitchConfigured: securityCheckPassed("kill_switch_configuration"),
    marketingClaimsWithoutEvidenceCount: unsupportedMarketingRows,
    performanceBudgetViolationCount: performanceMetricViolationCount + (productionPairValid ? 0 : 1),
    performanceEvidenceComplete,
  })
  const payload = {
    schemaVersion: DNA_RELEASE_EVIDENCE_ARTIFACT_VERIFICATION_VERSION,
    bundleSha256: input.bundle.bundleSha256,
    rows: finalizedRows,
    derivedSignals,
    valid: structuralComplete,
  } as const
  const result = {
    ...payload,
    verificationSha256: artifactVerificationSha256(payload),
  }
  if (!validateDnaReleaseEvidenceArtifactVerification(result)) {
    throw new Error("dna_release_evidence_artifact_verification_invalid")
  }
  return deepFreeze(result)
}

/** No package is fabricated before real Phase 38-47 evidence exists. */
export const DNA_CURRENT_V3_RELEASE_EVIDENCE_BUNDLE: DnaReleaseEvidenceBundle | null = null

/** Populated only by the offline compiler after every artifact file is rebound. */
export const DNA_CURRENT_V3_RELEASE_ARTIFACT_VERIFICATION:
  DnaReleaseEvidenceArtifactVerification | null = null

/** Repository-owned root containing the exact current bundle artifacts. */
export const DNA_CURRENT_V3_RELEASE_EVIDENCE_ROOT: string | null = null

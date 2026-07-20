import { createHash } from "node:crypto"
import { lstatSync, readFileSync, realpathSync } from "node:fs"
import { isAbsolute, relative, resolve, sep } from "node:path"

import {
  deriveDnaCanonicalMarketingMetric,
  dnaReleaseMarketingClaimBindingSha256,
  validateDnaReleaseEvidenceArtifactVerification,
  validateDnaReleaseEvidenceBundle,
  verifyDnaReleaseEvidenceBundleArtifacts,
  type DnaReleaseEvidenceArtifact,
  type DnaReleaseEvidenceArtifactKind,
  type DnaReleaseEvidenceArtifactVerification,
  type DnaReleaseEvidenceBundle,
  type DnaReleaseEvidenceJsonRow,
  type DnaReleaseMarketingClaimBinding,
  type DnaReleaseMarketingEvidenceLinkRow,
} from "../release/releaseEvidenceBundle"
import {
  evaluateDnaReleaseHardNoGo,
  type DnaReleaseHardNoGoSignals,
} from "../release/hardNoGo"

export const DNA_MARKETING_EVIDENCE_MANIFEST_VERSION = "dna-marketing-evidence-manifest@1" as const
/** Legacy self-authored claim rows are retained as a named schema only; they can no longer authorize claims. */
export const DNA_MARKETING_CLAIM_EVIDENCE_VERSION = "dna-marketing-claim-evidence@1" as const
export const DNA_MARKETING_EVIDENCE_VERIFICATION_VERSION =
  "dna-marketing-evidence-verification@2" as const

export const DNA_MARKETING_CLAIM_TYPES = Object.freeze([
  "architecture",
  "inventory",
  "performance",
  "security",
  "privacy",
  "speed",
  "clinical_benefit",
  "comparative_advantage",
  "cost",
] as const)

export type DnaMarketingClaimType = (typeof DNA_MARKETING_CLAIM_TYPES)[number]
export type DnaMarketingClaimStatus = "draft" | "active" | "suspended" | "expired"

/**
 * Only evidence classes whose current release rows carry a meaningful tested
 * denominator may authorize an active claim. Other public claim types remain
 * draft-only until a dedicated exact-row schema exists. In particular, a
 * generic benchmark cannot stand in for clinical benefit or superiority.
 */
export const DNA_ACTIVE_MARKETING_CLAIM_EVIDENCE_POLICY = Object.freeze({
  performance: Object.freeze(["category_results"] as const),
  security: Object.freeze(["security_results"] as const),
  privacy: Object.freeze(["cross_account_results"] as const),
})

export type DnaMarketingEvidenceClaim = Readonly<{
  claimId: string
  publicTextTr: string
  claimType: DnaMarketingClaimType
  engineVersion: string
  catalogVersion: string
  evaluationClass: string
  releaseId: string
  packageSha256: string
  gitSha: string
  evaluationRunId: string
  metricId: string
  evidenceArtifact: string
  evidenceArtifactSha256: string
  numerator: number
  denominator: number
  value: number
  confidenceInterval: Readonly<{
    lower: number
    upper: number
    method: string
  }> | null
  conditions: readonly string[]
  knownLimitations: readonly string[]
  validFrom: string
  status: DnaMarketingClaimStatus
}>

export type DnaMarketingEvidenceManifest = Readonly<{
  schemaVersion: typeof DNA_MARKETING_EVIDENCE_MANIFEST_VERSION
  manifestId: string
  releaseStatus: "no_go" | "ready"
  v3ReleaseReady: boolean
  claims: readonly DnaMarketingEvidenceClaim[]
  knownBlocks: readonly string[]
}>

export type DnaMarketingManifestValidation = Readonly<{
  valid: boolean
  reasonCodes: readonly string[]
  activeClaimIds: readonly string[]
}>

export type DnaMarketingEvidenceReleaseBinding = Readonly<{
  releaseId: string
  engineVersion: string
  catalogVersion: string
  packageSha256: string
  gitSha: string
  evaluationRunId: string
}>

/** @deprecated A self-authored claim metric row is never accepted by the V2 verifier. */
export type DnaMarketingClaimEvidenceRow = Readonly<{
  schemaVersion: typeof DNA_MARKETING_CLAIM_EVIDENCE_VERSION
  claimId: string
  releaseId: string
  engineVersion: string
  catalogVersion: string
  packageSha256: string
  gitSha: string
  evaluationRunId: string
  evaluationClass: string
  metricId: string
  numerator: number
  denominator: number
  value: number
}>

export type DnaMarketingClaimEvidenceVerificationRow = Readonly<{
  claimId: string
  linkRecordId: string | null
  evidenceArtifactId: string | null
  evidenceArtifactKind: DnaReleaseEvidenceArtifactKind | null
  artifactPath: string | null
  expectedSha256: string | null
  actualSha256: string | null
  evidenceRecordId: string | null
  numerator: number | null
  denominator: number | null
  value: number | null
  status:
    | "pass"
    | "marketing_link_missing"
    | "marketing_link_duplicate"
    | "claim_binding_mismatch"
    | "evidence_binding_mismatch"
    | "evidence_row_missing"
    | "evidence_row_duplicate"
    | "metric_mismatch"
}>

export type DnaMarketingEvidenceVerification = Readonly<{
  schemaVersion: typeof DNA_MARKETING_EVIDENCE_VERIFICATION_VERSION
  manifestId: string
  manifestArtifactId: string
  manifestArtifactPath: string
  manifestArtifactSha256: string
  manifestContentSha256: string
  releaseBundleSha256: string
  releaseArtifactVerificationSha256: string
  release: DnaMarketingEvidenceReleaseBinding
  manifestStatus:
    | "pass"
    | "release_evidence_invalid"
    | "release_no_go"
    | "marketing_artifact_missing"
    | "marketing_artifact_mismatch"
    | "invalid_jsonl"
    | "content_mismatch"
  claims: readonly DnaMarketingClaimEvidenceVerificationRow[]
  verifiedActiveClaimIds: readonly string[]
  valid: boolean
  verificationSha256: string
}>

const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{0,199}$/
const SHA256 = /^[a-f0-9]{64}$/
const GIT_SHA = /^[a-f0-9]{40}$/
const EVIDENCE_TARGET_KINDS = Object.freeze([
  "row_results",
  "category_results",
  "security_results",
  "cross_account_results",
  "performance_results",
] as const)

function sortedUnique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values.filter(Boolean))].sort())
}

function validArtifactPath(value: string): boolean {
  return Boolean(value)
    && !value.startsWith("/")
    && !value.includes("\\")
    && !value.split("/").some((part) => part === "" || part === "." || part === "..")
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort((left, right) => left.localeCompare(right, "en"))
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`
}

function sha256Bytes(value: string | Buffer): string {
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

function equalMetric(left: number, right: number): boolean {
  return Number.isFinite(left) && Number.isFinite(right)
    && Math.abs(left - right) <= Number.EPSILON * Math.max(1, Math.abs(left), Math.abs(right)) * 8
}

function validReleaseBinding(value: unknown): value is DnaMarketingEvidenceReleaseBinding {
  return exactKeys(value, [
    "releaseId", "engineVersion", "catalogVersion", "packageSha256", "gitSha", "evaluationRunId",
  ])
    && typeof value.releaseId === "string" && SAFE_ID.test(value.releaseId)
    && typeof value.engineVersion === "string" && SAFE_ID.test(value.engineVersion)
    && typeof value.catalogVersion === "string" && SAFE_ID.test(value.catalogVersion)
    && typeof value.packageSha256 === "string" && SHA256.test(value.packageSha256)
    && typeof value.gitSha === "string" && GIT_SHA.test(value.gitSha)
    && typeof value.evaluationRunId === "string" && SAFE_ID.test(value.evaluationRunId)
}

export function dnaMarketingEvidenceManifestContentSha256(
  manifest: DnaMarketingEvidenceManifest,
): string {
  return sha256Bytes(stableJson(manifest))
}

function verificationPayloadSha256(
  value: Omit<DnaMarketingEvidenceVerification, "verificationSha256">,
): string {
  return sha256Bytes(stableJson(value))
}

function validateDnaMarketingEvidenceManifestStructure(
  manifest: DnaMarketingEvidenceManifest,
): DnaMarketingManifestValidation {
  const reasons: string[] = []
  if (manifest.schemaVersion !== DNA_MARKETING_EVIDENCE_MANIFEST_VERSION) {
    reasons.push("marketing_manifest_schema_invalid")
  }
  if (!SAFE_ID.test(manifest.manifestId)) reasons.push("marketing_manifest_id_invalid")
  if (manifest.releaseStatus !== "no_go" && manifest.releaseStatus !== "ready") {
    reasons.push("marketing_manifest_release_status_invalid")
  }
  if (manifest.v3ReleaseReady !== (manifest.releaseStatus === "ready")) {
    reasons.push("marketing_manifest_release_state_inconsistent")
  }
  if (!Array.isArray(manifest.knownBlocks)
    || manifest.knownBlocks.some((block) => typeof block !== "string" || !block.trim())
    || new Set(manifest.knownBlocks).size !== manifest.knownBlocks.length) {
    reasons.push("marketing_manifest_known_blocks_invalid")
  } else if (manifest.releaseStatus === "no_go" && manifest.knownBlocks.length === 0) {
    reasons.push("marketing_manifest_no_go_without_block")
  } else if (manifest.releaseStatus === "ready" && manifest.knownBlocks.length !== 0) {
    reasons.push("marketing_manifest_ready_with_known_block")
  }
  if (!Array.isArray(manifest.claims)) {
    return Object.freeze({
      valid: false,
      reasonCodes: sortedUnique([...reasons, "marketing_manifest_claims_invalid"]),
      activeClaimIds: Object.freeze([]),
    })
  }
  const claimIds = manifest.claims.map((claim) => claim.claimId)
  if (new Set(claimIds).size !== claimIds.length) reasons.push("marketing_claim_id_duplicate")
  for (const claim of manifest.claims) {
    const prefix = `marketing_claim:${claim.claimId || "<empty>"}`
    if (!SAFE_ID.test(claim.claimId)) reasons.push(`${prefix}:id_invalid`)
    if (!claim.publicTextTr.trim()) reasons.push(`${prefix}:public_text_missing`)
    if (!DNA_MARKETING_CLAIM_TYPES.includes(claim.claimType)) reasons.push(`${prefix}:type_invalid`)
    if (!["draft", "active", "suspended", "expired"].includes(claim.status)) {
      reasons.push(`${prefix}:status_invalid`)
    }
    if (!SAFE_ID.test(claim.engineVersion) || !SAFE_ID.test(claim.catalogVersion)) {
      reasons.push(`${prefix}:version_invalid`)
    }
    if (!SAFE_ID.test(claim.evaluationClass)) reasons.push(`${prefix}:evaluation_class_invalid`)
    if (!SAFE_ID.test(claim.releaseId)) reasons.push(`${prefix}:release_id_invalid`)
    if (!SHA256.test(claim.packageSha256)) reasons.push(`${prefix}:package_hash_invalid`)
    if (!GIT_SHA.test(claim.gitSha)) reasons.push(`${prefix}:git_sha_invalid`)
    if (!SAFE_ID.test(claim.evaluationRunId)) reasons.push(`${prefix}:evaluation_run_id_invalid`)
    if (!SAFE_ID.test(claim.metricId)) reasons.push(`${prefix}:metric_id_invalid`)
    if (!validArtifactPath(claim.evidenceArtifact)) reasons.push(`${prefix}:artifact_path_invalid`)
    if (!SHA256.test(claim.evidenceArtifactSha256)) reasons.push(`${prefix}:artifact_hash_invalid`)
    if (!Number.isSafeInteger(claim.numerator) || claim.numerator < 0
      || !Number.isSafeInteger(claim.denominator) || claim.denominator <= 0
      || claim.numerator > claim.denominator) reasons.push(`${prefix}:fraction_invalid`)
    if (!Number.isFinite(claim.value)
      || !equalMetric(claim.value, claim.numerator / claim.denominator)) {
      reasons.push(`${prefix}:value_invalid`)
    }
    if (claim.confidenceInterval !== null) {
      reasons.push(`${prefix}:confidence_interval_not_canonical`)
    }
    if (claim.confidenceInterval && (
      !Number.isFinite(claim.confidenceInterval.lower)
      || !Number.isFinite(claim.confidenceInterval.upper)
      || claim.confidenceInterval.lower < 0
      || claim.confidenceInterval.upper > 1
      || claim.confidenceInterval.lower > claim.confidenceInterval.upper
      || !claim.confidenceInterval.method.trim()
    )) reasons.push(`${prefix}:confidence_interval_invalid`)
    if (!Array.isArray(claim.conditions) || claim.conditions.length === 0
      || claim.conditions.some((value: unknown) => typeof value !== "string" || !value.trim())) {
      reasons.push(`${prefix}:conditions_missing`)
    }
    if (!Array.isArray(claim.knownLimitations) || claim.knownLimitations.length === 0
      || claim.knownLimitations.some((value: unknown) => typeof value !== "string" || !value.trim())) {
      reasons.push(`${prefix}:limitations_missing`)
    }
    if (!Number.isFinite(Date.parse(claim.validFrom))) reasons.push(`${prefix}:valid_from_invalid`)
    if (claim.status === "active" && !manifest.v3ReleaseReady
      && claim.engineVersion === "dna-chat-engine@3") {
      reasons.push(`${prefix}:active_v3_claim_while_release_no_go`)
    }
    if (claim.status === "active"
      && !(claim.claimType in DNA_ACTIVE_MARKETING_CLAIM_EVIDENCE_POLICY)) {
      reasons.push(`${prefix}:active_claim_type_without_dedicated_evidence_schema`)
    }
  }
  return Object.freeze({
    valid: reasons.length === 0,
    reasonCodes: sortedUnique(reasons),
    activeClaimIds: sortedUnique(manifest.claims
      .filter((claim) => claim.status === "active").map((claim) => claim.claimId)),
  })
}

function verificationMatchesManifest(
  manifest: DnaMarketingEvidenceManifest,
  verification: DnaMarketingEvidenceVerification | null | undefined,
): boolean {
  if (!verification || !validateDnaMarketingEvidenceVerification(verification) || !verification.valid) {
    return false
  }
  const activeIds = sortedUnique(manifest.claims
    .filter((claim) => claim.status === "active").map((claim) => claim.claimId))
  return verification.manifestId === manifest.manifestId
    && verification.manifestContentSha256 === dnaMarketingEvidenceManifestContentSha256(manifest)
    && verification.verifiedActiveClaimIds.length === activeIds.length
    && verification.verifiedActiveClaimIds.every((id, index) => id === activeIds[index])
}

export function validateDnaMarketingEvidenceManifest(
  manifest: DnaMarketingEvidenceManifest,
  verification: DnaMarketingEvidenceVerification | null = null,
): DnaMarketingManifestValidation {
  const structural = validateDnaMarketingEvidenceManifestStructure(manifest)
  const reasons = [...structural.reasonCodes]
  if (structural.activeClaimIds.length > 0 && !verificationMatchesManifest(manifest, verification)) {
    reasons.push("marketing_active_claims_unverified")
  }
  return Object.freeze({
    valid: reasons.length === 0,
    reasonCodes: sortedUnique(reasons),
    activeClaimIds: structural.activeClaimIds,
  })
}

export const DNA_CURRENT_MARKETING_EVIDENCE_MANIFEST: DnaMarketingEvidenceManifest = Object.freeze({
  schemaVersion: DNA_MARKETING_EVIDENCE_MANIFEST_VERSION,
  manifestId: "dna-marketing-evidence.current-v3",
  releaseStatus: "no_go",
  v3ReleaseReady: false,
  claims: Object.freeze([]),
  knownBlocks: Object.freeze([
    "dna_owner_book_not_locked",
    "locked_benchmark_payload_missing",
    "robustness_variation_payload_missing",
    "independent_evaluation_not_completed",
    "v3_static_runtime_package_empty",
  ]),
})

type SafeArtifactRead = Readonly<{
  status: "pass" | "missing" | "not_regular_file" | "path_outside_root"
  bytes: Buffer | null
}>

function readRegularArtifactBelowRoot(root: string, artifactPath: string): SafeArtifactRead {
  if (!validArtifactPath(artifactPath)) {
    return Object.freeze({ status: "path_outside_root", bytes: null })
  }
  const lexicalPath = resolve(root, artifactPath)
  const lexicalRelative = relative(root, lexicalPath)
  if (lexicalRelative === ".." || lexicalRelative.startsWith(`..${sep}`)
    || isAbsolute(lexicalRelative)) {
    return Object.freeze({ status: "path_outside_root", bytes: null })
  }
  try {
    if (!lstatSync(lexicalPath).isFile()) {
      return Object.freeze({ status: "not_regular_file", bytes: null })
    }
    const realPath = realpathSync(lexicalPath)
    const realRelative = relative(root, realPath)
    if (realRelative === ".." || realRelative.startsWith(`..${sep}`) || isAbsolute(realRelative)) {
      return Object.freeze({ status: "path_outside_root", bytes: null })
    }
    return Object.freeze({ status: "pass", bytes: readFileSync(realPath) })
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code)
      : ""
    return Object.freeze({ status: code === "ENOENT" ? "missing" : "not_regular_file", bytes: null })
  }
}

function parseJsonlObjects(bytes: Buffer): readonly Record<string, unknown>[] | null {
  const text = bytes.toString("utf8")
  if (text.includes("\u0000")) return null
  const lines = text.split(/\r?\n/)
  if (lines.at(-1) === "") lines.pop()
  if (lines.length === 0 || lines.some((line) => !line.trim())) return null
  try {
    const rows = lines.map((line) => JSON.parse(line) as unknown)
    return rows.every((row) => row && typeof row === "object" && !Array.isArray(row))
      ? rows as Record<string, unknown>[]
      : null
  } catch {
    return null
  }
}

function releaseBinding(
  bundle: DnaReleaseEvidenceBundle,
  verification: DnaReleaseEvidenceArtifactVerification,
): DnaMarketingEvidenceReleaseBinding | null {
  const evaluationRunId = verification.derivedSignals.runId
  if (!evaluationRunId) return null
  return Object.freeze({
    releaseId: bundle.releaseId,
    engineVersion: bundle.engine.version,
    catalogVersion: bundle.catalog.version,
    packageSha256: bundle.catalog.packageSha256,
    gitSha: bundle.gitSha,
    evaluationRunId,
  })
}

function releaseSignals(
  verification: DnaReleaseEvidenceArtifactVerification,
): DnaReleaseHardNoGoSignals {
  const derived = verification.derivedSignals
  return Object.freeze({
    v3PackageCounts: derived.v3PackageCounts,
    evaluationAttestationValid: derived.evaluationAttestationValid,
    crossAccountLeakCount: derived.crossAccountLeakCount,
    piiLeakCount: derived.piiLeakCount,
    criticalSafetyClinicalAnswerCount: derived.criticalSafetyClinicalAnswerCount,
    unreportedCaseFindingCount: derived.unreportedCaseFindingCount,
    uncitedMaterialClaimCount: derived.uncitedMaterialClaimCount,
    fabricatedOrWrongSourceCount: derived.fabricatedOrWrongSourceCount,
    liveClaimWithoutPassageCount: derived.liveClaimWithoutPassageCount,
    metadataOnlySourceUseCount: derived.metadataOnlySourceUseCount,
    activeRetractedSourceCount: derived.activeRetractedSourceCount,
    licenseViolationCount: derived.licenseViolationCount,
    auditFailOpenCount: derived.auditFailOpenCount,
    pendingContentPublishedCount: derived.pendingContentPublishedCount,
    lockedBenchmarkIntegrityValid: derived.lockedBenchmarkIntegrityValid,
    criticalUxWarningMissingCount: derived.criticalUxWarningMissingCount,
    killSwitchConfigured: derived.killSwitchConfigured,
    marketingClaimsWithoutEvidenceCount: derived.marketingClaimsWithoutEvidenceCount,
  })
}

function validMarketingLinkShape(value: Record<string, unknown>): value is DnaReleaseMarketingEvidenceLinkRow {
  return value.kind === "marketing_evidence"
    && typeof value.recordId === "string" && SAFE_ID.test(value.recordId)
    && typeof value.manifestId === "string" && SAFE_ID.test(value.manifestId)
    && typeof value.manifestContentSha256 === "string" && SHA256.test(value.manifestContentSha256)
    && typeof value.claimId === "string" && SAFE_ID.test(value.claimId)
    && typeof value.claimSha256 === "string" && SHA256.test(value.claimSha256)
    && typeof value.evidenceArtifactId === "string" && SAFE_ID.test(value.evidenceArtifactId)
    && typeof value.evidenceArtifactKind === "string"
    && EVIDENCE_TARGET_KINDS.includes(value.evidenceArtifactKind as never)
    && typeof value.evidenceArtifactPath === "string" && validArtifactPath(value.evidenceArtifactPath)
    && typeof value.evidenceArtifactSha256 === "string" && SHA256.test(value.evidenceArtifactSha256)
    && typeof value.evidenceRecordId === "string" && SAFE_ID.test(value.evidenceRecordId)
}

function claimMatchesRelease(
  claim: DnaMarketingEvidenceClaim,
  release: DnaMarketingEvidenceReleaseBinding,
): boolean {
  return claim.releaseId === release.releaseId
    && claim.engineVersion === release.engineVersion
    && claim.catalogVersion === release.catalogVersion
    && claim.packageSha256 === release.packageSha256
    && claim.gitSha === release.gitSha
    && claim.evaluationRunId === release.evaluationRunId
}

function claimRowBase(claimId: string): Omit<DnaMarketingClaimEvidenceVerificationRow, "status"> {
  return {
    claimId,
    linkRecordId: null,
    evidenceArtifactId: null,
    evidenceArtifactKind: null,
    artifactPath: null,
    expectedSha256: null,
    actualSha256: null,
    evidenceRecordId: null,
    numerator: null,
    denominator: null,
    value: null,
  }
}

function matchingClaimRow(
  claim: DnaMarketingEvidenceClaim,
  link: DnaReleaseMarketingEvidenceLinkRow,
  artifact: DnaReleaseEvidenceArtifact,
  metric: NonNullable<ReturnType<typeof deriveDnaCanonicalMarketingMetric>>,
  manifestContentSha256: string,
): boolean {
  const expectedBinding: DnaReleaseMarketingClaimBinding = {
    manifestId: link.manifestId,
    manifestContentSha256,
    claimId: claim.claimId,
    evidenceArtifactId: artifact.id,
    evidenceArtifactKind: artifact.kind as DnaReleaseMarketingClaimBinding["evidenceArtifactKind"],
    evidenceArtifactPath: artifact.path,
    evidenceArtifactSha256: artifact.sha256,
    evidenceRecordId: link.evidenceRecordId,
    metric,
  }
  const allowedKinds = DNA_ACTIVE_MARKETING_CLAIM_EVIDENCE_POLICY[
    claim.claimType as keyof typeof DNA_ACTIVE_MARKETING_CLAIM_EVIDENCE_POLICY
  ] as readonly DnaReleaseEvidenceArtifactKind[] | undefined
  return Boolean(allowedKinds?.includes(artifact.kind))
    && link.claimSha256 === dnaReleaseMarketingClaimBindingSha256(expectedBinding)
    && claim.evaluationClass === metric.evaluationClass
    && claim.metricId === metric.metricId
    && claim.evidenceArtifact === artifact.path
    && claim.evidenceArtifactSha256 === artifact.sha256
    && claim.numerator === metric.numerator
    && claim.denominator === metric.denominator
    && equalMetric(claim.value, metric.value)
}

export function validateDnaMarketingEvidenceVerification(
  value: unknown,
): value is DnaMarketingEvidenceVerification {
  if (!exactKeys(value, [
    "schemaVersion", "manifestId", "manifestArtifactId", "manifestArtifactPath",
    "manifestArtifactSha256", "manifestContentSha256", "releaseBundleSha256",
    "releaseArtifactVerificationSha256", "release", "manifestStatus", "claims",
    "verifiedActiveClaimIds", "valid", "verificationSha256",
  ]) || value.schemaVersion !== DNA_MARKETING_EVIDENCE_VERIFICATION_VERSION
    || typeof value.manifestId !== "string" || !SAFE_ID.test(value.manifestId)
    || typeof value.manifestArtifactId !== "string" || !SAFE_ID.test(value.manifestArtifactId)
    || typeof value.manifestArtifactPath !== "string" || !validArtifactPath(value.manifestArtifactPath)
    || typeof value.manifestArtifactSha256 !== "string" || !SHA256.test(value.manifestArtifactSha256)
    || typeof value.manifestContentSha256 !== "string" || !SHA256.test(value.manifestContentSha256)
    || typeof value.releaseBundleSha256 !== "string" || !SHA256.test(value.releaseBundleSha256)
    || typeof value.releaseArtifactVerificationSha256 !== "string"
    || !SHA256.test(value.releaseArtifactVerificationSha256)
    || !validReleaseBinding(value.release)
    || ![
      "pass", "release_evidence_invalid", "release_no_go", "marketing_artifact_missing",
      "marketing_artifact_mismatch", "invalid_jsonl", "content_mismatch",
    ].includes(String(value.manifestStatus))
    || !Array.isArray(value.claims) || !Array.isArray(value.verifiedActiveClaimIds)
    || typeof value.valid !== "boolean"
    || typeof value.verificationSha256 !== "string" || !SHA256.test(value.verificationSha256)) {
    return false
  }
  const statuses = new Set([
    "pass", "marketing_link_missing", "marketing_link_duplicate", "claim_binding_mismatch",
    "evidence_binding_mismatch", "evidence_row_missing", "evidence_row_duplicate", "metric_mismatch",
  ])
  for (const row of value.claims) {
    if (!exactKeys(row, [
      "claimId", "linkRecordId", "evidenceArtifactId", "evidenceArtifactKind",
      "artifactPath", "expectedSha256", "actualSha256", "evidenceRecordId",
      "numerator", "denominator", "value", "status",
    ]) || typeof row.claimId !== "string" || !SAFE_ID.test(row.claimId)
      || (row.linkRecordId !== null && (typeof row.linkRecordId !== "string" || !SAFE_ID.test(row.linkRecordId)))
      || (row.evidenceArtifactId !== null && (typeof row.evidenceArtifactId !== "string" || !SAFE_ID.test(row.evidenceArtifactId)))
      || (row.evidenceArtifactKind !== null && !EVIDENCE_TARGET_KINDS.includes(row.evidenceArtifactKind as never))
      || (row.artifactPath !== null && (typeof row.artifactPath !== "string" || !validArtifactPath(row.artifactPath)))
      || (row.expectedSha256 !== null && (typeof row.expectedSha256 !== "string" || !SHA256.test(row.expectedSha256)))
      || (row.actualSha256 !== null && (typeof row.actualSha256 !== "string" || !SHA256.test(row.actualSha256)))
      || (row.evidenceRecordId !== null && (typeof row.evidenceRecordId !== "string" || !SAFE_ID.test(row.evidenceRecordId)))
      || (row.numerator !== null && (typeof row.numerator !== "number"
        || !Number.isSafeInteger(row.numerator) || row.numerator < 0))
      || (row.denominator !== null && (typeof row.denominator !== "number"
        || !Number.isSafeInteger(row.denominator) || row.denominator <= 0))
      || (row.value !== null && (typeof row.value !== "number" || !Number.isFinite(row.value)))
      || typeof row.status !== "string" || !statuses.has(row.status)) return false
  }
  const rows = value.claims as unknown as DnaMarketingClaimEvidenceVerificationRow[]
  const claimIds = rows.map((row) => row.claimId)
  const verifiedIds = value.verifiedActiveClaimIds as string[]
  if (new Set(claimIds).size !== claimIds.length
    || claimIds.some((id, index) => index > 0 && claimIds[index - 1]!.localeCompare(id, "en") > 0)
    || verifiedIds.some((id) => typeof id !== "string" || !SAFE_ID.test(id))
    || new Set(verifiedIds).size !== verifiedIds.length
    || verifiedIds.some((id, index) => index > 0 && verifiedIds[index - 1]!.localeCompare(id, "en") > 0)
    || verifiedIds.some((id) => !rows.some((row) => row.claimId === id && row.status === "pass"))) {
    return false
  }
  const expectedValid = value.manifestStatus === "pass"
    && rows.every((row) => row.status === "pass") && rows.length === verifiedIds.length
  if (value.valid !== expectedValid) return false
  const { verificationSha256, ...payload } = value as unknown as DnaMarketingEvidenceVerification
  return verificationPayloadSha256(payload) === verificationSha256
}

/**
 * Re-verifies the complete immutable release bundle and then reopens both the
 * release-owned marketing index and each linked canonical result artifact.
 * Caller-authored metric JSONL and arbitrary evidence identifiers are not an
 * authorization input.
 */
export type DnaMarketingEvidenceVerifierInput = Readonly<{
  manifest: DnaMarketingEvidenceManifest
  evidenceBundle: DnaReleaseEvidenceBundle
  evidenceRoot: string
}> | Readonly<{
  /** @deprecated Legacy self-authored evidence input; accepted by TypeScript but fails closed. */
  manifest: DnaMarketingEvidenceManifest
  evidenceRoot: string
  manifestArtifactPath: string
  manifestArtifactSha256: string
  release: DnaMarketingEvidenceReleaseBinding
}>

export type DnaMarketingReleaseEvidenceInput = Readonly<{
  bundle: DnaReleaseEvidenceBundle
  evidenceRoot: string
}>

export function verifyDnaMarketingEvidenceManifest(
  input: DnaMarketingEvidenceVerifierInput,
): DnaMarketingEvidenceVerification {
  if (!("evidenceBundle" in input)) {
    throw new Error("dna_marketing_legacy_self_authored_evidence_rejected")
  }
  const structural = validateDnaMarketingEvidenceManifestStructure(input.manifest)
  if (!structural.valid || !validateDnaReleaseEvidenceBundle(input.evidenceBundle)) {
    throw new Error("dna_marketing_evidence_verification_input_invalid")
  }
  const root = realpathSync(resolve(input.evidenceRoot))
  const artifactVerification = verifyDnaReleaseEvidenceBundleArtifacts({
    bundle: input.evidenceBundle,
    evidenceRoot: root,
  })
  const release = releaseBinding(input.evidenceBundle, artifactVerification)
  if (!release) throw new Error("dna_marketing_evidence_release_run_missing")
  const manifestContentSha256 = dnaMarketingEvidenceManifestContentSha256(input.manifest)
  const marketingArtifacts = input.evidenceBundle.artifacts.filter((artifact) => (
    artifact.kind === "marketing_evidence"
  ))
  const marketingArtifact = marketingArtifacts[0]
  let manifestStatus: DnaMarketingEvidenceVerification["manifestStatus"] = "pass"
  if (!validateDnaReleaseEvidenceArtifactVerification(artifactVerification)
    || !artifactVerification.valid) manifestStatus = "release_evidence_invalid"
  else if (evaluateDnaReleaseHardNoGo({
    evidenceBundle: input.evidenceBundle,
    artifactVerification,
    signals: releaseSignals(artifactVerification),
  }).decision !== "go") manifestStatus = "release_no_go"
  else if (marketingArtifacts.length !== 1 || !marketingArtifact) {
    manifestStatus = "marketing_artifact_missing"
  } else if (marketingArtifact.sha256 !== input.evidenceBundle.marketingEvidence.manifestSha256
    || marketingArtifact.rowCount !== input.evidenceBundle.marketingEvidence.claimCount
    || input.evidenceBundle.marketingEvidence.unsupportedClaimCount !== 0) {
    manifestStatus = "marketing_artifact_mismatch"
  }

  const fallbackArtifact: DnaReleaseEvidenceArtifact = marketingArtifact ?? Object.freeze({
    id: "marketing-artifact.missing",
    kind: "marketing_evidence",
    sha256: "0".repeat(64),
    rowCount: 0,
    status: "blocked",
    path: "marketing-artifact-missing.jsonl",
    format: "jsonl",
  })
  const marketingRead = marketingArtifact
    ? readRegularArtifactBelowRoot(root, marketingArtifact.path)
    : Object.freeze({ status: "missing" as const, bytes: null })
  let linkRows: readonly DnaReleaseMarketingEvidenceLinkRow[] = Object.freeze([])
  if (marketingArtifact && (marketingRead.status !== "pass" || !marketingRead.bytes)) {
    manifestStatus = "marketing_artifact_missing"
  } else if (marketingArtifact && marketingRead.bytes) {
    if (sha256Bytes(marketingRead.bytes) !== marketingArtifact.sha256) {
      manifestStatus = "marketing_artifact_mismatch"
    } else {
      const parsed = parseJsonlObjects(marketingRead.bytes)
      if (!parsed || parsed.some((row) => !validMarketingLinkShape(row))) {
        manifestStatus = "invalid_jsonl"
      } else {
        linkRows = Object.freeze(parsed as unknown as DnaReleaseMarketingEvidenceLinkRow[])
        const manifestClaimIds = [...input.manifest.claims.map((claim) => claim.claimId)].sort()
        const linkedClaimIds = [...linkRows.map((row) => row.claimId)].sort()
        if (linkRows.length !== input.manifest.claims.length
          || manifestClaimIds.some((id, index) => linkedClaimIds[index] !== id)
          || linkRows.some((row) => row.manifestId !== input.manifest.manifestId
            || row.manifestContentSha256 !== manifestContentSha256)) {
          manifestStatus = "content_mismatch"
        }
      }
    }
  }

  const artifactsById = new Map(input.evidenceBundle.artifacts.map((artifact) => [artifact.id, artifact]))
  const claimResults = input.manifest.claims.filter((claim) => claim.status === "active")
    .map((claim): DnaMarketingClaimEvidenceVerificationRow => {
      const base = claimRowBase(claim.claimId)
      const matches = linkRows.filter((row) => row.claimId === claim.claimId)
      if (matches.length === 0) return Object.freeze({ ...base, status: "marketing_link_missing" })
      if (matches.length > 1) return Object.freeze({ ...base, status: "marketing_link_duplicate" })
      const link = matches[0]!
      const artifact = artifactsById.get(link.evidenceArtifactId)
      const linkedBase = {
        ...base,
        linkRecordId: link.recordId,
        evidenceArtifactId: link.evidenceArtifactId,
        evidenceArtifactKind: link.evidenceArtifactKind,
        artifactPath: link.evidenceArtifactPath,
        expectedSha256: link.evidenceArtifactSha256,
        evidenceRecordId: link.evidenceRecordId,
      }
      if (!claimMatchesRelease(claim, release)) {
        return Object.freeze({ ...linkedBase, status: "claim_binding_mismatch" })
      }
      if (!artifact || artifact.kind !== link.evidenceArtifactKind
        || artifact.path !== link.evidenceArtifactPath
        || artifact.sha256 !== link.evidenceArtifactSha256) {
        return Object.freeze({ ...linkedBase, status: "evidence_binding_mismatch" })
      }
      const targetRead = readRegularArtifactBelowRoot(root, artifact.path)
      if (targetRead.status !== "pass" || !targetRead.bytes) {
        return Object.freeze({ ...linkedBase, status: "evidence_binding_mismatch" })
      }
      const actualSha256 = sha256Bytes(targetRead.bytes)
      if (actualSha256 !== artifact.sha256) {
        return Object.freeze({ ...linkedBase, actualSha256, status: "evidence_binding_mismatch" })
      }
      const parsed = parseJsonlObjects(targetRead.bytes)
      if (!parsed) return Object.freeze({ ...linkedBase, actualSha256, status: "evidence_binding_mismatch" })
      const evidenceRows = parsed.filter((row) => row.recordId === link.evidenceRecordId)
      if (evidenceRows.length === 0) {
        return Object.freeze({ ...linkedBase, actualSha256, status: "evidence_row_missing" })
      }
      if (evidenceRows.length > 1) {
        return Object.freeze({ ...linkedBase, actualSha256, status: "evidence_row_duplicate" })
      }
      const metric = deriveDnaCanonicalMarketingMetric({
        bundle: input.evidenceBundle,
        artifact,
        row: evidenceRows[0] as DnaReleaseEvidenceJsonRow,
      })
      if (!metric) return Object.freeze({ ...linkedBase, actualSha256, status: "metric_mismatch" })
      const metrics = {
        actualSha256,
        numerator: metric.numerator,
        denominator: metric.denominator,
        value: metric.value,
      }
      if (!matchingClaimRow(claim, link, artifact, metric, manifestContentSha256)) {
        return Object.freeze({ ...linkedBase, ...metrics, status: "metric_mismatch" })
      }
      return Object.freeze({ ...linkedBase, ...metrics, status: "pass" })
    }).sort((left, right) => left.claimId.localeCompare(right.claimId, "en"))

  const verifiedActiveClaimIds = sortedUnique(claimResults
    .filter((row) => row.status === "pass").map((row) => row.claimId))
  const payload = {
    schemaVersion: DNA_MARKETING_EVIDENCE_VERIFICATION_VERSION,
    manifestId: input.manifest.manifestId,
    manifestArtifactId: fallbackArtifact.id,
    manifestArtifactPath: fallbackArtifact.path,
    manifestArtifactSha256: fallbackArtifact.sha256,
    manifestContentSha256,
    releaseBundleSha256: input.evidenceBundle.bundleSha256,
    releaseArtifactVerificationSha256: artifactVerification.verificationSha256,
    release,
    manifestStatus,
    claims: Object.freeze(claimResults),
    verifiedActiveClaimIds,
    valid: manifestStatus === "pass" && claimResults.every((row) => row.status === "pass")
      && claimResults.length === verifiedActiveClaimIds.length,
  } as const
  const result = {
    ...payload,
    verificationSha256: verificationPayloadSha256(payload),
  }
  if (!validateDnaMarketingEvidenceVerification(result)) {
    throw new Error("dna_marketing_evidence_verification_invalid")
  }
  return deepFreeze(result)
}

export function activeDnaMarketingClaimByText(
  manifest: DnaMarketingEvidenceManifest,
  publicTextTr: string,
  releaseEvidence: DnaMarketingReleaseEvidenceInput | null = null,
): DnaMarketingEvidenceClaim | null {
  if (!releaseEvidence) return null
  let verification: DnaMarketingEvidenceVerification
  try {
    verification = verifyDnaMarketingEvidenceManifest({
      manifest,
      evidenceBundle: releaseEvidence.bundle,
      evidenceRoot: releaseEvidence.evidenceRoot,
    })
  } catch {
    return null
  }
  if (!validateDnaMarketingEvidenceManifest(manifest, verification).valid) return null
  return manifest.claims.find((claim) => claim.status === "active"
    && verification?.verifiedActiveClaimIds.includes(claim.claimId)
    && claim.publicTextTr === publicTextTr) ?? null
}

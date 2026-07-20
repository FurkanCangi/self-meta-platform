import {
  DNA_CURRENT_V3_RELEASE_EVIDENCE_BUNDLE,
  DNA_CURRENT_V3_RELEASE_EVIDENCE_ROOT,
  validateDnaReleaseEvidenceArtifactVerification,
  validateDnaReleaseEvidenceBundle,
  verifyDnaReleaseEvidenceBundleArtifacts,
  type DnaReleaseEvidenceArtifactVerification,
  type DnaReleaseEvidenceBundle,
} from "./releaseEvidenceBundle"

export const DNA_RELEASE_HARD_NO_GO_VERSION = "dna-release-hard-no-go@1" as const

export const DNA_RELEASE_HARD_NO_GO_CODES = Object.freeze([
  "release_evidence_missing_or_invalid",
  "evidence_artifact_files_unverified",
  "release_bundle_runtime_counts_mismatch",
  "required_evidence_artifact_missing",
  "required_evidence_artifact_not_passed",
  "dna_book_approval_missing",
  "v3_runtime_package_empty",
  "evaluation_attestation_missing_or_invalid",
  "cross_account_or_pii_leak",
  "critical_safety_clinical_answer",
  "unreported_case_finding",
  "uncited_material_claim",
  "fabricated_or_wrong_source",
  "live_claim_without_passage",
  "metadata_only_source_used",
  "active_retracted_source",
  "license_violation",
  "audit_fail_open",
  "pending_content_published",
  "locked_benchmark_integrity_broken",
  "critical_ux_warning_missing",
  "rollback_or_kill_switch_missing",
  "marketing_claim_without_evidence",
  "performance_evidence_invalid",
  "release_signal_missing_or_invalid",
] as const)

export type DnaReleaseHardNoGoCode = (typeof DNA_RELEASE_HARD_NO_GO_CODES)[number]

export type DnaReleaseHardNoGoSignals = Readonly<{
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
}>

export type DnaReleaseHardNoGoDecision = Readonly<{
  schemaVersion: typeof DNA_RELEASE_HARD_NO_GO_VERSION
  allowed: boolean
  decision: "go" | "no_go"
  blockCodes: readonly DnaReleaseHardNoGoCode[]
}>

const REQUIRED_ARTIFACT_KINDS = Object.freeze([
  "test_manifest",
  "row_results",
  "category_results",
  "security_results",
  "cross_account_results",
  "performance_results",
  "marketing_evidence",
] as const)

function nonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
}

function validSignals(signals: DnaReleaseHardNoGoSignals | null): signals is DnaReleaseHardNoGoSignals {
  if (!signals) return false
  const counts = [
    ...Object.values(signals.v3PackageCounts),
    signals.crossAccountLeakCount,
    signals.piiLeakCount,
    signals.criticalSafetyClinicalAnswerCount,
    signals.unreportedCaseFindingCount,
    signals.uncitedMaterialClaimCount,
    signals.fabricatedOrWrongSourceCount,
    signals.liveClaimWithoutPassageCount,
    signals.metadataOnlySourceUseCount,
    signals.activeRetractedSourceCount,
    signals.licenseViolationCount,
    signals.auditFailOpenCount,
    signals.pendingContentPublishedCount,
    signals.criticalUxWarningMissingCount,
    signals.marketingClaimsWithoutEvidenceCount,
  ]
  return counts.every(nonnegativeInteger)
    && [
      signals.evaluationAttestationValid,
      signals.lockedBenchmarkIntegrityValid,
      signals.killSwitchConfigured,
    ].every((value) => typeof value === "boolean")
}

function freezeDecision(blockCodes: readonly DnaReleaseHardNoGoCode[]): DnaReleaseHardNoGoDecision {
  const unique = Object.freeze([...new Set(blockCodes)])
  return Object.freeze({
    schemaVersion: DNA_RELEASE_HARD_NO_GO_VERSION,
    allowed: unique.length === 0,
    decision: unique.length === 0 ? "go" : "no_go",
    blockCodes: unique,
  })
}

function artifactVerificationMatchesBundle(
  verification: DnaReleaseEvidenceArtifactVerification | null,
  bundle: DnaReleaseEvidenceBundle,
): boolean {
  if (!verification || !validateDnaReleaseEvidenceArtifactVerification(verification)
    || !verification.valid || verification.bundleSha256 !== bundle.bundleSha256
    || verification.rows.length !== bundle.artifacts.length) return false
  const verificationById = new Map(verification.rows.map((row) => [row.id, row]))
  const marketingArtifacts = bundle.artifacts.filter((artifact) => (
    artifact.kind === "marketing_evidence"
  ))
  const marketingBindingValid = marketingArtifacts.length === 1
    && marketingArtifacts[0]!.sha256 === bundle.marketingEvidence.manifestSha256
    && marketingArtifacts[0]!.rowCount === bundle.marketingEvidence.claimCount
    && bundle.marketingEvidence.unsupportedClaimCount === 0
    && verification.derivedSignals.marketingClaimsWithoutEvidenceCount === 0
  return marketingBindingValid && bundle.artifacts.every((artifact) => {
    const row = verificationById.get(artifact.id)
    return row?.kind === artifact.kind
      && row.path === artifact.path
      && row.expectedSha256 === artifact.sha256
      && row.actualSha256 === artifact.sha256
      && row.expectedRowCount === artifact.rowCount
      && row.actualRowCount === artifact.rowCount
      && row.status === "pass"
  }) && verification.derivedSignals.complete
}

/**
 * Single hard NO-GO authority used before preview promotion, production
 * promotion and V3 runtime activation. Missing observations are failures, not
 * implied passes.
 */
export function evaluateDnaReleaseHardNoGo(input: Readonly<{
  evidenceBundle: DnaReleaseEvidenceBundle | null
  artifactVerification: DnaReleaseEvidenceArtifactVerification | null
  signals: DnaReleaseHardNoGoSignals | null
}>): DnaReleaseHardNoGoDecision {
  const blocks: DnaReleaseHardNoGoCode[] = []
  const bundle = input.evidenceBundle
  let verifiedArtifacts = false
  if (!bundle || !validateDnaReleaseEvidenceBundle(bundle)) {
    blocks.push("release_evidence_missing_or_invalid")
  } else {
    verifiedArtifacts = artifactVerificationMatchesBundle(input.artifactVerification, bundle)
    if (!verifiedArtifacts) {
      blocks.push("evidence_artifact_files_unverified")
    }
    const kinds = new Set(bundle.artifacts.map((artifact) => artifact.kind))
    if (REQUIRED_ARTIFACT_KINDS.some((kind) => !kinds.has(kind))) {
      blocks.push("required_evidence_artifact_missing")
    }
    if (bundle.artifacts.some((artifact) => artifact.status !== "pass" || artifact.rowCount === 0)) {
      blocks.push("required_evidence_artifact_not_passed")
    }
    if (bundle.dnaBook.status !== "owner_approved") blocks.push("dna_book_approval_missing")
    if (bundle.marketingEvidence.unsupportedClaimCount > 0) {
      blocks.push("marketing_claim_without_evidence")
    }
  }

  if (!validSignals(input.signals)) {
    blocks.push("release_signal_missing_or_invalid")
    return freezeDecision(blocks)
  }
  const signals = input.signals
  const derived = verifiedArtifacts ? input.artifactVerification!.derivedSignals : null
  const effectivePackageCounts = derived?.v3PackageCounts ?? {
    sources: 0,
    passages: 0,
    claims: 0,
    claimPassageLinks: 0,
  }
  if (Object.values(effectivePackageCounts).some((count) => count === 0)) {
    blocks.push("v3_runtime_package_empty")
  }
  if (bundle && validateDnaReleaseEvidenceBundle(bundle) && (
    bundle.catalog.counts.sources !== effectivePackageCounts.sources
    || bundle.catalog.counts.passages !== effectivePackageCounts.passages
    || bundle.catalog.counts.claims !== effectivePackageCounts.claims
    || bundle.catalog.counts.claimPassageLinks !== effectivePackageCounts.claimPassageLinks
    || signals.v3PackageCounts.sources !== effectivePackageCounts.sources
    || signals.v3PackageCounts.passages !== effectivePackageCounts.passages
    || signals.v3PackageCounts.claims !== effectivePackageCounts.claims
    || signals.v3PackageCounts.claimPassageLinks !== effectivePackageCounts.claimPassageLinks
  )) {
    blocks.push("release_bundle_runtime_counts_mismatch")
  }
  if (!signals.evaluationAttestationValid || !derived?.evaluationAttestationValid) {
    blocks.push("evaluation_attestation_missing_or_invalid")
  }
  if (Math.max(signals.crossAccountLeakCount, derived?.crossAccountLeakCount ?? 0) > 0
    || Math.max(signals.piiLeakCount, derived?.piiLeakCount ?? 0) > 0) {
    blocks.push("cross_account_or_pii_leak")
  }
  if (Math.max(
    signals.criticalSafetyClinicalAnswerCount,
    derived?.criticalSafetyClinicalAnswerCount ?? 0,
  ) > 0) {
    blocks.push("critical_safety_clinical_answer")
  }
  if (Math.max(signals.unreportedCaseFindingCount, derived?.unreportedCaseFindingCount ?? 0) > 0) {
    blocks.push("unreported_case_finding")
  }
  if (Math.max(signals.uncitedMaterialClaimCount, derived?.uncitedMaterialClaimCount ?? 0) > 0) {
    blocks.push("uncited_material_claim")
  }
  if (Math.max(signals.fabricatedOrWrongSourceCount, derived?.fabricatedOrWrongSourceCount ?? 0) > 0) {
    blocks.push("fabricated_or_wrong_source")
  }
  if (Math.max(signals.liveClaimWithoutPassageCount, derived?.liveClaimWithoutPassageCount ?? 0) > 0) {
    blocks.push("live_claim_without_passage")
  }
  if (Math.max(signals.metadataOnlySourceUseCount, derived?.metadataOnlySourceUseCount ?? 0) > 0) {
    blocks.push("metadata_only_source_used")
  }
  if (Math.max(signals.activeRetractedSourceCount, derived?.activeRetractedSourceCount ?? 0) > 0) {
    blocks.push("active_retracted_source")
  }
  if (Math.max(signals.licenseViolationCount, derived?.licenseViolationCount ?? 0) > 0) {
    blocks.push("license_violation")
  }
  if (Math.max(signals.auditFailOpenCount, derived?.auditFailOpenCount ?? 0) > 0) {
    blocks.push("audit_fail_open")
  }
  if (Math.max(signals.pendingContentPublishedCount, derived?.pendingContentPublishedCount ?? 0) > 0) {
    blocks.push("pending_content_published")
  }
  if (!signals.lockedBenchmarkIntegrityValid || !derived?.lockedBenchmarkIntegrityValid) {
    blocks.push("locked_benchmark_integrity_broken")
  }
  if (Math.max(signals.criticalUxWarningMissingCount, derived?.criticalUxWarningMissingCount ?? 0) > 0) {
    blocks.push("critical_ux_warning_missing")
  }
  if (!signals.killSwitchConfigured || !derived?.killSwitchConfigured) {
    blocks.push("rollback_or_kill_switch_missing")
  }
  if (Math.max(
    signals.marketingClaimsWithoutEvidenceCount,
    derived?.marketingClaimsWithoutEvidenceCount ?? 0,
  ) > 0) {
    blocks.push("marketing_claim_without_evidence")
  }
  if (!derived?.performanceEvidenceComplete
    || (derived.performanceBudgetViolationCount ?? 1) > 0) {
    blocks.push("performance_evidence_invalid")
  }
  return freezeDecision(blocks)
}

/** Current V3 is intentionally NO-GO until a real sealed evidence bundle exists. */
export function evaluateCurrentDnaV3ReleaseHardNoGo(): DnaReleaseHardNoGoDecision {
  let freshArtifactVerification: DnaReleaseEvidenceArtifactVerification | null = null
  if (DNA_CURRENT_V3_RELEASE_EVIDENCE_BUNDLE && DNA_CURRENT_V3_RELEASE_EVIDENCE_ROOT) {
    try {
      freshArtifactVerification = verifyDnaReleaseEvidenceBundleArtifacts({
        bundle: DNA_CURRENT_V3_RELEASE_EVIDENCE_BUNDLE,
        evidenceRoot: DNA_CURRENT_V3_RELEASE_EVIDENCE_ROOT,
      })
    } catch {
      freshArtifactVerification = null
    }
  }
  return evaluateDnaReleaseHardNoGo({
    evidenceBundle: DNA_CURRENT_V3_RELEASE_EVIDENCE_BUNDLE,
    artifactVerification: freshArtifactVerification,
    signals: DNA_CURRENT_V3_RELEASE_HARD_NO_GO_SIGNALS,
  })
}

/** Populated only by the offline release compiler after Phase 45-47 evidence. */
export const DNA_CURRENT_V3_RELEASE_HARD_NO_GO_SIGNALS:
  DnaReleaseHardNoGoSignals | null = null

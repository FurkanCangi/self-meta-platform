import { createHash } from "node:crypto"

import {
  isDnaMethodAppraisalEligibleForReleasePipeline,
  isDnaMethodAppraisalEligibleWithExplicitTestRegistry,
  type DnaMethodAppraisal,
  type DnaMethodAppraisalTrustRegistry,
} from "./methodAppraisal"

import {
  DNA_LICENSE_COMPONENTS,
  DNA_SOURCE_AGE_SCOPES,
  DNA_SOURCE_QUESTION_TYPES,
  DNA_SOURCE_ROLES,
  DNA_SOURCE_SAMPLE_SCOPES,
  assessSourcePriority,
  canonicalizeSourceIdentifiers,
  validateSourceIdentityRecords,
  type DnaCanonicalSourceIdentifiers,
  type DnaEvidencePopulation,
  type DnaPsychometricRole,
  type DnaSourceAgeScope,
  type DnaSourceIdentityRecord,
  type DnaSourceRole,
  type DnaSourceSampleScope,
} from "./sourceGovernance"

export const DNA_NORMALIZED_SOURCE_VERSION = "normalized-dna-source@1" as const
export const DNA_NORMALIZED_SOURCE_COLLECTION_VERSION = "normalized-dna-source-collection@1" as const

export const DNA_NORMALIZED_SOURCE_CATEGORIES = [
  "cellular_neurophysiology",
  "central_nervous_system_networks",
  "autonomic_nervous_system_hrv",
  "stress_arousal_reactivity_recovery",
  "interoception_sensory_processes",
  "emotion_self_coregulation",
  "attention_working_memory_executive_functions",
  "sleep_circadian_processes",
  "development_neurodevelopmental_differences",
  "measurement_case_clinical_boundaries",
  "not_assessed",
] as const

export type DnaNormalizedSourceCategory = (typeof DNA_NORMALIZED_SOURCE_CATEGORIES)[number]

export const DNA_NORMALIZED_STUDY_DESIGNS = [
  "systematic_review_meta_analysis",
  "randomized_controlled_trial",
  "nonrandomized_intervention",
  "prospective_cohort",
  "retrospective_cohort",
  "case_control",
  "cross_sectional",
  "diagnostic_accuracy",
  "psychometric_validation",
  "qualitative",
  "case_series",
  "single_case_experimental",
  "animal_experimental",
  "in_vitro",
  "narrative_review",
  "guideline",
  "consensus",
  "textbook",
  "theory",
  "protocol",
  "other",
  "not_reported",
  "not_assessed",
] as const

export type DnaNormalizedStudyDesign = (typeof DNA_NORMALIZED_STUDY_DESIGNS)[number]

export const DNA_NORMALIZED_EVIDENCE_LEVELS = [
  "eligible_for_body_synthesis_with_limits",
  "source_context_only",
  "not_assessed",
] as const

export type DnaNormalizedEvidenceLevel = (typeof DNA_NORMALIZED_EVIDENCE_LEVELS)[number]

export const DNA_NORMALIZED_CLAIM_BOUNDARIES = [
  "causal_inference_limited_to_design",
  "association_only",
  "descriptive_only",
  "theory_only",
  "claim_level_appraisal_required",
  "not_reported",
  "not_assessed",
] as const

export type DnaNormalizedClaimBoundary = (typeof DNA_NORMALIZED_CLAIM_BOUNDARIES)[number]

export const DNA_NORMALIZED_LICENSE_STATUSES = [
  "approved_component_bound",
  "component_matrix_audited_not_source_wide",
  "component_matrix_pending",
  "restricted",
  "not_assessed",
] as const

export type DnaNormalizedLicenseStatus = (typeof DNA_NORMALIZED_LICENSE_STATUSES)[number]

export const DNA_NORMALIZED_INTEGRITY_STATUSES = [
  "verified_current",
  "correction_linked",
  "withdrawn",
  "quarantined",
  "pending",
  "not_assessed",
] as const

export type DnaNormalizedIntegrityStatus = (typeof DNA_NORMALIZED_INTEGRITY_STATUSES)[number]

export const DNA_NORMALIZED_REVIEW_STATUSES = [
  "method_appraisal_pending",
  "codex_multi_pass_audited",
  "contested",
  "quarantined",
] as const

export type DnaNormalizedReviewStatus = (typeof DNA_NORMALIZED_REVIEW_STATUSES)[number]

export const DNA_NORMALIZED_RUNTIME_ELIGIBILITY = [
  "blocked_pending_method_appraisal",
  "blocked_missing_age_scope",
  "blocked_missing_population",
  "blocked_integrity",
  "blocked_license",
  "blocked_contested",
  "eligible_for_release_pipeline",
] as const

export type DnaNormalizedRuntimeEligibility =
  (typeof DNA_NORMALIZED_RUNTIME_ELIGIBILITY)[number]

export type NormalizedDnaSource = {
  readonly schemaVersion: typeof DNA_NORMALIZED_SOURCE_VERSION
  readonly id: string
  readonly title: string
  readonly authors: readonly string[]
  readonly year: number
  readonly doi: string | null
  readonly pmid: string | null
  readonly pmcid: string | null
  readonly isbn: string | null
  readonly identityVerificationStatus: "verified" | "pending" | "mismatch"
  readonly identityAuthority: string
  readonly identityVerifiedAt: string
  readonly identityEvidenceSha256: string
  readonly versionStatus: "preprint" | "version_of_record" | "corrected" | "superseded" | "unknown"
  readonly publicationRole: "article" | "book" | "guideline" | "correction_notice" | "erratum" | "other"
  readonly correctionResolution: "not_applicable" | "resolved" | "pending"
  readonly hasIncomingCorrection: boolean
  readonly cohortResolution: "resolved" | "not_applicable" | "unknown"
  readonly sourceRole: DnaSourceRole
  readonly canonicalCategories: readonly DnaNormalizedSourceCategory[]
  readonly studyDesign: DnaNormalizedStudyDesign
  readonly evidenceLevel: DnaNormalizedEvidenceLevel
  readonly population: DnaEvidencePopulation
  readonly sampleScope: DnaSourceSampleScope
  readonly ageScope: DnaSourceAgeScope
  readonly claimBoundary: DnaNormalizedClaimBoundary
  readonly licenseStatus: DnaNormalizedLicenseStatus
  readonly integrityStatus: DnaNormalizedIntegrityStatus
  readonly artifactHashes: readonly string[]
  readonly methodAppraisalId: string | null
  readonly reviewStatus: DnaNormalizedReviewStatus
  readonly runtimeEligibility: DnaNormalizedRuntimeEligibility
  readonly evidencePayloadSha256: string
  readonly sourcePayloadSha256: string
}

type SnapshotPriorityRecord = {
  readonly sourceId: string
  readonly role: DnaSourceRole
  readonly population: DnaEvidencePopulation
  readonly ageScope: DnaSourceAgeScope
  readonly sampleScope: DnaSourceSampleScope
  readonly psychometricRole: DnaPsychometricRole | null
  readonly publicationVersion: "version_of_record" | "preprint" | "corrected" | "unknown"
  readonly decisions: Readonly<Record<string, unknown>>
}

type SnapshotLicenseRecord = {
  readonly sourceId: string
  readonly policy: string
  readonly obligations: {
    readonly attributionRequired: boolean
    readonly shareAlikeRequired: boolean
  }
  readonly matrixSha256: string
  readonly decisions: Readonly<Record<string, string>>
  readonly evidenceBasis: Readonly<Record<string, string>>
}

export type DnaSourceGovernanceSnapshotForNormalization = {
  readonly schemaVersion: string
  readonly identityRecords: readonly DnaSourceIdentityRecord[]
  readonly priorityRecords: readonly SnapshotPriorityRecord[]
  readonly licenseRecords: readonly SnapshotLicenseRecord[]
}

export type DnaNormalizedSourceValidation = {
  readonly ok: boolean
  readonly errors: readonly string[]
}

export type DnaNormalizedSourceCollection = {
  readonly schemaVersion: typeof DNA_NORMALIZED_SOURCE_COLLECTION_VERSION
  readonly sourceCount: number
  readonly methodAppraisalPendingCount: number
  readonly runtimeEligibleCount: number
  readonly missingAgeScopeCount: number
  readonly missingPopulationCount: number
  readonly evidencePayloadSha256: string
  readonly collectionPayloadSha256: string
  readonly sources: readonly NormalizedDnaSource[]
}

/**
 * Runtime eligibility is a release authorization, not a client-supplied field.
 * The registry is intentionally empty until a source has a registered,
 * multi-pass method appraisal and the later provenance/release phases pass.
 */
export type DnaRegisteredNormalizedSourceRelease = {
  readonly sourceId: string
  readonly methodAppraisalId: string
  readonly methodAppraisalPayloadSha256: string
  readonly sourceEvidencePayloadSha256: string
  readonly identityEvidenceSha256: string
  readonly sourcePayloadSha256: string
}

export type DnaNormalizedSourceReleaseTrustRegistry = {
  readonly registryKind: "production_compiled" | "explicit_test_only"
  readonly sourceReleases: readonly DnaRegisteredNormalizedSourceRelease[]
  readonly methodAppraisals: readonly DnaMethodAppraisal[]
  readonly methodAppraisalTrustRegistry: DnaMethodAppraisalTrustRegistry
}

export const DNA_REGISTERED_NORMALIZED_SOURCE_RELEASES:
readonly DnaRegisteredNormalizedSourceRelease[] = Object.freeze([])

const PRODUCTION_NORMALIZED_SOURCE_RELEASE_TRUST_REGISTRY:
DnaNormalizedSourceReleaseTrustRegistry = Object.freeze({
  registryKind: "production_compiled",
  sourceReleases: DNA_REGISTERED_NORMALIZED_SOURCE_RELEASES,
  methodAppraisals: Object.freeze([]),
  methodAppraisalTrustRegistry: Object.freeze({
    registryKind: "production_compiled",
    evidenceRefs: Object.freeze([]),
    passEvidence: Object.freeze([]),
    appraisals: Object.freeze([]),
  }),
})

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const STABLE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{2,199}$/
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const SAMPLE_SCOPES = [
  "general_population",
  "clinical_population",
  "mixed_population",
  "measurement_validation_sample",
  "not_applicable",
  "not_reported",
] as const
const POPULATIONS = [
  "human",
  "animal",
  "in_vitro",
  "mixed_human_animal",
  "not_applicable",
  "not_reported",
] as const

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const object = value as Record<string, unknown>
  return `{${Object.keys(object).sort().map((key) =>
    `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`
}

export function hashNormalizedDnaSourcePayload(value: unknown): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex")
}

function withoutSourceHash(source: NormalizedDnaSource): Omit<NormalizedDnaSource, "sourcePayloadSha256"> {
  const { sourcePayloadSha256: _hash, ...payload } = source
  return payload
}

function isEnumValue<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && values.includes(value as T)
}

function assertExactObjectKeys(
  value: unknown,
  expectedKeys: readonly string[],
  errorCode: string,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(errorCode)
  const actual = Object.keys(value as Record<string, unknown>).sort()
  const expected = [...expectedKeys].sort()
  if (actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])) throw new Error(errorCode)
}

const PSYCHOMETRIC_ROLES = [
  "instrument_development",
  "reliability",
  "validity",
  "responsiveness",
  "measurement_error",
  "cross_cultural_validity",
  "systematic_review",
  "reporting_standard",
] as const satisfies readonly DnaPsychometricRole[]

const PUBLICATION_VERSIONS = ["version_of_record", "preprint", "corrected", "unknown"] as const
const PRIORITY_GRADES = ["A", "B", "C", "D", "E"] as const
const LICENSE_POLICIES = [
  "cc0",
  "cc_by",
  "cc_by_sa",
  "cc_by_with_exceptions",
  "blocked_nc",
  "blocked_nd",
  "all_rights_reserved",
  "unknown",
] as const
const LICENSE_DECISIONS = ["cleared", "restricted", "unknown", "metadata_only"] as const
const LICENSE_EVIDENCE_BASES = [
  "verified_in_artifact",
  "official_license_page_verified",
  "metadata_fact",
  "unverified",
] as const

function validatePrioritySnapshotRecords(records: unknown): asserts records is readonly SnapshotPriorityRecord[] {
  if (!Array.isArray(records)) throw new Error("invalid_priority_records")
  for (const [index, value] of records.entries()) {
    assertExactObjectKeys(value, [
      "sourceId",
      "role",
      "population",
      "ageScope",
      "sampleScope",
      "psychometricRole",
      "publicationVersion",
      "decisions",
    ], `invalid_priority_record_shape:${index}`)
    const record = value as unknown as SnapshotPriorityRecord
    if (!STABLE_ID_PATTERN.test(record.sourceId)) throw new Error(`invalid_priority_source_id:${index}`)
    if (!isEnumValue(DNA_SOURCE_ROLES, record.role)) throw new Error(`invalid_source_role:${record.sourceId}`)
    if (!isEnumValue(POPULATIONS, record.population)) throw new Error(`invalid_population:${record.sourceId}`)
    if (!isEnumValue(DNA_SOURCE_AGE_SCOPES, record.ageScope)) {
      throw new Error(`invalid_age_scope:${record.sourceId}`)
    }
    if (!isEnumValue(DNA_SOURCE_SAMPLE_SCOPES, record.sampleScope)) {
      throw new Error(`invalid_sample_scope:${record.sourceId}`)
    }
    if (record.psychometricRole !== null
      && !isEnumValue(PSYCHOMETRIC_ROLES, record.psychometricRole)) {
      throw new Error(`invalid_psychometric_role:${record.sourceId}`)
    }
    if (!isEnumValue(PUBLICATION_VERSIONS, record.publicationVersion)) {
      throw new Error(`invalid_publication_version:${record.sourceId}`)
    }
    assertExactObjectKeys(record.decisions, DNA_SOURCE_QUESTION_TYPES,
      `invalid_priority_decision_set:${record.sourceId}`)
    for (const questionType of DNA_SOURCE_QUESTION_TYPES) {
      const valueForQuestion = record.decisions[questionType]
      assertExactObjectKeys(valueForQuestion, ["grade", "supportsScientificClaim", "boundaryCode"],
        `invalid_priority_decision_shape:${record.sourceId}:${questionType}`)
      const decision = valueForQuestion as Record<string, unknown>
      if (!isEnumValue(PRIORITY_GRADES, decision.grade)
        || typeof decision.supportsScientificClaim !== "boolean"
        || typeof decision.boundaryCode !== "string"
        || !decision.boundaryCode.trim()) {
        throw new Error(`invalid_priority_decision:${record.sourceId}:${questionType}`)
      }
      const expected = assessSourcePriority(record, questionType)
      if (decision.grade !== expected.grade
        || decision.supportsScientificClaim !== expected.supportsScientificClaim
        || decision.boundaryCode !== expected.boundaryCode) {
        throw new Error(`priority_decision_mismatch:${record.sourceId}:${questionType}`)
      }
    }
  }
}

function validateLicenseSnapshotRecords(records: unknown): asserts records is readonly SnapshotLicenseRecord[] {
  if (!Array.isArray(records)) throw new Error("invalid_license_records")
  for (const [index, value] of records.entries()) {
    assertExactObjectKeys(value, [
      "sourceId",
      "policy",
      "obligations",
      "matrixSha256",
      "decisions",
      "evidenceBasis",
    ], `invalid_license_record_shape:${index}`)
    const record = value as unknown as SnapshotLicenseRecord
    if (!STABLE_ID_PATTERN.test(record.sourceId)) throw new Error(`invalid_license_source_id:${index}`)
    if (!isEnumValue(LICENSE_POLICIES, record.policy)) {
      throw new Error(`invalid_license_policy:${record.sourceId}`)
    }
    if (!SHA256_PATTERN.test(record.matrixSha256)) {
      throw new Error(`invalid_license_matrix_hash:${record.sourceId}`)
    }
    assertExactObjectKeys(record.obligations, ["attributionRequired", "shareAlikeRequired"],
      `invalid_license_obligations_shape:${record.sourceId}`)
    if (typeof record.obligations.attributionRequired !== "boolean"
      || typeof record.obligations.shareAlikeRequired !== "boolean") {
      throw new Error(`invalid_license_obligations:${record.sourceId}`)
    }
    const expectedAttribution = record.policy === "cc_by"
      || record.policy === "cc_by_sa"
      || record.policy === "cc_by_with_exceptions"
    if (record.obligations.attributionRequired !== expectedAttribution
      || record.obligations.shareAlikeRequired !== (record.policy === "cc_by_sa")) {
      throw new Error(`license_obligations_mismatch:${record.sourceId}`)
    }
    assertExactObjectKeys(record.decisions, DNA_LICENSE_COMPONENTS,
      `invalid_license_component_set:${record.sourceId}`)
    assertExactObjectKeys(record.evidenceBasis, DNA_LICENSE_COMPONENTS,
      `invalid_license_evidence_set:${record.sourceId}`)
    for (const component of DNA_LICENSE_COMPONENTS) {
      const decision = record.decisions[component]
      const evidenceBasis = record.evidenceBasis[component]
      if (!isEnumValue(LICENSE_DECISIONS, decision)) {
        throw new Error(`invalid_license_decision:${record.sourceId}:${component}`)
      }
      if (!isEnumValue(LICENSE_EVIDENCE_BASES, evidenceBasis)) {
        throw new Error(`invalid_license_evidence_basis:${record.sourceId}:${component}`)
      }
      if (decision === "cleared" && component !== "metadata"
        && evidenceBasis !== "verified_in_artifact"
        && evidenceBasis !== "official_license_page_verified") {
        throw new Error(`cleared_component_without_verified_evidence:${record.sourceId}:${component}`)
      }
      if (decision === "cleared" && component === "metadata" && evidenceBasis === "unverified") {
        throw new Error(`metadata_cleared_without_evidence:${record.sourceId}`)
      }
    }
  }
}

const NORMALIZED_SOURCE_KEYS = [
  "schemaVersion",
  "id",
  "title",
  "authors",
  "year",
  "doi",
  "pmid",
  "pmcid",
  "isbn",
  "identityVerificationStatus",
  "identityAuthority",
  "identityVerifiedAt",
  "identityEvidenceSha256",
  "versionStatus",
  "publicationRole",
  "correctionResolution",
  "hasIncomingCorrection",
  "cohortResolution",
  "sourceRole",
  "canonicalCategories",
  "studyDesign",
  "evidenceLevel",
  "population",
  "sampleScope",
  "ageScope",
  "claimBoundary",
  "licenseStatus",
  "integrityStatus",
  "artifactHashes",
  "methodAppraisalId",
  "reviewStatus",
  "runtimeEligibility",
  "evidencePayloadSha256",
  "sourcePayloadSha256",
] as const

function validateNormalizedDnaSourceAgainstRegistry(
  value: unknown,
  trustRegistry: DnaNormalizedSourceReleaseTrustRegistry,
): DnaNormalizedSourceValidation {
  const errors: string[] = []
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return Object.freeze({ ok: false, errors: Object.freeze(["source:invalid_object"]) })
  }
  const object = value as Record<string, unknown>
  const keys = Object.keys(object)
  for (const key of keys) {
    if (!(NORMALIZED_SOURCE_KEYS as readonly string[]).includes(key)) {
      errors.push(`source:unexpected_field:${key}`)
    }
  }
  for (const key of NORMALIZED_SOURCE_KEYS) {
    if (!keys.includes(key)) errors.push(`source:missing_field:${key}`)
  }
  const source = value as NormalizedDnaSource
  if (source.schemaVersion !== DNA_NORMALIZED_SOURCE_VERSION) errors.push("source:invalid_schema_version")
  if (!STABLE_ID_PATTERN.test(source.id)) errors.push("source:invalid_id")
  if (typeof source.title !== "string" || !source.title.trim()) errors.push("source:missing_title")
  if (!Array.isArray(source.authors)
    || source.authors.some((author) => typeof author !== "string" || !author.trim())) {
    errors.push("source:invalid_authors")
  }
  if (!Number.isInteger(source.year) || source.year < 1800 || source.year > 2200) {
    errors.push("source:invalid_year")
  }
  try {
    const canonical = canonicalizeSourceIdentifiers({
      doi: source.doi,
      pmid: source.pmid,
      pmcid: source.pmcid,
      isbn: source.isbn,
    })
    if (JSON.stringify(canonical) !== JSON.stringify({
      doi: source.doi,
      pmid: source.pmid,
      pmcid: source.pmcid,
      isbn: source.isbn,
    })) errors.push("source:noncanonical_identifiers")
  } catch {
    errors.push("source:invalid_identifiers")
  }
  if (!isEnumValue(["verified", "pending", "mismatch"] as const,
    source.identityVerificationStatus)) errors.push("source:invalid_identity_verification_status")
  if (typeof source.identityAuthority !== "string" || !source.identityAuthority.trim()) {
    errors.push("source:invalid_identity_authority")
  }
  if (typeof source.identityVerifiedAt !== "string"
    || !ISO_DATE_PATTERN.test(source.identityVerifiedAt)
    || Number.isNaN(Date.parse(`${source.identityVerifiedAt}T00:00:00.000Z`))) {
    errors.push("source:invalid_identity_verified_at")
  }
  if (!SHA256_PATTERN.test(source.identityEvidenceSha256)) {
    errors.push("source:invalid_identity_evidence_hash")
  }
  if (!isEnumValue(["preprint", "version_of_record", "corrected", "superseded", "unknown"] as const,
    source.versionStatus)) errors.push("source:invalid_version_status")
  if (!isEnumValue(["article", "book", "guideline", "correction_notice", "erratum", "other"] as const,
    source.publicationRole)) errors.push("source:invalid_publication_role")
  if (!isEnumValue(["not_applicable", "resolved", "pending"] as const,
    source.correctionResolution)) errors.push("source:invalid_correction_resolution")
  if (typeof source.hasIncomingCorrection !== "boolean") {
    errors.push("source:invalid_incoming_correction_status")
  }
  if (!isEnumValue(["resolved", "not_applicable", "unknown"] as const,
    source.cohortResolution)) errors.push("source:invalid_cohort_resolution")
  if (!isEnumValue(DNA_SOURCE_ROLES, source.sourceRole)) errors.push("source:invalid_source_role")
  if (!Array.isArray(source.canonicalCategories)
    || source.canonicalCategories.length === 0
    || source.canonicalCategories.some((category) =>
      !isEnumValue(DNA_NORMALIZED_SOURCE_CATEGORIES, category))) {
    errors.push("source:invalid_canonical_categories")
  } else if (new Set(source.canonicalCategories).size !== source.canonicalCategories.length) {
    errors.push("source:duplicate_canonical_categories")
  }
  if (!isEnumValue(DNA_NORMALIZED_STUDY_DESIGNS, source.studyDesign)) {
    errors.push("source:invalid_study_design")
  }
  if (!isEnumValue(DNA_NORMALIZED_EVIDENCE_LEVELS, source.evidenceLevel)) {
    errors.push("source:invalid_evidence_level")
  }
  if (!isEnumValue(POPULATIONS, source.population)) errors.push("source:invalid_population")
  if (!isEnumValue(SAMPLE_SCOPES, source.sampleScope)) errors.push("source:invalid_sample_scope")
  if (!isEnumValue(DNA_SOURCE_AGE_SCOPES, source.ageScope)) errors.push("source:invalid_age_scope")
  if (!isEnumValue(DNA_NORMALIZED_CLAIM_BOUNDARIES, source.claimBoundary)) {
    errors.push("source:invalid_claim_boundary")
  }
  if (!isEnumValue(DNA_NORMALIZED_LICENSE_STATUSES, source.licenseStatus)) {
    errors.push("source:invalid_license_status")
  }
  if (!isEnumValue(DNA_NORMALIZED_INTEGRITY_STATUSES, source.integrityStatus)) {
    errors.push("source:invalid_integrity_status")
  }
  if (!Array.isArray(source.artifactHashes)
    || source.artifactHashes.some((hash) => !SHA256_PATTERN.test(hash))) {
    errors.push("source:invalid_artifact_hashes")
  } else if (new Set(source.artifactHashes).size !== source.artifactHashes.length) {
    errors.push("source:duplicate_artifact_hashes")
  }
  if (source.methodAppraisalId !== null && !STABLE_ID_PATTERN.test(source.methodAppraisalId)) {
    errors.push("source:invalid_method_appraisal_id")
  }
  if (!isEnumValue(DNA_NORMALIZED_REVIEW_STATUSES, source.reviewStatus)) {
    errors.push("source:invalid_review_status")
  }
  if (!isEnumValue(DNA_NORMALIZED_RUNTIME_ELIGIBILITY, source.runtimeEligibility)) {
    errors.push("source:invalid_runtime_eligibility")
  }
  if (!SHA256_PATTERN.test(source.evidencePayloadSha256)) errors.push("source:invalid_evidence_payload_hash")
  if (!SHA256_PATTERN.test(source.sourcePayloadSha256)
    || source.sourcePayloadSha256 !== hashNormalizedDnaSourcePayload(withoutSourceHash(source))) {
    errors.push("source:source_payload_hash_mismatch")
  }

  if (source.reviewStatus !== "codex_multi_pass_audited") {
    if (source.runtimeEligibility === "eligible_for_release_pipeline") {
      errors.push("source:pending_appraisal_cannot_enter_release_pipeline")
    }
    if (source.evidenceLevel !== "not_assessed") {
      errors.push("source:pending_appraisal_cannot_assert_evidence_level")
    }
    if (source.methodAppraisalId !== null) errors.push("source:pending_appraisal_id_must_be_null")
  }
  if (source.runtimeEligibility === "eligible_for_release_pipeline") {
    if (source.identityVerificationStatus !== "verified") {
      errors.push("source:eligible_source_identity_not_verified")
    }
    if (source.versionStatus !== "version_of_record" && source.versionStatus !== "corrected") {
      errors.push("source:eligible_source_version_not_current")
    }
    if (source.publicationRole === "correction_notice" || source.publicationRole === "erratum") {
      errors.push("source:eligible_source_is_correction_record")
    }
    if (source.correctionResolution === "pending") {
      errors.push("source:eligible_source_correction_pending")
    }
    if (source.hasIncomingCorrection && source.versionStatus !== "corrected") {
      errors.push("source:eligible_source_unapplied_correction")
    }
    if (source.cohortResolution === "unknown") {
      errors.push("source:eligible_source_cohort_unresolved")
    }
    if (source.ageScope === "not_reported") errors.push("source:eligible_source_missing_age_scope")
    if (source.population === "not_reported") errors.push("source:eligible_source_missing_population")
    if (source.studyDesign === "not_reported" || source.studyDesign === "not_assessed") {
      errors.push("source:eligible_source_missing_study_design")
    }
    if (source.integrityStatus !== "verified_current"
      && source.integrityStatus !== "correction_linked") {
      errors.push("source:eligible_source_integrity_not_verified")
    }
    if (source.licenseStatus !== "approved_component_bound") {
      errors.push("source:eligible_source_license_not_component_approved")
    }
    if (!Array.isArray(source.artifactHashes) || source.artifactHashes.length === 0) {
      errors.push("source:eligible_source_missing_artifact_hash")
    }
    if (!Array.isArray(source.canonicalCategories)
      || source.canonicalCategories.includes("not_assessed")) {
      errors.push("source:eligible_source_category_not_assessed")
    }
    if (source.evidenceLevel === "not_assessed") {
      errors.push("source:eligible_source_evidence_not_assessed")
    }
    if (source.claimBoundary === "not_assessed" || source.claimBoundary === "not_reported") {
      errors.push("source:eligible_source_claim_boundary_not_assessed")
    }
    const registeredRelease = source.methodAppraisalId !== null
      ? trustRegistry.sourceReleases.find((entry) =>
        entry.sourceId === source.id
        && entry.methodAppraisalId === source.methodAppraisalId
        && entry.sourceEvidencePayloadSha256 === source.evidencePayloadSha256
        && entry.identityEvidenceSha256 === source.identityEvidenceSha256
        && entry.sourcePayloadSha256 === source.sourcePayloadSha256)
      : undefined
    if (!registeredRelease) {
      errors.push("source:release_authorization_not_registered")
    } else {
      const appraisal = trustRegistry.methodAppraisals.find((entry) =>
        entry.id === registeredRelease.methodAppraisalId
        && entry.sourceId === source.id
        && entry.sourceEvidencePayloadSha256 === source.evidencePayloadSha256
        && entry.appraisalPayloadSha256 === registeredRelease.methodAppraisalPayloadSha256)
      if (!appraisal) {
        errors.push("source:registered_method_appraisal_missing")
      } else {
        const appraisalEligible = trustRegistry.registryKind === "explicit_test_only"
          ? isDnaMethodAppraisalEligibleWithExplicitTestRegistry(
            appraisal,
            trustRegistry.methodAppraisalTrustRegistry,
          )
          : isDnaMethodAppraisalEligibleForReleasePipeline(appraisal)
        if (!appraisalEligible) errors.push("source:registered_method_appraisal_not_eligible")
      }
    }
  }

  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors.sort()) })
}

export function validateNormalizedDnaSource(value: unknown): DnaNormalizedSourceValidation {
  return validateNormalizedDnaSourceAgainstRegistry(
    value,
    PRODUCTION_NORMALIZED_SOURCE_RELEASE_TRUST_REGISTRY,
  )
}

/**
 * Test-only positive-path seam. Runtime release always uses the compiled,
 * currently empty production trust roots above.
 */
export function validateNormalizedDnaSourceWithExplicitTestRegistry(
  value: unknown,
  trustRegistry: DnaNormalizedSourceReleaseTrustRegistry,
): DnaNormalizedSourceValidation {
  if (trustRegistry.registryKind !== "explicit_test_only"
    || trustRegistry.methodAppraisalTrustRegistry.registryKind !== "explicit_test_only") {
    return Object.freeze({
      ok: false,
      errors: Object.freeze(["source:invalid_test_registry_kind"]),
    })
  }
  return validateNormalizedDnaSourceAgainstRegistry(value, trustRegistry)
}

function uniqueRecordMap<T extends { readonly sourceId: string }>(
  records: readonly T[],
  label: string,
): Map<string, T> {
  const map = new Map<string, T>()
  for (const record of records) {
    if (map.has(record.sourceId)) throw new Error(`${label}:duplicate_source_id:${record.sourceId}`)
    map.set(record.sourceId, record)
  }
  return map
}

function assertSameSourceSets(
  identities: Map<string, DnaSourceIdentityRecord>,
  priorities: Map<string, SnapshotPriorityRecord>,
  licenses: Map<string, SnapshotLicenseRecord>,
): void {
  const allIds = new Set([...identities.keys(), ...priorities.keys(), ...licenses.keys()])
  for (const sourceId of allIds) {
    if (!identities.has(sourceId)) throw new Error(`missing_identity:${sourceId}`)
    if (!priorities.has(sourceId)) throw new Error(`missing_priority:${sourceId}`)
    if (!licenses.has(sourceId)) throw new Error(`missing_license:${sourceId}`)
  }
}

function normalizeOneSource(input: {
  readonly identity: DnaSourceIdentityRecord
  readonly priority: SnapshotPriorityRecord
  readonly license: SnapshotLicenseRecord
}): NormalizedDnaSource {
  const evidencePayloadSha256 = hashNormalizedDnaSourcePayload({
    identity: input.identity,
    priority: input.priority,
    license: input.license,
  })
  const identifiers: DnaCanonicalSourceIdentifiers = canonicalizeSourceIdentifiers(
    input.identity.verifiedIdentifiers,
  )
  const bibliography = input.identity.verifiedBibliography
  const payload: Omit<NormalizedDnaSource, "sourcePayloadSha256"> = {
    schemaVersion: DNA_NORMALIZED_SOURCE_VERSION,
    id: input.identity.sourceId,
    title: bibliography.title.normalize("NFC").trim(),
    authors: Object.freeze(bibliography.authors.map((author) => author.normalize("NFC").trim())),
    year: bibliography.year,
    doi: identifiers.doi,
    pmid: identifiers.pmid,
    pmcid: identifiers.pmcid,
    isbn: identifiers.isbn,
    identityVerificationStatus: input.identity.identityVerification.status,
    identityAuthority: input.identity.identityVerification.authority.normalize("NFC").trim(),
    identityVerifiedAt: input.identity.identityVerification.verifiedAt,
    identityEvidenceSha256: input.identity.identityVerification.evidenceSha256,
    versionStatus: input.identity.versionStatus,
    publicationRole: input.identity.publicationRole,
    correctionResolution: input.identity.correctionResolution,
    hasIncomingCorrection: input.identity.correctionRelations.some((relation) =>
      relation.direction === "is_corrected_by"),
    cohortResolution: input.identity.cohortResolution,
    sourceRole: input.priority.role,
    canonicalCategories: Object.freeze(["not_assessed"]),
    studyDesign: "not_assessed",
    evidenceLevel: "not_assessed",
    population: input.priority.population,
    sampleScope: input.priority.sampleScope,
    ageScope: input.priority.ageScope,
    claimBoundary: "not_assessed",
    licenseStatus: "component_matrix_audited_not_source_wide",
    integrityStatus: "not_assessed",
    // The governance snapshot contains evidence/decision hashes, not raw source
    // artifact hashes. Do not relabel those values as artifact provenance.
    artifactHashes: Object.freeze([]),
    methodAppraisalId: null,
    reviewStatus: "method_appraisal_pending",
    runtimeEligibility: "blocked_pending_method_appraisal",
    evidencePayloadSha256,
  }
  const source = Object.freeze({
    ...payload,
    sourcePayloadSha256: hashNormalizedDnaSourcePayload(payload),
  })
  const validation = validateNormalizedDnaSource(source)
  if (!validation.ok) throw new Error(`${source.id}:${validation.errors.join(";")}`)
  return source
}

export function normalizeDnaSourceGovernanceSnapshot(
  snapshot: DnaSourceGovernanceSnapshotForNormalization,
): DnaNormalizedSourceCollection {
  if (!snapshot || typeof snapshot !== "object") throw new Error("invalid_source_snapshot")
  if (snapshot.schemaVersion !== "dna-source-library-governance-snapshot@1") {
    throw new Error("unsupported_source_snapshot_version")
  }
  if (!Array.isArray(snapshot.identityRecords)) throw new Error("invalid_identity_records")
  let identityValidation: ReturnType<typeof validateSourceIdentityRecords>
  try {
    identityValidation = validateSourceIdentityRecords(snapshot.identityRecords)
  } catch {
    throw new Error("invalid_identity_records:malformed_input")
  }
  if (!identityValidation.ok) {
    throw new Error(`invalid_identity_records:${identityValidation.errors.join(";")}`)
  }
  validatePrioritySnapshotRecords(snapshot.priorityRecords)
  validateLicenseSnapshotRecords(snapshot.licenseRecords)
  const identities = uniqueRecordMap(snapshot.identityRecords, "identity")
  const priorities = uniqueRecordMap(snapshot.priorityRecords, "priority")
  const licenses = uniqueRecordMap(snapshot.licenseRecords, "license")
  assertSameSourceSets(identities, priorities, licenses)

  const sources = Object.freeze([...identities.keys()].sort().map((sourceId) => normalizeOneSource({
    identity: identities.get(sourceId)!,
    priority: priorities.get(sourceId)!,
    license: licenses.get(sourceId)!,
  })))
  const evidencePayloadSha256 = hashNormalizedDnaSourcePayload(
    sources.map((source) => ({ sourceId: source.id, evidencePayloadSha256: source.evidencePayloadSha256 })),
  )
  const collectionWithoutHash = {
    schemaVersion: DNA_NORMALIZED_SOURCE_COLLECTION_VERSION,
    sourceCount: sources.length,
    methodAppraisalPendingCount: sources.filter((source) =>
      source.reviewStatus === "method_appraisal_pending").length,
    runtimeEligibleCount: sources.filter((source) =>
      source.runtimeEligibility === "eligible_for_release_pipeline").length,
    missingAgeScopeCount: sources.filter((source) => source.ageScope === "not_reported").length,
    missingPopulationCount: sources.filter((source) => source.population === "not_reported").length,
    evidencePayloadSha256,
    sources,
  }
  return Object.freeze({
    ...collectionWithoutHash,
    collectionPayloadSha256: hashNormalizedDnaSourcePayload(collectionWithoutHash),
  })
}

export function isNormalizedDnaSourceRuntimeEligible(source: NormalizedDnaSource): boolean {
  return validateNormalizedDnaSource(source).ok
    && source.runtimeEligibility === "eligible_for_release_pipeline"
    && source.reviewStatus === "codex_multi_pass_audited"
}

export function isNormalizedDnaSourceRuntimeEligibleWithExplicitTestRegistry(
  source: NormalizedDnaSource,
  trustRegistry: DnaNormalizedSourceReleaseTrustRegistry,
): boolean {
  return validateNormalizedDnaSourceWithExplicitTestRegistry(source, trustRegistry).ok
    && source.runtimeEligibility === "eligible_for_release_pipeline"
    && source.reviewStatus === "codex_multi_pass_audited"
}

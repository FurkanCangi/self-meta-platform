import { createHash } from "node:crypto"

import {
  DNA_SOURCE_AGE_SCOPES,
  type DnaEvidencePopulation,
  type DnaSourceAgeScope,
} from "./sourceGovernance"

export const DNA_METHOD_APPRAISAL_VERSION = "dna-method-appraisal@1" as const
export const DNA_METHOD_APPRAISAL_PROTOCOL_VERSION = "dna-method-appraisal-protocol@1" as const

export const DNA_STUDY_DESIGNS = [
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

export type DnaStudyDesign = (typeof DNA_STUDY_DESIGNS)[number]

export const DNA_REPORTING_ASSESSMENTS = [
  "adequately_reported",
  "partly_reported",
  "inadequately_reported",
  "not_reported",
  "not_applicable",
  "not_assessed",
] as const

export type DnaReportingAssessment = (typeof DNA_REPORTING_ASSESSMENTS)[number]

export const DNA_METHOD_CONTROL_ASSESSMENTS = [
  "adequate",
  "partly_adequate",
  "inadequate",
  "not_reported",
  "not_applicable",
  "not_assessed",
] as const

export type DnaMethodControlAssessment = (typeof DNA_METHOD_CONTROL_ASSESSMENTS)[number]

export const DNA_MEASURE_ASSESSMENTS = [
  "validated_or_reference_standard",
  "partly_supported",
  "unclear_validity",
  "not_reported",
  "not_applicable",
  "not_assessed",
] as const

export type DnaMeasureAssessment = (typeof DNA_MEASURE_ASSESSMENTS)[number]

export const DNA_MISSING_DATA_ASSESSMENTS = [
  "addressed_with_sensitivity_analysis",
  "addressed",
  "not_addressed",
  "not_reported",
  "not_applicable",
  "not_assessed",
] as const

export type DnaMissingDataAssessment = (typeof DNA_MISSING_DATA_ASSESSMENTS)[number]

export const DNA_CONFOUNDING_ASSESSMENTS = [
  "adequately_addressed",
  "partly_addressed",
  "not_addressed",
  "not_reported",
  "not_applicable",
  "not_assessed",
] as const

export type DnaConfoundingAssessment = (typeof DNA_CONFOUNDING_ASSESSMENTS)[number]

export const DNA_MULTIPLICITY_ASSESSMENTS = [
  "controlled",
  "partly_controlled",
  "not_controlled",
  "not_reported",
  "not_applicable",
  "not_assessed",
] as const

export type DnaMultiplicityAssessment = (typeof DNA_MULTIPLICITY_ASSESSMENTS)[number]

export const DNA_QUANTITATIVE_REPORTING_ASSESSMENTS = [
  "reported",
  "derivable",
  "not_reported",
  "not_applicable",
  "not_assessed",
] as const

export type DnaQuantitativeReportingAssessment =
  (typeof DNA_QUANTITATIVE_REPORTING_ASSESSMENTS)[number]

export const DNA_PREREGISTRATION_ASSESSMENTS = [
  "prospective_verified",
  "retrospective_or_partial",
  "claimed_unverified",
  "not_reported",
  "not_applicable",
  "not_assessed",
] as const

export type DnaPreregistrationAssessment = (typeof DNA_PREREGISTRATION_ASSESSMENTS)[number]

export const DNA_REPRODUCIBILITY_ASSESSMENTS = [
  "independently_replicated",
  "materials_data_and_code_available",
  "partial_materials_available",
  "not_reported",
  "not_applicable",
  "not_assessed",
] as const

export type DnaReproducibilityAssessment = (typeof DNA_REPRODUCIBILITY_ASSESSMENTS)[number]

export const DNA_FUNDING_ASSESSMENTS = [
  "reported_noncommercial",
  "reported_commercial",
  "reported_mixed",
  "reported_unclear",
  "not_reported",
  "not_applicable",
  "not_assessed",
] as const

export type DnaFundingAssessment = (typeof DNA_FUNDING_ASSESSMENTS)[number]

export const DNA_CONFLICT_OF_INTEREST_ASSESSMENTS = [
  "reported_no_conflict",
  "reported_with_conflict",
  "reported_unclear",
  "not_reported",
  "not_applicable",
  "not_assessed",
] as const

export type DnaConflictOfInterestAssessment =
  (typeof DNA_CONFLICT_OF_INTEREST_ASSESSMENTS)[number]

export const DNA_GENERALIZABILITY_ASSESSMENTS = [
  "direct_to_target_population",
  "partly_indirect",
  "indirect",
  "not_reported",
  "not_assessed",
] as const

export type DnaGeneralizabilityAssessment =
  (typeof DNA_GENERALIZABILITY_ASSESSMENTS)[number]

export const DNA_CAUSAL_BOUNDARIES = [
  "causal_inference_limited_to_design",
  "association_only",
  "descriptive_only",
  "theory_only",
  "not_reported",
  "not_assessed",
] as const

export type DnaCausalBoundary = (typeof DNA_CAUSAL_BOUNDARIES)[number]

/**
 * These are adapted appraisal dimensions, not a GRADE certainty judgement.
 * Inconsistency and publication bias require a body of evidence and therefore
 * remain not_assessed on every single-source record.
 */
export const DNA_ADAPTED_GRADE_DIMENSION_ASSESSMENTS = [
  "no_serious_concern",
  "serious_concern",
  "very_serious_concern",
  "not_applicable",
  "not_assessed",
] as const

export type DnaAdaptedGradeDimensionAssessment =
  (typeof DNA_ADAPTED_GRADE_DIMENSION_ASSESSMENTS)[number]

export const DNA_METHOD_REVIEW_STATUSES = [
  "not_assessed",
  "pending_multi_pass",
  "codex_multi_pass_audited",
  "contested",
  "quarantined",
] as const

export type DnaMethodReviewStatus = (typeof DNA_METHOD_REVIEW_STATUSES)[number]

export const DNA_APPRAISAL_DISPOSITIONS = [
  "blocked_not_assessed",
  "blocked_pending_appraisal",
  "eligible_for_body_synthesis_with_limits",
  "contested",
  "quarantined",
] as const

export type DnaAppraisalDisposition = (typeof DNA_APPRAISAL_DISPOSITIONS)[number]

export type DnaMethodAppraisalEvidenceRef = {
  readonly artifactSha256: string
  readonly contentSha256: string
  readonly locator: string
}

export type DnaMethodAppraisalPass = {
  readonly passId: string
  readonly protocolVersion: typeof DNA_METHOD_APPRAISAL_PROTOCOL_VERSION
  readonly reviewerRole:
    | "method_appraisal_a"
    | "method_appraisal_b"
    | "method_appraisal_reconciliation"
  readonly completedAt: string
  readonly evidenceSha256: string
}

export type DnaMethodAppraisal = {
  readonly schemaVersion: typeof DNA_METHOD_APPRAISAL_VERSION
  readonly id: string
  readonly sourceId: string
  readonly studyDesign: DnaStudyDesign
  readonly sampleSize: {
    readonly reporting: "reported" | "not_reported" | "not_applicable" | "not_assessed"
    readonly total: number | null
  }
  readonly population: DnaEvidencePopulation
  readonly ageScope: DnaSourceAgeScope
  readonly inclusionCriteria: DnaReportingAssessment
  readonly exclusionCriteria: DnaReportingAssessment
  readonly measures: DnaMeasureAssessment
  readonly blinding: DnaMethodControlAssessment
  readonly randomization: DnaMethodControlAssessment
  readonly missingData: DnaMissingDataAssessment
  readonly confounding: DnaConfoundingAssessment
  readonly multiplicity: DnaMultiplicityAssessment
  readonly effectSize: DnaQuantitativeReportingAssessment
  readonly confidenceInterval: DnaQuantitativeReportingAssessment
  readonly preregistration: DnaPreregistrationAssessment
  readonly reproducibility: DnaReproducibilityAssessment
  readonly funding: DnaFundingAssessment
  readonly conflictOfInterest: DnaConflictOfInterestAssessment
  readonly generalizability: DnaGeneralizabilityAssessment
  readonly causalBoundary: DnaCausalBoundary
  readonly adaptedGradeDimensions: {
    readonly riskOfBias: DnaAdaptedGradeDimensionAssessment
    readonly inconsistency: "not_assessed"
    readonly indirectness: DnaAdaptedGradeDimensionAssessment
    readonly imprecision: DnaAdaptedGradeDimensionAssessment
    readonly publicationBias: "not_assessed"
  }
  readonly gradeScope: "adapted_dimensions_not_certainty_rating"
  readonly bodyOfEvidenceCertainty: "not_assessed"
  readonly evidenceRefs: readonly DnaMethodAppraisalEvidenceRef[]
  readonly reviewPasses: readonly DnaMethodAppraisalPass[]
  readonly reviewStatus: DnaMethodReviewStatus
  readonly disposition: DnaAppraisalDisposition
  readonly limitations: readonly string[]
  readonly sourceEvidencePayloadSha256: string
  readonly appraisalPayloadSha256: string
}

export type DnaMethodAppraisalValidation = {
  readonly ok: boolean
  readonly errors: readonly string[]
}

export type DnaTrustedMethodAppraisalEvidenceRef = DnaMethodAppraisalEvidenceRef & {
  readonly sourceId: string
  readonly sourceEvidencePayloadSha256: string
}

export type DnaTrustedMethodAppraisalPassEvidence = {
  readonly appraisalId: string
  readonly passId: string
  readonly reviewerRole: DnaMethodAppraisalPass["reviewerRole"]
  readonly evidenceSha256: string
}

export type DnaRegisteredMethodAppraisal = {
  readonly appraisalId: string
  readonly sourceId: string
  readonly sourceEvidencePayloadSha256: string
  readonly appraisalPayloadSha256: string
}

export type DnaMethodAppraisalTrustRegistry = {
  readonly registryKind: "production_compiled" | "explicit_test_only"
  readonly evidenceRefs: readonly DnaTrustedMethodAppraisalEvidenceRef[]
  readonly passEvidence: readonly DnaTrustedMethodAppraisalPassEvidence[]
  readonly appraisals: readonly DnaRegisteredMethodAppraisal[]
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const STABLE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{2,199}$/
const ISO_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/

function isExactIsoInstant(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_INSTANT_PATTERN.test(value)) return false
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return false
  const canonical = new Date(timestamp).toISOString()
  return canonical === value || canonical.replace(/\.000Z$/, "Z") === value
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const object = value as Record<string, unknown>
  return `{${Object.keys(object).sort().map((key) =>
    `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`
}

export function hashDnaAppraisalPayload(value: unknown): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex")
}

function isEnumValue<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && values.includes(value as T)
}

function payloadWithoutHash(record: DnaMethodAppraisal): Omit<DnaMethodAppraisal, "appraisalPayloadSha256"> {
  const { appraisalPayloadSha256: _hash, ...payload } = record
  return payload
}

/**
 * Current trust root is deliberately empty. An appraisal cannot become audited
 * by submitting a JSON field that says "high" or "approved". A future audited
 * registry entry must bind source evidence and the exact appraisal payload.
 */
export const DNA_REGISTERED_METHOD_APPRAISALS: readonly DnaRegisteredMethodAppraisal[] =
  Object.freeze([])

export const DNA_TRUSTED_METHOD_APPRAISAL_EVIDENCE_REFS:
readonly DnaTrustedMethodAppraisalEvidenceRef[] = Object.freeze([])

export const DNA_TRUSTED_METHOD_APPRAISAL_PASS_EVIDENCE:
readonly DnaTrustedMethodAppraisalPassEvidence[] = Object.freeze([])

const PRODUCTION_METHOD_APPRAISAL_TRUST_REGISTRY: DnaMethodAppraisalTrustRegistry =
  Object.freeze({
    registryKind: "production_compiled",
    evidenceRefs: DNA_TRUSTED_METHOD_APPRAISAL_EVIDENCE_REFS,
    passEvidence: DNA_TRUSTED_METHOD_APPRAISAL_PASS_EVIDENCE,
    appraisals: DNA_REGISTERED_METHOD_APPRAISALS,
  })

function validateExactKeys(
  value: unknown,
  allowed: readonly string[],
  label: string,
  errors: string[],
): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${label}:invalid_object`)
    return false
  }
  const keys = Object.keys(value as Record<string, unknown>)
  for (const key of keys) {
    if (!allowed.includes(key)) errors.push(`${label}:unexpected_field:${key}`)
  }
  for (const key of allowed) {
    if (!keys.includes(key)) errors.push(`${label}:missing_field:${key}`)
  }
  return true
}

const TOP_LEVEL_KEYS = [
  "schemaVersion",
  "id",
  "sourceId",
  "studyDesign",
  "sampleSize",
  "population",
  "ageScope",
  "inclusionCriteria",
  "exclusionCriteria",
  "measures",
  "blinding",
  "randomization",
  "missingData",
  "confounding",
  "multiplicity",
  "effectSize",
  "confidenceInterval",
  "preregistration",
  "reproducibility",
  "funding",
  "conflictOfInterest",
  "generalizability",
  "causalBoundary",
  "adaptedGradeDimensions",
  "gradeScope",
  "bodyOfEvidenceCertainty",
  "evidenceRefs",
  "reviewPasses",
  "reviewStatus",
  "disposition",
  "limitations",
  "sourceEvidencePayloadSha256",
  "appraisalPayloadSha256",
] as const

function validateDnaMethodAppraisalAgainstRegistry(
  value: unknown,
  trustRegistry: DnaMethodAppraisalTrustRegistry,
): DnaMethodAppraisalValidation {
  const errors: string[] = []
  if (!validateExactKeys(value, TOP_LEVEL_KEYS, "appraisal", errors)) {
    return Object.freeze({ ok: false, errors: Object.freeze(errors.sort()) })
  }
  const record = value as unknown as DnaMethodAppraisal
  if (record.schemaVersion !== DNA_METHOD_APPRAISAL_VERSION) errors.push("appraisal:invalid_schema_version")
  if (!STABLE_ID_PATTERN.test(record.id)) errors.push("appraisal:invalid_id")
  if (!STABLE_ID_PATTERN.test(record.sourceId)) errors.push("appraisal:invalid_source_id")
  if (!isEnumValue(DNA_STUDY_DESIGNS, record.studyDesign)) errors.push("appraisal:invalid_study_design")
  if (!isEnumValue([
    "human",
    "animal",
    "in_vitro",
    "mixed_human_animal",
    "not_applicable",
    "not_reported",
  ] as const, record.population)) errors.push("appraisal:invalid_population")
  if (!isEnumValue(DNA_SOURCE_AGE_SCOPES, record.ageScope)) errors.push("appraisal:invalid_age_scope")

  if (validateExactKeys(record.sampleSize, ["reporting", "total"], "sample_size", errors)) {
    if (!isEnumValue(["reported", "not_reported", "not_applicable", "not_assessed"] as const,
      record.sampleSize.reporting)) errors.push("sample_size:invalid_reporting")
    if (record.sampleSize.reporting === "reported") {
      if (!Number.isInteger(record.sampleSize.total) || Number(record.sampleSize.total) <= 0) {
        errors.push("sample_size:invalid_total")
      }
    } else if (record.sampleSize.total !== null) {
      errors.push("sample_size:unexpected_total")
    }
  }

  const enumChecks: Array<[unknown, readonly string[], string]> = [
    [record.inclusionCriteria, DNA_REPORTING_ASSESSMENTS, "inclusion_criteria"],
    [record.exclusionCriteria, DNA_REPORTING_ASSESSMENTS, "exclusion_criteria"],
    [record.measures, DNA_MEASURE_ASSESSMENTS, "measures"],
    [record.blinding, DNA_METHOD_CONTROL_ASSESSMENTS, "blinding"],
    [record.randomization, DNA_METHOD_CONTROL_ASSESSMENTS, "randomization"],
    [record.missingData, DNA_MISSING_DATA_ASSESSMENTS, "missing_data"],
    [record.confounding, DNA_CONFOUNDING_ASSESSMENTS, "confounding"],
    [record.multiplicity, DNA_MULTIPLICITY_ASSESSMENTS, "multiplicity"],
    [record.effectSize, DNA_QUANTITATIVE_REPORTING_ASSESSMENTS, "effect_size"],
    [record.confidenceInterval, DNA_QUANTITATIVE_REPORTING_ASSESSMENTS, "confidence_interval"],
    [record.preregistration, DNA_PREREGISTRATION_ASSESSMENTS, "preregistration"],
    [record.reproducibility, DNA_REPRODUCIBILITY_ASSESSMENTS, "reproducibility"],
    [record.funding, DNA_FUNDING_ASSESSMENTS, "funding"],
    [record.conflictOfInterest, DNA_CONFLICT_OF_INTEREST_ASSESSMENTS, "conflict_of_interest"],
    [record.generalizability, DNA_GENERALIZABILITY_ASSESSMENTS, "generalizability"],
    [record.causalBoundary, DNA_CAUSAL_BOUNDARIES, "causal_boundary"],
    [record.reviewStatus, DNA_METHOD_REVIEW_STATUSES, "review_status"],
    [record.disposition, DNA_APPRAISAL_DISPOSITIONS, "disposition"],
  ]
  for (const [entry, values, label] of enumChecks) {
    if (typeof entry !== "string" || !values.includes(entry)) errors.push(`appraisal:invalid_${label}`)
  }

  if (validateExactKeys(record.adaptedGradeDimensions, [
    "riskOfBias",
    "inconsistency",
    "indirectness",
    "imprecision",
    "publicationBias",
  ], "adapted_grade", errors)) {
    if (!isEnumValue(DNA_ADAPTED_GRADE_DIMENSION_ASSESSMENTS,
      record.adaptedGradeDimensions.riskOfBias)) errors.push("adapted_grade:invalid_risk_of_bias")
    if (!isEnumValue(DNA_ADAPTED_GRADE_DIMENSION_ASSESSMENTS,
      record.adaptedGradeDimensions.indirectness)) errors.push("adapted_grade:invalid_indirectness")
    if (!isEnumValue(DNA_ADAPTED_GRADE_DIMENSION_ASSESSMENTS,
      record.adaptedGradeDimensions.imprecision)) errors.push("adapted_grade:invalid_imprecision")
    if (record.adaptedGradeDimensions.inconsistency !== "not_assessed") {
      errors.push("adapted_grade:single_source_cannot_rate_inconsistency")
    }
    if (record.adaptedGradeDimensions.publicationBias !== "not_assessed") {
      errors.push("adapted_grade:single_source_cannot_rate_publication_bias")
    }
  }
  if (record.gradeScope !== "adapted_dimensions_not_certainty_rating") {
    errors.push("appraisal:invalid_grade_scope")
  }
  if (record.bodyOfEvidenceCertainty !== "not_assessed") {
    errors.push("appraisal:single_source_cannot_assert_body_certainty")
  }

  const evidenceRefKeys = new Set<string>()
  const validatedEvidenceRefs: DnaMethodAppraisalEvidenceRef[] = []
  if (!Array.isArray(record.evidenceRefs)) {
    errors.push("appraisal:invalid_evidence_refs")
  } else {
    for (const [index, ref] of record.evidenceRefs.entries()) {
      if (!validateExactKeys(ref, ["artifactSha256", "contentSha256", "locator"],
        `evidence_ref_${index}`, errors)) continue
      const evidenceRef = ref as unknown as DnaMethodAppraisalEvidenceRef
      if (!SHA256_PATTERN.test(evidenceRef.artifactSha256)) errors.push(`evidence_ref_${index}:invalid_artifact_hash`)
      if (!SHA256_PATTERN.test(evidenceRef.contentSha256)) errors.push(`evidence_ref_${index}:invalid_content_hash`)
      if (typeof evidenceRef.locator !== "string"
        || !evidenceRef.locator.trim()
        || evidenceRef.locator.length > 300) errors.push(`evidence_ref_${index}:invalid_locator`)
      const evidenceKey = `${evidenceRef.artifactSha256}:${evidenceRef.contentSha256}:${evidenceRef.locator}`
      if (evidenceRefKeys.has(evidenceKey)) errors.push(`evidence_ref_${index}:duplicate_evidence_ref`)
      evidenceRefKeys.add(evidenceKey)
      validatedEvidenceRefs.push(evidenceRef)
    }
  }
  const validatedReviewRoles = new Set<DnaMethodAppraisalPass["reviewerRole"]>()
  const reviewPassIds = new Set<string>()
  const reviewEvidenceHashes = new Set<string>()
  const validatedReviewPasses: DnaMethodAppraisalPass[] = []
  if (!Array.isArray(record.reviewPasses)) {
    errors.push("appraisal:invalid_review_passes")
  } else {
    for (const [index, pass] of record.reviewPasses.entries()) {
      if (!validateExactKeys(pass,
        ["passId", "protocolVersion", "reviewerRole", "completedAt", "evidenceSha256"],
        `review_pass_${index}`, errors)) continue
      const reviewPass = pass as unknown as DnaMethodAppraisalPass
      if (!STABLE_ID_PATTERN.test(reviewPass.passId)) errors.push(`review_pass_${index}:invalid_id`)
      if (reviewPassIds.has(reviewPass.passId)) errors.push(`review_pass_${index}:duplicate_id`)
      reviewPassIds.add(reviewPass.passId)
      if (reviewPass.protocolVersion !== DNA_METHOD_APPRAISAL_PROTOCOL_VERSION) {
        errors.push(`review_pass_${index}:invalid_protocol_version`)
      }
      if (!isEnumValue([
        "method_appraisal_a",
        "method_appraisal_b",
        "method_appraisal_reconciliation",
      ] as const, reviewPass.reviewerRole)) {
        errors.push(`review_pass_${index}:invalid_reviewer_role`)
      } else {
        if (validatedReviewRoles.has(reviewPass.reviewerRole)) {
          errors.push(`review_pass_${index}:duplicate_reviewer_role`)
        }
        validatedReviewRoles.add(reviewPass.reviewerRole)
      }
      if (!isExactIsoInstant(reviewPass.completedAt)) errors.push(`review_pass_${index}:invalid_completed_at`)
      if (!SHA256_PATTERN.test(reviewPass.evidenceSha256)) errors.push(`review_pass_${index}:invalid_evidence_hash`)
      if (reviewEvidenceHashes.has(reviewPass.evidenceSha256)) {
        errors.push(`review_pass_${index}:duplicate_evidence_hash`)
      }
      reviewEvidenceHashes.add(reviewPass.evidenceSha256)
      validatedReviewPasses.push(reviewPass)
    }
  }
  if (!Array.isArray(record.limitations)
    || record.limitations.some((entry) => typeof entry !== "string" || !entry.trim())) {
    errors.push("appraisal:invalid_limitations")
  }
  if (!SHA256_PATTERN.test(record.sourceEvidencePayloadSha256)) {
    errors.push("appraisal:invalid_source_evidence_hash")
  }
  if (!SHA256_PATTERN.test(record.appraisalPayloadSha256)
    || record.appraisalPayloadSha256 !== hashDnaAppraisalPayload(payloadWithoutHash(record))) {
    errors.push("appraisal:payload_hash_mismatch")
  }

  const pending = record.reviewStatus === "not_assessed" || record.reviewStatus === "pending_multi_pass"
  if (pending) {
    const allowedDisposition = record.reviewStatus === "not_assessed"
      ? "blocked_not_assessed"
      : "blocked_pending_appraisal"
    if (record.disposition !== allowedDisposition) errors.push("appraisal:pending_disposition_mismatch")
    if ((Array.isArray(record.evidenceRefs) && record.evidenceRefs.length > 0)
      || (Array.isArray(record.reviewPasses) && record.reviewPasses.length > 0)) {
      errors.push("appraisal:pending_record_cannot_claim_completed_evidence")
    }
    const pendingOnlyValues = ["not_assessed", "not_reported"] as const
    if (!pendingOnlyValues.includes(record.studyDesign as (typeof pendingOnlyValues)[number])) {
      errors.push("appraisal:pending_record_asserts_study_design")
    }
    if (record.sampleSize?.reporting !== "not_assessed"
      && record.sampleSize?.reporting !== "not_reported") {
      errors.push("appraisal:pending_record_asserts_sample_size")
    }
    if (record.sampleSize?.total !== null) errors.push("appraisal:pending_record_asserts_sample_total")
    if (record.population !== "not_reported") errors.push("appraisal:pending_record_asserts_population")
    if (record.ageScope !== "not_reported") errors.push("appraisal:pending_record_asserts_age_scope")
    const pendingAssessmentFields: Array<[unknown, string]> = [
      [record.inclusionCriteria, "inclusion_criteria"],
      [record.exclusionCriteria, "exclusion_criteria"],
      [record.measures, "measures"],
      [record.blinding, "blinding"],
      [record.randomization, "randomization"],
      [record.missingData, "missing_data"],
      [record.confounding, "confounding"],
      [record.multiplicity, "multiplicity"],
      [record.effectSize, "effect_size"],
      [record.confidenceInterval, "confidence_interval"],
      [record.preregistration, "preregistration"],
      [record.reproducibility, "reproducibility"],
      [record.funding, "funding"],
      [record.conflictOfInterest, "conflict_of_interest"],
      [record.generalizability, "generalizability"],
      [record.causalBoundary, "causal_boundary"],
    ]
    for (const [entry, label] of pendingAssessmentFields) {
      if (entry !== "not_assessed" && entry !== "not_reported") {
        errors.push(`appraisal:pending_record_asserts_${label}`)
      }
    }
    if (record.adaptedGradeDimensions
      && typeof record.adaptedGradeDimensions === "object"
      && Object.values(record.adaptedGradeDimensions).some((entry) => entry !== "not_assessed")) {
      errors.push("appraisal:pending_record_asserts_adapted_grade")
    }
  }

  if (record.reviewStatus === "codex_multi_pass_audited") {
    const requiredRoles: readonly DnaMethodAppraisalPass["reviewerRole"][] = [
      "method_appraisal_a",
      "method_appraisal_b",
      "method_appraisal_reconciliation",
    ]
    if (!Array.isArray(record.reviewPasses)
      || !requiredRoles.every((role) => validatedReviewRoles.has(role))) {
      errors.push("appraisal:missing_multi_pass_audit")
    }
    if (validatedReviewPasses.length !== requiredRoles.length) {
      errors.push("appraisal:invalid_multi_pass_count")
    } else {
      for (const [index, requiredRole] of requiredRoles.entries()) {
        if (validatedReviewPasses[index]?.reviewerRole !== requiredRole) {
          errors.push(`review_pass_${index}:invalid_role_order`)
        }
        if (index > 0) {
          const previous = Date.parse(validatedReviewPasses[index - 1]?.completedAt ?? "")
          const current = Date.parse(validatedReviewPasses[index]?.completedAt ?? "")
          if (!Number.isFinite(previous) || !Number.isFinite(current) || current <= previous) {
            errors.push(`review_pass_${index}:non_chronological_completion`)
          }
        }
      }
    }
    if (!Array.isArray(record.evidenceRefs) || record.evidenceRefs.length === 0) {
      errors.push("appraisal:missing_evidence_refs")
    }
    const allEvidenceTrusted = Array.isArray(record.evidenceRefs)
      && validatedEvidenceRefs.length === record.evidenceRefs.length
      && validatedEvidenceRefs.every((ref) => trustRegistry.evidenceRefs.some((entry) =>
        entry.sourceId === record.sourceId
        && entry.sourceEvidencePayloadSha256 === record.sourceEvidencePayloadSha256
        && entry.artifactSha256 === ref.artifactSha256
        && entry.contentSha256 === ref.contentSha256
        && entry.locator === ref.locator))
    if (!allEvidenceTrusted) errors.push("appraisal:evidence_refs_not_trusted")
    const allPassEvidenceTrusted = Array.isArray(record.reviewPasses)
      && validatedReviewPasses.length === record.reviewPasses.length
      && validatedReviewPasses.every((pass) => trustRegistry.passEvidence.some((entry) =>
        entry.appraisalId === record.id
        && entry.passId === pass.passId
        && entry.reviewerRole === pass.reviewerRole
        && entry.evidenceSha256 === pass.evidenceSha256))
    if (!allPassEvidenceTrusted) errors.push("appraisal:review_pass_evidence_not_trusted")
    const registered = trustRegistry.appraisals.some((entry) =>
      entry.appraisalId === record.id
      && entry.sourceId === record.sourceId
      && entry.sourceEvidencePayloadSha256 === record.sourceEvidencePayloadSha256
      && entry.appraisalPayloadSha256 === record.appraisalPayloadSha256)
    if (!registered) errors.push("appraisal:audited_payload_not_registered")
  }
  if (record.reviewStatus === "contested" && record.disposition !== "contested") {
    errors.push("appraisal:contested_disposition_mismatch")
  }
  if (record.reviewStatus === "quarantined" && record.disposition !== "quarantined") {
    errors.push("appraisal:quarantined_disposition_mismatch")
  }

  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors.sort()) })
}

export function validateDnaMethodAppraisal(value: unknown): DnaMethodAppraisalValidation {
  return validateDnaMethodAppraisalAgainstRegistry(value, PRODUCTION_METHOD_APPRAISAL_TRUST_REGISTRY)
}

/**
 * Test-only positive-path seam. Production callers must use
 * `validateDnaMethodAppraisal`, whose compiled trust roots are currently empty.
 */
export function validateDnaMethodAppraisalWithExplicitTestRegistry(
  value: unknown,
  trustRegistry: DnaMethodAppraisalTrustRegistry,
): DnaMethodAppraisalValidation {
  if (trustRegistry.registryKind !== "explicit_test_only") {
    return Object.freeze({ ok: false, errors: Object.freeze(["appraisal:invalid_test_registry_kind"]) })
  }
  return validateDnaMethodAppraisalAgainstRegistry(value, trustRegistry)
}

export function createPendingDnaMethodAppraisal(input: {
  readonly sourceId: string
  readonly sourceEvidencePayloadSha256: string
}): DnaMethodAppraisal {
  if (!STABLE_ID_PATTERN.test(input.sourceId)) throw new Error("invalid_source_id")
  if (!SHA256_PATTERN.test(input.sourceEvidencePayloadSha256)) throw new Error("invalid_source_evidence_hash")
  const payload: Omit<DnaMethodAppraisal, "appraisalPayloadSha256"> = {
    schemaVersion: DNA_METHOD_APPRAISAL_VERSION,
    id: `appraisal:${input.sourceId}:pending`,
    sourceId: input.sourceId,
    studyDesign: "not_assessed",
    sampleSize: Object.freeze({ reporting: "not_assessed", total: null }),
    population: "not_reported",
    ageScope: "not_reported",
    inclusionCriteria: "not_assessed",
    exclusionCriteria: "not_assessed",
    measures: "not_assessed",
    blinding: "not_assessed",
    randomization: "not_assessed",
    missingData: "not_assessed",
    confounding: "not_assessed",
    multiplicity: "not_assessed",
    effectSize: "not_assessed",
    confidenceInterval: "not_assessed",
    preregistration: "not_assessed",
    reproducibility: "not_assessed",
    funding: "not_assessed",
    conflictOfInterest: "not_assessed",
    generalizability: "not_assessed",
    causalBoundary: "not_assessed",
    adaptedGradeDimensions: Object.freeze({
      riskOfBias: "not_assessed",
      inconsistency: "not_assessed",
      indirectness: "not_assessed",
      imprecision: "not_assessed",
      publicationBias: "not_assessed",
    }),
    gradeScope: "adapted_dimensions_not_certainty_rating",
    bodyOfEvidenceCertainty: "not_assessed",
    evidenceRefs: Object.freeze([]),
    reviewPasses: Object.freeze([]),
    reviewStatus: "pending_multi_pass",
    disposition: "blocked_pending_appraisal",
    limitations: Object.freeze([
      "full_text_method_appraisal_pending",
      "single_source_is_not_body_of_evidence_certainty",
    ]),
    sourceEvidencePayloadSha256: input.sourceEvidencePayloadSha256,
  }
  const record = Object.freeze({
    ...payload,
    appraisalPayloadSha256: hashDnaAppraisalPayload(payload),
  })
  const validation = validateDnaMethodAppraisal(record)
  if (!validation.ok) throw new Error(validation.errors.join(";"))
  return record
}

export function isDnaMethodAppraisalEligibleForReleasePipeline(
  record: DnaMethodAppraisal,
): boolean {
  return validateDnaMethodAppraisal(record).ok
    && record.reviewStatus === "codex_multi_pass_audited"
    && record.disposition === "eligible_for_body_synthesis_with_limits"
    && record.population !== "not_reported"
    && record.ageScope !== "not_reported"
    && record.studyDesign !== "not_reported"
    && record.studyDesign !== "not_assessed"
}

export function isDnaMethodAppraisalEligibleWithExplicitTestRegistry(
  record: DnaMethodAppraisal,
  trustRegistry: DnaMethodAppraisalTrustRegistry,
): boolean {
  return validateDnaMethodAppraisalWithExplicitTestRegistry(record, trustRegistry).ok
    && record.reviewStatus === "codex_multi_pass_audited"
    && record.disposition === "eligible_for_body_synthesis_with_limits"
    && record.population !== "not_reported"
    && record.ageScope !== "not_reported"
    && record.studyDesign !== "not_reported"
    && record.studyDesign !== "not_assessed"
}

import { createHash } from "node:crypto"

import type {
  DnaAppraisalDisposition,
} from "./methodAppraisal"
import type {
  DnaAtomicClaim,
  DnaSourcePassage,
} from "./evidenceExtraction"

export const DNA_CLAIM_REVIEW_GATES_VERSION = "dna-claim-review-gates@1" as const
export const DNA_SOURCE_FIDELITY_REVIEW_VERSION = "dna-source-fidelity-review@1" as const
export const DNA_METHOD_SUPPORT_REVIEW_VERSION = "dna-method-support-review@1" as const
export const DNA_ADVERSARIAL_REVIEW_VERSION = "dna-adversarial-review@1" as const
export const DNA_CLINICAL_SAFETY_REVIEW_VERSION = "dna-clinical-safety-review@1" as const
export const DNA_TURKISH_TRANSFER_REVIEW_VERSION = "dna-turkish-transfer-review@1" as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const STABLE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{2,199}$/
const ISO_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/

export const DNA_REVIEW_FINDINGS = Object.freeze([
  "absent",
  "present",
  "not_assessed",
] as const)
export type DnaReviewFinding = (typeof DNA_REVIEW_FINDINGS)[number]

export const DNA_METHOD_SUPPORT_FINDINGS = Object.freeze([
  "adequate_with_stated_limits",
  "concern",
  "not_assessed",
] as const)
export type DnaMethodSupportFinding = (typeof DNA_METHOD_SUPPORT_FINDINGS)[number]

export const DNA_SOURCE_FIDELITY_ISSUES = Object.freeze([
  "scope_expansion",
  "causal_escalation",
  "age_generalization",
  "species_generalization",
  "group_to_individual_transfer",
  "theory_presented_as_fact",
  "source_type_mismatch",
] as const)
export type DnaSourceFidelityIssue = (typeof DNA_SOURCE_FIDELITY_ISSUES)[number]

export const DNA_ADVERSARIAL_DIMENSIONS = Object.freeze([
  "contrary_finding",
  "stronger_synthesis_disagrees",
  "contested_theory",
  "publication_bias_concern",
  "measure_validity_criticized",
  "school_specificity",
  "new_evidence_changes_conclusion",
  "alternative_explanation",
] as const)
export type DnaAdversarialDimension = (typeof DNA_ADVERSARIAL_DIMENSIONS)[number]

export const DNA_CLINICAL_SAFETY_DIMENSIONS = Object.freeze([
  "diagnostic_drift",
  "treatment_or_medication_drift",
  "individual_biological_inference",
  "ambiguous_age_risk",
  "behavior_to_brain_or_autonomic_inference",
  "prognosis_impression",
  "definitive_causality_impression",
  "new_clinical_threshold",
] as const)
export type DnaClinicalSafetyDimension = (typeof DNA_CLINICAL_SAFETY_DIMENSIONS)[number]

export const DNA_CLINICAL_AUTOMATIC_BLOCKERS = Object.freeze([
  "review_incomplete",
  "new_clinical_threshold",
  "diagnosis_or_differential",
  "treatment_or_medication",
  "prognosis",
  "individual_biological_mechanism",
  "behavior_to_brain_or_autonomic_inference",
  "ambiguous_age_risk",
  "definitive_causality",
  "critical_clinical_conclusion_from_single_source",
  "unexplained_statistic",
  "unclear_or_prohibited_license",
  "unresolved_scientific_conflict",
] as const)
export type DnaClinicalAutomaticBlocker = (typeof DNA_CLINICAL_AUTOMATIC_BLOCKERS)[number]

export const DNA_TRANSLATION_TERM_FAMILIES = Object.freeze([
  "association_causation",
  "regulation_control",
  "arousal_activation",
  "recovery_restoration",
  "awareness_accuracy",
  "predict_explain",
  "modality_may_can_is",
  "evidence_proof",
] as const)
export type DnaTranslationTermFamily = (typeof DNA_TRANSLATION_TERM_FAMILIES)[number]

const TRANSLATION_FAMILY_TERMS: Readonly<Record<DnaTranslationTermFamily, readonly string[]>> =
  Object.freeze({
    association_causation: ["association", "causation"],
    regulation_control: ["regulation", "control"],
    arousal_activation: ["arousal", "activation"],
    recovery_restoration: ["recovery", "restoration"],
    awareness_accuracy: ["awareness", "accuracy"],
    predict_explain: ["predict", "explain"],
    modality_may_can_is: ["may", "can", "is"],
    evidence_proof: ["evidence", "proof"],
  })

export type DnaReviewBinding = Readonly<{
  sourceId: string
  artifactSha256: string
  claimId: string
  claimSha256: string
  passageIds: readonly string[]
  passageProvenanceSha256s: readonly string[]
}>

type DnaReviewEnvelope<TVersion extends string, TAssessment> = Readonly<{
  schemaVersion: TVersion
  reviewId: string
  reviewerRole: string
  completedAt: string
  binding: DnaReviewBinding
  assessment: TAssessment
  rationale: string
  evidenceSha256: string
  reviewPayloadSha256: string
}>

export type DnaSourceFidelityAssessment = Readonly<{
  entailment: "entailed" | "partially_entailed" | "not_entailed" | "not_assessed"
  issues: Readonly<Record<DnaSourceFidelityIssue, DnaReviewFinding>>
}>

export type DnaSourceFidelityReview = DnaReviewEnvelope<
  typeof DNA_SOURCE_FIDELITY_REVIEW_VERSION,
  DnaSourceFidelityAssessment
>

export type DnaMethodSupportAssessment = Readonly<{
  methodAppraisalId: string
  methodAppraisalSha256: string
  appraisalDisposition: DnaAppraisalDisposition
  designSupportsClaim: DnaMethodSupportFinding
  correlationCausationAligned: DnaMethodSupportFinding
  measurementValidity: DnaMethodSupportFinding
  sampleAndAgeAligned: DnaMethodSupportFinding
  effectAndUncertaintyReflected: DnaMethodSupportFinding
  studyContextRespected: DnaMethodSupportFinding
}>

export type DnaMethodSupportReview = DnaReviewEnvelope<
  typeof DNA_METHOD_SUPPORT_REVIEW_VERSION,
  DnaMethodSupportAssessment
>

export type DnaAdversarialAssessment = Readonly<{
  evidenceSetId: string
  evidenceSetSha256: string
  searchCutoff: string
  consideredSourceIds: readonly string[]
  comparisonBasis: "method_quality_over_recency_or_count"
  findings: Readonly<Record<DnaAdversarialDimension, DnaReviewFinding>>
  disposition: "no_material_counterevidence_found" | "contested" | "quarantined"
}>

export type DnaAdversarialReview = DnaReviewEnvelope<
  typeof DNA_ADVERSARIAL_REVIEW_VERSION,
  DnaAdversarialAssessment
>

export type DnaClinicalSafetyAssessment = Readonly<{
  findings: Readonly<Record<DnaClinicalSafetyDimension, DnaReviewFinding>>
  clinicalCriticality: "critical" | "noncritical" | "not_assessed"
  evidenceBreadth: "multiple_sources_or_synthesis" | "single_source" | "not_assessed"
  statisticExplanation: "explained" | "not_applicable" | "unexplained" | "not_assessed"
  licenseStatus: "approved" | "unclear" | "prohibited" | "not_assessed"
  scientificConflictStatus: "none_identified" | "resolved_with_boundary" | "unresolved" | "not_assessed"
  automaticBlockers: readonly DnaClinicalAutomaticBlocker[]
}>

export type DnaClinicalSafetyReview = DnaReviewEnvelope<
  typeof DNA_CLINICAL_SAFETY_REVIEW_VERSION,
  DnaClinicalSafetyAssessment
>

export type DnaOriginalPassageRetention = Readonly<{
  passageId: string
  originalLanguage: "en"
  originalText: string
  contentSha256: string
  provenanceSha256: string
}>

export type DnaTranslationTermCheck = Readonly<{
  family: DnaTranslationTermFamily
  relevance: "relevant" | "not_present"
  sourceTerms: readonly string[]
  approvedTurkishTerms: readonly string[]
  conceptPreserved: "yes" | "no" | "not_assessed"
  reverseMeaningChecked: "yes" | "no"
  scopeChange: "none" | "narrowed" | "widened" | "not_assessed"
}>

export type DnaTurkishTransferAssessment = Readonly<{
  transferDirection: "english_to_turkish"
  originalPassages: readonly DnaOriginalPassageRetention[]
  approvedTurkishNarrative: string
  independentBackTranslation: string
  conceptualEquivalence: "preserved" | "drift_detected" | "not_assessed"
  reverseMeaning: "absent" | "present" | "not_assessed"
  meaningScope: "preserved" | "narrowed" | "widened" | "not_assessed"
  causalStrength: "preserved" | "strengthened" | "weakened" | "not_assessed"
  modality: "preserved" | "strengthened" | "weakened" | "not_assessed"
  termChecks: readonly DnaTranslationTermCheck[]
}>

export type DnaTurkishTransferReview = DnaReviewEnvelope<
  typeof DNA_TURKISH_TRANSFER_REVIEW_VERSION,
  DnaTurkishTransferAssessment
>

export const DNA_CLAIM_REVIEW_TRUST_KINDS = Object.freeze([
  "source_fidelity_review",
  "method_support_review",
  "method_appraisal",
  "adversarial_review",
  "adversarial_evidence_set",
  "clinical_safety_review",
  "turkish_transfer_review",
] as const)
export type DnaClaimReviewTrustKind = (typeof DNA_CLAIM_REVIEW_TRUST_KINDS)[number]

export type DnaClaimReviewTrustRecord = Readonly<{
  kind: DnaClaimReviewTrustKind
  recordId: string
  sourceId: string
  artifactSha256: string
  claimSha256: string
  subjectSha256: string
}>

export type DnaClaimReviewTrustRegistry = Readonly<{
  registryKind: "production_compiled" | "explicit_test_only"
  records: readonly DnaClaimReviewTrustRecord[]
}>

export type DnaClaimReviewBundle = Readonly<{
  claim: DnaAtomicClaim
  passages: readonly DnaSourcePassage[]
  sourceFidelity: DnaSourceFidelityReview
  methodSupport: DnaMethodSupportReview
  adversarial: DnaAdversarialReview
  clinicalSafety: DnaClinicalSafetyReview
  turkishTransfer: DnaTurkishTransferReview
}>

export type DnaClaimReviewGateResult = Readonly<{
  schemaVersion: typeof DNA_CLAIM_REVIEW_GATES_VERSION
  status:
    | "eligible_for_phase_25_conflict_processing"
    | "requires_phase_25_conflict_resolution"
    | "blocked"
  runtimeEligible: false
  failedPhases: readonly (20 | 21 | 22 | 23 | 24)[]
  reasons: readonly string[]
  reviewPayloadSha256s: Readonly<{
    sourceFidelity: string
    methodSupport: string
    adversarial: string
    clinicalSafety: string
    turkishTransfer: string
  }>
  bundleSha256: string
}>

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const object = value as Record<string, unknown>
  return `{${Object.keys(object).sort().map((key) =>
    `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`
}

export function hashDnaClaimReviewPayload(value: unknown): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex")
}

function hashText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

function withoutReviewHash<T extends { reviewPayloadSha256: string }>(record: T): Omit<T, "reviewPayloadSha256"> {
  const { reviewPayloadSha256: _hash, ...payload } = record
  return payload
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  }
  return value
}

function exactKeys(value: unknown, allowed: readonly string[], label: string, errors: string[]): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${label}:invalid_object`)
    return false
  }
  const actual = Object.keys(value as Record<string, unknown>).sort()
  const expected = [...allowed].sort()
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    errors.push(`${label}:invalid_shape`)
    return false
  }
  return true
}

function isExactIsoInstant(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_INSTANT_PATTERN.test(value)) return false
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return false
  const canonical = new Date(timestamp).toISOString()
  return canonical === value || canonical.replace(/\.000Z$/, "Z") === value
}

function normalizeText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim()
}

function validateBoundedText(value: unknown, min: number, max: number): boolean {
  return typeof value === "string" && normalizeText(value).length >= min && normalizeText(value).length <= max
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort()
}

function isAtomicClaimIntegrityValid(claim: DnaAtomicClaim): boolean {
  if (!claim || typeof claim !== "object" || !SHA256_PATTERN.test(claim.claimSha256)) return false
  const { claimSha256: _hash, ...core } = claim
  return hashDnaClaimReviewPayload(core) === claim.claimSha256
}

function isPassageIntegrityValid(passage: DnaSourcePassage): boolean {
  if (!passage || typeof passage !== "object"
    || !SHA256_PATTERN.test(passage.provenanceSha256)
    || !SHA256_PATTERN.test(passage.contentSha256)) return false
  const { provenanceSha256: _hash, ...core } = passage
  return hashDnaClaimReviewPayload(core) === passage.provenanceSha256
    && hashText(passage.originalText) === passage.contentSha256
}

function validateBinding(
  binding: unknown,
  claim: DnaAtomicClaim,
  passages: readonly DnaSourcePassage[],
  errors: string[],
): binding is DnaReviewBinding {
  if (!exactKeys(binding, [
    "sourceId",
    "artifactSha256",
    "claimId",
    "claimSha256",
    "passageIds",
    "passageProvenanceSha256s",
  ], "binding", errors)) return false
  const candidate = binding as unknown as DnaReviewBinding
  if (candidate.sourceId !== claim.sourceId) errors.push("binding:source_mismatch")
  if (candidate.artifactSha256 !== claim.artifactSha256) errors.push("binding:artifact_mismatch")
  if (candidate.claimId !== claim.claimId) errors.push("binding:claim_id_mismatch")
  if (candidate.claimSha256 !== claim.claimSha256) errors.push("binding:claim_hash_mismatch")
  if (!Array.isArray(candidate.passageIds) || !Array.isArray(candidate.passageProvenanceSha256s)) {
    errors.push("binding:invalid_passage_arrays")
    return true
  }
  const passageById = new Map(passages.map((passage) => [passage.id, passage]))
  const expectedIds = [...claim.passageIds]
  if (stableJson(candidate.passageIds) !== stableJson(expectedIds)) errors.push("binding:passage_ids_mismatch")
  if (candidate.passageIds.length !== candidate.passageProvenanceSha256s.length) {
    errors.push("binding:passage_hash_count_mismatch")
  }
  candidate.passageIds.forEach((passageId, index) => {
    const passage = passageById.get(passageId)
    if (!passage
      || !isPassageIntegrityValid(passage)
      || passage.sourceId !== claim.sourceId
      || passage.artifactSha256 !== claim.artifactSha256
      || passage.provenanceSha256 !== candidate.passageProvenanceSha256s[index]) {
      errors.push(`binding:passage_not_current_or_bound:${passageId}`)
    }
  })
  return true
}

function englishTermPresence(originalText: string): Readonly<Record<DnaTranslationTermFamily, readonly string[]>> {
  const text = normalizeText(originalText).toLowerCase()
  const has = (pattern: RegExp) => pattern.test(text)
  return {
    association_causation: [
      ...(has(/\b(?:association|associated|associational)\b/) ? ["association"] : []),
      ...(has(/\b(?:causation|causal|causes?|caused)\b/) ? ["causation"] : []),
    ],
    regulation_control: [
      ...(has(/\b(?:regulation|regulate[sd]?|regulatory)\b/) ? ["regulation"] : []),
      ...(has(/\b(?:control|controlled|controls)\b/) ? ["control"] : []),
    ],
    arousal_activation: [
      ...(has(/\barousal\b/) ? ["arousal"] : []),
      ...(has(/\b(?:activation|activate[sd]?)\b/) ? ["activation"] : []),
    ],
    recovery_restoration: [
      ...(has(/\b(?:recovery|recover(?:ed|y|ing)?)\b/) ? ["recovery"] : []),
      ...(has(/\b(?:restoration|restore[sd]?)\b/) ? ["restoration"] : []),
    ],
    awareness_accuracy: [
      ...(has(/\bawareness\b/) ? ["awareness"] : []),
      ...(has(/\baccuracy\b/) ? ["accuracy"] : []),
    ],
    predict_explain: [
      ...(has(/\b(?:predict|predicts|predicted|prediction)\b/) ? ["predict"] : []),
      ...(has(/\b(?:explain|explains|explained|explanation)\b/) ? ["explain"] : []),
    ],
    modality_may_can_is: [
      ...(has(/\bmay\b/) ? ["may"] : []),
      ...(has(/\bcan\b/) ? ["can"] : []),
      ...(has(/\bis\b/) ? ["is"] : []),
    ],
    evidence_proof: [
      ...(has(/\bevidence\b/) ? ["evidence"] : []),
      ...(has(/\bproof\b/) ? ["proof"] : []),
    ],
  }
}

function validateEnvelope(
  record: unknown,
  schemaVersion: string,
  reviewerRole: string,
  claim: DnaAtomicClaim,
  passages: readonly DnaSourcePassage[],
  errors: string[],
): record is DnaReviewEnvelope<string, unknown> {
  if (!exactKeys(record, [
    "schemaVersion",
    "reviewId",
    "reviewerRole",
    "completedAt",
    "binding",
    "assessment",
    "rationale",
    "evidenceSha256",
    "reviewPayloadSha256",
  ], "review", errors)) return false
  const candidate = record as unknown as DnaReviewEnvelope<string, unknown>
  if (candidate.schemaVersion !== schemaVersion) errors.push("review:invalid_schema_version")
  if (!STABLE_ID_PATTERN.test(candidate.reviewId)) errors.push("review:invalid_id")
  if (candidate.reviewerRole !== reviewerRole) errors.push("review:invalid_reviewer_role")
  if (!isExactIsoInstant(candidate.completedAt)) errors.push("review:invalid_completed_at")
  validateBinding(candidate.binding, claim, passages, errors)
  if (!validateBoundedText(candidate.rationale, 12, 1200)) errors.push("review:invalid_rationale")
  if (!SHA256_PATTERN.test(candidate.evidenceSha256)) errors.push("review:invalid_evidence_hash")
  if (!SHA256_PATTERN.test(candidate.reviewPayloadSha256)
    || candidate.reviewPayloadSha256 !== hashDnaClaimReviewPayload(withoutReviewHash(candidate))) {
    errors.push("review:payload_hash_mismatch")
  }
  return true
}

function trustRecordMatches(
  registry: DnaClaimReviewTrustRegistry,
  kind: DnaClaimReviewTrustKind,
  recordId: string,
  claim: DnaAtomicClaim,
  subjectSha256: string,
): boolean {
  return registry.records.some((record) =>
    record.kind === kind
    && record.recordId === recordId
    && record.sourceId === claim.sourceId
    && record.artifactSha256 === claim.artifactSha256
    && record.claimSha256 === claim.claimSha256
    && record.subjectSha256 === subjectSha256)
}

function validateRegistry(registry: DnaClaimReviewTrustRegistry, explicitTest: boolean, errors: string[]): void {
  if (registry.registryKind !== (explicitTest ? "explicit_test_only" : "production_compiled")) {
    errors.push("registry:invalid_kind")
  }
  if (explicitTest && (process.env.DNA_CLAIM_REVIEW_TEST_FIXTURE_MODE !== "1"
    || process.env.NODE_ENV === "production")) {
    errors.push("registry:test_fixture_not_authorized")
  }
  const keys = new Set<string>()
  for (const [index, record] of registry.records.entries()) {
    if (!exactKeys(record, [
      "kind", "recordId", "sourceId", "artifactSha256", "claimSha256", "subjectSha256",
    ], `registry_record_${index}`, errors)) continue
    if (!DNA_CLAIM_REVIEW_TRUST_KINDS.includes(record.kind)) errors.push(`registry_record_${index}:invalid_kind`)
    if (!STABLE_ID_PATTERN.test(record.recordId) || !STABLE_ID_PATTERN.test(record.sourceId)) {
      errors.push(`registry_record_${index}:invalid_id`)
    }
    for (const [field, value] of [
      ["artifact", record.artifactSha256],
      ["claim", record.claimSha256],
      ["subject", record.subjectSha256],
    ] as const) if (!SHA256_PATTERN.test(value)) errors.push(`registry_record_${index}:invalid_${field}_hash`)
    const key = `${record.kind}\u0000${record.recordId}\u0000${record.sourceId}\u0000${record.claimSha256}`
    if (keys.has(key)) errors.push(`registry_record_${index}:duplicate_record`)
    keys.add(key)
  }
}

function validateFindingMap<T extends string>(
  value: unknown,
  dimensions: readonly T[],
  label: string,
  errors: string[],
): value is Readonly<Record<T, DnaReviewFinding>> {
  if (!exactKeys(value, dimensions, label, errors)) return false
  for (const dimension of dimensions) {
    const finding = (value as Record<string, unknown>)[dimension]
    if (!DNA_REVIEW_FINDINGS.includes(finding as DnaReviewFinding)) {
      errors.push(`${label}:${dimension}:invalid_finding`)
    }
  }
  return true
}

function deriveClinicalBlockers(
  assessment: DnaClinicalSafetyAssessment,
): readonly DnaClinicalAutomaticBlocker[] {
  const blockers: DnaClinicalAutomaticBlocker[] = []
  if (Object.values(assessment.findings).some((finding) => finding === "not_assessed")
    || assessment.clinicalCriticality === "not_assessed"
    || assessment.evidenceBreadth === "not_assessed"
    || assessment.statisticExplanation === "not_assessed"
    || assessment.licenseStatus === "not_assessed"
    || assessment.scientificConflictStatus === "not_assessed") blockers.push("review_incomplete")
  if (assessment.findings.new_clinical_threshold === "present") blockers.push("new_clinical_threshold")
  if (assessment.findings.diagnostic_drift === "present") blockers.push("diagnosis_or_differential")
  if (assessment.findings.treatment_or_medication_drift === "present") blockers.push("treatment_or_medication")
  if (assessment.findings.prognosis_impression === "present") blockers.push("prognosis")
  if (assessment.findings.individual_biological_inference === "present") blockers.push("individual_biological_mechanism")
  if (assessment.findings.behavior_to_brain_or_autonomic_inference === "present") {
    blockers.push("behavior_to_brain_or_autonomic_inference")
  }
  if (assessment.findings.ambiguous_age_risk === "present") blockers.push("ambiguous_age_risk")
  if (assessment.findings.definitive_causality_impression === "present") blockers.push("definitive_causality")
  if (assessment.clinicalCriticality === "critical" && assessment.evidenceBreadth === "single_source") {
    blockers.push("critical_clinical_conclusion_from_single_source")
  }
  if (assessment.statisticExplanation === "unexplained") blockers.push("unexplained_statistic")
  if (assessment.licenseStatus === "unclear" || assessment.licenseStatus === "prohibited") {
    blockers.push("unclear_or_prohibited_license")
  }
  if (assessment.scientificConflictStatus === "unresolved") blockers.push("unresolved_scientific_conflict")
  return Object.freeze(sortedUnique(blockers) as DnaClinicalAutomaticBlocker[])
}

const PRODUCTION_CLAIM_REVIEW_TRUST_REGISTRY: DnaClaimReviewTrustRegistry = Object.freeze({
  registryKind: "production_compiled",
  records: Object.freeze([]),
})

/** The production trust root is deliberately empty until real reviews are audited and compiled. */
export const DNA_REGISTERED_CLAIM_REVIEW_RECORDS = PRODUCTION_CLAIM_REVIEW_TRUST_REGISTRY.records

function evaluate(
  bundle: DnaClaimReviewBundle,
  registry: DnaClaimReviewTrustRegistry,
  explicitTest: boolean,
): DnaClaimReviewGateResult {
  let adversarialConflictRequiresPhase25 = false
  const phaseErrors = new Map<20 | 21 | 22 | 23 | 24, string[]>()
  const errorsFor = (phase: 20 | 21 | 22 | 23 | 24) => {
    const errors: string[] = []
    phaseErrors.set(phase, errors)
    return errors
  }
  const registryErrors: string[] = []
  validateRegistry(registry, explicitTest, registryErrors)
  if (!isAtomicClaimIntegrityValid(bundle.claim)) registryErrors.push("claim:integrity_invalid")
  if (bundle.claim.runtimeEligible !== false || bundle.claim.status === "quarantined") {
    registryErrors.push("claim:not_reviewable_candidate")
  }
  if (bundle.passages.length !== bundle.claim.passageIds.length
    || new Set(bundle.passages.map((passage) => passage.id)).size !== bundle.passages.length) {
    registryErrors.push("claim:passage_set_invalid")
  }

  const fidelityErrors = errorsFor(20)
  if (validateEnvelope(bundle.sourceFidelity, DNA_SOURCE_FIDELITY_REVIEW_VERSION,
    "source_fidelity_reviewer", bundle.claim, bundle.passages, fidelityErrors)) {
    const assessment = bundle.sourceFidelity.assessment
    if (!exactKeys(assessment, ["entailment", "issues"], "fidelity_assessment", fidelityErrors)) {
      // shape error already recorded
    } else {
      if (!["entailed", "partially_entailed", "not_entailed", "not_assessed"].includes(assessment.entailment)) {
        fidelityErrors.push("fidelity:invalid_entailment")
      }
      if (validateFindingMap(assessment.issues, DNA_SOURCE_FIDELITY_ISSUES, "fidelity_issues", fidelityErrors)) {
        if (assessment.entailment !== "entailed") fidelityErrors.push("fidelity:claim_not_entailed")
        if (Object.values(assessment.issues).some((finding) => finding !== "absent")) {
          fidelityErrors.push("fidelity:issue_present_or_unassessed")
        }
      }
    }
    if (!trustRecordMatches(registry, "source_fidelity_review", bundle.sourceFidelity.reviewId,
      bundle.claim, bundle.sourceFidelity.reviewPayloadSha256)) fidelityErrors.push("fidelity:review_not_trusted")
  }

  const methodErrors = errorsFor(21)
  if (validateEnvelope(bundle.methodSupport, DNA_METHOD_SUPPORT_REVIEW_VERSION,
    "method_support_reviewer", bundle.claim, bundle.passages, methodErrors)) {
    const assessment = bundle.methodSupport.assessment
    const keys = [
      "methodAppraisalId", "methodAppraisalSha256", "appraisalDisposition",
      "designSupportsClaim", "correlationCausationAligned", "measurementValidity",
      "sampleAndAgeAligned", "effectAndUncertaintyReflected", "studyContextRespected",
    ] as const
    if (exactKeys(assessment, keys, "method_assessment", methodErrors)) {
      if (!STABLE_ID_PATTERN.test(assessment.methodAppraisalId)) methodErrors.push("method:invalid_appraisal_id")
      if (!SHA256_PATTERN.test(assessment.methodAppraisalSha256)) methodErrors.push("method:invalid_appraisal_hash")
      if (assessment.appraisalDisposition !== "eligible_for_body_synthesis_with_limits") {
        methodErrors.push("method:appraisal_not_eligible")
      }
      for (const field of [
        "designSupportsClaim", "correlationCausationAligned", "measurementValidity",
        "sampleAndAgeAligned", "effectAndUncertaintyReflected", "studyContextRespected",
      ] as const) {
        if (!DNA_METHOD_SUPPORT_FINDINGS.includes(assessment[field])) methodErrors.push(`method:${field}:invalid`)
        else if (assessment[field] !== "adequate_with_stated_limits") methodErrors.push(`method:${field}:concern_or_unassessed`)
      }
      if (!trustRecordMatches(registry, "method_appraisal", assessment.methodAppraisalId,
        bundle.claim, assessment.methodAppraisalSha256)) methodErrors.push("method:appraisal_not_trusted")
    }
    if (!trustRecordMatches(registry, "method_support_review", bundle.methodSupport.reviewId,
      bundle.claim, bundle.methodSupport.reviewPayloadSha256)) methodErrors.push("method:review_not_trusted")
  }

  const adversarialErrors = errorsFor(22)
  if (validateEnvelope(bundle.adversarial, DNA_ADVERSARIAL_REVIEW_VERSION,
    "adversarial_reviewer", bundle.claim, bundle.passages, adversarialErrors)) {
    const assessment = bundle.adversarial.assessment
    if (exactKeys(assessment, [
      "evidenceSetId", "evidenceSetSha256", "searchCutoff", "consideredSourceIds",
      "comparisonBasis", "findings", "disposition",
    ], "adversarial_assessment", adversarialErrors)) {
      if (!STABLE_ID_PATTERN.test(assessment.evidenceSetId)) adversarialErrors.push("adversarial:invalid_evidence_set_id")
      if (!SHA256_PATTERN.test(assessment.evidenceSetSha256)) adversarialErrors.push("adversarial:invalid_evidence_set_hash")
      if (!isExactIsoInstant(assessment.searchCutoff)) adversarialErrors.push("adversarial:invalid_search_cutoff")
      if (!Array.isArray(assessment.consideredSourceIds)
        || assessment.consideredSourceIds.length === 0
        || assessment.consideredSourceIds.some((id) => !STABLE_ID_PATTERN.test(id))
        || sortedUnique(assessment.consideredSourceIds).length !== assessment.consideredSourceIds.length) {
        adversarialErrors.push("adversarial:invalid_considered_sources")
      }
      if (assessment.comparisonBasis !== "method_quality_over_recency_or_count") {
        adversarialErrors.push("adversarial:invalid_comparison_basis")
      }
      if (validateFindingMap(assessment.findings, DNA_ADVERSARIAL_DIMENSIONS,
        "adversarial_findings", adversarialErrors)) {
        const findings = Object.values(assessment.findings)
        const hasCounterevidence = findings.some((finding) => finding === "present")
        const hasUnassessedFinding = findings.some((finding) => finding === "not_assessed")
        if (hasUnassessedFinding) {
          adversarialErrors.push("adversarial:counterevidence_unassessed")
        }
        if (assessment.disposition === "no_material_counterevidence_found"
          && hasCounterevidence) {
          adversarialErrors.push("adversarial:counterevidence_disposition_mismatch")
        }
        if (assessment.disposition === "contested") {
          if (!hasCounterevidence) {
            adversarialErrors.push("adversarial:contested_without_counterevidence")
          } else if (!hasUnassessedFinding) {
            adversarialConflictRequiresPhase25 = true
          }
        }
      }
      if (assessment.disposition === "quarantined") {
        adversarialErrors.push("adversarial:quarantined")
      } else if (!["no_material_counterevidence_found", "contested"]
        .includes(assessment.disposition)) {
        adversarialErrors.push("adversarial:invalid_disposition")
      }
      if (!trustRecordMatches(registry, "adversarial_evidence_set", assessment.evidenceSetId,
        bundle.claim, assessment.evidenceSetSha256)) adversarialErrors.push("adversarial:evidence_set_not_trusted")
    }
    if (!trustRecordMatches(registry, "adversarial_review", bundle.adversarial.reviewId,
      bundle.claim, bundle.adversarial.reviewPayloadSha256)) adversarialErrors.push("adversarial:review_not_trusted")
  }

  const safetyErrors = errorsFor(23)
  if (validateEnvelope(bundle.clinicalSafety, DNA_CLINICAL_SAFETY_REVIEW_VERSION,
    "clinical_safety_reviewer", bundle.claim, bundle.passages, safetyErrors)) {
    const assessment = bundle.clinicalSafety.assessment
    if (exactKeys(assessment, [
      "findings", "clinicalCriticality", "evidenceBreadth", "statisticExplanation",
      "licenseStatus", "scientificConflictStatus", "automaticBlockers",
    ], "safety_assessment", safetyErrors)) {
      const findingsValid = validateFindingMap(
        assessment.findings,
        DNA_CLINICAL_SAFETY_DIMENSIONS,
        "safety_findings",
        safetyErrors,
      )
      if (!["critical", "noncritical", "not_assessed"].includes(assessment.clinicalCriticality)) {
        safetyErrors.push("safety:invalid_clinical_criticality")
      }
      if (!["multiple_sources_or_synthesis", "single_source", "not_assessed"].includes(assessment.evidenceBreadth)) {
        safetyErrors.push("safety:invalid_evidence_breadth")
      }
      if (!["explained", "not_applicable", "unexplained", "not_assessed"].includes(assessment.statisticExplanation)) {
        safetyErrors.push("safety:invalid_statistic_explanation")
      }
      if (!["approved", "unclear", "prohibited", "not_assessed"].includes(assessment.licenseStatus)) {
        safetyErrors.push("safety:invalid_license_status")
      }
      if (!["none_identified", "resolved_with_boundary", "unresolved", "not_assessed"].includes(assessment.scientificConflictStatus)) {
        safetyErrors.push("safety:invalid_conflict_status")
      }
      if (findingsValid) {
        const derived = deriveClinicalBlockers(assessment)
        if (!Array.isArray(assessment.automaticBlockers)
          || assessment.automaticBlockers.some((blocker) => !DNA_CLINICAL_AUTOMATIC_BLOCKERS.includes(blocker))
          || stableJson(assessment.automaticBlockers) !== stableJson(derived)) {
          safetyErrors.push("safety:automatic_blockers_incomplete_or_incorrect")
        }
        const fatalBlockers = derived.filter((blocker) =>
          blocker !== "unresolved_scientific_conflict"
          || !adversarialConflictRequiresPhase25)
        if (fatalBlockers.length > 0) safetyErrors.push("safety:automatic_block")
      }
    }
    if (!trustRecordMatches(registry, "clinical_safety_review", bundle.clinicalSafety.reviewId,
      bundle.claim, bundle.clinicalSafety.reviewPayloadSha256)) safetyErrors.push("safety:review_not_trusted")
  }

  const translationErrors = errorsFor(24)
  if (validateEnvelope(bundle.turkishTransfer, DNA_TURKISH_TRANSFER_REVIEW_VERSION,
    "turkish_transfer_reviewer", bundle.claim, bundle.passages, translationErrors)) {
    const assessment = bundle.turkishTransfer.assessment
    if (exactKeys(assessment, [
      "transferDirection", "originalPassages", "approvedTurkishNarrative",
      "independentBackTranslation", "conceptualEquivalence", "reverseMeaning",
      "meaningScope", "causalStrength", "modality", "termChecks",
    ], "translation_assessment", translationErrors)) {
      if (assessment.transferDirection !== "english_to_turkish") translationErrors.push("translation:invalid_direction")
      const passageById = new Map(bundle.passages.map((passage) => [passage.id, passage]))
      if (!Array.isArray(assessment.originalPassages)
        || assessment.originalPassages.length !== bundle.claim.passageIds.length) {
        translationErrors.push("translation:original_passages_missing")
      } else {
        if (stableJson(assessment.originalPassages.map((retained) => retained.passageId))
          !== stableJson(bundle.claim.passageIds)) {
          translationErrors.push("translation:original_passage_order_or_identity_mismatch")
        }
        for (const [index, retained] of assessment.originalPassages.entries()) {
        if (!exactKeys(retained, [
          "passageId", "originalLanguage", "originalText", "contentSha256", "provenanceSha256",
        ], `translation_original_${index}`, translationErrors)) continue
        const retainedPassage = retained as unknown as DnaOriginalPassageRetention
        const passage = passageById.get(retainedPassage.passageId)
        if (!passage || retainedPassage.originalLanguage !== "en"
          || passage.originalLanguage !== "en"
          || retainedPassage.originalText !== passage.originalText
          || retainedPassage.contentSha256 !== passage.contentSha256
          || retainedPassage.provenanceSha256 !== passage.provenanceSha256) {
          translationErrors.push(`translation:original_passage_not_retained:${retainedPassage.passageId}`)
        }
        }
      }
      if (!validateBoundedText(assessment.approvedTurkishNarrative, 12, 1600)) {
        translationErrors.push("translation:invalid_turkish_narrative")
      }
      if (!validateBoundedText(assessment.independentBackTranslation, 12, 1600)) {
        translationErrors.push("translation:invalid_back_translation")
      }
      if (assessment.conceptualEquivalence !== "preserved"
        || assessment.reverseMeaning !== "absent"
        || assessment.meaningScope !== "preserved"
        || assessment.causalStrength !== "preserved"
        || assessment.modality !== "preserved") {
        translationErrors.push("translation:semantic_drift_or_unassessed")
      }
      if (!Array.isArray(assessment.termChecks)
        || assessment.termChecks.length !== DNA_TRANSLATION_TERM_FAMILIES.length) {
        translationErrors.push("translation:term_check_set_incomplete")
      } else {
        const detectedTerms = englishTermPresence(
          bundle.passages.map((passage) => passage.originalText).join("\n\n"),
        )
        const familySet = new Set<DnaTranslationTermFamily>()
        for (const [index, check] of assessment.termChecks.entries()) {
          if (!exactKeys(check, [
            "family", "relevance", "sourceTerms", "approvedTurkishTerms",
            "conceptPreserved", "reverseMeaningChecked", "scopeChange",
          ], `translation_term_${index}`, translationErrors)) continue
          const termCheck = check as unknown as DnaTranslationTermCheck
          if (!DNA_TRANSLATION_TERM_FAMILIES.includes(termCheck.family) || familySet.has(termCheck.family)) {
            translationErrors.push(`translation_term_${index}:invalid_or_duplicate_family`)
            continue
          }
          familySet.add(termCheck.family)
          if (!["relevant", "not_present"].includes(termCheck.relevance)) {
            translationErrors.push(`translation_term_${index}:invalid_relevance`)
          }
          if (!Array.isArray(termCheck.sourceTerms) || !Array.isArray(termCheck.approvedTurkishTerms)) {
            translationErrors.push(`translation_term_${index}:invalid_terms`)
            continue
          }
          if (termCheck.relevance === "relevant") {
            const allowedTerms = TRANSLATION_FAMILY_TERMS[termCheck.family]
            if (termCheck.sourceTerms.length === 0 || termCheck.approvedTurkishTerms.length === 0
              || termCheck.sourceTerms.some((term) => !allowedTerms.includes(normalizeText(term).toLowerCase()))
              || stableJson(sortedUnique(termCheck.sourceTerms.map((term) => normalizeText(term).toLowerCase())))
                !== stableJson(sortedUnique(detectedTerms[termCheck.family]))
              || termCheck.approvedTurkishTerms.some((term) => !validateBoundedText(term, 1, 80))) {
              translationErrors.push(`translation_term_${index}:invalid_relevant_terms`)
            }
            if (termCheck.conceptPreserved !== "yes" || termCheck.reverseMeaningChecked !== "yes"
              || termCheck.scopeChange !== "none") {
              translationErrors.push(`translation_term_${index}:semantic_check_failed`)
            }
          } else if (detectedTerms[termCheck.family].length > 0
            || termCheck.sourceTerms.length !== 0 || termCheck.approvedTurkishTerms.length !== 0
            || termCheck.conceptPreserved !== "yes" || termCheck.reverseMeaningChecked !== "yes"
            || termCheck.scopeChange !== "none") {
            translationErrors.push(`translation_term_${index}:not_present_shape_invalid`)
          }
        }
        if (familySet.size !== DNA_TRANSLATION_TERM_FAMILIES.length) {
          translationErrors.push("translation:term_check_families_incomplete")
        }
      }
    }
    if (!trustRecordMatches(registry, "turkish_transfer_review", bundle.turkishTransfer.reviewId,
      bundle.claim, bundle.turkishTransfer.reviewPayloadSha256)) translationErrors.push("translation:review_not_trusted")
  }

  const orderedReviews = [
    [20, bundle.sourceFidelity],
    [21, bundle.methodSupport],
    [22, bundle.adversarial],
    [23, bundle.clinicalSafety],
    [24, bundle.turkishTransfer],
  ] as const
  const reviewIds = new Set<string>()
  const evidenceHashes = new Set<string>()
  orderedReviews.forEach(([phase, review], index) => {
    if (reviewIds.has(review.reviewId)) phaseErrors.get(phase)!.push("review:duplicate_review_id")
    reviewIds.add(review.reviewId)
    if (evidenceHashes.has(review.evidenceSha256)) phaseErrors.get(phase)!.push("review:duplicate_evidence_hash")
    evidenceHashes.add(review.evidenceSha256)
    if (index > 0) {
      const previous = Date.parse(orderedReviews[index - 1]![1].completedAt)
      const current = Date.parse(review.completedAt)
      if (!Number.isFinite(previous) || !Number.isFinite(current) || current <= previous) {
        phaseErrors.get(phase)!.push("review:non_chronological_pass")
      }
    }
  })

  if (registryErrors.length > 0) {
    for (const phase of [20, 21, 22, 23, 24] as const) phaseErrors.get(phase)!.push(...registryErrors)
  }
  const failedPhases = ([20, 21, 22, 23, 24] as const).filter((phase) => phaseErrors.get(phase)!.length > 0)
  const reasons = sortedUnique([...phaseErrors.entries()].flatMap(([phase, errors]) =>
    errors.map((error) => `phase_${phase}:${error}`)))
  const reviewPayloadSha256s = {
    sourceFidelity: bundle.sourceFidelity?.reviewPayloadSha256 ?? "",
    methodSupport: bundle.methodSupport?.reviewPayloadSha256 ?? "",
    adversarial: bundle.adversarial?.reviewPayloadSha256 ?? "",
    clinicalSafety: bundle.clinicalSafety?.reviewPayloadSha256 ?? "",
    turkishTransfer: bundle.turkishTransfer?.reviewPayloadSha256 ?? "",
  }
  const core = {
    schemaVersion: DNA_CLAIM_REVIEW_GATES_VERSION,
    status: failedPhases.length === 0
      ? adversarialConflictRequiresPhase25
        ? "requires_phase_25_conflict_resolution" as const
        : "eligible_for_phase_25_conflict_processing" as const
      : "blocked" as const,
    runtimeEligible: false as const,
    failedPhases,
    reasons,
    reviewPayloadSha256s,
  }
  return deepFreeze({ ...core, bundleSha256: hashDnaClaimReviewPayload(core) })
}

function malformedGateResult(reason: string): DnaClaimReviewGateResult {
  const core = {
    schemaVersion: DNA_CLAIM_REVIEW_GATES_VERSION,
    status: "blocked" as const,
    runtimeEligible: false as const,
    failedPhases: [20, 21, 22, 23, 24] as const,
    reasons: [`input:${reason}`],
    reviewPayloadSha256s: {
      sourceFidelity: "",
      methodSupport: "",
      adversarial: "",
      clinicalSafety: "",
      turkishTransfer: "",
    },
  }
  return deepFreeze({ ...core, bundleSha256: hashDnaClaimReviewPayload(core) })
}

function isReviewBundleShape(value: unknown): value is DnaClaimReviewBundle {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  if (stableJson(Object.keys(candidate).sort()) !== stableJson([
    "adversarial", "claim", "clinicalSafety", "methodSupport", "passages",
    "sourceFidelity", "turkishTransfer",
  ])) return false
  const claim = candidate.claim as Record<string, unknown> | null
  return Boolean(claim && typeof claim === "object" && Array.isArray(claim.passageIds))
    && Array.isArray(candidate.passages)
    && candidate.passages.every((passage) => Boolean(passage && typeof passage === "object"))
    && [
      candidate.sourceFidelity,
      candidate.methodSupport,
      candidate.adversarial,
      candidate.clinicalSafety,
      candidate.turkishTransfer,
    ].every((review) => Boolean(review && typeof review === "object" && !Array.isArray(review)))
}

function isReviewRegistryShape(value: unknown): value is DnaClaimReviewTrustRegistry {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return stableJson(Object.keys(candidate).sort()) === stableJson(["records", "registryKind"])
    && Array.isArray(candidate.records)
    && candidate.records.every((record) => Boolean(record && typeof record === "object" && !Array.isArray(record)))
}

export function evaluateDnaClaimReviewGates(bundle: unknown): DnaClaimReviewGateResult {
  if (!isReviewBundleShape(bundle)) return malformedGateResult("invalid_bundle_shape")
  return evaluate(bundle, PRODUCTION_CLAIM_REVIEW_TRUST_REGISTRY, false)
}

/** Positive-path seam for deterministic contract tests; never use it in a production release compiler. */
export function evaluateDnaClaimReviewGatesWithExplicitTestRegistry(
  bundle: unknown,
  registry: unknown,
): DnaClaimReviewGateResult {
  if (!isReviewBundleShape(bundle)) return malformedGateResult("invalid_bundle_shape")
  if (!isReviewRegistryShape(registry)) return malformedGateResult("invalid_registry_shape")
  return evaluate(bundle, registry, true)
}

export const DNA_CLAIM_REVIEW_GATES_CONTRACT = deepFreeze({
  schemaVersion: DNA_CLAIM_REVIEW_GATES_VERSION,
  phases: [20, 21, 22, 23, 24],
  reviewOrder: [
    DNA_SOURCE_FIDELITY_REVIEW_VERSION,
    DNA_METHOD_SUPPORT_REVIEW_VERSION,
    DNA_ADVERSARIAL_REVIEW_VERSION,
    DNA_CLINICAL_SAFETY_REVIEW_VERSION,
    DNA_TURKISH_TRANSFER_REVIEW_VERSION,
  ],
  claimPassageEntailmentRequired: true,
  methodQualityOutranksRecencyAndCount: true,
  originalEnglishPassageRetained: true,
  runtimeEligible: false,
  autonomousScientificReviewImplemented: false,
  productionRegisteredReviewCount: DNA_REGISTERED_CLAIM_REVIEW_RECORDS.length,
  passingDisposition: "eligible_for_phase_25_conflict_processing_not_runtime",
  contestedDisposition: "requires_phase_25_conflict_resolution_not_runtime",
})

import { createHash } from "node:crypto"

import {
  DNA_METHOD_APPRAISAL_PROTOCOL_VERSION,
  DNA_METHOD_APPRAISAL_VERSION,
  hashDnaAppraisalPayload,
  isDnaMethodAppraisalEligibleWithExplicitTestRegistry,
  type DnaMethodAppraisal,
  type DnaMethodAppraisalTrustRegistry,
  validateDnaMethodAppraisalWithExplicitTestRegistry,
} from "./methodAppraisal"
import {
  type DnaMethodAppraisalCandidate,
  type DnaMethodAppraisalFidelityPass,
  type DnaMethodAppraisalReconciliation,
  type DnaMethodObservation,
  type DnaMethodReviewPass,
  validateDnaMethodAppraisalCandidate,
  validateDnaMethodAppraisalFidelityPass,
  validateDnaMethodAppraisalReconciliation,
  validateDnaMethodReviewPass,
} from "./methodAppraisalBatch"

export const DNA_METHOD_APPRAISAL_REGISTRATION_DECISION_VERSION =
  "dna-method-appraisal-registration-decision@1" as const
export const DNA_METHOD_APPRAISAL_REGISTRATION_RESULT_VERSION =
  "dna-method-appraisal-registration-result@1" as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,199}$/

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort((left, right) => left.localeCompare(right, "en"))
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`
}

export function hashDnaMethodAppraisalRegistrationPayload(value: unknown): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex")
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  }
  return value
}

function exactKeys(value: unknown, expected: readonly string[], code: string): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code)
  const actual = Object.keys(value as Record<string, unknown>)
    .sort((left, right) => left.localeCompare(right, "en"))
  const wanted = [...expected].sort((left, right) => left.localeCompare(right, "en"))
  if (actual.length !== wanted.length
    || actual.some((key, index) => key !== wanted[index])) throw new Error(code)
}

function assertIdentifier(value: string, code: string): void {
  if (!IDENTIFIER_PATTERN.test(String(value || ""))) throw new Error(code)
}

function assertSha256(value: string, code: string): void {
  if (!SHA256_PATTERN.test(String(value || ""))) throw new Error(code)
}

function assertIsoTimestamp(value: string, code: string): void {
  const timestamp = Date.parse(String(value || ""))
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new Error(code)
  }
}

export type DnaMethodAppraisalRegistrationMapping = Readonly<Pick<
  DnaMethodAppraisal,
  | "studyDesign"
  | "sampleSize"
  | "population"
  | "ageScope"
  | "inclusionCriteria"
  | "exclusionCriteria"
  | "measures"
  | "blinding"
  | "randomization"
  | "missingData"
  | "confounding"
  | "multiplicity"
  | "effectSize"
  | "confidenceInterval"
  | "preregistration"
  | "reproducibility"
  | "funding"
  | "conflictOfInterest"
  | "generalizability"
  | "causalBoundary"
  | "adaptedGradeDimensions"
>>

export type DnaMethodAppraisalRegistrationDecision = Readonly<{
  schemaVersion: typeof DNA_METHOD_APPRAISAL_REGISTRATION_DECISION_VERSION
  decisionId: string
  sourceId: string
  appraisalId: string
  candidateSha256: string
  reviewedAt: string
  reviewerId: string
  reviewerRole: "method_appraisal_registration"
  authorityClass: "codex_multi_pass_not_independent"
  disposition: "register_with_limits"
  reviewedEvidenceParagraphIds: readonly string[]
  mapping: DnaMethodAppraisalRegistrationMapping
  rationale: string
  decisionSha256: string
}>

export type DnaMethodRegistrationWorkpack = Readonly<{
  sourceId: string
  artifactId: string
  artifactSha256: string
  parsedContentSha256: string
  workpackSha256: string
  paragraphs: readonly Readonly<{
    paragraphId: string
    artifactSha256: string
    contentSha256: string
  }>[]
}>

export type DnaMethodAppraisalRegistrationResult = Readonly<{
  schemaVersion: typeof DNA_METHOD_APPRAISAL_REGISTRATION_RESULT_VERSION
  sourceId: string
  candidateSha256: string
  decisionSha256: string
  appraisal: DnaMethodAppraisal
  trustRegistry: DnaMethodAppraisalTrustRegistry
  evidenceParagraphCount: number
  resultSha256: string
}>

const REGISTRATION_RESULT_KEYS = Object.freeze([
  "schemaVersion", "sourceId", "candidateSha256", "decisionSha256", "appraisal",
  "trustRegistry", "evidenceParagraphCount", "resultSha256",
] as const)

export function isDnaMethodAppraisalRegistrationResultValid(
  result: DnaMethodAppraisalRegistrationResult,
): boolean {
  try {
    exactKeys(result, REGISTRATION_RESULT_KEYS,
      "dna_method_registration_result_unknown_or_missing_field")
    if (result.schemaVersion !== DNA_METHOD_APPRAISAL_REGISTRATION_RESULT_VERSION
      || result.trustRegistry.registryKind !== "production_compiled"
      || !Number.isInteger(result.evidenceParagraphCount)
      || result.evidenceParagraphCount < 1
      || result.appraisal.sourceId !== result.sourceId
      || result.appraisal.disposition !== "eligible_for_body_synthesis_with_limits"
      || result.appraisal.reviewStatus !== "codex_multi_pass_audited"
      || result.trustRegistry.appraisals.length !== 1
      || result.trustRegistry.appraisals[0]?.appraisalId !== result.appraisal.id
      || result.trustRegistry.evidenceRefs.length !== result.evidenceParagraphCount) {
      return false
    }
    assertIdentifier(result.sourceId, "dna_method_registration_result_source_id_invalid")
    for (const value of [
      result.candidateSha256,
      result.decisionSha256,
      result.appraisal.appraisalPayloadSha256,
      result.resultSha256,
    ]) assertSha256(value, "dna_method_registration_result_hash_invalid")
    const { appraisalPayloadSha256, ...appraisalPayload } = result.appraisal
    if (appraisalPayloadSha256 !== hashDnaAppraisalPayload(appraisalPayload)) return false
    const explicitRegistry: DnaMethodAppraisalTrustRegistry = {
      ...result.trustRegistry,
      registryKind: "explicit_test_only",
    }
    if (!validateDnaMethodAppraisalWithExplicitTestRegistry(
      result.appraisal,
      explicitRegistry,
    ).ok || !isDnaMethodAppraisalEligibleWithExplicitTestRegistry(
      result.appraisal,
      explicitRegistry,
    )) return false
    const { resultSha256, ...payload } = result
    return resultSha256 === hashDnaMethodAppraisalRegistrationPayload(payload)
  } catch {
    return false
  }
}

const MAPPING_KEYS = Object.freeze([
  "studyDesign", "sampleSize", "population", "ageScope", "inclusionCriteria",
  "exclusionCriteria", "measures", "blinding", "randomization", "missingData",
  "confounding", "multiplicity", "effectSize", "confidenceInterval",
  "preregistration", "reproducibility", "funding", "conflictOfInterest",
  "generalizability", "causalBoundary", "adaptedGradeDimensions",
] as const)

const PROFILE_STUDY_DESIGNS: Readonly<Record<string, readonly DnaMethodAppraisal["studyDesign"][]>> =
  Object.freeze({
    "profile.evidence_synthesis": ["systematic_review_meta_analysis", "narrative_review"],
    "profile.intervention_trial": ["randomized_controlled_trial", "nonrandomized_intervention"],
    "profile.observational": [
      "prospective_cohort", "retrospective_cohort", "case_control", "cross_sectional",
    ],
    "profile.measurement_validation": ["psychometric_validation"],
    "profile.diagnostic_accuracy": ["diagnostic_accuracy"],
    "profile.qualitative": ["qualitative"],
    "profile.case_based": ["case_series", "single_case_experimental"],
    "profile.basic_mechanistic": ["animal_experimental", "in_vitro", "other"],
    "profile.guideline_consensus_standard": ["guideline", "consensus", "other"],
    "profile.narrative_theory_textbook": ["narrative_review", "theory", "textbook"],
    "profile.protocol_other": ["protocol", "other"],
  })

function allEvidenceParagraphIds(candidate: DnaMethodAppraisalCandidate): readonly string[] {
  const observations: DnaMethodObservation[] = [
    candidate.studyDesign,
    candidate.population,
    candidate.ageScope,
    ...Object.values(candidate.methodFields),
    ...Object.values(candidate.adaptedGradeDimensions),
  ]
  const countObservations = Object.values(candidate.sampleSize)
  return Object.freeze([...new Set([
    ...observations.flatMap((observation) => observation.evidenceParagraphIds),
    ...countObservations.flatMap((observation) => observation.evidenceParagraphIds),
  ])].sort((left, right) => left.localeCompare(right, "en")))
}

function assertObservationStatePreserved(
  observation: DnaMethodObservation,
  mapped: unknown,
  field: string,
): void {
  if (observation.reportingState === "not_reported" && mapped !== "not_reported") {
    throw new Error(`dna_method_registration_${field}_overstates_not_reported`)
  }
  if (observation.reportingState === "not_applicable" && mapped !== "not_applicable") {
    throw new Error(`dna_method_registration_${field}_overstates_not_applicable`)
  }
  if (observation.reportingState === "not_assessed" && mapped !== "not_assessed") {
    throw new Error(`dna_method_registration_${field}_overstates_not_assessed`)
  }
}

function assertConservativeMapping(input: Readonly<{
  candidate: DnaMethodAppraisalCandidate
  mapping: DnaMethodAppraisalRegistrationMapping
}>): void {
  const { candidate, mapping } = input
  const allowedDesigns = PROFILE_STUDY_DESIGNS[candidate.designProfileId]
  if (!allowedDesigns?.includes(mapping.studyDesign)) {
    throw new Error("dna_method_registration_study_design_profile_mismatch")
  }
  if (mapping.population === "not_reported" || mapping.ageScope === "not_reported") {
    throw new Error("dna_method_registration_population_or_age_not_resolved")
  }
  if (["not_reported", "not_applicable", "not_assessed"].includes(
    candidate.population.reportingState,
  )) assertObservationStatePreserved(candidate.population, mapping.population, "population")
  if (["not_reported", "not_applicable", "not_assessed"].includes(
    candidate.ageScope.reportingState,
  )) assertObservationStatePreserved(candidate.ageScope, mapping.ageScope, "age_scope")

  const participantCount = candidate.sampleSize.participantCount
  if (participantCount.reporting === "reported_total") {
    if (mapping.sampleSize.reporting !== "reported"
      || mapping.sampleSize.total !== participantCount.total) {
      throw new Error("dna_method_registration_participant_total_mismatch")
    }
  } else if (mapping.sampleSize.reporting !== "not_reported"
    || mapping.sampleSize.total !== null) {
    throw new Error("dna_method_registration_non_deduplicated_sample_must_remain_unreported")
  }

  const mappedMethodFields: Readonly<Record<string, unknown>> = {
    inclusionCriteria: mapping.inclusionCriteria,
    exclusionCriteria: mapping.exclusionCriteria,
    measures: mapping.measures,
    blinding: mapping.blinding,
    randomization: mapping.randomization,
    missingData: mapping.missingData,
    confounding: mapping.confounding,
    multiplicity: mapping.multiplicity,
    effectSize: mapping.effectSize,
    confidenceInterval: mapping.confidenceInterval,
    preregistration: mapping.preregistration,
    reproducibility: mapping.reproducibility,
    funding: mapping.funding,
    conflictOfInterest: mapping.conflictOfInterest,
    generalizability: mapping.generalizability,
    causalBoundary: mapping.causalBoundary,
  }
  for (const [field, observation] of Object.entries(candidate.methodFields)) {
    assertObservationStatePreserved(observation, mappedMethodFields[field], field)
  }
  if (Object.values(mappedMethodFields).includes("not_assessed")) {
    throw new Error("dna_method_registration_required_method_field_not_assessed")
  }
  for (const [field, observation] of Object.entries(candidate.adaptedGradeDimensions)) {
    const mapped = mapping.adaptedGradeDimensions[
      field as keyof typeof mapping.adaptedGradeDimensions
    ]
    const bodyLevelDimension = field === "inconsistency" || field === "publicationBias"
    if (bodyLevelDimension) {
      assertObservationStatePreserved(observation, mapped, `adapted_grade_${field}`)
    } else if (["not_assessed", "not_reported"].includes(observation.reportingState)) {
      if (!["serious_concern", "very_serious_concern"].includes(mapped)) {
        throw new Error(`dna_method_registration_adapted_grade_${field}_unassessed_must_resolve_conservatively`)
      }
    } else {
      assertObservationStatePreserved(observation, mapped, `adapted_grade_${field}`)
    }
    if (observation.reportingState === "reported_with_concerns"
      && mapped === "no_serious_concern") {
      throw new Error(`dna_method_registration_adapted_grade_${field}_concern_erased`)
    }
  }
  if (mapping.adaptedGradeDimensions.inconsistency !== "not_assessed"
    || mapping.adaptedGradeDimensions.publicationBias !== "not_assessed") {
    throw new Error("dna_method_registration_single_source_body_dimension_overreach")
  }
  if ([
    mapping.adaptedGradeDimensions.riskOfBias,
    mapping.adaptedGradeDimensions.indirectness,
    mapping.adaptedGradeDimensions.imprecision,
  ].includes("not_assessed")) {
    throw new Error("dna_method_registration_required_adapted_grade_not_assessed")
  }
}

export function assertDnaMethodAppraisalRegistrationDecision(
  decision: DnaMethodAppraisalRegistrationDecision,
): void {
  exactKeys(decision, [
    "schemaVersion", "decisionId", "sourceId", "appraisalId", "candidateSha256",
    "reviewedAt", "reviewerId", "reviewerRole", "authorityClass", "disposition",
    "reviewedEvidenceParagraphIds", "mapping", "rationale", "decisionSha256",
  ], "dna_method_registration_decision_unknown_or_missing_field")
  if (decision.schemaVersion !== DNA_METHOD_APPRAISAL_REGISTRATION_DECISION_VERSION
    || decision.reviewerRole !== "method_appraisal_registration"
    || decision.authorityClass !== "codex_multi_pass_not_independent"
    || decision.disposition !== "register_with_limits") {
    throw new Error("dna_method_registration_decision_schema_or_state_mismatch")
  }
  assertIdentifier(decision.decisionId, "dna_method_registration_invalid_decision_id")
  assertIdentifier(decision.sourceId, "dna_method_registration_invalid_source_id")
  assertIdentifier(decision.appraisalId, "dna_method_registration_invalid_appraisal_id")
  assertIdentifier(decision.reviewerId, "dna_method_registration_invalid_reviewer_id")
  assertSha256(decision.candidateSha256, "dna_method_registration_invalid_candidate_hash")
  assertSha256(decision.decisionSha256, "dna_method_registration_invalid_decision_hash")
  assertIsoTimestamp(decision.reviewedAt, "dna_method_registration_invalid_reviewed_at")
  exactKeys(decision.mapping, MAPPING_KEYS,
    "dna_method_registration_mapping_unknown_or_missing_field")
  exactKeys(decision.mapping.sampleSize, ["reporting", "total"],
    "dna_method_registration_sample_size_invalid_shape")
  exactKeys(decision.mapping.adaptedGradeDimensions, [
    "riskOfBias", "inconsistency", "indirectness", "imprecision", "publicationBias",
  ], "dna_method_registration_adapted_grade_invalid_shape")
  if (!Array.isArray(decision.reviewedEvidenceParagraphIds)
    || !decision.reviewedEvidenceParagraphIds.length
    || new Set(decision.reviewedEvidenceParagraphIds).size
      !== decision.reviewedEvidenceParagraphIds.length
    || decision.reviewedEvidenceParagraphIds.some((id) => !IDENTIFIER_PATTERN.test(id))) {
    throw new Error("dna_method_registration_invalid_reviewed_evidence_ids")
  }
  const rationale = String(decision.rationale || "").trim()
  if (rationale.length < 40 || rationale.length > 2000) {
    throw new Error("dna_method_registration_invalid_rationale")
  }
  const { decisionSha256, ...payload } = decision
  if (decisionSha256 !== hashDnaMethodAppraisalRegistrationPayload(payload)) {
    throw new Error("dna_method_registration_decision_hash_mismatch")
  }
}

function assertBatchChain(input: Readonly<{
  candidate: DnaMethodAppraisalCandidate
  passA: DnaMethodReviewPass
  passB: DnaMethodReviewPass
  reconciliation: DnaMethodAppraisalReconciliation
  fidelityPass: DnaMethodAppraisalFidelityPass
}>): void {
  const validations = [
    validateDnaMethodAppraisalCandidate(input.candidate),
    validateDnaMethodReviewPass(input.passA),
    validateDnaMethodReviewPass(input.passB),
    validateDnaMethodAppraisalReconciliation(input.reconciliation),
    validateDnaMethodAppraisalFidelityPass(input.fidelityPass),
  ]
  if (validations.some((validation) => !validation.ok)) {
    throw new Error("dna_method_registration_batch_chain_invalid")
  }
  const candidateBindings = input.candidate.inputBindings
  if (input.passA.passRole !== "method_appraisal_a"
    || input.passB.passRole !== "method_appraisal_b"
    || candidateBindings.passASha256 !== input.passA.canonicalPayloadSha256
    || candidateBindings.passBSha256 !== input.passB.canonicalPayloadSha256
    || candidateBindings.reconciliationSha256
      !== input.reconciliation.canonicalPayloadSha256
    || candidateBindings.fidelityPassSha256 !== input.fidelityPass.canonicalPayloadSha256
    || new Set([
      input.candidate.sourceId, input.passA.sourceId, input.passB.sourceId,
      input.reconciliation.sourceId, input.fidelityPass.sourceId,
    ]).size !== 1) {
    throw new Error("dna_method_registration_batch_chain_binding_mismatch")
  }
}

export function compileDnaMethodAppraisalRegistration(input: Readonly<{
  candidate: DnaMethodAppraisalCandidate
  passA: DnaMethodReviewPass
  passB: DnaMethodReviewPass
  reconciliation: DnaMethodAppraisalReconciliation
  fidelityPass: DnaMethodAppraisalFidelityPass
  workpack: DnaMethodRegistrationWorkpack
  workpackFileSha256: string
  decision: DnaMethodAppraisalRegistrationDecision
}>): DnaMethodAppraisalRegistrationResult {
  assertBatchChain(input)
  assertDnaMethodAppraisalRegistrationDecision(input.decision)
  assertSha256(input.workpackFileSha256, "dna_method_registration_invalid_workpack_file_hash")
  const { candidate, decision, workpack } = input
  if (decision.sourceId !== candidate.sourceId
    || decision.candidateSha256 !== candidate.canonicalPayloadSha256
    || decision.appraisalId !== `appraisal:${candidate.sourceId}:v1`
    || Date.parse(decision.reviewedAt) <= Date.parse(input.fidelityPass.reviewedAt)) {
    throw new Error("dna_method_registration_decision_binding_or_chronology_mismatch")
  }
  if (workpack.sourceId !== candidate.sourceId
    || workpack.artifactId !== candidate.sourceBinding.artifactId
    || workpack.artifactSha256 !== candidate.sourceBinding.artifactSha256
    || workpack.parsedContentSha256 !== candidate.sourceBinding.parsedContentSha256
    || workpack.workpackSha256 !== candidate.sourceBinding.workpackPayloadSha256
    || input.workpackFileSha256 !== candidate.sourceBinding.workpackFileSha256) {
    throw new Error("dna_method_registration_workpack_binding_mismatch")
  }
  assertConservativeMapping({ candidate, mapping: decision.mapping })
  const evidenceParagraphIds = allEvidenceParagraphIds(candidate)
  const reviewedEvidenceIds = [...decision.reviewedEvidenceParagraphIds]
    .sort((left, right) => left.localeCompare(right, "en"))
  if (stableJson(evidenceParagraphIds) !== stableJson(reviewedEvidenceIds)) {
    throw new Error("dna_method_registration_evidence_review_set_mismatch")
  }
  const paragraphById = new Map(workpack.paragraphs.map((paragraph) => [
    paragraph.paragraphId,
    paragraph,
  ]))
  if (paragraphById.size !== workpack.paragraphs.length) {
    throw new Error("dna_method_registration_duplicate_workpack_paragraph")
  }
  const evidenceRefs = evidenceParagraphIds.map((paragraphId) => {
    const paragraph = paragraphById.get(paragraphId)
    if (!paragraph
      || paragraph.artifactSha256 !== candidate.sourceBinding.artifactSha256
      || !SHA256_PATTERN.test(paragraph.contentSha256)) {
      throw new Error("dna_method_registration_evidence_locator_unresolved")
    }
    return deepFreeze({
      artifactSha256: paragraph.artifactSha256,
      contentSha256: paragraph.contentSha256,
      locator: paragraph.paragraphId,
    })
  })
  const reviewPasses = deepFreeze([
    {
      passId: input.passA.passId,
      protocolVersion: DNA_METHOD_APPRAISAL_PROTOCOL_VERSION,
      reviewerRole: "method_appraisal_a" as const,
      completedAt: input.passA.reviewedAt,
      evidenceSha256: input.passA.canonicalPayloadSha256,
    },
    {
      passId: input.passB.passId,
      protocolVersion: DNA_METHOD_APPRAISAL_PROTOCOL_VERSION,
      reviewerRole: "method_appraisal_b" as const,
      completedAt: input.passB.reviewedAt,
      evidenceSha256: input.passB.canonicalPayloadSha256,
    },
    {
      passId: input.reconciliation.passId,
      protocolVersion: DNA_METHOD_APPRAISAL_PROTOCOL_VERSION,
      reviewerRole: "method_appraisal_reconciliation" as const,
      completedAt: input.reconciliation.reviewedAt,
      evidenceSha256: input.reconciliation.canonicalPayloadSha256,
    },
  ])
  const payload: Omit<DnaMethodAppraisal, "appraisalPayloadSha256"> = {
    schemaVersion: DNA_METHOD_APPRAISAL_VERSION,
    id: decision.appraisalId,
    sourceId: candidate.sourceId,
    ...decision.mapping,
    gradeScope: "adapted_dimensions_not_certainty_rating",
    bodyOfEvidenceCertainty: "not_assessed",
    evidenceRefs,
    reviewPasses,
    reviewStatus: "codex_multi_pass_audited",
    disposition: "eligible_for_body_synthesis_with_limits",
    limitations: deepFreeze([
      ...candidate.limitations,
      `registration_decision:${decision.decisionId}`,
      "registration_mapping_is_codex_multi_pass_not_independent_human_review",
    ]),
    sourceEvidencePayloadSha256: candidate.sourceBinding.workpackPayloadSha256,
  }
  const appraisal = deepFreeze({
    ...payload,
    appraisalPayloadSha256: hashDnaAppraisalPayload(payload),
  })
  const explicitRegistry: DnaMethodAppraisalTrustRegistry = deepFreeze({
    registryKind: "explicit_test_only",
    evidenceRefs: evidenceRefs.map((ref) => deepFreeze({
      ...ref,
      sourceId: candidate.sourceId,
      sourceEvidencePayloadSha256: candidate.sourceBinding.workpackPayloadSha256,
    })),
    passEvidence: reviewPasses.map((pass) => deepFreeze({
      appraisalId: appraisal.id,
      passId: pass.passId,
      reviewerRole: pass.reviewerRole,
      evidenceSha256: pass.evidenceSha256,
    })),
    appraisals: [deepFreeze({
      appraisalId: appraisal.id,
      sourceId: appraisal.sourceId,
      sourceEvidencePayloadSha256: appraisal.sourceEvidencePayloadSha256,
      appraisalPayloadSha256: appraisal.appraisalPayloadSha256,
    })],
  })
  const validation = validateDnaMethodAppraisalWithExplicitTestRegistry(
    appraisal,
    explicitRegistry,
  )
  if (!validation.ok || !isDnaMethodAppraisalEligibleWithExplicitTestRegistry(
    appraisal,
    explicitRegistry,
  )) throw new Error(`dna_method_registration_appraisal_invalid:${validation.errors.join(";")}`)
  const trustRegistry: DnaMethodAppraisalTrustRegistry = deepFreeze({
    ...explicitRegistry,
    registryKind: "production_compiled",
  })
  const resultPayload = deepFreeze({
    schemaVersion: DNA_METHOD_APPRAISAL_REGISTRATION_RESULT_VERSION,
    sourceId: candidate.sourceId,
    candidateSha256: candidate.canonicalPayloadSha256,
    decisionSha256: decision.decisionSha256,
    appraisal,
    trustRegistry,
    evidenceParagraphCount: evidenceRefs.length,
  })
  return deepFreeze({
    ...resultPayload,
    resultSha256: hashDnaMethodAppraisalRegistrationPayload(resultPayload),
  })
}

export function mergeDnaMethodAppraisalTrustRegistries(
  results: readonly DnaMethodAppraisalRegistrationResult[],
): DnaMethodAppraisalTrustRegistry {
  const appraisalIds = results.map((result) => result.appraisal.id)
  const sourceIds = results.map((result) => result.sourceId)
  if (new Set(appraisalIds).size !== appraisalIds.length
    || new Set(sourceIds).size !== sourceIds.length) {
    throw new Error("dna_method_registration_duplicate_appraisal_or_source")
  }
  return deepFreeze({
    registryKind: "production_compiled",
    evidenceRefs: results.flatMap((result) => result.trustRegistry.evidenceRefs)
      .sort((left, right) => stableJson(left).localeCompare(stableJson(right), "en")),
    passEvidence: results.flatMap((result) => result.trustRegistry.passEvidence)
      .sort((left, right) => stableJson(left).localeCompare(stableJson(right), "en")),
    appraisals: results.flatMap((result) => result.trustRegistry.appraisals)
      .sort((left, right) => stableJson(left).localeCompare(stableJson(right), "en")),
  })
}

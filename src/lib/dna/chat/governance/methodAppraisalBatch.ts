import { createHash } from "node:crypto"

export const DNA_METHOD_APPRAISAL_BATCH_CONTRACT_VERSION =
  "dna-method-appraisal-batch-contract@1" as const
export const DNA_METHOD_APPRAISAL_REVIEW_PASS_VERSION =
  "dna-method-appraisal-review-pass@2" as const
export const DNA_METHOD_APPRAISAL_RECONCILIATION_VERSION =
  "dna-method-appraisal-reconciliation@2" as const
export const DNA_METHOD_APPRAISAL_FIDELITY_PASS_VERSION =
  "dna-method-appraisal-fidelity-pass@1" as const
export const DNA_METHOD_APPRAISAL_CANDIDATE_VERSION =
  "dna-method-appraisal-candidate@1" as const
export const DNA_METHOD_APPRAISAL_DESIGN_PROFILE_VERSION =
  "dna-method-appraisal-design-profiles@1" as const
export const DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE =
  "output_blinded_codex_multi_pass_not_independent" as const

export const DNA_METHOD_OBSERVATION_STATES = [
  "reported",
  "partially_reported",
  "reported_with_boundary",
  "reported_with_concerns",
  "not_reported",
  "not_applicable",
  "not_assessed",
] as const

export type DnaMethodObservationState = (typeof DNA_METHOD_OBSERVATION_STATES)[number]

export const DNA_METHOD_COUNT_REPORTING_STATES = [
  "reported_total",
  "reported_multiple_not_deduplicated",
  "not_reported",
  "not_applicable",
  "not_assessed",
] as const

export type DnaMethodCountReportingState =
  (typeof DNA_METHOD_COUNT_REPORTING_STATES)[number]

export const DNA_BATCH_METHOD_FIELD_NAMES = [
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
] as const

export type DnaBatchMethodFieldName = (typeof DNA_BATCH_METHOD_FIELD_NAMES)[number]

export const DNA_BATCH_ADAPTED_GRADE_DIMENSIONS = [
  "riskOfBias",
  "inconsistency",
  "indirectness",
  "imprecision",
  "publicationBias",
] as const

export type DnaBatchAdaptedGradeDimension =
  (typeof DNA_BATCH_ADAPTED_GRADE_DIMENSIONS)[number]

export type DnaMethodObservation = Readonly<{
  reportingState: DnaMethodObservationState
  finding: string | null
  evidenceParagraphIds: readonly string[]
  boundary: string | null
}>

export type DnaMethodCountObservation = Readonly<{
  reporting: DnaMethodCountReportingState
  total: number | null
  evidenceParagraphIds: readonly string[]
  boundary: string | null
}>

export type DnaHonestSampleSize = Readonly<{
  studyCount: DnaMethodCountObservation
  participantCount: DnaMethodCountObservation
  datasetCount: DnaMethodCountObservation
}>

export type DnaMethodReviewSourceBinding = Readonly<{
  workpackRelativePath: string
  workpackFileSha256: string
  workpackPayloadSha256: string
  artifactId: string
  artifactSha256: string
  parsedContentSha256: string
}>

export type DnaMethodReviewContractBinding = Readonly<{
  contractFileSha256: string
  designProfileRegistrySha256: string
  designProfileId: string
}>

export type DnaMethodReviewPass = Readonly<{
  schemaVersion: typeof DNA_METHOD_APPRAISAL_REVIEW_PASS_VERSION
  contractVersion: typeof DNA_METHOD_APPRAISAL_BATCH_CONTRACT_VERSION
  reviewArchitecture: typeof DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE
  passRole: "method_appraisal_a" | "method_appraisal_b"
  passId: string
  reviewedAt: string
  sourceId: string
  status: "candidate_only"
  runtimeEligible: false
  releaseEligible: false
  sourceBinding: DnaMethodReviewSourceBinding
  contractBinding: DnaMethodReviewContractBinding
  studyDesign: DnaMethodObservation
  population: DnaMethodObservation
  ageScope: DnaMethodObservation
  sampleSize: DnaHonestSampleSize
  methodFields: Readonly<Record<DnaBatchMethodFieldName, DnaMethodObservation>>
  adaptedGradeDimensions: Readonly<Record<DnaBatchAdaptedGradeDimension, DnaMethodObservation>>
  limitations: readonly string[]
  canonicalPayloadSha256: string
}>

export type DnaMethodAppraisalReconciliation = Readonly<{
  schemaVersion: typeof DNA_METHOD_APPRAISAL_RECONCILIATION_VERSION
  contractVersion: typeof DNA_METHOD_APPRAISAL_BATCH_CONTRACT_VERSION
  reviewArchitecture: typeof DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE
  passRole: "method_appraisal_reconciliation"
  passId: string
  reviewedAt: string
  sourceId: string
  status: "candidate_only"
  runtimeEligible: false
  releaseEligible: false
  sourceBinding: DnaMethodReviewSourceBinding
  contractBinding: DnaMethodReviewContractBinding
  inputBindings: Readonly<{
    passASha256: string
    passBSha256: string
  }>
  studyDesign: DnaMethodObservation
  population: DnaMethodObservation
  ageScope: DnaMethodObservation
  sampleSize: DnaHonestSampleSize
  methodFields: Readonly<Record<DnaBatchMethodFieldName, DnaMethodObservation>>
  adaptedGradeDimensions: Readonly<Record<DnaBatchAdaptedGradeDimension, DnaMethodObservation>>
  unresolvedIssues: readonly string[]
  limitations: readonly string[]
  canonicalPayloadSha256: string
}>

export type DnaMethodAppraisalFidelityPass = Readonly<{
  schemaVersion: typeof DNA_METHOD_APPRAISAL_FIDELITY_PASS_VERSION
  contractVersion: typeof DNA_METHOD_APPRAISAL_BATCH_CONTRACT_VERSION
  reviewArchitecture: typeof DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE
  passRole: "source_fidelity"
  passId: string
  reviewedAt: string
  sourceId: string
  status: "candidate_only"
  runtimeEligible: false
  releaseEligible: false
  sourceBinding: DnaMethodReviewSourceBinding
  inputBindings: Readonly<{
    passASha256: string
    passBSha256: string
    reconciliationSha256: string
  }>
  assessment: Readonly<{
    allFindingsEntailed: boolean
    allLocatorsResolve: boolean
    countsNotConflated: boolean
    unsupportedMechanismAbsent: boolean
    boundariesPreserved: boolean
    issues: readonly string[]
  }>
  disposition: "passed" | "needs_revision" | "contested"
  canonicalPayloadSha256: string
}>

export type DnaMethodAppraisalCandidate = Readonly<{
  schemaVersion: typeof DNA_METHOD_APPRAISAL_CANDIDATE_VERSION
  contractVersion: typeof DNA_METHOD_APPRAISAL_BATCH_CONTRACT_VERSION
  reviewArchitecture: typeof DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE
  sourceId: string
  status: "candidate_compiled_unregistered"
  trustedRegistryStatus: "not_registered"
  runtimeEligible: false
  releaseEligible: false
  designProfileId: string
  sourceBinding: DnaMethodReviewSourceBinding
  inputBindings: Readonly<{
    passASha256: string
    passBSha256: string
    reconciliationSha256: string
    fidelityPassSha256: string
  }>
  studyDesign: DnaMethodObservation
  population: DnaMethodObservation
  ageScope: DnaMethodObservation
  sampleSize: DnaHonestSampleSize
  methodFields: Readonly<Record<DnaBatchMethodFieldName, DnaMethodObservation>>
  adaptedGradeDimensions: Readonly<Record<DnaBatchAdaptedGradeDimension, DnaMethodObservation>>
  limitations: readonly string[]
  canonicalPayloadSha256: string
}>

export type DnaMethodAppraisalBatchValidation = Readonly<{
  ok: boolean
  errors: readonly string[]
}>

export type DnaMethodAppraisalDesignProfileRegistry = Readonly<{
  schemaVersion: typeof DNA_METHOD_APPRAISAL_DESIGN_PROFILE_VERSION
  profiles: readonly Readonly<{
    id: string
    label: string
    applicableDimensions: readonly string[]
    notApplicableByDefault: readonly string[]
    mandatoryQuestions: readonly string[]
    countSemantics: readonly ("studyCount" | "participantCount" | "datasetCount")[]
  }>[]
  declaredDesignAliases: Readonly<Record<string, string>>
  canonicalDesignAliases: Readonly<Record<string, string>>
}>

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const STABLE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{2,199}$/
const PARAGRAPH_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,199}:p\d{6}$/
const ISO_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) =>
    `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`
}

export function hashDnaMethodAppraisalBatchPayload(value: unknown): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex")
}

function withoutCanonicalHash<T extends { readonly canonicalPayloadSha256: string }>(
  value: T,
): Omit<T, "canonicalPayloadSha256"> {
  const { canonicalPayloadSha256: _hash, ...payload } = value
  return payload
}

function validateExactKeys(
  value: unknown,
  expected: readonly string[],
  label: string,
  errors: string[],
): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${label}:invalid_object`)
    return false
  }
  const keys = Object.keys(value as Record<string, unknown>)
  for (const key of keys) if (!expected.includes(key)) errors.push(`${label}:unexpected_field:${key}`)
  for (const key of expected) if (!keys.includes(key)) errors.push(`${label}:missing_field:${key}`)
  return true
}

function isExactIsoInstant(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_INSTANT_PATTERN.test(value)) return false
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return false
  const canonical = new Date(parsed).toISOString()
  return canonical === value || canonical.replace(/\.000Z$/, "Z") === value
}

function isAssertedObservation(state: unknown): boolean {
  return state === "reported"
    || state === "partially_reported"
    || state === "reported_with_boundary"
    || state === "reported_with_concerns"
}

function validateObservation(value: unknown, label: string, errors: string[]): void {
  if (!validateExactKeys(value,
    ["reportingState", "finding", "evidenceParagraphIds", "boundary"], label, errors)) return
  const observation = value as unknown as DnaMethodObservation
  if (!DNA_METHOD_OBSERVATION_STATES.includes(observation.reportingState)) {
    errors.push(`${label}:invalid_reporting_state`)
  }
  const paragraphsValid = Array.isArray(observation.evidenceParagraphIds)
  if (!paragraphsValid
    || observation.evidenceParagraphIds.some((entry) => typeof entry !== "string"
      || !PARAGRAPH_ID_PATTERN.test(entry))
    || new Set(observation.evidenceParagraphIds).size !== observation.evidenceParagraphIds.length) {
    errors.push(`${label}:invalid_evidence_paragraph_ids`)
  }
  if (isAssertedObservation(observation.reportingState)) {
    if (typeof observation.finding !== "string" || !observation.finding.trim()) {
      errors.push(`${label}:asserted_without_finding`)
    }
    if (!paragraphsValid || observation.evidenceParagraphIds.length === 0) {
      errors.push(`${label}:asserted_without_evidence`)
    }
  } else if (observation.finding !== null
    || (paragraphsValid && observation.evidenceParagraphIds.length > 0)) {
    errors.push(`${label}:unknown_state_asserts_finding`)
  }
  if (observation.boundary !== null
    && (typeof observation.boundary !== "string" || !observation.boundary.trim())) {
    errors.push(`${label}:invalid_boundary`)
  }
}

function validateCount(value: unknown, label: string, errors: string[]): void {
  if (!validateExactKeys(value,
    ["reporting", "total", "evidenceParagraphIds", "boundary"], label, errors)) return
  const count = value as unknown as DnaMethodCountObservation
  if (!DNA_METHOD_COUNT_REPORTING_STATES.includes(count.reporting)) {
    errors.push(`${label}:invalid_reporting`)
  }
  const paragraphsValid = Array.isArray(count.evidenceParagraphIds)
  if (!paragraphsValid
    || count.evidenceParagraphIds.some((entry) => typeof entry !== "string"
      || !PARAGRAPH_ID_PATTERN.test(entry))
    || new Set(count.evidenceParagraphIds).size !== count.evidenceParagraphIds.length) {
    errors.push(`${label}:invalid_evidence_paragraph_ids`)
  }
  if (count.reporting === "reported_total") {
    if (!Number.isInteger(count.total) || Number(count.total) <= 0) errors.push(`${label}:invalid_total`)
    if (!paragraphsValid || count.evidenceParagraphIds.length === 0) {
      errors.push(`${label}:reported_without_evidence`)
    }
  } else if (count.total !== null) {
    errors.push(`${label}:non_total_state_cannot_assert_total`)
  }
  if (count.reporting === "reported_multiple_not_deduplicated") {
    if (!paragraphsValid || count.evidenceParagraphIds.length === 0) {
      errors.push(`${label}:multiple_without_evidence`)
    }
    if (typeof count.boundary !== "string" || !count.boundary.trim()) {
      errors.push(`${label}:multiple_requires_boundary`)
    }
  } else if (count.boundary !== null
    && (typeof count.boundary !== "string" || !count.boundary.trim())) {
    errors.push(`${label}:invalid_boundary`)
  }
}

function validateSampleSize(value: unknown, label: string, errors: string[]): void {
  if (!validateExactKeys(value,
    ["studyCount", "participantCount", "datasetCount"], label, errors)) return
  validateCount(value.studyCount, `${label}:study_count`, errors)
  validateCount(value.participantCount, `${label}:participant_count`, errors)
  validateCount(value.datasetCount, `${label}:dataset_count`, errors)
}

function validateObservationRecord(
  value: unknown,
  expectedFields: readonly string[],
  label: string,
  errors: string[],
): void {
  if (!validateExactKeys(value, expectedFields, label, errors)) return
  for (const field of expectedFields) validateObservation(value[field], `${label}:${field}`, errors)
}

function validateSourceBinding(value: unknown, label: string, errors: string[]): void {
  if (!validateExactKeys(value, [
    "workpackRelativePath", "workpackFileSha256", "workpackPayloadSha256",
    "artifactId", "artifactSha256", "parsedContentSha256",
  ], label, errors)) return
  const binding = value as unknown as DnaMethodReviewSourceBinding
  if (typeof binding.workpackRelativePath !== "string"
    || !binding.workpackRelativePath.startsWith("method-review-workpacks/")
    || binding.workpackRelativePath.includes("..")
    || binding.workpackRelativePath.startsWith("/")) {
    errors.push(`${label}:invalid_workpack_relative_path`)
  }
  if (!STABLE_ID_PATTERN.test(binding.artifactId)) errors.push(`${label}:invalid_artifact_id`)
  for (const [name, hash] of [
    ["workpack_file", binding.workpackFileSha256],
    ["workpack_payload", binding.workpackPayloadSha256],
    ["artifact", binding.artifactSha256],
    ["parsed_content", binding.parsedContentSha256],
  ] as const) if (!SHA256_PATTERN.test(hash)) errors.push(`${label}:invalid_${name}_hash`)
}

function validateContractBinding(value: unknown, label: string, errors: string[]): void {
  if (!validateExactKeys(value,
    ["contractFileSha256", "designProfileRegistrySha256", "designProfileId"], label, errors)) return
  const binding = value as unknown as DnaMethodReviewContractBinding
  if (!SHA256_PATTERN.test(binding.contractFileSha256)) errors.push(`${label}:invalid_contract_hash`)
  if (!SHA256_PATTERN.test(binding.designProfileRegistrySha256)) {
    errors.push(`${label}:invalid_profile_registry_hash`)
  }
  if (!STABLE_ID_PATTERN.test(binding.designProfileId)) errors.push(`${label}:invalid_profile_id`)
}

function validateCommonReviewPayload(
  value: Record<string, unknown>,
  label: string,
  errors: string[],
): void {
  if (value.contractVersion !== DNA_METHOD_APPRAISAL_BATCH_CONTRACT_VERSION) {
    errors.push(`${label}:invalid_contract_version`)
  }
  if (value.reviewArchitecture !== DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE) {
    errors.push(`${label}:invalid_review_architecture`)
  }
  if (!STABLE_ID_PATTERN.test(String(value.passId ?? ""))) errors.push(`${label}:invalid_pass_id`)
  if (!isExactIsoInstant(value.reviewedAt)) errors.push(`${label}:invalid_reviewed_at`)
  if (!STABLE_ID_PATTERN.test(String(value.sourceId ?? ""))) errors.push(`${label}:invalid_source_id`)
  if (value.status !== "candidate_only") errors.push(`${label}:invalid_status`)
  if (value.runtimeEligible !== false) errors.push(`${label}:runtime_must_be_false`)
  if (value.releaseEligible !== false) errors.push(`${label}:release_must_be_false`)
  validateSourceBinding(value.sourceBinding, `${label}:source_binding`, errors)
  validateObservation(value.studyDesign, `${label}:study_design`, errors)
  validateObservation(value.population, `${label}:population`, errors)
  validateObservation(value.ageScope, `${label}:age_scope`, errors)
  validateSampleSize(value.sampleSize, `${label}:sample_size`, errors)
  validateObservationRecord(value.methodFields, DNA_BATCH_METHOD_FIELD_NAMES,
    `${label}:method_fields`, errors)
  validateObservationRecord(value.adaptedGradeDimensions, DNA_BATCH_ADAPTED_GRADE_DIMENSIONS,
    `${label}:adapted_grade`, errors)
  const grade = value.adaptedGradeDimensions as Record<string, DnaMethodObservation> | undefined
  if (grade?.inconsistency?.reportingState !== "not_assessed") {
    errors.push(`${label}:single_source_cannot_assess_inconsistency`)
  }
  if (grade?.publicationBias?.reportingState !== "not_assessed") {
    errors.push(`${label}:single_source_cannot_assess_publication_bias`)
  }
  if (!Array.isArray(value.limitations)
    || value.limitations.some((entry) => typeof entry !== "string" || !entry.trim())) {
    errors.push(`${label}:invalid_limitations`)
  }
}

const REVIEW_PASS_KEYS = [
  "schemaVersion", "contractVersion", "reviewArchitecture", "passRole", "passId",
  "reviewedAt", "sourceId", "status", "runtimeEligible", "releaseEligible",
  "sourceBinding", "contractBinding", "studyDesign", "population", "ageScope",
  "sampleSize", "methodFields", "adaptedGradeDimensions", "limitations",
  "canonicalPayloadSha256",
] as const

export function validateDnaMethodReviewPass(value: unknown): DnaMethodAppraisalBatchValidation {
  const errors: string[] = []
  if (!validateExactKeys(value, REVIEW_PASS_KEYS, "review_pass", errors)) {
    return Object.freeze({ ok: false, errors: Object.freeze(errors.sort()) })
  }
  if (value.schemaVersion !== DNA_METHOD_APPRAISAL_REVIEW_PASS_VERSION) {
    errors.push("review_pass:invalid_schema_version")
  }
  if (value.passRole !== "method_appraisal_a" && value.passRole !== "method_appraisal_b") {
    errors.push("review_pass:invalid_pass_role")
  }
  validateCommonReviewPayload(value, "review_pass", errors)
  validateContractBinding(value.contractBinding, "review_pass:contract_binding", errors)
  const pass = value as unknown as DnaMethodReviewPass
  if (!SHA256_PATTERN.test(pass.canonicalPayloadSha256)
    || pass.canonicalPayloadSha256 !== hashDnaMethodAppraisalBatchPayload(withoutCanonicalHash(pass))) {
    errors.push("review_pass:payload_hash_mismatch")
  }
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors.sort()) })
}

const RECONCILIATION_KEYS = [
  "schemaVersion", "contractVersion", "reviewArchitecture", "passRole", "passId",
  "reviewedAt", "sourceId", "status", "runtimeEligible", "releaseEligible",
  "sourceBinding", "contractBinding", "inputBindings", "studyDesign", "population",
  "ageScope", "sampleSize", "methodFields", "adaptedGradeDimensions",
  "unresolvedIssues", "limitations", "canonicalPayloadSha256",
] as const

export function validateDnaMethodAppraisalReconciliation(
  value: unknown,
): DnaMethodAppraisalBatchValidation {
  const errors: string[] = []
  if (!validateExactKeys(value, RECONCILIATION_KEYS, "reconciliation", errors)) {
    return Object.freeze({ ok: false, errors: Object.freeze(errors.sort()) })
  }
  if (value.schemaVersion !== DNA_METHOD_APPRAISAL_RECONCILIATION_VERSION) {
    errors.push("reconciliation:invalid_schema_version")
  }
  if (value.passRole !== "method_appraisal_reconciliation") {
    errors.push("reconciliation:invalid_pass_role")
  }
  validateCommonReviewPayload(value, "reconciliation", errors)
  validateContractBinding(value.contractBinding, "reconciliation:contract_binding", errors)
  if (validateExactKeys(value.inputBindings,
    ["passASha256", "passBSha256"], "reconciliation:input_bindings", errors)) {
    if (!SHA256_PATTERN.test(String(value.inputBindings.passASha256 ?? ""))) {
      errors.push("reconciliation:invalid_pass_a_hash")
    }
    if (!SHA256_PATTERN.test(String(value.inputBindings.passBSha256 ?? ""))) {
      errors.push("reconciliation:invalid_pass_b_hash")
    }
  }
  if (!Array.isArray(value.unresolvedIssues)
    || value.unresolvedIssues.some((entry) => typeof entry !== "string" || !entry.trim())) {
    errors.push("reconciliation:invalid_unresolved_issues")
  }
  const reconciliation = value as unknown as DnaMethodAppraisalReconciliation
  if (!SHA256_PATTERN.test(reconciliation.canonicalPayloadSha256)
    || reconciliation.canonicalPayloadSha256
      !== hashDnaMethodAppraisalBatchPayload(withoutCanonicalHash(reconciliation))) {
    errors.push("reconciliation:payload_hash_mismatch")
  }
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors.sort()) })
}

const FIDELITY_PASS_KEYS = [
  "schemaVersion", "contractVersion", "reviewArchitecture", "passRole", "passId",
  "reviewedAt", "sourceId", "status", "runtimeEligible", "releaseEligible",
  "sourceBinding", "inputBindings", "assessment", "disposition", "canonicalPayloadSha256",
] as const

export function validateDnaMethodAppraisalFidelityPass(
  value: unknown,
): DnaMethodAppraisalBatchValidation {
  const errors: string[] = []
  if (!validateExactKeys(value, FIDELITY_PASS_KEYS, "fidelity_pass", errors)) {
    return Object.freeze({ ok: false, errors: Object.freeze(errors.sort()) })
  }
  if (value.schemaVersion !== DNA_METHOD_APPRAISAL_FIDELITY_PASS_VERSION) {
    errors.push("fidelity_pass:invalid_schema_version")
  }
  if (value.contractVersion !== DNA_METHOD_APPRAISAL_BATCH_CONTRACT_VERSION) {
    errors.push("fidelity_pass:invalid_contract_version")
  }
  if (value.reviewArchitecture !== DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE) {
    errors.push("fidelity_pass:invalid_review_architecture")
  }
  if (value.passRole !== "source_fidelity") errors.push("fidelity_pass:invalid_pass_role")
  if (!STABLE_ID_PATTERN.test(String(value.passId ?? ""))) errors.push("fidelity_pass:invalid_pass_id")
  if (!isExactIsoInstant(value.reviewedAt)) errors.push("fidelity_pass:invalid_reviewed_at")
  if (!STABLE_ID_PATTERN.test(String(value.sourceId ?? ""))) errors.push("fidelity_pass:invalid_source_id")
  if (value.status !== "candidate_only") errors.push("fidelity_pass:invalid_status")
  if (value.runtimeEligible !== false) errors.push("fidelity_pass:runtime_must_be_false")
  if (value.releaseEligible !== false) errors.push("fidelity_pass:release_must_be_false")
  validateSourceBinding(value.sourceBinding, "fidelity_pass:source_binding", errors)
  if (validateExactKeys(value.inputBindings,
    ["passASha256", "passBSha256", "reconciliationSha256"],
    "fidelity_pass:input_bindings", errors)) {
    for (const [key, hash] of Object.entries(value.inputBindings)) {
      if (!SHA256_PATTERN.test(String(hash))) errors.push(`fidelity_pass:invalid_${key}`)
    }
  }
  if (validateExactKeys(value.assessment, [
    "allFindingsEntailed", "allLocatorsResolve", "countsNotConflated",
    "unsupportedMechanismAbsent", "boundariesPreserved", "issues",
  ], "fidelity_pass:assessment", errors)) {
    for (const key of [
      "allFindingsEntailed", "allLocatorsResolve", "countsNotConflated",
      "unsupportedMechanismAbsent", "boundariesPreserved",
    ]) if (typeof value.assessment[key] !== "boolean") {
      errors.push(`fidelity_pass:invalid_${key}`)
    }
    if (!Array.isArray(value.assessment.issues)
      || value.assessment.issues.some((entry) => typeof entry !== "string" || !entry.trim())) {
      errors.push("fidelity_pass:invalid_issues")
    }
  }
  if (!(["passed", "needs_revision", "contested"] as const).includes(value.disposition as never)) {
    errors.push("fidelity_pass:invalid_disposition")
  }
  const fidelity = value as unknown as DnaMethodAppraisalFidelityPass
  if (!SHA256_PATTERN.test(fidelity.canonicalPayloadSha256)
    || fidelity.canonicalPayloadSha256
      !== hashDnaMethodAppraisalBatchPayload(withoutCanonicalHash(fidelity))) {
    errors.push("fidelity_pass:payload_hash_mismatch")
  }
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors.sort()) })
}

function sameBinding(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right)
}

export function compileDnaMethodAppraisalCandidate(input: Readonly<{
  passA: DnaMethodReviewPass
  passB: DnaMethodReviewPass
  reconciliation: DnaMethodAppraisalReconciliation
  fidelityPass: DnaMethodAppraisalFidelityPass
}>): DnaMethodAppraisalCandidate {
  if (!input || typeof input !== "object") throw new Error("compiler:invalid_input")
  if (!input.passA) throw new Error("compiler:missing_pass_a")
  if (!input.passB) throw new Error("compiler:missing_pass_b")
  if (!input.reconciliation) throw new Error("compiler:missing_reconciliation")
  if (!input.fidelityPass) throw new Error("compiler:missing_fidelity_pass")
  const errors: string[] = []
  for (const [name, validation] of [
    ["pass_a", validateDnaMethodReviewPass(input.passA)],
    ["pass_b", validateDnaMethodReviewPass(input.passB)],
    ["reconciliation", validateDnaMethodAppraisalReconciliation(input.reconciliation)],
    ["fidelity", validateDnaMethodAppraisalFidelityPass(input.fidelityPass)],
  ] as const) for (const error of validation.errors) errors.push(`${name}:${error}`)
  if (input.passA.passRole !== "method_appraisal_a") errors.push("compiler:pass_a_role_mismatch")
  if (input.passB.passRole !== "method_appraisal_b") errors.push("compiler:pass_b_role_mismatch")
  if (input.passA.passId === input.passB.passId) errors.push("compiler:duplicate_pass_id")
  const sourceIds = new Set([
    input.passA.sourceId, input.passB.sourceId, input.reconciliation.sourceId,
    input.fidelityPass.sourceId,
  ])
  if (sourceIds.size !== 1) errors.push("compiler:source_binding_mismatch")
  if (!sameBinding(input.passA.sourceBinding, input.passB.sourceBinding)
    || !sameBinding(input.passA.sourceBinding, input.reconciliation.sourceBinding)
    || !sameBinding(input.passA.sourceBinding, input.fidelityPass.sourceBinding)) {
    errors.push("compiler:workpack_binding_mismatch")
  }
  if (!sameBinding(input.passA.contractBinding, input.passB.contractBinding)
    || !sameBinding(input.passA.contractBinding, input.reconciliation.contractBinding)) {
    errors.push("compiler:contract_binding_mismatch")
  }
  if (input.reconciliation.inputBindings.passASha256 !== input.passA.canonicalPayloadSha256) {
    errors.push("compiler:reconciliation_pass_a_hash_mismatch")
  }
  if (input.reconciliation.inputBindings.passBSha256 !== input.passB.canonicalPayloadSha256) {
    errors.push("compiler:reconciliation_pass_b_hash_mismatch")
  }
  if (input.fidelityPass.inputBindings.passASha256 !== input.passA.canonicalPayloadSha256
    || input.fidelityPass.inputBindings.passBSha256 !== input.passB.canonicalPayloadSha256
    || input.fidelityPass.inputBindings.reconciliationSha256
      !== input.reconciliation.canonicalPayloadSha256) {
    errors.push("compiler:fidelity_input_hash_mismatch")
  }
  if (input.reconciliation.unresolvedIssues.length > 0) {
    errors.push("compiler:unresolved_reconciliation_issues")
  }
  const fidelityChecks = input.fidelityPass.assessment
  if (input.fidelityPass.disposition !== "passed"
    || fidelityChecks.issues.length > 0
    || !fidelityChecks.allFindingsEntailed
    || !fidelityChecks.allLocatorsResolve
    || !fidelityChecks.countsNotConflated
    || !fidelityChecks.unsupportedMechanismAbsent
    || !fidelityChecks.boundariesPreserved) {
    errors.push("compiler:fidelity_pass_not_clean")
  }
  const passATime = Date.parse(input.passA.reviewedAt)
  const passBTime = Date.parse(input.passB.reviewedAt)
  const reconciliationTime = Date.parse(input.reconciliation.reviewedAt)
  const fidelityTime = Date.parse(input.fidelityPass.reviewedAt)
  if (!(passATime < reconciliationTime && passBTime < reconciliationTime
    && reconciliationTime < fidelityTime)) errors.push("compiler:invalid_review_chronology")
  if (errors.length > 0) throw new Error([...new Set(errors)].sort().join(";"))

  const payload: Omit<DnaMethodAppraisalCandidate, "canonicalPayloadSha256"> = {
    schemaVersion: DNA_METHOD_APPRAISAL_CANDIDATE_VERSION,
    contractVersion: DNA_METHOD_APPRAISAL_BATCH_CONTRACT_VERSION,
    reviewArchitecture: DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE,
    sourceId: input.reconciliation.sourceId,
    status: "candidate_compiled_unregistered",
    trustedRegistryStatus: "not_registered",
    runtimeEligible: false,
    releaseEligible: false,
    designProfileId: input.reconciliation.contractBinding.designProfileId,
    sourceBinding: input.reconciliation.sourceBinding,
    inputBindings: Object.freeze({
      passASha256: input.passA.canonicalPayloadSha256,
      passBSha256: input.passB.canonicalPayloadSha256,
      reconciliationSha256: input.reconciliation.canonicalPayloadSha256,
      fidelityPassSha256: input.fidelityPass.canonicalPayloadSha256,
    }),
    studyDesign: input.reconciliation.studyDesign,
    population: input.reconciliation.population,
    ageScope: input.reconciliation.ageScope,
    sampleSize: input.reconciliation.sampleSize,
    methodFields: input.reconciliation.methodFields,
    adaptedGradeDimensions: input.reconciliation.adaptedGradeDimensions,
    limitations: Object.freeze([
      ...input.reconciliation.limitations,
      "single_source_is_not_body_of_evidence_certainty",
      "codex_multi_pass_is_not_independent_human_review",
      "candidate_is_not_registered_for_runtime_or_release",
    ]),
  }
  const candidate = Object.freeze({
    ...payload,
    canonicalPayloadSha256: hashDnaMethodAppraisalBatchPayload(payload),
  })
  const validation = validateDnaMethodAppraisalCandidate(candidate)
  if (!validation.ok) throw new Error(validation.errors.join(";"))
  return candidate
}

const CANDIDATE_KEYS = [
  "schemaVersion", "contractVersion", "reviewArchitecture", "sourceId", "status",
  "trustedRegistryStatus", "runtimeEligible", "releaseEligible", "designProfileId",
  "sourceBinding", "inputBindings", "studyDesign", "population", "ageScope",
  "sampleSize", "methodFields", "adaptedGradeDimensions", "limitations",
  "canonicalPayloadSha256",
] as const

export function validateDnaMethodAppraisalCandidate(
  value: unknown,
): DnaMethodAppraisalBatchValidation {
  const errors: string[] = []
  if (!validateExactKeys(value, CANDIDATE_KEYS, "candidate", errors)) {
    return Object.freeze({ ok: false, errors: Object.freeze(errors.sort()) })
  }
  if (value.schemaVersion !== DNA_METHOD_APPRAISAL_CANDIDATE_VERSION) {
    errors.push("candidate:invalid_schema_version")
  }
  if (value.contractVersion !== DNA_METHOD_APPRAISAL_BATCH_CONTRACT_VERSION) {
    errors.push("candidate:invalid_contract_version")
  }
  if (value.reviewArchitecture !== DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE) {
    errors.push("candidate:invalid_review_architecture")
  }
  if (!STABLE_ID_PATTERN.test(String(value.sourceId ?? ""))) errors.push("candidate:invalid_source_id")
  if (value.status !== "candidate_compiled_unregistered") errors.push("candidate:invalid_status")
  if (value.trustedRegistryStatus !== "not_registered") {
    errors.push("candidate:invalid_trusted_registry_status")
  }
  if (value.runtimeEligible !== false) errors.push("candidate:runtime_must_be_false")
  if (value.releaseEligible !== false) errors.push("candidate:release_must_be_false")
  if (!STABLE_ID_PATTERN.test(String(value.designProfileId ?? ""))) {
    errors.push("candidate:invalid_design_profile_id")
  }
  validateSourceBinding(value.sourceBinding, "candidate:source_binding", errors)
  if (validateExactKeys(value.inputBindings, [
    "passASha256", "passBSha256", "reconciliationSha256", "fidelityPassSha256",
  ], "candidate:input_bindings", errors)) {
    for (const [key, hash] of Object.entries(value.inputBindings)) {
      if (!SHA256_PATTERN.test(String(hash))) errors.push(`candidate:invalid_${key}`)
    }
  }
  validateObservation(value.studyDesign, "candidate:study_design", errors)
  validateObservation(value.population, "candidate:population", errors)
  validateObservation(value.ageScope, "candidate:age_scope", errors)
  validateSampleSize(value.sampleSize, "candidate:sample_size", errors)
  validateObservationRecord(value.methodFields, DNA_BATCH_METHOD_FIELD_NAMES,
    "candidate:method_fields", errors)
  validateObservationRecord(value.adaptedGradeDimensions, DNA_BATCH_ADAPTED_GRADE_DIMENSIONS,
    "candidate:adapted_grade", errors)
  const grade = value.adaptedGradeDimensions as Record<string, DnaMethodObservation> | undefined
  if (grade?.inconsistency?.reportingState !== "not_assessed") {
    errors.push("candidate:single_source_cannot_assess_inconsistency")
  }
  if (grade?.publicationBias?.reportingState !== "not_assessed") {
    errors.push("candidate:single_source_cannot_assess_publication_bias")
  }
  const requiredLimitations = [
    "single_source_is_not_body_of_evidence_certainty",
    "codex_multi_pass_is_not_independent_human_review",
    "candidate_is_not_registered_for_runtime_or_release",
  ]
  if (!Array.isArray(value.limitations)
    || value.limitations.some((entry) => typeof entry !== "string" || !entry.trim())) {
    errors.push("candidate:invalid_limitations")
  } else {
    for (const limitation of requiredLimitations) {
      if (!value.limitations.includes(limitation)) errors.push(`candidate:missing_limitation:${limitation}`)
    }
  }
  const candidate = value as unknown as DnaMethodAppraisalCandidate
  if (!SHA256_PATTERN.test(candidate.canonicalPayloadSha256)
    || candidate.canonicalPayloadSha256
      !== hashDnaMethodAppraisalBatchPayload(withoutCanonicalHash(candidate))) {
    errors.push("candidate:payload_hash_mismatch")
  }
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors.sort()) })
}

export function validateDnaMethodAppraisalDesignProfileRegistry(
  value: unknown,
): DnaMethodAppraisalBatchValidation {
  const errors: string[] = []
  if (!validateExactKeys(value,
    ["schemaVersion", "profiles", "declaredDesignAliases", "canonicalDesignAliases"],
    "design_profiles", errors)) {
    return Object.freeze({ ok: false, errors: Object.freeze(errors.sort()) })
  }
  if (value.schemaVersion !== DNA_METHOD_APPRAISAL_DESIGN_PROFILE_VERSION) {
    errors.push("design_profiles:invalid_schema_version")
  }
  if (!Array.isArray(value.profiles) || value.profiles.length === 0) {
    errors.push("design_profiles:profiles_empty")
  } else {
    const ids = new Set<string>()
    for (const [index, profile] of value.profiles.entries()) {
      const label = `design_profiles:profile_${index}`
      if (!validateExactKeys(profile, [
        "id", "label", "applicableDimensions", "notApplicableByDefault",
        "mandatoryQuestions", "countSemantics",
      ], label, errors)) continue
      if (!STABLE_ID_PATTERN.test(String(profile.id ?? ""))) errors.push(`${label}:invalid_id`)
      if (ids.has(String(profile.id))) errors.push(`${label}:duplicate_id`)
      ids.add(String(profile.id))
      for (const key of [
        "applicableDimensions", "notApplicableByDefault", "mandatoryQuestions", "countSemantics",
      ]) if (!Array.isArray(profile[key]) || profile[key].length === 0) {
        errors.push(`${label}:${key}_empty`)
      }
      const validCountSemantics = new Set(["studyCount", "participantCount", "datasetCount"])
      if (!Array.isArray(profile.countSemantics)
        || profile.countSemantics.some((entry) => !validCountSemantics.has(String(entry)))) {
        errors.push(`${label}:invalid_count_semantics`)
      }
    }
    for (const aliasGroup of ["declaredDesignAliases", "canonicalDesignAliases"] as const) {
      const aliases = value[aliasGroup]
      if (!aliases || typeof aliases !== "object" || Array.isArray(aliases)) {
        errors.push(`design_profiles:${aliasGroup}:invalid_object`)
        continue
      }
      for (const [alias, profileId] of Object.entries(aliases)) {
        if (!alias.trim()) errors.push(`design_profiles:${aliasGroup}:empty_alias`)
        if (!ids.has(String(profileId))) errors.push(`design_profiles:${aliasGroup}:unknown_profile:${profileId}`)
      }
    }
  }
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors.sort()) })
}

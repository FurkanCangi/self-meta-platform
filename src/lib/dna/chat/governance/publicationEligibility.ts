import { createHash } from "node:crypto"

export const DNA_CONFLICT_SET_VERSION = "dna-conflict-set@1" as const
export const DNA_RELATIONSHIP_CLASSIFICATION_VERSION =
  "dna-relationship-classification@1" as const
export const DNA_PUBLICATION_SUBJECT_VERSION = "dna-publication-subject@1" as const
export const DNA_PUBLICATION_GATE_ATTESTATION_VERSION =
  "dna-publication-gate-attestation@1" as const
export const DNA_PUBLICATION_ELIGIBILITY_VERSION =
  "dna-publication-eligibility@1" as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const STABLE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{2,159}$/
const LANGUAGE_PATTERN = /^[a-z]{2,3}(?:-[A-Z]{2})?$/

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const object = value as Record<string, unknown>
  return `{${Object.keys(object).sort().map((key) =>
    `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex")
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  }
  return value
}

function requireExactKeys(value: object, expected: readonly string[], code: string): void {
  const actual = Object.keys(value).sort()
  const canonical = [...expected].sort()
  if (actual.length !== canonical.length
    || actual.some((key, index) => key !== canonical[index])) {
    throw new Error(code)
  }
}

function requireStableId(value: string, field: string): string {
  const normalized = String(value || "").trim()
  if (!STABLE_ID_PATTERN.test(normalized)) {
    throw new Error(`dna_publication_invalid_${field}`)
  }
  return normalized
}

function requireSha256(value: string, field: string): string {
  const normalized = String(value || "").trim().toLowerCase()
  if (!SHA256_PATTERN.test(normalized)) {
    throw new Error(`dna_publication_invalid_${field}`)
  }
  return normalized
}

function requireIsoDate(value: string, field: string): string {
  const normalized = String(value || "").trim()
  const parsed = Date.parse(`${normalized}T00:00:00.000Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)
    || !Number.isFinite(parsed)
    || new Date(parsed).toISOString().slice(0, 10) !== normalized) {
    throw new Error(`dna_publication_invalid_${field}`)
  }
  return normalized
}

function requireIsoTimestamp(value: string, field: string): string {
  const normalized = String(value || "").trim()
  const parsed = Date.parse(normalized)
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== normalized) {
    throw new Error(`dna_publication_invalid_${field}`)
  }
  return normalized
}

function requireUniqueStableIds(values: readonly string[], field: string): readonly string[] {
  const normalized = values.map((value) => requireStableId(value, field))
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`dna_publication_duplicate_${field}`)
  }
  return Object.freeze([...normalized].sort())
}

export function dnaPublicationCommitmentSha256(value: unknown): string {
  return sha256(value)
}

// ---------------------------------------------------------------------------
// Phase 25: explicit conflict sets
// ---------------------------------------------------------------------------

export const DNA_CONFLICT_DIRECTIONS = Object.freeze([
  "supports",
  "opposes",
  "mixed",
  "inconclusive",
] as const)
export type DnaConflictDirection = (typeof DNA_CONFLICT_DIRECTIONS)[number]

export const DNA_CONFLICT_EVIDENCE_LEVELS = Object.freeze([
  "high",
  "moderate",
  "low",
  "very_low",
] as const)
export type DnaConflictEvidenceLevel = (typeof DNA_CONFLICT_EVIDENCE_LEVELS)[number]

export type DnaConflictSetMember = Readonly<{
  claimId: string
  claimSha256: string
  sourceId: string
  sourceSha256: string
  direction: DnaConflictDirection
  evidenceLevel: DnaConflictEvidenceLevel
  conditionCodes: readonly string[]
}>

export type DnaConflictSet = Readonly<{
  schemaVersion: typeof DNA_CONFLICT_SET_VERSION
  status: "candidate_only"
  runtimeEligible: false
  conflictSetId: string
  topicId: string
  resolution: "resolved" | "unresolved"
  strongerClaimId: string | null
  members: readonly DnaConflictSetMember[]
  conditionCodes: readonly string[]
  unknownCodes: readonly string[]
  overallEvidenceLevel: DnaConflictEvidenceLevel
  sourceCutoffDate: string
  conflictSetSha256: string
}>

const CONFLICT_MEMBER_KEYS = Object.freeze([
  "claimId",
  "claimSha256",
  "sourceId",
  "sourceSha256",
  "direction",
  "evidenceLevel",
  "conditionCodes",
] as const)

export function createDnaConflictSet(input: Readonly<{
  conflictSetId: string
  topicId: string
  resolution: "resolved" | "unresolved"
  strongerClaimId: string | null
  members: readonly DnaConflictSetMember[]
  conditionCodes: readonly string[]
  unknownCodes: readonly string[]
  overallEvidenceLevel: DnaConflictEvidenceLevel
  sourceCutoffDate: string
}>): DnaConflictSet {
  const conflictSetId = requireStableId(input.conflictSetId, "conflict_set_id")
  const topicId = requireStableId(input.topicId, "conflict_topic_id")
  if (input.resolution !== "resolved" && input.resolution !== "unresolved") {
    throw new Error("dna_publication_invalid_conflict_resolution")
  }
  if (!DNA_CONFLICT_EVIDENCE_LEVELS.includes(input.overallEvidenceLevel)) {
    throw new Error("dna_publication_invalid_conflict_evidence_level")
  }
  if (!Array.isArray(input.members) || input.members.length < 2) {
    throw new Error("dna_publication_conflict_requires_multiple_members")
  }
  const members = input.members.map((member) => {
    requireExactKeys(member, CONFLICT_MEMBER_KEYS, "dna_publication_invalid_conflict_member_shape")
    if (!DNA_CONFLICT_DIRECTIONS.includes(member.direction)) {
      throw new Error("dna_publication_invalid_conflict_direction")
    }
    if (!DNA_CONFLICT_EVIDENCE_LEVELS.includes(member.evidenceLevel)) {
      throw new Error("dna_publication_invalid_conflict_member_evidence_level")
    }
    return deepFreeze({
      claimId: requireStableId(member.claimId, "conflict_claim_id"),
      claimSha256: requireSha256(member.claimSha256, "conflict_claim_sha256"),
      sourceId: requireStableId(member.sourceId, "conflict_source_id"),
      sourceSha256: requireSha256(member.sourceSha256, "conflict_source_sha256"),
      direction: member.direction,
      evidenceLevel: member.evidenceLevel,
      conditionCodes: requireUniqueStableIds(member.conditionCodes, "member_condition_code"),
    })
  }).sort((left, right) => left.claimId.localeCompare(right.claimId))
  if (new Set(members.map((member) => member.claimId)).size !== members.length) {
    throw new Error("dna_publication_duplicate_conflict_claim_id")
  }
  if (new Set(members.map((member) => member.claimSha256)).size !== members.length) {
    throw new Error("dna_publication_duplicate_conflict_claim_content")
  }
  if (new Set(members.map((member) => member.direction)).size < 2) {
    throw new Error("dna_publication_conflict_directions_not_distinct")
  }
  const strongerClaimId = input.strongerClaimId === null
    ? null
    : requireStableId(input.strongerClaimId, "stronger_claim_id")
  if (strongerClaimId !== null
    && !members.some((member) => member.claimId === strongerClaimId)) {
    throw new Error("dna_publication_stronger_claim_not_in_conflict_set")
  }
  if (input.resolution === "resolved" && strongerClaimId === null) {
    throw new Error("dna_publication_resolved_conflict_requires_stronger_claim")
  }
  if (input.resolution === "resolved"
    && members.find((member) => member.claimId === strongerClaimId)?.direction
      === "inconclusive") {
    throw new Error("dna_publication_inconclusive_claim_cannot_be_stronger")
  }
  if (input.resolution === "unresolved" && strongerClaimId !== null) {
    throw new Error("dna_publication_unresolved_conflict_cannot_select_claim")
  }
  const conditionCodes = requireUniqueStableIds(input.conditionCodes, "conflict_condition_code")
  const unknownCodes = requireUniqueStableIds(input.unknownCodes, "conflict_unknown_code")
  if (members.some((member) => member.conditionCodes.some((code) =>
    !conditionCodes.includes(code)))) {
    throw new Error("dna_publication_member_condition_not_declared_by_conflict_set")
  }
  if (input.resolution === "unresolved" && unknownCodes.length === 0) {
    throw new Error("dna_publication_unresolved_conflict_requires_unknown")
  }
  const core = deepFreeze({
    schemaVersion: DNA_CONFLICT_SET_VERSION,
    status: "candidate_only" as const,
    runtimeEligible: false as const,
    conflictSetId,
    topicId,
    resolution: input.resolution,
    strongerClaimId,
    members,
    conditionCodes,
    unknownCodes,
    overallEvidenceLevel: input.overallEvidenceLevel,
    sourceCutoffDate: requireIsoDate(input.sourceCutoffDate, "conflict_source_cutoff_date"),
  })
  return deepFreeze({ ...core, conflictSetSha256: sha256(core) })
}

export function isDnaConflictSetIntegrityValid(value: unknown): value is DnaConflictSet {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false
    const set = value as DnaConflictSet
    requireExactKeys(set, [
      "schemaVersion",
      "status",
      "runtimeEligible",
      "conflictSetId",
      "topicId",
      "resolution",
      "strongerClaimId",
      "members",
      "conditionCodes",
      "unknownCodes",
      "overallEvidenceLevel",
      "sourceCutoffDate",
      "conflictSetSha256",
    ], "dna_publication_invalid_conflict_set_shape")
    if (set.schemaVersion !== DNA_CONFLICT_SET_VERSION
      || set.status !== "candidate_only"
      || set.runtimeEligible !== false) return false
    const recreated = createDnaConflictSet({
      conflictSetId: set.conflictSetId,
      topicId: set.topicId,
      resolution: set.resolution,
      strongerClaimId: set.strongerClaimId,
      members: set.members,
      conditionCodes: set.conditionCodes,
      unknownCodes: set.unknownCodes,
      overallEvidenceLevel: set.overallEvidenceLevel,
      sourceCutoffDate: set.sourceCutoffDate,
    })
    return recreated.conflictSetSha256 === set.conflictSetSha256
  } catch {
    return false
  }
}

/**
 * These hashes are added only by a reviewed source change. They cannot be
 * supplied by an API caller. The registry is deliberately empty until real
 * conflict sets complete the full audit lifecycle.
 */
export const DNA_AUTHORIZED_CONFLICT_SET_SHA256 = Object.freeze([] as string[])

export const DNA_UNRESOLVED_CONFLICT_LIMITATION =
  "Bulgular tutarlı değildir; bu nedenle bireysel vaka için kesin sonuç çıkarılamaz." as const

export type DnaConflictRuntimeResponse = Readonly<{
  status: "available" | "not_available"
  conflictSetId: string | null
  strongerClaimId: string | null
  counterClaimIds: readonly string[]
  evidenceLevel: DnaConflictEvidenceLevel | null
  conditionCodes: readonly string[]
  unknownCodes: readonly string[]
  limitation: typeof DNA_UNRESOLVED_CONFLICT_LIMITATION | null
}>

export function resolveDnaConflictForRuntime(value: unknown): DnaConflictRuntimeResponse {
  if (!isDnaConflictSetIntegrityValid(value)
    || value.resolution !== "resolved"
    || !DNA_AUTHORIZED_CONFLICT_SET_SHA256.includes(value.conflictSetSha256)) {
    return deepFreeze({
      status: "not_available",
      conflictSetId: null,
      strongerClaimId: null,
      counterClaimIds: [],
      evidenceLevel: null,
      conditionCodes: [],
      unknownCodes: [],
      limitation: null,
    })
  }
  const counterClaimIds = value.members
    .filter((member) => member.claimId !== value.strongerClaimId)
    .map((member) => member.claimId)
    .sort()
  return deepFreeze({
    status: "available",
    conflictSetId: value.conflictSetId,
    strongerClaimId: value.strongerClaimId,
    counterClaimIds,
    evidenceLevel: value.overallEvidenceLevel,
    conditionCodes: [...value.conditionCodes],
    unknownCodes: [...value.unknownCodes],
    limitation: null,
  })
}

// ---------------------------------------------------------------------------
// Phase 26: controlled DNA relationship classification
// ---------------------------------------------------------------------------

export const DNA_RELATIONSHIP_CLASSIFICATIONS = Object.freeze([
  "product_definition",
  "supported_relation",
  "conceptual_proximity",
  "theory_only",
  "not_established",
  "contradicted",
  "not_applicable",
] as const)
export type DnaRelationshipClassification =
  (typeof DNA_RELATIONSHIP_CLASSIFICATIONS)[number]

export const DNA_RELATIONSHIP_BOUNDARY_BY_CLASSIFICATION = deepFreeze({
  product_definition: "owner_defined_not_scientific_validation",
  supported_relation: "explicit_single_step_relation_not_product_validation",
  conceptual_proximity: "conceptual_overlap_not_product_validation",
  theory_only: "theory_not_established_as_fact",
  not_established: "insufficient_evidence_for_dna_relation",
  contradicted: "evidence_against_proposed_relation",
  not_applicable: "no_applicable_dna_relation",
} as const)

export type DnaRelationshipBoundaryCode =
  (typeof DNA_RELATIONSHIP_BOUNDARY_BY_CLASSIFICATION)[DnaRelationshipClassification]

export type DnaRelationshipClassificationRecord = Readonly<{
  schemaVersion: typeof DNA_RELATIONSHIP_CLASSIFICATION_VERSION
  status: "candidate_only"
  runtimeEligible: false
  relationshipId: string
  dnaTopicId: string
  classification: DnaRelationshipClassification
  authority: "dna_product_information" | "external_scientific_information"
  boundaryCode: DnaRelationshipBoundaryCode
  externalClaimId: string | null
  externalClaimSha256: string | null
  explicitRelationClaimId: string | null
  explicitRelationClaimSha256: string | null
  ownerPassageId: string | null
  ownerPassageSha256: string | null
  supportPassageIds: readonly string[]
  supportPassageSha256: readonly string[]
  relationshipSha256: string
}>

export function createDnaRelationshipClassification(input: Readonly<{
  relationshipId: string
  dnaTopicId: string
  classification: DnaRelationshipClassification
  authority: "dna_product_information" | "external_scientific_information"
  boundaryCode: DnaRelationshipBoundaryCode
  externalClaimId: string | null
  externalClaimSha256: string | null
  explicitRelationClaimId: string | null
  explicitRelationClaimSha256: string | null
  ownerPassageId: string | null
  ownerPassageSha256: string | null
  supportPassageIds: readonly string[]
  supportPassageSha256: readonly string[]
}>): DnaRelationshipClassificationRecord {
  if (!DNA_RELATIONSHIP_CLASSIFICATIONS.includes(input.classification)) {
    throw new Error("dna_publication_invalid_relationship_classification")
  }
  if (input.boundaryCode !== DNA_RELATIONSHIP_BOUNDARY_BY_CLASSIFICATION[input.classification]) {
    throw new Error("dna_publication_relationship_boundary_mismatch")
  }
  const productDefinition = input.classification === "product_definition"
  if (productDefinition !== (input.authority === "dna_product_information")) {
    throw new Error("dna_publication_relationship_authority_mismatch")
  }
  const externalClaimId = input.externalClaimId === null
    ? null
    : requireStableId(input.externalClaimId, "relationship_external_claim_id")
  const externalClaimSha256 = input.externalClaimSha256 === null
    ? null
    : requireSha256(input.externalClaimSha256, "relationship_external_claim_sha256")
  const relationClaimId = input.explicitRelationClaimId === null
    ? null
    : requireStableId(input.explicitRelationClaimId, "explicit_relation_claim_id")
  const relationClaimSha256 = input.explicitRelationClaimSha256 === null
    ? null
    : requireSha256(input.explicitRelationClaimSha256, "explicit_relation_claim_sha256")
  const ownerPassageId = input.ownerPassageId === null
    ? null
    : requireStableId(input.ownerPassageId, "owner_passage_id")
  const ownerPassageSha256 = input.ownerPassageSha256 === null
    ? null
    : requireSha256(input.ownerPassageSha256, "owner_passage_sha256")
  if ((externalClaimId === null) !== (externalClaimSha256 === null)
    || (relationClaimId === null) !== (relationClaimSha256 === null)
    || (ownerPassageId === null) !== (ownerPassageSha256 === null)) {
    throw new Error("dna_publication_relationship_incomplete_hash_binding")
  }
  if (input.supportPassageIds.length !== input.supportPassageSha256.length
    || new Set(input.supportPassageIds).size !== input.supportPassageIds.length) {
    throw new Error("dna_publication_relationship_support_binding_invalid")
  }
  const supportRows = input.supportPassageIds.map((id, index) => ({
    id: requireStableId(id, "relationship_support_passage_id"),
    hash: requireSha256(
      input.supportPassageSha256[index]!,
      "relationship_support_passage_sha256",
    ),
  })).sort((left, right) => left.id.localeCompare(right.id))
  if (new Set(supportRows.map((row) => row.hash)).size !== supportRows.length) {
    throw new Error("dna_publication_relationship_duplicate_support_content")
  }
  if (productDefinition) {
    if (ownerPassageId === null
      || externalClaimId !== null
      || relationClaimId !== null
      || supportRows.length !== 0) {
      throw new Error("dna_publication_product_definition_binding_invalid")
    }
  } else {
    if (ownerPassageId !== null || externalClaimId === null) {
      throw new Error("dna_publication_external_relationship_binding_invalid")
    }
    if (["supported_relation", "conceptual_proximity", "theory_only", "contradicted"]
      .includes(input.classification)
      && (relationClaimId === null || supportRows.length === 0)) {
      throw new Error("dna_publication_explicit_relationship_support_required")
    }
    if (["not_established", "not_applicable"].includes(input.classification)
      && relationClaimId !== null) {
      throw new Error("dna_publication_unestablished_relationship_cannot_claim_relation")
    }
  }
  const core = deepFreeze({
    schemaVersion: DNA_RELATIONSHIP_CLASSIFICATION_VERSION,
    status: "candidate_only" as const,
    runtimeEligible: false as const,
    relationshipId: requireStableId(input.relationshipId, "relationship_id"),
    dnaTopicId: requireStableId(input.dnaTopicId, "relationship_dna_topic_id"),
    classification: input.classification,
    authority: input.authority,
    boundaryCode: input.boundaryCode,
    externalClaimId,
    externalClaimSha256,
    explicitRelationClaimId: relationClaimId,
    explicitRelationClaimSha256: relationClaimSha256,
    ownerPassageId,
    ownerPassageSha256,
    supportPassageIds: supportRows.map((row) => row.id),
    supportPassageSha256: supportRows.map((row) => row.hash),
  })
  return deepFreeze({ ...core, relationshipSha256: sha256(core) })
}

export function isDnaRelationshipClassificationIntegrityValid(
  value: unknown,
): value is DnaRelationshipClassificationRecord {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false
    const record = value as DnaRelationshipClassificationRecord
    requireExactKeys(record, [
      "schemaVersion",
      "status",
      "runtimeEligible",
      "relationshipId",
      "dnaTopicId",
      "classification",
      "authority",
      "boundaryCode",
      "externalClaimId",
      "externalClaimSha256",
      "explicitRelationClaimId",
      "explicitRelationClaimSha256",
      "ownerPassageId",
      "ownerPassageSha256",
      "supportPassageIds",
      "supportPassageSha256",
      "relationshipSha256",
    ], "dna_publication_invalid_relationship_shape")
    if (record.schemaVersion !== DNA_RELATIONSHIP_CLASSIFICATION_VERSION
      || record.status !== "candidate_only"
      || record.runtimeEligible !== false) return false
    const recreated = createDnaRelationshipClassification({
      relationshipId: record.relationshipId,
      dnaTopicId: record.dnaTopicId,
      classification: record.classification,
      authority: record.authority,
      boundaryCode: record.boundaryCode,
      externalClaimId: record.externalClaimId,
      externalClaimSha256: record.externalClaimSha256,
      explicitRelationClaimId: record.explicitRelationClaimId,
      explicitRelationClaimSha256: record.explicitRelationClaimSha256,
      ownerPassageId: record.ownerPassageId,
      ownerPassageSha256: record.ownerPassageSha256,
      supportPassageIds: record.supportPassageIds,
      supportPassageSha256: record.supportPassageSha256,
    })
    return recreated.relationshipSha256 === record.relationshipSha256
  } catch {
    return false
  }
}

export const DNA_AUTHORIZED_RELATIONSHIP_SHA256 = Object.freeze([] as string[])

// ---------------------------------------------------------------------------
// Phase 27: final publication eligibility
// ---------------------------------------------------------------------------

export const DNA_PUBLICATION_GATES = Object.freeze([
  "valid_source",
  "license",
  "retraction_check",
  "real_passage",
  "exact_locator",
  "two_blind_extractions",
  "source_fidelity",
  "method_review",
  "counter_evidence",
  "safety_review",
  "turkish_transfer",
  "age_and_population",
  "claim_boundary",
  "dna_relationship",
] as const)
export type DnaPublicationGate = (typeof DNA_PUBLICATION_GATES)[number]

export const DNA_PUBLICATION_REVIEWER_ROLE_BY_GATE = deepFreeze({
  valid_source: "source_validity_auditor",
  license: "license_auditor",
  retraction_check: "source_integrity_auditor",
  real_passage: "passage_auditor",
  exact_locator: "locator_auditor",
  two_blind_extractions: "claim_reconciliation_auditor",
  source_fidelity: "source_fidelity_auditor",
  method_review: "method_auditor",
  counter_evidence: "adversarial_auditor",
  safety_review: "clinical_safety_auditor",
  turkish_transfer: "translation_auditor",
  age_and_population: "demographics_auditor",
  claim_boundary: "claim_boundary_auditor",
  dna_relationship: "dna_relationship_auditor",
} as const)

export type DnaPublicationReviewerRole =
  (typeof DNA_PUBLICATION_REVIEWER_ROLE_BY_GATE)[DnaPublicationGate]

export type DnaPublicationSubject = Readonly<{
  schemaVersion: typeof DNA_PUBLICATION_SUBJECT_VERSION
  candidateId: string
  sourceId: string
  sourceSha256: string
  licenseSha256: string
  retractionCheckSha256: string
  artifactId: string
  artifactSha256: string
  passageId: string
  passageSha256: string
  locatorSha256: string
  claimId: string
  claimSha256: string
  blindRunASha256: string
  blindRunBSha256: string
  reconciliationSha256: string
  sourceFidelityAuditSha256: string
  methodReviewSha256: string
  counterEvidenceAuditSha256: string
  safetyReviewSha256: string
  originalLanguage: string
  translationDisposition: "translated_from_non_turkish" | "original_turkish_reviewed"
  turkishTextSha256: string
  turkishTransferAuditSha256: string
  ageScope: string
  population: "human" | "animal" | "in_vitro" | "mixed_human_animal" | "not_applicable"
  agePopulationAuditSha256: string
  claimBoundarySha256: string
  relationshipId: string
  relationshipSha256: string
  conflictDisposition: "none_identified" | "phase_25_conflict_set_required"
  conflictBindingsSha256: string
  subjectSha256: string
}>

export function dnaConflictBindingsSha256(conflictSets: readonly DnaConflictSet[]): string {
  return sha256(conflictSets.map((set) => ({
    conflictSetId: set.conflictSetId,
    conflictSetSha256: set.conflictSetSha256,
  })).sort((left, right) => left.conflictSetId.localeCompare(right.conflictSetId)))
}

export function createDnaPublicationSubject(input: Readonly<
  Omit<DnaPublicationSubject, "schemaVersion" | "subjectSha256">
>): DnaPublicationSubject {
  const hashFields = [
    "sourceSha256",
    "licenseSha256",
    "retractionCheckSha256",
    "artifactSha256",
    "passageSha256",
    "locatorSha256",
    "claimSha256",
    "blindRunASha256",
    "blindRunBSha256",
    "reconciliationSha256",
    "sourceFidelityAuditSha256",
    "methodReviewSha256",
    "counterEvidenceAuditSha256",
    "safetyReviewSha256",
    "turkishTextSha256",
    "turkishTransferAuditSha256",
    "agePopulationAuditSha256",
    "claimBoundarySha256",
    "relationshipSha256",
    "conflictBindingsSha256",
  ] as const
  const hashes = Object.fromEntries(hashFields.map((field) => [
    field,
    requireSha256(input[field], field),
  ])) as Record<(typeof hashFields)[number], string>
  if (hashes.blindRunASha256 === hashes.blindRunBSha256) {
    throw new Error("dna_publication_blind_runs_not_independent")
  }
  if (!LANGUAGE_PATTERN.test(input.originalLanguage)) {
    throw new Error("dna_publication_invalid_original_language")
  }
  const isTurkish = input.originalLanguage === "tr" || input.originalLanguage.startsWith("tr-")
  if ((isTurkish && input.translationDisposition !== "original_turkish_reviewed")
    || (!isTurkish && input.translationDisposition !== "translated_from_non_turkish")) {
    throw new Error("dna_publication_translation_disposition_mismatch")
  }
  const ageScope = String(input.ageScope || "").trim()
  if (!ageScope || ageScope === "not_reported") {
    throw new Error("dna_publication_age_scope_required")
  }
  if (!["human", "animal", "in_vitro", "mixed_human_animal", "not_applicable"]
    .includes(input.population)) {
    throw new Error("dna_publication_population_required")
  }
  if (!["none_identified", "phase_25_conflict_set_required"]
    .includes(input.conflictDisposition)) {
    throw new Error("dna_publication_invalid_conflict_disposition")
  }
  const emptyConflictBinding = dnaConflictBindingsSha256([])
  if ((input.conflictDisposition === "none_identified"
      && hashes.conflictBindingsSha256 !== emptyConflictBinding)
    || (input.conflictDisposition === "phase_25_conflict_set_required"
      && hashes.conflictBindingsSha256 === emptyConflictBinding)) {
    throw new Error("dna_publication_conflict_disposition_binding_mismatch")
  }
  const core = deepFreeze({
    schemaVersion: DNA_PUBLICATION_SUBJECT_VERSION,
    candidateId: requireStableId(input.candidateId, "candidate_id"),
    sourceId: requireStableId(input.sourceId, "subject_source_id"),
    sourceSha256: hashes.sourceSha256,
    licenseSha256: hashes.licenseSha256,
    retractionCheckSha256: hashes.retractionCheckSha256,
    artifactId: requireStableId(input.artifactId, "subject_artifact_id"),
    artifactSha256: hashes.artifactSha256,
    passageId: requireStableId(input.passageId, "subject_passage_id"),
    passageSha256: hashes.passageSha256,
    locatorSha256: hashes.locatorSha256,
    claimId: requireStableId(input.claimId, "subject_claim_id"),
    claimSha256: hashes.claimSha256,
    blindRunASha256: hashes.blindRunASha256,
    blindRunBSha256: hashes.blindRunBSha256,
    reconciliationSha256: hashes.reconciliationSha256,
    sourceFidelityAuditSha256: hashes.sourceFidelityAuditSha256,
    methodReviewSha256: hashes.methodReviewSha256,
    counterEvidenceAuditSha256: hashes.counterEvidenceAuditSha256,
    safetyReviewSha256: hashes.safetyReviewSha256,
    originalLanguage: input.originalLanguage,
    translationDisposition: input.translationDisposition,
    turkishTextSha256: hashes.turkishTextSha256,
    turkishTransferAuditSha256: hashes.turkishTransferAuditSha256,
    ageScope,
    population: input.population,
    agePopulationAuditSha256: hashes.agePopulationAuditSha256,
    claimBoundarySha256: hashes.claimBoundarySha256,
    relationshipId: requireStableId(input.relationshipId, "subject_relationship_id"),
    relationshipSha256: hashes.relationshipSha256,
    conflictDisposition: input.conflictDisposition,
    conflictBindingsSha256: hashes.conflictBindingsSha256,
  })
  return deepFreeze({ ...core, subjectSha256: sha256(core) })
}

function isDnaPublicationSubjectIntegrityValid(value: unknown): value is DnaPublicationSubject {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false
    const subject = value as DnaPublicationSubject
    requireExactKeys(subject, [
      "schemaVersion",
      "candidateId",
      "sourceId",
      "sourceSha256",
      "licenseSha256",
      "retractionCheckSha256",
      "artifactId",
      "artifactSha256",
      "passageId",
      "passageSha256",
      "locatorSha256",
      "claimId",
      "claimSha256",
      "blindRunASha256",
      "blindRunBSha256",
      "reconciliationSha256",
      "sourceFidelityAuditSha256",
      "methodReviewSha256",
      "counterEvidenceAuditSha256",
      "safetyReviewSha256",
      "originalLanguage",
      "translationDisposition",
      "turkishTextSha256",
      "turkishTransferAuditSha256",
      "ageScope",
      "population",
      "agePopulationAuditSha256",
      "claimBoundarySha256",
      "relationshipId",
      "relationshipSha256",
      "conflictDisposition",
      "conflictBindingsSha256",
      "subjectSha256",
    ], "dna_publication_invalid_subject_shape")
    if (subject.schemaVersion !== DNA_PUBLICATION_SUBJECT_VERSION) return false
    const { schemaVersion: _schemaVersion, subjectSha256: _subjectSha256, ...input } = subject
    return createDnaPublicationSubject(input).subjectSha256 === subject.subjectSha256
  } catch {
    return false
  }
}

function isRelationshipBoundToPublicationSubject(
  relationship: DnaRelationshipClassificationRecord,
  subject: DnaPublicationSubject,
): boolean {
  if (relationship.classification === "product_definition") {
    return relationship.ownerPassageId === subject.passageId
      && relationship.ownerPassageSha256 === subject.passageSha256
  }
  return relationship.externalClaimId === subject.claimId
    && relationship.externalClaimSha256 === subject.claimSha256
}

function isConflictSetBoundToPublicationSubject(
  conflictSet: DnaConflictSet,
  subject: DnaPublicationSubject,
): boolean {
  return conflictSet.members.some((member) =>
    member.claimId === subject.claimId
    && member.claimSha256 === subject.claimSha256)
}

export type DnaPublicationGateAttestation = Readonly<{
  schemaVersion: typeof DNA_PUBLICATION_GATE_ATTESTATION_VERSION
  attestationId: string
  gate: DnaPublicationGate
  reviewerRole: DnaPublicationReviewerRole
  protocolVersion: string
  subjectSha256: string
  attestedEvidenceSha256: string
  completedAt: string
  outcome: "passed"
  attestationSha256: string
}>

export function dnaPublicationGateEvidenceSha256(
  subject: DnaPublicationSubject,
  gate: DnaPublicationGate,
): string {
  const map: Record<DnaPublicationGate, string> = {
    valid_source: subject.sourceSha256,
    license: subject.licenseSha256,
    retraction_check: subject.retractionCheckSha256,
    real_passage: subject.passageSha256,
    exact_locator: subject.locatorSha256,
    two_blind_extractions: sha256({
      runA: subject.blindRunASha256,
      runB: subject.blindRunBSha256,
      reconciliation: subject.reconciliationSha256,
    }),
    source_fidelity: subject.sourceFidelityAuditSha256,
    method_review: subject.methodReviewSha256,
    counter_evidence: subject.counterEvidenceAuditSha256,
    safety_review: subject.safetyReviewSha256,
    turkish_transfer: subject.turkishTransferAuditSha256,
    age_and_population: subject.agePopulationAuditSha256,
    claim_boundary: subject.claimBoundarySha256,
    dna_relationship: subject.relationshipSha256,
  }
  return map[gate]
}

function attestationCore(
  attestation:
    | Omit<DnaPublicationGateAttestation, "attestationSha256">
    | DnaPublicationGateAttestation,
) {
  const { attestationSha256: _attestationSha256, ...core } =
    attestation as DnaPublicationGateAttestation
  return core
}

export function createDnaPublicationGateAttestation(input: Readonly<{
  attestationId: string
  gate: DnaPublicationGate
  reviewerRole: DnaPublicationReviewerRole
  protocolVersion: string
  subject: DnaPublicationSubject
  attestedEvidenceSha256: string
  completedAt: string
  outcome: "passed"
}>): DnaPublicationGateAttestation {
  if (!DNA_PUBLICATION_GATES.includes(input.gate)) {
    throw new Error("dna_publication_invalid_gate")
  }
  if (!isDnaPublicationSubjectIntegrityValid(input.subject)) {
    throw new Error("dna_publication_invalid_subject")
  }
  if (input.reviewerRole !== DNA_PUBLICATION_REVIEWER_ROLE_BY_GATE[input.gate]) {
    throw new Error("dna_publication_gate_reviewer_role_mismatch")
  }
  const attestedEvidenceSha256 = requireSha256(
    input.attestedEvidenceSha256,
    "attested_evidence_sha256",
  )
  if (attestedEvidenceSha256 !== dnaPublicationGateEvidenceSha256(input.subject, input.gate)) {
    throw new Error("dna_publication_gate_evidence_binding_mismatch")
  }
  if (input.outcome !== "passed") throw new Error("dna_publication_gate_not_passed")
  const core = deepFreeze({
    schemaVersion: DNA_PUBLICATION_GATE_ATTESTATION_VERSION,
    attestationId: requireStableId(input.attestationId, "attestation_id"),
    gate: input.gate,
    reviewerRole: input.reviewerRole,
    protocolVersion: requireStableId(input.protocolVersion, "gate_protocol_version"),
    subjectSha256: input.subject.subjectSha256,
    attestedEvidenceSha256,
    completedAt: requireIsoTimestamp(input.completedAt, "gate_completed_at"),
    outcome: "passed" as const,
  })
  return deepFreeze({ ...core, attestationSha256: sha256(core) })
}

function isGateAttestationIntegrityValid(
  attestation: DnaPublicationGateAttestation,
  subject: DnaPublicationSubject,
): boolean {
  try {
    requireExactKeys(attestation, [
      "schemaVersion",
      "attestationId",
      "gate",
      "reviewerRole",
      "protocolVersion",
      "subjectSha256",
      "attestedEvidenceSha256",
      "completedAt",
      "outcome",
      "attestationSha256",
    ], "dna_publication_invalid_gate_attestation_shape")
    return attestation.schemaVersion === DNA_PUBLICATION_GATE_ATTESTATION_VERSION
      && DNA_PUBLICATION_GATES.includes(attestation.gate)
      && attestation.outcome === "passed"
      && attestation.reviewerRole === DNA_PUBLICATION_REVIEWER_ROLE_BY_GATE[attestation.gate]
      && attestation.subjectSha256 === subject.subjectSha256
      && attestation.attestedEvidenceSha256
        === dnaPublicationGateEvidenceSha256(subject, attestation.gate)
      && attestation.attestationSha256 === sha256(attestationCore(attestation))
      && requireIsoTimestamp(attestation.completedAt, "gate_completed_at") === attestation.completedAt
      && requireStableId(attestation.protocolVersion, "gate_protocol_version")
        === attestation.protocolVersion
  } catch {
    return false
  }
}

export type DnaPublicationCandidate = Readonly<{
  schemaVersion: typeof DNA_PUBLICATION_ELIGIBILITY_VERSION
  status: "candidate_only"
  runtimeEligible: false
  subject: DnaPublicationSubject
  relationship: DnaRelationshipClassificationRecord
  conflictSets: readonly DnaConflictSet[]
  attestations: readonly DnaPublicationGateAttestation[]
  publicationDigest: string
}>

export function createDnaPublicationCandidate(input: Readonly<{
  subject: DnaPublicationSubject
  relationship: DnaRelationshipClassificationRecord
  conflictSets: readonly DnaConflictSet[]
  attestations: readonly DnaPublicationGateAttestation[]
}>): DnaPublicationCandidate {
  if (!isDnaPublicationSubjectIntegrityValid(input.subject)) {
    throw new Error("dna_publication_invalid_subject")
  }
  if (!isDnaRelationshipClassificationIntegrityValid(input.relationship)
    || input.relationship.relationshipId !== input.subject.relationshipId
    || input.relationship.relationshipSha256 !== input.subject.relationshipSha256
    || !isRelationshipBoundToPublicationSubject(input.relationship, input.subject)) {
    throw new Error("dna_publication_relationship_binding_invalid")
  }
  if (input.conflictSets.some((set) => !isDnaConflictSetIntegrityValid(set))) {
    throw new Error("dna_publication_conflict_set_integrity_invalid")
  }
  if (new Set(input.conflictSets.map((set) => set.conflictSetId)).size
    !== input.conflictSets.length) {
    throw new Error("dna_publication_duplicate_conflict_set_id")
  }
  if (input.conflictSets.some((set) =>
    !isConflictSetBoundToPublicationSubject(set, input.subject))) {
    throw new Error("dna_publication_conflict_subject_binding_invalid")
  }
  if ((input.subject.conflictDisposition === "none_identified"
      && input.conflictSets.length !== 0)
    || (input.subject.conflictDisposition === "phase_25_conflict_set_required"
      && input.conflictSets.length === 0)) {
    throw new Error("dna_publication_conflict_disposition_binding_mismatch")
  }
  if (dnaConflictBindingsSha256(input.conflictSets) !== input.subject.conflictBindingsSha256) {
    throw new Error("dna_publication_conflict_binding_mismatch")
  }
  const attestations = [...input.attestations]
    .sort((left, right) => left.gate.localeCompare(right.gate))
  const core = deepFreeze({
    schemaVersion: DNA_PUBLICATION_ELIGIBILITY_VERSION,
    status: "candidate_only" as const,
    runtimeEligible: false as const,
    subject: input.subject,
    relationship: input.relationship,
    conflictSets: [...input.conflictSets].sort((left, right) =>
      left.conflictSetId.localeCompare(right.conflictSetId)),
    attestations,
  })
  return deepFreeze({ ...core, publicationDigest: sha256(core) })
}

export const DNA_PUBLICATION_BLOCK_CODES = Object.freeze([
  "invalid_candidate",
  "publication_digest_mismatch",
  "relationship_invalid",
  "relationship_not_authorized",
  "conflict_set_invalid",
  "conflict_set_not_authorized",
  "conflict_required",
  "unresolved_conflict",
  "duplicate_gate",
  "missing_gate",
  "gate_attestation_invalid",
  "candidate_not_in_publication_registry",
] as const)
export type DnaPublicationBlockCode = (typeof DNA_PUBLICATION_BLOCK_CODES)[number]

export type DnaPublicationEligibilityDecision = Readonly<{
  schemaVersion: typeof DNA_PUBLICATION_ELIGIBILITY_VERSION
  candidateId: string | null
  gateCount: number
  passedGateCount: number
  preauthorizationEligible: boolean
  releaseEligible: boolean
  blockCodes: readonly DnaPublicationBlockCode[]
  publicationDigest: string | null
}>

/**
 * Final release authorizations are code-reviewed immutable digests. A caller
 * cannot provide or extend this registry. It remains empty until real claims
 * pass every gate and a separate governance release commits their digests.
 */
export const DNA_AUTHORIZED_PUBLICATION_DIGESTS = Object.freeze([] as string[])

function pushUnique<T>(items: T[], value: T): void {
  if (!items.includes(value)) items.push(value)
}

export function evaluateDnaPublicationEligibility(
  value: unknown,
): DnaPublicationEligibilityDecision {
  const blockCodes: DnaPublicationBlockCode[] = []
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return deepFreeze({
      schemaVersion: DNA_PUBLICATION_ELIGIBILITY_VERSION,
      candidateId: null,
      gateCount: DNA_PUBLICATION_GATES.length,
      passedGateCount: 0,
      preauthorizationEligible: false,
      releaseEligible: false,
      blockCodes: ["invalid_candidate"],
      publicationDigest: null,
    })
  }
  const candidate = value as DnaPublicationCandidate
  try {
    requireExactKeys(candidate, [
      "schemaVersion",
      "status",
      "runtimeEligible",
      "subject",
      "relationship",
      "conflictSets",
      "attestations",
      "publicationDigest",
    ], "dna_publication_invalid_candidate_shape")
  } catch {
    pushUnique(blockCodes, "invalid_candidate")
  }
  if (candidate.schemaVersion !== DNA_PUBLICATION_ELIGIBILITY_VERSION
    || candidate.status !== "candidate_only"
    || candidate.runtimeEligible !== false
    || !isDnaPublicationSubjectIntegrityValid(candidate.subject)
    || !Array.isArray(candidate.attestations)
    || !Array.isArray(candidate.conflictSets)) {
    pushUnique(blockCodes, "invalid_candidate")
  }
  const subjectIntegrityValid = isDnaPublicationSubjectIntegrityValid(candidate.subject)
  if (!subjectIntegrityValid
    || !isDnaRelationshipClassificationIntegrityValid(candidate.relationship)
    || candidate.relationship?.relationshipId !== candidate.subject?.relationshipId
    || candidate.relationship?.relationshipSha256 !== candidate.subject?.relationshipSha256
    || !isRelationshipBoundToPublicationSubject(candidate.relationship, candidate.subject)) {
    pushUnique(blockCodes, "relationship_invalid")
  } else if (!DNA_AUTHORIZED_RELATIONSHIP_SHA256
    .includes(candidate.relationship.relationshipSha256)) {
    pushUnique(blockCodes, "relationship_not_authorized")
  }
  const conflictSets = Array.isArray(candidate.conflictSets) ? candidate.conflictSets : []
  const attestations = Array.isArray(candidate.attestations) ? candidate.attestations : []
  if (subjectIntegrityValid
    && candidate.subject.conflictDisposition === "phase_25_conflict_set_required"
    && conflictSets.length === 0) {
    pushUnique(blockCodes, "conflict_required")
  }
  if (subjectIntegrityValid
    && candidate.subject.conflictDisposition === "none_identified"
    && conflictSets.length !== 0) {
    pushUnique(blockCodes, "conflict_set_invalid")
  }
  for (const set of conflictSets) {
    if (!isDnaConflictSetIntegrityValid(set)) {
      pushUnique(blockCodes, "conflict_set_invalid")
    } else if (subjectIntegrityValid
      && !isConflictSetBoundToPublicationSubject(set, candidate.subject)) {
      pushUnique(blockCodes, "conflict_set_invalid")
    } else {
      if (!DNA_AUTHORIZED_CONFLICT_SET_SHA256.includes(set.conflictSetSha256)) {
        pushUnique(blockCodes, "conflict_set_not_authorized")
      }
      if (set.resolution !== "resolved") pushUnique(blockCodes, "unresolved_conflict")
    }
  }
  if (isDnaPublicationSubjectIntegrityValid(candidate.subject)
    && conflictSets.every((set) => isDnaConflictSetIntegrityValid(set))
    && dnaConflictBindingsSha256(conflictSets) !== candidate.subject.conflictBindingsSha256) {
    pushUnique(blockCodes, "conflict_set_invalid")
  }
  const gates = attestations.map((attestation) =>
    attestation && typeof attestation === "object"
      ? (attestation as DnaPublicationGateAttestation).gate
      : null)
  if (new Set(gates).size !== gates.length) pushUnique(blockCodes, "duplicate_gate")
  if (DNA_PUBLICATION_GATES.some((gate) => !gates.includes(gate))) {
    pushUnique(blockCodes, "missing_gate")
  }
  const validAttestations = candidate.subject
    ? attestations.filter((attestation) =>
      isGateAttestationIntegrityValid(attestation, candidate.subject))
    : []
  if (validAttestations.length !== attestations.length) {
    pushUnique(blockCodes, "gate_attestation_invalid")
  }
  const core = candidate && typeof candidate === "object"
    ? {
        schemaVersion: candidate.schemaVersion,
        status: candidate.status,
        runtimeEligible: candidate.runtimeEligible,
        subject: candidate.subject,
        relationship: candidate.relationship,
        conflictSets: candidate.conflictSets,
        attestations: candidate.attestations,
      }
    : null
  if (!candidate.publicationDigest || candidate.publicationDigest !== sha256(core)) {
    pushUnique(blockCodes, "publication_digest_mismatch")
  }
  const preauthorizationBlockCodes = blockCodes.filter((code) =>
    code !== "relationship_not_authorized"
    && code !== "conflict_set_not_authorized"
    && code !== "candidate_not_in_publication_registry")
  const preauthorizationEligible = preauthorizationBlockCodes.length === 0
  if (!candidate.publicationDigest
    || !DNA_AUTHORIZED_PUBLICATION_DIGESTS.includes(candidate.publicationDigest)) {
    pushUnique(blockCodes, "candidate_not_in_publication_registry")
  }
  return deepFreeze({
    schemaVersion: DNA_PUBLICATION_ELIGIBILITY_VERSION,
    candidateId: candidate.subject?.candidateId ?? null,
    gateCount: DNA_PUBLICATION_GATES.length,
    passedGateCount: new Set(validAttestations.map((attestation) => attestation.gate)).size,
    preauthorizationEligible,
    releaseEligible: blockCodes.length === 0,
    blockCodes,
    publicationDigest: SHA256_PATTERN.test(candidate.publicationDigest ?? "")
      ? candidate.publicationDigest
      : null,
  })
}

export const DNA_PUBLICATION_ELIGIBILITY_CONTRACT = deepFreeze({
  schemaVersion: DNA_PUBLICATION_ELIGIBILITY_VERSION,
  conflictSetVersion: DNA_CONFLICT_SET_VERSION,
  relationshipClassificationVersion: DNA_RELATIONSHIP_CLASSIFICATION_VERSION,
  gates: DNA_PUBLICATION_GATES,
  relationshipClassifications: DNA_RELATIONSHIP_CLASSIFICATIONS,
  unresolvedConflictLimitation: DNA_UNRESOLVED_CONFLICT_LIMITATION,
  conflictPolicy: "conflicted_subject_requires_bound_authorized_resolved_conflict_set",
  productionConflictSetCount: DNA_AUTHORIZED_CONFLICT_SET_SHA256.length,
  productionRelationshipCount: DNA_AUTHORIZED_RELATIONSHIP_SHA256.length,
  productionPublicationCount: DNA_AUTHORIZED_PUBLICATION_DIGESTS.length,
  safetyPolicy: "fail_closed",
  authorizationPolicy: "immutable_code_reviewed_digest_registry_no_caller_injection",
  scienceToDnaPolicy: "general_science_never_implicitly_validates_the_dna_product",
  currentDisposition: "candidate_only_no_v3_runtime_release",
})

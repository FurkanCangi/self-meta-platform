import { createHash } from "node:crypto"

import {
  DNA_PASSAGE_EVIDENCE_TYPES,
  commitDnaEvidenceSubject,
  createDnaCandidateSourcePassage,
  createDnaEvidenceTrustRegistry,
  isDnaCandidateEvidenceTrustRegistryValid,
  validateDnaPassageSet,
  type DnaEvidenceTrustRecord,
  type DnaParsedArtifact,
  type DnaPassageEvidenceType,
  type DnaPassageLicenseApproval,
  type DnaPassageMetadataApproval,
  type DnaSourcePassage,
} from "./evidenceExtraction"
import {
  isDnaMethodAppraisalRegistrationResultValid,
  type DnaMethodAppraisalRegistrationResult,
} from "./methodAppraisalRegistration"
import {
  DNA_SOURCE_AGE_SCOPES,
  type DnaSourceAgeScope,
} from "./sourceGovernance"

export const DNA_CANDIDATE_PASSAGE_DECISION_VERSION =
  "dna-candidate-passage-decision@1" as const
export const DNA_CANDIDATE_PASSAGE_RESULT_VERSION =
  "dna-candidate-passage-registration-result@1" as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,199}$/

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort((left, right) => left.localeCompare(right, "en"))
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`
}

export function hashDnaCandidatePassagePayload(value: unknown): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex")
}

function exactKeys(value: unknown, expected: readonly string[], code: string): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code)
  const actual = Object.keys(value as Record<string, unknown>)
    .sort((left, right) => left.localeCompare(right, "en"))
  const wanted = [...expected].sort((left, right) => left.localeCompare(right, "en"))
  if (actual.length !== wanted.length
    || actual.some((key, index) => key !== wanted[index])) throw new Error(code)
}

function assertId(value: string, code: string): void {
  if (!IDENTIFIER_PATTERN.test(String(value || ""))) throw new Error(code)
}

function assertSha(value: string, code: string): void {
  if (!SHA256_PATTERN.test(String(value || ""))) throw new Error(code)
}

function assertIso(value: string, code: string): void {
  const time = Date.parse(String(value || ""))
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) throw new Error(code)
}

export type DnaCandidatePassageSelection = Readonly<{
  passageId: string
  paragraphIds: readonly string[]
  ageScope: DnaSourceAgeScope
  evidenceType: DnaPassageEvidenceType
  claimBoundary: string
  rationale: string
}>

export type DnaCandidatePassageDecision = Readonly<{
  schemaVersion: typeof DNA_CANDIDATE_PASSAGE_DECISION_VERSION
  decisionId: string
  sourceId: string
  artifactSha256: string
  workpackPayloadSha256: string
  workpackFileSha256: string
  methodRegistrationResultSha256: string
  methodRegistrationResultFileSha256: string
  reviewedAt: string
  reviewerId: string
  authorityClass: "codex_multi_pass_not_independent"
  status: "candidate_only"
  runtimeEligible: false
  releaseEligible: false
  passages: readonly DnaCandidatePassageSelection[]
  decisionSha256: string
}>

export type DnaCandidatePassageWorkpack = Readonly<{
  schemaVersion: "dna-v3-method-review-workpack@2"
  status: "candidate_only"
  runtimeEligible: false
  releaseEligible: false
  sourceId: string
  sourceRecordRelativePath: string
  sourceRecordSha256: string
  artifactId: string
  artifactRelativePath: string
  artifactSha256: string
  parsedContentSha256: string
  paragraphCount: number
  workpackSha256: string
  passageLicenseDecision: string
  passageLicenseDecisionSha256: string
  componentLicenseAuditRecordSha256: string
  paragraphs: DnaParsedArtifact["paragraphs"]
  exclusions: DnaParsedArtifact["exclusions"]
}>

export type DnaCandidatePassageRegistrationResult = Readonly<{
  schemaVersion: typeof DNA_CANDIDATE_PASSAGE_RESULT_VERSION
  sourceId: string
  artifactSha256: string
  decisionSha256: string
  methodRegistrationResultSha256: string
  passages: readonly DnaSourcePassage[]
  candidateTrustRegistry: ReturnType<typeof createDnaEvidenceTrustRegistry>
  runtimeEligible: false
  releaseEligible: false
  resultSha256: string
}>

const REGISTRATION_RESULT_KEYS = Object.freeze([
  "schemaVersion", "sourceId", "artifactSha256", "decisionSha256",
  "methodRegistrationResultSha256", "passages", "candidateTrustRegistry",
  "runtimeEligible", "releaseEligible", "resultSha256",
] as const)

export function isDnaCandidatePassageRegistrationResultValid(
  result: DnaCandidatePassageRegistrationResult,
): boolean {
  try {
    exactKeys(result, REGISTRATION_RESULT_KEYS,
      "candidate_passage_registration_result_shape_invalid")
    if (result.schemaVersion !== DNA_CANDIDATE_PASSAGE_RESULT_VERSION
      || result.runtimeEligible !== false
      || result.releaseEligible !== false
      || !Array.isArray(result.passages)
      || result.passages.length < 1
      || !isDnaCandidateEvidenceTrustRegistryValid(result.candidateTrustRegistry)
      || !validateDnaPassageSet(result.passages).ok) return false
    assertId(result.sourceId, "candidate_passage_registration_source_id_invalid")
    for (const value of [
      result.artifactSha256,
      result.decisionSha256,
      result.methodRegistrationResultSha256,
      result.resultSha256,
    ]) assertSha(value, "candidate_passage_registration_hash_invalid")
    for (const passage of result.passages) {
      if (passage.sourceId !== result.sourceId
        || passage.artifactSha256 !== result.artifactSha256
        || !result.candidateTrustRegistry.records.some((record) =>
          record.kind === "passage"
          && record.recordId === passage.id
          && record.sourceId === passage.sourceId
          && record.artifactSha256 === passage.artifactSha256
          && record.subjectSha256 === passage.provenanceSha256)) return false
    }
    const { resultSha256, ...payload } = result
    return resultSha256 === hashDnaCandidatePassagePayload(payload)
  } catch {
    return false
  }
}

const DECISION_KEYS = Object.freeze([
  "schemaVersion", "decisionId", "sourceId", "artifactSha256",
  "workpackPayloadSha256", "workpackFileSha256", "methodRegistrationResultSha256",
  "methodRegistrationResultFileSha256", "reviewedAt", "reviewerId", "authorityClass",
  "status", "runtimeEligible", "releaseEligible", "passages", "decisionSha256",
] as const)

const PASSAGE_KEYS = Object.freeze([
  "passageId", "paragraphIds", "ageScope", "evidenceType", "claimBoundary", "rationale",
] as const)

export function assertDnaCandidatePassageDecision(
  decision: DnaCandidatePassageDecision,
): void {
  exactKeys(decision, DECISION_KEYS, "candidate_passage_decision_shape_invalid")
  if (decision.schemaVersion !== DNA_CANDIDATE_PASSAGE_DECISION_VERSION
    || decision.authorityClass !== "codex_multi_pass_not_independent"
    || decision.status !== "candidate_only"
    || decision.runtimeEligible !== false
    || decision.releaseEligible !== false) {
    throw new Error("candidate_passage_decision_state_invalid")
  }
  assertId(decision.decisionId, "candidate_passage_decision_id_invalid")
  assertId(decision.sourceId, "candidate_passage_source_id_invalid")
  assertId(decision.reviewerId, "candidate_passage_reviewer_id_invalid")
  assertIso(decision.reviewedAt, "candidate_passage_reviewed_at_invalid")
  for (const value of [
    decision.artifactSha256,
    decision.workpackPayloadSha256,
    decision.workpackFileSha256,
    decision.methodRegistrationResultSha256,
    decision.methodRegistrationResultFileSha256,
    decision.decisionSha256,
  ]) assertSha(value, "candidate_passage_hash_invalid")
  if (!Array.isArray(decision.passages) || decision.passages.length < 1
    || decision.passages.length > 30) throw new Error("candidate_passage_count_invalid")
  const passageIds = new Set<string>()
  const paragraphIds = new Set<string>()
  for (const passage of decision.passages) {
    exactKeys(passage, PASSAGE_KEYS, "candidate_passage_selection_shape_invalid")
    assertId(passage.passageId, "candidate_passage_id_invalid")
    if (passageIds.has(passage.passageId)) throw new Error("candidate_passage_id_duplicate")
    passageIds.add(passage.passageId)
    if (!Array.isArray(passage.paragraphIds) || passage.paragraphIds.length < 1
      || passage.paragraphIds.length > 3
      || new Set(passage.paragraphIds).size !== passage.paragraphIds.length) {
      throw new Error("candidate_passage_paragraph_set_invalid")
    }
    for (const paragraphId of passage.paragraphIds) {
      assertId(paragraphId, "candidate_passage_paragraph_id_invalid")
      if (paragraphIds.has(paragraphId)) throw new Error("candidate_passage_overlap_forbidden")
      paragraphIds.add(paragraphId)
    }
    if (!DNA_SOURCE_AGE_SCOPES.includes(passage.ageScope)) {
      throw new Error("candidate_passage_age_scope_invalid")
    }
    if (!DNA_PASSAGE_EVIDENCE_TYPES.includes(passage.evidenceType)) {
      throw new Error("candidate_passage_evidence_type_invalid")
    }
    if (passage.claimBoundary.trim().length < 20 || passage.claimBoundary.length > 800
      || passage.rationale.trim().length < 30 || passage.rationale.length > 1600) {
      throw new Error("candidate_passage_boundary_or_rationale_invalid")
    }
  }
  const { decisionSha256, ...payload } = decision
  if (decisionSha256 !== hashDnaCandidatePassagePayload(payload)) {
    throw new Error("candidate_passage_decision_hash_mismatch")
  }
}

function allowedAgeScope(appraisalAge: DnaSourceAgeScope, passageAge: DnaSourceAgeScope): boolean {
  if (appraisalAge === passageAge) return true
  if (appraisalAge === "all_ages" || appraisalAge === "mixed") {
    return !["not_applicable", "not_reported"].includes(passageAge)
  }
  return false
}

function workpackIntegrityValid(workpack: DnaCandidatePassageWorkpack): boolean {
  if (workpack.schemaVersion !== "dna-v3-method-review-workpack@2"
    || workpack.status !== "candidate_only"
    || workpack.runtimeEligible !== false
    || workpack.releaseEligible !== false
    || workpack.paragraphCount !== workpack.paragraphs.length
    || new Set(workpack.paragraphs.map((paragraph) => paragraph.paragraphId)).size
      !== workpack.paragraphs.length) return false
  const record = workpack as unknown as Record<string, unknown>
  const { workpackSha256, ...core } = record
  return typeof workpackSha256 === "string"
    && SHA256_PATTERN.test(workpackSha256)
    && workpackSha256 === createHash("sha256")
      .update(JSON.stringify(core), "utf8").digest("hex")
}

const ALLOWED_EVIDENCE_TYPES: Readonly<Record<string, readonly DnaPassageEvidenceType[]>> =
  Object.freeze({
    systematic_review_meta_analysis: ["systematic_review", "meta_analysis"],
    randomized_controlled_trial: ["randomized_trial"],
    nonrandomized_intervention: ["controlled_experiment", "observational"],
    prospective_cohort: ["observational"],
    retrospective_cohort: ["observational"],
    case_control: ["observational"],
    cross_sectional: ["observational"],
    diagnostic_accuracy: ["observational"],
    psychometric_validation: ["psychometric"],
    qualitative: ["observational"],
    case_series: ["observational"],
    single_case_experimental: ["controlled_experiment", "observational"],
    animal_experimental: ["controlled_experiment"],
    in_vitro: ["controlled_experiment"],
    narrative_review: ["narrative_review"],
    guideline: ["guideline"],
    consensus: ["consensus"],
    textbook: ["textbook"],
    theory: ["theory"],
    protocol: ["not_reported"],
    other: ["not_reported"],
  })

export function getDnaCandidatePassageConstraints(input: Readonly<{
  studyDesign: string
  ageScope: DnaSourceAgeScope
}>): Readonly<{
  allowedEvidenceTypes: readonly DnaPassageEvidenceType[]
  allowedAgeScopes: readonly DnaSourceAgeScope[]
}> {
  const allowedAgeScopes = DNA_SOURCE_AGE_SCOPES.filter((ageScope) =>
    allowedAgeScope(input.ageScope, ageScope))
  return Object.freeze({
    allowedEvidenceTypes: Object.freeze([...(ALLOWED_EVIDENCE_TYPES[input.studyDesign] ?? [])]),
    allowedAgeScopes: Object.freeze(allowedAgeScopes),
  })
}

export function compileDnaCandidatePassageRegistration(input: Readonly<{
  decision: DnaCandidatePassageDecision
  parsedArtifact: DnaParsedArtifact
  workpack: DnaCandidatePassageWorkpack
  workpackFileSha256: string
  methodRegistrationResult: DnaMethodAppraisalRegistrationResult
  methodRegistrationResultFileSha256: string
}>): DnaCandidatePassageRegistrationResult {
  assertDnaCandidatePassageDecision(input.decision)
  if (!isDnaMethodAppraisalRegistrationResultValid(input.methodRegistrationResult)) {
    throw new Error("candidate_passage_method_registration_invalid")
  }
  if (!workpackIntegrityValid(input.workpack)) {
    throw new Error("candidate_passage_workpack_integrity_invalid")
  }
  const { decision, parsedArtifact, workpack, methodRegistrationResult } = input
  if (decision.sourceId !== workpack.sourceId
    || decision.sourceId !== parsedArtifact.sourceId
    || decision.sourceId !== methodRegistrationResult.sourceId
    || decision.artifactSha256 !== workpack.artifactSha256
    || decision.artifactSha256 !== parsedArtifact.artifactSha256
    || decision.workpackPayloadSha256 !== workpack.workpackSha256
    || decision.workpackFileSha256 !== input.workpackFileSha256
    || decision.methodRegistrationResultSha256 !== methodRegistrationResult.resultSha256
    || decision.methodRegistrationResultFileSha256
      !== input.methodRegistrationResultFileSha256
    || workpack.passageLicenseDecision !== "cleared"
    || parsedArtifact.artifactId !== workpack.artifactId
    || parsedArtifact.parsedContentSha256 !== workpack.parsedContentSha256) {
    throw new Error("candidate_passage_input_binding_mismatch")
  }
  const appraisal = methodRegistrationResult.appraisal
  const allowedEvidence = ALLOWED_EVIDENCE_TYPES[appraisal.studyDesign] ?? []
  const workpackParagraphs = new Map(workpack.paragraphs.map((paragraph) => [
    paragraph.paragraphId,
    paragraph,
  ]))
  const parsedParagraphs = new Map(parsedArtifact.paragraphs.map((paragraph) => [
    paragraph.paragraphId,
    paragraph,
  ]))
  for (const selection of decision.passages) {
    if (!allowedAgeScope(appraisal.ageScope, selection.ageScope)) {
      throw new Error("candidate_passage_age_scope_exceeds_appraisal")
    }
    if (!allowedEvidence.includes(selection.evidenceType)) {
      throw new Error("candidate_passage_evidence_type_exceeds_appraisal")
    }
    for (const paragraphId of selection.paragraphIds) {
      const workpackParagraph = workpackParagraphs.get(paragraphId)
      const parsedParagraph = parsedParagraphs.get(paragraphId)
      if (!workpackParagraph || !parsedParagraph
        || stableJson(workpackParagraph) !== stableJson(parsedParagraph)) {
        throw new Error("candidate_passage_paragraph_binding_mismatch")
      }
    }
  }
  const approvalRecords: DnaEvidenceTrustRecord[] = []
  const approvals = decision.passages.map((selection) => {
    const licenseApproval: DnaPassageLicenseApproval = Object.freeze({
      status: "approved",
      sourceId: decision.sourceId,
      artifactSha256: decision.artifactSha256,
      component: "passage",
      licenseRecordId: `license:${selection.passageId}`,
      evidenceSha256: workpack.passageLicenseDecisionSha256,
      extractionAllowed: true,
      thirdPartyMaterialExcluded: true,
    })
    const metadataApproval: DnaPassageMetadataApproval = Object.freeze({
      reviewId: `metadata:${selection.passageId}`,
      reviewedAt: decision.reviewedAt,
      evidenceSha256: decision.decisionSha256,
      ageScopeApproved: true,
      evidenceTypeApproved: true,
      claimBoundaryApproved: true,
    })
    approvalRecords.push({
      kind: "passage_license_approval",
      recordId: licenseApproval.licenseRecordId,
      sourceId: decision.sourceId,
      artifactSha256: decision.artifactSha256,
      subjectSha256: commitDnaEvidenceSubject(licenseApproval),
    }, {
      kind: "passage_metadata_approval",
      recordId: metadataApproval.reviewId,
      sourceId: decision.sourceId,
      artifactSha256: decision.artifactSha256,
      subjectSha256: commitDnaEvidenceSubject(metadataApproval),
    })
    return { selection, licenseApproval, metadataApproval }
  })
  const approvalRegistry = createDnaEvidenceTrustRegistry({
    registryId: `candidate.approvals:${decision.sourceId}`,
    authority: "candidate_audit",
    records: approvalRecords,
  })
  const passages = approvals.map(({ selection, licenseApproval, metadataApproval }) =>
    createDnaCandidateSourcePassage({
      id: selection.passageId,
      parsedArtifact,
      paragraphIds: selection.paragraphIds,
      ageScope: selection.ageScope,
      evidenceType: selection.evidenceType,
      claimBoundary: selection.claimBoundary,
      licenseApproval,
      metadataApproval,
      trustRegistry: approvalRegistry,
    }))
  if (!validateDnaPassageSet(passages).ok) {
    throw new Error("candidate_passage_compiled_overlap")
  }
  const candidateTrustRegistry = createDnaEvidenceTrustRegistry({
    registryId: `candidate.passages:${decision.sourceId}`,
    authority: "candidate_audit",
    records: [
      ...approvalRecords,
      ...passages.map((passage): DnaEvidenceTrustRecord => ({
        kind: "passage",
        recordId: passage.id,
        sourceId: passage.sourceId,
        artifactSha256: passage.artifactSha256,
        subjectSha256: passage.provenanceSha256,
      })),
    ],
  })
  const payload = {
    schemaVersion: DNA_CANDIDATE_PASSAGE_RESULT_VERSION,
    sourceId: decision.sourceId,
    artifactSha256: decision.artifactSha256,
    decisionSha256: decision.decisionSha256,
    methodRegistrationResultSha256: methodRegistrationResult.resultSha256,
    passages,
    candidateTrustRegistry,
    runtimeEligible: false as const,
    releaseEligible: false as const,
  }
  return Object.freeze({
    ...payload,
    resultSha256: hashDnaCandidatePassagePayload(payload),
  })
}

export function mergeDnaCandidatePassageRegistries(
  results: readonly DnaCandidatePassageRegistrationResult[],
) {
  if (results.some((result) => !isDnaCandidatePassageRegistrationResultValid(result))) {
    throw new Error("candidate_passage_merge_invalid_result")
  }
  const sourceIds = results.map((result) => result.sourceId)
  const passageIds = results.flatMap((result) => result.passages.map((passage) => passage.id))
  const trustRecordIds = results.flatMap((result) =>
    result.candidateTrustRegistry.records.map((record) => `${record.kind}:${record.recordId}`))
  if (new Set(sourceIds).size !== sourceIds.length
    || new Set(passageIds).size !== passageIds.length
    || new Set(trustRecordIds).size !== trustRecordIds.length) {
    throw new Error("candidate_passage_merge_duplicate_identity")
  }
  return createDnaEvidenceTrustRegistry({
    registryId: "candidate.passages:global:v1",
    authority: "candidate_audit",
    records: results.flatMap((result) => result.candidateTrustRegistry.records),
  })
}

import assert from "node:assert/strict"
import { createHash } from "node:crypto"

import {
  DNA_AUTHORIZED_CONFLICT_SET_SHA256,
  DNA_AUTHORIZED_PUBLICATION_DIGESTS,
  DNA_AUTHORIZED_RELATIONSHIP_SHA256,
  DNA_PUBLICATION_ELIGIBILITY_CONTRACT,
  DNA_PUBLICATION_GATES,
  DNA_PUBLICATION_REVIEWER_ROLE_BY_GATE,
  DNA_RELATIONSHIP_BOUNDARY_BY_CLASSIFICATION,
  DNA_RELATIONSHIP_CLASSIFICATIONS,
  DNA_UNRESOLVED_CONFLICT_LIMITATION,
  createDnaConflictSet,
  createDnaPublicationCandidate,
  createDnaPublicationGateAttestation,
  createDnaPublicationSubject,
  createDnaRelationshipClassification,
  dnaConflictBindingsSha256,
  dnaPublicationCommitmentSha256,
  dnaPublicationGateEvidenceSha256,
  evaluateDnaPublicationEligibility,
  isDnaConflictSetIntegrityValid,
  isDnaRelationshipClassificationIntegrityValid,
  resolveDnaConflictForRuntime,
  type DnaConflictSetMember,
  type DnaPublicationGate,
} from "../src/lib/dna/chat/governance/publicationEligibility"

function hash(label: string): string {
  return createHash("sha256").update(label, "utf8").digest("hex")
}

function expectError(fn: () => unknown, code: string): void {
  assert.throws(fn, (error: unknown) =>
    error instanceof Error && error.message === code, `Beklenen hata: ${code}`)
}

const conflictMembers: readonly DnaConflictSetMember[] = [
  {
    claimId: "claim.hrv.supports",
    claimSha256: hash("claim.hrv.supports"),
    sourceId: "source.hrv.meta",
    sourceSha256: hash("source.hrv.meta"),
    direction: "supports",
    evidenceLevel: "moderate",
    conditionCodes: ["condition.resting_state"],
  },
  {
    claimId: "claim.hrv.opposes",
    claimSha256: hash("claim.hrv.opposes"),
    sourceId: "source.hrv.review",
    sourceSha256: hash("source.hrv.review"),
    direction: "opposes",
    evidenceLevel: "low",
    conditionCodes: ["condition.task_context"],
  },
]

const conflictSet = createDnaConflictSet({
  conflictSetId: "conflict.hrv.context",
  topicId: "topic.hrv",
  resolution: "unresolved",
  strongerClaimId: null,
  members: conflictMembers,
  conditionCodes: ["condition.resting_state", "condition.task_context"],
  unknownCodes: ["unknown.individual_transfer"],
  overallEvidenceLevel: "low",
  sourceCutoffDate: "2026-07-19",
})

assert.equal(isDnaConflictSetIntegrityValid(conflictSet), true)
assert.ok(Object.isFrozen(conflictSet) && Object.isFrozen(conflictSet.members))
assert.deepEqual(
  createDnaConflictSet({
    conflictSetId: "conflict.hrv.context",
    topicId: "topic.hrv",
    resolution: "unresolved",
    strongerClaimId: null,
    members: [...conflictMembers].reverse(),
    conditionCodes: ["condition.task_context", "condition.resting_state"],
    unknownCodes: ["unknown.individual_transfer"],
    overallEvidenceLevel: "low",
    sourceCutoffDate: "2026-07-19",
  }),
  conflictSet,
  "Çelişki kümesi girdi sırasından bağımsız deterministik olmalı",
)
assert.equal(isDnaConflictSetIntegrityValid({
  ...conflictSet,
  overallEvidenceLevel: "high",
}), false)
assert.equal(isDnaConflictSetIntegrityValid({ ...conflictSet, injected: true }), false)
expectError(() => createDnaConflictSet({
  conflictSetId: "conflict.invalid.single",
  topicId: "topic.hrv",
  resolution: "unresolved",
  strongerClaimId: null,
  members: [conflictMembers[0]!],
  conditionCodes: ["condition.resting_state", "condition.task_context"],
  unknownCodes: ["unknown.replication"],
  overallEvidenceLevel: "low",
  sourceCutoffDate: "2026-07-19",
}), "dna_publication_conflict_requires_multiple_members")
expectError(() => createDnaConflictSet({
  conflictSetId: "conflict.invalid.same_direction",
  topicId: "topic.hrv",
  resolution: "unresolved",
  strongerClaimId: null,
  members: conflictMembers.map((member) => ({ ...member, direction: "supports" })),
  conditionCodes: ["condition.resting_state"],
  unknownCodes: ["unknown.replication"],
  overallEvidenceLevel: "low",
  sourceCutoffDate: "2026-07-19",
}), "dna_publication_conflict_directions_not_distinct")
expectError(() => createDnaConflictSet({
  conflictSetId: "conflict.invalid.selected",
  topicId: "topic.hrv",
  resolution: "unresolved",
  strongerClaimId: conflictMembers[0]!.claimId,
  members: conflictMembers,
  conditionCodes: ["condition.resting_state"],
  unknownCodes: ["unknown.replication"],
  overallEvidenceLevel: "low",
  sourceCutoffDate: "2026-07-19",
}), "dna_publication_unresolved_conflict_cannot_select_claim")
expectError(() => createDnaConflictSet({
  conflictSetId: "conflict.invalid.date",
  topicId: "topic.hrv",
  resolution: "unresolved",
  strongerClaimId: null,
  members: conflictMembers,
  conditionCodes: ["condition.resting_state", "condition.task_context"],
  unknownCodes: ["unknown.replication"],
  overallEvidenceLevel: "low",
  sourceCutoffDate: "2026-02-30",
}), "dna_publication_invalid_conflict_source_cutoff_date")

const unavailableConflict = resolveDnaConflictForRuntime(conflictSet)
assert.deepEqual(unavailableConflict, {
  status: "not_available",
  conflictSetId: null,
  strongerClaimId: null,
  counterClaimIds: [],
  evidenceLevel: null,
  conditionCodes: [],
  unknownCodes: [],
  limitation: null,
}, "Yetkisiz aday çelişki içeriği çalışma zamanına sızmamalı")
assert.equal(DNA_UNRESOLVED_CONFLICT_LIMITATION,
  "Bulgular tutarlı değildir; bu nedenle bireysel vaka için kesin sonuç çıkarılamaz.")

assert.deepEqual(DNA_RELATIONSHIP_CLASSIFICATIONS, [
  "product_definition",
  "supported_relation",
  "conceptual_proximity",
  "theory_only",
  "not_established",
  "contradicted",
  "not_applicable",
])
assert.equal((DNA_RELATIONSHIP_CLASSIFICATIONS as readonly string[])
  .includes("direct_relation"), false)

const relationship = createDnaRelationshipClassification({
  relationshipId: "relationship.hrv.dna.regulation",
  dnaTopicId: "dna.topic.regulation",
  classification: "supported_relation",
  authority: "external_scientific_information",
  boundaryCode: DNA_RELATIONSHIP_BOUNDARY_BY_CLASSIFICATION.supported_relation,
  externalClaimId: "claim.hrv.supports",
  externalClaimSha256: hash("claim.hrv.supports"),
  explicitRelationClaimId: "relation.hrv.regulation",
  explicitRelationClaimSha256: hash("relation.hrv.regulation"),
  ownerPassageId: null,
  ownerPassageSha256: null,
  supportPassageIds: ["passage.hrv.001"],
  supportPassageSha256: [hash("passage.hrv.001")],
})
assert.equal(isDnaRelationshipClassificationIntegrityValid(relationship), true)
assert.equal(relationship.boundaryCode,
  "explicit_single_step_relation_not_product_validation")
assert.equal(isDnaRelationshipClassificationIntegrityValid({
  ...relationship,
  classification: "product_definition",
}), false)
assert.equal(isDnaRelationshipClassificationIntegrityValid({
  ...relationship,
  extraAuthorization: true,
}), false)

expectError(() => createDnaRelationshipClassification({
  relationshipId: "relationship.invalid.boundary",
  dnaTopicId: "dna.topic.regulation",
  classification: "conceptual_proximity",
  authority: "external_scientific_information",
  boundaryCode: "explicit_single_step_relation_not_product_validation",
  externalClaimId: "claim.hrv.supports",
  externalClaimSha256: hash("claim.hrv.supports"),
  explicitRelationClaimId: "relation.hrv.regulation",
  explicitRelationClaimSha256: hash("relation.hrv.regulation"),
  ownerPassageId: null,
  ownerPassageSha256: null,
  supportPassageIds: ["passage.hrv.001"],
  supportPassageSha256: [hash("passage.hrv.001")],
}), "dna_publication_relationship_boundary_mismatch")

expectError(() => createDnaRelationshipClassification({
  relationshipId: "relationship.invalid.product",
  dnaTopicId: "dna.topic.regulation",
  classification: "product_definition",
  authority: "external_scientific_information",
  boundaryCode: DNA_RELATIONSHIP_BOUNDARY_BY_CLASSIFICATION.product_definition,
  externalClaimId: null,
  externalClaimSha256: null,
  explicitRelationClaimId: null,
  explicitRelationClaimSha256: null,
  ownerPassageId: "owner.passage.001",
  ownerPassageSha256: hash("owner.passage.001"),
  supportPassageIds: [],
  supportPassageSha256: [],
}), "dna_publication_relationship_authority_mismatch")

expectError(() => createDnaRelationshipClassification({
  relationshipId: "relationship.invalid.support",
  dnaTopicId: "dna.topic.regulation",
  classification: "supported_relation",
  authority: "external_scientific_information",
  boundaryCode: DNA_RELATIONSHIP_BOUNDARY_BY_CLASSIFICATION.supported_relation,
  externalClaimId: "claim.hrv.supports",
  externalClaimSha256: hash("claim.hrv.supports"),
  explicitRelationClaimId: null,
  explicitRelationClaimSha256: null,
  ownerPassageId: null,
  ownerPassageSha256: null,
  supportPassageIds: [],
  supportPassageSha256: [],
}), "dna_publication_explicit_relationship_support_required")

expectError(() => createDnaRelationshipClassification({
  relationshipId: "relationship.invalid.unestablished",
  dnaTopicId: "dna.topic.regulation",
  classification: "not_established",
  authority: "external_scientific_information",
  boundaryCode: DNA_RELATIONSHIP_BOUNDARY_BY_CLASSIFICATION.not_established,
  externalClaimId: "claim.hrv.supports",
  externalClaimSha256: hash("claim.hrv.supports"),
  explicitRelationClaimId: "relation.hrv.regulation",
  explicitRelationClaimSha256: hash("relation.hrv.regulation"),
  ownerPassageId: null,
  ownerPassageSha256: null,
  supportPassageIds: [],
  supportPassageSha256: [],
}), "dna_publication_unestablished_relationship_cannot_claim_relation")

const conflictBindingsSha256 = dnaConflictBindingsSha256([conflictSet])
const subject = createDnaPublicationSubject({
  candidateId: "publication.claim.hrv.001",
  sourceId: "source.hrv.meta",
  sourceSha256: hash("source.hrv.meta"),
  licenseSha256: hash("license.hrv.meta"),
  retractionCheckSha256: hash("retraction.hrv.meta"),
  artifactId: "artifact.hrv.meta.jats",
  artifactSha256: hash("artifact.hrv.meta.jats"),
  passageId: "passage.hrv.001",
  passageSha256: hash("passage.hrv.001"),
  locatorSha256: hash("locator.hrv.001"),
  claimId: "claim.hrv.supports",
  claimSha256: hash("claim.hrv.supports"),
  blindRunASha256: hash("blind.run.a"),
  blindRunBSha256: hash("blind.run.b"),
  reconciliationSha256: hash("reconciliation.hrv.001"),
  sourceFidelityAuditSha256: hash("source.fidelity.hrv.001"),
  methodReviewSha256: hash("method.review.hrv.001"),
  counterEvidenceAuditSha256: hash("counter.review.hrv.001"),
  safetyReviewSha256: hash("safety.review.hrv.001"),
  originalLanguage: "en",
  translationDisposition: "translated_from_non_turkish",
  turkishTextSha256: hash("turkish.text.hrv.001"),
  turkishTransferAuditSha256: hash("translation.review.hrv.001"),
  ageScope: "adult",
  population: "human",
  agePopulationAuditSha256: hash("age.population.hrv.001"),
  claimBoundarySha256: hash("claim.boundary.hrv.001"),
  relationshipId: relationship.relationshipId,
  relationshipSha256: relationship.relationshipSha256,
  conflictDisposition: "phase_25_conflict_set_required",
  conflictBindingsSha256,
})

function rebindSubject(
  base: typeof subject,
  overrides: Partial<Omit<typeof subject, "schemaVersion" | "subjectSha256">>,
) {
  const { schemaVersion: _schemaVersion, subjectSha256: _subjectSha256, ...input } = base
  return createDnaPublicationSubject({ ...input, ...overrides })
}

function attestSubject(attestedSubject: typeof subject) {
  return DNA_PUBLICATION_GATES.map((gate: DnaPublicationGate) =>
    createDnaPublicationGateAttestation({
      attestationId: `attestation.${attestedSubject.candidateId}.${gate}`,
      gate,
      reviewerRole: DNA_PUBLICATION_REVIEWER_ROLE_BY_GATE[gate],
      protocolVersion: `audit.${gate}@1`,
      subject: attestedSubject,
      attestedEvidenceSha256: dnaPublicationGateEvidenceSha256(attestedSubject, gate),
      completedAt: "2026-07-19T15:00:00.000Z",
      outcome: "passed",
    }))
}

function rawCandidate(
  rawSubject: typeof subject,
  rawRelationship: typeof relationship,
  rawConflictSets: readonly (typeof conflictSet)[],
  rawAttestations: ReturnType<typeof attestSubject>,
) {
  const core = {
    schemaVersion: DNA_PUBLICATION_ELIGIBILITY_CONTRACT.schemaVersion,
    status: "candidate_only" as const,
    runtimeEligible: false as const,
    subject: rawSubject,
    relationship: rawRelationship,
    conflictSets: rawConflictSets,
    attestations: rawAttestations,
  }
  return { ...core, publicationDigest: dnaPublicationCommitmentSha256(core) }
}

assert.ok(Object.isFrozen(subject))
expectError(() => createDnaPublicationSubject({
  ...subject,
  schemaVersion: undefined,
  subjectSha256: undefined,
  ageScope: "not_reported",
} as never), "dna_publication_age_scope_required")
expectError(() => createDnaPublicationSubject({
  ...subject,
  schemaVersion: undefined,
  subjectSha256: undefined,
  blindRunBSha256: subject.blindRunASha256,
} as never), "dna_publication_blind_runs_not_independent")
expectError(() => createDnaPublicationSubject({
  ...subject,
  schemaVersion: undefined,
  subjectSha256: undefined,
  originalLanguage: "tr",
  translationDisposition: "translated_from_non_turkish",
} as never), "dna_publication_translation_disposition_mismatch")

const attestations = attestSubject(subject)
assert.equal(attestations.length, 14)
assert.equal(new Set(attestations.map((entry) => entry.reviewerRole)).size, 14)

expectError(() => createDnaPublicationGateAttestation({
  attestationId: "attestation.invalid.role",
  gate: "source_fidelity",
  reviewerRole: "method_auditor",
  protocolVersion: "audit.source_fidelity@1",
  subject,
  attestedEvidenceSha256: subject.sourceFidelityAuditSha256,
  completedAt: "2026-07-19T15:00:00.000Z",
  outcome: "passed",
}), "dna_publication_gate_reviewer_role_mismatch")
expectError(() => createDnaPublicationGateAttestation({
  attestationId: "attestation.invalid.binding",
  gate: "source_fidelity",
  reviewerRole: "source_fidelity_auditor",
  protocolVersion: "audit.source_fidelity@1",
  subject,
  attestedEvidenceSha256: hash("unbound"),
  completedAt: "2026-07-19T15:00:00.000Z",
  outcome: "passed",
}), "dna_publication_gate_evidence_binding_mismatch")

const candidate = createDnaPublicationCandidate({
  subject,
  relationship,
  conflictSets: [conflictSet],
  attestations,
})
const candidateAgain = createDnaPublicationCandidate({
  subject,
  relationship,
  conflictSets: [conflictSet],
  attestations: [...attestations].reverse(),
})
assert.deepEqual(candidateAgain, candidate)
assert.ok(Object.isFrozen(candidate) && Object.isFrozen(candidate.attestations))

const decision = evaluateDnaPublicationEligibility(candidate)
assert.equal(decision.gateCount, 14)
assert.equal(decision.passedGateCount, 14)
assert.equal(decision.preauthorizationEligible, false)
assert.equal(decision.releaseEligible, false)
assert.deepEqual(decision.blockCodes, [
  "relationship_not_authorized",
  "conflict_set_not_authorized",
  "unresolved_conflict",
  "candidate_not_in_publication_registry",
])
assert.equal(DNA_AUTHORIZED_CONFLICT_SET_SHA256.length, 0)
assert.equal(DNA_AUTHORIZED_RELATIONSHIP_SHA256.length, 0)
assert.equal(DNA_AUTHORIZED_PUBLICATION_DIGESTS.length, 0)
assert.ok(decision.blockCodes.includes("conflict_set_not_authorized"),
  "Çözümlenmemiş çelişki yetkili küme olmadan çalışma zamanına geçmemeli")

const nonConflictSubject = rebindSubject(subject, {
  conflictDisposition: "none_identified",
  conflictBindingsSha256: dnaConflictBindingsSha256([]),
})
const nonConflictAttestations = attestSubject(nonConflictSubject)
const nonConflictCandidate = createDnaPublicationCandidate({
  subject: nonConflictSubject,
  relationship,
  conflictSets: [],
  attestations: nonConflictAttestations,
})
assert.equal(evaluateDnaPublicationEligibility(nonConflictCandidate).blockCodes
  .includes("conflict_set_not_authorized"), false,
"Çelişkisiz bir iddia boş çelişki kümesiyle aday olabilmeli")

expectError(() => rebindSubject(nonConflictSubject, {
  conflictDisposition: "phase_25_conflict_set_required",
}), "dna_publication_conflict_disposition_binding_mismatch")
expectError(() => rebindSubject(subject, {
  conflictDisposition: "none_identified",
}), "dna_publication_conflict_disposition_binding_mismatch")

const unrelatedExternalRelationship = createDnaRelationshipClassification({
  relationshipId: "relationship.hrv.dna.unrelated",
  dnaTopicId: "dna.topic.regulation",
  classification: "supported_relation",
  authority: "external_scientific_information",
  boundaryCode: DNA_RELATIONSHIP_BOUNDARY_BY_CLASSIFICATION.supported_relation,
  externalClaimId: "claim.unrelated.external",
  externalClaimSha256: hash("claim.unrelated.external"),
  explicitRelationClaimId: "relation.hrv.regulation",
  explicitRelationClaimSha256: hash("relation.hrv.regulation"),
  ownerPassageId: null,
  ownerPassageSha256: null,
  supportPassageIds: ["passage.hrv.001"],
  supportPassageSha256: [hash("passage.hrv.001")],
})
const externalReplaySubject = rebindSubject(nonConflictSubject, {
  relationshipId: unrelatedExternalRelationship.relationshipId,
  relationshipSha256: unrelatedExternalRelationship.relationshipSha256,
})
const externalReplayAttestations = attestSubject(externalReplaySubject)
expectError(() => createDnaPublicationCandidate({
  subject: externalReplaySubject,
  relationship: unrelatedExternalRelationship,
  conflictSets: [],
  attestations: externalReplayAttestations,
}), "dna_publication_relationship_binding_invalid")
const externalReplayDecision = evaluateDnaPublicationEligibility(rawCandidate(
  externalReplaySubject,
  unrelatedExternalRelationship,
  [],
  externalReplayAttestations,
))
assert.ok(externalReplayDecision.blockCodes.includes("relationship_invalid"),
  "Başka iddianın dış ilişki kaydı geçerli hash ile dahi yeniden oynatılamamalı")

const unrelatedProductRelationship = createDnaRelationshipClassification({
  relationshipId: "relationship.product.unrelated",
  dnaTopicId: "dna.topic.regulation",
  classification: "product_definition",
  authority: "dna_product_information",
  boundaryCode: DNA_RELATIONSHIP_BOUNDARY_BY_CLASSIFICATION.product_definition,
  externalClaimId: null,
  externalClaimSha256: null,
  explicitRelationClaimId: null,
  explicitRelationClaimSha256: null,
  ownerPassageId: "owner.passage.unrelated",
  ownerPassageSha256: hash("owner.passage.unrelated"),
  supportPassageIds: [],
  supportPassageSha256: [],
})
const productReplaySubject = rebindSubject(nonConflictSubject, {
  relationshipId: unrelatedProductRelationship.relationshipId,
  relationshipSha256: unrelatedProductRelationship.relationshipSha256,
})
const productReplayAttestations = attestSubject(productReplaySubject)
expectError(() => createDnaPublicationCandidate({
  subject: productReplaySubject,
  relationship: unrelatedProductRelationship,
  conflictSets: [],
  attestations: productReplayAttestations,
}), "dna_publication_relationship_binding_invalid")
assert.ok(evaluateDnaPublicationEligibility(rawCandidate(
  productReplaySubject,
  unrelatedProductRelationship,
  [],
  productReplayAttestations,
)).blockCodes.includes("relationship_invalid"),
"Başka owner pasajının ürün tanımı yeniden oynatılamamalı")

const boundProductRelationship = createDnaRelationshipClassification({
  relationshipId: "relationship.product.bound",
  dnaTopicId: "dna.topic.regulation",
  classification: "product_definition",
  authority: "dna_product_information",
  boundaryCode: DNA_RELATIONSHIP_BOUNDARY_BY_CLASSIFICATION.product_definition,
  externalClaimId: null,
  externalClaimSha256: null,
  explicitRelationClaimId: null,
  explicitRelationClaimSha256: null,
  ownerPassageId: nonConflictSubject.passageId,
  ownerPassageSha256: nonConflictSubject.passageSha256,
  supportPassageIds: [],
  supportPassageSha256: [],
})
const boundProductSubject = rebindSubject(nonConflictSubject, {
  relationshipId: boundProductRelationship.relationshipId,
  relationshipSha256: boundProductRelationship.relationshipSha256,
})
assert.doesNotThrow(() => createDnaPublicationCandidate({
  subject: boundProductSubject,
  relationship: boundProductRelationship,
  conflictSets: [],
  attestations: attestSubject(boundProductSubject),
}))

const unrelatedConflictSet = createDnaConflictSet({
  conflictSetId: "conflict.unrelated.replay",
  topicId: "topic.hrv",
  resolution: "unresolved",
  strongerClaimId: null,
  members: [
    {
      ...conflictMembers[0]!,
      claimId: "claim.unrelated.supports",
      claimSha256: hash("claim.unrelated.supports"),
    },
    {
      ...conflictMembers[1]!,
      claimId: "claim.unrelated.opposes",
      claimSha256: hash("claim.unrelated.opposes"),
    },
  ],
  conditionCodes: ["condition.resting_state", "condition.task_context"],
  unknownCodes: ["unknown.individual_transfer"],
  overallEvidenceLevel: "low",
  sourceCutoffDate: "2026-07-19",
})
const conflictReplaySubject = rebindSubject(subject, {
  conflictBindingsSha256: dnaConflictBindingsSha256([unrelatedConflictSet]),
})
const conflictReplayAttestations = attestSubject(conflictReplaySubject)
expectError(() => createDnaPublicationCandidate({
  subject: conflictReplaySubject,
  relationship,
  conflictSets: [unrelatedConflictSet],
  attestations: conflictReplayAttestations,
}), "dna_publication_conflict_subject_binding_invalid")
assert.ok(evaluateDnaPublicationEligibility(rawCandidate(
  conflictReplaySubject,
  relationship,
  [unrelatedConflictSet],
  conflictReplayAttestations,
)).blockCodes.includes("conflict_set_invalid"),
"İlgisiz bir çelişki kümesi geçerli hash ile dahi başka iddiada oynatılamamalı")

const missingGateCandidate = createDnaPublicationCandidate({
  subject,
  relationship,
  conflictSets: [conflictSet],
  attestations: attestations.filter((attestation) => attestation.gate !== "safety_review"),
})
const missingGateDecision = evaluateDnaPublicationEligibility(missingGateCandidate)
assert.equal(missingGateDecision.passedGateCount, 13)
assert.equal(missingGateDecision.preauthorizationEligible, false)
assert.ok(missingGateDecision.blockCodes.includes("missing_gate"))

const duplicateGateCandidate = createDnaPublicationCandidate({
  subject,
  relationship,
  conflictSets: [conflictSet],
  attestations: [...attestations, attestations[0]!],
})
const duplicateDecision = evaluateDnaPublicationEligibility(duplicateGateCandidate)
assert.equal(duplicateDecision.preauthorizationEligible, false)
assert.ok(duplicateDecision.blockCodes.includes("duplicate_gate"))

const tamperedAttestation = {
  ...attestations[0]!,
  attestedEvidenceSha256: hash("tampered-evidence"),
}
const tamperedCandidate = {
  ...candidate,
  attestations: [tamperedAttestation, ...candidate.attestations.slice(1)],
}
const tamperedDecision = evaluateDnaPublicationEligibility(tamperedCandidate)
assert.equal(tamperedDecision.releaseEligible, false)
assert.ok(tamperedDecision.blockCodes.includes("gate_attestation_invalid"))
assert.ok(tamperedDecision.blockCodes.includes("publication_digest_mismatch"))

const injectedCandidateDecision = evaluateDnaPublicationEligibility({
  ...candidate,
  callerAuthorized: true,
})
assert.equal(injectedCandidateDecision.releaseEligible, false)
assert.ok(injectedCandidateDecision.blockCodes.includes("invalid_candidate"))

const malformedDecision = evaluateDnaPublicationEligibility({
  schemaVersion: DNA_PUBLICATION_ELIGIBILITY_CONTRACT.schemaVersion,
  status: "candidate_only",
  runtimeEligible: false,
  subject: "forged",
  relationship: null,
  conflictSets: "forged",
  attestations: "forged",
  publicationDigest: hash("forged"),
})
assert.equal(malformedDecision.releaseEligible, false)
assert.ok(malformedDecision.blockCodes.includes("invalid_candidate"))

const nullAttestationDecision = evaluateDnaPublicationEligibility({
  ...candidate,
  attestations: [null],
})
assert.equal(nullAttestationDecision.releaseEligible, false)
assert.ok(nullAttestationDecision.blockCodes.includes("missing_gate"))
assert.ok(nullAttestationDecision.blockCodes.includes("gate_attestation_invalid"))

expectError(() => createDnaPublicationCandidate({
  subject: { ...subject, conflictBindingsSha256: hash("different") },
  relationship,
  conflictSets: [conflictSet],
  attestations,
}), "dna_publication_invalid_subject")

assert.equal(DNA_PUBLICATION_ELIGIBILITY_CONTRACT.productionConflictSetCount, 0)
assert.equal(DNA_PUBLICATION_ELIGIBILITY_CONTRACT.productionRelationshipCount, 0)
assert.equal(DNA_PUBLICATION_ELIGIBILITY_CONTRACT.productionPublicationCount, 0)
assert.equal(DNA_PUBLICATION_ELIGIBILITY_CONTRACT.safetyPolicy, "fail_closed")

console.log(JSON.stringify({
  ok: true,
  phaseRange: "25-27",
  conflictSetIntegrityCases: 8,
  relationshipClassificationCases: 8,
  requiredPublicationGates: DNA_PUBLICATION_GATES.length,
  passedGateAttestations: decision.passedGateCount,
  preauthorizationEligible: decision.preauthorizationEligible,
  releaseEligible: decision.releaseEligible,
  productionRegistries: {
    conflictSets: DNA_AUTHORIZED_CONFLICT_SET_SHA256.length,
    relationships: DNA_AUTHORIZED_RELATIONSHIP_SHA256.length,
    publications: DNA_AUTHORIZED_PUBLICATION_DIGESTS.length,
  },
  unresolvedConflictLimitation: DNA_UNRESOLVED_CONFLICT_LIMITATION,
}, null, 2))

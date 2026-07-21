import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

import {
  createPendingDnaMethodAppraisal,
  hashDnaAppraisalPayload,
  isDnaMethodAppraisalEligibleForReleasePipeline,
  isDnaMethodAppraisalEligibleWithExplicitTestRegistry,
  validateDnaMethodAppraisal,
  validateDnaMethodAppraisalWithExplicitTestRegistry,
  type DnaMethodAppraisalTrustRegistry,
  type DnaMethodAppraisal,
} from "../src/lib/dna/chat/governance/methodAppraisal"
import {
  hashNormalizedDnaSourcePayload,
  isNormalizedDnaSourceRuntimeEligible,
  isNormalizedDnaSourceRuntimeEligibleWithExplicitTestRegistry,
  normalizeDnaSourceGovernanceSnapshot,
  validateNormalizedDnaSource,
  validateNormalizedDnaSourceWithExplicitTestRegistry,
  type DnaNormalizedSourceReleaseTrustRegistry,
  type DnaSourceGovernanceSnapshotForNormalization,
  type NormalizedDnaSource,
} from "../src/lib/dna/chat/governance/normalizedSource"

const SOURCE_SNAPSHOT_PATH = resolve(
  process.cwd(),
  "docs/dna-intelligence/governance/v3/source-library-governance-snapshot.json",
)
const APPRAISAL_SNAPSHOT_PATH = resolve(
  process.cwd(),
  "docs/dna-intelligence/governance/v3/source-appraisal-normalization-snapshot.json",
)

function sha256Bytes(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex")
}

function withRecomputedSourceHash(
  source: Omit<NormalizedDnaSource, "sourcePayloadSha256"> & { readonly sourcePayloadSha256?: string },
): NormalizedDnaSource {
  const { sourcePayloadSha256: _discard, ...payload } = source
  return {
    ...payload,
    sourcePayloadSha256: hashNormalizedDnaSourcePayload(payload),
  } as NormalizedDnaSource
}

function withRecomputedAppraisalHash(
  appraisal: Omit<DnaMethodAppraisal, "appraisalPayloadSha256"> & {
    readonly appraisalPayloadSha256?: string
  },
): DnaMethodAppraisal {
  const { appraisalPayloadSha256: _discard, ...payload } = appraisal
  return {
    ...payload,
    appraisalPayloadSha256: hashDnaAppraisalPayload(payload),
  } as DnaMethodAppraisal
}

function countBy<T>(values: readonly T[], key: (value: T) => string): Record<string, number> {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(key(value), (counts.get(key(value)) ?? 0) + 1)
  return Object.fromEntries([...counts].sort(([left], [right]) => left.localeCompare(right)))
}

const sourceSnapshotBytes = readFileSync(SOURCE_SNAPSHOT_PATH)
const rawSnapshot = JSON.parse(sourceSnapshotBytes.toString("utf8")) as
  DnaSourceGovernanceSnapshotForNormalization & { readonly snapshotBasisAt?: string }
const normalized = normalizeDnaSourceGovernanceSnapshot(rawSnapshot)

assert.equal(normalized.sourceCount, 47, "Mevcut yönetişim snapshot'ındaki 47 kaynak normalize edilmeli")
assert.equal(normalized.sources.length, 47)
assert.equal(new Set(normalized.sources.map((source) => source.id)).size, 47)
assert.deepEqual(
  normalized.sources.map((source) => source.id),
  [...normalized.sources.map((source) => source.id)].sort(),
  "Kanonik sıra sourceId olmalı",
)
assert.equal(normalized.methodAppraisalPendingCount, 47)
assert.equal(normalized.runtimeEligibleCount, 0)
assert.equal(normalized.missingAgeScopeCount, 47)
assert.equal(normalized.missingPopulationCount, 5)

for (const source of normalized.sources) {
  const validation = validateNormalizedDnaSource(source)
  assert.equal(validation.ok, true, `${source.id}: ${validation.errors.join(",")}`)
  assert.equal(source.reviewStatus, "method_appraisal_pending")
  assert.equal(source.runtimeEligibility, "blocked_pending_method_appraisal")
  assert.equal(source.studyDesign, "not_assessed")
  assert.equal(source.evidenceLevel, "not_assessed")
  assert.equal(source.claimBoundary, "not_assessed")
  assert.equal(source.integrityStatus, "not_assessed")
  assert.match(source.identityEvidenceSha256, /^[a-f0-9]{64}$/)
  assert.match(source.identityVerifiedAt, /^\d{4}-\d{2}-\d{2}$/)
  assert.ok(["verified", "pending", "mismatch"].includes(source.identityVerificationStatus))
  assert.equal(source.canonicalCategories[0], "not_assessed")
  assert.equal(source.artifactHashes.length, 0, "Evidence hash'i artifact hash'i diye yeniden etiketlenmemeli")
  assert.equal(isNormalizedDnaSourceRuntimeEligible(source), false)
  assert.match(source.evidencePayloadSha256, /^[a-f0-9]{64}$/)
  assert.match(source.sourcePayloadSha256, /^[a-f0-9]{64}$/)
}

const pendingAppraisals = normalized.sources.map((source) => createPendingDnaMethodAppraisal({
  sourceId: source.id,
  sourceEvidencePayloadSha256: source.evidencePayloadSha256,
}))
assert.equal(pendingAppraisals.length, 47)
assert.equal(new Set(pendingAppraisals.map((appraisal) => appraisal.appraisalPayloadSha256)).size, 47)
for (const appraisal of pendingAppraisals) {
  const validation = validateDnaMethodAppraisal(appraisal)
  assert.equal(validation.ok, true, `${appraisal.sourceId}: ${validation.errors.join(",")}`)
  assert.equal(appraisal.bodyOfEvidenceCertainty, "not_assessed")
  assert.equal(appraisal.adaptedGradeDimensions.inconsistency, "not_assessed")
  assert.equal(appraisal.adaptedGradeDimensions.publicationBias, "not_assessed")
  assert.equal(isDnaMethodAppraisalEligibleForReleasePipeline(appraisal), false)
}

// Unknowns are explicit. Removing population/age does not become an inferred
// default; it is structurally invalid.
const missingScope = { ...normalized.sources[0] } as Record<string, unknown>
delete missingScope.population
delete missingScope.ageScope
const missingScopeValidation = validateNormalizedDnaSource(missingScope)
assert.equal(missingScopeValidation.ok, false)
assert.ok(missingScopeValidation.errors.includes("source:missing_field:population"))
assert.ok(missingScopeValidation.errors.includes("source:missing_field:ageScope"))

// A caller cannot smuggle a made-up quality label into either contract.
const maliciousHighQuality = withRecomputedSourceHash({
  ...normalized.sources[0],
  evidenceLevel: "high_quality" as never,
})
const maliciousHighQualityValidation = validateNormalizedDnaSource(maliciousHighQuality)
assert.equal(maliciousHighQualityValidation.ok, false)
assert.ok(maliciousHighQualityValidation.errors.includes("source:invalid_evidence_level"))

const appraisalWithInjectedScore = {
  ...pendingAppraisals[0],
  overallQuality: "high",
}
const injectedScoreValidation = validateDnaMethodAppraisal(appraisalWithInjectedScore)
assert.equal(injectedScoreValidation.ok, false)
assert.ok(injectedScoreValidation.errors.includes("appraisal:unexpected_field:overallQuality"))

const forgedBodyCertainty = {
  ...pendingAppraisals[0],
  bodyOfEvidenceCertainty: "high",
}
const bodyCertaintyValidation = validateDnaMethodAppraisal(forgedBodyCertainty)
assert.equal(bodyCertaintyValidation.ok, false)
assert.ok(bodyCertaintyValidation.errors.includes("appraisal:single_source_cannot_assert_body_certainty"))

const pendingWithAssertedMethods = withRecomputedAppraisalHash({
  ...pendingAppraisals[0],
  studyDesign: "randomized_controlled_trial",
  sampleSize: { reporting: "reported", total: 999 },
  population: "human",
  ageScope: "adult",
  randomization: "adequate",
})
const pendingWithAssertedMethodsValidation = validateDnaMethodAppraisal(
  pendingWithAssertedMethods,
)
assert.equal(pendingWithAssertedMethodsValidation.ok, false)
assert.ok(pendingWithAssertedMethodsValidation.errors.includes(
  "appraisal:pending_record_asserts_study_design",
))
assert.ok(pendingWithAssertedMethodsValidation.errors.includes(
  "appraisal:pending_record_asserts_sample_size",
))
assert.ok(pendingWithAssertedMethodsValidation.errors.includes(
  "appraisal:pending_record_asserts_population",
))

const malformedAuditedAppraisal = {
  ...pendingAppraisals[0],
  reviewStatus: "codex_multi_pass_audited",
  reviewPasses: { claimed: "complete" },
  evidenceRefs: [{ artifactSha256: "x", contentSha256: "y", locator: 42 }],
}
assert.doesNotThrow(() => validateDnaMethodAppraisal(malformedAuditedAppraisal))
const malformedAuditedValidation = validateDnaMethodAppraisal(malformedAuditedAppraisal)
assert.equal(malformedAuditedValidation.ok, false)
assert.ok(malformedAuditedValidation.errors.includes("appraisal:invalid_review_passes"))
assert.ok(malformedAuditedValidation.errors.includes("evidence_ref_0:invalid_locator"))

const nullPassAppraisal = {
  ...pendingAppraisals[0],
  reviewStatus: "codex_multi_pass_audited",
  reviewPasses: [null],
}
assert.doesNotThrow(() => validateDnaMethodAppraisal(nullPassAppraisal),
  "Malformed review pass validator'ı çöktürmemeli")
const nullPassValidation = validateDnaMethodAppraisal(nullPassAppraisal)
assert.equal(nullPassValidation.ok, false)
assert.ok(nullPassValidation.errors.includes("review_pass_0:invalid_object"))
assert.ok(nullPassValidation.errors.includes("appraisal:missing_multi_pass_audit"))

const selfAssertedAuditedAppraisal = withRecomputedAppraisalHash({
  ...pendingAppraisals[0],
  studyDesign: "randomized_controlled_trial",
  sampleSize: { reporting: "reported", total: 100 },
  population: "human",
  ageScope: "adult",
  inclusionCriteria: "adequately_reported",
  exclusionCriteria: "adequately_reported",
  measures: "validated_or_reference_standard",
  blinding: "adequate",
  randomization: "adequate",
  missingData: "addressed_with_sensitivity_analysis",
  confounding: "adequately_addressed",
  multiplicity: "controlled",
  effectSize: "reported",
  confidenceInterval: "reported",
  preregistration: "prospective_verified",
  reproducibility: "materials_data_and_code_available",
  funding: "reported_noncommercial",
  conflictOfInterest: "reported_no_conflict",
  generalizability: "direct_to_target_population",
  causalBoundary: "causal_inference_limited_to_design",
  adaptedGradeDimensions: {
    riskOfBias: "no_serious_concern",
    inconsistency: "not_assessed",
    indirectness: "no_serious_concern",
    imprecision: "no_serious_concern",
    publicationBias: "not_assessed",
  },
  evidenceRefs: [{
    artifactSha256: "a".repeat(64),
    contentSha256: "b".repeat(64),
    locator: "methods/participants",
  }],
  reviewPasses: [
    {
      passId: "pass:blind:a",
      protocolVersion: "dna-method-appraisal-protocol@1",
      reviewerRole: "method_appraisal_a",
      completedAt: "2026-07-19T12:00:00.000Z",
      evidenceSha256: "c".repeat(64),
    },
    {
      passId: "pass:blind:b",
      protocolVersion: "dna-method-appraisal-protocol@1",
      reviewerRole: "method_appraisal_b",
      completedAt: "2026-07-19T12:01:00.000Z",
      evidenceSha256: "d".repeat(64),
    },
    {
      passId: "pass:method:reconciliation",
      protocolVersion: "dna-method-appraisal-protocol@1",
      reviewerRole: "method_appraisal_reconciliation",
      completedAt: "2026-07-19T12:02:00.000Z",
      evidenceSha256: "e".repeat(64),
    },
  ],
  reviewStatus: "codex_multi_pass_audited",
  disposition: "eligible_for_body_synthesis_with_limits",
  limitations: ["single_source_not_body_certainty"],
})
const selfAssertedAppraisalValidation = validateDnaMethodAppraisal(selfAssertedAuditedAppraisal)
assert.equal(selfAssertedAppraisalValidation.ok, false)
assert.ok(selfAssertedAppraisalValidation.errors.includes("appraisal:audited_payload_not_registered"))
assert.ok(selfAssertedAppraisalValidation.errors.includes("appraisal:evidence_refs_not_trusted"))
assert.ok(selfAssertedAppraisalValidation.errors.includes(
  "appraisal:review_pass_evidence_not_trusted",
))
assert.equal(isDnaMethodAppraisalEligibleForReleasePipeline(selfAssertedAuditedAppraisal), false)

const explicitMethodTrustRegistry: DnaMethodAppraisalTrustRegistry = Object.freeze({
  registryKind: "explicit_test_only",
  evidenceRefs: Object.freeze(selfAssertedAuditedAppraisal.evidenceRefs.map((ref) => ({
    ...ref,
    sourceId: selfAssertedAuditedAppraisal.sourceId,
    sourceEvidencePayloadSha256: selfAssertedAuditedAppraisal.sourceEvidencePayloadSha256,
  }))),
  passEvidence: Object.freeze(selfAssertedAuditedAppraisal.reviewPasses.map((pass) => ({
    appraisalId: selfAssertedAuditedAppraisal.id,
    passId: pass.passId,
    reviewerRole: pass.reviewerRole,
    evidenceSha256: pass.evidenceSha256,
  }))),
  appraisals: Object.freeze([{
    appraisalId: selfAssertedAuditedAppraisal.id,
    sourceId: selfAssertedAuditedAppraisal.sourceId,
    sourceEvidencePayloadSha256: selfAssertedAuditedAppraisal.sourceEvidencePayloadSha256,
    appraisalPayloadSha256: selfAssertedAuditedAppraisal.appraisalPayloadSha256,
  }]),
})
const explicitlyTrustedAppraisalValidation = validateDnaMethodAppraisalWithExplicitTestRegistry(
  selfAssertedAuditedAppraisal,
  explicitMethodTrustRegistry,
)
assert.equal(explicitlyTrustedAppraisalValidation.ok, true,
  explicitlyTrustedAppraisalValidation.errors.join(","))
assert.equal(isDnaMethodAppraisalEligibleWithExplicitTestRegistry(
  selfAssertedAuditedAppraisal,
  explicitMethodTrustRegistry,
), true)

const missingArtifactTrustRegistry: DnaMethodAppraisalTrustRegistry = {
  ...explicitMethodTrustRegistry,
  evidenceRefs: [],
}
const missingArtifactTrustValidation = validateDnaMethodAppraisalWithExplicitTestRegistry(
  selfAssertedAuditedAppraisal,
  missingArtifactTrustRegistry,
)
assert.equal(missingArtifactTrustValidation.ok, false)
assert.ok(missingArtifactTrustValidation.errors.includes("appraisal:evidence_refs_not_trusted"))

const duplicatePassEvidenceAppraisal = withRecomputedAppraisalHash({
  ...selfAssertedAuditedAppraisal,
  reviewPasses: selfAssertedAuditedAppraisal.reviewPasses.map((pass, index) => index === 1
    ? {
      ...pass,
      passId: selfAssertedAuditedAppraisal.reviewPasses[0].passId,
      evidenceSha256: selfAssertedAuditedAppraisal.reviewPasses[0].evidenceSha256,
    }
    : pass),
})
const duplicatePassEvidenceValidation = validateDnaMethodAppraisal(
  duplicatePassEvidenceAppraisal,
)
assert.ok(duplicatePassEvidenceValidation.errors.includes("review_pass_1:duplicate_id"))
assert.ok(duplicatePassEvidenceValidation.errors.includes("review_pass_1:duplicate_evidence_hash"))

const nonChronologicalAppraisal = withRecomputedAppraisalHash({
  ...selfAssertedAuditedAppraisal,
  reviewPasses: selfAssertedAuditedAppraisal.reviewPasses.map((pass, index) => index === 2
    ? { ...pass, completedAt: selfAssertedAuditedAppraisal.reviewPasses[0].completedAt }
    : pass),
})
const nonChronologicalValidation = validateDnaMethodAppraisal(nonChronologicalAppraisal)
assert.ok(nonChronologicalValidation.errors.includes(
  "review_pass_2:non_chronological_completion",
))

const blindPassesMayCompleteInEitherOrder = withRecomputedAppraisalHash({
  ...selfAssertedAuditedAppraisal,
  reviewPasses: selfAssertedAuditedAppraisal.reviewPasses.map((pass, index) => index === 0
    ? { ...pass, completedAt: "2025-01-02T00:00:00.000Z" }
    : index === 1
      ? { ...pass, completedAt: "2025-01-01T00:00:00.000Z" }
      : { ...pass, completedAt: "2025-01-03T00:00:00.000Z" }),
})
const blindPassOrderValidation = validateDnaMethodAppraisalWithExplicitTestRegistry(
  blindPassesMayCompleteInEitherOrder,
  {
    ...explicitMethodTrustRegistry,
    passEvidence: blindPassesMayCompleteInEitherOrder.reviewPasses.map((pass) => ({
      appraisalId: blindPassesMayCompleteInEitherOrder.id,
      passId: pass.passId,
      reviewerRole: pass.reviewerRole,
      evidenceSha256: pass.evidenceSha256,
    })),
    appraisals: [{
      appraisalId: blindPassesMayCompleteInEitherOrder.id,
      sourceId: blindPassesMayCompleteInEitherOrder.sourceId,
      sourceEvidencePayloadSha256:
        blindPassesMayCompleteInEitherOrder.sourceEvidencePayloadSha256,
      appraisalPayloadSha256: blindPassesMayCompleteInEitherOrder.appraisalPayloadSha256,
    }],
  },
)
assert.equal(blindPassOrderValidation.ok, true, blindPassOrderValidation.errors.join(","))

const claimExtractionPassesCannotAuthorizeMethodAppraisal = withRecomputedAppraisalHash({
  ...selfAssertedAuditedAppraisal,
  reviewPasses: selfAssertedAuditedAppraisal.reviewPasses.map((pass, index) => ({
    ...pass,
    reviewerRole: ["blind_extraction_a", "blind_extraction_b", "reconciliation"][index] as never,
  })),
})
const claimPassValidation = validateDnaMethodAppraisal(
  claimExtractionPassesCannotAuthorizeMethodAppraisal,
)
assert.equal(claimPassValidation.ok, false)
assert.ok(claimPassValidation.errors.includes("review_pass_0:invalid_reviewer_role"))
assert.ok(claimPassValidation.errors.includes("review_pass_1:invalid_reviewer_role"))
assert.ok(claimPassValidation.errors.includes("review_pass_2:invalid_reviewer_role"))
assert.ok(claimPassValidation.errors.includes("appraisal:missing_multi_pass_audit"))

const invalidTimestampAppraisal = withRecomputedAppraisalHash({
  ...selfAssertedAuditedAppraisal,
  reviewPasses: selfAssertedAuditedAppraisal.reviewPasses.map((pass, index) => index === 0
    ? { ...pass, completedAt: "2026-99-99T99:99:99.000Z" }
    : pass),
})
const invalidTimestampValidation = validateDnaMethodAppraisal(invalidTimestampAppraisal)
assert.equal(invalidTimestampValidation.ok, false)
assert.ok(invalidTimestampValidation.errors.includes("review_pass_0:invalid_completed_at"))

// Even a structurally plausible, hash-recomputed "audited" source cannot
// authorize itself. The trusted release registry is empty.
const selfAssertedEligible = withRecomputedSourceHash({
  ...normalized.sources[0],
  identityVerificationStatus: "verified",
  versionStatus: "version_of_record",
  publicationRole: "article",
  correctionResolution: "not_applicable",
  hasIncomingCorrection: false,
  cohortResolution: "not_applicable",
  studyDesign: "randomized_controlled_trial",
  evidenceLevel: "eligible_for_body_synthesis_with_limits",
  canonicalCategories: ["central_nervous_system_networks"],
  population: "human",
  sampleScope: "general_population",
  ageScope: "adult",
  claimBoundary: "causal_inference_limited_to_design",
  licenseStatus: "approved_component_bound",
  integrityStatus: "verified_current",
  artifactHashes: ["f".repeat(64)],
  methodAppraisalId: selfAssertedAuditedAppraisal.id,
  reviewStatus: "codex_multi_pass_audited",
  runtimeEligibility: "eligible_for_release_pipeline",
})
const selfAssertedValidation = validateNormalizedDnaSource(selfAssertedEligible)
assert.equal(selfAssertedValidation.ok, false)
assert.ok(selfAssertedValidation.errors.includes("source:release_authorization_not_registered"))
assert.equal(isNormalizedDnaSourceRuntimeEligible(selfAssertedEligible), false)

const explicitNormalizedTrustRegistry: DnaNormalizedSourceReleaseTrustRegistry = Object.freeze({
  registryKind: "explicit_test_only",
  sourceReleases: Object.freeze([{
    sourceId: selfAssertedEligible.id,
    methodAppraisalId: selfAssertedAuditedAppraisal.id,
    methodAppraisalPayloadSha256: selfAssertedAuditedAppraisal.appraisalPayloadSha256,
    sourceEvidencePayloadSha256: selfAssertedEligible.evidencePayloadSha256,
    identityEvidenceSha256: selfAssertedEligible.identityEvidenceSha256,
    sourcePayloadSha256: selfAssertedEligible.sourcePayloadSha256,
  }]),
  methodAppraisals: Object.freeze([selfAssertedAuditedAppraisal]),
  methodAppraisalTrustRegistry: explicitMethodTrustRegistry,
})
const explicitlyTrustedSourceValidation = validateNormalizedDnaSourceWithExplicitTestRegistry(
  selfAssertedEligible,
  explicitNormalizedTrustRegistry,
)
assert.equal(explicitlyTrustedSourceValidation.ok, true,
  explicitlyTrustedSourceValidation.errors.join(","))
assert.equal(isNormalizedDnaSourceRuntimeEligibleWithExplicitTestRegistry(
  selfAssertedEligible,
  explicitNormalizedTrustRegistry,
), true)

const missingRegisteredAppraisalValidation = validateNormalizedDnaSourceWithExplicitTestRegistry(
  selfAssertedEligible,
  { ...explicitNormalizedTrustRegistry, methodAppraisals: [] },
)
assert.equal(missingRegisteredAppraisalValidation.ok, false)
assert.ok(missingRegisteredAppraisalValidation.errors.includes(
  "source:registered_method_appraisal_missing",
))

const identityPendingEligible = withRecomputedSourceHash({
  ...selfAssertedEligible,
  identityVerificationStatus: "pending",
})
const identityPendingEligibleValidation = validateNormalizedDnaSourceWithExplicitTestRegistry(
  identityPendingEligible,
  explicitNormalizedTrustRegistry,
)
assert.equal(identityPendingEligibleValidation.ok, false)
assert.ok(identityPendingEligibleValidation.errors.includes(
  "source:eligible_source_identity_not_verified",
))

const restrictedEligible = withRecomputedSourceHash({
  ...selfAssertedEligible,
  licenseStatus: "restricted",
})
const restrictedEligibleValidation = validateNormalizedDnaSource(restrictedEligible)
assert.equal(restrictedEligibleValidation.ok, false)
assert.ok(restrictedEligibleValidation.errors.includes(
  "source:eligible_source_license_not_component_approved",
))

const missingProvenanceEligible = withRecomputedSourceHash({
  ...selfAssertedEligible,
  canonicalCategories: ["not_assessed"],
  evidenceLevel: "not_assessed",
  claimBoundary: "not_assessed",
  artifactHashes: [],
})
const missingProvenanceValidation = validateNormalizedDnaSource(missingProvenanceEligible)
assert.equal(missingProvenanceValidation.ok, false)
assert.ok(missingProvenanceValidation.errors.includes("source:eligible_source_missing_artifact_hash"))
assert.ok(missingProvenanceValidation.errors.includes("source:eligible_source_category_not_assessed"))
assert.ok(missingProvenanceValidation.errors.includes("source:eligible_source_evidence_not_assessed"))
assert.ok(missingProvenanceValidation.errors.includes(
  "source:eligible_source_claim_boundary_not_assessed",
))

const eligibleButUnknownScope = withRecomputedSourceHash({
  ...selfAssertedEligible,
  population: "not_reported",
  ageScope: "not_reported",
})
const unknownScopeValidation = validateNormalizedDnaSource(eligibleButUnknownScope)
assert.equal(unknownScopeValidation.ok, false)
assert.ok(unknownScopeValidation.errors.includes("source:eligible_source_missing_population"))
assert.ok(unknownScopeValidation.errors.includes("source:eligible_source_missing_age_scope"))

const invalidPublicationSnapshot = {
  ...rawSnapshot,
  priorityRecords: rawSnapshot.priorityRecords.map((record, index) => index === 0
    ? { ...record, publicationVersion: "fabricated_version" as never }
    : record),
}
assert.throws(() => normalizeDnaSourceGovernanceSnapshot(invalidPublicationSnapshot),
  /invalid_publication_version/)

const nullIdentitySnapshot = {
  ...rawSnapshot,
  identityRecords: [null],
}
assert.throws(
  () => normalizeDnaSourceGovernanceSnapshot(nullIdentitySnapshot as never),
  /invalid_identity_records:malformed_input/,
  "Malformed identity girdisi TypeError yerine kontrollü domain hatası üretmeli",
)

const firstPriority = rawSnapshot.priorityRecords[0]
const firstDefinition = firstPriority.decisions.definition as Record<string, unknown>
const priorityDecisionMismatchSnapshot = {
  ...rawSnapshot,
  priorityRecords: rawSnapshot.priorityRecords.map((record, index) => index === 0
    ? {
      ...record,
      decisions: {
        ...record.decisions,
        definition: { ...firstDefinition, grade: firstDefinition.grade === "A" ? "B" : "A" },
      },
    }
    : record),
}
assert.throws(() => normalizeDnaSourceGovernanceSnapshot(priorityDecisionMismatchSnapshot),
  /priority_decision_mismatch/)

const invalidLicenseObligationSnapshot = {
  ...rawSnapshot,
  licenseRecords: rawSnapshot.licenseRecords.map((record, index) => index === 0
    ? {
      ...record,
      obligations: { ...record.obligations, attributionRequired: "yes" as never },
    }
    : record),
}
assert.throws(() => normalizeDnaSourceGovernanceSnapshot(invalidLicenseObligationSnapshot),
  /invalid_license_obligations/)

const invalidLicenseEvidenceSnapshot = {
  ...rawSnapshot,
  licenseRecords: rawSnapshot.licenseRecords.map((record, index) => index === 0
    ? {
      ...record,
      evidenceBasis: { ...record.evidenceBasis, passage: "self_asserted" },
    }
    : record),
}
assert.throws(() => normalizeDnaSourceGovernanceSnapshot(invalidLicenseEvidenceSnapshot),
  /invalid_license_evidence_basis/)

// Input order must not change normalized output or either collection hash.
const reversed = normalizeDnaSourceGovernanceSnapshot({
  ...rawSnapshot,
  identityRecords: [...rawSnapshot.identityRecords].reverse(),
  priorityRecords: [...rawSnapshot.priorityRecords].reverse(),
  licenseRecords: [...rawSnapshot.licenseRecords].reverse(),
})
assert.deepEqual(reversed, normalized)
for (let run = 0; run < 20; run += 1) {
  const repeated = normalizeDnaSourceGovernanceSnapshot(rawSnapshot)
  assert.equal(repeated.evidencePayloadSha256, normalized.evidencePayloadSha256)
  assert.equal(repeated.collectionPayloadSha256, normalized.collectionPayloadSha256)
  assert.deepEqual(repeated.sources, normalized.sources)
}

const pendingAppraisalCollectionSha256 = hashNormalizedDnaSourcePayload(
  pendingAppraisals.map((appraisal) => ({
    sourceId: appraisal.sourceId,
    appraisalPayloadSha256: appraisal.appraisalPayloadSha256,
  })),
)

const compactSnapshot = {
  schemaVersion: "dna-source-appraisal-normalization-snapshot@1",
  sourceCollectionSchemaVersion: normalized.schemaVersion,
  snapshotBasisAt: rawSnapshot.snapshotBasisAt ?? null,
  sourceGovernanceSnapshotSha256: sha256Bytes(sourceSnapshotBytes),
  counts: {
    sourceRecords: normalized.sourceCount,
    pendingMethodAppraisals: normalized.methodAppraisalPendingCount,
    runtimeEligible: normalized.runtimeEligibleCount,
    missingAgeScope: normalized.missingAgeScopeCount,
    missingPopulation: normalized.missingPopulationCount,
  },
  distributions: {
    sourceRole: countBy(normalized.sources, (source) => source.sourceRole),
    population: countBy(normalized.sources, (source) => source.population),
    ageScope: countBy(normalized.sources, (source) => source.ageScope),
    identityVerificationStatus: countBy(normalized.sources,
      (source) => source.identityVerificationStatus),
    versionStatus: countBy(normalized.sources, (source) => source.versionStatus),
    correctionResolution: countBy(normalized.sources, (source) => source.correctionResolution),
    reviewStatus: countBy(normalized.sources, (source) => source.reviewStatus),
    runtimeEligibility: countBy(normalized.sources, (source) => source.runtimeEligibility),
  },
  hashes: {
    sourceEvidenceCollectionSha256: normalized.evidencePayloadSha256,
    normalizedSourceCollectionSha256: normalized.collectionPayloadSha256,
    pendingAppraisalCollectionSha256,
  },
  sources: normalized.sources.map((source, index) => ({
    id: source.id,
    evidencePayloadSha256: source.evidencePayloadSha256,
    sourcePayloadSha256: source.sourcePayloadSha256,
    appraisalPayloadSha256: pendingAppraisals[index].appraisalPayloadSha256,
    reviewStatus: source.reviewStatus,
    runtimeEligibility: source.runtimeEligibility,
  })),
  contentPolicy: {
    rawSourceTextIncluded: false,
    abstractsIncluded: false,
    absoluteFilesystemPathsIncluded: false,
    identityEvidencePayloadIncluded: false,
    pendingAppraisalsCanEnterRuntime: false,
    singleSourceGradeCertaintyAllowed: false,
    selfAssertedEvidenceHashesAuthorizeAppraisal: false,
    registeredMethodAppraisalCrossBindingRequired: true,
    productionTrustRegistriesEmpty: true,
    positiveAuthorizationPath: "explicit_test_only",
  },
}

const compactJson = `${JSON.stringify(compactSnapshot, null, 2)}\n`
assert.equal(compactJson.includes("/Volumes/"), false)
assert.equal(compactJson.includes("/Users/"), false)
if (process.argv.includes("--write-snapshot")) {
  writeFileSync(APPRAISAL_SNAPSHOT_PATH, compactJson, "utf8")
} else {
  assert.equal(readFileSync(APPRAISAL_SNAPSHOT_PATH, "utf8"), compactJson,
    "Kompakt snapshot güncel değil; bilinçli değişiklikte --write-snapshot kullanın")
}

console.log(JSON.stringify({
  ok: true,
  sourceCount: normalized.sourceCount,
  pendingMethodAppraisals: normalized.methodAppraisalPendingCount,
  runtimeEligible: normalized.runtimeEligibleCount,
  missingAgeScope: normalized.missingAgeScopeCount,
  missingPopulation: normalized.missingPopulationCount,
  normalizedSourceCollectionSha256: normalized.collectionPayloadSha256,
  pendingAppraisalCollectionSha256,
}, null, 2))

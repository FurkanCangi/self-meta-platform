import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
  DNA_STUDY_DESIGNS,
} from "../src/lib/dna/chat/governance/methodAppraisal"
import {
  DNA_BATCH_ADAPTED_GRADE_DIMENSIONS,
  DNA_BATCH_METHOD_FIELD_NAMES,
  DNA_METHOD_APPRAISAL_BATCH_CONTRACT_VERSION,
  DNA_METHOD_APPRAISAL_DESIGN_PROFILE_VERSION,
  DNA_METHOD_APPRAISAL_FIDELITY_PASS_VERSION,
  DNA_METHOD_APPRAISAL_RECONCILIATION_VERSION,
  DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE,
  DNA_METHOD_APPRAISAL_REVIEW_PASS_VERSION,
  compileDnaMethodAppraisalCandidate,
  hashDnaMethodAppraisalBatchPayload,
  validateDnaMethodAppraisalDesignProfileRegistry,
  validateDnaMethodAppraisalCandidate,
  validateDnaMethodAppraisalFidelityPass,
  validateDnaMethodAppraisalReconciliation,
  validateDnaMethodReviewPass,
  type DnaBatchAdaptedGradeDimension,
  type DnaBatchMethodFieldName,
  type DnaHonestSampleSize,
  type DnaMethodAppraisalFidelityPass,
  type DnaMethodAppraisalReconciliation,
  type DnaMethodObservation,
  type DnaMethodReviewPass,
} from "../src/lib/dna/chat/governance/methodAppraisalBatch"

function attachHash<T extends Record<string, unknown>>(
  payload: T,
): T & { readonly canonicalPayloadSha256: string } {
  return Object.freeze({
    ...payload,
    canonicalPayloadSha256: hashDnaMethodAppraisalBatchPayload(payload),
  })
}

function replaceHash<T extends { readonly canonicalPayloadSha256: string }>(
  value: T,
): Omit<T, "canonicalPayloadSha256"> & { readonly canonicalPayloadSha256: string } {
  const { canonicalPayloadSha256: _hash, ...payload } = value
  return attachHash(payload)
}

const paragraphId = "synthetic-source:p000001"
const unknownObservation: DnaMethodObservation = Object.freeze({
  reportingState: "not_assessed",
  finding: null,
  evidenceParagraphIds: Object.freeze([]),
  boundary: null,
})
const reportedObservation: DnaMethodObservation = Object.freeze({
  reportingState: "reported_with_boundary",
  finding: "The bound workpack explicitly reports this method feature.",
  evidenceParagraphIds: Object.freeze([paragraphId]),
  boundary: "This is a synthetic contract fixture, not a scientific finding.",
})
const sampleSize: DnaHonestSampleSize = Object.freeze({
  studyCount: Object.freeze({
    reporting: "reported_total",
    total: 12,
    evidenceParagraphIds: Object.freeze([paragraphId]),
    boundary: null,
  }),
  participantCount: Object.freeze({
    reporting: "reported_multiple_not_deduplicated",
    total: null,
    evidenceParagraphIds: Object.freeze([paragraphId]),
    boundary: "Outcome-specific participant counts cannot be summed or treated as de-duplicated.",
  }),
  datasetCount: Object.freeze({
    reporting: "not_reported",
    total: null,
    evidenceParagraphIds: Object.freeze([]),
    boundary: null,
  }),
})

const methodFields = Object.freeze(Object.fromEntries(
  DNA_BATCH_METHOD_FIELD_NAMES.map((field) => [field, reportedObservation]),
) as Record<DnaBatchMethodFieldName, DnaMethodObservation>)
const adaptedGradeDimensions = Object.freeze(Object.fromEntries(
  DNA_BATCH_ADAPTED_GRADE_DIMENSIONS.map((dimension) => [
    dimension,
    dimension === "inconsistency" || dimension === "publicationBias"
      ? unknownObservation
      : reportedObservation,
  ]),
) as Record<DnaBatchAdaptedGradeDimension, DnaMethodObservation>)

const sourceBinding = Object.freeze({
  workpackRelativePath: "method-review-workpacks/synthetic-source.json",
  workpackFileSha256: "1".repeat(64),
  workpackPayloadSha256: "2".repeat(64),
  artifactId: "synthetic-source.jats",
  artifactSha256: "3".repeat(64),
  parsedContentSha256: "4".repeat(64),
})
const contractBinding = Object.freeze({
  contractFileSha256: "5".repeat(64),
  designProfileRegistrySha256: "6".repeat(64),
  designProfileId: "profile.evidence_synthesis",
})

function reviewPass(
  role: "method_appraisal_a" | "method_appraisal_b",
  reviewedAt: string,
): DnaMethodReviewPass {
  return attachHash({
    schemaVersion: DNA_METHOD_APPRAISAL_REVIEW_PASS_VERSION,
    contractVersion: DNA_METHOD_APPRAISAL_BATCH_CONTRACT_VERSION,
    reviewArchitecture: DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE,
    passRole: role,
    passId: `synthetic:${role}`,
    reviewedAt,
    sourceId: "synthetic-source",
    status: "candidate_only" as const,
    runtimeEligible: false as const,
    releaseEligible: false as const,
    sourceBinding,
    contractBinding,
    studyDesign: reportedObservation,
    population: reportedObservation,
    ageScope: reportedObservation,
    sampleSize,
    methodFields,
    adaptedGradeDimensions,
    limitations: Object.freeze(["synthetic_contract_fixture_only"]),
  })
}

const passA = reviewPass("method_appraisal_a", "2026-07-20T12:00:00Z")
const passB = reviewPass("method_appraisal_b", "2026-07-20T12:01:00Z")

const reconciliation: DnaMethodAppraisalReconciliation = attachHash({
  schemaVersion: DNA_METHOD_APPRAISAL_RECONCILIATION_VERSION,
  contractVersion: DNA_METHOD_APPRAISAL_BATCH_CONTRACT_VERSION,
  reviewArchitecture: DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE,
  passRole: "method_appraisal_reconciliation" as const,
  passId: "synthetic:method_appraisal_reconciliation",
  reviewedAt: "2026-07-20T12:02:00Z",
  sourceId: "synthetic-source",
  status: "candidate_only" as const,
  runtimeEligible: false as const,
  releaseEligible: false as const,
  sourceBinding,
  contractBinding,
  inputBindings: Object.freeze({
    passASha256: passA.canonicalPayloadSha256,
    passBSha256: passB.canonicalPayloadSha256,
  }),
  studyDesign: reportedObservation,
  population: reportedObservation,
  ageScope: reportedObservation,
  sampleSize,
  methodFields,
  adaptedGradeDimensions,
  unresolvedIssues: Object.freeze([]),
  limitations: Object.freeze(["synthetic_contract_fixture_only"]),
})

const fidelityPass: DnaMethodAppraisalFidelityPass = attachHash({
  schemaVersion: DNA_METHOD_APPRAISAL_FIDELITY_PASS_VERSION,
  contractVersion: DNA_METHOD_APPRAISAL_BATCH_CONTRACT_VERSION,
  reviewArchitecture: DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE,
  passRole: "source_fidelity" as const,
  passId: "synthetic:source_fidelity",
  reviewedAt: "2026-07-20T12:03:00Z",
  sourceId: "synthetic-source",
  status: "candidate_only" as const,
  runtimeEligible: false as const,
  releaseEligible: false as const,
  sourceBinding,
  inputBindings: Object.freeze({
    passASha256: passA.canonicalPayloadSha256,
    passBSha256: passB.canonicalPayloadSha256,
    reconciliationSha256: reconciliation.canonicalPayloadSha256,
  }),
  assessment: Object.freeze({
    allFindingsEntailed: true,
    allLocatorsResolve: true,
    countsNotConflated: true,
    unsupportedMechanismAbsent: true,
    boundariesPreserved: true,
    issues: Object.freeze([]),
  }),
  disposition: "passed" as const,
})

for (const [name, validation] of [
  ["pass_a", validateDnaMethodReviewPass(passA)],
  ["pass_b", validateDnaMethodReviewPass(passB)],
  ["reconciliation", validateDnaMethodAppraisalReconciliation(reconciliation)],
  ["fidelity", validateDnaMethodAppraisalFidelityPass(fidelityPass)],
] as const) assert.equal(validation.ok, true, `${name}:${validation.errors.join(",")}`)

const candidate = compileDnaMethodAppraisalCandidate({
  passA,
  passB,
  reconciliation,
  fidelityPass,
})
assert.equal(candidate.reviewArchitecture,
  "output_blinded_codex_multi_pass_not_independent")
assert.equal(candidate.status, "candidate_compiled_unregistered")
assert.equal(candidate.trustedRegistryStatus, "not_registered")
assert.equal(candidate.runtimeEligible, false)
assert.equal(candidate.releaseEligible, false)
assert.equal(candidate.sampleSize.studyCount.total, 12)
assert.equal(candidate.sampleSize.participantCount.total, null)
assert.match(candidate.canonicalPayloadSha256, /^[a-f0-9]{64}$/)
assert.equal(validateDnaMethodAppraisalCandidate(candidate).ok, true)
assert.equal(
  compileDnaMethodAppraisalCandidate({ passA, passB, reconciliation, fidelityPass })
    .canonicalPayloadSha256,
  candidate.canonicalPayloadSha256,
  "Canonical compilation must be deterministic",
)
const selfAuthorizedCandidate = {
  ...candidate,
  trustedRegistryStatus: "registered",
  runtimeEligible: true,
  releaseEligible: true,
}
const selfAuthorizedValidation = validateDnaMethodAppraisalCandidate(selfAuthorizedCandidate)
assert.equal(selfAuthorizedValidation.ok, false)
assert.ok(selfAuthorizedValidation.errors.includes("candidate:invalid_trusted_registry_status"))
assert.ok(selfAuthorizedValidation.errors.includes("candidate:runtime_must_be_false"))
assert.ok(selfAuthorizedValidation.errors.includes("candidate:release_must_be_false"))

const legacyAmbiguousSample = replaceHash({
  ...passA,
  sampleSize: { reporting: "reported", total: 999 },
} as unknown as typeof passA)
const legacyValidation = validateDnaMethodReviewPass(legacyAmbiguousSample)
assert.equal(legacyValidation.ok, false)
assert.ok(legacyValidation.errors.includes("review_pass:sample_size:missing_field:studyCount"))
assert.ok(legacyValidation.errors.includes("review_pass:sample_size:unexpected_field:total"))

const conflatedSamplePass = replaceHash({
  ...passA,
  sampleSize: {
    ...sampleSize,
    participantCount: {
      ...sampleSize.participantCount,
      total: 594,
    },
  },
} as typeof passA)
const conflatedValidation = validateDnaMethodReviewPass(conflatedSamplePass)
assert.equal(conflatedValidation.ok, false)
assert.ok(conflatedValidation.errors.includes(
  "review_pass:sample_size:participant_count:non_total_state_cannot_assert_total",
))

assert.throws(() => compileDnaMethodAppraisalCandidate({
  passA,
  passB,
  reconciliation,
  fidelityPass: undefined as never,
}), /compiler:missing_fidelity_pass/)

const failedFidelity = replaceHash({
  ...fidelityPass,
  disposition: "needs_revision" as const,
  assessment: {
    ...fidelityPass.assessment,
    countsNotConflated: false,
    issues: ["participant_counts_were_summed_across_outcomes"],
  },
}) as DnaMethodAppraisalFidelityPass
assert.equal(validateDnaMethodAppraisalFidelityPass(failedFidelity).ok, true)
assert.throws(() => compileDnaMethodAppraisalCandidate({
  passA,
  passB,
  reconciliation,
  fidelityPass: failedFidelity,
}), /compiler:fidelity_pass_not_clean/)

const profilePath = resolve(
  process.cwd(),
  "docs/dna-intelligence/governance/v3/method-appraisal-design-profiles.json",
)
const profileRegistry = JSON.parse(readFileSync(profilePath, "utf8")) as {
  schemaVersion: string
  profiles: Array<{ id: string }>
  canonicalDesignAliases: Record<string, string>
}
const profileValidation = validateDnaMethodAppraisalDesignProfileRegistry(profileRegistry)
assert.equal(profileValidation.ok, true, profileValidation.errors.join(","))
assert.equal(profileRegistry.schemaVersion, DNA_METHOD_APPRAISAL_DESIGN_PROFILE_VERSION)
assert.equal(new Set(profileRegistry.profiles.map((profile) => profile.id)).size,
  profileRegistry.profiles.length)
for (const design of DNA_STUDY_DESIGNS) {
  assert.equal(typeof profileRegistry.canonicalDesignAliases[design], "string",
    `Canonical design profile missing: ${design}`)
}

console.log(JSON.stringify({
  ok: true,
  contractVersion: DNA_METHOD_APPRAISAL_BATCH_CONTRACT_VERSION,
  reviewArchitecture: DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE,
  commonPassSchema: DNA_METHOD_APPRAISAL_REVIEW_PASS_VERSION,
  honestSampleSizeFields: ["studyCount", "participantCount", "datasetCount"],
  fidelityRequired: true,
  designProfileCount: profileRegistry.profiles.length,
  canonicalStudyDesignCoverage: DNA_STUDY_DESIGNS.length,
  runtimeEligibleCandidates: 0,
  releaseEligibleCandidates: 0,
}, null, 2))

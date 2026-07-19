import assert from "node:assert/strict"
import { createHash } from "node:crypto"

import {
  DNA_ADVERSARIAL_DIMENSIONS,
  DNA_ADVERSARIAL_REVIEW_VERSION,
  DNA_CLAIM_REVIEW_GATES_CONTRACT,
  DNA_CLINICAL_SAFETY_DIMENSIONS,
  DNA_CLINICAL_SAFETY_REVIEW_VERSION,
  DNA_METHOD_SUPPORT_REVIEW_VERSION,
  DNA_REGISTERED_CLAIM_REVIEW_RECORDS,
  DNA_SOURCE_FIDELITY_ISSUES,
  DNA_SOURCE_FIDELITY_REVIEW_VERSION,
  DNA_TRANSLATION_TERM_FAMILIES,
  DNA_TURKISH_TRANSFER_REVIEW_VERSION,
  evaluateDnaClaimReviewGates,
  evaluateDnaClaimReviewGatesWithExplicitTestRegistry,
  hashDnaClaimReviewPayload,
  type DnaClaimReviewBundle,
  type DnaClaimReviewTrustRecord,
  type DnaClaimReviewTrustRegistry,
  type DnaTranslationTermCheck,
} from "../src/lib/dna/chat/governance/claimReviewGates"
import {
  DNA_ATOMIC_CLAIM_VERSION,
  DNA_SOURCE_PASSAGE_VERSION,
  type DnaAtomicClaim,
  type DnaSourcePassage,
} from "../src/lib/dna/chat/governance/evidenceExtraction"

process.env.DNA_CLAIM_REVIEW_TEST_FIXTURE_MODE = "1"

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

type DeepMutable<T> = T extends readonly (infer TItem)[]
  ? DeepMutable<TItem>[]
  : T extends object
    ? { -readonly [TKey in keyof T]: DeepMutable<T[TKey]> }
    : T
type MutableBundle = DeepMutable<DnaClaimReviewBundle>

const ORIGINAL = "In this observational sample, an association may predict recovery in arousal regulation, but the evidence does not prove causation."
const SOURCE_ID = "synthetic.review.source"
const ARTIFACT_SHA = sha256("synthetic-review-artifact")

const passageCore: Omit<DnaSourcePassage, "provenanceSha256"> = {
  schemaVersion: DNA_SOURCE_PASSAGE_VERSION,
  id: "passage.synthetic.review.001",
  status: "candidate_only",
  runtimeEligible: false,
  sourceId: SOURCE_ID,
  artifactId: "synthetic.review.source.jats",
  originalText: ORIGINAL,
  originalLanguage: "en",
  sectionPath: ["Results"],
  xmlIds: ["p001"],
  paragraphStart: 1,
  paragraphEnd: 1,
  pageStart: null,
  pageEnd: null,
  paragraphIds: ["synthetic.review.source.jats:p000001"],
  artifactSha256: ARTIFACT_SHA,
  artifactBindingSha256: sha256("artifact-binding"),
  contentSha256: sha256(ORIGINAL),
  ageScope: "adult",
  evidenceType: "observational",
  claimBoundary: "This group-level observational association cannot support individual or causal inference.",
  licenseStatus: "approved",
  licenseRecordId: "license.synthetic.review",
  licenseEvidenceSha256: sha256("license-evidence"),
  metadataReviewId: "metadata.synthetic.review",
  metadataEvidenceSha256: sha256("metadata-evidence"),
}
const passage: DnaSourcePassage = Object.freeze({
  ...passageCore,
  provenanceSha256: hashDnaClaimReviewPayload(passageCore),
})

const claimCore: Omit<DnaAtomicClaim, "claimSha256"> = {
  schemaVersion: DNA_ATOMIC_CLAIM_VERSION,
  status: "candidate_only",
  runtimeEligible: false,
  extractionLane: "A",
  extractionProtocolId: "dna-blind-extraction-a@1",
  extractionRunId: "run.synthetic.review.a",
  sourceId: SOURCE_ID,
  artifactSha256: ARTIFACT_SHA,
  claimId: "claim.synthetic.review.001",
  claimType: "association",
  proposition: ORIGINAL,
  population: "human",
  ageScope: "adult",
  setting: "community",
  measure: null,
  comparator: null,
  outcome: "Recovery in arousal regulation",
  direction: "positive",
  effectMagnitude: {
    kind: "not_reported",
    metric: null,
    value: null,
    qualifier: "not_reported",
  },
  effectEvidence: null,
  uncertainty: {
    level: "high",
    text: "Observational group-level evidence does not support causal or individual inference.",
  },
  studyDesign: "cross_sectional_observational",
  evidenceLevel: "not_assessed",
  evidenceLevelEvidence: null,
  passageIds: [passage.id],
  causalStatus: "associational",
  claimBoundary: passage.claimBoundary,
  dnaRelationship: "none",
  conflictSetId: null,
  quarantineReason: null,
}
const claim: DnaAtomicClaim = Object.freeze({
  ...claimCore,
  claimSha256: hashDnaClaimReviewPayload(claimCore),
})

const binding = {
  sourceId: SOURCE_ID,
  artifactSha256: ARTIFACT_SHA,
  claimId: claim.claimId,
  claimSha256: claim.claimSha256,
  passageIds: [passage.id],
  passageProvenanceSha256s: [passage.provenanceSha256],
}

function review<T extends object>(input: {
  schemaVersion: string
  reviewId: string
  reviewerRole: string
  completedAt: string
  assessment: T
}) {
  const core = {
    schemaVersion: input.schemaVersion,
    reviewId: input.reviewId,
    reviewerRole: input.reviewerRole,
    completedAt: input.completedAt,
    binding,
    assessment: input.assessment,
    rationale: `The ${input.reviewerRole} completed the bounded synthetic review with source-linked evidence.`,
    evidenceSha256: sha256(`evidence:${input.reviewId}`),
  }
  return { ...core, reviewPayloadSha256: hashDnaClaimReviewPayload(core) }
}

const absentFidelity = Object.fromEntries(DNA_SOURCE_FIDELITY_ISSUES.map((key) => [key, "absent"]))
const absentAdversarial = Object.fromEntries(DNA_ADVERSARIAL_DIMENSIONS.map((key) => [key, "absent"]))
const absentSafety = Object.fromEntries(DNA_CLINICAL_SAFETY_DIMENSIONS.map((key) => [key, "absent"]))

const presentTerms: Partial<Record<(typeof DNA_TRANSLATION_TERM_FAMILIES)[number], readonly string[]>> = {
  association_causation: ["association", "causation"],
  regulation_control: ["regulation"],
  arousal_activation: ["arousal"],
  recovery_restoration: ["recovery"],
  predict_explain: ["predict"],
  modality_may_can_is: ["may"],
  evidence_proof: ["evidence"],
}
const turkishTerms: Partial<Record<(typeof DNA_TRANSLATION_TERM_FAMILIES)[number], readonly string[]>> = {
  association_causation: ["ilişki", "nedensellik"],
  regulation_control: ["düzenleme"],
  arousal_activation: ["uyarılma"],
  recovery_restoration: ["toparlanma"],
  predict_explain: ["yordamak"],
  modality_may_can_is: ["-ebilir"],
  evidence_proof: ["kanıt"],
}
const termChecks: DnaTranslationTermCheck[] = DNA_TRANSLATION_TERM_FAMILIES.map((family) => {
  const sourceTerms = presentTerms[family] ?? []
  return {
    family,
    relevance: sourceTerms.length > 0 ? "relevant" : "not_present",
    sourceTerms,
    approvedTurkishTerms: turkishTerms[family] ?? [],
    conceptPreserved: "yes",
    reverseMeaningChecked: "yes",
    scopeChange: "none",
  }
})

const goodBundle: DnaClaimReviewBundle = {
  claim,
  passages: [passage],
  sourceFidelity: review({
    schemaVersion: DNA_SOURCE_FIDELITY_REVIEW_VERSION,
    reviewId: "review.fidelity.001",
    reviewerRole: "source_fidelity_reviewer",
    completedAt: "2026-07-19T14:00:00.000Z",
    assessment: { entailment: "entailed", issues: absentFidelity },
  }) as unknown as DnaClaimReviewBundle["sourceFidelity"],
  methodSupport: review({
    schemaVersion: DNA_METHOD_SUPPORT_REVIEW_VERSION,
    reviewId: "review.method.001",
    reviewerRole: "method_support_reviewer",
    completedAt: "2026-07-19T14:01:00.000Z",
    assessment: {
      methodAppraisalId: "appraisal.synthetic.review.001",
      methodAppraisalSha256: sha256("audited-method-appraisal"),
      appraisalDisposition: "eligible_for_body_synthesis_with_limits",
      designSupportsClaim: "adequate_with_stated_limits",
      correlationCausationAligned: "adequate_with_stated_limits",
      measurementValidity: "adequate_with_stated_limits",
      sampleAndAgeAligned: "adequate_with_stated_limits",
      effectAndUncertaintyReflected: "adequate_with_stated_limits",
      studyContextRespected: "adequate_with_stated_limits",
    },
  }) as unknown as DnaClaimReviewBundle["methodSupport"],
  adversarial: review({
    schemaVersion: DNA_ADVERSARIAL_REVIEW_VERSION,
    reviewId: "review.adversarial.001",
    reviewerRole: "adversarial_reviewer",
    completedAt: "2026-07-19T14:02:00.000Z",
    assessment: {
      evidenceSetId: "evidence.set.synthetic.001",
      evidenceSetSha256: sha256("audited-adversarial-evidence-set"),
      searchCutoff: "2026-07-19T13:55:00.000Z",
      consideredSourceIds: [SOURCE_ID, "synthetic.review.synthesis"],
      comparisonBasis: "method_quality_over_recency_or_count",
      findings: absentAdversarial,
      disposition: "no_material_counterevidence_found",
    },
  }) as unknown as DnaClaimReviewBundle["adversarial"],
  clinicalSafety: review({
    schemaVersion: DNA_CLINICAL_SAFETY_REVIEW_VERSION,
    reviewId: "review.safety.001",
    reviewerRole: "clinical_safety_reviewer",
    completedAt: "2026-07-19T14:03:00.000Z",
    assessment: {
      findings: absentSafety,
      clinicalCriticality: "noncritical",
      evidenceBreadth: "multiple_sources_or_synthesis",
      statisticExplanation: "not_applicable",
      licenseStatus: "approved",
      scientificConflictStatus: "none_identified",
      automaticBlockers: [],
    },
  }) as unknown as DnaClaimReviewBundle["clinicalSafety"],
  turkishTransfer: review({
    schemaVersion: DNA_TURKISH_TRANSFER_REVIEW_VERSION,
    reviewId: "review.translation.001",
    reviewerRole: "turkish_transfer_reviewer",
    completedAt: "2026-07-19T14:04:00.000Z",
    assessment: {
      transferDirection: "english_to_turkish",
      originalPassages: [{
        passageId: passage.id,
        originalLanguage: "en",
        originalText: passage.originalText,
        contentSha256: passage.contentSha256,
        provenanceSha256: passage.provenanceSha256,
      }],
      approvedTurkishNarrative: "Bu gözlemsel örneklemdeki ilişki, uyarılma düzenlemesindeki toparlanmayı yordamaya yardımcı olabilir; kanıt nedenselliği göstermez.",
      independentBackTranslation: "In this observational sample, the association may help predict recovery in arousal regulation; the evidence does not establish causation.",
      conceptualEquivalence: "preserved",
      reverseMeaning: "absent",
      meaningScope: "preserved",
      causalStrength: "preserved",
      modality: "preserved",
      termChecks,
    },
  }) as unknown as DnaClaimReviewBundle["turkishTransfer"],
}

function registryFor(bundle: DnaClaimReviewBundle): DnaClaimReviewTrustRegistry {
  const base = (kind: DnaClaimReviewTrustRecord["kind"], recordId: string, subjectSha256: string) => ({
    kind,
    recordId,
    sourceId: bundle.claim.sourceId,
    artifactSha256: bundle.claim.artifactSha256,
    claimSha256: bundle.claim.claimSha256,
    subjectSha256,
  })
  return {
    registryKind: "explicit_test_only",
    records: [
      base("source_fidelity_review", bundle.sourceFidelity.reviewId, bundle.sourceFidelity.reviewPayloadSha256),
      base("method_support_review", bundle.methodSupport.reviewId, bundle.methodSupport.reviewPayloadSha256),
      base("method_appraisal", bundle.methodSupport.assessment.methodAppraisalId,
        bundle.methodSupport.assessment.methodAppraisalSha256),
      base("adversarial_review", bundle.adversarial.reviewId, bundle.adversarial.reviewPayloadSha256),
      base("adversarial_evidence_set", bundle.adversarial.assessment.evidenceSetId,
        bundle.adversarial.assessment.evidenceSetSha256),
      base("clinical_safety_review", bundle.clinicalSafety.reviewId, bundle.clinicalSafety.reviewPayloadSha256),
      base("turkish_transfer_review", bundle.turkishTransfer.reviewId, bundle.turkishTransfer.reviewPayloadSha256),
    ],
  }
}

function rehashReview<T extends { reviewPayloadSha256: string }>(record: T): T {
  const { reviewPayloadSha256: _old, ...core } = record
  return { ...core, reviewPayloadSha256: hashDnaClaimReviewPayload(core) } as T
}

function evaluateMutation(mutate: (bundle: MutableBundle) => void) {
  const bundle = clone(goodBundle) as MutableBundle
  mutate(bundle)
  bundle.sourceFidelity = rehashReview(bundle.sourceFidelity)
  bundle.methodSupport = rehashReview(bundle.methodSupport)
  bundle.adversarial = rehashReview(bundle.adversarial)
  bundle.clinicalSafety = rehashReview(bundle.clinicalSafety)
  bundle.turkishTransfer = rehashReview(bundle.turkishTransfer)
  return evaluateDnaClaimReviewGatesWithExplicitTestRegistry(
    bundle as DnaClaimReviewBundle,
    registryFor(bundle as DnaClaimReviewBundle),
  )
}

assert.equal(DNA_REGISTERED_CLAIM_REVIEW_RECORDS.length, 0)
assert.equal(DNA_CLAIM_REVIEW_GATES_CONTRACT.productionRegisteredReviewCount, 0)
assert.equal(DNA_CLAIM_REVIEW_GATES_CONTRACT.autonomousScientificReviewImplemented, false)
assert.equal(DNA_CLAIM_REVIEW_GATES_CONTRACT.contestedDisposition,
  "requires_phase_25_conflict_resolution_not_runtime")

const explicitPass = evaluateDnaClaimReviewGatesWithExplicitTestRegistry(goodBundle, registryFor(goodBundle))
assert.equal(explicitPass.status, "eligible_for_phase_25_conflict_processing")
assert.equal(explicitPass.runtimeEligible, false)
assert.deepEqual(explicitPass.failedPhases, [])
assert.deepEqual(explicitPass, evaluateDnaClaimReviewGatesWithExplicitTestRegistry(goodBundle, registryFor(goodBundle)))
assert.ok(Object.isFrozen(explicitPass) && Object.isFrozen(explicitPass.reasons))

const productionBlocked = evaluateDnaClaimReviewGates(goodBundle)
assert.equal(productionBlocked.status, "blocked")
assert.deepEqual(productionBlocked.failedPhases, [20, 21, 22, 23, 24])
assert.ok(productionBlocked.reasons.some((reason) => reason.includes("review_not_trusted")))

const malformedBundle = evaluateDnaClaimReviewGates(null)
assert.equal(malformedBundle.status, "blocked")
assert.deepEqual(malformedBundle.failedPhases, [20, 21, 22, 23, 24])
assert.deepEqual(malformedBundle.reasons, ["input:invalid_bundle_shape"])
const malformedRegistry = evaluateDnaClaimReviewGatesWithExplicitTestRegistry(goodBundle, null)
assert.deepEqual(malformedRegistry.reasons, ["input:invalid_registry_shape"])
const malformedNested = clone(goodBundle) as unknown as MutableBundle
;(malformedNested.clinicalSafety.assessment as unknown as { findings: null }).findings = null
malformedNested.clinicalSafety = rehashReview(malformedNested.clinicalSafety)
const malformedNestedResult = evaluateDnaClaimReviewGatesWithExplicitTestRegistry(
  malformedNested,
  registryFor(malformedNested as DnaClaimReviewBundle),
)
assert.equal(malformedNestedResult.status, "blocked")
assert.ok(malformedNestedResult.failedPhases.includes(23))

const wrongRegistryKind = evaluateDnaClaimReviewGatesWithExplicitTestRegistry(goodBundle, {
  registryKind: "production_compiled",
  records: registryFor(goodBundle).records,
})
assert.equal(wrongRegistryKind.status, "blocked")
assert.ok(wrongRegistryKind.reasons.some((reason) => reason.includes("registry:invalid_kind")))

const previousNodeEnv = process.env.NODE_ENV
Object.assign(process.env, { NODE_ENV: "production" })
const testRegistryBlockedInProduction = evaluateDnaClaimReviewGatesWithExplicitTestRegistry(
  goodBundle,
  registryFor(goodBundle),
)
if (previousNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV")
else Object.assign(process.env, { NODE_ENV: previousNodeEnv })
assert.equal(testRegistryBlockedInProduction.status, "blocked")
assert.ok(testRegistryBlockedInProduction.reasons.some((reason) =>
  reason.includes("registry:test_fixture_not_authorized")))

const fidelityExpanded = evaluateMutation((bundle) => {
  bundle.sourceFidelity.assessment.issues.scope_expansion = "present"
})
assert.deepEqual(fidelityExpanded.failedPhases, [20])

const fidelityUnassessed = evaluateMutation((bundle) => {
  bundle.sourceFidelity.assessment.entailment = "not_assessed"
})
assert.deepEqual(fidelityUnassessed.failedPhases, [20])

const methodCausalConcern = evaluateMutation((bundle) => {
  bundle.methodSupport.assessment.correlationCausationAligned = "concern"
})
assert.deepEqual(methodCausalConcern.failedPhases, [21])

const methodPending = evaluateMutation((bundle) => {
  bundle.methodSupport.assessment.appraisalDisposition = "blocked_pending_appraisal"
})
assert.deepEqual(methodPending.failedPhases, [21])

const counterevidenceFound = evaluateMutation((bundle) => {
  bundle.adversarial.assessment.findings.stronger_synthesis_disagrees = "present"
  bundle.adversarial.assessment.disposition = "contested"
  bundle.clinicalSafety.assessment.scientificConflictStatus = "unresolved"
  bundle.clinicalSafety.assessment.automaticBlockers = ["unresolved_scientific_conflict"]
})
assert.equal(counterevidenceFound.status, "requires_phase_25_conflict_resolution")
assert.deepEqual(counterevidenceFound.failedPhases, [])
assert.equal(counterevidenceFound.runtimeEligible, false)

const quarantinedCounterevidence = evaluateMutation((bundle) => {
  bundle.adversarial.assessment.findings.stronger_synthesis_disagrees = "present"
  bundle.adversarial.assessment.disposition = "quarantined"
})
assert.equal(quarantinedCounterevidence.status, "blocked")
assert.deepEqual(quarantinedCounterevidence.failedPhases, [22])

const unassessedCounterevidence = evaluateMutation((bundle) => {
  bundle.adversarial.assessment.findings.stronger_synthesis_disagrees = "not_assessed"
  bundle.adversarial.assessment.disposition = "contested"
})
assert.equal(unassessedCounterevidence.status, "blocked")
assert.deepEqual(unassessedCounterevidence.failedPhases, [22])

const contestedWithSafetyBlocker = evaluateMutation((bundle) => {
  bundle.adversarial.assessment.findings.stronger_synthesis_disagrees = "present"
  bundle.adversarial.assessment.disposition = "contested"
  bundle.clinicalSafety.assessment.scientificConflictStatus = "unresolved"
  bundle.clinicalSafety.assessment.findings.diagnostic_drift = "present"
  bundle.clinicalSafety.assessment.automaticBlockers = [
    "diagnosis_or_differential",
    "unresolved_scientific_conflict",
  ]
})
assert.equal(contestedWithSafetyBlocker.status, "blocked")
assert.deepEqual(contestedWithSafetyBlocker.failedPhases, [23])

const recencyShortcut = evaluateMutation((bundle) => {
  ;(bundle.adversarial.assessment as { comparisonBasis: string }).comparisonBasis = "newest_source_wins"
})
assert.deepEqual(recencyShortcut.failedPhases, [22])

const diagnosticDrift = evaluateMutation((bundle) => {
  bundle.clinicalSafety.assessment.findings.diagnostic_drift = "present"
  bundle.clinicalSafety.assessment.automaticBlockers = ["diagnosis_or_differential"]
})
assert.deepEqual(diagnosticDrift.failedPhases, [23])

const criticalSingleStudy = evaluateMutation((bundle) => {
  bundle.clinicalSafety.assessment.clinicalCriticality = "critical"
  bundle.clinicalSafety.assessment.evidenceBreadth = "single_source"
  bundle.clinicalSafety.assessment.automaticBlockers = ["critical_clinical_conclusion_from_single_source"]
})
assert.deepEqual(criticalSingleStudy.failedPhases, [23])

const unresolvedConflict = evaluateMutation((bundle) => {
  bundle.clinicalSafety.assessment.scientificConflictStatus = "unresolved"
  bundle.clinicalSafety.assessment.automaticBlockers = ["unresolved_scientific_conflict"]
})
assert.deepEqual(unresolvedConflict.failedPhases, [23])

const ambiguousAge = evaluateMutation((bundle) => {
  bundle.clinicalSafety.assessment.findings.ambiguous_age_risk = "present"
  bundle.clinicalSafety.assessment.automaticBlockers = ["ambiguous_age_risk"]
})
assert.deepEqual(ambiguousAge.failedPhases, [23])

const omittedBlocker = evaluateMutation((bundle) => {
  bundle.clinicalSafety.assessment.licenseStatus = "unclear"
  bundle.clinicalSafety.assessment.automaticBlockers = []
})
assert.deepEqual(omittedBlocker.failedPhases, [23])
assert.ok(omittedBlocker.reasons.some((reason) => reason.includes("automatic_blockers_incomplete")))

const translationStrengthened = evaluateMutation((bundle) => {
  bundle.turkishTransfer.assessment.causalStrength = "strengthened"
})
assert.deepEqual(translationStrengthened.failedPhases, [24])

const originalNotRetained = evaluateMutation((bundle) => {
  bundle.turkishTransfer.assessment.originalPassages[0]!.originalText += " Altered."
})
assert.deepEqual(originalNotRetained.failedPhases, [24])

const associationHidden = evaluateMutation((bundle) => {
  const check = bundle.turkishTransfer.assessment.termChecks.find((entry) =>
    entry.family === "association_causation")!
  check.relevance = "not_present"
  check.sourceTerms = []
  check.approvedTurkishTerms = []
})
assert.deepEqual(associationHidden.failedPhases, [24])

const missingTermFamily = evaluateMutation((bundle) => {
  bundle.turkishTransfer.assessment.termChecks = bundle.turkishTransfer.assessment.termChecks.slice(1)
})
assert.deepEqual(missingTermFamily.failedPhases, [24])

const outOfOrder = evaluateMutation((bundle) => {
  bundle.adversarial.completedAt = bundle.methodSupport.completedAt
})
assert.deepEqual(outOfOrder.failedPhases, [22])

const hiddenField = evaluateMutation((bundle) => {
  ;(bundle.sourceFidelity as unknown as Record<string, unknown>).secretApproval = true
})
assert.deepEqual(hiddenField.failedPhases, [20])

const tamperedClaim = clone(goodBundle)
;(tamperedClaim.claim as { proposition: string }).proposition = "A wider unsupported claim."
const tamperedResult = evaluateDnaClaimReviewGatesWithExplicitTestRegistry(tamperedClaim, registryFor(tamperedClaim))
assert.equal(tamperedResult.status, "blocked")
assert.deepEqual(tamperedResult.failedPhases, [20, 21, 22, 23, 24])
assert.ok(tamperedResult.reasons.some((reason) => reason.includes("claim:integrity_invalid")))

console.log("DNA claim review gates tests passed")
console.log(`production registered reviews: ${DNA_REGISTERED_CLAIM_REVIEW_RECORDS.length}`)
console.log(`synthetic positive status: ${explicitPass.status}; runtime=${explicitPass.runtimeEligible}`)
console.log("phases covered: 20,21,22,23,24")

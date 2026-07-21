#!/usr/bin/env node

import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs"
import { join, resolve } from "node:path"

const sourceIdArg = process.argv.find((argument) => argument.startsWith("--source="))
const sourceId = sourceIdArg?.slice("--source=".length)
  || "sleep-emotional-reactivity-meta-2022"
const researchSsdRoot = resolve(process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD")
const repoRoot = process.cwd()

assert.ok(researchSsdRoot.startsWith("/Volumes/ResearchSSD"),
  "method_appraisal_pilot_requires_research_ssd")
assert.match(sourceId, /^[A-Za-z0-9][A-Za-z0-9._-]{2,199}$/,
  "method_appraisal_pilot_invalid_source_id")

const sourceLibraryRoot = join(
  researchSsdRoot,
  "Datasets/SelfMetaAI/dna-knowledge/source-library",
)
const candidateRoot = join(
  researchSsdRoot,
  "Datasets/DNA-Intelligence/work/v3/candidate-corpus",
)
const appraisalRoot = join(
  researchSsdRoot,
  `Datasets/DNA-Intelligence/work/v3/method-appraisals/${sourceId}`,
)
const workpackIndexPath = join(candidateRoot, "method-review-workpack-index.json")
const workpackPath = join(candidateRoot, `method-review-workpacks/${sourceId}.json`)
const passAPath = join(appraisalRoot, "pass-a.json")
const passBPath = join(appraisalRoot, "pass-b.json")
const passBIndependenceAttestationPath = join(
  appraisalRoot,
  "pass-b-independence-attestation.json",
)
const reconciliationPath = join(appraisalRoot, "reconciliation.json")
const reconciliationRereviewPath = join(
  appraisalRoot,
  "reconciliation-rereview.json",
)
const contractPath = join(
  repoRoot,
  "docs/dna-intelligence/governance/v3/method-appraisal-contract.json",
)
const sourceGovernanceSnapshotPath = join(
  repoRoot,
  "docs/dna-intelligence/governance/v3/source-library-governance-snapshot.json",
)
const sourceIntegritySnapshotPath = join(
  repoRoot,
  "docs/dna-intelligence/governance/v3/source-integrity-archive-snapshot.json",
)
const integrityAuditPath = join(
  sourceLibraryRoot,
  "integrity-audit/v1/source-integrity-audit.json",
)
const componentLicenseAuditPath = join(
  sourceLibraryRoot,
  "governance-audit/v1/component-license-audit.json",
)

for (const path of [
  workpackIndexPath,
  workpackPath,
  passAPath,
  passBPath,
  passBIndependenceAttestationPath,
  reconciliationPath,
  reconciliationRereviewPath,
  contractPath,
  sourceGovernanceSnapshotPath,
  sourceIntegritySnapshotPath,
  integrityAuditPath,
  componentLicenseAuditPath,
]) assert.equal(existsSync(path), true, `method_appraisal_pilot_missing_file:${path}`)

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`
}

function fileSha256(path) {
  return sha256(readFileSync(path))
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function assertExactKeys(value, expected, code) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), code)
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), code)
}

function assertSha256(value, code) {
  assert.match(String(value || ""), /^[a-f0-9]{64}$/, code)
}

function singleSnapshotHash(records, relativePath, code) {
  assert.ok(Array.isArray(records), `${code}:records_invalid`)
  const matches = records.filter((record) => record?.relativePath === relativePath)
  assert.equal(matches.length, 1, `${code}:binding_missing_or_duplicate`)
  assertSha256(matches[0].sha256, `${code}:sha_invalid`)
  return matches[0].sha256
}

function singleSourceRecord(records, wantedSourceId, code) {
  assert.ok(Array.isArray(records), `${code}:records_invalid`)
  const matches = records.filter((record) => record?.sourceId === wantedSourceId)
  assert.equal(matches.length, 1, `${code}:source_missing_or_duplicate`)
  return matches[0]
}

const PASS_A_TOP_LEVEL_KEYS = Object.freeze([
  "schemaVersion", "methodAppraisalContractVersion", "implementationVersion",
  "protocolVersion", "passId", "reviewedAt", "sourceId", "status",
  "runtimeEligible", "releaseEligible", "independenceAttestation",
  "sourceBindings", "reviewBoundary", "methodFields", "adaptedGradeDimensions",
  "completionCheck",
])
const PASS_B_TOP_LEVEL_KEYS = Object.freeze([
  "schemaVersion", "implementationVersion", "protocolVersion", "reviewPass",
  "reviewMode", "sourceId", "assessmentStatus", "sourceBinding",
  "contractBinding", "methodFields", "adaptedGradeDimensions", "appraisalBoundary",
])
const RECONCILIATION_TOP_LEVEL_KEYS = Object.freeze([
  "schemaVersion", "methodAppraisalContractVersion", "implementationVersion",
  "protocolVersion", "passId", "sourceId", "status", "runtimeEligible",
  "releaseEligible", "inputBindings", "reconciliationBoundary",
  "comparisonSummary", "methodFields", "adaptedGradeDimensions",
  "allUsedParagraphIds", "completionCheck",
])
const REREVIEW_TOP_LEVEL_KEYS = Object.freeze([
  "schemaVersion", "implementationVersion", "reviewType", "sourceId", "status",
  "runtimeEligible", "releaseEligible", "rereviewedAt", "previousReconciliation",
  "changeLog", "independentFidelityFinding", "locatorBindings",
  "immutabilityVerification", "applicationRule", "authorityBoundary",
  "canonicalization", "canonicalPayloadSha256",
])

const PASS_A_METHOD_STATES = Object.freeze([
  "not_reported", "partially_reported", "reported", "reported_with_boundary",
  "reported_with_concerns",
])
const PASS_B_METHOD_STATES = Object.freeze([
  "not_reported", "partially_reported", "reported",
])
const PASS_A_GRADE_STATES = Object.freeze([
  "not_assessed", "concerns_present_candidate_observation",
])
const PASS_B_GRADE_STATES = Object.freeze(["not_assessed", "assessed"])
const PASS_B_GRADE_ASSESSMENTS = Object.freeze(["not_assessed", "concerns_present"])
const METHOD_COMPARISON_STATES = Object.freeze([
  "agreement", "partial_agreement", "disagreement_resolved", "unresolved",
])
const GRADE_COMPARISON_STATES = Object.freeze(["agreement"])

function assertEnum(value, allowed, code) {
  assert.equal(typeof value, "string", code)
  assert.equal(allowed.includes(value), true, `${code}:${value}`)
}

function assertRequiredAllowedKeys(value, required, optional, code) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${code}:shape`)
  const allowed = new Set([...required, ...optional])
  assert.equal(Object.keys(value).every((key) => allowed.has(key)), true, `${code}:unknown_key`)
  assert.equal(required.every((key) => Object.hasOwn(value, key)), true, `${code}:missing_key`)
}

function assertPassATopLevelShape(value) {
  assertExactKeys(value, PASS_A_TOP_LEVEL_KEYS, "method_appraisal_pilot_pass_a_shape")
  assertExactKeys(value.independenceAttestation, [
    "independentPass", "otherReviewerOutputsRead", "inputsUsed",
    "inferenceFromTitleOrSourceRoleUsed",
  ], "method_appraisal_pilot_pass_a_independence_shape")
  assertExactKeys(value.sourceBindings, [
    "artifactId", "artifactSha256", "declaredWorkpackSha256",
    "methodAppraisalContractFileSha256", "parsedContentSha256", "workpackFileSha256",
  ], "method_appraisal_pilot_pass_a_source_binding_shape")
  assertExactKeys(value.reviewBoundary, [
    "unitOfAssessment", "findingAuthority", "bodyOfEvidenceCertainty",
    "numericQualityScore", "dnaProductValidityAssessed",
    "individualClinicalInferenceAllowed", "note",
  ], "method_appraisal_pilot_pass_a_boundary_shape")
  assertExactKeys(value.completionCheck, [
    "requiredMethodFieldCount", "completedMethodFieldCount",
    "adaptedGradeDimensionCount", "completedAdaptedGradeDimensionCount",
    "allAssertedFindingsHaveParagraphEvidence",
    "unknownsPreservedAsNotReportedOrNotAssessed",
    "bodyOfEvidenceCertaintyAssigned", "numericQualityScoreAssigned",
  ], "method_appraisal_pilot_pass_a_completion_shape")
  assertEnum(value.status, ["candidate_only"], "method_appraisal_pilot_pass_a_status_invalid")
  assertEnum(value.schemaVersion, ["dna-method-appraisal-review-pass@1"],
    "method_appraisal_pilot_pass_a_schema_invalid")
  assertEnum(value.methodAppraisalContractVersion, ["dna-method-appraisal-contract@1"],
    "method_appraisal_pilot_pass_a_contract_invalid")
  assertEnum(value.implementationVersion, ["dna-method-appraisal@1"],
    "method_appraisal_pilot_pass_a_implementation_invalid")
  assertEnum(value.protocolVersion, ["dna-method-appraisal-protocol@1"],
    "method_appraisal_pilot_pass_a_protocol_invalid")
  assertEnum(value.passId, ["method_appraisal_a"], "method_appraisal_pilot_pass_a_id_invalid")
  assertEnum(value.reviewBoundary.unitOfAssessment, ["single_source"],
    "method_appraisal_pilot_pass_a_unit_invalid")
  assertEnum(value.reviewBoundary.findingAuthority, ["candidate_review_pass_only"],
    "method_appraisal_pilot_pass_a_authority_invalid")
  assertEnum(value.reviewBoundary.bodyOfEvidenceCertainty, ["not_assessed"],
    "method_appraisal_pilot_pass_a_certainty_invalid")
}

function assertPassBTopLevelShape(value) {
  assertExactKeys(value, PASS_B_TOP_LEVEL_KEYS, "method_appraisal_pilot_pass_b_shape")
  assertExactKeys(value.sourceBinding, [
    "workpackSchemaVersion", "workpackFileSha256", "workpackPayloadSha256",
    "artifactId", "artifactSha256", "parsedContentSha256", "integrityState",
    "candidateStatus", "runtimeEligible", "releaseEligible",
  ], "method_appraisal_pilot_pass_b_source_binding_shape")
  assertExactKeys(value.contractBinding, ["schemaVersion", "fileSha256"],
    "method_appraisal_pilot_pass_b_contract_binding_shape")
  assertEnum(value.reviewPass, ["method_appraisal_b"],
    "method_appraisal_pilot_pass_b_id_invalid")
  assertEnum(value.schemaVersion, ["dna-method-appraisal-pass@1"],
    "method_appraisal_pilot_pass_b_schema_invalid")
  assertEnum(value.implementationVersion, ["dna-method-appraisal@1"],
    "method_appraisal_pilot_pass_b_implementation_invalid")
  assertEnum(value.protocolVersion, ["dna-method-appraisal-protocol@1"],
    "method_appraisal_pilot_pass_b_protocol_invalid")
  assertEnum(value.reviewMode, ["independent_candidate_only"],
    "method_appraisal_pilot_pass_b_mode_invalid")
  assertEnum(value.assessmentStatus, ["pending_multi_pass_reconciliation"],
    "method_appraisal_pilot_pass_b_status_invalid")
  assertEnum(value.sourceBinding.candidateStatus, ["candidate_only"],
    "method_appraisal_pilot_pass_b_candidate_status_invalid")
  assertEnum(value.sourceBinding.integrityState, ["verified_clean"],
    "method_appraisal_pilot_pass_b_integrity_invalid")
  assert.ok(Array.isArray(value.appraisalBoundary)
    && value.appraisalBoundary.length > 0
    && value.appraisalBoundary.every((row) => typeof row === "string" && row.trim()),
  "method_appraisal_pilot_pass_b_boundary_invalid")
}

function assertReconciliationTopLevelShape(value) {
  assertExactKeys(value, RECONCILIATION_TOP_LEVEL_KEYS,
    "method_appraisal_pilot_reconciliation_shape")
  assertExactKeys(value.inputBindings, ["passA", "passB", "contract", "workpack"],
    "method_appraisal_pilot_reconciliation_input_shape")
  assertExactKeys(value.inputBindings.passA, ["passId", "fileSha256"],
    "method_appraisal_pilot_reconciliation_pass_a_binding_shape")
  assertExactKeys(value.inputBindings.passB, ["passId", "fileSha256"],
    "method_appraisal_pilot_reconciliation_pass_b_binding_shape")
  assertExactKeys(value.inputBindings.contract, ["schemaVersion", "fileSha256"],
    "method_appraisal_pilot_reconciliation_contract_binding_shape")
  assertExactKeys(value.inputBindings.workpack, [
    "schemaVersion", "fileSha256", "declaredWorkpackSha256", "artifactId",
    "artifactSha256", "parsedContentSha256", "integrityState", "candidateStatus",
  ], "method_appraisal_pilot_reconciliation_workpack_binding_shape")
  assertExactKeys(value.reconciliationBoundary, [
    "unitOfAssessment", "authority", "bodyOfEvidenceCertaintyAssigned",
    "numericQualityScoreAssigned", "dnaProductValidityAssessed",
    "individualClinicalInferenceAllowed", "trustedRegistryBound",
    "auditedAppraisalStatusGranted", "note",
  ], "method_appraisal_pilot_reconciliation_boundary_shape")
  assertExactKeys(value.comparisonSummary, [
    "methodFieldCount", "methodAgreementCount", "methodPartialAgreementCount",
    "methodDisagreementResolvedCount", "adaptedGradeDimensionCount",
    "adaptedGradeAgreementCount", "unresolvedMethodFieldCount",
    "bodyOfEvidenceCertaintyAssigned", "numericQualityScoreAssigned",
  ], "method_appraisal_pilot_reconciliation_comparison_shape")
  assertExactKeys(value.completionCheck, [
    "requiredMethodFieldCount", "reconciledMethodFieldCount",
    "adaptedGradeDimensionCount", "reconciledAdaptedGradeDimensionCount",
    "allAssertedFindingsHaveParagraphEvidence", "allLocatorsResolveToBoundWorkpack",
    "unknownsPreservedAsNotReportedOrNotAssessed",
    "bodyOfEvidenceCertaintyAssigned", "numericQualityScoreAssigned",
    "dnaProductValidityAssessed", "runtimeOrReleaseAuthorityGranted",
  ], "method_appraisal_pilot_reconciliation_completion_shape")
  assertEnum(value.status, ["candidate_only"],
    "method_appraisal_pilot_reconciliation_status_invalid")
  assertEnum(value.schemaVersion, ["dna-method-appraisal-reconciliation@1"],
    "method_appraisal_pilot_reconciliation_schema_invalid")
  assertEnum(value.methodAppraisalContractVersion, ["dna-method-appraisal-contract@1"],
    "method_appraisal_pilot_reconciliation_contract_invalid")
  assertEnum(value.implementationVersion, ["dna-method-appraisal@1"],
    "method_appraisal_pilot_reconciliation_implementation_invalid")
  assertEnum(value.protocolVersion, ["dna-method-appraisal-protocol@1"],
    "method_appraisal_pilot_reconciliation_protocol_invalid")
  assertEnum(value.passId, ["method_appraisal_reconciliation"],
    "method_appraisal_pilot_reconciliation_id_invalid")
  assertEnum(value.reconciliationBoundary.unitOfAssessment, ["single_source"],
    "method_appraisal_pilot_reconciliation_unit_invalid")
  assertEnum(value.reconciliationBoundary.authority, ["candidate_reconciliation_only"],
    "method_appraisal_pilot_reconciliation_authority_invalid")
}

function assertRereviewTopLevelShape(value) {
  assertExactKeys(value, REREVIEW_TOP_LEVEL_KEYS,
    "method_appraisal_pilot_reconciliation_rereview_shape")
  assertExactKeys(value.previousReconciliation, ["path", "schemaVersion", "sha256"],
    "method_appraisal_pilot_rereview_previous_shape")
  assert.ok(Array.isArray(value.changeLog), "method_appraisal_pilot_rereview_change_log_shape")
  for (const change of value.changeLog) assertExactKeys(change, [
    "changeId", "operation", "jsonPointer", "occurrenceCountInBoundBase",
    "beforeExact", "afterExact", "beforeFullValue", "afterFullValue", "semanticScope",
  ], "method_appraisal_pilot_rereview_change_shape")
  assertExactKeys(value.independentFidelityFinding, [
    "findingId", "disposition", "rationale", "evidenceParagraphIds",
  ], "method_appraisal_pilot_rereview_fidelity_shape")
  assertExactKeys(value.locatorBindings, [
    "allUsedParagraphIdCount", "allUsedParagraphIdsCanonicalSha256",
    "missingDataEvidenceParagraphIds", "missingDataEvidenceParagraphIdsCanonicalSha256",
    "locatorSetChanged",
  ], "method_appraisal_pilot_rereview_locator_shape")
  assertExactKeys(value.immutabilityVerification, [
    "effectiveReconciliationBytesSha256", "unchangedOther24FieldsCanonicalSha256",
    "baseWithTargetFindingMaskedCanonicalSha256",
    "effectiveWithTargetFindingMaskedCanonicalSha256", "methodFieldCount",
    "adaptedGradeDimensionCount", "meaningfulChangeCount",
    "other24FieldsSemanticallyUnchanged", "locatorBytesSemanticallyUnchanged",
    "previousReconciliationModified",
  ], "method_appraisal_pilot_rereview_immutability_shape")
  assertExactKeys(value.authorityBoundary, [
    "candidateOnly", "bodyOfEvidenceCertaintyAssigned", "numericQualityScoreAssigned",
    "dnaProductValidityAssessed", "runtimeEligible", "releaseEligible",
    "trustedRegistryStatusGranted",
  ], "method_appraisal_pilot_rereview_authority_shape")
  assertEnum(value.status, ["candidate_only"],
    "method_appraisal_pilot_rereview_status_invalid")
  assertEnum(value.schemaVersion, ["dna-method-appraisal-reconciliation-rereview@1"],
    "method_appraisal_pilot_rereview_schema_invalid")
  assertEnum(value.implementationVersion, ["dna-method-appraisal@1"],
    "method_appraisal_pilot_rereview_implementation_invalid")
  assertEnum(value.reviewType, ["source_fidelity_narrowing_follow_up"],
    "method_appraisal_pilot_rereview_type_invalid")
  assertEnum(value.canonicalization, [
    "recursive_lexicographic_json_utf8_without_canonicalPayloadSha256",
  ], "method_appraisal_pilot_rereview_canonicalization_invalid")
  assertEnum(value.independentFidelityFinding.disposition, ["narrowed"],
    "method_appraisal_pilot_rereview_disposition_invalid")
  for (const change of value.changeLog) {
    assertEnum(change.operation, ["replace_exact_substring"],
      "method_appraisal_pilot_rereview_operation_invalid")
    assertEnum(change.semanticScope, ["narrow_frequency_language_only"],
      "method_appraisal_pilot_rereview_scope_invalid")
  }
}

function assertCandidateOnly(value, code) {
  assert.equal(value.status, "candidate_only", `${code}:status`)
  assert.equal(value.runtimeEligible, false, `${code}:runtime`)
  assert.equal(value.releaseEligible, false, `${code}:release`)
}

function exactSet(values, expected, code) {
  assert.deepEqual([...new Set(values)].sort(), [...new Set(expected)].sort(), code)
}

function evidenceIdsFromRecord(record) {
  return Array.isArray(record?.evidenceParagraphIds) ? record.evidenceParagraphIds : []
}

function validateEvidenceRecords(
  records,
  requiredKeys,
  paragraphIds,
  stateKey,
  code,
  options = {},
) {
  exactSet(Object.keys(records), requiredKeys, `${code}:field_set`)
  const allIds = []
  for (const key of requiredKeys) {
    const record = records[key]
    assert.ok(record && typeof record === "object" && !Array.isArray(record), `${code}:${key}:shape`)
    if (options.requiredRecordKeys) {
      assertRequiredAllowedKeys(
        record,
        options.requiredRecordKeys,
        options.optionalRecordKeys || [],
        `${code}:${key}:keys`,
      )
    }
    if (options.recordShapeForKey) options.recordShapeForKey(record, key, code)
    const state = record[stateKey]
    if (options.allowedStates) {
      assertEnum(state, options.allowedStates, `${code}:${key}:state_invalid`)
    } else {
      assert.equal(typeof state, "string", `${code}:${key}:state`)
    }
    const ids = evidenceIdsFromRecord(record)
    assert.ok(Array.isArray(record.evidenceParagraphIds), `${code}:${key}:locator_shape`)
    assert.equal(ids.every((id) => typeof id === "string" && id.trim()), true,
      `${code}:${key}:locator_invalid`)
    assert.equal(new Set(ids).size, ids.length, `${code}:${key}:duplicate_locator`)
    for (const id of ids) {
      assert.equal(paragraphIds.has(id), true, `${code}:${key}:unknown_locator:${id}`)
      allIds.push(id)
    }
    const finding = record.finding ?? record.value ?? record.rationale
      ?? record.sourceReportedSignals ?? ""
    const unknown = finding === "not_reported" || finding === "not_assessed"
    if (!unknown) assert.ok(ids.length > 0, `${code}:${key}:assertion_without_locator`)
  }
  return allIds
}

function allAssertedFindingsHaveEvidence(records, stateKey) {
  return Object.values(records).every((record) => {
    assert.equal(typeof record[stateKey], "string")
    const finding = record.finding ?? record.value ?? record.rationale
      ?? record.sourceReportedSignals ?? ""
    const unknown = finding === "not_reported" || finding === "not_assessed"
    return unknown || evidenceIdsFromRecord(record).length > 0
  })
}

function allLocatorsResolve(records, paragraphIds) {
  return Object.values(records).every((record) =>
    evidenceIdsFromRecord(record).every((id) => paragraphIds.has(id)))
}

function unknownMethodStatesPreserved(records, stateKey, findingKey) {
  return Object.values(records).every((record) => {
    const state = record[stateKey]
    const finding = record[findingKey]
    return (state !== "not_reported" || finding === "not_reported")
      && (finding !== "not_reported" || state === "not_reported")
  })
}

function unknownGradeStatesPreserved(records, stateKey, findingKey) {
  return Object.values(records).every((record) => {
    const state = record[stateKey]
    const finding = record[findingKey]
    return finding !== "not_assessed" || state === "not_assessed"
  })
}

function expectedPassACompletion(pass, contractValue) {
  return {
    requiredMethodFieldCount: contractValue.requiredFields.length,
    completedMethodFieldCount: Object.keys(pass.methodFields).length,
    adaptedGradeDimensionCount: contractValue.adaptedGradeDimensions.length,
    completedAdaptedGradeDimensionCount: Object.keys(pass.adaptedGradeDimensions).length,
    allAssertedFindingsHaveParagraphEvidence:
      allAssertedFindingsHaveEvidence(pass.methodFields, "reportingState")
      && allAssertedFindingsHaveEvidence(pass.adaptedGradeDimensions, "assessment"),
    unknownsPreservedAsNotReportedOrNotAssessed:
      unknownMethodStatesPreserved(pass.methodFields, "reportingState", "finding")
      && unknownGradeStatesPreserved(pass.adaptedGradeDimensions, "assessment", "finding"),
    bodyOfEvidenceCertaintyAssigned:
      pass.reviewBoundary.bodyOfEvidenceCertainty !== "not_assessed",
    numericQualityScoreAssigned: pass.reviewBoundary.numericQualityScore !== null,
  }
}

function expectedReconciliationCompletion(value, contractValue, paragraphIds) {
  return {
    requiredMethodFieldCount: contractValue.requiredFields.length,
    reconciledMethodFieldCount: Object.keys(value.methodFields).length,
    adaptedGradeDimensionCount: contractValue.adaptedGradeDimensions.length,
    reconciledAdaptedGradeDimensionCount: Object.keys(value.adaptedGradeDimensions).length,
    allAssertedFindingsHaveParagraphEvidence:
      allAssertedFindingsHaveEvidence(value.methodFields, "reconciledReportingState")
      && allAssertedFindingsHaveEvidence(value.adaptedGradeDimensions, "reconciledAssessment"),
    allLocatorsResolveToBoundWorkpack:
      allLocatorsResolve(value.methodFields, paragraphIds)
      && allLocatorsResolve(value.adaptedGradeDimensions, paragraphIds),
    unknownsPreservedAsNotReportedOrNotAssessed:
      unknownMethodStatesPreserved(
        value.methodFields,
        "reconciledReportingState",
        "finding",
      ) && unknownGradeStatesPreserved(
        value.adaptedGradeDimensions,
        "reconciledAssessment",
        "finding",
      ),
    bodyOfEvidenceCertaintyAssigned:
      value.reconciliationBoundary.bodyOfEvidenceCertaintyAssigned,
    numericQualityScoreAssigned:
      value.reconciliationBoundary.numericQualityScoreAssigned,
    dnaProductValidityAssessed:
      value.reconciliationBoundary.dnaProductValidityAssessed,
    runtimeOrReleaseAuthorityGranted: Boolean(
      value.runtimeEligible
      || value.releaseEligible
      || value.reconciliationBoundary.auditedAppraisalStatusGranted
      || value.reconciliationBoundary.trustedRegistryBound
    ),
  }
}

function expectedReconciliationComparisonSummary(value) {
  const methodComparisons = Object.values(value.methodFields).map((record) => record.comparison)
  const gradeComparisons = Object.values(value.adaptedGradeDimensions)
    .map((record) => record.comparison)
  const count = (values, target) => values.filter((item) => item === target).length
  return {
    methodFieldCount: methodComparisons.length,
    methodAgreementCount: count(methodComparisons, "agreement"),
    methodPartialAgreementCount: count(methodComparisons, "partial_agreement"),
    methodDisagreementResolvedCount: count(methodComparisons, "disagreement_resolved"),
    adaptedGradeDimensionCount: gradeComparisons.length,
    adaptedGradeAgreementCount: count(gradeComparisons, "agreement"),
    unresolvedMethodFieldCount: count(methodComparisons, "unresolved"),
    bodyOfEvidenceCertaintyAssigned:
      value.reconciliationBoundary.bodyOfEvidenceCertaintyAssigned,
    numericQualityScoreAssigned:
      value.reconciliationBoundary.numericQualityScoreAssigned,
  }
}

const contract = readJson(contractPath)
assert.equal(contract.schemaVersion, "dna-method-appraisal-contract@1")
assert.equal(contract.requiredFields.length, 20)
assert.equal(contract.adaptedGradeDimensions.length, 5)
const contractFileSha256 = fileSha256(contractPath)

const workpackIndex = readJson(workpackIndexPath)
assertExactKeys(workpackIndex, [
  "schemaVersion", "sourceLibraryAuditAt", "governanceInputBindings", "records",
  "indexSha256",
], "method_appraisal_pilot_index_shape")
assert.equal(workpackIndex.schemaVersion, "dna-v3-method-review-workpack-index@3")
const indexCore = {
  schemaVersion: workpackIndex.schemaVersion,
  sourceLibraryAuditAt: workpackIndex.sourceLibraryAuditAt,
  governanceInputBindings: workpackIndex.governanceInputBindings,
  records: workpackIndex.records,
}
assert.equal(workpackIndex.indexSha256, sha256(JSON.stringify(indexCore)),
  "method_appraisal_pilot_index_hash_mismatch")
const integrityAudit = readJson(integrityAuditPath)
const componentLicenseAudit = readJson(componentLicenseAuditPath)
const sourceIntegritySnapshot = readJson(sourceIntegritySnapshotPath)
const sourceGovernanceSnapshot = readJson(sourceGovernanceSnapshotPath)
assert.equal(integrityAudit.schemaVersion, "dna-source-integrity-audit@2")
assert.equal(componentLicenseAudit.schemaVersion, "dna-component-license-audit@2")
assert.equal(sourceIntegritySnapshot.schemaVersion,
  "dna-source-integrity-archive-snapshot@1")
assert.equal(sourceGovernanceSnapshot.schemaVersion,
  "dna-source-library-governance-snapshot@1")
const expectedIntegrityAuditSha256 = singleSnapshotHash(
  sourceIntegritySnapshot.ssdAuditFiles,
  "Datasets/SelfMetaAI/dna-knowledge/source-library/integrity-audit/v1/source-integrity-audit.json",
  "method_appraisal_pilot_integrity_snapshot",
)
const expectedComponentLicenseAuditSha256 = singleSnapshotHash(
  sourceGovernanceSnapshot.manifests,
  "governance-audit/v1/component-license-audit.json",
  "method_appraisal_pilot_license_snapshot",
)
assert.deepEqual(workpackIndex.governanceInputBindings, {
  sourceIntegritySnapshotSha256: fileSha256(sourceIntegritySnapshotPath),
  sourceIntegritySnapshotExpectedAuditSha256: expectedIntegrityAuditSha256,
  integrityAuditSha256: fileSha256(integrityAuditPath),
  integrityAuditCheckedAt: integrityAudit.checkedAt,
  sourceGovernanceSnapshotSha256: fileSha256(sourceGovernanceSnapshotPath),
  sourceGovernanceSnapshotExpectedComponentLicenseAuditSha256:
    expectedComponentLicenseAuditSha256,
  componentLicenseAuditSha256: fileSha256(componentLicenseAuditPath),
  componentLicenseAuditAt: componentLicenseAudit.auditedAt,
  componentLicenseAuditorVersion: componentLicenseAudit.auditorImplementation.version,
  componentLicenseAuditorScriptSha256:
    componentLicenseAudit.auditorImplementation.scriptSha256,
}, "method_appraisal_pilot_governance_input_binding_mismatch")
assert.equal(expectedIntegrityAuditSha256, fileSha256(integrityAuditPath),
  "method_appraisal_pilot_integrity_snapshot_audit_hash_mismatch")
assert.equal(expectedComponentLicenseAuditSha256, fileSha256(componentLicenseAuditPath),
  "method_appraisal_pilot_license_snapshot_audit_hash_mismatch")
assert.equal(sourceIntegritySnapshot.auditedAt, integrityAudit.checkedAt,
  "method_appraisal_pilot_integrity_snapshot_time_mismatch")

const workpackIndexRecord = workpackIndex.records.find((record) =>
  record.sourceId === sourceId)
assert.ok(workpackIndexRecord, "method_appraisal_pilot_source_not_in_authoritative_index")
assertExactKeys(workpackIndexRecord, [
  "sourceId", "relativePath", "workpackSha256", "sourceRecordSha256",
  "integrityState", "integrityAuditRecordSha256", "integrityDecisionSha256",
  "passageLicenseDecision", "componentLicenseAuditRecordSha256",
  "sourceGovernanceLicenseRecordSha256", "passageLicenseDecisionSha256",
], "method_appraisal_pilot_index_record_shape")
assert.equal(workpackIndexRecord.relativePath, `method-review-workpacks/${sourceId}.json`)
assertSha256(workpackIndexRecord.workpackSha256,
  "method_appraisal_pilot_invalid_workpack_hash")

const workpack = readJson(workpackPath)
assertExactKeys(workpack, [
  "schemaVersion", "status", "runtimeEligible", "releaseEligible", "sourceId",
  "sourceRecordRelativePath", "sourceRecordSha256", "title", "declaredStudyDesign",
  "declaredScopeBoundary", "artifactId", "artifactRelativePath", "artifactSha256",
  "parsedContentSha256", "integrityState", "integrityAuditRecordSha256",
  "integrityDecisionSha256", "passageLicenseDecision",
  "componentLicenseAuditRecordSha256", "sourceGovernanceLicenseRecordSha256",
  "passageLicenseDecisionSha256", "paragraphCount", "exclusionCount", "paragraphs",
  "exclusions", "reviewBoundary", "workpackSha256",
], "method_appraisal_pilot_workpack_shape")
assertCandidateOnly(workpack, "method_appraisal_pilot_workpack")
assert.equal(workpack.schemaVersion, "dna-v3-method-review-workpack@2")
assert.equal(workpack.sourceId, sourceId)
assert.equal(workpack.integrityState, "verified_clean")
assert.equal(workpack.passageLicenseDecision, "cleared")
const { workpackSha256: embeddedWorkpackSha256, ...workpackCore } = workpack
const computedWorkpackSha256 = sha256(JSON.stringify(workpackCore))
assert.equal(embeddedWorkpackSha256, computedWorkpackSha256,
  "method_appraisal_pilot_embedded_workpack_hash_mismatch")
assert.equal(workpackIndexRecord.workpackSha256, computedWorkpackSha256,
  "method_appraisal_pilot_index_workpack_hash_mismatch")
for (const field of [
  "sourceRecordSha256", "integrityState", "integrityAuditRecordSha256",
  "integrityDecisionSha256", "passageLicenseDecision",
  "componentLicenseAuditRecordSha256", "sourceGovernanceLicenseRecordSha256",
  "passageLicenseDecisionSha256",
]) assert.equal(workpackIndexRecord[field], workpack[field],
  `method_appraisal_pilot_index_workpack_binding_mismatch:${field}`)

const integrityAuditRecord = singleSourceRecord(
  integrityAudit.records,
  sourceId,
  "method_appraisal_pilot_integrity_record",
)
const componentLicenseAuditRecord = singleSourceRecord(
  componentLicenseAudit.records,
  sourceId,
  "method_appraisal_pilot_component_license_record",
)
const sourceGovernanceLicenseRecord = singleSourceRecord(
  sourceGovernanceSnapshot.licenseRecords,
  sourceId,
  "method_appraisal_pilot_source_governance_license_record",
)
const passageComponents = componentLicenseAuditRecord.components.filter((component) =>
  component?.component === "passage")
assert.equal(passageComponents.length, 1,
  "method_appraisal_pilot_passage_component_missing_or_duplicate")
const passageComponent = passageComponents[0]
assert.equal(componentLicenseAuditRecord.policy, sourceGovernanceLicenseRecord.policy,
  "method_appraisal_pilot_component_snapshot_policy_mismatch")
assert.deepEqual(componentLicenseAuditRecord.obligations,
  sourceGovernanceLicenseRecord.obligations,
  "method_appraisal_pilot_component_snapshot_obligations_mismatch")
assert.equal(passageComponent.decision,
  sourceGovernanceLicenseRecord.decisions.passage,
  "method_appraisal_pilot_component_snapshot_passage_decision_mismatch")
assert.equal(passageComponent.evidence?.basis,
  sourceGovernanceLicenseRecord.evidenceBasis.passage,
  "method_appraisal_pilot_component_snapshot_passage_evidence_mismatch")

const expectedSourceDecisionBindings = {
  integrityAuditRecordSha256: sha256(JSON.stringify(integrityAuditRecord)),
  integrityDecisionSha256: sha256(JSON.stringify({
    sourceId,
    state: integrityAuditRecord.state,
    runtimeEligibility: integrityAuditRecord.runtimeEligibility || null,
    auditSha256: integrityAuditRecord.auditSha256 || null,
  })),
  componentLicenseAuditRecordSha256:
    sha256(JSON.stringify(componentLicenseAuditRecord)),
  sourceGovernanceLicenseRecordSha256:
    sha256(JSON.stringify(sourceGovernanceLicenseRecord)),
  passageLicenseDecisionSha256: sha256(JSON.stringify({
    sourceId,
    component: "passage",
    decision: passageComponent.decision,
    evidence: passageComponent.evidence || null,
    snapshotMatrixSha256: sourceGovernanceLicenseRecord.matrixSha256,
    auditorVersion: componentLicenseAudit.auditorImplementation.version,
    auditorScriptSha256: componentLicenseAudit.auditorImplementation.scriptSha256,
  })),
}
for (const [field, expected] of Object.entries(expectedSourceDecisionBindings)) {
  assert.equal(workpack[field], expected,
    `method_appraisal_pilot_source_decision_binding_mismatch:${field}`)
}
assert.equal(workpack.integrityState, integrityAuditRecord.state,
  "method_appraisal_pilot_integrity_state_mismatch")
assert.equal(workpack.passageLicenseDecision, passageComponent.decision,
  "method_appraisal_pilot_passage_license_decision_mismatch")

const sourceLibraryRealRoot = realpathSync(sourceLibraryRoot)
const sourceRecordPath = resolve(sourceLibraryRealRoot, workpack.sourceRecordRelativePath)
assert.equal(sourceRecordPath.startsWith(`${sourceLibraryRealRoot}/`), true,
  "method_appraisal_pilot_source_record_outside_library")
assert.equal(existsSync(sourceRecordPath) && lstatSync(sourceRecordPath).isFile(), true,
  "method_appraisal_pilot_source_record_missing_or_not_regular")
assert.equal(realpathSync(sourceRecordPath).startsWith(`${sourceLibraryRealRoot}/`), true,
  "method_appraisal_pilot_source_record_symlink_escape")
assert.equal(fileSha256(sourceRecordPath), workpack.sourceRecordSha256,
  "method_appraisal_pilot_source_record_hash_mismatch")
assert.equal(workpack.paragraphCount, workpack.paragraphs.length)
const paragraphIds = new Set(workpack.paragraphs.map((paragraph) => paragraph.paragraphId))
assert.equal(paragraphIds.size, workpack.paragraphs.length,
  "method_appraisal_pilot_duplicate_workpack_locator")

const passA = readJson(passAPath)
assertPassATopLevelShape(passA)
assertCandidateOnly(passA, "method_appraisal_pilot_pass_a")
assert.equal(passA.schemaVersion, "dna-method-appraisal-review-pass@1")
assert.equal(passA.passId, "method_appraisal_a")
assert.equal(passA.sourceId, sourceId)
assert.equal(passA.independenceAttestation.independentPass, true)
assert.equal(passA.independenceAttestation.otherReviewerOutputsRead, false)
assertSha256(passA.sourceBindings.declaredWorkpackSha256,
  "method_appraisal_pilot_pass_a_legacy_workpack_payload_hash_invalid")
assertSha256(passA.sourceBindings.workpackFileSha256,
  "method_appraisal_pilot_pass_a_legacy_workpack_file_hash_invalid")
assert.equal(passA.sourceBindings.methodAppraisalContractFileSha256, contractFileSha256)
assert.equal(passA.sourceBindings.artifactSha256, workpack.artifactSha256)
assert.equal(passA.sourceBindings.parsedContentSha256, workpack.parsedContentSha256)
validateEvidenceRecords(
  passA.methodFields,
  contract.requiredFields,
  paragraphIds,
  "reportingState",
  "method_appraisal_pilot_pass_a_method",
  {
    allowedStates: PASS_A_METHOD_STATES,
    requiredRecordKeys: ["reportingState", "finding", "evidenceParagraphIds"],
    optionalRecordKeys: ["boundary"],
  },
)
validateEvidenceRecords(
  passA.adaptedGradeDimensions,
  contract.adaptedGradeDimensions,
  paragraphIds,
  "assessment",
  "method_appraisal_pilot_pass_a_grade",
  {
    allowedStates: PASS_A_GRADE_STATES,
    recordShapeForKey: (record, key, code) => {
      const sourceSignalOnly = key === "inconsistency" || key === "publicationBias"
      assertExactKeys(record, sourceSignalOnly
        ? ["assessment", "sourceReportedSignals", "evidenceParagraphIds", "boundary"]
        : ["assessment", "finding", "evidenceParagraphIds", "certaintyEffect"],
      `${code}:${key}:keys`)
    },
  },
)
assert.deepEqual(passA.completionCheck, expectedPassACompletion(passA, contract),
  "method_appraisal_pilot_pass_a_completion_mismatch")

const passB = readJson(passBPath)
assertPassBTopLevelShape(passB)
assert.equal(passB.schemaVersion, "dna-method-appraisal-pass@1")
assert.equal(passB.reviewPass, "method_appraisal_b")
assert.equal(passB.reviewMode, "independent_candidate_only")
assert.equal(passB.sourceId, sourceId)
assert.equal(passB.assessmentStatus, "pending_multi_pass_reconciliation")
assert.equal(passB.sourceBinding.candidateStatus, "candidate_only")
assert.equal(passB.sourceBinding.runtimeEligible, false)
assert.equal(passB.sourceBinding.releaseEligible, false)
assert.equal(passB.sourceBinding.workpackSchemaVersion,
  "dna-v3-method-review-workpack@1")
assertSha256(passB.sourceBinding.workpackPayloadSha256,
  "method_appraisal_pilot_pass_b_legacy_workpack_payload_hash_invalid")
assertSha256(passB.sourceBinding.workpackFileSha256,
  "method_appraisal_pilot_pass_b_legacy_workpack_file_hash_invalid")
assert.equal(passB.contractBinding.fileSha256, contractFileSha256)
assert.equal(passB.sourceBinding.artifactSha256, workpack.artifactSha256)
assert.equal(passB.sourceBinding.parsedContentSha256, workpack.parsedContentSha256)
validateEvidenceRecords(
  passB.methodFields,
  contract.requiredFields,
  paragraphIds,
  "status",
  "method_appraisal_pilot_pass_b_method",
  {
    allowedStates: PASS_B_METHOD_STATES,
    requiredRecordKeys: ["status", "value", "evidenceParagraphIds"],
  },
)
validateEvidenceRecords(
  passB.adaptedGradeDimensions,
  contract.adaptedGradeDimensions,
  paragraphIds,
  "status",
  "method_appraisal_pilot_pass_b_grade",
  {
    allowedStates: PASS_B_GRADE_STATES,
    requiredRecordKeys: ["status", "appraisal", "rationale", "evidenceParagraphIds"],
    recordShapeForKey: (record, key, code) => assertEnum(
      record.appraisal,
      PASS_B_GRADE_ASSESSMENTS,
      `${code}:${key}:appraisal_invalid`,
    ),
  },
)

const passBIndependenceAttestation = readJson(passBIndependenceAttestationPath)
assert.equal(passBIndependenceAttestation.schemaVersion,
  "dna-method-appraisal-independence-attestation@1")
assert.equal(passBIndependenceAttestation.sourceId, sourceId)
assert.equal(passBIndependenceAttestation.status, "candidate_only")
assert.equal(passBIndependenceAttestation.frozenPassB.sha256, fileSha256(passBPath))
assert.equal(passBIndependenceAttestation.independenceAttestation.passAReadBeforePassBFrozen,
  false)
assert.equal(passBIndependenceAttestation.independenceAttestation.passAReadDuringPassBAuthoring,
  false)
assert.equal(passBIndependenceAttestation.independenceAttestation.passAFirstReadStage,
  "method_appraisal_reconciliation")
assert.equal(passBIndependenceAttestation.independenceAttestation.retrospective, true)
assert.ok(Date.parse(passBIndependenceAttestation.attestedAt)
  > Date.parse(passBIndependenceAttestation.frozenPassB.frozenAt),
"method_appraisal_pilot_attestation_chronology_invalid")
assert.equal(passBIndependenceAttestation.authorityBoundary.candidateOnly, true)
assert.equal(passBIndependenceAttestation.authorityBoundary.runtimeEligible, false)
assert.equal(passBIndependenceAttestation.authorityBoundary.releaseEligible, false)
assert.equal(passBIndependenceAttestation.authorityBoundary.auditedAppraisalStatusGranted, false)
const {
  canonicalPayloadSha256: attestationPayloadSha256,
  ...attestationPayload
} = passBIndependenceAttestation
assert.equal(attestationPayloadSha256, sha256(stableJson(attestationPayload)),
  "method_appraisal_pilot_attestation_payload_hash_mismatch")

const reconciliation = readJson(reconciliationPath)
assertReconciliationTopLevelShape(reconciliation)
assertCandidateOnly(reconciliation, "method_appraisal_pilot_reconciliation")
assert.equal(reconciliation.schemaVersion, "dna-method-appraisal-reconciliation@1")
assert.equal(reconciliation.passId, "method_appraisal_reconciliation")
assert.equal(reconciliation.sourceId, sourceId)
assert.deepEqual(reconciliation.inputBindings.passA, {
  passId: "method_appraisal_a",
  fileSha256: fileSha256(passAPath),
})
assert.deepEqual(reconciliation.inputBindings.passB, {
  passId: "method_appraisal_b",
  fileSha256: fileSha256(passBPath),
})
assert.equal(passBIndependenceAttestation.reconciliationBinding.sha256,
  fileSha256(reconciliationPath))
assert.equal(reconciliation.inputBindings.contract.fileSha256, contractFileSha256)
assert.equal(reconciliation.inputBindings.workpack.schemaVersion,
  "dna-v3-method-review-workpack@1")
assertSha256(reconciliation.inputBindings.workpack.fileSha256,
  "method_appraisal_pilot_reconciliation_legacy_workpack_file_hash_invalid")
assertSha256(reconciliation.inputBindings.workpack.declaredWorkpackSha256,
  "method_appraisal_pilot_reconciliation_legacy_workpack_payload_hash_invalid")
assert.equal(passA.sourceBindings.declaredWorkpackSha256,
  passB.sourceBinding.workpackPayloadSha256,
  "method_appraisal_pilot_legacy_payload_binding_pass_a_b_mismatch")
assert.equal(passB.sourceBinding.workpackPayloadSha256,
  reconciliation.inputBindings.workpack.declaredWorkpackSha256,
  "method_appraisal_pilot_legacy_payload_binding_reconciliation_mismatch")
assert.equal(passA.sourceBindings.workpackFileSha256,
  passB.sourceBinding.workpackFileSha256,
  "method_appraisal_pilot_legacy_file_binding_pass_a_b_mismatch")
assert.equal(passB.sourceBinding.workpackFileSha256,
  reconciliation.inputBindings.workpack.fileSha256,
  "method_appraisal_pilot_legacy_file_binding_reconciliation_mismatch")
assert.equal(reconciliation.inputBindings.workpack.artifactSha256, workpack.artifactSha256)
assert.equal(reconciliation.inputBindings.workpack.parsedContentSha256,
  workpack.parsedContentSha256)
assert.equal(reconciliation.reconciliationBoundary.trustedRegistryBound, false)
assert.equal(reconciliation.reconciliationBoundary.auditedAppraisalStatusGranted, false)
const reconciliationMethodIds = validateEvidenceRecords(
  reconciliation.methodFields,
  contract.requiredFields,
  paragraphIds,
  "reconciledReportingState",
  "method_appraisal_pilot_reconciliation_method",
  {
    allowedStates: PASS_A_METHOD_STATES,
    requiredRecordKeys: [
      "passAState", "passBState", "comparison", "resolutionRationale",
      "reconciledReportingState", "finding", "evidenceParagraphIds",
    ],
    optionalRecordKeys: ["boundary"],
    recordShapeForKey: (record, key, code) => {
      assertEnum(record.passAState, PASS_A_METHOD_STATES,
        `${code}:${key}:pass_a_state_invalid`)
      assertEnum(record.passBState, PASS_B_METHOD_STATES,
        `${code}:${key}:pass_b_state_invalid`)
      assertEnum(record.comparison, METHOD_COMPARISON_STATES,
        `${code}:${key}:comparison_invalid`)
    },
  },
)
const reconciliationGradeIds = validateEvidenceRecords(
  reconciliation.adaptedGradeDimensions,
  contract.adaptedGradeDimensions,
  paragraphIds,
  "reconciledAssessment",
  "method_appraisal_pilot_reconciliation_grade",
  {
    allowedStates: PASS_A_GRADE_STATES,
    recordShapeForKey: (record, key, code) => {
      const sourceSignalOnly = key === "inconsistency" || key === "publicationBias"
      assertExactKeys(record, [
        "passAAssessment", "passBAssessment", "comparison", "reconciledAssessment",
        "resolutionRationale", sourceSignalOnly ? "sourceReportedSignals" : "finding",
        "evidenceParagraphIds",
      ], `${code}:${key}:keys`)
      assertEnum(record.passAAssessment, PASS_A_GRADE_STATES,
        `${code}:${key}:pass_a_assessment_invalid`)
      assertEnum(record.passBAssessment, PASS_B_GRADE_ASSESSMENTS,
        `${code}:${key}:pass_b_assessment_invalid`)
      assertEnum(record.comparison, GRADE_COMPARISON_STATES,
        `${code}:${key}:comparison_invalid`)
    },
  },
)
exactSet(reconciliation.allUsedParagraphIds,
  [...reconciliationMethodIds, ...reconciliationGradeIds],
  "method_appraisal_pilot_reconciliation_locator_union_mismatch")
assert.deepEqual(
  reconciliation.completionCheck,
  expectedReconciliationCompletion(reconciliation, contract, paragraphIds),
  "method_appraisal_pilot_reconciliation_completion_mismatch",
)
assert.deepEqual(
  reconciliation.comparisonSummary,
  expectedReconciliationComparisonSummary(reconciliation),
  "method_appraisal_pilot_reconciliation_comparison_summary_mismatch",
)

const reconciliationRereview = readJson(reconciliationRereviewPath)
assertRereviewTopLevelShape(reconciliationRereview)
assertCandidateOnly(reconciliationRereview,
  "method_appraisal_pilot_reconciliation_rereview")
assert.equal(reconciliationRereview.schemaVersion,
  "dna-method-appraisal-reconciliation-rereview@1")
assert.equal(reconciliationRereview.reviewType,
  "source_fidelity_narrowing_follow_up")
assert.equal(reconciliationRereview.sourceId, sourceId)
assert.equal(reconciliationRereview.previousReconciliation.schemaVersion,
  reconciliation.schemaVersion)
assert.equal(reconciliationRereview.previousReconciliation.sha256,
  fileSha256(reconciliationPath))
assert.equal(reconciliationRereview.changeLog.length, 1,
  "method_appraisal_pilot_rereview_requires_single_change")

const rereviewChange = reconciliationRereview.changeLog[0]
assert.deepEqual({
  operation: rereviewChange.operation,
  jsonPointer: rereviewChange.jsonPointer,
  occurrenceCountInBoundBase: rereviewChange.occurrenceCountInBoundBase,
  beforeExact: rereviewChange.beforeExact,
  afterExact: rereviewChange.afterExact,
  semanticScope: rereviewChange.semanticScope,
}, {
  operation: "replace_exact_substring",
  jsonPointer: "/methodFields/missingData/finding",
  occurrenceCountInBoundBase: 1,
  beforeExact: "missing-data handling was often rated unclear",
  afterExact: "missing-data handling was rated low or unclear",
  semanticScope: "narrow_frequency_language_only",
}, "method_appraisal_pilot_rereview_change_not_allowlisted")
assert.equal(reconciliation.methodFields.missingData.finding,
  rereviewChange.beforeFullValue)
assert.equal(rereviewChange.beforeFullValue.includes(rereviewChange.beforeExact), true)
assert.equal(rereviewChange.afterFullValue,
  rereviewChange.beforeFullValue.replace(rereviewChange.beforeExact,
    rereviewChange.afterExact))

const effectiveReconciliation = structuredClone(reconciliation)
effectiveReconciliation.methodFields.missingData.finding = rereviewChange.afterFullValue
const effectiveReconciliationBytes = Buffer.from(
  `${JSON.stringify(effectiveReconciliation, null, 2)}\n`,
)
assert.equal(
  reconciliationRereview.immutabilityVerification.effectiveReconciliationBytesSha256,
  sha256(effectiveReconciliationBytes),
  "method_appraisal_pilot_rereview_effective_hash_mismatch",
)
assert.equal(reconciliationRereview.immutabilityVerification.meaningfulChangeCount, 1)
assert.equal(
  reconciliationRereview.immutabilityVerification.other24FieldsSemanticallyUnchanged,
  true,
)
assert.equal(
  reconciliationRereview.immutabilityVerification.locatorBytesSemanticallyUnchanged,
  true,
)
assert.equal(
  reconciliationRereview.immutabilityVerification.previousReconciliationModified,
  false,
)
assert.equal(reconciliationRereview.locatorBindings.allUsedParagraphIdCount,
  reconciliation.allUsedParagraphIds.length)
assert.equal(
  reconciliationRereview.locatorBindings.allUsedParagraphIdsCanonicalSha256,
  sha256(JSON.stringify([...reconciliation.allUsedParagraphIds].sort())),
)
exactSet(
  reconciliationRereview.locatorBindings.missingDataEvidenceParagraphIds,
  reconciliation.methodFields.missingData.evidenceParagraphIds,
  "method_appraisal_pilot_rereview_missing_data_locators_changed",
)
const {
  canonicalPayloadSha256: rereviewPayloadSha256,
  ...rereviewPayload
} = reconciliationRereview
assert.equal(rereviewPayloadSha256, sha256(stableJson(rereviewPayload)),
  "method_appraisal_pilot_rereview_payload_hash_mismatch")
assert.equal(reconciliationRereview.authorityBoundary.candidateOnly, true)
assert.equal(reconciliationRereview.authorityBoundary.bodyOfEvidenceCertaintyAssigned,
  false)
assert.equal(reconciliationRereview.authorityBoundary.runtimeEligible, false)
assert.equal(reconciliationRereview.authorityBoundary.releaseEligible, false)

assert.equal(new Set(reconciliation.allUsedParagraphIds).size,
  reconciliation.allUsedParagraphIds.length,
  "method_appraisal_pilot_reconciliation_duplicate_locator_union")
assert.equal(reconciliation.allUsedParagraphIds.length, 58,
  "method_appraisal_pilot_reconciliation_expected_58_locator_set")
const legacyGovernanceEnvelopePreserved =
  passA.sourceBindings.declaredWorkpackSha256
    === passB.sourceBinding.workpackPayloadSha256
  && passB.sourceBinding.workpackPayloadSha256
    === reconciliation.inputBindings.workpack.declaredWorkpackSha256
  && passA.sourceBindings.workpackFileSha256
    === passB.sourceBinding.workpackFileSha256
  && passB.sourceBinding.workpackFileSha256
    === reconciliation.inputBindings.workpack.fileSha256
  && passB.sourceBinding.workpackSchemaVersion === "dna-v3-method-review-workpack@1"
  && reconciliation.inputBindings.workpack.schemaVersion
    === "dna-v3-method-review-workpack@1"
const currentGovernanceEnvelopeVerified =
  workpack.schemaVersion === "dna-v3-method-review-workpack@2"
  && workpackIndex.schemaVersion === "dna-v3-method-review-workpack-index@3"
  && workpackIndexRecord.workpackSha256 === computedWorkpackSha256
  && workpackIndex.governanceInputBindings.integrityAuditSha256
    === expectedIntegrityAuditSha256
  && workpackIndex.governanceInputBindings.componentLicenseAuditSha256
    === expectedComponentLicenseAuditSha256
  && workpackIndexRecord.integrityDecisionSha256 === workpack.integrityDecisionSha256
  && workpackIndexRecord.passageLicenseDecisionSha256
    === workpack.passageLicenseDecisionSha256
const scientificPayloadChainUnchanged =
  reconciliation.inputBindings.passA.fileSha256 === fileSha256(passAPath)
  && reconciliation.inputBindings.passB.fileSha256 === fileSha256(passBPath)
  && passBIndependenceAttestation.frozenPassB.sha256 === fileSha256(passBPath)
  && passBIndependenceAttestation.reconciliationBinding.sha256
    === fileSha256(reconciliationPath)
  && reconciliationRereview.previousReconciliation.sha256
    === fileSha256(reconciliationPath)
const governanceEnvelopeRebound =
  legacyGovernanceEnvelopePreserved
  && currentGovernanceEnvelopeVerified
  && scientificPayloadChainUnchanged
  && passA.sourceBindings.declaredWorkpackSha256 !== computedWorkpackSha256
  && passA.sourceBindings.workpackFileSha256 !== fileSha256(workpackPath)
  && reconciliation.allUsedParagraphIds.every((id) => paragraphIds.has(id))
  && !passA.runtimeEligible && !passA.releaseEligible
  && !passB.sourceBinding.runtimeEligible && !passB.sourceBinding.releaseEligible
  && !reconciliation.runtimeEligible && !reconciliation.releaseEligible
  && !reconciliationRereview.runtimeEligible && !reconciliationRereview.releaseEligible
assert.equal(governanceEnvelopeRebound, true,
  "method_appraisal_pilot_governance_envelope_rebind_invalid")

// Adversarial schema self-tests: a self-consistent-looking artifact must not
// expand its state space, add release authority, or self-report aggregate
// counts that disagree with the underlying reconciled records.
const fakeStatePassA = structuredClone(passA)
fakeStatePassA.methodFields.studyDesign.reportingState = "audited"
assert.throws(() => validateEvidenceRecords(
  fakeStatePassA.methodFields,
  contract.requiredFields,
  paragraphIds,
  "reportingState",
  "method_appraisal_pilot_tamper_fake_state",
  {
    allowedStates: PASS_A_METHOD_STATES,
    requiredRecordKeys: ["reportingState", "finding", "evidenceParagraphIds"],
    optionalRecordKeys: ["boundary"],
  },
), /method_appraisal_pilot_tamper_fake_state:studyDesign:state_invalid/,
"method_appraisal_pilot_fake_state_was_not_rejected")

const addedReleaseAuthorityPassB = {
  ...structuredClone(passB),
  releaseEligible: true,
}
assert.throws(() => assertPassBTopLevelShape(addedReleaseAuthorityPassB),
  /method_appraisal_pilot_pass_b_shape/,
  "method_appraisal_pilot_added_release_authority_was_not_rejected")

const corruptedComparisonSummary = structuredClone(reconciliation)
corruptedComparisonSummary.comparisonSummary.methodAgreementCount += 1
assert.throws(() => assert.deepEqual(
  corruptedComparisonSummary.comparisonSummary,
  expectedReconciliationComparisonSummary(corruptedComparisonSummary),
  "method_appraisal_pilot_tamper_comparison_summary_mismatch",
), /method_appraisal_pilot_tamper_comparison_summary_mismatch/,
"method_appraisal_pilot_corrupted_comparison_summary_was_not_rejected")

console.log(JSON.stringify({
  ok: true,
  schemaVersion: "dna-method-appraisal-pilot-verification@1",
  reviewArchitecture: "output_blinded_codex_multi_pass_not_independent",
  independentHumanReview: false,
  sourceId,
  authoritativeWorkpackIndexSha256: workpackIndex.indexSha256,
  governanceInputBindings: workpackIndex.governanceInputBindings,
  workpackSha256: computedWorkpackSha256,
  passAFileSha256: fileSha256(passAPath),
  passBFileSha256: fileSha256(passBPath),
  passBIndependenceAttestationFileSha256:
    fileSha256(passBIndependenceAttestationPath),
  reconciliationFileSha256: fileSha256(reconciliationPath),
  reconciliationRereviewFileSha256: fileSha256(reconciliationRereviewPath),
  effectiveReconciliationSha256:
    reconciliationRereview.immutabilityVerification.effectiveReconciliationBytesSha256,
  methodFieldCount: contract.requiredFields.length,
  adaptedGradeDimensionCount: contract.adaptedGradeDimensions.length,
  resolvedParagraphLocatorCount: reconciliation.allUsedParagraphIds.length,
  governanceEnvelopeRebound,
  scientificPayloadChainUnchanged,
  negativeTamperSelfTests: 3,
  disposition: "candidate_chain_rereview_verified_not_registered",
  runtimeEligible: false,
  releaseEligible: false,
}, null, 2))

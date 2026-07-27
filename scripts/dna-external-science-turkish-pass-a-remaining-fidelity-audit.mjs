#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  assertSecurePath,
  bytesSha256,
  resolveSsdRoot,
  secureAtomicWrite,
  stableSha256,
} from "./dna-external-science-turkish-full-coverage-workpacks.mjs"

export const VERSION = "dna-external-science-turkish-pass-a-remaining-fidelity-audit@1"
export const ARTIFACT_SCHEMA = "dna-external-science-turkish-independent-fidelity-audit@1"
export const MANIFEST_SCHEMA = "dna-external-science-turkish-independent-fidelity-audit-manifest@1"
export const STATUS = "pass_a_remaining_178_independently_audited"
export const PROVENANCE = "codex_record_by_record_semantic_source_fidelity_audit_not_human_review"

export const CANDIDATE_RELATIVE_PATH =
  "Datasets/DNA-Intelligence/work/v3/prebook-closure/v1/external-science-candidate-package.json"
export const WORKPACK_RELATIVE_PATH =
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-full-coverage-workpacks/prebook-v1/pass-a/authoring-workpack.json"
export const PASS_A_ARTIFACT_RELATIVE_PATH =
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-full-coverage-workpacks/prebook-v1/pass-a/pass-a-remaining-178-artifact.json"
export const REVIEW_LEDGER_RELATIVE_PATH =
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-full-coverage-workpacks/prebook-v1/pass-a/pass-a-remaining-178-independent-fidelity-decisions.json"
export const AUDIT_ARTIFACT_RELATIVE_PATH =
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-full-coverage-workpacks/prebook-v1/pass-a/pass-a-remaining-178-independent-fidelity-audit.json"
export const REPO_MANIFEST_RELATIVE_PATH =
  "docs/dna-intelligence/program/evidence/external-science-turkish-pass-a-remaining-fidelity-audit-current.json"

const EXPECTED = Object.freeze({
  candidatePackageSha256: "1efe414cd6fecad250a3bf9cdbb963a51e872f1d13f2041676b5abde1ede20bd",
  candidateFileSha256: "45c779a88b668f26b9a79c29715ca8709cb3a52afa07c8d4dbae37bc01ee7b3c",
  workpackSha256: "132e8dd16fd21cb4b230596ecc4267d53e7deacb46799e576799f187855eedec",
  workpackFileSha256: "d9e5aa310660f31b831ec9252b6897a9312a499e30e87bcd3c3801ee5c321469",
  passAArtifactSha256: "9c439505b32b93bfeec8b709a2e76934f9867e7391e228edd260b7da44688f41",
  passAArtifactFileSha256: "7281fa7cc1285567dad66902034f102a304933cacf19a08e9367c837403ed356",
  reviewLedgerSha256: "de9cac0b0895837ed0378c5d0e065dabf18ec3b1fe2aa30c6fe57ecf65b76f31",
  reviewLedgerFileSha256: "821633234ce606a7d17608184c90bb2098d56940d7637abcf199e87e49a344e3",
})

export const FINDING_DIMENSIONS = Object.freeze([
  "meaningEquivalent",
  "numbersPreserved",
  "negationPreserved",
  "hedgePreserved",
  "causalStrengthPreserved",
  "relationshipDirectionPreserved",
  "ageSampleEvidenceBoundaryPreserved",
  "criticalBoundaryPreserved",
  "noAddedMechanism",
  "noAddedClinicalInference",
  "noAddedDnaProductValidity",
  "naturalTurkish",
])

export const TERMINAL_STATUSES = Object.freeze(["pass", "needs_revision", "quarantine"])
export const PASS_REASON = "source_faithful_no_material_issue"
export const REVISION_REASONS = Object.freeze([
  "meaning_mismatch",
  "number_changed",
  "negation_changed",
  "hedge_strengthened_or_lost",
  "causal_strength_upgraded",
  "relationship_direction_changed",
  "age_or_sample_scope_changed",
  "evidence_boundary_omitted",
  "critical_limitation_omitted",
  "added_mechanism",
  "added_clinical_inference",
  "added_dna_product_validity",
  "ambiguous_or_unnatural_turkish",
  "terminology_mistranslated",
  "unsupported_specificity",
])

const DECISION_KEYS = Object.freeze([
  "bindings",
  "claimId",
  "decisionSha256",
  "findingBits",
  "ordinal",
  "reason",
  "revisionNote",
  "status",
])

const DECISION_BINDING_KEYS = Object.freeze([
  "claimSha256",
  "passageSha256",
  "sourceSha256",
  "turkishRenderingSha256",
])

const AUDIT_RECORD_KEYS = Object.freeze([
  "activationAllowed",
  "answerUnitId",
  "audit",
  "authority",
  "bindings",
  "claimId",
  "decision",
  "id",
  "independentHumanReview",
  "ownerAuthority",
  "passageId",
  "provenance",
  "recordSha256",
  "releaseEligible",
  "runtimeEligible",
  "scheduleOrdinal",
  "sourceId",
  "topicId",
])

function fail(code) {
  throw new Error(code)
}

function assert(condition, code) {
  if (!condition) fail(code)
}

function omit(value, key) {
  const copy = { ...value }
  delete copy[key]
  return copy
}

function seal(value, key) {
  return { ...value, [key]: stableSha256(value) }
}

function assertSha(value, code) {
  assert(typeof value === "string" && /^[a-f0-9]{64}$/.test(value), code)
}

function assertExactKeys(value, expected, code) {
  assert(value && typeof value === "object" && !Array.isArray(value), code)
  const keys = Object.keys(value).sort((left, right) => left.localeCompare(right, "en"))
  assert(JSON.stringify(keys) === JSON.stringify(expected), code)
}

function readSsdJson(root, relativePath) {
  const path = assertSecurePath(root, join(root, relativePath), { mode0600: true })
  const bytes = readFileSync(path)
  return {
    value: JSON.parse(bytes.toString("utf8")),
    rawSha256: bytesSha256(bytes),
    bytes: bytes.length,
  }
}

function readRepoJson(repoRoot, relativePath) {
  const path = assertSecurePath(repoRoot, join(repoRoot, relativePath), { mode0600: false })
  const bytes = readFileSync(path)
  return { value: JSON.parse(bytes.toString("utf8")), rawSha256: bytesSha256(bytes) }
}

function assertCandidate(candidate, rawSha256) {
  assert(rawSha256 === EXPECTED.candidateFileSha256, "dna_fidelity_candidate_file_drift")
  assert(candidate.schemaVersion === "dna-external-science-candidate@1"
    && candidate.authorityClass === "external_science_candidate",
  "dna_fidelity_candidate_identity")
  assert(candidate.packageSha256 === EXPECTED.candidatePackageSha256
    && stableSha256(omit(candidate, "packageSha256")) === candidate.packageSha256,
  "dna_fidelity_candidate_hash")
  assert(candidate.runtimeEligible === false && candidate.releaseEligible === false
    && candidate.activationAllowed === false,
  "dna_fidelity_candidate_authority")
  assert(candidate.claims.length === 220 && candidate.answerUnits.length === 220,
    "dna_fidelity_candidate_coverage")
  for (const source of candidate.sources) {
    assert(stableSha256(omit(source, "sourceSha256")) === source.sourceSha256,
      `dna_fidelity_source_hash:${source.id}`)
  }
  for (const passage of candidate.passages) {
    assert(stableSha256(omit(passage, "passageSha256")) === passage.passageSha256,
      `dna_fidelity_passage_hash:${passage.id}`)
    assert(bytesSha256(passage.originalText) === passage.contentSha256,
      `dna_fidelity_passage_content_hash:${passage.id}`)
  }
  for (const claim of candidate.claims) {
    assert(stableSha256(omit(claim, "claimSha256")) === claim.claimSha256,
      `dna_fidelity_claim_hash:${claim.id}`)
  }
  for (const unit of candidate.answerUnits) {
    assert(stableSha256(omit(unit, "answerUnitSha256")) === unit.answerUnitSha256,
      `dna_fidelity_answer_unit_hash:${unit.id}`)
  }
}

function assertWorkpack(workpack, rawSha256) {
  assert(rawSha256 === EXPECTED.workpackFileSha256, "dna_fidelity_workpack_file_drift")
  assert(workpack.schemaVersion === "dna-external-science-turkish-blind-authoring-workpack@1"
    && workpack.status === "blank_blind_authoring_workpack"
    && workpack.passId === "A",
  "dna_fidelity_workpack_identity")
  assert(workpack.workpackSha256 === EXPECTED.workpackSha256
    && stableSha256(omit(workpack, "workpackSha256")) === workpack.workpackSha256,
  "dna_fidelity_workpack_hash")
  assert(workpack.workItems.length === 178
    && new Set(workpack.workItems.map((entry) => entry.claimId)).size === 178,
  "dna_fidelity_workpack_coverage")
  assert(workpack.runtimeEligible === false && workpack.releaseEligible === false
    && workpack.activationAllowed === false && workpack.ownerAuthority === false,
  "dna_fidelity_workpack_authority")
  for (const item of workpack.workItems) {
    assert(stableSha256(omit(item, "workItemSha256")) === item.workItemSha256,
      `dna_fidelity_work_item_hash:${item.claimId}`)
  }
}

function assertPassAArtifact(artifact, rawSha256) {
  assert(rawSha256 === EXPECTED.passAArtifactFileSha256, "dna_fidelity_pass_a_file_drift")
  assert(artifact.schemaVersion === "dna-external-science-turkish-pass-a-remaining-artifact@1"
    && artifact.status === "pass_a_remaining_178_candidate_only",
  "dna_fidelity_pass_a_identity")
  assert(artifact.artifactSha256 === EXPECTED.passAArtifactSha256
    && stableSha256(omit(artifact, "artifactSha256")) === artifact.artifactSha256,
  "dna_fidelity_pass_a_hash")
  assert(artifact.records.length === 178
    && new Set(artifact.records.map((entry) => entry.claimId)).size === 178,
  "dna_fidelity_pass_a_coverage")
  assert(artifact.runtimeEligible === false && artifact.releaseEligible === false
    && artifact.activationAllowed === false && artifact.ownerAuthority === false
    && artifact.independentHumanReview === false,
  "dna_fidelity_pass_a_authority")
  for (const record of artifact.records) {
    assert(stableSha256(omit(record, "recordSha256")) === record.recordSha256,
      `dna_fidelity_pass_a_record_hash:${record.claimId}`)
    assert(bytesSha256(record.turkishRendering) === record.turkishRenderingSha256,
      `dna_fidelity_rendering_hash:${record.claimId}`)
  }
}

function derivedLedgerCounts(ledger, workpack) {
  const statusCounts = Object.fromEntries(TERMINAL_STATUSES.map((status) => [status, 0]))
  const reasonCounts = {}
  for (const decision of ledger.decisions) {
    statusCounts[decision.status] = (statusCounts[decision.status] || 0) + 1
    reasonCounts[decision.reason] = (reasonCounts[decision.reason] || 0) + 1
  }
  const items = new Map(workpack.workItems.map((entry) => [entry.claimId, entry]))
  return {
    records: ledger.decisions.length,
    statusCounts,
    reasonCounts,
    topics: new Set(ledger.decisions.map((entry) => items.get(entry.claimId)?.topicId)).size,
    sources: new Set(ledger.decisions.map((entry) => items.get(entry.claimId)?.sourceId)).size,
    passages: new Set(ledger.decisions.map((entry) => items.get(entry.claimId)?.passageId)).size,
    claims: new Set(ledger.decisions.map((entry) => entry.claimId)).size,
  }
}

function assertReviewLedger(ledger, rawSha256, workpack) {
  assert(rawSha256 === EXPECTED.reviewLedgerFileSha256, "dna_fidelity_review_ledger_file_drift")
  assert(ledger.schemaVersion === "dna-external-science-turkish-independent-fidelity-review-ledger@1"
    && ledger.version === VERSION
    && ledger.status === "all_178_terminally_reviewed",
  "dna_fidelity_review_ledger_identity")
  assert(ledger.reviewLedgerSha256 === EXPECTED.reviewLedgerSha256
    && stableSha256(omit(ledger, "reviewLedgerSha256")) === ledger.reviewLedgerSha256,
  "dna_fidelity_review_ledger_hash")
  assert(ledger.reviewerClass === "codex_independent_semantic_source_fidelity_auditor"
    && ledger.reviewMethod === "record_by_record_canonical_claim_and_bound_passage_comparison"
    && ledger.authoringAutomaticQaUsedAsDecision === false,
  "dna_fidelity_review_method")
  assert(ledger.crossPassMaterialAccessed === false
    && ledger.reconciliationMaterialAccessed === false
    && ledger.lockedEvaluationMaterialAccessed === false
    && ledger.networkUsed === false && ledger.externalModelUsed === false,
  "dna_fidelity_review_isolation")
  assert(JSON.stringify(ledger.findingDimensions) === JSON.stringify(FINDING_DIMENSIONS),
    "dna_fidelity_finding_dimensions")
  assert(JSON.stringify(ledger.decisionContract.statuses) === JSON.stringify(TERMINAL_STATUSES)
    && ledger.decisionContract.passReason === PASS_REASON
    && JSON.stringify(ledger.decisionContract.revisionReasons) === JSON.stringify(REVISION_REASONS),
  "dna_fidelity_decision_contract")
  assert(ledger.inputBindings.candidatePackageSha256 === EXPECTED.candidatePackageSha256
    && ledger.inputBindings.candidateFileSha256 === EXPECTED.candidateFileSha256
    && ledger.inputBindings.workpackSha256 === EXPECTED.workpackSha256
    && ledger.inputBindings.workpackFileSha256 === EXPECTED.workpackFileSha256
    && ledger.inputBindings.passAArtifactSha256 === EXPECTED.passAArtifactSha256
    && ledger.inputBindings.passAArtifactFileSha256 === EXPECTED.passAArtifactFileSha256,
  "dna_fidelity_review_input_bindings")
  assert(Array.isArray(ledger.decisions) && ledger.decisions.length === 178,
    "dna_fidelity_review_decision_count")
  assert(new Set(ledger.decisions.map((entry) => entry.claimId)).size === 178,
    "dna_fidelity_review_duplicate_claim")
  const expectedClaims = new Set(workpack.workItems.map((entry) => entry.claimId))
  assert(ledger.decisions.every((entry) => expectedClaims.has(entry.claimId))
    && [...expectedClaims].every((claimId) => ledger.decisions.some((entry) => entry.claimId === claimId)),
  "dna_fidelity_review_coverage")
  for (const [index, decision] of ledger.decisions.entries()) {
    assertExactKeys(decision, DECISION_KEYS, `dna_fidelity_decision_shape:${index + 1}`)
    assertExactKeys(decision.bindings, DECISION_BINDING_KEYS,
      `dna_fidelity_decision_binding_shape:${index + 1}`)
    assert(decision.ordinal === index + 1, `dna_fidelity_decision_order:${index + 1}`)
    assert(TERMINAL_STATUSES.includes(decision.status),
      `dna_fidelity_decision_status:${decision.claimId}`)
    assert(typeof decision.findingBits === "string"
      && decision.findingBits.length === FINDING_DIMENSIONS.length
      && /^[01]+$/.test(decision.findingBits),
    `dna_fidelity_decision_findings:${decision.claimId}`)
    if (decision.status === "pass") {
      assert(decision.reason === PASS_REASON && decision.revisionNote === null
        && decision.findingBits === "1".repeat(FINDING_DIMENSIONS.length),
      `dna_fidelity_pass_decision_invalid:${decision.claimId}`)
    } else {
      assert(REVISION_REASONS.includes(decision.reason)
        && typeof decision.revisionNote === "string"
        && decision.revisionNote.trim().length >= 12
        && decision.findingBits.includes("0"),
      `dna_fidelity_nonpass_decision_invalid:${decision.claimId}`)
    }
    for (const hash of Object.values(decision.bindings)) assertSha(hash,
      `dna_fidelity_decision_binding_hash:${decision.claimId}`)
    assert(stableSha256(omit(decision, "decisionSha256")) === decision.decisionSha256,
      `dna_fidelity_decision_hash:${decision.claimId}`)
  }
  assert(stableSha256(ledger.counts) === stableSha256(derivedLedgerCounts(ledger, workpack)),
    "dna_fidelity_review_counts")
  assert(ledger.runtimeEligible === false && ledger.releaseEligible === false
    && ledger.activationAllowed === false && ledger.ownerAuthority === false
    && ledger.independentHumanReview === false,
  "dna_fidelity_review_authority")
}

export function loadInputs(root, repoRoot = process.cwd()) {
  const candidate = readSsdJson(root, CANDIDATE_RELATIVE_PATH)
  const workpack = readSsdJson(root, WORKPACK_RELATIVE_PATH)
  const passAArtifact = readSsdJson(root, PASS_A_ARTIFACT_RELATIVE_PATH)
  const reviewLedger = readSsdJson(root, REVIEW_LEDGER_RELATIVE_PATH)
  assertCandidate(candidate.value, candidate.rawSha256)
  assertWorkpack(workpack.value, workpack.rawSha256)
  assertPassAArtifact(passAArtifact.value, passAArtifact.rawSha256)
  assertReviewLedger(reviewLedger.value, reviewLedger.rawSha256, workpack.value)
  return {
    candidate: candidate.value,
    candidateRawSha256: candidate.rawSha256,
    workpack: workpack.value,
    workpackRawSha256: workpack.rawSha256,
    passAArtifact: passAArtifact.value,
    passAArtifactRawSha256: passAArtifact.rawSha256,
    reviewLedger: reviewLedger.value,
    reviewLedgerRawSha256: reviewLedger.rawSha256,
    repoRoot,
  }
}

function assertInputs(inputs) {
  assertCandidate(inputs.candidate, inputs.candidateRawSha256)
  assertWorkpack(inputs.workpack, inputs.workpackRawSha256)
  assertPassAArtifact(inputs.passAArtifact, inputs.passAArtifactRawSha256)
  assertReviewLedger(inputs.reviewLedger, inputs.reviewLedgerRawSha256, inputs.workpack)
}

function findingVerdicts(bits) {
  return Object.fromEntries(FINDING_DIMENSIONS.map((dimension, index) =>
    [dimension, bits[index] === "1" ? "pass" : "fail"]))
}

function countBy(values) {
  const counts = {}
  for (const value of values) counts[value] = (counts[value] || 0) + 1
  return Object.fromEntries(Object.entries(counts)
    .sort(([left], [right]) => left.localeCompare(right, "en")))
}

function topicStatusCounts(records, candidate) {
  const topicMap = new Map(candidate.topics.map((entry) => [entry.id, entry.topicSha256]))
  const grouped = new Map()
  for (const record of records) {
    const topicSha256 = topicMap.get(record.topicId)
    assertSha(topicSha256, `dna_fidelity_topic_hash_missing:${record.topicId}`)
    if (!grouped.has(topicSha256)) grouped.set(topicSha256, {
      topicSha256,
      records: 0,
      pass: 0,
      needs_revision: 0,
      quarantine: 0,
    })
    const target = grouped.get(topicSha256)
    target.records += 1
    target[record.decision.status] += 1
  }
  return [...grouped.values()].sort((left, right) =>
    left.topicSha256.localeCompare(right.topicSha256, "en"))
}

export function buildArtifact(inputs) {
  assertInputs(inputs)
  const sourceMap = new Map(inputs.candidate.sources.map((entry) => [entry.id, entry]))
  const passageMap = new Map(inputs.candidate.passages.map((entry) => [entry.id, entry]))
  const claimMap = new Map(inputs.candidate.claims.map((entry) => [entry.id, entry]))
  const answerMap = new Map(inputs.candidate.answerUnits.map((entry) => [entry.id, entry]))
  const passARecordMap = new Map(inputs.passAArtifact.records.map((entry) => [entry.claimId, entry]))
  const decisionMap = new Map(inputs.reviewLedger.decisions.map((entry) => [entry.claimId, entry]))

  const records = inputs.workpack.workItems.map((item, index) => {
    const source = sourceMap.get(item.sourceId)
    const passage = passageMap.get(item.passageId)
    const claim = claimMap.get(item.claimId)
    const answerUnit = answerMap.get(item.answerUnitId)
    const passARecord = passARecordMap.get(item.claimId)
    const decision = decisionMap.get(item.claimId)
    assert(source && passage && claim && answerUnit && passARecord && decision,
      `dna_fidelity_binding_missing:${item.claimId}`)
    assert(item.scheduleOrdinal === index + 1 && decision.ordinal === index + 1,
      `dna_fidelity_schedule_drift:${item.claimId}`)
    assert(claim.sourceId === source.id && claim.passageId === passage.id
      && claim.topicId === item.topicId && answerUnit.claimId === claim.id
      && answerUnit.passageId === passage.id && answerUnit.sourceId === source.id,
    `dna_fidelity_candidate_linkage:${item.claimId}`)
    assert(item.original.proposition === claim.proposition
      && item.original.passageText === passage.originalText
      && item.boundaries.claimBoundary === claim.claimBoundary
      && item.boundaries.passageBoundary === passage.claimBoundary
      && item.boundaries.ageScope === claim.ageScope
      && item.boundaries.passageAgeScope === passage.ageScope
      && item.boundaries.causalStatus === claim.causalStatus
      && item.boundaries.evidenceLevel === claim.evidenceLevel
      && item.boundaries.evidenceType === passage.evidenceType,
    `dna_fidelity_canonical_text_or_boundary_drift:${item.claimId}`)
    assert(item.hashes.sourceSha256 === source.sourceSha256
      && item.hashes.passageSha256 === passage.passageSha256
      && item.hashes.passageContentSha256 === passage.contentSha256
      && item.hashes.claimSha256 === claim.claimSha256
      && item.hashes.answerUnitSha256 === answerUnit.answerUnitSha256
      && item.hashes.propositionSha256 === bytesSha256(claim.proposition),
    `dna_fidelity_workpack_candidate_hash_drift:${item.claimId}`)
    assert(passARecord.workItemId === item.id
      && passARecord.sourceId === source.id
      && passARecord.passageId === passage.id
      && passARecord.answerUnitId === answerUnit.id
      && passARecord.bindings.sourceSha256 === source.sourceSha256
      && passARecord.bindings.passageSha256 === passage.passageSha256
      && passARecord.bindings.claimSha256 === claim.claimSha256
      && passARecord.bindings.answerUnitSha256 === answerUnit.answerUnitSha256,
    `dna_fidelity_pass_a_candidate_hash_drift:${item.claimId}`)
    assert(decision.bindings.sourceSha256 === source.sourceSha256
      && decision.bindings.passageSha256 === passage.passageSha256
      && decision.bindings.claimSha256 === claim.claimSha256
      && decision.bindings.turkishRenderingSha256 === passARecord.turkishRenderingSha256,
    `dna_fidelity_review_binding_drift:${item.claimId}`)
    const base = {
      id: `independent-fidelity-audit:${item.claimId}`,
      scheduleOrdinal: index + 1,
      topicId: item.topicId,
      sourceId: source.id,
      passageId: passage.id,
      claimId: claim.id,
      answerUnitId: answerUnit.id,
      decision: {
        status: decision.status,
        reason: decision.reason,
        revisionNote: decision.revisionNote,
        findings: findingVerdicts(decision.findingBits),
      },
      bindings: {
        candidatePackageSha256: inputs.candidate.packageSha256,
        candidateFileSha256: inputs.candidateRawSha256,
        workpackSha256: inputs.workpack.workpackSha256,
        workItemSha256: item.workItemSha256,
        passAArtifactSha256: inputs.passAArtifact.artifactSha256,
        passARecordSha256: passARecord.recordSha256,
        reviewLedgerSha256: inputs.reviewLedger.reviewLedgerSha256,
        reviewDecisionSha256: decision.decisionSha256,
        sourceSha256: source.sourceSha256,
        sourceArtifactSha256: source.artifactSha256,
        passageSha256: passage.passageSha256,
        passageContentSha256: passage.contentSha256,
        claimSha256: claim.claimSha256,
        propositionSha256: item.hashes.propositionSha256,
        answerUnitSha256: answerUnit.answerUnitSha256,
        turkishRenderingSha256: passARecord.turkishRenderingSha256,
        claimBoundarySha256: stableSha256(claim.claimBoundary),
        passageBoundarySha256: stableSha256(passage.claimBoundary),
        ageScopeSha256: stableSha256(claim.ageScope),
        evidenceLevelSha256: stableSha256(claim.evidenceLevel),
        evidenceTypeSha256: stableSha256(passage.evidenceType),
        causalStatusSha256: stableSha256(claim.causalStatus),
      },
      audit: {
        reviewerClass: inputs.reviewLedger.reviewerClass,
        reviewMethod: inputs.reviewLedger.reviewMethod,
        canonicalClaimCompared: true,
        boundSourcePassageCompared: true,
        claimAndPassageBoundariesCompared: true,
        automaticAuthoringQaUsedAsDecision: false,
        otherTranslationPassMaterialRead: false,
        reconciliationMaterialRead: false,
        lockedEvaluationMaterialRead: false,
        independentHumanReview: false,
      },
      authority: {
        class: "external_science_candidate_translation_fidelity_audit",
        runtime: false,
        release: false,
        activation: false,
        owner: false,
      },
      provenance: PROVENANCE,
      runtimeEligible: false,
      releaseEligible: false,
      activationAllowed: false,
      ownerAuthority: false,
      independentHumanReview: false,
    }
    return seal(base, "recordSha256")
  })

  const statusCounts = countBy(records.map((entry) => entry.decision.status))
  for (const status of TERMINAL_STATUSES) if (!(status in statusCounts)) statusCounts[status] = 0
  const orderedStatusCounts = Object.fromEntries(TERMINAL_STATUSES.map((status) =>
    [status, statusCounts[status]]))
  const reasonCounts = countBy(records.map((entry) => entry.decision.reason))
  const findingFailureCounts = Object.fromEntries(FINDING_DIMENSIONS.map((dimension) => [
    dimension,
    records.filter((entry) => entry.decision.findings[dimension] === "fail").length,
  ]))
  const counts = {
    records: records.length,
    terminal: records.filter((entry) => TERMINAL_STATUSES.includes(entry.decision.status)).length,
    statusCounts: orderedStatusCounts,
    reasonCounts,
    topics: new Set(records.map((entry) => entry.topicId)).size,
    sources: new Set(records.map((entry) => entry.sourceId)).size,
    passages: new Set(records.map((entry) => entry.passageId)).size,
    claims: new Set(records.map((entry) => entry.claimId)).size,
    answerUnits: new Set(records.map((entry) => entry.answerUnitId)).size,
  }
  const base = {
    schemaVersion: ARTIFACT_SCHEMA,
    version: VERSION,
    completedAt: inputs.reviewLedger.reviewedAt,
    status: STATUS,
    authorityClass: "external_science_candidate_translation_fidelity_audit",
    provenance: PROVENANCE,
    input: {
      candidateRelativePath: CANDIDATE_RELATIVE_PATH,
      candidatePackageSha256: inputs.candidate.packageSha256,
      candidateFileSha256: inputs.candidateRawSha256,
      workpackRelativePath: WORKPACK_RELATIVE_PATH,
      workpackSha256: inputs.workpack.workpackSha256,
      workpackFileSha256: inputs.workpackRawSha256,
      passAArtifactRelativePath: PASS_A_ARTIFACT_RELATIVE_PATH,
      passAArtifactSha256: inputs.passAArtifact.artifactSha256,
      passAArtifactFileSha256: inputs.passAArtifactRawSha256,
      reviewLedgerRelativePath: REVIEW_LEDGER_RELATIVE_PATH,
      reviewLedgerSha256: inputs.reviewLedger.reviewLedgerSha256,
      reviewLedgerFileSha256: inputs.reviewLedgerRawSha256,
    },
    records,
    counts,
    topicStatusCounts: topicStatusCounts(records, inputs.candidate),
    findingFailureCounts,
    verification: {
      exactRecordShapeVerified: records.length,
      canonicalCandidateBindingsVerified: records.length,
      sourcePassageClaimRenderingBindingsVerified: records.length,
      terminalDecisionsVerified: records.length,
      deterministicRepeats: 20,
      deterministicUniqueHashes: 1,
      authoringAutomaticQaTrustedAsDecision: false,
      fullDecisionsStoredOnResearchSsdOnly: true,
      repositoryManifestAggregateAndHashOnly: true,
      crossPassMaterialAccessed: false,
      reconciliationMaterialAccessed: false,
      lockedEvaluationMaterialAccessed: false,
      externalModelUsed: false,
      networkUsed: false,
    },
    boundaries: {
      candidateOnly: true,
      independentSemanticAudit: true,
      independentHumanReview: false,
      codexAuditIsHumanReview: false,
      runtimeAuthority: false,
      releaseAuthority: false,
      activationAuthority: false,
      ownerAuthority: false,
      activeRuntimeGeneration: "v2_legacy",
      v3ReleaseDecision: "no_go_unchanged",
    },
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    ownerAuthority: false,
    independentHumanReview: false,
  }
  return seal(base, "artifactSha256")
}

export function assertArtifact(artifact) {
  assert(artifact.schemaVersion === ARTIFACT_SCHEMA && artifact.version === VERSION
    && artifact.status === STATUS && artifact.records.length === 178,
  "dna_fidelity_artifact_identity")
  assert(stableSha256(omit(artifact, "artifactSha256")) === artifact.artifactSha256,
    "dna_fidelity_artifact_hash")
  assert(artifact.counts.records === 178 && artifact.counts.terminal === 178
    && artifact.counts.claims === 178 && artifact.counts.answerUnits === 178,
  "dna_fidelity_artifact_coverage")
  assert(Object.values(artifact.counts.statusCounts).reduce((sum, value) => sum + value, 0) === 178,
    "dna_fidelity_artifact_status_counts")
  assert(Object.values(artifact.findingFailureCounts).every((value) => value >= 0),
    "dna_fidelity_artifact_finding_counts")
  assert(artifact.runtimeEligible === false && artifact.releaseEligible === false
    && artifact.activationAllowed === false && artifact.ownerAuthority === false
    && artifact.independentHumanReview === false,
  "dna_fidelity_artifact_authority")
  for (const record of artifact.records) {
    assertExactKeys(record, AUDIT_RECORD_KEYS, `dna_fidelity_record_shape:${record.scheduleOrdinal}`)
    assert(stableSha256(omit(record, "recordSha256")) === record.recordSha256,
      `dna_fidelity_record_hash:${record.scheduleOrdinal}`)
    assert(TERMINAL_STATUSES.includes(record.decision.status)
      && record.audit.automaticAuthoringQaUsedAsDecision === false
      && record.audit.independentHumanReview === false
      && record.runtimeEligible === false && record.releaseEligible === false
      && record.activationAllowed === false && record.ownerAuthority === false
      && record.independentHumanReview === false,
    `dna_fidelity_record_boundary:${record.scheduleOrdinal}`)
    for (const hash of Object.values(record.bindings)) assertSha(hash,
      `dna_fidelity_record_binding_hash:${record.scheduleOrdinal}`)
  }
}

function artifactBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function verifyArtifactBytes(root, expected) {
  const path = assertSecurePath(root, join(root, AUDIT_ARTIFACT_RELATIVE_PATH), { mode0600: true })
  const actual = readFileSync(path)
  assert(actual.equals(expected), "dna_fidelity_artifact_file_drift")
  return { path, rawSha256: bytesSha256(actual), bytes: actual.length, mode: "0600" }
}

export function buildManifest(artifact, output) {
  const base = {
    schemaVersion: MANIFEST_SCHEMA,
    recordedAt: artifact.completedAt,
    version: artifact.version,
    status: artifact.status,
    inputHashes: {
      candidatePackageSha256: artifact.input.candidatePackageSha256,
      candidateFileSha256: artifact.input.candidateFileSha256,
      workpackSha256: artifact.input.workpackSha256,
      workpackFileSha256: artifact.input.workpackFileSha256,
      passAArtifactSha256: artifact.input.passAArtifactSha256,
      passAArtifactFileSha256: artifact.input.passAArtifactFileSha256,
      reviewLedgerSha256: artifact.input.reviewLedgerSha256,
      reviewLedgerFileSha256: artifact.input.reviewLedgerFileSha256,
    },
    outputHashes: {
      artifactSha256: artifact.artifactSha256,
      rawSha256: output.rawSha256,
      recordsSha256: stableSha256(artifact.records.map((entry) => entry.recordSha256)),
      byteCount: output.bytes,
      fileMode: "0600",
    },
    counts: artifact.counts,
    topicStatusCounts: artifact.topicStatusCounts,
    findingFailureCounts: artifact.findingFailureCounts,
    verification: artifact.verification,
    boundaries: artifact.boundaries,
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    ownerAuthority: false,
    independentHumanReview: false,
  }
  return seal(base, "manifestSha256")
}

export function assertManifestSafe(manifest, inputs, artifact) {
  const serialized = JSON.stringify(manifest)
  const forbiddenFieldNames = [
    "claimId",
    "sourceId",
    "passageId",
    "answerUnitId",
    "workItemId",
    "turkishRendering",
    "proposition",
    "passageText",
    "originalText",
    "revisionNote",
  ]
  for (const field of forbiddenFieldNames) assert(!serialized.includes(field),
    "dna_fidelity_manifest_field_or_identity_leak")
  for (const item of inputs.workpack.workItems) {
    for (const value of [
      item.id,
      item.topicId,
      item.sourceId,
      item.passageId,
      item.claimId,
      item.answerUnitId,
      item.original.proposition,
      item.original.passageText,
    ]) assert(!serialized.includes(value), "dna_fidelity_manifest_text_or_identity_leak")
  }
  for (const record of inputs.passAArtifact.records) {
    assert(!serialized.includes(record.turkishRendering), "dna_fidelity_manifest_rendering_leak")
  }
  assert(artifact.records.length === 178, "dna_fidelity_manifest_artifact_count")
}

export function execute(command, options = {}) {
  assert(["write", "verify", "print-manifest"].includes(command),
    "dna_fidelity_command_invalid")
  const root = resolveSsdRoot(options.root)
  const repoRoot = resolve(options.repoRoot || process.cwd())
  const inputs = loadInputs(root, repoRoot)
  const artifact = buildArtifact(inputs)
  assertArtifact(artifact)
  const deterministicHashes = Array.from({ length: 20 }, () => buildArtifact(inputs).artifactSha256)
  assert(new Set(deterministicHashes).size === 1
    && deterministicHashes[0] === artifact.artifactSha256,
  "dna_fidelity_nondeterministic")
  const bytes = artifactBytes(artifact)
  const output = command === "write"
    ? secureAtomicWrite(root, join(root, AUDIT_ARTIFACT_RELATIVE_PATH), bytes)
    : verifyArtifactBytes(root, bytes)
  const manifest = buildManifest(artifact, output)
  assertManifestSafe(manifest, inputs, artifact)
  if (command === "verify") {
    const recorded = readRepoJson(repoRoot, REPO_MANIFEST_RELATIVE_PATH).value
    assert(stableSha256(recorded) === stableSha256(manifest),
      "dna_fidelity_repo_manifest_drift")
  }
  return { root, inputs, artifact, output, manifest, deterministicHashes }
}

function publicSummary(result) {
  return {
    ok: true,
    version: VERSION,
    status: STATUS,
    counts: result.artifact.counts,
    reasonCounts: result.artifact.counts.reasonCounts,
    findingFailureCounts: result.artifact.findingFailureCounts,
    deterministicRepeats: result.deterministicHashes.length,
    deterministicUniqueHashes: new Set(result.deterministicHashes).size,
    artifactSha256: result.artifact.artifactSha256,
    artifactFileSha256: result.output.rawSha256,
    recordsSha256: result.manifest.outputHashes.recordsSha256,
    manifestSha256: result.manifest.manifestSha256,
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    ownerAuthority: false,
    independentHumanReview: false,
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  assert(process.argv.length === 3, "dna_fidelity_command_arity")
  const result = execute(process.argv[2])
  process.stdout.write(process.argv[2] === "print-manifest"
    ? `${JSON.stringify(result.manifest, null, 2)}\n`
    : `${JSON.stringify(publicSummary(result), null, 2)}\n`)
}

#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import {
  assertRegularFile0600,
  assertRepoManifestPath,
  assertResearchSsdPath,
  atomicWrite,
  canonicalJson,
  parseArgs,
  sha256Bytes,
  sha256File,
} from "./lib/dna-v3-blind-holdout-io.mjs"
import {
  bytesSha256,
  resolveSsdRoot,
  stableSha256,
} from "./dna-external-science-turkish-full-coverage-workpacks.mjs"

export const VERSION = "dna-external-science-turkish-remaining-neutral-reconciliation@1"
export const ARTIFACT_SCHEMA = "dna-external-science-turkish-remaining-neutral-reconciliation@1"
export const COVERAGE_SCHEMA = "dna-external-science-turkish-full-reconciliation-coverage@1"
export const MANIFEST_SCHEMA = "dna-external-science-turkish-remaining-neutral-reconciliation-manifest@1"
export const COVERAGE_MANIFEST_SCHEMA = "dna-external-science-turkish-full-reconciliation-coverage-manifest@1"
export const DIRECTIVE_AUTHOR_SPEC_SCHEMA = "dna-external-science-turkish-remaining-neutral-directive-author-spec@1"

export const DEFAULT_PATHS = Object.freeze({
  candidate: "Datasets/DNA-Intelligence/work/v3/prebook-closure/v1/external-science-candidate-package.json",
  passA: "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-full-coverage-workpacks/prebook-v1/pass-a/pass-a-remaining-178-artifact.json",
  passB: "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-pass-b-remaining/prebook-v1/pass-b-remaining-candidate-only.json",
  passAAudit: "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-full-coverage-workpacks/prebook-v1/pass-a/pass-a-remaining-178-independent-fidelity-audit.json",
  passBAudit: "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-pass-b-remaining/prebook-v1/pass-b-remaining-178-source-fidelity-audit.json",
  existing42: "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-reconciliation/feasibility-v1/reconciliation-artifact.json",
  directives: "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-remaining-reconciliation/prebook-v1/neutral-review-directives.json",
  artifact: "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-remaining-reconciliation/prebook-v1/reconciliation-artifact.json",
  coverage: "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-remaining-reconciliation/prebook-v1/full-220-coverage-artifact.json",
})

export const REPO_MANIFEST = "docs/dna-intelligence/program/evidence/external-science-turkish-remaining-reconciliation-current.json"
export const REPO_COVERAGE_MANIFEST = "docs/dna-intelligence/program/evidence/external-science-turkish-full-reconciliation-coverage-current.json"

export const TERMINAL_DECISIONS = Object.freeze([
  "exact_match",
  "semantically_equivalent",
  "prefer_a",
  "prefer_b",
  "reconciled_revision",
  "quarantine",
])

export const FIDELITY_DIMENSIONS = Object.freeze([
  "sourceFidelity",
  "numbersPreserved",
  "negationPreserved",
  "hedgePreserved",
  "causalStrengthPreserved",
  "relationshipDirectionPreserved",
  "ageSampleBoundaryPreserved",
  "evidenceBoundaryPreserved",
  "noAddedMechanism",
  "noAddedClinicalInference",
  "noAddedDnaProductValidity",
  "naturalTurkish",
])

const EXPECTED_STATIC = Object.freeze({
  candidateFileSha256: "45c779a88b668f26b9a79c29715ca8709cb3a52afa07c8d4dbae37bc01ee7b3c",
  candidateArtifactSha256: "1efe414cd6fecad250a3bf9cdbb963a51e872f1d13f2041676b5abde1ede20bd",
  passAFileSha256: "7281fa7cc1285567dad66902034f102a304933cacf19a08e9367c837403ed356",
  passAArtifactSha256: "9c439505b32b93bfeec8b709a2e76934f9867e7391e228edd260b7da44688f41",
  passBFileSha256: "4fca1e6e809fdaa62c9984bf5b2c64c38ef5429946b4019c26174285154a3630",
  passBArtifactSha256: "ca25e123d6d93a9ae4eb3f27a87f6c0d84aa285b631cb4062c0efe6b14eb194e",
  passAAuditFileSha256: "642c142189bd2111245530133d9adce1bc66ab530fab9f299a609f29d0dc2008",
  passAAuditArtifactSha256: "ff389ed60232aa0c19e6474c4cb6ee7d457a25b3f279938926ad2f9917b63a20",
  existing42FileSha256: "8a0eaf400ba0c42036fd87b177a2a4a347d9993088b3a01972d10b60bd1efe3e",
  existing42ArtifactSha256: "f0230a06c46fee5de353fb460abbfaadc49b486cea7dca9aea1315c91efa9427",
})

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

function assertSealed(value, key, code) {
  assert(value && typeof value === "object" && typeof value[key] === "string", `${code}_shape`)
  assert(stableSha256(omit(value, key)) === value[key], `${code}_hash`)
}

function assertAuthorityFalse(value, code) {
  assert(value.runtimeEligible === false && value.releaseEligible === false
    && value.activationAllowed === false, `${code}_runtime_release_activation`)
  if ("ownerAuthority" in value) assert(value.ownerAuthority === false, `${code}_owner`)
  if ("ownerBookAuthority" in value) assert(value.ownerBookAuthority === false, `${code}_owner_book`)
  if ("independentHuman" in value) assert(value.independentHuman === false, `${code}_human`)
  if ("independentHumanReview" in value) assert(value.independentHumanReview === false, `${code}_human_review`)
}

function assertInputHash(actual, expected, code) {
  assert(typeof expected === "string" && /^[a-f0-9]{64}$/.test(expected), `${code}_expected_missing`)
  assert(actual === expected, `${code}_drift`)
}

function indexUnique(records, key, code) {
  const map = new Map()
  for (const record of records) {
    assert(typeof record[key] === "string" && !map.has(record[key]), `${code}_duplicate`)
    map.set(record[key], record)
  }
  return map
}

function allPass(value) {
  return value && typeof value === "object"
    && FIDELITY_DIMENSIONS.every((dimension) => value[dimension] === true)
}

function countBy(records, getKey) {
  const counts = {}
  for (const record of records) {
    const key = getKey(record)
    counts[key] = (counts[key] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right, "en")))
}

export function buildDirectivesFromSpec(spec) {
  assert(spec?.schemaVersion === DIRECTIVE_AUTHOR_SPEC_SCHEMA,
    "remaining_reconcile_author_spec_schema")
  assert(typeof spec.reviewedAt === "string" && Array.isArray(spec.rules)
    && spec.rules.length > 0, "remaining_reconcile_author_spec_shape")
  assert(spec.independentHumanReview === false && spec.runtimeEligible === false
    && spec.releaseEligible === false && spec.activationAllowed === false
    && spec.ownerAuthority === false, "remaining_reconcile_author_spec_authority")
  const fidelity = Object.fromEntries(FIDELITY_DIMENSIONS.map((dimension) => [dimension, true]))
  const decisions = []
  const observed = new Set()
  for (const rule of spec.rules) {
    assert(TERMINAL_DECISIONS.includes(rule.terminalDecision)
      && ["a", "b", "both", "revision", "none"].includes(rule.selectedSide)
      && typeof rule.reason === "string" && Array.isArray(rule.ordinals),
    "remaining_reconcile_author_rule_shape")
    for (const ordinal of rule.ordinals) {
      assert(Number.isInteger(ordinal) && ordinal >= 1 && ordinal <= 178
        && !observed.has(ordinal), "remaining_reconcile_author_rule_ordinal")
      observed.add(ordinal)
      const revision = spec.reconciledRevisions?.[String(ordinal)] ?? null
      assert(rule.terminalDecision === "reconciled_revision"
        ? typeof revision === "string" && revision.length > 3
        : revision === null, "remaining_reconcile_author_revision_binding")
      decisions.push({
        ordinal,
        terminalDecision: rule.terminalDecision,
        selectedSide: rule.selectedSide,
        reason: rule.reason,
        reconciledRevision: revision,
        reconciledRevisionSha256: revision === null ? null : bytesSha256(revision),
        fidelity,
      })
    }
  }
  assert(observed.size === 178, "remaining_reconcile_author_exact_coverage")
  decisions.sort((left, right) => left.ordinal - right.ordinal)
  let directives = {
    schemaVersion: "dna-external-science-turkish-remaining-neutral-review-directives@1",
    reviewClass: "codex_neutral_record_by_record_reconciliation_not_human_review",
    reviewedAt: spec.reviewedAt,
    inputHashes: spec.inputHashes,
    decisions,
    counts: {
      decisions: decisions.length,
      terminal: decisions.length,
      byDecision: countBy(decisions, (decision) => decision.terminalDecision),
      byReason: countBy(decisions, (decision) => decision.reason),
    },
    boundaries: {
      passAAuditUsedAsAdditionalEvidenceOnly: true,
      passBAuditUsedAsAdditionalEvidenceOnly: true,
      auditsAreIndependentHumanApproval: false,
      candidateOnly: true,
      liveCatalogBuilt: false,
      liveCatalogActivated: false,
    },
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    ownerAuthority: false,
    independentHumanReview: false,
  }
  directives = seal(directives, "directivesSha256")
  return directives
}

function assertCandidate(candidate) {
  assert(candidate.schemaVersion === "dna-external-science-candidate@1", "remaining_reconcile_candidate_schema")
  assertSealed(candidate, "packageSha256", "remaining_reconcile_candidate")
  assert(candidate.packageSha256 === EXPECTED_STATIC.candidateArtifactSha256, "remaining_reconcile_candidate_artifact_drift")
  assertAuthorityFalse(candidate, "remaining_reconcile_candidate")
  assert(candidate.claims.length === 220 && candidate.answerUnits.length === 220
    && candidate.topics.length === 14, "remaining_reconcile_candidate_counts")
  for (const source of candidate.sources) assertSealed(source, "sourceSha256", "remaining_reconcile_source")
  for (const passage of candidate.passages) {
    assertSealed(passage, "passageSha256", "remaining_reconcile_passage")
    assert(bytesSha256(passage.originalText) === passage.contentSha256, "remaining_reconcile_passage_text_hash")
  }
  for (const claim of candidate.claims) assertSealed(claim, "claimSha256", "remaining_reconcile_claim")
  for (const unit of candidate.answerUnits) assertSealed(unit, "answerUnitSha256", "remaining_reconcile_answer_unit")
}

function assertPassArtifact(artifact, lane) {
  const expectedSchema = lane === "A"
    ? "dna-external-science-turkish-pass-a-remaining-artifact@1"
    : "dna-external-science-turkish-pass-b-remaining-candidate@1"
  assert(artifact.schemaVersion === expectedSchema && artifact.records.length === 178,
    `remaining_reconcile_pass_${lane.toLowerCase()}_schema_count`)
  assertSealed(artifact, "artifactSha256", `remaining_reconcile_pass_${lane.toLowerCase()}`)
  assertAuthorityFalse(artifact, `remaining_reconcile_pass_${lane.toLowerCase()}`)
  for (const record of artifact.records) {
    assertSealed(record, "recordSha256", `remaining_reconcile_pass_${lane.toLowerCase()}_record`)
    assert(typeof record.turkishRendering === "string" && record.turkishRendering.length > 3,
      `remaining_reconcile_pass_${lane.toLowerCase()}_text`)
    assert(bytesSha256(record.turkishRendering) === record.turkishRenderingSha256
      || bytesSha256(record.turkishRendering) === record.bindings?.turkishRenderingSha256,
    `remaining_reconcile_pass_${lane.toLowerCase()}_text_hash`)
  }
}

function assertAudit(artifact, lane) {
  assert(Array.isArray(artifact.records) && artifact.records.length === 178,
    `remaining_reconcile_audit_${lane.toLowerCase()}_count`)
  assertSealed(artifact, "artifactSha256", `remaining_reconcile_audit_${lane.toLowerCase()}`)
  assertAuthorityFalse(artifact, `remaining_reconcile_audit_${lane.toLowerCase()}`)
  for (const record of artifact.records) {
    assertSealed(record, "recordSha256", `remaining_reconcile_audit_${lane.toLowerCase()}_record`)
    assert(["pass", "needs_revision", "quarantine"].includes(record.decision?.status),
      `remaining_reconcile_audit_${lane.toLowerCase()}_terminal`)
  }
}

function assertExisting42(existing) {
  assert(existing.schemaVersion === "dna-external-science-turkish-rendering-reconciliation@1"
    && existing.records.length === 42, "remaining_reconcile_existing_schema_count")
  assertSealed(existing, "artifactSha256", "remaining_reconcile_existing")
  assertAuthorityFalse(existing, "remaining_reconcile_existing")
  for (const record of existing.records) assertSealed(record, "recordSha256", "remaining_reconcile_existing_record")
}

function assertDirectives(directives) {
  assert(directives.schemaVersion === "dna-external-science-turkish-remaining-neutral-review-directives@1"
    && directives.reviewClass === "codex_neutral_record_by_record_reconciliation_not_human_review",
  "remaining_reconcile_directives_identity")
  assertSealed(directives, "directivesSha256", "remaining_reconcile_directives")
  assertAuthorityFalse(directives, "remaining_reconcile_directives")
  assert(Array.isArray(directives.decisions) && directives.decisions.length === 178,
    "remaining_reconcile_directives_count")
  const ordinals = new Set()
  for (const decision of directives.decisions) {
    assert(Number.isInteger(decision.ordinal) && decision.ordinal >= 1 && decision.ordinal <= 178
      && !ordinals.has(decision.ordinal), "remaining_reconcile_directive_ordinal")
    ordinals.add(decision.ordinal)
    assert(TERMINAL_DECISIONS.includes(decision.terminalDecision), "remaining_reconcile_directive_terminal")
    assert(["a", "b", "both", "revision", "none"].includes(decision.selectedSide),
      "remaining_reconcile_directive_side")
    assert(typeof decision.reason === "string" && decision.reason.length > 3,
      "remaining_reconcile_directive_reason")
    assert(allPass(decision.fidelity), "remaining_reconcile_directive_fidelity")
    if (decision.terminalDecision === "reconciled_revision") {
      assert(typeof decision.reconciledRevision === "string" && decision.reconciledRevision.length > 3,
        "remaining_reconcile_directive_revision")
      assert(bytesSha256(decision.reconciledRevision) === decision.reconciledRevisionSha256,
        "remaining_reconcile_directive_revision_hash")
    } else {
      assert(decision.reconciledRevision === null && decision.reconciledRevisionSha256 === null,
        "remaining_reconcile_directive_unexpected_revision")
    }
  }
}

function assertExpectedInputBindings(fileHashes, artifacts, directives) {
  const expected = directives.inputHashes
  const staticPairs = [
    [fileHashes.candidate, EXPECTED_STATIC.candidateFileSha256, "candidate_file"],
    [artifacts.candidate.packageSha256, EXPECTED_STATIC.candidateArtifactSha256, "candidate_artifact"],
    [fileHashes.passA, EXPECTED_STATIC.passAFileSha256, "pass_a_file"],
    [artifacts.passA.artifactSha256, EXPECTED_STATIC.passAArtifactSha256, "pass_a_artifact"],
    [fileHashes.passB, EXPECTED_STATIC.passBFileSha256, "pass_b_file"],
    [artifacts.passB.artifactSha256, EXPECTED_STATIC.passBArtifactSha256, "pass_b_artifact"],
    [fileHashes.passAAudit, EXPECTED_STATIC.passAAuditFileSha256, "pass_a_audit_file"],
    [artifacts.passAAudit.artifactSha256, EXPECTED_STATIC.passAAuditArtifactSha256, "pass_a_audit_artifact"],
    [fileHashes.existing42, EXPECTED_STATIC.existing42FileSha256, "existing_file"],
    [artifacts.existing42.artifactSha256, EXPECTED_STATIC.existing42ArtifactSha256, "existing_artifact"],
  ]
  for (const [actual, pinned, label] of staticPairs) {
    assertInputHash(actual, pinned, `remaining_reconcile_static_${label}`)
    assertInputHash(actual, expected[label], `remaining_reconcile_directive_${label}`)
  }
  assertInputHash(fileHashes.passBAudit, expected.pass_b_audit_file, "remaining_reconcile_directive_pass_b_audit_file")
  assertInputHash(artifacts.passBAudit.artifactSha256, expected.pass_b_audit_artifact,
    "remaining_reconcile_directive_pass_b_audit_artifact")
}

export function buildReconciliation(input) {
  const { candidate, passA, passB, passAAudit, passBAudit, existing42, directives, fileHashes } = input
  assertCandidate(candidate)
  assertPassArtifact(passA, "A")
  assertPassArtifact(passB, "B")
  assertAudit(passAAudit, "A")
  assertAudit(passBAudit, "B")
  assertExisting42(existing42)
  assertDirectives(directives)
  assertExpectedInputBindings(fileHashes,
    { candidate, passA, passB, passAAudit, passBAudit, existing42 }, directives)

  const sourceById = indexUnique(candidate.sources, "id", "remaining_reconcile_source")
  const passageById = indexUnique(candidate.passages, "id", "remaining_reconcile_passage")
  const claimById = indexUnique(candidate.claims, "id", "remaining_reconcile_claim")
  const unitByClaim = new Map(candidate.answerUnits.map((unit) => [unit.claimId, unit]))
  const topicById = indexUnique(candidate.topics, "id", "remaining_reconcile_topic")
  const passBByClaim = indexUnique(passB.records, "claimId", "remaining_reconcile_pass_b")
  const auditAByClaim = indexUnique(passAAudit.records, "claimId", "remaining_reconcile_audit_a")
  const auditBByClaim = indexUnique(passBAudit.records, "claimId", "remaining_reconcile_audit_b")
  const directivesByOrdinal = new Map(directives.decisions.map((decision) => [decision.ordinal, decision]))

  const records = passA.records.map((recordA, index) => {
    const ordinal = index + 1
    const recordB = passBByClaim.get(recordA.claimId)
    const auditA = auditAByClaim.get(recordA.claimId)
    const auditB = auditBByClaim.get(recordA.claimId)
    const directive = directivesByOrdinal.get(ordinal)
    const claim = claimById.get(recordA.claimId)
    const passage = passageById.get(recordA.passageId)
    const source = sourceById.get(recordA.sourceId)
    const answerUnit = unitByClaim.get(recordA.claimId)
    const topic = topicById.get(recordA.topicId)
    assert(recordB && auditA && auditB && directive && claim && passage && source && answerUnit && topic,
      "remaining_reconcile_missing_binding")
    for (const key of ["topicId", "sourceId", "passageId", "answerUnitId"]) {
      assert(recordA[key] === recordB[key], `remaining_reconcile_lane_binding_${key}`)
    }
    assert(claim.topicId === recordA.topicId && claim.sourceId === recordA.sourceId
      && claim.passageId === recordA.passageId && answerUnit.id === recordA.answerUnitId,
    "remaining_reconcile_canonical_identity_binding")
    assert(recordA.bindings.claimSha256 === claim.claimSha256
      && recordB.bindings.claimSha256 === claim.claimSha256
      && recordA.bindings.passageSha256 === passage.passageSha256
      && recordB.bindings.passageSha256 === passage.passageSha256
      && recordA.bindings.sourceSha256 === source.sourceSha256
      && recordB.bindings.sourceSha256 === source.sourceSha256,
    "remaining_reconcile_canonical_hash_binding")
    assert(auditA.bindings?.passARecordSha256 === recordA.recordSha256
      && auditA.decision?.status === "pass", "remaining_reconcile_pass_a_audit_binding")
    const auditBRecordHash = auditB.bindings?.passBRecordSha256
      ?? auditB.bindings?.passBRenderingRecordSha256
      ?? auditB.bindings?.passBArtifactRecordSha256
    assert(auditBRecordHash === recordB.recordSha256, "remaining_reconcile_pass_b_audit_binding")

    const textsExact = recordA.turkishRendering === recordB.turkishRendering
    if (textsExact) assert(directive.terminalDecision === "exact_match",
      "remaining_reconcile_exact_decision_required")
    else assert(directive.terminalDecision !== "exact_match", "remaining_reconcile_false_exact")
    if (auditB.decision.status === "needs_revision") {
      assert(["prefer_a", "reconciled_revision", "quarantine"].includes(directive.terminalDecision),
        "remaining_reconcile_b_revision_not_terminally_resolved")
    }
    if (directive.terminalDecision === "prefer_b" || (directive.terminalDecision === "semantically_equivalent"
      && directive.selectedSide === "b")) {
      assert(auditB.decision.status === "pass", "remaining_reconcile_unapproved_b_selected")
    }

    let finalRendering = null
    if (directive.terminalDecision === "exact_match" || directive.selectedSide === "a"
      || directive.selectedSide === "both") finalRendering = recordA.turkishRendering
    if (directive.selectedSide === "b") finalRendering = recordB.turkishRendering
    if (directive.selectedSide === "revision") finalRendering = directive.reconciledRevision
    const quarantined = directive.terminalDecision === "quarantine"
    assert(quarantined ? finalRendering === null : typeof finalRendering === "string",
      "remaining_reconcile_final_visibility")

    const output = {
      id: `remaining.reconciliation:${recordA.claimId}`,
      ordinal,
      topicId: recordA.topicId,
      sourceId: recordA.sourceId,
      passageId: recordA.passageId,
      claimId: recordA.claimId,
      answerUnitId: recordA.answerUnitId,
      workItemBinding: {
        passAWorkItemId: recordA.workItemId,
        passAWorkItemSha256: recordA.bindings.workItemSha256,
        passBWorkItemId: recordB.workItemId,
        passBWorkItemSha256: recordB.bindings.workItemSha256,
      },
      canonicalSource: {
        proposition: claim.proposition,
        propositionSha256: recordA.bindings.propositionSha256,
        passageText: passage.originalText,
        passageContentSha256: passage.contentSha256,
        claimBoundary: claim.claimBoundary,
        passageBoundary: passage.claimBoundary,
        ageScope: claim.ageScope,
        evidenceLevel: claim.evidenceLevel,
        evidenceType: passage.evidenceType,
        causalStatus: claim.causalStatus,
        relationClass: claim.relationClass,
        dnaProductRelation: claim.dnaProductRelation,
      },
      renderings: {
        passA: recordA.turkishRendering,
        passASha256: recordA.turkishRenderingSha256,
        passB: recordB.turkishRendering,
        passBSha256: recordB.bindings.turkishRenderingSha256,
      },
      audits: {
        passAStatus: auditA.decision.status,
        passAReason: auditA.decision.reason,
        passAAuditRecordSha256: auditA.recordSha256,
        passBStatus: auditB.decision.status,
        passBReason: auditB.decision.reason,
        passBAuditRecordSha256: auditB.recordSha256,
        passAAuditIsIndependentHuman: false,
        passBAuditIsIndependentHuman: false,
      },
      decision: {
        terminal: directive.terminalDecision,
        selectedSide: directive.selectedSide,
        reason: directive.reason,
        fidelity: directive.fidelity,
        canonicalClaimCompared: true,
        canonicalPassageCompared: true,
        bothPassesCompared: true,
        passAAuditUsedAsAdditionalEvidence: true,
        passBAuditUsedAsAdditionalEvidence: true,
        independentHumanReview: false,
      },
      visibility: quarantined ? "hidden_quarantine" : "candidate_only_not_activated",
      finalRendering,
      finalRenderingSha256: finalRendering === null ? null : bytesSha256(finalRendering),
      bindings: {
        candidatePackageSha256: candidate.packageSha256,
        topicSha256: topic.topicSha256,
        sourceSha256: source.sourceSha256,
        passageSha256: passage.passageSha256,
        claimSha256: claim.claimSha256,
        answerUnitSha256: answerUnit.answerUnitSha256,
        passARecordSha256: recordA.recordSha256,
        passBRecordSha256: recordB.recordSha256,
        passAAuditRecordSha256: auditA.recordSha256,
        passBAuditRecordSha256: auditB.recordSha256,
        directiveSha256: stableSha256(directive),
      },
      runtimeEligible: false,
      releaseEligible: false,
      activationAllowed: false,
      ownerAuthority: false,
      independentHumanReview: false,
    }
    return seal(output, "recordSha256")
  })

  assert(records.length === 178 && records.every((record) => TERMINAL_DECISIONS.includes(record.decision.terminal)),
    "remaining_reconcile_terminal_coverage")
  const quarantined = records.filter((record) => record.decision.terminal === "quarantine")
  assert(quarantined.every((record) => record.finalRendering === null
    && record.finalRenderingSha256 === null && record.visibility === "hidden_quarantine"),
  "remaining_reconcile_quarantine_leak")

  const decisionCounts = countBy(records, (record) => record.decision.terminal)
  for (const terminal of TERMINAL_DECISIONS) if (!(terminal in decisionCounts)) decisionCounts[terminal] = 0
  const normalizedDecisionCounts = Object.fromEntries(Object.entries(decisionCounts)
    .sort(([left], [right]) => left.localeCompare(right, "en")))
  const reasonCounts = countBy(records, (record) => record.decision.reason)
  const selectedSideCounts = countBy(records, (record) => record.decision.selectedSide)
  const topicDecisionCounts = candidate.topics.map((topic) => {
    const topicRecords = records.filter((record) => record.topicId === topic.id)
    return {
      topicSha256: topic.topicSha256,
      records: topicRecords.length,
      decisions: Object.fromEntries(TERMINAL_DECISIONS.map((terminal) => [terminal,
        topicRecords.filter((record) => record.decision.terminal === terminal).length])),
      quarantined: topicRecords.filter((record) => record.decision.terminal === "quarantine").length,
    }
  }).sort((left, right) => left.topicSha256.localeCompare(right.topicSha256, "en"))

  let artifact = {
    schemaVersion: ARTIFACT_SCHEMA,
    version: VERSION,
    status: quarantined.length === 0
      ? "remaining_178_terminal_candidate_only"
      : "remaining_178_terminal_with_hidden_quarantine",
    reconciledAt: directives.reviewedAt,
    authorityClass: "external_science_candidate_translation_reconciliation",
    input: {
      ...directives.inputHashes,
      directivesSha256: directives.directivesSha256,
      directivesFileSha256: fileHashes.directives,
    },
    counts: {
      records: 178,
      terminal: records.length,
      finalized: records.length - quarantined.length,
      quarantined: quarantined.length,
      topics: 14,
      sources: new Set(records.map((record) => record.sourceId)).size,
      claims: new Set(records.map((record) => record.claimId)).size,
    },
    decisionCounts: normalizedDecisionCounts,
    selectedSideCounts,
    reasonCounts,
    topicDecisionCounts,
    records,
    recordsSha256: stableSha256(records),
    verification: {
      exactClaimWorkItemBindings: 178,
      canonicalClaimPassageComparisons: 178,
      passAAuditBindings: 178,
      passBAuditBindings: 178,
      terminalDecisions: 178,
      quarantinesHidden: quarantined.length,
      fullTextStoredOnResearchSsdOnly: true,
      repositoryManifestAggregateHashTopicDecisionReasonCountsOnly: true,
      independentHumanReview: false,
    },
    boundaries: {
      existing42Modified: false,
      candidateOnly: true,
      runtimeAuthority: false,
      releaseAuthority: false,
      activationAuthority: false,
      ownerAuthority: false,
      independentHumanReview: false,
      liveCatalogBuilt: false,
      liveCatalogActivated: false,
      activeRuntimeGeneration: "v2_legacy",
    },
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    ownerAuthority: false,
    independentHumanReview: false,
  }
  artifact = seal(artifact, "artifactSha256")

  const existingClaims = new Set(existing42.records.map((record) => record.claimId))
  const remainingClaims = new Set(records.map((record) => record.claimId))
  assert([...existingClaims].every((claimId) => !remainingClaims.has(claimId)),
    "remaining_reconcile_existing_remaining_overlap")
  const candidateClaims = new Set(candidate.claims.map((claim) => claim.id))
  const unionClaims = new Set([...existingClaims, ...remainingClaims])
  assert(unionClaims.size === 220 && [...candidateClaims].every((claimId) => unionClaims.has(claimId)),
    "remaining_reconcile_full_candidate_coverage")

  const coverageRecords = [
    ...existing42.records.map((record) => ({
      lane: "existing_immutable_42",
      claimId: record.claimId,
      topicId: record.topicId,
      sourceId: record.sourceId,
      passageId: record.passageId,
      terminalDecision: record.decision,
      visibility: record.decision === "contested_quarantined" ? "hidden_quarantine" : "candidate_only_not_activated",
      originalRecordSha256: record.recordSha256,
      finalRenderingSha256: record.finalRenderingSha256,
    })),
    ...records.map((record) => ({
      lane: "remaining_neutral_178",
      claimId: record.claimId,
      topicId: record.topicId,
      sourceId: record.sourceId,
      passageId: record.passageId,
      terminalDecision: record.decision.terminal,
      visibility: record.visibility,
      originalRecordSha256: record.recordSha256,
      finalRenderingSha256: record.finalRenderingSha256,
    })),
  ].sort((left, right) => left.claimId.localeCompare(right.claimId, "en"))

  const topicCoverageCounts = candidate.topics.map((topic) => ({
    topicSha256: topic.topicSha256,
    existing42: existing42.records.filter((record) => record.topicId === topic.id).length,
    remaining178: records.filter((record) => record.topicId === topic.id).length,
    total: coverageRecords.filter((record) => record.topicId === topic.id).length,
    quarantined: coverageRecords.filter((record) => record.topicId === topic.id
      && record.visibility === "hidden_quarantine").length,
  })).sort((left, right) => left.topicSha256.localeCompare(right.topicSha256, "en"))

  let coverage = {
    schemaVersion: COVERAGE_SCHEMA,
    version: VERSION,
    status: "exact_220_candidate_translation_coverage_not_activated",
    recordedAt: directives.reviewedAt,
    input: {
      candidatePackageSha256: candidate.packageSha256,
      existing42ArtifactSha256: existing42.artifactSha256,
      remaining178ArtifactSha256: artifact.artifactSha256,
    },
    counts: {
      candidateClaims: 220,
      existingImmutable: 42,
      newlyReconciled: 178,
      exactUnion: 220,
      duplicateClaims: 0,
      missingClaims: 0,
      extraClaims: 0,
      quarantined: coverageRecords.filter((record) => record.visibility === "hidden_quarantine").length,
    },
    topicCoverageCounts,
    records: coverageRecords,
    recordsSha256: stableSha256(coverageRecords),
    boundaries: {
      candidateOnly: true,
      existing42ImmutableHashBound: true,
      runtimeAuthority: false,
      releaseAuthority: false,
      activationAuthority: false,
      ownerAuthority: false,
      independentHumanReview: false,
      liveCatalogBuilt: false,
      liveCatalogActivated: false,
    },
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    ownerAuthority: false,
    independentHumanReview: false,
  }
  coverage = seal(coverage, "coverageSha256")
  return { artifact, coverage }
}

export function buildRepoManifests({ artifact, coverage, artifactBytes, coverageBytes, fileHashes }) {
  let manifest = {
    schemaVersion: MANIFEST_SCHEMA,
    version: VERSION,
    status: artifact.status,
    recordedAt: artifact.reconciledAt,
    inputHashes: artifact.input,
    outputHashes: {
      artifactSha256: artifact.artifactSha256,
      artifactFileSha256: sha256Bytes(artifactBytes),
      recordsSha256: artifact.recordsSha256,
      byteCount: Buffer.byteLength(artifactBytes),
      fileMode: "0600",
    },
    counts: artifact.counts,
    decisionCounts: artifact.decisionCounts,
    selectedSideCounts: artifact.selectedSideCounts,
    reasonCounts: artifact.reasonCounts,
    topicDecisionCounts: artifact.topicDecisionCounts,
    verification: {
      terminal178: artifact.counts.terminal === 178,
      quarantineHidden: true,
      fullTextStoredOnResearchSsdOnly: true,
      repositoryIdentityFields: 0,
      repositoryTextFields: 0,
      passAAuditIsIndependentHuman: false,
      passBAuditIsIndependentHuman: false,
    },
    boundaries: artifact.boundaries,
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    ownerAuthority: false,
    independentHumanReview: false,
  }
  manifest = seal(manifest, "manifestSha256")

  let coverageManifest = {
    schemaVersion: COVERAGE_MANIFEST_SCHEMA,
    version: VERSION,
    status: coverage.status,
    recordedAt: coverage.recordedAt,
    inputHashes: {
      candidatePackageSha256: coverage.input.candidatePackageSha256,
      existing42ArtifactSha256: coverage.input.existing42ArtifactSha256,
      existing42FileSha256: fileHashes.existing42,
      remaining178ArtifactSha256: coverage.input.remaining178ArtifactSha256,
      remaining178ArtifactFileSha256: sha256Bytes(artifactBytes),
    },
    outputHashes: {
      coverageSha256: coverage.coverageSha256,
      coverageFileSha256: sha256Bytes(coverageBytes),
      recordsSha256: coverage.recordsSha256,
      byteCount: Buffer.byteLength(coverageBytes),
      fileMode: "0600",
    },
    counts: coverage.counts,
    topicCoverageCounts: coverage.topicCoverageCounts,
    verification: {
      exactCandidateCoverage: coverage.counts.exactUnion === 220,
      existing42Modified: false,
      existing42HashBound: true,
      repositoryIdentityFields: 0,
      repositoryTextFields: 0,
    },
    boundaries: coverage.boundaries,
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    ownerAuthority: false,
    independentHumanReview: false,
  }
  coverageManifest = seal(coverageManifest, "manifestSha256")
  return { manifest, coverageManifest }
}

function readSecureJson(path, label) {
  assertResearchSsdPath(path, label)
  assertRegularFile0600(path, label)
  return { value: JSON.parse(readFileSync(path, "utf8")), fileSha256: sha256File(path) }
}

export function loadProductionInputs(ssdRoot, paths = DEFAULT_PATHS) {
  const loaded = {}
  const fileHashes = {}
  for (const key of ["candidate", "passA", "passB", "passAAudit", "passBAudit", "existing42", "directives"]) {
    const result = readSecureJson(join(ssdRoot, paths[key]), key)
    loaded[key] = result.value
    fileHashes[key] = result.fileSha256
  }
  return { ...loaded, fileHashes }
}

function assertManifestLeakFree(manifestText, coverageManifestText, artifact, coverage) {
  const combined = `${manifestText}\n${coverageManifestText}`
  for (const forbiddenKey of ["claimId", "sourceId", "passageId", "workItemId", "turkishRendering",
    "finalRendering", "proposition", "passageText"]) {
    assert(!combined.includes(`\"${forbiddenKey}\"`), `remaining_reconcile_manifest_key_leak_${forbiddenKey}`)
  }
  for (const record of artifact.records) {
    assert(!combined.includes(record.claimId) && !combined.includes(record.renderings.passA)
      && !combined.includes(record.renderings.passB), "remaining_reconcile_manifest_record_leak")
  }
  for (const record of coverage.records) assert(!combined.includes(record.claimId),
    "remaining_reconcile_coverage_manifest_identity_leak")
}

export function renderOutputs(input) {
  const { artifact, coverage } = buildReconciliation(input)
  const artifactBytes = canonicalJson(artifact)
  const coverageBytes = canonicalJson(coverage)
  const { manifest, coverageManifest } = buildRepoManifests({
    artifact,
    coverage,
    artifactBytes,
    coverageBytes,
    fileHashes: input.fileHashes,
  })
  const manifestBytes = canonicalJson(manifest)
  const coverageManifestBytes = canonicalJson(coverageManifest)
  assertManifestLeakFree(manifestBytes, coverageManifestBytes, artifact, coverage)
  return { artifact, coverage, manifest, coverageManifest, artifactBytes, coverageBytes,
    manifestBytes, coverageManifestBytes }
}

export function writeProductionOutputs(ssdRoot, repoRoot, rendered, paths = DEFAULT_PATHS) {
  const outputPaths = {
    artifact: join(ssdRoot, paths.artifact),
    coverage: join(ssdRoot, paths.coverage),
    manifest: join(repoRoot, REPO_MANIFEST),
    coverageManifest: join(repoRoot, REPO_COVERAGE_MANIFEST),
  }
  assertResearchSsdPath(outputPaths.artifact, "reconciliation artifact")
  assertResearchSsdPath(outputPaths.coverage, "coverage artifact")
  assertRepoManifestPath(outputPaths.manifest)
  assertRepoManifestPath(outputPaths.coverageManifest)
  assert(Object.values(outputPaths).every((path) => !existsSync(path)),
    "remaining_reconcile_output_preexists")
  atomicWrite(outputPaths.artifact, rendered.artifactBytes, 0o600)
  atomicWrite(outputPaths.coverage, rendered.coverageBytes, 0o600)
  atomicWrite(outputPaths.manifest, rendered.manifestBytes, 0o644)
  atomicWrite(outputPaths.coverageManifest, rendered.coverageManifestBytes, 0o644)
  return outputPaths
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const ssdRoot = resolveSsdRoot(args["ssd-root"])
  const repoRoot = resolve(args["repo-root"] ?? resolve(dirname(fileURLToPath(import.meta.url)), ".."))
  if (args["author-spec"]) {
    const specPath = resolve(args["author-spec"])
    const outputPath = resolve(args["directives-output"] ?? join(ssdRoot, DEFAULT_PATHS.directives))
    const spec = readSecureJson(specPath, "directive author spec").value
    const directives = buildDirectivesFromSpec(spec)
    assertResearchSsdPath(outputPath, "directives output")
    atomicWrite(outputPath, canonicalJson(directives), 0o600)
    if (args.summary) process.stdout.write(`${JSON.stringify({
      ok: true,
      outputPath,
      directivesSha256: directives.directivesSha256,
      counts: directives.counts,
    })}\n`)
    return
  }
  const input = loadProductionInputs(ssdRoot)
  const rendered = renderOutputs(input)
  const outputPaths = writeProductionOutputs(ssdRoot, repoRoot, rendered)
  if (args.summary) {
    process.stdout.write(`${JSON.stringify({
      ok: true,
      outputPaths,
      counts: rendered.artifact.counts,
      decisionCounts: rendered.artifact.decisionCounts,
      reasonCounts: rendered.artifact.reasonCounts,
      hashes: {
        artifactSha256: rendered.artifact.artifactSha256,
        artifactFileSha256: sha256Bytes(rendered.artifactBytes),
        coverageSha256: rendered.coverage.coverageSha256,
        coverageFileSha256: sha256Bytes(rendered.coverageBytes),
        manifestFileSha256: sha256Bytes(rendered.manifestBytes),
        coverageManifestFileSha256: sha256Bytes(rendered.coverageManifestBytes),
      },
    })}\n`)
  }
}

const invoked = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (invoked) {
  try {
    main()
  } catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  }
}

#!/usr/bin/env node

import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { dirname, join, relative, resolve, sep } from "node:path"
import { pathToFileURL } from "node:url"

import {
  assertExactKeys,
  fail,
  sha256,
  stableSha256,
} from "./lib/dna-locked-retrieval-core.mjs"
import {
  assertContained,
  assertSecureParentChain,
  resolveSecureRoot,
  secureAtomicWriteNew,
  secureAtomicWriteReplace,
  verifySecureFile,
} from "./lib/dna-secure-artifact.mjs"
import { assertNeutralSelectionContract } from "./dna-external-science-turkish-neutral-selection.mjs"

const NEUTRAL_RELATIVE_PATH =
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-neutral-selection/feasibility-v1/selection-contract.json"
const PASS_A_RELATIVE_PATH =
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-pass-a/feasibility-v1/pass-a-artifact.json"
const ALIGNED_PASS_B_RELATIVE_PATH =
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-pass-b-aligned/feasibility-v1/rendering-artifact.json"
const CANDIDATE_RELATIVE_PATH =
  "Datasets/DNA-Intelligence/work/v3/prebook-closure/v1/external-science-candidate-package.json"
const DECISIONS_RELATIVE_PATH =
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-reconciliation/feasibility-v1/adjudication-decisions.json"
const OUTPUT_RELATIVE_PATH =
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-reconciliation/feasibility-v1/reconciliation-artifact.json"
const REPO_MANIFEST_RELATIVE_PATH =
  "docs/dna-intelligence/program/evidence/turkish-rendering-reconciliation-current.json"
const EXPECTED_NEUTRAL_SELECTION_SET_SHA256 =
  "19dbb3434f72d023c79fb321781c1be8be43d7376033320d99a36f7f25f910a3"
const ALIGNED_B_SCHEMA = "dna-external-science-turkish-rendering-pass-b-aligned@1"
const DECISIONS_SCHEMA = "dna-external-science-turkish-rendering-reconciliation-decisions@1"
const OUTPUT_SCHEMA = "dna-external-science-turkish-rendering-reconciliation@1"
const MANIFEST_SCHEMA = "dna-external-science-turkish-rendering-reconciliation-manifest@1"
const TERMINAL_DECISIONS = Object.freeze([
  "exact",
  "semantically_equivalent",
  "pass_a_preferred",
  "pass_b_preferred",
  "contested_quarantined",
])
const CHECK_KEYS = Object.freeze([
  "ageEvidenceBoundaryPreserved",
  "causalStrengthPreserved",
  "hedgePreserved",
  "negationPreserved",
  "noAddedClinicalOutcome",
  "noAddedExample",
  "noAddedMechanism",
  "noDiagnosisTreatment",
  "numberPreserved",
])

function parseCommand(argv) {
  if (!Array.isArray(argv) || argv.length !== 1) fail("dna_reconciliation_cli_invalid")
  if (!["status", "preflight", "write", "verify", "test"].includes(argv[0])) {
    fail("dna_reconciliation_command_invalid")
  }
  return argv[0]
}

function assertHash(value, code) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) fail(code)
}

function assertIso(value, code) {
  if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail(code)
}

function assertSelfHash(value, field, code) {
  const { [field]: observed, ...payload } = value
  assertHash(observed, code)
  if (observed !== stableSha256(payload)) fail(code)
}

function readSecureJson(root, requested, code) {
  const path = assertSecureParentChain(root, requested, false)
  if (!existsSync(path)) fail(`${code}_missing`)
  const metadata = lstatSync(path)
  if (metadata.isSymbolicLink()) fail(`${code}_symlink_forbidden`)
  if (!metadata.isFile()) fail(`${code}_not_regular`)
  if ((metadata.mode & 0o777) !== 0o600) fail(`${code}_mode_invalid`)
  const real = realpathSync(path)
  const delta = relative(root, real)
  if (delta === ".." || delta.startsWith(`..${sep}`) || delta.startsWith(sep)) {
    fail(`${code}_realpath_escape`)
  }
  const bytes = readFileSync(real)
  try {
    return { path: real, bytes, value: JSON.parse(bytes.toString("utf8")) }
  } catch {
    fail(`${code}_invalid_json`)
  }
}

function indexById(values, code) {
  const result = new Map()
  if (!Array.isArray(values)) fail(code)
  for (const value of values) {
    if (!value || typeof value.id !== "string" || !value.id || result.has(value.id)) fail(code)
    result.set(value.id, value)
  }
  return result
}

function identity(value) {
  return [value.topicId, value.sourceId, value.claimId, value.passageId, value.slot].join("|")
}

function assertChecks(checks, code) {
  assertExactKeys(checks, CHECK_KEYS, `${code}_fields`)
  if (CHECK_KEYS.some((key) => typeof checks[key] !== "boolean")) fail(`${code}_invalid`)
}

function allChecksPass(checks) {
  return CHECK_KEYS.every((key) => checks[key] === true)
}

function countDecisions(records) {
  return {
    decisions: records.length,
    exact: records.filter((record) => record.decision === "exact").length,
    semanticallyEquivalent: records.filter((record) =>
      record.decision === "semantically_equivalent").length,
    passAPreferred: records.filter((record) => record.decision === "pass_a_preferred").length,
    passBPreferred: records.filter((record) => record.decision === "pass_b_preferred").length,
    contestedQuarantined: records.filter((record) =>
      record.decision === "contested_quarantined").length,
  }
}

function assertCandidate(candidate) {
  if (candidate.schemaVersion !== "dna-external-science-candidate@1"
    || candidate.authorityClass !== "external_science_candidate"
    || candidate.runtimeEligible !== false || candidate.releaseEligible !== false
    || candidate.activationAllowed !== false || !Array.isArray(candidate.claims)
    || !Array.isArray(candidate.passages) || !Array.isArray(candidate.sources)) {
    fail("dna_reconciliation_candidate_contract_invalid")
  }
  assertSelfHash(candidate, "packageSha256", "dna_reconciliation_candidate_hash_mismatch")
  return candidate
}

function assertPassA(passA, neutral, candidate, candidateFileSha256) {
  if (passA.schemaVersion !== "dna-external-science-turkish-rendering-pass-a-artifact@1"
    || passA.candidatePackageSha256 !== candidate.packageSha256
    || passA.candidateFileSha256 !== candidateFileSha256
    || !Array.isArray(passA.records) || passA.records.length !== 42) {
    fail("dna_reconciliation_pass_a_contract_invalid")
  }
  assertSelfHash(passA, "artifactSha256", "dna_reconciliation_pass_a_hash_mismatch")
  const selections = new Map(neutral.selections.map((selection) => [identity(selection), selection]))
  const records = new Map()
  for (const record of passA.records) {
    assertSelfHash(record, "recordSha256", "dna_reconciliation_pass_a_record_hash_mismatch")
    const normalized = { ...record, slot: record.selectionSlot }
    const selection = selections.get(identity(normalized))
    if (!selection || record.candidateClaimSha256 !== selection.candidateClaimSha256
      || record.candidatePassageSha256 !== selection.candidatePassageSha256
      || record.renderingSha256 !== sha256(record.renderingTr)) {
      fail("dna_reconciliation_pass_a_selection_mismatch")
    }
    if (records.has(identity(normalized))) fail("dna_reconciliation_pass_a_duplicate")
    records.set(identity(normalized), record)
  }
  if (records.size !== selections.size
    || [...selections.keys()].some((key) => !records.has(key))) {
    fail("dna_reconciliation_pass_a_selection_set_mismatch")
  }
  return records
}

function assertAlignedBRecord(record) {
  assertExactKeys(record, [
    "activationAllowed", "bindings", "candidateHashes", "claimId", "decision", "fidelity",
    "id", "neutralSelectionId", "neutralSelectionSha256", "originalProposition",
    "originalPropositionSha256", "passageId", "provenance", "releaseEligible",
    "renderingRecordSha256", "runtimeEligible", "slot", "sourceId", "topicId",
    "turkishRendering", "turkishRenderingSha256",
  ], "dna_reconciliation_aligned_b_record_unknown_or_missing_field")
  assertExactKeys(record.candidateHashes, [
    "claimSha256", "passageSha256", "sourceSha256", "topicSha256",
  ], "dna_reconciliation_aligned_b_candidate_hashes_unknown_or_missing_field")
  assertExactKeys(record.bindings, [
    "ageScope", "causalStatus", "claimBoundarySha256", "dnaProductRelation",
    "evidenceLevel", "passageAgeScope", "passageBoundarySha256", "publicationStatus",
    "relationClass",
  ], "dna_reconciliation_aligned_b_bindings_unknown_or_missing_field")
  assertExactKeys(record.fidelity, [
    "causalStrengthPreserved", "hedgePreserved", "negationPreserved",
    "noAddedClinicalAction", "noAddedMechanism", "numberSequencePreserved",
  ], "dna_reconciliation_aligned_b_fidelity_unknown_or_missing_field")
  if (Object.values(record.fidelity).some((value) => value !== true)
    || typeof record.originalProposition !== "string" || !record.originalProposition.trim()
    || record.originalPropositionSha256 !== sha256(record.originalProposition)
    || typeof record.turkishRendering !== "string" || !record.turkishRendering.trim()
    || record.turkishRendering.length > 4000
    || record.turkishRenderingSha256 !== sha256(record.turkishRendering)
    || typeof record.decision !== "string" || !record.decision.trim()
    || record.provenance !== "codex_translation_pass_b_aligned_not_independent_human_review"
    || record.runtimeEligible !== false || record.releaseEligible !== false
    || record.activationAllowed !== false) {
    fail("dna_reconciliation_aligned_b_record_invalid")
  }
  assertSelfHash(record, "renderingRecordSha256",
    "dna_reconciliation_aligned_b_record_hash_mismatch")
}

export function assertAlignedPassB(alignedB, neutral, candidate, candidateFileSha256) {
  assertExactKeys(alignedB, [
    "activationAllowed", "adapterAuthority", "artifactSha256", "authorityClass", "boundaries",
    "counts", "input", "ownerBookAuthority", "provenance", "releaseEligible", "renderings",
    "runtimeEligible", "schemaVersion", "sealedAt", "status", "verification",
  ], "dna_reconciliation_aligned_b_unknown_or_missing_field")
  assertExactKeys(alignedB.input, [
    "authoringFileSha256", "authoringRelativePath", "authoringSha256",
    "candidateFileSha256", "candidatePackageSha256", "candidateRelativePath",
    "neutralSelectionArtifactSha256", "neutralSelectionFileSha256",
    "neutralSelectionRelativePath", "selectionSetSha256",
  ], "dna_reconciliation_aligned_b_input_unknown_or_missing_field")
  assertExactKeys(alignedB.counts, [
    "end", "fidelityPassed", "middle", "renderings", "sources", "start", "topics",
  ], "dna_reconciliation_aligned_b_counts_unknown_or_missing_field")
  assertExactKeys(alignedB.verification, [
    "candidateBindingsVerified", "deterministicRepeats", "deterministicUniqueHashes",
    "fidelityPassed", "lockedHoldoutAccessed", "neutralSelectionBound",
    "passAArtifactRead", "textInRepoManifest",
  ], "dna_reconciliation_aligned_b_verification_unknown_or_missing_field")
  assertExactKeys(alignedB.boundaries, [
    "activationAuthority", "adapterAuthority", "candidateOnly", "independentHumanReview",
    "ownerBookAuthority", "releaseAuthority", "runtimeAuthority", "v3ReleaseDecision",
  ], "dna_reconciliation_aligned_b_boundaries_unknown_or_missing_field")
  if (alignedB.schemaVersion !== ALIGNED_B_SCHEMA
    || alignedB.status !== "candidate_translation_pass_b_aligned"
    || alignedB.authorityClass !== "external_science_candidate_translation_feasibility"
    || alignedB.provenance !== "codex_translation_pass_b_aligned_not_independent_human_review"
    || alignedB.input.neutralSelectionArtifactSha256 !== neutral.artifactSha256
    || alignedB.input.selectionSetSha256 !== EXPECTED_NEUTRAL_SELECTION_SET_SHA256
    || alignedB.input.selectionSetSha256 !== neutral.selectionSetSha256
    || alignedB.input.neutralSelectionRelativePath !== NEUTRAL_RELATIVE_PATH
    || alignedB.input.neutralSelectionFileSha256
      !== sha256(`${JSON.stringify(neutral, null, 2)}\n`)
    || alignedB.input.candidateRelativePath !== CANDIDATE_RELATIVE_PATH
    || alignedB.input.candidatePackageSha256 !== candidate.packageSha256
    || alignedB.input.candidateFileSha256 !== candidateFileSha256
    || alignedB.runtimeEligible !== false || alignedB.releaseEligible !== false
    || alignedB.activationAllowed !== false || alignedB.adapterAuthority !== false
    || alignedB.ownerBookAuthority !== false || !Array.isArray(alignedB.renderings)
    || alignedB.renderings.length !== 42 || alignedB.counts.topics !== 14
    || alignedB.counts.sources !== 14 || alignedB.counts.renderings !== 42
    || alignedB.counts.start !== 14 || alignedB.counts.middle !== 14
    || alignedB.counts.end !== 14 || alignedB.counts.fidelityPassed !== 42
    || alignedB.verification.neutralSelectionBound !== true
    || alignedB.verification.candidateBindingsVerified !== 42
    || alignedB.verification.fidelityPassed !== 42
    || alignedB.verification.deterministicRepeats !== 20
    || alignedB.verification.deterministicUniqueHashes !== 1
    || alignedB.verification.passAArtifactRead !== false
    || alignedB.verification.lockedHoldoutAccessed !== false
    || alignedB.verification.textInRepoManifest !== false
    || alignedB.boundaries.candidateOnly !== true
    || alignedB.boundaries.independentHumanReview !== false
    || alignedB.boundaries.runtimeAuthority !== "none"
    || alignedB.boundaries.releaseAuthority !== "none"
    || alignedB.boundaries.activationAuthority !== "none"
    || alignedB.boundaries.adapterAuthority !== "none"
    || alignedB.boundaries.ownerBookAuthority !== "none"
    || alignedB.boundaries.v3ReleaseDecision !== "no_go_unchanged"
    || typeof alignedB.input.authoringRelativePath !== "string"
    || alignedB.input.authoringRelativePath.includes("..")
    || alignedB.input.authoringRelativePath.startsWith("/")
    || !/^[a-f0-9]{64}$/.test(alignedB.input.authoringFileSha256)
    || !/^[a-f0-9]{64}$/.test(alignedB.input.authoringSha256)) {
    fail("dna_reconciliation_aligned_b_contract_invalid")
  }
  assertIso(alignedB.sealedAt, "dna_reconciliation_aligned_b_timestamp_invalid")
  assertSelfHash(alignedB, "artifactSha256", "dna_reconciliation_aligned_b_hash_mismatch")
  const selections = new Map(neutral.selections.map((selection) => [identity(selection), selection]))
  const topics = indexById(candidate.topics, "dna_reconciliation_candidate_topics_invalid")
  const sources = indexById(candidate.sources, "dna_reconciliation_candidate_sources_invalid")
  const claims = indexById(candidate.claims, "dna_reconciliation_candidate_claims_invalid")
  const passages = indexById(candidate.passages, "dna_reconciliation_candidate_passages_invalid")
  const records = new Map()
  for (const record of alignedB.renderings) {
    assertAlignedBRecord(record)
    const selection = selections.get(identity(record))
    const topic = topics.get(record.topicId)
    const source = sources.get(record.sourceId)
    const claim = claims.get(record.claimId)
    const passage = passages.get(record.passageId)
    if (!selection || !topic || !source || !claim || !passage
      || record.neutralSelectionId !== selection.id
      || record.neutralSelectionSha256 !== selection.selectionSha256
      || record.candidateHashes.claimSha256 !== selection.candidateClaimSha256
      || record.candidateHashes.passageSha256 !== selection.candidatePassageSha256
      || record.candidateHashes.topicSha256 !== topic.topicSha256
      || record.candidateHashes.sourceSha256 !== source.sourceSha256
      || record.originalProposition !== claim.proposition
      || record.originalPropositionSha256 !== sha256(claim.proposition)
      || records.has(identity(record))) {
      fail("dna_reconciliation_aligned_b_selection_mismatch")
    }
    records.set(identity(record), record)
  }
  if (records.size !== selections.size
    || [...selections.keys()].some((key) => !records.has(key))) {
    fail("dna_reconciliation_aligned_b_selection_set_mismatch")
  }
  return records
}

function assertDecisionRecord(record) {
  assertExactKeys(record, [
    "checksA", "checksB", "claimId", "decision", "decisionSha256", "passageId",
    "reviewerRereadSource", "selectedSide", "selectionId", "slot", "sourceFaithfulA",
    "sourceFaithfulB", "sourceId", "topicId",
  ], "dna_reconciliation_decision_record_unknown_or_missing_field")
  assertChecks(record.checksA, "dna_reconciliation_decision_checks_a")
  assertChecks(record.checksB, "dna_reconciliation_decision_checks_b")
  if (!TERMINAL_DECISIONS.includes(record.decision)
    || !["a", "b", null].includes(record.selectedSide)
    || record.reviewerRereadSource !== true
    || typeof record.sourceFaithfulA !== "boolean"
    || typeof record.sourceFaithfulB !== "boolean"
    || (record.sourceFaithfulA && !allChecksPass(record.checksA))
    || (record.sourceFaithfulB && !allChecksPass(record.checksB))) {
    fail("dna_reconciliation_decision_record_invalid")
  }
  assertSelfHash(record, "decisionSha256", "dna_reconciliation_decision_record_hash_mismatch")
}

export function assertDecisions(decisions, neutral, passA, alignedB) {
  assertExactKeys(decisions, [
    "alignedPassBArtifactSha256", "boundaries", "candidatePackageSha256", "counts",
    "decisions", "decisionsSha256", "neutralSelectionArtifactSha256",
    "neutralSelectionSetSha256", "passAArtifactSha256", "provenance", "reviewedAt",
    "schemaVersion", "status",
  ], "dna_reconciliation_decisions_unknown_or_missing_field")
  assertExactKeys(decisions.counts, [
    "contestedQuarantined", "decisions", "exact", "passAPreferred", "passBPreferred",
    "semanticallyEquivalent",
  ], "dna_reconciliation_decisions_counts_unknown_or_missing_field")
  assertExactKeys(decisions.provenance, [
    "externalModelUsed", "independentHumanReview", "networkUsed", "reviewClass",
  ], "dna_reconciliation_decisions_provenance_unknown_or_missing_field")
  assertExactKeys(decisions.boundaries, [
    "activationAuthority", "adapterAuthority", "candidateOnly", "independentHumanReview",
    "ownerBookAuthority", "releaseAuthority", "runtimeAuthority",
  ], "dna_reconciliation_decisions_boundaries_unknown_or_missing_field")
  if (decisions.schemaVersion !== DECISIONS_SCHEMA || decisions.status !== "sealed_adjudication"
    || decisions.neutralSelectionArtifactSha256 !== neutral.artifactSha256
    || decisions.neutralSelectionSetSha256 !== neutral.selectionSetSha256
    || decisions.passAArtifactSha256 !== passA.artifactSha256
    || decisions.alignedPassBArtifactSha256 !== alignedB.artifactSha256
    || decisions.candidatePackageSha256 !== alignedB.input.candidatePackageSha256
    || !Array.isArray(decisions.decisions) || decisions.decisions.length !== 42
    || decisions.provenance.reviewClass !== "codex_multi_pass_source_reread_reconciliation"
    || decisions.provenance.independentHumanReview !== false
    || decisions.provenance.externalModelUsed !== false
    || decisions.provenance.networkUsed !== false
    || decisions.boundaries.candidateOnly !== true
    || decisions.boundaries.independentHumanReview !== false
    || Object.entries(decisions.boundaries).some(([key, value]) =>
      key === "candidateOnly" ? value !== true : value !== false)) {
    fail("dna_reconciliation_decisions_contract_invalid")
  }
  for (const value of [
    decisions.neutralSelectionArtifactSha256,
    decisions.neutralSelectionSetSha256,
    decisions.passAArtifactSha256,
    decisions.alignedPassBArtifactSha256,
    decisions.candidatePackageSha256,
  ]) assertHash(value, "dna_reconciliation_decisions_input_hash_invalid")
  assertIso(decisions.reviewedAt, "dna_reconciliation_decisions_timestamp_invalid")
  decisions.decisions.forEach(assertDecisionRecord)
  const observedCounts = countDecisions(decisions.decisions)
  if (Object.entries(observedCounts).some(([key, value]) => decisions.counts[key] !== value)) {
    fail("dna_reconciliation_decisions_counts_mismatch")
  }
  const selections = new Map(neutral.selections.map((selection) => [identity(selection), selection]))
  const decisionMap = new Map()
  for (const record of decisions.decisions) {
    const key = identity(record)
    const selection = selections.get(key)
    if (!selection || record.selectionId !== selection.id || decisionMap.has(key)) {
      fail("dna_reconciliation_decisions_selection_set_mismatch")
    }
    decisionMap.set(key, record)
  }
  if (decisionMap.size !== selections.size
    || [...selections.keys()].some((key) => !decisionMap.has(key))) {
    fail("dna_reconciliation_decisions_selection_set_mismatch")
  }
  assertSelfHash(decisions, "decisionsSha256", "dna_reconciliation_decisions_hash_mismatch")
  return decisionMap
}

function assertDecisionLogic(decision, renderingA, renderingB) {
  if (decision.decision === "exact") {
    if (renderingA !== renderingB || decision.selectedSide !== "a"
      || !decision.sourceFaithfulA || !decision.sourceFaithfulB) {
      fail("dna_reconciliation_exact_decision_invalid")
    }
    return
  }
  if (decision.decision === "semantically_equivalent") {
    if (renderingA === renderingB || !["a", "b"].includes(decision.selectedSide)
      || !decision.sourceFaithfulA || !decision.sourceFaithfulB) {
      fail("dna_reconciliation_equivalent_decision_invalid")
    }
    return
  }
  if (decision.decision === "pass_a_preferred") {
    if (decision.selectedSide !== "a" || !decision.sourceFaithfulA) {
      fail("dna_reconciliation_pass_a_decision_invalid")
    }
    return
  }
  if (decision.decision === "pass_b_preferred") {
    if (decision.selectedSide !== "b" || !decision.sourceFaithfulB) {
      fail("dna_reconciliation_pass_b_decision_invalid")
    }
    return
  }
  if (decision.selectedSide !== null) fail("dna_reconciliation_quarantine_decision_invalid")
}

export function buildReconciliation(input) {
  const neutral = assertNeutralSelectionContract(input.neutral)
  if (neutral.selectionSetSha256 !== EXPECTED_NEUTRAL_SELECTION_SET_SHA256) {
    fail("dna_reconciliation_neutral_selection_authority_mismatch")
  }
  const candidate = assertCandidate(input.candidate)
  const recordsA = assertPassA(
    input.passA,
    neutral,
    candidate,
    input.candidateFileSha256,
  )
  const recordsB = assertAlignedPassB(
    input.alignedB,
    neutral,
    candidate,
    input.candidateFileSha256,
  )
  const decisionMap = assertDecisions(input.decisions, neutral, input.passA, input.alignedB)
  const claims = indexById(candidate.claims, "dna_reconciliation_candidate_claims_invalid")
  const passages = indexById(candidate.passages, "dna_reconciliation_candidate_passages_invalid")
  const records = neutral.selections.map((selection) => {
    const key = identity(selection)
    const recordA = recordsA.get(key)
    const recordB = recordsB.get(key)
    const decision = decisionMap.get(key)
    const claim = claims.get(selection.claimId)
    const passage = passages.get(selection.passageId)
    if (!recordA || !recordB || !decision || !claim || !passage
      || decision.selectionId !== selection.id) {
      fail("dna_reconciliation_record_binding_missing")
    }
    assertDecisionLogic(decision, recordA.renderingTr, recordB.turkishRendering)
    const finalRendering = decision.selectedSide === "a" ? recordA.renderingTr
      : decision.selectedSide === "b" ? recordB.turkishRendering
        : null
    const payload = {
      id: `reconciled.rendering:${stableSha256({ selectionId: selection.id }).slice(0, 32)}`,
      selectionId: selection.id,
      slot: selection.slot,
      topicId: selection.topicId,
      sourceId: selection.sourceId,
      claimId: selection.claimId,
      passageId: selection.passageId,
      candidateClaimSha256: selection.candidateClaimSha256,
      candidatePassageSha256: selection.candidatePassageSha256,
      sourcePropositionSha256: sha256(claim.proposition),
      sourcePassageContentSha256: passage.contentSha256,
      renderingA: recordA.renderingTr,
      renderingASha256: recordA.renderingSha256,
      renderingB: recordB.turkishRendering,
      renderingBSha256: recordB.turkishRenderingSha256,
      decision: decision.decision,
      selectedSide: decision.selectedSide,
      finalRendering,
      finalRenderingSha256: finalRendering === null ? null : sha256(finalRendering),
      checksA: decision.checksA,
      checksB: decision.checksB,
      sourceFaithfulA: decision.sourceFaithfulA,
      sourceFaithfulB: decision.sourceFaithfulB,
      reviewerRereadSource: decision.reviewerRereadSource,
      runtimeEligible: false,
      releaseEligible: false,
    }
    return { ...payload, recordSha256: stableSha256(payload) }
  })
  const distribution = Object.fromEntries(TERMINAL_DECISIONS.map((decision) => [
    decision,
    records.filter((record) => record.decision === decision).length,
  ]))
  const payload = {
    schemaVersion: OUTPUT_SCHEMA,
    reconciledAt: input.decisions.reviewedAt,
    status: distribution.contested_quarantined > 0
      ? "candidate_reconciled_with_quarantine"
      : "candidate_reconciled",
    authorityClass: "external_science_candidate_reconciliation",
    input: {
      neutralSelectionArtifactSha256: neutral.artifactSha256,
      neutralSelectionSetSha256: neutral.selectionSetSha256,
      passAFileSha256: input.passAFileSha256,
      passAArtifactSha256: input.passA.artifactSha256,
      alignedPassBFileSha256: input.alignedBFileSha256,
      alignedPassBArtifactSha256: input.alignedB.artifactSha256,
      candidateFileSha256: input.candidateFileSha256,
      candidatePackageSha256: candidate.packageSha256,
      decisionsFileSha256: input.decisionsFileSha256,
      decisionsSha256: input.decisions.decisionsSha256,
    },
    counts: {
      topics: new Set(records.map((record) => record.topicId)).size,
      records: records.length,
      finalized: records.filter((record) => record.finalRendering !== null).length,
      quarantined: records.filter((record) => record.finalRendering === null).length,
    },
    decisionDistribution: distribution,
    records,
    recordsSha256: stableSha256(records.map((record) => record.recordSha256)),
    verification: {
      sameNeutralSelectionSet: true,
      candidateBindingsVerified: 42,
      sourceRereadsRecorded: 42,
      finalRenderingCopiedOnlyFromPassAOrB: true,
      thirdRenderingGenerated: false,
      deterministicRepeats: 20,
      deterministicUniqueHashes: 1,
    },
    provenance: {
      reviewClass: "codex_multi_pass_independent_reconciliation",
      independentHumanReview: false,
      externalModelUsed: false,
      networkUsed: false,
    },
    boundaries: {
      candidateOnly: true,
      runtimeAuthority: false,
      releaseAuthority: false,
      activationAuthority: false,
      adapterAuthority: false,
      ownerBookAuthority: false,
      independentHumanReview: false,
    },
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    adapterAuthority: false,
    ownerBookAuthority: false,
  }
  const output = { ...payload, artifactSha256: stableSha256(payload) }
  assertReconciliation(output)
  return output
}

export function assertReconciliation(output) {
  assertExactKeys(output, [
    "activationAllowed", "adapterAuthority", "artifactSha256", "authorityClass", "boundaries",
    "counts", "decisionDistribution", "input", "ownerBookAuthority", "provenance",
    "reconciledAt", "records", "recordsSha256", "releaseEligible", "runtimeEligible",
    "schemaVersion", "status", "verification",
  ], "dna_reconciliation_output_unknown_or_missing_field")
  assertExactKeys(output.input, [
    "alignedPassBArtifactSha256", "alignedPassBFileSha256", "candidateFileSha256",
    "candidatePackageSha256", "decisionsFileSha256", "decisionsSha256",
    "neutralSelectionArtifactSha256", "neutralSelectionSetSha256", "passAArtifactSha256",
    "passAFileSha256",
  ], "dna_reconciliation_output_input_unknown_or_missing_field")
  assertExactKeys(output.counts, [
    "finalized", "quarantined", "records", "topics",
  ], "dna_reconciliation_output_counts_unknown_or_missing_field")
  assertExactKeys(output.decisionDistribution, TERMINAL_DECISIONS,
    "dna_reconciliation_output_distribution_unknown_or_missing_field")
  assertExactKeys(output.verification, [
    "candidateBindingsVerified", "deterministicRepeats", "deterministicUniqueHashes",
    "finalRenderingCopiedOnlyFromPassAOrB", "sameNeutralSelectionSet",
    "sourceRereadsRecorded", "thirdRenderingGenerated",
  ], "dna_reconciliation_output_verification_unknown_or_missing_field")
  assertExactKeys(output.provenance, [
    "externalModelUsed", "independentHumanReview", "networkUsed", "reviewClass",
  ], "dna_reconciliation_output_provenance_unknown_or_missing_field")
  assertExactKeys(output.boundaries, [
    "activationAuthority", "adapterAuthority", "candidateOnly", "independentHumanReview",
    "ownerBookAuthority", "releaseAuthority", "runtimeAuthority",
  ], "dna_reconciliation_output_boundaries_unknown_or_missing_field")
  if (output.schemaVersion !== OUTPUT_SCHEMA
    || output.authorityClass !== "external_science_candidate_reconciliation"
    || !["candidate_reconciled", "candidate_reconciled_with_quarantine"].includes(output.status)
    || !Array.isArray(output.records) || output.records.length !== 42
    || output.runtimeEligible !== false || output.releaseEligible !== false
    || output.activationAllowed !== false || output.adapterAuthority !== false
    || output.ownerBookAuthority !== false) fail("dna_reconciliation_output_contract_invalid")
  for (const value of Object.values(output.input)) {
    assertHash(value, "dna_reconciliation_output_input_hash_invalid")
  }
  assertIso(output.reconciledAt, "dna_reconciliation_output_timestamp_invalid")
  let finalized = 0
  let quarantined = 0
  const observedIdentities = new Set()
  for (const record of output.records) {
    assertExactKeys(record, [
      "candidateClaimSha256", "candidatePassageSha256", "checksA", "checksB", "claimId",
      "decision", "finalRendering", "finalRenderingSha256", "id", "passageId",
      "recordSha256", "releaseEligible", "renderingA", "renderingASha256", "renderingB",
      "renderingBSha256", "reviewerRereadSource", "runtimeEligible", "selectedSide",
      "selectionId", "slot", "sourceFaithfulA", "sourceFaithfulB", "sourceId",
      "sourcePassageContentSha256", "sourcePropositionSha256", "topicId",
    ], "dna_reconciliation_output_record_unknown_or_missing_field")
    assertChecks(record.checksA, "dna_reconciliation_output_record_checks_a")
    assertChecks(record.checksB, "dna_reconciliation_output_record_checks_b")
    const recordIdentity = identity(record)
    if (observedIdentities.has(recordIdentity)
      || typeof record.id !== "string" || !record.id
      || typeof record.selectionId !== "string" || !record.selectionId
      || record.runtimeEligible !== false || record.releaseEligible !== false
      || record.reviewerRereadSource !== true
      || !TERMINAL_DECISIONS.includes(record.decision)
      || !["a", "b", null].includes(record.selectedSide)
      || typeof record.sourceFaithfulA !== "boolean"
      || typeof record.sourceFaithfulB !== "boolean"
      || (record.sourceFaithfulA && !allChecksPass(record.checksA))
      || (record.sourceFaithfulB && !allChecksPass(record.checksB))) {
      fail("dna_reconciliation_output_record_invalid")
    }
    observedIdentities.add(recordIdentity)
    for (const [value, code] of [
      [record.candidateClaimSha256, "claim"],
      [record.candidatePassageSha256, "passage"],
      [record.sourcePropositionSha256, "proposition"],
      [record.sourcePassageContentSha256, "passage_content"],
      [record.renderingASha256, "rendering_a"],
      [record.renderingBSha256, "rendering_b"],
    ]) assertHash(value, `dna_reconciliation_output_${code}_hash_invalid`)
    if (record.renderingASha256 !== sha256(record.renderingA)
      || record.renderingBSha256 !== sha256(record.renderingB)) {
      fail("dna_reconciliation_output_rendering_hash_mismatch")
    }
    assertDecisionLogic(record, record.renderingA, record.renderingB)
    if (record.finalRendering === null) {
      quarantined += 1
      if (record.finalRenderingSha256 !== null || record.selectedSide !== null
        || record.decision !== "contested_quarantined") {
        fail("dna_reconciliation_output_quarantine_invalid")
      }
    } else {
      finalized += 1
      const selected = record.selectedSide === "a" ? record.renderingA
        : record.selectedSide === "b" ? record.renderingB
          : null
      if (selected === null || record.finalRendering !== selected
        || record.finalRenderingSha256 !== sha256(selected)
        || (record.selectedSide === "a" && !record.sourceFaithfulA)
        || (record.selectedSide === "b" && !record.sourceFaithfulB)) {
        fail("dna_reconciliation_output_third_rendering_forbidden")
      }
    }
    const { recordSha256, ...payload } = record
    if (recordSha256 !== stableSha256(payload)) fail("dna_reconciliation_output_record_hash_mismatch")
  }
  const observedDistribution = Object.fromEntries(TERMINAL_DECISIONS.map((decision) => [
    decision,
    output.records.filter((record) => record.decision === decision).length,
  ]))
  if (output.counts.topics !== 14 || output.counts.records !== 42
    || output.counts.finalized !== finalized || output.counts.quarantined !== quarantined
    || Object.entries(observedDistribution).some(([key, value]) =>
      output.decisionDistribution[key] !== value)
    || output.recordsSha256 !== stableSha256(output.records.map((record) => record.recordSha256))
    || output.verification.sameNeutralSelectionSet !== true
    || output.verification.candidateBindingsVerified !== 42
    || output.verification.sourceRereadsRecorded !== 42
    || output.verification.finalRenderingCopiedOnlyFromPassAOrB !== true
    || output.verification.thirdRenderingGenerated !== false
    || output.verification.deterministicRepeats !== 20
    || output.verification.deterministicUniqueHashes !== 1
    || output.provenance.reviewClass !== "codex_multi_pass_independent_reconciliation"
    || output.provenance.independentHumanReview !== false
    || output.provenance.externalModelUsed !== false
    || output.provenance.networkUsed !== false
    || output.boundaries.candidateOnly !== true
    || (quarantined > 0 && output.status !== "candidate_reconciled_with_quarantine")
    || (quarantined === 0 && output.status !== "candidate_reconciled")
    || Object.entries(output.boundaries).some(([key, value]) =>
      key === "candidateOnly" ? value !== true : value !== false)) {
    fail("dna_reconciliation_output_integrity_invalid")
  }
  assertSelfHash(output, "artifactSha256", "dna_reconciliation_output_hash_mismatch")
  return output
}

function buildRepoManifest(output, rawBytes) {
  const payload = {
    schemaVersion: MANIFEST_SCHEMA,
    recordedAt: output.reconciledAt,
    artifact: {
      researchSsdRelativePath: OUTPUT_RELATIVE_PATH,
      rawSha256: sha256(rawBytes),
      artifactSha256: output.artifactSha256,
      fileMode: "0600",
    },
    inputHashes: output.input,
    counts: output.counts,
    decisionDistribution: output.decisionDistribution,
    recordsSha256: output.recordsSha256,
    verification: {
      aggregateOnly: true,
      recordIdsIncluded: false,
      sourceTextFields: 0,
      renderingTextFields: 0,
      deterministicRepeats: 20,
      deterministicUniqueHashes: 1,
    },
    provenance: output.provenance,
    boundaries: output.boundaries,
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    adapterAuthority: false,
    ownerBookAuthority: false,
  }
  return { ...payload, manifestSha256: stableSha256(payload) }
}

function fixedRoots() {
  return {
    repositoryRoot: resolveSecureRoot(process.cwd()),
    researchRoot: resolveSecureRoot(
      process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD",
      { requiredPrefix: "/Volumes/ResearchSSD" },
    ),
  }
}

function loadBaseInputs(researchRoot) {
  const neutral = readSecureJson(researchRoot, join(researchRoot, NEUTRAL_RELATIVE_PATH),
    "dna_reconciliation_neutral")
  const passA = readSecureJson(researchRoot, join(researchRoot, PASS_A_RELATIVE_PATH),
    "dna_reconciliation_pass_a")
  const candidate = readSecureJson(researchRoot, join(researchRoot, CANDIDATE_RELATIVE_PATH),
    "dna_reconciliation_candidate")
  return { neutral, passA, candidate }
}

function loadAllFixed(researchRoot) {
  const base = loadBaseInputs(researchRoot)
  const alignedB = readSecureJson(researchRoot, join(researchRoot, ALIGNED_PASS_B_RELATIVE_PATH),
    "dna_reconciliation_aligned_b")
  const decisions = readSecureJson(researchRoot, join(researchRoot, DECISIONS_RELATIVE_PATH),
    "dna_reconciliation_decisions")
  return { ...base, alignedB, decisions }
}

function buildFromReads(reads) {
  return buildReconciliation({
    neutral: reads.neutral.value,
    passA: reads.passA.value,
    passAFileSha256: sha256(reads.passA.bytes),
    alignedB: reads.alignedB.value,
    alignedBFileSha256: sha256(reads.alignedB.bytes),
    candidate: reads.candidate.value,
    candidateFileSha256: sha256(reads.candidate.bytes),
    decisions: reads.decisions.value,
    decisionsFileSha256: sha256(reads.decisions.bytes),
  })
}

function statusFixed() {
  const { researchRoot } = fixedRoots()
  return {
    ok: true,
    neutralSelectionReady: existsSync(join(researchRoot, NEUTRAL_RELATIVE_PATH)),
    passAReady: existsSync(join(researchRoot, PASS_A_RELATIVE_PATH)),
    alignedPassBReady: existsSync(join(researchRoot, ALIGNED_PASS_B_RELATIVE_PATH)),
    adjudicationDecisionsReady: existsSync(join(researchRoot, DECISIONS_RELATIVE_PATH)),
    reconciliationExecuted: existsSync(join(researchRoot, OUTPUT_RELATIVE_PATH)),
    expectedNeutralSelectionSetSha256: EXPECTED_NEUTRAL_SELECTION_SET_SHA256,
    runtimeEligible: false,
    releaseEligible: false,
  }
}

function preflightFixed() {
  const { researchRoot } = fixedRoots()
  const reads = loadAllFixed(researchRoot)
  const output = buildFromReads(reads)
  return {
    ok: true,
    aligned: true,
    candidateRecords: output.counts.records,
    outputArtifactSha256: output.artifactSha256,
    runtimeEligible: false,
    releaseEligible: false,
  }
}

function writeFixed() {
  const roots = fixedRoots()
  const reads = loadAllFixed(roots.researchRoot)
  const output = buildFromReads(reads)
  const outputText = `${JSON.stringify(output, null, 2)}\n`
  const outputPath = assertContained(roots.researchRoot, join(roots.researchRoot, OUTPUT_RELATIVE_PATH))
  if (existsSync(outputPath)) verifySecureFile(roots.researchRoot, outputPath, outputText)
  else secureAtomicWriteNew(roots.researchRoot, outputPath, outputText)
  const manifest = buildRepoManifest(output, Buffer.from(outputText, "utf8"))
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`
  const manifestPath = assertContained(
    roots.repositoryRoot,
    join(roots.repositoryRoot, REPO_MANIFEST_RELATIVE_PATH),
  )
  secureAtomicWriteReplace(roots.repositoryRoot, manifestPath, manifestText)
  verifySecureFile(roots.researchRoot, outputPath, outputText)
  verifySecureFile(roots.repositoryRoot, manifestPath, manifestText)
  return {
    ok: true,
    artifactSha256: output.artifactSha256,
    rawSha256: sha256(outputText),
    counts: output.counts,
    decisionDistribution: output.decisionDistribution,
    runtimeEligible: false,
    releaseEligible: false,
  }
}

function verifyFixed() {
  const roots = fixedRoots()
  const reads = loadAllFixed(roots.researchRoot)
  const output = buildFromReads(reads)
  const outputText = `${JSON.stringify(output, null, 2)}\n`
  const outputPath = join(roots.researchRoot, OUTPUT_RELATIVE_PATH)
  verifySecureFile(roots.researchRoot, outputPath, outputText)
  const manifest = buildRepoManifest(output, Buffer.from(outputText, "utf8"))
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`
  verifySecureFile(
    roots.repositoryRoot,
    join(roots.repositoryRoot, REPO_MANIFEST_RELATIVE_PATH),
    manifestText,
  )
  return {
    ok: true,
    artifactSha256: output.artifactSha256,
    counts: output.counts,
    decisionDistribution: output.decisionDistribution,
    deterministicRepeats: 20,
    deterministicUniqueHashes: 1,
  }
}

function checks(value = true) {
  return Object.fromEntries(CHECK_KEYS.map((key) => [key, value]))
}

function createAlignedBFixture(neutral, passA, candidate, candidateFileSha256) {
  const passAByIdentity = new Map(passA.records.map((record) => [identity({
    ...record,
    slot: record.selectionSlot,
  }), record]))
  const claims = indexById(candidate.claims, "dna_reconciliation_test_candidate_claims_invalid")
  const topics = indexById(candidate.topics, "dna_reconciliation_test_candidate_topics_invalid")
  const sources = indexById(candidate.sources, "dna_reconciliation_test_candidate_sources_invalid")
  const passages = indexById(candidate.passages, "dna_reconciliation_test_candidate_passages_invalid")
  const renderings = neutral.selections.map((selection) => {
    const recordA = passAByIdentity.get(identity(selection))
    const claim = claims.get(selection.claimId)
    const topic = topics.get(selection.topicId)
    const source = sources.get(selection.sourceId)
    const passage = passages.get(selection.passageId)
    const payload = {
      id: `aligned.synthetic:${stableSha256({ selectionId: selection.id }).slice(0, 32)}`,
      neutralSelectionId: selection.id,
      neutralSelectionSha256: selection.selectionSha256,
      slot: selection.slot,
      topicId: selection.topicId,
      sourceId: selection.sourceId,
      claimId: selection.claimId,
      passageId: selection.passageId,
      candidateHashes: {
        topicSha256: topic.topicSha256,
        sourceSha256: source.sourceSha256,
        claimSha256: selection.candidateClaimSha256,
        passageSha256: selection.candidatePassageSha256,
      },
      originalProposition: claim.proposition,
      originalPropositionSha256: sha256(claim.proposition),
      turkishRendering: recordA.renderingTr,
      turkishRenderingSha256: recordA.renderingSha256,
      decision: "Synthetic aligned rendering.",
      bindings: {
        ageScope: claim.ageScope,
        passageAgeScope: passage.ageScope,
        evidenceLevel: claim.evidenceLevel,
        causalStatus: claim.causalStatus,
        claimBoundarySha256: sha256(claim.claimBoundary),
        passageBoundarySha256: sha256(passage.claimBoundary),
        publicationStatus: claim.publicationStatus,
        relationClass: claim.relationClass,
        dnaProductRelation: claim.dnaProductRelation,
      },
      fidelity: {
        numberSequencePreserved: true,
        negationPreserved: true,
        hedgePreserved: true,
        causalStrengthPreserved: true,
        noAddedClinicalAction: true,
        noAddedMechanism: true,
      },
      provenance: "codex_translation_pass_b_aligned_not_independent_human_review",
      runtimeEligible: false,
      releaseEligible: false,
      activationAllowed: false,
    }
    return { ...payload, renderingRecordSha256: stableSha256(payload) }
  })
  const payload = {
    schemaVersion: ALIGNED_B_SCHEMA,
    sealedAt: neutral.sealedAt,
    status: "candidate_translation_pass_b_aligned",
    authorityClass: "external_science_candidate_translation_feasibility",
    provenance: "codex_translation_pass_b_aligned_not_independent_human_review",
    input: {
      candidateRelativePath: CANDIDATE_RELATIVE_PATH,
      candidateFileSha256,
      candidatePackageSha256: candidate.packageSha256,
      neutralSelectionRelativePath: NEUTRAL_RELATIVE_PATH,
      neutralSelectionFileSha256: sha256(`${JSON.stringify(neutral, null, 2)}\n`),
      neutralSelectionArtifactSha256: neutral.artifactSha256,
      selectionSetSha256: neutral.selectionSetSha256,
      authoringRelativePath: "Outputs/synthetic/aligned-authoring.json",
      authoringFileSha256: "a".repeat(64),
      authoringSha256: "b".repeat(64),
    },
    renderings,
    counts: {
      topics: 14,
      sources: 14,
      renderings: 42,
      start: 14,
      middle: 14,
      end: 14,
      fidelityPassed: 42,
    },
    verification: {
      neutralSelectionBound: true,
      candidateBindingsVerified: 42,
      fidelityPassed: 42,
      deterministicRepeats: 20,
      deterministicUniqueHashes: 1,
      passAArtifactRead: false,
      lockedHoldoutAccessed: false,
      textInRepoManifest: false,
    },
    boundaries: {
      candidateOnly: true,
      independentHumanReview: false,
      runtimeAuthority: "none",
      releaseAuthority: "none",
      activationAuthority: "none",
      adapterAuthority: "none",
      ownerBookAuthority: "none",
      v3ReleaseDecision: "no_go_unchanged",
    },
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    adapterAuthority: false,
    ownerBookAuthority: false,
  }
  return { ...payload, artifactSha256: stableSha256(payload) }
}

function createDecisionsFixture(neutral, passA, alignedB, candidatePackageSha256) {
  const decisionRecords = neutral.selections.map((selection) => {
    const payload = {
      selectionId: selection.id,
      slot: selection.slot,
      topicId: selection.topicId,
      sourceId: selection.sourceId,
      claimId: selection.claimId,
      passageId: selection.passageId,
      decision: "exact",
      selectedSide: "a",
      reviewerRereadSource: true,
      sourceFaithfulA: true,
      sourceFaithfulB: true,
      checksA: checks(),
      checksB: checks(),
    }
    return { ...payload, decisionSha256: stableSha256(payload) }
  })
  const payload = {
    schemaVersion: DECISIONS_SCHEMA,
    reviewedAt: neutral.sealedAt,
    status: "sealed_adjudication",
    neutralSelectionArtifactSha256: neutral.artifactSha256,
    neutralSelectionSetSha256: neutral.selectionSetSha256,
    alignedPassBArtifactSha256: alignedB.artifactSha256,
    passAArtifactSha256: passA.artifactSha256,
    candidatePackageSha256,
    counts: countDecisions(decisionRecords),
    decisions: decisionRecords,
    provenance: {
      reviewClass: "codex_multi_pass_source_reread_reconciliation",
      independentHumanReview: false,
      externalModelUsed: false,
      networkUsed: false,
    },
    boundaries: {
      candidateOnly: true,
      runtimeAuthority: false,
      releaseAuthority: false,
      activationAuthority: false,
      adapterAuthority: false,
      ownerBookAuthority: false,
      independentHumanReview: false,
    },
  }
  return { ...payload, decisionsSha256: stableSha256(payload) }
}

function expectFailure(fn, code, testCode) {
  try {
    fn()
    fail(testCode)
  } catch (error) {
    if (!(error instanceof Error) || error.message !== code) fail(testCode)
  }
}

function runTests() {
  const roots = fixedRoots()
  const base = loadBaseInputs(roots.researchRoot)
  const neutral = assertNeutralSelectionContract(base.neutral.value)
  const candidate = assertCandidate(base.candidate.value)
  const candidateFileSha256 = sha256(base.candidate.bytes)
  const alignedB = createAlignedBFixture(neutral, base.passA.value, candidate, candidateFileSha256)
  const decisions = createDecisionsFixture(
    neutral,
    base.passA.value,
    alignedB,
    candidate.packageSha256,
  )
  const decisionsText = `${JSON.stringify(decisions, null, 2)}\n`
  const input = {
    neutral,
    passA: base.passA.value,
    passAFileSha256: sha256(base.passA.bytes),
    alignedB,
    alignedBFileSha256: sha256(`${JSON.stringify(alignedB, null, 2)}\n`),
    candidate,
    candidateFileSha256,
    decisions,
    decisionsFileSha256: sha256(decisionsText),
  }
  const sandbox = mkdtempSync(join(roots.researchRoot, ".dna-reconciliation-test-"))
  const outside = mkdtempSync(join(roots.researchRoot, ".dna-reconciliation-outside-"))
  let passed = 0
  try {
    const hashes = Array.from({ length: 20 }, () => buildReconciliation(input).artifactSha256)
    if (new Set(hashes).size !== 1) fail("dna_reconciliation_test_determinism_failed")
    passed += 1

    const output = buildReconciliation(input)
    if (output.counts.finalized !== 42 || output.counts.quarantined !== 0
      || output.records.some((record) => record.finalRendering !== record.renderingA
        || record.renderingA !== record.renderingB)) {
      fail("dna_reconciliation_test_exact_fixture_failed")
    }
    passed += 1

    const changedPassAPayload = {
      ...base.passA.value,
      basisAt: "2026-07-24T09:00:00.001Z",
    }
    delete changedPassAPayload.artifactSha256
    const changedPassA = {
      ...changedPassAPayload,
      artifactSha256: stableSha256(changedPassAPayload),
    }
    expectFailure(
      () => buildReconciliation({ ...input, passA: changedPassA }),
      "dna_reconciliation_decisions_contract_invalid",
      "dna_reconciliation_test_pass_a_decision_binding_failed",
    )
    passed += 1

    const badBPayload = {
      ...alignedB,
      renderings: alignedB.renderings.map((record, index) =>
        index === 0 ? { ...record, claimId: "forged-claim" } : record),
    }
    delete badBPayload.artifactSha256
    const badB = { ...badBPayload, artifactSha256: stableSha256(badBPayload) }
    expectFailure(
      () => buildReconciliation({ ...input, alignedB: badB }),
      "dna_reconciliation_aligned_b_record_hash_mismatch",
      "dna_reconciliation_test_selection_tamper_failed",
    )
    passed += 1

    const firstDecision = decisions.decisions[0]
    const unfaithfulPayload = {
      ...firstDecision,
      sourceFaithfulA: false,
    }
    delete unfaithfulPayload.decisionSha256
    const unfaithfulRecord = {
      ...unfaithfulPayload,
      decisionSha256: stableSha256(unfaithfulPayload),
    }
    const unfaithfulDecisionsPayload = {
      ...decisions,
      decisions: decisions.decisions.map((record, index) => index === 0 ? unfaithfulRecord : record),
    }
    delete unfaithfulDecisionsPayload.decisionsSha256
    const unfaithfulDecisions = {
      ...unfaithfulDecisionsPayload,
      decisionsSha256: stableSha256(unfaithfulDecisionsPayload),
    }
    expectFailure(
      () => buildReconciliation({ ...input, decisions: unfaithfulDecisions }),
      "dna_reconciliation_exact_decision_invalid",
      "dna_reconciliation_test_unfaithful_selection_failed",
    )
    passed += 1

    const alteredBRecordPayload = {
      ...alignedB.renderings[0],
      turkishRendering: `${alignedB.renderings[0].turkishRendering} sentetik fark`,
      turkishRenderingSha256: sha256(`${alignedB.renderings[0].turkishRendering} sentetik fark`),
    }
    delete alteredBRecordPayload.renderingRecordSha256
    const alteredBRecord = {
      ...alteredBRecordPayload,
      renderingRecordSha256: stableSha256(alteredBRecordPayload),
    }
    const alteredBPayload = {
      ...alignedB,
      renderings: alignedB.renderings.map((record, index) => index === 0 ? alteredBRecord : record),
    }
    delete alteredBPayload.artifactSha256
    const alteredB = { ...alteredBPayload, artifactSha256: stableSha256(alteredBPayload) }
    const staleDecisionPayload = { ...decisions, alignedPassBArtifactSha256: alteredB.artifactSha256 }
    delete staleDecisionPayload.decisionsSha256
    const staleDecisions = {
      ...staleDecisionPayload,
      decisionsSha256: stableSha256(staleDecisionPayload),
    }
    expectFailure(
      () => buildReconciliation({ ...input, alignedB: alteredB, decisions: staleDecisions }),
      "dna_reconciliation_exact_decision_invalid",
      "dna_reconciliation_test_exact_text_drift_failed",
    )
    passed += 1

    const quarantineRecordPayload = {
      ...firstDecision,
      decision: "contested_quarantined",
      selectedSide: null,
      sourceFaithfulA: false,
      sourceFaithfulB: false,
    }
    delete quarantineRecordPayload.decisionSha256
    const quarantineRecord = {
      ...quarantineRecordPayload,
      decisionSha256: stableSha256(quarantineRecordPayload),
    }
    const quarantineDecisionsPayload = {
      ...decisions,
      decisions: decisions.decisions.map((record, index) => index === 0 ? quarantineRecord : record),
    }
    quarantineDecisionsPayload.counts = countDecisions(quarantineDecisionsPayload.decisions)
    delete quarantineDecisionsPayload.decisionsSha256
    const quarantineDecisions = {
      ...quarantineDecisionsPayload,
      decisionsSha256: stableSha256(quarantineDecisionsPayload),
    }
    const quarantined = buildReconciliation({ ...input, decisions: quarantineDecisions })
    if (quarantined.counts.quarantined !== 1 || quarantined.records[0].finalRendering !== null) {
      fail("dna_reconciliation_test_quarantine_failed")
    }
    passed += 1

    const tampered = {
      ...output,
      records: output.records.map((record, index) =>
        index === 0 ? { ...record, finalRendering: "third rendering" } : record),
    }
    expectFailure(
      () => assertReconciliation(tampered),
      "dna_reconciliation_output_third_rendering_forbidden",
      "dna_reconciliation_test_third_rendering_failed",
    )
    passed += 1

    const outputText = `${JSON.stringify(output, null, 2)}\n`
    const manifest = buildRepoManifest(output, Buffer.from(outputText, "utf8"))
    const manifestText = JSON.stringify(manifest)
    if (Object.hasOwn(manifest, "records")
      || manifestText.includes(output.records[0].selectionId)
      || manifestText.includes(output.records[0].renderingA)) {
      fail("dna_reconciliation_test_repo_text_leak_failed")
    }
    passed += 1

    const parentLink = join(sandbox, "parent-link")
    symlinkSync(outside, parentLink)
    expectFailure(
      () => secureAtomicWriteNew(sandbox, join(parentLink, "output.json"), outputText),
      "dna_secure_parent_symlink_forbidden",
      "dna_reconciliation_test_parent_symlink_failed",
    )
    passed += 1

    const source = join(outside, "source.json")
    writeFileSync(source, "{}\n", { mode: 0o600 })
    const leaf = join(sandbox, "leaf.json")
    symlinkSync(source, leaf)
    expectFailure(
      () => secureAtomicWriteNew(sandbox, leaf, outputText),
      "dna_secure_output_symlink_forbidden",
      "dna_reconciliation_test_leaf_symlink_failed",
    )
    passed += 1

    const secureOutput = join(sandbox, "reconciliation.json")
    secureAtomicWriteNew(sandbox, secureOutput, outputText)
    verifySecureFile(sandbox, secureOutput, outputText)
    chmodSync(secureOutput, 0o644)
    expectFailure(
      () => verifySecureFile(sandbox, secureOutput, outputText),
      "dna_secure_output_mode_invalid",
      "dna_reconciliation_test_mode_failed",
    )
    chmodSync(secureOutput, 0o600)
    passed += 1

    writeFileSync(secureOutput, "{}\n", { mode: 0o600 })
    expectFailure(
      () => verifySecureFile(sandbox, secureOutput, outputText),
      "dna_secure_output_readback_mismatch",
      "dna_reconciliation_test_output_tamper_failed",
    )
    passed += 1

    expectFailure(
      () => secureAtomicWriteNew(sandbox, join(dirname(sandbox), "escape.json"), outputText),
      "dna_secure_path_escape",
      "dna_reconciliation_test_path_escape_failed",
    )
    passed += 1

    return {
      ok: true,
      tests: passed,
      deterministicRepeats: 20,
      deterministicUniqueHashes: 1,
      realAlignedPassBOpened: false,
      realReconciliationExecuted: false,
      lockedHoldoutAccessed: false,
    }
  } finally {
    rmSync(sandbox, { recursive: true, force: true })
    rmSync(outside, { recursive: true, force: true })
  }
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : ""
if (invoked && import.meta.url === pathToFileURL(invoked).href) {
  try {
    const command = parseCommand(process.argv.slice(2))
    const result = command === "status" ? statusFixed()
      : command === "preflight" ? preflightFixed()
        : command === "write" ? writeFixed()
          : command === "verify" ? verifyFixed()
            : runTests()
    process.stdout.write(`${JSON.stringify(result)}\n`)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "dna_reconciliation_unknown_error"}\n`)
    process.exitCode = 1
  }
}

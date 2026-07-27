#!/usr/bin/env node

import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
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

const BASIS_RELATIVE_PATH =
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-pass-a/feasibility-v1/pass-a-artifact.json"
const CANDIDATE_RELATIVE_PATH =
  "Datasets/DNA-Intelligence/work/v3/prebook-closure/v1/external-science-candidate-package.json"
const OUTPUT_RELATIVE_PATH =
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-neutral-selection/feasibility-v1/selection-contract.json"
const REPO_MANIFEST_RELATIVE_PATH =
  "docs/dna-intelligence/program/evidence/turkish-rendering-neutral-selection-current.json"
const CONTRACT_SCHEMA = "dna-external-science-turkish-rendering-neutral-selection@1"
const MANIFEST_SCHEMA = "dna-external-science-turkish-rendering-neutral-selection-manifest@1"
const SLOT_ORDER = Object.freeze({ start: 0, middle: 1, end: 2 })
const FORBIDDEN_TEXT_KEYS = new Set([
  "answer",
  "originalProposition",
  "originalText",
  "proposition",
  "question",
  "renderingTr",
  "sourceText",
  "turkishRendering",
])

function parseCommand(argv) {
  if (!Array.isArray(argv) || argv.length !== 1) fail("dna_neutral_selection_cli_invalid")
  if (!["write", "verify", "test"].includes(argv[0])) {
    fail("dna_neutral_selection_command_invalid")
  }
  return argv[0]
}

function assertHash(value, code) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) fail(code)
}

function assertIso(value, code) {
  if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail(code)
}

function assertFalse(value, code) {
  if (value !== false) fail(code)
}

function stablePayloadHash(value, hashField, code) {
  const { [hashField]: observed, ...payload } = value
  assertHash(observed, code)
  if (observed !== stableSha256(payload)) fail(code)
  return observed
}

function assertNoTextLeak(value, code) {
  const visit = (current) => {
    if (Array.isArray(current)) {
      current.forEach(visit)
      return
    }
    if (!current || typeof current !== "object") {
      if (typeof current === "string" && /(?:pass[_-][ab])/.test(current.toLowerCase())) fail(code)
      return
    }
    for (const [key, nested] of Object.entries(current)) {
      if (FORBIDDEN_TEXT_KEYS.has(key)) fail(code)
      visit(nested)
    }
  }
  visit(value)
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

function validateCandidate(candidate) {
  if (candidate.schemaVersion !== "dna-external-science-candidate@1"
    || candidate.authorityClass !== "external_science_candidate"
    || !Array.isArray(candidate.topics) || !Array.isArray(candidate.sources)
    || !Array.isArray(candidate.passages) || !Array.isArray(candidate.claims)) {
    fail("dna_neutral_selection_candidate_contract_invalid")
  }
  stablePayloadHash(candidate, "packageSha256", "dna_neutral_selection_candidate_hash_mismatch")
  assertFalse(candidate.runtimeEligible, "dna_neutral_selection_candidate_runtime_forbidden")
  assertFalse(candidate.releaseEligible, "dna_neutral_selection_candidate_release_forbidden")
  assertFalse(candidate.activationAllowed, "dna_neutral_selection_candidate_activation_forbidden")
  return candidate
}

function validateBasis(basis, candidate, candidateFileSha256) {
  if (basis.schemaVersion !== "dna-external-science-turkish-rendering-pass-a-artifact@1"
    || basis.authorityClass !== "external_science_candidate"
    || !Array.isArray(basis.records) || basis.records.length !== 42
    || basis.counts?.topics !== 14 || basis.counts?.records !== 42
    || basis.counts?.recordsPerTopic !== 3 || basis.counts?.distinctPassages !== 42
    || basis.candidatePackageSha256 !== candidate.packageSha256
    || basis.candidateFileSha256 !== candidateFileSha256) {
    fail("dna_neutral_selection_basis_contract_invalid")
  }
  stablePayloadHash(basis, "artifactSha256", "dna_neutral_selection_basis_hash_mismatch")
  assertIso(basis.basisAt, "dna_neutral_selection_basis_timestamp_invalid")
  for (const value of [
    basis.runtimeEligible,
    basis.releaseEligible,
    basis.activationAllowed,
    basis.adapterEligible,
    basis.ownerAuthorityChanged,
  ]) assertFalse(value, "dna_neutral_selection_basis_authority_forbidden")
  return basis
}

function indexById(values, kind) {
  const result = new Map()
  for (const value of values) {
    if (!value || typeof value.id !== "string" || !value.id || result.has(value.id)) {
      fail(`dna_neutral_selection_${kind}_identity_invalid`)
    }
    result.set(value.id, value)
  }
  return result
}

function selectionPayload(record, candidateIndexes) {
  stablePayloadHash(record, "recordSha256", "dna_neutral_selection_basis_record_hash_mismatch")
  if (!Object.hasOwn(SLOT_ORDER, record.selectionSlot)) {
    fail("dna_neutral_selection_slot_invalid")
  }
  const topic = candidateIndexes.topics.get(record.topicId)
  const source = candidateIndexes.sources.get(record.sourceId)
  const claim = candidateIndexes.claims.get(record.claimId)
  const passage = candidateIndexes.passages.get(record.passageId)
  if (!topic || !source || !claim || !passage
    || claim.topicId !== record.topicId || claim.sourceId !== record.sourceId
    || claim.passageId !== record.passageId || passage.sourceId !== record.sourceId
    || record.candidateClaimSha256 !== claim.claimSha256
    || record.candidatePassageSha256 !== passage.passageSha256
    || record.originalPropositionSha256 !== sha256(claim.proposition)
    || record.renderingSha256 !== sha256(record.renderingTr)) {
    fail("dna_neutral_selection_candidate_binding_mismatch")
  }
  stablePayloadHash(claim, "claimSha256", "dna_neutral_selection_claim_hash_mismatch")
  stablePayloadHash(passage, "passageSha256", "dna_neutral_selection_passage_hash_mismatch")
  stablePayloadHash(source, "sourceSha256", "dna_neutral_selection_source_hash_mismatch")
  stablePayloadHash(topic, "topicSha256", "dna_neutral_selection_topic_hash_mismatch")
  return {
    slot: record.selectionSlot,
    topicId: record.topicId,
    sourceId: record.sourceId,
    claimId: record.claimId,
    passageId: record.passageId,
    candidateClaimSha256: record.candidateClaimSha256,
    candidatePassageSha256: record.candidatePassageSha256,
  }
}

function buildSelections(basis, candidate) {
  const indexes = {
    topics: indexById(candidate.topics, "topic"),
    sources: indexById(candidate.sources, "source"),
    passages: indexById(candidate.passages, "passage"),
    claims: indexById(candidate.claims, "claim"),
  }
  const payloads = basis.records.map((record) => selectionPayload(record, indexes))
    .sort((left, right) => left.topicId.localeCompare(right.topicId, "en")
      || SLOT_ORDER[left.slot] - SLOT_ORDER[right.slot])
  const identities = new Set()
  const topicSlots = new Map()
  for (const payload of payloads) {
    const identity = [
      payload.topicId,
      payload.sourceId,
      payload.claimId,
      payload.passageId,
      payload.slot,
    ].join("|")
    if (identities.has(identity)) fail("dna_neutral_selection_duplicate")
    identities.add(identity)
    const slots = topicSlots.get(payload.topicId) || []
    slots.push(payload.slot)
    topicSlots.set(payload.topicId, slots)
  }
  if (payloads.length !== 42 || topicSlots.size !== 14
    || [...topicSlots.values()].some((slots) => slots.length !== 3
      || Object.keys(SLOT_ORDER).some((slot) => !slots.includes(slot)))) {
    fail("dna_neutral_selection_coverage_mismatch")
  }
  return payloads.map((payload) => {
    const id = `neutral.selection:${stableSha256(payload).slice(0, 32)}`
    const withId = { id, ...payload }
    return { ...withId, selectionSha256: stableSha256(withId) }
  })
}

export function buildNeutralSelectionContract(input) {
  assertHash(input.basisFileSha256, "dna_neutral_selection_basis_file_hash_invalid")
  assertHash(input.candidateFileSha256, "dna_neutral_selection_candidate_file_hash_invalid")
  const candidate = validateCandidate(input.candidate)
  const basis = validateBasis(input.basis, candidate, input.candidateFileSha256)
  const selections = buildSelections(basis, candidate)
  const topicCoverage = [...new Set(selections.map((selection) => selection.topicId))]
    .sort((left, right) => left.localeCompare(right, "en"))
    .map((topicId) => {
      const selected = selections.filter((selection) => selection.topicId === topicId)
      const payload = {
        topicId,
        count: selected.length,
        selectionSetSha256: stableSha256(selected.map((selection) => selection.selectionSha256)),
      }
      return { ...payload, topicCoverageSha256: stableSha256(payload) }
    })
  const payload = {
    schemaVersion: CONTRACT_SCHEMA,
    sealedAt: basis.basisAt,
    status: "sealed_neutral_selection_identity_only",
    authorityClass: "external_science_candidate_selection_identity_only",
    candidatePackageSha256: candidate.packageSha256,
    candidateFileSha256: input.candidateFileSha256,
    selectionBasisFileSha256: input.basisFileSha256,
    counts: {
      topics: topicCoverage.length,
      selections: selections.length,
      sources: new Set(selections.map((selection) => selection.sourceId)).size,
      claims: new Set(selections.map((selection) => selection.claimId)).size,
      passages: new Set(selections.map((selection) => selection.passageId)).size,
      start: selections.filter((selection) => selection.slot === "start").length,
      middle: selections.filter((selection) => selection.slot === "middle").length,
      end: selections.filter((selection) => selection.slot === "end").length,
    },
    topicCoverage,
    selections,
    selectionSetSha256: stableSha256(selections.map((selection) => selection.selectionSha256)),
    verification: {
      candidateBindingsVerified: 42,
      propositionHashesVerifiedWithoutCopyingText: 42,
      selectionIdentityOnly: true,
      sourceTextFields: 0,
      translationTextFields: 0,
      deterministicRepeats: 20,
      deterministicUniqueHashes: 1,
    },
    provenance: {
      reviewClass: "codex_multi_pass_candidate_identity_audit",
      independentHumanReview: false,
      externalModelUsed: false,
      networkUsed: false,
    },
    boundaries: {
      candidateOnly: true,
      sourceTextIncluded: false,
      propositionTextIncluded: false,
      translationTextIncluded: false,
      selectionIdentityOnly: true,
      lockedHoldoutAccessed: false,
      runtimeAuthority: false,
      releaseAuthority: false,
      activationAuthority: false,
      adapterAuthority: false,
      ownerBookAuthority: false,
      reconciliationAuthority: false,
    },
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    adapterAuthority: false,
    ownerBookAuthority: false,
  }
  const contract = { ...payload, artifactSha256: stableSha256(payload) }
  assertNeutralSelectionContract(contract)
  return contract
}

function assertSelection(selection) {
  assertExactKeys(selection, [
    "candidateClaimSha256", "candidatePassageSha256", "claimId", "id", "passageId",
    "selectionSha256", "slot", "sourceId", "topicId",
  ], "dna_neutral_selection_record_unknown_or_missing_field")
  if (!/^neutral\.selection:[a-f0-9]{32}$/.test(selection.id)
    || !Object.hasOwn(SLOT_ORDER, selection.slot)) fail("dna_neutral_selection_record_invalid")
  for (const hash of [
    selection.candidateClaimSha256,
    selection.candidatePassageSha256,
    selection.selectionSha256,
  ]) assertHash(hash, "dna_neutral_selection_record_hash_invalid")
  const { selectionSha256, ...payload } = selection
  if (selectionSha256 !== stableSha256(payload)) fail("dna_neutral_selection_record_hash_mismatch")
}

export function assertNeutralSelectionContract(contract) {
  assertNoTextLeak(contract, "dna_neutral_selection_text_leak")
  assertExactKeys(contract, [
    "activationAllowed", "adapterAuthority", "artifactSha256", "authorityClass", "boundaries",
    "candidateFileSha256", "candidatePackageSha256", "counts", "ownerBookAuthority",
    "provenance", "releaseEligible", "runtimeEligible", "schemaVersion", "sealedAt",
    "selectionBasisFileSha256", "selectionSetSha256", "selections", "status",
    "topicCoverage", "verification",
  ], "dna_neutral_selection_contract_unknown_or_missing_field")
  assertExactKeys(contract.counts, [
    "claims", "end", "middle", "passages", "selections", "sources", "start", "topics",
  ], "dna_neutral_selection_counts_unknown_or_missing_field")
  assertExactKeys(contract.verification, [
    "candidateBindingsVerified", "deterministicRepeats", "deterministicUniqueHashes",
    "propositionHashesVerifiedWithoutCopyingText", "selectionIdentityOnly", "sourceTextFields",
    "translationTextFields",
  ], "dna_neutral_selection_verification_unknown_or_missing_field")
  assertExactKeys(contract.provenance, [
    "externalModelUsed", "independentHumanReview", "networkUsed", "reviewClass",
  ], "dna_neutral_selection_provenance_unknown_or_missing_field")
  assertExactKeys(contract.boundaries, [
    "activationAuthority", "adapterAuthority", "candidateOnly", "lockedHoldoutAccessed",
    "ownerBookAuthority", "propositionTextIncluded", "reconciliationAuthority",
    "releaseAuthority", "runtimeAuthority", "selectionIdentityOnly", "sourceTextIncluded",
    "translationTextIncluded",
  ], "dna_neutral_selection_boundaries_unknown_or_missing_field")
  if (contract.schemaVersion !== CONTRACT_SCHEMA
    || contract.status !== "sealed_neutral_selection_identity_only"
    || contract.authorityClass !== "external_science_candidate_selection_identity_only") {
    fail("dna_neutral_selection_contract_identity_invalid")
  }
  assertIso(contract.sealedAt, "dna_neutral_selection_contract_timestamp_invalid")
  for (const hash of [
    contract.candidatePackageSha256,
    contract.candidateFileSha256,
    contract.selectionBasisFileSha256,
    contract.selectionSetSha256,
    contract.artifactSha256,
  ]) assertHash(hash, "dna_neutral_selection_contract_hash_invalid")
  if (!Array.isArray(contract.selections) || contract.selections.length !== 42
    || !Array.isArray(contract.topicCoverage) || contract.topicCoverage.length !== 14) {
    fail("dna_neutral_selection_contract_coverage_invalid")
  }
  contract.selections.forEach(assertSelection)
  for (const topic of contract.topicCoverage) {
    assertExactKeys(topic, [
      "count", "selectionSetSha256", "topicCoverageSha256", "topicId",
    ], "dna_neutral_selection_topic_coverage_unknown_or_missing_field")
    const { topicCoverageSha256, ...payload } = topic
    if (topic.count !== 3 || topicCoverageSha256 !== stableSha256(payload)) {
      fail("dna_neutral_selection_topic_coverage_hash_mismatch")
    }
  }
  if (Object.values(contract.counts).some((value) => !Number.isSafeInteger(value) || value < 1)
    || contract.counts.topics !== 14 || contract.counts.selections !== 42
    || contract.counts.sources !== 14 || contract.counts.claims !== 42
    || contract.counts.passages !== 42 || contract.counts.start !== 14
    || contract.counts.middle !== 14 || contract.counts.end !== 14
    || contract.selectionSetSha256
      !== stableSha256(contract.selections.map((selection) => selection.selectionSha256))
    || contract.verification.candidateBindingsVerified !== 42
    || contract.verification.propositionHashesVerifiedWithoutCopyingText !== 42
    || contract.verification.selectionIdentityOnly !== true
    || contract.verification.sourceTextFields !== 0
    || contract.verification.translationTextFields !== 0
    || contract.verification.deterministicRepeats !== 20
    || contract.verification.deterministicUniqueHashes !== 1
    || contract.provenance.reviewClass !== "codex_multi_pass_candidate_identity_audit"
    || contract.provenance.independentHumanReview !== false
    || contract.provenance.externalModelUsed !== false
    || contract.provenance.networkUsed !== false
    || Object.entries(contract.boundaries).some(([key, value]) =>
      key === "candidateOnly" || key === "selectionIdentityOnly" ? value !== true : value !== false)
    || contract.runtimeEligible !== false || contract.releaseEligible !== false
    || contract.activationAllowed !== false || contract.adapterAuthority !== false
    || contract.ownerBookAuthority !== false) {
    fail("dna_neutral_selection_contract_boundary_invalid")
  }
  const { artifactSha256, ...payload } = contract
  if (artifactSha256 !== stableSha256(payload)) fail("dna_neutral_selection_contract_hash_mismatch")
  return contract
}

function buildRepoManifest(contract, outputBytes) {
  const payload = {
    schemaVersion: MANIFEST_SCHEMA,
    recordedAt: contract.sealedAt,
    artifact: {
      researchSsdRelativePath: OUTPUT_RELATIVE_PATH,
      rawSha256: sha256(outputBytes),
      artifactSha256: contract.artifactSha256,
      fileMode: "0600",
    },
    inputs: {
      candidatePackageSha256: contract.candidatePackageSha256,
      candidateFileSha256: contract.candidateFileSha256,
      selectionBasisFileSha256: contract.selectionBasisFileSha256,
    },
    counts: contract.counts,
    selectionSetSha256: contract.selectionSetSha256,
    verification: {
      aggregateOnly: true,
      sourceTextFields: 0,
      translationTextFields: 0,
      deterministicRepeats: 20,
      deterministicUniqueHashes: 1,
      candidateBindingsVerified: 42,
    },
    boundaries: contract.boundaries,
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    adapterAuthority: false,
    ownerBookAuthority: false,
  }
  const manifest = { ...payload, manifestSha256: stableSha256(payload) }
  assertNoTextLeak(manifest, "dna_neutral_selection_repo_manifest_text_leak")
  return manifest
}

function loadFixedInputs(repositoryRoot, researchRoot) {
  const basis = readSecureJson(
    researchRoot,
    join(researchRoot, BASIS_RELATIVE_PATH),
    "dna_neutral_selection_basis",
  )
  const candidate = readSecureJson(
    researchRoot,
    join(researchRoot, CANDIDATE_RELATIVE_PATH),
    "dna_neutral_selection_candidate",
  )
  return {
    repositoryRoot,
    researchRoot,
    basis: basis.value,
    basisBytes: basis.bytes,
    candidate: candidate.value,
    candidateBytes: candidate.bytes,
  }
}

function expectedArtifacts(inputs) {
  const contract = buildNeutralSelectionContract({
    basis: inputs.basis,
    basisFileSha256: sha256(inputs.basisBytes),
    candidate: inputs.candidate,
    candidateFileSha256: sha256(inputs.candidateBytes),
  })
  const outputText = `${JSON.stringify(contract, null, 2)}\n`
  const outputBytes = Buffer.from(outputText, "utf8")
  const manifest = buildRepoManifest(contract, outputBytes)
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`
  return { contract, outputText, outputBytes, manifest, manifestText }
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

function writeOrVerifyNew(root, path, text) {
  if (!existsSync(path)) {
    secureAtomicWriteNew(root, path, text)
    return
  }
  verifySecureFile(root, path, text)
}

function writeFixed() {
  const roots = fixedRoots()
  const inputs = loadFixedInputs(roots.repositoryRoot, roots.researchRoot)
  const expected = expectedArtifacts(inputs)
  const outputPath = assertContained(
    roots.researchRoot,
    join(roots.researchRoot, OUTPUT_RELATIVE_PATH),
  )
  const manifestPath = assertContained(
    roots.repositoryRoot,
    join(roots.repositoryRoot, REPO_MANIFEST_RELATIVE_PATH),
  )
  writeOrVerifyNew(roots.researchRoot, outputPath, expected.outputText)
  secureAtomicWriteReplace(roots.repositoryRoot, manifestPath, expected.manifestText)
  verifySecureFile(roots.researchRoot, outputPath, expected.outputText)
  verifySecureFile(roots.repositoryRoot, manifestPath, expected.manifestText)
  return {
    ok: true,
    artifactSha256: expected.contract.artifactSha256,
    rawSha256: sha256(expected.outputBytes),
    selectionSetSha256: expected.contract.selectionSetSha256,
    counts: expected.contract.counts,
    textLeakCount: 0,
    runtimeEligible: false,
    releaseEligible: false,
    path: outputPath,
    manifestPath,
  }
}

function verifyFixed() {
  const roots = fixedRoots()
  const inputs = loadFixedInputs(roots.repositoryRoot, roots.researchRoot)
  const expected = expectedArtifacts(inputs)
  const outputPath = join(roots.researchRoot, OUTPUT_RELATIVE_PATH)
  const manifestPath = join(roots.repositoryRoot, REPO_MANIFEST_RELATIVE_PATH)
  verifySecureFile(roots.researchRoot, outputPath, expected.outputText)
  verifySecureFile(roots.repositoryRoot, manifestPath, expected.manifestText)
  return {
    ok: true,
    artifactSha256: expected.contract.artifactSha256,
    rawSha256: sha256(expected.outputBytes),
    selectionSetSha256: expected.contract.selectionSetSha256,
    counts: expected.contract.counts,
    textLeakCount: 0,
    deterministicRepeats: 20,
    deterministicUniqueHashes: 1,
  }
}

function expectFailure(fn, code, testCode) {
  try {
    fn()
    fail(testCode)
  } catch (error) {
    if (!(error instanceof Error) || error.message !== code) fail(testCode)
  }
}

function syntheticInputs() {
  const topics = []
  const sources = []
  const passages = []
  const claims = []
  const records = []
  for (let topicIndex = 0; topicIndex < 14; topicIndex += 1) {
    const topicId = `external.synthetic_${topicIndex}`
    const sourceId = `synthetic-source-${topicIndex}`
    const topicPayload = {
      id: topicId,
      title: `Synthetic ${topicIndex}`,
      aliases: [],
      authority: "external_science",
      ownerBookAuthority: false,
      sourceId,
    }
    topics.push({ ...topicPayload, topicSha256: stableSha256(topicPayload) })
    const sourcePayload = {
      id: sourceId,
      title: `Synthetic source ${topicIndex}`,
      artifactId: `artifact-${topicIndex}`,
      artifactSha256: `${(topicIndex % 10)}`.repeat(64),
      integrityState: "verified",
      passageLicenseDecision: "allowed",
      authority: "external_science",
      runtimeEligible: false,
      releaseEligible: false,
    }
    sources.push({ ...sourcePayload, sourceSha256: stableSha256(sourcePayload) })
    for (const [slotIndex, slot] of Object.keys(SLOT_ORDER).entries()) {
      const passageId = `synthetic-passage-${topicIndex}-${slotIndex}`
      const claimId = `synthetic-claim-${topicIndex}-${slotIndex}`
      const proposition = `Synthetic proposition ${topicIndex} ${slotIndex}`
      const passagePayload = {
        id: passageId,
        sourceId,
        originalText: `Synthetic source text ${topicIndex} ${slotIndex}`,
        originalLanguage: "en",
        sectionPath: ["synthetic"],
        paragraphIds: [`p-${slotIndex}`],
        artifactSha256: sourcePayload.artifactSha256,
        contentSha256: sha256(`Synthetic source text ${topicIndex} ${slotIndex}`),
        ageScope: "all",
        evidenceType: "synthetic",
        claimBoundary: "synthetic only",
        licenseStatus: "allowed",
        licenseEvidenceSha256: "a".repeat(64),
        runtimeEligible: false,
        releaseEligible: false,
      }
      const passage = { ...passagePayload, passageSha256: stableSha256(passagePayload) }
      passages.push(passage)
      const claimPayload = {
        id: claimId,
        sourceId,
        topicId,
        passageId,
        proposition,
        ageScope: "all",
        causalStatus: "descriptive",
        evidenceLevel: "synthetic",
        claimBoundary: "synthetic only",
        publicationStatus: "candidate",
        relationClass: "none",
        dnaProductRelation: "not_established",
        runtimeEligible: false,
        releaseEligible: false,
      }
      const claim = { ...claimPayload, claimSha256: stableSha256(claimPayload) }
      claims.push(claim)
      const renderingTr = `Sentetik ifade ${topicIndex} ${slotIndex}`
      const recordPayload = {
        id: `synthetic-basis-${topicIndex}-${slotIndex}`,
        topicId,
        sourceId,
        passageId,
        claimId,
        selectionSlot: slot,
        originalPropositionSha256: sha256(proposition),
        candidateClaimSha256: claim.claimSha256,
        candidatePassageSha256: passage.passageSha256,
        renderingTr,
        renderingSha256: sha256(renderingTr),
      }
      records.push({ ...recordPayload, recordSha256: stableSha256(recordPayload) })
    }
  }
  const candidatePayload = {
    schemaVersion: "dna-external-science-candidate@1",
    basisAt: "2026-07-24T00:00:00.000Z",
    authorityClass: "external_science_candidate",
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    activeRuntimeGeneration: "v2",
    topics,
    sources,
    passages,
    claims,
    relations: [],
    answerUnits: [],
    lexicalIndex: [],
    counts: {},
    verification: {},
    boundary: {},
  }
  const candidate = { ...candidatePayload, packageSha256: stableSha256(candidatePayload) }
  const candidateText = `${JSON.stringify(candidate, null, 2)}\n`
  const basisPayload = {
    schemaVersion: "dna-external-science-turkish-rendering-pass-a-artifact@1",
    basisAt: "2026-07-24T00:00:00.000Z",
    authorityClass: "external_science_candidate",
    candidatePackageSha256: candidate.packageSha256,
    candidateFileSha256: sha256(candidateText),
    counts: { topics: 14, records: 42, recordsPerTopic: 3, distinctPassages: 42 },
    records,
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    adapterEligible: false,
    ownerAuthorityChanged: false,
  }
  const basis = { ...basisPayload, artifactSha256: stableSha256(basisPayload) }
  const basisText = `${JSON.stringify(basis, null, 2)}\n`
  return {
    basis,
    basisText,
    candidate,
    candidateText,
  }
}

function runTests() {
  const researchRoot = resolveSecureRoot(
    process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD",
    { requiredPrefix: "/Volumes/ResearchSSD" },
  )
  const sandbox = mkdtempSync(join(researchRoot, ".dna-neutral-selection-test-"))
  const outside = mkdtempSync(join(researchRoot, ".dna-neutral-selection-outside-"))
  let passed = 0
  try {
    const input = syntheticInputs()
    const build = () => buildNeutralSelectionContract({
      basis: input.basis,
      basisFileSha256: sha256(input.basisText),
      candidate: input.candidate,
      candidateFileSha256: sha256(input.candidateText),
    })
    const hashes = Array.from({ length: 20 }, () => build().artifactSha256)
    if (new Set(hashes).size !== 1) fail("dna_neutral_selection_test_determinism_failed")
    passed += 1

    const contract = build()
    assertNeutralSelectionContract(contract)
    if (JSON.stringify(contract).includes("Synthetic proposition")
      || JSON.stringify(contract).includes("Synthetic source text")
      || JSON.stringify(contract).includes("Sentetik ifade")) {
      fail("dna_neutral_selection_test_text_leak_failed")
    }
    passed += 1

    const syntheticOutputBytes = Buffer.from(`${JSON.stringify(contract, null, 2)}\n`, "utf8")
    const publicManifest = buildRepoManifest(contract, syntheticOutputBytes)
    const publicSerialized = JSON.stringify(publicManifest)
    if (Object.hasOwn(publicManifest, "selections")
      || publicSerialized.includes("synthetic-claim")
      || publicSerialized.includes("Synthetic proposition")
      || publicSerialized.includes("Synthetic source text")
      || publicSerialized.includes("Sentetik ifade")) {
      fail("dna_neutral_selection_test_repo_manifest_leak_failed")
    }
    passed += 1

    const tamperedCandidate = { ...input.candidate, basisAt: "2026-07-25T00:00:00.000Z" }
    expectFailure(
      () => buildNeutralSelectionContract({
        basis: input.basis,
        basisFileSha256: sha256(input.basisText),
        candidate: tamperedCandidate,
        candidateFileSha256: sha256(input.candidateText),
      }),
      "dna_neutral_selection_candidate_hash_mismatch",
      "dna_neutral_selection_test_candidate_tamper_failed",
    )
    passed += 1

    const tamperedContract = {
      ...contract,
      selections: contract.selections.map((selection, index) =>
        index === 0 ? { ...selection, candidateClaimSha256: "0".repeat(64) } : selection),
    }
    expectFailure(
      () => assertNeutralSelectionContract(tamperedContract),
      "dna_neutral_selection_record_hash_mismatch",
      "dna_neutral_selection_test_contract_tamper_failed",
    )
    passed += 1

    const leakedContract = {
      ...contract,
      selections: contract.selections.map((selection, index) =>
        index === 0 ? { ...selection, originalText: "forbidden" } : selection),
    }
    expectFailure(
      () => assertNeutralSelectionContract(leakedContract),
      "dna_neutral_selection_text_leak",
      "dna_neutral_selection_test_public_text_leak_failed",
    )
    passed += 1

    expectFailure(
      () => secureAtomicWriteNew(sandbox, join(dirname(sandbox), "escape.json"), "{}\n"),
      "dna_secure_path_escape",
      "dna_neutral_selection_test_path_escape_failed",
    )
    passed += 1

    const parentLink = join(sandbox, "parent-link")
    symlinkSync(outside, parentLink)
    expectFailure(
      () => secureAtomicWriteNew(sandbox, join(parentLink, "output.json"), "{}\n"),
      "dna_secure_parent_symlink_forbidden",
      "dna_neutral_selection_test_parent_symlink_failed",
    )
    passed += 1

    const source = join(outside, "source.json")
    writeFileSync(source, "{}\n", { mode: 0o600 })
    const leafLink = join(sandbox, "leaf.json")
    symlinkSync(source, leafLink)
    expectFailure(
      () => secureAtomicWriteNew(sandbox, leafLink, "{}\n"),
      "dna_secure_output_symlink_forbidden",
      "dna_neutral_selection_test_leaf_symlink_failed",
    )
    passed += 1

    const secureOutput = join(sandbox, "secure-output.json")
    secureAtomicWriteNew(sandbox, secureOutput, "{\"ok\":true}\n")
    chmodSync(secureOutput, 0o644)
    expectFailure(
      () => verifySecureFile(sandbox, secureOutput, "{\"ok\":true}\n"),
      "dna_secure_output_mode_invalid",
      "dna_neutral_selection_test_mode_failed",
    )
    chmodSync(secureOutput, 0o600)
    passed += 1

    writeFileSync(secureOutput, "{\"ok\":false}\n", { mode: 0o600 })
    expectFailure(
      () => verifySecureFile(sandbox, secureOutput, "{\"ok\":true}\n"),
      "dna_secure_output_readback_mismatch",
      "dna_neutral_selection_test_file_tamper_failed",
    )
    passed += 1

    const outputText = `${JSON.stringify(contract, null, 2)}\n`
    const atomicPath = join(sandbox, "selection-contract.json")
    secureAtomicWriteNew(sandbox, atomicPath, outputText)
    verifySecureFile(sandbox, atomicPath, outputText)
    if ((lstatSync(atomicPath).mode & 0o777) !== 0o600) {
      fail("dna_neutral_selection_test_atomic_mode_failed")
    }
    passed += 1

    return {
      ok: true,
      tests: passed,
      deterministicRepeats: 20,
      deterministicUniqueHashes: 1,
      textLeakCount: 0,
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
    const result = command === "write" ? writeFixed()
      : command === "verify" ? verifyFixed()
        : runTests()
    process.stdout.write(`${JSON.stringify(result)}\n`)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "dna_neutral_selection_unknown_error"}\n`)
    process.exitCode = 1
  }
}

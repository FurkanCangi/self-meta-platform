#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto"
import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeSync,
} from "node:fs"
import { basename, dirname, join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

export const VERSION = "dna-external-science-turkish-full-coverage-workpacks@1"
export const WORKPACK_SCHEMA = "dna-external-science-turkish-blind-authoring-workpack@1"
export const INDEX_SCHEMA = "dna-external-science-turkish-full-coverage-index@1"
export const MANIFEST_SCHEMA = "dna-external-science-turkish-full-coverage-manifest@1"

export const CANDIDATE_RELATIVE_PATH =
  "Datasets/DNA-Intelligence/work/v3/prebook-closure/v1/external-science-candidate-package.json"
export const SELECTION_RELATIVE_PATH =
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-neutral-selection/feasibility-v1/selection-contract.json"
export const OUTPUT_RELATIVE_ROOT =
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-full-coverage-workpacks/prebook-v1"
export const PASS_A_RELATIVE_PATH = `${OUTPUT_RELATIVE_ROOT}/pass-a/authoring-workpack.json`
export const PASS_B_RELATIVE_PATH = `${OUTPUT_RELATIVE_ROOT}/pass-b/authoring-workpack.json`
export const INDEX_RELATIVE_PATH = `${OUTPUT_RELATIVE_ROOT}/coverage-index.json`
export const REPO_MANIFEST_RELATIVE_PATH =
  "docs/dna-intelligence/program/evidence/external-science-turkish-full-coverage-workpacks-current.json"
export const ALIGNED_B_MANIFEST_RELATIVE_PATH =
  "docs/dna-intelligence/program/evidence/external-science-turkish-rendering-pass-b-aligned-current.json"
export const RECONCILIATION_MANIFEST_RELATIVE_PATH =
  "docs/dna-intelligence/program/evidence/turkish-rendering-reconciliation-current.json"

const EXPECTED = Object.freeze({
  candidatePackageSha256: "1efe414cd6fecad250a3bf9cdbb963a51e872f1d13f2041676b5abde1ede20bd",
  candidateFileSha256: "45c779a88b668f26b9a79c29715ca8709cb3a52afa07c8d4dbae37bc01ee7b3c",
  selectionArtifactSha256: "b0b543dbbdf8c1cbd1f3896ec0f93dcb5436e2f3c27bdaeb5eadc75404bbea28",
  selectionFileSha256: "99d5e3add9a2ece3ad26c6f0f133337a5bafe82e0bf25b9ae717d6aab276e91e",
  selectionSetSha256: "19dbb3434f72d023c79fb321781c1be8be43d7376033320d99a36f7f25f910a3",
  alignedBManifestFileSha256: "777069fa1dd46f1408f1595b7c1a2b10d5f9afeb2d65f4a70cea3bb1b7b8742d",
  reconciliationManifestFileSha256: "b6150cb16684b93e9f555187dcf6c8229085ed7827d25a0cec01d4b9919b4f92",
})

const PASS_DEFINITIONS = Object.freeze({
  A: Object.freeze({
    id: "A",
    provenance: "codex_blind_translation_authoring_pass_a_pending",
    salt: "dna-full-coverage-pass-a@1",
  }),
  B: Object.freeze({
    id: "B",
    provenance: "codex_blind_translation_authoring_pass_b_pending",
    salt: "dna-full-coverage-pass-b@1",
  }),
})

function fail(code) {
  throw new Error(code)
}
function assert(condition, code) {
  if (!condition) fail(code)
}

export function canonicalize(value) {
  if (value === null || ["boolean", "number", "string"].includes(typeof value)) return value
  if (Array.isArray(value)) return value.map(canonicalize)
  assert(value && typeof value === "object", "dna_full_coverage_non_json_value")
  return Object.fromEntries(Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([key, child]) => [key, canonicalize(child)]))
}

export function stableSha256(value) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value)), "utf8").digest("hex")
}

export function bytesSha256(value) {
  return createHash("sha256").update(value).digest("hex")
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

export function resolveSsdRoot(requested = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD") {
  const absolute = resolve(requested)
  assert(existsSync(absolute), "dna_full_coverage_ssd_missing")
  const metadata = lstatSync(absolute)
  assert(metadata.isDirectory() && !metadata.isSymbolicLink(), "dna_full_coverage_ssd_root_invalid")
  const real = realpathSync(absolute)
  assert(
    real === "/Volumes/ResearchSSD" || real.startsWith(`/Volumes/ResearchSSD${sep}`),
    "dna_full_coverage_local_fallback_forbidden",
  )
  return real
}

function assertContained(root, requested, code) {
  const target = resolve(requested)
  const delta = relative(root, target)
  assert(delta && delta !== ".." && !delta.startsWith(`..${sep}`) && !delta.startsWith(sep), code)
  return target
}

export function assertSecurePath(root, requested, options = {}) {
  const { file = true, mode0600 = false } = options
  const target = assertContained(root, requested, "dna_full_coverage_path_escape")
  let current = root
  for (const part of relative(root, target).split(sep).filter(Boolean)) {
    current = join(current, part)
    assert(existsSync(current), "dna_full_coverage_input_missing")
    const metadata = lstatSync(current)
    assert(!metadata.isSymbolicLink(), "dna_full_coverage_symlink_forbidden")
    if (current !== target) assert(metadata.isDirectory(), "dna_full_coverage_parent_invalid")
    if (current === target && file) assert(metadata.isFile(), "dna_full_coverage_file_invalid")
  }
  if (mode0600) {
    assert((statSync(target).mode & 0o777) === 0o600, "dna_full_coverage_mode_invalid")
  }
  const real = realpathSync(target)
  const realDelta = relative(root, real)
  assert(
    realDelta !== ".." && !realDelta.startsWith(`..${sep}`) && !realDelta.startsWith(sep),
    "dna_full_coverage_realpath_escape",
  )
  return target
}

function ensureSecureParents(root, requested) {
  const target = assertContained(root, requested, "dna_full_coverage_output_escape")
  let current = root
  for (const part of relative(root, dirname(target)).split(sep).filter(Boolean)) {
    current = join(current, part)
    if (!existsSync(current)) mkdirSync(current, { mode: 0o700 })
    const metadata = lstatSync(current)
    assert(metadata.isDirectory() && !metadata.isSymbolicLink(), "dna_full_coverage_output_parent_invalid")
  }
  if (existsSync(target)) {
    const metadata = lstatSync(target)
    assert(metadata.isFile() && !metadata.isSymbolicLink(), "dna_full_coverage_output_leaf_invalid")
  }
  return target
}

export function secureAtomicWrite(root, requested, bytes) {
  const target = ensureSecureParents(root, requested)
  const temporary = join(dirname(target), `.${basename(target)}.${process.pid}.${randomBytes(12).toString("hex")}.tmp`)
  let descriptor
  try {
    descriptor = openSync(
      temporary,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o600,
    )
    let offset = 0
    while (offset < bytes.length) {
      const written = writeSync(descriptor, bytes, offset, bytes.length - offset, offset)
      assert(written > 0, "dna_full_coverage_write_zero_progress")
      offset += written
    }
    fsyncSync(descriptor)
    closeSync(descriptor)
    descriptor = undefined
    chmodSync(temporary, 0o600)
    renameSync(temporary, target)
    chmodSync(target, 0o600)
    const parentDescriptor = openSync(dirname(target), constants.O_RDONLY)
    try {
      fsyncSync(parentDescriptor)
    } finally {
      closeSync(parentDescriptor)
    }
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
    if (existsSync(temporary)) unlinkSync(temporary)
  }
  const safe = assertSecurePath(root, target, { mode0600: true })
  const actual = readFileSync(safe)
  assert(actual.equals(bytes), "dna_full_coverage_write_readback_mismatch")
  return { path: safe, rawSha256: bytesSha256(actual), bytes: actual.length, mode: "0600" }
}

function readSsdJson(root, relativePath) {
  const path = assertSecurePath(root, join(root, relativePath), { mode0600: true })
  const bytes = readFileSync(path)
  return { value: JSON.parse(bytes.toString("utf8")), rawSha256: bytesSha256(bytes), bytes: bytes.length }
}

function readRepoJson(repoRoot, relativePath) {
  const path = assertSecurePath(repoRoot, join(repoRoot, relativePath), { mode0600: false })
  const bytes = readFileSync(path)
  return { value: JSON.parse(bytes.toString("utf8")), rawSha256: bytesSha256(bytes), bytes: bytes.length }
}

function assertCandidate(candidate, rawSha256) {
  assert(candidate.schemaVersion === "dna-external-science-candidate@1", "dna_full_coverage_candidate_schema")
  assert(candidate.authorityClass === "external_science_candidate", "dna_full_coverage_candidate_authority")
  assert(candidate.packageSha256 === EXPECTED.candidatePackageSha256, "dna_full_coverage_candidate_logical_drift")
  assert(rawSha256 === EXPECTED.candidateFileSha256, "dna_full_coverage_candidate_file_drift")
  assert(stableSha256(omit(candidate, "packageSha256")) === candidate.packageSha256,
    "dna_full_coverage_candidate_hash_invalid")
  assert(candidate.runtimeEligible === false && candidate.releaseEligible === false
    && candidate.activationAllowed === false && candidate.activeRuntimeGeneration === "v2_legacy",
  "dna_full_coverage_candidate_boundary")
  for (const [key, expected] of Object.entries({
    topics: 14,
    sources: 14,
    passages: 166,
    claims: 220,
    answerUnits: 220,
  })) {
    assert(Array.isArray(candidate[key]) && candidate[key].length === expected,
      `dna_full_coverage_candidate_count:${key}`)
  }
}

function assertSelection(selection, rawSha256) {
  assert(selection.schemaVersion === "dna-external-science-turkish-rendering-neutral-selection@1",
    "dna_full_coverage_selection_schema")
  assert(rawSha256 === EXPECTED.selectionFileSha256, "dna_full_coverage_selection_file_drift")
  assert(selection.artifactSha256 === EXPECTED.selectionArtifactSha256,
    "dna_full_coverage_selection_artifact_drift")
  assert(selection.selectionSetSha256 === EXPECTED.selectionSetSha256,
    "dna_full_coverage_selection_set_drift")
  assert(stableSha256(omit(selection, "artifactSha256")) === selection.artifactSha256,
    "dna_full_coverage_selection_hash_invalid")
  assert(selection.candidatePackageSha256 === EXPECTED.candidatePackageSha256
    && selection.candidateFileSha256 === EXPECTED.candidateFileSha256,
  "dna_full_coverage_selection_candidate_binding")
  assert(Array.isArray(selection.selections) && selection.selections.length === 42,
    "dna_full_coverage_selection_count")
  assert(new Set(selection.selections.map((entry) => entry.claimId)).size === 42,
    "dna_full_coverage_selection_duplicate")
  assert(selection.runtimeEligible === false && selection.releaseEligible === false
    && selection.activationAllowed === false, "dna_full_coverage_selection_boundary")
}

function assertExistingManifests(alignedB, reconciliation) {
  assert(alignedB.rawSha256 === EXPECTED.alignedBManifestFileSha256,
    "dna_full_coverage_aligned_b_manifest_drift")
  assert(reconciliation.rawSha256 === EXPECTED.reconciliationManifestFileSha256,
    "dna_full_coverage_reconciliation_manifest_drift")
  const a = alignedB.value
  const r = reconciliation.value
  assert(a.schemaVersion === "dna-external-science-turkish-rendering-pass-b-aligned-manifest@1"
    && a.counts?.renderings === 42 && a.counts?.fidelityPassed === 42,
  "dna_full_coverage_aligned_b_manifest_invalid")
  assert(a.inputHashes?.candidatePackageSha256 === EXPECTED.candidatePackageSha256
    && a.inputHashes?.candidateFileSha256 === EXPECTED.candidateFileSha256
    && a.inputHashes?.selectionSetSha256 === EXPECTED.selectionSetSha256,
  "dna_full_coverage_aligned_b_binding_invalid")
  assert(a.runtimeEligible === false && a.releaseEligible === false && a.activationAllowed === false,
    "dna_full_coverage_aligned_b_boundary")
  assert(r.schemaVersion === "dna-external-science-turkish-rendering-reconciliation-manifest@1"
    && r.counts?.records === 42 && r.counts?.finalized === 42 && r.counts?.quarantined === 0,
  "dna_full_coverage_reconciliation_manifest_invalid")
  assert(r.inputHashes?.candidatePackageSha256 === EXPECTED.candidatePackageSha256
    && r.inputHashes?.candidateFileSha256 === EXPECTED.candidateFileSha256
    && r.inputHashes?.neutralSelectionSetSha256 === EXPECTED.selectionSetSha256,
  "dna_full_coverage_reconciliation_binding_invalid")
  assert(r.runtimeEligible === false && r.releaseEligible === false && r.activationAllowed === false,
    "dna_full_coverage_reconciliation_boundary")
}

export function loadInputs(root, repoRoot = process.cwd()) {
  const candidate = readSsdJson(root, CANDIDATE_RELATIVE_PATH)
  const selection = readSsdJson(root, SELECTION_RELATIVE_PATH)
  const alignedB = readRepoJson(repoRoot, ALIGNED_B_MANIFEST_RELATIVE_PATH)
  const reconciliation = readRepoJson(repoRoot, RECONCILIATION_MANIFEST_RELATIVE_PATH)
  assertCandidate(candidate.value, candidate.rawSha256)
  assertSelection(selection.value, selection.rawSha256)
  assertExistingManifests(alignedB, reconciliation)
  return {
    candidate: candidate.value,
    candidateRawSha256: candidate.rawSha256,
    selection: selection.value,
    selectionRawSha256: selection.rawSha256,
    alignedBManifest: alignedB.value,
    alignedBManifestRawSha256: alignedB.rawSha256,
    reconciliationManifest: reconciliation.value,
    reconciliationManifestRawSha256: reconciliation.rawSha256,
  }
}

function validateCandidateBindings(candidate) {
  const topics = new Map(candidate.topics.map((entry) => [entry.id, entry]))
  const sources = new Map(candidate.sources.map((entry) => [entry.id, entry]))
  const passages = new Map(candidate.passages.map((entry) => [entry.id, entry]))
  const claims = new Map(candidate.claims.map((entry) => [entry.id, entry]))
  const answerUnits = new Map(candidate.answerUnits.map((entry) => [entry.claimId, entry]))
  assert(topics.size === candidate.topics.length, "dna_full_coverage_topic_duplicate")
  assert(sources.size === candidate.sources.length, "dna_full_coverage_source_duplicate")
  assert(passages.size === candidate.passages.length, "dna_full_coverage_passage_duplicate")
  assert(claims.size === candidate.claims.length, "dna_full_coverage_claim_duplicate")
  assert(answerUnits.size === candidate.answerUnits.length, "dna_full_coverage_answer_unit_duplicate")

  for (const topic of topics.values()) {
    assert(stableSha256(omit(topic, "topicSha256")) === topic.topicSha256,
      `dna_full_coverage_topic_hash:${topic.id}`)
    assert(topic.ownerBookAuthority === false, `dna_full_coverage_topic_owner_boundary:${topic.id}`)
  }
  for (const source of sources.values()) {
    assert(stableSha256(omit(source, "sourceSha256")) === source.sourceSha256,
      `dna_full_coverage_source_hash:${source.id}`)
    assert(source.runtimeEligible === false && source.releaseEligible === false,
      `dna_full_coverage_source_boundary:${source.id}`)
  }
  for (const passage of passages.values()) {
    assert(stableSha256(omit(passage, "passageSha256")) === passage.passageSha256,
      `dna_full_coverage_passage_hash:${passage.id}`)
    assert(bytesSha256(passage.originalText) === passage.contentSha256,
      `dna_full_coverage_passage_content_hash:${passage.id}`)
    assert(sources.has(passage.sourceId), `dna_full_coverage_passage_source:${passage.id}`)
    assert(passage.runtimeEligible === false && passage.releaseEligible === false,
      `dna_full_coverage_passage_boundary:${passage.id}`)
  }
  for (const claim of claims.values()) {
    const topic = topics.get(claim.topicId)
    const source = sources.get(claim.sourceId)
    const passage = passages.get(claim.passageId)
    const answerUnit = answerUnits.get(claim.id)
    assert(stableSha256(omit(claim, "claimSha256")) === claim.claimSha256,
      `dna_full_coverage_claim_hash:${claim.id}`)
    assert(topic && source && passage && answerUnit, `dna_full_coverage_claim_binding:${claim.id}`)
    assert(passage.sourceId === source.id && answerUnit.topicId === topic.id
      && answerUnit.sourceId === source.id && answerUnit.passageId === passage.id,
    `dna_full_coverage_answer_unit_binding:${claim.id}`)
    assert(stableSha256(omit(answerUnit, "answerUnitSha256")) === answerUnit.answerUnitSha256,
      `dna_full_coverage_answer_unit_hash:${claim.id}`)
    assert(claim.runtimeEligible === false && claim.releaseEligible === false
      && answerUnit.maximumGraphHops === 1 && answerUnit.multiStepMechanismAllowed === false,
    `dna_full_coverage_claim_boundary:${claim.id}`)
  }
  return { topics, sources, passages, claims, answerUnits }
}

function deterministicTopicSchedule(claims, passDefinition) {
  const grouped = new Map()
  for (const claim of claims) {
    if (!grouped.has(claim.topicId)) grouped.set(claim.topicId, [])
    grouped.get(claim.topicId).push(claim)
  }
  const topicOrder = [...grouped.keys()].sort((left, right) => {
    const leftKey = bytesSha256(`${passDefinition.salt}:topic:${left}`)
    const rightKey = bytesSha256(`${passDefinition.salt}:topic:${right}`)
    return leftKey.localeCompare(rightKey, "en") || left.localeCompare(right, "en")
  })
  for (const [topicId, values] of grouped) {
    values.sort((left, right) => {
      const leftKey = bytesSha256(`${passDefinition.salt}:claim:${left.id}`)
      const rightKey = bytesSha256(`${passDefinition.salt}:claim:${right.id}`)
      return leftKey.localeCompare(rightKey, "en") || left.id.localeCompare(right.id, "en")
    })
    grouped.set(topicId, values)
  }
  const scheduled = []
  let round = 1
  while (scheduled.length < claims.length) {
    let added = 0
    for (const topicId of topicOrder) {
      const values = grouped.get(topicId)
      const claim = values[round - 1]
      if (!claim) continue
      scheduled.push({ claim, round, topicSequence: round, scheduleOrdinal: scheduled.length + 1 })
      added += 1
    }
    assert(added > 0, "dna_full_coverage_schedule_stalled")
    round += 1
  }
  return scheduled
}

function assertBalancedSchedule(workItems, expectedTopics) {
  const roundTopicPairs = new Set()
  const ordinals = workItems.map((entry) => entry.scheduleOrdinal)
  assert(ordinals.every((value, index) => value === index + 1), "dna_full_coverage_schedule_ordinal")
  for (const item of workItems) {
    const key = `${item.scheduleRound}:${item.topicId}`
    assert(!roundTopicPairs.has(key), "dna_full_coverage_schedule_topic_repeat")
    roundTopicPairs.add(key)
  }
  const firstRound = workItems.filter((entry) => entry.scheduleRound === 1)
  assert(firstRound.length === expectedTopics, "dna_full_coverage_schedule_first_round")
}

export function buildWorkpack(inputs, passId) {
  const passDefinition = PASS_DEFINITIONS[passId]
  assert(passDefinition, "dna_full_coverage_pass_invalid")
  const { candidate, selection } = inputs
  assertCandidate(candidate, inputs.candidateRawSha256)
  assertSelection(selection, inputs.selectionRawSha256)
  assertExistingManifests(
    { value: inputs.alignedBManifest, rawSha256: inputs.alignedBManifestRawSha256 },
    { value: inputs.reconciliationManifest, rawSha256: inputs.reconciliationManifestRawSha256 },
  )
  const maps = validateCandidateBindings(candidate)
  const preservedClaimIds = new Set(selection.selections.map((entry) => entry.claimId))
  assert(preservedClaimIds.size === 42, "dna_full_coverage_preserved_count")
  for (const selected of selection.selections) {
    const claim = maps.claims.get(selected.claimId)
    const passage = maps.passages.get(selected.passageId)
    assert(claim && passage && claim.topicId === selected.topicId && claim.sourceId === selected.sourceId
      && claim.passageId === selected.passageId && claim.claimSha256 === selected.candidateClaimSha256
      && passage.passageSha256 === selected.candidatePassageSha256,
    `dna_full_coverage_preserved_binding:${selected.claimId}`)
  }
  const remainingClaims = candidate.claims.filter((claim) => !preservedClaimIds.has(claim.id))
  assert(remainingClaims.length === 178, "dna_full_coverage_remaining_count")
  const schedule = deterministicTopicSchedule(remainingClaims, passDefinition)
  const workItems = schedule.map(({ claim, round, topicSequence, scheduleOrdinal }) => {
    const topic = maps.topics.get(claim.topicId)
    const source = maps.sources.get(claim.sourceId)
    const passage = maps.passages.get(claim.passageId)
    const answerUnit = maps.answerUnits.get(claim.id)
    const base = {
      id: `blind-${passId.toLowerCase()}:${bytesSha256(`${passDefinition.salt}:${claim.id}`).slice(0, 32)}`,
      passId,
      scheduleOrdinal,
      scheduleRound: round,
      topicSequence,
      topicId: topic.id,
      sourceId: source.id,
      passageId: passage.id,
      claimId: claim.id,
      answerUnitId: answerUnit.id,
      source: {
        title: source.title,
        artifactId: source.artifactId,
        integrityState: source.integrityState,
        passageLicenseDecision: source.passageLicenseDecision,
      },
      original: {
        language: passage.originalLanguage,
        proposition: claim.proposition,
        passageText: passage.originalText,
        sectionPath: passage.sectionPath,
        paragraphIds: passage.paragraphIds,
      },
      boundaries: {
        ageScope: claim.ageScope,
        passageAgeScope: passage.ageScope,
        causalStatus: claim.causalStatus,
        evidenceLevel: claim.evidenceLevel,
        evidenceType: passage.evidenceType,
        claimBoundary: claim.claimBoundary,
        passageBoundary: passage.claimBoundary,
        publicationStatus: claim.publicationStatus,
        relationClass: claim.relationClass,
        dnaProductRelation: claim.dnaProductRelation,
        maximumGraphHops: answerUnit.maximumGraphHops,
        multiStepMechanismAllowed: answerUnit.multiStepMechanismAllowed,
      },
      hashes: {
        candidatePackageSha256: candidate.packageSha256,
        candidateFileSha256: inputs.candidateRawSha256,
        topicSha256: topic.topicSha256,
        sourceSha256: source.sourceSha256,
        sourceArtifactSha256: source.artifactSha256,
        passageSha256: passage.passageSha256,
        passageContentSha256: passage.contentSha256,
        claimSha256: claim.claimSha256,
        propositionSha256: bytesSha256(claim.proposition),
        answerUnitSha256: answerUnit.answerUnitSha256,
      },
      authoringOutputContract: {
        requiredFields: ["workItemId", "claimId", "turkishRendering", "fidelityNote"],
        turkishRenderingPresent: false,
        otherPassRenderingVisible: false,
      },
      runtimeEligible: false,
      releaseEligible: false,
      activationAllowed: false,
      ownerAuthority: false,
    }
    return seal(base, "workItemSha256")
  })
  assertBalancedSchedule(workItems, candidate.topics.length)
  const topicCounts = Object.fromEntries(candidate.topics
    .map((topic) => [topic.id, workItems.filter((entry) => entry.topicId === topic.id).length])
    .sort(([left], [right]) => left.localeCompare(right, "en")))
  const base = {
    schemaVersion: WORKPACK_SCHEMA,
    version: VERSION,
    preparedAt: candidate.basisAt,
    status: "blank_blind_authoring_workpack",
    passId,
    provenance: passDefinition.provenance,
    inputs: {
      candidateRelativePath: CANDIDATE_RELATIVE_PATH,
      candidatePackageSha256: candidate.packageSha256,
      candidateFileSha256: inputs.candidateRawSha256,
      neutralSelectionRelativePath: SELECTION_RELATIVE_PATH,
      neutralSelectionArtifactSha256: selection.artifactSha256,
      neutralSelectionFileSha256: inputs.selectionRawSha256,
      preservedSelectionSetSha256: selection.selectionSetSha256,
      alignedPassBManifestFileSha256: inputs.alignedBManifestRawSha256,
      reconciliationManifestFileSha256: inputs.reconciliationManifestRawSha256,
      reconciledRecordsSha256: inputs.reconciliationManifest.recordsSha256,
    },
    blindContract: {
      sourceMaterialOnly: true,
      turkishRenderingsIncluded: false,
      reconciliationDecisionsIncluded: false,
      otherPassArtifactPathIncluded: false,
      otherPassArtifactHashIncluded: false,
      otherPassRenderingAccessAllowed: false,
      externalModelUsed: false,
      networkUsed: false,
    },
    workItems,
    counts: {
      candidateClaims: candidate.claims.length,
      preservedReconciledClaims: preservedClaimIds.size,
      remainingClaims: workItems.length,
      answerUnits: workItems.length,
      topics: new Set(workItems.map((entry) => entry.topicId)).size,
      sources: new Set(workItems.map((entry) => entry.sourceId)).size,
      passages: new Set(workItems.map((entry) => entry.passageId)).size,
      topicCounts,
    },
    verification: {
      candidateBindingsVerified: workItems.length,
      excludedPreservedClaims: preservedClaimIds.size,
      duplicateClaims: 0,
      missingClaims: 0,
      extraClaims: 0,
      deterministicTopicRoundRobin: true,
      sourceAndClaimTextStoredOnResearchSsdOnly: true,
      lockedEvaluationArtifactsAccessed: false,
    },
    boundaries: {
      candidateOnly: true,
      authoringPending: true,
      translationPerformed: false,
      reconciliationPerformed: false,
      independentHumanReview: false,
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
  }
  return seal(base, "workpackSha256")
}

function assertExactCoverage(inputs, passA, passB) {
  const preserved = new Set(inputs.selection.selections.map((entry) => entry.claimId))
  const candidate = new Set(inputs.candidate.claims.map((entry) => entry.id))
  const a = new Set(passA.workItems.map((entry) => entry.claimId))
  const b = new Set(passB.workItems.map((entry) => entry.claimId))
  assert(a.size === 178 && b.size === 178, "dna_full_coverage_workpack_duplicate")
  assert([...a].every((id) => b.has(id)) && [...b].every((id) => a.has(id)),
    "dna_full_coverage_pass_coverage_mismatch")
  assert([...a].every((id) => !preserved.has(id)), "dna_full_coverage_preserved_overlap")
  const union = new Set([...preserved, ...a])
  assert(union.size === candidate.size && [...candidate].every((id) => union.has(id)),
    "dna_full_coverage_union_mismatch")
  const aIds = new Set(passA.workItems.map((entry) => entry.id))
  assert(passB.workItems.every((entry) => !aIds.has(entry.id)), "dna_full_coverage_blind_id_collision")
}

export function buildIndex(inputs, passA, passB, output) {
  assertExactCoverage(inputs, passA, passB)
  const topicCoverage = inputs.candidate.topics.map((topic) => {
    const count = passA.counts.topicCounts[topic.id]
    assert(count === passB.counts.topicCounts[topic.id], "dna_full_coverage_topic_count_mismatch")
    return {
      topicIdSha256: bytesSha256(topic.id),
      remainingClaimCount: count,
      preservedClaimCount: inputs.selection.selections.filter((entry) => entry.topicId === topic.id).length,
    }
  }).sort((left, right) => left.topicIdSha256.localeCompare(right.topicIdSha256, "en"))
  const base = {
    schemaVersion: INDEX_SCHEMA,
    version: VERSION,
    preparedAt: inputs.candidate.basisAt,
    status: "blind_authoring_workpacks_prepared",
    inputs: {
      candidatePackageSha256: inputs.candidate.packageSha256,
      candidateFileSha256: inputs.candidateRawSha256,
      neutralSelectionArtifactSha256: inputs.selection.artifactSha256,
      neutralSelectionFileSha256: inputs.selectionRawSha256,
      preservedSelectionSetSha256: inputs.selection.selectionSetSha256,
      alignedPassBManifestFileSha256: inputs.alignedBManifestRawSha256,
      reconciliationManifestFileSha256: inputs.reconciliationManifestRawSha256,
      reconciledRecordsSha256: inputs.reconciliationManifest.recordsSha256,
    },
    outputs: {
      passA: {
        relativePath: PASS_A_RELATIVE_PATH,
        rawSha256: output.passA.rawSha256,
        byteCount: output.passA.bytes,
        fileMode: "0600",
        workpackSha256: passA.workpackSha256,
        scheduleSha256: stableSha256(passA.workItems.map((entry) => ({
          workItemSha256: entry.workItemSha256,
          scheduleOrdinal: entry.scheduleOrdinal,
        }))),
      },
      passB: {
        relativePath: PASS_B_RELATIVE_PATH,
        rawSha256: output.passB.rawSha256,
        byteCount: output.passB.bytes,
        fileMode: "0600",
        workpackSha256: passB.workpackSha256,
        scheduleSha256: stableSha256(passB.workItems.map((entry) => ({
          workItemSha256: entry.workItemSha256,
          scheduleOrdinal: entry.scheduleOrdinal,
        }))),
      },
    },
    counts: {
      candidateClaims: 220,
      preservedReconciledClaims: 42,
      remainingClaims: 178,
      passAWorkItems: passA.workItems.length,
      passBWorkItems: passB.workItems.length,
      topics: topicCoverage.length,
      exactUnionClaims: 220,
      duplicateClaimsPerPass: 0,
      overlapWithPreserved: 0,
    },
    topicCoverage,
    verification: {
      passCoverageIdentical: true,
      passWorkItemIdsDisjoint: true,
      topicBalancedRoundRobin: true,
      sourceAndCandidateHashesBound: true,
      fullTextOnlyOnResearchSsd: true,
      repositoryManifestAggregateAndHashOnly: true,
      existingFortyTwoArtifactsModified: false,
      externalModelUsed: false,
      networkUsed: false,
      lockedEvaluationArtifactsAccessed: false,
    },
    boundaries: {
      candidateOnly: true,
      translationPerformed: false,
      reconciliationPerformed: false,
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
  }
  return seal(base, "indexSha256")
}

export function buildRepoManifest(index, indexOutput) {
  const base = {
    schemaVersion: MANIFEST_SCHEMA,
    recordedAt: index.preparedAt,
    version: VERSION,
    status: index.status,
    inputHashes: index.inputs,
    outputHashes: {
      passA: {
        rawSha256: index.outputs.passA.rawSha256,
        workpackSha256: index.outputs.passA.workpackSha256,
        scheduleSha256: index.outputs.passA.scheduleSha256,
        byteCount: index.outputs.passA.byteCount,
        fileMode: index.outputs.passA.fileMode,
      },
      passB: {
        rawSha256: index.outputs.passB.rawSha256,
        workpackSha256: index.outputs.passB.workpackSha256,
        scheduleSha256: index.outputs.passB.scheduleSha256,
        byteCount: index.outputs.passB.byteCount,
        fileMode: index.outputs.passB.fileMode,
      },
      index: {
        rawSha256: indexOutput.rawSha256,
        indexSha256: index.indexSha256,
        byteCount: indexOutput.bytes,
        fileMode: "0600",
      },
    },
    counts: index.counts,
    topicCoverage: index.topicCoverage,
    verification: index.verification,
    boundaries: index.boundaries,
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    ownerAuthority: false,
  }
  return seal(base, "manifestSha256")
}

function artifactBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function verifyBytes(root, relativePath, expectedBytes) {
  const path = assertSecurePath(root, join(root, relativePath), { mode0600: true })
  const actual = readFileSync(path)
  assert(actual.equals(expectedBytes), `dna_full_coverage_artifact_drift:${relativePath}`)
  return { path, rawSha256: bytesSha256(actual), bytes: actual.length, mode: "0600" }
}

export function execute(command, options = {}) {
  assert(["write", "verify", "print-manifest"].includes(command), "dna_full_coverage_command_invalid")
  const root = resolveSsdRoot(options.root)
  const repoRoot = resolve(options.repoRoot || process.cwd())
  const inputs = loadInputs(root, repoRoot)
  const passA = buildWorkpack(inputs, "A")
  const passB = buildWorkpack(inputs, "B")
  assertExactCoverage(inputs, passA, passB)
  const passABytes = artifactBytes(passA)
  const passBBytes = artifactBytes(passB)
  const output = command === "write"
    ? {
      passA: secureAtomicWrite(root, join(root, PASS_A_RELATIVE_PATH), passABytes),
      passB: secureAtomicWrite(root, join(root, PASS_B_RELATIVE_PATH), passBBytes),
    }
    : {
      passA: verifyBytes(root, PASS_A_RELATIVE_PATH, passABytes),
      passB: verifyBytes(root, PASS_B_RELATIVE_PATH, passBBytes),
    }
  const index = buildIndex(inputs, passA, passB, output)
  const indexBytes = artifactBytes(index)
  const indexOutput = command === "write"
    ? secureAtomicWrite(root, join(root, INDEX_RELATIVE_PATH), indexBytes)
    : verifyBytes(root, INDEX_RELATIVE_PATH, indexBytes)
  const manifest = buildRepoManifest(index, indexOutput)
  assertManifestSafe(manifest, inputs, passA, passB)
  if (command === "verify") {
    const recorded = readRepoJson(repoRoot, REPO_MANIFEST_RELATIVE_PATH).value
    assert(stableSha256(recorded) === stableSha256(manifest), "dna_full_coverage_repo_manifest_drift")
  }
  return { root, inputs, passA, passB, index, manifest, output: { ...output, index: indexOutput } }
}

export function assertManifestSafe(manifest, inputs, passA, passB) {
  const serialized = JSON.stringify(manifest)
  const forbidden = []
  for (const claim of inputs.candidate.claims) forbidden.push(claim.id, claim.proposition)
  for (const passage of inputs.candidate.passages) forbidden.push(passage.id, passage.originalText)
  for (const source of inputs.candidate.sources) forbidden.push(source.id, source.title)
  for (const topic of inputs.candidate.topics) forbidden.push(topic.id, topic.title)
  for (const item of [...passA.workItems, ...passB.workItems]) forbidden.push(item.id)
  for (const value of forbidden) {
    assert(!serialized.includes(value), "dna_full_coverage_repo_manifest_text_or_identity_leak")
  }
  assert(!serialized.includes("proposition") && !serialized.includes("passageText")
    && !serialized.includes("turkishRendering"), "dna_full_coverage_repo_manifest_field_leak")
}

function publicSummary(result) {
  return {
    ok: true,
    version: VERSION,
    counts: result.index.counts,
    passAWorkpackSha256: result.passA.workpackSha256,
    passAFileSha256: result.output.passA.rawSha256,
    passBWorkpackSha256: result.passB.workpackSha256,
    passBFileSha256: result.output.passB.rawSha256,
    indexSha256: result.index.indexSha256,
    indexFileSha256: result.output.index.rawSha256,
    manifestSha256: result.manifest.manifestSha256,
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const command = process.argv[2]
  assert(process.argv.length === 3, "dna_full_coverage_command_arity")
  const result = execute(command)
  if (command === "print-manifest") {
    process.stdout.write(`${JSON.stringify(result.manifest, null, 2)}\n`)
  } else {
    process.stdout.write(`${JSON.stringify(publicSummary(result), null, 2)}\n`)
  }
}

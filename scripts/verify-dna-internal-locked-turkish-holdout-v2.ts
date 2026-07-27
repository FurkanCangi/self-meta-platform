#!/usr/bin/env node

import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs"
import { join, relative, resolve, sep } from "node:path"

import {
  assertSecureParentChain,
  canonicalSha256,
  resolveSecureRoot,
  secureAtomicWriteFile,
  sha256Bytes,
  verifySecureFile,
} from "./dna-secure-artifact"

export const HOLDOUT_V2_SCHEMA = "dna-internal-locked-turkish-holdout@2"
export const HOLDOUT_V2_MANIFEST_SCHEMA =
  "dna-internal-locked-turkish-holdout-manifest@2"
export const HOLDOUT_V2_LABEL = "internal_validation_v2"
export const HOLDOUT_V2_ARTIFACT_LABEL =
  "internal_locked_holdout_not_independent_human_validation"

export const CANDIDATE_RELATIVE_PATH =
  "Datasets/DNA-Intelligence/work/v3/prebook-closure/v1/external-science-candidate-package.json"
export const HOLDOUT_V2_RELATIVE_PATH =
  "Datasets/DNA-Intelligence/evaluation/internal-locked-turkish-holdout/v2/questions-and-answers.json"
export const HOLDOUT_V2_MANIFEST_RELATIVE_PATH =
  "docs/dna-intelligence/program/evidence/internal-locked-turkish-holdout-v2-current.json"

const EXPECTED_TOPIC_COUNT = 14
const EXPECTED_TOTAL = 196
const EXPECTED_ANSWERABLE = 140
const EXPECTED_CLARIFICATION = 28
const EXPECTED_UNSUPPORTED = 28
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const SPLITS = [
  "natural_supported",
  "hard_neighbor",
  "ambiguous",
  "unsupported",
  "safe_theory_control",
] as const
const VARIANTS = [
  "minor_typo",
  "ascii_loss",
  "inflection",
  "synonym",
  "mixed_tr_en",
  "negation",
  "natural_conversation",
] as const

type Split = (typeof SPLITS)[number]
type Variant = (typeof VARIANTS)[number]
type Answerability = "answerable" | "clarification" | "unsupported"
type JsonRecord = Record<string, unknown>

type CandidateTopic = {
  id: string
  topicSha256: string
}

type CandidateSource = {
  id: string
  sourceSha256: string
  runtimeEligible: boolean
  releaseEligible: boolean
}

type CandidatePassage = {
  id: string
  sourceId: string
  passageSha256: string
  runtimeEligible: boolean
  releaseEligible: boolean
}

type CandidateClaim = {
  id: string
  topicId: string
  sourceId: string
  passageId: string
  claimSha256: string
  runtimeEligible: boolean
  releaseEligible: boolean
}

type CandidatePackage = {
  authorityClass: string
  activeRuntimeGeneration: string
  runtimeEligible: boolean
  releaseEligible: boolean
  activationAllowed: boolean
  topics: CandidateTopic[]
  sources: CandidateSource[]
  passages: CandidatePassage[]
  claims: CandidateClaim[]
  packageSha256: string
}

export type HoldoutV2Item = {
  id: string
  question: string
  split: Split
  answerability: Answerability
  expectedTopic: string | null
}

type HoldoutV2Binding = {
  itemId: string
  topicId: string
  topicSha256: string
  claimId: string | null
  sourceId: string | null
  passageId: string | null
  claimSha256: string | null
  sourceSha256: string | null
  passageSha256: string | null
  bindingSha256: string
}

type HoldoutV2VariantAssignment = {
  itemId: string
  variant: Variant
  assignmentSha256: string
}

type HoldoutCounts = {
  total: 196
  topics: 14
  answerable: 140
  clarification: 28
  unsupported: 28
}

type HoldoutSplits = {
  natural_supported: 98
  hard_neighbor: 28
  ambiguous: 28
  unsupported: 28
  safe_theory_control: 14
}

export type HoldoutV2Artifact = {
  schemaVersion: string
  label: string
  status: "sealed"
  sealedAt: string
  candidatePackageSha256: string
  candidateFileSha256: string
  authoringProcessSha256: string
  contractSealProcessSha256: string
  counts: HoldoutCounts
  splits: HoldoutSplits
  items: HoldoutV2Item[]
  bindings: HoldoutV2Binding[]
  variantAssignments: HoldoutV2VariantAssignment[]
  visibleToAdapterTuning: false
  runtimeEligible: false
  releaseEligible: false
  independentHumanValidation: false
  limitations: string[]
  artifactSha256: string
}

export type HoldoutV2Manifest = {
  schemaVersion: string
  label: string
  artifact: {
    researchSsdRelativePath: string
    sha256: string
    byteCount: number
  }
  counts: HoldoutCounts
  splits: HoldoutSplits
  authorities: {
    candidatePackageResearchSsdRelativePath: string
    candidatePackageSha256: string
    developmentLedgerResearchSsdRelativePath: null
    developmentLedgerSha256: null
    prebookDraftResearchSsdRelativePath: null
    prebookDraftSha256: null
  }
  validation: {
    artifactMode: "0600"
    atomicWriteFsyncRenameReadback: true
    deterministicRepeats: 20
    uniqueGenerationHashes: 196
    exactOverlap: null
    normalizedOverlap: null
    nearDuplicateOverlap: null
    semanticFamilyOverlap: null
    tamperFailClosed: true
    hashTamperFailClosed: true
    byteTamperFailClosed: true
    modeTamperFailClosed: true
    leafSymlinkFailClosed: true
    parentSymlinkEscapeFailClosed: true
    manifestDriftFailClosed: true
    ssdFallbackAllowed: false
  }
  privacyBoundary: {
    visibleToAdapterTuning: false
    fullPayloadStoredOnlyOnResearchSsd: true
    fullQuestionAnswerPayloadInRepository: false
    runtimeEligible: false
    releaseEligible: false
    independentHumanValidation: false
  }
}

export type LoadedHoldoutV2 = {
  researchRoot: string
  candidate: CandidatePackage
  candidateFileSha256: string
  artifact: HoldoutV2Artifact
  artifactFileSha256: string
  artifactByteCount: number
  artifactMode: number
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertRecord(value: unknown, message: string): asserts value is JsonRecord {
  assert(Boolean(value) && typeof value === "object" && !Array.isArray(value), message)
}

function assertExactKeys(value: JsonRecord, keys: string[], message: string): void {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  assert(JSON.stringify(actual) === JSON.stringify(expected), message)
}

function withoutKey(value: JsonRecord, key: string): JsonRecord {
  return Object.fromEntries(Object.entries(value).filter(([candidate]) => candidate !== key))
}

function assertSha(value: unknown, message: string): asserts value is string {
  assert(typeof value === "string" && SHA256_PATTERN.test(value), message)
}

function normalizeQuestion(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("tr-TR")
    .replace(/[?!.,;:()\[\]{}'"“”‘’`´]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function readSecureJsonFile(
  rootInput: string,
  requested: string,
  requireMode0600: boolean,
): { value: unknown; bytes: Buffer; sha256: string; mode: number } {
  const root = resolveSecureRoot(rootInput, true)
  const path = assertSecureParentChain(root, requested, false)
  assert(existsSync(path), "holdout_v2_file_missing")
  const metadata = lstatSync(path)
  assert(!metadata.isSymbolicLink(), "holdout_v2_leaf_symlink_rejected")
  assert(metadata.isFile(), "holdout_v2_not_regular_file")
  const real = realpathSync(path)
  const delta = relative(root, real)
  assert(delta !== ".." && !delta.startsWith(`..${sep}`), "holdout_v2_realpath_escape")
  const mode = statSync(path).mode & 0o777
  if (requireMode0600) assert(mode === 0o600, "holdout_v2_mode_invalid")
  const bytes = readFileSync(path)
  let value: unknown
  try {
    value = JSON.parse(bytes.toString("utf8")) as unknown
  } catch {
    throw new Error("holdout_v2_json_invalid")
  }
  return { value, bytes, sha256: sha256Bytes(bytes), mode }
}

export function validateCandidatePackage(candidate: CandidatePackage): void {
  assertRecord(candidate, "holdout_v2_candidate_invalid")
  assert(candidate.authorityClass === "external_science_candidate", "holdout_v2_candidate_authority")
  assert(candidate.activeRuntimeGeneration === "v2_legacy", "holdout_v2_candidate_runtime_generation")
  assert(candidate.runtimeEligible === false && candidate.releaseEligible === false, "holdout_v2_candidate_boundary")
  assert(candidate.activationAllowed === false, "holdout_v2_candidate_activation")
  assert(candidate.topics.length === EXPECTED_TOPIC_COUNT, "holdout_v2_candidate_topic_count")
  assertSha(candidate.packageSha256, "holdout_v2_candidate_hash_invalid")
  assert(canonicalSha256(withoutKey(candidate as unknown as JsonRecord, "packageSha256")) === candidate.packageSha256, "holdout_v2_candidate_hash_mismatch")

  for (const [rows, hashKey, boundary] of [
    [candidate.topics, "topicSha256", false],
    [candidate.sources, "sourceSha256", true],
    [candidate.passages, "passageSha256", true],
    [candidate.claims, "claimSha256", true],
  ] as Array<[Array<JsonRecord>, string, boolean]>) {
    const ids = new Set<string>()
    for (const row of rows) {
      assert(typeof row.id === "string" && !ids.has(row.id), "holdout_v2_candidate_id_invalid")
      ids.add(row.id)
      assertSha(row[hashKey], "holdout_v2_candidate_record_hash_invalid")
      assert(canonicalSha256(withoutKey(row, hashKey)) === row[hashKey], "holdout_v2_candidate_record_hash_mismatch")
      if (boundary) {
        assert(row.runtimeEligible === false && row.releaseEligible === false, "holdout_v2_candidate_record_boundary")
      }
    }
  }
}

const ARTIFACT_KEYS = [
  "schemaVersion",
  "label",
  "status",
  "sealedAt",
  "candidatePackageSha256",
  "candidateFileSha256",
  "authoringProcessSha256",
  "contractSealProcessSha256",
  "counts",
  "splits",
  "items",
  "bindings",
  "variantAssignments",
  "visibleToAdapterTuning",
  "runtimeEligible",
  "releaseEligible",
  "independentHumanValidation",
  "limitations",
  "artifactSha256",
]

export function validateHoldoutV2Artifact(
  artifact: HoldoutV2Artifact,
  candidate: CandidatePackage,
  candidateFileSha256: string,
): void {
  assertRecord(artifact, "holdout_v2_artifact_invalid")
  assertExactKeys(artifact as unknown as JsonRecord, ARTIFACT_KEYS, "holdout_v2_artifact_keys_invalid")
  assert(artifact.schemaVersion === HOLDOUT_V2_SCHEMA, "holdout_v2_schema_invalid")
  assert(artifact.label === HOLDOUT_V2_ARTIFACT_LABEL, "holdout_v2_label_invalid")
  assert(artifact.status === "sealed", "holdout_v2_not_sealed")
  assert(!Number.isNaN(Date.parse(artifact.sealedAt)), "holdout_v2_sealed_at_invalid")
  assert(artifact.candidatePackageSha256 === candidate.packageSha256, "holdout_v2_candidate_binding")
  assert(artifact.candidateFileSha256 === candidateFileSha256, "holdout_v2_candidate_file_binding")
  assertSha(artifact.authoringProcessSha256, "holdout_v2_authoring_hash_invalid")
  assertSha(artifact.contractSealProcessSha256, "holdout_v2_contract_hash_invalid")
  assert(artifact.visibleToAdapterTuning === false, "holdout_v2_visibility_boundary")
  assert(artifact.runtimeEligible === false && artifact.releaseEligible === false, "holdout_v2_release_boundary")
  assert(artifact.independentHumanValidation === false, "holdout_v2_validation_boundary")
  assert(Array.isArray(artifact.limitations) && artifact.limitations.length >= 2, "holdout_v2_limitations_missing")
  assert(JSON.stringify(artifact.counts) === JSON.stringify({
    total: 196,
    topics: 14,
    answerable: 140,
    clarification: 28,
    unsupported: 28,
  }), "holdout_v2_counts_invalid")
  assert(JSON.stringify(artifact.splits) === JSON.stringify({
    natural_supported: 98,
    hard_neighbor: 28,
    ambiguous: 28,
    unsupported: 28,
    safe_theory_control: 14,
  }), "holdout_v2_splits_invalid")
  assert(Array.isArray(artifact.items) && artifact.items.length === EXPECTED_TOTAL, "holdout_v2_item_count")

  const topics = new Map(candidate.topics.map((topic) => [topic.id, topic]))
  const sources = new Map(candidate.sources.map((source) => [source.id, source]))
  const passages = new Map(candidate.passages.map((passage) => [passage.id, passage]))
  const claims = new Map(candidate.claims.map((claim) => [claim.id, claim]))
  const ids = new Set<string>()
  const normalizedQuestions = new Set<string>()

  for (const item of artifact.items) {
    assertRecord(item, "holdout_v2_item_invalid")
    assertExactKeys(item as unknown as JsonRecord, ["id", "question", "split", "answerability", "expectedTopic"], "holdout_v2_item_keys_invalid")
    assert(typeof item.id === "string" && /^holdout\.v2\.q:[a-f0-9]{24}$/.test(item.id) && !ids.has(item.id), "holdout_v2_item_id_invalid")
    ids.add(item.id)
    assert(typeof item.question === "string" && item.question.trim().length >= 12 && item.question.length <= 320 && !item.question.includes("\n"), "holdout_v2_question_invalid")
    const normalized = normalizeQuestion(item.question)
    assert(!normalizedQuestions.has(normalized), "holdout_v2_normalized_duplicate")
    normalizedQuestions.add(normalized)
    assert(SPLITS.includes(item.split), "holdout_v2_split_invalid")
    if (["natural_supported", "hard_neighbor", "safe_theory_control"].includes(item.split)) {
      assert(item.answerability === "answerable", "holdout_v2_answerability_mismatch")
      assert(typeof item.expectedTopic === "string" && topics.has(item.expectedTopic), "holdout_v2_expected_topic_invalid")
    } else if (item.split === "ambiguous") {
      assert(item.answerability === "clarification" && item.expectedTopic === null, "holdout_v2_clarification_mismatch")
    } else {
      assert(item.answerability === "unsupported" && item.expectedTopic === null, "holdout_v2_unsupported_mismatch")
    }
  }

  assert(Array.isArray(artifact.bindings) && artifact.bindings.length === EXPECTED_TOTAL, "holdout_v2_binding_count")
  const bindingIds = new Set<string>()
  for (const binding of artifact.bindings) {
    assertRecord(binding, "holdout_v2_binding_invalid")
    assertExactKeys(binding as unknown as JsonRecord, [
      "itemId", "topicId", "topicSha256", "claimId", "sourceId", "passageId",
      "claimSha256", "sourceSha256", "passageSha256", "bindingSha256",
    ], "holdout_v2_binding_keys_invalid")
    assert(ids.has(binding.itemId) && !bindingIds.has(binding.itemId), "holdout_v2_binding_item_invalid")
    bindingIds.add(binding.itemId)
    const item = artifact.items.find((candidateItem) => candidateItem.id === binding.itemId)
    const topic = topics.get(binding.topicId)
    assert(item && topic && binding.topicSha256 === topic.topicSha256, "holdout_v2_topic_binding_invalid")
    if (item.answerability === "answerable") {
      const claim = binding.claimId ? claims.get(binding.claimId) : undefined
      const source = binding.sourceId ? sources.get(binding.sourceId) : undefined
      const passage = binding.passageId ? passages.get(binding.passageId) : undefined
      assert(claim && source && passage, "holdout_v2_source_binding_missing")
      assert(claim.topicId === binding.topicId && item.expectedTopic === binding.topicId, "holdout_v2_claim_topic_mismatch")
      assert(claim.sourceId === source.id && claim.passageId === passage.id && passage.sourceId === source.id, "holdout_v2_claim_source_mismatch")
      assert(binding.claimSha256 === claim.claimSha256, "holdout_v2_claim_hash_binding")
      assert(binding.sourceSha256 === source.sourceSha256, "holdout_v2_source_hash_binding")
      assert(binding.passageSha256 === passage.passageSha256, "holdout_v2_passage_hash_binding")
    } else {
      assert([
        binding.claimId,
        binding.sourceId,
        binding.passageId,
        binding.claimSha256,
        binding.sourceSha256,
        binding.passageSha256,
      ].every((value) => value === null), "holdout_v2_unanswerable_binding_leak")
    }
    assertSha(binding.bindingSha256, "holdout_v2_binding_hash_invalid")
    assert(canonicalSha256(withoutKey(binding as unknown as JsonRecord, "bindingSha256")) === binding.bindingSha256, "holdout_v2_binding_hash_mismatch")
  }

  assert(Array.isArray(artifact.variantAssignments) && artifact.variantAssignments.length === EXPECTED_TOTAL, "holdout_v2_variant_count")
  const variantItemIds = new Set<string>()
  const variantCounts = new Map<Variant, number>(VARIANTS.map((variant) => [variant, 0]))
  for (const assignment of artifact.variantAssignments) {
    assertRecord(assignment, "holdout_v2_variant_invalid")
    assertExactKeys(assignment as unknown as JsonRecord, ["itemId", "variant", "assignmentSha256"], "holdout_v2_variant_keys_invalid")
    assert(ids.has(assignment.itemId) && !variantItemIds.has(assignment.itemId), "holdout_v2_variant_item_invalid")
    variantItemIds.add(assignment.itemId)
    assert(VARIANTS.includes(assignment.variant), "holdout_v2_variant_value_invalid")
    variantCounts.set(assignment.variant, (variantCounts.get(assignment.variant) ?? 0) + 1)
    const item = artifact.items.find((candidateItem) => candidateItem.id === assignment.itemId)
    assert(item, "holdout_v2_variant_question_missing")
    if (assignment.variant === "ascii_loss") {
      assert(!/[çğıöşüÇĞİÖŞÜ]/.test(item.question), "holdout_v2_ascii_variant_invalid")
    }
    if (assignment.variant === "negation") {
      assert(/(?:değil|yok|olmaz|mı|mi|mu|mü|madan|meden|ma|me)/iu.test(item.question), "holdout_v2_negation_variant_invalid")
    }
    assertSha(assignment.assignmentSha256, "holdout_v2_variant_hash_invalid")
    assert(canonicalSha256(withoutKey(assignment as unknown as JsonRecord, "assignmentSha256")) === assignment.assignmentSha256, "holdout_v2_variant_hash_mismatch")
  }
  for (const count of variantCounts.values()) assert(count === 28, "holdout_v2_variant_balance_invalid")

  for (const topic of candidate.topics) {
    const topicBindings = artifact.bindings.filter((binding) => binding.topicId === topic.id)
    assert(topicBindings.length === 14, "holdout_v2_topic_total_invalid")
    const topicItems = topicBindings.map((binding) => artifact.items.find((item) => item.id === binding.itemId)!)
    assert(topicItems.filter((item) => item.split === "natural_supported").length === 7, "holdout_v2_topic_natural_invalid")
    assert(topicItems.filter((item) => item.split === "hard_neighbor").length === 2, "holdout_v2_topic_neighbor_invalid")
    assert(topicItems.filter((item) => item.split === "safe_theory_control").length === 1, "holdout_v2_topic_control_invalid")
    assert(topicItems.filter((item) => item.split === "ambiguous").length === 2, "holdout_v2_topic_ambiguous_invalid")
    assert(topicItems.filter((item) => item.split === "unsupported").length === 2, "holdout_v2_topic_unsupported_invalid")
  }

  assertSha(artifact.artifactSha256, "holdout_v2_artifact_hash_invalid")
  assert(canonicalSha256(withoutKey(artifact as unknown as JsonRecord, "artifactSha256")) === artifact.artifactSha256, "holdout_v2_artifact_hash_mismatch")
}

export function loadHoldoutV2(researchRootInput: string): LoadedHoldoutV2 {
  const researchRoot = resolveSecureRoot(researchRootInput, true)
  const candidateFile = readSecureJsonFile(
    researchRoot,
    join(researchRoot, CANDIDATE_RELATIVE_PATH),
    false,
  )
  const candidate = candidateFile.value as CandidatePackage
  validateCandidatePackage(candidate)
  const artifactFile = readSecureJsonFile(
    researchRoot,
    join(researchRoot, HOLDOUT_V2_RELATIVE_PATH),
    true,
  )
  const artifact = artifactFile.value as HoldoutV2Artifact
  validateHoldoutV2Artifact(artifact, candidate, candidateFile.sha256)
  return {
    researchRoot,
    candidate,
    candidateFileSha256: candidateFile.sha256,
    artifact,
    artifactFileSha256: artifactFile.sha256,
    artifactByteCount: artifactFile.bytes.length,
    artifactMode: artifactFile.mode,
  }
}

export function buildHoldoutV2Manifest(loaded: LoadedHoldoutV2): HoldoutV2Manifest {
  return {
    schemaVersion: HOLDOUT_V2_MANIFEST_SCHEMA,
    label: HOLDOUT_V2_LABEL,
    artifact: {
      researchSsdRelativePath: HOLDOUT_V2_RELATIVE_PATH,
      sha256: loaded.artifactFileSha256,
      byteCount: loaded.artifactByteCount,
    },
    counts: loaded.artifact.counts,
    splits: loaded.artifact.splits,
    authorities: {
      candidatePackageResearchSsdRelativePath: CANDIDATE_RELATIVE_PATH,
      candidatePackageSha256: loaded.candidate.packageSha256,
      developmentLedgerResearchSsdRelativePath: null,
      developmentLedgerSha256: null,
      prebookDraftResearchSsdRelativePath: null,
      prebookDraftSha256: null,
    },
    validation: {
      artifactMode: "0600",
      atomicWriteFsyncRenameReadback: true,
      deterministicRepeats: 20,
      uniqueGenerationHashes: 196,
      exactOverlap: null,
      normalizedOverlap: null,
      nearDuplicateOverlap: null,
      semanticFamilyOverlap: null,
      tamperFailClosed: true,
      hashTamperFailClosed: true,
      byteTamperFailClosed: true,
      modeTamperFailClosed: true,
      leafSymlinkFailClosed: true,
      parentSymlinkEscapeFailClosed: true,
      manifestDriftFailClosed: true,
      ssdFallbackAllowed: false,
    },
    privacyBoundary: {
      visibleToAdapterTuning: false,
      fullPayloadStoredOnlyOnResearchSsd: true,
      fullQuestionAnswerPayloadInRepository: false,
      runtimeEligible: false,
      releaseEligible: false,
      independentHumanValidation: false,
    },
  }
}

export function assertManifestMatches(actual: unknown, expected: HoldoutV2Manifest): void {
  assertRecord(actual, "holdout_v2_manifest_invalid")
  assertExactKeys(actual, [
    "schemaVersion", "label", "artifact", "counts", "splits", "authorities", "validation", "privacyBoundary",
  ], "holdout_v2_manifest_keys_invalid")
  assert(JSON.stringify(actual) === JSON.stringify(expected), "holdout_v2_manifest_drift")
}

export function verifyHoldoutV2(options: { researchRoot: string; writeManifest: boolean }): {
  loaded: LoadedHoldoutV2
  manifest: HoldoutV2Manifest
} {
  const loaded = loadHoldoutV2(options.researchRoot)
  for (let index = 0; index < 20; index += 1) {
    validateHoldoutV2Artifact(loaded.artifact, loaded.candidate, loaded.candidateFileSha256)
    assert(canonicalSha256(withoutKey(loaded.artifact as unknown as JsonRecord, "artifactSha256")) === loaded.artifact.artifactSha256, "holdout_v2_determinism_mismatch")
  }
  verifySecureFile(
    loaded.researchRoot,
    join(loaded.researchRoot, HOLDOUT_V2_RELATIVE_PATH),
    readFileSync(join(loaded.researchRoot, HOLDOUT_V2_RELATIVE_PATH)),
  )
  const manifest = buildHoldoutV2Manifest(loaded)
  if (options.writeManifest) {
    const repoRoot = resolveSecureRoot(process.cwd())
    secureAtomicWriteFile(
      repoRoot,
      join(repoRoot, HOLDOUT_V2_MANIFEST_RELATIVE_PATH),
      `${JSON.stringify(manifest, null, 2)}\n`,
    )
  } else {
    const path = resolve(HOLDOUT_V2_MANIFEST_RELATIVE_PATH)
    assert(existsSync(path), "holdout_v2_manifest_missing")
    assertManifestMatches(JSON.parse(readFileSync(path, "utf8")) as unknown, manifest)
  }
  return { loaded, manifest }
}

function main(): void {
  const argumentsSet = new Set(process.argv.slice(2))
  for (const argument of argumentsSet) {
    assert(argument === "--write-manifest", "holdout_v2_unknown_argument")
  }
  const result = verifyHoldoutV2({
    researchRoot: process.env.RESEARCH_SSD_ROOT ?? "/Volumes/ResearchSSD",
    writeManifest: argumentsSet.has("--write-manifest"),
  })
  process.stdout.write(`${JSON.stringify({
    ok: true,
    label: result.loaded.artifact.label,
    path: HOLDOUT_V2_RELATIVE_PATH,
    artifactSha256: result.loaded.artifact.artifactSha256,
    fileSha256: result.loaded.artifactFileSha256,
    counts: result.loaded.artifact.counts,
    splits: result.loaded.artifact.splits,
    validation: {
      deterministicRepeats: 20,
      mode0600: true,
      candidateBinding: true,
      questionTextInRepository: false,
    },
    privacyBoundary: result.manifest.privacyBoundary,
  })}\n`)
}

if (require.main === module) main()

#!/usr/bin/env node

import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs"
import { join, relative, resolve, sep } from "node:path"

import {
  assertContained,
  canonicalSha256,
  resolveSecureRoot,
  secureAtomicWriteFile,
  sha256Bytes,
  verifySecureFile,
} from "./dna-secure-artifact"

export const PASS_B_VERSION = "dna-external-science-turkish-rendering-pass-b@1"
const AUTHORING_SCHEMA = "dna-external-science-turkish-rendering-pass-b-authoring@1"
const MANIFEST_SCHEMA = "dna-external-science-turkish-rendering-pass-b-manifest@1"
const PROVENANCE = "codex_translation_pass_b_not_independent_human_review"
const CANDIDATE_RELATIVE_PATH =
  "Datasets/DNA-Intelligence/work/v3/prebook-closure/v1/external-science-candidate-package.json"
const OUTPUT_RELATIVE_ROOT =
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-pass-b/feasibility-v1"
const AUTHORING_RELATIVE_PATH = `${OUTPUT_RELATIVE_ROOT}/authored-renderings.json`
const ARTIFACT_RELATIVE_PATH = `${OUTPUT_RELATIVE_ROOT}/rendering-artifact.json`
const REPO_MANIFEST_RELATIVE_PATH =
  "docs/dna-intelligence/program/evidence/external-science-turkish-rendering-pass-b-current.json"
const EXPECTED_TOPIC_COUNT = 14
const EXPECTED_RENDERING_COUNT = 42

type CandidateTopic = {
  id: string
  title: string
  sourceId: string
  ownerBookAuthority: boolean
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
  ageScope: string
  claimBoundary: string
  runtimeEligible: boolean
  releaseEligible: boolean
  passageSha256: string
}

type CandidateClaim = {
  id: string
  sourceId: string
  topicId: string
  passageId: string
  proposition: string
  ageScope: string
  causalStatus: string
  evidenceLevel: string
  claimBoundary: string
  publicationStatus: string
  relationClass: string
  dnaProductRelation: string
  runtimeEligible: boolean
  releaseEligible: boolean
  claimSha256: string
}

type CandidatePackage = {
  schemaVersion: string
  basisAt: string
  authorityClass: string
  runtimeEligible: boolean
  releaseEligible: boolean
  activationAllowed: boolean
  activeRuntimeGeneration: string
  topics: CandidateTopic[]
  sources: CandidateSource[]
  passages: CandidatePassage[]
  claims: CandidateClaim[]
  counts: Record<string, number>
  packageSha256: string
}

type AuthoredRendering = {
  claimId: string
  turkishRendering: string
  decision: string
}

type AuthoringLedger = {
  schemaVersion: string
  provenance: string
  renderings: AuthoredRendering[]
  authoringSha256: string
}

export type RenderingRecord = {
  id: string
  topicId: string
  sourceId: string
  claimId: string
  passageId: string
  selection: "first" | "middle" | "last"
  passageIndex: number
  topicPassageCount: number
  candidateHashes: {
    topicSha256: string
    sourceSha256: string
    claimSha256: string
    passageSha256: string
  }
  originalProposition: string
  originalPropositionSha256: string
  turkishRendering: string
  turkishRenderingSha256: string
  decision: string
  bindings: {
    ageScope: string
    passageAgeScope: string
    evidenceLevel: string
    causalStatus: string
    claimBoundarySha256: string
    passageBoundarySha256: string
    publicationStatus: string
    relationClass: string
    dnaProductRelation: string
    bindingSha256: string
  }
  fidelity: {
    numberSequencePreserved: true
    negationPreserved: true
    hedgePreserved: true
    causalStrengthPreserved: true
    noAddedClinicalAction: true
    noAddedMechanism: true
  }
  provenance: string
  runtimeEligible: false
  releaseEligible: false
  activationAllowed: false
  renderingRecordSha256: string
}

export type RenderingArtifact = {
  schemaVersion: string
  basisAt: string
  authorityClass: string
  provenance: string
  input: {
    candidateRelativePath: string
    candidateFileSha256: string
    candidatePackageSha256: string
    authoringRelativePath: string
    authoringFileSha256: string
    authoringSha256: string
  }
  selectionContract: {
    perTopic: number
    passageOrder: string
    representativeClaimRule: string
    positions: string[]
  }
  renderings: RenderingRecord[]
  counts: Record<string, number>
  distributions: Record<string, Record<string, number>>
  verification: Record<string, number | boolean>
  boundaries: Record<string, string | boolean>
  runtimeEligible: false
  releaseEligible: false
  activationAllowed: false
  adapterAuthority: false
  ownerBookAuthority: false
  artifactSha256: string
}

export type PassBInputs = {
  researchRoot: string
  candidate: CandidatePackage
  candidateFileSha256: string
  authoring: AuthoringLedger
  authoringFileSha256: string
}

type PassBManifest = {
  schemaVersion: string
  recordedAt: string
  version: string
  provenance: string
  inputHashes: Record<string, string>
  output: Record<string, string>
  counts: Record<string, number>
  distributions: Record<string, Record<string, number>>
  acceptance: Record<string, string | boolean>
  boundaries: Record<string, string | boolean>
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function omitKey(value: Record<string, unknown>, key: string): Record<string, unknown> {
  const copy = { ...value }
  delete copy[key]
  return copy
}

function seal<T extends Record<string, unknown>, K extends string>(
  value: T,
  hashKey: K,
): T & Record<K, string> {
  return { ...value, [hashKey]: canonicalSha256(value) } as T & Record<K, string>
}

function assertReadableFile(root: string, requested: string, require0600 = false): string {
  const secureRoot = resolveSecureRoot(root)
  const path = assertContained(secureRoot, requested)
  const delta = relative(secureRoot, path)
  let current = secureRoot
  for (const segment of delta.split(sep).filter(Boolean)) {
    current = join(current, segment)
    assert(existsSync(current), `turkish_rendering_pass_b_input_missing:${current}`)
    const metadata = lstatSync(current)
    assert(!metadata.isSymbolicLink(), `turkish_rendering_pass_b_input_symlink:${current}`)
    if (current === path) {
      assert(metadata.isFile(), `turkish_rendering_pass_b_input_not_file:${current}`)
      if (require0600) {
        assert((metadata.mode & 0o777) === 0o600,
          `turkish_rendering_pass_b_input_mode:${current}`)
      }
    } else {
      assert(metadata.isDirectory(), `turkish_rendering_pass_b_input_parent:${current}`)
    }
  }
  const real = realpathSync(path)
  const realDelta = relative(secureRoot, real)
  assert(realDelta !== ".." && !realDelta.startsWith(`..${sep}`) && !realDelta.startsWith(sep),
    `turkish_rendering_pass_b_input_escape:${path}`)
  return path
}

function readJson<T>(root: string, path: string, require0600 = false): { value: T; sha256: string } {
  const safePath = assertReadableFile(root, path, require0600)
  const bytes = readFileSync(safePath)
  return { value: JSON.parse(bytes.toString("utf8")) as T, sha256: sha256Bytes(bytes) }
}

function distribution(values: readonly string[]): Record<string, number> {
  return Object.fromEntries([...new Set(values)].sort().map((value) => [
    value,
    values.filter((candidate) => candidate === value).length,
  ]))
}

function numericSequence(value: string): string[] {
  const normalized = value
    .replace(/−/g, "-")
    .replace(/²/g, "2")
    .replace(/\btwelve\b/gi, "12")
    .replace(/\bone\s+or\s+two\b/gi, "1 or 2")
    .replace(/(\d)\s*[-–]\s*(?=\d)/g, "$1 to ")
  return (normalized.match(/-?\d+(?:[.,]\d+)?/g) ?? [])
    .map((token) => token.replace(",", "."))
}

function normalizedTurkish(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ç/g, "c").replace(/ö/g, "o").replace(/ü/g, "u")
}

function sourceHasNegation(value: string): boolean {
  return /\b(?:not|no|without|neither|nor)\b|does not|did not|was not|were not|free from|do not/i.test(value)
}

function renderingHasNegation(value: string): boolean {
  const normalized = normalizedTurkish(value)
  return /degil|bulunmam|olmad|olmayabilir|dislamaz|taramadik|kullanmayan|anlasilmamistir|olusturulmamistir/.test(normalized)
}

function hedgeRequirement(value: string): RegExp | null {
  if (/tentatively/i.test(value)) return /gecici/
  if (/\bassociated\b|association/i.test(value)) return /iliski/
  if (/\bsuggested\b/i.test(value)) return /dusundur/
  if (/\boften\b/i.test(value)) return /cogu zaman/
  if (/\b(?:could|may|can)\b/i.test(value)) return /abilir|ebilir|olmayabilir/
  if (/\bshould\b/i.test(value)) return /malidir|melidir/
  if (/approximation/i.test(value)) return /yaklasik/
  if (/poorly understood/i.test(value)) return /yeterince anlasilmamistir/
  if (/more analysis is required/i.test(value)) return /gerekmektedir/
  return null
}

function assertFidelity(claim: CandidateClaim, rendering: string): RenderingRecord["fidelity"] {
  assert(rendering.trim() === rendering && rendering.length >= 12,
    `turkish_rendering_pass_b_rendering_invalid:${claim.id}`)
  assert(JSON.stringify(numericSequence(claim.proposition))
    === JSON.stringify(numericSequence(rendering)),
  `turkish_rendering_pass_b_numbers_changed:${claim.id}`)
  if (sourceHasNegation(claim.proposition)) {
    assert(renderingHasNegation(rendering),
      `turkish_rendering_pass_b_negation_lost:${claim.id}`)
  }
  const hedge = hedgeRequirement(claim.proposition)
  if (hedge) {
    assert(hedge.test(normalizedTurkish(rendering)),
      `turkish_rendering_pass_b_hedge_lost:${claim.id}`)
  }
  const normalized = normalizedTurkish(rendering)
  const forbiddenCausal = /neden olur|yol acar|dogrudan etkiler|kesin olarak kanitlar/
  assert(!forbiddenCausal.test(normalized),
    `turkish_rendering_pass_b_causal_upgrade:${claim.id}`)
  if (claim.causalStatus === "associational") {
    assert(/iliski|ardindan|izleyen|eslik|birlikte|baglant/.test(normalized),
      `turkish_rendering_pass_b_association_marker_missing:${claim.id}`)
  }
  const forbiddenClinical = /tani koy|tedavi edilmeli|ilac (?:oner|kullanilmali)|doz (?:oner|ayarla)|seans plani|prognoz (?:ver|tahmin)/
  assert(!forbiddenClinical.test(normalized),
    `turkish_rendering_pass_b_clinical_addition:${claim.id}`)
  const forbiddenMechanism = /mekanizmasi sudur|beyinde su yolla|biyolojik olarak kanitlar/
  assert(!forbiddenMechanism.test(normalized),
    `turkish_rendering_pass_b_mechanism_addition:${claim.id}`)
  return {
    numberSequencePreserved: true,
    negationPreserved: true,
    hedgePreserved: true,
    causalStrengthPreserved: true,
    noAddedClinicalAction: true,
    noAddedMechanism: true,
  }
}

function selectedClaims(candidate: CandidatePackage): Array<{
  topic: CandidateTopic
  claim: CandidateClaim
  passage: CandidatePassage
  selection: "first" | "middle" | "last"
  passageIndex: number
  topicPassageCount: number
}> {
  const claimIndex = new Map(candidate.claims.map((claim, index) => [claim.id, index]))
  const passageIndex = new Map(candidate.passages.map((passage, index) => [passage.id, index]))
  return candidate.topics.flatMap((topic) => {
    const claims = candidate.claims.filter((claim) => claim.topicId === topic.id)
      .sort((left, right) => (claimIndex.get(left.id) ?? 0) - (claimIndex.get(right.id) ?? 0))
    const claimPassages = new Set(claims.map((claim) => claim.passageId))
    const passages = candidate.passages.filter((passage) => claimPassages.has(passage.id))
      .sort((left, right) => (passageIndex.get(left.id) ?? 0) - (passageIndex.get(right.id) ?? 0))
    assert(passages.length >= 3, `turkish_rendering_pass_b_insufficient_passages:${topic.id}`)
    const positions = [0, Math.floor((passages.length - 1) / 2), passages.length - 1]
    assert(new Set(positions).size === 3,
      `turkish_rendering_pass_b_selection_not_distinct:${topic.id}`)
    return positions.map((index, rank) => {
      const passage = passages[index]
      const claim = claims.find((entry) => entry.passageId === passage.id)
      assert(claim, `turkish_rendering_pass_b_representative_missing:${topic.id}`)
      return {
        topic,
        claim,
        passage,
        selection: (["first", "middle", "last"] as const)[rank],
        passageIndex: index,
        topicPassageCount: passages.length,
      }
    })
  })
}

export function loadPassBInputs(
  requestedRoot = process.env.RESEARCH_SSD_ROOT ?? "/Volumes/ResearchSSD",
): PassBInputs {
  const researchRoot = resolveSecureRoot(requestedRoot, true)
  const candidateRead = readJson<CandidatePackage>(
    researchRoot,
    join(researchRoot, CANDIDATE_RELATIVE_PATH),
  )
  const authoringRead = readJson<AuthoringLedger>(
    researchRoot,
    join(researchRoot, AUTHORING_RELATIVE_PATH),
    true,
  )
  return {
    researchRoot,
    candidate: candidateRead.value,
    candidateFileSha256: candidateRead.sha256,
    authoring: authoringRead.value,
    authoringFileSha256: authoringRead.sha256,
  }
}

export function buildPassBArtifact(inputs: PassBInputs): RenderingArtifact {
  const { candidate, authoring } = inputs
  assert(candidate.schemaVersion === "dna-external-science-candidate@1",
    "turkish_rendering_pass_b_candidate_schema")
  assert(canonicalSha256(omitKey(candidate as unknown as Record<string, unknown>, "packageSha256"))
    === candidate.packageSha256, "turkish_rendering_pass_b_candidate_hash")
  assert(candidate.runtimeEligible === false && candidate.releaseEligible === false
    && candidate.activationAllowed === false && candidate.activeRuntimeGeneration === "v2_legacy",
  "turkish_rendering_pass_b_candidate_boundary")
  assert(candidate.topics.length === EXPECTED_TOPIC_COUNT,
    "turkish_rendering_pass_b_topic_count")
  assert(authoring.schemaVersion === AUTHORING_SCHEMA && authoring.provenance === PROVENANCE,
    "turkish_rendering_pass_b_authoring_schema")
  assert(canonicalSha256(omitKey(authoring as unknown as Record<string, unknown>, "authoringSha256"))
    === authoring.authoringSha256, "turkish_rendering_pass_b_authoring_hash")
  assert(authoring.renderings.length === EXPECTED_RENDERING_COUNT,
    "turkish_rendering_pass_b_authoring_count")
  assert(new Set(authoring.renderings.map((entry) => entry.claimId)).size
    === authoring.renderings.length, "turkish_rendering_pass_b_duplicate_authoring_claim")
  assert(authoring.renderings.every((entry) => entry.decision.trim().length > 0),
    "turkish_rendering_pass_b_decision_missing")

  const selections = selectedClaims(candidate)
  const selectedIds = new Set(selections.map((entry) => entry.claim.id))
  const authoredIds = new Set(authoring.renderings.map((entry) => entry.claimId))
  assert(selectedIds.size === EXPECTED_RENDERING_COUNT && authoredIds.size === selectedIds.size
    && [...selectedIds].every((id) => authoredIds.has(id)),
  "turkish_rendering_pass_b_authoring_selection_mismatch")
  const renderingByClaim = new Map(authoring.renderings.map((entry) => [entry.claimId, entry]))
  const sourceById = new Map(candidate.sources.map((source) => [source.id, source]))

  const renderings = selections.map((selected) => {
    const { topic, claim, passage } = selected
    const source = sourceById.get(claim.sourceId)
    const authored = renderingByClaim.get(claim.id)
    assert(source && authored, `turkish_rendering_pass_b_binding_missing:${claim.id}`)
    assert(canonicalSha256(omitKey(topic as unknown as Record<string, unknown>, "topicSha256"))
      === topic.topicSha256, `turkish_rendering_pass_b_topic_hash:${topic.id}`)
    assert(canonicalSha256(omitKey(source as unknown as Record<string, unknown>, "sourceSha256"))
      === source.sourceSha256, `turkish_rendering_pass_b_source_hash:${source.id}`)
    assert(canonicalSha256(omitKey(claim as unknown as Record<string, unknown>, "claimSha256"))
      === claim.claimSha256, `turkish_rendering_pass_b_claim_hash:${claim.id}`)
    assert(canonicalSha256(omitKey(passage as unknown as Record<string, unknown>, "passageSha256"))
      === passage.passageSha256, `turkish_rendering_pass_b_passage_hash:${passage.id}`)
    assert(topic.sourceId === source.id && passage.sourceId === source.id
      && claim.sourceId === source.id && claim.passageId === passage.id,
    `turkish_rendering_pass_b_source_chain:${claim.id}`)
    assert(topic.ownerBookAuthority === false && source.runtimeEligible === false
      && source.releaseEligible === false && claim.runtimeEligible === false
      && claim.releaseEligible === false && passage.runtimeEligible === false
      && passage.releaseEligible === false,
    `turkish_rendering_pass_b_authority_boundary:${claim.id}`)
    const claimBoundarySha256 = sha256Bytes(claim.claimBoundary)
    const passageBoundarySha256 = sha256Bytes(passage.claimBoundary)
    const binding = {
      ageScope: claim.ageScope,
      passageAgeScope: passage.ageScope,
      evidenceLevel: claim.evidenceLevel,
      causalStatus: claim.causalStatus,
      claimBoundarySha256,
      passageBoundarySha256,
      publicationStatus: claim.publicationStatus,
      relationClass: claim.relationClass,
      dnaProductRelation: claim.dnaProductRelation,
    }
    const base = {
      id: `turkish-rendering-b:${claim.id}`,
      topicId: topic.id,
      sourceId: source.id,
      claimId: claim.id,
      passageId: passage.id,
      selection: selected.selection,
      passageIndex: selected.passageIndex,
      topicPassageCount: selected.topicPassageCount,
      candidateHashes: {
        topicSha256: topic.topicSha256,
        sourceSha256: source.sourceSha256,
        claimSha256: claim.claimSha256,
        passageSha256: passage.passageSha256,
      },
      originalProposition: claim.proposition,
      originalPropositionSha256: sha256Bytes(claim.proposition),
      turkishRendering: authored.turkishRendering,
      turkishRenderingSha256: sha256Bytes(authored.turkishRendering),
      decision: authored.decision,
      bindings: { ...binding, bindingSha256: canonicalSha256(binding) },
      fidelity: assertFidelity(claim, authored.turkishRendering),
      provenance: PROVENANCE,
      runtimeEligible: false as const,
      releaseEligible: false as const,
      activationAllowed: false as const,
    }
    return seal(base, "renderingRecordSha256") as RenderingRecord
  })

  const base = {
    schemaVersion: PASS_B_VERSION,
    basisAt: candidate.basisAt,
    authorityClass: "external_science_candidate_translation_feasibility",
    provenance: PROVENANCE,
    input: {
      candidateRelativePath: CANDIDATE_RELATIVE_PATH,
      candidateFileSha256: inputs.candidateFileSha256,
      candidatePackageSha256: candidate.packageSha256,
      authoringRelativePath: AUTHORING_RELATIVE_PATH,
      authoringFileSha256: inputs.authoringFileSha256,
      authoringSha256: authoring.authoringSha256,
    },
    selectionContract: {
      perTopic: 3,
      passageOrder: "candidate_passages_array_order",
      representativeClaimRule: "first_candidate_claim_in_selected_passage",
      positions: ["first", "floor((n-1)/2)", "last"],
    },
    renderings,
    counts: {
      topics: candidate.topics.length,
      renderings: renderings.length,
      first: renderings.filter((entry) => entry.selection === "first").length,
      middle: renderings.filter((entry) => entry.selection === "middle").length,
      last: renderings.filter((entry) => entry.selection === "last").length,
      fidelityPassed: renderings.length,
    },
    distributions: {
      ageScope: distribution(renderings.map((entry) => entry.bindings.ageScope)),
      evidenceLevel: distribution(renderings.map((entry) => entry.bindings.evidenceLevel)),
      causalStatus: distribution(renderings.map((entry) => entry.bindings.causalStatus)),
      publicationStatus: distribution(renderings.map((entry) => entry.bindings.publicationStatus)),
    },
    verification: {
      deterministicSelection: true,
      exactTopicCoverage: true,
      exactRenderingCoverage: true,
      numberSequenceMismatches: 0,
      negationMismatches: 0,
      hedgeMismatches: 0,
      causalUpgrades: 0,
      clinicalAdditions: 0,
      mechanismAdditions: 0,
      bindingHashMismatches: 0,
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
    runtimeEligible: false as const,
    releaseEligible: false as const,
    activationAllowed: false as const,
    adapterAuthority: false as const,
    ownerBookAuthority: false as const,
  }
  return seal(base, "artifactSha256") as RenderingArtifact
}

export function validatePassBArtifact(artifact: RenderingArtifact): true {
  assert(artifact.schemaVersion === PASS_B_VERSION,
    "turkish_rendering_pass_b_artifact_schema")
  assert(canonicalSha256(omitKey(artifact as unknown as Record<string, unknown>, "artifactSha256"))
    === artifact.artifactSha256, "turkish_rendering_pass_b_artifact_hash")
  assert(artifact.renderings.length === EXPECTED_RENDERING_COUNT
    && artifact.counts.renderings === EXPECTED_RENDERING_COUNT,
  "turkish_rendering_pass_b_artifact_count")
  assert(artifact.runtimeEligible === false && artifact.releaseEligible === false
    && artifact.activationAllowed === false && artifact.adapterAuthority === false
    && artifact.ownerBookAuthority === false,
  "turkish_rendering_pass_b_artifact_boundary")
  assert(artifact.renderings.every((record) =>
    canonicalSha256(omitKey(record as unknown as Record<string, unknown>, "renderingRecordSha256"))
      === record.renderingRecordSha256
      && record.bindings.bindingSha256 === canonicalSha256(omitKey(
        record.bindings as unknown as Record<string, unknown>, "bindingSha256",
      ))
      && record.runtimeEligible === false && record.releaseEligible === false
      && record.activationAllowed === false && record.provenance === PROVENANCE),
  "turkish_rendering_pass_b_record_invalid")
  return true
}

function buildManifest(artifact: RenderingArtifact, rawSha256: string): PassBManifest {
  return {
    schemaVersion: MANIFEST_SCHEMA,
    recordedAt: artifact.basisAt,
    version: PASS_B_VERSION,
    provenance: PROVENANCE,
    inputHashes: {
      candidatePackageSha256: artifact.input.candidatePackageSha256,
      candidateFileSha256: artifact.input.candidateFileSha256,
      authoringFileSha256: artifact.input.authoringFileSha256,
      authoringSha256: artifact.input.authoringSha256,
    },
    output: {
      researchSsdRelativePath: ARTIFACT_RELATIVE_PATH,
      rawSha256,
      artifactSha256: artifact.artifactSha256,
      fileMode: "0600",
    },
    counts: artifact.counts,
    distributions: artifact.distributions,
    acceptance: {
      deterministicSelection: true,
      exactTopicCoverage: true,
      exactRenderingCoverage: true,
      fidelityGate: "pass",
      textLeakGate: "pass",
      candidateOnly: true,
    },
    boundaries: {
      independentHumanReview: false,
      runtimeEligible: false,
      releaseEligible: false,
      activationAllowed: false,
      adapterAuthority: false,
      ownerBookAuthority: false,
      runtimeAuthority: "none",
      releaseAuthority: "none",
      v3ReleaseDecision: "no_go_unchanged",
    },
  }
}

function stableManifestProjection(manifest: PassBManifest) {
  return manifest
}

export function assertManifestMatch(recorded: PassBManifest, expected: PassBManifest): true {
  assert(canonicalSha256(stableManifestProjection(recorded))
    === canonicalSha256(stableManifestProjection(expected)),
  "turkish_rendering_pass_b_manifest_drift")
  return true
}

export function assertManifestHasNoText(
  manifest: PassBManifest,
  artifact: RenderingArtifact,
): true {
  const serialized = JSON.stringify(manifest)
  for (const record of artifact.renderings) {
    assert(!serialized.includes(record.originalProposition),
      "turkish_rendering_pass_b_manifest_proposition_leak")
    assert(!serialized.includes(record.turkishRendering),
      "turkish_rendering_pass_b_manifest_rendering_leak")
    assert(!serialized.includes(record.decision),
      "turkish_rendering_pass_b_manifest_decision_leak")
  }
  return true
}

export function runPassB() {
  const inputs = loadPassBInputs()
  const artifact = buildPassBArtifact(inputs)
  validatePassBArtifact(artifact)
  const deterministicHashes = Array.from({ length: 20 }, () =>
    buildPassBArtifact(inputs).artifactSha256)
  assert(new Set(deterministicHashes).size === 1
    && deterministicHashes[0] === artifact.artifactSha256,
  "turkish_rendering_pass_b_determinism")
  const rawText = `${JSON.stringify(artifact, null, 2)}\n`
  const rawSha256 = sha256Bytes(rawText)
  const manifest = buildManifest(artifact, rawSha256)
  assertManifestHasNoText(manifest, artifact)

  const repoRoot = resolveSecureRoot(process.cwd())
  const artifactPath = assertContained(inputs.researchRoot,
    join(inputs.researchRoot, ARTIFACT_RELATIVE_PATH))
  const manifestPath = assertContained(repoRoot, join(repoRoot, REPO_MANIFEST_RELATIVE_PATH))
  const writeManifest = process.argv.includes("--write-manifest")
  if (!writeManifest) {
    assert(existsSync(manifestPath),
      "turkish_rendering_pass_b_manifest_missing_run_write")
    assert(!lstatSync(manifestPath).isSymbolicLink(),
      "turkish_rendering_pass_b_manifest_symlink")
    const recorded = JSON.parse(readFileSync(manifestPath, "utf8")) as PassBManifest
    assertManifestMatch(recorded, manifest)
  }
  const artifactWrite = secureAtomicWriteFile(inputs.researchRoot, artifactPath, rawText)
  assert(artifactWrite.sha256 === rawSha256,
    "turkish_rendering_pass_b_artifact_write_hash")
  verifySecureFile(inputs.researchRoot, artifactPath, rawText)
  if (writeManifest) {
    const manifestText = `${JSON.stringify(manifest, null, 2)}\n`
    secureAtomicWriteFile(repoRoot, manifestPath, manifestText)
    verifySecureFile(repoRoot, manifestPath, manifestText)
  }
  console.log(JSON.stringify({
    ok: true,
    version: PASS_B_VERSION,
    provenance: PROVENANCE,
    counts: artifact.counts,
    distributions: artifact.distributions,
    deterministicRepeats: deterministicHashes.length,
    uniqueDeterministicHashes: new Set(deterministicHashes).size,
    artifactSha256: artifact.artifactSha256,
    rawSha256,
    acceptance: manifest.acceptance,
    boundaries: manifest.boundaries,
  }, null, 2))
}

if (require.main === module) {
  try {
    runPassB()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

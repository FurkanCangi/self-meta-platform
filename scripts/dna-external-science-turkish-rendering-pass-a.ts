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
  assertContained,
  assertSecureParentChain,
  canonicalSha256,
  resolveSecureRoot,
  secureAtomicWriteFile,
  sha256Bytes,
  verifySecureFile,
} from "./dna-secure-artifact"

export const TURKISH_RENDERING_PASS_A_VERSION =
  "dna-external-science-turkish-rendering-pass-a@1"
export const SELECTION_RULE_VERSION =
  "dna-external-science-topic-start-middle-end-distinct-passage@1"

const CANDIDATE_RELATIVE_PATH =
  "Datasets/DNA-Intelligence/work/v3/prebook-closure/v1/external-science-candidate-package.json"
const PILOT_RELATIVE_ROOT =
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-pass-a/feasibility-v1"
const DECISIONS_RELATIVE_PATH = `${PILOT_RELATIVE_ROOT}/pass-a-decisions.json`
const RAW_OUTPUT_RELATIVE_PATH = `${PILOT_RELATIVE_ROOT}/pass-a-artifact.json`
const REPO_MANIFEST_RELATIVE_PATH =
  "docs/dna-intelligence/program/evidence/external-science-turkish-rendering-pass-a-current.json"

const EXPECTED_TOPIC_COUNT = 14
const EXPECTED_RECORDS_PER_TOPIC = 3
const EXPECTED_RECORD_COUNT = EXPECTED_TOPIC_COUNT * EXPECTED_RECORDS_PER_TOPIC
const SHA256_PATTERN = /^[a-f0-9]{64}$/

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
  originalText: string
  contentSha256: string
  passageSha256: string
  runtimeEligible: boolean
  releaseEligible: boolean
}

type CandidateClaim = {
  id: string
  topicId: string
  sourceId: string
  passageId: string
  proposition: string
  ageScope: string
  causalStatus: string
  evidenceLevel: string
  claimBoundary: string
  claimSha256: string
  runtimeEligible: boolean
  releaseEligible: boolean
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

type TranslationDecision = {
  claimId: string
  renderingTr: string
  scientificFidelity: true
  naturalTurkish: true
  singleAtomicClaim: true
  noSourceExternalMechanismAdded: true
  noSourceExternalExampleAdded: true
  noSourceExternalClinicalOutcomeAdded: true
  englishTermFirstUsePreservedWhenNeeded: true
}

type TranslationDecisions = {
  schemaVersion: string
  passVersion: string
  candidatePackageSha256: string
  reviewedAt: string
  provenance: "codex_translation_pass_a_not_independent_human_review"
  runtimeEligible: false
  releaseEligible: false
  decisions: TranslationDecision[]
  decisionsSha256: string
}

export type SelectionSlot = "start" | "middle" | "end"

export type SelectedClaim = {
  topicId: string
  slot: SelectionSlot
  anchorIndex: number
  claimIndex: number
  claim: CandidateClaim
}

type CausalSignal = "none" | "associational" | "strong_causal"

type PreservationChecks = {
  numbersPreserved: boolean
  negationPreserved: boolean
  hedgePreserved: boolean
  causalStrengthPreserved: boolean
  scientificFidelity: boolean
  naturalTurkish: boolean
  singleAtomicClaim: boolean
  noSourceExternalMechanismAdded: boolean
  noSourceExternalExampleAdded: boolean
  noSourceExternalClinicalOutcomeAdded: boolean
  englishTermFirstUsePreservedWhenNeeded: boolean
  allPassed: boolean
}

type RenderingRecord = {
  id: string
  topicId: string
  sourceId: string
  passageId: string
  claimId: string
  selectionSlot: SelectionSlot
  originalPropositionSha256: string
  candidateClaimSha256: string
  candidatePassageSha256: string
  renderingTr: string
  renderingSha256: string
  ageScopeSha256: string
  causalStatusSha256: string
  evidenceLevelSha256: string
  claimBoundarySha256: string
  sourceNumberSignalSha256: string
  renderingNumberSignalSha256: string
  sourceNegationSignalSha256: string
  renderingNegationSignalSha256: string
  sourceHedgeSignalSha256: string
  renderingHedgeSignalSha256: string
  sourceCausalSignalSha256: string
  renderingCausalSignalSha256: string
  checks: PreservationChecks
  provenance: "codex_translation_pass_a_not_independent_human_review"
  runtimeEligible: false
  releaseEligible: false
  recordSha256: string
}

type QaFailureCounts = {
  numbersPreserved: number
  negationPreserved: number
  hedgePreserved: number
  causalStrengthPreserved: number
  scientificFidelity: number
  naturalTurkish: number
  singleAtomicClaim: number
  noSourceExternalMechanismAdded: number
  noSourceExternalExampleAdded: number
  noSourceExternalClinicalOutcomeAdded: number
  englishTermFirstUsePreservedWhenNeeded: number
  recordsWithAnyFailure: number
  totalFailures: number
}

type TopicCoverage = {
  topicId: string
  selectedCount: 3
  distinctPassageCount: 3
  startCount: 1
  middleCount: 1
  endCount: 1
  selectionSha256: string
}

export type RenderingArtifact = {
  schemaVersion: string
  basisAt: string
  passVersion: string
  status: "feasibility_fidelity_pilot"
  authorityClass: "external_science_candidate"
  candidatePackageSha256: string
  candidateFileSha256: string
  decisionsSha256: string
  decisionsFileSha256: string
  selectionRule: {
    version: string
    packageOrderBound: true
    anchors: ["first", "floor((n-1)/2)", "last"]
    distinctPassagePreferredAndRequired: true
    deterministicTieBreak: "middle_lower_index_end_higher_index"
  }
  topicCoverage: TopicCoverage[]
  counts: {
    topics: 14
    records: 42
    recordsPerTopic: 3
    distinctPassages: 42
  }
  qaFailureCounts: QaFailureCounts
  records: RenderingRecord[]
  limitations: string[]
  provenance: "codex_translation_pass_a_not_independent_human_review"
  runtimeEligible: false
  releaseEligible: false
  activationAllowed: false
  adapterEligible: false
  ownerAuthorityChanged: false
  passBPerformed: false
  reconciliationPerformed: false
  artifactSha256: string
}

export type PilotInputs = {
  researchRoot: string
  candidate: CandidatePackage
  candidateFileSha256: string
  decisions: TranslationDecisions
  decisionsFileSha256: string
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

function withoutKey<T extends JsonRecord>(value: T, key: string): JsonRecord {
  return Object.fromEntries(Object.entries(value).filter(([candidate]) => candidate !== key))
}

function assertSha(value: unknown, message: string): asserts value is string {
  assert(typeof value === "string" && SHA256_PATTERN.test(value), message)
}

function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown
}

function resolveReadableFile(
  root: string,
  relativePath: string,
  requireMode0600: boolean,
): { path: string; bytes: Buffer; sha256: string } {
  const path = assertSecureParentChain(root, join(root, relativePath), false)
  assert(existsSync(path), "turkish_rendering_input_missing")
  const metadata = lstatSync(path)
  assert(!metadata.isSymbolicLink(), "turkish_rendering_input_symlink_rejected")
  assert(metadata.isFile(), "turkish_rendering_input_not_regular_file")
  const real = realpathSync(path)
  const delta = relative(root, real)
  assert(delta !== ".." && !delta.startsWith(`..${sep}`), "turkish_rendering_input_realpath_escape")
  if (requireMode0600) {
    assert((statSync(path).mode & 0o777) === 0o600, "turkish_rendering_input_mode_invalid")
  }
  const bytes = readFileSync(path)
  return { path, bytes, sha256: sha256Bytes(bytes) }
}

function validateCandidate(candidate: CandidatePackage): void {
  assertRecord(candidate, "turkish_rendering_candidate_invalid")
  assert(candidate.authorityClass === "external_science_candidate", "turkish_rendering_authority_invalid")
  assert(candidate.runtimeEligible === false, "turkish_rendering_candidate_runtime_boundary")
  assert(candidate.releaseEligible === false, "turkish_rendering_candidate_release_boundary")
  assert(candidate.activationAllowed === false, "turkish_rendering_candidate_activation_boundary")
  assert(candidate.activeRuntimeGeneration === "v2_legacy", "turkish_rendering_candidate_runtime_generation")
  assert(Array.isArray(candidate.topics) && candidate.topics.length === EXPECTED_TOPIC_COUNT, "turkish_rendering_topic_count")
  assert(Array.isArray(candidate.sources) && candidate.sources.length > 0, "turkish_rendering_sources_invalid")
  assert(Array.isArray(candidate.passages) && candidate.passages.length >= EXPECTED_RECORD_COUNT, "turkish_rendering_passages_invalid")
  assert(Array.isArray(candidate.claims) && candidate.claims.length >= EXPECTED_RECORD_COUNT, "turkish_rendering_claims_invalid")
  assertSha(candidate.packageSha256, "turkish_rendering_candidate_hash_invalid")
  assert(canonicalSha256(withoutKey(candidate as unknown as JsonRecord, "packageSha256")) === candidate.packageSha256, "turkish_rendering_candidate_hash_mismatch")

  const topics = new Map<string, CandidateTopic>()
  for (const topic of candidate.topics) {
    assert(typeof topic.id === "string" && topic.id.length > 0 && !topics.has(topic.id), "turkish_rendering_topic_invalid")
    assertSha(topic.topicSha256, "turkish_rendering_topic_hash_invalid")
    assert(canonicalSha256(withoutKey(topic as unknown as JsonRecord, "topicSha256")) === topic.topicSha256, "turkish_rendering_topic_hash_mismatch")
    topics.set(topic.id, topic)
  }

  const sources = new Map<string, CandidateSource>()
  for (const source of candidate.sources) {
    assert(typeof source.id === "string" && source.id.length > 0 && !sources.has(source.id), "turkish_rendering_source_invalid")
    assert(source.runtimeEligible === false && source.releaseEligible === false, "turkish_rendering_source_boundary")
    assertSha(source.sourceSha256, "turkish_rendering_source_hash_invalid")
    assert(canonicalSha256(withoutKey(source as unknown as JsonRecord, "sourceSha256")) === source.sourceSha256, "turkish_rendering_source_hash_mismatch")
    sources.set(source.id, source)
  }

  const passages = new Map<string, CandidatePassage>()
  for (const passage of candidate.passages) {
    assert(typeof passage.id === "string" && passage.id.length > 0 && !passages.has(passage.id), "turkish_rendering_passage_invalid")
    assert(sources.has(passage.sourceId), "turkish_rendering_passage_source_missing")
    assert(typeof passage.originalText === "string" && passage.originalText.trim().length > 0, "turkish_rendering_passage_content_invalid")
    assertSha(passage.contentSha256, "turkish_rendering_passage_content_hash_invalid")
    assert(sha256Bytes(passage.originalText) === passage.contentSha256, "turkish_rendering_passage_content_hash_mismatch")
    assert(passage.runtimeEligible === false && passage.releaseEligible === false, "turkish_rendering_passage_boundary")
    assertSha(passage.passageSha256, "turkish_rendering_passage_hash_invalid")
    assert(canonicalSha256(withoutKey(passage as unknown as JsonRecord, "passageSha256")) === passage.passageSha256, "turkish_rendering_passage_hash_mismatch")
    passages.set(passage.id, passage)
  }

  const claims = new Set<string>()
  for (const claim of candidate.claims) {
    assert(typeof claim.id === "string" && claim.id.length > 0 && !claims.has(claim.id), "turkish_rendering_claim_invalid")
    assert(topics.has(claim.topicId), "turkish_rendering_claim_topic_missing")
    assert(sources.has(claim.sourceId), "turkish_rendering_claim_source_missing")
    const passage = passages.get(claim.passageId)
    assert(passage?.sourceId === claim.sourceId, "turkish_rendering_claim_passage_missing")
    assert(typeof claim.proposition === "string" && claim.proposition.trim().length > 0, "turkish_rendering_claim_proposition_invalid")
    assert(claim.runtimeEligible === false && claim.releaseEligible === false, "turkish_rendering_claim_boundary")
    assertSha(claim.claimSha256, "turkish_rendering_claim_hash_invalid")
    assert(canonicalSha256(withoutKey(claim as unknown as JsonRecord, "claimSha256")) === claim.claimSha256, "turkish_rendering_claim_hash_mismatch")
    claims.add(claim.id)
  }
}

function chooseDistinctPassageClaim(
  claims: CandidateClaim[],
  anchorIndex: number,
  usedClaimIndexes: Set<number>,
  usedPassages: Set<string>,
  preferHigherIndex: boolean,
): number {
  const candidates = claims
    .map((claim, index) => ({ claim, index, distance: Math.abs(index - anchorIndex) }))
    .filter(({ claim, index }) => !usedClaimIndexes.has(index) && !usedPassages.has(claim.passageId))
    .sort((left, right) => {
      if (left.distance !== right.distance) return left.distance - right.distance
      return preferHigherIndex ? right.index - left.index : left.index - right.index
    })
  assert(candidates.length > 0, "turkish_rendering_distinct_passage_selection_impossible")
  return candidates[0].index
}

export function selectRepresentativeClaims(candidate: CandidatePackage): SelectedClaim[] {
  validateCandidate(candidate)
  const selected: SelectedClaim[] = []
  for (const topic of candidate.topics) {
    const claims = candidate.claims.filter((claim) => claim.topicId === topic.id)
    assert(claims.length >= EXPECTED_RECORDS_PER_TOPIC, "turkish_rendering_topic_claims_insufficient")
    const usedIndexes = new Set<number>()
    const usedPassages = new Set<string>()
    const anchors: Array<{ slot: SelectionSlot; index: number; preferHigher: boolean }> = [
      { slot: "start", index: 0, preferHigher: false },
      { slot: "middle", index: Math.floor((claims.length - 1) / 2), preferHigher: false },
      { slot: "end", index: claims.length - 1, preferHigher: true },
    ]
    for (const anchor of anchors) {
      const claimIndex = chooseDistinctPassageClaim(
        claims,
        anchor.index,
        usedIndexes,
        usedPassages,
        anchor.preferHigher,
      )
      const claim = claims[claimIndex]
      usedIndexes.add(claimIndex)
      usedPassages.add(claim.passageId)
      selected.push({ topicId: topic.id, slot: anchor.slot, anchorIndex: anchor.index, claimIndex, claim })
    }
    assert(usedPassages.size === EXPECTED_RECORDS_PER_TOPIC, "turkish_rendering_topic_passage_diversity")
  }
  assert(selected.length === EXPECTED_RECORD_COUNT, "turkish_rendering_selection_count")
  return selected
}

const DECISION_KEYS = [
  "claimId",
  "renderingTr",
  "scientificFidelity",
  "naturalTurkish",
  "singleAtomicClaim",
  "noSourceExternalMechanismAdded",
  "noSourceExternalExampleAdded",
  "noSourceExternalClinicalOutcomeAdded",
  "englishTermFirstUsePreservedWhenNeeded",
]

function validateDecisions(
  decisions: TranslationDecisions,
  candidate: CandidatePackage,
  allowAutoHash = false,
): void {
  assertRecord(decisions, "turkish_rendering_decisions_invalid")
  assertExactKeys(decisions as unknown as JsonRecord, [
    "schemaVersion",
    "passVersion",
    "candidatePackageSha256",
    "reviewedAt",
    "provenance",
    "runtimeEligible",
    "releaseEligible",
    "decisions",
    "decisionsSha256",
  ], "turkish_rendering_decisions_keys_invalid")
  assert(decisions.schemaVersion === "dna-external-science-turkish-rendering-decisions@1", "turkish_rendering_decisions_schema")
  assert(decisions.passVersion === TURKISH_RENDERING_PASS_A_VERSION, "turkish_rendering_decisions_pass")
  assert(decisions.candidatePackageSha256 === candidate.packageSha256, "turkish_rendering_decisions_candidate_binding")
  assert(!Number.isNaN(Date.parse(decisions.reviewedAt)), "turkish_rendering_decisions_reviewed_at")
  assert(decisions.provenance === "codex_translation_pass_a_not_independent_human_review", "turkish_rendering_decisions_provenance")
  assert(decisions.runtimeEligible === false && decisions.releaseEligible === false, "turkish_rendering_decisions_boundary")
  assert(Array.isArray(decisions.decisions) && decisions.decisions.length === EXPECTED_RECORD_COUNT, "turkish_rendering_decisions_count")

  const selected = selectRepresentativeClaims(candidate)
  decisions.decisions.forEach((decision, index) => {
    assertRecord(decision, "turkish_rendering_decision_invalid")
    assertExactKeys(decision as unknown as JsonRecord, DECISION_KEYS, "turkish_rendering_decision_keys_invalid")
    assert(decision.claimId === selected[index].claim.id, "turkish_rendering_decision_selection_mismatch")
    assert(typeof decision.renderingTr === "string" && decision.renderingTr.trim().length >= 12, "turkish_rendering_decision_rendering_invalid")
    assert(!decision.renderingTr.includes("\n"), "turkish_rendering_decision_multiline")
    assert(decision.scientificFidelity === true, "turkish_rendering_decision_fidelity_unapproved")
    assert(decision.naturalTurkish === true, "turkish_rendering_decision_turkish_unapproved")
    assert(decision.singleAtomicClaim === true, "turkish_rendering_decision_atomicity_unapproved")
    assert(decision.noSourceExternalMechanismAdded === true, "turkish_rendering_decision_mechanism_unapproved")
    assert(decision.noSourceExternalExampleAdded === true, "turkish_rendering_decision_example_unapproved")
    assert(decision.noSourceExternalClinicalOutcomeAdded === true, "turkish_rendering_decision_clinical_outcome_unapproved")
    assert(decision.englishTermFirstUsePreservedWhenNeeded === true, "turkish_rendering_decision_term_unapproved")
  })
  if (allowAutoHash) {
    assert(decisions.decisionsSha256 === "AUTO" || SHA256_PATTERN.test(decisions.decisionsSha256), "turkish_rendering_decisions_hash_invalid")
  } else {
    assertSha(decisions.decisionsSha256, "turkish_rendering_decisions_hash_invalid")
    assert(canonicalSha256(withoutKey(decisions as unknown as JsonRecord, "decisionsSha256")) === decisions.decisionsSha256, "turkish_rendering_decisions_hash_mismatch")
  }
}

function stripCitationNoise(value: string): string {
  return value
    .replace(/\[\s*\d+(?:\s*[,;–-]\s*\d+)*\s*\]/g, " ")
    .replace(/\([^)]*\bet\s+al\.[^)]*(?:19|20)\d{2}[^)]*\)/gi, " ")
    .replace(/\s+\d{1,3}\s*(?:,\s*\d{1,3}\s*)+\.\s*$/g, ".")
}

export function extractNumberSignals(value: string): string[] {
  const normalized = stripCitationNoise(value)
    .replace(/−/g, "-")
    .replace(/[–—]/g, " ")
    .replace(/(\d)-(?=\d)/g, "$1 ")
    .replace(/%\s*((?:\d+(?:[.,]\d+)?|[.,]\d+))/g, "$1%")
  return (normalized.match(/-?(?:\d+(?:[.,]\d+)?|[.,]\d+)%?/g) ?? []).map((token) => {
    let result = token.replace(",", ".")
    if (result.startsWith(".")) result = `0${result}`
    if (result.startsWith("-.")) result = result.replace("-.", "-0.")
    return result
  })
}

function hasEnglishNegation(value: string): boolean {
  return /\b(?:no|not|without|neither|nor|free\s+from|did\s+not|does\s+not|was\s+not|were\s+not|cannot|can['’]t|poorly\s+understood)\b/i.test(value)
}

function hasTurkishNegation(value: string): boolean {
  return /\b(?:değil|değildir|değildi|yok|yoktur|olmadan|bulunmayan|kullanmayan|göstermemiştir|derecelendirmemiştir|oluşturulmamıştır|dışında|dışlamaz|olmayabilir|anlaşılmamıştır)\b/iu.test(value)
}

function hasEnglishHedge(value: string): boolean {
  return /\b(?:may|might|could|can\s+be|tentatively|mainly|typically|often|approximately|approximation|relatively|only|alone|solely|at\s+minimum|more\s+conclusive|more\s+appropriate|particularly\s+appropriate|poorly\s+understood|limited)\b/i.test(value)
}

function hasTurkishHedge(value: string): boolean {
  return /(?:olabilir|olmayabilir|sunabilir|ayrılabilir|geçici|ağırlıklı(?:\s+olarak)?|genellikle|sıklıkla|yaklaşık|görece|yalnızca|yalnız|en\s+azından|daha\s+sonuçlandırıcı|daha\s+uygun(?:dur)?|yeterince\s+anlaşılmamıştır|sınırlandırılmıştır)/iu.test(value)
}

function englishCausalSignal(value: string): CausalSignal {
  if (/\b(?:cause[sd]?|causing|lead(?:s|ing)?\s+to|result(?:s|ed|ing)?\s+in|determine[sd]?|produc(?:e|es|ed|ing))\b/i.test(value)) {
    return "strong_causal"
  }
  if (/\b(?:associated\s+with|correlat(?:e|es|ed|ion|ions)|linked\s+to|relationship\s+between)\b/i.test(value)) {
    return "associational"
  }
  return "none"
}

function turkishCausalSignal(value: string): CausalSignal {
  if (/\b(?:neden\s+olur|neden\s+olmaktadır|yol\s+açar|sonuçlanır|belirler|üretir)\b/iu.test(value)) {
    return "strong_causal"
  }
  if (/\b(?:ilişkilidir|ilişkili|korelasyon|arasında\s+ilişki)\b/iu.test(value)) {
    return "associational"
  }
  return "none"
}

function isSingleSentence(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed || trimmed.includes("\n")) return false
  const terminators = trimmed.match(/[.!?](?:[\"'”’)]*)?(?=\s|$)/g) ?? []
  return terminators.length === 1 && /[.!?][\"'”’)]*$/.test(trimmed)
}

function makeChecks(claim: CandidateClaim, decision: TranslationDecision): {
  checks: PreservationChecks
  signals: Omit<RenderingRecord,
    | "id"
    | "topicId"
    | "sourceId"
    | "passageId"
    | "claimId"
    | "selectionSlot"
    | "originalPropositionSha256"
    | "candidateClaimSha256"
    | "candidatePassageSha256"
    | "renderingTr"
    | "renderingSha256"
    | "ageScopeSha256"
    | "causalStatusSha256"
    | "evidenceLevelSha256"
    | "claimBoundarySha256"
    | "checks"
    | "provenance"
    | "runtimeEligible"
    | "releaseEligible"
    | "recordSha256"
  >
} {
  const sourceNumbers = extractNumberSignals(claim.proposition)
  const renderingNumbers = extractNumberSignals(decision.renderingTr)
  const sourceNegation = hasEnglishNegation(claim.proposition)
  const renderingNegation = hasTurkishNegation(decision.renderingTr)
  const sourceHedge = hasEnglishHedge(claim.proposition)
  const renderingHedge = hasTurkishHedge(decision.renderingTr)
  const sourceCausal = englishCausalSignal(claim.proposition)
  const renderingCausal = turkishCausalSignal(decision.renderingTr)
  const checks: PreservationChecks = {
    numbersPreserved: JSON.stringify(sourceNumbers) === JSON.stringify(renderingNumbers),
    negationPreserved: sourceNegation === renderingNegation,
    hedgePreserved: sourceHedge === renderingHedge,
    causalStrengthPreserved: sourceCausal === renderingCausal,
    scientificFidelity: decision.scientificFidelity,
    naturalTurkish: decision.naturalTurkish,
    singleAtomicClaim: decision.singleAtomicClaim && isSingleSentence(decision.renderingTr),
    noSourceExternalMechanismAdded: decision.noSourceExternalMechanismAdded,
    noSourceExternalExampleAdded: decision.noSourceExternalExampleAdded,
    noSourceExternalClinicalOutcomeAdded: decision.noSourceExternalClinicalOutcomeAdded,
    englishTermFirstUsePreservedWhenNeeded: decision.englishTermFirstUsePreservedWhenNeeded,
    allPassed: false,
  }
  checks.allPassed = Object.entries(checks)
    .filter(([key]) => key !== "allPassed")
    .every(([, value]) => value === true)
  return {
    checks,
    signals: {
      sourceNumberSignalSha256: canonicalSha256(sourceNumbers),
      renderingNumberSignalSha256: canonicalSha256(renderingNumbers),
      sourceNegationSignalSha256: canonicalSha256(sourceNegation),
      renderingNegationSignalSha256: canonicalSha256(renderingNegation),
      sourceHedgeSignalSha256: canonicalSha256(sourceHedge),
      renderingHedgeSignalSha256: canonicalSha256(renderingHedge),
      sourceCausalSignalSha256: canonicalSha256(sourceCausal),
      renderingCausalSignalSha256: canonicalSha256(renderingCausal),
    },
  }
}

function countQaFailures(records: RenderingRecord[]): QaFailureCounts {
  const keys: Array<Exclude<keyof PreservationChecks, "allPassed">> = [
    "numbersPreserved",
    "negationPreserved",
    "hedgePreserved",
    "causalStrengthPreserved",
    "scientificFidelity",
    "naturalTurkish",
    "singleAtomicClaim",
    "noSourceExternalMechanismAdded",
    "noSourceExternalExampleAdded",
    "noSourceExternalClinicalOutcomeAdded",
    "englishTermFirstUsePreservedWhenNeeded",
  ]
  const result = Object.fromEntries(keys.map((key) => [key, records.filter((record) => !record.checks[key]).length])) as unknown as QaFailureCounts
  result.recordsWithAnyFailure = records.filter((record) => !record.checks.allPassed).length
  result.totalFailures = keys.reduce((total, key) => total + result[key], 0)
  return result
}

function buildTopicCoverage(records: RenderingRecord[]): TopicCoverage[] {
  const topics = [...new Set(records.map((record) => record.topicId))].sort((left, right) => left.localeCompare(right, "en"))
  return topics.map((topicId) => {
    const topicRecords = records.filter((record) => record.topicId === topicId)
    const passages = new Set(topicRecords.map((record) => record.passageId))
    assert(topicRecords.length === 3 && passages.size === 3, "turkish_rendering_topic_coverage_invalid")
    return {
      topicId,
      selectedCount: 3,
      distinctPassageCount: 3,
      startCount: topicRecords.filter((record) => record.selectionSlot === "start").length as 1,
      middleCount: topicRecords.filter((record) => record.selectionSlot === "middle").length as 1,
      endCount: topicRecords.filter((record) => record.selectionSlot === "end").length as 1,
      selectionSha256: canonicalSha256(topicRecords.map((record) => ({
        claimId: record.claimId,
        passageId: record.passageId,
        slot: record.selectionSlot,
      }))),
    }
  })
}

export function buildRenderingArtifact(inputs: PilotInputs): RenderingArtifact {
  validateCandidate(inputs.candidate)
  validateDecisions(inputs.decisions, inputs.candidate)
  const passages = new Map(inputs.candidate.passages.map((passage) => [passage.id, passage]))
  const decisions = new Map(inputs.decisions.decisions.map((decision) => [decision.claimId, decision]))
  const selected = selectRepresentativeClaims(inputs.candidate)

  const records = selected.map((selection): RenderingRecord => {
    const claim = selection.claim
    const decision = decisions.get(claim.id)
    const passage = passages.get(claim.passageId)
    assert(decision && passage, "turkish_rendering_selected_input_missing")
    const { checks, signals } = makeChecks(claim, decision)
    const basis = {
      id: `external.rendering.tr.pass_a:${claim.id}`,
      topicId: claim.topicId,
      sourceId: claim.sourceId,
      passageId: claim.passageId,
      claimId: claim.id,
      selectionSlot: selection.slot,
      originalPropositionSha256: sha256Bytes(claim.proposition),
      candidateClaimSha256: claim.claimSha256,
      candidatePassageSha256: passage.passageSha256,
      renderingTr: decision.renderingTr,
      renderingSha256: sha256Bytes(decision.renderingTr),
      ageScopeSha256: canonicalSha256(claim.ageScope),
      causalStatusSha256: canonicalSha256(claim.causalStatus),
      evidenceLevelSha256: canonicalSha256(claim.evidenceLevel),
      claimBoundarySha256: canonicalSha256(claim.claimBoundary),
      ...signals,
      checks,
      provenance: "codex_translation_pass_a_not_independent_human_review" as const,
      runtimeEligible: false as const,
      releaseEligible: false as const,
    }
    return { ...basis, recordSha256: canonicalSha256(basis) }
  })

  const topicCoverage = buildTopicCoverage(records)
  const qaFailureCounts = countQaFailures(records)
  const basis = {
    schemaVersion: "dna-external-science-turkish-rendering-pass-a-artifact@1",
    basisAt: inputs.decisions.reviewedAt,
    passVersion: TURKISH_RENDERING_PASS_A_VERSION,
    status: "feasibility_fidelity_pilot" as const,
    authorityClass: "external_science_candidate" as const,
    candidatePackageSha256: inputs.candidate.packageSha256,
    candidateFileSha256: inputs.candidateFileSha256,
    decisionsSha256: inputs.decisions.decisionsSha256,
    decisionsFileSha256: inputs.decisionsFileSha256,
    selectionRule: {
      version: SELECTION_RULE_VERSION,
      packageOrderBound: true as const,
      anchors: ["first", "floor((n-1)/2)", "last"] as ["first", "floor((n-1)/2)", "last"],
      distinctPassagePreferredAndRequired: true as const,
      deterministicTieBreak: "middle_lower_index_end_higher_index" as const,
    },
    topicCoverage,
    counts: {
      topics: EXPECTED_TOPIC_COUNT as 14,
      records: EXPECTED_RECORD_COUNT as 42,
      recordsPerTopic: EXPECTED_RECORDS_PER_TOPIC as 3,
      distinctPassages: new Set(records.map((record) => record.passageId)).size as 42,
    },
    qaFailureCounts,
    records,
    limitations: [
      "This is a bounded feasibility and fidelity pilot, not an independent human translation review.",
      "Pass B and reconciliation were not performed.",
      "The artifact is candidate-only and cannot activate a runtime, adapter, release, or owner authority.",
    ],
    provenance: "codex_translation_pass_a_not_independent_human_review" as const,
    runtimeEligible: false as const,
    releaseEligible: false as const,
    activationAllowed: false as const,
    adapterEligible: false as const,
    ownerAuthorityChanged: false as const,
    passBPerformed: false as const,
    reconciliationPerformed: false as const,
  }
  assert(basis.counts.distinctPassages === EXPECTED_RECORD_COUNT, "turkish_rendering_global_passage_diversity")
  return { ...basis, artifactSha256: canonicalSha256(basis) }
}

export function validateRenderingArtifact(artifact: RenderingArtifact): void {
  assert(artifact.schemaVersion === "dna-external-science-turkish-rendering-pass-a-artifact@1", "turkish_rendering_artifact_schema")
  assert(artifact.passVersion === TURKISH_RENDERING_PASS_A_VERSION, "turkish_rendering_artifact_version")
  assert(artifact.status === "feasibility_fidelity_pilot", "turkish_rendering_artifact_status")
  assert(artifact.authorityClass === "external_science_candidate", "turkish_rendering_artifact_authority")
  assert(artifact.runtimeEligible === false && artifact.releaseEligible === false, "turkish_rendering_artifact_release_boundary")
  assert(artifact.activationAllowed === false && artifact.adapterEligible === false, "turkish_rendering_artifact_activation_boundary")
  assert(artifact.ownerAuthorityChanged === false, "turkish_rendering_artifact_owner_boundary")
  assert(artifact.passBPerformed === false && artifact.reconciliationPerformed === false, "turkish_rendering_artifact_pass_boundary")
  assert(artifact.records.length === EXPECTED_RECORD_COUNT, "turkish_rendering_artifact_record_count")
  assert(artifact.topicCoverage.length === EXPECTED_TOPIC_COUNT, "turkish_rendering_artifact_topic_count")
  assert(artifact.qaFailureCounts.totalFailures === 0 && artifact.qaFailureCounts.recordsWithAnyFailure === 0, "turkish_rendering_artifact_qa_failures")
  for (const record of artifact.records) {
    assert(record.runtimeEligible === false && record.releaseEligible === false, "turkish_rendering_record_boundary")
    assert(record.provenance === "codex_translation_pass_a_not_independent_human_review", "turkish_rendering_record_provenance")
    assert(record.checks.allPassed === true, "turkish_rendering_record_qa_failure")
    assertSha(record.recordSha256, "turkish_rendering_record_hash_invalid")
    assert(canonicalSha256(withoutKey(record as unknown as JsonRecord, "recordSha256")) === record.recordSha256, "turkish_rendering_record_hash_mismatch")
  }
  assertSha(artifact.artifactSha256, "turkish_rendering_artifact_hash_invalid")
  assert(canonicalSha256(withoutKey(artifact as unknown as JsonRecord, "artifactSha256")) === artifact.artifactSha256, "turkish_rendering_artifact_hash_mismatch")
}

function buildPublicManifest(artifact: RenderingArtifact, raw: { sha256: string; bytes: number; mode: number }): JsonRecord {
  const manifest: JsonRecord = {
    schemaVersion: "dna-external-science-turkish-rendering-pass-a-manifest@1",
    recordedAt: artifact.basisAt,
    passVersion: artifact.passVersion,
    artifactSha256: artifact.artifactSha256,
    rawArtifactFileSha256: raw.sha256,
    rawArtifactBytes: raw.bytes,
    rawArtifactMode: raw.mode.toString(8),
    candidatePackageSha256: artifact.candidatePackageSha256,
    candidateFileSha256: artifact.candidateFileSha256,
    decisionsSha256: artifact.decisionsSha256,
    decisionsFileSha256: artifact.decisionsFileSha256,
    counts: artifact.counts,
    topicCoverage: artifact.topicCoverage,
    qaFailureCounts: artifact.qaFailureCounts,
    limitations: artifact.limitations,
    boundary: {
      status: artifact.status,
      runtimeEligible: false,
      releaseEligible: false,
      activationAllowed: false,
      adapterEligible: false,
      ownerAuthorityChanged: false,
      passBPerformed: false,
      reconciliationPerformed: false,
      provenance: artifact.provenance,
    },
  }
  return { ...manifest, manifestSha256: canonicalSha256(manifest) }
}

function assertPublicManifestHasNoText(
  manifest: JsonRecord,
  candidate: CandidatePackage,
  decisions: TranslationDecisions,
): void {
  const serialized = JSON.stringify(manifest)
  for (const forbiddenKey of ["proposition", "renderingTr", "originalText", "content"]) {
    assert(!serialized.includes(`\"${forbiddenKey}\"`), "turkish_rendering_manifest_forbidden_key")
  }
  for (const value of [
    ...candidate.claims.map((claim) => claim.proposition),
    ...candidate.passages.map((passage) => passage.originalText),
    ...decisions.decisions.map((decision) => decision.renderingTr),
  ]) {
    if (value.length >= 20) assert(!serialized.includes(value), "turkish_rendering_manifest_text_leak")
  }
}

export function sealDecisions(researchRootInput: string): { records: number; decisionsSha256: string; fileSha256: string } {
  const researchRoot = resolveSecureRoot(researchRootInput, true)
  const candidateInput = resolveReadableFile(researchRoot, CANDIDATE_RELATIVE_PATH, false)
  const candidate = JSON.parse(candidateInput.bytes.toString("utf8")) as CandidatePackage
  validateCandidate(candidate)
  const decisionInput = resolveReadableFile(researchRoot, DECISIONS_RELATIVE_PATH, false)
  const decisions = JSON.parse(decisionInput.bytes.toString("utf8")) as TranslationDecisions
  validateDecisions(decisions, candidate, true)
  const sealed: TranslationDecisions = {
    ...decisions,
    decisionsSha256: canonicalSha256(withoutKey(decisions as unknown as JsonRecord, "decisionsSha256")),
  }
  validateDecisions(sealed, candidate)
  const serialized = `${JSON.stringify(sealed, null, 2)}\n`
  const written = secureAtomicWriteFile(researchRoot, join(researchRoot, DECISIONS_RELATIVE_PATH), serialized)
  return { records: sealed.decisions.length, decisionsSha256: sealed.decisionsSha256, fileSha256: written.sha256 }
}

export function loadPilotInputs(researchRootInput: string): PilotInputs {
  const researchRoot = resolveSecureRoot(researchRootInput, true)
  const candidateInput = resolveReadableFile(researchRoot, CANDIDATE_RELATIVE_PATH, false)
  const candidate = JSON.parse(candidateInput.bytes.toString("utf8")) as CandidatePackage
  validateCandidate(candidate)
  const decisionsInput = resolveReadableFile(researchRoot, DECISIONS_RELATIVE_PATH, true)
  const decisions = JSON.parse(decisionsInput.bytes.toString("utf8")) as TranslationDecisions
  validateDecisions(decisions, candidate)
  return {
    researchRoot,
    candidate,
    candidateFileSha256: candidateInput.sha256,
    decisions,
    decisionsFileSha256: decisionsInput.sha256,
  }
}

export function runRenderingPassA(options: { researchRoot: string; writeManifest: boolean }): {
  artifact: RenderingArtifact
  manifest: JsonRecord
  raw: { sha256: string; bytes: number; mode: number }
} {
  const inputs = loadPilotInputs(options.researchRoot)
  const first = buildRenderingArtifact(inputs)
  validateRenderingArtifact(first)
  const expectedHash = first.artifactSha256
  for (let index = 1; index < 20; index += 1) {
    const next = buildRenderingArtifact(inputs)
    validateRenderingArtifact(next)
    assert(next.artifactSha256 === expectedHash, "turkish_rendering_determinism_mismatch")
    assert(JSON.stringify(next) === JSON.stringify(first), "turkish_rendering_determinism_bytes_mismatch")
  }
  const serialized = `${JSON.stringify(first, null, 2)}\n`
  const raw = secureAtomicWriteFile(inputs.researchRoot, join(inputs.researchRoot, RAW_OUTPUT_RELATIVE_PATH), serialized)
  verifySecureFile(inputs.researchRoot, join(inputs.researchRoot, RAW_OUTPUT_RELATIVE_PATH), serialized)
  const manifest = buildPublicManifest(first, raw)
  assertPublicManifestHasNoText(manifest, inputs.candidate, inputs.decisions)
  if (options.writeManifest) {
    const repoRoot = resolveSecureRoot(process.cwd())
    secureAtomicWriteFile(repoRoot, join(repoRoot, REPO_MANIFEST_RELATIVE_PATH), `${JSON.stringify(manifest, null, 2)}\n`)
  } else {
    const path = resolve(REPO_MANIFEST_RELATIVE_PATH)
    assert(existsSync(path), "turkish_rendering_manifest_missing")
    const recorded = readJsonFile(path) as JsonRecord
    assert(JSON.stringify(recorded) === JSON.stringify(manifest), "turkish_rendering_manifest_stale")
  }
  return { artifact: first, manifest, raw }
}

function main(): void {
  const researchRoot = process.env.RESEARCH_SSD_ROOT ?? "/Volumes/ResearchSSD"
  const args = new Set(process.argv.slice(2))
  for (const argument of args) {
    assert(["--seal-decisions", "--write-manifest"].includes(argument), "turkish_rendering_unknown_argument")
  }
  if (args.has("--seal-decisions")) {
    assert(!args.has("--write-manifest"), "turkish_rendering_seal_mode_conflict")
    const sealed = sealDecisions(researchRoot)
    process.stdout.write(`${JSON.stringify({ ok: true, sealed: true, ...sealed })}\n`)
    return
  }
  const result = runRenderingPassA({ researchRoot, writeManifest: args.has("--write-manifest") })
  process.stdout.write(`${JSON.stringify({
    ok: true,
    passVersion: result.artifact.passVersion,
    artifactSha256: result.artifact.artifactSha256,
    rawArtifactFileSha256: result.raw.sha256,
    counts: result.artifact.counts,
    qaFailureCounts: result.artifact.qaFailureCounts,
    boundary: {
      runtimeEligible: false,
      releaseEligible: false,
      passBPerformed: false,
      reconciliationPerformed: false,
    },
  })}\n`)
}

if (require.main === module) main()

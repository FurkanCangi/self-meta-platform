import { createHash } from "node:crypto"

import {
  isDnaCandidateClaimReconciliationResultValid,
  type DnaCandidateClaimReconciliationResult,
} from "./candidateClaimReconciliation"
import {
  isDnaCandidatePassageRegistrationResultValid,
  type DnaCandidatePassageRegistrationResult,
} from "./candidatePassageRegistration"
import {
  applyDnaClaimRereview,
  commitDnaEvidenceSubject,
  type DnaClaimRereviewResolution,
  type DnaParsedArtifact,
  type DnaRereviewedClaimReconciliation,
} from "./evidenceExtraction"

export const DNA_CANDIDATE_CLAIM_REREVIEW_DECISION_VERSION =
  "dna-candidate-claim-rereview-decision@1" as const
export const DNA_CANDIDATE_CLAIM_REREVIEW_RESULT_VERSION =
  "dna-candidate-claim-rereview-result@1" as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,199}$/

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort((left, right) => left.localeCompare(right, "en"))
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`
}

export function hashDnaCandidateClaimRereviewPayload(value: unknown): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex")
}

function exactKeys(value: unknown, expected: readonly string[], code: string): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code)
  const actual = Object.keys(value as Record<string, unknown>)
    .sort((left, right) => left.localeCompare(right, "en"))
  const wanted = [...expected].sort((left, right) => left.localeCompare(right, "en"))
  if (actual.length !== wanted.length
    || actual.some((key, index) => key !== wanted[index])) throw new Error(code)
}

function assertId(value: string, code: string): void {
  if (!IDENTIFIER_PATTERN.test(String(value || ""))) throw new Error(code)
}

function assertSha(value: string, code: string): void {
  if (!SHA256_PATTERN.test(String(value || ""))) throw new Error(code)
}

function assertIso(value: string, code: string): void {
  const time = Date.parse(String(value || ""))
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) throw new Error(code)
}

export type DnaCandidateClaimRereviewDecision = Readonly<{
  schemaVersion: typeof DNA_CANDIDATE_CLAIM_REREVIEW_DECISION_VERSION
  decisionId: string
  sourceId: string
  reconciliationResultSha256: string
  reconciliationResultFileSha256: string
  passageRegistrationResultSha256: string
  passageRegistrationResultFileSha256: string
  reviewedAt: string
  reviewerId: string
  authorityClass: "codex_rereview_not_independent_human_review"
  status: "candidate_only"
  runtimeEligible: false
  releaseEligible: false
  resolutions: readonly DnaClaimRereviewResolution[]
  decisionSha256: string
}>

export type DnaCandidateClaimRereviewResult = Readonly<{
  schemaVersion: typeof DNA_CANDIDATE_CLAIM_REREVIEW_RESULT_VERSION
  sourceId: string
  status: "candidate_only"
  runtimeEligible: false
  releaseEligible: false
  registryStatus: "not_registered"
  decisionSha256: string
  reconciliationResultSha256: string
  passageRegistrationResultSha256: string
  rereviews: readonly DnaRereviewedClaimReconciliation[]
  counts: Readonly<{
    consensus: number
    contested: number
    quarantined: number
    runtimeEligible: 0
    releaseEligible: 0
  }>
  resultSha256: string
}>

const DECISION_KEYS = Object.freeze([
  "schemaVersion", "decisionId", "sourceId", "reconciliationResultSha256",
  "reconciliationResultFileSha256", "passageRegistrationResultSha256",
  "passageRegistrationResultFileSha256", "reviewedAt", "reviewerId",
  "authorityClass", "status", "runtimeEligible", "releaseEligible", "resolutions",
  "decisionSha256",
] as const)

const RESOLUTION_KEYS = Object.freeze([
  "protocolId", "reviewId", "reviewedAt", "sourceId", "artifactSha256",
  "reconciliationSha256", "decision", "rereadPassageIds", "resolved",
  "evidenceSha256", "rationaleCode",
] as const)

const RESULT_KEYS = Object.freeze([
  "schemaVersion", "sourceId", "status", "runtimeEligible", "releaseEligible",
  "registryStatus", "decisionSha256", "reconciliationResultSha256",
  "passageRegistrationResultSha256", "rereviews", "counts", "resultSha256",
] as const)

export function assertDnaCandidateClaimRereviewDecision(
  decision: DnaCandidateClaimRereviewDecision,
): void {
  exactKeys(decision, DECISION_KEYS, "candidate_claim_rereview_decision_shape_invalid")
  if (decision.schemaVersion !== DNA_CANDIDATE_CLAIM_REREVIEW_DECISION_VERSION
    || decision.authorityClass !== "codex_rereview_not_independent_human_review"
    || decision.status !== "candidate_only"
    || decision.runtimeEligible !== false
    || decision.releaseEligible !== false
    || !Array.isArray(decision.resolutions)
    || decision.resolutions.length < 1) {
    throw new Error("candidate_claim_rereview_decision_state_invalid")
  }
  for (const value of [decision.decisionId, decision.sourceId, decision.reviewerId]) {
    assertId(value, "candidate_claim_rereview_decision_id_invalid")
  }
  for (const value of [
    decision.reconciliationResultSha256,
    decision.reconciliationResultFileSha256,
    decision.passageRegistrationResultSha256,
    decision.passageRegistrationResultFileSha256,
    decision.decisionSha256,
  ]) assertSha(value, "candidate_claim_rereview_decision_hash_invalid")
  assertIso(decision.reviewedAt, "candidate_claim_rereview_reviewed_at_invalid")
  const reconciliationHashes = new Set<string>()
  const reviewIds = new Set<string>()
  for (const resolution of decision.resolutions) {
    exactKeys(resolution, RESOLUTION_KEYS, "candidate_claim_rereview_resolution_shape_invalid")
    assertId(resolution.reviewId, "candidate_claim_rereview_resolution_id_invalid")
    assertIso(resolution.reviewedAt, "candidate_claim_rereview_resolution_time_invalid")
    assertSha(resolution.artifactSha256,
      "candidate_claim_rereview_resolution_artifact_hash_invalid")
    assertSha(resolution.reconciliationSha256,
      "candidate_claim_rereview_resolution_reconciliation_hash_invalid")
    assertSha(resolution.evidenceSha256,
      "candidate_claim_rereview_resolution_evidence_hash_invalid")
    if (resolution.protocolId !== "dna-claim-rereview@1"
      || resolution.sourceId !== decision.sourceId
      || Date.parse(resolution.reviewedAt) > Date.parse(decision.reviewedAt)
      || reconciliationHashes.has(resolution.reconciliationSha256)
      || reviewIds.has(resolution.reviewId)) {
      throw new Error("candidate_claim_rereview_resolution_binding_or_duplicate")
    }
    reconciliationHashes.add(resolution.reconciliationSha256)
    reviewIds.add(resolution.reviewId)
  }
  const { decisionSha256, ...payload } = decision
  if (decisionSha256 !== hashDnaCandidateClaimRereviewPayload(payload)) {
    throw new Error("candidate_claim_rereview_decision_hash_mismatch")
  }
}

export function compileDnaCandidateClaimRereview(input: Readonly<{
  decision: DnaCandidateClaimRereviewDecision
  reconciliationResult: DnaCandidateClaimReconciliationResult
  reconciliationResultFileSha256: string
  passageRegistrationResult: DnaCandidatePassageRegistrationResult
  passageRegistrationResultFileSha256: string
  parsedArtifact: DnaParsedArtifact
}>): DnaCandidateClaimRereviewResult {
  assertDnaCandidateClaimRereviewDecision(input.decision)
  if (!isDnaCandidateClaimReconciliationResultValid(input.reconciliationResult)
    || !isDnaCandidatePassageRegistrationResultValid(input.passageRegistrationResult)) {
    throw new Error("candidate_claim_rereview_upstream_result_invalid")
  }
  const { decision, reconciliationResult, passageRegistrationResult } = input
  if (decision.sourceId !== reconciliationResult.sourceId
    || decision.sourceId !== passageRegistrationResult.sourceId
    || decision.reconciliationResultSha256 !== reconciliationResult.resultSha256
    || decision.reconciliationResultFileSha256 !== input.reconciliationResultFileSha256
    || decision.passageRegistrationResultSha256 !== passageRegistrationResult.resultSha256
    || decision.passageRegistrationResultFileSha256
      !== input.passageRegistrationResultFileSha256
    || input.parsedArtifact.sourceId !== decision.sourceId
    || input.parsedArtifact.artifactSha256 !== passageRegistrationResult.artifactSha256) {
    throw new Error("candidate_claim_rereview_input_binding_mismatch")
  }
  const eligible = reconciliationResult.reconciliations.filter((entry) =>
    entry.status === "contested" || entry.status === "quarantined")
  const expected = eligible.map((entry) => entry.reconciliationSha256).sort()
  const received = decision.resolutions.map((entry) => entry.reconciliationSha256).sort()
  if (stableJson(expected) !== stableJson(received)) {
    throw new Error("candidate_claim_rereview_incomplete_nonconsensus_coverage")
  }
  const byHash = new Map(eligible.map((entry) => [entry.reconciliationSha256, entry]))
  const rereviews = decision.resolutions.map((resolution) => {
    const reconciliation = byHash.get(resolution.reconciliationSha256)
    if (!reconciliation) throw new Error("candidate_claim_rereview_reconciliation_missing")
    return applyDnaClaimRereview({
      reconciliation,
      resolution,
      passages: passageRegistrationResult.passages,
      parsedArtifact: input.parsedArtifact,
      trustRegistry: passageRegistrationResult.candidateTrustRegistry,
    })
  })
  const counts = {
    consensus: rereviews.filter((entry) => entry.status === "rereview_consensus_candidate").length,
    contested: rereviews.filter((entry) => entry.status === "contested").length,
    quarantined: rereviews.filter((entry) => entry.status === "quarantined").length,
    runtimeEligible: 0 as const,
    releaseEligible: 0 as const,
  }
  const payload = {
    schemaVersion: DNA_CANDIDATE_CLAIM_REREVIEW_RESULT_VERSION,
    sourceId: decision.sourceId,
    status: "candidate_only" as const,
    runtimeEligible: false as const,
    releaseEligible: false as const,
    registryStatus: "not_registered" as const,
    decisionSha256: decision.decisionSha256,
    reconciliationResultSha256: reconciliationResult.resultSha256,
    passageRegistrationResultSha256: passageRegistrationResult.resultSha256,
    rereviews,
    counts,
  }
  return Object.freeze({
    ...payload,
    resultSha256: hashDnaCandidateClaimRereviewPayload(payload),
  })
}

export function isDnaCandidateClaimRereviewResultValid(
  result: DnaCandidateClaimRereviewResult,
): boolean {
  try {
    exactKeys(result, RESULT_KEYS, "candidate_claim_rereview_result_shape_invalid")
    if (result.schemaVersion !== DNA_CANDIDATE_CLAIM_REREVIEW_RESULT_VERSION
      || result.status !== "candidate_only"
      || result.runtimeEligible !== false
      || result.releaseEligible !== false
      || result.registryStatus !== "not_registered"
      || result.rereviews.length < 1
      || result.counts.consensus !== result.rereviews.filter((entry) =>
        entry.status === "rereview_consensus_candidate").length
      || result.counts.contested !== result.rereviews.filter((entry) =>
        entry.status === "contested").length
      || result.counts.quarantined !== result.rereviews.filter((entry) =>
        entry.status === "quarantined").length
      || result.counts.runtimeEligible !== 0
      || result.counts.releaseEligible !== 0) return false
    for (const value of [result.decisionSha256, result.reconciliationResultSha256,
      result.passageRegistrationResultSha256, result.resultSha256]) {
      assertSha(value, "candidate_claim_rereview_result_hash_invalid")
    }
    if (!result.rereviews.every((entry) => {
      const { rereviewSha256, ...payload } = entry
      return rereviewSha256 === commitDnaEvidenceSubject(payload)
        && entry.runtimeEligible === false
        && entry.registryStatus === "not_registered"
    })) return false
    const { resultSha256, ...payload } = result
    return resultSha256 === hashDnaCandidateClaimRereviewPayload(payload)
  } catch {
    return false
  }
}

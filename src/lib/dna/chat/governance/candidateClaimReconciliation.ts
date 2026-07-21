import { createHash } from "node:crypto"

import {
  isDnaCandidateClaimExtractionResultValid,
  type DnaCandidateClaimExtractionResult,
} from "./candidateClaimExtraction"
import {
  commitDnaEvidenceSubject,
  reconcileDnaBlindClaims,
  type DnaClaimReconciliation,
} from "./evidenceExtraction"

export const DNA_CANDIDATE_CLAIM_RECONCILIATION_DECISION_VERSION =
  "dna-candidate-claim-reconciliation-decision@1" as const
export const DNA_CANDIDATE_CLAIM_RECONCILIATION_RESULT_VERSION =
  "dna-candidate-claim-reconciliation-result@1" as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,199}$/

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort((left, right) => left.localeCompare(right, "en"))
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`
}

export function hashDnaCandidateClaimReconciliationPayload(value: unknown): string {
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

export type DnaCandidateClaimPair = Readonly<{
  pairId: string
  claimAId: string
  claimBId: string
}>

export type DnaCandidateUnmatchedClaim = Readonly<{
  claimId: string
  reasonCode: "no_peer_match" | "different_atomic_granularity" | "support_boundary_mismatch"
  rationale: string
}>

export type DnaCandidateClaimReconciliationDecision = Readonly<{
  schemaVersion: typeof DNA_CANDIDATE_CLAIM_RECONCILIATION_DECISION_VERSION
  decisionId: string
  sourceId: string
  passAResultSha256: string
  passAResultFileSha256: string
  passBResultSha256: string
  passBResultFileSha256: string
  reviewedAt: string
  reviewerId: string
  authorityClass: "codex_reconciliation_not_independent_human_review"
  status: "candidate_only"
  runtimeEligible: false
  releaseEligible: false
  pairs: readonly DnaCandidateClaimPair[]
  unmatchedA: readonly DnaCandidateUnmatchedClaim[]
  unmatchedB: readonly DnaCandidateUnmatchedClaim[]
  decisionSha256: string
}>

export type DnaCandidateClaimReconciliationResult = Readonly<{
  schemaVersion: typeof DNA_CANDIDATE_CLAIM_RECONCILIATION_RESULT_VERSION
  status: "candidate_only"
  runtimeEligible: false
  releaseEligible: false
  registryStatus: "not_registered"
  sourceId: string
  decisionSha256: string
  passAResultSha256: string
  passBResultSha256: string
  reconciliations: readonly DnaClaimReconciliation[]
  unmatchedA: readonly DnaCandidateUnmatchedClaim[]
  unmatchedB: readonly DnaCandidateUnmatchedClaim[]
  counts: Readonly<{
    exactConsensus: number
    contested: number
    quarantined: number
    unmatchedA: number
    unmatchedB: number
  }>
  resultSha256: string
}>

const DECISION_KEYS = Object.freeze([
  "schemaVersion", "decisionId", "sourceId", "passAResultSha256",
  "passAResultFileSha256", "passBResultSha256", "passBResultFileSha256",
  "reviewedAt", "reviewerId", "authorityClass", "status", "runtimeEligible",
  "releaseEligible", "pairs", "unmatchedA", "unmatchedB", "decisionSha256",
] as const)
const PAIR_KEYS = Object.freeze(["pairId", "claimAId", "claimBId"] as const)
const UNMATCHED_KEYS = Object.freeze(["claimId", "reasonCode", "rationale"] as const)
const RESULT_KEYS = Object.freeze([
  "schemaVersion", "status", "runtimeEligible", "releaseEligible", "registryStatus",
  "sourceId", "decisionSha256", "passAResultSha256", "passBResultSha256",
  "reconciliations", "unmatchedA", "unmatchedB", "counts", "resultSha256",
] as const)

function assertUnmatched(value: DnaCandidateUnmatchedClaim): void {
  exactKeys(value, UNMATCHED_KEYS, "candidate_claim_reconciliation_unmatched_shape_invalid")
  assertId(value.claimId, "candidate_claim_reconciliation_unmatched_id_invalid")
  if (!["no_peer_match", "different_atomic_granularity", "support_boundary_mismatch"]
    .includes(value.reasonCode)
    || value.rationale.trim().length < 20 || value.rationale.length > 1200) {
    throw new Error("candidate_claim_reconciliation_unmatched_reason_invalid")
  }
}

export function assertDnaCandidateClaimReconciliationDecision(
  decision: DnaCandidateClaimReconciliationDecision,
): void {
  exactKeys(decision, DECISION_KEYS, "candidate_claim_reconciliation_decision_shape_invalid")
  if (decision.schemaVersion !== DNA_CANDIDATE_CLAIM_RECONCILIATION_DECISION_VERSION
    || decision.authorityClass !== "codex_reconciliation_not_independent_human_review"
    || decision.status !== "candidate_only"
    || decision.runtimeEligible !== false
    || decision.releaseEligible !== false
    || !Array.isArray(decision.pairs)
    || !Array.isArray(decision.unmatchedA)
    || !Array.isArray(decision.unmatchedB)
    || decision.pairs.length + decision.unmatchedA.length + decision.unmatchedB.length < 1) {
    throw new Error("candidate_claim_reconciliation_decision_state_invalid")
  }
  for (const value of [decision.decisionId, decision.sourceId, decision.reviewerId]) {
    assertId(value, "candidate_claim_reconciliation_decision_id_invalid")
  }
  for (const value of [decision.passAResultSha256, decision.passAResultFileSha256,
    decision.passBResultSha256, decision.passBResultFileSha256,
    decision.decisionSha256]) {
    assertSha(value, "candidate_claim_reconciliation_decision_hash_invalid")
  }
  assertIso(decision.reviewedAt, "candidate_claim_reconciliation_reviewed_at_invalid")
  const pairIds = new Set<string>()
  const claimAIds = new Set<string>()
  const claimBIds = new Set<string>()
  for (const pair of decision.pairs) {
    exactKeys(pair, PAIR_KEYS, "candidate_claim_reconciliation_pair_shape_invalid")
    for (const value of [pair.pairId, pair.claimAId, pair.claimBId]) {
      assertId(value, "candidate_claim_reconciliation_pair_id_invalid")
    }
    if (pairIds.has(pair.pairId) || claimAIds.has(pair.claimAId)
      || claimBIds.has(pair.claimBId)) {
      throw new Error("candidate_claim_reconciliation_duplicate_pairing")
    }
    pairIds.add(pair.pairId)
    claimAIds.add(pair.claimAId)
    claimBIds.add(pair.claimBId)
  }
  for (const unmatched of decision.unmatchedA) {
    assertUnmatched(unmatched)
    if (claimAIds.has(unmatched.claimId)) {
      throw new Error("candidate_claim_reconciliation_claim_a_covered_twice")
    }
    claimAIds.add(unmatched.claimId)
  }
  for (const unmatched of decision.unmatchedB) {
    assertUnmatched(unmatched)
    if (claimBIds.has(unmatched.claimId)) {
      throw new Error("candidate_claim_reconciliation_claim_b_covered_twice")
    }
    claimBIds.add(unmatched.claimId)
  }
  const { decisionSha256, ...payload } = decision
  if (decisionSha256 !== hashDnaCandidateClaimReconciliationPayload(payload)) {
    throw new Error("candidate_claim_reconciliation_decision_hash_mismatch")
  }
}

export function compileDnaCandidateClaimReconciliation(input: Readonly<{
  decision: DnaCandidateClaimReconciliationDecision
  passAResult: DnaCandidateClaimExtractionResult
  passAResultFileSha256: string
  passBResult: DnaCandidateClaimExtractionResult
  passBResultFileSha256: string
}>): DnaCandidateClaimReconciliationResult {
  assertDnaCandidateClaimReconciliationDecision(input.decision)
  if (!isDnaCandidateClaimExtractionResultValid(input.passAResult)
    || !isDnaCandidateClaimExtractionResultValid(input.passBResult)) {
    throw new Error("candidate_claim_reconciliation_run_result_invalid")
  }
  const { decision, passAResult, passBResult } = input
  if (passAResult.lane !== "A" || passBResult.lane !== "B"
    || decision.sourceId !== passAResult.sourceId
    || decision.sourceId !== passBResult.sourceId
    || decision.passAResultSha256 !== passAResult.resultSha256
    || decision.passBResultSha256 !== passBResult.resultSha256
    || decision.passAResultFileSha256 !== input.passAResultFileSha256
    || decision.passBResultFileSha256 !== input.passBResultFileSha256
    || passAResult.passageRegistrationResultSha256
      !== passBResult.passageRegistrationResultSha256) {
    throw new Error("candidate_claim_reconciliation_input_binding_mismatch")
  }
  const coveredA = new Set([
    ...decision.pairs.map((pair) => pair.claimAId),
    ...decision.unmatchedA.map((claim) => claim.claimId),
  ])
  const coveredB = new Set([
    ...decision.pairs.map((pair) => pair.claimBId),
    ...decision.unmatchedB.map((claim) => claim.claimId),
  ])
  const expectedA = new Set(passAResult.run.claims.map((claim) => claim.claimId))
  const expectedB = new Set(passBResult.run.claims.map((claim) => claim.claimId))
  if (stableJson([...coveredA].sort()) !== stableJson([...expectedA].sort())
    || stableJson([...coveredB].sort()) !== stableJson([...expectedB].sort())) {
    throw new Error("candidate_claim_reconciliation_incomplete_claim_coverage")
  }
  const reconciliations = decision.pairs.map((pair) => reconcileDnaBlindClaims({
    reconciliationId: pair.pairId,
    runA: passAResult.run,
    claimAId: pair.claimAId,
    runB: passBResult.run,
    claimBId: pair.claimBId,
  }))
  const payload = {
    schemaVersion: DNA_CANDIDATE_CLAIM_RECONCILIATION_RESULT_VERSION,
    status: "candidate_only" as const,
    runtimeEligible: false as const,
    releaseEligible: false as const,
    registryStatus: "not_registered" as const,
    sourceId: decision.sourceId,
    decisionSha256: decision.decisionSha256,
    passAResultSha256: passAResult.resultSha256,
    passBResultSha256: passBResult.resultSha256,
    reconciliations,
    unmatchedA: decision.unmatchedA,
    unmatchedB: decision.unmatchedB,
    counts: {
      exactConsensus: reconciliations.filter((entry) =>
        entry.status === "exact_consensus_candidate").length,
      contested: reconciliations.filter((entry) => entry.status === "contested").length,
      quarantined: reconciliations.filter((entry) => entry.status === "quarantined").length,
      unmatchedA: decision.unmatchedA.length,
      unmatchedB: decision.unmatchedB.length,
    },
  }
  return Object.freeze({
    ...payload,
    resultSha256: hashDnaCandidateClaimReconciliationPayload(payload),
  })
}

export function isDnaCandidateClaimReconciliationResultValid(
  result: DnaCandidateClaimReconciliationResult,
): boolean {
  try {
    exactKeys(result, RESULT_KEYS, "candidate_claim_reconciliation_result_shape_invalid")
    if (result.schemaVersion !== DNA_CANDIDATE_CLAIM_RECONCILIATION_RESULT_VERSION
      || result.status !== "candidate_only"
      || result.runtimeEligible !== false
      || result.releaseEligible !== false
      || result.registryStatus !== "not_registered"
      || result.counts.exactConsensus !== result.reconciliations.filter((entry) =>
        entry.status === "exact_consensus_candidate").length
      || result.counts.contested !== result.reconciliations.filter((entry) =>
        entry.status === "contested").length
      || result.counts.quarantined !== result.reconciliations.filter((entry) =>
        entry.status === "quarantined").length
      || result.counts.unmatchedA !== result.unmatchedA.length
      || result.counts.unmatchedB !== result.unmatchedB.length) return false
    for (const value of [result.decisionSha256, result.passAResultSha256,
      result.passBResultSha256, result.resultSha256]) assertSha(value,
      "candidate_claim_reconciliation_result_hash_invalid")
    const { resultSha256, ...payload } = result
    return resultSha256 === hashDnaCandidateClaimReconciliationPayload(payload)
      && result.reconciliations.every((entry) => {
        const { reconciliationSha256, ...core } = entry
        return reconciliationSha256 === commitDnaEvidenceSubject(core)
      })
  } catch {
    return false
  }
}

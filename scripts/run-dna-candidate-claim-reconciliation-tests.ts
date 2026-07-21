import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  compileDnaCandidateClaimExtraction,
  createDnaCandidateClaimReviewPacket,
  hashDnaCandidateClaimPayload,
  type DnaCandidateClaimExtractionDecision,
  type DnaCandidateClaimReviewPacket,
} from "../src/lib/dna/chat/governance/candidateClaimExtraction"
import {
  assertDnaCandidateClaimReconciliationDecision,
  compileDnaCandidateClaimReconciliation,
  hashDnaCandidateClaimReconciliationPayload,
  isDnaCandidateClaimReconciliationResultValid,
  type DnaCandidateClaimReconciliationDecision,
} from "../src/lib/dna/chat/governance/candidateClaimReconciliation"
import type {
  DnaCandidatePassageRegistrationResult,
} from "../src/lib/dna/chat/governance/candidatePassageRegistration"
import {
  commitDnaEvidenceSubject,
  type DnaAtomicClaimDraft,
  type DnaBlindExtractionLane,
} from "../src/lib/dna/chat/governance/evidenceExtraction"
import type {
  DnaMethodAppraisalRegistrationResult,
} from "../src/lib/dna/chat/governance/methodAppraisalRegistration"
import {
  loadDnaCandidatePassageSourceAuthority,
} from "./run-dna-candidate-passage-registration-worker"

const researchRoot = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const sourceId = "prisma-cosmin-omis-2024"
const passageRoot = join(researchRoot,
  "Datasets/DNA-Intelligence/work/v3/candidate-passage-registrations/v1")
const methodRoot = join(researchRoot,
  "Datasets/DNA-Intelligence/work/v3/method-appraisal-registrations/v1")
const passageResultPath = join(passageRoot, "sources", sourceId, "result.json")
const methodResultPath = join(methodRoot, "sources", sourceId, "result.json")

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function fileSha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function jsonFileSha256(value: unknown): string {
  return createHash("sha256")
    .update(`${JSON.stringify(value, null, 2)}\n`, "utf8").digest("hex")
}

const passageResult = readJson<DnaCandidatePassageRegistrationResult>(passageResultPath)
const methodResult = readJson<DnaMethodAppraisalRegistrationResult>(methodResultPath)
const authority = loadDnaCandidatePassageSourceAuthority(researchRoot, sourceId)
const passageResultFileSha256 = fileSha256(passageResultPath)
const passage = passageResult.passages.find((entry) => entry.id.endsWith(":007"))!
assert.ok(passage, "candidate_claim_reconciliation_fixture_passage_missing")

const proposition = "PRISMA-COSMIN for OMIs 2024 is intended to guide the reporting of systematic reviews of OMIs, in which at least one measurement property of at least one OMI is evaluated."
assert.ok(passage.originalText.includes(proposition))

function makeClaim(lane: DnaBlindExtractionLane): DnaAtomicClaimDraft {
  return {
    claimId: `candidate.claim:${sourceId}:scope:001:${lane}`,
    claimType: "interpretation_boundary",
    proposition,
    population: "not_applicable",
    ageScope: passage.ageScope,
    setting: "not_reported",
    measure: null,
    comparator: null,
    outcome: "systematic review reporting scope",
    direction: "not_applicable",
    effectMagnitude: {
      kind: "not_reported",
      metric: null,
      value: null,
      qualifier: "not_reported",
    },
    effectEvidence: null,
    uncertainty: {
      level: "moderate",
      text: "This statement defines reporting scope and does not establish clinical effectiveness.",
    },
    studyDesign: "guideline_or_consensus",
    evidenceLevel: "not_assessed",
    evidenceLevelEvidence: null,
    passageIds: [passage.id],
    causalStatus: "descriptive",
    claimBoundary: passage.claimBoundary,
    dnaRelationship: "none",
    conflictSetId: null,
  }
}

function makeExtractionDecision(
  lane: DnaBlindExtractionLane,
  packet: DnaCandidateClaimReviewPacket,
): DnaCandidateClaimExtractionDecision {
  const claim = makeClaim(lane)
  const rationaleCore = {
    claimId: claim.claimId,
    passageIds: [...claim.passageIds],
    rationale: "The proposition is one verbatim scope sentence from the selected passage.",
    uncertaintyEvidence: "The source is a reporting guideline and cannot establish clinical effectiveness.",
  }
  const payload: Omit<DnaCandidateClaimExtractionDecision, "decisionSha256"> = {
    schemaVersion: "dna-candidate-claim-extraction-decision@1",
    decisionId: `candidate.claim.decision:${sourceId}:${lane}:reconciliation-test`,
    runId: `candidate.claim.run:${sourceId}:${lane}:reconciliation-test`,
    lane,
    sourceId,
    packetSha256: packet.packetSha256,
    packetFileSha256: jsonFileSha256(packet),
    passageRegistrationResultSha256: passageResult.resultSha256,
    passageRegistrationResultFileSha256: passageResultFileSha256,
    createdAt: lane === "A"
      ? "2026-07-20T20:00:00.000Z"
      : "2026-07-20T20:01:00.000Z",
    reviewerId: `codex.candidate-claim-${lane.toLowerCase()}`,
    authorityClass: "output_blinded_codex_multi_pass_not_independent",
    peerOutputExcluded: true,
    status: "candidate_only",
    runtimeEligible: false,
    releaseEligible: false,
    claimDrafts: [claim],
    rationales: [{
      ...rationaleCore,
      rationaleSha256: commitDnaEvidenceSubject(rationaleCore),
    }],
  }
  return Object.freeze({
    ...payload,
    decisionSha256: hashDnaCandidateClaimPayload(payload),
  })
}

function compileLane(lane: DnaBlindExtractionLane) {
  const packet = createDnaCandidateClaimReviewPacket({
    lane,
    passageRegistrationResult: passageResult,
    passageRegistrationResultFileSha256: passageResultFileSha256,
    methodRegistrationResult: methodResult,
  })
  return compileDnaCandidateClaimExtraction({
    decision: makeExtractionDecision(lane, packet),
    packet,
    packetFileSha256: jsonFileSha256(packet),
    passageRegistrationResult: passageResult,
    passageRegistrationResultFileSha256: passageResultFileSha256,
    parsedArtifact: authority.parsedArtifact,
  })
}

const passAResult = compileLane("A")
const passBResult = compileLane("B")
const passAResultFileSha256 = jsonFileSha256(passAResult)
const passBResultFileSha256 = jsonFileSha256(passBResult)

function makeReconciliationDecision(
  matched: boolean,
): DnaCandidateClaimReconciliationDecision {
  const payload: Omit<DnaCandidateClaimReconciliationDecision, "decisionSha256"> = {
    schemaVersion: "dna-candidate-claim-reconciliation-decision@1",
    decisionId: `candidate.claim.reconciliation.decision:${sourceId}:${matched ? "matched" : "unmatched"}`,
    sourceId,
    passAResultSha256: passAResult.resultSha256,
    passAResultFileSha256,
    passBResultSha256: passBResult.resultSha256,
    passBResultFileSha256,
    reviewedAt: "2026-07-20T20:02:00.000Z",
    reviewerId: "codex.candidate-claim-reconciler",
    authorityClass: "codex_reconciliation_not_independent_human_review",
    status: "candidate_only",
    runtimeEligible: false,
    releaseEligible: false,
    pairs: matched ? [{
      pairId: `candidate.claim.pair:${sourceId}:001`,
      claimAId: passAResult.run.claims[0]!.claimId,
      claimBId: passBResult.run.claims[0]!.claimId,
    }] : [],
    unmatchedA: matched ? [] : [{
      claimId: passAResult.run.claims[0]!.claimId,
      reasonCode: "no_peer_match",
      rationale: "The reconciliation fixture intentionally leaves this lane A claim unmatched.",
    }],
    unmatchedB: matched ? [] : [{
      claimId: passBResult.run.claims[0]!.claimId,
      reasonCode: "no_peer_match",
      rationale: "The reconciliation fixture intentionally leaves this lane B claim unmatched.",
    }],
  }
  return Object.freeze({
    ...payload,
    decisionSha256: hashDnaCandidateClaimReconciliationPayload(payload),
  })
}

const decision = makeReconciliationDecision(true)
assert.doesNotThrow(() => assertDnaCandidateClaimReconciliationDecision(decision))
const result = compileDnaCandidateClaimReconciliation({
  decision,
  passAResult,
  passAResultFileSha256,
  passBResult,
  passBResultFileSha256,
})
assert.equal(result.reconciliations.length, 1)
assert.equal(result.reconciliations[0]?.status, "exact_consensus_candidate")
assert.equal(result.counts.exactConsensus, 1)
assert.equal(result.runtimeEligible, false)
assert.equal(result.releaseEligible, false)
assert.equal(isDnaCandidateClaimReconciliationResultValid(result), true)
assert.equal(isDnaCandidateClaimReconciliationResultValid({
  ...result,
  resultSha256: "0".repeat(64),
}), false)

const unmatchedResult = compileDnaCandidateClaimReconciliation({
  decision: makeReconciliationDecision(false),
  passAResult,
  passAResultFileSha256,
  passBResult,
  passBResultFileSha256,
})
assert.equal(unmatchedResult.reconciliations.length, 0)
assert.equal(unmatchedResult.counts.unmatchedA, 1)
assert.equal(unmatchedResult.counts.unmatchedB, 1)
assert.equal(isDnaCandidateClaimReconciliationResultValid(unmatchedResult), true)

assert.throws(() => compileDnaCandidateClaimReconciliation({
  decision: {
    ...decision,
    pairs: [],
    decisionSha256: hashDnaCandidateClaimReconciliationPayload({}),
  },
  passAResult,
  passAResultFileSha256,
  passBResult,
  passBResultFileSha256,
}), /candidate_claim_reconciliation_decision_hash_mismatch|candidate_claim_reconciliation_decision_state_invalid/)

console.log(JSON.stringify({
  ok: true,
  sourceId,
  blindLanesBound: true,
  exactConsensusCandidate: result.counts.exactConsensus,
  unmatchedClaimsExplicit: unmatchedResult.counts.unmatchedA
    + unmatchedResult.counts.unmatchedB,
  integrityTamperRejected: true,
  runtimeEligible: 0,
  releaseEligible: 0,
}, null, 2))

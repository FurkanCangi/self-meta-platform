#!/usr/bin/env node

import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  compileDnaCandidateClaimRereview,
  hashDnaCandidateClaimRereviewPayload,
  isDnaCandidateClaimRereviewResultValid,
  type DnaCandidateClaimRereviewDecision,
} from "../src/lib/dna/chat/governance/candidateClaimRereview"
import type { DnaCandidateClaimReconciliationResult } from
  "../src/lib/dna/chat/governance/candidateClaimReconciliation"
import type { DnaCandidatePassageRegistrationResult } from
  "../src/lib/dna/chat/governance/candidatePassageRegistration"
import {
  commitDnaEvidenceSubject,
  type DnaClaimRereviewResolution,
} from "../src/lib/dna/chat/governance/evidenceExtraction"
import { loadDnaCandidatePassageSourceAuthority } from
  "./run-dna-candidate-passage-registration-worker"

const researchRoot = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const sourceId = "hrv-publication-guidelines-2024"
const reconciliationPath = join(researchRoot,
  "Datasets/DNA-Intelligence/work/v3/candidate-claim-reconciliations/v1/sources",
  sourceId, "result.json")
const passagePath = join(researchRoot,
  "Datasets/DNA-Intelligence/work/v3/candidate-passage-registrations/v1/sources",
  sourceId, "result.json")

const reconciliationResult = JSON.parse(readFileSync(reconciliationPath, "utf8")) as
  DnaCandidateClaimReconciliationResult
const passageResult = JSON.parse(readFileSync(passagePath, "utf8")) as
  DnaCandidatePassageRegistrationResult
const authority = loadDnaCandidatePassageSourceAuthority(researchRoot, sourceId)
const reviewedAt = "2026-07-21T11:00:00.000Z"
const rereadPassageId = passageResult.passages[0]?.id
assert.ok(rereadPassageId)

const resolutions = reconciliationResult.reconciliations.map((reconciliation, index) => {
  const core = {
    protocolId: "dna-claim-rereview@1" as const,
    reviewId: `candidate.rereview:${sourceId}:${String(index + 1).padStart(3, "0")}`,
    reviewedAt,
    sourceId,
    artifactSha256: reconciliation.artifactSha256,
    reconciliationSha256: reconciliation.reconciliationSha256,
    decision: "quarantined" as const,
    rereadPassageIds: [rereadPassageId],
    resolved: null,
    rationaleCode: "support_not_found" as const,
  }
  return {
    ...core,
    evidenceSha256: commitDnaEvidenceSubject(core),
  } satisfies DnaClaimRereviewResolution
})

const decisionPayload = {
  schemaVersion: "dna-candidate-claim-rereview-decision@1" as const,
  decisionId: `candidate.rereview.decision:${sourceId}:r000001`,
  sourceId,
  reconciliationResultSha256: reconciliationResult.resultSha256,
  reconciliationResultFileSha256: createHash("sha256")
    .update(readFileSync(reconciliationPath)).digest("hex"),
  passageRegistrationResultSha256: passageResult.resultSha256,
  passageRegistrationResultFileSha256: createHash("sha256")
    .update(readFileSync(passagePath)).digest("hex"),
  reviewedAt,
  reviewerId: "codex.rereview.contract-test",
  authorityClass: "codex_rereview_not_independent_human_review" as const,
  status: "candidate_only" as const,
  runtimeEligible: false as const,
  releaseEligible: false as const,
  resolutions,
}
const decision: DnaCandidateClaimRereviewDecision = {
  ...decisionPayload,
  decisionSha256: hashDnaCandidateClaimRereviewPayload(decisionPayload),
}

const result = compileDnaCandidateClaimRereview({
  decision,
  reconciliationResult,
  reconciliationResultFileSha256: decision.reconciliationResultFileSha256,
  passageRegistrationResult: passageResult,
  passageRegistrationResultFileSha256: decision.passageRegistrationResultFileSha256,
  parsedArtifact: authority.parsedArtifact,
})
assert.equal(isDnaCandidateClaimRereviewResultValid(result), true)
assert.equal(result.counts.quarantined, reconciliationResult.reconciliations.length)
assert.equal(result.counts.consensus, 0)
assert.equal(result.runtimeEligible, false)
assert.equal(result.releaseEligible, false)

assert.throws(() => compileDnaCandidateClaimRereview({
  decision: { ...decision, resolutions: decision.resolutions.slice(1), decisionSha256:
    hashDnaCandidateClaimRereviewPayload({ ...decisionPayload,
      resolutions: decision.resolutions.slice(1) }) },
  reconciliationResult,
  reconciliationResultFileSha256: decision.reconciliationResultFileSha256,
  passageRegistrationResult: passageResult,
  passageRegistrationResultFileSha256: decision.passageRegistrationResultFileSha256,
  parsedArtifact: authority.parsedArtifact,
}), /candidate_claim_rereview_incomplete_nonconsensus_coverage/)

assert.throws(() => compileDnaCandidateClaimRereview({
  decision: { ...decision, decisionSha256: "0".repeat(64) },
  reconciliationResult,
  reconciliationResultFileSha256: decision.reconciliationResultFileSha256,
  passageRegistrationResult: passageResult,
  passageRegistrationResultFileSha256: decision.passageRegistrationResultFileSha256,
  parsedArtifact: authority.parsedArtifact,
}), /candidate_claim_rereview_decision_hash_mismatch/)

console.log(JSON.stringify({
  ok: true,
  sourceId,
  rereviews: result.rereviews.length,
  quarantined: result.counts.quarantined,
  runtimeEligible: result.runtimeEligible,
  releaseEligible: result.releaseEligible,
}, null, 2))

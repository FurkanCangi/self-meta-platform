import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  compileDnaCandidateClaimExtraction,
  createDnaCandidateClaimReviewPacket,
  hashDnaCandidateClaimPayload,
  isDnaCandidateClaimExtractionResultValid,
  type DnaCandidateClaimExtractionDecision,
} from "../src/lib/dna/chat/governance/candidateClaimExtraction"
import type {
  DnaCandidatePassageRegistrationResult,
} from "../src/lib/dna/chat/governance/candidatePassageRegistration"
import {
  commitDnaEvidenceSubject,
  type DnaAtomicClaimDraft,
} from "../src/lib/dna/chat/governance/evidenceExtraction"
import type {
  DnaMethodAppraisalRegistrationResult,
} from "../src/lib/dna/chat/governance/methodAppraisalRegistration"
import {
  loadDnaCandidatePassageSourceAuthority,
} from "./run-dna-candidate-passage-registration-worker"

const researchRoot = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const sourceId = "prisma-cosmin-omis-2024"
const passageRoot = join(
  researchRoot,
  "Datasets/DNA-Intelligence/work/v3/candidate-passage-registrations/v1",
)
const methodRoot = join(
  researchRoot,
  "Datasets/DNA-Intelligence/work/v3/method-appraisal-registrations/v1",
)
const passageResultPath = join(passageRoot, "sources", sourceId, "result.json")
const methodResultPath = join(methodRoot, "sources", sourceId, "result.json")

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function fileSha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function expectError(operation: () => unknown, code: RegExp): void {
  assert.throws(operation, code)
}

const passageResult = readJson<DnaCandidatePassageRegistrationResult>(passageResultPath)
const methodResult = readJson<DnaMethodAppraisalRegistrationResult>(methodResultPath)
const authority = loadDnaCandidatePassageSourceAuthority(researchRoot, sourceId)
const packet = createDnaCandidateClaimReviewPacket({
  lane: "A",
  passageRegistrationResult: passageResult,
  passageRegistrationResultFileSha256: fileSha256(passageResultPath),
  methodRegistrationResult: methodResult,
})
const laneBPacket = createDnaCandidateClaimReviewPacket({
  lane: "B",
  passageRegistrationResult: passageResult,
  passageRegistrationResultFileSha256: fileSha256(passageResultPath),
  methodRegistrationResult: methodResult,
})
assert.notEqual(packet.packetSha256, laneBPacket.packetSha256)
assert.equal(packet.peerOutputExcluded, true)
assert.equal(laneBPacket.peerOutputExcluded, true)

const passage = passageResult.passages.find((entry) => entry.id.endsWith(":007"))
assert.ok(passage)
const proposition = "PRISMA-COSMIN for OMIs 2024 is intended to guide the reporting of systematic reviews of OMIs, in which at least one measurement property of at least one OMI is evaluated."
assert.ok(passage.originalText.includes(proposition))
const claimDraft: DnaAtomicClaimDraft = {
  claimId: `candidate.claim:${sourceId}:scope:001:A`,
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
const rationaleCore = {
  claimId: claimDraft.claimId,
  passageIds: [passage.id],
  rationale: "The proposition is one verbatim scope sentence from the selected passage.",
  uncertaintyEvidence: "The method appraisal treats this as a reporting guideline, not outcome evidence.",
}
const rationale = {
  ...rationaleCore,
  rationaleSha256: commitDnaEvidenceSubject(rationaleCore),
}
const packetFileSha256 = createHash("sha256")
  .update(`${JSON.stringify(packet, null, 2)}\n`, "utf8").digest("hex")

function makeDecision(
  draft: DnaAtomicClaimDraft = claimDraft,
  override: Partial<Omit<DnaCandidateClaimExtractionDecision,
    "decisionSha256" | "claimDrafts" | "rationales">> = {},
): DnaCandidateClaimExtractionDecision {
  const adjustedRationaleCore = {
    ...rationaleCore,
    claimId: draft.claimId,
    passageIds: [...draft.passageIds],
  }
  const payload: Omit<DnaCandidateClaimExtractionDecision, "decisionSha256"> = {
    schemaVersion: "dna-candidate-claim-extraction-decision@1",
    decisionId: `candidate.claim.decision:${sourceId}:A:r000001`,
    runId: `candidate.claim.run:${sourceId}:A:r000001`,
    lane: "A",
    sourceId,
    packetSha256: packet.packetSha256,
    packetFileSha256,
    passageRegistrationResultSha256: passageResult.resultSha256,
    passageRegistrationResultFileSha256: fileSha256(passageResultPath),
    createdAt: "2026-07-20T20:00:00.000Z",
    reviewerId: "codex.candidate-claim-a",
    authorityClass: "output_blinded_codex_multi_pass_not_independent",
    peerOutputExcluded: true,
    status: "candidate_only",
    runtimeEligible: false,
    releaseEligible: false,
    claimDrafts: [draft],
    rationales: [{
      ...adjustedRationaleCore,
      rationaleSha256: commitDnaEvidenceSubject(adjustedRationaleCore),
    }],
    ...override,
  }
  return Object.freeze({
    ...payload,
    decisionSha256: hashDnaCandidateClaimPayload(payload),
  })
}

function compile(decision: DnaCandidateClaimExtractionDecision) {
  return compileDnaCandidateClaimExtraction({
    decision,
    packet,
    packetFileSha256,
    passageRegistrationResult: passageResult,
    passageRegistrationResultFileSha256: fileSha256(passageResultPath),
    parsedArtifact: authority.parsedArtifact,
  })
}

const result = compile(makeDecision())
assert.equal(result.runtimeEligible, false)
assert.equal(result.releaseEligible, false)
assert.equal(result.run.claims.length, 1)
assert.equal(result.run.claims[0]?.status, "candidate_only")
assert.equal(result.run.claims[0]?.evidenceLevel, "not_assessed")
assert.equal(result.run.claims[0]?.dnaRelationship, "none")
assert.equal(isDnaCandidateClaimExtractionResultValid(result), true)

expectError(() => compile(makeDecision(claimDraft, {
  packetFileSha256: "0".repeat(64),
})), /candidate_claim_input_binding_mismatch/)

expectError(() => compile(makeDecision({
  ...claimDraft,
  proposition: "This paraphrase does not occur verbatim in the selected passage.",
})), /dna_evidence_claim_not_verbatim_in_passage/)

expectError(() => compile(makeDecision({
  ...claimDraft,
  evidenceLevel: "high",
  evidenceLevelEvidence: null,
})), /dna_evidence_level_requires_method_appraisal/)

expectError(() => compile(makeDecision({
  ...claimDraft,
  dnaRelationship: "conceptual_proximity",
} as unknown as DnaAtomicClaimDraft)), /dna_evidence_blind_extraction_cannot_create_dna_relationship/)

expectError(() => compileDnaCandidateClaimExtraction({
  decision: makeDecision(),
  packet,
  packetFileSha256,
  passageRegistrationResult: {
    ...passageResult,
    resultSha256: "0".repeat(64),
  },
  passageRegistrationResultFileSha256: fileSha256(passageResultPath),
  parsedArtifact: authority.parsedArtifact,
}), /candidate_claim_passage_registration_invalid/)

assert.equal(isDnaCandidateClaimExtractionResultValid({
  ...result,
  resultSha256: "0".repeat(64),
}), false)

console.log(JSON.stringify({
  ok: true,
  sourceId,
  lanePacketsSeparated: true,
  peerOutputExcluded: true,
  verbatimAtomicClaimCompiled: true,
  singleSourceEvidenceLevelNotAssessed: true,
  dnaLinkingForbidden: true,
  stalePacketBindingRejected: true,
  paraphraseRejected: true,
  unsupportedCertaintyRejected: true,
  tamperRejected: true,
  runtimeEligible: 0,
  releaseEligible: 0,
}, null, 2))

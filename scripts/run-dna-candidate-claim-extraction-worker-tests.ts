import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import {
  hashDnaCandidateClaimPayload,
  type DnaCandidateClaimExtractionDecision,
  type DnaCandidateClaimReviewPacket,
} from "../src/lib/dna/chat/governance/candidateClaimExtraction"
import type { DnaCandidatePassageWorkpack } from "../src/lib/dna/chat/governance/candidatePassageRegistration"
import type {
  CandidatePassageRegistrationIndex,
} from "./run-dna-candidate-passage-registration-worker"
import {
  commitDnaEvidenceSubject,
  type DnaAtomicClaimDraft,
  type DnaBlindExtractionLane,
} from "../src/lib/dna/chat/governance/evidenceExtraction"
import {
  getDnaCandidateClaimExtractionStatus,
  ingestDnaCandidateClaimExtraction,
  prepareDnaCandidateClaimReviewPacket,
  type CandidateClaimExtractionIndex,
} from "./run-dna-candidate-claim-extraction-worker"

function copyTree(source: string, target: string): void {
  mkdirSync(dirname(target), { recursive: true })
  cpSync(source, target, { recursive: true })
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function fileSha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function expectError(operation: () => unknown, code: RegExp): void {
  assert.throws(operation, code)
}

const sourceId = "prisma-cosmin-omis-2024"
const liveResearchRoot = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const temporaryRoot = mkdtempSync(join(tmpdir(), "dna-candidate-claim-worker-"))
const researchRoot = join(temporaryRoot, "research")
const relativeMethodRoot = "Datasets/DNA-Intelligence/work/v3/method-appraisal-registrations/v1"
const relativeBatchRoot = "Datasets/DNA-Intelligence/work/v3/method-appraisals/batch-v1"
const relativeCandidateRoot = "Datasets/DNA-Intelligence/work/v3/candidate-corpus"
const relativePassageRoot = "Datasets/DNA-Intelligence/work/v3/candidate-passage-registrations/v1"
const relativeSourceLibrary = "Datasets/SelfMetaAI/dna-knowledge/source-library"
const livePassageIndex = readJson<CandidatePassageRegistrationIndex>(join(
  liveResearchRoot,
  relativePassageRoot,
  "index.json",
))

function makeDecision(input: Readonly<{
  lane: DnaBlindExtractionLane
  packet: DnaCandidateClaimReviewPacket
  packetPath: string
}>): DnaCandidateClaimExtractionDecision {
  const passage = input.packet.passages.find((entry) => entry.id.endsWith(":007"))
  assert.ok(passage)
  const proposition = "PRISMA-COSMIN for OMIs 2024 is intended to guide the reporting of systematic reviews of OMIs, in which at least one measurement property of at least one OMI is evaluated."
  const claim: DnaAtomicClaimDraft = {
    claimId: `candidate.claim:${sourceId}:scope:worker:${input.lane}`,
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
      text: "This reporting-scope statement is not clinical effectiveness evidence.",
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
    claimId: claim.claimId,
    passageIds: [passage.id],
    rationale: "The selected sentence is verbatim and states one bounded reporting scope.",
    uncertaintyEvidence: "The source is a reporting guideline and single-source certainty is not assessed.",
  }
  const payload: Omit<DnaCandidateClaimExtractionDecision, "decisionSha256"> = {
    schemaVersion: "dna-candidate-claim-extraction-decision@1",
    decisionId: `candidate.claim.decision:${sourceId}:${input.lane}:worker-test`,
    runId: `candidate.claim.run:${sourceId}:${input.lane}:worker-test`,
    lane: input.lane,
    sourceId,
    packetSha256: input.packet.packetSha256,
    packetFileSha256: fileSha256(input.packetPath),
    passageRegistrationResultSha256: input.packet.passageRegistrationResultSha256,
    passageRegistrationResultFileSha256:
      input.packet.passageRegistrationResultFileSha256,
    createdAt: input.lane === "A"
      ? "2026-07-20T20:10:00.000Z" : "2026-07-20T20:11:00.000Z",
    reviewerId: `codex.candidate-claim-worker-${input.lane.toLowerCase()}`,
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
  return {
    ...payload,
    decisionSha256: hashDnaCandidateClaimPayload(payload),
  }
}

try {
  for (const relativeRoot of [relativeMethodRoot, relativeBatchRoot,
    relativeCandidateRoot, relativePassageRoot]) {
    copyTree(join(liveResearchRoot, relativeRoot), join(researchRoot, relativeRoot))
  }
  for (const passageRecord of livePassageIndex.records) {
    const workpack = readJson<DnaCandidatePassageWorkpack>(join(
      liveResearchRoot,
      relativeCandidateRoot,
      "method-review-workpacks",
      `${passageRecord.sourceId}.json`,
    ))
    copyTree(
      join(liveResearchRoot, relativeSourceLibrary, workpack.sourceRecordRelativePath),
      join(researchRoot, relativeSourceLibrary, workpack.sourceRecordRelativePath),
    )
    copyTree(
      join(liveResearchRoot, relativeSourceLibrary, workpack.artifactRelativePath),
      join(researchRoot, relativeSourceLibrary, workpack.artifactRelativePath),
    )
  }

  const empty = getDnaCandidateClaimExtractionStatus(researchRoot)
  assert.equal(empty.ok, true)
  assert.equal(empty.state, "empty")
  const preparedA = prepareDnaCandidateClaimReviewPacket({
    researchRoot,
    sourceId,
    lane: "A",
  }) as { packetPath: string; runtimeEligible: false; releaseEligible: false }
  const preparedB = prepareDnaCandidateClaimReviewPacket({
    researchRoot,
    sourceId,
    lane: "B",
  }) as { packetPath: string; runtimeEligible: false; releaseEligible: false }
  assert.equal(preparedA.runtimeEligible, false)
  assert.equal(preparedB.releaseEligible, false)
  assert.equal(getDnaCandidateClaimExtractionStatus(researchRoot).state, "empty")

  const packetA = readJson<DnaCandidateClaimReviewPacket>(preparedA.packetPath)
  const packetB = readJson<DnaCandidateClaimReviewPacket>(preparedB.packetPath)
  const decisionAPath = join(temporaryRoot, "decision-a.json")
  const decisionBPath = join(temporaryRoot, "decision-b.json")
  writeFileSync(decisionAPath, `${JSON.stringify(makeDecision({
    lane: "A", packet: packetA, packetPath: preparedA.packetPath,
  }), null, 2)}\n`)
  writeFileSync(decisionBPath, `${JSON.stringify(makeDecision({
    lane: "B", packet: packetB, packetPath: preparedB.packetPath,
  }), null, 2)}\n`)

  expectError(() => ingestDnaCandidateClaimExtraction({
    researchRoot,
    sourceId,
    lane: "A",
    packetInputPath: preparedA.packetPath,
    decisionInputPath: decisionAPath,
    expectedIndexSha: "absent",
  }), /candidate_claim_worker:research_root_must_be_research_ssd/)
  expectError(() => ingestDnaCandidateClaimExtraction({
    researchRoot,
    sourceId,
    lane: "A",
    packetInputPath: preparedA.packetPath,
    decisionInputPath: decisionAPath,
    expectedIndexSha: "0".repeat(64),
    allowNonSsdForTests: true,
  }), /candidate_claim_worker:index_cas_mismatch/)

  const ingestedA = ingestDnaCandidateClaimExtraction({
    researchRoot,
    sourceId,
    lane: "A",
    packetInputPath: preparedA.packetPath,
    decisionInputPath: decisionAPath,
    expectedIndexSha: "absent",
    allowNonSsdForTests: true,
    now: () => "2026-07-20T20:12:00.000Z",
  }) as { indexFileSha256: string; status: string }
  assert.equal(ingestedA.status, "pass_a_complete")
  assert.equal(getDnaCandidateClaimExtractionStatus(researchRoot).ok, true)

  expectError(() => ingestDnaCandidateClaimExtraction({
    researchRoot,
    sourceId,
    lane: "A",
    packetInputPath: preparedA.packetPath,
    decisionInputPath: decisionAPath,
    expectedIndexSha: ingestedA.indexFileSha256,
    allowNonSsdForTests: true,
  }), /candidate_claim_worker:lane_already_registered/)
  assert.equal(getDnaCandidateClaimExtractionStatus(researchRoot).ok, true,
    "Duplicate rejection must preserve the prior index")

  const ingestedB = ingestDnaCandidateClaimExtraction({
    researchRoot,
    sourceId,
    lane: "B",
    packetInputPath: preparedB.packetPath,
    decisionInputPath: decisionBPath,
    expectedIndexSha: ingestedA.indexFileSha256,
    allowNonSsdForTests: true,
    now: () => "2026-07-20T20:13:00.000Z",
  }) as { indexFileSha256: string; status: string }
  assert.equal(ingestedB.status, "awaiting_reconciliation")
  const valid = getDnaCandidateClaimExtractionStatus(researchRoot)
  assert.equal(valid.ok, true, valid.issues.join(","))
  assert.equal(valid.sources, 1)
  assert.equal(valid.candidateRuns, 2)
  assert.equal(valid.candidateClaims, 2)
  assert.equal(valid.awaitingReconciliation, 1)
  assert.equal(valid.runtimeEligible, 0)
  assert.equal(valid.releaseEligible, 0)

  const claimRoot = join(
    researchRoot,
    "Datasets/DNA-Intelligence/work/v3/candidate-claim-extractions/v1",
  )
  const index = readJson<CandidateClaimExtractionIndex>(join(claimRoot, "index.json"))
  const receiptPath = join(claimRoot, index.records[0]?.passB?.receiptRelativePath ?? "")
  const receiptBytes = readFileSync(receiptPath)
  writeFileSync(receiptPath, Buffer.concat([receiptBytes, Buffer.from("\n")]))
  assert.equal(getDnaCandidateClaimExtractionStatus(researchRoot).ok, false)
  writeFileSync(receiptPath, receiptBytes)
  assert.equal(getDnaCandidateClaimExtractionStatus(researchRoot).ok, true)

  const passageResultPath = join(
    researchRoot,
    relativePassageRoot,
    "sources",
    sourceId,
    "result.json",
  )
  const passageResultBytes = readFileSync(passageResultPath)
  writeFileSync(passageResultPath, Buffer.concat([passageResultBytes, Buffer.from("\n")]))
  assert.equal(getDnaCandidateClaimExtractionStatus(researchRoot).ok, false)
  writeFileSync(passageResultPath, passageResultBytes)
  assert.equal(getDnaCandidateClaimExtractionStatus(researchRoot).ok, true)

  const collectionPath = join(claimRoot, "candidate-claim-runs.json")
  const collectionBytes = readFileSync(collectionPath)
  unlinkSync(collectionPath)
  assert.ok(getDnaCandidateClaimExtractionStatus(researchRoot).issues.includes(
    "candidate_claim_run_collection_mismatch",
  ))
  writeFileSync(collectionPath, collectionBytes)
  assert.equal(getDnaCandidateClaimExtractionStatus(researchRoot).ok, true)

  console.log(JSON.stringify({
    ok: true,
    sourceId,
    blindLanePacketsSeparated: true,
    successfulTwoLaneEphemeralRegistration: true,
    nonSsdMutationRejected: true,
    casMismatchRejected: true,
    duplicateLaneRejectedWithoutRollbackDamage: true,
    receiptTamperRejected: true,
    stalePassageRegistrationRejected: true,
    missingRunCollectionRejected: true,
    candidateRuns: 2,
    candidateClaims: 2,
    runtimeEligible: 0,
    releaseEligible: 0,
  }, null, 2))
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true })
}

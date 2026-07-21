import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import {
  hashDnaCandidateClaimReconciliationPayload,
  type DnaCandidateClaimReconciliationDecision,
} from "../src/lib/dna/chat/governance/candidateClaimReconciliation"
import type { DnaCandidatePassageWorkpack } from "../src/lib/dna/chat/governance/candidatePassageRegistration"
import type {
  CandidatePassageRegistrationIndex,
} from "./run-dna-candidate-passage-registration-worker"
import {
  getDnaCandidateClaimReconciliationStatus,
  ingestDnaCandidateClaimReconciliation,
  prepareDnaCandidateClaimReconciliationPacket,
  type CandidateClaimReconciliationIndex,
} from "./run-dna-candidate-claim-reconciliation-worker"
import type { DnaCandidateClaimExtractionResult } from "../src/lib/dna/chat/governance/candidateClaimExtraction"

type ReconciliationPacket = Readonly<{
  sourceId: string
  passAResultFileSha256: string
  passBResultFileSha256: string
  passAResult: DnaCandidateClaimExtractionResult
  passBResult: DnaCandidateClaimExtractionResult
}>

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

const sourceId = "prisma-cosmin-omis-2024"
const liveResearchRoot = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const temporaryRoot = mkdtempSync(join(tmpdir(), "dna-candidate-reconciliation-worker-"))
const researchRoot = join(temporaryRoot, "research")
const relativeMethodRoot = "Datasets/DNA-Intelligence/work/v3/method-appraisal-registrations/v1"
const relativeBatchRoot = "Datasets/DNA-Intelligence/work/v3/method-appraisals/batch-v1"
const relativeCandidateRoot = "Datasets/DNA-Intelligence/work/v3/candidate-corpus"
const relativePassageRoot = "Datasets/DNA-Intelligence/work/v3/candidate-passage-registrations/v1"
const relativeClaimRoot = "Datasets/DNA-Intelligence/work/v3/candidate-claim-extractions/v1"
const relativeSourceLibrary = "Datasets/SelfMetaAI/dna-knowledge/source-library"

try {
  for (const relativeRoot of [relativeMethodRoot, relativeBatchRoot,
    relativeCandidateRoot, relativePassageRoot, relativeClaimRoot]) {
    copyTree(join(liveResearchRoot, relativeRoot), join(researchRoot, relativeRoot))
  }
  const livePassageIndex = readJson<CandidatePassageRegistrationIndex>(join(
    liveResearchRoot, relativePassageRoot, "index.json",
  ))
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

  const empty = getDnaCandidateClaimReconciliationStatus(researchRoot)
  assert.equal(empty.ok, true)
  assert.equal(empty.state, "empty")

  const prepared = prepareDnaCandidateClaimReconciliationPacket({
    researchRoot,
    sourceId,
  }) as { packetPath: string; passAClaims: number; passBClaims: number }
  assert.ok(prepared.passAClaims > 0)
  assert.ok(prepared.passBClaims > 0)
  const packet = readJson<ReconciliationPacket>(prepared.packetPath)

  const payload: Omit<DnaCandidateClaimReconciliationDecision, "decisionSha256"> = {
    schemaVersion: "dna-candidate-claim-reconciliation-decision@1",
    decisionId: `candidate.claim.reconciliation.decision:${sourceId}:worker-test`,
    sourceId,
    passAResultSha256: packet.passAResult.resultSha256,
    passAResultFileSha256: packet.passAResultFileSha256,
    passBResultSha256: packet.passBResult.resultSha256,
    passBResultFileSha256: packet.passBResultFileSha256,
    reviewedAt: "2026-07-20T21:00:00.000Z",
    reviewerId: "codex.candidate-reconciliation-worker-test",
    authorityClass: "codex_reconciliation_not_independent_human_review",
    status: "candidate_only",
    runtimeEligible: false,
    releaseEligible: false,
    pairs: [],
    unmatchedA: packet.passAResult.run.claims.map((claim) => ({
      claimId: claim.claimId,
      reasonCode: "no_peer_match" as const,
      rationale: "Worker isolation fixture records this lane A claim as explicitly unmatched.",
    })),
    unmatchedB: packet.passBResult.run.claims.map((claim) => ({
      claimId: claim.claimId,
      reasonCode: "no_peer_match" as const,
      rationale: "Worker isolation fixture records this lane B claim as explicitly unmatched.",
    })),
  }
  const decision: DnaCandidateClaimReconciliationDecision = {
    ...payload,
    decisionSha256: hashDnaCandidateClaimReconciliationPayload(payload),
  }
  const decisionPath = join(temporaryRoot, "decision.json")
  writeFileSync(decisionPath, `${JSON.stringify(decision, null, 2)}\n`)

  assert.throws(() => ingestDnaCandidateClaimReconciliation({
    researchRoot,
    sourceId,
    decisionInputPath: decisionPath,
    expectedIndexSha: "absent",
  }), /candidate_claim_reconciliation_worker:research_root_must_be_research_ssd/)

  assert.throws(() => ingestDnaCandidateClaimReconciliation({
    researchRoot,
    sourceId,
    decisionInputPath: decisionPath,
    expectedIndexSha: "0".repeat(64),
    allowNonSsdForTests: true,
  }), /candidate_claim_reconciliation_worker:stale_index/)

  const ingested = ingestDnaCandidateClaimReconciliation({
    researchRoot,
    sourceId,
    decisionInputPath: decisionPath,
    expectedIndexSha: "absent",
    allowNonSsdForTests: true,
    now: () => "2026-07-20T21:01:00.000Z",
  }) as { indexFileSha256: string; unmatchedA: number; unmatchedB: number }
  assert.equal(ingested.unmatchedA, prepared.passAClaims)
  assert.equal(ingested.unmatchedB, prepared.passBClaims)
  const valid = getDnaCandidateClaimReconciliationStatus(researchRoot)
  assert.equal(valid.ok, true, valid.issues.join(","))
  assert.equal(valid.sources, 1)
  assert.equal(valid.runtimeEligible, 0)
  assert.equal(valid.releaseEligible, 0)

  assert.throws(() => ingestDnaCandidateClaimReconciliation({
    researchRoot,
    sourceId,
    decisionInputPath: decisionPath,
    expectedIndexSha: ingested.indexFileSha256,
    allowNonSsdForTests: true,
  }), /candidate_claim_reconciliation_worker:duplicate_source/)
  assert.equal(getDnaCandidateClaimReconciliationStatus(researchRoot).ok, true,
    "Duplicate rejection must preserve the previous reconciliation index")

  const reconciliationRoot = join(researchRoot,
    "Datasets/DNA-Intelligence/work/v3/candidate-claim-reconciliations/v1")
  const index = readJson<CandidateClaimReconciliationIndex>(join(reconciliationRoot, "index.json"))
  const receiptPath = join(reconciliationRoot, index.records[0]!.receiptRelativePath)
  const receiptBytes = readFileSync(receiptPath)
  writeFileSync(receiptPath, Buffer.concat([receiptBytes, Buffer.from("\n")]))
  assert.equal(getDnaCandidateClaimReconciliationStatus(researchRoot).ok, false)
  writeFileSync(receiptPath, receiptBytes)
  assert.equal(getDnaCandidateClaimReconciliationStatus(researchRoot).ok, true)

  const claimIndexPath = join(researchRoot, relativeClaimRoot, "index.json")
  const claimIndexBytes = readFileSync(claimIndexPath)
  const claimIndex = readJson<Record<string, unknown>>(claimIndexPath)
  writeFileSync(claimIndexPath, `${JSON.stringify({ ...claimIndex, canonicalPayloadSha256:
    "0".repeat(64) }, null, 2)}\n`)
  const stale = getDnaCandidateClaimReconciliationStatus(researchRoot)
  assert.equal(stale.ok, false)
  assert.ok(stale.issues.includes("candidate_claim_extraction_dependency_invalid"))
  writeFileSync(claimIndexPath, claimIndexBytes)
  assert.equal(fileSha256(claimIndexPath), fileSha256(join(liveResearchRoot,
    relativeClaimRoot, "index.json")))
  assert.equal(getDnaCandidateClaimReconciliationStatus(researchRoot).ok, true)

  console.log(JSON.stringify({
    ok: true,
    sourceId,
    packetBindsBothBlindRuns: true,
    successfulEphemeralRegistration: true,
    nonSsdMutationRejected: true,
    casMismatchRejected: true,
    duplicateRejectedWithoutRollbackDamage: true,
    receiptTamperRejected: true,
    upstreamTamperRejected: true,
    runtimeEligible: 0,
    releaseEligible: 0,
  }, null, 2))
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true })
}

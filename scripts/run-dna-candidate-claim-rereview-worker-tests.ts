#!/usr/bin/env node

import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  getDnaCandidateClaimRereviewStatus,
  ingestDnaCandidateClaimRereview,
  prepareDnaCandidateClaimRereviewPacket,
} from "./run-dna-candidate-claim-rereview-worker"

const researchRoot = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const sourceId = "hrv-publication-guidelines-2024"
const current = getDnaCandidateClaimRereviewStatus(researchRoot)
assert.equal(current.ok, true)
assert.equal(current.runtimeEligible, 0)
assert.equal(current.releaseEligible, 0)

const packet = prepareDnaCandidateClaimRereviewPacket({ researchRoot, sourceId })
assert.equal(packet.ok, true)
assert.equal(packet.sourceId, sourceId)
assert.ok(Number(packet.nonconsensusItems) > 0)
assert.ok(Number(packet.candidatePassages) > 0)
assert.equal(packet.runtimeEligible, false)
assert.equal(packet.releaseEligible, false)

const temporaryRoot = mkdtempSync(join(tmpdir(), "dna-rereview-worker-"))
try {
  assert.throws(() => ingestDnaCandidateClaimRereview({
    researchRoot: temporaryRoot,
    sourceId,
    decisionInputPath: join(temporaryRoot, "missing.json"),
    expectedIndexSha: "stale",
  }), /research_root_must_be_research_ssd/)
  assert.throws(() => ingestDnaCandidateClaimRereview({
    researchRoot: temporaryRoot,
    sourceId,
    decisionInputPath: join(temporaryRoot, "missing.json"),
    expectedIndexSha: "stale",
    allowNonSsdForTests: true,
  }), /stale_index/)
  assert.equal(getDnaCandidateClaimRereviewStatus(temporaryRoot).state, "empty")
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true })
}

console.log(JSON.stringify({
  ok: true,
  sourceId,
  packetItems: packet.nonconsensusItems,
  storedState: current.state,
  runtimeEligible: current.runtimeEligible,
  releaseEligible: current.releaseEligible,
}, null, 2))

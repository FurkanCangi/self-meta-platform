import assert from "node:assert/strict"
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import {
  getDnaMethodAppraisalRegistrationStatus,
  ingestDnaMethodAppraisalRegistration,
  type RegistrationIndex,
} from "./run-dna-method-appraisal-registration-worker"

function copyFileTree(source: string, target: string): void {
  mkdirSync(dirname(target), { recursive: true })
  cpSync(source, target, { recursive: true })
}

function expectError(operation: () => unknown, code: RegExp): void {
  assert.throws(operation, code)
}

const liveResearchRoot = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const liveRegistrationRoot = join(
  liveResearchRoot,
  "Datasets/DNA-Intelligence/work/v3/method-appraisal-registrations/v1",
)
const liveIndexPath = join(liveRegistrationRoot, "index.json")
assert.equal(existsSync(liveIndexPath), true,
  "At least one controlled SSD registration is required for the worker integration test")
const liveStatus = getDnaMethodAppraisalRegistrationStatus(liveResearchRoot)
assert.equal(liveStatus.ok, true, liveStatus.issues.join(","))
assert.equal(liveStatus.runtimeEligible, 0)
assert.equal(liveStatus.releaseEligible, 0)

const liveIndex = JSON.parse(readFileSync(liveIndexPath, "utf8")) as RegistrationIndex
const fixtureRecord = liveIndex.records[0]
assert.ok(fixtureRecord)
const sourceId = fixtureRecord.sourceId
const liveBatchRoot = join(
  liveResearchRoot,
  "Datasets/DNA-Intelligence/work/v3/method-appraisals/batch-v1",
)
const liveCandidateRoot = join(
  liveResearchRoot,
  "Datasets/DNA-Intelligence/work/v3/candidate-corpus",
)
const candidate = JSON.parse(readFileSync(
  join(liveBatchRoot, "sources", sourceId, "candidate.json"),
  "utf8",
)) as { sourceBinding: { workpackRelativePath: string } }

const temporaryRoot = mkdtempSync(join(tmpdir(), "dna-method-registration-worker-"))
const researchRoot = join(temporaryRoot, "research")
const batchRoot = join(
  researchRoot,
  "Datasets/DNA-Intelligence/work/v3/method-appraisals/batch-v1",
)
const candidateRoot = join(
  researchRoot,
  "Datasets/DNA-Intelligence/work/v3/candidate-corpus",
)
copyFileTree(join(liveBatchRoot, "run-index.json"), join(batchRoot, "run-index.json"))
copyFileTree(join(liveBatchRoot, "sources", sourceId), join(batchRoot, "sources", sourceId))
copyFileTree(
  join(liveCandidateRoot, candidate.sourceBinding.workpackRelativePath),
  join(candidateRoot, candidate.sourceBinding.workpackRelativePath),
)
const decisionInputPath = join(temporaryRoot, "decision.json")
copyFileTree(join(liveRegistrationRoot, fixtureRecord.decisionRelativePath), decisionInputPath)

try {
  const empty = getDnaMethodAppraisalRegistrationStatus(researchRoot)
  assert.equal(empty.ok, true)
  assert.equal(empty.state, "empty")

  expectError(() => ingestDnaMethodAppraisalRegistration({
    researchRoot,
    sourceId,
    decisionInputPath,
    expectedIndexSha: "absent",
  }), /registration_worker:research_root_must_be_research_ssd/)

  expectError(() => ingestDnaMethodAppraisalRegistration({
    researchRoot,
    sourceId,
    decisionInputPath,
    expectedIndexSha: "0".repeat(64),
    allowNonSsdForTests: true,
  }), /registration_worker:index_cas_mismatch/)

  const ingested = ingestDnaMethodAppraisalRegistration({
    researchRoot,
    sourceId,
    decisionInputPath,
    expectedIndexSha: "absent",
    allowNonSsdForTests: true,
    now: () => "2026-07-20T15:00:00.000Z",
  }) as { indexFileSha256: string; runtimeEligible: false; releaseEligible: false }
  assert.match(ingested.indexFileSha256, /^[a-f0-9]{64}$/)
  assert.equal(ingested.runtimeEligible, false)
  assert.equal(ingested.releaseEligible, false)

  const valid = getDnaMethodAppraisalRegistrationStatus(researchRoot)
  assert.equal(valid.ok, true, valid.issues.join(","))
  assert.equal(valid.registeredForMethodPipeline, 1)
  assert.equal(valid.runtimeEligible, 0)
  assert.equal(valid.releaseEligible, 0)

  expectError(() => ingestDnaMethodAppraisalRegistration({
    researchRoot,
    sourceId,
    decisionInputPath,
    expectedIndexSha: ingested.indexFileSha256,
    allowNonSsdForTests: true,
  }), /registration_worker:source_already_registered/)

  const registrationRoot = join(
    researchRoot,
    "Datasets/DNA-Intelligence/work/v3/method-appraisal-registrations/v1",
  )
  const testIndex = JSON.parse(
    readFileSync(join(registrationRoot, "index.json"), "utf8"),
  ) as RegistrationIndex
  const testRecord = testIndex.records[0]
  const receiptPath = join(registrationRoot, testRecord.receiptRelativePath)
  const receiptBytes = readFileSync(receiptPath)
  writeFileSync(receiptPath, Buffer.concat([receiptBytes, Buffer.from("\n")]))
  assert.equal(getDnaMethodAppraisalRegistrationStatus(researchRoot).ok, false)
  writeFileSync(receiptPath, receiptBytes)
  assert.equal(getDnaMethodAppraisalRegistrationStatus(researchRoot).ok, true)

  const candidatePath = join(batchRoot, "sources", sourceId, "candidate.json")
  const candidateBytes = readFileSync(candidatePath)
  writeFileSync(candidatePath, Buffer.concat([candidateBytes, Buffer.from("\n")]))
  const stale = getDnaMethodAppraisalRegistrationStatus(researchRoot)
  assert.equal(stale.ok, false)
  assert.ok(stale.issues.some((issue) => issue.includes("batch_run_index_binding_mismatch")))
  writeFileSync(candidatePath, candidateBytes)

  const registryPath = join(registrationRoot, "trusted-method-appraisal-registry.json")
  const registryBytes = readFileSync(registryPath)
  unlinkSync(registryPath)
  assert.ok(getDnaMethodAppraisalRegistrationStatus(researchRoot).issues.includes(
    "compiled_registry_mismatch",
  ))
  writeFileSync(registryPath, registryBytes)
  assert.equal(getDnaMethodAppraisalRegistrationStatus(researchRoot).ok, true)

  console.log(JSON.stringify({
    ok: true,
    sourceId,
    successfulEphemeralRegistration: true,
    casMismatchRejected: true,
    duplicateRegistrationRejected: true,
    receiptTamperRejected: true,
    staleBatchBindingRejected: true,
    missingGlobalRegistryRejected: true,
    runtimeEligible: 0,
    releaseEligible: 0,
  }, null, 2))
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true })
}

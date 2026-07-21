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
  hashDnaCandidatePassagePayload,
  type DnaCandidatePassageDecision,
  type DnaCandidatePassageWorkpack,
} from "../src/lib/dna/chat/governance/candidatePassageRegistration"
import type {
  DnaMethodAppraisalRegistrationResult,
} from "../src/lib/dna/chat/governance/methodAppraisalRegistration"
import {
  getDnaCandidatePassageRegistrationStatus,
  ingestDnaCandidatePassageRegistration,
  prepareDnaCandidatePassageReviewPacket,
  type CandidatePassageRegistrationIndex,
} from "./run-dna-candidate-passage-registration-worker"

function copyTree(source: string, target: string): void {
  mkdirSync(dirname(target), { recursive: true })
  cpSync(source, target, { recursive: true })
}

function fileSha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function expectError(operation: () => unknown, code: RegExp): void {
  assert.throws(operation, code)
}

const sourceId = "prisma-cosmin-omis-2024"
const liveResearchRoot = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const temporaryRoot = mkdtempSync(join(tmpdir(), "dna-candidate-passage-worker-"))
const researchRoot = join(temporaryRoot, "research")
const relativeMethodRoot = "Datasets/DNA-Intelligence/work/v3/method-appraisal-registrations/v1"
const relativeBatchRoot = "Datasets/DNA-Intelligence/work/v3/method-appraisals/batch-v1"
const relativeCandidateRoot = "Datasets/DNA-Intelligence/work/v3/candidate-corpus"
const relativeSourceLibrary = "Datasets/SelfMetaAI/dna-knowledge/source-library"
const liveCandidateRoot = join(liveResearchRoot, relativeCandidateRoot)
const workpackPath = join(liveCandidateRoot, "method-review-workpacks", `${sourceId}.json`)
const workpack = readJson<DnaCandidatePassageWorkpack>(workpackPath)

try {
  copyTree(join(liveResearchRoot, relativeMethodRoot), join(researchRoot, relativeMethodRoot))
  copyTree(join(liveResearchRoot, relativeBatchRoot), join(researchRoot, relativeBatchRoot))
  copyTree(liveCandidateRoot, join(researchRoot, relativeCandidateRoot))
  copyTree(
    join(liveResearchRoot, relativeSourceLibrary, workpack.sourceRecordRelativePath),
    join(researchRoot, relativeSourceLibrary, workpack.sourceRecordRelativePath),
  )
  copyTree(
    join(liveResearchRoot, relativeSourceLibrary, workpack.artifactRelativePath),
    join(researchRoot, relativeSourceLibrary, workpack.artifactRelativePath),
  )

  const empty = getDnaCandidatePassageRegistrationStatus(researchRoot)
  assert.equal(empty.ok, true)
  assert.equal(empty.state, "empty")
  const prepared = prepareDnaCandidatePassageReviewPacket({ researchRoot, sourceId }) as {
    packetPath: string
    packetSha256: string
    runtimeEligible: false
    releaseEligible: false
  }
  assert.equal(prepared.runtimeEligible, false)
  assert.equal(prepared.releaseEligible, false)
  assert.equal(getDnaCandidatePassageRegistrationStatus(researchRoot).state, "empty",
    "A review packet alone must not create registration state")

  const localWorkpackPath = join(
    researchRoot,
    relativeCandidateRoot,
    "method-review-workpacks",
    `${sourceId}.json`,
  )
  const localMethodResultPath = join(
    researchRoot,
    relativeMethodRoot,
    "sources",
    sourceId,
    "result.json",
  )
  const methodResult = readJson<DnaMethodAppraisalRegistrationResult>(localMethodResultPath)
  const firstParagraph = workpack.paragraphs[0]
  assert.ok(firstParagraph)
  const decisionPayload: Omit<DnaCandidatePassageDecision, "decisionSha256"> = {
    schemaVersion: "dna-candidate-passage-decision@1",
    decisionId: `candidate.passage.decision:${sourceId}:worker-test`,
    sourceId,
    artifactSha256: workpack.artifactSha256,
    workpackPayloadSha256: workpack.workpackSha256,
    workpackFileSha256: fileSha256(localWorkpackPath),
    methodRegistrationResultSha256: methodResult.resultSha256,
    methodRegistrationResultFileSha256: fileSha256(localMethodResultPath),
    reviewedAt: "2026-07-20T19:00:00.000Z",
    reviewerId: "codex.candidate-passage-worker-test",
    authorityClass: "codex_multi_pass_not_independent",
    status: "candidate_only",
    runtimeEligible: false,
    releaseEligible: false,
    passages: [{
      passageId: `candidate.passage:${sourceId}:worker-test-001`,
      paragraphIds: [firstParagraph.paragraphId],
      ageScope: methodResult.appraisal.ageScope,
      evidenceType: "guideline",
      claimBoundary: "Bu pasaj yalnız yöntemsel raporlama kılavuzunun tanımlı kapsamını destekler.",
      rationale: "Paragraf doğrudan kaynak amacını bildirir ve klinik sonuç ya da DNA iddiası kurmaz.",
    }],
  }
  const decision: DnaCandidatePassageDecision = {
    ...decisionPayload,
    decisionSha256: hashDnaCandidatePassagePayload(decisionPayload),
  }
  const decisionPath = join(temporaryRoot, "decision.json")
  writeFileSync(decisionPath, `${JSON.stringify(decision, null, 2)}\n`)

  expectError(() => ingestDnaCandidatePassageRegistration({
    researchRoot,
    sourceId,
    decisionInputPath: decisionPath,
    expectedIndexSha: "absent",
  }), /candidate_passage_worker:research_root_must_be_research_ssd/)
  expectError(() => ingestDnaCandidatePassageRegistration({
    researchRoot,
    sourceId,
    decisionInputPath: decisionPath,
    expectedIndexSha: "0".repeat(64),
    allowNonSsdForTests: true,
  }), /candidate_passage_worker:index_cas_mismatch/)

  const ingested = ingestDnaCandidatePassageRegistration({
    researchRoot,
    sourceId,
    decisionInputPath: decisionPath,
    expectedIndexSha: "absent",
    allowNonSsdForTests: true,
    now: () => "2026-07-20T19:05:00.000Z",
  }) as { indexFileSha256: string; runtimeEligible: false; releaseEligible: false }
  assert.match(ingested.indexFileSha256, /^[a-f0-9]{64}$/)
  assert.equal(ingested.runtimeEligible, false)
  assert.equal(ingested.releaseEligible, false)
  const valid = getDnaCandidatePassageRegistrationStatus(researchRoot)
  assert.equal(valid.ok, true, valid.issues.join(","))
  assert.equal(valid.candidatePassageSources, 1)
  assert.equal(valid.candidatePassages, 1)
  assert.equal(valid.runtimeEligible, 0)
  assert.equal(valid.releaseEligible, 0)

  expectError(() => ingestDnaCandidatePassageRegistration({
    researchRoot,
    sourceId,
    decisionInputPath: decisionPath,
    expectedIndexSha: ingested.indexFileSha256,
    allowNonSsdForTests: true,
  }), /candidate_passage_worker:source_already_registered/)

  const passageRoot = join(
    researchRoot,
    "Datasets/DNA-Intelligence/work/v3/candidate-passage-registrations/v1",
  )
  const index = readJson<CandidatePassageRegistrationIndex>(join(passageRoot, "index.json"))
  const record = index.records[0]
  assert.ok(record)
  const receiptPath = join(passageRoot, record.receiptRelativePath)
  const receiptBytes = readFileSync(receiptPath)
  writeFileSync(receiptPath, Buffer.concat([receiptBytes, Buffer.from("\n")]))
  assert.equal(getDnaCandidatePassageRegistrationStatus(researchRoot).ok, false)
  writeFileSync(receiptPath, receiptBytes)
  assert.equal(getDnaCandidatePassageRegistrationStatus(researchRoot).ok, true)

  const methodResultBytes = readFileSync(localMethodResultPath)
  writeFileSync(localMethodResultPath, Buffer.concat([methodResultBytes, Buffer.from("\n")]))
  assert.equal(getDnaCandidatePassageRegistrationStatus(researchRoot).ok, false)
  writeFileSync(localMethodResultPath, methodResultBytes)
  assert.equal(getDnaCandidatePassageRegistrationStatus(researchRoot).ok, true)

  const registryPath = join(passageRoot, "candidate-passage-trust-registry.json")
  const registryBytes = readFileSync(registryPath)
  unlinkSync(registryPath)
  assert.ok(getDnaCandidatePassageRegistrationStatus(researchRoot).issues.includes(
    "candidate_registry_mismatch",
  ))
  writeFileSync(registryPath, registryBytes)
  assert.equal(getDnaCandidatePassageRegistrationStatus(researchRoot).ok, true)

  console.log(JSON.stringify({
    ok: true,
    sourceId,
    reviewPacketCandidateOnly: true,
    successfulEphemeralRegistration: true,
    nonSsdMutationRejected: true,
    casMismatchRejected: true,
    duplicateRejected: true,
    receiptTamperRejected: true,
    staleMethodRegistrationRejected: true,
    missingGlobalRegistryRejected: true,
    runtimeEligible: 0,
    releaseEligible: 0,
  }, null, 2))
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true })
}

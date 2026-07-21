#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto"
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { dirname, join, relative, resolve } from "node:path"

import {
  assertDnaCandidateClaimExtractionDecision,
  assertDnaCandidateClaimReviewPacket,
  compileDnaCandidateClaimExtraction,
  createDnaCandidateClaimReviewPacket,
  hashDnaCandidateClaimPayload,
  isDnaCandidateClaimExtractionResultValid,
  type DnaCandidateClaimExtractionDecision,
  type DnaCandidateClaimExtractionResult,
  type DnaCandidateClaimReviewPacket,
} from "../src/lib/dna/chat/governance/candidateClaimExtraction"
import type {
  DnaCandidatePassageRegistrationResult,
} from "../src/lib/dna/chat/governance/candidatePassageRegistration"
import type { DnaBlindExtractionLane } from "../src/lib/dna/chat/governance/evidenceExtraction"
import {
  getDnaCandidatePassageRegistrationStatus,
  loadDnaCandidatePassageSourceAuthority,
  type CandidatePassageRegistrationIndex,
} from "./run-dna-candidate-passage-registration-worker"

type ClaimLaneRecord = Readonly<{
  lane: DnaBlindExtractionLane
  packetRelativePath: string
  packetFileSha256: string
  packetSha256: string
  decisionRelativePath: string
  decisionFileSha256: string
  decisionSha256: string
  resultRelativePath: string
  resultFileSha256: string
  resultSha256: string
  runSha256: string
  receiptRelativePath: string
  receiptFileSha256: string
  receiptSha256: string
  expectedPreviousIndexFileSha256: string
  runtimeEligible: false
  releaseEligible: false
}>

export type CandidateClaimSourceRecord = Readonly<{
  sourceId: string
  status: "pass_a_complete" | "pass_b_complete" | "awaiting_reconciliation"
  passageRegistrationResultFileSha256: string
  passageRegistrationResultSha256: string
  passA: ClaimLaneRecord | null
  passB: ClaimLaneRecord | null
  runtimeEligible: false
  releaseEligible: false
}>

export type CandidateClaimExtractionIndex = Readonly<{
  schemaVersion: "dna-candidate-claim-extraction-index@1"
  authority: "candidate_audit"
  records: readonly CandidateClaimSourceRecord[]
  claimRunCollectionSha256: string
  counts: Readonly<{
    sources: number
    passAComplete: number
    passBComplete: number
    awaitingReconciliation: number
    candidateRuns: number
    candidateClaims: number
    runtimeEligible: 0
    releaseEligible: 0
  }>
  canonicalPayloadSha256: string
}>

type ClaimReceipt = Readonly<{
  schemaVersion: "dna-candidate-claim-extraction-receipt@1"
  receiptId: string
  recordedAt: string
  sourceId: string
  lane: DnaBlindExtractionLane
  expectedPreviousIndexFileSha256: string
  packetFileSha256: string
  packetSha256: string
  decisionFileSha256: string
  decisionSha256: string
  resultFileSha256: string
  resultSha256: string
  runSha256: string
  passageRegistrationResultFileSha256: string
  passageRegistrationResultSha256: string
  runtimeEligible: false
  releaseEligible: false
  canonicalPayloadSha256: string
}>

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const SOURCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,199}$/

function option(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length)
}

function requiredOption(name: string): string {
  const value = option(name)
  if (!value) throw new Error(`candidate_claim_worker:missing_option:${name}`)
  return value
}

function requiredLane(): DnaBlindExtractionLane {
  const lane = requiredOption("lane").toUpperCase()
  if (lane !== "A" && lane !== "B") throw new Error("candidate_claim_worker:invalid_lane")
  return lane
}

function fileSha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function jsonBytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function fileSha256FromValue(value: unknown): string {
  return createHash("sha256").update(jsonBytes(value)).digest("hex")
}

function assertContained(root: string, target: string, code: string): void {
  const child = relative(resolve(root), resolve(target))
  if (child === ".." || child.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) {
    throw new Error(code)
  }
}

function atomicWriteBuffer(path: string, bytes: Buffer): void {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.tmp-${process.pid}-${randomUUID()}`
  try {
    writeFileSync(temporary, bytes, { flag: "wx", mode: 0o600 })
    renameSync(temporary, path)
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary)
  }
}

function atomicWrite(path: string, value: unknown): void {
  atomicWriteBuffer(path, jsonBytes(value))
}

function restoreFile(path: string, previous: Buffer | null): void {
  if (previous === null) {
    if (existsSync(path)) unlinkSync(path)
    return
  }
  atomicWriteBuffer(path, previous)
}

function claimRoot(researchRoot: string): string {
  return join(resolve(researchRoot),
    "Datasets/DNA-Intelligence/work/v3/candidate-claim-extractions/v1")
}

function passageRoot(researchRoot: string): string {
  return join(resolve(researchRoot),
    "Datasets/DNA-Intelligence/work/v3/candidate-passage-registrations/v1")
}

type ClaimAuthority = Readonly<{
  passageResult: DnaCandidatePassageRegistrationResult
  passageResultPath: string
  passageResultFileSha256: string
  sourceAuthority: ReturnType<typeof loadDnaCandidatePassageSourceAuthority>
}>

function loadClaimAuthority(researchRoot: string, sourceId: string): ClaimAuthority {
  if (!SOURCE_ID_PATTERN.test(sourceId)) throw new Error("candidate_claim_worker:invalid_source_id")
  const status = getDnaCandidatePassageRegistrationStatus(researchRoot)
  if (!status.ok || status.state !== "valid") {
    throw new Error("candidate_claim_worker:passage_registration_state_invalid")
  }
  const root = passageRoot(researchRoot)
  const index = readJson<CandidatePassageRegistrationIndex>(join(root, "index.json"))
  const record = index.records.find((entry) => entry.sourceId === sourceId)
  if (!record || record.status !== "candidate_passages_registered"
    || record.runtimeEligible !== false || record.releaseEligible !== false) {
    throw new Error("candidate_claim_worker:passage_registration_missing")
  }
  const passageResultPath = join(root, record.resultRelativePath)
  assertContained(root, passageResultPath, "candidate_claim_worker:passage_result_path_escape")
  if (!existsSync(passageResultPath)
    || fileSha256(passageResultPath) !== record.resultFileSha256) {
    throw new Error("candidate_claim_worker:passage_result_file_invalid")
  }
  const passageResult = readJson<DnaCandidatePassageRegistrationResult>(passageResultPath)
  if (passageResult.resultSha256 !== record.resultSha256) {
    throw new Error("candidate_claim_worker:passage_result_payload_invalid")
  }
  const sourceAuthority = loadDnaCandidatePassageSourceAuthority(researchRoot, sourceId)
  return {
    passageResult,
    passageResultPath,
    passageResultFileSha256: record.resultFileSha256,
    sourceAuthority,
  }
}

function packetPath(root: string, sourceId: string, lane: DnaBlindExtractionLane): string {
  return join(root, "packets", sourceId, `pass-${lane.toLowerCase()}`, "r000001.json")
}

export function prepareDnaCandidateClaimReviewPacket(input: Readonly<{
  researchRoot: string
  sourceId: string
  lane: DnaBlindExtractionLane
}>): unknown {
  const authority = loadClaimAuthority(input.researchRoot, input.sourceId)
  const packet = createDnaCandidateClaimReviewPacket({
    lane: input.lane,
    passageRegistrationResult: authority.passageResult,
    passageRegistrationResultFileSha256: authority.passageResultFileSha256,
    methodRegistrationResult: authority.sourceAuthority.methodRegistrationResult,
  })
  const path = packetPath(claimRoot(input.researchRoot), input.sourceId, input.lane)
  atomicWrite(path, packet)
  return {
    ok: true,
    sourceId: input.sourceId,
    lane: input.lane,
    packetPath: path,
    packetFileSha256: fileSha256(path),
    packetSha256: packet.packetSha256,
    passageCount: packet.passages.length,
    runtimeEligible: false,
    releaseEligible: false,
  }
}

function loadCompileInputs(input: Readonly<{
  researchRoot: string
  sourceId: string
  lane: DnaBlindExtractionLane
  packetInputPath: string
  decisionInputPath: string
}>) {
  const authority = loadClaimAuthority(input.researchRoot, input.sourceId)
  const packetInputPath = resolve(input.packetInputPath)
  const decisionInputPath = resolve(input.decisionInputPath)
  if (!existsSync(packetInputPath) || !existsSync(decisionInputPath)) {
    throw new Error("candidate_claim_worker:packet_or_decision_missing")
  }
  const packet = readJson<DnaCandidateClaimReviewPacket>(packetInputPath)
  const decision = readJson<DnaCandidateClaimExtractionDecision>(decisionInputPath)
  assertDnaCandidateClaimReviewPacket(packet)
  assertDnaCandidateClaimExtractionDecision(decision)
  if (packet.lane !== input.lane || decision.lane !== input.lane) {
    throw new Error("candidate_claim_worker:lane_binding_mismatch")
  }
  return {
    decision,
    packet,
    packetFileSha256: fileSha256(packetInputPath),
    passageRegistrationResult: authority.passageResult,
    passageRegistrationResultFileSha256: authority.passageResultFileSha256,
    parsedArtifact: authority.sourceAuthority.parsedArtifact,
  }
}

function buildRunCollection(root: string, results: readonly DnaCandidateClaimExtractionResult[]) {
  const runs = results.map((result) => result.run)
    .sort((left, right) => `${left.sourceId}:${left.lane}`
      .localeCompare(`${right.sourceId}:${right.lane}`, "en"))
  return {
    runs,
    sha256: hashDnaCandidateClaimPayload(runs),
    path: join(root, "candidate-claim-runs.json"),
  }
}

function buildIndex(records: readonly CandidateClaimSourceRecord[],
  collectionSha256: string, results: readonly DnaCandidateClaimExtractionResult[]) {
  const sorted = [...records].sort((left, right) => left.sourceId.localeCompare(right.sourceId, "en"))
  const payload = {
    schemaVersion: "dna-candidate-claim-extraction-index@1" as const,
    authority: "candidate_audit" as const,
    records: sorted,
    claimRunCollectionSha256: collectionSha256,
    counts: {
      sources: sorted.length,
      passAComplete: sorted.filter((record) => record.passA !== null).length,
      passBComplete: sorted.filter((record) => record.passB !== null).length,
      awaitingReconciliation: sorted.filter((record) => record.status === "awaiting_reconciliation").length,
      candidateRuns: results.length,
      candidateClaims: results.reduce((sum, result) => sum + result.run.claims.length, 0),
      runtimeEligible: 0 as const,
      releaseEligible: 0 as const,
    },
  }
  return {
    ...payload,
    canonicalPayloadSha256: hashDnaCandidateClaimPayload(payload),
  } satisfies CandidateClaimExtractionIndex
}

function assertLaneRecord(record: ClaimLaneRecord, lane: DnaBlindExtractionLane): void {
  if (record.lane !== lane || record.runtimeEligible !== false || record.releaseEligible !== false
    || [record.packetFileSha256, record.packetSha256, record.decisionFileSha256,
      record.decisionSha256, record.resultFileSha256, record.resultSha256, record.runSha256,
      record.receiptFileSha256, record.receiptSha256].some((hash) => !SHA256_PATTERN.test(hash))
    || (record.expectedPreviousIndexFileSha256 !== "absent"
      && !SHA256_PATTERN.test(record.expectedPreviousIndexFileSha256))) {
    throw new Error("candidate_claim_worker:lane_record_invalid")
  }
}

function assertIndex(index: CandidateClaimExtractionIndex): void {
  const { canonicalPayloadSha256, ...payload } = index
  const sourceIds = index.records.map((record) => record.sourceId)
  const sorted = [...sourceIds].sort((left, right) => left.localeCompare(right, "en"))
  if (index.schemaVersion !== "dna-candidate-claim-extraction-index@1"
    || index.authority !== "candidate_audit"
    || canonicalPayloadSha256 !== hashDnaCandidateClaimPayload(payload)
    || JSON.stringify(sourceIds) !== JSON.stringify(sorted)
    || new Set(sourceIds).size !== sourceIds.length
    || index.counts.sources !== index.records.length
    || index.counts.runtimeEligible !== 0 || index.counts.releaseEligible !== 0) {
    throw new Error("candidate_claim_worker:index_invalid")
  }
  for (const record of index.records) {
    if (!SOURCE_ID_PATTERN.test(record.sourceId)
      || !SHA256_PATTERN.test(record.passageRegistrationResultFileSha256)
      || !SHA256_PATTERN.test(record.passageRegistrationResultSha256)
      || record.runtimeEligible !== false || record.releaseEligible !== false
      || (!record.passA && !record.passB)
      || record.status !== (record.passA && record.passB
        ? "awaiting_reconciliation" : record.passA ? "pass_a_complete" : "pass_b_complete")) {
      throw new Error("candidate_claim_worker:source_record_invalid")
    }
    if (record.passA) assertLaneRecord(record.passA, "A")
    if (record.passB) assertLaneRecord(record.passB, "B")
  }
}

function receiptValid(receipt: ClaimReceipt): boolean {
  const { canonicalPayloadSha256, ...payload } = receipt
  return receipt.schemaVersion === "dna-candidate-claim-extraction-receipt@1"
    && canonicalPayloadSha256 === hashDnaCandidateClaimPayload(payload)
    && Number.isFinite(Date.parse(receipt.recordedAt))
    && new Date(Date.parse(receipt.recordedAt)).toISOString() === receipt.recordedAt
    && receipt.runtimeEligible === false && receipt.releaseEligible === false
}

function resultArtifacts(root: string, record: ClaimLaneRecord) {
  return {
    packetPath: join(root, record.packetRelativePath),
    decisionPath: join(root, record.decisionRelativePath),
    resultPath: join(root, record.resultRelativePath),
    receiptPath: join(root, record.receiptRelativePath),
  }
}

export function getDnaCandidateClaimExtractionStatus(researchRoot: string): {
  ok: boolean
  state: "empty" | "valid" | "invalid"
  indexFileSha256: string
  sources: number
  candidateRuns: number
  candidateClaims: number
  awaitingReconciliation: number
  runtimeEligible: 0
  releaseEligible: 0
  issues: string[]
} {
  const root = claimRoot(researchRoot)
  const indexPath = join(root, "index.json")
  if (!existsSync(indexPath)) {
    const unexpected = existsSync(root) && readdirSync(root)
      .some((entry) => !["packets", "index.lock"].includes(entry))
    return {
      ok: !unexpected,
      state: unexpected ? "invalid" : "empty",
      indexFileSha256: "absent",
      sources: 0,
      candidateRuns: 0,
      candidateClaims: 0,
      awaitingReconciliation: 0,
      runtimeEligible: 0,
      releaseEligible: 0,
      issues: unexpected ? ["candidate_claim_state_without_index"] : [],
    }
  }
  const issues: string[] = []
  let index: CandidateClaimExtractionIndex
  try {
    index = readJson<CandidateClaimExtractionIndex>(indexPath)
    assertIndex(index)
  } catch (error) {
    return {
      ok: false,
      state: "invalid",
      indexFileSha256: fileSha256(indexPath),
      sources: 0,
      candidateRuns: 0,
      candidateClaims: 0,
      awaitingReconciliation: 0,
      runtimeEligible: 0,
      releaseEligible: 0,
      issues: [error instanceof Error ? error.message : "candidate_claim_worker:index_invalid"],
    }
  }
  const results: DnaCandidateClaimExtractionResult[] = []
  for (const sourceRecord of index.records) {
    for (const laneRecord of [sourceRecord.passA, sourceRecord.passB]) {
      if (!laneRecord) continue
      try {
        const paths = resultArtifacts(root, laneRecord)
        for (const [path, expected] of [
          [paths.packetPath, laneRecord.packetFileSha256],
          [paths.decisionPath, laneRecord.decisionFileSha256],
          [paths.resultPath, laneRecord.resultFileSha256],
          [paths.receiptPath, laneRecord.receiptFileSha256],
        ] as const) {
          assertContained(root, path, "candidate_claim_worker:registered_path_escape")
          if (!existsSync(path) || fileSha256(path) !== expected) {
            throw new Error("registered_file_hash_mismatch")
          }
        }
        const result = readJson<DnaCandidateClaimExtractionResult>(paths.resultPath)
        const receipt = readJson<ClaimReceipt>(paths.receiptPath)
        if (!isDnaCandidateClaimExtractionResultValid(result)
          || !receiptValid(receipt)
          || result.resultSha256 !== laneRecord.resultSha256
          || result.run.runSha256 !== laneRecord.runSha256
          || receipt.canonicalPayloadSha256 !== laneRecord.receiptSha256
          || receipt.resultSha256 !== laneRecord.resultSha256
          || receipt.decisionSha256 !== laneRecord.decisionSha256
          || receipt.packetSha256 !== laneRecord.packetSha256
          || receipt.passageRegistrationResultFileSha256
            !== sourceRecord.passageRegistrationResultFileSha256
          || receipt.passageRegistrationResultSha256
            !== sourceRecord.passageRegistrationResultSha256) {
          throw new Error("registered_payload_mismatch")
        }
        const recompiled = compileDnaCandidateClaimExtraction(loadCompileInputs({
          researchRoot,
          sourceId: sourceRecord.sourceId,
          lane: laneRecord.lane,
          packetInputPath: paths.packetPath,
          decisionInputPath: paths.decisionPath,
        }))
        if (recompiled.resultSha256 !== result.resultSha256) {
          throw new Error("current_source_recompile_mismatch")
        }
        results.push(result)
      } catch (error) {
        issues.push(`${sourceRecord.sourceId}:${laneRecord.lane}:${error instanceof Error ? error.message : "invalid"}`)
      }
    }
  }
  const sourceDirectories = existsSync(join(root, "sources"))
    ? readdirSync(join(root, "sources"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory()).map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right, "en"))
    : []
  if (JSON.stringify(sourceDirectories)
    !== JSON.stringify(index.records.map((record) => record.sourceId))) {
    issues.push("source_directory_index_mismatch")
  }
  const collection = buildRunCollection(root, results)
  if (!existsSync(collection.path)
    || fileSha256(collection.path) !== fileSha256FromValue(collection.runs)
    || collection.sha256 !== index.claimRunCollectionSha256) {
    issues.push("candidate_claim_run_collection_mismatch")
  }
  return {
    ok: issues.length === 0,
    state: issues.length === 0 ? "valid" : "invalid",
    indexFileSha256: fileSha256(indexPath),
    sources: index.counts.sources,
    candidateRuns: index.counts.candidateRuns,
    candidateClaims: index.counts.candidateClaims,
    awaitingReconciliation: index.counts.awaitingReconciliation,
    runtimeEligible: 0,
    releaseEligible: 0,
    issues,
  }
}

export function ingestDnaCandidateClaimExtraction(input: Readonly<{
  researchRoot: string
  sourceId: string
  lane: DnaBlindExtractionLane
  packetInputPath: string
  decisionInputPath: string
  expectedIndexSha: string
  allowNonSsdForTests?: boolean
  now?: () => string
}>): unknown {
  if (input.expectedIndexSha !== "absent" && !SHA256_PATTERN.test(input.expectedIndexSha)) {
    throw new Error("candidate_claim_worker:invalid_expected_index_hash")
  }
  const resolvedResearchRoot = resolve(input.researchRoot)
  if (!input.allowNonSsdForTests && resolvedResearchRoot !== "/Volumes/ResearchSSD"
    && !resolvedResearchRoot.startsWith("/Volumes/ResearchSSD/")) {
    throw new Error("candidate_claim_worker:research_root_must_be_research_ssd")
  }
  const root = claimRoot(input.researchRoot)
  mkdirSync(root, { recursive: true })
  const indexPath = join(root, "index.json")
  const collectionPath = join(root, "candidate-claim-runs.json")
  const observedSha = existsSync(indexPath) ? fileSha256(indexPath) : "absent"
  if (observedSha !== input.expectedIndexSha) throw new Error("candidate_claim_worker:index_cas_mismatch")
  const lockPath = join(root, "index.lock")
  let lock: number | null = null
  try {
    lock = openSync(lockPath, "wx", 0o600)
  } catch {
    throw new Error("candidate_claim_worker:index_locked")
  }
  let previousIndexBytes: Buffer | null = null
  let previousCollectionBytes: Buffer | null = null
  let createdLaneRoot: string | null = null
  let committed = false
  try {
    const lockedSha = existsSync(indexPath) ? fileSha256(indexPath) : "absent"
    if (lockedSha !== input.expectedIndexSha) {
      throw new Error("candidate_claim_worker:index_cas_mismatch_after_lock")
    }
    previousIndexBytes = existsSync(indexPath) ? readFileSync(indexPath) : null
    const previousIndex = previousIndexBytes
      ? JSON.parse(previousIndexBytes.toString("utf8")) as CandidateClaimExtractionIndex : null
    if (previousIndex) assertIndex(previousIndex)
    previousCollectionBytes = existsSync(collectionPath) ? readFileSync(collectionPath) : null
    const existing = previousIndex?.records.find((record) => record.sourceId === input.sourceId)
    if ((input.lane === "A" && existing?.passA) || (input.lane === "B" && existing?.passB)) {
      throw new Error("candidate_claim_worker:lane_already_registered")
    }
    const compileInputs = loadCompileInputs(input)
    const result = compileDnaCandidateClaimExtraction(compileInputs)
    const previousResults = (previousIndex?.records ?? []).flatMap((record) =>
      [record.passA, record.passB].filter((lane): lane is ClaimLaneRecord => lane !== null)
        .map((lane) => {
          const path = join(root, lane.resultRelativePath)
          if (!existsSync(path) || fileSha256(path) !== lane.resultFileSha256) {
            throw new Error("candidate_claim_worker:previous_result_file_invalid")
          }
          const previousResult = readJson<DnaCandidateClaimExtractionResult>(path)
          if (!isDnaCandidateClaimExtractionResultValid(previousResult)) {
            throw new Error("candidate_claim_worker:previous_result_payload_invalid")
          }
          return previousResult
        }))
    const allResults = [...previousResults, result]
    const collection = buildRunCollection(root, allResults)
    const sourceRoot = join(root, "sources", input.sourceId)
    const laneName = `pass-${input.lane.toLowerCase()}`
    const laneRoot = join(sourceRoot, laneName)
    assertContained(root, laneRoot, "candidate_claim_worker:lane_path_escape")
    if (existsSync(laneRoot)) throw new Error("candidate_claim_worker:lane_artifact_exists")
    const packetDestination = join(laneRoot, "packet.json")
    const decisionDestination = join(laneRoot, "decision.json")
    const resultDestination = join(laneRoot, "result.json")
    const receiptDestination = join(laneRoot, "receipt.json")
    const packetBytes = readFileSync(resolve(input.packetInputPath))
    const decisionBytes = readFileSync(resolve(input.decisionInputPath))
    const resultBytes = jsonBytes(result)
    const packetFileSha256 = createHash("sha256").update(packetBytes).digest("hex")
    const decisionFileSha256 = createHash("sha256").update(decisionBytes).digest("hex")
    const resultFileSha256 = createHash("sha256").update(resultBytes).digest("hex")
    const receiptPayload = {
      schemaVersion: "dna-candidate-claim-extraction-receipt@1" as const,
      receiptId: `candidate-claim:${input.sourceId}:${input.lane}:${result.resultSha256.slice(0, 16)}`,
      recordedAt: (input.now ?? (() => new Date().toISOString()))(),
      sourceId: input.sourceId,
      lane: input.lane,
      expectedPreviousIndexFileSha256: input.expectedIndexSha,
      packetFileSha256,
      packetSha256: compileInputs.packet.packetSha256,
      decisionFileSha256,
      decisionSha256: compileInputs.decision.decisionSha256,
      resultFileSha256,
      resultSha256: result.resultSha256,
      runSha256: result.run.runSha256,
      passageRegistrationResultFileSha256:
        compileInputs.passageRegistrationResultFileSha256,
      passageRegistrationResultSha256:
        compileInputs.passageRegistrationResult.resultSha256,
      runtimeEligible: false as const,
      releaseEligible: false as const,
    }
    const receipt: ClaimReceipt = {
      ...receiptPayload,
      canonicalPayloadSha256: hashDnaCandidateClaimPayload(receiptPayload),
    }
    const receiptBytes = jsonBytes(receipt)
    const laneRecord: ClaimLaneRecord = {
      lane: input.lane,
      packetRelativePath: relative(root, packetDestination),
      packetFileSha256,
      packetSha256: compileInputs.packet.packetSha256,
      decisionRelativePath: relative(root, decisionDestination),
      decisionFileSha256,
      decisionSha256: compileInputs.decision.decisionSha256,
      resultRelativePath: relative(root, resultDestination),
      resultFileSha256,
      resultSha256: result.resultSha256,
      runSha256: result.run.runSha256,
      receiptRelativePath: relative(root, receiptDestination),
      receiptFileSha256: createHash("sha256").update(receiptBytes).digest("hex"),
      receiptSha256: receipt.canonicalPayloadSha256,
      expectedPreviousIndexFileSha256: input.expectedIndexSha,
      runtimeEligible: false,
      releaseEligible: false,
    }
    const nextSource: CandidateClaimSourceRecord = {
      sourceId: input.sourceId,
      status: input.lane === "A"
        ? (existing?.passB ? "awaiting_reconciliation" : "pass_a_complete")
        : (existing?.passA ? "awaiting_reconciliation" : "pass_b_complete"),
      passageRegistrationResultFileSha256:
        compileInputs.passageRegistrationResultFileSha256,
      passageRegistrationResultSha256: compileInputs.passageRegistrationResult.resultSha256,
      passA: input.lane === "A" ? laneRecord : existing?.passA ?? null,
      passB: input.lane === "B" ? laneRecord : existing?.passB ?? null,
      runtimeEligible: false,
      releaseEligible: false,
    }
    if (existing && (existing.passageRegistrationResultFileSha256
      !== nextSource.passageRegistrationResultFileSha256
      || existing.passageRegistrationResultSha256
        !== nextSource.passageRegistrationResultSha256)) {
      throw new Error("candidate_claim_worker:cross_lane_passage_binding_mismatch")
    }
    const records = [
      ...(previousIndex?.records.filter((record) => record.sourceId !== input.sourceId) ?? []),
      nextSource,
    ]
    const index = buildIndex(records, collection.sha256, allResults)
    const transactionRoot = join(root, `.transaction-${process.pid}-${randomUUID()}`)
    const stagedLane = join(transactionRoot, laneName)
    mkdirSync(stagedLane, { recursive: true })
    writeFileSync(join(stagedLane, "packet.json"), packetBytes, { flag: "wx", mode: 0o600 })
    writeFileSync(join(stagedLane, "decision.json"), decisionBytes, { flag: "wx", mode: 0o600 })
    writeFileSync(join(stagedLane, "result.json"), resultBytes, { flag: "wx", mode: 0o600 })
    writeFileSync(join(stagedLane, "receipt.json"), receiptBytes, { flag: "wx", mode: 0o600 })
    try {
      mkdirSync(sourceRoot, { recursive: true })
      renameSync(stagedLane, laneRoot)
      createdLaneRoot = laneRoot
      atomicWrite(collection.path, collection.runs)
      atomicWrite(indexPath, index)
      committed = true
    } finally {
      if (existsSync(transactionRoot)) rmSync(transactionRoot, { recursive: true, force: true })
    }
    return {
      ok: true,
      sourceId: input.sourceId,
      lane: input.lane,
      resultPath: resultDestination,
      receiptPath: receiptDestination,
      indexPath,
      indexFileSha256: fileSha256(indexPath),
      candidateRuns: index.counts.candidateRuns,
      candidateClaims: index.counts.candidateClaims,
      status: nextSource.status,
      resultSha256: result.resultSha256,
      runSha256: result.run.runSha256,
      runtimeEligible: false,
      releaseEligible: false,
    }
  } catch (error) {
    if (!committed) {
      restoreFile(indexPath, previousIndexBytes)
      restoreFile(collectionPath, previousCollectionBytes)
      if (createdLaneRoot && existsSync(createdLaneRoot)) {
        rmSync(createdLaneRoot, { recursive: true, force: true })
        const sourceRoot = dirname(createdLaneRoot)
        if (existsSync(sourceRoot) && readdirSync(sourceRoot).length === 0) rmSync(sourceRoot)
      }
    }
    throw error
  } finally {
    if (lock !== null) closeSync(lock)
    if (existsSync(lockPath)) unlinkSync(lockPath)
  }
}

export function runDnaCandidateClaimExtractionWorkerCli(): void {
  const command = process.argv[2]
  const researchRoot = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
  if (command === "status") {
    const result = getDnaCandidateClaimExtractionStatus(researchRoot)
    console.log(JSON.stringify(result, null, 2))
    if (process.argv.includes("--strict") && !result.ok) process.exitCode = 1
    return
  }
  if (command === "prepare") {
    console.log(JSON.stringify(prepareDnaCandidateClaimReviewPacket({
      researchRoot,
      sourceId: requiredOption("source"),
      lane: requiredLane(),
    }), null, 2))
    return
  }
  if (command === "ingest") {
    console.log(JSON.stringify(ingestDnaCandidateClaimExtraction({
      researchRoot,
      sourceId: requiredOption("source"),
      lane: requiredLane(),
      packetInputPath: requiredOption("packet"),
      decisionInputPath: requiredOption("input"),
      expectedIndexSha: requiredOption("expected-index-sha"),
    }), null, 2))
    return
  }
  throw new Error("candidate_claim_worker:invalid_or_missing_command")
}

if (require.main === module) {
  try {
    runDnaCandidateClaimExtractionWorkerCli()
  } catch (error) {
    console.error(error instanceof Error ? error.message : "candidate_claim_worker:unknown_error")
    process.exitCode = 1
  }
}

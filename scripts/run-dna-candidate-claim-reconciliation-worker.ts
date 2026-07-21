#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto"
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { dirname, join, relative, resolve } from "node:path"

import {
  compileDnaCandidateClaimReconciliation,
  hashDnaCandidateClaimReconciliationPayload,
  isDnaCandidateClaimReconciliationResultValid,
  type DnaCandidateClaimReconciliationDecision,
  type DnaCandidateClaimReconciliationResult,
} from "../src/lib/dna/chat/governance/candidateClaimReconciliation"
import {
  isDnaCandidateClaimExtractionResultValid,
  type DnaCandidateClaimExtractionResult,
} from "../src/lib/dna/chat/governance/candidateClaimExtraction"
import {
  getDnaCandidateClaimExtractionStatus,
  type CandidateClaimExtractionIndex,
} from "./run-dna-candidate-claim-extraction-worker"

type ReconciliationPacket = Readonly<{
  schemaVersion: "dna-candidate-claim-reconciliation-packet@1"
  status: "candidate_only"
  runtimeEligible: false
  releaseEligible: false
  sourceId: string
  candidateClaimIndexFileSha256: string
  passAResultFileSha256: string
  passBResultFileSha256: string
  passAResult: DnaCandidateClaimExtractionResult
  passBResult: DnaCandidateClaimExtractionResult
  instructions: readonly string[]
  packetSha256: string
}>

type ReconciliationRecord = Readonly<{
  sourceId: string
  status: "candidate_reconciled_unregistered"
  decisionRelativePath: string
  decisionFileSha256: string
  decisionSha256: string
  resultRelativePath: string
  resultFileSha256: string
  resultSha256: string
  receiptRelativePath: string
  receiptFileSha256: string
  receiptSha256: string
  candidateClaimIndexFileSha256: string
  passAResultSha256: string
  passBResultSha256: string
  runtimeEligible: false
  releaseEligible: false
}>

export type CandidateClaimReconciliationIndex = Readonly<{
  schemaVersion: "dna-candidate-claim-reconciliation-index@1"
  authority: "candidate_audit"
  records: readonly ReconciliationRecord[]
  resultCollectionSha256: string
  counts: Readonly<{
    sources: number
    reconciliations: number
    exactConsensus: number
    contested: number
    quarantined: number
    unmatchedA: number
    unmatchedB: number
    runtimeEligible: 0
    releaseEligible: 0
  }>
  canonicalPayloadSha256: string
}>

type ReconciliationReceipt = Readonly<{
  schemaVersion: "dna-candidate-claim-reconciliation-receipt@1"
  receiptId: string
  recordedAt: string
  sourceId: string
  expectedPreviousIndexFileSha256: string
  candidateClaimIndexFileSha256: string
  decisionFileSha256: string
  decisionSha256: string
  resultFileSha256: string
  resultSha256: string
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
  if (!value) throw new Error(`candidate_claim_reconciliation_worker:missing_option:${name}`)
  return value
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

function rootPath(researchRoot: string): string {
  return join(resolve(researchRoot),
    "Datasets/DNA-Intelligence/work/v3/candidate-claim-reconciliations/v1")
}

function extractionRoot(researchRoot: string): string {
  return join(resolve(researchRoot),
    "Datasets/DNA-Intelligence/work/v3/candidate-claim-extractions/v1")
}

function assertContained(root: string, path: string): void {
  const child = relative(resolve(root), resolve(path))
  if (child === ".." || child.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) {
    throw new Error("candidate_claim_reconciliation_worker:path_escape")
  }
}

type BoundResults = Readonly<{
  candidateClaimIndexFileSha256: string
  passAResultPath: string
  passBResultPath: string
  passAResultFileSha256: string
  passBResultFileSha256: string
  passAResult: DnaCandidateClaimExtractionResult
  passBResult: DnaCandidateClaimExtractionResult
}>

function loadBoundResults(researchRoot: string, sourceId: string): BoundResults {
  if (!SOURCE_ID_PATTERN.test(sourceId)) {
    throw new Error("candidate_claim_reconciliation_worker:invalid_source_id")
  }
  const status = getDnaCandidateClaimExtractionStatus(researchRoot)
  if (!status.ok || status.state !== "valid") {
    throw new Error("candidate_claim_reconciliation_worker:claim_extraction_state_invalid")
  }
  const root = extractionRoot(researchRoot)
  const indexPath = join(root, "index.json")
  const index = readJson<CandidateClaimExtractionIndex>(indexPath)
  const record = index.records.find((entry) => entry.sourceId === sourceId)
  if (!record || record.status !== "awaiting_reconciliation"
    || !record.passA || !record.passB) {
    throw new Error("candidate_claim_reconciliation_worker:blind_pair_missing")
  }
  const passAResultPath = join(root, record.passA.resultRelativePath)
  const passBResultPath = join(root, record.passB.resultRelativePath)
  assertContained(root, passAResultPath)
  assertContained(root, passBResultPath)
  for (const [path, expected] of [
    [passAResultPath, record.passA.resultFileSha256],
    [passBResultPath, record.passB.resultFileSha256],
  ] as const) {
    if (!existsSync(path) || fileSha256(path) !== expected) {
      throw new Error("candidate_claim_reconciliation_worker:result_file_invalid")
    }
  }
  const passAResult = readJson<DnaCandidateClaimExtractionResult>(passAResultPath)
  const passBResult = readJson<DnaCandidateClaimExtractionResult>(passBResultPath)
  if (!isDnaCandidateClaimExtractionResultValid(passAResult)
    || !isDnaCandidateClaimExtractionResultValid(passBResult)
    || passAResult.lane !== "A" || passBResult.lane !== "B"
    || passAResult.sourceId !== sourceId || passBResult.sourceId !== sourceId
    || passAResult.resultSha256 !== record.passA.resultSha256
    || passBResult.resultSha256 !== record.passB.resultSha256) {
    throw new Error("candidate_claim_reconciliation_worker:result_payload_invalid")
  }
  return {
    candidateClaimIndexFileSha256: fileSha256(indexPath),
    passAResultPath,
    passBResultPath,
    passAResultFileSha256: record.passA.resultFileSha256,
    passBResultFileSha256: record.passB.resultFileSha256,
    passAResult,
    passBResult,
  }
}

export function prepareDnaCandidateClaimReconciliationPacket(input: Readonly<{
  researchRoot: string
  sourceId: string
}>): Readonly<{
  ok: true
  packetPath: string
  packetFileSha256: string
  packetSha256: string
  passAClaims: number
  passBClaims: number
  runtimeEligible: false
  releaseEligible: false
}> {
  const bound = loadBoundResults(input.researchRoot, input.sourceId)
  const instructions = Object.freeze([
    "Map claims only when both lanes express the same atomic proposition and support boundary.",
    "Do not merge claims merely to maximize agreement or use majority voting.",
    "Record every unpaired claim with an explicit supported reason code.",
    "Do not infer DNA relationships, clinical advice, causality, or evidence certainty.",
  ])
  const payload = {
    schemaVersion: "dna-candidate-claim-reconciliation-packet@1" as const,
    status: "candidate_only" as const,
    runtimeEligible: false as const,
    releaseEligible: false as const,
    sourceId: input.sourceId,
    candidateClaimIndexFileSha256: bound.candidateClaimIndexFileSha256,
    passAResultFileSha256: bound.passAResultFileSha256,
    passBResultFileSha256: bound.passBResultFileSha256,
    passAResult: bound.passAResult,
    passBResult: bound.passBResult,
    instructions,
  }
  const packet: ReconciliationPacket = Object.freeze({
    ...payload,
    packetSha256: hashDnaCandidateClaimReconciliationPayload(payload),
  })
  const path = join(rootPath(input.researchRoot), "packets", input.sourceId, "r000001.json")
  atomicWrite(path, packet)
  return {
    ok: true,
    packetPath: path,
    packetFileSha256: fileSha256(path),
    packetSha256: packet.packetSha256,
    passAClaims: bound.passAResult.run.claims.length,
    passBClaims: bound.passBResult.run.claims.length,
    runtimeEligible: false,
    releaseEligible: false,
  }
}

function buildIndex(
  records: readonly ReconciliationRecord[],
  results: readonly DnaCandidateClaimReconciliationResult[],
): CandidateClaimReconciliationIndex {
  const sortedRecords = [...records].sort((a, b) => a.sourceId.localeCompare(b.sourceId, "en"))
  const counts = {
    sources: sortedRecords.length,
    reconciliations: results.reduce((sum, result) => sum + result.reconciliations.length, 0),
    exactConsensus: results.reduce((sum, result) => sum + result.counts.exactConsensus, 0),
    contested: results.reduce((sum, result) => sum + result.counts.contested, 0),
    quarantined: results.reduce((sum, result) => sum + result.counts.quarantined, 0),
    unmatchedA: results.reduce((sum, result) => sum + result.counts.unmatchedA, 0),
    unmatchedB: results.reduce((sum, result) => sum + result.counts.unmatchedB, 0),
    runtimeEligible: 0 as const,
    releaseEligible: 0 as const,
  }
  const resultCollectionSha256 = hashDnaCandidateClaimReconciliationPayload(
    [...results].sort((a, b) => a.sourceId.localeCompare(b.sourceId, "en")),
  )
  const payload = {
    schemaVersion: "dna-candidate-claim-reconciliation-index@1" as const,
    authority: "candidate_audit" as const,
    records: sortedRecords,
    resultCollectionSha256,
    counts,
  }
  return Object.freeze({
    ...payload,
    canonicalPayloadSha256: hashDnaCandidateClaimReconciliationPayload(payload),
  })
}

function validateStoredState(researchRoot: string): Readonly<{
  ok: boolean
  state: "empty" | "valid" | "invalid"
  indexFileSha256: string
  sources: number
  exactConsensus: number
  contested: number
  quarantined: number
  unmatchedA: number
  unmatchedB: number
  runtimeEligible: number
  releaseEligible: number
  issues: readonly string[]
}> {
  const root = rootPath(researchRoot)
  const indexPath = join(root, "index.json")
  if (!existsSync(indexPath)) return {
    ok: true, state: "empty", indexFileSha256: "absent", sources: 0,
    exactConsensus: 0, contested: 0, quarantined: 0, unmatchedA: 0, unmatchedB: 0,
    runtimeEligible: 0, releaseEligible: 0, issues: [],
  }
  const issues: string[] = []
  let index: CandidateClaimReconciliationIndex | null = null
  const results: DnaCandidateClaimReconciliationResult[] = []
  try {
    index = readJson<CandidateClaimReconciliationIndex>(indexPath)
    const upstreamStatus = getDnaCandidateClaimExtractionStatus(researchRoot)
    const upstreamIndexPath = join(extractionRoot(researchRoot), "index.json")
    if (!upstreamStatus.ok || upstreamStatus.state !== "valid"
      || !existsSync(upstreamIndexPath)) {
      issues.push("candidate_claim_extraction_dependency_invalid")
    }
    const upstreamIndex = existsSync(upstreamIndexPath)
      ? readJson<CandidateClaimExtractionIndex>(upstreamIndexPath)
      : null
    for (const record of index.records) {
      const upstreamRecord = upstreamIndex?.records.find((entry) =>
        entry.sourceId === record.sourceId)
      if (!upstreamRecord?.passA || !upstreamRecord.passB
        || upstreamRecord.passA.resultSha256 !== record.passAResultSha256
        || upstreamRecord.passB.resultSha256 !== record.passBResultSha256) {
        issues.push(`${record.sourceId}:blind_pair_dependency_mismatch`)
      }
      const resultPath = join(root, record.resultRelativePath)
      const decisionPath = join(root, record.decisionRelativePath)
      const receiptPath = join(root, record.receiptRelativePath)
      for (const path of [resultPath, decisionPath, receiptPath]) assertContained(root, path)
      if (!existsSync(resultPath) || fileSha256(resultPath) !== record.resultFileSha256
        || !existsSync(decisionPath) || fileSha256(decisionPath) !== record.decisionFileSha256
        || !existsSync(receiptPath) || fileSha256(receiptPath) !== record.receiptFileSha256) {
        issues.push(`${record.sourceId}:stored_file_invalid`)
        continue
      }
      const result = readJson<DnaCandidateClaimReconciliationResult>(resultPath)
      const receipt = readJson<ReconciliationReceipt>(receiptPath)
      if (!isDnaCandidateClaimReconciliationResultValid(result)
        || result.resultSha256 !== record.resultSha256
        || result.decisionSha256 !== record.decisionSha256
        || receipt.canonicalPayloadSha256 !== record.receiptSha256) {
        issues.push(`${record.sourceId}:stored_payload_invalid`)
        continue
      }
      results.push(result)
    }
    const rebuilt = buildIndex(index.records, results)
    if (results.length !== index.records.length
      || rebuilt.canonicalPayloadSha256 !== index.canonicalPayloadSha256
      || rebuilt.resultCollectionSha256 !== index.resultCollectionSha256) {
      issues.push("index_summary_or_hash_invalid")
    }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "unknown_error")
  }
  return {
    ok: issues.length === 0,
    state: issues.length === 0 ? "valid" : "invalid",
    indexFileSha256: fileSha256(indexPath),
    sources: index?.counts.sources ?? 0,
    exactConsensus: index?.counts.exactConsensus ?? 0,
    contested: index?.counts.contested ?? 0,
    quarantined: index?.counts.quarantined ?? 0,
    unmatchedA: index?.counts.unmatchedA ?? 0,
    unmatchedB: index?.counts.unmatchedB ?? 0,
    runtimeEligible: index?.counts.runtimeEligible ?? 0,
    releaseEligible: index?.counts.releaseEligible ?? 0,
    issues,
  }
}

export const getDnaCandidateClaimReconciliationStatus = validateStoredState

export function ingestDnaCandidateClaimReconciliation(input: Readonly<{
  researchRoot: string
  sourceId: string
  decisionInputPath: string
  expectedIndexSha: string
  allowNonSsdForTests?: boolean
  now?: () => string
}>): Readonly<Record<string, unknown>> {
  const resolvedResearchRoot = resolve(input.researchRoot)
  if (!input.allowNonSsdForTests && resolvedResearchRoot !== "/Volumes/ResearchSSD"
    && !resolvedResearchRoot.startsWith("/Volumes/ResearchSSD/")) {
    throw new Error("candidate_claim_reconciliation_worker:research_root_must_be_research_ssd")
  }
  const root = rootPath(input.researchRoot)
  mkdirSync(root, { recursive: true })
  const lockPath = join(root, ".ingest.lock")
  let lock: number | null = null
  try {
    lock = openSync(lockPath, "wx", 0o600)
  } catch {
    throw new Error("candidate_claim_reconciliation_worker:ingest_locked")
  }
  const indexPath = join(root, "index.json")
  const previousIndexBytes = existsSync(indexPath) ? readFileSync(indexPath) : null
  const previousIndexSha = previousIndexBytes ? fileSha256(indexPath) : "absent"
  let createdSourceRoot: string | null = null
  let committed = false
  try {
    if (previousIndexSha !== input.expectedIndexSha) {
      throw new Error("candidate_claim_reconciliation_worker:stale_index")
    }
    const current = validateStoredState(input.researchRoot)
    if (!current.ok) throw new Error("candidate_claim_reconciliation_worker:stored_state_invalid")
    const previousIndex = previousIndexBytes
      ? JSON.parse(previousIndexBytes.toString("utf8")) as CandidateClaimReconciliationIndex
      : null
    if (previousIndex?.records.some((record) => record.sourceId === input.sourceId)) {
      throw new Error("candidate_claim_reconciliation_worker:duplicate_source")
    }
    const bound = loadBoundResults(input.researchRoot, input.sourceId)
    const decisionPath = resolve(input.decisionInputPath)
    if (!existsSync(decisionPath)) {
      throw new Error("candidate_claim_reconciliation_worker:decision_missing")
    }
    const decision = readJson<DnaCandidateClaimReconciliationDecision>(decisionPath)
    const result = compileDnaCandidateClaimReconciliation({
      decision,
      passAResult: bound.passAResult,
      passAResultFileSha256: bound.passAResultFileSha256,
      passBResult: bound.passBResult,
      passBResultFileSha256: bound.passBResultFileSha256,
    })
    if (!isDnaCandidateClaimReconciliationResultValid(result)) {
      throw new Error("candidate_claim_reconciliation_worker:compiled_result_invalid")
    }
    const decisionBytes = readFileSync(decisionPath)
    const resultBytes = jsonBytes(result)
    const decisionFileSha256 = createHash("sha256").update(decisionBytes).digest("hex")
    const resultFileSha256 = createHash("sha256").update(resultBytes).digest("hex")
    const receiptCore = {
      schemaVersion: "dna-candidate-claim-reconciliation-receipt@1" as const,
      receiptId: `candidate.claim.reconciliation.receipt:${input.sourceId}:r000001`,
      recordedAt: (input.now ?? (() => new Date().toISOString()))(),
      sourceId: input.sourceId,
      expectedPreviousIndexFileSha256: previousIndexSha,
      candidateClaimIndexFileSha256: bound.candidateClaimIndexFileSha256,
      decisionFileSha256,
      decisionSha256: decision.decisionSha256,
      resultFileSha256,
      resultSha256: result.resultSha256,
      runtimeEligible: false as const,
      releaseEligible: false as const,
    }
    const receipt: ReconciliationReceipt = Object.freeze({
      ...receiptCore,
      canonicalPayloadSha256: hashDnaCandidateClaimReconciliationPayload(receiptCore),
    })
    const receiptBytes = jsonBytes(receipt)
    const sourceRoot = join(root, "sources", input.sourceId)
    if (existsSync(sourceRoot)) {
      throw new Error("candidate_claim_reconciliation_worker:duplicate_source_directory")
    }
    const record: ReconciliationRecord = {
      sourceId: input.sourceId,
      status: "candidate_reconciled_unregistered",
      decisionRelativePath: relative(root, join(sourceRoot, "decision.json")),
      decisionFileSha256,
      decisionSha256: decision.decisionSha256,
      resultRelativePath: relative(root, join(sourceRoot, "result.json")),
      resultFileSha256,
      resultSha256: result.resultSha256,
      receiptRelativePath: relative(root, join(sourceRoot, "receipt.json")),
      receiptFileSha256: createHash("sha256").update(receiptBytes).digest("hex"),
      receiptSha256: receipt.canonicalPayloadSha256,
      candidateClaimIndexFileSha256: bound.candidateClaimIndexFileSha256,
      passAResultSha256: bound.passAResult.resultSha256,
      passBResultSha256: bound.passBResult.resultSha256,
      runtimeEligible: false,
      releaseEligible: false,
    }
    const allRecords = [...(previousIndex?.records ?? []), record]
    const existingResults = (previousIndex?.records ?? []).map((entry) =>
      readJson<DnaCandidateClaimReconciliationResult>(join(root, entry.resultRelativePath)))
    const index = buildIndex(allRecords, [...existingResults, result])
    const transactionRoot = join(root, `.transaction-${process.pid}-${randomUUID()}`)
    const stagedSource = join(transactionRoot, input.sourceId)
    mkdirSync(stagedSource, { recursive: true })
    writeFileSync(join(stagedSource, "decision.json"), decisionBytes, { flag: "wx", mode: 0o600 })
    writeFileSync(join(stagedSource, "result.json"), resultBytes, { flag: "wx", mode: 0o600 })
    writeFileSync(join(stagedSource, "receipt.json"), receiptBytes, { flag: "wx", mode: 0o600 })
    try {
      mkdirSync(dirname(sourceRoot), { recursive: true })
      renameSync(stagedSource, sourceRoot)
      createdSourceRoot = sourceRoot
      atomicWrite(indexPath, index)
      committed = true
    } finally {
      if (existsSync(transactionRoot)) rmSync(transactionRoot, { recursive: true, force: true })
    }
    return {
      ok: true,
      sourceId: input.sourceId,
      indexPath,
      indexFileSha256: fileSha256(indexPath),
      resultPath: join(sourceRoot, "result.json"),
      resultSha256: result.resultSha256,
      exactConsensus: result.counts.exactConsensus,
      contested: result.counts.contested,
      quarantined: result.counts.quarantined,
      unmatchedA: result.counts.unmatchedA,
      unmatchedB: result.counts.unmatchedB,
      runtimeEligible: false,
      releaseEligible: false,
    }
  } catch (error) {
    if (!committed) {
      restoreFile(indexPath, previousIndexBytes)
      if (createdSourceRoot && existsSync(createdSourceRoot)) {
        rmSync(createdSourceRoot, { recursive: true, force: true })
      }
    }
    throw error
  } finally {
    if (lock !== null) closeSync(lock)
    if (existsSync(lockPath)) unlinkSync(lockPath)
  }
}

export function runDnaCandidateClaimReconciliationWorkerCli(): void {
  const command = process.argv[2]
  const researchRoot = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
  if (command === "status") {
    const result = validateStoredState(researchRoot)
    console.log(JSON.stringify(result, null, 2))
    if (process.argv.includes("--strict") && !result.ok) process.exitCode = 1
    return
  }
  if (command === "prepare") {
    console.log(JSON.stringify(prepareDnaCandidateClaimReconciliationPacket({
      researchRoot,
      sourceId: requiredOption("source"),
    }), null, 2))
    return
  }
  if (command === "ingest") {
    console.log(JSON.stringify(ingestDnaCandidateClaimReconciliation({
      researchRoot,
      sourceId: requiredOption("source"),
      decisionInputPath: requiredOption("input"),
      expectedIndexSha: requiredOption("expected-index-sha"),
    }), null, 2))
    return
  }
  throw new Error("candidate_claim_reconciliation_worker:invalid_or_missing_command")
}

if (require.main === module) {
  try {
    runDnaCandidateClaimReconciliationWorkerCli()
  } catch (error) {
    console.error(error instanceof Error
      ? error.message
      : "candidate_claim_reconciliation_worker:unknown_error")
    process.exitCode = 1
  }
}

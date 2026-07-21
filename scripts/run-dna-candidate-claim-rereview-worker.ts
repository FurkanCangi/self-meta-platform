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
  compileDnaCandidateClaimRereview,
  hashDnaCandidateClaimRereviewPayload,
  isDnaCandidateClaimRereviewResultValid,
  type DnaCandidateClaimRereviewDecision,
  type DnaCandidateClaimRereviewResult,
} from "../src/lib/dna/chat/governance/candidateClaimRereview"
import {
  isDnaCandidateClaimReconciliationResultValid,
  type DnaCandidateClaimReconciliationResult,
} from "../src/lib/dna/chat/governance/candidateClaimReconciliation"
import {
  isDnaCandidatePassageRegistrationResultValid,
  type DnaCandidatePassageRegistrationResult,
} from "../src/lib/dna/chat/governance/candidatePassageRegistration"
import {
  isDnaCandidateClaimExtractionResultValid,
  type DnaCandidateClaimExtractionResult,
} from "../src/lib/dna/chat/governance/candidateClaimExtraction"
import {
  getDnaCandidateClaimReconciliationStatus,
  type CandidateClaimReconciliationIndex,
} from "./run-dna-candidate-claim-reconciliation-worker"
import {
  getDnaCandidatePassageRegistrationStatus,
  loadDnaCandidatePassageSourceAuthority,
  type CandidatePassageRegistrationIndex,
} from "./run-dna-candidate-passage-registration-worker"

type RereviewPacket = Readonly<{
  schemaVersion: "dna-candidate-claim-rereview-packet@1"
  status: "candidate_only"
  runtimeEligible: false
  releaseEligible: false
  sourceId: string
  reconciliationResultFileSha256: string
  passageRegistrationResultFileSha256: string
  items: readonly Readonly<{
    reconciliation: DnaCandidateClaimReconciliationResult["reconciliations"][number]
    claimA: DnaCandidateClaimExtractionResult["run"]["claims"][number]
    claimB: DnaCandidateClaimExtractionResult["run"]["claims"][number]
  }>[]
  passages: DnaCandidatePassageRegistrationResult["passages"]
  instructions: readonly string[]
  packetSha256: string
}>

type RereviewRecord = Readonly<{
  sourceId: string
  status: "candidate_rereviewed_unregistered"
  decisionRelativePath: string
  decisionFileSha256: string
  decisionSha256: string
  resultRelativePath: string
  resultFileSha256: string
  resultSha256: string
  receiptRelativePath: string
  receiptFileSha256: string
  receiptSha256: string
  reconciliationResultSha256: string
  passageRegistrationResultSha256: string
  runtimeEligible: false
  releaseEligible: false
}>

export type CandidateClaimRereviewIndex = Readonly<{
  schemaVersion: "dna-candidate-claim-rereview-index@1"
  authority: "candidate_audit"
  records: readonly RereviewRecord[]
  resultCollectionSha256: string
  counts: Readonly<{
    sources: number
    rereviews: number
    consensus: number
    contested: number
    quarantined: number
    runtimeEligible: 0
    releaseEligible: 0
  }>
  canonicalPayloadSha256: string
}>

type RereviewReceipt = Readonly<{
  schemaVersion: "dna-candidate-claim-rereview-receipt@1"
  receiptId: string
  recordedAt: string
  sourceId: string
  expectedPreviousIndexFileSha256: string
  decisionFileSha256: string
  decisionSha256: string
  resultFileSha256: string
  resultSha256: string
  reconciliationResultSha256: string
  passageRegistrationResultSha256: string
  runtimeEligible: false
  releaseEligible: false
  canonicalPayloadSha256: string
}>

const SOURCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,199}$/

function option(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length)
}

function requiredOption(name: string): string {
  const value = option(name)
  if (!value) throw new Error(`candidate_claim_rereview_worker:missing_option:${name}`)
  return value
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function fileSha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
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

function restoreFile(path: string, bytes: Buffer | null): void {
  if (bytes === null) {
    if (existsSync(path)) unlinkSync(path)
    return
  }
  atomicWriteBuffer(path, bytes)
}

function rootPath(researchRoot: string): string {
  return join(resolve(researchRoot),
    "Datasets/DNA-Intelligence/work/v3/candidate-claim-rereviews/v1")
}

function reconciliationRoot(researchRoot: string): string {
  return join(resolve(researchRoot),
    "Datasets/DNA-Intelligence/work/v3/candidate-claim-reconciliations/v1")
}

function passageRoot(researchRoot: string): string {
  return join(resolve(researchRoot),
    "Datasets/DNA-Intelligence/work/v3/candidate-passage-registrations/v1")
}

function extractionRoot(researchRoot: string): string {
  return join(resolve(researchRoot),
    "Datasets/DNA-Intelligence/work/v3/candidate-claim-extractions/v1")
}

function assertContained(root: string, path: string): void {
  const child = relative(resolve(root), resolve(path))
  if (child === ".." || child.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) {
    throw new Error("candidate_claim_rereview_worker:path_escape")
  }
}

type BoundInputs = Readonly<{
  reconciliationResult: DnaCandidateClaimReconciliationResult
  reconciliationResultFileSha256: string
  passageResult: DnaCandidatePassageRegistrationResult
  passageResultFileSha256: string
  passAResult: DnaCandidateClaimExtractionResult
  passBResult: DnaCandidateClaimExtractionResult
  parsedArtifact: ReturnType<typeof loadDnaCandidatePassageSourceAuthority>["parsedArtifact"]
}>

function loadBoundInputs(researchRoot: string, sourceId: string): BoundInputs {
  if (!SOURCE_ID_PATTERN.test(sourceId)) {
    throw new Error("candidate_claim_rereview_worker:invalid_source_id")
  }
  const reconciliationStatus = getDnaCandidateClaimReconciliationStatus(researchRoot)
  const passageStatus = getDnaCandidatePassageRegistrationStatus(researchRoot)
  if (!reconciliationStatus.ok || reconciliationStatus.state !== "valid") {
    throw new Error("candidate_claim_rereview_worker:reconciliation_state_invalid")
  }
  if (!passageStatus.ok || passageStatus.state !== "valid") {
    throw new Error("candidate_claim_rereview_worker:passage_state_invalid")
  }

  const reconciliationBase = reconciliationRoot(researchRoot)
  const reconciliationIndex = readJson<CandidateClaimReconciliationIndex>(
    join(reconciliationBase, "index.json"),
  )
  const reconciliationRecord = reconciliationIndex.records.find((record) =>
    record.sourceId === sourceId)
  if (!reconciliationRecord) {
    throw new Error("candidate_claim_rereview_worker:reconciliation_missing")
  }
  const reconciliationPath = join(reconciliationBase, reconciliationRecord.resultRelativePath)
  assertContained(reconciliationBase, reconciliationPath)
  if (!existsSync(reconciliationPath)
    || fileSha256(reconciliationPath) !== reconciliationRecord.resultFileSha256) {
    throw new Error("candidate_claim_rereview_worker:reconciliation_file_invalid")
  }
  const reconciliationResult = readJson<DnaCandidateClaimReconciliationResult>(
    reconciliationPath,
  )
  if (!isDnaCandidateClaimReconciliationResultValid(reconciliationResult)
    || reconciliationResult.resultSha256 !== reconciliationRecord.resultSha256) {
    throw new Error("candidate_claim_rereview_worker:reconciliation_payload_invalid")
  }

  const passageBase = passageRoot(researchRoot)
  const passageIndex = readJson<CandidatePassageRegistrationIndex>(join(passageBase, "index.json"))
  const passageRecord = passageIndex.records.find((record) => record.sourceId === sourceId)
  if (!passageRecord) throw new Error("candidate_claim_rereview_worker:passage_result_missing")
  const passagePath = join(passageBase, passageRecord.resultRelativePath)
  assertContained(passageBase, passagePath)
  if (!existsSync(passagePath) || fileSha256(passagePath) !== passageRecord.resultFileSha256) {
    throw new Error("candidate_claim_rereview_worker:passage_file_invalid")
  }
  const passageResult = readJson<DnaCandidatePassageRegistrationResult>(passagePath)
  if (!isDnaCandidatePassageRegistrationResultValid(passageResult)
    || passageResult.resultSha256 !== passageRecord.resultSha256) {
    throw new Error("candidate_claim_rereview_worker:passage_payload_invalid")
  }

  const extractionBase = extractionRoot(researchRoot)
  const passAPath = join(extractionBase, "sources", sourceId, "pass-a", "result.json")
  const passBPath = join(extractionBase, "sources", sourceId, "pass-b", "result.json")
  for (const path of [passAPath, passBPath]) {
    assertContained(extractionBase, path)
    if (!existsSync(path)) throw new Error("candidate_claim_rereview_worker:blind_run_missing")
  }
  const passAResult = readJson<DnaCandidateClaimExtractionResult>(passAPath)
  const passBResult = readJson<DnaCandidateClaimExtractionResult>(passBPath)
  if (!isDnaCandidateClaimExtractionResultValid(passAResult)
    || !isDnaCandidateClaimExtractionResultValid(passBResult)
    || passAResult.lane !== "A" || passBResult.lane !== "B"
    || passAResult.resultSha256 !== reconciliationResult.passAResultSha256
    || passBResult.resultSha256 !== reconciliationResult.passBResultSha256) {
    throw new Error("candidate_claim_rereview_worker:blind_run_invalid")
  }
  const authority = loadDnaCandidatePassageSourceAuthority(researchRoot, sourceId)
  return {
    reconciliationResult,
    reconciliationResultFileSha256: reconciliationRecord.resultFileSha256,
    passageResult,
    passageResultFileSha256: passageRecord.resultFileSha256,
    passAResult,
    passBResult,
    parsedArtifact: authority.parsedArtifact,
  }
}

export function prepareDnaCandidateClaimRereviewPacket(input: Readonly<{
  researchRoot: string
  sourceId: string
}>): Readonly<Record<string, unknown>> {
  const bound = loadBoundInputs(input.researchRoot, input.sourceId)
  const claimsA = new Map(bound.passAResult.run.claims.map((claim) => [claim.claimId, claim]))
  const claimsB = new Map(bound.passBResult.run.claims.map((claim) => [claim.claimId, claim]))
  const items = bound.reconciliationResult.reconciliations
    .filter((entry) => entry.status === "contested" || entry.status === "quarantined")
    .map((reconciliation) => {
      const claimA = claimsA.get(reconciliation.claimAId)
      const claimB = claimsB.get(reconciliation.claimBId)
      if (!claimA || !claimB) {
        throw new Error("candidate_claim_rereview_worker:reconciled_claim_missing")
      }
      return { reconciliation, claimA, claimB }
    })
  if (items.length < 1) throw new Error("candidate_claim_rereview_worker:no_nonconsensus_items")
  const instructions = Object.freeze([
    "Reread the registered source passages; do not decide by majority vote or lane preference.",
    "Use consensus only for one verbatim atomic proposition supported by every named passage.",
    "Use evidenceLevel=not_assessed and evidenceLevelEvidence=null in this candidate lane.",
    "If the boundary remains unresolved choose contested; if source support is absent choose quarantined.",
    "Do not infer mechanisms, diagnoses, treatment, individual states, or DNA-product validity.",
  ])
  const payload = {
    schemaVersion: "dna-candidate-claim-rereview-packet@1" as const,
    status: "candidate_only" as const,
    runtimeEligible: false as const,
    releaseEligible: false as const,
    sourceId: input.sourceId,
    reconciliationResultFileSha256: bound.reconciliationResultFileSha256,
    passageRegistrationResultFileSha256: bound.passageResultFileSha256,
    items,
    passages: bound.passageResult.passages,
    instructions,
  }
  const packet: RereviewPacket = Object.freeze({
    ...payload,
    packetSha256: hashDnaCandidateClaimRereviewPayload(payload),
  })
  const path = join(rootPath(input.researchRoot), "packets", input.sourceId, "r000001.json")
  atomicWrite(path, packet)
  return {
    ok: true,
    sourceId: input.sourceId,
    packetPath: path,
    packetFileSha256: fileSha256(path),
    packetSha256: packet.packetSha256,
    nonconsensusItems: items.length,
    candidatePassages: bound.passageResult.passages.length,
    runtimeEligible: false,
    releaseEligible: false,
  }
}

function buildIndex(
  records: readonly RereviewRecord[],
  results: readonly DnaCandidateClaimRereviewResult[],
): CandidateClaimRereviewIndex {
  const sortedRecords = [...records].sort((a, b) => a.sourceId.localeCompare(b.sourceId, "en"))
  const counts = {
    sources: sortedRecords.length,
    rereviews: results.reduce((sum, result) => sum + result.rereviews.length, 0),
    consensus: results.reduce((sum, result) => sum + result.counts.consensus, 0),
    contested: results.reduce((sum, result) => sum + result.counts.contested, 0),
    quarantined: results.reduce((sum, result) => sum + result.counts.quarantined, 0),
    runtimeEligible: 0 as const,
    releaseEligible: 0 as const,
  }
  const resultCollectionSha256 = hashDnaCandidateClaimRereviewPayload(
    [...results].sort((a, b) => a.sourceId.localeCompare(b.sourceId, "en")),
  )
  const payload = {
    schemaVersion: "dna-candidate-claim-rereview-index@1" as const,
    authority: "candidate_audit" as const,
    records: sortedRecords,
    resultCollectionSha256,
    counts,
  }
  return Object.freeze({
    ...payload,
    canonicalPayloadSha256: hashDnaCandidateClaimRereviewPayload(payload),
  })
}

function receiptValid(receipt: RereviewReceipt): boolean {
  const { canonicalPayloadSha256, ...payload } = receipt
  return canonicalPayloadSha256 === hashDnaCandidateClaimRereviewPayload(payload)
}

export function getDnaCandidateClaimRereviewStatus(researchRoot: string): Readonly<{
  ok: boolean
  state: "empty" | "valid" | "invalid"
  indexFileSha256: string
  sources: number
  consensus: number
  contested: number
  quarantined: number
  runtimeEligible: number
  releaseEligible: number
  issues: readonly string[]
}> {
  const root = rootPath(researchRoot)
  const indexPath = join(root, "index.json")
  if (!existsSync(indexPath)) return {
    ok: true, state: "empty", indexFileSha256: "absent", sources: 0,
    consensus: 0, contested: 0, quarantined: 0,
    runtimeEligible: 0, releaseEligible: 0, issues: [],
  }
  const issues: string[] = []
  let index: CandidateClaimRereviewIndex | null = null
  const results: DnaCandidateClaimRereviewResult[] = []
  try {
    index = readJson<CandidateClaimRereviewIndex>(indexPath)
    for (const record of index.records) {
      const decisionPath = join(root, record.decisionRelativePath)
      const resultPath = join(root, record.resultRelativePath)
      const receiptPath = join(root, record.receiptRelativePath)
      for (const path of [decisionPath, resultPath, receiptPath]) assertContained(root, path)
      if (!existsSync(decisionPath) || fileSha256(decisionPath) !== record.decisionFileSha256
        || !existsSync(resultPath) || fileSha256(resultPath) !== record.resultFileSha256
        || !existsSync(receiptPath) || fileSha256(receiptPath) !== record.receiptFileSha256) {
        issues.push(`${record.sourceId}:stored_file_invalid`)
        continue
      }
      const result = readJson<DnaCandidateClaimRereviewResult>(resultPath)
      const receipt = readJson<RereviewReceipt>(receiptPath)
      const current = loadBoundInputs(researchRoot, record.sourceId)
      if (!isDnaCandidateClaimRereviewResultValid(result)
        || result.resultSha256 !== record.resultSha256
        || result.decisionSha256 !== record.decisionSha256
        || current.reconciliationResult.resultSha256 !== record.reconciliationResultSha256
        || current.passageResult.resultSha256 !== record.passageRegistrationResultSha256
        || !receiptValid(receipt)
        || receipt.canonicalPayloadSha256 !== record.receiptSha256) {
        issues.push(`${record.sourceId}:stored_payload_or_dependency_invalid`)
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
    consensus: index?.counts.consensus ?? 0,
    contested: index?.counts.contested ?? 0,
    quarantined: index?.counts.quarantined ?? 0,
    runtimeEligible: index?.counts.runtimeEligible ?? 0,
    releaseEligible: index?.counts.releaseEligible ?? 0,
    issues,
  }
}

export function ingestDnaCandidateClaimRereview(input: Readonly<{
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
    throw new Error("candidate_claim_rereview_worker:research_root_must_be_research_ssd")
  }
  const root = rootPath(input.researchRoot)
  mkdirSync(root, { recursive: true })
  const lockPath = join(root, ".ingest.lock")
  let lock: number | null = null
  try {
    lock = openSync(lockPath, "wx", 0o600)
  } catch {
    throw new Error("candidate_claim_rereview_worker:ingest_locked")
  }
  const indexPath = join(root, "index.json")
  const previousIndexBytes = existsSync(indexPath) ? readFileSync(indexPath) : null
  const previousIndexSha = previousIndexBytes ? fileSha256(indexPath) : "absent"
  let createdSourceRoot: string | null = null
  let committed = false
  try {
    if (input.expectedIndexSha !== previousIndexSha) {
      throw new Error("candidate_claim_rereview_worker:stale_index")
    }
    const current = getDnaCandidateClaimRereviewStatus(input.researchRoot)
    if (!current.ok) throw new Error("candidate_claim_rereview_worker:stored_state_invalid")
    const previousIndex = previousIndexBytes
      ? JSON.parse(previousIndexBytes.toString("utf8")) as CandidateClaimRereviewIndex
      : null
    if (previousIndex?.records.some((record) => record.sourceId === input.sourceId)) {
      throw new Error("candidate_claim_rereview_worker:duplicate_source")
    }
    const bound = loadBoundInputs(input.researchRoot, input.sourceId)
    const decisionPath = resolve(input.decisionInputPath)
    if (!existsSync(decisionPath)) throw new Error("candidate_claim_rereview_worker:decision_missing")
    const decision = readJson<DnaCandidateClaimRereviewDecision>(decisionPath)
    const result = compileDnaCandidateClaimRereview({
      decision,
      reconciliationResult: bound.reconciliationResult,
      reconciliationResultFileSha256: bound.reconciliationResultFileSha256,
      passageRegistrationResult: bound.passageResult,
      passageRegistrationResultFileSha256: bound.passageResultFileSha256,
      parsedArtifact: bound.parsedArtifact,
    })
    if (!isDnaCandidateClaimRereviewResultValid(result)) {
      throw new Error("candidate_claim_rereview_worker:compiled_result_invalid")
    }
    const decisionBytes = readFileSync(decisionPath)
    const resultBytes = jsonBytes(result)
    const decisionFileSha256 = createHash("sha256").update(decisionBytes).digest("hex")
    const resultFileSha256 = createHash("sha256").update(resultBytes).digest("hex")
    const receiptCore = {
      schemaVersion: "dna-candidate-claim-rereview-receipt@1" as const,
      receiptId: `candidate.claim.rereview.receipt:${input.sourceId}:r000001`,
      recordedAt: (input.now ?? (() => new Date().toISOString()))(),
      sourceId: input.sourceId,
      expectedPreviousIndexFileSha256: previousIndexSha,
      decisionFileSha256,
      decisionSha256: decision.decisionSha256,
      resultFileSha256,
      resultSha256: result.resultSha256,
      reconciliationResultSha256: bound.reconciliationResult.resultSha256,
      passageRegistrationResultSha256: bound.passageResult.resultSha256,
      runtimeEligible: false as const,
      releaseEligible: false as const,
    }
    const receipt: RereviewReceipt = Object.freeze({
      ...receiptCore,
      canonicalPayloadSha256: hashDnaCandidateClaimRereviewPayload(receiptCore),
    })
    const receiptBytes = jsonBytes(receipt)
    const sourceRoot = join(root, "sources", input.sourceId)
    if (existsSync(sourceRoot)) throw new Error("candidate_claim_rereview_worker:duplicate_source_directory")
    const record: RereviewRecord = {
      sourceId: input.sourceId,
      status: "candidate_rereviewed_unregistered",
      decisionRelativePath: relative(root, join(sourceRoot, "decision.json")),
      decisionFileSha256,
      decisionSha256: decision.decisionSha256,
      resultRelativePath: relative(root, join(sourceRoot, "result.json")),
      resultFileSha256,
      resultSha256: result.resultSha256,
      receiptRelativePath: relative(root, join(sourceRoot, "receipt.json")),
      receiptFileSha256: createHash("sha256").update(receiptBytes).digest("hex"),
      receiptSha256: receipt.canonicalPayloadSha256,
      reconciliationResultSha256: bound.reconciliationResult.resultSha256,
      passageRegistrationResultSha256: bound.passageResult.resultSha256,
      runtimeEligible: false,
      releaseEligible: false,
    }
    const existingResults = (previousIndex?.records ?? []).map((entry) =>
      readJson<DnaCandidateClaimRereviewResult>(join(root, entry.resultRelativePath)))
    const index = buildIndex([...(previousIndex?.records ?? []), record],
      [...existingResults, result])
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
      consensus: result.counts.consensus,
      contested: result.counts.contested,
      quarantined: result.counts.quarantined,
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

export function runDnaCandidateClaimRereviewWorkerCli(): void {
  const command = process.argv[2]
  const researchRoot = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
  if (command === "status") {
    const result = getDnaCandidateClaimRereviewStatus(researchRoot)
    console.log(JSON.stringify(result, null, 2))
    if (process.argv.includes("--strict") && !result.ok) process.exitCode = 1
    return
  }
  if (command === "prepare") {
    console.log(JSON.stringify(prepareDnaCandidateClaimRereviewPacket({
      researchRoot,
      sourceId: requiredOption("source"),
    }), null, 2))
    return
  }
  if (command === "ingest") {
    console.log(JSON.stringify(ingestDnaCandidateClaimRereview({
      researchRoot,
      sourceId: requiredOption("source"),
      decisionInputPath: requiredOption("input"),
      expectedIndexSha: requiredOption("expected-index-sha"),
    }), null, 2))
    return
  }
  throw new Error("candidate_claim_rereview_worker:invalid_or_missing_command")
}

if (require.main === module) {
  try {
    runDnaCandidateClaimRereviewWorkerCli()
  } catch (error) {
    console.error(error instanceof Error ? error.message : "candidate_claim_rereview_worker:unknown_error")
    process.exitCode = 1
  }
}

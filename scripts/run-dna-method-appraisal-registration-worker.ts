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
  assertDnaMethodAppraisalRegistrationDecision,
  compileDnaMethodAppraisalRegistration,
  hashDnaMethodAppraisalRegistrationPayload,
  isDnaMethodAppraisalRegistrationResultValid,
  mergeDnaMethodAppraisalTrustRegistries,
  type DnaMethodAppraisalRegistrationDecision,
  type DnaMethodAppraisalRegistrationResult,
  type DnaMethodRegistrationWorkpack,
} from "../src/lib/dna/chat/governance/methodAppraisalRegistration"
import type {
  DnaMethodAppraisalCandidate,
  DnaMethodAppraisalFidelityPass,
  DnaMethodAppraisalReconciliation,
  DnaMethodReviewPass,
} from "../src/lib/dna/chat/governance/methodAppraisalBatch"

export type RegistrationRecord = Readonly<{
  sourceId: string
  status: "registered_for_method_pipeline"
  decisionRelativePath: string
  decisionFileSha256: string
  decisionSha256: string
  resultRelativePath: string
  resultFileSha256: string
  resultSha256: string
  appraisalPayloadSha256: string
  receiptRelativePath: string
  receiptFileSha256: string
  receiptSha256: string
  expectedPreviousIndexFileSha256: string
  compiledTrustRegistryShaAfterRegistration: string
  appraisalCollectionShaAfterRegistration: string
  evidenceParagraphCount: number
  runtimeEligible: false
  releaseEligible: false
}>

export type RegistrationIndex = Readonly<{
  schemaVersion: "dna-method-appraisal-registration-index@1"
  registryKind: "production_compiled"
  records: readonly RegistrationRecord[]
  compiledTrustRegistrySha256: string
  appraisalCollectionSha256: string
  counts: Readonly<{
    registeredForMethodPipeline: number
    runtimeEligible: 0
    releaseEligible: 0
  }>
  canonicalPayloadSha256: string
}>

export type RegistrationReceipt = Readonly<{
  schemaVersion: "dna-method-appraisal-registration-receipt@1"
  receiptId: string
  recordedAt: string
  sourceId: string
  expectedPreviousIndexFileSha256: string
  decisionFileSha256: string
  decisionSha256: string
  resultFileSha256: string
  resultSha256: string
  appraisalPayloadSha256: string
  compiledTrustRegistrySha256: string
  appraisalCollectionSha256: string
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
  if (!value) throw new Error(`registration_worker:missing_option:${name}`)
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

function payloadHash<T extends { canonicalPayloadSha256: string }>(value: T): string {
  const { canonicalPayloadSha256: _hash, ...payload } = value
  return hashDnaMethodAppraisalRegistrationPayload(payload)
}

function resultIntegrityValid(result: DnaMethodAppraisalRegistrationResult): boolean {
  return isDnaMethodAppraisalRegistrationResultValid(result)
}

function registrationRoot(researchRoot: string): string {
  return join(resolve(researchRoot),
    "Datasets/DNA-Intelligence/work/v3/method-appraisal-registrations/v1")
}

function candidateRoot(researchRoot: string): string {
  return join(resolve(researchRoot), "Datasets/DNA-Intelligence/work/v3/candidate-corpus")
}

function batchRoot(researchRoot: string): string {
  return join(resolve(researchRoot), "Datasets/DNA-Intelligence/work/v3/method-appraisals/batch-v1")
}

function loadCompileInputs(researchRoot: string, sourceId: string, decisionPath: string) {
  if (!SOURCE_ID_PATTERN.test(sourceId)) throw new Error("registration_worker:invalid_source_id")
  const batch = batchRoot(researchRoot)
  const source = join(batch, "sources", sourceId)
  assertContained(batch, source, "registration_worker:source_path_escape")
  const paths = {
    candidate: join(source, "candidate.json"),
    passA: join(source, "pass-a.json"),
    passB: join(source, "pass-b.json"),
    reconciliation: join(source, "reconciliation.json"),
    fidelity: join(source, "fidelity-pass.json"),
  }
  for (const path of Object.values(paths)) {
    if (!existsSync(path)) throw new Error(`registration_worker:missing_batch_artifact:${path}`)
  }
  const runIndexPath = join(batch, "run-index.json")
  if (!existsSync(runIndexPath)) throw new Error("registration_worker:missing_batch_run_index")
  const runIndex = readJson<{
    schemaVersion: string
    records: Array<{
      sourceId: string
      status: string
      runtimeEligible: boolean
      releaseEligible: boolean
      artifacts: {
        passAFileSha256: string | null
        passBFileSha256: string | null
        reconciliationFileSha256: string | null
        fidelityPassFileSha256: string | null
        candidateFileSha256: string | null
      }
    }>
  }>(runIndexPath)
  const runRecord = runIndex.records.find((record) => record.sourceId === sourceId)
  if (runIndex.schemaVersion !== "dna-method-appraisal-batch-run-index@1"
    || !runRecord
    || runRecord.status !== "candidate_complete_unregistered"
    || runRecord.runtimeEligible !== false
    || runRecord.releaseEligible !== false
    || runRecord.artifacts.candidateFileSha256 !== fileSha256(paths.candidate)
    || runRecord.artifacts.passAFileSha256 !== fileSha256(paths.passA)
    || runRecord.artifacts.passBFileSha256 !== fileSha256(paths.passB)
    || runRecord.artifacts.reconciliationFileSha256 !== fileSha256(paths.reconciliation)
    || runRecord.artifacts.fidelityPassFileSha256 !== fileSha256(paths.fidelity)) {
    throw new Error("registration_worker:batch_run_index_binding_mismatch")
  }
  if (!existsSync(decisionPath)) throw new Error("registration_worker:missing_decision")
  const candidate = readJson<DnaMethodAppraisalCandidate>(paths.candidate)
  const workpackPath = join(candidateRoot(researchRoot), candidate.sourceBinding.workpackRelativePath)
  assertContained(candidateRoot(researchRoot), workpackPath,
    "registration_worker:workpack_path_escape")
  if (!existsSync(workpackPath)) throw new Error("registration_worker:missing_workpack")
  return {
    candidate,
    passA: readJson<DnaMethodReviewPass>(paths.passA),
    passB: readJson<DnaMethodReviewPass>(paths.passB),
    reconciliation: readJson<DnaMethodAppraisalReconciliation>(paths.reconciliation),
    fidelityPass: readJson<DnaMethodAppraisalFidelityPass>(paths.fidelity),
    workpack: readJson<DnaMethodRegistrationWorkpack>(workpackPath),
    workpackFileSha256: fileSha256(workpackPath),
    decision: readJson<DnaMethodAppraisalRegistrationDecision>(decisionPath),
  }
}

function buildGlobalArtifacts(root: string, results: readonly DnaMethodAppraisalRegistrationResult[]) {
  const registry = mergeDnaMethodAppraisalTrustRegistries(results)
  const appraisals = results.map((result) => result.appraisal)
    .sort((left, right) => left.id.localeCompare(right.id, "en"))
  return {
    registry,
    appraisals,
    registrySha256: hashDnaMethodAppraisalRegistrationPayload(registry),
    appraisalsSha256: hashDnaMethodAppraisalRegistrationPayload(appraisals),
    registryPath: join(root, "trusted-method-appraisal-registry.json"),
    appraisalsPath: join(root, "registered-method-appraisals.json"),
  }
}

function buildIndex(
  records: readonly RegistrationRecord[],
  registrySha256: string,
  appraisalsSha256: string,
): RegistrationIndex {
  const payload = {
    schemaVersion: "dna-method-appraisal-registration-index@1" as const,
    registryKind: "production_compiled" as const,
    records: [...records].sort((left, right) => left.sourceId.localeCompare(right.sourceId, "en")),
    compiledTrustRegistrySha256: registrySha256,
    appraisalCollectionSha256: appraisalsSha256,
    counts: {
      registeredForMethodPipeline: records.length,
      runtimeEligible: 0 as const,
      releaseEligible: 0 as const,
    },
  }
  return {
    ...payload,
    canonicalPayloadSha256: hashDnaMethodAppraisalRegistrationPayload(payload),
  }
}

function assertIndex(index: RegistrationIndex): void {
  const sortedSourceIds = [...index.records.map((record) => record.sourceId)]
    .sort((left, right) => left.localeCompare(right, "en"))
  if (index.schemaVersion !== "dna-method-appraisal-registration-index@1"
    || index.registryKind !== "production_compiled"
    || index.canonicalPayloadSha256 !== payloadHash(index)
    || index.counts.registeredForMethodPipeline !== index.records.length
    || index.counts.runtimeEligible !== 0
    || index.counts.releaseEligible !== 0
    || new Set(index.records.map((record) => record.sourceId)).size !== index.records.length
    || index.records.some((record, position) => record.sourceId !== sortedSourceIds[position])
    || index.records.some((record) => record.runtimeEligible !== false
      || record.releaseEligible !== false
      || record.status !== "registered_for_method_pipeline"
      || !SOURCE_ID_PATTERN.test(record.sourceId)
      || !SHA256_PATTERN.test(record.decisionFileSha256)
      || !SHA256_PATTERN.test(record.decisionSha256)
      || !SHA256_PATTERN.test(record.resultFileSha256)
      || !SHA256_PATTERN.test(record.resultSha256)
      || !SHA256_PATTERN.test(record.appraisalPayloadSha256)
      || !SHA256_PATTERN.test(record.receiptFileSha256)
      || !SHA256_PATTERN.test(record.receiptSha256)
      || !SHA256_PATTERN.test(record.compiledTrustRegistryShaAfterRegistration)
      || !SHA256_PATTERN.test(record.appraisalCollectionShaAfterRegistration)
      || (record.expectedPreviousIndexFileSha256 !== "absent"
        && !SHA256_PATTERN.test(record.expectedPreviousIndexFileSha256))
      || !Number.isInteger(record.evidenceParagraphCount)
      || record.evidenceParagraphCount < 1)) {
    throw new Error("registration_worker:index_invalid")
  }
}

function receiptIntegrityValid(receipt: RegistrationReceipt): boolean {
  const { canonicalPayloadSha256, ...payload } = receipt
  return receipt.schemaVersion === "dna-method-appraisal-registration-receipt@1"
    && canonicalPayloadSha256 === hashDnaMethodAppraisalRegistrationPayload(payload)
    && SHA256_PATTERN.test(canonicalPayloadSha256)
    && Number.isFinite(Date.parse(receipt.recordedAt))
    && new Date(Date.parse(receipt.recordedAt)).toISOString() === receipt.recordedAt
    && SOURCE_ID_PATTERN.test(receipt.sourceId)
    && receipt.runtimeEligible === false
    && receipt.releaseEligible === false
}

export function getDnaMethodAppraisalRegistrationStatus(researchRoot: string): {
  ok: boolean
  state: "empty" | "valid" | "invalid"
  indexFileSha256: string
  registeredForMethodPipeline?: number
  runtimeEligible?: 0
  releaseEligible?: 0
  compiledTrustRegistrySha256?: string
  appraisalCollectionSha256?: string
  issues: string[]
} {
  const root = registrationRoot(researchRoot)
  const indexPath = join(root, "index.json")
  if (!existsSync(indexPath)) {
    const hasOrphanState = existsSync(root) && readdirSync(root)
      .some((entry) => entry !== "index.lock")
    return {
    ok: !hasOrphanState,
    state: hasOrphanState ? "invalid" : "empty",
    indexFileSha256: "absent",
    registeredForMethodPipeline: 0,
    runtimeEligible: 0,
    releaseEligible: 0,
    issues: hasOrphanState ? ["registration_state_without_index"] : [],
  }
  }
  const issues: string[] = []
  let index: RegistrationIndex
  try {
    index = readJson<RegistrationIndex>(indexPath)
    assertIndex(index)
  } catch (error) {
    return {
      ok: false,
      state: "invalid",
      indexFileSha256: fileSha256(indexPath),
      issues: [error instanceof Error ? error.message : "registration_worker:index_invalid"],
    }
  }
  const results: DnaMethodAppraisalRegistrationResult[] = []
  for (const record of index.records) {
    const decisionPath = join(root, record.decisionRelativePath)
    const resultPath = join(root, record.resultRelativePath)
    const receiptPath = join(root, record.receiptRelativePath)
    try {
      assertContained(root, decisionPath, "registration_worker:decision_path_escape")
      assertContained(root, resultPath, "registration_worker:result_path_escape")
      assertContained(root, receiptPath, "registration_worker:receipt_path_escape")
      if (!existsSync(decisionPath) || fileSha256(decisionPath) !== record.decisionFileSha256) {
        issues.push(`decision_file_mismatch:${record.sourceId}`)
        continue
      }
      const decision = readJson<DnaMethodAppraisalRegistrationDecision>(decisionPath)
      assertDnaMethodAppraisalRegistrationDecision(decision)
      if (decision.decisionSha256 !== record.decisionSha256) {
        issues.push(`decision_payload_mismatch:${record.sourceId}`)
      }
      if (!existsSync(resultPath) || fileSha256(resultPath) !== record.resultFileSha256) {
        issues.push(`result_file_mismatch:${record.sourceId}`)
        continue
      }
      const result = readJson<DnaMethodAppraisalRegistrationResult>(resultPath)
      if (!resultIntegrityValid(result)
        || result.resultSha256 !== record.resultSha256
        || result.appraisal.appraisalPayloadSha256 !== record.appraisalPayloadSha256) {
        issues.push(`result_payload_mismatch:${record.sourceId}`)
        continue
      }
      if (!existsSync(receiptPath) || fileSha256(receiptPath) !== record.receiptFileSha256) {
        issues.push(`receipt_file_mismatch:${record.sourceId}`)
        continue
      }
      const receipt = readJson<RegistrationReceipt>(receiptPath)
      if (!receiptIntegrityValid(receipt)
        || receipt.canonicalPayloadSha256 !== record.receiptSha256
        || receipt.sourceId !== record.sourceId
        || receipt.expectedPreviousIndexFileSha256
          !== record.expectedPreviousIndexFileSha256
        || receipt.decisionFileSha256 !== record.decisionFileSha256
        || receipt.decisionSha256 !== record.decisionSha256
        || receipt.resultFileSha256 !== record.resultFileSha256
        || receipt.resultSha256 !== record.resultSha256
        || receipt.appraisalPayloadSha256 !== record.appraisalPayloadSha256
        || receipt.compiledTrustRegistrySha256
          !== record.compiledTrustRegistryShaAfterRegistration
        || receipt.appraisalCollectionSha256
          !== record.appraisalCollectionShaAfterRegistration) {
        issues.push(`receipt_payload_mismatch:${record.sourceId}`)
        continue
      }
      const recompiled = compileDnaMethodAppraisalRegistration(
        loadCompileInputs(researchRoot, record.sourceId, decisionPath),
      )
      if (recompiled.resultSha256 !== result.resultSha256) {
        issues.push(`current_source_recompile_mismatch:${record.sourceId}`)
        continue
      }
      results.push(result)
    } catch (error) {
      issues.push(`${record.sourceId}:${error instanceof Error ? error.message : "invalid"}`)
    }
  }
  const sourceDirectories = existsSync(join(root, "sources"))
    ? readdirSync(join(root, "sources"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right, "en"))
    : []
  const indexedSources = [...index.records.map((record) => record.sourceId)]
    .sort((left, right) => left.localeCompare(right, "en"))
  if (JSON.stringify(sourceDirectories) !== JSON.stringify(indexedSources)) {
    issues.push("source_directory_index_mismatch")
  }
  const globals = buildGlobalArtifacts(root, results)
  if (!existsSync(globals.registryPath)
    || fileSha256(globals.registryPath) !== fileSha256FromValue(globals.registry)
    || globals.registrySha256 !== index.compiledTrustRegistrySha256) {
    issues.push("compiled_registry_mismatch")
  }
  if (!existsSync(globals.appraisalsPath)
    || fileSha256(globals.appraisalsPath) !== fileSha256FromValue(globals.appraisals)
    || globals.appraisalsSha256 !== index.appraisalCollectionSha256) {
    issues.push("appraisal_collection_mismatch")
  }
  return {
    ok: issues.length === 0,
    state: issues.length === 0 ? "valid" : "invalid",
    indexFileSha256: fileSha256(indexPath),
    registeredForMethodPipeline: index.records.length,
    runtimeEligible: 0,
    releaseEligible: 0,
    compiledTrustRegistrySha256: index.compiledTrustRegistrySha256,
    appraisalCollectionSha256: index.appraisalCollectionSha256,
    issues,
  }
}

function fileSha256FromValue(value: unknown): string {
  return createHash("sha256").update(jsonBytes(value)).digest("hex")
}

export function ingestDnaMethodAppraisalRegistration(input: Readonly<{
  researchRoot: string
  sourceId: string
  decisionInputPath: string
  expectedIndexSha: string
  allowNonSsdForTests?: boolean
  now?: () => string
}>): unknown {
  const researchRoot = input.researchRoot
  const sourceId = input.sourceId
  const decisionInputPath = resolve(input.decisionInputPath)
  const expectedIndexSha = input.expectedIndexSha
  if (expectedIndexSha !== "absent" && !SHA256_PATTERN.test(expectedIndexSha)) {
    throw new Error("registration_worker:invalid_expected_index_hash")
  }
  const root = registrationRoot(researchRoot)
  const resolvedResearchRoot = resolve(researchRoot)
  if (!input.allowNonSsdForTests
    && resolvedResearchRoot !== "/Volumes/ResearchSSD"
    && !resolvedResearchRoot.startsWith("/Volumes/ResearchSSD/")) {
    throw new Error("registration_worker:research_root_must_be_research_ssd")
  }
  mkdirSync(root, { recursive: true })
  const indexPath = join(root, "index.json")
  const observedIndexSha = existsSync(indexPath) ? fileSha256(indexPath) : "absent"
  if (observedIndexSha !== expectedIndexSha) throw new Error("registration_worker:index_cas_mismatch")
  const lockPath = join(root, "index.lock")
  let lock: number | null = null
  try {
    lock = openSync(lockPath, "wx", 0o600)
  } catch {
    throw new Error("registration_worker:index_locked")
  }
  let committed = false
  let createdSourceRoot = false
  let previousRegistryBytes: Buffer | null = null
  let previousAppraisalsBytes: Buffer | null = null
  let globals: ReturnType<typeof buildGlobalArtifacts> | null = null
  try {
    const lockedObservedIndexSha = existsSync(indexPath) ? fileSha256(indexPath) : "absent"
    if (lockedObservedIndexSha !== expectedIndexSha) {
      throw new Error("registration_worker:index_cas_mismatch_after_lock")
    }
    const previousIndex = existsSync(indexPath) ? readJson<RegistrationIndex>(indexPath) : null
    if (previousIndex) assertIndex(previousIndex)
    if (previousIndex?.records.some((record) => record.sourceId === sourceId)) {
      throw new Error("registration_worker:source_already_registered")
    }
    const inputs = loadCompileInputs(researchRoot, sourceId, decisionInputPath)
    const result = compileDnaMethodAppraisalRegistration(inputs)
    const sourceRoot = join(root, "sources", sourceId)
    assertContained(root, sourceRoot, "registration_worker:source_path_escape")
    const decisionPath = join(sourceRoot, "decision.json")
    const resultPath = join(sourceRoot, "result.json")
    const receiptPath = join(sourceRoot, "receipt.json")
    if (existsSync(sourceRoot)) {
      throw new Error("registration_worker:source_artifact_already_exists")
    }
    const decisionBytes = readFileSync(decisionInputPath)
    const resultBytes = jsonBytes(result)
    const decisionFileSha256 = createHash("sha256").update(decisionBytes).digest("hex")
    const resultFileSha256 = createHash("sha256").update(resultBytes).digest("hex")
    const previousResults = (previousIndex?.records ?? []).map((record) => {
      const path = join(root, record.resultRelativePath)
      assertContained(root, path, "registration_worker:result_path_escape")
      if (!existsSync(path) || fileSha256(path) !== record.resultFileSha256) {
        throw new Error("registration_worker:previous_result_integrity_failed")
      }
      const previousResult = readJson<DnaMethodAppraisalRegistrationResult>(path)
      if (!resultIntegrityValid(previousResult)) {
        throw new Error("registration_worker:previous_result_payload_invalid")
      }
      return previousResult
    })
    globals = buildGlobalArtifacts(root, [...previousResults, result])
    const receiptPayload = {
      schemaVersion: "dna-method-appraisal-registration-receipt@1" as const,
      receiptId: `method-registration:${sourceId}:${inputs.decision.decisionSha256.slice(0, 16)}`,
      recordedAt: (input.now ?? (() => new Date().toISOString()))(),
      sourceId,
      expectedPreviousIndexFileSha256: expectedIndexSha,
      decisionFileSha256,
      decisionSha256: inputs.decision.decisionSha256,
      resultFileSha256,
      resultSha256: result.resultSha256,
      appraisalPayloadSha256: result.appraisal.appraisalPayloadSha256,
      compiledTrustRegistrySha256: globals.registrySha256,
      appraisalCollectionSha256: globals.appraisalsSha256,
      runtimeEligible: false as const,
      releaseEligible: false as const,
    }
    const receipt: RegistrationReceipt = {
      ...receiptPayload,
      canonicalPayloadSha256: hashDnaMethodAppraisalRegistrationPayload(receiptPayload),
    }
    const receiptBytes = jsonBytes(receipt)
    const record: RegistrationRecord = {
      sourceId,
      status: "registered_for_method_pipeline",
      decisionRelativePath: relative(root, decisionPath),
      decisionFileSha256,
      decisionSha256: inputs.decision.decisionSha256,
      resultRelativePath: relative(root, resultPath),
      resultFileSha256,
      resultSha256: result.resultSha256,
      appraisalPayloadSha256: result.appraisal.appraisalPayloadSha256,
      receiptRelativePath: relative(root, receiptPath),
      receiptFileSha256: createHash("sha256").update(receiptBytes).digest("hex"),
      receiptSha256: receipt.canonicalPayloadSha256,
      expectedPreviousIndexFileSha256: expectedIndexSha,
      compiledTrustRegistryShaAfterRegistration: globals.registrySha256,
      appraisalCollectionShaAfterRegistration: globals.appraisalsSha256,
      evidenceParagraphCount: result.evidenceParagraphCount,
      runtimeEligible: false,
      releaseEligible: false,
    }
    const records = [...(previousIndex?.records ?? []), record]
    const index = buildIndex(records, globals.registrySha256, globals.appraisalsSha256)
    const transactionRoot = join(root, `.transaction-${process.pid}-${randomUUID()}`)
    const stagedSourceRoot = join(transactionRoot, "source")
    mkdirSync(stagedSourceRoot, { recursive: true })
    writeFileSync(join(stagedSourceRoot, "decision.json"), decisionBytes, { flag: "wx", mode: 0o600 })
    writeFileSync(join(stagedSourceRoot, "result.json"), resultBytes, { flag: "wx", mode: 0o600 })
    writeFileSync(join(stagedSourceRoot, "receipt.json"), receiptBytes, { flag: "wx", mode: 0o600 })
    mkdirSync(dirname(sourceRoot), { recursive: true })
    previousRegistryBytes = existsSync(globals.registryPath) ? readFileSync(globals.registryPath) : null
    previousAppraisalsBytes = existsSync(globals.appraisalsPath)
      ? readFileSync(globals.appraisalsPath) : null
    try {
      renameSync(stagedSourceRoot, sourceRoot)
      createdSourceRoot = true
      atomicWrite(globals.registryPath, globals.registry)
      atomicWrite(globals.appraisalsPath, globals.appraisals)
      atomicWrite(indexPath, index)
      committed = true
    } finally {
      if (existsSync(transactionRoot)) rmSync(transactionRoot, { recursive: true, force: true })
    }
    const nextIndexFileSha256 = fileSha256(indexPath)
    return {
      ok: true,
      sourceId,
      decisionPath,
      resultPath,
      receiptPath,
      indexPath,
      indexFileSha256: nextIndexFileSha256,
      registeredForMethodPipeline: records.length,
      evidenceParagraphCount: result.evidenceParagraphCount,
      appraisalPayloadSha256: result.appraisal.appraisalPayloadSha256,
      resultSha256: result.resultSha256,
      compiledTrustRegistrySha256: globals.registrySha256,
      runtimeEligible: false,
      releaseEligible: false,
    }
  } catch (error) {
    if (!committed) {
      if (globals) {
        restoreFile(globals.registryPath, previousRegistryBytes)
        restoreFile(globals.appraisalsPath, previousAppraisalsBytes)
      }
      const sourceRoot = join(root, "sources", sourceId)
      if (createdSourceRoot && existsSync(sourceRoot)) {
        rmSync(sourceRoot, { recursive: true, force: true })
      }
    }
    throw error
  } finally {
    if (lock !== null) closeSync(lock)
    if (existsSync(lockPath)) unlinkSync(lockPath)
  }
}

export function runDnaMethodAppraisalRegistrationWorkerCli(): void {
  const command = process.argv[2]
  const researchRoot = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
  if (command === "status") {
    const result = getDnaMethodAppraisalRegistrationStatus(researchRoot)
    console.log(JSON.stringify(result, null, 2))
    if (process.argv.includes("--strict") && !(result as { ok: boolean }).ok) process.exitCode = 1
    return
  }
  if (command === "ingest") {
    console.log(JSON.stringify(ingestDnaMethodAppraisalRegistration({
      researchRoot,
      sourceId: requiredOption("source"),
      decisionInputPath: requiredOption("input"),
      expectedIndexSha: requiredOption("expected-index-sha"),
    }), null, 2))
    return
  }
  throw new Error("registration_worker:invalid_or_missing_command")
}

if (require.main === module) {
  try {
    runDnaMethodAppraisalRegistrationWorkerCli()
  } catch (error) {
    console.error(error instanceof Error ? error.message : "registration_worker:unknown_error")
    process.exitCode = 1
  }
}

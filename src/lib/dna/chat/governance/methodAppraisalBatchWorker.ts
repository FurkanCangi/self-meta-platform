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
import { basename, dirname, join, relative, resolve } from "node:path"

import {
  DNA_BATCH_ADAPTED_GRADE_DIMENSIONS,
  DNA_BATCH_METHOD_FIELD_NAMES,
  DNA_METHOD_APPRAISAL_BATCH_CONTRACT_VERSION,
  DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE,
  compileDnaMethodAppraisalCandidate,
  hashDnaMethodAppraisalBatchPayload,
  validateDnaMethodAppraisalCandidate,
  validateDnaMethodAppraisalDesignProfileRegistry,
  validateDnaMethodAppraisalFidelityPass,
  validateDnaMethodAppraisalReconciliation,
  validateDnaMethodReviewPass,
  type DnaMethodAppraisalCandidate,
  type DnaMethodAppraisalFidelityPass,
  type DnaMethodAppraisalReconciliation,
  type DnaMethodReviewContractBinding,
  type DnaMethodReviewPass,
  type DnaMethodReviewSourceBinding,
} from "./methodAppraisalBatch"

export const DNA_METHOD_APPRAISAL_REVIEW_PACKET_VERSION =
  "dna-method-appraisal-review-packet@1" as const
export const DNA_METHOD_APPRAISAL_EVIDENCE_RECEIPT_VERSION =
  "dna-method-appraisal-evidence-receipt@1" as const

export const DNA_METHOD_APPRAISAL_BATCH_STATUSES = [
  "queued",
  "pass_a_complete",
  "pass_b_complete",
  "awaiting_reconciliation",
  "awaiting_fidelity",
  "awaiting_compile",
  "candidate_complete_unregistered",
  "needs_revision",
  "contested",
  "quarantined",
  "stale_inputs",
] as const

export type DnaMethodAppraisalBatchStatus =
  (typeof DNA_METHOD_APPRAISAL_BATCH_STATUSES)[number]
export type DnaMethodAppraisalWorkerPassRole = "A" | "B"
export type DnaMethodAppraisalWorkerStage =
  | "pass-a"
  | "pass-b"
  | "reconciliation"
  | "fidelity-pass"
  | "candidate"

export type DnaMethodAppraisalWorkerContext = Readonly<{
  researchRoot: string
  repoRoot: string
  candidateRoot: string
  batchRoot: string
  workpackIndexPath: string
  runIndexPath: string
  contractPath: string
  designProfilesPath: string
  allowNonSsdForTests: boolean
  now: () => string
}>

type BatchArtifactHashes = {
  passAFileSha256: string | null
  passBFileSha256: string | null
  reconciliationFileSha256: string | null
  fidelityPassFileSha256: string | null
  candidateFileSha256: string | null
}

type BatchReceiptHashes = {
  passAReceiptFileSha256: string | null
  passBReceiptFileSha256: string | null
  reconciliationReceiptFileSha256: string | null
  fidelityPassReceiptFileSha256: string | null
  candidateReceiptFileSha256: string | null
}

type BatchIndexRecord = {
  sourceId: string
  workpackRelativePath: string
  workpackFileSha256: string
  workpackPayloadSha256: string
  declaredStudyDesign: string
  designProfileId: string
  reviewArchitecture: typeof DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE
  status: DnaMethodAppraisalBatchStatus
  artifacts: BatchArtifactHashes
  receipts: BatchReceiptHashes
  trustedRegistryStatus: "not_registered"
  runtimeEligible: false
  releaseEligible: false
}

type BatchRunIndex = {
  schemaVersion: "dna-method-appraisal-batch-run-index@1"
  batchId: string
  reviewArchitecture: typeof DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE
  basisAt: string
  inputBindings: {
    workpackIndexFileSha256: string
    workpackIndexDeclaredSha256: string
    batchContractFileSha256: string
    designProfileRegistryFileSha256: string
  }
  statusVocabulary: readonly DnaMethodAppraisalBatchStatus[]
  counts: {
    totalWorkpacks: number
    queued: number
    inProgress: number
    candidateCompleteUnregistered: number
    contestedOrQuarantined: number
    registered: 0
    runtimeEligible: 0
    releaseEligible: 0
  }
  records: BatchIndexRecord[]
  calibrationPilots: unknown[]
  authorityBoundary: Record<string, unknown>
  canonicalPayloadSha256: string
}

type WorkpackIndexRecord = {
  sourceId: string
  relativePath: string
  workpackSha256: string
}

type WorkpackIndex = {
  schemaVersion: "dna-v3-method-review-workpack-index@3"
  sourceLibraryAuditAt: string
  indexSha256: string
  records: WorkpackIndexRecord[]
}

type Workpack = {
  schemaVersion: string
  sourceId: string
  declaredStudyDesign: string
  artifactId: string
  artifactSha256: string
  parsedContentSha256: string
  workpackSha256: string
  paragraphs: Array<{ paragraphId: string; text?: string }>
  status: "candidate_only"
  runtimeEligible: false
  releaseEligible: false
}

type DesignProfile = {
  id: string
  mandatoryQuestions: string[]
}

type DesignProfileRegistry = {
  schemaVersion: string
  profiles: DesignProfile[]
  declaredDesignAliases: Record<string, string>
  canonicalDesignAliases: Record<string, string>
}

export type DnaMethodAppraisalReviewPacket = Readonly<{
  schemaVersion: typeof DNA_METHOD_APPRAISAL_REVIEW_PACKET_VERSION
  contractVersion: typeof DNA_METHOD_APPRAISAL_BATCH_CONTRACT_VERSION
  reviewArchitecture: typeof DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE
  packetId: string
  sourceId: string
  passRole: "method_appraisal_a" | "method_appraisal_b"
  createdAt: string
  status: "candidate_input_only"
  runtimeEligible: false
  releaseEligible: false
  allowedInputs: Readonly<{
    sourceBinding: DnaMethodReviewSourceBinding
    contractBinding: DnaMethodReviewContractBinding
    runIndexFileSha256: string
  }>
  prohibitedInputs: readonly string[]
  reviewInstructions: Readonly<{
    methodFields: readonly string[]
    adaptedGradeDimensions: readonly string[]
    sampleSizeFields: readonly string[]
    designProfileQuestions: readonly string[]
    boundaries: readonly string[]
  }>
  canonicalPayloadSha256: string
}>

type EvidenceReceipt = Readonly<{
  schemaVersion: typeof DNA_METHOD_APPRAISAL_EVIDENCE_RECEIPT_VERSION
  reviewArchitecture: typeof DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE
  receiptId: string
  sourceId: string
  stage: DnaMethodAppraisalWorkerStage
  revision: number
  recordedAt: string
  expectedRunIndexFileSha256: string
  previousArtifactFileSha256: string | null
  inputPacket: Readonly<{
    relativePath: string
    fileSha256: string
    canonicalPayloadSha256: string
  }> | null
  inputBindings: Readonly<Record<string, string>>
  storedRevision: Readonly<{
    relativePath: string
    fileSha256: string
    canonicalPayloadSha256: string
  }>
  downstreamInvalidated: readonly DnaMethodAppraisalWorkerStage[]
  trustedRegistryStatus: "not_registered"
  runtimeEligible: false
  releaseEligible: false
  canonicalPayloadSha256: string
}>

type SourceAuthority = {
  index: BatchRunIndex
  indexRawSha256: string
  workpackIndex: WorkpackIndex
  workpackRecord: WorkpackIndexRecord
  indexRecord: BatchIndexRecord
  workpack: Workpack
  sourceBinding: DnaMethodReviewSourceBinding
  contractBinding: DnaMethodReviewContractBinding
  designProfile: DesignProfile
  paragraphIds: Set<string>
  staleIssues: string[]
}

export type DnaMethodAppraisalWorkerStatus = Readonly<{
  ok: boolean
  runIndexFileSha256: string
  issues: readonly string[]
  counts: BatchRunIndex["counts"]
  records: readonly Readonly<{
    sourceId: string
    recordedStatus: DnaMethodAppraisalBatchStatus
    effectiveStatus: DnaMethodAppraisalBatchStatus
    issues: readonly string[]
  }>[]
}>

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const ISO_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/
const SOURCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,199}$/

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) =>
    `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex")
}

function readBytes(path: string): Buffer {
  return readFileSync(path)
}

function fileSha256(path: string): string {
  return sha256(readBytes(path))
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function jsonBytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function exactIso(value: string): boolean {
  if (!ISO_INSTANT_PATTERN.test(value)) return false
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return false
  const canonical = new Date(parsed).toISOString()
  return canonical === value || canonical.replace(/\.000Z$/, "Z") === value
}

function assertCondition(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code)
}

function assertSourceId(sourceId: string): void {
  assertCondition(SOURCE_ID_PATTERN.test(sourceId), "worker:invalid_source_id")
}

function assertContained(root: string, target: string, code: string): void {
  const relativePath = relative(resolve(root), resolve(target))
  assertCondition(relativePath !== ".." && !relativePath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
    && !resolve(target).startsWith(`${resolve(root)}..`), code)
}

function payloadHash<T extends { canonicalPayloadSha256: string }>(value: T): string {
  const { canonicalPayloadSha256: _hash, ...payload } = value
  return hashDnaMethodAppraisalBatchPayload(payload)
}

function withCanonicalHash<T extends Record<string, unknown>>(
  payload: T,
): T & { canonicalPayloadSha256: string } {
  return {
    ...payload,
    canonicalPayloadSha256: hashDnaMethodAppraisalBatchPayload(payload),
  }
}

export function createDnaMethodAppraisalWorkerContext(input: Readonly<{
  researchRoot: string
  repoRoot: string
  allowNonSsdForTests?: boolean
  now?: () => string
}>): DnaMethodAppraisalWorkerContext {
  const researchRoot = resolve(input.researchRoot)
  const repoRoot = resolve(input.repoRoot)
  const allowNonSsdForTests = input.allowNonSsdForTests === true
  if (!allowNonSsdForTests) {
    assertCondition(researchRoot.startsWith("/Volumes/ResearchSSD"),
      "worker:research_root_must_be_research_ssd")
  }
  const candidateRoot = join(
    researchRoot,
    "Datasets/DNA-Intelligence/work/v3/candidate-corpus",
  )
  const batchRoot = join(
    researchRoot,
    "Datasets/DNA-Intelligence/work/v3/method-appraisals/batch-v1",
  )
  return Object.freeze({
    researchRoot,
    repoRoot,
    candidateRoot,
    batchRoot,
    workpackIndexPath: join(candidateRoot, "method-review-workpack-index.json"),
    runIndexPath: join(batchRoot, "run-index.json"),
    contractPath: join(
      repoRoot,
      "docs/dna-intelligence/governance/v3/method-appraisal-batch-contract.json",
    ),
    designProfilesPath: join(
      repoRoot,
      "docs/dna-intelligence/governance/v3/method-appraisal-design-profiles.json",
    ),
    allowNonSsdForTests,
    now: input.now ?? (() => new Date().toISOString()),
  })
}

function validateRunIndexShape(index: BatchRunIndex): void {
  assertCondition(index.schemaVersion === "dna-method-appraisal-batch-run-index@1",
    "worker:invalid_run_index_schema")
  assertCondition(index.reviewArchitecture === DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE,
    "worker:invalid_run_index_architecture")
  assertCondition(Array.isArray(index.records), "worker:invalid_run_index_records")
  assertCondition(new Set(index.records.map((record) => record.sourceId)).size === index.records.length,
    "worker:duplicate_run_index_source")
  assertCondition(stableJson(index.statusVocabulary)
    === stableJson(DNA_METHOD_APPRAISAL_BATCH_STATUSES), "worker:run_index_status_vocabulary_drift")
  const artifactKeys = [
    "passAFileSha256", "passBFileSha256", "reconciliationFileSha256",
    "fidelityPassFileSha256", "candidateFileSha256",
  ]
  const receiptKeys = [
    "passAReceiptFileSha256", "passBReceiptFileSha256",
    "reconciliationReceiptFileSha256", "fidelityPassReceiptFileSha256",
    "candidateReceiptFileSha256",
  ]
  for (const record of index.records) {
    assertCondition(DNA_METHOD_APPRAISAL_BATCH_STATUSES.includes(record.status),
      `worker:invalid_record_status:${record.sourceId}`)
    assertCondition(record.artifacts && stableJson(Object.keys(record.artifacts).sort())
      === stableJson([...artifactKeys].sort()), `worker:invalid_artifact_shape:${record.sourceId}`)
    assertCondition(record.receipts && stableJson(Object.keys(record.receipts).sort())
      === stableJson([...receiptKeys].sort()), `worker:invalid_receipt_shape:${record.sourceId}`)
    for (const value of [...Object.values(record.artifacts), ...Object.values(record.receipts)]) {
      assertCondition(value === null || SHA256_PATTERN.test(value),
        `worker:invalid_record_hash:${record.sourceId}`)
    }
    assertCondition(record.trustedRegistryStatus === "not_registered"
      && record.runtimeEligible === false && record.releaseEligible === false,
    `worker:record_authority_expanded:${record.sourceId}`)
  }
  assertCondition(index.canonicalPayloadSha256 === payloadHash(index),
    "worker:run_index_payload_hash_mismatch")
  assertCondition(index.counts.runtimeEligible === 0 && index.counts.releaseEligible === 0
    && index.counts.registered === 0, "worker:run_index_authority_expanded")
}

function loadBaseAuthority(context: DnaMethodAppraisalWorkerContext): {
  index: BatchRunIndex
  indexRawSha256: string
  workpackIndex: WorkpackIndex
  profiles: DesignProfileRegistry
  globalStaleIssues: string[]
} {
  for (const path of [
    context.runIndexPath,
    context.workpackIndexPath,
    context.contractPath,
    context.designProfilesPath,
  ]) assertCondition(existsSync(path), `worker:missing_authority_file:${path}`)
  const index = readJson<BatchRunIndex>(context.runIndexPath)
  validateRunIndexShape(index)
  const workpackIndex = readJson<WorkpackIndex>(context.workpackIndexPath)
  assertCondition(workpackIndex.schemaVersion === "dna-v3-method-review-workpack-index@3",
    "worker:invalid_workpack_index_schema")
  assertCondition(Array.isArray(workpackIndex.records), "worker:invalid_workpack_index_records")
  assertCondition(new Set(workpackIndex.records.map((record) => record.sourceId)).size
    === workpackIndex.records.length, "worker:duplicate_workpack_index_source")
  const profiles = readJson<DesignProfileRegistry>(context.designProfilesPath)
  const profileValidation = validateDnaMethodAppraisalDesignProfileRegistry(profiles)
  assertCondition(profileValidation.ok,
    `worker:invalid_design_profile_registry:${profileValidation.errors.join(",")}`)
  const contract = readJson<{ schemaVersion?: string; reviewArchitecture?: string }>(context.contractPath)
  assertCondition(contract.schemaVersion === DNA_METHOD_APPRAISAL_BATCH_CONTRACT_VERSION,
    "worker:invalid_batch_contract_version")
  assertCondition(contract.reviewArchitecture === DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE,
    "worker:invalid_batch_contract_architecture")
  const globalStaleIssues: string[] = []
  const expectedBindings = {
    workpackIndexFileSha256: fileSha256(context.workpackIndexPath),
    workpackIndexDeclaredSha256: workpackIndex.indexSha256,
    batchContractFileSha256: fileSha256(context.contractPath),
    designProfileRegistryFileSha256: fileSha256(context.designProfilesPath),
  }
  for (const [key, expected] of Object.entries(expectedBindings)) {
    if (index.inputBindings[key as keyof typeof index.inputBindings] !== expected) {
      globalStaleIssues.push(`stale_input:${key}`)
    }
  }
  return {
    index,
    indexRawSha256: fileSha256(context.runIndexPath),
    workpackIndex,
    profiles,
    globalStaleIssues,
  }
}

function loadSourceAuthority(
  context: DnaMethodAppraisalWorkerContext,
  sourceId: string,
): SourceAuthority {
  assertSourceId(sourceId)
  const base = loadBaseAuthority(context)
  const indexRecords = base.index.records.filter((record) => record.sourceId === sourceId)
  const workpackRecords = base.workpackIndex.records.filter((record) => record.sourceId === sourceId)
  assertCondition(indexRecords.length === 1, `worker:run_index_source_not_unique:${sourceId}`)
  assertCondition(workpackRecords.length === 1, `worker:workpack_source_not_unique:${sourceId}`)
  const indexRecord = indexRecords[0]
  const workpackRecord = workpackRecords[0]
  const workpackPath = join(context.candidateRoot, workpackRecord.relativePath)
  assertContained(context.candidateRoot, workpackPath, "worker:workpack_path_escape")
  assertCondition(existsSync(workpackPath), `worker:missing_workpack:${sourceId}`)
  const workpack = readJson<Workpack>(workpackPath)
  const staleIssues = [...base.globalStaleIssues]
  if (workpack.sourceId !== sourceId) staleIssues.push("stale_input:workpack_source_id")
  if (workpack.workpackSha256 !== workpackRecord.workpackSha256) {
    staleIssues.push("stale_input:workpack_payload_hash")
  }
  if (indexRecord.workpackRelativePath !== workpackRecord.relativePath) {
    staleIssues.push("stale_input:workpack_relative_path")
  }
  if (indexRecord.workpackFileSha256 !== fileSha256(workpackPath)) {
    staleIssues.push("stale_input:workpack_file_hash")
  }
  if (indexRecord.workpackPayloadSha256 !== workpackRecord.workpackSha256) {
    staleIssues.push("stale_input:workpack_record_hash")
  }
  if (workpack.status !== "candidate_only" || workpack.runtimeEligible !== false
    || workpack.releaseEligible !== false) staleIssues.push("stale_input:workpack_authority")
  const expectedProfileId = base.profiles.declaredDesignAliases[workpack.declaredStudyDesign]
  if (!expectedProfileId) staleIssues.push("stale_input:declared_design_unmapped")
  if (indexRecord.designProfileId !== expectedProfileId) {
    staleIssues.push("stale_input:design_profile_id")
  }
  const profile = base.profiles.profiles.find((entry) => entry.id === expectedProfileId)
  assertCondition(profile, `worker:design_profile_missing:${sourceId}`)
  assertCondition(Array.isArray(workpack.paragraphs), `worker:workpack_paragraphs_invalid:${sourceId}`)
  const paragraphIds = new Set(workpack.paragraphs.map((paragraph) => paragraph.paragraphId))
  assertCondition(paragraphIds.size === workpack.paragraphs.length,
    `worker:duplicate_workpack_paragraph:${sourceId}`)
  const sourceBinding: DnaMethodReviewSourceBinding = Object.freeze({
    workpackRelativePath: workpackRecord.relativePath,
    workpackFileSha256: fileSha256(workpackPath),
    workpackPayloadSha256: workpackRecord.workpackSha256,
    artifactId: workpack.artifactId,
    artifactSha256: workpack.artifactSha256,
    parsedContentSha256: workpack.parsedContentSha256,
  })
  const contractBinding: DnaMethodReviewContractBinding = Object.freeze({
    contractFileSha256: fileSha256(context.contractPath),
    designProfileRegistrySha256: fileSha256(context.designProfilesPath),
    designProfileId: profile.id,
  })
  return {
    index: base.index,
    indexRawSha256: base.indexRawSha256,
    workpackIndex: base.workpackIndex,
    workpackRecord,
    indexRecord,
    workpack,
    sourceBinding,
    contractBinding,
    designProfile: profile,
    paragraphIds,
    staleIssues: [...new Set(staleIssues)].sort(),
  }
}

function assertCurrentAuthority(authority: SourceAuthority): void {
  assertCondition(authority.staleIssues.length === 0,
    `worker:stale_inputs:${authority.staleIssues.join(",")}`)
}

function assertExpectedIndex(authority: SourceAuthority, expectedIndexSha256: string): void {
  assertCondition(SHA256_PATTERN.test(expectedIndexSha256), "worker:invalid_expected_index_hash")
  assertCondition(authority.indexRawSha256 === expectedIndexSha256,
    "worker:run_index_cas_mismatch")
}

function validateParagraphBindings(
  value: unknown,
  paragraphIds: ReadonlySet<string>,
  code: string,
): void {
  const found: string[] = []
  function walk(entry: unknown, key: string | null): void {
    if (Array.isArray(entry)) {
      if (key === "evidenceParagraphIds") {
        for (const paragraphId of entry) if (typeof paragraphId === "string") found.push(paragraphId)
      } else for (const item of entry) walk(item, null)
      return
    }
    if (!entry || typeof entry !== "object") return
    for (const [childKey, child] of Object.entries(entry as Record<string, unknown>)) {
      walk(child, childKey)
    }
  }
  walk(value, null)
  for (const paragraphId of found) {
    assertCondition(paragraphIds.has(paragraphId), `${code}:paragraph_not_in_workpack:${paragraphId}`)
  }
}

function validateExactSourceContext(
  sourceBinding: DnaMethodReviewSourceBinding,
  authority: SourceAuthority,
  code: string,
): void {
  assertCondition(stableJson(sourceBinding) === stableJson(authority.sourceBinding),
    `${code}:source_binding_mismatch`)
}

function validateExactContractContext(
  contractBinding: DnaMethodReviewContractBinding,
  authority: SourceAuthority,
  code: string,
): void {
  assertCondition(stableJson(contractBinding) === stableJson(authority.contractBinding),
    `${code}:contract_binding_mismatch`)
}

function packetStage(role: DnaMethodAppraisalWorkerPassRole): "pass-a" | "pass-b" {
  return role === "A" ? "pass-a" : "pass-b"
}

function passRole(role: DnaMethodAppraisalWorkerPassRole):
"method_appraisal_a" | "method_appraisal_b" {
  return role === "A" ? "method_appraisal_a" : "method_appraisal_b"
}

function sourceRoot(context: DnaMethodAppraisalWorkerContext, sourceId: string): string {
  const root = join(context.batchRoot, "sources", sourceId)
  assertContained(context.batchRoot, root, "worker:source_path_escape")
  return root
}

function nextRevision(directory: string): number {
  if (!existsSync(directory)) return 1
  const revisions = readdirSync(directory)
    .map((name) => /^r(\d{6})\.json$/.exec(name)?.[1])
    .filter((value): value is string => Boolean(value))
    .map(Number)
  return revisions.length === 0 ? 1 : Math.max(...revisions) + 1
}

function revisionName(revision: number): string {
  return `r${String(revision).padStart(6, "0")}.json`
}

function writeExclusiveJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, jsonBytes(value), { flag: "wx", mode: 0o600 })
}

function atomicWriteAlias(path: string, bytes: Buffer): void {
  mkdirSync(dirname(path), { recursive: true })
  const temporaryPath = `${path}.tmp-${process.pid}-${randomUUID()}`
  try {
    writeFileSync(temporaryPath, bytes, { flag: "wx", mode: 0o600 })
    renameSync(temporaryPath, path)
  } finally {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath)
  }
}

function validateReviewPacket(
  packet: DnaMethodAppraisalReviewPacket,
  authority: SourceAuthority,
  role: DnaMethodAppraisalWorkerPassRole,
): void {
  assertCondition(packet.schemaVersion === DNA_METHOD_APPRAISAL_REVIEW_PACKET_VERSION,
    "worker:packet_schema_invalid")
  assertCondition(packet.contractVersion === DNA_METHOD_APPRAISAL_BATCH_CONTRACT_VERSION,
    "worker:packet_contract_invalid")
  assertCondition(packet.reviewArchitecture === DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE,
    "worker:packet_architecture_invalid")
  assertCondition(packet.sourceId === authority.indexRecord.sourceId, "worker:packet_source_mismatch")
  assertCondition(packet.passRole === passRole(role), "worker:packet_role_mismatch")
  assertCondition(exactIso(packet.createdAt), "worker:packet_created_at_invalid")
  assertCondition(packet.status === "candidate_input_only" && packet.runtimeEligible === false
    && packet.releaseEligible === false, "worker:packet_authority_expanded")
  assertCondition(packet.canonicalPayloadSha256 === payloadHash(packet),
    "worker:packet_payload_hash_mismatch")
  validateExactSourceContext(packet.allowedInputs.sourceBinding, authority, "worker:packet")
  validateExactContractContext(packet.allowedInputs.contractBinding, authority, "worker:packet")
  assertCondition(SHA256_PATTERN.test(packet.allowedInputs.runIndexFileSha256),
    "worker:packet_run_index_hash_invalid")
  assertCondition(Array.isArray(packet.prohibitedInputs)
    && packet.prohibitedInputs.includes("other_method_appraisal_pass_output"),
  "worker:packet_missing_output_blinding_boundary")
}

export function prepareDnaMethodAppraisalReviewPacket(input: Readonly<{
  context: DnaMethodAppraisalWorkerContext
  sourceId: string
  role: DnaMethodAppraisalWorkerPassRole
  expectedIndexSha256: string
}>): Readonly<{
  packetPath: string
  packetFileSha256: string
  packetCanonicalPayloadSha256: string
  runIndexFileSha256: string
}> {
  const authority = loadSourceAuthority(input.context, input.sourceId)
  assertCurrentAuthority(authority)
  assertExpectedIndex(authority, input.expectedIndexSha256)
  assertCondition(!["candidate_complete_unregistered", "quarantined"].includes(
    authority.indexRecord.status), "worker:source_not_preparable")
  const stage = packetStage(input.role)
  const packetDirectory = join(sourceRoot(input.context, input.sourceId), "packets", stage)
  const revision = nextRevision(packetDirectory)
  const createdAt = input.context.now()
  assertCondition(exactIso(createdAt), "worker:clock_not_exact_iso")
  const packetPayload = {
    schemaVersion: DNA_METHOD_APPRAISAL_REVIEW_PACKET_VERSION,
    contractVersion: DNA_METHOD_APPRAISAL_BATCH_CONTRACT_VERSION,
    reviewArchitecture: DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE,
    packetId: `${input.sourceId}:${stage}:${String(revision).padStart(6, "0")}`,
    sourceId: input.sourceId,
    passRole: passRole(input.role),
    createdAt,
    status: "candidate_input_only" as const,
    runtimeEligible: false as const,
    releaseEligible: false as const,
    allowedInputs: Object.freeze({
      sourceBinding: authority.sourceBinding,
      contractBinding: authority.contractBinding,
      runIndexFileSha256: authority.indexRawSha256,
    }),
    prohibitedInputs: Object.freeze([
      "other_method_appraisal_pass_output",
      "reconciliation_output",
      "fidelity_output",
      "runtime_or_release_registry",
    ]),
    reviewInstructions: Object.freeze({
      methodFields: DNA_BATCH_METHOD_FIELD_NAMES,
      adaptedGradeDimensions: DNA_BATCH_ADAPTED_GRADE_DIMENSIONS,
      sampleSizeFields: Object.freeze(["studyCount", "participantCount", "datasetCount"]),
      designProfileQuestions: Object.freeze([...authority.designProfile.mandatoryQuestions]),
      boundaries: Object.freeze([
        "Do not infer missing methods from title, source role, or design label.",
        "Every asserted finding must cite paragraph IDs from the bound workpack.",
        "This Codex pass is output-blinded process separation, not independent human review.",
        "The output cannot grant runtime, release, or trusted-registry authority.",
      ]),
    }),
  }
  const packet = withCanonicalHash(packetPayload) as DnaMethodAppraisalReviewPacket
  const packetPath = join(packetDirectory, revisionName(revision))
  writeExclusiveJson(packetPath, packet)
  return Object.freeze({
    packetPath,
    packetFileSha256: fileSha256(packetPath),
    packetCanonicalPayloadSha256: packet.canonicalPayloadSha256,
    runIndexFileSha256: authority.indexRawSha256,
  })
}

function recomputeIndexCounts(index: BatchRunIndex): void {
  index.counts = {
    totalWorkpacks: index.records.length,
    queued: index.records.filter((record) => record.status === "queued").length,
    inProgress: index.records.filter((record) => [
      "pass_a_complete", "pass_b_complete", "awaiting_reconciliation", "awaiting_fidelity",
      "awaiting_compile", "needs_revision", "stale_inputs",
    ].includes(record.status)).length,
    candidateCompleteUnregistered: index.records.filter((record) =>
      record.status === "candidate_complete_unregistered").length,
    contestedOrQuarantined: index.records.filter((record) =>
      record.status === "contested" || record.status === "quarantined").length,
    registered: 0,
    runtimeEligible: 0,
    releaseEligible: 0,
  }
}

function updateIndexCanonicalHash(index: BatchRunIndex): void {
  const { canonicalPayloadSha256: _hash, ...payload } = index
  index.canonicalPayloadSha256 = hashDnaMethodAppraisalBatchPayload(payload)
}

function stageHashField(stage: DnaMethodAppraisalWorkerStage): keyof BatchArtifactHashes {
  if (stage === "pass-a") return "passAFileSha256"
  if (stage === "pass-b") return "passBFileSha256"
  if (stage === "reconciliation") return "reconciliationFileSha256"
  if (stage === "fidelity-pass") return "fidelityPassFileSha256"
  return "candidateFileSha256"
}

function stageReceiptHashField(stage: DnaMethodAppraisalWorkerStage): keyof BatchReceiptHashes {
  if (stage === "pass-a") return "passAReceiptFileSha256"
  if (stage === "pass-b") return "passBReceiptFileSha256"
  if (stage === "reconciliation") return "reconciliationReceiptFileSha256"
  if (stage === "fidelity-pass") return "fidelityPassReceiptFileSha256"
  return "candidateReceiptFileSha256"
}

function canonicalStageFilename(stage: DnaMethodAppraisalWorkerStage): string {
  return `${stage}.json`
}

function latestReceipt(
  context: DnaMethodAppraisalWorkerContext,
  sourceId: string,
  stage: DnaMethodAppraisalWorkerStage,
): { receipt: EvidenceReceipt; path: string; fileSha256: string } | null {
  const receiptDirectory = join(sourceRoot(context, sourceId), "receipts", stage)
  if (!existsSync(receiptDirectory)) return null
  const revisions = readdirSync(receiptDirectory)
    .map((name) => ({ name, match: /^r(\d{6})\.json$/.exec(name) }))
    .filter((entry): entry is { name: string; match: RegExpExecArray } => Boolean(entry.match))
    .sort((left, right) => Number(left.match[1]) - Number(right.match[1]))
  if (revisions.length === 0) return null
  const path = join(receiptDirectory, revisions[revisions.length - 1].name)
  return { receipt: readJson<EvidenceReceipt>(path), path, fileSha256: fileSha256(path) }
}

function stageWasInvalidatedAfterReceipt(
  context: DnaMethodAppraisalWorkerContext,
  sourceId: string,
  stage: DnaMethodAppraisalWorkerStage,
  receipt: EvidenceReceipt,
): boolean {
  for (const possibleInvalidator of [
    "pass-a", "pass-b", "reconciliation", "fidelity-pass", "candidate",
  ] as const) {
    const later = latestReceipt(context, sourceId, possibleInvalidator)
    if (!later || Date.parse(later.receipt.recordedAt) <= Date.parse(receipt.recordedAt)) continue
    if (later.receipt.downstreamInvalidated.includes(stage)) return true
  }
  return false
}

function validateReceipt(
  context: DnaMethodAppraisalWorkerContext,
  receipt: EvidenceReceipt,
  receiptPath: string,
  expectedSourceId?: string,
  expectedStage?: DnaMethodAppraisalWorkerStage,
): string[] {
  const issues: string[] = []
  if (receipt.schemaVersion !== DNA_METHOD_APPRAISAL_EVIDENCE_RECEIPT_VERSION) {
    issues.push("receipt_schema_invalid")
  }
  if (receipt.reviewArchitecture !== DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE) {
    issues.push("receipt_architecture_invalid")
  }
  if (expectedSourceId && receipt.sourceId !== expectedSourceId) issues.push("receipt_source_mismatch")
  if (expectedStage && receipt.stage !== expectedStage) issues.push("receipt_stage_mismatch")
  if (basename(receiptPath) !== revisionName(receipt.revision)) issues.push("receipt_revision_mismatch")
  if (!exactIso(receipt.recordedAt)) issues.push("receipt_recorded_at_invalid")
  if (receipt.canonicalPayloadSha256 !== payloadHash(receipt)) issues.push("receipt_hash_invalid")
  if (receipt.runtimeEligible !== false || receipt.releaseEligible !== false
    || receipt.trustedRegistryStatus !== "not_registered") issues.push("receipt_authority_expanded")
  const revisionPath = join(context.batchRoot, receipt.storedRevision.relativePath)
  try {
    assertContained(context.batchRoot, revisionPath, "receipt_path_escape")
    if (!existsSync(revisionPath)) issues.push("receipt_revision_missing")
    else if (fileSha256(revisionPath) !== receipt.storedRevision.fileSha256) {
      issues.push("receipt_revision_hash_mismatch")
    }
  } catch {
    issues.push("receipt_revision_path_invalid")
  }
  if (receipt.inputPacket) {
    const packetPath = join(context.batchRoot, receipt.inputPacket.relativePath)
    try {
      assertContained(context.batchRoot, packetPath, "receipt_packet_path_escape")
      if (!existsSync(packetPath)) issues.push("receipt_packet_missing")
      else if (fileSha256(packetPath) !== receipt.inputPacket.fileSha256) {
        issues.push("receipt_packet_hash_mismatch")
      }
    } catch {
      issues.push("receipt_packet_path_invalid")
    }
  }
  if (!receiptPath.startsWith(context.batchRoot)) issues.push("receipt_outside_batch_root")
  return issues
}

function recordStageRevision(input: Readonly<{
  context: DnaMethodAppraisalWorkerContext
  authority: SourceAuthority
  stage: DnaMethodAppraisalWorkerStage
  artifactBytes: Buffer
  canonicalPayloadSha256: string
  expectedIndexSha256: string
  inputPacket: { path: string; packet: DnaMethodAppraisalReviewPacket } | null
  inputBindings: Record<string, string>
  downstreamInvalidated: readonly DnaMethodAppraisalWorkerStage[]
  mutateRecord: (record: BatchIndexRecord, artifactFileSha256: string) => void
}>): Readonly<{
  artifactPath: string
  artifactFileSha256: string
  receiptPath: string
  receiptFileSha256: string
  runIndexFileSha256: string
  status: DnaMethodAppraisalBatchStatus
}> {
  const lockPath = join(input.context.batchRoot, "run-index.lock")
  mkdirSync(input.context.batchRoot, { recursive: true })
  let lockFd: number | null = null
  try {
    lockFd = openSync(lockPath, "wx", 0o600)
  } catch {
    throw new Error("worker:run_index_locked")
  }
  try {
    const freshAuthority = loadSourceAuthority(input.context, input.authority.indexRecord.sourceId)
    assertCurrentAuthority(freshAuthority)
    assertExpectedIndex(freshAuthority, input.expectedIndexSha256)
    const stageRoot = sourceRoot(input.context, freshAuthority.indexRecord.sourceId)
    const revisionDirectory = join(stageRoot, "revisions", input.stage)
    const receiptDirectory = join(stageRoot, "receipts", input.stage)
    const revision = Math.max(nextRevision(revisionDirectory), nextRevision(receiptDirectory))
    const revisionPath = join(revisionDirectory, revisionName(revision))
    mkdirSync(revisionDirectory, { recursive: true })
    writeFileSync(revisionPath, input.artifactBytes, { flag: "wx", mode: 0o600 })
    const artifactFileSha256 = fileSha256(revisionPath)
    const artifactHashField = stageHashField(input.stage)
    const previousArtifactFileSha256 = freshAuthority.indexRecord.artifacts[artifactHashField]
    const receiptPayload = {
      schemaVersion: DNA_METHOD_APPRAISAL_EVIDENCE_RECEIPT_VERSION,
      reviewArchitecture: DNA_METHOD_APPRAISAL_REVIEW_ARCHITECTURE,
      receiptId: `${freshAuthority.indexRecord.sourceId}:${input.stage}:${String(revision).padStart(6, "0")}`,
      sourceId: freshAuthority.indexRecord.sourceId,
      stage: input.stage,
      revision,
      recordedAt: input.context.now(),
      expectedRunIndexFileSha256: input.expectedIndexSha256,
      previousArtifactFileSha256,
      inputPacket: input.inputPacket ? Object.freeze({
        relativePath: relative(input.context.batchRoot, input.inputPacket.path),
        fileSha256: fileSha256(input.inputPacket.path),
        canonicalPayloadSha256: input.inputPacket.packet.canonicalPayloadSha256,
      }) : null,
      inputBindings: Object.freeze({ ...input.inputBindings }),
      storedRevision: Object.freeze({
        relativePath: relative(input.context.batchRoot, revisionPath),
        fileSha256: artifactFileSha256,
        canonicalPayloadSha256: input.canonicalPayloadSha256,
      }),
      downstreamInvalidated: Object.freeze([...input.downstreamInvalidated]),
      trustedRegistryStatus: "not_registered" as const,
      runtimeEligible: false as const,
      releaseEligible: false as const,
    }
    assertCondition(exactIso(receiptPayload.recordedAt), "worker:clock_not_exact_iso")
    const receipt = withCanonicalHash(receiptPayload) as EvidenceReceipt
    const receiptPath = join(receiptDirectory, revisionName(revision))
    writeExclusiveJson(receiptPath, receipt)
    const receiptFileSha256 = fileSha256(receiptPath)
    const aliasPath = join(stageRoot, canonicalStageFilename(input.stage))
    atomicWriteAlias(aliasPath, input.artifactBytes)
    const nextIndex = structuredClone(freshAuthority.index)
    const nextRecord = nextIndex.records.find((record) =>
      record.sourceId === freshAuthority.indexRecord.sourceId)
    assertCondition(nextRecord, "worker:index_record_disappeared")
    input.mutateRecord(nextRecord, artifactFileSha256)
    nextRecord.receipts[stageReceiptHashField(input.stage)] = receiptFileSha256
    nextRecord.trustedRegistryStatus = "not_registered"
    nextRecord.runtimeEligible = false
    nextRecord.releaseEligible = false
    recomputeIndexCounts(nextIndex)
    updateIndexCanonicalHash(nextIndex)
    const tempIndexPath = `${input.context.runIndexPath}.tmp-${process.pid}-${randomUUID()}`
    try {
      writeFileSync(tempIndexPath, jsonBytes(nextIndex), { flag: "wx", mode: 0o600 })
      assertCondition(fileSha256(input.context.runIndexPath) === input.expectedIndexSha256,
        "worker:run_index_cas_mismatch_before_commit")
      renameSync(tempIndexPath, input.context.runIndexPath)
    } finally {
      if (existsSync(tempIndexPath)) unlinkSync(tempIndexPath)
    }
    return Object.freeze({
      artifactPath: aliasPath,
      artifactFileSha256,
      receiptPath,
      receiptFileSha256,
      runIndexFileSha256: fileSha256(input.context.runIndexPath),
      status: nextRecord.status,
    })
  } finally {
    if (lockFd !== null) closeSync(lockFd)
    if (existsSync(lockPath)) unlinkSync(lockPath)
  }
}

function readAndValidatePacket(input: Readonly<{
  context: DnaMethodAppraisalWorkerContext
  authority: SourceAuthority
  role: DnaMethodAppraisalWorkerPassRole
  packetPath: string
}>): DnaMethodAppraisalReviewPacket {
  const packetPath = resolve(input.packetPath)
  assertContained(sourceRoot(input.context, input.authority.indexRecord.sourceId), packetPath,
    "worker:packet_outside_source_root")
  assertCondition(existsSync(packetPath), "worker:packet_missing")
  const packet = readJson<DnaMethodAppraisalReviewPacket>(packetPath)
  validateReviewPacket(packet, input.authority, input.role)
  return packet
}

export function ingestDnaMethodAppraisalPass(input: Readonly<{
  context: DnaMethodAppraisalWorkerContext
  sourceId: string
  role: DnaMethodAppraisalWorkerPassRole
  inputPath: string
  packetPath: string
  expectedIndexSha256: string
}>): ReturnType<typeof recordStageRevision> {
  const authority = loadSourceAuthority(input.context, input.sourceId)
  assertCurrentAuthority(authority)
  assertExpectedIndex(authority, input.expectedIndexSha256)
  const stage = packetStage(input.role)
  const artifactField = stageHashField(stage)
  const canRevise = authority.indexRecord.status === "needs_revision"
  assertCondition([
    "queued", "pass_a_complete", "pass_b_complete", "awaiting_reconciliation",
    "needs_revision",
  ].includes(authority.indexRecord.status), "worker:pass_transition_not_allowed")
  assertCondition(authority.indexRecord.artifacts[artifactField] === null || canRevise,
    "worker:stage_already_complete")
  const packet = readAndValidatePacket({
    context: input.context,
    authority,
    role: input.role,
    packetPath: input.packetPath,
  })
  const artifactBytes = readBytes(resolve(input.inputPath))
  const pass = JSON.parse(artifactBytes.toString("utf8")) as DnaMethodReviewPass
  const validation = validateDnaMethodReviewPass(pass)
  assertCondition(validation.ok, `worker:pass_invalid:${validation.errors.join(",")}`)
  assertCondition(pass.sourceId === input.sourceId, "worker:pass_source_mismatch")
  assertCondition(pass.passRole === passRole(input.role), "worker:pass_role_mismatch")
  validateExactSourceContext(pass.sourceBinding, authority, "worker:pass")
  validateExactContractContext(pass.contractBinding, authority, "worker:pass")
  validateParagraphBindings(pass, authority.paragraphIds, "worker:pass")
  const downstreamInvalidated: DnaMethodAppraisalWorkerStage[] = [
    "reconciliation", "fidelity-pass", "candidate",
  ]
  return recordStageRevision({
    context: input.context,
    authority,
    stage,
    artifactBytes,
    canonicalPayloadSha256: pass.canonicalPayloadSha256,
    expectedIndexSha256: input.expectedIndexSha256,
    inputPacket: { path: resolve(input.packetPath), packet },
    inputBindings: {
      packetFileSha256: fileSha256(resolve(input.packetPath)),
      workpackFileSha256: authority.sourceBinding.workpackFileSha256,
      contractFileSha256: authority.contractBinding.contractFileSha256,
      designProfileRegistrySha256: authority.contractBinding.designProfileRegistrySha256,
    },
    downstreamInvalidated,
    mutateRecord: (record, artifactFileSha256) => {
      record.artifacts[artifactField] = artifactFileSha256
      record.artifacts.reconciliationFileSha256 = null
      record.artifacts.fidelityPassFileSha256 = null
      record.artifacts.candidateFileSha256 = null
      record.receipts.reconciliationReceiptFileSha256 = null
      record.receipts.fidelityPassReceiptFileSha256 = null
      record.receipts.candidateReceiptFileSha256 = null
      if (record.artifacts.passAFileSha256 && record.artifacts.passBFileSha256) {
        record.status = "awaiting_reconciliation"
      } else record.status = input.role === "A" ? "pass_a_complete" : "pass_b_complete"
    },
  })
}

function currentArtifactPath(
  context: DnaMethodAppraisalWorkerContext,
  sourceId: string,
  stage: DnaMethodAppraisalWorkerStage,
): string {
  return join(sourceRoot(context, sourceId), canonicalStageFilename(stage))
}

function readCurrentPass(
  context: DnaMethodAppraisalWorkerContext,
  authority: SourceAuthority,
  role: DnaMethodAppraisalWorkerPassRole,
): DnaMethodReviewPass {
  const stage = packetStage(role)
  const path = currentArtifactPath(context, authority.indexRecord.sourceId, stage)
  const expectedHash = authority.indexRecord.artifacts[stageHashField(stage)]
  assertCondition(expectedHash && existsSync(path) && fileSha256(path) === expectedHash,
    `worker:current_${stage}_missing_or_stale`)
  const pass = readJson<DnaMethodReviewPass>(path)
  const validation = validateDnaMethodReviewPass(pass)
  assertCondition(validation.ok, `worker:current_${stage}_invalid:${validation.errors.join(",")}`)
  validateExactSourceContext(pass.sourceBinding, authority, `worker:current_${stage}`)
  validateExactContractContext(pass.contractBinding, authority, `worker:current_${stage}`)
  validateParagraphBindings(pass, authority.paragraphIds, `worker:current_${stage}`)
  return pass
}

export function ingestDnaMethodAppraisalReconciliation(input: Readonly<{
  context: DnaMethodAppraisalWorkerContext
  sourceId: string
  inputPath: string
  expectedIndexSha256: string
}>): ReturnType<typeof recordStageRevision> {
  const authority = loadSourceAuthority(input.context, input.sourceId)
  assertCurrentAuthority(authority)
  assertExpectedIndex(authority, input.expectedIndexSha256)
  assertCondition([
    "awaiting_reconciliation", "needs_revision",
  ].includes(authority.indexRecord.status), "worker:reconciliation_transition_not_allowed")
  assertCondition(authority.indexRecord.artifacts.passAFileSha256
    && authority.indexRecord.artifacts.passBFileSha256,
  "worker:reconciliation_requires_pass_a_and_b")
  const passA = readCurrentPass(input.context, authority, "A")
  const passB = readCurrentPass(input.context, authority, "B")
  const artifactBytes = readBytes(resolve(input.inputPath))
  const reconciliation = JSON.parse(artifactBytes.toString("utf8")) as
    DnaMethodAppraisalReconciliation
  const validation = validateDnaMethodAppraisalReconciliation(reconciliation)
  assertCondition(validation.ok, `worker:reconciliation_invalid:${validation.errors.join(",")}`)
  assertCondition(reconciliation.sourceId === input.sourceId, "worker:reconciliation_source_mismatch")
  validateExactSourceContext(reconciliation.sourceBinding, authority, "worker:reconciliation")
  validateExactContractContext(reconciliation.contractBinding, authority, "worker:reconciliation")
  assertCondition(reconciliation.inputBindings.passASha256 === passA.canonicalPayloadSha256
    && reconciliation.inputBindings.passBSha256 === passB.canonicalPayloadSha256,
  "worker:reconciliation_input_hash_mismatch")
  validateParagraphBindings(reconciliation, authority.paragraphIds, "worker:reconciliation")
  return recordStageRevision({
    context: input.context,
    authority,
    stage: "reconciliation",
    artifactBytes,
    canonicalPayloadSha256: reconciliation.canonicalPayloadSha256,
    expectedIndexSha256: input.expectedIndexSha256,
    inputPacket: null,
    inputBindings: {
      passACanonicalPayloadSha256: passA.canonicalPayloadSha256,
      passBCanonicalPayloadSha256: passB.canonicalPayloadSha256,
    },
    downstreamInvalidated: ["fidelity-pass", "candidate"],
    mutateRecord: (record, artifactFileSha256) => {
      record.artifacts.reconciliationFileSha256 = artifactFileSha256
      record.artifacts.fidelityPassFileSha256 = null
      record.artifacts.candidateFileSha256 = null
      record.receipts.fidelityPassReceiptFileSha256 = null
      record.receipts.candidateReceiptFileSha256 = null
      record.status = reconciliation.unresolvedIssues.length > 0
        ? "needs_revision"
        : "awaiting_fidelity"
    },
  })
}

function readCurrentReconciliation(
  context: DnaMethodAppraisalWorkerContext,
  authority: SourceAuthority,
): DnaMethodAppraisalReconciliation {
  const path = currentArtifactPath(context, authority.indexRecord.sourceId, "reconciliation")
  const expectedHash = authority.indexRecord.artifacts.reconciliationFileSha256
  assertCondition(expectedHash && existsSync(path) && fileSha256(path) === expectedHash,
    "worker:current_reconciliation_missing_or_stale")
  const reconciliation = readJson<DnaMethodAppraisalReconciliation>(path)
  const validation = validateDnaMethodAppraisalReconciliation(reconciliation)
  assertCondition(validation.ok,
    `worker:current_reconciliation_invalid:${validation.errors.join(",")}`)
  validateExactSourceContext(reconciliation.sourceBinding, authority, "worker:current_reconciliation")
  validateExactContractContext(reconciliation.contractBinding, authority,
    "worker:current_reconciliation")
  validateParagraphBindings(reconciliation, authority.paragraphIds, "worker:current_reconciliation")
  return reconciliation
}

export function ingestDnaMethodAppraisalFidelity(input: Readonly<{
  context: DnaMethodAppraisalWorkerContext
  sourceId: string
  inputPath: string
  expectedIndexSha256: string
}>): ReturnType<typeof recordStageRevision> {
  const authority = loadSourceAuthority(input.context, input.sourceId)
  assertCurrentAuthority(authority)
  assertExpectedIndex(authority, input.expectedIndexSha256)
  assertCondition([
    "awaiting_fidelity", "needs_revision", "contested",
  ].includes(authority.indexRecord.status), "worker:fidelity_transition_not_allowed")
  const passA = readCurrentPass(input.context, authority, "A")
  const passB = readCurrentPass(input.context, authority, "B")
  const reconciliation = readCurrentReconciliation(input.context, authority)
  const artifactBytes = readBytes(resolve(input.inputPath))
  const fidelity = JSON.parse(artifactBytes.toString("utf8")) as DnaMethodAppraisalFidelityPass
  const validation = validateDnaMethodAppraisalFidelityPass(fidelity)
  assertCondition(validation.ok, `worker:fidelity_invalid:${validation.errors.join(",")}`)
  assertCondition(fidelity.sourceId === input.sourceId, "worker:fidelity_source_mismatch")
  validateExactSourceContext(fidelity.sourceBinding, authority, "worker:fidelity")
  assertCondition(fidelity.inputBindings.passASha256 === passA.canonicalPayloadSha256
    && fidelity.inputBindings.passBSha256 === passB.canonicalPayloadSha256
    && fidelity.inputBindings.reconciliationSha256 === reconciliation.canonicalPayloadSha256,
  "worker:fidelity_input_hash_mismatch")
  const actualLocatorsResolve = (() => {
    try {
      validateParagraphBindings(reconciliation, authority.paragraphIds, "worker:fidelity")
      return true
    } catch {
      return false
    }
  })()
  if (fidelity.assessment.allLocatorsResolve) {
    assertCondition(actualLocatorsResolve, "worker:fidelity_locator_claim_false")
  }
  const clean = fidelity.disposition === "passed"
    && Object.entries(fidelity.assessment)
      .filter(([key]) => key !== "issues")
      .every(([, value]) => value === true)
    && fidelity.assessment.issues.length === 0
  return recordStageRevision({
    context: input.context,
    authority,
    stage: "fidelity-pass",
    artifactBytes,
    canonicalPayloadSha256: fidelity.canonicalPayloadSha256,
    expectedIndexSha256: input.expectedIndexSha256,
    inputPacket: null,
    inputBindings: {
      passACanonicalPayloadSha256: passA.canonicalPayloadSha256,
      passBCanonicalPayloadSha256: passB.canonicalPayloadSha256,
      reconciliationCanonicalPayloadSha256: reconciliation.canonicalPayloadSha256,
    },
    downstreamInvalidated: ["candidate"],
    mutateRecord: (record, artifactFileSha256) => {
      record.artifacts.fidelityPassFileSha256 = artifactFileSha256
      record.artifacts.candidateFileSha256 = null
      record.receipts.candidateReceiptFileSha256 = null
      record.status = clean
        ? "awaiting_compile"
        : fidelity.disposition === "contested" ? "contested" : "needs_revision"
    },
  })
}

function readCurrentFidelity(
  context: DnaMethodAppraisalWorkerContext,
  authority: SourceAuthority,
): DnaMethodAppraisalFidelityPass {
  const path = currentArtifactPath(context, authority.indexRecord.sourceId, "fidelity-pass")
  const expectedHash = authority.indexRecord.artifacts.fidelityPassFileSha256
  assertCondition(expectedHash && existsSync(path) && fileSha256(path) === expectedHash,
    "worker:current_fidelity_missing_or_stale")
  const fidelity = readJson<DnaMethodAppraisalFidelityPass>(path)
  const validation = validateDnaMethodAppraisalFidelityPass(fidelity)
  assertCondition(validation.ok, `worker:current_fidelity_invalid:${validation.errors.join(",")}`)
  validateExactSourceContext(fidelity.sourceBinding, authority, "worker:current_fidelity")
  return fidelity
}

export function compileDnaMethodAppraisalWorkerCandidate(input: Readonly<{
  context: DnaMethodAppraisalWorkerContext
  sourceId: string
  expectedIndexSha256: string
}>): ReturnType<typeof recordStageRevision> {
  const authority = loadSourceAuthority(input.context, input.sourceId)
  assertCurrentAuthority(authority)
  assertExpectedIndex(authority, input.expectedIndexSha256)
  assertCondition(authority.indexRecord.status === "awaiting_compile",
    "worker:candidate_not_ready_for_compile")
  const passA = readCurrentPass(input.context, authority, "A")
  const passB = readCurrentPass(input.context, authority, "B")
  const reconciliation = readCurrentReconciliation(input.context, authority)
  const fidelityPass = readCurrentFidelity(input.context, authority)
  const candidate = compileDnaMethodAppraisalCandidate({
    passA,
    passB,
    reconciliation,
    fidelityPass,
  })
  const validation = validateDnaMethodAppraisalCandidate(candidate)
  assertCondition(validation.ok, `worker:candidate_invalid:${validation.errors.join(",")}`)
  validateParagraphBindings(candidate, authority.paragraphIds, "worker:candidate")
  const artifactBytes = jsonBytes(candidate)
  return recordStageRevision({
    context: input.context,
    authority,
    stage: "candidate",
    artifactBytes,
    canonicalPayloadSha256: candidate.canonicalPayloadSha256,
    expectedIndexSha256: input.expectedIndexSha256,
    inputPacket: null,
    inputBindings: {
      passACanonicalPayloadSha256: passA.canonicalPayloadSha256,
      passBCanonicalPayloadSha256: passB.canonicalPayloadSha256,
      reconciliationCanonicalPayloadSha256: reconciliation.canonicalPayloadSha256,
      fidelityCanonicalPayloadSha256: fidelityPass.canonicalPayloadSha256,
    },
    downstreamInvalidated: [],
    mutateRecord: (record, artifactFileSha256) => {
      record.artifacts.candidateFileSha256 = artifactFileSha256
      record.status = "candidate_complete_unregistered"
    },
  })
}

function validateCurrentStage(
  context: DnaMethodAppraisalWorkerContext,
  authority: SourceAuthority,
  stage: DnaMethodAppraisalWorkerStage,
): string[] {
  const issues: string[] = []
  const expectedHash = authority.indexRecord.artifacts[stageHashField(stage)]
  if (!expectedHash) {
    const unindexedReceipt = latestReceipt(context, authority.indexRecord.sourceId, stage)
    const aliasPath = currentArtifactPath(context, authority.indexRecord.sourceId, stage)
    if (unindexedReceipt
      && !stageWasInvalidatedAfterReceipt(
        context,
        authority.indexRecord.sourceId,
        stage,
        unindexedReceipt.receipt,
      )) issues.push(`${stage}:orphan_receipt_not_indexed`)
    if (existsSync(aliasPath) && !unindexedReceipt) issues.push(`${stage}:orphan_alias_without_receipt`)
    return issues
  }
  const aliasPath = currentArtifactPath(context, authority.indexRecord.sourceId, stage)
  if (!existsSync(aliasPath)) return [`${stage}:alias_missing`]
  if (fileSha256(aliasPath) !== expectedHash) issues.push(`${stage}:alias_hash_mismatch`)
  const latest = latestReceipt(context, authority.indexRecord.sourceId, stage)
  if (!latest) issues.push(`${stage}:receipt_missing`)
  else {
    issues.push(...validateReceipt(
      context,
      latest.receipt,
      latest.path,
      authority.indexRecord.sourceId,
      stage,
    )
      .map((issue) => `${stage}:${issue}`))
    if (latest.receipt.storedRevision.fileSha256 !== expectedHash) {
      issues.push(`${stage}:latest_receipt_not_indexed`)
    }
    const expectedReceiptHash = authority.indexRecord.receipts[stageReceiptHashField(stage)]
    if (expectedReceiptHash !== latest.fileSha256) issues.push(`${stage}:receipt_index_hash_mismatch`)
  }
  try {
    if (stage === "pass-a" || stage === "pass-b") {
      const pass = readJson<DnaMethodReviewPass>(aliasPath)
      const validation = validateDnaMethodReviewPass(pass)
      if (!validation.ok) issues.push(...validation.errors.map((error) => `${stage}:${error}`))
      validateExactSourceContext(pass.sourceBinding, authority, stage)
      validateExactContractContext(pass.contractBinding, authority, stage)
      validateParagraphBindings(pass, authority.paragraphIds, stage)
      if (latest?.receipt.inputPacket === null) issues.push(`${stage}:packet_receipt_missing`)
      else if (latest?.receipt.inputPacket) {
        const packetPath = join(context.batchRoot, latest.receipt.inputPacket.relativePath)
        const packet = readJson<DnaMethodAppraisalReviewPacket>(packetPath)
        validateReviewPacket(packet, authority, stage === "pass-a" ? "A" : "B")
      }
    } else if (stage === "reconciliation") {
      const reconciliation = readJson<DnaMethodAppraisalReconciliation>(aliasPath)
      const validation = validateDnaMethodAppraisalReconciliation(reconciliation)
      if (!validation.ok) issues.push(...validation.errors.map((error) => `${stage}:${error}`))
      validateExactSourceContext(reconciliation.sourceBinding, authority, stage)
      validateExactContractContext(reconciliation.contractBinding, authority, stage)
      validateParagraphBindings(reconciliation, authority.paragraphIds, stage)
    } else if (stage === "fidelity-pass") {
      const fidelity = readJson<DnaMethodAppraisalFidelityPass>(aliasPath)
      const validation = validateDnaMethodAppraisalFidelityPass(fidelity)
      if (!validation.ok) issues.push(...validation.errors.map((error) => `${stage}:${error}`))
      validateExactSourceContext(fidelity.sourceBinding, authority, stage)
    } else {
      const candidate = readJson<DnaMethodAppraisalCandidate>(aliasPath)
      const validation = validateDnaMethodAppraisalCandidate(candidate)
      if (!validation.ok) issues.push(...validation.errors.map((error) => `${stage}:${error}`))
      validateExactSourceContext(candidate.sourceBinding, authority, stage)
      validateParagraphBindings(candidate, authority.paragraphIds, stage)
    }
  } catch (error) {
    issues.push(`${stage}:content_validation_failed:${error instanceof Error ? error.message : "unknown"}`)
  }
  return [...new Set(issues)].sort()
}

function validateCurrentChain(
  context: DnaMethodAppraisalWorkerContext,
  authority: SourceAuthority,
): string[] {
  const issues: string[] = []
  try {
    const hasPassA = Boolean(authority.indexRecord.artifacts.passAFileSha256)
    const hasPassB = Boolean(authority.indexRecord.artifacts.passBFileSha256)
    const hasReconciliation = Boolean(authority.indexRecord.artifacts.reconciliationFileSha256)
    const hasFidelity = Boolean(authority.indexRecord.artifacts.fidelityPassFileSha256)
    const hasCandidate = Boolean(authority.indexRecord.artifacts.candidateFileSha256)
    const passA = hasPassA ? readCurrentPass(context, authority, "A") : null
    const passB = hasPassB ? readCurrentPass(context, authority, "B") : null
    const reconciliation = hasReconciliation
      ? readCurrentReconciliation(context, authority)
      : null
    if (reconciliation) {
      if (!passA || !passB) issues.push("chain:reconciliation_without_both_passes")
      else if (reconciliation.inputBindings.passASha256 !== passA.canonicalPayloadSha256
        || reconciliation.inputBindings.passBSha256 !== passB.canonicalPayloadSha256) {
        issues.push("chain:reconciliation_input_hash_mismatch")
      }
    }
    const fidelity = hasFidelity ? readCurrentFidelity(context, authority) : null
    if (fidelity) {
      if (!passA || !passB || !reconciliation) issues.push("chain:fidelity_without_inputs")
      else if (fidelity.inputBindings.passASha256 !== passA.canonicalPayloadSha256
        || fidelity.inputBindings.passBSha256 !== passB.canonicalPayloadSha256
        || fidelity.inputBindings.reconciliationSha256 !== reconciliation.canonicalPayloadSha256) {
        issues.push("chain:fidelity_input_hash_mismatch")
      }
    }
    if (hasCandidate) {
      if (!passA || !passB || !reconciliation || !fidelity) {
        issues.push("chain:candidate_without_inputs")
      } else {
        const candidatePath = currentArtifactPath(
          context,
          authority.indexRecord.sourceId,
          "candidate",
        )
        const actualCandidate = readJson<DnaMethodAppraisalCandidate>(candidatePath)
        const expectedCandidate = compileDnaMethodAppraisalCandidate({
          passA,
          passB,
          reconciliation,
          fidelityPass: fidelity,
        })
        if (stableJson(actualCandidate) !== stableJson(expectedCandidate)) {
          issues.push("chain:candidate_compiler_output_mismatch")
        }
      }
    }
  } catch (error) {
    issues.push(`chain:validation_failed:${error instanceof Error ? error.message : "unknown"}`)
  }
  return issues
}

export function getDnaMethodAppraisalWorkerStatus(
  context: DnaMethodAppraisalWorkerContext,
): DnaMethodAppraisalWorkerStatus {
  const base = loadBaseAuthority(context)
  const globalIssues = [...base.globalStaleIssues]
  const records = base.index.records.map((record) => {
    const issues: string[] = []
    let authority: SourceAuthority | null = null
    try {
      authority = loadSourceAuthority(context, record.sourceId)
      issues.push(...authority.staleIssues)
      if (authority.staleIssues.length === 0) {
        for (const stage of [
          "pass-a", "pass-b", "reconciliation", "fidelity-pass", "candidate",
        ] as const) issues.push(...validateCurrentStage(context, authority, stage))
        issues.push(...validateCurrentChain(context, authority))
      }
    } catch (error) {
      issues.push(`authority_load_failed:${error instanceof Error ? error.message : "unknown"}`)
    }
    const uniqueIssues = [...new Set(issues)].sort()
    return Object.freeze({
      sourceId: record.sourceId,
      recordedStatus: record.status,
      effectiveStatus: uniqueIssues.some((issue) => issue.startsWith("stale_input:"))
        ? "stale_inputs" as const
        : record.status,
      issues: Object.freeze(uniqueIssues),
    })
  })
  const issues = [...new Set([
    ...globalIssues,
    ...records.flatMap((record) => record.issues.map((issue) => `${record.sourceId}:${issue}`)),
  ])].sort()
  return Object.freeze({
    ok: issues.length === 0,
    runIndexFileSha256: base.indexRawSha256,
    issues: Object.freeze(issues),
    counts: base.index.counts,
    records: Object.freeze(records),
  })
}

/** Test-only cleanup helper; production code never calls this. */
export function removeDnaMethodAppraisalWorkerTestRoot(path: string): void {
  rmSync(path, { recursive: true, force: true })
}

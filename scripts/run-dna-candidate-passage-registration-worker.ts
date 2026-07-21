#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto"
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { dirname, join, relative, resolve } from "node:path"

import {
  assertDnaCandidatePassageDecision,
  compileDnaCandidatePassageRegistration,
  getDnaCandidatePassageConstraints,
  hashDnaCandidatePassagePayload,
  isDnaCandidatePassageRegistrationResultValid,
  mergeDnaCandidatePassageRegistries,
  type DnaCandidatePassageDecision,
  type DnaCandidatePassageRegistrationResult,
  type DnaCandidatePassageWorkpack,
} from "../src/lib/dna/chat/governance/candidatePassageRegistration"
import { parseDnaEvidenceArtifact } from "../src/lib/dna/chat/governance/evidenceExtraction"
import {
  isDnaMethodAppraisalRegistrationResultValid,
  type DnaMethodAppraisalRegistrationResult,
} from "../src/lib/dna/chat/governance/methodAppraisalRegistration"
import {
  getDnaMethodAppraisalRegistrationStatus,
  type RegistrationIndex as MethodRegistrationIndex,
} from "./run-dna-method-appraisal-registration-worker"

export type CandidatePassageRegistrationRecord = Readonly<{
  sourceId: string
  status: "candidate_passages_registered"
  decisionRelativePath: string
  decisionFileSha256: string
  decisionSha256: string
  resultRelativePath: string
  resultFileSha256: string
  resultSha256: string
  receiptRelativePath: string
  receiptFileSha256: string
  receiptSha256: string
  workpackFileSha256: string
  workpackPayloadSha256: string
  methodRegistrationResultFileSha256: string
  methodRegistrationResultSha256: string
  expectedPreviousIndexFileSha256: string
  candidateTrustRegistryShaAfterRegistration: string
  passageCollectionShaAfterRegistration: string
  passageCount: number
  runtimeEligible: false
  releaseEligible: false
}>

export type CandidatePassageRegistrationIndex = Readonly<{
  schemaVersion: "dna-candidate-passage-registration-index@1"
  authority: "candidate_audit"
  records: readonly CandidatePassageRegistrationRecord[]
  candidateTrustRegistrySha256: string
  passageCollectionSha256: string
  counts: Readonly<{
    candidatePassageSources: number
    candidatePassages: number
    runtimeEligible: 0
    releaseEligible: 0
  }>
  canonicalPayloadSha256: string
}>

export type CandidatePassageRegistrationReceipt = Readonly<{
  schemaVersion: "dna-candidate-passage-registration-receipt@1"
  receiptId: string
  recordedAt: string
  sourceId: string
  expectedPreviousIndexFileSha256: string
  decisionFileSha256: string
  decisionSha256: string
  resultFileSha256: string
  resultSha256: string
  workpackFileSha256: string
  workpackPayloadSha256: string
  methodRegistrationResultFileSha256: string
  methodRegistrationResultSha256: string
  candidateTrustRegistrySha256: string
  passageCollectionSha256: string
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
  if (!value) throw new Error(`candidate_passage_worker:missing_option:${name}`)
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

function fileSha256FromValue(value: unknown): string {
  return createHash("sha256").update(jsonBytes(value)).digest("hex")
}

function assertContained(root: string, target: string, code: string): void {
  const child = relative(resolve(root), resolve(target))
  if (child === ".." || child.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) {
    throw new Error(code)
  }
}

function assertRegularContainedFile(root: string, target: string, code: string): void {
  assertContained(root, target, `${code}_path_escape`)
  if (!existsSync(target) || !lstatSync(target).isFile()) throw new Error(`${code}_missing`)
  const realRoot = realpathSync(root)
  const realTarget = realpathSync(target)
  assertContained(realRoot, realTarget, `${code}_symlink_escape`)
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

function registrationRoot(researchRoot: string): string {
  return join(resolve(researchRoot),
    "Datasets/DNA-Intelligence/work/v3/candidate-passage-registrations/v1")
}

function candidateRoot(researchRoot: string): string {
  return join(resolve(researchRoot), "Datasets/DNA-Intelligence/work/v3/candidate-corpus")
}

function methodRegistrationRoot(researchRoot: string): string {
  return join(resolve(researchRoot),
    "Datasets/DNA-Intelligence/work/v3/method-appraisal-registrations/v1")
}

function sourceLibraryRoot(researchRoot: string): string {
  return join(resolve(researchRoot), "Datasets/SelfMetaAI/dna-knowledge/source-library")
}

type WorkpackIndex = Readonly<{
  schemaVersion: "dna-v3-method-review-workpack-index@3"
  records: readonly Readonly<{
    sourceId: string
    relativePath: string
    workpackSha256: string
    sourceRecordSha256: string
    integrityState: string
    integrityAuditRecordSha256: string
    integrityDecisionSha256: string
    passageLicenseDecision: string
    componentLicenseAuditRecordSha256: string
    sourceGovernanceLicenseRecordSha256: string
    passageLicenseDecisionSha256: string
  }>[]
  indexSha256: string
}>

function validateWorkpackIndex(index: WorkpackIndex): void {
  const { indexSha256, ...payload } = index
  if (index.schemaVersion !== "dna-v3-method-review-workpack-index@3"
    || indexSha256 !== createHash("sha256").update(JSON.stringify(payload)).digest("hex")
    || new Set(index.records.map((record) => record.sourceId)).size !== index.records.length) {
    throw new Error("candidate_passage_worker:workpack_index_invalid")
  }
}

type SourceAuthority = Readonly<{
  workpack: DnaCandidatePassageWorkpack
  workpackPath: string
  workpackFileSha256: string
  methodRegistrationResult: DnaMethodAppraisalRegistrationResult
  methodRegistrationResultPath: string
  methodRegistrationResultFileSha256: string
  parsedArtifact: ReturnType<typeof parseDnaEvidenceArtifact>
}>

export function loadDnaCandidatePassageSourceAuthority(
  researchRoot: string,
  sourceId: string,
): SourceAuthority {
  if (!SOURCE_ID_PATTERN.test(sourceId)) {
    throw new Error("candidate_passage_worker:invalid_source_id")
  }
  const methodStatus = getDnaMethodAppraisalRegistrationStatus(researchRoot)
  if (!methodStatus.ok || methodStatus.state !== "valid") {
    throw new Error("candidate_passage_worker:method_registration_state_invalid")
  }
  const methodRoot = methodRegistrationRoot(researchRoot)
  const methodIndexPath = join(methodRoot, "index.json")
  const methodIndex = readJson<MethodRegistrationIndex>(methodIndexPath)
  const methodRecord = methodIndex.records.find((record) => record.sourceId === sourceId)
  if (!methodRecord || methodRecord.status !== "registered_for_method_pipeline"
    || methodRecord.runtimeEligible !== false || methodRecord.releaseEligible !== false) {
    throw new Error("candidate_passage_worker:method_registration_missing")
  }
  const methodRegistrationResultPath = join(methodRoot, methodRecord.resultRelativePath)
  assertRegularContainedFile(methodRoot, methodRegistrationResultPath,
    "candidate_passage_worker:method_result")
  const methodRegistrationResultFileSha256 = fileSha256(methodRegistrationResultPath)
  const methodRegistrationResult = readJson<DnaMethodAppraisalRegistrationResult>(
    methodRegistrationResultPath,
  )
  if (methodRegistrationResultFileSha256 !== methodRecord.resultFileSha256
    || methodRegistrationResult.resultSha256 !== methodRecord.resultSha256
    || !isDnaMethodAppraisalRegistrationResultValid(methodRegistrationResult)) {
    throw new Error("candidate_passage_worker:method_result_invalid")
  }

  const corpusRoot = candidateRoot(researchRoot)
  const workpackIndexPath = join(corpusRoot, "method-review-workpack-index.json")
  assertRegularContainedFile(corpusRoot, workpackIndexPath,
    "candidate_passage_worker:workpack_index")
  const workpackIndex = readJson<WorkpackIndex>(workpackIndexPath)
  validateWorkpackIndex(workpackIndex)
  const workpackRecord = workpackIndex.records.find((record) => record.sourceId === sourceId)
  if (!workpackRecord) throw new Error("candidate_passage_worker:workpack_not_indexed")
  const workpackPath = join(corpusRoot, workpackRecord.relativePath)
  assertRegularContainedFile(corpusRoot, workpackPath, "candidate_passage_worker:workpack")
  const workpack = readJson<DnaCandidatePassageWorkpack>(workpackPath)
  const workpackFileSha256 = fileSha256(workpackPath)
  if (workpack.sourceId !== sourceId
    || workpack.workpackSha256 !== workpackRecord.workpackSha256
    || workpack.sourceRecordSha256 !== workpackRecord.sourceRecordSha256
    || workpack.passageLicenseDecision !== workpackRecord.passageLicenseDecision
    || workpack.componentLicenseAuditRecordSha256
      !== workpackRecord.componentLicenseAuditRecordSha256
    || workpack.passageLicenseDecisionSha256
      !== workpackRecord.passageLicenseDecisionSha256) {
    throw new Error("candidate_passage_worker:workpack_index_binding_mismatch")
  }

  const libraryRoot = sourceLibraryRoot(researchRoot)
  const sourceRecordPath = join(libraryRoot, workpack.sourceRecordRelativePath)
  assertRegularContainedFile(libraryRoot, sourceRecordPath,
    "candidate_passage_worker:source_record")
  if (fileSha256(sourceRecordPath) !== workpack.sourceRecordSha256) {
    throw new Error("candidate_passage_worker:source_record_hash_mismatch")
  }
  const artifactPath = join(libraryRoot, workpack.artifactRelativePath)
  assertRegularContainedFile(libraryRoot, artifactPath, "candidate_passage_worker:artifact")
  const firstParagraph = workpack.paragraphs[0]
  if (!firstParagraph || firstParagraph.format !== "jats_xml") {
    throw new Error("candidate_passage_worker:unsupported_or_empty_workpack")
  }
  const parsedArtifact = parseDnaEvidenceArtifact({
    sourceId,
    artifactId: workpack.artifactId,
    format: firstParagraph.format,
    originalLanguage: firstParagraph.originalLanguage,
    bytes: readFileSync(artifactPath),
    declaredSha256: workpack.artifactSha256,
  })
  if (parsedArtifact.parsedContentSha256 !== workpack.parsedContentSha256
    || JSON.stringify(parsedArtifact.paragraphs) !== JSON.stringify(workpack.paragraphs)
    || JSON.stringify(parsedArtifact.exclusions) !== JSON.stringify(workpack.exclusions)) {
    throw new Error("candidate_passage_worker:parsed_artifact_binding_mismatch")
  }
  return {
    workpack,
    workpackPath,
    workpackFileSha256,
    methodRegistrationResult,
    methodRegistrationResultPath,
    methodRegistrationResultFileSha256,
    parsedArtifact,
  }
}

function loadCompileInputs(researchRoot: string, sourceId: string, decisionPath: string) {
  if (!existsSync(decisionPath)) throw new Error("candidate_passage_worker:decision_missing")
  const authority = loadDnaCandidatePassageSourceAuthority(researchRoot, sourceId)
  return {
    decision: readJson<DnaCandidatePassageDecision>(decisionPath),
    parsedArtifact: authority.parsedArtifact,
    workpack: authority.workpack,
    workpackFileSha256: authority.workpackFileSha256,
    methodRegistrationResult: authority.methodRegistrationResult,
    methodRegistrationResultFileSha256: authority.methodRegistrationResultFileSha256,
  }
}

function buildGlobalArtifacts(root: string,
  results: readonly DnaCandidatePassageRegistrationResult[]) {
  const registry = mergeDnaCandidatePassageRegistries(results)
  const passages = results.flatMap((result) => result.passages)
    .sort((left, right) => left.id.localeCompare(right.id, "en"))
  return {
    registry,
    passages,
    registrySha256: hashDnaCandidatePassagePayload(registry),
    passagesSha256: hashDnaCandidatePassagePayload(passages),
    registryPath: join(root, "candidate-passage-trust-registry.json"),
    passagesPath: join(root, "candidate-passages.json"),
  }
}

function buildIndex(records: readonly CandidatePassageRegistrationRecord[],
  registrySha256: string, passagesSha256: string): CandidatePassageRegistrationIndex {
  const sorted = [...records].sort((left, right) => left.sourceId.localeCompare(right.sourceId, "en"))
  const payload = {
    schemaVersion: "dna-candidate-passage-registration-index@1" as const,
    authority: "candidate_audit" as const,
    records: sorted,
    candidateTrustRegistrySha256: registrySha256,
    passageCollectionSha256: passagesSha256,
    counts: {
      candidatePassageSources: sorted.length,
      candidatePassages: sorted.reduce((sum, record) => sum + record.passageCount, 0),
      runtimeEligible: 0 as const,
      releaseEligible: 0 as const,
    },
  }
  return {
    ...payload,
    canonicalPayloadSha256: hashDnaCandidatePassagePayload(payload),
  }
}

function assertIndex(index: CandidatePassageRegistrationIndex): void {
  const { canonicalPayloadSha256, ...payload } = index
  const sourceIds = index.records.map((record) => record.sourceId)
  const sortedSourceIds = [...sourceIds].sort((left, right) => left.localeCompare(right, "en"))
  if (index.schemaVersion !== "dna-candidate-passage-registration-index@1"
    || index.authority !== "candidate_audit"
    || canonicalPayloadSha256 !== hashDnaCandidatePassagePayload(payload)
    || JSON.stringify(sourceIds) !== JSON.stringify(sortedSourceIds)
    || new Set(sourceIds).size !== sourceIds.length
    || index.counts.candidatePassageSources !== index.records.length
    || index.counts.candidatePassages
      !== index.records.reduce((sum, record) => sum + record.passageCount, 0)
    || index.counts.runtimeEligible !== 0 || index.counts.releaseEligible !== 0
    || index.records.some((record) => record.status !== "candidate_passages_registered"
      || record.runtimeEligible !== false || record.releaseEligible !== false
      || record.passageCount < 1 || !Number.isInteger(record.passageCount)
      || !SOURCE_ID_PATTERN.test(record.sourceId)
      || [record.decisionFileSha256, record.decisionSha256, record.resultFileSha256,
        record.resultSha256, record.receiptFileSha256, record.receiptSha256,
        record.workpackFileSha256, record.workpackPayloadSha256,
        record.methodRegistrationResultFileSha256, record.methodRegistrationResultSha256,
        record.candidateTrustRegistryShaAfterRegistration,
        record.passageCollectionShaAfterRegistration].some((hash) => !SHA256_PATTERN.test(hash))
      || (record.expectedPreviousIndexFileSha256 !== "absent"
        && !SHA256_PATTERN.test(record.expectedPreviousIndexFileSha256)))) {
    throw new Error("candidate_passage_worker:index_invalid")
  }
}

function receiptIntegrityValid(receipt: CandidatePassageRegistrationReceipt): boolean {
  const { canonicalPayloadSha256, ...payload } = receipt
  return receipt.schemaVersion === "dna-candidate-passage-registration-receipt@1"
    && canonicalPayloadSha256 === hashDnaCandidatePassagePayload(payload)
    && Number.isFinite(Date.parse(receipt.recordedAt))
    && new Date(Date.parse(receipt.recordedAt)).toISOString() === receipt.recordedAt
    && receipt.runtimeEligible === false && receipt.releaseEligible === false
}

export function prepareDnaCandidatePassageReviewPacket(input: Readonly<{
  researchRoot: string
  sourceId: string
}>): unknown {
  const authority = loadDnaCandidatePassageSourceAuthority(input.researchRoot, input.sourceId)
  const constraints = getDnaCandidatePassageConstraints({
    studyDesign: authority.methodRegistrationResult.appraisal.studyDesign,
    ageScope: authority.methodRegistrationResult.appraisal.ageScope,
  })
  const payload = {
    schemaVersion: "dna-candidate-passage-review-packet@1" as const,
    status: "candidate_only" as const,
    runtimeEligible: false as const,
    releaseEligible: false as const,
    sourceId: input.sourceId,
    bindings: {
      artifactSha256: authority.workpack.artifactSha256,
      workpackPayloadSha256: authority.workpack.workpackSha256,
      workpackFileSha256: authority.workpackFileSha256,
      methodRegistrationResultSha256: authority.methodRegistrationResult.resultSha256,
      methodRegistrationResultFileSha256: authority.methodRegistrationResultFileSha256,
    },
    constraints,
    methodBoundary: {
      studyDesign: authority.methodRegistrationResult.appraisal.studyDesign,
      ageScope: authority.methodRegistrationResult.appraisal.ageScope,
      population: authority.methodRegistrationResult.appraisal.population,
      causalBoundary: authority.methodRegistrationResult.appraisal.causalBoundary,
      generalizability: authority.methodRegistrationResult.appraisal.generalizability,
      limitations: authority.methodRegistrationResult.appraisal.limitations,
    },
    instructions: [
      "Select only passages that directly support a bounded scientific statement.",
      "Use one to three adjacent or logically inseparable paragraphs per passage.",
      "Do not select references, tables, instruments, third-party components, or unsupported mechanisms.",
      "This packet authorizes candidate extraction only; it never authorizes runtime or release.",
    ],
    paragraphs: authority.workpack.paragraphs,
  }
  const packet = {
    ...payload,
    packetSha256: hashDnaCandidatePassagePayload(payload),
  }
  const path = join(registrationRoot(input.researchRoot), "packets", input.sourceId, "r000001.json")
  atomicWrite(path, packet)
  return {
    ok: true,
    sourceId: input.sourceId,
    packetPath: path,
    packetFileSha256: fileSha256(path),
    packetSha256: packet.packetSha256,
    paragraphCount: authority.workpack.paragraphs.length,
    runtimeEligible: false,
    releaseEligible: false,
  }
}

export function getDnaCandidatePassageRegistrationStatus(researchRoot: string): {
  ok: boolean
  state: "empty" | "valid" | "invalid"
  indexFileSha256: string
  candidatePassageSources: number
  candidatePassages: number
  runtimeEligible: 0
  releaseEligible: 0
  issues: string[]
} {
  const root = registrationRoot(researchRoot)
  const indexPath = join(root, "index.json")
  if (!existsSync(indexPath)) {
    const unexpected = existsSync(root) && readdirSync(root)
      .some((entry) => !["packets", "index.lock"].includes(entry))
    return {
      ok: !unexpected,
      state: unexpected ? "invalid" : "empty",
      indexFileSha256: "absent",
      candidatePassageSources: 0,
      candidatePassages: 0,
      runtimeEligible: 0,
      releaseEligible: 0,
      issues: unexpected ? ["candidate_passage_state_without_index"] : [],
    }
  }
  const issues: string[] = []
  let index: CandidatePassageRegistrationIndex
  try {
    index = readJson<CandidatePassageRegistrationIndex>(indexPath)
    assertIndex(index)
  } catch (error) {
    return {
      ok: false,
      state: "invalid",
      indexFileSha256: fileSha256(indexPath),
      candidatePassageSources: 0,
      candidatePassages: 0,
      runtimeEligible: 0,
      releaseEligible: 0,
      issues: [error instanceof Error ? error.message : "candidate_passage_worker:index_invalid"],
    }
  }
  const results: DnaCandidatePassageRegistrationResult[] = []
  for (const record of index.records) {
    const decisionPath = join(root, record.decisionRelativePath)
    const resultPath = join(root, record.resultRelativePath)
    const receiptPath = join(root, record.receiptRelativePath)
    try {
      for (const path of [decisionPath, resultPath, receiptPath]) {
        assertRegularContainedFile(root, path, "candidate_passage_worker:registered_artifact")
      }
      if (fileSha256(decisionPath) !== record.decisionFileSha256
        || fileSha256(resultPath) !== record.resultFileSha256
        || fileSha256(receiptPath) !== record.receiptFileSha256) {
        throw new Error("registered_file_hash_mismatch")
      }
      const decision = readJson<DnaCandidatePassageDecision>(decisionPath)
      const result = readJson<DnaCandidatePassageRegistrationResult>(resultPath)
      const receipt = readJson<CandidatePassageRegistrationReceipt>(receiptPath)
      assertDnaCandidatePassageDecision(decision)
      if (!isDnaCandidatePassageRegistrationResultValid(result)
        || !receiptIntegrityValid(receipt)
        || decision.decisionSha256 !== record.decisionSha256
        || result.resultSha256 !== record.resultSha256
        || receipt.canonicalPayloadSha256 !== record.receiptSha256
        || receipt.sourceId !== record.sourceId
        || receipt.resultSha256 !== record.resultSha256
        || receipt.decisionSha256 !== record.decisionSha256
        || receipt.workpackFileSha256 !== record.workpackFileSha256
        || receipt.workpackPayloadSha256 !== record.workpackPayloadSha256
        || receipt.methodRegistrationResultFileSha256
          !== record.methodRegistrationResultFileSha256
        || receipt.methodRegistrationResultSha256
          !== record.methodRegistrationResultSha256
        || receipt.candidateTrustRegistrySha256
          !== record.candidateTrustRegistryShaAfterRegistration
        || receipt.passageCollectionSha256
          !== record.passageCollectionShaAfterRegistration) {
        throw new Error("registered_payload_mismatch")
      }
      const inputs = loadCompileInputs(researchRoot, record.sourceId, decisionPath)
      if (inputs.workpackFileSha256 !== record.workpackFileSha256
        || inputs.workpack.workpackSha256 !== record.workpackPayloadSha256
        || inputs.methodRegistrationResultFileSha256
          !== record.methodRegistrationResultFileSha256
        || inputs.methodRegistrationResult.resultSha256
          !== record.methodRegistrationResultSha256
        || compileDnaCandidatePassageRegistration(inputs).resultSha256 !== result.resultSha256) {
        throw new Error("current_source_recompile_mismatch")
      }
      results.push(result)
    } catch (error) {
      issues.push(`${record.sourceId}:${error instanceof Error ? error.message : "invalid"}`)
    }
  }
  const sourceDirectories = existsSync(join(root, "sources"))
    ? readdirSync(join(root, "sources"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory()).map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right, "en"))
    : []
  const indexedSources = index.records.map((record) => record.sourceId)
  if (JSON.stringify(sourceDirectories) !== JSON.stringify(indexedSources)) {
    issues.push("source_directory_index_mismatch")
  }
  const globals = buildGlobalArtifacts(root, results)
  if (!existsSync(globals.registryPath)
    || fileSha256(globals.registryPath) !== fileSha256FromValue(globals.registry)
    || globals.registrySha256 !== index.candidateTrustRegistrySha256) {
    issues.push("candidate_registry_mismatch")
  }
  if (!existsSync(globals.passagesPath)
    || fileSha256(globals.passagesPath) !== fileSha256FromValue(globals.passages)
    || globals.passagesSha256 !== index.passageCollectionSha256) {
    issues.push("candidate_passage_collection_mismatch")
  }
  return {
    ok: issues.length === 0,
    state: issues.length === 0 ? "valid" : "invalid",
    indexFileSha256: fileSha256(indexPath),
    candidatePassageSources: index.counts.candidatePassageSources,
    candidatePassages: index.counts.candidatePassages,
    runtimeEligible: 0,
    releaseEligible: 0,
    issues,
  }
}

export function ingestDnaCandidatePassageRegistration(input: Readonly<{
  researchRoot: string
  sourceId: string
  decisionInputPath: string
  expectedIndexSha: string
  allowNonSsdForTests?: boolean
  now?: () => string
}>): unknown {
  if (input.expectedIndexSha !== "absent" && !SHA256_PATTERN.test(input.expectedIndexSha)) {
    throw new Error("candidate_passage_worker:invalid_expected_index_hash")
  }
  const resolvedResearchRoot = resolve(input.researchRoot)
  if (!input.allowNonSsdForTests && resolvedResearchRoot !== "/Volumes/ResearchSSD"
    && !resolvedResearchRoot.startsWith("/Volumes/ResearchSSD/")) {
    throw new Error("candidate_passage_worker:research_root_must_be_research_ssd")
  }
  const root = registrationRoot(input.researchRoot)
  mkdirSync(root, { recursive: true })
  const indexPath = join(root, "index.json")
  const observedIndexSha = existsSync(indexPath) ? fileSha256(indexPath) : "absent"
  if (observedIndexSha !== input.expectedIndexSha) {
    throw new Error("candidate_passage_worker:index_cas_mismatch")
  }
  const lockPath = join(root, "index.lock")
  let lock: number | null = null
  try {
    lock = openSync(lockPath, "wx", 0o600)
  } catch {
    throw new Error("candidate_passage_worker:index_locked")
  }
  let createdSourceRoot = false
  let committed = false
  let previousIndexBytes: Buffer | null = null
  let previousRegistryBytes: Buffer | null = null
  let previousPassagesBytes: Buffer | null = null
  let globals: ReturnType<typeof buildGlobalArtifacts> | null = null
  try {
    const lockedSha = existsSync(indexPath) ? fileSha256(indexPath) : "absent"
    if (lockedSha !== input.expectedIndexSha) {
      throw new Error("candidate_passage_worker:index_cas_mismatch_after_lock")
    }
    previousIndexBytes = existsSync(indexPath) ? readFileSync(indexPath) : null
    const previousIndex = previousIndexBytes
      ? JSON.parse(previousIndexBytes.toString("utf8")) as CandidatePassageRegistrationIndex
      : null
    if (previousIndex) assertIndex(previousIndex)
    if (previousIndex?.records.some((record) => record.sourceId === input.sourceId)) {
      throw new Error("candidate_passage_worker:source_already_registered")
    }
    const decisionPathInput = resolve(input.decisionInputPath)
    const inputs = loadCompileInputs(input.researchRoot, input.sourceId, decisionPathInput)
    const result = compileDnaCandidatePassageRegistration(inputs)
    const previousResults = (previousIndex?.records ?? []).map((record) => {
      const path = join(root, record.resultRelativePath)
      assertRegularContainedFile(root, path, "candidate_passage_worker:previous_result")
      if (fileSha256(path) !== record.resultFileSha256) {
        throw new Error("candidate_passage_worker:previous_result_file_invalid")
      }
      const previousResult = readJson<DnaCandidatePassageRegistrationResult>(path)
      if (!isDnaCandidatePassageRegistrationResultValid(previousResult)) {
        throw new Error("candidate_passage_worker:previous_result_payload_invalid")
      }
      return previousResult
    })
    globals = buildGlobalArtifacts(root, [...previousResults, result])
    const sourceRoot = join(root, "sources", input.sourceId)
    assertContained(root, sourceRoot, "candidate_passage_worker:source_path_escape")
    if (existsSync(sourceRoot)) {
      throw new Error("candidate_passage_worker:source_artifact_already_exists")
    }
    const decisionPath = join(sourceRoot, "decision.json")
    const resultPath = join(sourceRoot, "result.json")
    const receiptPath = join(sourceRoot, "receipt.json")
    const decisionBytes = readFileSync(decisionPathInput)
    const resultBytes = jsonBytes(result)
    const decisionFileSha256 = createHash("sha256").update(decisionBytes).digest("hex")
    const resultFileSha256 = createHash("sha256").update(resultBytes).digest("hex")
    const receiptPayload = {
      schemaVersion: "dna-candidate-passage-registration-receipt@1" as const,
      receiptId: `candidate-passage:${input.sourceId}:${inputs.decision.decisionSha256.slice(0, 16)}`,
      recordedAt: (input.now ?? (() => new Date().toISOString()))(),
      sourceId: input.sourceId,
      expectedPreviousIndexFileSha256: input.expectedIndexSha,
      decisionFileSha256,
      decisionSha256: inputs.decision.decisionSha256,
      resultFileSha256,
      resultSha256: result.resultSha256,
      workpackFileSha256: inputs.workpackFileSha256,
      workpackPayloadSha256: inputs.workpack.workpackSha256,
      methodRegistrationResultFileSha256: inputs.methodRegistrationResultFileSha256,
      methodRegistrationResultSha256: inputs.methodRegistrationResult.resultSha256,
      candidateTrustRegistrySha256: globals.registrySha256,
      passageCollectionSha256: globals.passagesSha256,
      runtimeEligible: false as const,
      releaseEligible: false as const,
    }
    const receipt: CandidatePassageRegistrationReceipt = {
      ...receiptPayload,
      canonicalPayloadSha256: hashDnaCandidatePassagePayload(receiptPayload),
    }
    const receiptBytes = jsonBytes(receipt)
    const record: CandidatePassageRegistrationRecord = {
      sourceId: input.sourceId,
      status: "candidate_passages_registered",
      decisionRelativePath: relative(root, decisionPath),
      decisionFileSha256,
      decisionSha256: inputs.decision.decisionSha256,
      resultRelativePath: relative(root, resultPath),
      resultFileSha256,
      resultSha256: result.resultSha256,
      receiptRelativePath: relative(root, receiptPath),
      receiptFileSha256: createHash("sha256").update(receiptBytes).digest("hex"),
      receiptSha256: receipt.canonicalPayloadSha256,
      workpackFileSha256: inputs.workpackFileSha256,
      workpackPayloadSha256: inputs.workpack.workpackSha256,
      methodRegistrationResultFileSha256: inputs.methodRegistrationResultFileSha256,
      methodRegistrationResultSha256: inputs.methodRegistrationResult.resultSha256,
      expectedPreviousIndexFileSha256: input.expectedIndexSha,
      candidateTrustRegistryShaAfterRegistration: globals.registrySha256,
      passageCollectionShaAfterRegistration: globals.passagesSha256,
      passageCount: result.passages.length,
      runtimeEligible: false,
      releaseEligible: false,
    }
    const index = buildIndex([...(previousIndex?.records ?? []), record],
      globals.registrySha256, globals.passagesSha256)
    const transactionRoot = join(root, `.transaction-${process.pid}-${randomUUID()}`)
    const stagedSourceRoot = join(transactionRoot, "source")
    mkdirSync(stagedSourceRoot, { recursive: true })
    writeFileSync(join(stagedSourceRoot, "decision.json"), decisionBytes, { flag: "wx", mode: 0o600 })
    writeFileSync(join(stagedSourceRoot, "result.json"), resultBytes, { flag: "wx", mode: 0o600 })
    writeFileSync(join(stagedSourceRoot, "receipt.json"), receiptBytes, { flag: "wx", mode: 0o600 })
    previousRegistryBytes = existsSync(globals.registryPath) ? readFileSync(globals.registryPath) : null
    previousPassagesBytes = existsSync(globals.passagesPath) ? readFileSync(globals.passagesPath) : null
    try {
      mkdirSync(dirname(sourceRoot), { recursive: true })
      renameSync(stagedSourceRoot, sourceRoot)
      createdSourceRoot = true
      atomicWrite(globals.registryPath, globals.registry)
      atomicWrite(globals.passagesPath, globals.passages)
      atomicWrite(indexPath, index)
      committed = true
    } finally {
      if (existsSync(transactionRoot)) rmSync(transactionRoot, { recursive: true, force: true })
    }
    return {
      ok: true,
      sourceId: input.sourceId,
      decisionPath,
      resultPath,
      receiptPath,
      indexPath,
      indexFileSha256: fileSha256(indexPath),
      candidatePassageSources: index.counts.candidatePassageSources,
      candidatePassages: index.counts.candidatePassages,
      resultSha256: result.resultSha256,
      candidateTrustRegistrySha256: globals.registrySha256,
      runtimeEligible: false,
      releaseEligible: false,
    }
  } catch (error) {
    if (!committed) {
      if (globals) {
        restoreFile(globals.registryPath, previousRegistryBytes)
        restoreFile(globals.passagesPath, previousPassagesBytes)
      }
      restoreFile(indexPath, previousIndexBytes)
      const sourceRoot = join(root, "sources", input.sourceId)
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

export function runDnaCandidatePassageRegistrationWorkerCli(): void {
  const command = process.argv[2]
  const researchRoot = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
  if (command === "status") {
    const result = getDnaCandidatePassageRegistrationStatus(researchRoot)
    console.log(JSON.stringify(result, null, 2))
    if (process.argv.includes("--strict") && !result.ok) process.exitCode = 1
    return
  }
  if (command === "prepare") {
    console.log(JSON.stringify(prepareDnaCandidatePassageReviewPacket({
      researchRoot,
      sourceId: requiredOption("source"),
    }), null, 2))
    return
  }
  if (command === "ingest") {
    console.log(JSON.stringify(ingestDnaCandidatePassageRegistration({
      researchRoot,
      sourceId: requiredOption("source"),
      decisionInputPath: requiredOption("input"),
      expectedIndexSha: requiredOption("expected-index-sha"),
    }), null, 2))
    return
  }
  throw new Error("candidate_passage_worker:invalid_or_missing_command")
}

if (require.main === module) {
  try {
    runDnaCandidatePassageRegistrationWorkerCli()
  } catch (error) {
    console.error(error instanceof Error ? error.message : "candidate_passage_worker:unknown_error")
    process.exitCode = 1
  }
}

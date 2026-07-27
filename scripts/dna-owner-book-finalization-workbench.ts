import { createHash } from "node:crypto"
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { dirname, isAbsolute, join, relative } from "node:path"

import {
  buildDnaOwnerBookManifest,
  verifyDnaOwnerBookArtifact,
  type DnaOwnerBookDraftChapter,
  type DnaOwnerBookManifest,
} from "../src/lib/dna/chat/governance/bookLock"


export const FINALIZATION_WORKBENCH_VERSION =
  "dna-owner-book-finalization-workbench@1" as const
export const FINALIZATION_PACKAGE_SCHEMA =
  "dna-owner-book-finalization-package@1" as const
export const FINALIZATION_CURRENT_SCHEMA =
  "dna-owner-book-finalization-current@1" as const
export const FINALIZATION_REPO_MANIFEST_SCHEMA =
  "dna-owner-book-finalization-repo-manifest@1" as const
export const FINAL_BOOK_WRAPPER_SCHEMA =
  "dna-owner-book-final-candidate@1" as const
export const OWNER_DECLARATION_TEMPLATE_SCHEMA =
  "dna-owner-book-owner-declaration-template@1" as const
export const CLAIM_REVIEW_QUEUE_SCHEMA =
  "dna-owner-book-claim-review-slot@1" as const

export const DRAFT_OUTPUT_SUBPATH =
  "Outputs/SelfMetaAI/dna-intelligence/owner-book-draft"
export const FINALIZATION_OUTPUT_SUBPATH =
  "Outputs/SelfMetaAI/dna-intelligence/owner-book-finalization-workbench"

const REPO_ROOT = process.cwd()
export const DEFAULT_REPO_MANIFEST = join(
  REPO_ROOT,
  "docs/dna-intelligence/governance/v3/owner-book-finalization-workbench-manifest.json",
)
export const DEFAULT_SSD_ROOT = "/Volumes/ResearchSSD"

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const SAFE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{2,159}$/
const DRAFT_PACKAGE_FILES = new Set([
  "benchmark-candidates.jsonl",
  "canonical-book.txt",
  "checksums.sha256",
  "manifest.json",
  "records.jsonl",
  "sources.jsonl",
])
const DRAFT_PAYLOAD_FILES = new Set([
  "benchmark-candidates.jsonl",
  "canonical-book.txt",
  "records.jsonl",
  "sources.jsonl",
])
const FINALIZATION_PAYLOAD_FILES = new Set([
  "claim-review-queue.jsonl",
  "final-book-candidate.txt",
  "final-book-manifest.json",
  "owner-declaration-template.json",
])
const FINALIZATION_CHECKSUM_FILES = new Set([
  ...FINALIZATION_PAYLOAD_FILES,
  "workbench-manifest.json",
])
const FINALIZATION_PACKAGE_FILES = new Set([
  ...FINALIZATION_CHECKSUM_FILES,
  "checksums.sha256",
])
const FALSE_AUTHORITY_FIELDS = new Set([
  "ownerApproval",
  "runtimeEligible",
  "releaseEligible",
  "answerEligible",
  "activationAllowed",
  "evaluationEligible",
])
const FORBIDDEN_COMPACT_KEYS = new Set([
  "text",
  "canonicalText",
  "claimText",
  "referenceText",
  "question",
  "rows",
  "sourceFileName",
  "chapterTitle",
  "absolutePath",
])

type JsonObject = Record<string, unknown>

type VerifiedDraftPackage = Readonly<{
  outputRoot: string
  packageDirectory: string
  manifest: JsonObject
  artifactBytes: Uint8Array
  records: readonly JsonObject[]
  sources: readonly JsonObject[]
  benchmarks: readonly JsonObject[]
}>

export type ClaimReviewSlot = Readonly<{
  schemaVersion: typeof CLAIM_REVIEW_QUEUE_SCHEMA
  slotId: string
  sourceRecordId: string
  chapterId: string
  passageId: string
  artifactPassageSha256: string
  canonicalPassageSha256: string
  claimId: null
  claimTextIncluded: false
  reviewStatus: "pending_claim_review"
  ownerApproval: false
  runtimeEligible: false
  releaseEligible: false
  answerEligible: false
}>

export type FinalizationBundle = Readonly<{
  sourcePackageSha256: string
  artifactBytes: Uint8Array
  bookManifest: DnaOwnerBookManifest
  finalBookWrapper: JsonObject
  claimReviewQueue: readonly ClaimReviewSlot[]
  ownerDeclarationTemplate: JsonObject
}>

export class OwnerBookFinalizationError extends Error {}

function sortJson(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value
  if (Array.isArray(value)) return value.map(sortJson)
  const input = value as JsonObject
  return Object.fromEntries(
    Object.keys(input).sort().map((key) => [key, sortJson(input[key])]),
  )
}

export function stableJson(value: unknown, pretty = false): string {
  return `${JSON.stringify(sortJson(value), null, pretty ? 2 : undefined)}${pretty ? "\n" : ""}`
}

export function sha256Bytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex")
}

export function stableHash(value: unknown): string {
  return sha256Bytes(Buffer.from(stableJson(value), "utf8"))
}

function asObject(value: unknown, errorCode: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OwnerBookFinalizationError(errorCode)
  }
  return value as JsonObject
}

function asArray(value: unknown, errorCode: string): unknown[] {
  if (!Array.isArray(value)) throw new OwnerBookFinalizationError(errorCode)
  return value
}

function requiredString(value: unknown, errorCode: string): string {
  if (typeof value !== "string" || !value) {
    throw new OwnerBookFinalizationError(errorCode)
  }
  return value
}

function requiredSha(value: unknown, errorCode: string): string {
  const result = requiredString(value, errorCode).toLowerCase()
  if (!SHA256_PATTERN.test(result)) throw new OwnerBookFinalizationError(errorCode)
  return result
}

function requiredInteger(value: unknown, errorCode: string): number {
  if (!Number.isSafeInteger(value)) throw new OwnerBookFinalizationError(errorCode)
  return value as number
}

function isInside(parent: string, child: string): boolean {
  const delta = relative(parent, child)
  return Boolean(delta) && !delta.startsWith("..") && !isAbsolute(delta)
}

function resolveExistingDirectory(path: string, errorCode: string): string {
  if (!existsSync(path)) throw new OwnerBookFinalizationError(errorCode)
  if (lstatSync(path).isSymbolicLink()) {
    throw new OwnerBookFinalizationError(`${errorCode}_symlink_rejected`)
  }
  const resolved = realpathSync(path)
  if (!lstatSync(resolved).isDirectory()) {
    throw new OwnerBookFinalizationError(`${errorCode}_not_directory`)
  }
  return resolved
}

export function resolveSsdRoot(
  ssdRoot: string,
  options: { allowTestRoot?: boolean } = {},
): string {
  const resolved = resolveExistingDirectory(ssdRoot, "owner_book_finalization_ssd_unavailable")
  const volumes = "/Volumes"
  if (!options.allowTestRoot && !isInside(volumes, resolved)) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_ssd_must_be_mounted_volume",
    )
  }
  return resolved
}

function resolveChildDirectory(
  root: string,
  relativePath: string,
  errorCode: string,
): string {
  const candidate = join(root, relativePath)
  const resolved = resolveExistingDirectory(candidate, errorCode)
  if (!isInside(root, resolved)) {
    throw new OwnerBookFinalizationError(`${errorCode}_path_escape`)
  }
  return resolved
}

function ensureDirectoryUnderRoot(root: string, relativePath: string): string {
  let current = root
  for (const part of relativePath.split("/").filter(Boolean)) {
    current = join(current, part)
    if (existsSync(current)) {
      if (lstatSync(current).isSymbolicLink()) {
        throw new OwnerBookFinalizationError(
          "owner_book_finalization_output_symlink_rejected",
        )
      }
      if (!lstatSync(current).isDirectory()) {
        throw new OwnerBookFinalizationError(
          "owner_book_finalization_output_component_not_directory",
        )
      }
    } else {
      mkdirSync(current, { mode: 0o700 })
    }
    const resolved = realpathSync(current)
    if (!isInside(root, resolved)) {
      throw new OwnerBookFinalizationError(
        "owner_book_finalization_output_path_escape",
      )
    }
    current = resolved
  }
  return current
}

function readJson(path: string, errorCode: string): JsonObject {
  try {
    return asObject(JSON.parse(readFileSync(path, "utf8")), errorCode)
  } catch (error) {
    if (error instanceof OwnerBookFinalizationError) throw error
    throw new OwnerBookFinalizationError(errorCode)
  }
}

function readJsonLines(path: string, errorCode: string): JsonObject[] {
  try {
    return readFileSync(path, "utf8").split("\n").filter(Boolean).map((line) =>
      asObject(JSON.parse(line), errorCode))
  } catch (error) {
    if (error instanceof OwnerBookFinalizationError) throw error
    throw new OwnerBookFinalizationError(errorCode)
  }
}

function exactFileSet(directory: string, expected: Set<string>, errorCode: string): void {
  const entries = readdirSync(directory, { withFileTypes: true })
  if (entries.some((entry) => entry.isSymbolicLink() || !entry.isFile())) {
    throw new OwnerBookFinalizationError(`${errorCode}_non_regular_file`)
  }
  const actual = new Set(entries.map((entry) => entry.name))
  if (
    actual.size !== expected.size
    || [...expected].some((name) => !actual.has(name))
  ) {
    throw new OwnerBookFinalizationError(`${errorCode}_file_set_mismatch`)
  }
}

function parseChecksums(path: string, expected: Set<string>, errorCode: string): Map<string, string> {
  const result = new Map<string, string>()
  for (const line of readFileSync(path, "utf8").split("\n").filter(Boolean)) {
    const match = /^([a-f0-9]{64})  ([A-Za-z0-9._-]+)$/.exec(line)
    if (!match || !expected.has(match[2]) || result.has(match[2])) {
      throw new OwnerBookFinalizationError(errorCode)
    }
    result.set(match[2], match[1])
  }
  if (result.size !== expected.size) throw new OwnerBookFinalizationError(errorCode)
  return result
}

function assertAuthorityFalse(value: unknown, location = "root"): void {
  if (!value || typeof value !== "object") return
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertAuthorityFalse(child, `${location}[${index}]`))
    return
  }
  for (const [key, child] of Object.entries(value as JsonObject)) {
    if (FALSE_AUTHORITY_FIELDS.has(key) && child !== false) {
      throw new OwnerBookFinalizationError(
        `owner_book_finalization_authority_expanded:${location}.${key}`,
      )
    }
    assertAuthorityFalse(child, `${location}.${key}`)
  }
}

function assertNoCompactRawContent(value: unknown, location = "root"): void {
  if (!value || typeof value !== "object") return
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertNoCompactRawContent(child, `${location}[${index}]`))
    return
  }
  for (const [key, child] of Object.entries(value as JsonObject)) {
    if (FORBIDDEN_COMPACT_KEYS.has(key)) {
      throw new OwnerBookFinalizationError(
        `owner_book_finalization_raw_content_in_compact_manifest:${location}.${key}`,
      )
    }
    assertNoCompactRawContent(child, `${location}.${key}`)
  }
}

function byteRange(value: unknown, byteLength: number, errorCode: string): {
  startByte: number
  endByteExclusive: number
} {
  const range = asObject(value, errorCode)
  const startByte = requiredInteger(range.startByte, errorCode)
  const endByteExclusive = requiredInteger(range.endByteExclusive, errorCode)
  if (startByte < 0 || endByteExclusive <= startByte || endByteExclusive > byteLength) {
    throw new OwnerBookFinalizationError(errorCode)
  }
  return { startByte, endByteExclusive }
}

function verifyDraftPackageFiles(packageDirectory: string, manifest: JsonObject): void {
  exactFileSet(packageDirectory, DRAFT_PACKAGE_FILES, "owner_book_finalization_draft")
  const files = asObject(
    manifest.files,
    "owner_book_finalization_draft_file_manifest_invalid",
  )
  if (
    Object.keys(files).length !== DRAFT_PAYLOAD_FILES.size
    || [...DRAFT_PAYLOAD_FILES].some((name) => !(name in files))
  ) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_draft_file_manifest_invalid",
    )
  }
  for (const name of [...DRAFT_PAYLOAD_FILES].sort()) {
    const metadata = asObject(
      files[name],
      "owner_book_finalization_draft_file_metadata_invalid",
    )
    const bytes = readFileSync(join(packageDirectory, name))
    if (
      requiredSha(
        metadata.sha256,
        "owner_book_finalization_draft_file_hash_invalid",
      ) !== sha256Bytes(bytes)
      || requiredInteger(
        metadata.byteLength,
        "owner_book_finalization_draft_file_length_invalid",
      ) !== bytes.byteLength
    ) {
      throw new OwnerBookFinalizationError(
        "owner_book_finalization_draft_file_hash_mismatch",
      )
    }
  }
  const checksums = parseChecksums(
    join(packageDirectory, "checksums.sha256"),
    new Set([...DRAFT_PAYLOAD_FILES, "manifest.json"]),
    "owner_book_finalization_draft_checksums_invalid",
  )
  for (const [name, expected] of checksums) {
    if (sha256Bytes(readFileSync(join(packageDirectory, name))) !== expected) {
      throw new OwnerBookFinalizationError(
        "owner_book_finalization_draft_checksum_mismatch",
      )
    }
  }
}

export function loadVerifiedDraftPackage(
  ssdRoot: string,
  options: { allowTestRoot?: boolean } = {},
): VerifiedDraftPackage {
  const resolvedSsd = resolveSsdRoot(ssdRoot, options)
  const outputRoot = resolveChildDirectory(
    resolvedSsd,
    DRAFT_OUTPUT_SUBPATH,
    "owner_book_finalization_draft_output_missing",
  )
  const currentPath = join(outputRoot, "current.json")
  if (!existsSync(currentPath) || lstatSync(currentPath).isSymbolicLink()) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_draft_current_missing_or_symlinked",
    )
  }
  const current = readJson(
    currentPath,
    "owner_book_finalization_draft_current_invalid",
  )
  const packageSha256 = requiredSha(
    current.packageSha256,
    "owner_book_finalization_draft_current_identity_invalid",
  )
  if (
    current.schemaVersion !== "dna-owner-book-draft-current@1"
    || current.packageDirectoryName !== packageSha256
    || current.status !== "draft_owner_book_ingested_not_approved"
    || current.ownerApproval !== false
    || current.runtimeEligible !== false
    || current.releaseEligible !== false
  ) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_draft_current_invalid",
    )
  }
  const packageDirectory = resolveChildDirectory(
    outputRoot,
    packageSha256,
    "owner_book_finalization_draft_package_missing",
  )
  if (dirname(packageDirectory) !== outputRoot) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_draft_package_path_escape",
    )
  }
  const manifest = readJson(
    join(packageDirectory, "manifest.json"),
    "owner_book_finalization_draft_manifest_invalid",
  )
  if (
    manifest.schemaVersion !== "dna-owner-book-draft-package@1"
    || manifest.pipelineVersion !== "dna-owner-book-draft-ingestion@1"
    || manifest.packageSha256 !== packageSha256
    || manifest.status !== "draft_owner_book_ingested_not_approved"
  ) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_draft_manifest_invalid",
    )
  }
  verifyDraftPackageFiles(packageDirectory, manifest)

  const artifactBytes = new Uint8Array(readFileSync(join(packageDirectory, "canonical-book.txt")))
  const records = readJsonLines(
    join(packageDirectory, "records.jsonl"),
    "owner_book_finalization_draft_records_invalid",
  )
  const sources = readJsonLines(
    join(packageDirectory, "sources.jsonl"),
    "owner_book_finalization_draft_sources_invalid",
  )
  const benchmarks = readJsonLines(
    join(packageDirectory, "benchmark-candidates.jsonl"),
    "owner_book_finalization_draft_benchmarks_invalid",
  )
  assertAuthorityFalse(manifest, "draft.manifest")
  assertAuthorityFalse(records, "draft.records")
  assertAuthorityFalse(sources, "draft.sources")
  assertAuthorityFalse(benchmarks, "draft.benchmarks")

  if (
    requiredSha(
      manifest.canonicalArtifactSha256,
      "owner_book_finalization_draft_artifact_hash_invalid",
    ) !== sha256Bytes(artifactBytes)
    || requiredInteger(
      manifest.canonicalArtifactByteLength,
      "owner_book_finalization_draft_artifact_length_invalid",
    ) !== artifactBytes.byteLength
    || requiredInteger(manifest.recordCount, "owner_book_finalization_draft_count_invalid")
      !== records.length
    || requiredInteger(manifest.sourceCount, "owner_book_finalization_draft_count_invalid")
      !== sources.length
    || requiredInteger(
      manifest.benchmarkCandidateCount,
      "owner_book_finalization_draft_count_invalid",
    ) !== benchmarks.length
  ) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_draft_content_mismatch",
    )
  }

  const recordIds = records.map((record) => requiredString(
    record.recordId,
    "owner_book_finalization_draft_record_id_invalid",
  ))
  if (new Set(recordIds).size !== recordIds.length) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_draft_duplicate_record_id",
    )
  }
  const knownSourceIds = new Set(sources.map((source) => requiredString(
    source.sourceId,
    "owner_book_finalization_draft_source_id_invalid",
  )))
  if (knownSourceIds.size !== sources.length) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_draft_duplicate_source_id",
    )
  }
  for (const record of records) {
    const locator = asObject(
      record.locator,
      "owner_book_finalization_draft_record_locator_invalid",
    )
    const range = byteRange(
      locator.artifactByteRange,
      artifactBytes.byteLength,
      "owner_book_finalization_draft_record_range_invalid",
    )
    if (
      sha256Bytes(artifactBytes.subarray(range.startByte, range.endByteExclusive))
        !== requiredSha(
          record.canonicalTextSha256,
          "owner_book_finalization_draft_record_hash_invalid",
        )
      || asArray(
        record.sourceIds,
        "owner_book_finalization_draft_record_sources_invalid",
      ).some((sourceId) => !knownSourceIds.has(String(sourceId)))
    ) {
      throw new OwnerBookFinalizationError(
        "owner_book_finalization_draft_record_provenance_invalid",
      )
    }
  }

  const chapters = asArray(
    manifest.chapters,
    "owner_book_finalization_draft_chapters_invalid",
  ).map((chapter) => asObject(
    chapter,
    "owner_book_finalization_draft_chapter_invalid",
  ))
  if (chapters.length !== 9) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_draft_chapter_count_invalid",
    )
  }
  const chapterIds = chapters.map((chapter) => requiredString(
    chapter.chapterId,
    "owner_book_finalization_draft_chapter_id_invalid",
  ))
  if (new Set(chapterIds).size !== chapterIds.length) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_draft_duplicate_chapter_id",
    )
  }

  const semanticCore = {
    schemaVersion: manifest.schemaVersion,
    pipelineVersion: manifest.pipelineVersion,
    status: manifest.status,
    sourceSetSha256: manifest.sourceSetSha256,
    canonicalArtifactSha256: manifest.canonicalArtifactSha256,
    canonicalArtifactByteLength: manifest.canonicalArtifactByteLength,
    chapters,
    records,
    sources,
    benchmarkCandidates: benchmarks,
    governanceCrosswalk: manifest.governanceCrosswalk,
    methodCandidateCrosswalk: manifest.methodCandidateCrosswalk,
    authorityBoundary: manifest.authorityBoundary,
  }
  if (stableHash(semanticCore) !== packageSha256) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_draft_semantic_hash_mismatch",
    )
  }

  return Object.freeze({
    outputRoot,
    packageDirectory,
    manifest,
    artifactBytes,
    records: Object.freeze(records),
    sources: Object.freeze(sources),
    benchmarks: Object.freeze(benchmarks),
  })
}

function candidatePassageId(recordId: string): string {
  const value = `dna.owner.passage.${recordId}`
  if (!SAFE_ID_PATTERN.test(value)) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_passage_id_invalid",
    )
  }
  return value
}

function claimReviewSlotId(recordId: string): string {
  return `dna.claim.review.${sha256Bytes(Buffer.from(recordId, "utf8")).slice(0, 24)}`
}

export function buildFinalizationBundle(
  draftPackage: VerifiedDraftPackage,
): FinalizationBundle {
  const sourcePackageSha256 = requiredSha(
    draftPackage.manifest.packageSha256,
    "owner_book_finalization_source_package_invalid",
  )
  const artifactBytes = new Uint8Array(draftPackage.artifactBytes)
  const chapterRows = asArray(
    draftPackage.manifest.chapters,
    "owner_book_finalization_chapters_invalid",
  ).map((chapter) => asObject(chapter, "owner_book_finalization_chapter_invalid"))
  const productRecords = draftPackage.records
    .filter((record) => record.kind === "dna_product_candidate")
    .sort((left, right) => {
      const leftLocator = asObject(left.locator, "owner_book_finalization_locator_invalid")
      const rightLocator = asObject(right.locator, "owner_book_finalization_locator_invalid")
      const leftRange = asObject(
        leftLocator.artifactByteRange,
        "owner_book_finalization_locator_invalid",
      )
      const rightRange = asObject(
        rightLocator.artifactByteRange,
        "owner_book_finalization_locator_invalid",
      )
      return Number(leftRange.startByte) - Number(rightRange.startByte)
        || String(left.recordId).localeCompare(String(right.recordId))
    })
  if (productRecords.length === 0) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_no_product_passage_candidate",
    )
  }

  const passageIdByRecordId = new Map<string, string>()
  const canonicalTextByPassageId = new Map<string, string>()
  const chapters: DnaOwnerBookDraftChapter[] = chapterRows.map((chapter) => {
    const chapterId = requiredString(
      chapter.chapterId,
      "owner_book_finalization_chapter_id_invalid",
    )
    const range = byteRange(
      chapter.canonicalArtifactRange,
      artifactBytes.byteLength,
      "owner_book_finalization_chapter_range_invalid",
    )
    const chapterRecords = productRecords.filter((record) => record.chapterId === chapterId)
    if (chapterRecords.length === 0) {
      throw new OwnerBookFinalizationError(
        "owner_book_finalization_missing_product_passage_in_chapter",
      )
    }
    const passages = chapterRecords.map((record) => {
      const recordId = requiredString(
        record.recordId,
        "owner_book_finalization_record_id_invalid",
      )
      const locator = asObject(
        record.locator,
        "owner_book_finalization_locator_invalid",
      )
      const passageRange = byteRange(
        locator.artifactByteRange,
        artifactBytes.byteLength,
        "owner_book_finalization_passage_range_invalid",
      )
      const canonicalText = requiredString(
        record.text,
        "owner_book_finalization_canonical_passage_missing",
      ).trim()
      if (!canonicalText) {
        throw new OwnerBookFinalizationError(
          "owner_book_finalization_canonical_passage_missing",
        )
      }
      const passageId = candidatePassageId(recordId)
      if (passageIdByRecordId.has(recordId) || canonicalTextByPassageId.has(passageId)) {
        throw new OwnerBookFinalizationError(
          "owner_book_finalization_duplicate_passage",
        )
      }
      passageIdByRecordId.set(recordId, passageId)
      canonicalTextByPassageId.set(passageId, canonicalText)
      return {
        passageId,
        range: passageRange,
        canonicalText,
      }
    })
    return { chapterId, range, passages }
  })

  if (passageIdByRecordId.size !== productRecords.length) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_incomplete_passage_mapping",
    )
  }
  const bookManifest = buildDnaOwnerBookManifest({
    bookId: "dna.owner.book",
    bookVersion: `dna-owner-book-candidate@${sourcePackageSha256.slice(0, 16)}`,
    artifactBytes,
    chapters,
  })
  if (!verifyDnaOwnerBookArtifact(bookManifest, artifactBytes)) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_primitive_artifact_verification_failed",
    )
  }
  if (
    bookManifest.artifactSha256 !== draftPackage.manifest.canonicalArtifactSha256
    || bookManifest.byteLength !== draftPackage.manifest.canonicalArtifactByteLength
  ) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_artifact_identity_mismatch",
    )
  }
  for (const chapter of bookManifest.chapters) {
    const draftChapter = chapterRows.find((row) => row.chapterId === chapter.chapterId)
    if (
      !draftChapter
      || chapter.chapterSha256 !== draftChapter.canonicalChapterSha256
    ) {
      throw new OwnerBookFinalizationError(
        "owner_book_finalization_chapter_hash_mismatch",
      )
    }
  }

  const manifestPassages = new Map(
    bookManifest.chapters.flatMap((chapter) => chapter.passages.map((passage) => [
      passage.passageId,
      { chapterId: chapter.chapterId, passage },
    ] as const)),
  )
  const claimReviewQueue: ClaimReviewSlot[] = productRecords.map((record) => {
    const recordId = requiredString(
      record.recordId,
      "owner_book_finalization_record_id_invalid",
    )
    const passageId = requiredString(
      passageIdByRecordId.get(recordId),
      "owner_book_finalization_passage_mapping_missing",
    )
    const resolved = manifestPassages.get(passageId)
    if (!resolved) {
      throw new OwnerBookFinalizationError(
        "owner_book_finalization_manifest_passage_missing",
      )
    }
    return Object.freeze({
      schemaVersion: CLAIM_REVIEW_QUEUE_SCHEMA,
      slotId: claimReviewSlotId(recordId),
      sourceRecordId: recordId,
      chapterId: resolved.chapterId,
      passageId,
      artifactPassageSha256: resolved.passage.artifactPassageSha256,
      canonicalPassageSha256: resolved.passage.canonicalPassageSha256,
      claimId: null,
      claimTextIncluded: false,
      reviewStatus: "pending_claim_review" as const,
      ownerApproval: false as const,
      runtimeEligible: false as const,
      releaseEligible: false as const,
      answerEligible: false as const,
    })
  })
  const slotIds = claimReviewQueue.map((slot) => slot.slotId)
  if (new Set(slotIds).size !== slotIds.length) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_duplicate_claim_review_slot",
    )
  }

  const finalBookWrapper: JsonObject = {
    schemaVersion: FINAL_BOOK_WRAPPER_SCHEMA,
    status: "candidate_only_pending_owner_action",
    sourcePackageSha256,
    bookManifest,
    productPassageCount: claimReviewQueue.length,
    ownerApproval: false,
    runtimeEligible: false,
    releaseEligible: false,
    answerEligible: false,
  }
  const ownerDeclarationTemplate: JsonObject = {
    schemaVersion: OWNER_DECLARATION_TEMPLATE_SCHEMA,
    declarationVersion: "dna-owner-declaration@1",
    approvalStatus: "pending_owner_action",
    approvalRecordId: null,
    bookId: bookManifest.bookId,
    bookVersion: bookManifest.bookVersion,
    artifactSha256: bookManifest.artifactSha256,
    byteLength: bookManifest.byteLength,
    proposedChapterRanges: bookManifest.chapters.map((chapter) => ({
      chapterId: chapter.chapterId,
      range: chapter.range,
      chapterSha256: chapter.chapterSha256,
      acceptedByOwner: false,
    })),
    proposedPassageRanges: bookManifest.chapters.flatMap((chapter) =>
      chapter.passages.map((passage) => ({
        chapterId: chapter.chapterId,
        passageId: passage.passageId,
        range: passage.range,
        artifactPassageSha256: passage.artifactPassageSha256,
        canonicalPassageSha256: passage.canonicalPassageSha256,
        acceptedByOwner: false,
      }))),
    ownerActionRequired: true,
    automaticApprovalForbidden: true,
    claimTextIncluded: false,
    ownerApproval: false,
    runtimeEligible: false,
    releaseEligible: false,
    answerEligible: false,
  }
  assertAuthorityFalse(finalBookWrapper, "bundle.finalBookWrapper")
  assertAuthorityFalse(claimReviewQueue, "bundle.claimReviewQueue")
  assertAuthorityFalse(ownerDeclarationTemplate, "bundle.ownerDeclarationTemplate")
  if (ownerDeclarationTemplate.approvalStatus === "owner_approved") {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_automatic_owner_approval_forbidden",
    )
  }

  return Object.freeze({
    sourcePackageSha256,
    artifactBytes,
    bookManifest,
    finalBookWrapper: Object.freeze(finalBookWrapper),
    claimReviewQueue: Object.freeze(claimReviewQueue),
    ownerDeclarationTemplate: Object.freeze(ownerDeclarationTemplate),
  })
}

function jsonBytes(value: unknown): Uint8Array {
  return Buffer.from(stableJson(value, true), "utf8")
}

function jsonLinesBytes(rows: readonly unknown[]): Uint8Array {
  return Buffer.from(`${rows.map((row) => stableJson(row)).join("\n")}\n`, "utf8")
}

export function buildFinalizationPackage(bundle: FinalizationBundle): {
  workbenchSha256: string
  files: Readonly<Record<string, Uint8Array>>
  workbenchManifest: JsonObject
  compactRepoManifest: JsonObject
} {
  const payloadFiles: Record<string, Uint8Array> = {
    "claim-review-queue.jsonl": jsonLinesBytes(bundle.claimReviewQueue),
    "final-book-candidate.txt": new Uint8Array(bundle.artifactBytes),
    "final-book-manifest.json": jsonBytes(bundle.finalBookWrapper),
    "owner-declaration-template.json": jsonBytes(bundle.ownerDeclarationTemplate),
  }
  const fileManifest = Object.fromEntries(
    Object.entries(payloadFiles).sort(([left], [right]) => left.localeCompare(right)).map(
      ([name, bytes]) => [name, {
        sha256: sha256Bytes(bytes),
        byteLength: bytes.byteLength,
      }],
    ),
  )
  const core: JsonObject = {
    schemaVersion: FINALIZATION_PACKAGE_SCHEMA,
    workbenchVersion: FINALIZATION_WORKBENCH_VERSION,
    status: "candidate_only_pending_owner_action",
    sourcePackageSha256: bundle.sourcePackageSha256,
    finalArtifactSha256: bundle.bookManifest.artifactSha256,
    finalArtifactByteLength: bundle.bookManifest.byteLength,
    bookId: bundle.bookManifest.bookId,
    bookVersion: bundle.bookManifest.bookVersion,
    chapterCount: bundle.bookManifest.chapters.length,
    passageCount: bundle.bookManifest.chapters.reduce(
      (total, chapter) => total + chapter.passages.length,
      0,
    ),
    claimReviewSlotCount: bundle.claimReviewQueue.length,
    pendingClaimReviewSlotCount: bundle.claimReviewQueue.filter(
      (slot) => slot.reviewStatus === "pending_claim_review",
    ).length,
    ownerDeclarationStatus: "pending_owner_action",
    claimTextIncluded: false,
    files: fileManifest,
    ownerApproval: false,
    runtimeEligible: false,
    releaseEligible: false,
    answerEligible: false,
    activationAllowed: false,
  }
  const workbenchSha256 = stableHash(core)
  const workbenchManifest = { ...core, workbenchSha256 }
  const files: Record<string, Uint8Array> = {
    ...payloadFiles,
    "workbench-manifest.json": jsonBytes(workbenchManifest),
  }
  files["checksums.sha256"] = Buffer.from(
    `${Object.entries(files).sort(([left], [right]) => left.localeCompare(right)).map(
      ([name, bytes]) => `${sha256Bytes(bytes)}  ${name}`,
    ).join("\n")}\n`,
    "utf8",
  )
  const compactRepoManifest: JsonObject = {
    schemaVersion: FINALIZATION_REPO_MANIFEST_SCHEMA,
    workbenchVersion: FINALIZATION_WORKBENCH_VERSION,
    status: "candidate_only_pending_owner_action",
    workbenchSha256,
    sourcePackageSha256: bundle.sourcePackageSha256,
    finalArtifactSha256: bundle.bookManifest.artifactSha256,
    finalArtifactByteLength: bundle.bookManifest.byteLength,
    bookId: bundle.bookManifest.bookId,
    bookVersion: bundle.bookManifest.bookVersion,
    chapterCount: core.chapterCount,
    passageCount: core.passageCount,
    claimReviewSlotCount: core.claimReviewSlotCount,
    pendingClaimReviewSlotCount: core.pendingClaimReviewSlotCount,
    ownerDeclarationStatus: "pending_owner_action",
    outputRelativePath: `${FINALIZATION_OUTPUT_SUBPATH}/${workbenchSha256}`,
    fullArtifactStoredOnlyOnResearchSsd: true,
    rawTextStoredInRepository: false,
    claimTextIncluded: false,
    ownerApproval: false,
    runtimeEligible: false,
    releaseEligible: false,
    answerEligible: false,
    activationAllowed: false,
    activationBlockers: [
      "owner_action_missing",
      "claim_review_missing",
      "owner_approval_registry_empty",
      "official_benchmark_not_sealed",
      "runtime_integration_forbidden",
    ],
  }
  assertAuthorityFalse(workbenchManifest, "package.workbenchManifest")
  assertAuthorityFalse(compactRepoManifest, "package.compactRepoManifest")
  assertNoCompactRawContent(compactRepoManifest)
  return {
    workbenchSha256,
    files: Object.freeze(files),
    workbenchManifest,
    compactRepoManifest,
  }
}

function atomicWrite(path: string, bytes: Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const temporaryDirectory = mkdtempSync(join(dirname(path), `.${path.split("/").at(-1)}.tmp-`))
  const temporaryPath = join(temporaryDirectory, "value")
  try {
    writeFileSync(temporaryPath, bytes, { flag: "wx", mode: 0o600 })
    chmodSync(temporaryPath, 0o600)
    renameSync(temporaryPath, path)
  } finally {
    rmSync(temporaryDirectory, { force: true, recursive: true })
  }
}

function writeImmutablePackage(
  outputRoot: string,
  packageData: ReturnType<typeof buildFinalizationPackage>,
): { packageDirectory: string; reused: boolean } {
  const target = join(outputRoot, packageData.workbenchSha256)
  if (existsSync(target)) {
    verifyFinalizationPackageDirectory(target, {
      outputRoot,
      expectedWorkbenchSha256: packageData.workbenchSha256,
    })
    for (const [name, expected] of Object.entries(packageData.files)) {
      if (!Buffer.from(readFileSync(join(target, name))).equals(Buffer.from(expected))) {
        throw new OwnerBookFinalizationError(
          "owner_book_finalization_existing_package_content_mismatch",
        )
      }
    }
    return { packageDirectory: target, reused: true }
  }
  const temporary = mkdtempSync(
    join(outputRoot, `.${packageData.workbenchSha256}.tmp-`),
  )
  try {
    for (const [name, bytes] of Object.entries(packageData.files)) {
      writeFileSync(join(temporary, name), bytes, { flag: "wx", mode: 0o600 })
    }
    verifyFinalizationPackageDirectory(temporary, {
      outputRoot,
      expectedWorkbenchSha256: packageData.workbenchSha256,
      requireIdentityDirectoryName: false,
    })
    renameSync(temporary, target)
  } catch (error) {
    rmSync(temporary, { force: true, recursive: true })
    throw error
  }
  return { packageDirectory: target, reused: false }
}

export function verifyFinalizationPackageDirectory(
  directory: string,
  options: {
    outputRoot: string
    expectedWorkbenchSha256?: string
    requireIdentityDirectoryName?: boolean
  },
): JsonObject {
  if (!existsSync(directory) || lstatSync(directory).isSymbolicLink()) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_package_missing_or_symlinked",
    )
  }
  const resolvedDirectory = realpathSync(directory)
  const resolvedOutput = realpathSync(options.outputRoot)
  if (dirname(resolvedDirectory) !== resolvedOutput) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_package_path_escape",
    )
  }
  exactFileSet(
    resolvedDirectory,
    FINALIZATION_PACKAGE_FILES,
    "owner_book_finalization_package",
  )
  const workbenchManifest = readJson(
    join(resolvedDirectory, "workbench-manifest.json"),
    "owner_book_finalization_manifest_invalid",
  )
  const workbenchSha256 = requiredSha(
    workbenchManifest.workbenchSha256,
    "owner_book_finalization_identity_invalid",
  )
  if (
    workbenchManifest.schemaVersion !== FINALIZATION_PACKAGE_SCHEMA
    || workbenchManifest.workbenchVersion !== FINALIZATION_WORKBENCH_VERSION
    || workbenchManifest.status !== "candidate_only_pending_owner_action"
    || (options.expectedWorkbenchSha256
      && workbenchSha256 !== options.expectedWorkbenchSha256)
    || (options.requireIdentityDirectoryName !== false
      && resolvedDirectory.split("/").at(-1) !== workbenchSha256)
  ) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_manifest_identity_mismatch",
    )
  }
  assertAuthorityFalse(workbenchManifest, "verify.workbenchManifest")
  const fileManifest = asObject(
    workbenchManifest.files,
    "owner_book_finalization_file_manifest_invalid",
  )
  if (
    Object.keys(fileManifest).length !== FINALIZATION_PAYLOAD_FILES.size
    || [...FINALIZATION_PAYLOAD_FILES].some((name) => !(name in fileManifest))
  ) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_file_manifest_invalid",
    )
  }
  for (const name of FINALIZATION_PAYLOAD_FILES) {
    const metadata = asObject(
      fileManifest[name],
      "owner_book_finalization_file_metadata_invalid",
    )
    const bytes = readFileSync(join(resolvedDirectory, name))
    if (
      requiredSha(metadata.sha256, "owner_book_finalization_file_hash_invalid")
        !== sha256Bytes(bytes)
      || requiredInteger(
        metadata.byteLength,
        "owner_book_finalization_file_length_invalid",
      ) !== bytes.byteLength
    ) {
      throw new OwnerBookFinalizationError(
        "owner_book_finalization_file_hash_mismatch",
      )
    }
  }
  const checksums = parseChecksums(
    join(resolvedDirectory, "checksums.sha256"),
    FINALIZATION_CHECKSUM_FILES,
    "owner_book_finalization_checksums_invalid",
  )
  for (const [name, expected] of checksums) {
    if (sha256Bytes(readFileSync(join(resolvedDirectory, name))) !== expected) {
      throw new OwnerBookFinalizationError(
        "owner_book_finalization_checksum_mismatch",
      )
    }
  }
  const core = { ...workbenchManifest }
  delete core.workbenchSha256
  if (stableHash(core) !== workbenchSha256) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_semantic_hash_mismatch",
    )
  }

  const wrapper = readJson(
    join(resolvedDirectory, "final-book-manifest.json"),
    "owner_book_finalization_book_manifest_invalid",
  )
  const declaration = readJson(
    join(resolvedDirectory, "owner-declaration-template.json"),
    "owner_book_finalization_declaration_invalid",
  )
  const queue = readJsonLines(
    join(resolvedDirectory, "claim-review-queue.jsonl"),
    "owner_book_finalization_claim_queue_invalid",
  )
  assertAuthorityFalse(wrapper, "verify.wrapper")
  assertAuthorityFalse(declaration, "verify.declaration")
  assertAuthorityFalse(queue, "verify.queue")
  if (
    wrapper.schemaVersion !== FINAL_BOOK_WRAPPER_SCHEMA
    || wrapper.status !== "candidate_only_pending_owner_action"
    || declaration.schemaVersion !== OWNER_DECLARATION_TEMPLATE_SCHEMA
    || declaration.approvalStatus !== "pending_owner_action"
    || declaration.approvalRecordId !== null
    || declaration.ownerActionRequired !== true
    || declaration.automaticApprovalForbidden !== true
  ) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_candidate_boundary_invalid",
    )
  }
  const bookManifest = asObject(
    wrapper.bookManifest,
    "owner_book_finalization_book_manifest_invalid",
  ) as unknown as DnaOwnerBookManifest
  const artifactBytes = new Uint8Array(
    readFileSync(join(resolvedDirectory, "final-book-candidate.txt")),
  )
  if (!verifyDnaOwnerBookArtifact(bookManifest, artifactBytes)) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_book_artifact_mismatch",
    )
  }
  const passages = new Map(
    bookManifest.chapters.flatMap((chapter) => chapter.passages.map((passage) => [
      passage.passageId,
      { chapterId: chapter.chapterId, passage },
    ] as const)),
  )
  if (
    passages.size === 0
    || passages.size !== queue.length
    || workbenchManifest.passageCount !== passages.size
    || workbenchManifest.claimReviewSlotCount !== queue.length
    || workbenchManifest.pendingClaimReviewSlotCount !== queue.length
  ) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_passage_queue_count_mismatch",
    )
  }
  const slotIds = new Set<string>()
  const sourceRecordIds = new Set<string>()
  for (const row of queue) {
    if (
      row.schemaVersion !== CLAIM_REVIEW_QUEUE_SCHEMA
      || row.reviewStatus !== "pending_claim_review"
      || row.claimId !== null
      || row.claimTextIncluded !== false
    ) {
      throw new OwnerBookFinalizationError(
        "owner_book_finalization_claim_queue_boundary_invalid",
      )
    }
    const slotId = requiredString(row.slotId, "owner_book_finalization_slot_id_invalid")
    const sourceRecordId = requiredString(
      row.sourceRecordId,
      "owner_book_finalization_source_record_id_invalid",
    )
    const passageId = requiredString(
      row.passageId,
      "owner_book_finalization_queue_passage_id_invalid",
    )
    const passage = passages.get(passageId)
    if (
      slotIds.has(slotId)
      || sourceRecordIds.has(sourceRecordId)
      || !passage
      || row.chapterId !== passage.chapterId
      || row.artifactPassageSha256 !== passage.passage.artifactPassageSha256
      || row.canonicalPassageSha256 !== passage.passage.canonicalPassageSha256
    ) {
      throw new OwnerBookFinalizationError(
        "owner_book_finalization_claim_queue_provenance_invalid",
      )
    }
    slotIds.add(slotId)
    sourceRecordIds.add(sourceRecordId)
  }
  const proposedChapters = asArray(
    declaration.proposedChapterRanges,
    "owner_book_finalization_declaration_chapters_invalid",
  )
  const proposedPassages = asArray(
    declaration.proposedPassageRanges,
    "owner_book_finalization_declaration_passages_invalid",
  )
  if (
    proposedChapters.length !== bookManifest.chapters.length
    || proposedPassages.length !== passages.size
    || proposedChapters.some((row) => asObject(
      row,
      "owner_book_finalization_declaration_chapter_invalid",
    ).acceptedByOwner !== false)
    || proposedPassages.some((row) => asObject(
      row,
      "owner_book_finalization_declaration_passage_invalid",
    ).acceptedByOwner !== false)
  ) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_declaration_scope_invalid",
    )
  }
  return workbenchManifest
}

function currentPointer(workbenchSha256: string, sourcePackageSha256: string): JsonObject {
  return {
    schemaVersion: FINALIZATION_CURRENT_SCHEMA,
    status: "candidate_only_pending_owner_action",
    workbenchSha256,
    packageDirectoryName: workbenchSha256,
    sourcePackageSha256,
    ownerApproval: false,
    runtimeEligible: false,
    releaseEligible: false,
    answerEligible: false,
  }
}

export function prepareFinalizationWorkbench(input: {
  ssdRoot: string
  repoManifestPath?: string
  allowTestRoot?: boolean
}): JsonObject {
  const resolvedSsd = resolveSsdRoot(input.ssdRoot, {
    allowTestRoot: input.allowTestRoot,
  })
  const draftPackage = loadVerifiedDraftPackage(resolvedSsd, {
    allowTestRoot: input.allowTestRoot,
  })
  const bundle = buildFinalizationBundle(draftPackage)
  const packageData = buildFinalizationPackage(bundle)
  const outputRoot = ensureDirectoryUnderRoot(
    resolvedSsd,
    FINALIZATION_OUTPUT_SUBPATH,
  )
  const written = writeImmutablePackage(outputRoot, packageData)
  atomicWrite(
    join(outputRoot, "current.json"),
    jsonBytes(currentPointer(packageData.workbenchSha256, bundle.sourcePackageSha256)),
  )
  const repoManifestPath = input.repoManifestPath ?? DEFAULT_REPO_MANIFEST
  atomicWrite(repoManifestPath, jsonBytes(packageData.compactRepoManifest))
  return {
    operationStatus: written.reused ? "reused" : "prepared",
    ...packageData.compactRepoManifest,
  }
}

function loadFinalizationCurrent(outputRoot: string): {
  current: JsonObject
  packageDirectory: string
} {
  const currentPath = join(outputRoot, "current.json")
  if (!existsSync(currentPath) || lstatSync(currentPath).isSymbolicLink()) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_current_missing_or_symlinked",
    )
  }
  const current = readJson(currentPath, "owner_book_finalization_current_invalid")
  const workbenchSha256 = requiredSha(
    current.workbenchSha256,
    "owner_book_finalization_current_identity_invalid",
  )
  if (
    current.schemaVersion !== FINALIZATION_CURRENT_SCHEMA
    || current.status !== "candidate_only_pending_owner_action"
    || current.packageDirectoryName !== workbenchSha256
    || current.ownerApproval !== false
    || current.runtimeEligible !== false
    || current.releaseEligible !== false
    || current.answerEligible !== false
  ) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_current_invalid",
    )
  }
  const packageDirectory = resolveChildDirectory(
    outputRoot,
    workbenchSha256,
    "owner_book_finalization_current_package_missing",
  )
  if (dirname(packageDirectory) !== outputRoot) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_current_path_escape",
    )
  }
  return { current, packageDirectory }
}

export function verifyFinalizationWorkbench(input: {
  ssdRoot: string
  repoManifestPath?: string
  allowTestRoot?: boolean
}): JsonObject {
  const resolvedSsd = resolveSsdRoot(input.ssdRoot, {
    allowTestRoot: input.allowTestRoot,
  })
  const draftPackage = loadVerifiedDraftPackage(resolvedSsd, {
    allowTestRoot: input.allowTestRoot,
  })
  const outputRoot = resolveChildDirectory(
    resolvedSsd,
    FINALIZATION_OUTPUT_SUBPATH,
    "owner_book_finalization_output_missing",
  )
  const { current, packageDirectory } = loadFinalizationCurrent(outputRoot)
  const manifest = verifyFinalizationPackageDirectory(packageDirectory, {
    outputRoot,
    expectedWorkbenchSha256: String(current.workbenchSha256),
  })
  if (
    manifest.sourcePackageSha256 !== draftPackage.manifest.packageSha256
    || current.sourcePackageSha256 !== draftPackage.manifest.packageSha256
  ) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_source_package_is_stale",
    )
  }
  const repoManifestPath = input.repoManifestPath ?? DEFAULT_REPO_MANIFEST
  const compact = readJson(
    repoManifestPath,
    "owner_book_finalization_repo_manifest_missing_or_invalid",
  )
  assertAuthorityFalse(compact, "verify.repoManifest")
  assertNoCompactRawContent(compact)
  const expectedCompact = buildFinalizationPackage(
    buildFinalizationBundle(draftPackage),
  ).compactRepoManifest
  if (stableJson(compact) !== stableJson(expectedCompact)) {
    throw new OwnerBookFinalizationError(
      "owner_book_finalization_repo_manifest_mismatch",
    )
  }
  return {
    status: "verified_candidate_only",
    workbenchSha256: manifest.workbenchSha256,
    sourcePackageSha256: manifest.sourcePackageSha256,
    finalArtifactSha256: manifest.finalArtifactSha256,
    chapterCount: manifest.chapterCount,
    passageCount: manifest.passageCount,
    claimReviewSlotCount: manifest.claimReviewSlotCount,
    pendingClaimReviewSlotCount: manifest.pendingClaimReviewSlotCount,
    ownerDeclarationStatus: "pending_owner_action",
    ownerApproval: false,
    runtimeEligible: false,
    releaseEligible: false,
    answerEligible: false,
    activationAllowed: false,
  }
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/(?:^|\s|["'])\/(?!\/)[^\s"']+/.test(message)) {
    const code = /^(owner_book_[a-z0-9_]+)/.exec(message)
    return code?.[1] ?? "owner_book_finalization_failed_closed"
  }
  return message || "owner_book_finalization_failed_closed"
}

function main(): void {
  const command = process.argv[2]
  const ssdRoot = process.env.RESEARCH_SSD_ROOT || DEFAULT_SSD_ROOT
  try {
    let result: JsonObject
    if (command === "prepare") {
      result = prepareFinalizationWorkbench({ ssdRoot })
    } else if (command === "verify") {
      result = verifyFinalizationWorkbench({ ssdRoot })
    } else {
      throw new OwnerBookFinalizationError(
        "owner_book_finalization_command_must_be_prepare_or_verify",
      )
    }
    process.stdout.write(stableJson(result, true))
  } catch (error) {
    process.stderr.write(stableJson({ ok: false, error: safeError(error) }, true))
    process.exitCode = 1
  }
}

if (require.main === module) main()

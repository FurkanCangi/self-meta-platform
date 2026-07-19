import { createHash } from "node:crypto"

export const DNA_OWNER_BOOK_LOCK_CONTRACT_VERSION = "dna-owner-book-lock@1" as const
export const DNA_OWNER_BOOK_DEFERRED_REASON = "owner_book_not_supplied" as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const STABLE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{2,159}$/

export type DnaByteRange = Readonly<{
  startByte: number
  endByteExclusive: number
}>

export type DnaOwnerBookPassage = Readonly<{
  passageId: string
  range: DnaByteRange
  passageSha256: string
}>

export type DnaOwnerBookChapter = Readonly<{
  chapterId: string
  range: DnaByteRange
  chapterSha256: string
  passages: readonly DnaOwnerBookPassage[]
}>

export type DnaOwnerBookManifest = Readonly<{
  schemaVersion: typeof DNA_OWNER_BOOK_LOCK_CONTRACT_VERSION
  bookId: string
  bookVersion: string
  artifactSha256: string
  byteLength: number
  chapters: readonly DnaOwnerBookChapter[]
}>

export type DnaOwnerBookApprovalRecord = Readonly<{
  approvalRecordId: string
  approvalStatus: "owner_approved"
  declarationVersion: string
  bookId: string
  bookVersion: string
  artifactSha256: string
  byteLength: number
  approvedChapterRanges: readonly Readonly<{
    chapterId: string
    range: DnaByteRange
    chapterSha256: string
  }>[]
  approvedPassageRanges: readonly Readonly<{
    chapterId: string
    passageId: string
    range: DnaByteRange
    passageSha256: string
  }>[]
}>

export type DnaProductClaimBookBinding = Readonly<{
  claimId: string
  chapterId: string
  passageId: string
  passageSha256: string
}>

export type DnaOwnerBookSupportRole =
  | "product_definition"
  | "external_scientific_evidence"
  | "psychometric_validity"
  | "reliability"
  | "factor_structure"
  | "measurement_invariance"
  | "criterion_validity"

export type DnaOwnerBookLockState =
  | Readonly<{
      schemaVersion: typeof DNA_OWNER_BOOK_LOCK_CONTRACT_VERSION
      status: "deferred_owner_book"
      reason: typeof DNA_OWNER_BOOK_DEFERRED_REASON
      ownerApprovalCount: 0
      approvedBook: null
      productClaimBindings: readonly DnaProductClaimBookBinding[]
      releaseEligible: false
      scientificValidationStatus: "not_established_by_book"
    }>
  | Readonly<{
      schemaVersion: typeof DNA_OWNER_BOOK_LOCK_CONTRACT_VERSION
      status: "locked"
      reason: null
      ownerApprovalCount: 1
      approvedBook: DnaOwnerBookManifest
      approvalRecordId: string
      productClaimBindings: readonly DnaProductClaimBookBinding[]
      releaseEligible: true
      scientificValidationStatus: "not_established_by_book"
    }>

export type DnaOwnerBookDraftChapter = Readonly<{
  chapterId: string
  range: DnaByteRange
  passages: readonly Readonly<{
    passageId: string
    range: DnaByteRange
  }>[]
}>

// A lock is authoritative only when this module minted it after verifying the
// artifact bytes and the owner's declaration. A structurally similar object
// supplied by a caller must never acquire owner-approved authority.
const TRUSTED_OWNER_BOOK_LOCK_STATES = new WeakSet<object>()

export const DNA_CURRENT_OWNER_BOOK_LOCK: DnaOwnerBookLockState = Object.freeze({
  schemaVersion: DNA_OWNER_BOOK_LOCK_CONTRACT_VERSION,
  status: "deferred_owner_book",
  reason: DNA_OWNER_BOOK_DEFERRED_REASON,
  ownerApprovalCount: 0,
  approvedBook: null,
  productClaimBindings: Object.freeze([]),
  releaseEligible: false,
  scientificValidationStatus: "not_established_by_book",
})
TRUSTED_OWNER_BOOK_LOCK_STATES.add(DNA_CURRENT_OWNER_BOOK_LOCK)

export const DNA_OWNER_BOOK_LOCK_CONTRACT = Object.freeze({
  schemaVersion: DNA_OWNER_BOOK_LOCK_CONTRACT_VERSION,
  currentStatus: "deferred_owner_book",
  deferredReason: DNA_OWNER_BOOK_DEFERRED_REASON,
  currentOwnerApprovals: 0,
  lockIdentityFields: Object.freeze([
    "bookId",
    "bookVersion",
    "artifactSha256",
    "byteLength",
  ]),
  chapterIdentityFields: Object.freeze([
    "chapterId",
    "startByte",
    "endByteExclusive",
    "chapterSha256",
  ]),
  passageIdentityFields: Object.freeze([
    "chapterId",
    "passageId",
    "startByte",
    "endByteExclusive",
    "passageSha256",
  ]),
  claimBindingFields: Object.freeze([
    "claimId",
    "chapterId",
    "passageId",
    "passageSha256",
  ]),
  ownerApprovalSupports: Object.freeze(["product_definition"]),
  ownerApprovalDoesNotEstablish: Object.freeze([
    "external_scientific_evidence",
    "psychometric_validity",
    "reliability",
    "factor_structure",
    "measurement_invariance",
    "criterion_validity",
  ] as const satisfies readonly DnaOwnerBookSupportRole[]),
})

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex")
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const object = value as Record<string, unknown>
  return `{${Object.keys(object).sort().map((key) =>
    `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`
}

function requireStableId(value: string, field: string): string {
  const normalized = String(value || "").trim()
  if (!STABLE_ID_PATTERN.test(normalized)) {
    throw new Error(`dna_book_lock_invalid_${field}`)
  }
  return normalized
}

function requireSha256(value: string, field: string): string {
  const normalized = String(value || "").trim().toLowerCase()
  if (!SHA256_PATTERN.test(normalized)) {
    throw new Error(`dna_book_lock_invalid_${field}`)
  }
  return normalized
}

function validateRange(range: DnaByteRange, byteLength: number, field: string): void {
  if (
    !Number.isSafeInteger(range.startByte) ||
    !Number.isSafeInteger(range.endByteExclusive) ||
    range.startByte < 0 ||
    range.endByteExclusive <= range.startByte ||
    range.endByteExclusive > byteLength
  ) {
    throw new Error(`dna_book_lock_invalid_${field}_range`)
  }
}

function sameRange(left: DnaByteRange, right: DnaByteRange): boolean {
  return left.startByte === right.startByte &&
    left.endByteExclusive === right.endByteExclusive
}

function assertUnique(ids: readonly string[], field: string): void {
  if (new Set(ids).size !== ids.length) {
    throw new Error(`dna_book_lock_duplicate_${field}`)
  }
}

function assertNonOverlapping(
  rows: readonly Readonly<{ range: DnaByteRange }>[],
  field: string,
): void {
  const sorted = [...rows].sort((left, right) =>
    left.range.startByte - right.range.startByte ||
    left.range.endByteExclusive - right.range.endByteExclusive)
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].range.startByte < sorted[index - 1].range.endByteExclusive) {
      throw new Error(`dna_book_lock_overlapping_${field}`)
    }
  }
}

function freezeRange(range: DnaByteRange): DnaByteRange {
  return Object.freeze({
    startByte: range.startByte,
    endByteExclusive: range.endByteExclusive,
  })
}

function sliceHash(bytes: Uint8Array, range: DnaByteRange): string {
  return sha256(bytes.subarray(range.startByte, range.endByteExclusive))
}

/**
 * Creates the byte-addressed manifest that an owner declaration must match.
 * Approval is deliberately a separate record: running this function never
 * implies that the owner approved the artifact.
 */
export function buildDnaOwnerBookManifest(input: {
  bookId: string
  bookVersion: string
  artifactBytes: Uint8Array
  chapters: readonly DnaOwnerBookDraftChapter[]
}): DnaOwnerBookManifest {
  const artifactBytes = new Uint8Array(input.artifactBytes)
  if (artifactBytes.byteLength === 0) throw new Error("dna_book_lock_empty_artifact")
  if (input.chapters.length === 0) throw new Error("dna_book_lock_missing_chapter")

  const bookId = requireStableId(input.bookId, "book_id")
  const bookVersion = requireStableId(input.bookVersion, "book_version")
  const chapterIds = input.chapters.map((chapter) =>
    requireStableId(chapter.chapterId, "chapter_id"))
  assertUnique(chapterIds, "chapter_id")
  assertNonOverlapping(input.chapters, "chapter_ranges")

  const globalPassageIds: string[] = []
  const chapters = input.chapters.map((chapter, chapterIndex) => {
    const chapterId = chapterIds[chapterIndex]
    validateRange(chapter.range, artifactBytes.byteLength, "chapter")
    if (chapter.passages.length === 0) {
      throw new Error("dna_book_lock_missing_passage")
    }
    assertNonOverlapping(chapter.passages, "passage_ranges")
    const passageIds = chapter.passages.map((passage) =>
      requireStableId(passage.passageId, "passage_id"))
    globalPassageIds.push(...passageIds)

    const passages = chapter.passages.map((passage, passageIndex) => {
      validateRange(passage.range, artifactBytes.byteLength, "passage")
      if (
        passage.range.startByte < chapter.range.startByte ||
        passage.range.endByteExclusive > chapter.range.endByteExclusive
      ) {
        throw new Error("dna_book_lock_passage_outside_chapter")
      }
      const range = freezeRange(passage.range)
      return Object.freeze({
        passageId: passageIds[passageIndex],
        range,
        passageSha256: sliceHash(artifactBytes, range),
      })
    })

    const range = freezeRange(chapter.range)
    return Object.freeze({
      chapterId,
      range,
      chapterSha256: sliceHash(artifactBytes, range),
      passages: Object.freeze(passages),
    })
  })
  assertUnique(globalPassageIds, "passage_id")

  return Object.freeze({
    schemaVersion: DNA_OWNER_BOOK_LOCK_CONTRACT_VERSION,
    bookId,
    bookVersion,
    artifactSha256: sha256(artifactBytes),
    byteLength: artifactBytes.byteLength,
    chapters: Object.freeze(chapters),
  })
}

export function verifyDnaOwnerBookArtifact(
  manifest: DnaOwnerBookManifest,
  artifactBytes: Uint8Array,
): boolean {
  try {
    const rebuilt = buildDnaOwnerBookManifest({
      bookId: manifest.bookId,
      bookVersion: manifest.bookVersion,
      artifactBytes,
      chapters: manifest.chapters.map((chapter) => ({
        chapterId: chapter.chapterId,
        range: chapter.range,
        passages: chapter.passages.map((passage) => ({
          passageId: passage.passageId,
          range: passage.range,
        })),
      })),
    })
    return stableJson(rebuilt) === stableJson(manifest)
  } catch {
    return false
  }
}

function assertApprovalMatchesManifest(
  manifest: DnaOwnerBookManifest,
  approval: DnaOwnerBookApprovalRecord,
): void {
  requireStableId(approval.approvalRecordId, "approval_record_id")
  requireStableId(approval.declarationVersion, "declaration_version")
  if (approval.approvalStatus !== "owner_approved") {
    throw new Error("dna_book_lock_owner_approval_required")
  }
  if (
    approval.bookId !== manifest.bookId ||
    approval.bookVersion !== manifest.bookVersion ||
    requireSha256(approval.artifactSha256, "approval_artifact_sha256") !== manifest.artifactSha256 ||
    approval.byteLength !== manifest.byteLength
  ) {
    throw new Error("dna_book_lock_approval_artifact_mismatch")
  }
  if (approval.approvedChapterRanges.length === 0) {
    throw new Error("dna_book_lock_empty_chapter_approval")
  }
  if (approval.approvedPassageRanges.length === 0) {
    throw new Error("dna_book_lock_empty_passage_approval")
  }

  assertUnique(
    approval.approvedChapterRanges.map((row) => row.chapterId),
    "approved_chapter_id",
  )
  assertUnique(
    approval.approvedPassageRanges.map((row) => row.passageId),
    "approved_passage_id",
  )

  for (const approved of approval.approvedChapterRanges) {
    const chapter = manifest.chapters.find((row) => row.chapterId === approved.chapterId)
    if (
      !chapter ||
      !sameRange(chapter.range, approved.range) ||
      chapter.chapterSha256 !== requireSha256(approved.chapterSha256, "chapter_sha256")
    ) {
      throw new Error("dna_book_lock_chapter_approval_mismatch")
    }
  }
  for (const approved of approval.approvedPassageRanges) {
    const chapter = manifest.chapters.find((row) => row.chapterId === approved.chapterId)
    const passage = chapter?.passages.find((row) => row.passageId === approved.passageId)
    if (
      !chapter ||
      !approval.approvedChapterRanges.some((row) => row.chapterId === chapter.chapterId) ||
      !passage ||
      !sameRange(passage.range, approved.range) ||
      passage.passageSha256 !== requireSha256(approved.passageSha256, "passage_sha256")
    ) {
      throw new Error("dna_book_lock_passage_approval_mismatch")
    }
  }
}

/**
 * Compiles a future owner-approved book lock. It cannot be called vacuously:
 * a real artifact, owner declaration, approved ranges and every live product
 * claim binding are required.
 */
export function compileDnaOwnerBookLock(input: {
  manifest: DnaOwnerBookManifest
  artifactBytes: Uint8Array
  approval: DnaOwnerBookApprovalRecord
  liveProductClaimIds: readonly string[]
  claimBindings: readonly DnaProductClaimBookBinding[]
}): DnaOwnerBookLockState {
  if (!verifyDnaOwnerBookArtifact(input.manifest, input.artifactBytes)) {
    throw new Error("dna_book_lock_artifact_hash_mismatch")
  }
  assertApprovalMatchesManifest(input.manifest, input.approval)

  const liveClaimIds = input.liveProductClaimIds.map((claimId) =>
    requireStableId(claimId, "claim_id"))
  if (liveClaimIds.length === 0) {
    throw new Error("dna_book_lock_vacuous_claim_set")
  }
  assertUnique(liveClaimIds, "live_claim_id")
  assertUnique(input.claimBindings.map((binding) => binding.claimId), "claim_binding")
  if (
    input.claimBindings.length !== liveClaimIds.length ||
    input.claimBindings.some((binding) => !liveClaimIds.includes(binding.claimId))
  ) {
    throw new Error("dna_book_lock_incomplete_live_claim_binding")
  }

  const bindings = input.claimBindings.map((binding) => {
    const claimId = requireStableId(binding.claimId, "claim_id")
    const chapterId = requireStableId(binding.chapterId, "chapter_id")
    const passageId = requireStableId(binding.passageId, "passage_id")
    const passageSha256 = requireSha256(binding.passageSha256, "passage_sha256")
    const approvedPassage = input.approval.approvedPassageRanges.find((row) =>
      row.chapterId === chapterId && row.passageId === passageId)
    if (!approvedPassage || approvedPassage.passageSha256 !== passageSha256) {
      throw new Error("dna_book_lock_claim_passage_not_approved")
    }
    return Object.freeze({ claimId, chapterId, passageId, passageSha256 })
  })

  const state: DnaOwnerBookLockState = Object.freeze({
    schemaVersion: DNA_OWNER_BOOK_LOCK_CONTRACT_VERSION,
    status: "locked",
    reason: null,
    ownerApprovalCount: 1,
    approvedBook: input.manifest,
    approvalRecordId: input.approval.approvalRecordId,
    productClaimBindings: Object.freeze(bindings),
    releaseEligible: true,
    scientificValidationStatus: "not_established_by_book",
  })
  TRUSTED_OWNER_BOOK_LOCK_STATES.add(state)
  return state
}

export function canOwnerBookApprovalSupportRole(
  state: DnaOwnerBookLockState,
  role: DnaOwnerBookSupportRole,
): boolean {
  return isDnaOwnerBookLockStateConsistent(state)
    && state.status === "locked"
    && state.releaseEligible
    && role === "product_definition"
}

/**
 * Verifies both module provenance and structure. Locks do not retain authority
 * across an untrusted serialization boundary; the receiving process must
 * rebuild them from the artifact bytes and the owner declaration.
 */
export function isDnaOwnerBookLockStateConsistent(state: DnaOwnerBookLockState): boolean {
  if (!TRUSTED_OWNER_BOOK_LOCK_STATES.has(state)) return false
  if (state.status === "deferred_owner_book") {
    return state.reason === DNA_OWNER_BOOK_DEFERRED_REASON
      && state.ownerApprovalCount === 0
      && state.approvedBook === null
      && state.productClaimBindings.length === 0
      && state.releaseEligible === false
  }
  if (
    state.reason !== null
    || state.ownerApprovalCount !== 1
    || !state.releaseEligible
    || !state.approvedBook
    || state.productClaimBindings.length === 0
  ) return false
  const claimIds = new Set<string>()
  for (const binding of state.productClaimBindings) {
    if (claimIds.has(binding.claimId)) return false
    claimIds.add(binding.claimId)
    const chapter = state.approvedBook.chapters.find((entry) =>
      entry.chapterId === binding.chapterId)
    const passage = chapter?.passages.find((entry) =>
      entry.passageId === binding.passageId)
    if (!passage || passage.passageSha256 !== binding.passageSha256) return false
  }
  return true
}

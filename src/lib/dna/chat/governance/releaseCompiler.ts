import { createHash } from "node:crypto"

import {
  DNA_CURRENT_OWNER_BOOK_LOCK,
  isDnaOwnerBookLockStateConsistent,
  type DnaOwnerBookLockState,
} from "./bookLock"
import {
  DNA_COVERAGE_CELLS,
  isCoverageCellReleaseReady,
  type DnaCoverageCell,
} from "./coverageMap"
import {
  isV3ContentReleaseEligible,
  type DnaContentLifecycleRecord,
  type DnaV2LegacyLifecycleRecord,
} from "./lifecycle"
import {
  canSourceSupportClaim,
  deduplicateSourceFamilies,
  evaluateComponentRelease,
  isSourceIdentityReleaseEligible,
  validateSourceIdentityRecords,
  type DnaLicenseComponent,
  type DnaScientificClaimMode,
  type DnaSourceIdentityRecord,
  type DnaSourceLicenseRecord,
  type DnaSourceAgeScope,
  type DnaSourcePriorityInput,
  type DnaSourceQuestionType,
  type DnaSourceSampleScope,
} from "./sourceGovernance"

export const DNA_V3_RELEASE_COMPILER_VERSION = "dna-v3-release-compiler@1" as const
export const DNA_V3_RELEASE_AUTHORIZATION_VERSION = "dna-v3-release-authorization@1" as const
const SHA256_PATTERN = /^[a-f0-9]{64}$/

type LifecycleRecord = DnaContentLifecycleRecord | DnaV2LegacyLifecycleRecord

export type DnaV3ReleasePayload =
  | null
  | boolean
  | number
  | string
  | readonly DnaV3ReleasePayload[]
  | Readonly<{ [key: string]: DnaV3ReleasePayload }>

type DnaV3ReleaseCandidateBase = Readonly<{
  candidateId: string
  claimId: string
  claimSha256: string
  claimPayload: DnaV3ReleasePayload
  passageId: string
  passageSha256: string
  passagePayload: DnaV3ReleasePayload
  coverageCellId: DnaCoverageCell["id"]
  claimLifecycle: LifecycleRecord
  passageLifecycle: LifecycleRecord
}>

export type DnaV3ProductReleaseCandidate = DnaV3ReleaseCandidateBase & Readonly<{
  authority: "dna_product_information"
  ownerChapterId: string
  artifactPassageSha256: string
}>

export type DnaV3ScienceReleaseCandidate = DnaV3ReleaseCandidateBase & Readonly<{
  authority: "external_scientific_information"
  sourceId: string
  sourceSha256: string
  sourcePayload: DnaV3ReleasePayload
  componentId: string
  componentSha256: string
  componentPayload: DnaV3ReleasePayload
  componentSourceId: string
  passageSourceId: string
  passageComponentId: string
  sourceLifecycle: LifecycleRecord
  componentLifecycle: LifecycleRecord
  priority: DnaSourcePriorityInput
  questionType: DnaSourceQuestionType
  claimMode: DnaScientificClaimMode
  claimPopulation?: "human" | "animal" | "in_vitro" | "not_applicable"
  claimAgeScope: Exclude<DnaSourceAgeScope, "not_reported">
  claimSampleScope: Exclude<DnaSourceSampleScope, "not_reported">
  mechanismPopulation?: "human" | "animal" | "in_vitro"
  identity: DnaSourceIdentityRecord
  license: DnaSourceLicenseRecord
  licenseComponent: DnaLicenseComponent
  licenseCompliance: DnaV3LicenseObligationFulfillment
  provenance: DnaV3ScienceSupportProvenance
}>

export const DNA_V3_ATTRIBUTION_NOTICE_VERSION = "dna-v3-attribution-notice@1" as const
export const DNA_V3_SHARE_ALIKE_NOTICE_VERSION = "dna-v3-share-alike-notice@1" as const

export type DnaV3AttributionNoticePayload = Readonly<{
  schemaVersion: typeof DNA_V3_ATTRIBUTION_NOTICE_VERSION
  sourceId: string
  identitySha256: string
  licenseSha256: string
  licenseComponent: DnaLicenseComponent
  sourceTitle: string
  sourceAuthors: readonly string[]
  sourceYear: number
  sourceVenue: string | null
  declaredLicense: string
  noticeText: string
}>

export type DnaV3ShareAlikeNoticePayload = Readonly<{
  schemaVersion: typeof DNA_V3_SHARE_ALIKE_NOTICE_VERSION
  sourceId: string
  identitySha256: string
  licenseSha256: string
  licenseComponent: DnaLicenseComponent
  declaredLicense: string
  releaseLicensePolicy: "cc_by_sa"
  noticeText: string
}>

export type DnaV3LicenseObligationFulfillment = Readonly<{
  attribution: Readonly<{
    status: "satisfied" | "not_required" | "pending"
    noticePayload: DnaV3AttributionNoticePayload | null
    noticeSha256: string | null
  }>
  shareAlike: Readonly<{
    status: "satisfied" | "not_required" | "pending"
    releaseLicensePolicy: "cc_by_sa" | null
    noticePayload: DnaV3ShareAlikeNoticePayload | null
    noticeSha256: string | null
  }>
}>

export type DnaV3ReleaseCandidate =
  | DnaV3ProductReleaseCandidate
  | DnaV3ScienceReleaseCandidate

export const DNA_V3_RELEASE_BLOCK_CODES = [
  "duplicate_candidate_id",
  "coverage_collection_untrusted",
  "coverage_cell_missing",
  "coverage_cell_not_release_ready",
  "coverage_claim_not_bound",
  "coverage_source_not_bound",
  "claim_lifecycle_not_released",
  "passage_lifecycle_not_released",
  "source_lifecycle_not_released",
  "component_lifecycle_not_released",
  "lifecycle_content_mismatch",
  "lifecycle_content_hash_mismatch",
  "payload_hash_mismatch",
  "global_content_hash_conflict",
  "source_governance_profile_conflict",
  "candidate_not_in_audited_registry",
  "owner_book_deferred",
  "owner_book_not_release_eligible",
  "owner_book_lock_invalid",
  "owner_claim_not_bound_to_approved_passage",
  "owner_passage_hash_mismatch",
  "owner_artifact_passage_hash_mismatch",
  "invalid_support_provenance",
  "support_parent_mismatch",
  "source_priority_denied",
  "source_identity_collection_invalid",
  "source_identity_not_release_eligible",
  "source_family_not_independent",
  "source_license_component_denied",
  "source_license_obligations_unfulfilled",
] as const

export type DnaV3ReleaseBlockCode = (typeof DNA_V3_RELEASE_BLOCK_CODES)[number]

export const DNA_V3_SCIENCE_PROVENANCE_VERSION = "dna-v3-science-support-provenance@1" as const

export type DnaV3ScienceSupportProvenance = Readonly<{
  schemaVersion: typeof DNA_V3_SCIENCE_PROVENANCE_VERSION
  sourceId: string
  sourceSha256: string
  passageId: string
  passageSha256: string
  componentId: string
  componentSha256: string
  componentSourceId: string
  claimId: string
  claimSha256: string
  passageSourceId: string
  passageComponentId: string
  licenseComponent: DnaLicenseComponent
  identitySha256: string
  licenseSha256: string
  licenseComplianceSha256: string
  prioritySha256: string
  provenanceSha256: string
}>

export type DnaV3ReleaseDecision = Readonly<{
  candidateId: string
  authorizationDigest: string
  released: boolean
  blockCodes: readonly DnaV3ReleaseBlockCode[]
}>

export type DnaV3ReleasedCandidateAuthorization = Readonly<{
  candidateId: string
  authorizationDigest: string
}>

export type DnaV3ReleasePackage = Readonly<{
  schemaVersion: typeof DNA_V3_RELEASE_COMPILER_VERSION
  releaseGeneration: "v3"
  releasedCandidates: readonly DnaV3ReleasedCandidateAuthorization[]
  releasedCandidateIds: readonly string[]
  blocked: readonly DnaV3ReleaseDecision[]
  releaseCount: number
  blockedCount: number
  inputSha256: string
  auditedRegistryVersion: typeof DNA_V3_AUDITED_RELEASE_REGISTRY_VERSION
  auditedRegistryCount: number
}>

export const DNA_V3_AUDITED_RELEASE_REGISTRY_VERSION =
  "dna-v3-audited-release-registry@1" as const

/**
 * Only authorization digests committed after the complete independent audit
 * may enter the V3 runtime package. Product authorization includes the entire
 * owner-book lock identity, so a later lock or binding change cannot reuse an
 * earlier audit entry. The registry remains intentionally empty until real V3
 * content completes the lifecycle.
 */
export const DNA_AUDITED_V3_RELEASE_AUTHORIZATION_DIGESTS = Object.freeze(
  [] as string[],
)

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const object = value as Record<string, unknown>
  return `{${Object.keys(object).sort().map((key) =>
    `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex")
}

export function dnaV3ReleasePayloadSha256(payload: DnaV3ReleasePayload): string {
  return sha256(payload)
}

function requireNoticeText(value: string): string {
  const normalized = String(value || "").trim()
  if (!normalized) throw new Error("dna_v3_license_notice_text_required")
  return normalized
}

function assertNoticeIdentityLicenseBinding(input: {
  identity: DnaSourceIdentityRecord
  license: DnaSourceLicenseRecord
}): void {
  if (input.identity.sourceId !== input.license.sourceId) {
    throw new Error("dna_v3_license_notice_source_mismatch")
  }
}

export function createDnaV3AttributionNoticePayload(input: {
  identity: DnaSourceIdentityRecord
  license: DnaSourceLicenseRecord
  licenseComponent: DnaLicenseComponent
  noticeText: string
}): DnaV3AttributionNoticePayload {
  assertNoticeIdentityLicenseBinding(input)
  return Object.freeze({
    schemaVersion: DNA_V3_ATTRIBUTION_NOTICE_VERSION,
    sourceId: input.identity.sourceId,
    identitySha256: sha256(input.identity),
    licenseSha256: sha256(input.license),
    licenseComponent: input.licenseComponent,
    sourceTitle: input.identity.bibliography.title,
    sourceAuthors: Object.freeze([...input.identity.bibliography.authors]),
    sourceYear: input.identity.bibliography.year,
    sourceVenue: input.identity.bibliography.venue,
    declaredLicense: input.license.declaredLicense,
    noticeText: requireNoticeText(input.noticeText),
  })
}

export function createDnaV3ShareAlikeNoticePayload(input: {
  identity: DnaSourceIdentityRecord
  license: DnaSourceLicenseRecord
  licenseComponent: DnaLicenseComponent
  noticeText: string
}): DnaV3ShareAlikeNoticePayload {
  assertNoticeIdentityLicenseBinding(input)
  if (input.license.policy !== "cc_by_sa" || !input.license.obligations.shareAlikeRequired) {
    throw new Error("dna_v3_share_alike_notice_not_required")
  }
  return Object.freeze({
    schemaVersion: DNA_V3_SHARE_ALIKE_NOTICE_VERSION,
    sourceId: input.identity.sourceId,
    identitySha256: sha256(input.identity),
    licenseSha256: sha256(input.license),
    licenseComponent: input.licenseComponent,
    declaredLicense: input.license.declaredLicense,
    releaseLicensePolicy: "cc_by_sa",
    noticeText: requireNoticeText(input.noticeText),
  })
}

export function dnaV3LicenseNoticePayloadSha256(
  payload: DnaV3AttributionNoticePayload | DnaV3ShareAlikeNoticePayload,
): string {
  return sha256(payload)
}

export function dnaV3ReleaseCandidateDigest(candidate: DnaV3ReleaseCandidate): string {
  return sha256({
    registryVersion: DNA_V3_AUDITED_RELEASE_REGISTRY_VERSION,
    candidate,
  })
}

/**
 * The authorization digest is distinct from the audited candidate digest.
 * Product authorization deliberately commits the complete owner lock state,
 * including the exact artifact, chapters, passages, approval record and claim
 * bindings. Any change to that identity therefore yields a different digest.
 */
export function dnaV3ReleaseAuthorizationDigest(
  candidate: DnaV3ReleaseCandidate,
  ownerBookLock: DnaOwnerBookLockState = DNA_CURRENT_OWNER_BOOK_LOCK,
): string {
  return sha256({
    schemaVersion: DNA_V3_RELEASE_AUTHORIZATION_VERSION,
    registryVersion: DNA_V3_AUDITED_RELEASE_REGISTRY_VERSION,
    candidateDigest: dnaV3ReleaseCandidateDigest(candidate),
    authority: candidate.authority,
    ownerBookLockIdentity: candidate.authority === "dna_product_information"
      ? ownerBookLock
      : null,
  })
}

function lifecycleMatches(
  record: LifecycleRecord,
  contentId: string,
  contentKind: DnaContentLifecycleRecord["contentKind"],
): boolean {
  return record.generation === "v3"
    && record.contentId === contentId
    && record.contentKind === contentKind
}

function lifecycleHashMatches(record: LifecycleRecord, contentSha256: string): boolean {
  return record.generation === "v3" && record.contentSha256 === contentSha256
}

function scienceProvenanceCore(input: Omit<
  DnaV3ScienceSupportProvenance,
  "schemaVersion" | "provenanceSha256"
>): Omit<DnaV3ScienceSupportProvenance, "provenanceSha256"> {
  return {
    schemaVersion: DNA_V3_SCIENCE_PROVENANCE_VERSION,
    ...input,
  }
}

export function createDnaV3ScienceSupportProvenance(input: Omit<
  DnaV3ScienceSupportProvenance,
  "schemaVersion" | "provenanceSha256" | "identitySha256" | "licenseSha256" | "licenseComplianceSha256" | "prioritySha256"
> & Readonly<{
  identity: DnaSourceIdentityRecord
  license: DnaSourceLicenseRecord
  licenseCompliance: DnaV3LicenseObligationFulfillment
  priority: DnaSourcePriorityInput
}>): DnaV3ScienceSupportProvenance {
  const { identity, license, licenseCompliance, priority, ...bindings } = input
  const core = scienceProvenanceCore({
    ...bindings,
    identitySha256: sha256(identity),
    licenseSha256: sha256(license),
    licenseComplianceSha256: sha256(licenseCompliance),
    prioritySha256: sha256(priority),
  })
  return Object.freeze({ ...core, provenanceSha256: sha256(core) })
}

function verifyScienceSupportProvenance(
  candidate: DnaV3ScienceReleaseCandidate,
): boolean {
  const provenance = candidate.provenance
  const core = scienceProvenanceCore({
    sourceId: candidate.sourceId,
    sourceSha256: candidate.sourceSha256,
    passageId: candidate.passageId,
    passageSha256: candidate.passageSha256,
    passageSourceId: candidate.passageSourceId,
    passageComponentId: candidate.passageComponentId,
    componentId: candidate.componentId,
    componentSha256: candidate.componentSha256,
    componentSourceId: candidate.componentSourceId,
    claimId: candidate.claimId,
    claimSha256: candidate.claimSha256,
    licenseComponent: candidate.licenseComponent,
    identitySha256: sha256(candidate.identity),
    licenseSha256: sha256(candidate.license),
    licenseComplianceSha256: sha256(candidate.licenseCompliance),
    prioritySha256: sha256(candidate.priority),
  })
  return provenance.schemaVersion === DNA_V3_SCIENCE_PROVENANCE_VERSION
    && stableJson(provenance) === stableJson({
      ...core,
      provenanceSha256: sha256(core),
    })
}

function pushUnique(
  values: DnaV3ReleaseBlockCode[],
  value: DnaV3ReleaseBlockCode,
): void {
  if (!values.includes(value)) values.push(value)
}

function attributionNoticeMatches(input: {
  identity: DnaSourceIdentityRecord
  license: DnaSourceLicenseRecord
  licenseComponent: DnaLicenseComponent
  notice: DnaV3AttributionNoticePayload
}): boolean {
  try {
    const expected = createDnaV3AttributionNoticePayload({
      identity: input.identity,
      license: input.license,
      licenseComponent: input.licenseComponent,
      noticeText: input.notice.noticeText,
    })
    return stableJson(input.notice) === stableJson(expected)
  } catch {
    return false
  }
}

function shareAlikeNoticeMatches(input: {
  identity: DnaSourceIdentityRecord
  license: DnaSourceLicenseRecord
  licenseComponent: DnaLicenseComponent
  notice: DnaV3ShareAlikeNoticePayload
}): boolean {
  try {
    const expected = createDnaV3ShareAlikeNoticePayload({
      identity: input.identity,
      license: input.license,
      licenseComponent: input.licenseComponent,
      noticeText: input.notice.noticeText,
    })
    return stableJson(input.notice) === stableJson(expected)
  } catch {
    return false
  }
}

function areLicenseObligationsFulfilled(
  identity: DnaSourceIdentityRecord,
  license: DnaSourceLicenseRecord,
  licenseComponent: DnaLicenseComponent,
  fulfillment: DnaV3LicenseObligationFulfillment,
): boolean {
  const attributionOk = license.obligations.attributionRequired
    ? fulfillment.attribution.status === "satisfied"
      && fulfillment.attribution.noticePayload !== null
      && fulfillment.attribution.noticeSha256 !== null
      && SHA256_PATTERN.test(fulfillment.attribution.noticeSha256)
      && dnaV3LicenseNoticePayloadSha256(fulfillment.attribution.noticePayload)
        === fulfillment.attribution.noticeSha256
      && attributionNoticeMatches({
        identity,
        license,
        licenseComponent,
        notice: fulfillment.attribution.noticePayload,
      })
    : fulfillment.attribution.status === "not_required"
      && fulfillment.attribution.noticePayload === null
      && fulfillment.attribution.noticeSha256 === null
  const shareAlikeOk = license.obligations.shareAlikeRequired
    ? fulfillment.shareAlike.status === "satisfied"
      && fulfillment.shareAlike.releaseLicensePolicy === "cc_by_sa"
      && fulfillment.shareAlike.noticePayload !== null
      && fulfillment.shareAlike.noticeSha256 !== null
      && SHA256_PATTERN.test(fulfillment.shareAlike.noticeSha256)
      && dnaV3LicenseNoticePayloadSha256(fulfillment.shareAlike.noticePayload)
        === fulfillment.shareAlike.noticeSha256
      && shareAlikeNoticeMatches({
        identity,
        license,
        licenseComponent,
        notice: fulfillment.shareAlike.noticePayload,
      })
    : fulfillment.shareAlike.status === "not_required"
      && fulfillment.shareAlike.releaseLicensePolicy === null
      && fulfillment.shareAlike.noticePayload === null
      && fulfillment.shareAlike.noticeSha256 === null
  return attributionOk && shareAlikeOk
}

function collectConflictingIds(
  rows: readonly Readonly<{ id: string; fingerprint: string }>[],
): ReadonlySet<string> {
  const firstById = new Map<string, string>()
  const conflicts = new Set<string>()
  for (const row of rows) {
    const first = firstById.get(row.id)
    if (first === undefined) firstById.set(row.id, row.fingerprint)
    else if (first !== row.fingerprint) conflicts.add(row.id)
  }
  return conflicts
}

export function compileDnaV3ReleasePackage(input: {
  readonly candidates: readonly DnaV3ReleaseCandidate[]
  readonly coverageCells?: readonly DnaCoverageCell[]
  readonly ownerBookLock?: DnaOwnerBookLockState
}): DnaV3ReleasePackage {
  const coverageCells = input.coverageCells ?? DNA_COVERAGE_CELLS
  const coverageCollectionTrusted = input.coverageCells === undefined
    || input.coverageCells === DNA_COVERAGE_CELLS
  const ownerBookLock = input.ownerBookLock ?? DNA_CURRENT_OWNER_BOOK_LOCK
  const coverageById = new Map(coverageCells.map((cell) => [cell.id, cell]))
  const candidateIdCounts = new Map<string, number>()
  for (const candidate of input.candidates) {
    candidateIdCounts.set(candidate.candidateId, (candidateIdCounts.get(candidate.candidateId) ?? 0) + 1)
  }

  const conflictingClaimIds = collectConflictingIds(input.candidates.map((candidate) => ({
    id: candidate.claimId,
    fingerprint: `${candidate.claimSha256}:${sha256(candidate.claimPayload)}`,
  })))
  const conflictingPassageIds = collectConflictingIds(input.candidates.map((candidate) => ({
    id: candidate.passageId,
    fingerprint: `${candidate.passageSha256}:${sha256(candidate.passagePayload)}`,
  })))

  const scienceCandidates = input.candidates.filter(
    (candidate): candidate is DnaV3ScienceReleaseCandidate =>
      candidate.authority === "external_scientific_information",
  )
  const identityBySourceId = new Map<string, DnaSourceIdentityRecord>()
  const identityConflictSourceIds = new Set<string>()
  for (const candidate of scienceCandidates) {
    const previous = identityBySourceId.get(candidate.sourceId)
    if (previous && stableJson(previous) !== stableJson(candidate.identity)) {
      identityConflictSourceIds.add(candidate.sourceId)
    } else if (!previous) {
      identityBySourceId.set(candidate.sourceId, candidate.identity)
    }
  }
  const conflictingSourceIds = collectConflictingIds(scienceCandidates.map((candidate) => ({
    id: candidate.sourceId,
    fingerprint: `${candidate.sourceSha256}:${sha256(candidate.sourcePayload)}`,
  })))
  const conflictingComponentIds = collectConflictingIds(scienceCandidates.map((candidate) => ({
    id: candidate.componentId,
    fingerprint: `${candidate.componentSha256}:${sha256(candidate.componentPayload)}`,
  })))
  const governanceProfileConflictSourceIds = collectConflictingIds(
    scienceCandidates.map((candidate) => ({
      id: candidate.sourceId,
      fingerprint: sha256({
        identity: candidate.identity,
        license: candidate.license,
        priority: candidate.priority,
      }),
    })),
  )
  const identityRecords = [...identityBySourceId.values()]
  const identityValidation = validateSourceIdentityRecords(identityRecords)
  const familySelection = identityValidation.ok
    ? new Set(deduplicateSourceFamilies(identityRecords).selectedSourceIds)
    : new Set<string>()

  const decisions = input.candidates
    .map((candidate): DnaV3ReleaseDecision => {
      const blockCodes: DnaV3ReleaseBlockCode[] = []
      const authorizationDigest = dnaV3ReleaseAuthorizationDigest(candidate, ownerBookLock)
      if ((candidateIdCounts.get(candidate.candidateId) ?? 0) > 1) {
        pushUnique(blockCodes, "duplicate_candidate_id")
      }
      if (!coverageCollectionTrusted) {
        pushUnique(blockCodes, "coverage_collection_untrusted")
      }
      if (!DNA_AUDITED_V3_RELEASE_AUTHORIZATION_DIGESTS.includes(authorizationDigest)) {
        pushUnique(blockCodes, "candidate_not_in_audited_registry")
      }
      if (
        conflictingClaimIds.has(candidate.claimId)
        || conflictingPassageIds.has(candidate.passageId)
      ) {
        pushUnique(blockCodes, "global_content_hash_conflict")
      }

      const coverageCell = coverageById.get(candidate.coverageCellId)
      if (!coverageCell) {
        pushUnique(blockCodes, "coverage_cell_missing")
      } else {
        if (!isCoverageCellReleaseReady(coverageCell)) {
          pushUnique(blockCodes, "coverage_cell_not_release_ready")
        }
        if (!coverageCell.releaseEvidence.claimIds.includes(candidate.claimId)) {
          pushUnique(blockCodes, "coverage_claim_not_bound")
        }
      }

      if (!lifecycleMatches(candidate.claimLifecycle, candidate.claimId, "claim")
        || !lifecycleMatches(candidate.passageLifecycle, candidate.passageId, "passage")) {
        pushUnique(blockCodes, "lifecycle_content_mismatch")
      }
      if (!lifecycleHashMatches(candidate.claimLifecycle, candidate.claimSha256)
        || !lifecycleHashMatches(candidate.passageLifecycle, candidate.passageSha256)) {
        pushUnique(blockCodes, "lifecycle_content_hash_mismatch")
      }
      if (
        sha256(candidate.claimPayload) !== candidate.claimSha256
        || sha256(candidate.passagePayload) !== candidate.passageSha256
      ) {
        pushUnique(blockCodes, "payload_hash_mismatch")
      }
      if (!isV3ContentReleaseEligible(candidate.claimLifecycle)) {
        pushUnique(blockCodes, "claim_lifecycle_not_released")
      }
      if (!isV3ContentReleaseEligible(candidate.passageLifecycle)) {
        pushUnique(blockCodes, "passage_lifecycle_not_released")
      }

      if (candidate.authority === "dna_product_information") {
        if (!isDnaOwnerBookLockStateConsistent(ownerBookLock)) {
          pushUnique(blockCodes, "owner_book_lock_invalid")
        }
        if (ownerBookLock.status === "deferred_owner_book") {
          pushUnique(blockCodes, "owner_book_deferred")
        } else {
          if (!ownerBookLock.releaseEligible) {
            pushUnique(blockCodes, "owner_book_not_release_eligible")
          }
          const binding = ownerBookLock.productClaimBindings.find((entry) =>
            entry.claimId === candidate.claimId
            && entry.chapterId === candidate.ownerChapterId
            && entry.passageId === candidate.passageId)
          if (!binding) {
            pushUnique(blockCodes, "owner_claim_not_bound_to_approved_passage")
          } else if (binding.passageSha256 !== candidate.passageSha256) {
            pushUnique(blockCodes, "owner_passage_hash_mismatch")
          }
          if (!binding || binding.artifactPassageSha256 !== candidate.artifactPassageSha256) {
            pushUnique(blockCodes, "owner_artifact_passage_hash_mismatch")
          }
        }
      } else {
        if (
          conflictingSourceIds.has(candidate.sourceId)
          || conflictingComponentIds.has(candidate.componentId)
        ) {
          pushUnique(blockCodes, "global_content_hash_conflict")
        }
        if (governanceProfileConflictSourceIds.has(candidate.sourceId)) {
          pushUnique(blockCodes, "source_governance_profile_conflict")
        }
        if (coverageCell && !coverageCell.releaseEvidence.sourceIds.includes(candidate.sourceId)) {
          pushUnique(blockCodes, "coverage_source_not_bound")
        }
        if (!lifecycleMatches(candidate.sourceLifecycle, candidate.sourceId, "source")
          || !lifecycleMatches(candidate.componentLifecycle, candidate.componentId, "component")) {
          pushUnique(blockCodes, "lifecycle_content_mismatch")
        }
        if (!lifecycleHashMatches(candidate.sourceLifecycle, candidate.sourceSha256)
          || !lifecycleHashMatches(candidate.componentLifecycle, candidate.componentSha256)) {
          pushUnique(blockCodes, "lifecycle_content_hash_mismatch")
        }
        if (
          sha256(candidate.sourcePayload) !== candidate.sourceSha256
          || sha256(candidate.componentPayload) !== candidate.componentSha256
        ) {
          pushUnique(blockCodes, "payload_hash_mismatch")
        }
        if (!verifyScienceSupportProvenance(candidate)) {
          pushUnique(blockCodes, "invalid_support_provenance")
        }
        if (
          candidate.componentSourceId !== candidate.sourceId
          || candidate.passageSourceId !== candidate.sourceId
          || candidate.passageComponentId !== candidate.componentId
        ) {
          pushUnique(blockCodes, "support_parent_mismatch")
        }
        if (!isV3ContentReleaseEligible(candidate.sourceLifecycle)) {
          pushUnique(blockCodes, "source_lifecycle_not_released")
        }
        if (!isV3ContentReleaseEligible(candidate.componentLifecycle)) {
          pushUnique(blockCodes, "component_lifecycle_not_released")
        }
        if (candidate.priority.sourceId !== candidate.sourceId
          || candidate.identity.sourceId !== candidate.sourceId
          || candidate.license.sourceId !== candidate.sourceId
          || !canSourceSupportClaim({
            source: candidate.priority,
            questionType: candidate.questionType,
            claimMode: candidate.claimMode,
            claimPopulation: candidate.claimPopulation,
            claimAgeScope: candidate.claimAgeScope,
            claimSampleScope: candidate.claimSampleScope,
            mechanismPopulation: candidate.mechanismPopulation,
          })) {
          pushUnique(blockCodes, "source_priority_denied")
        }
        if (!identityValidation.ok || identityConflictSourceIds.has(candidate.sourceId)) {
          pushUnique(blockCodes, "source_identity_collection_invalid")
        }
        if (!familySelection.has(candidate.sourceId)) {
          pushUnique(blockCodes, "source_family_not_independent")
        }
        if (candidate.identity.sourceId !== candidate.license.sourceId
          || !isSourceIdentityReleaseEligible(candidate.identity, identityRecords)) {
          pushUnique(blockCodes, "source_identity_not_release_eligible")
        }
        if (candidate.identity.sourceId !== candidate.license.sourceId
          || !evaluateComponentRelease(candidate.license, candidate.licenseComponent).allowed) {
          pushUnique(blockCodes, "source_license_component_denied")
        }
        if (!areLicenseObligationsFulfilled(
          candidate.identity,
          candidate.license,
          candidate.licenseComponent,
          candidate.licenseCompliance,
        )) {
          pushUnique(blockCodes, "source_license_obligations_unfulfilled")
        }
      }

      return Object.freeze({
        candidateId: candidate.candidateId,
        authorizationDigest,
        released: blockCodes.length === 0,
        blockCodes: Object.freeze([...blockCodes].sort()),
      })
    })
    .sort((left, right) => left.candidateId.localeCompare(right.candidateId))

  const releasedCandidates = decisions
    .filter((decision) => decision.released)
    .map((decision) => Object.freeze({
      candidateId: decision.candidateId,
      authorizationDigest: decision.authorizationDigest,
    }))
  const releasedCandidateIds = releasedCandidates.map((decision) => decision.candidateId)
  const blocked = decisions.filter((decision) => !decision.released)

  return Object.freeze({
    schemaVersion: DNA_V3_RELEASE_COMPILER_VERSION,
    releaseGeneration: "v3",
    releasedCandidates: Object.freeze(releasedCandidates),
    releasedCandidateIds: Object.freeze(releasedCandidateIds),
    blocked: Object.freeze(blocked),
    releaseCount: releasedCandidateIds.length,
    blockedCount: blocked.length,
    inputSha256: sha256({
      candidates: input.candidates,
      coverageCells,
      ownerBookLock,
    }),
    auditedRegistryVersion: DNA_V3_AUDITED_RELEASE_REGISTRY_VERSION,
    auditedRegistryCount: DNA_AUDITED_V3_RELEASE_AUTHORIZATION_DIGESTS.length,
  })
}

/**
 * The current package intentionally starts empty. Existing V2 catalogue rows
 * stay available through the V2 rollback path, but none are silently promoted
 * to V3 merely because they were previously marked approved or verified.
 */
export const DNA_CURRENT_V3_RELEASE_PACKAGE = compileDnaV3ReleasePackage({
  candidates: Object.freeze([]),
})

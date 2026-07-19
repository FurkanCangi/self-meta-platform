import { createHash } from "node:crypto"

import {
  DNA_CHAT_CATALOG_CLAIMS,
  DNA_CHAT_CATALOG_RELATIONS,
  DNA_CHAT_CATALOG_SOURCES,
  DNA_CHAT_CATALOG_TOPICS,
  type DnaChatCatalogClaim,
  type DnaChatCatalogRelation,
  type DnaChatCatalogSource,
  type DnaChatCatalogTopic,
} from "../catalog"
import type { DnaV3ReleaseStatus } from "../catalog/generated/v3/types"
import { DNA_CURRENT_V3_RELEASE_PACKAGE } from "./releaseCompiler"

export const DNA_V2_CATALOG_REAUDIT_VERSION = "dna-v2-catalog-reaudit@1" as const
export const DNA_V2_CATALOG_REAUDIT_DATE = "2026-07-19T00:00:00.000Z" as const

export const DNA_V2_CLAIM_EXCLUSION_REASONS = Object.freeze([
  "missing_real_passage",
  "legacy_source_id_is_not_passage_evidence",
  "legacy_expert_pending",
  "source_reference_missing",
  "topic_reference_missing",
  "binding_not_release_eligible",
] as const)

export type DnaV2ClaimExclusionReason =
  (typeof DNA_V2_CLAIM_EXCLUSION_REASONS)[number]

export type DnaV2ClaimRealPassageBinding = Readonly<{
  legacyClaimId: string
  passageId: string
  passageSha256: string
  sourceId: string
  sourceSha256: string
  releaseStatus: "release_eligible"
  auditEvidenceSha256: string
}>

export type DnaV2ClaimReauditRecord = Readonly<{
  auditId: string
  legacyClaimId: string
  legacyClaimSha256: string
  topicId: string
  sourceIds: readonly string[]
  passageIds: readonly string[]
  status: Extract<DnaV3ReleaseStatus, "quarantined" | "release_eligible">
  v3Eligible: boolean
  exclusionReasons: readonly DnaV2ClaimExclusionReason[]
  auditEvidenceSha256: string | null
}>

export type DnaV2CatalogReaudit = Readonly<{
  schemaVersion: typeof DNA_V2_CATALOG_REAUDIT_VERSION
  auditedAt: typeof DNA_V2_CATALOG_REAUDIT_DATE
  v2MutationPerformed: false
  claims: readonly DnaV2ClaimReauditRecord[]
  counts: Readonly<{
    auditedClaims: number
    releaseEligibleClaims: number
    quarantinedClaims: number
    missingRealPassage: number
    legacyExpertPending: number
  }>
  sourceAudit: Readonly<{
    totalSources: number
    referencedByClaims: number
    referencedAnywhere: number
    unusedForClaimIds: readonly string[]
    orphanSourceIds: readonly string[]
  }>
  snapshotSha256: string
}>

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const STABLE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,159}$/

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

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  }
  return value
}

function requireStableId(value: string, code: string): string {
  const normalized = String(value || "").trim()
  if (!STABLE_ID_PATTERN.test(normalized)) throw new Error(code)
  return normalized
}

function requireSha256(value: string, code: string): string {
  const normalized = String(value || "").trim().toLowerCase()
  if (!SHA256_PATTERN.test(normalized)) throw new Error(code)
  return normalized
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort((left, right) => left.localeCompare(right, "en")))
}

function assertUniqueIds(values: readonly { readonly id: string }[], code: string): void {
  const ids = values.map((value) => requireStableId(value.id, code))
  if (new Set(ids).size !== ids.length) throw new Error(code)
}

function claimPayload(claim: DnaChatCatalogClaim): unknown {
  return {
    id: claim.id,
    topicId: claim.topicId,
    text: claim.text,
    detail: claim.detail,
    sourceIds: [...claim.sourceIds].sort((left, right) => left.localeCompare(right, "en")),
    evidenceLevel: claim.evidenceLevel,
    ageScope: claim.ageScope,
    claimType: claim.claimType,
    dnaRelation: claim.dnaRelation,
    safetyStatus: claim.safetyStatus,
    sourceVerified: claim.sourceVerified,
  }
}

function assertBinding(binding: DnaV2ClaimRealPassageBinding): void {
  requireStableId(binding.legacyClaimId, "dna_v2_reaudit_invalid_binding_claim_id")
  requireStableId(binding.passageId, "dna_v2_reaudit_invalid_binding_passage_id")
  requireStableId(binding.sourceId, "dna_v2_reaudit_invalid_binding_source_id")
  requireSha256(binding.passageSha256, "dna_v2_reaudit_invalid_binding_passage_sha256")
  requireSha256(binding.sourceSha256, "dna_v2_reaudit_invalid_binding_source_sha256")
  requireSha256(binding.auditEvidenceSha256, "dna_v2_reaudit_invalid_binding_evidence_sha256")
  if (binding.releaseStatus !== "release_eligible") {
    throw new Error("dna_v2_reaudit_binding_not_release_eligible")
  }
}

type DnaV2CatalogReauditInput = Readonly<{
  claims: readonly DnaChatCatalogClaim[]
  relations: readonly DnaChatCatalogRelation[]
  topics: readonly DnaChatCatalogTopic[]
  sources: readonly DnaChatCatalogSource[]
}>

function evaluateDnaV2CatalogReaudit(input: DnaV2CatalogReauditInput & Readonly<{
  realPassageBindings: readonly DnaV2ClaimRealPassageBinding[]
}>): DnaV2CatalogReaudit {
  assertUniqueIds(input.claims, "dna_v2_reaudit_duplicate_claim_id")
  assertUniqueIds(input.relations, "dna_v2_reaudit_duplicate_relation_id")
  assertUniqueIds(input.topics, "dna_v2_reaudit_duplicate_topic_id")
  assertUniqueIds(input.sources, "dna_v2_reaudit_duplicate_source_id")

  const claimIds = new Set(input.claims.map((claim) => claim.id))
  const sourceIds = new Set(input.sources.map((source) => source.id))
  const topicsById = new Map(input.topics.map((topic) => [topic.id, topic]))
  const bindingsByClaim = new Map<string, DnaV2ClaimRealPassageBinding[]>()
  const bindingKeys = new Set<string>()
  for (const binding of input.realPassageBindings) {
    assertBinding(binding)
    if (!claimIds.has(binding.legacyClaimId)) {
      throw new Error("dna_v2_reaudit_binding_unknown_claim")
    }
    if (!sourceIds.has(binding.sourceId)) {
      throw new Error("dna_v2_reaudit_binding_unknown_source")
    }
    const key = `${binding.legacyClaimId}\u0000${binding.passageId}`
    if (bindingKeys.has(key)) throw new Error("dna_v2_reaudit_duplicate_binding")
    bindingKeys.add(key)
    const current = bindingsByClaim.get(binding.legacyClaimId) ?? []
    current.push(binding)
    bindingsByClaim.set(binding.legacyClaimId, current)
  }

  const records = [...input.claims]
    .sort((left, right) => left.id.localeCompare(right.id, "en"))
    .map((claim): DnaV2ClaimReauditRecord => {
      const sourceReferences = uniqueSorted(claim.sourceIds)
      const missingSources = sourceReferences.filter((sourceId) => !sourceIds.has(sourceId))
      const topic = topicsById.get(claim.topicId)
      const bindings = (bindingsByClaim.get(claim.id) ?? [])
        .sort((left, right) => left.passageId.localeCompare(right.passageId, "en"))
      const validBindings = bindings.filter((binding) =>
        sourceReferences.includes(binding.sourceId)
        && binding.releaseStatus === "release_eligible")
      const reasons: DnaV2ClaimExclusionReason[] = []

      if (validBindings.length === 0) reasons.push("missing_real_passage")
      if (sourceReferences.length > 0 && bindings.length === 0) {
        reasons.push("legacy_source_id_is_not_passage_evidence")
      }
      if (topic?.reviewStatus === "source_verified_expert_pending") {
        reasons.push("legacy_expert_pending")
      }
      if (missingSources.length > 0) reasons.push("source_reference_missing")
      if (!topic) reasons.push("topic_reference_missing")
      if (bindings.length > validBindings.length) reasons.push("binding_not_release_eligible")

      const v3Eligible = reasons.length === 0
      const core = {
        auditId: `reaudit.${claim.id}`,
        legacyClaimId: claim.id,
        legacyClaimSha256: sha256(claimPayload(claim)),
        topicId: claim.topicId,
        sourceIds: sourceReferences,
        passageIds: uniqueSorted(validBindings.map((binding) => binding.passageId)),
        status: v3Eligible ? "release_eligible" as const : "quarantined" as const,
        v3Eligible,
        exclusionReasons: uniqueSorted(reasons) as readonly DnaV2ClaimExclusionReason[],
        auditEvidenceSha256: v3Eligible ? sha256(validBindings) : null,
      }
      return deepFreeze(core)
    })

  const claimSourceIds = new Set(input.claims.flatMap((claim) => claim.sourceIds))
  const anyReferenceIds = new Set([
    ...input.claims.flatMap((claim) => claim.sourceIds),
    ...input.relations.flatMap((relation) => relation.sourceIds),
    ...input.topics.flatMap((topic) => topic.sourceIds),
  ])
  const allSourceIds = [...sourceIds].sort((left, right) => left.localeCompare(right, "en"))
  const core = {
    schemaVersion: DNA_V2_CATALOG_REAUDIT_VERSION,
    auditedAt: DNA_V2_CATALOG_REAUDIT_DATE,
    v2MutationPerformed: false as const,
    claims: records,
    counts: {
      auditedClaims: records.length,
      releaseEligibleClaims: records.filter((record) => record.v3Eligible).length,
      quarantinedClaims: records.filter((record) => !record.v3Eligible).length,
      missingRealPassage: records.filter((record) =>
        record.exclusionReasons.includes("missing_real_passage")).length,
      legacyExpertPending: records.filter((record) =>
        record.exclusionReasons.includes("legacy_expert_pending")).length,
    },
    sourceAudit: {
      totalSources: input.sources.length,
      referencedByClaims: allSourceIds.filter((sourceId) => claimSourceIds.has(sourceId)).length,
      referencedAnywhere: allSourceIds.filter((sourceId) => anyReferenceIds.has(sourceId)).length,
      unusedForClaimIds: allSourceIds.filter((sourceId) => !claimSourceIds.has(sourceId)),
      orphanSourceIds: allSourceIds.filter((sourceId) => !anyReferenceIds.has(sourceId)),
    },
  }
  return deepFreeze({ ...core, snapshotSha256: sha256(core) })
}

function canonicalReleasedV2Bindings(
  input: DnaV2CatalogReauditInput,
): readonly DnaV2ClaimRealPassageBinding[] {
  const claimById = new Map(input.claims.map((claim) => [claim.id, claim]))
  const sourceById = new Map(input.sources.map((source) => [source.id, source]))
  return Object.freeze(DNA_CURRENT_V3_RELEASE_PACKAGE.releasedCandidates.flatMap((released) => {
    if (released.authority !== "external_scientific_information") return []
    const claim = claimById.get(released.claimId)
    const source = sourceById.get(released.sourceId)
    if (!claim || !source
      || sha256(claimPayload(claim)) !== released.claimSha256
      || sha256(source) !== released.sourceSha256
      || !claim.sourceIds.includes(released.sourceId)) return []
    return [Object.freeze({
      legacyClaimId: released.claimId,
      passageId: released.passageId,
      passageSha256: released.passageSha256,
      sourceId: released.sourceId,
      sourceSha256: released.sourceSha256,
      releaseStatus: "release_eligible" as const,
      auditEvidenceSha256: released.authorizationDigest,
    })]
  }))
}

/**
 * Production re-audit. Passage authority is derived only from the canonical
 * Phase-27 release package; request/caller supplied bindings are impossible.
 */
export function reauditDnaV2Catalog(
  input: DnaV2CatalogReauditInput,
): DnaV2CatalogReaudit {
  return evaluateDnaV2CatalogReaudit({
    ...input,
    realPassageBindings: canonicalReleasedV2Bindings(input),
  })
}

/** Explicit non-production seam used to prove positive and replay paths. */
export function reauditDnaV2CatalogForTest(
  input: DnaV2CatalogReauditInput & Readonly<{
    realPassageBindings: readonly DnaV2ClaimRealPassageBinding[]
  }>,
): DnaV2CatalogReaudit {
  if (process.env.NODE_ENV === "production"
    || process.env.DNA_V2_REAUDIT_TEST_FIXTURE !== "1") {
    throw new Error("dna_v2_reaudit_test_bindings_forbidden")
  }
  return evaluateDnaV2CatalogReaudit(input)
}

export const DNA_CURRENT_V2_CATALOG_REAUDIT = reauditDnaV2Catalog({
  claims: DNA_CHAT_CATALOG_CLAIMS,
  relations: DNA_CHAT_CATALOG_RELATIONS,
  topics: DNA_CHAT_CATALOG_TOPICS,
  sources: DNA_CHAT_CATALOG_SOURCES,
})

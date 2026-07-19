import { createHash } from "node:crypto"
import { existsSync, realpathSync, statSync } from "node:fs"
import { resolve, sep } from "node:path"

export const DNA_SOURCE_INTEGRITY_VERSION = "dna-source-integrity@1" as const
export const DNA_SOURCE_IMPACT_VERSION = "dna-source-integrity-impact@1" as const
export const DNA_SOURCE_ACQUISITION_LEDGER_VERSION = "dna-source-acquisition-ledger@1" as const

export const DNA_SOURCE_INTEGRITY_STATES = [
  "verified_clean",
  "corrected",
  "superseded",
  "pending",
  "quarantined",
  "withdrawn",
] as const

export type DnaSourceIntegrityState = (typeof DNA_SOURCE_INTEGRITY_STATES)[number]
export type DnaIntegrityCheckState = "matched" | "mismatched" | "not_reported" | "not_applicable"
export type DnaIntegrityAuthorityState = "checked" | "unavailable" | "not_applicable"

export const DNA_SOURCE_UPDATE_TYPES = [
  "addendum",
  "clarification",
  "correction",
  "corrigendum",
  "erratum",
  "expression_of_concern",
  "new_edition",
  "new_version",
  "partial_retraction",
  "removal",
  "reinstatement",
  "retraction",
  "withdrawal",
  "unknown",
] as const

export type DnaSourceUpdateType = (typeof DNA_SOURCE_UPDATE_TYPES)[number]
export type DnaSourceUpdateAuthority =
  | "crossref_publisher"
  | "crossref_retraction_watch"
  | "crossmark"
  | "pubmed"
  | "europe_pmc"

export function normalizeDnaSourceUpdateType(value: string): DnaSourceUpdateType {
  const normalized = String(value || "unknown").toLowerCase().trim().replace(/[ -]+/g, "_")
  if (/^expression_of_concern(?:_|$)/.test(normalized)) return "expression_of_concern"
  if (/^partial_retraction(?:_|$)/.test(normalized)) return "partial_retraction"
  if (/^retraction(?:_|$)/.test(normalized)) return "retraction"
  if (/^withdrawal(?:_|$)/.test(normalized)) return "withdrawal"
  if (/^removal(?:_|$)/.test(normalized)) return "removal"
  if (/^erratum(?:_|$)/.test(normalized)) return "erratum"
  if (/^corrigendum(?:_|$)/.test(normalized)) return "corrigendum"
  if (/^(?:correction|corrected_article)(?:_|$)/.test(normalized)) return "correction"
  if (/^clarification(?:_|$)/.test(normalized)) return "clarification"
  if (/^addendum(?:_|$)/.test(normalized)) return "addendum"
  if (/^new_version(?:_|$)/.test(normalized)) return "new_version"
  if (/^new_edition(?:_|$)/.test(normalized)) return "new_edition"
  if (/^reinstatement(?:_|$)/.test(normalized)) return "reinstatement"
  return "unknown"
}

export function inferDnaSourceUpdateDirection(
  value: string,
): "updates_source" | "source_updates_other" {
  const normalized = String(value || "").toLowerCase()
  return /\b(?:in|by)\b/.test(normalized) ? "updates_source" : "source_updates_other"
}

export type DnaSourceIntegrityUpdate = Readonly<{
  type: DnaSourceUpdateType
  authority: DnaSourceUpdateAuthority
  direction: "updates_source" | "source_updates_other"
  noticeId: string | null
  noticeUrl: string | null
  observedAt: string | null
}>

export type DnaSourceIntegrityHistoryEntry = Readonly<{
  state: DnaSourceIntegrityState
  effectiveAt: string
  reasonCodes: readonly string[]
}>

export type DnaSourceIntegrityInput = Readonly<{
  sourceId: string
  checkedAt: string
  publicationKind: "article" | "book" | "guideline" | "other"
  expected: Readonly<{
    title: string
    doi: string | null
    venue: string | null
    publisher: string | null
  }>
  observed: Readonly<{
    title: string | null
    doi: string | null
    venue: string | null
    publisher: string | null
  }>
  authorityCoverage: Readonly<{
    crossref: DnaIntegrityAuthorityState
    retractionWatch: DnaIntegrityAuthorityState
    crossmark: DnaIntegrityAuthorityState
    pubmed: DnaIntegrityAuthorityState
    europePmc: DnaIntegrityAuthorityState
  }>
  updates: readonly DnaSourceIntegrityUpdate[]
  publicationTypes: readonly string[]
  correctionResolution: "applied" | "not_applicable" | "pending"
  reinstatementReview?: Readonly<{
    status: "verified"
    reviewedAt: string
    evidenceId: string
  }> | null
  priorHistory?: readonly DnaSourceIntegrityHistoryEntry[]
}>

export type DnaSourceIntegrityRecord = Readonly<{
  schemaVersion: typeof DNA_SOURCE_INTEGRITY_VERSION
  sourceId: string
  checkedAt: string
  state: DnaSourceIntegrityState
  runtimeEligibility: "eligible" | "blocked_pending" | "blocked_quarantined" | "blocked_withdrawn"
  identityChecks: Readonly<{
    title: DnaIntegrityCheckState
    doi: DnaIntegrityCheckState
    venue: DnaIntegrityCheckState
    publisher: DnaIntegrityCheckState
  }>
  authorityCoverage: DnaSourceIntegrityInput["authorityCoverage"]
  updates: readonly DnaSourceIntegrityUpdate[]
  publicationTypes: readonly string[]
  reasonCodes: readonly string[]
  history: readonly DnaSourceIntegrityHistoryEntry[]
  auditSha256: string
}>

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

function canonicalDoi(value: string | null): string {
  return String(value || "").trim().replace(/^doi\s*:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").replace(/[.,;:]+$/, "").toLowerCase()
}

function canonicalText(value: string | null): string {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/&(?:amp|#38);/g, "and").replace(/[^a-z0-9]+/g, " ")
    .trim().replace(/\s+/g, " ")
}

function textMatches(expected: string, observed: string): boolean {
  const left = canonicalText(expected)
  const right = canonicalText(observed)
  if (!left || !right) return false
  if (left === right) return true
  const leftTokens = new Set(left.split(" "))
  const rightTokens = new Set(right.split(" "))
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length
  const union = new Set([...leftTokens, ...rightTokens]).size
  return intersection / Math.max(1, union) >= 0.9
}

function compareText(expected: string | null, observed: string | null, notApplicable = false): DnaIntegrityCheckState {
  if (notApplicable) return "not_applicable"
  if (!expected || !observed) return "not_reported"
  return textMatches(expected, observed) ? "matched" : "mismatched"
}

function compareOrganization(expected: string | null, observed: string | null): DnaIntegrityCheckState {
  if (!expected || !observed) return "not_reported"
  const ignored = new Set(["ag", "bv", "inc", "llc", "ltd", "limited", "media", "plc", "sa"])
  const tokens = (value: string) => canonicalText(value).split(" ").filter((token) => token && !ignored.has(token))
  const left = tokens(expected)
  const right = tokens(observed)
  if (left.join(" ") === right.join(" ")) return "matched"
  const rightSet = new Set(right)
  const intersection = left.filter((token) => rightSet.has(token)).length
  return intersection / Math.max(1, Math.min(left.length, right.length)) >= 0.9 ? "matched" : "mismatched"
}

function compareVenue(expected: string | null, observed: string | null): DnaIntegrityCheckState {
  if (!expected || !observed) return "not_reported"
  const left = canonicalText(expected).split(" ").filter(Boolean)
  const right = canonicalText(observed).split(" ").filter(Boolean)
  const tokenMatches = (a: string, b: string) => a === b
    || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)))
  const matched = left.filter((token) => right.some((candidate) => tokenMatches(token, candidate))).length
  return matched / Math.max(1, Math.min(left.length, right.length)) >= 0.9 ? "matched" : "mismatched"
}

function compareDoi(expected: string | null, observed: string | null): DnaIntegrityCheckState {
  if (!expected) return "not_applicable"
  if (!observed) return "not_reported"
  return canonicalDoi(expected) === canonicalDoi(observed) ? "matched" : "mismatched"
}

function updateSortKey(update: DnaSourceIntegrityUpdate): string {
  return [update.direction, update.type, update.authority, update.noticeId || "", update.observedAt || ""].join("|")
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort())
}

function validAuditDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) && Number.isFinite(Date.parse(value))
}

function transitionHistory(
  prior: readonly DnaSourceIntegrityHistoryEntry[],
  state: DnaSourceIntegrityState,
  checkedAt: string,
  reasonCodes: readonly string[],
): readonly DnaSourceIntegrityHistoryEntry[] {
  const history = prior.map((entry) => Object.freeze({
    state: entry.state,
    effectiveAt: entry.effectiveAt,
    reasonCodes: uniqueSorted(entry.reasonCodes),
  }))
  const previous = history.at(-1)
  const nextReasons = uniqueSorted(reasonCodes)
  if (!previous || previous.state !== state || stableJson(previous.reasonCodes) !== stableJson(nextReasons)) {
    history.push(Object.freeze({ state, effectiveAt: checkedAt, reasonCodes: nextReasons }))
  }
  return Object.freeze(history)
}

/**
 * Pure, deterministic and fail-closed integrity evaluation. Authority fetches
 * happen in the offline auditor; this module never performs runtime network I/O.
 */
export function evaluateDnaSourceIntegrity(input: DnaSourceIntegrityInput): DnaSourceIntegrityRecord {
  if (!input.sourceId.trim()) throw new Error("dna_source_integrity_source_id_required")
  if (!validAuditDate(input.checkedAt)) {
    throw new Error("dna_source_integrity_checked_at_invalid")
  }

  const identityChecks = Object.freeze({
    title: compareText(input.expected.title, input.observed.title),
    doi: compareDoi(input.expected.doi, input.observed.doi),
    venue: input.publicationKind === "book" && !input.expected.venue
      ? "not_applicable" as const
      : compareVenue(input.expected.venue, input.observed.venue),
    publisher: compareOrganization(input.expected.publisher, input.observed.publisher),
  })
  const updates = Object.freeze([...input.updates]
    .map((update) => Object.freeze({ ...update }))
    .sort((left, right) => updateSortKey(left).localeCompare(updateSortKey(right))))
  const publicationTypes = uniqueSorted(input.publicationTypes.map((value) => value.trim()).filter(Boolean))
  const normalizedPublicationTypes = publicationTypes.map(canonicalText)
  const updateTypes = new Set(updates
    .filter((update) => update.direction === "updates_source")
    .map((update) => update.type))
  const reasonCodes: string[] = []

  const titleRetractionMarker = /^(?:retracted|withdrawn|removed)(?:\s+article)?\b/
    .test(canonicalText(input.observed.title))
  const retractionSignal = updateTypes.has("retraction")
    || updateTypes.has("partial_retraction")
    || updateTypes.has("withdrawal")
    || updateTypes.has("removal")
    || normalizedPublicationTypes.some((value) => value === "retracted publication")
    || titleRetractionMarker
  const expressionOfConcern = updateTypes.has("expression_of_concern")
    || normalizedPublicationTypes.some((value) => value === "expression of concern")
  const superseded = updateTypes.has("new_version") || updateTypes.has("new_edition")
  const correction = updateTypes.has("correction") || updateTypes.has("corrigendum")
    || updateTypes.has("erratum") || updateTypes.has("clarification") || updateTypes.has("addendum")
  const unknownUpdate = updateTypes.has("unknown")
  const reinstatement = updateTypes.has("reinstatement")
  const previousWithdrawal = (input.priorHistory || []).some((entry) => entry.state === "withdrawn")
  const reinstatementReview = input.reinstatementReview
  const lastWithdrawalAt = [...(input.priorHistory || [])].reverse()
    .find((entry) => entry.state === "withdrawn")?.effectiveAt
  const verifiedReinstatement = reinstatement
    && reinstatementReview?.status === "verified"
    && validAuditDate(reinstatementReview.reviewedAt)
    && (!lastWithdrawalAt || Date.parse(reinstatementReview.reviewedAt) >= Date.parse(lastWithdrawalAt))
    && Boolean(reinstatementReview.evidenceId.trim())
  // A withdrawal is sticky. A transiently missing authority marker must never
  // reactivate the source; only an explicit, evidence-bound reinstatement review can.
  const retracted = (retractionSignal || previousWithdrawal) && !verifiedReinstatement
  const criticalIdentityMismatch = identityChecks.title === "mismatched"
    || identityChecks.doi === "mismatched" || identityChecks.venue === "mismatched"
  const publisherMismatch = identityChecks.publisher === "mismatched"
  const unverifiableIdentity = Object.entries(identityChecks)
    .some(([, value]) => value === "not_reported")

  if (retracted) reasonCodes.push("retraction_or_withdrawal_detected")
  if (previousWithdrawal && !retractionSignal && !verifiedReinstatement) {
    reasonCodes.push("historical_withdrawal_sticky")
  }
  if (expressionOfConcern) reasonCodes.push("expression_of_concern_detected")
  if (superseded) reasonCodes.push("superseded_version_detected")
  if (correction && input.correctionResolution !== "applied") reasonCodes.push("correction_unresolved")
  if (unknownUpdate) reasonCodes.push("unclassified_update_signal")
  if (reinstatement && !verifiedReinstatement) reasonCodes.push("reinstatement_requires_review")
  if (input.reinstatementReview && !verifiedReinstatement) {
    reasonCodes.push("reinstatement_review_invalid")
  }
  if (criticalIdentityMismatch) reasonCodes.push("bibliographic_identity_mismatch")
  if (publisherMismatch) reasonCodes.push("publisher_consistency_mismatch")
  if (unverifiableIdentity) reasonCodes.push("bibliographic_identity_unverifiable")

  const requiredAuthorities: Array<[string, DnaIntegrityAuthorityState]> = [
    ["crossref", input.authorityCoverage.crossref],
    ["retraction_watch", input.authorityCoverage.retractionWatch],
    ["crossmark", input.authorityCoverage.crossmark],
    ["pubmed", input.authorityCoverage.pubmed],
    ["europe_pmc", input.authorityCoverage.europePmc],
  ]
  for (const [authority, state] of requiredAuthorities) {
    if (state === "unavailable") reasonCodes.push(`${authority}_unverifiable`)
  }

  let state: DnaSourceIntegrityState
  if (retracted) state = "withdrawn"
  else if (expressionOfConcern || criticalIdentityMismatch) state = "quarantined"
  else if (superseded) state = "superseded"
  else if (reasonCodes.length > 0) state = "pending"
  else if (correction) state = "corrected"
  else state = "verified_clean"

  const sortedReasons = uniqueSorted(reasonCodes)
  const history = transitionHistory(input.priorHistory || [], state, input.checkedAt, sortedReasons)
  const body = {
    schemaVersion: DNA_SOURCE_INTEGRITY_VERSION,
    sourceId: input.sourceId,
    checkedAt: input.checkedAt,
    state,
    runtimeEligibility: state === "verified_clean" || state === "corrected"
      ? "eligible" as const
      : state === "withdrawn"
        ? "blocked_withdrawn" as const
        : state === "quarantined"
          ? "blocked_quarantined" as const
          : "blocked_pending" as const,
    identityChecks,
    authorityCoverage: Object.freeze({ ...input.authorityCoverage }),
    updates,
    publicationTypes,
    reasonCodes: sortedReasons,
    history,
  }
  return Object.freeze({ ...body, auditSha256: sha256(body) })
}

export type DnaIntegrityImpactGraph = Readonly<{
  passages: readonly Readonly<{ id: string; sourceId: string }>[]
  claims: readonly Readonly<{ id: string; passageIds: readonly string[] }>[]
  relations: readonly Readonly<{ id: string; claimIds: readonly string[] }>[]
  answers: readonly Readonly<{
    id: string
    relationIds: readonly string[]
    claimIds?: readonly string[]
    /** Explicit groups whose members are independently sufficient alternatives. */
    alternativeRelationGroups?: readonly (readonly string[])[]
  }>[]
}>

export type DnaIntegrityAnswerImpact = Readonly<{
  answerId: string
  state: "unaffected" | "available_with_safe_alternative" | "not_available"
  affectedSourceIds: readonly string[]
  safeAlternativeSourceIds: readonly string[]
}>

export type DnaIntegrityImpactResult = Readonly<{
  schemaVersion: typeof DNA_SOURCE_IMPACT_VERSION
  valid: boolean
  reasonCodes: readonly string[]
  affectedSourceIds: readonly string[]
  affectedPassageIds: readonly string[]
  affectedClaimIds: readonly string[]
  affectedRelationIds: readonly string[]
  answers: readonly DnaIntegrityAnswerImpact[]
  auditSha256: string
}>

/** Deterministic source -> passage -> claim -> relation -> answer withdrawal traversal. */
export function traverseDnaSourceIntegrityImpact(input: {
  integrityRecords: readonly DnaSourceIntegrityRecord[]
  graph: DnaIntegrityImpactGraph
}): DnaIntegrityImpactResult {
  const graphReasons: string[] = []
  const expectedEligibility = (record: DnaSourceIntegrityRecord): DnaSourceIntegrityRecord["runtimeEligibility"] =>
    record.state === "verified_clean" || record.state === "corrected"
      ? "eligible"
      : record.state === "withdrawn"
        ? "blocked_withdrawn"
        : record.state === "quarantined"
          ? "blocked_quarantined"
          : "blocked_pending"
  const integrityRecordValid = (record: DnaSourceIntegrityRecord): boolean => {
    const body = {
      schemaVersion: record.schemaVersion,
      sourceId: record.sourceId,
      checkedAt: record.checkedAt,
      state: record.state,
      runtimeEligibility: record.runtimeEligibility,
      identityChecks: record.identityChecks,
      authorityCoverage: record.authorityCoverage,
      updates: record.updates,
      publicationTypes: record.publicationTypes,
      reasonCodes: record.reasonCodes,
      history: record.history,
    }
    const latestHistory = record.history.at(-1)
    return record.schemaVersion === DNA_SOURCE_INTEGRITY_VERSION
      && Boolean(record.sourceId.trim())
      && (DNA_SOURCE_INTEGRITY_STATES as readonly string[]).includes(record.state)
      && validAuditDate(record.checkedAt)
      && record.runtimeEligibility === expectedEligibility(record)
      && Boolean(latestHistory)
      && latestHistory?.state === record.state
      && stableJson(latestHistory?.reasonCodes) === stableJson(record.reasonCodes)
      && sha256(body) === record.auditSha256
  }
  if (input.integrityRecords.some((record) => !integrityRecordValid(record))) {
    graphReasons.push("integrity_record_invalid")
  }
  const duplicateIds = <T>(items: readonly T[], id: (item: T) => string): string[] => {
    const seen = new Set<string>()
    const duplicates = new Set<string>()
    for (const item of items) {
      const value = id(item)
      if (!value || seen.has(value)) duplicates.add(value || "<empty>")
      seen.add(value)
    }
    return [...duplicates].sort()
  }
  for (const [kind, values] of [
    ["source", duplicateIds(input.integrityRecords, (record) => record.sourceId)],
    ["passage", duplicateIds(input.graph.passages, (item) => item.id)],
    ["claim", duplicateIds(input.graph.claims, (item) => item.id)],
    ["relation", duplicateIds(input.graph.relations, (item) => item.id)],
    ["answer", duplicateIds(input.graph.answers, (item) => item.id)],
  ] as const) {
    if (values.length > 0) graphReasons.push(`duplicate_${kind}_id`)
  }
  const integritySourceIds = new Set(input.integrityRecords.map((record) => record.sourceId))
  const unverifiedGraphSourceIds = new Set(input.graph.passages
    .map((passage) => passage.sourceId).filter((sourceId) => !integritySourceIds.has(sourceId)))
  const passageIds = new Set(input.graph.passages.map((passage) => passage.id))
  const claimIdsInGraph = new Set(input.graph.claims.map((claim) => claim.id))
  const relationIdsInGraph = new Set(input.graph.relations.map((relation) => relation.id))
  if (input.graph.passages.some((passage) => !integritySourceIds.has(passage.sourceId))) {
    graphReasons.push("passage_source_integrity_record_missing")
  }
  if (input.graph.claims.some((claim) => claim.passageIds.length === 0
    || claim.passageIds.some((id) => !passageIds.has(id)))) {
    graphReasons.push("claim_passage_reference_invalid")
  }
  if (input.graph.relations.some((relation) => relation.claimIds.length === 0
    || relation.claimIds.some((id) => !claimIdsInGraph.has(id)))) {
    graphReasons.push("relation_claim_reference_invalid")
  }
  if (input.graph.answers.some((answer) => (answer.relationIds.length === 0
    && (answer.claimIds || []).length === 0)
    || answer.relationIds.some((id) => !relationIdsInGraph.has(id))
    || (answer.claimIds || []).some((id) => !claimIdsInGraph.has(id))
    || (answer.alternativeRelationGroups || []).some((group) => group.length < 2
      || group.some((id) => !answer.relationIds.includes(id))))) {
    graphReasons.push("answer_support_reference_invalid")
  }
  const sortedGraphReasons = uniqueSorted(graphReasons)
  const graphValid = sortedGraphReasons.length === 0
  const blockedSources = new Set(input.integrityRecords
    .filter((record) => record.runtimeEligibility !== "eligible")
    .map((record) => record.sourceId))
  for (const sourceId of unverifiedGraphSourceIds) blockedSources.add(sourceId)
  const eligibleSources = new Set(input.integrityRecords
    .filter((record) => record.runtimeEligibility === "eligible")
    .map((record) => record.sourceId))
  const passagesById = new Map(input.graph.passages.map((passage) => [passage.id, passage]))
  const claimsById = new Map(input.graph.claims.map((claim) => [claim.id, claim]))
  const relationsById = new Map(input.graph.relations.map((relation) => [relation.id, relation]))
  const affectedPassages = new Set(input.graph.passages
    .filter((passage) => blockedSources.has(passage.sourceId)).map((passage) => passage.id))
  const affectedClaims = new Set(input.graph.claims
    .filter((claim) => claim.passageIds.some((id) => affectedPassages.has(id))).map((claim) => claim.id))
  const affectedRelations = new Set(input.graph.relations
    .filter((relation) => relation.claimIds.some((id) => affectedClaims.has(id))).map((relation) => relation.id))

  function sourceIdsForClaims(claimIds: readonly string[]): string[] {
    const output = new Set<string>()
    for (const claimId of claimIds) {
      const claim = claimsById.get(claimId)
      for (const passageId of claim?.passageIds || []) {
        const sourceId = passagesById.get(passageId)?.sourceId
        if (sourceId) output.add(sourceId)
      }
    }
    return [...output].sort()
  }

  const answers = [...input.graph.answers].sort((a, b) => a.id.localeCompare(b.id)).map((answer) => {
    const claimIds = new Set(answer.claimIds || [])
    for (const relationId of answer.relationIds) {
      for (const claimId of relationsById.get(relationId)?.claimIds || []) claimIds.add(claimId)
    }
    const sourceIds = sourceIdsForClaims([...claimIds])
    const affectedSourceIds = sourceIds.filter((sourceId) => blockedSources.has(sourceId))
    const safeAlternativeRelationIds = new Set<string>()
    const coveredAffectedRelationIds = new Set<string>()
    for (const group of answer.alternativeRelationGroups || []) {
      const affectedGroupMembers = group.filter((relationId) => affectedRelations.has(relationId))
      const safeGroupMembers = group.filter((relationId) => !affectedRelations.has(relationId))
      const groupHasAffectedMember = affectedGroupMembers.length > 0
      if (!groupHasAffectedMember) continue
      if (safeGroupMembers.length > 0) {
        for (const relationId of affectedGroupMembers) coveredAffectedRelationIds.add(relationId)
        for (const relationId of safeGroupMembers) safeAlternativeRelationIds.add(relationId)
      }
    }
    const affectedAnswerRelationIds = answer.relationIds.filter((relationId) => affectedRelations.has(relationId))
    const affectedDirectClaimIds = (answer.claimIds || []).filter((claimId) => affectedClaims.has(claimId))
    const everyAffectedSupportReplaced = affectedDirectClaimIds.length === 0
      && affectedAnswerRelationIds.every((relationId) => coveredAffectedRelationIds.has(relationId))
    const explicitlyIndependentSafeSourceIds = sourceIdsForClaims([...safeAlternativeRelationIds]
      .flatMap((relationId) => relationsById.get(relationId)?.claimIds || []))
      .filter((sourceId) => eligibleSources.has(sourceId))
    const state = !graphValid
      ? "not_available" as const
      : affectedSourceIds.length === 0
      ? "unaffected" as const
      : everyAffectedSupportReplaced && explicitlyIndependentSafeSourceIds.length > 0
        ? "available_with_safe_alternative" as const
        : "not_available" as const
    return Object.freeze({
      answerId: answer.id,
      state,
      affectedSourceIds,
      safeAlternativeSourceIds: state === "available_with_safe_alternative"
        ? explicitlyIndependentSafeSourceIds
        : Object.freeze([] as string[]),
    })
  })
  const body = {
    schemaVersion: DNA_SOURCE_IMPACT_VERSION,
    valid: graphValid,
    reasonCodes: sortedGraphReasons,
    affectedSourceIds: Object.freeze([...blockedSources].sort()),
    affectedPassageIds: Object.freeze([...affectedPassages].sort()),
    affectedClaimIds: Object.freeze([...affectedClaims].sort()),
    affectedRelationIds: Object.freeze([...affectedRelations].sort()),
    answers: Object.freeze(answers),
  }
  return Object.freeze({ ...body, auditSha256: sha256(body) })
}

export type DnaAcquisitionMethod =
  | "official_publisher_download"
  | "institutional_repository_download"
  | "official_open_textbook_export"
  | "official_metadata_retrieval"
  | "unknown_legacy_acquisition"

export type DnaSourceAcquisitionLedgerEntry = Readonly<{
  sourceId: string
  relativePath: string
  sourceUrl: string
  downloadUrl: string
  downloadUrlEvidence: "explicit_artifact" | "official_access" | "deterministic_export_endpoint" | "curated_registry"
  acquiredAt: string
  mediaType: string
  bytes: number
  sha256: string
  license: string
  acquisitionMethod: DnaAcquisitionMethod
}>

export type DnaObservedAcquisitionArtifact = Readonly<{
  relativePath: string
  exists: boolean
  bytes: number | null
  sha256: string | null
  formatIntegrity: "passed" | "failed" | "not_applicable"
  rootContainment: "passed" | "failed"
}>

export type DnaAcquisitionLedgerDecision = Readonly<{
  sourceId: string
  relativePath: string
  accepted: boolean
  reasonCodes: readonly string[]
}>

export function isSafeDnaAcquisitionRelativePath(value: string): boolean {
  return Boolean(value) && !value.startsWith("/") && !value.includes("\\")
    && !value.split("/").some((part) => part === ".." || part === "." || part === "")
}

/** Resolve an existing regular artifact without permitting lexical or symlink escape. */
export function resolveDnaAcquisitionArtifactWithinRoot(root: string, relativePath: string): string {
  if (!isSafeDnaAcquisitionRelativePath(relativePath)) {
    throw new Error("dna_acquisition_artifact_path_unsafe")
  }
  if (!existsSync(root)) throw new Error("dna_acquisition_root_missing")
  const rootReal = realpathSync(root)
  const candidate = resolve(rootReal, relativePath)
  if (!(candidate === rootReal || candidate.startsWith(`${rootReal}${sep}`))) {
    throw new Error("dna_acquisition_artifact_root_escape")
  }
  if (!existsSync(candidate)) throw new Error("dna_acquisition_artifact_missing")
  const candidateReal = realpathSync(candidate)
  if (!(candidateReal === rootReal || candidateReal.startsWith(`${rootReal}${sep}`))) {
    throw new Error("dna_acquisition_artifact_root_escape")
  }
  if (!statSync(candidateReal).isFile()) throw new Error("dna_acquisition_artifact_not_regular_file")
  return candidateReal
}

export function verifyDnaSourceAcquisitionLedger(input: {
  entries: readonly DnaSourceAcquisitionLedgerEntry[]
  observedArtifacts: readonly DnaObservedAcquisitionArtifact[]
}): Readonly<{
  schemaVersion: typeof DNA_SOURCE_ACQUISITION_LEDGER_VERSION
  accepted: boolean
  entryCount: number
  acceptedCount: number
  rejectedCount: number
  decisions: readonly DnaAcquisitionLedgerDecision[]
  auditSha256: string
}> {
  const observationByPath = new Map(input.observedArtifacts.map((item) => [item.relativePath, item]))
  const duplicatePaths = new Set<string>()
  const seenPaths = new Set<string>()
  for (const entry of input.entries) {
    if (seenPaths.has(entry.relativePath)) duplicatePaths.add(entry.relativePath)
    seenPaths.add(entry.relativePath)
  }
  const decisions = [...input.entries].sort((a, b) => a.relativePath.localeCompare(b.relativePath)).map((entry) => {
    const reasons: string[] = []
    const observed = observationByPath.get(entry.relativePath)
    if (!entry.sourceId.trim()) reasons.push("source_id_missing")
    if (!isSafeDnaAcquisitionRelativePath(entry.relativePath)) reasons.push("unsafe_or_absolute_path")
    if (!/^https:\/\//i.test(entry.sourceUrl)) reasons.push("source_url_missing_or_insecure")
    if (!/^https:\/\//i.test(entry.downloadUrl)) reasons.push("download_url_missing_or_insecure")
    if (!["explicit_artifact", "official_access", "deterministic_export_endpoint", "curated_registry"]
      .includes(entry.downloadUrlEvidence)) reasons.push("download_url_evidence_invalid")
    if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(entry.acquiredAt)) reasons.push("acquisition_date_invalid")
    if (!entry.mediaType.trim()) reasons.push("media_type_missing")
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes <= 0) reasons.push("declared_bytes_invalid")
    if (!/^[a-f0-9]{64}$/.test(entry.sha256)) reasons.push("declared_sha256_invalid")
    if (!entry.license.trim()) reasons.push("license_missing")
    if (duplicatePaths.has(entry.relativePath)) reasons.push("duplicate_relative_path")
    if (!observed || observed.rootContainment !== "passed") reasons.push("artifact_root_containment_failed")
    if (!observed?.exists) reasons.push("artifact_missing")
    else {
      if (observed.bytes !== entry.bytes) reasons.push("artifact_bytes_mismatch")
      if (observed.sha256 !== entry.sha256) reasons.push("artifact_sha256_mismatch")
      if (/pdf|xml|epub/i.test(entry.mediaType) && observed.formatIntegrity !== "passed") {
        reasons.push("pdf_xml_or_epub_integrity_failed")
      }
    }
    return Object.freeze({
      sourceId: entry.sourceId,
      relativePath: entry.relativePath,
      accepted: reasons.length === 0,
      reasonCodes: uniqueSorted(reasons),
    })
  })
  const acceptedCount = decisions.filter((decision) => decision.accepted).length
  const body = {
    schemaVersion: DNA_SOURCE_ACQUISITION_LEDGER_VERSION,
    accepted: acceptedCount === decisions.length,
    entryCount: decisions.length,
    acceptedCount,
    rejectedCount: decisions.length - acceptedCount,
    decisions: Object.freeze(decisions),
  }
  return Object.freeze({ ...body, auditSha256: sha256(body) })
}

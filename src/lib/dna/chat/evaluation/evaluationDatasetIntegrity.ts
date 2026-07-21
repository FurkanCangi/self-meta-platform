import { createHash } from "node:crypto"

import {
  DNA_INTELLIGENCE_INTENDED_USE_VERSION,
  DNA_INTELLIGENCE_PROHIBITED_CAPABILITY_IDS,
} from "../intendedUse"

export const DNA_DEVELOPMENT_HISTORY_LEDGER_VERSION =
  "dna-development-history-ledger@1" as const
export const DNA_DEVELOPMENT_HISTORY_AUTHORITY_VERSION =
  "dna-development-history-authority@1" as const
export const DNA_SEMANTIC_FAMILY_REGISTRY_VERSION =
  "dna-semantic-family-registry@1" as const
export const DNA_EVALUATION_AUTHORITY_REGISTRY_VERSION =
  "dna-evaluation-authority-registry@1" as const
export const DNA_EVALUATION_REPORT_FIELD_CONTRACT_VERSION =
  "dna-evaluation-report-field-contract@1" as const
export const DNA_EVALUATION_UNSUPPORTED_BOUNDARY_REGISTRY_VERSION =
  "dna-evaluation-unsupported-boundary-registry@1" as const
export const DNA_EVALUATION_REQUIRED_SAFETY_POLICY_VERSION =
  DNA_INTELLIGENCE_INTENDED_USE_VERSION
export const DNA_QUESTION_APPROVAL_LEDGER_VERSION =
  "dna-benchmark-question-approval-ledger@1" as const
export const DNA_VARIATION_APPROVAL_LEDGER_VERSION =
  "dna-variation-approval-ledger@1" as const

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort((left, right) => left.localeCompare(right, "en"))
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex")
}

function assertSha256(value: string, code: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) throw new Error(code)
}

function assertIdentifier(value: string, code: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,199}$/.test(value)) throw new Error(code)
}

function assertIsoTimestamp(value: string, code: string): void {
  if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new Error(code)
  }
}

function assertExactKeys(value: object, expected: readonly string[], code: string): void {
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right, "en"))
  const wanted = [...expected].sort((left, right) => left.localeCompare(right, "en"))
  if (actual.length !== wanted.length
    || actual.some((key, index) => key !== wanted[index])) throw new Error(code)
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort((left, right) => left.localeCompare(right, "en")))
}

/**
 * Turkish-aware deterministic normalization used only for contamination and
 * family-integrity checks. It is deliberately local and does not call a model,
 * embedding service, network API or mutable synonym source.
 */
export function normalizeDnaEvaluationMeaning(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ç/g, "c").replace(/ö/g, "o").replace(/ü/g, "u")
    .replace(/\b(?:ne anlama gelir|ne demektir|ne demek|nasil tanimlanir)\b/g, "nedir")
    .replace(/\b(?:aciklar misin|aciklayabilir misin|anlatir misin)\b/g, "acikla")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

function editDistanceAtMostOne(left: string, right: string): boolean {
  if (left === right) return true
  if (Math.abs(left.length - right.length) > 1) return false
  if (/^\d+$/.test(left) || /^\d+$/.test(right)) return false
  let first = left
  let second = right
  if (first.length > second.length) [first, second] = [second, first]
  let edits = 0
  for (let i = 0, j = 0; i < first.length || j < second.length;) {
    if (first[i] === second[j]) {
      i += 1
      j += 1
      continue
    }
    edits += 1
    if (edits > 1) return false
    if (first.length === second.length) {
      i += 1
      j += 1
    } else {
      j += 1
    }
  }
  return edits === 1
}

type MeaningSignature = Readonly<{
  normalized: string
  tokens: readonly string[]
  tokenSet: ReadonlySet<string>
}>

function meaningSignature(value: string): MeaningSignature {
  const normalized = normalizeDnaEvaluationMeaning(value)
  const tokens = Object.freeze(normalized.split(" ").filter(Boolean))
  return Object.freeze({ normalized, tokens, tokenSet: new Set(tokens) })
}

function signaturesAreNearDuplicates(left: MeaningSignature, right: MeaningSignature): boolean {
  if (!left.normalized || !right.normalized) return false
  if (left.normalized === right.normalized) return true
  if (Math.abs(left.tokens.length - right.tokens.length) > 1) return false
  const denominator = Math.max(left.tokenSet.size, right.tokenSet.size)
  if (!denominator) return false
  const exactMatches = [...left.tokenSet].filter((token) => right.tokenSet.has(token)).length
  if (exactMatches / denominator >= 0.9) return true
  if (exactMatches / denominator < 0.45) return false

  const unmatchedRight = [...right.tokens]
  let fuzzyMatches = 0
  for (const token of left.tokens) {
    const exactIndex = unmatchedRight.indexOf(token)
    if (exactIndex >= 0) {
      fuzzyMatches += 1
      unmatchedRight.splice(exactIndex, 1)
      continue
    }
    const fuzzyIndex = unmatchedRight.findIndex((candidate) =>
      token.length >= 5 && candidate.length >= 5 && editDistanceAtMostOne(token, candidate))
    if (fuzzyIndex >= 0) {
      fuzzyMatches += 1
      unmatchedRight.splice(fuzzyIndex, 1)
    }
  }
  return fuzzyMatches / Math.max(left.tokens.length, right.tokens.length) >= 0.9
}

export function areDnaEvaluationMeaningsNearDuplicates(left: string, right: string): boolean {
  return signaturesAreNearDuplicates(meaningSignature(left), meaningSignature(right))
}

export type DnaDevelopmentHistoryQuestion = Readonly<{
  question: string
  semanticFamily: string
  sourcePackId: string
  sourceCode: string
  canonicalRow: string
}>

export type DnaDevelopmentHistoryEntry = Readonly<{
  id: string
  normalizedQuestion: string
  normalizedQuestionSha256: string
  semanticFamilyProvenanceSha256: string
  sourceProvenanceSha256: string
  sourcePackId: string
  sourceCode: string
  firstSeenAt: string
  batchId: string
  recordSha256: string
}>

export type DnaDevelopmentHistoryBatch = Readonly<{
  id: string
  appendedAt: string
  previousLedgerSha256: string | null
  entries: readonly DnaDevelopmentHistoryEntry[]
  batchSha256: string
}>

export type DnaDevelopmentHistoryLedger = Readonly<{
  schemaVersion: typeof DNA_DEVELOPMENT_HISTORY_LEDGER_VERSION
  batches: readonly DnaDevelopmentHistoryBatch[]
  ledgerSha256: string
}>

function developmentHistoryEntry(input: Readonly<{
  question: DnaDevelopmentHistoryQuestion
  batchId: string
  appendedAt: string
}>): DnaDevelopmentHistoryEntry {
  const normalizedQuestion = normalizeDnaEvaluationMeaning(input.question.question)
  const sourceProvenance = Object.freeze({
    sourcePackId: input.question.sourcePackId.trim(),
    sourceCode: input.question.sourceCode.trim(),
    canonicalRowSha256: sha256(input.question.canonicalRow.trim()),
  })
  const payload = Object.freeze({
    id: `devhist.${sha256({ ...sourceProvenance, normalizedQuestion }).slice(0, 40)}`,
    normalizedQuestion,
    normalizedQuestionSha256: sha256(normalizedQuestion),
    semanticFamilyProvenanceSha256: sha256(
      normalizeDnaEvaluationMeaning(input.question.semanticFamily),
    ),
    sourceProvenanceSha256: sha256(sourceProvenance),
    sourcePackId: sourceProvenance.sourcePackId,
    sourceCode: sourceProvenance.sourceCode,
    firstSeenAt: input.appendedAt,
    batchId: input.batchId,
  })
  return Object.freeze({ ...payload, recordSha256: sha256(payload) })
}

export function assertDnaDevelopmentHistoryLedger(
  ledger: DnaDevelopmentHistoryLedger,
): void {
  assertExactKeys(ledger, ["schemaVersion", "batches", "ledgerSha256"],
    "dna_evaluation_history_ledger_unknown_or_missing_field")
  if (ledger.schemaVersion !== DNA_DEVELOPMENT_HISTORY_LEDGER_VERSION) {
    throw new Error("dna_evaluation_history_ledger_schema_mismatch")
  }
  assertSha256(ledger.ledgerSha256, "dna_evaluation_history_ledger_invalid_hash")
  const observedIds = new Set<string>()
  let previousLedgerSha256: string | null = null
  for (const batch of ledger.batches) {
    assertExactKeys(batch, ["id", "appendedAt", "previousLedgerSha256", "entries", "batchSha256"],
      "dna_evaluation_history_batch_unknown_or_missing_field")
    assertIdentifier(batch.id, "dna_evaluation_history_batch_invalid_id")
    assertIsoTimestamp(batch.appendedAt, "dna_evaluation_history_batch_invalid_timestamp")
    if (batch.previousLedgerSha256 !== previousLedgerSha256) {
      throw new Error("dna_evaluation_history_chain_broken")
    }
    for (const entry of batch.entries) {
      assertExactKeys(entry, [
        "id", "normalizedQuestion", "normalizedQuestionSha256",
        "semanticFamilyProvenanceSha256", "sourceProvenanceSha256", "sourcePackId",
        "sourceCode", "firstSeenAt", "batchId", "recordSha256",
      ], "dna_evaluation_history_entry_unknown_or_missing_field")
      if (observedIds.has(entry.id)) throw new Error("dna_evaluation_history_duplicate_entry_id")
      observedIds.add(entry.id)
      const { recordSha256, ...payload } = entry
      if (!entry.normalizedQuestion || entry.normalizedQuestion
          !== normalizeDnaEvaluationMeaning(entry.normalizedQuestion)
        || entry.normalizedQuestionSha256 !== sha256(entry.normalizedQuestion)
        || recordSha256 !== sha256(payload)
        || entry.batchId !== batch.id
        || entry.firstSeenAt !== batch.appendedAt) {
        throw new Error("dna_evaluation_history_entry_integrity_mismatch")
      }
      assertSha256(entry.semanticFamilyProvenanceSha256,
        "dna_evaluation_history_entry_invalid_family_hash")
      assertSha256(entry.sourceProvenanceSha256,
        "dna_evaluation_history_entry_invalid_source_hash")
      if (!entry.sourcePackId.trim() || !entry.sourceCode.trim()) {
        throw new Error("dna_evaluation_history_entry_invalid_source_provenance")
      }
    }
    const { batchSha256, ...batchPayload } = batch
    if (batchSha256 !== sha256(batchPayload)) {
      throw new Error("dna_evaluation_history_batch_hash_mismatch")
    }
    previousLedgerSha256 = sha256([...ledger.batches.slice(0,
      ledger.batches.indexOf(batch) + 1)])
  }
  if (ledger.ledgerSha256 !== sha256(ledger.batches)) {
    throw new Error("dna_evaluation_history_ledger_hash_mismatch")
  }
}

export function appendDnaDevelopmentHistoryLedger(input: Readonly<{
  previous: DnaDevelopmentHistoryLedger | null
  questions: readonly DnaDevelopmentHistoryQuestion[]
  batchId: string
  appendedAt: string
}>): DnaDevelopmentHistoryLedger {
  if (input.previous) assertDnaDevelopmentHistoryLedger(input.previous)
  assertIdentifier(input.batchId, "dna_evaluation_history_batch_invalid_id")
  assertIsoTimestamp(input.appendedAt, "dna_evaluation_history_batch_invalid_timestamp")
  if (!input.questions.length) throw new Error("dna_evaluation_history_empty_append")
  if (input.previous?.batches.some((batch) => batch.id === input.batchId)) {
    throw new Error("dna_evaluation_history_duplicate_batch_id")
  }
  const existingIds = new Set(input.previous?.batches.flatMap((batch) =>
    batch.entries.map((entry) => entry.id)) ?? [])
  const entries = Object.freeze(input.questions.map((question) => developmentHistoryEntry({
    question,
    batchId: input.batchId,
    appendedAt: input.appendedAt,
  })).sort((left, right) => left.id.localeCompare(right.id, "en")))
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length
    || entries.some((entry) => existingIds.has(entry.id))) {
    throw new Error("dna_evaluation_history_duplicate_or_replayed_entry")
  }
  const batchPayload = Object.freeze({
    id: input.batchId,
    appendedAt: input.appendedAt,
    previousLedgerSha256: input.previous?.ledgerSha256 ?? null,
    entries,
  })
  const batch = Object.freeze({ ...batchPayload, batchSha256: sha256(batchPayload) })
  const batches = Object.freeze([...(input.previous?.batches ?? []), batch])
  const ledger = Object.freeze({
    schemaVersion: DNA_DEVELOPMENT_HISTORY_LEDGER_VERSION,
    batches,
    ledgerSha256: sha256(batches),
  })
  assertDnaDevelopmentHistoryLedger(ledger)
  return ledger
}

export function assertDnaDevelopmentHistoryAppendOnly(
  previous: DnaDevelopmentHistoryLedger,
  next: DnaDevelopmentHistoryLedger,
): void {
  assertDnaDevelopmentHistoryLedger(previous)
  assertDnaDevelopmentHistoryLedger(next)
  if (next.batches.length < previous.batches.length
    || stableJson(next.batches.slice(0, previous.batches.length))
      !== stableJson(previous.batches)) {
    throw new Error("dna_evaluation_history_not_append_only")
  }
}

export type DnaDevelopmentHistoryAuthorityManifest = Readonly<{
  schemaVersion: typeof DNA_DEVELOPMENT_HISTORY_AUTHORITY_VERSION
  state: "locked"
  ledgerSha256: string
  genesisBatchId: string
  genesisBatchSha256: string
  genesisEntryCount: number
  batchCount: number
  entryCount: number
  lastBatchId: string
  lastBatchSha256: string
  authorizedAt: string
  authoritySha256: string
}>

function developmentHistoryAuthorityPayload(input: Readonly<{
  ledger: DnaDevelopmentHistoryLedger
  authorizedAt: string
}>): Omit<DnaDevelopmentHistoryAuthorityManifest, "authoritySha256"> {
  assertDnaDevelopmentHistoryLedger(input.ledger)
  assertIsoTimestamp(input.authorizedAt,
    "dna_evaluation_history_authority_invalid_timestamp")
  const genesis = input.ledger.batches[0]
  const last = input.ledger.batches.at(-1)
  if (!genesis || !last || genesis.previousLedgerSha256 !== null) {
    throw new Error("dna_evaluation_history_authority_empty_or_invalid_genesis")
  }
  return Object.freeze({
    schemaVersion: DNA_DEVELOPMENT_HISTORY_AUTHORITY_VERSION,
    state: "locked" as const,
    ledgerSha256: input.ledger.ledgerSha256,
    genesisBatchId: genesis.id,
    genesisBatchSha256: genesis.batchSha256,
    genesisEntryCount: genesis.entries.length,
    batchCount: input.ledger.batches.length,
    entryCount: input.ledger.batches.reduce((sum, batch) => sum + batch.entries.length, 0),
    lastBatchId: last.id,
    lastBatchSha256: last.batchSha256,
    authorizedAt: input.authorizedAt,
  })
}

export function createDnaDevelopmentHistoryAuthorityManifest(input: Readonly<{
  ledger: DnaDevelopmentHistoryLedger
  authorizedAt: string
}>): DnaDevelopmentHistoryAuthorityManifest {
  const payload = developmentHistoryAuthorityPayload(input)
  return Object.freeze({ ...payload, authoritySha256: sha256(payload) })
}

export function assertDnaDevelopmentHistoryMatchesAuthority(input: Readonly<{
  ledger: DnaDevelopmentHistoryLedger
  authority: DnaDevelopmentHistoryAuthorityManifest
}>): void {
  assertDnaDevelopmentHistoryLedger(input.ledger)
  assertExactKeys(input.authority, [
    "schemaVersion", "state", "ledgerSha256", "genesisBatchId", "genesisBatchSha256",
    "genesisEntryCount", "batchCount", "entryCount", "lastBatchId", "lastBatchSha256",
    "authorizedAt", "authoritySha256",
  ], "dna_evaluation_history_authority_unknown_or_missing_field")
  if (input.authority.schemaVersion !== DNA_DEVELOPMENT_HISTORY_AUTHORITY_VERSION
    || input.authority.state !== "locked") {
    throw new Error("dna_evaluation_history_authority_schema_or_state_mismatch")
  }
  assertSha256(input.authority.ledgerSha256,
    "dna_evaluation_history_authority_invalid_ledger_hash")
  assertSha256(input.authority.genesisBatchSha256,
    "dna_evaluation_history_authority_invalid_genesis_hash")
  assertSha256(input.authority.lastBatchSha256,
    "dna_evaluation_history_authority_invalid_last_batch_hash")
  assertSha256(input.authority.authoritySha256,
    "dna_evaluation_history_authority_invalid_manifest_hash")
  assertIdentifier(input.authority.genesisBatchId,
    "dna_evaluation_history_authority_invalid_genesis_id")
  assertIdentifier(input.authority.lastBatchId,
    "dna_evaluation_history_authority_invalid_last_batch_id")
  if (!Number.isSafeInteger(input.authority.genesisEntryCount)
    || input.authority.genesisEntryCount <= 0
    || !Number.isSafeInteger(input.authority.batchCount)
    || input.authority.batchCount <= 0
    || !Number.isSafeInteger(input.authority.entryCount)
    || input.authority.entryCount < input.authority.genesisEntryCount) {
    throw new Error("dna_evaluation_history_authority_invalid_counts")
  }
  const expectedPayload = developmentHistoryAuthorityPayload({
    ledger: input.ledger,
    authorizedAt: input.authority.authorizedAt,
  })
  const { authoritySha256, ...authorityPayload } = input.authority
  if (authoritySha256 !== sha256(authorityPayload)
    || stableJson(authorityPayload) !== stableJson(expectedPayload)) {
    throw new Error("dna_evaluation_history_not_bound_to_committed_authority")
  }
}

export type DnaSemanticFamilyAuthority =
  | "external_science"
  | "dna_product"
  | "safety_policy"
  | "case_policy"
  | "unsupported_boundary"

export const DNA_EVALUATION_REPORT_FIELD_IDS = Object.freeze([
  "chatContext.primaryAxis",
  "chatContext.secondaryAxes",
  "chatContext.evidence",
  "chatContext.counterEvidence",
  "chatContext.preservedCapacities",
  "chatContext.limitations",
  "chatContext.confidence",
  "chatContext.confidenceRationale",
  "chatContext.weakDomains",
  "chatContext.strongDomains",
  "chatContext.patterns",
  "ageMonths",
  "scores.physiological",
  "scores.sensory",
  "scores.emotional",
  "scores.cognitive",
  "scores.executive",
  "scores.interoception",
  "levels.physiological",
  "levels.sensory",
  "levels.emotional",
  "levels.cognitive",
  "levels.executive",
  "levels.interoception",
] as const)

export const DNA_EVALUATION_UNSUPPORTED_BOUNDARY_IDS = Object.freeze([
  "unsupported.ambiguous_question",
  "unsupported.knowledge_not_released",
  "unsupported.relationship_not_established",
  "unsupported.outside_intended_use",
] as const)

export const DNA_EVALUATION_SAFETY_FAMILY_CLAUSE_IDS = Object.freeze({
  diagnosis: "prohibited.diagnosis_and_differential_diagnosis",
  differential_diagnosis: "prohibited.diagnosis_and_differential_diagnosis",
  treatment: "prohibited.treatment_or_session_planning",
  session_plan: "prohibited.treatment_or_session_planning",
  home_program: "prohibited.treatment_or_session_planning",
  medication: "prohibited.medication_or_dose_advice",
  prognosis: "prohibited.individual_prognosis",
  definitive_causality: "prohibited.definitive_causality",
  brain_region_inference: "prohibited.biological_state_inference_from_behavior",
  hrv_cortisol_autonomic_inference:
    "prohibited.biological_state_inference_from_behavior",
  crisis_self_harm: "boundary.crisis_out_of_scope",
  raw_answers: "prohibited.raw_or_internal_data_disclosure",
  snapshot: "prohibited.raw_or_internal_data_disclosure",
  trace_prompt: "prohibited.raw_or_internal_data_disclosure",
  personal_information: "prohibited.raw_or_internal_data_disclosure",
  cross_case: "prohibited.cross_report_clinical_comparison",
  foreign_therapist_account: "prohibited.cross_owner_case_access",
  safety_rule_manipulation: "boundary.instruction_manipulation",
  mixed_safe_risky: "boundary.instruction_manipulation",
} as const)

const DNA_EVALUATION_REGISTERED_INTENDED_USE_CLAUSE_IDS = new Set([
  ...DNA_INTELLIGENCE_PROHIBITED_CAPABILITY_IDS.map((id) => `prohibited.${id}`),
  "boundary.crisis_out_of_scope",
  "boundary.instruction_manipulation",
])
if (Object.values(DNA_EVALUATION_SAFETY_FAMILY_CLAUSE_IDS).some((clauseId) =>
  !DNA_EVALUATION_REGISTERED_INTENDED_USE_CLAUSE_IDS.has(clauseId))) {
  throw new Error("dna_evaluation_safety_clause_not_in_intended_use_contract")
}

const DNA_EVALUATION_SAFETY_POLICY_CLAUSE_IDS = Object.freeze(
  [...new Set(Object.values(DNA_EVALUATION_SAFETY_FAMILY_CLAUSE_IDS))]
    .sort((left, right) => left.localeCompare(right, "en")),
)

export type DnaEvaluationAuthorityRegistry = Readonly<{
  schemaVersion: typeof DNA_EVALUATION_AUTHORITY_REGISTRY_VERSION
  externalScience: Readonly<{
    releasedClaims: readonly Readonly<{
      claimId: string
      sourceIds: readonly string[]
    }>[]
  }>
  dnaProduct: Readonly<{
    bookLockStatus: "deferred_owner_book" | "locked"
    bookVersion: string | null
    bookSha256: string | null
    ownerApprovedClaimIds: readonly string[]
  }>
  safetyPolicy: Readonly<{
    policyVersion: typeof DNA_EVALUATION_REQUIRED_SAFETY_POLICY_VERSION
    clauseIds: readonly string[]
  }>
  casePolicy: Readonly<{
    contractVersion: typeof DNA_EVALUATION_REPORT_FIELD_CONTRACT_VERSION
    reportFieldIds: readonly string[]
  }>
  unsupportedBoundary: Readonly<{
    registryVersion: typeof DNA_EVALUATION_UNSUPPORTED_BOUNDARY_REGISTRY_VERSION
    boundaryIds: readonly string[]
  }>
  registrySha256: string
}>

export function createDnaEvaluationAuthorityRegistry(input: Readonly<{
  externalScienceClaims: readonly Readonly<{
    claimId: string
    sourceIds: readonly string[]
  }>[]
  dnaProduct: Readonly<{
    bookLockStatus: "deferred_owner_book" | "locked"
    bookVersion: string | null
    bookSha256: string | null
    ownerApprovedClaimIds: readonly string[]
  }>
}>): DnaEvaluationAuthorityRegistry {
  const externalScience = Object.freeze({
    releasedClaims: Object.freeze(input.externalScienceClaims.map((record) => Object.freeze({
      claimId: record.claimId,
      sourceIds: sortedUnique(record.sourceIds),
    })).sort((left, right) => left.claimId.localeCompare(right.claimId, "en"))),
  })
  const dnaProduct = Object.freeze({
    bookLockStatus: input.dnaProduct.bookLockStatus,
    bookVersion: input.dnaProduct.bookVersion,
    bookSha256: input.dnaProduct.bookSha256,
    ownerApprovedClaimIds: sortedUnique(input.dnaProduct.ownerApprovedClaimIds),
  })
  const safetyPolicy = Object.freeze({
    policyVersion: DNA_EVALUATION_REQUIRED_SAFETY_POLICY_VERSION,
    clauseIds: DNA_EVALUATION_SAFETY_POLICY_CLAUSE_IDS,
  })
  const casePolicy = Object.freeze({
    contractVersion: DNA_EVALUATION_REPORT_FIELD_CONTRACT_VERSION,
    reportFieldIds: DNA_EVALUATION_REPORT_FIELD_IDS,
  })
  const unsupportedBoundary = Object.freeze({
    registryVersion: DNA_EVALUATION_UNSUPPORTED_BOUNDARY_REGISTRY_VERSION,
    boundaryIds: DNA_EVALUATION_UNSUPPORTED_BOUNDARY_IDS,
  })
  const payload = Object.freeze({
    schemaVersion: DNA_EVALUATION_AUTHORITY_REGISTRY_VERSION,
    externalScience,
    dnaProduct,
    safetyPolicy,
    casePolicy,
    unsupportedBoundary,
  })
  const registry = Object.freeze({ ...payload, registrySha256: sha256(payload) })
  assertDnaEvaluationAuthorityRegistry(registry)
  return registry
}

export function assertDnaEvaluationAuthorityRegistry(
  registry: DnaEvaluationAuthorityRegistry,
): void {
  assertExactKeys(registry, [
    "schemaVersion", "externalScience", "dnaProduct", "safetyPolicy",
    "casePolicy", "unsupportedBoundary", "registrySha256",
  ], "dna_evaluation_authority_registry_unknown_or_missing_field")
  if (registry.schemaVersion !== DNA_EVALUATION_AUTHORITY_REGISTRY_VERSION) {
    throw new Error("dna_evaluation_authority_registry_schema_mismatch")
  }
  assertExactKeys(registry.externalScience, ["releasedClaims"],
    "dna_evaluation_external_authority_registry_invalid")
  const externalClaimIds = registry.externalScience.releasedClaims.map((row) => row.claimId)
  if (new Set(externalClaimIds).size !== externalClaimIds.length) {
    throw new Error("dna_evaluation_external_authority_registry_duplicate_claim")
  }
  for (const record of registry.externalScience.releasedClaims) {
    assertExactKeys(record, ["claimId", "sourceIds"],
      "dna_evaluation_external_authority_registry_record_invalid")
    assertIdentifier(record.claimId, "dna_evaluation_external_authority_registry_invalid_claim")
    if (!record.sourceIds.length || new Set(record.sourceIds).size !== record.sourceIds.length) {
      throw new Error("dna_evaluation_external_authority_registry_invalid_sources")
    }
    record.sourceIds.forEach((id) => assertIdentifier(id,
      "dna_evaluation_external_authority_registry_invalid_source"))
  }
  assertExactKeys(registry.dnaProduct, [
    "bookLockStatus", "bookVersion", "bookSha256", "ownerApprovedClaimIds",
  ], "dna_evaluation_product_authority_registry_invalid")
  if (new Set(registry.dnaProduct.ownerApprovedClaimIds).size
      !== registry.dnaProduct.ownerApprovedClaimIds.length) {
    throw new Error("dna_evaluation_product_authority_registry_duplicate_claim")
  }
  registry.dnaProduct.ownerApprovedClaimIds.forEach((id) => assertIdentifier(id,
    "dna_evaluation_product_authority_registry_invalid_claim"))
  if (registry.dnaProduct.bookLockStatus === "locked") {
    if (!registry.dnaProduct.bookVersion || !registry.dnaProduct.bookSha256) {
      throw new Error("dna_evaluation_product_authority_locked_book_identity_missing")
    }
    assertIdentifier(registry.dnaProduct.bookVersion,
      "dna_evaluation_product_authority_invalid_book_version")
    assertSha256(registry.dnaProduct.bookSha256,
      "dna_evaluation_product_authority_invalid_book_hash")
  } else if (registry.dnaProduct.bookLockStatus === "deferred_owner_book") {
    if (registry.dnaProduct.bookVersion !== null || registry.dnaProduct.bookSha256 !== null
      || registry.dnaProduct.ownerApprovedClaimIds.length) {
      throw new Error("dna_evaluation_product_authority_deferred_book_must_be_empty")
    }
  } else {
    throw new Error("dna_evaluation_product_authority_unknown_book_status")
  }
  assertExactKeys(registry.safetyPolicy, ["policyVersion", "clauseIds"],
    "dna_evaluation_safety_authority_registry_invalid")
  if (registry.safetyPolicy.policyVersion !== DNA_EVALUATION_REQUIRED_SAFETY_POLICY_VERSION
    || stableJson(registry.safetyPolicy.clauseIds)
      !== stableJson(DNA_EVALUATION_SAFETY_POLICY_CLAUSE_IDS)) {
    throw new Error("dna_evaluation_safety_authority_registry_not_versioned_contract")
  }
  assertExactKeys(registry.casePolicy, ["contractVersion", "reportFieldIds"],
    "dna_evaluation_case_authority_registry_invalid")
  if (registry.casePolicy.contractVersion !== DNA_EVALUATION_REPORT_FIELD_CONTRACT_VERSION
    || stableJson(registry.casePolicy.reportFieldIds)
      !== stableJson(DNA_EVALUATION_REPORT_FIELD_IDS)) {
    throw new Error("dna_evaluation_case_authority_registry_not_report_field_contract")
  }
  assertExactKeys(registry.unsupportedBoundary, ["registryVersion", "boundaryIds"],
    "dna_evaluation_unsupported_authority_registry_invalid")
  if (registry.unsupportedBoundary.registryVersion
      !== DNA_EVALUATION_UNSUPPORTED_BOUNDARY_REGISTRY_VERSION
    || stableJson(registry.unsupportedBoundary.boundaryIds)
      !== stableJson(DNA_EVALUATION_UNSUPPORTED_BOUNDARY_IDS)) {
    throw new Error("dna_evaluation_unsupported_authority_registry_not_controlled")
  }
  const { registrySha256, ...payload } = registry
  assertSha256(registrySha256, "dna_evaluation_authority_registry_invalid_hash")
  if (registrySha256 !== sha256(payload)) {
    throw new Error("dna_evaluation_authority_registry_hash_mismatch")
  }
}

export type DnaSemanticFamilyRegistryEntry = Readonly<{
  familyId: string
  canonicalMeaning: string
  authority: DnaSemanticFamilyAuthority
  sourceAuthorityIds: readonly string[]
  createdBy: string
  createdAt: string
  semanticFamilyProvenanceSha256: string
  recordSha256: string
}>

export type DnaSemanticFamilyRegistry = Readonly<{
  schemaVersion: typeof DNA_SEMANTIC_FAMILY_REGISTRY_VERSION
  entries: readonly DnaSemanticFamilyRegistryEntry[]
  registrySha256: string
}>

export function createDnaSemanticFamilyRegistry(
  entries: readonly Readonly<Omit<DnaSemanticFamilyRegistryEntry,
  "semanticFamilyProvenanceSha256" | "recordSha256">>[],
): DnaSemanticFamilyRegistry {
  const normalized = Object.freeze(entries.map((entry) => {
    const canonicalMeaning = normalizeDnaEvaluationMeaning(entry.canonicalMeaning)
    const payload = Object.freeze({
      familyId: entry.familyId,
      canonicalMeaning,
      authority: entry.authority,
      sourceAuthorityIds: sortedUnique(entry.sourceAuthorityIds),
      createdBy: entry.createdBy,
      createdAt: entry.createdAt,
      semanticFamilyProvenanceSha256: sha256(canonicalMeaning),
    })
    return Object.freeze({ ...payload, recordSha256: sha256(payload) })
  }).sort((left, right) => left.familyId.localeCompare(right.familyId, "en")))
  const registry = Object.freeze({
    schemaVersion: DNA_SEMANTIC_FAMILY_REGISTRY_VERSION,
    entries: normalized,
    registrySha256: sha256(normalized),
  })
  assertDnaSemanticFamilyRegistry(registry)
  return registry
}

export function assertDnaSemanticFamilyRegistry(registry: DnaSemanticFamilyRegistry): void {
  assertExactKeys(registry, ["schemaVersion", "entries", "registrySha256"],
    "dna_evaluation_family_registry_unknown_or_missing_field")
  if (registry.schemaVersion !== DNA_SEMANTIC_FAMILY_REGISTRY_VERSION) {
    throw new Error("dna_evaluation_family_registry_schema_mismatch")
  }
  if (new Set(registry.entries.map((entry) => entry.familyId)).size
      !== registry.entries.length) throw new Error("dna_evaluation_family_registry_duplicate_id")
  if (new Set(registry.entries.map((entry) => entry.semanticFamilyProvenanceSha256)).size
      !== registry.entries.length) {
    throw new Error("dna_evaluation_semantic_family_split_detected")
  }
  for (const entry of registry.entries) {
    assertExactKeys(entry, [
      "familyId", "canonicalMeaning", "authority", "sourceAuthorityIds", "createdBy",
      "createdAt", "semanticFamilyProvenanceSha256", "recordSha256",
    ], "dna_evaluation_family_registry_entry_unknown_or_missing_field")
    assertIdentifier(entry.familyId, "dna_evaluation_family_registry_invalid_id")
    assertIdentifier(entry.createdBy, "dna_evaluation_family_registry_invalid_creator")
    assertIsoTimestamp(entry.createdAt, "dna_evaluation_family_registry_invalid_timestamp")
    if (!entry.canonicalMeaning
      || entry.canonicalMeaning !== normalizeDnaEvaluationMeaning(entry.canonicalMeaning)
      || !["external_science", "dna_product", "safety_policy", "case_policy",
        "unsupported_boundary"].includes(entry.authority)
      || !entry.sourceAuthorityIds.length
      || new Set(entry.sourceAuthorityIds).size !== entry.sourceAuthorityIds.length) {
      throw new Error("dna_evaluation_family_registry_invalid_entry")
    }
    entry.sourceAuthorityIds.forEach((id) => assertIdentifier(id,
      "dna_evaluation_family_registry_invalid_source_authority"))
    const { recordSha256, ...payload } = entry
    if (entry.semanticFamilyProvenanceSha256 !== sha256(entry.canonicalMeaning)
      || recordSha256 !== sha256(payload)) {
      throw new Error("dna_evaluation_family_registry_hash_mismatch")
    }
  }
  const signatures = registry.entries.map((entry) => meaningSignature(entry.canonicalMeaning))
  for (let left = 0; left < signatures.length; left += 1) {
    for (let right = left + 1; right < signatures.length; right += 1) {
      if (signaturesAreNearDuplicates(signatures[left]!, signatures[right]!)) {
        throw new Error("dna_evaluation_semantic_family_split_detected")
      }
    }
  }
  if (registry.registrySha256 !== sha256(registry.entries)) {
    throw new Error("dna_evaluation_family_registry_envelope_hash_mismatch")
  }
}

export type DnaQuestionApprovalTarget = Readonly<{
  id: string
  familyId: string
  bucket: string
  expectedSafetyFamily: string | null
  semanticFamilyProvenanceSha256: string
  question: string
  expectedTopic: string | null
  expectedQueryKind: string
  acceptableClaimIds: readonly string[]
  requiredPassageIds: readonly string[]
  forbiddenInferences: readonly string[]
  forbiddenOutputSubstrings: readonly string[]
  ageBoundary: string
  expectedOutcome: string
  requiredSafetyStatement: string | null
  allowedReportFields: readonly string[]
  reviewerApprovalId: string
}>

function questionAnnotationSha256(question: DnaQuestionApprovalTarget): string {
  return sha256(Object.freeze({
    id: question.id,
    familyId: question.familyId,
    bucket: question.bucket,
    expectedSafetyFamily: question.expectedSafetyFamily,
    semanticFamilyProvenanceSha256: question.semanticFamilyProvenanceSha256,
    question: question.question.trim(),
    expectedTopic: question.expectedTopic,
    expectedQueryKind: question.expectedQueryKind,
    acceptableClaimIds: sortedUnique(question.acceptableClaimIds),
    requiredPassageIds: sortedUnique(question.requiredPassageIds),
    forbiddenInferences: sortedUnique(question.forbiddenInferences),
    forbiddenOutputSubstrings: sortedUnique(question.forbiddenOutputSubstrings),
    ageBoundary: question.ageBoundary,
    expectedOutcome: question.expectedOutcome,
    requiredSafetyStatement: question.requiredSafetyStatement,
    allowedReportFields: sortedUnique(question.allowedReportFields),
  }))
}

export type DnaQuestionApprovalRecord = Readonly<{
  id: string
  questionId: string
  questionSha256: string
  annotationSha256: string
  authorId: string
  reviewerId: string
  reviewRunId: string
  reviewedAt: string
  authorityClass: "codex_multi_pass_not_independent"
  recordSha256: string
}>

export type DnaQuestionApprovalLedger = Readonly<{
  schemaVersion: typeof DNA_QUESTION_APPROVAL_LEDGER_VERSION
  records: readonly DnaQuestionApprovalRecord[]
  ledgerSha256: string
}>

export function createDnaQuestionApprovalRecord(input: Readonly<{
  question: DnaQuestionApprovalTarget
  authorId: string
  reviewerId: string
  reviewRunId: string
  reviewedAt: string
}>): DnaQuestionApprovalRecord {
  const payload = Object.freeze({
    id: input.question.reviewerApprovalId,
    questionId: input.question.id,
    questionSha256: sha256(input.question.question.trim()),
    annotationSha256: questionAnnotationSha256(input.question),
    authorId: input.authorId,
    reviewerId: input.reviewerId,
    reviewRunId: input.reviewRunId,
    reviewedAt: input.reviewedAt,
    authorityClass: "codex_multi_pass_not_independent" as const,
  })
  return Object.freeze({ ...payload, recordSha256: sha256(payload) })
}

export function createDnaQuestionApprovalLedger(
  records: readonly DnaQuestionApprovalRecord[],
): DnaQuestionApprovalLedger {
  const sorted = Object.freeze([...records]
    .sort((left, right) => left.id.localeCompare(right.id, "en")))
  const ledger = Object.freeze({
    schemaVersion: DNA_QUESTION_APPROVAL_LEDGER_VERSION,
    records: sorted,
    ledgerSha256: sha256(sorted),
  })
  assertDnaQuestionApprovalLedger(ledger)
  return ledger
}

export function assertDnaQuestionApprovalLedger(ledger: DnaQuestionApprovalLedger): void {
  assertExactKeys(ledger, ["schemaVersion", "records", "ledgerSha256"],
    "dna_evaluation_question_approval_ledger_unknown_or_missing_field")
  if (ledger.schemaVersion !== DNA_QUESTION_APPROVAL_LEDGER_VERSION) {
    throw new Error("dna_evaluation_question_approval_ledger_schema_mismatch")
  }
  if (new Set(ledger.records.map((row) => row.id)).size !== ledger.records.length
    || new Set(ledger.records.map((row) => row.questionId)).size !== ledger.records.length) {
    throw new Error("dna_evaluation_question_approval_duplicate_record")
  }
  for (const record of ledger.records) {
    assertExactKeys(record, [
      "id", "questionId", "questionSha256", "annotationSha256", "authorId", "reviewerId",
      "reviewRunId", "reviewedAt", "authorityClass", "recordSha256",
    ], "dna_evaluation_question_approval_unknown_or_missing_field")
    assertIdentifier(record.id, "dna_evaluation_question_approval_invalid_id")
    assertIdentifier(record.questionId, "dna_evaluation_question_approval_invalid_question_id")
    assertIdentifier(record.authorId, "dna_evaluation_question_approval_invalid_author")
    assertIdentifier(record.reviewerId, "dna_evaluation_question_approval_invalid_reviewer")
    assertIdentifier(record.reviewRunId, "dna_evaluation_question_approval_invalid_run")
    assertIsoTimestamp(record.reviewedAt, "dna_evaluation_question_approval_invalid_timestamp")
    if (record.authorId === record.reviewerId
      || record.authorityClass !== "codex_multi_pass_not_independent") {
      throw new Error("dna_evaluation_question_approval_not_separated")
    }
    assertSha256(record.questionSha256, "dna_evaluation_question_approval_invalid_question_hash")
    assertSha256(record.annotationSha256,
      "dna_evaluation_question_approval_invalid_annotation_hash")
    const { recordSha256, ...payload } = record
    if (recordSha256 !== sha256(payload)) {
      throw new Error("dna_evaluation_question_approval_record_hash_mismatch")
    }
  }
  if (ledger.ledgerSha256 !== sha256(ledger.records)) {
    throw new Error("dna_evaluation_question_approval_ledger_hash_mismatch")
  }
}

export type DnaVariationApprovalTarget = Readonly<{
  id: string
  baseQuestionId: string
  baseQuestionSha256: string
  familyId: string
  kind: string
  question: string
  expectedOutcome: string
  expectationRelation: string
  reviewerApprovalId: string
}>

function variationAnnotationSha256(variation: DnaVariationApprovalTarget): string {
  return sha256(Object.freeze({
    id: variation.id,
    baseQuestionId: variation.baseQuestionId,
    baseQuestionSha256: variation.baseQuestionSha256,
    familyId: variation.familyId,
    kind: variation.kind,
    question: variation.question.trim(),
    expectedOutcome: variation.expectedOutcome,
    expectationRelation: variation.expectationRelation,
  }))
}

export type DnaVariationApprovalRecord = Readonly<{
  id: string
  variationId: string
  variationQuestionSha256: string
  annotationSha256: string
  recipeId: string
  authorId: string
  reviewerId: string
  reviewRunId: string
  reviewedAt: string
  authorityClass: "codex_multi_pass_not_independent"
  recordSha256: string
}>

export type DnaVariationApprovalLedger = Readonly<{
  schemaVersion: typeof DNA_VARIATION_APPROVAL_LEDGER_VERSION
  records: readonly DnaVariationApprovalRecord[]
  ledgerSha256: string
}>

export function createDnaVariationApprovalRecord(input: Readonly<{
  variation: DnaVariationApprovalTarget
  recipeId: string
  authorId: string
  reviewerId: string
  reviewRunId: string
  reviewedAt: string
}>): DnaVariationApprovalRecord {
  const payload = Object.freeze({
    id: input.variation.reviewerApprovalId,
    variationId: input.variation.id,
    variationQuestionSha256: sha256(input.variation.question.trim()),
    annotationSha256: variationAnnotationSha256(input.variation),
    recipeId: input.recipeId,
    authorId: input.authorId,
    reviewerId: input.reviewerId,
    reviewRunId: input.reviewRunId,
    reviewedAt: input.reviewedAt,
    authorityClass: "codex_multi_pass_not_independent" as const,
  })
  return Object.freeze({ ...payload, recordSha256: sha256(payload) })
}

export function createDnaVariationApprovalLedger(
  records: readonly DnaVariationApprovalRecord[],
): DnaVariationApprovalLedger {
  const sorted = Object.freeze([...records]
    .sort((left, right) => left.id.localeCompare(right.id, "en")))
  const ledger = Object.freeze({
    schemaVersion: DNA_VARIATION_APPROVAL_LEDGER_VERSION,
    records: sorted,
    ledgerSha256: sha256(sorted),
  })
  assertDnaVariationApprovalLedger(ledger)
  return ledger
}

export function assertDnaVariationApprovalLedger(ledger: DnaVariationApprovalLedger): void {
  assertExactKeys(ledger, ["schemaVersion", "records", "ledgerSha256"],
    "dna_evaluation_variation_approval_ledger_unknown_or_missing_field")
  if (ledger.schemaVersion !== DNA_VARIATION_APPROVAL_LEDGER_VERSION) {
    throw new Error("dna_evaluation_variation_approval_ledger_schema_mismatch")
  }
  if (new Set(ledger.records.map((row) => row.id)).size !== ledger.records.length
    || new Set(ledger.records.map((row) => row.variationId)).size !== ledger.records.length) {
    throw new Error("dna_evaluation_variation_approval_duplicate_record")
  }
  for (const record of ledger.records) {
    assertExactKeys(record, [
      "id", "variationId", "variationQuestionSha256", "annotationSha256", "recipeId",
      "authorId", "reviewerId", "reviewRunId", "reviewedAt", "authorityClass",
      "recordSha256",
    ], "dna_evaluation_variation_approval_unknown_or_missing_field")
    assertIdentifier(record.id, "dna_evaluation_variation_approval_invalid_id")
    assertIdentifier(record.variationId, "dna_evaluation_variation_approval_invalid_variation_id")
    assertIdentifier(record.recipeId, "dna_evaluation_variation_approval_invalid_recipe")
    assertIdentifier(record.authorId, "dna_evaluation_variation_approval_invalid_author")
    assertIdentifier(record.reviewerId, "dna_evaluation_variation_approval_invalid_reviewer")
    assertIdentifier(record.reviewRunId, "dna_evaluation_variation_approval_invalid_run")
    assertIsoTimestamp(record.reviewedAt, "dna_evaluation_variation_approval_invalid_timestamp")
    if (record.authorId === record.reviewerId
      || record.authorityClass !== "codex_multi_pass_not_independent") {
      throw new Error("dna_evaluation_variation_approval_not_separated")
    }
    assertSha256(record.variationQuestionSha256,
      "dna_evaluation_variation_approval_invalid_question_hash")
    assertSha256(record.annotationSha256,
      "dna_evaluation_variation_approval_invalid_annotation_hash")
    const { recordSha256, ...payload } = record
    if (recordSha256 !== sha256(payload)) {
      throw new Error("dna_evaluation_variation_approval_record_hash_mismatch")
    }
  }
  if (ledger.ledgerSha256 !== sha256(ledger.records)) {
    throw new Error("dna_evaluation_variation_approval_ledger_hash_mismatch")
  }
}

export function assertDnaQuestionsResolveIntegrityAuthorities(input: Readonly<{
  questions: readonly DnaQuestionApprovalTarget[]
  developmentHistory: DnaDevelopmentHistoryLedger
  semanticFamilies: DnaSemanticFamilyRegistry
  approvals: DnaQuestionApprovalLedger
  authorityRegistry: DnaEvaluationAuthorityRegistry
}>): void {
  assertDnaDevelopmentHistoryLedger(input.developmentHistory)
  assertDnaSemanticFamilyRegistry(input.semanticFamilies)
  assertDnaQuestionApprovalLedger(input.approvals)
  assertDnaEvaluationAuthorityRegistry(input.authorityRegistry)
  const familyById = new Map(input.semanticFamilies.entries.map((entry) =>
    [entry.familyId, entry]))
  const approvalById = new Map(input.approvals.records.map((record) => [record.id, record]))
  if (input.approvals.records.length !== input.questions.length) {
    throw new Error("dna_evaluation_question_approval_set_mismatch")
  }
  const externalClaimById = new Map(
    input.authorityRegistry.externalScience.releasedClaims.map((record) =>
      [record.claimId, record]),
  )
  const externalSourceIds = new Set(input.authorityRegistry.externalScience.releasedClaims
    .flatMap((record) => record.sourceIds))
  const productClaimIds = new Set(input.authorityRegistry.dnaProduct.ownerApprovedClaimIds)
  const safetyClauseIds = new Set(input.authorityRegistry.safetyPolicy.clauseIds)
  const reportFieldIds = new Set(input.authorityRegistry.casePolicy.reportFieldIds)
  const unsupportedBoundaryIds = new Set(
    input.authorityRegistry.unsupportedBoundary.boundaryIds,
  )
  const assertFamilyAuthorityResolved = (family: DnaSemanticFamilyRegistryEntry): void => {
    if (family.authority === "external_science") {
      if (family.sourceAuthorityIds.some((id) =>
        !externalClaimById.has(id) && !externalSourceIds.has(id))) {
        throw new Error("dna_evaluation_external_science_authority_not_resolved")
      }
      return
    }
    if (family.authority === "dna_product") {
      if (input.authorityRegistry.dnaProduct.bookLockStatus !== "locked") {
        throw new Error("dna_evaluation_dna_product_requires_locked_owner_book")
      }
      if (family.sourceAuthorityIds.some((id) => !productClaimIds.has(id))) {
        throw new Error("dna_evaluation_dna_product_authority_not_owner_approved")
      }
      return
    }
    if (family.authority === "safety_policy") {
      if (family.sourceAuthorityIds.some((id) => !safetyClauseIds.has(id))) {
        throw new Error("dna_evaluation_safety_policy_authority_not_resolved")
      }
      return
    }
    if (family.authority === "case_policy") {
      if (family.sourceAuthorityIds.some((id) => !reportFieldIds.has(id))) {
        throw new Error("dna_evaluation_case_policy_authority_not_resolved")
      }
      return
    }
    if (family.sourceAuthorityIds.some((id) => !unsupportedBoundaryIds.has(id))) {
      throw new Error("dna_evaluation_unsupported_boundary_authority_not_resolved")
    }
  }
  input.semanticFamilies.entries.forEach(assertFamilyAuthorityResolved)
  for (const question of input.questions) {
    const family = familyById.get(question.familyId)
    if (!family || question.semanticFamilyProvenanceSha256
        !== family.semanticFamilyProvenanceSha256) {
      throw new Error("dna_evaluation_question_family_registry_mismatch")
    }
    const expectedAuthority: DnaSemanticFamilyAuthority = question.bucket === "safety"
      ? "safety_policy"
      : question.bucket === "case_robustness"
        ? "case_policy"
        : question.bucket === "unsupported"
          ? "unsupported_boundary"
          : family.authority
    if (family.authority !== expectedAuthority
      || (question.bucket === "supported"
        && !["external_science", "dna_product"].includes(family.authority))) {
      throw new Error("dna_evaluation_question_authority_class_mismatch")
    }
    if (family.authority === "external_science") {
      for (const claimId of question.acceptableClaimIds) {
        const claim = externalClaimById.get(claimId)
        if (!claim || !family.sourceAuthorityIds.includes(claimId)
          && !claim.sourceIds.some((sourceId) =>
            family.sourceAuthorityIds.includes(sourceId))) {
          throw new Error("dna_evaluation_question_external_claim_authority_not_resolved")
        }
      }
    } else if (family.authority === "dna_product") {
      if (question.acceptableClaimIds.some((claimId) =>
        !productClaimIds.has(claimId) || !family.sourceAuthorityIds.includes(claimId))) {
        throw new Error("dna_evaluation_question_product_claim_authority_not_resolved")
      }
    } else if (family.authority === "safety_policy") {
      const requiredClause = question.expectedSafetyFamily
        ? DNA_EVALUATION_SAFETY_FAMILY_CLAUSE_IDS[
          question.expectedSafetyFamily as keyof typeof DNA_EVALUATION_SAFETY_FAMILY_CLAUSE_IDS
        ]
        : null
      if (!requiredClause || !family.sourceAuthorityIds.includes(requiredClause)) {
        throw new Error("dna_evaluation_question_safety_clause_not_resolved")
      }
    } else if (family.authority === "case_policy") {
      const baseReportFields = question.allowedReportFields.map((fieldId) =>
        fieldId.replace(/\[\d+\]$/, ""))
      if (baseReportFields.some((fieldId) =>
        !family.sourceAuthorityIds.includes(fieldId))) {
        throw new Error("dna_evaluation_question_case_field_authority_not_resolved")
      }
    }
  }
  const developmentEntries = input.developmentHistory.batches
    .flatMap((batch) => batch.entries)
  const developmentProvenanceHashes = new Set(developmentEntries
    .map((entry) => entry.semanticFamilyProvenanceSha256))
  if (input.questions.some((question) =>
    developmentProvenanceHashes.has(question.semanticFamilyProvenanceSha256))) {
    throw new Error("dna_evaluation_semantic_family_provenance_leaks_from_development_pool")
  }
  const developmentSignatures = developmentEntries
    .map((entry) => meaningSignature(entry.normalizedQuestion))
  const questionSignatures = input.questions.map((question) => meaningSignature(question.question))
  for (let questionIndex = 0; questionIndex < input.questions.length; questionIndex += 1) {
    const question = input.questions[questionIndex]!
    const signature = questionSignatures[questionIndex]!
    if (developmentSignatures.some((candidate) =>
      signaturesAreNearDuplicates(signature, candidate))) {
      throw new Error("dna_evaluation_near_duplicate_leaks_from_development_pool")
    }
    for (let otherIndex = questionIndex + 1; otherIndex < input.questions.length; otherIndex += 1) {
      if (question.familyId !== input.questions[otherIndex]!.familyId
        && signaturesAreNearDuplicates(signature, questionSignatures[otherIndex]!)) {
        throw new Error("dna_evaluation_question_family_split_detected")
      }
    }
  }
  for (const question of input.questions) {
    const approval = approvalById.get(question.reviewerApprovalId)
    if (!approval || approval.questionId !== question.id
      || approval.questionSha256 !== sha256(question.question.trim())
      || approval.annotationSha256 !== questionAnnotationSha256(question)) {
      throw new Error("dna_evaluation_question_approval_not_resolved")
    }
  }
  const questionIds = new Set(input.questions.map((row) => row.id))
  if (input.approvals.records.some((record) => !questionIds.has(record.questionId))) {
    throw new Error("dna_evaluation_question_approval_orphan_record")
  }
}

export function assertDnaVariationsResolveApprovalLedger(input: Readonly<{
  variations: readonly DnaVariationApprovalTarget[]
  approvals: DnaVariationApprovalLedger
}>): void {
  assertDnaVariationApprovalLedger(input.approvals)
  if (input.approvals.records.length !== input.variations.length) {
    throw new Error("dna_evaluation_variation_approval_set_mismatch")
  }
  const approvalById = new Map(input.approvals.records.map((record) => [record.id, record]))
  for (const variation of input.variations) {
    const approval = approvalById.get(variation.reviewerApprovalId)
    if (!approval || approval.variationId !== variation.id
      || approval.variationQuestionSha256 !== sha256(variation.question.trim())
      || approval.annotationSha256 !== variationAnnotationSha256(variation)) {
      throw new Error("dna_evaluation_variation_approval_not_resolved")
    }
  }
  const variationIds = new Set(input.variations.map((row) => row.id))
  if (input.approvals.records.some((record) => !variationIds.has(record.variationId))) {
    throw new Error("dna_evaluation_variation_approval_orphan_record")
  }
}

export function dnaEvaluationDatasetIntegritySha256(value: unknown): string {
  return sha256(value)
}

export const DNA_CHAT_RAW_REVIEW_CATEGORIES = [
  "self_regulation",
  "central_nervous_system",
  "autonomic_nervous_system",
  "sympathetic_parasympathetic",
] as const

export const DNA_CHAT_RAW_REVIEW_RECORD_TYPES = [
  "claim",
  "concept_card",
  "source",
] as const

export const DNA_CHAT_RAW_REVIEW_STATUSES = ["expert_pending"] as const

export const DNA_CHAT_RAW_RUNTIME_DISPOSITIONS = ["cataloged_for_review"] as const

export type DnaChatRawReviewCategory = typeof DNA_CHAT_RAW_REVIEW_CATEGORIES[number]
export type DnaChatRawReviewRecordType = typeof DNA_CHAT_RAW_REVIEW_RECORD_TYPES[number]
export type DnaChatRawReviewStatus = typeof DNA_CHAT_RAW_REVIEW_STATUSES[number]
export type DnaChatRawRuntimeDisposition = typeof DNA_CHAT_RAW_RUNTIME_DISPOSITIONS[number]

export const DNA_CHAT_RAW_REVIEW_CANONICAL_FILES = {
  self_regulation: "docs/dna-knowledge/research-packs/v1/self-regulation.md",
  central_nervous_system: "docs/dna-knowledge/research-packs/v1/central-nervous-system.md",
  autonomic_nervous_system: "docs/dna-knowledge/research-packs/v1/autonomic-nervous-system.md",
  sympathetic_parasympathetic: "docs/dna-knowledge/research-packs/v1/sympathetic-parasympathetic-processes.md",
} as const satisfies Readonly<Record<DnaChatRawReviewCategory, string>>

export type DnaChatRawReviewCanonicalFile =
  typeof DNA_CHAT_RAW_REVIEW_CANONICAL_FILES[DnaChatRawReviewCategory]

export type DnaChatRawReviewRecord = Readonly<{
  id: string
  category: DnaChatRawReviewCategory
  recordType: DnaChatRawReviewRecordType
  sourceCode: string
  canonicalFile: DnaChatRawReviewCanonicalFile
  reviewStatus: DnaChatRawReviewStatus
  runtimeDisposition: DnaChatRawRuntimeDisposition
}>

type RawRecordSeries = Readonly<{
  category: DnaChatRawReviewCategory
  recordType: DnaChatRawReviewRecordType
  prefix: string
  count: number
  width: number
}>

const RAW_RECORD_SERIES: readonly RawRecordSeries[] = [
  { category: "self_regulation", recordType: "claim", prefix: "SR-", count: 28, width: 2 },
  { category: "self_regulation", recordType: "concept_card", prefix: "KK-", count: 26, width: 2 },
  { category: "self_regulation", recordType: "source", prefix: "K", count: 45, width: 2 },
  { category: "central_nervous_system", recordType: "claim", prefix: "C", count: 16, width: 2 },
  { category: "central_nervous_system", recordType: "concept_card", prefix: "K", count: 22, width: 2 },
  { category: "central_nervous_system", recordType: "source", prefix: "S", count: 33, width: 2 },
  { category: "autonomic_nervous_system", recordType: "claim", prefix: "C", count: 22, width: 2 },
  { category: "autonomic_nervous_system", recordType: "concept_card", prefix: "K", count: 20, width: 2 },
  { category: "autonomic_nervous_system", recordType: "source", prefix: "S", count: 31, width: 2 },
  { category: "sympathetic_parasympathetic", recordType: "claim", prefix: "İ", count: 36, width: 2 },
  { category: "sympathetic_parasympathetic", recordType: "concept_card", prefix: "KAV-", count: 46, width: 3 },
  { category: "sympathetic_parasympathetic", recordType: "source", prefix: "K", count: 42, width: 2 },
]

function stableIdToken(value: string) {
  return value
    .replace(/İ/g, "I")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function expandSeries(series: RawRecordSeries): readonly DnaChatRawReviewRecord[] {
  return Array.from({ length: series.count }, (_, offset) => {
    const sourceCode = `${series.prefix}${String(offset + 1).padStart(series.width, "0")}`
    return Object.freeze({
      id: `raw.${stableIdToken(series.category)}.${stableIdToken(series.recordType)}.${stableIdToken(sourceCode)}`,
      category: series.category,
      recordType: series.recordType,
      sourceCode,
      canonicalFile: DNA_CHAT_RAW_REVIEW_CANONICAL_FILES[series.category],
      reviewStatus: "expert_pending",
      runtimeDisposition: "cataloged_for_review",
    }) satisfies DnaChatRawReviewRecord
  })
}

/**
 * Record-level audit inventory for every non-question row in the four canonical
 * research packs. Entries are review candidates only; presence here does not
 * mean that a row is source-verified, safe, published, or available at runtime.
 */
export const DNA_CHAT_RAW_REVIEW_MANIFEST: readonly DnaChatRawReviewRecord[] = Object.freeze(
  RAW_RECORD_SERIES.flatMap(expandSeries),
)

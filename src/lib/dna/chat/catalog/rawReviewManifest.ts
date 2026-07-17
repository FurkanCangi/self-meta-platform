import {
  DNA_CHAT_RESEARCH_PACK_CATEGORIES,
  DNA_CHAT_RESEARCH_PACK_IDS,
  type DnaChatCatalogCategory,
  type DnaChatResearchPackId,
} from "./types"

export const DNA_CHAT_RAW_REVIEW_CATEGORIES = [
  "self_regulation",
  "central_nervous_system",
  "autonomic_nervous_system",
  "sympathetic_parasympathetic",
] as const

export const DNA_CHAT_RAW_REVIEW_PACK_IDS = DNA_CHAT_RESEARCH_PACK_IDS

export const DNA_CHAT_RAW_REVIEW_RECORD_TYPES = [
  "claim",
  "concept_card",
  "source",
] as const

export const DNA_CHAT_RAW_REVIEW_STATUSES = ["expert_pending"] as const

export const DNA_CHAT_RAW_RUNTIME_DISPOSITIONS = ["cataloged_for_review"] as const

export type DnaChatRawReviewCategory = DnaChatCatalogCategory
export type DnaChatRawReviewPackId = DnaChatResearchPackId
export type DnaChatRawReviewRecordType = typeof DNA_CHAT_RAW_REVIEW_RECORD_TYPES[number]
export type DnaChatRawReviewStatus = typeof DNA_CHAT_RAW_REVIEW_STATUSES[number]
export type DnaChatRawRuntimeDisposition = typeof DNA_CHAT_RAW_RUNTIME_DISPOSITIONS[number]

export const DNA_CHAT_RAW_REVIEW_CANONICAL_FILES = {
  self_regulation: "docs/dna-knowledge/research-packs/v1/self-regulation.md",
  central_nervous_system: "docs/dna-knowledge/research-packs/v1/central-nervous-system.md",
  autonomic_nervous_system: "docs/dna-knowledge/research-packs/v1/autonomic-nervous-system.md",
  sympathetic_parasympathetic: "docs/dna-knowledge/research-packs/v1/sympathetic-parasympathetic-processes.md",
  prefrontal_processes: "docs/dna-knowledge/research-packs/v2/prefrontal-processes.md",
  anterior_cingulate_cortex: "docs/dna-knowledge/research-packs/v2/anterior-cingulate-cortex.md",
  insular_cortex: "docs/dna-knowledge/research-packs/v2/insular-cortex.md",
  interoception: "docs/dna-knowledge/research-packs/v2/interoception.md",
  arousal_reactivity: "docs/dna-knowledge/research-packs/v3/arousal-reactivity.md",
  recovery_self_organization: "docs/dna-knowledge/research-packs/v3/recovery-self-organization.md",
  sensory_modulation: "docs/dna-knowledge/research-packs/v3/sensory-modulation.md",
  emotion_regulation: "docs/dna-knowledge/research-packs/v3/emotion-regulation.md",
  stress_systems: "docs/dna-knowledge/research-packs/v4/stress-systems.md",
  sleep_daily_rhythm: "docs/dna-knowledge/research-packs/v4/sleep-daily-rhythm.md",
  executive_functions: "docs/dna-knowledge/research-packs/v4/executive-functions.md",
  attention_working_memory: "docs/dna-knowledge/research-packs/v4/attention-working-memory.md",
  case_report_boundaries: "docs/dna-knowledge/research-packs/v5/case-report-interpretation-boundaries.md",
  dna_six_domains: "docs/dna-knowledge/research-packs/v5/dna-six-domains.md",
  developmental_differences: "docs/dna-knowledge/research-packs/v5/developmental-differences.md",
  coregulation: "docs/dna-knowledge/research-packs/v5/coregulation.md",
} as const satisfies Readonly<Record<DnaChatRawReviewPackId, string>>

export type DnaChatRawReviewCanonicalFile =
  typeof DNA_CHAT_RAW_REVIEW_CANONICAL_FILES[DnaChatRawReviewPackId]

export type DnaChatRawReviewRecord = Readonly<{
  id: string
  sourcePackId: DnaChatRawReviewPackId
  category: DnaChatRawReviewCategory
  recordType: DnaChatRawReviewRecordType
  sourceCode: string
  canonicalFile: DnaChatRawReviewCanonicalFile
  reviewStatus: DnaChatRawReviewStatus
  runtimeDisposition: DnaChatRawRuntimeDisposition
}>

type RawRecordSeries = Readonly<{
  sourcePackId: DnaChatRawReviewPackId
  recordType: DnaChatRawReviewRecordType
  prefix: string
  count: number
  /** Zero preserves unpadded source codes such as S1–S32. */
  width: number
}>

const RAW_RECORD_SERIES: readonly RawRecordSeries[] = [
  { sourcePackId: "self_regulation", recordType: "claim", prefix: "SR-", count: 28, width: 2 },
  { sourcePackId: "self_regulation", recordType: "concept_card", prefix: "KK-", count: 26, width: 2 },
  { sourcePackId: "self_regulation", recordType: "source", prefix: "K", count: 45, width: 2 },
  { sourcePackId: "central_nervous_system", recordType: "claim", prefix: "C", count: 16, width: 2 },
  { sourcePackId: "central_nervous_system", recordType: "concept_card", prefix: "K", count: 22, width: 2 },
  { sourcePackId: "central_nervous_system", recordType: "source", prefix: "S", count: 33, width: 2 },
  { sourcePackId: "autonomic_nervous_system", recordType: "claim", prefix: "C", count: 22, width: 2 },
  { sourcePackId: "autonomic_nervous_system", recordType: "concept_card", prefix: "K", count: 20, width: 2 },
  { sourcePackId: "autonomic_nervous_system", recordType: "source", prefix: "S", count: 31, width: 2 },
  { sourcePackId: "sympathetic_parasympathetic", recordType: "claim", prefix: "İ", count: 36, width: 2 },
  { sourcePackId: "sympathetic_parasympathetic", recordType: "concept_card", prefix: "KAV-", count: 46, width: 3 },
  { sourcePackId: "sympathetic_parasympathetic", recordType: "source", prefix: "K", count: 42, width: 2 },
  { sourcePackId: "prefrontal_processes", recordType: "claim", prefix: "PFC-", count: 20, width: 2 },
  { sourcePackId: "prefrontal_processes", recordType: "concept_card", prefix: "KK-", count: 24, width: 2 },
  { sourcePackId: "prefrontal_processes", recordType: "source", prefix: "S", count: 32, width: 0 },
  { sourcePackId: "anterior_cingulate_cortex", recordType: "claim", prefix: "ACC-", count: 30, width: 2 },
  { sourcePackId: "anterior_cingulate_cortex", recordType: "concept_card", prefix: "KK-", count: 32, width: 2 },
  { sourcePackId: "anterior_cingulate_cortex", recordType: "source", prefix: "K", count: 45, width: 2 },
  { sourcePackId: "insular_cortex", recordType: "claim", prefix: "İ", count: 40, width: 2 },
  { sourcePackId: "insular_cortex", recordType: "concept_card", prefix: "KK", count: 42, width: 2 },
  { sourcePackId: "insular_cortex", recordType: "source", prefix: "K", count: 40, width: 2 },
  { sourcePackId: "interoception", recordType: "claim", prefix: "İ", count: 40, width: 2 },
  { sourcePackId: "interoception", recordType: "concept_card", prefix: "KK", count: 48, width: 2 },
  { sourcePackId: "interoception", recordType: "source", prefix: "K", count: 51, width: 2 },
  { sourcePackId: "arousal_reactivity", recordType: "claim", prefix: "UR-", count: 28, width: 2 },
  { sourcePackId: "arousal_reactivity", recordType: "concept_card", prefix: "KK-", count: 42, width: 2 },
  { sourcePackId: "arousal_reactivity", recordType: "source", prefix: "S", count: 39, width: 2 },
  { sourcePackId: "recovery_self_organization", recordType: "claim", prefix: "T-", count: 42, width: 3 },
  { sourcePackId: "recovery_self_organization", recordType: "concept_card", prefix: "KK-", count: 44, width: 2 },
  { sourcePackId: "recovery_self_organization", recordType: "source", prefix: "K", count: 57, width: 2 },
  { sourcePackId: "sensory_modulation", recordType: "claim", prefix: "DM", count: 44, width: 2 },
  { sourcePackId: "sensory_modulation", recordType: "concept_card", prefix: "KK", count: 43, width: 2 },
  { sourcePackId: "sensory_modulation", recordType: "source", prefix: "K", count: 40, width: 2 },
  { sourcePackId: "emotion_regulation", recordType: "claim", prefix: "DD-", count: 40, width: 2 },
  { sourcePackId: "emotion_regulation", recordType: "concept_card", prefix: "KK", count: 60, width: 2 },
  { sourcePackId: "emotion_regulation", recordType: "source", prefix: "K", count: 55, width: 2 },
  { sourcePackId: "stress_systems", recordType: "claim", prefix: "SS-", count: 40, width: 2 },
  { sourcePackId: "stress_systems", recordType: "concept_card", prefix: "KK-", count: 50, width: 2 },
  { sourcePackId: "stress_systems", recordType: "source", prefix: "S", count: 47, width: 2 },
  { sourcePackId: "sleep_daily_rhythm", recordType: "claim", prefix: "UGR-", count: 54, width: 2 },
  { sourcePackId: "sleep_daily_rhythm", recordType: "concept_card", prefix: "KK-", count: 58, width: 2 },
  { sourcePackId: "sleep_daily_rhythm", recordType: "source", prefix: "K", count: 64, width: 2 },
  { sourcePackId: "executive_functions", recordType: "claim", prefix: "Yİ", count: 48, width: 2 },
  { sourcePackId: "executive_functions", recordType: "concept_card", prefix: "KK", count: 45, width: 2 },
  { sourcePackId: "executive_functions", recordType: "source", prefix: "K", count: 50, width: 2 },
  { sourcePackId: "attention_working_memory", recordType: "claim", prefix: "DB-", count: 51, width: 2 },
  { sourcePackId: "attention_working_memory", recordType: "concept_card", prefix: "KK", count: 73, width: 2 },
  { sourcePackId: "attention_working_memory", recordType: "source", prefix: "K", count: 68, width: 2 },
  { sourcePackId: "case_report_boundaries", recordType: "claim", prefix: "VRY-", count: 48, width: 2 },
  { sourcePackId: "case_report_boundaries", recordType: "concept_card", prefix: "KK-", count: 51, width: 2 },
  { sourcePackId: "case_report_boundaries", recordType: "source", prefix: "K", count: 50, width: 2 },
  { sourcePackId: "dna_six_domains", recordType: "claim", prefix: "AA-", count: 66, width: 2 },
  { sourcePackId: "dna_six_domains", recordType: "concept_card", prefix: "KK-", count: 63, width: 2 },
  { sourcePackId: "dna_six_domains", recordType: "source", prefix: "K", count: 91, width: 2 },
  { sourcePackId: "developmental_differences", recordType: "claim", prefix: "GF", count: 54, width: 2 },
  { sourcePackId: "developmental_differences", recordType: "concept_card", prefix: "KK", count: 48, width: 2 },
  { sourcePackId: "developmental_differences", recordType: "source", prefix: "K", count: 54, width: 2 },
  { sourcePackId: "coregulation", recordType: "claim", prefix: "İ", count: 50, width: 2 },
  { sourcePackId: "coregulation", recordType: "concept_card", prefix: "KK", count: 75, width: 2 },
  { sourcePackId: "coregulation", recordType: "source", prefix: "K", count: 60, width: 2 },
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
      id: `raw.${stableIdToken(series.sourcePackId)}.${stableIdToken(series.recordType)}.${stableIdToken(sourceCode)}`,
      sourcePackId: series.sourcePackId,
      category: DNA_CHAT_RESEARCH_PACK_CATEGORIES[series.sourcePackId],
      recordType: series.recordType,
      sourceCode,
      canonicalFile: DNA_CHAT_RAW_REVIEW_CANONICAL_FILES[series.sourcePackId],
      reviewStatus: "expert_pending",
      runtimeDisposition: "cataloged_for_review",
    }) satisfies DnaChatRawReviewRecord
  })
}

/**
 * Record-level audit inventory for every non-question row in the canonical
 * research packs. Entries are review candidates only; presence here does not
 * mean that a row is source-verified, safe, published, or available at runtime.
 */
export const DNA_CHAT_RAW_REVIEW_MANIFEST: readonly DnaChatRawReviewRecord[] = Object.freeze(
  RAW_RECORD_SERIES.flatMap(expandSeries),
)

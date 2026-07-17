import { DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS } from "./benchmarkQuestions"
import { DNA_CHAT_CATALOG_CLAIMS } from "./claims"
import { DNA_CHAT_CATALOG_PROVENANCE } from "./provenance"
import { DNA_CHAT_CATALOG_RELATIONS } from "./relations"
import { DNA_CHAT_CATALOG_SAFETY_RULES } from "./safetyRules"
import { DNA_CHAT_CATALOG_SOURCES } from "./sources"
import { DNA_CHAT_CATALOG_TOPICS } from "./topics"
import {
  DNA_CHAT_CATALOG_VERSION,
  type DnaChatCatalog,
} from "./types"

export const DNA_CHAT_CATALOG: DnaChatCatalog = Object.freeze({
  version: DNA_CHAT_CATALOG_VERSION,
  topics: DNA_CHAT_CATALOG_TOPICS,
  claims: DNA_CHAT_CATALOG_CLAIMS.filter(
    (claim) => claim.sourceVerified && claim.safetyStatus === "safe",
  ),
  relations: DNA_CHAT_CATALOG_RELATIONS,
  sources: DNA_CHAT_CATALOG_SOURCES.filter((source) => source.sourceVerified),
  safetyRules: DNA_CHAT_CATALOG_SAFETY_RULES,
  benchmarkQuestions: DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS,
  provenance: DNA_CHAT_CATALOG_PROVENANCE,
})

export { DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS } from "./benchmarkQuestions"
export { DNA_CHAT_CATALOG_CLAIMS, DNA_CHAT_CATALOG_CLAIM_BY_ID } from "./claims"
export { DNA_CHAT_CATALOG_PROVENANCE } from "./provenance"
export {
  DNA_CHAT_RAW_REVIEW_CANONICAL_FILES,
  DNA_CHAT_RAW_REVIEW_MANIFEST,
} from "./rawReviewManifest"
export type {
  DnaChatRawReviewCategory,
  DnaChatRawReviewPackId,
  DnaChatRawReviewRecord,
  DnaChatRawReviewRecordType,
} from "./rawReviewManifest"
export { DNA_CHAT_CATALOG_RELATIONS } from "./relations"
export { DNA_CHAT_CATALOG_SAFETY_RULES } from "./safetyRules"
export {
  classifyCatalogQueryKind,
  findCatalogTopic,
  getCatalogTopicById,
  getClaimsForTopic,
  getRelationsForTopic,
  getSourcesForClaim,
  normalizeCatalogText,
} from "./search"
export { DNA_CHAT_CATALOG_SOURCES, DNA_CHAT_CATALOG_SOURCE_BY_ID } from "./sources"
export { DNA_CHAT_CATALOG_TOPICS, DNA_CHAT_CATALOG_TOPIC_BY_ID } from "./topics"
export * from "./types"

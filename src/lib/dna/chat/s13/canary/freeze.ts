import { hashDnaS13Artifact } from "../strictHash"

export const DNA_S13_CANARY_ARCHITECTURE_VERSION = "dna-intelligence-v1-answer-architecture@1" as const

export const DNA_S13_CANARY_ARCHITECTURE_FLOW = Object.freeze([
  "privacy_safety",
  "query_interpretation",
  "s1_knowledge_core",
  "required_answer_slots",
  "comparison_two_sided_retrieval",
  "relevance_gated_explanatory_claims",
  "locked_content_plan",
  "realizer",
  "claim_relation_comparison_validator",
  "repair_or_deterministic_fallback",
  "answer",
] as const)

export const DNA_S13_CANARY_ARCHITECTURE_HASH = hashDnaS13Artifact({
  version: DNA_S13_CANARY_ARCHITECTURE_VERSION,
  flow: DNA_S13_CANARY_ARCHITECTURE_FLOW,
})

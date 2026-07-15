export { createDnaChatSafeCaseContext, hasUsableDnaCaseContext } from "./caseContext"
export { resolveDnaChat } from "./engine"
export {
  buildDnaChatSnapshotContext,
  DNA_CHAT_REPORT_CONTEXT_VERSION,
} from "./reportSnapshot"
export { DNA_CHAT_STARTER_QUESTIONS } from "./suggestions"
export {
  DNA_CHAT_KNOWLEDGE_ENTRIES,
  DNA_CHAT_KNOWLEDGE_ENTRY_BY_TOPIC,
} from "./knowledge"
export {
  DNA_CHAT_ENGINE_VERSION,
  DNA_CHAT_KNOWLEDGE_CONTRACT_VERSION,
  DNA_CHAT_SCHEMA_VERSION,
} from "./types"

export type {
  DnaChatCaseContextInput,
  DnaChatClassification,
  DnaChatDomainKey,
  DnaChatDomainLevel,
  DnaChatEvidenceStatus,
  DnaChatKnowledgeEntry,
  DnaChatMode,
  DnaChatOutcome,
  DnaChatRequest,
  DnaChatResponse,
  DnaChatRoute,
  DnaChatSafeCaseContext,
  DnaChatSafetyCategory,
  DnaChatSourceRef,
  DnaChatSourceType,
} from "./types"

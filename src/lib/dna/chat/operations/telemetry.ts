import type {
  DnaChatClassification,
  DnaChatOutcome,
} from "../types"
import type { DnaV3ResponseDepth } from "../v3ResponseProfiles"

export const DNA_CHAT_TELEMETRY_VERSION = "dna-chat-telemetry@1" as const

export const DNA_CHAT_TELEMETRY_ALLOWED_INPUT_KEYS = Object.freeze([
  "requestId",
  "engineVersion",
  "packVersion",
  "topic",
  "classification",
  "outcome",
  "responseDepth",
  "sourceIds",
  "citationCount",
  "latencyCategory",
  "httpStatus",
  "auditResult",
  "userIssueCategory",
] as const)

/**
 * These names are denied in addition to the strict allowlist. Keeping the
 * explicit list makes the privacy boundary reviewable even if a caller later
 * tries to loosen the input schema.
 */
export const DNA_CHAT_TELEMETRY_DENIED_KEYS = Object.freeze([
  "question",
  "answer",
  "reportText",
  "reportId",
  "report_text",
  "report_id",
  "clientCode",
  "clientId",
  "client_code",
  "client_id",
  "passageText",
  "passage_text",
  "caseFinding",
  "caseEvidence",
  "case_finding",
  "case_evidence",
  "previousConversation",
  "previousTopic",
  "previousTopicText",
  "previous_chat",
  "anamnesis",
  "rawAnswers",
  "raw_answers",
  "scores",
  "personalData",
  "pii",
  "userId",
  "email",
  "name",
  "ipAddress",
  "userAgent",
] as const)

export const DNA_CHAT_ISSUE_CATEGORIES = Object.freeze([
  "wrong_topic",
  "insufficient_answer",
  "source_mismatch",
  "age_scope_wrong",
  "overconfident_language",
  "report_mismatch",
  "safety_boundary_issue",
  "technical_error",
] as const)

export type DnaChatIssueCategory = (typeof DNA_CHAT_ISSUE_CATEGORIES)[number]
export type DnaChatTelemetryAuditResult = "written" | "failed" | "not_required"
export type DnaChatTelemetryLatencyCategory = "lt_100ms" | "100_to_999ms" | "gte_1000ms"

export type DnaChatTelemetryRecord = Readonly<{
  schemaVersion: typeof DNA_CHAT_TELEMETRY_VERSION
  requestId: string
  engineVersion: string
  packVersion: string
  topic: string | null
  classification: DnaChatClassification
  outcome: DnaChatOutcome
  responseDepth: DnaV3ResponseDepth
  sourceIds: readonly string[]
  citationCount: number
  latencyCategory: DnaChatTelemetryLatencyCategory
  httpStatus: number
  auditResult: DnaChatTelemetryAuditResult
  userIssueCategory: DnaChatIssueCategory | null
}>

export type DnaChatTelemetryDecision = Readonly<{
  accepted: boolean
  reasonCodes: readonly string[]
  record: DnaChatTelemetryRecord | null
}>

const SAFE_IDENTIFIER = /^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{0,159}$/
const CLASSIFICATIONS = new Set<DnaChatClassification>([
  "dna_concept",
  "literature",
  "case_finding",
  "hypothesis",
  "clarification",
  "not_available",
  "refusal",
])
const OUTCOMES = new Set<DnaChatOutcome>([
  "answered",
  "clarification",
  "not_available",
  "refused",
])
const RESPONSE_DEPTHS = new Set<DnaV3ResponseDepth>(["short", "standard", "deep"])
const LATENCY_CATEGORIES = new Set<DnaChatTelemetryLatencyCategory>([
  "lt_100ms",
  "100_to_999ms",
  "gte_1000ms",
])
const AUDIT_RESULTS = new Set<DnaChatTelemetryAuditResult>(["written", "failed", "not_required"])
const ISSUE_CATEGORIES = new Set<DnaChatIssueCategory>(DNA_CHAT_ISSUE_CATEGORIES)

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function safeIdentifier(value: unknown): value is string {
  return typeof value === "string"
    && value.trim() === value
    && SAFE_IDENTIFIER.test(value)
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort())
}

/**
 * Builds only a non-clinical, bounded operational record. Unknown keys fail
 * closed; values are never coerced from arbitrary user text.
 */
export function buildDnaChatTelemetryRecord(input: unknown): DnaChatTelemetryDecision {
  const reasons: string[] = []
  if (!isPlainRecord(input)) {
    return Object.freeze({
      accepted: false,
      reasonCodes: Object.freeze(["telemetry_payload_not_plain_record"]),
      record: null,
    })
  }

  const allowedKeys = new Set<string>(DNA_CHAT_TELEMETRY_ALLOWED_INPUT_KEYS)
  const deniedKeys = new Set<string>(DNA_CHAT_TELEMETRY_DENIED_KEYS)
  for (const key of Object.keys(input)) {
    if (deniedKeys.has(key)) reasons.push(`telemetry_denied_key:${key}`)
    else if (!allowedKeys.has(key)) reasons.push(`telemetry_unknown_key:${key}`)
  }

  if (!safeIdentifier(input.requestId)) reasons.push("telemetry_request_id_invalid")
  if (!safeIdentifier(input.engineVersion)) reasons.push("telemetry_engine_version_invalid")
  if (!safeIdentifier(input.packVersion)) reasons.push("telemetry_pack_version_invalid")
  if (input.topic !== null && !safeIdentifier(input.topic)) reasons.push("telemetry_topic_invalid")
  if (!CLASSIFICATIONS.has(input.classification as DnaChatClassification)) {
    reasons.push("telemetry_classification_invalid")
  }
  if (!OUTCOMES.has(input.outcome as DnaChatOutcome)) reasons.push("telemetry_outcome_invalid")
  if (!RESPONSE_DEPTHS.has(input.responseDepth as DnaV3ResponseDepth)) {
    reasons.push("telemetry_response_depth_invalid")
  }
  if (!Array.isArray(input.sourceIds)
    || input.sourceIds.length > 16
    || input.sourceIds.some((sourceId) => !safeIdentifier(sourceId))) {
    reasons.push("telemetry_source_ids_invalid")
  }
  if (!Number.isSafeInteger(input.citationCount)
    || Number(input.citationCount) < 0
    || Number(input.citationCount) > 16) {
    reasons.push("telemetry_citation_count_invalid")
  }
  if (!LATENCY_CATEGORIES.has(input.latencyCategory as DnaChatTelemetryLatencyCategory)) {
    reasons.push("telemetry_latency_category_invalid")
  }
  if (!Number.isSafeInteger(input.httpStatus)
    || Number(input.httpStatus) < 100
    || Number(input.httpStatus) > 599) {
    reasons.push("telemetry_http_status_invalid")
  }
  if (!AUDIT_RESULTS.has(input.auditResult as DnaChatTelemetryAuditResult)) {
    reasons.push("telemetry_audit_result_invalid")
  }
  if (input.userIssueCategory !== null
    && !ISSUE_CATEGORIES.has(input.userIssueCategory as DnaChatIssueCategory)) {
    reasons.push("telemetry_user_issue_category_invalid")
  }

  const reasonCodes = uniqueSorted(reasons)
  if (reasonCodes.length > 0) {
    return Object.freeze({ accepted: false, reasonCodes, record: null })
  }

  const sourceIds = uniqueSorted(input.sourceIds as string[])
  if (Number(input.citationCount) > sourceIds.length) {
    return Object.freeze({
      accepted: false,
      reasonCodes: Object.freeze(["telemetry_citation_count_exceeds_sources"]),
      record: null,
    })
  }

  return Object.freeze({
    accepted: true,
    reasonCodes: Object.freeze([]),
    record: Object.freeze({
      schemaVersion: DNA_CHAT_TELEMETRY_VERSION,
      requestId: input.requestId as string,
      engineVersion: input.engineVersion as string,
      packVersion: input.packVersion as string,
      topic: input.topic as string | null,
      classification: input.classification as DnaChatClassification,
      outcome: input.outcome as DnaChatOutcome,
      responseDepth: input.responseDepth as DnaV3ResponseDepth,
      sourceIds,
      citationCount: input.citationCount as number,
      latencyCategory: input.latencyCategory as DnaChatTelemetryLatencyCategory,
      httpStatus: input.httpStatus as number,
      auditResult: input.auditResult as DnaChatTelemetryAuditResult,
      userIssueCategory: input.userIssueCategory as DnaChatIssueCategory | null,
    }),
  })
}

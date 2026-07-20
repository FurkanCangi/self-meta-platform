import {
  DNA_CHAT_ISSUE_CATEGORIES,
  type DnaChatIssueCategory,
} from "./telemetry"

export const DNA_CHAT_CATEGORICAL_FEEDBACK_VERSION = "dna-chat-categorical-feedback@1" as const

export const DNA_CHAT_ISSUE_CATEGORY_LABELS_TR: Readonly<Record<DnaChatIssueCategory, string>> =
  Object.freeze({
    wrong_topic: "Yanlış konu",
    insufficient_answer: "Yetersiz cevap",
    source_mismatch: "Kaynak uyuşmuyor",
    age_scope_wrong: "Yaş kapsamı yanlış",
    overconfident_language: "Fazla kesin anlatım",
    report_mismatch: "Raporla uyuşmuyor",
    safety_boundary_issue: "Güvenlik sınırı sorunu",
    technical_error: "Teknik hata",
  })

export const DNA_CHAT_FEEDBACK_INPUT_KEYS = Object.freeze([
  "requestId",
  "category",
  "sourceId",
] as const)

export type DnaChatCategoricalFeedbackRecord = Readonly<{
  schemaVersion: typeof DNA_CHAT_CATEGORICAL_FEEDBACK_VERSION
  requestId: string
  category: DnaChatIssueCategory
  sourceId: string | null
  containsClinicalText: false
  automaticTrainingUse: "prohibited"
}>

export type DnaChatCategoricalFeedbackDecision = Readonly<{
  accepted: boolean
  reasonCodes: readonly string[]
  record: DnaChatCategoricalFeedbackRecord | null
}>

// Public chat request IDs are minted with crypto.randomUUID(). Requiring that
// exact shape prevents a caller from smuggling free clinical text inside an
// identifier-shaped field.
const SAFE_REQUEST_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SAFE_SOURCE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{0,159}$/
const SOURCE_RELATED_CATEGORIES = new Set<DnaChatIssueCategory>([
  "source_mismatch",
  "age_scope_wrong",
])

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/** Strict, text-free feedback contract. */
export function buildDnaChatCategoricalFeedbackRecord(
  input: unknown,
): DnaChatCategoricalFeedbackDecision {
  if (!isPlainRecord(input)) {
    return Object.freeze({
      accepted: false,
      reasonCodes: Object.freeze(["feedback_payload_not_plain_record"]),
      record: null,
    })
  }

  const reasons: string[] = []
  const allowedKeys = new Set<string>(DNA_CHAT_FEEDBACK_INPUT_KEYS)
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) reasons.push(`feedback_unknown_or_text_key:${key}`)
  }
  if (typeof input.requestId !== "string" || !SAFE_REQUEST_ID.test(input.requestId)) {
    reasons.push("feedback_request_id_invalid")
  }
  if (!DNA_CHAT_ISSUE_CATEGORIES.includes(input.category as DnaChatIssueCategory)) {
    reasons.push("feedback_category_invalid")
  }
  if (input.sourceId !== undefined && input.sourceId !== null
    && (typeof input.sourceId !== "string" || !SAFE_SOURCE_ID.test(input.sourceId))) {
    reasons.push("feedback_source_id_invalid")
  }
  if (input.sourceId && !SOURCE_RELATED_CATEGORIES.has(input.category as DnaChatIssueCategory)) {
    reasons.push("feedback_source_id_not_allowed_for_category")
  }

  const reasonCodes = Object.freeze([...new Set(reasons)].sort())
  if (reasonCodes.length > 0) {
    return Object.freeze({ accepted: false, reasonCodes, record: null })
  }

  return Object.freeze({
    accepted: true,
    reasonCodes: Object.freeze([]),
    record: Object.freeze({
      schemaVersion: DNA_CHAT_CATEGORICAL_FEEDBACK_VERSION,
      requestId: input.requestId as string,
      category: input.category as DnaChatIssueCategory,
      sourceId: typeof input.sourceId === "string" ? input.sourceId : null,
      containsClinicalText: false,
      automaticTrainingUse: "prohibited",
    }),
  })
}

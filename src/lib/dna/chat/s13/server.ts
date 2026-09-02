import "server-only"

import {
  DNA_S13_ANSWERABILITY,
  DNA_S13_DEPTHS,
  DNA_S13_FOCUS_VALUES,
  DNA_S13_INTENTS,
  DNA_S13_QUESTION_TYPES,
  preservesDnaS13QuestionMeaning,
  validateDnaS13QueryFrame,
  validateDnaS13Realization,
  type DnaS13AnswerPlan,
  type DnaS13Claim,
  type DnaS13QueryFrame,
  type DnaS13Realization,
  type DnaS13RequiredAnswerSlot,
} from "./contracts"
import { DNA_CHAT_LUNA_MODEL } from "../lunaPolicy"
import { validateDnaS13StrictRealization, type DnaS13StrictPlan, type DnaS13StrictRealization } from "./strictContracts"
import {
  DNA_S13_STRICT_PROMPT_VERSION,
  dnaS13StrictContent,
  dnaS13StrictInstructions,
  dnaS13StrictRealizationSchema,
} from "./strictPrompt"

export const DNA_S13_PROMPT_VERSION = "dna-s13-prompts@1" as const
export const DNA_S13_REQUEST_TIMEOUT_MS = 5_000
export const DNA_S13_MAX_CALLS_PER_MESSAGE = 3
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"

export type DnaS13ProviderUsage = Readonly<{
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
}>

export type DnaS13ProviderResult<T> = Readonly<{
  value: T
  rawOutput: string
  responseId: string | null
  usage: DnaS13ProviderUsage
  latencyMs: number
}>

export const DNA_S13_PROVIDER_FAILURE_REASONS = Object.freeze([
  "missing_key",
  "timeout",
  "network_error",
  "http_error",
  "invalid_response_json",
  "empty_output",
  "invalid_output_json",
] as const)

export type DnaS13ProviderFailureReason = typeof DNA_S13_PROVIDER_FAILURE_REASONS[number]

export type DnaS13ProviderFailure = Readonly<{
  reason: DnaS13ProviderFailureReason
  httpStatus: number | null
  apiErrorType: string | null
  apiErrorCode: string | null
}>

export type DnaS13ProviderAttempt<T> =
  | Readonly<{ ok: true; result: DnaS13ProviderResult<T> }>
  | Readonly<{ ok: false; failure: DnaS13ProviderFailure }>

export type DnaS13TopicCandidate = Readonly<{
  topicId: string
  title: string
  aliases?: readonly string[]
  focusHints?: readonly string[]
}>

type FetchLike = typeof fetch

const SAFE_API_ERROR_ID = /^[a-zA-Z0-9_.:-]{1,80}$/

function safeApiErrorId(value: unknown): string | null {
  return typeof value === "string" && SAFE_API_ERROR_ID.test(value) ? value : null
}

function providerFailure(
  reason: DnaS13ProviderFailureReason,
  input: Partial<Pick<DnaS13ProviderFailure, "httpStatus" | "apiErrorType" | "apiErrorCode">> = {},
): DnaS13ProviderFailure {
  return Object.freeze({
    reason,
    httpStatus: Number.isInteger(input.httpStatus) ? Number(input.httpStatus) : null,
    apiErrorType: safeApiErrorId(input.apiErrorType),
    apiErrorCode: safeApiErrorId(input.apiErrorCode),
  })
}

function providerApiError(payload: unknown): Pick<DnaS13ProviderFailure, "apiErrorType" | "apiErrorCode"> {
  const row = payload && typeof payload === "object" ? payload as Record<string, unknown> : {}
  const error = row.error && typeof row.error === "object" ? row.error as Record<string, unknown> : {}
  return {
    apiErrorType: safeApiErrorId(error.type),
    apiErrorCode: safeApiErrorId(error.code),
  }
}

function responseText(payload: unknown) {
  if (!payload || typeof payload !== "object") return null
  const row = payload as Record<string, unknown>
  if (typeof row.output_text === "string" && row.output_text.trim()) return row.output_text.trim()
  if (!Array.isArray(row.output)) return null
  for (const output of row.output) {
    if (!output || typeof output !== "object") continue
    const content = (output as Record<string, unknown>).content
    if (!Array.isArray(content)) continue
    for (const item of content) {
      if (!item || typeof item !== "object") continue
      const text = (item as Record<string, unknown>).text
      if (typeof text === "string" && text.trim()) return text.trim()
    }
  }
  return null
}

function usage(payload: unknown): DnaS13ProviderUsage {
  const row = payload && typeof payload === "object" ? payload as Record<string, unknown> : {}
  const raw = row.usage && typeof row.usage === "object" ? row.usage as Record<string, unknown> : {}
  const details = raw.input_tokens_details && typeof raw.input_tokens_details === "object"
    ? raw.input_tokens_details as Record<string, unknown>
    : {}
  return Object.freeze({
    inputTokens: Number(raw.input_tokens || 0),
    cachedInputTokens: Number(details.cached_tokens || 0),
    outputTokens: Number(raw.output_tokens || 0),
  })
}

export async function requestDnaS13StructuredOutputDetailed(input: Readonly<{
  name: string
  schema: Record<string, unknown>
  instructions: string
  content: string
  maxOutputTokens: number
  safetyIdentifier?: string | null
  apiKey?: string
  fetchImpl?: FetchLike
  timeoutMs?: number
}>): Promise<DnaS13ProviderAttempt<unknown>> {
  const apiKey = input.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return Object.freeze({ ok: false, failure: providerFailure("missing_key") })
  const controller = new AbortController()
  const timeoutMs = Number.isFinite(input.timeoutMs) && Number(input.timeoutMs) > 0
    ? Math.min(Math.round(Number(input.timeoutMs)), 30_000)
    : DNA_S13_REQUEST_TIMEOUT_MS
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const started = performance.now()
  try {
    const response = await (input.fetchImpl ?? fetch)(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: DNA_CHAT_LUNA_MODEL,
        store: false,
        reasoning: { effort: "none" },
        ...(input.safetyIdentifier ? { safety_identifier: input.safetyIdentifier } : {}),
        instructions: input.instructions,
        input: input.content,
        max_output_tokens: input.maxOutputTokens,
        text: {
          verbosity: "low",
          format: { type: "json_schema", name: input.name, strict: true, schema: input.schema },
        },
      }),
      signal: controller.signal,
    })
    let payload: unknown
    try {
      payload = await response.json() as unknown
    } catch {
      return Object.freeze({
        ok: false,
        failure: providerFailure("invalid_response_json", { httpStatus: response.status }),
      })
    }
    if (!response.ok) {
      return Object.freeze({
        ok: false,
        failure: providerFailure("http_error", { httpStatus: response.status, ...providerApiError(payload) }),
      })
    }
    const text = responseText(payload)
    if (!text) return Object.freeze({ ok: false, failure: providerFailure("empty_output", { httpStatus: response.status }) })
    let value: unknown
    try {
      value = JSON.parse(text) as unknown
    } catch {
      return Object.freeze({ ok: false, failure: providerFailure("invalid_output_json", { httpStatus: response.status }) })
    }
    const row = payload as Record<string, unknown>
    return Object.freeze({
      ok: true,
      result: Object.freeze({
        value,
        rawOutput: text,
        responseId: typeof row.id === "string" ? row.id : null,
        usage: usage(payload),
        latencyMs: performance.now() - started,
      }),
    })
  } catch (error) {
    return Object.freeze({
      ok: false,
      failure: providerFailure(error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error"),
    })
  } finally {
    clearTimeout(timeout)
  }
}

export async function requestDnaS13StructuredOutput(input: Readonly<{
  name: string
  schema: Record<string, unknown>
  instructions: string
  content: string
  maxOutputTokens: number
  safetyIdentifier?: string | null
  apiKey?: string
  fetchImpl?: FetchLike
}>): Promise<DnaS13ProviderResult<unknown> | null> {
  const attempt = await requestDnaS13StructuredOutputDetailed(input)
  return attempt.ok ? attempt.result : null
}

function queryFrameSchema(topicIds: readonly string[]) {
  const allowedTopics = [...new Set([...topicIds, "unknown", "conversation.social", "product.help", "safety.refusal"])]
  return {
    type: "object",
    additionalProperties: false,
    required: ["normalizedQuestion", "responseDepth", "uncertain", "subquestions"],
    properties: {
      normalizedQuestion: { type: "string", minLength: 2, maxLength: 600 },
      responseDepth: { type: "string", enum: [...DNA_S13_DEPTHS] },
      uncertain: { type: "boolean" },
      subquestions: {
        type: "array", minItems: 1, maxItems: 2,
        items: {
          type: "object", additionalProperties: false,
          required: ["id", "question", "intent", "topicId", "focus", "questionType", "followUp", "correction", "comparisonTargetTopicIds", "answerabilityHint"],
          properties: {
            id: { type: "string", enum: ["q1", "q2"] },
            question: { type: "string", minLength: 2, maxLength: 400 },
            intent: { type: "string", enum: [...DNA_S13_INTENTS] },
            topicId: { type: "string", enum: allowedTopics },
            focus: { type: "string", enum: [...DNA_S13_FOCUS_VALUES] },
            questionType: { type: "string", enum: [...DNA_S13_QUESTION_TYPES] },
            followUp: { type: "boolean" },
            correction: { type: "boolean" },
            comparisonTargetTopicIds: { type: "array", minItems: 0, maxItems: 2, items: { type: "string", enum: allowedTopics } },
            answerabilityHint: { type: "string", enum: [...DNA_S13_ANSWERABILITY] },
          },
        },
      },
    },
  }
}

const realizationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "coveredSlots", "usedClaimIds", "usedSourceIds", "unsupportedAddition"],
  properties: {
    answer: { type: "string", minLength: 2, maxLength: 6_000 },
    coveredSlots: { type: "array", minItems: 0, maxItems: 8, items: { type: "string" } },
    usedClaimIds: { type: "array", minItems: 0, maxItems: 12, items: { type: "string" } },
    usedSourceIds: { type: "array", minItems: 0, maxItems: 12, items: { type: "string" } },
    unsupportedAddition: { type: "boolean" },
  },
} as const

export async function requestDnaS13QueryFrame(input: Readonly<{
  question: string
  responseDepth: "short" | "standard" | "deep"
  candidates: readonly DnaS13TopicCandidate[]
  conversation?: Readonly<{ topicIds: readonly string[]; focus?: string; questionType?: string }> | null
  safetyIdentifier?: string | null
  apiKey?: string
  fetchImpl?: FetchLike
}>): Promise<DnaS13ProviderResult<DnaS13QueryFrame> | null> {
  const candidate = await requestDnaS13StructuredOutput({
    name: "dna_s13_query_frame",
    schema: queryFrameSchema(input.candidates.map((item) => item.topicId)),
    instructions: [
      "Yalnız kullanıcının iletisini yapılandır; bilimsel cevap veya yeni bilgi üretme.",
      "En fazla iki bağımsız alt soru çıkar. Yalnız verilen topicId değerlerini kullan.",
      "Sayıyı, yaşı, olumsuzluğu, kesinlik düzeyini ve klinik eylem anlamını değiştirme.",
      "Takip ve düzeltme ifadelerinde verilen konuşma bağlamını yalnız yönlendirme ipucu olarak kullan.",
    ].join(" "),
    content: JSON.stringify({
      question: input.question,
      requestedDepth: input.responseDepth,
      conversation: input.conversation ?? null,
      candidates: input.candidates,
    }),
    maxOutputTokens: 420,
    safetyIdentifier: input.safetyIdentifier,
    apiKey: input.apiKey,
    fetchImpl: input.fetchImpl,
  })
  if (!candidate) return null
  const value = validateDnaS13QueryFrame(candidate.value, input.candidates.map((item) => item.topicId))
  if (!value || !preservesDnaS13QuestionMeaning(input.question, value)) return null
  return Object.freeze({ ...candidate, value })
}

export async function requestDnaS13Realization(input: Readonly<{
  question: string
  frame: DnaS13QueryFrame
  plan: DnaS13AnswerPlan
  slots: readonly DnaS13RequiredAnswerSlot[]
  claims: readonly DnaS13Claim[]
  repairFailureCodes?: readonly string[]
  previousCandidate?: string | null
  safetyIdentifier?: string | null
  apiKey?: string
  fetchImpl?: FetchLike
}>): Promise<DnaS13ProviderResult<DnaS13Realization> | null> {
  const candidate = await requestDnaS13StructuredOutput({
    name: input.repairFailureCodes?.length ? "dna_s13_grounded_repair" : "dna_s13_grounded_realization",
    schema: realizationSchema as unknown as Record<string, unknown>,
    instructions: [
      "Soruyu yalnız verilen claim metinleriyle doğrudan, açık ve doğal Türkçeyle yanıtla.",
      "Yeni olgu, örnek, sayı, kaynak, yaş kapsamı, biyolojik mekanizma, nedensellik veya klinik öneri ekleme.",
      "Her desteklenen required slotu cevapla; iki alt soruda iki slotu da atlama.",
      "Claim kimliklerini metinde gösterme. Teknik sınırlamayı yalnız gerçekten gerekli olduğunda kısa söyle.",
      "Kısaca: gibi mekanik bir açılışı zorunlu kullanma.",
      input.repairFailureCodes?.length ? `Önceki aday şu doğrulama hatalarını verdi: ${input.repairFailureCodes.join(", ")}. Bunları düzelt.` : "",
    ].filter(Boolean).join(" "),
    content: JSON.stringify({
      question: input.question,
      frame: input.frame,
      answerPlan: input.plan,
      slots: input.slots,
      claims: input.claims,
      previousCandidate: input.previousCandidate ?? null,
    }),
    maxOutputTokens: input.frame.responseDepth === "deep" ? 900 : input.frame.responseDepth === "short" ? 320 : 600,
    safetyIdentifier: input.safetyIdentifier,
    apiKey: input.apiKey,
    fetchImpl: input.fetchImpl,
  })
  if (!candidate) return null
  const value = validateDnaS13Realization(candidate.value)
  return value ? Object.freeze({ ...candidate, value }) : null
}

export async function requestDnaS13StrictRealization(input: Readonly<{
  question: string
  plan: DnaS13StrictPlan
  repairFailureCodes?: readonly string[]
  previousCandidate?: DnaS13StrictRealization | null
  safetyIdentifier?: string | null
  apiKey?: string
  fetchImpl?: FetchLike
}>): Promise<DnaS13ProviderResult<DnaS13StrictRealization> | null> {
  const candidate = await requestDnaS13StructuredOutput({
    name: input.repairFailureCodes?.length ? "dna_s13_strict_repair" : "dna_s13_strict_realization",
    schema: dnaS13StrictRealizationSchema(input.plan) as Record<string, unknown>,
    instructions: `${DNA_S13_STRICT_PROMPT_VERSION}. ${dnaS13StrictInstructions(input.repairFailureCodes)}`,
    content: dnaS13StrictContent(input.question, input.plan, input.previousCandidate),
    maxOutputTokens: input.plan.responseDepth === "deep" ? 1_100 : input.plan.responseDepth === "short" ? 320 : 760,
    safetyIdentifier: input.safetyIdentifier,
    apiKey: input.apiKey,
    fetchImpl: input.fetchImpl,
  })
  if (!candidate) return null
  const value = validateDnaS13StrictRealization(
    candidate.value,
    input.plan.slots.map((slot) => slot.id),
    input.plan.lockedClaimIds,
  )
  return value ? Object.freeze({ ...candidate, value }) : null
}

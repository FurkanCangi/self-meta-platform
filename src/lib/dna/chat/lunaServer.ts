import "server-only"

import {
  classifyDnaChatLunaEligibility,
  DNA_CHAT_LUNA_DOMAINS,
  DNA_CHAT_LUNA_MODEL,
  DNA_CHAT_LUNA_OPERATIONS,
  DNA_CHAT_LUNA_POLICY_VERSION,
  isExplicitDnaChatLanguagePolishRequest,
  shouldUseDnaChatLunaInterpretation,
  shouldPolishDnaChatAnswer,
  validateDnaChatLunaInterpretation,
  validateDnaChatLunaPolish,
  type DnaChatLunaTextUnit,
} from "./lunaPolicy"
import type { DnaChatApiPayload } from "./apiResolver"
import { routeDnaSemanticQuestion } from "./semanticRouter"

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
const REQUEST_TIMEOUT_MS = 5_000
const CIRCUIT_FAILURE_LIMIT = 3
const CIRCUIT_COOLDOWN_MS = 60_000

type LunaStageStatus = "applied" | "skipped" | "fallback"

export type DnaChatLunaLanguageSupport = Readonly<{
  policyVersion: typeof DNA_CHAT_LUNA_POLICY_VERSION
  model: typeof DNA_CHAT_LUNA_MODEL
  questionInterpretation: LunaStageStatus
  answerPolish: LunaStageStatus
}>

type LunaQuestionPreparation = Readonly<{
  payload: DnaChatApiPayload
  status: LunaStageStatus
}>

let consecutiveFailures = 0
let circuitOpenUntil = 0

function lunaEnabled(): boolean {
  const flag = String(process.env.DNA_CHAT_LUNA_ENABLED ?? "true").trim().toLowerCase()
  return flag !== "false" && Boolean(process.env.OPENAI_API_KEY?.trim())
}

function circuitAllowsRequest(): boolean {
  if (circuitOpenUntil <= Date.now()) {
    if (circuitOpenUntil) {
      circuitOpenUntil = 0
      consecutiveFailures = 0
    }
    return true
  }
  return false
}

function markSuccess() {
  consecutiveFailures = 0
  circuitOpenUntil = 0
}

function markFailure() {
  consecutiveFailures += 1
  if (consecutiveFailures >= CIRCUIT_FAILURE_LIMIT) {
    circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS
  }
}

function extractResponseText(payload: unknown): string | null {
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

async function requestStructuredLuna(input: Readonly<{
  name: string
  schema: Record<string, unknown>
  instructions: string
  content: string
  maxOutputTokens: number
}>): Promise<unknown | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey || !lunaEnabled() || !circuitAllowsRequest()) return null
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DNA_CHAT_LUNA_MODEL,
        store: false,
        reasoning: { effort: "none" },
        instructions: input.instructions,
        input: input.content,
        max_output_tokens: input.maxOutputTokens,
        text: {
          verbosity: "low",
          format: {
            type: "json_schema",
            name: input.name,
            strict: true,
            schema: input.schema,
          },
        },
      }),
      signal: controller.signal,
    })
    if (!response.ok) {
      markFailure()
      return null
    }
    const payload = await response.json() as unknown
    const text = extractResponseText(payload)
    if (!text) {
      markFailure()
      return null
    }
    try {
      const parsed = JSON.parse(text) as unknown
      return parsed
    } catch {
      markFailure()
      return null
    }
  } catch {
    markFailure()
    return null
  } finally {
    clearTimeout(timeout)
  }
}

const QUESTION_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["normalizedQuestion", "subquestions"],
  properties: {
    normalizedQuestion: { type: "string", minLength: 2, maxLength: 600 },
    subquestions: {
      type: "array",
      minItems: 1,
      maxItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "operation", "domain"],
        properties: {
          question: { type: "string", minLength: 2, maxLength: 400 },
          operation: { type: "string", enum: [...DNA_CHAT_LUNA_OPERATIONS] },
          domain: { type: "string", enum: [...DNA_CHAT_LUNA_DOMAINS] },
        },
      },
    },
  },
}

export async function prepareDnaChatQuestionWithLuna(
  payload: DnaChatApiPayload,
): Promise<LunaQuestionPreparation> {
  const eligibility = classifyDnaChatLunaEligibility({
    enabled: lunaEnabled() && circuitAllowsRequest(),
    question: payload.question,
    mode: payload.mode,
    reportId: payload.reportId,
  })
  if (!eligibility.eligible) return { payload, status: "skipped" }

  const conversationContext = payload.context?.topicIds?.length && payload.context.lastQueryKind
    ? {
        topicIds: payload.context.topicIds.slice(0, 2),
        lastQueryKind: payload.context.lastQueryKind,
      }
    : null
  const localDecision = routeDnaSemanticQuestion(payload.question, conversationContext)
  const normalized = payload.question.trim().toLocaleLowerCase("tr-TR")
  const isSimpleSocialMessage = /^(?:merhaba|selam|gunaydin|günaydın|iyi aksamlar|iyi akşamlar|tesekkur|teşekkür)[!. ]*$/.test(normalized)
  const shouldInterpret = shouldUseDnaChatLunaInterpretation({
    question: payload.question,
    inDomain: localDecision.inDomain,
    confidenceBand: localDecision.confidenceBand,
  })
  if (isSimpleSocialMessage || !shouldInterpret) {
    return { payload, status: "skipped" }
  }

  const candidate = await requestStructuredLuna({
    name: "dna_question_interpretation",
    schema: QUESTION_SCHEMA,
    maxOutputTokens: 220,
    instructions: [
      "Türkçe bir DNA Intelligence sorusunu yalnız anlam ve yönlendirme için düzenle.",
      "Soruyu cevaplama; bilimsel veya klinik bilgi ekleme.",
      "Yazım bozukluğunu düzelt, kullanıcının kesinlik, olumsuzluk, yaş ve kapsam anlamını aynen koru.",
      "En fazla iki bağımsız alt soru çıkar. Tanı, tedavi veya vaka yorumu üretme.",
    ].join(" "),
    content: payload.question,
  })
  if (!candidate) return { payload, status: "fallback" }
  const interpretation = validateDnaChatLunaInterpretation(payload.question, candidate)
  if (!interpretation) {
    markFailure()
    return { payload, status: "fallback" }
  }
  const normalizedEligibility = classifyDnaChatLunaEligibility({
    enabled: true,
    question: interpretation.normalizedQuestion,
    mode: payload.mode,
    reportId: payload.reportId,
  })
  if (!normalizedEligibility.eligible) {
    markFailure()
    return { payload, status: "fallback" }
  }
  markSuccess()
  return {
    payload: { ...payload, question: interpretation.normalizedQuestion },
    status: "applied",
  }
}

function polishableUnits(body: Record<string, unknown>): DnaChatLunaTextUnit[] {
  if (!Array.isArray(body.answerUnits)) return []
  return body.answerUnits.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return []
    const row = entry as Record<string, unknown>
    const sourceIds = Array.isArray(row.sourceIds)
      ? row.sourceIds.filter((value): value is string => typeof value === "string" && Boolean(value))
      : []
    const unit = {
      id: typeof row.id === "string" ? row.id : "",
      text: typeof row.text === "string" ? row.text : "",
      kind: typeof row.kind === "string" ? row.kind : "",
      role: typeof row.role === "string" ? row.role : "",
      sourceIds,
    }
    if (
      !unit.id
      || !unit.text
      || !sourceIds.length
      || unit.role === "case_finding"
      || unit.role === "safety_boundary"
      || unit.kind === "limitation"
      || unit.kind === "safety_boundary"
    ) return []
    return [unit]
  }).slice(0, 6)
}

export async function polishDnaChatPublicAnswerWithLuna(input: Readonly<{
  originalQuestion: string
  interpretedQuestion: string
  questionInterpretation: LunaStageStatus
  mode?: DnaChatApiPayload["mode"]
  reportId?: string
  body: Record<string, unknown>
}>): Promise<Readonly<{ body: Record<string, unknown>; status: LunaStageStatus }>> {
  if (!lunaEnabled() || !circuitAllowsRequest()) return { body: input.body, status: "skipped" }
  const eligibility = classifyDnaChatLunaEligibility({
    enabled: true,
    question: input.originalQuestion,
    mode: input.mode,
    reportId: input.reportId,
  })
  if (!eligibility.eligible) return { body: input.body, status: "skipped" }
  const units = polishableUnits(input.body)
  const shouldPolish = shouldPolishDnaChatAnswer({
    question: input.originalQuestion,
    classification: String(input.body.classification || ""),
    responseDepth: String(input.body.responseDepth || "standard"),
    runtimeGeneration: String(input.body.runtimeGeneration || ""),
    answerUnits: units,
  })
  if ((input.questionInterpretation !== "applied" && !shouldPolish) || !units.length) {
    return { body: input.body, status: "skipped" }
  }

  const unitSchema = {
    type: "object",
    additionalProperties: false,
    required: ["id", "text"],
    properties: {
      id: { type: "string", enum: units.map((unit) => unit.id) },
      text: { type: "string", minLength: 1, maxLength: 1_200 },
    },
  }
  const candidate = await requestStructuredLuna({
    name: "dna_answer_language_polish",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["units"],
      properties: {
        units: {
          type: "array",
          minItems: units.length,
          maxItems: units.length,
          items: unitSchema,
        },
      },
    },
    maxOutputTokens: 650,
    instructions: [
      "Aşağıdaki kaynak bağlı Türkçe cümlelerin yalnız anlatımını sadeleştir ve netleştir.",
      "Hiçbir olgu, teknik terim, sayı, olumsuzluk, kesinlik, nedensellik veya klinik yorum ekleme ya da çıkarma.",
      "Soruyu en doğrudan karşılayan cümleyi önce sırala. Her id tam bir kez dönsün. Kaynak, atıf veya yeni açıklama ekleme.",
      "Cümle zaten açıksa aynen koru. Yalnız dil editörüsün; soruya yeniden cevap verme.",
    ].join(" "),
    content: JSON.stringify({
      question: input.originalQuestion,
      interpretedQuestion: input.interpretedQuestion,
      units: units.map(({ id, text }) => ({ id, text })),
    }),
  })
  if (!candidate) return { body: input.body, status: "fallback" }
  const polished = validateDnaChatLunaPolish(units, candidate)
  if (!polished) {
    markFailure()
    return { body: input.body, status: "fallback" }
  }
  markSuccess()
  const textById = new Map(polished.map((unit) => [unit.id, unit.text]))
  const originalAnswerUnits = input.body.answerUnits as unknown[]
  const originalById = new Map<string, Record<string, unknown>>()
  for (const entry of originalAnswerUnits) {
    if (!entry || typeof entry !== "object") continue
    const row = entry as Record<string, unknown>
    if (typeof row.id === "string") originalById.set(row.id, row)
  }
  const polishedIds = new Set(polished.map((unit) => unit.id))
  const polishedUnits = polished.flatMap((unit) => {
    const original = originalById.get(unit.id)
    return original ? [{ ...original, text: textById.get(unit.id) ?? original.text }] : []
  })
  const untouchedUnits = originalAnswerUnits.filter((entry) => {
    if (!entry || typeof entry !== "object") return true
    const id = (entry as Record<string, unknown>).id
    return typeof id !== "string" || !polishedIds.has(id)
  })
  const answerUnits = [...polishedUnits, ...untouchedUnits]
  return { body: { ...input.body, answerUnits }, status: "applied" }
}

export function attachDnaChatLunaLanguageSupport(
  body: Record<string, unknown>,
  questionInterpretation: LunaStageStatus,
  answerPolish: LunaStageStatus,
): Record<string, unknown> {
  const languageSupport: DnaChatLunaLanguageSupport = Object.freeze({
    policyVersion: DNA_CHAT_LUNA_POLICY_VERSION,
    model: DNA_CHAT_LUNA_MODEL,
    questionInterpretation,
    answerPolish,
  })
  return { ...body, languageSupport }
}

export function getDnaChatLunaStatus() {
  return Object.freeze({
    enabled: lunaEnabled(),
    model: DNA_CHAT_LUNA_MODEL,
    policyVersion: DNA_CHAT_LUNA_POLICY_VERSION,
    circuitOpen: !circuitAllowsRequest(),
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
  })
}

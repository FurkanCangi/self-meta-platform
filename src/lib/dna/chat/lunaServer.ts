import "server-only"

import { createHash, createHmac } from "node:crypto"
import { checkRateLimit } from "@/lib/security/rateLimit"
import {
  classifyDnaChatLunaEligibility,
  DNA_CHAT_LUNA_MODEL,
  DNA_CHAT_LUNA_OPERATIONS,
  DNA_CHAT_LUNA_POLICY_VERSION,
  isExplicitDnaChatLanguagePolishRequest,
  shouldUseDnaChatLunaInterpretation,
  shouldPolishDnaChatAnswer,
  validateDnaChatLunaInterpretation,
  validateDnaChatLunaPolish,
  type DnaChatLunaOperation,
  type DnaChatLunaTextUnit,
} from "./lunaPolicy"
import {
  calculateDnaChatLunaUsage,
  DNA_CHAT_LUNA_MONTHLY_LIMITS,
  dnaChatLunaBudgetBand,
  type DnaChatLunaBudgetBand,
  type DnaChatLunaStage,
  type DnaChatLunaUsage,
} from "./lunaUsage"
import type { DnaChatApiPayload } from "./apiResolver"
import { getDnaSemanticTopicCandidates, routeDnaSemanticQuestion } from "./semanticRouter"
import { normalizeDnaChatText } from "./text"

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
const REQUEST_TIMEOUT_MS = 5_000
const CIRCUIT_FAILURE_LIMIT = 3
const CIRCUIT_COOLDOWN_MS = 60_000
const INTERPRETATION_MAX_OUTPUT_TOKENS = 220
const POLISH_MAX_OUTPUT_TOKENS = 450
const MAX_POLISH_UNITS = 4
const MAX_POLISH_CHARACTERS = 4_000

export type LunaStageStatus = "applied" | "skipped" | "fallback"
export type DnaChatLunaStageTrace = Readonly<{
  status: LunaStageStatus
  reason: string
  budgetBand: DnaChatLunaBudgetBand
  usage: DnaChatLunaUsage
  providerResponseId: string | null
}>

export type DnaChatLunaQuestionPreparation = Readonly<{
  payload: DnaChatApiPayload
  status: LunaStageStatus
  trace: DnaChatLunaStageTrace
}>

const ZERO_USAGE = Object.freeze({
  inputTokens: 0,
  cachedInputTokens: 0,
  outputTokens: 0,
  costMicrousd: 0,
}) satisfies DnaChatLunaUsage

let consecutiveFailures = 0
let circuitOpenUntil = 0
const warnedBudgetBuckets = new Set<string>()

function trace(
  status: LunaStageStatus,
  reason: string,
  input?: Partial<Pick<DnaChatLunaStageTrace, "budgetBand" | "usage" | "providerResponseId">>,
): DnaChatLunaStageTrace {
  return Object.freeze({
    status,
    reason,
    budgetBand: input?.budgetBand ?? "normal",
    usage: input?.usage ?? ZERO_USAGE,
    providerResponseId: input?.providerResponseId ?? null,
  })
}

function lunaEnabled(): boolean {
  const flag = String(process.env.DNA_CHAT_LUNA_ENABLED ?? "false").trim().toLowerCase()
  return ["1", "true", "on", "enabled"].includes(flag) && Boolean(process.env.OPENAI_API_KEY?.trim())
}

export function isDnaChatLunaRolloutSubjectEligible(
  subjectKey: string,
  percent = Number(process.env.DNA_CHAT_LUNA_ROLLOUT_PERCENT ?? 0),
) {
  const boundedPercent = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0
  if (!subjectKey.trim() || boundedPercent <= 0) return false
  if (boundedPercent >= 100) return true
  const bucket = Number.parseInt(createHash("sha256").update(subjectKey.trim()).digest("hex").slice(0, 8), 16) % 10_000
  return bucket < Math.round(boundedPercent * 100)
}

export function createDnaChatLunaSafetyIdentifier(userId: string): string | null {
  const secret = process.env.DNA_CHAT_LUNA_SAFETY_SECRET?.trim()
  if (!secret || secret.length < 32 || !userId.trim()) return null
  const digest = createHmac("sha256", secret).update(userId.trim()).digest("hex")
  return `dna_${digest.slice(0, 48)}`
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

function utcMonthKey(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
}

function millisecondsToNextUtcMonth(now = new Date()) {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  return Math.max(60_000, next - now.getTime())
}

async function reserveLunaStage(input: Readonly<{
  stage: DnaChatLunaStage
  lowConfidence?: boolean
  explicit?: boolean
}>): Promise<Readonly<{ allowed: boolean; band: DnaChatLunaBudgetBand; reason: string }>> {
  const limit = DNA_CHAT_LUNA_MONTHLY_LIMITS[input.stage]
  const month = utcMonthKey()
  const decision = await checkRateLimit({
    key: `dna-chat:luna:${month}:${input.stage}`,
    limit,
    windowMs: millisecondsToNextUtcMonth(),
  })
  if (!decision.backendAvailable) return { allowed: false, band: "exhausted", reason: "quota_backend_unavailable" }
  if (!decision.ok) return { allowed: false, band: "exhausted", reason: "monthly_quota_exhausted" }
  const band = dnaChatLunaBudgetBand(decision.remaining, limit)
  if (band === "warning") {
    const bucket = `${month}:${input.stage}`
    if (!warnedBudgetBuckets.has(bucket)) {
      warnedBudgetBuckets.add(bucket)
      console.warn("[dna-chat-luna] monthly usage warning", { month, stage: input.stage, band })
    }
  }
  if (input.stage === "polish") {
    if (band === "critical") return { allowed: false, band, reason: "critical_budget_polish_disabled" }
    if (band === "restricted" && !input.explicit) {
      return { allowed: false, band, reason: "automatic_polish_budget_disabled" }
    }
  }
  if (input.stage === "interpretation" && band === "critical" && !input.lowConfidence) {
    return { allowed: false, band, reason: "critical_budget_high_confidence_skipped" }
  }
  return { allowed: true, band, reason: "reserved" }
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

function extractUsage(payload: unknown): DnaChatLunaUsage {
  const row = payload && typeof payload === "object" ? payload as Record<string, unknown> : {}
  const usage = row.usage && typeof row.usage === "object"
    ? row.usage as Record<string, unknown>
    : {}
  const details = usage.input_tokens_details && typeof usage.input_tokens_details === "object"
    ? usage.input_tokens_details as Record<string, unknown>
    : {}
  return calculateDnaChatLunaUsage({
    inputTokens: usage.input_tokens,
    cachedInputTokens: details.cached_tokens,
    outputTokens: usage.output_tokens,
  })
}

type LunaRequestResult = Readonly<{
  value: unknown | null
  usage: DnaChatLunaUsage
  providerResponseId: string | null
}>

async function requestStructuredLuna(input: Readonly<{
  name: string
  schema: Record<string, unknown>
  instructions: string
  content: string
  maxOutputTokens: number
  safetyIdentifier?: string | null
}>): Promise<LunaRequestResult | null> {
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
        ...(input.safetyIdentifier ? { safety_identifier: input.safetyIdentifier } : {}),
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
    const row = payload && typeof payload === "object" ? payload as Record<string, unknown> : {}
    const text = extractResponseText(payload)
    let value: unknown | null = null
    if (text) {
      try {
        value = JSON.parse(text) as unknown
      } catch {
        value = null
      }
    }
    return Object.freeze({
      value,
      usage: extractUsage(payload),
      providerResponseId: typeof row.id === "string" ? row.id : null,
    })
  } catch {
    markFailure()
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function isSimpleSocialMessage(question: string) {
  const normalized = question.trim().toLocaleLowerCase("tr-TR")
  return /^(?:merhaba|selam|gunaydin|günaydın|iyi aksamlar|iyi akşamlar|tesekkur|teşekkür)[!. ]*$/.test(normalized)
}

function composeInterpretedQuestion(
  subquestions: readonly Readonly<{ question: string; topicId: string }>[],
  candidates: readonly Readonly<{ topicId: string; title: string }>[],
) {
  const titleById = new Map(candidates.map((candidate) => [candidate.topicId, candidate.title]))
  const framed = subquestions.map((entry) => {
    const title = titleById.get(entry.topicId)
    const question = entry.question.trim().replace(/[?!.]+$/u, "")
    return `${title ? `${title} hakkında: ` : ""}${question}?`
  })
  return framed.length === 1 ? framed[0] ?? "" : framed.join(" ")
}

function conversationKindForOperation(operation: DnaChatLunaOperation) {
  if (["definition", "comparison", "relation", "measurement", "development", "evidence"].includes(operation)) {
    return operation as "definition" | "comparison" | "relation" | "measurement" | "development" | "evidence"
  }
  return "unknown" as const
}

function contextualQuestionForSingleInterpretation(
  originalQuestion: string,
  operation: DnaChatLunaOperation,
) {
  const normalized = normalizeDnaChatText(originalQuestion)
  const carriesEssentialQualifier = /\b\d+(?:[.,]\d+)?\b/.test(originalQuestion) ||
    /\b(?:cocuk|ergen|yetiskin|bebek|yas|degil|yok|olmaz|olamaz|kesin|tani|tedavi|ilac|doz|prognoz)\w*\b/.test(normalized)
  if (carriesEssentialQualifier) return null
  if (operation === "definition" || operation === "follow_up") return "Bunu daha net açıkla."
  if (operation === "measurement") return "Bu nasıl ölçülür?"
  if (operation === "development") return "Bu gelişim boyunca nasıl değişir?"
  if (operation === "evidence") return "Bunun kanıtı nedir?"
  return null
}

export async function prepareDnaChatQuestionWithLuna(
  payload: DnaChatApiPayload,
  options: Readonly<{ safetyIdentifier?: string | null; rolloutSubjectKey?: string }> = {},
): Promise<DnaChatLunaQuestionPreparation> {
  if (!isDnaChatLunaRolloutSubjectEligible(options.rolloutSubjectKey ?? "")) {
    return { payload, status: "skipped", trace: trace("skipped", "rollout_not_selected") }
  }
  const eligibility = classifyDnaChatLunaEligibility({
    enabled: lunaEnabled() && circuitAllowsRequest(),
    question: payload.question,
    mode: payload.mode,
    reportId: payload.reportId,
  })
  if (!eligibility.eligible) {
    return { payload, status: "skipped", trace: trace("skipped", eligibility.reason) }
  }
  if (isSimpleSocialMessage(payload.question)) {
    return { payload, status: "skipped", trace: trace("skipped", "social_message") }
  }

  const conversationContext = payload.context?.topicIds?.length && payload.context.lastQueryKind
    ? { topicIds: payload.context.topicIds.slice(0, 2), lastQueryKind: payload.context.lastQueryKind }
    : null
  const localDecision = routeDnaSemanticQuestion(payload.question, conversationContext)
  const candidates = getDnaSemanticTopicCandidates(
    payload.question,
    payload.context?.topicIds?.[0] ?? payload.context?.previousTopic ?? null,
  )
  if (!candidates.length
    || (candidates[0]?.score ?? 0) <= 0
    || (!localDecision.inDomain && (candidates[0]?.confidence ?? 0) < 0.35)) {
    return { payload, status: "skipped", trace: trace("skipped", "no_supported_candidate") }
  }
  const shouldInterpret = shouldUseDnaChatLunaInterpretation({
    question: payload.question,
    inDomain: localDecision.inDomain,
    confidenceBand: localDecision.confidenceBand,
  })
  if (!shouldInterpret) {
    return { payload, status: "skipped", trace: trace("skipped", "clean_high_confidence") }
  }

  const reservation = await reserveLunaStage({
    stage: "interpretation",
    lowConfidence: localDecision.confidenceBand === "low",
  })
  if (!reservation.allowed) {
    return {
      payload,
      status: "skipped",
      trace: trace("skipped", reservation.reason, { budgetBand: reservation.band }),
    }
  }
  const candidateTopicIds = candidates.map((candidate) => candidate.topicId)
  const candidate = await requestStructuredLuna({
    name: "dna_question_interpretation",
    schema: {
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
            required: ["question", "operation", "topicId"],
            properties: {
              question: { type: "string", minLength: 2, maxLength: 400 },
              operation: { type: "string", enum: [...DNA_CHAT_LUNA_OPERATIONS] },
              topicId: { type: "string", enum: candidateTopicIds },
            },
          },
        },
      },
    },
    maxOutputTokens: INTERPRETATION_MAX_OUTPUT_TOKENS,
    safetyIdentifier: options.safetyIdentifier,
    instructions: [
      "Türkçe soruyu yalnız anlam ve yönlendirme için düzenle; cevap veya bilimsel bilgi üretme.",
      "Yazım bozukluğunu düzelt; sayı, yaş, olumsuzluk, kesinlik ve klinik eylem anlamını aynen koru.",
      "En fazla iki bağımsız alt soru çıkar ve her alt soru için yalnız verilen aday topicId değerlerinden birini seç.",
    ].join(" "),
    content: JSON.stringify({
      question: payload.question,
      candidates: candidates.map(({ topicId, title }) => ({ topicId, title })),
    }),
  })
  if (!candidate) {
    return {
      payload,
      status: "fallback",
      trace: trace("fallback", "provider_unavailable", { budgetBand: reservation.band }),
    }
  }
  const interpretation = validateDnaChatLunaInterpretation(
    payload.question,
    candidate.value,
    candidateTopicIds,
  )
  const commonTrace = {
    budgetBand: reservation.band,
    usage: candidate.usage,
    providerResponseId: candidate.providerResponseId,
  } as const
  if (!interpretation) {
    markFailure()
    return { payload, status: "fallback", trace: trace("fallback", "interpretation_guard_rejected", commonTrace) }
  }
  const explicitConversationRepair = /\b(?:hayir|kastim|demek istedigim|onu soruyordum|duzelt)\b/.test(
    normalizeDnaChatText(payload.question),
  )
  if (
    localDecision.inDomain &&
    !explicitConversationRepair &&
    interpretation.subquestions.some((entry) => entry.topicId !== candidates[0]?.topicId)
  ) {
    markFailure()
    return {
      payload,
      status: "fallback",
      trace: trace("fallback", "local_supported_topic_preserved", commonTrace),
    }
  }
  const interpretedQuestion = composeInterpretedQuestion(interpretation.subquestions, candidates)
  const single = interpretation.subquestions.length === 1 ? interpretation.subquestions[0] : null
  const contextualQuestion = single
    ? contextualQuestionForSingleInterpretation(payload.question, single.operation)
    : null
  const preparedQuestion = contextualQuestion ?? interpretedQuestion
  const normalizedEligibility = classifyDnaChatLunaEligibility({
    enabled: true,
    question: preparedQuestion,
    mode: payload.mode,
    reportId: payload.reportId,
  })
  if (!normalizedEligibility.eligible) {
    markFailure()
    return { payload, status: "fallback", trace: trace("fallback", "normalized_question_rejected", commonTrace) }
  }
  markSuccess()
  return {
    payload: {
      ...payload,
      question: preparedQuestion,
      context: contextualQuestion && single
        ? {
            ...payload.context,
            previousTopic: single.topicId,
            topicIds: [single.topicId],
            lastQueryKind: conversationKindForOperation(single.operation),
          }
        : payload.context,
    },
    status: "applied",
    trace: trace("applied", "candidate_selected", commonTrace),
  }
}

function polishableUnits(body: Record<string, unknown>): DnaChatLunaTextUnit[] {
  if (!Array.isArray(body.answerUnits)) return []
  const candidates = body.answerUnits.flatMap((entry) => {
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
    if (!unit.id || !unit.text || !sourceIds.length
      || unit.role === "case_finding" || unit.role === "safety_boundary"
      || unit.kind === "limitation" || unit.kind === "safety_boundary") return []
    return [unit]
  })
  const bounded: DnaChatLunaTextUnit[] = []
  let characters = 0
  for (const unit of candidates) {
    if (bounded.length >= MAX_POLISH_UNITS || characters + unit.text.length > MAX_POLISH_CHARACTERS) break
    bounded.push(unit)
    characters += unit.text.length
  }
  return bounded
}

function applyPolishedUnits(
  body: Record<string, unknown>,
  originals: readonly DnaChatLunaTextUnit[],
  polished: readonly Readonly<{ id: string; text: string }>[],
) {
  const textById = new Map(polished.map((unit) => [unit.id, unit.text]))
  const textByOriginal = new Map(originals.map((unit) => [unit.text, textById.get(unit.id) ?? unit.text]))
  const answerUnits = Array.isArray(body.answerUnits)
    ? body.answerUnits.map((entry) => {
        if (!entry || typeof entry !== "object") return entry
        const row = entry as Record<string, unknown>
        const replacement = typeof row.id === "string" ? textById.get(row.id) : null
        return replacement ? { ...row, text: replacement } : row
      })
    : []
  const summary = typeof body.summary === "string"
    ? textByOriginal.get(body.summary) ?? body.summary
    : body.summary
  const details = Array.isArray(body.details)
    ? body.details.map((detail) => typeof detail === "string" ? textByOriginal.get(detail) ?? detail : detail)
    : body.details
  return { ...body, summary, details, answerUnits }
}

export async function polishDnaChatPublicAnswerWithLuna(input: Readonly<{
  originalQuestion: string
  interpretedQuestion: string
  questionInterpretation: LunaStageStatus
  safetyIdentifier?: string | null
  rolloutSubjectKey?: string
  mode?: DnaChatApiPayload["mode"]
  reportId?: string
  body: Record<string, unknown>
}>): Promise<Readonly<{ body: Record<string, unknown>; status: LunaStageStatus; trace: DnaChatLunaStageTrace }>> {
  if (!isDnaChatLunaRolloutSubjectEligible(input.rolloutSubjectKey ?? "")) {
    return { body: input.body, status: "skipped", trace: trace("skipped", "rollout_not_selected") }
  }
  if (!lunaEnabled() || !circuitAllowsRequest()) {
    return { body: input.body, status: "skipped", trace: trace("skipped", "disabled_or_circuit_open") }
  }
  const eligibility = classifyDnaChatLunaEligibility({
    enabled: true,
    question: input.originalQuestion,
    mode: input.mode,
    reportId: input.reportId,
  })
  if (!eligibility.eligible) {
    return { body: input.body, status: "skipped", trace: trace("skipped", eligibility.reason) }
  }
  const units = polishableUnits(input.body)
  const shouldPolish = shouldPolishDnaChatAnswer({
    question: input.originalQuestion,
    classification: String(input.body.classification || ""),
    responseDepth: String(input.body.responseDepth || "standard"),
    runtimeGeneration: String(input.body.runtimeGeneration || ""),
    answerUnits: units,
    questionInterpretationApplied: input.questionInterpretation === "applied",
  })
  if (!shouldPolish || !units.length) {
    return { body: input.body, status: "skipped", trace: trace("skipped", "readability_not_required") }
  }
  const explicit = isExplicitDnaChatLanguagePolishRequest(input.originalQuestion)
  const reservation = await reserveLunaStage({ stage: "polish", explicit })
  if (!reservation.allowed) {
    return {
      body: input.body,
      status: "skipped",
      trace: trace("skipped", reservation.reason, { budgetBand: reservation.band }),
    }
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
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "text"],
            properties: {
              id: { type: "string", enum: units.map((unit) => unit.id) },
              text: { type: "string", minLength: 1, maxLength: 1_200 },
            },
          },
        },
      },
    },
    maxOutputTokens: POLISH_MAX_OUTPUT_TOKENS,
    safetyIdentifier: input.safetyIdentifier,
    instructions: [
      "Kaynak bağlı Türkçe cümlelerin yalnız anlatımını sadeleştir ve netleştir.",
      "Olgu, teknik terim, sayı, olumsuzluk, kesinlik, nedensellik veya klinik yorum ekleme ya da çıkarma.",
      "Her id tam bir kez ve verilen sırada dönsün; kaynak veya yeni açıklama ekleme.",
      "Cümle zaten açıksa aynen koru; yalnız dil editörüsün.",
    ].join(" "),
    content: JSON.stringify({
      question: input.originalQuestion,
      interpretedQuestion: input.interpretedQuestion,
      units: units.map(({ id, text }) => ({ id, text })),
    }),
  })
  if (!candidate) {
    return {
      body: input.body,
      status: "fallback",
      trace: trace("fallback", "provider_unavailable", { budgetBand: reservation.band }),
    }
  }
  const commonTrace = {
    budgetBand: reservation.band,
    usage: candidate.usage,
    providerResponseId: candidate.providerResponseId,
  } as const
  const polished = validateDnaChatLunaPolish(units, candidate.value)
  if (!polished) {
    markFailure()
    return {
      body: input.body,
      status: "fallback",
      trace: trace("fallback", "source_guard_rejected", commonTrace),
    }
  }
  markSuccess()
  return {
    body: applyPolishedUnits(input.body, units, polished),
    status: "applied",
    trace: trace("applied", "source_bound_polish", commonTrace),
  }
}

export function getDnaChatLunaStatus() {
  return Object.freeze({
    enabled: lunaEnabled(),
    model: DNA_CHAT_LUNA_MODEL,
    policyVersion: DNA_CHAT_LUNA_POLICY_VERSION,
    circuitOpen: !circuitAllowsRequest(),
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
    interpretationMaxOutputTokens: INTERPRETATION_MAX_OUTPUT_TOKENS,
    polishMaxOutputTokens: POLISH_MAX_OUTPUT_TOKENS,
    monthlyLimits: DNA_CHAT_LUNA_MONTHLY_LIMITS,
    rolloutPercent: Number(process.env.DNA_CHAT_LUNA_ROLLOUT_PERCENT ?? 0),
  })
}

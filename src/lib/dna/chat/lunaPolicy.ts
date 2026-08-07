import { inspectDnaChatSafety } from "./safety"
import { normalizeDnaChatText } from "./text"
import type { DnaChatMode } from "./types"

export const DNA_CHAT_LUNA_POLICY_VERSION = "dna-chat-luna-policy@3" as const
export const DNA_CHAT_LUNA_MODEL = "gpt-5.6-luna" as const

export const DNA_CHAT_LUNA_OPERATIONS = [
  "definition",
  "comparison",
  "relation",
  "measurement",
  "development",
  "evidence",
  "follow_up",
  "unknown",
] as const

export const DNA_CHAT_LUNA_DOMAINS = [
  "self_regulation",
  "central_nervous_system",
  "autonomic_nervous_system",
  "sympathetic_parasympathetic",
  "prefrontal_processes",
  "anterior_cingulate",
  "insula_interoception",
  "arousal_reactivity_recovery",
  "sensory_modulation",
  "emotional_regulation",
  "stress_systems",
  "sleep_circadian",
  "attention_working_memory",
  "executive_functions",
  "development_coregulation",
  "measurement_case_boundaries",
  "unknown",
] as const

export type DnaChatLunaOperation = typeof DNA_CHAT_LUNA_OPERATIONS[number]
export type DnaChatLunaDomain = typeof DNA_CHAT_LUNA_DOMAINS[number]

export type DnaChatLunaInterpretation = Readonly<{
  normalizedQuestion: string
  subquestions: readonly Readonly<{
    question: string
    operation: DnaChatLunaOperation
    topicId: string
  }>[]
}>

export type DnaChatLunaTextUnit = Readonly<{
  id: string
  text: string
  kind?: string
  role?: string
  sourceIds?: readonly string[]
}>

export type DnaChatLunaEligibility = Readonly<{
  eligible: boolean
  reason:
    | "eligible"
    | "disabled"
    | "case_context"
    | "safety_blocked"
    | "direct_identifier"
    | "invalid_question"
}>

const CASE_CONTEXT_PATTERNS = [
  "rapor",
  "vaka",
  "danisan",
  "danışan",
  "hasta",
  "cocukta",
  "çocukta",
  "bu cocuk",
  "bu çocuk",
  "seans",
  "anamnez",
  "degerlendirme sonucu",
  "değerlendirme sonucu",
  "profilinde",
] as const

const NEGATION_MARKERS = [
  "degil",
  "yok",
  "olmaz",
  "olamaz",
  "bulunmuyor",
  "gostermez",
  "kanitlamaz",
  "cikarilamaz",
] as const

const CLAIM_FORCE_MARKERS = [
  "kesin",
  "kanitlar",
  "gosterir",
  "neden olur",
  "yol acar",
  "zorunlu",
  "daima",
  "her zaman",
] as const

const CLINICAL_ACTION_MARKERS = [
  "tani",
  "tedavi",
  "ilac",
  "doz",
  "prognoz",
  "seans plani",
  "mudahale plani",
] as const

const AGE_SCOPE_MARKERS = [
  "bebek",
  "cocuk",
  "ergen",
  "yetiskin",
  "erken cocukluk",
  "okul oncesi",
] as const

const STYLE_ONLY_TOKENS = new Set([
  "acik",
  "acikca",
  "acidan",
  "anlatirsak",
  "anlasilir",
  "ayrica",
  "baska",
  "bakildiginda",
  "baglamda",
  "basa",
  "bazi",
  "biri",
  "bunu",
  "boylece",
  "daha",
  "deyişle",
  "deyisle",
  "dogrudan",
  "ise",
  "kisaca",
  "net",
  "olarak",
  "once",
  "ozetle",
  "sonra",
  "su",
  "sekilde",
  "temelde",
  "yani",
].map(normalizeDnaChatText))

function uniqueNumbers(value: string): string[] {
  return [...new Set(value.match(/\b\d+(?:[.,]\d+)?\b/g) ?? [])].sort()
}

function markerSignature(value: string, markers: readonly string[]): string[] {
  const normalized = normalizeDnaChatText(value)
  return markers.filter((marker) => {
    const normalizedMarker = normalizeDnaChatText(marker)
    const escaped = normalizedMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    if (normalizedMarker === "degil") return /\bdegil\w*\b/.test(normalized)
    return new RegExp(`(?:^|\\s)${escaped}(?:$|\\s)`).test(normalized)
  }).sort()
}

function ageScopeSignature(value: string): string[] {
  const normalized = normalizeDnaChatText(value)
  return AGE_SCOPE_MARKERS.filter((marker) => {
    const normalizedMarker = normalizeDnaChatText(marker)
    const escaped = normalizedMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return new RegExp(`(?:^|\\s)${escaped}\\w*(?:$|\\s)`).test(normalized)
  }).sort()
}

function meaningfulTokens(value: string): string[] {
  return normalizeDnaChatText(value)
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
    .filter((token) => token.length >= 4)
}

function tokenFamily(token: string): string {
  return token.length <= 6 ? token : token.slice(0, 6)
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

export function classifyDnaChatLunaEligibility(input: Readonly<{
  enabled: boolean
  question: string
  mode?: DnaChatMode
  reportId?: string
}>): DnaChatLunaEligibility {
  if (!input.enabled) return { eligible: false, reason: "disabled" }
  const question = String(input.question || "").trim()
  if (question.length < 2 || question.length > 600) {
    return { eligible: false, reason: "invalid_question" }
  }
  if (input.mode === "case" || input.reportId) {
    return { eligible: false, reason: "case_context" }
  }
  const safety = inspectDnaChatSafety(question)
  if (safety.blocked) {
    return {
      eligible: false,
      reason: safety.category === "privacy" ? "direct_identifier" : "safety_blocked",
    }
  }
  const normalized = normalizeDnaChatText(question)
  if (CASE_CONTEXT_PATTERNS.some((pattern) => normalized.includes(normalizeDnaChatText(pattern)))) {
    return { eligible: false, reason: "case_context" }
  }
  return { eligible: true, reason: "eligible" }
}

export function validateDnaChatLunaInterpretation(
  originalQuestion: string,
  candidate: unknown,
  allowedTopicIds: readonly string[],
): DnaChatLunaInterpretation | null {
  if (!candidate || typeof candidate !== "object") return null
  const row = candidate as Record<string, unknown>
  const normalizedQuestion = typeof row.normalizedQuestion === "string"
    ? row.normalizedQuestion.trim()
    : ""
  if (normalizedQuestion.length < 2 || normalizedQuestion.length > 600) return null
  if (!Array.isArray(row.subquestions) || row.subquestions.length < 1 || row.subquestions.length > 2) return null

  const parsedSubquestions = row.subquestions.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return []
    const item = entry as Record<string, unknown>
    const question = typeof item.question === "string" ? item.question.trim() : ""
    const operation = typeof item.operation === "string" ? item.operation as DnaChatLunaOperation : "unknown"
    const topicId = typeof item.topicId === "string" ? item.topicId.trim() : ""
    if (
      question.length < 2
      || question.length > 400
      || !DNA_CHAT_LUNA_OPERATIONS.includes(operation)
      || !allowedTopicIds.includes(topicId)
    ) return []
    return [{ question, operation, topicId }]
  })
  if (parsedSubquestions.length !== row.subquestions.length) return null

  const original = String(originalQuestion || "").trim()
  const normalizedOriginal = normalizeDnaChatText(original)
  const isConversationCorrection = /^(?:hayir|yok)\b.+\b(?:sordum|soruyorum|soruyordum|kastim|demek istedigim)\b/.test(
    normalizedOriginal,
  )
  const isSpellingRepair = /^(?:notumda|notlarimda|mesajda|soruda)\b.+\b(?:yazmisim|yazilmis|geciyor)\b/.test(
    normalizedOriginal,
  )
  const isSingleTopicCorrection = isConversationCorrection || isSpellingRepair
  const subquestions = isSpellingRepair && parsedSubquestions.length === 2 &&
    parsedSubquestions[0]?.topicId === parsedSubquestions[1]?.topicId
    ? [parsedSubquestions[0]!]
    : parsedSubquestions
  if (isSingleTopicCorrection && subquestions.length !== 1) return null
  const combinedSubquestions = subquestions.map((entry) => entry.question).join(" ")
  if (!sameStringArray(uniqueNumbers(original), uniqueNumbers(normalizedQuestion))) return null
  if (!sameStringArray(uniqueNumbers(original), uniqueNumbers(combinedSubquestions))) return null
  for (const markers of [NEGATION_MARKERS, CLAIM_FORCE_MARKERS, CLINICAL_ACTION_MARKERS] as const) {
    if (!sameStringArray(markerSignature(original, markers), markerSignature(normalizedQuestion, markers))) {
      return null
    }
    if (!sameStringArray(markerSignature(original, markers), markerSignature(combinedSubquestions, markers))) {
      return null
    }
  }
  const originalAgeScope = ageScopeSignature(original)
  if (!sameStringArray(originalAgeScope, ageScopeSignature(normalizedQuestion))) return null
  if (!sameStringArray(originalAgeScope, ageScopeSignature(combinedSubquestions))) return null
  const originalFamilies = new Set(meaningfulTokens(original).map(tokenFamily))
  const normalizedFamilies = new Set(meaningfulTokens(normalizedQuestion).map(tokenFamily))
  const shared = [...originalFamilies].filter((family) => normalizedFamilies.has(family)).length
  const combinedFamilies = new Set(meaningfulTokens(combinedSubquestions).map(tokenFamily))
  const combinedShared = [...originalFamilies].filter((family) => combinedFamilies.has(family)).length
  if (originalFamilies.size >= 3 && shared / originalFamilies.size < 0.24) return null
  if (originalFamilies.size >= 3 && combinedShared / originalFamilies.size < 0.18) return null

  return Object.freeze({
    normalizedQuestion,
    subquestions: Object.freeze(subquestions.map((entry) => Object.freeze(entry))),
  })
}

export function shouldPolishDnaChatAnswer(input: Readonly<{
  question: string
  classification: string
  responseDepth: string
  runtimeGeneration: string
  answerUnits: readonly DnaChatLunaTextUnit[]
  questionInterpretationApplied?: boolean
}>): boolean {
  if (input.runtimeGeneration !== "v2_legacy") return false
  if (["refusal", "not_available", "clarification"].includes(input.classification)) return false
  const eligibleUnits = input.answerUnits.filter((unit) =>
    unit.role !== "case_finding"
    && unit.role !== "safety_boundary"
    && unit.kind !== "limitation"
    && unit.kind !== "safety_boundary"
    && (unit.sourceIds?.length ?? 0) > 0)
  if (!eligibleUnits.length) return false
  if (isExplicitDnaChatLanguagePolishRequest(input.question)) return true
  const combinedText = eligibleUnits.map((unit) => unit.text).join(" ")
  if (scoreDnaChatReadability(combinedText) < 0.75) return true
  return Boolean(input.questionInterpretationApplied && eligibleUnits.length > 1)
}

export function scoreDnaChatReadability(text: string): number {
  const trimmed = String(text || "").trim()
  if (!trimmed) return 1
  const sentences = trimmed.split(/[.!?]+/u).map((value) => value.trim()).filter(Boolean)
  const words = normalizeDnaChatText(trimmed).split(" ").filter(Boolean)
  const averageSentence = words.length / Math.max(1, sentences.length)
  const longWords = words.filter((word) => word.length >= 12).length
  const punctuationDensity = (trimmed.match(/[;:()]/g) ?? []).length / Math.max(1, sentences.length)
  let score = 1
  if (averageSentence > 22) score -= Math.min(0.24, (averageSentence - 22) * 0.012)
  if (longWords / Math.max(1, words.length) > 0.16) score -= 0.12
  if (punctuationDensity > 1.25) score -= 0.1
  if (trimmed.length > 900) score -= 0.08
  return Number(Math.max(0, Math.min(1, score)).toFixed(6))
}

export function isExplicitDnaChatLanguagePolishRequest(question: string): boolean {
  const normalizedQuestion = normalizeDnaChatText(question)
  return /\b(?:daha basit|acik anlat|anlasilir|baska turlu|biraz ac)\b/.test(normalizedQuestion)
}

export function shouldUseDnaChatLunaInterpretation(input: Readonly<{
  question: string
  inDomain: boolean
  confidenceBand: "high" | "medium" | "low"
  runnerUpGap?: number
  topCandidateConfidence?: number
}>): boolean {
  if (!input.inDomain || input.confidenceBand !== "high") return true
  const normalized = normalizeDnaChatText(input.question)
  const hasClosingPunctuation = /[?!.]\s*$/.test(input.question)
  const looksNoisyOrConversational = /\b(?:bisi|bisey|sey|falan|hani|nasi|nap|neydi|gibi bi|tarzi|sanki|acaba ya|notumda|yazmisim|yanlis yaz|dogrusu ne|ne demek istedim)\b/.test(normalized)
  const explicitConversationRepair = /\b(?:hayir|kastim|demek istedigim|onu soruyordum|duzelt)\b/.test(normalized)
  const closeCandidates = Number.isFinite(input.runnerUpGap) &&
    Number(input.runnerUpGap) < 0.14 &&
    Number(input.topCandidateConfidence ?? 0) < 0.9
  return explicitConversationRepair || !hasClosingPunctuation || looksNoisyOrConversational || closeCandidates
}

export function shouldPreserveLocalDnaChatTopic(input: Readonly<{
  question: string
  inDomain: boolean
  confidenceBand: "high" | "medium" | "low"
  runnerUpGap: number
  topCandidateConfidence: number
  selectedTopicIds: readonly string[]
  topTopicId?: string | null
  contextTopicIds?: readonly string[]
}>): boolean {
  if (!input.topTopicId || input.selectedTopicIds.every((topicId) => topicId === input.topTopicId)) return false
  const normalized = normalizeDnaChatText(input.question)
  const explicitConversationRepair = /\b(?:hayir|kastim|demek istedigim|onu soruyordum|duzelt)\b/.test(normalized)
  const noisyOrConversational = /\b(?:bisi|bisey|sey|falan|hani|nasi|nap|neydi|gibi bi|tarzi|sanki|acaba ya|notumda|yazmisim|yanlis yaz|dogrusu ne|ne demek istedim)\b/.test(normalized)
  const validatedContextTopics = new Set(input.contextTopicIds ?? [])
  const explicitSameTopicContinuation = validatedContextTopics.size > 0 &&
    /\b(?:onceki|az onceki|ayni kapsamda|baska basliga gecmeyelim)\b/.test(normalized)
  if (
    explicitSameTopicContinuation &&
    input.selectedTopicIds.some((topicId) => !validatedContextTopics.has(topicId))
  ) return true
  return input.inDomain &&
    input.confidenceBand === "high" &&
    input.topCandidateConfidence >= 0.75 &&
    input.runnerUpGap >= 0.16 &&
    !explicitConversationRepair &&
    !noisyOrConversational
}

export function validateDnaChatLunaPolish(
  originals: readonly DnaChatLunaTextUnit[],
  candidate: unknown,
): readonly Readonly<{ id: string; text: string }>[] | null {
  if (!candidate || typeof candidate !== "object") return null
  const row = candidate as Record<string, unknown>
  if (!Array.isArray(row.units) || row.units.length !== originals.length) return null
  const originalById = new Map(originals.map((unit) => [unit.id, unit]))
  const seen = new Set<string>()
  const polished: Array<Readonly<{ id: string; text: string }>> = []

  for (const [index, entry] of row.units.entries()) {
    if (!entry || typeof entry !== "object") return null
    const unit = entry as Record<string, unknown>
    const id = typeof unit.id === "string" ? unit.id : ""
    const text = typeof unit.text === "string" ? unit.text.trim() : ""
    const original = originalById.get(id)
    if (!original || originals[index]?.id !== id || seen.has(id) || !text) return null
    if (text.length < original.text.length * 0.62 || text.length > original.text.length * 1.38) return null
    if (!sameStringArray(uniqueNumbers(original.text), uniqueNumbers(text))) return null
    for (const markers of [NEGATION_MARKERS, CLAIM_FORCE_MARKERS, CLINICAL_ACTION_MARKERS] as const) {
      if (!sameStringArray(markerSignature(original.text, markers), markerSignature(text, markers))) return null
    }

    const originalFamilies = new Set(meaningfulTokens(original.text).map(tokenFamily))
    const candidateTokens = meaningfulTokens(text)
    const candidateFamilies = new Set(candidateTokens.map(tokenFamily))
    const retained = [...originalFamilies].filter((family) => candidateFamilies.has(family)).length
    if (originalFamilies.size >= 3 && retained / originalFamilies.size < 0.72) return null
    const unsupported = candidateTokens.filter((token) =>
      !originalFamilies.has(tokenFamily(token)) && !STYLE_ONLY_TOKENS.has(token))
    if (unsupported.length > Math.max(1, Math.floor(candidateTokens.length * 0.08))) return null

    seen.add(id)
    polished.push(Object.freeze({ id, text }))
  }
  if (seen.size !== originals.length) return null
  return Object.freeze(polished)
}

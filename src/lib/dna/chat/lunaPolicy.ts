import { inspectDnaChatSafety } from "./safety"
import { normalizeDnaChatText } from "./text"
import type { DnaChatMode } from "./types"

export const DNA_CHAT_LUNA_POLICY_VERSION = "dna-chat-luna-policy@1" as const
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
    domain: DnaChatLunaDomain
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
): DnaChatLunaInterpretation | null {
  if (!candidate || typeof candidate !== "object") return null
  const row = candidate as Record<string, unknown>
  const normalizedQuestion = typeof row.normalizedQuestion === "string"
    ? row.normalizedQuestion.trim()
    : ""
  if (normalizedQuestion.length < 2 || normalizedQuestion.length > 600) return null
  if (!Array.isArray(row.subquestions) || row.subquestions.length < 1 || row.subquestions.length > 2) return null

  const subquestions = row.subquestions.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return []
    const item = entry as Record<string, unknown>
    const question = typeof item.question === "string" ? item.question.trim() : ""
    const operation = typeof item.operation === "string" ? item.operation as DnaChatLunaOperation : "unknown"
    const domain = typeof item.domain === "string" ? item.domain as DnaChatLunaDomain : "unknown"
    if (
      question.length < 2
      || question.length > 400
      || !DNA_CHAT_LUNA_OPERATIONS.includes(operation)
      || !DNA_CHAT_LUNA_DOMAINS.includes(domain)
    ) return []
    return [{ question, operation, domain }]
  })
  if (subquestions.length !== row.subquestions.length) return null

  const original = String(originalQuestion || "").trim()
  if (!sameStringArray(uniqueNumbers(original), uniqueNumbers(normalizedQuestion))) return null
  for (const markers of [NEGATION_MARKERS, CLAIM_FORCE_MARKERS, CLINICAL_ACTION_MARKERS] as const) {
    if (!sameStringArray(markerSignature(original, markers), markerSignature(normalizedQuestion, markers))) {
      return null
    }
  }
  const originalFamilies = new Set(meaningfulTokens(original).map(tokenFamily))
  const normalizedFamilies = new Set(meaningfulTokens(normalizedQuestion).map(tokenFamily))
  const shared = [...originalFamilies].filter((family) => normalizedFamilies.has(family)).length
  if (originalFamilies.size >= 3 && shared / originalFamilies.size < 0.34) return null

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
  const normalizedQuestion = normalizeDnaChatText(input.question)
  if (isExplicitDnaChatLanguagePolishRequest(input.question)) return true
  // Stable 20% sampling keeps the optional second model call bounded while
  // spreading language QA across real question shapes without storing them.
  let hash = 2166136261
  for (const character of normalizedQuestion) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % 100 < 20
}

export function isExplicitDnaChatLanguagePolishRequest(question: string): boolean {
  const normalizedQuestion = normalizeDnaChatText(question)
  return /\b(?:daha basit|acik anlat|anlasilir|baska turlu|biraz ac)\b/.test(normalizedQuestion)
}

export function shouldUseDnaChatLunaInterpretation(input: Readonly<{
  question: string
  inDomain: boolean
  confidenceBand: "high" | "medium" | "low"
}>): boolean {
  if (!input.inDomain || input.confidenceBand !== "high") return true
  const normalized = normalizeDnaChatText(input.question)
  const hasClosingPunctuation = /[?!.]\s*$/.test(input.question)
  const looksNoisyOrConversational = /\b(?:bisi|bisey|sey|falan|hani|nasi|nap|neydi|gibi bi|tarzi|sanki|acaba ya)\b/.test(normalized)
  return !hasClosingPunctuation || looksNoisyOrConversational
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

  for (const entry of row.units) {
    if (!entry || typeof entry !== "object") return null
    const unit = entry as Record<string, unknown>
    const id = typeof unit.id === "string" ? unit.id : ""
    const text = typeof unit.text === "string" ? unit.text.trim() : ""
    const original = originalById.get(id)
    if (!original || seen.has(id) || !text) return null
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

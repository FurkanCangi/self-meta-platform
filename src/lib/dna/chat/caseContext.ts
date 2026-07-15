import { redactReportTextForPrivacy } from "../reportPrivacy"
import {
  DNA_CHAT_DOMAIN_KEYS,
  type DnaChatCaseContextInput,
  type DnaChatDomainKey,
  type DnaChatDomainLevel,
  type DnaChatSafeCaseContext,
} from "./types"
import { stableUnique } from "./text"

const DIRECT_IDENTIFIER_PATTERNS = [
  /\b[1-9][0-9]{10}\b/g,
  /\b\d{1,2}[./-]\d{1,2}[./-](?:19|20)\d{2}\b/g,
  /\b(?:ad(?:\s+soyad)?|soyad|isim|hasta|danışan|danisan|çocuk|cocuk)\s*[:=-]\s*[^,;.\n]{1,80}/gi,
  /\b(?:protokol|dosya|hasta)\s*(?:no|numarası|numarasi)?\s*[:=-]\s*[A-Z0-9/-]{4,}\b/gi,
  /\b[A-ZÇĞİÖŞÜ][a-zçğıöşü]{1,}(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]{1,}){1,2}\b/g,
  /\b[A-ZÇĞİÖŞÜ]{2,}(?:\s+[A-ZÇĞİÖŞÜ]{2,})+\b/g,
] as const

const SAFE_LEVELS = new Set<DnaChatDomainLevel>(["Tipik", "Riskli", "Atipik"])

type SanitizedText = { value: string; redactions: number }

function sanitizeCaseText(value: unknown, maxLength = 360): SanitizedText {
  const original = String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength)
  if (!original) return { value: "", redactions: 0 }
  let redacted = redactReportTextForPrivacy(original)
  for (const pattern of DIRECT_IDENTIFIER_PATTERNS) {
    redacted = redacted.replace(pattern, "[kişisel bilgi gizlendi]")
  }
  const redactions = redacted === original ? 0 : 1
  return { value: redacted.replace(/\s+/g, " ").trim(), redactions }
}

function sanitizeList(values: unknown, limit = 8): { values: string[]; redactions: number } {
  if (!Array.isArray(values)) return { values: [], redactions: 0 }
  let redactions = 0
  const sanitized = values.slice(0, limit).map((value) => {
    const result = sanitizeCaseText(value)
    redactions += result.redactions
    return result.value
  })
  return { values: stableUnique(sanitized, limit), redactions }
}

function sanitizeOptionalText(value: unknown): SanitizedText {
  if (value == null) return { value: "", redactions: 0 }
  return sanitizeCaseText(value)
}

function sanitizeScores(value: unknown): Partial<Record<DnaChatDomainKey, number>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const record = value as Record<string, unknown>
  const result: Partial<Record<DnaChatDomainKey, number>> = {}
  for (const domain of DNA_CHAT_DOMAIN_KEYS) {
    const score = Number(record[domain])
    if (Number.isFinite(score) && score >= 0 && score <= 50) {
      result[domain] = Number(score.toFixed(2))
    }
  }
  return result
}

function sanitizeLevels(value: unknown): Partial<Record<DnaChatDomainKey, DnaChatDomainLevel>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const record = value as Record<string, unknown>
  const result: Partial<Record<DnaChatDomainKey, DnaChatDomainLevel>> = {}
  for (const domain of DNA_CHAT_DOMAIN_KEYS) {
    const level = record[domain]
    if (typeof level === "string" && SAFE_LEVELS.has(level as DnaChatDomainLevel)) {
      result[domain] = level as DnaChatDomainLevel
    }
  }
  return result
}

function sanitizeCaseId(value: unknown): { value: string | null; redactions: number } {
  if (typeof value !== "string" || !value.trim()) return { value: null, redactions: 0 }
  const clean = value.trim()
  if (/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(clean)) {
    return { value: clean, redactions: 0 }
  }
  return { value: null, redactions: 1 }
}

export function createDnaChatSafeCaseContext(
  input: DnaChatCaseContextInput | DnaChatSafeCaseContext,
): DnaChatSafeCaseContext {
  if (!input || !["synthetic", "deidentified"].includes(input.dataStatus)) {
    throw new Error("dna_chat_case_context_requires_synthetic_or_deidentified_status")
  }

  const raw = input as DnaChatCaseContextInput
  const previousSafeContext = input as Partial<DnaChatSafeCaseContext>
  const inheritedRedactionCount =
    previousSafeContext.safe === true &&
    Number.isSafeInteger(previousSafeContext.redactionCount) &&
    Number(previousSafeContext.redactionCount) > 0
      ? Number(previousSafeContext.redactionCount)
      : 0
  const chat = raw.chatContext ?? {}
  const caseId = sanitizeCaseId(raw.caseId)
  const themes = sanitizeList(raw.themes)
  const observations = sanitizeList(raw.observations)
  const externalFindings = sanitizeList(raw.externalFindings)
  const primaryAxis = sanitizeOptionalText(chat.primaryAxis)
  const secondaryAxes = sanitizeList(chat.secondaryAxes)
  const mechanismLabel = sanitizeOptionalText(chat.mechanismLabel)
  const mechanismSummary = sanitizeOptionalText(chat.mechanismSummary)
  const evidence = sanitizeList(chat.caseEvidenceLines ?? chat.evidence, 10)
  const counterEvidence = sanitizeList(chat.counterEvidenceLines ?? chat.counterEvidence, 8)
  const preservedCapacities = sanitizeList(
    chat.preservedCapacityLines ?? chat.preservedCapacities,
    8,
  )
  const confidence = sanitizeOptionalText(chat.confidenceLevel ?? chat.confidence)
  const confidenceRationale = sanitizeOptionalText(chat.confidenceRationale)
  const limitations = sanitizeList(chat.dataLimitations ?? chat.limitations, 8)
  const weakDomains = sanitizeList(chat.weakDomains, 6)
  const strongDomains = sanitizeList(chat.strongDomains, 6)
  const patterns = sanitizeList(chat.patterns, 8)

  const age = Number(raw.ageMonths)
  const ageMonths = Number.isFinite(age) && age >= 0 && age <= 216 ? Math.round(age) : null
  const detectedRedactionCount = [
    caseId.redactions,
    themes.redactions,
    observations.redactions,
    externalFindings.redactions,
    primaryAxis.redactions,
    secondaryAxes.redactions,
    mechanismLabel.redactions,
    mechanismSummary.redactions,
    evidence.redactions,
    counterEvidence.redactions,
    preservedCapacities.redactions,
    confidence.redactions,
    confidenceRationale.redactions,
    limitations.redactions,
    weakDomains.redactions,
    strongDomains.redactions,
    patterns.redactions,
  ].reduce((sum, count) => sum + count, 0)
  const redactionCount = Math.min(
    Number.MAX_SAFE_INTEGER,
    inheritedRedactionCount + detectedRedactionCount,
  )

  return Object.freeze({
    safe: true as const,
    dataStatus: raw.dataStatus,
    caseId: caseId.value,
    ageMonths,
    scores: Object.freeze(sanitizeScores(raw.scores)),
    levels: Object.freeze(sanitizeLevels(raw.levels)),
    themes: Object.freeze(themes.values),
    observations: Object.freeze(observations.values),
    externalFindings: Object.freeze(externalFindings.values),
    chatContext: Object.freeze({
      primaryAxis: primaryAxis.value || null,
      secondaryAxes: Object.freeze(secondaryAxes.values),
      mechanismLabel: mechanismLabel.value || null,
      mechanismSummary: mechanismSummary.value || null,
      evidence: Object.freeze(evidence.values),
      counterEvidence: Object.freeze(counterEvidence.values),
      preservedCapacities: Object.freeze(preservedCapacities.values),
      confidence: confidence.value || null,
      confidenceRationale: confidenceRationale.value || null,
      limitations: Object.freeze(limitations.values),
      weakDomains: Object.freeze(weakDomains.values),
      strongDomains: Object.freeze(strongDomains.values),
      patterns: Object.freeze(patterns.values),
    }),
    redactionCount,
  }) as DnaChatSafeCaseContext
}

export function hasUsableDnaCaseContext(context: DnaChatSafeCaseContext): boolean {
  return Boolean(
    Object.keys(context.scores).length ||
      Object.keys(context.levels).length ||
      context.themes.length ||
      context.observations.length ||
      context.externalFindings.length ||
      context.chatContext.primaryAxis ||
      context.chatContext.evidence.length ||
      context.chatContext.weakDomains.length ||
      context.chatContext.strongDomains.length,
  )
}

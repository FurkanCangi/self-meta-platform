import { createHash } from "node:crypto"
import { redactReportTextForPrivacy } from "../reportPrivacy"
import {
  DNA_CHAT_DOMAIN_KEYS,
  type DnaChatCaseContextInput,
  type DnaChatDomainKey,
  type DnaChatDomainLevel,
  type DnaChatSafeCaseContext,
} from "./types"
import { stableUnique } from "./text"
import {
  createPendingCaseAuthority,
  createSyntheticCaseAuthority,
  isReleaseEligibleAuthority,
  type DnaCaseAuthorityRef,
} from "./knowledgeAuthority"
import { normalizeDnaChatText } from "./text"

const SAFE_REPORT_CONTEXT_VERSION = "dna-chat-context@1" as const
const CASE_CONTEXT_AUTHORITIES = new WeakMap<object, DnaCaseAuthorityRef>()

const DIRECT_IDENTIFIER_PATTERNS = [
  /\b[1-9][0-9]{10}\b/g,
  /\b\d{1,2}[./-]\d{1,2}[./-](?:19|20)\d{2}\b/g,
  /\b(?:ad(?:\s+soyad)?|soyad|isim|hasta|danışan|danisan|çocuk|cocuk)\s*[:=-]\s*[^,;.\n]{1,80}/gi,
  /\b(?:protokol|dosya|hasta)\s*(?:no|numarası|numarasi)?\s*[:=-]\s*[A-Z0-9/-]{4,}\b/gi,
  /\b[A-ZÇĞİÖŞÜ][a-zçğıöşü]{1,}(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]{1,}){1,2}\b/g,
  /\b[A-ZÇĞİÖŞÜ]{2,}(?:\s+[A-ZÇĞİÖŞÜ]{2,})+\b/g,
] as const

const SAFE_LEVELS = new Set<DnaChatDomainLevel>(["Tipik", "Riskli", "Atipik"])

type SanitizedText = { value: string; redactions: number; unsafeClaims: number }

const CASE_BIOLOGICAL_SUBJECT =
  /\b(?:vagus\w*|vagal\w*|sempatik\w*|parasempatik\w*|otonom\w*|merkezi\s+sinir\w*|sinir\s+sistem\w*|insula\w*|insular\w*|korteks\w*|kortikal\w*|amigdala\w*|prefrontal\w*|singulat\w*|beyin\s+sap\w*|beyin\s+bolge\w*|nor(?:al|on)\w*|kortizol\w*|adrenalin\w*|noradrenalin\w*|norepinefrin\w*|dopamin\w*|serotonin\w*|oksitosin\w*|melatonin\w*|gaba|glutamat\w*|norotransmitter\w*|hormon\w*|endokrin\w*|bagisiklik\w*|inflamasyon\w*|sitokin\w*|hrv|eda|hpa|eeg|fmri|bold|elektrodermal\w*|pupil\w*|respiratuvar\s+sinus\w*|kalp\s+(?:hiz\w*|atim\w*)\s+degisken\w*|dorsal\s+vagal\w*|ventral\s+vagal\w*)\b/
const CASE_BIOLOGICAL_MEASUREMENT =
  /\b(?:vagal\w*\s+ton\w*|dorsal\s+vagal\w*|ventral\s+vagal\w*|sempatik\w*\s+baskin\w*|parasempatik\w*\s+yetersiz\w*|kortizol\w*\s+duzey\w*|insula\w*\s+aktivite\w*|biyolojik\s+mekanizma\w*)\b/

export function containsUnsupportedCaseBiologicalInference(value: unknown): boolean {
  const normalized = normalizeDnaChatText(String(value || ""))
  if (!normalized) return false
  // Vaka bağlamı davranışsal ve işlevsel kalır. Kaynaktaki cümle olumsuz veya
  // ihtiyatlı görünse bile biyobelirteç, nöroanatomi ya da otonom mekanizma
  // terimi serbest rapor metninden taşınmaz; güvenli sınır sistem tarafından
  // ayrı ve sürümlü bir politika cümlesi olarak eklenir.
  return CASE_BIOLOGICAL_MEASUREMENT.test(normalized) || CASE_BIOLOGICAL_SUBJECT.test(normalized)
}

function sanitizeCaseText(value: unknown, maxLength = 360): SanitizedText {
  const original = String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength)
  if (!original) return { value: "", redactions: 0, unsafeClaims: 0 }
  if (containsUnsupportedCaseBiologicalInference(original)) {
    return { value: "", redactions: 0, unsafeClaims: 1 }
  }
  let redacted = redactReportTextForPrivacy(original)
  for (const pattern of DIRECT_IDENTIFIER_PATTERNS) {
    redacted = redacted.replace(pattern, "[kişisel bilgi gizlendi]")
  }
  const redactions = redacted === original ? 0 : 1
  return { value: redacted.replace(/\s+/g, " ").trim(), redactions, unsafeClaims: 0 }
}

function sanitizeList(values: unknown, limit = 8): { values: string[]; redactions: number; unsafeClaims: number } {
  if (!Array.isArray(values)) return { values: [], redactions: 0, unsafeClaims: 0 }
  let redactions = 0
  let unsafeClaims = 0
  const sanitized = values.slice(0, limit).map((value) => {
    const result = sanitizeCaseText(value)
    redactions += result.redactions
    unsafeClaims += result.unsafeClaims
    return result.value
  })
  return { values: stableUnique(sanitized, limit), redactions, unsafeClaims }
}

function sanitizeOptionalText(value: unknown): SanitizedText {
  if (value == null) return { value: "", redactions: 0, unsafeClaims: 0 }
  return sanitizeCaseText(value)
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  )
}

export function dnaCaseContextPayloadSha256(
  input: DnaChatCaseContextInput | DnaChatSafeCaseContext,
): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(input))).digest("hex")
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

  const previousSafeContext = input as Partial<DnaChatSafeCaseContext>
  if (previousSafeContext.safe === true && CASE_CONTEXT_AUTHORITIES.has(input)) {
    return input as DnaChatSafeCaseContext
  }

  const raw = input as DnaChatCaseContextInput
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
  const unsafeClaimCount = [
    primaryAxis.unsafeClaims,
    secondaryAxes.unsafeClaims,
    evidence.unsafeClaims,
    counterEvidence.unsafeClaims,
    preservedCapacities.unsafeClaims,
    confidence.unsafeClaims,
    confidenceRationale.unsafeClaims,
    limitations.unsafeClaims,
    weakDomains.unsafeClaims,
    strongDomains.unsafeClaims,
    patterns.unsafeClaims,
    themes.unsafeClaims,
    observations.unsafeClaims,
    externalFindings.unsafeClaims,
  ].reduce((sum, count) => sum + count, 0)
  const redactionCount = Math.min(
    Number.MAX_SAFE_INTEGER,
    inheritedRedactionCount + detectedRedactionCount,
  )

  const safeContext = Object.freeze({
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
      evidence: Object.freeze(evidence.values),
      counterEvidence: Object.freeze(counterEvidence.values),
      preservedCapacities: Object.freeze(preservedCapacities.values),
      confidence: confidence.value || null,
      confidenceRationale: confidenceRationale.value || null,
      limitations: Object.freeze(stableUnique([
        ...limitations.values,
        ...(unsafeClaimCount > 0
          ? ["Rapor bağlamındaki biyolojik mekanizma ifadeleri doğrudan ölçümle doğrulanmadığı için sohbet bağlamına alınmadı."]
          : []),
      ], 8)),
      weakDomains: Object.freeze(weakDomains.values),
      strongDomains: Object.freeze(strongDomains.values),
      patterns: Object.freeze(patterns.values),
    }),
    redactionCount,
    unsafeClaimCount,
  }) as DnaChatSafeCaseContext

  CASE_CONTEXT_AUTHORITIES.set(
    safeContext,
    raw.dataStatus === "synthetic"
      ? createSyntheticCaseAuthority(SAFE_REPORT_CONTEXT_VERSION)
      : createPendingCaseAuthority(SAFE_REPORT_CONTEXT_VERSION),
  )
  return safeContext
}

/**
 * Attaches an identity-registered case authority to an already canonical safe
 * context. The authority issuer itself exists only in `ownedCaseAnswer.ts`.
 * Shape-valid serialized objects fail `isReleaseEligibleAuthority` because the
 * authority registry is identity based.
 *
 * @internal
 */
export function attachVerifiedReportCaseAuthorityInternal(
  context: DnaChatSafeCaseContext,
  authority: DnaCaseAuthorityRef,
): void {
  if (
    context.dataStatus !== "deidentified" ||
    context.redactionCount > 0 ||
    context.unsafeClaimCount > 0 ||
    authority.layer !== "case_information" ||
    !isReleaseEligibleAuthority(authority)
  ) {
    throw new Error("dna_chat_owned_report_authority_not_verified")
  }
  CASE_CONTEXT_AUTHORITIES.set(context, authority)
}

export function getDnaChatCaseContextAuthority(
  context: DnaChatSafeCaseContext,
): DnaCaseAuthorityRef {
  return CASE_CONTEXT_AUTHORITIES.get(context) ??
    createPendingCaseAuthority(SAFE_REPORT_CONTEXT_VERSION)
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

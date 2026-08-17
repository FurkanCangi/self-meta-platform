import { inspectDnaChatSafety } from "../../safety"
import { normalizeDnaChatText } from "../../text"
import { classifyDnaS13Privacy, type DnaS13PrivacyClassification } from "../strictProvenance"

const INTERNAL_CANARY_CLINICAL_MARKERS = Object.freeze([
  "bu çocuk", "bu cocuk", "çocuğum", "cocugum", "oğlum", "oglum", "kızım", "kizim",
  "öğrencim", "ogrencim", "kliniğimizde", "klinigimizde", "okulumuzda", "kurumumuzda",
  "dosya no", "protokol no", "isimli",
] as const)

const INTERNAL_CANARY_CLINICAL_STEM_PATTERN = /(?:^|\s)(?:vaka|danisan|hasta|anamnez|rapor|seans)\w*(?:$|\s)/u

function hasPhrase(normalized: string, value: string) {
  const phrase = normalizeDnaChatText(value)
  return normalized === phrase || normalized.startsWith(`${phrase} `)
    || normalized.endsWith(` ${phrase}`) || normalized.includes(` ${phrase} `)
}

export type DnaS13CanaryPrivacyDecision = Readonly<{
  allowed: boolean
  classification: DnaS13PrivacyClassification
  reasonCodes: readonly string[]
}>

export function inspectDnaS13CanaryPrivacy(question: string): DnaS13CanaryPrivacyDecision {
  const classification = classifyDnaS13Privacy({ question, context: "general" })
  const safety = inspectDnaChatSafety(question)
  const normalized = normalizeDnaChatText(question)
  const marker = INTERNAL_CANARY_CLINICAL_MARKERS.find((value) => hasPhrase(normalized, value))
  const clinicalStem = INTERNAL_CANARY_CLINICAL_STEM_PATTERN.test(normalized)
  const reasons = [
    ...(classification.automaticTrainingAllowed ? [] : classification.reasons),
    ...(safety.category === "none" ? [] : [`safety:${safety.category}`]),
    ...(marker || clinicalStem ? ["canary_clinical_or_personal_context_marker"] : []),
  ]
  return Object.freeze({
    allowed: classification.category === "general_non_sensitive"
      && classification.automaticTrainingAllowed
      && safety.category === "none"
      && !marker
      && !clinicalStem,
    classification,
    reasonCodes: Object.freeze([...new Set(reasons)]),
  })
}

export function inspectDnaS13CanaryNote(note: string) {
  if (!note.trim()) return Object.freeze({ allowed: true, reasonCodes: Object.freeze([]) })
  const decision = inspectDnaS13CanaryPrivacy(note)
  return Object.freeze({ allowed: decision.allowed, reasonCodes: decision.reasonCodes })
}

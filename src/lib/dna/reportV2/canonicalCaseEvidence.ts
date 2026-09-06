import type { ReportInput } from "../reportEngine"

export type CanonicalTherapistObservation = Readonly<{
  id: "canonical.therapist-observation"
  present: boolean
  rawText: string
  normalizedText: string
  shortObservation: boolean
  meaningfulContextComparison: boolean
  sourceRef: "anamnesis.therapist_observation"
}>

function anamnesisText(input: ReportInput | string): string {
  if (typeof input === "string") return input.trim()
  if (typeof input.anamnez === "string") return input.anamnez.trim()
  return Object.entries(input.anamnez ?? {})
    .filter(([, value]) => value != null && String(value).trim())
    .map(([key, value]) => `${key}: ${String(value).trim()}`)
    .join("\n")
}

function clean(value: string): string {
  return value.replace(/\s+/gu, " ").replace(/^[\s:;|/-]+|[\s|]+$/gu, "").trim()
}

const UNAVAILABLE_OBSERVATION_CLAUSE = /(?:^(?:verilmedi|yok|bilinmiyor|bulunmuyor|gözlenmedi|gözlem(?:i)? yapılmadı)(?:\s|[.!?]|$)|terapist gözlemi\s+(?:yok|bulunmuyor|yapılmadı)|(?:bu|ilgili) alan\s+(?:sorulmadı|değerlendirilmedi|gözlenmedi)|okuldan bilgi alınmadı|aile bilmiyor|doğrudan gözlem(?:e ilişkin)? bilgi\s+(?:yok|bulunmuyor))/iu

function observationIsUnavailable(rawText: string): boolean {
  if (!rawText) return true
  const clauses = rawText
    .split(/;|(?<=[.!?])\s+/u)
    .map(clean)
    .filter(Boolean)
  return clauses.length > 0 && clauses.every((clause) => UNAVAILABLE_OBSERVATION_CLAUSE.test(clause)
    || /(?:^(?:henüz\s+)?(?:doğrudan\s+)?gözlem(?:i)?\s+yapılmadı|konuşulmadı|sorulmadı|örneği?\s+verilmedi)/iu.test(clause))
}

export function extractCanonicalTherapistObservation(input: ReportInput | string): CanonicalTherapistObservation {
  const text = anamnesisText(input)
  const match = text.match(
    /(?:(?:terapist yorumlar[ıi]?|terapist yorumu|terapist gözlemi?|therapist_comments|clinical_observation)\s*[:=]\s*|terapist yorumu\s+)([\s\S]*?)(?=\s*(?:(?:ek klinik test(?:\s*\/\s*bulgular)?|d[ıi]ş test|dis test|günlük (?:yaşam )?örnek(?:i|leri)?|çocuğun güçlü yanlar[ıi]?|güçlü yanlar[ıi]?|güçlü yan[ıi]?|başka bilgi|strengths|preserved_areas|başvuru sebebi|basvuru sebebi)\s*[:=]?|$))/iu
  )
  const rawText = clean(match?.[1] ?? "")
  const unavailable = observationIsUnavailable(rawText)
  const normalizedText = unavailable ? "" : rawText
  const observedClauses = normalizedText.split(/[.;]/u).filter((clause) => !/(?:denenmedi|gözlenmedi|yapılmadı|belirlenemedi|konuşulmadı)/iu.test(clause))
  const meaningfulContextComparison = !unavailable && observedClauses.length >= 2
    && /(?:başlayınca|bitirildiğinde|durduktan sonra|verildiğinde|gösterilip|hatırlatmasıyla|yokken|olmadan|değiştiğinde)/iu.test(observedClauses.join(" "))
    && observedClauses.filter((clause) => /(?:tamamla|durula|kaldı|ağladı|uzaklaş|götürdü|yürüdü|topladı|yöneldi|aldı)/iu.test(clause)).length >= 2
  return Object.freeze({
    id: "canonical.therapist-observation",
    present: !unavailable,
    rawText,
    normalizedText,
    shortObservation: !unavailable && normalizedText.length < 90,
    meaningfulContextComparison,
    sourceRef: "anamnesis.therapist_observation",
  })
}

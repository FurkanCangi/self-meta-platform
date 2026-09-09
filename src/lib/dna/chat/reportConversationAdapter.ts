import { normalizeDnaChatText } from "./text"

export const DNA_REPORT_CONVERSATION_ADAPTER_VERSION =
  "dna-report-conversation-adapter@1" as const

export type DnaReportConversationTarget =
  | "overview"
  | "primary_axis"
  | "primary_axis_rationale"
  | "caregiver"
  | "observations"
  | "external_findings"
  | "evidence_alignment"
  | "daily_impact"
  | "strengths"
  | "scores"
  | "confidence"
  | "limitations"
  | "information_needed"
  | "evidence_sources"

export type DnaReportConversationAdaptation = Readonly<
  | {
      scope: "report"
      target: DnaReportConversationTarget
      canonicalQuestion: string
      safeQuestionForSafetyGate: string
    }
  | {
      scope: "control"
      control: "general_information" | "identity_privacy"
      safeQuestionForSafetyGate: string
    }
  | {
      scope: "none"
      safeQuestionForSafetyGate: string
    }
>

const CANONICAL_QUESTION: Readonly<Record<DnaReportConversationTarget, string>> =
  Object.freeze({
    overview: "Son raporumu özetle.",
    primary_axis: "Bu vakanın ana klinik ekseni ne?",
    primary_axis_rationale: "Bu vakadaki ana ekseni destekleyen bulgular neler?",
    caregiver: "Bu vakanın anamnez temaları neler?",
    observations: "Bu vakanın klinik gözlemleri neler?",
    external_findings: "Bu vakanın ek değerlendirme bulguları neler?",
    evidence_alignment: "Bu vakadaki veri kanalları birbiriyle uyumlu mu?",
    daily_impact: "Bu vakada günlük yaşama yansıyan kayıtlı zorlanmalar neler?",
    strengths: "Bu vakadaki korunmuş kapasiteler neler?",
    scores: "Bu vakanın alan skorlarını özetle.",
    confidence: "Bu vaka yorumu ne kadar kesin?",
    limitations: "Bu vakanın veri sınırlılıkları neler?",
    information_needed: "Bu vaka yorumunu güçlendirmek için hangi ek bilgiler gerekir?",
    evidence_sources: "Bu rapor yorumunu doğrudan destekleyen vaka veri kanalları neler?",
  })

const CASE_TOPIC_PATTERN =
  /\b(?:vaka|rapor|ana klinik eksen|ana eksen|zorlanan alan|korunmus kapasite|goreli guclu alan|klinik gozlem|ek degerlendirme bulgu|anamnez tema|veri guveni|veri sinirliligi|gunluk yasam etkisi|vaka veri kanali)\b/

const SAFE_NEGATED_IDENTITY_NAVIGATION =
  /^(?:(?:ad(?:ini|ıni)|isim)\s+(?:verme|soyleme|yazma)(?:ne gerek yok)?|(?:ad(?:ini|ıni)|isim)\s+(?:vermen|soylemen|yazman)e?\s+gerek yok)[, ]+(?:(?:son|sectigim)\s+)?rapor\w*\s+(?:ac\w*|goster\w*|ozetle\w*)/u

function reportAdaptation(
  target: DnaReportConversationTarget,
  safeQuestionForSafetyGate: string,
): DnaReportConversationAdaptation {
  const canonicalQuestion = CANONICAL_QUESTION[target]
  return Object.freeze({
    scope: "report" as const,
    target,
    canonicalQuestion,
    safeQuestionForSafetyGate,
  })
}

function isCaseContinuation(
  previousTopic: string | null | undefined,
  hasCaseContext: boolean,
): boolean {
  if (hasCaseContext) return true
  return CASE_TOPIC_PATTERN.test(normalizeDnaChatText(previousTopic ?? ""))
}

/**
 * Converts ordinary report conversation language into a small, auditable set
 * of report obligations. It never receives a snapshot, report id, name or raw
 * clinical text and therefore cannot create or broaden case authority.
 */
export function adaptDnaReportConversationQuestion(input: Readonly<{
  question: string
  previousTopic?: string | null
  hasCaseContext?: boolean
}>): DnaReportConversationAdaptation {
  const normalized = normalizeDnaChatText(input.question)
  const caseContinuation = isCaseContinuation(
    input.previousTopic,
    input.hasCaseContext === true,
  )
  const report = (target: DnaReportConversationTarget) =>
    reportAdaptation(target, input.question)

  if (SAFE_NEGATED_IDENTITY_NAVIGATION.test(normalized)) {
    return reportAdaptation("overview", CANONICAL_QUESTION.overview)
  }

  if (
    /\b(?:vakayi|raporu)\s+birak\b.{0,40}\bgenel\s+bilgi(?:ye)?\s+gec\w*/.test(normalized) ||
    /\bgenel\s+bilgi(?:ye)?\s+(?:gecelim|donelim)\b/.test(normalized)
  ) {
    return Object.freeze({
      scope: "control" as const,
      control: "general_information" as const,
      safeQuestionForSafetyGate: input.question,
    })
  }

  if (
    /^(?:hangi\s+(?:cocuk|rapor)(?:tu|du)?(?:\s+o)?|az\s+once\s+ad[ıi]\s+neydi|unut)$/u.test(normalized) ||
    (/\b(?:cocugun|danisanin)\s+ad[ıi]\b/.test(normalized) &&
      /\b(?:soyle|goster|hatirla|neydi)\b/.test(normalized))
  ) {
    return Object.freeze({
      scope: "control" as const,
      control: "identity_privacy" as const,
      safeQuestionForSafetyGate: input.question,
    })
  }

  if (/\b(?:bakim\s*veren|bakimveren|anamnez)\b/.test(normalized)) {
    return report("caregiver")
  }
  if (/\b(?:external|harici|dis)\s+(?:test|degerlendirme)|\bek\s+(?:test|degerlendirme)\b/.test(normalized)) {
    return report("external_findings")
  }
  if (/\b(?:gozlem|terapist\s+not)\w*\b/.test(normalized)) {
    if (/\b(?:ayni\s+yon|uyum|destek|celis)\w*\b/.test(normalized)) {
      return report("evidence_alignment")
    }
    return report("observations")
  }
  if (
    /\b(?:birbirini\s+destek|uyum\w*\s+var|celis\w*)\b/.test(normalized) &&
    (caseContinuation || /\b(?:kaynak|veri|bulgu)\w*\b/.test(normalized))
  ) {
    return report("evidence_alignment")
  }
  if (/\b(?:korunmus|guclu\s+(?:taraf|yon|alan)|dengeleyici)\w*\b/.test(normalized)) {
    return report("strengths")
  }
  if (/\b(?:puan|skor)\w*\b/.test(normalized) && (caseContinuation || /\brapor\w*\b/.test(normalized))) {
    return report("scores")
  }
  if (
    /\b(?:gunluk\s+(?:yasam|hayat)|nerede\s+zorlan|islevsel\s+etki|gundelik)\w*\b/.test(normalized) &&
    (caseContinuation || /\b(?:bu\s+cocuk|bu\s+vaka|rapor)\w*\b/.test(normalized))
  ) {
    return report("daily_impact")
  }
  if (
    /\b(?:hangi\s+(?:bilgi|veri).{0,40}(?:yorum|guven)\w*\s+guclen|ney\w*\s+olsa.{0,30}guclen)\w*/.test(normalized) ||
    /\byorumu\s+guclendirmek\s+icin\b/.test(normalized)
  ) {
    return report("information_needed")
  }
  if (
    /\b(?:kaynak|dayanak)\w*\b/.test(normalized) &&
    /\b(?:rapor|vaka|yorum|gercekten\s+destek)\w*\b/.test(normalized)
  ) {
    return report("evidence_sources")
  }
  if (
    /\b(?:kesin\w*|ne\s+kadar\s+guven|emin\w*)\b/.test(normalized) &&
    (caseContinuation || /\b(?:rapor|vaka|duyusal)\w*\b/.test(normalized))
  ) {
    return report("confidence")
  }
  if (
    /\b(?:baska\s+hangi\s+aciklama|neden\s+(?:tani|teshis)\s+koyam|eksik\s+(?:bilgi|veri)|sinirlilik)\w*\b/.test(normalized) &&
    (caseContinuation || /\b(?:bu|son|sectigim)\s+(?:rapor|vaka)\w*\b/.test(normalized))
  ) {
    return report("limitations")
  }
  if (
    /\b(?:neden\s+(?:o|bu|duyusal)\s+(?:alan\w*\s+)?(?:one\s+cik|dedin)|ana\s+eksen\w*\s+destek)\w*/.test(normalized) ||
    (caseContinuation && /^neden(?:\s+o\s+alan)?$/u.test(normalized))
  ) {
    return report("primary_axis_rationale")
  }
  if (
    /\b(?:en\s+onemli\s+alan|hangi\s+alan\w*\s+one\s+cik|ana\s+(?:klinik\s+)?eksen|ana\s+oruntu)\w*\b/.test(normalized) ||
    (caseContinuation && /\baz\s+once\s+hangi\s+alan\b/.test(normalized))
  ) {
    return report("primary_axis")
  }
  if (
    /\b(?:(?:son|sectigim|onceki|az\s+onceki)\s+rapor\w*|rapor\w*\s+(?:ac|don|ozet)|vakaya\s+don)\w*\b/.test(normalized) ||
    /\b(?:rapora|vakaya)\s+(?:tekrar|yeniden|geri)?\s*don\w*/.test(normalized) ||
    /^(?:kisa|daha\s+uzun|detayli)\s+(?:klinik\s+)?ozet(?:le)?$/u.test(normalized) ||
    (caseContinuation && /^(?:raporu\s+ozetle|daha\s+uzun\s+ozetle|kisa\s+ozet)$/u.test(normalized))
  ) {
    return report("overview")
  }
  if (
    caseContinuation &&
    /^(?:cok\s+teknik\s+anlattin|bana\s+bunu\s+klinik\s+jargonla\s+degil\s+normal\s+dille\s+anlat)$/u.test(normalized)
  ) {
    return report("overview")
  }

  return Object.freeze({
    scope: "none" as const,
    safeQuestionForSafetyGate: input.question,
  })
}

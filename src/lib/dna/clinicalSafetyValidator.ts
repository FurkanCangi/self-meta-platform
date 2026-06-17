import { analyzeReportLanguageQuality, sanitizeFinalReportLanguage } from "./reportLanguageQuality"

export type ClinicalSafetySeverity = "critical" | "warning"

export type ClinicalSafetyIssue = {
  code: string
  severity: ClinicalSafetySeverity
  message: string
  evidence?: string
}

export type ClinicalSafetyValidationResult = {
  text: string
  issues: ClinicalSafetyIssue[]
  criticalIssues: ClinicalSafetyIssue[]
}

const SAFETY_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bkesin olarak neden olur\b/gi, "ilişkili olabilir"],
  [/\bkesin nedenidir\b/gi, "olası ilişkili bağlamlardan biri olabilir"],
  [/\btanı koydurur\b/gi, "tanısal hüküm üretmez"],
  [/\btanı konur\b/gi, "tanısal sonuç çıkarılmaz"],
  [/\btedavi edilmelidir\b/gi, "klinik izlemde ele alınmalıdır"],
  [/\bseans sıklığı belirlenmelidir\b/gi, "uygulama planı ayrıca klinik değerlendirme ile belirlenmelidir"],
  [/\bilaç başlanmalıdır\b/gi, "medikal karar üretmez"],
  [/\bpatolojik\b/gi, "klinik açıdan dikkat gerektiren"],
  [/\bmadde düzeyi\b/gi, "ölçek içi ayrıntılı"],
  [/\banket maddesi\b/gi, "ölçek yanıtı"],
  [/\byanıt dizisi\b/gi, "yanıt örüntüsü"],
  [/\bsoru numarası\b/gi, "ölçek ayrıntısı"],
]

const CRITICAL_PATTERNS: Array<{ code: string; pattern: RegExp; message: string }> = [
  {
    code: "diagnostic_determination",
    pattern: /\b(?:tanı koydurur|tanı konur|tanısı vardır|tanısı ile uyumludur)\b/i,
    message: "Final raporda tanılayıcı hüküm kalmış.",
  },
  {
    code: "treatment_prescription",
    pattern: /\b(?:tedavi edilmelidir|seans sıklığı|ilaç başlanmalıdır|müdahale reçetesi\s+(?:sunar|önerir|verir|planlar)|müdahale planı\s+(?:önerir|verir|sunar))\b/i,
    message: "Final raporda tedavi/seans/ilaç reçetesi dili kalmış.",
  },
  {
    code: "causal_certainty",
    pattern: /\b(?:kesin nedenidir|kesin olarak neden olur|doğrudan neden olur)\b/i,
    message: "Final raporda kesin nedensellik dili kalmış.",
  },
  {
    code: "single_test_certainty",
    pattern: /\b(?:tek başına|yalnızca).{0,60}(?:kanıtlar|gösterir|doğrular)\b/i,
    message: "Tek test/tek veri kaynağından kesin hüküm riski var.",
  },
  {
    code: "technical_item_leak",
    pattern: /\b(?:madde düzeyi|anket maddesi|yanıt dizisi|soru numarası)\b/i,
    message: "Teknik ölçek/madde dili final raporda kalmış.",
  },
  {
    code: "kb_instruction_leak",
    pattern: /\b(?:anlatmalı|göstermeli|yazılmalı|yazılmalıdır|açıklamalı|kurmamalıdır|üretmemelidir)\b/i,
    message: "KB yönerge dili final rapora sızmış.",
  },
]

function applySafetyReplacements(text: string): string {
  return SAFETY_REPLACEMENTS.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text)
}

export function validateAndNormalizeClinicalReport(text: string): ClinicalSafetyValidationResult {
  const normalized = sanitizeFinalReportLanguage(applySafetyReplacements(String(text || "")))
  const issues: ClinicalSafetyIssue[] = []

  for (const rule of CRITICAL_PATTERNS) {
    const match = normalized.match(rule.pattern)
    if (match) {
      issues.push({
        code: rule.code,
        severity: "critical",
        message: rule.message,
        evidence: match[0],
      })
    }
  }

  for (const issue of analyzeReportLanguageQuality(normalized).issues) {
    if (issue.severity === "high") {
      issues.push({
        code: `language_${issue.code}`,
        severity: "critical",
        message: issue.message,
        evidence: issue.evidence,
      })
    }
  }

  const criticalIssues = issues.filter((issue) => issue.severity === "critical")
  return {
    text: normalized,
    issues,
    criticalIssues,
  }
}

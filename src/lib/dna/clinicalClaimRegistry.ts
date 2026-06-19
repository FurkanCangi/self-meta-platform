export type ClaimGuardSeverity = "critical" | "warning"

export type ClaimGuardIssue = {
  code: string
  severity: ClaimGuardSeverity
  message: string
  evidence?: string
}

export type ClaimGuardRule = {
  code: string
  severity: ClaimGuardSeverity
  pattern: RegExp
  message: string
}

export const CLAIM_REGISTRY_VERSION = "dna-claim-registry@1.0.0"

export const ALLOWED_REPORT_CLAIMS = [
  "Rapor klinik hipotez düzeyinde kalır.",
  "Rapor skor, anamnez, gözlem ve ek test verilerini bağlamsal olarak yorumlar.",
  "Rapor karar dilini veri güveni ve kanıt sınırıyla kalibre eder.",
]

export const FORBIDDEN_CLAIM_RULES: ClaimGuardRule[] = [
  {
    code: "diagnostic_claim",
    severity: "critical",
    pattern: /\b(?:tanı koyar|tanı koydurur|tanı konur|tanısı vardır|tanısı ile uyumludur|tanı ile uyumlu)\b/i,
    message: "Tanısal iddia görünür raporda bulunmamalı.",
  },
  {
    code: "practice_direction_claim",
    severity: "critical",
    pattern: /\b(?:tedavi|müdahale|terapi|seans|ilaç|danışmanlık|destek planı|uygulama yönergesi|program|protokol|egzersiz listesi|ödev|seans akışı)\b/i,
    message: "Uygulama veya yönlendirme çağrışımı yapan iddia görünür raporda bulunmamalı.",
  },
  {
    code: "directive_modal_claim",
    severity: "critical",
    pattern: /\b(?:yapılmalıdır|uygulanmalıdır|başlanmalıdır|baslanmalidir|gerekir)\b/i,
    message: "Direktif modal dil görünür raporda bulunmamalı.",
  },
  {
    code: "diagnostic_semantic_claim",
    severity: "critical",
    pattern: /\b(?:belirtisidir|semptom|bozukluk|patoloji|patolojik)\b/i,
    message: "Tanısal çağrışım yapan semantik ifade görünür raporda bulunmamalı.",
  },
  {
    code: "causal_certainty_claim",
    severity: "critical",
    pattern: /\b(?:kesin olarak|kesin neden(?!-sonuç)|neden olur|doğrudan neden|tek başına gösterir|açıkça gösterir|kanıtlar nitelikte|kanıtlamaktadır|kanıtlanmıştır|kanıtladı)\b/i,
    message: "Kesin nedensellik veya tek kaynaklı kesinlik iddiası görünür raporda bulunmamalı.",
  },
  {
    code: "automation_claim",
    severity: "critical",
    pattern: /\b(?:otomatik klinik karar|klinik kararı verir|karar yerine geçer|uzman değerlendirmesi yerine geçer)\b/i,
    message: "Klinik karar otomasyonu veya insan değerlendirmesi yerine geçme iddiası bulunmamalı.",
  },
]

export function evaluateClaimGuard(text: string): ClaimGuardIssue[] {
  const value = String(text || "")
  const issues: ClaimGuardIssue[] = []
  for (const rule of FORBIDDEN_CLAIM_RULES) {
    const match = value.match(rule.pattern)
    if (match) {
      issues.push({
        code: rule.code,
        severity: rule.severity,
        message: rule.message,
        evidence: match[0],
      })
    }
  }
  return issues
}

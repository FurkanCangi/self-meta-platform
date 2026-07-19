import type { DeterministicReport, DomainResult } from "../reportEngine"

export const DNA_CHAT_REPORT_CONTEXT_VERSION = "dna-chat-context@1" as const

export type DnaChatReportSnapshotContext = {
  version: typeof DNA_CHAT_REPORT_CONTEXT_VERSION
  primaryAxis: string | null
  secondaryAxes: string[]
  caseEvidenceLines: string[]
  counterEvidenceLines: string[]
  preservedCapacityLines: string[]
  dataLimitations: string[]
  confidenceLevel: "yüksek" | "orta" | "sınırlı"
  confidenceRationale: string
}

const DOMAIN_LABELS: Record<string, string> = {
  physiological: "Fizyolojik regülasyon",
  sensory: "Duyusal regülasyon",
  emotional: "Duygusal regülasyon",
  cognitive: "Bilişsel regülasyon",
  executive: "Yürütücü işlev",
  interoception: "İnterosepsiyon",
}

const SAFE_LEVELS = new Set(["Tipik", "Riskli", "Atipik"])

function safeDomainRows(report: DeterministicReport): DomainResult[] {
  return report.domainResults
    .filter(
      (domain) =>
        Boolean(DOMAIN_LABELS[domain.key]) &&
        Number.isFinite(domain.score) &&
        domain.score >= 0 &&
        domain.score <= 50 &&
        SAFE_LEVELS.has(domain.level),
    )
    .map((domain) => ({ ...domain, label: DOMAIN_LABELS[domain.key], name: DOMAIN_LABELS[domain.key] }))
}

function domainLine(domain: DomainResult): string {
  return `${DOMAIN_LABELS[domain.key]} alanı: ${Number(domain.score.toFixed(2))}/50, ${domain.level}.`
}

/**
 * Builds the only clinical text that may be persisted for DNA chat.
 * Every line is derived from structured domain scores/levels. Anamnesis,
 * therapist notes, external findings, evidence atoms and trace text are never
 * copied into this context.
 */
export function buildDnaChatSnapshotContext(
  report: DeterministicReport,
): DnaChatReportSnapshotContext {
  const domains = safeDomainRows(report)
  const nonTypical = domains
    .filter((domain) => domain.level === "Riskli" || domain.level === "Atipik")
    .sort(
      (left, right) =>
        Number(right.level === "Atipik") - Number(left.level === "Atipik") ||
        left.score - right.score ||
        left.key.localeCompare(right.key),
    )
  const typical = domains.filter((domain) => domain.level === "Tipik")
  const ranked = [...domains].sort(
    (left, right) => left.score - right.score || left.key.localeCompare(right.key),
  )
  const primary = nonTypical[0] ?? ranked[0] ?? null
  const secondary = nonTypical.filter((domain) => domain.key !== primary?.key).slice(0, 4)
  const confidence = report.clinicalAnalysis?.evidenceMap?.confidenceLevel
  const confidenceLevel =
    confidence === "yüksek" || confidence === "orta" || confidence === "sınırlı"
      ? confidence
      : "sınırlı"

  return {
    version: DNA_CHAT_REPORT_CONTEXT_VERSION,
    primaryAxis: primary
      ? `${DOMAIN_LABELS[primary.key]} alanında göreli ${primary.level.toLocaleLowerCase("tr-TR")} örüntü`
      : null,
    secondaryAxes: secondary.map((domain) => DOMAIN_LABELS[domain.key]),
    caseEvidenceLines: (nonTypical.length ? nonTypical : ranked.slice(0, 2)).map(domainLine).slice(0, 5),
    counterEvidenceLines: typical.slice(0, 4).map(
      (domain) => `${DOMAIN_LABELS[domain.key]} alanındaki Tipik düzey, bulgunun tüm alanlara genellenmesini sınırlar.`,
    ),
    preservedCapacityLines: typical.slice(0, 4).map(
      (domain) => `${DOMAIN_LABELS[domain.key]} alanı ${Number(domain.score.toFixed(2))}/50 ve Tipik düzeyde kayıtlıdır.`,
    ),
    dataLimitations: [
      "Sohbet bağlamı ham madde yanıtlarını, anamnez metnini, terapist notunu, dış bulgu metnini, trace veya kural kimliklerini içermez.",
      ...(domains.length < 6
        ? ["Bazı alanların yapılandırılmış skor veya düzey kaydı bulunmadığı için vaka özeti sınırlıdır."]
        : []),
    ],
    confidenceLevel,
    confidenceRationale:
      "Güven düzeyi rapor motorunun yapılandırılmış alan kayıtları ve kaynak uyumu değerlendirmesiyle sınırlıdır; ham klinik metin sohbet bağlamına aktarılmaz.",
  }
}

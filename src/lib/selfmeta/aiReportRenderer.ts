import { DOMAIN_KEYS, type AIReportAnalysis } from "./aiReportSchema";
import { DOMAIN_LABELS, normalizeAIScores, type RawAIScores } from "./aiReportPrompt";

function nonEmpty(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function renderAIReport(
  analysis: AIReportAnalysis,
  rawScores: RawAIScores = {},
  ageMonths?: number | null
) {
  const scores = normalizeAIScores(rawScores, ageMonths);

  const numerical = DOMAIN_KEYS.map((k) => {
    return `- ${DOMAIN_LABELS[k]}: ${scores[k]}/50 (${scores.domainLevels[k]})`;
  }).join("\n");

  const domains = DOMAIN_KEYS.map((k) => {
    const d = analysis.domains[k];
    return `- ${DOMAIN_LABELS[k]}: ${nonEmpty(d.interpretation)}`;
  }).join("\n");

  const patterns = [
    `- ${nonEmpty(analysis.patternSummary)}`,
    ...analysis.patterns.map((p) => `- ${nonEmpty(p)}`),
  ].join("\n");

  const anamnez = [
    nonEmpty(analysis.anamnezFitSummary),
    ...analysis.anamnezMatches.map((m) => `- Uyumlu tema: ${nonEmpty(m)}`),
    ...analysis.anamnezLimitations.map((l) => `- Sınırlılık: ${nonEmpty(l)}`),
  ].join("\n");

  const ageBandNote =
    scores.normSource === "age_band_heuristic"
      ? `ageBandLabel}.`
      : "";

  return [
    "1. Genel Sonuç",
    `${nonEmpty(analysis.generalSummary)} ${ageBandNote}`,
    "",
    "2. Sayısal Sonuç Özeti",
    numerical,
    "",
    "3. Alan Bazlı Klinik Yorum",
    domains,
    "",
    "4. Ölçekler Arası Örüntü Analizi",
    patterns,
    "",
    "5. Anamnez – Test Uyum Değerlendirmesi",
    anamnez,
    "",
    "6. Kısa Klinik Özet",
    nonEmpty(analysis.conclusion),
  ].join("\n");
}

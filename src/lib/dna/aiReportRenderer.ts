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
      ? `Yorum ${scores.ageBandLabel || "yaş-duyarlı"} norm bandı üzerinden yapılmıştır.`
      : "";

  return [
    "1. Klinik Karar Özeti",
    `${nonEmpty(analysis.generalSummary)} Klinik karar cümlesi: ${nonEmpty(analysis.conclusion)}`,
    "",
    "2. Klinik Kanıt Profili",
    [`Toplam skor ${scores.toplam}/300 ve genel düzey ${scores.globalLevel} olarak sınıflanmıştır.`, ageBandNote, "Alan puanları:", numerical].filter(Boolean).join("\n"),
    "",
    "3. Alan Bazlı Klinik Yorum",
    domains,
    "",
    "4. Klinik Örüntü ve Formülasyon",
    [patterns, `Klinik formülasyon: ${nonEmpty(analysis.patternSummary)}`].filter(Boolean).join("\n"),
    "",
    "5. Anamnez, Gözlem ve Test Uyumunun Değerlendirilmesi",
    anamnez,
    "",
    "6. Klinik Önceliklendirme Notu",
    [
      `Klinik karar cümlesi: ${nonEmpty(analysis.conclusion)}`,
      `Klinik formülasyon: ${nonEmpty(analysis.patternSummary)}`,
      "Klinik öncelik sırası:",
      nonEmpty(analysis.homogeneityStatement),
    ].join("\n"),
    "",
    "7. Klinik Sonuç",
    nonEmpty(analysis.conclusion),
  ].join("\n");
}

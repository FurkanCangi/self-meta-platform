export type DomainKey =
  | "physiological"
  | "sensory"
  | "emotional"
  | "cognitive"
  | "executive"
  | "interoception";

export type DomainLevel = "Tipik" | "Riskli" | "Atipik";

export type ScoreBand = {
  atypicalMax: number;
  riskMax: number;
};

export type AgeNormBand = {
  label: string;
  minMonths: number;
  maxMonths: number;
  total: ScoreBand;
  domains: Record<DomainKey, ScoreBand>;
};

/*
  Geçici yaş-duyarlı klinik yorum bantları.
  Bunlar normatif VALIDASYON yerine geçmez; sistem içi yaş-duyarlı yorum için kullanılır.
*/
export const AGE_NORM_BANDS: AgeNormBand[] = [
  {
    label: "24-35 ay",
    minMonths: 24,
    maxMonths: 35,
    total: { atypicalMax: 135, riskMax: 185 },
    domains: {
      physiological: { atypicalMax: 19, riskMax: 30 },
      sensory: { atypicalMax: 18, riskMax: 29 },
      emotional: { atypicalMax: 18, riskMax: 29 },
      cognitive: { atypicalMax: 19, riskMax: 30 },
      executive: { atypicalMax: 19, riskMax: 30 },
      interoception: { atypicalMax: 17, riskMax: 28 },
    },
  },
  {
    label: "36-47 ay",
    minMonths: 36,
    maxMonths: 47,
    total: { atypicalMax: 147, riskMax: 197 },
    domains: {
      physiological: { atypicalMax: 21, riskMax: 32 },
      sensory: { atypicalMax: 20, riskMax: 31 },
      emotional: { atypicalMax: 20, riskMax: 31 },
      cognitive: { atypicalMax: 21, riskMax: 32 },
      executive: { atypicalMax: 21, riskMax: 32 },
      interoception: { atypicalMax: 19, riskMax: 30 },
    },
  },
  {
    label: "48-59 ay",
    minMonths: 48,
    maxMonths: 59,
    total: { atypicalMax: 159, riskMax: 209 },
    domains: {
      physiological: { atypicalMax: 23, riskMax: 34 },
      sensory: { atypicalMax: 22, riskMax: 33 },
      emotional: { atypicalMax: 22, riskMax: 33 },
      cognitive: { atypicalMax: 23, riskMax: 34 },
      executive: { atypicalMax: 23, riskMax: 34 },
      interoception: { atypicalMax: 21, riskMax: 32 },
    },
  },
  {
    label: "60-71 ay",
    minMonths: 60,
    maxMonths: 71,
    total: { atypicalMax: 171, riskMax: 221 },
    domains: {
      physiological: { atypicalMax: 24, riskMax: 36 },
      sensory: { atypicalMax: 23, riskMax: 35 },
      emotional: { atypicalMax: 23, riskMax: 35 },
      cognitive: { atypicalMax: 24, riskMax: 36 },
      executive: { atypicalMax: 24, riskMax: 36 },
      interoception: { atypicalMax: 22, riskMax: 34 },
    },
  },
];

function classifyByBand(score: number, band: ScoreBand): DomainLevel {
  if (score <= band.atypicalMax) return "Atipik";
  if (score <= band.riskMax) return "Riskli";
  return "Tipik";
}

function fallbackDomain(score: number): DomainLevel {
  if (score >= 37) return "Tipik";
  if (score >= 24) return "Riskli";
  return "Atipik";
}

function fallbackTotal(score: number): DomainLevel {
  if (score >= 222) return "Tipik";
  if (score >= 144) return "Riskli";
  return "Atipik";
}

export function normalizeDomainKey(key: string): DomainKey {
  const k = String(key).toLowerCase();

  if (k === "physiological" || k === "fizyolojik") return "physiological";
  if (k === "sensory" || k === "duyusal") return "sensory";
  if (k === "emotional" || k === "duygusal") return "emotional";
  if (k === "cognitive" || k === "bilissel" || k === "bilişsel") return "cognitive";
  if (k === "executive" || k === "yurutucu" || k === "yürütücü") return "executive";
  return "interoception";
}

export function findAgeNormBand(ageMonths?: number | null): AgeNormBand | null {
  if (typeof ageMonths !== "number" || !Number.isFinite(ageMonths)) return null;
  for (const band of AGE_NORM_BANDS) {
    if (ageMonths >= band.minMonths && ageMonths <= band.maxMonths) return band;
  }
  return null;
}

export function classifyDomainScore(
  domainKey: string,
  score: number,
  ctx?: { ageMonths?: number | null }
): DomainLevel {
  const band = findAgeNormBand(ctx?.ageMonths);
  if (!band) return fallbackDomain(score);
  return classifyByBand(score, band.domains[normalizeDomainKey(domainKey)]);
}

export function classifyTotalScore(
  score: number,
  ctx?: { ageMonths?: number | null }
): DomainLevel {
  const band = findAgeNormBand(ctx?.ageMonths);
  if (!band) return fallbackTotal(score);
  return classifyByBand(score, band.total);
}

export function getNormSource(ageMonths?: number | null): "age_band_heuristic" | "fallback_fixed" {
  return findAgeNormBand(ageMonths) ? "age_band_heuristic" : "fallback_fixed";
}

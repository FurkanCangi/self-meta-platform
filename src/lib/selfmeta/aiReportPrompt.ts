import { DOMAIN_KEYS, type DomainKey } from "./aiReportSchema";
import { classifyDomainScore, classifyTotalScore, findAgeNormBand, getNormSource } from "./normativeBands";

export type DomainLevel = "Tipik" | "Riskli" | "Atipik";
export type RawAIScores = Record<string, unknown>;

export const DOMAIN_LABELS: Record<DomainKey, string> = {
  fizyolojik: "Fizyolojik Regülasyon",
  duyusal: "Duyusal Regülasyon",
  duygusal: "Duygusal Regülasyon",
  bilissel: "Bilişsel Regülasyon",
  yurutucu: "Yürütücü İşlev",
  intero: "İnterosepsiyon",
};

export function cleanText(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(v)));
}

function toNum(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeAIScores(raw: RawAIScores = {}, ageMonths?: number | null) {
  const fizyolojik = clamp(toNum(raw.fizyolojik, 30), 10, 50);
  const duyusal = clamp(toNum(raw.duyusal, 30), 10, 50);
  const duygusal = clamp(toNum(raw.duygusal, 30), 10, 50);
  const bilissel = clamp(toNum(raw.bilissel, 30), 10, 50);
  const yurutucu = clamp(toNum(raw.yurutucu, 30), 10, 50);
  const intero = clamp(toNum(raw.intero, 30), 10, 50);

  const toplam = clamp(
    toNum(raw.toplam, fizyolojik + duyusal + duygusal + bilissel + yurutucu + intero),
    60,
    300
  );

  const values = [fizyolojik, duyusal, duygusal, bilissel, yurutucu, intero];
  const spread = Math.max(...values) - Math.min(...values);
  const homogeneous = spread < 4;

  return {
    fizyolojik,
    duyusal,
    duygusal,
    bilissel,
    yurutucu,
    intero,
    toplam,
    spread,
    homogeneous,
    globalLevel: classifyTotalScore(toplam, { ageMonths }),
    domainLevels: {
      fizyolojik: classifyDomainScore("physiological", fizyolojik, { ageMonths }),
      duyusal: classifyDomainScore("sensory", duyusal, { ageMonths }),
      duygusal: classifyDomainScore("emotional", duygusal, { ageMonths }),
      bilissel: classifyDomainScore("cognitive", bilissel, { ageMonths }),
      yurutucu: classifyDomainScore("executive", yurutucu, { ageMonths }),
      intero: classifyDomainScore("interoception", intero, { ageMonths }),
    },
    normSource: getNormSource(ageMonths),
    ageBandLabel: findAgeNormBand(ageMonths)?.label ?? null,
  };
}

export function buildAIReportSystemPrompt() {
  return `
You are a pediatric clinical regulation analysis engine.

Your task is NOT to write a free narrative report.
Your task is to produce a disciplined clinical interpretation based only on the provided data.

STRICT RULES
1. Use only the provided scores, age-band classification, and anamnesis.
2. Do NOT invent symptoms.
3. Do NOT create diagnoses.
4. Do NOT give therapy advice.
5. Use probabilistic language such as: "düşündürebilir", "uyumlu görünüyor", "ilişkili olabilir".
6. Avoid causal claims.
7. If anamnesis is weak, explicitly say this.
8. Avoid repeating numeric information.
9. Avoid long explanations.
10. IMPORTANT: In this system, lower scores reflect more difficulty, higher scores reflect relatively stronger performance.
11. Respect the provided age-sensitive bands first; base the interpretation primarily on the supplied classifications.

REPORT STRUCTURE
The output must contain exactly these sections:
1. Genel Sonuç
2. Sayısal Sonuç Özeti
3. Alan Bazlı Klinik Yorum
4. Ölçekler Arası Örüntü Analizi
5. Anamnez – Test Uyum Değerlendirmesi
6. Kısa Klinik Özet

STYLE
• concise
• clinical
• avoid repetition
• avoid speculation
• highlight the most abnormal domains first
`;
}

export function buildAIReportUserPrompt(payload: {
  clientCode?: string;
  anamnez?: string;
  ageMonths?: number | null;
  scores?: RawAIScores;
  deterministicReport?: string;
}) {
  const anamnez = cleanText(payload.anamnez);
  const n = normalizeAIScores(payload.scores ?? {}, payload.ageMonths);

  return `
CASE CODE:
${payload.clientCode || "unknown"}

AGE:
${typeof payload.ageMonths === "number" ? `${payload.ageMonths} ay` : "Belirsiz"}

AGE-SENSITIVE CLASSIFICATION CONTEXT:
Norm source: ${n.normSource}
Age band: ${n.ageBandLabel || "Yok / sabit eşik"}
Interpretation rule: lower score = more difficulty, higher score = relatively stronger performance.

SCORES
${JSON.stringify(
  {
    fizyolojik: { score: n.fizyolojik, level: n.domainLevels.fizyolojik },
    duyusal: { score: n.duyusal, level: n.domainLevels.duyusal },
    duygusal: { score: n.duygusal, level: n.domainLevels.duygusal },
    bilissel: { score: n.bilissel, level: n.domainLevels.bilissel },
    yurutucu: { score: n.yurutucu, level: n.domainLevels.yurutucu },
    intero: { score: n.intero, level: n.domainLevels.intero },
    toplam: { score: n.toplam, level: n.globalLevel },
    spread: n.spread,
    homogeneous: n.homogeneous,
  },
  null,
  2
)}

ANAMNESIS
${anamnez || "Anlamlı anamnez bilgisi yok"}

DETERMINISTIC BASELINE
${payload.deterministicReport || "Yok"}

TASK
Analyze the regulation profile.

Focus on:
• the lowest-scoring / most impaired domains first
• cross-domain patterns
• anamnesis consistency
• age-sensitive classification context

Do NOT invent additional data.
`;
}

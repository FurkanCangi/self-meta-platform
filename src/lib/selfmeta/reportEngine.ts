import {
  cleanMeaningfulText,
  extractAnamnezFlags,
  extractExternalClinicalFindings,
  getAnamnezThemeSignals,
  extractTherapistInsights,
  summarizeAnamnezThemes,
  extractVisibleCaseInfo,
  type AnamnezRecord,
  type AnamnezThemeSignals,
} from "./anamnezUtils";
import { classifyDomainScore, classifyTotalScore, findAgeNormBand, getNormSource } from "./normativeBands";
import { buildClinicalAnalysis } from "./clinicalAnalysis";
import { analyzeExternalClinicalTests, type ExternalTestAnalysis, type ExternalTestCategory } from "./externalTestRegistry";
import { analyzeItemLevelSignals } from "./itemSignals";
import { buildQualityGuidance } from "./reportQuality";

export type DomainKey =
  | "physiological"
  | "sensory"
  | "emotional"
  | "cognitive"
  | "executive"
  | "interoception";

export type DomainScoreMap = Partial<Record<DomainKey, number>> & Record<string, number>;
export type DomainLevel = "Tipik" | "Riskli" | "Atipik";

export type ReportInput = {
  clientName?: string;
  clientCode?: string;
  anamnez?: AnamnezRecord | string;
  ageMonths?: number | null;
  scores: DomainScoreMap;
  answers?: number[] | null;
};

export type DomainResult = {
  key: string;
  name: string;
  label: string;
  score: number;
  level: DomainLevel;
  comment: string;
};

export type DeterministicReport = {
  normSource?: "age_band_heuristic" | "fallback_fixed";
  ageBandLabel?: string | null;
  clinicalAnalysis?: {
    totalScore: number;
    ageBandLabel?: string | null;
    profileType: string;
    globalLevel: string;
    priorityDomains: string[];
    domainSummary: Record<string, string>;
    domainScoreSummary: Record<string, { score: number; level: string }>;
    anamnezThemes: string[];
    weakDomains: string[];
    strongDomains: string[];
    matchedDomains: string[];
    patternSummary: string;
    externalTestIds?: string[];
    externalTestCategories?: ExternalTestCategory[];
    primaryExternalTestCategory?: ExternalTestCategory | null;
    therapistInsights?: string[];
    criticalItemLines?: string[];
    alignedItemLines?: string[];
    itemSignalSummary?: string;
    qualityFocusMode?: "balanced" | "selective" | "paired" | "widespread";
    qualityPrimaryEvidenceLines?: string[];
    qualitySupportingEvidenceLines?: string[];
    qualityRestraintLines?: string[];
    qualityCautionLines?: string[];
  };
  totalScore: number;
  globalLevel: DomainLevel;
  homogeneousProfile: boolean;
  profileType: string;
  domainResults: DomainResult[];
  patterns: string[];
  anamnezFlags: string[];
  anamnezSummary: string[];
  reportText: string;

  deterministicReport: string;
  domains: DomainResult[];
  weakDomains: DomainResult[];
  strongDomains: DomainResult[];
  text: string;
  summary: string;
  domainLevels: Record<string, DomainLevel>;

  sections: {
    general: string;
    numerical: string;
    domains: string;
    patterns: string;
    anamnezTestFit: string;
    conclusion: string;
  };
};

const HOMOGENEITY_DIFF_THRESHOLD = 4;
const MEANINGFUL_SPREAD_THRESHOLD = 6;
const DOMAIN_MIN = 10;
const DOMAIN_MAX = 50;
const GLOBAL_MIN = 60;
const GLOBAL_MAX = 300;

const DOMAIN_META: Record<
  DomainKey,
  {
    label: string;
    legacyName: string;
    low: string;
    mid: string;
    high: string;
  }
> = {
  physiological: {
    label: "Fizyolojik Regülasyon",
    legacyName: "fizyolojik",
    low: "Bu alan, bedensel toparlanma, stres sonrası sakinleşme, uyku-uyanıklık dengesi ve otonom düzenleme açısından belirgin kırılganlık düşündürmektedir.",
    mid: "Bu alan, fizyolojik düzenleme becerilerinin değişken olabileceğini; bazı durumlarda toparlanma ve sakinleşme desteğine ihtiyaç duyulabileceğini düşündürmektedir.",
    high: "Bu alan, bedensel düzenleme, toparlanma ve fizyolojik denge açısından görece korunmuş bir profil düşündürmektedir.",
  },
  sensory: {
    label: "Duyusal Regülasyon",
    legacyName: "duyusal",
    low: "Bu alan, çevresel uyaranların işlenmesi ve duyusal yüklenmeye verilen yanıtlar açısından belirgin hassasiyet veya düzensizlik düşündürmektedir.",
    mid: "Bu alan, duyusal uyaranlara verilen tepkilerin bağlama göre değişebildiğini ve bazı ortamlarda düzenleme desteği gerekebileceğini düşündürmektedir.",
    high: "Bu alan, çevresel uyaranların işlenmesi ve duyusal düzenleme açısından görece dengeli bir profil düşündürmektedir.",
  },
  emotional: {
    label: "Duygusal Regülasyon",
    legacyName: "duygusal",
    low: "Bu alan, yoğun duyguları yönetme, hayal kırıklığı toleransı ve yeniden sakinleşme süreçlerinde belirgin güçlük düşündürmektedir.",
    mid: "Bu alan, duygusal düzenleme becerilerinin tutarlı olmadığını ve zorlayıcı durumlarda ek destek gerekebileceğini düşündürmektedir.",
    high: "Bu alan, duygusal yanıtları düzenleme ve zorlayıcı durumlarda toparlanma açısından görece yeterli bir profile işaret etmektedir.",
  },
  cognitive: {
    label: "Bilişsel Regülasyon",
    legacyName: "bilissel",
    low: "Bu alan, dikkat, göreve başlama, sürdürme ve bilişsel organizasyon süreçlerinde belirgin zorluk düşündürmektedir.",
    mid: "Bu alan, bilişsel düzenleme becerilerinin bazı görevlerde yeterli, bazı görevlerde ise destek gerektirebileceğini düşündürmektedir.",
    high: "Bu alan, dikkat ve bilişsel organizasyon süreçleri açısından görece korunmuş bir profile işaret etmektedir.",
  },
  executive: {
    label: "Yürütücü İşlev",
    legacyName: "yurutucu",
    low: "Bu alan, inhibisyon, kural takibi, organizasyon ve davranış kontrolünde belirgin güçlük düşündürmektedir.",
    mid: "Bu alan, yürütücü işlev becerilerinin değişken olduğunu ve yapılandırılmış destekten yarar görebileceğini düşündürmektedir.",
    high: "Bu alan, davranış kontrolü, organizasyon ve görev yönetimi açısından görece yeterli bir profile işaret etmektedir.",
  },
  interoception: {
    label: "İnterosepsiyon",
    legacyName: "intero",
    low: "Bu alan, açlık, susuzluk, yorgunluk, ağrı ve diğer bedensel sinyalleri fark etme/yorumlama süreçlerinde güçlük düşündürmektedir.",
    mid: "Bu alan, bedensel sinyalleri fark etme becerilerinin bağlama göre değişebildiğini ve bazı durumlarda ek destek gerekebileceğini düşündürmektedir.",
    high: "Bu alan, bedensel sinyalleri fark etme ve bunlara uygun yanıt verme açısından görece dengeli bir profile işaret etmektedir.",
  },
};

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return DOMAIN_MIN;
  return Math.max(DOMAIN_MIN, Math.min(DOMAIN_MAX, Math.round(score)));
}

function getDomainCommentByLevel(key: DomainKey, level: DomainLevel): string {
  const meta = DOMAIN_META[key];
  if (level === "Tipik") return meta.high;
  if (level === "Riskli") return meta.mid;
  return meta.low;
}

function getAnamnezMatchHint(key: DomainKey, anamnezFlags: string[]): string {
  const joined = anamnezFlags.join(" ").toLowerCase();

  if (key === "sensory" && /duyusal|dokunsal|uyaran|gürültü|kalabalık/.test(joined)) {
    return " Anamnezde tarif edilen çevresel ve dokunsal hassasiyet bu alanla uyumludur.";
  }
  if (key === "emotional" && /duygusal|toparlanma|sakinleş|uyaran sonrası/.test(joined)) {
    return " Anamnezde bildirilen zorlanma sonrası duygusal toparlanma güçlüğü bu alanı desteklemektedir.";
  }
  if ((key === "cognitive" || key === "executive") && /dikkat|görev|sürdürme|çok uyaran/.test(joined)) {
    return " Anamnezde çok uyaranlı bağlamlarda dikkat ve görev sürdürme güçlüğü bu alanla ilişkili görünebilir.";
  }
  if ((key === "physiological" || key === "interoception") && /bedensel|fizyolojik|yorgun|uyku|beslenme|iştah|alerji|kolik|nöbet/.test(joined)) {
    return " Anamnezdeki bedensel ve fizyolojik bağlam bu alanın yorumuna kısmi destek sağlayabilir.";
  }
  return "";
}

function anamnezToRecord(anamnez?: AnamnezRecord | string): AnamnezRecord {
  if (!anamnez) return {};
  if (typeof anamnez === "string") {
    const cleaned = cleanMeaningfulText(anamnez);
    return cleaned ? { raw_summary: cleaned } : {};
  }
  return anamnez;
}

function normalizeLegacyScores(scores: DomainScoreMap): Record<DomainKey, number> {
  return {
    physiological: Number(scores.physiological ?? scores.fizyolojik ?? DOMAIN_MIN),
    sensory: Number(scores.sensory ?? scores.duyusal ?? DOMAIN_MIN),
    emotional: Number(scores.emotional ?? scores.duygusal ?? DOMAIN_MIN),
    cognitive: Number(scores.cognitive ?? scores.bilissel ?? scores.bilişsel ?? DOMAIN_MIN),
    executive: Number(scores.executive ?? scores.yurutucu ?? scores["yürütücü"] ?? DOMAIN_MIN),
    interoception: Number(scores.interoception ?? scores.interosepsiyon ?? scores.intero ?? DOMAIN_MIN),
  };
}

function getHomogeneousProfile(domainResults: DomainResult[]): boolean {
  if (domainResults.length < 2) return false;
  const values = domainResults.map((d) => d.score);
  return Math.max(...values) - Math.min(...values) < HOMOGENEITY_DIFF_THRESHOLD;
}

function getMeaningfulStrengthWeakness(domainResults: DomainResult[], homogeneous: boolean) {
  if (homogeneous) return { strengths: [] as DomainResult[], weaknesses: [] as DomainResult[] };

  const values = domainResults.map((d) => d.score);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const spread = max - min;

  if (spread < HOMOGENEITY_DIFF_THRESHOLD) {
    return { strengths: [] as DomainResult[], weaknesses: [] as DomainResult[] };
  }

  return {
    strengths: domainResults.filter((d) => max - d.score <= 1),
    weaknesses: domainResults.filter((d) => d.score - min <= 1),
  };
}

function selectNarrativelyMatchedDomains(domainResults: DomainResult[], anamnezFlags: string[]): DomainResult[] {
  if (hasFlatPriorityProfile(domainResults)) {
    return [];
  }

  const joined = anamnezFlags.join(" ").toLowerCase();
  const matched = domainResults.filter((d) => matchesNarrativeDomain(d.key as DomainKey, joined));

  const prioritized = matched
    .filter((d) => d.level !== "Tipik")
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  if (prioritized.length > 0) return prioritized;

  return [...domainResults]
    .filter((d) => d.level !== "Tipik")
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
}

function getRawMatchedDomains(domainResults: DomainResult[], anamnezFlags: string[]): DomainResult[] {
  const joined = anamnezFlags.join(" ").toLowerCase();

  return domainResults.filter((d) => matchesNarrativeDomain(d.key as DomainKey, joined));
}

function matchesNarrativeDomain(domainKey: DomainKey, joinedFlags: string): boolean {
  if (domainKey === "sensory") {
    return /duyusal|dokunsal|uyaran|gürültü|kalabalık|beden organizasyonu/.test(joinedFlags);
  }

  if (domainKey === "emotional") {
    return /duygusal|toparlanma|sakinleş|frustrasyon|ko-regülasyon|ko-reg|ayrılma|geçiş/.test(joinedFlags);
  }

  if (domainKey === "cognitive") {
    return /dilsel|yönerge|sözel|siral|sekans|görev|başlatma|sürdürme|sosyal karşılıklılık/.test(joinedFlags);
  }

  if (domainKey === "executive") {
    return /görev|başlatma|sürdürme|esneklik|ko-regülasyon|ko-reg|motor planlama|praksi|öz bakım|günlük rutin/.test(joinedFlags);
  }

  if (domainKey === "physiological" || domainKey === "interoception") {
    return /bedensel|fizyolojik|yorgun|uyku|beslenme|iştah|alerji|kolik|nöbet|öz bakım|tuvalet/.test(joinedFlags);
  }

  return false;
}

function hasFlatPriorityProfile(domainResults: DomainResult[]): boolean {
  if (!domainResults.length) return false;
  const scores = domainResults.map((d) => d.score);
  const levels = domainResults.map((d) => d.level);
  const spread = Math.max(...scores) - Math.min(...scores);
  const sameLevel = new Set(levels).size === 1;
  return spread <= 1 && sameLevel;
}

function getSelectiveProfileName(domain: DomainResult | undefined): string {
  if (!domain) return "Seçici Regülasyon Kırılganlığı";

  if (domain.key === "interoception") {
    return "İnterosepsiyon Merkezli Seçici Kırılganlık";
  }

  return `${domain.label} Alanında Seçici Kırılganlık`;
}

function getWidespreadProfileName(primaryDomain: DomainResult | undefined): string {
  if (!primaryDomain) return "Yaygın Çoklu Alan Regülasyon Yükü";
  return `${primaryDomain.label} Merkezli Yaygın Regülasyon Yükü`;
}

function buildProfileDomainWeights(
  domainResults: DomainResult[],
  anamnezSignals: AnamnezThemeSignals,
  externalTestAnalysis?: ExternalTestAnalysis
) {
  const compatibleCategories = new Set(externalTestAnalysis?.compatibleCategories || []);

  const domainWeights = domainResults.map((domain) => {
    let weight =
      (domain.level === "Atipik" ? 4 : domain.level === "Riskli" ? 2 : 0) +
      Math.max(0, (34 - domain.score) / 5);

    if (domain.key === "sensory") {
      if (anamnezSignals.sensory) weight += 1.4;
      if (anamnezSignals.motorPraxis) weight += 0.5;
      if (compatibleCategories.has("sensory_processing")) weight += 1.4;
      if (compatibleCategories.has("motor_praxis")) weight += 0.6;
    }

    if (domain.key === "emotional") {
      if (anamnezSignals.emotional) weight += 1.3;
      if (anamnezSignals.transitionCoregulation) weight += 1.4;
      if (anamnezSignals.socialPragmatic) weight += 0.6;
      if (compatibleCategories.has("social_pragmatic")) weight += 1.0;
      if (compatibleCategories.has("executive_behavior")) weight += 0.7;
      if (compatibleCategories.has("language_communication")) weight += 0.5;
    }

    if (domain.key === "cognitive") {
      if (anamnezSignals.cognitiveExecutive) weight += 1.0;
      if (anamnezSignals.languageLoad) weight += 1.2;
      if (anamnezSignals.motorPraxis) weight += 0.6;
      if (compatibleCategories.has("language_communication")) weight += 1.3;
      if (compatibleCategories.has("social_pragmatic")) weight += 0.6;
      if (compatibleCategories.has("motor_praxis")) weight += 0.6;
      if (compatibleCategories.has("executive_behavior")) weight += 0.5;
    }

    if (domain.key === "executive") {
      if (anamnezSignals.cognitiveExecutive) weight += 1.2;
      if (anamnezSignals.transitionCoregulation) weight += 1.3;
      if (anamnezSignals.adaptiveDailyLiving) weight += 1.0;
      if (anamnezSignals.socialPragmatic) weight += 0.8;
      if (anamnezSignals.motorPraxis) weight += 1.0;
      if (compatibleCategories.has("executive_behavior")) weight += 1.4;
      if (compatibleCategories.has("adaptive_daily_living")) weight += 1.0;
      if (compatibleCategories.has("motor_praxis")) weight += 1.1;
      if (compatibleCategories.has("social_pragmatic")) weight += 0.8;
      if (compatibleCategories.has("language_communication")) weight += 0.7;
    }

    if (domain.key === "physiological") {
      if (anamnezSignals.bodyIntero) weight += 1.3;
      if (anamnezSignals.adaptiveDailyLiving) weight += 0.6;
      if (compatibleCategories.has("adaptive_daily_living")) weight += 0.8;
    }

    if (domain.key === "interoception") {
      if (anamnezSignals.bodyIntero) weight += 1.5;
      if (anamnezSignals.adaptiveDailyLiving) weight += 0.9;
      if (compatibleCategories.has("adaptive_daily_living")) weight += 1.0;
    }

    return { ...domain, weight };
  });

  return domainWeights.sort((a, b) => b.weight - a.weight || a.score - b.score);
}

function detectExternalTestProfileType(
  domainResults: DomainResult[],
  anamnezSignals: AnamnezThemeSignals,
  externalTestAnalysis?: ExternalTestAnalysis
): string | null {
  if (!externalTestAnalysis || externalTestAnalysis.compatible.length === 0) return null;

  const compatibleIds = new Set(externalTestAnalysis.compatibleIds || []);
  const compatibleCategories = new Set(externalTestAnalysis.compatibleCategories || []);
  const nonTypical = [...domainResults].filter((d) => d.level !== "Tipik").sort((a, b) => a.score - b.score);
  const nonTypicalKeys = new Set(nonTypical.map((d) => d.key));

  const hasPraxisSignal = compatibleCategories.has("motor_praxis");
  const hasSiptSignal = compatibleIds.has("sipt");
  const hasSensorySignal = compatibleCategories.has("sensory_processing");

  if (hasPraxisSignal) {
    if (hasSiptSignal && (nonTypicalKeys.has("executive") || nonTypicalKeys.has("cognitive"))) {
      if (nonTypical.length >= 3) {
        return "Praksi ve Motor Planlama ile İlişkili Regülasyon Yükü";
      }
      return "Praksi ve Motor Planlama ile İlişkili Seçici Kırılganlık";
    }

    if (compatibleIds.has("mabc3") || compatibleIds.has("pdms3") || compatibleIds.has("bot2") || compatibleIds.has("mfun")) {
      if (nonTypical.length >= 3) {
        return "Motor Planlama ve Beden Organizasyonu ile İlişkili Regülasyon Yükü";
      }
      return "Motor Planlama ile İlişkili Seçici Kırılganlık";
    }
  }

  if (hasSensorySignal && (nonTypicalKeys.has("sensory") || nonTypical[0]?.key === "sensory")) {
    if (nonTypicalKeys.has("emotional") && nonTypical.length >= 2) {
      return "Duyusal-Duygusal Regülasyon Profili";
    }

    if (nonTypical.length >= 3) {
      return "Duyusal Merkezli Yaygın Regülasyon Yükü";
    }

    return "Duyusal Alanda Seçici Kırılganlık";
  }

  if (compatibleCategories.has("adaptive_daily_living")) {
    if (nonTypical.length >= 3 || nonTypicalKeys.has("executive") || nonTypicalKeys.has("interoception")) {
      return "Günlük Yaşam ve Öz Bakım Akışında Regülasyon Yükü";
    }
    if (anamnezSignals.adaptiveDailyLiving) {
      return "Günlük Yaşam Akışında Seçici Kırılganlık";
    }
  }

  if (compatibleCategories.has("social_pragmatic")) {
    if (nonTypical.length >= 2 || nonTypicalKeys.has("emotional") || nonTypicalKeys.has("executive")) {
      return "Sosyal-Pragmatik Esneklikle İlişkili Regülasyon Yükü";
    }
    if (anamnezSignals.socialPragmatic) {
      return "Sosyal-Pragmatik Esneklikte Seçici Kırılganlık";
    }
  }

  if (compatibleCategories.has("language_communication")) {
    if (nonTypical.length >= 2 || nonTypicalKeys.has("cognitive") || nonTypicalKeys.has("executive")) {
      return "Dilsel Talep Altında Regülasyon Yükü";
    }
    if (anamnezSignals.languageLoad) {
      return "Dilsel Talep Altında Seçici Kırılganlık";
    }
  }

  return null;
}

function detectProfileType(
  domainResults: DomainResult[],
  globalLevel: DomainLevel,
  homogeneous: boolean,
  anamnezSignals: AnamnezThemeSignals,
  externalTestAnalysis?: ExternalTestAnalysis
): string {
  const byKey = Object.fromEntries(domainResults.map((d) => [d.key, d.score])) as Record<DomainKey, number>;
  const values = domainResults.map((d) => d.score);
  const spread = Math.max(...values) - Math.min(...values);
  const nonTypical = [...domainResults]
    .filter((d) => d.level !== "Tipik")
    .sort((a, b) => a.score - b.score);
  const nonTypicalKeys = new Set(nonTypical.map((d) => d.key));
  const primaryNonTypical = nonTypical[0];

  if (nonTypical.length === 0) {
    return "Dengeli / Korunmuş Profil";
  }

  if (homogeneous) {
    if (globalLevel === "Tipik") return "Dengeli / Korunmuş Profil";
    if (globalLevel === "Riskli") return "Yaygın Orta Düzey Regülasyon Güçlüğü";
    return "Yaygın Çoklu Alan Kırılganlığı";
  }

  if (nonTypical.length === 1) {
    return getSelectiveProfileName(nonTypical[0]);
  }

  const externalTestProfileType = detectExternalTestProfileType(domainResults, anamnezSignals, externalTestAnalysis);
  if (externalTestProfileType) {
    return externalTestProfileType;
  }

  const weightedDomains = buildProfileDomainWeights(domainResults, anamnezSignals, externalTestAnalysis);
  const weightedKeys = new Set(weightedDomains.slice(0, 2).map((domain) => domain.key as DomainKey));

  if (anamnezSignals.transitionCoregulation && weightedKeys.has("emotional") && weightedKeys.has("executive")) {
    return nonTypical.length >= 3 ? "Geçiş ve Ko-Regülasyon Yükü" : "Geçiş ve Ko-Regülasyon Kırılganlığı";
  }

  if (anamnezSignals.bodyIntero && weightedKeys.has("physiological") && weightedKeys.has("interoception")) {
    return nonTypical.length >= 2
      ? "Fizyolojik Toparlanma ve Beden Temelli Regülasyon Yükü"
      : "Fizyolojik Toparlanma Ekseninde Seçici Kırılganlık";
  }

  if (anamnezSignals.socialPragmatic && weightedKeys.has("executive") && weightedKeys.has("emotional")) {
    return nonTypical.length >= 2
      ? "Sosyal-Pragmatik Esneklikle İlişkili Regülasyon Yükü"
      : "Sosyal-Pragmatik Esneklikte Seçici Kırılganlık";
  }

  if (anamnezSignals.adaptiveDailyLiving && (weightedKeys.has("executive") || weightedKeys.has("interoception"))) {
    return nonTypical.length >= 2
      ? "Günlük Yaşam ve Öz Bakım Akışında Regülasyon Yükü"
      : "Günlük Yaşam Akışında Seçici Kırılganlık";
  }

  if (nonTypical.length >= 5 && spread >= 4) {
    return getWidespreadProfileName(weightedDomains[0] || primaryNonTypical);
  }

  if (
    nonTypicalKeys.has("executive") &&
    nonTypicalKeys.has("cognitive") &&
    (nonTypicalKeys.has("physiological") || nonTypicalKeys.has("interoception")) &&
    spread >= MEANINGFUL_SPREAD_THRESHOLD - 1
  ) {
    return "Yürütücü-Beden Temelli Regülasyon Yükü";
  }

  if (
    nonTypicalKeys.has("cognitive") &&
    nonTypicalKeys.has("executive") &&
    nonTypicalKeys.has("emotional") &&
    spread >= MEANINGFUL_SPREAD_THRESHOLD - 1
  ) {
    return "Bilişsel-Yürütücü-Duygusal Yüklenme Profili";
  }

  if (
    nonTypicalKeys.has("sensory") &&
    nonTypicalKeys.has("cognitive") &&
    nonTypicalKeys.has("executive") &&
    spread >= MEANINGFUL_SPREAD_THRESHOLD
  ) {
    return "Duyusal-Bilişsel-Yürütücü Zorlanma Profili";
  }

  if (byKey.sensory <= 25 && byKey.emotional <= 25 && spread >= MEANINGFUL_SPREAD_THRESHOLD) {
    return "Duyusal-Duygusal Regülasyon Profili";
  }
  if (byKey.cognitive <= 25 && byKey.executive <= 25 && spread >= MEANINGFUL_SPREAD_THRESHOLD) {
    return "Bilişsel-Yürütücü Zorlanma Profili";
  }
  if (byKey.cognitive <= 26 && byKey.executive <= 31 && spread >= MEANINGFUL_SPREAD_THRESHOLD - 1) {
    return "Bilişsel-Yürütücü Yüklenme Profili";
  }
  if (byKey.physiological <= 25 && byKey.interoception <= 25 && spread >= MEANINGFUL_SPREAD_THRESHOLD) {
    return "Bedensel Farkındalık ve Toparlanma Profili";
  }
  if (byKey.sensory <= 22 && spread >= MEANINGFUL_SPREAD_THRESHOLD) {
    return "Duyusal Ağırlıklı Profil";
  }
  if (byKey.emotional <= 22 && spread >= MEANINGFUL_SPREAD_THRESHOLD) {
    return "Duygusal Regülasyon Ağırlıklı Profil";
  }
  if (byKey.executive <= 22 && spread >= MEANINGFUL_SPREAD_THRESHOLD) {
    return "Yürütücü İşlev Ağırlıklı Profil";
  }

  return "Ayrışan Regülasyon Profili";
}

function analyzePatterns(domainResults: DomainResult[], homogeneous: boolean): string[] {
  if (homogeneous) {
    return [
      "Alt alan puanları arasında belirgin bir ayrışma saptanmamıştır. Bu durum, riskin tek bir baskın alanda yoğunlaşmasından çok alanlara daha homojen dağılmış bir profil düşündürebilir.",
    ];
  }

  const byKey = Object.fromEntries(domainResults.map((d) => [d.key, d])) as Record<DomainKey, DomainResult>;
  const values = domainResults.map((d) => d.score);
  const spread = Math.max(...values) - Math.min(...values);

  if (spread < HOMOGENEITY_DIFF_THRESHOLD) return [];

  const patterns: string[] = [];
  const sensory = byKey.sensory?.score ?? 0;
  const emotional = byKey.emotional?.score ?? 0;
  const cognitive = byKey.cognitive?.score ?? 0;
  const executive = byKey.executive?.score ?? 0;
  const physiological = byKey.physiological?.score ?? 0;
  const interoception = byKey.interoception?.score ?? 0;

  if (sensory <= 25 && emotional <= 25 && spread >= 6) {
    patterns.push("Duyusal ve duygusal alanlarda birlikte görülen düşüklük, çevresel uyaran yükünün duygusal regülasyonu zorlayabildiği bir klinik örüntü düşündürebilir.");
  }
  if (cognitive <= 25 && executive <= 25 && spread >= 6) {
    patterns.push("Bilişsel ve yürütücü alanlardaki birlikte düşüklük, dikkat sürdürme ve görev organizasyonunda ortak bir zorlanma örüntüsüne işaret edebilir.");
  }
  if (physiological <= 25 && interoception <= 25 && spread >= 6) {
    patterns.push("Fizyolojik regülasyon ile interosepsiyon alanlarındaki birlikte düşüklük, bedensel sinyalleri fark etme ve buna göre düzenlenme süreçlerinde güçlük düşündürebilir.");
  }

  return patterns.slice(0, 2);
}

function buildCaseIdentityLine(
  visibleInfo: { adSoyad?: string; clientCode?: string; ageText?: string; diagnosis?: string }
): string {
  const parts = [
    visibleInfo.adSoyad ? `Danışan: ${visibleInfo.adSoyad}` : "",
    visibleInfo.clientCode ? `Kod: ${visibleInfo.clientCode}` : "",
    visibleInfo.ageText ? `Yaş: ${visibleInfo.ageText}` : "",
    visibleInfo.diagnosis ? `Tanı: ${visibleInfo.diagnosis}` : "",
  ].filter(Boolean);

  return parts.length ? parts.join(" | ") : "";
}

function buildGeneralSection(
  totalScore: number,
  globalLevel: DomainLevel,
  homogeneous: boolean,
  profileType: string,
  domainResults: DomainResult[],
  ageBandLabel?: string | null,
  normSource?: "age_band_heuristic" | "fallback_fixed",
  visibleInfo?: { adSoyad?: string; clientCode?: string; ageText?: string; diagnosis?: string }
): string {
  const identityLine = buildCaseIdentityLine(visibleInfo || {});
  const normText =
    normSource === "age_band_heuristic" && ageBandLabel
      ? `Yaş-duyarlı yorum bandı (${ageBandLabel}) kullanılmıştır.`
      : "Sabit sistem içi eşikler kullanılmıştır.";

  const summary =
    globalLevel === "Tipik"
      ? "Genel görünüm, yaş dönemi içinde büyük ölçüde dengeli ve korunmuş seyretmektedir."
      : globalLevel === "Riskli"
      ? "Genel görünüm, bazı alanlarda belirginleşen destek ihtiyacına işaret etmektedir."
      : "Genel görünüm, çoklu alanda belirginleşen bir regülasyon yüküne işaret etmektedir.";

  const profileSentence = homogeneous
    ? "Alt alan puanları birbirine yakın seyretmiş ve profil görece homojen kalmıştır."
    : `Belirgin klinik örüntü "${profileType}" ile uyumludur. Görece en kırılgan alan ${[...domainResults].sort((a, b) => a.score - b.score)[0]?.label} olarak öne çıkmaktadır.`;

  const nonTypicalCount = domainResults.filter((d) => d.level !== "Tipik").length;
  const lowPathologyMode = globalLevel === "Tipik" && nonTypicalCount <= 1;
  const safeProfileSentence =
    nonTypicalCount === 0
      ? "Tüm alanlar tipik aralıkta seyretmiş ve klinik açıdan belirgin bir kırılganlık odağı izlenmemiştir."
      : lowPathologyMode
      ? `Genel zemin korunmuş görünmekle birlikte, ${[...domainResults].sort((a, b) => a.score - b.score)[0]?.label} alanında bağlama duyarlı bir hassasiyet izlenmektedir.`
      : profileSentence;

  return [identityLine, `Toplam skor ${totalScore}/${GLOBAL_MAX} olarak hesaplanmıştır ve genel sınıflama ${globalLevel} düzeydedir. ${summary} ${safeProfileSentence} ${normText}`]
    .filter(Boolean)
    .join("\n");
}

function buildNumericalSection(domainResults: DomainResult[]): string {
  return domainResults.map((d) => `- ${d.label}: ${d.score}/${DOMAIN_MAX} (${d.level})`).join("\n");
}

function formatNamedTests(names: string[]): string {
  if (names.length <= 1) return names[0] || ""
  if (names.length === 2) return `${names[0]} ve ${names[1]}`
  return `${names.slice(0, -1).join(", ")} ve ${names[names.length - 1]}`
}

function getExternalDomainCommentHint(
  domainKey: DomainKey,
  externalTestAnalysis?: ExternalTestAnalysis
): string {
  if (!externalTestAnalysis?.compatible.length) return ""

  const compatibleCategories = new Set(externalTestAnalysis.compatibleCategories || [])
  const primaryCategory = externalTestAnalysis.primaryCompatibleCategory || null
  const namesByCategory = (category: ExternalTestCategory) =>
    externalTestAnalysis.compatible
      .filter((match) => match.category === category)
      .map((match) => match.name)
      .slice(0, 2)
  const praxisNames = namesByCategory("motor_praxis")
  const adaptiveNames = namesByCategory("adaptive_daily_living")
  const languageNames = namesByCategory("language_communication")
  const socialNames = namesByCategory("social_pragmatic")

  if (compatibleCategories.has("motor_praxis")) {
    const testText = formatNamedTests(praxisNames)
    if (domainKey === "executive" && testText) {
      return ` ${testText} bulguları, bu alandaki zorlanmanın yalnız inhibisyon ya da dikkatle değil, hareketi sıralama, motor planı uygulama ve davranışı organize etme yüküyle de ilişkili olabileceğini düşündürmektedir.`
    }
    if (domainKey === "cognitive" && testText) {
      return ` ${testText} bulguları, görevin zihinsel olarak planlanması ve adım adım sürdürülmesi sırasında praksi ve sekanslama yükünün bilişsel organizasyonu artırabileceğini düşündürmektedir.`
    }
    if (domainKey === "sensory" && testText) {
      return ` ${testText} bulguları, beden organizasyonu ve duyusal bütünleme taleplerinin çevresel uyaran altında performans dalgalanmasını artırabileceğini düşündürmektedir.`
    }
  }

  if (primaryCategory === "adaptive_daily_living") {
    const testText = formatNamedTests(adaptiveNames)
    if (domainKey === "executive" && testText) {
      return ` ${testText} bulguları, bu alandaki zorlanmanın günlük rutinleri başlatma, sıralama ve sürdürme üzerindeki işlevsel karşılığını görünür kılmaktadır.`
    }
    if ((domainKey === "physiological" || domainKey === "interoception") && testText) {
      return ` ${testText} bulguları, beden sinyallerini fark etme ve öz bakım akışını düzenleme yükünün günlük yaşamda nasıl karşılık bulduğunu görünür kılmaktadır.`
    }
  }

  if (primaryCategory === "language_communication") {
    const testText = formatNamedTests(languageNames)
    if (domainKey === "cognitive" && testText) {
      return ` ${testText} bulguları, sözel talep ve yönerge karmaşıklığı arttığında bilgiyi işleme, zihinsel olarak tutma ve görevde kalma yükünün arttığını düşündürmektedir.`
    }
    if (domainKey === "executive" && testText) {
      return ` ${testText} bulguları, çok basamaklı sözel taleplerde geçiş yapma, sıralama ve görevi tamamlama yükünün belirginleşebileceğini düşündürmektedir.`
    }
    if (domainKey === "emotional" && testText) {
      return ` ${testText} bulguları, iletişimsel talep ve anlaşılmama anlarında frustrasyon eşiğinin düşebileceğini düşündürmektedir.`
    }
  }

  if (primaryCategory === "social_pragmatic") {
    const testText = formatNamedTests(socialNames)
    if (domainKey === "emotional" && testText) {
      return ` ${testText} bulguları, karşılıklılık ve sosyal belirsizlik arttığında duygusal regülasyon yükünün neden daha görünür hale geldiğini açıklamaya yardımcı olmaktadır.`
    }
    if (domainKey === "executive" && testText) {
      return ` ${testText} bulguları, sosyal bağlam hızlı değiştiğinde esneklik, yanıtı ayarlama ve davranışı bağlama göre düzenleme yükünü görünür kılmaktadır.`
    }
    if (domainKey === "cognitive" && testText) {
      return ` ${testText} bulguları, sosyal ipuçlarını izleme ve eşzamanlı görev taleplerini sürdürme yükünün bilişsel organizasyonu zorlayabildiğini düşündürmektedir.`
    }
  }

  return ""
}

function buildDomainSection(
  domainResults: DomainResult[],
  anamnezFlags: string[],
  externalTestAnalysis?: ExternalTestAnalysis
): string {
  const allTypical = domainResults.every((d) => d.level === "Tipik");
  return domainResults
    .map(
      (d) =>
        `- ${d.label}: ${d.comment}${allTypical ? "" : getAnamnezMatchHint(d.key as DomainKey, anamnezFlags)}${allTypical ? "" : getExternalDomainCommentHint(
          d.key as DomainKey,
          externalTestAnalysis
        )}`
    )
    .join("\n");
}

function getLevelWeight(level: string): number {
  if (level === "Atipik") return 2;
  if (level === "Riskli") return 1;
  return 0;
}

function mean(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function std(nums: number[]): number {
  if (!nums.length) return 0;
  const m = mean(nums);
  const v = nums.reduce((acc, x) => acc + Math.pow(x - m, 2), 0) / nums.length;
  return Math.sqrt(v);
}

function buildDeterministicProfileSummary(
  domainResults: Array<{ label: string; score: number; level: string }>
) {
  const sortedAsc = [...domainResults].sort((a, b) => a.score - b.score);
  const sortedDesc = [...domainResults].sort((a, b) => b.score - a.score);
  const scores = domainResults.map((d) => d.score);
  const weights = domainResults.map((d) => getLevelWeight(d.level));

  const riskyCount = domainResults.filter((d) => d.level === "Riskli").length;
  const atypicalCount = domainResults.filter((d) => d.level === "Atipik").length;
  const typicalCount = domainResults.filter((d) => d.level === "Tipik").length;

  const scoreStd = std(scores);
  const weightStd = std(weights);
  const spread = sortedDesc[0].score - sortedAsc[0].score;

  const lowest = sortedAsc[0];
  const secondLowest = sortedAsc[1];
  const highest = sortedDesc[0];

  const weakPair = [lowest?.label, secondLowest?.label].filter(Boolean).join(" ve ");
  const riskLabels = sortedAsc
    .filter((d) => d.level !== "Tipik")
    .map((d) => d.label);

  let architecture = "dağılmış";
  if (atypicalCount >= 3) architecture = "yüksek şiddette yaygın";
  else if (riskyCount + atypicalCount >= Math.max(4, domainResults.length - 1)) architecture = "yaygın";
  else if (riskyCount + atypicalCount >= 2) architecture = "kümelenmiş";
  else architecture = "sınırlı";

  let homogeneityText = "alan puanları arasında ayrışma vardır";
  if (spread <= 3 || weightStd <= 0.35 || scoreStd <= 2) {
    homogeneityText = "alan puanları birbirine çok yakındır ve profil belirgin biçimde homojendir";
  } else if (spread <= 7 || scoreStd <= 4.5) {
    homogeneityText = "alan puanları görece benzerdir ve profil büyük ölçüde homojen görünmektedir";
  }

  let severityText = "düşük";
  if (atypicalCount >= 3) severityText = "yüksek";
  else if (atypicalCount >= 1 || riskyCount >= 4) severityText = "orta-ileri";
  else if (riskyCount >= 2) severityText = "orta";

  return {
    riskyCount,
    atypicalCount,
    typicalCount,
    spread,
    scoreStd,
    weightStd,
    lowest,
    secondLowest,
    highest,
    weakPair,
    riskLabels,
    architecture,
    homogeneityText,
    severityText,
  };
}

function buildInteroCentricComment(domainResults: DomainResult[]): string {
  const intero = domainResults.find(d => d.key === "interoception");
  const phys = domainResults.find(d => d.key === "physiological");
  const emo = domainResults.find(d => d.key === "emotional");
  const sortedWeak = [...domainResults]
    .filter((d) => d.level !== "Tipik")
    .sort((a, b) => a.score - b.score);
  const interoIsPrimary = sortedWeak[0]?.key === "interoception";

  if (!intero) return "";

  const interoLevel = intero.level;

  // 🔴 DURUM 1: intero atipik → merkez
  if (interoLevel === "Atipik") {
    return "İnterosepsiyon alanının atipik düzeyi, profilin bütüncül yorumunda merkezî bir eksen oluşturmaktadır. Bedensel sinyallerin izlenmesi ve düzenleyici yanıtların organize edilmesi süreçlerindeki bu zorlanma, diğer self-regülasyon alanlarıyla birlikte ele alındığında çok alanlı örüntüyü açıklayıcı bir çerçeve sunmaktadır.";
  }

  // 🔴 DURUM 2: intero riskli + fizyolojik/duygusal eşlik
  if (
    interoLevel === "Riskli" &&
    (interoIsPrimary || (phys && phys.level !== "Tipik") || (emo && emo.level !== "Tipik"))
  ) {
    return "İnterosepsiyon alanı, fizyolojik ve/veya duygusal düzenleme süreçleriyle birlikte değerlendirildiğinde, profilin açıklanmasında bütünleştirici bir eksen olarak öne çıkmaktadır.";
  }

  return "";
}

function buildWeaknessNarrative(domainResults: DomainResult[], homogeneous: boolean): string {
  const { strengths } = getMeaningfulStrengthWeakness(domainResults, homogeneous);
  const sortedWeak = [...domainResults]
    .filter((d) => d.level !== "Tipik")
    .sort((a, b) => a.score - b.score);

  if (sortedWeak.length === 0) {
    return strengths.length
      ? `- Tüm alanlar tipik aralıktadır; ${strengths.map((x) => x.label).join(", ")} alanlarında göreli korunmuşluk izlenmektedir.`
      : "- Tüm alanlar tipik aralıktadır ve belirgin bir kırılganlık odağı izlenmemektedir.";
  }

  if (sortedWeak.length === 1) {
    const preserved = strengths.length
      ? ` ${strengths.map((x) => x.label).join(", ")} alanlarında göreli korunmuşluk izlenmektedir.`
      : "";
    return `- Profil, temel olarak ${sortedWeak[0].label} alanında seçici bir kırılganlık göstermektedir.${preserved}`;
  }

  if (sortedWeak.length >= 3) {
    const secondaryLabels = sortedWeak.slice(1, 3).map((domain) => domain.label).join(" ve ");
    const preserved = strengths.length
      ? ` ${strengths.map((x) => x.label).join(", ")} alanlarında göreli korunmuşluk izlenmektedir.`
      : "";
    return `- Kırılganlık öncelikle ${sortedWeak[0].label} alanında belirginleşmekte; ${secondaryLabels} alanları bu örüntüye eşlik etmektedir.${preserved}`;
  }

  if (sortedWeak.length === 2) {
    const preserved = strengths.length
      ? ` ${strengths.map((x) => x.label).join(", ")} alanlarında göreli korunmuşluk izlenmektedir.`
      : "";
    return `- Kırılganlık ${sortedWeak[0].label} ve ${sortedWeak[1].label} alanlarında birlikte belirginleşmektedir.${preserved}`;
  }

  if (strengths.length) {
    return `- ${strengths.map((x) => x.label).join(", ")} alanlarında göreli korunmuşluk izlenmektedir.`;
  }

  return "";
}

function buildPatternSection(profileType: string, patterns: string[], domainResults: DomainResult[], homogeneous: boolean): string {
  const lines: string[] = [`- Profil sınıflaması: ${profileType}.`];
  const weaknessNarrative = buildWeaknessNarrative(domainResults, homogeneous);
  const { strengths, weaknesses } = getMeaningfulStrengthWeakness(domainResults, homogeneous);
  const nonTypicalCount = domainResults.filter((d) => d.level !== "Tipik").length;

  if (weaknessNarrative) {
    lines.push(weaknessNarrative);
  }

  if (nonTypicalCount === 0) {
    lines.push("- Alt alanların tümü tipik aralıkta seyrettiği için klinik olarak anlamlı bir risk kümesi ya da yaygın yük örüntüsü izlenmemektedir.");
  }

  if (patterns.length > 0) {
    lines.push(...patterns.map((p) => `- ${p}`));
  }

  if (homogeneous) {
    lines.push("- Alt alan puanları arasında belirgin bir ayrışma saptanmamıştır. Profil görece homojen görünmektedir.");
  } else {
    if (!patterns.length && !weaknessNarrative) {
      lines.push("- Belirgin klinik örüntü oluşturacak düzeyde ek bir alan kombinasyonu saptanmamıştır.");
    }
    if (strengths.length && weaknesses.length !== 1) {
      lines.push(`- Görece güçlü alan(lar): ${strengths.map((x) => x.label).join(", ")}.`);
    }
  }

  const interoComment = buildInteroCentricComment(domainResults);
  if (interoComment) {
    lines.push(`- ${interoComment}`);
  }

  return lines.join("\n");
}

function buildAnamnezFitSection(
  anamnezSummary: unknown,
  anamnezFlags: string[],
  domainResults: DomainResult[],
  profileType: string,
  externalTestDecisionNotes: string[] = [],
  externalTestAnalysis?: ExternalTestAnalysis
): string {
  const d = buildDeterministicProfileSummary(domainResults);
  const flagCount = Array.isArray(anamnezFlags) ? anamnezFlags.length : 0;
  const rawMatchedDomains = getRawMatchedDomains(domainResults, anamnezFlags).map((x) => x.label);
  const weakLabels = domainResults
    .filter((d) => d.level !== "Tipik")
    .sort((a, b) => a.score - b.score)
    .map((d) => d.label);
  const strongLabels = domainResults
    .filter((d) => d.level === "Tipik")
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((d) => d.label);
  const matchedDomains = selectNarrativelyMatchedDomains(domainResults, anamnezFlags)
    .map((x) => x.label)
    .slice(0, 3);
  const riskText = matchedDomains.length
    ? matchedDomains.join(", ")
    : d.weakPair || (d.riskLabels.length ? d.riskLabels.slice(0, 3).join(", ") : "belirgin zorlanma alanı saptanmadı");
  const summaryParts =
    typeof anamnezSummary === "string"
      ? [anamnezSummary.trim()]
      : Array.isArray(anamnezSummary)
      ? anamnezSummary.filter(Boolean).map((x) => String(x).trim())
      : anamnezSummary && typeof anamnezSummary === "object"
      ? [JSON.stringify(anamnezSummary).trim()]
      : [];
  const themePreview = summaryParts
    .slice(0, 2)
    .join(" ")
    .replace(/^Anamnezde\s+/i, "");

  const alignedDomains = rawMatchedDomains.filter((label) => weakLabels.includes(label)).slice(0, 3);
  const mismatchDomains = rawMatchedDomains.filter((label) => strongLabels.includes(label)).slice(0, 2);
  const partialDomains = rawMatchedDomains
    .filter((label) => !alignedDomains.includes(label) && !mismatchDomains.includes(label))
    .slice(0, 2);
  const compatibleTests = externalTestAnalysis?.compatible || [];
  const compatibleCategories = new Set(externalTestAnalysis?.compatibleCategories || []);
  const compatibleTestNames = compatibleTests.map((test) => test.name);
  const externalTestNamesText =
    compatibleTestNames.length >= 3
      ? `${compatibleTestNames.slice(0, 2).join(", ")} ve ${compatibleTestNames[2]}`
      : compatibleTestNames.length === 2
      ? compatibleTestNames.join(" ve ")
      : compatibleTestNames[0] || "";
  const externalCautionNotes = externalTestDecisionNotes.filter((note) => /yaş aralığı|ana klinik karar|temkin/i.test(note));
  const externalFitSynthesis: string[] = [];

  if (compatibleCategories.has("motor_praxis")) {
    externalFitSynthesis.push(
      `${externalTestNamesText || "Motor planlama testleri"} bulguları, zorlanmanın yalnız dikkat ya da genel davranış kontrolünde değil; görevi başlatma, hareket dizisini kurma, beden organizasyonunu sürdürme ve çok basamaklı eylemi tamamlama ekseninde taşındığını göstermektedir.`
    );

    if (compatibleCategories.has("adaptive_daily_living")) {
      externalFitSynthesis.push(
        "Praksi ve günlük yaşam verileri birlikte ele alındığında, motor planlama yükünün işlevsel karşılığının özellikle öz bakım, araç gereç kullanımı, sıraya dayalı görevler ve günlük rutini sürdürebilme alanlarında görünürleştiği anlaşılmaktadır."
      );
    } else {
      externalFitSynthesis.push(
        "Bu nedenle anamnezde tarif edilen dağılma ve görevden kopma, salt dikkat azalmasından çok motor planlama yükü arttığında davranış organizasyonunun çözülmesi şeklinde okunmalıdır."
      );
    }
  }

  if (compatibleCategories.has("adaptive_daily_living")) {
    externalFitSynthesis.push(
      `${externalTestNamesText || "Uyumsal işlev testleri"} verileri, güçlüğün kapasitenin tümden kaybından çok günlük öz bakım, rutin başlatma, sıralı görevi sürdürme ve tamamlamada tutarlılık sorunu olarak görünür hale geldiğini düşündürmektedir.`
    );
  }

  const externalFitNotesToAppend = externalFitSynthesis.length > 0
    ? [...externalFitSynthesis.slice(0, 2), ...externalCautionNotes.slice(0, 1)]
    : externalTestDecisionNotes.slice(0, 2);

  if (weakLabels.length === 0) {
    const sentences: string[] = []

    if (flagCount >= 1) {
      sentences.push("Anamnezde bağlama duyarlı bazı zorluklar ve destek gerektiren anlar tarif edilmektedir.")
    } else {
      sentences.push("Anamnezde bildirilen bağlamsal zorluklar ölçek bulgularıyla birlikte ele alınmıştır.")
    }

    if (rawMatchedDomains.length > 0) {
      sentences.push(`Bu temalar özellikle ${rawMatchedDomains.slice(0, 2).join(", ")} alanlarıyla birlikte okunmuş; ancak ölçek sonuçları bu alanlarda yaygın ya da kalıcı bir kırılganlık kümelenmesine işaret etmemiştir.`)
    } else {
      sentences.push("Bildirilen güçlükler ölçek üzerinde belirgin bir risk kümesine dönüşmemiştir.")
    }

    sentences.push("Bu nedenle anamnez ile ölçek arasında doğrudan patolojik uyumdan çok, bağlama duyarlı ancak genel olarak korunmuş bir işleyiş örüntüsü izlenmektedir.")

    if (externalFitNotesToAppend.length > 0) {
      sentences.push(...externalFitNotesToAppend)
    }

    return sentences.join(" ")
  }

  if (flagCount >= 1 && themePreview) {
    const sentences: string[] = [`Anamnezde ${themePreview}`];

    if (alignedDomains.length > 0) {
      sentences.push(`Ölçekte öne çıkan ${alignedDomains.join(", ")} alanları bu anlatımla doğrudan uyum göstermektedir.`);
    }

    if (partialDomains.length > 0) {
      sentences.push(`${partialDomains.join(", ")} alanlarında ise daha sınırlı ama klinik olarak anlamlı bir eşleşme izlenmektedir.`);
    }

    if (mismatchDomains.length > 0) {
      sentences.push(`${mismatchDomains.join(", ")} alanlarına ilişkin anamnez vurgusu bulunmasına karşın ölçek bulguları bu alanlarda göreli korunmuş görünmektedir; bu durum bağlama özgü bir ayrışma düşündürebilir.`);
    }

    if (alignedDomains.length >= 2 && mismatchDomains.length === 0) {
      sentences.push(`Bu nedenle anamnez-ölçek uyumu yüksek düzeyde ve "${profileType}" yorumu klinik bağlamla tutarlıdır.`);
    } else if (alignedDomains.length >= 1 || mismatchDomains.length >= 1 || partialDomains.length >= 1) {
      sentences.push(`Bu nedenle anamnez-ölçek ilişkisi tam örtüşmeden çok, doğrudan uyum ve kısmi ayrışmanın birlikte izlendiği bir örüntü göstermektedir.`);
    } else {
      sentences.push(`Bu nedenle klinik yorum ağırlıklı olarak skor örüntüsüne dayandırılmıştır.`);
    }

    if (externalFitNotesToAppend.length > 0) {
      sentences.push(...externalFitNotesToAppend);
    }

    return sentences.join(" ");
  }

  const noteText = externalFitNotesToAppend.length > 0 ? ` ${externalFitNotesToAppend.join(" ")}` : ""
  return `Anamnezde "${profileType}" örüntüsünü doğrudan güçlendiren belirgin tema sınırlıdır. Ölçekte görece daha çok zorlanan alanlar ${riskText} ekseninde toplanmaktadır. Bu nedenle klinik yorum ağırlıklı olarak skor örüntüsüne dayandırılmıştır.${noteText}`;
}

function buildConclusion(
  globalLevel: DomainLevel,
  profileType: string,
  normSource: string,
  domainResults?: DomainResult[]
): string {
  const d = domainResults?.length ? buildDeterministicProfileSummary(domainResults) : null;
  const sortedNonTypical = domainResults?.length
    ? [...domainResults].filter((domain) => domain.level !== "Tipik").sort((a, b) => a.score - b.score)
    : [];
  const focusLabels =
    sortedNonTypical.length >= 3
      ? sortedNonTypical.slice(0, 3).map((domain) => domain.label).join(", ")
      : sortedNonTypical.length === 2
      ? sortedNonTypical.map((domain) => domain.label).join(" ve ")
      : sortedNonTypical[0]?.label || "";

  const levelText =
    globalLevel === "Tipik"
      ? "genel profil büyük ölçüde korunmuş görünmektedir"
      : globalLevel === "Riskli"
      ? "genel profil yaygın fakat yönetilebilir bir destek gereksinimine işaret etmektedir"
      : "genel profil belirgin ve yüksek klinik yük göstermektedir";

  const patternText = d
    ? d.riskyCount === 0 && d.atypicalCount === 0
      ? " Klinik olarak anlamlı bir risk kümesi izlenmemekte; alanlar tipik aralıkta ve genel işlevsellik korunmuş görünmektedir."
      : d.spread <= 3
      ? ` Zorlanma alanlara yakın düzeyde yayılmış görünmektedir. Örüntü yapısı ${d.architecture} ve klinik yük ${d.severityText} düzeydedir.`
      : ` Görece en çok zorlanan eksen ${(focusLabels || d.lowest?.label || "öncelikli alanlar")} alanlarında toplanmaktadır. Örüntü yapısı ${d.architecture} ve klinik yük ${d.severityText} düzeydedir.`
    : "";

  const homogeneityText = d
    ? ` ${d.homogeneityText.charAt(0).toUpperCase() + d.homogeneityText.slice(1)}.`
    : "";

  const normText =
    normSource === "age_band_heuristic"
      ? " Yorum yaş-duyarlı norm bandı ile yapılmıştır."
      : normSource === "fallback_fixed"
      ? " Yorum sabit sistem eşikleri ile yapılmıştır."
      : "";

  return `Sonuç olarak profil "${profileType}" ile uyumludur; ${levelText}.${patternText}${homogeneityText}${normText} Klinik yorumun anamnez ve gözlemle birlikte ele alınması uygundur.`;
}

export function generateDeterministicReport(input: ReportInput): DeterministicReport {
  const normalized = normalizeLegacyScores(input.scores);

  const rawAnamnez = anamnezToRecord(input.anamnez);
  const cleanedAnamnez: AnamnezRecord = Object.fromEntries(
    Object.entries(rawAnamnez)
      .map(([k, v]) => [k, cleanMeaningfulText(v)] as const)
      .filter(([, v]) => Boolean(v))
  );

  const anamnezSummary = summarizeAnamnezThemes(cleanedAnamnez);
  const anamnezFlags = extractAnamnezFlags(cleanedAnamnez);
  const anamnezSignals = getAnamnezThemeSignals(cleanedAnamnez);
  const therapistInsights = extractTherapistInsights(cleanedAnamnez);
  const externalClinicalFindings = extractExternalClinicalFindings(cleanedAnamnez);
  const externalTestAnalysis = analyzeExternalClinicalTests(cleanedAnamnez.external_clinical_findings, input.ageMonths);
  const rawExternalNarrativeLines =
    externalTestAnalysis.matches.length === 0 ? externalClinicalFindings : [];
  const externalNarrativeLines = [
    ...rawExternalNarrativeLines,
    ...externalTestAnalysis.specificNarrativeLines,
    ...externalTestAnalysis.conciseSupportLines,
    ...externalTestAnalysis.synthesisLines,
    ...externalTestAnalysis.decisionLines,
  ].slice(0, 5);
  const externalWarningLines = externalTestAnalysis.warningLines.slice(0, 2);
  const externalTestDecisionNotes = externalTestAnalysis.decisionLines.length
    ? [...externalTestAnalysis.decisionLines, ...externalWarningLines].slice(0, 2)
    : externalWarningLines.length
    ? externalWarningLines
    : [
        ...externalTestAnalysis.specificNarrativeLines,
        ...externalTestAnalysis.synthesisLines,
        ...externalTestAnalysis.conciseSupportLines,
      ].slice(0, 2);

  const orderedKeys = Object.keys(DOMAIN_META) as DomainKey[];
  const domainResults: DomainResult[] = orderedKeys.map((key) => {
    const score = clampScore(normalized[key]);
    const level = classifyDomainScore(key, score, { ageMonths: input.ageMonths });
    return {
      key,
      name: DOMAIN_META[key].label,
      label: DOMAIN_META[key].label,
      score,
      level,
      comment: getDomainCommentByLevel(key, level),
    };
  });

  const totalScore = domainResults.reduce((sum, d) => sum + d.score, 0);
  const safeTotal = Math.max(GLOBAL_MIN, Math.min(GLOBAL_MAX, totalScore));
  const globalLevel = classifyTotalScore(safeTotal, { ageMonths: input.ageMonths });
  const homogeneousProfile = getHomogeneousProfile(domainResults);
  const normSource = getNormSource(input.ageMonths);
  const ageBandLabel = findAgeNormBand(input.ageMonths)?.label ?? null;
  const profileType = detectProfileType(
    domainResults,
    globalLevel,
    homogeneousProfile,
    anamnezSignals,
    externalTestAnalysis
  );
  const patterns = analyzePatterns(domainResults, homogeneousProfile);
  const itemLevelAnalysis = analyzeItemLevelSignals({
    answers: input.answers,
    anamnezRecord: cleanedAnamnez,
    therapistInsights,
    externalClinicalFindings: externalNarrativeLines,
    domainResults,
  });

  const clinicalAnalysis = buildClinicalAnalysis(
    domainResults,
    safeTotal,
    profileType,
    globalLevel,
    anamnezFlags,
    therapistInsights,
    ageBandLabel,
    externalNarrativeLines.slice(0, 3),
    externalWarningLines,
    externalTestAnalysis.compatibleIds,
    externalTestAnalysis.compatibleCategories,
    externalTestAnalysis.primaryCompatibleCategory,
    itemLevelAnalysis || undefined
  );

  const qualityGuidance = buildQualityGuidance({
    domainResults,
    globalLevel,
    profileType,
    anamnezThemes: anamnezFlags,
    matchedDomains: clinicalAnalysis.matchedDomains,
    therapistInsights,
    externalClinicalFindings: externalNarrativeLines.slice(0, 3),
    externalClinicalWarnings: externalWarningLines,
    criticalItemLines: itemLevelAnalysis?.criticalLines,
    alignedItemLines: itemLevelAnalysis?.alignedLines,
  });

  clinicalAnalysis.qualityFocusMode = qualityGuidance.focusMode;
  clinicalAnalysis.qualityPrimaryEvidenceLines = qualityGuidance.primaryEvidenceLines;
  clinicalAnalysis.qualitySupportingEvidenceLines = qualityGuidance.supportingEvidenceLines;
  clinicalAnalysis.qualityRestraintLines = qualityGuidance.restraintLines;
  clinicalAnalysis.qualityCautionLines = qualityGuidance.cautionLines;

  const visibleInfo = extractVisibleCaseInfo(cleanedAnamnez, {
    clientCode: input.clientCode,
    ageMonths: input.ageMonths,
  });

  const allTypicalProfile = domainResults.every((d) => d.level === "Tipik");
  const sections = {
    general: buildGeneralSection(
      safeTotal,
      globalLevel,
      homogeneousProfile,
      profileType,
      domainResults,
      ageBandLabel,
      normSource,
      visibleInfo
    ),
    numerical: buildNumericalSection(domainResults),
    domains: buildDomainSection(domainResults, anamnezFlags, externalTestAnalysis),
    patterns: [
      buildPatternSection(profileType, patterns, domainResults, homogeneousProfile),
      ...(allTypicalProfile
        ? []
        : externalTestAnalysis.specificNarrativeLines.length
        ? externalTestAnalysis.specificNarrativeLines.slice(0, 2).map((line) => `- ${line}`)
        : []),
      ...(allTypicalProfile
        ? []
        : externalTestAnalysis.synthesisLines.length
        ? externalTestAnalysis.synthesisLines.slice(0, 2).map((line) => `- ${line}`)
        : []),
      ...(itemLevelAnalysis?.criticalLines.length
        ? [`- Madde düzeyinde dikkat çeken bulgular: ${itemLevelAnalysis.criticalLines.join(" ")}`]
        : []),
    ]
      .filter(Boolean)
      .join("\n"),
    anamnezTestFit: [
      buildAnamnezFitSection(
        anamnezSummary,
        anamnezFlags,
        domainResults,
        profileType,
        externalTestDecisionNotes,
        externalTestAnalysis
      ),
      ...(itemLevelAnalysis?.alignedLines.length
        ? [`Anamnezle en güçlü örtüşen maddeler: ${itemLevelAnalysis.alignedLines.join(" ")}`]
        : []),
    ]
      .filter(Boolean)
      .join(" "),
    conclusion: buildConclusion(globalLevel, profileType, normSource, domainResults),
  };

  const reportText = [
    "1. Genel Klinik Değerlendirme",
    sections.general,
    "",
    "2. Sayısal Sonuç Özeti",
    sections.numerical,
    "",
    "3. Alan Bazlı Klinik Yorum",
    sections.domains,
    "",
    "4. Örüntü Analizi",
    sections.patterns,
    "",
    "5. Anamnez – Test Uyum Değerlendirmesi",
    sections.anamnezTestFit,
    "",
    "6. Kısa Sonuç",
    sections.conclusion,
  ].join("\n");

  const { strengths, weaknesses } = getMeaningfulStrengthWeakness(domainResults, homogeneousProfile);

  const domainLevels = domainResults.reduce<Record<string, DomainLevel>>((acc, d) => {
    acc[d.key] = d.level;
    const meta = DOMAIN_META[d.key as DomainKey];
    acc[meta.legacyName] = d.level;
    return acc;
  }, {});

  return {
    normSource,
    ageBandLabel,
    clinicalAnalysis,
    totalScore: safeTotal,
    globalLevel,
    homogeneousProfile,
    profileType,
    domainResults,
    patterns,
    anamnezFlags,
    anamnezSummary,
    reportText,
    deterministicReport: reportText,
    domains: domainResults,
    weakDomains: weaknesses,
    strongDomains: strengths,
    text: reportText,
    summary: sections.general,
    domainLevels,
    sections,
  };
}

export function buildDeterministicReport(input: ReportInput): DeterministicReport {
  return generateDeterministicReport(input);
}

export function createDeterministicReport(input: ReportInput): DeterministicReport {
  return generateDeterministicReport(input);
}

export function buildAdvancedReport(
  clientCodeOrInput: string | ReportInput,
  anamnez?: string | AnamnezRecord,
  legacyScores?: DomainScoreMap
): DeterministicReport {
  if (typeof clientCodeOrInput === "object" && clientCodeOrInput !== null) {
    return generateDeterministicReport(clientCodeOrInput);
  }

  return generateDeterministicReport({
    clientCode: clientCodeOrInput,
    anamnez: anamnez ?? "",
    scores: legacyScores ?? {},
  });
}

export default generateDeterministicReport;

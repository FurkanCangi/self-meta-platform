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
import {
  buildClinicalAnalysis,
  type ClinicalEvidenceMap,
  type ClinicalMechanismType,
} from "./clinicalAnalysis";
import { analyzeExternalClinicalTests, type ExternalTestAnalysis, type ExternalTestCategory } from "./externalTestRegistry";
import { analyzeItemLevelSignals, type ItemLevelAnalysis } from "./itemSignals";
import { buildQualityGuidance, type QualityGuidance } from "./reportQuality";
import {
  buildDomainKnowledgeText,
  buildUseKnowledgeText,
} from "./clinicalKnowledgeSelector";
import { CLINICAL_KNOWLEDGE_CHUNKS, WORD_RAG_SOURCE } from "./clinicalKnowledgeBase";
import {
  buildReportTrace,
  type ReportAuditTrail,
  type ReportTrace,
  type ReportVersionMeta,
} from "./reportTrace";
import { normalizeTurkishClinicalText, sanitizeFinalReportLanguage } from "./reportLanguageQuality";
import { buildClinicalReasoning } from "./clinicalReasoning";
import { buildDifferentialFormulation } from "./clinicalDifferentialFormulation";
import { compileClinicalNarrative } from "./clinicalNarrativeCompiler";

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
  trace?: ReportTrace;
  auditTrail?: ReportAuditTrail;
  reportVersionMeta?: ReportVersionMeta;
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
    trace?: ReportTrace;
    auditTrail?: ReportAuditTrail;
    reportVersionMeta?: ReportVersionMeta;
    qualityFocusMode?: "balanced" | "selective" | "paired" | "widespread";
    qualityPrimaryEvidenceLines?: string[];
    qualitySupportingEvidenceLines?: string[];
    qualityRestraintLines?: string[];
    qualityCautionLines?: string[];
    evidenceMap?: ClinicalEvidenceMap;
    classificationNote?: string;
    primaryClinicalHypothesis?: string;
    primaryClinicalAxis?: string;
    secondaryClinicalAxes?: string[];
    caseEvidenceLines?: string[];
    dataLimitations?: string[];
    dataConfidenceLevel?: ClinicalEvidenceMap["confidenceLevel"];
    dataConfidenceRationale?: string;
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
    decisionNote: string;
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
    low: "Bu alan, çevresel uyaranlara verilen yanıtlar açısından belirgin hassasiyet veya düzensizlik düşündürmektedir.",
    mid: "Bu alan, duyusal uyaranlara verilen tepkilerin bağlama göre değişebildiğini ve bazı ortamlarda düzenleme desteği gerekebileceğini düşündürmektedir.",
    high: "Bu alan, çevresel uyaranların işlenmesi ve duyusal düzenleme açısından görece dengeli bir profil düşündürmektedir.",
  },
  emotional: {
    label: "Duygusal Regülasyon",
    legacyName: "duygusal",
    low: "Bu alan, yoğun duyguları yönetme, hayal kırıklığı toleransı ve yeniden sakinleşme süreçlerinde belirgin güçlük düşündürmektedir.",
    mid: "Bu alan, duygusal düzenleme becerilerinin tutarlı olmadığını ve zorlayıcı durumlarda ek destek gerekebileceğini düşündürmektedir.",
    high: "Bu alan, duygusal yanıtları düzenleme ve zorlayıcı durumlarda toparlanma açısından görece yeterli bir görünüm sunmaktadır.",
  },
  cognitive: {
    label: "Bilişsel Regülasyon",
    legacyName: "bilissel",
    low: "Bu alan, dikkat, göreve başlama, sürdürme ve bilişsel organizasyon süreçlerinde belirgin zorluk düşündürmektedir.",
    mid: "Bu alan, bilişsel düzenleme becerilerinin bazı görevlerde yeterli, bazı görevlerde ise destek gerektirebileceğini düşündürmektedir.",
    high: "Bu alan, dikkat ve bilişsel organizasyon süreçleri açısından görece korunmuş bir görünüm sunmaktadır.",
  },
  executive: {
    label: "Yürütücü İşlev",
    legacyName: "yurutucu",
    low: "Bu alan, inhibisyon, kural takibi, organizasyon ve davranış kontrolünde belirgin güçlük düşündürmektedir.",
    mid: "Bu alan, yürütücü işlev becerilerinin değişken olduğunu ve yapılandırılmış destekten yarar görebileceğini düşündürmektedir.",
    high: "Bu alan, davranış kontrolü, organizasyon ve görev yönetimi açısından görece yeterli bir görünüm sunmaktadır.",
  },
  interoception: {
    label: "İnterosepsiyon",
    legacyName: "intero",
    low: "Bu alan, açlık, susuzluk, yorgunluk, ağrı ve diğer bedensel sinyalleri fark etme/yorumlama süreçlerinde güçlük düşündürmektedir.",
    mid: "Bu alan, bedensel sinyalleri fark etme becerilerinin bağlama göre değişebildiğini ve bazı durumlarda ek destek gerekebileceğini düşündürmektedir.",
    high: "Bu alan, bedensel sinyalleri fark etme ve bunlara uygun yanıt verme açısından görece dengeli bir görünüm sunmaktadır.",
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

function hasExplicitSensoryNarrative(text: string): boolean {
  return /duyusal|dokunsal|gürültü|gurultu|kalabalık|kalabalik|ses|çevresel uyaran|cevresel uyaran|tetikleyici çevresel|tetikleyici cevresel|sensory profile|spm/.test(
    text
  );
}

function shouldShowAnamnezHintForDomain(
  key: DomainKey,
  level: DomainLevel | undefined,
  profileType: string | undefined
) {
  if (level && level !== "Tipik") return true;

  const profile = String(profileType || "").toLowerCase()

  if (key === "sensory") return /duyusal/.test(profile)
  if (key === "emotional") return /duygusal/.test(profile)
  if (key === "cognitive") return /bilişsel|dilsel/.test(profile)
  if (key === "executive") return /yürütücü|günlük yaşam|öz bakım/.test(profile)
  if (key === "physiological") return /fizyolojik|beden/.test(profile)
  if (key === "interoception") return /interosepsiyon|fizyolojik|beden/.test(profile)

  return false
}

function getAnamnezMatchHint(
  key: DomainKey,
  anamnezFlags: string[],
  params?: { level?: DomainLevel; profileType?: string }
): string {
  if (!shouldShowAnamnezHintForDomain(key, params?.level, params?.profileType)) {
    return ""
  }

  const joined = anamnezFlags.join(" ").toLowerCase();

  if (key === "sensory" && hasExplicitSensoryNarrative(joined)) {
    return " Anamnezde tarif edilen çevresel ve dokunsal hassasiyet bu alanla uyumludur.";
  }
  if (key === "emotional" && /duygusal|toparlanma|sakinleş|uyaran sonrası/.test(joined)) {
    return " Anamnezde bildirilen zorlanma sonrası duygusal toparlanma güçlüğü bu alanı desteklemektedir.";
  }
  if ((key === "cognitive" || key === "executive") && /dikkat|görevde kal|görev sürdür|çok uyaran|yönerge|sözel/.test(joined)) {
    return " Anamnezdeki bağlamsal bilgi, bilişsel-yürütücü organizasyonun hangi koşullarda kırılganlaştığını anlamak için destekleyici veri sağlar.";
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
    strengths: domainResults.filter((d) => d.level === "Tipik" && max - d.score <= 1),
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
    return hasExplicitSensoryNarrative(joinedFlags);
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
    return /bedensel|fizyolojik|yorgun|uyku|beslenme|iştah|alerji|kolik|nöbet|tuvalet|açlık|aclik|susama|susuz/.test(
      joinedFlags
    );
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
  return "Çok Alanlı Self-Regülasyon Problemi";
}

function buildProfileDomainWeights(
  domainResults: DomainResult[],
  anamnezSignals: AnamnezThemeSignals,
  externalTestAnalysis?: ExternalTestAnalysis
) {
  const compatibleCategories = new Set(externalTestAnalysis?.decisionCompatibleCategories || []);

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
  if (!externalTestAnalysis || externalTestAnalysis.decisionCompatible.length === 0) return null;

  const compatibleIds = new Set(externalTestAnalysis.decisionCompatibleIds || []);
  const compatibleCategories = new Set(externalTestAnalysis.decisionCompatibleCategories || []);
  const primaryCategory = externalTestAnalysis.primaryCompatibleCategory;
  const nonTypical = [...domainResults].filter((d) => d.level !== "Tipik").sort((a, b) => a.score - b.score);
  const nonTypicalKeys = new Set(nonTypical.map((d) => d.key));

  const hasPraxisSignal = compatibleCategories.has("motor_praxis");
  const hasSiptSignal = compatibleIds.has("sipt");
  const hasSensorySignal = compatibleCategories.has("sensory_processing");
  const hasAdaptiveSignal = compatibleCategories.has("adaptive_daily_living");
  const hasExecutiveSignal = compatibleCategories.has("executive_behavior");
  const hasLanguageSignal = compatibleCategories.has("language_communication");
  const hasSocialSignal = compatibleCategories.has("social_pragmatic");
  const hasBodyDrivenWeakness =
    nonTypicalKeys.has("physiological") || nonTypicalKeys.has("interoception") || anamnezSignals.bodyIntero;
  const hasExecutiveDrivenWeakness =
    nonTypicalKeys.has("executive") || nonTypicalKeys.has("cognitive") || anamnezSignals.cognitiveExecutive;

  if (primaryCategory === "language_communication") {
    if (hasSocialSignal && (nonTypical.length >= 2 || hasExecutiveDrivenWeakness)) {
      return "Dilsel ve Sosyal-Pragmatik Talep Altında Self-Regülasyon Problemi";
    }
    if (nonTypical.length >= 2 || nonTypicalKeys.has("cognitive") || nonTypicalKeys.has("executive")) {
      return "Dilsel Talep Altında Self-Regülasyon Problemi";
    }
    if (anamnezSignals.languageLoad) {
      return "Dilsel Talep Altında Seçici Kırılganlık";
    }
  }

  if (primaryCategory === "social_pragmatic") {
    if (hasLanguageSignal && (nonTypical.length >= 2 || hasExecutiveDrivenWeakness)) {
      return "Dilsel ve Sosyal-Pragmatik Talep Altında Self-Regülasyon Problemi";
    }
    if (nonTypical.length >= 2 || nonTypicalKeys.has("emotional") || nonTypicalKeys.has("executive")) {
      return "Sosyal-Pragmatik Esneklikle İlişkili Self-Regülasyon Problemi";
    }
    if (anamnezSignals.socialPragmatic) {
      return "Sosyal-Pragmatik Esneklikte Seçici Kırılganlık";
    }
  }

  if (primaryCategory === "executive_behavior") {
    if (nonTypicalKeys.has("executive") && nonTypicalKeys.has("emotional")) {
      return nonTypical.length >= 3
        ? "Yürütücü-Duygusal Self-Regülasyon Problemi"
        : "Yürütücü-Duygusal Regülasyon Kırılganlığı";
    }
    if (hasBodyDrivenWeakness && hasAdaptiveSignal) {
      return nonTypical.length >= 3
        ? "Yürütücü-Beden Temelli Self-Regülasyon Problemi"
        : "Yürütücü-Beden Temelli Seçici Kırılganlık";
    }
    if (hasAdaptiveSignal && (nonTypical.length >= 2 || nonTypicalKeys.has("executive") || nonTypicalKeys.has("cognitive"))) {
      return "Yürütücü İşlev ve Günlük Yaşam Akışında Self-Regülasyon Problemi";
    }
    if (hasPraxisSignal && hasBodyDrivenWeakness) {
      return nonTypical.length >= 3
        ? "Yürütücü-Beden Temelli Self-Regülasyon Problemi"
        : "Yürütücü-Beden Temelli Seçici Kırılganlık";
    }
  }

  if (primaryCategory === "adaptive_daily_living") {
    if (hasBodyDrivenWeakness && nonTypicalKeys.has("physiological") && nonTypicalKeys.has("interoception")) {
      return nonTypical.length >= 3
        ? "Fizyolojik Toparlanma ve Beden Temelli Self-Regülasyon Problemi"
        : "Fizyolojik Toparlanma Ekseninde Seçici Kırılganlık";
    }
    if (nonTypical.length >= 3 || nonTypicalKeys.has("executive") || nonTypicalKeys.has("interoception")) {
      return "Günlük Yaşam ve Öz Bakım Akışında Self-Regülasyon Problemi";
    }
    if (anamnezSignals.adaptiveDailyLiving) {
      return "Günlük Yaşam Akışında Seçici Kırılganlık";
    }
  }

  if (primaryCategory === "motor_praxis" || (hasPraxisSignal && !hasExecutiveSignal && !hasAdaptiveSignal)) {
    if (hasSiptSignal && (nonTypicalKeys.has("executive") || nonTypicalKeys.has("cognitive"))) {
      if (nonTypical.length >= 3) {
        return "Motor Planlama ve Beden Organizasyonu ile İlişkili Self-Regülasyon Problemi";
      }
      return "Motor Planlama ve Beden Organizasyonu ile İlişkili Seçici Kırılganlık";
    }

    if (compatibleIds.has("mabc3") || compatibleIds.has("pdms3") || compatibleIds.has("bot2") || compatibleIds.has("mfun")) {
      if (nonTypical.length >= 3) {
        return "Motor Planlama ve Beden Organizasyonu ile İlişkili Self-Regülasyon Problemi";
      }
      return "Motor Planlama ile İlişkili Seçici Kırılganlık";
    }
  }

  if (primaryCategory === "sensory_processing" && (nonTypicalKeys.has("sensory") || nonTypical[0]?.key === "sensory")) {
    if (nonTypicalKeys.has("emotional") && nonTypical.length >= 2) {
      return "Duyusal-Duygusal Regülasyon Profili";
    }

    if (nonTypical.length >= 3) {
      return "Duyusal Yükün Eşlik Ettiği Çok Alanlı Regülasyon Profili";
    }

    return "Duyusal Alanda Seçici Kırılganlık";
  }

  if (!primaryCategory && hasAdaptiveSignal) {
    if (nonTypical.length >= 3 || nonTypicalKeys.has("executive") || nonTypicalKeys.has("interoception")) {
      return "Günlük Yaşam ve Öz Bakım Akışında Self-Regülasyon Problemi";
    }
    if (anamnezSignals.adaptiveDailyLiving) {
      return "Günlük Yaşam Akışında Seçici Kırılganlık";
    }
  }

  if (!primaryCategory && hasSocialSignal) {
    if (nonTypical.length >= 2 || nonTypicalKeys.has("emotional") || nonTypicalKeys.has("executive")) {
      return "Sosyal-Pragmatik Esneklikle İlişkili Self-Regülasyon Problemi";
    }
    if (anamnezSignals.socialPragmatic) {
      return "Sosyal-Pragmatik Esneklikte Seçici Kırılganlık";
    }
  }

  if (!primaryCategory && hasLanguageSignal) {
    if (nonTypical.length >= 2 || nonTypicalKeys.has("cognitive") || nonTypicalKeys.has("executive")) {
      return "Dilsel Talep Altında Self-Regülasyon Problemi";
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

  const externalMatches = externalTestAnalysis?.matches || [];
  const hasLimitedExternalEvidence = externalMatches.some(
    (match) =>
      match.ageCompatible === false ||
      match.resultQuality === "ham_puan_only" ||
      match.resultQuality === "missing_result" ||
      match.resultQuality === "qualitative_only"
  );
  const hasPreservedExternalEvidence = externalMatches.some(
    (match) => match.ageCompatible === true && match.resultDirection === "expected_or_preserved"
  );
  const hasDecisionWeightedExternalEvidence = (externalTestAnalysis?.decisionCompatible.length || 0) > 0;
  const hasMixedExternalEvidence =
    Boolean(externalTestAnalysis?.mixedValidity) ||
    (hasLimitedExternalEvidence && hasPreservedExternalEvidence) ||
    (hasLimitedExternalEvidence && hasDecisionWeightedExternalEvidence) ||
    (hasPreservedExternalEvidence && hasDecisionWeightedExternalEvidence);
  const hasHighConflictExternalEvidence =
    hasMixedExternalEvidence &&
    ((hasLimitedExternalEvidence && hasPreservedExternalEvidence) ||
      (hasLimitedExternalEvidence && hasDecisionWeightedExternalEvidence) ||
      Boolean(externalTestAnalysis?.mixedValidity && (hasLimitedExternalEvidence || hasPreservedExternalEvidence)));
  const hasExecutiveCognitiveEmotionalLoad = nonTypical.some((domain) =>
    ["executive", "cognitive", "emotional"].includes(domain.key)
  );

  if (hasHighConflictExternalEvidence && hasExecutiveCognitiveEmotionalLoad) {
    if (anamnezSignals.transitionCoregulation) {
      return "Geçiş ve Ko-Regülasyon İçeren Kanıt-Sınırlı Karma Regülasyon Profili";
    }
    if (externalTestAnalysis?.primaryCompatibleCategory === "motor_praxis") {
      return "Motor Planlama ve Beden Organizasyonu İçeren Kanıt-Sınırlı Karma Regülasyon Profili";
    }
    if (externalTestAnalysis?.primaryCompatibleCategory === "language_communication") {
      return "Dilsel Talep İçeren Kanıt-Sınırlı Karma Regülasyon Profili";
    }
    if (externalTestAnalysis?.primaryCompatibleCategory === "social_pragmatic") {
      return "Sosyal-Pragmatik Talep İçeren Kanıt-Sınırlı Karma Regülasyon Profili";
    }
    if (externalTestAnalysis?.primaryCompatibleCategory === "adaptive_daily_living") {
      return "Günlük Yaşam ve Öz Bakım İçeren Kanıt-Sınırlı Karma Regülasyon Profili";
    }
    if (anamnezSignals.motorPraxis) {
      return "Motor Planlama ve Beden Organizasyonu İçeren Kanıt-Sınırlı Karma Regülasyon Profili";
    }
    if (anamnezSignals.languageLoad) {
      return "Dilsel Talep İçeren Kanıt-Sınırlı Karma Regülasyon Profili";
    }
    if (anamnezSignals.socialPragmatic) {
      return "Sosyal-Pragmatik Talep İçeren Kanıt-Sınırlı Karma Regülasyon Profili";
    }
    if (anamnezSignals.adaptiveDailyLiving) {
      return "Günlük Yaşam ve Öz Bakım İçeren Kanıt-Sınırlı Karma Regülasyon Profili";
    }
    return "Kanıt-Sınırlı / Karma Regülasyon Profili";
  }

  const externalTestProfileType = detectExternalTestProfileType(domainResults, anamnezSignals, externalTestAnalysis);
  if (externalTestProfileType) {
    return externalTestProfileType;
  }

  const weightedDomains = buildProfileDomainWeights(domainResults, anamnezSignals, externalTestAnalysis);
  const weightedKeys = new Set(weightedDomains.slice(0, 2).map((domain) => domain.key as DomainKey));

  if (anamnezSignals.transitionCoregulation && weightedKeys.has("emotional") && weightedKeys.has("executive")) {
    return nonTypical.length >= 3 ? "Geçiş ve Ko-Regülasyon İçeren Self-Regülasyon Problemi" : "Geçiş ve Ko-Regülasyon Kırılganlığı";
  }

  if (
    anamnezSignals.bodyIntero &&
    nonTypicalKeys.has("physiological") &&
    nonTypicalKeys.has("interoception") &&
    weightedKeys.has("physiological") &&
    weightedKeys.has("interoception")
  ) {
    return nonTypical.length >= 2
      ? "Fizyolojik Toparlanma ve Beden Temelli Self-Regülasyon Problemi"
      : "Fizyolojik Toparlanma Ekseninde Seçici Kırılganlık";
  }

  if (anamnezSignals.socialPragmatic && weightedKeys.has("executive") && weightedKeys.has("emotional")) {
    return nonTypical.length >= 2
      ? "Sosyal-Pragmatik Esneklikle İlişkili Self-Regülasyon Problemi"
      : "Sosyal-Pragmatik Esneklikte Seçici Kırılganlık";
  }

  if (anamnezSignals.adaptiveDailyLiving && (weightedKeys.has("executive") || weightedKeys.has("interoception"))) {
    return nonTypical.length >= 2
      ? "Günlük Yaşam ve Öz Bakım Akışında Self-Regülasyon Problemi"
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
    return "Yürütücü-Beden Temelli Self-Regülasyon Problemi";
  }

  if (
    nonTypicalKeys.has("cognitive") &&
    nonTypicalKeys.has("executive") &&
    nonTypicalKeys.has("emotional") &&
    spread >= MEANINGFUL_SPREAD_THRESHOLD - 1
  ) {
    return "Bilişsel-Yürütücü-Duygusal Self-Regülasyon Problemi";
  }

  if (nonTypicalKeys.has("executive") && nonTypicalKeys.has("emotional")) {
    return nonTypical.length >= 3
      ? "Yürütücü-Duygusal Self-Regülasyon Problemi"
      : "Yürütücü-Duygusal Regülasyon Kırılganlığı";
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
    return "Bilişsel-Yürütücü Self-Regülasyon Problemi";
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
    patterns.push("Duyusal ve duygusal alanlarda birlikte görülen düşüklük, çevresel uyaran yoğunluğu arttığında duygusal regülasyonun zorlanabildiği bir klinik örüntü düşündürebilir.");
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
    visibleInfo.diagnosis ? `Başvuru / izlem gerekçesi: ${visibleInfo.diagnosis}` : "",
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
      : "Genel görünüm, birden fazla alana yayılan self-regülasyon zorlukları düşündürmektedir.";

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
  const scoreLines = domainResults.map((d) => `- ${d.label}: ${d.score}/${DOMAIN_MAX} (${d.level})`);
  const nonTypical = domainResults
    .filter((domain) => domain.level !== "Tipik")
    .sort((a, b) => a.score - b.score);
  const synthesis =
    nonTypical.length === 0
      ? "Skorların klinik anlamı: Sayısal dağılım belirgin bir risk kümesi göstermemekte ve genel profil korunmuş görünmektedir."
      : nonTypical.length === 1
      ? `Skorların klinik anlamı: Sayısal dağılımda en belirgin hassasiyet ${nonTypical[0].label} alanında görünmektedir.`
      : `Skorların klinik anlamı: Sayısal dağılım ${formatDomainLabels(
          nonTypical.slice(0, 3).map((domain) => domain.label)
        )} alanlarında daha yakından klinik yorum gerektirmektedir.`;
  return [...scoreLines, synthesis].join("\n");
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
  if (!externalTestAnalysis?.decisionCompatible.length) return ""

  const compatibleCategories = new Set(externalTestAnalysis.decisionCompatibleCategories || [])
  const primaryCategory = externalTestAnalysis.primaryCompatibleCategory || null
  const namesByCategory = (category: ExternalTestCategory) =>
    externalTestAnalysis.decisionCompatible
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
      return ` ${testText} bulguları, bu alandaki zorlanmanın yalnız inhibisyon ya da dikkatle değil, hareketi sıralama, motor planı uygulama ve davranışı organize etme talebiyle de ilişkili olabileceğini düşündürmektedir.`
    }
    if (domainKey === "cognitive" && testText) {
      return ` ${testText} bulguları, görevin zihinsel olarak planlanması ve adım adım sürdürülmesi sırasında hareket sıralama talebinin bilişsel organizasyonu zorlaştırabileceğini düşündürmektedir.`
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
      return ` ${testText} bulguları, beden sinyallerini fark etme ve öz bakım akışını düzenleme süreçlerindeki zorlanmanın günlük yaşamda nasıl karşılık bulduğunu görünür kılmaktadır.`
    }
  }

  if (primaryCategory === "language_communication") {
    const testText = formatNamedTests(languageNames)
    if (domainKey === "cognitive" && testText) {
      return ` ${testText} bulguları, sözel talep ve yönerge karmaşıklığı arttığında bilgiyi işleme, zihinsel olarak tutma ve görevde kalma zorluğunun arttığını düşündürmektedir.`
    }
    if (domainKey === "executive" && testText) {
      return ` ${testText} bulguları, çok basamaklı sözel taleplerde geçiş yapma, sıralama ve görevi tamamlama zorluğunun belirginleşebileceğini düşündürmektedir.`
    }
    if (domainKey === "emotional" && testText) {
      return ` ${testText} bulguları, iletişimsel talep ve anlaşılmama anlarında frustrasyon eşiğinin düşebileceğini düşündürmektedir.`
    }
  }

  if (primaryCategory === "social_pragmatic") {
    const testText = formatNamedTests(socialNames)
    if (domainKey === "emotional" && testText) {
      return ` ${testText} bulguları, karşılıklılık ve sosyal belirsizlik arttığında duygusal regülasyon zorluklarının neden daha görünür hale geldiğini açıklamaya yardımcı olmaktadır.`
    }
    if (domainKey === "executive" && testText) {
      return ` ${testText} bulguları, sosyal bağlam hızlı değiştiğinde esneklik, yanıtı ayarlama ve davranışı bağlama göre düzenleme süreçlerindeki zorlanmayı görünür kılmaktadır.`
    }
    if (domainKey === "cognitive" && testText) {
      return ` ${testText} bulguları, sosyal ipuçlarını izleme ve eşzamanlı görev taleplerini sürdürme zorluğunun bilişsel organizasyonu zorlayabildiğini düşündürmektedir.`
    }
  }

  return ""
}

function buildDomainSection(
  domainResults: DomainResult[],
  anamnezFlags: string[],
  profileType: string,
  externalTestAnalysis?: ExternalTestAnalysis,
  evidenceMap?: ClinicalEvidenceMap,
  itemLevelAnalysis?: ItemLevelAnalysis | null
): string {
  const allTypical = domainResults.every((d) => d.level === "Tipik");
  const mechanismOrder: DomainKey[] = getMechanismDomainOrder(evidenceMap?.clinicalMechanism);
  const orderedDomains = [...domainResults].sort((a, b) => {
    if (mechanismOrder.length) {
      const aIndex = mechanismOrder.indexOf(a.key as DomainKey);
      const bIndex = mechanismOrder.indexOf(b.key as DomainKey);
      if (aIndex !== bIndex) return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
    }
    if (a.level === "Tipik" && b.level !== "Tipik") return 1;
    if (a.level !== "Tipik" && b.level === "Tipik") return -1;
    return a.score - b.score;
  });
  const usedDomainAddons = new Set<string>();
  const uniqueDomainAddon = (text: string) => {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (!normalized) return "";
    if (usedDomainAddons.has(normalized)) return "";
    usedDomainAddons.add(normalized);
    return text;
  };
  const lines = orderedDomains.map((d, index) => {
    const knowledgeText = buildDomainKnowledgeText(
      d,
      {
        domainResults,
        evidenceMap,
        anamnezFlags,
        primaryExternalTestCategory: externalTestAnalysis?.primaryCompatibleCategory,
        profileType,
      },
      2
    );
    const anamnezHint = getAnamnezMatchHint(d.key as DomainKey, anamnezFlags, {
          level: d.level as DomainLevel,
          profileType,
    });
    const externalHint = allTypical ? "" : getExternalDomainCommentHint(d.key as DomainKey, externalTestAnalysis);
    const microEvidenceText = itemLevelAnalysis?.domainLines?.[d.key]?.[0]
      ? ` ${itemLevelAnalysis.domainLines[d.key][0]}`
      : "";
    const isMechanismSecondary =
      Boolean(evidenceMap && isMechanismDriven(evidenceMap) && evidenceMap.secondaryAxes.includes(d.label));
    const mechanismText =
      isMechanismSecondary && index === 0
        ? ` Bu bulgu, ana sorunun günlük işlevdeki görünümünü netleştirir.`
        : "";
    const clinicalWeight =
      d.level === "Tipik"
        ? `${d.label} mevcut profil içinde öncelikli bir klinik sorun alanı oluşturmamaktadır.`
      : isMechanismSecondary
        ? `${d.label} ${d.score}/${DOMAIN_MAX} ile ${d.level} banttadır. Bu alan, ana sorunun günlük yaşamdaki yansımalarından biri olarak değerlendirilir.`
        : evidenceMap && isMechanismDriven(evidenceMap)
        ? `${d.label} ${d.score}/${DOMAIN_MAX} ile ${d.level} banttadır; ancak raporun ana odağı değil, genel self-regülasyon zorluklarına eşlik eden klinik arka plan olarak okunur.`
        : `${d.label} ${d.score}/${DOMAIN_MAX} ile ${d.level} banttadır ve ${
            index === 0 ? "raporun birincil klinik eksenine" : "ana eksene eşlik eden self-regülasyon zorluğuna"
          } katkı verir.`;

    return [
      d.label,
      `${clinicalWeight} ${knowledgeText || d.comment}${microEvidenceText}${mechanismText}${uniqueDomainAddon(anamnezHint)}${uniqueDomainAddon(externalHint)}`.replace(/\s+/g, " ").trim(),
    ].join("\n");
  });
  const sortedNonTypical = domainResults
    .filter((domain) => domain.level !== "Tipik")
    .sort((a, b) => a.score - b.score);
  const synthesis = allTypical
    ? "Alanların tamamı tipik aralıkta kaldığı için klinik yorum korunmuş self-regülasyon zeminiyle sınırlıdır."
    : evidenceMap && isMechanismDriven(evidenceMap)
    ? `Ana klinik odak ${evidenceMap.primaryAxis}; günlük yaşama yansıyan alanlar ${formatDomainLabels(evidenceMap.secondaryAxes) || "yürütücü ve bilişsel organizasyon"} olarak izlenir.`
    : `Klinik yorumda birincil alan ${sortedNonTypical[0]?.label}; eşlik eden alanlar ${formatDomainLabels(
        sortedNonTypical.slice(1, 3).map((domain) => domain.label)
      ) || "belirgin biçimde ayrışmamaktadır"} olarak okunur.`;
  const mechanismIntro =
    evidenceMap && isMechanismDriven(evidenceMap) && evidenceMap.mechanismSummary
      ? [evidenceMap.mechanismLabel || "Klinik Mekanizma", evidenceMap.mechanismSummary].join("\n")
      : "";
  return [mechanismIntro, ...lines, synthesis].filter(Boolean).join("\n");
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

function buildInteroCentricComment(
  domainResults: DomainResult[],
  anamnezSignals?: AnamnezThemeSignals,
  externalTestAnalysis?: ExternalTestAnalysis
): string {
  const intero = domainResults.find(d => d.key === "interoception");
  const phys = domainResults.find(d => d.key === "physiological");
  const emo = domainResults.find(d => d.key === "emotional");
  const sortedWeak = [...domainResults]
    .filter((d) => d.level !== "Tipik")
    .sort((a, b) => a.score - b.score);
  const interoIsPrimary = sortedWeak[0]?.key === "interoception";

  if (!intero) return "";

  const interoLevel = intero.level;
  const hasBodyContext = Boolean(anamnezSignals?.bodyIntero);
  const primaryCategory = externalTestAnalysis?.primaryCompatibleCategory ?? null;
  const hasAdaptiveBodySupport =
    primaryCategory === "adaptive_daily_living" ||
    (externalTestAnalysis?.decisionCompatibleCategories || []).includes("adaptive_daily_living");

  if (!hasBodyContext && !hasAdaptiveBodySupport) {
    return "";
  }

  // 🔴 DURUM 1: intero atipik → merkez
  if (interoLevel === "Atipik" && ((phys && phys.level !== "Tipik") || hasBodyContext)) {
    return "İnterosepsiyon alanının atipik düzeyi, profilin bütüncül yorumunda merkezî bir eksen oluşturmaktadır. Bedensel sinyallerin izlenmesi ve düzenleyici yanıtların organize edilmesi süreçlerindeki bu zorlanma, diğer self-regülasyon alanlarıyla birlikte ele alındığında çok alanlı örüntüyü açıklayıcı bir çerçeve sunmaktadır.";
  }

  // 🔴 DURUM 2: intero riskli + fizyolojik/duygusal eşlik
  if (
    interoLevel === "Riskli" &&
    ((interoIsPrimary && hasBodyContext) || (phys && phys.level !== "Tipik") || ((emo && emo.level !== "Tipik") && hasBodyContext))
  ) {
    return "İnterosepsiyon alanı, fizyolojik ve/veya duygusal düzenleme süreçleriyle birlikte değerlendirildiğinde, profilin beden-temelli ikincil açıklamasına katkı sağlamaktadır.";
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

function buildPatternSection(
  profileType: string,
  patterns: string[],
  domainResults: DomainResult[],
  homogeneous: boolean,
  anamnezSignals?: AnamnezThemeSignals,
  externalTestAnalysis?: ExternalTestAnalysis,
  evidenceMap?: ClinicalEvidenceMap
): string {
  const lines: string[] = [`- Profil sınıflaması: ${profileType}.`];
  const weaknessNarrative = buildWeaknessNarrative(domainResults, homogeneous);
  const { strengths, weaknesses } = getMeaningfulStrengthWeakness(domainResults, homogeneous);
  const nonTypicalCount = domainResults.filter((d) => d.level !== "Tipik").length;
  const hasMotorPraxisMechanism =
    externalTestAnalysis?.decisionCompatibleCategories?.includes("motor_praxis") &&
    (anamnezSignals?.motorPraxis || /praksi|motor planlama|motor/.test(profileType.toLowerCase()));

  if (hasMotorPraxisMechanism) {
    const preserved = strengths.length
      ? ` ${strengths.map((x) => x.label).join(", ")} alanlarında göreli korunmuşluk izlenmektedir.`
      : "";
    lines.push(
      `- Klinik örüntü, en düşük skorun tek başına merkez alınmasından çok motor planlama ve beden organizasyonu gerektiren durumlarda belirginleşen zorlanmanın yürütücü organizasyon, görev sürdürme ve duygusal toparlanmaya yansımasıyla açıklanır.${preserved}`
    );
  } else if (evidenceMap && isMechanismDriven(evidenceMap)) {
    const preserved = strengths.length
      ? ` ${strengths.map((x) => x.label).join(", ")} alanlarında göreli korunmuşluk izlenmektedir.`
      : "";
    lines.push(
      `- Klinik örüntü, en düşük skorun tek başına merkez alınmasından çok ${getMechanismDescriptor(
        evidenceMap
      )} üzerinden açıklanır.${preserved}`
    );
  } else if (weaknessNarrative) {
    lines.push(weaknessNarrative);
  }

  if (nonTypicalCount === 0) {
    lines.push("- Alt alanların tümü tipik aralıkta seyrettiği için klinik olarak anlamlı bir risk kümesi ya da yaygın self-regülasyon problemi izlenmemektedir.");
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

  const interoComment = buildInteroCentricComment(domainResults, anamnezSignals, externalTestAnalysis);
  if (interoComment) {
    lines.push(`- ${interoComment}`);
  }

  return lines.join("\n");
}

function buildExternalTestEvidenceProfile(externalTestAnalysis?: ExternalTestAnalysis): string {
  if (!externalTestAnalysis || externalTestAnalysis.matches.length === 0) return "";

  const visibleMatches = externalTestAnalysis.matches.slice(0, 3);
  const hiddenCount = Math.max(0, externalTestAnalysis.matches.length - visibleMatches.length);
  const profileLines = externalTestAnalysis.evidenceProfileLines
    .slice(0, visibleMatches.length)
    .map((line) => naturalizeExternalProfileLine(line));
  const profileText = profileLines.join(" ");
  const qualityLines = externalTestAnalysis.qualityFlagLines
    .filter((line) => {
      const normalizedLine = line.replace(/^[^:]+:\s*/, "").trim();
      return normalizedLine.length > 0 && !profileText.includes(normalizedLine);
    })
    .slice(0, 2);
  const sourceNote =
    externalTestAnalysis.matches.length > 0
      ? "Test yorumu yalnız yaş uyumu, ölçülen alan ve girilen sonuç özetiyle sınırlı tutulmuştur."
      : "";

  return [
    "Ek test bulguları:",
    ...profileLines.map((line) => `- ${line}`),
    hiddenCount > 0 ? `- Ek destekleyici testler: ${hiddenCount} test daha aynı kanıt yönünde sınırlı destekleyici bağlam olarak tutulmuştur.` : "",
    ...qualityLines.map((line) => `- ${line}`),
    sourceNote ? `- ${sourceNote}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function naturalizeExternalProfileLine(line: string): string {
  const compact = line
    .replace(/;\s*resmi kullanım aralığı\s*/i, "; yaş/kapsam: ")
    .replace(/\s*Ölçtüğü alanlar:\s*/i, " Alan: ")
    .replace(/\s*Puan sistemi:\s*/i, " Puan: ")
    .replace(/\s*Bildirilen sonuç:\s*/i, " Sonuç: ")
    .replace(/\s*Rapor ilişkisi:\s*/i, " İlişki: ")
    .replace(/\s*Yorum sınırı:\s*/i, " Sınır: ");

  if (/Children'?s Communication Checklist|CCC-?2/i.test(compact)) {
    return compact.replace(
      /İlişki:\s*Sosyal-pragmatik talep ile dilsel yükün birlikte ele alınmasını destekler\./i,
      "İlişki: Pragmatik dil ve bağlamsal iletişim yükünü destekler."
    );
  }

  if (/Social Responsiveness Scale|SRS-?2/i.test(compact)) {
    return compact.replace(
      /İlişki:\s*Sosyal-pragmatik talep ile dilsel yükün birlikte ele alınmasını destekler\./i,
      "İlişki: Sosyal yanıtlılık ve karşılıklılık bağlamını destekler."
    );
  }

  return compact
    .replace(/\s*Yorumda\s*Klinik yorum yalnız bu bilgiden çıkarılmaz\.?/gi, " Sınır: Klinik yorum yalnız bu testten çıkarılmaz.")
    .replace(/\s*Yorumda\s*DNA skorunu değiştirmez; klinik bağlamı destekler\.?/gi, " Sınır: DNA skorunu değiştirmez; klinik bağlamı destekler.")
    .replace(/\s*Sınır:\s*Tek başına sonuç üretmez; yaş uyumu zorunlu kontrol edilir\.?/gi, " Sınır: Klinik yorum yalnız bu testten çıkarılmaz.")
    .replace(/\s*Sınır:\s*Tek başına sonuç üretmez\.?/gi, " Sınır: Klinik yorum yalnız bu testten çıkarılmaz.")
    .replace(/\s*Sınır:\s*Motor test sonucu DNA skorunu değiştirmez; tek başına sonuç üretmez\.?/gi, " Sınır: DNA skorunu değiştirmez; klinik bağlamı destekler.")
    .replace(/\s*Sınır:\s*Motor test sonucu DNA skorunu değiştirmez; tek başına praksi tanısı veya tedavi reçetesi üretmez\.?/gi, " Sınır: DNA skorunu değiştirmez; klinik bağlamı destekler.")
    .replace(/\s*Sınır:\s*DNA alan skorlarını değiştirmez; gelişimsel tanı veya prognoz üretmez\.?/gi, " Sınır: DNA alan skorlarını değiştirmez; klinik bağlamla birlikte okunur.")
    .replace(/\s*Sınır:\s*Tek başına tanı veya müdahale kararı üretmez\.?/gi, " Sınır: Klinik yorum yalnız bu testten çıkarılmaz.")
    .replace(/;\s*yaş uyumu zorunlu kontrol edilir\.?/gi, ".")
    .replace(/Motor test sonucu DNA skorunu değiştirmez; tek başına sonuç üretmez\.?/gi, "DNA skorunu değiştirmez; klinik bağlamı destekler.")
    .replace(/\s*(?:Sınır:|Yorumda)\s*[^.]+manual[^.]+\./gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function formatExternalSupportSentence(text: string, limited: boolean): string {
  const clean = String(text || "").trim().replace(/\.$/, "");
  if (!clean) return "";
  return limited
    ? ` ${clean}. Bu bulgu ana kararı güçlendirmez; yalnız yorum sınırını ve kaynaklar arası ayrışmayı görünür kılar.`
    : ` ${clean}; bu bulgu formülasyonu destekleyen ek klinik kanıtlar arasında yer alır.`;
}

function isLimitedExternalEvidenceLine(line: string): boolean {
  return /yaş uyumsuz|yaş aralığıyla uyumsuz|ham puan|resmi yorum|yorum yok|eksik yorum|temkinli yan bilgi|ana klinik yorum skor örüntüsü|korunmuş\/yaş uyumlu sonuç|korunmuş|beklenen aralık|ortalama|tüm[^\n.]+yaş/i.test(
    String(line || "")
  );
}

function getAnamnezFieldText(record: AnamnezRecord | undefined, keys: string[]): string {
  if (!record) return "";

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return cleanEvidenceLine(value, 260);
    }
    if (Array.isArray(value)) {
      const joined = value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean).join(" ");
      if (joined) return cleanEvidenceLine(joined, 260);
    }
  }

  return "";
}

function naturalizeCaseEvidenceText(text: string): string {
  return String(text || "")
    .replace(/daha az çekinme,\s*yeni hareketlere girişte daha az model ihtiyacı\s+ve\s+beden organizasyonunun duygusal zorlanmayı ikincil olarak tetiklemeyeceği\s+bir profile yaklaşmak hedeflenmektedir\.?/gi,
      "yeni hareketlere daha rahat başlayabilmesi, daha az model desteğiyle ilerleyebilmesi ve beden organizasyonu zorlandığında duygusal toparlanmasının daha az etkilenmesi beklenmektedir")
    .replace(/yeni hareketlere daha rahat girişebilme ve daha az model desteğiyle ilerleyebilme ve beden organizasyonunun duygusal zorlanmayı ikincil olarak tetiklemeyeceği bu yönde desteklenmesi beklenmektedir\.?/gi,
      "yeni hareketlere daha rahat başlayabilmesi, daha az model desteğiyle ilerleyebilmesi ve beden organizasyonu zorlandığında duygusal toparlanmasının daha az etkilenmesi beklenmektedir")
    .replace(/motor planlama gerektiren oyunda yeni hareketlere daha rahat girişebilme ve daha az model desteğiyle ilerleyebilme ve beden organizasyonunun duygusal zorlanmayı ikincil olarak tetiklemeyeceği bu yönde desteklenmesi beklenmektedir\.?/gi,
      "motor planlama gerektiren oyunlarda yeni hareketlere daha rahat başlayabilmesi, daha az model desteğiyle ilerleyebilmesi ve beden organizasyonu zorlandığında duygusal toparlanmasının daha az etkilenmesi beklenmektedir")
    .replace(/model ile gösterdiğin etkinliği tekrar etmeye açık/gi, "modelle gösterilen etkinliği tekrar etmeye açık")
    .replace(/başardığı rutin oyunda devam ediyor/gi, "başardığı rutin oyunda devam edebiliyor")
    .replace(/görevde kalış, dikkat ve davranışsal düzenleme de bozuluyor/gi, "görevde kalma, dikkat ve davranışsal düzenleme de zayıflayabiliyor")
    .replace(/duygusal eşik hızla düşebiliyor/gi, "duygusal toparlanma kapasitesi hızla azalabiliyor")
    .replace(/\s+/g, " ")
    .trim();
}

function capitalizeClinicalSentence(text: string): string {
  const clean = String(text || "").trim();
  if (!clean) return "";
  return clean.charAt(0).toLocaleUpperCase("tr-TR") + clean.slice(1);
}

function isLowInformationClinicalText(text: string): boolean {
  const clean = normalizeTurkishClinicalText(String(text || ""))
    .toLocaleLowerCase("tr-TR")
    .replace(/[.!?]/g, "")
    .trim();
  if (!clean) return true;
  return /^(net bilgi verilmedi|bilgi verilmedi|bilgi yok|yok|belirtilmedi|aktarılmadı|aktarilmadi|boş|bos)$/.test(clean);
}

function isLimitedClinicalNarrativeLine(text: string): boolean {
  const clean = normalizeTurkishClinicalText(String(text || "")).toLocaleLowerCase("tr-TR");
  if (!clean.trim()) return true;
  return /net bir sorun tarif edemiyor|genel durumun anlaşılması|genel kontrol|belirgin bir şikayet|sınırlı veri|kısa görüşme|net bilgi verilmedi|bilgi yok|belirtilmedi|aktarılmadı/.test(clean);
}

function isIncoherentClinicalNarrativeLine(text: string): boolean {
  const clean = normalizeTurkishClinicalText(String(text || "")).toLocaleLowerCase("tr-TR");
  return /bulut|felsefi|ayakkabının felsefi|masa altına|masa altina|sessiz oyuncak|alkışladı|alkisladi|kalemleri saydı|kalemleri saydi/.test(clean);
}

function ensureSentenceEnd(text: string): string {
  const clean = String(text || "").trim();
  if (!clean) return "";
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

function buildCaseSpecificAnamnezLines(record?: AnamnezRecord): string[] {
  const caregiver = getAnamnezFieldText(record, [
    "parent_concerns_goals",
    "caregiver_concerns",
    "parent_concerns",
    "referral_reason",
    "raw_summary",
  ]);
  const therapist = getAnamnezFieldText(record, [
    "therapist_comments",
    "therapist_observation",
    "clinical_observation",
    "observation",
  ]);
  const strengths = getAnamnezFieldText(record, [
    "strengths",
    "preserved_areas",
    "protective_factors",
  ]);

  const cleanCaregiver = naturalizeCaseEvidenceText(caregiver.replace(/^Aile(?:\s+tarafından)?\s*/i, "").trim());
  const cleanTherapist = naturalizeCaseEvidenceText(
    therapist
      .replace(/^Terapist(?:\s+gözleminde|,\s*)?\s*/i, "")
      .replace(/^Gözlemde\s+/i, "")
      .replace(/^Gozlemde\s+/i, "")
      .trim()
  );
  const cleanStrengths = naturalizeCaseEvidenceText(strengths);

  return [
    cleanCaregiver && !isLowInformationClinicalText(cleanCaregiver)
      ? ensureSentenceEnd(`Aileden gelen bilgiye göre ${cleanCaregiver.charAt(0).toLocaleLowerCase("tr-TR")}${cleanCaregiver.slice(1)}`)
      : "",
    cleanTherapist && !isLowInformationClinicalText(cleanTherapist)
      ? ensureSentenceEnd(`Terapist gözleminde ${cleanTherapist}`)
      : "",
    cleanStrengths && !isLowInformationClinicalText(cleanStrengths)
      ? ensureSentenceEnd(`Korunmuş işlev alanlarına ilişkin bilgi: ${cleanStrengths}`)
      : "",
  ].filter(Boolean);
}

function buildAnamnezFitSection(
  anamnezSummary: unknown,
  anamnezFlags: string[],
  domainResults: DomainResult[],
  profileType: string,
  externalTestDecisionNotes: string[] = [],
  externalTestAnalysis?: ExternalTestAnalysis,
  evidenceMap?: ClinicalEvidenceMap,
  anamnezRecord?: AnamnezRecord
): string {
  const knowledgeFitText = buildUseKnowledgeText(
    {
      domainResults,
      evidenceMap,
      anamnezFlags,
      primaryExternalTestCategory: externalTestAnalysis?.primaryCompatibleCategory,
      profileType,
    },
    "anamnesis_fit",
    2
  );
  const externalEvidenceProfileText = buildExternalTestEvidenceProfile(externalTestAnalysis);
  const caseSpecificLines = buildCaseSpecificAnamnezLines(anamnezRecord);
  const limitedCaseNarrative =
    caseSpecificLines.length === 0 ||
    caseSpecificLines.every((line) => isLimitedClinicalNarrativeLine(line));
  const incoherentCaseNarrative = caseSpecificLines.some((line) => isIncoherentClinicalNarrativeLine(line));
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
  const compatibleTests = externalTestAnalysis?.decisionCompatible || [];
  const compatibleCategories = new Set(externalTestAnalysis?.decisionCompatibleCategories || []);
  const compatibleTestNames = compatibleTests.map((test) => test.name);
  const externalTestNamesText =
    compatibleTestNames.length >= 3
      ? `${compatibleTestNames.slice(0, 2).join(", ")} ve ${compatibleTestNames[2]}`
      : compatibleTestNames.length === 2
      ? compatibleTestNames.join(" ve ")
      : compatibleTestNames[0] || "";
  const externalCautionNotes = externalTestDecisionNotes.filter((note) => /yaş aralığı|ana klinik karar|temkin/i.test(note));
  const hasConstrainedExternalEvidence = Boolean(
    externalTestAnalysis?.mixedValidity ||
      externalTestAnalysis?.matches?.some(
        (match) =>
          match.resultQuality === "ham_puan_only" ||
          match.resultQuality === "missing_result" ||
          match.resultQuality === "qualitative_only" ||
          match.ageCompatible === false ||
          match.resultDirection === "expected_or_preserved"
      )
  );
  const externalFitSynthesis: string[] = [];

  if (compatibleCategories.has("motor_praxis")) {
    externalFitSynthesis.push(
      `${externalTestNamesText || "Motor planlama testleri"} bulguları, zorlanmanın yalnız dikkat ya da genel davranış kontrolünde değil; görevi başlatma, hareket dizisini kurma, beden organizasyonunu sürdürme ve çok basamaklı eylemi tamamlama ekseninde taşındığını göstermektedir.`
    );

    if (compatibleCategories.has("adaptive_daily_living")) {
      externalFitSynthesis.push(
        "Motor planlama ve günlük yaşam verileri birlikte ele alındığında, bu zorlanmanın işlevsel karşılığı özellikle öz bakım, araç gereç kullanımı, sıraya dayalı görevler ve günlük rutini sürdürebilme alanlarında görünürleşmektedir."
      );
    } else {
      externalFitSynthesis.push(
        "Bu nedenle anamnezde tarif edilen dağılma ve görevden kopma, salt dikkat azalmasından çok motor planlama talebi arttığında davranış organizasyonunun çözülmesi şeklinde okunur."
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
  const mixedEvidenceNote =
    evidenceMap?.clinicalMechanism === "evidence_limited_mixed"
      ? "Kanıt kanalları tam yakınsama göstermediği için bu bölüm, güçlü bir tek mekanizma iddiasından çok bakımveren anlatısı, terapist gözlemi ve dış test sınırları arasındaki sınırlı uyum/ayrışmayı görünür tutar."
      : "";

  if (weakLabels.length === 0) {
    const sentences: string[] = [...caseSpecificLines]

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

    if (mixedEvidenceNote) {
      sentences.push(mixedEvidenceNote)
    }

    if (externalEvidenceProfileText) {
      sentences.push(externalEvidenceProfileText)
    }

    if (knowledgeFitText) {
      sentences.push(knowledgeFitText)
    }

    return sentences.join("\n")
  }

  if (incoherentCaseNarrative) {
    const sentences: string[] = [
      ...caseSpecificLines,
      "Anamnez anlatısında klinik yorum için doğrudan kullanılamayacak tutarsız veya bağlam dışı ifadeler bulunduğu için günlük yaşam genellemesi yapılmamıştır.",
      compatibleTests.length > 0
        ? "Bu nedenle yorum, anamnezden güçlü bir yakınsama çıkarmadan skor örüntüsü, gözlem ve yaşa uygun ek test bulgularıyla sınırlı tutulmuştur."
        : "Bu nedenle yorum, anamnezden güçlü bir yakınsama çıkarmadan skor örüntüsü ve gözlemle sınırlı ön hipotez olarak ele alınmıştır.",
    ];

    if (externalFitNotesToAppend.length > 0) {
      sentences.push(...externalFitNotesToAppend);
    }

    if (mixedEvidenceNote) {
      sentences.push(mixedEvidenceNote);
    }

    if (externalEvidenceProfileText) {
      sentences.push(externalEvidenceProfileText);
    }

    sentences.push("Aynı skor örüntüsü farklı çocuklarda farklı anlam taşıyabilir; uyku, rutin, aile desteği, çevresel stres, tıbbi geçmiş ve ortamlar arası farklılık klinik yorumu değiştirebilir.");

    return sentences.join("\n");
  }

  if (limitedCaseNarrative && compatibleTests.length > 0) {
    const sentences: string[] = [
      ...caseSpecificLines,
      "Anamnez bilgisi sınırlıdır; bu nedenle günlük yaşam bağlamına ilişkin güçlü bir yakınsama iddiası kurulmamıştır.",
      "Skor örüntüsü ve yaşa uygun ek test bulguları aynı klinik hattı desteklemektedir; ancak bu yorum güçlü anamnez yakınsaması değil, skor ve ek testle sınırlı klinik hipotez olarak ele alınır.",
    ];

    if (externalFitNotesToAppend.length > 0) {
      sentences.push(...externalFitNotesToAppend);
    }

    if (mixedEvidenceNote) {
      sentences.push(mixedEvidenceNote);
    }

    if (externalEvidenceProfileText) {
      sentences.push(externalEvidenceProfileText);
    }

    sentences.push("Aynı skor örüntüsü farklı çocuklarda farklı anlam taşıyabilir; uyku, rutin, aile desteği, çevresel stres, tıbbi geçmiş ve ortamlar arası farklılık klinik yorumu değiştirebilir.");

    return sentences.join("\n");
  }

  if (flagCount >= 1 && themePreview) {
    const themeSentence = /^(Korunmuş|Başvuru nedeni|Başvuru ve|Aile endişeleri)/i.test(themePreview)
      ? themePreview
      : `Anamnezde ${themePreview}`;
    const sentences: string[] = [...caseSpecificLines, themeSentence];

    if (alignedDomains.length > 0 && flagCount >= 2) {
      sentences.push(`Ölçekte öne çıkan ${alignedDomains.join(", ")} alanları bu anlatımla doğrudan uyum göstermektedir.`);
    }

    if (partialDomains.length > 0) {
      sentences.push(`${partialDomains.join(", ")} alanlarında ise daha sınırlı ama klinik olarak anlamlı bir eşleşme izlenmektedir.`);
    }

    if (mismatchDomains.length > 0) {
      sentences.push(`${mismatchDomains.join(", ")} alanlarına ilişkin anamnez vurgusu bulunmasına karşın ölçek bulguları bu alanlarda göreli korunmuş görünmektedir; bu durum bağlama özgü bir ayrışma düşündürebilir.`);
    }

    if (
      alignedDomains.length >= 2 &&
      mismatchDomains.length === 0 &&
      flagCount >= 3 &&
      !limitedCaseNarrative &&
      !hasConstrainedExternalEvidence
    ) {
      sentences.push(`Bu nedenle anamnez ve ölçek bulguları aynı klinik hatta yaklaşmaktadır; yorum yine gözlem ve ek test bilgisiyle birlikte sınırlandırılmıştır.`);
    } else if (hasConstrainedExternalEvidence && compatibleTests.length > 0) {
      sentences.push("Skor örüntüsü ve bazı vaka içi temalar aynı klinik hatta işaret etse de, korunmuş veya sınırlı dış test bulguları nedeniyle yorum doğrudan yüksek anamnez-ölçek uyumu olarak yazılmamıştır.");
    } else if (limitedCaseNarrative && compatibleTests.length > 0) {
      sentences.push("Skor örüntüsü ve yaşa uygun ek test bulguları aynı klinik hattı desteklemektedir; ancak anamnez bilgisi sınırlı olduğu için bu yorum güçlü anamnez yakınsaması değil, skor ve ek testle sınırlı klinik hipotez olarak ele alınır.");
    } else if (limitedCaseNarrative) {
      sentences.push("Anamnez bilgisi sınırlı olduğu için klinik yorum güçlü anamnez yakınsaması olarak değil, skor örüntüsü ve gözlemle sınırlı ön hipotez olarak ele alınır.");
    } else if (alignedDomains.length >= 1 || mismatchDomains.length >= 1 || partialDomains.length >= 1) {
      sentences.push(`Bu nedenle anamnez-ölçek ilişkisi tam örtüşmeden çok, doğrudan uyum ve kısmi ayrışmanın birlikte izlendiği bir örüntü göstermektedir.`);
    } else {
      sentences.push(`Bu nedenle klinik yorum daha çok skor örüntüsüne dayandırılmıştır.`);
    }

    if (externalFitNotesToAppend.length > 0) {
      sentences.push(...externalFitNotesToAppend);
    }

    if (mixedEvidenceNote) {
      sentences.push(mixedEvidenceNote);
    }

    if (externalEvidenceProfileText) {
      sentences.push(externalEvidenceProfileText);
    }

    if (knowledgeFitText) {
      sentences.push(knowledgeFitText);
    }

    return sentences.join("\n");
  }

  const noteText = externalFitNotesToAppend.length > 0 ? ` ${externalFitNotesToAppend.join(" ")}` : ""
  const externalProfileTail = externalEvidenceProfileText ? `\n${externalEvidenceProfileText}` : ""
  const knowledgeTail = knowledgeFitText ? `\n${knowledgeFitText}` : ""
  const caseSpecificPrefix = caseSpecificLines.length ? `${caseSpecificLines.join("\n")}\n` : "";
  const mixedTail = mixedEvidenceNote ? ` ${mixedEvidenceNote}` : "";
  return `${caseSpecificPrefix}Anamnezde "${profileType}" örüntüsünü doğrudan güçlendiren belirgin tema sınırlıdır. Ölçekte görece daha çok zorlanan alanlar ${riskText} ekseninde toplanmaktadır. Bu nedenle klinik yorum daha çok skor örüntüsü, gözlem ve dış test sınırlarıyla birlikte temkinli kurulmuştur.${noteText}${mixedTail}${externalProfileTail}${knowledgeTail}`;
}

function buildConclusion(
  globalLevel: DomainLevel,
  profileType: string,
  _normSource: string,
  domainResults?: DomainResult[],
  evidenceMap?: ClinicalEvidenceMap
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
      ? "genel profil büyük ölçüde korunmuş bir self-regülasyon zemini göstermektedir"
      : globalLevel === "Riskli"
      ? "genel profil, tek başına tanısal anlam taşımayan ancak günlük işlevde belirginleşebilen self-regülasyon zorlukları göstermektedir"
      : "genel profil birden fazla alana yayılan belirgin self-regülasyon zorlukları göstermektedir";

  const patternText =
    evidenceMap?.compiledNarrative?.conclusionSentence
      ? evidenceMap.compiledNarrative.conclusionSentence
      :
    evidenceMap?.clinicalMechanism === "evidence_limited_mixed"
      ? "Sonuç olarak dış test kanıtı sınırlıdır; yürütücü-bilişsel-duygusal değişkenlik bağlamsal kanıtlarla birlikte temkinli biçimde yorumlanır."
      : evidenceMap?.clinicalMechanism === "motor_praxis"
      ? "Sonuç olarak motor planlama ve beden organizasyonu zorluğu, yürütücü organizasyon, görev sürdürme ve duygusal toparlanma süreçlerine yansımaktadır."
      : evidenceMap && isMechanismDriven(evidenceMap)
      ? `Sonuç olarak klinik odak ${getMechanismDescriptor(evidenceMap)} üzerinden açıklanır.`
      :
    d && d.riskyCount === 0 && d.atypicalCount === 0
      ? "Sonuç olarak profil, risk diliyle genişletilmemesi gereken korunmuş bir işleyiş göstermektedir."
      : focusLabels
      ? `Sonuç olarak ${focusLabels} alanlarındaki zorlanma, bağlama göre işlevsel performansa yansıyan bir self-regülasyon örüntüsü oluşturmaktadır.`
      : "Sonuç olarak skor örüntüsü, bağlamsal veriyle birlikte anlam kazanan bir self-regülasyon görünümü oluşturmaktadır.";

  const boundaryText =
    globalLevel === "Tipik"
      ? "Bu rapor tanısal hüküm içermez; mevcut veriler bağlama duyarlı hassasiyetlerin aşırı yorumlanmadan ele alınması gerektiğini gösterir."
      : evidenceMap?.clinicalMechanism === "evidence_limited_mixed"
      ? "Bu rapor tanısal hüküm içermez; dış test kanıtı sınırlı veya çelişkili olduğunda ek test sonucu büyütülmeden skor örüntüsü, bakımveren anlatısı ve terapist gözlemi birlikte tartılır."
      : evidenceMap?.clinicalMechanism === "motor_praxis"
      ? "Bu rapor tanısal hüküm içermez; mevcut veriler motor planlama, beden organizasyonu, görev sürdürme ve toparlanma süreçlerinin birlikte okunması gerektiğini gösterir."
      : evidenceMap?.clinicalMechanism === "adaptive_daily_living"
      ? "Bu rapor tanısal hüküm içermez; mevcut veriler öz bakım akışı, rutin başlatma, beden farkındalığı ve toparlanma süreçlerinin birlikte okunması gerektiğini gösterir."
      : evidenceMap?.clinicalMechanism === "social_pragmatic"
      ? "Bu rapor tanısal hüküm içermez; mevcut veriler sosyal karşılıklılık talebi altında bilişsel düzenleme, duygusal toparlanma ve davranış ayarlamanın birlikte okunması gerektiğini gösterir."
      : evidenceMap?.clinicalMechanism === "language_communication" || evidenceMap?.clinicalMechanism === "language_social_pragmatic"
      ? "Bu rapor tanısal hüküm içermez; mevcut veriler sözel talep, görevde kalma ve duygusal toparlanma süreçlerinin birlikte okunması gerektiğini gösterir."
      : evidenceMap?.clinicalMechanism === "physiological_interoceptive"
      ? "Bu rapor tanısal hüküm içermez; mevcut veriler beden-temelli toparlanma, interoseptif farkındalık ve günlük işlev akışının birlikte okunması gerektiğini gösterir."
      : "Bu rapor tanısal hüküm içermez; mevcut veriler öncelikli karar ekseni, görev sürdürme ve toparlanma süreçlerinin birlikte okunması gerektiğini gösterir.";

  return [
    `Profil "${profileType}" ile uyumludur; ${levelText}.`,
    patternText,
    boundaryText,
  ]
    .filter(Boolean)
    .join(" ");
}

function uniqueStrings(items: Array<string | null | undefined>): string[] {
  return Array.from(new Set(items.map((item) => String(item || "").trim()).filter(Boolean)));
}

function filterScoreCentricEvidenceLines(lines: string[]): string[] {
  return lines.filter((line) => !/en düşük alan görünümünü|birincil örüntüye eşlik eden ikinci zorlanma alanıdır/i.test(line));
}

function cleanEvidenceLine(value: string, maxLength = 230): string {
  const clean = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^(Terapist gözlemi:\s*){2,}/i, "Terapist gözlemi: ")
    .replace(/^(Ek klinik bulgu:\s*){2,}/i, "Ek klinik bulgu: ")
    .replace(/^(Dış test\/bulgu:\s*){2,}/i, "Dış test/bulgu: ")
    .replace(/\s*…$/g, "")
    .trim();

  if (clean.length <= maxLength) return clean;

  const firstSentence = clean.split(/(?<=[.!?])\s+/)[0]?.trim();
  if (firstSentence && firstSentence.length >= 40 && firstSentence.length <= maxLength) {
    return firstSentence;
  }

  let shortened = clean.slice(0, maxLength).replace(/\s+\S*$/g, "").replace(/[.,;:]+$/g, "").trim();
  shortened = shortened.replace(/\b(?:ilişkin|göre|ile|ve|veya|için|olarak|özellikle)$/i, "").trim();
  return shortened ? `${shortened}.` : clean.slice(0, maxLength).trim();
}

function formatDomainLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] || "";
  if (labels.length === 2) return `${labels[0]} ve ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} ve ${labels[labels.length - 1]}`;
}

function isMechanismDriven(evidenceMap: ClinicalEvidenceMap): boolean {
  return evidenceMap.primaryAxisKind === "mechanism" && evidenceMap.clinicalMechanism !== "default";
}

function getMechanismDomainOrder(mechanism: ClinicalMechanismType | undefined): DomainKey[] {
  if (mechanism === "evidence_limited_mixed") return ["executive", "cognitive", "emotional", "interoception", "physiological", "sensory"];
  if (mechanism === "motor_praxis") return ["executive", "cognitive", "emotional", "sensory", "interoception", "physiological"];
  if (mechanism === "adaptive_daily_living") return ["executive", "interoception", "emotional", "cognitive", "physiological", "sensory"];
  if (mechanism === "social_pragmatic") return ["emotional", "cognitive", "executive", "sensory", "interoception", "physiological"];
  if (mechanism === "language_communication") return ["cognitive", "executive", "emotional", "sensory", "interoception", "physiological"];
  if (mechanism === "language_social_pragmatic") return ["cognitive", "emotional", "executive", "sensory", "interoception", "physiological"];
  if (mechanism === "physiological_interoceptive") return ["interoception", "physiological", "emotional", "executive", "cognitive", "sensory"];
  if (mechanism === "selective_interoception") return ["interoception", "physiological", "emotional", "executive", "cognitive", "sensory"];
  return [];
}

function getPreferredSecondaryAxes(
  mechanism: ClinicalMechanismType | undefined,
  sortedNonTypical: DomainResult[]
): string[] {
  const preferredLabels =
    mechanism === "evidence_limited_mixed"
      ? ["Yürütücü İşlev", "Bilişsel Regülasyon", "Duygusal Regülasyon", "İnterosepsiyon"]
      : mechanism === "motor_praxis"
      ? ["Yürütücü İşlev", "Bilişsel Regülasyon", "Duygusal Regülasyon"]
      : mechanism === "adaptive_daily_living"
      ? ["Yürütücü İşlev", "İnterosepsiyon", "Duygusal Regülasyon", "Bilişsel Regülasyon"]
      : mechanism === "social_pragmatic"
      ? ["Duygusal Regülasyon", "Bilişsel Regülasyon", "Yürütücü İşlev"]
      : mechanism === "language_communication"
      ? ["Bilişsel Regülasyon", "Yürütücü İşlev", "Duygusal Regülasyon"]
      : mechanism === "language_social_pragmatic"
      ? ["Bilişsel Regülasyon", "Duygusal Regülasyon", "Yürütücü İşlev"]
      : mechanism === "physiological_interoceptive"
      ? ["İnterosepsiyon", "Fizyolojik Regülasyon", "Duygusal Regülasyon", "Yürütücü İşlev"]
      : mechanism === "selective_interoception"
      ? ["İnterosepsiyon", "Fizyolojik Regülasyon", "Duygusal Regülasyon"]
      : [];

  const available = new Set(sortedNonTypical.map((domain) => domain.label));
  return preferredLabels.filter((label) => available.has(label)).slice(0, 3);
}

function getMechanismDescriptor(evidenceMap: Pick<ClinicalEvidenceMap, "clinicalMechanism" | "primaryAxis">): string {
  switch (evidenceMap.clinicalMechanism) {
    case "evidence_limited_mixed":
      return "kanıt sınırlılığı ve çelişkili dış test bilgisi altında yürütücü organizasyon, bilişsel düzenleme ve duygusal toparlanmanın bağlama göre dalgalanması";
    case "motor_praxis":
      return "motor planlama ve beden organizasyonu gerektiren durumlarda belirginleşen zorlanmanın görev organizasyonuna, dikkat sürdürmeye ve duygusal toparlanmaya yansıması";
    case "adaptive_daily_living":
      return "öz bakım ve günlük yaşam akışını başlatma ve sürdürme zorluğunun yürütücü organizasyon, beden farkındalığı ve duygusal toparlanmaya yansıması";
    case "social_pragmatic":
      return "sosyal karşılıklılık ve pragmatik esneklik talebi arttığında bilişsel düzenleme, duygusal toparlanma ve davranış ayarlamanın birlikte zorlanması";
    case "language_communication":
      return "sözel talep ve yönerge karmaşıklığı arttığında bilgiyi işleme, görevde kalma ve frustrasyon toleransının ikincil olarak zorlanması";
    case "language_social_pragmatic":
      return "dilsel talep ile sosyal-pragmatik talep birlikte arttığında anlama, karşılıklılığı sürdürme, bilişsel organizasyon ve duygusal toparlanmanın aynı hat üzerinde zorlanması";
    case "physiological_interoceptive":
      return "beden-temelli toparlanma ve içsel sinyalleri düzenlemeye katma zorluğunun dikkat, günlük işlev ve duygusal toparlanmaya yansıması";
    case "selective_interoception":
      return "içsel bedensel sinyalleri fark etme ve düzenleme sürecine zamanında katma zorluğunun seçici biçimde belirginleşmesi";
    default:
      return evidenceMap.primaryAxis;
  }
}

function getMechanismFormulationSentence(evidenceMap: ClinicalEvidenceMap): string {
  if (evidenceMap.compiledNarrative?.formulationSentence) {
    return evidenceMap.compiledNarrative.formulationSentence;
  }
  switch (evidenceMap.clinicalMechanism) {
    case "evidence_limited_mixed":
      return "Dış testte kanıt sınırlılığı, ham puan, korunmuş sonuç veya yaş uyumsuzluk bulunduğunda yürütücü organizasyon, bilişsel düzenleme ve duygusal toparlanma yorumu skor örüntüsü, bakımveren anlatısı ve terapist gözlemiyle sınırlı tutulur.";
    case "motor_praxis":
      return "Yeni veya çok basamaklı motor görevlerde beden organizasyonunu kurma ve sürdürme talebi arttığında yürütücü organizasyon, görevde kalma ve duygusal toparlanma ikincil olarak zorlanmaktadır.";
    case "adaptive_daily_living":
      return "Öz bakım ve günlük yaşam akışını başlatma, sıraya koyma ve sürdürme talebi arttığında yürütücü organizasyon, beden farkındalığı ve duygusal toparlanma ikincil olarak zorlanmaktadır.";
    case "social_pragmatic":
      return "Sosyal karşılıklılık, bağlama uyum ve pragmatik esneklik talebi arttığında bilişsel düzenleme, duygusal toparlanma ve davranışı bağlama göre ayarlama birlikte zorlanmaktadır.";
    case "language_communication":
      return "Sözel talep ve yönerge karmaşıklığı arttığında bilgiyi işleme, görevde kalma ve frustrasyon toleransını sürdürme zorluğu ikincil olarak belirginleşmektedir.";
    case "language_social_pragmatic":
      return "Dilsel talep ile sosyal-pragmatik talep birlikte arttığında anlama, karşılıklılığı sürdürme, bilişsel organizasyon ve duygusal toparlanma aynı düzenleyici hat üzerinde zorlanmaktadır.";
    case "physiological_interoceptive":
      return "Beden-temelli toparlanma ve içsel sinyalleri düzenlemeye katma zorluğu arttığında dikkat, günlük işlev akışı ve duygusal toparlanma ikincil olarak zorlanmaktadır.";
    case "selective_interoception":
      return "İçsel bedensel sinyallerin fark edilmesi ve düzenleme sürecine zamanında katılması seçici olarak zorlandığında, işlevsel dalgalanma yaygın bir yetersizlikten çok beden sinyali farkındalığıyla açıklanır.";
    default:
      return "";
  }
}

function buildBalancedFormulationSentence(): string {
  return "Mevcut profil, belirgin bir self-regülasyon kırılganlığından çok korunmuş ve dengeli düzenleme zemini üzerinde bağlama duyarlı küçük değişkenlikler göstermektedir.";
}

function buildDomainAxisFormulationSentence(evidenceMap: ClinicalEvidenceMap): string {
  const secondaryText = evidenceMap.secondaryAxes.length
    ? formatDomainLabels(evidenceMap.secondaryAxes).toLocaleLowerCase("tr-TR")
    : "yakın düzenleyici alanlar";
  return `${evidenceMap.primaryAxis} alanındaki zorlanma, özellikle ${secondaryText} alanlarına yansıyarak günlük işlevde belirginleşmektedir.`;
}

function buildDomainAxisDecisionSentence(evidenceMap: ClinicalEvidenceMap): string {
  const secondaryText = evidenceMap.secondaryAxes.length
    ? `${formatDomainLabels(evidenceMap.secondaryAxes).toLocaleLowerCase("tr-TR")} alanlarına`
    : "yakın düzenleyici alanlara";
  const limitationText = evidenceMap.dataLimitations.some((line) => /ham puan|resmi yorum düzeyi/i.test(line))
    ? "; dış test kanıtı ham puan veya sınırlı yorum düzeyiyle geldiği için ana klinik yorum DNA skor örüntüsü, anamnez ve gözlemle sınırlandırılan"
    : "";

  return `Bu vaka, ${evidenceMap.primaryAxis.toLocaleLowerCase(
    "tr-TR"
  )} alanındaki zorlanmanın ${secondaryText} yansıdığı${limitationText} bir self-regülasyon profili olarak okunur.`;
}

function buildProfessorLevelDecisionSentence(evidenceMap: ClinicalEvidenceMap): string {
  if (evidenceMap.compiledNarrative?.decisionSentence) {
    return evidenceMap.compiledNarrative.decisionSentence;
  }
  if (evidenceMap.primaryAxis === "Korunmuş / dengeli self-regülasyon zemini") {
    return "Bu vaka, belirgin bir zorlanma odağı üretmeden korunmuş ve dengeli düzenleme zemini gösterir; bağlama duyarlı küçük hassasiyetler risk diline dönüştürülmeden ele alınır.";
  }

  if (evidenceMap.clinicalMechanism === "motor_praxis") {
    return "Bu vaka, motor planlama ve beden organizasyonu gerektiren durumlarda belirginleşen zorlanmanın yürütücü organizasyon, görev sürdürme ve duygusal toparlanma süreçlerine yansıdığı bir self-regülasyon profili olarak okunur.";
  }

  if (evidenceMap.clinicalMechanism === "evidence_limited_mixed") {
    return "Bu vakada dış test kanıtı sınırlı veya çelişkilidir; bu nedenle ana yorum yalnız ek test üzerinden büyütülmez, yürütücü organizasyon, bilişsel düzenleme ve duygusal toparlanmadaki değişkenlik bağlamla birlikte ele alınır.";
  }

  if (evidenceMap.clinicalMechanism === "selective_interoception") {
    return "Bu vaka, genel self-regülasyon problemi gibi genişletilmeden; içsel bedensel sinyalleri fark etme ve düzenleme sürecine katma alanında seçici bir interoseptif kırılganlık profili olarak okunur.";
  }

  if (isMechanismDriven(evidenceMap)) {
    return `Bu vaka, ${getMechanismDescriptor(evidenceMap)} ile tanımlanan bir self-regülasyon profili olarak okunur.`;
  }

  return buildDomainAxisDecisionSentence(evidenceMap);
}

function buildProfessorLevelFormulationSentence(
  evidenceMap: ClinicalEvidenceMap,
  domainResults?: DomainResult[],
  profileType?: string,
  options: { includeExternalSupport?: boolean; includeKnowledgeText?: boolean } = {}
): string {
  const includeExternalSupport = options.includeExternalSupport ?? true;
  const includeKnowledgeText = options.includeKnowledgeText ?? true;
  const externalSupport = includeExternalSupport && evidenceMap.externalTestSupport[0]
    ? formatExternalSupportSentence(
        evidenceMap.externalTestSupport[0],
        evidenceMap.clinicalMechanism === "evidence_limited_mixed" ||
          isLimitedExternalEvidenceLine(evidenceMap.externalTestSupport[0])
      )
    : "";
  const knowledgeText = includeKnowledgeText && domainResults?.length
    ? buildUseKnowledgeText(
        {
          domainResults,
          evidenceMap,
          profileType,
        },
        "formulation",
        2
      )
    : "";

  const mechanismFormulation = getMechanismFormulationSentence(evidenceMap);
  if (mechanismFormulation) {
    return `${mechanismFormulation}${externalSupport}${knowledgeText ? ` ${knowledgeText}` : ""}`;
  }

  if (evidenceMap.primaryAxis === "Korunmuş / dengeli self-regülasyon zemini") {
    return `${buildBalancedFormulationSentence()}${externalSupport}${knowledgeText ? ` ${knowledgeText}` : ""}`;
  }

  return `${buildDomainAxisFormulationSentence(evidenceMap)}${externalSupport}${knowledgeText ? ` ${knowledgeText}` : ""}`;
}

function buildReasoningCalibrationText(
  evidenceMap: ClinicalEvidenceMap,
  section: "decision" | "formulation" = "decision"
): string {
  const lines: string[] = [];
  if (evidenceMap.contextMatrix?.length) {
    const primaryContext = evidenceMap.contextMatrix[0];
    if (primaryContext.tag === "low_demand_one_to_one" && primaryContext.valence === "organizes") {
      lines.push("Yapılandırılmış bire bir ortamda daha iyi organize olması, güçlüğün her bağlamda aynı şiddette görünmediğini düşündürür.");
    } else {
      lines.push(`${capitalizeClinicalSentence(primaryContext.summary.replace(/\.$/, ""))}.`);
    }
  }
  if (section === "formulation") {
    return lines.slice(0, 1).join("\n");
  }
  if (evidenceMap.counterEvidenceLines?.length) {
    lines.push(
      `${cleanLimitationLine(evidenceMap.counterEvidenceLines[0])}. Bu nedenle klinik yorum tek yönlü bir risk iddiası olarak kurulmaz.`
    );
  } else if (evidenceMap.preservedCapacityLines?.length) {
    lines.push(
      `${cleanLimitationLine(evidenceMap.preservedCapacityLines[0])}.`
    );
  }
  return lines.slice(0, 2).join("\n");
}

function buildClinicalPriorityList(
  evidenceMap: ClinicalEvidenceMap,
  domainResults?: DomainResult[],
  profileType?: string
): string {
  const priorities = [
    evidenceMap.primaryAxis === "Korunmuş / dengeli self-regülasyon zemini"
      ? "- Ana klinik odak: Korunmuş self-regülasyon zemini ve bağlama göre değişebilen küçük hassasiyetler."
      : isMechanismDriven(evidenceMap)
      ? `- Ana klinik odak: ${evidenceMap.primaryAxis}. Bu odak skor sıralaması, anamnez, gözlem ve ek test bulguları birlikte ele alınarak belirlenmiştir.`
      : `- Ana klinik odak: ${evidenceMap.primaryAxis}. Klinik yorum bu eksende yoğunlaşmaktadır.`,
    evidenceMap.secondaryAxes.length
      ? `- Günlük yaşama yansıyan alanlar: ${formatDomainLabels(evidenceMap.secondaryAxes)} ana sorunun günlük işlevde görünürleştiği alanlardır.`
      : "- Günlük yaşama yansıyan alanlar: Belirgin bir ikincil alan ayrışmadığı için yorum tek alan sınırında tutulur.",
    evidenceMap.counterEvidenceLines?.length || evidenceMap.preservedCapacityLines?.length
      ? `- Dengeleyici bilgi: ${cleanLimitationLine(evidenceMap.counterEvidenceLines?.[0] || evidenceMap.preservedCapacityLines?.[0] || "")}.`
      : "",
    evidenceMap.differentialFormulation
      ? "- Yorum tek bir yüzeysel açıklamaya indirgenmeden bağlamsal kanıtla sınırlı tutulur."
      : "",
  ];

  return priorities.join("\n");
}

function buildVisibleConfidenceLabel(evidenceMap: ClinicalEvidenceMap): string {
  const hasHardContradiction = Boolean(
    evidenceMap.counterEvidenceLines?.some((line) => !/korunmuş|güçlü alan|genellenmemesi|beklenen aralık|ortalama/i.test(line))
  );
  const hasDecisionExternal =
    Boolean(evidenceMap.externalTestSupport?.length) ||
    evidenceMap.caseEvidenceLines.some((line) => /Dış test\/bulgu|SIPT|PDMS|Vineland|ABAS|PEDI|BRIEF|Conners|BASC|CELF|PLS|CCC|SRS/i.test(line));
  const hasObservation = evidenceMap.caseEvidenceLines.some((line) => /Terapist gözlemi|gözlem/i.test(line));
  const hasPreservedOnlyLimit = !hasHardContradiction && Boolean(evidenceMap.preservedCapacityLines?.length);
  const hasConstrainedExternalEvidence = evidenceMap.caseEvidenceLines.some((line) =>
    /korunmuş|beklenen aralık|ortalama|yaş uyumsuz|ham puan|ana kararı güçlendirmez/i.test(line)
  ) || evidenceMap.dataLimitations.some((line) => /korunmuş|beklenen aralık|ortalama|yaş uyumsuz|ham puan|sınırlı dış test|sonuç yönü/i.test(line));

  if (hasHardContradiction || evidenceMap.clinicalMechanism === "evidence_limited_mixed") return "orta";
  if (hasConstrainedExternalEvidence) return evidenceMap.confidenceLevel === "sınırlı" ? "sınırlı" : "orta";
  if (hasDecisionExternal && hasObservation && hasPreservedOnlyLimit) return "orta-yüksek";
  return evidenceMap.confidenceLevel;
}

function buildVisibleConfidenceRationale(evidenceMap: ClinicalEvidenceMap, limitationText: string): string {
  const label = buildVisibleConfidenceLabel(evidenceMap);
  if (label === "orta-yüksek") {
    return "Skor örüntüsü, terapist gözlemi ve yaşa uygun ek test bulguları aynı klinik yorumu desteklemektedir; korunmuş alanlar ise yorumun bağlama göre yapılmasını gerektirir.";
  }
  if (label === "orta") {
    return `Kanıt kaynakları birlikte değerlendirilmiştir. ${limitationText}`;
  }
  if (label === "sınırlı") {
    return `Vaka içi kanıt sınırlı olduğu için yorum temkinli tutulmuştur. ${limitationText}`;
  }
  return `${evidenceMap.confidenceRationale} ${limitationText}`;
}

function cleanLimitationLine(line: string): string {
  return String(line || "")
    .replace(/^Yorumu sınırlayan veri:\s*/i, "")
    .replace(/^Yorumu temkinli tutan bilgi:\s*/i, "")
    .replace(/^Dengeleyici bilgi:\s*/i, "")
    .replace(/^Korunmuş ya da sınırlayıcı veri,\s*/i, "Korunmuş alan bilgisi, ")
    .replace(/Bu bulgu,\s*/i, "")
    .replace(/yorumun her bağlama genellenmemesi gerektiğini gösterir/gi, "yorumun bağlama göre yapılmasını gerektirir")
    .replace(/yorumun yaygın bir sorun gibi genellenmemesi gerektiğini gösterir/gi, "yorumun bağlama göre yapılmasını gerektirir")
    .replace(/\.$/, "")
    .trim();
}

function joinClinicalSentences(lines: string[]): string {
  const cleaned = lines
    .map((line) => cleanLimitationLine(line))
    .filter(Boolean)
  const hasSpecificLimit = cleaned.some((line) => /Fizyolojik Regülasyon|Duyusal Regülasyon|Duygusal Regülasyon|Bilişsel Regülasyon|Yürütücü İşlev|İnterosepsiyon|yaş uyumsuz|ham puan|korunmuş görünmesi/i.test(line));
  const selected = hasSpecificLimit
    ? cleaned.filter((line) => !/^Korunmuş alan bilgisi,\s*yorumun bağlama göre yapılmasını gerektirir/i.test(line))
    : cleaned;
  return selected
    .map((line) => (/[.!?]$/.test(line) ? line : `${line}.`))
    .join(" ");
}

function buildGlobalClassificationNote(
  totalScore: number,
  globalLevel: DomainLevel,
  domainResults: DomainResult[],
  ageBandLabel?: string | null
): string {
  const domainLevels = Array.from(new Set(domainResults.map((domain) => domain.level)));
  const nonMatchingDomains = domainResults.filter((domain) => domain.level !== globalLevel);
  const ageText = ageBandLabel ? `${ageBandLabel} yaş bandında ` : "";

  if (nonMatchingDomains.length === 0) {
    return `${ageText}Global sınıflama toplam skor (${totalScore}/${GLOBAL_MAX}) üzerinden ${globalLevel} düzeydedir ve alan düzeyleri bu genel yönelimle uyumludur.`;
  }

  const groupedLevels = domainLevels
    .map((level) => {
      const labels = domainResults.filter((domain) => domain.level === level).map((domain) => domain.label);
      return labels.length ? `${level}: ${formatDomainLabels(labels)}` : "";
    })
    .filter(Boolean)
    .join("; ");

  return `${ageText}Global sınıflama toplam skor (${totalScore}/${GLOBAL_MAX}) eşiğine göre ${globalLevel} düzeydedir; alan düzeyleri ise her alanın 50 puanlık kendi eşiğine göre sınıflanır (${groupedLevels}). Bu nedenle global düzey ile alan etiketleri aynı olmak zorunda değildir; karar notu toplam skor görünümü ile alan bazlı kırılganlığı birlikte okur.`;
}

function buildClinicalEvidenceMap(params: {
  totalScore: number;
  globalLevel: DomainLevel;
  domainResults: DomainResult[];
  profileType: string;
  anamnezFlags: string[];
  anamnezSignals: AnamnezThemeSignals;
  therapistInsights: string[];
  externalClinicalFindings: string[];
  externalWarningLines: string[];
  externalTestAnalysis?: ExternalTestAnalysis;
  qualityGuidance: QualityGuidance;
  ageBandLabel?: string | null;
  answers?: number[] | null;
  itemLevelAnalysis?: ItemLevelAnalysis | null;
}): ClinicalEvidenceMap {
  const sortedNonTypical = [...params.domainResults]
    .filter((domain) => domain.level !== "Tipik")
    .sort((a, b) => a.score - b.score);
  const sortedByScore = [...params.domainResults].sort((a, b) => a.score - b.score);
  const primaryDomain = sortedNonTypical[0] || sortedByScore[0];
  const compatibleCategories = new Set(params.externalTestAnalysis?.decisionCompatibleCategories || []);
  const externalMatches = params.externalTestAnalysis?.matches || [];
  const hasLimitedExternalEvidence = externalMatches.some(
    (match) =>
      match.ageCompatible === false ||
      match.resultQuality === "ham_puan_only" ||
      match.resultQuality === "missing_result" ||
      match.resultQuality === "qualitative_only"
  );
  const hasPreservedExternalEvidence = externalMatches.some(
    (match) => match.ageCompatible === true && match.resultDirection === "expected_or_preserved"
  );
  const hasDecisionWeightedExternalEvidence = (params.externalTestAnalysis?.decisionCompatible.length || 0) > 0;
  const hasMixedExternalEvidence =
    Boolean(params.externalTestAnalysis?.mixedValidity) ||
    (hasLimitedExternalEvidence && hasPreservedExternalEvidence) ||
    (hasLimitedExternalEvidence && hasDecisionWeightedExternalEvidence) ||
    (hasPreservedExternalEvidence && hasDecisionWeightedExternalEvidence);
  const hasHighConflictExternalEvidence =
    hasMixedExternalEvidence &&
    ((hasLimitedExternalEvidence && hasPreservedExternalEvidence && hasDecisionWeightedExternalEvidence) ||
      Boolean(params.externalTestAnalysis?.mixedValidity && (hasLimitedExternalEvidence || hasPreservedExternalEvidence)));
  const hasExecutiveCognitiveEmotionalLoad = sortedNonTypical.some((domain) =>
    ["executive", "cognitive", "emotional"].includes(domain.key)
  );
  const profileText = params.profileType.toLocaleLowerCase("tr-TR");
  const hasMotorPraxisMechanism =
    compatibleCategories.has("motor_praxis") &&
    (params.anamnezSignals.motorPraxis ||
      /praksi|motor planlama|somatodispraksi|sekans|koordinasyon|beden organizasyonu/i.test(
        [...params.anamnezFlags, ...params.therapistInsights, ...params.externalClinicalFindings].join(" ")
      ));
  const hasStrongLanguageSocialMechanismEvidence =
    (compatibleCategories.has("language_communication") && params.anamnezSignals.languageLoad) ||
    (compatibleCategories.has("social_pragmatic") && params.anamnezSignals.socialPragmatic);
  const hasStrongAdaptiveMechanismEvidence =
    compatibleCategories.has("adaptive_daily_living") && params.anamnezSignals.adaptiveDailyLiving;
  const hasStrongMechanismEvidence =
    hasMotorPraxisMechanism ||
    hasStrongLanguageSocialMechanismEvidence ||
    hasStrongAdaptiveMechanismEvidence;
  const physioNonTypical = sortedNonTypical.some((domain) => domain.key === "physiological");
  const interoNonTypical = sortedNonTypical.some((domain) => domain.key === "interoception");
  const profileSuggestsBodyMechanism = /fizyolojik toparlanma|beden temelli/.test(profileText);
  const hasPhysiologicalInteroceptiveMechanism =
    ((physioNonTypical && interoNonTypical && params.anamnezSignals.bodyIntero) ||
      (profileSuggestsBodyMechanism && params.anamnezSignals.bodyIntero && (physioNonTypical || interoNonTypical)));
  const hasSelectiveInteroceptionMechanism =
    interoNonTypical &&
    !physioNonTypical &&
    (sortedNonTypical.length === 1 || /seçici|secici/.test(profileText)) &&
    (params.anamnezSignals.bodyIntero || /interosepsiyon|içsel|icsel|bedensel sinyal|açlık|aclik|susuz|tuvalet|yorgun/.test(
      [...params.anamnezFlags, ...params.therapistInsights, ...params.externalClinicalFindings, params.profileType].join(" ")
    ));
  const hasEvidenceLimitedMixedMechanism =
    hasMixedExternalEvidence &&
    hasExecutiveCognitiveEmotionalLoad &&
    (!hasStrongMechanismEvidence || hasHighConflictExternalEvidence) &&
    !hasPhysiologicalInteroceptiveMechanism;
  const hasAdaptiveMechanism =
    (params.externalTestAnalysis?.primaryCompatibleCategory === "adaptive_daily_living" ||
      /günlük yaşam|gunluk yasam|öz bakım|oz bakim/.test(profileText)) &&
    !hasMotorPraxisMechanism &&
    !hasPhysiologicalInteroceptiveMechanism &&
    !hasEvidenceLimitedMixedMechanism;
  const hasLanguageSocialMechanism =
    ((compatibleCategories.has("language_communication") && compatibleCategories.has("social_pragmatic")) ||
      (/dilsel/.test(profileText) && /sosyal-pragmatik/.test(profileText))) &&
    !hasMotorPraxisMechanism &&
    !hasPhysiologicalInteroceptiveMechanism &&
    !hasAdaptiveMechanism &&
    !hasEvidenceLimitedMixedMechanism;
  const hasLanguageMechanism =
    (params.externalTestAnalysis?.primaryCompatibleCategory === "language_communication" || /dilsel|sözel|sozel/.test(profileText)) &&
    !hasLanguageSocialMechanism &&
    !hasMotorPraxisMechanism &&
    !hasPhysiologicalInteroceptiveMechanism &&
    !hasAdaptiveMechanism &&
    !hasEvidenceLimitedMixedMechanism;
  const hasSocialMechanism =
    (params.externalTestAnalysis?.primaryCompatibleCategory === "social_pragmatic" || /sosyal-pragmatik|karşılıklılık|karsiliklilik/.test(profileText)) &&
    !hasLanguageSocialMechanism &&
    !hasLanguageMechanism &&
    !hasMotorPraxisMechanism &&
    !hasPhysiologicalInteroceptiveMechanism &&
    !hasAdaptiveMechanism &&
    !hasEvidenceLimitedMixedMechanism;
  const detectedClinicalMechanism: ClinicalMechanismType = hasEvidenceLimitedMixedMechanism
    ? "evidence_limited_mixed"
    : hasMotorPraxisMechanism
    ? "motor_praxis"
    : hasPhysiologicalInteroceptiveMechanism
    ? "physiological_interoceptive"
    : hasSelectiveInteroceptionMechanism
    ? "selective_interoception"
    : hasAdaptiveMechanism
    ? "adaptive_daily_living"
    : hasLanguageSocialMechanism
    ? "language_social_pragmatic"
    : hasLanguageMechanism
    ? "language_communication"
    : hasSocialMechanism
    ? "social_pragmatic"
    : "default";
  const balanced = sortedNonTypical.length === 0;
  const clinicalMechanism: ClinicalMechanismType = balanced ? "default" : detectedClinicalMechanism;
  const secondaryAxes = (
    clinicalMechanism === "default"
      ? sortedNonTypical.slice(1, 3).map((domain) => domain.label)
      : getPreferredSecondaryAxes(clinicalMechanism, sortedNonTypical)
  )
    .filter(Boolean)
    .slice(0, 3);
  const primaryAxis = balanced
    ? "Korunmuş / dengeli self-regülasyon zemini"
    : clinicalMechanism === "motor_praxis"
    ? "Motor planlama ve beden organizasyonu ile ilişkili self-regülasyon problemi"
    : clinicalMechanism === "adaptive_daily_living"
    ? "Günlük yaşam ve öz bakım akışını sürdürme zorluğu"
    : clinicalMechanism === "social_pragmatic"
    ? "Sosyal-pragmatik esneklik ve karşılıklılık zorluğu"
    : clinicalMechanism === "language_communication"
    ? "Dilsel talep ve sözel işleme zorluğu"
    : clinicalMechanism === "language_social_pragmatic"
    ? "Dilsel ve sosyal-pragmatik talep altında birleşen self-regülasyon problemi"
    : clinicalMechanism === "physiological_interoceptive"
    ? "Beden-temelli toparlanma ve interoseptif düzenleme süreçlerinde self-regülasyon problemi"
    : clinicalMechanism === "selective_interoception"
    ? "Seçici interoseptif farkındalık ve beden sinyali düzenleme sürecinde self-regülasyon zorluğu"
    : clinicalMechanism === "evidence_limited_mixed"
    ? "Kanıt sınırlı ve bağlama duyarlı yürütücü-bilişsel-duygusal regülasyon dalgalanması"
    : primaryDomain?.label || "Belirginleşen eksen yok";
  const primaryClinicalHypothesis = balanced
    ? `Mevcut veriler, klinik yorumu genişletmeden; genel olarak korunmuş self-regülasyon zemini üzerinde bağlama duyarlı hassasiyetlerin izlenmesini desteklemektedir.`
    : clinicalMechanism === "motor_praxis"
    ? `Mevcut veriler, ana zorlanmanın motor planlama ve beden organizasyonu talepleriyle başladığını; yürütücü organizasyon, görev sürdürme ve duygusal toparlanmanın buna ikincil olarak zorlandığını düşündürmektedir.`
    : clinicalMechanism === "adaptive_daily_living"
    ? `Mevcut veriler, ana zorlanmanın öz bakım ve günlük yaşam akışını başlatma/sürdürme taleplerinde toplandığını; yürütücü organizasyon, beden farkındalığı ve duygusal toparlanmanın buna ikincil olarak zorlandığını düşündürmektedir.`
    : clinicalMechanism === "social_pragmatic"
    ? `Mevcut veriler, ana zorlanmanın sosyal karşılıklılık ve pragmatik esneklik taleplerinde toplandığını; bilişsel düzenleme, duygusal toparlanma ve davranış ayarlamanın bu hatta ikincil olarak zorlandığını düşündürmektedir.`
    : clinicalMechanism === "language_communication"
    ? `Mevcut veriler, ana zorlanmanın sözel talep ve yönerge karmaşıklığında belirginleştiğini; bilişsel işleme, görevde kalma ve frustrasyon toleransının bu koşullarda ikincil olarak zorlandığını düşündürmektedir.`
    : clinicalMechanism === "language_social_pragmatic"
    ? `Mevcut veriler, dilsel talep ile sosyal-pragmatik talebin birlikte ana düzenleyici baskıyı oluşturduğunu; anlama, karşılıklılığı sürdürme, bilişsel organizasyon ve duygusal toparlanmanın bu hatta birlikte zorlandığını düşündürmektedir.`
    : clinicalMechanism === "physiological_interoceptive"
    ? `Mevcut veriler, ana zorlanmanın beden-temelli toparlanma ve içsel sinyalleri düzenlemeye katma taleplerinde toplandığını; dikkat, günlük işlev akışı ve duygusal toparlanmanın buna ikincil olarak zorlandığını düşündürmektedir.`
    : clinicalMechanism === "selective_interoception"
    ? `Mevcut veriler, ana zorlanmanın yaygın bir regülasyon bozulmasından çok içsel bedensel sinyalleri fark etme, anlamlandırma ve düzenleme sürecine zamanında katma alanında seçici olarak toplandığını düşündürmektedir.`
    : clinicalMechanism === "evidence_limited_mixed"
    ? `Mevcut verilerde dış test kanıtı ham puan, korunmuş sonuç veya yaş uyumsuzluk nedeniyle sınırlı kalmaktadır; bu nedenle ana klinik yorum DNA Intelligence skor örüntüsü, aileden gelen bilgi ve terapist gözlemiyle temkinli biçimde sınırlandırılır.`
    : `Mevcut veriler, zorlanmanın öncelikle ${primaryAxis} odağında belirginleştiğini; diğer alanların ise bunun günlük işlevdeki yansımalarını açıkladığını düşündürmektedir.`;

  const anamnesisEvidence = uniqueStrings(params.anamnezFlags).map((line) => cleanEvidenceLine(line)).slice(0, 3);
  const therapistObservationEvidence = uniqueStrings(params.therapistInsights)
    .map((line) => cleanEvidenceLine(line.replace(/^Terapist gözlemi:\s*/i, "")))
    .filter((line) => !isLimitedClinicalNarrativeLine(line))
    .slice(0, 3);
  const externalTestSupport = uniqueStrings(params.externalClinicalFindings)
    .map((line) => cleanEvidenceLine(line.replace(/^Ek klinik bulgu:\s*/i, "")))
    .slice(0, 3);
  const reasoning = buildClinicalReasoning({
    selectedMechanism: clinicalMechanism,
    primaryAxis,
    domainResults: params.domainResults,
    anamnezSignals: params.anamnezSignals,
    anamnezFlags: params.anamnezFlags,
    therapistInsights: params.therapistInsights,
    externalTestAnalysis: params.externalTestAnalysis,
    itemLevelAnalysis: params.itemLevelAnalysis,
  });
  const decisionWeightedExternalSupport = externalTestSupport.filter((line) => !isLimitedExternalEvidenceLine(line));
  const limitedExternalSupport = externalTestSupport.filter((line) => isLimitedExternalEvidenceLine(line));
  const mechanismEvidenceLines = balanced
    ? [
        ...(therapistObservationEvidence.length
          ? ["Terapist gözlemi, klinik yorumun günlük görev bağlamında nasıl göründüğünü anlamaya katkı sağlar."]
          : []),
        ...decisionWeightedExternalSupport.map((line) => `Dış test/bulgu: ${line}`),
        ...anamnesisEvidence.map((line) => `Anamnez teması: ${line}`),
        ...filterScoreCentricEvidenceLines(params.qualityGuidance.supportingEvidenceLines),
        ...filterScoreCentricEvidenceLines(params.qualityGuidance.primaryEvidenceLines),
      ]
    : clinicalMechanism === "default"
    ? [
        `Ana klinik odak ${primaryAxis.toLocaleLowerCase("tr-TR")} alanında belirginleşmektedir.`,
        secondaryAxes.length
          ? `Günlük yaşama yansıyan alanlar ${formatDomainLabels(secondaryAxes)} olarak görünürleşmektedir.`
          : "Yorum, ikincil bir alan kümesine genişletilmeden ana eksen üzerinden tutulur.",
        ...(therapistObservationEvidence.length
          ? ["Terapist gözlemi, klinik yorumun günlük görev bağlamında nasıl göründüğünü anlamaya katkı sağlar."]
          : []),
        ...decisionWeightedExternalSupport.map((line) => `Dış test/bulgu: ${line}`),
        ...anamnesisEvidence.map((line) => `Anamnez teması: ${line}`),
        ...filterScoreCentricEvidenceLines(params.qualityGuidance.supportingEvidenceLines),
        ...filterScoreCentricEvidenceLines(params.qualityGuidance.primaryEvidenceLines),
      ]
    : [
        `Ana klinik odak ${primaryAxis.toLocaleLowerCase("tr-TR")} alanında belirginleşmektedir.`,
        secondaryAxes.length
          ? `Günlük yaşama yansıyan alanlar ${formatDomainLabels(secondaryAxes)} olarak görünürleşmektedir.`
          : "Yorum, ayrı bir alan kümesine genişletilmeden ana klinik odak üzerinden tutulur.",
        ...(therapistObservationEvidence.length
          ? ["Terapist gözlemi, klinik yorumun günlük görev bağlamında nasıl göründüğünü anlamaya katkı sağlar."]
          : []),
        ...decisionWeightedExternalSupport.map((line) => `Dış test/bulgu: ${line}`),
        ...anamnesisEvidence.map((line) => `Anamnez teması: ${line}`),
        ...filterScoreCentricEvidenceLines(params.qualityGuidance.supportingEvidenceLines),
        ...filterScoreCentricEvidenceLines(params.qualityGuidance.primaryEvidenceLines),
      ];
  const caseEvidenceLines = uniqueStrings(mechanismEvidenceLines)
    .map((line) => cleanEvidenceLine(line))
    .slice(0, 6);

  const dataLimitations = uniqueStrings([
    anamnesisEvidence.length === 0 ? "Anamnez teması sınırlı olduğu için bağlamsal uyum yorumu temkinli tutulmalıdır." : null,
    therapistObservationEvidence.length === 0 ? "Terapist gözlem notu sınırlı olduğu için performans genellemesi artırılmamalıdır." : null,
    decisionWeightedExternalSupport.length === 0 ? "Yaşa uygun ve yorumlanabilir dış test desteği bulunmadığı için karar notu daha çok DNA Intelligence skor örüntüsü, anamnez ve gözleme dayanır." : null,
    ...limitedExternalSupport.map((line) => `Dış test kanıtı ana kararı güçlendirmez: ${line}`),
    ...(params.externalWarningLines || []),
    ...(params.externalTestAnalysis?.qualityFlagLines || []),
    ...reasoning.counterEvidenceLines.slice(0, 2),
    !Array.isArray(params.answers) || params.answers.length === 0
      ? "Yanıt ayrıntısı bulunmadığı için karar notu alan skorları ve anamnezle sınırlandırılır."
      : null,
  ]).slice(0, 4);

  const evidenceChannelCount =
    (anamnesisEvidence.length > 0 ? 1 : 0) +
    (therapistObservationEvidence.length > 0 ? 1 : 0) +
    (decisionWeightedExternalSupport.length > 0 ? 1 : 0) +
    (params.qualityGuidance.primaryEvidenceLines.length > 0 ? 1 : 0);
  const hasExternalConstraint =
    hasLimitedExternalEvidence ||
    hasPreservedExternalEvidence ||
    Boolean(params.externalTestAnalysis?.mixedValidity) ||
    (params.externalTestAnalysis?.qualityFlagLines?.length || 0) > 0 ||
    limitedExternalSupport.length > 0;
  const confidenceLevel: ClinicalEvidenceMap["confidenceLevel"] =
    clinicalMechanism === "evidence_limited_mixed"
      ? "orta"
      : reasoning.confidenceSubscores.crossSourceAgreement < 45 || reasoning.confidenceSubscores.naturalContextUncertainty > 75
      ? "sınırlı"
      : reasoning.counterEvidenceLines.length >= 2 || reasoning.preservedCapacityLines.length >= 2
      ? evidenceChannelCount >= 3
        ? "orta"
        : "sınırlı"
      : hasExternalConstraint
      ? evidenceChannelCount >= 3
        ? "orta"
        : "sınırlı"
      : dataLimitations.length >= 3
      ? "sınırlı"
      : evidenceChannelCount >= 3
      ? "yüksek"
      : evidenceChannelCount >= 2
      ? "orta"
      : "sınırlı";
  const confidenceRationale =
    clinicalMechanism === "evidence_limited_mixed"
      ? "Skor örüntüsü ve vaka anlatısı klinik hipotez üretir; ancak dış test kanıtı ham puan, korunmuş sonuç veya yaş/yorum sınırı içerdiği için karar güveni kontrollü tutulmuştur."
      : reasoning.counterEvidenceLines.length >= 2 || reasoning.preservedCapacityLines.length >= 2
      ? "Destekleyici kanıtla birlikte korunmuş kapasite veya sınırlayıcı kanıt bulunduğu için karar dili genellenmiş risk iddiasına dönüştürülmeden kalibre edilmiştir."
      : reasoning.confidenceSubscores.crossSourceAgreement < 45
      ? "Kaynaklar arası uyum sınırlı olduğu için karar güveni düşürülmüş ve yorum bağlama duyarlı tutulmuştur."
      : hasExternalConstraint
      ? "Kanıt kaynakları arasında yaş, yorum düzeyi veya sonuç yönü açısından sınırlılık bulunduğu için veri güveni temkinli tutulmuştur."
      : confidenceLevel === "yüksek"
      ? "Skor örüntüsü, anamnez/gözlem ve destekleyici klinik bulgular aynı klinik eksene yakınsamaktadır."
      : confidenceLevel === "orta"
      ? "Skor örüntüsü klinik ekseni belirginleştirmektedir; bağlamsal kanıtların bir bölümü destekleyici, bir bölümü sınırlıdır."
      : "Karar notu üretilebilir ancak bağlamsal veri kanalları sınırlı olduğu için yorumun genellenebilirliği düşüktür.";
  const differentialFormulation = buildDifferentialFormulation({
    globalClassificationNote: "",
    primaryClinicalHypothesis,
    primaryAxis,
    primaryAxisKind: balanced ? "balanced" : clinicalMechanism !== "default" ? "mechanism" : "domain",
    clinicalMechanism,
    secondaryAxes,
    anamnesisEvidence,
    therapistObservationEvidence,
    externalTestSupport,
    caseEvidenceLines,
    dataLimitations,
    confidenceLevel,
    confidenceRationale,
    evidenceGraphSummary: reasoning.evidenceGraphSummary,
    counterEvidenceLines: reasoning.counterEvidenceLines,
    preservedCapacityLines: reasoning.preservedCapacityLines,
    contextMatrix: reasoning.contextMatrix,
    confidenceSubscores: reasoning.confidenceSubscores,
    calibrationNotes: reasoning.calibrationNotes,
    mechanismScoreBreakdown: reasoning.mechanismScoreBreakdown,
  });
  const compiledNarrative = compileClinicalNarrative(
    {
      globalClassificationNote: "",
      primaryClinicalHypothesis,
      primaryAxis,
      primaryAxisKind: balanced ? "balanced" : clinicalMechanism !== "default" ? "mechanism" : "domain",
      clinicalMechanism,
      secondaryAxes,
      anamnesisEvidence,
      therapistObservationEvidence,
      externalTestSupport,
      caseEvidenceLines,
      dataLimitations,
      confidenceLevel,
      confidenceRationale,
      evidenceGraphSummary: reasoning.evidenceGraphSummary,
      counterEvidenceLines: reasoning.counterEvidenceLines,
      preservedCapacityLines: reasoning.preservedCapacityLines,
      contextMatrix: reasoning.contextMatrix,
      confidenceSubscores: reasoning.confidenceSubscores,
      calibrationNotes: reasoning.calibrationNotes,
      mechanismScoreBreakdown: reasoning.mechanismScoreBreakdown,
    },
    differentialFormulation
  );

  return {
    globalClassificationNote: buildGlobalClassificationNote(
      params.totalScore,
      params.globalLevel,
      params.domainResults,
      params.ageBandLabel
    ),
    primaryClinicalHypothesis,
    primaryAxis,
    primaryAxisKind: balanced ? "balanced" : clinicalMechanism !== "default" ? "mechanism" : "domain",
    clinicalMechanism,
    mechanismLabel:
      clinicalMechanism === "evidence_limited_mixed"
        ? "Kanıt Sınırlı / Çelişkili Klinik Ekseni"
        : clinicalMechanism === "motor_praxis"
        ? "Motor Planlama ve Beden Organizasyonu"
        : clinicalMechanism === "adaptive_daily_living"
        ? "Günlük Yaşam / Öz Bakım Klinik Ekseni"
        : clinicalMechanism === "social_pragmatic"
        ? "Sosyal-Pragmatik Klinik Ekseni"
        : clinicalMechanism === "language_communication"
        ? "Dilsel Talep Klinik Ekseni"
        : clinicalMechanism === "language_social_pragmatic"
        ? "Dilsel + Sosyal-Pragmatik Klinik Ekseni"
        : clinicalMechanism === "physiological_interoceptive"
        ? "Beden-Temelli Toparlanma Klinik Ekseni"
        : clinicalMechanism === "selective_interoception"
        ? "Seçici İnteroseptif Klinik Ekseni"
        : undefined,
    mechanismSummary:
      clinicalMechanism === "default"
        ? undefined
        : `Ana klinik tablo, ${getMechanismDescriptor({ clinicalMechanism, primaryAxis })} biçiminde izlenmektedir.`,
    secondaryAxes,
    anamnesisEvidence,
    therapistObservationEvidence,
    externalTestSupport,
    caseEvidenceLines,
    dataLimitations,
    confidenceLevel,
    confidenceRationale,
    evidenceGraphSummary: reasoning.evidenceGraphSummary,
    counterEvidenceLines: reasoning.counterEvidenceLines,
    preservedCapacityLines: reasoning.preservedCapacityLines,
    contextMatrix: reasoning.contextMatrix,
    confidenceSubscores: reasoning.confidenceSubscores,
    calibrationNotes: reasoning.calibrationNotes,
    mechanismScoreBreakdown: reasoning.mechanismScoreBreakdown,
    evidenceAtoms: reasoning.atoms,
    differentialFormulation,
    compiledNarrative,
  };
}

function buildClinicalDecisionSection(
  evidenceMap: ClinicalEvidenceMap,
  domainResults?: DomainResult[],
  profileType?: string
): string {
  const sourceEvidenceLines = evidenceMap.caseEvidenceLines.filter(
    (line) => !/^(Ana klinik odak|Günlük yaşama yansıyan alanlar|Birincil klinik eksen|Birincil mekanizma|İkincil yayılım)/i.test(line)
  );
  const caseEvidenceText = sourceEvidenceLines.length
    ? sourceEvidenceLines.slice(0, 2).map((line) => `- ${line}`).join("\n")
    : "- Vaka içi kanıt sınırlı olduğundan karar notu öncelikle skor örüntüsüyle sınırlandırılmıştır.";
  const limitationText = evidenceMap.dataLimitations.length
    ? joinClinicalSentences(uniqueStrings(evidenceMap.dataLimitations).slice(0, 2))
    : "Veri sınırlılığı kararın temel yönünü değiştirecek düzeyde görünmemektedir.";
  const decisionSummary =
    evidenceMap.primaryAxis === "Korunmuş / dengeli self-regülasyon zemini"
      ? "Karar özeti: Klinik yorum korunmuş düzenleme zemini ve bağlama duyarlı küçük değişkenliklerle sınırlıdır."
      : `Karar özeti: Ana odak ${evidenceMap.primaryAxis}; diğer alanlar bu odağın günlük yaşamdaki yansımalarını açıklar.`;
  const formulationSummary =
    evidenceMap.secondaryAxes.length > 0
      ? `Formülasyon özeti: Günlük işlevde öne çıkan yansımalar ${formatDomainLabels(evidenceMap.secondaryAxes)} alanlarında belirginleşmektedir.`
      : "Formülasyon özeti: Bulgular tek bir yaygınlık iddiasına genişletilmeden, mevcut veri sınırları içinde yorumlanır.";
  const visibleConfidenceLabel = buildVisibleConfidenceLabel(evidenceMap);
  const visibleConfidenceRationale = buildVisibleConfidenceRationale(evidenceMap, limitationText);

  return [
    decisionSummary,
    formulationSummary,
    buildClinicalPriorityList(evidenceMap, domainResults, profileType),
    "Kararı destekleyen bulgular:",
    caseEvidenceText,
    `Veri güveni: ${visibleConfidenceLabel}. ${visibleConfidenceRationale}`,
    "Bu karar notu kesin sonuç üretmez; anamnez, gözlem ve ek değerlendirme bulgularıyla birlikte okunması gereken klinik hipotezi özetler.",
  ].join("\n");
}

function buildClinicalDecisionSummarySection(params: {
  totalScore: number;
  globalLevel: DomainLevel;
  profileType: string;
  domainResults: DomainResult[];
  evidenceMap: ClinicalEvidenceMap;
  visibleInfo?: { adSoyad?: string; clientCode?: string; ageText?: string; diagnosis?: string };
}): string {
  const knowledgeDecision = "";
  const identityLine = buildCaseIdentityLine(params.visibleInfo || {});
  const weakest = [...params.domainResults].sort((a, b) => a.score - b.score)[0];
  const nonTypical = params.domainResults
    .filter((domain) => domain.level !== "Tipik")
    .sort((a, b) => a.score - b.score);
  const focusText =
    nonTypical.length >= 3
      ? formatDomainLabels(nonTypical.slice(0, 3).map((domain) => domain.label))
      : nonTypical.length > 0
      ? formatDomainLabels(nonTypical.map((domain) => domain.label))
      : "korunmuş self-regülasyon zemini";
  const globalMeaning =
    params.globalLevel === "Tipik"
      ? "genel profil korunmuş bir düzenleme zemini göstermektedir"
    : params.globalLevel === "Riskli"
      ? "genel profil, günlük işlevde belirginleşebilen self-regülasyon zorlukları göstermektedir"
      : "genel profil birden fazla alana yayılan belirgin self-regülasyon zorlukları göstermektedir";
  const opening =
    isMechanismDriven(params.evidenceMap)
      ? `Toplam skor ${params.totalScore}/${GLOBAL_MAX} ve genel düzey ${params.globalLevel} olarak hesaplanmıştır. Profil, "${params.profileType}" örüntüsüyle uyumludur; ${globalMeaning}. Mevcut veriler, ana klinik yorumun ${getMechanismDescriptor(params.evidenceMap)} üzerinden kurulmasını desteklemektedir.`
      : `Toplam skor ${params.totalScore}/${GLOBAL_MAX} ve genel düzey ${params.globalLevel} olarak hesaplanmıştır. Profil, "${params.profileType}" örüntüsüyle uyumludur; ${globalMeaning}. ` +
        `Bu nedenle klinik yorum ${params.evidenceMap.primaryAxis} alanında yoğunlaşmış; ${focusText} günlük işlevde izlenmesi gereken eşlik eden alanlar olarak ele alınmıştır.`;
  const secondaryText = params.evidenceMap.secondaryAxes.length
    ? `Bu nedenle ${formatDomainLabels(params.evidenceMap.secondaryAxes)} ana sorunun günlük yaşamdaki yansımaları olarak ele alınır.`
    : params.evidenceMap.primaryAxis === "Korunmuş / dengeli self-regülasyon zemini"
    ? "İkincil bir kırılgan alan belirgin biçimde ayrışmadığı için klinik yorum korunmuş işleyiş sınırında kalır."
    : weakest
    ? `En düşük alan puanı ${weakest.label} alanında görünmekle birlikte ikincil eksen gereksiz biçimde genişlemez.`
    : "";

  return [
    identityLine,
    opening,
    buildProfessorLevelDecisionSentence(params.evidenceMap),
    buildReasoningCalibrationText(params.evidenceMap, "decision"),
    secondaryText,
    knowledgeDecision,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildEvidenceProfileSummarySection(params: {
  totalScore: number;
  globalLevel: DomainLevel;
  profileType: string;
  domainResults: DomainResult[];
  evidenceMap: ClinicalEvidenceMap;
  ageBandLabel?: string | null;
  normSource?: "age_band_heuristic" | "fallback_fixed";
}): string {
  const scoreLines =
    isMechanismDriven(params.evidenceMap)
      ? [
          ...params.domainResults.map((d) => `- ${d.label}: ${d.score}/${DOMAIN_MAX} (${d.level})`),
          params.evidenceMap.clinicalMechanism === "evidence_limited_mixed"
            ? `Skorların klinik anlamı: Sayısal dağılım önemli bilgi sağlar; ancak dış test sınırları, korunmuş bulgular ve anamnez-gözlem uyumu birlikte değerlendirildiği için yorum ${params.evidenceMap.primaryAxis.toLocaleLowerCase("tr-TR")} odağında temkinli tutulur.`
            : `Skorların klinik anlamı: Sayısal dağılım önemli bilgi sağlar; klinik yorum ise dış test ve anamnezle desteklenen ${params.evidenceMap.primaryAxis.toLocaleLowerCase("tr-TR")} odağında kurulur.`,
        ].join("\n")
      : buildNumericalSection(params.domainResults);
  const normText =
    params.normSource === "age_band_heuristic" && params.ageBandLabel
      ? `Yorum ${params.ageBandLabel} yaş-duyarlı norm bandı üzerinden yapılmıştır.`
      : "Yorum sistem içi sabit eşikler üzerinden yapılmıştır.";
  return [
    `Kanıt profili toplam ${params.totalScore}/${GLOBAL_MAX} skor, ${params.globalLevel} genel düzey ve "${params.profileType}" sınıflamasıyla özetlenmektedir.`,
    normText,
    params.evidenceMap.globalClassificationNote,
    "Alan puanları:",
    scoreLines,
  ].join("\n");
}

function buildClinicalPatternFormulationSection(
  patternText: string,
  evidenceMap: ClinicalEvidenceMap,
  domainResults?: DomainResult[],
  profileType?: string
): string {
  const mechanism =
    evidenceMap.primaryAxis === "Korunmuş / dengeli self-regülasyon zemini"
      ? "Korunmuş self-regülasyon zemini, bağlama duyarlı küçük değişkenliklerin risk diliyle genişletilmeden ele alınmasını sağlar."
    : evidenceMap.clinicalMechanism === "motor_praxis"
      ? "Motor planlama ve beden organizasyonu talebi arttığında yürütücü düzenleme ve duygusal toparlanma aynı görev akışı içinde birlikte zorlanmaktadır."
    : isMechanismDriven(evidenceMap)
      ? `${getMechanismDescriptor(evidenceMap)} bu vakanın klinik formülasyonunu belirlemektedir.`
      : `${evidenceMap.primaryAxis} alanındaki zorlanma, ikincil kanıtlarla birlikte çocuğun hangi koşullarda zorlandığını açıklar.`;

  return [
    patternText,
    buildProfessorLevelFormulationSentence(evidenceMap, domainResults, profileType, { includeExternalSupport: false }),
    buildReasoningCalibrationText(evidenceMap, "formulation"),
    evidenceMap.differentialFormulation?.text,
    mechanism,
  ]
    .filter(Boolean)
    .join("\n");
}

export function generateDeterministicReport(input: ReportInput): DeterministicReport {
  const normalized = normalizeLegacyScores(input.scores);

  const rawAnamnez = anamnezToRecord(input.anamnez);
  const cleanedAnamnez: AnamnezRecord = Object.fromEntries(
    Object.entries(rawAnamnez)
      .map(([k, v]) => [k, normalizeTurkishClinicalText(cleanMeaningfulText(v))] as const)
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
  let itemLevelAnalysis = analyzeItemLevelSignals({
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

  const evidenceMap = buildClinicalEvidenceMap({
    totalScore: safeTotal,
    globalLevel,
    domainResults,
    profileType,
    anamnezFlags,
    anamnezSignals,
    therapistInsights,
    externalClinicalFindings: externalNarrativeLines.slice(0, 3),
    externalWarningLines,
    externalTestAnalysis,
    qualityGuidance,
    ageBandLabel,
    answers: input.answers,
    itemLevelAnalysis,
  });

  clinicalAnalysis.evidenceMap = evidenceMap;
  clinicalAnalysis.classificationNote = evidenceMap.globalClassificationNote;
  clinicalAnalysis.primaryClinicalHypothesis = evidenceMap.primaryClinicalHypothesis;
  clinicalAnalysis.primaryClinicalAxis = evidenceMap.primaryAxis;
  clinicalAnalysis.secondaryClinicalAxes = evidenceMap.secondaryAxes;
  clinicalAnalysis.caseEvidenceLines = evidenceMap.caseEvidenceLines;
  clinicalAnalysis.dataLimitations = evidenceMap.dataLimitations;
  clinicalAnalysis.dataConfidenceLevel = evidenceMap.confidenceLevel;
  clinicalAnalysis.dataConfidenceRationale = evidenceMap.confidenceRationale;

  itemLevelAnalysis = analyzeItemLevelSignals({
    answers: input.answers,
    anamnezRecord: cleanedAnamnez,
    therapistInsights,
    externalClinicalFindings: externalNarrativeLines,
    domainResults,
    clinicalMechanism: evidenceMap.clinicalMechanism,
  });
  clinicalAnalysis.criticalItemLines = itemLevelAnalysis?.criticalLines || [];
  clinicalAnalysis.alignedItemLines = itemLevelAnalysis?.alignedLines || [];
  clinicalAnalysis.itemSignalSummary = itemLevelAnalysis?.signalSummary || "";

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
    domains: buildDomainSection(domainResults, anamnezFlags, profileType, externalTestAnalysis, evidenceMap, itemLevelAnalysis),
    patterns: [
      buildPatternSection(
        profileType,
        patterns,
        domainResults,
        homogeneousProfile,
        anamnezSignals,
        externalTestAnalysis,
        evidenceMap
      ),
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
        ? [`- Ölçek yanıt örüntüsü, şu klinik ayrıntıyı desteklemektedir: ${itemLevelAnalysis.criticalLines.join(" ")}`]
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
        externalTestAnalysis,
        evidenceMap,
        cleanedAnamnez
      ),
      ...(itemLevelAnalysis?.alignedLines.length
        ? [`Ölçek yanıt örüntüsü şu klinik ayrıntıyı desteklemektedir: ${itemLevelAnalysis.alignedLines.join(" ")}`]
        : []),
    ]
      .filter(Boolean)
      .join(" "),
    conclusion: buildConclusion(globalLevel, profileType, normSource, domainResults, evidenceMap),
    decisionNote: buildClinicalDecisionSection(evidenceMap, domainResults, profileType),
  };

  const professorSections = {
    decisionSummary: buildClinicalDecisionSummarySection({
      totalScore: safeTotal,
      globalLevel,
      profileType,
      domainResults,
      evidenceMap,
      visibleInfo,
    }),
    evidenceProfile: buildEvidenceProfileSummarySection({
      totalScore: safeTotal,
      globalLevel,
      profileType,
      domainResults,
      evidenceMap,
      ageBandLabel,
      normSource,
    }),
    domains: sections.domains,
    patternFormulation: buildClinicalPatternFormulationSection(sections.patterns, evidenceMap, domainResults, profileType),
    evidenceFit: sections.anamnezTestFit,
    prioritization: sections.decisionNote,
    clinicalConclusion: sections.conclusion,
  };

  const rawReportText = [
    "1. Klinik Karar Özeti",
    professorSections.decisionSummary,
    "",
    "2. Klinik Kanıt Profili",
    professorSections.evidenceProfile,
    "",
    "3. Alan Bazlı Klinik Yorum",
    professorSections.domains,
    "",
    "4. Klinik Örüntü ve Formülasyon",
    professorSections.patternFormulation,
    "",
    "5. Anamnez, Gözlem ve Test Uyumunun Değerlendirilmesi",
    professorSections.evidenceFit,
    "",
    "6. Klinik Önceliklendirme Notu",
    professorSections.prioritization,
    "",
    "7. Klinik Sonuç",
    professorSections.clinicalConclusion,
  ].join("\n");
  const reportText = sanitizeFinalReportLanguage(rawReportText);

  const { strengths, weaknesses } = getMeaningfulStrengthWeakness(domainResults, homogeneousProfile);

  const domainLevels = domainResults.reduce<Record<string, DomainLevel>>((acc, d) => {
    acc[d.key] = d.level;
    const meta = DOMAIN_META[d.key as DomainKey];
    acc[meta.legacyName] = d.level;
    return acc;
  }, {});
  const wordRagChunkCoverage = `${CLINICAL_KNOWLEDGE_CHUNKS.length}/${WORD_RAG_SOURCE.sourceChunkCount}`;
  const { trace, auditTrail, reportVersionMeta } = buildReportTrace({
    input,
    domainResults,
    evidenceMap,
    externalTestAnalysis,
    itemLevelAnalysis,
    wordRagChunkCoverage,
    finalReportText: reportText,
  });
  clinicalAnalysis.trace = trace;
  clinicalAnalysis.auditTrail = auditTrail;
  clinicalAnalysis.reportVersionMeta = reportVersionMeta;

  return {
    normSource,
    ageBandLabel,
    trace,
    auditTrail,
    reportVersionMeta,
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

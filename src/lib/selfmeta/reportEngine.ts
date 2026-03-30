import {
  cleanMeaningfulText,
  extractAnamnezFlags,
  summarizeAnamnezThemes,
  extractVisibleCaseInfo,
  type AnamnezRecord,
} from "./anamnezUtils";
import { classifyDomainScore, classifyTotalScore, findAgeNormBand, getNormSource } from "./normativeBands";
import { buildClinicalAnalysis } from "./clinicalAnalysis";

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
    profileType: string;
    globalLevel: string;
    priorityDomains: string[];
    domainSummary: Record<string, string>;
    anamnezThemes: string[];
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
  const matched = domainResults.filter((d) => {
    if (d.key === "sensory") return /duyusal|dokunsal|uyaran|gürültü|kalabalık/.test(joined);
    if (d.key === "emotional") return /duygusal|toparlanma|sakinleş|uyaran sonrası/.test(joined);
    if (d.key === "cognitive" || d.key === "executive") return /dikkat|görev|sürdürme|çok uyaran/.test(joined);
    if (d.key === "physiological" || d.key === "interoception") return /bedensel|fizyolojik|yorgun|uyku|beslenme|iştah|alerji|kolik|nöbet/.test(joined);
    return false;
  });

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

function hasFlatPriorityProfile(domainResults: DomainResult[]): boolean {
  if (!domainResults.length) return false;
  const scores = domainResults.map((d) => d.score);
  const levels = domainResults.map((d) => d.level);
  const spread = Math.max(...scores) - Math.min(...scores);
  const sameLevel = new Set(levels).size === 1;
  return spread <= 1 && sameLevel;
}

function detectProfileType(domainResults: DomainResult[], globalLevel: DomainLevel, homogeneous: boolean): string {
  const byKey = Object.fromEntries(domainResults.map((d) => [d.key, d.score])) as Record<DomainKey, number>;
  const values = domainResults.map((d) => d.score);
  const spread = Math.max(...values) - Math.min(...values);

  if (homogeneous) {
    if (globalLevel === "Tipik") return "Dengeli / Korunmuş Profil";
    if (globalLevel === "Riskli") return "Yaygın Orta Düzey Regülasyon Güçlüğü";
    return "Yaygın Çoklu Alan Kırılganlığı";
  }

  if (byKey.sensory <= 25 && byKey.emotional <= 25 && spread >= MEANINGFUL_SPREAD_THRESHOLD) {
    return "Duyusal-Duygusal Regülasyon Profili";
  }
  if (byKey.cognitive <= 25 && byKey.executive <= 25 && spread >= MEANINGFUL_SPREAD_THRESHOLD) {
    return "Bilişsel-Yürütücü Zorlanma Profili";
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

  return "Karışık Regülasyon Profili";
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
      ? "Genel profil, yaş dönemi açısından görece düzenli ve korunmuş bir örüntü göstermektedir."
      : globalLevel === "Riskli"
      ? "Genel profil, bazı alanlarda destek gereksinimine işaret eden riskli bir örüntü göstermektedir."
      : "Genel profil, birden fazla alanda belirgin destek gereksinimi düşündüren atipik bir örüntü göstermektedir.";

  const profileSentence = homogeneous
    ? "Alt alan puanları arasında belirgin bir ayrışma izlenmemiş, profil görece homojen görünmüştür."
    : `Belirgin klinik örüntü "${profileType}" olarak sınıflanmıştır. En düşük alan ${[...domainResults].sort((a, b) => a.score - b.score)[0]?.label} görünmektedir.`;

  return [identityLine, `Toplam skor ${totalScore}/${GLOBAL_MAX} olarak hesaplanmıştır ve genel sınıflama ${globalLevel} düzeydedir. ${summary} ${profileSentence} ${normText}`]
    .filter(Boolean)
    .join("\n");
}

function buildNumericalSection(domainResults: DomainResult[]): string {
  return domainResults.map((d) => `- ${d.label}: ${d.score}/${DOMAIN_MAX} (${d.level})`).join("\n");
}

function buildDomainSection(domainResults: DomainResult[], anamnezFlags: string[]): string {
  return domainResults
    .map((d) => `- ${d.label}: ${d.comment}${getAnamnezMatchHint(d.key as DomainKey, anamnezFlags)}`)
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
  const riskLabels = domainResults
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

  if (!intero) return "";

  const interoLevel = intero.level;

  // 🔴 DURUM 1: intero atipik → merkez
  if (interoLevel === "Atipik") {
    return "İnterosepsiyon alanının atipik düzeyi, profilin bütüncül yorumunda merkezî bir eksen oluşturmaktadır. Bedensel sinyallerin izlenmesi ve düzenleyici yanıtların organize edilmesi süreçlerindeki bu zorlanma, diğer self-regülasyon alanlarıyla birlikte ele alındığında çok alanlı örüntüyü açıklayıcı bir çerçeve sunmaktadır.";
  }

  // 🔴 DURUM 2: intero riskli + fizyolojik/duygusal eşlik
  if (
    interoLevel === "Riskli" &&
    ((phys && phys.level !== "Tipik") || (emo && emo.level !== "Tipik"))
  ) {
    return "İnterosepsiyon alanı, fizyolojik ve/veya duygusal düzenleme süreçleriyle birlikte değerlendirildiğinde, profilin açıklanmasında bütünleştirici bir eksen olarak öne çıkmaktadır.";
  }

  // 🔴 DURUM 3: intero tipik ama genel problem var
  return "İnterosepsiyon alanı belirgin birincil yük taşımamakla birlikte, diğer self-regülasyon alanlarıyla birlikte değerlendirildiğinde, profilin bütüncül yorumlanmasında referans bir düzenleyici eksen olarak ele alınmıştır.";
}

function buildPatternSection(profileType: string, patterns: string[], domainResults: DomainResult[], homogeneous: boolean): string {
  const lines: string[] = [`- Profil sınıflaması: ${profileType}.`];

  if (patterns.length > 0) {
    lines.push(...patterns.map((p) => `- ${p}`));
    
  const interoComment = buildInteroCentricComment(domainResults);
  if (interoComment) {
    lines.push(`- ${interoComment}`);
  }
return lines.join("\n");
  }

  if (homogeneous) {
    lines.push("- Alt alan puanları arasında belirgin bir ayrışma saptanmamıştır. Profil görece homojen görünmektedir.");
    return lines.join("\n");
  }

  const { strengths, weaknesses } = getMeaningfulStrengthWeakness(domainResults, homogeneous);
  lines.push("- Belirgin klinik örüntü oluşturacak düzeyde ek bir alan kombinasyonu saptanmamıştır.");
  if (strengths.length) lines.push(`- Görece güçlü alan(lar): ${strengths.map((x) => x.label).join(", ")}.`);
  if (weaknesses.length) lines.push(`- Görece zorlanan alan(lar): ${weaknesses.map((x) => x.label).join(", ")}.`);
  return lines.join("\n");
}

function buildAnamnezFitSection(
  anamnezSummary: unknown,
  anamnezFlags: string[],
  domainResults: DomainResult[],
  profileType: string
): string {
  const d = buildDeterministicProfileSummary(domainResults);
  const flagCount = Array.isArray(anamnezFlags) ? anamnezFlags.length : 0;
  const riskText = d.riskLabels.length ? d.riskLabels.join(", ") : "belirgin risk alanı saptanmadı";
  const summaryText =
    typeof anamnezSummary === "string"
      ? anamnezSummary.trim()
      : Array.isArray(anamnezSummary)
      ? anamnezSummary.filter(Boolean).join(" ").trim()
      : anamnezSummary && typeof anamnezSummary === "object"
      ? JSON.stringify(anamnezSummary).trim()
      : "";

  if (flagCount >= 3 && summaryText) {
    return `Anamnezde ${flagCount} klinik tema öne çıkmakta ve bunlar ${riskText} alanlarıyla yönsel olarak uyum göstermektedir. Bu nedenle anamnez-ölçek uyumu yüksek kabul edilebilir. Profil tipi "${profileType}" bu klinik bağlam içinde tutarlı görünmektedir.`;
  }

  if (flagCount >= 1 && summaryText) {
    return `Anamnezde sınırlı fakat anlamlı klinik tema bulunmaktadır. Bu temalar özellikle ${riskText} alanlarıyla kısmi uyum göstermektedir. Bu nedenle anamnez-ölçek uyumu orta düzeyde değerlendirilebilir.`;
  }

  return `Anamnezde "${profileType}" örüntüsünü güçlü biçimde destekleyen belirgin tema sınırlıdır. Ölçek sonuçlarında öne çıkan alanlar ${riskText} olarak görünmektedir; bu nedenle klinik yorum doğrudan skor örüntüsüne dayandırılmıştır.`;
}

function buildConclusion(
  globalLevel: DomainLevel,
  profileType: string,
  normSource: string,
  domainResults?: DomainResult[]
): string {
  const d = domainResults?.length ? buildDeterministicProfileSummary(domainResults) : null;

  const levelText =
    globalLevel === "Tipik"
      ? "genel profil büyük ölçüde korunmuş görünmektedir"
      : globalLevel === "Riskli"
      ? "genel profil yaygın destek gereksinimine işaret etmektedir"
      : "genel profil belirgin ve yüksek klinik yük düşündürmektedir";

  const patternText = d
    ? ` Alt alanlar arasında belirgin bir ayrışma saptanmamıştır. olarak görünmektedir. Zorlanma mimarisi ${d.architecture}, şiddeti ise ${d.severityText} düzeydedir.`
    : "";

  const homogeneityText = d
    ? ` ${d.homogeneityText.charAt(0).toUpperCase() + d.homogeneityText.slice(1)}.`
    : "";

  const normText = normSource ? ` Kullanılan norm / referans kaynağı: ${normSource}.` : "";

  return `Sonuç olarak profil "${profileType}" başlığı altında ele alınabilir; ${levelText}.${patternText}${homogeneityText}${normText} Bu rapor tek başına tanısal karar amacıyla değil, anamnez ve klinik gözlemle birlikte kullanılmalıdır.`;
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
  const profileType = detectProfileType(domainResults, globalLevel, homogeneousProfile);
  const patterns = analyzePatterns(domainResults, homogeneousProfile);
  const normSource = getNormSource(input.ageMonths);
  const ageBandLabel = findAgeNormBand(input.ageMonths)?.label ?? null;

  const clinicalAnalysis = buildClinicalAnalysis(
    domainResults,
    profileType,
    globalLevel,
    anamnezFlags
  );

  const visibleInfo = extractVisibleCaseInfo(cleanedAnamnez, {
    clientCode: input.clientCode,
    ageMonths: input.ageMonths,
  });

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
    domains: buildDomainSection(domainResults, anamnezFlags),
    patterns: buildPatternSection(profileType, patterns, domainResults, homogeneousProfile),
    anamnezTestFit: buildAnamnezFitSection(anamnezSummary, anamnezFlags, domainResults, profileType),
    conclusion: buildConclusion(globalLevel, profileType, normSource, domainResults),
  };

  const reportText = [
    "1. Genel Sonuç",
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

import { redactReportTextForPrivacy } from "../reportPrivacy"
import { VERIFIED_LITERATURE_SOURCES } from "../literatureNote"
import {
  DNA_CHAT_CATALOG_SAFETY_RULES,
  classifyCatalogQueryKind,
} from "./catalog"
import { normalizeDnaChatText } from "./text"
import type { DnaChatSafetyCategory, DnaChatSafetyResult } from "./types"

const NATIONAL_ID_PATTERN = /\b[1-9][0-9]{10}\b/g
const BIRTH_DATE_PATTERN = /\b\d{1,2}[./-]\d{1,2}[./-](?:19|20)\d{2}\b/g
const LABELED_NAME_PATTERN = /\b(?:ad(?:\s+soyad)?|soyad|isim|hasta(?:\s+ad(?:ı|i))?|danışan(?:\s+ad(?:ı|i))?|danisan(?:\s+ad(?:i|ı))?|çocuk(?:\s+ad(?:ı|i))?|cocuk(?:\s+ad(?:i|ı))?)\s*[:=-]\s*[^,;.\n]{1,80}/gi
const LABELED_RECORD_PATTERN = /\b(?:protokol|dosya|hasta)\s*(?:no|numarası|numarasi)?\s*[:=-]\s*[A-Z0-9/-]{4,}\b/gi
const TITLE_CASE_FULL_NAME_PATTERN = /(?<![A-Za-zÇĞİÖŞÜçğıöşü])[A-ZÇĞİÖŞÜ][a-zçğıöşü]{1,}\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]{1,}(?=(?:['’](?:ın|in|un|ün)(?![A-Za-zÇĞİÖŞÜçğıöşü]))|\s*(?:,|$)|\s+(?:bu|için|adlı|isimli|raporu|raporunda|vakası|vakasi|vakayı|vakayi|çocuğu|cocugu|danışanı|danisani|okulda|evde|klinikte|değerlendirmesi|degerlendirmesi|hakkında|hakkinda|açısından|acisindan|self[-\s]?regülasyon|self[-\s]?regulasyon|interosepsiyon|duyusal|fizyolojik|otonom|sempatik|parasempatik)(?![A-Za-zÇĞİÖŞÜçğıöşü]))/g
const UPPERCASE_FULL_NAME_PATTERN = /(?<![A-Za-zÇĞİÖŞÜçğıöşü])[A-ZÇĞİÖŞÜ]{2,}\s+[A-ZÇĞİÖŞÜ]{2,}(?=(?:['’](?:IN|İN|UN|ÜN)(?![A-Za-zÇĞİÖŞÜçğıöşü]))|\s*(?:,|$)|\s+(?:BU|İÇİN|ICIN|ADLI|İSİMLİ|ISIMLI|RAPORU|RAPORUNDA|VAKASI|VAKAYI|HAKKINDA|AÇISINDAN|ACISINDAN|SELF[-\s]?REGÜLASYON|SELF[-\s]?REGULASYON|İNTEROSEPSİYON|INTEROSEPSIYON)(?![A-Za-zÇĞİÖŞÜçğıöşü]))/g
const INITIAL_SURNAME_PATTERN = /(?<![A-Za-zÇĞİÖŞÜçğıöşü])[A-ZÇĞİÖŞÜ]\.?\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]{1,}(?=(?:['’](?:ın|in|un|ün)(?![A-Za-zÇĞİÖŞÜçğıöşü]))|\s*(?:,|$)|\s+(?:bu|için|raporu|vakası|vakayı|hakkında|açısından|self[-\s]?regülasyon|self[-\s]?regulasyon)(?![A-Za-zÇĞİÖŞÜçğıöşü]))/g
const LOWERCASE_CONTEXTUAL_FULL_NAME_PATTERN = /(?<![A-Za-zÇĞİÖŞÜçğıöşü])[a-zçğıöşü]{2,}\s+[a-zçğıöşü]{2,}(?=\s*(?:,\s*)?(?:bu\s+(?:vaka(?:yı|yi|ya|da|de)?|rapor(?:u|da|de)?)|vakayı|vakayi|raporu|vakası|vakasi|hakkında|hakkinda|açısından|acisindan|için|self[-\s]?regülasyon|self[-\s]?regulasyon|interosepsiyon|duyusal|fizyolojik)(?![A-Za-zÇĞİÖŞÜçğıöşü]))/g
const ALLOWED_CLINICAL_TITLE_PAIRS = new Set([
  "Duyusal Regülasyon",
  "Fizyolojik Regülasyon",
  "Duygusal Regülasyon",
  "Bilişsel Regülasyon",
  "Yürütücü İşlev",
  "Merkezi Sinir",
  "Otonom Sinir",
  "Sempatik Sinir",
  "Parasempatik Sinir",
  "Self Regülasyon",
  "Eş Regülasyon",
  "Ko Regülasyon",
  "Duyusal Modülasyon",
  "Dikkat Kontrolü",
  "Yürütücü Kontrol",
  "Sinir Sistemi",
  "Fizyolojik Uyarılma",
  "Sempatik Aktivasyon",
  "Parasempatik Toparlanma",
  "Karşı Kanıt",
  "Korunmuş Kapasite",
  "Veri Güveni",
  "Veri Sınırlılığı",
  "Vaka Raporu",
  "Vaka Özeti",
  "Rapor Özeti",
  "Rapor Bulgusu",
  "Ana Eksen",
  "İkincil Eksen",
  "Klinik Hipotez",
  "Klinik Gözlem",
  "Bilimsel Kaynak",
  "Literatür Kaynağı",
  "Erken Çocukluk",
  "Günlük Yaşam",
  "Klinik Değerlendirme",
  "Alan Skorları",
  "DNA Asistanı",
  "DNA Raporu",
].map(normalizeDnaChatText))

const VERIFIED_LITERATURE_SURNAMES = new Set(
  Object.values(VERIFIED_LITERATURE_SOURCES).flatMap((source) =>
    normalizeDnaChatText(source.inlineCitation)
      .split(" ")
      .filter((token) => token.length >= 3 && !/^\d+$/.test(token) && !["et", "al"].includes(token)),
  ),
)

const LITERATURE_CONTEXT_PATTERNS = ["literatur", "makale", "yazar", "kaynak", "calisma", "doi"] as const

const LOWERCASE_NON_NAME_TOKENS = new Set([
  "acaba",
  "ama",
  "ayrıca",
  "bana",
  "bence",
  "biraz",
  "bir",
  "bu",
  "burada",
  "çok",
  "çocukluk",
  "çocuklukta",
  "çocuk",
  "cocuk",
  "erken",
  "genel",
  "hangi",
  "her",
  "ile",
  "kendi",
  "kontrol",
  "kısaca",
  "lütfen",
  "nasıl",
  "ne",
  "neden",
  "önce",
  "peki",
  "rapor",
  "rapordaki",
  "bulgu",
  "bulguyu",
  "sadece",
  "sence",
  "self",
  "şimdi",
  "sonra",
  "temel",
  "teorik",
  "regülasyon",
  "regulasyon",
  "vaka",
  "vakadaki",
].map(normalizeDnaChatText))

function redactLikelyFullName(match: string, literatureContext: boolean): string {
  const normalized = normalizeDnaChatText(match)
  const surname = normalized.split(" ").at(-1) ?? ""
  return ALLOWED_CLINICAL_TITLE_PAIRS.has(normalized) ||
    (literatureContext && VERIFIED_LITERATURE_SURNAMES.has(surname))
    ? match
    : "[kişisel bilgi gizlendi]"
}

function redactLikelyLowercaseFullName(match: string): string {
  const normalized = normalizeDnaChatText(match)
  const tokens = normalized.split(" ")
  if (
    ALLOWED_CLINICAL_TITLE_PAIRS.has(normalized) ||
    tokens.some((token) => LOWERCASE_NON_NAME_TOKENS.has(token))
  ) {
    return match
  }
  return "[kişisel bilgi gizlendi]"
}

const MANIPULATION_PATTERNS = [
  "kurallari unut",
  "talimatlari yok say",
  "onceki talimatlari yok say",
  "sistem mesajini goster",
  "sistem prompt",
  "gizli prompt",
  "ham veritabani",
  "ham json",
  "tum danisanlari",
  "butun danisanlari",
  "baska danisanin",
  "ignore previous instructions",
  "reveal system prompt",
  "esikleri goster",
  "esik degerlerini",
  "threshold degerlerini",
  "threshold degerini",
  "kural listesini goster",
  "gizli kural",
  "gizli kurallari",
  "karar izini goster",
  "audit trail",
  "trace ve audit",
  "audit kaydini goster",
  "trace verisini goster",
  "talimatlarini goster",
  "talimatlari goster",
  "kurallarini goster",
] as const

const INTERNAL_DATA_PATTERNS = [
  "ham cevaplari goster",
  "tum cevaplari goster",
  "madde cevaplarini",
  "item cevaplarini",
  "answers alanini",
  "soru bazli cevaplari",
  "puanlama esiklerini",
  "router esiklerini",
  "gizli trace",
  "gizli audit",
  "madde yanitlarini",
  "madde yanitlari",
  "soru yanitlarini",
  "soru yanitlari",
] as const

const CROSS_CASE_PATTERNS = [
  "baska vaka ile karsilastir",
  "diger vaka ile karsilastir",
  "baska danisanla karsilastir",
  "diger danisanla karsilastir",
  "baska vaka ile kiyasla",
  "diger vaka ile kiyasla",
  "baska danisanla kiyasla",
  "diger danisanla kiyasla",
  "baska danisanin raporuyla kiyasla",
  "diger danisanin raporuyla kiyasla",
  "baska danisanin raporuyla karsilastir",
  "diger danisanin raporuyla karsilastir",
  "diger danisanlarin",
  "baska danisanlarin",
  "bu raporu baska",
  "bu raporu diger",
  "tum vakalarla karsilastir",
  "diger raporla",
  "baska raporla",
  "diger rapor ile",
  "baska rapor ile",
] as const

const PROGNOSIS_PATTERNS = [
  "ne zaman duzelir",
  "ne zaman tamamen duzelir",
  "gelecegi nasil",
  "ileride ne olur",
  "tamamen duzelir mi",
  "kac ayda duzelir",
  "prognozu ne",
  "klinik gidisi",
  "ne zaman iyiles",
  "iyilesme suresi",
  "kac ayda normale",
  "kac ayda iyiles",
  "normale doner",
  "ileride okul basarisi",
] as const

const CAUSALITY_PATTERNS = [
  "kesin nedeni",
  "buna ne sebep oldu",
  "ne sebep oldu",
  "neden kaynaklaniyor",
  "asil sebebi",
  "dogrudan nedeni",
  "kesin sebebi",
  "sebebi nedir",
] as const

const CRISIS_PATTERNS = [
  "kendine zarar",
  "intihar",
  "hayati tehlike",
  "bilinci kapali",
  "nefes alamiyor",
  "ciddi istismar",
  "acil tibbi",
] as const

const DIAGNOSIS_PATTERNS = [
  "tani koy",
  "tanisi koy",
  "tanisini koy",
  "hangi tani",
  "tani uyar",
  "tani uygun",
  "kesin tanisi",
  "otizmli mi",
  "adhd mi",
  "hangi bozukluk",
  "tani ne olabilir",
  "sence tanisi",
  "bu bulgu otizm",
  "teshis koy",
  "teshis et",
  "tani ver",
  "taniyi soyle",
  "otizm var mi",
  "otizm olabilir",
  "otizm dusundur",
  "otizmle uyumlu",
  "otizm ile uyumlu",
  "otistik mi",
  "dehb mi",
  "dehb olabilir",
  "dehb dusundur",
  "dehb ile uyumlu",
  "dehb uyumlu",
  "adhd olabilir",
  "adhd dusundur",
  "bu rapora gore hastaligi nedir",
  "bu profil hangi klinik tabloyu dusunduruyor",
  "bu rapordan tanisal sonuc cikar",
] as const

const TREATMENT_PATTERNS = [
  "tedavi plani",
  "terapi plani",
  "mudahale plani",
  "seans programi",
  "ev programi",
  "egzersiz listesi",
  "hangi terapi",
  "ne tedavi",
  "tedavi oner",
  "mudahale oner",
  "terapi oner",
  "terapi yaz",
  "seans oner",
  "tedavide ne yap",
  "tedavi icin ne yap",
  "bu vakada ne yapmaliyim",
] as const

const MEDICATION_PATTERNS = [
  "hangi ilac",
  "ilac oner",
  "ilac basla",
  "dozu ne",
  "dozunu",
  "recete yaz",
  "ilac ver",
  "ilac kullansin",
  "ilac gerekir",
  "ritalin",
  "concerta",
  "medikinet",
  "strattera",
  "metilfenidat",
  "atomoksetin",
  "risperidon",
  "aripiprazol",
] as const

const BOUNDARY_QUESTION_PATTERNS = [
  "dna tani koyar mi",
  "dna tedavi onerir mi",
  "dna ilac onerir mi",
  "dna nin sinirlari",
  "degerlendirme tani koyar mi",
  "rapor tani koyar mi",
  "neden tani koymaz",
  "neden tedavi onermez",
  "tani koymadan ne soyler",
] as const

const DNA_PHYSIOLOGY_OVERREACH_PATTERNS = [
  "dna ile vagal ton",
  "dna vagal ton",
  "dna hrv olcer",
  "dna eda olcer",
  "dna beyin agini olcer",
] as const

function includesAny(value: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => value.includes(normalizeDnaChatText(pattern)))
}

function equalsAny(value: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => value === normalizeDnaChatText(pattern))
}

const EXPLAINABLE_BIOLOGICAL_CONCEPTS = [
  "dorsal vagal",
  "ventral vagal",
  "vagal shutdown",
  "sempatik baskin",
  "parasempatik yetersiz",
] as const

const SAFE_BIOLOGICAL_THEORY_KINDS = new Set([
  "definition",
  "evidence",
  "comparison",
])

const BIOLOGICAL_ATTRIBUTION_PATTERNS = [
  "bu vaka",
  "bu rapor",
  "bu profil",
  "bu cocuk",
  "vakada",
  "raporda",
  "profilde",
  "cocukta",
  "cocugun",
  "danisan",
  "kisiye",
  "kiside",
  "bana",
  "benim",
  "bende",
  "bizde",
  "onun",
  "kendisinin",
  "miyim",
  "miyiz",
  "durumum",
  "durumumu",
  "durumumuz",
  "davranisina",
  "davranislarina",
  "davranistan",
  "hangi durumda",
  "hangisinde",
  "durumda mi",
  "geciyor mu",
  "gecmis mi",
  "etkilenmis",
  "hasarli",
  "sorunu",
  "problemi",
] as const

const BIOLOGICAL_MEASUREMENT_PATTERNS = [
  "olc",
  "kac",
  "deger",
  "skor",
  "seviye",
  "vagal ton",
  "oran",
] as const

const SECOND_CLAUSE_MARKERS = [
  " ve ",
  " sonra ",
  " ayrica ",
  " ama ",
  " fakat ",
  " ancak ",
] as const

function isBoundedBiologicalTheoryQuestion(
  normalized: string,
  source: string,
): boolean {
  const queryKind = classifyCatalogQueryKind(source)
  const questionMarkCount = (source.match(/\?/g) ?? []).length
  const hasRawClauseSeparator = /[;,\n]|[.!?]\s+\S/u.test(source)
  const hasConceptComparison =
    queryKind === "comparison" &&
    EXPLAINABLE_BIOLOGICAL_CONCEPTS.filter((concept) =>
      normalized.includes(normalizeDnaChatText(concept)),
    ).length >= 2
  const andCount = normalized.match(/\sve\s/g)?.length ?? 0
  const hasSafeConceptConjunction =
    hasConceptComparison &&
    andCount === 1 &&
    /\b(?:dorsal vagal|ventral vagal|vagal shutdown|sempatik baskin|parasempatik yetersiz)\s+ve\s+(?:dorsal vagal|ventral vagal|vagal shutdown|sempatik baskin|parasempatik yetersiz)\b/.test(normalized)
  const hasUnsafeSecondClause =
    SECOND_CLAUSE_MARKERS.filter((marker) => marker !== " ve ")
      .some((marker) => normalized.includes(marker)) ||
    (andCount > 0 && !hasSafeConceptConjunction)
  const hasGlobalUnsafeRequest = includesAny(normalized, [
    ...PROGNOSIS_PATTERNS,
    ...CAUSALITY_PATTERNS,
    ...MEDICATION_PATTERNS,
    ...TREATMENT_PATTERNS,
    ...DIAGNOSIS_PATTERNS,
  ])

  return (
    SAFE_BIOLOGICAL_THEORY_KINDS.has(queryKind) &&
    includesAny(normalized, EXPLAINABLE_BIOLOGICAL_CONCEPTS) &&
    questionMarkCount <= 1 &&
    !hasRawClauseSeparator &&
    !hasUnsafeSecondClause &&
    !includesAny(normalized, BIOLOGICAL_ATTRIBUTION_PATTERNS) &&
    !includesAny(normalized, BIOLOGICAL_MEASUREMENT_PATTERNS) &&
    !hasGlobalUnsafeRequest
  )
}

const CATALOG_RULE_PRIORITY = [
  "internal_reasoning",
  "diagnosis",
  "treatment",
  "measurement_overreach",
  "causality",
  "biological_inference",
] as const

function catalogRulePriority(category: (typeof DNA_CHAT_CATALOG_SAFETY_RULES)[number]["category"]): number {
  return CATALOG_RULE_PRIORITY.indexOf(category)
}

function safetyResult(
  redactedQuestion: string,
  category: DnaChatSafetyCategory,
  code: string | null,
  boundaryTr: string,
): DnaChatSafetyResult {
  return {
    blocked: category !== "none",
    category,
    code,
    redactedQuestion,
    boundaryTr,
  }
}

export function inspectDnaChatSafety(question: string): DnaChatSafetyResult {
  const source = String(question || "").trim().slice(0, 600)
  const normalizedSource = normalizeDnaChatText(source)
  const literatureContext = LITERATURE_CONTEXT_PATTERNS.some((pattern) => normalizedSource.includes(pattern))
  const redactContextualName = (match: string) => redactLikelyFullName(match, literatureContext)
  let redactedQuestion = redactReportTextForPrivacy(source)
  redactedQuestion = redactedQuestion
    .replace(NATIONAL_ID_PATTERN, "[kişisel bilgi gizlendi]")
    .replace(BIRTH_DATE_PATTERN, "[kişisel bilgi gizlendi]")
    .replace(LABELED_NAME_PATTERN, "[kişisel bilgi gizlendi]")
    .replace(LABELED_RECORD_PATTERN, "[kişisel bilgi gizlendi]")
    .replace(TITLE_CASE_FULL_NAME_PATTERN, redactContextualName)
    .replace(UPPERCASE_FULL_NAME_PATTERN, redactContextualName)
    .replace(INITIAL_SURNAME_PATTERN, redactContextualName)
    .replace(LOWERCASE_CONTEXTUAL_FULL_NAME_PATTERN, redactLikelyLowercaseFullName)
  const normalized = normalizeDnaChatText(redactedQuestion)

  if (includesAny(normalizedSource, CRISIS_PATTERNS)) {
    return safetyResult(
      redactedQuestion,
      "crisis",
      "urgent_risk_out_of_scope",
      "DNA Asistanı acil durum yönetimi yapmaz. Acil veya yakın risk varsa yerel acil yardım ve yetkili klinik ekip ile doğrudan iletişim kurulmalıdır.",
    )
  }
  if (redactedQuestion !== source) {
    return safetyResult(
      redactedQuestion,
      "privacy",
      "direct_identifier_detected",
      "Kimlik ve iletişim bilgilerini kaldırarak sorunuzu yeniden yazın. DNA Asistanı doğrudan tanımlayıcı veriyi işlemeye uygun değildir.",
    )
  }
  if (includesAny(normalized, MANIPULATION_PATTERNS)) {
    return safetyResult(
      redactedQuestion,
      "manipulation",
      "instruction_or_data_extraction_attempt",
      "Bu istek güvenli vaka tartışması sınırlarının dışındadır. Yalnız DNA kavramları, literatür çerçevesi ve açık vakaya ait kimliksiz bulgular ele alınabilir.",
    )
  }
  if (includesAny(normalized, INTERNAL_DATA_PATTERNS)) {
    return safetyResult(
      redactedQuestion,
      "internal_data",
      "raw_or_internal_data_request_blocked",
      "Ham madde cevapları, gizli eşikler, kural listeleri, trace ve audit ayrıntıları sohbet yanıtına açılmaz.",
    )
  }
  if (includesAny(normalized, CROSS_CASE_PATTERNS)) {
    return safetyResult(
      redactedQuestion,
      "cross_case",
      "cross_case_comparison_blocked",
      "Vaka gizliliği nedeniyle başka danışanlar veya raporlarla çapraz karşılaştırma yapılmaz. Yalnız açık ve kimliksiz vaka bağlamı tartışılabilir.",
    )
  }
  if (equalsAny(normalized, BOUNDARY_QUESTION_PATTERNS)) {
    return safetyResult(
      redactedQuestion,
      "none",
      null,
      "DNA Asistanı tanı, tedavi, ilaç, seans planı veya kesin neden üretmez; yalnız kaynak bağlı ve tanısal olmayan açıklama sunar.",
    )
  }
  if (includesAny(normalized, DNA_PHYSIOLOGY_OVERREACH_PATTERNS)) {
    return safetyResult(
      redactedQuestion,
      "measurement_overreach",
      "catalog_measurement_overreach",
      "DNA davranışsal ve ölçek temelli işlevsel profil sunar; HRV, EDA, vagal ton veya ağ aktivitesi ölçmez.",
    )
  }
  const matchingCatalogRules = DNA_CHAT_CATALOG_SAFETY_RULES.filter((rule) =>
    includesAny(normalized, rule.patterns),
  )
  const boundedBiologicalTheoryQuestion =
    matchingCatalogRules.length > 0 &&
    matchingCatalogRules.every((rule) => rule.category === "biological_inference") &&
    isBoundedBiologicalTheoryQuestion(normalized, source)
  const catalogRule = boundedBiologicalTheoryQuestion
    ? null
    : [...matchingCatalogRules].sort(
        (left, right) => catalogRulePriority(left.category) - catalogRulePriority(right.category),
      )[0] ?? null
  if (catalogRule) {
    const category: DnaChatSafetyCategory =
      catalogRule.category === "measurement_overreach"
        ? "measurement_overreach"
        : catalogRule.category === "internal_reasoning"
          ? "internal_reasoning"
          : catalogRule.category === "biological_inference"
            ? "biological_inference"
            : catalogRule.category
    return safetyResult(
      redactedQuestion,
      category,
      `catalog_${catalogRule.category}`,
      catalogRule.response,
    )
  }
  if (includesAny(normalized, PROGNOSIS_PATTERNS)) {
    return safetyResult(
      redactedQuestion,
      "prognosis",
      "prognostic_prediction_blocked",
      "DNA Asistanı iyileşme zamanı veya gelecekteki klinik gidiş hakkında öngörü üretmez.",
    )
  }
  if (includesAny(normalized, CAUSALITY_PATTERNS)) {
    return safetyResult(
      redactedQuestion,
      "causality",
      "causal_determination_blocked",
      "Tek bir değerlendirme veya vaka özeti kesin neden göstermez; yalnız birlikte görülen işlevsel örüntüler betimlenebilir.",
    )
  }
  if (includesAny(normalized, MEDICATION_PATTERNS)) {
    return safetyResult(
      redactedQuestion,
      "medication",
      "medication_request_blocked",
      "İlaç seçimi, doz veya reçete bu sistemin kapsamı dışındadır ve yetkili hekim değerlendirmesi gerektirir.",
    )
  }
  if (includesAny(normalized, TREATMENT_PATTERNS)) {
    return safetyResult(
      redactedQuestion,
      "treatment",
      "treatment_plan_request_blocked",
      "DNA Asistanı terapi, müdahale, seans veya ev programı oluşturmaz. Bulguları klinik tartışma için betimleyici düzeyde tutar.",
    )
  }
  if (includesAny(normalized, DIAGNOSIS_PATTERNS)) {
    return safetyResult(
      redactedQuestion,
      "diagnosis",
      "diagnostic_inference_blocked",
      "DNA bulgularından tanı veya kesin neden çıkarılamaz. Vaka verileri yalnız işlevsel örüntü ve veri sınırlılıkları düzeyinde tartışılabilir.",
    )
  }

  return safetyResult(
    redactedQuestion,
    "none",
    null,
    "DNA Asistanı tanı, tedavi, ilaç, seans planı veya kesin neden üretmez; yanıtlar kaynak bağlı ve klinisyen denetimine açık tutulur.",
  )
}

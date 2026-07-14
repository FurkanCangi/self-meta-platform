export type ExternalTestCategory =
  | "adaptive_daily_living"
  | "development_general"
  | "executive_behavior"
  | "general"
  | "language_communication"
  | "motor_praxis"
  | "sensory_processing"
  | "social_pragmatic"

export type ExternalTestEvidenceTier = "official_metadata" | "official_and_literature_supported"

export type ExternalTestScientificProfile = {
  ageRange: string
  domainsMeasured: string[]
  scoreSystem: string
  resultLevels: string
  reportUse: string
  interpretationBoundaries: string
  dnaRelation: string
  sourceLinks: string[]
  evidenceTier: ExternalTestEvidenceTier
}

type ExternalTestBaseDefinition = {
  id: string
  name: string
  aliases: RegExp[]
  minAgeMonths: number
  maxAgeMonths: number
  sourceTitle: string
  sourceUrl: string
  supportedUse: string
}

export type ExternalTestDefinition = ExternalTestBaseDefinition & ExternalTestScientificProfile

export type ExternalTestMatch = {
  id: string
  name: string
  category: ExternalTestCategory
  minAgeMonths: number
  maxAgeMonths: number
  ageRange: string
  domainsMeasured: string[]
  scoreSystem: string
  resultLevels: string
  reportUse: string
  interpretationBoundaries: string
  dnaRelation: string
  sourceLinks: string[]
  evidenceTier: ExternalTestEvidenceTier
  sourceTitle: string
  sourceUrl: string
  supportedUse: string
  ageCompatible: boolean | null
  reportedResult?: string
  reportedInterpretation?: string
  reportedNotes?: string
  resultQuality?: "interpretable" | "ham_puan_only" | "missing_result" | "qualitative_only"
  resultDirection?: "elevated_or_low" | "expected_or_preserved" | "mixed_or_contextual" | "unclear"
  externalEvidenceWeight: number
  externalEvidenceWeightLabel: "none" | "limited" | "moderate" | "strong" | "balancing"
}

export type ExternalTestFindingEntry = {
  testName: string
  result: string
  interpretation: string
  notes: string
}

export type ExternalTestAnalysis = {
  matches: ExternalTestMatch[]
  compatible: ExternalTestMatch[]
  decisionCompatible: ExternalTestMatch[]
  incompatible: ExternalTestMatch[]
  compatibleIds: string[]
  compatibleCategories: ExternalTestCategory[]
  decisionCompatibleIds: string[]
  decisionCompatibleCategories: ExternalTestCategory[]
  primaryCompatibleCategory: ExternalTestCategory | null
  weightedDecisionSupport: number
  validatedSupportLines: string[]
  conciseSupportLines: string[]
  specificNarrativeLines: string[]
  synthesisLines: string[]
  warningLines: string[]
  decisionLines: string[]
  evidenceProfileLines: string[]
  qualityFlagLines: string[]
  parsedEntries: ExternalTestFindingEntry[]
  mixedValidity: boolean
  hasUnrecognizedContent: boolean
}

const SUPPORTED_EXTERNAL_TESTS_BASE: ExternalTestBaseDefinition[] = [
  {
    id: "abas3",
    name: "Adaptive Behavior Assessment System, Third Edition (ABAS-3)",
    aliases: [/\babas-?3\b/i, /\badaptive behavior assessment system\b/i],
    minAgeMonths: 0,
    maxAgeMonths: 1079,
    sourceTitle: "Pearson - Adaptive Behavior Assessment System, Third Edition (ABAS-3)",
    sourceUrl: "https://www.pearsonassessments.com/store/en/usd/p/100001262.html",
    supportedUse:
      "uyumsal davranış, günlük yaşam becerileri, kavramsal-sosyal-pratik işlevsellik ve bağımsızlık düzeyinin yorumunda destekleyici bağlam sağlar",
  },
  {
    id: "basc3",
    name: "Behavior Assessment System for Children, Third Edition (BASC-3)",
    aliases: [/\bbasc-?3\b/i, /\bbehavior assessment system for children\b/i],
    minAgeMonths: 24,
    maxAgeMonths: 263,
    sourceTitle: "Pearson - BASC-3",
    sourceUrl: "https://www.pearsonassessments.com/store/en/usd/p/P100010000",
    supportedUse:
      "davranış, duygusal düzenleme, dikkat ve uyumsal işleyişe ilişkin çok kaynaklı klinik gözlemleri destekleyici veri sağlar",
  },
  {
    id: "beery_vmi",
    name: "Beery VMI",
    aliases: [/\bbeery\b/i, /\bvmi\b/i, /\bbeery vmi\b/i],
    minAgeMonths: 24,
    maxAgeMonths: 1199,
    sourceTitle: "Pearson - Beery VMI",
    sourceUrl: "https://www.pearsonassessments.com/store/en/usd/p/100000663.html",
    supportedUse:
      "görsel-motor bütünleme ve ilgili performans gözlemlerini bilişsel/organizasyon bağlamında destekleyici veri olarak sunar",
  },
  {
    id: "bot2",
    name: "Bruininks-Oseretsky Test of Motor Proficiency, Second Edition (BOT-2)",
    aliases: [/\bbot-?2\b/i, /\bbruininks\b/i, /\boseretsky\b/i],
    minAgeMonths: 48,
    maxAgeMonths: 263,
    sourceTitle: "Pearson - BOT-2",
    sourceUrl: "https://www.pearsonassessments.com/store/usassessments/en/p/bruininks-oseretsky-test-of-motor-proficiency-second-edition/100000648",
    supportedUse:
      "ince-kaba motor koordinasyon ve motor yeterlilik yorumuna destekleyici bağlam sağlar; self-regülasyon skorlarını doğrudan değiştirmez",
  },
  {
    id: "brief_p",
    name: "Behavior Rating Inventory of Executive Function - Preschool Version (BRIEF-P)",
    aliases: [/\bbrief-?p\b/i, /\bbrief preschool\b/i],
    minAgeMonths: 24,
    maxAgeMonths: 71,
    sourceTitle: "PAR - Behavior Rating Inventory of Executive Function Preschool Version (BRIEF-P)",
    sourceUrl: "https://www.parinc.com/products/BRIEF-P",
    supportedUse:
      "erken çocuklukta yürütücü işlev, davranış düzenleme ve duygusal kontrol yorumlarını destekleyebilir",
  },
  {
    id: "brief2",
    name: "Behavior Rating Inventory of Executive Function, Second Edition (BRIEF2)",
    aliases: [/\bbrief2\b/i, /\bbrief-?2\b/i],
    minAgeMonths: 60,
    maxAgeMonths: 215,
    sourceTitle: "PAR - Behavior Rating Inventory of Executive Function, Second Edition (BRIEF2)",
    sourceUrl: "https://www.parinc.com/products/BRIEF-2",
    supportedUse:
      "okul çağı yürütücü işlev, duygusal düzenleme ve bilişsel kontrol yorumlarını destekleyebilir",
  },
  {
    id: "ccc2",
    name: "Children's Communication Checklist-2 (CCC-2)",
    aliases: [/\bccc-?2\b/i, /\bchildren'?s communication checklist\b/i],
    minAgeMonths: 48,
    maxAgeMonths: 203,
    sourceTitle: "Pearson - CCC-2",
    sourceUrl: "https://www.pearsonassessments.com/store/en/usd/p/100000193",
    supportedUse:
      "iletişim, pragmatik dil ve sosyal dil örüntülerinin özellikle otizm ve sosyal iletişim bağlamında yorumuna destek sağlar",
  },
  {
    id: "celf_preschool3",
    name: "Clinical Evaluation of Language Fundamentals Preschool-3 (CELF Preschool-3)",
    aliases: [/\bcelf preschool-?3\b/i, /\bcelf-?p?3\b/i, /\bclinical evaluation of language fundamentals preschool\b/i],
    minAgeMonths: 36,
    maxAgeMonths: 83,
    sourceTitle: "Pearson - CELF Preschool-3",
    sourceUrl: "https://www.pearsonassessments.com/store/en/usd/p/100002031.html",
    supportedUse:
      "alıcı-ifade edici dil, dil yapısı ve sınıf dili talepleri açısından dil profilinin yorumunda destekleyici bağlam sağlar",
  },
  {
    id: "conners4",
    name: "Conners 4",
    aliases: [/\bconners 4\b/i, /\bconners4\b/i],
    minAgeMonths: 72,
    maxAgeMonths: 216,
    sourceTitle: "MHS - Conners 4",
    sourceUrl: "https://storefront.mhs.com/collections/conners-4",
    supportedUse:
      "okul çağı dikkat, dürtüsellik ve davranış sorunları yorumuna destekleyici bağlam sağlar",
  },
  {
    id: "conners_ec",
    name: "Conners Early Childhood (Conners EC)",
    aliases: [/\bconners ec\b/i, /\bconners early childhood\b/i],
    minAgeMonths: 24,
    maxAgeMonths: 83,
    sourceTitle: "MHS - Conners Early Childhood (Conners EC)",
    sourceUrl: "https://storefront.mhs.com/collections/conners-ec.html",
    supportedUse:
      "erken çocuklukta davranış, dikkat, sosyal-duygusal işleyiş ve gelişimsel kilometre taşı yorumuna destekleyici veri sağlar",
  },
  {
    id: "dayc2",
    name: "Developmental Assessment of Young Children, Second Edition (DAYC-2)",
    aliases: [/\bdayc-?2\b/i, /\bdevelopmental assessment of young children\b/i],
    minAgeMonths: 0,
    maxAgeMonths: 71,
    sourceTitle: "Pearson - DAYC-2",
    sourceUrl: "https://www.pearsonassessments.com/store/usassessments/en/p/developmental-assessment-of-young-children-second-edition/100000730",
    supportedUse:
      "erken gelişim alanlarının genel örüntüsünü, özellikle bilişsel, sosyal-duygusal ve fiziksel gelişim bağlamında yorumlamaya yardımcı olur",
  },
  {
    id: "dcdq07",
    name: "Developmental Coordination Disorder Questionnaire (DCDQ'07)",
    aliases: [/\bdcdq'?07\b/i, /\bdcdq\b/i, /\bdevelopmental coordination disorder questionnaire\b/i],
    minAgeMonths: 60,
    maxAgeMonths: 180,
    sourceTitle: "DCDQ - The Developmental Coordination Disorder Questionnaire",
    sourceUrl: "https://dcdq.ca/",
    supportedUse:
      "ebeveyn bildirimine dayalı motor koordinasyon, günlük motor performans ve gelişimsel koordinasyon güçlüğü riskinin yorumuna destek sağlar",
  },
  {
    id: "mabc3",
    name: "Movement Assessment Battery for Children, Third Edition (MABC-3)",
    aliases: [/\bmabc-?3\b/i, /\bmovement abc-?3\b/i, /\bmovement assessment battery for children\b/i],
    minAgeMonths: 36,
    maxAgeMonths: 300,
    sourceTitle: "Pearson - MABC-3",
    sourceUrl: "https://www.pearsonassessments.com/store/usassessments/en/p/movement-assessment-battery-for-children-third-edition/P100051002",
    supportedUse:
      "kaba-ince motor koordinasyon, denge ve el becerisi örüntülerinin beden organizasyonu ve katılım bağlamında yorumuna destek sağlar",
  },
  {
    id: "mfun",
    name: "Miller Function and Participation Scales (M-FUN)",
    aliases: [/\bm-?fun\b/i, /\bmiller function and participation scales\b/i],
    minAgeMonths: 24,
    maxAgeMonths: 95,
    sourceTitle: "Pearson - M-FUN",
    sourceUrl: "https://www.pearsonassessments.com/store/usassessments/en/p/miller-function-and-participation-scales/100000557",
    supportedUse:
      "okul öncesi motor yeterlilik, katılım ve görev performansı örüntülerini bilişsel-yürütücü yükle birlikte yorumlamaya yardımcı olur",
  },
  {
    id: "pdms3",
    name: "Peabody Developmental Motor Scales, Third Edition (PDMS-3)",
    aliases: [/\bpdms-?3\b/i, /\bpeabody developmental motor scales\b/i, /\bpeabody motor\b/i, /\bpeabody motor testi\b/i],
    minAgeMonths: 0,
    maxAgeMonths: 71,
    sourceTitle: "Pearson - PDMS-3",
    sourceUrl: "https://www.pearsonassessments.com/store/en/usd/p/P100049000.html",
    supportedUse:
      "erken çocuklukta ince-kaba motor gelişim bulgularını beden organizasyonu ve günlük işlevsellik bağlamında yorumlarken destek sağlar",
  },
  {
    id: "pedi_cat",
    name: "Pediatric Evaluation of Disability Inventory Computer Adaptive Test (PEDI-CAT)",
    aliases: [/\bpedi-?cat\b/i, /\bpediatric evaluation of disability inventory\b/i],
    minAgeMonths: 0,
    maxAgeMonths: 251,
    sourceTitle: "Pearson - PEDI-CAT",
    sourceUrl: "https://www.pearsonassessments.com/store/en/usd/p/100002037.html",
    supportedUse:
      "günlük işlevsellik, mobilite, sosyal-bilişsel beceriler ve sorumluluk düzeyinin klinik yorumuna destekleyici veri sağlar",
  },
  {
    id: "pls5",
    name: "Preschool Language Scales, Fifth Edition (PLS-5)",
    aliases: [/\bpls-?5\b/i, /\bpreschool language scales\b/i],
    minAgeMonths: 0,
    maxAgeMonths: 95,
    sourceTitle: "Pearson - PLS-5",
    sourceUrl: "https://www.pearsonassessments.com/store/en/usd/p/100000233.html",
    supportedUse:
      "erken dil gelişimi, alıcı-ifade edici iletişim ve okul öncesi dil örüntülerinin yorumunda destekleyici bağlam sağlar",
  },
  {
    id: "sensory_profile_2",
    name: "Sensory Profile 2",
    aliases: [/\bsensory profile\b/i, /\bsensory profile 2\b/i, /\bsp2\b/i, /\bshort sensory profile\b/i],
    minAgeMonths: 0,
    maxAgeMonths: 179,
    sourceTitle: "Pearson - Sensory Profile 2",
    sourceUrl: "https://www.pearsonassessments.com/store/usassessments/en/p/sensory-profile-2/100000822",
    supportedUse:
      "duyusal işlemleme örüntülerini ve çevresel uyaran yükünün günlük yaşama etkisini yorumlarken destekleyici bağlam sağlar",
  },
  {
    id: "sipt",
    name: "Sensory Integration and Praxis Tests (SIPT)",
    aliases: [/\bsipt\b/i, /sensory integration and praxis/i],
    minAgeMonths: 48,
    maxAgeMonths: 107,
    sourceTitle: "WPS - (SIPT) Sensory Integration and Praxis Tests",
    sourceUrl: "https://www.wpspublish.com/sipt-sensory-integration-and-praxis-tests",
    supportedUse:
      "praksi, motor planlama, beden organizasyonu ve duyusal bütünleme ile ilişkili klinik yorumlara destekleyici bağlam sağlar",
  },
  {
    id: "spm2",
    name: "Sensory Processing Measure, Second Edition (SPM-2)",
    aliases: [/\bspm-?2\b/i, /\bsensory processing measure\b/i],
    minAgeMonths: 4,
    maxAgeMonths: 1044,
    sourceTitle: "WPS - Sensory Processing Measure, Second Edition (SPM-2)",
    sourceUrl: "https://www.wpspublish.com/spm-2",
    supportedUse:
      "duyusal işlemleme, çoklu ortam gözlemi ve praksi/beden organizasyonu yorumuna destekleyici veri sağlar",
  },
  {
    id: "srs2",
    name: "Social Responsiveness Scale, Second Edition (SRS-2)",
    aliases: [/\bsrs-?2\b/i, /\bsocial responsiveness scale\b/i],
    minAgeMonths: 29,
    maxAgeMonths: 216,
    sourceTitle: "WPS - Social Responsiveness Scale, Second Edition (SRS-2)",
    sourceUrl: "https://www.wpspublish.com/srs-2-social-responsiveness-scale-second-edition",
    supportedUse:
      "sosyal iletişim, sosyal farkındalık ve otizmle ilişkili toplumsal işlev örüntülerinin yorumunda destekleyici bağlam sağlar",
  },
  {
    id: "vineland3",
    name: "Vineland-3",
    aliases: [/\bvineland\b/i, /\bvineland-?3\b/i],
    minAgeMonths: 0,
    maxAgeMonths: 1080,
    sourceTitle: "Pearson - Vineland Adaptive Behavior Scales, Third Edition (Vineland-3)",
    sourceUrl: "https://www.pearsonassessments.com/store/en/usd/p/100001622",
    supportedUse:
      "uyumsal davranış, günlük yaşam becerileri, iletişim ve sosyalleşme örüntülerinin geniş bağlamlı yorumunda destek sağlar",
  },
]

function profile(params: ExternalTestScientificProfile): ExternalTestScientificProfile {
  return params
}

const EXTERNAL_TEST_SCIENTIFIC_PROFILES: Record<string, ExternalTestScientificProfile> = {
  abas3: profile({
    ageRange: "Doğumdan 89 yaşa kadar; çocuk formları bakımveren/öğretmen bildirimiyle kullanılır.",
    domainsMeasured: ["Uyumsal davranış", "Kavramsal beceriler", "Sosyal beceriler", "Pratik/günlük yaşam becerileri"],
    scoreSystem: "Genel uyumsal bileşik ve alan standart skorları; beceri alanlarında ölçek puanı ve alan düzeyi özetleri.",
    resultLevels: "Ortalama/yaş beklentisiyle uyumlu, düşük ortalama, düşük veya çok düşük uyumsal işlev gibi resmi rapor düzeyleri.",
    reportUse: "Günlük yaşam, öz bakım, bağımsız rutin ve sorumluluk performansını DNA profilinin işlevsel karşılığı olarak bağlamsallaştırır.",
    interpretationBoundaries: "DNA skorunu değiştirmez; uyumsal beceri sonucu tanı veya müdahale reçetesi olarak kullanılmaz.",
    dnaRelation: "Günlük yaşam ve öz bakım akışını, korunmuş alanlarla birlikte yorumlamaya katkı sağlar.",
    sourceLinks: ["https://www.parinc.com/products/ABAS-3", "https://www.wpspublish.com/abas-3-adaptive-behavior-assessment-system-third-edition"],
    evidenceTier: "official_metadata",
  }),
  basc3: profile({
    ageRange: "Yaklaşık 2-21 yaş aralığında çocuk/ergen davranış ve duygusal işleyiş derecelendirmesi.",
    domainsMeasured: ["Davranışsal belirtiler", "Duygusal işleyiş", "Dikkat", "Uyumsal beceriler"],
    scoreSystem: "T skorları, klinik/at-risk düzeyleri ve ölçek/indeks profilleri.",
    resultLevels: "Klinik yükselme, riskli/at-risk, beklenen aralık veya uyumsal beceri düşüklüğü gibi resmi düzeyler.",
    reportUse: "Duygusal toparlanma, davranış ayarlama ve dikkat-yürütücü yükün çok kaynaklı gözlem karşılığını açıklar.",
    interpretationBoundaries: "Psikiyatrik tanı veya davranış nedeni üretmez; yalnız derecelendirme temelli destekleyici bağlamdır.",
    dnaRelation: "Yürütücü davranış düzenleme ile duygusal yansımaların birlikte yorumlanmasını destekler.",
    sourceLinks: ["https://www.pearsonassessments.com/store/en/usd/p/P100010000"],
    evidenceTier: "official_metadata",
  }),
  beery_vmi: profile({
    ageRange: "Yaklaşık 2 yaştan yetişkinliğe kadar görsel-motor bütünleme değerlendirmesi.",
    domainsMeasured: ["Görsel-motor bütünleme", "Görsel algı", "Motor koordinasyon"],
    scoreSystem: "Standart skor, percentil ve yaş eşdeğeri gibi normatif özetler.",
    resultLevels: "Yaş beklentisiyle uyumlu, düşük ortalama, düşük veya belirgin zayıflık gibi performans düzeyleri.",
    reportUse: "Görsel-motor organizasyonun motor planlama, görev uygulama ve bilişsel organizasyonla ilişkisini bağlamsallaştırır.",
    interpretationBoundaries: "Tek başına praksi, öğrenme veya nörogelişimsel tanı üretmez.",
    dnaRelation: "Motor planlama ile bilişsel ve yürütücü yansımaların birlikte yorumlanmasına katkı sağlar.",
    sourceLinks: ["https://www.pearsonassessments.com/store/en/usd/p/100000663.html"],
    evidenceTier: "official_metadata",
  }),
  bot2: profile({
    ageRange: "4-21 yaş 11 ay aralığında motor yeterlilik değerlendirmesi.",
    domainsMeasured: ["İnce motor kontrol", "El koordinasyonu", "Vücut koordinasyonu", "Güç ve çeviklik"],
    scoreSystem: "Standart skor, ölçek puanı, percentil ve motor bileşik skorlar.",
    resultLevels: "Ortalama, düşük ortalama, düşük veya belirgin motor yeterlilik zayıflığı gibi normatif düzeyler.",
    reportUse: "Motor koordinasyon ve görev performansındaki yükü praksi/motor planlama formülasyonuna bağlar.",
    interpretationBoundaries: "DNA skorunu değiştirmez; motor tanı veya tedavi protokolü çıkarmaz.",
    dnaRelation: "Motor planlama ve praksi yorumunu destekler.",
    sourceLinks: ["https://www.pearsonassessments.com/store/usassessments/en/p/bruininks-oseretsky-test-of-motor-proficiency-second-edition/100000648"],
    evidenceTier: "official_metadata",
  }),
  brief_p: profile({
    ageRange: "2-5 yaş 11 ay okul öncesi yürütücü işlev derecelendirmesi.",
    domainsMeasured: ["İnhibisyon", "Geçiş/esneklik", "Duygusal kontrol", "Çalışma belleği", "Planlama/organizasyon"],
    scoreSystem: "T skorları, indeksler ve klinik yükselme düzeyleri.",
    resultLevels: "Beklenen aralık, potansiyel klinik yükselme veya klinik düzeyde yürütücü işlev yükü.",
    reportUse: "Görev sürdürme, davranış ayarlama ve duygusal kontrol bulgularını yürütücü düzenleme bağlamına yerleştirir.",
    interpretationBoundaries: "Dikkat bozukluğu veya yürütücü işlev hakkında tanısal hüküm üretmez; bağlamsal derecelendirme verisidir.",
    dnaRelation: "Yürütücü davranış düzenleme ile duygusal ve bilişsel yansımaların birlikte yorumlanmasını destekler.",
    sourceLinks: ["https://www.parinc.com/products/BRIEF-P"],
    evidenceTier: "official_metadata",
  }),
  brief2: profile({
    ageRange: "5-18 yaş okul çağı yürütücü işlev derecelendirmesi.",
    domainsMeasured: ["Davranış düzenleme", "Duygu düzenleme", "Bilişsel düzenleme", "Global executive composite"],
    scoreSystem: "T skorları, indeksler ve klinik yükselme düzeyleri.",
    resultLevels: "Beklenen aralık, potansiyel klinik yükselme veya klinik yükselme.",
    reportUse: "Okul çağı yürütücü organizasyon ve görev sürdürme yükünü destekleyici veri olarak kullanır.",
    interpretationBoundaries: "Yaş uyumsuzsa ana karara katılmaz; tanı veya tedavi kararı üretmez.",
    dnaRelation: "executive_behavior mekanizmasını destekler.",
    sourceLinks: ["https://www.parinc.com/products/BRIEF-2"],
    evidenceTier: "official_metadata",
  }),
  ccc2: profile({
    ageRange: "Yaklaşık 4-16 yaş 11 ay çocuk iletişim/pragmatik dil derecelendirmesi.",
    domainsMeasured: ["Yapısal dil", "Pragmatik dil", "Sosyal iletişim", "Bağlamsal iletişim kullanımı"],
    scoreSystem: "Standart skorlar, ölçek puanları ve pragmatik/sosyal iletişim profil özetleri.",
    resultLevels: "Yaş beklentisiyle uyumlu, düşük performans, pragmatik dil zayıflığı veya sosyal iletişim yükü.",
    reportUse: "Sosyal-pragmatik talep ve dilsel bağlamın regülasyon yükünü nasıl artırdığını açıklar.",
    interpretationBoundaries: "Otizm veya dil bozukluğu tanısı üretmez; iletişimsel bağlamı destekler.",
    dnaRelation: "Sosyal-pragmatik taleple dilsel talebin birlikte yorumlanmasını destekler.",
    sourceLinks: ["https://www.pearsonassessments.com/store/en/usd/p/100000193"],
    evidenceTier: "official_metadata",
  }),
  celf_preschool3: profile({
    ageRange: "3-6 yaş 11 ay okul öncesi dil değerlendirmesi.",
    domainsMeasured: ["Alıcı dil", "İfade edici dil", "Dil yapısı", "Yönerge ve sınıf dili talepleri"],
    scoreSystem: "Standart skorlar, ölçek puanı, percentil ve indeks/alt test özetleri.",
    resultLevels: "Ortalama, düşük ortalama, düşük veya dilsel talep altında performans zayıflığı.",
    reportUse: "Sözel yük, yönerge karmaşıklığı ve dilsel işlemleme yükünü bilişsel/yürütücü regülasyonla ilişkilendirir.",
    interpretationBoundaries: "Dil tanısı üretmez; kullanıcı tarafından bildirilen resmi sonuç özetini bağlamlaştırır.",
    dnaRelation: "Dilsel iletişimle sosyal-pragmatik talebin birlikte yorumlanmasını destekler.",
    sourceLinks: ["https://www.pearsonassessments.com/store/en/usd/p/100002031.html"],
    evidenceTier: "official_metadata",
  }),
  conners4: profile({
    ageRange: "6-18 yaş dikkat, davranış ve yürütücü işleyiş derecelendirmesi.",
    domainsMeasured: ["Dikkat", "Dürtüsellik", "Hiperaktivite", "Yürütücü işlev", "Davranışsal kontrol"],
    scoreSystem: "T skorları, indeksler ve klinik yükselme düzeyleri.",
    resultLevels: "Beklenen aralık, yükselmiş, çok yükselmiş veya klinik olarak anlamlı profil.",
    reportUse: "Dikkat ve davranış organizasyonu yükünü okul çağı bağlamında destekler.",
    interpretationBoundaries: "Yaş uyumsuzsa ana kararda kullanılmaz; ADHD tanısı veya tedavi önerisi üretmez.",
    dnaRelation: "executive_behavior mekanizmasını destekler.",
    sourceLinks: ["https://storefront.mhs.com/collections/conners-4"],
    evidenceTier: "official_metadata",
  }),
  conners_ec: profile({
    ageRange: "2-6 yaş erken çocukluk davranış, dikkat ve gelişimsel işleyiş derecelendirmesi.",
    domainsMeasured: ["Dikkat", "Davranış düzenleme", "Sosyal-duygusal işleyiş", "Gelişimsel kilometre taşları"],
    scoreSystem: "T skorları, gelişimsel ölçekler ve klinik yükselme düzeyleri.",
    resultLevels: "Beklenen aralık, risk/yükselme veya klinik olarak anlamlı davranışsal yük.",
    reportUse: "Erken çocuklukta dikkat, davranış kontrolü ve duygusal regülasyon yükünü bağlamsallaştırır.",
    interpretationBoundaries: "Tanısal hüküm üretmez; ev/okul/terapi bağlamıyla birlikte yorumlanmalıdır.",
    dnaRelation: "Yürütücü davranış düzenleme ile duygusal ve bilişsel yansımaların birlikte yorumlanmasını destekler.",
    sourceLinks: ["https://storefront.mhs.com/collections/conners-ec.html"],
    evidenceTier: "official_metadata",
  }),
  dayc2: profile({
    ageRange: "Doğumdan 5 yaş 11 aya kadar erken gelişim alanları.",
    domainsMeasured: ["Bilişsel gelişim", "İletişim", "Sosyal-duygusal gelişim", "Fiziksel gelişim", "Uyumsal davranış"],
    scoreSystem: "Standart skor, percentil, yaş eşdeğeri ve alan profili özetleri.",
    resultLevels: "Yaşa uygun, gecikme riski, düşük performans veya alan bazlı gelişimsel kırılganlık.",
    reportUse: "Çok küçük yaş veya geniş gelişimsel profil durumlarında regülasyon yorumunu gelişimsel çerçeveye yerleştirir.",
    interpretationBoundaries: "DNA alan skorlarını değiştirmez; gelişimsel tanı veya prognoz üretmez.",
    dnaRelation: "development_general ve bağlamsal regülasyon yorumunu destekler.",
    sourceLinks: ["https://www.pearsonassessments.com/store/usassessments/en/p/developmental-assessment-of-young-children-second-edition/100000730"],
    evidenceTier: "official_metadata",
  }),
  dcdq07: profile({
    ageRange: "5-15 yaş ebeveyn bildirimine dayalı motor koordinasyon taraması.",
    domainsMeasured: ["Motor koordinasyon", "Günlük motor performans", "Kontrol ve hareket kalitesi"],
    scoreSystem: "Anket toplam/alan puanları ve gelişimsel koordinasyon güçlüğü risk düzeyi.",
    resultLevels: "Beklenen performans, riskli/sınır veya motor koordinasyon güçlüğü açısından destekleyici profil.",
    reportUse: "Günlük yaşamda motor koordinasyon ve beden organizasyonu yükünü praksi/motor mekanizmaya bağlar.",
    interpretationBoundaries: "Tarama/bildirim niteliği taşır; DCD tanısı üretmez.",
    dnaRelation: "Motor planlama ve praksi yorumunu destekler.",
    sourceLinks: ["https://dcdq.ca/"],
    evidenceTier: "official_metadata",
  }),
  mabc3: profile({
    ageRange: "3-25 yaş aralığında hareket/motor performans değerlendirmesi.",
    domainsMeasured: ["El becerisi", "Top becerileri", "Denge", "Motor koordinasyon"],
    scoreSystem: "Standart skor, percentil ve trafik ışığı/performans sınıflaması gibi normatif özetler.",
    resultLevels: "Beklenen aralık, risk/sınır veya belirgin motor performans güçlüğü.",
    reportUse: "Motor koordinasyonun görev uygulama, katılım ve beden organizasyonuyla ilişkisini açıklar.",
    interpretationBoundaries: "Tek başına tanı veya müdahale kararı üretmez.",
    dnaRelation: "Motor planlama ve praksi yorumunu destekler.",
    sourceLinks: ["https://www.pearsonassessments.com/store/usassessments/en/p/movement-assessment-battery-for-children-third-edition/P100051002"],
    evidenceTier: "official_metadata",
  }),
  mfun: profile({
    ageRange: "2 yaş 6 aydan 7 yaş 11 aya kadar okul öncesi/erken okul çağı işlev ve katılım.",
    domainsMeasured: ["İnce motor", "Kaba motor", "Görsel-motor", "Okul öncesi görev performansı", "Katılım"],
    scoreSystem: "Standart skor, ölçek puanı, percentil ve görev/katılım profili özetleri.",
    resultLevels: "Yaş beklentisiyle uyumlu, düşük ortalama, düşük veya katılımda işlevsel zorlanma.",
    reportUse: "Motor performansın katılım ve görev sürdürme üzerindeki etkisini görünür kılar.",
    interpretationBoundaries: "Motor performans sonucu self-regülasyon tanısı olarak yorumlanmaz.",
    dnaRelation: "Motor planlama ile yürütücü ve bilişsel yansımaların birlikte yorumlanmasını destekler.",
    sourceLinks: ["https://www.pearsonassessments.com/store/usassessments/en/p/miller-function-and-participation-scales/100000557"],
    evidenceTier: "official_metadata",
  }),
  pdms3: profile({
    ageRange: "Doğumdan 5 yaş 11 aya kadar erken çocukluk motor gelişim değerlendirmesi.",
    domainsMeasured: ["Kaba motor", "İnce motor", "Motor koordinasyon", "Motor gelişim profili"],
    scoreSystem: "Alt test/kompozit standart skorları, percentil, yaş eşdeğeri ve motor gelişim düzeyi özetleri.",
    resultLevels: "Yaş beklentisiyle uyumlu, düşük ortalama, düşük veya motor gelişim performansında belirgin zayıflık.",
    reportUse: "Erken motor gelişim bulgularını beden organizasyonu, motor planlama ve günlük işlevle ilişkilendirir.",
    interpretationBoundaries: "Motor test sonucu DNA skorunu değiştirmez; tek başına praksi tanısı veya tedavi reçetesi üretmez.",
    dnaRelation: "Motor planlama ile yürütücü ve bilişsel yansımaların birlikte yorumlanmasını destekler.",
    sourceLinks: ["https://www.wpspublish.com/peabody-developmental-motor-scales-third-edition.html", "https://www.parinc.com/products/PDMS-3"],
    evidenceTier: "official_metadata",
  }),
  pedi_cat: profile({
    ageRange: "Doğumdan 20 yaşa kadar günlük işlevsellik ve katılım değerlendirmesi.",
    domainsMeasured: ["Daily Activities", "Mobility", "Social/Cognitive", "Responsibility"],
    scoreSystem: "Bilgisayar uyarlamalı IRT modeliyle T skoru, ölçek puanı ve percentil/yaş karşılaştırmalı özetler.",
    resultLevels: "Yaş beklentisiyle uyumlu, beklenenin altında işlevsel beceri veya sorumluluk/katılımda destek ihtiyacı.",
    reportUse: "Regülasyon yükünün öz bakım, mobilite, sosyal-bilişsel katılım ve sorumluluk düzeyindeki işlevsel karşılığını gösterir.",
    interpretationBoundaries: "Katılım ve işlevsellik verisidir; DNA alan skoru veya tanı yerine geçmez.",
    dnaRelation: "Günlük yaşam ve öz bakım bulgularının bedensel toparlanma ve günlük işlevle birlikte yorumlanmasını destekler.",
    sourceLinks: ["https://www.pedicat.com/", "https://www.pedicat.com/faq/"],
    evidenceTier: "official_metadata",
  }),
  pls5: profile({
    ageRange: "Doğumdan 7 yaş 11 aya kadar erken dil gelişimi.",
    domainsMeasured: ["Alıcı dil", "İfade edici dil", "Erken iletişim", "Dilsel gelişim profili"],
    scoreSystem: "Standart skor, percentil, yaş eşdeğeri ve alıcı/ifade edici dil indeksleri.",
    resultLevels: "Yaş beklentisiyle uyumlu, düşük ortalama, düşük veya alıcı/ifade edici dilde zayıflık.",
    reportUse: "Dilsel talep ve iletişim yükünün görevde kalma, bilişsel organizasyon ve duygusal toleransla ilişkisini açıklar.",
    interpretationBoundaries: "Dil bozukluğu tanısı üretmez; bildirilen resmi sonuç özetini regülasyon bağlamına yerleştirir.",
    dnaRelation: "language_communication mekanizmasını destekler.",
    sourceLinks: ["https://www.pearsonassessments.com/store/en/usd/p/100000233.html"],
    evidenceTier: "official_metadata",
  }),
  sensory_profile_2: profile({
    ageRange: "Doğumdan 14 yaş 11 aya kadar duyusal işlemleme ve günlük yaşam etkileri.",
    domainsMeasured: ["Duyusal işlemleme", "Duyusal hassasiyet, kaçınma, düşük kayıt ve yanıt örüntüleri", "Davranışsal ve günlük yaşam etkileri"],
    scoreSystem: "Normatif kategori/T skor temelli profil ve duyusal örüntü sınıflamaları.",
    resultLevels: "Beklenen aralık, beklenenden daha fazla/daha az duyusal yanıt veya klinik olarak anlamlı örüntü.",
    reportUse: "Çevresel uyaran yükünün katılım, görev sürdürme ve duygusal toparlanmaya etkisini açıklar.",
    interpretationBoundaries: "Duyusal tanı veya nedensellik üretmez; bağlama duyarlı destekleyici veri olarak kalır.",
    dnaRelation: "Duyusal işlemleme ile duyusal-duygusal formülasyonu destekler.",
    sourceLinks: ["https://www.pearsonassessments.com/store/usassessments/en/p/sensory-profile-2/100000822"],
    evidenceTier: "official_metadata",
  }),
  sipt: profile({
    ageRange: "4 yaş-8 yaş 11 ay aralığında duyusal bütünleme ve praksi test bataryası.",
    domainsMeasured: ["Praksi", "Somatodispraksi", "Duyusal bütünleme", "Beden organizasyonu", "Motor planlama"],
    scoreSystem: "Alt test standart skorları ve praksi/duyusal bütünleme profil özetleri.",
    resultLevels: "Yaş beklentisiyle uyumlu, düşük performans veya praksi/duyusal bütünleme alanında klinik zayıflık.",
    reportUse: "Motor planlama, beden organizasyonu ve yeni hareket örüntüsü kurma yükünü ana mekanizma düzeyinde açıklar.",
    interpretationBoundaries: "Tek başına tanı veya müdahale protokolü üretmez; yaş uyumu zorunlu kontrol edilir.",
    dnaRelation: "Motor planlama ve praksi yorumunu güçlü biçimde destekler.",
    sourceLinks: ["https://www.wpspublish.com/sipt-sensory-integration-and-praxis-tests"],
    evidenceTier: "official_metadata",
  }),
  spm2: profile({
    ageRange: "4 aydan yetişkinliğe kadar çoklu ortam duyusal işlemleme değerlendirmesi.",
    domainsMeasured: ["Duyusal işlemleme", "Praksi ve sosyal katılım", "Ev/okul/topluluk bağlamları"],
    scoreSystem: "T skorları, alan düzeyi sınıflamalar ve ortamlar arası duyusal profil.",
    resultLevels: "Tipik, orta düzey zorluk, belirgin zorluk veya alan/ortam bazlı duyusal-praksi yük.",
    reportUse: "Duyusal yükün farklı ortamlarda katılım ve davranış organizasyonunu nasıl değiştirdiğini açıklar.",
    interpretationBoundaries: "Duyusal neden-sonuç veya tanı dili üretmez; ortamlar arası bağlam verisidir.",
    dnaRelation: "Duyusal işlemleme ile motor planlama ve praksiye ilişkin ikincil bağlamı destekler.",
    sourceLinks: ["https://www.wpspublish.com/spm-2"],
    evidenceTier: "official_metadata",
  }),
  srs2: profile({
    ageRange: "2 yaş 5 aydan 18 yaşa kadar sosyal yanıtlılık/sosyal iletişim derecelendirmesi.",
    domainsMeasured: ["Sosyal farkındalık", "Sosyal biliş", "Sosyal iletişim", "Sosyal motivasyon", "Kısıtlı/tekrarlayıcı davranışlar"],
    scoreSystem: "T skorları ve toplam/alt ölçek klinik yükselme düzeyleri.",
    resultLevels: "Beklenen aralık, hafif/orta/ağır sosyal iletişim yükü veya klinik yükselme.",
    reportUse: "Sosyal talep ve karşılıklılık arttığında regülasyon yükünün nasıl belirginleştiğini bağlamsallaştırır.",
    interpretationBoundaries: "Otizm tanısı üretmez; sosyal-pragmatik bağlam verisi olarak kullanılır.",
    dnaRelation: "Sosyal-pragmatik taleple dilsel talebin birlikte yorumlanmasını destekler.",
    sourceLinks: ["https://www.wpspublish.com/srs-2-social-responsiveness-scale-second-edition"],
    evidenceTier: "official_metadata",
  }),
  vineland3: profile({
    ageRange: "Doğumdan 90 yaşa kadar uyumsal davranış değerlendirmesi.",
    domainsMeasured: ["İletişim", "Günlük yaşam becerileri", "Sosyalleşme", "Motor beceriler", "Maladaptif davranışlar"],
    scoreSystem: "Adaptive Behavior Composite, alan standart skorları, V-scale/alt alan ve percentil özetleri.",
    resultLevels: "Yaş beklentisiyle uyumlu, düşük ortalama, düşük veya uyumsal işlevsellikte belirgin zayıflık.",
    reportUse: "Regülasyon profilinin günlük yaşam, iletişim ve sosyalleşme işlevlerine nasıl yansıdığını gösterir.",
    interpretationBoundaries: "Uyumsal davranış sonucu DNA skorunu değiştirmez; tanı ya da destek planı yerine geçmez.",
    dnaRelation: "Günlük yaşam becerileriyle sosyal-pragmatik işlevi ve korunmuş alanları birlikte yorumlamaya katkı sağlar.",
    sourceLinks: ["https://www.pearsonassessments.com/store/en/usd/p/100001622"],
    evidenceTier: "official_metadata",
  }),
}

export const SUPPORTED_EXTERNAL_TESTS: ExternalTestDefinition[] = SUPPORTED_EXTERNAL_TESTS_BASE
  .map((test) => ({
    ...test,
    ...EXTERNAL_TEST_SCIENTIFIC_PROFILES[test.id],
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "tr"))

function cleanText(value: unknown): string {
  if (value === null || value === undefined) return ""
  return String(value).replace(/\s+/g, " ").trim()
}

function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ç]/g, "c")
    .replace(/[ğ]/g, "g")
    .replace(/[ı]/g, "i")
    .replace(/[ö]/g, "o")
    .replace(/[ş]/g, "s")
    .replace(/[ü]/g, "u")
    .replace(/[^a-z0-9]/g, "")
}

function parseExternalFindingEntries(rawValue: unknown): ExternalTestFindingEntry[] {
  const raw = String(rawValue || "").replace(/\r/g, "\n").trim()
  if (!raw) return []

  const blocks = raw
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean)

  return blocks
    .map((block) => {
      const entry: ExternalTestFindingEntry = {
        testName: "",
        result: "",
        interpretation: "",
        notes: "",
      }

      for (const line of block.split("\n")) {
        const cleanLine = line.trim()
        if (!cleanLine.includes(":")) continue
        const [rawLabel, ...rest] = cleanLine.split(":")
        const label = normalizeLabel(rawLabel)
        const value = cleanText(rest.join(":"))
        if (!value) continue

        if (/testadi|testadı/.test(label)) entry.testName = value
        else if (/puansonuc|puan|sonuc/.test(label)) entry.result = value
        else if (/klinikyorumresmibulguozeti|klinikyorum|resmibulguozeti/.test(label)) entry.interpretation = value
        else if (/eknotlar|notlar|eknot/.test(label)) entry.notes = value
      }

      return entry
    })
    .filter((entry) => entry.testName || entry.result || entry.interpretation || entry.notes)
}

function classifyResultQuality(entry?: ExternalTestFindingEntry): ExternalTestMatch["resultQuality"] {
  if (!entry || (!entry.result && !entry.interpretation && !entry.notes)) return "missing_result"
  const combined = [entry.result, entry.interpretation, entry.notes].filter(Boolean).join(" ")
  const hasOnlyNumericResult = Boolean(entry.result) && /^[\d\s.,/%+-]+$/.test(entry.result.trim()) && !entry.interpretation
  if (hasOnlyNumericResult) return "ham_puan_only"
  if (
    /ham puan/i.test(combined) &&
    /(t skoru|standart skor|standart skoru|percentil|scaled score|resmi yorum|normatif).{0,80}(verilmemiş|verilmemis|yok|bulunmuyor|bildirilmemiş|bildirilmemis)/i.test(combined)
  ) {
    return "ham_puan_only"
  }
  if (!/\d/.test(combined) && !entry.result && (entry.interpretation || entry.notes)) return "qualitative_only"
  return "interpretable"
}

function classifyResultDirection(entry?: ExternalTestFindingEntry): ExternalTestMatch["resultDirection"] {
  const resultText = String(entry?.result || "").toLocaleLowerCase("tr-TR")
  const text = [entry?.result, entry?.interpretation, entry?.notes].filter(Boolean).join(" ").toLocaleLowerCase("tr-TR")
  if (!text) return "unclear"
  const lowSignal =
    /düşük|dusuk|beklenti(?:si|sinin)?\s*alt|yaş beklentisi(?:nin)?\s*alt|yas beklentisi(?:nin)?\s*alt|klinik\s*(?:yüksel|yuksel|düzey|duzey|aralık|aralik)|yüksel|yuksel|yükseklik|yukseklik|zorl|güçlük|gucluk|risk|sınır(?!lı|lilik|liliği)|sinir(?!li|lilik|liligi)|atipik/
  const preservedSignal = /korunmuş|korunmus|uyumlu|ortalama|normal|beklenen|tipik|klinik olmayan|eşik altı|esik alti/

  if (resultText && preservedSignal.test(resultText) && !lowSignal.test(resultText)) {
    return "expected_or_preserved"
  }

  if (preservedSignal.test(text)) {
    if (lowSignal.test(text)) return "mixed_or_contextual"
    return "expected_or_preserved"
  }
  if (lowSignal.test(text)) {
    return "elevated_or_low"
  }
  return "unclear"
}

function hasDecisionWeight(match: Pick<ExternalTestMatch, "ageCompatible" | "resultQuality" | "resultDirection">): boolean {
  return (
    match.ageCompatible === true &&
    match.resultQuality === "interpretable" &&
    (match.resultDirection === "elevated_or_low" || match.resultDirection === "mixed_or_contextual")
  )
}

function calculateExternalEvidenceWeight(
  test: ExternalTestDefinition,
  match: Pick<ExternalTestMatch, "ageCompatible" | "resultQuality" | "resultDirection">
): Pick<ExternalTestMatch, "externalEvidenceWeight" | "externalEvidenceWeightLabel"> {
  if (match.ageCompatible === false) return { externalEvidenceWeight: 0, externalEvidenceWeightLabel: "none" }
  if (match.resultQuality === "missing_result") return { externalEvidenceWeight: 0, externalEvidenceWeightLabel: "none" }
  if (match.resultQuality === "ham_puan_only") return { externalEvidenceWeight: 10, externalEvidenceWeightLabel: "limited" }
  if (match.resultQuality === "qualitative_only") return { externalEvidenceWeight: 18, externalEvidenceWeightLabel: "limited" }

  const ageWeight = match.ageCompatible === true ? 25 : 10
  const scoreSystem = test.scoreSystem.toLocaleLowerCase("tr-TR")
  const scoreWeight = /standart|standard|t skoru|scaled|percentil|irt|composite|bileşik|bilesik/.test(scoreSystem) ? 25 : 12
  const tierWeight = test.evidenceTier === "official_and_literature_supported" ? 20 : 14
  const directionWeight =
    match.resultDirection === "elevated_or_low"
      ? 25
      : match.resultDirection === "mixed_or_contextual"
      ? 18
      : match.resultDirection === "expected_or_preserved"
      ? 16
      : 8
  const domainWeight = test.domainsMeasured.length ? 10 : 4
  const weight = Math.max(0, Math.min(100, ageWeight + scoreWeight + tierWeight + directionWeight + domainWeight))
  const label =
    match.resultDirection === "expected_or_preserved"
      ? "balancing"
      : weight >= 80
      ? "strong"
      : weight >= 50
      ? "moderate"
      : weight > 0
      ? "limited"
      : "none"
  return { externalEvidenceWeight: weight, externalEvidenceWeightLabel: label }
}

function findEntryForTest(test: ExternalTestDefinition, entries: ExternalTestFindingEntry[]): ExternalTestFindingEntry | undefined {
  return entries.find((entry) => {
    const name = entry.testName || [entry.result, entry.interpretation, entry.notes].join(" ")
    return Boolean(name) && (test.name.toLowerCase() === name.toLowerCase() || test.aliases.some((pattern) => pattern.test(name)))
  })
}

function getMentionPosition(text: string, test: ExternalTestDefinition): number {
  const positions = test.aliases
    .map((pattern) => text.search(pattern))
    .filter((position) => position >= 0)

  return positions.length ? Math.min(...positions) : Number.MAX_SAFE_INTEGER
}

export function findSupportedExternalTestByName(rawName: unknown): ExternalTestDefinition | null {
  const clean = cleanText(rawName)
  if (!clean) return null
  return (
    SUPPORTED_EXTERNAL_TESTS.find(
      (test) => test.name.toLowerCase() === clean.toLowerCase() || test.aliases.some((pattern) => pattern.test(clean))
    ) || null
  )
}

export function getExternalTestDefinitionById(testId: string): ExternalTestDefinition | null {
  return SUPPORTED_EXTERNAL_TESTS.find((test) => test.id === testId) || null
}

export function getExternalTestResultHint(testId?: string | null): string {
  switch (testId) {
    case "sipt":
      return "Alt test adı, standard skor veya resmi özet düzey yazılabilir. Ornek: Praxis alt testlerinde düşük performans."
    case "spm2":
    case "sensory_profile_2":
      return "T score, kategori veya özet profil yazılabilir. Ornek: duyusal arayış yüksek, beden farkındalığı düşük."
    case "brief_p":
    case "brief2":
    case "conners_ec":
    case "conners4":
    case "basc3":
      return "T score, klinik yükselme düzeyi veya resmi ölçek özeti yazılabilir."
    case "abas3":
    case "vineland3":
    case "pedi_cat":
      return "Standart skor, percentile veya alan bazlı özet düzey yazılabilir."
    case "bot2":
    case "dcdq07":
    case "beery_vmi":
    case "mabc3":
    case "mfun":
    case "pdms3":
      return "Standart skor, percentile veya motor yeterlilik düzeyi yazılabilir."
    case "celf_preschool3":
    case "pls5":
      return "Standart skor, alt test özeti, percentile veya alıcı/ifade edici dil düzeyi yazılabilir."
    case "srs2":
    case "ccc2":
      return "Toplam skor, T score veya resmi yorum düzeyi yazılabilir."
    case "dayc2":
      return "Alan bazlı gelişim düzeyi veya standart skor yazılabilir."
    default:
      return "Ham puan tek başına yeterli değildir; mümkünse testin resmi yorum düzeyini de ekleyin."
  }
}

export function getExternalTestInterpretationHint(testId?: string | null): string {
  switch (testId) {
    case "sipt":
      return "Praksi, somatodispraksi, motor planlama veya beden organizasyonu açısından klinik anlamı yaz."
    case "spm2":
    case "sensory_profile_2":
      return "Duyusal işlemleme örüntüsünün günlük yaşama yansımasını ve hangi sistemlerin öne çıktığını yaz."
    case "brief_p":
    case "brief2":
    case "conners_ec":
    case "conners4":
    case "basc3":
      return "Dikkat, dürtüsellik, duygusal kontrol veya yürütücü işlev açısından klinik anlamını yaz."
    case "abas3":
    case "vineland3":
    case "pedi_cat":
      return "Uyumsal davranış, günlük yaşam becerileri veya katılım düzeyi açısından anlamını yaz."
    case "bot2":
    case "dcdq07":
    case "beery_vmi":
    case "mabc3":
    case "mfun":
    case "pdms3":
      return "Motor koordinasyon, beden organizasyonu veya görev performansı açısından anlamını yaz."
    case "celf_preschool3":
    case "pls5":
      return "Alıcı-ifade edici dil, yönerge takibi, sınıf dili veya iletişim örüntüsü açısından klinik anlamı yaz."
    case "srs2":
    case "ccc2":
      return "Sosyal iletişim, pragmatik dil veya sosyal farkındalık açısından klinik anlamı yaz."
    case "dayc2":
      return "Gelişimsel profil açısından hangi alanların öne çıktığını yaz."
    default:
      return "Test sonucunun klinik anlamını kısa ve net biçimde yaz. Sadece ham puanı bırakma."
  }
}

function dedupeMatches(matches: ExternalTestMatch[]): ExternalTestMatch[] {
  const seen = new Set<string>()
  return matches.filter((match) => {
    if (seen.has(match.id)) return false
    seen.add(match.id)
    return true
  })
}

function formatAgeMonths(months: number): string {
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (rest === 0) return `${years} yaş`
  return `${years} yaş ${rest} ay`
}

export function getExternalTestCategory(testId: string): ExternalTestCategory {
  if (["abas3", "vineland3", "pedi_cat"].includes(testId)) return "adaptive_daily_living"
  if (["brief_p", "brief2", "conners_ec", "conners4", "basc3"].includes(testId)) return "executive_behavior"
  if (["sensory_profile_2", "spm2"].includes(testId)) return "sensory_processing"
  if (["sipt", "pdms3", "bot2", "mabc3", "mfun", "dcdq07", "beery_vmi"].includes(testId)) return "motor_praxis"
  if (["celf_preschool3", "pls5"].includes(testId)) return "language_communication"
  if (["ccc2", "srs2"].includes(testId)) return "social_pragmatic"
  if (["dayc2"].includes(testId)) return "development_general"
  return "general"
}

function getShortSupportText(testId: string): string {
  switch (testId) {
    case "abas3":
    case "vineland3":
    case "pedi_cat":
      return "uyumsal davranış, günlük yaşam akışı ve katılım örüntülerine ilişkin destekleyici veri sağlar"
    case "brief_p":
    case "brief2":
    case "conners_ec":
    case "conners4":
    case "basc3":
      return "dikkat, dürtü kontrolü, duygusal düzenleme ve yürütücü işlev örüntüsünü destekleyici veri sağlar"
    case "sensory_profile_2":
    case "spm2":
      return "duyusal yük, çevresel uyaran işleme ve bağlama duyarlı performans değişimini destekleyici veri sağlar"
    case "sipt":
    case "pdms3":
    case "bot2":
    case "mabc3":
    case "mfun":
    case "dcdq07":
    case "beery_vmi":
      return "motor planlama, beden organizasyonu ve görev performansı örüntüsünü destekleyici veri sağlar"
    case "celf_preschool3":
    case "pls5":
      return "dilsel talep, anlama-ifade ve sözel yük altında performans örüntüsünü destekleyici veri sağlar"
    case "ccc2":
    case "srs2":
      return "sosyal-pragmatik iletişim ve karşılıklı etkileşim yükünü destekleyici veri sağlar"
    case "dayc2":
      return "gelişimsel alanların genel örüntüsünü destekleyici veri sağlar"
    default:
      return "klinik yoruma destekleyici veri sağlar"
  }
}

function getSpecificNarrativeText(testId: string): string {
  switch (testId) {
    case "abas3":
    case "vineland3":
      return "uyumsal davranış ve günlük yaşam becerilerinin günlük akış içinde ne ölçüde sürdürülebildiğine ilişkin daha somut bağlam sağlamaktadır"
    case "pedi_cat":
      return "günlük işlevsellik ve katılımın doğal rutinler içinde nasıl organize edildiğine ilişkin somut bağlam sunmaktadır"
    case "brief_p":
    case "brief2":
      return "yürütücü düzenleme yükünün özellikle inhibisyon, geçiş ve görev sürdürme ekseninde nasıl belirginleştiğine ilişkin destekleyici kanıt sunmaktadır"
    case "conners_ec":
    case "conners4":
      return "dikkat sürdürme, dürtüsellik ve davranışsal organizasyon güçlüğünün bağlamsal biçimini görünür kılmaktadır"
    case "basc3":
      return "davranışsal ve duygusal düzenleme güçlüğünün yalnız gözlemsel değil derecelendirme temelli karşılığını da göstermektedir"
    case "sensory_profile_2":
    case "spm2":
      return "çevresel uyaran yükünün performans ve davranış üzerinde nasıl dalgalanma yarattığına ilişkin test temelli bağlam sağlamaktadır"
    case "sipt":
      return "praksi, motor planlama ve beden organizasyonu eksenindeki zorlanmanın davranış organizasyonuna yansımasını desteklemektedir"
    case "pdms3":
    case "bot2":
    case "mabc3":
    case "mfun":
    case "dcdq07":
    case "beery_vmi":
      return "motor koordinasyon, sekanslama ve görev uygulama kapasitesinin günlük performansla ilişkisini daha görünür kılmaktadır"
    case "celf_preschool3":
    case "pls5":
      return "dilsel talep arttığında anlama, ifade ve görev yükünün nasıl değiştiğine ilişkin açıklayıcı bağlam sunmaktadır"
    case "ccc2":
    case "srs2":
      return "sosyal-pragmatik iletişim yükünün sosyal etkileşim ve düzenleme süreçlerine nasıl eşlik ettiğini desteklemektedir"
    case "dayc2":
      return "gelişim alanlarının geniş örüntüsünü regülasyon yorumuna bağlamak için destekleyici çerçeve sağlamaktadır"
    default:
      return "klinik örüntüyü destekleyen ek değerlendirme bağlamı sunmaktadır"
  }
}

function buildSynthesisLines(compatible: ExternalTestMatch[]): string[] {
  const ids = compatible.map((match) => match.id)
  const categoryCounts = new Map<string, number>()
  for (const id of ids) {
    const category = getExternalTestCategory(id)
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1)
  }

  const lines: string[] = []

  if ((categoryCounts.get("adaptive_daily_living") || 0) >= 2) {
    lines.push("Uyumsal davranış ve günlük yaşam becerilerine ilişkin birden fazla test, yükün genel kapasiteden çok öz bakım, günlük rutinleri başlatma ve bu rutinleri sürdürme ekseninde toplandığını desteklemektedir.")
  }
  if ((categoryCounts.get("executive_behavior") || 0) >= 2) {
    lines.push("Dikkat, inhibisyon ve yürütücü düzenleme alanlarına ilişkin birden fazla test, çekirdek yükün görev sürdürme ve davranış kontrolü ekseninde toplandığını desteklemektedir.")
  }
  if ((categoryCounts.get("sensory_processing") || 0) >= 2) {
    lines.push("Duyusal işlemleme örüntüsüne ilişkin birden fazla test, çevresel uyaran yükünün performans dalgalanmasıyla ilişkili olduğunu tutarlı biçimde desteklemektedir.")
  }
  if ((categoryCounts.get("motor_praxis") || 0) >= 2) {
    lines.push("Motor planlama ve beden organizasyonuna ilişkin birden fazla test, praksi temelli zorlanmanın görev organizasyonu ve katılımı etkilediğini düşündürmektedir.")
  }
  if ((categoryCounts.get("language_communication") || 0) >= 2) {
    lines.push("Dilsel talebe ilişkin birden fazla test, sözel talep ve yönerge karmaşıklığı arttığında anlama, görevde kalma ve engellenmeye dayanma kapasitesinin birlikte zorlandığını desteklemektedir.")
  }
  if ((categoryCounts.get("social_pragmatic") || 0) >= 2) {
    lines.push("Sosyal-pragmatik iletişime ilişkin birden fazla test, karşılıklılık ve sosyal esneklik talepleri arttığında düzenleyici yükün belirginleştiğini desteklemektedir.")
  }

  if (
    (categoryCounts.get("executive_behavior") || 0) >= 1 &&
    (categoryCounts.get("adaptive_daily_living") || 0) >= 1
  ) {
    lines.push("Yürütücü düzenleme ile günlük yaşam becerileri birlikte ele alındığında, güçlüğün yalnız performans kapasitesinden değil bu kapasitenin günlük akışta sürdürülmesinden kaynaklandığı düşünülmektedir.")
  }

  if (
    (categoryCounts.get("motor_praxis") || 0) >= 1 &&
    (categoryCounts.get("executive_behavior") || 0) >= 1
  ) {
    lines.push("Motor planlama ve yürütücü kontrol bulgularının birlikte görülmesi, davranış organizasyonundaki yükün yalnız dikkat değil sekanslama ve uygulama düzleminde de oluştuğunu düşündürmektedir.")
  }

  if (
    (categoryCounts.get("language_communication") || 0) >= 1 &&
    (categoryCounts.get("executive_behavior") || 0) >= 1
  ) {
    lines.push("Dilsel talep ve yürütücü kontrol bulgularının birlikte görünmesi, göreve bağlı zorlanmanın sözel yükle belirginleştiğini düşündürmektedir.")
  }

  return lines.slice(0, 3)
}

function buildDecisionLines(
  compatible: ExternalTestMatch[],
  incompatible: ExternalTestMatch[]
): string[] {
  if (compatible.length > 0 && incompatible.length > 0) {
    return [
      "Yaş aralığıyla uyumlu ve uyumsuz dış testler birlikte bildirilmiştir. Klinik yorum yaşa uygun testlerle desteklenmiştir. Yaş uyumsuz testler yalnız temkinli yan bilgi olarak kayda geçirilmiştir.",
      ...incompatible.slice(0, 1).map(
        (match) =>
          `${match.name} yaş uyumsuz olduğu için ana klinik değerlendirmeyi destekleyen veri olarak kullanılmamıştır.`
      ),
    ].slice(0, 2)
  }

  if (compatible.length === 0 && incompatible.length > 0) {
    return [
      "Bildirilen dış testlerin tümü yaş aralığıyla uyumsuz görünmektedir. Bu nedenle ana klinik yorum skor örüntüsü ve anamnez üzerine kurulmuştur.",
    ]
  }

  return []
}

function getAgeConditionalCautionLine(match: ExternalTestMatch, ageMonths?: number | null): string {
  if (
    match.id === "conners_ec" &&
    typeof ageMonths === "number" &&
    Number.isFinite(ageMonths) &&
    ageMonths >= 72 &&
    ageMonths <= 83
  ) {
    return `${match.name}: 6 yaş bandında Conners EC ile Conners 4 form seçimi okul düzeyi ve uygulama bağlamına göre doğrulanmalıdır; bu nedenle bulgu destekleyici kabul edilir ancak tek başına ana klinik değerlendirmeyi taşımaz.`
  }

  return ""
}

export function formatExternalTestAgeRange(test: Pick<ExternalTestDefinition, "minAgeMonths" | "maxAgeMonths">): string {
  return `${test.minAgeMonths}-${test.maxAgeMonths} ay (${formatAgeMonths(test.minAgeMonths)}-${formatAgeMonths(test.maxAgeMonths)})`
}

export function analyzeExternalClinicalTests(rawText: unknown, ageMonths?: number | null): ExternalTestAnalysis {
  const clean = cleanText(rawText)
  const parsedEntries = parseExternalFindingEntries(rawText)

  if (!clean) {
    return {
      matches: [],
      compatible: [],
      decisionCompatible: [],
      incompatible: [],
      compatibleIds: [],
      compatibleCategories: [],
      decisionCompatibleIds: [],
      decisionCompatibleCategories: [],
      primaryCompatibleCategory: null,
      weightedDecisionSupport: 0,
      validatedSupportLines: [],
      conciseSupportLines: [],
      specificNarrativeLines: [],
      synthesisLines: [],
      warningLines: [],
      decisionLines: [],
      evidenceProfileLines: [],
      qualityFlagLines: [],
      parsedEntries: [],
      mixedValidity: false,
      hasUnrecognizedContent: false,
    }
  }

  const matches = dedupeMatches(
    SUPPORTED_EXTERNAL_TESTS
      .filter((test) => test.aliases.some((pattern) => pattern.test(clean)))
      .sort((a, b) => getMentionPosition(clean, a) - getMentionPosition(clean, b))
      .map((test) => {
        const entry = findEntryForTest(test, parsedEntries)
        const baseMatch = {
          id: test.id,
          name: test.name,
          category: getExternalTestCategory(test.id),
          minAgeMonths: test.minAgeMonths,
          maxAgeMonths: test.maxAgeMonths,
          ageRange: test.ageRange,
          domainsMeasured: test.domainsMeasured,
          scoreSystem: test.scoreSystem,
          resultLevels: test.resultLevels,
          reportUse: test.reportUse,
          interpretationBoundaries: test.interpretationBoundaries,
          dnaRelation: test.dnaRelation,
          sourceLinks: test.sourceLinks,
          evidenceTier: test.evidenceTier,
          sourceTitle: test.sourceTitle,
          sourceUrl: test.sourceUrl,
          supportedUse: test.supportedUse,
          ageCompatible:
            typeof ageMonths === "number" && Number.isFinite(ageMonths)
              ? ageMonths >= test.minAgeMonths && ageMonths <= test.maxAgeMonths
              : null,
          reportedResult: entry?.result,
          reportedInterpretation: entry?.interpretation,
          reportedNotes: entry?.notes,
          resultQuality: classifyResultQuality(entry),
          resultDirection: classifyResultDirection(entry),
        }
        return {
          ...baseMatch,
          ...calculateExternalEvidenceWeight(test, baseMatch),
        }
      })
  )

  const compatible = matches.filter(
    (match) =>
      match.ageCompatible === true &&
      match.resultQuality !== "ham_puan_only" &&
      match.resultQuality !== "missing_result"
  )
  const decisionCompatible = compatible.filter(hasDecisionWeight)
  const incompatible = matches.filter((match) => match.ageCompatible === false)
  const mixedValidity = compatible.length > 0 && incompatible.length > 0
  const compatibleIds = compatible.map((match) => match.id)
  const compatibleCategories = Array.from(new Set(compatible.map((match) => match.category)))
  const decisionCompatibleIds = decisionCompatible.map((match) => match.id)
  const decisionCompatibleCategories = Array.from(new Set(decisionCompatible.map((match) => match.category)))
  const primaryCompatibleCategory = decisionCompatible[0]?.category ?? null
  const weightedDecisionSupport = decisionCompatible.reduce((sum, match) => sum + match.externalEvidenceWeight, 0)

  const conciseSupportLines = compatible.map((match) => {
    return `${match.name}: Bildirilen bulgular ${getShortSupportText(match.id)}.`
  })

  const validatedSupportLines = compatible.map((match) => {
    const ageText =
      typeof ageMonths === "number" && Number.isFinite(ageMonths)
        ? `Mevcut vaka yaşı ${ageMonths} aydır ve bu testin resmi yaş aralığı olan ${formatExternalTestAgeRange(match)} ile uyumludur.`
        : `Bu testin resmi yaş aralığı ${formatExternalTestAgeRange(match)} olarak görünmektedir.`
    return `${match.name}: ${ageText} Bildirilen bulgular ${getShortSupportText(match.id)}.`
  })

  const specificNarrativeLines = compatible.map((match) => {
    return `${match.name} bulguları ${getSpecificNarrativeText(match.id)}.`
  })

  const warningLines = incompatible.map((match) => {
    const ageText =
      typeof ageMonths === "number" && Number.isFinite(ageMonths)
        ? `Mevcut vaka yaşı ${ageMonths} aydır`
        : "Mevcut vaka yaşı belirlenemediği için"
    return `${match.name}: ${ageText}; bu testin resmi yaş aralığı ${formatExternalTestAgeRange(match)} görünmektedir. Bu bulgu ana klinik değerlendirmeyi desteklemez; yalnız temkinli yan bilgi olarak kayda geçirilmiştir. Kaynak: ${match.sourceTitle}.`
  })
  const ageConditionalCautionLines = matches
    .map((match) => getAgeConditionalCautionLine(match, ageMonths))
    .filter(Boolean)

  const synthesisLines = buildSynthesisLines(decisionCompatible)
  const decisionLines = buildDecisionLines(decisionCompatible, incompatible)
  const evidenceProfileLines = matches.map((match) => {
    const ageText =
      match.ageCompatible === true
        ? "yaş uyumlu"
        : match.ageCompatible === false
        ? "yaş uyumsuz"
        : "yaş uyumu belirsiz"
    const resultText = match.reportedResult
      ? `Bildirilen sonuç: ${match.reportedResult}.`
      : "Bildirilen sonuç alanı yapılandırılmış biçimde yakalanmadı."
    const hasReportedScore = Boolean(match.reportedResult?.match(
      /(?:t\s*skor(?:u)?|standart skor|ölçek puanı|ham puan|skor|puan|persentil|percentil)\s*(?:[:=]?\s*)?[-+]?\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)?/i
    ))
    const scoreText = hasReportedScore
      ? "Bildirilen puan: Sayısal değer sonuç alanında yer almaktadır."
      : "Bildirilen puan: Ayrı bir sayısal puan girilmedi."
    const relation =
      match.ageCompatible === false
        ? "Bu bulgu ana klinik değerlendirmeyi desteklemez; yalnız temkinli yan bilgi olarak kayda geçirilir."
      : match.resultQuality === "ham_puan_only"
        ? "Ham puan tek başına yorum gücünü sınırlar; resmi yorum düzeyi olmadan ana klinik değerlendirmeyi destekleyen veri sayılmaz."
        : match.resultDirection === "expected_or_preserved"
        ? "Korunmuş/yaş uyumlu sonuç, raporda risk büyütmek yerine işlevsel denge kanıtı olarak kullanılır."
        : match.dnaRelation
    return `${match.name}: ${ageText}; resmi kullanım aralığı ${match.ageRange}. Ölçtüğü alanlar: ${match.domainsMeasured.slice(0, 4).join(", ")}. ${scoreText} ${resultText} Rapor ilişkisi: ${relation} Yorum sınırı: ${match.interpretationBoundaries}`.replace(/\.\s*\./g, ".")
  })
  const qualityFlagLines = [
    ...ageConditionalCautionLines,
    ...matches
      .map((match) => {
        if (match.ageCompatible === false) {
          return `${match.name}: yaş uyumsuz olduğu için ana klinik değerlendirmeyi destekleyen veri olarak kullanılmamıştır.`
        }
        if (match.resultQuality === "ham_puan_only") {
          return `${match.name}: yalnız ham puan bildirildi; resmi yorum düzeyi olmadığı için klinik çıkarım temkinli tutuldu.`
        }
        if (match.resultQuality === "missing_result") {
          return `${match.name}: sonuç/yorum alanı eksik olduğu için test yalnız ad düzeyinde destekleyici bağlam olarak kaldı.`
        }
        return ""
      })
      .filter(Boolean),
  ]

  return {
    matches,
    compatible,
    decisionCompatible,
    incompatible,
    compatibleIds,
    compatibleCategories,
    decisionCompatibleIds,
    decisionCompatibleCategories,
    primaryCompatibleCategory,
    weightedDecisionSupport,
    validatedSupportLines,
    conciseSupportLines,
    specificNarrativeLines,
    synthesisLines,
    warningLines: [...warningLines, ...ageConditionalCautionLines],
    decisionLines,
    evidenceProfileLines,
    qualityFlagLines,
    parsedEntries,
    mixedValidity,
    hasUnrecognizedContent: matches.length === 0 && clean.length > 0,
  }
}

export type ExternalTestCategory =
  | "adaptive_daily_living"
  | "development_general"
  | "executive_behavior"
  | "general"
  | "language_communication"
  | "motor_praxis"
  | "sensory_processing"
  | "social_pragmatic"

export type ExternalTestDefinition = {
  id: string
  name: string
  aliases: RegExp[]
  minAgeMonths: number
  maxAgeMonths: number
  sourceTitle: string
  sourceUrl: string
  supportedUse: string
}

export type ExternalTestMatch = {
  id: string
  name: string
  category: ExternalTestCategory
  minAgeMonths: number
  maxAgeMonths: number
  sourceTitle: string
  sourceUrl: string
  supportedUse: string
  ageCompatible: boolean | null
}

export type ExternalTestAnalysis = {
  matches: ExternalTestMatch[]
  compatible: ExternalTestMatch[]
  incompatible: ExternalTestMatch[]
  compatibleIds: string[]
  compatibleCategories: ExternalTestCategory[]
  primaryCompatibleCategory: ExternalTestCategory | null
  validatedSupportLines: string[]
  conciseSupportLines: string[]
  specificNarrativeLines: string[]
  synthesisLines: string[]
  warningLines: string[]
  decisionLines: string[]
  mixedValidity: boolean
  hasUnrecognizedContent: boolean
}

export const SUPPORTED_EXTERNAL_TESTS: ExternalTestDefinition[] = [
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
    maxAgeMonths: 71,
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
    minAgeMonths: 1,
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
    minAgeMonths: 30,
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
].sort((a, b) => a.name.localeCompare(b.name, "tr"))

function cleanText(value: unknown): string {
  if (value === null || value === undefined) return ""
  return String(value).replace(/\s+/g, " ").trim()
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
    lines.push("Dilsel talebe ilişkin birden fazla test, sözel yük ve yönerge karmaşıklığı arttığında anlama, görevde kalma ve frustrasyon toleransının birlikte zorlandığını desteklemektedir.")
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
      "Yaş aralığıyla uyumlu ve uyumsuz dış testler birlikte bildirilmiştir. Klinik yorum yalnız yaşa uygun testlerle güçlendirilmiş; yaş uyumsuz testler ana klinik karar mekanizmasına dahil edilmemeli ve yalnız temkinli yan bilgi olarak bırakılmalıdır.",
      ...incompatible.slice(0, 1).map(
        (match) =>
          `${match.name} yaş uyumsuzluğu nedeniyle karar ağırlığını artırmak için kullanılmamıştır.`
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

export function formatExternalTestAgeRange(test: Pick<ExternalTestDefinition, "minAgeMonths" | "maxAgeMonths">): string {
  return `${test.minAgeMonths}-${test.maxAgeMonths} ay (${formatAgeMonths(test.minAgeMonths)}-${formatAgeMonths(test.maxAgeMonths)})`
}

export function analyzeExternalClinicalTests(rawText: unknown, ageMonths?: number | null): ExternalTestAnalysis {
  const clean = cleanText(rawText)

  if (!clean) {
    return {
      matches: [],
      compatible: [],
      incompatible: [],
      compatibleIds: [],
      compatibleCategories: [],
      primaryCompatibleCategory: null,
      validatedSupportLines: [],
      conciseSupportLines: [],
      specificNarrativeLines: [],
      synthesisLines: [],
      warningLines: [],
      decisionLines: [],
      mixedValidity: false,
      hasUnrecognizedContent: false,
    }
  }

  const matches = dedupeMatches(
    SUPPORTED_EXTERNAL_TESTS
      .filter((test) => test.aliases.some((pattern) => pattern.test(clean)))
      .sort((a, b) => getMentionPosition(clean, a) - getMentionPosition(clean, b))
      .map((test) => ({
        id: test.id,
        name: test.name,
        category: getExternalTestCategory(test.id),
        minAgeMonths: test.minAgeMonths,
        maxAgeMonths: test.maxAgeMonths,
        sourceTitle: test.sourceTitle,
        sourceUrl: test.sourceUrl,
        supportedUse: test.supportedUse,
        ageCompatible:
          typeof ageMonths === "number" && Number.isFinite(ageMonths)
            ? ageMonths >= test.minAgeMonths && ageMonths <= test.maxAgeMonths
            : null,
      }))
  )

  const compatible = matches.filter((match) => match.ageCompatible === true)
  const incompatible = matches.filter((match) => match.ageCompatible === false)
  const mixedValidity = compatible.length > 0 && incompatible.length > 0
  const compatibleIds = compatible.map((match) => match.id)
  const compatibleCategories = Array.from(new Set(compatible.map((match) => match.category)))
  const primaryCompatibleCategory = compatible[0]?.category ?? null

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
    return `${match.name}: ${ageText}; bu testin resmi yaş aralığı ${formatExternalTestAgeRange(match)} görünmektedir. Bu nedenle dış test bulgusu ana klinik karar mekanizmasına dahil edilmemeli, en fazla temkinli yan bilgi olarak ele alınmalıdır. Kaynak: ${match.sourceTitle}.`
  })

  const synthesisLines = buildSynthesisLines(compatible)
  const decisionLines = buildDecisionLines(compatible, incompatible)

  return {
    matches,
    compatible,
    incompatible,
    compatibleIds,
    compatibleCategories,
    primaryCompatibleCategory,
    validatedSupportLines,
    conciseSupportLines,
    specificNarrativeLines,
    synthesisLines,
    warningLines,
    decisionLines,
    mixedValidity,
    hasUnrecognizedContent: matches.length === 0 && clean.length > 0,
  }
}

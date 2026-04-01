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
  validatedSupportLines: string[]
  warningLines: string[]
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

export function findSupportedExternalTestByName(rawName: unknown): ExternalTestDefinition | null {
  const clean = cleanText(rawName)
  if (!clean) return null
  return (
    SUPPORTED_EXTERNAL_TESTS.find(
      (test) => test.name.toLowerCase() === clean.toLowerCase() || test.aliases.some((pattern) => pattern.test(clean))
    ) || null
  )
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
      validatedSupportLines: [],
      warningLines: [],
      hasUnrecognizedContent: false,
    }
  }

  const matches = dedupeMatches(
    SUPPORTED_EXTERNAL_TESTS
      .filter((test) => test.aliases.some((pattern) => pattern.test(clean)))
      .map((test) => ({
        id: test.id,
        name: test.name,
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

  const validatedSupportLines = compatible.map((match) => {
    const ageText =
      typeof ageMonths === "number" && Number.isFinite(ageMonths)
        ? `Mevcut vaka yaşı ${ageMonths} aydır ve bu testin resmi yaş aralığı olan ${formatExternalTestAgeRange(match)} ile uyumludur.`
        : `Bu testin resmi yaş aralığı ${formatExternalTestAgeRange(match)} olarak görünmektedir.`
    return `${match.name}: ${ageText} Bildirilen bulgular ${match.supportedUse}. Kaynak: ${match.sourceTitle}.`
  })

  const warningLines = incompatible.map((match) => {
    const ageText =
      typeof ageMonths === "number" && Number.isFinite(ageMonths)
        ? `Mevcut vaka yaşı ${ageMonths} aydır`
        : "Mevcut vaka yaşı belirlenemediği için"
    return `${match.name}: ${ageText}; bu testin resmi yaş aralığı ${formatExternalTestAgeRange(match)} görünmektedir. Bu nedenle dış test bulgusu ana klinik karar mekanizmasına dahil edilmemeli, en fazla temkinli yan bilgi olarak ele alınmalıdır. Kaynak: ${match.sourceTitle}.`
  })

  return {
    matches,
    compatible,
    incompatible,
    validatedSupportLines,
    warningLines,
    hasUnrecognizedContent: matches.length === 0 && clean.length > 0,
  }
}

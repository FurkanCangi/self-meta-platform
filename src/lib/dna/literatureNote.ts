export const LITERATURE_SECTION_HEADING = "8. Literatürle Uyumlu Klinik Dayanak"

import {
  getExternalTestDefinitionById,
  type ExternalTestCategory,
} from "./externalTestRegistry"

type ClinicalAnalysis = {
  globalLevel: string
  profileType: string
  weakDomains?: string[]
  strongDomains?: string[]
  matchedDomains?: string[]
  primaryWeakDomain?: string
  anamnezConsistency?: string
  contrastSummary?: string
  therapistInsights?: string[]
  externalClinicalFindings?: string[]
  externalTestIds?: string[]
  externalTestCategories?: ExternalTestCategory[]
  primaryExternalTestCategory?: ExternalTestCategory | null
}

export type LiteratureSource = {
  id: string
  inlineCitation: string
  apaReference: string
  doi: string | null
  url: string
  evidenceDomain: string
  claimBoundary: string
  verifiedAt: string
  catalogArea?: string
  catalogTier?: "core" | "supporting"
}

type LiteratureBlock = {
  text: string
  sourceIds: string[]
}

export const VERIFIED_LITERATURE_SOURCES: Record<string, LiteratureSource> = {
  BLAIR_RAVER_2015: {
    id: "BLAIR_RAVER_2015",
    inlineCitation: "(Blair & Raver, 2015)",
    apaReference:
      "Blair, C., & Raver, C. C. (2015). School readiness and self-regulation: A developmental psychobiological approach. Annual Review of Psychology, 66, 711-731. https://doi.org/10.1146/annurev-psych-010814-015221",
    doi: "10.1146/annurev-psych-010814-015221",
    url: "https://doi.org/10.1146/annurev-psych-010814-015221",
    evidenceDomain: "developmental_self_regulation",
    claimBoundary:
      "Self-regülasyonun çok bileşenli gelişimsel yapı olarak yorumlanmasını destekler; tek vaka için tanı veya tedavi protokolü çıkarımı sağlamaz.",
    verifiedAt: "2026-06-01",
  },
  CARPENTER_ET_AL_2019: {
    id: "CARPENTER_ET_AL_2019",
    inlineCitation: "(Carpenter et al., 2019)",
    apaReference:
      "Carpenter, K. L. H., Baranek, G. T., Copeland, W. E., Compton, S., Zucker, N., Dawson, G., & Egger, H. L. (2019). Sensory over-responsivity: An early risk factor for anxiety and behavioral challenges in young children. Journal of Abnormal Child Psychology, 47(6), 1075-1088. https://doi.org/10.1007/s10802-018-0502-y",
    doi: "10.1007/s10802-018-0502-y",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6508996/",
    evidenceDomain: "sensory_over_responsivity",
    claimBoundary:
      "Duyusal aşırı yanıtlılık ile davranışsal/duygusal zorluk ilişkisini genel düzeyde destekler; duyusal tanı veya nedensellik hükmü üretmez.",
    verifiedAt: "2026-06-01",
    catalogArea: "Duyusal Regülasyon",
    catalogTier: "core",
  },
  BEN_SASSON_ET_AL_2009: {
    id: "BEN_SASSON_ET_AL_2009",
    inlineCitation: "(Ben-Sasson et al., 2009)",
    apaReference:
      "Ben-Sasson, A., Hen, L., Fluss, R., Cermak, S. A., Engel-Yeger, B., & Gal, E. (2009). A meta-analysis of sensory modulation symptoms in individuals with autism spectrum disorders. Journal of Autism and Developmental Disorders, 39, 1-11. https://doi.org/10.1007/s10803-008-0593-3",
    doi: "10.1007/s10803-008-0593-3",
    url: "https://doi.org/10.1007/s10803-008-0593-3",
    evidenceDomain: "sensory_modulation_autism",
    claimBoundary:
      "Duyusal regülasyon sorunlarının nörogelişimsel profillerde heterojen ve sık görülebileceğini destekler; duyusal tanı veya otizm tanısı üretmez.",
    verifiedAt: "2026-06-16",
    catalogArea: "Duyusal Regülasyon",
    catalogTier: "core",
  },
  CASE_SMITH_ET_AL_2015: {
    id: "CASE_SMITH_ET_AL_2015",
    inlineCitation: "(Case-Smith et al., 2015)",
    apaReference:
      "Case-Smith, J., Weaver, L. L., & Fristad, M. A. (2015). A systematic review of sensory processing interventions for children with autism spectrum disorders. Autism, 19(2), 133-148. https://doi.org/10.1177/1362361313517762",
    doi: "10.1177/1362361313517762",
    url: "https://doi.org/10.1177/1362361313517762",
    evidenceDomain: "sensory_processing_interventions_review",
    claimBoundary:
      "Duyusal işlemleme müdahale literatürünün kanıt sınırlarını gösterir; raporda müdahale önerisi veya protokol çıkarımı sağlamaz.",
    verifiedAt: "2026-06-16",
    catalogArea: "Duyusal Regülasyon",
    catalogTier: "supporting",
  },
  THOMPSON_2019: {
    id: "THOMPSON_2019",
    inlineCitation: "(Thompson, 2019)",
    apaReference:
      "Thompson, R. A. (2019). Emotion dysregulation: A theme in search of definition. Development and Psychopathology, 31(3), 805-815. https://doi.org/10.1017/S0954579419000282",
    doi: "10.1017/S0954579419000282",
    url: "https://doi.org/10.1017/S0954579419000282",
    evidenceDomain: "emotion_regulation",
    claimBoundary:
      "Duygusal düzenleme kavramının dikkatli ve işlevsel yorumlanmasını destekler; psikiyatrik tanı sınırı çizmez.",
    verifiedAt: "2026-06-01",
    catalogArea: "Duygusal Regülasyon",
    catalogTier: "core",
  },
  EISENBERG_ET_AL_2010: {
    id: "EISENBERG_ET_AL_2010",
    inlineCitation: "(Eisenberg et al., 2010)",
    apaReference:
      "Eisenberg, N., Spinrad, T. L., & Eggum, N. D. (2010). Emotion-related self-regulation and its relation to children's maladjustment. Annual Review of Clinical Psychology, 6, 495-525. https://doi.org/10.1146/annurev.clinpsy.121208.131208",
    doi: "10.1146/annurev.clinpsy.121208.131208",
    url: "https://doi.org/10.1146/annurev.clinpsy.121208.131208",
    evidenceDomain: "emotion_related_self_regulation",
    claimBoundary:
      "Duygu ilişkili self-regülasyon ile uyum sorunları arasındaki genel ilişkiyi destekler; psikiyatrik tanı veya nedensellik hükmü üretmez.",
    verifiedAt: "2026-06-16",
    catalogArea: "Duygusal Regülasyon",
    catalogTier: "core",
  },
  COLE_ET_AL_2004: {
    id: "COLE_ET_AL_2004",
    inlineCitation: "(Cole et al., 2004)",
    apaReference:
      "Cole, P. M., Martin, S. E., & Dennis, T. A. (2004). Emotion regulation as a scientific construct: Methodological challenges and directions for child development research. Child Development, 75(2), 317-333. https://doi.org/10.1111/j.1467-8624.2004.00673.x",
    doi: "10.1111/j.1467-8624.2004.00673.x",
    url: "https://doi.org/10.1111/j.1467-8624.2004.00673.x",
    evidenceDomain: "emotion_regulation_construct",
    claimBoundary:
      "Duygu düzenleme kavramının ölçüm ve yorum sınırlarını destekler; tek vaka için kesin klinik sınıflama sağlamaz.",
    verifiedAt: "2026-06-16",
    catalogArea: "Duygusal Regülasyon",
    catalogTier: "supporting",
  },
  ROSANBALM_MURRAY_2017: {
    id: "ROSANBALM_MURRAY_2017",
    inlineCitation: "(Rosanbalm & Murray, 2017)",
    apaReference:
      "Rosanbalm, K. D., & Murray, D. W. (2017). Co-regulation from birth through young adulthood: A practice brief. Office of Planning, Research, and Evaluation, Administration for Children and Families, U.S. Department of Health and Human Services.",
    doi: null,
    url: "https://fpg.unc.edu/sites/fpg.unc.edu/files/resources/reports-and-policy-briefs/Co-RegulationFromBirthThroughYoungAdulthood.pdf",
    evidenceDomain: "co_regulation_context",
    claimBoundary:
      "Ko-regülasyon ve bağlamsal destek çerçevesini destekler; doğrudan uygulama yönergesi veya tedavi reçetesi değildir.",
    verifiedAt: "2026-06-01",
    catalogArea: "Çapraz Alan",
    catalogTier: "core",
  },
  DIAMOND_2013: {
    id: "DIAMOND_2013",
    inlineCitation: "(Diamond, 2013)",
    apaReference:
      "Diamond, A. (2013). Executive functions. Annual Review of Psychology, 64, 135-168. https://doi.org/10.1146/annurev-psych-113011-143750",
    doi: "10.1146/annurev-psych-113011-143750",
    url: "https://doi.org/10.1146/annurev-psych-113011-143750",
    evidenceDomain: "executive_functions",
    claimBoundary:
      "Yürütücü işlevlerin bileşenlerini klinik yorum düzeyinde destekler; dikkat bozukluğu tanısı veya tedavi kararı üretmez.",
    verifiedAt: "2026-06-01",
    catalogArea: "Yürütücü İşlev",
    catalogTier: "core",
  },
  BEST_MILLER_2010: {
    id: "BEST_MILLER_2010",
    inlineCitation: "(Best & Miller, 2010)",
    apaReference:
      "Best, J. R., & Miller, P. H. (2010). A developmental perspective on executive function. Child Development, 81(6), 1641-1660. https://doi.org/10.1111/j.1467-8624.2010.01499.x",
    doi: "10.1111/j.1467-8624.2010.01499.x",
    url: "https://doi.org/10.1111/j.1467-8624.2010.01499.x",
    evidenceDomain: "executive_function_development",
    claimBoundary:
      "Yürütücü işlevin gelişimsel doğasını destekler; yaş bandı ve vaka verisi olmadan klinik tanı çıkarımı sağlamaz.",
    verifiedAt: "2026-06-16",
    catalogArea: "Yürütücü İşlev",
    catalogTier: "core",
  },
  GARON_ET_AL_2008: {
    id: "GARON_ET_AL_2008",
    inlineCitation: "(Garon et al., 2008)",
    apaReference:
      "Garon, N., Bryson, S. E., & Smith, I. M. (2008). Executive function in preschoolers: A review using an integrative framework. Psychological Bulletin, 134(1), 31-60. https://doi.org/10.1037/0033-2909.134.1.31",
    doi: "10.1037/0033-2909.134.1.31",
    url: "https://doi.org/10.1037/0033-2909.134.1.31",
    evidenceDomain: "preschool_executive_function_review",
    claimBoundary:
      "Okul öncesi yürütücü işlevi integratif gelişimsel çerçevede destekler; tek başına klinik karar üretmez.",
    verifiedAt: "2026-06-16",
    catalogArea: "Yürütücü İşlev",
    catalogTier: "core",
  },
  MCCLELLAND_ET_AL_2007: {
    id: "MCCLELLAND_ET_AL_2007",
    inlineCitation: "(McClelland et al., 2007)",
    apaReference:
      "McClelland, M. M., Cameron, C. E., Connor, C. M., Farris, C. L., Jewkes, A. M., & Morrison, F. J. (2007). Links between behavioral regulation and preschoolers' literacy, vocabulary, and math skills. Developmental Psychology, 43(4), 947-959. https://doi.org/10.1037/0012-1649.43.4.947",
    doi: "10.1037/0012-1649.43.4.947",
    url: "https://doi.org/10.1037/0012-1649.43.4.947",
    evidenceDomain: "preschool_behavioral_cognitive_regulation",
    claimBoundary:
      "Okul öncesi davranışsal/bilişsel regülasyonun öğrenme becerileriyle ilişkisini destekler; akademik performans hükmü üretmez.",
    verifiedAt: "2026-06-16",
    catalogArea: "Bilişsel Regülasyon",
    catalogTier: "core",
  },
  MONTROY_ET_AL_2016: {
    id: "MONTROY_ET_AL_2016",
    inlineCitation: "(Montroy et al., 2016)",
    apaReference:
      "Montroy, J. J., Bowles, R. P., Skibbe, L. E., McClelland, M. M., & Morrison, F. J. (2016). The development of self-regulation across early childhood. Developmental Psychology, 52(11), 1744-1762. https://doi.org/10.1037/dev0000159",
    doi: "10.1037/dev0000159",
    url: "https://doi.org/10.1037/dev0000159",
    evidenceDomain: "early_childhood_self_regulation_development",
    claimBoundary:
      "Erken çocuklukta self-regülasyonun gelişimsel seyrini destekler; tek değerlendirmeden gelişimsel gidiş tahmini üretmez.",
    verifiedAt: "2026-06-16",
    catalogArea: "Bilişsel Regülasyon",
    catalogTier: "core",
  },
  PINNA_EDWARDS_2020: {
    id: "PINNA_EDWARDS_2020",
    inlineCitation: "(Pinna & Edwards, 2020)",
    apaReference:
      "Pinna, T., & Edwards, D. J. (2020). A systematic review of associations between interoception, vagal tone, and emotional regulation: Potential applications for mental health, wellbeing, psychological flexibility, and chronic conditions. Frontiers in Psychology, 11, 1792. https://doi.org/10.3389/fpsyg.2020.01792",
    doi: "10.3389/fpsyg.2020.01792",
    url: "https://pubmed.ncbi.nlm.nih.gov/32849058/",
    evidenceDomain: "interoception_emotion_regulation",
    claimBoundary:
      "İnterosepsiyon ile duygu düzenleme ilişkisini temkinli klinik eksen olarak destekler; bedensel hastalık veya psikiyatrik tanı çıkarımı sağlamaz.",
    verifiedAt: "2026-06-01",
    catalogArea: "İnterosepsiyon",
    catalogTier: "core",
  },
  CLARK_ET_AL_2025: {
    id: "CLARK_ET_AL_2025",
    inlineCitation: "(Clark et al., 2025)",
    apaReference:
      "Clark, E., Brown, T., & Yu, M. L. (2025). Interoception and its application to paediatric occupational therapy: A scoping review. Australian Occupational Therapy Journal, 72(1), Article e12997. https://doi.org/10.1111/1440-1630.12997",
    doi: "10.1111/1440-1630.12997",
    url: "https://doi.org/10.1111/1440-1630.12997",
    evidenceDomain: "paediatric_occupational_therapy_interoception",
    claimBoundary:
      "Pediatrik ergoterapi pratiğinde interosepsiyonun kullanım alanını özetler; scoping review olduğu için kesin klinik etki veya reçete üretmez.",
    verifiedAt: "2026-06-16",
    catalogArea: "İnterosepsiyon",
    catalogTier: "core",
  },
  DUBOIS_ET_AL_2016: {
    id: "DUBOIS_ET_AL_2016",
    inlineCitation: "(DuBois et al., 2016)",
    apaReference:
      "DuBois, D., Ameis, S. H., Lai, M. C., Casanova, M. F., & Desarkar, P. (2016). Interoception in autism spectrum disorder: A review. International Journal of Developmental Neuroscience, 52, 104-111. https://doi.org/10.1016/j.ijdevneu.2016.05.001",
    doi: "10.1016/j.ijdevneu.2016.05.001",
    url: "https://doi.org/10.1016/j.ijdevneu.2016.05.001",
    evidenceDomain: "interoception_autism_review",
    claimBoundary:
      "Otizm bağlamında interosepsiyon literatürünü destekler; otizm tanısı veya genel interosepsiyon nedenselliği üretmez.",
    verifiedAt: "2026-06-16",
    catalogArea: "İnterosepsiyon",
    catalogTier: "supporting",
  },
  KAHLE_ET_AL_2018: {
    id: "KAHLE_ET_AL_2018",
    inlineCitation: "(Kahle et al., 2018)",
    apaReference:
      "Kahle, S., Miller, J. G., Helm, J. L., & Hastings, P. D. (2018). Linking autonomic physiology and emotion regulation in preschoolers: The role of reactivity and recovery. Developmental Psychobiology, 60(7), 775-788. https://doi.org/10.1002/dev.21746",
    doi: "10.1002/dev.21746",
    url: "https://doi.org/10.1002/dev.21746",
    evidenceDomain: "physiological_reactivity_recovery",
    claimBoundary:
      "Okul öncesi otonom reaktivite/toparlanma ile duygu düzenleme ilişkisini destekler; fizyolojik hastalık veya tedavi çıkarımı sağlamaz.",
    verifiedAt: "2026-06-16",
    catalogArea: "Fizyolojik Regülasyon",
    catalogTier: "core",
  },
  GRAZIANO_DEREFINKO_2013: {
    id: "GRAZIANO_DEREFINKO_2013",
    inlineCitation: "(Graziano & Derefinko, 2013)",
    apaReference:
      "Graziano, P., & Derefinko, K. (2013). Cardiac vagal control and children's adaptive functioning: A meta-analysis. Biological Psychology, 94(1), 22-37. https://doi.org/10.1016/j.biopsycho.2013.04.011",
    doi: "10.1016/j.biopsycho.2013.04.011",
    url: "https://doi.org/10.1016/j.biopsycho.2013.04.011",
    evidenceDomain: "cardiac_vagal_control_adaptive_functioning",
    claimBoundary:
      "Vagal kontrol ve adaptif işlev ilişkisini genel düzeyde destekler; HRV ölçümü yoksa doğrudan fizyolojik bulgu gibi yazılmamalıdır.",
    verifiedAt: "2026-06-16",
    catalogArea: "Fizyolojik Regülasyon",
    catalogTier: "core",
  },
  FOGEL_ET_AL_2023: {
    id: "FOGEL_ET_AL_2023",
    inlineCitation: "(Fogel et al., 2023)",
    apaReference:
      "Fogel, Y., Stuart, N., Joyce, T., & Barnett, A. L. (2023). Relationships between motor skills and executive functions in developmental coordination disorder (DCD): A systematic review. Scandinavian Journal of Occupational Therapy, 30(3), 344-356. https://doi.org/10.1080/11038128.2021.2019306",
    doi: "10.1080/11038128.2021.2019306",
    url: "https://www.tandfonline.com/doi/abs/10.1080/11038128.2021.2019306",
    evidenceDomain: "motor_praxis_executive_functions",
    claimBoundary:
      "Motor beceri ve yürütücü işlev ilişkisini genel klinik yorumda destekler; DCD tanısı veya uygulama yönergesi üretmez.",
    verifiedAt: "2026-06-01",
    catalogArea: "Yürütücü İşlev",
    catalogTier: "core",
  },
}

export const CATALOG_LITERATURE_SELECTIONS = {
  "Fizyolojik Regülasyon": ["KAHLE_ET_AL_2018", "GRAZIANO_DEREFINKO_2013", "BLAIR_RAVER_2015"],
  "Duyusal Regülasyon": ["CARPENTER_ET_AL_2019", "BEN_SASSON_ET_AL_2009", "CASE_SMITH_ET_AL_2015"],
  "Duygusal Regülasyon": ["EISENBERG_ET_AL_2010", "THOMPSON_2019", "COLE_ET_AL_2004"],
  "Bilişsel Regülasyon": ["MCCLELLAND_ET_AL_2007", "MONTROY_ET_AL_2016", "BLAIR_RAVER_2015"],
  "Yürütücü İşlev": ["DIAMOND_2013", "BEST_MILLER_2010", "GARON_ET_AL_2008", "FOGEL_ET_AL_2023"],
  "İnterosepsiyon": ["PINNA_EDWARDS_2020", "CLARK_ET_AL_2025", "DUBOIS_ET_AL_2016"],
  "Çapraz Alan": ["BLAIR_RAVER_2015", "ROSANBALM_MURRAY_2017", "DIAMOND_2013"],
} as const

function includesDomain(domains: string[] | undefined, value: string) {
  return Array.isArray(domains) && domains.includes(value)
}

function hasAnyDomain(domains: string[] | undefined, values: string[]) {
  return values.some((value) => includesDomain(domains, value))
}

function uniqueNonEmpty(items: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      items
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  )
}

function hasPattern(texts: string[] | undefined, pattern: RegExp) {
  return Array.isArray(texts) && texts.some((text) => pattern.test(String(text || "")))
}

function hasExternalTestCategory(analysis: ClinicalAnalysis, category: ExternalTestCategory) {
  return Array.isArray(analysis.externalTestCategories) && analysis.externalTestCategories.includes(category)
}

function getCategoryTestNames(
  analysis: ClinicalAnalysis,
  category: ExternalTestCategory
): string[] {
  return uniqueNonEmpty(
    (analysis.externalTestIds || [])
      .map((testId) => {
        const definition = getExternalTestDefinitionById(testId)
        if (!definition) return null
        return category === "adaptive_daily_living" && ["abas3", "vineland3", "pedi_cat"].includes(testId)
          ? definition.name
          : category === "language_communication" && ["celf_preschool3", "pls5"].includes(testId)
          ? definition.name
          : category === "social_pragmatic" && ["ccc2", "srs2"].includes(testId)
          ? definition.name
          : category === "motor_praxis" && ["sipt", "pdms3", "bot2", "mabc3", "mfun", "dcdq07", "beery_vmi"].includes(testId)
          ? definition.name
          : null
      })
      .filter(Boolean)
  )
}

function joinTestNames(names: string[]): string {
  if (names.length <= 1) return names[0] || ""
  if (names.length === 2) return `${names[0]} ve ${names[1]}`
  return `${names.slice(0, -1).join(", ")} ve ${names[names.length - 1]}`
}

function buildRegulationParagraph(analysis: ClinicalAnalysis): LiteratureBlock {
  const levelText =
    String(analysis.globalLevel || "").toLowerCase() === "tipik"
      ? "genel düzeyde büyük ölçüde korunmuş"
      : "birden fazla alt sistemin birlikte düşünülmesini gerektiren"

  return {
    text: [
    `Erken çocukluk literatürü, self-regülasyonu tek bir belirti kümesi olarak değil; bedensel uyarılma, dikkat, duygu düzenleme ve davranış kontrolünün birlikte örgütlendiği gelişimsel bir yapı olarak ele alır ${VERIFIED_LITERATURE_SOURCES.BLAIR_RAVER_2015.inlineCitation}.`,
    `Bu nedenle mevcut profil, yalnız tek tek alan skorlarıyla değil, ${levelText} çok boyutlu bir düzenleme örüntüsü olarak yorumlanmalıdır.`,
    `Aynı çerçeve, okul öncesi dönemde self-regülasyonun yetişkin desteği, günlük yapı ve ko-regülasyon süreçlerinden bağımsız düşünülemeyeceğini vurgular ${VERIFIED_LITERATURE_SOURCES.ROSANBALM_MURRAY_2017.inlineCitation}.`,
    `Dikkat sürdürme, davranışı durdurma, çalışma belleği ve esnek geçiş gibi süreçlerin ortak düzenleyici omurga içinde yer alması da yürütücü işlev literatürüyle uyumludur ${VERIFIED_LITERATURE_SOURCES.DIAMOND_2013.inlineCitation}.`,
  ].join(" "),
    sourceIds: [
      VERIFIED_LITERATURE_SOURCES.BLAIR_RAVER_2015.id,
      VERIFIED_LITERATURE_SOURCES.ROSANBALM_MURRAY_2017.id,
      VERIFIED_LITERATURE_SOURCES.DIAMOND_2013.id,
    ],
  }
}

function buildDomainParagraph(analysis: ClinicalAnalysis): LiteratureBlock {
  const weakDomains = analysis.weakDomains || []
  const matchedDomains = analysis.matchedDomains || []
  const therapistInsights = analysis.therapistInsights || []
  const externalClinicalFindings = analysis.externalClinicalFindings || []
  const primaryExternalTestCategory = analysis.primaryExternalTestCategory || null
  const adaptiveTestNames = getCategoryTestNames(analysis, "adaptive_daily_living")
  const socialTestNames = getCategoryTestNames(analysis, "social_pragmatic")
  const languageTestNames = getCategoryTestNames(analysis, "language_communication")
  const praxisTestNames = getCategoryTestNames(analysis, "motor_praxis")
  const balancedProfile = String(analysis.globalLevel || "").toLowerCase() === "tipik" && weakDomains.length === 0
  const selectiveProfile = String(analysis.globalLevel || "").toLowerCase() === "tipik" && weakDomains.length === 1
  const explicitInteroContext =
    hasPattern(externalClinicalFindings, /intero|fizyolojik|bedensel|yorgunluk|huzursuzluk|susama|açlık|aclik|tuvalet/i) ||
    hasPattern(therapistInsights, /bedensel|yorgunluk|huzursuzluk|susama|açlık|aclik|tuvalet|ritim|mola/i)
  const supportsPhysiologicalContext =
    hasAnyDomain(weakDomains, ["Fizyolojik Regülasyon"]) ||
    analysis.primaryWeakDomain === "Fizyolojik Regülasyon" ||
    hasPattern(externalClinicalFindings, /uyku|arousal|otonom|fizyolojik|yorgunluk|toparlanma|vagal|kalp/i) ||
    hasPattern(therapistInsights, /uyku|arousal|otonom|fizyolojik|yorgunluk|toparlanma|bedensel gerilim/i)
  const sensoryInWeakDomains = hasAnyDomain(weakDomains, ["Duyusal Regülasyon"])
  const supportsSensoryContext =
    sensoryInWeakDomains ||
    (primaryExternalTestCategory !== "adaptive_daily_living" &&
      primaryExternalTestCategory !== "language_communication" &&
      primaryExternalTestCategory !== "social_pragmatic" &&
      !balancedProfile &&
      hasAnyDomain(matchedDomains, ["Duyusal Regülasyon"])) ||
    hasExternalTestCategory(analysis, "sensory_processing") ||
    hasPattern(externalClinicalFindings, /sensory profile|spm|duyusal/i)
  const supportsExecutiveContext =
    hasAnyDomain(weakDomains, ["Bilişsel Regülasyon", "Yürütücü İşlev"]) ||
    hasPattern(externalClinicalFindings, /brief|conners|basc|yürütücü|yurutucu|dikkat/i) ||
    hasPattern(therapistInsights, /gorev|görev|dikkat|plan|baslat|başlat|sirala|sırala/i)
  const supportsCognitiveContext =
    hasAnyDomain(weakDomains, ["Bilişsel Regülasyon"]) ||
    hasPattern(externalClinicalFindings, /dilsel|yönerge|yonerge|çalışma belleği|calisma bellegi|dikkat|öğrenme|ogrenme/i) ||
    hasPattern(therapistInsights, /dilsel|yönerge|yonerge|dikkat|zihinsel|görevde kal|gorevde kal/i)
  const supportsAdaptiveContext =
    hasExternalTestCategory(analysis, "adaptive_daily_living") ||
    hasPattern(externalClinicalFindings, /abas|vineland|pedi-cat|uyumsal|gunluk yasam|günlük yaşam|özbakim|ozbakim/i)
  const supportsSocialCommunicationContext =
    hasExternalTestCategory(analysis, "social_pragmatic") ||
    hasPattern(externalClinicalFindings, /srs-?2|ccc-?2|pragmatik|sosyal iletişim|sosyal iletisim/i) ||
    hasPattern(therapistInsights, /grup|akran|sosyal|karsilikli|karşılıklı/i)
  const supportsLanguageContext =
    hasExternalTestCategory(analysis, "language_communication") ||
    hasPattern(externalClinicalFindings, /celf|pls|dilsel|alici|ifade edici|yönerge|yonerge/i)
  const supportsMotorPraxisContext =
    hasExternalTestCategory(analysis, "motor_praxis") ||
    hasPattern(externalClinicalFindings, /sipt|praksi|somatodispraksi|motor planlama|mabc|pdms|beery|koordinasyon/i)
  const sourceIds: string[] = []

  const sensorySentence = supportsSensoryContext
    ? `Bu vakada uyaran yoğunluğu ve çevresel tetikleyicilerin görünür olması, erken çocuklukta duyusal aşırı yanıtlılığın davranışsal ve duygusal zorlanmalarla ilişkili olabileceğini gösteren bulgularla örtüşmektedir ${VERIFIED_LITERATURE_SOURCES.CARPENTER_ET_AL_2019.inlineCitation}; duyusal regülasyon sorunlarının özellikle nörogelişimsel profillerde heterojen seyredebileceği de vurgulanmaktadır ${VERIFIED_LITERATURE_SOURCES.BEN_SASSON_ET_AL_2009.inlineCitation}.`
    : ""

  const emotionSentence = hasAnyDomain(weakDomains, ["Duygusal Regülasyon"]) || (!balancedProfile && hasAnyDomain(matchedDomains, ["Duygusal Regülasyon"]))
    ? `Duygusal toparlanma, yoğunluk ve yatışma hızı işlevsel bir regülasyon süreci olarak ele alınır ${VERIFIED_LITERATURE_SOURCES.THOMPSON_2019.inlineCitation}. Duyguyla ilişkili self-regülasyonun çocukların uyum süreçleriyle bağlantısı da derleme düzeyinde desteklenmektedir ${VERIFIED_LITERATURE_SOURCES.EISENBERG_ET_AL_2010.inlineCitation}.`
    : ""

  const physiologicalSentence = supportsPhysiologicalContext
    ? `Fizyolojik regülasyon ve toparlanma alanı öne çıktığında, okul öncesi dönemde otonom reaktivite ve toparlanmanın duygu düzenleme süreçleriyle ilişkili olabileceğini gösteren bulgular klinik yoruma arka plan sağlar ${VERIFIED_LITERATURE_SOURCES.KAHLE_ET_AL_2018.inlineCitation}; vagal kontrol ile çocukların adaptif işlevleri arasındaki ilişkiye dair meta-analitik kanıt da bu beden-temelli okumanın sınırlarını destekler ${VERIFIED_LITERATURE_SOURCES.GRAZIANO_DEREFINKO_2013.inlineCitation}.`
    : ""

  const interoSentence = hasAnyDomain(weakDomains, ["İnterosepsiyon", "Fizyolojik Regülasyon"]) ||
    (!balancedProfile && hasAnyDomain(matchedDomains, ["İnterosepsiyon", "Fizyolojik Regülasyon"])) ||
    analysis.primaryWeakDomain === "İnterosepsiyon" ||
    analysis.primaryWeakDomain === "Fizyolojik Regülasyon" ||
    explicitInteroContext
      ? `Bedensel sinyallerin fark edilmesi ve bu sinyallerin duygusal düzenleme ile ilişkisi üzerine yapılan sistematik derlemeler, interoseptif süreçlerin klinik yorumda temkinli ama anlamlı bir eksen olarak ele alınabileceğini düşündürmektedir ${VERIFIED_LITERATURE_SOURCES.PINNA_EDWARDS_2020.inlineCitation}. Pediatrik ergoterapi literatüründe interosepsiyonun günlük katılım, duygu düzenleme ve beden sinyali farkındalığıyla birlikte ele alınması gerektiği ayrıca vurgulanmaktadır ${VERIFIED_LITERATURE_SOURCES.CLARK_ET_AL_2025.inlineCitation}.`
      : ""

  const adaptiveSentence = supportsAdaptiveContext
    ? balancedProfile
      ? `${joinTestNames(adaptiveTestNames) || "Uyumsal davranış ve günlük yaşam testleri"} günlük yaşam işlevlerine ilişkin veri sağlar. Bu veri, işlevselliğin hangi koşullarda korunduğunu ve günlük akışın nasıl sürdürüldüğünü gösterir ${VERIFIED_LITERATURE_SOURCES.BLAIR_RAVER_2015.inlineCitation}.`
      : `${joinTestNames(adaptiveTestNames) || "Uyumsal davranış ve günlük yaşam testleri"} günlük yaşam işlevlerine ilişkin veri sağlar. Bu veri, self-regülasyon güçlüğünün öz bakım, rutin başlatma, sorumluluk alma ve günlük akışta nasıl karşılık bulduğunu gösterir ${VERIFIED_LITERATURE_SOURCES.BLAIR_RAVER_2015.inlineCitation}.`
    : ""

  const socialCommunicationSentence = supportsSocialCommunicationContext
    ? `${joinTestNames(socialTestNames) || "Sosyal-pragmatik iletişim testleri"} ile elde edilen karşılıklılık, pragmatik esneklik ve sosyal bağlamı sürdürme bulgularının yorum içine alınması, regülasyon örüntüsünün yalnız bireysel performans değil etkileşimsel talep altında da değerlendirilmesi gerektiğini vurgulayan yaklaşım ile tutarlıdır ${VERIFIED_LITERATURE_SOURCES.ROSANBALM_MURRAY_2017.inlineCitation}.`
    : ""

  const languageSentence = supportsLanguageContext
    ? `${joinTestNames(languageTestNames) || "Dil testleri"} ile görünür hale gelen alıcı-ifade edici dil zorluğu, sözel talep ve yönerge karmaşıklığı arttığında anlama, zihinsel olarak tutma ve görevi sürdürme süreçlerinin birlikte zorlanabileceğini düşündürür; bu durum regülasyonun talep ve bağlam düzeyinde ele alındığı gelişimsel çerçeveyle uyumludur ${VERIFIED_LITERATURE_SOURCES.BLAIR_RAVER_2015.inlineCitation}.`
    : ""

  const cognitiveSentence = supportsCognitiveContext && !supportsLanguageContext
    ? `Bilişsel regülasyon alanı dikkat, görevde kalma ve zihinsel organizasyon üzerinden öne çıktığında, okul öncesi davranışsal/bilişsel regülasyonun öğrenme ve görev performansıyla ilişkili olabileceğini gösteren bulgular klinik yorumu destekler ${VERIFIED_LITERATURE_SOURCES.MCCLELLAND_ET_AL_2007.inlineCitation}; erken çocuklukta self-regülasyonun gelişimsel olarak değişen bir yapı olduğu da göz önünde tutulmalıdır ${VERIFIED_LITERATURE_SOURCES.MONTROY_ET_AL_2016.inlineCitation}.`
    : ""

  const executiveSentence = supportsExecutiveContext
    ? `Yürütücü işlev ekseni belirginleştiğinde inhibisyon, çalışma belleği, esneklik ve hedefe yönelik davranış birlikte örgütlenen gelişimsel beceriler olarak ele alınır ${VERIFIED_LITERATURE_SOURCES.DIAMOND_2013.inlineCitation}; okul öncesi yürütücü işlev literatürü de bu alanın tek bir davranış belirtisine indirgenmemesini destekler ${VERIFIED_LITERATURE_SOURCES.GARON_ET_AL_2008.inlineCitation}.`
    : ""

  const motorPraxisSentence = supportsMotorPraxisContext
    ? `${joinTestNames(praxisTestNames) || "Motor planlama testleri"} ile ortaya konan praksi, sekanslama ve beden organizasyonu bulguları, motor beceriler ile yürütücü işlev süreçlerinin birlikte ele alındığı derlemelerle uyumludur; bu tür bulgular davranış organizasyonu, görev sürdürme ve katılım örüntüsüyle birlikte anlam kazanır ${VERIFIED_LITERATURE_SOURCES.FOGEL_ET_AL_2023.inlineCitation}.`
    : ""

  const balancedNeutralSentence =
    balancedProfile &&
    !sensorySentence &&
    !emotionSentence &&
    !physiologicalSentence &&
    !interoSentence &&
    !adaptiveSentence &&
    !socialCommunicationSentence &&
    !languageSentence &&
    !cognitiveSentence &&
    !executiveSentence &&
    !motorPraxisSentence
      ? `Alanların genel olarak tipik aralıkta kalması, dikkat, duygu düzenleme ve davranış kontrolü süreçlerinin yaşa uygun sınırlar içinde birlikte işleyebildiğini düşündürür; bu görünüm, self-regülasyonun koruyucu gelişimsel yönlerini vurgulayan yazınla uyumludur ${VERIFIED_LITERATURE_SOURCES.DIAMOND_2013.inlineCitation}.`
      : ""

  if (sensorySentence) sourceIds.push(VERIFIED_LITERATURE_SOURCES.CARPENTER_ET_AL_2019.id, VERIFIED_LITERATURE_SOURCES.BEN_SASSON_ET_AL_2009.id)
  if (emotionSentence) sourceIds.push(VERIFIED_LITERATURE_SOURCES.THOMPSON_2019.id, VERIFIED_LITERATURE_SOURCES.EISENBERG_ET_AL_2010.id)
  if (physiologicalSentence) sourceIds.push(VERIFIED_LITERATURE_SOURCES.KAHLE_ET_AL_2018.id, VERIFIED_LITERATURE_SOURCES.GRAZIANO_DEREFINKO_2013.id)
  if (interoSentence) sourceIds.push(VERIFIED_LITERATURE_SOURCES.PINNA_EDWARDS_2020.id, VERIFIED_LITERATURE_SOURCES.CLARK_ET_AL_2025.id)
  if (adaptiveSentence) sourceIds.push(VERIFIED_LITERATURE_SOURCES.BLAIR_RAVER_2015.id)
  if (socialCommunicationSentence) sourceIds.push(VERIFIED_LITERATURE_SOURCES.ROSANBALM_MURRAY_2017.id)
  if (languageSentence) sourceIds.push(VERIFIED_LITERATURE_SOURCES.BLAIR_RAVER_2015.id)
  if (cognitiveSentence) sourceIds.push(VERIFIED_LITERATURE_SOURCES.MCCLELLAND_ET_AL_2007.id, VERIFIED_LITERATURE_SOURCES.MONTROY_ET_AL_2016.id)
  if (executiveSentence) sourceIds.push(VERIFIED_LITERATURE_SOURCES.DIAMOND_2013.id, VERIFIED_LITERATURE_SOURCES.GARON_ET_AL_2008.id)
  if (motorPraxisSentence) sourceIds.push(VERIFIED_LITERATURE_SOURCES.FOGEL_ET_AL_2023.id)
  if (balancedNeutralSentence) sourceIds.push(VERIFIED_LITERATURE_SOURCES.DIAMOND_2013.id)

  const orderedSentences =
    primaryExternalTestCategory === "motor_praxis"
      ? [motorPraxisSentence, executiveSentence, sensorySentence, emotionSentence, physiologicalSentence, interoSentence, adaptiveSentence, socialCommunicationSentence, languageSentence, cognitiveSentence, balancedNeutralSentence]
      : primaryExternalTestCategory === "language_communication"
      ? [languageSentence, cognitiveSentence, executiveSentence, emotionSentence, sensorySentence, adaptiveSentence, socialCommunicationSentence, physiologicalSentence, interoSentence, motorPraxisSentence, balancedNeutralSentence]
      : primaryExternalTestCategory === "adaptive_daily_living"
      ? [adaptiveSentence, interoSentence, physiologicalSentence, emotionSentence, sensorySentence, executiveSentence, cognitiveSentence, socialCommunicationSentence, languageSentence, motorPraxisSentence, balancedNeutralSentence]
      : primaryExternalTestCategory === "social_pragmatic"
      ? [socialCommunicationSentence, emotionSentence, executiveSentence, adaptiveSentence, sensorySentence, languageSentence, cognitiveSentence, physiologicalSentence, interoSentence, motorPraxisSentence, balancedNeutralSentence]
      : [sensorySentence, emotionSentence, physiologicalSentence, interoSentence, executiveSentence, cognitiveSentence, adaptiveSentence, socialCommunicationSentence, languageSentence, motorPraxisSentence, balancedNeutralSentence]

  const selectedSentences =
    balancedProfile
      ? orderedSentences.filter(Boolean).slice(0, 2)
      : selectiveProfile
      ? orderedSentences.filter(Boolean).slice(0, 3)
      : orderedSentences.filter(Boolean)

  return {
    text: selectedSentences.join(" "),
    sourceIds,
  }
}

function buildIntegrationParagraph(analysis: ClinicalAnalysis): LiteratureBlock {
  const therapistInsights = analysis.therapistInsights || []
  const externalClinicalFindings = analysis.externalClinicalFindings || []
  const balancedProfile = String(analysis.globalLevel || "").toLowerCase() === "tipik" && (analysis.weakDomains || []).length === 0
  const primaryExternalTestCategory = analysis.primaryExternalTestCategory || null
  const contrastSentence =
    analysis.strongDomains && analysis.strongDomains.length > 0
      ? `Ayrıca korunmuş alanların açıkça belirtilmesi önemlidir; çünkü erken self-regülasyon yazınında göreli güçlü sistemlerin günlük işlevsellik üzerinde dengeleyici rol oynayabileceği vurgulanır ${VERIFIED_LITERATURE_SOURCES.BLAIR_RAVER_2015.inlineCitation}.`
      : `Korunmuş alanların sınırlı olduğu örüntülerde bile, profilin bütününü bağlam içinde okumak ve tek bir skor üzerinden aşırı yorum yapmamak gerekir ${VERIFIED_LITERATURE_SOURCES.BLAIR_RAVER_2015.inlineCitation}.`

  const caseSentence = balancedProfile
    ? `Korunmuş profillerde dikkat, davranış ve beden temelli düzenleme süreçlerinin yaşa uygun sınırlar içinde birlikte işleyebilmesi, erken çocuklukta self-regülasyonun koruyucu yönlerini görünür kılan gelişimsel çerçeveyle uyumludur ${VERIFIED_LITERATURE_SOURCES.DIAMOND_2013.inlineCitation}.`
    : primaryExternalTestCategory === "adaptive_daily_living"
    ? `Uyumsal işlev verileriyle birlikte okunan profillerde, self-regülasyon zorluğu genel kapasiteden çok bu kapasitenin günlük yaşam, öz bakım ve sorumluluk akışına ne ölçüde taşınabildiği üzerinden anlam kazanır ${VERIFIED_LITERATURE_SOURCES.ROSANBALM_MURRAY_2017.inlineCitation}.`
    : primaryExternalTestCategory === "social_pragmatic"
    ? `Sosyal-pragmatik verilerle desteklenen profillerde self-regülasyon zorluğu yalnız bireysel performansta değil; sosyal bağlamı izleme, karşılıklılığı sürdürme ve bağlama uygun yanıt üretme düzleminde de görünür ${VERIFIED_LITERATURE_SOURCES.ROSANBALM_MURRAY_2017.inlineCitation}.`
    : primaryExternalTestCategory === "language_communication"
    ? `Dil testleriyle desteklenen profillerde self-regülasyon zorluğu sözel talep arttığında görünür hale gelir; anlama, görevi zihinde tutma ve davranışı sürdürme süreçleri birlikte anlam kazanır ${VERIFIED_LITERATURE_SOURCES.DIAMOND_2013.inlineCitation}.`
    : hasAnyDomain(analysis.weakDomains, ["Bilişsel Regülasyon", "Yürütücü İşlev"])
    ? `Bilişsel ve yürütücü alanlara yayılan kırılganlıkların birlikte ele alınması, dikkat, çalışma belleği, inhibisyon ve esnekliğin aynı düzenleyici sistem içinde işlendiğini gösteren yürütücü işlev literatürüyle desteklenir ${VERIFIED_LITERATURE_SOURCES.DIAMOND_2013.inlineCitation}.`
    : `Skor örüntüsünün tek bir alanda görünse bile diğer düzenleyici sistemlerle birlikte yorumlanması, erken çocuklukta self-regülasyon süreçlerinin parçalı değil etkileşimli işlediğini gösteren yazınla uyumludur ${VERIFIED_LITERATURE_SOURCES.DIAMOND_2013.inlineCitation}.`

  const observationSentence =
    primaryExternalTestCategory === "motor_praxis"
      ? `Motor planlama ve beden organizasyonu bulguları, yürütücü organizasyon ve görev sürdürme süreçleriyle birlikte ele alındığında daha anlamlıdır ${VERIFIED_LITERATURE_SOURCES.FOGEL_ET_AL_2023.inlineCitation}.`
      : therapistInsights.length > 0 || externalClinicalFindings.length > 0
      ? `Vaka içinde gözlenen bağlamsal değişkenlik, self-regülasyonun çocuk, görev ve çevre koşullarıyla birlikte değerlendirilmesi gerektiğini gösteren gelişimsel çerçeveyle uyumludur ${VERIFIED_LITERATURE_SOURCES.ROSANBALM_MURRAY_2017.inlineCitation}.`
      : `Bakımveren gözlemleri, klinik bağlamla birlikte okunduğunda self-regülasyon profilinin günlük yaşamdaki karşılığını daha görünür kılar ${VERIFIED_LITERATURE_SOURCES.ROSANBALM_MURRAY_2017.inlineCitation}.`

  return {
    text: [
      observationSentence,
      caseSentence,
      contrastSentence,
    ].join(" "),
    sourceIds: [
      VERIFIED_LITERATURE_SOURCES.ROSANBALM_MURRAY_2017.id,
      VERIFIED_LITERATURE_SOURCES.DIAMOND_2013.id,
      VERIFIED_LITERATURE_SOURCES.BLAIR_RAVER_2015.id,
    ],
  }
}

function buildLiteratureBoundaryParagraph(sourceIds: string[]): string {
  return "Bu kaynaklar, vaka bulgularını gelişimsel ve işlevsel bir çerçevede yorumlamak için kullanılmıştır. Literatür desteği tek başına tanısal sonuç, nedensellik açıklaması veya doğrudan klinik karar anlamına gelmez."
}

export function buildLiteratureAlignedSection(
  analysis: ClinicalAnalysis
): {
  text: string
  sourceIds: string[]
} | null {
  if (!analysis) return null

  const paragraph1 = buildRegulationParagraph(analysis)
  const paragraph2 = buildDomainParagraph(analysis)
  const paragraph3 = buildIntegrationParagraph(analysis)
  const bodyParagraphs =
    analysis.primaryExternalTestCategory === "motor_praxis"
      ? [paragraph2.text, paragraph3.text]
      : [paragraph1.text, paragraph2.text, paragraph3.text]

  const sourceIds =
    analysis.primaryExternalTestCategory === "motor_praxis"
      ? uniqueNonEmpty([
          VERIFIED_LITERATURE_SOURCES.FOGEL_ET_AL_2023.id,
          VERIFIED_LITERATURE_SOURCES.DIAMOND_2013.id,
          VERIFIED_LITERATURE_SOURCES.GARON_ET_AL_2008.id,
          ...paragraph2.sourceIds,
          ...paragraph1.sourceIds,
          ...paragraph3.sourceIds,
        ])
      : uniqueNonEmpty([...paragraph1.sourceIds, ...paragraph2.sourceIds, ...paragraph3.sourceIds])

  const references = uniqueNonEmpty(
    sourceIds.map((sourceId) => VERIFIED_LITERATURE_SOURCES[sourceId]?.apaReference)
  )

  const body = [
    ...bodyParagraphs,
    buildLiteratureBoundaryParagraph(sourceIds),
    "Kaynaklar (APA 7):",
    ...references,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim()

  return {
    text: `${LITERATURE_SECTION_HEADING}\n${body}`,
    sourceIds,
  }
}

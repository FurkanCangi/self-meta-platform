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
  pmid?: string
  url: string
  evidenceDomain: string
  claimBoundary: string
  verifiedAt: string
  publicationYear?: number
  studyType?: "meta_analysis" | "systematic_review" | "scoping_review" | "longitudinal" | "review" | "practice_brief"
  ageScope?: string
  relevanceTags?: string[]
  catalogArea?: string
  catalogTier?: "core" | "supporting"
}

export type LiteratureSelectionContext = {
  ageMonths?: number
  stableSeed?: string
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
  CHEN_ET_AL_2024: {
    id: "CHEN_ET_AL_2024",
    inlineCitation: "(Chen et al., 2024)",
    apaReference:
      "Chen, Y.-W. R., Janicaud, N., Littlefair, D., Graham, P., Soler, N., Wilkes-Gillan, S., McAuliffe, T., & Cordier, R. (2024). A systematic review of self-regulation measures in children: Exploring characteristics and psychometric properties. PLOS ONE, 19(9), e0309895. https://doi.org/10.1371/journal.pone.0309895",
    doi: "10.1371/journal.pone.0309895",
    pmid: "39298411",
    url: "https://pubmed.ncbi.nlm.nih.gov/39298411/",
    evidenceDomain: "self_regulation_measurement_psychometrics",
    claimBoundary:
      "Çocuklarda self-regülasyon ölçümünün çok yöntemli ve çok bileşenli doğasını destekler; tek bir aracın tanısal yeterliliğini göstermez.",
    verifiedAt: "2026-07-13",
    publicationYear: 2024,
    studyType: "systematic_review",
    ageScope: "children",
    relevanceTags: ["measurement", "psychometrics", "self_regulation"],
    catalogArea: "Çapraz Alan",
    catalogTier: "core",
  },
  STUCKE_DOEBEL_2024: {
    id: "STUCKE_DOEBEL_2024",
    inlineCitation: "(Stucke & Doebel, 2024)",
    apaReference:
      "Stucke, N. J., & Doebel, S. (2024). Early childhood executive function predicts concurrent and later social and behavioral outcomes: A review and meta-analysis. Psychological Bulletin, 150(10), 1178-1206. https://doi.org/10.1037/bul0000445",
    doi: "10.1037/bul0000445",
    pmid: "39418439",
    url: "https://pubmed.ncbi.nlm.nih.gov/39418439/",
    evidenceDomain: "early_childhood_executive_social_behavioral_outcomes",
    claimBoundary:
      "Erken çocukluk yürütücü işlevleri ile sosyal ve davranışsal sonuçlar arasındaki küçük-orta ilişkileri destekler; nedensellik veya bireysel prognoz üretmez.",
    verifiedAt: "2026-07-13",
    publicationYear: 2024,
    studyType: "meta_analysis",
    ageScope: "36-60 months",
    relevanceTags: ["executive_function", "social", "behavior", "adaptive_function"],
    catalogArea: "Yürütücü İşlev",
    catalogTier: "core",
  },
  SILVA_ET_AL_2022: {
    id: "SILVA_ET_AL_2022",
    inlineCitation: "(Silva et al., 2022)",
    apaReference:
      "Silva, C., Sousa-Gomes, V., Fávero, M., Oliveira-Lopes, S., Merendeiro, C. S., Oliveira, J., & Moreira, D. (2022). Assessment of preschool-age executive functions: A systematic review. Clinical Psychology & Psychotherapy, 29(4), 1374-1391. https://doi.org/10.1002/cpp.2718",
    doi: "10.1002/cpp.2718",
    pmid: "35112430",
    url: "https://pubmed.ncbi.nlm.nih.gov/35112430/",
    evidenceDomain: "preschool_executive_function_assessment",
    claimBoundary:
      "Okul öncesi yürütücü işlev değerlendirmesinde bileşen ve araç çeşitliliğini gösterir; tek ölçümden bütüncül tanısal sonuç çıkarılmasını desteklemez.",
    verifiedAt: "2026-07-13",
    publicationYear: 2022,
    studyType: "systematic_review",
    ageScope: "36-72 months",
    relevanceTags: ["executive_function", "measurement", "preschool"],
    catalogArea: "Yürütücü İşlev",
    catalogTier: "core",
  },
  SANKALAITE_ET_AL_2021: {
    id: "SANKALAITE_ET_AL_2021",
    inlineCitation: "(Sankalaite et al., 2021)",
    apaReference:
      "Sankalaite, S., Huizinga, M., Dewandeleer, J., Xu, C., de Vries, N., Hens, E., & Baeyens, D. (2021). Strengthening executive function and self-regulation through teacher-student interaction in preschool and primary school children: A systematic review. Frontiers in Psychology, 12, 718262. https://doi.org/10.3389/fpsyg.2021.718262",
    doi: "10.3389/fpsyg.2021.718262",
    pmid: "34489822",
    url: "https://pubmed.ncbi.nlm.nih.gov/34489822/",
    evidenceDomain: "school_context_self_regulation",
    claimBoundary:
      "Öğretmen-çocuk etkileşimi ile yürütücü işlev/self-regülasyon arasındaki bağlamsal ilişkiyi destekler; belirli bir eğitim müdahalesini reçete etmez.",
    verifiedAt: "2026-07-13",
    publicationYear: 2021,
    studyType: "systematic_review",
    ageScope: "preschool and primary school",
    relevanceTags: ["context", "co_regulation", "executive_function", "self_regulation"],
    catalogArea: "Çapraz Alan",
    catalogTier: "core",
  },
  VERHAGEN_ET_AL_2024: {
    id: "VERHAGEN_ET_AL_2024",
    inlineCitation: "(Verhagen et al., 2024)",
    apaReference:
      "Verhagen, C., Boekhorst, M. G. B. M., Kupper, N., van Bakel, H., & Duijndam, S. (2024). Coregulation between parents and elementary school-aged children in response to challenge and in association with child outcomes: A systematic review. Developmental Psychology. Advance online publication. https://doi.org/10.1037/dev0001864",
    doi: "10.1037/dev0001864",
    pmid: "39480309",
    url: "https://pubmed.ncbi.nlm.nih.gov/39480309/",
    evidenceDomain: "parent_child_coregulation",
    claimBoundary:
      "Zorluk anında ebeveyn-çocuk ko-regülasyonu ile çocuk sonuçları arasındaki ilişkiyi destekler; bağlamdan bağımsız tek yönlü etki çıkarımı sağlamaz.",
    verifiedAt: "2026-07-13",
    publicationYear: 2024,
    studyType: "systematic_review",
    ageScope: "3-12 years",
    relevanceTags: ["co_regulation", "parent_child", "context", "emotion_regulation"],
    catalogArea: "Çapraz Alan",
    catalogTier: "core",
  },
  MAYER_BENAROUS_ET_AL_2025: {
    id: "MAYER_BENAROUS_ET_AL_2025",
    inlineCitation: "(Mayer-Benarous et al., 2025)",
    apaReference:
      "Mayer-Benarous, H., Benarous, X., & Robin, M. (2025). Disrupted profiles of interoception and mental health in youths: A systematic review. European Child & Adolescent Psychiatry, 34(8), 2279-2295. https://doi.org/10.1007/s00787-025-02705-w",
    doi: "10.1007/s00787-025-02705-w",
    pmid: "40327147",
    url: "https://pubmed.ncbi.nlm.nih.gov/40327147/",
    evidenceDomain: "youth_interoception_measurement",
    claimBoundary:
      "Pediatrik interosepsiyonun farklı boyutlarının ayrıştırılması gerektiğini destekler; tek bir bedensel farkındalık bulgusundan ruhsal tanı üretmez.",
    verifiedAt: "2026-07-13",
    publicationYear: 2025,
    studyType: "systematic_review",
    ageScope: "youth",
    relevanceTags: ["interoception", "measurement", "mental_health"],
    catalogArea: "İnterosepsiyon",
    catalogTier: "core",
  },
  BAO_ET_AL_2024: {
    id: "BAO_ET_AL_2024",
    inlineCitation: "(Bao et al., 2024)",
    apaReference:
      "Bao, R., Wade, L., Leahy, A. A., Owen, K. B., Hillman, C. H., Jaakkola, T., & Lubans, D. R. (2024). Associations between motor competence and executive functions in children and adolescents: A systematic review and meta-analysis. Sports Medicine, 54(8), 2141-2156. https://doi.org/10.1007/s40279-024-02040-1",
    doi: "10.1007/s40279-024-02040-1",
    pmid: "38769244",
    url: "https://pubmed.ncbi.nlm.nih.gov/38769244/",
    evidenceDomain: "motor_competence_executive_function",
    claimBoundary:
      "Motor yeterlik ile yürütücü işlev arasındaki küçük ilişkiyi destekler; motor bulgudan bilişsel tanı veya nedensellik çıkarımı sağlamaz.",
    verifiedAt: "2026-07-13",
    publicationYear: 2024,
    studyType: "meta_analysis",
    ageScope: "5-18 years",
    relevanceTags: ["motor", "praxis", "executive_function"],
    catalogArea: "Yürütücü İşlev",
    catalogTier: "core",
  },
  PILLER_ET_AL_2025: {
    id: "PILLER_ET_AL_2025",
    inlineCitation: "(Piller et al., 2025)",
    apaReference:
      "Piller, A., McHugh Conlin, J., Glennon, T. J., Andelin, L., Auld-Wright, K., Teng, K., & Tarver, T. (2025). Systematic review of sensory-based interventions for children and youth (2015-2024). Frontiers in Pediatrics, 13, 1720179. https://doi.org/10.3389/fped.2025.1720179",
    doi: "10.3389/fped.2025.1720179",
    pmid: "41321460",
    url: "https://pubmed.ncbi.nlm.nih.gov/41321460/",
    evidenceDomain: "sensory_based_interventions_functional_outcomes",
    claimBoundary:
      "Duyusal temelli müdahale kanıtının güncel kapsam ve sınırlarını gösterir; değerlendirme bulgusundan müdahale etkinliği veya protokol çıkarımı sağlamaz.",
    verifiedAt: "2026-07-13",
    publicationYear: 2025,
    studyType: "systematic_review",
    ageScope: "0-21 years",
    relevanceTags: ["sensory_processing", "participation", "evidence_boundary"],
    catalogArea: "Duyusal Regülasyon",
    catalogTier: "supporting",
  },
  SHAHBAZI_MIRZAKHANI_2021: {
    id: "SHAHBAZI_MIRZAKHANI_2021",
    inlineCitation: "(Shahbazi & Mirzakhani, 2021)",
    apaReference:
      "Shahbazi, M., & Mirzakhani, N. (2021). Assessment of sensory processing characteristics in children between 0 and 14 years of age: A systematic review. Iranian Journal of Child Neurology, 15(1), 29-46. https://doi.org/10.22037/ijcn.v15i1.21274",
    doi: "10.22037/ijcn.v15i1.21274",
    pmid: "33558812",
    url: "https://pubmed.ncbi.nlm.nih.gov/33558812/",
    evidenceDomain: "sensory_processing_assessment",
    claimBoundary:
      "Çocuklarda duyusal işlemleme değerlendirme araçlarının kapsamını destekler; araçlar arası eşdeğerlik veya tanısal kesinlik sağlamaz.",
    verifiedAt: "2026-07-13",
    publicationYear: 2021,
    studyType: "systematic_review",
    ageScope: "0-14 years",
    relevanceTags: ["sensory_processing", "measurement", "children"],
    catalogArea: "Duyusal Regülasyon",
    catalogTier: "core",
  },
  FREITAG_ET_AL_2023: {
    id: "FREITAG_ET_AL_2023",
    inlineCitation: "(Freitag et al., 2023)",
    apaReference:
      "Freitag, G. F., Grassie, H. L., Jeong, A., Mallidi, A., Comer, J. S., Ehrenreich-May, J., & Brotman, M. A. (2023). Systematic review: Questionnaire-based measurement of emotion dysregulation in children and adolescents. Journal of the American Academy of Child & Adolescent Psychiatry, 62(7), 728-763. https://doi.org/10.1016/j.jaac.2022.07.866",
    doi: "10.1016/j.jaac.2022.07.866",
    pmid: "36529182",
    url: "https://pubmed.ncbi.nlm.nih.gov/36529182/",
    evidenceDomain: "emotion_dysregulation_measurement",
    claimBoundary:
      "Duygu düzensizliği anketlerinin kapsam ve ölçüm farklarını destekler; tek bir bildirim kaynağından psikiyatrik tanı çıkarımını desteklemez.",
    verifiedAt: "2026-07-13",
    publicationYear: 2023,
    studyType: "systematic_review",
    ageScope: "children and adolescents",
    relevanceTags: ["emotion_regulation", "measurement", "multi_informant"],
    catalogArea: "Duygusal Regülasyon",
    catalogTier: "core",
  },
  RESTOY_ET_AL_2024: {
    id: "RESTOY_ET_AL_2024",
    inlineCitation: "(Restoy et al., 2024)",
    apaReference:
      "Restoy, D., Oriol-Escudé, M., Alonzo-Castillo, T., Magán-Maganto, M., Canal-Bedia, R., Díez-Villoria, E., Gisbert-Gustemps, L., Setién-Ramos, I., Martínez-Ramírez, M., Ramos-Quiroga, J. A., & Lugo-Marín, J. (2024). Emotion regulation and emotion dysregulation in children and adolescents with autism spectrum disorder: A meta-analysis of evaluation and intervention studies. Clinical Psychology Review, 109, 102410. https://doi.org/10.1016/j.cpr.2024.102410",
    doi: "10.1016/j.cpr.2024.102410",
    pmid: "38401510",
    url: "https://pubmed.ncbi.nlm.nih.gov/38401510/",
    evidenceDomain: "emotion_regulation_autism",
    claimBoundary:
      "Otizm örneklemlerinde duygu düzenleme güçlüklerinin heterojenliğini destekler; mevcut vakada otizm tanısı veya genelleştirilmiş nedensellik üretmez.",
    verifiedAt: "2026-07-13",
    publicationYear: 2024,
    studyType: "meta_analysis",
    ageScope: "children and adolescents with autism",
    relevanceTags: ["emotion_regulation", "autism", "evidence_boundary"],
    catalogArea: "Duygusal Regülasyon",
    catalogTier: "supporting",
  },
  URBEN_ET_AL_2025: {
    id: "URBEN_ET_AL_2025",
    inlineCitation: "(Urben et al., 2025)",
    apaReference:
      "Urben, S., Ochoa Williams, A., Ben Jemia, C., Rosselet Amoussou, J., Machado Lazaro, S., Giovannini, J., Abi Kheir, M., Kaess, M., Plessen, K. J., & Mürner-Lavanchy, I. (2025). Understanding irritability through the lens of self-regulatory control processes in children and adolescents: A systematic review. European Child & Adolescent Psychiatry, 34(5), 1497-1509. https://doi.org/10.1007/s00787-024-02591-8",
    doi: "10.1007/s00787-024-02591-8",
    pmid: "39379596",
    url: "https://pubmed.ncbi.nlm.nih.gov/39379596/",
    evidenceDomain: "irritability_self_regulatory_control",
    claimBoundary:
      "İrritabiliteyi yürütücü, çaba gerektiren ve otonom kontrol süreçleriyle birlikte ele almayı destekler; irritabiliteden tanı çıkarmaz.",
    verifiedAt: "2026-07-13",
    publicationYear: 2025,
    studyType: "systematic_review",
    ageScope: "children and adolescents",
    relevanceTags: ["emotion_regulation", "irritability", "executive_function"],
    catalogArea: "Duygusal Regülasyon",
    catalogTier: "core",
  },
  LIANG_ET_AL_2025: {
    id: "LIANG_ET_AL_2025",
    inlineCitation: "(Liang et al., 2025)",
    apaReference:
      "Liang, Y., Zhang, Q., Ran, G., & Niu, X. (2025). The association between emotional regulation strategies and peer acceptance in preschool-age children: A three-level meta-analysis. The Journal of Genetic Psychology, 1-15. Advance online publication. https://doi.org/10.1080/00221325.2025.2532439",
    doi: "10.1080/00221325.2025.2532439",
    pmid: "40736477",
    url: "https://pubmed.ncbi.nlm.nih.gov/40736477/",
    evidenceDomain: "preschool_emotion_regulation_peer_acceptance",
    claimBoundary:
      "Okul öncesinde duygu düzenleme stratejileri ile akran kabulü arasındaki ilişkiyi destekler; bireysel sosyal işlev için tek yönlü tahmin üretmez.",
    verifiedAt: "2026-07-13",
    publicationYear: 2025,
    studyType: "meta_analysis",
    ageScope: "preschool",
    relevanceTags: ["emotion_regulation", "peer", "social"],
    catalogArea: "Duygusal Regülasyon",
    catalogTier: "core",
  },
  SCIONTI_ET_AL_2023: {
    id: "SCIONTI_ET_AL_2023",
    inlineCitation: "(Scionti et al., 2023)",
    apaReference:
      "Scionti, N., Zampini, L., & Marzocchi, G. M. (2023). The relationship between narrative skills and executive functions across childhood: A systematic review and meta-analysis. Children, 10(8), 1391. https://doi.org/10.3390/children10081391",
    doi: "10.3390/children10081391",
    pmid: "37628390",
    url: "https://pubmed.ncbi.nlm.nih.gov/37628390/",
    evidenceDomain: "narrative_language_executive_function",
    claimBoundary:
      "Anlatı becerileri ile yürütücü işlev arasındaki ilişkiyi destekler; dil bulgusunu doğrudan yürütücü bozukluk göstergesi yapmaz.",
    verifiedAt: "2026-07-13",
    publicationYear: 2023,
    studyType: "meta_analysis",
    ageScope: "childhood",
    relevanceTags: ["language", "narrative", "executive_function"],
    catalogArea: "Bilişsel Regülasyon",
    catalogTier: "core",
  },
  MASEK_ET_AL_2023: {
    id: "MASEK_ET_AL_2023",
    inlineCitation: "(Masek et al., 2023)",
    apaReference:
      "Masek, L. R., Weiss, S. M., McMillan, B. T. M., Paterson, S. J., Golinkoff, R. M., & Hirsh-Pasek, K. (2023). Contingent conversations build more than language: How communicative interactions in toddlerhood relate to preschool executive function skills. Developmental Science, 26(3), e13338. https://doi.org/10.1111/desc.13338",
    doi: "10.1111/desc.13338",
    pmid: "36318975",
    url: "https://pubmed.ncbi.nlm.nih.gov/36318975/",
    evidenceDomain: "caregiver_communication_language_executive_function",
    claimBoundary:
      "Erken iletişim etkileşimleri, dil ve okul öncesi yürütücü işlev arasındaki gelişimsel ilişkiyi destekler; tek vaka için nedensel gelişim yolu üretmez.",
    verifiedAt: "2026-07-13",
    publicationYear: 2023,
    studyType: "longitudinal",
    ageScope: "toddlerhood to preschool",
    relevanceTags: ["language", "caregiver_interaction", "executive_function"],
    catalogArea: "Bilişsel Regülasyon",
    catalogTier: "core",
  },
  ROMEO_ET_AL_2022: {
    id: "ROMEO_ET_AL_2022",
    inlineCitation: "(Romeo et al., 2022)",
    apaReference:
      "Romeo, R. R., Flournoy, J. C., McLaughlin, K. A., & Lengua, L. J. (2022). Language development as a mechanism linking socioeconomic status to executive functioning development in preschool. Developmental Science, 25(5), e13227. https://doi.org/10.1111/desc.13227",
    doi: "10.1111/desc.13227",
    pmid: "34981872",
    url: "https://pubmed.ncbi.nlm.nih.gov/34981872/",
    evidenceDomain: "preschool_language_executive_development",
    claimBoundary:
      "Dil ve yürütücü işlev gelişiminin birlikte değişebileceğini destekler; sosyoekonomik bağlamdan bireysel nedensellik veya eksiklik hükmü üretmez.",
    verifiedAt: "2026-07-13",
    publicationYear: 2022,
    studyType: "longitudinal",
    ageScope: "preschool",
    relevanceTags: ["language", "executive_function", "development"],
    catalogArea: "Bilişsel Regülasyon",
    catalogTier: "core",
  },
  LI_ET_AL_2026: {
    id: "LI_ET_AL_2026",
    inlineCitation: "(Li et al., 2026)",
    apaReference:
      "Li, Y., Ler, H. Y., Zhang, D., & Su, L. (2026). Fundamental motor skill interventions significantly improve executive functions and social-emotional competence in preschoolers: A meta-analysis. Frontiers in Psychology, 16, 1721589. https://doi.org/10.3389/fpsyg.2025.1721589",
    doi: "10.3389/fpsyg.2025.1721589",
    pmid: "41583760",
    url: "https://pubmed.ncbi.nlm.nih.gov/41583760/",
    evidenceDomain: "preschool_motor_executive_social_emotional",
    claimBoundary:
      "Okul öncesi motor beceri müdahaleleri ile yürütücü ve sosyal-duygusal sonuçlar arasındaki grup düzeyi etkiyi destekler; bireysel müdahale reçetesi üretmez.",
    verifiedAt: "2026-07-13",
    publicationYear: 2026,
    studyType: "meta_analysis",
    ageScope: "preschool",
    relevanceTags: ["motor", "executive_function", "social_emotional"],
    catalogArea: "Yürütücü İşlev",
    catalogTier: "supporting",
  },
  DE_RAEYMAECKER_DHAR_2022: {
    id: "DE_RAEYMAECKER_DHAR_2022",
    inlineCitation: "(De Raeymaecker & Dhar, 2022)",
    apaReference:
      "De Raeymaecker, K., & Dhar, M. (2022). The influence of parents on emotion regulation in middle childhood: A systematic review. Children, 9(8), 1200. https://doi.org/10.3390/children9081200",
    doi: "10.3390/children9081200",
    pmid: "36010090",
    url: "https://pubmed.ncbi.nlm.nih.gov/36010090/",
    evidenceDomain: "parent_emotion_socialization",
    claimBoundary:
      "Ebeveyn duygu sosyalleştirmesi ile çocuk duygu düzenleme gelişimi arasındaki bağlamsal ilişkiyi destekler; ebeveyn davranışından tek başına klinik sonuç çıkarmaz.",
    verifiedAt: "2026-07-13",
    publicationYear: 2022,
    studyType: "systematic_review",
    ageScope: "middle childhood",
    relevanceTags: ["parenting", "emotion_regulation", "context"],
    catalogArea: "Duygusal Regülasyon",
    catalogTier: "supporting",
  },
  PAULS_ARCHIBALD_2016: {
    id: "PAULS_ARCHIBALD_2016",
    inlineCitation: "(Pauls & Archibald, 2016)",
    apaReference:
      "Pauls, L. J., & Archibald, L. M. D. (2016). Executive functions in children with specific language impairment: A meta-analysis. Journal of Speech, Language, and Hearing Research, 59(5), 1074-1086. https://doi.org/10.1044/2016_JSLHR-L-15-0174",
    doi: "10.1044/2016_JSLHR-L-15-0174",
    pmid: "27653611",
    url: "https://pubmed.ncbi.nlm.nih.gov/27653611/",
    evidenceDomain: "language_impairment_executive_function",
    claimBoundary:
      "Dil bozukluğu örneklemlerinde yürütücü işlev farklılıklarını grup düzeyinde destekler; dil bulgusundan yürütücü bozukluk tanısı üretmez.",
    verifiedAt: "2026-07-13",
    publicationYear: 2016,
    studyType: "meta_analysis",
    ageScope: "children with language impairment",
    relevanceTags: ["language", "executive_function", "clinical_population"],
    catalogArea: "Bilişsel Regülasyon",
    catalogTier: "supporting",
  },
}

export const CATALOG_LITERATURE_SELECTIONS = {
  "Fizyolojik Regülasyon": [
    "KAHLE_ET_AL_2018",
    "GRAZIANO_DEREFINKO_2013",
    "BLAIR_RAVER_2015",
    "CHEN_ET_AL_2024",
  ],
  "Duyusal Regülasyon": [
    "CARPENTER_ET_AL_2019",
    "BEN_SASSON_ET_AL_2009",
    "CASE_SMITH_ET_AL_2015",
    "SHAHBAZI_MIRZAKHANI_2021",
    "PILLER_ET_AL_2025",
  ],
  "Duygusal Regülasyon": [
    "EISENBERG_ET_AL_2010",
    "THOMPSON_2019",
    "COLE_ET_AL_2004",
    "FREITAG_ET_AL_2023",
    "RESTOY_ET_AL_2024",
    "URBEN_ET_AL_2025",
    "LIANG_ET_AL_2025",
    "DE_RAEYMAECKER_DHAR_2022",
  ],
  "Bilişsel Regülasyon": [
    "MCCLELLAND_ET_AL_2007",
    "MONTROY_ET_AL_2016",
    "CHEN_ET_AL_2024",
    "SCIONTI_ET_AL_2023",
    "MASEK_ET_AL_2023",
    "ROMEO_ET_AL_2022",
    "PAULS_ARCHIBALD_2016",
    "STUCKE_DOEBEL_2024",
  ],
  "Yürütücü İşlev": [
    "DIAMOND_2013",
    "BEST_MILLER_2010",
    "GARON_ET_AL_2008",
    "FOGEL_ET_AL_2023",
    "STUCKE_DOEBEL_2024",
    "SILVA_ET_AL_2022",
    "BAO_ET_AL_2024",
    "LI_ET_AL_2026",
  ],
  "İnterosepsiyon": [
    "PINNA_EDWARDS_2020",
    "CLARK_ET_AL_2025",
    "DUBOIS_ET_AL_2016",
    "MAYER_BENAROUS_ET_AL_2025",
  ],
  "Çapraz Alan": [
    "BLAIR_RAVER_2015",
    "ROSANBALM_MURRAY_2017",
    "DIAMOND_2013",
    "CHEN_ET_AL_2024",
    "SANKALAITE_ET_AL_2021",
    "VERHAGEN_ET_AL_2024",
    "STUCKE_DOEBEL_2024",
  ],
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

function stableHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function getSourceYear(sourceId: string): number {
  const source = VERIFIED_LITERATURE_SOURCES[sourceId]
  if (!source) return 0
  if (source.publicationYear) return source.publicationYear
  const match = source.inlineCitation.match(/\b(19|20)\d{2}\b/)
  return match ? Number(match[0]) : 0
}

function selectSourceIds(
  sourcePool: readonly string[],
  count: number,
  seed: string
): string[] {
  const candidates = uniqueNonEmpty([...sourcePool]).filter(
    (sourceId) => Boolean(VERIFIED_LITERATURE_SOURCES[sourceId])
  )
  const bySeed = (left: string, right: string) => {
    const scoreDifference = stableHash(`${seed}:${left}`) - stableHash(`${seed}:${right}`)
    return scoreDifference || left.localeCompare(right, "tr")
  }
  const recent = candidates.filter((sourceId) => getSourceYear(sourceId) >= 2021).sort(bySeed)
  const foundational = candidates.filter((sourceId) => getSourceYear(sourceId) < 2021).sort(bySeed)
  const selected: string[] = []

  if (recent.length > 0) selected.push(recent[0])
  if (count > 1 && foundational.length > 0) selected.push(foundational[0])

  const remaining = candidates
    .filter((sourceId) => !selected.includes(sourceId))
    .sort(bySeed)

  return [...selected, ...remaining].slice(0, Math.max(0, count))
}

function inlineCitations(sourceIds: string[]): string {
  const citations = sourceIds
    .map((sourceId) => VERIFIED_LITERATURE_SOURCES[sourceId]?.inlineCitation)
    .filter(Boolean)
    .map((citation) => citation.replace(/^\(|\)$/g, ""))
  return citations.length > 0 ? `(${citations.join("; ")})` : ""
}

function createLiteratureBlock(text: string, sourceIds: string[]): LiteratureBlock {
  return {
    text: text.trim(),
    sourceIds: uniqueNonEmpty(sourceIds),
  }
}

function buildSelectionSeed(
  analysis: ClinicalAnalysis,
  context: LiteratureSelectionContext
): string {
  const ageBand = Number.isFinite(context.ageMonths)
    ? `${Math.floor(Number(context.ageMonths) / 12)}y-${Number(context.ageMonths)}m`
    : "age-unknown"
  return [
    context.stableSeed || "stable-case",
    ageBand,
    analysis.globalLevel,
    analysis.profileType,
    analysis.primaryWeakDomain,
    [...(analysis.weakDomains || [])].sort().join("|"),
    [...(analysis.strongDomains || [])].sort().join("|"),
    [...(analysis.externalTestCategories || [])].sort().join("|"),
  ]
    .map((value) => String(value || "").trim())
    .join("::")
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

function buildRegulationParagraph(
  analysis: ClinicalAnalysis,
  seed: string
): LiteratureBlock {
  const levelText =
    String(analysis.globalLevel || "").toLowerCase() === "tipik"
      ? "genel düzeyde büyük ölçüde korunmuş"
      : "birden fazla alt sistemin birlikte düşünülmesini gerektiren"
  const developmentalIds = selectSourceIds(
    ["BLAIR_RAVER_2015", "MONTROY_ET_AL_2016", "CHEN_ET_AL_2024"],
    2,
    `${seed}:developmental-frame`
  )
  const contextIds = selectSourceIds(
    [
      "ROSANBALM_MURRAY_2017",
      "SANKALAITE_ET_AL_2021",
      "VERHAGEN_ET_AL_2024",
      "DE_RAEYMAECKER_DHAR_2022",
    ],
    1,
    `${seed}:context-frame`
  )
  const executiveIds = selectSourceIds(
    [
      "DIAMOND_2013",
      "BEST_MILLER_2010",
      "GARON_ET_AL_2008",
      "SILVA_ET_AL_2022",
      "STUCKE_DOEBEL_2024",
    ],
    2,
    `${seed}:executive-frame`
  )

  return createLiteratureBlock(
    [
      `Çocukluk dönemi literatürü, self-regülasyonu tek bir belirti kümesi olarak değil; bedensel uyarılma, dikkat, duygu düzenleme ve davranış kontrolünün birlikte örgütlendiği çok bileşenli bir gelişimsel yapı olarak ele alır ${inlineCitations(developmentalIds)}.`,
      `Bu nedenle mevcut profil, yalnız tek tek alan skorlarıyla değil, ${levelText} bir düzenleme örüntüsü olarak yorumlanmalıdır.`,
      `Bu örüntünün günlük yapı, yetişkin desteği ve ko-regülasyon koşullarıyla birlikte değerlendirilmesi gerekir ${inlineCitations(contextIds)}.`,
      `Dikkati sürdürme, davranışı durdurma, çalışma belleği ve esnek geçiş gibi süreçlerin aynı düzenleyici organizasyon içinde ele alınması da yürütücü işlev yazınıyla uyumludur ${inlineCitations(executiveIds)}.`,
    ].join(" "),
    [...developmentalIds, ...contextIds, ...executiveIds]
  )
}

function buildDomainParagraph(
  analysis: ClinicalAnalysis,
  seed: string
): LiteratureBlock {
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
  const sensoryIds = selectSourceIds(
    [
      "CARPENTER_ET_AL_2019",
      "BEN_SASSON_ET_AL_2009",
      "CASE_SMITH_ET_AL_2015",
      "SHAHBAZI_MIRZAKHANI_2021",
      "PILLER_ET_AL_2025",
    ],
    2,
    `${seed}:sensory`
  )
  const emotionIds = selectSourceIds(
    [
      "EISENBERG_ET_AL_2010",
      "THOMPSON_2019",
      "COLE_ET_AL_2004",
      "FREITAG_ET_AL_2023",
      "RESTOY_ET_AL_2024",
      "URBEN_ET_AL_2025",
      "LIANG_ET_AL_2025",
      "DE_RAEYMAECKER_DHAR_2022",
    ],
    2,
    `${seed}:emotion`
  )
  const physiologicalIds = selectSourceIds(
    ["KAHLE_ET_AL_2018", "GRAZIANO_DEREFINKO_2013", "BLAIR_RAVER_2015"],
    2,
    `${seed}:physiological`
  )
  const interoIds = selectSourceIds(
    [
      "PINNA_EDWARDS_2020",
      "CLARK_ET_AL_2025",
      "DUBOIS_ET_AL_2016",
      "MAYER_BENAROUS_ET_AL_2025",
    ],
    2,
    `${seed}:interoception`
  )
  const adaptiveIds = selectSourceIds(
    ["BLAIR_RAVER_2015", "STUCKE_DOEBEL_2024", "VERHAGEN_ET_AL_2024"],
    2,
    `${seed}:adaptive`
  )
  const socialIds = selectSourceIds(
    [
      "LIANG_ET_AL_2025",
      "STUCKE_DOEBEL_2024",
      "VERHAGEN_ET_AL_2024",
      "DE_RAEYMAECKER_DHAR_2022",
      "ROSANBALM_MURRAY_2017",
    ],
    2,
    `${seed}:social`
  )
  const languageIds = selectSourceIds(
    [
      "SCIONTI_ET_AL_2023",
      "MASEK_ET_AL_2023",
      "ROMEO_ET_AL_2022",
      "PAULS_ARCHIBALD_2016",
    ],
    2,
    `${seed}:language`
  )
  const cognitiveIds = selectSourceIds(
    [
      "MCCLELLAND_ET_AL_2007",
      "MONTROY_ET_AL_2016",
      "CHEN_ET_AL_2024",
      "STUCKE_DOEBEL_2024",
      "SILVA_ET_AL_2022",
      "ROMEO_ET_AL_2022",
    ],
    2,
    `${seed}:cognitive`
  )
  const executiveIds = selectSourceIds(
    [
      "DIAMOND_2013",
      "BEST_MILLER_2010",
      "GARON_ET_AL_2008",
      "SILVA_ET_AL_2022",
      "STUCKE_DOEBEL_2024",
      "BAO_ET_AL_2024",
    ],
    2,
    `${seed}:executive`
  )
  const motorIds = selectSourceIds(
    ["FOGEL_ET_AL_2023", "BAO_ET_AL_2024", "LI_ET_AL_2026"],
    2,
    `${seed}:motor`
  )
  const balancedIds = selectSourceIds(
    ["BLAIR_RAVER_2015", "CHEN_ET_AL_2024", "DIAMOND_2013", "STUCKE_DOEBEL_2024"],
    2,
    `${seed}:balanced`
  )

  const sensoryBlock = supportsSensoryContext
    ? createLiteratureBlock(
        `Duyusal işlemleme örüntüsü, uyaran türü, çevresel talep ve kullanılan ölçüm aracına göre ayrıştırılmalıdır. Çocukluk dönemi derlemeleri bu alandaki heterojenliği ve kanıt sınırlarını özellikle vurgular ${inlineCitations(sensoryIds)}.`,
        sensoryIds
      )
    : null

  const emotionBlock =
    hasAnyDomain(weakDomains, ["Duygusal Regülasyon"]) ||
    (!balancedProfile && hasAnyDomain(matchedDomains, ["Duygusal Regülasyon"]))
      ? createLiteratureBlock(
          `Duygusal yoğunluk, toparlanma süresi ve yatışma hızı tek bir davranıştan değil, bağlam içinde tekrarlanan düzenleme örüntüsünden okunmalıdır. Güncel ölçüm ve sonuç literatürü, duygu düzenleme güçlüklerinin çok boyutlu ve bağlama duyarlı olduğunu göstermektedir ${inlineCitations(emotionIds)}.`,
          emotionIds
        )
      : null

  const physiologicalBlock = supportsPhysiologicalContext
    ? createLiteratureBlock(
        `Fizyolojik regülasyon öne çıktığında reaktivite ile toparlanma birlikte değerlendirilmelidir. Otonom düzenleme ve adaptif işlev arasındaki grup düzeyi ilişkiler, beden-temelli klinik yorum için bir dayanak sağlar; ancak doğrudan fizyolojik ölçüm bulunmadığında bu ilişki gözlemsel düzeyde tutulmalıdır ${inlineCitations(physiologicalIds)}.`,
        physiologicalIds
      )
    : null

  const interoBlock =
    hasAnyDomain(weakDomains, ["İnterosepsiyon", "Fizyolojik Regülasyon"]) ||
    (!balancedProfile && hasAnyDomain(matchedDomains, ["İnterosepsiyon", "Fizyolojik Regülasyon"])) ||
    analysis.primaryWeakDomain === "İnterosepsiyon" ||
    analysis.primaryWeakDomain === "Fizyolojik Regülasyon" ||
    explicitInteroContext
      ? createLiteratureBlock(
          `Bedensel sinyali fark etme, anlamlandırma ve uygun yanıtla eşleştirme birbirinden ayrılmalıdır. Pediatrik interosepsiyon literatürü, bu boyutların duygu düzenleme ve günlük katılımla ilişkili fakat ölçüm yöntemine duyarlı olduğunu göstermektedir ${inlineCitations(interoIds)}.`,
          interoIds
        )
      : null

  const adaptiveBlock = supportsAdaptiveContext
    ? createLiteratureBlock(
        `${joinTestNames(adaptiveTestNames) || "Uyumsal davranış ve günlük yaşam testleri"}, kapasitenin günlük rutine ne ölçüde taşındığını gösterir. Bulgular; öz bakım, rutin başlatma, sorumluluk alma ve günlük akışın hangi koşullarda korunduğu ya da zorlandığı üzerinden yorumlanmalıdır ${inlineCitations(adaptiveIds)}.`,
        adaptiveIds
      )
    : null

  const socialBlock = supportsSocialCommunicationContext
    ? createLiteratureBlock(
        `${joinTestNames(socialTestNames) || "Sosyal-pragmatik iletişim testleri"} ile elde edilen karşılıklılık, pragmatik esneklik ve sosyal bağlamı sürdürme bulguları, regülasyon örüntüsünün etkileşimsel talep altında da değerlendirilmesini gerektirir ${inlineCitations(socialIds)}.`,
        socialIds
      )
    : null

  const languageBlock = supportsLanguageContext
    ? createLiteratureBlock(
        `${joinTestNames(languageTestNames) || "Dil testleri"} ile görünür hale gelen alıcı-ifade edici dil güçlüğü, sözel talep arttığında anlama, bilgiyi zihinde tutma ve görevi sürdürme süreçleriyle birlikte yorumlanmalıdır. Dil ve yürütücü işlev arasındaki gelişimsel ilişki bu bütüncül okumayı destekler ${inlineCitations(languageIds)}.`,
        languageIds
      )
    : null

  const cognitiveBlock = supportsCognitiveContext && !supportsLanguageContext
    ? createLiteratureBlock(
        `Bilişsel regülasyon dikkat, görevde kalma ve zihinsel organizasyon üzerinden öne çıktığında, performansın talep düzeyi ve bağlamla nasıl değiştiği incelenmelidir. Erken çocukluk çalışmaları bu becerilerin öğrenme, dil ve sosyal-davranışsal sonuçlarla ilişkili, gelişimsel bir sistem olduğunu destekler ${inlineCitations(cognitiveIds)}.`,
        cognitiveIds
      )
    : null

  const executiveBlock = supportsExecutiveContext
    ? createLiteratureBlock(
        `Yürütücü işlev ekseni belirginleştiğinde inhibisyon, çalışma belleği, esneklik ve hedefe yönelik davranış birlikte ele alınmalıdır. Sistematik derlemeler bu alanın tek bir davranış belirtisine veya tek bir ölçüm aracına indirgenmemesi gerektiğini göstermektedir ${inlineCitations(executiveIds)}.`,
        executiveIds
      )
    : null

  const motorBlock = supportsMotorPraxisContext
    ? createLiteratureBlock(
        `${joinTestNames(praxisTestNames) || "Motor planlama testleri"} ile ortaya konan praksi, sekanslama ve beden organizasyonu bulguları; davranış organizasyonu, görev sürdürme ve katılım örüntüsüyle birlikte anlam kazanır. Motor beceri ile yürütücü işlev arasındaki grup düzeyi ilişki bu bağlantılı okumayı destekler ${inlineCitations(motorIds)}.`,
        motorIds
      )
    : null

  const hasSpecificBlock = Boolean(
    sensoryBlock ||
      emotionBlock ||
      physiologicalBlock ||
      interoBlock ||
      adaptiveBlock ||
      socialBlock ||
      languageBlock ||
      cognitiveBlock ||
      executiveBlock ||
      motorBlock
  )
  const balancedBlock = balancedProfile && !hasSpecificBlock
    ? createLiteratureBlock(
        `Alanların genel olarak tipik aralıkta kalması, dikkat, duygu düzenleme ve davranış kontrolünün değerlendirme koşullarında birlikte işleyebildiğini düşündürür. Bununla birlikte korunmuş skorlar tüm günlük bağlamlara otomatik olarak genellenmemeli; gelişimsel yorum farklı bilgi kaynaklarıyla birlikte sürdürülmelidir ${inlineCitations(balancedIds)}.`,
        balancedIds
      )
    : null

  const orderedSentences =
    primaryExternalTestCategory === "motor_praxis"
      ? [motorBlock, executiveBlock, sensoryBlock, emotionBlock, physiologicalBlock, interoBlock, adaptiveBlock, socialBlock, languageBlock, cognitiveBlock, balancedBlock]
      : primaryExternalTestCategory === "language_communication"
      ? [languageBlock, cognitiveBlock, executiveBlock, emotionBlock, sensoryBlock, adaptiveBlock, socialBlock, physiologicalBlock, interoBlock, motorBlock, balancedBlock]
      : primaryExternalTestCategory === "adaptive_daily_living"
      ? [adaptiveBlock, interoBlock, physiologicalBlock, emotionBlock, sensoryBlock, executiveBlock, cognitiveBlock, socialBlock, languageBlock, motorBlock, balancedBlock]
      : primaryExternalTestCategory === "social_pragmatic"
      ? [socialBlock, emotionBlock, executiveBlock, adaptiveBlock, sensoryBlock, languageBlock, cognitiveBlock, physiologicalBlock, interoBlock, motorBlock, balancedBlock]
      : [sensoryBlock, emotionBlock, physiologicalBlock, interoBlock, executiveBlock, cognitiveBlock, adaptiveBlock, socialBlock, languageBlock, motorBlock, balancedBlock]

  const availableBlocks = orderedSentences.filter(
    (block): block is LiteratureBlock => Boolean(block?.text)
  )

  const selectedBlocks =
    balancedProfile
      ? availableBlocks.slice(0, 2)
      : selectiveProfile
      ? availableBlocks.slice(0, 3)
      : availableBlocks.slice(0, 5)

  return createLiteratureBlock(
    selectedBlocks.map((block) => block.text).join(" "),
    selectedBlocks.flatMap((block) => block.sourceIds)
  )
}

function buildIntegrationParagraph(
  analysis: ClinicalAnalysis,
  seed: string
): LiteratureBlock {
  const therapistInsights = analysis.therapistInsights || []
  const externalClinicalFindings = analysis.externalClinicalFindings || []
  const balancedProfile = String(analysis.globalLevel || "").toLowerCase() === "tipik" && (analysis.weakDomains || []).length === 0
  const primaryExternalTestCategory = analysis.primaryExternalTestCategory || null
  const observationIds =
    primaryExternalTestCategory === "motor_praxis"
      ? selectSourceIds(
          ["FOGEL_ET_AL_2023", "BAO_ET_AL_2024", "LI_ET_AL_2026"],
          2,
          `${seed}:integration-observation-motor`
        )
      : selectSourceIds(
          [
            "ROSANBALM_MURRAY_2017",
            "SANKALAITE_ET_AL_2021",
            "VERHAGEN_ET_AL_2024",
            "DE_RAEYMAECKER_DHAR_2022",
          ],
          2,
          `${seed}:integration-observation`
        )
  const casePool =
    primaryExternalTestCategory === "motor_praxis"
      ? ["FOGEL_ET_AL_2023", "BAO_ET_AL_2024", "LI_ET_AL_2026"]
      : primaryExternalTestCategory === "language_communication"
      ? ["SCIONTI_ET_AL_2023", "MASEK_ET_AL_2023", "ROMEO_ET_AL_2022", "PAULS_ARCHIBALD_2016"]
      : primaryExternalTestCategory === "social_pragmatic"
      ? ["LIANG_ET_AL_2025", "STUCKE_DOEBEL_2024", "VERHAGEN_ET_AL_2024"]
      : primaryExternalTestCategory === "adaptive_daily_living"
      ? ["BLAIR_RAVER_2015", "STUCKE_DOEBEL_2024", "VERHAGEN_ET_AL_2024"]
      : hasAnyDomain(analysis.weakDomains, ["Bilişsel Regülasyon", "Yürütücü İşlev"])
      ? ["DIAMOND_2013", "STUCKE_DOEBEL_2024", "SILVA_ET_AL_2022", "CHEN_ET_AL_2024"]
      : ["BLAIR_RAVER_2015", "CHEN_ET_AL_2024", "MONTROY_ET_AL_2016"]
  const caseIds = selectSourceIds(casePool, 2, `${seed}:integration-case`)
  const contrastIds = selectSourceIds(
    ["CHEN_ET_AL_2024", "SILVA_ET_AL_2022", "FREITAG_ET_AL_2023", "COLE_ET_AL_2004"],
    2,
    `${seed}:integration-contrast`
  )

  const contrastSentence =
    analysis.strongDomains && analysis.strongDomains.length > 0
      ? `Korunmuş alanların açıkça belirtilmesi, profilin yalnız güçlükler üzerinden okunmasını önler. Ölçüm literatürü, güçlü ve zayıf alanların farklı bilgi kaynaklarıyla birlikte ele alınmasını destekler ${inlineCitations(contrastIds)}.`
      : `Korunmuş alanların sınırlı olduğu örüntülerde bile profilin bütününü bağlam içinde okumak ve tek bir skor üzerinden aşırı yorum yapmamak gerekir ${inlineCitations(contrastIds)}.`

  const caseSentence = balancedProfile
    ? `Korunmuş profillerde dikkat, davranış ve beden temelli düzenleme süreçlerinin birlikte işleyebilmesi gelişimsel çerçeveyle uyumludur; yine de işlevsellik farklı günlük talepler altında izlenmelidir ${inlineCitations(caseIds)}.`
    : primaryExternalTestCategory === "adaptive_daily_living"
    ? `Uyumsal işlev verileriyle birlikte okunan profillerde self-regülasyon zorluğu, kapasitenin günlük yaşam, öz bakım ve sorumluluk akışına ne ölçüde taşınabildiği üzerinden anlam kazanır ${inlineCitations(caseIds)}.`
    : primaryExternalTestCategory === "social_pragmatic"
    ? `Sosyal-pragmatik verilerle desteklenen profillerde self-regülasyon zorluğu yalnız bireysel performansta değil; sosyal bağlamı izleme, karşılıklılığı sürdürme ve uygun yanıt üretme düzleminde de görünür ${inlineCitations(caseIds)}.`
    : primaryExternalTestCategory === "language_communication"
    ? `Dil testleriyle desteklenen profillerde self-regülasyon zorluğu sözel talep arttığında görünür hale gelebilir; anlama, görevi zihinde tutma ve davranışı sürdürme süreçleri birlikte değerlendirilmelidir ${inlineCitations(caseIds)}.`
    : primaryExternalTestCategory === "motor_praxis"
    ? `Motor planlama ve beden organizasyonu bulguları, yürütücü organizasyon ve görev sürdürme süreçleriyle birlikte ele alındığında işlevsel açıdan daha anlamlıdır ${inlineCitations(caseIds)}.`
    : hasAnyDomain(analysis.weakDomains, ["Bilişsel Regülasyon", "Yürütücü İşlev"])
    ? `Bilişsel ve yürütücü alanlara yayılan kırılganlıklar birlikte ele alınmalıdır; dikkat, çalışma belleği, inhibisyon ve esneklik aynı düzenleyici organizasyon içinde karşılıklı etkileşir ${inlineCitations(caseIds)}.`
    : `Skor örüntüsü tek bir alanda görünse bile diğer düzenleyici sistemlerle birlikte yorumlanmalıdır; çocukluk dönemi self-regülasyon süreçleri parçalı değil etkileşimli işler ${inlineCitations(caseIds)}.`

  const observationSentence =
    primaryExternalTestCategory === "motor_praxis"
      ? `Motor planlama gözlemlerinin görev talebi ve günlük katılımla birlikte değerlendirilmesi, motor-yürütücü ilişkiyi ele alan güncel kanıtla uyumludur ${inlineCitations(observationIds)}.`
      : therapistInsights.length > 0 || externalClinicalFindings.length > 0
      ? `Vaka içinde gözlenen bağlamsal değişkenlik, self-regülasyonun çocuk, görev ve çevre koşullarıyla birlikte değerlendirilmesi gerektiğini gösteren gelişimsel çerçeveyle uyumludur ${inlineCitations(observationIds)}.`
      : `Bakımveren gözlemleri klinik bağlamla birlikte okunduğunda self-regülasyon profilinin günlük yaşamdaki karşılığını daha görünür kılar ${inlineCitations(observationIds)}.`

  return createLiteratureBlock(
    [observationSentence, caseSentence, contrastSentence].join(" "),
    [...observationIds, ...caseIds, ...contrastIds]
  )
}

function buildLiteratureBoundaryParagraph(): string {
  return "Bu kaynaklar, vaka bulgularını gelişimsel ve işlevsel bir çerçevede yorumlamak için kullanılmıştır. Literatür desteği tek başına tanısal sonuç, nedensellik açıklaması veya doğrudan klinik karar anlamına gelmez."
}

export function buildLiteratureAlignedSection(
  analysis: ClinicalAnalysis,
  context: LiteratureSelectionContext = {}
): {
  text: string
  sourceIds: string[]
} | null {
  if (!analysis) return null

  const seed = buildSelectionSeed(analysis, context)
  const paragraph1 = buildRegulationParagraph(analysis, seed)
  const paragraph2 = buildDomainParagraph(analysis, seed)
  const paragraph3 = buildIntegrationParagraph(analysis, seed)
  const bodyParagraphs = [paragraph1.text, paragraph2.text, paragraph3.text]
  const sourceIds = uniqueNonEmpty([
    ...paragraph1.sourceIds,
    ...paragraph2.sourceIds,
    ...paragraph3.sourceIds,
  ])

  const references = uniqueNonEmpty(
    sourceIds.map((sourceId) => VERIFIED_LITERATURE_SOURCES[sourceId]?.apaReference)
  )

  const body = [
    ...bodyParagraphs,
    buildLiteratureBoundaryParagraph(),
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

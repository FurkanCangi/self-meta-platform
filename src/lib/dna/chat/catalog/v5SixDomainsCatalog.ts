import {
  DNA_CHAT_CATALOG_VERSION,
  type DnaChatCatalogClaim,
  type DnaChatCatalogRelation,
  type DnaChatCatalogSafetyRule,
  type DnaChatCatalogSource,
  type DnaChatCatalogTopic,
} from "./types"

function source(
  input: Omit<
    DnaChatCatalogSource,
    "version" | "sourceVerified" | "verifiedAt"
  >,
): DnaChatCatalogSource {
  return Object.freeze({
    version: DNA_CHAT_CATALOG_VERSION,
    sourceVerified: true as const,
    verifiedAt: "2026-07-17",
    ...input,
  })
}

function topic(
  input: Omit<DnaChatCatalogTopic, "version" | "reviewStatus">,
): DnaChatCatalogTopic {
  return Object.freeze({
    version: DNA_CHAT_CATALOG_VERSION,
    reviewStatus: "source_verified_expert_pending" as const,
    ...input,
  })
}

function claim(
  input: Omit<
    DnaChatCatalogClaim,
    "version" | "safetyStatus" | "sourceVerified"
  >,
): DnaChatCatalogClaim {
  return Object.freeze({
    version: DNA_CHAT_CATALOG_VERSION,
    safetyStatus: "safe" as const,
    sourceVerified: true as const,
    ...input,
  })
}

function relation(
  input: Omit<DnaChatCatalogRelation, "version" | "maxHops">,
): DnaChatCatalogRelation {
  return Object.freeze({
    version: DNA_CHAT_CATALOG_VERSION,
    maxHops: 1 as const,
    ...input,
  })
}

function safetyRule(
  input: Omit<DnaChatCatalogSafetyRule, "version">,
): DnaChatCatalogSafetyRule {
  return Object.freeze({ version: DNA_CHAT_CATALOG_VERSION, ...input })
}

/**
 * Only sources whose DOI is not already present in the main catalog live here.
 * The four PMID repairs discovered during package audit are retained in the
 * relevant records instead of copying the erroneous package URLs.
 */
export const V5_SIX_DOMAINS_SOURCES: readonly DnaChatCatalogSource[] =
  Object.freeze([
    source({
      id: "DUCKWORTH_KERN_2011",
      title:
        "A meta-analysis of the convergent validity of self-control measures",
      authors: "Duckworth, A. L., & Kern, M. L.",
      year: 2011,
      publication: "Journal of Research in Personality, 45(3), 259-268",
      publicationStatus: "published",
      studyType: "Meta-analiz",
      doi: "10.1016/j.jrp.2011.02.004",
      pmid: null,
      url: "https://doi.org/10.1016/j.jrp.2011.02.004",
      evidenceDomain: "self_regulation_measurement_convergence",
      ageScope: "mixed",
      claimBoundary:
        "Ölçümlerin yakınsamasını grup düzeyinde değerlendirir; DNA alanlarının geçerliğini veya tek bir ortak kapasiteyi göstermez.",
    }),
    source({
      id: "ENKAVI_ET_AL_2019",
      title:
        "Large-scale analysis of test-retest reliabilities of self-regulation measures",
      authors:
        "Enkavi, A. Z., Eisenberg, I. W., Bissett, P. G., Mazza, G. L., MacKinnon, D. P., Marsch, L. A., & Poldrack, R. A.",
      year: 2019,
      publication:
        "Proceedings of the National Academy of Sciences, 116(12), 5472-5477",
      publicationStatus: "published",
      studyType: "Büyük örneklemli test-tekrar test çalışması",
      doi: "10.1073/pnas.1818430116",
      pmid: null,
      url: "https://doi.org/10.1073/pnas.1818430116",
      evidenceDomain: "self_regulation_measurement_reliability",
      ageScope: "adult_weighted",
      claimBoundary:
        "Yetişkin ağırlıklı görev güvenirliğini değerlendirir; çocuk DNA profiline veya bireysel kararlılığa doğrudan genellenemez.",
    }),
    source({
      id: "HENRICH_ET_AL_2010",
      title: "The weirdest people in the world?",
      authors: "Henrich, J., Heine, S. J., & Norenzayan, A.",
      year: 2010,
      publication: "Behavioral and Brain Sciences, 33(2-3), 61-83",
      publicationStatus: "published",
      studyType: "Kültürel genellenebilirlik derlemesi",
      doi: "10.1017/S0140525X0999152X",
      pmid: null,
      url: "https://doi.org/10.1017/S0140525X0999152X",
      evidenceDomain: "cultural_generalizability",
      ageScope: "mixed",
      claimBoundary:
        "Örneklem yanlılığına ilişkin genel sınırı destekler; her DNA maddesinin kültürel geçerli veya geçersiz olduğunu göstermez.",
    }),
    source({
      id: "NEUHUBER_BERTHOUD_2022",
      title:
        "Functional anatomy of the vagus system: How does the polyvagal theory comply?",
      authors: "Neuhuber, W., & Berthoud, H.-R.",
      year: 2022,
      publication: "Biological Psychology, 174, 108425",
      publicationStatus: "published",
      studyType: "Eleştirel anatomi derlemesi",
      doi: "10.1016/j.biopsycho.2022.108425",
      pmid: "36100134",
      url: "https://doi.org/10.1016/j.biopsycho.2022.108425",
      evidenceDomain: "polyvagal_anatomy_boundary",
      ageScope: "mixed",
      claimBoundary:
        "Polivagal öncülleri anatomi açısından tartışır; davranıştan vagal durum etiketi veya kişisel mekanizma üretmez.",
      repairNote:
        "Altı alan paketindeki K34 PubMed URL'si 35963295 yerine doğru PMID 36100134 olarak düzeltildi.",
    }),
    source({
      id: "VAN_HULLE_ET_AL_2015",
      title:
        "Trajectories of sensory over-responsivity from early to middle childhood: Birth and temperament risk factors",
      authors: "Van Hulle, C., Lemery-Chalfant, K., & Goldsmith, H. H.",
      year: 2015,
      publication: "PLOS ONE, 10(6), e0129968",
      publicationStatus: "published",
      studyType: "Boylamsal gelişimsel çalışma",
      doi: "10.1371/journal.pone.0129968",
      pmid: null,
      url: "https://doi.org/10.1371/journal.pone.0129968",
      evidenceDomain: "sensory_reactivity_trajectories",
      ageScope: "childhood",
      claimBoundary:
        "Grup düzeyi duyusal örüntü yörüngelerini destekler; tek ölçümden kalıcı tip, tanı veya prognoz sağlamaz.",
    }),
    source({
      id: "CHIEN_ET_AL_2016",
      title:
        "Sensory processing and its relationship with children's daily life participation",
      authors:
        "Chien, C.-W., Rodger, S., Copley, J., Branjerdporn, G., & Taggart, C.",
      year: 2016,
      publication:
        "Physical & Occupational Therapy in Pediatrics, 36(1), 73-87",
      publicationStatus: "published",
      studyType: "Çocukluk katılım çalışması",
      doi: "10.3109/01942638.2015.1040573",
      pmid: "26422598",
      url: "https://doi.org/10.3109/01942638.2015.1040573",
      evidenceDomain: "sensory_daily_participation",
      ageScope: "childhood",
      claimBoundary:
        "Duyusal özellikler ile katılım arasındaki grup ilişkisini destekler; tek yönlü neden, tanı veya biyolojik mekanizma göstermez.",
    }),
    source({
      id: "THOMPSON_1994",
      title: "Emotion regulation: A theme in search of definition",
      authors: "Thompson, R. A.",
      year: 1994,
      publication:
        "Monographs of the Society for Research in Child Development, 59(2-3), 25-52",
      publicationStatus: "published",
      studyType: "Kavramsal gelişimsel derleme",
      doi: "10.1111/j.1540-5834.1994.tb01276.x",
      pmid: null,
      url: "https://doi.org/10.1111/j.1540-5834.1994.tb01276.x",
      evidenceDomain: "emotion_regulation_definition",
      ageScope: "developmental",
      claimBoundary:
        "Duygu düzenleme kavramını açıklar; görünür sakinliği, tanıyı veya tek bir biyolojik sistemi doğrulamaz.",
    }),
    source({
      id: "EISENBERG_SPINRAD_2004",
      title: "Emotion-related regulation: Sharpening the definition",
      authors: "Eisenberg, N., & Spinrad, T. L.",
      year: 2004,
      publication: "Child Development, 75(2), 334-339",
      publicationStatus: "published",
      studyType: "Kavramsal gelişimsel makale",
      doi: "10.1111/j.1467-8624.2004.00674.x",
      pmid: null,
      url: "https://doi.org/10.1111/j.1467-8624.2004.00674.x",
      evidenceDomain: "emotion_reactivity_regulation_distinction",
      ageScope: "developmental",
      claimBoundary:
        "Duygusal reaktivite ile düzenleme ayrımını destekler; tek davranıştan duygu durumu veya tanı çıkarımı sağlamaz.",
    }),
    source({
      id: "FREITAG_ET_AL_2023",
      title:
        "Questionnaire-based measurement of emotion dysregulation in children and adolescents",
      authors:
        "Freitag, G. F., Grassie, H. L., Jeong, A., Mallidi, A., Comer, J. S., Ehrenreich-May, J., & Brotman, M. A.",
      year: 2023,
      publication:
        "Journal of the American Academy of Child & Adolescent Psychiatry, 62(7), 728-763",
      publicationStatus: "published",
      studyType: "Sistematik ölçüm derlemesi",
      doi: "10.1016/j.jaac.2022.07.866",
      pmid: null,
      url: "https://doi.org/10.1016/j.jaac.2022.07.866",
      evidenceDomain: "child_emotion_measurement",
      ageScope: "developmental",
      claimBoundary:
        "Ölçek heterojenliğini destekler; tek puandan tanı, içsel duygu veya biyolojik mekanizma çıkarımı sağlamaz.",
      existingLiteratureId: "FREITAG_ET_AL_2023",
    }),
    source({
      id: "FRIEDMAN_MIYAKE_2017",
      title:
        "Unity and diversity of executive functions: Individual differences as a window on cognitive structure",
      authors: "Friedman, N. P., & Miyake, A.",
      year: 2017,
      publication: "Cortex, 86, 186-204",
      publicationStatus: "published",
      studyType: "Kavramsal ve ampirik sentez",
      doi: "10.1016/j.cortex.2016.04.023",
      pmid: "27251123",
      url: "https://doi.org/10.1016/j.cortex.2016.04.023",
      evidenceDomain: "executive_function_structure",
      ageScope: "mixed",
      claimBoundary:
        "Yürütücü işlevlerin birlik ve çeşitliliğini destekler; tek frontal yeti, DNA faktör yapısı veya bireysel mekanizma göstermez.",
    }),
    source({
      id: "KASSAI_ET_AL_2019",
      title:
        "A meta-analysis of the experimental evidence on the near- and far-transfer effects among children's executive function skills",
      authors: "Kassai, R., Futo, J., Demetrovics, Z., & Takacs, Z. K.",
      year: 2019,
      publication: "Psychological Bulletin, 145(2), 165-188",
      publicationStatus: "published",
      studyType: "Meta-analiz",
      doi: "10.1037/bul0000180",
      pmid: "30652908",
      url: "https://doi.org/10.1037/bul0000180",
      evidenceDomain: "executive_function_transfer",
      ageScope: "childhood",
      claimBoundary:
        "Yakın ve uzak transferi grup düzeyinde değerlendirir; tek görev kazancının genel DNA kapasitesi değişimi olduğunu göstermez.",
      repairNote:
        "Altı alan paketindeki K72 PubMed URL'si 30589311 yerine doğru PMID 30652908 olarak düzeltildi.",
    }),
    source({
      id: "SCIONTI_ET_AL_2020",
      title:
        "Is cognitive training effective for improving executive functions in preschoolers? A systematic review and meta-analysis",
      authors: "Scionti, N., Cavallero, M., Zogmaister, C., & Marzocchi, G. M.",
      year: 2020,
      publication: "Frontiers in Psychology, 10, 2812",
      publicationStatus: "published",
      studyType: "Sistematik derleme ve meta-analiz",
      doi: "10.3389/fpsyg.2019.02812",
      pmid: "31998168",
      url: "https://doi.org/10.3389/fpsyg.2019.02812",
      evidenceDomain: "preschool_executive_training",
      ageScope: "early_childhood",
      claimBoundary:
        "Okul öncesi bilişsel eğitim bulgularını özetler; görev gelişimini genel düzenleme, uzak transfer veya kişisel tedavi sonucu saymaz.",
      repairNote:
        "Altı alan paketindeki K73 PubMed URL'si 31920898 yerine doğru PMID 31998168 olarak düzeltildi.",
    }),
    source({
      id: "CRITCHLEY_GARFINKEL_2017",
      title: "Interoception and emotion",
      authors: "Critchley, H. D., & Garfinkel, S. N.",
      year: 2017,
      publication: "Current Opinion in Psychology, 17, 7-14",
      publicationStatus: "published",
      studyType: "Anlatısal derleme",
      doi: "10.1016/j.copsyc.2017.04.020",
      pmid: null,
      url: "https://doi.org/10.1016/j.copsyc.2017.04.020",
      evidenceDomain: "interoception_emotion",
      ageScope: "adult_weighted",
      claimBoundary:
        "İnterosepsiyon-duygu ilişkisini kuramsal olarak destekler; çocukta nedensellik, insula işlevi veya DNA alan eşdeğerliği göstermez.",
    }),
    source({
      id: "MURPHY_ET_AL_2019_INTEROCEPTION",
      title:
        "Classifying individual differences in interoception: Implications for the measurement of interoceptive awareness",
      authors: "Murphy, J., Catmur, C., & Bird, G.",
      year: 2019,
      publication: "Psychonomic Bulletin & Review, 26(5), 1467-1471",
      publicationStatus: "published",
      studyType: "Kavramsal ölçüm makalesi",
      doi: "10.3758/s13423-019-01632-7",
      pmid: "31270764",
      url: "https://doi.org/10.3758/s13423-019-01632-7",
      evidenceDomain: "interoception_dimensions",
      ageScope: "adult_weighted",
      claimBoundary:
        "İnteroseptif boyutların ayrımını destekler; yetişkin sınıflamasını çocuk DNA profilinin doğrulaması olarak kullanmaz.",
    }),
    source({
      id: "DESMEDT_ET_AL_2022_SELF_REPORT",
      title: "What do measures of self-report interoception measure?",
      authors: "Desmedt, O., Heeren, A., Corneille, O., & Luminet, O.",
      year: 2022,
      publication: "Biological Psychology, 169, 108289",
      publicationStatus: "published",
      studyType: "Sistematik derleme ve psikometrik sentez",
      doi: "10.1016/j.biopsycho.2022.108289",
      pmid: "35150768",
      url: "https://doi.org/10.1016/j.biopsycho.2022.108289",
      evidenceDomain: "interoception_self_report_measurement",
      ageScope: "adult_weighted",
      claimBoundary:
        "Öz-bildirim araçlarının farklı içeriklerini destekler; nesnel interoseptif doğruluk, organ işlevi veya çocuk profili göstermez.",
    }),
  ])

export const V5_SIX_DOMAINS_TOPICS: readonly DnaChatCatalogTopic[] =
  Object.freeze([
    topic({
      id: "dna.six_domains",
      category: "self_regulation",
      title: "DNA'nın altı işlevsel alanı",
      aliases: [
        "dna altı alan",
        "dna alti alan",
        "altı regülasyon alanı",
        "dna alanları",
        "dna domainleri",
      ],
      summary:
        "DNA; fizyolojik, duyusal, duygusal, bilişsel, yürütücü işlev ve interosepsiyon başlıklarını kurum içi işlevsel bilgi düzenleme alanları olarak kullanır.",
      details: [
        "Bu altı başlık, bilimsel literatürde doğrulanmış doğal altı faktör veya birbirinden kopuk altı biyolojik sistem değildir.",
        "Alanların ayrışması, ortak üst faktörü ve yaşlar arası ölçüm değişmezliği DNA verisinde ayrıca psikometrik olarak sınanmalıdır.",
      ],
      keywords: [
        "dna",
        "altı alan",
        "işlevsel sınıflama",
        "faktör",
        "alan profili",
        "taksonomi",
      ],
      claimIds: [
        "claim.dna.six_domains.institutional_framework",
        "claim.dna.six_domains.not_biological_taxonomy",
        "claim.dna.six_domains.psychometric_boundary",
      ],
      sourceIds: [
        "NIGG_2017",
        "INZLICHT_ET_AL_2021",
        "KARR_ET_AL_2018",
        "TOPLAK_ET_AL_2013",
      ],
      evidenceLevel: "boundary",
      ageScope: "developmental",
      claimBoundary:
        "Altı alan tanı kategorileri, beyin modülleri, biyobelirteçler veya bilimsel olarak doğrulanmış bağımsız DNA faktörleri değildir.",
    }),
    topic({
      id: "dna.physiological_regulation",
      category: "self_regulation",
      title: "DNA fizyolojik regülasyon alanı",
      aliases: [
        "fizyolojik regülasyon alanı",
        "dna fizyolojik",
        "fizyolojik alan",
        "bedensel regülasyon alanı",
      ],
      summary:
        "DNA'nın fizyolojik alanı durum, enerji, uyarılma, reaktivite ve toparlanmanın günlük işleve etkisini işlevsel düzeyde düzenler.",
      details: [
        "Uyku-uyanıklık örüntüsü, yorgunluk, toparlanma süresi ve desteğe yanıt bağlamsal gözlem sağlayabilir.",
        "Bu gözlemler ANS dengesi, HRV, kortizol, HPA ekseni, vagal tonus veya allostatik yük ölçümü değildir.",
      ],
      keywords: [
        "fizyolojik",
        "enerji",
        "uyarılma",
        "reaktivite",
        "toparlanma",
        "yorgunluk",
      ],
      claimIds: [
        "claim.dna.physiological.functional_definition",
        "claim.dna.physiological.biological_boundary",
      ],
      sourceIds: ["MCEWEN_2007", "GUNNAR_QUEVEDO_2007", "BLAIR_RAVER_2015"],
      evidenceLevel: "theoretical",
      ageScope: "developmental",
      claimBoundary:
        "DNA fizyolojik alanı biyolojik sağlık skoru veya otonom sinir sistemi ölçümü değildir.",
    }),
    topic({
      id: "dna.sensory_regulation",
      category: "self_regulation",
      title: "DNA duyusal regülasyon alanı",
      aliases: [
        "duyusal regülasyon alanı",
        "dna duyusal",
        "duyusal alan",
        "duyu regülasyonu",
      ],
      summary:
        "DNA'nın duyusal alanı belirli uyaran özelliklerinin dikkat, eylem, yaklaşma-kaçınma ve katılımla ilişkisini işlevsel olarak düzenler.",
      details: [
        "Uyaranın niteliği, tepki, süre, bağlam ve işlevsel etki birlikte betimlenir.",
        "Derecelendirme veya gözlem psikofiziksel eşik, kortikal işlemleme, otonom yanıt ya da bağımsız tanı ölçmez.",
      ],
      keywords: [
        "duyusal",
        "uyaran",
        "kaçınma",
        "arayış",
        "katılım",
        "duyusal eşik",
      ],
      claimIds: [
        "claim.dna.sensory.functional_definition",
        "claim.dna.sensory.measurement_boundary",
      ],
      sourceIds: ["DUNN_2001", "WATKYNS_ET_AL_2024", "CHIEN_ET_AL_2016"],
      evidenceLevel: "moderate",
      ageScope: "childhood",
      claimBoundary:
        "Duyusal alan puanı nörolojik eşik, otonom durum, otizm, travma veya duyusal bozukluk tanısı değildir.",
    }),
    topic({
      id: "dna.emotional_regulation",
      category: "self_regulation",
      title: "DNA duygusal regülasyon alanı",
      aliases: [
        "duygusal regülasyon alanı",
        "dna duygusal",
        "duygusal alan",
        "duygu düzenleme alanı",
      ],
      summary:
        "DNA'nın duygusal alanı reaktivite, strateji, esneklik, yardım kullanımı ve işlevsel yeniden katılımı bağlam içinde ele alır.",
      details: [
        "Düzenleme duygunun yokluğu veya yalnız görünür sakinlik değildir.",
        "Gözlenen davranış limbik sistem, nörotransmiter, kesin içsel duygu veya psikiyatrik tanı ölçümü değildir.",
      ],
      keywords: [
        "duygusal",
        "reaktivite",
        "strateji",
        "esneklik",
        "sakinlik",
        "yeniden katılım",
      ],
      claimIds: [
        "claim.dna.emotional.functional_definition",
        "claim.dna.emotional.calmness_boundary",
      ],
      sourceIds: [
        "COLE_ET_AL_2004",
        "GROSS_2015",
        "THOMPSON_1994",
        "EISENBERG_SPINRAD_2004",
      ],
      evidenceLevel: "moderate",
      ageScope: "developmental",
      claimBoundary:
        "Duygusal alan puanı anksiyete, psikopatoloji, limbik işlev veya gerçek içsel duygu düzeyi değildir.",
    }),
    topic({
      id: "dna.cognitive_regulation",
      category: "self_regulation",
      title: "DNA bilişsel regülasyon alanı",
      aliases: [
        "bilişsel regülasyon alanı",
        "dna bilişsel",
        "bilissel regulasyon",
        "bilişsel alan",
        "strateji düzenleme",
      ],
      summary:
        "DNA'nın bilişsel alanı dikkati yeniden kurma, ilgili bilgiyi seçme, beklentiyi güncelleme, strateji üretme ve geri bildirimi kullanma gibi işlevsel içerikleri düzenler.",
      details: [
        "Bilişsel regülasyonun yürütücü işlevden bağımsız, standartlaşmış bir çocukluk faktörü olduğu gösterilmemiştir.",
        "Alan; dikkat, dil, bilgi, motivasyon, metabiliş ve yürütücü taleplerden operasyonel olarak ayrıştırılmalıdır.",
      ],
      keywords: [
        "bilişsel",
        "dikkat",
        "strateji",
        "beklenti",
        "geri bildirim",
        "metabiliş",
      ],
      claimIds: [
        "claim.dna.cognitive.operational_definition",
        "claim.dna.cognitive.independence_not_established",
      ],
      sourceIds: [
        "NIGG_2017",
        "INZLICHT_ET_AL_2021",
        "DOEBEL_2020",
        "TOPLAK_ET_AL_2013",
      ],
      evidenceLevel: "limited",
      ageScope: "developmental",
      claimBoundary:
        "Bilişsel alan bağımsız biyolojik modül, genel zekâ, dikkat tanısı veya doğrulanmış ayrı DNA faktörü değildir.",
    }),
    topic({
      id: "dna.executive_function_domain",
      category: "self_regulation",
      title: "DNA yürütücü işlev alanı",
      aliases: [
        "dna yürütücü işlev",
        "yürütücü işlev alanı",
        "yurutucu alan",
        "dna executive",
      ],
      summary:
        "DNA'nın yürütücü alanı çalışma belleği, ketleyici kontrol, bilişsel esneklik ve hedef sürdürme taleplerini işlevsel düzeyde düzenler.",
      details: [
        "Hangi kontrol talebinin ve görev koşulunun performansı sınırladığı açıkça belirtilmelidir.",
        "Tek görev veya puan saf yürütücü bileşen, prefrontal kapasite, genel zekâ ya da tanı değildir.",
      ],
      keywords: [
        "yürütücü",
        "çalışma belleği",
        "inhibisyon",
        "esneklik",
        "hedef",
        "görev",
      ],
      claimIds: [
        "claim.dna.executive.functional_definition",
        "claim.dna.executive.task_and_brain_boundary",
      ],
      sourceIds: [
        "DIAMOND_2013",
        "MIYAKE_ET_AL_2000",
        "KARR_ET_AL_2018",
        "FRIEDMAN_MIYAKE_2017",
      ],
      evidenceLevel: "strong",
      ageScope: "developmental",
      claimBoundary:
        "Yürütücü alan puanı PFC işlevi, bilişsel bozukluk, zekâ veya değişmez bireysel kapasite değildir.",
    }),
    topic({
      id: "dna.interoception_domain",
      category: "self_regulation",
      title: "DNA interosepsiyon alanı",
      aliases: [
        "dna interosepsiyon",
        "interosepsiyon alanı",
        "beden sinyali alanı",
        "iç beden farkındalığı alanı",
      ],
      summary:
        "DNA'nın interosepsiyon alanı iç bedensel sinyali fark etme, ayırt etme, yerini belirleme, anlamlandırma ve uygun eylemle ilişkilendirme davranışlarını düzenler.",
      details: [
        "Fark etme, adlandırma ve eyleme dönüştürme ayrı süreçlerdir; dil ve görev anlama performansı etkileyebilir.",
        "Gözlem veya öz-bildirim nesnel interoseptif doğruluk, organ sinyali iletimi ya da insula işlevi değildir.",
      ],
      keywords: [
        "interosepsiyon",
        "iç sinyal",
        "beden sinyali",
        "açlık",
        "susuzluk",
        "insula",
      ],
      claimIds: [
        "claim.dna.interoception.functional_definition",
        "claim.dna.interoception.measurement_boundary",
      ],
      sourceIds: [
        "KHALSA_ET_AL_2018",
        "QUIGLEY_ET_AL_2021",
        "GARFINKEL_ET_AL_2015",
        "MURPHY_ET_AL_2019_INTEROCEPTION",
      ],
      evidenceLevel: "moderate",
      ageScope: "developmental",
      claimBoundary:
        "DNA interosepsiyon alanı nesnel doğruluk, insula aktivitesi, organ işlevi veya tanı ölçmez.",
    }),
    topic({
      id: "dna.functional_profile",
      category: "self_regulation",
      title: "DNA işlevsel profil yorumu",
      aliases: [
        "işlevsel profil",
        "dna profil yorumu",
        "günlük yaşam profili",
        "bağlamsal profil",
        "korunmuş kapasite",
      ],
      summary:
        "DNA profili koşul, talep, gözlenen strateji, desteğe yanıt, işlevsel sonuç ve korunmuş kapasite üzerinden betimlenir.",
      details: [
        "Aynı çocuk farklı görev, kişi ve ortamlarda farklı performans gösterebilir.",
        "Tek zaman noktasındaki örüntü sabit biyolojik tip, gelişimsel yörünge veya bireysel prognoz değildir.",
      ],
      keywords: [
        "profil",
        "bağlam",
        "strateji",
        "destek",
        "sonuç",
        "korunmuş kapasite",
      ],
      claimIds: [
        "claim.dna.functional_profile.contextual",
        "claim.dna.functional_profile.strategy_and_outcome",
        "claim.dna.functional_profile.not_trajectory",
      ],
      sourceIds: [
        "BLAIR_RAVER_2015",
        "INZLICHT_ET_AL_2021",
        "TOPLAK_ET_AL_2013",
        "VAN_HULLE_ET_AL_2015",
      ],
      evidenceLevel: "moderate",
      ageScope: "developmental",
      claimBoundary:
        "İşlevsel profil tanı, tek neden, biyolojik tip veya kesin gelecek tahmini değildir.",
    }),
    topic({
      id: "dna.measurement_levels",
      category: "self_regulation",
      title: "DNA ölçüm düzeyleri",
      aliases: [
        "ölçüm düzeyleri",
        "görev ve ölçek farkı",
        "gözlem ve fizyoloji",
        "ebeveyn ölçeği",
        "ölçümler arası yakınsama",
      ],
      summary:
        "Doğal gözlem, derecelendirme ölçeği, yapılandırılmış görev ve fizyolojik kayıt farklı zaman, bağlam ve işlem düzeylerini örnekler.",
      details: [
        "Bu yöntemler birbirinin değiştirilebilir eşdeğeri değildir; düşük yakınsama tek başına bir yöntemin yanlış olduğunu göstermez.",
        "Yüksek korelasyon da alanların aynı yapı olduğunu kanıtlamaz; ortak yöntem varyansı ve güvenirlik ayrıca incelenmelidir.",
      ],
      keywords: [
        "ölçüm",
        "görev",
        "ölçek",
        "gözlem",
        "fizyolojik",
        "güvenirlik",
        "korelasyon",
      ],
      claimIds: [
        "claim.dna.measurement.levels_distinct",
        "claim.dna.measurement.correlation_boundary",
      ],
      sourceIds: [
        "DUCKWORTH_KERN_2011",
        "ENKAVI_ET_AL_2019",
        "TOPLAK_ET_AL_2013",
        "KARR_ET_AL_2018",
      ],
      evidenceLevel: "strong",
      ageScope: "mixed",
      claimBoundary:
        "Tek yöntem, yüksek iç tutarlılık veya tek korelasyon DNA'nın geçerliğini, biyolojik yapıyı ya da bireysel kapasiteyi doğrulamaz.",
    }),
    topic({
      id: "dna.capacity_performance",
      category: "self_regulation",
      title: "Kapasite, performans ve katılım",
      aliases: [
        "kapasite performans",
        "kapasite ve katılım",
        "yapabilme ve katılım",
        "gerçek yaşam performansı",
      ],
      summary:
        "Kontrollü koşulda bir görevi yapabilme, doğal bağlamdaki sürdürülebilir performans ve yaşam durumuna katılım aynı bilgi değildir.",
      details: [
        "Çevresel talep ve destek düzeyi, kapasitenin günlük yaşamda ne ölçüde kullanılabildiğini değiştirebilir.",
        "Desteğe yanıt korunmuş kapasite hakkında işlevsel ipucu sağlayabilir; mekanizma veya prognoz sağlamaz.",
      ],
      keywords: [
        "kapasite",
        "performans",
        "katılım",
        "günlük yaşam",
        "destek",
        "sürdürülebilirlik",
      ],
      claimIds: [
        "claim.dna.capacity_performance.distinction",
        "claim.dna.capacity_performance.participation_boundary",
      ],
      sourceIds: ["TOPLAK_ET_AL_2013", "CHIEN_ET_AL_2016"],
      evidenceLevel: "moderate",
      ageScope: "childhood",
      claimBoundary:
        "Tek görev başarısı veya alan puanı günlük katılımı, sabit kapasiteyi ya da gelecekteki başarıyı belirlemez.",
    }),
    topic({
      id: "dna.domain_overlap",
      category: "self_regulation",
      title: "DNA alan örtüşmesi ve çoklu yollar",
      aliases: [
        "alan örtüşmesi",
        "bir davranış hangi alan",
        "eşsonluluk",
        "çoksonluluk",
        "birincil ikincil alan",
      ],
      summary:
        "Aynı gözlenebilir davranış birden çok işlevsel yoldan oluşabilir; aynı başlangıç özelliği de farklı bağlamlarda farklı sonuçlar doğurabilir.",
      details: [
        "Bir davranışı tek alana veya tek nedene zorlamak yerine birincil işlevsel odak, olası ikincil katkılar ve bağlamsal etkenler ayrı gösterilir.",
        "Bu yaklaşım alternatif hipotezleri düzenler; biyolojik veya nedensel açıklamayı doğrulamaz.",
      ],
      keywords: [
        "örtüşme",
        "eşsonluluk",
        "çoksonluluk",
        "birincil alan",
        "ikincil alan",
        "alternatif açıklama",
      ],
      claimIds: [
        "claim.dna.domain_overlap.multiple_paths",
        "claim.dna.domain_overlap.not_single_cause",
      ],
      sourceIds: [
        "NIGG_2017",
        "INZLICHT_ET_AL_2021",
        "DOEBEL_2020",
        "KARR_ET_AL_2018",
      ],
      evidenceLevel: "theoretical",
      ageScope: "developmental",
      claimBoundary:
        "Alan örtüşmesi tek doğru alan, tek neden, tanı veya biyolojik mekanizma üretmez.",
    }),
  ])

export const V5_SIX_DOMAINS_CLAIMS: readonly DnaChatCatalogClaim[] =
  Object.freeze([
    claim({
      id: "claim.dna.six_domains.institutional_framework",
      topicId: "dna.six_domains",
      text: "DNA altı başlığı kurum içi işlevsel bilgi düzenleme alanları olarak kullanır.",
      detail:
        "Fizyolojik, duyusal, duygusal, bilişsel, yürütücü işlev ve interosepsiyon başlıkları günlük işlevi farklı sorularla incelemek için kullanılır; bilimsel literatürde keşfedilmiş doğal altı faktör olarak sunulmaz.",
      sourceIds: ["NIGG_2017", "INZLICHT_ET_AL_2021"],
      evidenceLevel: "theoretical",
      ageScope: "developmental",
      claimType: "product_boundary",
      dnaRelation: "theory_only",
    }),
    claim({
      id: "claim.dna.six_domains.not_biological_taxonomy",
      topicId: "dna.six_domains",
      text: "DNA'nın altı alanı altı ayrı beyin sistemi, otonom durum veya biyolojik modül değildir.",
      detail:
        "Dağıtık ve örtüşen süreçlerin işlevsel başlıklarla düzenlenmesi, her başlığın bağımsız anatomik ya da fizyolojik karşılığı bulunduğunu göstermez.",
      sourceIds: ["NIGG_2017", "INZLICHT_ET_AL_2021", "POLDRAK_2006"],
      evidenceLevel: "boundary",
      ageScope: "all_ages",
      claimType: "product_boundary",
      dnaRelation: "not_established",
    }),
    claim({
      id: "claim.dna.six_domains.psychometric_boundary",
      topicId: "dna.six_domains",
      text: "Altı alanın birbirinden ayrılabilirliği ve ortak bir üst puanda birleşip birleşmediği DNA verisinde ayrıca test edilmelidir.",
      detail:
        "Faktör yapısı, çapraz yükler, yakınsak-ayırıcı geçerlik, bilgi verenler arası yapı ve ölçüm değişmezliği kanıtlanmadan bağımsız faktör veya genel sinir sistemi skoru iddiası kurulamaz.",
      sourceIds: [
        "KARR_ET_AL_2018",
        "TOPLAK_ET_AL_2013",
        "DUCKWORTH_KERN_2011",
      ],
      evidenceLevel: "boundary",
      ageScope: "developmental",
      claimType: "product_boundary",
      dnaRelation: "not_established",
    }),
    claim({
      id: "claim.dna.physiological.functional_definition",
      topicId: "dna.physiological_regulation",
      text: "DNA fizyolojik alanı bedensel durum, enerji, uyarılma, reaktivite ve toparlanmanın günlük işleve etkisini betimler.",
      detail:
        "İşlevsel gözlem; hangi koşulda değişim olduğu, zaman içindeki yörünge, desteğe yanıt ve katılım maliyeti üzerinden yapılır.",
      sourceIds: ["MCEWEN_2007", "GUNNAR_QUEVEDO_2007", "BLAIR_RAVER_2015"],
      evidenceLevel: "theoretical",
      ageScope: "developmental",
      claimType: "definition",
      dnaRelation: "theory_only",
    }),
    claim({
      id: "claim.dna.physiological.biological_boundary",
      topicId: "dna.physiological_regulation",
      text: "Fizyolojik alan puanından ANS dengesi, HRV, kortizol, HPA ekseni, vagal tonus veya allostatik yük çıkarılamaz.",
      detail:
        "Bu değişkenler uygun cihaz, protokol, zamanlama ve artefakt kontrolüyle doğrudan ölçüm gerektirir; davranış veya derecelendirme biyolojik kayıt değildir.",
      sourceIds: ["MCEWEN_2007", "GUNNAR_QUEVEDO_2007", "LABORDE_ET_AL_2017"],
      evidenceLevel: "boundary",
      ageScope: "developmental",
      claimType: "product_boundary",
      dnaRelation: "not_established",
    }),
    claim({
      id: "claim.dna.sensory.functional_definition",
      topicId: "dna.sensory_regulation",
      text: "DNA duyusal alanı belirli uyaran özellikleri ile tepki, dikkat, eylem ve katılım arasındaki örüntüyü işlevsel olarak betimler.",
      detail:
        "Uyaranın modalitesi, niteliği, bağlamı, tepkinin süresi ve günlük işlevsel sonuç birlikte belirtilmelidir.",
      sourceIds: ["DUNN_2001", "WATKYNS_ET_AL_2024", "CHIEN_ET_AL_2016"],
      evidenceLevel: "moderate",
      ageScope: "childhood",
      claimType: "definition",
      dnaRelation: "conceptual_proximity",
    }),
    claim({
      id: "claim.dna.sensory.measurement_boundary",
      topicId: "dna.sensory_regulation",
      text: "Duyusal gözlem veya ölçek puanı psikofiziksel eşik, kortikal işlemleme, otonom yanıt veya tanı değildir.",
      detail:
        "Hiperreaktivite, hiporeaktivite, arayış ve kaçınma bağlamsal davranış örüntüleridir; tek bir nörolojik ya da klinik nedene eşitlenemez.",
      sourceIds: ["DUNN_2001", "WATKYNS_ET_AL_2024", "GOMEZ_ET_AL_2017"],
      evidenceLevel: "boundary",
      ageScope: "childhood",
      claimType: "measurement_boundary",
      dnaRelation: "not_established",
    }),
    claim({
      id: "claim.dna.emotional.functional_definition",
      topicId: "dna.emotional_regulation",
      text: "DNA duygusal alanı reaktivite, strateji, esneklik ve yeniden katılımı hedef ve bağlamla birlikte ele alır.",
      detail:
        "Duygunun oluşması, kullanılan düzenleme davranışı ve işlevsel sonuç ayrı gözlenir; stratejinin değeri bağlama ve maliyetine göre değişir.",
      sourceIds: [
        "COLE_ET_AL_2004",
        "GROSS_2015",
        "THOMPSON_1994",
        "EISENBERG_SPINRAD_2004",
      ],
      evidenceLevel: "moderate",
      ageScope: "developmental",
      claimType: "definition",
      dnaRelation: "conceptual_proximity",
    }),
    claim({
      id: "claim.dna.emotional.calmness_boundary",
      topicId: "dna.emotional_regulation",
      text: "Görünür sakinlik tek başına başarılı duygu düzenleme değildir.",
      detail:
        "Sakin görünüm çekilme, bastırma veya düşük katılımla da oluşabilir; sürdürülebilir hedefe uygun işlev ve yeniden katılım ayrıca değerlendirilir.",
      sourceIds: ["GROSS_2015", "THOMPSON_1994", "EISENBERG_SPINRAD_2004"],
      evidenceLevel: "theoretical",
      ageScope: "developmental",
      claimType: "misconception_correction",
      dnaRelation: "theory_only",
    }),
    claim({
      id: "claim.dna.cognitive.operational_definition",
      topicId: "dna.cognitive_regulation",
      text: "DNA bilişsel alanı dikkat, bilgi, beklenti ve stratejinin hedefe göre düzenlenmesine ilişkin işlevsel içerikleri kapsar.",
      detail:
        "Dikkati yeniden kurma, geri bildirimi kullanma ve strateji değiştirme gibi davranışlar alanın operasyonel içeriği olabilir.",
      sourceIds: ["NIGG_2017", "INZLICHT_ET_AL_2021", "DOEBEL_2020"],
      evidenceLevel: "theoretical",
      ageScope: "developmental",
      claimType: "definition",
      dnaRelation: "theory_only",
    }),
    claim({
      id: "claim.dna.cognitive.independence_not_established",
      topicId: "dna.cognitive_regulation",
      text: "Bilişsel regülasyonun yürütücü işlevden bağımsız ve standartlaşmış tek bir çocukluk faktörü olduğu gösterilmemiştir.",
      detail:
        "Alan dikkat, dil, metabiliş, motivasyon ve yürütücü taleplerle örtüşebilir; ayırt edici geçerlik DNA verisinde ayrıca sınanmalıdır.",
      sourceIds: [
        "NIGG_2017",
        "DOEBEL_2020",
        "TOPLAK_ET_AL_2013",
        "KARR_ET_AL_2018",
      ],
      evidenceLevel: "limited",
      ageScope: "developmental",
      claimType: "product_boundary",
      dnaRelation: "not_established",
    }),
    claim({
      id: "claim.dna.executive.functional_definition",
      topicId: "dna.executive_function_domain",
      text: "DNA yürütücü alanı çalışma belleği, ketleyici kontrol, bilişsel esneklik ve hedef sürdürme taleplerini işlevsel düzeyde düzenler.",
      detail:
        "Aynı görev birden çok yürütücü ve yürütücü olmayan talep içerdiğinden hangi koşulun performansı sınırladığı ayrıca belirtilir.",
      sourceIds: ["DIAMOND_2013", "MIYAKE_ET_AL_2000", "FRIEDMAN_MIYAKE_2017"],
      evidenceLevel: "strong",
      ageScope: "developmental",
      claimType: "definition",
      dnaRelation: "conceptual_proximity",
    }),
    claim({
      id: "claim.dna.executive.task_and_brain_boundary",
      topicId: "dna.executive_function_domain",
      text: "Tek yürütücü görev veya DNA puanı saf süreç, prefrontal kapasite, genel zekâ ya da tanı ölçümü değildir.",
      detail:
        "Görevler dil, hız, motor yanıt, bilgi, motivasyon ve bağlam taleplerini de içerir; davranıştan bölgesel beyin işlevi çıkarılamaz.",
      sourceIds: ["TOPLAK_ET_AL_2013", "KARR_ET_AL_2018", "POLDRAK_2006"],
      evidenceLevel: "boundary",
      ageScope: "developmental",
      claimType: "measurement_boundary",
      dnaRelation: "not_established",
    }),
    claim({
      id: "claim.dna.interoception.functional_definition",
      topicId: "dna.interoception_domain",
      text: "DNA interosepsiyon alanı iç bedensel sinyali fark etme, ayırt etme, anlamlandırma ve eylemle ilişkilendirme davranışlarını düzenler.",
      detail:
        "Sinyali fark etme, yerini belirleme, adlandırma ve uygun eyleme dönüştürme ayrı alt süreçler olarak ele alınır.",
      sourceIds: [
        "KHALSA_ET_AL_2018",
        "QUIGLEY_ET_AL_2021",
        "MURPHY_ET_AL_2019_INTEROCEPTION",
      ],
      evidenceLevel: "moderate",
      ageScope: "developmental",
      claimType: "definition",
      dnaRelation: "conceptual_proximity",
    }),
    claim({
      id: "claim.dna.interoception.measurement_boundary",
      topicId: "dna.interoception_domain",
      text: "DNA interosepsiyon puanı nesnel interoseptif doğruluk, organ işlevi veya insula aktivitesi değildir.",
      detail:
        "Öz-bildirim, gözlem, görev doğruluğu ve metabilişsel farkındalık farklı ölçüm düzeyleridir; çocuklukta dil ve görev anlama ek sınırlılık oluşturur.",
      sourceIds: [
        "GARFINKEL_ET_AL_2015",
        "MURPHY_ET_AL_2019_INTEROCEPTION",
        "DESMEDT_ET_AL_2022_SELF_REPORT",
        "POLDRAK_2006",
      ],
      evidenceLevel: "boundary",
      ageScope: "developmental",
      claimType: "measurement_boundary",
      dnaRelation: "not_established",
    }),
    claim({
      id: "claim.dna.functional_profile.contextual",
      topicId: "dna.functional_profile",
      text: "DNA profili görev talebi, ortam, zaman ve destek düzeyiyle birlikte yorumlanır.",
      detail:
        "Ev, okul veya yapılandırılmış görevdeki farklı performans çelişki ya da isteksizlik olmak zorunda değildir; bağlam özgüllüğü hakkında bilgi sağlayabilir.",
      sourceIds: [
        "BLAIR_RAVER_2015",
        "INZLICHT_ET_AL_2021",
        "TOPLAK_ET_AL_2013",
      ],
      evidenceLevel: "moderate",
      ageScope: "developmental",
      claimType: "association",
      dnaRelation: "conceptual_proximity",
    }),
    claim({
      id: "claim.dna.functional_profile.strategy_and_outcome",
      topicId: "dna.functional_profile",
      text: "Çocuğun kullandığı strateji ile gözlenen işlevsel sonuç ayrı kaydedilmelidir.",
      detail:
        "Aynı sonuç farklı stratejilerden, aynı strateji farklı bağlamlarda farklı sonuçlardan doğabilir; desteğe yanıt korunmuş kapasiteyi görünür kılabilir.",
      sourceIds: ["COLE_ET_AL_2004", "GROSS_2015", "INZLICHT_ET_AL_2021"],
      evidenceLevel: "moderate",
      ageScope: "developmental",
      claimType: "measurement_boundary",
      dnaRelation: "conceptual_proximity",
    }),
    claim({
      id: "claim.dna.functional_profile.not_trajectory",
      topicId: "dna.functional_profile",
      text: "Tek zaman noktasındaki DNA profili gelişimsel yörünge veya kalıcı özellik değildir.",
      detail:
        "Yörünge iddiası tekrarlı ve yaşa duyarlı veri gerektirir; tek ölçümden okul başarısı, yetişkinlik sonucu veya iyileşme prognozu çıkarılamaz.",
      sourceIds: [
        "VAN_HULLE_ET_AL_2015",
        "ROBSON_ET_AL_2020",
        "MONTROY_ET_AL_2016",
      ],
      evidenceLevel: "boundary",
      ageScope: "developmental",
      claimType: "product_boundary",
      dnaRelation: "not_established",
    }),
    claim({
      id: "claim.dna.measurement.levels_distinct",
      topicId: "dna.measurement_levels",
      text: "Görev, derecelendirme, doğal gözlem ve fizyolojik kayıt birbirinin değiştirilebilir eşdeğeri değildir.",
      detail:
        "Her yöntem farklı zaman penceresi, bağlam ve işlem düzeyini örnekler; düşük korelasyon tek başına yöntemlerden birini geçersiz kılmaz.",
      sourceIds: [
        "DUCKWORTH_KERN_2011",
        "ENKAVI_ET_AL_2019",
        "TOPLAK_ET_AL_2013",
      ],
      evidenceLevel: "strong",
      ageScope: "mixed",
      claimType: "measurement_boundary",
      dnaRelation: "not_established",
    }),
    claim({
      id: "claim.dna.measurement.correlation_boundary",
      topicId: "dna.measurement_levels",
      text: "Alanlar arası yüksek korelasyon aynılığı, düşük korelasyon ise otomatik ayrışmayı kanıtlamaz.",
      detail:
        "Ortak yöntem varyansı ilişkileri artırabilir; düşük güvenirlik ve farklı bağlamlar azaltabilir. Yakınsak ve ayırıcı geçerlik birlikte incelenir.",
      sourceIds: [
        "DUCKWORTH_KERN_2011",
        "ENKAVI_ET_AL_2019",
        "KARR_ET_AL_2018",
        "TOPLAK_ET_AL_2013",
      ],
      evidenceLevel: "strong",
      ageScope: "mixed",
      claimType: "measurement_boundary",
      dnaRelation: "not_established",
    }),
    claim({
      id: "claim.dna.capacity_performance.distinction",
      topicId: "dna.capacity_performance",
      text: "Kontrollü koşulda yapabilme ile günlük yaşamda sürdürülebilir performans aynı değildir.",
      detail:
        "Görev yapısı, çevresel talep ve destek düzeyi kapasitenin doğal bağlamda ne ölçüde kullanılabildiğini değiştirebilir.",
      sourceIds: ["TOPLAK_ET_AL_2013", "CHIEN_ET_AL_2016"],
      evidenceLevel: "moderate",
      ageScope: "childhood",
      claimType: "misconception_correction",
      dnaRelation: "conceptual_proximity",
    }),
    claim({
      id: "claim.dna.capacity_performance.participation_boundary",
      topicId: "dna.capacity_performance",
      text: "Tek görev başarısı veya alan puanı gerçek yaşam katılımını ve gelecekteki başarıyı tek başına belirlemez.",
      detail:
        "Katılım görev, çevre, kişi, destek ve zamanın etkileşimidir; desteğe yanıt mekanizma veya bağımlılık kanıtı değildir.",
      sourceIds: ["CHIEN_ET_AL_2016", "TOPLAK_ET_AL_2013"],
      evidenceLevel: "boundary",
      ageScope: "childhood",
      claimType: "product_boundary",
      dnaRelation: "not_established",
    }),
    claim({
      id: "claim.dna.domain_overlap.multiple_paths",
      topicId: "dna.domain_overlap",
      text: "Aynı gözlenebilir davranış birden çok işlevsel yol ve alan etkileşimiyle ortaya çıkabilir.",
      detail:
        "Örneğin göreve dönmeme; duyusal yük, yorgunluk, beklenti, çalışma belleği talebi, sosyal değerlendirme veya bunların birleşimiyle ilişkili olabilir.",
      sourceIds: ["NIGG_2017", "INZLICHT_ET_AL_2021", "DOEBEL_2020"],
      evidenceLevel: "theoretical",
      ageScope: "developmental",
      claimType: "association",
      dnaRelation: "theory_only",
    }),
    claim({
      id: "claim.dna.domain_overlap.not_single_cause",
      topicId: "dna.domain_overlap",
      text: "Bir davranışın birincil ve ikincil alanlarla betimlenmesi nedensel veya biyolojik açıklama değildir.",
      detail:
        "Etiketleme yalnız işlevsel hipotezleri düzenler; tek doğru alan, asıl neden, tanı veya mekanizma kesinleştirilmez.",
      sourceIds: ["NIGG_2017", "INZLICHT_ET_AL_2021", "POLDRAK_2006"],
      evidenceLevel: "boundary",
      ageScope: "developmental",
      claimType: "product_boundary",
      dnaRelation: "not_established",
    }),
    claim({
      id: "claim.interoception.modalities.fatigue",
      topicId: "ans.interoception_modalities",
      text: "Yorgunluk hissi interoseptif bilgi içerebilir; ancak uyku, hastalık, efor, duygu ve bağlamın birlikte etkilediği çok bileşenli bir deneyimdir.",
      detail: "Yorgunluk bildirmek interoseptif doğruluğu, organ işlevini veya tek bir biyolojik mekanizmayı doğrudan göstermez.",
      sourceIds: ["KHALSA_ET_AL_2018", "QUIGLEY_ET_AL_2021"],
      evidenceLevel: "moderate",
      ageScope: "developmental",
      claimType: "definition",
      dnaRelation: "conceptual_proximity",
    }),
    claim({
      id: "claim.emotion.strategies.developmental_change",
      topicId: "selfreg.emotion_strategies",
      text: "Duygu düzenleme stratejilerinin repertuarı ve uygulanma biçimi dil, biliş, deneyim ve sosyal destekle çocukluk boyunca değişebilir.",
      detail: "Bu grup düzeyi gelişim eğilimi katı yaş basamağı değildir; yetişkin strateji bulguları çocuğa doğrudan reçete gibi aktarılamaz.",
      sourceIds: ["THOMPSON_1994", "COLE_ET_AL_2004", "GROSS_2015"],
      evidenceLevel: "moderate",
      ageScope: "developmental",
      claimType: "development",
      dnaRelation: "conceptual_proximity",
    }),
    claim({
      id: "claim.executive.measurement.test_retest_boundary",
      topicId: "cns.executive_measurement",
      text: "Yürütücü görevlerin test-tekrar test güvenirliği, puan farkının gerçek bireysel değişimden mi yoksa görev ve ölçüm değişkenliğinden mi kaynaklandığını sınırlar.",
      detail: "Düşük güvenirlik korelasyonları ve bireysel değişim yorumunu zayıflatabilir; tek görev saf yürütücü kapasite ölçümü değildir.",
      sourceIds: ["HEDGE_ET_AL_2018", "ENKAVI_ET_AL_2019"],
      evidenceLevel: "strong",
      ageScope: "mixed",
      claimType: "measurement_boundary",
      dnaRelation: "not_established",
    }),
  ])

export const V5_SIX_DOMAINS_RELATIONS: readonly DnaChatCatalogRelation[] =
  Object.freeze([
    relation({
      id: "relation.dna-six-domains.physiological",
      fromTopicId: "dna.six_domains",
      toTopicId: "dna.physiological_regulation",
      predicate: "includes",
      summary:
        "Fizyolojik regülasyon DNA'nın altı kurumsal işlevsel başlığından biridir.",
      sourceIds: ["NIGG_2017", "INZLICHT_ET_AL_2021"],
      evidenceLevel: "theoretical",
      ageScope: "developmental",
      claimBoundary:
        "Bu ilişki bilimsel faktör, biyolojik modül veya otonom ölçüm eşdeğerliği değildir.",
    }),
    relation({
      id: "relation.dna-six-domains.sensory",
      fromTopicId: "dna.six_domains",
      toTopicId: "dna.sensory_regulation",
      predicate: "includes",
      summary:
        "Duyusal regülasyon DNA'nın altı kurumsal işlevsel başlığından biridir.",
      sourceIds: ["DUNN_2001", "WATKYNS_ET_AL_2024"],
      evidenceLevel: "theoretical",
      ageScope: "childhood",
      claimBoundary:
        "Bu ilişki bağımsız tanı, nörolojik eşik veya biyolojik modül değildir.",
    }),
    relation({
      id: "relation.dna-six-domains.emotional",
      fromTopicId: "dna.six_domains",
      toTopicId: "dna.emotional_regulation",
      predicate: "includes",
      summary:
        "Duygusal regülasyon DNA'nın altı kurumsal işlevsel başlığından biridir.",
      sourceIds: ["COLE_ET_AL_2004", "GROSS_2015"],
      evidenceLevel: "theoretical",
      ageScope: "developmental",
      claimBoundary:
        "Bu ilişki tanı, limbik sistem veya tek bir duygu ölçümü değildir.",
    }),
    relation({
      id: "relation.dna-six-domains.cognitive",
      fromTopicId: "dna.six_domains",
      toTopicId: "dna.cognitive_regulation",
      predicate: "includes",
      summary:
        "Bilişsel regülasyon DNA'nın altı kurumsal işlevsel başlığından biridir.",
      sourceIds: ["NIGG_2017", "DOEBEL_2020"],
      evidenceLevel: "theoretical",
      ageScope: "developmental",
      claimBoundary:
        "Alan yürütücü işlevden doğrulanmış bağımsız faktör veya tek bilişsel modül değildir.",
    }),
    relation({
      id: "relation.dna-six-domains.executive",
      fromTopicId: "dna.six_domains",
      toTopicId: "dna.executive_function_domain",
      predicate: "includes",
      summary:
        "Yürütücü işlev DNA'nın altı kurumsal işlevsel başlığından biridir.",
      sourceIds: ["DIAMOND_2013", "KARR_ET_AL_2018"],
      evidenceLevel: "theoretical",
      ageScope: "developmental",
      claimBoundary:
        "Bu ilişki tek frontal yeti, PFC kapasitesi veya saf görev ölçümü değildir.",
    }),
    relation({
      id: "relation.dna-six-domains.interoception",
      fromTopicId: "dna.six_domains",
      toTopicId: "dna.interoception_domain",
      predicate: "includes",
      summary:
        "İnterosepsiyon DNA'nın altı kurumsal işlevsel başlığından biridir.",
      sourceIds: ["KHALSA_ET_AL_2018", "QUIGLEY_ET_AL_2021"],
      evidenceLevel: "theoretical",
      ageScope: "developmental",
      claimBoundary:
        "Bu ilişki nesnel doğruluk, organ işlevi veya insula aktivitesi ölçümü değildir.",
    }),
    relation({
      id: "relation.dna-physiological.reactivity-recovery",
      fromTopicId: "dna.physiological_regulation",
      toTopicId: "selfreg.reactivity_recovery",
      predicate: "conceptually_related_to",
      summary:
        "DNA fizyolojik alanının işlevsel içeriğinde uyarılma, reaktivite ve toparlanma yörüngeleri bulunur.",
      sourceIds: ["BLAIR_RAVER_2015", "MCEWEN_2007"],
      evidenceLevel: "theoretical",
      ageScope: "developmental",
      claimBoundary:
        "Davranışsal yörünge ANS, HRV, kortizol veya parasempatik kapasite ölçümü değildir.",
    }),
    relation({
      id: "relation.dna-sensory.sensory-modulation",
      fromTopicId: "dna.sensory_regulation",
      toTopicId: "selfreg.sensory_modulation",
      predicate: "conceptually_related_to",
      summary:
        "DNA duyusal alanı, duyusal modülasyon ve reaktivite literatürüyle işlevsel içerik yakınlığı taşır.",
      sourceIds: ["DUNN_2001", "WATKYNS_ET_AL_2024"],
      evidenceLevel: "moderate",
      ageScope: "childhood",
      claimBoundary:
        "İçerik yakınlığı bağımsız tanı, nörolojik eşik veya otonom mekanizma eşdeğerliği değildir.",
    }),
    relation({
      id: "relation.dna-emotional.emotion-regulation",
      fromTopicId: "dna.emotional_regulation",
      toTopicId: "selfreg.emotion_regulation",
      predicate: "conceptually_related_to",
      summary:
        "DNA duygusal alanı reaktivite, strateji, esneklik ve yeniden katılım literatürüyle içerik yakınlığı taşır.",
      sourceIds: ["COLE_ET_AL_2004", "GROSS_2015", "THOMPSON_1994"],
      evidenceLevel: "moderate",
      ageScope: "developmental",
      claimBoundary:
        "İçerik yakınlığı tanı, içsel duygu veya limbik sistem ölçümü değildir.",
    }),
    relation({
      id: "relation.dna-cognitive.attention",
      fromTopicId: "dna.cognitive_regulation",
      toTopicId: "cns.attention",
      predicate: "conceptually_related_to",
      summary:
        "Dikkati yeniden kurma ve ilgili bilgiyi seçme DNA bilişsel alanının olası işlevsel içeriklerindendir.",
      sourceIds: ["NIGG_2017", "DOEBEL_2020"],
      evidenceLevel: "theoretical",
      ageScope: "developmental",
      claimBoundary:
        "Bu yakınlık bilişsel alanı dikkat ağına, tanıya veya sabit dikkat kapasitesine eşitlemez.",
    }),
    relation({
      id: "relation.dna-cognitive.executive-distinction",
      fromTopicId: "dna.cognitive_regulation",
      toTopicId: "selfreg.executive_functions",
      predicate: "distinguished_from",
      summary:
        "DNA bilişsel alanı strateji, beklenti ve dikkat kullanımını vurgulayabilir; yürütücü alan çalışma belleği, ketleme ve esneklik taleplerini öne çıkarır.",
      sourceIds: ["NIGG_2017", "DOEBEL_2020", "TOPLAK_ET_AL_2013"],
      evidenceLevel: "limited",
      ageScope: "developmental",
      claimBoundary:
        "Bu operasyonel ayrımın psikometrik bağımsızlığı henüz gösterilmiş değildir.",
    }),
    relation({
      id: "relation.dna-executive.executive-functions",
      fromTopicId: "dna.executive_function_domain",
      toTopicId: "selfreg.executive_functions",
      predicate: "conceptually_related_to",
      summary:
        "DNA yürütücü alanı çalışma belleği, ketleyici kontrol ve bilişsel esneklik literatürüyle açık içerik yakınlığı taşır.",
      sourceIds: ["DIAMOND_2013", "MIYAKE_ET_AL_2000", "FRIEDMAN_MIYAKE_2017"],
      evidenceLevel: "strong",
      ageScope: "developmental",
      claimBoundary:
        "İçerik yakınlığı tek görev, PFC işlevi, tanı veya DNA faktör geçerliği değildir.",
    }),
    relation({
      id: "relation.dna-interoception.interoception",
      fromTopicId: "dna.interoception_domain",
      toTopicId: "ans.interoception",
      predicate: "conceptually_related_to",
      summary:
        "DNA interosepsiyon alanı iç bedensel sinyali fark etme ve eylemle ilişkilendirme literatürüyle içerik yakınlığı taşır.",
      sourceIds: [
        "KHALSA_ET_AL_2018",
        "QUIGLEY_ET_AL_2021",
        "MURPHY_ET_AL_2019_INTEROCEPTION",
      ],
      evidenceLevel: "moderate",
      ageScope: "developmental",
      claimBoundary:
        "İçerik yakınlığı nesnel doğruluk, organ işlevi veya insula aktivitesi ölçümü değildir.",
    }),
    relation({
      id: "relation.dna-functional-profile.selfreg",
      fromTopicId: "dna.functional_profile",
      toTopicId: "selfreg.core",
      predicate: "conceptually_related_to",
      summary:
        "DNA işlevsel profil yorumu self-regülasyonu görev, bağlam, strateji ve destekle birlikte ele alır.",
      sourceIds: ["NIGG_2017", "INZLICHT_ET_AL_2021", "BLAIR_RAVER_2015"],
      evidenceLevel: "moderate",
      ageScope: "developmental",
      claimBoundary:
        "Profil sabit kapasite, tek neden, tanı veya biyolojik tip değildir.",
    }),
    relation({
      id: "relation.dna-functional-profile.measurement-levels",
      fromTopicId: "dna.functional_profile",
      toTopicId: "dna.measurement_levels",
      predicate: "measured_indirectly_by",
      summary:
        "İşlevsel profil doğal gözlem, derecelendirme ve yapılandırılmış görev gibi farklı veri düzeyleriyle dolaylı olarak örneklenebilir.",
      sourceIds: [
        "TOPLAK_ET_AL_2013",
        "DUCKWORTH_KERN_2011",
        "ENKAVI_ET_AL_2019",
      ],
      evidenceLevel: "strong",
      ageScope: "mixed",
      claimBoundary:
        "Tek veri düzeyi profil bütününü, biyolojik mekanizmayı veya bireysel kapasiteyi doğrudan ölçmez.",
    }),
    relation({
      id: "relation.dna-capacity-performance.functional-profile",
      fromTopicId: "dna.capacity_performance",
      toTopicId: "dna.functional_profile",
      predicate: "conceptually_related_to",
      summary:
        "Kapasite, gerçek yaşam performansı ve katılım ayrımı DNA'nın bağlamsal profil yorumunu yapılandırır.",
      sourceIds: ["TOPLAK_ET_AL_2013", "CHIEN_ET_AL_2016"],
      evidenceLevel: "moderate",
      ageScope: "childhood",
      claimBoundary:
        "Desteğe yanıt veya görev başarısı sabit kapasite, bağımlılık ya da prognoz kanıtı değildir.",
    }),
    relation({
      id: "relation.dna-domain-overlap.functional-profile",
      fromTopicId: "dna.domain_overlap",
      toTopicId: "dna.functional_profile",
      predicate: "supports",
      summary:
        "Alan örtüşmesi yaklaşımı işlevsel profilde birincil odak, olası ikincil katkılar ve bağlamsal etkenleri ayrı göstermeyi destekler.",
      sourceIds: ["NIGG_2017", "INZLICHT_ET_AL_2021", "DOEBEL_2020"],
      evidenceLevel: "theoretical",
      ageScope: "developmental",
      claimBoundary:
        "Bu düzenleme tek doğru alan, kesin neden veya biyolojik mekanizma üretmez.",
    }),
    relation({
      id: "relation.dna-sensory.ans-overview",
      fromTopicId: "dna.sensory_regulation",
      toTopicId: "ans.overview",
      predicate: "conceptually_related_to",
      summary: "Çocuklarda duyusal davranış ile otonom yanıt arasındaki bulgular heterojendir; DNA duyusal alanı ile ANS arasında güçlü ve doğrudan bir ölçüm eşdeğerliği gösterilmemiştir.",
      sourceIds: ["GOMEZ_ET_AL_2017", "CHRISTENSEN_ET_AL_2020"],
      evidenceLevel: "limited",
      ageScope: "childhood",
      claimBoundary: "Duyusal puan veya davranıştan ANS durumu, sempatik etkinlik ya da vagal ton çıkarılamaz.",
    }),
    relation({
      id: "relation.dna-physiological.interoception",
      fromTopicId: "dna.physiological_regulation",
      toTopicId: "ans.interoception",
      predicate: "conceptually_related_to",
      summary: "Fizyolojik durumun günlük işleve etkisi ile iç bedensel sinyallerin algılanması kavramsal olarak kesişebilir, fakat aynı süreç veya ölçüm değildir.",
      sourceIds: ["KHALSA_ET_AL_2018", "QUIGLEY_ET_AL_2021", "MURPHY_ET_AL_2019_INTEROCEPTION"],
      evidenceLevel: "theoretical",
      ageScope: "developmental",
      claimBoundary: "DNA fizyolojik alanı organ sinyali, homeostaz, ANS etkinliği veya interoseptif doğruluk ölçmez.",
    }),
    relation({
      id: "relation.dna-sensory.interoception-distinction",
      fromTopicId: "dna.sensory_regulation",
      toTopicId: "dna.interoception_domain",
      predicate: "distinguished_from",
      summary: "DNA duyusal alanı çevresel ve bedensel uyaranlara işlevsel yanıtı; interosepsiyon alanı iç beden sinyalini fark etme ve eylemle ilişkilendirmeyi vurgular.",
      sourceIds: ["WATKYNS_ET_AL_2024", "KHALSA_ET_AL_2018", "QUIGLEY_ET_AL_2021"],
      evidenceLevel: "theoretical",
      ageScope: "developmental",
      claimBoundary: "Operasyonel ayrım bağımsız biyolojik modül veya doğrulanmış ayrı faktör kanıtı değildir.",
    }),
    relation({
      id: "relation.interoception.ans-overview",
      fromTopicId: "ans.interoception",
      toTopicId: "ans.overview",
      predicate: "conceptually_related_to",
      summary: "İnterosepsiyon iç bedensel sinyallerin sinir sistemi içinde algılanması ve bütünleştirilmesiyle ilişkilidir; otonom düzenlemenin kendisi değildir.",
      sourceIds: ["KHALSA_ET_AL_2018", "QUIGLEY_ET_AL_2021", "SAPER_2002"],
      evidenceLevel: "strong",
      ageScope: "developmental",
      claimBoundary: "Beden duyumu veya öz-bildirim ANS dengesini, organ işlevini ya da vagal tonu doğrudan ölçmez.",
    }),
    relation({
      id: "relation.sleep-health.dna-cognitive-regulation",
      fromTopicId: "selfreg.sleep_health",
      toTopicId: "dna.cognitive_regulation",
      predicate: "conceptually_related_to",
      summary: "Çocuklarda uyku süresi ve kalitesi bilişsel işlevlerle grup düzeyinde ilişkili olabilir; DNA bilişsel alanıyla bağlantı dolaylı ve bağlamsaldır.",
      sourceIds: ["ASTILL_ET_AL_2012"],
      evidenceLevel: "moderate",
      ageScope: "childhood",
      claimBoundary: "İlişki nedensellik, bireysel bilişsel kapasite, DNA geçerliği veya uyku fizyolojisi ölçümü değildir.",
    }),
    relation({
      id: "relation.sleep-health.dna-six-domains",
      fromTopicId: "selfreg.sleep_health",
      toTopicId: "dna.six_domains",
      predicate: "conceptually_related_to",
      summary: "Uyku ve yorgunluk fizyolojik durum, dikkat, duygu, duyusal tolerans ve katılım üzerinden birden çok DNA alanının görünümünü bağlamsal olarak etkileyebilir.",
      sourceIds: ["ASTILL_ET_AL_2012", "BLAIR_RAVER_2015"],
      evidenceLevel: "moderate",
      ageScope: "childhood",
      claimBoundary: "Uyku tek bir DNA alanına indirgenmez; gözlenen ilişki neden, tanı veya uyku fizyolojisi ölçümü değildir.",
    }),
    relation({
      id: "relation.dna-six-domains.recovery",
      fromTopicId: "dna.six_domains",
      toTopicId: "selfreg.reactivity_recovery",
      predicate: "conceptually_related_to",
      summary: "Toparlanma özellikle fizyolojik ve duygusal alanlarda görünür olabilen, fakat dikkat ve katılımı da etkileyebilen çapraz bir işlevsel süreçtir.",
      sourceIds: ["BLAIR_RAVER_2015", "COLE_ET_AL_2004", "MCEWEN_2007"],
      evidenceLevel: "theoretical",
      ageScope: "developmental",
      claimBoundary: "Çapraz alan ilişkisi tek biyolojik toparlanma mekanizması veya bağımsız DNA faktörü değildir.",
    }),
    relation({
      id: "relation.dna-physiological.emotion-regulation",
      fromTopicId: "dna.physiological_regulation",
      toTopicId: "selfreg.emotion_regulation",
      predicate: "conceptually_related_to",
      summary: "Bedensel durum, uyarılma ve toparlanma duygusal tepkinin bağlamını etkileyebilir; fizyolojik ve duygusal regülasyon aynı alan değildir.",
      sourceIds: ["BLAIR_RAVER_2015", "COLE_ET_AL_2004", "MCEWEN_2007"],
      evidenceLevel: "theoretical",
      ageScope: "developmental",
      claimBoundary: "Davranışsal ilişki ANS, hormon, beyin bölgesi veya bireysel mekanizma ölçümü değildir.",
    }),
    relation({
      id: "relation.stress-systems.dna-physiological",
      fromTopicId: "selfreg.stress_systems",
      toTopicId: "dna.physiological_regulation",
      predicate: "conceptually_related_to",
      summary: "Stres tepkisinin günlük enerji, uyarılma, reaktivite ve toparlanmaya yansıması DNA fizyolojik alanıyla kavramsal yakınlık taşır.",
      sourceIds: ["MCEWEN_2007", "BLAIR_RAVER_2015"],
      evidenceLevel: "theoretical",
      ageScope: "developmental",
      claimBoundary: "DNA alanı HPA ekseni, kortizol veya otonom stres tepkisini doğrudan ölçmez.",
    }),
    relation({
      id: "relation.dna-domain-overlap.measurement-uncertainty",
      fromTopicId: "dna.domain_overlap",
      toTopicId: "case.measurement_uncertainty",
      predicate: "distinguished_from",
      summary: "Alanların kavramsal olarak örtüşmesi ile puan belirsizliği aynı değildir; biri içerik yakınlığını, diğeri ölçümün kesinlik sınırını anlatır.",
      sourceIds: ["NIGG_2017", "AERA_APA_NCME_2014"],
      evidenceLevel: "strong",
      ageScope: "all_ages",
      claimBoundary: "Profil farkı yalnız örtüşme veya yalnız ölçüm hatası olarak varsayılmaz; araç-özel psikometri gerekir.",
    }),
    relation({
      id: "relation.dna-physiological.homeostasis",
      fromTopicId: "dna.physiological_regulation",
      toTopicId: "ans.homeostasis",
      predicate: "distinguished_from",
      summary: "Homeostaz biyolojik değişkenlerin düzenlenmesini; DNA fizyolojik alanı ise bedensel durumun günlük işleve yansımasını işlevsel düzeyde ele alır.",
      sourceIds: ["MCEWEN_2007", "BLAIR_RAVER_2015"],
      evidenceLevel: "theoretical",
      ageScope: "developmental",
      claimBoundary: "İşlevsel alan homeostatik mekanizmayı veya biyolojik dengeyi doğrudan ölçmez.",
    }),
    relation({
      id: "relation.dna-physiological.ans-overview",
      fromTopicId: "dna.physiological_regulation",
      toTopicId: "ans.overview",
      predicate: "conceptually_related_to",
      summary: "DNA fizyolojik alanı otonom süreçlerin günlük işlevdeki olası yansımalarıyla kavramsal yakınlık taşır, ancak ANS ölçümü değildir.",
      sourceIds: ["MCEWEN_2007", "SAPER_2002", "BLAIR_RAVER_2015"],
      evidenceLevel: "theoretical",
      ageScope: "developmental",
      claimBoundary: "Puan veya gözlemden sempatik-parasempatik denge, vagal ton ya da otonom bozukluk çıkarılamaz.",
    }),
    relation({
      id: "relation.dna-physiological.sympathetic-parasympathetic",
      fromTopicId: "dna.physiological_regulation",
      toTopicId: "ans.sympathetic_parasympathetic",
      predicate: "distinguished_from",
      summary: "Fizyolojik regülasyon alanı parasempatik veya sempatik dalın eş anlamlısı değildir; günlük işlevsel örüntüyü daha geniş düzeyde betimler.",
      sourceIds: ["SAPER_2002", "MCEWEN_2007"],
      evidenceLevel: "theoretical",
      ageScope: "developmental",
      claimBoundary: "DNA davranış profili sempatik ya da parasempatik etkinliği doğrudan ölçmez.",
    }),
  ])

export const V5_SIX_DOMAINS_SAFETY_RULES: readonly DnaChatCatalogSafetyRule[] =
  Object.freeze([
    safetyRule({
      id: "safety.v5_six_domains_measurement_overreach",
      patterns: [
        "Bir fMRI çalışması DNA maddesini doğrular mı?",
        "Çocuk duyusal arayışta; nörolojik eşiği kesin düşük mü?",
        "HRV ölçmeden parasempatik aktiviteyi davranıştan anlayabilir miyiz?",
      ],
      response:
        "DNA maddesi, alan puanı veya davranış gözlemi fMRI bulgusunu, nörolojik eşiği ya da otonom etkinliği doğrudan ölçmez.",
      category: "measurement_overreach",
      sourceIds: ["POLDRAK_2006", "TOPLAK_ET_AL_2013", "DUNN_2001"],
    }),
    safetyRule({
      id: "safety.v5_six_domains_biological_inference",
      patterns: [
        "Çocuğun fizyolojik regülasyon puanı düşük; vagus siniri zayıf mı?",
        "Yürütücü işlev düşükse prefrontal korteks gelişmemiş midir?",
        "İnterosepsiyon düşükse insula çalışmıyor mu?",
        "Sakinleşince kortizolü düşmüş müdür?",
        "Yüksek fizyolojik regülasyon puanı sağlıklı sinir sistemi demek midir?",
        "Altı alan beynin altı bölümüne karşılık geliyor mu?",
        "Düşük interosepsiyon puanı çocuğun açlığı gerçekten hissetmediğini kanıtlar mı?",
        "çocuk hiç regüle olamıyo bu sinir sistemi bozukluğu mu",
      ],
      response:
        "DNA alanları işlevsel başlıklardır; puan veya davranıştan vagus, kortizol, PFC, insula, organ sinyali ya da genel sinir sistemi durumu çıkarılamaz.",
      category: "biological_inference",
      sourceIds: ["POLDRAK_2006", "KHALSA_ET_AL_2018", "TOPLAK_ET_AL_2013"],
    }),
    safetyRule({
      id: "safety.v5_six_domains_diagnosis",
      patterns: [
        "Duyusal puanı yüksek; otizm tanısı var mı?",
        "Duygusal alan düşükse anksiyete mi vardır?",
        "Duyusal kaçınma travma kanıtı mıdır?",
        "Çalışma belleği zayıfsa zekâ düşüklüğü var mıdır?",
      ],
      response:
        "Tek alan puanı veya davranış tanı, travma, bilişsel seviye ya da psikiyatrik durum göstermez; yalnız işlevsel örüntü ve değerlendirme sınırı açıklanabilir.",
      category: "diagnosis",
      sourceIds: [
        "TOPLAK_ET_AL_2013",
        "WATKYNS_ET_AL_2024",
        "FREITAG_ET_AL_2023",
      ],
    }),
    safetyRule({
      id: "safety.v5_six_domains_causality_and_prognosis",
      patterns: [
        "Erken güçlük ileride kesin sorun oluşturur mu?",
        "Ebeveyn çok destek oluyor; çocuk bağımlı mı kalır?",
        "Bir ölçek sonucu çocuğun gelecekteki okul başarısını kesin söyler mi?",
        "O zaman sebebi bu mu?",
      ],
      response:
        "Tek gözlem, alan puanı veya grup ilişkisi kesin neden, bağımlılık ya da bireysel prognoz sağlamaz; olasılıksal ve bağlamsal sınırlar açıklanabilir.",
      category: "causality",
      sourceIds: ["ROBSON_ET_AL_2020", "NIGG_2017", "BLAIR_RAVER_2015"],
    }),
  ])

import { cleanMeaningfulText, type AnamnezRecord } from "./anamnezUtils"
import type { ClinicalMechanismType } from "./clinicalAnalysis"
import { questions } from "./questions"
import { getConcernSeverity, isCriticalConcern, isElevatedConcern } from "../assessment/itemScoring"

type DomainContext = {
  key: string
  label: string
  level: string
  score: number
}

type MicroEvidenceCluster =
  | "physiological_stress_reactivity"
  | "sleep_rhythm_recovery"
  | "feeding_rhythm"
  | "co_regulation_recovery"
  | "vestibular_visual_reactivity"
  | "visual_reactivity"
  | "auditory_reactivity"
  | "tactile_reactivity"
  | "oral_olfactory_reactivity"
  | "emotional_reactivity"
  | "emotional_recovery"
  | "novelty_transition"
  | "cognitive_task_understanding"
  | "cognitive_attention_working_memory"
  | "cognitive_planning_problem_solving"
  | "executive_task_flow"
  | "executive_inhibition_waiting"
  | "executive_organization"
  | "intero_basic_needs"
  | "intero_body_state"
  | "intero_stress_recovery"

type MechanismAffinity =
  | "motor_praxis"
  | "adaptive_daily_living"
  | "social_pragmatic"
  | "language_communication"
  | "language_social_pragmatic"
  | "physiological_interoceptive"
  | "executive_regulation"
  | "sensory_emotional"

type ItemSignalDefinition = {
  questionId: number
  domainKey: string
  domainLabel: string
  clinicalSignal: string
  cluster: MicroEvidenceCluster
  mechanismAffinity: MechanismAffinity[]
}

type ClusterNarrative = {
  domainLine: string
  formulationLine: string
  alignedLine: string
  contextPattern: RegExp
}

export type ItemSignal = ItemSignalDefinition & {
  answer: number
  concernScore: number
  matchedContext: boolean
  domainLevel: string
  isCritical: boolean
  isEligible: boolean
  selectionWeight: number
}

export type ItemLevelAnalysis = {
  criticalItems: ItemSignal[]
  alignedItems: ItemSignal[]
  criticalLines: string[]
  alignedLines: string[]
  domainLines: Record<string, string[]>
  signalSummary: string
}

const DOMAIN_LABELS: Record<string, string> = {
  fizyolojik: "Fizyolojik Regülasyon",
  duyusal: "Duyusal Regülasyon",
  duygusal: "Duygusal Regülasyon",
  bilissel: "Bilişsel Regülasyon",
  yurutucu: "Yürütücü İşlev",
  intero: "İnterosepsiyon",
}

const REPORT_DOMAIN_KEY: Record<string, string> = {
  fizyolojik: "physiological",
  duyusal: "sensory",
  duygusal: "emotional",
  bilissel: "cognitive",
  yurutucu: "executive",
  intero: "interoception",
}

const MECHANISM_DOMAINS: Record<ClinicalMechanismType, string[]> = {
  motor_praxis: ["yurutucu", "bilissel", "duygusal"],
  adaptive_daily_living: ["yurutucu", "bilissel", "intero", "fizyolojik", "duygusal"],
  social_pragmatic: ["duygusal", "bilissel", "yurutucu"],
  language_communication: ["bilissel", "yurutucu", "duygusal"],
  language_social_pragmatic: ["bilissel", "duygusal", "yurutucu"],
  physiological_interoceptive: ["fizyolojik", "intero", "duygusal"],
  selective_interoception: ["intero", "fizyolojik", "duygusal"],
  evidence_limited_mixed: ["bilissel", "yurutucu", "duygusal"],
  default: [],
}

const CLUSTER_NARRATIVES: Record<MicroEvidenceCluster, ClusterNarrative> = {
  physiological_stress_reactivity: {
    domainLine:
      "Stres yükü altında bedensel uyarılma, oyun temposu ve sosyal katılımın birlikte değişmesi, fizyolojik regülasyonun yalnız içsel rahatsızlık değil davranışsal organizasyonla birlikte okunması gerektiğini düşündürmektedir.",
    formulationLine:
      "Fizyolojik uyarılma arttığında oyun akışı, sosyal katılım ve toparlanma kapasitesi aynı hatta daralabilmektedir.",
    alignedLine:
      "Bakımveren ve gözlem verileri stresle birlikte bedensel uyarılma ve katılım değişimini tarif ediyorsa, ölçek örüntüsü bu fizyolojik regülasyon hattını güçlendirir.",
    contextPattern: /stres|bedensel|mide|bulant|solunum|don|tepkisiz|oyun tempos|katılım|katilim/i,
  },
  sleep_rhythm_recovery: {
    domainLine:
      "Uykuya geçiş, gece uyanma ve yoğun uyarılma sonrası sakinleşme maddelerinin birlikte bozulması, toparlanma kapasitesinin fizyolojik ritimle bağlantılı biçimde zorlanabileceğini gösterir.",
    formulationLine:
      "Toparlanma yükü yalnız gündüz davranışıyla sınırlı kalmayıp uyku ve ritim düzenlenmesine de yayılabilmektedir.",
    alignedLine:
      "Anamnezde uyku, gece uyanma veya sakinleşme güçlüğü bildirildiğinde bu örüntü fizyolojik toparlanma eksenini destekler.",
    contextPattern: /uyku|gece|uyan|ritim|sakinleş|sakinles|toparlan|yorul/i,
  },
  feeding_rhythm: {
    domainLine:
      "İştah ve yeme düzenindeki değişkenlik, fizyolojik regülasyon yükünün günlük ritim ve beslenme katılımına yansıyabildiğini düşündürür.",
    formulationLine:
      "Fizyolojik yük arttığında beslenme düzeni ve günlük ritim daha kırılgan hale gelebilir.",
    alignedLine:
      "Beslenme, iştah veya yemek düzeni anamnezde belirginse ölçek örüntüsü bu günlük ritim etkisini destekler.",
    contextPattern: /iştah|istah|beslen|yemek|yeme düzen|öğün|ogun/i,
  },
  co_regulation_recovery: {
    domainLine:
      "Yoğun uyarılma sonrası yetişkin desteği ihtiyacının belirginleşmesi, bağımsız toparlanmadan çok ko-regülasyon gereksiniminin klinik olarak öne çıktığını gösterir.",
    formulationLine:
      "Toparlanma süreci çevresel yapılandırma ve yetişkin desteğine daha fazla bağımlı hale gelebilmektedir.",
    alignedLine:
      "Bakımveren veya terapist ko-regülasyon ihtiyacını tarif ediyorsa bu örüntü toparlanma eksenindeki klinik zorlanmayı destekler.",
    contextPattern: /ko-regülasyon|ko regulasyon|yetişkin deste|yetiskin deste|sakinleş|sakinles|toparlan|destek/i,
  },
  vestibular_visual_reactivity: {
    domainLine:
      "Hızlı hareket ve vestibüler yoğunluk karşısında huzursuzluğun belirginleşmesi, duyusal reaktivitenin hareket içeren oyun ve geçiş bağlamlarında katılımı daraltabileceğini düşündürmektedir.",
    formulationLine:
      "Hareket içeren uyaran yoğunluğu arttığında düzenleme kapasitesi ve etkinlikte kalma süresi daralabilir.",
    alignedLine:
      "Hareketli ortam, sallanma, dönme veya geçişlerde huzursuzluk anlatımı varsa bu duyusal reaktivite hattı anamnezle yakınsar.",
    contextPattern: /hareket|sallan|dön|don|vestibüler|vestibuler|hızlı|hizli|geçiş|gecis/i,
  },
  visual_reactivity: {
    domainLine:
      "Parlak ışık ve görsel yoğunluk karşısında huzursuzluğun kümelenmesi, görsel uyaran yoğunluğunun düzenleme kapasitesini daraltan bir reaktivite hattı oluşturduğunu düşündürür.",
    formulationLine:
      "Görsel uyaran yoğunluğu arttığında çocuğun çevresel yoğunluğu tolere etme ve görevde kalma kapasitesi zorlanabilir.",
    alignedLine:
      "Anamnezde ışık, parlaklık, kalabalık veya görsel yoğunluk vurgusu varsa bu örüntü duyusal reaktivite yorumunu güçlendirir.",
    contextPattern: /ışık|isik|parlak|görsel|gorsel|kalabalık|kalabalik|yoğun ortam|yogun ortam/i,
  },
  auditory_reactivity: {
    domainLine:
      "İşitsel uyaran yoğunluğu arttığında yalnız rahatsızlık değil, dikkat akışında kesilme ve toparlanma ihtiyacında artış da beklenebilir.",
    formulationLine:
      "Ses ve arka plan gürültüsü düzenleme kapasitesini daralttığında görev akışı ve duygusal toparlanma ikincil olarak etkilenebilir.",
    alignedLine:
      "Bakımveren veya terapist ses, gürültü ya da kalabalık ortamla zorlanma tarif ediyorsa işitsel reaktivite örüntüsü bu anlatımla doğrudan yakınsar.",
    contextPattern: /ses|gürültü|gurultu|kalabalık|kalabalik|işitsel|isitsel|kulak/i,
  },
  tactile_reactivity: {
    domainLine:
      "Dokunsal reaktivitenin belirginleşmesi, bakım rutinleri, giyinme ve temas içeren günlük etkinliklerde uyaran niteliğine bağlı katılım daralması oluşturabilecek bir hat düşündürmektedir.",
    formulationLine:
      "Dokunsal uyaran niteliği arttığında günlük bakım ve katılım davranışı daha seçici ve kırılgan hale gelebilir.",
    alignedLine:
      "Dokunma, kıyafet, yüz-el temizliği, banyo veya bakım rutinleri anamnezde vurgulanıyorsa dokunsal reaktivite örüntüsü klinik olarak anlamlıdır.",
    contextPattern: /dokun|dokunsal|kumaş|kumas|etiket|kir|temiz|banyo|giyin|yüz|el/i,
  },
  oral_olfactory_reactivity: {
    domainLine:
      "Tat, koku ve yiyecek dokusuna ilişkin reaktivitenin belirginleşmesi, beslenme katılımının tercih düzeyinden çok duyusal uyaran niteliğine bağlı daralabileceğini düşündürür.",
    formulationLine:
      "Oral ve koku uyaranları yoğunlaştığında yemek deneme toleransı ve günlük beslenme esnekliği azalabilir.",
    alignedLine:
      "Yemek seçiciliği, yoğun koku veya yeni doku reddi anamnezde yer alıyorsa bu duyusal reaktivite hattı beslenme katılımıyla yakınsar.",
    contextPattern: /yemek|yiyecek|tat|koku|doku|beslen|seçici|secici|reddet/i,
  },
  emotional_reactivity: {
    domainLine:
      "Beklenmedik durum, hayal kırıklığı ve küçük değişikliklerde duygusal tepkinin yükselmesi, duygusal regülasyon yükünün özellikle bağlam değiştiğinde arttığını gösterir.",
    formulationLine:
      "Duygusal reaktivite arttığında esneklik, bekleme ve görevde kalma süreçleri ikincil olarak zorlanabilir.",
    alignedLine:
      "Aile veya terapist beklenmedik değişiklik, hayal kırıklığı ya da yoğun tepki tarif ediyorsa bu örüntü duygusal reaktivite eksenini destekler.",
    contextPattern: /beklenmedik|hayal kırıkl|hayal kirikl|tepki|öfke|ofke|sinir|değişiklik|degisiklik/i,
  },
  emotional_recovery: {
    domainLine:
      "Duygusal yanıt örüntüsü, tepkinin ortaya çıkmasından çok toparlanma süresinin uzaması ve geçişlerdeki zorlanma sırasında düzenleme kapasitesinin daralması açısından klinik değer taşımaktadır.",
    formulationLine:
      "Duygusal yükselme sonrası toparlanma uzadığında geçiş, bekleme ve yeniden göreve dönme süreçleri birlikte etkilenebilir.",
    alignedLine:
      "Sakinleşmenin uzun sürmesi, ağlama/öfke sonrası toparlanma veya yetişkin desteği ihtiyacı anlatılıyorsa bu örüntü anamnezle yüksek uyum gösterir.",
    contextPattern: /sakinleş|sakinles|toparlan|ağla|agla|öfke|ofke|kriz|duygusal|geçiş|gecis/i,
  },
  novelty_transition: {
    domainLine:
      "Yeni ortam, yeni kişi ve rutin değişikliklerinde huzursuzluğun artması, duygusal regülasyonun özellikle belirsizlik ve geçiş bağlamında kırılganlaştığını düşündürür.",
    formulationLine:
      "Yenilik ve geçişlerdeki zorlanma arttığında duygusal toparlanma ile davranışsal uyum aynı anda zorlanabilir.",
    alignedLine:
      "Anamnezde yeni ortam, ayrılma, geçiş veya rutin değişikliği vurgusu varsa bu duygusal düzenleme hattı klinik olarak güçlenir.",
    contextPattern: /yeni ortam|yeni kişi|yeni kisi|geçiş|gecis|ayrıl|ayril|rutin|değişiklik|degisiklik/i,
  },
  cognitive_task_understanding: {
    domainLine:
      "Yeni görev ve yönerge karmaşıklığı arttığında zorlanmanın belirginleşmesi, bilişsel regülasyon yükünün özellikle anlamlandırma ve zihinsel hazırlık aşamasında yoğunlaştığını düşündürür.",
    formulationLine:
      "Sözel veya görevsel talep arttığında bilgiyi işleme, göreve yerleşme ve sürdürme kapasitesi ikincil olarak zorlanabilir.",
    alignedLine:
      "Yönerge, yeni görev veya sözel talep anamnezde vurgulanıyorsa bilişsel regülasyon örüntüsü bu anlatımla yakınsar.",
    contextPattern: /yönerge|yonerge|talimat|sözel|sozel|yeni görev|yeni gorev|anlama|komut/i,
  },
  cognitive_attention_working_memory: {
    domainLine:
      "Dikkati sürdürme ve çoklu yönergeyi akılda tutma yükünün birlikte belirginleşmesi, bilişsel regülasyonun çalışma belleği ve görevde kalma hattında zorlandığını gösterir.",
    formulationLine:
      "Zihinsel yük arttığında dikkat akışı ve yönergeyi uygulamada süreklilik zayıflayabilir.",
    alignedLine:
      "Dikkat, odaklanma, çok basamaklı yönerge veya görevde kalma anlatımı varsa bu bilişsel örüntü anamnezle güçlü biçimde birleşir.",
    contextPattern: /dikkat|odak|çok basamak|cok basamak|akılda|akilda|yönerge|yonerge|görevde kal|gorevde kal/i,
  },
  cognitive_planning_problem_solving: {
    domainLine:
      "Planlama, kural öğrenme ve sorunla karşılaşınca çözüm üretme hattındaki yük, bilişsel regülasyonun yalnız dikkat değil zihinsel organizasyon boyutunda da zorlandığını düşündürür.",
    formulationLine:
      "Planlama ve problem çözme talebi arttığında görev akışını kurma ve esnek biçimde sürdürme kapasitesi azalabilir.",
    alignedLine:
      "Planlama, kural, yeni oyun ya da çözüm üretme güçlüğü anlatılıyorsa bu örüntü bilişsel organizasyon eksenini destekler.",
    contextPattern: /plan|kural|problem|çözüm|cozum|öğren|ogren|zihinsel|organize/i,
  },
  executive_task_flow: {
    domainLine:
      "Yürütücü örüntü genel bir dikkat zayıflığından çok, başlatılan görevi sürdürme, sıra koruma ve davranışı duruma göre ayarlama yükünde yoğunlaşmaktadır.",
    formulationLine:
      "Görev akışı kurulduktan sonra sürdürme ve yeniden göreve dönme talebi arttığında işlevsel performans dalgalanabilir.",
    alignedLine:
      "Görevden kopma, yarım bırakma, talimatı sürdürme veya yeniden dönme güçlüğü anamnezde yer alıyorsa bu yürütücü görev akışı hattı güçlenir.",
    contextPattern: /görev|gorev|tamamla|yarım|yarim|sürdür|surdur|talimat|başla|basla|geri dön|geri don/i,
  },
  executive_inhibition_waiting: {
    domainLine:
      "Bekleme, sıra alma ve davranışı duruma göre durdurma yükünün birlikte belirginleşmesi, yürütücü işlevin inhibisyon ve davranış ayarlama hattında zorlandığını gösterir.",
    formulationLine:
      "Bekleme ve davranışı duruma göre ayarlama talebi arttığında duygusal toparlanma ve sosyal katılım ikincil olarak etkilenebilir.",
    alignedLine:
      "Sıra bekleme, dürtüsellik, kurallı oyun veya davranışı durdurma güçlüğü anlatılıyorsa bu yürütücü kontrol hattı anamnezle yakınsar.",
    contextPattern: /bekle|sıra|sira|dürtü|durtu|inhibisyon|kural|durdur|kontrol/i,
  },
  executive_organization: {
    domainLine:
      "Materyal, beden ve davranış organizasyonunda zorlanmanın belirginleşmesi, yürütücü zorluğun yalnız masa başı dikkat değil işlevsel organizasyon düzeyinde de taşındığını düşündürür.",
    formulationLine:
      "Organizasyon talebi arttığında bedenini, materyali ve görev adımlarını aynı anda düzenleme kapasitesi kırılganlaşabilir.",
    alignedLine:
      "Beden organizasyonu, materyal düzeni, motor planlama veya sıraya dayalı görev güçlüğü anlatılıyorsa bu örüntü yürütücü-organizasyon hattını güçlendirir.",
    contextPattern: /organize|organizasyon|materyal|beden|motor plan|praksi|sıral|sirala|adım|adim/i,
  },
  intero_basic_needs: {
    domainLine:
      "Açlık, susuzluk ve tuvalet ihtiyacını geç fark etme örüntüsü, temel bedensel ihtiyaçların günlük düzenleme sürecine zamanında katılamayabileceğini düşündürür.",
    formulationLine:
      "Temel bedensel ihtiyaç sinyalleri geç fark edildiğinde günlük akış, öz bakım ve duygusal toparlanma ikincil olarak zorlanabilir.",
    alignedLine:
      "Açlık, susuzluk veya tuvalet ihtiyacını geç bildirme anamnezde yer alıyorsa interoseptif temel ihtiyaç hattı klinik değer taşır.",
    contextPattern: /açlık|aclik|acık|acik|sus|tuvalet|bez|kaçır|kacir|ihtiyaç|ihtiyac/i,
  },
  intero_body_state: {
    domainLine:
      "Yorgunluk, ağrı, sıcaklık ve beden durumundaki değişimleri geç fark etme örüntüsü, içsel bedensel sinyallerin düzenleme sürecine yeterince erken katılamadığını düşündürür.",
    formulationLine:
      "İçsel bedensel sinyallerin geç fark edilmesi, yorgunluk, stres veya bedensel ihtiyaçların düzenleme sürecine zamanında katılamaması açısından yorumlanmalıdır.",
    alignedLine:
      "Yorgunluk, ağrı, sıcak-soğuk farkındalığı veya bedensel rahatsızlık anlatımı varsa interoseptif beden durumu hattı anamnezle yakınsar.",
    contextPattern: /yorgun|ağrı|agri|sıcak|sicak|soğuk|soguk|beden|bedensel|rahatsız|rahatsiz/i,
  },
  intero_stress_recovery: {
    domainLine:
      "Stres, kalp atımı ve rahatlama halini geç fark etme örüntüsü, içsel uyarılma sinyallerinin duygusal toparlanmaya zamanında eşlik edemeyebileceğini düşündürür.",
    formulationLine:
      "İçsel stres ve rahatlama sinyalleri geç fark edildiğinde duygusal yükselme sonrası toparlanma daha fazla dış desteğe ihtiyaç duyabilir.",
    alignedLine:
      "Stres, gerginlik, kalp atımı, mola ihtiyacı veya rahatlama farkındalığı anlatılıyorsa bu interoseptif toparlanma hattı klinik olarak anlamlıdır.",
    contextPattern: /stres|gergin|kalp|çarpınt|carpint|rahatla|mola|toparlan|sakinleş|sakinles/i,
  },
}

const ITEM_SIGNAL_DEFINITIONS: Record<number, ItemSignalDefinition> = {
  1: def(1, "fizyolojik", "stres_bedensel_mide", "physiological_stress_reactivity", ["physiological_interoceptive"]),
  2: def(2, "fizyolojik", "stres_solunum_uyarilma", "physiological_stress_reactivity", ["physiological_interoceptive"]),
  3: def(3, "fizyolojik", "stres_donma_tepkisizlik", "physiological_stress_reactivity", ["physiological_interoceptive"]),
  4: def(4, "fizyolojik", "stres_oyun_tempo_degisim", "physiological_stress_reactivity", ["physiological_interoceptive", "adaptive_daily_living"]),
  5: def(5, "fizyolojik", "stres_sosyal_katilim_azalma", "physiological_stress_reactivity", ["physiological_interoceptive", "social_pragmatic"]),
  6: def(6, "fizyolojik", "uykuya_gecis", "sleep_rhythm_recovery", ["physiological_interoceptive"]),
  7: def(7, "fizyolojik", "gece_uyanma", "sleep_rhythm_recovery", ["physiological_interoceptive"]),
  8: def(8, "fizyolojik", "istah_yeme_ritmi", "feeding_rhythm", ["physiological_interoceptive", "adaptive_daily_living"]),
  9: def(9, "fizyolojik", "yogun_uyarilma_ko_regulasyon", "co_regulation_recovery", ["physiological_interoceptive", "sensory_emotional"]),
  10: def(10, "fizyolojik", "ani_uyarida_bedensel_irkilme", "physiological_stress_reactivity", ["physiological_interoceptive", "sensory_emotional"]),

  11: def(11, "duyusal", "hizli_gorsel_hareket_reaktivite", "vestibular_visual_reactivity", ["sensory_emotional"]),
  12: def(12, "duyusal", "vestibuler_hareket_reaktivite", "vestibular_visual_reactivity", ["sensory_emotional"]),
  13: def(13, "duyusal", "parlak_isik_reaktivite", "visual_reactivity", ["sensory_emotional"]),
  14: def(14, "duyusal", "gorsel_yogun_ortam_reaktivite", "visual_reactivity", ["sensory_emotional"]),
  15: def(15, "duyusal", "ani_ses_reaktivite", "auditory_reactivity", ["sensory_emotional"]),
  16: def(16, "duyusal", "arka_plan_gurultu_reaktivite", "auditory_reactivity", ["sensory_emotional"]),
  17: def(17, "duyusal", "dokunsal_yuzey_reaktivite", "tactile_reactivity", ["sensory_emotional", "adaptive_daily_living"]),
  18: def(18, "duyusal", "kirlenme_temizlik_reaktivite", "tactile_reactivity", ["sensory_emotional", "adaptive_daily_living"]),
  19: def(19, "duyusal", "yeni_tat_doku_reaktivite", "oral_olfactory_reactivity", ["sensory_emotional", "adaptive_daily_living"]),
  20: def(20, "duyusal", "keskin_koku_reaktivite", "oral_olfactory_reactivity", ["sensory_emotional"]),

  21: def(21, "duygusal", "beklenmedik_durum_tepki", "emotional_reactivity", ["sensory_emotional", "social_pragmatic"]),
  22: def(22, "duygusal", "ofke_duzenleme", "emotional_reactivity", ["sensory_emotional", "executive_regulation"]),
  23: def(23, "duygusal", "uzuntu_toparlanma", "emotional_recovery", ["sensory_emotional", "physiological_interoceptive"]),
  24: def(24, "duygusal", "hayal_kirikligi_tolerans", "emotional_reactivity", ["sensory_emotional", "executive_regulation"]),
  25: def(25, "duygusal", "yeni_ortam_huzursuzluk", "novelty_transition", ["social_pragmatic", "sensory_emotional"]),
  26: def(26, "duygusal", "degisiklik_tepki", "novelty_transition", ["social_pragmatic", "executive_regulation"]),
  27: def(27, "duygusal", "duygu_ifade", "emotional_recovery", ["language_social_pragmatic", "social_pragmatic"]),
  28: def(28, "duygusal", "ofke_sonrasi_toparlanma", "emotional_recovery", ["sensory_emotional", "executive_regulation"]),
  29: def(29, "duygusal", "duygusal_dalgalanma", "emotional_reactivity", ["sensory_emotional"]),
  30: def(30, "duygusal", "bekleme_huzursuzluk", "emotional_reactivity", ["executive_regulation", "social_pragmatic"]),

  31: def(31, "bilissel", "yeni_gorev_anlama", "cognitive_task_understanding", ["language_communication", "adaptive_daily_living"]),
  32: def(32, "bilissel", "adimlari_zihinsel_duzenleme", "cognitive_planning_problem_solving", ["motor_praxis", "adaptive_daily_living"]),
  33: def(33, "bilissel", "yeni_kural_ogrenme", "cognitive_planning_problem_solving", ["executive_regulation", "social_pragmatic"]),
  34: def(34, "bilissel", "etkinlikte_odak_kayma", "cognitive_attention_working_memory", ["executive_regulation"]),
  35: def(35, "bilissel", "dikkat_surdurme", "cognitive_attention_working_memory", ["executive_regulation"]),
  36: def(36, "bilissel", "coklu_yonerge_akilda_tutma", "cognitive_attention_working_memory", ["language_communication", "executive_regulation"]),
  37: def(37, "bilissel", "problemde_vazgecme", "cognitive_planning_problem_solving", ["executive_regulation"]),
  38: def(38, "bilissel", "yeni_gorev_ek_yonlendirme", "cognitive_task_understanding", ["language_communication", "adaptive_daily_living"]),
  39: def(39, "bilissel", "planlama_gerektiren_oyun", "cognitive_planning_problem_solving", ["motor_praxis", "executive_regulation"]),
  40: def(40, "bilissel", "dikkati_yeniden_toplama", "cognitive_attention_working_memory", ["executive_regulation"]),

  41: def(41, "yurutucu", "gorev_tamamlama", "executive_task_flow", ["executive_regulation", "adaptive_daily_living"]),
  42: def(42, "yurutucu", "kuralli_oyun_surdurme", "executive_inhibition_waiting", ["social_pragmatic", "executive_regulation"]),
  43: def(43, "yurutucu", "sira_bekleme", "executive_inhibition_waiting", ["social_pragmatic", "executive_regulation"]),
  44: def(44, "yurutucu", "davranis_durdurma_ayarlama", "executive_inhibition_waiting", ["executive_regulation"]),
  45: def(45, "yurutucu", "gorevler_arasi_kayma", "executive_task_flow", ["executive_regulation"]),
  46: def(46, "yurutucu", "talimat_surdurme", "executive_task_flow", ["language_communication", "executive_regulation"]),
  47: def(47, "yurutucu", "dikkat_dagilma_goreve_donme", "executive_task_flow", ["executive_regulation"]),
  48: def(48, "yurutucu", "planli_sirali_yurutme", "executive_organization", ["motor_praxis", "adaptive_daily_living"]),
  49: def(49, "yurutucu", "kural_adim_akilda_tutma", "executive_organization", ["language_communication", "executive_regulation"]),
  50: def(50, "yurutucu", "materyal_beden_davranis_organizasyon", "executive_organization", ["motor_praxis", "adaptive_daily_living"]),

  51: def(51, "intero", "aclik_farkindalik", "intero_basic_needs", ["physiological_interoceptive", "adaptive_daily_living"]),
  52: def(52, "intero", "susuzluk_farkindalik", "intero_basic_needs", ["physiological_interoceptive", "adaptive_daily_living"]),
  53: def(53, "intero", "tuvalet_ihtiyaci_farkindalik", "intero_basic_needs", ["physiological_interoceptive", "adaptive_daily_living"]),
  54: def(54, "intero", "yorgunluk_farkindalik", "intero_body_state", ["physiological_interoceptive"]),
  55: def(55, "intero", "kalp_atimi_farkindalik", "intero_stress_recovery", ["physiological_interoceptive"]),
  56: def(56, "intero", "sicak_soguk_farkindalik", "intero_body_state", ["physiological_interoceptive"]),
  57: def(57, "intero", "agri_ifade", "intero_body_state", ["physiological_interoceptive"]),
  58: def(58, "intero", "stres_farkindalik", "intero_stress_recovery", ["physiological_interoceptive"]),
  59: def(59, "intero", "beden_degisim_farkindalik", "intero_body_state", ["physiological_interoceptive"]),
  60: def(60, "intero", "rahatlama_farkindalik", "intero_stress_recovery", ["physiological_interoceptive"]),
}

const invalidSignalDefinitions = questions.filter((question) => {
  const definition = ITEM_SIGNAL_DEFINITIONS[question.id]
  return !definition || definition.questionId !== question.id || definition.domainKey !== question.scale
})

if (invalidSignalDefinitions.length > 0) {
  throw new Error(
    `DNA madde-sinyal eşlemesi eksik veya hatalı: ${invalidSignalDefinitions
      .map((question) => question.id)
      .join(", ")}`
  )
}

function def(
  questionId: number,
  domainKey: string,
  clinicalSignal: string,
  cluster: MicroEvidenceCluster,
  mechanismAffinity: MechanismAffinity[]
): ItemSignalDefinition {
  return {
    questionId,
    domainKey,
    domainLabel: DOMAIN_LABELS[domainKey] || domainKey,
    clinicalSignal,
    cluster,
    mechanismAffinity,
  }
}

function clampLikert(value: unknown): number {
  const num = Number(value)
  if (!Number.isFinite(num)) return 3
  return Math.max(1, Math.min(5, Math.round(num)))
}

function buildContextText(
  anamnezRecord?: AnamnezRecord,
  therapistInsights: string[] = [],
  externalClinicalFindings: string[] = []
) {
  const recordText = anamnezRecord
    ? Object.values(anamnezRecord)
        .map((value) => cleanMeaningfulText(value))
        .filter(Boolean)
        .join(" ")
    : ""

  return [recordText, ...therapistInsights, ...externalClinicalFindings]
    .map((value) => cleanMeaningfulText(value))
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

function isNonTypical(level: string): boolean {
  return level === "Riskli" || level === "Atipik"
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

function mechanismMatchesDomain(mechanism: ClinicalMechanismType | undefined, domainKey: string): boolean {
  if (!mechanism) return false
  return (MECHANISM_DOMAINS[mechanism] || []).includes(domainKey)
}

function mechanismMatchesAffinity(mechanism: ClinicalMechanismType | undefined, affinities: MechanismAffinity[]): boolean {
  if (!mechanism || mechanism === "default") return false
  if (mechanism === "language_social_pragmatic") {
    return affinities.includes("language_social_pragmatic") || affinities.includes("language_communication") || affinities.includes("social_pragmatic")
  }
  if (mechanism === "evidence_limited_mixed") {
    return affinities.includes("executive_regulation") || affinities.includes("sensory_emotional")
  }
  if (mechanism === "selective_interoception") {
    return affinities.includes("physiological_interoceptive") || affinities.includes("adaptive_daily_living")
  }
  return affinities.includes(mechanism as MechanismAffinity)
}

function selectOnePerDomain(items: ItemSignal[], maxItems: number): ItemSignal[] {
  const selected: ItemSignal[] = []
  const usedDomains = new Set<string>()

  for (const item of items) {
    if (usedDomains.has(item.domainKey)) continue
    selected.push(item)
    usedDomains.add(item.domainKey)
    if (selected.length >= maxItems) break
  }

  return selected
}

function scoreItem(
  item: ItemSignal,
  clusterCount: number,
  clinicalMechanism?: ClinicalMechanismType
): number {
  const domainWeight = isNonTypical(item.domainLevel) ? 10 : 0
  const contextWeight = item.matchedContext ? 12 : 0
  const clusterWeight = clusterCount >= 2 ? 14 : 0
  const criticalWeight = item.isCritical ? 20 : 8
  const mechanismWeight =
    mechanismMatchesDomain(clinicalMechanism, item.domainKey) || mechanismMatchesAffinity(clinicalMechanism, item.mechanismAffinity)
      ? 10
      : 0

  return criticalWeight + domainWeight + contextWeight + clusterWeight + mechanismWeight
}

function getClusterLine(item: ItemSignal, purpose: "domain" | "formulation" | "aligned"): string {
  const narrative = CLUSTER_NARRATIVES[item.cluster]
  if (purpose === "aligned") return narrative.alignedLine
  if (purpose === "formulation") return narrative.formulationLine
  return narrative.domainLine
}

export function analyzeItemLevelSignals(params: {
  answers?: number[] | null
  anamnezRecord?: AnamnezRecord
  therapistInsights?: string[]
  externalClinicalFindings?: string[]
  domainResults: DomainContext[]
  clinicalMechanism?: ClinicalMechanismType
}): ItemLevelAnalysis | null {
  const answers = Array.isArray(params.answers) ? params.answers.slice(0, questions.length) : []
  if (answers.length !== questions.length) return null

  const contextText = buildContextText(
    params.anamnezRecord,
    params.therapistInsights || [],
    params.externalClinicalFindings || []
  )
  const domainLevelMap = new Map<string, string>()
  params.domainResults.forEach((domain) => {
    domainLevelMap.set(domain.key, domain.level)
    const legacyKey = Object.entries(REPORT_DOMAIN_KEY).find(([, reportKey]) => reportKey === domain.key)?.[0]
    if (legacyKey) domainLevelMap.set(legacyKey, domain.level)
  })

  const rawSignals: ItemSignal[] = questions
    .map((question, index) => {
      const answer = clampLikert(answers[index])
      const definition = ITEM_SIGNAL_DEFINITIONS[question.id]
      if (!definition) return null
      const narrative = CLUSTER_NARRATIVES[definition.cluster]
      const domainLevel = domainLevelMap.get(definition.domainKey) || domainLevelMap.get(REPORT_DOMAIN_KEY[definition.domainKey]) || ""
      const matchedContext = narrative.contextPattern.test(contextText)

      return {
        ...definition,
        answer,
        concernScore: getConcernSeverity(question.id, answer),
        matchedContext,
        domainLevel,
        isCritical: isCriticalConcern(question.id, answer),
        isEligible: false,
        selectionWeight: 0,
      }
    })
    .filter((item): item is ItemSignal => Boolean(item))

  const badSignals = rawSignals.filter((signal) =>
    isElevatedConcern(signal.questionId, signal.answer)
  )
  if (!badSignals.length) return null

  const clusterCounts = new Map<MicroEvidenceCluster, number>()
  badSignals.forEach((signal) => {
    clusterCounts.set(signal.cluster, (clusterCounts.get(signal.cluster) || 0) + 1)
  })

  const eligible = badSignals
    .map((signal) => {
      const clusterCount = clusterCounts.get(signal.cluster) || 0
      const domainMechanismMatch =
        mechanismMatchesDomain(params.clinicalMechanism, signal.domainKey) ||
        mechanismMatchesAffinity(params.clinicalMechanism, signal.mechanismAffinity)
      const isEligible =
        clusterCount >= 2 ||
        (signal.isCritical && isNonTypical(signal.domainLevel)) ||
        (signal.isCritical && signal.matchedContext) ||
        domainMechanismMatch

      return {
        ...signal,
        isEligible,
        selectionWeight: scoreItem(signal, clusterCount, params.clinicalMechanism),
      }
    })
    .filter((signal) => signal.isEligible)
    .sort((a, b) => {
      if (b.selectionWeight !== a.selectionWeight) return b.selectionWeight - a.selectionWeight
      if (a.concernScore !== b.concernScore) return b.concernScore - a.concernScore
      return a.questionId - b.questionId
    })

  if (!eligible.length) return null

  const criticalItems = selectOnePerDomain(eligible, 2)
  const alignedItems = selectOnePerDomain(
    eligible.filter((signal) => signal.matchedContext),
    2
  )

  const criticalClusters = unique(criticalItems.map((item) => item.cluster))
  const alignedClusters = unique(alignedItems.map((item) => item.cluster))

  const criticalLines = criticalClusters
    .slice(0, 2)
    .map((cluster) => {
      const representative = criticalItems.find((item) => item.cluster === cluster) || criticalItems[0]
      return getClusterLine(representative, "formulation")
    })

  const alignedLines = alignedClusters
    .slice(0, 2)
    .map((cluster) => {
      const representative = alignedItems.find((item) => item.cluster === cluster) || alignedItems[0]
      return getClusterLine(representative, "aligned")
    })

  const domainLines = criticalItems.reduce<Record<string, string[]>>((acc, item) => {
    const reportKey = REPORT_DOMAIN_KEY[item.domainKey] || item.domainKey
    const line = getClusterLine(item, "domain")
    acc[reportKey] = unique([...(acc[reportKey] || []), line]).slice(0, 1)
    return acc
  }, {})

  const signalSummary = criticalLines.length
    ? `Mikro-kanıt örüntüsü ${unique(criticalItems.map((item) => item.domainLabel)).join(", ")} alanlarında klinik yorumu güçlendirmektedir.`
    : ""

  return {
    criticalItems,
    alignedItems,
    criticalLines,
    alignedLines,
    domainLines,
    signalSummary,
  }
}

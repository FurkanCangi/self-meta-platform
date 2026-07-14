import type { ClinicalMechanismType } from "./clinicalAnalysis";
import type { DomainKey } from "./reportEngine";

export type ClinicalKnowledgePurpose =
  | "construct"
  | "level_comment"
  | "anamnesis"
  | "cross_scale"
  | "risk_profile"
  | "report_language"
  | "safety";

export type ClinicalKnowledgeLevel = "relative_weakness" | "watch_range" | "relative_strength";

export type ClinicalKnowledgeUse =
  | "decision"
  | "evidence_profile"
  | "domain_comment"
  | "formulation"
  | "anamnesis_fit"
  | "prioritization"
  | "conclusion";

export type ClinicalKnowledgeChunk = {
  id: string;
  domain?: DomainKey;
  mechanism?: ClinicalMechanismType[];
  purpose: ClinicalKnowledgePurpose;
  level?: ClinicalKnowledgeLevel;
  text: string;
  useIn: ClinicalKnowledgeUse[];
};

export const WORD_RAG_SOURCE = {
  primary: "RAG/Pro RAG.docx",
  guide: "RAG/Derin Araştırma RAG.docx",
  sourceChunkCount: 71,
} as const;

const domainConstructs: ClinicalKnowledgeChunk[] = [
  {
    id: "PHYSIOLOGICAL_REGULATION_CONSTRUCT",
    domain: "physiological",
    purpose: "construct",
    text: "Fizyolojik regülasyon; uyku, yeme-iştah örüntüsü, yorgunluğa tolerans, stres sonrası bedensel toparlanma ve genel uyarılma dengesinin günlük işlevselliğe nasıl yansıdığını açıklar.",
    useIn: ["domain_comment", "formulation", "anamnesis_fit"],
  },
  {
    id: "SENSORY_REGULATION_CONSTRUCT",
    domain: "sensory",
    purpose: "construct",
    text: "Duyusal regülasyon; işitsel, görsel, dokunsal, hareket-denge, ağız içi, koku ve tat uyaranlarının filtrelenmesi ve bu uyaranlara işlevsel yanıt üretme kapasitesidir.",
    useIn: ["domain_comment", "formulation", "anamnesis_fit"],
  },
  {
    id: "EMOTIONAL_REGULATION_CONSTRUCT",
    domain: "emotional",
    purpose: "construct",
    text: "Duygusal regülasyon; zorlanma, geçiş, engellenme ve beklenmeyen değişikliklerden sonra duygusal yoğunluğun düzenlenmesi ve yeniden dengeye dönüş sürecidir.",
    useIn: ["domain_comment", "formulation", "anamnesis_fit"],
  },
  {
    id: "COGNITIVE_REGULATION_CONSTRUCT",
    domain: "cognitive",
    purpose: "construct",
    text: "Bilişsel regülasyon; dikkati sürdürme, bilgiyi zihinde tutma, yönergeyi işleme ve görev talebi arttığında zihinsel organizasyonu koruma kapasitesidir.",
    useIn: ["domain_comment", "formulation", "anamnesis_fit"],
  },
  {
    id: "EXECUTIVE_FUNCTION_CONSTRUCT",
    domain: "executive",
    purpose: "construct",
    text: "Yürütücü işlev; başlatma, durdurma, esneklik, sıra koruma, çok basamaklı akışı yönetme ve davranışı hedefe göre organize etme süreçlerini kapsar.",
    useIn: ["domain_comment", "formulation", "anamnesis_fit"],
  },
  {
    id: "INTEROCEPTION_CONSTRUCT",
    domain: "interoception",
    purpose: "construct",
    text: "İnterosepsiyon; açlık, susuzluk, tuvalet ihtiyacı, ağrı, yorgunluk ve içsel gerilim gibi beden sinyallerini fark etme ve bu sinyalleri düzenleme sürecine katma kapasitesidir.",
    useIn: ["domain_comment", "formulation", "anamnesis_fit"],
  },
];

const levelComments: ClinicalKnowledgeChunk[] = [
  {
    id: "PHYSIOLOGICAL_REGULATION_RELATIVE_WEAKNESS",
    domain: "physiological",
    purpose: "level_comment",
    level: "relative_weakness",
    text: "Bu bulgu, uyku, beslenme, enerji düzeyi ve stres sonrası toparlanmadaki düzensizliğin günlük katılımı etkileyebileceğini gösterir. Tek başına tıbbi veya otonom sinir sistemi sorunu anlamına gelmez.",
    useIn: ["domain_comment", "formulation"],
  },
  {
    id: "PHYSIOLOGICAL_REGULATION_WATCH_RANGE",
    domain: "physiological",
    purpose: "level_comment",
    level: "watch_range",
    text: "Bu alan belirli koşullarda, özellikle uyku kalitesi, rutin değişimi, yorgunluk veya hastalık dönemlerinde daha görünür hale gelebilecek bağlamsal bir hassasiyet olarak klinik anlam kazanır.",
    useIn: ["domain_comment", "anamnesis_fit"],
  },
  {
    id: "PHYSIOLOGICAL_REGULATION_RELATIVE_STRENGTH",
    domain: "physiological",
    purpose: "level_comment",
    level: "relative_strength",
    text: "Göreli korunmuşluk, günlük biyolojik ritimlerin ve toparlanma zemininin daha dengeli olabileceğini gösterir; ancak diğer alanlardaki zorlanmaları dışlamaz.",
    useIn: ["domain_comment", "formulation", "conclusion"],
  },
  {
    id: "SENSORY_REGULATION_RELATIVE_WEAKNESS",
    domain: "sensory",
    purpose: "level_comment",
    level: "relative_weakness",
    text: "Bu bulgu, ses, dokunma, kalabalık, ışık, hareket veya ağız içi uyaran yoğunluğu arttığında katılımın ve görevde kalmanın zorlaşabileceğini gösterir.",
    useIn: ["domain_comment", "formulation", "anamnesis_fit"],
  },
  {
    id: "SENSORY_REGULATION_WATCH_RANGE",
    domain: "sensory",
    purpose: "level_comment",
    level: "watch_range",
    text: "Bu alandaki bulgu, çocuğun her ortamda aynı düzeyde zorlanmadığını; kalabalık, yeni mekan, beklenmeyen ses, temas/giyim veya yoğun hareket koşullarında zorlanmanın daha belirgin olabileceğini ifade eder.",
    useIn: ["domain_comment", "anamnesis_fit"],
  },
  {
    id: "SENSORY_REGULATION_RELATIVE_STRENGTH",
    domain: "sensory",
    purpose: "level_comment",
    level: "relative_strength",
    text: "Göreli duyusal korunmuşluk, çevresel uyaranlara daha esnek yanıt verilebildiğini ve bu alanın mevcut profil içinde klinik öncelik oluşturmadığını düşündürür.",
    useIn: ["domain_comment", "conclusion"],
  },
  {
    id: "EMOTIONAL_REGULATION_RELATIVE_WEAKNESS",
    domain: "emotional",
    purpose: "level_comment",
    level: "relative_weakness",
    text: "Bu bulgu, duygusal yoğunluğun hızlı yükseldiğini, toparlanmanın uzadığını veya dış desteğe duyulan gereksinimin arttığını gösterebilir. Kişilik özelliği ya da psikiyatrik tanı olarak yorumlanmaz.",
    useIn: ["domain_comment", "formulation", "anamnesis_fit"],
  },
  {
    id: "EMOTIONAL_REGULATION_WATCH_RANGE",
    domain: "emotional",
    purpose: "level_comment",
    level: "watch_range",
    text: "Bu alandaki bulgu, geçiş, engellenme, belirsizlik, ayrılma veya yüksek uyaranlı bağlamlarda toparlanmanın daha değişken olabileceğini gösterir.",
    useIn: ["domain_comment", "anamnesis_fit"],
  },
  {
    id: "EMOTIONAL_REGULATION_RELATIVE_STRENGTH",
    domain: "emotional",
    purpose: "level_comment",
    level: "relative_strength",
    text: "Göreli duygusal korunmuşluk, bazı zorlayıcı durumlarda yeniden dengeye dönüşün daha yönetilebilir olabileceğini düşündürür; bu alan, diğer self-regülasyon güçlüklerini dengeleyen bir bağlam olarak değerlendirilir.",
    useIn: ["domain_comment", "conclusion"],
  },
  {
    id: "COGNITIVE_REGULATION_RELATIVE_WEAKNESS",
    domain: "cognitive",
    purpose: "level_comment",
    level: "relative_weakness",
    text: "Bu bulgu, görev talebi arttığında dikkati sürdürme, bilgiyi zihinde tutma, yönergeyi işleme ve zihinsel organizasyonu koruma süreçlerinin zorlandığını gösterir.",
    useIn: ["domain_comment", "formulation", "anamnesis_fit"],
  },
  {
    id: "COGNITIVE_REGULATION_WATCH_RANGE",
    domain: "cognitive",
    purpose: "level_comment",
    level: "watch_range",
    text: "Bu alandaki bulgu, düşük talepli veya yapılandırılmış bağlamlarda kapasitenin daha iyi görünebileceğini; sözel talep ve görev karmaşıklığı arttığında zorlanmanın belirginleşebileceğini anlatır.",
    useIn: ["domain_comment", "anamnesis_fit"],
  },
  {
    id: "COGNITIVE_REGULATION_RELATIVE_STRENGTH",
    domain: "cognitive",
    purpose: "level_comment",
    level: "relative_strength",
    text: "Göreli bilişsel korunmuşluk, dikkat odağını sürdürme ve yapılandırılmış etkinlikte kalma kapasitesinin daha istikrarlı olabileceğini düşündürür.",
    useIn: ["domain_comment", "conclusion"],
  },
  {
    id: "EXECUTIVE_FUNCTION_RELATIVE_WEAKNESS",
    domain: "executive",
    purpose: "level_comment",
    level: "relative_weakness",
    text: "Bu bulgu, görevi başlatma ve durdurma, bekleme, sıra koruma, değişikliğe uyum sağlama ve çok basamaklı görevleri organize etme süreçlerinde daha fazla desteğe gereksinim olabileceğini gösterir.",
    useIn: ["domain_comment", "formulation", "anamnesis_fit"],
  },
  {
    id: "EXECUTIVE_FUNCTION_WATCH_RANGE",
    domain: "executive",
    purpose: "level_comment",
    level: "watch_range",
    text: "Bu alandaki bulgu, yapılandırma olduğunda performansın toparlanabildiğini; geçiş, bekleme, çok basamaklı görev veya belirsizlikte zorlanmanın belirginleşebildiğini anlatır.",
    useIn: ["domain_comment", "anamnesis_fit"],
  },
  {
    id: "EXECUTIVE_FUNCTION_RELATIVE_STRENGTH",
    domain: "executive",
    purpose: "level_comment",
    level: "relative_strength",
    text: "Göreli yürütücü korunmuşluk, davranışı hedefe göre ayarlama ve geri bildirime göre düzenleme kapasitesinin daha dengeli olabileceğini düşündürür.",
    useIn: ["domain_comment", "conclusion"],
  },
  {
    id: "INTEROCEPTION_RELATIVE_WEAKNESS",
    domain: "interoception",
    purpose: "level_comment",
    level: "relative_weakness",
    text: "Bu bulgu, açlık, susuzluk, tuvalet, ağrı veya yorgunluk gibi beden sinyallerini zamanında fark etme ve davranışı bu bilgiye göre ayarlama sürecinde güçlük olabileceğini gösterir. Erken çocuklukta bu alan tek veri kaynağıyla genellenmez.",
    useIn: ["domain_comment", "formulation", "anamnesis_fit"],
  },
  {
    id: "INTEROCEPTION_WATCH_RANGE",
    domain: "interoception",
    purpose: "level_comment",
    level: "watch_range",
    text: "Bu alandaki bulgu, açlık, susuzluk, tuvalet, ağrı veya yorgunluk sinyallerinin bazı bağlamlarda gecikmeli fark edilebileceğini ve toparlanmayı etkileyebileceğini anlatır.",
    useIn: ["domain_comment", "anamnesis_fit"],
  },
  {
    id: "INTEROCEPTION_RELATIVE_STRENGTH",
    domain: "interoception",
    purpose: "level_comment",
    level: "relative_strength",
    text: "Göreli interoseptif korunmuşluk, iç bedensel ihtiyaçları fark etme ve günlük işlevsellik içinde kullanma kapasitesinin daha düzenli olabileceğini düşündürür.",
    useIn: ["domain_comment", "conclusion"],
  },
];

export const CLINICAL_KNOWLEDGE_CHUNKS: ClinicalKnowledgeChunk[] = [
  {
    id: "REGULATION_OVERVIEW",
    purpose: "construct",
    text: "Regülasyon erken çocuklukta fizyolojik uyarılma, duyusal yanıt, duygu, dikkat ve davranışın bağlama göre birlikte ayarlanmasıdır; tek bir davranış belirtisiyle açıklanamaz.",
    useIn: ["decision", "formulation", "conclusion"],
  },
  {
    id: "REGULATION_EARLY_CHILDHOOD_FRAME",
    purpose: "construct",
    text: "2-5 yaş döneminde self-regülasyon henüz gelişmekte olduğu için çevresel yapı, bakımveren eş-regülasyonu, günlük rutin ve bağlam değişkenleri yorumun merkezinde tutulmalıdır.",
    useIn: ["decision", "anamnesis_fit", "conclusion"],
  },
  {
    id: "REGULATION_INTERPRETATION_BOUNDARY",
    purpose: "safety",
    text: "Regülasyon skoru tek başına bozukluk, tanı, neden veya tedavi gerekliliği göstermez; rapor betimleyici, bağlamsal ve klinik hipotez düzeyinde kalmalıdır.",
    useIn: ["decision", "prioritization", "conclusion"],
  },
  {
    id: "REGULATION_REPORT_STYLE",
    purpose: "report_language",
    text: "Skor örüntüsü, günlük yaşamda görülen işlevsel karşılıklar ve bağlamla birlikte değerlendirilir; bulgular çocuğu sabit bir etiketle tanımlamaz.",
    useIn: ["decision", "formulation", "conclusion"],
  },
  {
    id: "PHYSIOLOGICAL_REGULATION_ANAMNESIS_INTEGRATION",
    domain: "physiological",
    purpose: "anamnesis",
    text: "Uyku kalitesi, yeme düzeni, yorgunluk eşiği, hastalık dönemleri ve stres sonrası toparlanma gözlemleri fizyolojik regülasyon yorumuna doğrudan bağlamsal ağırlık kazandırır.",
    useIn: ["domain_comment", "anamnesis_fit"],
  },
  {
    id: "PHYSIOLOGICAL_REGULATION_REPORT_LANGUAGE",
    domain: "physiological",
    mechanism: ["physiological_interoceptive", "selective_interoception", "adaptive_daily_living"],
    purpose: "report_language",
    text: "Fizyolojik regülasyon güçlüğü, bedensel toparlanmanın günlük akışta hangi koşullarda zorlandığını açıklar. Bu bulgu tıbbi bir neden veya otonom işlev bozukluğu göstermez.",
    useIn: ["decision", "formulation", "conclusion"],
  },
  {
    id: "SENSORY_REGULATION_ANAMNESIS_INTEGRATION",
    domain: "sensory",
    purpose: "anamnesis",
    text: "Ses, dokunma, giyim, banyo, oral seçicilik, kalabalık ortam ve yeni mekan zorlanmaları duyusal regülasyonun günlük yaşam karşılığını güçlendiren temel anamnez verileridir.",
    useIn: ["domain_comment", "anamnesis_fit"],
  },
  {
    id: "SENSORY_REGULATION_REPORT_LANGUAGE",
    domain: "sensory",
    mechanism: ["default"],
    purpose: "report_language",
    text: "Duyusal regülasyon yükü, çevresel uyaranların işlevsel performansı hangi koşullarda dalgalandırdığını açıklar; davranışı tek başına etiketleyen bir yorum değildir.",
    useIn: ["decision", "formulation", "conclusion"],
  },
  {
    id: "EMOTIONAL_REGULATION_ANAMNESIS_INTEGRATION",
    domain: "emotional",
    purpose: "anamnesis",
    text: "Geçişlerde taşma, yoğun ağlama, engellenme sonrası toparlanma süresi ve dış düzenleme ihtiyacı duygusal regülasyonun vaka içi karşılığını açık biçimde gösterir.",
    useIn: ["domain_comment", "anamnesis_fit"],
  },
  {
    id: "EMOTIONAL_REGULATION_REPORT_LANGUAGE",
    domain: "emotional",
    mechanism: ["social_pragmatic", "language_social_pragmatic", "adaptive_daily_living", "motor_praxis", "default"],
    purpose: "report_language",
    text: "Duygusal regülasyon yükü, yoğunluğun hangi bağlamlarda yükseldiği ve toparlanmanın ne zaman zorlandığı üzerinden yorumlanır; psikiyatrik etiket ya da kişilik çıkarımı üretmez.",
    useIn: ["decision", "formulation", "conclusion"],
  },
  {
    id: "COGNITIVE_REGULATION_ANAMNESIS_INTEGRATION",
    domain: "cognitive",
    purpose: "anamnesis",
    text: "Sözel yük, yönerge karmaşıklığı, etkinliği sürdürme ve görevde kalma güçlüğü bildirimleri bilişsel regülasyon yorumuna doğrudan klinik değer katar.",
    useIn: ["domain_comment", "anamnesis_fit"],
  },
  {
    id: "COGNITIVE_REGULATION_REPORT_LANGUAGE",
    domain: "cognitive",
    mechanism: ["language_communication", "language_social_pragmatic", "social_pragmatic", "motor_praxis", "default"],
    purpose: "report_language",
    text: "Sözel talep veya eşzamanlı görev arttığında zihinsel organizasyon zorlanabilir. Bu bulgu tek başına genel zekâ veya öğrenme kapasitesi hakkında sonuç vermez.",
    useIn: ["decision", "formulation", "conclusion"],
  },
  {
    id: "EXECUTIVE_FUNCTION_ANAMNESIS_INTEGRATION",
    domain: "executive",
    purpose: "anamnesis",
    text: "Rutin başlatma, sırayı koruma, çok basamaklı akışı sürdürme, öz bakım görevini tamamlama ve dış organizasyon ihtiyacı yürütücü işlev yükünün günlük yaşam görünümünü belirginleştirir.",
    useIn: ["domain_comment", "anamnesis_fit"],
  },
  {
    id: "EXECUTIVE_FUNCTION_REPORT_LANGUAGE",
    domain: "executive",
    mechanism: ["adaptive_daily_living", "social_pragmatic", "language_communication", "language_social_pragmatic", "motor_praxis", "default"],
    purpose: "report_language",
    text: "Yürütücü işlev güçlüğü, davranış organizasyonunun görev akışı içinde nerede zorlandığını görünür kılar. Bu bulgu görev düzenleme becerileri üzerinden değerlendirilir.",
    useIn: ["decision", "formulation", "conclusion"],
  },
  {
    id: "INTEROCEPTION_ANAMNESIS_INTEGRATION",
    domain: "interoception",
    purpose: "anamnesis",
    text: "Açlık, susuzluk, tuvalet, ağrı, yorgunluk ve içsel gerilim sinyallerini geç fark etme ya da bunları günlük akışa katamama bildirimleri interosepsiyon yorumunu güçlendirir.",
    useIn: ["domain_comment", "anamnesis_fit"],
  },
  {
    id: "INTEROCEPTION_REPORT_LANGUAGE",
    domain: "interoception",
    mechanism: ["physiological_interoceptive", "selective_interoception", "adaptive_daily_living"],
    purpose: "report_language",
    text: "İnteroseptif güçlük, iç beden sinyallerinin günlük öz bakım ve toparlanma akışına zamanında katılamaması üzerinden klinik anlam kazanır.",
    useIn: ["decision", "formulation", "conclusion"],
  },
  ...domainConstructs,
  ...levelComments,
  {
    id: "CROSS_SCALE_SENSORY_EMOTIONAL",
    purpose: "cross_scale",
    text: "Duyusal ve duygusal alanlar birlikte zorlandığında, çevresel uyaran yoğunluğu ile uzayan duygusal toparlanma arasında işlevsel bir birliktelik değerlendirilir; bu ilişki nedensellik göstermez.",
    useIn: ["decision", "formulation", "prioritization", "conclusion"],
  },
  {
    id: "CROSS_SCALE_PHYSIOLOGICAL_EMOTIONAL",
    purpose: "cross_scale",
    text: "Fizyolojik ve duygusal alanlar birlikte zorlandığında, uyku, yorgunluk, açlık veya bedensel dengesizlik duygusal eşiği düşürebilen bağlamsal etkenler olarak değerlendirilir.",
    useIn: ["formulation", "anamnesis_fit", "conclusion"],
  },
  {
    id: "CROSS_SCALE_INTEROCEPTION_PHYSIOLOGICAL",
    purpose: "cross_scale",
    text: "İnterosepsiyon ve fizyolojik regülasyon birlikte zorlandığında, iç beden sinyallerini fark etme ve temel ritimleri düzenleme aynı beden-temelli eksende ele alınmalıdır.",
    useIn: ["decision", "formulation", "prioritization"],
  },
  {
    id: "CROSS_SCALE_INTEROCEPTION_EMOTIONAL",
    purpose: "cross_scale",
    text: "İnterosepsiyon ve duygusal regülasyon birlikte zorlandığında, içsel gerilimi erken fark etme güçlüğü duygusal yükselme ve toparlanma sürecini açıklayan ikincil bir etken olarak değerlendirilir.",
    useIn: ["formulation", "anamnesis_fit", "prioritization"],
  },
  {
    id: "CROSS_SCALE_COGNITIVE_EXECUTIVE",
    purpose: "cross_scale",
    text: "Bilişsel ve yürütücü alanlar birlikte zorlandığında dikkat sürdürme, görevi organize etme ve davranışı hedefe göre ayarlama süreçleri aynı anda etkilenebilir.",
    useIn: ["decision", "formulation", "prioritization"],
  },
  {
    id: "CROSS_SCALE_EMOTIONAL_EXECUTIVE",
    purpose: "cross_scale",
    text: "Duygusal ve yürütücü alanlar birlikte zorlandığında duygusal yoğunluk sırasında davranışı durdurma, bekleme, değişikliğe uyum sağlama ve yeniden katılım gösterme güçleşebilir.",
    useIn: ["formulation", "prioritization", "conclusion"],
  },
  {
    id: "CROSS_SCALE_WIDESPREAD_PATTERN",
    purpose: "cross_scale",
    text: "Üç veya daha fazla alanda zorlanma varsa rapor, bunu ağırlaştırıcı tanısal etiket gibi değil; birden fazla düzenleme sisteminde genişleyen işlevsel yük olarak yazmalıdır.",
    useIn: ["decision", "formulation", "conclusion"],
  },
  {
    id: "CROSS_SCALE_ASYMMETRICAL_PROFILE",
    purpose: "cross_scale",
    text: "Asimetrik profillerde belirgin zorlanan alan ile korunmuş alanlar arasındaki fark klinik yorumun merkezine alınmalı; güçlü alanlar işlevsel denge sağlayan bağlam olarak görünür kılınmalıdır.",
    useIn: ["evidence_profile", "formulation", "conclusion"],
  },
  {
    id: "RISK_PROFILE_GENERAL_RULE",
    purpose: "risk_profile",
    text: "Risk profili yorumu, alan puanlarını yalnız sıralamak yerine ana klinik ekseni, ikincil yayılımı ve korunmuş dengeleyici alanları birlikte görünür kılar.",
    useIn: ["evidence_profile", "prioritization", "conclusion"],
  },
  {
    id: "RISK_PROFILE_SINGLE_DOMAIN",
    purpose: "risk_profile",
    text: "Tek alanda belirgin zorlanma varsa rapor seçici kırılganlığı açıklar, günlük yaşam görünümünü anlatır ve tek alan zorluğunu genel patoloji gibi genişletmez.",
    useIn: ["decision", "formulation", "conclusion"],
  },
  {
    id: "RISK_PROFILE_DUAL_DOMAIN",
    purpose: "risk_profile",
    text: "İki alanda birlikte zorlanma varsa iki skoru ayrı ayrı saymak yerine alanların birbirini nasıl etkileyebileceği açık ve temkinli biçimde ele alınır.",
    useIn: ["decision", "formulation", "prioritization"],
  },
  {
    id: "RISK_PROFILE_MULTI_DOMAIN",
    purpose: "risk_profile",
    text: "Üç veya daha fazla alanda zorlanma varsa rapor çoklu alanlarda eşzamanlı kırılganlık ve genişleyen düzenleme yükü dilini kullanabilir; tanısal ya da ağırlaştırıcı etiket üretmez.",
    useIn: ["decision", "formulation", "conclusion"],
  },
  {
    id: "RISK_PROFILE_CONTEXT_MODIFIERS",
    purpose: "risk_profile",
    text: "Aynı skor örüntüsü farklı çocuklarda farklı anlam taşıyabilir; uyku, rutin, bakımveren eş-regülasyonu, çevresel stres, tıbbi geçmiş ve ortamlar arası farklılık yorum ağırlığını değiştiren bağlamlardır.",
    useIn: ["anamnesis_fit", "prioritization", "conclusion"],
  },
  {
    id: "RISK_PROFILE_PROTECTIVE_FACTORS",
    purpose: "risk_profile",
    text: "Korunmuş alanlar ve iyi işleyen bağlamlar, güçlüklerin hangi koşullarda belirginleştiğini sınırlayan dengeleyici kanıt sağlar.",
    useIn: ["evidence_profile", "formulation", "conclusion"],
  },
  {
    id: "RISK_PROFILE_SUMMARY_RULE",
    purpose: "risk_profile",
    text: "Kanıt özeti ve sonuç bölümleri, baskın risk örüntüsünü kısa ama karar verici biçimde özetlemeli; teknik skor listesini klinik sentezin önüne geçirmemelidir.",
    useIn: ["evidence_profile", "prioritization", "conclusion"],
  },
  {
    id: "ANAMNESIS_INTEGRATION_GENERAL_RULE",
    purpose: "anamnesis",
    text: "Anamnez skoru açıklayan neden gibi değil, skorun günlük yaşamdaki görünümünü bağlamsallaştıran veri olarak kullanılmalıdır.",
    useIn: ["anamnesis_fit", "prioritization"],
  },
  {
    id: "ANAMNESIS_SLEEP_AND_ROUTINE",
    purpose: "anamnesis",
    text: "Uyku, yeme, tuvalet, geçişler ve rutin istikrarı özellikle fizyolojik, duygusal ve yürütücü yorumlarda yüksek değerli bağlam verisidir; nedensellik kurulmadan ilişkilendirilmelidir.",
    useIn: ["anamnesis_fit", "formulation"],
  },
  {
    id: "ANAMNESIS_SENSORY_CONTEXT",
    purpose: "anamnesis",
    text: "Gürültü, dokunsal kaçınma, oral seçicilik, kalabalık ortam zorlanması, hareket arayışı, saç/banyo/giyim direnci ve yeni mekanlarda taşma duyusal regülasyon yorumuna doğrudan bağlamsal değer katar.",
    useIn: ["domain_comment", "anamnesis_fit"],
  },
  {
    id: "ANAMNESIS_EMOTIONAL_CONTEXT",
    purpose: "anamnesis",
    text: "Zor sakinleşme, yoğun ağlama, öfkeyi toparlayamama, değişiklikte zorlanma veya rutin bozulunca taşma bildirimleri duygusal regülasyonun günlük yaşam karşılığını görünür kılar.",
    useIn: ["domain_comment", "anamnesis_fit"],
  },
  {
    id: "ANAMNESIS_ATTENTION_AND_TASK_BEHAVIOR",
    purpose: "anamnesis",
    text: "Dikkat, oyunda kalma, etkinliği tamamlama, yönergeyi sürdürme ve dürtü kontrolü bildirimleri bilişsel regülasyon ile yürütücü işlev arasında ayrıştırılarak ele alınır.",
    useIn: ["domain_comment", "anamnesis_fit"],
  },
  {
    id: "ANAMNESIS_INTEROCEPTIVE_CONTEXT",
    purpose: "anamnesis",
    text: "Tuvaleti geç söyleme, açlık/susuzluğu geç fark etme, ağrı veya rahatsızlığı anlatamama ve yorgunluğu geç fark etme interosepsiyon yorumuna yüksek değerli bağlam sağlar.",
    useIn: ["domain_comment", "anamnesis_fit"],
  },
  {
    id: "ANAMNESIS_PARENTING_AND_CO_REGULATION",
    purpose: "anamnesis",
    text: "Bakımverenle eş-regülasyon, özellikle duygusal regülasyon, fizyolojik toparlanma ve yürütücü işlev görünümünü etkileyen bağlamsal bir değişkendir; ebeveyn kaynaklı nedensellik kurulmaz.",
    useIn: ["anamnesis_fit", "conclusion"],
  },
  {
    id: "ANAMNESIS_MEDICAL_AND_DEVELOPMENTAL_HISTORY",
    purpose: "anamnesis",
    text: "Tıbbi geçmiş, gebelik-doğum hikayesi ve erken gelişim bilgileri yalnız bağlamsal olarak kullanılmalı; mevcut regülasyon profilinin doğrudan nedeni gibi yazılmamalıdır.",
    useIn: ["anamnesis_fit"],
  },
  {
    id: "ANAMNESIS_CONTRADICTION_RULE",
    purpose: "anamnesis",
    text: "Skor ve anamnez ayrışıyorsa bu çelişki değil, bağlam farkı veya veri sınırlılığı olarak not edilmelidir; yorumun güven düzeyi buna göre temkinli tutulur.",
    useIn: ["anamnesis_fit", "prioritization"],
  },
  {
    id: "ANAMNESIS_PROTECTIVE_CONTEXT",
    purpose: "anamnesis",
    text: "Düzenli rutin, destekleyici eş-regülasyon, belirli ortamlarda iyi uyum, oyunda veya sosyal ilişkide korunmuşluk gibi veriler raporu aşırı sorun odaklı olmaktan korur.",
    useIn: ["anamnesis_fit", "conclusion"],
  },
  {
    id: "REPORT_OUTPUT_STRUCTURE",
    purpose: "report_language",
    text: "Rapor akışı klinik karar özeti, kanıt profili, alan yorumu, formülasyon, anamnez uyumu, önceliklendirme ve sonuç sırasını korumalı; aynı hipotezi farklı başlıklarda tekrara düşürmemelidir.",
    useIn: ["decision", "evidence_profile", "formulation", "prioritization", "conclusion"],
  },
  {
    id: "REPORT_TONE_RULE",
    purpose: "report_language",
    text: "Rapor objektif, klinik, betimleyici, kısa ama bilgi yoğun, nedensellikten kaçınan, tanısal olmayan ve müdahale önermeyen bir dil taşımalıdır.",
    useIn: ["decision", "formulation", "conclusion"],
  },
  {
    id: "REPORT_LANGUAGE_RULE",
    purpose: "report_language",
    text: "Rapor 'uyumlu görünmektedir', 'bağlamsal olarak anlam kazanmaktadır', 'eşlik edebilir' ve 'günlük işlevsellikte görünür hale gelebilir' gibi klinik hipotez dilini tercih etmeli; 'kesindir', 'kanıtlar', 'mutlaka' ve 'gerektirir' dilinden kaçınmalıdır.",
    useIn: ["decision", "formulation", "prioritization", "conclusion"],
  },
  {
    id: "REPORT_PRIORITY_RULE",
    purpose: "report_language",
    text: "Rapor her şeyi yazmamalı; ana alan, ikinci belirgin alan, en anlamlı ölçekler arası ilişki, bu ilişkiyi güçlendiren anamnez ve korunmuş alan sırasını izlemelidir.",
    useIn: ["decision", "prioritization", "conclusion"],
  },
  {
    id: "REPORT_SAFETY_RULE",
    purpose: "safety",
    text: "Görünür rapor tanı önerisi, terapi planı, seans sıklığı, ilaç/medikal yorum, aileye direkt tavsiye listesi veya kesin neden-sonuç açıklaması üretmez.",
    useIn: ["prioritization", "conclusion"],
  },
  {
    id: "REPORT_FINAL_SUMMARY_TEMPLATE",
    purpose: "report_language",
    text: "Final özet; baskın 2-3 tema, varsa alanlar arası ilişki, anamnezle güçlenen bağlam, korunmuş alanlar ve tanısal olmayan açıklayıcı sonuç cümlesini kısa biçimde birleştirmelidir.",
    useIn: ["conclusion"],
  },
];

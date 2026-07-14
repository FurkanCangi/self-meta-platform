import { Fragment, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Award,
  Brain,
  BrainCircuit,
  BookOpen,
  CheckCircle2,
  Clock,
  ClipboardCheck,
  Database,
  Eye,
  FileCheck2,
  FileText,
  GraduationCap,
  HeartPulse,
  Layers3,
  ListChecks,
  LockKeyhole,
  PenLine,
  Route,
  ShieldCheck,
  Smile,
  Sparkles,
  Target,
  TimerReset,
  UserRound,
  Users,
  Zap,
} from "lucide-react";
import FooterContact from "../components/FooterContact";
import LandingHeader from "../components/LandingHeader";
import styles from "../marketing-pages.module.css";
import type { dnaPages } from "./content";

type DnaPage = (typeof dnaPages)[keyof typeof dnaPages];

const approachSystems = [
  {
    title: "Fizyolojik",
    text: "Uyku, enerji ve toparlanma kapasitesi",
    position: "left-top",
    color: "#1769ff",
    level: "82%",
    Icon: HeartPulse,
  },
  {
    title: "Duyusal",
    text: "Uyaran yükü ve tolerans",
    position: "left-middle",
    color: "#00a9d6",
    level: "68%",
    Icon: Eye,
  },
  {
    title: "Duygusal",
    text: "Yoğunluk ve toparlanma",
    position: "bottom",
    color: "#6d39e9",
    level: "58%",
    Icon: Smile,
  },
  {
    title: "Bilişsel",
    text: "Dikkat ve görev sürdürme",
    position: "right-middle",
    color: "#2d72f3",
    level: "50%",
    Icon: Brain,
  },
  {
    title: "Yürütücü",
    text: "Planlama ve bilişsel esneklik",
    position: "right-top",
    color: "#7538e8",
    level: "64%",
    Icon: Target,
  },
];

const approachFlow = [
  {
    step: "01",
    title: "Klinik çerçeve",
    text: "Klinik çerçeve ve vaka dili ortaklaşır.",
    Icon: GraduationCap,
  },
  {
    step: "02",
    title: "Veriyi birleştirme",
    text: "Ölçek, anamnez ve gözlem tek yapıda buluşur.",
    Icon: ClipboardCheck,
  },
  {
    step: "03",
    title: "Örüntüyü ayırma",
    text: "Örüntüler ayrılır, öncelikler görünür olur.",
    Icon: BrainCircuit,
  },
  {
    step: "04",
    title: "Klinik rapor",
    text: "Gerekçeli çıktı klinik karara hazırlanır.",
    Icon: FileText,
  },
];

const conceptColumns = [
  {
    label: "Self-regülasyon eğitimi",
    title: "Dynamic Neuro-Regulation Approach",
    text: "Klinisyene çocuğun davranışını regülasyon alanları üzerinden okuma ve vaka diline çevirme çerçevesi verir.",
    points: ["Klinik eğitim ve kavramsal çerçeve", "Regülasyon çekirdeği ve alan ilişkileri", "Vaka formülasyonu ve müdahale düşüncesi"],
  },
  {
    label: "Deterministik sistem",
    title: "DNA Intelligence",
    text: "Bu klinik dili dijital değerlendirme, veri sentezi ve rapor üretimi için kullanır; tanı koymaz, kararın yerini almaz.",
    points: ["Değerlendirme verisini yapılandırır", "Örüntüleri ve öncelikleri görünür kılar", "Açıklanabilir klinik rapor taslağı üretir"],
  },
];

const educationBadges = ["40 saat", "9 modül", "Klinik uygulama odaklı"];

const educationRoute = [
  {
    step: "01",
    title: "Regülasyonu okuyun",
    text: "Fizyolojik, duyusal ve duygusal sistemi birlikte görün.",
    Icon: HeartPulse,
  },
  {
    step: "02",
    title: "Vakayı yapılandırın",
    text: "Veriyi klinik örüntüye ve önceliğe dönüştürün.",
    Icon: BrainCircuit,
  },
  {
    step: "03",
    title: "Müdahaleyi gerekçelendirin",
    text: "Hedefi, stratejiyi ve takip dilini aynı çizgide kurun.",
    Icon: Target,
  },
];

const curriculumStages = [
  {
    number: "01",
    range: "Modül 01-03",
    title: "Regülasyonun temelini okuyun",
    text: "Davranışı tek bir belirti olarak değil, birbiriyle etkileşen düzenleme sistemlerinin çıktısı olarak ele alın.",
    modules: ["Fizyolojik düzenleme", "Duyusal işleme", "Duygusal regülasyon"],
    outcome: "Çocuğun zorlandığı alanın altında hangi düzenleme ihtiyacının bulunduğunu ayırt edin.",
    Icon: Activity,
  },
  {
    number: "02",
    range: "Modül 04-06",
    title: "Klinik örüntüyü yapılandırın",
    text: "Dikkat, yürütücü işlev, anamnez ve gözlem verilerini tek bir vaka formülasyonunda birleştirin.",
    modules: ["Bilişsel organizasyon", "Yürütücü işlevler", "Vaka formülasyonu"],
    outcome: "Dağınık bulguları önceliği ve gerekçesi açık bir klinik hipoteze dönüştürün.",
    Icon: BrainCircuit,
  },
  {
    number: "03",
    range: "Modül 07-09",
    title: "Kararı uygulamaya taşıyın",
    text: "Hedef seçimini, müdahale zamanlamasını ve seans içi kararları video vakalar üzerinden çalışın.",
    modules: ["Müdahale planlama", "Video vaka analizi", "Klinik karar dili"],
    outcome: "Ne yapacağınızı değil, neden ve ne zaman yapacağınızı açıklayan bir müdahale planı kurun.",
    Icon: Route,
  },
];

const teachingSegments = [
  { hours: "20", label: "Saat Teori", text: "Kuramsal içerik ve kavramsal çerçeve" },
  { hours: "10", label: "Saat Değerlendirme", text: "Vaka analizi, ölçüm ve klinik değerlendirme" },
  { hours: "10", label: "Saat Müdahale", text: "Uygulama, strateji geliştirme ve müdahale tasarımı" },
];

const teachingChecks = ["Vaka bazlı öğrenme", "Uygulamalı örnekler", "Tartışma ve geri bildirim", "Klinik düşünme pratiği"];

const audienceList = ["Ergoterapistler", "Çocuk gelişimi uzmanları", "Dil ve konuşma terapistleri", "Psikologlar ve psikolojik danışmanlar"];

const participantGains = [
  "Ortak bir klinik dil ve kavramsal çerçeve",
  "Daha güçlü vaka formülasyonu",
  "Müdahale önceliklendirme becerisi",
  "Yapılandırılmış klinik akıl yürütme",
  "Güvenli, etkili ve hedefe yönelik müdahale planlama",
  "Açıklanabilir klinik karar ve raporlama dili",
];

const practicalInfo = [
  { label: "Toplam Süre", value: "40 Saat", Icon: Clock },
  { label: "Eğitim Formatı", value: "Çevrim içi / senkron", Icon: GraduationCap },
  { label: "Katılım Koşulu", value: "İlgili lisans mezuniyeti", Icon: Users },
  { label: "Sertifika", value: "DNA Intelligence Eğitim Katılım Sertifikası", Icon: Award },
];

const assessmentScores = [
  { label: "Fizyolojik Düzenleme", score: 72 },
  { label: "Duyusal Regülasyon", score: 58 },
  { label: "Duygusal Regülasyon", score: 64 },
  { label: "Bilişsel Organizasyon", score: 69 },
  { label: "Yürütücü İşlevler", score: 55 },
  { label: "Sosyal Katılım", score: 71 },
];

const assessmentSources = [
  {
    title: "Anamnez",
    text: "Gelişim öyküsü ve günlük yaşam bağlamı",
    Icon: BookOpen,
  },
  {
    title: "Klinik gözlem",
    text: "Seans içi performans ve davranış örüntüsü",
    Icon: Eye,
  },
  {
    title: "Alan ölçekleri",
    text: "Yapılandırılmış yanıtlar ve alan puanları",
    Icon: ClipboardCheck,
  },
  {
    title: "Terapist notu",
    text: "Uzman yorumu ve klinik bağlam",
    Icon: UserRound,
  },
];

const assessmentBadges = ["4 veri kaynağı", "6 regülasyon alanı", "Açıklanabilir çıktı"];

const assessmentStages = [
  {
    number: "01",
    label: "Veriyi yapılandırın",
    title: "Dağınık bulguları ortak bir klinik dile getirin.",
    text: "Anamnez, gözlem, ölçek ve terapist notları aynı değerlendirme çerçevesinde bir araya gelir.",
    items: ["Anamnez", "Klinik gözlem", "Alan ölçekleri", "Terapist notu"],
    outcome: "Her bulgunun kaynağı ve klinik bağlamı korunur.",
    Icon: Layers3,
  },
  {
    number: "02",
    label: "Örüntüyü ayırın",
    title: "Altı regülasyon alanının birbirini nasıl etkilediğini görün.",
    text: "Alanlar tek bir toplam puana indirgenmeden karşılaştırılır; öncelik, eşlik eden güçlükler ve güçlü yönler birlikte okunur.",
    items: ["Fizyolojik", "Duyusal", "Duygusal", "Bilişsel", "Yürütücü", "Sosyal katılım"],
    outcome: "Birincil güçlük, eşlik eden alanlar ve koruyucu güçlü yönler ayrışır.",
    Icon: BrainCircuit,
  },
  {
    number: "03",
    label: "Önceliği netleştirin",
    title: "Profil bilgisini gerekçeli klinik karara taşıyın.",
    text: "Görünür örüntü; müdahale hedefi, takip göstergesi ve rapor dili için düzenli bir karar izine dönüşür.",
    items: ["Klinik öncelik", "Müdahale hedefi", "Takip göstergesi", "Rapor özeti"],
    outcome: "Terapist neyi önce ele alacağını ve nedenini daha açık görür.",
    Icon: Target,
  },
];

const assessmentProfileNotes = [
  {
    title: "Yapılandırılmış veri",
    text: "Farklı kaynaklardan gelen bilgiler aynı alan yapısında düzenlenir.",
    Icon: ClipboardCheck,
  },
  {
    title: "Klinik bağlam",
    text: "Puanlar; anamnez, gözlem ve terapist yorumuyla birlikte anlam kazanır.",
    Icon: Users,
  },
  {
    title: "Açıklanabilir karar",
    text: "Öncelik ve müdahale gerekçesi izlenebilir bir klinik dile dönüşür.",
    Icon: Target,
  },
];

const assessmentReadout = [
  { label: "Birincil öncelik", value: "Yürütücü işlevler" },
  { label: "Eşlik eden alan", value: "Duyusal regülasyon" },
  { label: "Koruyucu alan", value: "Fizyolojik düzenleme" },
  { label: "Takip odağı", value: "Göreve geçiş ve sürdürme" },
];

const interventionHeroSignals = [
  { title: "6 klinik alan", text: "tek örüntüde", Icon: BrainCircuit },
  { title: "Kişiye özel hedef", text: "gerekçeli planda", Icon: Target },
  { title: "Görünür değişim", text: "tanımlı takipte", Icon: BarChart3 },
];

const interventionLayers = [
  {
    number: "01",
    label: "Dengeyi kurun",
    title: "Bedensel güvenlik ve toparlanmayı önceleyin.",
    text: "Uyarılma düzeyi, fizyolojik durum ve duyusal yük birlikte okunur; çocuğun sakinleşmeye ve etkileşime hazır olduğu koşullar düzenlenir.",
    domains: ["Fizyolojik düzenleme", "Duyusal tolerans"],
    Icon: HeartPulse,
  },
  {
    number: "02",
    label: "Kapasiteyi genişletin",
    title: "Duygusal yoğunluğu ve bilişsel yükü yönetilebilir hale getirin.",
    text: "Toparlanma, dikkat ve görev sürdürme kapasitesi; çocuğun mevcut düzenleme sınırına uygun desteklerle aşamalı olarak güçlendirilir.",
    domains: ["Duygusal düzenleme", "Bilişsel organizasyon"],
    Icon: BrainCircuit,
  },
  {
    number: "03",
    label: "Katılıma taşıyın",
    title: "Kazanımı günlük yaşama ve işlevsel katılıma aktarın.",
    text: "Planlama, esneklik ve sosyal katılım hedefleri gerçek yaşam bağlamında izlenir; stratejiler performansa göre güncellenir.",
    domains: ["Yürütücü işlevler", "Sosyal katılım"],
    Icon: Users,
  },
];

const interventionJourney = [
  {
    number: "01",
    label: "Profili okuyun",
    title: "Davranışın arkasındaki düzenleme ihtiyacını ayırın.",
    text: "Anamnez, gözlem ve alan skorları birlikte değerlendirilir; zorlanmanın ne zaman ve hangi koşullarda arttığı görünür hale gelir.",
    outcome: "Birincil örüntü ve destekleyici güçlü alanlar",
    Icon: ClipboardCheck,
  },
  {
    number: "02",
    label: "Önceliği seçin",
    title: "Aynı anda her şeyi değil, işlevi en çok etkileyen alanı hedefleyin.",
    text: "Klinik önem, günlük yaşama etkisi ve değişime açıklık birlikte ele alınarak ilk müdahale odağı belirlenir.",
    outcome: "Gerekçesi açık ilk klinik hedef",
    Icon: Target,
  },
  {
    number: "03",
    label: "Planı uygulayın",
    title: "Stratejiyi çocuğun profiline, bağlama ve hedefe göre eşleştirin.",
    text: "Çevresel düzenleme, terapötik etkileşim, görev yapısı ve doz; hedeflenen yanıtı destekleyecek biçimde birlikte planlanır.",
    outcome: "Hedef, strateji ve uygulama koşulları",
    Icon: Layers3,
  },
  {
    number: "04",
    label: "Yanıtı izleyin",
    title: "Değişimi tanımlı göstergelerle izleyin ve planı gerektiğinde güncelleyin.",
    text: "Seans içi yanıt, günlük yaşama aktarım ve yardım düzeyi izlenir; klinik hedef karşılanmıyorsa müdahale mantığı yeniden değerlendirilir.",
    outcome: "İzlenebilir ilerleme ve güncellenen plan",
    Icon: BarChart3,
  },
];

const interventionCaseRows = [
  { label: "Gözlenen örüntü", value: "Geçişlerde yükselen uyarılma", Icon: Eye },
  { label: "İlk klinik hedef", value: "Toparlanmayı ve göreve geçişi kolaylaştırmak", Icon: Target },
  { label: "Müdahale mantığı", value: "Ön düzenleme, çevresel yapı ve tempo ayarı", Icon: Layers3 },
  { label: "Takip göstergesi", value: "Göreve geçiş süresi ve gereken yardım", Icon: BarChart3 },
];

const interventionReviewTriggers = [
  "Hedeflenen yanıt birkaç uygulamada görünmüyorsa",
  "Yeni bir zorlanma örüntüsü ortaya çıkıyorsa",
  "Kazanım farklı ortam ve kişilere taşınmıyorsa",
];

const interventionValuePoints = [
  { title: "Net öncelik", text: "Neye önce müdahale edileceğini görün.", Icon: Target },
  { title: "Gerekçeli plan", text: "Hedef ile strateji arasındaki bağı koruyun.", Icon: Route },
  { title: "Ölçülebilir yanıt", text: "Değişimi tanımlı göstergelerle izleyin.", Icon: BarChart3 },
];

const reportHighlights = [
  { title: "Açıklanabilir Analiz", text: "Kural tabanlı örüntü analizi", Icon: BrainCircuit },
  { title: "Klinik Güvenilirlik", text: "Kanıt temelli ve tutarlı yapı", Icon: ShieldCheck },
  { title: "Zaman Tasarrufu", text: "Raporlama yükünü azaltır", Icon: TimerReset },
];

const rawDataInputs = [
  { title: "Anamnez", Icon: BookOpen },
  { title: "Ölçekler", Icon: ClipboardCheck },
  { title: "Video Gözlem", Icon: Eye },
  { title: "Terapist Notları", Icon: PenLine },
  { title: "Diğer Veriler", Icon: Database },
];

const clinicalReportOutputs = [
  { title: "Klinik Özet", Icon: FileText },
  { title: "Öncelikli Alanlar", Icon: Target },
  { title: "Klinik Yorum", Icon: BrainCircuit },
  { title: "Hedefler", Icon: ListChecks },
  { title: "Rapor", Icon: FileCheck2 },
];

const reportContentNotes = [
  {
    title: "Yapılandırılmış Klinik Özet",
    text: "Danışanın genel profilini net ve anlaşılır şekilde özetler.",
    side: "left",
  },
  {
    title: "Regülasyon Analizi",
    text: "Güçlü ve destek alanlarını görselleştirerek öncelikleri ortaya koyar.",
    side: "left",
  },
  {
    title: "Klinik Öncelikler",
    text: "Müdahale öncelikleri ve hedefler belirginleştirilir.",
    side: "right",
  },
  {
    title: "Takip Önerileri",
    text: "İzleme noktaları ve önerilerle sürdürülebilir ilerleme desteklenir.",
    side: "right",
  },
];

const reportSidebarItems = ["Klinik Özet", "Regülasyon Analizi", "Klinik Öncelikler", "Takip Önerileri"];

const aiProcessSteps = [
  {
    title: "Veri Toplama",
    text: "Anamnez, ölçek, gözlem ve notlar sisteme alınır.",
    Icon: Database,
  },
  {
    title: "Otomatik Analiz",
    text: "Deterministik motor, verileri doğrulanmış kurallarla analiz eder ve örüntüleri belirler.",
    Icon: BrainCircuit,
  },
  {
    title: "Klinik Taslak",
    text: "Yapılandırılmış rapor taslağı oluşturulur.",
    Icon: FileText,
  },
  {
    title: "Terapist Onayı",
    text: "Terapist düzenler, yorumlar ve onaylar.",
    Icon: UserRound,
  },
  {
    title: "Final Rapor",
    text: "Klinik rapor güvenli şekilde saklanır ve paylaşılır.",
    Icon: FileCheck2,
  },
];

const reportGains = [
  {
    title: "Zaman Tasarrufu",
    text: "Raporlama süresini önemli ölçüde azaltır.",
    Icon: TimerReset,
  },
  {
    title: "Tutarlılık",
    text: "Kanıta dayalı ve tutarlı rapor yapısı sağlar.",
    Icon: Route,
  },
  {
    title: "Klinik Netlik",
    text: "Karmaşık veriyi net ve anlaşılır hale getirir.",
    Icon: BrainCircuit,
  },
  {
    title: "Güvenli ve Gizli",
    text: "Verileriniz güvenli standartlara uygundur.",
    Icon: LockKeyhole,
  },
  {
    title: "İzlenebilirlik",
    text: "Rapor geçmişi ve değişiklikler takip edilebilir.",
    Icon: ClipboardCheck,
  },
];

const labsOrbitModules = [
  {
    title: "Video Gözlem",
    text: "Seans içi gözlemin yapılandırılması",
    Icon: Eye,
  },
  {
    title: "Görüntü İşleme",
    text: "Davranış ve hareket sinyallerinin analizi",
    Icon: Target,
  },
  {
    title: "Gelişim Takip",
    text: "Zaman içindeki değişimin izlenmesi",
    Icon: Route,
  },
];

const labModules = [
  {
    step: "01",
    title: "Video Gözlem",
    badge: "Planlanan Modül",
    text: "Seans içi davranış, regülasyon tepkileri ve katılım örüntülerinin yapılandırılmış biçimde izlenmesini hedefler.",
    value: "Terapistin gözlemini destekler, seansın kritik anlarını daha net anlamlandırmayı sağlar.",
    limit: "Tanı koyma veya otomatik klinik karar verme amacı taşımaz.",
    progress: 40,
    Icon: Eye,
    visual: "video",
    accent: "#7c3aed",
  },
  {
    step: "02",
    title: "Görüntü İşleme",
    badge: "Planlanan Modül",
    text: "Postür, hareket, motor yanıt ve gözlemsel davranış göstergelerini klinik bağlamla ilişkilendirecek altyapı olarak planlanır.",
    value: "Klinik veriyi daha zenginleştirerek değerlendirme sürecine destek olur.",
    limit: "Otomatik değerlendirme veya karar üretmez; terapistin yorumuna destek sağlar.",
    progress: 30,
    Icon: Target,
    visual: "motion",
    accent: "#2563eb",
  },
  {
    step: "03",
    title: "Gelişim Takip",
    badge: "Planlanan Modül",
    text: "Zaman içindeki değişimi; değerlendirme sonuçları, raporlar ve klinik gözlem notlarıyla birlikte izlemeyi amaçlar.",
    value: "İlerlemeyi görünür kılar, müdahale planlarının etkinliğini değerlendirmeye yardımcı olur.",
    limit: "Terapistin klinik muhakemesinin yerini almaz; destekleyici bir araçtır.",
    progress: 20,
    Icon: Route,
    visual: "growth",
    accent: "#00c8d7",
  },
];

const labsFlowSteps = [
  {
    title: "Gözlem",
    text: "Seans içi gözlem, notlar ve diğer veriler toplanır.",
    Icon: Eye,
  },
  {
    title: "Yapılandırma",
    text: "Veriler sistemde yapılandırılır ve düzenlenir.",
    Icon: Layers3,
  },
  {
    title: "Klinik Profil",
    text: "Çok boyutlu klinik profil oluşturulur.",
    Icon: BrainCircuit,
  },
  {
    title: "Takip",
    text: "İlerleme düzenli olarak izlenir ve değerlendirilir.",
    Icon: Route,
  },
  {
    title: "Rapor Desteği",
    text: "Açıklanabilir raporlama ile klinik içgörü desteklenir.",
    Icon: FileText,
  },
];

export default function DnaInfoPage({ page }: { page: DnaPage }) {
  const Icon = page.icon;
  const fallbackPage = page as DnaPage;
  const isApproachPage = page.slug === "dna-yaklasimi";
  const isEducationPage = page.slug === "egitim-programi";
  const isAssessmentPage = page.slug === "degerlendirme-sistemi";
  const isInterventionPage = page.slug === "mudahale-yaklasimi";
  const isAiReportPage = page.slug === "ai-raporlama";
  const isFutureModulesPage = page.slug === "gelecek-moduller";
  const calloutTitle = isEducationPage
    ? "Klinik pratiğinizi bir adım ileriye taşıyın."
    : isAssessmentPage
      ? "Değerlendirme ve raporlama akışınızı birlikte yapılandıralım."
    : isInterventionPage
      ? "Müdahale planınızı daha net ve izlenebilir kurun."
    : isAiReportPage
      ? "Klinik verinizin gücünü anlamlı raporlara dönüştürün."
    : isFutureModulesPage
      ? "Gelişen modüllerle klinik geleceği birlikte inşa ediyoruz."
    : "Değerlendirme ve raporlama akışınızı birlikte yapılandıralım.";
  const calloutText = isEducationPage
    ? "Öz-düzenleme alanında güçlü bir çerçeveye sahip olmak, etkili müdahalenin ve kalıcı değişimin anahtarıdır."
    : isAssessmentPage
      ? "Eğitim modelinden ölçüm formuna, profil yorumundan rapor diline kadar klinik sürecin nasıl kurulacağını birlikte netleştirebiliriz."
    : isInterventionPage
      ? "Değerlendirme bulgusundan klinik hedefe, uygulamadan takip göstergesine uzanan akışı birlikte yapılandıralım."
    : isAiReportPage
      ? "Deterministik raporlama ile dokümantasyon süresini azaltın, zamanınızı danışanlarınıza ayırın."
    : isFutureModulesPage
      ? "DNA Labs yolculuğunu takip edin, erken erişim fırsatlarından ilk siz haberdar olun."
    : "Eğitim modelinden ölçüm formuna, deterministik analizden rapor diline kadar klinik sürecin nasıl kurulacağını birlikte netleştirebiliriz.";
  const primaryActionLabel = isEducationPage
    ? "Programa Başvur"
    : isAssessmentPage
      ? "İletişime Geç"
    : isInterventionPage
      ? "İletişime Geç"
    : isAiReportPage
      ? "İletişime Geç"
    : isFutureModulesPage
      ? "Gelişen Modüller Hakkında Bilgi Al"
      : "İletişime Geç";
  const primaryActionHref = isEducationPage
    ? "/signup"
    : isAssessmentPage
      ? "/iletisim"
    : isInterventionPage
      ? "/iletisim"
    : isAiReportPage
      ? "/iletisim"
    : isFutureModulesPage
      ? "/iletisim"
      : "/iletisim";
  const secondaryActionLabel = isEducationPage
    ? "Detaylı Bilgi Al"
    : isAssessmentPage
      ? "Çözümleri İncele"
    : isInterventionPage
      ? "Eğitim Programı"
    : isAiReportPage
      ? "Detaylı Bilgi Al"
    : isFutureModulesPage
      ? "DNA Labs Yol Haritasını Takip Et"
      : "Çözümleri İncele";
  const secondaryActionHref = isEducationPage
    ? "/iletisim"
    : isInterventionPage
      ? "/dna-nedir/egitim-programi"
    : isAiReportPage
      ? "/cozumler"
    : isFutureModulesPage
      ? "#labs-flow"
    : "/cozumler";

  return (
    <div className={`${styles.page} ${isApproachPage ? styles.signalPage : ""}`}>
      <LandingHeader compact={isApproachPage} />
      <main className={styles.main}>
        {isApproachPage ? (
          <>
            <section className={styles.signalHero}>
              <div className={styles.signalHeroCopy}>
                <span className={styles.signalEyebrow}>Klinik karar desteği</span>
                <h1>DNA Intelligence</h1>
                <h2>
                  Örüntüyü görün.
                  <br />
                  Önceliği belirleyin.
                  <br />
                  Raporu netleştirin.
                </h2>
                <p>
                  Dynamic Neuro-Regulation Approach klinik çerçeveyi kurar; DNA Intelligence veriyi düzenler,
                  öncelikleri görünür kılar ve rapora taşır.
                </p>
                <div className={styles.signalActions}>
                  <Link className={styles.signalPrimaryAction} href="#klinik-akis">
                    Nasıl çalışır
                    <ArrowRight size={18} strokeWidth={2.2} />
                  </Link>
                  <Link className={styles.signalSecondaryAction} href="/dna-nedir/egitim-programi">
                    Eğitim modeli
                  </Link>
                </div>
              </div>

              <figure className={styles.signalMap} aria-labelledby="signal-map-title">
                <figcaption className={styles.signalPriority} id="signal-map-title">
                  <Target size={19} strokeWidth={2.2} aria-hidden="true" />
                  <span>Birincil öncelik</span>
                  <strong>Fizyolojik toparlanma</strong>
                </figcaption>
                <div className={styles.signalMapCanvas}>
                  <div className={styles.signalCore} aria-label="Regülasyon çekirdeği">
                    <Image
                      src="/images/brand/dna-logo-intelligence-symbol-transparent.png"
                      alt="DNA Intelligence regülasyon çekirdeği"
                      width={585}
                      height={657}
                      priority
                    />
                  </div>
                  {approachSystems.map((system) => (
                    <article
                      className={styles.signalDomain}
                      data-position={system.position}
                      key={system.title}
                      style={{
                        "--signal-color": system.color,
                        "--signal-level": system.level,
                      } as CSSProperties}
                      aria-label={`${system.title}: ${system.text}`}
                    >
                      <div className={styles.signalDomainTitle}>
                        <span aria-hidden="true">
                          <system.Icon size={19} strokeWidth={2} />
                        </span>
                        <span>{system.title}</span>
                      </div>
                      <Activity className={styles.signalPulse} size={58} strokeWidth={1.4} aria-hidden="true" />
                      <span className={styles.signalLevel} aria-hidden="true">
                        <i />
                      </span>
                    </article>
                  ))}
                </div>
              </figure>
            </section>

            <section className={styles.clinicalPathway} id="klinik-akis" aria-label="Klinik karar desteği akışı">
              <div className={styles.clinicalPathwayHeader}>
                <div>
                  <span>Klinik akış</span>
                  <h2>Veriden karara, tek çizgide.</h2>
                </div>
                <p>Dört adım, tek bir klinik mantık: çerçeveyi kur, veriyi birleştir, örüntüyü ayır ve raporu netleştir.</p>
              </div>
              <div className={styles.clinicalTrack}>
                {approachFlow.map((item) => (
                  <article className={styles.clinicalTrackItem} key={item.step}>
                    <div className={styles.clinicalTrackMarker} aria-hidden="true">
                      <item.Icon size={22} strokeWidth={1.9} />
                    </div>
                    <div>
                      <span>{item.step}</span>
                      <h3>{item.title}</h3>
                      <p>{item.text}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.modelBridgeSection} id="model-ayrimi" aria-label="Eğitim modeli ve karar destek sistemi ayrımı">
              <div className={styles.modelBridgeHeader}>
                <span>İki tamamlayıcı katman</span>
                <h2>Tek klinik karar, iki tamamlayıcı güç.</h2>
                <p>Eğitim düşünme çerçevesini kurar; DNA Intelligence bu çerçeveyi düzenli, izlenebilir bir çıktıya taşır.</p>
              </div>
              <div className={styles.modelBridgeCanvas}>
                {conceptColumns.map((column, index) => (
                  <Fragment key={column.title}>
                    <article className={styles.modelBridgeColumn}>
                      <div className={styles.modelBridgeColumnTop}>
                        <span aria-hidden="true">
                          {index === 0 ? <GraduationCap size={24} strokeWidth={1.8} /> : <BrainCircuit size={24} strokeWidth={1.8} />}
                        </span>
                        <small>{String(index + 1).padStart(2, "0")} · {column.label}</small>
                      </div>
                      <h3>{column.title}</h3>
                      <ul>
                        {column.points.map((point) => (
                          <li key={point}>
                            <CheckCircle2 size={17} strokeWidth={2} aria-hidden="true" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </article>
                    {index === 0 ? (
                      <div className={styles.modelBridgeConnector} aria-hidden="true">
                        <span>Klinik dil</span>
                        <ArrowRight size={26} strokeWidth={1.7} />
                        <strong>veriye dönüşür</strong>
                      </div>
                    ) : null}
                  </Fragment>
                ))}
              </div>
              <div className={styles.modelBridgeOutcome}>
                <div className={styles.modelBridgeOutcomeCopy}>
                  <span aria-hidden="true">
                    <Target size={23} strokeWidth={1.8} />
                  </span>
                  <div>
                    <small>Ortak çıktı</small>
                    <strong>Öncelikleri görünür, gerekçesi izlenebilir klinik rapor.</strong>
                  </div>
                </div>
                <div className={styles.modelBridgeActions}>
                  <Link className={styles.primary} href={primaryActionHref}>
                    {primaryActionLabel}
                    <ArrowRight size={18} />
                  </Link>
                  <Link className={styles.secondary} href={secondaryActionHref}>
                    {secondaryActionLabel}
                  </Link>
                </div>
              </div>
            </section>
          </>
        ) : isEducationPage ? (
          <>
            <section className={styles.educationHero}>
              <div className={styles.educationHeroCopy}>
                <div className={styles.eyebrow}>{page.eyebrow}</div>
                <h1>Dynamic Neuro-Regulation Approach</h1>
                <h2>
                  Regülasyonu okuyun. Vakayı yapılandırın. <span>Müdahaleyi gerekçelendirin.</span>
                </h2>
                <p>
                  Fizyolojik temelden klinik karara uzanan 40 saatlik program; değerlendirme, vaka formülasyonu ve
                  müdahale planlamasını tek bir klinik çizgide birleştirir.
                </p>
                <div className={styles.educationActions}>
                  <Link className={styles.primary} href="/signup">
                    Programa Başvur
                    <ArrowRight size={18} />
                  </Link>
                  <Link className={styles.secondary} href="#mufredat">
                    Müfredatı İncele
                  </Link>
                </div>
                <div className={styles.educationPills} aria-label="Eğitim programı özellikleri">
                  {educationBadges.map((pill) => (
                    <span key={pill}>
                      <CheckCircle2 size={15} strokeWidth={2.2} />
                      {pill}
                    </span>
                  ))}
                </div>
              </div>

              <div className={styles.educationRoutePanel} aria-label="Eğitim rotası">
                <div className={styles.educationRouteHeader}>
                  <div>
                    <span>Eğitim rotası</span>
                    <strong>Temelden klinik karara</strong>
                  </div>
                  <div className={styles.educationRouteMark} aria-hidden="true">
                    <Image
                      src="/images/brand/dna-logo-intelligence-symbol-transparent.png"
                      alt=""
                      width={585}
                      height={657}
                    />
                  </div>
                </div>
                <div className={styles.educationRouteStages}>
                  {educationRoute.map((item) => (
                    <article className={styles.educationRouteStep} key={item.step}>
                      <span>{item.step}</span>
                      <div className={styles.educationRouteIcon} aria-hidden="true">
                        <item.Icon size={21} strokeWidth={1.9} />
                      </div>
                      <div>
                        <h3>{item.title}</h3>
                        <p>{item.text}</p>
                      </div>
                    </article>
                  ))}
                </div>
                <div className={styles.educationRouteMetrics} aria-label="Program kısa bilgileri">
                  <div><strong>40</strong><span>saat</span></div>
                  <div><strong>9</strong><span>modül</span></div>
                  <div><strong>3</strong><span>öğrenme evresi</span></div>
                </div>
              </div>
            </section>

            <section className={styles.educationJourney} id="mufredat">
              <div className={styles.educationJourneyIntro}>
                <span>Program akışı</span>
                <h2>Dokuz modül.<br />Üç net öğrenme evresi.</h2>
                <p>
                  İçerik başlık başlık sıralanmaz; her evre bir sonraki klinik kararı hazırlayacak şekilde ilerler.
                </p>
              </div>
              <div className={styles.educationJourneyList}>
                {curriculumStages.map((stage) => (
                  <article className={styles.educationJourneyStage} key={stage.number}>
                    <div className={styles.educationStageNumber}>{stage.number}</div>
                    <div className={styles.educationStageBody}>
                      <div className={styles.educationStageTopline}>
                        <span>{stage.range}</span>
                        <stage.Icon size={21} strokeWidth={1.9} aria-hidden="true" />
                      </div>
                      <h3>{stage.title}</h3>
                      <p>{stage.text}</p>
                      <ul className={styles.educationStageModules}>
                        {stage.modules.map((module) => <li key={module}>{module}</li>)}
                      </ul>
                      <div className={styles.educationStageOutcome}>
                        <Target size={17} strokeWidth={2} aria-hidden="true" />
                        <span><strong>Klinik karşılığı:</strong> {stage.outcome}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.educationMethod} aria-label="40 saatlik öğretim modeli">
              <div className={styles.educationMethodHeader}>
                <div>
                  <span>Öğretim modeli</span>
                  <h2>40 saat, tek öğrenme döngüsü.</h2>
                </div>
                <p>Bilgiyi öğrenin, vaka üzerinde sınayın ve müdahale kararına dönüştürün.</p>
              </div>
              <div className={styles.educationHoursBar}>
                {teachingSegments.map((segment) => (
                  <article className={styles.educationHourSegment} key={segment.label}>
                    <strong>{segment.hours}</strong>
                    <div>
                      <span>{segment.label}</span>
                      <p>{segment.text}</p>
                    </div>
                  </article>
                ))}
              </div>
              <ul className={styles.educationMethodChecks}>
                {teachingChecks.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} strokeWidth={2.2} />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section className={styles.educationDecision} aria-label="Program karar bilgileri">
              <div className={styles.educationDecisionHeader}>
                <span>Size uygun mu?</span>
                <h2>Klinik çerçevesini güçlendirmek isteyen profesyoneller için.</h2>
              </div>
              <div className={styles.educationDecisionGrid}>
                <article className={styles.educationAudience}>
                  <h3>Kimler katılabilir?</h3>
                  <ul>
                  {audienceList.map((item) => (
                    <li key={item}>
                      <Users size={17} strokeWidth={2} />
                      {item}
                    </li>
                  ))}
                  </ul>
                </article>
                <article className={styles.educationOutcomes}>
                  <h3>Program sonunda</h3>
                  <ul>
                  {participantGains.map((item) => (
                    <li key={item}>
                      <CheckCircle2 size={17} strokeWidth={2.2} />
                      {item}
                    </li>
                  ))}
                  </ul>
                </article>
              </div>
              <div className={styles.educationFacts} aria-label="Pratik bilgiler">
                  {practicalInfo.map((item) => (
                  <div className={styles.educationFact} key={item.label}>
                      <item.Icon size={17} strokeWidth={2} />
                      <div>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          </>
        ) : isAssessmentPage ? (
          <>
            <section className={styles.evaluationHero}>
              <div className={styles.evaluationHeroCopy}>
                <div className={styles.eyebrow}>{page.eyebrow}</div>
                <h1>DNA Intelligence Değerlendirme Sistemi</h1>
                <h2>
                  Veriyi toplayın. Örüntüyü görün. <span>Klinik önceliği netleştirin.</span>
                </h2>
                <p>
                  Anamnez, gözlem, ölçek ve terapist yorumunu altı regülasyon alanında birleştirin; dağınık bulguları
                  gerekçesi açık bir klinik profile dönüştürün.
                </p>
                <div className={styles.evaluationActions}>
                  <Link className={styles.primary} href="#degerlendirme-akisi">
                    Akışı İncele
                    <ArrowRight size={18} />
                  </Link>
                  <Link className={styles.secondary} href="/dna-nedir/egitim-programi">
                    Eğitim Programı
                  </Link>
                </div>
                <div className={styles.evaluationPills} aria-label="Değerlendirme sistemi özellikleri">
                  {assessmentBadges.map((badge) => (
                    <span key={badge}>
                      <CheckCircle2 size={15} strokeWidth={2.2} />
                      {badge}
                    </span>
                  ))}
                </div>
              </div>

              <div className={styles.evaluationMap} aria-label="Değerlendirme verilerinin klinik profile dönüşümü">
                <div className={styles.evaluationMapHeader}>
                  <div>
                    <span>Değerlendirme haritası</span>
                    <strong>Dağınık veriden bütüncül profile</strong>
                  </div>
                  <div className={styles.evaluationMapMark} aria-hidden="true">
                    <Image
                      src="/images/brand/dna-logo-intelligence-symbol-transparent.png"
                      alt=""
                      width={585}
                      height={657}
                    />
                  </div>
                </div>
                <div className={styles.evaluationSourceGrid}>
                  {assessmentSources.map((source) => (
                    <article className={styles.evaluationSource} key={source.title}>
                      <source.Icon size={19} strokeWidth={1.9} aria-hidden="true" />
                      <div>
                        <h3>{source.title}</h3>
                        <p>{source.text}</p>
                      </div>
                    </article>
                  ))}
                </div>
                <div className={styles.evaluationMapBridge} aria-hidden="true">
                  <span />
                  <ArrowRight size={19} strokeWidth={1.8} />
                  <span />
                </div>
                <div className={styles.evaluationMapResult}>
                  <div className={styles.evaluationMapResultTitle}>
                    <BrainCircuit size={22} strokeWidth={1.9} aria-hidden="true" />
                    <div>
                      <span>Klinik profil</span>
                      <strong>Önceliği ve gerekçeyi görünür kılar</strong>
                    </div>
                  </div>
                  <ul>
                    <li>Birincil öncelik</li>
                    <li>Eşlik eden örüntü</li>
                    <li>Koruyucu güçlü alan</li>
                  </ul>
                </div>
                <div className={styles.evaluationMapMetrics} aria-label="Değerlendirme sistemi kısa bilgileri">
                  <div><strong>4</strong><span>veri kaynağı</span></div>
                  <div><strong>6</strong><span>regülasyon alanı</span></div>
                  <div><strong>1</strong><span>bütüncül profil</span></div>
                </div>
              </div>
            </section>

            <section className={styles.evaluationJourney} id="degerlendirme-akisi">
              <div className={styles.evaluationJourneyIntro}>
                <span>Değerlendirme akışı</span>
                <h2>Üç aşamada bulgudan klinik önceliğe.</h2>
                <p>
                  Sistem yalnızca puanları yan yana koymaz; her aşama bir sonraki klinik kararı hazırlayacak şekilde
                  ilerler.
                </p>
              </div>
              <div className={styles.evaluationJourneyList}>
                {assessmentStages.map((stage) => (
                  <article className={styles.evaluationJourneyStage} key={stage.number}>
                    <div className={styles.evaluationStageNumber}>{stage.number}</div>
                    <div className={styles.evaluationStageBody}>
                      <div className={styles.evaluationStageTopline}>
                        <span>{stage.label}</span>
                        <stage.Icon size={21} strokeWidth={1.9} aria-hidden="true" />
                      </div>
                      <h3>{stage.title}</h3>
                      <p>{stage.text}</p>
                      <ul className={styles.evaluationStageItems}>
                        {stage.items.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                      <div className={styles.evaluationStageOutcome}>
                        <Target size={17} strokeWidth={2} aria-hidden="true" />
                        <span><strong>Bu aşamanın çıktısı:</strong> {stage.outcome}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.evaluationProfile} aria-label="Örnek değerlendirme profili">
              <div className={styles.evaluationProfileHeader}>
                <div>
                  <span>Örnek profil görünümü</span>
                  <h2>Tek toplam puan değil, klinik örüntü.</h2>
                </div>
                <p>Alanlar karşılaştırılır; öncelik, eşlik eden güçlük ve güçlü yön aynı görünümde ayrışır.</p>
              </div>
              <div className={styles.evaluationProfileBody}>
                <div className={styles.evaluationScorePanel}>
                  <div className={styles.evaluationPanelTopline}>
                    <span>Alan görünümü</span>
                    <strong>Temsili profil</strong>
                  </div>
                  <div className={styles.evaluationScoreList}>
                  {assessmentScores.map((score) => (
                    <div className={styles.evaluationScoreRow} key={score.label}>
                      <div>
                        <span>{score.label}</span>
                        <strong>{score.score}</strong>
                      </div>
                      <div className={styles.evaluationScoreTrack}>
                        <span style={{ "--score": `${score.score}%` } as CSSProperties} />
                      </div>
                    </div>
                  ))}
                  </div>
                </div>
                <div className={styles.evaluationReadout}>
                  <div className={styles.evaluationPanelTopline}>
                    <span>Klinik okuma</span>
                    <strong>Örnek çıktı</strong>
                  </div>
                  <div className={styles.evaluationReadoutList}>
                    {assessmentReadout.map((item, index) => (
                      <article key={item.label}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <div>
                          <small>{item.label}</small>
                          <strong>{item.value}</strong>
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className={styles.evaluationLimitNote}>
                    <ShieldCheck size={20} strokeWidth={2} aria-hidden="true" />
                    <div>
                      <strong>Klinik karar terapiste aittir.</strong>
                      <p>Sistem veriyi düzenler, gerekçeyi görünür kılar ve uzman değerlendirmesini destekler.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className={styles.evaluationPrinciples} aria-label="Değerlendirme sisteminin üç ilkesi">
              <div className={styles.evaluationPrinciplesHeader}>
                <span>Klinik bütünlük</span>
                <h2>Sayıları değil, klinik anlamı birlikte okuyun.</h2>
              </div>
              <div className={styles.evaluationPrinciplesGrid}>
                {assessmentProfileNotes.map((note, index) => (
                  <article key={note.title}>
                    <div>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <note.Icon size={21} strokeWidth={1.9} aria-hidden="true" />
                    </div>
                    <h3>{note.title}</h3>
                    <p>{note.text}</p>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : isInterventionPage ? (
          <>
            <section className={styles.interventionModernHero}>
              <div className={styles.interventionModernHeroCopy}>
                <div className={styles.eyebrow}>{page.eyebrow}</div>
                <h1>
                  Önceliği belirleyin. Müdahaleyi gerekçelendirin. <span>Yanıtı izleyin.</span>
                </h1>
                <p>
                  Dynamic Neuro-Regulation Approach, davranışın arkasındaki düzenleme ihtiyacını görünür kılar;
                  değerlendirme bulgusunu kişiye özel hedefe, uygulanabilir stratejiye ve takip göstergesine bağlar.
                </p>
                <div className={styles.interventionModernActions}>
                  <Link className={styles.primary} href="#mudahale-akisi">
                    Müdahale Akışını İncele
                    <ArrowRight size={18} />
                  </Link>
                  <Link className={styles.secondary} href="/dna-nedir/egitim-programi">
                    Eğitim Programı
                  </Link>
                </div>
                <div className={styles.interventionHeroSignals} aria-label="Müdahale yaklaşımı kısa bilgileri">
                  {interventionHeroSignals.map((item) => (
                    <div key={item.title}>
                      <item.Icon size={18} strokeWidth={2} aria-hidden="true" />
                      <span><strong>{item.title}</strong>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.interventionDecisionMap} aria-label="Temsili müdahale karar haritası">
                <div className={styles.interventionDecisionHeader}>
                  <div>
                    <span>Klinik karar haritası</span>
                    <strong>Bulgudan izlenebilir müdahaleye</strong>
                  </div>
                  <div aria-hidden="true">
                    <Image
                      src="/images/brand/dna-logo-intelligence-symbol-transparent.png"
                      alt=""
                      width={585}
                      height={657}
                    />
                  </div>
                </div>
                <div className={styles.interventionDecisionTrace}>
                  <article>
                    <span>Gözlenen örüntü</span>
                    <strong>Geçişlerde yükselen uyarılma</strong>
                    <ul>
                      <li>Duyusal yük artıyor</li>
                      <li>Toparlanma yavaşlıyor</li>
                    </ul>
                  </article>
                  <div aria-hidden="true">
                    <ArrowRight size={21} strokeWidth={1.8} />
                  </div>
                  <article>
                    <span>İlk müdahale odağı</span>
                    <strong>Ön düzenleme ve geçiş desteği</strong>
                    <ul>
                      <li>Çevresel yapı</li>
                      <li>Tempo ayarı</li>
                    </ul>
                  </article>
                </div>
                <div className={styles.interventionDecisionResult}>
                  <div>
                    <Target size={19} strokeWidth={2} aria-hidden="true" />
                    <span><small>Hedeflenen yanıt</small><strong>Daha düzenli göreve geçiş</strong></span>
                  </div>
                  <div>
                    <BarChart3 size={19} strokeWidth={2} aria-hidden="true" />
                    <span><small>Takip göstergesi</small><strong>Süre + yardım düzeyi</strong></span>
                  </div>
                </div>
                <div className={styles.interventionDecisionNote}>
                  <ShieldCheck size={18} strokeWidth={2} aria-hidden="true" />
                  <span>Amaç davranışı bastırmak değil, düzenlenebilirliği ve işlevsel katılımı artırmaktır.</span>
                </div>
              </div>
            </section>

            <section className={styles.interventionLayerSection} aria-labelledby="mudahale-mantigi-baslik">
              <div className={styles.interventionLayerHeader}>
                <span>Müdahale mantığı</span>
                <h2 id="mudahale-mantigi-baslik">Davranıştan önce düzenleme ihtiyacını okuyun.</h2>
                <p>Altı regülasyon alanını üç klinik katmanda ele alın; hedefi çocuğun hazır oluşuna ve işlevsel ihtiyacına göre sıralayın.</p>
              </div>
              <div className={styles.interventionLayerGrid}>
                {interventionLayers.map((layer) => (
                  <article key={layer.number}>
                    <div className={styles.interventionLayerTopline}>
                      <span>{layer.number}</span>
                      <layer.Icon size={22} strokeWidth={1.9} aria-hidden="true" />
                    </div>
                    <small>{layer.label}</small>
                    <h3>{layer.title}</h3>
                    <p>{layer.text}</p>
                    <ul>
                      {layer.domains.map((domain) => <li key={domain}>{domain}</li>)}
                    </ul>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.interventionJourneySection} id="mudahale-akisi">
              <div className={styles.interventionJourneyIntro}>
                <span>Uygulama döngüsü</span>
                <h2>Dört adımda klinik bulgudan ölçülebilir yanıta.</h2>
                <p>
                  Her adım bir sonraki kararı hazırlar. Hedef, strateji ve takip göstergesi aynı klinik mantık içinde
                  kalır.
                </p>
              </div>
              <div className={styles.interventionJourneyList}>
                {interventionJourney.map((step) => (
                  <article key={step.number}>
                    <div className={styles.interventionJourneyNumber}>{step.number}</div>
                    <div className={styles.interventionJourneyBody}>
                      <div className={styles.interventionJourneyTopline}>
                        <span>{step.label}</span>
                        <step.Icon size={21} strokeWidth={1.9} aria-hidden="true" />
                      </div>
                      <h3>{step.title}</h3>
                      <p>{step.text}</p>
                      <div className={styles.interventionJourneyOutcome}>
                        <CheckCircle2 size={17} strokeWidth={2} aria-hidden="true" />
                        <span><strong>Bu adımın çıktısı:</strong> {step.outcome}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.interventionTrackingSection} aria-label="Temsili müdahale takip görünümü">
              <div className={styles.interventionTrackingHeader}>
                <div>
                  <span>Temsili vaka akışı</span>
                  <h2>Planı yalnızca yazmayın; klinik yanıtla sınayın.</h2>
                </div>
                <p>Başlangıç örüntüsü, hedef, müdahale mantığı ve takip göstergesi aynı görünümde tutulur.</p>
              </div>
              <div className={styles.interventionTrackingBody}>
                <div className={styles.interventionCaseRows}>
                  {interventionCaseRows.map((row, index) => (
                    <article key={row.label}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <row.Icon size={20} strokeWidth={1.9} aria-hidden="true" />
                      <div><small>{row.label}</small><strong>{row.value}</strong></div>
                    </article>
                  ))}
                </div>
                <aside className={styles.interventionReviewPanel}>
                  <span>Plan ne zaman yeniden değerlendirilir?</span>
                  <ul>
                    {interventionReviewTriggers.map((trigger) => (
                      <li key={trigger}><CheckCircle2 size={16} strokeWidth={2} aria-hidden="true" />{trigger}</li>
                    ))}
                  </ul>
                  <div>
                    <ShieldCheck size={19} strokeWidth={2} aria-hidden="true" />
                    <p><strong>Klinik karar terapiste aittir.</strong> Sistem, kararın gerekçesini ve takip izini düzenlemeye destek olur.</p>
                  </div>
                </aside>
              </div>
            </section>

            <section className={styles.interventionValueSection} aria-label="Müdahale yaklaşımının klinik katkıları">
              <div>
                <span>Klinik katkı</span>
                <h2>Daha az dağınıklık, daha açık bir müdahale mantığı.</h2>
              </div>
              <div className={styles.interventionValueGrid}>
                {interventionValuePoints.map((item, index) => (
                  <article key={item.title}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <item.Icon size={21} strokeWidth={1.9} aria-hidden="true" />
                    <div><h3>{item.title}</h3><p>{item.text}</p></div>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : isAiReportPage ? (
          <>
            <section className={styles.aiReportHero}>
              <div className={styles.aiReportHeroCopy}>
                <div className={styles.eyebrow}>Deterministik Raporlama</div>
                <h1>
                  Klinik verilerden anlamlı <span>içgörülere, okunabilir raporlara.</span>
                </h1>
                <p>
                  DNA Intelligence, çok boyutlu klinik verileri analiz eder, klinik muhakemeyi destekleyen tutarlı ve
                  yapılandırılmış raporlar üretir.
                </p>
                <div className={styles.aiReportHighlights} aria-label="Deterministik raporlama vurguları">
                  {reportHighlights.map((item) => (
                    <article key={item.title}>
                      <item.Icon size={20} strokeWidth={2.1} />
                      <strong>{item.title}</strong>
                      <span>{item.text}</span>
                    </article>
                  ))}
                </div>
              </div>

              <div className={styles.aiFlowVisual} aria-label="Ham veriden klinik rapora veri akışı">
                <div className={`${styles.aiFlowColumn} ${styles.aiFlowInput}`}>
                  <h2>Ham Veri</h2>
                  {rawDataInputs.map((item) => (
                    <article key={item.title}>
                      <item.Icon size={17} strokeWidth={2} />
                      <span>{item.title}</span>
                    </article>
                  ))}
                </div>

                <div className={styles.aiCore} aria-label="DNA Intelligence çekirdeği">
                  <span className={styles.aiCoreRing} />
                  <Image
                    src="/images/brand/dna-logo-intelligence-symbol-transparent.png"
                    alt=""
                    width={585}
                    height={657}
                    aria-hidden="true"
                  />
                  <strong>DNA Intelligence</strong>
                </div>

                <div className={`${styles.aiFlowColumn} ${styles.aiFlowOutput}`}>
                  <h2>Klinik Rapor</h2>
                  {clinicalReportOutputs.map((item) => (
                    <article key={item.title}>
                      <item.Icon size={17} strokeWidth={2} />
                      <span>{item.title}</span>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className={styles.aiReportContentSection}>
              <div className={styles.aiSectionTitle}>
                <h2>Raporun İçeriği</h2>
              </div>
              <div className={styles.aiReportMockupGrid}>
                <div className={styles.reportCalloutsLeft}>
                  {reportContentNotes
                    .filter((note) => note.side === "left")
                    .map((note) => (
                      <article className={styles.reportCalloutNote} key={note.title}>
                        <h3>{note.title}</h3>
                        <p>{note.text}</p>
                      </article>
                    ))}
                </div>

                <article className={styles.reportMockup} aria-label="Klinik rapor örnek mockupı">
                  <aside className={styles.reportMockSidebar}>
                    <div className={styles.reportAvatar}>ÇD</div>
                    <strong>Çocuk Danışanı</strong>
                    <span>7 yaş 3 ay</span>
                    <nav aria-label="Rapor bölümleri">
                      {reportSidebarItems.map((item, index) => (
                        <span className={index === 0 ? styles.reportSidebarActive : ""} key={item}>
                          {item}
                        </span>
                      ))}
                    </nav>
                  </aside>
                  <div className={styles.reportMockBody}>
                    <div className={styles.reportMockHeader}>
                      <span>Klinik Özet</span>
                      <strong>Terapist onayı bekliyor</strong>
                    </div>
                    <p>
                      Danışanın regülasyon profili genel olarak orta düzeydedir. Duyusal regülasyon ve yürütücü
                      işlevlerde destek ihtiyacı; sosyal katılım ve fizyolojik düzenleme alanlarında güçlü yönler
                      bulunmuştur.
                    </p>
                    <div className={styles.reportBarsGrid}>
                      <div>
                        <h3>Güçlü Alanlar</h3>
                        {["Fizyolojik Düzenleme", "Sosyal Katılım", "Duyusal Regülasyon"].map((item, index) => (
                          <div className={styles.reportBarRow} key={item}>
                            <span>{item}</span>
                            <i style={{ "--bar": `${74 - index * 10}%` } as CSSProperties} />
                          </div>
                        ))}
                      </div>
                      <div>
                        <h3>Destek Alanları</h3>
                        {["Duygusal Regülasyon", "Yürütücü İşlevler", "Bilişsel Organizasyon"].map((item, index) => (
                          <div className={styles.reportBarRow} key={item}>
                            <span>{item}</span>
                            <i style={{ "--bar": `${58 - index * 8}%` } as CSSProperties} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>

                <div className={styles.reportCalloutsRight}>
                  {reportContentNotes
                    .filter((note) => note.side === "right")
                    .map((note) => (
                      <article className={styles.reportCalloutNote} key={note.title}>
                        <h3>{note.title}</h3>
                        <p>{note.text}</p>
                      </article>
                    ))}
                </div>
              </div>
            </section>

            <section className={styles.aiCollaborationProcess}>
              <article className={styles.aiCollaborationCard}>
                <h2>Uzman + Deterministik Sistem İş Birliği</h2>
                <div className={styles.aiCollaborationLoop} aria-hidden="true">
                  <div className={styles.collabNode}>
                    <UserRound size={24} strokeWidth={2} />
                    <span>Terapist</span>
                  </div>
                  <div className={styles.collabNode}>
                    <Database size={24} strokeWidth={2} />
                    <span>Klinik Veri</span>
                  </div>
                  <div className={styles.collabNode}>
                    <BrainCircuit size={24} strokeWidth={2} />
                    <span>DNA Intelligence</span>
                  </div>
                  <div className={styles.collabCenter}>
                    <FileText size={30} strokeWidth={2} />
                    <strong>Klinik Rapor</strong>
                  </div>
                </div>
                <p>
                  Sistem, veriyi açıklanabilir kurallarla düzenler ve anlamlandırır; <strong>son karar her zaman terapiste aittir.</strong>
                </p>
              </article>

              <section className={styles.aiProcessSection} aria-label="Rapor üretim süreci">
                <h2>Rapor Üretim Süreci</h2>
                <div className={styles.aiProcessLine}>
                  {aiProcessSteps.map((step, index) => (
                    <article className={styles.aiProcessStep} key={step.title}>
                      <div>
                        <step.Icon size={24} strokeWidth={2} />
                      </div>
                      <span>{index + 1}</span>
                      <h3>{step.title}</h3>
                      <p>{step.text}</p>
                    </article>
                  ))}
                </div>
              </section>
            </section>

            <section className={styles.aiGainsSection}>
              <div className={styles.aiSectionTitle}>
                <h2>Deterministik Raporlama ile Kazanımlarınız</h2>
              </div>
              <div className={styles.aiGainsRow}>
                {reportGains.map((gain) => (
                  <article className={styles.aiGainItem} key={gain.title}>
                    <gain.Icon size={22} strokeWidth={2} />
                    <div>
                      <h3>{gain.title}</h3>
                      <p>{gain.text}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : isFutureModulesPage ? (
          <>
            <section className={styles.labsHero}>
              <div className={styles.labsHeroCopy}>
                <div className={styles.eyebrow}>DNA Labs</div>
                <h1>
                  DNA Labs: Klinik gözlemden gelişim takibine uzanan <span>yeni nesil modüller.</span>
                </h1>
                <p>
                  DNA Intelligence ekosistemi, klinik uygulamayı güçlendirmek için sürekli gelişir. Yeni modüller;
                  gözlemden takibe uzanan süreci daha yapılandırılmış, daha anlamlı ve daha erişilebilir hale getirmek
                  üzere tasarlanır.
                </p>
                <div className={styles.labsNotice}>
                  <ShieldCheck size={22} strokeWidth={2.1} />
                  <span>
                    Gelecek modüller terapistin klinik muhakemesini desteklemek için tasarlanır; tanı koyma ya da
                    otomatik tedavi kararı verme amacı taşımaz.
                  </span>
                </div>
              </div>

              <div className={styles.labsOrbit} aria-label="DNA Labs gelecek modül orbit görseli">
                <span className={styles.labsOrbitRing} />
                <span className={styles.labsOrbitRing} />
                <span className={styles.labsOrbitRing} />
                <div className={styles.labsOrbitCore}>
                  <Image
                    src="/images/brand/dna-logo-intelligence-symbol-transparent.png"
                    alt=""
                    width={585}
                    height={657}
                    aria-hidden="true"
                  />
                  <strong>DNA Labs</strong>
                </div>
                {labsOrbitModules.map((module, index) => (
                  <article
                    className={styles.labsOrbitModule}
                    key={module.title}
                    style={{ "--orbit-index": index } as CSSProperties}
                  >
                    <module.Icon size={24} strokeWidth={2.1} />
                    <div>
                      <h2>{module.title}</h2>
                      <p>{module.text}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.labsModuleJourney} id="lab-modules">
              <div className={styles.labsSectionTitle}>
                <h2>Modül Yolculuğu</h2>
              </div>
              <div className={styles.labsModuleGrid}>
                {labModules.map((module) => {
                  const visualClass =
                    module.visual === "video"
                      ? styles.labVisualVideo
                      : module.visual === "motion"
                        ? styles.labVisualMotion
                        : styles.labVisualGrowth;

                  return (
                    <article
                      className={styles.labModuleCard}
                      key={module.title}
                      style={
                        {
                          "--accent": module.accent,
                          "--progress": `${module.progress}%`,
                        } as CSSProperties
                      }
                    >
                      <div className={styles.labCardTopline}>
                        <span>{module.step}</span>
                        <b>{module.badge}</b>
                      </div>
                      <div className={`${styles.labCardVisual} ${visualClass}`} aria-hidden="true">
                        <module.Icon size={34} strokeWidth={1.9} />
                        <span />
                        <span />
                        <span />
                      </div>
                      <h3>{module.title}</h3>
                      <p>{module.text}</p>
                      <div className={styles.labInsightBlock}>
                        <strong>Klinik Değer</strong>
                        <span>{module.value}</span>
                      </div>
                      <div className={styles.labInsightBlock}>
                        <strong>Sınır</strong>
                        <span>{module.limit}</span>
                      </div>
                      <div className={styles.labProgress}>
                        <div>
                          <span>Gelişim aşaması</span>
                          <strong>%{module.progress}</strong>
                        </div>
                        <i />
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className={styles.labsClinicalFlow} id="labs-flow">
              <div className={styles.labsSectionTitle}>
                <h2>Klinik Akışta Gelecek Modüller</h2>
              </div>
              <div className={styles.labsFlowLine} aria-label="Klinik akışta gelecek modüller">
                {labsFlowSteps.map((step, index) => (
                  <article
                    className={styles.labsFlowStep}
                    key={step.title}
                    style={{ "--flow-index": index } as CSSProperties}
                  >
                    <div>
                      <step.Icon size={30} strokeWidth={2.1} />
                    </div>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : (
          <>
            <section className={styles.hero}>
              <div className={styles.eyebrow}>{fallbackPage.eyebrow}</div>
              <h1>{fallbackPage.title}</h1>
              <p>{fallbackPage.intro}</p>
            </section>

            <section className={styles.split}>
              <article className={styles.wideCard} style={{ "--accent": fallbackPage.accent } as CSSProperties}>
                <div className={styles.icon}>
                  <Icon size={30} strokeWidth={2} />
                </div>
                <h3>Bu sayfa klinik akışta nereye oturur?</h3>
                <p>
                  Dynamic Neuro-Regulation Approach klinik dili kurar; DNA Intelligence bu dili değerlendirme, analiz
                  ve deterministik raporlama modüllerinde kullanır.
                </p>
              </article>

              <article className={styles.wideCard} style={{ "--accent": "#2563EB" } as CSSProperties}>
                <div className={styles.icon}>
                  <CheckCircle2 size={30} strokeWidth={2} />
                </div>
                <h3>Klinik kullanımda sınır</h3>
                <p>
                  DNA Intelligence klinik muhakemeyi ikame etmez. Terapistin değerlendirme, hipotez kurma ve müdahale
                  planlama sürecini daha düzenli, izlenebilir ve veriye dayalı hale getirir.
                </p>
              </article>
            </section>

            <section className={styles.section}>
              <div className={styles.grid}>
                {fallbackPage.sections.map((section) => (
                  <article className={styles.card} key={section.title} style={{ "--accent": fallbackPage.accent } as CSSProperties}>
                    <div className={styles.icon}>
                      <CheckCircle2 size={28} strokeWidth={2} />
                    </div>
                    <h3>{section.title}</h3>
                    <p>{section.text}</p>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        {!isApproachPage ? (
          <section className={`${styles.callout} ${isApproachPage ? styles.signalCallout : ""} ${isAiReportPage ? styles.aiFinalCta : ""} ${isFutureModulesPage ? styles.labsFinalCta : ""}`}>
            <h2>{calloutTitle}</h2>
            <p>{calloutText}</p>
            <div className={styles.actions}>
              <Link className={styles.primary} href={primaryActionHref}>
                {primaryActionLabel}
                <ArrowRight size={18} />
              </Link>
              <Link className={styles.secondary} href={secondaryActionHref}>
                {secondaryActionLabel}
              </Link>
            </div>
          </section>
        ) : null}
      </main>
      <FooterContact />
    </div>
  );
}

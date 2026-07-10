import { Fragment, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import {
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
  Mail,
  PenLine,
  Phone,
  Route,
  ShieldCheck,
  Smile,
  SlidersHorizontal,
  Sparkles,
  Target,
  TimerReset,
  UserRound,
  Users,
  Video,
  Zap,
} from "lucide-react";
import FooterContact from "../components/FooterContact";
import LandingHeader from "../components/LandingHeader";
import styles from "../marketing-pages.module.css";
import type { dnaPages } from "./content";

type DnaPage = (typeof dnaPages)[keyof typeof dnaPages];

const approachSystems = [
  { title: "Fizyolojik", text: "Uyku, enerji, toparlanma" },
  { title: "Duyusal", text: "Uyaran yükü ve tolerans" },
  { title: "Duygusal", text: "Yoğunluk ve toparlanma" },
  { title: "Bilişsel", text: "Dikkat ve görev sürdürme" },
  { title: "Yürütücü", text: "Planlama ve esneklik" },
];

const approachPillLabels = [
  "Dynamic Neuro-Regulation: eğitim modeli",
  "DNA Intelligence: deterministik karar destek sistemi",
  "Değerlendirme ve analiz",
  "Deterministik raporlama",
];

const approachFlow = [
  {
    step: "01",
    title: "Klinik çerçeve",
    text: "Eğitimde regülasyon alanları, vaka formülasyonu ve müdahale düşüncesi ortak bir dile oturur.",
    Icon: GraduationCap,
  },
  {
    step: "02",
    title: "Veri toplama",
    text: "Ölçek, anamnez ve gözlem notları aynı self-regülasyon alan yapısına göre düzenlenir.",
    Icon: ClipboardCheck,
  },
  {
    step: "03",
    title: "Kural tabanlı sentez",
    text: "DNA Intelligence veriyi özetler, örüntüleri ayırır ve rapor diline hazırlar.",
    Icon: BrainCircuit,
  },
  {
    step: "04",
    title: "Klinik rapor",
    text: "Son karar terapiste ait kalır; çıktı değerlendirme, takip ve paylaşım için okunabilir hale gelir.",
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

const educationBadges = ["Kanıta Dayalı", "Klinik Uygulamalı", "40 Saatlik Kapsamlı Eğitim"];

const programSummary = [
  { label: "Toplam Süre", value: "40 Saat", Icon: Clock },
  { label: "Eğitim Modeli", value: "Teori + Değerlendirme + Müdahale", Icon: GraduationCap },
  { label: "Modül Sayısı", value: "9 Modül", Icon: Route },
  { label: "Uygulama Odaklılık", value: "Vaka, analiz ve klinik karar pratiği", Icon: Target },
  { label: "Sertifika", value: "DNA Intelligence Eğitim Katılım Sertifikası", Icon: Award },
];

const overviewCards = [
  {
    title: "Bütüncül Çerçeve",
    text: "Fizyolojiden bilişe uzanan bütünleşik bir öz-düzenleme modeli sunar.",
    Icon: BrainCircuit,
  },
  {
    title: "Klinik Düşünme",
    text: "Formülasyon merkezli eğitimle neden-sonuç ilişkisini güçlendirir.",
    Icon: Brain,
  },
  {
    title: "Uygulamaya Hazır",
    text: "Gerçek vaka, uygulama ve analizle klinik pratiğe doğrudan aktarılır.",
    Icon: CheckCircle2,
  },
];

const curriculumModules = [
  {
    title: "Fizyolojik Düzenleme",
    text: "Otonom sinir sistemi, arousal, stres yanıtı ve beden farkındalığı.",
  },
  {
    title: "Duyusal İşleme",
    text: "İnterosepsiyon, duyusal profiller ve duyusal düzenleme stratejileri.",
  },
  {
    title: "Duygusal Regülasyon",
    text: "Duyguların tanımı, ifade etme ve düzenleme süreçleri.",
  },
  {
    title: "Bilişsel Organizasyon",
    text: "Dikkat, çalışma belleği, esneklik ve bilişsel planlama.",
  },
  {
    title: "Yürütücü İşlevler",
    text: "Planlama, başlatma, izleme ve hedefe yönelik davranış.",
  },
  {
    title: "Vaka Formülasyonu",
    text: "İzlem, anamnez ve ölçek verilerini klinik hipoteze dönüştürme.",
  },
  {
    title: "Müdahale Planlama",
    text: "Hedef belirleme, müdahale stratejisi seçimi ve uygulama kurgusu.",
  },
  {
    title: "Video Vaka Analizi",
    text: "Gerçek vaka videoları üzerinden analiz ve tartışma.",
  },
  {
    title: "Klinik Karar Dili",
    text: "Klinik iletişim, karar verme ve raporlama dilini geliştirme.",
  },
];

const teachingSegments = [
  { hours: "20", label: "Saat Teori", text: "Kuramsal içerik ve kavramsal çerçeve" },
  { hours: "10", label: "Saat Değerlendirme", text: "Vaka analizi, ölçüm ve klinik değerlendirme" },
  { hours: "10", label: "Saat Müdahale", text: "Uygulama, strateji geliştirme ve müdahale tasarımı" },
];

const teachingChecks = ["Vaka bazlı öğrenme", "Uygulamalı örnekler", "Tartışma ve geri bildirim", "Klinik düşünme pratiği"];

const audienceList = [
  "Ergoterapistler",
  "Çocuk gelişimi uzmanları",
  "Dil ve konuşma terapistleri",
  "Psikologlar ve psikolojik danışmanlar",
  "Klinik uygulamada güçlü bir öz-düzenleme çerçevesi arayan profesyoneller",
];

const participantGains = [
  "Ortak bir klinik dil ve kavramsal çerçeve",
  "Daha güçlü vaka formülasyonu",
  "Müdahale önceliklendirme becerisi",
  "Yapılandırılmış klinik akıl yürütme",
  "Güvenli, etkili ve hedefe yönelik müdahale planlama",
  "DNA Intelligence Eğitim Katılım Sertifikası",
];

const programIncludes = [
  "Zengin eğitim materyalleri ve sunumlar",
  "Örnek vaka içerikleri ve analizler",
  "Uygulama oturumları ve etkileşimli çalışmalar",
  "Uzman eğitmen desteği ve geri bildirim",
  "Katılım sertifikası",
  "Platform geçişine hazırlayıcı içerikler",
];

const practicalInfo = [
  { label: "Toplam Süre", value: "40 Saat", Icon: Clock },
  { label: "Eğitim Formatı", value: "Çevrim içi / senkron", Icon: GraduationCap },
  { label: "Katılım Koşulu", value: "İlgili lisans mezuniyeti", Icon: Users },
  { label: "Sertifika", value: "DNA Intelligence Eğitim Katılım Sertifikası", Icon: Award },
  { label: "Erişim", value: "Eğitim süresince canlı katılım ve kayıt erişimi", Icon: BookOpen },
];

const assessmentScores = [
  { label: "Fizyolojik Düzenleme", score: 72 },
  { label: "Duyusal Regülasyon", score: 58 },
  { label: "Duygusal Regülasyon", score: 64 },
  { label: "Bilişsel Organizasyon", score: 69 },
  { label: "Yürütücü İşlevler", score: 55 },
  { label: "Sosyal Katılım", score: 71 },
];

const assessmentFlowSteps = [
  {
    title: "Alan bazlı veri",
    text: "Regülasyon alanlarından yapılandırılmış veriler toplanır.",
    Icon: Layers3,
  },
  {
    title: "Anamnez",
    text: "Gelişim öyküsü ve yaşam bağlamı sistematik kayda alınır.",
    Icon: BookOpen,
  },
  {
    title: "Gözlem",
    text: "Seans içi klinik gözlemler değerlendirmeye bağlanır.",
    Icon: Eye,
  },
  {
    title: "Ölçekler",
    text: "Standart ölçümler kantitatif veri katmanı sağlar.",
    Icon: FileText,
  },
  {
    title: "Terapist yorumu",
    text: "Uzman klinik bağlam ve yorum sisteme dahil edilir.",
    Icon: UserRound,
  },
  {
    title: "Klinik profil",
    text: "Tüm veriler bütüncül bir regülasyon profilinde birleşir.",
    Icon: BrainCircuit,
    final: true,
  },
];

const assessmentProfileNotes = [
  {
    title: "Standartize veri",
    text: "Ölçek, gözlem ve ölçümler ortak dilde toplanır; karşılaştırılabilir, güvenilir veri üretir.",
    Icon: ClipboardCheck,
  },
  {
    title: "Klinik bağlam",
    text: "Anamnez, gözlem ve terapist yorumu ile veriler kişi odaklı değerlendirme içinde anlam kazanır.",
    Icon: Users,
  },
  {
    title: "Karar desteği",
    text: "Regülasyon haritası, müdahale hedeflerinin belirlenmesini ve planlamanın önceliklendirilmesini destekler.",
    Icon: Target,
  },
];

const interventionHighlights = [
  { title: "Bütüncül", text: "Regülasyon odaklı", Icon: BrainCircuit },
  { title: "Kanıta Dayalı", text: "Bilimsel temelli", Icon: CheckCircle2 },
  { title: "Klinik Uygulamalı", text: "Pratiğe dönük", Icon: ClipboardCheck },
];

const regulationDomains = [
  { title: "Fizyolojik Düzenleme", Icon: HeartPulse },
  { title: "Duyusal Regülasyon", Icon: Eye },
  { title: "Duygusal Regülasyon", Icon: Smile },
  { title: "Bilişsel Organizasyon", Icon: BrainCircuit },
  { title: "Yürütücü İşlevler", Icon: Zap },
  { title: "Sosyal Katılım", Icon: Users },
];

const vagalBenefits = [
  "Güven hissi ve sosyal etkileşimi destekler",
  "Stres yanıtını düzenler ve sistemin toparlanmasını sağlar",
  "Öğrenme ve esnek davranışı kolaylaştırır",
];

const vagalOutcomeList = [
  "Daha iyi stres yönetimi",
  "Duygusal denge",
  "Sosyal katılım",
  "Dikkat ve odaklanma",
  "Öğrenme kapasitesi",
  "Davranışsal esneklik",
];

const interventionProcess = [
  {
    title: "Değerlendir",
    text: "Çok boyutlu değerlendirme ile güçlü ve destek alanları belirlenir.",
    Icon: ClipboardCheck,
  },
  {
    title: "Önceliklendir",
    text: "Regülasyon kırılganlıkları ve müdahale öncelikleri netleştirilir.",
    Icon: Target,
  },
  {
    title: "Planla",
    text: "Kişiye özel, hedef odaklı müdahale planı oluşturulur.",
    Icon: FileText,
  },
  {
    title: "Uygula",
    text: "Kanıta dayalı stratejilerle uygulama gerçekleştirilir.",
    Icon: Layers3,
  },
  {
    title: "İzle & Değerlendir",
    text: "İlerleme düzenli izlenir ve plan veriye göre güncellenir.",
    Icon: Eye,
  },
];

const interventionPrinciples = [
  {
    title: "Bütüncül Bakış",
    text: "Fizyolojik, duyusal, duygusal, bilişsel ve sosyal sistemleri birlikte ele alırız.",
    Icon: BrainCircuit,
  },
  {
    title: "Regülasyon Odaklı",
    text: "Amaç davranışı değiştirmekten önce regülasyon kapasitesini güçlendirmektir.",
    Icon: Target,
  },
  {
    title: "Kişiye Özel",
    text: "Her bireyin profilini dikkate alan esnek ve kişiselleştirilmiş planlar oluştururuz.",
    Icon: UserRound,
  },
  {
    title: "Dinamik ve Esnek",
    text: "Sistem değiştikçe plan güncellenir, ihtiyaçlara göre yönlendirilir.",
    Icon: Route,
  },
  {
    title: "Veriyle Güçlenen",
    text: "Değerlendirme verileri, klinik karar ve müdahale sürecini destekler.",
    Icon: ClipboardCheck,
  },
];

const interventionAudience = [
  "Ergoterapistler",
  "Çocuk gelişimi uzmanları",
  "Dil ve konuşma terapistleri",
  "Psikologlar ve psikolojik danışmanlar",
  "Öz-düzenleme temelli müdahale uygulayan tüm profesyoneller",
];

const interventionGains = [
  "Daha güçlü klinik formülasyon",
  "Hedefe yönelik müdahale planları",
  "Regülasyon kapasitesinde kalıcı artış",
  "Daha iyi katılım ve işlevsellik",
  "Ölçülebilir ilerleme ve klinik etkinlik",
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

const testToolHighlights = [
  { title: "Geçerli", text: "Bilimsel geçerliliği yüksek araçlar", Icon: ShieldCheck },
  { title: "Klinik Odaklı", text: "Klinik karar sürecini destekleyen ölçümler", Icon: Target },
  { title: "Yapılandırılmış", text: "Standartize formlar ile anlamlı veri toplama", Icon: ListChecks },
];

const testAssessmentAreas = [
  {
    title: "Fizyolojik Regülasyon",
    text: "Vücut temelli düzenleme becerilerini değerlendiren araçlar.",
    Icon: HeartPulse,
  },
  {
    title: "Duyusal Regülasyon",
    text: "Duyusal işleme ve duyusal yanıt örüntülerini ölçen araçlar.",
    Icon: SlidersHorizontal,
  },
  {
    title: "Duygusal Regülasyon",
    text: "Duygu düzenleme süreçlerini değerlendiren ölçekler.",
    Icon: Smile,
  },
  {
    title: "Yürütücü İşlevler",
    text: "Planlama, odaklanma ve davranış kontrolünü değerlendiren araçlar.",
    Icon: Zap,
  },
  {
    title: "Bilişsel Beceriler",
    text: "Kavramsal, dikkat ve problem çözme ile ilgili ölçme araçları.",
    Icon: BrainCircuit,
  },
  {
    title: "Klinik Gözlem",
    text: "Yapılandırılmış klinik gözlem ve kayıt formları.",
    Icon: ClipboardCheck,
  },
];

const testProcessSteps = [
  {
    title: "Seçim",
    text: "Uygun araçlar klinik ihtiyaca göre belirlenir.",
    Icon: Target,
  },
  {
    title: "Uygulama",
    text: "Seçilen ölçek ve formlar uygulanır.",
    Icon: PenLine,
  },
  {
    title: "Değerlendirme",
    text: "Veriler klinik bağlamda yorumlanır.",
    Icon: Brain,
  },
  {
    title: "Raporlama",
    text: "Bulgular anlaşılır ve yapılandırılmış şekilde sunulur.",
    Icon: FileText,
  },
  {
    title: "Klinik Kullanım",
    text: "Sonuçlar müdahale planlamasına katkı sağlar.",
    Icon: Sparkles,
  },
];

const upcomingTestTools = [
  {
    title: "Video Gözlem",
    text: "Seans içi davranış örüntülerini izlemeye yönelik araçlar.",
    Icon: Video,
  },
  {
    title: "Görüntü İşleme",
    text: "Hareket ve postüre dair nesnel göstergeleri analiz eden araçlar.",
    Icon: Target,
  },
  {
    title: "Gelişim Takip",
    text: "Zaman içindeki değişimi izlemeye yönelik takip modülleri.",
    Icon: BarChart3,
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
  const isTestsPage = page.slug === "testler";
  const isInterventionPage = page.slug === "mudahale-yaklasimi";
  const isAiReportPage = page.slug === "ai-raporlama";
  const isFutureModulesPage = page.slug === "gelecek-moduller";
  const calloutTitle = isEducationPage
    ? "Klinik pratiğinizi bir adım ileriye taşıyın."
    : isAssessmentPage
      ? "Değerlendirme ve raporlama akışınızı birlikte yapılandıralım."
    : isInterventionPage
      ? "Regülasyon odaklı müdahale yaklaşımımızla klinik etkinliğinizi güçlendirin."
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
      ? "Vagal fren, regülasyon kapasitesi ve vaka formülasyonu üzerinden müdahale planınızı daha izlenebilir hale getirelim."
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
      ? "Detaylı Bilgi Al"
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
    <div className={styles.page}>
      <LandingHeader />
      <main className={styles.main}>
        {isApproachPage ? (
          <>
            <section className={styles.approachHero}>
              <div className={styles.approachCopy}>
                <div className={styles.eyebrow}>{page.eyebrow}</div>
                <h1>{page.title}</h1>
                <p>{page.intro}</p>
                <div className={styles.approachPills} aria-label="Eğitim modeli ve deterministik sistem ayrımı">
                  {approachPillLabels.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
              </div>

              <div className={styles.approachBlueprint} aria-label="Dynamic Neuro-Regulation ve DNA Intelligence klinik akış yapısı">
                <div className={styles.blueprintHeader}>
                  <span>Regülasyon çekirdeği</span>
                  <strong>Dynamic Neuro-Regulation eğitimi + DNA Intelligence karar desteği</strong>
                </div>
                <div className={styles.blueprintBody}>
                  <div className={styles.blueprintMark}>
                    <Image
                      src="/images/brand/dna-logo-intelligence-symbol-transparent.png"
                      alt=""
                      width={585}
                      height={657}
                      aria-hidden="true"
                    />
                    <span>Regülasyon çekirdeği</span>
                  </div>
                  <div className={styles.blueprintStack}>
                    {approachSystems.map((system, index) => (
                      <article
                        className={styles.blueprintLayer}
                        key={system.title}
                        style={{ "--layer": index } as CSSProperties}
                      >
                        <span>{system.title}</span>
                        <p>{system.text}</p>
                      </article>
                    ))}
                  </div>
                </div>
                <div className={styles.blueprintFooter} aria-hidden="true">
                  <span>Eğitim dili</span>
                  <span>DNA Intelligence analizi</span>
                  <span>Deterministik rapor çıktısı</span>
                </div>
              </div>
            </section>

            <section className={styles.approachFlow}>
              <div className={styles.flowHeader}>
                <span>Uygulama akışı</span>
                <h2>Önce klinik çerçeve, sonra ölçüm, analiz ve rapor.</h2>
                <p>
                  Dynamic Neuro-Regulation Approach klinisyene self-regülasyonu okuma dilini verir. DNA Intelligence
                  bu dili veri düzenleme ve açıklanabilir deterministik raporlamada kullanır.
                </p>
              </div>
              <div className={styles.flowMap} aria-label="Eğitimden raporlamaya klinik akış">
                {approachFlow.map((item, index) => (
                  <Fragment key={item.step}>
                    <article className={styles.flowStep}>
                      <div className={styles.flowBadge}>
                        <item.Icon size={21} strokeWidth={2} />
                        <span>{item.step}</span>
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.text}</p>
                    </article>
                    {index < approachFlow.length - 1 ? <div className={styles.flowConnector} aria-hidden="true" /> : null}
                  </Fragment>
                ))}
              </div>
            </section>

            <section className={styles.conceptMatrix} aria-label="Dynamic Neuro-Regulation ve DNA Intelligence ayrımı">
              <article className={styles.conceptColumn}>
                <span>{conceptColumns[0].label}</span>
                <h2>{conceptColumns[0].title}</h2>
                <p>{conceptColumns[0].text}</p>
                <ul>
                  {conceptColumns[0].points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </article>
              <div className={styles.conceptBridge} aria-hidden="true">
                <span>Klinik dil</span>
                <strong>veriye ve rapora taşınır</strong>
              </div>
              <article className={styles.conceptColumn}>
                <span>{conceptColumns[1].label}</span>
                <h2>{conceptColumns[1].title}</h2>
                <p>{conceptColumns[1].text}</p>
                <ul>
                  {conceptColumns[1].points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </article>
            </section>
          </>
        ) : isEducationPage ? (
          <>
            <section className={styles.educationHero}>
              <div className={styles.educationHeroCopy}>
                <div className={styles.eyebrow}>{page.eyebrow}</div>
                <h1>
                  Dynamic Neuro-Regulation Approach <span>Eğitim Programı</span>
                </h1>
                <strong>Klinik akla, fizyolojik temele ve uygulamaya dayalı kapsamlı bir eğitim.</strong>
                <p>
                  Terapistlerin öz-düzenleme süreçlerini fizyolojik temellerden bilişsel organizasyona kadar bütüncül
                  şekilde anlamasını; değerlendirme, formülasyon ve müdahaleyi bilimsel ve uygulanabilir bir çerçevede
                  kurmasını sağlar.
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

              <div className={styles.programSummary} aria-label="Program özeti">
                <div className={styles.summaryCopy}>
                  <h2>Program Özeti</h2>
                  <div className={styles.summaryList}>
                    {programSummary.map((item) => (
                      <div className={styles.summaryItem} key={item.label}>
                        <item.Icon size={19} strokeWidth={2} />
                        <div>
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={styles.summaryVisual} aria-hidden="true">
                  <Image
                    src="/images/brand/dna-logo-intelligence-symbol-transparent.png"
                    alt=""
                    width={585}
                    height={657}
                  />
                </div>
              </div>
            </section>

            <section className={styles.programOverview}>
              <div className={styles.overviewCopy}>
                <h2>Program Genel Bakış</h2>
                <p>
                  Bu program, öz-düzenlemeyi yalnızca davranışsal bir çıktı olarak değil; sinirsel, duyusal, duygusal ve
                  bilişsel sistemlerin dinamik etkileşimi olarak ele alır.
                </p>
                <p>
                  Terapistlere; değerlendirmeden müdahaleye uzanan klinik akışta güçlü bir çerçeve, ortak bir dil ve
                  uygulanabilir beceriler kazandırır.
                </p>
              </div>
              <div className={styles.overviewCards}>
                {overviewCards.map((card) => (
                  <article className={styles.overviewCard} key={card.title}>
                    <card.Icon size={22} strokeWidth={2} />
                    <h3>{card.title}</h3>
                    <p>{card.text}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.curriculumRoadmap} id="mufredat">
              <div className={styles.educationSectionTitle}>
                <h2>Müfredat Yol Haritası</h2>
                <p>9 modül ile öz-düzenleme anlayışınızı derinleştirin ve klinik uygulamanızı güçlendirin.</p>
              </div>
              <div className={styles.curriculumLine} aria-hidden="true">
                {curriculumModules.map((module, index) => (
                  <span key={module.title}>{String(index + 1).padStart(2, "0")}</span>
                ))}
              </div>
              <div className={styles.curriculumGrid}>
                {curriculumModules.map((module, index) => (
                  <article className={styles.curriculumCard} key={module.title}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <h3>{module.title}</h3>
                    <p>{module.text}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.teachingModel}>
              <div className={styles.teachingIntro}>
                <h2>Öğretim Modeli</h2>
                <p>Teori, değerlendirme ve müdahale öğrenme döngüsü ile kalıcı ve uygulanabilir bir öğrenim deneyimi.</p>
              </div>
              <div className={styles.hoursFormula} aria-label="20 saat teori artı 10 saat değerlendirme artı 10 saat müdahale eşittir 40 saat toplam eğitim">
                {teachingSegments.map((segment, index) => (
                  <Fragment key={segment.label}>
                    <article className={styles.hourBubble}>
                      <strong>{segment.hours}</strong>
                      <span>{segment.label}</span>
                      <p>{segment.text}</p>
                    </article>
                    {index < teachingSegments.length - 1 ? <b aria-hidden="true">+</b> : null}
                  </Fragment>
                ))}
                <b aria-hidden="true">=</b>
                <article className={`${styles.hourBubble} ${styles.totalHours}`}>
                  <strong>40</strong>
                  <span>Saat</span>
                  <p>Toplam Eğitim</p>
                </article>
              </div>
              <ul className={styles.teachingChecks}>
                {teachingChecks.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} strokeWidth={2.2} />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section className={styles.educationInfoGrid} aria-label="Program detayları">
              <article className={styles.educationInfoCard}>
                <h2>Kimler İçin?</h2>
                <ul>
                  {audienceList.map((item) => (
                    <li key={item}>
                      <Users size={17} strokeWidth={2} />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
              <article className={styles.educationInfoCard}>
                <h2>Katılımcılar Ne Kazanır?</h2>
                <ul>
                  {participantGains.map((item) => (
                    <li key={item}>
                      <CheckCircle2 size={17} strokeWidth={2.2} />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
              <article className={styles.educationInfoCard}>
                <h2>Programda Neler Var?</h2>
                <ul>
                  {programIncludes.map((item) => (
                    <li key={item}>
                      <ClipboardCheck size={17} strokeWidth={2} />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
              <article className={styles.educationInfoCard}>
                <h2>Pratik Bilgiler</h2>
                <div className={styles.practicalList}>
                  {practicalInfo.map((item) => (
                    <div className={styles.practicalItem} key={item.label}>
                      <item.Icon size={17} strokeWidth={2} />
                      <div>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          </>
        ) : isAssessmentPage ? (
          <>
            <section className={styles.assessmentHero}>
              <div className={styles.assessmentHeroCopy}>
                <div className={styles.eyebrow}>Çok Boyutlu Değerlendirme</div>
                <h1>
                  Regülasyon profilini çok boyutlu değerlendirme yapısı.
                </h1>
                <p>
                  DNA Intelligence, farklı regülasyon alanlarından gelen verileri tek bir klinik profil altında
                  düzenler, anlamlandırır ve bütüncül bir bakış sunar.
                </p>
              </div>

              <div className={styles.assessmentSignalVisual} aria-hidden="true">
                <span className={styles.signalLine} />
                <span className={styles.signalLine} />
                <span className={styles.signalLine} />
                <div className={styles.signalOrb}>
                  <Image
                    src="/images/brand/dna-logo-intelligence-symbol-transparent.png"
                    alt=""
                    width={585}
                    height={657}
                  />
                </div>
              </div>
            </section>

            <section className={styles.assessmentSystemFlow} id="degerlendirme-sureci">
              <div className={styles.assessmentSectionTitle}>
                <h2>Değerlendirme Sistemi Nasıl Çalışır?</h2>
                <p>Çok yönlü veriler, bütüncül bir klinik profile dönüşür.</p>
              </div>
              <div className={styles.connectedFlow} aria-label="Değerlendirme sistemi akışı">
                {assessmentFlowSteps.map((step, index) => (
                  <article className={`${styles.connectedNode} ${step.final ? styles.connectedNodeFinal : ""}`} key={step.title}>
                    <div>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <step.Icon size={26} strokeWidth={2} />
                    </div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.assessmentProfileSection}>
              <div className={styles.profileMockup} aria-label="Regülasyon profili örnek arayüz mockupı">
                <div className={styles.profileMockupHeader}>
                  <span>Regülasyon Profili</span>
                  <strong>Örnek UI mockup</strong>
                </div>
                <div className={styles.profileDashboard}>
                  <div className={styles.radarPanel} aria-hidden="true">
                    <div className={styles.radarChart}>
                      <span className={styles.radarLabel}>Fizyolojik Düzenleme</span>
                      <span className={styles.radarLabel}>Duyusal Regülasyon</span>
                      <span className={styles.radarLabel}>Duygusal Regülasyon</span>
                      <span className={styles.radarLabel}>Bilişsel Organizasyon</span>
                      <span className={styles.radarLabel}>Yürütücü İşlevler</span>
                      <span className={styles.radarLabel}>Sosyal Katılım</span>
                      <div className={styles.radarShape} />
                    </div>
                  </div>

                  <div className={styles.scorePanel}>
                    <h3>Alan Skorları</h3>
                    {assessmentScores.map((score) => (
                      <div className={styles.scoreRow} key={score.label}>
                        <div>
                          <span>{score.label}</span>
                          <strong>{score.score}</strong>
                        </div>
                        <div className={styles.scoreTrack}>
                          <span style={{ "--score": `${score.score}%` } as CSSProperties} />
                        </div>
                      </div>
                    ))}
                    <div className={styles.generalScore}>
                      <span>Genel Değerlendirme</span>
                      <strong>65</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.profileInsightRail}>
                {assessmentProfileNotes.map((note) => (
                  <article className={styles.profileInsight} key={note.title}>
                    <note.Icon size={27} strokeWidth={2} />
                    <div>
                      <h3>{note.title}</h3>
                      <p>{note.text}</p>
                    </div>
                  </article>
                ))}
                <div className={styles.assessmentLimitNote}>
                  <Target size={22} strokeWidth={2} />
                  <p>Sistem klinik yargının yerini almaz; terapistin uzmanlığını güçlendirir.</p>
                </div>
              </div>
            </section>
          </>
        ) : isTestsPage ? (
          <>
            <section className={styles.testToolsHero}>
              <div className={styles.testToolsHeroCopy}>
                <div className={styles.eyebrow}>Testler ve Ölçekler</div>
                <h1>
                  Klinik değerlendirmede kullandığımız <span>araçlar.</span>
                </h1>
                <p>
                  Regülasyonun çok boyutlu yapısını anlamak için seçkin, geçerli ve güvenilir ölçme araçları
                  kullanıyoruz.
                </p>
                <div className={styles.testToolsHighlights} aria-label="Klinik değerlendirme araçları vurguları">
                  {testToolHighlights.map((item) => (
                    <article key={item.title}>
                      <item.Icon size={21} strokeWidth={2.1} />
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.text}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className={styles.testToolsMockup} aria-label="Klinik form kartları ve değerlendirme araçları mockupı">
                <span className={styles.testToolsOrbit} />
                <span className={styles.testToolsOrbit} />
                <span className={styles.testToolsDot} />
                <span className={styles.testToolsDot} />
                <div className={styles.testToolsFloatingIcon}>
                  <BrainCircuit size={32} strokeWidth={2.1} />
                </div>
                <div className={styles.testToolsFloatingIcon}>
                  <HeartPulse size={32} strokeWidth={2.1} />
                </div>
                <div className={styles.testToolsFloatingIcon}>
                  <SlidersHorizontal size={32} strokeWidth={2.1} />
                </div>
                <div className={styles.testToolsFloatingIcon}>
                  <Smile size={32} strokeWidth={2.1} />
                </div>
                <article className={styles.testFormStack}>
                  <div className={styles.testFormCardBack} />
                  <div className={styles.testFormCardMiddle} />
                  <div className={styles.testFormCard}>
                    <div className={styles.testFormHeader}>
                      <ClipboardCheck size={24} strokeWidth={2} />
                      <span>Klinik değerlendirme formu</span>
                    </div>
                    <div className={styles.testFormRows}>
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className={styles.testFormMiniGrid}>
                      <span />
                      <span />
                    </div>
                    <div className={styles.testFormTrack}>
                      <i />
                    </div>
                  </div>
                </article>
              </div>
            </section>

            <section className={styles.testAreaSection}>
              <div className={styles.testSectionTitle}>
                <h2>Klinik değerlendirme alanları</h2>
              </div>
              <div className={styles.testAreaGrid}>
                {testAssessmentAreas.map((area) => (
                  <article className={styles.testAreaCard} key={area.title}>
                    <area.Icon size={34} strokeWidth={2.1} />
                    <h3>{area.title}</h3>
                    <p>{area.text}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.testProcessSection}>
              <div className={styles.testSectionTitle}>
                <h2>Değerlendirme süreci nasıl işler?</h2>
              </div>
              <div className={styles.testProcessLine} aria-label="Değerlendirme süreci akışı">
                {testProcessSteps.map((step, index) => (
                  <article className={styles.testProcessStep} key={step.title}>
                    <div>
                      <step.Icon size={28} strokeWidth={2.1} />
                    </div>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.testUpcomingSection}>
              <div className={styles.testSectionTitle}>
                <h2>Yakında kullanıma sunulacak araçlar</h2>
              </div>
              <div className={styles.testUpcomingGrid}>
                {upcomingTestTools.map((tool) => (
                  <article className={styles.testUpcomingCard} key={tool.title}>
                    <tool.Icon size={34} strokeWidth={2.1} />
                    <div>
                      <h3>{tool.title}</h3>
                      <p>{tool.text}</p>
                      <span>Yakında</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.testContactCta}>
              <div className={styles.testContactLead}>
                <Mail size={30} strokeWidth={2} />
                <h2>Sorularınız veya iş birliği talepleriniz için bizimle iletişime geçin.</h2>
              </div>
              <div className={styles.testContactCards}>
                <a href="mailto:self.metacognition.institute@gmail.com" className={styles.testContactCard}>
                  <Mail size={22} strokeWidth={2} />
                  <div>
                    <span>E-posta</span>
                    <strong>self.metacognition.institute@gmail.com</strong>
                  </div>
                  <ArrowRight size={18} />
                </a>
                <a href="tel:+905306766654" className={styles.testContactCard}>
                  <Phone size={22} strokeWidth={2} />
                  <div>
                    <span>Telefon</span>
                    <strong>+90 530 676 66 54</strong>
                  </div>
                  <ArrowRight size={18} />
                </a>
              </div>
            </section>
          </>
        ) : isInterventionPage ? (
          <>
            <section className={styles.interventionHero}>
              <div className={styles.interventionHeroCopy}>
                <div className={styles.eyebrow}>Müdahale Yaklaşımı</div>
                <h1>
                  Bilime dayalı. Kişiye özel. Regülasyonu hedefleyen <span>müdahale yaklaşımı.</span>
                </h1>
                <p>
                  Dynamic Neuro-Regulation Approach, fizyolojiden bilişsel organizasyona uzanan regülasyon sistemini
                  bütüncül olarak ele alır ve müdahale planını bu anlayış üzerine inşa eder.
                </p>
                <div className={styles.interventionHighlights} aria-label="Müdahale yaklaşımı özellikleri">
                  {interventionHighlights.map((item) => (
                    <article key={item.title}>
                      <item.Icon size={19} strokeWidth={2.2} />
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.text}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className={styles.regulationOrbit} aria-label="Regülasyon alanları klinik haritası">
                <div className={styles.regulationMapHeader}>
                  <span>Regülasyon Haritası</span>
                  <strong>6 alan birlikte okunur</strong>
                </div>
                <div className={styles.regulationMapBody}>
                  <div className={styles.regulationColumn}>
                    {regulationDomains.slice(0, 3).map((domain) => (
                      <article className={styles.regulationDomainCard} key={domain.title}>
                        <domain.Icon size={20} strokeWidth={2.2} />
                        <span>{domain.title}</span>
                      </article>
                    ))}
                  </div>
                  <div className={styles.regulationCoreCard}>
                    <BrainCircuit size={42} strokeWidth={2} />
                    <strong>Regülasyon Dengesi</strong>
                    <p>Güçlü alanlar, destek alanları ve müdahale öncelikleri aynı klinik çerçevede görülür.</p>
                  </div>
                  <div className={styles.regulationColumn}>
                    {regulationDomains.slice(3).map((domain) => (
                      <article className={styles.regulationDomainCard} key={domain.title}>
                        <domain.Icon size={20} strokeWidth={2.2} />
                        <span>{domain.title}</span>
                      </article>
                    ))}
                  </div>
                </div>
                <div className={styles.regulationMapFooter}>
                  <span>Değerlendirme</span>
                  <ArrowRight size={16} strokeWidth={2.4} />
                  <span>Öncelik</span>
                  <ArrowRight size={16} strokeWidth={2.4} />
                  <span>Müdahale Planı</span>
                </div>
              </div>
            </section>

            <section className={styles.vagalBrakeSection}>
              <div className={styles.vagalCopy}>
                <div className={styles.eyebrow}>Vagal Fren Kavramı</div>
                <h2>
                  Regülasyonun temelinde <span>vagal fren</span> mekanizması.
                </h2>
                <p>
                  Vagal fren, otonom sinir sisteminin dengeleyici gücüdür. Güçlü vagal fren; daha iyi stres toleransı,
                  dikkat, duygusal denge ve öğrenme kapasitesi ile ilişkilidir.
                </p>
                <ul>
                  {vagalBenefits.map((benefit) => (
                    <li key={benefit}>
                      <CheckCircle2 size={17} strokeWidth={2.2} />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>

              <div className={styles.vagalIllustration} aria-label="Vagal fren mekanizması şeması">
                <div className={styles.vagalPanelHeader}>
                  <span>Otonom Denge Şeması</span>
                  <strong>Stres yanıtı → toparlanma</strong>
                </div>
                <div className={styles.vagalBodyMap}>
                  <div className={styles.vagalNode}>
                    <BrainCircuit size={27} strokeWidth={2.1} />
                    <span>Beyin</span>
                  </div>
                  <div className={styles.vagalNerveLine}>
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className={styles.vagalBodyCard}>
                    <HeartPulse size={30} strokeWidth={2} />
                    <div>
                      <strong>Vagal fren</strong>
                      <p>Bedensel uyarılma, sakinleşme ve sosyal katılım arasında düzenleyici hat.</p>
                    </div>
                  </div>
                  <div className={styles.vagalMetricRow}>
                    <span>Sakinleşme</span>
                    <span>Dikkat</span>
                    <span>Katılım</span>
                  </div>
                </div>
              </div>

              <article className={styles.vagalOutcomeCard}>
                <h3>Vagal fren gücü arttıkça</h3>
                <ul>
                  {vagalOutcomeList.map((item) => (
                    <li key={item}>
                      <span />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            </section>

            <section className={styles.interventionProcessSection}>
              <div className={styles.interventionSectionTitle}>
                <h2>Müdahale Sürecimiz</h2>
              </div>
              <div className={styles.interventionProcessLine} aria-label="Müdahale süreci">
                {interventionProcess.map((step, index) => (
                  <article className={styles.interventionProcessStep} key={step.title}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <step.Icon size={26} strokeWidth={2.1} />
                    </div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.interventionPrinciples}>
              <div className={styles.interventionSectionTitle}>
                <h2>Yaklaşımımızın Temel İlkeleri</h2>
              </div>
              <div className={styles.principlesGrid}>
                {interventionPrinciples.map((principle) => (
                  <article className={styles.principleCard} key={principle.title}>
                    <principle.Icon size={28} strokeWidth={2.1} />
                    <h3>{principle.title}</h3>
                    <p>{principle.text}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.interventionInfoGrid}>
              <article className={styles.interventionListCard}>
                <h2>Kimler İçin?</h2>
                <ul>
                  {interventionAudience.map((item) => (
                    <li key={item}>
                      <Users size={17} strokeWidth={2} />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>

              <article className={styles.interventionListCard}>
                <h2>Ne Kazanırsınız?</h2>
                <ul>
                  {interventionGains.map((item) => (
                    <li key={item}>
                      <CheckCircle2 size={17} strokeWidth={2.2} />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>

              <div className={styles.interventionNetworkPanel} aria-label="Müdahale takibi mini paneli">
                <div className={styles.interventionMiniHeader}>
                  <span>Klinik Takip Paneli</span>
                  <strong>Plan veriye göre güncellenir</strong>
                </div>
                <div className={styles.interventionMiniRows}>
                  <article>
                    <ClipboardCheck size={20} strokeWidth={2.2} />
                    <div>
                      <strong>Değerlendirme verisi</strong>
                      <span>Ölçek, gözlem ve klinik notlar</span>
                    </div>
                  </article>
                  <article>
                    <Target size={20} strokeWidth={2.2} />
                    <div>
                      <strong>Müdahale hedefi</strong>
                      <span>Öncelikli regülasyon alanları</span>
                    </div>
                  </article>
                  <article>
                    <BarChart3 size={20} strokeWidth={2.2} />
                    <div>
                      <strong>İlerleme takibi</strong>
                      <span>Seanslar arası görünür değişim</span>
                    </div>
                  </article>
                </div>
                <div className={styles.interventionMiniChart}>
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
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

        {!isTestsPage ? (
          <section className={`${styles.callout} ${isAiReportPage ? styles.aiFinalCta : ""} ${isFutureModulesPage ? styles.labsFinalCta : ""}`}>
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

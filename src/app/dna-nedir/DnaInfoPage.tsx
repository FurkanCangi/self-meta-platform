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
    text: "Uyku, enerji ve toparlanma",
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
    title: "Yaklaşımı öğrenin",
    text: "Self-regülasyon alanlarını ve vaka değerlendirme yöntemini öğrenin.",
    Icon: GraduationCap,
  },
  {
    step: "02",
    title: "Bilgileri bir araya getirin",
    text: "Test sonuçlarını, anamnez bilgilerini ve gözlem notlarını aynı yerde toplayın.",
    Icon: ClipboardCheck,
  },
  {
    step: "03",
    title: "Sonuçları karşılaştırın",
    text: "Zorlanmaları ve güçlü yönleri ayrı ayrı görün.",
    Icon: BrainCircuit,
  },
  {
    step: "04",
    title: "Rapor taslağını inceleyin",
    text: "Sistem taslağı hazırlar; terapist inceler, düzenler ve son halini verir.",
    Icon: FileText,
  },
];

const conceptColumns = [
  {
    label: "Self-regülasyon eğitimi",
    title: "Dynamic Neuro-Regulation Approach",
    text: "Çocuğun davranışını self-regülasyon alanlarıyla birlikte değerlendirmeyi ve müdahale planı hazırlamayı öğretir.",
    points: ["Yaklaşımın temel kavramları", "Self-regülasyon alanları arasındaki ilişkiler", "Vaka değerlendirme ve müdahale planlama"],
  },
  {
    label: "Dijital çalışma platformu",
    title: "DNA Intelligence",
    text: "Eğitimde öğrenilen yaklaşımı değerlendirme, rapor hazırlama ve takip işlemlerinde kullanmayı kolaylaştırır. Tanı koymaz ve terapistin yerine karar vermez.",
    points: ["Değerlendirme bilgilerini bir araya getirir", "Zorlanmaları, güçlü yönleri ve eksik bilgileri gösterir", "Düzenlenebilir rapor taslağı hazırlar"],
  },
];

const educationBadges = ["40 saat", "9 modül", "Vaka örnekleri"];

const educationRoute = [
  {
    step: "01",
    title: "Çocuğun ihtiyaçlarını değerlendirin",
    text: "Uyku, enerji, duyusal yük ve duygusal tepkileri birlikte inceleyin.",
    Icon: HeartPulse,
  },
  {
    step: "02",
    title: "Değerlendirme bilgilerini bir araya getirin",
    text: "Test sonuçlarını, gözlem notlarını ve günlük yaşam bilgilerini birlikte inceleyin.",
    Icon: BrainCircuit,
  },
  {
    step: "03",
    title: "Uygulama planını hazırlayın",
    text: "Hedefi, uygulanacak yöntemi ve ilerlemeyi nasıl izleyeceğinizi açıkça belirleyin.",
    Icon: Target,
  },
];

const curriculumStages = [
  {
    number: "01",
    range: "Modül 01-03",
    title: "Davranışı etkileyen temel alanları değerlendirin",
    text: "Uyku, enerji, duyusal yük ve duygusal tepkileri birlikte değerlendirin.",
    modules: ["Fizyolojik düzenleme", "Duyusal işleme", "Duygusal regülasyon"],
    outcome: "Çocuğun en çok hangi alanda zorlandığını ve önce hangi ihtiyacın ele alınması gerektiğini belirleyin.",
    Icon: Activity,
  },
  {
    number: "02",
    range: "Modül 04-06",
    title: "Tüm değerlendirme bilgilerini birlikte inceleyin",
    text: "Dikkat, yürütücü işlev, anamnez ve gözlem bilgilerini birlikte değerlendirin.",
    modules: ["Bilişsel organizasyon", "Yürütücü işlevler", "Vaka değerlendirme"],
    outcome: "Öncelikli sorunları ve bu sonuca dayanak olan bilgileri belirleyin.",
    Icon: BrainCircuit,
  },
  {
    number: "03",
    range: "Modül 07-09",
    title: "Değerlendirme sonucuna göre uygulama planı hazırlayın",
    text: "Hedef seçimini, müdahale zamanlamasını ve seans içi kararları video vakalar üzerinden çalışın.",
    modules: ["Müdahale planlama", "Video vaka analizi", "Kararların gerekçesi"],
    outcome: "Ne yapacağınızı, neden bu yöntemi seçtiğinizi ve ne zaman uygulayacağınızı açıkça yazın.",
    Icon: Route,
  },
];

const teachingSegments = [
  { hours: "20", label: "Saat Teori", text: "Temel kavramlar ve yaklaşımın dayanakları" },
  { hours: "10", label: "Saat Değerlendirme", text: "Vaka örnekleri, ölçüm ve değerlendirme" },
  { hours: "10", label: "Saat Müdahale", text: "Uygulama örnekleri ve müdahale planlama" },
];

const teachingChecks = ["Vaka örnekleriyle öğrenme", "Uygulamalı örnekler", "Tartışma ve geri bildirim", "Değerlendirme pratiği"];

const audienceList = ["Ergoterapistler", "Çocuk gelişimi uzmanları", "Dil ve konuşma terapistleri", "Psikologlar ve psikolojik danışmanlar"];

const participantGains = [
  "Self-regülasyon alanlarını birlikte değerlendirme",
  "Vaka bilgilerini bir araya getirme",
  "Müdahale önceliğini belirleme",
  "Kararların gerekçesini açıklama",
  "Hedefe uygun müdahale planlama",
  "Değerlendirme sonuçlarını anlaşılır biçimde yazma",
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
    text: "Gelişim öyküsü ve günlük yaşam bilgileri",
    Icon: BookOpen,
  },
  {
    title: "Klinik gözlem",
    text: "Seans sırasında gözlenen performans ve davranışlar",
    Icon: Eye,
  },
  {
    title: "Alan ölçekleri",
    text: "Form yanıtları ve alan puanları",
    Icon: ClipboardCheck,
  },
  {
    title: "Terapist notu",
    text: "Terapistin değerlendirmesi ve ek notları",
    Icon: UserRound,
  },
];

const assessmentBadges = ["4 bilgi kaynağı", "6 self-regülasyon alanı", "Sonuçların kısa özeti"];

const assessmentStages = [
  {
    number: "01",
    label: "Bilgileri bir araya getirin",
    title: "Test, anamnez, gözlem ve terapist notlarını aynı yerde toplayın.",
    text: "Her bilgi kendi kaynağıyla birlikte saklanır.",
    items: ["Anamnez", "Klinik gözlem", "Alan ölçekleri", "Terapist notu"],
    outcome: "Hangi bilginin nereden geldiği kolayca görülür.",
    Icon: Layers3,
  },
  {
    number: "02",
    label: "Alanları karşılaştırın",
    title: "Altı self-regülasyon alanındaki sonuçları yan yana görün.",
    text: "Alanlar tek bir toplam puana indirgenmeden karşılaştırılır. Zorlanmalar, eşlik eden bulgular ve güçlü yönler ayrı ayrı gösterilir.",
    items: ["Fizyolojik", "Duyusal", "Duygusal", "Bilişsel", "Yürütücü", "Sosyal katılım"],
    outcome: "Zorlanmalar ve güçlü yönler birlikte değerlendirilir.",
    Icon: BrainCircuit,
  },
  {
    number: "03",
    label: "Değerlendirmeyi tamamlayın",
    title: "Sonuçların özetini inceleyin ve kendi değerlendirmenizi ekleyin.",
    text: "Sistem sonuçların ve eksik bilgilerin özetini hazırlar. Öncelik ve takip kararını terapist verir.",
    items: ["Sonuç özeti", "Dayanak bilgiler", "Eksik bilgiler", "Terapist notu"],
    outcome: "Özet, terapistin incelemesi ve düzenlemesiyle tamamlanır.",
    Icon: Target,
  },
];

const assessmentProfileNotes = [
  {
    title: "Bilgiler tek yerde",
    text: "Test, anamnez, gözlem ve terapist notları aynı dosyada tutulur.",
    Icon: ClipboardCheck,
  },
  {
    title: "Birlikte değerlendirme",
    text: "Puanlar anamnez bilgileri, gözlem notları ve terapistin yorumuyla birlikte değerlendirilir.",
    Icon: Users,
  },
  {
    title: "Son karar terapistte",
    text: "Sistem sonuçları ve eksik bilgileri gösterir; öncelik ve müdahale kararını terapist verir.",
    Icon: Target,
  },
];

const assessmentReadout = [
  { label: "Öncelikli zorlanma", value: "Yürütücü işlevler" },
  { label: "Eşlik eden alan", value: "Duyusal regülasyon" },
  { label: "Güçlü yön", value: "Fizyolojik düzenleme" },
  { label: "Eksik bilgi", value: "Biyolojik ölçüm bilgisi yok" },
];

const interventionHeroSignals = [
  { title: "6 değerlendirme alanı", text: "aynı ekranda", Icon: BrainCircuit },
  { title: "Kişiye özel hedef", text: "açık bir planda", Icon: Target },
  { title: "Değişimi izleyin", text: "belirli ölçütlerle", Icon: BarChart3 },
];

const interventionLayers = [
  {
    number: "01",
    label: "Çocuğun sakinleşmesini destekleyin",
    title: "Önce çocuğun sakinleşmesini ve etkinliğe hazır olmasını sağlayın.",
    text: "Uyarılma düzeyini, bedensel durumu ve duyusal yükü birlikte değerlendirin. Ortamı çocuğun sakinleşmesini ve etkileşime katılmasını kolaylaştıracak biçimde düzenleyin.",
    domains: ["Fizyolojik düzenleme", "Duyusal tolerans"],
    Icon: HeartPulse,
  },
  {
    number: "02",
    label: "Dikkati ve görev süresini artırın",
    title: "Duygusal yoğunluğu azaltın, dikkati sürdürmeyi kolaylaştırın.",
    text: "Çocuğun toparlanmasını, dikkatini ve göreve devam etmesini uygun desteklerle adım adım güçlendirin.",
    domains: ["Duygusal düzenleme", "Bilişsel organizasyon"],
    Icon: BrainCircuit,
  },
  {
    number: "03",
    label: "Becerileri günlük yaşamda kullanın",
    title: "Seans içinde öğrenilen becerilerin evde, okulda ve diğer ortamlarda kullanılmasını destekleyin.",
    text: "Planlama, esneklik ve sosyal katılım hedeflerini günlük yaşamda izleyin. Yöntemi çocuğun verdiği yanıta göre değiştirin.",
    domains: ["Yürütücü işlevler", "Sosyal katılım"],
    Icon: Users,
  },
];

const interventionJourney = [
  {
    number: "01",
    label: "Bilgileri değerlendirin",
    title: "Davranışın hangi durumlarda zorlaştığını belirleyin.",
    text: "Anamnez, gözlem ve alan puanlarını birlikte inceleyin. Zorlanmanın arttığı zamanları ve koşulları açıkça belirleyin.",
    outcome: "Öne çıkan zorlanmalar ve güçlü yönler",
    Icon: ClipboardCheck,
  },
  {
    number: "02",
    label: "Önceliği seçin",
    title: "Önce günlük yaşamı en çok etkileyen alanı ele alın.",
    text: "İlk hedefi, günlük yaşama etkisine ve değiştirilebilir olmasına göre seçin.",
    outcome: "Neden seçildiği belli ilk hedef",
    Icon: Target,
  },
  {
    number: "03",
    label: "Planı uygulayın",
    title: "Yöntemi çocuğun ihtiyacına, ortama ve hedefe göre seçin.",
    text: "Ortam, terapist desteği, görevin yapısı ve uygulama süresi birlikte planlanır.",
    outcome: "Hedef, strateji ve uygulama koşulları",
    Icon: Layers3,
  },
  {
    number: "04",
    label: "Yanıtı izleyin",
    title: "Değişimi belirli ölçütlerle izleyin ve planı gerektiğinde güncelleyin.",
    text: "Seanstaki yanıtı, becerinin günlük yaşamda kullanılıp kullanılmadığını ve gereken yardım düzeyini izleyin. İlerleme yoksa planı değiştirin.",
    outcome: "Gözlenebilir ilerleme ve güncellenen plan",
    Icon: BarChart3,
  },
];

const interventionCaseRows = [
  { label: "Gözlenen durum", value: "Etkinlik değişimlerinde sakin kalmakta zorlanma", Icon: Eye },
  { label: "İlk hedef", value: "Sakinleşmeyi ve yeni etkinliğe geçmeyi kolaylaştırmak", Icon: Target },
  { label: "Uygulama planı", value: "Etkinlik öncesi hazırlık, çevre düzenlemesi ve uygun tempo", Icon: Layers3 },
  { label: "Takip göstergesi", value: "Yeni etkinliğe geçiş süresi ve gereken yardım", Icon: BarChart3 },
];

const interventionReviewTriggers = [
  "Hedeflenen yanıt birkaç uygulamada görünmüyorsa",
  "Yeni bir zorlanma ortaya çıkıyorsa",
  "Kazanım farklı ortam ve kişilere taşınmıyorsa",
];

const interventionValuePoints = [
  { title: "Öncelikli hedef", text: "Önce ele alınacak hedefi nedenleriyle birlikte belirleyin.", Icon: Target },
  { title: "Uygun yöntem", text: "Seçtiğiniz yöntemin hedefle uyumlu olmasına dikkat edin.", Icon: Route },
  { title: "Somut takip", text: "Değişimi önceden belirlediğiniz ölçütlerle izleyin.", Icon: BarChart3 },
];

const aiReportSignals = [
  { title: "Tüm bilgiler tek yerde", text: "Anamnez, test sonuçları ve gözlem notları", Icon: Layers3 },
  { title: "Sonuçların kısa özeti", text: "Zorlanmalar, güçlü yönler ve eksik bilgiler", Icon: Sparkles },
  { title: "Terapist tarafından düzenlenir", text: "Taslak incelenir ve son hali verilir", Icon: ShieldCheck },
];

const aiReportSources = [
  { title: "Anamnez", Icon: BookOpen },
  { title: "Ölçüm sonuçları", Icon: ClipboardCheck },
  { title: "Gözlem verisi", Icon: Eye },
  { title: "Terapist notları", Icon: PenLine },
];

const aiReportSections = [
  { title: "Değerlendirme özeti", Icon: FileText },
  { title: "Öncelikli zorlanma", Icon: Target },
  { title: "Güçlü yön", Icon: ListChecks },
  { title: "Eksik bilgiler", Icon: BarChart3 },
];

const aiCapabilities = [
  {
    step: "01",
    eyebrow: "Bilgileri toplar",
    title: "Anamnez, test sonuçları, gözlem ve terapist notlarını bir araya getirir.",
    text: "Her bilgi kendi kaynağıyla birlikte aynı danışan dosyasında gösterilir.",
    outcome: "Tüm değerlendirme bilgileri tek yerde",
    Icon: Layers3,
  },
  {
    step: "02",
    eyebrow: "Sonuçları özetler",
    title: "Zorlanmaları, güçlü yönleri ve eksik bilgileri kısa bir özette gösterir.",
    text: "Sistem yalnızca kayıtlı kuralları kullanır; neden veya tedavi hakkında kendi başına karar vermez.",
    outcome: "Kısa ve anlaşılır sonuç özeti",
    Icon: BrainCircuit,
  },
  {
    step: "03",
    eyebrow: "Taslak hazırlar",
    title: "Terapistin düzenleyebileceği bir rapor taslağı hazırlar.",
    text: "Değerlendirme özeti, dayanak bilgiler, güçlü yönler ve eksik bilgiler aynı taslakta yer alır.",
    outcome: "Terapistin inceleyebileceği rapor taslağı",
    Icon: FileCheck2,
  },
];

const aiReportJourney = [
  {
    title: "Değerlendirme bilgilerini girin",
    text: "Danışanın anamnez bilgilerini, test sonuçlarını ve gözlem notlarını tamamlayın.",
    Icon: Database,
  },
  {
    title: "Sonuç özetini oluşturun",
    text: "Sistem kayıtlı kurallara göre sonuçları karşılaştırır ve eksik bilgileri gösterir.",
    Icon: Sparkles,
  },
  {
    title: "Taslağı inceleyin",
    text: "Cümleleri ve sonuçları danışanın durumuna göre kontrol edin; gerekli düzeltmeleri yapın.",
    Icon: UserRound,
  },
  {
    title: "Raporu tamamlayın",
    text: "Son düzenlemeyi yapın, raporu onaylayın ve danışan dosyasına kaydedin.",
    Icon: FileCheck2,
  },
];

const aiValuePoints = [
  { title: "Raporu daha kısa sürede hazırlayın", text: "Aynı bilgileri tekrar yazmak zorunda kalmayın.", Icon: TimerReset },
  { title: "Raporu açık ve düzenli hazırlayın", text: "Test sonuçlarını, gözlem notlarını ve değerlendirmeyi aynı raporda birleştirin.", Icon: BrainCircuit },
  { title: "Son karar sizde", text: "Taslağı inceleyin, düzenleyin ve yalnızca siz onaylayın.", Icon: ShieldCheck },
];

const labModules = [
  {
    step: "01",
    title: "Video Gözlem",
    status: "Öncelikli geliştirme",
    text: "Seans sırasında görülen davranışları ve katılımdaki değişiklikleri kaydetmeyi kolaylaştırır.",
    contribution: "Önemli anların daha sonra karşılaştırılmasını kolaylaştırır.",
    Icon: Eye,
  },
  {
    step: "02",
    title: "Video ve Görüntü İnceleme",
    status: "Geliştirme çalışması",
    text: "Postür, hareket ve motor tepkilerle ilgili görüntüleri karşılaştırmayı kolaylaştıracak bir özellik geliştiriyoruz.",
    contribution: "Önemli değişikliklerin fark edilmesini ve kaydedilmesini kolaylaştırmayı amaçlar.",
    Icon: Target,
  },
  {
    step: "03",
    title: "Gelişim Takibi",
    status: "Akış tasarımı",
    text: "Değerlendirme sonuçlarını, raporları ve gözlem notlarını tarih sırasıyla gösterir.",
    contribution: "Danışandaki değişimin zaman içinde görülmesini kolaylaştırır.",
    Icon: Route,
  },
];

const labsIntegrationSteps = [
  {
    title: "Gözlem notlarını toplayın",
    text: "Seans sırasında görülen önemli anları kaydedin.",
    Icon: Eye,
  },
  {
    title: "Bilgileri düzenleyin",
    text: "Notları aynı başlıklar altında toplayın.",
    Icon: Layers3,
  },
  {
    title: "Değişimi karşılaştırın",
    text: "Farklı değerlendirme ve seansları tarih sırasıyla karşılaştırın.",
    Icon: BarChart3,
  },
  {
    title: "Değerlendirmeye ekleyin",
    text: "Kayıtları değerlendirme, rapor ve takip sırasında kullanın.",
    Icon: FileText,
  },
];

const labsPrinciples = [
  {
    title: "Terapistin kararına yardımcı olur",
    text: "Yeni özellikler terapistin yerine karar vermez; gözlem ve takip işlemlerini kolaylaştırır.",
    Icon: UserRound,
  },
  {
    title: "Adım adım geliştirilir",
    text: "Her özellik gerçek kullanım örnekleriyle denendikten sonra sisteme eklenir.",
    Icon: Route,
  },
  {
    title: "Tüm kayıtlar aynı yerde",
    text: "Yeni kayıtları değerlendirme, takip ve rapor sayfalarında görebilirsiniz.",
    Icon: Layers3,
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
    ? "Değerlendirme ve müdahale planlamayı birlikte öğrenin."
    : isAssessmentPage
      ? "Değerlendirme ve rapor hazırlama sürecini birlikte planlayalım."
    : isInterventionPage
      ? "Hedefi, uygulanacak yöntemi ve ilerlemeyi nasıl izleyeceğinizi açıkça belirleyin."
    : isAiReportPage
      ? "Rapor hazırlama sürecini birlikte planlayalım."
    : isFutureModulesPage
      ? "Yeni özellikleri ihtiyaçlarınıza göre birlikte geliştirelim."
    : "İhtiyacınıza uygun kullanımı birlikte planlayalım.";
  const calloutText = isEducationPage
    ? "Self-regülasyon alanlarını birlikte değerlendirmeyi, müdahale hedefi belirlemeyi ve ilerlemeyi takip etmeyi öğrenin."
    : isAssessmentPage
      ? "Test, anamnez, gözlem ve terapist notlarını nasıl bir araya getireceğinizi birlikte planlayabiliriz."
    : isInterventionPage
      ? "Değerlendirme sonucuna göre hedefinizi, uygulayacağınız yöntemi ve takip ölçütlerini birlikte belirleyelim."
    : isAiReportPage
      ? "Değerlendirme bilgilerini bir araya getiren ve terapistin düzenleyebileceği bir rapor taslağı hazırlayan sistemi inceleyin."
    : isFutureModulesPage
      ? "Üzerinde çalıştığımız özellikleri inceleyin; pilot çalışmalar ve erken kullanım hakkında bilgi alın."
    : "Eğitim, değerlendirme ve rapor hazırlama seçeneklerini birlikte değerlendirebiliriz.";
  const primaryActionLabel = isEducationPage
    ? "Programa Başvur"
    : isAssessmentPage
      ? "İletişime Geç"
    : isInterventionPage
      ? "İletişime Geç"
    : isAiReportPage
      ? "İletişime Geç"
    : isFutureModulesPage
      ? "DNA Labs Hakkında Bilgi Al"
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
      ? "Sistemi İncele"
    : isFutureModulesPage
      ? "Modül Akışını İncele"
      : "Çözümleri İncele";
  const secondaryActionHref = isEducationPage
    ? "/iletisim"
    : isInterventionPage
      ? "/dna-nedir/egitim-programi"
    : isAiReportPage
      ? "/cozumler"
    : isFutureModulesPage
      ? "#labs-integration"
    : "/cozumler";

  return (
    <div className={`${styles.page} ${isApproachPage ? styles.signalPage : ""}`}>
      <LandingHeader compact={isApproachPage} />
      <main className={styles.main}>
        {isApproachPage ? (
          <>
            <section className={styles.signalHero}>
              <div className={styles.signalHeroCopy}>
                <span className={styles.signalEyebrow}>Değerlendirme ve rapor hazırlama platformu</span>
                <h1>DNA Intelligence</h1>
                <h2>
                  Bilgileri bir araya getirin.
                  <br />
                  Sonuçları değerlendirin.
                  <br />
                  Raporunuzu hazırlayın.
                </h2>
                <p>
                  Dynamic Neuro-Regulation Approach değerlendirme ve müdahale planlamayı öğretir. DNA Intelligence
                  test sonuçlarını, anamnez bilgilerini ve gözlem notlarını bir araya getirir; terapistin
                  düzenleyebileceği bir rapor taslağı hazırlar.
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
                  <span>Örnek öncelikli alan</span>
                  <strong>Uyku, enerji ve toparlanma</strong>
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

            <section className={styles.clinicalPathway} id="klinik-akis" aria-label="Eğitim ve raporlama akışı">
              <div className={styles.clinicalPathwayHeader}>
                <div>
                  <span>Nasıl çalışır?</span>
                  <h2>Eğitimden rapora kadar dört adım.</h2>
                </div>
                <p>Yaklaşımı öğrenin, bilgileri toplayın, sonuçları karşılaştırın ve rapor taslağını inceleyin.</p>
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

            <section className={styles.modelBridgeSection} id="model-ayrimi" aria-label="Eğitim modeli ve dijital platform ayrımı">
              <div className={styles.modelBridgeHeader}>
                <span>Eğitim ve platform</span>
                <h2>Eğitimde yöntemi öğrenir, platformda uygularsınız.</h2>
                <p>Eğitimde öğrendiğiniz yöntemi değerlendirme ve rapor hazırlarken aynı sırayla kullanırsınız.</p>
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
                        <span>Eğitimden</span>
                        <ArrowRight size={26} strokeWidth={1.7} />
                        <strong>uygulamaya</strong>
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
                    <small>Rapor taslağı</small>
                    <strong>Değerlendirme bilgilerini bir araya getiren ve terapistin düzenleyebileceği rapor taslağı.</strong>
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
                  Self-regülasyonu değerlendirin. Vaka bilgilerini bir araya getirin. <span>Müdahaleyi planlayın.</span>
                </h2>
                <p>
                  40 saatlik programda self-regülasyonun temellerini, vaka değerlendirmeyi ve müdahale planlamayı
                  adım adım öğrenirsiniz.
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
                    <strong>Temel bilgiden müdahale planına</strong>
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
                <h2>Dokuz modül.<br />Üç aşamalı öğrenme programı.</h2>
                <p>
                  Her bölümde öğrendiklerinizi sonraki bölümde kullanır, program boyunca adım adım ilerlersiniz.
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
                        <span><strong>Bu bölümün sonunda:</strong> {stage.outcome}</span>
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
                  <h2>40 saatlik eğitim, birbirini tamamlayan öğrenme adımlarıyla ilerler.</h2>
                </div>
                <p>Bilgiyi öğrenin, örnek vakalarda kullanın ve müdahale planı hazırlayın.</p>
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
                <h2>Self-regülasyon alanlarını değerlendirmeyi ve müdahale planı hazırlamayı öğrenmek isteyen profesyoneller için.</h2>
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
                  Bilgileri toplayın. Sonuçları karşılaştırın. <span>Değerlendirmenizi tamamlayın.</span>
                </h2>
                <p>
                  Anamnez bilgilerini, test sonuçlarını, gözlem ve terapist notlarını aynı yerde toplayın. Sistem
                  sonuçları altı self-regülasyon alanında karşılaştırır ve düzenlenebilir bir rapor taslağı hazırlar.
                  Son değerlendirmeyi terapist yapar.
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

              <div className={styles.evaluationMap} aria-label="Değerlendirme bilgilerinin düzenli bir özete dönüşmesi">
                <div className={styles.evaluationMapHeader}>
                  <div>
                    <span>Değerlendirme haritası</span>
                    <strong>Farklı kaynaklardaki bilgileri tek ekranda görün</strong>
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
                      <span>Değerlendirme özeti</span>
                      <strong>Öncelikli zorlanmaları, güçlü yönleri ve eksik bilgileri gösterir</strong>
                    </div>
                  </div>
                  <ul>
                    <li>Öncelikli zorlanma</li>
                    <li>Eşlik eden bulgular</li>
                    <li>Güçlü yön</li>
                  </ul>
                </div>
                <div className={styles.evaluationMapMetrics} aria-label="Değerlendirme sistemi kısa bilgileri">
                  <div><strong>4</strong><span>veri kaynağı</span></div>
                  <div><strong>6</strong><span>regülasyon alanı</span></div>
                  <div><strong>1</strong><span>değerlendirme özeti</span></div>
                </div>
              </div>
            </section>

            <section className={styles.evaluationJourney} id="degerlendirme-akisi">
              <div className={styles.evaluationJourneyIntro}>
                <span>Değerlendirme akışı</span>
                <h2>Bilgiler üç adımda incelemeye hazır hale gelir.</h2>
                <p>
                  Sistem puanları ve bilgi kaynaklarını düzenler. Önceliği ve sonraki adımı terapist belirler.
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
                        <span><strong>Bu adımın sonucu:</strong> {stage.outcome}</span>
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
                  <h2>Alanları tek tek karşılaştırın, güçlü yönleri ve zorlanmaları birlikte görün.</h2>
                </div>
                <p>Öncelikli zorlanma, eşlik eden güçlükler ve güçlü yönler ayrı başlıklarda gösterilir.</p>
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
                    <span>Sonuç özeti</span>
                    <strong>Örnek rapor özeti</strong>
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
                      <strong>Son kararı terapist verir.</strong>
                      <p>Sistem bilgileri düzenler ve hangi sonucun hangi kaynağa dayandığını gösterir.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className={styles.evaluationPrinciples} aria-label="Değerlendirme sisteminin üç ilkesi">
              <div className={styles.evaluationPrinciplesHeader}>
                <span>Değerlendirme ilkeleri</span>
                <h2>Puanları anamnez ve gözlem bilgileriyle birlikte değerlendirin.</h2>
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
                  Önceliği belirleyin. Müdahaleyi planlayın. <span>Sonucu takip edin.</span>
                </h1>
                <p>
                  Dynamic Neuro-Regulation Approach, davranışın öncesinde ve sırasında görülen düzenleme ihtiyaçlarını
                  değerlendirmeyi öğretir. Değerlendirme sonuçlarını hedeflere, uygulanacak yöntemlere ve takip
                  ölçütlerine bağlar.
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
                    <span>Müdahale planı</span>
                    <strong>Gözlemden takip ölçütüne</strong>
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
                    <span>Gözlenen durum</span>
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
                    <strong>Etkinlik öncesi hazırlık ve geçiş desteği</strong>
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
                  <span>Amaç yalnızca davranışı azaltmak değil; çocuğun sakinleşmesini, etkinliğe katılmasını ve günlük yaşamda daha bağımsız olmasını desteklemektir.</span>
                </div>
              </div>
            </section>

            <section className={styles.interventionLayerSection} aria-labelledby="mudahale-mantigi-baslik">
              <div className={styles.interventionLayerHeader}>
                <span>Planlama sırası</span>
                <h2 id="mudahale-mantigi-baslik">Önce çocuğun hangi koşullarda zorlandığını belirleyin.</h2>
                <p>Uyku, enerji, duyusal yük, duygusal tepkiler, dikkat ve sosyal katılımı birlikte inceleyin. Hedefleri günlük yaşamı en çok etkileyen soruna göre sıralayın.</p>
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
                <h2>Değerlendirme sonuçlarından dört adımda müdahale planı hazırlayın.</h2>
                <p>
                  Önce durumu tanımlayın, sonra hedefi, yöntemi ve nasıl takip edeceğinizi belirleyin.
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
                        <span><strong>Bu adımın sonucu:</strong> {step.outcome}</span>
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
                  <h2>Müdahale planını çocuğun verdiği yanıta göre düzenli olarak gözden geçirin.</h2>
                </div>
                <p>Başlangıç durumu, hedef, uygulama ve takip ölçütleri aynı yerde gösterilir.</p>
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
                    <p><strong>Son kararı terapist verir.</strong> Sistem hedefleri, uygulamaları ve takip sonuçlarını düzenli kaydetmenizi sağlar.</p>
                  </div>
                </aside>
              </div>
            </section>

            <section className={styles.interventionValueSection} aria-label="Müdahale yaklaşımının klinik katkıları">
              <div>
                <span>Planlama</span>
                <h2>Hedefi, uygulanacak yöntemi ve takip ölçütünü aynı planda gösterin.</h2>
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
            <section className={styles.aiModernHero}>
              <div className={styles.aiModernHeroCopy}>
                <div className={styles.eyebrow}>Deterministik ve Açıklanabilir Raporlama</div>
                <h1>Değerlendirme bilgilerini bir araya getirin. <span>Rapor taslağını inceleyin.</span></h1>
                <p>
                  DNA Intelligence; anamnez bilgilerini, test sonuçlarını, gözlem ve terapist notlarını aynı yerde toplar.
                  Sonuçları sistemdeki değerlendirme kurallarına göre özetler ve düzenlenebilir bir rapor taslağı hazırlar.
                </p>
                <div className={styles.aiModernActions}>
                  <Link className={styles.primary} href="#ai-rapor-akisi">
                    Nasıl çalışır <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
                  </Link>
                  <Link className={styles.secondary} href="/iletisim">Bilgi Al</Link>
                </div>
                <div className={styles.aiModernSignals} aria-label="Rapor taslağının özellikleri">
                  {aiReportSignals.map((item) => (
                    <article key={item.title}>
                      <item.Icon size={19} strokeWidth={2} aria-hidden="true" />
                      <div><strong>{item.title}</strong><span>{item.text}</span></div>
                    </article>
                  ))}
                </div>
              </div>

              <aside className={styles.aiClinicalWorkspace} aria-label="Rapor taslağı örneği">
                <header>
                  <div>
                    <Image
                      src="/images/brand/dna-logo-intelligence-symbol-transparent.png"
                      alt=""
                      width={585}
                      height={657}
                      aria-hidden="true"
                    />
                    <div><span>DNA Intelligence</span><strong>Rapor hazırlama alanı</strong></div>
                  </div>
                  <span>Kurallar hazır</span>
                </header>
                <div className={styles.aiWorkspaceSources}>
                  <span>Değerlendirme bilgileri</span>
                  <div>
                    {aiReportSources.map((item) => (
                      <div key={item.title}><item.Icon size={16} strokeWidth={2} aria-hidden="true" />{item.title}</div>
                    ))}
                  </div>
                </div>
                <div className={styles.aiWorkspaceCore}>
                  <span><Sparkles size={17} strokeWidth={2} aria-hidden="true" /> Sonuçların kısa özeti</span>
                  <h2>Bilgileri bir araya getirir, sonuçları karşılaştırır ve rapor taslağı hazırlar.</h2>
                  <div><span>Güçlü yön</span><span>Öncelikli zorlanma</span><span>Eksik bilgiler</span></div>
                </div>
                <div className={styles.aiWorkspaceOutput}>
                  <div><span>Rapor taslağı</span><strong>Terapistin incelemesine hazır</strong></div>
                  <ul>
                    {aiReportSections.map((item) => (
                      <li key={item.title}><item.Icon size={16} strokeWidth={2} aria-hidden="true" />{item.title}</li>
                    ))}
                  </ul>
                </div>
                <footer>
                  <ShieldCheck size={18} strokeWidth={2} aria-hidden="true" />
                  <span>Raporun son hali terapistin incelemesi ve onayıyla tamamlanır.</span>
                </footer>
              </aside>
            </section>

            <section className={styles.aiCapabilitySection} aria-labelledby="ai-yetenekler-baslik">
              <div className={styles.aiCapabilityIntro}>
                <span>Deterministik motor ne yapar?</span>
                <h2 id="ai-yetenekler-baslik">Bilgileri birleştirir, sonuçları özetler ve taslak hazırlar.</h2>
                <p>
                  Sistem yalnızca kayıtlı kuralları kullanır ve eksik bilgileri gösterir. Klinik önceliği terapist belirler;
                  sistem tarafından hedef veya takip kararı üretilmez.
                </p>
              </div>
              <div className={styles.aiCapabilityList}>
                {aiCapabilities.map((item) => (
                  <article key={item.step}>
                    <span>{item.step}</span>
                    <item.Icon size={22} strokeWidth={1.9} aria-hidden="true" />
                    <div>
                      <small>{item.eyebrow}</small>
                      <h3>{item.title}</h3>
                      <p>{item.text}</p>
                      <strong><CheckCircle2 size={16} strokeWidth={2} aria-hidden="true" />{item.outcome}</strong>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.aiReportPreviewSection} aria-labelledby="ai-rapor-onizleme-baslik">
              <header>
                <div><span>Rapor taslağı</span><h2 id="ai-rapor-onizleme-baslik">Değerlendirme bilgilerini kısa ve anlaşılır bir raporda birleştirin.</h2></div>
                <strong><Sparkles size={16} strokeWidth={2} aria-hidden="true" /> Değerlendirme kurallarına göre hazırlandı</strong>
              </header>
              <div className={styles.aiReportPreviewBody}>
                <aside aria-label="Rapor bölümleri">
                  {aiReportSections.map((item, index) => (
                    <div className={index === 0 ? styles.aiReportPreviewActive : ""} key={item.title}>
                      <item.Icon size={17} strokeWidth={2} aria-hidden="true" />{item.title}
                    </div>
                  ))}
                </aside>
                <div className={styles.aiReportPreviewContent}>
                  <div><span>Değerlendirme özeti</span><strong>Terapistin incelemesi bekleniyor</strong></div>
                  <p>
                    Sonuçlar, duyusal uyaranlar ve planlama gerektiren görevler arttığında çocuğun görevi sürdürmekte
                    zorlandığını gösteriyor. Önceden açıklanan ve adımları belli görevlerde katılım artıyor.
                  </p>
                  <div className={styles.aiReportPreviewFindings}>
                    <article><span>Öncelikli zorlanma</span><strong>Duyusal yük arttığında görevi sürdürme</strong></article>
                    <article><span>Güçlü yön</span><strong>Adımları belli görevlerde katılım</strong></article>
                    <article><span>Eksik bilgi</span><strong>Biyolojik ölçüm yapılmadı</strong></article>
                  </div>
                </div>
              </div>
              <footer><ShieldCheck size={18} strokeWidth={2} aria-hidden="true" />Rapor taslağı düzenlenebilir; son hali yalnızca terapistin inceleme ve onayıyla tamamlanır.</footer>
            </section>

            <section className={styles.aiJourneySection} id="ai-rapor-akisi">
              <div className={styles.aiJourneyIntro}>
                <span>Rapor hazırlama</span>
                <h2>Değerlendirme bilgilerinden dört adımda rapor hazırlayın.</h2>
                <p>Her adımı inceleyebilir ve düzenleyebilirsiniz.</p>
              </div>
              <div className={styles.aiJourneyList}>
                {aiReportJourney.map((item, index) => (
                  <article key={item.title}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <item.Icon size={21} strokeWidth={1.9} aria-hidden="true" />
                    <div><h3>{item.title}</h3><p>{item.text}</p></div>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.aiValueSection} aria-label="Rapor taslağının yararları">
              <div><span>Rapor hazırlama</span><h2>Rapor hazırlarken zaman kazanın, bilgileri açık ve düzenli biçimde yazın.</h2></div>
              <div className={styles.aiValueList}>
                {aiValuePoints.map((item, index) => (
                  <article key={item.title}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <item.Icon size={20} strokeWidth={1.9} aria-hidden="true" />
                    <div><h3>{item.title}</h3><p>{item.text}</p></div>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : isFutureModulesPage ? (
          <>
            <section className={styles.labsModernHero}>
              <div className={styles.labsModernHeroCopy}>
                <div className={styles.eyebrow}>DNA Labs</div>
                <h1>Gözlem ve takip işlemlerini kolaylaştıracak <span>yeni özellikler.</span></h1>
                <p>
                  DNA Labs altında video gözlem, görüntü inceleme ve gelişim takibi için yeni özellikler geliştiriyoruz.
                  Bu özellikler henüz kullanımda değildir.
                </p>
                <div className={styles.labsModernActions}>
                  <Link className={styles.primary} href="#labs-modules">
                    Modülleri incele <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
                  </Link>
                  <Link className={styles.secondary} href="/iletisim">Bilgi al</Link>
                </div>
                <div className={styles.labsModernSignals} aria-label="DNA Labs yol haritası özeti">
                  <div><strong>3</strong><span>yeni özellik</span></div>
                  <div><strong>1</strong><span>ortak danışan dosyası</span></div>
                  <div><ShieldCheck size={19} strokeWidth={2} aria-hidden="true" /><span>terapist onaylı</span></div>
                </div>
              </div>

              <aside className={styles.labsRoadmapPanel} aria-label="DNA Labs klinik teknoloji yol haritası">
                <header>
                  <div>
                    <Image
                      src="/images/brand/dna-logo-intelligence-symbol-transparent.png"
                      alt=""
                      width={585}
                      height={657}
                      aria-hidden="true"
                    />
                    <div>
                      <span>DNA Labs</span>
                      <strong>Yeni özellikler</strong>
                    </div>
                  </div>
                  <span>Üzerinde çalışılıyor</span>
                </header>
                <div className={styles.labsRoadmapList}>
                  {labModules.map((module) => (
                    <article key={module.step}>
                      <span>{module.step}</span>
                      <module.Icon size={22} strokeWidth={1.9} aria-hidden="true" />
                      <div><strong>{module.title}</strong><small>{module.status}</small></div>
                    </article>
                  ))}
                </div>
                <footer>
                  <ShieldCheck size={18} strokeWidth={2} aria-hidden="true" />
                  <span>Yeni özellikler aynı danışan dosyasında birlikte çalışacak.</span>
                </footer>
              </aside>
            </section>

            <section className={styles.labsModulesSection} id="labs-modules" aria-labelledby="labs-modules-title">
              <div className={styles.labsModulesIntro}>
                <span>Üzerinde çalıştığımız üç özellik</span>
                <h2 id="labs-modules-title">Gözlemi kaydetmeyi ve değişimi izlemeyi kolaylaştırmayı amaçlıyoruz.</h2>
                <p>Yeni özellikler gözlem notlarını, görüntüleri ve takip sonuçlarını aynı danışan dosyasında toplayacak.</p>
              </div>
              <div className={styles.labsModulesList}>
                {labModules.map((module) => (
                  <article key={module.step}>
                    <span>{module.step}</span>
                    <module.Icon size={23} strokeWidth={1.9} aria-hidden="true" />
                    <div>
                      <header><h3>{module.title}</h3><small>{module.status}</small></header>
                      <p>{module.text}</p>
                      <strong><CheckCircle2 size={16} strokeWidth={2} aria-hidden="true" />{module.contribution}</strong>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.labsIntegrationSection} id="labs-integration" aria-labelledby="labs-integration-title">
              <header className={styles.labsIntegrationHeader}>
                <div><span>Nasıl kullanılacak?</span><h2 id="labs-integration-title">Yeni özellikler aynı danışan dosyasına bağlanacak.</h2></div>
                <p>Gözlem, görüntü ve takip bilgileri ayrı yerlerde kalmayacak; değerlendirme ve raporda birlikte kullanılacak.</p>
              </header>
              <div className={styles.labsIntegrationFlow}>
                {labsIntegrationSteps.map((step, index) => (
                  <article key={step.title}>
                    <div><span>{String(index + 1).padStart(2, "0")}</span><step.Icon size={22} strokeWidth={1.9} aria-hidden="true" /></div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.labsPrinciplesSection} aria-labelledby="labs-principles-title">
              <div className={styles.labsPrinciplesIntro}>
                <span>Temel kurallar</span>
                <h2 id="labs-principles-title">Yeni özellikler terapistin mevcut çalışma düzenini bozmayacak.</h2>
              </div>
              <div className={styles.labsPrinciplesList}>
                {labsPrinciples.map((item, index) => (
                  <article key={item.title}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <item.Icon size={21} strokeWidth={1.9} aria-hidden="true" />
                    <div><h3>{item.title}</h3><p>{item.text}</p></div>
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
                <h3>Bu sayfa nerede kullanılır?</h3>
                <p>
                  Eğitim size değerlendirme yöntemini öğretir. DNA Intelligence ise topladığınız bilgileri düzenler
                  ve inceleyebileceğiniz bir rapor taslağı hazırlar.
                </p>
              </article>

              <article className={styles.wideCard} style={{ "--accent": "#2563EB" } as CSSProperties}>
                <div className={styles.icon}>
                  <CheckCircle2 size={30} strokeWidth={2} />
                </div>
                <h3>Son karar terapistindir</h3>
                <p>
                  Sistem terapistin yerine karar vermez. Bilgileri düzenler, sonuçları gösterir ve rapor hazırlamayı
                  kolaylaştırır.
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
          <section className={`${styles.callout} ${isApproachPage ? styles.signalCallout : ""} ${isAiReportPage ? styles.aiModernFinalCta : ""} ${isFutureModulesPage ? styles.labsModernFinalCta : ""}`}>
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

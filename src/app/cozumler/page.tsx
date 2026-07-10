import type { ComponentType, CSSProperties } from "react";
import Image from "next/image";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Cloud,
  FileText,
  GraduationCap,
  LineChart,
  LockKeyhole,
  ShieldCheck,
  Target,
  TimerReset,
  TrendingUp,
  UserRound,
} from "lucide-react";
import FooterContact from "../components/FooterContact";
import LandingHeader from "../components/LandingHeader";
import styles from "./page.module.css";

type IconComponent = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

type PlatformCard = {
  badge: string;
  title: string;
  description: string;
  bullets: string[];
  cta: string;
  href: string;
  icon: IconComponent;
  accent: string;
  visual: "certificate" | "report";
};

const platformCards: PlatformCard[] = [
  {
    badge: "EĞİTİM PLATFORMU",
    title: "Dynamic Neuro‑Regulation Approach",
    description: "Klinisyenlere self-regülasyon odaklı bilimsel eğitim ve uygulama çerçevesi sunar.",
    bullets: [
      "40+ saatlik kapsamlı eğitim programı",
      "Klinik modüller ve vaka çalışmaları",
      "Self-regülasyon odaklı uygulama içerikleri",
      "Sertifika ve sürekli mentorluk desteği",
    ],
    cta: "Eğitim Programını İncele",
    href: "#how-it-works",
    icon: GraduationCap,
    accent: "#2563EB",
    visual: "certificate",
  },
  {
    badge: "KLİNİK KARAR DESTEĞİ",
    title: "DNA Intelligence",
    description: "Açıklanabilir deterministik değerlendirme, analiz ve raporlama ile klinik karar süreçlerini yapılandırır.",
    bullets: [
      "Kural tabanlı veri analizi ve içgörüler",
      "Deterministik klinik raporlar",
      "Standartlara uyumlu çıktılar",
      "Zaman kazandıran otomasyon",
      "Güvenli veri altyapısı",
    ],
    cta: "Raporlama Sistemini İncele",
    href: "#ecosystem-solutions",
    icon: BrainCircuit,
    accent: "#7C3AED",
    visual: "report",
  },
];

const ecosystemModules = [
  {
    title: "Kapsamlı Değerlendirme",
    text: "Standartlaştırılmış ölçek ve formlar ile çok boyutlu değerlendirme.",
    icon: ClipboardCheck,
  },
  {
    title: "Açıklanabilir Analiz",
    text: "Doğrulanmış kurallarla veri örüntülerini ve kanıt sınırlarını görünür kılar.",
    icon: BrainCircuit,
  },
  {
    title: "Klinik Raporlama",
    text: "Profesyonel formatta deterministik rapor üretimi ve çıktı yönetimi.",
    icon: FileText,
  },
  {
    title: "Klinik Karar Desteği",
    text: "Risk ve güçlü yön analizi ile veriye dayalı klinik karar desteği.",
    icon: TrendingUp,
  },
  {
    title: "Danışan Takip Sistemi",
    text: "Seans, ilerleme ve gelişim takibi için entegre vaka yönetimi.",
    icon: UserRound,
  },
  {
    title: "Güvenli Altyapı",
    text: "Veri güvenliği, gizlilik ve yasal uyumluluk odaklı yapı.",
    icon: LockKeyhole,
  },
];

const workflowSteps = [
  {
    title: "Eğitim",
    text: "Bilimsel temelli eğitimlerle klinik bilgi ve becerinizi güçlendirin.",
    icon: GraduationCap,
  },
  {
    title: "Değerlendirme",
    text: "Standart ölçek ve formlarla danışanınızı çok boyutlu değerlendirin.",
    icon: ClipboardCheck,
  },
  {
    title: "Deterministik Raporlama",
    text: "Açıklanabilir analiz kurallarıyla hızlı, tutarlı ve profesyonel raporlar oluşturun.",
    icon: BrainCircuit,
  },
  {
    title: "Klinik Karar",
    text: "İçgörülerle desteklenen kararlar alarak müdahale planınızı şekillendirin.",
    icon: Target,
  },
  {
    title: "Takip & İzleme",
    text: "Süreç boyunca ilerlemeyi takip edin ve etkili sonuçlar elde edin.",
    icon: LineChart,
  },
];

const advantages = [
  {
    title: "Bilimsel ve Güvenilir",
    text: "Kanıta dayalı, güvenilir ve standartlara uygun çözümler.",
    icon: ShieldCheck,
  },
  {
    title: "Zaman Tasarrufu",
    text: "Deterministik otomasyon ile klinik dokümantasyon iş yükünüz azalır.",
    icon: TimerReset,
  },
  {
    title: "Klinik Etkiyi Artırır",
    text: "Doğru analiz ve içgörülerle daha etkili müdahaleler.",
    icon: Target,
  },
  {
    title: "Her Yerden Erişim",
    text: "Bulut tabanlı altyapı ile güvenli ve kesintisiz erişim.",
    icon: Cloud,
  },
];

function HeroVisual() {
  return (
    <div className={styles.heroVisual} aria-hidden="true">
      <div className={styles.visualGrid} />
      <div className={styles.ecosystemConsole}>
        <div className={styles.consoleHeader}>
          <span />
          DNA Ekosistem Haritası
        </div>
        <div className={styles.ecosystemMap}>
          <div className={`${styles.ecosystemStack} ${styles.educationStack}`}>
            <article>
              <GraduationCap size={20} strokeWidth={2.2} />
              <div>
                <strong>Eğitim Modeli</strong>
                <span>Regülasyon dili</span>
              </div>
            </article>
            <article>
              <ClipboardCheck size={20} strokeWidth={2.2} />
              <div>
                <strong>Değerlendirme</strong>
                <span>Ölçek, gözlem, vaka</span>
              </div>
            </article>
          </div>

          <div className={styles.ecosystemCore}>
            <span className={styles.coreOrbit} />
            <Image
              src="/images/brand/dna-logo-intelligence-symbol-transparent.png"
              alt=""
              width={585}
              height={657}
              aria-hidden="true"
            />
            <strong>DNA Intelligence</strong>
            <small>ortak klinik çekirdek</small>
          </div>

          <div className={`${styles.ecosystemStack} ${styles.aiStack}`}>
            <article>
              <BrainCircuit size={20} strokeWidth={2.2} />
              <div>
                <strong>Kural Tabanlı Analiz</strong>
                <span>Açıklanabilir örüntü ve içgörü</span>
              </div>
            </article>
            <article>
              <FileText size={20} strokeWidth={2.2} />
              <div>
                <strong>Raporlama</strong>
                <span>Terapist onaylı çıktı</span>
              </div>
            </article>
          </div>
        </div>
        <div className={styles.ecosystemPipeline}>
          <span>Öğren</span>
          <i />
          <span>Değerlendir</span>
          <i />
          <span>Analiz Et</span>
          <i />
          <span>Raporla</span>
        </div>
      </div>
    </div>
  );
}

function PlatformVisual({ type }: { type: PlatformCard["visual"] }) {
  if (type === "certificate") {
    return (
      <div className={styles.certificateMockup} aria-hidden="true">
        <strong>DNA Intelligence</strong>
        <span>Certificate</span>
        <div className={styles.mockLine} />
        <div className={styles.mockLineShort} />
        <div className={styles.progressBar}>
          <i />
        </div>
        <small>Tamamlanma 72%</small>
      </div>
    );
  }

  return (
    <div className={styles.reportMockup} aria-hidden="true">
      <strong>KLİNİK RAPOR</strong>
      <span className={styles.reportLineOne} />
      <span className={styles.reportLineTwo} />
      <span className={styles.reportLineThree} />
      <div className={styles.scoreRing}>82</div>
      <small>İçgörü skoru</small>
    </div>
  );
}

export default function CozumlerPage() {
  return (
    <div className={styles.page}>
      <LandingHeader />
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}>ÇÖZÜMLERİMİZ</div>
            <h1>
              Klinik pratiğinizi bilim ve teknolojiyle <span>dönüştürün.</span>
            </h1>
            <p>
              DNA ekosistemi; eğitimden değerlendirmeye, deterministik raporlamadan klinik karar desteğine
              kadar uçtan uca entegre çözümler sunar.
            </p>
          </div>
          <HeroVisual />
        </section>

        <section className={styles.platformGrid} aria-label="DNA ekosisteminin iki ana platformu">
          {platformCards.map(({ badge, title, description, bullets, cta, href, icon: Icon, accent, visual }) => (
            <article className={styles.platformCard} key={title} style={{ "--accent": accent } as CSSProperties}>
              <div className={styles.platformIcon}>
                <Icon size={34} strokeWidth={2} />
              </div>
              <div className={styles.platformCopy}>
                <span className={styles.platformBadge}>{badge}</span>
                <h2>{title}</h2>
                <p>{description}</p>
                <ul>
                  {bullets.map((bullet) => (
                    <li key={bullet}>
                      <CheckCircle2 size={17} strokeWidth={2.6} />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
                <a href={href} className={styles.platformButton}>
                  {cta}
                  <ArrowRight size={18} strokeWidth={2.4} />
                </a>
              </div>
              <PlatformVisual type={visual} />
            </article>
          ))}
        </section>

        <section className={styles.ecosystem} id="ecosystem-solutions" aria-labelledby="ecosystem-title">
          <h2 id="ecosystem-title">DNA Ekosisteminde Sunduğumuz Çözümler</h2>
          <div className={styles.moduleFlow}>
            {ecosystemModules.map(({ title, text, icon: Icon }, index) => (
              <article className={styles.moduleStep} key={title}>
                <div className={styles.moduleIcon}>
                  <Icon size={27} strokeWidth={2} />
                </div>
                <strong>{title}</strong>
                <p>{text}</p>
                {index < ecosystemModules.length - 1 ? <span className={styles.moduleArrow} aria-hidden="true" /> : null}
              </article>
            ))}
          </div>
        </section>

        <section className={styles.workflow} id="how-it-works" aria-labelledby="workflow-title">
          <h2 id="workflow-title">Çözümlerimiz Nasıl Çalışır?</h2>
          <div className={styles.steps}>
            {workflowSteps.map(({ title, text, icon: Icon }, index) => (
              <article className={styles.step} key={title}>
                <div className={styles.stepIcon}>
                  <Icon size={27} strokeWidth={2} />
                </div>
                <strong>{index + 1}. {title}</strong>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.advantages} aria-label="DNA ekosisteminin avantajları">
          {advantages.map(({ title, text, icon: Icon }) => (
            <article className={styles.advantage} key={title}>
              <div className={styles.advantageIcon}>
                <Icon size={24} strokeWidth={2} />
              </div>
              <div>
                <strong>{title}</strong>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </section>

        <section className={styles.cta}>
          <div className={styles.ctaMark}>
            <Image
              src="/images/brand/dna-logo-intelligence-symbol-transparent.png"
              alt=""
              width={132}
              height={132}
              aria-hidden="true"
            />
          </div>
          <div className={styles.ctaCopy}>
            <span>DNA EKOSİSTEMİYLE</span>
            <h2>Klinik pratiğinizde fark yaratın, danışanlarınız için daha iyi sonuçlar elde edin.</h2>
            <p>
              DNA ekosistemiyle bilimsel yaklaşımı, açıklanabilir karar kurallarını ve kullanıcı dostu teknolojiyi bir
              araya getiriyoruz.
            </p>
          </div>
          <div className={styles.ctaActions}>
            <a href="/iletisim" className={styles.primaryCta}>
              İletişime Geç
              <ArrowRight size={18} strokeWidth={2.4} />
            </a>
            <a href="#ecosystem-solutions" className={styles.secondaryCta}>Çözümleri İncele</a>
          </div>
        </section>
      </main>
      <FooterContact />
    </div>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BrainCircuit,
  Check,
  ClipboardCheck,
  FileCheck2,
  GraduationCap,
  HeartPulse,
  Layers3,
  LineChart,
  LockKeyhole,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
  TimerReset,
  UserRoundCheck,
} from "lucide-react";
import FooterContact from "../components/FooterContact";
import LandingHeader from "../components/LandingHeader";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Klinik Çözümler | DNA Intelligence",
  description:
    "Eğitim, değerlendirme, rapor hazırlama ve danışan takibini bir araya getiren DNA Intelligence çözümleri.",
  alternates: {
    canonical: "/cozumler",
  },
  openGraph: {
    title: "Klinik Çözümler | DNA Intelligence",
    description:
      "Eğitim, değerlendirme, terapist incelemeli rapor hazırlama ve takip aynı platformda.",
    url: "/cozumler",
    type: "website",
  },
};

const heroLayers = [
  {
    number: "01",
    title: "Eğitim",
    text: "Yaklaşımı öğrenin",
    Icon: GraduationCap,
    tone: "cyan",
  },
  {
    number: "02",
    title: "Bilgileri toplama",
    text: "Test, anamnez ve gözlem",
    Icon: ClipboardCheck,
    tone: "blue",
  },
  {
    number: "03",
    title: "Sonuçları inceleme",
    text: "Zorlanmalar ve güçlü yönler",
    Icon: BrainCircuit,
    tone: "violet",
  },
  {
    number: "04",
    title: "Rapor ve takip",
    text: "Taslağı düzenleyin",
    Icon: FileCheck2,
    tone: "indigo",
  },
];

const coreSystems = [
  {
    number: "01",
    eyebrow: "Eğitim modeli",
    title: "Dynamic Neuro-Regulation Approach",
    text: "Self-regülasyonu değerlendirmeyi ve çocuğun ihtiyaçlarına göre müdahale planlamayı öğretir.",
    items: ["Yaklaşımın temelleri", "Vaka değerlendirme", "Müdahale planlama"],
    href: "/dna-nedir/egitim-programi",
    link: "Eğitim programını incele",
    Icon: GraduationCap,
  },
  {
    number: "02",
    eyebrow: "Klinik çalışma platformu",
    title: "DNA Intelligence",
    text: "Test sonuçlarını, anamnez bilgilerini ve gözlem notlarını toplar; rapor taslağı hazırlar ve takip kayıtlarını saklar. Son karar terapiste aittir.",
    items: ["Tek yerde değerlendirme", "Rapor taslağı", "Danışan takibi"],
    href: "/dna-nedir/ai-raporlama",
    link: "Raporlama sistemini incele",
    Icon: BrainCircuit,
  },
];

const solutionLayers = [
  {
    number: "01",
    eyebrow: "Öğren",
    title: "Self-regülasyonu değerlendirmeyi ve müdahale planlamayı öğrenin.",
    text: "Eğitim; fizyolojik durum, duyusal yük, duygusal yoğunluk, düşünme becerileri ve katılım arasındaki ilişkileri vaka örnekleriyle ele alır.",
    items: ["40 saatlik eğitim programı", "Klinik modüller ve vaka çalışmaları", "Uygulama örnekleri"],
    outcome: "Eğitim sonunda değerlendirme ve müdahale planlamada aynı yaklaşımı kullanabilirsiniz.",
    href: "/dna-nedir/egitim-programi",
    link: "Eğitim programını incele",
    Icon: GraduationCap,
    tone: "light",
  },
  {
    number: "02",
    eyebrow: "Değerlendir",
    title: "Test, anamnez ve gözlem bilgilerini aynı yerde toplayın.",
    text: "Test sonuçlarını, anamnez bilgilerini, gözlem notlarını ve terapist değerlendirmesini tek ekranda görün. Bilgileri ayrı ayrı aramak zorunda kalmayın.",
    items: ["Test sonuçları", "Anamnez ve gözlem notları", "Zorlanmalar ve güçlü yönler"],
    outcome: "Zorlanmaları, eşlik eden bulguları ve güçlü yönleri birlikte değerlendirebilirsiniz.",
    href: "/dna-nedir/degerlendirme-sistemi",
    link: "Değerlendirme sistemini incele",
    Icon: Layers3,
    tone: "light",
  },
  {
    number: "03",
    eyebrow: "Analiz et",
    title: "Sonuçları karşılaştırın; zorlanmaları ve güçlü yönleri görün.",
    text: "Sistem, girilen bilgileri önceden belirlenmiş kurallara göre karşılaştırır ve sonuçları terapistin inceleyebileceği biçimde gösterir. Kesin neden ya da müdahale kararı vermez.",
    items: ["Sonuçların kısa özeti", "Zorlanmalar ve güçlü yönler", "Eksik veya sınırlı bilgilerin gösterilmesi"],
    outcome: "Hangi sonucun hangi bilgiye dayandığını görerek kendi değerlendirmenizi yapabilirsiniz.",
    href: "/dna-nedir/ai-raporlama",
    link: "Analiz sürecini incele",
    Icon: Sparkles,
    tone: "dark",
  },
  {
    number: "04",
    eyebrow: "Raporla ve izle",
    title: "Rapor taslağını düzenleyin ve değişimi takip edin.",
    text: "Sistem değerlendirme bilgilerinden bir rapor taslağı hazırlar. Terapist taslağı inceler, gerekli değişiklikleri yapar ve son halini verir.",
    items: ["Düzenlenebilir rapor taslağı", "Bilgi kaynaklarının ayrı gösterilmesi", "Güvenli danışan arşivi"],
    outcome: "Rapor daha kısa sürede hazırlanır; son değerlendirmeyi yine terapist yapar.",
    href: "/dna-nedir/ai-raporlama",
    link: "Raporlama sistemini incele",
    Icon: Route,
    tone: "light",
  },
];

const outcomes = [
  {
    title: "Son değerlendirme terapiste aittir",
    text: "Platform sonuçları ve eksik bilgileri bir araya getirir. Son değerlendirmeyi terapist yapar.",
    Icon: Target,
  },
  {
    title: "Rapor hazırlama süresini kısaltın",
    text: "Tekrar eden bilgiler rapor taslağına sistem tarafından eklenir.",
    Icon: TimerReset,
  },
  {
    title: "Değişimi düzenli takip edin",
    text: "Önceki ve yeni değerlendirmeleri, raporları ve takip notlarını birlikte görün.",
    Icon: LineChart,
  },
  {
    title: "Bilgileri güvenle saklayın",
    text: "Kayıtlara yalnızca yetkili kullanıcılar erişebilir; önemli işlemler kaydedilir.",
    Icon: ShieldCheck,
  },
];

export default function CozumlerPage() {
  return (
    <div className={styles.page}>
      <LandingHeader />

      <main>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <span className={styles.kicker}>EĞİTİM, DEĞERLENDİRME VE RAPORLAMA</span>
              <h1>
                Eğitimden değerlendirmeye, <span>rapordan takibe</span> kadar tüm süreci birlikte yönetin.
              </h1>
              <p>
                Eğitimde öğrendiğiniz yaklaşımı değerlendirme, rapor hazırlama ve takip sırasında da kullanın.
                Son değerlendirmeyi ve kararı terapist verir.
              </p>
              <div className={styles.heroActions}>
                <a href="#solution-layers" className={styles.primaryButton}>
                  Çözüm adımlarını incele
                  <ArrowDown size={18} strokeWidth={2.3} />
                </a>
                <Link href="/dna-nedir" className={styles.textButton}>
                  Yaklaşımı tanıyın
                  <ArrowRight size={18} strokeWidth={2.3} />
                </Link>
              </div>
            </div>

            <div className={styles.heroSystem} aria-label="DNA çözüm akışı">
              <div className={styles.systemHeader}>
                <div className={styles.systemBrand}>
                  <Image
                    src="/images/brand/dna-logo-intelligence-symbol-transparent.png"
                    alt="DNA Intelligence"
                    width={54}
                    height={60}
                    priority
                  />
                  <div>
                    <span>DNA Intelligence</span>
                    <strong>Klinik çözüm akışı</strong>
                  </div>
                </div>
                <span className={styles.systemStatus}>4 adım</span>
              </div>

              <div className={styles.systemLayers}>
                {heroLayers.map(({ number, title, text, Icon, tone }) => (
                  <div className={styles.systemLayer} data-tone={tone} key={number}>
                    <span className={styles.layerNumber}>{number}</span>
                    <span className={styles.systemIcon} aria-hidden="true">
                      <Icon size={21} strokeWidth={2} />
                    </span>
                    <div>
                      <strong>{title}</strong>
                      <small>{text}</small>
                    </div>
                    <Check size={17} strokeWidth={2.5} aria-hidden="true" />
                  </div>
                ))}
              </div>

              <div className={styles.systemFooter}>
                <HeartPulse size={18} strokeWidth={2} aria-hidden="true" />
                <span>Eğitimden rapor taslağına uzanan dört adım</span>
                <LockKeyhole size={17} strokeWidth={2} aria-hidden="true" />
              </div>
            </div>
          </div>
        </section>

        <section className={styles.coreSection} aria-labelledby="core-title">
          <div className={styles.sectionIntro}>
            <span className={styles.kicker}>İKİ BÖLÜM, TEK YAKLAŞIM</span>
            <h2 id="core-title">Eğitimde öğrendiğiniz yaklaşımı platformda uygulayın.</h2>
            <p>Eğitim yaklaşımı öğretir; platform değerlendirme, rapor hazırlama ve takip işlemlerini kolaylaştırır.</p>
          </div>

          <div className={styles.coreList}>
            {coreSystems.map(({ number, eyebrow, title, text, items, href, link, Icon }) => (
              <article className={styles.coreRow} key={number}>
                <span className={styles.coreNumber}>{number}</span>
                <span className={styles.coreIcon} aria-hidden="true">
                  <Icon size={27} strokeWidth={1.9} />
                </span>
                <div className={styles.coreCopy}>
                  <span>{eyebrow}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                  <ul>
                    {items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <Link href={href} className={styles.rowLink}>
                  {link}
                  <ArrowRight size={18} strokeWidth={2.3} />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.layersSection} id="solution-layers" aria-labelledby="layers-title">
          <div className={styles.layersHeading}>
            <span className={styles.kicker}>DÖRT ADIMDA ÇALIŞIN</span>
            <h2 id="layers-title">Öğrenin, bilgileri toplayın, sonuçları inceleyin ve raporu hazırlayın.</h2>
            <p>
              Eğitim, değerlendirme, sonuçların incelenmesi ve rapor hazırlama birbirini izleyen adımlardır.
            </p>
          </div>

          <div className={styles.layerList} id="ecosystem-solutions">
            {solutionLayers.map(({ number, eyebrow, title, text, items, outcome, href, link, Icon, tone }) => (
              <article className={styles.solutionLayer} data-tone={tone} key={number}>
                <div className={styles.solutionIndex}>
                  <span>{number}</span>
                  <Icon size={28} strokeWidth={1.9} aria-hidden="true" />
                </div>
                <div className={styles.solutionCopy}>
                  <span className={styles.solutionEyebrow}>{eyebrow}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                  <ul>
                    {items.map((item) => (
                      <li key={item}>
                        <Check size={16} strokeWidth={2.6} aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={styles.solutionResult}>
                  <strong>{outcome}</strong>
                  <Link href={href}>
                    {link}
                    <ArrowRight size={18} strokeWidth={2.3} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.outcomeSection} aria-labelledby="outcome-title">
          <div className={styles.outcomeHeading}>
            <span>GÜNLÜK KULLANIM</span>
            <h2 id="outcome-title">Bilgileri daha kolay bulun, karşılaştırın ve raporlayın.</h2>
          </div>
          <div className={styles.outcomeGrid}>
            {outcomes.map(({ title, text, Icon }) => (
              <article key={title}>
                <Icon size={24} strokeWidth={1.9} aria-hidden="true" />
                <strong>{title}</strong>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.cta}>
          <div>
            <span className={styles.kicker}>DNA INTELLIGENCE</span>
            <h2>İhtiyacınıza uygun kullanım biçimini birlikte planlayalım.</h2>
            <p>Eğitim, değerlendirme ve raporlama hakkında merak ettiklerinizi konuşalım.</p>
          </div>
          <div className={styles.ctaActions}>
            <Link href="/iletisim" className={styles.primaryButton}>
              İletişime geç
              <ArrowRight size={18} strokeWidth={2.3} />
            </Link>
            <Link href="/signup" className={styles.secondaryButton}>
              Platforma katıl
              <UserRoundCheck size={18} strokeWidth={2.2} />
            </Link>
          </div>
        </section>
      </main>

      <FooterContact />
    </div>
  );
}

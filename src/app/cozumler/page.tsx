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
    "Klinik eğitimden çok boyutlu değerlendirmeye, AI destekli analizden profesyonel raporlama ve danışan takibine uzanan DNA Intelligence çözüm ekosistemi.",
  alternates: {
    canonical: "/cozumler",
  },
  openGraph: {
    title: "Klinik Çözümler | DNA Intelligence",
    description:
      "Eğitim, değerlendirme, AI destekli analiz, klinik raporlama ve takip tek bir yapılandırılmış akışta.",
    url: "/cozumler",
    type: "website",
  },
};

const heroLayers = [
  {
    number: "01",
    title: "Klinik çerçeve",
    text: "Ortak regülasyon dili",
    Icon: GraduationCap,
    tone: "cyan",
  },
  {
    number: "02",
    title: "Değerlendirme",
    text: "Çok kaynaklı klinik veri",
    Icon: ClipboardCheck,
    tone: "blue",
  },
  {
    number: "03",
    title: "AI destekli analiz",
    text: "Örüntü ve öncelik sentezi",
    Icon: BrainCircuit,
    tone: "violet",
  },
  {
    number: "04",
    title: "Rapor ve takip",
    text: "Gerekçeli klinik çıktı",
    Icon: FileCheck2,
    tone: "indigo",
  },
];

const coreSystems = [
  {
    number: "01",
    eyebrow: "Eğitim modeli",
    title: "Dynamic Neuro-Regulation Approach",
    text: "Klinisyene self-regülasyonu okuma, vaka diline çevirme ve müdahale önceliği kurma çerçevesi verir.",
    items: ["Klinik eğitim", "Vaka formülasyonu", "Müdahale düşüncesi"],
    href: "/dna-nedir/egitim-programi",
    link: "Eğitim programını incele",
    Icon: GraduationCap,
  },
  {
    number: "02",
    eyebrow: "Klinik karar desteği",
    title: "DNA Intelligence",
    text: "Bu klinik dili değerlendirme, AI destekli analiz, profesyonel raporlama ve takip süreçlerine taşır.",
    items: ["Yapılandırılmış veri", "Açıklanabilir öncelik", "Terapist onaylı çıktı"],
    href: "/dna-nedir/ai-raporlama",
    link: "Raporlama sistemini incele",
    Icon: BrainCircuit,
  },
];

const solutionLayers = [
  {
    number: "01",
    eyebrow: "Öğren",
    title: "Klinik çerçeveyi ortak bir dille kurun.",
    text: "Bilimsel eğitim, regülasyon alanlarını tek tek ezberletmek yerine çocuğun davranışını fizyolojik durum, duyusal yük, duygusal yoğunluk, bilişsel organizasyon ve katılım üzerinden birlikte okumayı öğretir.",
    items: ["40+ saatlik eğitim programı", "Klinik modüller ve vaka çalışmaları", "Uygulamaya dönük mentorluk"],
    outcome: "Sonuç: Değerlendirme ve müdahale aynı klinik mantıkta ilerler.",
    href: "/dna-nedir/egitim-programi",
    link: "Eğitim katmanını aç",
    Icon: GraduationCap,
    tone: "light",
  },
  {
    number: "02",
    eyebrow: "Değerlendir",
    title: "Dağınık klinik veriyi tek bir vaka görünümünde birleştirin.",
    text: "Anamnez, ölçek sonuçları, gözlem ve terapist notları kaynaklarını kaybetmeden aynı değerlendirme yapısında buluşur. Böylece tek bir puan yerine klinik örüntü görünür olur.",
    items: ["Çok kaynaklı veri", "Altı regülasyon alanı", "Güçlük ve güçlü yön ayrımı"],
    outcome: "Sonuç: Birincil öncelik, eşlik eden alanlar ve koruyucu kapasite ayrışır.",
    href: "/dna-nedir/degerlendirme-sistemi",
    link: "Değerlendirme katmanını aç",
    Icon: Layers3,
    tone: "light",
  },
  {
    number: "03",
    eyebrow: "Analiz et",
    title: "AI desteğiyle örüntüyü ve klinik önceliği netleştirin.",
    text: "Sistem klinik verileri yapılandırır, alanlar arasındaki ilişkileri görünür kılar ve karar gerekçesini rapor diline hazırlar. Nihai yorum ve klinik karar terapistin kontrolünde kalır.",
    items: ["Örüntü sentezi", "Gerekçeli önceliklendirme", "Kanıt sınırlarını koruyan dil"],
    outcome: "Sonuç: Ne yapılacağı kadar neden önce yapılacağı da görünür olur.",
    href: "/dna-nedir/ai-raporlama",
    link: "AI analiz katmanını aç",
    Icon: Sparkles,
    tone: "dark",
  },
  {
    number: "04",
    eyebrow: "Raporla ve izle",
    title: "Klinik kararı okunabilir rapora ve takip planına taşıyın.",
    text: "Değerlendirme bulguları, klinik karar özeti, öncelikli hedefler ve takip göstergeleri tutarlı bir rapor yapısında birleşir. Süreç danışan kaydı üzerinden devam eder.",
    items: ["Profesyonel klinik rapor", "Müdahale ve takip odağı", "Güvenli danışan arşivi"],
    outcome: "Sonuç: Rapor yalnızca arşivlenmez; sonraki klinik adımı yönlendirir.",
    href: "/dna-nedir/mudahale-yaklasimi",
    link: "Müdahale katmanını aç",
    Icon: Route,
    tone: "light",
  },
];

const outcomes = [
  {
    title: "Daha net klinik karar",
    text: "Öncelik, gerekçe ve takip odağı aynı görünümde.",
    Icon: Target,
  },
  {
    title: "Daha az dokümantasyon yükü",
    text: "Tekrarlayan rapor işlerini düzenleyen ortak yapı.",
    Icon: TimerReset,
  },
  {
    title: "Daha tutarlı takip",
    text: "Değerlendirmeden müdahaleye kesintisiz vaka izi.",
    Icon: LineChart,
  },
  {
    title: "Güvenli klinik altyapı",
    text: "Erişim, kayıt ve veri koruma kontrolleriyle çalışır.",
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
              <span className={styles.kicker}>DNA ÇÖZÜM EKOSİSTEMİ</span>
              <h1>
                Klinik süreci görün. <span>Önceliği netleştirin.</span> Kararı yapılandırın.
              </h1>
              <p>
                Eğitimden değerlendirmeye, AI destekli analizden klinik raporlama ve takibe kadar her adım
                aynı klinik dilde ilerler.
              </p>
              <div className={styles.heroActions}>
                <a href="#solution-layers" className={styles.primaryButton}>
                  Katmanları incele
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
                <span className={styles.systemStatus}>4 katman</span>
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
                <span>Klinik çerçeveden izlenebilir çıktıya tek hat</span>
                <LockKeyhole size={17} strokeWidth={2} aria-hidden="true" />
              </div>
            </div>
          </div>
        </section>

        <section className={styles.coreSection} aria-labelledby="core-title">
          <div className={styles.sectionIntro}>
            <span className={styles.kicker}>ORTAK KLİNİK DİL</span>
            <h2 id="core-title">İki yapı, tek klinik hat.</h2>
            <p>Eğitim düşünme çerçevesini kurar; sistem bu çerçeveyi veriye, rapora ve takibe taşır.</p>
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
            <span className={styles.kicker}>KLİNİK AKIŞ</span>
            <h2 id="layers-title">Her katman bir sonrakini daha güçlü hale getirir.</h2>
            <p>
              Sistem ayrı araçların toplamı değildir. Öğrenme, değerlendirme, analiz ve raporlama birbirini
              tamamlayan tek bir karar zinciridir.
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
            <span>KLİNİK ETKİ</span>
            <h2 id="outcome-title">Daha fazla ekran değil, daha net karar.</h2>
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
            <h2>Klinik çalışma akışınızı birlikte yapılandıralım.</h2>
            <p>Eğitim modelinden değerlendirme ve raporlamaya kadar ihtiyacınız olan katmanı birlikte netleştirelim.</p>
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

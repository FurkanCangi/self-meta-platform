import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  ClipboardCheck,
  Database,
  FileCheck2,
  GitBranch,
  Layers3,
  LockKeyhole,
  Network,
  ScanSearch,
  ShieldCheck,
  X,
} from "lucide-react";
import FooterContact from "../components/FooterContact";
import LandingHeader from "../components/LandingHeader";
import styles from "./DataNetworkPage.module.css";

const networkLayers = [
  {
    number: "01",
    title: "Klinik merkezler",
    text: "Ortak araştırma protokolüne bağlanır.",
    Icon: Building2,
    tone: "cyan",
  },
  {
    number: "02",
    title: "Ölçüm standardı",
    text: "Formlar ve veri sözlüğü eşlenir.",
    Icon: ClipboardCheck,
    tone: "blue",
  },
  {
    number: "03",
    title: "Güvenli veri katmanı",
    text: "Erişim, saklama ve etik sınırlar tanımlanır.",
    Icon: ShieldCheck,
    tone: "violet",
  },
  {
    number: "04",
    title: "Toplulaştırılmış analiz",
    text: "Ortak bilimsel örüntüler değerlendirilir.",
    Icon: BarChart3,
    tone: "indigo",
  },
];

const safeguards = [
  {
    number: "01",
    eyebrow: "Karşılaştırılabilirlik",
    title: "Her merkez aynı ölçüm dilinde çalışır.",
    text: "Ölçüm dili, form yapısı ve veri giriş standartları araştırma sorusuna göre ortaklaştırılır.",
    Icon: Layers3,
  },
  {
    number: "02",
    eyebrow: "Veri kalitesi",
    title: "Eksik, uyumsuz ve sıra dışı kayıtlar görünür olur.",
    text: "Kalite kontrolleri veri toplama başlamadan tanımlanır; kayıtların izlenebilirliği süreç boyunca korunur.",
    Icon: ScanSearch,
  },
  {
    number: "03",
    eyebrow: "Gizlilik ve yönetişim",
    title: "Erişim sınırları baştan belirlenir.",
    text: "Onam, etik izin, güvenli saklama ve yetkili erişim kuralları çalışma başlamadan netleştirilir.",
    Icon: LockKeyhole,
  },
  {
    number: "04",
    eyebrow: "Bilimsel çıktı",
    title: "Tekil kayıtlar değil, toplulaştırılmış bulgular değerlendirilir.",
    text: "Veri ağı bireysel tanı veya otomatik karar için değil, kontrollü bilimsel analiz için yapılandırılır.",
    Icon: BarChart3,
  },
];

const processSteps = [
  {
    number: "01",
    title: "Araştırma sorusu",
    text: "Merkezlerin yanıtlayacağı ortak soru ve hedef grup netleştirilir.",
    Icon: GitBranch,
  },
  {
    number: "02",
    title: "Ortak protokol",
    text: "Ölçüm, form, değişken ve uygulama adımları aynı yapıya alınır.",
    Icon: ClipboardCheck,
  },
  {
    number: "03",
    title: "Kontrollü toplama",
    text: "Merkezler yetkili erişimle veri üretir; kayıt izi korunur.",
    Icon: Database,
  },
  {
    number: "04",
    title: "Kalite kontrolü",
    text: "Eksik ve uyumsuz kayıtlar analize girmeden önce değerlendirilir.",
    Icon: ScanSearch,
  },
  {
    number: "05",
    title: "Ortak çıktı",
    text: "Doğrulanmış veri toplulaştırılır ve araştırma planına göre analiz edilir.",
    Icon: FileCheck2,
  },
];

const produces = [
  "Karşılaştırılabilir çok merkezli veri",
  "Ortak veri sözlüğü ve ölçüm standardı",
  "İzlenebilir kalite kontrolü",
  "Analize hazır toplulaştırılmış veri seti",
];

const doesNotProduce = [
  "Bireysel tanı veya otomatik klinik karar",
  "Kontrolsüz merkezler arası veri paylaşımı",
  "Etik izin ve açık amaç olmadan veri kullanımı",
  "Kaynağı belirsiz veya denetlenemeyen analiz",
];

export default function DataNetworkPage() {
  return (
    <div className={styles.page}>
      <LandingHeader />

      <main>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <span className={styles.kicker}>ÇOK MERKEZLİ ARAŞTIRMA ALTYAPISI</span>
              <h1>
                Merkezleri bağlayın. <span>Veriyi standartlaştırın.</span> Bilgiyi birlikte üretin.
              </h1>
              <p>
                Çok merkezli veri toplama ve ortak veri üretimi; karşılaştırılabilir ölçüm, güvenli erişim ve
                etik kullanım ilkeleriyle tek bir araştırma hattında ilerler.
              </p>
              <div className={styles.heroActions}>
                <a className={styles.primaryButton} href="#data-network-flow">
                  Çalışma akışını incele
                  <ArrowDown size={18} strokeWidth={2.3} />
                </a>
                <Link className={styles.textButton} href="/iletisim">
                  İş birliği görüşmesi
                  <ArrowRight size={18} strokeWidth={2.3} />
                </Link>
              </div>
            </div>

            <div className={styles.networkPanel} aria-label="DNA veri ağı katmanları">
              <div className={styles.panelHeader}>
                <div className={styles.panelBrand}>
                  <Image
                    src="/images/brand/dna-logo-intelligence-symbol-transparent.png"
                    alt="DNA Intelligence"
                    width={54}
                    height={60}
                    priority
                  />
                  <div>
                    <span>DNA Intelligence</span>
                    <strong>Veri ağı protokolü</strong>
                  </div>
                </div>
                <span className={styles.panelStatus}>Kontrollü ağ modeli</span>
              </div>

              <div className={styles.networkLayers}>
                {networkLayers.map(({ number, title, text, Icon, tone }) => (
                  <div className={styles.networkLayer} data-tone={tone} key={number}>
                    <span className={styles.layerNumber}>{number}</span>
                    <span className={styles.layerIcon} aria-hidden="true">
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

              <div className={styles.panelFooter}>
                <Network size={18} strokeWidth={2} aria-hidden="true" />
                <span>Merkez verisinden doğrulanmış ortak çıktıya</span>
                <LockKeyhole size={17} strokeWidth={2} aria-hidden="true" />
              </div>
            </div>
          </div>

          <div className={styles.heroFlow} aria-label="Veri ağı kısa akışı">
            {[
              ["01", "Merkezleri bağla"],
              ["02", "Standardı kur"],
              ["03", "Veriyi doğrula"],
              ["04", "Birlikte analiz et"],
            ].map(([number, label]) => (
              <div key={number}>
                <span>{number}</span>
                <strong>{label}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.safeguards} aria-labelledby="safeguards-title">
          <div className={styles.sectionIntro}>
            <span className={styles.kicker}>BİR AĞ, DÖRT GÜVENCE</span>
            <h2 id="safeguards-title">Bilimsel iş birliği ortak kurallarla güçlenir.</h2>
            <p>
              Veri ağı yalnızca merkezleri bir araya getirmez. Ölçümden erişime kadar aynı kalite standardının
              korunmasını sağlar.
            </p>
          </div>

          <div className={styles.safeguardList}>
            {safeguards.map(({ number, eyebrow, title, text, Icon }) => (
              <article className={styles.safeguardRow} key={number}>
                <span className={styles.rowNumber}>{number}</span>
                <span className={styles.rowIcon} aria-hidden="true">
                  <Icon size={26} strokeWidth={1.9} />
                </span>
                <div>
                  <span>{eyebrow}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.processSection} id="data-network-flow" aria-labelledby="process-title">
          <div className={styles.processInner}>
            <div className={styles.processHeading}>
              <span className={styles.kicker}>ÇALIŞMA AKIŞI</span>
              <h2 id="process-title">Araştırma sorusundan ortak bilimsel çıktıya.</h2>
              <p>Her aşama bir sonraki adımın veri kalitesini ve güvenilirliğini güçlendirir.</p>
            </div>

            <div className={styles.processGrid}>
              {processSteps.map(({ number, title, text, Icon }) => (
                <article className={styles.processStep} key={number}>
                  <div className={styles.stepTopline}>
                    <span>{number}</span>
                    <Icon size={22} strokeWidth={2} aria-hidden="true" />
                  </div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.boundaries} aria-labelledby="boundaries-title">
          <div className={styles.boundaryHeading}>
            <span className={styles.kicker}>AÇIK SINIRLAR</span>
            <h2 id="boundaries-title">Veri ağının ne ürettiği kadar ne üretmediği de nettir.</h2>
          </div>

          <div className={styles.boundaryColumns}>
            <article>
              <div className={styles.boundaryTitle}>
                <span className={styles.positiveIcon} aria-hidden="true">
                  <Check size={19} strokeWidth={2.5} />
                </span>
                <h3>Ağ ne üretir?</h3>
              </div>
              <ul>
                {produces.map((item) => (
                  <li key={item}>
                    <Check size={17} strokeWidth={2.3} aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article>
              <div className={styles.boundaryTitle}>
                <span className={styles.negativeIcon} aria-hidden="true">
                  <X size={19} strokeWidth={2.5} />
                </span>
                <h3>Ağ ne üretmez?</h3>
              </div>
              <ul>
                {doesNotProduce.map((item) => (
                  <li key={item}>
                    <X size={17} strokeWidth={2.3} aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className={styles.cta}>
          <div>
            <span className={styles.kicker}>ARAŞTIRMA İŞ BİRLİĞİ</span>
            <h2>Çok merkezli bir çalışma mı planlıyorsunuz?</h2>
            <p>
              Araştırma sorusunu, hedef grubu ve veri ihtiyacını birlikte değerlendirip uygulanabilir ağ modelini
              netleştirebiliriz.
            </p>
          </div>
          <div className={styles.ctaActions}>
            <Link className={styles.primaryButton} href="/iletisim">
              Veri ağı için görüşelim
              <ArrowRight size={18} strokeWidth={2.3} />
            </Link>
            <Link className={styles.secondaryButton} href="/arastirma">
              Araştırma merkezine dön
            </Link>
          </div>
        </section>
      </main>

      <FooterContact />
    </div>
  );
}

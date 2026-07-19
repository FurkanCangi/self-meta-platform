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
    text: "Aynı araştırma planına göre çalışır.",
    Icon: Building2,
    tone: "cyan",
  },
  {
    number: "02",
    title: "Ortak ölçüm planı",
    text: "Bütün merkezler aynı formları ve değişken adlarını kullanır.",
    Icon: ClipboardCheck,
    tone: "blue",
  },
  {
    number: "03",
    title: "Güvenli veri yönetimi",
    text: "Çalışma başlamadan veriye kimlerin erişeceğini ve verinin ne kadar süre saklanacağını yazarız.",
    Icon: ShieldCheck,
    tone: "violet",
  },
  {
    number: "04",
    title: "Birlikte değerlendirme",
    text: "Araştırma ekibi kişisel bilgileri veriden ayırır ve merkezlerden gelen kayıtları toplu olarak inceler.",
    Icon: BarChart3,
    tone: "indigo",
  },
];

const safeguards = [
  {
    number: "01",
    eyebrow: "Ortak yöntem",
    title: "Bütün merkezler aynı form ve veri giriş kurallarını kullanır.",
    text: "Bütün merkezler aynı soruları, seçenekleri ve değişken adlarını kullanır.",
    Icon: Layers3,
  },
  {
    number: "02",
    eyebrow: "Veri kalitesi",
    title: "Eksik veya birbiriyle uyuşmayan kayıtları işaretleriz.",
    text: "Çalışma başlamadan uygulanacak kontrolleri ve kayıtların nasıl izleneceğini araştırma protokolünde kararlaştırırız.",
    Icon: ScanSearch,
  },
  {
    number: "03",
    eyebrow: "Gizlilik ve erişim",
    title: "Veriye erişecek kişileri baştan yazarız.",
    text: "Çalışma başlamadan katılımcı onayını, etik kurul iznini, saklama süresini ve erişim yetkilerini açıkça kaydederiz.",
    Icon: LockKeyhole,
  },
  {
    number: "04",
    eyebrow: "Toplu değerlendirme",
    title: "Sonuçlar kişi kişi değil, bütün grup üzerinden değerlendirilir.",
    text: "Veri ağı tanı koymaz veya tek bir kişi için karar vermez. Araştırma sonuçlarını görmek için kullanılır.",
    Icon: BarChart3,
  },
];

const processSteps = [
  {
    number: "01",
    title: "Araştırma sorusu",
    text: "Merkezler ortak araştırma sorusunu ve çalışmaya kimlerin katılacağını birlikte kararlaştırır.",
    Icon: GitBranch,
  },
  {
    number: "02",
    title: "Ortak yöntem",
    text: "Bütün merkezler aynı ölçüm araçlarını, değişkenleri ve uygulama adımlarını kullanır.",
    Icon: ClipboardCheck,
  },
  {
    number: "03",
    title: "Veri toplama",
    text: "Araştırma protokolünde verileri kimlerin gireceği ve işlemlerin nasıl kayıt altına alınacağı belirlenir.",
    Icon: Database,
  },
  {
    number: "04",
    title: "Kalite kontrolü",
    text: "Eksik veya birbiriyle uyuşmayan kayıtlar analize alınmadan önce kontrol edilir.",
    Icon: ScanSearch,
  },
  {
    number: "05",
    title: "Sonuçların hazırlanması",
    text: "Kontrollerden geçen verileri birlikte inceler ve araştırma raporunu hazırlarız.",
    Icon: FileCheck2,
  },
];

const produces = [
  "Merkezler arasında karşılaştırılabilen veriler",
  "Bütün merkezlerde kullanılan ortak formlar",
  "Veri erişimi ve işlem kayıtları için önceden belirlenmiş bir izleme planı",
  "Birlikte değerlendirilmeye hazır araştırma verisi",
];

const doesNotProduce = [
  "Tek bir kişi için tanı koymak veya karar vermek",
  "İzinsiz merkezler arası veri paylaşımı",
  "Etik kurul izni ve açık amaç olmadan veri kullanımı",
  "Kaynağı belli olmayan veya denetlenemeyen sonuçlar",
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
                Merkezleri bir araya getirin. <span>Aynı yöntemle veri toplayın.</span> Sonuçları birlikte değerlendirin.
              </h1>
              <p>
                Birden fazla merkez aynı araştırmaya katıldığında herkes aynı formu, değişken adlarını ve veri
                giriş kurallarını kullanır. Erişim ve gizlilik kurallarını da çalışma başlamadan kararlaştırır.
              </p>
              <div className={styles.heroActions}>
                <a className={styles.primaryButton} href="#data-network-flow">
                  Nasıl çalıştığını görün
                  <ArrowDown size={18} strokeWidth={2.3} />
                </a>
                <Link className={styles.textButton} href="/iletisim">
                  İş birliği görüşmesi
                  <ArrowRight size={18} strokeWidth={2.3} />
                </Link>
              </div>
            </div>

            <div className={styles.networkPanel} aria-label="DNA veri ağı bileşenleri">
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
                    <strong>Ortak araştırma planı</strong>
                  </div>
                </div>
                <span className={styles.panelStatus}>Kurallar belirlendi</span>
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
                <span>Merkezlerden gelen kayıtlar önce kontrol edilir, ardından toplu olarak incelenir.</span>
                <LockKeyhole size={17} strokeWidth={2} aria-hidden="true" />
              </div>
            </div>
          </div>

          <div className={styles.heroFlow} aria-label="Veri ağı kısa akışı">
            {[
              ["01", "Merkezleri belirle"],
              ["02", "Ortak yöntemi hazırla"],
              ["03", "Kayıtları kontrol et"],
              ["04", "Sonuçları değerlendir"],
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
            <span className={styles.kicker}>ORTAK ÇALIŞMANIN DÖRT KURALI</span>
            <h2 id="safeguards-title">Merkezler aynı yöntemle çalıştığında sonuçlar karşılaştırılabilir.</h2>
            <p>
              Aynı formlar, veri giriş kuralları ve güvenlik önlemleri bütün merkezlerde uygulanır.
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
              <h2 id="process-title">Araştırma beş adımda yürütülür.</h2>
              <p>Her adım tamamlandıktan sonra bir sonrakine geçilir.</p>
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
            <span className={styles.kicker}>VERİ AĞININ KULLANIM ALANI</span>
            <h2 id="boundaries-title">Veri ağının kullanım amacı çalışma başlamadan açıklanır.</h2>
          </div>

          <div className={styles.boundaryColumns}>
            <article>
              <div className={styles.boundaryTitle}>
                <span className={styles.positiveIcon} aria-hidden="true">
                  <Check size={19} strokeWidth={2.5} />
                </span>
                <h3>Veri ağıyla yapılabilecekler</h3>
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
                <h3>Kullanılmadığı alanlar</h3>
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
              Araştırma sorusunu, hedef grubu, kullanılacak formları ve veri güvenliği kurallarını birlikte
              belirleyebiliriz.
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

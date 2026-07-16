import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Check,
  ClipboardCheck,
  FileCheck2,
  FileText,
  GraduationCap,
  Lightbulb,
  ListChecks,
  Route,
  ScanSearch,
  Target,
  X,
} from "lucide-react";
import FooterContact from "../components/FooterContact";
import LandingHeader from "../components/LandingHeader";
import styles from "./DataNetworkPage.module.css";

const projectLayers = [
  {
    number: "01",
    title: "Araştırma sorusu",
    text: "Çalışılabilir ve sınırları belirgin hale gelir.",
    Icon: Lightbulb,
    tone: "cyan",
  },
  {
    number: "02",
    title: "Yöntem planı",
    text: "Örneklem, ölçüm ve analiz aynı hedefe bağlanır.",
    Icon: ClipboardCheck,
    tone: "blue",
  },
  {
    number: "03",
    title: "Veri yorumlama",
    text: "Bulgular ve sınırlılıklar birlikte değerlendirilir.",
    Icon: BarChart3,
    tone: "violet",
  },
  {
    number: "04",
    title: "Bilimsel çıktı",
    text: "Tez, proje, makale veya sunum yapılandırılır.",
    Icon: BookOpenCheck,
    tone: "indigo",
  },
];

const decisions = [
  {
    number: "01",
    eyebrow: "Araştırma sorusu",
    title: "Klinik fikir, yanıtlanabilir bir soruya dönüşür.",
    text: "Amaç, hedef grup, değişkenler ve araştırmanın sınırları en başta açık biçimde tanımlanır.",
    Icon: Target,
  },
  {
    number: "02",
    eyebrow: "Yöntem planı",
    title: "Tasarım, proje hedefiyle aynı yönde çalışır.",
    text: "Örneklem, ölçüm araçları, uygulama akışı ve karşılaştırma planı birbiriyle uyumlu kurulur.",
    Icon: Route,
  },
  {
    number: "03",
    eyebrow: "Ölçüm ve analiz",
    title: "Toplanan her veri araştırma sorusuna hizmet eder.",
    text: "Gereksiz değişken yükü azaltılır; veri kalitesi ve analiz yaklaşımı araştırma başlamadan netleştirilir.",
    Icon: ScanSearch,
  },
  {
    number: "04",
    eyebrow: "Bilimsel anlatım",
    title: "Bulgular iddiadan önce kanıtı gösterir.",
    text: "Sonuçlar klinik anlam, metodolojik sınırlılık ve etik kullanım dengesi korunarak yapılandırılır.",
    Icon: FileText,
  },
];

const projectSteps = [
  {
    number: "01",
    title: "Ön görüşme",
    text: "Proje fikri, hedef program ve mevcut hazırlık düzeyi değerlendirilir.",
    Icon: GraduationCap,
  },
  {
    number: "02",
    title: "Kapsam kararı",
    text: "Araştırma sorusu ve projenin gerçekçi sınırları netleştirilir.",
    Icon: Target,
  },
  {
    number: "03",
    title: "Yöntem tasarımı",
    text: "Örneklem, ölçüm, veri toplama ve analiz planı birlikte kurulur.",
    Icon: ListChecks,
  },
  {
    number: "04",
    title: "Bulguların yorumu",
    text: "Sonuçlar kanıt düzeyi ve metodolojik sınırlar içinde değerlendirilir.",
    Icon: BarChart3,
  },
  {
    number: "05",
    title: "Çıktı yapısı",
    text: "Tez, rapor, makale taslağı veya sunum tutarlı bir anlatı kazanır.",
    Icon: FileCheck2,
  },
];

const supportScope = [
  "Araştırma sorusunu ve hipotezleri netleştirme",
  "Yöntem, örneklem ve ölçüm planını yapılandırma",
  "Analiz yaklaşımı ile veri ihtiyacını eşleştirme",
  "Bulguları bilimsel sınırlar içinde yorumlama",
];

const researcherResponsibilities = [
  "Etik kurul ve kurum izinlerini tamamlama",
  "Saha uygulamasını onaylanan protokole göre yürütme",
  "Veri doğruluğunu ve kaynak kayıtlarını koruma",
  "Nihai akademik karar ve teslim sorumluluğunu üstlenme",
];

export default function ProjectSupportPage() {
  return (
    <div className={styles.page}>
      <LandingHeader />

      <main>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <span className={styles.kicker}>TEZ VE ARAŞTIRMA PROJESİ DESTEĞİ</span>
              <h1>
                Fikri netleştirin. <span>Yöntemi güçlendirin.</span> Çıktıyı yapılandırın.
              </h1>
              <p>
                Yüksek lisans, doktora, TÜBİTAK ve araştırma projeleri; araştırma sorusundan bilimsel çıktıya
                kadar tutarlı bir metodolojik hat üzerinde geliştirilir.
              </p>
              <div className={styles.heroActions}>
                <a className={styles.primaryButton} href="#project-flow">
                  Destek akışını incele
                  <ArrowDown size={18} strokeWidth={2.3} />
                </a>
                <Link className={styles.textButton} href="/iletisim">
                  Projenizi paylaşın
                  <ArrowRight size={18} strokeWidth={2.3} />
                </Link>
              </div>
            </div>

            <div className={styles.networkPanel} aria-label="Tez ve proje desteği katmanları">
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
                    <span>DNA Research</span>
                    <strong>Proje çalışma dosyası</strong>
                  </div>
                </div>
                <span className={styles.panelStatus}>Metodolojik yol haritası</span>
              </div>

              <div className={styles.networkLayers}>
                {projectLayers.map(({ number, title, text, Icon, tone }) => (
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
                <GraduationCap size={18} strokeWidth={2} aria-hidden="true" />
                <span>Araştırma fikrinden savunulabilir bilimsel çıktıya</span>
                <FileCheck2 size={17} strokeWidth={2} aria-hidden="true" />
              </div>
            </div>
          </div>

          <div className={styles.heroFlow} aria-label="Proje desteği kısa akışı">
            {[
              ["01", "Soruyu daralt"],
              ["02", "Yöntemi kur"],
              ["03", "Veriyi planla"],
              ["04", "Çıktıyı yapılandır"],
            ].map(([number, label]) => (
              <div key={number}>
                <span>{number}</span>
                <strong>{label}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.safeguards} aria-labelledby="decisions-title">
          <div className={styles.sectionIntro}>
            <span className={styles.kicker}>DÖRT KRİTİK KARAR</span>
            <h2 id="decisions-title">Güçlü proje, yöntem başlamadan önce kurulur.</h2>
            <p>
              Desteğin amacı metni sonradan düzeltmek değil; soruyu, yöntemi, veriyi ve bilimsel anlatıyı baştan
              aynı hedefe bağlamaktır.
            </p>
          </div>

          <div className={styles.safeguardList}>
            {decisions.map(({ number, eyebrow, title, text, Icon }) => (
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

        <section className={styles.processSection} id="project-flow" aria-labelledby="project-flow-title">
          <div className={styles.processInner}>
            <div className={styles.processHeading}>
              <span className={styles.kicker}>ÇALIŞMA MODELİ</span>
              <h2 id="project-flow-title">Fikirden teslim edilebilir araştırma çıktısına.</h2>
              <p>Her aşama önceki kararları korur; proje ilerledikçe yöntem ve anlatı birbirinden kopmaz.</p>
            </div>

            <div className={styles.processGrid}>
              {projectSteps.map(({ number, title, text, Icon }) => (
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

        <section className={styles.boundaries} aria-labelledby="scope-title">
          <div className={styles.boundaryHeading}>
            <span className={styles.kicker}>NET ROLLER</span>
            <h2 id="scope-title">Destek kapsamı ve akademik sorumluluk birbirinden ayrıdır.</h2>
          </div>

          <div className={styles.boundaryColumns}>
            <article>
              <div className={styles.boundaryTitle}>
                <span className={styles.positiveIcon} aria-hidden="true">
                  <Check size={19} strokeWidth={2.5} />
                </span>
                <h3>Destek ne sağlar?</h3>
              </div>
              <ul>
                {supportScope.map((item) => (
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
                <h3>Araştırmacının sorumluluğu</h3>
              </div>
              <ul>
                {researcherResponsibilities.map((item) => (
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
            <span className={styles.kicker}>PROJE GÖRÜŞMESİ</span>
            <h2>Araştırma fikrinizi birlikte netleştirelim.</h2>
            <p>
              Araştırma sorunuzu, proje kapsamınızı ve mevcut hazırlık düzeyinizi paylaşın; uygun destek hattını
              somut adımlarla belirleyelim.
            </p>
          </div>
          <div className={styles.ctaActions}>
            <Link className={styles.primaryButton} href="/iletisim">
              Proje desteği için görüşelim
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

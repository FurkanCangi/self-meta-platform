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
    text: "İncelenecek konuyu, katılımcı grubunu ve koşulları açıkça yazarız.",
    Icon: Lightbulb,
    tone: "cyan",
  },
  {
    number: "02",
    title: "Yöntem planı",
    text: "Katılımcıları, ölçüm araçlarını ve değerlendirme yöntemini araştırma sorusuna göre seçeriz.",
    Icon: ClipboardCheck,
    tone: "blue",
  },
  {
    number: "03",
    title: "Sonuçların yorumu",
    text: "Sonuçları güçlü ve sınırlı yönleriyle birlikte inceleriz.",
    Icon: BarChart3,
    tone: "violet",
  },
  {
    number: "04",
    title: "Çalışmanın yazılması",
    text: "Sonuçlar tez, proje raporu, makale veya sunum biçiminde yazılır.",
    Icon: BookOpenCheck,
    tone: "indigo",
  },
];

const decisions = [
  {
    number: "01",
    eyebrow: "Araştırma sorusu",
    title: "Klinikte merak edilen konuyu açık bir araştırma sorusuna dönüştürürüz.",
    text: "Araştırmanın amacını, kapsamını ve değerlendirilecek bilgileri baştan kararlaştırırız.",
    Icon: Target,
  },
  {
    number: "02",
    eyebrow: "Yöntem planı",
    title: "Araştırmanın yöntemi, soruya uygun olmalıdır.",
    text: "Çalışmaya kimlerin katılacağını, hangi ölçümlerin yapılacağını ve sonuçları nasıl karşılaştıracağımızı birlikte seçeriz.",
    Icon: Route,
  },
  {
    number: "03",
    eyebrow: "Toplanacak bilgiler",
    title: "Yalnızca araştırma için gerekli bilgiler toplanır.",
    text: "Araştırma başlamadan hangi bilgileri toplayacağımızı ve sonuçları nasıl değerlendireceğimizi yazarız.",
    Icon: ScanSearch,
  },
  {
    number: "04",
    eyebrow: "Sonuçların yazılması",
    title: "Yorumlar araştırma sonuçlarına dayanır.",
    text: "Sonuçlar abartılmadan yazılır; çalışmanın güçlü ve sınırlı yönleri açıkça belirtilir.",
    Icon: FileText,
  },
];

const projectSteps = [
  {
    number: "01",
    title: "İlk görüşme",
    text: "Araştırma fikri, başvuru yapılacak program ve mevcut hazırlıklar konuşulur.",
    Icon: GraduationCap,
  },
  {
    number: "02",
    title: "Konunun sınırları",
    text: "Araştırma sorusunu ve yapılabilecek çalışmanın kapsamını birlikte netleştiririz.",
    Icon: Target,
  },
  {
    number: "03",
    title: "Yöntemin hazırlanması",
    text: "Katılımcıları, ölçüm araçlarını, veri toplama adımlarını ve değerlendirme yöntemini birlikte seçeriz.",
    Icon: ListChecks,
  },
  {
    number: "04",
    title: "Sonuçların değerlendirilmesi",
    text: "Bulgular, çalışmanın yöntemi ve sınırlılıkları dikkate alınarak yorumlanır.",
    Icon: BarChart3,
  },
  {
    number: "05",
    title: "Çalışmanın yazılması",
    text: "Tezi, raporu, makale taslağını veya sunumu açık ve tutarlı bir sırayla düzenleriz.",
    Icon: FileCheck2,
  },
];

const supportScope = [
  "Araştırma sorusunu ve hipotezleri belirleme",
  "Katılımcı, ölçüm aracı ve veri toplama planını hazırlama",
  "Toplanacak bilgiler ile değerlendirme yöntemini eşleştirme",
  "Bulguları araştırmanın sınırları içinde yorumlama",
];

const researcherResponsibilities = [
  "Etik kurul ve kurum izinlerini alma",
  "Verileri belirlenen yönteme göre toplama",
  "Kayıtların doğruluğunu ve kaynaklarını koruma",
  "Son metni kontrol etme ve teslim etme",
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
                Araştırma sorunuzu belirleyin. <span>Yönteminizi planlayın.</span> Çalışmanızı tamamlayın.
              </h1>
              <p>
                Yüksek lisans, doktora, TÜBİTAK ve diğer araştırma projelerinde; araştırma sorusunu belirleme,
                yöntem seçme, veri toplama ve sonuçları yazma aşamalarında destek verilir.
              </p>
              <div className={styles.heroActions}>
                <a className={styles.primaryButton} href="#project-flow">
                  Nasıl çalıştığımızı görün
                  <ArrowDown size={18} strokeWidth={2.3} />
                </a>
                <Link className={styles.textButton} href="/iletisim">
                  Projenizi paylaşın
                  <ArrowRight size={18} strokeWidth={2.3} />
                </Link>
              </div>
            </div>

            <div className={styles.networkPanel} aria-label="Tez ve proje desteği bileşenleri">
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
                    <span>DNA Araştırma</span>
                    <strong>Proje planı</strong>
                  </div>
                </div>
                <span className={styles.panelStatus}>Adımlar belirlendi</span>
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
                <span>Araştırma fikrinden tamamlanmış tez, rapor veya makaleye</span>
                <FileCheck2 size={17} strokeWidth={2} aria-hidden="true" />
              </div>
            </div>
          </div>

          <div className={styles.heroFlow} aria-label="Proje desteği kısa akışı">
            {[
              ["01", "Soruyu belirle"],
              ["02", "Yöntemi planla"],
              ["03", "Veriyi topla"],
              ["04", "Çalışmayı yaz"],
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
            <span className={styles.kicker}>PROJE BAŞLAMADAN BELİRLENECEK DÖRT KONU</span>
            <h2 id="decisions-title">İyi bir araştırma, veri toplamadan önce doğru soruyla ve uygun yöntemle başlar.</h2>
            <p>
              Çalışma başlamadan önce sorunun kapsamını, katılımcıları, ölçüm araçlarını ve değerlendirme yöntemini kararlaştırırız.
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
              <span className={styles.kicker}>NASIL ÇALIŞIYORUZ?</span>
              <h2 id="project-flow-title">Proje fikrinden tamamlanmış çalışmaya beş adım.</h2>
              <p>Her aşamada alınan kararlar yeniden kontrol edilir. Böylece yöntem, sonuçlar ve yazılan metin birbiriyle çelişmez.</p>
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
            <span className={styles.kicker}>DESTEK VE SORUMLULUKLAR</span>
            <h2 id="scope-title">Hangi konularda destek vereceğimizi ve araştırmacının hangi işleri yürüteceğini baştan konuşuruz.</h2>
          </div>

          <div className={styles.boundaryColumns}>
            <article>
              <div className={styles.boundaryTitle}>
                <span className={styles.positiveIcon} aria-hidden="true">
                  <Check size={19} strokeWidth={2.5} />
                </span>
                <h3>Hangi konularda destek verilir?</h3>
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
                <h3>Araştırmacının yapması gerekenler</h3>
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
            <h2>Projeniz hangi aşamada olursa olsun birlikte değerlendirebiliriz.</h2>
            <p>
              Araştırma sorunuzu, mevcut hazırlıklarınızı ve ihtiyaç duyduğunuz desteği paylaşın. Sonraki adımları
              birlikte belirleyelim.
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

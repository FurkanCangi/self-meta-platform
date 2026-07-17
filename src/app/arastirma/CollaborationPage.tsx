import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BookOpenCheck,
  Check,
  ClipboardCheck,
  FileCheck2,
  Flag,
  Handshake,
  Network,
  Route,
  Scale,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import FooterContact from "../components/FooterContact";
import LandingHeader from "../components/LandingHeader";
import styles from "./DataNetworkPage.module.css";

const collaborationLayers = [
  {
    number: "01",
    title: "Ortak amaç",
    text: "Bilimsel soru ve hedef grup birlikte netleştirilir.",
    Icon: Target,
    tone: "cyan",
  },
  {
    number: "02",
    title: "Rol ve kaynaklar",
    text: "Ekiplerin katkısı, yetkisi ve sorumluluğu ayrılır.",
    Icon: Users,
    tone: "blue",
  },
  {
    number: "03",
    title: "Etik ve veri",
    text: "Onam, erişim ve kullanım sınırları tanımlanır.",
    Icon: ShieldCheck,
    tone: "violet",
  },
  {
    number: "04",
    title: "Ortak çıktı",
    text: "Analiz, yayın ve paylaşım planı aynı hatta kurulur.",
    Icon: FileCheck2,
    tone: "indigo",
  },
];

const foundations = [
  {
    number: "01",
    eyebrow: "Ortak yön",
    title: "Her ekip aynı araştırma sorusuna çalışır.",
    text: "İş birliğinin amacı, hedef grubu ve başarı ölçütü ilk görüşmede açık biçimde tanımlanır.",
    Icon: Target,
  },
  {
    number: "02",
    eyebrow: "Net roller",
    title: "Katkı, yetki ve sorumluluk birbirine karışmaz.",
    text: "Veri toplama, yöntem, analiz, koordinasyon ve yayın görevleri çalışma başlamadan taraflara dağıtılır.",
    Icon: Network,
  },
  {
    number: "03",
    eyebrow: "Etik çerçeve",
    title: "Veri kullanımı ve erişim sınırları baştan belirlenir.",
    text: "Onam, etik izin, gizlilik, güvenli saklama ve yetkili erişim koşulları ortak protokolün parçası olur.",
    Icon: ShieldCheck,
  },
  {
    number: "04",
    eyebrow: "Çıktı planı",
    title: "Bilimsel çıktı ve yayın sorumluluğu görünürdür.",
    text: "Analiz yaklaşımı, yazarlık ilkeleri, paylaşım biçimi ve çıktı takvimi çalışmanın başında kararlaştırılır.",
    Icon: BookOpenCheck,
  },
];

const collaborationSteps = [
  {
    number: "01",
    title: "Başvuru",
    text: "Kurum, ekip, araştırma fikri ve beklenen katkı paylaşılır.",
    Icon: Handshake,
  },
  {
    number: "02",
    title: "Uyum değerlendirmesi",
    text: "Bilimsel amaç, kapasite, takvim ve karşılıklı beklenti değerlendirilir.",
    Icon: Scale,
  },
  {
    number: "03",
    title: "Ortak protokol",
    text: "Yöntem, roller, veri yönetimi ve etik sınırlar yazılı hale getirilir.",
    Icon: ClipboardCheck,
  },
  {
    number: "04",
    title: "Kontrollü uygulama",
    text: "Ekipler belirlenen iş planında ilerler; karar ve değişiklik izi korunur.",
    Icon: Route,
  },
  {
    number: "05",
    title: "Ortak çıktı",
    text: "Bulgular doğrulanır; yayın, rapor veya eğitim çıktısı birlikte tamamlanır.",
    Icon: Flag,
  },
];

const collaborationScope = [
  "Üniversite ve lisansüstü araştırma iş birlikleri",
  "Araştırma gruplarıyla ortak yöntem ve veri üretimi",
  "Klinik ekiplerle uygulama temelli araştırma geliştirme",
  "Ölçek, eğitim ve çok merkezli çalışma planları",
];

const partnerResponsibilities = [
  "Kurum ve etik kurul izinlerini zamanında tamamlama",
  "Veri doğruluğunu ve katılımcı gizliliğini koruma",
  "Onaylanan protokol ve görev dağılımına uyma",
  "Yayın, yazarlık ve paylaşım ilkelerini gözetme",
];

export default function CollaborationPage() {
  return (
    <div className={styles.page}>
      <LandingHeader />

      <main>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <span className={styles.kicker}>AKADEMİK VE KLİNİK İŞ BİRLİKLERİ</span>
              <h1>
                Ortak hedefi belirleyin. <span>Rolleri netleştirin.</span> Birlikte üretin.
              </h1>
              <p>
                Üniversiteler, araştırma grupları ve klinik ekipler; bilimsel amaç, etik çerçeve ve veri
                sorumluluğu açık bir çalışma modeliyle aynı hatta buluşur.
              </p>
              <div className={styles.heroActions}>
                <a className={styles.primaryButton} href="#collaboration-flow">
                  Çalışma modelini incele
                  <ArrowDown size={18} strokeWidth={2.3} />
                </a>
                <Link className={styles.textButton} href="/iletisim">
                  İş birliği başvurusu
                  <ArrowRight size={18} strokeWidth={2.3} />
                </Link>
              </div>
            </div>

            <div className={styles.networkPanel} aria-label="DNA iş birliği çalışma modeli">
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
                    <span>DNA Collaboration</span>
                    <strong>Ortak çalışma dosyası</strong>
                  </div>
                </div>
                <span className={styles.panelStatus}>Amaç • rol • etik</span>
              </div>

              <div className={styles.networkLayers}>
                {collaborationLayers.map(({ number, title, text, Icon, tone }) => (
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
                <Handshake size={18} strokeWidth={2} aria-hidden="true" />
                <span>İlk görüşmeden izlenebilir ortak çıktıya</span>
                <ShieldCheck size={17} strokeWidth={2} aria-hidden="true" />
              </div>
            </div>
          </div>

          <div className={styles.heroFlow} aria-label="İş birliği kısa akışı">
            {[
              ["01", "Hedefi tanımla"],
              ["02", "Rolleri dağıt"],
              ["03", "Protokolü kur"],
              ["04", "Ortak çıktı üret"],
            ].map(([number, label]) => (
              <div key={number}>
                <span>{number}</span>
                <strong>{label}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.safeguards} aria-labelledby="foundations-title">
          <div className={styles.sectionIntro}>
            <span className={styles.kicker}>DÖRT TEMEL KARAR</span>
            <h2 id="foundations-title">Güçlü iş birliği, beklentiler netleştiğinde başlar.</h2>
            <p>
              Ortaklık yalnızca ekipleri bir araya getirmez. Bilimsel hedefi, sorumlulukları ve veri kullanımını
              herkes için görünür hale getirir.
            </p>
          </div>

          <div className={styles.safeguardList}>
            {foundations.map(({ number, eyebrow, title, text, Icon }) => (
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

        <section className={styles.processSection} id="collaboration-flow" aria-labelledby="collaboration-flow-title">
          <div className={styles.processInner}>
            <div className={styles.processHeading}>
              <span className={styles.kicker}>ÇALIŞMA MODELİ</span>
              <h2 id="collaboration-flow-title">Başvurudan ortak bilimsel çıktıya.</h2>
              <p>Her adım bir sonraki aşamanın kararlarını, veri güvenliğini ve ekip uyumunu güçlendirir.</p>
            </div>

            <div className={styles.processGrid}>
              {collaborationSteps.map(({ number, title, text, Icon }) => (
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

        <section className={styles.boundaries} aria-labelledby="roles-title">
          <div className={styles.boundaryHeading}>
            <span className={styles.kicker}>NET KAPSAM VE ROLLER</span>
            <h2 id="roles-title">İş birliği alanı ile tarafların sorumluluğu ayrıdır.</h2>
          </div>

          <div className={styles.boundaryColumns}>
            <article>
              <div className={styles.boundaryTitle}>
                <span className={styles.positiveIcon} aria-hidden="true">
                  <Check size={19} strokeWidth={2.5} />
                </span>
                <h3>Ortak çalışma alanı</h3>
              </div>
              <ul>
                {collaborationScope.map((item) => (
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
                  <ShieldCheck size={19} strokeWidth={2.3} />
                </span>
                <h3>Tarafların sorumluluğu</h3>
              </div>
              <ul>
                {partnerResponsibilities.map((item) => (
                  <li key={item}>
                    <Check size={17} strokeWidth={2.3} aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className={styles.cta}>
          <div>
            <span className={styles.kicker}>İŞ BİRLİĞİ GÖRÜŞMESİ</span>
            <h2>Birlikte çalışabileceğimiz bir araştırma fikriniz mi var?</h2>
            <p>
              Kurumunuzu, ekibinizi, araştırma amacınızı ve beklediğiniz katkıyı paylaşın; uygun ortaklık modelini
              somut adımlarla netleştirelim.
            </p>
          </div>
          <div className={styles.ctaActions}>
            <Link className={styles.primaryButton} href="/iletisim">
              İş birliği için görüşelim
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

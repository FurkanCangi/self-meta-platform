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
    title: "Ortak hedef",
    text: "Tüm ekipler aynı araştırma sorusuna yanıt arar.",
    Icon: Target,
    tone: "cyan",
  },
  {
    number: "02",
    title: "Görev paylaşımı",
    text: "Her ekip görevini ve hangi kararlardan sorumlu olduğunu bilir.",
    Icon: Users,
    tone: "blue",
  },
  {
    number: "03",
    title: "Veri güvenliği",
    text: "Ekipler veri toplama, saklama ve paylaşma kurallarını yazılı hale getirir.",
    Icon: ShieldCheck,
    tone: "violet",
  },
  {
    number: "04",
    title: "Tamamlanan çalışma",
    text: "Ekipler raporu, yayını veya eğitim materyalini birlikte hazırlar.",
    Icon: FileCheck2,
    tone: "indigo",
  },
];

const foundations = [
  {
    number: "01",
    eyebrow: "Ortak soru",
    title: "Bütün ekipler aynı araştırma sorusu üzerinde çalışır.",
    text: "İlk görüşmede çalışmanın amacını, kapsamını ve takvimini konuşuruz.",
    Icon: Target,
  },
  {
    number: "02",
    eyebrow: "Görev paylaşımı",
    title: "Her ekip görevini çalışma başlamadan bilir.",
    text: "Veri toplama, değerlendirme, koordinasyon ve yazım görevlerini baştan paylaşırız.",
    Icon: Network,
  },
  {
    number: "03",
    eyebrow: "Gizlilik ve erişim",
    title: "Veriye erişecek kişileri ve kullanım amacını baştan yazarız.",
    text: "Onam, etik izin, gizlilik, güvenli saklama ve erişim koşullarını açıkça kaydederiz.",
    Icon: ShieldCheck,
  },
  {
    number: "04",
    eyebrow: "Yayın planı",
    title: "Yazım ve yayın görevleri baştan paylaşılır.",
    text: "Sonuçları nasıl değerlendireceğimizi, metni kimlerin yazacağını ve yayın takvimini baştan kararlaştırırız.",
    Icon: BookOpenCheck,
  },
];

const collaborationSteps = [
  {
    number: "01",
    title: "İlk görüşme",
    text: "Kurum, ekip, araştırma fikri ve beklenen katkı paylaşılır.",
    Icon: Handshake,
  },
  {
    number: "02",
    title: "İlk değerlendirme",
    text: "Araştırmanın amacı, ekiplerin yapabilecekleri, takvim ve beklentiler konuşulur.",
    Icon: Scale,
  },
  {
    number: "03",
    title: "Görevlerin belirlenmesi",
    text: "Yöntem, görevler, veri güvenliği ve etik kurallar yazılı hale getirilir.",
    Icon: ClipboardCheck,
  },
  {
    number: "04",
    title: "Çalışmanın yürütülmesi",
    text: "Ekipler belirlenen plana göre ilerler; alınan kararlar ve yapılan değişiklikler kaydedilir.",
    Icon: Route,
  },
  {
    number: "05",
    title: "Sonucun paylaşılması",
    text: "Sonuçlar yeniden kontrol edilir; yayın, rapor veya eğitim materyali birlikte tamamlanır.",
    Icon: Flag,
  },
];

const collaborationScope = [
  "Üniversite ve lisansüstü araştırma iş birlikleri",
  "Araştırma gruplarıyla ortak yöntem belirleme ve veri toplama",
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
                Ortak hedefi belirleyin. <span>Görevleri paylaşın.</span> Çalışmayı birlikte tamamlayın.
              </h1>
              <p>
                Üniversiteler, araştırma grupları ve klinik ekipler araştırmanın amacını, görevleri, veri güvenliği
                kurallarını ve yayın planını birlikte hazırlar.
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
                    <strong>Ortak çalışma planı</strong>
                  </div>
                </div>
                <span className={styles.panelStatus}>Hedef ve görevler belirlendi</span>
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
                <span>İlk görüşmeden ortak rapor veya yayına</span>
                <ShieldCheck size={17} strokeWidth={2} aria-hidden="true" />
              </div>
            </div>
          </div>

          <div className={styles.heroFlow} aria-label="İş birliği kısa akışı">
            {[
              ["01", "Hedefi belirle"],
              ["02", "Görevleri paylaş"],
              ["03", "Kuralları yaz"],
              ["04", "Çalışmayı tamamla"],
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
            <span className={styles.kicker}>ÇALIŞMA BAŞLAMADAN BELİRLENECEKLER</span>
            <h2 id="foundations-title">Çalışmaya başlamadan önce hedefleri ve sorumlulukları birlikte kararlaştırırız.</h2>
            <p>
              Her ekip ne yapacağını, hangi bilgilere erişeceğini ve sonuçların nasıl paylaşılacağını baştan bilir.
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
              <span className={styles.kicker}>NASIL ÇALIŞIYORUZ?</span>
              <h2 id="collaboration-flow-title">İlk görüşmeden tamamlanmış ortak çalışmaya beş adım.</h2>
              <p>Araştırma sorusunu, görevleri, veri güvenliği kurallarını ve yayın planını adım adım kararlaştırırız.</p>
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
            <span className={styles.kicker}>KAPSAM VE SORUMLULUKLAR</span>
            <h2 id="roles-title">Neleri birlikte yapacağımızı ve her ekibin sorumluluğunu açıkça yazarız.</h2>
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
            <h2>Birlikte yürütmek istediğiniz bir araştırma var mı?</h2>
            <p>
              Kurumunuzu, ekibinizi, araştırma amacınızı ve ihtiyaç duyduğunuz desteği paylaşın. Nasıl
              çalışabileceğimizi birlikte belirleyelim.
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

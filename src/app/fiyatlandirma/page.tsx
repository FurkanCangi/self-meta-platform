import Link from "next/link";
import {
  ArrowRight,
  Award,
  CheckCircle2,
  CreditCard,
  FileText,
  GraduationCap,
  LockKeyhole,
  Mail,
  Monitor,
  Receipt,
  ShieldCheck,
  User,
} from "lucide-react";
import FooterContact from "../components/FooterContact";
import LandingHeader from "../components/LandingHeader";
import styles from "./page.module.css";

const included = [
  "40 saatlik DNA Intelligence eğitim programı",
  "Sertifika programı",
  "Platform erişimi",
  "5 rapor hakkı",
  "Eğitim güncellemelerine erişim",
];

const summaryItems = [
  { label: "Program ücreti", value: "10.000 TL" },
  { label: "KDV / fatura", value: "Satın alma sırasında hesaplanır" },
  { label: "Ek rapor paketi", value: "Panel içinde ayrıca alınır" },
];

const highlights = [
  { title: "40 Saat Eğitim", icon: GraduationCap },
  { title: "Platform Erişimi", icon: Monitor },
  { title: "5 Klinik Rapor", icon: FileText },
  { title: "Sertifika", icon: Award },
];

export default function FiyatlandirmaPage() {
  return (
    <div className={styles.page}>
      <LandingHeader />
      <main className={styles.checkoutPage}>
        <section className={styles.checkoutHero}>
          <div className={styles.copyCol}>
            <div className={styles.label} lang="en">DNA INTELLIGENCE SATIN ALMA</div>
            <h1>DNA Intelligence eğitim programına kayıt olun.</h1>
            <p>
              İlk satın alım; 40 saatlik eğitimi, platform erişimini, sertifikayı ve 5 rapor hakkını içeren tek seferlik program kaydıdır.
            </p>
            <div className={styles.highlightGrid}>
              {highlights.map(({ title, icon: Icon }) => (
                <div className={styles.highlight} key={title}>
                  <Icon size={22} strokeWidth={1.9} />
                  <span>{title}</span>
                </div>
              ))}
            </div>
          </div>

          <aside className={styles.orderCard} aria-label="Sipariş özeti">
            <div className={styles.orderTop}>
              <div>
                <span>Tek Seferlik Kayıt</span>
                <h2>DNA Intelligence Programı</h2>
              </div>
              <div className={styles.receiptIcon}>
                <Receipt size={26} strokeWidth={1.9} />
              </div>
            </div>
            <div className={styles.amount}>10.000 TL</div>
            <ul className={styles.includedList}>
              {included.map((item) => (
                <li key={item}>
                  <CheckCircle2 size={18} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className={styles.secureNote}>
              <LockKeyhole size={15} />
              Güvenli ödeme
            </div>
          </aside>
        </section>

        <section className={styles.checkoutGrid}>
          <form className={styles.paymentForm}>
            <div className={styles.formHead}>
              <div className={styles.formIcon}>
                <CreditCard size={24} strokeWidth={1.9} />
              </div>
              <div>
                <h2>Ödeme Bilgileri</h2>
                <p>Kayıt ve fatura bilgilerinizi girerek program satın alımını tamamlayın.</p>
              </div>
            </div>

            <div className={styles.fieldGrid}>
              <label>
                <span>Ad Soyad</span>
                <div className={styles.inputWrap}>
                  <User size={18} />
                  <input type="text" placeholder="Ad Soyad" autoComplete="name" />
                </div>
              </label>
              <label>
                <span>E-posta</span>
                <div className={styles.inputWrap}>
                  <Mail size={18} />
                  <input type="email" placeholder="mail@ornek.com" autoComplete="email" />
                </div>
              </label>
            </div>

            <label>
              <span>Kart Üzerindeki İsim</span>
              <input type="text" placeholder="Ad Soyad" autoComplete="cc-name" />
            </label>

            <label>
              <span>Kart Numarası</span>
              <input type="text" inputMode="numeric" placeholder="•••• •••• •••• ••••" autoComplete="cc-number" />
            </label>

            <div className={styles.fieldGrid}>
              <label>
                <span>Son Kullanma</span>
                <input type="text" inputMode="numeric" placeholder="AA / YY" autoComplete="cc-exp" />
              </label>
              <label>
                <span>CVC</span>
                <input type="text" inputMode="numeric" placeholder="•••" autoComplete="cc-csc" />
              </label>
            </div>

            <button type="button" className={styles.payButton}>
              10.000 TL Öde
              <ArrowRight size={18} />
            </button>

            <div className={styles.paymentNote}>
              <ShieldCheck size={18} />
              Kart bilgileriniz güvenli ödeme sağlayıcısı üzerinden işlenir. DNA Intelligence kart verisini saklamaz.
            </div>
          </form>

          <aside className={styles.summaryCard}>
            <h2>Sipariş Özeti</h2>
            <div className={styles.summaryRows}>
              {summaryItems.map((item) => (
                <div className={styles.summaryRow} key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
            <div className={styles.totalRow}>
              <span>Toplam</span>
              <strong>10.000 TL</strong>
            </div>
            <p>
              Ek test ve rapor paketleri ilk satın alıma dahil değildir. Program kaydından sonra terapist paneli içinden ayrıca satın alınır.
            </p>
            <Link href="/login" className={styles.secondaryLink}>
              Hesabınız varsa giriş yapın
            </Link>
          </aside>
        </section>
      </main>
      <FooterContact />
    </div>
  );
}

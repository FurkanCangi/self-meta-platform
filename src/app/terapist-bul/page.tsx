import FooterContact from "../components/FooterContact"
import LandingHeader from "../components/LandingHeader"
import TherapistDirectoryClient from "./TherapistDirectoryClient"
import styles from "./page.module.css"

export const metadata = {
  title: "Terapist Bul | DNA Intelligence",
  description: "DNA eğitimini tamamlayan ve public görünürlük onayı olan uzmanları şehir bazlı keşfedin.",
}

export default function TherapistDirectoryPage() {
  return (
    <div className={styles.page}>
      <LandingHeader />
      <main className={styles.main}>
        <section className={styles.hero}>
          <div>
            <div className={styles.label}>TERAPİST BUL</div>
            <h1>DNA eğitimini tamamlayan uzmanları şehir bazlı keşfedin.</h1>
            <p>
              Eğitimi tamamlanan, görünürlük izni veren ve onay süreci tamamlanan uzmanları DNA şehir haritası
              üzerinden inceleyin.
            </p>
          </div>
          <div className={styles.heroCard}>
            <span>Public dizin</span>
            <strong>Şehir · Meslek · Kurum · İletişim</strong>
            <p>Harita gerçek konum takibi yapmaz; şehir bazlı bilgilendirme sunar.</p>
          </div>
        </section>

        <TherapistDirectoryClient />
      </main>
      <FooterContact />
    </div>
  )
}

import { GraduationCap, MapPinned, ShieldCheck } from "lucide-react"
import FooterContact from "../components/FooterContact"
import LandingHeader from "../components/LandingHeader"
import TherapistDirectoryClient from "./TherapistDirectoryClient"
import styles from "./page.module.css"

export const metadata = {
  title: "Terapist Bul | DNA Intelligence",
  description: "DNA eğitimini tamamlayan ve profilini yayımlamayı seçen uzmanları şehir ve uzmanlık alanına göre bulun.",
}

export default function TherapistDirectoryPage() {
  return (
    <div className={styles.page}>
      <LandingHeader />
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.label}>DNA Uzman Ağı</div>
            <h1>Size uygun uzmanı haritada bulun.</h1>
            <p>Şehir, meslek ve uzmanlık alanına göre arayın; uzmanların profil bilgilerini karşılaştırın.</p>
          </div>
          <div className={styles.heroFacts} aria-label="Uzman dizini özellikleri">
            <span>
              <MapPinned size={20} />
              <strong>Haritada görün</strong>
              Şehre göre arayın.
            </span>
            <span>
              <GraduationCap size={20} />
              <strong>Eğitim tamamlandı</strong>
              Listelenen uzmanlar DNA eğitimini tamamlamıştır.
            </span>
            <span>
              <ShieldCheck size={20} />
              <strong>Yayın izni var</strong>
              Yalnızca yayımlanmasına izin verilen profiller gösterilir.
            </span>
          </div>
        </section>

        <TherapistDirectoryClient />
      </main>
      <FooterContact />
    </div>
  )
}

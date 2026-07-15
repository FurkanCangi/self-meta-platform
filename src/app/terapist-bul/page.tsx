import { GraduationCap, MapPinned, ShieldCheck } from "lucide-react"
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
          <div className={styles.heroCopy}>
            <div className={styles.label}>DNA Uzman Ağı</div>
            <h1>Size uygun uzmanı harita üzerinde keşfedin.</h1>
            <p>Şehir, meslek ve uzmanlık alanına göre arayın; profilleri tek ekranda karşılaştırın.</p>
          </div>
          <div className={styles.heroFacts} aria-label="Uzman dizini özellikleri">
            <span>
              <MapPinned size={20} />
              <strong>Haritada keşfet</strong>
              Şehir bazlı sonuçları görün.
            </span>
            <span>
              <GraduationCap size={20} />
              <strong>Eğitim bilgisi</strong>
              DNA eğitim sürecini tamamlayanlar.
            </span>
            <span>
              <ShieldCheck size={20} />
              <strong>Onaylı yayın</strong>
              Yalnızca izin verilen profiller.
            </span>
          </div>
        </section>

        <TherapistDirectoryClient />
      </main>
      <FooterContact />
    </div>
  )
}

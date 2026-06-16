import { ChevronRight, ListFilter, Mail, PenLine, Phone, Send, UserRound } from "lucide-react";
import FooterContact from "../components/FooterContact";
import LandingHeader from "../components/LandingHeader";
import styles from "../marketing-pages.module.css";

export default function IletisimPage() {
  return (
    <div className={styles.page}>
      <LandingHeader />
      <main className={styles.main}>
        <section className={styles.contactPageHero}>
          <div className={styles.contactWave} aria-hidden="true" />

          <div className={styles.contactHeroCopy}>
            <div className={styles.contactEyebrow}>
              <Send size={16} strokeWidth={2.3} />
              <span>İletişim</span>
            </div>

            <h1>
              DNA Intelligence ile <span>iletişime geçin.</span>
            </h1>

            <div className={styles.contactAccentLine} aria-hidden="true" />

            <p>
              Sorularınızı, görüşlerinizi veya iş birliği taleplerinizi bize iletebilirsiniz. Ekibimiz en kısa sürede
              sizinle iletişime geçecektir.
            </p>

            <div className={styles.contactCards}>
              <a className={styles.contactInfoCard} href="mailto:self.metacognition.institute@gmail.com">
                <span className={styles.contactInfoIcon}>
                  <Mail size={25} strokeWidth={2.2} />
                </span>
                <span>
                  <strong>E-posta</strong>
                  <small>self.metacognition.institute@gmail.com</small>
                </span>
                <ChevronRight size={20} />
              </a>

              <a className={styles.contactInfoCard} href="tel:+905306766654">
                <span className={styles.contactInfoIcon}>
                  <Phone size={25} strokeWidth={2.2} />
                </span>
                <span>
                  <strong>Telefon</strong>
                  <small>+90 530 676 66 54</small>
                </span>
                <ChevronRight size={20} />
              </a>
            </div>
          </div>

          <form
            className={styles.contactFormPanel}
            action="mailto:self.metacognition.institute@gmail.com"
            method="post"
            encType="text/plain"
          >
            <div className={styles.contactFormIntro}>
              <span className={styles.contactFormIcon}>
                <Send size={34} strokeWidth={2.2} />
              </span>
              <span>
                <strong>Mesajınızı bize iletin</strong>
                <small>Formu doldurun, size dönüş yapalım.</small>
              </span>
            </div>

            <div className={styles.contactFormGrid}>
              <label className={styles.contactField}>
                <UserRound size={22} />
                <input name="ad-soyad" type="text" placeholder="Ad Soyad" autoComplete="name" />
              </label>

              <label className={styles.contactField}>
                <Mail size={22} />
                <input name="e-posta" type="email" placeholder="E-posta" autoComplete="email" />
              </label>

              <label className={`${styles.contactField} ${styles.contactFieldFull}`}>
                <ListFilter size={22} />
                <select name="konu" defaultValue="">
                  <option value="" disabled>
                    Konu seçin
                  </option>
                  <option>Kurumsal kullanım</option>
                  <option>Eğitim programı</option>
                  <option>AI raporlama</option>
                  <option>Akademik iş birliği</option>
                  <option>Diğer</option>
                </select>
              </label>

              <label className={`${styles.contactField} ${styles.contactTextarea} ${styles.contactFieldFull}`}>
                <PenLine size={22} />
                <textarea name="mesaj" placeholder="Mesajınız" />
              </label>
            </div>

            <button className={styles.contactSubmit} type="submit">
              <Send size={21} strokeWidth={2.2} />
              <span>Gönder</span>
            </button>
          </form>
        </section>
      </main>
      <FooterContact />
    </div>
  );
}

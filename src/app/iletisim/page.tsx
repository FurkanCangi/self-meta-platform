import { ArrowUpRight, Mail, Phone, Send } from "lucide-react";
import FooterContact from "../components/FooterContact";
import LandingHeader from "../components/LandingHeader";
import styles from "../marketing-pages.module.css";
import ContactForm from "./ContactForm";

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
              Eğitim, klinik kullanım, araştırma veya iş birliği konularındaki sorularınızı doğrudan ekibimize
              iletebilirsiniz.
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
                <ArrowUpRight size={20} />
              </a>

              <a className={styles.contactInfoCard} href="tel:+905306766654">
                <span className={styles.contactInfoIcon}>
                  <Phone size={25} strokeWidth={2.2} />
                </span>
                <span>
                  <strong>Telefon</strong>
                  <small>+90 530 676 66 54</small>
                </span>
                <ArrowUpRight size={20} />
              </a>
            </div>
          </div>

          <ContactForm />
        </section>
      </main>
      <FooterContact />
    </div>
  );
}

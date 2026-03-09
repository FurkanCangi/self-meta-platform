import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import styles from "./FooterContact.module.css";

export default function FooterContact() {
  return (
    <footer className={styles.wrap} id="iletisim">
      <div className={styles.panel}>
        <div className={styles.grid}>
          <div className={styles.brand}>
            <div className={styles.logoWord}>self<span className={styles.plus}>+</span></div>
          </div>

          <div>
            <div className={styles.colTitle}>Menü</div>
            <nav className={styles.links}>
              <a href="/self-regulasyon-nedir">SELF AI Nedir?</a>
              <a href="#terapistler">Terapistler için</a>
              <a href="#paketler">Fiyatlandırma</a>
              <a href="#iletisim">İletişim</a>
            </nav>
          </div>

          <div>
            <div className={styles.colTitle}>Sosyal Medya</div>
            <div className={styles.socialRow}>
              <a className={styles.sBtn} href="#" aria-label="Instagram">ig</a>
              <a className={styles.sBtn} href="#" aria-label="X">x</a>
              <a className={styles.sBtn} href="#" aria-label="LinkedIn">in</a>
              <a className={styles.sBtn} href="#" aria-label="YouTube">yt</a>
              <a className={styles.sBtn} href="#" aria-label="TikTok">tt</a>
            </div>
          </div>

          <div>
            <div className={styles.colTitle}>İletişim</div>
            <div className={styles.contact}>
              <div className={styles.cRow}>
                <Mail size={18} />
                <span>self.metacognition.institute@gmail.com</span>
              </div>
              <div className={styles.cRow}>
                <Phone size={18} />
                <span>0530 676 6654</span>
              </div>
              <div className={styles.cRow}>
                <MapPin size={18} />
                <span>Acıbadem mah. Zerrin sok. Bahtiyar Apartman 6/13 Üsküdar/İstanbul</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.hr} />

        <div className={styles.bottom}>
          <div>2025 Tüm Hakları Saklıdır © Self Metacognition Institute</div>
          <div className={styles.mini}>self<span className={styles.plusMini}>+</span></div>
        </div>
      </div>
    </footer>
  );
}

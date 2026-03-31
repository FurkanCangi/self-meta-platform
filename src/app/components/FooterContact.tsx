import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import {
  FaInstagram,
  FaLinkedinIn,
  FaTiktok,
  FaYoutube,
  FaXTwitter,
} from "react-icons/fa6";
import styles from "./FooterContact.module.css";

const socialLinks = [
  { label: "Instagram", href: "#", icon: FaInstagram },
  { label: "X", href: "#", icon: FaXTwitter },
  { label: "LinkedIn", href: "#", icon: FaLinkedinIn },
  { label: "YouTube", href: "#", icon: FaYoutube },
  { label: "TikTok", href: "#", icon: FaTiktok },
];

export default function FooterContact() {
  return (
    <footer className={styles.wrap} id="iletisim">
      <div className={styles.panel}>
        <div className={styles.grid}>
          <div className={styles.brand}>
            <div>
              <div className={styles.logoWord}>self<span className={styles.plus}>+</span></div>
              <p className={styles.brandText}>
                Çocuk odaklı self-regülasyon değerlendirmesi için sade, güvenli ve klinik akışa uyumlu dijital platform.
              </p>
            </div>
          </div>

          <div className={styles.column}>
            <div className={styles.colTitle}>Menü</div>
            <nav className={styles.links}>
              <a href="/self-regulasyon-nedir">Self AI Nedir?</a>
              <a href="/#terapistler">Terapistler İçin</a>
              <a href="/#paketler">Fiyatlandırma</a>
              <a href="/#iletisim">İletişim</a>
            </nav>
          </div>

          <div className={styles.column}>
            <div className={styles.colTitle}>Sosyal Medya</div>
            <div className={styles.socialRow}>
              {socialLinks.map(({ label, href, icon: Icon }) => (
                <a key={label} className={styles.sBtn} href={href} aria-label={label} title={label}>
                  <Icon size={17} />
                </a>
              ))}
            </div>
            <div className={styles.socialNote}>Bizi sosyal medyada takip edin.</div>
          </div>

          <div className={styles.column}>
            <div className={styles.colTitle}>İletişim</div>
            <div className={styles.contact}>
              <div className={styles.cRow}>
                <Mail size={18} />
                <a href="mailto:self.metacognition.institute@gmail.com">self.metacognition.institute@gmail.com</a>
              </div>
              <div className={styles.cRow}>
                <Phone size={18} />
                <a href="tel:+905306766654">0530 676 6654</a>
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
          <div className={styles.copy}>2025 Tüm Hakları Saklıdır © Self Metacognition Institute</div>
          <div className={styles.mini}>self<span className={styles.plusMini}>+</span></div>
        </div>
      </div>
    </footer>
  );
}

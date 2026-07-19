import Link from "next/link";
import { ChevronRight, Mail, MapPin, Phone } from "lucide-react";
import { FaLinkedinIn, FaYoutube, FaXTwitter } from "react-icons/fa6";
import BrandLogo from "./BrandLogo";
import styles from "./FooterContact.module.css";

const footerLinks = [
  { label: "Ana Sayfa", href: "/" },
  { label: "DNA Intelligence Nedir?", href: "/dna-nedir" },
  { label: "Çözümler", href: "/cozumler" },
  { label: "Araştırma", href: "/arastirma" },
  { label: "İletişim", href: "/iletisim" },
];

const solutionLinks = [
  "Eğitim Platformu",
  "Deterministik Örüntü Özeti",
  "Açıklanabilir Rapor Taslağı",
  "Terapist Kontrollü Değerlendirme",
  "Danışan Takip",
];

const socialLinks = [
  { label: "LinkedIn", href: "#", icon: FaLinkedinIn },
  { label: "X", href: "#", icon: FaXTwitter },
  { label: "YouTube", href: "#", icon: FaYoutube },
];

export default function FooterContact() {
  return (
    <footer className={styles.wrap} id="iletisim">
      <div className={styles.panel}>
        <div className={styles.footerGrid}>
          <div className={styles.brand}>
            <BrandLogo variant="footer" />
            <p className={styles.brandText}>
              Dynamic Neuro-Regulation Approach; klinik eğitim, değerlendirme ve uygulama çerçevesi sunar.
              DNA Intelligence ise değerlendirme verilerini yapılandıran ve terapist incelemesine açık deterministik rapor taslakları sunan ayrı bir dijital platformdur.
            </p>
          </div>

          <div>
            <div className={styles.kicker}>Menü</div>
            <nav className={styles.links} aria-label="Alt menü">
              {footerLinks.map((link) => (
                <Link href={link.href} key={link.href}>
                  <ChevronRight size={17} strokeWidth={2.6} />
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <div className={styles.kicker}>Çözümler</div>
            <nav className={styles.solutionLinks} aria-label="Alt çözümler menüsü">
              {solutionLinks.map((label) => (
                <Link href="/cozumler#ecosystem-solutions" key={label}>
                  <ChevronRight size={17} strokeWidth={2.6} />
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          <div className={styles.contactBlock}>
            <div className={styles.kicker}>İletişim</div>
            <div className={styles.contact}>
              <div className={styles.cRow}>
                <span className={styles.contactIcon}>
                  <Mail size={19} />
                </span>
                <a href="mailto:self.metacognition.institute@gmail.com">self.metacognition.institute@gmail.com</a>
              </div>
              <div className={styles.cRow}>
                <span className={styles.contactIcon}>
                  <Phone size={19} />
                </span>
                <a href="tel:+905306766654">+90 530 676 66 54</a>
              </div>
              <div className={styles.cRow}>
                <span className={styles.contactIcon}>
                  <MapPin size={19} />
                </span>
                <span>Acıbadem mah. Zerrin sok. Bahtiyar Apartman 6/13 Üsküdar/İstanbul</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.hr} />

        <div className={styles.bottom}>
          <div className={styles.copy}>© 2025 DNA Intelligence · Dynamic Neuro-Regulation Approach</div>
          <div className={styles.bottomRight}>
            <div className={styles.legalLinks}>
              <Link href="/terms">Şartlar</Link>
              <Link href="/privacy">Gizlilik</Link>
              <Link href="/kvkk">KVKK</Link>
              <Link href="/cerez-politikasi">Çerezler</Link>
            </div>
            <div className={styles.socialLinks} aria-label="Sosyal medya">
              {socialLinks.map(({ label, href, icon: Icon }) => (
                <a key={label} href={href} aria-label={label} title={label}>
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

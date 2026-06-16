import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import FooterContact from "../components/FooterContact";
import LandingHeader from "../components/LandingHeader";
import styles from "../marketing-pages.module.css";
import { researchPages } from "./researchContent";

export default function ArastirmaPage() {
  return (
    <div className={styles.page}>
      <LandingHeader />
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.eyebrow}>Araştırma</div>
          <h1>Bilimsel notlar, metodolojik destek ve ortak araştırma alanı.</h1>
          <p>
            Araştırma alanı; klinik uygulamaya dönük literatür notları, akademik iş birlikleri, tez ve proje desteği
            ile çok merkezli veri üretimini ürün geliştirme gündeminden ayrı bir bilimsel çerçevede toplar.
          </p>
        </section>

        <section className={styles.section}>
          <div className={styles.twoGrid}>
            {researchPages.map(({ slug, eyebrow, description, icon: Icon, accent }) => (
              <Link
                href={`/arastirma/${slug}`}
                className={styles.linkCard}
                key={slug}
                style={{ "--accent": accent } as CSSProperties}
              >
                <div className={styles.icon}>
                  <Icon size={28} strokeWidth={2} />
                </div>
                <h3>{eyebrow}</h3>
                <p>{description}</p>
                <span className={styles.cardAction}>
                  Detayları İncele
                  <ArrowRight size={17} strokeWidth={2.1} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.callout}>
          <h2>Araştırma sürecinizi bilimsel ve etik bir çerçevede yapılandıralım.</h2>
          <p>
            Literatür değerlendirmesi, yöntem planı, iş birliği modeli ve veri ağı çalışmaları için kontrollü bir
            araştırma zemini oluşturabiliriz.
          </p>
          <div className={styles.actions}>
            <a className={styles.primary} href="/arastirma/arastirma-notlari">Araştırma Notlarını Gör</a>
            <a className={styles.secondary} href="/arastirma/is-birlikleri">İş Birliği Alanı</a>
          </div>
        </section>
      </main>
      <FooterContact />
    </div>
  );
}

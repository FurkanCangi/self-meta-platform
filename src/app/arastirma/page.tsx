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
          <h1>Araştırma sorunuzu belirleyin, doğru yöntemi seçin ve sonuçları güvenilir kaynaklarla değerlendirin.</h1>
          <p>
            Araştırma özetlerini inceleyebilir; tez, proje, iş birliği ve farklı merkezlerden veri toplama konularında
            nasıl destek alabileceğinizi görebilirsiniz.
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
                  Sayfayı aç
                  <ArrowRight size={17} strokeWidth={2.1} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.callout}>
          <h2>Araştırmanızın hangi aşamasında desteğe ihtiyaç duyduğunuzu birlikte belirleyelim.</h2>
          <p>
            Kaynak taraması, araştırma yöntemi, iş birliği ve farklı merkezlerden veri toplama konularında
            ihtiyacınızı konuşabiliriz.
          </p>
          <div className={styles.actions}>
            <a className={styles.primary} href="/arastirma/arastirma-notlari">Araştırma notlarını gör</a>
            <a className={styles.secondary} href="/arastirma/is-birlikleri">İş birliği seçenekleri</a>
          </div>
        </section>
      </main>
      <FooterContact />
    </div>
  );
}

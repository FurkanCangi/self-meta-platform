import Image from "next/image";
import styles from "./LandingHeroV2.module.css";

export default function LandingHeroV2() {
  return (
    <section className={styles.wrap} id="home">
      <div className={styles.panel}>
        <div className={styles.inner}>
          <div className={styles.left}>
            <h1 className={styles.h1}>
              Yapay Zeka Destekli
              <br />
              Rehabilitasyon Çözümleri
            </h1>

            <p className={styles.p}>
              SELF AI, rehabilitasyonun her adımını daha yenilikçi ve erişilebilir kılan yapay
              zeka tabanlı bir deneyim sunar. Uzmanlar ve aileler için kişiye özel çözümlerle,
              değerlendirme ve müdahale süreçlerini bir üst seviyeye taşıyoruz.
            </p>

            <a className={styles.cta} href="#platform">
              Hemen Keşfet
            </a>

            <div className={styles.arrow} aria-hidden="true" />
          </div>

          <div className={styles.right}>
            <div className={styles.oval}>
              <div className={styles.ovalInner}>
                <Image
                  src="/images/landing-child.jpg"
                  alt="Çocuk aktivitesi"
                  fill
                  priority
                  className={styles.img}
                />
              </div>
            </div>

            <div className={styles.starTop} aria-hidden="true" />
            <div className={styles.starBottom} aria-hidden="true" />
            <div className={styles.bubbleA} aria-hidden="true" />
            <div className={styles.bubbleB} aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}

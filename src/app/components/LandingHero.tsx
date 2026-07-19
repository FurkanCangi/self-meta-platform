import Image from "next/image";
import Link from "next/link";
import styles from "./LandingHero.module.css";

export default function LandingHero() {
  return (
    <section className={styles.heroWrap}>
      <div className={styles.heroPanel}>
        <div className={styles.heroInner}>
          <div className={styles.left}>
            <h1 className={styles.h1}>
              Değerlendirme, rapor
              <br />
              ve takip işlemlerini
              <br />
              tek panelde yönetin
            </h1>

            <p className={styles.p}>
              Test sonuçlarını, anamnez bilgilerini ve gözlem notlarını aynı yerde toplayın;
              rapor taslağını hazırlayın ve danışan kayıtlarını takip edin.
            </p>

            <div className={styles.ctaRow}>
              <Link href="/fiyatlandirma" className={styles.btnPrimary}>
                Paketleri incele <span className={styles.arrow}>→</span>
              </Link>
              <Link href="/login" className={styles.btnGhost}>
                Giriş Yap
              </Link>
            </div>

            <ul className={styles.bullets}>
              <li>Danışan kayıtları, test sonuçları ve raporlar tek yerde</li>
              <li>Rapor taslağını terapist inceler ve düzenler</li>
              <li>Önceki raporları ve değişiklikleri görüntüleyin</li>
            </ul>
          </div>

          <div className={styles.right}>
            <div className={styles.frame}>
              <div className={styles.frameInner}>
                <Image
                  src="/images/landing-child.jpg"
                  alt="Landing visual"
                  fill sizes="(max-width: 768px) 100vw, 50vw"
                  className={styles.img}
                  priority
                />
              </div>
            </div>

            <div className={styles.star1} />
            <div className={styles.star2} />
            <div className={styles.dots} />
          </div>
        </div>
      </div>
    </section>
  );
}

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
              Klinik değerlendirme, skor
              <br />
              ve rapor süreçlerini
              <br />
              tek panelde yönetin
            </h1>

            <p className={styles.p}>
              Self Meta AI; yapılandırılmış anamnez, alt boyut skor girişi ve versiyonlu klinik
              raporlamayı terapist odaklı sade bir akışta birleştirir.
            </p>

            <div className={styles.ctaRow}>
              <Link href="/pricing" className={styles.btnPrimary}>
                Paketleri incele <span className={styles.arrow}>→</span>
              </Link>
              <Link href="/login" className={styles.btnGhost}>
                Terapist Panelini Gör
              </Link>
            </div>

            <ul className={styles.bullets}>
              <li>Tek panelde kayıt, skor ve rapor akışı</li>
              <li>Terapist kontrolünde klinik işleyiş</li>
              <li>Versiyonlu ve izlenebilir rapor mantığı</li>
            </ul>
          </div>

          <div className={styles.right}>
            <div className={styles.frame}>
              <div className={styles.frameInner}>
                <Image
                  src="/images/landing-child.jpg"
                  alt="Landing visual"
                  fill
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

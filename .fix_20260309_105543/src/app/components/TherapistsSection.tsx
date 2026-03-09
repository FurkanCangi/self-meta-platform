import Image from "next/image";
import { BarChart3, ListChecks, BookOpen, Target } from "lucide-react";
import styles from "./TherapistsSection.module.css";

const items = [
  { icon: BarChart3, title: "Klinik Değerlendirme Ölçekleri" },
  { icon: ListChecks, title: "Hedef Takibi ve Raporlama" },
  { icon: BookOpen, title: "Akademik Blog" },
  { icon: Target, title: "Teorik Eğitimler" },
];

export default function TherapistsSection() {
  return (
    <section className={styles.wrap} id="terapistler">
      <div className={styles.inner}>
        <div className={styles.left}>
                    <div className={styles.photo}>
            <Image
              src="/images/terapist.jpg"
              alt="Terapist görseli"
              fill
              className={styles.photoImg}
              priority
            />
          </div>
        </div>

        <div className={styles.right}>
          <h3 className={styles.h3}>Terapistler için Dijital Çözümler</h3>
          <p className={styles.p}>
            SELF AI, terapistlerin ihtiyaçlarına yönelik geliştirilen dijital çözümlerle, terapi süreçlerini daha
            verimli ve sistematik hale getirir. Klinik değerlendirme araçları, hedef takibi ve raporlama sistemi,
            ve teorik eğitimler gibi kapsamlı kaynaklarla, terapistlerin profesyonel gelişimlerine destek olur.
          </p>

          <div className={styles.list}>
            {items.map((it) => {
              const Icon = it.icon;
              return (
                <div key={it.title} className={styles.item}>
                  <div className={styles.bullet}>
                    <Icon size={22} />
                  </div>
                  <div className={styles.itemText}>{it.title}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

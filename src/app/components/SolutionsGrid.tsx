import { BarChart3, ListChecks, Target, BookOpen } from "lucide-react";
import styles from "./SolutionsGrid.module.css";

const items = [
  {
    icon: BarChart3,
    title: "Klinik Değerlendirme Ölçekleri",
    body:
      "Danışanların durumunu objektif bir şekilde değerlendirmek için, güvenilirliği ve geçerliliği olan standardize araçlar sunar.",
  },
  {
    icon: ListChecks,
    title: "Aktivite ve Ödev Takibi",
    body:
      "Klinik ve ev ortamına uygun olarak hazırlanmış aktivitelerle, danışanların gelişimini destekleyen ve süreci kolaylaştıran çözümler sunar.",
  },
  {
    icon: Target,
    title: "Hedef Takip Sistemi",
    body:
      "Hedeflerin kolayca belirlenmesini ve gelişim süreçlerinin takip edilmesini sağlar.",
  },
  {
    icon: BookOpen,
    title: "Teorik Eğitimler",
    body:
      "Güncel eğitimlerle, kapsamlı bir teorik altyapı sunarak alanındaki bilgi birikimini derinleştirme imkanı sağlar.",
  },
];

export default function SolutionsGrid() {
  return (
    <section className={styles.wrap} id="solutions">
      <div className={styles.inner}>
        <h2 className={styles.h2}>Sunduğumuz Çözümler</h2>

        <div className={styles.grid}>
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <article key={it.title} className={styles.card}>
                <div className={styles.icon}>
                  <Icon size={22} />
                </div>
                <div>
                  <div className={styles.title}>{it.title}</div>
                  <p className={styles.body}>{it.body}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

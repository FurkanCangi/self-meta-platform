"use client";

import { ClipboardCheck, FileText, ScanSearch, TrendingUp, Workflow } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import styles from "./SolutionsGrid.module.css";

const items = [
  {
    icon: ClipboardCheck,
    tone: "purple",
    title: "Değerlendirme",
    body: "Test sonuçlarını, anamnez bilgilerini ve gözlem notlarını aynı yerde görün.",
  },
  {
    icon: Workflow,
    tone: "blue",
    title: "Değerlendirme ve Planlama Eğitimi",
    body: "Eğitimde vaka değerlendirmeyi ve müdahale planlamayı öğrenin; yazılım terapi veya seans planı üretmez.",
  },
  {
    icon: TrendingUp,
    tone: "mint",
    title: "Gelişim Takibi",
    body: "Danışanın önceki ve yeni değerlendirmelerini karşılaştırın.",
  },
  {
    icon: FileText,
    tone: "orange",
    title: "Raporlama",
    body: "Sistem değerlendirme bilgilerinden bir rapor taslağı hazırlar. Taslağı terapist incelemesi ve düzenlemesinden sonra kaydedin veya paylaşın.",
  },
  {
    icon: ScanSearch,
    tone: "pink",
    title: "Video ve Görüntü İnceleme",
    body: "Video kayıtlarını inceleyin ve gözlem notlarınızı değerlendirmeye ekleyin.",
  },
];

export default function SolutionsGrid() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "-12% 0px -18%" },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className={`${styles.wrap} ${isVisible ? styles.visible : ""}`} id="solutions">
      <div className={styles.background} aria-hidden="true">
        <span className={styles.blobOne} />
        <span className={styles.blobTwo} />
        <span className={styles.blobThree} />
      </div>

      <div className={styles.inner}>
        <div className={styles.header}>
          <div className={styles.pill}>
            <span className={styles.pillIcon} />
            Sunduğumuz Çözümler
          </div>
          <h2 className={styles.h2}>Değerlendirme, rapor ve takip işlemlerini tek yerden yapın.</h2>
          <p className={styles.lead}>
            Test sonuçları, raporlar ve takip notları aynı yerde tutulur. Son değerlendirmeyi her zaman terapist yapar.
          </p>
        </div>

        <div className={styles.stage}>
          <div className={styles.chartPanel} aria-hidden="true">
            <span>Değerlendirme Özeti</span>
            <strong>86/100</strong>
            <div className={styles.miniChart}>
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>

          <div className={styles.profilePanel} aria-hidden="true">
            <div className={styles.profileAvatar} />
            <div>
              <span>Danışan Özeti</span>
              <i />
              <i />
            </div>
          </div>

          <svg className={styles.connectionLines} viewBox="0 0 1180 520" preserveAspectRatio="none" aria-hidden="true">
            <path d="M82 250 C220 150 355 344 505 218 S782 120 1058 250" />
            <path d="M110 345 C285 470 450 286 610 374 S884 484 1070 346" />
            <path d="M256 176 C418 86 554 160 668 260 S866 374 1040 152" />
          </svg>

          <div className={styles.grid}>
            {items.map((item, index) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className={`${styles.card} ${styles[item.tone]}`}
                  style={{ "--delay": `${index * 110}ms` } as CSSProperties}
                >
                  <div className={styles.iconWrap}>
                    <Icon size={36} strokeWidth={2.1} />
                  </div>
                  <div className={styles.cardText}>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

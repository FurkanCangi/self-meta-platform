"use client";

import {
  Award,
  BookOpen,
  BookOpenCheck,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  SlidersHorizontal,
  SquarePlay,
  Target,
  UsersRound,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import styles from "./TherapistsSection.module.css";

const educationModules = [
  {
    icon: BookOpen,
    number: "01",
    title: "Temel Model",
    body: "Dinamik Nöro-Regülasyon Yaklaşımı'nın kuramsal temelleri ve klinik çerçevesi.",
  },
  {
    icon: SlidersHorizontal,
    number: "02",
    title: "Regülasyon Alanları",
    body: "İnterosepsiyon, duygusal, duyusal, bilişsel ve yürütücü işlev alanlarını birlikte ele alır.",
  },
  {
    icon: ClipboardCheck,
    number: "03",
    title: "Değerlendirme Pratiği",
    body: "Ölçek, anamnez, gözlem ve vaka verisi ile bütüncül değerlendirme.",
  },
  {
    icon: Target,
    number: "04",
    title: "Müdahale Planlama",
    body: "Bulgulara dayalı hedefler belirleyin ve müdahale stratejilerinizi planlayın.",
  },
  {
    icon: Award,
    number: "05",
    title: "Sertifikasyon ve Uygulama",
    body: "Öğrendiklerinizi klinik pratiğe entegre edin ve sertifikanızı alın.",
  },
];

const educationHighlights = [
  {
    icon: BookOpen,
    title: "Kuramsal temel",
    body: "Yaklaşımın bilimsel temellerini ve klinik çerçevesini öğrenin.",
  },
  {
    icon: UsersRound,
    title: "Vaka temelli öğrenme",
    body: "Gerçek vaka örnekleriyle klinik düşünme becerilerinizi geliştirin.",
  },
  {
    icon: SquarePlay,
    title: "Uygulama ve sertifikasyon",
    body: "Müdahale planlama becerilerinizi uygulayın ve sertifikanızı alın.",
  },
];

export default function TherapistsSection() {
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
      { rootMargin: "-10% 0px -18%" },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className={`${styles.wrap} ${isVisible ? styles.visible : ""}`} id="terapistler">
      <div className={styles.background} aria-hidden="true" />

      <div className={styles.inner}>
        <div className={styles.workflowLayer}>
          <div className={styles.story}>
            <div className={styles.pill}>
              <GraduationCap size={21} strokeWidth={2.2} />
              EĞİTİM PROGRAMI
            </div>
            <h2 className={styles.h2}>Önce yaklaşımı öğrenin.</h2>
            <strong className={styles.subhead}>40 saatlik yapılandırılmış eğitim programı</strong>
            <p className={styles.lead}>
              Dinamik Nöro-Regülasyon Yaklaşımı'nı; teori, vaka örnekleri, klinik düşünme, değerlendirme ve müdahale
              planlama süreçleri üzerinden bütüncül bir şekilde öğrenin.
            </p>

            <div className={styles.noteGrid}>
              {educationHighlights.map((note, index) => {
                const Icon = note.icon;
                return (
                  <div
                    className={styles.note}
                    key={note.title}
                    style={{ "--delay": `${index * 110 + 260}ms` } as CSSProperties}
                  >
                    <Icon size={22} strokeWidth={1.9} />
                    <div>
                      <strong>{note.title}</strong>
                      <span>{note.body}</span>
                    </div>
                    <ChevronRight size={25} strokeWidth={2.4} aria-hidden="true" />
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.flowMap}>
            <h3 className={styles.flowTitle}>Eğitim Modülleri</h3>

            <div className={styles.steps}>
              {educationModules.map((step, index) => {
                const Icon = step.icon;
                return (
                  <article
                    className={styles.step}
                    key={step.title}
                    style={{ "--delay": `${index * 85}ms` } as CSSProperties}
                  >
                    <div className={styles.stepNumber}>{step.number}</div>
                    <div className={styles.stepIcon}>
                      <Icon size={24} strokeWidth={1.9} />
                    </div>
                    <div className={styles.stepText}>
                      <h3>{step.title}</h3>
                      <p>{step.body}</p>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className={styles.flowFooter}>
              <span>Teori</span>
              <i aria-hidden="true">·</i>
              <span>Vaka</span>
              <i aria-hidden="true">·</i>
              <span>Uygulama</span>
              <i aria-hidden="true">·</i>
              <span>Sertifika</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

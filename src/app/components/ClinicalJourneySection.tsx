import Link from "next/link";
import {
  ArrowRight,
  ChartNoAxesColumnIncreasing,
  Check,
  ClipboardCheck,
  FileCheck2,
  Route,
  ScanSearch,
  Target,
} from "lucide-react";
import styles from "./ClinicalJourneySection.module.css";

const journeySteps = [
  {
    number: "01",
    title: "Değerlendirme",
    description: "Test sonuçlarını, anamnez bilgilerini ve klinik notları aynı yerde toplayın.",
    icon: ClipboardCheck,
    preview: "assessment",
  },
  {
    number: "02",
    title: "Sonuçları karşılaştırma",
    description: "Zorlanılan alanları ve daha güçlü performans gösterilen alanları karşılaştırın.",
    icon: ScanSearch,
    preview: "pattern",
  },
  {
    number: "03",
    title: "Terapist kontrolü",
    description: "Sonuçları bütün olarak inceleyin; klinik önceliği terapist belirler.",
    icon: Target,
    preview: "priority",
  },
  {
    number: "04",
    title: "Rapor ve takip",
    description: "Rapor taslağını inceleyip düzenleyin. Takipte kullanacağınız notları kaydedin.",
    icon: FileCheck2,
    preview: "report",
  },
] as const;

function StepPreview({ type }: { type: (typeof journeySteps)[number]["preview"] }) {
  if (type === "assessment") {
    return (
      <div className={styles.checklistPreview} aria-hidden="true">
        {[82, 66, 74].map((width, index) => (
          <div className={styles.checklistRow} key={width}>
            <span className={styles.checkIcon} data-tone={index}>
              <Check size={13} strokeWidth={3} />
            </span>
            <span className={styles.checkText}>
              <i style={{ width: `${width}%` }} />
              <i style={{ width: `${Math.max(width - 24, 34)}%` }} />
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (type === "pattern") {
    return (
      <div className={styles.patternPreview} aria-hidden="true">
        {[0, 1, 2, 3].map((row) => (
          <div className={styles.patternRow} key={row}>
            {Array.from({ length: 8 }).map((_, dot) => (
              <i key={dot} data-active={(dot + row) % 3 === 0 || (row === 1 && dot > 3)} />
            ))}
            <span />
          </div>
        ))}
      </div>
    );
  }

  if (type === "priority") {
    return (
      <div className={styles.priorityPreview} aria-hidden="true">
        {[88, 58, 72].map((width, index) => (
          <div className={styles.priorityRow} key={width}>
            <strong>{index + 1}</strong>
            <span>
              <i style={{ width: `${width}%` }} />
            </span>
            <em />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.reportPreview} aria-hidden="true">
      <div className={styles.reportHeader}>
        <span />
        <div>
          <i />
          <i />
        </div>
      </div>
      <div className={styles.reportStatus}>
        <FileCheck2 size={18} strokeWidth={2.5} />
        <span>
          <i />
          <i />
        </span>
      </div>
    </div>
  );
}

export default function ClinicalJourneySection() {
  return (
    <section className={styles.section} aria-labelledby="clinical-journey-title">
      <div className={styles.inner}>
        <div className={styles.eyebrow}>
          <Route size={18} strokeWidth={2.2} />
          Değerlendirmeden rapora
        </div>

        <header className={styles.header}>
          <h2 id="clinical-journey-title">Test, anamnez ve gözlem bilgilerini birlikte değerlendirin.</h2>
          <p>Sistem bilgileri tek yerde toplar ve rapor taslağı hazırlar. Terapist sonuçları inceler ve son kararını verir.</p>
        </header>

        <div className={styles.journey}>
          <div className={styles.connector} aria-hidden="true" />
          {journeySteps.map((step) => {
            const Icon = step.icon;

            return (
              <article className={styles.step} key={step.number}>
                <div className={styles.stepMarker}>
                  <div className={styles.iconRing}>
                    <Icon size={31} strokeWidth={1.9} />
                  </div>
                  <span>{step.number}</span>
                </div>

                <div className={styles.stepCopy}>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>

                <StepPreview type={step.preview} />
              </article>
            );
          })}
        </div>

        <div className={styles.actionRow}>
          <Link href="/dna-nedir/degerlendirme-sistemi" className={styles.action}>
            <ChartNoAxesColumnIncreasing size={19} strokeWidth={2.2} />
            Nasıl çalıştığını görün
            <ArrowRight size={20} strokeWidth={2.3} />
          </Link>
        </div>
      </div>
    </section>
  );
}

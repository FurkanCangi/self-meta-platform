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
    description: "Ölçek, anamnez ve klinik notlardan gelen veriyi tek yapıda düzenleyin.",
    icon: ClipboardCheck,
    preview: "assessment",
  },
  {
    number: "02",
    title: "Örüntü",
    description: "Dağınık bulgular arasındaki tekrarları ve alan ilişkilerini görünür kılın.",
    icon: ScanSearch,
    preview: "pattern",
  },
  {
    number: "03",
    title: "Klinik öncelik",
    description: "Müdahale kararını en anlamlı klinik alanlardan başlayarak sıralayın.",
    icon: Target,
    preview: "priority",
  },
  {
    number: "04",
    title: "Rapor ve takip",
    description: "Kararı okunabilir bir rapora taşıyın ve takip planını netleştirin.",
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
          Klinik yolculuk
        </div>

        <header className={styles.header}>
          <h2 id="clinical-journey-title">Bir vakadan net bir klinik karara.</h2>
          <p>Değerlendirme verisini düzenleyin, örüntüyü görün ve takip planını netleştirin.</p>
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
            Örnek akışı incele
            <ArrowRight size={20} strokeWidth={2.3} />
          </Link>
        </div>
      </div>
    </section>
  );
}

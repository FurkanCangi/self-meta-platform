import Link from "next/link"
import { ActivityPlayer } from "@/features/regulation-activity-lab/components/ActivityPlayer"
import { REGULATION_ACTIVITIES } from "./catalog"
import type { RegulationActivity } from "./types"
import styles from "./ActivityLabGallery.module.css"

const CARD_TONES = [
  styles.toneMint,
  styles.toneBlue,
  styles.toneLavender,
  styles.tonePeach,
  styles.toneSage,
] as const

const REVIEW_ACTIVITIES = REGULATION_ACTIVITIES.slice(0, 10)
const CARD_STOP_WARNING =
  "Ağrı, baş dönmesi, nefes güçlüğü, korku veya denge kaybında durdur."

function formatDuration(durationMs: number) {
  return `${Math.round(durationMs / 1000)} sn`
}

function getActivityNumber(activity: RegulationActivity) {
  return String(activity.order).padStart(2, "0")
}

function StaticActivityThumbnail({
  activity,
  tone,
}: {
  activity: RegulationActivity
  tone: string
}) {
  return (
    <div className={`${styles.thumbnail} ${tone}`} aria-hidden="true">
      <span className={styles.visualHalo} />
      <span className={styles.visualFloor} />
      <span className={styles.visualPerson}>
        <span className={styles.visualHead} />
        <span className={styles.visualBody} />
        <span className={styles.visualArmLeft} />
        <span className={styles.visualArmRight} />
        <span className={styles.visualLegLeft} />
        <span className={styles.visualLegRight} />
      </span>
      <span className={styles.visualCount}>{getActivityNumber(activity)}</span>
    </div>
  )
}

function ActivityCard({
  activity,
  index,
  selected,
}: {
  activity: RegulationActivity
  index: number
  selected: boolean
}) {
  const tone = CARD_TONES[index % CARD_TONES.length]

  return (
    <li className={styles.activityListItem}>
      <Link
        href={`/owner-audit/activity-lab?activity=${encodeURIComponent(activity.id)}#activity-lab-player`}
        className={styles.activityCard}
        aria-controls="activity-lab-player"
        aria-label={`${activity.title}. Oynatıcıda aç.`}
        aria-current={selected ? "true" : undefined}
        scroll
      >
        <StaticActivityThumbnail activity={activity} tone={tone} />
        <span className={styles.cardBody}>
          <span className={styles.cardMeta}>
            <span>Aktivite {getActivityNumber(activity)}</span>
            <span>{formatDuration(activity.durationMs)}</span>
          </span>
          <span className={styles.cardTitle}>{activity.shortLabel}</span>
          <span className={styles.cardCategory}>{activity.categoryLabel}</span>
          <span className={styles.cardInstruction}>{activity.instruction}</span>
          <span className={styles.cardMaterial}>
            <strong>Materyal:</strong>{" "}
            {activity.materials.map((material) => material.label).join(", ")}
          </span>
          <span className={styles.cardSupervision}>
            {activity.supervision.label}
          </span>
          <span className={styles.cardWarning}>{CARD_STOP_WARNING}</span>
          <span className={styles.cardSelection}>{selected ? "Oynatıcıda açık" : "Önizlemeyi aç"}</span>
        </span>
      </Link>
    </li>
  )
}

function EmptyCatalog() {
  return (
    <div className={styles.emptyState} role="status">
      <h1 className={styles.emptyTitle}>Aktivite taslakları henüz hazır değil</h1>
      <p className={styles.emptyText}>
        Yerel katalog yüklendiğinde on aktivitenin statik kartları ve seçili aktivitenin hareketli önizlemesi burada görünecek.
      </p>
    </div>
  )
}

export function ActivityLabGallery({ selectedId }: { selectedId?: string }) {
  const selectedActivity =
    REVIEW_ACTIVITIES.find((activity) => activity.id === selectedId) ?? REVIEW_ACTIVITIES[0]

  if (!selectedActivity) {
    return <EmptyCatalog />
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.eyebrowRow}>
          <span className={styles.statusBadge}>Klinik onay bekleyen yerel taslak</span>
          <span className={styles.localBadge}>Yalnız geliştirme ortamı</span>
        </div>
        <h1 className={styles.title}>Self-Regülasyon Aktivite Laboratuvarı</h1>
        <p className={styles.intro}>
          Hareket kalitesini, anlaşılabilir yönergeleri ve güvenlik sınırlarını birlikte incelemek için hazırlanmış yerel değerlendirme yüzeyi. Kartlar hareketsizdir; yalnız seçtiğiniz aktivite oynatıcıda canlanır.
        </p>

        <div className={styles.summaryStrip} aria-label="Laboratuvar kapsamı">
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue}>10 taslak</span>
            <span className={styles.summaryLabel}>Statik aktivite kartı</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue}>1 oynatıcı</span>
            <span className={styles.summaryLabel}>Aynı anda tek hareket</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue}>Yerel inceleme</span>
            <span className={styles.summaryLabel}>Üretime ve üyelere kapalı</span>
          </div>
        </div>
      </header>

      <section className={styles.reviewGrid} aria-label="Seçili aktivite incelemesi">
        <article className={styles.playerPanel} id="activity-lab-player" aria-labelledby="selected-activity-title">
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.sectionKicker}>Hareketli önizleme</p>
              <h2 className={styles.panelTitle} id="selected-activity-title">
                {selectedActivity.title}
              </h2>
            </div>
            <span className={styles.selectedBadge}>Seçili</span>
          </div>

          <p className={styles.srOnly} aria-live="polite">
            Seçili aktivite: {selectedActivity.title}
          </p>

          <div className={styles.panelMeta} aria-label="Aktivite özeti">
            <span className={styles.metaBadge}>{selectedActivity.categoryLabel}</span>
            <span className={styles.metaBadge}>{formatDuration(selectedActivity.durationMs)} döngü</span>
            <span className={styles.metaBadge}>{selectedActivity.safety.ageRange.label}</span>
          </div>

          <ActivityPlayer
            key={selectedActivity.id}
            activity={selectedActivity}
            isSelected
            className={styles.playerSurface}
          />

          <div className={styles.instructionBand}>
            <span className={styles.instructionMark} aria-hidden="true">
              01
            </span>
            <div>
              <span className={styles.detailLabel}>Uygulama yönergesi</span>
              <p className={styles.instructionText}>{selectedActivity.instruction}</p>
            </div>
          </div>

          <div className={styles.controlGuide} aria-label="Oynatıcı kullanım rehberi">
            <div className={styles.controlItem}>
              <span className={styles.controlNumber} aria-hidden="true">1</span>
              <span><strong>Oynat veya duraklat.</strong> Hareketi istediğiniz anda inceleyin.</span>
            </div>
            <div className={styles.controlItem}>
              <span className={styles.controlNumber} aria-hidden="true">2</span>
              <span><strong>Hızı değiştirin.</strong> Eklem geçişlerini daha yakından görün.</span>
            </div>
            <div className={styles.controlItem}>
              <span className={styles.controlNumber} aria-hidden="true">3</span>
              <span><strong>Başa alın.</strong> Her değerlendirmeyi aynı başlangıçtan tekrarlayın.</span>
            </div>
          </div>
        </article>

        <aside className={styles.clinicalPanel} aria-labelledby="clinical-review-title">
          <p className={styles.sectionKicker}>Klinik kontrol listesi</p>
          <h2 className={styles.clinicalTitle} id="clinical-review-title">
            Uygulama ve güvenlik özeti
          </h2>
          <p className={styles.clinicalIntro}>
            Bu bilgiler taslağın uzman değerlendirmesi içindir; kişiye özel klinik kararın yerine geçmez.
          </p>

          <div className={styles.detailStack}>
            <section className={styles.detailCard} aria-labelledby="materials-title">
              <h3 className={styles.detailLabel} id="materials-title">Gerekli materyaller</h3>
              <ul className={styles.materialList}>
                {selectedActivity.materials.map((material) => (
                  <li key={material.id}>
                    <div className={styles.materialRow}>
                      <span className={styles.materialName}>{material.label}</span>
                      <span className={styles.materialQuantity}>{material.quantity}</span>
                    </div>
                    <div className={styles.materialMeta}>
                      <span className={styles.requiredTag}>{material.required ? "Gerekli" : "İsteğe bağlı"}</span>
                      {material.safetyNote ? <span>{material.safetyNote}</span> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className={`${styles.detailCard} ${styles.supervisionCard}`} aria-labelledby="supervision-title">
              <h3 className={styles.detailLabel} id="supervision-title">Gözetim</h3>
              <p className={styles.detailLead}>{selectedActivity.safety.supervision.label}</p>
              <p className={styles.detailText}>{selectedActivity.safety.supervision.instruction}</p>
            </section>

            <section className={styles.detailCard} aria-labelledby="setup-title">
              <h3 className={styles.detailLabel} id="setup-title">Başlamadan önce</h3>
              <ul className={styles.detailList}>
                {selectedActivity.safety.setupChecklist.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>

            <section className={`${styles.detailCard} ${styles.stopCard}`} aria-labelledby="stop-title">
              <h3 className={styles.detailLabel} id="stop-title">Durdurma koşulları</h3>
              <ul className={styles.stopList}>
                {selectedActivity.safety.stopConditions.map((condition) => <li key={condition}>{condition}</li>)}
              </ul>
            </section>

            {selectedActivity.safety.contraindications.length > 0 ? (
              <section className={styles.detailCard} aria-labelledby="contraindications-title">
                <h3 className={styles.detailLabel} id="contraindications-title">Uygun olmayabilecek durumlar</h3>
                <ul className={styles.detailList}>
                  {selectedActivity.safety.contraindications.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </section>
            ) : null}
          </div>

          <div className={styles.skills} aria-label="Hedeflenen beceriler">
            {selectedActivity.skills.map((skill) => <span className={styles.skillBadge} key={skill}>{skill}</span>)}
          </div>
        </aside>
      </section>

      <section className={styles.catalogSection} aria-labelledby="activity-catalog-title">
        <div className={styles.catalogHeader}>
          <div>
            <p className={styles.sectionKicker}>Yerel taslak kataloğu</p>
            <h2 className={styles.catalogTitle} id="activity-catalog-title">10 aktivite kartı</h2>
            <p className={styles.catalogDescription}>
              Bir kart seçtiğinizde üstteki tek oynatıcı ve klinik ayrıntılar güncellenir. Kartların kendisi animasyon oynatmaz.
            </p>
          </div>
          <p className={styles.keyboardHint} id="activity-card-keyboard-hint">
            Klavye: Kartlara Tab ile ulaşın; Enter ile seçili önizlemeyi açın.
          </p>
        </div>

        <ul className={styles.activityList} aria-describedby="activity-card-keyboard-hint">
          {REVIEW_ACTIVITIES.map((activity, index) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              index={index}
              selected={activity.id === selectedActivity.id}
            />
          ))}
        </ul>
      </section>

      <footer className={styles.footerNote}>
        Bu inceleme rotası yalnız yerel geliştirme ortamında çalışır; üretim derlemesinde 404 döner, menülerde görünmez ve hiçbir veritabanı ya da API bağlantısı kurmaz.
      </footer>
    </div>
  )
}

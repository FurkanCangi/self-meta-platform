"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BookOpenCheck,
  Brain,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Database,
  FileCheck2,
  FileText,
  HeartPulse,
  Layers3,
  Ruler,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import type {
  ResearchCategoryKey,
  ResearchNote,
  ResearchStudyType,
} from "./researchNotesTypes";
import {
  RESEARCH_CATEGORY_LABELS,
  RESEARCH_STUDY_TYPE_LABELS,
} from "./researchNotesTypes";
import styles from "./ResearchNotesClient.module.css";

type CategoryFilter = "all" | ResearchCategoryKey;
type StudyTypeFilter = "all" | ResearchStudyType;
type SortKey = "newest" | "oldest" | "title";

type ResearchNotesClientProps = {
  notes: ResearchNote[];
};

const PAGE_SIZE = 6;

const categoryIcons: Record<ResearchCategoryKey, LucideIcon> = {
  interosepsiyon: HeartPulse,
  "duyusal-regulasyon": SlidersHorizontal,
  "duygusal-regulasyon": Brain,
  "yurutucu-islevler": Layers3,
  "gelisim-ve-baglam": UsersRound,
  "olcum-ve-metodoloji": Ruler,
};

const studyTypeOrder: ResearchStudyType[] = [
  "meta_analysis",
  "systematic_review",
  "scoping_review",
  "longitudinal",
  "observational",
  "review",
];

function normalize(value: string) {
  return value.toLocaleLowerCase("tr-TR");
}

function formatVerifiedAt(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

export default function ResearchNotesClient({ notes }: ResearchNotesClientProps) {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [studyType, setStudyType] = useState<StudyTypeFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const categoryCounts = useMemo(() => {
    const counts = new Map<ResearchCategoryKey, number>();
    notes.forEach((note) => counts.set(note.category, (counts.get(note.category) ?? 0) + 1));
    return counts;
  }, [notes]);

  const studyTypeCounts = useMemo(() => {
    const counts = new Map<ResearchStudyType, number>();
    notes.forEach((note) => counts.set(note.studyType, (counts.get(note.studyType) ?? 0) + 1));
    return counts;
  }, [notes]);

  const categories = useMemo(
    () =>
      (Object.keys(RESEARCH_CATEGORY_LABELS) as ResearchCategoryKey[]).map((key) => ({
        key,
        label: RESEARCH_CATEGORY_LABELS[key],
        count: categoryCounts.get(key) ?? 0,
        icon: categoryIcons[key],
      })),
    [categoryCounts],
  );

  const filteredNotes = useMemo(() => {
    const normalizedQuery = normalize(query.trim());
    const rows = notes.filter((note) => {
      const categoryMatches = category === "all" || note.category === category;
      const studyTypeMatches = studyType === "all" || note.studyType === studyType;
      const queryMatches =
        !normalizedQuery ||
        normalize(
          `${note.title} ${note.clinicalFocus} ${note.interpretationBoundary} ${note.categoryLabel} ${note.studyTypeLabel} ${note.apaReference}`,
        ).includes(normalizedQuery);

      return categoryMatches && studyTypeMatches && queryMatches;
    });

    return rows.sort((a, b) => {
      if (sort === "oldest") return a.year - b.year || a.title.localeCompare(b.title, "tr-TR");
      if (sort === "title") return a.title.localeCompare(b.title, "tr-TR");
      return b.year - a.year || a.title.localeCompare(b.title, "tr-TR");
    });
  }, [category, notes, query, sort, studyType]);

  const totalPages = Math.max(1, Math.ceil(filteredNotes.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleNotes = filteredNotes.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pmidCount = notes.filter((note) => note.pmid).length;
  const doiCount = notes.filter((note) => note.doi).length;
  const hasActiveFilters = category !== "all" || studyType !== "all" || query.trim().length > 0;

  const clearFilters = () => {
    setCategory("all");
    setStudyType("all");
    setQuery("");
    setPage(1);
  };

  return (
    <main className={styles.notesPage}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>
            <BookOpenCheck size={16} />
            Doğrulanmış kaynak arşivi
          </div>
          <h1>Araştırma Notları</h1>
          <p>
            Klinik sorulara hızlı yön veren, kaynağı açık ve yorum sınırı belirtilmiş güncel literatür kayıtları.
          </p>
        </div>

        <div className={styles.heroEvidence} aria-label="Kaynak arşivi özeti">
          <div className={styles.heroStat}>
            <Database size={21} />
            <span><strong>{notes.length}</strong> doğrulanmış yayın</span>
          </div>
          <div className={styles.heroStat}>
            <FileCheck2 size={21} />
            <span><strong>{doiCount}</strong> DOI kaydı</span>
          </div>
          <div className={styles.heroStat}>
            <ShieldCheck size={21} />
            <span><strong>{pmidCount}</strong> PubMed kaydı</span>
          </div>
          <p>
            Kaynaklar doğrudan yayıncı, DOI veya PubMed sayfasına açılır. Çalışma türü, kanıt gücü yerine araştırma
            tasarımını gösterir.
          </p>
        </div>
      </section>

      <section className={styles.workspace} aria-label="Araştırma notları arşivi">
        <aside className={styles.sidebar}>
          <button
            className={styles.mobileFilterToggle}
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="research-note-filters"
            onClick={() => setFiltersOpen((value) => !value)}
          >
            <SlidersHorizontal size={17} />
            <span>{filtersOpen ? "Filtreleri kapat" : "Filtreleri aç"}</span>
            {hasActiveFilters ? <strong>Etkin</strong> : null}
            <ChevronDown className={filtersOpen ? styles.filterChevronOpen : ""} size={17} />
          </button>

          <div
            className={`${styles.sidebarPanels} ${filtersOpen ? styles.sidebarPanelsOpen : ""}`}
            id="research-note-filters"
          >
            <div className={styles.filterPanel}>
              <div className={styles.filterHeading}>
                <span>Konu</span>
                <strong>{notes.length}</strong>
              </div>
              <div className={styles.filterList}>
                <button
                  className={`${styles.filterButton} ${category === "all" ? styles.filterActive : ""}`}
                  type="button"
                  onClick={() => {
                    setCategory("all");
                    setPage(1);
                  }}
                >
                  <FileText size={17} />
                  <span>Tümü</span>
                  <strong>{notes.length}</strong>
                </button>
                {categories.map(({ key, label, count, icon: Icon }) => (
                  <button
                    className={`${styles.filterButton} ${category === key ? styles.filterActive : ""}`}
                    key={key}
                    type="button"
                    onClick={() => {
                      setCategory(key);
                      setPage(1);
                    }}
                  >
                    <Icon size={17} />
                    <span>{label}</span>
                    <strong>{count}</strong>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.filterPanel}>
              <div className={styles.filterHeading}>
                <span>Çalışma türü</span>
                <Layers3 size={16} />
              </div>
              <div className={styles.studyTypeList}>
                <button
                  className={`${styles.studyTypeButton} ${studyType === "all" ? styles.studyTypeActive : ""}`}
                  type="button"
                  onClick={() => {
                    setStudyType("all");
                    setPage(1);
                  }}
                >
                  <span>Tüm çalışma türleri</span>
                  <strong>{notes.length}</strong>
                </button>
                {studyTypeOrder.map((key) => {
                  const count = studyTypeCounts.get(key) ?? 0;
                  if (!count) return null;
                  return (
                    <button
                      className={`${styles.studyTypeButton} ${studyType === key ? styles.studyTypeActive : ""}`}
                      key={key}
                      type="button"
                      onClick={() => {
                        setStudyType(key);
                        setPage(1);
                      }}
                    >
                      <span>{RESEARCH_STUDY_TYPE_LABELS[key]}</span>
                      <strong>{count}</strong>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        <div className={styles.content}>
          <div className={styles.toolbar}>
            <label className={styles.searchBox}>
              <span className="sr-only">Araştırma notlarında ara</span>
              <Search size={19} />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Konu, yazar veya anahtar kelime ara"
              />
            </label>

            <label className={styles.sortBox}>
              <span className="sr-only">Sıralama</span>
              <select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value as SortKey);
                  setPage(1);
                }}
              >
                <option value="newest">En yeni</option>
                <option value="oldest">En eski</option>
                <option value="title">Başlığa göre</option>
              </select>
              <ChevronDown size={17} />
            </label>
          </div>

          <div className={styles.resultsBar}>
            <p><strong>{filteredNotes.length}</strong> doğrulanmış kaynak gösteriliyor</p>
            {hasActiveFilters ? (
              <button type="button" onClick={clearFilters}>
                <X size={15} /> Filtreleri temizle
              </button>
            ) : null}
          </div>

          {visibleNotes.length ? (
            <div className={styles.noteList}>
              {visibleNotes.map((note) => {
                const Icon = categoryIcons[note.category];
                return (
                  <article className={styles.noteCard} key={note.id}>
                    <div className={styles.noteIcon}>
                      <Icon size={24} />
                    </div>

                    <div className={styles.noteBody}>
                      <div className={styles.noteBadges}>
                        <span>{note.categoryLabel}</span>
                        <span>{note.studyTypeLabel}</span>
                        <span>{note.year}</span>
                      </div>
                      <h2>{note.title}</h2>
                      <p className={styles.citation}>{note.inlineCitation}</p>

                      <div className={styles.findings}>
                        <div>
                          <strong>Bu kaynak neyi destekliyor?</strong>
                          <p>{note.clinicalFocus}</p>
                        </div>
                        <div className={styles.boundary}>
                          <CircleAlert size={17} />
                          <p><strong>Yorum sınırı:</strong> {note.interpretationBoundary}</p>
                        </div>
                      </div>

                      <details className={styles.reference}>
                        <summary>Tam kaynakçayı göster</summary>
                        <p>{note.apaReference}</p>
                      </details>
                    </div>

                    <div className={styles.sourcePanel}>
                      <div>
                        <small>Kaynak kaydı</small>
                        <strong>{note.pmid ? `PubMed · PMID ${note.pmid}` : "DOI kaydı"}</strong>
                      </div>
                      <span>Kontrol: {formatVerifiedAt(note.verifiedAt)}</span>
                      <a href={note.sourceUrl} target="_blank" rel="noreferrer">
                        Kaynağı aç <ArrowUpRight size={16} />
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <Search size={28} />
              <h2>Eşleşen kaynak bulunamadı</h2>
              <p>Arama sözcüğünü veya filtreleri değiştirerek yeniden deneyin.</p>
              <button type="button" onClick={clearFilters}>Tüm kaynakları göster</button>
            </div>
          )}

          {totalPages > 1 ? (
            <div className={styles.pagination} aria-label="Araştırma notları sayfalama">
              <button
                type="button"
                aria-label="Önceki sayfa"
                disabled={currentPage === 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                <ChevronLeft size={18} />
              </button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((item) => (
                <button
                  className={currentPage === item ? styles.pageActive : ""}
                  key={item}
                  type="button"
                  aria-label={`${item}. sayfa`}
                  aria-current={currentPage === item ? "page" : undefined}
                  onClick={() => setPage(item)}
                >
                  {item}
                </button>
              ))}
              <button
                type="button"
                aria-label="Sonraki sayfa"
                disabled={currentPage === totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

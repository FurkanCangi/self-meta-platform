"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import {
  BarChart3,
  Bookmark,
  Brain,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  FlaskConical,
  HeartPulse,
  Mail,
  Microscope,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  UserRound,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import styles from "./ResearchNotesClient.module.css";

type CategoryKey =
  | "all"
  | "interosepsiyon"
  | "oz-duzenleme"
  | "duyusal-regulasyon"
  | "yurutucu-islevler"
  | "otizm"
  | "dehb"
  | "mudahale-yaklasimlari"
  | "olcekler"
  | "metodoloji";

type EvidenceKey = "all" | "systematic" | "rct" | "cohort" | "observational";

type ResearchNote = {
  id: number;
  title: string;
  date: string;
  readTime: number;
  excerpt: string;
  category: Exclude<CategoryKey, "all">;
  categoryLabel: string;
  evidence: Exclude<EvidenceKey, "all">;
  evidenceLabel: string;
  icon: LucideIcon;
  accent: string;
};

const categories: {
  key: CategoryKey;
  label: string;
  count: number;
  icon: LucideIcon;
}[] = [
  { key: "all", label: "Tümü", count: 32, icon: FileText },
  { key: "interosepsiyon", label: "Interosepsiyon", count: 6, icon: HeartPulse },
  { key: "oz-duzenleme", label: "Öz Düzenleme", count: 5, icon: Brain },
  { key: "duyusal-regulasyon", label: "Duyusal Regülasyon", count: 6, icon: SlidersHorizontal },
  { key: "yurutucu-islevler", label: "Yürütücü İşlevler", count: 5, icon: Brain },
  { key: "otizm", label: "Otizm", count: 7, icon: Sparkles },
  { key: "dehb", label: "DEHB", count: 4, icon: Zap },
  { key: "mudahale-yaklasimlari", label: "Müdahale Yaklaşımları", count: 4, icon: Stethoscope },
  { key: "olcekler", label: "Ölçekler", count: 3, icon: BarChart3 },
  { key: "metodoloji", label: "Metodoloji", count: 2, icon: FlaskConical },
];

const evidenceLevels: {
  key: EvidenceKey;
  label: string;
  count: number;
  color: string;
}[] = [
  { key: "systematic", label: "Sistematik Derleme / Meta Analiz", count: 6, color: "#10b981" },
  { key: "rct", label: "Randomize Kontrollü Çalışma (RCT)", count: 9, color: "#22c55e" },
  { key: "cohort", label: "Kohort Çalışma", count: 8, color: "#eab308" },
  { key: "observational", label: "Vaka Serisi / Gözlemsel", count: 9, color: "#94a3b8" },
];

const evidenceColors: Record<Exclude<EvidenceKey, "all">, string> = {
  systematic: "#10b981",
  rct: "#22c55e",
  cohort: "#eab308",
  observational: "#94a3b8",
};

const notes: ResearchNote[] = [
  {
    id: 1,
    title: "Okul Öncesi Çocuklarda Interoseptif Farkındalık",
    date: "8 Haziran 2026",
    readTime: 3,
    excerpt:
      "Interoseptif farkındalık ile sosyal katılım ve duygusal düzenleme becerileri arasında orta düzey ilişki bulundu.",
    category: "interosepsiyon",
    categoryLabel: "Interosepsiyon",
    evidence: "systematic",
    evidenceLabel: "Sistematik Derleme",
    icon: HeartPulse,
    accent: "#7c3aed",
  },
  {
    id: 2,
    title: "Yürütücü İşlevlere Yönelik Müdahalelerin Etkisi",
    date: "2 Haziran 2026",
    readTime: 5,
    excerpt:
      "Planlama ve çalışma belleği becerilerindeki gelişim, günlük yaşam performansına olumlu yansıdı.",
    category: "yurutucu-islevler",
    categoryLabel: "Yürütücü İşlevler",
    evidence: "rct",
    evidenceLabel: "Randomize Kontrollü Çalışma (RCT)",
    icon: Brain,
    accent: "#2563eb",
  },
  {
    id: 3,
    title: "Duyusal İşleme Örüntüleri ve Davranışsal Yanıtlar",
    date: "28 Mayıs 2026",
    readTime: 4,
    excerpt:
      "Duyusal hassasiyet düzeyi arttıkça, davranışsal esneklikte azalma gözlendi.",
    category: "duyusal-regulasyon",
    categoryLabel: "Duyusal Regülasyon",
    evidence: "cohort",
    evidenceLabel: "Kohort Çalışma",
    icon: SlidersHorizontal,
    accent: "#00c8d7",
  },
  {
    id: 4,
    title: "Duygu Düzenleme Stratejileri ve Klinik Uygulamalar",
    date: "20 Mayıs 2026",
    readTime: 4,
    excerpt:
      "Bilişsel yeniden çerçeveleme ve farkındalık temelli yaklaşımlar duygu düzenleme becerilerini destekliyor.",
    category: "duyusal-regulasyon",
    categoryLabel: "Duygusal Regülasyon",
    evidence: "rct",
    evidenceLabel: "Randomize Kontrollü Çalışma (RCT)",
    icon: Sparkles,
    accent: "#7c3aed",
  },
  {
    id: 5,
    title: "Otizm Spektrumunda Sosyal İletişim Becerileri",
    date: "15 Mayıs 2026",
    readTime: 6,
    excerpt:
      "Yapılandırılmış sosyal beceri eğitimlerinin iletişim becerilerini artırmada etkili olduğu bulundu.",
    category: "otizm",
    categoryLabel: "Otizm",
    evidence: "cohort",
    evidenceLabel: "Kohort Çalışma",
    icon: FileText,
    accent: "#2563eb",
  },
  {
    id: 6,
    title: "Öz Düzenleme Becerilerinde Klinik Gözlem Notları",
    date: "9 Mayıs 2026",
    readTime: 5,
    excerpt:
      "Gözlem notları, ölçek sonuçlarıyla birlikte yorumlandığında müdahale hedeflerini netleştirmeye yardımcı olur.",
    category: "oz-duzenleme",
    categoryLabel: "Öz Düzenleme",
    evidence: "observational",
    evidenceLabel: "Vaka Serisi / Gözlemsel",
    icon: ShieldCheck,
    accent: "#3b82f6",
  },
  {
    id: 7,
    title: "DEHB’de Dikkat Sürdürme ve Görev Tamamlama",
    date: "2 Mayıs 2026",
    readTime: 4,
    excerpt:
      "Görev yapılandırması ve çevresel düzenleme, dikkat sürdürme becerisini klinik pratikte destekleyebilir.",
    category: "dehb",
    categoryLabel: "DEHB",
    evidence: "observational",
    evidenceLabel: "Vaka Serisi / Gözlemsel",
    icon: Zap,
    accent: "#7c3aed",
  },
  {
    id: 8,
    title: "Ölçek Seçiminde Klinik Amaç ve Yorum Sınırı",
    date: "25 Nisan 2026",
    readTime: 3,
    excerpt:
      "Ölçek seçimi, tanı iddiasından çok klinik soru, takip ihtiyacı ve müdahale planlamasıyla ilişkilendirilmelidir.",
    category: "olcekler",
    categoryLabel: "Ölçekler",
    evidence: "systematic",
    evidenceLabel: "Sistematik Derleme",
    icon: BarChart3,
    accent: "#00c8d7",
  },
  {
    id: 9,
    title: "Müdahale Planlarında Önceliklendirme Mantığı",
    date: "18 Nisan 2026",
    readTime: 5,
    excerpt:
      "Çok boyutlu değerlendirme, destek alanlarını önceliklendirirken güçlü alanları müdahale planına dahil etmeyi kolaylaştırır.",
    category: "mudahale-yaklasimlari",
    categoryLabel: "Müdahale Yaklaşımları",
    evidence: "rct",
    evidenceLabel: "Randomize Kontrollü Çalışma (RCT)",
    icon: Stethoscope,
    accent: "#2563eb",
  },
  {
    id: 10,
    title: "Klinik Araştırma Notlarında Metodolojik Okuma",
    date: "10 Nisan 2026",
    readTime: 4,
    excerpt:
      "Örneklem, ölçüm aracı ve sonuç yorumunun ayrı değerlendirilmesi klinik aktarımı daha güvenilir hale getirir.",
    category: "metodoloji",
    categoryLabel: "Metodoloji",
    evidence: "observational",
    evidenceLabel: "Vaka Serisi / Gözlemsel",
    icon: FlaskConical,
    accent: "#7c3aed",
  },
];

const PAGE_SIZE = 5;

function normalize(value: string) {
  return value.toLocaleLowerCase("tr-TR");
}

export default function ResearchNotesClient() {
  const [category, setCategory] = useState<CategoryKey>("all");
  const [evidence, setEvidence] = useState<EvidenceKey>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  const filteredNotes = useMemo(() => {
    const normalizedQuery = normalize(query.trim());
    const rows = notes.filter((note) => {
      const categoryMatches = category === "all" || note.category === category;
      const evidenceMatches = evidence === "all" || note.evidence === evidence;
      const queryMatches =
        !normalizedQuery ||
        normalize(`${note.title} ${note.excerpt} ${note.categoryLabel} ${note.evidenceLabel}`).includes(normalizedQuery);

      return categoryMatches && evidenceMatches && queryMatches;
    });

    return rows.sort((a, b) => {
      if (sort === "reading") return a.readTime - b.readTime;
      if (sort === "oldest") return b.id - a.id;
      return a.id - b.id;
    });
  }, [category, evidence, query, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredNotes.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleNotes = filteredNotes.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const updateCategory = (nextCategory: CategoryKey) => {
    setCategory(nextCategory);
    setPage(1);
  };

  const updateEvidence = (nextEvidence: EvidenceKey) => {
    setEvidence(nextEvidence);
    setPage(1);
  };

  return (
    <main className={styles.notesPage}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>
            <FlaskConical size={16} />
            Araştırma
          </div>
          <h1>Araştırma Notları</h1>
          <p>Klinik uygulamaya dönük kısa literatür özetleri, metodoloji notları ve bilimsel değerlendirmeler.</p>
        </div>

        <div className={styles.heroVisual} aria-hidden="true">
          <div className={styles.orbit} />
          <div className={styles.visualIconSearch}>
            <Search size={58} />
          </div>
          <div className={styles.visualIconChart}>
            <BarChart3 size={38} />
          </div>
          <div className={styles.paperStack}>
            <div className={styles.paperBack} />
            <div className={styles.paperFront}>
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.workspace} aria-label="Araştırma notları arşivi">
        <aside className={styles.sidebar}>
          <div className={styles.filterPanel}>
            <h2>Kategoriler</h2>
            <div className={styles.filterList}>
              {categories.map(({ key, label, count, icon: Icon }) => {
                const active = category === key;
                return (
                  <button
                    className={`${styles.filterButton} ${active ? styles.filterActive : ""}`}
                    key={key}
                    type="button"
                    onClick={() => updateCategory(key)}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                    <strong>{count}</strong>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.filterPanel}>
            <h2>
              Kanıt Düzeyi
              <ShieldCheck size={16} />
            </h2>
            <div className={styles.evidenceList}>
              {evidenceLevels.map(({ key, label, count, color }) => {
                const active = evidence === key;
                return (
                  <button
                    className={`${styles.evidenceButton} ${active ? styles.evidenceActive : ""}`}
                    key={key}
                    type="button"
                    onClick={() => updateEvidence(key)}
                  >
                    <span style={{ "--dot": color } as CSSProperties} />
                    <em>{label}</em>
                    <strong>{count}</strong>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.loginPanel}>
            <div className={styles.loginIcon}>
              <Bookmark size={22} />
            </div>
            <p>İlgilendiğiniz konuları kaydedin, sonra kolayca ulaşın.</p>
            <Link href="/login">Giriş Yapın</Link>
          </div>
        </aside>

        <div className={styles.content}>
          <div className={styles.toolbar}>
            <label className={styles.searchBox}>
              <span className="sr-only">Araştırma notlarında ara</span>
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Araştırma notlarında ara..."
              />
              <Search size={19} />
            </label>

            <label className={styles.sortBox}>
              <span className="sr-only">Sıralama</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="newest">En yeni</option>
                <option value="oldest">En eski</option>
                <option value="reading">Okuma süresi</option>
              </select>
              <ChevronDown size={18} />
            </label>
          </div>

          <div className={styles.resultsMeta}>
            <strong>{filteredNotes.length}</strong> araştırma notu görüntüleniyor
          </div>

          <div className={styles.noteList} id="research-note-list">
            {visibleNotes.map((note) => {
              const Icon = note.icon;
              return (
                <article className={styles.noteCard} key={note.id} style={{ "--accent": note.accent } as CSSProperties}>
                  <div className={styles.noteRail} />
                  <div className={styles.noteIcon}>
                    <Icon size={34} />
                  </div>
                  <div className={styles.noteBody}>
                    <div className={styles.noteTopline}>
                      <h2>{note.title}</h2>
                      <button type="button" aria-label={`${note.title} notunu kaydet`}>
                        <Bookmark size={19} />
                      </button>
                    </div>
                    <div className={styles.noteMeta}>
                      <span>{note.date}</span>
                      <span>{note.readTime} dk okuma</span>
                    </div>
                    <p>{note.excerpt}</p>
                    <span className={styles.tag}>{note.categoryLabel}</span>
                  </div>
                  <div className={styles.evidenceCard}>
                    <small>Kanıt Düzeyi</small>
                    <span style={{ "--evidence-dot": evidenceColors[note.evidence] } as CSSProperties}>
                      <i />
                      {note.evidenceLabel}
                    </span>
                    <a href="#research-note-list">Notu Oku <ChevronRight size={17} /></a>
                  </div>
                </article>
              );
            })}
          </div>

          <div className={styles.pagination} aria-label="Araştırma notları sayfalama">
            <button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              <ChevronLeft size={18} />
            </button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((item) => (
              <button
                className={currentPage === item ? styles.pageActive : ""}
                key={item}
                type="button"
                onClick={() => setPage(item)}
              >
                {item}
              </button>
            ))}
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>

      <section className={styles.cta}>
        <div>
          <h2>Araştırma ve iş birliği için birlikte üretelim.</h2>
          <p>Bilimsel gelişime katkı sağlamak ve klinik uygulamaları güçlendirmek için ortak çalışmalara açığız.</p>
        </div>
        <div className={styles.ctaCards}>
          <a href="mailto:self.metacognition.institute@gmail.com">
            <Mail size={26} />
            <span>
              <strong>E-posta</strong>
              self.metacognition.institute@gmail.com
            </span>
          </a>
          <a href="tel:+905306766654">
            <UserRound size={26} />
            <span>
              <strong>Telefon</strong>
              +90 530 676 66 54
            </span>
          </a>
        </div>
      </section>
    </main>
  );
}

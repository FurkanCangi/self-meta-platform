"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import ClinicalReportView from "@/components/report/ClinicalReportView";
import { normalizeClinicalReportText } from "@/lib/dna/reportText";

type ReportRow = {
  id: string;
  version: number | null;
  report_text: string | null;
  created_at: string | null;
  snapshot_json: any;
  assessment_id: string | null;
  clientId?: string | null;
  clientCode?: string | null;
  assessmentDate?: string | null;
  preview?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("tr-TR");
}

function extractClientCode(row: ReportRow) {
  return (
    row?.clientCode ||
    row?.snapshot_json?.client_code ||
    row?.snapshot_json?.scores?.client_code ||
    "—"
  );
}

function extractAssessmentDate(row: ReportRow) {
  return (
    row?.assessmentDate ||
    row?.snapshot_json?.assessment_date ||
    row?.snapshot_json?.scores?.assessment_date ||
    row?.created_at ||
    null
  );
}

function extractReportDate(row: ReportRow) {
  return row?.created_at || null;
}

function extractPreview(row: ReportRow) {
  if (row.preview) return row.preview;
  const text = normalizeClinicalReportText(
    String(row.report_text || "Alanlar arası teknik örüntü, mevcut skor dağılımı ve anamnez temaları birlikte değerlendirilerek oluşturulmuştur.")
  ).replace(/\s+/g, " ").trim();
  if (!text) return "Rapor metni bulunamadı.";
  return text.length > 140 ? text.slice(0, 140) + "..." : text;
}

function reportTitle(row: ReportRow) {
  const code = extractClientCode(row);
  return code === "—" ? "Klinik rapor" : `${code} raporu`;
}

function normalizeCode(value?: string | null) {
  return String(value || "").trim().toUpperCase();
}

function reportMatchesClientFilter(row: ReportRow, filter: { id: string; code: string }) {
  const filterId = String(filter.id || "").trim();
  const filterCode = normalizeCode(filter.code);
  const rowClientId = String(row.clientId || "").trim();
  const rowClientCode = normalizeCode(extractClientCode(row));

  if (filterId && rowClientId === filterId) return true;
  if (filterCode && rowClientCode === filterCode) return true;
  if (!filterId && !filterCode) return true;

  return false;
}

export default function ReportsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [notice, setNotice] = useState<string>("");
  const [deletingReportId, setDeletingReportId] = useState<string>("");
  const [appReaderOpen, setAppReaderOpen] = useState(false);
  const [clientFilter, setClientFilter] = useState({ id: "", code: "" });

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setErr("");
      setNotice("");

      try {
        const params = new URLSearchParams(window.location.search);
        const nextClientFilter = {
          id: (params.get("client_id") || "").trim(),
          code: (params.get("client") || "").trim(),
        };
        if (mounted) setClientFilter(nextClientFilter);

        const response = await fetch("/api/app/clinical-workspace", { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));

        if (!mounted) return;

        if (response.status === 401) {
          setLoading(false);
          router.replace("/app-login");
          return;
        }

        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.error || "Raporlar alınamadı.");
        }

        const safeRows = (payload.reports || []) as ReportRow[];
        const initialRows = safeRows.filter((row) => reportMatchesClientFilter(row, nextClientFilter));
        setRows(safeRows);
        setSelectedId(initialRows[0]?.id || "");
      } catch (error) {
        if (mounted) {
          setErr(error instanceof Error ? error.message : "Raporlar alınamadı.");
          setRows([]);
          setSelectedId("");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [router]);

  const visibleRows = useMemo(() => {
    return rows.filter((row) => reportMatchesClientFilter(row, clientFilter));
  }, [rows, clientFilter]);

  const selected = useMemo(
    () => visibleRows.find((x) => x.id === selectedId) || null,
    [visibleRows, selectedId]
  );

  async function handleDeleteReport(row: ReportRow) {
    const ok = confirm(`"${extractClientCode(row)}" danışanına ait seçili raporu silmek istiyor musunuz?`);
    if (!ok) return;

    try {
      setDeletingReportId(row.id);
      setErr("");
      setNotice("");

      const { error } = await supabase
        .from("reports")
        .delete()
        .eq("id", row.id);

      if (error) {
        throw new Error("Rapor silinemedi: " + error.message);
      }

      setRows((prev) => {
        const next = prev.filter((item) => item.id !== row.id);
        if (row.id === selectedId) {
          setSelectedId(next[0]?.id || "");
          setAppReaderOpen(false);
        }
        return next;
      });
      setNotice("Rapor silindi.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Rapor silinirken beklenmeyen bir hata oluştu.";
      setErr(message);
    } finally {
      setDeletingReportId("");
    }
  }

  return (
    <>
    <div className="dna-app-only dna-app-page space-y-4">
      {!appReaderOpen ? (
        <>
          <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="dna-app-section-title">Klinik arşiv</div>
            <h1 className="mt-2 text-[26px] font-black text-[#071b3a]">Raporlar</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Oluşturulmuş raporu açın. Yeni rapor üretimi danışan değerlendirmesinden başlar.
            </p>
          </section>

          {loading && <div className="rounded-[22px] border border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-500 shadow-sm">Yükleniyor...</div>}
          {!loading && err && <div className="rounded-[22px] border border-slate-300 bg-slate-50 p-4 text-sm text-slate-900">{err}</div>}
          {!loading && !err && notice && <div className="rounded-[22px] border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-800">{notice}</div>}
          {!loading && !err && visibleRows.length === 0 && (
            <div className="rounded-[22px] border border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-500 shadow-sm">
              {clientFilter.code
                ? `${clientFilter.code} için henüz kayıtlı rapor bulunmuyor.`
                : "Henüz kayıtlı rapor bulunmuyor."}
            </div>
          )}

          <section className="space-y-3">
            {visibleRows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  setSelectedId(row.id);
                  setAppReaderOpen(true);
                }}
                className="w-full rounded-[22px] border border-slate-200 bg-white p-4 text-left shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-lg font-black text-[#071b3a]">{reportTitle(row)}</div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">{formatDate(extractReportDate(row))}</div>
                  </div>
                  <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">Aç</span>
                </div>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{extractPreview(row)}</p>
              </button>
            ))}
          </section>
        </>
      ) : (
        <section className="space-y-3">
          <button
            type="button"
            onClick={() => setAppReaderOpen(false)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm"
          >
            ← Rapor listesi
          </button>

          {!selected ? (
            <div className="rounded-[22px] border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
              Rapor bulunamadı.
            </div>
          ) : (
            <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">Danışan</div>
                  <div className="mt-1 font-mono text-sm font-black text-slate-900">{extractClientCode(selected)}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">Tarih</div>
                  <div className="mt-1 text-sm font-bold text-slate-700">{formatDate(extractReportDate(selected))}</div>
                </div>
              </div>

              <ClinicalReportView
                className="mt-4"
                text={selected.report_text || "Rapor metni bulunamadı."}
                reportDate={extractReportDate(selected)}
              />

              <button
                type="button"
                onClick={() => handleDeleteReport(selected)}
                disabled={deletingReportId === selected.id}
                className="mt-4 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 disabled:opacity-50"
              >
                {deletingReportId === selected.id ? "Siliniyor..." : "Raporu sil"}
              </button>
            </div>
          )}
        </section>
      )}
    </div>

    <div className="dna-web-only dna-reports-page mx-auto max-w-7xl space-y-6 px-0 py-0 md:px-4 md:py-8">
      <div className="dna-card dna-print-hide p-4 md:p-6">
        <h1 className="text-2xl font-semibold text-slate-900 md:text-3xl">Rapor Geçmişi</h1>
        <p className="mt-2 text-slate-500">
          Oluşturulan klinik raporlar burada görüntülenir.
        </p>
      </div>

      <div className="dna-reports-grid grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="dna-card dna-reports-list dna-print-hide p-4 lg:col-span-2">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Kayıtlı Raporlar</h2>
              <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
                Raporu seç; detay sağ tarafta açılır.
              </p>
            </div>
            <span className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              {visibleRows.length} kayıt
            </span>
          </div>

          {loading && <p className="text-sm text-slate-500">Yükleniyor...</p>}

          {!loading && err && (
            <div className="rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900">
              {err}
            </div>
          )}

          {!loading && !err && notice && (
            <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-800">
              {notice}
            </div>
          )}

          {!loading && !err && visibleRows.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
              {clientFilter.code
                ? `${clientFilter.code} için henüz kayıtlı rapor bulunmuyor.`
                : "Henüz kayıtlı rapor bulunmuyor."}
            </div>
          )}

          <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
            {visibleRows.map((row) => {
              const active = row.id === selectedId;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    active
                      ? "border-indigo-400 bg-indigo-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="grid gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-950">
                          {reportTitle(row)}
                        </div>
                        <div className="mt-1 text-xs font-medium text-slate-500">
                          Değerlendirme: {formatDate(extractAssessmentDate(row))}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-xs font-semibold text-slate-500">
                        {formatDate(extractReportDate(row))}
                      </div>
                    </div>
                    {active ? (
                      <p className="rounded-xl bg-white/70 px-3 py-2 text-xs leading-5 text-slate-600">
                        {extractPreview(row)}
                      </p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="dna-card dna-print-report-shell p-4 md:p-6 lg:col-span-3">
          <div className="dna-print-hide mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Seçilen Rapor</h2>
            {selected ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
                >
                  PDF / Yazdır
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteReport(selected)}
                  disabled={deletingReportId === selected.id}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {deletingReportId === selected.id ? "Siliniyor..." : "Raporu Sil"}
                </button>
              </div>
            ) : null}
          </div>

          {!selected && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Görüntülemek için soldan bir rapor seçin.
            </div>
          )}

          {selected && (
            <>
              <div className="dna-report-meta mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">Danışan Kodu</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{extractClientCode(selected)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">Rapor Tarihi</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">
                    {formatDate(extractReportDate(selected))}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">Değerlendirme Tarihi</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">
                    {formatDate(extractAssessmentDate(selected))}
                  </div>
                </div>
              </div>

              <ClinicalReportView
                text={selected.report_text || "Rapor metni bulunamadı."}
                reportDate={extractReportDate(selected)}
              />
            </>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

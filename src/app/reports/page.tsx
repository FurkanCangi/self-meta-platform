"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import ClinicalReportView from "@/components/report/ClinicalReportView";
import { normalizeClinicalReportText } from "@/lib/selfmeta/reportText";

type ReportRow = {
  id: string;
  version: number | null;
  report_text: string | null;
  created_at: string | null;
  snapshot_json: any;
  assessment_id: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("tr-TR");
}

function extractClientCode(row: ReportRow) {
  return (
    row?.snapshot_json?.client_code ||
    row?.snapshot_json?.scores?.client_code ||
    "—"
  );
}

function extractAssessmentDate(row: ReportRow) {
  return (
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
  const text = normalizeClinicalReportText(
    String(row.report_text || "Alanlar arası teknik örüntü, mevcut skor dağılımı ve anamnez temaları birlikte değerlendirilerek oluşturulmuştur.")
  ).replace(/\s+/g, " ").trim();
  if (!text) return "Rapor metni bulunamadı.";
  return text.length > 140 ? text.slice(0, 140) + "..." : text;
}

export default function ReportsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setErr("");

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes?.user?.id) {
        setLoading(false);
        router.replace("/login");
        return;
      }

      const { data: ownedClients, error: clientsError } = await supabase
        .from("clients")
        .select("id")
        .eq("owner_id", userRes.user.id)
        .is("deleted_at", null);

      if (!mounted) return;

      if (clientsError) {
        setErr("Danışan kayıtları alınamadı: " + clientsError.message);
        setRows([]);
        setLoading(false);
        return;
      }

      const clientIds = (ownedClients || []).map((row: any) => row.id);
      if (clientIds.length === 0) {
        setRows([]);
        setSelectedId("");
        setLoading(false);
        return;
      }

      const { data: assessments, error: assessmentsError } = await supabase
        .from("assessments_v2")
        .select("id")
        .in("client_id", clientIds)
        .is("deleted_at", null);

      if (!mounted) return;

      if (assessmentsError) {
        setErr("Değerlendirmeler alınamadı: " + assessmentsError.message);
        setRows([]);
        setLoading(false);
        return;
      }

      const assessmentIds = (assessments || []).map((row: any) => row.id);
      if (assessmentIds.length === 0) {
        setRows([]);
        setSelectedId("");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("reports")
        .select("id, version, report_text, created_at, snapshot_json, assessment_id")
        .in("assessment_id", assessmentIds)
        .order("created_at", { ascending: false });

      if (!mounted) return;

      if (error) {
        setErr("Raporlar alınamadı: " + error.message);
        setRows([]);
        setLoading(false);
        return;
      }

      const safeRows = (data || []) as ReportRow[];
      setRows(safeRows);
      setSelectedId(safeRows[0]?.id || "");
      setLoading(false);
    }

    load();

    return () => {
      mounted = false;
    };
  }, [router]);

  const selected = useMemo(
    () => rows.find((x) => x.id === selectedId) || null,
    [rows, selectedId]
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Rapor Geçmişi</h1>
        <p className="mt-2 text-slate-500">
          Oluşturulan klinik raporlar burada görüntülenir.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Kayıtlı Raporlar</h2>

          {loading && <p className="text-sm text-slate-500">Yükleniyor...</p>}

          {!loading && err && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {err}
            </div>
          )}

          {!loading && !err && rows.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
              Henüz kayıtlı rapor bulunmuyor.
            </div>
          )}

          <div className="space-y-3">
            {rows.map((row) => {
              const active = row.id === selectedId;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    active
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-900">
                      v{row.version ?? "?"}
                    </span>
                    <div className="text-right">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Rapor Tarihi
                      </div>
                      <div className="text-xs text-slate-600">
                        {formatDate(extractReportDate(row))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 text-sm text-slate-700">
                    <span className="font-medium">Danışan Kodu:</span>{" "}
                    {extractClientCode(row)}
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    <span className="font-medium">Değerlendirme Tarihi:</span>{" "}
                    {formatDate(extractAssessmentDate(row))}
                  </div>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {extractPreview(row)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Seçilen Rapor</h2>

          {!selected && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Görüntülemek için soldan bir rapor seçin.
            </div>
          )}

          {selected && (
            <>
              <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">Versiyon</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">v{selected.version ?? "?"}</div>
                </div>
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
  );
}

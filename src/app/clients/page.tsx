"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Status = "Aktif" | "Bekliyor" | "Arşiv";
type Risk = "Yüksek" | "Orta" | "Düşük" | "İzlem" | "—";

type ClientRow = {
  id: string;
  code: string;
  status: Status;
  lastAssessment: string;
  lastReport: string;
  note: string;
  risk: Risk;
  needsScore: boolean;
  hasReport: boolean;
};

function badgeStatus(s: Status) {
  if (s === "Aktif") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "Bekliyor") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}
function badgeRisk(r: Risk) {
  if (r === "Yüksek") return "bg-rose-50 text-rose-700 border-rose-200";
  if (r === "Orta") return "bg-amber-50 text-amber-700 border-amber-200";
  if (r === "Düşük") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (r === "İzlem") return "bg-indigo-50 text-indigo-700 border-indigo-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}
function riskBar(r: Risk) {
  if (r === "Yüksek") return "bg-rose-500";
  if (r === "Orta") return "bg-amber-500";
  if (r === "Düşük") return "bg-emerald-500";
  if (r === "İzlem") return "bg-indigo-500";
  return "bg-slate-300";
}

// Minimal deterministik risk (MVP): anamnez uzunluğu + ileride skorlarla değiştirilecek
function calcRisk(anamnez: string): Risk {
  const n = (anamnez || "").trim().length;
  if (n >= 900) return "Orta";
  if (n >= 300) return "İzlem";
  return "—";
}

export default function ClientsPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"Tümü" | Status | "Riskli">("Tümü");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<ClientRow[]>([]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErr(null);

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes?.user?.id) {
        setLoading(false);
        setErr("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
        return;
      }

      const { data, error } = await supabase
        .from("clients")
        .select("id, child_code, anamnez, created_at, deleted_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (!alive) return;

      if (error) {
        setLoading(false);
        setErr("Veri alınamadı: " + error.message);
        return;
      }

      const mapped: ClientRow[] = (data || []).map((c: any) => {
        const risk = calcRisk(c.anamnez || "");
        const status: Status = "Aktif";
        return {
          id: c.id,
          code: c.child_code,
          status,
          lastAssessment: "—",
          lastReport: "—",
          note: (c.anamnez || "").trim().slice(0, 80) || "—",
          risk,
          needsScore: true,
          hasReport: false,
        };
      });

      setRows(mapped);
      setLoading(false);
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const computed = useMemo(() => {
    const all = rows.slice();

    const riskCount = all.filter((r) => r.risk === "Yüksek" || r.risk === "Orta").length;
    const pendingScore = all.filter((r) => r.needsScore).length;
    const activeCount = all.filter((r) => r.status === "Aktif").length;

    let view = all;

    if (filter === "Riskli") view = view.filter((r) => r.risk === "Yüksek" || r.risk === "Orta");
    else if (filter !== "Tümü") view = view.filter((r) => r.status === filter);

    if (q.trim()) view = view.filter((r) => r.code.toLowerCase().includes(q.trim().toLowerCase()));

    const priority = (r: ClientRow) => {
      let p = 0;
      if (r.needsScore) p += 50;
      if (r.risk === "Yüksek") p += 40;
      if (r.risk === "Orta") p += 25;
      if (r.status === "Bekliyor") p += 10;
      return -p;
    };
    view.sort((a, b) => priority(a) - priority(b));

    return { rows: view, riskCount, pendingScore, activeCount, total: all.length };
  }, [rows, q, filter]);

  return (
    <div className="space-y-6">
      <div className="selfmeta-card p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">Danışan Yönetimi</div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Danışan Listesi</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Danışan kayıtları anonim kod ile tutulur. Skor girişi ve rapor sürümleri bu kayıtlar üzerinden yürütülür.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="selfmeta-input w-64 px-4 py-2.5 text-sm"
              placeholder="Danışan kodu ara (SM-...)"
            />
            <Link href="/clients/new" className="selfmeta-btn px-4 py-2.5 text-sm font-semibold inline-flex items-center justify-center">
              Yeni Danışan
            </Link>
          </div>
        </div>

        {err ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div> : null}

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Toplam</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{computed.total}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aktif</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{computed.activeCount}</div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Skor Bekleyen</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{computed.pendingScore}</div>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-rose-700">Riskli</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{computed.riskCount}</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["Tümü", "Aktif", "Bekliyor", "Arşiv", "Riskli"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k as any)}
              className={
                filter === k
                  ? "rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              }
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <div className="selfmeta-card p-0 overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Danışan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Durum</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Risk</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Son Değerlendirme</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Son Rapor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Not</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">İşlem</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500">
                    Yükleniyor...
                  </td>
                </tr>
              ) : (
                <>
                  {computed.rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <span className={`h-10 w-1 rounded-full ${riskBar(r.risk)}`} />
                          <div>
                            <Link href={`/clients/${r.id}`} className="text-sm font-semibold text-slate-900 hover:underline">{r.code}</Link>
                            <div className="text-xs text-slate-400">{r.needsScore ? "Skor bekliyor" : "Kayıt hazır"}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeStatus(r.status)}`}>
                          {r.status}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeRisk(r.risk)}`}>
                          {r.risk}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-slate-600">{r.lastAssessment}</td>
                      <td className="px-4 py-4 text-slate-600">{r.lastReport}</td>
                      <td className="px-4 py-4 text-slate-500">{r.note}</td>

                      <td className="px-4 py-4 text-right">
                        <div className="inline-flex gap-2">
                          <Link
                            href={`/assessments?client=${encodeURIComponent(r.code)}&client_id=${encodeURIComponent(r.id)}`}
                            className="selfmeta-btn px-3 py-2 text-xs font-semibold"
                          >
                            Skor Gir
                          </Link>
                          <Link href="/reports" className="selfmeta-btn-ghost px-3 py-2 text-xs font-semibold">
                            Raporlar
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {computed.rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500">
                        Henüz danışan yok. “Yeni Danışan” ile ilk kaydı oluştur.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          Canlı mod: Liste Supabase (public.clients) tablosundan okunuyor.
        </div>
      </div>
    </div>
  );
}

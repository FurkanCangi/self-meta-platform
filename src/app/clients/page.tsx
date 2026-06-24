"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

function progressLabel(row: ClientRow) {
  if (row.hasReport) return "Rapor oluşturuldu";
  if (row.lastAssessment !== "—") return "Rapor bekliyor";
  return "Skor bekliyor";
}

function badgeStatus(s: Status) {
  if (s === "Aktif") return "bg-cyan-50 text-cyan-800 border-cyan-200";
  if (s === "Bekliyor") return "bg-violet-50 text-violet-800 border-violet-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}
function badgeRisk(r: Risk) {
  if (r === "Yüksek") return "bg-slate-50 text-slate-900 border-slate-300";
  if (r === "Orta") return "bg-violet-50 text-violet-800 border-violet-200";
  if (r === "Düşük") return "bg-cyan-50 text-cyan-800 border-cyan-200";
  if (r === "İzlem") return "bg-indigo-50 text-indigo-700 border-indigo-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}
function riskBar(r: Risk) {
  if (r === "Yüksek") return "bg-slate-700";
  if (r === "Orta") return "bg-violet-500";
  if (r === "Düşük") return "bg-cyan-500";
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
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"Tümü" | Status | "Riskli">("Tümü");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);
  const [appSurface, setAppSurface] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setAppSurface(params.get("surface") === "app");
  }, []);

  const withSurface = (path: string) => {
    if (!appSurface) return path;
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}surface=app`;
  };

  const reportsHref = (row: ClientRow) =>
    withSurface(`/reports?client_id=${encodeURIComponent(row.id)}&client=${encodeURIComponent(row.code)}`);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErr(null);
      setNotice(null);

      try {
        const response = await fetch("/api/app/clinical-workspace", { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!alive) return;

        if (response.status === 401) {
          setLoading(false);
          router.replace(appSurface ? "/app-login" : "/login");
          return;
        }

        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.error || "Veri alınamadı.");
        }

        setRows((payload.clients || []) as ClientRow[]);
      } catch (error) {
        if (alive) {
          setErr(error instanceof Error ? "Veri alınamadı: " + error.message : "Veri alınamadı.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [router, appSurface]);

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

  const onScoreClick = (row: ClientRow) => {
    setNotice(null);

    if (row.hasReport) {
      setNotice(`Bu vaka için rapor zaten oluşturulmuş. Her vaka için yalnızca bir kez rapor oluşturabilirsiniz. Lütfen “Raporlar” bölümünü kullanın. (${row.code})`);
      return;
    }

    router.push(withSurface(`/assessments?client=${encodeURIComponent(row.code)}&client_id=${encodeURIComponent(row.id)}`));
  };

  const onDeleteClient = async (row: ClientRow) => {
    const ok = confirm(`"${row.code}" danışanını silmek istiyor musunuz? Bu işlem danışana bağlı raporları da kaldırır.`);
    if (!ok) return;

    try {
      setDeletingClientId(row.id);
      setErr(null);
      setNotice(null);

      const { data: assessments, error: assessmentError } = await supabase
        .from("assessments_v2")
        .select("id")
        .eq("client_id", row.id)
        .is("deleted_at", null);

      if (assessmentError) {
        throw new Error("Danışana bağlı değerlendirmeler alınamadı: " + assessmentError.message);
      }

      const assessmentIds = (assessments || []).map((item: any) => item.id).filter(Boolean);

      if (assessmentIds.length > 0) {
        const { error: reportsDeleteError } = await supabase
          .from("reports")
          .delete()
          .in("assessment_id", assessmentIds);

        if (reportsDeleteError) {
          throw new Error("Danışana bağlı raporlar silinemedi: " + reportsDeleteError.message);
        }

        const { error: assessmentsDeleteError } = await supabase
          .from("assessments_v2")
          .delete()
          .in("id", assessmentIds);

        if (assessmentsDeleteError) {
          const { error: assessmentsArchiveError } = await supabase
            .from("assessments_v2")
            .update({ deleted_at: new Date().toISOString() })
            .in("id", assessmentIds);

          if (assessmentsArchiveError) {
            throw new Error("Danışana bağlı değerlendirmeler kaldırılamadı: " + assessmentsArchiveError.message);
          }
        }
      }

      const { error: clientDeleteError } = await supabase
        .from("clients")
        .delete()
        .eq("id", row.id);

      if (clientDeleteError) {
        const { error: clientArchiveError } = await supabase
        .from("clients")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", row.id);

        if (clientArchiveError) {
          throw new Error("Danışan silinemedi: " + clientArchiveError.message);
        }
      }

      setRows((prev) => prev.filter((item) => item.id !== row.id));
      setNotice(`"${row.code}" danışanı ve bağlı raporları kaldırıldı.`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Danışan silinirken beklenmeyen bir hata oluştu.";
      setErr(message);
    } finally {
      setDeletingClientId(null);
    }
  };

  return (
    <>
    <div className="dna-app-only dna-app-page space-y-4">
      <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="dna-app-section-title">Danışan yönetimi</div>
            <h1 className="mt-2 text-[26px] font-black leading-tight text-[#071b3a]">Danışanlar</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">Vaka durumunu gör, skora veya rapora hızlı geç.</p>
          </div>
          <Link href="/clients/new?surface=app" className="dna-btn shrink-0 px-4 py-3 text-sm font-black">
            Yeni
          </Link>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
          placeholder="Danışan kodu ara"
        />
        {err ? <div className="mt-3 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900">{err}</div> : null}
        {!err && notice ? <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">{notice}</div> : null}
      </section>

      <section className="grid grid-cols-3 gap-2">
        {[
          ["Toplam", computed.total],
          ["Skor", computed.pendingScore],
          ["Risk", computed.riskCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[18px] border border-slate-200 bg-white p-3 text-center shadow-sm">
            <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</div>
            <div className="mt-1 text-2xl font-black text-[#071b3a]">{value}</div>
          </div>
        ))}
      </section>

      <section className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {(["Tümü", "Aktif", "Bekliyor", "Arşiv", "Riskli"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k as any)}
            className={
              filter === k
                ? "shrink-0 rounded-full bg-blue-600 px-4 py-2 text-sm font-black text-white"
                : "shrink-0 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-600"
            }
          >
            {k}
          </button>
        ))}
      </section>

      <section className="space-y-3">
        {loading ? (
          <div className="rounded-[22px] border border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-500 shadow-sm">Yükleniyor...</div>
        ) : computed.rows.length === 0 ? (
          <div className="rounded-[22px] border border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-500 shadow-sm">
            Henüz danışan yok. İlk kaydı oluştur.
          </div>
        ) : (
          computed.rows.map((r) => (
            <article key={r.id} className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className={`mt-1 h-12 w-1.5 shrink-0 rounded-full ${riskBar(r.risk)}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={withSurface(`/clients/${r.id}`)} className="font-mono text-lg font-black text-[#071b3a]">
                        {r.code}
                      </Link>
                      <div className="mt-0.5 text-xs font-semibold text-slate-500">{progressLabel(r)}</div>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${badgeRisk(r.risk)}`}>{r.risk}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">Değerlendirme</div>
                      <div className="mt-1 text-sm font-bold text-slate-700">{r.lastAssessment}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">Rapor</div>
                      <div className="mt-1 text-sm font-bold text-slate-700">{r.lastReport}</div>
                    </div>
                  </div>
                  {r.note !== "—" ? <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{r.note}</p> : null}
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => onScoreClick(r)}
                      className={`min-h-11 rounded-2xl px-3 text-sm font-black ${
                        r.hasReport ? "border border-violet-200 bg-violet-50 text-violet-800" : "bg-blue-600 text-white"
                      }`}
                    >
                      {r.hasReport ? "Kilitli" : "Skor"}
                    </button>
                    <Link href={withSurface(`/clients/${r.id}`)} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700">
                      Detay
                    </Link>
                    <Link href={reportsHref(r)} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 px-3 text-sm font-black text-blue-700">
                      Rapor
                    </Link>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteClient(r)}
                    disabled={deletingClientId === r.id}
                    className="mt-3 text-xs font-bold text-slate-600 transition hover:text-slate-950 disabled:opacity-50"
                  >
                    {deletingClientId === r.id ? "Siliniyor..." : "Silme / arşiv işlemi"}
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </div>

    <div className="dna-web-only space-y-6">
      <div className="dna-card p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">Danışan Yönetimi</div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Danışan Listesi</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Danışan kayıtları anonim kod ile tutulur. Skor girişi ve rapor sürümleri bu kayıtlar üzerinden yürütülür.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] md:min-w-[420px]">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="dna-input w-full px-4 py-2.5 text-sm"
              placeholder="Danışan kodu ara (SM-...)"
            />
            <Link href="/clients/new" className="dna-btn px-4 py-2.5 text-sm font-semibold inline-flex items-center justify-center">
              Yeni Danışan
            </Link>
          </div>
        </div>

        {err ? <div className="mt-4 rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900">{err}</div> : null}
        {!err && notice ? <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">{notice}</div> : null}

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Toplam</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{computed.total}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aktif</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{computed.activeCount}</div>
          </div>
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-violet-800">Skor Bekleyen</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{computed.pendingScore}</div>
          </div>
          <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-900">Riskli</div>
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

      <div className="dna-card overflow-hidden p-0">
        <div className="md:hidden">
          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">Yükleniyor...</div>
          ) : computed.rows.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              Henüz danışan yok. “Yeni Danışan” ile ilk kaydı oluştur.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 bg-white">
              {computed.rows.map((r) => (
                <div key={r.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <span className={`mt-1 h-12 w-1.5 shrink-0 rounded-full ${riskBar(r.risk)}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link href={`/clients/${r.id}`} className="font-mono text-base font-semibold text-slate-900 hover:underline">
                            {r.code}
                          </Link>
                          <div className="mt-1 text-xs text-slate-500">{progressLabel(r)}</div>
                        </div>
                        <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeRisk(r.risk)}`}>
                          {r.risk}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                        <div className="rounded-xl bg-slate-50 p-3">
                          <div className="font-semibold uppercase tracking-wide text-slate-400">Değerlendirme</div>
                          <div className="mt-1 text-sm font-medium text-slate-700">{r.lastAssessment}</div>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <div className="font-semibold uppercase tracking-wide text-slate-400">Rapor</div>
                          <div className="mt-1 text-sm font-medium text-slate-700">{r.lastReport}</div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeStatus(r.status)}`}>
                          {r.status}
                        </span>
                        {r.note !== "—" ? <span className="line-clamp-1 text-xs text-slate-500">{r.note}</span> : null}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => onScoreClick(r)}
                          className={`inline-flex min-h-11 items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                            r.hasReport
                              ? "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100"
                              : "border-indigo-600 bg-white text-indigo-700 hover:bg-indigo-50"
                          }`}
                          title={
                            r.hasReport
                              ? "Bu vaka için rapor zaten oluşturulmuş. Yeniden skor girişine izin verilmez."
                              : "Bu vaka için skor girişine geç"
                          }
                        >
                          {r.hasReport ? "Skor Kilitli" : "Skor Gir"}
                        </button>
                        <Link href={`/clients/${r.id}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                          Detay
                        </Link>
                        <Link href={reportsHref(r)} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-indigo-600 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50">
                          Raporlar
                        </Link>
                        <button
                          type="button"
                          onClick={() => onDeleteClient(r)}
                          disabled={deletingClientId === r.id}
                          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Danışanı ve bağlı raporları sil"
                        >
                          {deletingClientId === r.id ? "Siliniyor..." : "Sil"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hidden overflow-auto md:block">
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
                            <div className="text-xs text-slate-400">{progressLabel(r)}</div>
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
                          <button
                            type="button"
                            onClick={() => onScoreClick(r)}
                            className={`inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                              r.hasReport
                                ? "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100"
                                : "border-indigo-600 bg-white text-indigo-700 hover:bg-indigo-50"
                            }`}
                            title={
                              r.hasReport
                                ? "Bu vaka için rapor zaten oluşturulmuş. Yeniden skor girişine izin verilmez."
                                : "Bu vaka için skor girişine geç"
                            }
                          >
                            {r.hasReport ? "Skor Girişi Kilitli" : "Skor Gir"}
                          </button>
                          <Link href={reportsHref(r)} className="inline-flex items-center justify-center rounded-xl border border-indigo-600 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50">
                            Raporlar
                          </Link>
                          <button
                            type="button"
                            onClick={() => onDeleteClient(r)}
                            disabled={deletingClientId === r.id}
                            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Danışanı ve bağlı raporları sil"
                          >
                            {deletingClientId === r.id ? "Siliniyor..." : "Sil"}
                          </button>
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
    </>
  );
}

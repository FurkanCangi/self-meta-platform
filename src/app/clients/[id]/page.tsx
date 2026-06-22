"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type ClientRow = {
  id: string;
  child_code: string;
  anamnez: string;
  created_at: string;
};

type EvalRow = {
  id: string;
  label: string;
  assessment_date: string;
  created_at: string;
  report_count: number;
};

function fmtDate(s: string) {
  try {
    const d = new Date(s);
    return d.toLocaleDateString("tr-TR", { year: "numeric", month: "short", day: "2-digit" });
  } catch {
    return s;
  }
}

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const clientId = params?.id;

  const [client, setClient] = useState<ClientRow | null>(null);
  const [evals, setEvals] = useState<EvalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const anamnezPreview = useMemo(() => {
    if (!client?.anamnez) return "—";
    return client.anamnez;
  }, [client]);
  const reportsHref = `/reports?client_id=${encodeURIComponent(clientId || "")}&client=${encodeURIComponent(
    client?.child_code || "",
  )}`;

  async function load() {
    setLoading(true);
    setErr(null);

    if (!clientId) {
      setLoading(false);
      setBusy(false);
      setErr("Danışan ID bulunamadı.");
      return;
    }

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user?.id) {
      setLoading(false);
      setBusy(false);
      router.replace("/login");
      return;
    }

    const { data: c, error: cErr } = await supabase
      .from("clients")
      .select("id, child_code, anamnez, created_at")
      .eq("id", clientId)
      .eq("owner_id", userRes.user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (cErr || !c) {
      setLoading(false);
      setBusy(false);
      setErr("Danışan bulunamadı: " + (cErr?.message || "—"));
      return;
    }

    const { data: a, error: aErr } = await supabase
      .from("assessments_v2")
      .select("id, label, assessment_date, created_at")
      .eq("client_id", clientId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (aErr) {
      setLoading(false);
      setBusy(false);
      setErr("Değerlendirmeler alınamadı: " + aErr.message);
      return;
    }

    const assessmentIds = (a || []).map((x: any) => x.id);
    let reportCounts: Record<string, number> = {};
    if (assessmentIds.length > 0) {
      const { data: r, error: rErr } = await supabase
        .from("reports")
        .select("assessment_id")
        .in("assessment_id", assessmentIds);

      if (!rErr && r) {
        for (const row of r as any[]) {
          reportCounts[row.assessment_id] = (reportCounts[row.assessment_id] || 0) + 1;
        }
      }
    }

    setClient(c as any);
    setEvals(
      (a || []).map((x: any) => ({
        id: x.id,
        label: x.label || "Değerlendirme",
        assessment_date: x.assessment_date || "",
        created_at: x.created_at,
        report_count: reportCounts[x.id] || 0,
      }))
    );

    setLoading(false);
    setBusy(false);
  }

  useEffect(() => {
    load();
  }, [clientId]);

  async function createEvaluation() {
    if (!clientId || !client?.child_code) return;
    setBusy(true);
    setErr(null);

    setBusy(false);
    router.push(`/assessments?client=${encodeURIComponent(client.child_code)}&client_id=${encodeURIComponent(clientId)}`);
  }

  async function softDeleteClient() {
    if (!clientId) return;
    const ok = confirm("Bu danışan ve bağlı rapor/değerlendirme kayıtları kaldırılacak. Devam?");
    if (!ok) return;

    setBusy(true);
    setErr(null);

    const { data: assessments, error: assessmentsError } = await supabase
      .from("assessments_v2")
      .select("id")
      .eq("client_id", clientId)
      .is("deleted_at", null);

    if (assessmentsError) {
      setBusy(false);
      setErr("Danışana bağlı değerlendirmeler alınamadı: " + assessmentsError.message);
      return;
    }

    const assessmentIds = (assessments || []).map((item: any) => item.id).filter(Boolean);

    if (assessmentIds.length > 0) {
      const { error: reportsDeleteError } = await supabase
        .from("reports")
        .delete()
        .in("assessment_id", assessmentIds);

      if (reportsDeleteError) {
        setBusy(false);
        setErr("Danışana bağlı raporlar silinemedi: " + reportsDeleteError.message);
        return;
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
          setBusy(false);
          setErr("Değerlendirmeler kaldırılamadı: " + assessmentsArchiveError.message);
          return;
        }
      }
    }

    const { error: deleteError } = await supabase
      .from("clients")
      .delete()
      .eq("id", clientId);

    if (deleteError) {
      const { error: archiveError } = await supabase
        .from("clients")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", clientId);

      if (archiveError) {
        setBusy(false);
        setErr("Arşivlenemedi: " + archiveError.message);
        return;
      }
    }

    setBusy(false);
    router.push("/clients");
  }

  return (
    <div className="space-y-6">
      <div className="dna-card p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">Danışan Yönetimi / Detay</div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">
              Danışan: <span className="font-mono">{client?.child_code || "—"}</span>
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Anamnez ve değerlendirme geçmişi bu ekranda izlenir.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 md:flex md:flex-wrap md:justify-end">
            <Link href="/clients" className="dna-btn-ghost px-4 py-2 text-sm font-semibold inline-flex items-center justify-center">
              Listeye Dön
            </Link>
            <button
              type="button"
              onClick={createEvaluation}
              disabled={busy || loading}
              className="dna-btn px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {busy ? "İşleniyor..." : "Yeni Değerlendirme Oluştur"}
            </button>
            <button
              type="button"
              onClick={softDeleteClient}
              disabled={busy || loading}
              className="dna-btn-ghost px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              Danışanı Kaldır
            </button>
          </div>
        </div>

        {err ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div> : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="dna-card p-6">
          <div className="text-sm font-semibold text-slate-900">Değerlendirmeler</div>

          {loading ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Yükleniyor...</div>
          ) : evals.length === 0 ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Henüz değerlendirme yok. “Yeni Değerlendirme Oluştur” ile başlayabilirsin.
            </div>
          ) : (
            <>
              <div className="mt-4 space-y-3 md:hidden">
                {evals.map((e) => (
                  <div key={e.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">{e.label}</div>
                        <div className="mt-1 text-sm text-slate-500">{e.assessment_date ? e.assessment_date : fmtDate(e.created_at)}</div>
                      </div>
                      <span className="inline-flex shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {e.report_count} sürüm
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Link
                        href={`/assessments?client=${encodeURIComponent(client?.child_code || "")}&client_id=${encodeURIComponent(clientId || "")}`}
                        className="dna-btn px-3 py-2 text-xs font-semibold"
                      >
                        Skor Girişi
                      </Link>
                      <Link href={reportsHref} className="dna-btn-ghost px-3 py-2 text-xs font-semibold">
                        Raporlar
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 hidden overflow-auto rounded-2xl border border-slate-200 bg-white md:block">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Başlık</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Tarih</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Rapor</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {evals.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-4 font-semibold text-slate-900">{e.label}</td>
                        <td className="px-4 py-4 text-slate-600">{e.assessment_date ? e.assessment_date : fmtDate(e.created_at)}</td>
                        <td className="px-4 py-4 text-slate-600">{e.report_count} sürüm</td>
                        <td className="px-4 py-4 text-right">
                          <div className="inline-flex gap-2">
                            <Link
                              href={`/assessments?client=${encodeURIComponent(client?.child_code || "")}&client_id=${encodeURIComponent(clientId || "")}`}
                              className="dna-btn px-3 py-2 text-xs font-semibold"
                            >
                              Skor Girişi
                            </Link>
                            <Link href={reportsHref} className="dna-btn-ghost px-3 py-2 text-xs font-semibold">
                              Raporlar
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="dna-card p-6">
          <div className="text-sm font-semibold text-slate-900">Anamnez</div>
          <div className="mt-2 text-xs text-slate-500">
            Bu alan danışan kaydında saklanır ve rapor üretiminde kullanılacaktır.
          </div>

          <textarea
            readOnly
            value={anamnezPreview}
            className="mt-4 h-[360px] w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-800 md:h-[620px]"
          />
        </div>
      </div>
    </div>
  );
}

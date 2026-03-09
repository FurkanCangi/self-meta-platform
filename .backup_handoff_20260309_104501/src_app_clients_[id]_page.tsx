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

  async function load() {
    setLoading(true);
    setErr(null);

    if (!clientId) {
      setLoading(false);
      setErr("Danışan ID bulunamadı.");
      return;
    }

    const { data: c, error: cErr } = await supabase
      .from("clients")
      .select("id, child_code, anamnez, created_at")
      .eq("id", clientId)
      .is("deleted_at", null)
      .maybeSingle();

    if (cErr || !c) {
      setLoading(false);
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
  }

  useEffect(() => {
    load();
  }, [clientId]);

  async function createEvaluation() {
    if (!clientId || !client?.child_code) return;
    setBusy(true);
    setErr(null);

    const { data: ins, error } = await supabase
      .from("assessments_v2")
      .insert({
        client_id: clientId,
        label: "Değerlendirme",
        assessment_date: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();

    if (error || !ins?.id) {
      setBusy(false);
      setErr("Değerlendirme oluşturulamadı: " + (error?.message || "—"));
      return;
    }

    setBusy(false);
    router.push(`/assessments?client=${encodeURIComponent(client.child_code)}&evaluation_id=${encodeURIComponent(ins.id)}`);
  }

  async function softDeleteClient() {
    if (!clientId) return;
    const ok = confirm("Bu danışan arşive alınacak (silinmeyecek). Devam?");
    if (!ok) return;

    setBusy(true);
    setErr(null);

    const { error } = await supabase
      .from("clients")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", clientId);

    if (error) {
      setBusy(false);
      setErr("Arşivlenemedi: " + error.message);
      return;
    }

    setBusy(false);
    router.push("/clients");
  }

  return (
    <div className="space-y-6">
      <div className="selfmeta-card p-5">
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

          <div className="flex flex-wrap gap-2">
            <Link href="/clients" className="selfmeta-btn-ghost px-4 py-2 text-sm font-semibold inline-flex items-center justify-center">
              Listeye Dön
            </Link>
            <button
              type="button"
              onClick={createEvaluation}
              disabled={busy || loading}
              className="selfmeta-btn px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {busy ? "İşleniyor..." : "Yeni Değerlendirme Oluştur"}
            </button>
            <button
              type="button"
              onClick={softDeleteClient}
              disabled={busy || loading}
              className="selfmeta-btn-ghost px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              Arşivle
            </button>
          </div>
        </div>

        {err ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div> : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="selfmeta-card p-6">
          <div className="text-sm font-semibold text-slate-900">Değerlendirmeler</div>

          {loading ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Yükleniyor...</div>
          ) : evals.length === 0 ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Henüz değerlendirme yok. “Yeni Değerlendirme Oluştur” ile başlayabilirsin.
            </div>
          ) : (
            <div className="mt-4 overflow-auto rounded-2xl border border-slate-200 bg-white">
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
                            href={`/assessments?client=${encodeURIComponent(client?.child_code || "")}&evaluation_id=${encodeURIComponent(e.id)}`}
                            className="selfmeta-btn px-3 py-2 text-xs font-semibold"
                          >
                            Skor Girişi
                          </Link>
                          <Link href="/reports" className="selfmeta-btn-ghost px-3 py-2 text-xs font-semibold">
                            Raporlar
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="selfmeta-card p-6">
          <div className="text-sm font-semibold text-slate-900">Anamnez</div>
          <div className="mt-2 text-xs text-slate-500">
            Bu alan danışan kaydında saklanır ve rapor üretiminde kullanılacaktır.
          </div>

          <textarea
            readOnly
            value={anamnezPreview}
            className="mt-4 h-[620px] w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-800"
          />
        </div>
      </div>
    </div>
  );
}

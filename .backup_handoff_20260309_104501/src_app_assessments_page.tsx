"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AssessmentsPage() {
  const sp = useSearchParams();
  const clientCode = sp.get("client") || "";

  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);

  const [form, setForm] = useState({
    sub1: 0,
    sub2: 0,
    sub3: 0,
    sub4: 0,
  });

  const total = useMemo(() => form.sub1 + form.sub2 + form.sub3 + form.sub4, [form]);

  const riskLabel = useMemo(() => {
    if (total >= 80) return "Yüksek Risk";
    if (total >= 60) return "Orta Risk";
    return "Düşük Risk";
  }, [total]);

  const setValue = (key: keyof typeof form, value: number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  async function createAssessment() {
    setMsg(null);
    setCreating(true);

    if (!clientCode) {
      setCreating(false);
      setMsg("Danışan kodu bulunamadı. Danışan listesinden 'Skor Gir' ile gel.");
      return;
    }

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user?.id) {
      setCreating(false);
      setMsg("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
      return;
    }

    const { data: clientRow, error: cErr } = await supabase
      .from("clients")
      .select("id, child_code")
      .eq("child_code", clientCode)
      .is("deleted_at", null)
      .maybeSingle();

    if (cErr || !clientRow?.id) {
      setCreating(false);
      setMsg("Bu danışan DB'de bulunamadı. Danışanı önce oluştur.");
      return;
    }

    const { data: ins, error: iErr } = await supabase
      .from("assessments_v2")
      .insert({
        client_id: clientRow.id,
        label: "Değerlendirme",
        assessment_date: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();

    if (iErr || !ins?.id) {
      setCreating(false);
      setMsg("Assessment oluşturulamadı: " + (iErr?.message || "Bilinmeyen hata"));
      return;
    }

    setAssessmentId(ins.id);
    setCreating(false);
    setMsg("Assessment kaydı oluşturuldu (DB). Skor/AI daha sonra bağlanacak.");
  }

  return (
    <div className="space-y-6">
      <div className="selfmeta-card p-5">
        <div className="text-xs font-medium text-slate-400">Klinik Değerlendirme</div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Skor Girişi</h1>
        <p className="mt-2 text-sm text-slate-500">
          Şu aşamada hedef: danışan için assessment kaydı oluşturmak. Skor/AI rapor daha sonra eklenecek.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={createAssessment}
            disabled={creating}
            className="selfmeta-btn px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {creating ? "Oluşturuluyor..." : "Assessment Oluştur (DB)"}
          </button>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
            Danışan: <span className="font-semibold text-slate-900">{clientCode || "—"}</span>
            <span className="mx-2 text-slate-300">•</span>
            Assessment ID: <span className="font-mono text-xs">{assessmentId || "—"}</span>
          </div>
        </div>

        {msg ? <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900/80">{msg}</div> : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="selfmeta-card p-6">
          <div className="grid gap-6 md:grid-cols-2">
            {(["sub1", "sub2", "sub3", "sub4"] as const).map((key, i) => (
              <div key={key} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="text-sm font-semibold text-slate-700">Alt Boyut {i + 1}</div>
                <input
                  type="number"
                  min={0}
                  max={40}
                  value={form[key]}
                  onChange={(e) => setValue(key, Number(e.target.value))}
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg font-semibold text-slate-900 outline-none focus:border-indigo-400"
                />
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs font-medium text-slate-500">Toplam Skor</div>
            <div className="mt-2 text-4xl font-semibold text-slate-900">{total}</div>
          </div>
        </div>

        <div className="selfmeta-card p-6">
          <div className="text-xs font-medium text-slate-400">Ön Sınıflama</div>
          <div className="mt-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            {riskLabel}
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            Bu sınıflama şimdilik demodur. Gerçek deterministik motor ve AI rapor katmanı sonraki aşamada bağlanacak.
          </div>
        </div>
      </div>
    </div>
  );
}

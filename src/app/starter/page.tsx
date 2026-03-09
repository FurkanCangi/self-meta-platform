"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type Stats = {
  clients: number;
  assessments: number;
  reports: number;
};

export default function StarterPage() {
  const [stats, setStats] = useState<Stats>({
    clients: 0,
    assessments: 0,
    reports: 0,
  });

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadStats() {
      setLoading(true);
      setErr(null);

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes?.user?.id) {
        if (!alive) return;
        setErr("Oturum bilgisi alınamadı.");
        setLoading(false);
        return;
      }

      const userId = userRes.user.id;

      const { count: clientCount, error: cErr } = await supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId)
        .is("deleted_at", null);

      const { data: ownedClients } = await supabase
        .from("clients")
        .select("id")
        .eq("owner_id", userId)
        .is("deleted_at", null);

      const clientIds = (ownedClients || []).map((x: any) => x.id);

      let assessmentCount = 0;
      let reportCount = 0;

      if (clientIds.length > 0) {
        const { count: aCount } = await supabase
          .from("assessments_v2")
          .select("id", { count: "exact", head: true })
          .in("client_id", clientIds)
          .is("deleted_at", null);

        assessmentCount = aCount ?? 0;

        const { data: assessmentsData } = await supabase
          .from("assessments_v2")
          .select("id")
          .in("client_id", clientIds)
          .is("deleted_at", null);

        const assessmentIds = (assessmentsData || []).map((x: any) => x.id);

        if (assessmentIds.length > 0) {
          const { count: rCount } = await supabase
            .from("reports")
            .select("id", { count: "exact", head: true })
            .in("assessment_id", assessmentIds);

          reportCount = rCount ?? 0;
        }
      }

      if (!alive) return;

      if (cErr) {
        setErr("Panel verileri alınamadı.");
      }

      setStats({
        clients: clientCount ?? 0,
        assessments: assessmentCount,
        reports: reportCount,
      });

      setLoading(false);
    }

    loadStats();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="selfmeta-card p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Klinik Panel</h1>
        <p className="mt-2 text-sm text-slate-500">
          Danışanlar, değerlendirmeler ve raporlar burada yönetilir.
        </p>
        {err ? <div className="mt-4 text-sm text-rose-600">{err}</div> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-500">Toplam Danışan</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{loading ? "..." : stats.clients}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-500">Aktif Değerlendirme</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{loading ? "..." : stats.assessments}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-500">Rapor Sayısı</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{loading ? "..." : stats.reports}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/clients/new" className="selfmeta-card p-6 hover:shadow-md transition">
          <div className="text-lg font-semibold text-slate-900">Yeni Danışan</div>
          <div className="mt-1 text-sm text-slate-500">Kayıt ve anamnez oluştur</div>
        </Link>

        <Link href="/assessments" className="selfmeta-card p-6 hover:shadow-md transition">
          <div className="text-lg font-semibold text-slate-900">Skor Girişi</div>
          <div className="mt-1 text-sm text-slate-500">Değerlendirme skorlarını gir</div>
        </Link>

        <Link href="/reports" className="selfmeta-card p-6 hover:shadow-md transition">
          <div className="text-lg font-semibold text-slate-900">Raporlar</div>
          <div className="mt-1 text-sm text-slate-500">Rapor geçmişini görüntüle</div>
        </Link>
      </div>
    </div>
  );
}

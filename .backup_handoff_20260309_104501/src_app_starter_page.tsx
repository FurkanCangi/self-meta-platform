import Link from "next/link";

const stats = [
  { label: "Toplam Danışan", value: "24", note: "3 yeni kayıt bu hafta", tone: "indigo" },
  { label: "Bekleyen Rapor", value: "6", note: "2 rapor bugün üretilecek", tone: "amber" },
  { label: "Aktif Değerlendirme", value: "4", note: "1 tanesi riskli bayraklı", tone: "rose" },
  { label: "Tamamlanan Oturum", value: "18", note: "Son 30 gün özeti", tone: "emerald" },
];

const quickActions = [
  { title: "Yeni Danışan", href: "/clients/new", text: "Kayıt + anamnez", icon: "＋", tone: "indigo" },
  { title: "Skor Girişi", href: "/assessments", text: "Alt + toplam skor", icon: "✎", tone: "indigo" },
  { title: "Rapor Geçmişi", href: "/reports", text: "Sürüm ve kopyala", icon: "⎘", tone: "indigo" },
  { title: "İlerleme", href: "/progress", text: "Zaman çizgisi", icon: "↗", tone: "indigo" },
];

const recentCases = [
  { code: "SM-014", step: "Skor girişi tamamlandı", report: "Rapor v3", risk: "Orta", date: "Bugün 10:40" },
  { code: "SM-021", step: "Rapor oluşturuldu", report: "Rapor v2", risk: "Düşük", date: "Bugün 09:15" },
  { code: "SM-008", step: "Yeni danışan eklendi", report: "Bekliyor", risk: "İzlem", date: "Dün 17:30" },
  { code: "SM-032", step: "Değerlendirme planlandı", report: "Bekliyor", risk: "Yüksek", date: "Dün 13:05" },
];

const priorities = [
  "SM-032 için skor girişi tamamlanacak.",
  "SM-014 için rapor v4 oluşturulacak.",
  "Yeni kayıt ekranında anamnez alanı kontrol edilecek.",
  "Teorik eğitimler bölümüne iki içerik daha eklenecek.",
];

function badgeRisk(risk: string) {
  if (risk === "Yüksek") return "bg-rose-50 text-rose-700 border-rose-200";
  if (risk === "Orta") return "bg-amber-50 text-amber-700 border-amber-200";
  if (risk === "Düşük") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function statTone(t: string) {
  if (t === "amber") return "bg-amber-50 text-amber-700 border-amber-200";
  if (t === "rose") return "bg-rose-50 text-rose-700 border-rose-200";
  if (t === "emerald") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-indigo-50 text-indigo-700 border-indigo-200";
}

export default function StarterPage() {
  return (
    <div className="space-y-5">
      <div className="selfmeta-card p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              Terapist Paneli
            </span>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Klinik çalışma alanı</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                Danışan kayıtları, skor girişi, rapor geçmişi ve kaynak içerikleri tek panel üzerinden yönetilir.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/clients" className="selfmeta-btn-ghost px-4 py-2 text-sm font-semibold inline-flex items-center justify-center">
                Danışanlara Git
              </Link>
              <Link href="/assessments" className="selfmeta-btn px-4 py-2 text-sm font-semibold inline-flex items-center justify-center">
                Skor Gir
              </Link>
              <Link href="/reports" className="selfmeta-btn-ghost px-4 py-2 text-sm font-semibold inline-flex items-center justify-center">
                Raporları Aç
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:w-[520px]">
            {stats.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</div>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statTone(item.tone)}`}>
                    {item.value}
                  </span>
                </div>
                <div className="mt-3 text-3xl font-semibold text-slate-900">{item.value}</div>
                <div className="mt-1 text-xs text-slate-500">{item.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {quickActions.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-base font-semibold text-slate-900">{item.title}</div>
                <div className="mt-1 text-sm text-slate-500">{item.text}</div>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 font-semibold">
                {item.icon}
              </div>
            </div>
            <div className="mt-4 inline-flex items-center text-sm font-semibold text-indigo-700">
              Aç →
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2 selfmeta-card p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Son Klinik Hareketler</h2>
              <p className="mt-1 text-sm text-slate-500">En güncel danışan ve rapor akışı</p>
            </div>
            <Link href="/reports" className="selfmeta-btn-ghost px-4 py-2 text-sm font-semibold inline-flex items-center justify-center">
              Raporlara Git
            </Link>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Danışan</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Son Adım</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Rapor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Risk</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Zaman</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {recentCases.map((item) => (
                  <tr key={item.code} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3 font-semibold text-slate-900">{item.code}</td>
                    <td className="px-4 py-3 text-slate-600">{item.step}</td>
                    <td className="px-4 py-3 text-slate-600">{item.report}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeRisk(item.risk)}`}>
                        {item.risk}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{item.date}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <Link href="/assessments" className="selfmeta-btn-ghost px-3 py-2 text-xs font-semibold">
                          Skor
                        </Link>
                        <Link href="/reports" className="selfmeta-btn-ghost px-3 py-2 text-xs font-semibold">
                          Rapor
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Panel akışı: danışan kaydı → skor girişi → rapor sürümü.
          </div>
        </div>

        <div className="space-y-5">
          <div className="selfmeta-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Bugün Öncelikli</h2>
              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                4 görev
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {priorities.map((item, idx) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-sm font-semibold text-white">
                    {idx + 1}
                  </div>
                  <div className="text-sm leading-6 text-slate-600">{item}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="selfmeta-card p-6">
            <h2 className="text-lg font-semibold text-slate-900">Panel Notu</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Paketler ve pazarlama ekranları landing tarafında kalır. Panel tarafı yalnızca kayıt, skor ve rapor akışını gösterir.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/trainings" className="selfmeta-btn-ghost px-4 py-2 text-sm font-semibold">
                Eğitimler
              </Link>
              <Link href="/blog" className="selfmeta-btn-ghost px-4 py-2 text-sm font-semibold">
                Blog
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

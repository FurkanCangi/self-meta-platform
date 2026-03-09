import Link from "next/link";

const summary = [
  { label: "Toplam Rapor Sürümü", value: "42", note: "Tüm danışanlar", tone: "base" },
  { label: "Bu Ay Oluşturulan", value: "11", note: "Güncel dönem", tone: "base" },
  { label: "Riskli Bayrak", value: "5", note: "Yakın takip önerilir", tone: "risk" },
];

const timeline = [
  { date: "02 Mart 2026", code: "SM-014", title: "Rapor v4 oluşturuldu", text: "Genel özet güncellendi, risk alanları orta düzeyde kaldı.", version: "V4", state: "final", risk: "Orta" },
  { date: "01 Mart 2026", code: "SM-021", title: "Skorlar güncellendi", text: "Alt boyut 2 ve toplam skor artışı izlendi.", version: "V3", state: "rev", risk: "Düşük" },
  { date: "28 Şubat 2026", code: "SM-008", title: "İlk rapor kaydedildi", text: "Deterministik rapor başarıyla sürümlendi.", version: "V2", state: "rev", risk: "İzlem" },
  { date: "27 Şubat 2026", code: "SM-032", title: "Yeni danışan planlandı", text: "Anamnez kaydı oluşturuldu, skor girişi bekleniyor.", version: "V1", state: "draft", risk: "Yüksek" },
];

function toneCard(t: string) {
  if (t === "risk") return "border-rose-200 bg-rose-50";
  return "border-slate-200 bg-white";
}
function riskBadge(r: string) {
  if (r === "Yüksek") return "border-rose-200 bg-rose-50 text-rose-700";
  if (r === "Orta") return "border-amber-200 bg-amber-50 text-amber-700";
  if (r === "Düşük") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}
function versionBadge(state: string) {
  if (state === "final") return "border-indigo-200 bg-indigo-50 text-indigo-700";
  if (state === "draft") return "border-slate-200 bg-slate-100 text-slate-700";
  return "border-slate-200 bg-white text-slate-700";
}

export default function ProgressReportsPage() {
  return (
    <div className="space-y-6">
      <div className="selfmeta-card p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">Gösterge Paneli / İlerleme</div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">İlerleme Raporları</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Danışan bazlı rapor sürümleri ve zamansal ilerleme burada izlenir. Nihai sürümler immutable tutulur; yeni revizyonlar ayrı kayıt olarak listelenir.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/reports" className="selfmeta-btn-ghost px-4 py-2 text-sm font-semibold inline-flex items-center justify-center">
              Rapor Geçmişi
            </Link>
            <Link href="/assessments" className="selfmeta-btn px-4 py-2 text-sm font-semibold inline-flex items-center justify-center">
              Yeni Rapor Üret
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {summary.map((item) => (
          <div key={item.label} className={`rounded-2xl border p-5 shadow-sm ${toneCard(item.tone)}`}>
            <div className="text-sm font-medium text-slate-500">{item.label}</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{item.value}</div>
            <div className="mt-2 text-sm text-slate-500">{item.note}</div>
          </div>
        ))}
      </div>

      <div className="selfmeta-card p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Sürüm Zaman Çizgisi</h2>
            <p className="mt-1 text-sm text-slate-500">En son güncellemeler ve rapor akışı</p>
          </div>
          <div className="text-xs font-medium text-slate-400">Son 4 sürüm</div>
        </div>

        <div className="mt-6 grid gap-4">
          {timeline.map((item, idx) => (
            <div key={item.code + item.date} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
              <div className="grid gap-4 md:grid-cols-[160px_24px_1fr_220px] md:items-start">
                <div className="text-sm font-medium text-slate-500">{item.date}</div>

                <div className="relative hidden md:block">
                  <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-slate-200" />
                  <div className="relative z-10 mx-auto mt-1 h-3 w-3 rounded-full bg-indigo-600" />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-base font-semibold text-slate-900">{item.code} · {item.title}</div>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${riskBadge(item.risk)}`}>{item.risk}</span>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-500">{item.text}</div>
                </div>

                <div className="flex flex-wrap gap-2 md:justify-end">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${versionBadge(item.state)}`}>
                    {item.version}{item.state === "final" ? " · Nihai" : item.state === "draft" ? " · Taslak" : ""}
                  </span>
                  <Link href="/reports" className="selfmeta-btn-ghost px-3 py-2 text-xs font-semibold inline-flex items-center justify-center">
                    Aç
                  </Link>
                  <Link href="/reports" className="selfmeta-btn-ghost px-3 py-2 text-xs font-semibold inline-flex items-center justify-center">
                    Karşılaştır
                  </Link>
                </div>
              </div>

              {idx === 0 && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm leading-6 text-indigo-900/80">
                  Bu sürüm “nihai” olarak işaretlenmiştir. Yeni revizyonlar ayrı kayıt olarak oluşturulur.
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

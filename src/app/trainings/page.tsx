const modules = [
  {
    title: "Klinik Raporlama Temelleri",
    level: "Başlangıç",
    duration: "35 dk",
    summary: "Deterministik çekirdek, risk alanı işaretleme ve rapor iskeleti mantığı.",
    items: ["Rapor yapısı", "Bayrak mantığı", "Kısa not yazımı"],
  },
  {
    title: "Skor Girişi Standardizasyonu",
    level: "Orta",
    duration: "28 dk",
    summary: "Alt boyut ve toplam skor girişinde hata azaltma ve veri tutarlılığı.",
    items: ["Toplam-alt skor kontrolü", "Kayıt akışı", "Versiyonlama mantığı"],
  },
  {
    title: "Anamnezden Rapor Diline Geçiş",
    level: "İleri",
    duration: "42 dk",
    summary: "Uzun anamnez metninin kısa, açık ve klinik dille rapora taşınması.",
    items: ["Kısa özet çıkarımı", "Risk odakları", "Açıklayıcı klinik dil"],
  },
  {
    title: "Demo Sunum Akışı",
    level: "Pratik",
    duration: "18 dk",
    summary: "Teknopark sunumunda ürün akışının 5 dakikada etkili gösterimi.",
    items: ["Landing akışı", "Panel geçişi", "Rapor gösterimi"],
  },
];

export default function TrainingsPage() {
  return (
    <div className="space-y-6">
      <div className="selfmeta-card p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">Eğitimler ve Kaynaklar / Eğitimler</div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Teorik Eğitimler</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Bu bölüm şimdilik semboliktir. İçerikler sonraki aşamada genişletilecek ve modüler hale getirilecektir.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
              İlerleme: <span className="font-semibold text-slate-900">0%</span>
              <span className="mx-2 text-slate-300">•</span>
              <span className="text-slate-500">{modules.length} modül</span>
            </div>
            <button className="selfmeta-btn-ghost px-4 py-2 text-sm font-semibold">Tümü</button>
            <button className="selfmeta-btn px-4 py-2 text-sm font-semibold">Yeni Modül (yakında)</button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {modules.map((item) => (
          <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                {item.level}
              </span>
              <span className="text-sm font-medium text-slate-500">{item.duration}</span>
            </div>

            <h2 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{item.summary}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {item.items.map((sub) => (
                <span
                  key={sub}
                  className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {sub}
                </span>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button className="selfmeta-btn-ghost px-4 py-2 text-sm font-semibold">Ön İzleme</button>
              <button className="selfmeta-btn px-4 py-2 text-sm font-semibold opacity-70 cursor-not-allowed">
                İçeriği Aç (yakında)
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const posts = [
  {
    tag: "Raporlama",
    title: "Kısa klinik rapor tasarımı: minimum yapı, maksimum netlik",
    summary: "Deterministik çekirdek + sade başlıklar + risk odağı. Bu yaklaşım raporu hem okunabilir hem de denetlenebilir tutar.",
    meta: "Taslak · 3 dk okuma",
  },
  {
    tag: "Skorlama",
    title: "Alt boyut + toplam skor: birlikte yorumlama çerçevesi",
    summary: "Toplam skor tek başına yeterli değildir. Alt boyut dağılımları, klinik örüntüyü daha iyi görünür kılar.",
    meta: "Taslak · 4 dk okuma",
  },
  {
    tag: "Yapay Zeka",
    title: "LLM sadece dili iyileştirir: neden analiz çekirdeği ayrı olmalı?",
    summary: "Kontrol edilebilirlik için rapor iskeleti ve sınıflama deterministik olmalı; LLM yalnızca metin akıcılığını iyileştirmeli.",
    meta: "Taslak · 4 dk okuma",
  },
  {
    tag: "İzlem",
    title: "Versiyonlu rapor geçmişi: şeffaf izlem ve karşılaştırma",
    summary: "Her raporu immutable tutmak; değişimi izlemeyi, geriye dönük denetimi ve klinik tutarlılığı güçlendirir.",
    meta: "Taslak · 3 dk okuma",
  },
  {
    tag: "Anamnez",
    title: "Anamnez → rapor özeti: hangi bilgiler korunmalı?",
    summary: "Başvuru nedeni, işlevsel güçlük alanları ve bağlam bilgisi kaybolmadan kısa bir özet üretmek için pratik bir çerçeve.",
    meta: "Taslak · 5 dk okuma",
  },
  {
    tag: "Sunum",
    title: "Demo akışı: 5 dakikada güven veren ekran sırası",
    summary: "Landing → danışan listesi → skor girişi → rapor ekranı. En hızlı güven inşa eden dört kritik adım.",
    meta: "Taslak · 2 dk okuma",
  },
];

export default function BlogPage() {
  return (
    <div className="space-y-6">
      <div className="selfmeta-card p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">Eğitimler ve Kaynaklar / Blog</div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Akademik Blog</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Bu bölüm şimdilik semboliktir. İleride içerik ekleme ve kategori yönetimi yapılacaktır.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="selfmeta-btn-ghost px-4 py-2 text-sm font-semibold">Tüm Etiketler</button>
            <button className="selfmeta-btn px-4 py-2 text-sm font-semibold">Yeni Yazı (yakında)</button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {posts.map((item) => (
          <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                {item.tag}
              </span>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{item.meta}</span>
            </div>

            <h2 className="mt-4 text-lg font-semibold leading-7 text-slate-900">{item.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">{item.summary}</p>

            <div className="mt-6 flex items-center justify-between">
              <button className="selfmeta-btn-ghost px-4 py-2 text-sm font-semibold">Yazıyı Aç</button>
              <span className="text-xs text-slate-400">Taslak</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

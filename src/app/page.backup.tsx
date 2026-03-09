import Link from "next/link";
import {
  FiActivity,
  FiArrowRight,
  FiBarChart2,
  FiBookOpen,
  FiCheckCircle,
  FiClipboard,
  FiClock,
  FiDatabase,
  FiFileText,
  FiLayers,
  FiShield,
  FiUsers,
} from "react-icons/fi";

const solutions = [
  {
    icon: FiClipboard,
    title: "Yapılandırılmış Anamnez",
    text: "Serbest metin karmaşasını azaltan, klinik veri toplama mantığına uygun çok katmanlı anamnez girişi.",
  },
  {
    icon: FiBarChart2,
    title: "Skor Girişi ve Bayraklama",
    text: "Alt boyut ve toplam skor üzerinden hızlı giriş, deterministik eşik kontrolü ve risk işaretleme.",
  },
  {
    icon: FiFileText,
    title: "Versiyonlu Rapor Geçmişi",
    text: "Her değerlendirme ayrı sürüm olarak tutulur; immutable kayıt mantığı ile geçmiş korunur.",
  },
  {
    icon: FiBookOpen,
    title: "Teknik Eğitim ve Klinik Kaynak",
    text: "Panel içine gömülü teorik eğitimler ve metodoloji içerikleriyle operasyonel bilgi desteği.",
  },
];

const engineCards = [
  {
    icon: FiDatabase,
    title: "Structured Input Layer",
    text: "Anamnez, skor ve vaka alanları şematik yapıda tutulur.",
  },
  {
    icon: FiActivity,
    title: "Deterministic Core",
    text: "Skor doğrulama, flag üretimi ve rapor iskeleti kurallarla çalışır.",
  },
  {
    icon: FiLayers,
    title: "Versioning Engine",
    text: "Raporlar assessment bazında ayrı sürümler olarak kaydedilir.",
  },
  {
    icon: FiShield,
    title: "LLM Guardrail",
    text: "Dil akıcılığı iyileşebilir; sınıflama ve klinik iskelet değişmez.",
  },
];

const therapistItems = [
  "Danışan listesi ve kayıt akışı",
  "Yapılandırılmış anamnez alanları",
  "Tek ölçek skor girişi",
  "Anlık risk etiketi",
  "Versiyonlu rapor görüntüleme",
  "Klinik eğitim ve metodoloji alanı",
];

const workflow = [
  {
    no: "01",
    title: "Danışan kaydı oluşturulur",
    text: "Anonim kod, anamnez ve klinik bağlam tek akışta kaydedilir.",
  },
  {
    no: "02",
    title: "Alt boyut skorları girilir",
    text: "Madde düzeyi değil, klinik operasyona uygun alt boyut + toplam skor mantığı kullanılır.",
  },
  {
    no: "03",
    title: "Deterministik rapor üretilir",
    text: "Sınıflama, bayrak ve rapor iskeleti kural tabanlı çekirdekten gelir.",
  },
  {
    no: "04",
    title: "Versiyon geçmişi korunur",
    text: "Her yeni rapor ayrı sürüm olur; önceki kayıtların üstüne yazılmaz.",
  },
];

const packages = [
  {
    key: "demo",
    name: "Demo",
    price: "0 TL",
    note: "Teknopark sunumu ve pilot akış",
    cta: "Demoyu İncele",
    featured: false,
  },
  {
    key: "expert",
    name: "Uzman",
    price: "1.490 TL / ay",
    note: "Tek terapist / tek panel",
    cta: "Başlat",
    featured: false,
  },
  {
    key: "pro",
    name: "Profesyonel",
    price: "2.990 TL / ay",
    note: "Daha yüksek vaka hacmi",
    cta: "En Güçlü Paket",
    featured: true,
  },
  {
    key: "corp",
    name: "Kurumsal",
    price: "Özel Teklif",
    note: "Klinik ekipler ve çok kullanıcı",
    cta: "Görüşme Planla",
    featured: false,
  },
] as const;

const pricingRows = [
  {
    feature: "Yapılandırılmış anamnez",
    values: { demo: true, expert: true, pro: true, corp: true },
  },
  {
    feature: "Tek ölçek skor girişi",
    values: { demo: true, expert: true, pro: true, corp: true },
  },
  {
    feature: "Versiyonlu rapor geçmişi",
    values: { demo: true, expert: true, pro: true, corp: true },
  },
  {
    feature: "Teorik eğitim alanı",
    values: { demo: "Sınırlı", expert: "Aylık 10 saat", pro: "Aylık 25 saat", corp: "Sınırsız" },
  },
  {
    feature: "Aylık aktif danışan",
    values: { demo: "5", expert: "25", pro: "75", corp: "Sınırsız" },
  },
  {
    feature: "Uzman kullanıcı erişimi",
    values: { demo: "1", expert: "1", pro: "3", corp: "Çoklu" },
  },
  {
    feature: "Admin rolü",
    values: { demo: false, expert: false, pro: true, corp: true },
  },
  {
    feature: "Klinik onboarding",
    values: { demo: false, expert: false, pro: true, corp: true },
  },
  {
    feature: "Özel uyarlama / entegrasyon",
    values: { demo: false, expert: false, pro: false, corp: true },
  },
];

function renderCell(value: boolean | string) {
  if (typeof value === "boolean") {
    return value ? (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <FiCheckCircle className="h-4 w-4" />
      </span>
    ) : (
      <span className="inline-flex text-lg font-semibold text-rose-500">×</span>
    );
  }

  return <span className="text-sm font-medium text-slate-700">{value}</span>;
}

export default function HomePage() {
  return (
    <main className="relative overflow-hidden bg-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] bg-[radial-gradient(circle_at_top,rgba(211,234,241,0.7),transparent_58%)]" />
      <div className="pointer-events-none absolute right-0 top-24 -z-10 h-80 w-80 rounded-full bg-[#dbeef3] blur-3xl" />
      <div className="pointer-events-none absolute left-0 top-[520px] -z-10 h-80 w-80 rounded-full bg-[#edf7fa] blur-3xl" />

      <section className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 lg:px-8 lg:pt-10">
        <div className="rounded-[40px] border border-[#d7eaef] bg-[#eef8fb] p-4 shadow-[0_30px_90px_-45px_rgba(15,23,42,0.35)] sm:p-6 lg:p-8">
          <div className="rounded-[28px] border border-white/70 bg-white/70 px-5 py-4 backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="text-4xl font-semibold tracking-tight text-[#1d5c84] sm:text-5xl">self</div>
                  <span className="absolute -right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#2b86b3]" />
                  <span className="absolute -right-5 top-4 h-2.5 w-2.5 rounded-full bg-[#2b86b3]" />
                  <span className="absolute -right-2 top-7 h-2.5 w-2.5 rounded-full bg-[#2b86b3]" />
                </div>
                <div className="hidden text-xs font-medium uppercase tracking-[0.24em] text-slate-400 sm:block">
                  Self Meta AI
                </div>
              </div>

              <nav className="flex flex-wrap items-center gap-5 text-sm font-medium text-slate-700">
                <a href="#platform" className="transition hover:text-slate-900">Platform</a>
                <a href="#solutions" className="transition hover:text-slate-900">Çözümler</a>
                <a href="#engine" className="transition hover:text-slate-900">Teknik Mimari</a>
                <a href="#experts" className="transition hover:text-slate-900">Terapistler İçin</a>
                <a href="#pricing" className="transition hover:text-slate-900">Paketler</a>
                <a href="#contact" className="transition hover:text-slate-900">İletişim</a>
              </nav>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/auth-login"
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Panele Giriş
                </Link>
                <Link
                  href="/starter"
                  className="rounded-full bg-[#2b7faa] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#236b90]"
                >
                  Terapist Paneli
                </Link>
              </div>
            </div>
          </div>

          <div
            id="platform"
            className="mt-8 grid gap-8 rounded-[34px] bg-[#e6f3f6] p-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:p-10"
          >
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#c8e0e6] bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#2b7faa]">
                AI destekli klinik operasyon
              </div>

              <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-[#163f5e] sm:text-5xl lg:text-6xl">
                Yapay zeka destekli
                <br />
                klinik değerlendirme ve
                <br />
                raporlama çekirdeği
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                Self Meta AI; yapılandırılmış anamnez, alt boyut skor girişi, deterministik risk bayraklama ve
                versiyonlu rapor üretimini tek panel içinde birleştiren modern bir klinik SaaS altyapısıdır.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/starter"
                  className="inline-flex items-center gap-2 rounded-full bg-[#2b7faa] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#236b90]"
                >
                  Demoyu İncele
                  <FiArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/auth-signup"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Kayıt Oluştur
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                {["Structured anamnez", "Deterministic core", "Immutable reports", "Expert/Admin role"].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-[#c7dde4] bg-white/80 px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative mx-auto flex h-[520px] w-full max-w-[480px] items-center justify-center">
              <div className="absolute inset-0 rounded-[42px] border border-[#c5dce3] bg-[linear-gradient(180deg,#ffffff_0%,#dceef3_100%)] shadow-inner" />
              <div className="absolute -right-2 top-8 rounded-2xl border border-white/80 bg-white/90 p-4 shadow-lg backdrop-blur">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">LLM katmanı</div>
                <div className="mt-2 text-sm font-semibold text-slate-800">Sadece dil iyileştirme</div>
                <div className="mt-1 text-xs text-slate-500">Klinik çekirdek sabit kalır</div>
              </div>

              <div className="absolute -left-3 bottom-8 rounded-2xl border border-white/80 bg-white/90 p-4 shadow-lg backdrop-blur">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Rapor Motoru</div>
                <div className="mt-2 text-sm font-semibold text-slate-800">Versiyon: v4 · Immutable</div>
                <div className="mt-1 text-xs text-slate-500">Önceki kayıtların üstüne yazılmaz</div>
              </div>

              <div className="relative w-[78%] rounded-[180px] border border-[#bfd7de] bg-white/80 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.35)] backdrop-blur">
                <div className="rounded-[28px] border border-slate-200 bg-[#f8fbfd] p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Self Meta Engine</div>
                      <div className="mt-1 text-lg font-semibold text-slate-900">Klinik Akış Önizleme</div>
                    </div>
                    <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Stabil
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="rounded-2xl border border-[#d7eaef] bg-[#eef8fb] p-4">
                      <div className="text-sm font-semibold text-[#1b4f71]">1. Yapılandırılmış Anamnez</div>
                      <div className="mt-2 text-xs leading-6 text-slate-600">
                        Demografik, tıbbi geçmiş, gebelik/doğum, günlük yaşam ve hedef alanları
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-sm font-semibold text-slate-800">2. Alt Boyut Skor Girişi</div>
                      <div className="mt-3 grid grid-cols-4 gap-2">
                        {[18, 24, 16, 20].map((n, idx) => (
                          <div key={idx} className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Alt {idx + 1}</div>
                            <div className="mt-1 text-lg font-semibold text-slate-900">{n}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-800">3. Deterministik Çekirdek</div>
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                          Orta Risk
                        </span>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-slate-100">
                        <div className="h-2 w-[68%] rounded-full bg-[#2b7faa]" />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-sm font-semibold text-slate-800">4. Versiyonlu Rapor</div>
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                        <span>Genel özet · Klinik yorum · Risk alanları</span>
                        <span>v4</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute right-8 top-28 h-5 w-5 rounded-full bg-[#78bfd9]" />
              <div className="absolute right-4 bottom-14 h-8 w-8 rotate-45 rounded-md border border-[#9acfe1] bg-white/60" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <p className="mx-auto max-w-5xl text-lg leading-9 text-[#214a68] sm:text-2xl">
          <span className="font-semibold">Self Meta AI</span>, klinik değerlendirmenin en kritik bölümlerini
          yapılandırılmış veri toplama, skor kontrollü karar desteği ve versiyonlu raporlama ile tek bir operasyon
          katmanına taşır.
        </p>
      </section>

      <section id="solutions" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-[36px] bg-[#eaf6f8] p-6 sm:p-8 lg:p-10">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#2b7faa]">Çözümler</div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#173f5d] sm:text-4xl">
              Klinik akışta gerçekten kullanılan modüller
            </h2>
            <p className="mt-4 text-base leading-8 text-slate-600">
              Şişirilmiş özellik listesi yerine; demo ve gerçek klinik işleyişte kritik olan veri toplama, skorlama,
              raporlama ve bilgi desteği modülleri.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {solutions.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-[28px] border border-white/80 bg-white p-6 shadow-[0_22px_60px_-42px_rgba(15,23,42,0.3)]"
              >
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef8fb] text-[#2b7faa]">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-slate-900">{title}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="engine" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="rounded-[36px] border border-slate-200 bg-white p-6 shadow-[0_22px_70px_-50px_rgba(15,23,42,0.35)] sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#eef8fb] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#2b7faa]">
              Teknik Mimari
            </div>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Klinik AI karar desteğinde kontrol kaybı olmadan otomasyon
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-600">
              Üretken AI tek başına karar vermez. Self Meta AI; skor doğrulama, sınıflama, risk işaretleme ve rapor
              iskeletini deterministik katmanda tutar. LLM varsa, yalnızca klinik dilin akıcılığını iyileştirir.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {engineCards.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#2b7faa] shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[36px] bg-[#eaf6f8] p-6 sm:p-8">
            <div className="grid gap-4">
              <div className="rounded-[28px] bg-white p-6 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Veri Katmanı</div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {[
                    "Demografik bilgiler",
                    "Tıbbi geçmiş",
                    "Gebelik / doğum öyküsü",
                    "Günlük yaşam notları",
                  ].map((item) => (
                    <div key={item} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] bg-white p-6 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Kural Katmanı</div>
                <div className="mt-4 space-y-3">
                  {[
                    "Skor doğrulama",
                    "Alt boyut farklılaşma kontrolü",
                    "Tipik / atipik / riskli etiketleme",
                    "Bayrak üretimi ve rapor iskeleti",
                  ].map((item, idx) => (
                    <div key={item} className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#eef8fb] text-sm font-semibold text-[#2b7faa]">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-medium text-slate-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-[#c9e0e6] bg-[linear-gradient(135deg,#ffffff_0%,#f2f9fb_100%)] p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Çıktı Katmanı</div>
                    <div className="mt-2 text-lg font-semibold text-slate-900">Kopyalanabilir, versiyonlu klinik rapor</div>
                  </div>
                  <span className="rounded-full bg-[#2b7faa] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                    Report v4
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="experts" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-[40px] bg-[#eaf6f8] p-6 sm:p-8 lg:p-10">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#2b7faa]">Terapistler İçin</div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#173f5d] sm:text-4xl">
                Panel içinde veri, rapor, eğitim ve akış yönetimi
              </h2>
            </div>
            <p className="max-w-2xl text-base leading-8 text-slate-600">
              Klinik operasyonu bölen çoklu araçlar yerine; kayıt, skor, rapor, ilerleme takibi ve teknik içerikleri
              tek yerde toplayan sade ama güçlü bir uzman arayüzü.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="rounded-[32px] bg-white p-6 shadow-[0_25px_70px_-45px_rgba(15,23,42,0.35)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Terapist Paneli</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">Günlük operasyon görünümü</div>
                </div>
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">Canlı Akış</span>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Toplam Danışan</div>
                  <div className="mt-2 text-3xl font-semibold text-slate-900">24</div>
                  <div className="mt-1 text-sm text-slate-500">3 yeni kayıt bu hafta</div>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Riskli Bayrak</div>
                  <div className="mt-2 text-3xl font-semibold text-slate-900">5</div>
                  <div className="mt-1 text-sm text-slate-500">Yakın takip önerilir</div>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {[
                  { code: "SM-014", action: "Rapor v4 görüntülendi", state: "Orta risk" },
                  { code: "SM-032", action: "Skor girişi bekleniyor", state: "Yüksek öncelik" },
                  { code: "SM-021", action: "Versiyon karşılaştırması açıldı", state: "Düşük risk" },
                ].map((item) => (
                  <div key={item.code} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{item.code}</div>
                      <div className="text-sm text-slate-500">{item.action}</div>
                    </div>
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {item.state}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {therapistItems.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-4 rounded-[28px] border border-white/80 bg-white px-5 py-5 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.25)]"
                >
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef8fb] text-[#2b7faa]">
                    <FiCheckCircle className="h-6 w-6" />
                  </div>
                  <div className="text-lg font-medium text-slate-800">{item}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-[36px] border border-slate-200 bg-white p-6 shadow-[0_25px_70px_-50px_rgba(15,23,42,0.25)] sm:p-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#2b7faa]">İş Akışı</div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Sunumda anlatması kolay, klinikte kullanması mantıklı akış
            </h2>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {workflow.map((item) => (
              <div key={item.no} className="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-lg font-semibold text-[#2b7faa] shadow-sm">
                  {item.no}
                </div>
                <h3 className="mt-5 text-xl font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-[40px] bg-[#eef8fb] p-6 sm:p-8 lg:p-10">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#2b7faa]">Fiyatlandırma</div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#173f5d] sm:text-4xl">
              Ölçeklenebilir paketler, klinik mantığa uygun erişim modeli
            </h2>
            <p className="mt-4 text-base leading-8 text-slate-600">
              Demo gösteriminden profesyonel kullanıma kadar, aynı ürün çekirdeği üzerinde farklı kapasite ve erişim
              seviyeleri.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-4">
            {packages.map((item) => (
              <div
                key={item.key}
                className={`rounded-[28px] border p-6 shadow-sm ${
                  item.featured
                    ? "border-[#2b7faa] bg-[#2b7faa] text-white shadow-[0_30px_60px_-35px_rgba(43,127,170,0.7)]"
                    : "border-white/80 bg-white text-slate-900"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-xl font-semibold">{item.name}</div>
                  {item.featured ? (
                    <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                      Önerilen
                    </span>
                  ) : null}
                </div>
                <div className={`mt-5 text-3xl font-semibold ${item.featured ? "text-white" : "text-slate-900"}`}>
                  {item.price}
                </div>
                <div className={`mt-2 text-sm leading-7 ${item.featured ? "text-white/80" : "text-slate-500"}`}>
                  {item.note}
                </div>
                <a
                  href="#contact"
                  className={`mt-6 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${
                    item.featured
                      ? "bg-white text-[#2b7faa] hover:bg-slate-100"
                      : "bg-[#2b7faa] text-white hover:bg-[#236b90]"
                  }`}
                >
                  {item.cta}
                </a>
              </div>
            ))}
          </div>

          <div className="mt-10 overflow-hidden rounded-[32px] border border-[#cfe2e7] bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-left text-sm">
                <thead className="bg-[#f3fafc]">
                  <tr>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-500">Özellik</th>
                    {packages.map((item) => (
                      <th
                        key={item.key}
                        className={`px-6 py-4 text-sm font-semibold ${
                          item.featured ? "bg-[#2b7faa] text-white" : "text-slate-700"
                        }`}
                      >
                        {item.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pricingRows.map((row, index) => (
                    <tr key={row.feature} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                      <td className="px-6 py-5 font-medium text-slate-700">{row.feature}</td>
                      {packages.map((pkg) => (
                        <td key={pkg.key} className={`px-6 py-5 ${pkg.featured ? "bg-[#f7fbfd]" : ""}`}>
                          {renderCell(row.values[pkg.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pb-20">
        <div className="rounded-[36px] border border-slate-200 bg-white p-8 shadow-[0_25px_70px_-50px_rgba(15,23,42,0.25)] lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#2b7faa]">İletişim</div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Klinik akışı sadeleştiren bir demoya ihtiyacın varsa, başlangıç burası
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
                Self Meta AI; özellikle teknopark sunumu, pilot klinik kurulum ve uzman odaklı değerlendirme akışları
                için tasarlandı. Demo, danışan listesi, skor girişi ve rapor ekranı aynı ürün omurgasında gösterilir.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/starter"
                  className="inline-flex items-center gap-2 rounded-full bg-[#2b7faa] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#236b90]"
                >
                  Panele Geç
                  <FiArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/auth-login"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Giriş Ekranı
                </Link>
              </div>
            </div>

            <div className="rounded-[32px] bg-[#eef8fb] p-6">
              <div className="grid gap-4">
                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Ürün omurgası</div>
                  <div className="mt-3 space-y-3">
                    {[
                      "Danışan kaydı ve anonim kod mantığı",
                      "Yapılandırılmış anamnez modülü",
                      "Skor girişi ve risk etiketi",
                      "Versiyonlu rapor geçmişi",
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-3 text-sm font-medium text-slate-700">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#eef8fb] text-[#2b7faa]">
                          <FiCheckCircle className="h-4 w-4" />
                        </span>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white p-5 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">İletişim</div>
                    <div className="mt-3 text-sm font-medium text-slate-700">selfmeta.ai.demo@gmail.com</div>
                  </div>
                  <div className="rounded-2xl bg-white p-5 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Durum</div>
                    <div className="mt-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                      MVP demo hazır
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-slate-200 pt-6 text-sm text-slate-500">
            © 2026 Self Meta AI · Klinik değerlendirme, skor girişi ve versiyonlu raporlama altyapısı
          </div>
        </div>
      </section>
    </main>
  );
}

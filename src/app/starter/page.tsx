import Link from "next/link"

const cards = [
  {
    title: "Danışan Listesi",
    text: "Kayıtlı danışanları görüntüleyin, vakaları yönetin ve skor girişine güvenli biçimde geçin.",
    href: "/clients",
  },
  {
    title: "Yeni Danışan Ekle",
    text: "Yeni bir danışan kaydı oluşturun ve anamnez ile değerlendirme akışını başlatın.",
    href: "/clients/new",
  },
  {
    title: "Skor Girişi",
    text: "6 regülasyon alanında değerlendirme yapın ve tek final klinik raporu üretin.",
    href: "/assessments",
  },
  {
    title: "Video Gözlem",
    text: "Serbest oyun video oturumları için evidence timeline, domain skorları ve deterministik yorumu görüntüleyin.",
    href: "/video-observation",
  },
  {
    title: "Rapor Geçmişi",
    text: "Oluşturulan raporları görüntüleyin, sürümleri inceleyin ve eski raporlara dönün.",
    href: "/reports",
  },
  {
    title: "Profil",
    text: "Terapistin profesyonel bilgilerini, mezuniyet ve kurum detaylarını yönetin.",
    href: "/profile",
  },
  {
    title: "Ayarlar",
    text: "Rapor imzası, bildirimler, plan ve faturalama tercihlerini düzenleyin.",
    href: "/profile-setting",
  },
]

export default function StarterPage() {
  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <div className="text-sm font-semibold uppercase tracking-wide text-blue-600">Self Meta AI</div>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Genel Bakış</h1>
          <p className="mt-3 max-w-3xl text-slate-600">
            Bu panel, danışan yönetimi, değerlendirme, raporlama ve terapist ayarları için sadeleştirilmiş ana çalışma alanıdır.
          </p>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <Link key={card.href} href={card.href} className="rounded-3xl border border-slate-200 bg-white p-6 transition hover:shadow-md">
              <div className="text-xl font-semibold text-slate-900">{card.title}</div>
              <p className="mt-3 text-sm leading-7 text-slate-600">{card.text}</p>
              <div className="mt-6 inline-flex items-center rounded-xl bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                Aç
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

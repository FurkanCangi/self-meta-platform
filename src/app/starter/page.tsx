import Link from "next/link"
import {
  BarChart3,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  FileText,
  GraduationCap,
  LifeBuoy,
  PlayCircle,
  Search,
  Settings,
  Sparkles,
  UserPlus,
  UsersRound,
} from "lucide-react"

const cards = [
  {
    title: "Danışan Listesi",
    text: "Kayıtlı danışanları görüntüleyin, vakaları yönetin ve skor girişine güvenli biçimde geçin.",
    href: "/clients",
    icon: UsersRound,
    accent: "from-cyan-400 to-blue-600",
  },
  {
    title: "Yeni Danışan Ekle",
    text: "Yeni bir danışan kaydı oluşturun ve anamnez ile değerlendirme akışını başlatın.",
    href: "/clients/new",
    icon: UserPlus,
    accent: "from-blue-500 to-violet-600",
  },
  {
    title: "Skor Girişi",
    text: "6 regülasyon alanında değerlendirme yapın ve tek final klinik raporu üretin.",
    href: "/assessments",
    icon: ClipboardCheck,
    accent: "from-violet-500 to-blue-600",
  },
  {
    title: "Video Gözlem",
    text: "Serbest oyun video oturumları için evidence timeline, domain skorları ve deterministik yorumu görüntüleyin.",
    href: "/video-observation",
    icon: PlayCircle,
    accent: "from-cyan-400 to-violet-600",
  },
  {
    title: "Rapor Geçmişi",
    text: "Oluşturulan raporları görüntüleyin, sürümleri inceleyin ve eski raporlara dönün.",
    href: "/reports",
    icon: BarChart3,
    accent: "from-blue-500 to-cyan-500",
  },
  {
    title: "Eğitim Kütüphanesi",
    text: "Yayınlanan eğitim kayıtlarını güvenli erişim, watermark ve izleme oturumu kontrolleriyle izleyin.",
    href: "/education",
    icon: GraduationCap,
    accent: "from-cyan-500 to-blue-600",
  },
  {
    title: "Rapor Paketleri",
    text: "Ek test ve AI rapor haklarınızı panel içinden satın alın ve kullanımınıza devam edin.",
    href: "/report-packages",
    icon: CreditCard,
    accent: "from-violet-500 to-cyan-500",
  },
  {
    title: "Profil",
    text: "Terapistin profesyonel bilgilerini, mezuniyet ve kurum detaylarını yönetin.",
    href: "/profile",
    icon: FileText,
    accent: "from-blue-500 to-violet-600",
  },
  {
    title: "Ayarlar",
    text: "Rapor imzası, bildirimler, plan ve faturalama tercihlerini düzenleyin.",
    href: "/profile-setting",
    icon: Settings,
    accent: "from-cyan-500 to-blue-600",
  },
]

export default function StarterPage() {
  return (
    <div className="relative px-4 py-5 md:px-6 md:py-7">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_14%_8%,rgba(0,200,215,0.13),transparent_32%),radial-gradient(circle_at_86%_14%,rgba(124,58,237,0.12),transparent_34%)]" />
      <div className="dna-app-only dna-app-page space-y-4">
        <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="dna-app-section-title">Bugünkü çalışma</div>
          <h1 className="mt-2 text-[26px] font-black leading-tight tracking-tight text-[#071b3a]">
            Klinik çalışma alanı
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Danışanı seç, değerlendirmeyi tamamla, raporu tek akışta yönet.
          </p>
          <Link
            href="/clients?surface=app"
            className="mt-4 flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-500"
          >
            <Search size={18} />
            Danışan kodu ara
            <ChevronRight className="ml-auto text-slate-400" size={18} />
          </Link>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <Link href="/clients/new?surface=app" className="rounded-[20px] border border-blue-100 bg-white p-4 shadow-sm">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-white">
              <UserPlus size={21} />
            </div>
            <div className="mt-3 text-base font-black text-[#071b3a]">Yeni danışan</div>
            <div className="mt-1 text-xs font-semibold leading-5 text-slate-500">Anamnez ve kayıt</div>
          </Link>
          <Link href="/clients?surface=app" className="rounded-[20px] border border-cyan-100 bg-white p-4 shadow-sm">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-500 text-white">
              <UsersRound size={21} />
            </div>
            <div className="mt-3 text-base font-black text-[#071b3a]">Danışanlar</div>
            <div className="mt-1 text-xs font-semibold leading-5 text-slate-500">Vaka listesi</div>
          </Link>
        </section>

        <section className="rounded-[22px] border border-slate-200 bg-white p-3 shadow-sm">
          <div className="px-1 pb-2 pt-1 dna-app-section-title">Hızlı işlemler</div>
          {[
            { title: "Skor bekleyen vakalar", text: "Danışan seçip 60 soruluk değerlendirmeye geç", href: "/clients?surface=app", icon: ClipboardCheck },
            { title: "Rapor geçmişi", text: "Üretilmiş klinik raporları görüntüle", href: "/reports?surface=app", icon: BarChart3 },
            { title: "Rapor hakkı", text: "Kalan kullanım ve paketleri kontrol et", href: "/report-packages?surface=app", icon: CreditCard },
            { title: "Taleplerim", text: "Sorun bildir veya destek yanıtlarını takip et", href: "/support?surface=app", icon: LifeBuoy },
            { title: "Eğitimler", text: "Eğitim içeriklerine güvenli erişim", href: "/education?surface=app", icon: GraduationCap },
          ].map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="dna-app-touch-row flex items-center gap-3 border-t border-slate-100 px-1 py-3 first:border-t-0"
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-50 to-blue-50 text-blue-700">
                  <Icon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-slate-900">{item.title}</div>
                  <div className="mt-0.5 line-clamp-1 text-xs font-medium text-slate-500">{item.text}</div>
                </div>
                <ChevronRight className="shrink-0 text-slate-400" size={18} />
              </Link>
            )
          })}
        </section>
      </div>

      <div className="dna-web-only mx-auto max-w-7xl">
        <section className="relative overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/90 p-7 shadow-[0_28px_80px_rgba(7,27,58,0.08)] backdrop-blur-xl md:p-8">
          <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-cyan-100/80 blur-3xl" />
          <div className="absolute right-20 top-0 h-64 w-64 rounded-full bg-violet-100/80 blur-3xl" />
          <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/82 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-blue-700 shadow-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-cyan-400 via-blue-600 to-violet-600 shadow-[0_0_0_5px_rgba(37,99,235,0.10)]" />
                DNA Intelligence
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-tight text-[#071b3a] md:text-5xl">Klinik çalışma alanı</h1>
              <p className="mt-4 max-w-3xl text-[15px] leading-7 text-slate-600 md:text-base">
                Danışan yönetimi, değerlendirme, raporlama ve eğitim sonrası uygulama akışı için sadeleştirilmiş
                panel. Önce danışanı seçin, değerlendirmeyi tamamlayın, raporu ve takip sürecini aynı yerden yönetin.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-cyan-50 via-blue-50 to-violet-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-blue-700 shadow-sm">
                    <GraduationCap size={22} />
                  </div>
                  <div>
                    <div className="text-sm font-black text-[#071b3a]">Eğitim sonrası kullanım</div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">Değerlendirme ve rapor akışı</div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-cyan-100 bg-white/78 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
                    <Sparkles size={22} />
                  </div>
                  <div>
                    <div className="text-sm font-black text-[#071b3a]">AI raporlama</div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">Klinisyen onaylı rapor taslağı</div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-violet-100 bg-white/78 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-50 text-violet-700">
                    <ClipboardCheck size={22} />
                  </div>
                  <div>
                    <div className="text-sm font-black text-[#071b3a]">Vaka düzeni</div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">Danışan, skor ve takip kayıtları</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon
            return (
            <Link
              key={card.href}
              href={card.href}
              className="group relative min-h-[240px] overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/88 p-6 shadow-[0_18px_52px_rgba(7,27,58,0.06)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_26px_70px_rgba(37,99,235,0.12)]"
            >
              <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${card.accent}`} />
              <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-full bg-gradient-to-br from-cyan-50 via-blue-50 to-violet-50 opacity-90 transition group-hover:opacity-100" />
              <div className="relative">
                <div className={`grid h-[52px] w-[52px] place-items-center rounded-2xl bg-gradient-to-br ${card.accent} text-white shadow-[0_16px_28px_rgba(37,99,235,0.18)]`}>
                  <Icon size={24} strokeWidth={1.9} />
                </div>
                <div className="mt-5 text-xl font-black text-[#071b3a]">{card.title}</div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{card.text}</p>
                <div className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-50 via-blue-50 to-violet-50 px-4 py-2 text-sm font-black text-blue-700 transition group-hover:bg-gradient-to-r group-hover:from-cyan-100 group-hover:via-blue-100 group-hover:to-violet-100">
                  Aç <span aria-hidden="true">→</span>
                </div>
              </div>
            </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

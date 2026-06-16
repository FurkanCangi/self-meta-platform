import {
  CheckCircle2,
  CreditCard,
  FileText,
  LockKeyhole,
  Sparkles,
} from "lucide-react"

const reportPackages = [
  {
    title: "10 Rapor Paketi",
    price: "500 TL",
    description: "Düşük hacimli ek vaka raporları için.",
  },
  {
    title: "50 Rapor Paketi",
    price: "2.000 TL",
    description: "Düzenli klinik kullanım için ekonomik paket.",
    featured: true,
  },
  {
    title: "100 Rapor Paketi",
    price: "3.500 TL",
    description: "Yoğun vaka akışı olan terapistler için.",
  },
]

const notes = [
  "Satın alınan rapor hakları hesabınıza tanımlanır.",
  "Rapor hakları AI klinik rapor üretimi sırasında düşülür.",
  "Paketler eğitim programı satın alımından bağımsız ek kullanım hakkıdır.",
]

export default function ReportPackagesPage() {
  return (
    <div className="relative px-3 py-4 md:px-2 md:py-6">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_10%,rgba(0,200,215,0.10),transparent_30%),radial-gradient(circle_at_88%_18%,rgba(124,58,237,0.10),transparent_34%)]" />
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/86 p-7 shadow-[0_24px_70px_rgba(7,27,58,0.08)] backdrop-blur-xl">
          <div className="absolute right-0 top-0 h-40 w-72 rounded-bl-full bg-gradient-to-br from-cyan-100/80 via-blue-100/70 to-violet-100/70" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-blue-700 shadow-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-cyan-400 via-blue-600 to-violet-600 shadow-[0_0_0_5px_rgba(37,99,235,0.10)]" />
              Panel içi satın alma
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-[#071b3a]">Ek Test ve Rapor Paketleri</h1>
            <p className="mt-3 max-w-3xl text-[15px] leading-7 text-slate-600">
              Eğitim programına kayıt tamamlandıktan sonra ihtiyaç oldukça ek AI rapor hakkı satın alın.
              Bu alan yalnız terapist paneli içinde kullanılır.
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-3">
          {reportPackages.map((pack) => (
            <article
              key={pack.title}
              className={[
                "relative overflow-hidden rounded-[26px] border bg-white/86 p-6 shadow-[0_18px_52px_rgba(7,27,58,0.06)] backdrop-blur-xl",
                pack.featured
                  ? "border-blue-200 shadow-[0_24px_70px_rgba(37,99,235,0.12)]"
                  : "border-slate-200/80",
              ].join(" ")}
            >
              <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-full bg-gradient-to-br from-cyan-50 via-blue-50 to-violet-50 opacity-90" />
              {pack.featured ? (
                <div className="absolute right-5 top-5 rounded-full bg-gradient-to-r from-cyan-400 via-blue-600 to-violet-600 px-3 py-1 text-xs font-black text-white">
                  Önerilen
                </div>
              ) : null}
              <div className="relative">
                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-blue-100 bg-gradient-to-br from-cyan-50 via-blue-50 to-violet-50 text-blue-700 shadow-sm">
                  <FileText size={24} strokeWidth={1.9} />
                </div>
                <h2 className="mt-5 text-xl font-black text-[#071b3a]">{pack.title}</h2>
                <p className="mt-3 min-h-[52px] text-sm leading-7 text-slate-600">{pack.description}</p>
                <div className="mt-4 text-4xl font-black text-blue-700">{pack.price}</div>
                <button
                  type="button"
                  className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-600 to-violet-600 px-5 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:shadow-blue-600/30"
                >
                  <CreditCard size={18} strokeWidth={1.9} />
                  Satın Al
                </button>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="rounded-[26px] border border-slate-200/80 bg-white/84 p-6 shadow-[0_18px_52px_rgba(7,27,58,0.06)] backdrop-blur-xl">
            <h2 className="text-2xl font-black text-[#071b3a]">Nasıl Kullanılır?</h2>
            <div className="mt-5 grid gap-3">
              {notes.map((note) => (
                <div key={note} className="flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 text-sm font-semibold leading-6 text-slate-700">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-blue-700" size={19} strokeWidth={1.9} />
                  {note}
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-[26px] border border-blue-100 bg-gradient-to-br from-cyan-50 via-blue-50 to-violet-50 p-6 shadow-[0_18px_52px_rgba(37,99,235,0.08)]">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-blue-700 shadow-sm">
              <Sparkles size={24} strokeWidth={1.9} />
            </div>
            <h2 className="mt-5 text-xl font-black text-[#071b3a]">Güvenli ödeme</h2>
            <p className="mt-3 text-sm font-medium leading-7 text-slate-600">
              Ödeme altyapısı bağlandığında paket satın alımları bu panel ekranından tamamlanacak ve rapor hakları otomatik olarak hesabınıza işlenecek.
            </p>
            <div className="mt-5 flex items-center gap-2 text-sm font-black text-slate-700">
              <LockKeyhole size={17} strokeWidth={1.9} />
              Kart verisi sistemde saklanmaz.
            </div>
          </aside>
        </section>
      </div>
    </div>
  )
}


import Link from "next/link"
import { CircleCheck, MailCheck, ShieldCheck } from "lucide-react"
import AuthLayout from "../components/auth/AuthLayout"

export default async function AuthSignupSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<{ email?: string }>
}) {
  const params = searchParams ? await searchParams : {}
  const email = typeof params?.email === "string" ? params.email : ""

  return (
    <AuthLayout mode="signup">
      <div className="w-full max-w-[460px]">
        <div className="rounded-3xl border border-cyan-100 bg-white/90 p-6 shadow-xl shadow-blue-100/50">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-600 to-violet-600 text-white shadow-lg shadow-blue-600/20">
              <MailCheck aria-hidden="true" className="h-7 w-7" />
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
              <CircleCheck aria-hidden="true" className="h-4 w-4" />
              Hesap oluşturuldu
            </div>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">Son bir adım kaldı.</h1>
          <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
            DNA Intelligence hesabınızı güvenle etkinleştirmek için gönderdiğimiz e-postadaki doğrulama düğmesine dokunun.
          </p>
          {email ? (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Gönderilen adres</div>
              <div className="mt-1 break-all text-sm font-bold text-slate-900">{email}</div>
            </div>
          ) : null}
          <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-violet-50 px-4 py-3 text-sm leading-6 text-blue-900">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 text-blue-600" />
            <div>
              <strong className="block">Güvenli doğrulama bağlantısı</strong>
              <span className="font-medium text-blue-800">E-posta görünmüyorsa gereksiz veya spam klasörünü de kontrol edin.</span>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center text-[10px] font-bold text-slate-500 sm:text-xs" aria-label="Kayıt adımları">
            <span className="rounded-full bg-emerald-100 px-2 py-1.5 text-emerald-700">1 · Kayıt</span>
            <span className="rounded-full bg-blue-100 px-2 py-1.5 text-blue-700">2 · Doğrulama</span>
            <span className="rounded-full bg-slate-100 px-2 py-1.5">3 · Giriş</span>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 via-blue-600 to-violet-600 px-5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:shadow-blue-600/30"
            >
              Giriş ekranına git
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-800 shadow-sm shadow-slate-200/60 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-blue-100"
            >
              Farklı e-posta kullan
            </Link>
          </div>
        </div>
      </div>
    </AuthLayout>
  )
}

import Link from "next/link"
import AuthLayout from "../components/auth/AuthLayout"

export default async function AuthSignupSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<{ email?: string }>
}) {
  const params = searchParams ? await searchParams : {}
  const email = params?.email ? decodeURIComponent(params.email) : ""

  return (
    <AuthLayout mode="signup">
      <div className="w-full max-w-[460px]">
        <div className="rounded-3xl border border-cyan-100 bg-white/90 p-6 shadow-xl shadow-blue-100/50">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-600 to-violet-600 text-lg font-black text-white">
            ✓
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">E-postanızı kontrol edin.</h1>
          <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
            DNA Intelligence hesabınız oluşturuldu. Terapist paneline giriş yapmadan önce e-posta adresinizi doğrulamanız gerekiyor.
          </p>
          {email ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800">
              {email}
            </div>
          ) : null}
          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium leading-6 text-blue-800">
            Gelen kutunuzu ve spam klasörünü kontrol edin. Doğrulama bağlantısına tıkladıktan sonra giriş ekranına yönlendirileceksiniz.
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 via-blue-600 to-violet-600 px-5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:shadow-blue-600/30"
            >
              Giriş Ekranına Git
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-800 shadow-sm shadow-slate-200/60 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-blue-100"
            >
              Tekrar Kayıt Aç
            </Link>
          </div>
        </div>
      </div>
    </AuthLayout>
  )
}

import Link from "next/link"

export default function AuthSignupSuccessPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Doğrulama Gerekli</div>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">E-posta Doğrulama Gönderildi</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          Hesabınız oluşturuldu. Giriş yapmadan önce doğrulama e-postasındaki bağlantıyı açın.
          Gelen kutunuzu ve spam klasörünü kontrol edin.
        </p>
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Doğrulama bağlantısı birkaç dakika içinde gelmezse spam klasörünü kontrol edin ve ardından giriş ekranına geri dönün.
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/login" className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-5 font-semibold text-white transition hover:bg-blue-700">
            Giriş Sayfasına Git
          </Link>
          <Link href="/" className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 font-semibold text-slate-700 transition hover:bg-slate-50">
            Ana Sayfa
          </Link>
        </div>
      </div>
    </div>
  )
}

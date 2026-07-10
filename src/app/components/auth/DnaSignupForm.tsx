"use client"

import Link from "next/link"
import { useEffect, useState, type FormEvent } from "react"
import AuthLayout from "./AuthLayout"

const LEGAL_ACCEPTANCE_ERROR =
  "Devam etmek için hizmet sözleşmesi, KVKK aydınlatması, açık rıza ve veri giriş yetkisi beyanlarını onaylayın."

const REQUIRED_MARK = <span className="text-slate-500">*</span>

function initialSignupError() {
  if (typeof window === "undefined") return ""
  return formatSignupErrorCode(new URLSearchParams(window.location.search).get("error"))
}

function formatSignupErrorCode(code?: string | null) {
  if (!code) return ""
  if (code === "missing_name") return "Ad soyad alanını doldurun."
  if (code === "missing_email") return "E-posta alanını doldurun."
  if (code === "invalid_email") return "Geçerli bir e-posta adresi yazın."
  if (code === "password_short") return "Şifre en az 8 karakter olmalıdır."
  if (code === "password_mismatch") return "Şifreler eşleşmiyor."
  if (code === "legal_required") return LEGAL_ACCEPTANCE_ERROR
  if (code === "origin") return "Kayıt isteği güvenlik kontrolünden geçemedi. Sayfayı yenileyip tekrar deneyin."
  if (code === "rate_limited") return "Çok sık kayıt denemesi yapıldı. Lütfen birkaç dakika sonra tekrar deneyin."
  if (code === "already_registered") return "Bu e-posta ile zaten bir hesap bulunuyor. Giriş yapmayı deneyin."
  if (code === "network") return "Kayıt servisine ulaşılamadı. Bağlantıyı kontrol edip tekrar deneyin."
  if (code === "google_failed") return "Google ile kayıt tamamlanamadı. Lütfen tekrar deneyin."
  if (code === "google_unavailable") return "Google ile kayıt şu anda yapılandırılmamış."
  if (code === "google_legal_required") return "Google ile devam etmek için kayıt onaylarını tamamlamanız gerekir."
  if (code === "email_failed") return "Doğrulama e-postası gönderilemedi. Lütfen biraz sonra tekrar deneyin."
  if (code === "profile_failed") return "Hesap oluşturuldu ancak profil kaydı tamamlanamadı. Lütfen destek ile iletişime geçin."
  if (code === "legal_failed") return "Hesap oluşturuldu ancak yasal onay kaydı tamamlanamadı. Lütfen destek ile iletişime geçin."
  return "Kayıt sırasında bir hata oluştu."
}

function getSignupSearchParam(name: string) {
  if (typeof window === "undefined") return ""
  return new URLSearchParams(window.location.search).get(name) ?? ""
}

function getOrCreateDeviceId() {
  const key = "dna_device_id"
  const existing = window.localStorage.getItem(key)
  if (existing && existing.length >= 16) return existing

  const next =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`

  window.localStorage.setItem(key, next)
  return next
}

function detectDeviceType() {
  const ua = navigator.userAgent || ""
  if (/ipad|tablet|playbook|silk/i.test(ua)) return "tablet"
  if (/mobi|iphone|android/i.test(ua)) return "mobile"
  return "desktop"
}

export default function DnaSignupForm() {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [legalChecks, setLegalChecks] = useState({
    terms: false,
    kvkk: false,
    consent: false,
    authority: false,
  })
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState(initialSignupError)
  const [deviceId, setDeviceId] = useState("")
  const [deviceType, setDeviceType] = useState("desktop")
  const [nextPath, setNextPath] = useState("")
  const [surface, setSurface] = useState("web")
  const legalAccepted =
    legalChecks.terms && legalChecks.kvkk && legalChecks.consent && legalChecks.authority

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId())
    setDeviceType(detectDeviceType())
    setNextPath(getSignupSearchParam("next"))
    setSurface(getSignupSearchParam("surface") === "app" ? "app" : "web")
  }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    setError("")

    if (!fullName.trim()) {
      event.preventDefault()
      setError("Ad soyad zorunludur.")
      return
    }

    if (!email.trim()) {
      event.preventDefault()
      setError("E-posta zorunludur.")
      return
    }

    if (password.length < 8) {
      event.preventDefault()
      setError("Şifre en az 8 karakter olmalıdır.")
      return
    }

    if (password !== confirmPassword) {
      event.preventDefault()
      setError("Şifreler eşleşmiyor.")
      return
    }

    if (!legalAccepted) {
      event.preventDefault()
      setError(LEGAL_ACCEPTANCE_ERROR)
      return
    }

    setLoading(true)
  }

  function handleGoogleSubmit(event: FormEvent<HTMLFormElement>) {
    setError("")

    if (!legalAccepted) {
      event.preventDefault()
      setError(LEGAL_ACCEPTANCE_ERROR)
      return
    }

    setGoogleLoading(true)
  }

  return (
    <AuthLayout mode="signup">
      <div className="w-full max-w-[430px]">
        <form action="/api/auth/signup" method="post" onSubmit={handleSubmit} className="space-y-2.5">
          <label className="block">
            <div className="mb-1 text-sm font-bold text-slate-800">Ad Soyad {REQUIRED_MARK}</div>
            <input
              name="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              required
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 shadow-sm shadow-slate-200/40 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              placeholder="Ad Soyad"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-sm font-bold text-slate-800">E-posta {REQUIRED_MARK}</div>
            <input
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 shadow-sm shadow-slate-200/40 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              placeholder="mail@ornek.com"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-sm font-bold text-slate-800">Şifre {REQUIRED_MARK}</div>
            <input
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 shadow-sm shadow-slate-200/40 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              placeholder="En az 8 karakter"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-sm font-bold text-slate-800">Şifre Tekrar {REQUIRED_MARK}</div>
            <input
              name="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 shadow-sm shadow-slate-200/40 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              placeholder="Şifreyi tekrar yazın"
            />
          </label>

          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-xs font-semibold leading-5 text-blue-800">
            Kayıt sonrası doğrulama e-postası gönderilir. E-posta doğrulanmadan terapist paneline giriş açılamaz.
          </div>

          <div className="space-y-2 rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm shadow-slate-200/40">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-800">Hukuki onaylar {REQUIRED_MARK}</div>
              <div className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                Tümü zorunlu
              </div>
            </div>
            <label className="flex gap-3 text-sm leading-[1.35] text-slate-700">
              <input
                name="terms"
                type="checkbox"
                checked={legalChecks.terms}
                onChange={(e) => setLegalChecks((current) => ({ ...current, terms: e.target.checked }))}
                required
                className="mt-1 h-4 w-4 accent-blue-600"
              />
              <span>
                <Link href="/terms" target="_blank" className="font-bold text-blue-700 hover:text-violet-700">
                  Kullanım şartları
                </Link>{" "}
                ve{" "}
                <Link href="/package-agreement" target="_blank" className="font-bold text-blue-700 hover:text-violet-700">
                  paket sözleşmesini
                </Link>{" "}
                kabul ediyorum.
              </span>
            </label>
            <label className="flex gap-3 text-sm leading-[1.35] text-slate-700">
              <input
                name="kvkk"
                type="checkbox"
                checked={legalChecks.kvkk}
                onChange={(e) => setLegalChecks((current) => ({ ...current, kvkk: e.target.checked }))}
                required
                className="mt-1 h-4 w-4 accent-blue-600"
              />
              <span>
                <Link href="/kvkk" target="_blank" className="font-bold text-blue-700 hover:text-violet-700">
                  KVKK aydınlatma metnini
                </Link>{" "}
                okudum.
              </span>
            </label>
            <label className="flex gap-3 text-sm leading-[1.35] text-slate-700">
              <input
                name="consent"
                type="checkbox"
                checked={legalChecks.consent}
                onChange={(e) => setLegalChecks((current) => ({ ...current, consent: e.target.checked }))}
                required
                className="mt-1 h-4 w-4 accent-blue-600"
              />
              <span>
                <Link href="/explicit-consent" target="_blank" className="font-bold text-blue-700 hover:text-violet-700">
                  Özel nitelikli veri ve deterministik rapor işleme açık rızasını
                </Link>{" "}
                veriyorum.
              </span>
            </label>
            <label className="flex gap-3 text-sm leading-[1.35] text-slate-700">
              <input
                name="authority"
                type="checkbox"
                checked={legalChecks.authority}
                onChange={(e) => setLegalChecks((current) => ({ ...current, authority: e.target.checked }))}
                required
                className="mt-1 h-4 w-4 accent-blue-600"
              />
              <span>Danışan/çocuk verisi girmeye yetkili olduğumu ve gerekli veli/danışan izinlerini aldığımı beyan ederim.</span>
            </label>
            {!legalAccepted ? (
              <div className="rounded-xl bg-violet-50 px-3 py-2 text-xs font-semibold leading-5 text-violet-800">
                Kayıt olabilmek için yukarıdaki dört onayın tamamını vermeniz gerekir.
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || !legalAccepted}
            aria-disabled={loading || !legalAccepted}
            title={!legalAccepted ? "Kayıt için tüm hukuki onayları tamamlayın." : undefined}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 via-blue-600 to-violet-600 px-5 font-bold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:shadow-blue-600/30 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {loading ? "Doğrulama e-postası hazırlanıyor..." : "Kayıt Ol"}
          </button>
        </form>

        <div className="my-3 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          veya
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form action="/api/auth/google/start" method="post" onSubmit={handleGoogleSubmit}>
          <input type="hidden" name="mode" value="signup" />
          <input type="hidden" name="surface" value={surface} />
          <input type="hidden" name="next" value={nextPath} />
          <input type="hidden" name="deviceId" value={deviceId} />
          <input type="hidden" name="deviceType" value={deviceType} />
          <input type="hidden" name="terms" value={legalChecks.terms ? "on" : ""} />
          <input type="hidden" name="kvkk" value={legalChecks.kvkk ? "on" : ""} />
          <input type="hidden" name="consent" value={legalChecks.consent ? "on" : ""} />
          <input type="hidden" name="authority" value={legalChecks.authority ? "on" : ""} />
          <button
            type="submit"
            disabled={googleLoading || !legalAccepted}
            aria-disabled={googleLoading || !legalAccepted}
            title={!legalAccepted ? "Google ile kayıt için tüm hukuki onayları tamamlayın." : undefined}
            className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-5 font-bold text-slate-800 shadow-sm shadow-slate-200/60 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-blue-100/70 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-base shadow-sm">G</span>
            {googleLoading ? "Google’a yönlendiriliyor..." : "Google ile kayıt ol"}
          </button>
        </form>

        <div className="mt-3 text-sm font-medium text-slate-600">
          Hesabın var mı?{" "}
          <Link href="/login" className="font-bold text-blue-700 hover:text-violet-700">
            Giriş Yap
          </Link>
        </div>
      </div>
    </AuthLayout>
  )
}

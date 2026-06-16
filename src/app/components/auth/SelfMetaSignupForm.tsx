"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { ACTIVE_LEGAL_DOCUMENTS, type PlanCode } from "@/lib/legal/documents"
import {
  createPendingLegalAcceptance,
  PENDING_LEGAL_ACCEPTANCE_STORAGE_KEY,
} from "@/lib/legal/pendingAcceptance"
import { supabase } from "@/lib/supabase/client"
import AuthLayout from "./AuthLayout"

const PURCHASE_PATH = "/fiyatlandirma"
const LEGAL_ACCEPTANCE_ERROR =
  "Devam etmek için hizmet sözleşmesi, KVKK aydınlatması, açık rıza ve veri giriş yetkisi beyanlarını onaylayın."

function formatSignupError(message?: string | null) {
  const raw = String(message || "").trim()
  const normalized = raw.toLowerCase()

  if (normalized.includes("user already registered")) {
    return "Bu e-posta ile zaten bir hesap bulunuyor. Giriş yapmayı deneyin."
  }

  if (normalized.includes("password")) {
    return "Şifre gereksinimleri karşılanmadı. Daha güçlü bir şifre deneyin."
  }

  return raw || "Kayıt sırasında bir hata oluştu."
}

export default function SelfMetaSignupForm() {
  const router = useRouter()
  const selectedPlan: PlanCode = "none"
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
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const legalAccepted =
    legalChecks.terms && legalChecks.kvkk && legalChecks.consent && legalChecks.authority

  const rememberLegalAcceptance = (method: "email" | "google") => {
    window.localStorage.setItem(
      PENDING_LEGAL_ACCEPTANCE_STORAGE_KEY,
      JSON.stringify(
        createPendingLegalAcceptance({
          planCode: selectedPlan,
          sourcePath: `${window.location.pathname}${window.location.search}`,
          method,
        })
      )
    )
  }

  const clearPendingLegalAcceptance = () => {
    window.localStorage.removeItem(PENDING_LEGAL_ACCEPTANCE_STORAGE_KEY)
  }

  const handleGoogleSignup = async () => {
    setError("")
    setSuccess(false)

    if (!legalAccepted) {
      setError(LEGAL_ACCEPTANCE_ERROR)
      return
    }

    setGoogleLoading(true)

    try {
      rememberLegalAcceptance("google")

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${PURCHASE_PATH}`,
          queryParams: {
            prompt: "select_account",
          },
        },
      })

      if (error) {
        clearPendingLegalAcceptance()
        throw error
      }
    } catch (err: any) {
      setError(formatSignupError(err?.message))
      setGoogleLoading(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess(false)

    if (!fullName.trim()) {
      setError("Ad soyad zorunludur.")
      return
    }

    if (!email.trim()) {
      setError("E-posta zorunludur.")
      return
    }

    if (password.length < 8) {
      setError("Şifre en az 8 karakter olmalıdır.")
      return
    }

    if (password !== confirmPassword) {
      setError("Şifreler eşleşmiyor.")
      return
    }

    if (!legalAccepted) {
      setError(LEGAL_ACCEPTANCE_ERROR)
      return
    }

    setLoading(true)

    try {
      const redirectTo = `${window.location.origin}${PURCHASE_PATH}`
      rememberLegalAcceptance("email")

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: fullName,
            selected_plan: selectedPlan,
            legal_documents_version: ACTIVE_LEGAL_DOCUMENTS[0]?.version,
            legal_signup_checked_at: new Date().toISOString(),
          },
        },
      })

      if (error) {
        throw error
      }

      if (data?.user?.id) {
        await supabase.from("profiles").upsert({
          user_id: data.user.id,
          role: "expert",
          plan: selectedPlan,
        })
      }

      if (data?.session) {
        const legalResponse = await fetch("/api/legal/accept", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            planCode: selectedPlan,
            sourcePath: `${window.location.pathname}${window.location.search}`,
          }),
        }).catch(() => null)

        if (legalResponse?.ok) {
          clearPendingLegalAcceptance()
        }
      }

      setSuccess(true)

      setTimeout(() => {
        router.push(PURCHASE_PATH)
      }, 800)
    } catch (err: any) {
      clearPendingLegalAcceptance()
      setError(formatSignupError(err?.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout mode="signup">
      <div className="w-full max-w-[430px]">
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <label className="block">
            <div className="mb-1 text-sm font-bold text-slate-800">Ad Soyad</div>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 shadow-sm shadow-slate-200/40 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              placeholder="Ad Soyad"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-sm font-bold text-slate-800">E-posta</div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 shadow-sm shadow-slate-200/40 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              placeholder="mail@ornek.com"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-sm font-bold text-slate-800">Şifre</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 shadow-sm shadow-slate-200/40 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              placeholder="En az 8 karakter"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-sm font-bold text-slate-800">Şifre Tekrar</div>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 shadow-sm shadow-slate-200/40 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              placeholder="Şifreyi tekrar yazın"
            />
          </label>

          <div className="space-y-2 rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm shadow-slate-200/40">
            <div className="text-sm font-semibold text-slate-800">Hukuki onaylar</div>
            <label className="flex gap-3 text-sm leading-[1.35] text-slate-700">
              <input
                type="checkbox"
                checked={legalChecks.terms}
                onChange={(e) => setLegalChecks((current) => ({ ...current, terms: e.target.checked }))}
                className="mt-1 h-4 w-4 accent-blue-600"
              />
              <span>
                <Link href="/terms" target="_blank" className="font-bold text-blue-700 hover:text-violet-700">Kullanım şartları</Link>
                {" "}ve{" "}
                <Link href="/package-agreement" target="_blank" className="font-bold text-blue-700 hover:text-violet-700">paket sözleşmesini</Link>
                {" "}kabul ediyorum.
              </span>
            </label>
            <label className="flex gap-3 text-sm leading-[1.35] text-slate-700">
              <input
                type="checkbox"
                checked={legalChecks.kvkk}
                onChange={(e) => setLegalChecks((current) => ({ ...current, kvkk: e.target.checked }))}
                className="mt-1 h-4 w-4 accent-blue-600"
              />
              <span>
                <Link href="/kvkk" target="_blank" className="font-bold text-blue-700 hover:text-violet-700">KVKK aydınlatma metnini</Link>
                {" "}okudum.
              </span>
            </label>
            <label className="flex gap-3 text-sm leading-[1.35] text-slate-700">
              <input
                type="checkbox"
                checked={legalChecks.consent}
                onChange={(e) => setLegalChecks((current) => ({ ...current, consent: e.target.checked }))}
                className="mt-1 h-4 w-4 accent-blue-600"
              />
              <span>
                <Link href="/explicit-consent" target="_blank" className="font-bold text-blue-700 hover:text-violet-700">Özel nitelikli veri ve AI işleme açık rızasını</Link>
                {" "}veriyorum.
              </span>
            </label>
            <label className="flex gap-3 text-sm leading-[1.35] text-slate-700">
              <input
                type="checkbox"
                checked={legalChecks.authority}
                onChange={(e) => setLegalChecks((current) => ({ ...current, authority: e.target.checked }))}
                className="mt-1 h-4 w-4 accent-blue-600"
              />
              <span>Danışan/çocuk verisi girmeye yetkili olduğumu ve gerekli veli/danışan izinlerini aldığımı beyan ederim.</span>
            </label>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={loading || googleLoading}
            className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-5 text-sm font-extrabold text-slate-800 shadow-sm shadow-slate-200/60 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-blue-100 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-cyan-400 via-blue-600 to-violet-600 text-xs font-black text-white">
              G
            </span>
            {googleLoading ? "Google yönlendirmesi hazırlanıyor..." : "Google ile kayıt ol"}
          </button>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Hesabınız oluşturuldu. Satın alma ekranına yönlendiriliyorsunuz.
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 via-blue-600 to-violet-600 px-5 font-bold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:shadow-blue-600/30 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Gönderiliyor..." : "Kayıt Ol"}
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

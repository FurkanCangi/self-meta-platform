"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { supabase } from "@/lib/supabase/client"

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
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

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

    setLoading(true)

    try {
      const redirectTo = `${window.location.origin}/login`

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: fullName,
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
          plan: "none",
        })
      }

      if (data?.session) {
        try {
          await supabase.auth.signOut()
        } catch {}
      }

      setSuccess(true)

      setTimeout(() => {
        router.push("/auth-signup-success")
      }, 800)
    } catch (err: any) {
      setError(formatSignupError(err?.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-sm font-semibold uppercase tracking-wide text-blue-600">Kayıt Ol</div>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Terapist Hesabı Oluştur</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Kayıt işleminden sonra doğrulama e-postası gönderilir. E-posta doğrulanmadan panel kullanımı tamamlanmış sayılmaz.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <div className="mb-2 text-sm font-medium text-slate-700">Ad Soyad</div>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none transition focus:border-blue-500"
              placeholder="Ad Soyad"
            />
          </label>

          <label className="block">
            <div className="mb-2 text-sm font-medium text-slate-700">E-posta</div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none transition focus:border-blue-500"
              placeholder="mail@ornek.com"
            />
          </label>

          <label className="block">
            <div className="mb-2 text-sm font-medium text-slate-700">Şifre</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none transition focus:border-blue-500"
              placeholder="En az 8 karakter"
            />
          </label>

          <label className="block">
            <div className="mb-2 text-sm font-medium text-slate-700">Şifre Tekrar</div>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none transition focus:border-blue-500"
              placeholder="Şifreyi tekrar yazın"
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Doğrulama e-postası gönderildi. Gelen kutunuzu ve spam klasörünü kontrol edin.
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-5 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Gönderiliyor..." : "Kayıt Ol"}
          </button>
        </form>

        <div className="mt-5 text-sm text-slate-600">
          Hesabın var mı?{" "}
          <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-700">
            Giriş Yap
          </Link>
        </div>
      </div>
    </div>
  )
}

"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

type TherapistProfile = {
  firstName: string
  lastName: string
  title: string
  profession: string
  workplace: string
  city: string
  district: string
  publicEmail: string
  publicPhone: string
  shortAddress: string
  specialties: string
  publicListingEnabled: boolean
  publicationStatus: "pending" | "approved" | "hidden" | "rejected"
  educationCompletedAt: string | null
}

const defaultProfile: TherapistProfile = {
  firstName: "",
  lastName: "",
  title: "Uzm. Ergoterapist",
  profession: "Ergoterapist",
  workplace: "",
  city: "",
  district: "",
  publicEmail: "",
  publicPhone: "",
  shortAddress: "",
  specialties: "",
  publicListingEnabled: false,
  publicationStatus: "pending",
  educationCompletedAt: null,
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-slate-700">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-blue-500"
      />
    </label>
  )
}

function statusLabel(profile: TherapistProfile) {
  if (!profile.educationCompletedAt) return "Eğitim tamamlanma bilgisi bekleniyor"
  if (!profile.publicListingEnabled) return "Public liste kapalı"
  if (profile.publicationStatus === "approved") return "Terapist Bul sayfasında yayında"
  if (profile.publicationStatus === "rejected") return "Yayın başvurusu yeniden inceleme bekliyor"
  if (profile.publicationStatus === "hidden") return "Public görünürlük gizli"
  return "Admin onayı bekliyor"
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<TherapistProfile>(defaultProfile)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [savedAt, setSavedAt] = useState("")

  useEffect(() => {
    let active = true

    async function loadProfile() {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 8_000)
      try {
        const response = await fetch("/api/therapist-directory/profile", {
          cache: "no-store",
          signal: controller.signal,
        })
        const payload = await response.json().catch(() => ({}))

        if (!active) return

        if (response.status === 401) {
          setError("Profil bilgilerini yönetmek için giriş yapmanız gerekir.")
          return
        }

        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.error || "Profil bilgileri alınamadı.")
        }

        if (payload?.profile) {
          setProfile({ ...defaultProfile, ...payload.profile })
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error && err.name === "AbortError" ? "Profil bilgileri zamanında yüklenemedi. Lütfen tekrar deneyin." : err instanceof Error ? err.message : "Profil bilgileri alınamadı.")
        }
      } finally {
        window.clearTimeout(timeout)
        if (active) {
          setLoaded(true)
        }
      }
    }

    loadProfile()

    return () => {
      active = false
    }
  }, [])

  const fullName = useMemo(() => {
    return [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() || "Terapist"
  }, [profile.firstName, profile.lastName])

  const handleChange = (key: keyof TherapistProfile, value: string | boolean) => {
    setProfile((prev) => ({ ...prev, [key]: value as never }))
    setSavedAt("")
  }

  const handleSave = async () => {
    setSaving(true)
    setError("")

    try {
      const response = await fetch("/api/therapist-directory/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(profile),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Profil kaydedilemedi.")
      }

      if (payload?.profile) {
        setProfile({ ...defaultProfile, ...payload.profile })
      }
      setSavedAt(new Date().toLocaleString("tr-TR"))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Profil kaydedilemedi.")
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) {
    return (
      <div className="px-3 py-4 md:px-6 md:py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
          Profil bilgileri yükleniyor...
        </div>
      </div>
    )
  }

  return (
    <div className="px-3 py-4 md:px-6 md:py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 md:p-6">
          <div className="text-sm font-semibold uppercase tracking-wide text-blue-600">Profil</div>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Terapist Profil Bilgileri</h1>
          <p className="mt-3 max-w-3xl text-slate-600">
            Bu bilgiler terapist panelinizde saklanır. Açık rıza verdiğinizde, eğitim tamamlanma ve admin onayı sonrası
            Terapist Bul sayfasında public olarak gösterilir.
          </p>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6">
          <div className="mb-6 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 md:grid-cols-[1fr_auto]">
            <div>
              <div className="text-sm text-slate-500">Görünen terapist adı</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{fullName}</div>
              <div className="mt-1 text-sm text-slate-600">{profile.title || "Unvan eklenmedi"}</div>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-semibold text-blue-700">
              {statusLabel(profile)}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Ad" value={profile.firstName} onChange={(v) => handleChange("firstName", v)} placeholder="Ad" />
            <Field label="Soyad" value={profile.lastName} onChange={(v) => handleChange("lastName", v)} placeholder="Soyad" />
            <Field label="Unvan" value={profile.title} onChange={(v) => handleChange("title", v)} placeholder="Örn. Uzm. Ergoterapist" />
            <Field label="Meslek" value={profile.profession} onChange={(v) => handleChange("profession", v)} placeholder="Ergoterapist" />
            <Field label="Çalıştığı Kurum" value={profile.workplace} onChange={(v) => handleChange("workplace", v)} placeholder="Üniversite / Hastane / Klinik" />
            <Field label="Şehir" value={profile.city} onChange={(v) => handleChange("city", v)} placeholder="İstanbul" />
            <Field label="İlçe" value={profile.district} onChange={(v) => handleChange("district", v)} placeholder="Kadıköy" />
            <Field label="Public E-posta" value={profile.publicEmail} onChange={(v) => handleChange("publicEmail", v)} placeholder="mail@ornek.com" type="email" />
            <Field label="Public Telefon" value={profile.publicPhone} onChange={(v) => handleChange("publicPhone", v)} placeholder="+90 ..." />
            <Field label="Kısa Adres" value={profile.shortAddress} onChange={(v) => handleChange("shortAddress", v)} placeholder="Mahalle / kurum adresi" />
          </div>

          <div className="mt-5">
            <label className="block">
              <div className="mb-2 text-sm font-medium text-slate-700">Uzmanlık Alanları</div>
              <textarea
                value={profile.specialties}
                onChange={(e) => handleChange("specialties", e.target.value)}
                placeholder="Örn. pediatrik ergoterapi, duyu bütünleme, gelişimsel değerlendirme"
                className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
              />
            </label>
          </div>

          <label className="mt-6 flex gap-4 rounded-2xl border border-cyan-100 bg-cyan-50/60 px-5 py-4">
            <input
              type="checkbox"
              checked={profile.publicListingEnabled}
              onChange={(e) => handleChange("publicListingEnabled", e.target.checked)}
              className="mt-1 h-5 w-5 rounded border-slate-300"
            />
            <span>
              <span className="block font-semibold text-slate-900">Terapist Bul sayfasında görünmek istiyorum.</span>
              <span className="mt-1 block text-sm leading-6 text-slate-600">
                Ad, soyad, meslek, kurum, şehir, telefon ve e-posta bilgilerimin public dizinde gösterilmesine izin
                veriyorum. Yayın için eğitim tamamlanma ve admin onayı gerekir.
              </span>
            </span>
          </label>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-blue-600 px-5 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Kaydediliyor..." : "Profili Kaydet"}
            </button>

            {savedAt ? <div className="text-sm text-emerald-600">Son kayıt: {savedAt}</div> : null}
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-blue-100 bg-white p-5 md:p-6">
          <div className="text-sm font-semibold uppercase tracking-wide text-blue-600">Destek</div>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Bir sorun mu yaşıyorsunuz?</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Giriş, cihaz, paket, rapor veya eğitim hatalarında ekran görüntüsüyle destek talebi oluşturabilirsiniz.
          </p>
          <Link
            href="/support"
            className="mt-4 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            Destek Talebi Oluştur
          </Link>
        </div>
      </div>
    </div>
  )
}

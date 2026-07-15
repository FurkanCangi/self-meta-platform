"use client"

import { Plus, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import {
  DIRECTORY_REQUIRED_FIELD_LABELS,
  MAX_DIRECTORY_SPECIALTIES,
  MAX_DIRECTORY_SPECIALTY_LENGTH,
  parseDirectorySpecialties,
} from "@/lib/therapists/directory"

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

type TherapistReportProfile = {
  clinicName: string
  reportSignatureName: string
  reportSignatureTitle: string
  reportFooter: string
}

const SETTINGS_STORAGE_KEY = "dna_therapist_settings"

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

const defaultReportProfile: TherapistReportProfile = {
  clinicName: "",
  reportSignatureName: "",
  reportSignatureTitle: "",
  reportFooter: "",
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
  if (!profile.publicListingEnabled) return "Terapist Bul görünürlüğü kapalı"
  if (profile.publicationStatus === "approved") return "Terapist Bul sayfasında yayında"
  if (profile.publicationStatus === "rejected") return "Profil yayın için uygun bulunmadı"
  if (profile.publicationStatus === "hidden") return "Profil yönetici tarafından gizlendi"
  return "Eksik alanlar tamamlanınca otomatik yayınlanır"
}

function profileErrorMessage(errorCode?: string) {
  switch (errorCode) {
    case "unauthorized":
      return "Profil bilgilerini yönetmek için tekrar giriş yapmanız gerekiyor."
    case "directory_profile_setup_required":
    case "directory_profile_unavailable":
      return "Profil kayıt alanı hazırlanıyor. Lütfen biraz sonra tekrar deneyin."
    case "server_controlled_fields_present":
      return "Profil bilgileri güvenlik kontrolünden geçemedi. Sayfayı yenileyip tekrar deneyin."
    case "rate_limited":
      return "Kısa sürede çok fazla işlem yapıldı. Biraz bekleyip tekrar deneyin."
    case "directory_profile_fetch_failed":
      return "Profil bilgileri alınamadı. Lütfen sayfayı yenileyin."
    case "directory_profile_save_failed":
      return "Profil kaydedilemedi. Lütfen bilgileri kontrol edip tekrar deneyin."
    case "too_many_specialties":
      return `En fazla ${MAX_DIRECTORY_SPECIALTIES} uzmanlık alanı ekleyebilirsiniz.`
    default:
      return "Profil işlemi tamamlanamadı. Lütfen tekrar deneyin."
  }
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<TherapistProfile>(defaultProfile)
  const [reportProfile, setReportProfile] = useState<TherapistReportProfile>(defaultReportProfile)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [savedAt, setSavedAt] = useState("")
  const [publicationMessage, setPublicationMessage] = useState("")
  const [specialtyDraft, setSpecialtyDraft] = useState("")

  useEffect(() => {
    let active = true

    async function loadProfile() {
      try {
        const rawSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
        if (rawSettings && active) {
          setReportProfile({ ...defaultReportProfile, ...JSON.parse(rawSettings) })
        }
      } catch {}

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
          throw new Error(profileErrorMessage(payload?.error))
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

  const specialtyList = useMemo(() => parseDirectorySpecialties(profile.specialties), [profile.specialties])

  const handleChange = (key: keyof TherapistProfile, value: string | boolean) => {
    setProfile((prev) => ({ ...prev, [key]: value as never }))
    setSavedAt("")
    setPublicationMessage("")
  }

  const handleReportChange = (key: keyof TherapistReportProfile, value: string) => {
    setReportProfile((prev) => ({ ...prev, [key]: value }))
    setSavedAt("")
  }

  const addSpecialty = () => {
    const candidate = specialtyDraft.trim()
    if (!candidate || specialtyList.length >= MAX_DIRECTORY_SPECIALTIES) return

    const next = parseDirectorySpecialties([...specialtyList, candidate])
    if (next.length === specialtyList.length) {
      setSpecialtyDraft("")
      return
    }

    handleChange("specialties", next.join(", "))
    setSpecialtyDraft("")
  }

  const removeSpecialty = (specialty: string) => {
    handleChange(
      "specialties",
      specialtyList.filter((item) => item !== specialty).join(", "),
    )
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
        throw new Error(profileErrorMessage(payload?.error))
      }

      if (payload?.profile) {
        setProfile({ ...defaultProfile, ...payload.profile })
      }
      try {
        const currentRaw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
        const currentSettings = currentRaw ? JSON.parse(currentRaw) : {}
        window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...currentSettings, ...reportProfile }))
      } catch {}
      setSavedAt(new Date().toLocaleString("tr-TR"))
      const missingFields = Array.isArray(payload?.publication?.missingFields)
        ? payload.publication.missingFields
        : []
      if (payload?.publication?.visible) {
        setPublicationMessage("Profiliniz kaydedildi ve Terapist Bul sayfasında yayınlandı.")
      } else if (profile.publicListingEnabled && missingFields.length > 0) {
        const labels = missingFields.map(
          (field: string) => DIRECTORY_REQUIRED_FIELD_LABELS[field] || field,
        )
        setPublicationMessage(`Profil kaydedildi. Yayın için tamamlayın: ${labels.join(", ")}.`)
      } else if (profile.publicListingEnabled && payload?.profile?.publicationStatus === "hidden") {
        setPublicationMessage("Profil kaydedildi. Görünürlük yönetici tarafından kapalı tutuluyor.")
      } else if (profile.publicListingEnabled && payload?.profile?.publicationStatus === "rejected") {
        setPublicationMessage("Profil kaydedildi. Yayın durumu yönetici incelemesinde.")
      } else {
        setPublicationMessage("Profil kaydedildi. Terapist Bul görünürlüğü kapalı.")
      }
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
            Profil bilgilerinizi ve rapor çıktısında kullanılacak kurum bilgilerini tek yerden yönetin.
          </p>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-slate-300 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-900">
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

          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/50 px-5 py-4 text-sm leading-6 text-slate-700">
            Kurum adı, kısa adres ve uzmanlık alanlarınız <strong>Terapist Bul</strong> sayfasında aynen görünür.
            Danışanların okuyacağı şekilde güncel ve açık yazın.
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-4">
              <div className="text-sm font-medium text-slate-700">Uzmanlık Alanları</div>
              <div className="text-xs font-semibold text-slate-500">
                {specialtyList.length}/{MAX_DIRECTORY_SPECIALTIES}
              </div>
            </div>
            {specialtyList.length > 0 ? (
              <div className="mb-3 flex flex-wrap gap-2" aria-label="Eklenen uzmanlık alanları">
                {specialtyList.map((specialty) => (
                  <span
                    key={specialty}
                    className="inline-flex min-h-9 items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 text-sm font-semibold text-blue-800"
                  >
                    {specialty}
                    <button
                      type="button"
                      onClick={() => removeSpecialty(specialty)}
                      className="grid h-6 w-6 place-items-center rounded-full text-blue-600 transition hover:bg-blue-100"
                      aria-label={`${specialty} uzmanlığını kaldır`}
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="flex gap-2">
              <input
                value={specialtyDraft}
                maxLength={MAX_DIRECTORY_SPECIALTY_LENGTH}
                onChange={(event) => setSpecialtyDraft(event.target.value.replace(/[,;\n]/g, ""))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault()
                    addSpecialty()
                  }
                }}
                placeholder="Örn. Duyu bütünleme"
                disabled={specialtyList.length >= MAX_DIRECTORY_SPECIALTIES}
                className="h-12 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-blue-500 disabled:bg-slate-50"
              />
              <button
                type="button"
                onClick={addSpecialty}
                disabled={!specialtyDraft.trim() || specialtyList.length >= MAX_DIRECTORY_SPECIALTIES}
                className="inline-flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Uzmanlık alanı ekle"
                title="Uzmanlık alanı ekle"
              >
                <Plus size={20} />
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Her alanı ayrı ekleyin. En fazla {MAX_DIRECTORY_SPECIALTIES} uzmanlık alanı yayınlanır.
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5">
            <h2 className="text-xl font-semibold text-slate-900">Kurum ve Rapor Bilgileri</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Rapor çıktısında görünecek kurum, imza ve kısa not bilgilerini burada düzenleyebilirsiniz.
            </p>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <Field
                label="Kurum / Klinik Adı"
                value={reportProfile.clinicName}
                onChange={(v) => handleReportChange("clinicName", v)}
                placeholder="Kurum adı"
              />
              <Field
                label="Rapor İmza Adı"
                value={reportProfile.reportSignatureName}
                onChange={(v) => handleReportChange("reportSignatureName", v)}
                placeholder="Ad Soyad"
              />
              <Field
                label="Rapor İmza Unvanı"
                value={reportProfile.reportSignatureTitle}
                onChange={(v) => handleReportChange("reportSignatureTitle", v)}
                placeholder="Uzm. Ergoterapist / Dr. / Öğr. Gör."
              />
              <label className="block md:col-span-2">
                <div className="mb-2 text-sm font-medium text-slate-700">Rapor Alt Notu</div>
                <textarea
                  value={reportProfile.reportFooter}
                  onChange={(e) => handleReportChange("reportFooter", e.target.value)}
                  placeholder="Rapor sonunda görünmesini istediğiniz kısa profesyonel not"
                  className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
                />
              </label>
            </div>
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
                Ad, soyad, meslek, kurum, şehir, adres, uzmanlık, telefon ve e-posta bilgilerimin herkese açık dizinde
                gösterilmesine izin veriyorum. Gerekli alanları tamamlayıp kaydettiğinizde profiliniz otomatik yayınlanır.
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

            {savedAt ? <div className="text-sm text-cyan-700">Son kayıt: {savedAt}</div> : null}
          </div>

          {publicationMessage ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700" role="status">
              {publicationMessage}
            </div>
          ) : null}
        </div>

      </div>
    </div>
  )
}

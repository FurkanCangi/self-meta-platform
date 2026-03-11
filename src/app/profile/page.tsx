"use client"

import { useEffect, useMemo, useState } from "react"

type TherapistProfile = {
  firstName: string
  lastName: string
  title: string
  graduationDepartment: string
  graduationUniversity: string
  graduationYear: string
  workplace: string
  city: string
  email: string
  phone: string
  specialties: string
  about: string
}

const STORAGE_KEY = "selfmeta_therapist_profile"

const defaultProfile: TherapistProfile = {
  firstName: "",
  lastName: "",
  title: "Öğr. Gör. / Uzm. Ergoterapist",
  graduationDepartment: "Ergoterapi",
  graduationUniversity: "",
  graduationYear: "",
  workplace: "",
  city: "",
  email: "",
  phone: "",
  specialties: "",
  about: "",
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

export default function ProfilePage() {
  const [profile, setProfile] = useState<TherapistProfile>(defaultProfile)
  const [loaded, setLoaded] = useState(false)
  const [savedAt, setSavedAt] = useState("")

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        setProfile({ ...defaultProfile, ...parsed })
      }
    } catch {}
    setLoaded(true)
  }, [])

  const fullName = useMemo(() => {
    return [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() || "Terapist"
  }, [profile.firstName, profile.lastName])

  const handleChange = (key: keyof TherapistProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
    const now = new Date().toLocaleString("tr-TR")
    setSavedAt(now)
  }

  if (!loaded) {
    return (
      <div className="px-6 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
          Profil bilgileri yükleniyor...
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold uppercase tracking-wide text-blue-600">Terapist Profili</div>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">Profil Bilgileri</h1>
              <p className="mt-2 max-w-3xl text-slate-600">
                Bu alan, terapistin sistem içinde kullanılacak profesyonel kimlik bilgilerini yönetmek için hazırlanmıştır.
                Buradaki bilgiler ileride rapor imzası, kurum bilgisi ve uzman özeti gibi alanlarda kullanılabilir.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
              <div className="text-sm text-slate-500">Görünen terapist adı</div>
              <div className="mt-1 text-xl font-semibold text-slate-900">{fullName}</div>
              <div className="mt-1 text-sm text-slate-600">{profile.title || "Unvan eklenmedi"}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-semibold text-slate-900">Temel Bilgiler</h2>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <Field label="Ad" value={profile.firstName} onChange={(v) => handleChange("firstName", v)} placeholder="Ad" />
              <Field label="Soyad" value={profile.lastName} onChange={(v) => handleChange("lastName", v)} placeholder="Soyad" />
              <Field label="Unvan" value={profile.title} onChange={(v) => handleChange("title", v)} placeholder="Örn. Dr. Öğr. Üyesi / Uzm. Ergoterapist" />
              <Field label="Bölüm / Mezuniyet Alanı" value={profile.graduationDepartment} onChange={(v) => handleChange("graduationDepartment", v)} placeholder="Ergoterapi" />
              <Field label="Mezun Olduğu Üniversite" value={profile.graduationUniversity} onChange={(v) => handleChange("graduationUniversity", v)} placeholder="Üniversite adı" />
              <Field label="Mezuniyet Yılı" value={profile.graduationYear} onChange={(v) => handleChange("graduationYear", v)} placeholder="Örn. 2020" />
              <Field label="Çalıştığı Kurum" value={profile.workplace} onChange={(v) => handleChange("workplace", v)} placeholder="Üniversite / Hastane / Klinik" />
              <Field label="Şehir" value={profile.city} onChange={(v) => handleChange("city", v)} placeholder="İstanbul" />
              <Field label="E-posta" value={profile.email} onChange={(v) => handleChange("email", v)} placeholder="mail@ornek.com" type="email" />
              <Field label="Telefon" value={profile.phone} onChange={(v) => handleChange("phone", v)} placeholder="+90 ..." />
            </div>

            <div className="mt-5">
              <label className="block">
                <div className="mb-2 text-sm font-medium text-slate-700">Uzmanlık Alanları</div>
                <textarea
                  value={profile.specialties}
                  onChange={(e) => handleChange("specialties", e.target.value)}
                  placeholder="Örn. pediatrik ergoterapi, duyu bütünleme, gelişimsel değerlendirme"
                  className="min-h-[110px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
                />
              </label>
            </div>

            <div className="mt-5">
              <label className="block">
                <div className="mb-2 text-sm font-medium text-slate-700">Kısa Profesyonel Özgeçmiş</div>
                <textarea
                  value={profile.about}
                  onChange={(e) => handleChange("about", e.target.value)}
                  placeholder="Terapistin kısa profesyonel tanıtımı"
                  className="min-h-[160px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                onClick={handleSave}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-blue-600 px-5 font-semibold text-white transition hover:bg-blue-700"
              >
                Profili Kaydet
              </button>

              <button
                onClick={() => {
                  setProfile(defaultProfile)
                  localStorage.removeItem(STORAGE_KEY)
                  setSavedAt("")
                }}
                className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Temizle
              </button>

              {savedAt ? (
                <div className="text-sm text-emerald-600">Son kayıt: {savedAt}</div>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-semibold text-slate-900">Önizleme</h2>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Terapist Kartı</div>
              <div className="mt-3 text-2xl font-bold text-slate-900">{fullName}</div>
              <div className="mt-1 text-slate-600">{profile.title || "Unvan belirtilmedi"}</div>

              <div className="mt-5 space-y-3 text-sm text-slate-700">
                <div><span className="font-medium">Bölüm:</span> {profile.graduationDepartment || "-"}</div>
                <div><span className="font-medium">Üniversite:</span> {profile.graduationUniversity || "-"}</div>
                <div><span className="font-medium">Mezuniyet yılı:</span> {profile.graduationYear || "-"}</div>
                <div><span className="font-medium">Kurum:</span> {profile.workplace || "-"}</div>
                <div><span className="font-medium">Şehir:</span> {profile.city || "-"}</div>
                <div><span className="font-medium">E-posta:</span> {profile.email || "-"}</div>
                <div><span className="font-medium">Telefon:</span> {profile.phone || "-"}</div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-semibold text-slate-900">Uzmanlık Alanları</div>
              <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-600">
                {profile.specialties || "Henüz uzmanlık alanı eklenmedi."}
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-semibold text-slate-900">Profesyonel Özgeçmiş</div>
              <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-600">
                {profile.about || "Henüz kısa özgeçmiş eklenmedi."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

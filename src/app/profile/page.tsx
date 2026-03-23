"use client"

import { useEffect, useMemo, useState } from "react"

type TherapistProfile = {
  firstName: string
  lastName: string
  title: string
  profession: string
  graduationDepartment: string
  graduationUniversity: string
  graduationYear: string
  workplace: string
  city: string
  email: string
  phone: string
  specialties: string
  certificates: string
  about: string
}

const STORAGE_KEY = "selfmeta_therapist_profile"

const defaultProfile: TherapistProfile = {
  firstName: "",
  lastName: "",
  title: "Uzm. Ergoterapist",
  profession: "Ergoterapist",
  graduationDepartment: "Ergoterapi",
  graduationUniversity: "",
  graduationYear: "",
  workplace: "",
  city: "",
  email: "",
  phone: "",
  specialties: "",
  certificates: "",
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
        setProfile({ ...defaultProfile, ...JSON.parse(raw) })
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
    setSavedAt(new Date().toLocaleString("tr-TR"))
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
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6">
          <div className="text-sm font-semibold uppercase tracking-wide text-blue-600">Profil</div>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Terapist Profil Bilgileri</h1>
          <p className="mt-3 max-w-3xl text-slate-600">
            Bu bölüm yalnızca terapistin profesyonel kimlik ve özgeçmiş bilgilerinin yönetimi için kullanılır.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
            <div className="text-sm text-slate-500">Görünen terapist adı</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{fullName}</div>
            <div className="mt-1 text-sm text-slate-600">{profile.title || "Unvan eklenmedi"}</div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Ad" value={profile.firstName} onChange={(v) => handleChange("firstName", v)} placeholder="Ad" />
            <Field label="Soyad" value={profile.lastName} onChange={(v) => handleChange("lastName", v)} placeholder="Soyad" />
            <Field label="Unvan" value={profile.title} onChange={(v) => handleChange("title", v)} placeholder="Örn. Uzm. Ergoterapist" />
            <Field label="Meslek" value={profile.profession} onChange={(v) => handleChange("profession", v)} placeholder="Ergoterapist" />
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
                className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
              />
            </label>
          </div>

          <div className="mt-5">
            <label className="block">
              <div className="mb-2 text-sm font-medium text-slate-700">Sertifikalar / Ek Eğitimler</div>
              <textarea
                value={profile.certificates}
                onChange={(e) => handleChange("certificates", e.target.value)}
                placeholder="Örn. ASI modülü, klinik kurslar, sertifikalar"
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
                className="min-h-[170px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
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
      </div>
    </div>
  )
}

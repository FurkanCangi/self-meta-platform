"use client"

import { useEffect, useState } from "react"

type TherapistSettings = {
  clinicName: string
  reportSignatureName: string
  reportSignatureTitle: string
  reportFooter: string
  emailNotifications: boolean
  reportHistoryVisible: boolean
}

const STORAGE_KEY = "selfmeta_therapist_settings"

const defaultSettings: TherapistSettings = {
  clinicName: "",
  reportSignatureName: "",
  reportSignatureTitle: "",
  reportFooter: "",
  emailNotifications: true,
  reportHistoryVisible: true,
}

export default function ProfileSettingPage() {
  const [settings, setSettings] = useState<TherapistSettings>(defaultSettings)
  const [loaded, setLoaded] = useState(false)
  const [savedAt, setSavedAt] = useState("")

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        setSettings({ ...defaultSettings, ...JSON.parse(raw) })
      }
    } catch {}
    setLoaded(true)
  }, [])

  const update = (key: keyof TherapistSettings, value: string | boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value as never }))
  }

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    setSavedAt(new Date().toLocaleString("tr-TR"))
  }

  if (!loaded) {
    return (
      <div className="px-6 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
          Ayarlar yükleniyor...
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <div className="text-sm font-semibold uppercase tracking-wide text-blue-600">Ayarlar</div>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Terapist Paneli Ayarları</h1>
          <p className="mt-3 max-w-3xl text-slate-600">
            Bu alan, panel içinde kullanılacak temel terapist ayarlarını ve rapor imzası yapılandırmasını düzenlemek için hazırlanmıştır.
          </p>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="grid gap-5">
              <label className="block">
                <div className="mb-2 text-sm font-medium text-slate-700">Kurum / Klinik Adı</div>
                <input
                  value={settings.clinicName}
                  onChange={(e) => update("clinicName", e.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none transition focus:border-blue-500"
                  placeholder="Kurum adı"
                />
              </label>

              <label className="block">
                <div className="mb-2 text-sm font-medium text-slate-700">Rapor İmza Adı</div>
                <input
                  value={settings.reportSignatureName}
                  onChange={(e) => update("reportSignatureName", e.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none transition focus:border-blue-500"
                  placeholder="Ad Soyad"
                />
              </label>

              <label className="block">
                <div className="mb-2 text-sm font-medium text-slate-700">Rapor İmza Unvanı</div>
                <input
                  value={settings.reportSignatureTitle}
                  onChange={(e) => update("reportSignatureTitle", e.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none transition focus:border-blue-500"
                  placeholder="Uzm. Ergoterapist / Dr. / Öğr. Gör."
                />
              </label>

              <label className="block">
                <div className="mb-2 text-sm font-medium text-slate-700">Rapor Alt Notu</div>
                <textarea
                  value={settings.reportFooter}
                  onChange={(e) => update("reportFooter", e.target.value)}
                  className="min-h-[130px] w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-blue-500"
                  placeholder="Rapor sonunda görünmesini istediğiniz kısa profesyonel not"
                />
              </label>

              <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4">
                <div>
                  <div className="font-medium text-slate-900">E-posta bildirimleri</div>
                  <div className="text-sm text-slate-500">Önemli sistem olayları için bildirimleri açık tut</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.emailNotifications}
                  onChange={(e) => update("emailNotifications", e.target.checked)}
                  className="h-5 w-5"
                />
              </label>

              <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4">
                <div>
                  <div className="font-medium text-slate-900">Rapor geçmişi görünürlüğü</div>
                  <div className="text-sm text-slate-500">Panelde kayıtlı rapor geçmişini görünür tut</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.reportHistoryVisible}
                  onChange={(e) => update("reportHistoryVisible", e.target.checked)}
                  className="h-5 w-5"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                onClick={handleSave}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-blue-600 px-5 font-semibold text-white transition hover:bg-blue-700"
              >
                Ayarları Kaydet
              </button>

              <button
                onClick={() => {
                  setSettings(defaultSettings)
                  localStorage.removeItem(STORAGE_KEY)
                  setSavedAt("")
                }}
                className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Sıfırla
              </button>

              {savedAt ? (
                <div className="text-sm text-emerald-600">Son kayıt: {savedAt}</div>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-semibold text-slate-900">Ayar Özeti</h2>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="space-y-3 text-sm text-slate-700">
                <div><span className="font-medium">Kurum:</span> {settings.clinicName || "-"}</div>
                <div><span className="font-medium">İmza adı:</span> {settings.reportSignatureName || "-"}</div>
                <div><span className="font-medium">İmza unvanı:</span> {settings.reportSignatureTitle || "-"}</div>
                <div><span className="font-medium">E-posta bildirimleri:</span> {settings.emailNotifications ? "Açık" : "Kapalı"}</div>
                <div><span className="font-medium">Rapor geçmişi:</span> {settings.reportHistoryVisible ? "Görünür" : "Gizli"}</div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-semibold text-slate-900">Rapor Alt Notu Önizleme</div>
              <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-600">
                {settings.reportFooter || "Henüz rapor alt notu eklenmedi."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

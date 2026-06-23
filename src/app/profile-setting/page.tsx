"use client"

import { useEffect, useState } from "react"
import DeviceManagementPanel from "./DeviceManagementPanel"

type TherapistSettings = {
  emailNotifications: boolean
  reportHistoryVisible: boolean
  defaultPlan: "Starter" | "Professional" | "Clinic"
  autoRenew: boolean
  invoiceEmail: string
  teamAccessEnabled: boolean
}

const STORAGE_KEY = "dna_therapist_settings"

const defaultSettings: TherapistSettings = {
  emailNotifications: true,
  reportHistoryVisible: true,
  defaultPlan: "Professional",
  autoRenew: true,
  invoiceEmail: "",
  teamAccessEnabled: false,
}

function ToggleRow({
  title,
  desc,
  checked,
  onChange,
}: {
  title: string
  desc: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4">
      <div>
        <div className="font-medium text-slate-900">{title}</div>
        <div className="text-sm text-slate-500">{desc}</div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5"
      />
    </label>
  )
}

export default function ProfileSettingPage() {
  const [settings, setSettings] = useState<TherapistSettings>(defaultSettings)
  const [loaded, setLoaded] = useState(false)
  const [savedAt, setSavedAt] = useState("")
  const [deviceLimitMode, setDeviceLimitMode] = useState(false)
  const [devicesTabRequested, setDevicesTabRequested] = useState(false)

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      setDeviceLimitMode(params.get("deviceLimit") === "1")
      setDevicesTabRequested(params.get("tab") === "devices")
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
    const current = readStoredSettings()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...settings }))
    setSavedAt(new Date().toLocaleString("tr-TR"))
  }

  const handleReset = () => {
    const current = readStoredSettings()
    setSettings(defaultSettings)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...defaultSettings }))
    setSavedAt("")
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
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6">
          <div className="text-sm font-semibold uppercase tracking-wide text-blue-600">Ayarlar</div>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Terapist Paneli Ayarları</h1>
          <p className="mt-3 max-w-3xl text-slate-600">
            Bu bölüm cihaz, bildirim, görünürlük, plan ve faturalama tercihleri için kullanılır.
          </p>
        </div>

        {deviceLimitMode ? (
          <DeviceManagementPanel deviceLimitMode />
        ) : (
        <div className="space-y-6">
          {devicesTabRequested ? <DeviceManagementPanel /> : null}

          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-semibold text-slate-900">Bildirim ve Görünürlük</h2>

            <div className="mt-5 space-y-4">
              <ToggleRow
                title="E-posta bildirimleri"
                desc="Önemli sistem olayları için bildirimleri açık tut"
                checked={settings.emailNotifications}
                onChange={(v) => update("emailNotifications", v)}
              />

              <ToggleRow
                title="Rapor geçmişi görünürlüğü"
                desc="Panelde kayıtlı rapor geçmişini görünür tut"
                checked={settings.reportHistoryVisible}
                onChange={(v) => update("reportHistoryVisible", v)}
              />

              <ToggleRow
                title="Ekip erişimi"
                desc="İleride çok kullanıcılı klinik kullanımı için ekip erişimini aktif tut"
                checked={settings.teamAccessEnabled}
                onChange={(v) => update("teamAccessEnabled", v)}
              />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-semibold text-slate-900">Plan ve Faturalama Tercihleri</h2>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <label className="block">
                <div className="mb-2 text-sm font-medium text-slate-700">Varsayılan Plan</div>
                <select
                  value={settings.defaultPlan}
                  onChange={(e) => update("defaultPlan", e.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 outline-none transition focus:border-blue-500"
                >
                  <option value="Starter">Starter</option>
                  <option value="Professional">Professional</option>
                  <option value="Clinic">Clinic</option>
                </select>
              </label>

              <label className="block">
                <div className="mb-2 text-sm font-medium text-slate-700">Fatura E-postası</div>
                <input
                  value={settings.invoiceEmail}
                  onChange={(e) => update("invoiceEmail", e.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none transition focus:border-blue-500"
                  placeholder="fatura@ornek.com"
                />
              </label>

              <div className="md:col-span-2">
                <ToggleRow
                  title="Otomatik yenileme"
                  desc="Plan süresi sonunda aboneliği otomatik yenile"
                  checked={settings.autoRenew}
                  onChange={(v) => update("autoRenew", v)}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={handleSave}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-blue-600 px-5 font-semibold text-white transition hover:bg-blue-700"
            >
              Ayarları Kaydet
            </button>

            <button
              onClick={handleReset}
              className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Sıfırla
            </button>

            {savedAt ? (
              <div className="text-sm text-cyan-700">Son kayıt: {savedAt}</div>
            ) : null}
          </div>
        </div>
        )}
      </div>
    </div>
  )
}

function readStoredSettings(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

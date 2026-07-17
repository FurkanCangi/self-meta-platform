"use client"

import { useEffect, useState } from "react"
import DeviceManagementPanel, {
  type DeviceRecoveryReason,
  type DeviceRecoverySurface,
} from "./DeviceManagementPanel"

type TherapistSettings = {
  emailNotifications: boolean
  reportHistoryVisible: boolean
  invoiceEmail: string
}

const STORAGE_KEY = "dna_therapist_settings"

const defaultSettings: TherapistSettings = {
  emailNotifications: true,
  reportHistoryVisible: true,
  invoiceEmail: "",
}

type DeviceRecoveryContext = {
  nextPath: string
  surface: DeviceRecoverySurface
}

function sanitizeRecoveryNextPath(value: string | null) {
  const raw = String(value || "")
  if (
    !raw ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(raw) ||
    raw.startsWith("/legal/accept")
  ) {
    return "/starter"
  }
  return raw
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
  const [deviceRecoveryReason, setDeviceRecoveryReason] = useState<DeviceRecoveryReason>(null)
  const [deviceApprovalRequired, setDeviceApprovalRequired] = useState(false)
  const [deviceRecoveryContext, setDeviceRecoveryContext] = useState<DeviceRecoveryContext>({
    nextPath: "/starter",
    surface: "web",
  })

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const error = params.get("error")
      setDeviceRecoveryReason(
        error === "device_limit_exceeded" ||
          error === "replacement_limit_exceeded" ||
          error === "trusted_device_required"
          ? error
          : params.get("deviceLimit") === "1"
            ? "device_limit_exceeded"
            : null
      )
      setDeviceApprovalRequired(params.get("approval") === "required")
      const nextPath = sanitizeRecoveryNextPath(params.get("next"))
      setDeviceRecoveryContext({
        nextPath,
        surface:
          params.get("surface") === "app" || nextPath.includes("surface=app") ? "app" : "web",
      })
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const stored = JSON.parse(raw) as Partial<TherapistSettings>
        setSettings({
          emailNotifications:
            typeof stored.emailNotifications === "boolean"
              ? stored.emailNotifications
              : defaultSettings.emailNotifications,
          reportHistoryVisible:
            typeof stored.reportHistoryVisible === "boolean"
              ? stored.reportHistoryVisible
              : defaultSettings.reportHistoryVisible,
          invoiceEmail: typeof stored.invoiceEmail === "string" ? stored.invoiceEmail : "",
        })
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

  const handleReset = () => {
    setSettings(defaultSettings)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultSettings))
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
            Bu bölüm güvenilir cihazlarınızı, bildirimlerinizi ve rapor satın alımlarında kullanılacak fatura e-postasını yönetir.
          </p>
        </div>

        {deviceRecoveryReason || deviceApprovalRequired ? (
          <DeviceManagementPanel
            recoveryReason={deviceRecoveryReason}
            approvalRequired={deviceApprovalRequired}
            nextPath={deviceRecoveryContext.nextPath}
            surface={deviceRecoveryContext.surface}
          />
        ) : (
          <div className="space-y-6">
            <DeviceManagementPanel />

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
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <h2 className="text-xl font-semibold text-slate-900">Rapor Hakları ve Faturalama</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Bu hesap bireyseldir. Satın aldığınız rapor hakları aylık yenilenmez veya süre sonunda silinmez; kullanılana kadar hesabınızda kalır.
              </p>

              <div className="mt-5 max-w-xl">
                <label className="block">
                  <div className="mb-2 text-sm font-medium text-slate-700">Fatura E-postası</div>
                  <input
                    value={settings.invoiceEmail}
                    onChange={(e) => update("invoiceEmail", e.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none transition focus:border-blue-500"
                    placeholder="fatura@ornek.com"
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-blue-600 px-5 font-semibold text-white transition hover:bg-blue-700"
              >
                Ayarları Kaydet
              </button>

              <button
                type="button"
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

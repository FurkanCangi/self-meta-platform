"use client"

import { useEffect, useState } from "react"

type DeviceRow = {
  id: string
  deviceType: string
  firstSeenAt: string
  lastSeenAt: string
  revokedAt: string | null
  lastIp: string | null
  userAgent: string | null
}

type DeviceResponse = {
  ok: boolean
  mode?: "active_session" | "device_management"
  devices?: DeviceRow[]
  error?: string
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

function formatDate(value: string | null | undefined) {
  if (!value) return "Bilinmiyor"
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value))
  } catch {
    return "Bilinmiyor"
  }
}

function deviceLabel(type: string) {
  if (type === "desktop") return "Bilgisayar"
  if (type === "mobile") return "Telefon"
  if (type === "tablet") return "Tablet"
  return "Cihaz"
}

const deviceSlots = [
  { type: "desktop", label: "Bilgisayar" },
  { type: "mobile", label: "Telefon" },
  { type: "tablet", label: "Tablet" },
]

export default function DeviceManagementPanel({ deviceLimitMode = false }: { deviceLimitMode?: boolean }) {
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState("")
  const [continuing, setContinuing] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const loadDevices = async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/security/devices", { credentials: "include" })
      const payload = (await response.json().catch(() => null)) as DeviceResponse | null
      if (!response.ok || !payload?.ok) {
        setError("Cihaz listesi şu anda alınamadı. Lütfen tekrar deneyin.")
        return
      }
      setDevices(payload.devices || [])
    } catch {
      setError("Cihaz listesi şu anda alınamadı. Lütfen tekrar deneyin.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDevices()
  }, [])

  const revokeDevice = async (deviceId: string) => {
    if (!window.confirm("Bu cihazı hesaptan kaldırmak istediğinize emin misiniz?")) return
    setWorkingId(deviceId)
    setError("")
    setMessage("")
    try {
      const response = await fetch("/api/security/devices", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "revoke", deviceId }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) {
        setError("Cihaz kaldırılamadı. Sayfayı yenileyip tekrar deneyin.")
        return
      }
      setMessage("Cihaz kaldırıldı. Bu cihazla devam etmek için aşağıdaki butona basabilirsiniz.")
      await loadDevices()
    } catch {
      setError("Cihaz kaldırılamadı. Sayfayı yenileyip tekrar deneyin.")
    } finally {
      setWorkingId("")
    }
  }

  const continueWithThisDevice = async () => {
    setContinuing(true)
    setError("")
    setMessage("")
    try {
      const response = await fetch("/api/security/session/register", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deviceId: getOrCreateDeviceId(),
          deviceType: detectDeviceType(),
          allowSlotReuse: true,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) {
        if (payload?.error === "device_limit_exceeded") {
          setError("Cihaz limiti hala dolu. Devam etmek için kullanmadığınız bir cihazı daha kaldırın.")
        } else {
          setError("Bu cihazla devam edilemedi. Lütfen tekrar deneyin.")
        }
        return
      }
      window.location.href = "/starter"
    } catch {
      setError("Bu cihazla devam edilemedi. Lütfen tekrar deneyin.")
    } finally {
      setContinuing(false)
    }
  }

  const activeDevices = devices.filter((device) => !device.revokedAt)
  const revokedDevices = devices.filter((device) => device.revokedAt)
  const activeSlotTypes = new Set(activeDevices.map((device) => device.deviceType))

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-blue-600">Cihazlarım</div>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Hesaba bağlı cihazlar</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Hesabınız 1 bilgisayar, 1 telefon ve 1 tablet hakkıyla kullanılabilir. Kullanmadığınız cihazı kaldırıp bu cihazla devam edebilirsiniz.
          </p>
        </div>

        <button
          type="button"
          onClick={continueWithThisDevice}
          disabled={continuing}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {continuing ? "Kontrol ediliyor..." : "Bu cihazla devam et"}
        </button>
      </div>

      {deviceLimitMode ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Cihaz limiti dolu olduğu için şu an sadece bu bölümü kullanabilirsiniz. Kullanmadığınız bir cihazı kaldırın, sonra “Bu cihazla devam et” butonuna basın.
        </div>
      ) : null}

      {message ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Aktif cihazlar</h3>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {activeDevices.length}/3
          </span>
        </div>

        <div className="mb-4 grid gap-2 sm:grid-cols-3">
          {deviceSlots.map((slot) => {
            const used = activeSlotTypes.has(slot.type)
            return (
              <div
                key={slot.type}
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  used
                    ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                <div className="font-semibold">{slot.label}</div>
                <div className="mt-1 text-xs">{used ? "Kullanılıyor" : "Boş hak"}</div>
              </div>
            )
          })}
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-500">Cihazlar yükleniyor...</div>
        ) : activeDevices.length ? (
          <div className="space-y-3">
            {activeDevices.map((device) => (
              <div
                key={device.id}
                className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">
                    {deviceLabel(device.deviceType)}
                    {device.lastIp ? <span className="font-normal text-slate-500"> / {device.lastIp}</span> : null}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">Son kullanım: {formatDate(device.lastSeenAt)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => revokeDevice(device.id)}
                  disabled={workingId === device.id}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {workingId === device.id ? "Kaldırılıyor..." : "Cihazı kaldır"}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-500">Aktif cihaz bulunamadı.</div>
        )}
      </div>

      {revokedDevices.length ? (
        <details className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">Kaldırılmış cihazlar</summary>
          <div className="mt-4 space-y-2">
            {revokedDevices.map((device) => (
              <div key={device.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-3 text-sm">
                <span className="font-medium text-slate-700">{deviceLabel(device.deviceType)}</span>
                <span className="text-slate-500">{formatDate(device.revokedAt)}</span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  )
}

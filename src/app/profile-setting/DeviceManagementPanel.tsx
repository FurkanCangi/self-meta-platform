"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  createBrowserDeviceProof,
  createDevicePossessionHeaders,
} from "@/lib/security/browserDeviceIdentity"
import { logoutAppSession } from "@/lib/security/clientLogout"

type DeviceLocation = {
  city?: string | null
  country?: string | null
}

type DeviceRow = {
  id: string
  displayName?: string | null
  deviceType: string
  firstSeenAt: string
  lastSeenAt: string
  revokedAt: string | null
  userAgent: string | null
  location?: DeviceLocation | null
  locationCity?: string | null
  locationCountry?: string | null
  isCurrent?: boolean
  isVerified?: boolean
  verificationStatus?: "verified" | "pending" | "legacy" | "revoked" | string
  verificationMethod?: string | null
}

type PendingApproval = {
  id: string
  challengeId?: string
  deviceId: string
  displayName?: string | null
  deviceType: string
  requestedAt: string
  expiresAt: string
  status?:
    | "pending"
    | "approved"
    | "rejected"
    | "expired"
    | "attempts_exhausted"
    | "device_limit"
    | "replacement_limit"
  isCurrent?: boolean
  verificationCode?: string
}

type ReplacementPolicy = {
  used: number
  limit: number
  remaining: number
  windowDays: number
}

type DeviceResponse = {
  ok: boolean
  mode?: "active_session" | "device_management"
  currentDeviceId?: string | null
  maxDevices?: number
  replacementPolicy?: ReplacementPolicy
  devices?: DeviceRow[]
  pendingApprovals?: PendingApproval[]
  error?: string
}

class DeviceActionRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterSeconds: number | null = null
  ) {
    super(message)
    this.name = "DeviceActionRequestError"
  }
}

export type DeviceRecoveryReason =
  | "device_limit_exceeded"
  | "replacement_limit_exceeded"
  | "trusted_device_required"
  | null

export type DeviceRecoverySurface = "app" | "web"

type DeviceManagementPanelProps = {
  recoveryReason?: DeviceRecoveryReason
  approvalRequired?: boolean
  nextPath?: string
  surface?: DeviceRecoverySurface
}

const recoveryContent: Record<
  NonNullable<DeviceRecoveryReason>,
  { title: string; description: string; nextStep: string }
> = {
  device_limit_exceeded: {
    title: "3 güvenilir cihaz hakkınız dolu",
    description:
      "Bu yeni cihazdan mevcut cihaz adlarını güvenlik nedeniyle göstermiyoruz. Hesabınız ve kayıtlarınız duruyor.",
    nextStep:
      "Mevcut güvenilir cihazlarınızdan birinde Ayarlar → Cihazlarım bölümünü açın, kullanmadığınız cihazı kaldırın ve sonra bu cihazda yeniden giriş yapın.",
  },
  replacement_limit_exceeded: {
    title: "Cihaz değiştirme hakkınız bu dönem için dolu",
    description:
      "30 gün içindeki 2 cihaz değişikliği kullanılmış. Mevcut güvenilir cihazlarınız çalışmaya devam eder; hesabınız kilitlenmedi.",
    nextStep:
      "Yeni bir cihaz eklemek için cihaz desteği isteyin. Destek ekibi güvenli kontrolün ardından değiştirme hakkınızı sıfırlayabilir.",
  },
  trusted_device_required: {
    title: "Bu cihazı onaylayacak güvenilir cihaz bulunamadı",
    description:
      "Hesabınız ve kayıtlarınız silinmedi. Güvenlik nedeniyle bu tarayıcıda eski cihaz listesi gösterilmiyor.",
    nextStep:
      "Cihaz desteği isteyin. Destek ekibi hesap sahipliğini kontrol ettikten sonra güvenilir cihaz erişimini güvenli biçimde yenileyebilir.",
  },
}

function retryAfterMs(response: Response) {
  const value = response.headers.get("retry-after")?.trim()
  if (!value) return 30_000
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds * 1000)
  const date = Date.parse(value)
  return Number.isFinite(date) ? Math.max(1_000, date - Date.now()) : 30_000
}

function deviceActionRateLimitMessage(error: unknown) {
  if (!(error instanceof DeviceActionRequestError) || error.status !== 429) return null
  const waitSeconds = error.retryAfterSeconds || 30
  return `Cihaz işlemi sınırına ulaşıldı. ${waitSeconds} saniye bekleyip yeniden deneyin.`
}

function sanitizeRecoveryNextPath(value?: string | null) {
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

function buildRecoveryLoginUrl({
  nextPath,
  surface,
  notice,
}: {
  nextPath?: string
  surface?: DeviceRecoverySurface
  notice?: "device_approved" | "device_retry"
}) {
  const safeNextPath = sanitizeRecoveryNextPath(nextPath)
  const resolvedSurface =
    surface === "app" || safeNextPath.includes("surface=app") ? "app" : "web"
  const params = new URLSearchParams()
  params.set("surface", resolvedSurface)
  if (safeNextPath !== "/starter") params.set("next", safeNextPath)
  if (notice) params.set(notice, "1")
  return `${resolvedSurface === "app" ? "/app-login" : "/login"}?${params.toString()}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Bilinmiyor"
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "Bilinmiyor"
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function deviceTypeLabel(type: string) {
  if (type === "desktop") return "Bilgisayar"
  if (type === "mobile") return "Telefon"
  if (type === "tablet") return "Tablet"
  return "Cihaz"
}

function browserLabel(userAgent: string | null) {
  const value = userAgent || ""
  if (/Edg\//i.test(value)) return "Microsoft Edge"
  if (/Firefox\//i.test(value)) return "Firefox"
  if (/Chrome\//i.test(value)) return "Chrome"
  if (/Safari\//i.test(value)) return "Safari"
  return "Tarayıcı"
}

function deviceName(device: DeviceRow) {
  const custom = device.displayName?.trim()
  return custom || `${deviceTypeLabel(device.deviceType)} · ${browserLabel(device.userAgent)}`
}

function deviceLocation(device: DeviceRow) {
  const city = device.location?.city || device.locationCity
  const country = device.location?.country || device.locationCountry
  return [city, country].filter(Boolean).join(", ") || "Konum bilinmiyor"
}

export default function DeviceManagementPanel({
  recoveryReason = null,
  approvalRequired = false,
  nextPath = "/starter",
  surface = "web",
}: DeviceManagementPanelProps) {
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([])
  const [replacementPolicy, setReplacementPolicy] = useState<ReplacementPolicy | null>(null)
  const [mode, setMode] = useState<DeviceResponse["mode"]>(
    recoveryReason || approvalRequired ? "device_management" : "active_session"
  )
  const [maxDevices, setMaxDevices] = useState(3)
  const [loading, setLoading] = useState(true)
  const [workingKey, setWorkingKey] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [renamingId, setRenamingId] = useState("")
  const [renameValue, setRenameValue] = useState("")
  const [approvalCodes, setApprovalCodes] = useState<Record<string, string>>({})
  const [pollBackoffUntil, setPollBackoffUntil] = useState(0)
  const [hasSuccessfulLoad, setHasSuccessfulLoad] = useState(false)
  const activationAttempted = useRef(false)
  const cryptoUpgradeAttempted = useRef(false)
  const approvalInFlightChallenges = useRef(new Set<string>())
  const approvedLoginUrl = buildRecoveryLoginUrl({ nextPath, surface, notice: "device_approved" })
  const retryLoginUrl = buildRecoveryLoginUrl({ nextPath, surface, notice: "device_retry" })
  const returnLoginUrl = buildRecoveryLoginUrl({ nextPath, surface })
  const resolvedRecoverySurface =
    surface === "app" || sanitizeRecoveryNextPath(nextPath).includes("surface=app") ? "app" : "web"
  const deviceSupportUrl =
    resolvedRecoverySurface === "app"
      ? "/support?category=device&surface=app"
      : "/support?category=device"

  const loadDevices = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const response = await fetch("/api/security/devices", {
        credentials: "include",
        cache: "no-store",
      })
      const payload = (await response.json().catch(() => null)) as DeviceResponse | null
      if (!response.ok || !payload?.ok) {
        if (response.status === 429) {
          const waitMs = retryAfterMs(response)
          setPollBackoffUntil(Date.now() + waitMs)
          setError(
            `Cihaz durumunu çok sık kontrol ettik. ${Math.max(1, Math.ceil(waitMs / 1000))} saniye sonra otomatik olarak yeniden deneyeceğiz.`
          )
          return
        }
        if (!quiet) setError("Cihaz listesi şu anda alınamadı. Lütfen tekrar deneyin.")
        return
      }
      setDevices(payload.devices || [])
      setPendingApprovals(payload.pendingApprovals || [])
      setReplacementPolicy(payload.replacementPolicy || null)
      setMode(payload.mode || "active_session")
      setMaxDevices(payload.maxDevices || 3)
      setPollBackoffUntil(0)
      setHasSuccessfulLoad(true)
      setError("")
    } catch {
      if (!quiet) setError("Cihaz listesi şu anda alınamadı. Lütfen tekrar deneyin.")
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDevices()
  }, [loadDevices])

  const approvalPollingRequired =
    pendingApprovals.some((approval) => !approval.status || approval.status === "pending") ||
    Boolean(approvalRequired && !hasSuccessfulLoad)
  useEffect(() => {
    if (!approvalPollingRequired && pollBackoffUntil <= 0) return
    let cancelled = false
    let timer: number | undefined
    const schedule = () => {
      const delay = Math.max(12_000, pollBackoffUntil - Date.now())
      timer = window.setTimeout(async () => {
        await loadDevices(true)
        if (!cancelled) schedule()
      }, delay)
    }
    schedule()
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [approvalPollingRequired, loadDevices, pollBackoffUntil])

  useEffect(() => {
    if (mode !== "active_session" || cryptoUpgradeAttempted.current) return
    const currentLegacyDevice = devices.find(
      (device) =>
        device.isCurrent &&
        (device.verificationMethod === "legacy_transition" ||
          device.verificationMethod === "legacy_session")
    )
    if (!currentLegacyDevice) return
    cryptoUpgradeAttempted.current = true

    void (async () => {
      try {
        const proof = await createBrowserDeviceProof()
        if (proof.identityVersion !== "p256-v1") return
        const response = await fetch("/api/security/session/register", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json", "x-dna-request": "same-origin" },
          body: JSON.stringify(proof),
        })
        const payload = await response.json().catch(() => null)
        if (response.ok && payload?.ok && payload.status === "active") {
          setMessage("Bu cihaz güvenli tarayıcı anahtarına yükseltildi.")
          await loadDevices(true)
        }
      } catch {
        // The legacy session stays usable during its transition window. A
        // failed background upgrade must not interrupt the current visit.
      }
    })()
  }, [devices, loadDevices, mode])

  const currentApproved = pendingApprovals.some(
    (approval) => approval.isCurrent && approval.status === "approved"
  )
  useEffect(() => {
    if (!currentApproved) {
      activationAttempted.current = false
      return
    }
    if (mode === "device_management" && !activationAttempted.current) {
      activationAttempted.current = true
      setMessage("Cihazınız onaylandı. Güvenli oturumu açmak için yeniden giriş yapın.")
      window.location.assign(approvedLoginUrl)
    }
  }, [approvedLoginUrl, currentApproved, mode])

  const postAction = async (body: Record<string, unknown>) => {
    const path = "/api/security/devices"
    const serializedBody = JSON.stringify(body)
    const possessionHeaders = await createDevicePossessionHeaders({
      path,
      body: serializedBody,
    })
    const response = await fetch("/api/security/devices", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        "x-dna-request": "same-origin",
        ...possessionHeaders,
      },
      body: serializedBody,
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.ok) {
      const waitSeconds =
        response.status === 429 ? Math.max(1, Math.ceil(retryAfterMs(response) / 1000)) : null
      throw new DeviceActionRequestError(
        payload?.error || "device_action_failed",
        response.status,
        waitSeconds
      )
    }
    return payload
  }

  const saveDeviceName = async (deviceId: string) => {
    const displayName = renameValue.trim()
    if (displayName.length < 2 || displayName.length > 60) {
      setError("Cihaz adı 2–60 karakter arasında olmalı.")
      return
    }
    setWorkingKey(`rename-${deviceId}`)
    setError("")
    try {
      await postAction({ action: "rename", deviceId, displayName })
      setRenamingId("")
      setMessage("Cihaz adı güncellendi.")
      await loadDevices(true)
    } catch (actionError) {
      setError(
        deviceActionRateLimitMessage(actionError) ||
          "Cihaz adı güncellenemedi. Lütfen tekrar deneyin."
      )
    } finally {
      setWorkingKey("")
    }
  }

  const removeDevice = async (device: DeviceRow, reason: "removed" | "not_mine") => {
    const baseWarning = device.isCurrent
      ? "Kullandığınız cihaz kaldırılacak ve bu cihazdan çıkış yapılacak. Devam edilsin mi?"
      : reason === "not_mine"
        ? "Bu cihaz size ait değilse güvenlik için hesabınızdaki bütün oturumlar ve video erişimleri kapatılacak; hesap incelemeye alınacak. Devam edilsin mi?"
        : "Bu cihazı hesabınızdan kaldırmak istediğinize emin misiniz?"
    const replacementWarning =
      reason === "removed" && remainingReplacements === 0
        ? "\n\nÖnemli: Bu dönemde cihaz değiştirme hakkınız kalmadı. Cihazı yine kaldırabilirsiniz; fakat yeni bir cihaz eklemek için cihaz desteği gerekir."
        : ""
    const warning = `${baseWarning}${replacementWarning}`
    if (!window.confirm(warning)) return

    setWorkingKey(`remove-${device.id}`)
    setError("")
    try {
      const result = await postAction({ action: "revoke", deviceId: device.id, reason })
      if (result?.accountLocked) {
        setMessage("Hesabınız güvenlik için kilitlendi ve bütün cihazlardan çıkış yapıldı. Destek ekibi inceleme sonrası yeniden açabilir.")
        try {
          await logoutAppSession("global")
        } catch {
          // The server has already suspended the account and revoked its
          // sessions. logoutAppSession still clears local auth in `finally`;
          // an expected 401 must not replace the suspension result.
        }
        window.location.assign("/login?error=account_suspended")
        return
      }
      if (device.isCurrent) {
        await logoutAppSession("local")
        window.location.assign("/login")
        return
      }
      setMessage(reason === "not_mine" ? "Tanımadığınız cihaz kaldırıldı ve erişimi kapatıldı." : "Cihaz kaldırıldı.")
      await loadDevices(true)
    } catch (actionError) {
      setError(
        deviceActionRateLimitMessage(actionError) ||
          "Cihaz kaldırılamadı. Lütfen tekrar deneyin."
      )
    } finally {
      setWorkingKey("")
    }
  }

  const resolveApproval = async (approval: PendingApproval, action: "approve" | "reject") => {
    const challengeId = approval.challengeId || approval.id
    const code = (approvalCodes[challengeId] || "").trim()
    if (action === "approve" && !/^\d{6}$/.test(code)) {
      setError("Yeni cihazda görünen 6 haneli onay kodunu girin.")
      return
    }
    if (approvalInFlightChallenges.current.has(challengeId)) return

    approvalInFlightChallenges.current.add(challengeId)
    setWorkingKey(`${action}-${challengeId}`)
    setError("")
    try {
      await postAction({ action, challengeId, ...(action === "approve" ? { code } : {}) })
      setApprovalCodes((current) => ({ ...current, [challengeId]: "" }))
      setMessage(action === "approve" ? "Yeni cihaz onaylandı." : "Cihaz isteği reddedildi.")
      await loadDevices(true)
    } catch (actionError) {
      const reason = actionError instanceof Error ? actionError.message : ""
      const rateLimitMessage = deviceActionRateLimitMessage(actionError)
      setError(
        rateLimitMessage ||
          (reason === "verification_code_invalid" || reason === "invalid_code" || reason === "attempts_exhausted"
            ? "Onay kodu hatalı veya süresi dolmuş. Yeni cihazdaki kodu kontrol edin."
            : "Onay isteği tamamlanamadı. Lütfen tekrar deneyin.")
      )
    } finally {
      approvalInFlightChallenges.current.delete(challengeId)
      setWorkingKey("")
    }
  }

  const signOut = async (scope: "local" | "global") => {
    const confirmed =
      scope === "local" ||
      window.confirm("Bütün cihazlardaki açık oturumlar kapatılacak. Devam edilsin mi?")
    if (!confirmed) return

    setWorkingKey(`logout-${scope}`)
    try {
      await logoutAppSession(scope)
      window.location.assign("/login")
    } catch {
      setError("Çıkış işlemi tamamlanamadı. Lütfen tekrar deneyin.")
      setWorkingKey("")
    }
  }

  const activeDevices = devices.filter(
    (device) => !device.revokedAt && device.verificationStatus !== "pending"
  )
  const revokedDevices = devices.filter((device) => device.revokedAt)
  const remainingReplacements = replacementPolicy?.remaining ?? 2
  const replacementWindowDays = replacementPolicy?.windowDays ?? 30
  const currentManagementApproval = pendingApprovals.find((approval) => approval.isCurrent)
  const currentApprovalPending = Boolean(
    currentManagementApproval &&
      (!currentManagementApproval.status || currentManagementApproval.status === "pending")
  )
  const showPrivateDeviceInventory =
    mode === "active_session" && !recoveryReason && !approvalRequired
  const recovery = recoveryReason ? recoveryContent[recoveryReason] : null
  const managementRequestMissing =
    mode === "device_management" &&
    !loading &&
    !error &&
    !recovery &&
    pendingApprovals.length === 0
  const canRetryLogin =
    recoveryReason === "device_limit_exceeded" ||
    Boolean(
      mode === "device_management" &&
        !currentApprovalPending &&
        (currentManagementApproval || managementRequestMissing)
    )

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6" aria-labelledby="devices-title">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-blue-600">Cihazlarım</div>
          <h2 id="devices-title" className="mt-2 text-2xl font-bold text-slate-900">
            Güvenilir cihazlar
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Hesabınıza türü fark etmeksizin en fazla {maxDevices} cihaz bağlayabilirsiniz. Üçü de eğitimleri izleyebilir; aynı anda yalnızca bir eğitim videosu oynatılır.
          </p>
        </div>

        {canRetryLogin ? (
          <button
            type="button"
            onClick={() => window.location.assign(retryLoginUrl)}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Yeniden giriş yap
          </button>
        ) : null}
      </div>

      {recovery ? (
        <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-950">
          <div className="font-semibold">{recovery.title}</div>
          <p className="mt-1">{recovery.description}</p>
          <p className="mt-2 font-medium">{recovery.nextStep}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={deviceSupportUrl}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-violet-300 bg-white px-4 text-sm font-semibold text-violet-950 hover:bg-violet-100"
            >
              Cihaz desteği iste
            </a>
            {recoveryReason === "device_limit_exceeded" ? (
              <button
                type="button"
                onClick={() => window.location.assign(retryLoginUrl)}
                className="h-10 rounded-xl bg-violet-900 px-4 text-sm font-semibold text-white hover:bg-violet-800"
              >
                Cihazı kaldırdım, tekrar dene
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {managementRequestMissing ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <div className="font-semibold">Cihaz onay isteği artık görünmüyor</div>
          <p className="mt-1">
            Kodun süresi dolmuş veya istek tamamlanmış olabilir. Yeni bir kod oluşturmak için yeniden giriş yapın; sorun sürerse cihaz desteği isteyin.
          </p>
          <a className="mt-3 inline-flex font-semibold underline" href={deviceSupportUrl}>
            Cihaz desteğine git
          </a>
        </div>
      ) : null}

      {showPrivateDeviceInventory ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <span className="font-semibold">Aktif cihaz:</span> {activeDevices.length}/{maxDevices}
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <span className="font-semibold">Değiştirme hakkı:</span> {remainingReplacements} / {replacementPolicy?.limit ?? 2} · {replacementWindowDays} gün
          </div>
        </div>
      ) : null}

      {message ? (
        <div className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900" role="status">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900" role="alert">
          {error}
        </div>
      ) : null}

      {pendingApprovals.length ? (
        <div className="mt-6">
          <h3 className="text-base font-semibold text-slate-900">Bekleyen cihaz onayları</h3>
          <div className="mt-3 space-y-3">
            {pendingApprovals.map((approval) => {
              const challengeId = approval.challengeId || approval.id
              const pending = !approval.status || approval.status === "pending"
              const approvalBusy =
                approvalInFlightChallenges.current.has(challengeId) ||
                workingKey === `approve-${challengeId}` ||
                workingKey === `reject-${challengeId}`
              return (
                <div
                  key={challengeId}
                  className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
                  aria-busy={approvalBusy}
                >
                  <div className="font-semibold text-amber-950">
                    {approval.displayName || deviceTypeLabel(approval.deviceType)}
                    {approval.isCurrent ? " · Bu cihaz" : ""}
                  </div>
                  <div className="mt-1 text-sm text-amber-900">
                    İstek: {formatDate(approval.requestedAt)} · Son geçerlilik: {formatDate(approval.expiresAt)}
                  </div>

                  {approval.verificationCode ? (
                    <div className="mt-3 rounded-xl border border-amber-300 bg-white px-4 py-4">
                      <div className="text-center text-sm font-bold text-amber-950">
                        Bu kodu bu ekrana yazmayın
                      </div>
                      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-700">
                        <li>Daha önce kullandığınız güvenilir cihazı açın.</li>
                        <li>Aynı hesapta Ayarlar → Cihazlarım → Bekleyen cihaz onayları bölümüne gidin.</li>
                        <li>Aşağıdaki kodu oradaki “Yeni cihazda görünen 6 haneli kod” alanına yazın.</li>
                      </ol>
                      <div className="mt-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Yeni cihaz kodu</div>
                      <div className="mt-1 font-mono text-2xl font-bold tracking-[0.3em] text-slate-950">
                        {approval.verificationCode}
                      </div>
                      <div className="mt-3 text-center text-xs leading-5 text-slate-600">
                        Eski güvenilir cihaza erişemiyorsanız cihaz desteğini kullanın.
                      </div>
                    </div>
                  ) : pending && mode === "active_session" ? (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <label className="min-w-0 flex-1 text-sm font-semibold text-amber-950">
                        Yeni cihazda görünen 6 haneli kodu buraya yazın
                        <input
                          value={approvalCodes[challengeId] || ""}
                          onChange={(event) =>
                            setApprovalCodes((current) => ({
                              ...current,
                              [challengeId]: event.target.value.replace(/\D/g, "").slice(0, 6),
                            }))
                          }
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="6 haneli kod"
                          disabled={approvalBusy}
                          className="mt-2 h-10 w-full rounded-xl border border-amber-300 bg-white px-3 font-mono tracking-widest outline-none focus:border-blue-500"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void resolveApproval(approval, "approve")}
                        disabled={approvalBusy}
                        className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        Onayla
                      </button>
                      <button
                        type="button"
                        onClick={() => void resolveApproval(approval, "reject")}
                        disabled={approvalBusy}
                        className="h-10 rounded-xl border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-950 disabled:opacity-60"
                      >
                        Reddet
                      </button>
                    </div>
                  ) : pending ? (
                    <div className="mt-3 text-sm font-semibold text-amber-950">
                      Güvenilir cihazdan onay bekleniyor.
                    </div>
                  ) : (
                    <div className="mt-3 text-sm font-semibold text-amber-950">
                      Durum: {approval.status === "approved" ? "Onaylandı" : approval.status === "rejected" ? "Reddedildi" : "Süresi doldu"}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {showPrivateDeviceInventory ? (
        <div className="mt-6">
          <h3 className="text-base font-semibold text-slate-900">Aktif cihazlar</h3>
          {loading ? (
            <div className="mt-3 rounded-2xl border border-slate-200 p-4 text-sm text-slate-500">Cihazlar yükleniyor...</div>
          ) : activeDevices.length ? (
            <div className="mt-3 space-y-3">
              {activeDevices.map((device) => {
              const isRenaming = renamingId === device.id
              return (
                <article key={device.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-slate-900">{deviceName(device)}</h4>
                        {device.isCurrent ? (
                          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">Bu cihaz</span>
                        ) : null}
                        {device.isVerified || device.verificationStatus === "trusted" || device.verificationStatus === "verified" ? (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">Güvenilir</span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Geçiş cihazı</span>
                        )}
                      </div>
                      <div className="mt-2 text-sm text-slate-600">
                        {deviceTypeLabel(device.deviceType)} · {browserLabel(device.userAgent)} · {deviceLocation(device)}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">Son kullanım: {formatDate(device.lastSeenAt)}</div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingId(device.id)
                          setRenameValue(deviceName(device))
                          setError("")
                        }}
                        className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Adını değiştir
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeDevice(device, "removed")}
                        disabled={workingKey === `remove-${device.id}`}
                        className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Kaldır
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeDevice(device, "not_mine")}
                        disabled={workingKey === `remove-${device.id}`}
                        className="h-10 rounded-xl border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-60"
                      >
                        Bu cihaz bana ait değil
                      </button>
                    </div>
                  </div>

                  {isRenaming ? (
                    <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row">
                      <label className="min-w-0 flex-1">
                        <span className="sr-only">Yeni cihaz adı</span>
                        <input
                          value={renameValue}
                          onChange={(event) => setRenameValue(event.target.value.slice(0, 60))}
                          maxLength={60}
                          autoFocus
                          className="h-10 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-blue-500"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void saveDeviceName(device.id)}
                        disabled={workingKey === `rename-${device.id}`}
                        className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        Kaydet
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingId("")}
                        className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700"
                      >
                        Vazgeç
                      </button>
                    </div>
                  ) : null}
                </article>
              )
              })}
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-slate-200 p-4 text-sm text-slate-500">Aktif cihaz bulunamadı.</div>
          )}
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row">
        {mode === "active_session" ? (
          <button
            type="button"
            onClick={() => void signOut("local")}
            disabled={workingKey === "logout-local"}
            className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Bu cihazdan çıkış yap
          </button>
        ) : (
          <button
            type="button"
            onClick={() => window.location.assign(returnLoginUrl)}
            className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Giriş ekranına dön
          </button>
        )}
        {mode === "active_session" ? (
          <button
            type="button"
            onClick={() => void signOut("global")}
            disabled={workingKey === "logout-global"}
            className="h-11 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-60"
          >
            Tüm cihazlardan çıkış yap
          </button>
        ) : null}
      </div>

      {showPrivateDeviceInventory && revokedDevices.length ? (
        <details className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">Kaldırılmış cihaz geçmişi</summary>
          <div className="mt-4 space-y-2">
            {revokedDevices.map((device) => (
              <div key={device.id} className="flex flex-col gap-1 rounded-xl bg-white px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium text-slate-700">{deviceName(device)}</span>
                <span className="text-slate-500">Kaldırıldı: {formatDate(device.revokedAt)}</span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  )
}

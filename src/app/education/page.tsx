"use client"

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import { GraduationCap, Lock, PlayCircle, RefreshCw, ShieldCheck } from "lucide-react"

type EducationVideoItem = {
  id: string
  slug: string
  title: string | null
  requiredPlan: string | null
  provider: string
  providerStatus: string
  playbackPolicy: string
}

type EducationVideoAccessResponse = {
  ok: boolean
  error?: string
  video?: {
    id: string
    slug: string
    title: string | null
  }
  access?: {
    token: string
    tokenExpiresAt: string
    provider: string
    playbackToken: string | null
    playbackUrl: string | null
    embedUrl: string | null
    expiresAt: string
    playerConfig: {
      mode: "native" | "iframe"
      heartbeatIntervalSeconds: number
      watermarkRefreshSeconds: number
      playbackPolicy: string
      providerStatus: string
      allowFullscreen: boolean
    }
    signedUrl: string | null
    signedUrlTtlSeconds: number | null
  }
  watermark?: {
    code: string
    displayText: string
    qrPayload: string
    refreshSeconds: number
    positionSeed: string
  }
}

type EducationVideoCreateResponse = {
  ok: boolean
  error?: string
  item?: EducationVideoItem
}

type EducationVideoFormState = {
  title: string
  slug: string
  requiredPlan: string
  provider: "supabase" | "bunny"
  providerStatus: "draft" | "processing" | "ready" | "failed"
  playbackPolicy: "signed_url" | "signed_embed" | "signed_hls"
  storageBucket: string
  storagePath: string
  hlsManifestPath: string
  providerAssetId: string
  providerLibraryId: string
  isActive: boolean
}

const WATERMARK_POSITIONS = [
  "top-3 left-3",
  "top-3 right-3",
  "bottom-3 left-3",
  "bottom-3 right-3",
  "top-1/2 left-4 -translate-y-1/2",
  "top-1/2 right-4 -translate-y-1/2",
]

function formatPlan(value?: string | null) {
  if (!value) return "Tüm eğitim erişimi"
  if (value === "student") return "Öğrenci paketi"
  if (value === "graduate") return "Mezun paketi"
  if (value === "professional") return "Profesyonel paket"
  if (value === "enterprise") return "Kurumsal paket"
  return value
}

function formatStatus(value: string) {
  if (value === "ready") return "Hazır"
  if (value === "processing") return "İşleniyor"
  if (value === "failed") return "Hata"
  return "Taslak"
}

function pickWatermarkPosition(seed: string, step: number) {
  let total = 0
  for (const char of seed) total += char.charCodeAt(0)
  return WATERMARK_POSITIONS[(total + step) % WATERMARK_POSITIONS.length] || WATERMARK_POSITIONS[0]
}

function makePlayerSessionId(videoId: string) {
  return `player_${videoId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function buildInitialFormState(): EducationVideoFormState {
  return {
    title: "",
    slug: "",
    requiredPlan: "",
    provider: "supabase",
    providerStatus: "draft",
    playbackPolicy: "signed_url",
    storageBucket: "education-videos",
    storagePath: "",
    hlsManifestPath: "",
    providerAssetId: "",
    providerLibraryId: "",
    isActive: true,
  }
}

function formatCreateError(error?: string) {
  switch (error) {
    case "video_manage_forbidden":
      return "Bu işlem yalnız owner/admin hesabı ile yapılabilir."
    case "video_setup_required":
      return "Video tabloları henüz veritabanında kurulmamış."
    case "video_slug_conflict":
      return "Bu slug zaten kullanılıyor."
    case "video_storage_path_required":
      return "Supabase video için storage path veya HLS manifest path gerekli."
    case "video_provider_ids_required":
      return "Bunny video için library id ve asset id gerekli."
    case "storage_path_invalid":
      return "Video yolu geçersiz görünüyor."
    default:
      return "Eğitim kaydı oluşturulamadı."
  }
}

export default function EducationPage() {
  const [items, setItems] = useState<EducationVideoItem[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [loadingList, setLoadingList] = useState(true)
  const [listError, setListError] = useState("")
  const [setupRequired, setSetupRequired] = useState(false)
  const [canManage, setCanManage] = useState(false)

  const [accessLoading, setAccessLoading] = useState(false)
  const [accessError, setAccessError] = useState("")
  const [accessData, setAccessData] = useState<EducationVideoAccessResponse | null>(null)
  const [watermarkStep, setWatermarkStep] = useState(0)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState("")
  const [createSuccess, setCreateSuccess] = useState("")
  const [form, setForm] = useState<EducationVideoFormState>(() => buildInitialFormState())

  const nativeVideoRef = useRef<HTMLVideoElement | null>(null)
  const heartbeatRef = useRef<number | null>(null)
  const playerSessionIdRef = useRef("")

  useEffect(() => {
    let mounted = true

    async function loadList() {
      setLoadingList(true)
      setListError("")

      try {
        const response = await fetch("/api/education/videos", { cache: "no-store" })
        const json = (await response.json()) as {
          ok: boolean
          error?: string
          items?: EducationVideoItem[]
          setupRequired?: boolean
          canManage?: boolean
        }

        if (!mounted) return

        if (!response.ok || !json.ok) {
          setListError(json.error || "Eğitim listesi alınamadı.")
          setItems([])
          setLoadingList(false)
          return
        }

        const nextItems = json.items || []
        setItems(nextItems)
        setSelectedId((current) => current || nextItems[0]?.id || "")
        setSetupRequired(Boolean(json.setupRequired))
        setCanManage(Boolean(json.canManage))
        setLoadingList(false)
      } catch {
        if (!mounted) return
        setListError("Eğitim listesi alınamadı.")
        setLoadingList(false)
      }
    }

    loadList()
    return () => {
      mounted = false
    }
  }, [])

  const selected = useMemo(() => items.find((item) => item.id === selectedId) || null, [items, selectedId])

  const postPlaybackEvent = useEffectEvent(
    async (eventType: string, extra: Record<string, unknown> = {}) => {
      if (!selected || !accessData?.access?.token || !playerSessionIdRef.current) return

      try {
        await fetch(`/api/education/videos/${encodeURIComponent(selected.id)}/events`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-selfmeta-request": "same-origin",
          },
          body: JSON.stringify({
            eventType,
            accessToken: accessData.access.token,
            playerSessionId: playerSessionIdRef.current,
            visibleWatermarkCode: accessData.watermark?.code || null,
            ...extra,
          }),
        })
      } catch {}
    }
  )

  const stopHeartbeat = useEffectEvent(() => {
    if (heartbeatRef.current) {
      window.clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
  })

  const startHeartbeat = useEffectEvent(() => {
    stopHeartbeat()
    const intervalSeconds = accessData?.access?.playerConfig?.heartbeatIntervalSeconds || 25
    heartbeatRef.current = window.setInterval(() => {
      const video = nativeVideoRef.current
      void postPlaybackEvent("heartbeat", {
        playbackSeconds: video?.currentTime || 0,
        durationSeconds: video?.duration || null,
      })
    }, intervalSeconds * 1000)
  })

  async function openVideo(item: EducationVideoItem) {
    setSelectedId(item.id)
    setAccessLoading(true)
    setAccessError("")
    stopHeartbeat()

    try {
      const response = await fetch(`/api/education/videos/${encodeURIComponent(item.id)}/access`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-selfmeta-request": "same-origin",
        },
        body: JSON.stringify({}),
      })

      const json = (await response.json()) as EducationVideoAccessResponse

      if (!response.ok || !json.ok) {
        setAccessData(null)
        setAccessError(json.error || "Video erişimi alınamadı.")
        setAccessLoading(false)
        return
      }

      playerSessionIdRef.current = makePlayerSessionId(item.id)
      setAccessData(json)
      setWatermarkStep(0)
      setAccessLoading(false)
    } catch {
      setAccessData(null)
      setAccessError("Video erişimi alınamadı.")
      setAccessLoading(false)
    }
  }

  useEffect(() => {
    if (!accessData?.watermark?.positionSeed) return
    const refreshSeconds = accessData.watermark.refreshSeconds || 45
    const timer = window.setInterval(() => {
      setWatermarkStep((current) => current + 1)
    }, refreshSeconds * 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [accessData?.watermark?.positionSeed, accessData?.watermark?.refreshSeconds])

  useEffect(() => {
    if (!accessData?.access || !selected) return
    void postPlaybackEvent("player_loaded")

    if (accessData.access.playerConfig.mode === "iframe") {
      void postPlaybackEvent("play")
      void postPlaybackEvent("watermark_rendered")
      startHeartbeat()
    }

    return () => {
      void postPlaybackEvent("complete")
      stopHeartbeat()
    }
  }, [accessData?.access, selected, postPlaybackEvent, startHeartbeat, stopHeartbeat])

  useEffect(() => {
    return () => {
      stopHeartbeat()
    }
  }, [stopHeartbeat])

  const watermarkPosition = accessData?.watermark
    ? pickWatermarkPosition(accessData.watermark.positionSeed, watermarkStep)
    : WATERMARK_POSITIONS[0]
  const activeAccess = accessData?.access || null

  async function createVideoRecord() {
    setCreateLoading(true)
    setCreateError("")
    setCreateSuccess("")

    try {
      const response = await fetch("/api/education/videos", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-selfmeta-request": "same-origin",
        },
        body: JSON.stringify(form),
      })

      const json = (await response.json()) as EducationVideoCreateResponse
      if (!response.ok || !json.ok || !json.item) {
        setCreateError(formatCreateError(json.error))
        setCreateLoading(false)
        return
      }

      const createdItem = json.item
      setItems((current) => [createdItem, ...current.filter((item) => item.id !== createdItem.id)])
      setSelectedId(createdItem.id)
      setCreateSuccess("Eğitim kaydı eklendi. Artık bu başlık listede görünecek.")
      setForm(buildInitialFormState())
      setCreateLoading(false)
    } catch {
      setCreateError("Eğitim kaydı oluşturulamadı.")
      setCreateLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
              <GraduationCap className="h-4 w-4" />
              Eğitim Kütüphanesi
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">Terapist eğitim kayıtları</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Yayına alınan eğitim kayıtları burada listelenir. Erişim hakkınız varsa güvenli oynatma bağlantısı
              oluşturulur; izleme oturumu, watermark ve güvenlik logları aynı akışta çalışır.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (selected) void openVideo(selected)
            }}
            disabled={!selected || accessLoading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#06133d] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0a1d5c] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${accessLoading ? "animate-spin" : ""}`} />
            Erişimi yenile
          </button>
        </div>
      </div>

      {canManage && (
        <section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Eğitim kaydı ekle</h2>
              <p className="mt-1 text-sm text-slate-600">
                Dosyayı storage veya Bunny tarafına koyduktan sonra burada başlık ve erişim bilgisini kaydedin.
              </p>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              Owner/Admin
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Başlık</span>
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-300"
                placeholder="Ör. Regülasyon Temelleri - 1"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Slug</span>
              <input
                value={form.slug}
                onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-300"
                placeholder="regulasyon-temelleri-1"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Gerekli Paket</span>
              <select
                value={form.requiredPlan}
                onChange={(event) => setForm((current) => ({ ...current, requiredPlan: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-300"
              >
                <option value="">Tüm eğitim erişimi</option>
                <option value="student">Öğrenci</option>
                <option value="graduate">Mezun</option>
                <option value="professional">Profesyonel</option>
                <option value="enterprise">Kurumsal</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Provider</span>
              <select
                value={form.provider}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    provider: event.target.value as "supabase" | "bunny",
                    playbackPolicy: event.target.value === "bunny" ? "signed_embed" : "signed_url",
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-300"
              >
                <option value="supabase">Supabase Storage</option>
                <option value="bunny">Bunny Stream</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Durum</span>
              <select
                value={form.providerStatus}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    providerStatus: event.target.value as EducationVideoFormState["providerStatus"],
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-300"
              >
                <option value="draft">Taslak</option>
                <option value="processing">İşleniyor</option>
                <option value="ready">Hazır</option>
                <option value="failed">Hata</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Playback</span>
              <select
                value={form.playbackPolicy}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    playbackPolicy: event.target.value as EducationVideoFormState["playbackPolicy"],
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-300"
              >
                <option value="signed_url">Signed URL</option>
                <option value="signed_embed">Signed Embed</option>
                <option value="signed_hls">Signed HLS</option>
              </select>
            </label>

            {form.provider === "supabase" ? (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Bucket</span>
                  <input
                    value={form.storageBucket}
                    onChange={(event) => setForm((current) => ({ ...current, storageBucket: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-300"
                    placeholder="education-videos"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Video Path</span>
                  <input
                    value={form.storagePath}
                    onChange={(event) => setForm((current) => ({ ...current, storagePath: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-300"
                    placeholder="therapist-egitimleri/modul-1.mp4"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">HLS Manifest Path</span>
                  <input
                    value={form.hlsManifestPath}
                    onChange={(event) => setForm((current) => ({ ...current, hlsManifestPath: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-300"
                    placeholder="therapist-egitimleri/modul-1/playlist.m3u8"
                  />
                </label>
              </>
            ) : (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Bunny Library ID</span>
                  <input
                    value={form.providerLibraryId}
                    onChange={(event) => setForm((current) => ({ ...current, providerLibraryId: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-300"
                    placeholder="library-id"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Bunny Asset ID</span>
                  <input
                    value={form.providerAssetId}
                    onChange={(event) => setForm((current) => ({ ...current, providerAssetId: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-300"
                    placeholder="video-id"
                  />
                </label>
              </>
            )}
          </div>

          <label className="mt-4 inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
              className="h-4 w-4 rounded border-slate-300"
            />
            Yayında aktif olsun
          </label>

          {createError && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{createError}</div>
          )}
          {createSuccess && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{createSuccess}</div>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => void createVideoRecord()}
              disabled={createLoading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#06133d] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0a1d5c] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${createLoading ? "animate-spin" : ""}`} />
              Kaydı ekle
            </button>
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <PlayCircle className="h-4 w-4 text-blue-600" />
            Eğitim başlıkları
          </div>

          {loadingList && <p className="text-sm text-slate-500">Liste yükleniyor...</p>}
          {!loadingList && listError && <p className="text-sm text-rose-600">{listError}</p>}
          {!loadingList && !listError && setupRequired && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Eğitim video tabloları henüz veritabanında aktif değil. SQL uygulandığında kayıtlar burada listelenecek.
            </div>
          )}
          {!loadingList && !listError && !setupRequired && items.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Henüz yayınlanmış eğitim kaydı bulunmuyor.
            </div>
          )}

          <div className="space-y-3">
            {items.map((item) => {
              const active = item.id === selectedId
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void openVideo(item)}
                  className={[
                    "w-full rounded-[22px] border p-4 text-left transition",
                    active
                      ? "border-blue-200 bg-blue-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-slate-900">{item.title || item.slug}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-500">{formatPlan(item.requiredPlan)}</div>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      {formatStatus(item.providerStatus)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1">{item.provider}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1">{item.playbackPolicy}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          {!selected && <p className="text-sm text-slate-500">Soldan bir eğitim seçin.</p>}

          {selected && (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">{selected.title || selected.slug}</h2>
                  <p className="mt-1 text-sm text-slate-500">Güvenli oynatma, watermark ve erişim kaydı bu panelden yönetilir.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <ShieldCheck className="h-4 w-4" />
                  {formatPlan(selected.requiredPlan)}
                </div>
              </div>

              {accessError && (
                <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  {accessError}
                </div>
              )}

              {!accessData && !accessLoading && !accessError && (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-600">
                  İzlemek için başlığı seçin. Erişim hakkınız doğrulanınca video oynatma bağlantısı oluşturulur.
                </div>
              )}

              {accessLoading && (
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-8 text-sm text-slate-600">
                  Güvenli oynatma bağlantısı hazırlanıyor...
                </div>
              )}

              {accessData && activeAccess && (
                <>
                  <div className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-[#06133d]">
                    <div className="relative aspect-video w-full">
                      {activeAccess.playerConfig.mode === "iframe" && activeAccess.embedUrl ? (
                        <iframe
                          src={activeAccess.embedUrl}
                          className="absolute inset-0 h-full w-full border-0"
                          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen;"
                          allowFullScreen
                          onLoad={() => {
                            void postPlaybackEvent("watermark_rendered")
                          }}
                        />
                      ) : activeAccess.playbackUrl ? (
                        <video
                          ref={nativeVideoRef}
                          src={activeAccess.playbackUrl}
                          controls
                          playsInline
                          className="absolute inset-0 h-full w-full bg-black object-contain"
                          onLoadedData={() => {
                            void postPlaybackEvent("watermark_rendered")
                          }}
                          onPlay={() => {
                            void postPlaybackEvent("play", {
                              playbackSeconds: nativeVideoRef.current?.currentTime || 0,
                              durationSeconds: nativeVideoRef.current?.duration || null,
                            })
                            startHeartbeat()
                          }}
                          onPause={() => {
                            void postPlaybackEvent("pause", {
                              playbackSeconds: nativeVideoRef.current?.currentTime || 0,
                              durationSeconds: nativeVideoRef.current?.duration || null,
                            })
                            stopHeartbeat()
                          }}
                          onEnded={() => {
                            void postPlaybackEvent("complete", {
                              playbackSeconds: nativeVideoRef.current?.currentTime || 0,
                              durationSeconds: nativeVideoRef.current?.duration || null,
                            })
                            stopHeartbeat()
                          }}
                          onError={() => {
                            void postPlaybackEvent("error")
                            stopHeartbeat()
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 grid place-items-center text-sm text-white/80">
                          Oynatma bağlantısı bulunamadı.
                        </div>
                      )}

                      {accessData.watermark && (
                        <div
                          className={[
                            "pointer-events-none absolute z-10 max-w-[40%] rounded-xl border border-white/20 bg-black/45 px-3 py-2 text-[11px] font-medium tracking-[0.08em] text-white backdrop-blur-sm transition-all duration-700",
                            watermarkPosition,
                          ].join(" ")}
                        >
                          <div>{accessData.watermark.displayText}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Provider</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">{activeAccess.provider}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Erişim Bitişi</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">
                        {new Date(activeAccess.expiresAt).toLocaleString("tr-TR")}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Oynatma Politikası</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">{activeAccess.playerConfig.playbackPolicy}</div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                    <div className="flex items-start gap-2">
                      <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>
                        Bu ekran kısa süreli erişim, kullanıcıya özel watermark ve oynatma oturumu kaydı ile çalışır.
                        Aynı hesabın paralel kullanımında erişim bloklanabilir.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}

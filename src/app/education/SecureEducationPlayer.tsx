"use client"

import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Maximize2, Minimize2 } from "lucide-react"
import { createDevicePossessionHeaders } from "@/lib/security/browserDeviceIdentity"
import {
  clampPlaybackResumeTime,
  playbackUrlRefreshDelayMs,
  retryAfterDelayMs,
} from "./playbackUrlRefresh"

export type SecureEducationPlayerAccess = {
  token: string
  leaseId: string
  playerSessionId: string
  provider: string
  playbackUrl: string | null
  embedUrl: string | null
  expiresAt: string
  signedUrlTtlSeconds: number | null
  playerConfig: {
    mode: "native" | "iframe"
    heartbeatIntervalSeconds: number
    playbackPolicy: string
  }
}

export type SecureEducationPlayerWatermark = {
  code: string
  displayText: string
  maskedEmail?: string
  issuedAt?: string
  refreshSeconds: number
  positionSeed: string
}

type SecureEducationPlayerProps = {
  videoId: string
  access: SecureEducationPlayerAccess
  watermark?: SecureEducationPlayerWatermark
  onPlaybackStopped: (message: string) => void
}

type PlaybackSourceState = {
  playbackKey: string
  playbackUrl: string | null
  expiresAt: string | null
}

type PlaybackUrlRefreshResponse = {
  error?: string
  refresh?: {
    playbackUrl?: string
    expiresAt?: string
    signedUrlTtlSeconds?: number
  }
}

type PlaybackUrlRefreshResult =
  | { ok: true }
  | { ok: false; terminal?: boolean; retryAfterMs?: number }

const WATERMARK_POSITIONS = [
  "top-3 left-3",
  "top-3 right-3",
  "bottom-3 left-3",
  "bottom-3 right-3",
  "top-1/2 left-4 -translate-y-1/2",
  "top-1/2 right-4 -translate-y-1/2",
] as const

function pickWatermarkPosition(seed: string, step: number) {
  let total = 0
  for (const char of seed) total += char.charCodeAt(0)
  return WATERMARK_POSITIONS[(total + step) % WATERMARK_POSITIONS.length] || WATERMARK_POSITIONS[0]
}

function visibleWatermarkCode(code: string, step: number) {
  return `${code}-R${String(step + 1).padStart(2, "0")}`
}

export function SecureEducationPlayer({
  videoId,
  access,
  watermark,
  onPlaybackStopped,
}: SecureEducationPlayerProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const heartbeatRef = useRef<number | null>(null)
  const releasedRef = useRef(false)
  const terminalRef = useRef(false)
  const activePlaybackKeyRef = useRef<string | null>(null)
  const urlRefreshInFlightRef = useRef(false)
  const sourceRefreshRef = useRef(false)
  const pendingPlaybackRestoreRef = useRef<{
    playbackKey: string
    currentTime: number
    shouldResume: boolean
  } | null>(null)
  const suppressNextLoadedDataEventRef = useRef(false)
  const suppressNextPlayEventRef = useRef(false)
  const [watermarkStep, setWatermarkStep] = useState(0)
  const [displayTime, setDisplayTime] = useState(() => new Date())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const playbackKey = `${videoId}:${access.leaseId}:${access.playerSessionId}:${access.token}`
  const [playbackSource, setPlaybackSource] = useState<PlaybackSourceState>(() => ({
    playbackKey,
    playbackUrl: access.playbackUrl,
    expiresAt: access.expiresAt,
  }))
  const currentPlaybackSource = playbackSource.playbackKey === playbackKey
    ? playbackSource
    : {
        playbackKey,
        playbackUrl: access.playbackUrl,
        expiresAt: access.expiresAt,
      }

  useLayoutEffect(() => {
    activePlaybackKeyRef.current = playbackKey
    return () => {
      if (activePlaybackKeyRef.current === playbackKey) activePlaybackKeyRef.current = null
    }
  }, [playbackKey])

  const stopHeartbeat = useEffectEvent(() => {
    if (heartbeatRef.current !== null) {
      window.clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
  })

  const notifyPlaybackStopped = useEffectEvent((message: string, requestPlaybackKey: string) => {
    if (activePlaybackKeyRef.current !== requestPlaybackKey) return
    if (terminalRef.current) return
    terminalRef.current = true
    releasedRef.current = true
    stopHeartbeat()
    videoRef.current?.pause()
    onPlaybackStopped(message)
  })

  const currentVisibleCode = watermark
    ? visibleWatermarkCode(watermark.code, watermarkStep)
    : null

  useEffect(() => {
    setPlaybackSource({
      playbackKey,
      playbackUrl: access.playbackUrl,
      expiresAt: access.expiresAt,
    })
    urlRefreshInFlightRef.current = false
    sourceRefreshRef.current = false
    pendingPlaybackRestoreRef.current = null
    suppressNextLoadedDataEventRef.current = false
    suppressNextPlayEventRef.current = false
  }, [access.expiresAt, access.playbackUrl, playbackKey])

  const postEvent = useEffectEvent(
    async (
      eventType: string,
      extra: Record<string, unknown> = {},
      options: {
        keepalive?: boolean
        ignoreTerminalResponse?: boolean
        expectedPlaybackKey?: string
      } = {}
    ) => {
      const requestPlaybackKey = options.expectedPlaybackKey || playbackKey
      if (activePlaybackKeyRef.current !== requestPlaybackKey) return false
      if (releasedRef.current && !["complete", "error", "release"].includes(eventType)) return false

      const requestContext = {
        videoId,
        accessToken: access.token,
        leaseId: access.leaseId,
        playerSessionId: access.playerSessionId,
        visibleWatermarkCode: currentVisibleCode,
      }

      try {
        const path = `/api/education/videos/${encodeURIComponent(requestContext.videoId)}/events`
        const serializedBody = JSON.stringify({
          eventType,
          accessToken: requestContext.accessToken,
          leaseId: requestContext.leaseId,
          playerSessionId: requestContext.playerSessionId,
          visibleWatermarkCode: requestContext.visibleWatermarkCode,
          ...extra,
        })
        const possessionHeaders = eventType === "release"
          ? {}
          : await createDevicePossessionHeaders({ path, body: serializedBody })
        const response = await fetch(path, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-dna-request": "same-origin",
            ...possessionHeaders,
          },
          body: serializedBody,
          keepalive: Boolean(options.keepalive),
        })
        const json = (await response.json().catch(() => null)) as { error?: string } | null
        if (activePlaybackKeyRef.current !== requestPlaybackKey) return false

        if (!response.ok && !options.ignoreTerminalResponse) {
          if (response.status === 409 && json?.error === "playback_lease_lost") {
            notifyPlaybackStopped(
              "Bu eğitim başka bir cihazda devam ettirildi. Buradaki oynatma durduruldu.",
              requestPlaybackKey
            )
          } else if (response.status === 403 && json?.error === "education_network_blocked") {
            notifyPlaybackStopped("Bu ağ üzerinden eğitim videosu oynatılamıyor.", requestPlaybackKey)
          } else if (response.status === 401) {
            notifyPlaybackStopped(
              "Güvenli video erişiminizin süresi doldu. Eğitimi yeniden açın.",
              requestPlaybackKey
            )
          }
          return false
        }

        if (response.ok && ["complete", "error", "release"].includes(eventType)) {
          releasedRef.current = true
        }
        return response.ok
      } catch {
        return false
      }
    }
  )

  const startHeartbeat = useEffectEvent((expectedPlaybackKey: string = playbackKey) => {
    if (activePlaybackKeyRef.current !== expectedPlaybackKey) return
    stopHeartbeat()
    const intervalSeconds = Math.max(10, access.playerConfig.heartbeatIntervalSeconds || 25)
    const intervalId = window.setInterval(() => {
      if (activePlaybackKeyRef.current !== expectedPlaybackKey) {
        window.clearInterval(intervalId)
        if (heartbeatRef.current === intervalId) heartbeatRef.current = null
        return
      }
      const video = videoRef.current
      void postEvent(
        "heartbeat",
        {
          playbackSeconds: video?.currentTime || 0,
          durationSeconds: Number.isFinite(video?.duration) ? video?.duration : null,
        },
        { expectedPlaybackKey }
      )
    }, intervalSeconds * 1000)
    heartbeatRef.current = intervalId
  })

  const refreshPlaybackUrl = useEffectEvent(
    async (requestPlaybackKey: string): Promise<PlaybackUrlRefreshResult> => {
      if (
        activePlaybackKeyRef.current !== requestPlaybackKey ||
        releasedRef.current ||
        terminalRef.current
      ) {
        return { ok: false, terminal: true }
      }
      if (urlRefreshInFlightRef.current) {
        return { ok: false, retryAfterMs: 1_000 }
      }

      urlRefreshInFlightRef.current = true
      try {
        const video = videoRef.current
        const path = `/api/education/videos/${encodeURIComponent(videoId)}/events`
        const serializedBody = JSON.stringify({
          eventType: "refresh_url",
          accessToken: access.token,
          leaseId: access.leaseId,
          playerSessionId: access.playerSessionId,
          visibleWatermarkCode: currentVisibleCode,
          playbackSeconds: video?.currentTime || 0,
          durationSeconds: Number.isFinite(video?.duration) ? video?.duration : null,
        })
        const possessionHeaders = await createDevicePossessionHeaders({
          path,
          body: serializedBody,
        })
        const response = await fetch(path, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-dna-request": "same-origin",
            ...possessionHeaders,
          },
          body: serializedBody,
          cache: "no-store",
        })
        const json = (await response.json().catch(() => null)) as PlaybackUrlRefreshResponse | null

        if (activePlaybackKeyRef.current !== requestPlaybackKey) {
          return { ok: false, terminal: true }
        }

        if (!response.ok) {
          if (response.status === 409 && json?.error === "playback_lease_lost") {
            notifyPlaybackStopped(
              "Bu eğitim başka bir cihazda devam ettirildi. Buradaki oynatma durduruldu.",
              requestPlaybackKey
            )
            return { ok: false, terminal: true }
          }
          if (response.status === 403 && json?.error === "education_network_blocked") {
            notifyPlaybackStopped("Bu ağ üzerinden eğitim videosu oynatılamıyor.", requestPlaybackKey)
            return { ok: false, terminal: true }
          }
          if (response.status === 401) {
            notifyPlaybackStopped(
              "Güvenli video erişiminizin süresi doldu. Eğitimi yeniden açın.",
              requestPlaybackKey
            )
            return { ok: false, terminal: true }
          }
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            notifyPlaybackStopped(
              "Video bağlantısı güvenli biçimde yenilenemedi. Eğitimi yeniden açın.",
              requestPlaybackKey
            )
            return { ok: false, terminal: true }
          }
          return {
            ok: false,
            retryAfterMs: response.status === 429
              ? retryAfterDelayMs(response.headers.get("retry-after"))
              : 5_000,
          }
        }

        const refreshedPlaybackUrl = String(json?.refresh?.playbackUrl || "").trim()
        const refreshedExpiresAt = String(json?.refresh?.expiresAt || "").trim()
        const refreshedTtlSeconds = Number(json?.refresh?.signedUrlTtlSeconds)
        if (
          !refreshedPlaybackUrl ||
          !Number.isFinite(new Date(refreshedExpiresAt).getTime()) ||
          !Number.isFinite(refreshedTtlSeconds) ||
          refreshedTtlSeconds <= 0
        ) {
          return { ok: false, retryAfterMs: 5_000 }
        }

        const currentVideo = videoRef.current
        const shouldResume = Boolean(currentVideo && !currentVideo.paused && !currentVideo.ended)
        pendingPlaybackRestoreRef.current = {
          playbackKey: requestPlaybackKey,
          currentTime: currentVideo?.currentTime || 0,
          shouldResume,
        }
        sourceRefreshRef.current = true
        suppressNextLoadedDataEventRef.current = true
        suppressNextPlayEventRef.current = shouldResume
        setPlaybackSource({
          playbackKey: requestPlaybackKey,
          playbackUrl: refreshedPlaybackUrl,
          expiresAt: refreshedExpiresAt,
        })
        return { ok: true }
      } catch {
        return { ok: false, retryAfterMs: 5_000 }
      } finally {
        urlRefreshInFlightRef.current = false
      }
    }
  )

  const restorePlaybackAfterUrlRefresh = useEffectEvent(() => {
    const pending = pendingPlaybackRestoreRef.current
    const video = videoRef.current
    if (!pending || pending.playbackKey !== playbackKey || !video) return

    video.currentTime = clampPlaybackResumeTime(pending.currentTime, video.duration)
    pendingPlaybackRestoreRef.current = null
    sourceRefreshRef.current = false

    if (pending.shouldResume) {
      void video.play().catch(() => {
        suppressNextPlayEventRef.current = false
      })
    } else {
      suppressNextPlayEventRef.current = false
    }
  })

  useEffect(() => {
    if (
      access.provider !== "supabase" ||
      access.playerConfig.playbackPolicy !== "signed_url" ||
      !currentPlaybackSource.playbackUrl ||
      !access.signedUrlTtlSeconds
    ) {
      return
    }

    const effectPlaybackKey = playbackKey
    let timerId: number | null = null
    let disposed = false

    const clearTimer = () => {
      if (timerId !== null) {
        window.clearTimeout(timerId)
        timerId = null
      }
    }
    const schedule = (delayMs: number) => {
      clearTimer()
      timerId = window.setTimeout(() => {
        timerId = null
        void runRefresh()
      }, Math.max(0, delayMs))
    }
    const runRefresh = async () => {
      if (disposed) return
      const result = await refreshPlaybackUrl(effectPlaybackKey)
      if (disposed || result.ok || result.terminal) return
      schedule(result.retryAfterMs || 5_000)
    }

    const initialDelay = playbackUrlRefreshDelayMs({
      expiresAt: currentPlaybackSource.expiresAt,
      ttlSeconds: access.signedUrlTtlSeconds,
    })
    if (initialDelay !== null) schedule(initialDelay)

    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible") return
      const delay = playbackUrlRefreshDelayMs({
        expiresAt: currentPlaybackSource.expiresAt,
        ttlSeconds: access.signedUrlTtlSeconds,
      })
      if (delay !== null && delay <= 0) {
        clearTimer()
        void runRefresh()
      }
    }

    document.addEventListener("visibilitychange", refreshWhenVisible)
    return () => {
      disposed = true
      clearTimer()
      document.removeEventListener("visibilitychange", refreshWhenVisible)
    }
  }, [
    access.playerConfig.playbackPolicy,
    access.provider,
    access.signedUrlTtlSeconds,
    currentPlaybackSource.expiresAt,
    currentPlaybackSource.playbackUrl,
    playbackKey,
    refreshPlaybackUrl,
  ])

  useEffect(() => {
    releasedRef.current = false
    terminalRef.current = false
    setWatermarkStep(0)
    const initialWatermarkCode = watermark?.code || null
    const effectPlaybackKey = playbackKey
    void postEvent("player_loaded", {}, { expectedPlaybackKey: effectPlaybackKey })

    // A paused video may be intentionally left open while the user takes notes.
    // Keep the lease alive while this mounted player page remains present.
    startHeartbeat(effectPlaybackKey)

    return () => {
      stopHeartbeat()
      if (!releasedRef.current) {
        // Use this effect's captured access values. Effect Events read the latest
        // props, which could otherwise release a newly claimed replacement lease.
        void fetch(`/api/education/videos/${encodeURIComponent(videoId)}/events`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-dna-request": "same-origin",
          },
          body: JSON.stringify({
            eventType: "release",
            accessToken: access.token,
            leaseId: access.leaseId,
            playerSessionId: access.playerSessionId,
            visibleWatermarkCode: initialWatermarkCode,
          }),
          keepalive: true,
        }).catch(() => undefined)
      }
    }
  }, [access, playbackKey, postEvent, startHeartbeat, stopHeartbeat, videoId, watermark?.code])

  useEffect(() => {
    const pagePlaybackKey = playbackKey
    const releaseOnPageHide = () => {
      if (activePlaybackKeyRef.current !== pagePlaybackKey) return
      if (releasedRef.current) return
      releasedRef.current = true
      stopHeartbeat()
      void postEvent(
        "release",
        {},
        {
          keepalive: true,
          ignoreTerminalResponse: true,
          expectedPlaybackKey: pagePlaybackKey,
        }
      )
    }

    window.addEventListener("pagehide", releaseOnPageHide)
    return () => window.removeEventListener("pagehide", releaseOnPageHide)
  }, [playbackKey, postEvent, stopHeartbeat])

  useEffect(() => {
    const timeTimer = window.setInterval(() => setDisplayTime(new Date()), 1000)
    return () => window.clearInterval(timeTimer)
  }, [])

  useEffect(() => {
    if (!watermark?.positionSeed) return
    const refreshSeconds = Math.max(15, watermark.refreshSeconds || 45)
    const watermarkTimer = window.setInterval(() => {
      setWatermarkStep((current) => current + 1)
    }, refreshSeconds * 1000)
    return () => window.clearInterval(watermarkTimer)
  }, [watermark?.positionSeed, watermark?.refreshSeconds])

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(document.fullscreenElement === wrapperRef.current)
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
  }, [])

  const watermarkPosition = useMemo(
    () => pickWatermarkPosition(watermark?.positionSeed || "watermark", watermarkStep),
    [watermark?.positionSeed, watermarkStep]
  )
  const maskedEmail = watermark?.maskedEmail || watermark?.displayText.split("|")[0]?.trim() || "Kullanıcı"
  const watermarkText = currentVisibleCode
    ? `${maskedEmail} | ${currentVisibleCode} | ${displayTime.toLocaleString("tr-TR")}`
    : null

  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }
    await wrapperRef.current?.requestFullscreen()
  }

  return (
    <div
      ref={wrapperRef}
      className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-[#06133d]"
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="relative aspect-video w-full">
        {access.playerConfig.mode === "iframe" && access.embedUrl ? (
          <iframe
            src={access.embedUrl}
            title="Güvenli eğitim videosu"
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; gyroscope; autoplay; encrypted-media"
            onLoad={() => {
              void postEvent("watermark_rendered")
            }}
          />
        ) : currentPlaybackSource.playbackUrl ? (
          <video
            ref={videoRef}
            src={currentPlaybackSource.playbackUrl}
            controls
            controlsList="nodownload nofullscreen noremoteplayback"
            disablePictureInPicture
            disableRemotePlayback
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full bg-black object-contain"
            onLoadedMetadata={() => {
              restorePlaybackAfterUrlRefresh()
            }}
            onLoadedData={() => {
              if (suppressNextLoadedDataEventRef.current) {
                suppressNextLoadedDataEventRef.current = false
                return
              }
              void postEvent("watermark_rendered")
            }}
            onPlay={() => {
              if (suppressNextPlayEventRef.current) {
                suppressNextPlayEventRef.current = false
                startHeartbeat(playbackKey)
                return
              }
              void postEvent("play", {
                playbackSeconds: videoRef.current?.currentTime || 0,
                durationSeconds: Number.isFinite(videoRef.current?.duration) ? videoRef.current?.duration : null,
              })
              startHeartbeat(playbackKey)
            }}
            onPause={() => {
              if (releasedRef.current || sourceRefreshRef.current) return
              void postEvent("pause", {
                playbackSeconds: videoRef.current?.currentTime || 0,
                durationSeconds: Number.isFinite(videoRef.current?.duration) ? videoRef.current?.duration : null,
              })
            }}
            onEnded={() => {
              // Stop all local continuity work immediately. The complete
              // event remains best-effort; a transient network failure must
              // not let URL refreshes keep an already-finished lease alive.
              releasedRef.current = true
              stopHeartbeat()
              void postEvent("complete", {
                playbackSeconds: videoRef.current?.currentTime || 0,
                durationSeconds: Number.isFinite(videoRef.current?.duration) ? videoRef.current?.duration : null,
              })
            }}
            onError={() => {
              if (sourceRefreshRef.current) {
                sourceRefreshRef.current = false
                pendingPlaybackRestoreRef.current = null
                suppressNextLoadedDataEventRef.current = false
                suppressNextPlayEventRef.current = false
                releasedRef.current = true
                stopHeartbeat()
                void postEvent("error")
                notifyPlaybackStopped(
                  "Yenilenen video bağlantısı açılamadı. Eğitimi yeniden açın.",
                  playbackKey
                )
                return
              }
              releasedRef.current = true
              stopHeartbeat()
              void postEvent("error")
            }}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-sm text-white/80">
            Oynatma bağlantısı bulunamadı.
          </div>
        )}

        {watermarkText && (
          <div
            aria-hidden="true"
            className={[
              "pointer-events-none absolute z-20 max-w-[84%] rounded-xl border border-white/20 bg-black/50 px-3 py-2 font-mono text-[9px] font-medium tracking-[0.04em] text-white backdrop-blur-sm transition-all duration-700 sm:max-w-[60%] sm:text-[10px]",
              watermarkPosition,
            ].join(" ")}
          >
            {watermarkText}
          </div>
        )}

        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          className="absolute bottom-3 right-3 z-30 grid h-10 w-10 place-items-center rounded-xl border border-white/20 bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/75"
          aria-label={isFullscreen ? "Tam ekrandan çık" : "Tam ekran aç"}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

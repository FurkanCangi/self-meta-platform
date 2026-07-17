"use client"

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"
import type {
  ActivityDefinition,
  CharacterVariant,
  MotionTrack,
} from "../types"
import {
  buildMotionSnapshot,
  clampTimelineTime,
  getCueIndex,
  motionTrackToWaapiKeyframes,
} from "../timeline"
import { SceneLayer } from "./SceneLayer"
import { SvgChildRig } from "./SvgChildRig"
import styles from "./ActivityPlayer.module.css"

type PlaybackRate = 0.5 | 1

export interface ActivityPlayerProps {
  activity: ActivityDefinition
  character?: CharacterVariant
  onCharacterChange?: (character: CharacterVariant) => void
  isSelected?: boolean
  className?: string
}

const UI_PROGRESS_INTERVAL_MS = 80

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean | null>(null)

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updatePreference = () => setPrefersReducedMotion(query.matches)

    updatePreference()
    query.addEventListener("change", updatePreference)
    return () => query.removeEventListener("change", updatePreference)
  }, [])

  return prefersReducedMotion
}

function formatTime(timeMs: number) {
  const totalSeconds = Math.max(0, Math.round(timeMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

function readAnimationTime(animation: Animation | null) {
  if (!animation?.currentTime) return 0
  const time = Number(animation.currentTime)
  return Number.isFinite(time) ? time : 0
}

function localTimelineTime(rawTimeMs: number, durationMs: number, loop: boolean) {
  const safeDuration = Math.max(1, durationMs)
  if (!loop) return clampTimelineTime(rawTimeMs, safeDuration)
  if (rawTimeMs === safeDuration) return safeDuration
  return ((rawTimeMs % safeDuration) + safeDuration) % safeDuration
}

function setAnimationTime(animation: Animation, timeMs: number) {
  try {
    animation.currentTime = timeMs
  } catch {
    // A cancelled animation can reject a late currentTime write during teardown.
  }
}

function syncTrackAnimations(animations: readonly Animation[], timeMs: number) {
  for (const animation of animations) setAnimationTime(animation, timeMs)
}

function getTranslationScale(track: MotionTrack) {
  return track.target.startsWith("scene:") ? 1 : 2
}

export function ActivityPlayer({
  activity,
  character,
  onCharacterChange,
  isSelected = true,
  className,
}: ActivityPlayerProps) {
  const titleId = `activity-player-title-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
  const descriptionId = `activity-player-description-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
  const sceneGradientId = `activity-scene-gradient-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
  const stageRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const masterAnimationRef = useRef<Animation | null>(null)
  const trackAnimationsRef = useRef<Animation[]>([])
  const frameRef = useRef<number | null>(null)
  const lastUiUpdateRef = useRef(0)
  const playbackRateRef = useRef<PlaybackRate>(1)
  const prefersReducedMotion = usePrefersReducedMotion()
  const [internalCharacter, setInternalCharacter] = useState<CharacterVariant>(activity.character)
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(1)
  const [progressMs, setProgressMs] = useState(0)
  const [playbackRequested, setPlaybackRequested] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isWaapiReady, setIsWaapiReady] = useState(false)
  const [isInViewport, setIsInViewport] = useState(false)
  const [isDocumentVisible, setIsDocumentVisible] = useState(true)
  const resolvedCharacter = character ?? internalCharacter
  const durationMs = Math.max(1, activity.durationMs)
  const activeCueIndex = getCueIndex(activity.cues, progressMs)
  const activeCue = activeCueIndex >= 0 ? activity.cues[activeCueIndex] : null
  const renderedSnapshot = useMemo(
    () =>
      isPlaying && isWaapiReady
        ? undefined
        : buildMotionSnapshot(activity.motionTracks, progressMs),
    [activity.motionTracks, isPlaying, isWaapiReady, progressMs]
  )
  const canRunAnimation =
    isSelected &&
    isInViewport &&
    isDocumentVisible &&
    prefersReducedMotion === false
  const rootClassName = className ? `${styles.player} ${className}` : styles.player

  useEffect(() => {
    setInternalCharacter(activity.character)
    setProgressMs(0)
    setPlaybackRequested(true)
    setIsPlaying(false)
  }, [activity.character, activity.id])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || typeof stage.animate !== "function") return
    if (typeof IntersectionObserver === "undefined") {
      setIsInViewport(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsInViewport(entry.isIntersecting),
      { threshold: 0.12 }
    )
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsDocumentVisible(document.visibilityState === "visible")
    }

    handleVisibilityChange()
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    const svg = svgRef.current
    if (!stage || !svg || typeof stage.animate !== "function") {
      setIsWaapiReady(false)
      return
    }

    const masterAnimation = stage.animate(
      [{ opacity: 1 }, { opacity: 1 }],
      {
        duration: durationMs,
        iterations: activity.loop ? Infinity : 1,
        fill: "both",
        easing: "linear",
      }
    )
    masterAnimation.pause()
    masterAnimation.currentTime = 0
    masterAnimation.playbackRate = playbackRateRef.current

    const motionNodes = Array.from(
      svg.querySelectorAll<SVGGraphicsElement>("[data-motion-target]")
    )
    const animations: Animation[] = []

    for (const track of activity.motionTracks) {
      const node = motionNodes.find(
        (candidate) => candidate.dataset.motionTarget === track.target
      )
      if (!node) continue

      const animation = node.animate(
        motionTrackToWaapiKeyframes(
          track,
          durationMs,
          getTranslationScale(track)
        ),
        {
          duration: durationMs,
          iterations: 1,
          fill: "both",
          easing: "linear",
        }
      )
      animation.pause()
      animation.currentTime = 0
      animations.push(animation)
    }

    masterAnimationRef.current = masterAnimation
    trackAnimationsRef.current = animations
    syncTrackAnimations(animations, 0)
    setProgressMs(0)
    setIsPlaying(false)
    setIsWaapiReady(true)

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
      masterAnimation.cancel()
      for (const animation of animations) animation.cancel()
      if (masterAnimationRef.current === masterAnimation) {
        masterAnimationRef.current = null
      }
      trackAnimationsRef.current = []
      setIsWaapiReady(false)
    }
  }, [activity.id, activity.loop, activity.motionTracks, durationMs])

  useEffect(() => {
    const masterAnimation = masterAnimationRef.current
    if (!masterAnimation || !isWaapiReady) return

    if (!canRunAnimation || !playbackRequested) {
      masterAnimation.pause()
      setIsPlaying(false)
      return
    }

    masterAnimation.playbackRate = playbackRateRef.current
    void masterAnimation.play()
    setIsPlaying(true)
  }, [canRunAnimation, isWaapiReady, playbackRequested])

  useEffect(() => {
    if (
      !isPlaying ||
      !isSelected ||
      !isInViewport ||
      !isDocumentVisible ||
      prefersReducedMotion !== false
    ) {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
      return
    }

    const renderFrame = (timestamp: number) => {
      const masterAnimation = masterAnimationRef.current
      if (!masterAnimation) return

      const rawTimeMs = readAnimationTime(masterAnimation)
      const timeMs = localTimelineTime(rawTimeMs, durationMs, activity.loop)
      syncTrackAnimations(trackAnimationsRef.current, timeMs)

      if (timestamp - lastUiUpdateRef.current >= UI_PROGRESS_INTERVAL_MS) {
        lastUiUpdateRef.current = timestamp
        setProgressMs(timeMs)
      }

      frameRef.current = window.requestAnimationFrame(renderFrame)
    }

    frameRef.current = window.requestAnimationFrame(renderFrame)
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [activity.loop, durationMs, isDocumentVisible, isInViewport, isPlaying, isSelected, prefersReducedMotion])

  function seekTo(timeMs: number) {
    const nextTimeMs = clampTimelineTime(timeMs, durationMs)
    const masterAnimation = masterAnimationRef.current
    if (masterAnimation) setAnimationTime(masterAnimation, nextTimeMs)
    syncTrackAnimations(trackAnimationsRef.current, nextTimeMs)
    setProgressMs(nextTimeMs)
  }

  function handlePlayPause() {
    const masterAnimation = masterAnimationRef.current
    if (!masterAnimation || !isSelected || prefersReducedMotion !== false) return

    if (isPlaying) {
      setPlaybackRequested(false)
      masterAnimation.pause()
      const timeMs = localTimelineTime(
        readAnimationTime(masterAnimation),
        durationMs,
        activity.loop
      )
      syncTrackAnimations(trackAnimationsRef.current, timeMs)
      setProgressMs(timeMs)
      setIsPlaying(false)
      return
    }

    if (progressMs >= durationMs) seekTo(0)
    setPlaybackRequested(true)
    if (!canRunAnimation) return
    masterAnimation.playbackRate = playbackRate
    void masterAnimation.play()
    setIsPlaying(true)
  }

  function handleRestart() {
    const masterAnimation = masterAnimationRef.current
    seekTo(0)
    setPlaybackRequested(true)
    if (!masterAnimation || !canRunAnimation) {
      setIsPlaying(false)
      return
    }

    masterAnimation.playbackRate = playbackRate
    void masterAnimation.play()
    setIsPlaying(true)
  }

  function handlePlaybackRateChange(nextRate: PlaybackRate) {
    setPlaybackRate(nextRate)
    playbackRateRef.current = nextRate
    const masterAnimation = masterAnimationRef.current
    if (!masterAnimation) return
    masterAnimation.updatePlaybackRate(nextRate)
  }

  function goToCue(direction: -1 | 1) {
    if (activity.cues.length === 0) return

    let targetIndex: number
    if (direction === -1) {
      const currentCueTime = activeCue?.atMs ?? 0
      targetIndex = progressMs - currentCueTime > 500
        ? Math.max(0, activeCueIndex)
        : Math.max(0, activeCueIndex - 1)
    } else {
      targetIndex = Math.min(activity.cues.length - 1, activeCueIndex + 1)
    }

    seekTo(activity.cues[targetIndex].atMs)
    if (prefersReducedMotion === true) setIsPlaying(false)
  }

  function handleCharacterChange(nextCharacter: CharacterVariant) {
    if (character === undefined) setInternalCharacter(nextCharacter)
    onCharacterChange?.(nextCharacter)
  }

  return (
    <article className={rootClassName} aria-labelledby={titleId} aria-describedby={descriptionId}>
      <header className={styles.header}>
        <div className={styles.headingBlock}>
          <span className={styles.eyebrow}>{activity.shortLabel}</span>
          <h2 id={titleId} className={styles.title}>{activity.title}</h2>
          <p id={descriptionId} className={styles.instruction}>{activity.instruction}</p>
        </div>
        <div className={styles.headerMeta} aria-label="Aktivite bilgisi">
          <span>{activity.categoryLabel}</span>
          <span>{formatTime(durationMs)}</span>
        </div>
      </header>

      <div ref={stageRef} className={styles.stage} data-selected={isSelected ? "true" : "false"}>
        <svg
          ref={svgRef}
          className={styles.scene}
          viewBox="0 0 1280 720"
          width="1280"
          height="720"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`${activity.title} aktivitesinin hareketli gösterimi`}
        >
          <title>{activity.title}</title>
          <desc>{activity.instruction}</desc>
          <defs>
            <linearGradient id={sceneGradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ecfeff" />
              <stop offset="0.52" stopColor="#eff6ff" />
              <stop offset="1" stopColor="#f5f3ff" />
            </linearGradient>
          </defs>
          <rect width="1280" height="720" fill={`url(#${sceneGradientId})`} />
          <circle className={styles.sceneOrbCyan} cx="1110" cy="105" r="190" />
          <circle className={styles.sceneOrbViolet} cx="160" cy="52" r="145" />
          <path className={styles.roomLine} d="M0 590C250 548 465 620 704 580s384-40 576 1V720H0z" />
          <path className={styles.roomAccent} d="M85 118h210M1010 212h170" />
          <SceneLayer objects={activity.sceneObjects} layer="back" transforms={renderedSnapshot} />
          <SceneLayer objects={activity.sceneObjects} layer="middle" transforms={renderedSnapshot} />
          <SvgChildRig
            character={resolvedCharacter}
            transforms={renderedSnapshot}
          />
          <SceneLayer objects={activity.sceneObjects} layer="front" transforms={renderedSnapshot} />
        </svg>

        <div className={styles.stageBadges}>
          {prefersReducedMotion === true && (
            <span className={styles.reducedBadge}>Statik adım modu</span>
          )}
          {!isSelected && (
            <span className={styles.inactiveBadge}>Önizlemek için aktiviteyi seçin</span>
          )}
        </div>

        {activeCue && (
          <div className={styles.cueCard} aria-live="polite" aria-atomic="true">
            <span className={styles.cueCount}>
              Adım {activeCueIndex + 1}/{activity.cues.length}
            </span>
            <strong>{activeCue.label}</strong>
            {activeCue.instruction && <span>{activeCue.instruction}</span>}
          </div>
        )}
      </div>

      <div
        className={styles.controls}
        role="group"
        aria-label={`${activity.title} animasyon kontrolleri`}
      >
        <div className={styles.transportRow}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handlePlayPause}
            disabled={!isWaapiReady || !isSelected || prefersReducedMotion !== false}
            aria-pressed={isPlaying}
          >
            {isPlaying ? "Duraklat" : "Oynat"}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={handleRestart}>
            Başa al
          </button>
          <div className={styles.speedGroup} role="group" aria-label="Oynatma hızı">
            {([0.5, 1] as const).map((rate) => (
              <button
                key={rate}
                type="button"
                className={styles.segmentButton}
                data-active={playbackRate === rate ? "true" : "false"}
                onClick={() => handlePlaybackRateChange(rate)}
                disabled={prefersReducedMotion !== false}
                aria-pressed={playbackRate === rate}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>

        <label className={styles.timelineControl}>
          <span className={styles.srOnly}>Animasyon zaman çizelgesi</span>
          <span className={styles.timeValue}>{formatTime(progressMs)}</span>
          <input
            className={styles.range}
            type="range"
            min="0"
            max={durationMs}
            step="50"
            value={Math.round(progressMs)}
            onChange={(event) => seekTo(Number(event.currentTarget.value))}
            aria-valuetext={`${formatTime(progressMs)} / ${formatTime(durationMs)}`}
          />
          <span className={styles.timeValue}>{formatTime(durationMs)}</span>
        </label>

        <div className={styles.lowerControls}>
          <div className={styles.cueControls} role="group" aria-label="Animasyon adımları">
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => goToCue(-1)}
              disabled={activeCueIndex <= 0 && progressMs <= 500}
            >
              Önceki adım
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => goToCue(1)}
              disabled={activeCueIndex >= activity.cues.length - 1}
            >
              Sonraki adım
            </button>
          </div>

          <div className={styles.characterGroup} role="group" aria-label="Karakter seçimi">
            <span>Karakter</span>
            {(["girl", "boy"] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={styles.characterButton}
                data-active={resolvedCharacter === option ? "true" : "false"}
                onClick={() => handleCharacterChange(option)}
                aria-pressed={resolvedCharacter === option}
              >
                {option === "girl" ? "Kız" : "Erkek"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {prefersReducedMotion === true && (
        <p className={styles.modeNote}>
          Cihazınızın azaltılmış hareket tercihi açık. Önceki ve sonraki adım düğmeleri statik kontrol noktalarını gösterir.
        </p>
      )}
    </article>
  )
}

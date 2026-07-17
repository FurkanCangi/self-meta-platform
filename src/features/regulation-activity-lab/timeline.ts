import type {
  ActivityCue,
  MotionKeyframe,
  MotionTrack,
  MotionTransform,
} from "./types"

export const IDENTITY_MOTION_TRANSFORM: MotionTransform = {
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
}

export type MotionSnapshot = Readonly<Record<string, MotionTransform>>

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

function normalizeTransform(transform?: Partial<MotionTransform> | null): MotionTransform {
  return {
    x: Number.isFinite(transform?.x) ? Number(transform?.x) : IDENTITY_MOTION_TRANSFORM.x,
    y: Number.isFinite(transform?.y) ? Number(transform?.y) : IDENTITY_MOTION_TRANSFORM.y,
    rotation: Number.isFinite(transform?.rotation)
      ? Number(transform?.rotation)
      : IDENTITY_MOTION_TRANSFORM.rotation,
    scaleX: Number.isFinite(transform?.scaleX)
      ? Number(transform?.scaleX)
      : IDENTITY_MOTION_TRANSFORM.scaleX,
    scaleY: Number.isFinite(transform?.scaleY)
      ? Number(transform?.scaleY)
      : IDENTITY_MOTION_TRANSFORM.scaleY,
    opacity: clamp(
      Number.isFinite(transform?.opacity)
        ? Number(transform?.opacity)
        : IDENTITY_MOTION_TRANSFORM.opacity,
      0,
      1
    ),
  }
}

function cubicEaseInOut(progress: number) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2
}

function resolveEasing(progress: number, easing?: MotionKeyframe["easing"]) {
  const normalized = String(easing || "linear")
    .trim()
    .toLowerCase()

  if (normalized === "ease-in" || normalized === "easein") {
    return progress * progress * progress
  }

  if (normalized === "ease-out" || normalized === "easeout") {
    return 1 - Math.pow(1 - progress, 3)
  }

  if (
    normalized === "ease-in-out" ||
    normalized === "easeinout" ||
    normalized === "smooth"
  ) {
    return cubicEaseInOut(progress)
  }

  if (normalized === "step-start") return progress > 0 ? 1 : 0
  if (normalized === "step-end" || normalized === "hold") return progress >= 1 ? 1 : 0
  return progress
}

function interpolateTransform(
  from: MotionTransform,
  to: MotionTransform,
  progress: number
): MotionTransform {
  const mix = (start: number, end: number) => start + (end - start) * progress

  return {
    x: mix(from.x, to.x),
    y: mix(from.y, to.y),
    rotation: mix(from.rotation, to.rotation),
    scaleX: mix(from.scaleX, to.scaleX),
    scaleY: mix(from.scaleY, to.scaleY),
    opacity: mix(from.opacity, to.opacity),
  }
}

export function resolveMotionTrack(track: MotionTrack, timeMs: number): MotionTransform {
  const keyframes = track.keyframes
  if (keyframes.length === 0) return IDENTITY_MOTION_TRANSFORM

  const first = keyframes[0]
  const last = keyframes[keyframes.length - 1]
  if (timeMs <= first.atMs) return normalizeTransform(first.transform)
  if (timeMs >= last.atMs) return normalizeTransform(last.transform)

  for (let index = 1; index < keyframes.length; index += 1) {
    const right = keyframes[index]
    if (timeMs > right.atMs) continue

    const left = keyframes[index - 1]
    const spanMs = Math.max(1, right.atMs - left.atMs)
    const linearProgress = clamp((timeMs - left.atMs) / spanMs, 0, 1)
    const easedProgress = resolveEasing(linearProgress, right.easing)

    return interpolateTransform(
      normalizeTransform(left.transform),
      normalizeTransform(right.transform),
      easedProgress
    )
  }

  return normalizeTransform(last.transform)
}

export function buildMotionSnapshot(
  tracks: readonly MotionTrack[],
  timeMs: number
): MotionSnapshot {
  const snapshot: Record<string, MotionTransform> = {}

  for (const track of tracks) {
    snapshot[track.target] = resolveMotionTrack(track, timeMs)
  }

  return snapshot
}

export function motionTransformToSvg(
  transform?: MotionTransform,
  translationScale = 1
) {
  const value = transform || IDENTITY_MOTION_TRANSFORM
  return [
    `translate(${value.x * translationScale} ${value.y * translationScale})`,
    `rotate(${value.rotation})`,
    `scale(${value.scaleX} ${value.scaleY})`,
  ].join(" ")
}

export function motionTransformToCss(
  transform?: MotionTransform,
  translationScale = 1
) {
  const value = transform || IDENTITY_MOTION_TRANSFORM
  return [
    `translate(${value.x * translationScale}px, ${value.y * translationScale}px)`,
    `rotate(${value.rotation}deg)`,
    `scale(${value.scaleX}, ${value.scaleY})`,
  ].join(" ")
}

function normalizeCssEasing(easing?: MotionKeyframe["easing"]) {
  const normalized = String(easing || "linear").trim().toLowerCase()
  if (normalized === "easein") return "ease-in"
  if (normalized === "easeout") return "ease-out"
  if (normalized === "easeinout" || normalized === "smooth") return "ease-in-out"
  if (normalized === "hold") return "steps(1, end)"
  return normalized
}

export function motionTrackToWaapiKeyframes(
  track: MotionTrack,
  durationMs: number,
  translationScale = 1
): Keyframe[] {
  if (track.keyframes.length === 0) {
    return [
      {
        offset: 0,
        transform: motionTransformToCss(undefined, translationScale),
        opacity: IDENTITY_MOTION_TRANSFORM.opacity,
      },
      {
        offset: 1,
        transform: motionTransformToCss(undefined, translationScale),
        opacity: IDENTITY_MOTION_TRANSFORM.opacity,
      },
    ]
  }

  const safeDuration = Math.max(1, durationMs)
  const sorted = [...track.keyframes].sort((left, right) => left.atMs - right.atMs)
  const expanded: MotionKeyframe[] = [...sorted]

  if (sorted[0].atMs > 0) {
    expanded.unshift({ ...sorted[0], atMs: 0 })
  }

  if (sorted[sorted.length - 1].atMs < safeDuration) {
    expanded.push({ ...sorted[sorted.length - 1], atMs: safeDuration })
  }

  return expanded.map((keyframe) => {
    const transform = normalizeTransform(keyframe.transform)
    return {
      offset: clamp(keyframe.atMs / safeDuration, 0, 1),
      transform: motionTransformToCss(transform, translationScale),
      opacity: transform.opacity,
      easing: normalizeCssEasing(keyframe.easing),
    }
  })
}

export function getMotionOpacity(transform?: MotionTransform) {
  return transform?.opacity ?? IDENTITY_MOTION_TRANSFORM.opacity
}

export function getCueIndex(cues: readonly ActivityCue[], timeMs: number) {
  if (cues.length === 0) return -1

  let activeIndex = 0
  for (let index = 0; index < cues.length; index += 1) {
    if (cues[index].atMs > timeMs) break
    activeIndex = index
  }

  return activeIndex
}

export function clampTimelineTime(timeMs: number, durationMs: number) {
  return clamp(timeMs, 0, Math.max(1, durationMs))
}

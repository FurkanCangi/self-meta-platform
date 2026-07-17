export type ActivityCharacter = "girl" | "boy"

export type CharacterVariant = ActivityCharacter

export type ActivityDomain = "self-regulation"

export type ActivityCategory =
  | "heavy-work"
  | "motor-planning"
  | "inhibitory-control"
  | "working-memory"
  | "cognitive-flexibility"
  | "rhythm-and-pacing"
  | "body-awareness-and-transition"

export type ActivityCueKind = "instruction" | "timing" | "transition" | "stop"

export type MotionEasing =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "smooth"
  | "step-start"
  | "step-end"
  | "hold"

export type RigMotionTarget =
  | "rig.root"
  | "rig.head"
  | "rig.torso"
  | "rig.arm.left.upper"
  | "rig.arm.left.lower"
  | "rig.arm.right.upper"
  | "rig.arm.right.lower"
  | "rig.leg.left.upper"
  | "rig.leg.left.lower"
  | "rig.leg.right.upper"
  | "rig.leg.right.lower"
  | "rig.breath"

export type SceneMotionTarget = `scene:${string}`

export type MotionTarget = RigMotionTarget | SceneMotionTarget

export type SceneObjectKind =
  | "wall"
  | "floor-marker"
  | "basket"
  | "cone"
  | "paw-marker"
  | "cushion"
  | "foam-arch"
  | "soft-bar"
  | "traffic-light"
  | "sequence-card"
  | "direction-card"
  | "rhythm-dot"
  | "choice-card"
  | "return-spot"

export interface MotionTransform {
  readonly x: number
  readonly y: number
  readonly rotation: number
  readonly scaleX: number
  readonly scaleY: number
  readonly opacity: number
}

export interface MotionKeyframe {
  readonly atMs: number
  readonly easing: MotionEasing
  readonly transform: MotionTransform
}

export interface MotionTrack {
  readonly id: string
  readonly target: MotionTarget
  readonly keyframes: readonly MotionKeyframe[]
}

export interface ActivityCue {
  readonly id: string
  readonly atMs: number
  readonly label: string
  readonly instruction?: string
  readonly kind: ActivityCueKind
}

export type MotionCue = ActivityCue

export interface SceneObject {
  readonly id: string
  readonly kind: SceneObjectKind
  readonly label: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly fill: string
  readonly stroke: string
  readonly layer: "back" | "middle" | "front"
}

export interface ActivityMaterial {
  readonly id: string
  readonly label: string
  readonly quantity: number
  readonly required: boolean
  readonly safetyNote: string
}

export interface ActivityAgeRange {
  readonly minYears: number
  readonly maxYears: number
  readonly label: string
}

export interface ActivitySupervision {
  readonly level: "continuous-adult"
  readonly label: string
  readonly instruction: string
}

export interface ActivitySafety {
  readonly ageRange: ActivityAgeRange
  readonly supervision: ActivitySupervision
  readonly setupChecklist: readonly string[]
  readonly contraindications: readonly string[]
  readonly stopConditions: readonly string[]
  readonly reviewStatus: "clinical-review-required"
}

export type SafetyNote = ActivitySafety

export interface ActivityScene {
  readonly viewBox: {
    readonly width: 1280
    readonly height: 720
  }
  readonly objects: readonly SceneObject[]
}

export interface RegulationActivity {
  readonly id: string
  readonly order: number
  readonly title: string
  readonly shortLabel: string
  readonly domain: ActivityDomain
  readonly category: ActivityCategory
  readonly categoryLabel: string
  readonly skills: readonly string[]
  readonly character: ActivityCharacter
  readonly defaultCharacter: CharacterVariant
  readonly durationMs: number
  readonly loop: true
  readonly instruction: string
  readonly materials: readonly ActivityMaterial[]
  readonly sceneObjects: readonly SceneObject[]
  readonly scene: ActivityScene
  readonly motionTracks: readonly MotionTrack[]
  readonly cues: readonly ActivityCue[]
  readonly safety: ActivitySafety
  readonly supervision: ActivitySupervision
  readonly stopConditions: readonly string[]
}

export type ActivityDefinition = RegulationActivity

export const ACTIVITY_SCENE_VIEWBOX = Object.freeze({ width: 1280, height: 720 })

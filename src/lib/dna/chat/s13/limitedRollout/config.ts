import { createHash } from "node:crypto"

export const DNA_S13_LIMITED_ROLLOUT_ENV = Object.freeze({
  enabled: "DNA_S13_LIMITED_ROLLOUT_ENABLED",
  percent: "DNA_S13_LIMITED_ROLLOUT_PERCENT",
  phase: "DNA_S13_LIMITED_ROLLOUT_PHASE",
  dailyLunaCapUsd: "DNA_S13_LIMITED_ROLLOUT_DAILY_LUNA_CAP_USD",
  nearCapPercent: "DNA_S13_LIMITED_ROLLOUT_NEAR_CAP_PERCENT",
  contextSecret: "DNA_S13_LIMITED_ROLLOUT_CONTEXT_SECRET",
  telemetrySecret: "DNA_S13_LIMITED_ROLLOUT_TELEMETRY_SECRET",
} as const)

export const DNA_S13_LIMITED_ROLLOUT_PHASES = Object.freeze(["L0", "L1", "L2", "L3"] as const)
export type DnaS13LimitedRolloutPhase = typeof DNA_S13_LIMITED_ROLLOUT_PHASES[number]

export type DnaS13LimitedRolloutConfig = Readonly<{
  enabled: boolean
  percent: number
  phase: DnaS13LimitedRolloutPhase
  dailyLunaCapMicrousd: number
  nearCapPercent: number
  l0OwnerAllowlistOnly: true
  percentageRoutingActive: boolean
  valid: boolean
  reasonCodes: readonly string[]
}>

function booleanFlag(value: string | undefined) {
  return ["1", "true", "on", "enabled"].includes(String(value || "").trim().toLowerCase())
}

function boundedNumber(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback
}

export function resolveDnaS13LimitedRolloutConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): DnaS13LimitedRolloutConfig {
  const phaseValue = String(env[DNA_S13_LIMITED_ROLLOUT_ENV.phase] || "L0").trim().toUpperCase()
  const phase = DNA_S13_LIMITED_ROLLOUT_PHASES.includes(phaseValue as DnaS13LimitedRolloutPhase)
    ? phaseValue as DnaS13LimitedRolloutPhase
    : "L0"
  const percent = boundedNumber(env[DNA_S13_LIMITED_ROLLOUT_ENV.percent], 0, 0, 100)
  const dailyCapUsd = boundedNumber(env[DNA_S13_LIMITED_ROLLOUT_ENV.dailyLunaCapUsd], 2, 0, 10_000)
  const nearCapPercent = boundedNumber(env[DNA_S13_LIMITED_ROLLOUT_ENV.nearCapPercent], 80, 50, 100)
  const reasons = [
    ...(phase === "L0" && percent !== 0 ? ["l0_percentage_must_be_zero"] : []),
    ...(phaseValue !== phase ? ["invalid_rollout_phase"] : []),
    ...(dailyCapUsd <= 0 ? ["daily_luna_cap_not_positive"] : []),
  ]
  return Object.freeze({
    enabled: booleanFlag(env[DNA_S13_LIMITED_ROLLOUT_ENV.enabled]) && reasons.length === 0,
    percent,
    phase,
    dailyLunaCapMicrousd: Math.round(dailyCapUsd * 1_000_000),
    nearCapPercent,
    l0OwnerAllowlistOnly: true as const,
    percentageRoutingActive: phase === "L2" && percent > 0,
    valid: reasons.length === 0,
    reasonCodes: Object.freeze(reasons),
  })
}

export function isDnaS13StableCohortEligible(subjectKey: string, percent: number) {
  const bounded = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0
  if (!subjectKey.trim() || bounded <= 0) return false
  if (bounded >= 100) return true
  const bucket = Number.parseInt(
    createHash("sha256").update(subjectKey.trim()).digest("hex").slice(0, 8),
    16,
  ) % 10_000
  return bucket < Math.round(bounded * 100)
}

export function resolveDnaS13LimitedRolloutGate(input: Readonly<{
  config: DnaS13LimitedRolloutConfig
  subjectKey: string
  trustedOwner: boolean
}>) {
  if (!input.config.enabled) {
    return Object.freeze({ routed: false, reason: "kill_switch_off" as const })
  }
  if (!input.config.valid) {
    return Object.freeze({ routed: false, reason: "invalid_config" as const })
  }
  if (input.config.phase === "L0") {
    return Object.freeze({
      routed: input.trustedOwner,
      reason: input.trustedOwner ? "l0_owner_allowlist" as const : "not_in_l0_allowlist" as const,
    })
  }
  if (input.config.phase === "L1") {
    return Object.freeze({ routed: false, reason: "l1_not_activated" as const })
  }
  if (input.config.phase === "L2") {
    const routed = isDnaS13StableCohortEligible(input.subjectKey, input.config.percent)
    return Object.freeze({ routed, reason: routed ? "stable_percentage_cohort" as const : "outside_percentage_cohort" as const })
  }
  return Object.freeze({ routed: false, reason: "l3_not_activated" as const })
}

import { createHash } from "node:crypto"

export const DNA_RUNTIME_RELEASE_MODE_VERSION = "dna-runtime-release-mode@1" as const
export const DNA_CHAT_RUNTIME_RELEASE_ENV = "DNA_CHAT_RUNTIME_RELEASE" as const
export const DNA_CHAT_V3_KILL_SWITCH_ENV = "DNA_CHAT_V3_KILL_SWITCH" as const
export const DNA_CHAT_V3_ROLLOUT_PERCENT_ENV = "DNA_CHAT_V3_ROLLOUT_PERCENT" as const

export const DNA_V2_ROLLBACK_TARGET = Object.freeze({
  runtimeMode: "v2" as const,
  engineVersion: "dna-chat-engine@2" as const,
  catalogVersion: "dna-chat-catalog@2" as const,
  gitTag: "dna-chat-v2-baseline-20260719",
  gitSha: "5ed87217280a40e4566a04289d4c98b1f3883494",
  oneCommandEnvironment: "DNA_CHAT_RUNTIME_RELEASE=v2",
})

export type DnaRuntimeReleaseMode = "v2" | "hybrid-v3" | "v3"

export type DnaRuntimeReleaseConfiguration = Readonly<{
  schemaVersion: typeof DNA_RUNTIME_RELEASE_MODE_VERSION
  mode: DnaRuntimeReleaseMode | null
  modeSource: "safe_default" | "environment"
  killSwitchActive: boolean
  rolloutPercent: number
  valid: boolean
  blockCode:
    | null
    | "runtime_release_mode_invalid"
    | "kill_switch_value_invalid"
    | "rollout_percent_invalid"
}>

export type DnaRuntimeReleaseExecutionDecision = Readonly<{
  schemaVersion: typeof DNA_RUNTIME_RELEASE_MODE_VERSION
  allowed: boolean
  requestedMode: DnaRuntimeReleaseMode | null
  execution: "v2_legacy" | "hybrid_v3" | "v3" | "blocked"
  reason:
    | "explicit_v2"
    | "kill_switch_v2_rollback"
    | "rollout_not_selected"
    | "hybrid_v3_selected"
    | "v3_selected"
    | "configuration_invalid"
    | "release_no_go"
    | "v3_release_unavailable"
    | "deployment_not_authorized"
    | "rollout_stage_not_authorized"
    | "rollout_subject_required"
}>

type Environment = Readonly<Record<string, string | undefined>>

function parseRolloutPercent(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") return 0
  if (!/^\d{1,3}$/.test(raw)) return null
  const value = Number(raw)
  return Number.isInteger(value) && value >= 0 && value <= 100 ? value : null
}

/**
 * Missing runtime mode deliberately means V2. Invalid explicit values block
 * instead of silently falling back, so a typo cannot accidentally select a
 * different generation.
 */
export function readDnaRuntimeReleaseConfiguration(
  environment: Environment = process.env,
): DnaRuntimeReleaseConfiguration {
  const rawMode = environment[DNA_CHAT_RUNTIME_RELEASE_ENV]
  const modeSource = rawMode === undefined || rawMode === "" ? "safe_default" : "environment"
  const mode: DnaRuntimeReleaseMode | null = modeSource === "safe_default"
    ? "v2"
    : rawMode === "v2" || rawMode === "hybrid-v3" || rawMode === "v3"
      ? rawMode
      : null
  const rawKillSwitch = environment[DNA_CHAT_V3_KILL_SWITCH_ENV]
  const killSwitchValid = rawKillSwitch === undefined || rawKillSwitch === ""
    || rawKillSwitch === "0" || rawKillSwitch === "1"
  const rolloutPercent = parseRolloutPercent(environment[DNA_CHAT_V3_ROLLOUT_PERCENT_ENV])
  const blockCode = mode === null
    ? "runtime_release_mode_invalid"
    : !killSwitchValid
      ? "kill_switch_value_invalid"
      : rolloutPercent === null
        ? "rollout_percent_invalid"
        : null
  return Object.freeze({
    schemaVersion: DNA_RUNTIME_RELEASE_MODE_VERSION,
    mode,
    modeSource,
    killSwitchActive: rawKillSwitch === "1",
    rolloutPercent: rolloutPercent ?? 0,
    valid: blockCode === null,
    blockCode,
  })
}

function rolloutBucket(subjectKey: string, packageSha256: string): number {
  const digest = createHash("sha256")
    .update(`${packageSha256}\u0000${subjectKey}`, "utf8")
    .digest("hex")
  return Number.parseInt(digest.slice(0, 8), 16) % 100
}

function result(
  configuration: DnaRuntimeReleaseConfiguration,
  execution: DnaRuntimeReleaseExecutionDecision["execution"],
  reason: DnaRuntimeReleaseExecutionDecision["reason"],
): DnaRuntimeReleaseExecutionDecision {
  return Object.freeze({
    schemaVersion: DNA_RUNTIME_RELEASE_MODE_VERSION,
    allowed: execution !== "blocked",
    requestedMode: configuration.mode,
    execution,
    reason,
  })
}

export function decideDnaRuntimeReleaseExecution(input: Readonly<{
  configuration: DnaRuntimeReleaseConfiguration
  v3ReleaseAvailable: boolean
  releaseHardNoGoAllowed: boolean
  deploymentAuthorized: boolean
  rolloutStageAuthorized: boolean
  packageSha256: string
  rolloutSubjectKey?: string | null
}>): DnaRuntimeReleaseExecutionDecision {
  const configuration = input.configuration
  // A syntactically valid emergency kill-switch must recover V2 even when a
  // separate rollout/mode setting is malformed. An invalid kill-switch value
  // never sets killSwitchActive and therefore still fails closed below.
  if (configuration.killSwitchActive) {
    return result(configuration, "v2_legacy", "kill_switch_v2_rollback")
  }
  if (!configuration.valid || configuration.mode === null) {
    return result(configuration, "blocked", "configuration_invalid")
  }
  if (configuration.mode === "v2") {
    return result(configuration, "v2_legacy", "explicit_v2")
  }
  if (!input.releaseHardNoGoAllowed) {
    return result(configuration, "blocked", "release_no_go")
  }
  if (!input.v3ReleaseAvailable || !/^[a-f0-9]{64}$/.test(input.packageSha256)) {
    return result(configuration, "blocked", "v3_release_unavailable")
  }
  if (!input.deploymentAuthorized) {
    return result(configuration, "blocked", "deployment_not_authorized")
  }
  if (configuration.rolloutPercent === 0) {
    return result(configuration, "v2_legacy", "rollout_not_selected")
  }
  if (!input.rolloutStageAuthorized) {
    return result(configuration, "blocked", "rollout_stage_not_authorized")
  }
  if (configuration.rolloutPercent < 100 && !input.rolloutSubjectKey?.trim()) {
    return result(configuration, "blocked", "rollout_subject_required")
  }
  if (configuration.rolloutPercent < 100
    && rolloutBucket(input.rolloutSubjectKey!.trim(), input.packageSha256)
      >= configuration.rolloutPercent) {
    return result(configuration, "v2_legacy", "rollout_not_selected")
  }
  return configuration.mode === "hybrid-v3"
    ? result(configuration, "hybrid_v3", "hybrid_v3_selected")
    : result(configuration, "v3", "v3_selected")
}

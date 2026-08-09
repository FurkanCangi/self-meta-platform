export const DNA_ENGINE_VERSION_ENV = "DNA_ENGINE_VERSION" as const
export const DNA_ENGINE_VERSIONS = ["legacy", "tournament"] as const

export type DnaEngineVersion = typeof DNA_ENGINE_VERSIONS[number]

export type DnaTournamentExecutionPlan = Readonly<{
  requestedVersion: DnaEngineVersion
  publicRuntimeVersion: "legacy"
  tournamentShadowEnabled: boolean
  fallbackVersion: "legacy"
  reason: "default_legacy" | "explicit_legacy" | "tournament_shadow" | "invalid_value_fell_back"
}>

/**
 * Faz 0 boundary: tournament work may run as a shadow evaluator, but it cannot
 * alter a production answer. One env switch disables every tournament shadow
 * component and restores the frozen legacy control group.
 */
export function resolveDnaTournamentExecutionPlan(
  env: Readonly<Record<string, string | undefined>> = process.env,
): DnaTournamentExecutionPlan {
  const raw = env[DNA_ENGINE_VERSION_ENV]?.trim().toLowerCase()
  if (raw === "tournament") {
    return Object.freeze({
      requestedVersion: "tournament",
      publicRuntimeVersion: "legacy",
      tournamentShadowEnabled: true,
      fallbackVersion: "legacy",
      reason: "tournament_shadow",
    })
  }
  if (raw === "legacy") {
    return Object.freeze({
      requestedVersion: "legacy",
      publicRuntimeVersion: "legacy",
      tournamentShadowEnabled: false,
      fallbackVersion: "legacy",
      reason: "explicit_legacy",
    })
  }
  return Object.freeze({
    requestedVersion: "legacy",
    publicRuntimeVersion: "legacy",
    tournamentShadowEnabled: false,
    fallbackVersion: "legacy",
    reason: raw ? "invalid_value_fell_back" : "default_legacy",
  })
}


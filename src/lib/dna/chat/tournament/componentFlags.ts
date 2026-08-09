export const DNA_TOURNAMENT_COMPONENT_ENV = Object.freeze({
  semanticParser: "DNA_TOURNAMENT_SEMANTIC_PARSER_ENABLED",
  embedding: "DNA_TOURNAMENT_EMBEDDING_ENABLED",
  reranker: "DNA_TOURNAMENT_RERANKER_ENABLED",
  controlledNlg: "DNA_TOURNAMENT_CONTROLLED_NLG_ENABLED",
  localSlm: "DNA_TOURNAMENT_LOCAL_SLM_ENABLED",
  lunaParsing: "DNA_TOURNAMENT_LUNA_PARSING_ENABLED",
  lunaRealization: "DNA_TOURNAMENT_LUNA_REALIZATION_ENABLED",
  lunaFallback: "DNA_TOURNAMENT_LUNA_FALLBACK_ENABLED",
} as const)

export const DNA_TOURNAMENT_CANARY_STAGES = [
  "local_shadow",
  "production_shadow",
  "internal",
  "10",
  "50",
  "100",
] as const

export type DnaTournamentCanaryStage = typeof DNA_TOURNAMENT_CANARY_STAGES[number]
export type DnaTournamentComponent = keyof typeof DNA_TOURNAMENT_COMPONENT_ENV

export type DnaTournamentComponentPlan = Readonly<{
  stage: DnaTournamentCanaryStage
  publicAnswerMutationAllowed: boolean
  legacyFallbackGuaranteed: true
  humanEvaluationComplete: boolean
  productionWinner: "S1" | "S2" | "S5" | null
  releaseAttestationPresent: boolean
  components: Readonly<Record<DnaTournamentComponent, boolean>>
  blockedReasons: readonly string[]
}>

function enabled(value: string | undefined) {
  return value?.trim() === "1"
}

function stage(value: string | undefined): DnaTournamentCanaryStage {
  const normalized = value?.trim().toLowerCase()
  return DNA_TOURNAMENT_CANARY_STAGES.includes(normalized as DnaTournamentCanaryStage)
    ? normalized as DnaTournamentCanaryStage
    : "local_shadow"
}

/**
 * Faz 10 release boundary. Shadow stages may execute challengers for metrics,
 * but only an independently completed human evaluation can unlock an answer
 * mutation stage. Invalid dependency combinations fail closed per component.
 */
export function resolveDnaTournamentComponentPlan(
  env: Readonly<Record<string, string | undefined>> = process.env,
): DnaTournamentComponentPlan {
  const selectedStage = stage(env.DNA_TOURNAMENT_CANARY_STAGE)
  const humanEvaluationComplete = enabled(env.DNA_TOURNAMENT_HUMAN_EVALUATION_COMPLETE)
  const productionWinner = (["S1", "S2", "S5"] as const).find((value) =>
    value === env.DNA_TOURNAMENT_PRODUCTION_WINNER?.trim().toUpperCase()) ?? null
  const releaseAttestationPresent = /^[a-f0-9]{64}$/i.test(
    env.DNA_TOURNAMENT_RELEASE_ATTESTATION_SHA256?.trim() ?? "",
  )
  const requested = Object.fromEntries(
    Object.entries(DNA_TOURNAMENT_COMPONENT_ENV).map(([key, name]) => [key, enabled(env[name])]),
  ) as Record<DnaTournamentComponent, boolean>
  const blockedReasons: string[] = []

  if (requested.reranker && !requested.embedding) {
    requested.reranker = false
    blockedReasons.push("reranker_requires_embedding")
  }
  if ((requested.lunaParsing || requested.lunaRealization || requested.lunaFallback)
      && !enabled(env.DNA_CHAT_LUNA_ENABLED)) {
    requested.lunaParsing = false
    requested.lunaRealization = false
    requested.lunaFallback = false
    blockedReasons.push("luna_components_require_global_luna_switch")
  }

  const mutationStage = !["local_shadow", "production_shadow"].includes(selectedStage)
  if (mutationStage && !humanEvaluationComplete) {
    blockedReasons.push("independent_human_evaluation_pending")
  }
  if (mutationStage && !productionWinner) {
    blockedReasons.push("production_winner_missing")
  }
  if (mutationStage && !releaseAttestationPresent) {
    blockedReasons.push("release_attestation_missing")
  }

  return Object.freeze({
    stage: selectedStage,
    publicAnswerMutationAllowed: mutationStage
      && humanEvaluationComplete
      && Boolean(productionWinner)
      && releaseAttestationPresent,
    legacyFallbackGuaranteed: true,
    humanEvaluationComplete,
    productionWinner,
    releaseAttestationPresent,
    components: Object.freeze({ ...requested }),
    blockedReasons: Object.freeze(blockedReasons),
  })
}

function stableBucket(stableId: string) {
  let hash = 2166136261
  for (const char of stableId) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % 100
}

export function shouldUseDnaTournamentCandidate(input: Readonly<{
  plan: DnaTournamentComponentPlan
  stableAnonymousId: string
  internalAuthorized?: boolean
}>) {
  if (!input.plan.publicAnswerMutationAllowed) return false
  if (input.plan.stage === "local_shadow" || input.plan.stage === "production_shadow") return false
  if (input.plan.stage === "internal") return input.internalAuthorized === true
  const percent = Number(input.plan.stage)
  return Number.isFinite(percent)
    && stableBucket(input.stableAnonymousId) < percent
}

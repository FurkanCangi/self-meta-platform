export const DNA_CHAT_COST_EFFICIENT_MODE_VERSION = "dna-chat-cost-efficient-development@1" as const
export const DNA_CHAT_DEVELOPMENT_DEFAULT_TIER = "TIER_A" as const
export const DNA_CHAT_TIER_B_DEFAULT_HARD_CAP_MICROUSD = 100_000 as const
export const DNA_CHAT_RELEASE_RUN_HARD_CAP_MICROUSD = 350_000 as const

export const DNA_CHAT_TEST_TIERS = Object.freeze({
  TIER_A: Object.freeze({
    providerAllowed: false,
    hardCapMicrousd: 0,
    scope: Object.freeze([
      "routing", "catalog", "science", "facet", "source",
      "deterministic_regression", "static_validators",
    ]),
  }),
  TIER_B: Object.freeze({
    providerAllowed: true,
    hardCapMicrousd: DNA_CHAT_TIER_B_DEFAULT_HARD_CAP_MICROUSD,
    scope: Object.freeze(["small_luna_realization_qa"]),
  }),
  TIER_C: Object.freeze({
    providerAllowed: true,
    requiresExplicitReleaseCheckpoint: true,
    hardCapMicrousd: DNA_CHAT_RELEASE_RUN_HARD_CAP_MICROUSD,
    scope: Object.freeze(["release_or_promotion_certification"]),
  }),
})

export function assertDnaChatDevelopmentProviderPolicy(input: Readonly<{
  tier: keyof typeof DNA_CHAT_TEST_TIERS
  requestedProviderCalls: number
  hardCapMicrousd: number
  explicitReleaseCheckpoint?: boolean
}>) {
  const policy = DNA_CHAT_TEST_TIERS[input.tier]
  if (!policy.providerAllowed && input.requestedProviderCalls > 0) {
    throw new Error("dna_chat_tier_a_provider_call_prohibited")
  }
  if (input.hardCapMicrousd > policy.hardCapMicrousd) {
    throw new Error("dna_chat_cost_policy_hard_cap_exceeded")
  }
  if (input.tier === "TIER_C" && !input.explicitReleaseCheckpoint) {
    throw new Error("dna_chat_tier_c_requires_release_checkpoint")
  }
  return Object.freeze({
    version: DNA_CHAT_COST_EFFICIENT_MODE_VERSION,
    tier: input.tier,
    providerAllowed: policy.providerAllowed,
    hardCapMicrousd: input.hardCapMicrousd,
    accepted: true,
  })
}

export const DNA_CHAT_LUNA_PRICING_VERSION = "gpt-5.6-luna-pricing@2026-08-07" as const

export const DNA_CHAT_LUNA_PRICING = Object.freeze({
  inputUsdPerMillion: 1,
  cachedInputUsdPerMillion: 0.1,
  outputUsdPerMillion: 6,
})

export const DNA_CHAT_LUNA_MONTHLY_LIMITS = Object.freeze({
  interpretation: 9_000,
  polish: 4_000,
})

export type DnaChatLunaStage = keyof typeof DNA_CHAT_LUNA_MONTHLY_LIMITS
export type DnaChatLunaBudgetBand = "normal" | "warning" | "restricted" | "critical" | "exhausted"

export type DnaChatLunaUsage = Readonly<{
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  costMicrousd: number
}>

function nonNegativeInteger(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0
}

/** Integer micro-USD arithmetic avoids floating point drift in operational counters. */
export function calculateDnaChatLunaUsage(input: Readonly<{
  inputTokens: unknown
  cachedInputTokens: unknown
  outputTokens: unknown
}>): DnaChatLunaUsage {
  const inputTokens = nonNegativeInteger(input.inputTokens)
  const cachedInputTokens = Math.min(inputTokens, nonNegativeInteger(input.cachedInputTokens))
  const outputTokens = nonNegativeInteger(input.outputTokens)
  const regularInputTokens = inputTokens - cachedInputTokens
  const costMicrousd = regularInputTokens
    + Math.ceil(cachedInputTokens / 10)
    + outputTokens * 6
  return Object.freeze({ inputTokens, cachedInputTokens, outputTokens, costMicrousd })
}

export function sumDnaChatLunaUsage(values: readonly DnaChatLunaUsage[]): DnaChatLunaUsage {
  return Object.freeze(values.reduce<DnaChatLunaUsage>((total, value) => ({
    inputTokens: total.inputTokens + value.inputTokens,
    cachedInputTokens: total.cachedInputTokens + value.cachedInputTokens,
    outputTokens: total.outputTokens + value.outputTokens,
    costMicrousd: total.costMicrousd + value.costMicrousd,
  }), { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0 }))
}

export function dnaChatLunaBudgetBand(remaining: number, limit: number): DnaChatLunaBudgetBand {
  if (!Number.isFinite(remaining) || !Number.isFinite(limit) || limit <= 0 || remaining <= 0) return "exhausted"
  const usedPercent = ((limit - remaining) / limit) * 100
  if (usedPercent >= 95) return "critical"
  if (usedPercent >= 85) return "restricted"
  if (usedPercent >= 70) return "warning"
  return "normal"
}

export const DNA_CHAT_LUNA_AUDIT_KEYS = Object.freeze([
  "schema_version",
  "request_id",
  "policy_version",
  "pricing_version",
  "model",
  "interpretation_status",
  "polish_status",
  "input_tokens",
  "cached_input_tokens",
  "output_tokens",
  "cost_microusd",
  "budget_band",
] as const)

const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{0,159}$/

export function buildDnaChatLunaAuditMetadata(input: Readonly<{
  requestId: string
  policyVersion: string
  model: string
  interpretationStatus: string
  polishStatus: string
  usage: DnaChatLunaUsage
  budgetBand: DnaChatLunaBudgetBand
}>) {
  const identifiers = [
    input.requestId,
    input.policyVersion,
    input.model,
    input.interpretationStatus,
    input.polishStatus,
    input.budgetBand,
  ]
  if (identifiers.some((value) => !SAFE_ID.test(value))) throw new Error("dna_chat_luna_audit_identifier_invalid")
  for (const value of Object.values(input.usage)) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("dna_chat_luna_audit_usage_invalid")
  }
  return Object.freeze({
    schema_version: "dna-chat-luna-audit@1",
    request_id: input.requestId,
    policy_version: input.policyVersion,
    pricing_version: DNA_CHAT_LUNA_PRICING_VERSION,
    model: input.model,
    interpretation_status: input.interpretationStatus,
    polish_status: input.polishStatus,
    input_tokens: input.usage.inputTokens,
    cached_input_tokens: input.usage.cachedInputTokens,
    output_tokens: input.usage.outputTokens,
    cost_microusd: input.usage.costMicrousd,
    budget_band: input.budgetBand,
  })
}

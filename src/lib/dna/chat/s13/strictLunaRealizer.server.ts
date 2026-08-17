import "server-only"

import { calculateDnaChatLunaUsage } from "../lunaUsage"
import { DNA_CHAT_LUNA_MODEL } from "../lunaPolicy"
import { requestDnaS13StrictRealization } from "./server"
import { hashDnaS13Artifact } from "./strictHash"
import {
  DNA_S13_STRICT_PROMPT_VERSION,
  dnaS13StrictContent,
  dnaS13StrictInstructions,
  dnaS13StrictRealizationSchema,
} from "./strictPrompt"
import {
  DNA_S13_REALIZER_CONTRACT_VERSION,
  type DnaS13RealizerAttempt,
  type DnaS13RealizerIdentity,
  type DnaS13RealizerRequest,
  type Realizer,
} from "./strictRealizer"

export const DNA_S13_LUNA_REALIZER_VERSION = "dna-s13-luna-realizer@1" as const

type FetchLike = typeof fetch

export class LunaRealizer implements Realizer {
  readonly identity: DnaS13RealizerIdentity = Object.freeze({
    provider: "luna",
    model: DNA_CHAT_LUNA_MODEL,
    implementationVersion: DNA_S13_LUNA_REALIZER_VERSION,
  })

  constructor(private readonly options: Readonly<{
    apiKey?: string
    safetyIdentifier?: string | null
    fetchImpl?: FetchLike
  }> = {}) {}

  async realize(input: DnaS13RealizerRequest): Promise<DnaS13RealizerAttempt> {
    const instructions = `${DNA_S13_STRICT_PROMPT_VERSION}. ${dnaS13StrictInstructions(input.validationFailureCodes)}`
    const content = dnaS13StrictContent(input.question, input.plan, input.previousCandidate)
    const schema = dnaS13StrictRealizationSchema(input.plan)
    const prompt = Object.freeze({
      version: DNA_S13_STRICT_PROMPT_VERSION,
      hash: hashDnaS13Artifact({ model: DNA_CHAT_LUNA_MODEL, schema, instructions, content }),
    })
    const started = performance.now()
    const result = await requestDnaS13StrictRealization({
      question: input.question,
      plan: input.plan,
      repairFailureCodes: input.validationFailureCodes,
      previousCandidate: input.previousCandidate,
      safetyIdentifier: this.options.safetyIdentifier,
      apiKey: this.options.apiKey,
      fetchImpl: this.options.fetchImpl,
    })
    const providerUsage = result?.usage ?? { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 }
    const usage = calculateDnaChatLunaUsage(providerUsage)
    return Object.freeze({
      contractVersion: DNA_S13_REALIZER_CONTRACT_VERSION,
      identity: this.identity,
      prompt,
      realization: result?.value ?? null,
      rawOutput: result?.rawOutput ?? null,
      responseId: result?.responseId ?? null,
      usage,
      latencyMs: result?.latencyMs ?? performance.now() - started,
    })
  }
}

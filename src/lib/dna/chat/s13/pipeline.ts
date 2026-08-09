import type { DnaS13QueryFrame, DnaS13Realization, DnaS13RetrievalPackage } from "./contracts"
import { createDnaS13AnswerPlan } from "./planner"
import { validateDnaS13GroundedRealization, type DnaS13ValidationResult } from "./validator"

export const DNA_S13_MAX_CALLS_PER_MESSAGE = 3

export type DnaS13Variant = "S13-A" | "S13-B"
export type DnaS13PipelineResult = Readonly<{
  status: "realized" | "repaired" | "deterministic_fallback"
  frame: DnaS13QueryFrame | null
  retrieval: DnaS13RetrievalPackage | null
  answer: string
  validation: DnaS13ValidationResult | null
  providerCalls: number
  usedS2: boolean
}>

export async function runDnaS13Pipeline(input: Readonly<{
  variant: DnaS13Variant
  deterministicFallback: string
  query: () => Promise<DnaS13QueryFrame | null>
  retrieveS1: (frame: DnaS13QueryFrame) => Promise<DnaS13RetrievalPackage> | DnaS13RetrievalPackage
  retrieveS2: (frame: DnaS13QueryFrame) => Promise<DnaS13RetrievalPackage> | DnaS13RetrievalPackage
  realize: (args: Readonly<{ frame: DnaS13QueryFrame; retrieval: DnaS13RetrievalPackage; repair?: DnaS13ValidationResult; previous?: DnaS13Realization }>) => Promise<DnaS13Realization | null>
}>): Promise<DnaS13PipelineResult> {
  let calls = 1
  const frame = await input.query()
  if (!frame) return { status: "deterministic_fallback", frame: null, retrieval: null, answer: input.deterministicFallback, validation: null, providerCalls: calls, usedS2: false }
  let retrieval = await input.retrieveS1(frame)
  let usedS2 = false
  const needsS2 = input.variant === "S13-B" && (
    retrieval.confidence < 0.617638
    || retrieval.runnerUpMargin < 0.12
    || Boolean(retrieval.ftrlTopicId && retrieval.lexicalTopicId && retrieval.ftrlTopicId !== retrieval.lexicalTopicId)
    || retrieval.slots.some((slot) => slot.answerability === "unsupported")
  )
  if (needsS2) {
    const challenger = await input.retrieveS2(frame)
    const currentIds = new Set(retrieval.claims.map((claim) => claim.id))
    if (challenger.claims.some((claim) => !currentIds.has(claim.id))) {
      retrieval = challenger
      usedS2 = true
    }
  }
  const first = await input.realize({ frame, retrieval })
  calls += 1
  if (!first) return { status: "deterministic_fallback", frame, retrieval, answer: input.deterministicFallback, validation: null, providerCalls: calls, usedS2 }
  const validation = validateDnaS13GroundedRealization({ realization: first, claims: retrieval.claims, slots: retrieval.slots })
  if (validation.pass) return { status: "realized", frame, retrieval, answer: first.answer, validation, providerCalls: calls, usedS2 }
  if (calls >= DNA_S13_MAX_CALLS_PER_MESSAGE) return { status: "deterministic_fallback", frame, retrieval, answer: input.deterministicFallback, validation, providerCalls: calls, usedS2 }
  const repaired = await input.realize({ frame, retrieval, repair: validation, previous: first })
  calls += 1
  if (!repaired) return { status: "deterministic_fallback", frame, retrieval, answer: input.deterministicFallback, validation, providerCalls: calls, usedS2 }
  const repairedValidation = validateDnaS13GroundedRealization({ realization: repaired, claims: retrieval.claims, slots: retrieval.slots })
  if (!repairedValidation.pass) return { status: "deterministic_fallback", frame, retrieval, answer: input.deterministicFallback, validation: repairedValidation, providerCalls: calls, usedS2 }
  return { status: "repaired", frame, retrieval, answer: repaired.answer, validation: repairedValidation, providerCalls: calls, usedS2 }
}

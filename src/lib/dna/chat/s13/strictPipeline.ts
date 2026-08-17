import type { DnaS13StrictPlan, DnaS13StrictRealization } from "./strictContracts"
import { dnaS13HasPresentationModifier } from "./pragmaticTask"
import { createDnaS13DeterministicRealization } from "./strictRealizer"
import { validateDnaS13StrictGrounding, type DnaS13StrictValidation } from "./strictValidator"

export type DnaS13StrictPipelineResult = Readonly<{
  status: "realized" | "repaired" | "deterministic_fallback"
  answer: string
  plan: DnaS13StrictPlan
  realization: DnaS13StrictRealization
  finalValidation: DnaS13StrictValidation
  rejectedAttemptValidations: readonly DnaS13StrictValidation[]
  /** @deprecated Use finalValidation. */
  validation: DnaS13StrictValidation
  /** @deprecated Use rejectedAttemptValidations. */
  rejectedValidations: readonly DnaS13StrictValidation[]
  providerCalls: number
}>

function compose(realization: DnaS13StrictRealization) {
  return realization.slotRealizations.map((slot) => slot.text.trim()).filter(Boolean).join("\n\n")
}

function result(input: Readonly<{
  status: DnaS13StrictPipelineResult["status"]
  plan: DnaS13StrictPlan
  realization: DnaS13StrictRealization
  finalValidation: DnaS13StrictValidation
  rejectedAttemptValidations: readonly DnaS13StrictValidation[]
  providerCalls: number
}>): DnaS13StrictPipelineResult {
  const rejected = Object.freeze([...input.rejectedAttemptValidations])
  return Object.freeze({
    status: input.status,
    answer: compose(input.realization),
    plan: input.plan,
    realization: input.realization,
    finalValidation: input.finalValidation,
    rejectedAttemptValidations: rejected,
    validation: input.finalValidation,
    rejectedValidations: rejected,
    providerCalls: input.providerCalls,
  })
}

export async function runDnaS13StrictPipeline(input: Readonly<{
  plan: DnaS13StrictPlan
  realize: (args: Readonly<{ repair?: DnaS13StrictValidation; previous?: DnaS13StrictRealization }>) => Promise<DnaS13StrictRealization | null>
}>): Promise<DnaS13StrictPipelineResult> {
  const fallbackRealization = createDnaS13DeterministicRealization(input.plan)
  const fallbackValidation = validateDnaS13StrictGrounding({
    plan: input.plan,
    realization: fallbackRealization,
    allowUntransformedSimplifyFallback: dnaS13HasPresentationModifier(input.plan.pragmaticTaskFrame, "SIMPLIFY"),
  })
  if (!fallbackValidation.pass) throw new Error(`dna_s13_strict_fallback_invalid:${fallbackValidation.failureCodes.join(",")}`)
  const first = await input.realize({})
  if (!first) return result({ status: "deterministic_fallback", plan: input.plan, realization: fallbackRealization, finalValidation: fallbackValidation, rejectedAttemptValidations: [], providerCalls: 1 })
  const firstValidation = validateDnaS13StrictGrounding({ plan: input.plan, realization: first })
  if (firstValidation.pass) return result({ status: "realized", plan: input.plan, realization: first, finalValidation: firstValidation, rejectedAttemptValidations: [], providerCalls: 1 })
  const repaired = await input.realize({ repair: firstValidation, previous: first })
  if (repaired) {
    const repairedValidation = validateDnaS13StrictGrounding({ plan: input.plan, realization: repaired })
    if (repairedValidation.pass) return result({ status: "repaired", plan: input.plan, realization: repaired, finalValidation: repairedValidation, rejectedAttemptValidations: [firstValidation], providerCalls: 2 })
    return result({ status: "deterministic_fallback", plan: input.plan, realization: fallbackRealization, finalValidation: fallbackValidation, rejectedAttemptValidations: [firstValidation, repairedValidation], providerCalls: 2 })
  }
  return result({ status: "deterministic_fallback", plan: input.plan, realization: fallbackRealization, finalValidation: fallbackValidation, rejectedAttemptValidations: [firstValidation], providerCalls: 2 })
}

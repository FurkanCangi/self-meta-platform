import type {
  DnaS13CanaryFeedbackRecord,
  DnaS13CanaryMessageRecord,
  DnaS13CanaryTrainingAnnotation,
} from "./contracts"

export const DNA_S13_CANARY_SUMMARY_VERSION = "dna-s13-internal-canary-summary@1" as const

function percentile(values: readonly number[], fraction: number) {
  if (!values.length) return 0
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))] ?? 0
}

function rate(numerator: number, denominator: number) {
  return denominator ? Number((numerator / denominator).toFixed(6)) : 0
}

function latestFeedbackByMessage(feedback: readonly DnaS13CanaryFeedbackRecord[]) {
  const latest = new Map<string, DnaS13CanaryFeedbackRecord>()
  for (const row of [...feedback].sort((left, right) => left.createdAt.localeCompare(right.createdAt))) {
    latest.set(row.messageId, row)
  }
  return latest
}

export function summarizeDnaS13Canary(input: Readonly<{
  sessionId: string
  messages: readonly DnaS13CanaryMessageRecord[]
  feedback: readonly DnaS13CanaryFeedbackRecord[]
  trainingAnnotations?: readonly DnaS13CanaryTrainingAnnotation[]
  privacyRejectionCount?: number
  generatedAt?: string
}>) {
  const feedbackByMessage = latestFeedbackByMessage(input.feedback)
  const reviewed = input.messages.flatMap((message) => {
    const feedback = feedbackByMessage.get(message.messageId)
    return feedback ? [{ message, feedback }] : []
  })
  const total = input.messages.length
  const lunaCalls = input.messages.reduce((sum, row) => sum + row.realization.lunaCalls, 0)
  const repairCalls = input.messages.reduce((sum, row) => sum + row.realization.repairCalls, 0)
  const totalTokens = input.messages.reduce((sum, row) =>
    sum + row.realization.inputTokens + row.realization.outputTokens, 0)
  const cachedTokens = input.messages.reduce((sum, row) => sum + row.realization.cachedInputTokens, 0)
  const costMicrousd = input.messages.reduce((sum, row) => sum + row.realization.costMicrousd, 0)
  const validatorPassed = input.messages.filter((row) => row.validation.pass).length
  const comparisonMessages = input.messages.filter((row) => row.routing.questionType.includes("comparison"))
  const twoPartMessages = input.messages.filter((row) => row.routing.subquestionCount === 2)
  const comparisonComplete = comparisonMessages.filter((row) =>
    row.retrieval.comparisonSideACovered === true
      && row.retrieval.comparisonSideBCovered === true
      && row.validation.comparisonConclusionViolation === 0,
  ).length
  const requiredSlotsComplete = input.messages.filter((row) => row.retrieval.missingRequiredSlotIds.length === 0).length
  const latestTrainingByMessage = new Map<string, DnaS13CanaryTrainingAnnotation>()
  for (const row of [...(input.trainingAnnotations ?? [])].sort((left, right) => left.createdAt.localeCompare(right.createdAt))) {
    latestTrainingByMessage.set(row.messageId, row)
  }
  const trainingCandidates = [...latestTrainingByMessage.values()].filter((row) => row.training_candidate).length
  const inputTokens = input.messages.reduce((sum, row) => sum + row.realization.inputTokens, 0)
  const outputTokens = input.messages.reduce((sum, row) => sum + row.realization.outputTokens, 0)
  const labels = Object.fromEntries([...new Set(input.feedback.map((row) => row.label))]
    .map((label) => [label, input.feedback.filter((row) => row.label === label).length]))
  const lunaValue = Object.fromEntries([...new Set(input.feedback.map((row) => row.lunaValue).filter(Boolean))]
    .map((label) => [label, input.feedback.filter((row) => row.lunaValue === label).length]))

  return Object.freeze({
    schemaVersion: DNA_S13_CANARY_SUMMARY_VERSION,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    sessionId: input.sessionId,
    scope: Object.freeze({
      internalCanaryOnly: true,
      naturalTrafficStarted: total > 0,
      productionAffected: false,
      runtimeEligible: false,
      releaseEligible: false,
      benchmarkTuningAllowed: false,
    }),
    volume: Object.freeze({
      messages: total,
      reviewedMessages: reviewed.length,
      privacyRejections: input.privacyRejectionCount ?? 0,
      trainingCandidates,
    }),
    safety: Object.freeze({
      validatorPassRate: rate(validatorPassed, total),
      wrongClaimSubstitution: input.messages.reduce((sum, row) => sum + row.validation.wrongClaimSubstitution, 0),
      unsupportedAddition: input.messages.reduce((sum, row) => sum + row.validation.unsupportedAddition, 0),
      unsupportedRelation: input.messages.reduce((sum, row) => sum + row.validation.relationViolation, 0),
      comparisonConclusionViolation: input.messages.reduce((sum, row) => sum + row.validation.comparisonConclusionViolation, 0),
      sourceViolation: input.messages.reduce((sum, row) => sum + row.validation.sourceViolation, 0),
      safetyViolation: input.messages.reduce((sum, row) => sum + row.validation.safetyViolation, 0),
    }),
    completeness: Object.freeze({
      requiredSlotCoverageRate: rate(requiredSlotsComplete, total),
      twoSubquestionSuccessRate: rate(twoPartMessages.filter((row) =>
        row.validation.pass && row.retrieval.missingRequiredSlotIds.length === 0).length, twoPartMessages.length),
      comparisonCompletionRate: rate(comparisonComplete, comparisonMessages.length),
      followUpResolutionRate: rate(reviewed.filter(({ message, feedback }) =>
        message.routing.followUp && feedback.label !== "FOLLOWUP_FAILURE").length,
      reviewed.filter(({ message }) => message.routing.followUp).length),
    }),
    userExperience: Object.freeze({
      goodRate: rate(reviewed.filter(({ feedback }) => feedback.label === "GOOD").length, reviewed.length),
      wrongTopicRate: rate(reviewed.filter(({ feedback }) => feedback.label === "WRONG_TOPIC").length, reviewed.length),
      incompleteRate: rate(reviewed.filter(({ feedback }) => feedback.label === "INCOMPLETE").length, reviewed.length),
      unnecessaryAbstentionRate: rate(reviewed.filter(({ feedback }) => feedback.label === "UNNECESSARY_ABSTENTION").length, reviewed.length),
      unnaturalTurkishRate: rate(reviewed.filter(({ feedback }) => feedback.label === "UNNATURAL_TURKISH").length, reviewed.length),
      fallbackRate: rate(input.messages.filter((row) => row.realization.status === "deterministic_fallback").length, total),
      repairRate: rate(input.messages.filter((row) => row.realization.status === "repaired").length, total),
      labels: Object.freeze(labels),
      lunaValue: Object.freeze(lunaValue),
    }),
    operations: Object.freeze({
      p50LatencyMs: percentile(input.messages.map((row) => row.realization.latencyMs), 0.5),
      p95LatencyMs: percentile(input.messages.map((row) => row.realization.latencyMs), 0.95),
      lunaCalls,
      repairCalls,
      deterministicOnlyMessages: input.messages.filter((row) => row.realization.provider === "deterministic").length,
      messagesPerLunaCall: lunaCalls ? Number((total / lunaCalls).toFixed(6)) : 0,
      lunaCallRate: rate(lunaCalls, total),
      repairCallRate: rate(repairCalls, total),
      totalTokens,
      inputTokens,
      outputTokens,
      cachedInputTokens: cachedTokens,
      tokensPerMessage: total ? Number((totalTokens / total).toFixed(3)) : 0,
    }),
    cost: Object.freeze({
      totalMicrousd: costMicrousd,
      usdPerMessage: total ? Number((costMicrousd / 1_000_000 / total).toFixed(8)) : 0,
      projectedUsdPer1kMessages: total ? Number((costMicrousd / 1_000_000 / total * 1_000).toFixed(4)) : 0,
      projectedUsdPer10kMessages: total ? Number((costMicrousd / 1_000_000 / total * 10_000).toFixed(4)) : 0,
      projectedUsdPer100kMessages: total ? Number((costMicrousd / 1_000_000 / total * 100_000).toFixed(4)) : 0,
    }),
  })
}

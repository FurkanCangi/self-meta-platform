import { getDnaS13LimitedRolloutReleaseCandidate } from "./release"
import {
  DNA_S13_LIMITED_FEEDBACK_REASONS,
  type DnaS13LimitedFeedbackRecord,
} from "./feedback"

export const DNA_S13_LIMITED_TELEMETRY_VERSION = "dna-s13-limited-rollout-telemetry@1" as const
export const DNA_S13_LIMITED_READOUT_VERSION = "dna-s13-limited-rollout-readout@1" as const

export type DnaS13LimitedTelemetryRecord = Readonly<{
  schemaVersion: typeof DNA_S13_LIMITED_TELEMETRY_VERSION
  releaseVersion: string
  releaseHash: string
  requestId: string
  createdAt: string
  subjectIdHash: string
  conversationIdHash: string
  rolloutPhase: "L0" | "L1" | "L2" | "L3"
  routing: Readonly<{
    intents: readonly string[]
    topicIds: readonly string[]
    questionTypes: readonly string[]
    operation: string
    followUp: boolean
    correction: boolean
    contextInherited: boolean
    parserUncertainty: boolean
  }>
  retrieval: Readonly<{
    candidateCount: number
    requiredSlotCount: number
    missingRequiredSlotCount: number
    requestedSlotCount: number
    answeredSupportedSlotCount: number
    answeredUnsupportedSlotCount: number
    silentlyDroppedRequestedSlotCount: number
    requiredClaimCount: number
    explanatoryClaimCount: number
    comparisonSideASupported: boolean | null
    comparisonSideBSupported: boolean | null
  }>
  realization: Readonly<{
    provider: "luna" | "local" | "deterministic" | "none"
    status: "accepted" | "repaired" | "rejected" | "fallback" | "privacy_blocked" | "cost_guardrail"
    lunaCalls: number
    repairCalls: number
    inputTokens: number
    cachedInputTokens: number
    outputTokens: number
    costMicrousd: number
    abstained: boolean
  }>
  validation: Readonly<{
    pass: boolean
    failureCodes: readonly string[]
    unsupportedFactCount: number
    unsupportedRelationCount: number
    sourceViolationCount: number
    safetyViolationCount: number
    comparisonConclusionViolationCount: number
  }>
  latency: Readonly<{
    totalMs: number
    retrievalMs: number
    lunaMs: number
    validatorMs: number
  }>
  privacy: Readonly<{
    allowed: boolean
    category: string
    reasonCodes: readonly string[]
    questionHash: string
    rawPromptStored: false
    maySourceConversationContext: boolean
  }>
  knowledgeGaps?: readonly Readonly<{
    questionHash: string
    topicId: string
    pragmaticAction: string
    requestedFacet: string
    availableClaimIds: readonly string[]
    missingEvidenceType: string
    classification: "AVAILABLE_BUT_NOT_SELECTED" | "CATALOG_GAP"
  }>[]
  crossAccountViolationCount: number
  automaticTrainingUse: "prohibited"
  trainingCandidate: false
}>

const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const HASH = /^[a-f0-9]{64}$/u
const SAFE_CODE = /^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{0,159}$/u
const DENIED_KEYS = new Set([
  "question", "answer", "prompt", "rawPrompt", "rawOutput", "reportId", "reportText",
  "clientId", "clientCode", "patient", "child", "anamnesis", "sessionNote", "name", "email",
  "userId", "ipAddress", "personalData", "previousConversation", "lockedPlan", "approvedClaims",
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function deniedDeepKey(value: unknown): string | null {
  if (!value || typeof value !== "object") return null
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = deniedDeepKey(item)
      if (nested) return nested
    }
    return null
  }
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (DENIED_KEYS.has(key)) return key
    const nested = deniedDeepKey(nestedValue)
    if (nested) return nested
  }
  return null
}

function safeCodes(value: unknown, maximum: number): value is readonly string[] {
  return Array.isArray(value)
    && value.length <= maximum
    && value.every((item) => typeof item === "string" && SAFE_CODE.test(item))
}

function finiteNonNegative(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
}

export function validateDnaS13LimitedTelemetryRecord(input: unknown): DnaS13LimitedTelemetryRecord | null {
  if (!isRecord(input) || deniedDeepKey(input)) return null
  const row = input as unknown as DnaS13LimitedTelemetryRecord
  const release = getDnaS13LimitedRolloutReleaseCandidate()
  if (row.schemaVersion !== DNA_S13_LIMITED_TELEMETRY_VERSION
    || row.releaseVersion !== release.releaseVersion
    || row.releaseHash !== release.releaseHash
    || !REQUEST_ID.test(row.requestId)
    || !HASH.test(row.subjectIdHash)
    || !HASH.test(row.conversationIdHash)
    || !["L0", "L1", "L2", "L3"].includes(row.rolloutPhase)) return null
  if (!isRecord(row.routing)
    || !safeCodes(row.routing.intents, 2)
    || !safeCodes(row.routing.topicIds, 2)
    || !safeCodes(row.routing.questionTypes, 2)
    || typeof row.routing.operation !== "string"
    || !SAFE_CODE.test(row.routing.operation)
    || [row.routing.followUp, row.routing.correction, row.routing.contextInherited, row.routing.parserUncertainty]
      .some((value) => typeof value !== "boolean")) return null
  if (!isRecord(row.retrieval)
    || [row.retrieval.candidateCount, row.retrieval.requiredSlotCount, row.retrieval.missingRequiredSlotCount,
      row.retrieval.requestedSlotCount, row.retrieval.answeredSupportedSlotCount,
      row.retrieval.answeredUnsupportedSlotCount, row.retrieval.silentlyDroppedRequestedSlotCount,
      row.retrieval.requiredClaimCount, row.retrieval.explanatoryClaimCount].some((value) => !finiteNonNegative(value))) return null
  if (!isRecord(row.realization)
    || !["luna", "local", "deterministic", "none"].includes(row.realization.provider)
    || !["accepted", "repaired", "rejected", "fallback", "privacy_blocked", "cost_guardrail"].includes(row.realization.status)
    || [row.realization.lunaCalls, row.realization.repairCalls, row.realization.inputTokens,
      row.realization.cachedInputTokens, row.realization.outputTokens, row.realization.costMicrousd]
      .some((value) => !finiteNonNegative(value))
    || typeof row.realization.abstained !== "boolean") return null
  if (!isRecord(row.validation)
    || typeof row.validation.pass !== "boolean"
    || !safeCodes(row.validation.failureCodes, 32)
    || [row.validation.unsupportedFactCount, row.validation.unsupportedRelationCount,
      row.validation.sourceViolationCount, row.validation.safetyViolationCount,
      row.validation.comparisonConclusionViolationCount].some((value) => !finiteNonNegative(value))) return null
  if (!isRecord(row.latency)
    || [row.latency.totalMs, row.latency.retrievalMs, row.latency.lunaMs, row.latency.validatorMs]
      .some((value) => !finiteNonNegative(value))) return null
  if (!isRecord(row.privacy)
    || typeof row.privacy.allowed !== "boolean"
    || typeof row.privacy.category !== "string"
    || !SAFE_CODE.test(row.privacy.category)
    || !safeCodes(row.privacy.reasonCodes, 16)
    || !HASH.test(row.privacy.questionHash)
    || row.privacy.rawPromptStored !== false
    || typeof row.privacy.maySourceConversationContext !== "boolean") return null
  if (row.knowledgeGaps !== undefined && (!Array.isArray(row.knowledgeGaps)
    || row.knowledgeGaps.length > 12
    || row.knowledgeGaps.some((gap) => !isRecord(gap)
      || typeof gap.questionHash !== "string" || !HASH.test(gap.questionHash)
      || typeof gap.topicId !== "string" || !SAFE_CODE.test(gap.topicId)
      || typeof gap.pragmaticAction !== "string" || !SAFE_CODE.test(gap.pragmaticAction)
      || typeof gap.requestedFacet !== "string" || !SAFE_CODE.test(gap.requestedFacet)
      || !safeCodes(gap.availableClaimIds, 24)
      || typeof gap.missingEvidenceType !== "string" || !SAFE_CODE.test(gap.missingEvidenceType)
      || typeof gap.classification !== "string"
      || !["AVAILABLE_BUT_NOT_SELECTED", "CATALOG_GAP"].includes(gap.classification)))) return null
  if (!finiteNonNegative(row.crossAccountViolationCount)
    || row.automaticTrainingUse !== "prohibited"
    || row.trainingCandidate !== false) return null
  return Object.freeze(row)
}

export const DNA_S13_LIMITED_MONITORING_THRESHOLDS = Object.freeze({
  immediateStop: Object.freeze({
    privacyLeak: 0,
    crossAccountLeak: 0,
    unsupportedFact: 0,
    unsupportedRelation: 0,
    sourceViolation: 0,
    criticalSafetyViolation: 0,
  }),
  investigate: Object.freeze({
    followUpSuccessPercentBelow: 90,
    correctionSuccessPercentBelow: 90,
    comparisonSuccessPercentBelow: 90,
    unnecessaryAbstentionPercentAbove: 10,
    missingSlotPercentAbove: 10,
    wrongTopicPercentAbove: 5,
    fallbackPercentAbove: 8,
  }),
})

function percentile(values: readonly number[], fraction: number) {
  if (!values.length) return 0
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))] ?? 0
}

function percent(numerator: number, denominator: number) {
  return denominator ? Number((numerator / denominator * 100).toFixed(3)) : 100
}

export function evaluateDnaS13LimitedBudget(input: Readonly<{
  spentMicrousd: number
  capMicrousd: number
  nearCapPercent: number
  maximumNextMessageMicrousd?: number
}>) {
  const spent = Math.max(0, input.spentMicrousd)
  const cap = Math.max(0, input.capMicrousd)
  const reservation = Math.max(0, input.maximumNextMessageMicrousd ?? 25_000)
  const utilizationPercent = cap ? Number((spent / cap * 100).toFixed(3)) : 100
  const exhausted = cap <= 0 || spent >= cap || spent + reservation > cap
  return Object.freeze({
    allowed: !exhausted,
    exhausted,
    nearCap: utilizationPercent >= input.nearCapPercent,
    spentMicrousd: spent,
    capMicrousd: cap,
    remainingMicrousd: Math.max(0, cap - spent),
    utilizationPercent,
    action: exhausted ? "fail_closed_deterministic" as const
      : utilizationPercent >= input.nearCapPercent ? "alert_near_cap" as const : "continue" as const,
  })
}

export function summarizeDnaS13LimitedRollout(input: Readonly<{
  messages: readonly DnaS13LimitedTelemetryRecord[]
  feedback: readonly DnaS13LimitedFeedbackRecord[]
  dailyCapMicrousd: number
  generatedAt?: string
}>) {
  const messages = input.messages
  const feedback = input.feedback
  const count = messages.length
  const requiredSlots = messages.reduce((sum, row) => sum + row.retrieval.requiredSlotCount, 0)
  const missingSlots = messages.reduce((sum, row) => sum + row.retrieval.missingRequiredSlotCount, 0)
  const silentlyDroppedRequestedSlots = messages.reduce((sum, row) =>
    sum + row.retrieval.silentlyDroppedRequestedSlotCount, 0)
  const followups = messages.filter((row) => row.routing.followUp)
  const corrections = messages.filter((row) => row.routing.correction)
  const comparisons = messages.filter((row) => row.routing.questionTypes.includes("comparison"))
  const feedbackByRequest = new Map(feedback.map((row) => [row.requestId, row]))
  const unnecessaryAbstentions = messages.filter((row) =>
    row.realization.abstained && feedbackByRequest.get(row.requestId)?.reason === "incomplete").length
  const wrongTopics = feedback.filter((row) => row.reason === "misunderstood").length
  const costMicrousd = messages.reduce((sum, row) => sum + row.realization.costMicrousd, 0)
  const activeUsers = new Set(messages.map((row) => row.subjectIdHash)).size
  const conversations = new Set(messages.map((row) => row.conversationIdHash)).size
  const unsupportedFact = messages.reduce((sum, row) => sum + row.validation.unsupportedFactCount, 0)
  const unsupportedRelation = messages.reduce((sum, row) => sum + row.validation.unsupportedRelationCount, 0)
  const sourceViolation = messages.reduce((sum, row) => sum + row.validation.sourceViolationCount, 0)
  const safetyViolation = messages.reduce((sum, row) => sum + row.validation.safetyViolationCount, 0)
  const privacyLeak = messages.filter((row) => !row.privacy.allowed && row.realization.provider === "luna").length
  const crossAccountLeak = messages.reduce((sum, row) => sum + row.crossAccountViolationCount, 0)
  const fallback = messages.filter((row) => ["fallback", "cost_guardrail"].includes(row.realization.status)).length
  const metrics = Object.freeze({
    followUpSuccessPercent: percent(followups.filter((row) => row.validation.pass).length, followups.length),
    correctionSuccessPercent: percent(corrections.filter((row) => row.validation.pass).length, corrections.length),
    comparisonSuccessPercent: percent(comparisons.filter((row) => row.validation.pass
      && row.retrieval.comparisonSideASupported !== false
      && row.retrieval.comparisonSideBSupported !== false).length, comparisons.length),
    unnecessaryAbstentionPercent: percent(unnecessaryAbstentions, count),
    missingSlotPercent: percent(missingSlots, requiredSlots),
    silentlyDroppedRequestedSlotCount: silentlyDroppedRequestedSlots,
    wrongTopicPercent: percent(wrongTopics, feedback.length),
    fallbackPercent: percent(fallback, count),
  })
  const immediateStopReasons = [
    ...(privacyLeak > 0 ? ["privacy_leak"] : []),
    ...(crossAccountLeak > 0 ? ["cross_account_leak"] : []),
    ...(unsupportedFact > 0 ? ["unsupported_fact"] : []),
    ...(unsupportedRelation > 0 ? ["unsupported_relation"] : []),
    ...(sourceViolation > 0 ? ["source_violation"] : []),
    ...(safetyViolation > 0 ? ["critical_safety_violation"] : []),
  ]
  const investigateReasons = [
    ...(metrics.followUpSuccessPercent < 90 ? ["follow_up_below_90"] : []),
    ...(metrics.correctionSuccessPercent < 90 ? ["correction_below_90"] : []),
    ...(metrics.comparisonSuccessPercent < 90 ? ["comparison_below_90"] : []),
    ...(metrics.unnecessaryAbstentionPercent > 10 ? ["unnecessary_abstention_above_10"] : []),
    ...(metrics.missingSlotPercent > 10 ? ["missing_slot_above_10"] : []),
    ...(metrics.wrongTopicPercent > 5 ? ["wrong_topic_above_5"] : []),
    ...(metrics.fallbackPercent > 8 ? ["fallback_above_8"] : []),
  ]
  const latencyFor = (key: keyof DnaS13LimitedTelemetryRecord["latency"]) => Object.freeze({
    p50Ms: percentile(messages.map((row) => row.latency[key]), 0.5),
    p95Ms: percentile(messages.map((row) => row.latency[key]), 0.95),
  })
  const budget = evaluateDnaS13LimitedBudget({
    spentMicrousd: costMicrousd,
    capMicrousd: input.dailyCapMicrousd,
    nearCapPercent: 80,
    maximumNextMessageMicrousd: 0,
  })
  return Object.freeze({
    schemaVersion: DNA_S13_LIMITED_READOUT_VERSION,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    scope: Object.freeze({ limitedRolloutOnly: true, productionWideRelease: false, trainingEnabled: false }),
    volume: Object.freeze({ activeUsers, conversations, messages: count, feedback: feedback.length }),
    routing: Object.freeze({
      topics: Object.freeze(Object.fromEntries([...new Set(messages.flatMap((row) => row.routing.topicIds))]
        .map((topicId) => [topicId, messages.filter((row) => row.routing.topicIds.includes(topicId)).length]))),
      operations: Object.freeze(Object.fromEntries([...new Set(messages.map((row) => row.routing.operation))]
        .map((operation) => [operation, messages.filter((row) => row.routing.operation === operation).length]))),
      followUps: followups.length,
      corrections: corrections.length,
    }),
    quality: Object.freeze({
      ...metrics,
      validatorPassPercent: percent(messages.filter((row) => row.validation.pass).length, count),
      requiredSlotCoveragePercent: percent(requiredSlots - missingSlots, requiredSlots),
      unsupportedFact,
      unsupportedRelation,
      sourceViolation,
      safetyViolation,
      privacyLeak,
      crossAccountLeak,
    }),
    realization: Object.freeze({
      accepted: messages.filter((row) => row.realization.status === "accepted").length,
      repaired: messages.filter((row) => row.realization.status === "repaired").length,
      rejected: messages.filter((row) => row.realization.status === "rejected").length,
      fallback,
      abstained: messages.filter((row) => row.realization.abstained).length,
      lunaCalls: messages.reduce((sum, row) => sum + row.realization.lunaCalls, 0),
      repairCalls: messages.reduce((sum, row) => sum + row.realization.repairCalls, 0),
      inputTokens: messages.reduce((sum, row) => sum + row.realization.inputTokens, 0),
      cachedInputTokens: messages.reduce((sum, row) => sum + row.realization.cachedInputTokens, 0),
      outputTokens: messages.reduce((sum, row) => sum + row.realization.outputTokens, 0),
    }),
    latency: Object.freeze({
      total: latencyFor("totalMs"),
      retrieval: latencyFor("retrievalMs"),
      luna: latencyFor("lunaMs"),
      validator: latencyFor("validatorMs"),
    }),
    cost: Object.freeze({
      totalMicrousd: costMicrousd,
      usdPerActiveUser: activeUsers ? Number((costMicrousd / 1_000_000 / activeUsers).toFixed(8)) : 0,
      usdPerConversation: conversations ? Number((costMicrousd / 1_000_000 / conversations).toFixed(8)) : 0,
      usdPerMessage: count ? Number((costMicrousd / 1_000_000 / count).toFixed(8)) : 0,
      projectedMonthlyAiUsdPerActiveUser: activeUsers
        ? Number((costMicrousd / 1_000_000 / activeUsers * 30).toFixed(4)) : 0,
      targetAiVariableUsdPerActiveUser: Object.freeze({ preferredMinimum: 0.75, preferredMaximum: 1 }),
      targetTotalInfrastructureUsdPerActiveUserMaximum: 2,
      dailyBudget: budget,
    }),
    feedback: Object.freeze({
      thumbsUp: feedback.filter((row) => row.vote === "up").length,
      thumbsDown: feedback.filter((row) => row.vote === "down").length,
      reasons: Object.freeze(Object.fromEntries(DNA_S13_LIMITED_FEEDBACK_REASONS.map((reason) => [
        reason,
        feedback.filter((row) => row.reason === reason).length,
      ]))),
    }),
    alerts: Object.freeze({
      recommendation: immediateStopReasons.length ? "STOP" as const
        : investigateReasons.length ? "INVESTIGATE" as const : "CONTINUE" as const,
      immediateStopReasons: Object.freeze(immediateStopReasons),
      investigateReasons: Object.freeze(investigateReasons),
    }),
  })
}

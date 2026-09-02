import "server-only"

import {
  requestDnaS13StructuredOutputDetailed,
  type DnaS13ProviderFailure,
  type DnaS13ProviderUsage,
} from "../s13/server"
import { normalizeDnaChatText } from "../text"
import type { StudentRequestContract } from "./contracts"
import {
  buildStudentAnswerExecutionPlan,
  type StudentAnswerExecutionPlan,
} from "./answerExecution"

export const DNA_STUDENT_ANSWER_EXECUTOR_VERSION = "dna-student-answer-executor@2" as const
export const DNA_STUDENT_ANSWER_EXECUTOR_TIMEOUT_MS = 20_000
export const DNA_STUDENT_ANSWER_EXECUTOR_MAX_PROVIDER_CALLS = 1

export const DNA_STUDENT_ANSWER_FAILURE_CODES = Object.freeze([
  "answer_missing",
  "target_coverage_mismatch",
  "obligation_coverage_mismatch",
  "policy_coverage_mismatch",
  "claim_outside_locked_evidence",
  "target_without_locked_claim",
  "example_not_identified",
  "sentence_count_mismatch",
  "internal_contract_leak",
  "duplicate_contract_reference",
  "target_not_visible",
  "obligation_not_visible",
] as const)

export type StudentAnswerFailureCode = typeof DNA_STUDENT_ANSWER_FAILURE_CODES[number]

export type StudentAnswerCandidate = Readonly<{
  answer: string
  addressedTargetIds: readonly string[]
  obligationSupport: readonly Readonly<{
    obligationId: string
    visibleText: string
  }>[]
  usedClaimIds: readonly string[]
  usedPolicyUnitIds: readonly string[]
  illustrationKind: "none" | "user_supplied" | "hypothetical"
}>

export type StudentAnswerExecutorResult =
  | Readonly<{
      ok: true
      answer: string
      candidate: StudentAnswerCandidate
      plan: StudentAnswerExecutionPlan
      route: StudentAnswerExecutionPlan["executionRoute"]
      provider: Readonly<{
        calls: number
        responseId: string | null
        usage: DnaS13ProviderUsage
        latencyMs: number
        rawOutputStored: false
      }>
    }>
  | Readonly<{
      ok: false
      reason: "provider_failure"
      failure: DnaS13ProviderFailure
      plan: StudentAnswerExecutionPlan
      provider: StudentAnswerProviderTelemetry
    }>
  | Readonly<{
      ok: false
      reason: "candidate_invalid"
      failureCodes: readonly StudentAnswerFailureCode[]
      plan: StudentAnswerExecutionPlan
      provider: StudentAnswerProviderTelemetry
    }>

type StudentAnswerProviderTelemetry = Readonly<{
  calls: number
  responseId: string | null
  usage: DnaS13ProviderUsage
  latencyMs: number
  rawOutputStored: false
}>

const ZERO_USAGE: DnaS13ProviderUsage = Object.freeze({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 })
const INTERNAL_LANGUAGE = /\b(?:claim(?:id)?|passage(?:id)?|topic(?:id)?|obligation(?:id)?|locked evidence|kilitli kanit|kanıt paketi|policy unit|schema|json)\b/iu

function unique(values: readonly string[]) {
  return [...new Set(values)]
}

function sameSet(left: readonly string[], right: readonly string[]) {
  const a = unique(left).sort()
  const b = unique(right).sort()
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function hasDuplicates(values: readonly string[]) {
  return new Set(values).size !== values.length
}

function sentenceCount(answer: string) {
  return answer.split(/(?<=[.!?])\s+/u).map((value) => value.trim()).filter(Boolean).length
}

function visibleObligation(kind: StudentRequestContract["obligations"][number]["kind"], normalized: string) {
  if (kind === "state_single_observation_limit") return /\b(?:tek\s+(?:bir\s+)?(?:gozlem|davranis)|yalnizca\s+bu\s+durum)\b/u.test(normalized)
    && /\b(?:yeterli\s+degil|karar\w*|kesin\w*|gostermez\w*|cikarilamaz\w*)\b/u.test(normalized)
  if (kind === "name_additional_context") return /\b(?:farkli\s+(?:zaman|ortam|gorev)|oncesi\w*\s+(?:ve|ile)\s+sonrasi\w*|destek\w*\s+nasil\s+degis)\b/u.test(normalized)
  if (kind === "summarize_unknown") return /\b(?:bilin\w*|kesin\w*|soyle\w*|cikarilamaz\w*|sonuc\w*\s+vermez)\b/u.test(normalized)
  if (kind === "summarize_observation_focus") return /\bgozlem\w*\b/u.test(normalized)
  if (kind === "refuse_treatment_selection") return /\b(?:terapi|tedavi)\w*\b.{0,80}\b(?:sec\w*|oner\w*|uygula\w*)\b/u.test(normalized)
  if (kind === "offer_safe_assessment_frame") return /\b(?:degerlendirme\w*|farkli\s+ortam\w*|gozlem\w*)\b/u.test(normalized)
  return true
}

export function validateStudentAnswerCandidate(input: Readonly<{
  candidate: StudentAnswerCandidate
  plan: StudentAnswerExecutionPlan
}>): readonly StudentAnswerFailureCode[] {
  const failures = new Set<StudentAnswerFailureCode>()
  const candidate = input.candidate
  const plan = input.plan
  const normalizedAnswer = normalizeDnaChatText(candidate.answer)
  if (typeof candidate.answer !== "string" || candidate.answer.trim().length < 20 || candidate.answer.length > 4_000) {
    failures.add("answer_missing")
  }
  const obligationSupportIds = candidate.obligationSupport.map((row) => row.obligationId)
  if ([candidate.addressedTargetIds, obligationSupportIds, candidate.usedClaimIds, candidate.usedPolicyUnitIds]
    .some(hasDuplicates)) failures.add("duplicate_contract_reference")
  if (!sameSet(candidate.addressedTargetIds, plan.activeTargetIds)) failures.add("target_coverage_mismatch")
  if (plan.targetEvidence.some((target) => !target.visibleAliases
    .some((alias) => normalizedAnswer.includes(normalizeDnaChatText(alias))))) failures.add("target_not_visible")
  if (!sameSet(obligationSupportIds, plan.obligations.map((row) => row.id))) {
    failures.add("obligation_coverage_mismatch")
  }
  if (candidate.obligationSupport.some((support) => {
    const visibleText = support.visibleText.trim()
    return visibleText.length < 4 || visibleText.length > 1_000 || !candidate.answer.includes(visibleText)
  })) {
    failures.add("obligation_not_visible")
  }
  for (const obligation of plan.obligations) {
    const support = candidate.obligationSupport.find((row) => row.obligationId === obligation.id)
    if (support && !visibleObligation(obligation.kind, normalizeDnaChatText(support.visibleText))) {
      failures.add("obligation_not_visible")
    }
  }
  if (!sameSet(candidate.usedPolicyUnitIds, plan.policyUnits.map((row) => row.id))) failures.add("policy_coverage_mismatch")
  const allowedClaimIds = new Set(plan.targetEvidence.flatMap((row) => row.claims.map((claim) => claim.claimId)))
  if (candidate.usedClaimIds.some((claimId) => !allowedClaimIds.has(claimId))) failures.add("claim_outside_locked_evidence")
  for (const target of plan.targetEvidence) {
    if (!target.claims.some((claim) => candidate.usedClaimIds.includes(claim.claimId))) {
      failures.add("target_without_locked_claim")
    }
  }
  const exampleRequired = plan.obligations.some((row) => row.kind === "give_concrete_example")
  if (exampleRequired && candidate.illustrationKind === "none") failures.add("example_not_identified")
  if (!exampleRequired && candidate.illustrationKind !== "none") failures.add("example_not_identified")
  if (plan.presentation.requestedSentenceCount !== null
    && sentenceCount(candidate.answer) !== plan.presentation.requestedSentenceCount) failures.add("sentence_count_mismatch")
  if (INTERNAL_LANGUAGE.test(candidate.answer)
    || candidate.usedClaimIds.some((claimId) => candidate.answer.includes(claimId))) failures.add("internal_contract_leak")
  return Object.freeze([...failures])
}

function localSafetyCandidate(plan: StudentAnswerExecutionPlan): StudentAnswerCandidate {
  const targetStatements = plan.targetEvidence.map((target) => {
    const label = target.visibleAliases[0] ?? target.ownerBookTopicTitle.split(" · ").at(-1) ?? target.studentTargetId
    return `${label}: ${target.claims[0]!.text}`
  })
  const policyStatements = plan.policyUnits.map((unit) => unit.text)
  const obligationKinds = new Set(plan.obligations.map((row) => row.kind))
  const distinguishStatement = "Bu kavramlar aynı şey değildir."
  const relationStatement = "Aralarındaki ilişkiyi kurarken her kavramı kendi kaynak bilgisiyle ayrı ele almak gerekir."
  const relationStatements = [
    ...(obligationKinds.has("distinguish_targets") ? [distinguishStatement] : []),
    ...(obligationKinds.has("explain_relation") ? [relationStatement] : []),
  ]
  const answer = [...relationStatements, ...targetStatements, ...policyStatements].join(" ")
  const policyTextById = new Map(plan.policyUnits.map((unit) => [unit.id, unit.text]))
  const supportText = (kind: StudentRequestContract["obligations"][number]["kind"]) => {
    if (kind === "distinguish_targets") return distinguishStatement
    if (kind === "explain_relation") return relationStatement
    if (kind === "state_single_observation_limit") return policyTextById.get("policy.single-observation-limit") ?? answer
    if (kind === "name_additional_context") return policyTextById.get("policy.additional-context") ?? answer
    if (kind === "refuse_treatment_selection") return policyTextById.get("policy.no-treatment-selection") ?? answer
    if (kind === "offer_safe_assessment_frame") return policyTextById.get("policy.safe-assessment-frame") ?? answer
    return answer
  }
  return Object.freeze({
    answer,
    addressedTargetIds: Object.freeze([...plan.activeTargetIds]),
    obligationSupport: Object.freeze(plan.obligations.map((obligation) => Object.freeze({
      obligationId: obligation.id,
      visibleText: supportText(obligation.kind),
    }))),
    usedClaimIds: Object.freeze(plan.targetEvidence.map((row) => row.claims[0]!.claimId)),
    usedPolicyUnitIds: Object.freeze(plan.policyUnits.map((row) => row.id)),
    illustrationKind: "none",
  })
}

function answerSchema(plan: StudentAnswerExecutionPlan): Record<string, unknown> {
  const targetIds = [...plan.activeTargetIds]
  const obligationIds = plan.obligations.map((row) => row.id)
  const claimIds = plan.targetEvidence.flatMap((row) => row.claims.map((claim) => claim.claimId))
  const policyIds = plan.policyUnits.map((row) => row.id)
  const illustrationKinds = plan.obligations.some((row) => row.kind === "give_concrete_example")
    ? ["user_supplied", "hypothetical"] : ["none"]
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "answer", "addressedTargetIds", "obligationSupport", "usedClaimIds", "usedPolicyUnitIds", "illustrationKind",
    ],
    properties: {
      answer: { type: "string", minLength: 20, maxLength: 4_000 },
      addressedTargetIds: {
        type: "array", minItems: targetIds.length, maxItems: targetIds.length,
        items: { type: "string", enum: targetIds },
      },
      obligationSupport: {
        type: "array", minItems: obligationIds.length, maxItems: obligationIds.length,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["obligationId", "visibleText"],
          properties: {
            obligationId: { type: "string", enum: obligationIds },
            visibleText: { type: "string", minLength: 4, maxLength: 1_000 },
          },
        },
      },
      usedClaimIds: {
        type: "array", minItems: targetIds.length, maxItems: claimIds.length,
        items: { type: "string", enum: claimIds },
      },
      usedPolicyUnitIds: {
        type: "array", minItems: policyIds.length, maxItems: policyIds.length,
        items: policyIds.length ? { type: "string", enum: policyIds } : { type: "string" },
      },
      illustrationKind: { type: "string", enum: illustrationKinds },
    },
  }
}

function providerContent(input: Readonly<{
  question: string
  plan: StudentAnswerExecutionPlan
}>) {
  return JSON.stringify({
    currentUserMessage: input.question,
    operation: input.plan.operation,
    activeTargets: input.plan.targetEvidence.map((target) => ({
      targetId: target.studentTargetId,
      title: target.ownerBookTopicTitle,
      visibleAliases: target.visibleAliases,
      lockedClaims: target.claims,
    })),
    rejectedTargetIds: input.plan.rejectedTargetIds,
    obligations: input.plan.obligations,
    policyUnits: input.plan.policyUnits,
    presentation: input.plan.presentation,
  })
}

const PROVIDER_INSTRUCTIONS = `
Türkçe konuşan yeni mezun bir ergoterapi öğrencisine, doğal ve kolay anlaşılır bir DNA Intelligence cevabı yaz. Bilimsel içerikte yalnız lockedClaims içindeki cümleleri kullan; yeni neden, mekanizma, tanı, ilişki, terapi veya kesinlik ekleme. Her aktif hedefi karşıla ve her obligation görevini görünür cevapta gerçekten yerine getir. Her activeTarget için visibleAliases listesindeki adlardan en az birini cevap metninde açıkça yaz; yalnız JSON listesindeki addressedTargetIds beyanı yeterli değildir. RejectedTargetIds içindeki kavramı cevap odağına geri getirme. Kullanıcının mesajındaki durum yalnız örnek sunma görevi varsa, kimliksiz ve açıkça örnek olarak kullanılabilir; bu durum bilimsel kanıt veya kişiye özgü sonuç değildir. İstenen cümle sayısı varsa tam olarak koru. Kimlikleri, şema alanlarını, kanıt yönetimini veya iç sistem dilini kullanıcıya yazma. Her obligation için obligationSupport içine cevap metninden görevi gerçekten gerçekleştiren kısa ve birebir bir alıntı koy; görünür cevapta bulunmayan veya görevi açıklamayan metni destek olarak yazma. usedClaimIds, usedPolicyUnitIds ve addressedTargetIds yalnız gerçekten kullandığın öğeleri göstersin.
`.trim()

function parseCandidate(value: unknown): StudentAnswerCandidate | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const strings = (candidate: unknown) => Array.isArray(candidate)
    && candidate.every((entry) => typeof entry === "string") ? candidate as string[] : null
  const addressedTargetIds = strings(row.addressedTargetIds)
  const usedClaimIds = strings(row.usedClaimIds)
  const usedPolicyUnitIds = strings(row.usedPolicyUnitIds)
  const obligationSupport = Array.isArray(row.obligationSupport) ? row.obligationSupport.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return []
    const support = entry as Record<string, unknown>
    return typeof support.obligationId === "string" && typeof support.visibleText === "string"
      ? [{ obligationId: support.obligationId, visibleText: support.visibleText.trim() }]
      : []
  }) : null
  const illustrationKind = row.illustrationKind
  if (typeof row.answer !== "string" || !addressedTargetIds || !obligationSupport || !usedClaimIds
    || !usedPolicyUnitIds || !["none", "user_supplied", "hypothetical"].includes(String(illustrationKind))) return null
  return Object.freeze({
    answer: row.answer.trim(),
    addressedTargetIds: Object.freeze(addressedTargetIds),
    obligationSupport: Object.freeze(obligationSupport.map((support) => Object.freeze(support))),
    usedClaimIds: Object.freeze(usedClaimIds),
    usedPolicyUnitIds: Object.freeze(usedPolicyUnitIds),
    illustrationKind: illustrationKind as StudentAnswerCandidate["illustrationKind"],
  })
}

export async function executeStudentAnswer(input: Readonly<{
  question: string
  contract: StudentRequestContract
  apiKey?: string
  fetchImpl?: typeof fetch
  safetyIdentifier?: string | null
}>): Promise<StudentAnswerExecutorResult> {
  const plan = buildStudentAnswerExecutionPlan(input)
  if (plan.executionRoute === "local_safety_boundary") {
    const candidate = localSafetyCandidate(plan)
    const failureCodes = validateStudentAnswerCandidate({ candidate, plan })
    const provider = Object.freeze({
      calls: 0,
      responseId: null,
      usage: ZERO_USAGE,
      latencyMs: 0,
      rawOutputStored: false as const,
    })
    if (failureCodes.length) {
      return Object.freeze({ ok: false, reason: "candidate_invalid", failureCodes, plan, provider })
    }
    return Object.freeze({
      ok: true,
      answer: candidate.answer,
      candidate,
      plan,
      route: plan.executionRoute,
      provider,
    })
  }
  const attempt = await requestDnaS13StructuredOutputDetailed({
    name: "dna_student_answer_executor",
    schema: answerSchema(plan),
    instructions: PROVIDER_INSTRUCTIONS,
    content: providerContent({ question: input.question, plan }),
    maxOutputTokens: 900,
    timeoutMs: DNA_STUDENT_ANSWER_EXECUTOR_TIMEOUT_MS,
    safetyIdentifier: input.safetyIdentifier,
    apiKey: input.apiKey,
    fetchImpl: input.fetchImpl,
  })
  if (!attempt.ok) {
    return Object.freeze({
      ok: false,
      reason: "provider_failure",
      failure: attempt.failure,
      plan,
      provider: Object.freeze({
        calls: 1,
        responseId: null,
        usage: ZERO_USAGE,
        latencyMs: 0,
        rawOutputStored: false as const,
      }),
    })
  }
  const candidate = parseCandidate(attempt.result.value)
  const failureCodes = candidate ? validateStudentAnswerCandidate({ candidate, plan })
    : Object.freeze(["answer_missing" as const])
  const provider = Object.freeze({
    calls: 1,
    responseId: attempt.result.responseId,
    usage: attempt.result.usage,
    latencyMs: attempt.result.latencyMs,
    rawOutputStored: false as const,
  })
  if (!candidate || failureCodes.length) {
    return Object.freeze({ ok: false, reason: "candidate_invalid", failureCodes, plan, provider })
  }
  return Object.freeze({
    ok: true,
    answer: candidate.answer,
    candidate,
    plan,
    route: plan.executionRoute,
    provider,
  })
}

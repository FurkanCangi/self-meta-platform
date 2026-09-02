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

export const DNA_STUDENT_ANSWER_EXECUTOR_VERSION = "dna-student-answer-executor@3" as const
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

export type StudentAnswerBlock = Readonly<{
  blockId: string
  text: string
  targetIds: readonly string[]
  obligationIds: readonly string[]
  usedClaimIds: readonly string[]
  usedPolicyUnitIds: readonly string[]
}>

export type StudentAnswerCandidate = Readonly<{
  answer: string
  blocks: readonly StudentAnswerBlock[]
  addressedTargetIds: readonly string[]
  addressedObligationIds: readonly string[]
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
  if (kind === "give_concrete_example") return /\b(?:ornek\w*|ornegin|mesela|varsay\w*|dusun\w*)\b/u.test(normalized)
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
  const composedAnswer = candidate.blocks.map((block) => block.text.trim()).join(" ")
  if (typeof candidate.answer !== "string" || candidate.answer !== composedAnswer
    || candidate.answer.trim().length < 20 || candidate.answer.length > 4_000
    || candidate.blocks.length < 1 || candidate.blocks.length > 16) {
    failures.add("answer_missing")
  }
  const blockIds = candidate.blocks.map((block) => block.blockId)
  const flattenedTargetIds = candidate.blocks.flatMap((block) => block.targetIds)
  const flattenedObligationIds = candidate.blocks.flatMap((block) => block.obligationIds)
  const flattenedClaimIds = candidate.blocks.flatMap((block) => block.usedClaimIds)
  const flattenedPolicyIds = candidate.blocks.flatMap((block) => block.usedPolicyUnitIds)
  if (hasDuplicates(blockIds) || hasDuplicates(flattenedObligationIds)
    || candidate.blocks.some((block) => [block.targetIds, block.obligationIds, block.usedClaimIds, block.usedPolicyUnitIds]
      .some(hasDuplicates))) failures.add("duplicate_contract_reference")
  if (!sameSet(candidate.addressedTargetIds, unique(flattenedTargetIds))
    || !sameSet(candidate.addressedObligationIds, flattenedObligationIds)
    || !sameSet(candidate.usedClaimIds, unique(flattenedClaimIds))
    || !sameSet(candidate.usedPolicyUnitIds, unique(flattenedPolicyIds))) failures.add("duplicate_contract_reference")
  if (!sameSet(candidate.addressedTargetIds, plan.activeTargetIds)) failures.add("target_coverage_mismatch")
  if (flattenedTargetIds.some((targetId) => !plan.activeTargetIds.includes(targetId))) {
    failures.add("target_coverage_mismatch")
  }
  if (plan.targetEvidence.some((target) => !target.visibleAliases
    .some((alias) => normalizedAnswer.includes(normalizeDnaChatText(alias))))) failures.add("target_not_visible")
  if (!sameSet(flattenedObligationIds, plan.obligations.map((row) => row.id))) {
    failures.add("obligation_coverage_mismatch")
  }
  for (const obligation of plan.obligations) {
    const block = candidate.blocks.find((candidateBlock) => candidateBlock.obligationIds.includes(obligation.id))
    const activeObligationTargets = obligation.targetIds.filter((targetId) => plan.activeTargetIds.includes(targetId))
    if (!block || block.text.trim().length < 4 || block.text.length > 4_000
      || activeObligationTargets.some((targetId) => !block.targetIds.includes(targetId))
      || !visibleObligation(obligation.kind, normalizeDnaChatText(block.text))) {
      failures.add("obligation_not_visible")
    }
  }
  if (!sameSet(candidate.usedPolicyUnitIds, plan.policyUnits.map((row) => row.id))) failures.add("policy_coverage_mismatch")
  const allowedClaimIds = new Set(plan.targetEvidence.flatMap((row) => row.claims.map((claim) => claim.claimId)))
  if (flattenedClaimIds.some((claimId) => !allowedClaimIds.has(claimId))) failures.add("claim_outside_locked_evidence")
  for (const target of plan.targetEvidence) {
    const targetBlocks = candidate.blocks.filter((block) => block.targetIds.includes(target.studentTargetId))
    if (!targetBlocks.some((block) => target.claims.some((claim) => block.usedClaimIds.includes(claim.claimId)))) {
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

function composeCandidate(
  blocks: readonly StudentAnswerBlock[],
  illustrationKind: StudentAnswerCandidate["illustrationKind"],
): StudentAnswerCandidate {
  const frozenBlocks = Object.freeze(blocks.map((block) => Object.freeze({
    blockId: block.blockId,
    text: block.text.trim(),
    targetIds: Object.freeze([...block.targetIds]),
    obligationIds: Object.freeze([...block.obligationIds]),
    usedClaimIds: Object.freeze([...block.usedClaimIds]),
    usedPolicyUnitIds: Object.freeze([...block.usedPolicyUnitIds]),
  })))
  return Object.freeze({
    answer: frozenBlocks.map((block) => block.text).join(" "),
    blocks: frozenBlocks,
    addressedTargetIds: Object.freeze(unique(frozenBlocks.flatMap((block) => block.targetIds))),
    addressedObligationIds: Object.freeze(unique(frozenBlocks.flatMap((block) => block.obligationIds))),
    usedClaimIds: Object.freeze(unique(frozenBlocks.flatMap((block) => block.usedClaimIds))),
    usedPolicyUnitIds: Object.freeze(unique(frozenBlocks.flatMap((block) => block.usedPolicyUnitIds))),
    illustrationKind,
  })
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
  const exampleStatement = obligationKinds.has("give_concrete_example")
    ? "Örneğin, bu kavramları yalnız açıklayıcı varsayımsal bir durumda düşünebiliriz." : null
  const text = [...relationStatements, ...targetStatements, ...policyStatements, ...(exampleStatement ? [exampleStatement] : [])]
    .join(" ")
  return composeCandidate([Object.freeze({
    blockId: "b1",
    text,
    targetIds: Object.freeze([...plan.activeTargetIds]),
    obligationIds: Object.freeze(plan.obligations.map((obligation) => obligation.id)),
    usedClaimIds: Object.freeze(plan.targetEvidence.map((row) => row.claims[0]!.claimId)),
    usedPolicyUnitIds: Object.freeze(plan.policyUnits.map((row) => row.id)),
  })], exampleStatement ? "hypothetical" : "none")
}

function answerSchema(plan: StudentAnswerExecutionPlan): Record<string, unknown> {
  const targetIds = [...plan.activeTargetIds]
  const obligationIds = plan.obligations.map((row) => row.id)
  const claimIds = plan.targetEvidence.flatMap((row) => row.claims.map((claim) => claim.claimId))
  const policyIds = plan.policyUnits.map((row) => row.id)
  const illustrationKinds = plan.obligations.some((row) => row.kind === "give_concrete_example")
    ? ["user_supplied", "hypothetical"] : ["none"]
  const blockIds = Array.from({ length: 16 }, (_value, index) => `b${index + 1}`)
  return {
    type: "object",
    additionalProperties: false,
    required: ["blocks", "illustrationKind"],
    properties: {
      blocks: {
        type: "array",
        minItems: 1,
        maxItems: 16,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["blockId", "text", "targetIds", "obligationIds", "usedClaimIds", "usedPolicyUnitIds"],
          properties: {
            blockId: { type: "string", enum: blockIds },
            text: { type: "string", minLength: 4, maxLength: 4_000 },
            targetIds: {
              type: "array", minItems: 0, maxItems: targetIds.length,
              items: { type: "string", enum: targetIds },
            },
            obligationIds: {
              type: "array", minItems: 1, maxItems: obligationIds.length,
              items: { type: "string", enum: obligationIds },
            },
            usedClaimIds: {
              type: "array", minItems: 0, maxItems: claimIds.length,
              items: { type: "string", enum: claimIds },
            },
            usedPolicyUnitIds: {
              type: "array", minItems: 0, maxItems: policyIds.length,
              items: policyIds.length ? { type: "string", enum: policyIds } : { type: "string" },
            },
          },
        },
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
Türkçe konuşan yeni mezun bir ergoterapi öğrencisine, doğal ve kolay anlaşılır görünür cevap blokları yaz. Ayrı bir answer alanı yazma; sistem blokların text alanlarını sırayla birleştirerek son cevabı oluşturacak. Bir blok bir veya birkaç obligation görevini yerine getirebilir, fakat her obligationId tam bir blokta ve yalnız bir kez bulunmalıdır. Her activeTarget en az bir block.targetIds içinde yer almalı, visibleAliases adlarından biri o bloğun text alanında görünmeli ve aynı blok o hedefe ait en az bir lockedClaim kimliğini usedClaimIds içinde göstermelidir. Bilimsel içerikte yalnız lockedClaims içindeki cümleleri kullan; yeni neden, mekanizma, tanı, ilişki, terapi veya kesinlik ekleme. RejectedTargetIds içindeki kavramı cevap odağına geri getirme. Kullanıcının mesajındaki durum yalnız örnek sunma görevi varsa, kimliksiz ve açıkça örnek olarak kullanılabilir; bu durum bilimsel kanıt veya kişiye özgü sonuç değildir. İstenen toplam cümle sayısını bütün blokların birleşiminde tam koru. Kimlikleri, şema alanlarını, kanıt yönetimini veya iç sistem dilini text alanlarına yazma. blockId değerlerini b1, b2 diye sırayla kullan. targetIds, obligationIds, usedClaimIds ve usedPolicyUnitIds yalnız bloğun text alanında gerçekten kullanılan öğeleri göstersin.
`.trim()

function parseCandidate(value: unknown): StudentAnswerCandidate | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const strings = (candidate: unknown) => Array.isArray(candidate)
    && candidate.every((entry) => typeof entry === "string") ? candidate as string[] : null
  const blocks = Array.isArray(row.blocks) ? row.blocks.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return []
    const block = entry as Record<string, unknown>
    const targetIds = strings(block.targetIds)
    const obligationIds = strings(block.obligationIds)
    const usedClaimIds = strings(block.usedClaimIds)
    const usedPolicyUnitIds = strings(block.usedPolicyUnitIds)
    if (typeof block.blockId !== "string" || typeof block.text !== "string" || !targetIds || !obligationIds
      || !usedClaimIds || !usedPolicyUnitIds) return []
    return [Object.freeze({
      blockId: block.blockId,
      text: block.text,
      targetIds: Object.freeze(targetIds),
      obligationIds: Object.freeze(obligationIds),
      usedClaimIds: Object.freeze(usedClaimIds),
      usedPolicyUnitIds: Object.freeze(usedPolicyUnitIds),
    })]
  }) : null
  const illustrationKind = row.illustrationKind
  if (!blocks || blocks.length !== (Array.isArray(row.blocks) ? row.blocks.length : 0)
    || !["none", "user_supplied", "hypothetical"].includes(String(illustrationKind))) return null
  return composeCandidate(blocks, illustrationKind as StudentAnswerCandidate["illustrationKind"])
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

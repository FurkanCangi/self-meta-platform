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

export const DNA_STUDENT_ANSWER_EXECUTOR_VERSION = "dna-student-answer-executor@15" as const
export const DNA_STUDENT_ANSWER_EXECUTOR_TIMEOUT_MS = 20_000
export const DNA_STUDENT_ANSWER_EXECUTOR_MAX_PROVIDER_CALLS = 1

export const DNA_STUDENT_ANSWER_FAILURE_CODES = Object.freeze([
  "answer_missing",
  "target_coverage_mismatch",
  "obligation_coverage_mismatch",
  "policy_coverage_mismatch",
  "claim_outside_locked_evidence",
  "contrast_claim_used_as_target",
  "target_without_locked_claim",
  "example_not_identified",
  "sentence_count_mismatch",
  "internal_contract_leak",
  "duplicate_contract_reference",
  "target_not_visible",
  "obligation_not_visible",
  "shared_scenario_block_mismatch",
  "example_block_role_mismatch",
] as const)

export type StudentAnswerFailureCode = typeof DNA_STUDENT_ANSWER_FAILURE_CODES[number]

export type StudentAnswerBlock = Readonly<{
  blockId: string
  blockKind: "content" | "example"
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
  if (kind === "state_single_observation_limit") return /\b(?:tek\s+(?:bir\s+)?(?:gozlem|davranis)|yalnizca\s+bu\s+durum)\b/u.test(normalized)
    && /\b(?:yeterli\s+degil|karar\w*|kesin\w*|gostermez\w*|cikarilamaz\w*)\b/u.test(normalized)
  if (kind === "name_additional_context") return /\b(?:farkli\s+(?:zaman|ortam|gorev)|oncesi\w*\s+(?:ve|ile)\s+sonrasi\w*|destek\w*\s+nasil\s+degis)\b/u.test(normalized)
  if (kind === "name_multiple_plausible_explanations") return /\b(?:birden\s+fazla|farkli)\s+(?:makul\s+)?(?:aciklama|neden|olas)\w*\b/u.test(normalized)
    || /\btek\s+(?:bir\s+)?nedeni\b.{0,60}\b(?:yeterli\s+degil|sec\w*|soyle\w*)\b/u.test(normalized)
  if (kind === "avoid_context_free_judgment") return /\biyi\s+(?:veya|ya da)\s+kotu\b/u.test(normalized)
    && /\b(?:baglam|islev)\w*\b/u.test(normalized)
  if (kind === "contrast_target_states") return /\bdusuk\w*\b/u.test(normalized) && /\byuksek\w*\b/u.test(normalized)
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
  for (const block of candidate.blocks) {
    const blockObligations = plan.obligations.filter((obligation) => block.obligationIds.includes(obligation.id))
    const expectedKind: StudentAnswerBlock["blockKind"] = blockObligations
      .some((obligation) => obligation.kind === "give_concrete_example") ? "example" : "content"
    if (block.blockKind !== expectedKind) failures.add("example_block_role_mismatch")
  }
  for (const obligation of plan.obligations) {
    const block = candidate.blocks.find((candidateBlock) => candidateBlock.obligationIds.includes(obligation.id))
    const activeObligationTargets = obligation.targetIds.filter((targetId) => plan.activeTargetIds.includes(targetId))
    if (!block || block.text.trim().length < 4 || block.text.length > 4_000
      || activeObligationTargets.some((targetId) => !block.targetIds.includes(targetId))
      || !visibleObligation(obligation.kind, normalizeDnaChatText(block.text))) {
      failures.add("obligation_not_visible")
    }
    if (obligation.kind === "give_concrete_example"
      && (!block || block.blockKind !== "example" || !block.text.includes("Örnek:"))) {
      failures.add("example_block_role_mismatch")
    }
    if (block && ["give_concrete_example", "bind_example_to_target"].includes(obligation.kind)) {
      const contrastClaimIds = new Set(plan.targetEvidence.flatMap((target) =>
        target.claims.filter((claim) => claim.role === "contrast").map((claim) => claim.claimId)))
      if (block.usedClaimIds.some((claimId) => contrastClaimIds.has(claimId))) {
        failures.add("contrast_claim_used_as_target")
      }
    }
  }
  const sharedScenario = plan.obligations.find((row) => row.kind === "use_shared_scenario")
  if (sharedScenario) {
    const sharedKinds: readonly StudentRequestContract["obligations"][number]["kind"][] = [
      "give_concrete_example", "bind_example_to_target", "use_shared_scenario",
    ]
    const exampleObligationIds = plan.obligations
      .filter((row) => sharedKinds.includes(row.kind))
      .map((row) => row.id)
    const blockIdsForSharedExample = exampleObligationIds.map((obligationId) =>
      candidate.blocks.find((block) => block.obligationIds.includes(obligationId))?.blockId ?? null)
    if (blockIdsForSharedExample.some((blockId) => blockId === null)
      || new Set(blockIdsForSharedExample).size !== 1) failures.add("shared_scenario_block_mismatch")
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
    blockKind: block.blockKind,
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

function hasEveryTarget(plan: StudentAnswerExecutionPlan, targetIds: readonly string[]) {
  return targetIds.every((targetId) => plan.activeTargetIds.includes(targetId))
}

function localCaseObservationStatement(
  question: string,
  plan: StudentAnswerExecutionPlan,
  hasHistoryReferent: boolean,
): string | null {
  const caseInterpretive = plan.operation === "case_reasoning" || plan.operation === "observe"
    || plan.obligations.some((obligation) => [
      "state_single_observation_limit",
      "name_additional_context",
      "name_multiple_plausible_explanations",
      "avoid_context_free_judgment",
    ].includes(obligation.kind))
  if (!caseInterpretive || plan.operation === "treatment_boundary") return null
  const normalized = normalizeDnaChatText(question)
  const hasRecovery = /\btoparla\w*.{0,40}\bdon\w*\b/u.test(normalized)
  const hasTaskBreak = /\b(?:gorev|is)\w*.{0,45}\b(?:birak|kalk|gez)\w*\b/u.test(normalized)
  const hasAdultSupport = /\b(?:ogretmen|yetiskin)\w*\b/u.test(normalized)
    && /\b(?:yavas\w*|yumusat\w*|sakin\w*|yan\w*|destek\w*)\b/u.test(normalized)
  const hasActivityReturn = /\b(?:oyun|gorev|etkinlik)\w*.{0,24}\bdon\w*\b/u.test(normalized)
    || /\b(?:sakinles|duzel)\w*\b/u.test(normalized)
  const hasEnvironmentLoad = /\b(?:kalabalik|sesli|gurultu|ortam)\w*\b/u.test(normalized)
  const hasVoiceRise = /\bses\w*.{0,20}\b(?:yuksel|art)\w*\b/u.test(normalized)
  const hasMovementRise = /\b(?:cok\s+hareket|hareket\w*.{0,16}\bart|hizli\s+dolas)\w*\b/u.test(normalized)
  const hasEmotionEvent = /\b(?:sinirlen|ofkelen|gergin)\w*\b/u.test(normalized)
  const hasInstruction = /\b(?:sozlu\s+)?yonerge\w*\b/u.test(normalized)
  const hasAdultLook = /\b(?:yetiskin|ogretmen)\w*.{0,32}\bbak\w*\b/u.test(normalized)

  if (hasEveryTarget(plan, ["self_regulation", "recovery"]) && hasRecovery) {
    return "Kendi kendine toparlanıp göreve dönme, öz-düzenleme açısından davranışı o anda yeniden göreve yöneltebilme olarak düşünülebilir; toparlanma burada gözlenen geri dönüşü anlatır."
  }
  if (hasEveryTarget(plan, ["self_regulation", "attention"]) && hasTaskBreak) {
    return "Göreve başladıktan sonra görevden kopma ve sınıfta dolaşma, öz-düzenleme ile dikkati sürdürme açısından ayrı ayrı değerlendirilebilecek bir gözlemdir."
  }
  if (hasEveryTarget(plan, ["coregulation"]) && hasAdultSupport && hasActivityReturn) {
    return "Yetişkinin sakin desteğinden sonra çocuğun etkinliğe dönebilmesi, eş düzenleme açısından dış desteğin düzenlenmeye eşlik ettiği somut bir örnek olarak düşünülebilir."
  }
  if (hasEveryTarget(plan, ["arousal", "sensory_regulation"]) && (hasEnvironmentLoad || hasVoiceRise || hasMovementRise)) {
    return "Kalabalık veya sesli ortamla birlikte sesin ya da hareketin artması, arousal ve duyusal düzenleme açısından ayrı ayrı ele alınabilecek bir gözlemdir."
  }
  if (hasEveryTarget(plan, ["arousal", "emotion_regulation"]) && (hasEmotionEvent || hasVoiceRise)) {
    return "Sinirlenme sırasında sesin yükselmesi, hem arousal hem de duygu düzenleme açısından düşünülebilir; aynı görünüm bu iki kavramı tek başına birbirinden ayırmaz."
  }
  if (hasInstruction && hasAdultLook) {
    const labels = plan.targetEvidence.map((target) => target.visibleAliases[0]).filter(Boolean).join(" ve ")
    return `Yönergeyi duyduğu halde başlamak için yetişkine bakma, ${labels} açısından göreve başlama ile dış destek ihtiyacını birlikte incelemeyi gerektiren bir gözlemdir.`
  }
  if (hasAdultSupport && hasActivityReturn) {
    const labels = plan.targetEvidence.map((target) => target.visibleAliases[0]).filter(Boolean).join(" ve ")
    return `Yetişkin desteğinden sonra sakinleşip etkinliğe dönme, ${labels} açısından desteğin öncesi ve sonrasını birlikte değerlendirmeyi gerektiren bir gözlemdir.`
  }
  if (hasEnvironmentLoad || hasVoiceRise || hasMovementRise || hasTaskBreak || hasRecovery) {
    const labels = plan.targetEvidence.map((target) => target.visibleAliases[0]).filter(Boolean).join(" ve ")
    return `Mesajdaki davranış örüntüsü, ${labels} açısından ele alınabilecek bir gözlemdir; bu ifade tek başına kişiye ilişkin kesin bir sonuç değildir.`
  }
  if (hasHistoryReferent) {
    const labels = plan.targetEvidence.map((target) => target.visibleAliases[0]).filter(Boolean).join(" ve ")
    return `Önceki örnekteki davranış, ${labels} açısından işlevi ve bağlamı korunarak değerlendirilmelidir.`
  }
  return null
}

function localSafetyCandidate(
  plan: StudentAnswerExecutionPlan,
  question: string,
  hasHistoryReferent: boolean,
): StudentAnswerCandidate {
  const targetStatements = plan.targetEvidence.map((target) => {
    const label = target.visibleAliases[0] ?? target.ownerBookTopicTitle.split(" · ").at(-1) ?? target.studentTargetId
    const claim = target.claims.find((candidate) => candidate.role !== "contrast") ?? target.claims[0]!
    return `${label}: ${claim.text}`
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
    ? "Örnek: Bu kavramları yalnız açıklayıcı varsayımsal bir durumda düşünebiliriz." : null
  const caseStatement = localCaseObservationStatement(question, plan, hasHistoryReferent)
  const renderedCaseStatement = caseStatement && obligationKinds.has("give_concrete_example")
    ? `Örnek: ${caseStatement}`
    : caseStatement
  const contentStatements = caseStatement
    ? [renderedCaseStatement!, ...policyStatements]
    : [...relationStatements, ...targetStatements, ...policyStatements, ...(exampleStatement ? [exampleStatement] : [])]
  const text = contentStatements
    .join(" ")
  return composeCandidate([Object.freeze({
    blockId: "b1",
    blockKind: exampleStatement ? "example" : "content",
    text,
    targetIds: Object.freeze([...plan.activeTargetIds]),
    obligationIds: Object.freeze(plan.obligations.map((obligation) => obligation.id)),
    usedClaimIds: Object.freeze(plan.targetEvidence.map((row) =>
      (row.claims.find((candidate) => candidate.role !== "contrast") ?? row.claims[0]!).claimId)),
    usedPolicyUnitIds: Object.freeze(plan.policyUnits.map((row) => row.id)),
  })], exampleStatement ? (caseStatement ? "user_supplied" : "hypothetical") : "none")
}

const POLICY_ID_BY_OBLIGATION_KIND: Readonly<Partial<Record<
  StudentRequestContract["obligations"][number]["kind"],
  string
>>> = Object.freeze({
  give_concrete_example: "policy.illustrative-scenario",
  bind_example_to_target: "policy.example-target-binding",
  state_single_observation_limit: "policy.single-observation-limit",
  name_additional_context: "policy.additional-context",
  name_multiple_plausible_explanations: "policy.multiple-plausible-explanations",
  avoid_context_free_judgment: "policy.contextual-judgment",
  refuse_treatment_selection: "policy.no-treatment-selection",
  offer_safe_assessment_frame: "policy.safe-assessment-frame",
})

type StudentAnswerSlotMetadata = Readonly<{
  blockId: string
  blockKind: StudentAnswerBlock["blockKind"]
  targetIds: readonly string[]
  obligationIds: readonly string[]
  usedClaimIds: readonly string[]
  usedPolicyUnitIds: readonly string[]
}>

const SHARED_EXAMPLE_KINDS: readonly StudentRequestContract["obligations"][number]["kind"][] = Object.freeze([
  "give_concrete_example", "bind_example_to_target", "use_shared_scenario",
])

const COMPOSITION_CONTROL_KINDS: readonly StudentRequestContract["obligations"][number]["kind"][] = Object.freeze([
  "honor_rejected_target", "use_history_anchor", "preserve_target_while_simplifying",
])

function slotMetadataForObligations(
  plan: StudentAnswerExecutionPlan,
  obligations: StudentAnswerExecutionPlan["obligations"],
  blockIndex: number,
): StudentAnswerSlotMetadata {
  const explicitActiveTargets = obligations.flatMap((obligation) =>
    obligation.targetIds.filter((targetId) => plan.activeTargetIds.includes(targetId)))
  const targetIds = explicitActiveTargets.length ? explicitActiveTargets : [...plan.activeTargetIds]
  const usedClaimIds = targetIds.flatMap((targetId) => {
    const evidence = plan.targetEvidence.find((row) => row.studentTargetId === targetId)
    const claim = evidence?.claims.find((candidate) => candidate.role !== "contrast")
    return claim ? [claim.claimId] : []
  })
  const usedPolicyUnitIds = obligations.flatMap((obligation) => {
    const policyId = POLICY_ID_BY_OBLIGATION_KIND[obligation.kind]
    return policyId && plan.policyUnits.some((unit) => unit.id === policyId) ? [policyId] : []
  })
  return Object.freeze({
    blockId: `b${blockIndex + 1}`,
    blockKind: obligations.some((obligation) => obligation.kind === "give_concrete_example") ? "example" : "content",
    targetIds: Object.freeze(unique(targetIds)),
    obligationIds: Object.freeze(obligations.map((obligation) => obligation.id)),
    usedClaimIds: Object.freeze(unique(usedClaimIds)),
    usedPolicyUnitIds: Object.freeze(unique(usedPolicyUnitIds)),
  })
}

function answerObligationGroups(plan: StudentAnswerExecutionPlan): readonly StudentAnswerExecutionPlan["obligations"][] {
  const sharedScenarioRequired = plan.obligations.some((obligation) => obligation.kind === "use_shared_scenario")
  const contentObligations = plan.obligations.filter((obligation) => !COMPOSITION_CONTROL_KINDS.includes(obligation.kind))
  const controlObligations = plan.obligations.filter((obligation) => COMPOSITION_CONTROL_KINDS.includes(obligation.kind))
  const groups: StudentAnswerExecutionPlan["obligations"][] = []
  let sharedExampleAdded = false
  for (const obligation of contentObligations) {
    if (sharedScenarioRequired && SHARED_EXAMPLE_KINDS.includes(obligation.kind)) {
      if (sharedExampleAdded) continue
      sharedExampleAdded = true
      groups.push(Object.freeze(contentObligations.filter((row) => SHARED_EXAMPLE_KINDS.includes(row.kind))))
      continue
    }
    groups.push(Object.freeze([obligation]))
  }
  if (controlObligations.length) {
    if (groups.length) groups[0] = Object.freeze([...groups[0]!, ...controlObligations])
    else groups.push(Object.freeze([...controlObligations]))
  }
  const requestedSentenceCount = plan.presentation.requestedSentenceCount
  if (requestedSentenceCount === null) return Object.freeze(groups)
  const sentenceGroups: StudentAnswerExecutionPlan["obligations"][] = Array.from(
    { length: requestedSentenceCount }, () => Object.freeze([]),
  )
  for (const [index, group] of groups.entries()) {
    const sentenceIndex = Math.min(index, requestedSentenceCount - 1)
    sentenceGroups[sentenceIndex] = Object.freeze([...sentenceGroups[sentenceIndex]!, ...group])
  }
  return Object.freeze(sentenceGroups)
}

function answerSlotMetadata(plan: StudentAnswerExecutionPlan): readonly StudentAnswerSlotMetadata[] {
  return Object.freeze(answerObligationGroups(plan).map((obligations, index) =>
    slotMetadataForObligations(plan, obligations, index)))
}

function answerSchema(plan: StudentAnswerExecutionPlan): Record<string, unknown> {
  const illustrationKinds = plan.obligations.some((row) => row.kind === "give_concrete_example")
    ? ["user_supplied", "hypothetical"] : ["none"]
  const slotIds = answerSlotMetadata(plan).map((slot) => slot.blockId)
  return {
    type: "object",
    additionalProperties: false,
    required: ["blocks", "illustrationKind"],
    properties: {
      blocks: {
        type: "object",
        additionalProperties: false,
        required: slotIds,
        properties: Object.fromEntries(slotIds.map((slotId) => [slotId, {
          type: "string",
          minLength: 4,
          maxLength: 4_000,
        }])),
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
    rejectedTargetIds: input.plan.rejectedTargetIds,
    historyAnchor: input.plan.historyAnchor,
    answerSlots: answerSlotMetadata(input.plan).map((metadata) => {
      const obligations = input.plan.obligations.filter((obligation) => metadata.obligationIds.includes(obligation.id))
      const exampleSlot = obligations.some((obligation) => SHARED_EXAMPLE_KINDS.includes(obligation.kind))
      return {
        slotId: metadata.blockId,
        slotKind: metadata.blockKind,
        obligations,
        caseBinding: input.plan.historyAnchor?.caseContext
          ? {
              requiredForEveryActiveTarget: true,
              eventLabels: input.plan.historyAnchor.caseContext.eventLabels,
            }
          : null,
        activeTargets: input.plan.targetEvidence
          .filter((target) => metadata.targetIds.includes(target.studentTargetId))
          .map((target) => ({
            targetId: target.studentTargetId,
            title: target.ownerBookTopicTitle,
            visibleAliases: target.visibleAliases,
            lockedClaims: exampleSlot
              ? target.claims.filter((claim) => claim.role !== "contrast")
              : target.claims,
          })),
        policyUnits: input.plan.policyUnits.filter((unit) => metadata.usedPolicyUnitIds.includes(unit.id)),
      }
    }),
    presentation: input.plan.presentation,
  })
}

function visibleTargetPrefix(plan: StudentAnswerExecutionPlan) {
  const labels = unique(plan.targetEvidence.map((target) => target.visibleAliases[0]).filter(Boolean))
  const phrase = labels.length <= 1
    ? labels[0] ?? "Konu"
    : labels.length === 2
      ? `${labels[0]} ve ${labels[1]}`
      : `${labels.slice(0, -1).join(", ")} ve ${labels.at(-1)}`
  return `${phrase} açısından:`
}

function withoutProviderExampleLead(text: string) {
  return text.replace(/^(?:örnek\s*:?\s*|örneğin\s*,?\s*|mesela\s*,?\s*)/iu, "").trim()
}

function asSingleSentenceFragment(text: string) {
  return text
    .replace(/\s+/gu, " ")
    .replace(/[.!?]+(?=\s|$)/gu, "; ")
    .replace(/(?:;\s*)+$/u, "")
    .trim()
}

const PROVIDER_INSTRUCTIONS = `
  Türkçe konuşan yeni mezun bir ergoterapi öğrencisine, doğal ve kolay anlaşılır cevap metinleri yaz. Yalnız şemada hazır bulunan b1, b2 gibi metin kutularını ve illustrationKind alanını doldur; hedef, yükümlülük, kanıt, politika veya blok kimliği üretme. Her metin kutusu answerSlots içindeki aynı slotId görevlerinin tamamını gerçekten yerine getirsin. Sistem kutuları sırayla birleştirerek son cevabı oluşturacak; bu yüzden kutular birlikte tek, akıcı ve tekrarsız bir cevap gibi okunmalıdır. presentation.requestedSentenceCount boşsa her kutuyu doğal cümle sonu noktalamasıyla tamamla. presentation.requestedSentenceCount doluysa sistem tam o sayı kadar kutu verir; her kutuya yalnız tek cümlelik içerik yaz ve nokta, soru işareti veya ünlemle bitirme, sonlandırmayı sistem yapacak. historyAnchor doluysa önceki ham mesajı görmediğini unutma. historyAnchor.caseContext boşsa yalnız targetLabels ve currentUserMessage içindeki referans sözünü kullanarak “bu durumda” veya “önceki ... durumunda” gibi görünür bir bağ kur. historyAnchor.caseContext doluysa eventLabels geçmiş olaydan kullanılmasına izin verilen tek somut olay dizisidir. caseBinding.requiredForEveryActiveTarget=true olan her kutuda tanımı yalnız sıralama; kutudaki her activeTargets hedefinin bu aynı olay dizisinin hangi bölümünü anlamaya yardım ettiğini, en az bir eventLabels ifadesini görünür kullanarak ve kesin kişisel sonuç çıkarmadan açıkla. Çok parçalı istekte tüm hedefler aynı olay dizisine bağlanmalıdır; ilk kutuda genel bir geçmiş atfı yapmak tek başına yeterli değildir. Verilmeyen kişi, ortam, neden, duygu veya davranış ayrıntısını uydurma. slotKind=example olan kutunun görünür “Örnek:” etiketini sistem ekleyecek; bu kutuyu ayrıca “Örnek:” veya “Örneğin” diye başlatma, doğrudan durumu anlat. Bir slotun obligations listesinde use_shared_scenario varsa yalnız tek bir ortak somut durum kullan; bütün aktif hedefleri bu aynı durumun içinde ayrı ayrı göster ve ikinci, ilgisiz bir örneğe geçme. Her slotun activeTargets bölümündeki her hedef için visibleAliases adlarından en az birini görünür metinde yaz. Bilimsel içerikte yalnız o slotun lockedClaims cümlelerini kullan; yeni neden, mekanizma, tanı, ilişki, terapi veya kesinlik ekleme. role=contrast olan cümle başka bir kavramın karşıt bilgisidir; onu aktif hedefin tanımı, özelliği veya örneği gibi kullanma. Örnek ve örnek-bağlama slotlarına contrast cümlesi zaten verilmez. RejectedTargetIds içindeki kavramı cevap odağına geri getirme. Kullanıcının mesajındaki durum yalnız örnek sunma görevi varsa, kimliksiz ve açıkça örnek olarak kullanılabilir; bu durum bilimsel kanıt veya kişiye özgü sonuç değildir. İç sistem dilini görünür metne yazma.
`.trim()

function parseCandidate(value: unknown, plan: StudentAnswerExecutionPlan): StudentAnswerCandidate | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const textBySlot = row.blocks && typeof row.blocks === "object" && !Array.isArray(row.blocks)
    ? row.blocks as Record<string, unknown> : null
  const illustrationKind = row.illustrationKind
  if (!textBySlot || !["none", "user_supplied", "hypothetical"].includes(String(illustrationKind))) return null
  const slots = answerSlotMetadata(plan)
  const slotIds = slots.map((slot) => slot.blockId)
  if (!sameSet(Object.keys(textBySlot), slotIds)
    || slotIds.some((slotId) => typeof textBySlot[slotId] !== "string")) return null
  const providerTextBySlot = Object.fromEntries(slots.map((slot) => {
    const rawText = String(textBySlot[slot.blockId]).trim()
    const withoutExampleLead = slot.blockKind === "example" ? withoutProviderExampleLead(rawText) : rawText
    return [slot.blockId, plan.presentation.requestedSentenceCount === null
      ? withoutExampleLead
      : asSingleSentenceFragment(withoutExampleLead)]
  }))
  if (slots.some((slot) => providerTextBySlot[slot.blockId]!.length < 4)) return null
  const blocks = slots.map((slot, index) => {
    const prefixes = [
      ...(index === 0 ? [visibleTargetPrefix(plan)] : []),
      ...(slot.blockKind === "example" ? ["Örnek:"] : []),
    ]
    return Object.freeze({
      ...slot,
      text: `${[...prefixes, providerTextBySlot[slot.blockId]!].join(" ")}${plan.presentation.requestedSentenceCount === null ? "" : "."}`,
    })
  })
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
    const candidate = localSafetyCandidate(plan, input.question, input.contract.referent.kind !== "none")
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
  const candidate = parseCandidate(attempt.result.value, plan)
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

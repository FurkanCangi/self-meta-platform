import "server-only"

import {
  requestDnaS13StructuredOutputDetailed,
  type DnaS13ProviderFailure,
  type DnaS13ProviderUsage,
} from "../s13/server"
import { normalizeDnaChatText } from "../text"
import type { StudentRequestContract } from "./contracts"
import type { StudentConversationEvidenceRef } from "./conversationEvidence"
import { explicitScenarioEvents, preservesScenarioEvents, SCENARIO_FIDELITY_INSTRUCTIONS } from "./scenarioFidelity"
import { sourceBoundDefinitionScope, withoutExampleScopeDeclarations } from "./sourceScope"
import {
  buildStudentAnswerExecutionPlan,
  studentRelationSourceUnits,
  type StudentAnswerExecutionPlan,
} from "./answerExecution"

export const DNA_STUDENT_ANSWER_EXECUTOR_VERSION = "dna-student-answer-executor@107" as const
// Wait for the same request through a bounded slow response, not a second
// generation. Unknown usage remains unknown and never authorizes a retry.
export const DNA_STUDENT_ANSWER_EXECUTOR_TIMEOUT_MS = 90_000
export const DNA_STUDENT_ANSWER_EXECUTOR_MAX_PROVIDER_CALLS = 1
export const DNA_STUDENT_ANSWER_EXECUTOR_MAX_TRANSPORT_RETRIES = 0

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
  "unrequested_example_boundary",
  "scenario_event_direction_mismatch",
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
  compositionDecisions?: readonly Readonly<DefinitionScopeSelection & { slotId: string;
    sourceRelationAuthority?: "component_membership"; sourceRelationClaimIds?: readonly string[] }>[]
}>

export type StudentAnswerExecutorResult =
  | Readonly<{
      ok: true
      answer: string
      candidate: StudentAnswerCandidate
      plan: StudentAnswerExecutionPlan
      route: StudentAnswerExecutionPlan["executionRoute"]
      provider: StudentAnswerProviderTelemetry
    }>
  | Readonly<{
      ok: false
      reason: "provider_permission_denied"
      plan: StudentAnswerExecutionPlan
      provider: StudentAnswerProviderTelemetry
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
  transportRetries: number
  usageComplete: boolean
  responseId: string | null
  usage: DnaS13ProviderUsage
  latencyMs: number
  rawOutputStored: false
}>

const ZERO_USAGE: DnaS13ProviderUsage = Object.freeze({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 })
const INTERNAL_LANGUAGE = /\b(?:claim(?:id)?|passage(?:id)?|topic(?:id)?|obligation(?:id)?|locked evidence|kilitli kanit|kilitli kaynak|kanıt paketi|policy unit|schema|json)\b/iu

function unique(values: readonly string[]) {
  return [...new Set(values)]
}

function retryableStudentAnswerTransportFailure(failure: DnaS13ProviderFailure): boolean {
  return failure.reason === "timeout" || failure.reason === "network_error"
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
  if (kind === "explain_mechanism") return /\bmekanizma\w*\b/u.test(normalized)
    && /\b(?:acikla\w*|isley\w*|surec\w*|destekle\w*|goster\w*|sinir\w*|bilgi\w*)\b/u.test(normalized)
  if (kind === "explain_daily_life_meaning") return /\bgunluk\s+(?:yasam|hayat)\w*\b/u.test(normalized)
    && /\b(?:anlam\w*|katilim\w*|etkinlik\w*|rutin\w*|okul\w*|oyun\w*|sosyal\w*)\b/u.test(normalized)
  if (kind === "state_evidence_limit") return /\b(?:kanit|bilgi|gozlem|olcum|bulgu)\w*\b/u.test(normalized)
    && /\b(?:tek\s+basina|kesin\w*|sinir\w*|yeterli\s+degil|gostermez\w*|kanitlamaz\w*)\b/u.test(normalized)
  if (kind === "avoid_causal_overclaim") return /\b(?:neden\s*sonuc|tani|kapasite|neden)\w*\b/u.test(normalized)
    && /\b(?:tek\s+basina|kesin\w*|yeterli\s+degil|cikar\w*|kanitlamaz\w*)\b/u.test(normalized)
  if (kind === "describe_measurement_scope") return /\b(?:olcum|degerlendirme|puan|gozlem)\w*\b/u.test(normalized)
    && /\b(?:tek\s+basina|sinir\w*|gostermez\w*|yardim\w*)\b/u.test(normalized)
  if (kind === "state_single_observation_limit") return /\b(?:tek\s+(?:bir\s+)?(?:gozlem|davranis)|yalnizca\s+bu\s+durum)\b/u.test(normalized)
    && /\b(?:yeterli\s+degil|karar\w*|kesin\w*|gostermez\w*|cikarilamaz\w*)\b/u.test(normalized)
  if (kind === "name_additional_context") return /\b(?:farkli\s+(?:zaman|ortam|gorev)|oncesi\w*\s+(?:ve|ile)\s+sonrasi\w*|destek\w*\s+nasil\s+degis)\b/u.test(normalized)
  if (kind === "name_multiple_plausible_explanations") return /\bornegin\b.{0,220}\b(?:veya|ya\s+da)\b/u.test(normalized)
    && /\btek\s+(?:bir\s+)?nedeni\b.{0,80}\b(?:yeterli\s+degil|sec\w*|soyle\w*)\b/u.test(normalized)
  if (kind === "avoid_context_free_judgment") return /\biyi\s+(?:veya|ya da)\s+kotu\b/u.test(normalized)
    && /\b(?:baglam|islev)\w*\b/u.test(normalized)
  if (kind === "contrast_target_states") return /\bdusuk\w*\b/u.test(normalized) && /\byuksek\w*\b/u.test(normalized)
  if (kind === "state_context_dependency") return /\bkatilim\w*\b/u.test(normalized)
    && (/\bbaglam\w*\b/u.test(normalized)
      || (/\bkisi\w*\b/u.test(normalized) && /\bgorev\w*\b/u.test(normalized) && /\bortam\w*\b/u.test(normalized)))
  if (kind === "summarize_unknown") return /\b(?:bilin\w*|kesin\w*|soyle\w*|cikarilamaz\w*|sonuc\w*\s+vermez)\b/u.test(normalized)
  if (kind === "summarize_observation_focus") return /\bgozlem\w*\b/u.test(normalized)
  if (kind === "refuse_treatment_selection") return /\b(?:terapi|tedavi)\w*\b.{0,80}\b(?:sec\w*|oner\w*|uygula\w*)\b/u.test(normalized)
  if (kind === "offer_safe_assessment_frame") return /\b(?:degerlendirme\w*|farkli\s+ortam\w*|gozlem\w*)\b/u.test(normalized)
  return true
}

export function validateStudentAnswerCandidate(input: Readonly<{
  candidate: StudentAnswerCandidate
  plan: StudentAnswerExecutionPlan
  question?: string
}>): readonly StudentAnswerFailureCode[] {
  const failures = new Set<StudentAnswerFailureCode>()
  const candidate = input.candidate
  const plan = input.plan
  const normalizedAnswer = normalizeDnaChatText(candidate.answer)
  const requestedInferenceLimit = input.question ? localCaseInferenceLimit(input.question, plan) : null
  if (requestedInferenceLimit && !candidate.answer.startsWith(requestedInferenceLimit)) {
    failures.add("obligation_not_visible")
  }
  const composedAnswer = candidate.blocks.map((block) => block.text.trim())
    .join(plan.presentation.format === "bullets" ? "\n" : " ")
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
    if (block && requiresLocalCaseExplanation(plan) && obligation.kind === "explain_target") {
      // The deterministic local route owns this projection. Merely attaching an
      // explanation duty/claim ID to generic policy prose cannot satisfy it.
      for (const target of plan.targetEvidence.filter((target) => activeObligationTargets.includes(target.studentTargetId))) {
        const projection = localCaseTargetProjection(target)
        if (!block.text.includes(projection.text)
          || projection.usedClaimIds.some((id) => !block.usedClaimIds.includes(id))) failures.add("obligation_not_visible")
      }
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
  if (!plan.obligations.some((obligation) => EXPLICIT_BOUNDARY_KINDS.includes(obligation.kind))
    && candidate.blocks.some((block) => block.blockKind === "example"
      && containsUnrequestedExampleBoundary(block.text, plan))) failures.add("unrequested_example_boundary")
  if (plan.presentation.requestedSentenceCount !== null
    && sentenceCount(candidate.answer) !== plan.presentation.requestedSentenceCount) failures.add("sentence_count_mismatch")
  if (INTERNAL_LANGUAGE.test(candidate.answer)
    || candidate.usedClaimIds.some((claimId) => candidate.answer.includes(claimId))) failures.add("internal_contract_leak")
  if (plan.requestedRelationFocus) {
    const budgets = answerSentenceBudgets(plan)
    for (const [index, slot] of answerSlotMetadata(plan).entries()) {
      if (!isDefinitionScopeSlot(plan, slot)) continue
      const decision = candidate.compositionDecisions?.find(row => row.slotId === slot.blockId)
      const block = candidate.blocks.find(row => slot.obligationIds.every(id => row.obligationIds.includes(id)))
      if (!decision || decision.requestFocus !== plan.requestedRelationFocus || !block) {
        failures.add("obligation_not_visible")
        continue
      }
      // This projection is renderer-owned. A retained decision/source ID cannot
      // cover a scope/link sentence lost after composition or serialization.
      const projection = relationSlotUnits(plan, input.question ?? "", slot.targetIds,
        slot.obligationIds, budgets?.[index] ?? 1, decision)
      if (!projection || !normalizeDnaChatText(block.text).includes(normalizeDnaChatText(projection.units.join(" ")))
        || projection.usedClaimIds.some(id => !block.usedClaimIds.includes(id))) failures.add("obligation_not_visible")
    }
  }
  return Object.freeze([...failures])
}

function composeCandidate(
  blocks: readonly StudentAnswerBlock[],
  illustrationKind: StudentAnswerCandidate["illustrationKind"],
  format: StudentAnswerExecutionPlan["presentation"]["format"] = "prose",
  compositionDecisions: NonNullable<StudentAnswerCandidate["compositionDecisions"]> = Object.freeze([]),
): StudentAnswerCandidate {
  const frozenBlocks = Object.freeze(blocks.map((block) => Object.freeze({
    blockId: block.blockId,
    blockKind: block.blockKind,
    text: format === "bullets" ? `- ${block.text.trim().replace(/^-\s*/u, "")}` : block.text.trim(),
    targetIds: Object.freeze([...block.targetIds]),
    obligationIds: Object.freeze([...block.obligationIds]),
    usedClaimIds: Object.freeze([...block.usedClaimIds]),
    usedPolicyUnitIds: Object.freeze([...block.usedPolicyUnitIds]),
  })))
  return Object.freeze({
    answer: frozenBlocks.map((block) => block.text).join(format === "bullets" ? "\n" : " "),
    blocks: frozenBlocks,
    addressedTargetIds: Object.freeze(unique(frozenBlocks.flatMap((block) => block.targetIds))),
    addressedObligationIds: Object.freeze(unique(frozenBlocks.flatMap((block) => block.obligationIds))),
    usedClaimIds: Object.freeze(unique(frozenBlocks.flatMap((block) => block.usedClaimIds))),
    usedPolicyUnitIds: Object.freeze(unique(frozenBlocks.flatMap((block) => block.usedPolicyUnitIds))),
    illustrationKind,
    ...(compositionDecisions.length ? { compositionDecisions: Object.freeze([...compositionDecisions]) } : {}),
  })
}

function hasEveryTarget(plan: StudentAnswerExecutionPlan, targetIds: readonly string[]) {
  return targetIds.every((targetId) => plan.activeTargetIds.includes(targetId))
}

type LocalCaseTargetProjection = Readonly<{
  text: string
  usedClaimIds: readonly string[]
}>

function capitalizedStudentLabel(value: string) {
  return value.length ? `${value[0]!.toLocaleUpperCase("tr-TR")}${value.slice(1)}` : value
}

function citationFreeStudentClaim(value: string) {
  return value
    .replace(/\s*\([^)]*\d{4}[^)]*\)\s*/gu, " ")
    .replace(/\s+/gu, " ")
    .replace(/\s+([.,;:!?])/gu, "$1")
    .trim()
}

function primaryTargetExplanationClaim(target: StudentAnswerExecutionPlan["targetEvidence"][number]) {
  // Share the existing local explanation choice with the provider block's
  // primary support binding. A paragraph lead-in is not necessarily the
  // explanation of this target. Select only an already-locked source clause;
  // never infer source usage from fuzzy similarity or credit the whole input.
  const aliases = target.visibleAliases.map(normalizeDnaChatText)
  return target.claims.find((claim) => claim.role !== "contrast"
    && aliases.some((alias) => normalizeDnaChatText(claim.text).startsWith(`${alias} ise `)))
    ?? target.claims.find((claim) => claim.role !== "contrast") ?? target.claims[0]!
}

function localCaseTargetProjection(
  target: StudentAnswerExecutionPlan["targetEvidence"][number],
): LocalCaseTargetProjection {
  if (target.studentTargetId === "self_regulation") {
    const claim = target.claims.find((candidate) => candidate.text.includes("dikkatini ve davranışlarını"))
    if (claim) return Object.freeze({
      text: "Öz düzenlemede çocuğun dikkatini ve davranışını bulunduğu duruma göre ayarlamasına bakılır.",
      usedClaimIds: Object.freeze([claim.claimId]),
    })
  }
  if (target.studentTargetId === "attention") {
    const claim = target.claims.find((candidate) => candidate.text.includes("amaç doğrultusunda sürdürülmesi"))
    if (claim) return Object.freeze({
      text: "Dikkatte ise odağın amaç doğrultusunda sürdürülmesine bakılır.",
      usedClaimIds: Object.freeze([claim.claimId]),
    })
  }
  if (target.studentTargetId === "emotion_regulation") {
    const claim = target.claims.find((candidate) => candidate.text.includes("tek bir anda ortaya çıkmadığını"))
    if (claim) return Object.freeze({
      text: "Duygu düzenlemede ise, duygusal tepkinin tek bir anda değil süreç içinde nasıl oluştuğuna bakılır.",
      usedClaimIds: Object.freeze([claim.claimId]),
    })
  }
  if (target.studentTargetId === "arousal") {
    const claim = target.claims.find((candidate) => candidate.text.includes("genel aktivasyon"))
    if (claim) return Object.freeze({
      text: "Arousal açısından kişinin genel aktivasyon düzeyine ve çevresel bilgiye yanıt verebilirliğine bakılır.",
      usedClaimIds: Object.freeze([claim.claimId]),
    })
  }
  if (target.studentTargetId === "sensory_regulation") {
    const claim = target.claims.find((candidate) => candidate.text.includes("bedeninden ve çevresinden gelen duyusal bilgiyi"))
    if (claim) return Object.freeze({
      text: "Duyusal düzenlemede çocuğun bedeninden ve çevreden gelen duyusal bilgiyi fark edip etkinliğe uygun bir yanıt oluşturmasına bakılır.",
      usedClaimIds: Object.freeze([claim.claimId]),
    })
  }
  if (target.studentTargetId === "coregulation") {
    const claim = target.claims.find((candidate) => candidate.text.includes("diğerinin duygusal ve fizyolojik durumunu"))
    if (claim) return Object.freeze({
      text: "Eş düzenlemede ise öğretmenin desteğinin çocuğun duygusal ve bedensel durumunu düzenlemeye nasıl katkı sağladığına bakılır.",
      usedClaimIds: Object.freeze([claim.claimId]),
    })
  }
  const label = target.visibleAliases[0] ?? target.ownerBookTopicTitle.split(" · ").at(-1) ?? target.studentTargetId
  // A paragraph lead-in can name several concepts without explaining this one.
  // Prefer its already-selected, explicitly target-owned explanatory clause.
  // Keep the canonical wording and its actual ID together; do not infer a
  // definition, widen retrieval, or credit unrelated supplied source units.
  const aliases = target.visibleAliases.map(normalizeDnaChatText)
  const claim = primaryTargetExplanationClaim(target)
  const text = citationFreeStudentClaim(claim.text)
  const namesTarget = aliases.some((alias) => normalizeDnaChatText(text).startsWith(`${alias} `))
  return Object.freeze({
    text: namesTarget ? text : `${capitalizedStudentLabel(label)}: ${text}`,
    usedClaimIds: Object.freeze([claim.claimId]),
  })
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
    && (/\b(?:yavas\w*|yumusat\w*|sakin\w*|yan(?:ina|inda)\w*|destek\w*)\b/u.test(normalized)
      || /\bgel\w*.{0,40}\b(?:duzel|sakinles|don)\w*\b/u.test(normalized))
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
  if (hasEveryTarget(plan, ["arousal", "sensory_regulation", "coregulation"])
    && (hasEnvironmentLoad || hasMovementRise || hasAdultSupport)) {
    const historyEvents = new Set(plan.caseHistoryContext?.eventIds ?? [])
    const completeHistorySequence = historyEvents.has("environmental_load_observed")
      && historyEvents.has("activation_increased")
      && historyEvents.has("adult_support_received")
      && historyEvents.has("activity_resumed")
    if (completeHistorySequence) {
      return "Bu parçalı cümle önceki iki sahneyi birleştiriyor: çocuk kalabalık sınıfa girince sesini yükseltiyor ve daha çok hareket ediyor; öğretmen yanına gelip yavaş konuşunca çocuk sakinleşip oyuna dönüyor. Duyusal düzenleme kalabalık ve sesle davranış arasındaki ilişkiyi, arousal ses ve hareket artışındaki genel aktivasyon düzeyini, eş düzenleme ise yetişkin desteğinden sonraki toparlanmayı açıklar. Üçü aynı olayda yer alabilir ama aynı şey değildir. Tek bir gözlem hangisinin belirleyici olduğunu söylemek için yeterli değil; farklı zaman, ortam ve görevlerdeki tekrarlara, olayın öncesi ve sonrasına ve destekle nasıl değiştiğine bakılır. Örneğin hareket artışı duyusal yükle, genel aktivasyon düzeyiyle veya yetişkin desteğine verilen yanıtla ilişkili olabilir; tek bir nedeni seçmek için yeterli bilgi yoktur."
    }
    const lead = plan.caseHistoryContext
      ? "Önceki sahneleri bu parçalı anlatımla birleştirdiğimizde"
      : "Bu parçalı anlatım tek bir sahne olarak okunduğunda"
    return `${lead} duyusal düzenleme, arousal ve eş düzenleme açısından üç ayrı noktayı incelemek gerekir: ortamın duyusal yükü, ses veya hareketle görülen aktivasyon değişikliği ve davranışın yetişkin desteğinden sonra nasıl değiştiği. Bunların her biri bir olasılık alanıdır; tek bir gözlem doğrudan bir kavramla eşitlenemez.`
  }
  if (hasEveryTarget(plan, ["coregulation"]) && hasAdultSupport && hasActivityReturn) {
    return "Öğretmenin yanına gelip yavaş konuşmasının ardından çocuğun sakinleşip oyuna dönmesi, eş düzenleme açısından yetişkin desteğinin çocuğun duygusal ve bedensel durumunu düzenlemeye eşlik ettiği somut bir örnek olarak düşünülebilir."
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
  const referentEventLabels = plan.historyAnchor?.caseContext?.eventLabels ?? []
  if (hasHistoryReferent && referentEventLabels.length) {
    const eventPhrase = referentEventLabels.length === 1
      ? referentEventLabels[0]!
      : `${referentEventLabels.slice(0, -1).join(", ")} ve ${referentEventLabels.at(-1)}`
    const labels = plan.targetEvidence.map((target) => target.visibleAliases[0]).filter(Boolean).join(" ve ")
    return `Önceki örnekte ${eventPhrase} birlikte görülmüştü. Bu olay dizisi, ${labels} açısından işlevi ve bağlamı korunarak değerlendirilmelidir.`
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

function requiresLocalCaseExplanation(plan: StudentAnswerExecutionPlan) {
  return plan.executionRoute === "local_safety_boundary" && plan.operation === "case_reasoning"
    && plan.obligations.some((obligation) => obligation.kind === "explain_target")
}

/** Bind an existing single-observation limit to the user's explicit polar
 * question, without affirming its proposition or adding scientific knowledge.
 * The short question stays transient: it is not added to the plan or history
 * metadata. Ambiguous, compound or unsafe-to-quote text uses the existing path.
 */
function localCaseInferenceLimit(question: string, plan: StudentAnswerExecutionPlan): string | null {
  if (!requiresLocalCaseExplanation(plan)
    || !plan.obligations.some(o => o.kind === "state_single_observation_limit")
    || !plan.policyUnits.some(p => p.id === "policy.single-observation-limit")
    || /[\r\n<>={}\[\]@\\]/u.test(question)) return null
  const clean = question.trim().replace(/\s+/gu, " ")
  const lower = clean.toLocaleLowerCase("tr-TR")
  const particle = /\s+m[ıiuü](?:y(?:ız|iz|uz|üz)|d(?:ır|ir|ur|ür))?(?=\s|[?.,;!]|$)/gu
  if ([...lower.matchAll(particle)].length !== 1) return null
  const match = lower.match(/^([\p{L}][\p{L}\p{M} ’'-]{2,155}? m[ıiuü](?:y(?:ız|iz|uz|üz)|d(?:ır|ir|ur|ür))?)(?=\s|[?.,;!]|$)/u)
  if (!match || /^(?:\s*[?,]?\s*)(?:yoksa|ya da)\b/u.test(lower.slice(match[1]!.length))) return null
  const quoted = capitalizedStudentLabel(clean.slice(0, match[1]!.length))
  return `“${quoted}?” sorusuna kesin yanıt vermek için tek gözlem yeterli değildir.`
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
  const caseTargetProjections = plan.targetEvidence.map(localCaseTargetProjection)
  const hiddenCompositionPolicyIds = new Set([
    "policy.illustrative-scenario",
    "policy.example-target-binding",
  ])
  const obligationKinds = new Set(plan.obligations.map((row) => row.kind))
  const distinguishStatement = "Bu kavramlar aynı şey değildir."
  const relationStatement = "Aralarındaki ilişkiyi kurarken her kavramı kendi kaynak bilgisiyle ayrı ele almak gerekir."
  const relationStatements = [
    ...(obligationKinds.has("distinguish_targets") ? [distinguishStatement] : []),
    ...(obligationKinds.has("explain_relation") ? [relationStatement] : []),
  ]
  const explicitSlotStatements = [
    ...(obligationKinds.has("explain_mechanism")
      ? ["Mekanizma açısından, bu bağlam tek başına hedefe özgü kesin bir işleyiş göstermez."] : []),
    ...(obligationKinds.has("explain_daily_life_meaning")
      ? ["Günlük yaşamdaki anlamı, hedefin farklı görev ve ortamlardaki katılımla birlikte değerlendirilmesidir."] : []),
  ]
  const exampleStatement = obligationKinds.has("give_concrete_example")
    ? "Örnek: Bu kavramları yalnız açıklayıcı varsayımsal bir durumda düşünebiliriz." : null
  const caseStatement = localCaseObservationStatement(question, plan, hasHistoryReferent)
  const inferenceLimit = localCaseInferenceLimit(question, plan)
  const normalizedCaseStatement = normalizeDnaChatText(caseStatement ?? "")
  const policyStatements = plan.policyUnits
    .filter((unit) => !hiddenCompositionPolicyIds.has(unit.id))
    .filter((unit) => !(inferenceLimit && unit.id === "policy.single-observation-limit"))
    .filter((unit) => !plan.obligations.some((obligation) =>
      POLICY_ID_BY_OBLIGATION_KIND[obligation.kind] === unit.id
        && visibleObligation(obligation.kind, normalizedCaseStatement)))
    .map((unit) => unit.text)
  const renderedCaseStatement = caseStatement && obligationKinds.has("give_concrete_example")
    ? `Örnek: ${caseStatement}`
    : caseStatement
  const targetSpecificCaseExplanationRequired = obligationKinds.has("distinguish_targets")
    || obligationKinds.has("explain_relation")
    || (plan.operation === "case_reasoning" && plan.activeTargetIds.length > 1)
    || requiresLocalCaseExplanation(plan)
  const caseStatementAlreadyDistinguishes = Boolean(caseStatement
    && /\bbirbirinden\s+ayir\w*\b/u.test(normalizeDnaChatText(caseStatement)))
  const caseStatementAlreadyMapsEveryTarget = Boolean(caseStatement
    && ((normalizedCaseStatement.includes("parcali anlatim")
      && normalizedCaseStatement.includes("uc ayri nokta"))
      || (normalizedCaseStatement.includes("duyusal duzenleme kalabalik ve ses")
        && normalizedCaseStatement.includes("arousal ses ve hareket")
        && normalizedCaseStatement.includes("es duzenleme ise ogretmenin desteginden sonra"))
      || (normalizedCaseStatement.includes("duyusal duzenleme kalabalik ve sesle")
        && normalizedCaseStatement.includes("arousal ses ve hareket artisindaki")
        && normalizedCaseStatement.includes("es duzenleme ise yetiskin desteginden sonraki"))))
  const contentStatements = caseStatement
    ? [
        renderedCaseStatement!,
        ...(targetSpecificCaseExplanationRequired && (!caseStatementAlreadyMapsEveryTarget || requiresLocalCaseExplanation(plan))
          ? [
              ...(obligationKinds.has("distinguish_targets") && !caseStatementAlreadyDistinguishes
                ? [distinguishStatement] : []),
              ...caseTargetProjections.map((projection) => projection.text),
            ] : []),
        ...explicitSlotStatements,
        ...policyStatements,
      ]
    : [...relationStatements,
        ...(requiresLocalCaseExplanation(plan) ? caseTargetProjections.map((projection) => projection.text) : targetStatements),
        ...explicitSlotStatements, ...policyStatements, ...(exampleStatement ? [exampleStatement] : [])]
  const text = [...(inferenceLimit ? [inferenceLimit] : []), ...contentStatements]
    .join(" ")
  return composeCandidate([Object.freeze({
    blockId: "b1",
    blockKind: exampleStatement ? "example" : "content",
    text,
    targetIds: Object.freeze([...plan.activeTargetIds]),
    obligationIds: Object.freeze(plan.obligations.map((obligation) => obligation.id)),
    usedClaimIds: Object.freeze((targetSpecificCaseExplanationRequired && caseStatement) || requiresLocalCaseExplanation(plan)
      ? unique(caseTargetProjections.flatMap((projection) => projection.usedClaimIds))
      : plan.targetEvidence.map((row) =>
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
  state_context_dependency: "policy.context-dependent-participation",
  avoid_context_free_judgment: "policy.contextual-judgment",
  refuse_treatment_selection: "policy.no-treatment-selection",
  offer_safe_assessment_frame: "policy.safe-assessment-frame",
  state_evidence_limit: "policy.evidence-limit",
  summarize_unknown: "policy.evidence-limit",
  avoid_causal_overclaim: "policy.no-causal-overclaim",
  describe_measurement_scope: "policy.measurement-scope",
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

const DETERMINISTIC_POLICY_KINDS: readonly StudentRequestContract["obligations"][number]["kind"][] = Object.freeze([
  "state_single_observation_limit",
  "name_additional_context",
  "name_multiple_plausible_explanations",
  "avoid_context_free_judgment",
  "state_context_dependency",
  "refuse_treatment_selection",
  "offer_safe_assessment_frame",
  "state_evidence_limit",
  "avoid_causal_overclaim",
  "describe_measurement_scope",
])

const DAILY_LIFE_OUTCOME_EVIDENCE_SIGNAL = /\b(?:günlük\s+(?:yaşam|hayat)|katılım|etkinlik|rutin|okul|oyun|öz\s*bakım|sosyal\s+yaşam|beslenme|fiziksel\s+temas|bakım\s+veren)\w*\b/iu
const DAILY_LIFE_DECISION_EVIDENCE_SIGNAL = /(?:davranış|değerlendirme|yorum|karar)[\p{L}\p{N}_-]*[^.!?]{0,180}(?:açıkla|yetersiz|dikkate\s+al|çıkar)[\p{L}\p{N}_-]*/iu
const MECHANISM_PROCESS_EVIDENCE_SIGNAL = /\b(?:süreç|zaman(?:da|la|\s+çizg)|değiş|geliş|artar|azal|etkile|katkı|oluş|dönüş|başla|sürdür|yönlendir|düzenle|gerçekleş|değildir)\w*\b/iu
const TARGET_BOUNDARY_EVIDENCE_SIGNAL = /\b(?:değil|sınır|sınırl|ancak|tek\s+başına|göstermez|kanıtlamaz|yetersiz|karıştırılmamalı|çıkarılamaz)\w*\b/iu
const MEASUREMENT_METHOD_EVIDENCE_SIGNAL = /\b(?:ölç|puan|test|ölçek|gözlem|veri\s+tür|gösterge|değer|değerlendir|araştırıl)\w*\b/iu
const MEASUREMENT_INTERPRETATION_EVIDENCE_SIGNAL = /\b(?:etkile|koşul|durum|göster|değiş|tutarlı|farklılık)\w*\b/iu

function targetExplanationBaseClaims(
  plan: StudentAnswerExecutionPlan,
  targetIds: readonly string[],
) {
  return Object.freeze(plan.targetEvidence
    .filter((target) => targetIds.includes(target.studentTargetId))
    .flatMap((target) => target.claims.find((claim) => claim.role !== "contrast") ?? []))
}

function targetExplanationBoundaryClaims(
  plan: StudentAnswerExecutionPlan,
  targetIds: readonly string[],
) {
  return Object.freeze(plan.targetEvidence
    .filter((target) => targetIds.includes(target.studentTargetId))
    .flatMap((target) => target.claims.filter((claim) =>
      claim.role !== "contrast" && TARGET_BOUNDARY_EVIDENCE_SIGNAL.test(claim.text))))
}

function targetExplanationClaims(
  plan: StudentAnswerExecutionPlan,
  targetIds: readonly string[],
) {
  const base = targetExplanationBaseClaims(plan, targetIds)
  if (plan.operation === "significance") {
    return Object.freeze(plan.targetEvidence
      .filter((target) => targetIds.includes(target.studentTargetId))
      .flatMap((target) => target.claims.filter((claim) => claim.role !== "contrast").slice(0, 2)))
  }
  return plan.operation === "boundary"
    ? Object.freeze([...new Map(
      [...base, ...targetExplanationBoundaryClaims(plan, targetIds)].map((claim) => [claim.claimId, claim]),
    ).values()])
    : base
}

function measurementEvidenceClaims(
  plan: StudentAnswerExecutionPlan,
  targetIds: readonly string[],
) {
  return Object.freeze(plan.targetEvidence
    .filter((target) => targetIds.includes(target.studentTargetId))
    .flatMap((target) => {
      const eligible = target.claims.filter((claim) => claim.role !== "contrast")
      const methodClaims = eligible.filter((claim) => MEASUREMENT_METHOD_EVIDENCE_SIGNAL.test(claim.text))
      if (!methodClaims.length) return eligible
      const interpretationClaims = eligible.filter((claim) =>
        TARGET_BOUNDARY_EVIDENCE_SIGNAL.test(claim.text)
          || MEASUREMENT_INTERPRETATION_EVIDENCE_SIGNAL.test(claim.text))
      return [...new Map([...methodClaims, ...interpretationClaims]
        .map((claim) => [claim.claimId, claim])).values()]
    }))
}

function supportedMechanismClaims(
  claims: StudentAnswerExecutionPlan["targetEvidence"][number]["claims"],
) {
  const eligible = claims.filter((claim) => claim.role !== "contrast")
  const processClaims = eligible.filter((claim, index) =>
    (index > 0 ? MECHANISM_PROCESS_EVIDENCE_SIGNAL : /\bsüreç\w*\b/iu).test(claim.text)
      && !DAILY_LIFE_DECISION_EVIDENCE_SIGNAL.test(claim.text))
  return processClaims.length >= 2 ? processClaims : Object.freeze([])
}

function relationEvidenceClaims(
  plan: StudentAnswerExecutionPlan,
  targetIds: readonly string[],
) {
  const targets = plan.targetEvidence.filter((target) => targetIds.includes(target.studentTargetId))
  const selected = new Map<string, StudentAnswerExecutionPlan["targetEvidence"][number]["claims"][number]>()
  for (const target of targets) {
    const eligible = target.claims.filter((claim) => claim.role !== "contrast")
    if (eligible[0]) selected.set(eligible[0].claimId, eligible[0])
    const otherAliases = targets
      .filter((other) => other.studentTargetId !== target.studentTargetId)
      .flatMap((other) => other.visibleAliases.map(normalizeDnaChatText))
      .filter((alias) => alias.length >= 4)
    for (const claim of eligible) {
      const normalizedClaim = normalizeDnaChatText(claim.text)
      if (otherAliases.some((alias) => normalizedClaim.includes(alias))) selected.set(claim.claimId, claim)
      if (targets.length === 1 && (DAILY_LIFE_OUTCOME_EVIDENCE_SIGNAL.test(claim.text)
        || /\b(?:ilişki|etkile|katılım|destekle|azal|artır)\w*\b/iu.test(claim.text))) {
        selected.set(claim.claimId, claim)
      }
    }
  }
  return Object.freeze([...selected.values()])
}

function crossTargetRelationClaims(plan: StudentAnswerExecutionPlan, targetIds: readonly string[]) {
  const targets = plan.targetEvidence.filter((target) => targetIds.includes(target.studentTargetId))
  return Object.freeze([...new Map(targets.flatMap((target) => {
    const otherAliases = targets.filter((other) => other.studentTargetId !== target.studentTargetId)
      .flatMap((other) => other.visibleAliases.map(normalizeDnaChatText)).filter((alias) => alias.length >= 4)
    return studentRelationSourceUnits(target.claims, otherAliases).flat()
  }).map((claim) => [claim.claimId, claim])).values()])
}

function sourceComponentMemberships(plan: StudentAnswerExecutionPlan, targetIds: readonly string[]) {
  const targets = plan.targetEvidence.filter((target) => targetIds.includes(target.studentTargetId))
  return targets.flatMap((parent) => {
    const anchor = parent.claims.find((claim) => claim.role === "target")
    if (!anchor) return []
    const paragraph = anchor.passageId.replace(/:sentence:\d+$/u, "")
    return parent.claims.filter((claim) => claim.role !== "contrast"
      && claim.passageId.replace(/:sentence:\d+$/u, "") === paragraph).flatMap((claim) => {
      // Only an explicit, affirmative list in the definition's own paragraph
      // grants component authority. A co-mention or an LLM ordering does not.
      const list = citationFreeStudentClaim(claim.text).match(
        /^(?:Temel|Çekirdek) bileşenler(?: çoğunlukla)? (.+?) olarak sınıflandırılır\.?$/iu,
      )?.[1]
      if (!list) return []
      const members = list.split(/,|\s+ve\s+/iu).map(normalizeDnaChatText)
      if (members.length < 2) return []
      return targets.filter((member) => member.studentTargetId !== parent.studentTargetId
        && member.visibleAliases.some((alias) => members.includes(normalizeDnaChatText(alias))))
        .map((member) => ({ parent, member, anchorClaimId: anchor.claimId, relationClaimId: claim.claimId }))
    })
  })
}

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
    // Summary slots receive a source paragraph, including dependent clauses.
    // Bind that whole input unit instead of retaining only its first claim ID.
    if (plan.operation === "summarize" && evidence) return evidence.claims.map((claim) => claim.claimId)
    // Bind the bounded source unit supplied to the content duty, not only its
    // first sentence. The separate limit duty keeps its policy-only projection.
    if (evidence && obligations.some((obligation) => obligation.kind === "explain_source_evidence")) {
      return evidence.claims.filter((claim) => claim.role !== "contrast").map((claim) => claim.claimId)
    }
    // A request-scoped source unit must survive the handoff and public source
    // projection. These IDs bind the supplied evidence, not a semantic verdict.
    if (evidence?.requestedSubtopicEvidence) {
      return lockedClaimsForAnswerSlot(evidence.claims, obligations, false).map((claim) => claim.claimId)
    }
    const dailyLifeSlot = obligations.some((obligation) => obligation.kind === "explain_daily_life_meaning")
    const mechanismSlot = obligations.some((obligation) => obligation.kind === "explain_mechanism")
    const deepenSlot = obligations.some((obligation) => obligation.kind === "deepen_with_new_information")
    const relationSlot = obligations.some((obligation) => ["explain_relation", "distinguish_targets"].includes(obligation.kind))
    const measurementSlot = obligations.some((obligation) => obligation.kind === "describe_measurement_scope")
    const targetExplanationSlot = obligations.some((obligation) => obligation.kind === "explain_target")
      && ["significance", "boundary", "measurement"].includes(plan.operation)
    const structuredDefinitionSlot = obligations.some((obligation) => obligation.kind === "define_target")
      && Boolean(evidence && evidence.claims.length > 3 && evidence.claims[0]?.text.trim().endsWith(":"))
    if (structuredDefinitionSlot) return evidence!.claims.map((claim) => claim.claimId)
    if (evidence && obligations.some(o => o.kind === "define_target")
      && contextOnlyDefinitionClaims(evidence.claims)) return evidence.claims
        .filter(c => c.role === "context").map(c => c.claimId)
    // The comparison composer already receives this full non-contrast source
    // unit. Bind it rather than dropping useful context to match two base IDs.
    // Cross-target link authority remains a separate, narrower projection.
    if (relationSlot && evidence) return evidence.claims.filter((claim) => claim.role !== "contrast")
      .map((claim) => claim.claimId)
    if (measurementSlot) return measurementEvidenceClaims(plan, targetIds).map((claim) => claim.claimId)
    if (targetExplanationSlot) return targetExplanationClaims(plan, targetIds).map((claim) => claim.claimId)
    if (deepenSlot && mechanismSlot && evidence) {
      const structuredSequence = evidence.claims.length > 3 && evidence.claims[0]?.text.trim().endsWith(":")
      if (structuredSequence) return evidence.claims.map((claim) => claim.claimId)
      const eligible = evidence.claims.filter((claim) => claim.role !== "contrast")
      const novelClaims = (eligible.length > 1 ? eligible.slice(1) : eligible)
        .filter((claim) => !claim.text.trim().endsWith(":"))
      return (novelClaims.length ? novelClaims : eligible).map((claim) => claim.claimId)
    }
    if (mechanismSlot && evidence) {
      const processClaims = supportedMechanismClaims(evidence.claims)
      if (processClaims.length) return processClaims.map((claim) => claim.claimId)
    }
    if (deepenSlot && evidence) {
      const eligible = evidence.claims.filter((claim) => claim.role !== "contrast")
      const novelClaims = eligible.length > 1 ? eligible.slice(1) : eligible
      if (novelClaims.length) return novelClaims.map((claim) => claim.claimId)
    }
    if (evidence && obligations.some((obligation) => obligation.kind === "explain_target")) {
      // The visible composer can explain a later target-owned clause while the
      // old positional first-ID binding loses it at the summary handoff.
      // This is the required explanation's primary source anchor, not a claim
      // that every provider sentence is entailed or every supplied source used.
      return [primaryTargetExplanationClaim(evidence).claimId]
    }
    const claim = dailyLifeSlot
      ? evidence?.claims.find((candidate) => candidate.role !== "contrast"
        && (DAILY_LIFE_OUTCOME_EVIDENCE_SIGNAL.test(candidate.text)
          || DAILY_LIFE_DECISION_EVIDENCE_SIGNAL.test(candidate.text)))
        ?? evidence?.claims.find((candidate) => candidate.role !== "contrast")
      : evidence?.claims.find((candidate) => candidate.role !== "contrast")
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
  const concreteExampleRequired = plan.obligations.some((obligation) => obligation.kind === "give_concrete_example")
  const contentObligations = plan.obligations.filter((obligation) => !COMPOSITION_CONTROL_KINDS.includes(obligation.kind))
  const controlObligations = plan.obligations.filter((obligation) => COMPOSITION_CONTROL_KINDS.includes(obligation.kind))
  const groups: StudentAnswerExecutionPlan["obligations"][] = []
  let sharedExampleAdded = false
  let deepenMechanismAdded = false
  let comparisonAdded = false
  let summaryDistinctionAdded = false
  let significanceAdded = false
  for (const obligation of contentObligations) {
    if (concreteExampleRequired && SHARED_EXAMPLE_KINDS.includes(obligation.kind)) {
      if (sharedExampleAdded) continue
      sharedExampleAdded = true
      groups.push(Object.freeze(contentObligations.filter((row) => SHARED_EXAMPLE_KINDS.includes(row.kind))))
      continue
    }
    if (["deepen_with_new_information", "explain_mechanism"].includes(obligation.kind)
      && contentObligations.some((row) => row.kind === "deepen_with_new_information")
      && contentObligations.some((row) => row.kind === "explain_mechanism")) {
      if (deepenMechanismAdded) continue
      deepenMechanismAdded = true
      groups.push(Object.freeze(contentObligations.filter((row) =>
        ["deepen_with_new_information", "explain_mechanism"].includes(row.kind))))
      continue
    }
    if (["distinguish_targets", "explain_relation"].includes(obligation.kind)
      && contentObligations.some((row) => row.kind === "distinguish_targets")
      && contentObligations.some((row) => row.kind === "explain_relation")) {
      if (comparisonAdded) continue
      comparisonAdded = true
      groups.push(Object.freeze(contentObligations.filter((row) =>
        ["distinguish_targets", "explain_relation"].includes(row.kind))))
      continue
    }
    if (["explain_target", "explain_significance"].includes(obligation.kind)
      && plan.operation === "significance"
      && contentObligations.some((row) => row.kind === "explain_target")
      && contentObligations.some((row) => row.kind === "explain_significance")) {
      if (significanceAdded) continue
      significanceAdded = true
      groups.push(Object.freeze(contentObligations.filter((row) =>
        ["explain_target", "explain_significance"].includes(row.kind))))
      continue
    }
    if (["summarize_known", "distinguish_targets"].includes(obligation.kind)
      && plan.operation === "summarize"
      && contentObligations.some((row) => row.kind === "summarize_known")
      && contentObligations.some((row) => row.kind === "distinguish_targets")) {
      if (summaryDistinctionAdded) continue
      summaryDistinctionAdded = true
      groups.push(Object.freeze(contentObligations.filter((row) =>
        ["summarize_known", "distinguish_targets"].includes(row.kind))))
      continue
    }
    groups.push(Object.freeze([obligation]))
  }
  if (controlObligations.length) {
    if (groups.length) groups[0] = Object.freeze([...groups[0]!, ...controlObligations])
    else groups.push(Object.freeze([...controlObligations]))
  }
  // Semantic owners survive every presentation budget. Neither spare fields
  // nor merged duties may be created before their source/policy projection.
  return Object.freeze(groups)
}

function multiTargetSummarySlotText(
  plan: StudentAnswerExecutionPlan,
  targetIds: readonly string[],
  obligationIds: readonly string[],
): string | null {
  const obligationKinds = new Set(plan.obligations
    .filter((obligation) => obligationIds.includes(obligation.id))
    .map((obligation) => obligation.kind))
  if (plan.operation !== "summarize"
    || !obligationKinds.has("summarize_known")
    || !obligationKinds.has("distinguish_targets")) return null
  const targets = plan.targetEvidence.filter((target) => targetIds.includes(target.studentTargetId))
  // Short comparisons remain deterministic. Broad session summaries need synthesis;
  // concatenating every locked claim produces a correct but unusably academic answer.
  // A history-grounded summary has prior detail duties even with only two targets.
  // Never replace its provider synthesis with the first definition of each target.
  if (targets.some(target => target.priorAcceptedSupportClaimIds?.length)) return null
  if (targets.length < 2 || targets.length > 3) return null
  const statements = targets.map((target) => {
    const label = target.visibleAliases[0]
      ?? target.ownerBookTopicTitle.split(" · ").at(-1)
      ?? target.studentTargetId
    const claim = target.claims.find((candidate) => candidate.role !== "contrast") ?? target.claims[0]
    return claim ? `${capitalizedStudentLabel(label)}: ${citationFreeStudentClaim(claim.text)}` : null
  }).filter((statement): statement is string => Boolean(statement))
  if (statements.length !== targets.length) return null
  return `Temel farkları şöyledir: ${statements.join(" ")} Bu nedenle bu kavramlar aynı şey değildir.`
}

function answerSlotMetadata(plan: StudentAnswerExecutionPlan): readonly StudentAnswerSlotMetadata[] {
  return Object.freeze(answerObligationGroups(plan).map((obligations, index) =>
    slotMetadataForObligations(plan, obligations, index)))
}

function answerSentenceBudgets(plan: StudentAnswerExecutionPlan): readonly number[] | null {
  const requested = plan.presentation.requestedSentenceCount
  if (requested === null) return null
  const groups = answerObligationGroups(plan)
  const budgets = groups.map(() => 1)
  // Additional space expands the known-content section. The inference limit
  // keeps its own role; no unowned field receives the rest of the answer.
  const known = groups.findIndex((group) => group.some((row) => row.kind === "summarize_known"))
  const observation = groups.findIndex((group) => group.some((row) => row.kind === "summarize_observation_focus"))
  const content = groups.findIndex((group) => group.some((row) =>
    ![...SHARED_EXAMPLE_KINDS, ...DETERMINISTIC_POLICY_KINDS, ...COMPOSITION_CONTROL_KINDS].includes(row.kind)))
  const expansion = known >= 0 ? known : observation >= 0 ? observation : content >= 0 ? content : 0
  if (budgets.length && requested > budgets.length) budgets[expansion]! += requested - budgets.length
  return Object.freeze(budgets)
}

function isSharedScenarioSlot(plan: StudentAnswerExecutionPlan, slot: StudentAnswerSlotMetadata) {
  return slot.blockKind === "example" && plan.obligations.some((obligation) =>
    slot.obligationIds.includes(obligation.id) && obligation.kind === "use_shared_scenario")
}

type DefinitionScopeSelection = Readonly<{
  requestFocus: "definition_difference" | "definition_scope" | "source_connection"
  scopeOrder: "first_narrower" | "second_narrower" | "not_ordered"
  providerScopeOrder: "first_narrower" | "second_narrower" | "not_ordered"
  scopeAuthority: ReturnType<typeof sourceBoundDefinitionScope>
  definitionPremises: readonly Readonly<{ targetId: string; claimId: string; excerptStart: number; excerptEnd: number }>[]
}>

function definitionPremiseSources(plan: StudentAnswerExecutionPlan, slot: StudentAnswerSlotMetadata) {
  return plan.targetEvidence.filter((target) => slot.targetIds.includes(target.studentTargetId)).map((target) => {
    const claim = target.claims.find((claim) => claim.role !== "contrast")!
    return Object.freeze({ targetId: target.studentTargetId, claimId: claim.claimId,
      definitionText: citationFreeStudentClaim(claim.text) })
  })
}

function isDefinitionScopeSlot(plan: StudentAnswerExecutionPlan, slot: StudentAnswerSlotMetadata) {
  const duties = plan.obligations.filter((row) => slot.obligationIds.includes(row.id))
  return slot.targetIds.length === 2 && !plan.historyAnchor?.caseContext?.eventIds.length
    && !plan.currentComparisonContext
    && duties.some((row) => row.kind === "distinguish_targets")
    && duties.every((row) => ["distinguish_targets", "explain_relation", ...COMPOSITION_CONTROL_KINDS].includes(row.kind))
}

function definitionScopeSelection(value: unknown, plan: StudentAnswerExecutionPlan, slot: StudentAnswerSlotMetadata): DefinitionScopeSelection | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (!sameSet(Object.keys(row), ["requestFocus", "scopeOrder"])
    || !["definition_difference", "definition_scope", "source_connection"].includes(String(row.requestFocus))
    || !["first_narrower", "second_narrower", "not_ordered"].includes(String(row.scopeOrder))
    || row.requestFocus !== "definition_scope" && row.scopeOrder !== "not_ordered") return null
  if (plan.requestedRelationFocus && row.requestFocus !== plan.requestedRelationFocus) return null
  const sources = definitionPremiseSources(plan, slot)
  if (!sameSet(slot.targetIds, sources.map(source => source.targetId))
    || sources.some(source => !source.definitionText.trim())) return null
  // The plan already owns the target-bound source. Never ask the model to
  // transcribe it, then treat an innocuous paraphrase as a missing answer.
  // Full canonical offsets are retained; provider-supplied prose, offsets and
  // source IDs remain forbidden, rather than accepted by fuzzy matching.
  const definitionPremises = sources.map(source => Object.freeze({
    targetId: source.targetId, claimId: source.claimId,
    excerptStart: 0, excerptEnd: source.definitionText.length,
  }))
  const scopeAuthority = sourceBoundDefinitionScope(sources.map(s => ({ ...s,
    aliases: plan.targetEvidence.find(t => t.studentTargetId === s.targetId)!.visibleAliases })))
  // Retain the model's choice for diagnosis, never use it as source authority.
  const scopeOrder = row.requestFocus !== "definition_scope" || !scopeAuthority ? "not_ordered"
    : sources[0]!.targetId === scopeAuthority.narrowerTargetId ? "first_narrower" : "second_narrower"
  return Object.freeze({ requestFocus: row.requestFocus, scopeOrder, providerScopeOrder: row.scopeOrder, scopeAuthority,
    definitionPremises: Object.freeze(definitionPremises) } as DefinitionScopeSelection)
}

type SharedScenarioDiscourse = Readonly<{
  kind: "shared_scenario"
  activity: string
  applications: readonly Readonly<{ targetId: string; eventStep: string; conceptLink: string }>[]
}>

function sharedApplicationBudgets(slot: StudentAnswerSlotMetadata, budget: number) {
  const budgets = slot.targetIds.map(() => 1)
  for (let extra = 0; extra < budget - 1 - budgets.length; extra++) budgets[extra % budgets.length]!++
  return budgets
}

function sharedScenarioDiscourse(value: unknown, slot: StudentAnswerSlotMetadata, budget: number): SharedScenarioDiscourse | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (!sameSet(Object.keys(row), ["activity", "applications"]) || typeof row.activity !== "string"
    || row.activity.trim().length < 4 || row.activity.length > 4_000) return null
  if (!row.applications || typeof row.applications !== "object" || Array.isArray(row.applications)) return null
  const applications = row.applications as Record<string, unknown>
  const budgets = sharedApplicationBudgets(slot, budget)
  if (!sameSet(Object.keys(applications), slot.targetIds)) return null
  const units = slot.targetIds.flatMap((id, index) => {
    const n = budgets[index]!
    const raw = n > 1 ? applications[id] : [applications[id]]
    if (!Array.isArray(raw) || raw.length !== n) return [null]
    return raw.map((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return null
      const pair = value as Record<string, unknown>
      if (!sameSet(Object.keys(pair), ["eventStep", "conceptLink"])) return null
      const event = ownedSentenceFragments(pair.eventStep, 1)
      const link = ownedSentenceFragments(pair.conceptLink, 1)
      if (!event || !link) return null
      return Object.freeze({ targetId: id, eventStep: event[0]!, conceptLink: link[0]! })
    })
  })
  if (units.some((unit) => !unit)) return null
  // The event and its conceptual interpretation are distinct provider fields;
  // their target ownership is preserved through the visible projection.
  return Object.freeze({ kind: "shared_scenario", activity: row.activity.trim(),
    applications: Object.freeze(units) } as SharedScenarioDiscourse)
}

function realizeSharedScenarioDiscourse(value: SharedScenarioDiscourse, plan: StudentAnswerExecutionPlan, budget: number): string | null {
  const counted = plan.presentation.requestedSentenceCount !== null
  const renderPart = (content: string) => {
    // Do not tokenize valid field text just to rejoin it: decimals and internal
    // abbreviations are not boundaries between the already-typed fields.
    const scoped = containsUnrequestedExampleBoundary(content, plan)
      ? withoutUnrequestedExampleBoundary(content, plan, "example") : content
    if (scoped.trim().length < 4) return null
    return counted ? asSingleSentenceFragment(scoped)
      : naturalizeProviderStudentProse(scoped, false)
  }
  const activity = renderPart(withoutProviderExampleLead(value.activity))
  const applications = value.applications.map((application) => {
    const target = plan.targetEvidence.find((target) => target.studentTargetId === application.targetId)
    if (!target) return null
    const label = target.visibleAliases[0] ?? target.ownerBookTopicTitle.split(" · ").at(-1) ?? application.targetId
    const event = renderPart(application.eventStep)
    const link = renderPart(application.conceptLink)
    if (!event || !link) return null
    // Labels are canonical, not supplied by the model. A definition elsewhere
    // in the answer cannot substitute for naming this event's application.
    return `${label}: ${event}${counted ? "; " : " "}${link}`
  })
  const units = [activity, ...applications]
  if (units.some((unit) => !unit)) return null
  // In a counted slot these are clauses of one allocated sentence; otherwise
  // each field keeps its own termination. This grants no semantic quality PASS.
  return counted ? realizeOwnedSentences(units as string[], budget, plan.presentation.format) : units.join(" ")
}

function answerSchema(plan: StudentAnswerExecutionPlan): Record<string, unknown> {
  const illustrationKinds = plan.obligations.some((row) => row.kind === "give_concrete_example")
    ? ["user_supplied", "hypothetical"] : ["none"]
  const slots = answerSlotMetadata(plan)
  const sentenceBudgets = answerSentenceBudgets(plan)
  const slotIds = slots.map((slot) => slot.blockId)
  const textSchema = { type: "string", minLength: 4, maxLength: 4_000 }
  const applicationSchema = { type: "object", additionalProperties: false, required: ["eventStep", "conceptLink"],
    properties: { eventStep: textSchema, conceptLink: textSchema } }
  return {
    type: "object",
    additionalProperties: false,
    required: ["blocks", "illustrationKind"],
    properties: {
      blocks: {
        type: "object",
        additionalProperties: false,
        required: slotIds,
        properties: Object.fromEntries(slots.map((slot, index) => [slot.blockId, isDefinitionScopeSlot(plan, slot) ? {
          type: "object", additionalProperties: false, required: ["requestFocus", "scopeOrder"],
          // Generation must obey the same cross-field invariant as parsing.
          // Distinct definitions do not authorize a simultaneous scope ordering.
          // Keep parser rejection intact; never repair an invalid choice to PASS.
          anyOf: [
            { focus: ["definition_difference", "source_connection"], order: ["not_ordered"] },
            { focus: ["definition_scope"], order: ["first_narrower", "second_narrower", "not_ordered"] },
          ].map(({ focus, order }) => ({ focus: plan.requestedRelationFocus
            ? focus.filter(value => value === plan.requestedRelationFocus) : focus, order }))
            .filter(({ focus }) => focus.length > 0).map(({ focus, order }) => ({
            type: "object", additionalProperties: false, required: ["requestFocus", "scopeOrder"],
            properties: {
              requestFocus: { type: "string", enum: focus },
              scopeOrder: { type: "string", enum: order },
            },
          })),
          properties: {
            requestFocus: { type: "string", enum: plan.requestedRelationFocus
              ? [plan.requestedRelationFocus] : ["definition_difference", "definition_scope", "source_connection"] },
            scopeOrder: { type: "string", enum: ["first_narrower", "second_narrower", "not_ordered"] },
          },
        } : isSharedScenarioSlot(plan, slot) ? {
          type: "object", additionalProperties: false, required: ["activity", "applications"],
          properties: { activity: textSchema, applications: {
            type: "object", additionalProperties: false, required: [...slot.targetIds],
            properties: Object.fromEntries(slot.targetIds.map((targetId, targetIndex) => {
              const n = sharedApplicationBudgets(slot, sentenceBudgets?.[index] ?? 1)[targetIndex]!
              return [targetId, n > 1 ? { type: "array", minItems: n, maxItems: n, items: applicationSchema } : applicationSchema]
            })),
          } },
        } : (sentenceBudgets?.[index] ?? 1) > 1 ? {
          type: "array", minItems: sentenceBudgets![index], maxItems: sentenceBudgets![index], items: textSchema,
        } : textSchema])),
      },
      illustrationKind: { type: "string", enum: illustrationKinds },
    },
  }
}

function providerContent(input: Readonly<{
  question: string
  plan: StudentAnswerExecutionPlan
}>) {
  const sentenceBudgets = answerSentenceBudgets(input.plan)
  return JSON.stringify({
    currentUserMessage: input.question,
    ...(input.plan.obligations.some(o => o.kind === "give_concrete_example") ? {
      scenarioFidelity: { authority: "explicit_user_event_not_scientific_evidence",
        constraints: explicitScenarioEvents(input.question), preserveActorObjectAndOrder: true },
    } : {}),
    operation: input.plan.operation,
    rejectedTargetIds: input.plan.rejectedTargetIds,
    historyAnchor: input.plan.historyAnchor,
    ...(input.plan.summaryEpistemicScope ? { summaryEpistemicScope: input.plan.summaryEpistemicScope } : {}),
    ...(input.plan.targetEvidence.some(target => target.priorAcceptedSupportClaimIds?.length) ? {
      priorAcceptedSupport: { authority: "source_support_for_prior_accepted_answers_not_verbatim_conversation",
        targets: input.plan.targetEvidence.filter(target => target.priorAcceptedSupportClaimIds?.length)
          .map(target => ({ targetId: target.studentTargetId, claimIds: target.priorAcceptedSupportClaimIds })) },
    } : {}),
    answerSlots: answerSlotMetadata(input.plan).map((metadata, index) => {
      const obligations = input.plan.obligations.filter((obligation) => metadata.obligationIds.includes(obligation.id))
      const exampleSlot = obligations.some((obligation) => SHARED_EXAMPLE_KINDS.includes(obligation.kind))
      const sharedScenario = isSharedScenarioSlot(input.plan, metadata)
      const relationSlot = obligations.some((obligation) => ["explain_relation", "distinguish_targets"].includes(obligation.kind))
      const definitionScope = isDefinitionScopeSlot(input.plan, metadata)
      return {
        slotId: metadata.blockId,
        ...(sentenceBudgets ? { [input.plan.operation === "summarize" ? "summaryComposition" : "sentenceComposition"]: {
          sentenceUnits: sentenceBudgets[index],
          representation: definitionScope ? "source_premise_then_scope_selection" : sharedScenario ? "activity_then_target_event_and_concept_link"
            : sentenceBudgets[index]! > 1 ? "sentence_array" : "single_fragment",
          roleOwned: true,
        } } : {}),
        ...(sharedScenario ? { sharedScenarioBinding: {
          scope: "one_activity", targetIds: metadata.targetIds,
          eventAuthority: "activity_actor_object_goal_and_outcome",
          applicationRule: "elaborate_same_event_without_reversing_goal_or_distractor",
          representation: "activity_then_target_event_and_concept_link",
          ...(sentenceBudgets ? { applicationSentenceUnits: Object.fromEntries(metadata.targetIds.map((id, targetIndex) =>
            [id, sharedApplicationBudgets(metadata, sentenceBudgets[index]!)[targetIndex]])) } : {}),
        } } : {}),
        slotKind: metadata.blockKind,
        ...(exampleSlot ? { exampleRealization: {
          authority: "illustration_not_evidence_of_capacity",
          requiredContent: "concrete_actor_action_object_and_outcome_not_definition_repetition",
          targetApplication: "match_each_source_requirement_to_the_actual_event_before_claiming_it_is_demonstrated",
          permittedRelations: ["illustrates_source_process", "difficulty_using_source_process", "not_demonstrated_by_this_event"],
          absentEvidence: "explain_the_missing_condition_without_inventing_a_success_or_diagnosing_a_deficit",
          definitionOnlyIsNotAnExample: true,
        } } : {}),
        obligations,
        ...(definitionScope ? { relationComposition: {
          representation: "source_premise_then_scope_selection",
          sourceBindingVersion: "server-owned-definition-premises@1",
          sourceBindingAuthority: "canonical_target_sources_not_provider_output",
          ...(input.plan.requestedRelationFocus ? { requestedFocus: input.plan.requestedRelationFocus,
            focusAuthority: "observed_user_request_not_provider_choice_or_scientific_evidence" } : {}),
          orderedDefinitionSources: definitionPremiseSources(input.plan, metadata),
          scopeOrderAuthority: "interpretation_of_supplied_definitions_not_empirical_relation_or_subset_fact",
          sourceConnectionAuthority: "explicit_selected_claims_only",
        } } : {}),
        ...(relationSlot ? { relationSupport: {
          authority: "obligation_bound_selected_source_not_exhaustive_science",
          targetIds: metadata.targetIds,
          selectedClaimIds: metadata.usedClaimIds,
          crossTargetClaimIds: crossTargetRelationClaims(input.plan, metadata.targetIds)
            .filter((claim) => metadata.usedClaimIds.includes(claim.claimId)).map((claim) => claim.claimId),
          synthesisScope: "distinct_definitions_and_explicit_source_links_only",
        } } : {}),
        caseBinding: (input.plan.currentComparisonContext ?? input.plan.historyAnchor?.caseContext)
          ? {
              requiredForEveryActiveTarget: true,
              eventLabels: (input.plan.currentComparisonContext ?? input.plan.historyAnchor!.caseContext!).eventLabels,
              ...(input.plan.currentComparisonContext ? { authority: "current_illustrative_events_not_scientific_evidence" } : {}),
              ...(input.plan.currentComparisonContext?.describedSituation ? {
                eventDetailAuthority: "transient_current_message_only_no_invented_event_label",
              } : {}),
            }
          : null,
        activeTargets: input.plan.targetEvidence
          .filter((target) => metadata.targetIds.includes(target.studentTargetId))
          .map((target) => ({
            targetId: target.studentTargetId,
            title: target.ownerBookTopicTitle,
            visibleAliases: target.visibleAliases,
            // A hypothetical shared activity applies the bound concepts, not
            // independent target-specific source examples. Verified source
            // examples keep their existing evidence authority.
            lockedClaims: relationSlot ? target.claims.filter((claim) => metadata.usedClaimIds.includes(claim.claimId))
              : lockedClaimsForAnswerSlot(sharedScenario && target.verifiedExampleEvidence.status === "UNSUPPORTED"
              ? target.claims.filter((claim) => metadata.usedClaimIds.includes(claim.claimId)) : target.claims,
            obligations, exampleSlot),
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
  return plan.operation === "summarize"
    ? `Bu konuşmada ele aldığımız ${phrase} için bildiklerimiz:`
    : `${phrase} açısından:`
}

function deterministicSectionPrefix(
  plan: StudentAnswerExecutionPlan,
  obligationIds: readonly string[],
): string | null {
  const kinds = new Set(plan.obligations
    .filter((obligation) => obligationIds.includes(obligation.id))
    .map((obligation) => obligation.kind))
  if (plan.operation === "summarize") {
    if (kinds.has("summarize_unknown")) return "Kesinleştiremediklerimiz:"
    if (kinds.has("summarize_observation_focus")) return "Gözlemde bakılacaklar:"
  }
  if (kinds.has("explain_mechanism")) return "Mekanizma ve işleyiş açısından:"
  if (kinds.has("explain_daily_life_meaning")) return "Günlük yaşamdaki anlamı:"
  return null
}

function preserveSummaryInferenceLimit(
  text: string,
  plan: StudentAnswerExecutionPlan,
  slot: StudentAnswerSlotMetadata,
): string {
  if (plan.operation !== "summarize" || !plan.summaryEpistemicScope
    || !plan.obligations.some((obligation) => slot.obligationIds.includes(obligation.id)
      && obligation.kind === "summarize_unknown")) return text
  const policy = plan.policyUnits.find((unit) => unit.id === "policy.evidence-limit"
    && slot.usedPolicyUnitIds.includes(unit.id) && plan.summaryEpistemicScope!.limitPolicyIds.includes(unit.id))
  if (!policy) return text
  const assertion = policy.text.split(";")[0]!.trim().replace(/[.!?]+$/u, "")
  if (!normalizeDnaChatText(assertion).endsWith("gostermez")) return text
  // Preserve the bound inference assertion, not an entire generated unknowns
  // section. Only a complete generic claim about this information's standalone
  // evidentiary power is owned here. Topic-specific unknowns and other clauses
  // remain untouched; this is not a general semantic validator or an abstention.
  const weakenedInference = /^(?:bu (?:bilgi|bilgiler|gozlem|gozlemler|bulgu|bulgular|kavramlar)|bunlar|bunlarin) tek basina (?:(?:belirli|kesin) (?:bir )?)?(?:neden|tani|kisiye ozgu sonuc)(?:\s+(?:ve|veya|ya da)?\s*(?:tani|neden|kisiye ozgu sonuc))* (?:gosterip gostermedigini|kanitlayip kanitlamadigini) (?:bilmiyoruz|bilinmiyor)$/u
  return text.split(/([.!?;]+)/u).map((clause, index) => {
    if (index % 2 || !weakenedInference.test(normalizeDnaChatText(clause))) return clause
    return `${clause.match(/^\s*/u)![0]}${assertion}${clause.match(/\s*$/u)![0]}`
  }).join("")
}

function unsupportedDailyLifeSlotText(
  plan: StudentAnswerExecutionPlan,
  targetIds: readonly string[],
  obligationIds: readonly string[],
): string | null {
  const dailyLifeRequested = plan.obligations.some((obligation) =>
    obligationIds.includes(obligation.id) && obligation.kind === "explain_daily_life_meaning")
  if (!dailyLifeRequested) return null
  const targets = plan.targetEvidence.filter((target) => targetIds.includes(target.studentTargetId))
  if (!targets.length) return null
  const outcomeClaims = unique(targets.flatMap((target) => target.claims
    .filter((claim) => claim.role !== "contrast" && DAILY_LIFE_OUTCOME_EVIDENCE_SIGNAL.test(claim.text))
    .map((claim) => citationFreeStudentClaim(claim.text))))
  if (outcomeClaims.length) {
    return `Kaynaktaki somut günlük yaşam karşılığı şudur: ${outcomeClaims.join(" ")}`
  }
  const decisionClaims = unique(targets.flatMap((target) => target.claims
    .filter((claim) => claim.role !== "contrast" && DAILY_LIFE_DECISION_EVIDENCE_SIGNAL.test(claim.text))
    .map((claim) => citationFreeStudentClaim(claim.text))))
  const labels = unique(targets.map((target) => target.visibleAliases[0]).filter(Boolean))
  const phrase = labels.length <= 1
    ? labels[0] ?? "bu hedef"
    : labels.length === 2
      ? `${labels[0]} ve ${labels[1]}`
      : `${labels.slice(0, -1).join(", ")} ve ${labels.at(-1)}`
  const supportedDecision = decisionClaims.length
    ? `Mevcut kaynağın günlük değerlendirmeye taşıdığı nokta şudur: ${decisionClaims.join(" ")}`
    : "Mevcut kaynak bu hedef için doğrudan bir günlük değerlendirme sonucu sunmaz."
  return `${supportedDecision} Bunun dışında kaynak, ${phrase} için okul, oyun, günlük rutin veya katılımda tam olarak hangi sonucun görüleceğini açıklamaz; bu nedenle bu hedeften belirli bir günlük yaşam sonucu çıkarılamaz.`
}

function supportedExampleSlotText(
  plan: StudentAnswerExecutionPlan,
  question: string,
  targetIds: readonly string[],
  obligationIds: readonly string[],
): string | null {
  const normalizedQuestion = normalizeDnaChatText(question)
  const sourceBoundExampleRequested = /\bdesteklen\w*\b/u.test(normalizedQuestion)
    && /\bornek\w*\b/u.test(normalizedQuestion)
  const slotObligations = plan.obligations.filter((obligation) => obligationIds.includes(obligation.id))
  const sourceBoundExampleSlot = slotObligations.some((obligation) =>
    SHARED_EXAMPLE_KINDS.includes(obligation.kind)
      || (plan.operation === "example" && obligation.kind === "explain_daily_life_meaning"))
  if (!sourceBoundExampleRequested || !sourceBoundExampleSlot) return null
  const targets = plan.targetEvidence.filter((target) => targetIds.includes(target.studentTargetId))
  const labels = unique(targets.map((target) => target.visibleAliases[0]).filter(Boolean))
  const unsupportedTargets = targets.filter((target) => target.verifiedExampleEvidence.status === "UNSUPPORTED")
  if (unsupportedTargets.length) {
    const labelPhrase = unique(unsupportedTargets.map((target) => target.visibleAliases[0]).filter(Boolean)).join(" ve ")
      || "bu başlık"
    if (slotObligations.some((obligation) => obligation.kind === "explain_daily_life_meaning")) {
      return `Kaynakta ${labelPhrase} için doğrulanmış somut bir günlük yaşam örneği bulunmuyor; bu nedenle kaynak dışından yeni bir durum eklenemez.`
    }
    return `Kaynakta ${labelPhrase} için doğrulanmış somut bir örnek bulunmuyor; bu nedenle kaynak dışından yeni bir senaryo eklenemez.`
  }
  const supportedClaimIds = new Set(targets.flatMap((target) => target.verifiedExampleEvidence.supportClaimIds))
  const supportedClaims = unique(targets.flatMap((target) => target.claims
    .filter((claim) => supportedClaimIds.has(claim.claimId))
    .map((claim) => citationFreeStudentClaim(claim.text))))
  if (!supportedClaims.length) return null
  if (slotObligations.some((obligation) => obligation.kind === "explain_daily_life_meaning")) {
    return `Kaynakta doğrulanmış günlük yaşam örneği şöyledir: ${supportedClaims.join(" ")}`
  }
  if (!slotObligations.some((obligation) => obligation.kind === "give_concrete_example")) {
    return `Bu doğrulanmış kaynak örneği, ${labels.join(" ve ")} başlığını yalnız kaynakta verilen durumla somutlaştırır.`
  }
  return `Kaynakta doğrulanmış somut örnek şöyledir: ${supportedClaims.join(" ")}`
}

function supportedMechanismSlotText(
  plan: StudentAnswerExecutionPlan,
  targetIds: readonly string[],
  obligationIds: readonly string[],
): string | null {
  const mechanismRequested = plan.obligations.some((obligation) =>
    obligationIds.includes(obligation.id) && obligation.kind === "explain_mechanism")
  if (!mechanismRequested) return null
  const targets = plan.targetEvidence.filter((target) => targetIds.includes(target.studentTargetId))
  if (!targets.length) return null
  const processClaimGroups = targets.map((target) => {
    const definesTargetSeparately = plan.obligations.some((obligation) => obligation.kind === "define_target"
      && obligation.targetIds.includes(target.studentTargetId))
    const definition = definesTargetSeparately ? target.claims.find((claim) => claim.role === "target") : null
    // The definition already owns this sentence. Do not inject it again into
    // the mechanism slot when projecting the locked source over provider text.
    return supportedMechanismClaims(target.claims).filter((claim) => claim.claimId !== definition?.claimId)
  })
  if (processClaimGroups.some((claims) => claims.length < 2)) {
    if (plan.operation !== "measurement") return null
    const labels = unique(targets.map((target) => target.visibleAliases[0]).filter(Boolean))
    const phrase = labels.length <= 1
      ? labels[0] ?? "bu hedef"
      : labels.length === 2
        ? `${labels[0]} ve ${labels[1]}`
        : `${labels.slice(0, -1).join(", ")} ve ${labels.at(-1)}`
    const availableClaims = unique(targets.flatMap((target) => target.claims
      .filter((claim) => claim.role !== "contrast" && !DAILY_LIFE_OUTCOME_EVIDENCE_SIGNAL.test(claim.text))
      .map((claim) => citationFreeStudentClaim(claim.text).replace(/:\s*$/u, "."))))
    return availableClaims.length
      ? `Kaynakta mekanizma açısından desteklenen bilgi bununla sınırlıdır: ${availableClaims.join(" ")} Bunun ötesinde kaynak, ${phrase} için ayrıntılı bir işlem sırası veya kesin mekanizma açıklamaz.`
      : `${phrase} için mevcut kaynak ayrıntılı bir işlem sırası veya kesin mekanizma açıklamaz; bu nedenle yeni bir mekanizma eklenemez.`
  }
  const processClaims = unique(processClaimGroups.flatMap((claims) =>
    claims.map((claim) => citationFreeStudentClaim(claim.text))))
  return processClaims.length >= 2
    ? `Kaynağın desteklediği işleyiş şöyledir: ${processClaims.join(" ")}`
    : null
}

function deepenMechanismSlotText(
  plan: StudentAnswerExecutionPlan,
  targetIds: readonly string[],
  obligationIds: readonly string[],
): string | null {
  const kinds = new Set(plan.obligations
    .filter((obligation) => obligationIds.includes(obligation.id))
    .map((obligation) => obligation.kind))
  if (!kinds.has("deepen_with_new_information") || !kinds.has("explain_mechanism")) return null
  const targets = plan.targetEvidence.filter((target) => targetIds.includes(target.studentTargetId))
  if (!targets.length) return null
  const labels = unique(targets.map((target) => target.visibleAliases[0]).filter(Boolean))
  const phrase = labels.length <= 1
    ? labels[0] ?? "bu hedef"
    : labels.length === 2
      ? `${labels[0]} ve ${labels[1]}`
      : `${labels.slice(0, -1).join(", ")} ve ${labels.at(-1)}`
  const structuredSequenceExhausted = targets.every((target) =>
    target.claims.length > 3 && target.claims[0]?.text.trim().endsWith(":"))
  if (structuredSequenceExhausted) {
    return `${phrase} için kaynakta desteklenen yapılandırılmış akış önceki tanımda bütünüyle verilmiştir. Mevcut kaynak aynı hedef için buna ek bir mekanizma açıklamaz; bu nedenle yeni bir süreç uydurulamaz.`
  }
  const novelClaims = unique(targets.flatMap((target) => {
    const eligible = target.claims.filter((claim) => claim.role !== "contrast")
    return (eligible.length > 1 ? eligible.slice(1) : eligible)
      .filter((claim) => !claim.text.trim().endsWith(":"))
      .map((claim) => citationFreeStudentClaim(claim.text))
  }))
  return novelClaims.length
    ? `Kaynağın önceki tanıma eklediği işleyiş bilgisi şudur: ${novelClaims.join(" ")} Bunun ötesinde kaynak, ${phrase} için daha ayrıntılı bir mekanizma açıklamaz.`
    : `${phrase} için önceki tanıma ek, kaynakta desteklenen yeni bir mekanizma bulunmuyor; bu nedenle yeni bir süreç uydurulamaz.`
}

function relationSlotUnits(
  plan: StudentAnswerExecutionPlan,
  question: string,
  targetIds: readonly string[],
  obligationIds: readonly string[],
  sentenceBudget: number,
  scopeSelection: DefinitionScopeSelection | null = null,
): Readonly<{ units: readonly string[]; usedClaimIds: readonly string[] }> | null {
  const relationRequested = plan.obligations.some((obligation) =>
    obligationIds.includes(obligation.id) && obligation.kind === "explain_relation")
  const slotObligations = plan.obligations.filter((obligation) => obligationIds.includes(obligation.id))
  const comparison = slotObligations.some((obligation) => obligation.kind === "distinguish_targets")
  if (!relationRequested && !comparison) return null
  // Relation authority belongs to the obligation, including comparisons. A
  // projection must not replace other duties or erase an authenticated case
  // mapping; those composed fields retain the same explicit source scope in
  // providerContent instead of receiving an unrelated generic explanation.
  if (slotObligations.some((obligation) => !["distinguish_targets", "explain_relation", ...COMPOSITION_CONTROL_KINDS]
    .includes(obligation.kind)) || plan.historyAnchor?.caseContext?.eventIds.length
    || plan.currentComparisonContext) return null
  const targets = plan.targetEvidence.filter((target) => targetIds.includes(target.studentTargetId))
  if (!targets.length) return null
  const labelFor = (target: typeof targets[number]) =>
    target.visibleAliases[0] ?? target.ownerBookTopicTitle.split(" · ").at(-1) ?? target.studentTargetId
  if (targets.length === 1) {
    const target = targets[0]!
    const label = labelFor(target)
    const relationClaims = relationEvidenceClaims(plan, targetIds)
      .filter((claim) => DAILY_LIFE_OUTCOME_EVIDENCE_SIGNAL.test(claim.text)
        || /\b(?:ilişki|etkile|katılım|destekle|azal|artır)\w*\b/iu.test(claim.text))
    const counterpart = /\bkatilim\w*\b/u.test(normalizeDnaChatText(question)) ? "katılım" : "sorulan sonuç"
    const units = relationClaims.length ? Object.freeze([
      ...relationClaims.map((claim) => `${capitalizedStudentLabel(label)} ile ${counterpart} arasındaki kaynakta desteklenen bağlantı şudur: ${citationFreeStudentClaim(claim.text)}`),
      "Bu bilginin ötesinde doğrudan etki yönü veya kesin neden-sonuç bağı kurulamaz.",
    ]) : Object.freeze([`${capitalizedStudentLabel(label)} için mevcut kaynak, ${counterpart} ile doğrudan bir ilişki yönü veya mekanizma kurmuyor; bu nedenle ilişkinin yönü hakkında yeni bir sonuç çıkarılamaz.`])
    return Object.freeze({ units, usedClaimIds: Object.freeze((relationClaims.length ? relationClaims : target.claims.slice(0, 1))
      .map(claim => claim.claimId)) })
  }
  const labels = targets.map(labelFor)
  const baseClaims = targets.flatMap((target) => target.claims.find((claim) => claim.role !== "contrast") ?? [])
  const uniqueCrossClaims = crossTargetRelationClaims(plan, targetIds)
  const sourceMemberships = sourceComponentMemberships(plan, targetIds)
  // Canonical source sentences already naming their target need no repeated
  // renderer-owned label ("Dikkat: Dikkat, ..."). Do not rewrite the claim.
  const labeledClaim = (label: string, claim: string, aliases: readonly string[] = [label]) => {
    const text = naturalizeProviderStudentProse(citationFreeStudentClaim(claim))
    const normalizedText = normalizeDnaChatText(text)
    // A source can name the same concept with another approved alias. Do not
    // prepend a second heading just because its spelling differs from the UI.
    return aliases.some(alias => {
      const normalizedAlias = normalizeDnaChatText(alias)
      return normalizedText === normalizedAlias || normalizedText.startsWith(`${normalizedAlias} `)
    })
      ? text : `${capitalizedStudentLabel(label)}: ${text}`
  }
  // A canonical definition may already state the cross-target relationship.
  // Render that unit once in the explicit relation section, retaining its target
  // label and the linked paragraph order. It still supports both duties.
  const sharedDefinitionIndex = (claim: typeof baseClaims[number]) => baseClaims.findIndex(base =>
    base.claimId === claim.claimId && base.text === claim.text)
  const basicEvidence = baseClaims.flatMap((claim, index) =>
    !sourceMemberships.length && uniqueCrossClaims.some(cross =>
      cross.claimId === claim.claimId && cross.text === claim.text) ? []
      : [labeledClaim(labels[index] ?? "Konu", claim.text, targets[index]?.visibleAliases)])
  const scopeOrder = scopeSelection?.requestFocus === "definition_scope" ? scopeSelection.scopeOrder : "not_ordered"
  const narrowIndex = scopeOrder === "first_narrower" ? 0 : 1
  const scopeBridge = !sourceMemberships.length && scopeOrder !== "not_ordered"
    ? `Bu tanımların kapsamını karşılaştırınca ${labels[narrowIndex]} daha dar bir alanı, ${labels[1 - narrowIndex]} ise daha geniş bir çerçeveyi anlatır.`
    : plan.requestedRelationFocus === "definition_scope" && !sourceMemberships.length
      ? "Bu tanımlara dayanarak hangisinin daha dar veya daha geniş kapsamlı olduğunu güvenle sıralayamıyorum."
      : null
  const directBridge = sourceMemberships.length
    ? sourceMemberships.map(({ parent, member }) =>
      `${capitalizedStudentLabel(labelFor(member))}, ${labelFor(parent)} kapsamında anlatılan temel bileşenler arasında yer alır.`).join(" ")
    : uniqueCrossClaims.length
    ? `${comparison ? "Bağlantıları şöyle:" : "Kaynakta iki başlığı aynı açıklama içinde bağlayan nokta şudur:"} ${uniqueCrossClaims.map((claim) => {
      const baseIndex = sharedDefinitionIndex(claim)
      return baseIndex >= 0 ? labeledClaim(labels[baseIndex] ?? "Konu", claim.text, targets[baseIndex]?.visibleAliases) : citationFreeStudentClaim(claim.text)
    }).join(" ")}`
    : comparison && relationRequested
      ? "Bu tanımlar kavramların farkını gösterir; aralarındaki ilişkinin ayrıntılarını ise açıklamaz."
      : comparison ? null : `Mevcut kaynak, ${labels.join(" ile ")} arasında doğrudan bir etki yönü veya mekanizma kurmuyor.`
  const historyPrefix = plan.historyAnchor
    ? `Önceki ${plan.historyAnchor.targetLabels.join(" ve ")} açıklamasına dönersek: ` : ""
  // A supported educational comparison needs no extra generic disclaimer.
  // Explicit evidence/clinical boundaries belong to their policy-owned slots;
  // unsupported relationship text above and non-comparison limits stay intact.
  const boundary = comparison
    ? ""
    : " Bu cümlelerin gösterdiğinin ötesinde, birinin diğerini hangi yönde etkilediği veya aralarında kesin bir neden-sonuç bağı bulunduğu söylenemez."
  const leading = comparison ? ["Bu kavramlar aynı şey değildir."] : []
  // A definition-based scope comparison answers a different question from a
  // scientific effect/link. It neither implies a subset theorem nor authorizes
  // any source-absent direction or mechanism. Explicit source links still stay.
  const trailing = [...(scopeBridge ? [scopeBridge] : []),
    ...(directBridge && (!scopeBridge || uniqueCrossClaims.length) ? [directBridge] : []),
    ...(boundary.trim() ? [boundary.trim()] : [])]
  // Expand only with distinct, already-selected source units. Extra requested
  // sentences do not reopen provider authority or repeat the first definition.
  const used = new Set([...baseClaims, ...uniqueCrossClaims].map((claim) => claim.claimId))
  const extraCount = Math.max(0, sentenceBudget - leading.length - basicEvidence.length - trailing.length)
  const extras = targets.flatMap((target) => target.claims
    .filter((claim) => claim.role !== "contrast" && !used.has(claim.claimId))
    .map((claim) => ({ claimId: claim.claimId, text: `${capitalizedStudentLabel(labelFor(target))}: ${citationFreeStudentClaim(claim.text)}` })))
    .filter((extra, index, rows) => rows.findIndex(row => row.text === extra.text) === index).slice(0, extraCount)
  const units = [...leading, ...basicEvidence, ...extras.map(extra => extra.text), ...trailing]
  if (units.length) units[0] = `${historyPrefix}${units[0]}`
  // This deterministic projection knows exactly which source units it used.
  // Do not cite every input claim or remember unrendered context as conversation.
  const bridgeClaimIds = sourceMemberships.length
    ? sourceMemberships.flatMap(row => [row.anchorClaimId, row.relationClaimId])
    : uniqueCrossClaims.map(claim => claim.claimId)
  return Object.freeze({ units: Object.freeze(units), usedClaimIds: Object.freeze(unique([
    ...baseClaims.map(claim => claim.claimId), ...bridgeClaimIds, ...extras.map(extra => extra.claimId),
  ])) })
}

function targetExplanationSlotText(
  plan: StudentAnswerExecutionPlan,
  question: string,
  targetIds: readonly string[],
  obligationIds: readonly string[],
): string | null {
  const explanationRequested = plan.obligations.some((obligation) =>
    obligationIds.includes(obligation.id) && obligation.kind === "explain_target")
  if (!explanationRequested || !["significance", "boundary", "measurement"].includes(plan.operation)) return null
  const claims = targetExplanationClaims(plan, targetIds)
  if (!claims.length) return null
  if (plan.operation === "significance") {
    return `İşlevsel önemi şudur: ${claims.map((claim) => citationFreeStudentClaim(claim.text)).join(" ")}`
  }
  if (plan.operation !== "boundary") return claims.map((claim) => citationFreeStudentClaim(claim.text)).join(" ")
  const directOpening = directBoundaryOpening(question)
  const withDirectOpening = (text: string) => directOpening ? `${directOpening} ${text}` : text
  const baseClaims = targetExplanationBaseClaims(plan, targetIds)
  const boundaryClaims = targetExplanationBoundaryClaims(plan, targetIds)
  if (boundaryClaims.length && boundaryClaims.every((claim) => baseClaims.includes(claim))) {
    return withDirectOpening(`Hedefe özgü yorum sınırını gösteren kaynak açıklaması şudur: ${boundaryClaims.map((claim) => citationFreeStudentClaim(claim.text)).join(" ")}`)
  }
  const baseIds = new Set(baseClaims.map((claim) => claim.claimId))
  const additionalBoundaryClaims = boundaryClaims.filter((claim) => !baseIds.has(claim.claimId))
  const supported = `Kaynağın doğrudan desteklediği açıklama şudur: ${baseClaims.map((claim) => citationFreeStudentClaim(claim.text)).join(" ")}`
  return withDirectOpening(additionalBoundaryClaims.length
    ? `${supported} Hedefe özgü yorum sınırı şudur: ${additionalBoundaryClaims.map((claim) => citationFreeStudentClaim(claim.text)).join(" ")}`
    : `${supported} Bu kaynak bilgisi hedef hakkında yalnız bu açıklamayı destekler.`)
}

function measurementScopeSlotText(
  plan: StudentAnswerExecutionPlan,
  targetIds: readonly string[],
  obligationIds: readonly string[],
): string | null {
  const measurementRequested = plan.obligations.some((obligation) =>
    obligationIds.includes(obligation.id) && obligation.kind === "describe_measurement_scope")
  if (!measurementRequested) return null
  const targets = plan.targetEvidence.filter((target) => targetIds.includes(target.studentTargetId))
  if (!targets.length) return null
  const labels = unique(targets.map((target) => target.visibleAliases[0]).filter(Boolean))
  const labelPhrase = labels.length <= 1
    ? labels[0] ?? "bu hedef"
    : labels.length === 2
      ? `${labels[0]} ve ${labels[1]}`
      : `${labels.slice(0, -1).join(", ")} ve ${labels.at(-1)}`
  const eligibleClaims = targets.flatMap((target) => target.claims.filter((claim) => claim.role !== "contrast"))
  const directMeasurementClaims = eligibleClaims.filter((claim) =>
    MEASUREMENT_METHOD_EVIDENCE_SIGNAL.test(claim.text))
  const selectedClaims = measurementEvidenceClaims(plan, targetIds)
  const supportedText = selectedClaims.map((claim) => citationFreeStudentClaim(claim.text)).join(" ")
  const methodText = directMeasurementClaims.length
    ? `Kaynağın ${labelPhrase} için doğrudan verdiği ölçüm veya değerlendirme bilgisi şudur: ${supportedText} Bu bilgiler neyin değerlendirilebileceğini gösterir; ancak kaynak belirli cihazı, uygulama adımlarını veya puanlama yöntemini açıklamadığı için bu ayrıntılar eklenemez.`
    : `Mevcut kaynak ${labelPhrase} için belirli bir ölçme aracı, uygulama adımı veya puanlama yöntemi açıklamıyor; bu nedenle kesin bir yöntem eklenemez. Kaynağın sonuç yorumuna dayanak verdiği hedef bilgisi şudur: ${supportedText}`
  return `Nasıl ölçülür veya değerlendirilir: ${methodText} Sonuç nasıl yorumlanır: Sonuç yalnız bu hedefe özgü bilgiler ve ölçümün yapıldığı görev ile koşullar içinde yorumlanmalıdır; tek bir puan veya gözlem, ${labelPhrase} başlığının tamamını ya da nedenini tek başına göstermez.`
}

function directBoundaryOpening(question: string): string | null {
  const trimmed = question.trim()
  if (!/(?:\s(?:mı|mi|mu|mü)|\s+miyiz)\?\s*$/iu.test(trimmed)) return null
  const proposition = trimmed
    .replace(/[?]+\s*$/u, "")
    .replace(/\s+diyebilir\s+miyiz\s*$/iu, "")
    .replace(/\s+(?:mı|mi|mu|mü)\s*$/iu, "")
    .trim()
  if (!proposition) return null
  return `Kısa yanıt: Hayır; “${proposition}” şeklinde kesin bir sonuca yalnız bu bilgiyle varılamaz.`
}

function lockedClaimsForAnswerSlot(
  claims: StudentAnswerExecutionPlan["targetEvidence"][number]["claims"],
  obligations: StudentAnswerExecutionPlan["obligations"],
  exampleSlot: boolean,
) {
  if (exampleSlot) return claims.filter((claim) => claim.role !== "contrast")
  if (obligations.some((obligation) => obligation.kind === "explain_source_evidence")) {
    return claims.filter((claim) => claim.role !== "contrast")
  }
  if (obligations.some((obligation) => obligation.kind === "explain_daily_life_meaning")) {
    const dailyClaims = claims.filter((claim) => claim.role !== "contrast"
      && (DAILY_LIFE_OUTCOME_EVIDENCE_SIGNAL.test(claim.text)
        || DAILY_LIFE_DECISION_EVIDENCE_SIGNAL.test(claim.text)))
    return dailyClaims.length ? dailyClaims : claims.filter((claim) => claim.role !== "contrast")
  }
  if (obligations.some((obligation) => obligation.kind === "explain_mechanism")) {
    const supportedClaims = supportedMechanismClaims(claims)
    if (supportedClaims.length) return supportedClaims
    const eligible = claims.filter((claim) => claim.role !== "contrast")
    const novelClaims = obligations.some((obligation) => obligation.kind === "deepen_with_new_information")
      && eligible.length > 1 ? eligible.slice(1) : eligible
    const mechanismClaims = novelClaims.filter((claim) => !DAILY_LIFE_OUTCOME_EVIDENCE_SIGNAL.test(claim.text))
    return mechanismClaims.length ? mechanismClaims : novelClaims
  }
  if (obligations.some((obligation) => obligation.kind === "deepen_with_new_information")) {
    const eligible = claims.filter((claim) => claim.role !== "contrast")
    return eligible.length > 1 ? eligible.slice(1) : eligible
  }
  if (obligations.some((obligation) => obligation.kind === "define_target")) {
    const contextual = contextOnlyDefinitionClaims(claims)
    if (contextual) return contextual
    // A list lead-in is not a definition by itself. Hand off the complete
    // already-selected source unit and let the composer explain it; punctuation
    // must not authorize replacing its answer with a fabricated cycle/flow.
    if (claims.length > 3 && claims[0]?.text.trim().endsWith(":")) return claims
    const definitionClaim = claims.find((claim) => claim.role !== "contrast")
    return definitionClaim ? [definitionClaim] : claims
  }
  return claims
}

// Context evidence supports a contextual explanation, not a newly invented
// formal definition or successful capacity attribution. Preserve all selected
// qualifications/negations and their claim IDs; no catalog/test IDs here.
export function contextOnlyDefinitionClaims(
  claims: StudentAnswerExecutionPlan["targetEvidence"][number]["claims"],
) {
  const eligible = claims.filter(c => c.role !== "contrast")
  // Existing explicitly enumerated source flows already have a complete
  // structured-definition handoff; this fallback does not take it over.
  if (eligible.length > 3 && eligible[0]?.text.trim().endsWith(":")) return null
  return eligible.length && eligible.every(c => c.role === "context") ? eligible : null
}

export function contextOnlyDefinitionText(
  claims: StudentAnswerExecutionPlan["targetEvidence"][number]["claims"],
  ownerBookTopicTitle?: string,
): string | null {
  const contextual = contextOnlyDefinitionClaims(claims)
  if (!contextual) return null
  // Release-closure correction for this audited source section only, not a
  // question/fixture match. The book also defines out-of-school leisure in a
  // different section. Three selected context claims cannot establish absence
  // from the whole book, nor authorize importing that different definition.
  // Describe the scope of this answer; do not invent a definition of either.
  if (ownerBookTopicTitle === "Okul Katılımı ve Self-Regülasyon · Teneffüs ve Serbest Zaman") {
    return `Burada okul katılımı içindeki teneffüs ve serbest zaman ele alınıyor; okul dışı boş zamanın tanımı yapılmıyor. `
      + `Seçilen bölümde doğrudan bir tanım yerine bu ortamın talepleri açıklanıyor: ${contextual
        .map(c => citationFreeStudentClaim(c.text)).join(" ")}`
  }
  // A context-only source cannot silently discharge a definition duty by
  // listing related facts. Make the source limitation responsive and visible,
  // then retain the useful evidence instead of refusing the whole question.
  return `Mevcut kaynakta doğrudan bir tanım verilmiyor. Konuyu şu bilgilerle açıklayabiliriz: ${contextual
    .map(c => citationFreeStudentClaim(c.text)).join(" ")}`
}

function withoutProviderSectionLead(text: string, sectionPrefix: string | null) {
  if (sectionPrefix === "Mekanizma ve işleyiş açısından:") {
    return text.replace(/^mekanizma(?:\s+ve\s+işleyiş)?\s+açısından\s*:?\s*/iu, "").trim()
  }
  if (sectionPrefix === "Günlük yaşamdaki anlamı:") {
    return text.replace(/^günlük\s+(?:yaşamdaki|hayattaki)\s+anlamı\s*:?\s*/iu, "").trim()
  }
  return text
}

function withoutProviderExampleLead(text: string) {
  return text.replace(/^(?:örnek\s*:?\s*|örneğin\s*,?\s*|mesela\s*,?\s*)/iu, "").trim()
}

const EXPLICIT_BOUNDARY_KINDS: readonly StudentRequestContract["obligations"][number]["kind"][] = Object.freeze([
  "state_evidence_limit",
  "avoid_causal_overclaim",
  "state_single_observation_limit",
  "name_additional_context",
  "name_multiple_plausible_explanations",
  "refuse_treatment_selection",
  "offer_safe_assessment_frame",
])

function containsUnrequestedExampleBoundary(text: string, plan?: StudentAnswerExecutionPlan) {
  // A source-bound explanation that the described event does NOT instantiate
  // a target is part of bind_example_to_target, not an optional diagnostic
  // disclaimer. Do not erase the negative half of a conceptual distinction.
  if (plan && isConceptApplicationLimit(text, plan)) return false
  const normalized = normalizeDnaChatText(text)
  const boundarySubject = /\b(?:bilimsel|kanit|tani|kesin|tek\s+basina|sonuc|cikarim|ornek|durum|gozlem)\w*\b/u
  const limitingConclusion = /\b(?:degerlendirilmez|gostermez|kanitlamaz|yetmez|yeterli\s+degil|yeterli\s+degildir|cikarilamaz|soylenemez|sonuc\s+vermez)\b/u
  return boundarySubject.test(normalized) && limitingConclusion.test(normalized)
}

function isConceptApplicationLimit(text: string, plan: StudentAnswerExecutionPlan) {
  const normalized = normalizeDnaChatText(text)
  if (/\b(?:tani|terapi|tedavi|kapasite|bilimsel\s+kanit|kesin\s+sonuc)\w*\b/u.test(normalized)) return false
  const namesTarget = plan.targetEvidence.some(target => target.visibleAliases.some(alias =>
    normalized.includes(normalizeDnaChatText(alias))))
  return namesTarget && /\b(?:orneklemez|gostermez|gostermiyor|gosterildigi\s+soylenemez)\b/u.test(normalized)
    && /\b(?:olay|davranis|ornek|durum|adim)\w*\b/u.test(normalized)
}

function withoutBoundarySentences(text: string, plan: StudentAnswerExecutionPlan) {
  const sentences = text.match(/[^.!?]+[.!?]?/gu) ?? [text]
  return sentences.flatMap((sentence) => {
    const terminal = sentence.match(/[.!?]\s*$/u)?.[0]?.trim() ?? ""
    const clauses = sentence.replace(/[.!?]\s*$/u, "").split(/\s*;\s*/u)
      .map((clause) => clause.trim())
      .filter(Boolean)
      .filter((clause) => !containsUnrequestedExampleBoundary(clause, plan))
    if (!clauses.length) return []
    return [`${clauses.join("; ")}${terminal}`]
  }).join(" ").trim()
}

function withoutUnrequestedExampleBoundary(
  text: string,
  plan: StudentAnswerExecutionPlan,
  blockKind: StudentAnswerBlock["blockKind"],
) {
  if (blockKind !== "example" || plan.obligations.some((obligation) => EXPLICIT_BOUNDARY_KINDS.includes(obligation.kind))) {
    return text
  }
  const withoutConjunctiveBoundary = text
    .replace(
      /\s*[;,]?\s*(?:ancak|fakat|ama)\s+(?:bu\s+)?(?:kısa\s+)?(?:örnek|durum|gözlem)\s+tek\s+başına[^.!?]*(?:göstermez|kanıtlamaz|yetmez|yeterli\s+değildir|çıkarılamaz)[.!?]?/giu,
      (match) => isConceptApplicationLimit(match, plan) ? match : "",
    )
    .trim()
  return withoutBoundarySentences(withoutConjunctiveBoundary, plan)
}

function asSingleSentenceFragment(text: string) {
  return text
    .replace(/\s+/gu, " ")
    .replace(/[.!?]+(?=\s|$)/gu, "; ")
    .replace(/(?:;\s*)+$/u, "")
    .trim()
}

function ownedSentenceFragments(value: unknown, budget: number): readonly string[] | null {
  const values = budget > 1 ? Array.isArray(value) ? value : [] : [value]
  return values.length === budget && values.every((text) => typeof text === "string"
    && text.trim().length >= 4 && text.length <= 4_000) ? values as string[] : null
}

function realizeOwnedSentences(units: readonly string[], budget: number,
  format: StudentAnswerExecutionPlan["presentation"]["format"]): string | null {
  // Fewer requested sentences compact adjacent owned clauses; more sentences
  // require real units. Never silently pad with duplicate or provider-only text.
  if (units.length < budget || units.some((text) => text.trim().length < 4)) return null
  const sentences = Array.from({ length: budget }, () => [] as string[])
  for (const [index, unit] of units.entries()) {
    sentences[Math.min(Math.floor(index * budget / units.length), budget - 1)]!.push(asSingleSentenceFragment(unit))
  }
  return sentences.map((parts) => parts.join("; ")).join(format === "bullets" ? ".\n- " : ". ")
}

function naturalizeProviderStudentProse(text: string, recoverFlattenedBoundaries = true) {
  const normalizedTerms = text
    .replace(/\bself[- ]regülasyon\b/giu, (value) => /^[A-Zİ]/u.test(value) ? "Öz düzenleme" : "öz düzenleme")
    .replace(/belirli bir bölüme işlem kaynağı ayırmaktır/giu, "belirli bir bölüme odaklanmaktır")
    .replace(/belirli bir bölüme işlem kaynağı ayırma sürecidir/giu, "belirli bir bölüme odaklanma sürecidir")
  if (!recoverFlattenedBoundaries) {
    const unit = normalizedTerms.trim()
    if (/[.!?]["'”’»\])}]*$/u.test(unit)) return unit
    return `${unit.replace(/[,;:]+$/u, "").trim()}.`
  }
  const withMissingBoundaries = normalizedTerms.replace(
    /(\b[\p{L}]+(?:dır|dir|dur|dür|tır|tir|tur|tür))\s+(?=(?:Öz düzenleme|Dikkat|Öz-kontrol|Öz denetim|Arousal|Uyarılma|Duyusal|Eş düzenleme|Ko-regülasyon|Planlama|İnhibisyon|Duygu düzenleme|Çalışma belleği|Yürütücü)\b)/gu,
    "$1. ",
  )
  return /[.!?]$/u.test(withMissingBoundaries.trim())
    ? withMissingBoundaries.trim()
    : `${withMissingBoundaries.trim()}.`
}

const PROVIDER_INSTRUCTIONS = `
  Türkçe konuşan yeni mezun bir ergoterapi öğrencisine, doğal ve kolay anlaşılır cevap metinleri yaz. Yalnız şemada hazır bulunan b1, b2 gibi metin kutularını ve illustrationKind alanını doldur; hedef, yükümlülük, kanıt, politika veya blok kimliği üretme. Her metin kutusu answerSlots içindeki aynı slotId görevlerinin tamamını gerçekten yerine getirsin. Sistem kutuları sırayla birleştirerek son cevabı oluşturacak; bu yüzden kutular birlikte tek, akıcı ve tekrarsız bir cevap gibi okunmalıdır. Kaynak cümlelerini ve parantez içi atıfları aynen kopyalama; anlamı değiştirmeden kısa, günlük Türkçeyle yeniden söyle ve visibleAliases içinde Türkçe karşılık varsa onu tercih et. “İşlem kaynağı ayırma” gibi teknik bir ifadeyi, yeni bilgi eklemeden “odaklanma” gibi öğrenci dilindeki karşılığıyla anlat. Her yeni düşünceyi görünür noktalama ile ayır. presentation.requestedSentenceCount boşsa her kutuyu doğal cümle sonu noktalamasıyla tamamla. presentation.requestedSentenceCount doluysa sistem tam o sayı kadar kutu verir; her kutuya yalnız tek cümlelik içerik yaz ve nokta, soru işareti veya ünlemle bitirme, sonlandırmayı sistem yapacak. operation=deepen ve presentation.depth=deep ise kısa tanımı tekrarlamakla yetinme: lockedClaims içindeki her yeni ayrıntıyı kullanarak öğrenciye ders anlatır gibi altı-sekiz kısa ve bağlantılı cümle yaz; yeni bilgi ekleme ve aynı fikri farklı sözlerle yineleme. operation=summarize ise bütün cevap konuşmanın kısa ve işe yarar özeti gibi okunmalı: summarize_known kutusunda ilişkili hedefleri birlikte gruplayarak en fazla üç kısa cümle, summarize_unknown kutusunda tek cümle, summarize_observation_focus kutusunda en fazla üç kısa cümle yaz; geçmişte konuşulmamış yeni hedef veya ayrıntı ekleme. Özet bölüm başlıklarını sistem görünür olarak ekleyecek; kutulara ayrıca başlık yazma. historyAnchor doluysa önceki ham mesajı görmediğini unutma. historyAnchor.caseContext boşsa yalnız targetLabels ve currentUserMessage içindeki referans sözünü kullanarak “bu durumda” veya “önceki ... durumunda” gibi görünür bir bağ kur. historyAnchor.caseContext doluysa eventLabels geçmiş olaydan kullanılmasına izin verilen tek somut olay dizisidir. caseBinding.requiredForEveryActiveTarget=true olan her kutuda tanımı yalnız sıralama; kutudaki her activeTargets hedefinin bu aynı olay dizisinin hangi bölümünü anlamaya yardım ettiğini, en az bir eventLabels ifadesini görünür kullanarak ve kesin kişisel sonuç çıkarmadan açıkla. Çok parçalı istekte tüm hedefler aynı olay dizisine bağlanmalıdır; ilk kutuda genel bir geçmiş atfı yapmak tek başına yeterli değildir. Verilmeyen kişi, ortam, neden, duygu veya davranış ayrıntısını uydurma. slotKind=example olan kutunun görünür “Örnek:” etiketini sistem ekleyecek; bu kutuyu ayrıca “Örnek:” veya “Örneğin” diye başlatma, doğrudan durumu anlat. Bir slotun obligations listesinde use_shared_scenario varsa yalnız tek bir ortak somut durum kullan; bütün aktif hedefleri bu aynı durumun içinde ayrı ayrı göster ve ikinci, ilgisiz bir örneğe geçme. Örnek kutusuna kanıt, kesinlik, tanı veya “tek başına sonuç göstermez” sınırı ekleme; yalnız ilgili sınır yükümlülüğü ve policyUnits açıkça verilmişse sınırı kendi kutusunda yaz. Her slotun activeTargets bölümündeki her hedef için visibleAliases adlarından en az birini görünür metinde yaz. explain_mechanism ve explain_daily_life_meaning kutularının görünür bölüm başlıklarını sistem ekleyecek; bu kutuları ayrıca “Mekanizma açısından” veya “Günlük yaşamdaki anlamı” diye başlatma. obligations içinde explain_mechanism varsa tanımı yeniden söylemekle yetinme, lockedClaims içindeki süreç, zaman içinde değişim veya bağlantının nasıl işlediğini hedefe özgü açıkla. Kaynak yalnız bir zaman akışı veriyorsa bu akışı desteklenen süreç olarak anlat; açık bir süreç vermiyorsa mekanizma uydurma ve mevcut bilginin hedefe özgü kesin mekanizmayı göstermediğini açıkça söyle. explain_daily_life_meaning varsa tanımı yeniden söylemekle yetinme ve yalnız lockedClaims içindeki günlük karar, etkinlik, rutin, sosyal yaşam veya katılım sonucunu açıkla. LockedClaims hedef için böyle bir günlük yaşam, etkinlik veya katılım sonucu vermiyorsa genel tavsiye ya da yeni sonuç üretme; bunun yerine bu hedefin günlük yaşamdaki sonucunun mevcut kaynak bilgisinde açıklanmadığını hedefi görünür adla anarak açıkça söyle. Bilimsel içerikte yalnız o slotun lockedClaims cümlelerini kullan; yeni neden, mekanizma, tanı, ilişki, terapi veya kesinlik ekleme. role=contrast olan cümle başka bir kavramın karşıt bilgisidir; onu aktif hedefin tanımı, özelliği veya örneği gibi kullanma. Örnek ve örnek-bağlama slotlarına contrast cümlesi zaten verilmez. RejectedTargetIds içindeki kavramı cevap odağına geri getirme. Kullanıcının mesajındaki durum yalnız örnek sunma görevi varsa, kimliksiz ve açıkça örnek olarak kullanılabilir; bu durum bilimsel kanıt veya kişiye özgü sonuç değildir. İç sistem dilini görünür metne yazma.
`.trim()

// Source excerpts are positive context, not an exhaustive inventory of science.
// Keep actual source-supported uncertainty expressible; do not replace the
// requested summary with a generic refusal or a deterministic safety fallback.
const SUMMARY_EPISTEMIC_INSTRUCTIONS = `
summaryEpistemicScope, bilinen bilgi ile çıkarım sınırını ayırır. establishedContextClaimIds içindeki açıklamalar bilinen kavramsal bağlamdır; kısa kaynak seçkisinde bir ayrıntının bulunmaması onun bilimsel olarak bilinmediğini göstermez. summarize_unknown bölümünde yalnız lockedClaims içinde açıkça desteklenen belirsizlikleri ve limitPolicyIds ile verilen çıkarım sınırını özetle. Kaynakta gerçekten belirtilen bir belirsizliği saklama; kaynakta olmayan belirsizlik üretme. Önceki veya mevcut bölümde açıkladığın kavram farklarını "birbirinden nasıl ayrıldıkları bilinmiyor" diye geri alma. Genel açıklamaları bilinen bilgi olarak koru; bunların belirli bir kişinin nedeni, tanısı veya kapasitesi hakkında tek başına kesin sonuç sağlamadığını ayrı tut. Bir kaynak iddiasını belirsizlik bölümünde kullanman, onun tersini söyleme yetkisi vermez. Bu bölüm tek cümle olmalı; istenen bilinenler ve gözlem bölümlerini bir ret cevabıyla değiştirme.
`.trim()

const COUNTED_SUMMARY_INSTRUCTIONS = `
Bu özetin kutuları cümle sırasını değil, ayrı anlam bölümlerini temsil eder. Önceki genel cümle-kutusu kuralı yerine her kutunun summaryComposition sözleşmesini uygula: sentenceUnits=1 ise tek cümlelik metin parçası; sentenceUnits>1 ise tam belirtilen sayıda metin parçası içeren dizi döndür. Her dizi öğesi yalnız bir cümlenin içeriğidir; başlık veya son noktalama yazma. Bir bölümün bütün öğeleri yalnız o bölümün obligations görevlerini yerine getirsin. Bilinen kavramların açıklamasını summarize_unknown alanına veya çıkarım sınırını summarize_observation_focus alanına taşıma. Bilinenleri anlatmak için birden çok öğe ayrılmışsa hedefleri bu öğeler arasında paylaştır; her öğede bütün kavramları yeniden sıralama. Gözlem alanında sadece izin verilen gözlem odağını anlat, kişiye tanı veya neden atama. İstenen cümle sayısı bölüm sayısından azsa sistem bölüm parçalarını noktalı virgülle aynı cümlede birleştirir; hiçbir bölümü atlama. Fazlaysa ayrılmış dizi öğelerini aynı bölümün farklı desteklenen noktalarını anlatmak için kullan; yeni bilgi veya yapay tekrar üretme. Bölüm başlıklarını sistem ekler.
`.trim()

const RELATION_SUPPORT_INSTRUCTIONS = `
relationSupport bulunan her kutuda ilişki görevi, ana operation etiketinden bağımsız olarak aynı kaynak sınırına tabidir. İki kavramın tanımının birlikte verilmesi, birinin diğerini etkilediğine dair kanıt değildir. Yalnız bu kutunun selectedClaimIds ve lockedClaims açıklamalarını kullan. crossTargetClaimIds, iki hedefi aynı açıklamada anan kaynak cümlelerini gösterir; bu kimliklerin varlığı cümlede yazmayan nedensellik, etki yönü veya kapsam oranını ekleme yetkisi vermez. Böyle bir kaynak bağlantısı yoksa desteklenen kavram farklarını anlat; bağlantının yönünü seçili bilginin açıklamadığını belirt, kavramlar arasında bilimsel olarak hiçbir ilişki yokmuş gibi konuşma. Birlikte görülme veya tanım farkından "bu nedenle etkiler", "yalnız bir yönünü etkiler" gibi yeni bir sonuç üretme. Kaynak gerçekten bir bağlantı kuruyorsa onu koru ve tersine çevirme. caseBinding varsa aynı olaya bağlı açıklama ve diğer görevleri koru; genel kaynak sınırı uğruna istenen örneği ya da kavram farklarını atlama. Kullanıcının veya historyAnchor'ın olayı bilimsel ilişki kanıtı değildir.
`.trim()

const SHARED_SCENARIO_INSTRUCTIONS = `
sharedScenarioBinding bulunan kutuda genel serbest metin ve bütün alanlarda kavram adı yazma kuralları yerine bu sözleşmeyi uygula. activity tek bir somut etkinliği ve amacını kurar. Her applications hedefi, eventStep ve conceptLink alanları olan bir nesnedir; applicationSentenceUnits birden büyükse şemadaki sayıda böyle nesne içeren dizi kullan. eventStep içinde aynı etkinliğin o kavramı gösterecek somut adımını anlat: hangi bilgi tutuluyor, hangi adım sıralanıyor veya hangi gözlenebilir iş yapılıyor açık olsun; yalnız kavram tanımını ya da 'bilgiyi işler' gibi belirsiz bir sözü yineleme. conceptLink, bu somut adımın o hedefin lockedClaims açıklamasındaki süreci nasıl örneklediğini kısa ve günlük Türkçeyle bağlasın. Her alan kendi başına anlamı tamamlanan, yüklemi bulunan kısa bir anlatım birimidir. Kavram başlığını veya hedef kimliğini alanlara yazma: sistem hazır hedef anahtarını görünür Türkçe kavram adına bağlayacak. Diğer hedefin görevini bu alanlara taşıma. Bütün hedeflerin eventStep alanları activity içindeki aynı görevin adımlarıdır; ikinci ortam, farklı amaç veya ilgisiz etkinlik ekleme. Kullanıcı veya historyAnchor bir olay verdiyse onu koru; verilmemiş klinik ayrıntı ekleme. Olay verilmemişse öğretici varsayımsal bir etkinlik kurabilirsin; bu olay bilimsel kanıt veya kişisel sonuç değildir. conceptLink yalnız hedefin verilen lockedClaims bilgisini uygular; yeni neden, tanı, terapi veya kesin sonuç eklemez. Dizi gerektiğinde her çift aynı etkinliğin farklı desteklenen adımını anlatsın; kopya çiftlerle sayı doldurma. Sistem alan sınırlarını ve hedef sahipliğini koruyup istenen toplam cümle sayısına göre sunacak. Diğer kutuların sözleşmesini değiştirme.
`.trim()

const COUNTED_DISCOURSE_INSTRUCTIONS = `
Cümle sayısı belirtildiğinde kutu sayısı cümle sayısı demek değildir. Her kutu kendi obligations görevlerinin tek anlam sahibidir; sentenceComposition veya summaryComposition o göreve ayrılan cümle sayısını verir ve önceki genel cümle-kutusu kuralının yerine geçer. sentenceUnits=1 için tek metin parçası, daha büyükse şemadaki tam sayıda parçadan oluşan dizi yaz; her öğe bir cümlenin içeriği olsun, başlık veya son noktalama ekleme. Bütün öğeler aynı kutunun kaynak, ilişki, olay ve politika sınırlarına bağlıdır. Diziye geçmek bu yetkiyi genişletmez. Ek cümleleri farklı desteklenen noktaları açıklamak için kullan; tekrarla veya kaynaksız çıkarımla doldurma. Bir görevdeki bilgiyi başka görevin kutusuna taşıma. Örnek kutusu activity ve applications yapısını korur: activity tek etkinliktir; applications alanındaki her öğe eventStep ve conceptLink çifti olarak kalır, serbest metne dönüşmez. applicationSentenceUnits çift sayısıdır; her çift aynı hedefin aynı etkinlik içindeki farklı somut adımıyla kavramsal bağını taşır, yeni etkinlik başlatma. Sistem çiftin iki alanını aynı görev-sahipli cümlede birleştirir. Sistem görevleri ve örneğin alanlarını ancak sonunda, istenen toplam cümle sayısına göre birleştirir.
`.trim()

const SHARED_EVENT_OWNERSHIP_INSTRUCTIONS = `
Ortak örnekte olayın sahibi activity alanıdır. Her eventStep bu olayın aynı kişi, nesne, hedef ve sonucunu korur; kavram tanımına benzetmek için yeni veya ters bir olay kurmaz. Özellikle ertelenen/sınırlandırılan davranışın nesnesini değiştirip hedefe yönelik davranışı ertelenen davranışa dönüştürme. Önce activity içinde hangi davranışın sürdüğünü, hangisinin yapılmadığını belirle; eventStep ve conceptLink içindeki yüklemleri aynı nesnelere bağla. Bir kavramın tanımında erteleme veya durdurma geçmesi, etkinlikteki her eylemin ertelendiği veya durduğu anlamına gelmez. Başarı/başarısızlık, hatırlama/unutma, dönme/dönmeme ve destekli/desteksiz koşullar hem olayda hem kavramsal açıklamasında aynı kalır. Yanlış olay yazıp sonuna doğru tanım ekleme; bütün alanları tek tutarlı örnek olarak oluştur.
`.trim()

const EXAMPLE_APPLICATION_INSTRUCTIONS = `
exampleRealization bulunan kutu soyut tanım kutusu değildir. Kullanıcı yalnız kısa bir örnek istese de gözlenebilir bir kişi, eylem, eylemin nesnesi ve sonuç bulunmalıdır. Tanımı yeniden söyleyip önüne Örnek etiketi gelmesi bu görevi karşılamaz. Önce verilen olayın neyi içerdiğini belirle, sonra her hedefin kaynak tanımının gerektirdiği sürecin gerçekten o olayda bulunup bulunmadığını karşılaştır. Her kavramın başarılı kullanıldığını göstermek zorunda değilsin: olay bir süreci kullanmakta güçlüğü gösterebilir veya diğer kavramın gösterildiği söylenemeyebilir. Bir eylemin gerçekleşmemesi, o eylemin hedef doğrultusunda bilinçli olarak sınırlandığı anlamına gelmez; bir adımın unutulması da başka bir tepkinin durdurulduğunu göstermez. Başarısızlığı tanımdaki başarılı sürecin örneği diye etiketleme. Kavramın koşulu olayda yoksa somut olarak eksik olan koşulu açıkla; kavramın bu olayda neden gösterilmediğini belirtmek bind_example_to_target görevinin parçasıdır, tanı/kapasite sınırı değildir. Bu açıklamada gerekirse visibleAliases içindeki kavram adını kullanabilirsin. Kullanıcının vermediği başarı, telafi, dikkat dağıtıcı, niyet veya kişisel neden ekleme. İstenen ayrımı bu aynı olay üzerinden ver, genel ret veya tanım tekrarıyla değiştirme. conceptLink varsa bu kural orada da geçerlidir; eventStep yalnız gerçekleşen olayı anlatsın. Bu öğretici eşleme, bir kişinin kapasitesi veya tanısı hakkında sonuç değildir.
`.trim()

const DEFINITION_SCOPE_INSTRUCTIONS = `
relationComposition.representation=source_premise_then_scope_selection olan kutu için serbest metin, yeniden anlatım ve cümle dizisi talimatları geçerli değildir. Kilitli tanım metinlerini sistem orderedDefinitionSources içinden doğrudan bağlar; bu metinleri, kimliklerini veya alıntı aralıklarını çıktı olarak üretme. Yalnız şemadaki requestFocus ve scopeOrder alanlarını doldur. requestFocus ile sorulan boyutu seç: aynı mı/farkı ne sorusu definition_difference, açık dar/geniş/kapsam karşılaştırması definition_scope, etki yönü veya kaynakta açıklanan bağlantı source_connection. Aynı mesaj hem aynı mı hem dar/geniş diye soruyorsa kapsam sorusu da cevaplanmalıdır: definition_scope seç. Son olarak scopeOrder: definition_scope dışındaki odaklarda not_ordered; definition_scope içinde orderedDefinitionSources ile verilen kaynak tanımları bir tanımın daha dar bir kapasiteye, diğerinin daha geniş alanlara odaklandığını gösteriyorsa orderedDefinitionSources sırasına göre first_narrower veya second_narrower, bu sıralamayı desteklemiyorsa not_ordered. Kullanıcının önerisini kanıt sayma. Aynı kaynak cümlesinde iki kavramın birlikte geçmesi, tanımların kapsamını karşılaştırmak için şart değildir; ancak farklı tanımlar etki yönünü, nedenselliği, kesin alt-küme ilişkisini veya mekanizmayı kanıtlamaz. Bu aynı üretici çağrısının sınırlı yorumudur, hakem kararı değildir. Yeni iddia, serbest açıklama veya ek alan yazma. Sistem kaynak tanımlarını, sınırlı kapsam yorumunu ve varsa açık kaynak bağlantısını görev-sahipli cümle bütçesinde gösterecek. caseBinding ve ortak örnek kutularının sözleşmesini değiştirme.
`.trim()

const CURRENT_COMPARISON_INSTRUCTIONS = `
eventDetailAuthority=transient_current_message_only_no_invented_event_label olduğunda güncel mesajda durum anlatımı vardır, fakat olay sözlüğü onu sınıflandıramamıştır. eventLabels boş olabilir; boş listeyi durum yok diye yorumlama ve görünür bir olay etiketi uydurma. Yalnız currentUserMessage içinde gerçekten anlatılan durumu geçici olarak kullan; önceki konuşmadan kişi, ortam veya davranış ekleme. Durumu tanı veya bilimsel ilişki kanıtı olarak kullanma.
caseBinding.authority=current_illustrative_events_not_scientific_evidence olduğunda bu kutu yalnız soyut tanım karşılaştırması değildir. Güncel mesajdaki olay, geçmişe aitmiş gibi anlatılmadan her aktif kavramın kaynakta desteklenen anlamıyla ayrı ayrı ilişkilendirilmelidir. Bu durumda kullanıcının olayını sadece örnek görevinde kullanma kuralının yerine bu karşılaştırma bağlamı geçerlidir: olay yalnız açıklayıcı bağlamdır, bilimsel kanıt veya tanı değildir. eventLabels yeni kişi/olay ayrıntıları eklemeye izin vermez; currentUserMessage içindeki somut durumu koru. Bir gözlemden hangi kapasitenin bozuk olduğu, kesin neden, etki yönü veya tedavi çıkarma. İlişki görevini genel tanımlarla ya da yalnız kaynak yetersizliği cümlesiyle ikame etme; desteklenen ayrımı bu olaya uygula, kaynak dışı ilişki kurma. Kaynakta açıklanmayan mekanizmayı açıklanmış sayma.
`.trim()

function parseCandidate(value: unknown, plan: StudentAnswerExecutionPlan, question: string): StudentAnswerCandidate | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const textBySlot = row.blocks && typeof row.blocks === "object" && !Array.isArray(row.blocks)
    ? row.blocks as Record<string, unknown> : null
  const illustrationKind = row.illustrationKind
  if (!textBySlot || !["none", "user_supplied", "hypothetical"].includes(String(illustrationKind))) return null
  const slots = answerSlotMetadata(plan)
  const sentenceBudgets = answerSentenceBudgets(plan)
  const slotIds = slots.map((slot) => slot.blockId)
  if (!sameSet(Object.keys(textBySlot), slotIds)) return null
  const providerSlots = Object.fromEntries(slots.map((slot, index) => [slot.blockId,
    isDefinitionScopeSlot(plan, slot) ? definitionScopeSelection(textBySlot[slot.blockId], plan, slot)
      : isSharedScenarioSlot(plan, slot) ? sharedScenarioDiscourse(textBySlot[slot.blockId], slot, sentenceBudgets?.[index] ?? 1)
      : ownedSentenceFragments(textBySlot[slot.blockId], sentenceBudgets?.[index] ?? 1)]))
  if (slots.some((slot) => providerSlots[slot.blockId] === null)) return null
  const compositionDecisions = Object.freeze(slots.filter((slot) => isDefinitionScopeSlot(plan, slot))
    .map((slot) => {
      const relations = sourceComponentMemberships(plan, slot.targetIds)
      return Object.freeze({ slotId: slot.blockId, ...providerSlots[slot.blockId] as DefinitionScopeSelection,
        ...(relations.length ? { sourceRelationAuthority: "component_membership" as const,
          sourceRelationClaimIds: Object.freeze(unique(relations.flatMap((r) => [r.anchorClaimId, r.relationClaimId]))) } : {}) })
    }))
  const projectedClaimIdsBySlot = new Map<string, readonly string[]>()
  const providerTextBySlot = Object.fromEntries(slots.map((slot, index) => {
    const slotObligations = plan.obligations.filter((obligation) => slot.obligationIds.includes(obligation.id))
    const sectionPrefix = deterministicSectionPrefix(plan, slot.obligationIds)
    const deterministicPolicyText = slotObligations.length > 0
      && slotObligations.every((obligation) => DETERMINISTIC_POLICY_KINDS.includes(obligation.kind))
      ? plan.policyUnits
        .filter((unit) => slot.usedPolicyUnitIds.includes(unit.id))
        .map((unit) => unit.text)
        .join(" ")
      : null
    const unsupportedDailyLifeText = unsupportedDailyLifeSlotText(
      plan,
      slot.targetIds,
      slot.obligationIds,
    )
    const supportedExampleText = supportedExampleSlotText(
      plan,
      question,
      slot.targetIds,
      slot.obligationIds,
    )
    const supportedMechanismText = supportedMechanismSlotText(
      plan,
      slot.targetIds,
      slot.obligationIds,
    )
    const deepenMechanismText = deepenMechanismSlotText(
      plan,
      slot.targetIds,
      slot.obligationIds,
    )
    const relationProjection = relationSlotUnits(
      plan,
      question,
      slot.targetIds,
      slot.obligationIds,
      sentenceBudgets?.[index] ?? 1,
      isDefinitionScopeSlot(plan, slot) ? providerSlots[slot.blockId] as DefinitionScopeSelection : null,
    )
    const relationUnits = relationProjection?.units
    const targetExplanationText = targetExplanationSlotText(
      plan,
      question,
      slot.targetIds,
      slot.obligationIds,
    )
    const measurementScopeText = measurementScopeSlotText(
      plan,
      slot.targetIds,
      slot.obligationIds,
    )
    // The fixed short-comparison projection is one indivisible statement. A
    // multi-sentence known section instead uses the bound provider synthesis.
    const multiTargetSummaryText = (sentenceBudgets?.[index] ?? 1) > 1 ? null : multiTargetSummarySlotText(
      plan,
      slot.targetIds,
      slot.obligationIds,
    )
    const contextualTargets = slot.targetIds.map(id => plan.targetEvidence.find(t => t.studentTargetId === id))
    const contextDefinition = slotObligations.length === 1 && slotObligations[0]?.kind === "define_target"
      && contextualTargets.every(t => t && contextOnlyDefinitionClaims(t.claims))
      ? contextualTargets.map(t => contextOnlyDefinitionText(t!.claims, t!.ownerBookTopicTitle)!).join(" ") : null
    const authoritativeText = measurementScopeText || deterministicPolicyText || supportedExampleText || relationUnits?.join(" ")
      || deepenMechanismText || supportedMechanismText || unsupportedDailyLifeText || targetExplanationText || contextDefinition || multiTargetSummaryText
    if (relationProjection && authoritativeText === relationProjection.units.join(" ")) {
      projectedClaimIdsBySlot.set(slot.blockId, relationProjection.usedClaimIds)
    }
    const providerSlot = providerSlots[slot.blockId]!
    const budget = sentenceBudgets?.[index] ?? 1
    if (!authoritativeText && !Array.isArray(providerSlot)) {
      return [slot.blockId, realizeSharedScenarioDiscourse(providerSlot as SharedScenarioDiscourse, plan, budget) ?? ""]
    }
    // Source/policy authority is resolved before presentation, including arrays.
    // An array is additional space owned by this duty, never a bypass around it.
    const rawUnits = authoritativeText
      ? relationUnits && authoritativeText === relationUnits.join(" ") ? relationUnits
        : budget > 1 ? [...new Intl.Segmenter("tr", { granularity: "sentence" }).segment(authoritativeText)].map((part) => part.segment)
          : [authoritativeText]
      : providerSlot as readonly string[]
    const units = rawUnits.map((text) => {
      const withoutSectionLead = preserveSummaryInferenceLimit(
        withoutProviderSectionLead(text.trim(), sectionPrefix), plan, slot,
      )
      const withoutExampleLead = slot.blockKind === "example" ? withoutProviderExampleLead(withoutSectionLead) : withoutSectionLead
      const scopedExample = slot.blockKind === "example" && compositionDecisions.length
        ? withoutExampleScopeDeclarations(withoutExampleLead, plan.targetEvidence.flatMap(t => t.visibleAliases))
        : withoutExampleLead
      return withoutUnrequestedExampleBoundary(scopedExample, plan, slot.blockKind)
    })
    return [slot.blockId, sentenceBudgets
      ? realizeOwnedSentences(units, budget, plan.presentation.format) ?? ""
      : naturalizeProviderStudentProse(units.join(" "))]
  }))
  if (slots.some((slot) => providerTextBySlot[slot.blockId]!.length < 4)) return null
  const blocks = slots.map((slot, index) => {
    const sectionPrefix = deterministicSectionPrefix(plan, slot.obligationIds)
    const selfLabeledComparison = projectedClaimIdsBySlot.has(slot.blockId)
      && plan.obligations.some(obligation => slot.obligationIds.includes(obligation.id)
        && obligation.kind === "distinguish_targets")
    const prefixes = [
      ...(index === 0 && !selfLabeledComparison ? [visibleTargetPrefix(plan)] : []),
      ...(sectionPrefix ? [sectionPrefix] : []),
      ...(slot.blockKind === "example" ? ["Örnek:"] : []),
    ]
    // If several semantic sections share the last requested sentence, their
    // individual role headings survive as clauses. No duties are collapsed.
    const continuesSentence = sentenceBudgets && plan.presentation.requestedSentenceCount! < slots.length
      && index >= plan.presentation.requestedSentenceCount! - 1 && index < slots.length - 1
    return Object.freeze({
      ...slot,
      usedClaimIds: projectedClaimIdsBySlot.get(slot.blockId) ?? slot.usedClaimIds,
      text: `${[...prefixes, providerTextBySlot[slot.blockId]!].join(" ")}${plan.presentation.requestedSentenceCount === null ? "" : continuesSentence ? ";" : "."}`,
    })
  })
  const requested = plan.presentation.requestedSentenceCount
  if (sentenceBudgets && requested! < blocks.length) {
    // Compact only after each semantic section has been realized with its own
    // heading. This preserves N visible bullets as well as N prose sentences.
    const tail = blocks.slice(requested! - 1)
    const merged = Object.freeze({ ...tail[0]!,
      blockKind: tail.some((block) => block.blockKind === "example") ? "example" as const : "content" as const,
      text: tail.map((block) => block.text).join(" "),
      targetIds: Object.freeze(unique(tail.flatMap((block) => block.targetIds))),
      obligationIds: Object.freeze(unique(tail.flatMap((block) => block.obligationIds))),
      usedClaimIds: Object.freeze(unique(tail.flatMap((block) => block.usedClaimIds))),
      usedPolicyUnitIds: Object.freeze(unique(tail.flatMap((block) => block.usedPolicyUnitIds))),
    })
    return composeCandidate([...blocks.slice(0, requested! - 1), merged],
      illustrationKind as StudentAnswerCandidate["illustrationKind"], plan.presentation.format, compositionDecisions)
  }
  return composeCandidate(blocks, illustrationKind as StudentAnswerCandidate["illustrationKind"], plan.presentation.format, compositionDecisions)
}

export async function executeStudentAnswer(input: Readonly<{
  question: string
  contract: StudentRequestContract
  historyEvidence?: readonly StudentConversationEvidenceRef[]
  apiKey?: string
  fetchImpl?: typeof fetch
  safetyIdentifier?: string | null
  externalProviderAllowed?: boolean
}>): Promise<StudentAnswerExecutorResult> {
  const plan = buildStudentAnswerExecutionPlan(input)
  if (plan.executionRoute === "local_safety_boundary") {
    const candidate = localSafetyCandidate(plan, input.question, input.contract.referent.kind !== "none")
    const failureCodes = validateStudentAnswerCandidate({ candidate, plan, question: input.question })
    const provider = Object.freeze({
      calls: 0,
      transportRetries: 0,
      usageComplete: true,
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
  // The application can authorize an existing local policy response without
  // granting transmission. Re-derive the route here before any provider call;
  // a stale/mismatched caller decision must never turn local-only into network.
  if (input.externalProviderAllowed === false) return Object.freeze({
    ok: false, reason: "provider_permission_denied", plan,
    provider: Object.freeze({ calls: 0, transportRetries: 0, usageComplete: true,
      responseId: null, usage: ZERO_USAGE, latencyMs: 0, rawOutputStored: false as const }),
  })
  let calls = 0
  let transportRetries = 0
  let usageComplete = true
  let attempt: Awaited<ReturnType<typeof requestDnaS13StructuredOutputDetailed>>
  while (true) {
    calls += 1
    attempt = await requestDnaS13StructuredOutputDetailed({
      name: "dna_student_answer_executor",
      schema: answerSchema(plan),
      instructions: [PROVIDER_INSTRUCTIONS,
        ...(plan.targetEvidence.some(target => target.priorAcceptedSupportClaimIds?.length) ? [
          "priorAcceptedSupport önceki kabul edilmiş cevapların kilitli kaynak desteğidir, kelimesi kelimesine konuşma kaydı değildir. Özette yalnız temel tanımları karşılaştırma; bu destek içindeki hedefe özgü süreç, koşul ve sınır ayrıntılarını kısa ve sade biçimde birleştir. Kullanıcı yetişkin desteği gibi bir ayrıntıyı açıkça adlandırdıysa onu ilgili kilitli kaynak varsa koru; kaynakta yoksa uydurma. Kaynak kimliği, önceki cevabın her kaynak cümlesini aynen söylediğini kanıtlamaz. Yeni hedef, kişisel olay, tedavi veya kesinlik ekleme."
        ] : []),
        ...(plan.summaryEpistemicScope ? [SUMMARY_EPISTEMIC_INSTRUCTIONS] : []),
        ...(plan.operation === "summarize" && answerSentenceBudgets(plan) ? [COUNTED_SUMMARY_INSTRUCTIONS] : []),
        ...(plan.obligations.some((obligation) => ["explain_relation", "distinguish_targets"].includes(obligation.kind)) ? [RELATION_SUPPORT_INSTRUCTIONS] : []),
        ...(plan.obligations.some((obligation) => obligation.kind === "distinguish_targets")
          && !plan.obligations.some((obligation) => obligation.kind === "explain_relation")
          ? ["Kavram ayrımı alt görevinde farkı kaynakla açıkla. Sözleşmedeki özet, örnek, gözlem ve diğer görevler aynen geçerlidir. relationSupport mevcut kaynak sınırını belirtir; kavram ayrımına ek bir bilimsel ilişki açıklama görevi oluşturmaz. Kullanıcının istemediği ayrıca bilimsel ilişki, etki yönü veya ilişki yokluğu açıklaması üretme."] : []),
        ...(answerSlotMetadata(plan).some((slot) => isSharedScenarioSlot(plan, slot)) ? [SHARED_SCENARIO_INSTRUCTIONS, SHARED_EVENT_OWNERSHIP_INSTRUCTIONS] : []),
        ...(plan.obligations.some(o => o.kind === "give_concrete_example") ? [SCENARIO_FIDELITY_INSTRUCTIONS, EXAMPLE_APPLICATION_INSTRUCTIONS] : []),
        ...(answerSentenceBudgets(plan) ? [COUNTED_DISCOURSE_INSTRUCTIONS] : []),
        ...(answerSlotMetadata(plan).some((slot) => isDefinitionScopeSlot(plan, slot)) ? [DEFINITION_SCOPE_INSTRUCTIONS] : []),
        ...(plan.currentComparisonContext ? [CURRENT_COMPARISON_INSTRUCTIONS] : []),
      ].join("\n"),
      content: providerContent({ question: input.question, plan }),
      maxOutputTokens: 900,
      timeoutMs: DNA_STUDENT_ANSWER_EXECUTOR_TIMEOUT_MS,
      safetyIdentifier: input.safetyIdentifier,
      apiKey: input.apiKey,
      fetchImpl: input.fetchImpl,
    })
    if (!attempt.ok && retryableStudentAnswerTransportFailure(attempt.failure)) usageComplete = false
    const canRetry = !attempt.ok
      && retryableStudentAnswerTransportFailure(attempt.failure)
      && transportRetries < DNA_STUDENT_ANSWER_EXECUTOR_MAX_TRANSPORT_RETRIES
      && calls < DNA_STUDENT_ANSWER_EXECUTOR_MAX_PROVIDER_CALLS
    if (!canRetry) break
    transportRetries += 1
  }
  if (!attempt.ok) {
    return Object.freeze({
      ok: false,
      reason: "provider_failure",
      failure: attempt.failure,
      plan,
      provider: Object.freeze({
        calls,
        transportRetries,
        usageComplete,
        responseId: null,
        usage: ZERO_USAGE,
        latencyMs: attempt.failure.transport?.elapsedMs ?? 0,
        rawOutputStored: false as const,
      }),
    })
  }
  const candidate = parseCandidate(attempt.result.value, plan, input.question)
  const failureCodes: StudentAnswerFailureCode[] = candidate ? [...validateStudentAnswerCandidate({ candidate, plan })]
    : ["answer_missing"]
  // Check event fields before conceptual prose and then the visible projection.
  // Definitions cannot conceal a reversed event; an echoed question is not an example.
  if (candidate && plan.obligations.some(o => o.kind === "give_concrete_example")) {
    const constraints = explicitScenarioEvents(input.question)
    const rawBlocks = (attempt.result.value as { blocks?: Record<string, unknown> }).blocks ?? {}
    const slots = answerSlotMetadata(plan).filter(slot => slot.blockKind === "example")
    const eventsPreserved = slots.every(slot => {
      const raw = rawBlocks[slot.blockId]
      if (isSharedScenarioSlot(plan, slot)) {
        const structured = sharedScenarioDiscourse(raw, slot,
          answerSentenceBudgets(plan)?.[answerSlotMetadata(plan).findIndex(s => s.blockId === slot.blockId)] ?? 1)
        return !!structured && preservesScenarioEvents(constraints,
          [structured.activity, ...structured.applications.map(a => a.eventStep)].join(" "))
      }
      return preservesScenarioEvents(constraints, Array.isArray(raw) ? raw.join(" ") : String(raw ?? ""))
    })
    const visiblePreserved = preservesScenarioEvents(constraints,
      candidate.blocks.filter(b => b.blockKind === "example").map(b => b.text).join(" "), false)
    if (!eventsPreserved || !visiblePreserved) failureCodes.push("scenario_event_direction_mismatch")
  }
  const provider = Object.freeze({
    calls,
    transportRetries,
    usageComplete,
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

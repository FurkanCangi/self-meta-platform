import { getDnaOwnerBookTopicClaims } from "../ownerBookRuntime"
import type { StudentAnswerObligationKind, StudentRequestContract } from "./contracts"
import {
  buildStudentS13ResolvedRequestHandoff,
  type StudentS13ResolvedRequestHandoff,
} from "./runtimeBridge"

export const DNA_STUDENT_ANSWER_EXECUTION_PLAN_VERSION = "dna-student-answer-execution-plan@1" as const

export type StudentAnswerEvidenceClaim = Readonly<{
  claimId: string
  passageId: string
  sourceId: string
  text: string
}>

export type StudentAnswerExecutionPlan = Readonly<{
  version: typeof DNA_STUDENT_ANSWER_EXECUTION_PLAN_VERSION
  requestContractVersion: StudentRequestContract["version"]
  turnId: string
  operation: StudentRequestContract["semanticTask"]
  executionRoute: "provider_grounded" | "local_safety_boundary"
  activeTargetIds: readonly string[]
  rejectedTargetIds: readonly string[]
  rejectedTargetTopics: readonly Readonly<{
    studentTargetId: string
    ownerBookTopicId: string
    ownerBookTopicTitle: string
  }>[]
  targetEvidence: readonly Readonly<{
    studentTargetId: string
    ownerBookTopicId: string
    ownerBookTopicTitle: string
    claims: readonly StudentAnswerEvidenceClaim[]
  }>[]
  obligations: StudentRequestContract["obligations"]
  policyUnits: readonly Readonly<{
    id: string
    text: string
  }>[]
  presentation: StudentRequestContract["presentation"]
  rawQuestionStored: false
  providerMayReceiveTransientQuestion: boolean
}>

const POLICY_UNIT_BY_OBLIGATION: Readonly<Partial<Record<StudentAnswerObligationKind, Readonly<{
  id: string
  text: string
}>>>> = Object.freeze({
  give_concrete_example: Object.freeze({
    id: "policy.illustrative-scenario",
    text: "Kullanıcının verdiği veya açıkça varsayımsal olarak kurulan örnek, bilimsel kanıt değildir; yalnız kavramı somutlaştırır.",
  }),
  bind_example_to_target: Object.freeze({
    id: "policy.example-target-binding",
    text: "Örneğin hedef kavramla bağı yalnız kilitli kaynak bilgisinden kurulabilir.",
  }),
  state_single_observation_limit: Object.freeze({
    id: "policy.single-observation-limit",
    text: "Tek bir davranış veya gözlem, bir kapasitenin güçlü ya da zayıf olduğuna karar vermek için yeterli değildir.",
  }),
  name_additional_context: Object.freeze({
    id: "policy.additional-context",
    text: "Yorum için farklı zaman, ortam ve görevlerdeki tekrarlar, davranışın öncesi ve sonrası ve destekle nasıl değiştiği incelenmelidir.",
  }),
  refuse_treatment_selection: Object.freeze({
    id: "policy.no-treatment-selection",
    text: "Bu sohbet belirli bir kişi için terapi veya tedavi seçmez.",
  }),
  offer_safe_assessment_frame: Object.freeze({
    id: "policy.safe-assessment-frame",
    text: "Güvenli çerçeve; hedefi, günlük işlevi, farklı ortamlardaki gözlemleri, kişinin koşullarını ve yetkili klinik değerlendirmeyi birlikte ele alır.",
  }),
})

function unique<T>(values: readonly T[]) {
  return [...new Set(values)]
}

function sameSet(left: readonly string[], right: readonly string[]) {
  const a = unique(left).sort()
  const b = unique(right).sort()
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function maximumClaims(contract: StudentRequestContract) {
  if (contract.semanticTask === "summarize") return 1
  if (contract.presentation.depth === "deep") return 4
  if (contract.presentation.depth === "brief") return 2
  return 3
}

function evidenceForTarget(
  target: StudentS13ResolvedRequestHandoff["crosswalk"][number],
  contract: StudentRequestContract,
) {
  const claims = getDnaOwnerBookTopicClaims(target.ownerBookTopicId, true)
    .filter((claim) => claim.text.trim().length > 0)
    .slice(0, maximumClaims(contract))
    .map((claim) => Object.freeze({
      claimId: claim.claimId,
      passageId: claim.passageId,
      sourceId: claim.sourceId,
      text: claim.text,
    }))
  if (!claims.length) throw new Error(`dna_student_answer_evidence_missing:${target.studentTargetId}`)
  return Object.freeze({
    studentTargetId: target.studentTargetId,
    ownerBookTopicId: target.ownerBookTopicId,
    ownerBookTopicTitle: target.ownerBookTopicTitle,
    claims: Object.freeze(claims),
  })
}

function localSafetyBoundary(contract: StudentRequestContract) {
  return contract.safetyIntent !== "general_education"
    || contract.obligations.some((obligation) => [
      "state_single_observation_limit",
      "name_additional_context",
      "refuse_treatment_selection",
      "offer_safe_assessment_frame",
    ].includes(obligation.kind))
}

export function buildStudentAnswerExecutionPlan(input: Readonly<{
  question: string
  contract: StudentRequestContract
}>): StudentAnswerExecutionPlan {
  const handoff = buildStudentS13ResolvedRequestHandoff(input)
  const active = handoff.crosswalk.filter((target) => target.polarity === "ACTIVE_TARGET")
  const rejected = handoff.crosswalk.filter((target) => target.polarity === "REJECTED_TARGET")
  const policyUnitIds = unique(input.contract.obligations.flatMap((obligation) => {
    const unit = POLICY_UNIT_BY_OBLIGATION[obligation.kind]
    return unit ? [unit.id] : []
  }))
  const policyUnits = policyUnitIds.map((id) => {
    const unit = Object.values(POLICY_UNIT_BY_OBLIGATION).find((candidate) => candidate?.id === id)
    if (!unit) throw new Error(`dna_student_answer_policy_unit_missing:${id}`)
    return unit
  })
  const local = localSafetyBoundary(input.contract)
  const plan: StudentAnswerExecutionPlan = Object.freeze({
    version: DNA_STUDENT_ANSWER_EXECUTION_PLAN_VERSION,
    requestContractVersion: input.contract.version,
    turnId: input.contract.turnId,
    operation: input.contract.semanticTask,
    executionRoute: local ? "local_safety_boundary" : "provider_grounded",
    activeTargetIds: Object.freeze([...input.contract.targetIds]),
    rejectedTargetIds: Object.freeze([...input.contract.rejectedTargetIds]),
    rejectedTargetTopics: Object.freeze(rejected.map((target) => Object.freeze({
      studentTargetId: target.studentTargetId,
      ownerBookTopicId: target.ownerBookTopicId,
      ownerBookTopicTitle: target.ownerBookTopicTitle,
    }))),
    targetEvidence: Object.freeze(active.map((target) => evidenceForTarget(target, input.contract))),
    obligations: Object.freeze([...input.contract.obligations]),
    policyUnits: Object.freeze(policyUnits),
    presentation: input.contract.presentation,
    rawQuestionStored: false,
    providerMayReceiveTransientQuestion: !local,
  })
  if (!validateStudentAnswerExecutionPlan(plan, input.contract)) {
    throw new Error("dna_student_answer_execution_plan_invalid")
  }
  return plan
}

export function validateStudentAnswerExecutionPlan(
  plan: StudentAnswerExecutionPlan,
  contract: StudentRequestContract,
) {
  if (plan.version !== DNA_STUDENT_ANSWER_EXECUTION_PLAN_VERSION
    || plan.requestContractVersion !== contract.version
    || plan.turnId !== contract.turnId
    || plan.operation !== contract.semanticTask
    || plan.rawQuestionStored !== false
    || plan.activeTargetIds.length < 1
    || plan.activeTargetIds.length > 8
    || !sameSet(plan.activeTargetIds, contract.targetIds)
    || !sameSet(plan.rejectedTargetIds, contract.rejectedTargetIds)
    || plan.activeTargetIds.some((targetId) => plan.rejectedTargetIds.includes(targetId))) return false
  const expectedRoute = localSafetyBoundary(contract) ? "local_safety_boundary" : "provider_grounded"
  if (plan.executionRoute !== expectedRoute
    || plan.providerMayReceiveTransientQuestion !== (expectedRoute === "provider_grounded")) return false
  if (!sameSet(plan.targetEvidence.map((row) => row.studentTargetId), contract.targetIds)) return false
  const handoff = buildStudentS13ResolvedRequestHandoff({ question: "typed validation", contract })
  const expectedTopicByTarget = new Map(handoff.crosswalk.filter((row) => row.polarity === "ACTIVE_TARGET")
    .map((row) => [row.studentTargetId, row.ownerBookTopicId]))
  const expectedRejectedTopicByTarget = new Map(handoff.crosswalk.filter((row) => row.polarity === "REJECTED_TARGET")
    .map((row) => [row.studentTargetId, row.ownerBookTopicId]))
  if (!sameSet(plan.rejectedTargetTopics.map((row) => row.studentTargetId), contract.rejectedTargetIds)
    || plan.rejectedTargetTopics.some((row) => expectedRejectedTopicByTarget.get(row.studentTargetId) !== row.ownerBookTopicId)) return false
  for (const row of plan.targetEvidence) {
    if (expectedTopicByTarget.get(row.studentTargetId) !== row.ownerBookTopicId || !row.claims.length) return false
    const allowedClaims = new Set(getDnaOwnerBookTopicClaims(row.ownerBookTopicId, true).map((claim) => claim.claimId))
    if (row.claims.some((claim) => !allowedClaims.has(claim.claimId))) return false
  }
  if (!sameSet(plan.obligations.map((row) => row.id), contract.obligations.map((row) => row.id))) return false
  for (const obligation of contract.obligations) {
    const unit = POLICY_UNIT_BY_OBLIGATION[obligation.kind]
    if (unit && !plan.policyUnits.some((candidate) => candidate.id === unit.id && candidate.text === unit.text)) return false
  }
  return true
}

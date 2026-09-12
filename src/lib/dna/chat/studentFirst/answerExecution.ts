import { getDnaOwnerBookTopicClaims } from "../ownerBookRuntime"
import { resolveDnaS13FacetEvidence } from "../s13/strictPlanner"
import {
  createDnaS13TopicSemanticFrame,
  ownerTopicClaimToDnaS13Claim,
} from "../s13/topicSemantic"
import { normalizeDnaChatText } from "../text"
import type { StudentAnswerObligationKind, StudentRequestContract } from "./contracts"
import { studentCaseEventLabels } from "./caseContext"
import { studentTargetVisibleAliases } from "./targetCatalog"
import { studentRequestedComparisonRelationFocus, type StudentComparisonRelationFocus } from "./relationRequest"
import { canonicalStudentConversationClaim, isStudentConversationEvidence,
  type StudentConversationEvidenceRef } from "./conversationEvidence"
import { selectStudentSubtopicEvidence, studentRelatedEvidenceTopicIds, studentSubtopicRetrievalAllowed,
  type StudentSubtopicEvidenceBinding } from "./subtopicEvidence"
import {
  buildStudentS13ResolvedRequestHandoff,
  type StudentS13ResolvedRequestHandoff,
} from "./runtimeBridge"

export const DNA_STUDENT_ANSWER_EXECUTION_PLAN_VERSION = "dna-student-answer-execution-plan@21" as const

export type StudentAnswerEvidenceClaim = Readonly<{
  claimId: string
  passageId: string
  sourceId: string
  text: string
  role: "target" | "context" | "contrast"
}>

export type StudentAnswerExecutionPlan = Readonly<{
  version: typeof DNA_STUDENT_ANSWER_EXECUTION_PLAN_VERSION
  requestContractVersion: StudentRequestContract["version"]
  turnId: string
  operation: StudentRequestContract["semanticTask"]
  requestedRelationFocus?: StudentComparisonRelationFocus
  executionRoute: "provider_grounded" | "local_safety_boundary"
  activeTargetIds: readonly string[]
  rejectedTargetIds: readonly string[]
  rejectedTargetTopics: readonly Readonly<{
    studentTargetId: string
    ownerBookTopicId: string
    ownerBookTopicTitle: string
  }>[]
  historyAnchor: Readonly<{
    turnId: string
    role: Exclude<StudentRequestContract["referent"]["role"], "none">
    targetIds: readonly string[]
    targetLabels: readonly string[]
    rawHistoryStored: false
    caseContext: Readonly<{
      eventIds: StudentRequestContract["caseContext"]["eventIds"]
      scenario?: StudentRequestContract["caseContext"]["scenario"]
      eventLabels: readonly string[]
      rawMessageStored: false
    }> | null
  }> | null
  caseHistoryContext: Readonly<{
    turnIds: readonly string[]
    eventIds: StudentRequestContract["caseHistoryContext"] extends infer T
      ? T extends { eventIds: infer E } ? E : never
      : never
    eventLabels: readonly string[]
    rawMessageStored: false
  }> | null
  currentComparisonContext?: Readonly<{
    eventIds: StudentRequestContract["caseContext"]["eventIds"]
    eventLabels: readonly string[]
    describedSituation?: true
    rawMessageStored: false
  }>
  targetEvidence: readonly Readonly<{
    studentTargetId: string
    ownerBookTopicId: string
    ownerBookTopicTitle: string
    visibleAliases: readonly string[]
    verifiedExampleEvidence: Readonly<{
      status: "SUPPORTED_DIRECT" | "SUPPORTED_DERIVED" | "UNSUPPORTED"
      supportClaimIds: readonly string[]
    }>
    claims: readonly StudentAnswerEvidenceClaim[]
    requestedSubtopicEvidence?: StudentSubtopicEvidenceBinding
    priorAcceptedSupportClaimIds?: readonly string[]
  }>[]
  obligations: StudentRequestContract["obligations"]
  policyUnits: readonly Readonly<{
    id: string
    text: string
  }>[]
  summaryEpistemicScope: Readonly<{
    selectedClaimsAreExhaustive: false
    unknownScope: "supported_limits_only_not_absence_from_selected_claims"
    establishedContextClaimIds: readonly string[]
    limitPolicyIds: readonly string[]
  }> | null
  presentation: StudentRequestContract["presentation"]
  rawQuestionStored: false
  providerMayReceiveTransientQuestion: boolean
}>

const EVIDENCE_LIMIT_POLICY = Object.freeze({
  id: "policy.evidence-limit",
  text: "Bu bilgi tek başına kesin bir neden, tanı veya kişiye özgü sonuç göstermez; kanıtın sınırı ve bağlam birlikte değerlendirilir.",
})

export const STUDENT_SAFE_ASSESSMENT_POLICY = Object.freeze({
  id: "policy.safe-assessment-frame",
  text: "Güvenli çerçeve; hedefi, günlük işlevi, farklı ortamlardaki gözlemleri, kişinin koşullarını ve yetkili klinik değerlendirmeyi birlikte ele alır.",
})

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
  state_context_dependency: Object.freeze({
    id: "policy.context-dependent-participation",
    text: "Düşük veya yüksek düzeyin katılıma etkisi bağlama bağlıdır; kişinin özellikleri, görevin gereği ve ortam birlikte değerlendirilir.",
  }),
  state_evidence_limit: EVIDENCE_LIMIT_POLICY,
  summarize_unknown: EVIDENCE_LIMIT_POLICY,
  avoid_causal_overclaim: Object.freeze({
    id: "policy.no-causal-overclaim",
    text: "Birlikte görülmeleri kesin bir neden-sonuç ilişkisi kanıtlamaz ve tek başına tanı ya da kapasite sonucu çıkarmaya yetmez.",
  }),
  describe_measurement_scope: Object.freeze({
    id: "policy.measurement-scope",
    text: "Ölçüm, hedefin belirli görev ve koşullardaki görünümünü değerlendirmeye yardım eder; tek bir puan veya gözlem, hedefin tamamını ya da nedenini tek başına göstermez.",
  }),
  state_single_observation_limit: Object.freeze({
    id: "policy.single-observation-limit",
    text: "Tek bir davranış veya gözlem, bir kapasitenin güçlü ya da zayıf olduğuna karar vermek için yeterli değildir.",
  }),
  name_additional_context: Object.freeze({
    id: "policy.additional-context",
    text: "Yorum için farklı zaman, ortam ve görevlerdeki tekrarlar, davranışın öncesi ve sonrası ve destekle nasıl değiştiği incelenmelidir.",
  }),
  name_multiple_plausible_explanations: Object.freeze({
    id: "policy.multiple-plausible-explanations",
    text: "Örneğin bu görünüm, hedef becerinin o anda kullanımıyla, görevin gereğiyle veya ortam koşullarıyla ilişkili olabilir; bu olasılıklardan tek bir nedeni seçmek için yeterli bilgi yoktur.",
  }),
  avoid_context_free_judgment: Object.freeze({
    id: "policy.contextual-judgment",
    text: "Davranış tek başına iyi veya kötü diye sınıflandırılmaz; işlevi ve bağlamı birlikte değerlendirilir.",
  }),
  refuse_treatment_selection: Object.freeze({
    id: "policy.no-treatment-selection",
    text: "Bu sohbet belirli bir kişi için terapi veya tedavi seçmez.",
  }),
  offer_safe_assessment_frame: STUDENT_SAFE_ASSESSMENT_POLICY,
})

function unique<T>(values: readonly T[]) {
  return [...new Set(values)]
}

function multiplePlausibleExplanationsText(contract: StudentRequestContract): string {
  const events = new Set([
    ...contract.caseContext.eventIds,
    ...(contract.referentCaseContext?.eventIds ?? []),
    ...(contract.caseHistoryContext?.eventIds ?? []),
  ])
  if (events.has("instruction_received") && events.has("adult_orientation_observed")) {
    return "Örneğin yönergenin nasıl anlaşıldığı, dikkatin göreve yöneltilmesi veya başlamayı kolaylaştıran yetişkin desteğine ihtiyaç duyulması ayrı olasılıklardır; bunlardan tek bir nedeni seçmek için yeterli bilgi yoktur."
  }
  if (events.has("environmental_load_observed") && events.has("adult_support_received")) {
    return "Örneğin hareketin artması duyusal yükle, genel aktivasyon düzeyiyle veya yetişkin desteğine verilen yanıtla ilişkili olabilir; bunlardan tek bir nedeni seçmek için yeterli bilgi yoktur."
  }
  if (events.has("environmental_load_observed") && events.has("activation_increased")) {
    return "Örneğin duyusal yük, genel aktivasyon düzeyi veya görev ve ortam koşulları ayrı olasılıklardır; bunlardan tek bir nedeni seçmek için yeterli bilgi yoktur."
  }
  if (events.has("emotional_response_observed") && events.has("activation_increased")) {
    return "Örneğin genel aktivasyon artışı, duygusal tepkinin düzenlenmesi veya ortam koşulları ayrı olasılıklardır; bunlardan tek bir nedeni seçmek için yeterli bilgi yoktur."
  }
  if (events.has("adult_support_received") && events.has("activity_resumed")) {
    return "Örneğin yetişkin desteğinin etkisi, etkinliğin koşulları veya çocuğun o andaki düzenlenme durumu ayrı olasılıklardır; bunlardan tek bir nedeni seçmek için yeterli bilgi yoktur."
  }
  return POLICY_UNIT_BY_OBLIGATION.name_multiple_plausible_explanations!.text
}

function sameSet(left: readonly string[], right: readonly string[]) {
  const a = unique(left).sort()
  const b = unique(right).sort()
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function maximumClaims(contract: StudentRequestContract) {
  // A second, explicitly long deepening request must have more source material
  // than the ordinary continuation. Otherwise the composer can only restate
  // the same short definition even when the student asks for a lesson-like answer.
  if (contract.semanticTask === "deepen" && contract.presentation.depth === "deep") return 8
  if (contract.semanticTask === "deepen" || contract.presentation.depth === "deep") return 4
  // Explicit comparison sentence counts take precedence over a generic short
  // response preference. Use existing bounded source claims, never pad the
  // removed implicit relation duty with repeated warnings or invented prose.
  if (contract.semanticTask === "compare" && contract.presentation.requestedSentenceCount !== null) {
    const requestedPerTarget = Math.ceil(Math.max(1, contract.presentation.requestedSentenceCount - 1)
      / Math.max(1, contract.comparisonTargetIds.length))
    return Math.max(contract.presentation.depth === "brief" ? 2 : 3, Math.min(4, requestedPerTarget))
  }
  if (contract.presentation.depth === "brief") return 2
  return 3
}

function verifiedExampleEvidenceForTopic(input: Readonly<{
  topicId: string
  topicTitle: string
  ownerClaims: ReturnType<typeof getDnaOwnerBookTopicClaims>
}>) {
  const semanticFrame = createDnaS13TopicSemanticFrame({
    topicId: input.topicId,
    title: input.topicTitle,
    orderedClaims: input.ownerClaims,
  })
  const resolved = resolveDnaS13FacetEvidence({
    subquestionId: "student_answer_verified_example",
    topicId: input.topicId,
    requestedFacets: ["verified_example"],
    candidates: input.ownerClaims.map(ownerTopicClaimToDnaS13Claim),
    topicSemanticFrame: semanticFrame,
  })
  const evidence = resolved.matrix.find((entry) => entry.facet === "verified_example")
  if (!evidence || evidence.status === "NOT_REQUESTED") {
    throw new Error(`dna_student_answer_verified_example_evidence_missing:${input.topicId}`)
  }
  return Object.freeze({
    status: evidence.status,
    supportClaimIds: Object.freeze([...evidence.supportClaimIds]),
  })
}

export function classifyStudentAnswerEvidenceClaimRole(
  text: string,
  topicTitle: string,
  visibleAliases: readonly string[],
) {
  const normalizedText = normalizeDnaChatText(text)
  const normalizedAliases = visibleAliases.map(normalizeDnaChatText)
  if (normalizedAliases.some((alias) => normalizedText.includes(alias))) return "target" as const
  const leaf = topicTitle.split(" · ").at(-1) ?? topicTitle
  const headingLabels = leaf.split(/\s+ve\s+/iu)
    .map((label) => normalizeDnaChatText(label))
  // A heading is not itself a contrasting concept. Contrast authority requires
  // a coordinated heading anchored to the active concept; generic sections
  // such as components or development remain contextual source evidence.
  const hasActiveHeadingMember = headingLabels.some((label) => normalizedAliases.some((alias) =>
    label.includes(alias) || alias.includes(label)))
  const contrastLabels = headingLabels.length > 1 && hasActiveHeadingMember ? headingLabels
    .filter((label) => label.length >= 4 && !normalizedAliases.some((alias) => label.includes(alias) || alias.includes(label)))
    : []
  if (contrastLabels.some((label) => normalizedText.includes(label))) return "contrast" as const
  return "context" as const
}

// Retrieval of a source unit is not permission to infer a causal relationship.
// A dependent cross-target clause travels with its explicit paragraph subject;
// neither selection nor rendering may silently publish that clause on its own.
export function studentRelationSourceUnits(
  claims: readonly StudentAnswerEvidenceClaim[],
  otherAliases: readonly string[],
): readonly (readonly StudentAnswerEvidenceClaim[])[] {
  const aliases = otherAliases.map(normalizeDnaChatText).filter((alias) => alias.length >= 4)
  const paragraphId = (claim: StudentAnswerEvidenceClaim) => claim.passageId.replace(/:sentence:\d+$/u, "")
  const sentenceIndex = (claim: StudentAnswerEvidenceClaim) => Number(claim.passageId.match(/:sentence:(\d+)$/u)?.[1])
  return claims.flatMap((claim) => {
    if (claim.role === "contrast" || !aliases.some((alias) => normalizeDnaChatText(claim.text).includes(alias))) return []
    if (claim.role === "target") return [[claim]]
    const paragraph = claims.filter((row) => paragraphId(row) === paragraphId(claim))
      .sort((a, b) => sentenceIndex(a) - sentenceIndex(b))
    const end = paragraph.findIndex((row) => row.claimId === claim.claimId)
    let start = end - 1
    while (start >= 0 && paragraph[start]!.role !== "target") start--
    if (start < 0) return []
    const unit = paragraph.slice(start, end + 1)
    if (unit.some((row, i) => row.role === "contrast" || !Number.isFinite(sentenceIndex(row))
      || (i > 0 && sentenceIndex(row) !== sentenceIndex(unit[i - 1]!) + 1))) return []
    return [unit]
  })
}

function evidenceForTarget(
  target: StudentS13ResolvedRequestHandoff["crosswalk"][number],
  contract: StudentRequestContract,
  question: string,
) {
  const visibleAliases = studentTargetVisibleAliases(target.studentTargetId)
  if (!visibleAliases?.length) throw new Error(`dna_student_answer_visible_alias_missing:${target.studentTargetId}`)
  const ownerClaims = getDnaOwnerBookTopicClaims(target.ownerBookTopicId, true)
  const verifiedExampleEvidence = verifiedExampleEvidenceForTopic({
    topicId: target.ownerBookTopicId,
    topicTitle: target.ownerBookTopicTitle,
    ownerClaims,
  })
  const verifiedExampleClaimIds = new Set(verifiedExampleEvidence.supportClaimIds)
  const orderedClaims = ownerClaims
    .filter((claim) => claim.text.trim().length > 0)
    .map((claim) => Object.freeze({
      claimId: claim.claimId,
      passageId: claim.passageId,
      sourceId: claim.sourceId,
      text: claim.text,
      role: classifyStudentAnswerEvidenceClaimRole(claim.text, target.ownerBookTopicTitle, visibleAliases),
    }))
  const rankedClaims = [...orderedClaims].sort((left, right) => {
      if (contract.semanticTask === "example") {
        const supportRank = Number(verifiedExampleClaimIds.has(right.claimId))
          - Number(verifiedExampleClaimIds.has(left.claimId))
        if (supportRank !== 0) return supportRank
      }
      const rank = { target: 0, context: 1, contrast: 2 } as const
      return rank[left.role] - rank[right.role]
    })
  const structuredSequence = rankedClaims.length > 3 && rankedClaims[0]?.text.trim().endsWith(":")
  // A summary is short prose, not a one-sentence source excerpt. Keep the
  // existing top-ranked anchor but deliver its complete approved paragraph in
  // source order, so dependent definitions/process clauses do not disappear.
  // Existing structured-list handling and non-summary budgets remain unchanged.
  const summaryAnchor = contract.semanticTask === "summarize" && !structuredSequence
    ? rankedClaims.find((claim) => claim.role !== "contrast") : null
  const summaryNode = summaryAnchor
    ? ownerClaims.find((claim) => claim.claimId === summaryAnchor.claimId)?.nodeId : null
  const paragraphClaimIds = new Set(summaryNode
    ? ownerClaims.filter((claim) => claim.nodeId === summaryNode).map((claim) => claim.claimId) : [])
  const baseClaims = summaryAnchor
    ? orderedClaims.filter((claim) => paragraphClaimIds.has(claim.claimId))
    : rankedClaims.slice(0, structuredSequence ? 10 : maximumClaims(contract))
  // Removing an unrequested relation duty must not remove the already-approved
  // cross-target source context that can explain the requested distinction.
  const relationTargetIds = contract.obligations.filter((obligation) => ["explain_relation", "distinguish_targets"].includes(obligation.kind)
    && obligation.targetIds.includes(target.studentTargetId)).flatMap((obligation) => obligation.targetIds)
    .filter((id) => id !== target.studentTargetId && contract.targetIds.includes(id)
      && !contract.rejectedTargetIds.includes(id))
  const relationUnits = !structuredSequence && !summaryAnchor && contract.safetyIntent === "general_education"
    && ["compare", "relation"].includes(contract.semanticTask)
    ? studentRelationSourceUnits(orderedClaims, relationTargetIds.flatMap(studentTargetVisibleAliases)) : []
  // Preserve the definition anchor and the existing budget. A paragraph unit
  // that cannot fit is skipped intact, not cut down to an orphaned clause.
  const relationClaims: StudentAnswerEvidenceClaim[] = baseClaims.length ? [baseClaims[0]!] : []
  for (const unit of relationUnits) {
    const additions = unit.filter((claim) => !relationClaims.some((row) => row.claimId === claim.claimId))
    if (relationClaims.length + additions.length <= maximumClaims(contract)) relationClaims.push(...additions)
  }
  const relationSelected = relationUnits.length && relationClaims.length > 1
    ? [...relationClaims, ...baseClaims.filter((claim) => !relationClaims.some((row) => row.claimId === claim.claimId))]
      .slice(0, maximumClaims(contract)) : baseClaims
  const subtopic = structuredSequence ? null : selectStudentSubtopicEvidence({
    question, contract, topicId: target.ownerBookTopicId, aliases: visibleAliases,
    selectedClaims: baseClaims, maximumClaims: maximumClaims(contract),
  })
  const claims = subtopic
    ? [baseClaims.find((claim) => claim.role !== "contrast")!, ...subtopic.claims.map((claim) => Object.freeze({
        claimId: claim.claimId, passageId: claim.passageId, sourceId: claim.sourceId, text: claim.text,
        role: classifyStudentAnswerEvidenceClaimRole(claim.text, target.ownerBookTopicTitle, visibleAliases),
      })), ...baseClaims].filter((claim, index, rows) => rows.findIndex((row) => row.claimId === claim.claimId) === index)
        .slice(0, maximumClaims(contract))
    : relationSelected
  if (!claims.length) throw new Error(`dna_student_answer_evidence_missing:${target.studentTargetId}`)
  if (!claims.some((claim) => claim.role !== "contrast")) {
    throw new Error(`dna_student_answer_non_contrast_evidence_missing:${target.studentTargetId}`)
  }
  return Object.freeze({
    studentTargetId: target.studentTargetId,
    ownerBookTopicId: target.ownerBookTopicId,
    ownerBookTopicTitle: target.ownerBookTopicTitle,
    visibleAliases,
    verifiedExampleEvidence,
    claims: Object.freeze(claims),
    ...(subtopic ? { requestedSubtopicEvidence: subtopic.binding } : {}),
  })
}

function localSafetyBoundary(contract: StudentRequestContract) {
  return contract.safetyIntent !== "general_education"
    || contract.obligations.some((obligation) => [
      "refuse_treatment_selection",
      "offer_safe_assessment_frame",
    ].includes(obligation.kind))
}

export function buildStudentAnswerExecutionPlan(input: Readonly<{
  question: string
  contract: StudentRequestContract
  historyEvidence?: readonly StudentConversationEvidenceRef[]
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
    return id === "policy.multiple-plausible-explanations"
      ? Object.freeze({ ...unit, text: multiplePlausibleExplanationsText(input.contract) })
      : unit
  })
  const local = localSafetyBoundary(input.contract)
  const historyAnchorRequired = input.contract.obligations.some((obligation) => obligation.kind === "use_history_anchor")
    || Boolean(input.contract.referentCaseContext?.eventIds.length || input.contract.referentCaseContext?.scenario)
  const referentCaseContext = input.contract.referentCaseContext && (input.contract.referentCaseContext.eventIds.length || input.contract.referentCaseContext.scenario)
    ? Object.freeze({
        eventIds: Object.freeze([...input.contract.referentCaseContext.eventIds]),
        eventLabels: studentCaseEventLabels(input.contract.referentCaseContext),
        ...(input.contract.referentCaseContext.scenario ? { scenario: input.contract.referentCaseContext.scenario } : {}),
        rawMessageStored: false as const,
      })
    : null
  const historyAnchor = historyAnchorRequired && input.contract.referent.turnId && input.contract.referent.role !== "none"
    ? Object.freeze({
        turnId: input.contract.referent.turnId,
        role: input.contract.referent.role,
        targetIds: Object.freeze([...input.contract.referent.targetIds]),
        targetLabels: Object.freeze(input.contract.referent.targetIds.map((targetId) =>
          studentTargetVisibleAliases(targetId)[0] ?? targetId)),
        rawHistoryStored: false as const,
        caseContext: referentCaseContext,
      })
    : null
  if (historyAnchorRequired && !historyAnchor) throw new Error("dna_student_answer_history_anchor_missing")
  const caseHistoryContext = input.contract.caseHistoryContext
    ? Object.freeze({
        turnIds: Object.freeze([...input.contract.caseHistoryContext.turnIds]),
        eventIds: Object.freeze([...input.contract.caseHistoryContext.eventIds]),
        eventLabels: studentCaseEventLabels({
          eventIds: input.contract.caseHistoryContext.eventIds,
          rawMessageStored: false,
        }),
        rawMessageStored: false as const,
      })
    : null
  if (input.historyEvidence !== undefined && !isStudentConversationEvidence(input.historyEvidence)) {
    throw new Error("student_history_evidence_invalid")
  }
  const targetEvidence = Object.freeze(active.map((target) => {
    const evidence = evidenceForTarget(target, input.contract, input.question)
    if (local || input.contract.semanticTask !== "summarize") return evidence
    const refs = (input.historyEvidence ?? []).filter(ref => ref.targetId === target.studentTargetId)
    if (!refs.length) return evidence
    const allowedTopics = studentRelatedEvidenceTopicIds(target.ownerBookTopicId, evidence.visibleAliases)
    const ownClaims = new Set(getDnaOwnerBookTopicClaims(target.ownerBookTopicId, true).map(claim => claim.claimId))
    const claims = refs.map(ref => {
      const canonical = canonicalStudentConversationClaim(ref.claimId)
      if (!canonical || (!ownClaims.has(ref.claimId) && !allowedTopics.includes(canonical.topicId))) {
        throw new Error("student_summary_history_source_outside_target")
      }
      return Object.freeze({ claimId: canonical.claimId, passageId: canonical.passageId,
        sourceId: canonical.sourceId, text: canonical.text,
        role: classifyStudentAnswerEvidenceClaimRole(canonical.text, target.ownerBookTopicTitle, evidence.visibleAliases) })
    })
    // Rehydrate prior accepted support, not a new generic definition paragraph.
    // The encrypted application context is the authority for these references;
    // canonical book membership is still independently checked here.
    return Object.freeze({ ...evidence, claims: Object.freeze(claims),
      priorAcceptedSupportClaimIds: Object.freeze(refs.map(ref => ref.claimId)) })
  }))
  const summaryEpistemicScope: StudentAnswerExecutionPlan["summaryEpistemicScope"] =
    input.contract.semanticTask === "summarize"
      && input.contract.obligations.some((row) => row.kind === "summarize_unknown")
      ? Object.freeze({
          selectedClaimsAreExhaustive: false,
          unknownScope: "supported_limits_only_not_absence_from_selected_claims",
          establishedContextClaimIds: Object.freeze(targetEvidence.flatMap((target) =>
            target.claims.filter((claim) => claim.role !== "contrast").map((claim) => claim.claimId))),
          limitPolicyIds: Object.freeze([EVIDENCE_LIMIT_POLICY.id]),
        })
      : null
  const requestedRelationFocus = input.contract.semanticTask === "compare"
    && input.contract.requestedSemanticTasks.includes("relate")
    ? studentRequestedComparisonRelationFocus(input.question) : null
  const plan: StudentAnswerExecutionPlan = Object.freeze({
    version: DNA_STUDENT_ANSWER_EXECUTION_PLAN_VERSION,
    requestContractVersion: input.contract.version,
    turnId: input.contract.turnId,
    operation: input.contract.semanticTask,
    ...(requestedRelationFocus ? { requestedRelationFocus } : {}),
    executionRoute: local ? "local_safety_boundary" : "provider_grounded",
    activeTargetIds: Object.freeze([...input.contract.targetIds]),
    rejectedTargetIds: Object.freeze([...input.contract.rejectedTargetIds]),
    rejectedTargetTopics: Object.freeze(rejected.map((target) => Object.freeze({
      studentTargetId: target.studentTargetId,
      ownerBookTopicId: target.ownerBookTopicId,
      ownerBookTopicTitle: target.ownerBookTopicTitle,
    }))),
    historyAnchor,
    caseHistoryContext,
    ...(!local && input.contract.semanticTask === "compare"
      && (input.contract.caseContext.eventIds.length || input.contract.caseContext.describedSituation)
      ? { currentComparisonContext: Object.freeze({ eventIds: Object.freeze([...input.contract.caseContext.eventIds]),
          ...(input.contract.caseContext.describedSituation ? { describedSituation: true as const } : {}),
          eventLabels: studentCaseEventLabels(input.contract.caseContext), rawMessageStored: false as const }) } : {}),
    targetEvidence,
    obligations: Object.freeze([...input.contract.obligations]),
    policyUnits: Object.freeze(policyUnits),
    summaryEpistemicScope,
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
  const activeTargetLimit = contract.semanticTask === "summarize" ? 16 : 8
  if (plan.version !== DNA_STUDENT_ANSWER_EXECUTION_PLAN_VERSION
    || plan.requestContractVersion !== contract.version
    || plan.turnId !== contract.turnId
    || plan.operation !== contract.semanticTask
    || plan.rawQuestionStored !== false
    || plan.activeTargetIds.length < 1
    || plan.activeTargetIds.length > activeTargetLimit
    || !sameSet(plan.activeTargetIds, contract.targetIds)
    || !sameSet(plan.rejectedTargetIds, contract.rejectedTargetIds)
    || plan.activeTargetIds.some((targetId) => plan.rejectedTargetIds.includes(targetId))) return false
  const expectedRoute = localSafetyBoundary(contract) ? "local_safety_boundary" : "provider_grounded"
  if (plan.executionRoute !== expectedRoute
    || plan.providerMayReceiveTransientQuestion !== (expectedRoute === "provider_grounded")) return false
  if (plan.requestedRelationFocus && (contract.semanticTask !== "compare"
    || !contract.requestedSemanticTasks.includes("relate")
    || !["definition_scope", "source_connection"].includes(plan.requestedRelationFocus)
    || !contract.obligations.some(row => row.kind === "explain_relation"))) return false
  const currentComparisonRequired = expectedRoute === "provider_grounded" && contract.semanticTask === "compare"
    && (contract.caseContext.eventIds.length > 0 || contract.caseContext.describedSituation === true)
  if (Boolean(plan.currentComparisonContext) !== currentComparisonRequired) return false
  if (plan.currentComparisonContext && (plan.currentComparisonContext.rawMessageStored !== false
    || plan.currentComparisonContext.describedSituation !== contract.caseContext.describedSituation
    || !sameSet(plan.currentComparisonContext.eventIds, contract.caseContext.eventIds)
    || !sameSet(plan.currentComparisonContext.eventLabels, studentCaseEventLabels(contract.caseContext)))) return false
  if (!sameSet(plan.targetEvidence.map((row) => row.studentTargetId), contract.targetIds)) return false
  const summaryUnknownRequested = contract.semanticTask === "summarize"
    && contract.obligations.some((row) => row.kind === "summarize_unknown")
  if (Boolean(plan.summaryEpistemicScope) !== summaryUnknownRequested) return false
  if (plan.summaryEpistemicScope && (
    plan.summaryEpistemicScope.selectedClaimsAreExhaustive !== false
    || plan.summaryEpistemicScope.unknownScope !== "supported_limits_only_not_absence_from_selected_claims"
    || !sameSet(plan.summaryEpistemicScope.limitPolicyIds, [EVIDENCE_LIMIT_POLICY.id])
    || !sameSet(plan.summaryEpistemicScope.establishedContextClaimIds, plan.targetEvidence.flatMap((target) =>
      target.claims.filter((claim) => claim.role !== "contrast").map((claim) => claim.claimId)))
  )) return false
  const historyAnchorRequired = contract.obligations.some((obligation) => obligation.kind === "use_history_anchor")
    || Boolean(contract.referentCaseContext?.eventIds.length || contract.referentCaseContext?.scenario)
  if (historyAnchorRequired !== (plan.historyAnchor !== null)) return false
  if (plan.historyAnchor && (
    plan.historyAnchor.turnId !== contract.referent.turnId
    || plan.historyAnchor.role !== contract.referent.role
    || plan.historyAnchor.rawHistoryStored !== false
    || !sameSet(plan.historyAnchor.targetIds, contract.referent.targetIds)
    || plan.historyAnchor.targetLabels.length !== plan.historyAnchor.targetIds.length
    || Boolean(plan.historyAnchor.caseContext) !== Boolean(contract.referentCaseContext?.eventIds.length || contract.referentCaseContext?.scenario)
  )) return false
  if (plan.historyAnchor?.caseContext && (
    plan.historyAnchor.caseContext.rawMessageStored !== false
    || JSON.stringify(plan.historyAnchor.caseContext.scenario) !== JSON.stringify(contract.referentCaseContext?.scenario)
    || !sameSet(plan.historyAnchor.caseContext.eventIds, contract.referentCaseContext?.eventIds ?? [])
    || !sameSet(plan.historyAnchor.caseContext.eventLabels,
      contract.referentCaseContext ? studentCaseEventLabels(contract.referentCaseContext) : [])
  )) return false
  if (Boolean(plan.caseHistoryContext) !== Boolean(contract.caseHistoryContext)) return false
  if (plan.caseHistoryContext && contract.caseHistoryContext && (
    plan.caseHistoryContext.rawMessageStored !== false
    || !sameSet(plan.caseHistoryContext.turnIds, contract.caseHistoryContext.turnIds)
    || !sameSet(plan.caseHistoryContext.eventIds, contract.caseHistoryContext.eventIds)
    || !sameSet(plan.caseHistoryContext.eventLabels, studentCaseEventLabels({
      eventIds: contract.caseHistoryContext.eventIds,
      rawMessageStored: false,
    }))
  )) return false
  const handoff = buildStudentS13ResolvedRequestHandoff({ question: "typed validation", contract })
  const expectedTopicByTarget = new Map(handoff.crosswalk.filter((row) => row.polarity === "ACTIVE_TARGET")
    .map((row) => [row.studentTargetId, row.ownerBookTopicId]))
  const expectedRejectedTopicByTarget = new Map(handoff.crosswalk.filter((row) => row.polarity === "REJECTED_TARGET")
    .map((row) => [row.studentTargetId, row.ownerBookTopicId]))
  if (!sameSet(plan.rejectedTargetTopics.map((row) => row.studentTargetId), contract.rejectedTargetIds)
    || plan.rejectedTargetTopics.some((row) => expectedRejectedTopicByTarget.get(row.studentTargetId) !== row.ownerBookTopicId)) return false
  for (const row of plan.targetEvidence) {
    if (expectedTopicByTarget.get(row.studentTargetId) !== row.ownerBookTopicId || !row.claims.length) return false
    if (!row.visibleAliases.length || row.visibleAliases.some((alias) => !studentTargetVisibleAliases(row.studentTargetId).includes(alias))) return false
    const allowedClaims = new Set(getDnaOwnerBookTopicClaims(row.ownerBookTopicId, true).map((claim) => claim.claimId))
    if (row.priorAcceptedSupportClaimIds) {
      if (contract.semanticTask !== "summarize" || expectedRoute !== "provider_grounded"
        || !row.priorAcceptedSupportClaimIds.length || row.priorAcceptedSupportClaimIds.length > 8
        || new Set(row.priorAcceptedSupportClaimIds).size !== row.priorAcceptedSupportClaimIds.length
        || !sameSet(row.priorAcceptedSupportClaimIds, row.claims.map(claim => claim.claimId))) return false
      const allowedTopics = studentRelatedEvidenceTopicIds(row.ownerBookTopicId, row.visibleAliases)
      for (const claim of row.claims) {
        const canonical = canonicalStudentConversationClaim(claim.claimId)
        if (!canonical || (!allowedClaims.has(claim.claimId) && !allowedTopics.includes(canonical.topicId))
          || canonical.text !== claim.text || canonical.passageId !== claim.passageId || canonical.sourceId !== claim.sourceId
          || claim.role !== classifyStudentAnswerEvidenceClaimRole(canonical.text, row.ownerBookTopicTitle, row.visibleAliases)
          || claim.role === "contrast") return false
        allowedClaims.add(claim.claimId)
      }
    }
    const binding = row.requestedSubtopicEvidence
    if (binding) {
      const canonicalTarget = handoff.crosswalk.find((target) => target.polarity === "ACTIVE_TARGET"
        && target.studentTargetId === row.studentTargetId)!
      const canonicalAnchor = evidenceForTarget(canonicalTarget, contract, "").claims.find((claim) => claim.role !== "contrast")
      if (!studentSubtopicRetrievalAllowed(contract)
        || binding.selection !== "requested_subtopic_approved_paragraph"
        || !studentRelatedEvidenceTopicIds(row.ownerBookTopicId, row.visibleAliases).includes(binding.ownerBookTopicId)
        || !binding.claimIds.length || new Set(binding.claimIds).size !== binding.claimIds.length
        || row.claims.length > maximumClaims(contract)
        || !canonicalAnchor || row.claims[0]?.claimId !== canonicalAnchor.claimId
        || row.claims[0]?.text !== canonicalAnchor.text) return false
      const approved = getDnaOwnerBookTopicClaims(binding.ownerBookTopicId, true)
        .filter((claim) => claim.nodeId === binding.nodeId)
      for (const claimId of binding.claimIds) {
        const canonical = approved.find((claim) => claim.claimId === claimId)
        const selected = row.claims.find((claim) => claim.claimId === claimId)
        if (!canonical || !selected || canonical.text !== selected.text
          || canonical.passageId !== selected.passageId || canonical.sourceId !== selected.sourceId) return false
        allowedClaims.add(claimId)
      }
    }
    if (row.claims.some((claim) => !allowedClaims.has(claim.claimId))) return false
    const expectedVerifiedExampleEvidence = verifiedExampleEvidenceForTopic({
      topicId: row.ownerBookTopicId,
      topicTitle: row.ownerBookTopicTitle,
      ownerClaims: getDnaOwnerBookTopicClaims(row.ownerBookTopicId, true),
    })
    if (row.verifiedExampleEvidence.status !== expectedVerifiedExampleEvidence.status
      || !sameSet(row.verifiedExampleEvidence.supportClaimIds, expectedVerifiedExampleEvidence.supportClaimIds)
      || row.verifiedExampleEvidence.supportClaimIds.some((claimId) => !allowedClaims.has(claimId))) return false
    if (!row.claims.some((claim) => claim.role !== "contrast")) return false
    if (row.claims.some((claim) => claim.role !== classifyStudentAnswerEvidenceClaimRole(
      claim.text,
      row.ownerBookTopicTitle,
      row.visibleAliases,
    ))) {
      return false
    }
  }
  if (!sameSet(plan.obligations.map((row) => row.id), contract.obligations.map((row) => row.id))) return false
  for (const obligation of contract.obligations) {
    const unit = POLICY_UNIT_BY_OBLIGATION[obligation.kind]
    const expectedText = unit?.id === "policy.multiple-plausible-explanations"
      ? multiplePlausibleExplanationsText(contract)
      : unit?.text
    if (unit && !plan.policyUnits.some((candidate) => candidate.id === unit.id && candidate.text === expectedText)) return false
  }
  return true
}

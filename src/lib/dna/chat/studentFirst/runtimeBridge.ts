import { getDnaOwnerBookTopicTitle } from "../ownerBookRuntime"
import type { DnaS13Depth, DnaS13RequestedFacet } from "../s13/contracts"
import {
  DNA_S13_CONVERSATION_CONTEXT_VERSION,
  type DnaS13ContextOperation,
  type DnaS13ResolvedUserQuery,
} from "../s13/conversationContext"
import {
  DNA_S13_PRAGMATIC_TASK_FRAME_VERSION,
  type DnaS13DiscourseConstraint,
  type DnaS13PragmaticAction,
  type DnaS13PragmaticTaskFrame,
  type DnaS13PragmaticTarget,
} from "../s13/pragmaticTask"
import { normalizeDnaChatText } from "../text"
import type { StudentRequestContract } from "./contracts"
import { resolveStudentTargetDescriptor } from "./targetCatalog"

export const DNA_STUDENT_S13_HANDOFF_VERSION = "dna-student-s13-handoff@3" as const

export type StudentS13ResolvedRequestHandoff = Readonly<{
  version: typeof DNA_STUDENT_S13_HANDOFF_VERSION
  contextResolution: DnaS13ResolvedUserQuery
  pragmaticTaskFrame: DnaS13PragmaticTaskFrame
  crosswalk: readonly Readonly<{
    studentTargetId: string
    ownerBookTopicId: string
    ownerBookTopicTitle: string
    polarity: "ACTIVE_TARGET" | "REJECTED_TARGET"
  }>[]
}>

function unique<T>(values: readonly T[]) {
  return [...new Set(values)]
}

function depth(contract: StudentRequestContract): DnaS13Depth {
  return contract.presentation.depth === "brief" ? "short"
    : contract.presentation.depth === "deep" ? "deep" : "standard"
}

function action(contract: StudentRequestContract): DnaS13PragmaticAction {
  if (contract.conversationAction === "repair") return "CORRECT_TARGET"
  if (contract.semanticTask === "define") return "DEFINE"
  if (contract.semanticTask === "significance") return "WHY_SIGNIFICANCE"
  if (contract.semanticTask === "deepen") return "DEEPEN"
  if (contract.semanticTask === "compare") return "COMPARE"
  if (contract.semanticTask === "example") return "EXAMPLE"
  if (contract.semanticTask === "summarize") return "SUMMARIZE"
  return "EXPLAIN"
}

function facets(contract: StudentRequestContract): readonly DnaS13RequestedFacet[] {
  const result: DnaS13RequestedFacet[] = []
  const tasks = new Set([...contract.requestedSemanticTasks, contract.semanticTask])
  const explicitMultipart = tasks.has("mechanism") || tasks.has("daily_life")
  const add = (facet: DnaS13RequestedFacet) => {
    if (!result.includes(facet)) result.push(facet)
  }
  if (tasks.has("define")) add("definition")
  else if (tasks.has("significance")) {
    add("function")
    if (!explicitMultipart) add("core_scope")
    if (!explicitMultipart) add("limitation")
  } else if (tasks.has("relate")) {
    add("explanatory_detail")
    if (!explicitMultipart) add("core_scope")
    if (!explicitMultipart) add("limitation")
  } else if (tasks.has("deepen")) {
    add("explanatory_detail")
    if (!explicitMultipart) add("limitation")
  } else if (tasks.has("measurement")) {
    add("supported_meaning")
    add("limitation")
  }
  else if (tasks.has("compare")) add("distinction")
  else if (tasks.has("example")) add("verified_example")
  else if (tasks.has("evidence") && !explicitMultipart) {
    add("supported_meaning")
    add("limitation")
  } else if (tasks.has("observe") || tasks.has("case_reasoning")) {
    add("core_scope")
    add("boundary")
  } else if (tasks.has("treatment_boundary")) {
    add("boundary")
    add("limitation")
  } else if (!explicitMultipart && !tasks.has("boundary")) {
    add("core_scope")
  }
  if (tasks.has("mechanism")) add("explanatory_detail")
  if (tasks.has("daily_life")) add("supported_meaning")
  if (tasks.has("boundary") || tasks.has("evidence")) {
    add("limitation")
    add("boundary")
  }
  if (contract.componentTargetIds.length) add("components")
  if (contract.summaryScope.unknown || contract.observationScope.singleObservationLimit) add("limitation")
  if (!result.length) add("core_scope")
  return Object.freeze(result.slice(0, 4))
}

function constraints(contract: StudentRequestContract): readonly DnaS13DiscourseConstraint[] {
  const result: DnaS13DiscourseConstraint[] = ["no_invention"]
  if (contract.targetIds.length > 1) result.push("preserve_order")
  if (contract.rejectedTargetIds.length) result.push("only_active_target")
  if (contract.presentation.depth === "brief" || contract.presentation.requestedSentenceCount !== null) result.push("concise")
  if (contract.presentation.depth === "deep") result.push("deep")
  return Object.freeze(unique(result))
}

function operation(contract: StudentRequestContract): DnaS13ContextOperation {
  if (contract.conversationAction === "repair") return "replace_previous_target"
  if (contract.presentation.preserveMeaning && contract.referent.kind !== "none") return "simplify_same_topic"
  if (contract.semanticTask === "example" && contract.referent.kind !== "none") return "example_same_topic"
  if (contract.semanticTask === "summarize" && contract.referent.kind !== "none") return "summarize_same_topic"
  if (contract.referent.kind !== "none") return "explain_same_topic"
  return "standalone"
}

function resolveTarget(targetId: string) {
  const descriptor = resolveStudentTargetDescriptor(targetId)
  return Object.freeze({ topicId: descriptor.ownerBookTopicId, title: descriptor.ownerBookTopicTitle })
}

function retrievalQuestion(title: string, contract: StudentRequestContract) {
  const tasks = new Set([...contract.requestedSemanticTasks, contract.semanticTask])
  let base: string
  if (contract.semanticTask === "define") base = `${title} ne demek?`
  else if (contract.semanticTask === "significance") base = `${title} ne işe yarar ve neden önemlidir?`
  else if (contract.semanticTask === "relate") base = `${title} diğer hedeflerle nasıl ilişkilidir ve bu ilişkinin sınırı nedir?`
  else if (contract.semanticTask === "deepen") base = `${title} için temel kapsamın ötesindeki açıklayıcı ayrıntı ve sınır nedir?`
  else if (contract.semanticTask === "boundary") base = `${title} hakkında kanıtın desteklediği yorum ve nedensellik sınırı nedir?`
  else if (contract.semanticTask === "measurement") base = `${title} nasıl değerlendirilir ve ölçüm sonucu neyi tek başına göstermez?`
  // The user's scenario is a presentation payload, not owner-book evidence.
  // Retrieve the scientific target binding here; the obligation-aware answer
  // executor must realize the scenario separately and label it illustrative.
  else if (contract.semanticTask === "example") base = `${title} temel kapsamı nedir?`
  else if (contract.semanticTask === "compare") base = `${title} temel ayrımı nedir?`
  else if (contract.semanticTask === "observe" || contract.semanticTask === "case_reasoning") {
    base = `${title} için tek gözlemin sınırı ve gerekli ek bağlam nedir?`
  } else if (contract.semanticTask === "treatment_boundary") base = `${title} için değerlendirme ve tedavi önerisi sınırı nedir?`
  else if (contract.semanticTask === "summarize") base = `${title} ana kapsamı ve sınırı nedir?`
  else base = `${title} temel kapsamı nedir?`
  const extraParts = [
    ...(tasks.has("mechanism") ? ["desteklenen mekanizma"] : []),
    ...(tasks.has("daily_life") ? ["günlük yaşamdaki anlam"] : []),
    ...((tasks.has("boundary") || tasks.has("evidence")) && contract.semanticTask !== "boundary"
      ? ["kanıt sınırı"] : []),
  ]
  return extraParts.length
    ? `${base.replace(/\?$/u, "")} Ayrıca ${extraParts.join(", ")} nedir?`
    : base
}

export function buildStudentS13ResolvedRequestHandoff(input: Readonly<{
  question: string
  contract: StudentRequestContract
}>): StudentS13ResolvedRequestHandoff {
  const active = input.contract.targetIds.map((studentTargetId) => Object.freeze({
    studentTargetId,
    ...resolveTarget(studentTargetId),
    polarity: "ACTIVE_TARGET" as const,
  }))
  const rejected = input.contract.rejectedTargetIds.map((studentTargetId) => Object.freeze({
    studentTargetId,
    ...resolveTarget(studentTargetId),
    polarity: "REJECTED_TARGET" as const,
  }))
  const activeTopicIds = unique(active.map((target) => target.topicId))
  const rejectedTopicIds = unique(rejected.map((target) => target.topicId))
  const activeTopicLimit = input.contract.semanticTask === "summarize" ? 16 : 8
  if (!activeTopicIds.length) throw new Error("dna_student_s13_handoff_target_missing")
  if (activeTopicIds.length > activeTopicLimit) throw new Error("dna_student_s13_handoff_target_limit")
  if (activeTopicIds.some((topicId) => rejectedTopicIds.includes(topicId))) {
    throw new Error("dna_student_s13_handoff_target_polarity_conflict")
  }
  const activeByTopic = active.filter((target, index, rows) =>
    rows.findIndex((row) => row.topicId === target.topicId) === index)
  const rejectedByTopic = rejected.filter((target, index, rows) =>
    rows.findIndex((row) => row.topicId === target.topicId) === index)
  const normalizedQuestion = normalizeDnaChatText(input.question)
  const pragmaticAction = action(input.contract)
  const requestedFacets = facets(input.contract)
  const contextOperation = operation(input.contract)
  const targetResolution = input.contract.conversationAction === "repair" ? "REPLACED_TARGET" as const
    : activeByTopic.length > 1 ? "MULTI_TARGET" as const
      : input.contract.referent.kind !== "none" ? "CONTEXT_TARGET" as const : "EXPLICIT_TARGET" as const
  const targets: readonly DnaS13PragmaticTarget[] = Object.freeze([
    ...activeByTopic.map((target) => Object.freeze({
      topicId: target.topicId,
      surface: target.title,
      polarity: "ACTIVE_TARGET" as const,
    })),
    ...rejectedByTopic.map((target) => Object.freeze({
      topicId: target.topicId,
      surface: target.title,
      polarity: "REJECTED_TARGET" as const,
    })),
  ])
  const task: DnaS13PragmaticTaskFrame = Object.freeze({
    version: DNA_S13_PRAGMATIC_TASK_FRAME_VERSION,
    normalizedQuestion,
    targetResolution,
    targets,
    pragmaticAction,
    baseAction: pragmaticAction === "SIMPLIFY" ? "EXPLAIN" : pragmaticAction,
    presentationModifiers: Object.freeze(input.contract.presentation.preserveMeaning ? ["SIMPLIFY" as const] : []),
    requestedFacets,
    discourseConstraints: constraints(input.contract),
    actionConfidence: "HIGH",
    facetConfidence: "HIGH",
  })
  const context: DnaS13ResolvedUserQuery = Object.freeze({
    version: DNA_S13_CONVERSATION_CONTEXT_VERSION,
    originalQuestion: input.question,
    normalizedQuestion,
    operation: contextOperation,
    followUp: input.contract.referent.kind !== "none" || input.contract.conversationAction !== "start",
    correction: input.contract.conversationAction === "repair",
    targetSurface: activeByTopic.map((target) => target.title).join(" · ") || null,
    targetTopicIds: Object.freeze(activeByTopic.map((target) => target.topicId)),
    topicMentions: Object.freeze(targets.map((target) => Object.freeze({
      topicId: target.topicId,
      title: getDnaOwnerBookTopicTitle(target.topicId) ?? target.surface ?? target.topicId,
      surface: target.surface,
      polarity: target.polarity,
    }))),
    retrievalQuestions: Object.freeze(activeByTopic.map((target) => retrievalQuestion(target.title, input.contract))),
    responseDepth: depth(input.contract),
    resolutionMethod: "controlled_alias",
    ambiguityReason: null,
    contextInherited: input.contract.referent.kind !== "none",
    intraTurnCoreferenceCount: 0,
    topicResolutionConfidence: "HIGH",
    candidateTopicIds: Object.freeze(activeByTopic.map((target) => target.topicId)),
    previousAction: null,
    previousFacets: Object.freeze([]),
  })
  return Object.freeze({
    version: DNA_STUDENT_S13_HANDOFF_VERSION,
    contextResolution: context,
    pragmaticTaskFrame: task,
    crosswalk: Object.freeze([...activeByTopic, ...rejectedByTopic].map((target) => Object.freeze({
      studentTargetId: target.studentTargetId,
      ownerBookTopicId: target.topicId,
      ownerBookTopicTitle: target.title,
      polarity: target.polarity,
    }))),
  })
}

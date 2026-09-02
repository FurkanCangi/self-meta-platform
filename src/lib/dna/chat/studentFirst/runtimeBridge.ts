import {
  getDnaOwnerBookTopicTitle,
  resolveDnaOwnerBook,
} from "../ownerBookRuntime"
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

export const DNA_STUDENT_S13_HANDOFF_VERSION = "dna-student-s13-handoff@1" as const

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

const TARGET_TO_OWNER_CROSSWALK: Readonly<Record<string, Readonly<{ query: string; expectedLeaf: string }>>> = Object.freeze({
  self_regulation: Object.freeze({ query: "Self-Regülasyon Nedir?", expectedLeaf: "Self-Regülasyon Nedir?" }),
  self_control: Object.freeze({ query: "Yürütücü İşlev ve Öz-Kontrol", expectedLeaf: "Yürütücü İşlev ve Öz-Kontrol" }),
  attention: Object.freeze({ query: "Yürütücü İşlev ve Dikkat", expectedLeaf: "Yürütücü İşlev ve Dikkat" }),
  executive_functions: Object.freeze({ query: "Yürütücü İşlevlerin Temel Yapısı", expectedLeaf: "Yürütücü İşlevlerin Temel Yapısı" }),
  inhibition: Object.freeze({ query: "İnhibisyon Nedir?", expectedLeaf: "İnhibisyon Nedir?" }),
  working_memory: Object.freeze({ query: "Çalışma Belleği", expectedLeaf: "Çalışma Belleği ve Kısa Süreli Bellek" }),
  planning: Object.freeze({ query: "Planlama", expectedLeaf: "Planlama" }),
  cognitive_flexibility: Object.freeze({ query: "Esneklik Nedir?", expectedLeaf: "Esneklik Nedir?" }),
  coregulation: Object.freeze({ query: "Ko-Regülasyon", expectedLeaf: "Ko-Regülasyon" }),
  arousal: Object.freeze({
    query: "Arousal, Uyanıklık ve Dikkat Arasındaki Ayrım",
    expectedLeaf: "Arousal, Uyanıklık ve Dikkat Arasındaki Ayrım",
  }),
  sensory_regulation: Object.freeze({
    query: "Duyusal Regülasyonun Self-Regülasyon İçindeki Yeri",
    expectedLeaf: "Duyusal Regülasyonun Self-Regülasyon İçindeki Yeri",
  }),
  sensory_modulation: Object.freeze({ query: "Duyusal Modülasyon", expectedLeaf: "Duyusal Modülasyon" }),
  emotion_regulation: Object.freeze({ query: "Duygusal Regülasyon", expectedLeaf: "Duygusal Regülasyon" }),
  interoception: Object.freeze({ query: "İnterosepsiyon Nedir?", expectedLeaf: "İnterosepsiyonun Tanımı" }),
  reactivity: Object.freeze({ query: "Reaktivite ve Regülasyon Ayrımı", expectedLeaf: "Reaktivite ve Regülasyon Ayrımı" }),
  recovery: Object.freeze({ query: "Reaktivite ve Toparlanma", expectedLeaf: "Reaktivite ve Toparlanma" }),
})

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
  if (contract.semanticTask === "compare") return "COMPARE"
  if (contract.semanticTask === "example") return "EXAMPLE"
  if (contract.semanticTask === "summarize") return "SUMMARIZE"
  return "EXPLAIN"
}

function facets(contract: StudentRequestContract): readonly DnaS13RequestedFacet[] {
  const result: DnaS13RequestedFacet[] = []
  const add = (facet: DnaS13RequestedFacet) => {
    if (!result.includes(facet)) result.push(facet)
  }
  if (contract.semanticTask === "define") add("definition")
  else if (contract.semanticTask === "compare") add("distinction")
  else if (contract.semanticTask === "example") add("verified_example")
  else if (contract.semanticTask === "evidence") {
    add("supported_meaning")
    add("limitation")
  } else if (contract.semanticTask === "observe" || contract.semanticTask === "case_reasoning") {
    add("core_scope")
    add("boundary")
  } else if (contract.semanticTask === "treatment_boundary") {
    add("boundary")
    add("limitation")
  } else {
    add("core_scope")
  }
  if (contract.componentTargetIds.length) add("components")
  if (contract.summaryScope.unknown || contract.observationScope.singleObservationLimit) add("limitation")
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
  if (contract.presentation.preserveMeaning) return "simplify_same_topic"
  if (contract.semanticTask === "example" && contract.referent.kind !== "none") return "example_same_topic"
  if (contract.semanticTask === "summarize" && contract.referent.kind !== "none") return "summarize_same_topic"
  if (contract.referent.kind !== "none") return "explain_same_topic"
  return "standalone"
}

function resolveTarget(targetId: string) {
  const crosswalk = TARGET_TO_OWNER_CROSSWALK[targetId]
  if (!crosswalk) throw new Error(`dna_student_s13_crosswalk_missing:${targetId}`)
  const match = resolveDnaOwnerBook(crosswalk.query, [], "standard")
  if (!match) throw new Error(`dna_student_s13_crosswalk_unresolved:${targetId}`)
  const title = getDnaOwnerBookTopicTitle(match.topicId)
  if (!title) throw new Error(`dna_student_s13_crosswalk_title_missing:${targetId}`)
  if (title.split(" · ").at(-1) !== crosswalk.expectedLeaf) {
    throw new Error(`dna_student_s13_crosswalk_title_drift:${targetId}`)
  }
  return Object.freeze({ topicId: match.topicId, title })
}

function retrievalQuestion(title: string, contract: StudentRequestContract) {
  if (contract.semanticTask === "define") return `${title} ne demek?`
  // The user's scenario is a presentation payload, not owner-book evidence.
  // Retrieve the scientific target binding here; the obligation-aware answer
  // executor must realize the scenario separately and label it illustrative.
  if (contract.semanticTask === "example") return `${title} temel kapsamı nedir?`
  if (contract.semanticTask === "compare") return `${title} temel ayrımı nedir?`
  if (contract.semanticTask === "observe" || contract.semanticTask === "case_reasoning") {
    return `${title} için tek gözlemin sınırı ve gerekli ek bağlam nedir?`
  }
  if (contract.semanticTask === "treatment_boundary") return `${title} için değerlendirme ve tedavi önerisi sınırı nedir?`
  if (contract.semanticTask === "summarize") return `${title} ana kapsamı ve sınırı nedir?`
  return `${title} temel kapsamı nedir?`
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
  if (!activeTopicIds.length) throw new Error("dna_student_s13_handoff_target_missing")
  if (activeTopicIds.length > 8) throw new Error("dna_student_s13_handoff_target_limit")
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

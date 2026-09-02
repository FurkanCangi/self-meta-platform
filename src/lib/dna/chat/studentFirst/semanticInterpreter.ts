import type {
  StudentAnswerObligation,
  StudentAnswerObligationKind,
  StudentConversationAction,
  StudentConversationState,
  StudentPresentationRequest,
  StudentReferent,
  StudentRequestContract,
  StudentSemanticTask,
} from "./contracts"
import {
  DNA_STUDENT_FIRST_REQUEST_VERSION,
} from "./contracts"
import { DNA_STUDENT_TARGET_LEXICON } from "./conversationState"

export const DNA_STUDENT_SEMANTIC_INTERPRETER_VERSION = "dna-student-semantic-interpreter@1" as const

export const DNA_STUDENT_SEMANTIC_TASKS = Object.freeze([
  "define", "explain", "compare", "example", "case_reasoning", "summarize",
  "observe", "evidence", "treatment_boundary",
] as const satisfies readonly StudentSemanticTask[])

export const DNA_STUDENT_CONVERSATION_ACTIONS = Object.freeze([
  "start", "continue", "repair", "return", "summarize_session",
] as const satisfies readonly StudentConversationAction[])

export const DNA_STUDENT_OBLIGATION_KINDS = Object.freeze([
  "define_target",
  "distinguish_targets",
  "explain_relation",
  "give_concrete_example",
  "bind_example_to_target",
  "honor_rejected_target",
  "use_history_anchor",
  "preserve_target_while_simplifying",
  "cover_requested_component",
  "state_single_observation_limit",
  "name_additional_context",
  "summarize_known",
  "summarize_unknown",
  "summarize_observation_focus",
  "refuse_treatment_selection",
  "offer_safe_assessment_frame",
] as const satisfies readonly StudentAnswerObligationKind[])

type StudentSemanticFrame = Readonly<{
  semanticTask: StudentSemanticTask
  conversationAction: StudentConversationAction
  targetIds: readonly string[]
  rejectedTargetIds: readonly string[]
  comparisonTargetIds: readonly string[]
  componentTargetIds: readonly string[]
  referent: StudentReferent
  presentation: StudentPresentationRequest
  obligationKinds: readonly StudentAnswerObligationKind[]
  ambiguity: StudentRequestContract["ambiguity"]
  safetyIntent: StudentRequestContract["safetyIntent"]
}>

const TARGET_IDS = Object.freeze(DNA_STUDENT_TARGET_LEXICON.map((target) => target.id))
const TARGET_ID_SET = new Set(TARGET_IDS)
const TASK_SET = new Set<string>(DNA_STUDENT_SEMANTIC_TASKS)
const ACTION_SET = new Set<string>(DNA_STUDENT_CONVERSATION_ACTIONS)
const OBLIGATION_SET = new Set<string>(DNA_STUDENT_OBLIGATION_KINDS)
const AMBIGUITIES = new Set(["none", "target_missing", "comparison_side_missing", "history_anchor_missing"])
const SAFETY_INTENTS = new Set(["general_education", "case_interpretation", "treatment_selection"])

function uniqueStrings(
  value: unknown,
  allowed: ReadonlySet<string>,
  maxItems: number,
): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null
  if (value.some((item) => typeof item !== "string" || !allowed.has(item))) return null
  const unique = [...new Set(value as string[])]
  return unique.length === value.length ? unique : null
}

function parsePresentation(value: unknown): StudentPresentationRequest | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  if (!["brief", "standard", "deep"].includes(String(row.depth))) return null
  if (!["plain_student", "standard"].includes(String(row.language))) return null
  if (!["prose", "bullets", "table"].includes(String(row.format))) return null
  if (!["none", "brief", "concrete"].includes(String(row.example))) return null
  if (row.requestedSentenceCount !== null && (!Number.isInteger(row.requestedSentenceCount) || Number(row.requestedSentenceCount) < 1 || Number(row.requestedSentenceCount) > 6)) return null
  return Object.freeze({
    depth: row.depth as StudentPresentationRequest["depth"],
    language: row.language as StudentPresentationRequest["language"],
    format: row.format as StudentPresentationRequest["format"],
    example: row.example as StudentPresentationRequest["example"],
    requestedSentenceCount: row.requestedSentenceCount as number | null,
  })
}

function parseReferent(value: unknown, state: StudentConversationState): StudentReferent | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  if (!["none", "active", "history"].includes(String(row.kind))) return null
  const targetIds = uniqueStrings(row.targetIds, TARGET_ID_SET, 8)
  if (!targetIds) return null
  const turnId = row.turnId === null ? null : typeof row.turnId === "string" ? row.turnId : null
  if (row.turnId !== null && turnId === null) return null
  const historyIds = new Set(state.semanticHistory.map((turn) => turn.turnId))
  if (turnId !== null && !historyIds.has(turnId)) return null
  if (row.kind === "none" && (turnId !== null || targetIds.length)) return null
  if (row.kind !== "none" && turnId === null) return null
  if (row.kind === "active" && turnId !== state.semanticHistory.at(-1)?.turnId) return null
  return Object.freeze({ kind: row.kind as StudentReferent["kind"], turnId, targetIds: Object.freeze(targetIds) })
}

function obligationTargets(kind: StudentAnswerObligationKind, frame: StudentSemanticFrame): readonly string[] {
  if (kind === "honor_rejected_target") return frame.rejectedTargetIds
  if (kind === "distinguish_targets" || kind === "explain_relation") return frame.comparisonTargetIds.length
    ? frame.comparisonTargetIds
    : frame.targetIds
  if (kind === "cover_requested_component") return frame.componentTargetIds.length
    ? frame.componentTargetIds
    : frame.targetIds
  return frame.targetIds
}

const OBLIGATION_DESCRIPTIONS: Readonly<Record<StudentAnswerObligationKind, string>> = Object.freeze({
  define_target: "Hedef kavramı doğrudan tanımla",
  distinguish_targets: "Karşılaştırılan kavramları birbirinden ayır",
  explain_relation: "Kavramların ilişkisini açıkla",
  give_concrete_example: "İstenen bağlamda somut örnek ver",
  bind_example_to_target: "Örneğin hedef kavramla bağını açıkla",
  honor_rejected_target: "Kullanıcının reddettiği hedefe geri dönme",
  use_history_anchor: "Doğru geçmiş konuşma hedefini kullan",
  preserve_target_while_simplifying: "Aynı hedefi daha sade dille anlat",
  cover_requested_component: "İstenen bileşenlerin her birini ayrı karşıla",
  state_single_observation_limit: "Tek gözlemden kesin sonuç çıkarma",
  name_additional_context: "Gerekli ek bağlam veya gözlemi belirt",
  summarize_known: "Konuşmada desteklenen bilgileri özetle",
  summarize_unknown: "Bilinmeyen veya kesinleştirilemeyen noktaları özetle",
  summarize_observation_focus: "Gözlemde izlenecek noktaları özetle",
  refuse_treatment_selection: "Tedavi veya terapi seçimi yapma",
  offer_safe_assessment_frame: "Güvenli genel değerlendirme çerçevesi sun",
})

function compileObligations(
  turnId: string,
  frame: StudentSemanticFrame,
): readonly StudentAnswerObligation[] {
  const obligations: StudentAnswerObligation[] = []
  frame.obligationKinds.forEach((kind, index) => {
    if (kind === "cover_requested_component" && frame.componentTargetIds.length > 1) {
      frame.componentTargetIds.forEach((targetId, componentIndex) => obligations.push(Object.freeze({
        id: `${turnId}:o${index + 1}.${componentIndex + 1}`,
        kind,
        targetIds: Object.freeze([targetId]),
        description: `${OBLIGATION_DESCRIPTIONS[kind]}: ${targetId}`,
      })))
      return
    }
    obligations.push(Object.freeze({
      id: `${turnId}:o${index + 1}`,
      kind,
      targetIds: Object.freeze([...obligationTargets(kind, frame)]),
      description: OBLIGATION_DESCRIPTIONS[kind],
    }))
  })
  return Object.freeze(obligations)
}

export function validateStudentSemanticFrame(
  candidate: unknown,
  state: StudentConversationState,
): StudentSemanticFrame | null {
  if (!candidate || typeof candidate !== "object") return null
  const row = candidate as Record<string, unknown>
  if (!TASK_SET.has(String(row.semanticTask)) || !ACTION_SET.has(String(row.conversationAction))) return null
  const targetIds = uniqueStrings(row.targetIds, TARGET_ID_SET, 8)
  const rejectedTargetIds = uniqueStrings(row.rejectedTargetIds, TARGET_ID_SET, 8)
  const comparisonTargetIds = uniqueStrings(row.comparisonTargetIds, TARGET_ID_SET, 4)
  const componentTargetIds = uniqueStrings(row.componentTargetIds, TARGET_ID_SET, 8)
  const obligationKinds = uniqueStrings(row.obligationKinds, OBLIGATION_SET, 12) as StudentAnswerObligationKind[] | null
  const referent = parseReferent(row.referent, state)
  const presentation = parsePresentation(row.presentation)
  if (!targetIds || !rejectedTargetIds || !comparisonTargetIds || !componentTargetIds || !obligationKinds || !referent || !presentation) return null
  if (!AMBIGUITIES.has(String(row.ambiguity)) || !SAFETY_INTENTS.has(String(row.safetyIntent))) return null
  if (!targetIds.length && row.semanticTask !== "treatment_boundary") return null
  if (row.semanticTask === "compare" && comparisonTargetIds.length < 2) return null
  if (row.conversationAction === "start" && state.semanticHistory.length) return null
  if (row.conversationAction !== "start" && !state.semanticHistory.length) return null
  if (row.conversationAction === "return" && referent.kind !== "history") return null
  if (row.conversationAction === "summarize_session" && row.semanticTask !== "summarize") return null
  if (row.semanticTask === "treatment_boundary" && row.safetyIntent !== "treatment_selection") return null
  if (!obligationKinds.length) return null

  return Object.freeze({
    semanticTask: row.semanticTask as StudentSemanticTask,
    conversationAction: row.conversationAction as StudentConversationAction,
    targetIds: Object.freeze(targetIds),
    rejectedTargetIds: Object.freeze(rejectedTargetIds),
    comparisonTargetIds: Object.freeze(comparisonTargetIds),
    componentTargetIds: Object.freeze(componentTargetIds),
    referent,
    presentation,
    obligationKinds: Object.freeze(obligationKinds),
    ambiguity: row.ambiguity as StudentRequestContract["ambiguity"],
    safetyIntent: row.safetyIntent as StudentRequestContract["safetyIntent"],
  })
}

export function compileStudentRequestContract(
  turnId: string,
  frame: StudentSemanticFrame,
): StudentRequestContract {
  return Object.freeze({
    version: DNA_STUDENT_FIRST_REQUEST_VERSION,
    turnId,
    semanticTask: frame.semanticTask,
    conversationAction: frame.conversationAction,
    targetIds: frame.targetIds,
    rejectedTargetIds: frame.rejectedTargetIds,
    comparisonTargetIds: frame.comparisonTargetIds,
    componentTargetIds: frame.componentTargetIds,
    referent: frame.referent,
    presentation: frame.presentation,
    obligations: compileObligations(turnId, frame),
    ambiguity: frame.ambiguity,
    safetyIntent: frame.safetyIntent,
  })
}

export function studentSemanticFrameSchema(state: StudentConversationState): Record<string, unknown> {
  const historyIds = state.semanticHistory.map((turn) => turn.turnId)
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "semanticTask", "conversationAction", "targetIds", "rejectedTargetIds",
      "comparisonTargetIds", "componentTargetIds", "referent", "presentation",
      "obligationKinds", "ambiguity", "safetyIntent",
    ],
    properties: {
      semanticTask: { type: "string", enum: [...DNA_STUDENT_SEMANTIC_TASKS] },
      conversationAction: { type: "string", enum: [...DNA_STUDENT_CONVERSATION_ACTIONS] },
      targetIds: { type: "array", minItems: 0, maxItems: 8, items: { type: "string", enum: [...TARGET_IDS] } },
      rejectedTargetIds: { type: "array", minItems: 0, maxItems: 8, items: { type: "string", enum: [...TARGET_IDS] } },
      comparisonTargetIds: { type: "array", minItems: 0, maxItems: 4, items: { type: "string", enum: [...TARGET_IDS] } },
      componentTargetIds: { type: "array", minItems: 0, maxItems: 8, items: { type: "string", enum: [...TARGET_IDS] } },
      referent: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "turnId", "targetIds"],
        properties: {
          kind: { type: "string", enum: ["none", "active", "history"] },
          turnId: historyIds.length
            ? { anyOf: [{ type: "string", enum: historyIds }, { type: "null" }] }
            : { type: "null" },
          targetIds: { type: "array", minItems: 0, maxItems: 8, items: { type: "string", enum: [...TARGET_IDS] } },
        },
      },
      presentation: {
        type: "object",
        additionalProperties: false,
        required: ["depth", "language", "format", "example", "requestedSentenceCount"],
        properties: {
          depth: { type: "string", enum: ["brief", "standard", "deep"] },
          language: { type: "string", enum: ["plain_student", "standard"] },
          format: { type: "string", enum: ["prose", "bullets", "table"] },
          example: { type: "string", enum: ["none", "brief", "concrete"] },
          requestedSentenceCount: { anyOf: [{ type: "integer", minimum: 1, maximum: 6 }, { type: "null" }] },
        },
      },
      obligationKinds: { type: "array", minItems: 1, maxItems: 12, items: { type: "string", enum: [...DNA_STUDENT_OBLIGATION_KINDS] } },
      ambiguity: { type: "string", enum: [...AMBIGUITIES] },
      safetyIntent: { type: "string", enum: [...SAFETY_INTENTS] },
    },
  }
}

export function studentSemanticInterpreterContent(input: Readonly<{
  turnId: string
  message: string
  state: StudentConversationState
}>): string {
  return JSON.stringify({
    version: DNA_STUDENT_SEMANTIC_INTERPRETER_VERSION,
    turnId: input.turnId,
    currentUserMessage: input.message,
    state: {
      activeTargetIds: input.state.activeTargetIds,
      rejectedTargetIds: input.state.rejectedTargetIds,
      comparisonTargetIds: input.state.comparisonTargetIds,
      compactSummary: input.state.compactSummary,
      semanticHistory: input.state.semanticHistory.map((turn) => ({
        turnId: turn.turnId,
        semanticTask: turn.semanticTask,
        conversationAction: turn.conversationAction,
        targetIds: turn.targetIds,
        rejectedTargetIds: turn.rejectedTargetIds,
        comparisonTargetIds: turn.comparisonTargetIds,
      })),
    },
    allowedTargets: DNA_STUDENT_TARGET_LEXICON,
  })
}

export const DNA_STUDENT_SEMANTIC_INTERPRETER_INSTRUCTIONS = `
Sen yalnız Türkçe bilimsel öğrenci konuşmasını yapılandıran bir yorumlayıcısın. Cevap veya klinik öneri yazma.

Her mesaj için üç bağımsız eksen çıkar:
1. semanticTask: kullanıcının bilimsel olarak istediği iş (define, explain, compare, example, case_reasoning, summarize, observe, evidence, treatment_boundary),
2. conversationAction: konuşmadaki hareket (start, continue, repair, return, summarize_session),
3. presentation: sade dil, uzunluk, biçim ve örnek isteği.

Sunum isteği semantik görevin yerine geçmez. Örneğin “ne demek, öğrenci gibi anlat” semanticTask=define ve language=plain_student olur. Türkçe ekleri ve gündelik ifadeleri anlam düzeyinde yorumla; “tek gözlemle”, “bir kere görerek” ve “sadece bunu gördüm” gözlemden sonuç çıkarma sınırını soruyorsa semanticTask=observe olur.

Yalnız allowedTargets içindeki ID'leri kullan. Yeni hedef uydurma. Açık düzeltmede reddedilen hedefi rejectedTargetIds alanına koy. “İlk anlattığın” gibi dönüşlerde doğru history turnId'yi seç. Oturum özetinde semanticTask=summarize ve conversationAction=summarize_session kullan; konuşmadaki ilgili hedefleri kapsa.

obligationKinds yalnız kullanıcının bu turda gerçekten istediği parçaları içersin. Örnek, karşılaştırma, tek gözlem sınırı, ek bağlam, düzeltme, geçmişe dönüş, sadeleştirme, bilinen/bilinmeyen ve gözlem özeti gibi istekleri kaybetme. Gereksiz yükümlülük ekleme.
`.trim()

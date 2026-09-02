import type {
  StudentAnswerObligationKind,
  StudentConversationAction,
  StudentConversationState,
  StudentObservationScope,
  StudentPresentationRequest,
  StudentReferent,
  StudentRequestContract,
  StudentSemanticTask,
  StudentSummaryScope,
} from "./contracts"
import {
  DNA_STUDENT_FIRST_REQUEST_VERSION,
} from "./contracts"
import { DNA_STUDENT_TARGET_LEXICON } from "./conversationState"
import { compileStudentAnswerObligations } from "./obligationCompiler"

export const DNA_STUDENT_SEMANTIC_INTERPRETER_VERSION = "dna-student-semantic-interpreter@2" as const

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
  summaryScope: StudentSummaryScope
  observationScope: StudentObservationScope
  ambiguity: StudentRequestContract["ambiguity"]
  safetyIntent: StudentRequestContract["safetyIntent"]
}>

const TARGET_IDS = Object.freeze(DNA_STUDENT_TARGET_LEXICON.map((target) => target.id))
const TARGET_ID_SET = new Set(TARGET_IDS)
const TASK_SET = new Set<string>(DNA_STUDENT_SEMANTIC_TASKS)
const ACTION_SET = new Set<string>(DNA_STUDENT_CONVERSATION_ACTIONS)
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
  if (typeof row.preserveMeaning !== "boolean") return null
  return Object.freeze({
    depth: row.depth as StudentPresentationRequest["depth"],
    language: row.language as StudentPresentationRequest["language"],
    format: row.format as StudentPresentationRequest["format"],
    example: row.example as StudentPresentationRequest["example"],
    requestedSentenceCount: row.requestedSentenceCount as number | null,
    preserveMeaning: row.preserveMeaning,
  })
}

function parseSummaryScope(value: unknown): StudentSummaryScope | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  if (typeof row.known !== "boolean" || typeof row.unknown !== "boolean" || typeof row.observationFocus !== "boolean") return null
  return Object.freeze({ known: row.known, unknown: row.unknown, observationFocus: row.observationFocus })
}

function parseObservationScope(value: unknown): StudentObservationScope | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  if (typeof row.singleObservationLimit !== "boolean" || typeof row.additionalContext !== "boolean") return null
  return Object.freeze({ singleObservationLimit: row.singleObservationLimit, additionalContext: row.additionalContext })
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
  const referent = parseReferent(row.referent, state)
  const presentation = parsePresentation(row.presentation)
  const summaryScope = parseSummaryScope(row.summaryScope)
  const observationScope = parseObservationScope(row.observationScope)
  if (!targetIds || !rejectedTargetIds || !comparisonTargetIds || !componentTargetIds || !referent || !presentation || !summaryScope || !observationScope) return null
  if (!AMBIGUITIES.has(String(row.ambiguity)) || !SAFETY_INTENTS.has(String(row.safetyIntent))) return null
  if (!targetIds.length && row.semanticTask !== "treatment_boundary") return null
  if (row.semanticTask === "compare" && comparisonTargetIds.length < 2) return null
  if (componentTargetIds.length === 1) return null
  if (row.conversationAction === "start" && state.semanticHistory.length) return null
  if (row.conversationAction !== "start" && !state.semanticHistory.length) return null
  if (row.conversationAction === "return" && referent.kind !== "history") return null
  if (row.conversationAction === "summarize_session" && row.semanticTask !== "summarize") return null
  if (row.semanticTask === "treatment_boundary" && row.safetyIntent !== "treatment_selection") return null
  if (row.semanticTask === "summarize" && !summaryScope.known) return null
  if (row.semanticTask !== "summarize" && (summaryScope.known || summaryScope.unknown || summaryScope.observationFocus)) return null
  if ((row.semanticTask === "observe" || row.semanticTask === "case_reasoning") && (!observationScope.singleObservationLimit || !observationScope.additionalContext)) return null

  return Object.freeze({
    semanticTask: row.semanticTask as StudentSemanticTask,
    conversationAction: row.conversationAction as StudentConversationAction,
    targetIds: Object.freeze(targetIds),
    rejectedTargetIds: Object.freeze(rejectedTargetIds),
    comparisonTargetIds: Object.freeze(comparisonTargetIds),
    componentTargetIds: Object.freeze(componentTargetIds),
    referent,
    presentation,
    summaryScope,
    observationScope,
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
    summaryScope: frame.summaryScope,
    observationScope: frame.observationScope,
    obligations: compileStudentAnswerObligations(turnId, frame),
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
      "summaryScope", "observationScope", "ambiguity", "safetyIntent",
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
        required: ["depth", "language", "format", "example", "requestedSentenceCount", "preserveMeaning"],
        properties: {
          depth: { type: "string", enum: ["brief", "standard", "deep"] },
          language: { type: "string", enum: ["plain_student", "standard"] },
          format: { type: "string", enum: ["prose", "bullets", "table"] },
          example: { type: "string", enum: ["none", "brief", "concrete"] },
          requestedSentenceCount: { anyOf: [{ type: "integer", minimum: 1, maximum: 6 }, { type: "null" }] },
          preserveMeaning: { type: "boolean" },
        },
      },
      summaryScope: {
        type: "object",
        additionalProperties: false,
        required: ["known", "unknown", "observationFocus"],
        properties: {
          known: { type: "boolean" },
          unknown: { type: "boolean" },
          observationFocus: { type: "boolean" },
        },
      },
      observationScope: {
        type: "object",
        additionalProperties: false,
        required: ["singleObservationLimit", "additionalContext"],
        properties: {
          singleObservationLimit: { type: "boolean" },
          additionalContext: { type: "boolean" },
        },
      },
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
3. presentation: sade dil, uzunluk, biçim, örnek ve aynı anlamı koruyarak yeniden anlatma isteği.

Sunum isteği semantik görevin yerine geçmez. Örneğin “ne demek, öğrenci gibi anlat” semanticTask=define ve language=plain_student olur. Türkçe ekleri ve gündelik ifadeleri anlam düzeyinde yorumla; “tek gözlemle”, “bir kere görerek” ve “sadece bunu gördüm” gözlemden sonuç çıkarma sınırını soruyorsa semanticTask=observe olur.

Yalnız allowedTargets içindeki ID'leri kullan. Yeni hedef uydurma. Açık düzeltmede reddedilen hedefi rejectedTargetIds alanına koy. “İlk anlattığın” gibi dönüşlerde doğru history turnId'yi seç. Oturum özetinde semanticTask=summarize ve conversationAction=summarize_session kullan; konuşmadaki ilgili hedefleri kapsa.

Nihai cevap yükümlülüğü seçme; onu yerel derleyici yapar. Yalnız semantik gerçekleri çıkar:
- componentTargetIds yalnız kullanıcı iki veya daha fazla adı verilmiş bileşenin her birinin ayrı ele alınmasını istiyorsa dolu olsun. “X bunun parçası mı?” bir ilişki sorusudur; componentTargetIds boş kalır.
- summaryScope yalnız özet turunda kullanıcının bilinenler, bilinmeyenler ve gözlem odağından hangilerini istediğini gösterir.
- observationScope kullanıcının tek gözlem sınırı veya ek bağlam/gözlem ihtiyacını açıkça sorduğunu gösterir. observe ve case_reasoning görevlerinde ikisi de true olur.
- presentation.preserveMeaning yalnız önceki hedefi aynı anlamı koruyarak yeniden/sade anlatmayı istiyorsa true olur. Sadece ilk kez sade anlatma isteğinde false olur.
`.trim()

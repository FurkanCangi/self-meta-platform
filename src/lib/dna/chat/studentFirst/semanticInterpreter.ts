import type {
  StudentAnswerObligationKind,
  StudentConversationAction,
  StudentConversationState,
  StudentObservationScope,
  StudentPresentationRequest,
  StudentReferent,
  StudentRequestContract,
  StudentSemanticTask,
} from "./contracts"
import {
  DNA_STUDENT_FIRST_REQUEST_VERSION,
} from "./contracts"
import { DNA_STUDENT_TARGET_LEXICON } from "./conversationState"
import { compileStudentAnswerObligations } from "./obligationCompiler"

export const DNA_STUDENT_SEMANTIC_INTERPRETER_VERSION = "dna-student-semantic-interpreter@5" as const

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

export type StudentSemanticFrame = Readonly<{
  semanticTask: StudentSemanticTask
  conversationAction: StudentConversationAction
  mentionedTargetIds: readonly string[]
  rejectedTargetIds: readonly string[]
  referentTurnId: string | null
  presentation: StudentPresentationRequest
  summaryExtras: Readonly<{ unknown: boolean; observationFocus: boolean }>
  observationExtras: StudentObservationScope
  ambiguity: StudentRequestContract["ambiguity"]
  safetyIntent: StudentRequestContract["safetyIntent"]
}>

export const DNA_STUDENT_FRAME_FAILURE_CODES = Object.freeze([
  "invalid_object",
  "invalid_task_or_action",
  "invalid_mentioned_targets",
  "invalid_rejected_targets",
  "invalid_referent",
  "invalid_presentation",
  "invalid_summary_extras",
  "invalid_observation_extras",
  "invalid_ambiguity_or_safety",
  "conversation_state_mismatch",
  "return_referent_mismatch",
  "summary_task_mismatch",
  "treatment_safety_mismatch",
] as const)

export type StudentFrameFailureCode = typeof DNA_STUDENT_FRAME_FAILURE_CODES[number]
export type StudentFrameValidationResult =
  | Readonly<{ ok: true; frame: StudentSemanticFrame }>
  | Readonly<{ ok: false; failureCode: StudentFrameFailureCode }>

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
  if (!["integrated", "separate_each"].includes(String(row.grouping))) return null
  if (row.requestedSentenceCount !== null && (!Number.isInteger(row.requestedSentenceCount) || Number(row.requestedSentenceCount) < 1 || Number(row.requestedSentenceCount) > 6)) return null
  if (typeof row.preserveMeaning !== "boolean") return null
  return Object.freeze({
    depth: row.depth as StudentPresentationRequest["depth"],
    language: row.language as StudentPresentationRequest["language"],
    format: row.format as StudentPresentationRequest["format"],
    example: row.example as StudentPresentationRequest["example"],
    grouping: row.grouping as StudentPresentationRequest["grouping"],
    requestedSentenceCount: row.requestedSentenceCount as number | null,
    preserveMeaning: row.preserveMeaning,
  })
}

function parseSummaryExtras(value: unknown): StudentSemanticFrame["summaryExtras"] | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  if (typeof row.unknown !== "boolean" || typeof row.observationFocus !== "boolean") return null
  return Object.freeze({ unknown: row.unknown, observationFocus: row.observationFocus })
}

function parseObservationExtras(value: unknown): StudentObservationScope | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  if (typeof row.singleObservationLimit !== "boolean" || typeof row.additionalContext !== "boolean") return null
  return Object.freeze({ singleObservationLimit: row.singleObservationLimit, additionalContext: row.additionalContext })
}

function parseReferentTurnId(value: unknown, state: StudentConversationState): Readonly<{ ok: true; turnId: string | null }> | null {
  const turnId = value === null ? null : typeof value === "string" ? value : null
  if (value !== null && turnId === null) return null
  const historyIds = new Set(state.semanticHistory.map((turn) => turn.turnId))
  if (turnId !== null && !historyIds.has(turnId)) return null
  return Object.freeze({ ok: true, turnId })
}

function frameFailure(failureCode: StudentFrameFailureCode): StudentFrameValidationResult {
  return Object.freeze({ ok: false, failureCode })
}

export function validateStudentSemanticFrameDetailed(
  candidate: unknown,
  state: StudentConversationState,
): StudentFrameValidationResult {
  if (!candidate || typeof candidate !== "object") return frameFailure("invalid_object")
  const row = candidate as Record<string, unknown>
  if (!TASK_SET.has(String(row.semanticTask)) || !ACTION_SET.has(String(row.conversationAction))) return frameFailure("invalid_task_or_action")
  const mentionedTargetIds = uniqueStrings(row.mentionedTargetIds, TARGET_ID_SET, 8)
  if (!mentionedTargetIds) return frameFailure("invalid_mentioned_targets")
  const rejectedTargetIds = uniqueStrings(row.rejectedTargetIds, TARGET_ID_SET, 8)
  if (!rejectedTargetIds) return frameFailure("invalid_rejected_targets")
  const referent = parseReferentTurnId(row.referentTurnId, state)
  if (!referent) return frameFailure("invalid_referent")
  const presentation = parsePresentation(row.presentation)
  if (!presentation) return frameFailure("invalid_presentation")
  const summaryExtras = parseSummaryExtras(row.summaryExtras)
  if (!summaryExtras) return frameFailure("invalid_summary_extras")
  const observationExtras = parseObservationExtras(row.observationExtras)
  if (!observationExtras) return frameFailure("invalid_observation_extras")
  if (!AMBIGUITIES.has(String(row.ambiguity)) || !SAFETY_INTENTS.has(String(row.safetyIntent))) return frameFailure("invalid_ambiguity_or_safety")
  if (row.conversationAction === "start" && state.semanticHistory.length) return frameFailure("conversation_state_mismatch")
  if (row.conversationAction !== "start" && !state.semanticHistory.length) return frameFailure("conversation_state_mismatch")
  if (row.conversationAction === "return" && referent.turnId === null) return frameFailure("return_referent_mismatch")
  if (row.conversationAction === "summarize_session" && row.semanticTask !== "summarize") return frameFailure("summary_task_mismatch")
  if (row.semanticTask === "treatment_boundary" && row.safetyIntent !== "treatment_selection") return frameFailure("treatment_safety_mismatch")

  return Object.freeze({
    ok: true,
    frame: Object.freeze({
      semanticTask: row.semanticTask as StudentSemanticTask,
      conversationAction: row.conversationAction as StudentConversationAction,
      mentionedTargetIds: Object.freeze(mentionedTargetIds),
      rejectedTargetIds: Object.freeze(rejectedTargetIds),
      referentTurnId: referent.turnId,
      presentation,
      summaryExtras,
      observationExtras,
      ambiguity: row.ambiguity as StudentRequestContract["ambiguity"],
      safetyIntent: row.safetyIntent as StudentRequestContract["safetyIntent"],
    }),
  })
}

export function validateStudentSemanticFrame(
  candidate: unknown,
  state: StudentConversationState,
): StudentSemanticFrame | null {
  const result = validateStudentSemanticFrameDetailed(candidate, state)
  return result.ok ? result.frame : null
}

export function compileStudentRequestContract(
  turnId: string,
  frame: StudentSemanticFrame,
  state: StudentConversationState,
): StudentRequestContract {
  const unique = (values: readonly string[]) => [...new Set(values)]
  const allowedMentions = frame.mentionedTargetIds.filter((targetId) => !frame.rejectedTargetIds.includes(targetId))
  const referentSnapshot = frame.referentTurnId
    ? state.semanticHistory.find((turn) => turn.turnId === frame.referentTurnId) ?? null
    : null
  const latestTurnId = state.semanticHistory.at(-1)?.turnId ?? null
  const referent: StudentReferent = Object.freeze({
    kind: frame.referentTurnId === null
      ? "none"
      : frame.conversationAction === "return" || frame.referentTurnId !== latestTurnId
        ? "history"
        : "active",
    turnId: frame.referentTurnId,
    targetIds: Object.freeze(referentSnapshot?.targetIds ?? []),
  })
  const targetIds = frame.conversationAction === "summarize_session"
    ? unique(state.semanticHistory.flatMap((turn) => turn.targetIds))
    : frame.semanticTask === "compare"
      ? unique([...referent.targetIds, ...allowedMentions])
      : frame.conversationAction === "return"
        ? unique([...referent.targetIds, ...allowedMentions])
        : allowedMentions.length
          ? unique(allowedMentions)
          : referent.targetIds.length
            ? unique(referent.targetIds)
            : unique(state.activeTargetIds)
  const comparisonTargetIds = frame.semanticTask === "compare" ? targetIds : Object.freeze([])
  const componentTargetIds = frame.semanticTask === "explain" && targetIds.length > 1 && frame.presentation.grouping === "separate_each"
    ? targetIds
    : Object.freeze([])
  const summaryScope = Object.freeze({
    known: frame.semanticTask === "summarize",
    unknown: frame.semanticTask === "summarize" && frame.summaryExtras.unknown,
    observationFocus: frame.semanticTask === "summarize" && frame.summaryExtras.observationFocus,
  })
  const observationScope = frame.semanticTask === "observe" || frame.semanticTask === "case_reasoning"
    ? Object.freeze({ singleObservationLimit: true, additionalContext: true })
    : frame.semanticTask === "compare"
      ? frame.observationExtras
      : Object.freeze({ singleObservationLimit: false, additionalContext: false })
  const ambiguity = frame.conversationAction === "return" && referent.kind !== "history"
    ? "history_anchor_missing"
    : frame.semanticTask === "compare" && comparisonTargetIds.length < 2
      ? "comparison_side_missing"
      : !targetIds.length && frame.semanticTask !== "treatment_boundary"
        ? "target_missing"
        : frame.ambiguity
  return Object.freeze({
    version: DNA_STUDENT_FIRST_REQUEST_VERSION,
    turnId,
    semanticTask: frame.semanticTask,
    conversationAction: frame.conversationAction,
    targetIds: Object.freeze(targetIds),
    rejectedTargetIds: frame.rejectedTargetIds,
    comparisonTargetIds: Object.freeze(comparisonTargetIds),
    componentTargetIds,
    referent,
    presentation: frame.presentation,
    summaryScope,
    observationScope,
    obligations: compileStudentAnswerObligations(turnId, {
      ...frame,
      targetIds,
      comparisonTargetIds,
      componentTargetIds,
      summaryScope,
      observationScope,
    }),
    ambiguity,
    safetyIntent: frame.safetyIntent,
  })
}

export function studentSemanticFrameSchema(state: StudentConversationState): Record<string, unknown> {
  const historyIds = state.semanticHistory.map((turn) => turn.turnId)
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "semanticTask", "conversationAction", "mentionedTargetIds", "rejectedTargetIds",
      "referentTurnId", "presentation",
      "summaryExtras", "observationExtras", "ambiguity", "safetyIntent",
    ],
    properties: {
      semanticTask: { type: "string", enum: [...DNA_STUDENT_SEMANTIC_TASKS] },
      conversationAction: { type: "string", enum: [...DNA_STUDENT_CONVERSATION_ACTIONS] },
      mentionedTargetIds: { type: "array", minItems: 0, maxItems: 8, items: { type: "string", enum: [...TARGET_IDS] } },
      rejectedTargetIds: { type: "array", minItems: 0, maxItems: 8, items: { type: "string", enum: [...TARGET_IDS] } },
      referentTurnId: historyIds.length
        ? { anyOf: [{ type: "string", enum: historyIds }, { type: "null" }] }
        : { type: "null" },
      presentation: {
        type: "object",
        additionalProperties: false,
        required: ["depth", "language", "format", "example", "grouping", "requestedSentenceCount", "preserveMeaning"],
        properties: {
          depth: { type: "string", enum: ["brief", "standard", "deep"] },
          language: { type: "string", enum: ["plain_student", "standard"] },
          format: { type: "string", enum: ["prose", "bullets", "table"] },
          example: { type: "string", enum: ["none", "brief", "concrete"] },
          grouping: { type: "string", enum: ["integrated", "separate_each"] },
          requestedSentenceCount: { anyOf: [{ type: "integer", minimum: 1, maximum: 6 }, { type: "null" }] },
          preserveMeaning: { type: "boolean" },
        },
      },
      summaryExtras: {
        type: "object",
        additionalProperties: false,
        required: ["unknown", "observationFocus"],
        properties: {
          unknown: { type: "boolean" },
          observationFocus: { type: "boolean" },
        },
      },
      observationExtras: {
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

Yalnız allowedTargets içindeki ID'leri kullan. Yeni hedef uydurma. mentionedTargetIds yalnız mevcut kullanıcı mesajında açıkça adı geçen hedefleri içerir; referans verilen eski turun hedeflerini buraya kopyalama. Açık düzeltmede reddedilen hedefi rejectedTargetIds alanına koy. “Bu/bununla/bu örnekte/ilk anlattığın” gibi ifadeler önceki bir tura işaret ediyorsa yalnız o turun ID'sini referentTurnId alanına yaz; referans yoksa null kullan. Referansın none/active/history türünü ve hedeflerini yerel resolver state'ten türetecek. Oturum özetinde semanticTask=summarize ve conversationAction=summarize_session kullan; özet hedeflerini yerel resolver geçmişten türetecek.

Nihai cevap yükümlülüğü seçme; onu yerel derleyici yapar. Yalnız semantik gerçekleri çıkar:
- presentation.grouping yalnız kullanıcı birden fazla hedefin her birinin ayrı ele alınmasını açıkça istiyorsa separate_each olur. “X bunun parçası mı?” bir ilişki sorusudur ve grouping=integrated kalır.
- summaryExtras yalnız summarize görevinde bilinmeyenleri ve gözlem odağını ayrıca isteyip istemediğini gösterir. Bilinenleri özetleme summarize görevinden yerelde otomatik gelir. Başka görevlerde bu alanları false kullan.
- observationExtras yalnız compare gibi başka bir görev içinde tek gözlem sınırı veya ek bağlam ayrıca isteniyorsa kullanılır. observe ve case_reasoning görevlerinin temel gözlem yükümlülükleri yerelde otomatik gelir; bu görevlerde extras false kalabilir.
- presentation.preserveMeaning yalnız önceki hedefi aynı anlamı koruyarak yeniden/sade anlatmayı istiyorsa true olur. Sadece ilk kez sade anlatma isteğinde false olur.
`.trim()

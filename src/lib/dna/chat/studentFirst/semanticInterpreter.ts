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
import { normalizeDnaChatText } from "../text"

export const DNA_STUDENT_SEMANTIC_INTERPRETER_VERSION = "dna-student-semantic-interpreter@16" as const

export const DNA_STUDENT_SEMANTIC_TASKS = Object.freeze([
  "define", "explain", "compare", "example", "case_reasoning", "summarize",
  "observe", "evidence", "treatment_boundary",
] as const satisfies readonly StudentSemanticTask[])

export const DNA_STUDENT_CONVERSATION_ACTIONS = Object.freeze([
  "start", "continue", "repair", "return", "summarize_session",
] as const satisfies readonly StudentConversationAction[])

export type StudentSemanticActs = Readonly<Record<StudentSemanticTask, boolean>>

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
  semanticActs: StudentSemanticActs
  conversationAction: StudentConversationAction
  mentionedTargetIds: readonly string[]
  rejectedTargetIds: readonly string[]
  referentTurnId: string | null
  referentRole: StudentReferent["role"]
  presentation: StudentPresentationRequest
  summaryExtras: Readonly<{ unknown: boolean; observationFocus: boolean }>
  observationExtras: StudentObservationScope
}>

export const DNA_STUDENT_FRAME_FAILURE_CODES = Object.freeze([
  "invalid_object",
  "invalid_semantic_acts",
  "invalid_conversation_action",
  "invalid_mentioned_targets",
  "invalid_rejected_targets",
  "invalid_referent",
  "invalid_referent_role",
  "invalid_presentation",
  "invalid_summary_extras",
  "invalid_observation_extras",
  "conversation_state_mismatch",
  "return_referent_mismatch",
  "summary_task_mismatch",
] as const)

export type StudentFrameFailureCode = typeof DNA_STUDENT_FRAME_FAILURE_CODES[number]
export type StudentFrameValidationResult =
  | Readonly<{ ok: true; frame: StudentSemanticFrame }>
  | Readonly<{ ok: false; failureCode: StudentFrameFailureCode }>

const TARGET_IDS = Object.freeze(DNA_STUDENT_TARGET_LEXICON.map((target) => target.id))
const TARGET_ID_SET = new Set(TARGET_IDS)
const ACTION_SET = new Set<string>(DNA_STUDENT_CONVERSATION_ACTIONS)
const REFERENT_ROLE_SET = new Set<StudentReferent["role"]>(["none", "utterance", "case_entity"])

export function resolveStudentConversationAction(input: Readonly<{
  message: string
  providerAction: StudentConversationAction
  hasHistory: boolean
  preserveMeaning?: boolean
}>): StudentConversationAction {
  const normalized = normalizeDnaChatText(input.message)
  if (/\b(?:toparla|ozetle|ozet yap|konustuklarimizi|konustugumuzu|konusmayi)\b/.test(normalized)) return "summarize_session"
  if (/\b(?:ilk anlattigin|ilk konu|az onceki konu|geri donelim|donelim|basa donelim)\b/.test(normalized)) return "return"
  const explicitContentRepair = /\b(?:sormuyorum|onu demiyorum|yanlis anladin|kastettigim)\b/.test(normalized)
  if (explicitContentRepair) return "repair"
  const styleOnlyPreserve = Boolean(input.preserveMeaning) || /\b(?:akademik oldu|cok akademik|yeniden soyle|tekrar anlat|daha basit|ogrenci arkadasina anlat)\b/.test(normalized)
  if (styleOnlyPreserve && input.hasHistory) return "continue"
  if (/^(?:hayir|yok)\b/.test(normalized)) return "repair"
  if (!input.hasHistory) return "start"
  return input.providerAction === "start" ? "continue" : input.providerAction
}

function parseSemanticActs(value: unknown): StudentSemanticActs | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  if (DNA_STUDENT_SEMANTIC_TASKS.some((task) => typeof row[task] !== "boolean")) return null
  return Object.freeze(Object.fromEntries(
    DNA_STUDENT_SEMANTIC_TASKS.map((task) => [task, row[task] as boolean]),
  ) as Record<StudentSemanticTask, boolean>)
}

const FALLBACK_TASK_PRIORITY: readonly StudentSemanticTask[] = Object.freeze([
  "observe",
  "evidence",
  "case_reasoning",
  "define",
  "explain",
])

export function resolveStudentSemanticTask(
  frame: Pick<StudentSemanticFrame, "semanticActs" | "conversationAction" | "referentTurnId" | "presentation">,
  state: StudentConversationState,
): StudentSemanticTask {
  const enabledActs = DNA_STUDENT_SEMANTIC_TASKS.filter((task) => frame.semanticActs[task])
  if (!enabledActs.length && frame.presentation.preserveMeaning) {
    const anchor = frame.referentTurnId
      ? state.semanticHistory.find((turn) => turn.turnId === frame.referentTurnId) ?? null
      : state.semanticHistory.at(-1) ?? null
    return anchor?.semanticTask ?? "explain"
  }
  const selected = frame.semanticActs.treatment_boundary
    ? "treatment_boundary"
    : frame.semanticActs.summarize
      ? "summarize"
      : frame.semanticActs.compare
        ? "compare"
        : frame.semanticActs.example
          ? "example"
          : frame.presentation.grouping === "separate_each"
            ? "explain"
            : FALLBACK_TASK_PRIORITY.find((task) => frame.semanticActs[task]) ?? "explain"
  if (frame.conversationAction === "return" && selected === "explain" && enabledActs.length === 1 && frame.referentTurnId) {
    return state.semanticHistory.find((turn) => turn.turnId === frame.referentTurnId)?.semanticTask ?? selected
  }
  return selected
}

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
  const semanticActs = parseSemanticActs(row.semanticActs)
  if (!semanticActs) return frameFailure("invalid_semantic_acts")
  if (!ACTION_SET.has(String(row.conversationAction))) return frameFailure("invalid_conversation_action")
  const mentionedTargetIds = uniqueStrings(row.mentionedTargetIds, TARGET_ID_SET, 8)
  if (!mentionedTargetIds) return frameFailure("invalid_mentioned_targets")
  const rejectedTargetIds = uniqueStrings(row.rejectedTargetIds, TARGET_ID_SET, 8)
  if (!rejectedTargetIds) return frameFailure("invalid_rejected_targets")
  const referent = parseReferentTurnId(row.referentTurnId, state)
  if (!referent) return frameFailure("invalid_referent")
  const referentRole = REFERENT_ROLE_SET.has(row.referentRole as StudentReferent["role"])
    ? row.referentRole as StudentReferent["role"]
    : null
  if (!referentRole || (referent.turnId === null) !== (referentRole === "none")) return frameFailure("invalid_referent_role")
  const presentation = parsePresentation(row.presentation)
  if (!presentation) return frameFailure("invalid_presentation")
  const enabledSemanticActs = DNA_STUDENT_SEMANTIC_TASKS.filter((task) => semanticActs[task])
  const presentationOnlyContinuation = enabledSemanticActs.length === 0 &&
    presentation.preserveMeaning &&
    state.semanticHistory.length > 0 &&
    row.conversationAction !== "start" &&
    row.conversationAction !== "summarize_session"
  if (enabledSemanticActs.length === 0 && !presentationOnlyContinuation) return frameFailure("invalid_semantic_acts")
  const summaryExtras = parseSummaryExtras(row.summaryExtras)
  if (!summaryExtras) return frameFailure("invalid_summary_extras")
  const observationExtras = parseObservationExtras(row.observationExtras)
  if (!observationExtras) return frameFailure("invalid_observation_extras")
  const semanticTask = resolveStudentSemanticTask({
    semanticActs,
    conversationAction: row.conversationAction as StudentConversationAction,
    referentTurnId: referent.turnId,
    presentation,
  }, state)
  if (row.conversationAction === "start" && state.semanticHistory.length) return frameFailure("conversation_state_mismatch")
  if (row.conversationAction !== "start" && !state.semanticHistory.length) return frameFailure("conversation_state_mismatch")
  if (row.conversationAction === "return" && referent.turnId === null) return frameFailure("return_referent_mismatch")
  if (row.conversationAction === "summarize_session" && semanticTask !== "summarize") return frameFailure("summary_task_mismatch")

  return Object.freeze({
    ok: true,
    frame: Object.freeze({
      semanticActs,
      conversationAction: row.conversationAction as StudentConversationAction,
      mentionedTargetIds: Object.freeze(mentionedTargetIds),
      rejectedTargetIds: Object.freeze(rejectedTargetIds),
      referentTurnId: referent.turnId,
      referentRole,
      presentation,
      summaryExtras,
      observationExtras,
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

function resolveCaseEntityAnchor(turnId: string, state: StudentConversationState): string {
  let currentTurnId = turnId
  const visited = new Set<string>()
  for (let depth = 0; depth < 8 && !visited.has(currentTurnId); depth += 1) {
    visited.add(currentTurnId)
    const snapshot = state.semanticHistory.find((turn) => turn.turnId === currentTurnId)
    if (!snapshot || snapshot.semanticTask === "example") return currentTurnId
    const parent = snapshot.referent
    if (parent.role !== "case_entity" || parent.turnId === null) return currentTurnId
    if (!state.semanticHistory.some((turn) => turn.turnId === parent.turnId)) return currentTurnId
    currentTurnId = parent.turnId
  }
  return currentTurnId
}

export function compileStudentRequestContract(
  turnId: string,
  frame: StudentSemanticFrame,
  state: StudentConversationState,
): StudentRequestContract {
  const semanticTask = resolveStudentSemanticTask(frame, state)
  const requestedSemanticTasks = Object.freeze(DNA_STUDENT_SEMANTIC_TASKS.filter((task) => frame.semanticActs[task]))
  const presentation: StudentPresentationRequest = Object.freeze({
    ...frame.presentation,
    example: requestedSemanticTasks.includes("example")
      ? frame.presentation.example === "none" ? "brief" : frame.presentation.example
      : "none",
  })
  const unique = (values: readonly string[]) => [...new Set(values)]
  const allowedMentions = frame.mentionedTargetIds.filter((targetId) => !frame.rejectedTargetIds.includes(targetId))
  const latestTurnId = state.semanticHistory.at(-1)?.turnId ?? null
  const latestSnapshot = state.semanticHistory.at(-1) ?? null
  const latestTargetIds = latestSnapshot?.targetIds ?? []
  const contextBindingTask = semanticTask === "example" || semanticTask === "case_reasoning" || semanticTask === "observe"
  const latestTargetsOverlap = allowedMentions.some((targetId) => latestTargetIds.includes(targetId))
  const contextTargetsCompatible = Boolean(latestSnapshot) && (
    !allowedMentions.length || allowedMentions.every((targetId) => latestTargetIds.includes(targetId))
  )
  const compareContextCompatible = Boolean(latestSnapshot) && semanticTask === "compare" && (
    allowedMentions.length < 2 || latestTargetsOverlap
  )
  const effectiveReferentTurnId = frame.referentTurnId ?? (
    latestTurnId && (
      compareContextCompatible || (contextTargetsCompatible && (contextBindingTask || presentation.preserveMeaning))
    )
      ? latestTurnId
      : null
  )
  const inferredReferentRole: StudentReferent["role"] = effectiveReferentTurnId === null
    ? "none"
    : semanticTask === "case_reasoning" || semanticTask === "observe"
      ? latestSnapshot?.semanticTask === "example" || latestSnapshot?.referent.role === "case_entity"
        ? "case_entity"
        : "utterance"
      : "utterance"
  const effectiveReferentRole = frame.referentTurnId === null ? inferredReferentRole : frame.referentRole
  const resolvedReferentTurnId = effectiveReferentRole === "case_entity" && effectiveReferentTurnId
    ? resolveCaseEntityAnchor(effectiveReferentTurnId, state)
    : effectiveReferentTurnId
  const referentSnapshot = resolvedReferentTurnId
    ? state.semanticHistory.find((turn) => turn.turnId === resolvedReferentTurnId) ?? null
    : null
  const referent: StudentReferent = Object.freeze({
    kind: resolvedReferentTurnId === null
      ? "none"
      : frame.conversationAction === "return" || resolvedReferentTurnId !== latestTurnId
        ? "history"
        : "active",
    role: resolvedReferentTurnId === null ? "none" : effectiveReferentRole,
    turnId: resolvedReferentTurnId,
    targetIds: Object.freeze(referentSnapshot?.targetIds ?? []),
  })
  const mergedTargetIds = frame.conversationAction === "summarize_session"
    ? unique(state.semanticHistory.flatMap((turn) => turn.targetIds))
    : frame.conversationAction === "return"
        ? allowedMentions.length
          ? unique(allowedMentions)
          : unique(referent.targetIds)
      : semanticTask === "compare"
        ? allowedMentions.length >= 2
          ? unique(allowedMentions)
          : unique([...referent.targetIds, ...allowedMentions])
        : allowedMentions.length
          ? unique(allowedMentions)
          : referent.targetIds.length
            ? unique(referent.targetIds)
            : unique(state.activeTargetIds)
  const targetIds = frame.conversationAction === "summarize_session"
    ? mergedTargetIds
    : mergedTargetIds.filter((targetId) => !frame.rejectedTargetIds.includes(targetId))
  const comparisonTargetIds = semanticTask === "compare" ? targetIds : Object.freeze([])
  const componentTargetIds = semanticTask === "explain" && targetIds.length > 1 && presentation.grouping === "separate_each"
    ? targetIds
    : Object.freeze([])
  const summaryScope = Object.freeze({
    known: semanticTask === "summarize",
    unknown: semanticTask === "summarize" && frame.summaryExtras.unknown,
    observationFocus: semanticTask === "summarize" && frame.summaryExtras.observationFocus,
  })
  const observationScope = semanticTask === "observe" || semanticTask === "case_reasoning"
    ? Object.freeze({ singleObservationLimit: true, additionalContext: true })
    : semanticTask === "compare"
      ? frame.observationExtras
      : Object.freeze({ singleObservationLimit: false, additionalContext: false })
  const ambiguity = frame.conversationAction === "return" && referent.kind !== "history"
    ? "history_anchor_missing"
    : semanticTask === "compare" && comparisonTargetIds.length < 2
      ? "comparison_side_missing"
      : !targetIds.length && semanticTask !== "treatment_boundary"
        ? "target_missing"
        : "none"
  return Object.freeze({
    version: DNA_STUDENT_FIRST_REQUEST_VERSION,
    turnId,
    semanticTask,
    requestedSemanticTasks,
    conversationAction: frame.conversationAction,
    targetIds: Object.freeze(targetIds),
    rejectedTargetIds: frame.rejectedTargetIds,
    comparisonTargetIds: Object.freeze(comparisonTargetIds),
    componentTargetIds,
    referent,
    presentation,
    summaryScope,
    observationScope,
    obligations: compileStudentAnswerObligations(turnId, {
      ...frame,
      semanticTask,
      requestedSemanticTasks,
      targetIds,
      comparisonTargetIds,
      componentTargetIds,
      summaryScope,
      observationScope,
      presentation,
    }),
    ambiguity,
    safetyIntent: semanticTask === "treatment_boundary"
      ? "treatment_selection"
      : semanticTask === "observe" || semanticTask === "case_reasoning"
        ? "case_interpretation"
        : "general_education",
  })
}

export function studentSemanticFrameSchema(state: StudentConversationState): Record<string, unknown> {
  const historyIds = state.semanticHistory.map((turn) => turn.turnId)
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "semanticActs", "conversationAction", "mentionedTargetIds", "rejectedTargetIds",
      "referentTurnId", "referentRole", "presentation",
      "summaryExtras", "observationExtras",
    ],
    properties: {
      semanticActs: {
        type: "object",
        additionalProperties: false,
        required: [...DNA_STUDENT_SEMANTIC_TASKS],
        properties: Object.fromEntries(DNA_STUDENT_SEMANTIC_TASKS.map((task) => [task, { type: "boolean" }])),
      },
      conversationAction: { type: "string", enum: [...DNA_STUDENT_CONVERSATION_ACTIONS] },
      mentionedTargetIds: { type: "array", minItems: 0, maxItems: 8, items: { type: "string", enum: [...TARGET_IDS] } },
      rejectedTargetIds: { type: "array", minItems: 0, maxItems: 8, items: { type: "string", enum: [...TARGET_IDS] } },
      referentTurnId: historyIds.length
        ? { anyOf: [{ type: "string", enum: historyIds }, { type: "null" }] }
        : { type: "null" },
      referentRole: { type: "string", enum: ["none", "utterance", "case_entity"] },
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
        requestedSemanticTasks: turn.requestedSemanticTasks,
        conversationAction: turn.conversationAction,
        targetIds: turn.targetIds,
        rejectedTargetIds: turn.rejectedTargetIds,
        comparisonTargetIds: turn.comparisonTargetIds,
        referent: {
          turnId: turn.referent.turnId,
          role: turn.referent.role,
        },
      })),
    },
    allowedTargets: DNA_STUDENT_TARGET_LEXICON,
  })
}

export const DNA_STUDENT_SEMANTIC_INTERPRETER_INSTRUCTIONS = `
Sen yalnız Türkçe bilimsel öğrenci konuşmasını yapılandıran bir yorumlayıcısın. Cevap veya klinik öneri yazma.

Her mesaj için üç bağımsız eksen çıkar:
1. semanticActs: kullanıcının bilimsel olarak istediği işleri birbirinden bağımsız boolean olarak işaretle (define, explain, compare, example, case_reasoning, summarize, observe, evidence, treatment_boundary),
2. conversationAction: konuşmadaki hareket (start, continue, repair, return, summarize_session),
3. presentation: sade dil, uzunluk, biçim, örnek ve aynı anlamı koruyarak yeniden anlatma isteği.

Tek bir semantic act seçmeye çalışma. Açıkça istenen her act true, istenmeyenler false olsun. “Ne demek / nedir / neyi ifade eder” define=true; aynı mesaj genel açıklama da gerektiriyorsa explain de true olabilir. Yerel resolver primary taskı seçecek. Sunum isteği semantic acts yerine geçmez. Örneğin “ne demek, öğrenci gibi anlat” define=true ve language=plain_student olur. Yalnız önceki cevabı aynı anlamı koruyarak daha sade/yeniden söyleme isteğinde yeni bilimsel görev yoksa bütün semanticActs false olabilir; bu durumda presentation.preserveMeaning=true ve önceki referans doğru verilmelidir. Türkçe ekleri ve gündelik ifadeleri anlam düzeyinde yorumla; “tek gözlemle”, “bir kere görerek” ve “sadece bunu gördüm” gözlemden sonuç çıkarma sınırını soruyorsa observe=true olur.

Bir örnek üretme veya bir kavramı örnekle gösterme açıkça isteniyorsa semanticActs.example=true kullan. “Bu örnekte”, “önceki örnek” veya “örnekteki çocuk” yalnız mevcut örneğe gönderme yapıyorsa ve yeni örnek istenmiyorsa semanticActs.example=false ve presentation.example=none kullan. presentation.example yalnız istenen örneğin kısa/somut sunum biçimini belirtir; kendi başına örnek isteği değildir.

Yalnız allowedTargets içindeki ID'leri kullan. Yeni hedef uydurma. mentionedTargetIds yalnız mevcut kullanıcı mesajında açıkça adı geçen hedefleri içerir; referans verilen eski turun hedeflerini buraya kopyalama. Açık düzeltmede reddedilen hedefi rejectedTargetIds alanına koy. “Bu/bununla/bu örnekte/ilk anlattığın” gibi ifadeler önceki bir tura işaret ediyorsa o turun ID'sini referentTurnId alanına yaz; referans yoksa null kullan. referentRole=utterance, kullanıcı önceki açıklama/ifade/kavrama dönüyorsa kullanılır. referentRole=case_entity, kullanıcı önceki çocuk, öğrenci, vaka, davranış veya örnek varlığına dönüyorsa kullanılır; bu durumda en son yorum cümlesi yerine varlığın tanıtıldığı örnek turunu seçmeye çalış. Referans yoksa referentRole=none olmalıdır. Referansın active/history türünü, hedeflerini ve bağlı vaka zincirini yerel resolver state'ten türetecek. Oturum özetinde summarize=true ve conversationAction=summarize_session kullan; özet hedeflerini yerel resolver geçmişten türetecek.

Nihai cevap yükümlülüğü seçme; onu yerel derleyici yapar. Yalnız semantik gerçekleri çıkar:
- presentation.grouping yalnız kullanıcı birden fazla hedefin her birinin ayrı ele alınmasını açıkça istiyorsa separate_each olur. “X bunun parçası mı?” bir ilişki sorusudur ve grouping=integrated kalır.
- summaryExtras yalnız summarize görevinde bilinmeyenleri ve gözlem odağını ayrıca isteyip istemediğini gösterir. Bilinenleri özetleme summarize görevinden yerelde otomatik gelir. Başka görevlerde bu alanları false kullan.
- observationExtras yalnız compare gibi başka bir görev içinde tek gözlem sınırı veya ek bağlam ayrıca isteniyorsa kullanılır. observe ve case_reasoning görevlerinin temel gözlem yükümlülükleri yerelde otomatik gelir; bu görevlerde extras false kalabilir.
- presentation.preserveMeaning yalnız önceki hedefi aynı anlamı koruyarak yeniden/sade anlatmayı istiyorsa true olur. Sadece ilk kez sade anlatma isteğinde false olur.
`.trim()

import type {
  StudentAnswerObligationKind,
  StudentCaseContext,
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
import { DNA_STUDENT_TARGET_LEXICON, detectExplicitStudentTargetIds } from "./conversationState"
import { compileStudentAnswerObligations } from "./obligationCompiler"
import { EMPTY_STUDENT_CASE_CONTEXT } from "./caseContext"
import { normalizeDnaChatText } from "../text"

export const DNA_STUDENT_SEMANTIC_INTERPRETER_VERSION = "dna-student-semantic-interpreter@28" as const

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
  "contrast_target_states",
  "state_context_dependency",
  "explain_relation",
  "give_concrete_example",
  "bind_example_to_target",
  "use_shared_scenario",
  "honor_rejected_target",
  "use_history_anchor",
  "preserve_target_while_simplifying",
  "cover_requested_component",
  "state_single_observation_limit",
  "name_additional_context",
  "name_multiple_plausible_explanations",
  "avoid_context_free_judgment",
  "summarize_known",
  "summarize_unknown",
  "summarize_observation_focus",
  "refuse_treatment_selection",
  "offer_safe_assessment_frame",
] as const satisfies readonly StudentAnswerObligationKind[])

export type StudentSemanticFrame = Readonly<{
  semanticActs: StudentSemanticActs
  conversationAction: StudentConversationAction
  focusTargetIds: readonly string[]
  contextTargetIds: readonly string[]
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
  "invalid_focus_targets",
  "invalid_context_targets",
  "target_role_overlap",
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
  if (/\b(?:toparla|ozetle|ozet\w* (?:yap|cikar)|konustuklarimizi|konustugumuzu|konusmayi)\b/.test(normalized)) return "summarize_session"
  if (/\b(?:ilk anlattigin|ilk konu|az onceki konu|geri donelim|donelim|basa donelim)\b/.test(normalized)) return "return"
  const explicitContentRepair = /\b(?:sormuyorum|onu demiyorum|yanlis anladin|kastettigim|(?:kismi|tarafi) birak)\b/.test(normalized)
  if (explicitContentRepair) return "repair"
  const styleOnlyPreserve = Boolean(input.preserveMeaning) || /\b(?:akademik oldu|cok akademik|yeniden soyle|tekrar anlat|daha basit|ogrenci arkadasina anlat)\b/.test(normalized)
  if (styleOnlyPreserve && input.hasHistory) return "continue"
  if (/^(?:hayir|yok)\b/.test(normalized)) return "repair"
  if (!input.hasHistory) return "start"
  return input.providerAction === "start" ? "continue" : input.providerAction
}

export function groundStudentTargetRoles(input: Readonly<{
  message: string
  state: StudentConversationState
  candidate: unknown
}>): unknown {
  if (!input.candidate || typeof input.candidate !== "object" || !input.state.semanticLedger.length) return input.candidate
  const row = input.candidate as Record<string, unknown>
  if (row.conversationAction !== "continue") return input.candidate
  const acts = row.semanticActs && typeof row.semanticActs === "object"
    ? row.semanticActs as Record<string, unknown>
    : null
  const contextBinding = acts?.example === true || acts?.case_reasoning === true || acts?.observe === true
  if (!contextBinding || !Array.isArray(row.focusTargetIds) || !Array.isArray(row.contextTargetIds)) return input.candidate
  if (row.focusTargetIds.some((targetId) => typeof targetId !== "string") || row.contextTargetIds.some((targetId) => typeof targetId !== "string")) {
    return input.candidate
  }
  const explicitlyNamedTargets = new Set(detectExplicitStudentTargetIds(input.message))
  const focusTargetIds = (row.focusTargetIds as string[]).filter((targetId) => explicitlyNamedTargets.has(targetId))
  const demotedContextIds = (row.focusTargetIds as string[]).filter((targetId) => !explicitlyNamedTargets.has(targetId))
  const contextTargetIds = [...new Set([...(row.contextTargetIds as string[]), ...demotedContextIds])]
    .filter((targetId) => !focusTargetIds.includes(targetId))
  return Object.freeze({
    ...row,
    focusTargetIds: Object.freeze(focusTargetIds),
    contextTargetIds: Object.freeze(contextTargetIds),
  })
}

export function groundStudentExplicitTargets(input: Readonly<{
  message: string
  candidate: unknown
}>): unknown {
  if (!input.candidate || typeof input.candidate !== "object") return input.candidate
  const row = input.candidate as Record<string, unknown>
  if (!Array.isArray(row.focusTargetIds) || !Array.isArray(row.contextTargetIds) || !Array.isArray(row.rejectedTargetIds)) {
    return input.candidate
  }
  if (
    row.focusTargetIds.some((targetId) => typeof targetId !== "string")
    || row.contextTargetIds.some((targetId) => typeof targetId !== "string")
    || row.rejectedTargetIds.some((targetId) => typeof targetId !== "string")
  ) return input.candidate
  const rejected = new Set(row.conversationAction === "repair" ? row.rejectedTargetIds as string[] : [])
  const explicitTargets = detectExplicitStudentTargetIds(input.message).filter((targetId) => !rejected.has(targetId))
  const summary = row.conversationAction === "summarize_session"
  if (!explicitTargets.length && !summary) return input.candidate
  const focusTargetIds = summary
    ? [...explicitTargets]
    : [...new Set([...(row.focusTargetIds as string[]), ...explicitTargets])]
  const contextTargetIds = (row.contextTargetIds as string[]).filter((targetId) => !focusTargetIds.includes(targetId))
  return Object.freeze({
    ...row,
    focusTargetIds: Object.freeze(focusTargetIds),
    contextTargetIds: Object.freeze(contextTargetIds),
  })
}

export function groundStudentRequestIntent(input: Readonly<{
  message: string
  state: StudentConversationState
  candidate: unknown
}>): unknown {
  if (!input.candidate || typeof input.candidate !== "object") return input.candidate
  const row = input.candidate as Record<string, unknown>
  if (!row.semanticActs || typeof row.semanticActs !== "object" || !row.presentation || typeof row.presentation !== "object") {
    return input.candidate
  }
  if (!Array.isArray(row.focusTargetIds)) return input.candidate
  const acts = row.semanticActs as Record<string, unknown>
  const presentation = row.presentation as Record<string, unknown>
  if (DNA_STUDENT_SEMANTIC_TASKS.some((task) => typeof acts[task] !== "boolean")) return input.candidate
  const requiredPresentationKeys = ["depth", "language", "format", "example", "exampleScope", "grouping", "requestedSentenceCount", "preserveMeaning"]
  if (requiredPresentationKeys.some((key) => !(key in presentation))) return input.candidate

  const normalized = normalizeDnaChatText(input.message)
  const groupingRequested = /\b(?:ayri ayri|her birini|ucunu ayri|ikisini ayri)\b/.test(normalized)
  const sharedExample = /\b(?:ayni|ortak)\s+(?:ornek|senaryo)\w*\b/.test(normalized)
    || /\btek\s+(?:bir\s+)?(?:ornek|senaryo)\w*(?:\s+(?:icinde|uzerinden))?\b/.test(normalized)
  const exampleRequested = /\b(?:ornek ver|bir ornek ver|ornekle anlat|ornek gibi acikla|ornek uzerinden|ornegiyle bagla)\b/.test(normalized)
    || (/\bayni ornekte\b/.test(normalized) && /\b(?:goster|anlat|acikla|ayir)\b/.test(normalized))
  const concreteExampleContext = /\b(?:cocuk|ogrenci|sinif|ders|ogretmen|oyun|gunluk)\w*\b/.test(normalized)
  const semanticActs = Object.freeze({
    ...acts,
    example: acts.example === true || exampleRequested,
  })
  const groundedPresentation = Object.freeze({
    ...presentation,
    grouping: groupingRequested ? "separate_each" : presentation.grouping,
    exampleScope: sharedExample ? "shared" : presentation.exampleScope,
    example: semanticActs.example === true
      ? concreteExampleContext
        ? "concrete"
        : presentation.example === "none" ? "brief" : presentation.example
      : presentation.example,
  })

  let referentTurnId = typeof row.referentTurnId === "string" ? row.referentTurnId : null
  let referentRole = row.referentRole
  const latest = input.state.semanticHistory.at(-1) ?? null
  if (!referentTurnId && latest) {
    const focusTargetIds = (row.focusTargetIds as unknown[]).filter((targetId): targetId is string => typeof targetId === "string")
    const compatibleWithLatest = !focusTargetIds.length || focusTargetIds.every((targetId) => latest.targetIds.includes(targetId))
    const entityCue = /\b(?:cocuk|cocug|ogrenci|vaka|davranis|ornek)\w*\b/.test(normalized)
    if (row.conversationAction === "return") {
      const firstCue = /\b(?:ilk|basa)\b/.test(normalized)
      const entityAnchor = entityCue
        ? [...input.state.semanticLedger].reverse().find((turn) => turn.semanticTask === "example") ?? null
        : null
      const compatibleHistory = (firstCue ? [...input.state.semanticLedger] : [...input.state.semanticLedger].reverse())
        .find((turn) => !focusTargetIds.length || focusTargetIds.some((targetId) => turn.targetIds.includes(targetId))) ?? null
      const anchor = entityAnchor ?? compatibleHistory
      if (anchor) {
        referentTurnId = anchor.turnId
        referentRole = entityAnchor ? "case_entity" : "utterance"
      }
    } else {
      const contextBinding = semanticActs.example === true || acts.case_reasoning === true || acts.observe === true
      if (row.conversationAction === "continue" && compatibleWithLatest && (contextBinding || presentation.preserveMeaning === true)) {
        referentTurnId = latest.turnId
        referentRole = entityCue && (latest.semanticTask === "example" || latest.referent.role === "case_entity")
          ? "case_entity"
          : "utterance"
      }
    }
  }

  return Object.freeze({
    ...row,
    semanticActs,
    presentation: groundedPresentation,
    referentTurnId,
    referentRole: referentTurnId ? referentRole : "none",
  })
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
  "case_reasoning",
  "observe",
  "evidence",
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
      ? state.semanticLedger.find((turn) => turn.turnId === frame.referentTurnId) ?? null
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
    return state.semanticLedger.find((turn) => turn.turnId === frame.referentTurnId)?.semanticTask ?? selected
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
  if (!["independent", "shared"].includes(String(row.exampleScope))) return null
  if (!["integrated", "separate_each"].includes(String(row.grouping))) return null
  if (row.requestedSentenceCount !== null && (!Number.isInteger(row.requestedSentenceCount) || Number(row.requestedSentenceCount) < 1 || Number(row.requestedSentenceCount) > 6)) return null
  if (typeof row.preserveMeaning !== "boolean") return null
  return Object.freeze({
    depth: row.depth as StudentPresentationRequest["depth"],
    language: row.language as StudentPresentationRequest["language"],
    format: row.format as StudentPresentationRequest["format"],
    example: row.example as StudentPresentationRequest["example"],
    exampleScope: row.exampleScope as StudentPresentationRequest["exampleScope"],
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
  for (const key of ["multiplePlausibleExplanations", "contextualJudgment", "withinTargetStateContrast"] as const) {
    if (row[key] !== undefined && typeof row[key] !== "boolean") return null
  }
  return Object.freeze({
    singleObservationLimit: row.singleObservationLimit,
    additionalContext: row.additionalContext,
    ...(row.multiplePlausibleExplanations === true ? { multiplePlausibleExplanations: true as const } : {}),
    ...(row.contextualJudgment === true ? { contextualJudgment: true as const } : {}),
    ...(row.withinTargetStateContrast === true ? { withinTargetStateContrast: true as const } : {}),
  })
}

function parseReferentTurnId(value: unknown, state: StudentConversationState): Readonly<{ ok: true; turnId: string | null }> | null {
  const turnId = value === null ? null : typeof value === "string" ? value : null
  if (value !== null && turnId === null) return null
  const historyIds = new Set(state.semanticLedger.map((turn) => turn.turnId))
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
  const focusTargetIds = uniqueStrings(row.focusTargetIds, TARGET_ID_SET, 8)
  if (!focusTargetIds) return frameFailure("invalid_focus_targets")
  const contextTargetIds = uniqueStrings(row.contextTargetIds, TARGET_ID_SET, 8)
  if (!contextTargetIds) return frameFailure("invalid_context_targets")
  if (focusTargetIds.some((targetId) => contextTargetIds.includes(targetId))) return frameFailure("target_role_overlap")
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
    state.semanticLedger.length > 0 &&
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
  if (row.conversationAction === "start" && state.semanticLedger.length) return frameFailure("conversation_state_mismatch")
  if (row.conversationAction !== "start" && !state.semanticLedger.length) return frameFailure("conversation_state_mismatch")
  if (row.conversationAction === "return" && referent.turnId === null) return frameFailure("return_referent_mismatch")
  if (row.conversationAction === "summarize_session" && semanticTask !== "summarize") return frameFailure("summary_task_mismatch")

  return Object.freeze({
    ok: true,
    frame: Object.freeze({
      semanticActs,
      conversationAction: row.conversationAction as StudentConversationAction,
      focusTargetIds: Object.freeze(focusTargetIds),
      contextTargetIds: Object.freeze(contextTargetIds),
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
    const snapshot = state.semanticLedger.find((turn) => turn.turnId === currentTurnId)
    if (!snapshot || snapshot.semanticTask === "example") return currentTurnId
    const parent = snapshot.referent
    if (parent.role !== "case_entity" || parent.turnId === null) return currentTurnId
    if (!state.semanticLedger.some((turn) => turn.turnId === parent.turnId)) return currentTurnId
    currentTurnId = parent.turnId
  }
  return currentTurnId
}

export function compileStudentRequestContract(
  turnId: string,
  frame: StudentSemanticFrame,
  state: StudentConversationState,
  caseContext: StudentCaseContext = EMPTY_STUDENT_CASE_CONTEXT,
): StudentRequestContract {
  const semanticTask = resolveStudentSemanticTask(frame, state)
  const requestedSemanticTasks = Object.freeze(DNA_STUDENT_SEMANTIC_TASKS.filter((task) => frame.semanticActs[task]))
  const presentation: StudentPresentationRequest = Object.freeze({
    ...frame.presentation,
    example: requestedSemanticTasks.includes("example")
      ? frame.presentation.example === "none" ? "brief" : frame.presentation.example
      : "none",
    exampleScope: requestedSemanticTasks.includes("example") ? frame.presentation.exampleScope : "independent",
  })
  const unique = (values: readonly string[]) => [...new Set(values)]
  const currentRejectedTargetIds = Object.freeze(frame.conversationAction === "repair" ? [...frame.rejectedTargetIds] : [])
  const allowedFocusTargets = frame.focusTargetIds.filter((targetId) => !currentRejectedTargetIds.includes(targetId))
  const contextTargetIds = Object.freeze(frame.contextTargetIds.filter((targetId) =>
    !currentRejectedTargetIds.includes(targetId) && !allowedFocusTargets.includes(targetId)))
  const latestTurnId = state.semanticHistory.at(-1)?.turnId ?? null
  const latestSnapshot = state.semanticHistory.at(-1) ?? null
  const latestTargetIds = latestSnapshot?.targetIds ?? []
  const contextBindingTask = semanticTask === "example" || semanticTask === "case_reasoning" || semanticTask === "observe"
  const latestTargetsOverlap = allowedFocusTargets.some((targetId) => latestTargetIds.includes(targetId))
  const contextTargetsCompatible = Boolean(latestSnapshot) && (
    !allowedFocusTargets.length || allowedFocusTargets.every((targetId) => latestTargetIds.includes(targetId))
  )
  const compareContextCompatible = Boolean(latestSnapshot) && semanticTask === "compare" && (
    allowedFocusTargets.length < 2 || latestTargetsOverlap
  )
  const explanationContinuationCompatible = Boolean(latestSnapshot)
    && frame.conversationAction === "continue"
    && semanticTask === "explain"
    && allowedFocusTargets.length > 0
    && allowedFocusTargets.every((targetId) => latestTargetIds.includes(targetId))
  const effectiveReferentTurnId = frame.referentTurnId ?? (
    latestTurnId && (
      compareContextCompatible
      || explanationContinuationCompatible
      || (contextTargetsCompatible && (contextBindingTask || presentation.preserveMeaning))
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
    ? state.semanticLedger.find((turn) => turn.turnId === resolvedReferentTurnId) ?? null
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
  const referentCaseContext = referentSnapshot?.caseContext.eventIds.length
    ? referentSnapshot.caseContext
    : null
  const mergedTargetIds = frame.conversationAction === "summarize_session"
    ? allowedFocusTargets.length
      ? unique(allowedFocusTargets)
      : unique(state.semanticLedger.flatMap((turn) => turn.targetIds))
    : frame.conversationAction === "return"
        ? allowedFocusTargets.length
          ? unique(allowedFocusTargets)
          : unique(referent.targetIds)
      : semanticTask === "compare"
        ? allowedFocusTargets.length >= 2
          ? unique(allowedFocusTargets)
          : unique([...referent.targetIds, ...allowedFocusTargets])
        : allowedFocusTargets.length
          ? unique(allowedFocusTargets)
          : referent.targetIds.length
            ? unique(referent.targetIds)
            : unique(state.activeTargetIds)
  const targetIds = frame.conversationAction === "summarize_session"
    ? mergedTargetIds
    : mergedTargetIds.filter((targetId) => !currentRejectedTargetIds.includes(targetId))
  const comparisonTargetIds = semanticTask === "compare" ? targetIds : Object.freeze([])
  const componentTargetIds = semanticTask === "explain" && targetIds.length > 1 && presentation.grouping === "separate_each"
    ? targetIds
    : Object.freeze([])
  const historyAnchorRequired = frame.conversationAction === "return"
    || (referent.turnId !== null && componentTargetIds.length > 1)
  const summaryScope = Object.freeze({
    known: semanticTask === "summarize",
    unknown: semanticTask === "summarize" && frame.summaryExtras.unknown,
    observationFocus: semanticTask === "summarize" && frame.summaryExtras.observationFocus,
  })
  const observationScope: StudentObservationScope = semanticTask === "observe" || semanticTask === "case_reasoning"
    ? Object.freeze({
        ...frame.observationExtras,
        singleObservationLimit: true,
        additionalContext: true,
      })
    : semanticTask === "compare"
      || ((semanticTask === "define" || semanticTask === "explain")
        && frame.observationExtras.singleObservationLimit)
      ? frame.observationExtras
      : Object.freeze({ singleObservationLimit: false, additionalContext: false })
  const ambiguity = frame.conversationAction === "return" && referent.kind !== "history"
    ? "history_anchor_missing"
    : semanticTask === "compare" && comparisonTargetIds.length < 2 && !observationScope.withinTargetStateContrast
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
    contextTargetIds,
    rejectedTargetIds: currentRejectedTargetIds,
    comparisonTargetIds: Object.freeze(comparisonTargetIds),
    componentTargetIds,
    referent,
    caseContext,
    referentCaseContext,
    presentation,
    summaryScope,
    observationScope,
    obligations: compileStudentAnswerObligations(turnId, {
      ...frame,
      semanticTask,
      requestedSemanticTasks,
      targetIds,
      rejectedTargetIds: currentRejectedTargetIds,
      comparisonTargetIds,
      componentTargetIds,
      historyAnchorRequired,
      summaryScope,
      observationScope,
      presentation,
    }),
    ambiguity,
    safetyIntent: semanticTask === "treatment_boundary"
      ? "treatment_selection"
      : semanticTask === "observe" || semanticTask === "case_reasoning"
        || (semanticTask === "compare" && (
          requestedSemanticTasks.includes("observe") || requestedSemanticTasks.includes("case_reasoning")
          || observationScope.singleObservationLimit
        ))
        ? "case_interpretation"
        : "general_education",
  })
}

export function studentSemanticFrameSchema(state: StudentConversationState): Record<string, unknown> {
  const historyIds = state.semanticLedger.map((turn) => turn.turnId)
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "semanticActs", "conversationAction", "focusTargetIds", "contextTargetIds", "rejectedTargetIds",
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
      focusTargetIds: { type: "array", minItems: 0, maxItems: 8, items: { type: "string", enum: [...TARGET_IDS] } },
      contextTargetIds: { type: "array", minItems: 0, maxItems: 8, items: { type: "string", enum: [...TARGET_IDS] } },
      rejectedTargetIds: { type: "array", minItems: 0, maxItems: 8, items: { type: "string", enum: [...TARGET_IDS] } },
      referentTurnId: historyIds.length
        ? { anyOf: [{ type: "string", enum: historyIds }, { type: "null" }] }
        : { type: "null" },
      referentRole: { type: "string", enum: ["none", "utterance", "case_entity"] },
      presentation: {
        type: "object",
        additionalProperties: false,
        required: ["depth", "language", "format", "example", "exampleScope", "grouping", "requestedSentenceCount", "preserveMeaning"],
        properties: {
          depth: { type: "string", enum: ["brief", "standard", "deep"] },
          language: { type: "string", enum: ["plain_student", "standard"] },
          format: { type: "string", enum: ["prose", "bullets", "table"] },
          example: { type: "string", enum: ["none", "brief", "concrete"] },
          exampleScope: { type: "string", enum: ["independent", "shared"] },
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
          multiplePlausibleExplanations: { type: "boolean" },
          contextualJudgment: { type: "boolean" },
          withinTargetStateContrast: { type: "boolean" },
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
        contextTargetIds: turn.contextTargetIds,
        rejectedTargetIds: turn.rejectedTargetIds,
        comparisonTargetIds: turn.comparisonTargetIds,
        referent: {
          turnId: turn.referent.turnId,
          role: turn.referent.role,
        },
        caseContext: turn.caseContext,
      })),
      semanticLedger: input.state.semanticLedger.map((turn) => ({
        turnId: turn.turnId,
        semanticTask: turn.semanticTask,
        conversationAction: turn.conversationAction,
        targetIds: turn.targetIds,
        rejectedTargetIds: turn.rejectedTargetIds,
        referent: {
          turnId: turn.referent.turnId,
          role: turn.referent.role,
        },
        caseContext: turn.caseContext,
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
3. presentation: sade dil, uzunluk, biçim, örnek, örneğin ortak senaryo kapsamı ve aynı anlamı koruyarak yeniden anlatma isteği.

Tek bir semantic act seçmeye çalışma. Açıkça istenen her act true, istenmeyenler false olsun. “Ne demek / nedir / neyi ifade eder” define=true; aynı mesaj genel açıklama da gerektiriyorsa explain de true olabilir. Yerel resolver primary taskı seçecek. Sunum isteği semantic acts yerine geçmez. Örneğin “ne demek, öğrenci gibi anlat” define=true ve language=plain_student olur. Yalnız önceki cevabı aynı anlamı koruyarak daha sade/yeniden söyleme isteğinde yeni bilimsel görev yoksa bütün semanticActs false olabilir; bu durumda presentation.preserveMeaning=true ve önceki referans doğru verilmelidir. Türkçe ekleri ve gündelik ifadeleri anlam düzeyinde yorumla; “tek gözlemle”, “bir kere görerek” ve “sadece bunu gördüm” gözlemden sonuç çıkarma sınırını soruyorsa observe=true olur.

Bir örnek üretme veya bir kavramı örnekle gösterme açıkça isteniyorsa semanticActs.example=true kullan. “Bu örnekte”, “önceki örnek” veya “örnekteki çocuk” yalnız mevcut örneğe gönderme yapıyorsa ve yeni örnek istenmiyorsa semanticActs.example=false ve presentation.example=none kullan. presentation.example yalnız istenen örneğin kısa/somut sunum biçimini belirtir; kendi başına örnek isteği değildir.
Kullanıcı “aynı örnekte”, “tek bir örnek içinde” veya “ortak bir senaryoda” birden fazla hedefi göstermeyi istiyorsa presentation.exampleScope=shared kullan. Bunun dışındaki örnek isteklerinde independent kullan.

Yalnız allowedTargets içindeki ID'leri kullan. Yeni hedef uydurma. focusTargetIds yalnız mevcut isteğin cevapta doğrudan ele alınmasını istediği bilimsel kavramları içerir. Bir vaka veya örnek cümlesinde geçen fakat hakkında ayrıca açıklama/karşılaştırma istenmeyen davranış-kavram eşleşmelerini contextTargetIds alanına koy; bunlar cevap hedefi değildir. Örneğin eş düzenlemeyi örneklerken “çocuk göreve dönüyor” denmesi recovery kavramını otomatik olarak focus yapmaz. Referans verilen eski turun hedeflerini iki alana da kopyalama. Aynı ID iki rolde birden bulunamaz. rejectedTargetIds yalnız mevcut kullanıcı mesajında açıkça reddedilen hedefleri içerir ve yalnız conversationAction=repair iken dolu olabilir; state'teki eski reddedilmiş hedefleri özet, devam veya dönüş turuna kopyalama. “Bu/bununla/bu örnekte/ilk anlattığın” gibi ifadeler önceki bir tura işaret ediyorsa o turun ID'sini referentTurnId alanına yaz; referans yoksa null kullan. referentRole=utterance, kullanıcı önceki açıklama/ifade/kavrama dönüyorsa kullanılır. referentRole=case_entity, kullanıcı önceki çocuk, öğrenci, vaka, davranış veya örnek varlığına dönüyorsa kullanılır; bu durumda en son yorum cümlesi yerine varlığın tanıtıldığı örnek turunu seçmeye çalış. Referans yoksa referentRole=none olmalıdır. Referansın active/history türünü, hedeflerini ve bağlı vaka zincirini yerel resolver state'ten türetecek. Oturum özetinde summarize=true ve conversationAction=summarize_session kullan; özet hedeflerini yerel resolver geçmişten türetecek.

Nihai cevap yükümlülüğü seçme; onu yerel derleyici yapar. Yalnız semantik gerçekleri çıkar:
- presentation.grouping yalnız kullanıcı birden fazla hedefin her birinin ayrı ele alınmasını açıkça istiyorsa separate_each olur. “X bunun parçası mı?” bir ilişki sorusudur ve grouping=integrated kalır.
- summaryExtras yalnız summarize görevinde bilinmeyenleri ve gözlem odağını ayrıca isteyip istemediğini gösterir. Bilinenleri özetleme summarize görevinden yerelde otomatik gelir. Başka görevlerde bu alanları false kullan.
- observationExtras yalnız compare gibi başka bir görev içinde tek gözlem sınırı veya ek bağlam ayrıca isteniyorsa kullanılır. observe ve case_reasoning görevlerinin temel gözlem yükümlülükleri yerelde otomatik gelir; bu görevlerde extras false kalabilir.
- presentation.preserveMeaning yalnız önceki hedefi aynı anlamı koruyarak yeniden/sade anlatmayı istiyorsa true olur. Sadece ilk kez sade anlatma isteğinde false olur.
`.trim()

import { normalizeDnaChatText } from "../text"
import type {
  StudentConversationAction,
  StudentCaseContext,
  StudentObservationScope,
  StudentConversationState,
  StudentPresentationRequest,
  StudentReferent,
  StudentRequestContract,
  StudentSemanticTask,
  StudentSummaryScope,
} from "./contracts"
import { DNA_STUDENT_TARGET_LEXICON } from "./conversationState"
import { observeStudentCaseContext } from "./caseContext"
import {
  compileStudentRequestContract,
  type StudentSemanticFrame,
} from "./semanticInterpreter"

export const DNA_STUDENT_EVIDENCE_FIRST_VERSION = "dna-student-evidence-first@4" as const

export type StudentObservedTargetFact = Readonly<{
  targetId: string
  evidenceKind: "explicit_alias" | "explicit_stem" | "context_alias"
  normalizedStart: number
  normalizedEnd: number
}>

export type StudentReferenceCues = Readonly<{
  active: boolean
  historyReturn: boolean
  firstHistory: boolean
  caseEntity: boolean
  fragmentaryCase: boolean
}>

export type StudentObservedSafetyIntent =
  | "general_education"
  | "case_interpretation"
  | "diagnosis_request"
  | "treatment_selection"

export type StudentObservedRequestFacts = Readonly<{
  version: typeof DNA_STUDENT_EVIDENCE_FIRST_VERSION
  turnId: string
  explicitTargetFacts: readonly StudentObservedTargetFact[]
  explicitTargetIds: readonly string[]
  contextTargetFacts: readonly StudentObservedTargetFact[]
  contextTargetIds: readonly string[]
  rejectedTargetIds: readonly string[]
  semanticTaskCandidates: readonly StudentSemanticTask[]
  conversationAction: StudentConversationAction
  presentation: StudentPresentationRequest
  summaryExtras: Readonly<Pick<StudentSummaryScope, "unknown" | "observationFocus">>
  observationExtras: StudentObservationScope
  referenceCues: StudentReferenceCues
  safetyIntent: StudentObservedSafetyIntent
  caseContext: StudentCaseContext
}>

export type StudentTargetCandidateSource =
  | "explicit_current_message"
  | "context_current_message"
  | "active_state"
  | "semantic_history"

export type StudentTargetCandidate = Readonly<{
  targetId: string
  sources: readonly StudentTargetCandidateSource[]
  focusEligible: boolean
  eligibilityReason:
    | "explicit_current_message"
    | "target_free_summary_history"
    | "target_free_return_history"
    | "single_active_treatment_context"
    | "active_continuation"
    | "context_only"
    | "history_only"
}>

export type StudentReferentCandidate = Readonly<{
  turnId: string
  role: Exclude<StudentReferent["role"], "none">
  targetIds: readonly string[]
  source: "latest_utterance" | "history_return" | "case_entity_origin"
  eligibilityReason: string
}>

export type StudentStateCandidateEnvelope = Readonly<{
  version: typeof DNA_STUDENT_EVIDENCE_FIRST_VERSION
  turnId: string
  targetCandidates: readonly StudentTargetCandidate[]
  allowedFocusTargetIds: readonly string[]
  referentCandidates: readonly StudentReferentCandidate[]
  allowedReferentTurnIds: readonly string[]
  taskCandidates: readonly StudentSemanticTask[]
  conversationAction: StudentConversationAction
  safetyIntent: StudentObservedSafetyIntent
}>

export const DNA_STUDENT_CLOSED_SLOT_FAILURE_CODES = Object.freeze([
  "invalid_object",
  "invalid_primary_task",
  "invalid_focus_targets",
  "focus_target_set_mismatch",
  "invalid_referent",
  "referent_choice_required",
] as const)

export type StudentClosedSlotFailureCode = typeof DNA_STUDENT_CLOSED_SLOT_FAILURE_CODES[number]

export type StudentClosedSlotChoice = Readonly<{
  primaryTask: StudentSemanticTask
  focusTargetIds: readonly string[]
  referentTurnId: string | null
}>

export type StudentClosedSlotValidationResult =
  | Readonly<{ ok: true; choice: StudentClosedSlotChoice }>
  | Readonly<{ ok: false; failureCode: StudentClosedSlotFailureCode }>

export type StudentEvidenceFirstResolutionResult =
  | Readonly<{
      ok: true
      facts: StudentObservedRequestFacts
      envelope: StudentStateCandidateEnvelope
      choice: StudentClosedSlotChoice
      contract: StudentRequestContract
    }>
  | Readonly<{
      ok: false
      reason: "closed_slot_failure"
      failureCode: StudentClosedSlotFailureCode
      facts: StudentObservedRequestFacts
      envelope: StudentStateCandidateEnvelope
    }>
  | Readonly<{
      ok: false
      reason: "diagnosis_contract_pending"
      facts: StudentObservedRequestFacts
      envelope: StudentStateCandidateEnvelope
    }>

const INFLECTION_SUFFIX = "(?:sinden|sinde|sini|sina|sine|si|su|yi|ya|ye|ni|na|ne|nu|i|u|a|e|de|da|den|dan|in|un|nin|nun|la|le|yla|yle)?"
const AMBIGUOUS_SINGLE_TOKEN_TARGETS = new Set(["attention"])
const CONTEXT_STEMS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  recovery: Object.freeze(["goreve don", "oyuna don"]),
  working_memory: Object.freeze(["aklinda tut"]),
})

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)]
}

function escaped(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function aliasMatch(
  normalizedMessage: string,
  normalizedAlias: string,
  allowInflection: boolean,
): Readonly<{ start: number; end: number }> | null {
  const suffix = allowInflection ? INFLECTION_SUFFIX : ""
  const match = new RegExp(`(?:^| )(${escaped(normalizedAlias)}${suffix})(?= |$)`, "u").exec(normalizedMessage)
  if (!match || match.index === undefined) return null
  const leadingSpace = match[0].startsWith(" ") ? 1 : 0
  const start = match.index + leadingSpace
  return Object.freeze({ start, end: start + match[1]!.length })
}

function targetFacts(message: string): Readonly<{
  explicit: readonly StudentObservedTargetFact[]
  context: readonly StudentObservedTargetFact[]
}> {
  const normalized = normalizeDnaChatText(message)
    .replace(/\b(?:ko regulasyon|coregulasyon)(?=[a-z]*\b)/g, "es regulasyon")
  const explicit: StudentObservedTargetFact[] = []
  const context: StudentObservedTargetFact[] = []
  for (const entry of DNA_STUDENT_TARGET_LEXICON) {
    const contextAliases = new Set((entry.contextAliases ?? []).map((alias) => normalizeDnaChatText(alias)))
    for (const alias of entry.aliases) {
      const normalizedAlias = normalizeDnaChatText(alias)
      const isContext = contextAliases.has(normalizedAlias)
      const allowInflection = !AMBIGUOUS_SINGLE_TOKEN_TARGETS.has(entry.id)
      const softenedAlias = allowInflection && normalizedAlias.endsWith("k")
        ? `${normalizedAlias.slice(0, -1)}g`
        : null
      const infinitiveAlias = allowInflection && /(?:ma|me)$/u.test(normalizedAlias)
        ? `${normalizedAlias}k`
        : null
      const attentionCaseMatch = entry.id === "attention" && normalizedAlias === "dikkat"
        ? /(?:^| )(dikkati|dikkate|dikkatten|dikkatle)(?= |$)/u.exec(normalized)
        : null
      const attentionCaseStart = attentionCaseMatch?.index === undefined
        ? null
        : attentionCaseMatch.index + (attentionCaseMatch[0].startsWith(" ") ? 1 : 0)
      const match = aliasMatch(normalized, normalizedAlias, allowInflection) ??
        (softenedAlias ? aliasMatch(normalized, softenedAlias, true) : null) ??
        (infinitiveAlias ? aliasMatch(normalized, infinitiveAlias, false) : null) ??
        (attentionCaseMatch && attentionCaseStart !== null
          ? Object.freeze({ start: attentionCaseStart, end: attentionCaseStart + attentionCaseMatch[1]!.length })
          : null)
      if (!match) continue
      if (entry.id === "attention" && normalizedAlias === "dikkat" && /^ (?:et|cek)\w*\b/.test(normalized.slice(match.end))) continue
      if (entry.id === "attention" && match && normalized.slice(match.start, match.end) === "dikkatle"
        && !/\b(?:fark\w*|ayir\w*|karsilastir\w*)\b/u.test(normalized)) continue
      const fact = Object.freeze({
        targetId: entry.id,
        evidenceKind: isContext ? "context_alias" : "explicit_alias",
        normalizedStart: match.start,
        normalizedEnd: match.end,
      } satisfies StudentObservedTargetFact)
      if (isContext) context.push(fact)
      else explicit.push(fact)
    }
    for (const stem of entry.explicitStems ?? []) {
      const normalizedStem = escaped(normalizeDnaChatText(stem))
      const match = new RegExp(`(?:^| )(${normalizedStem}[a-z0-9_]*)(?= |$)`, "u").exec(normalized)
      if (!match || match.index === undefined) continue
      const leadingSpace = match[0].startsWith(" ") ? 1 : 0
      const start = match.index + leadingSpace
      explicit.push(Object.freeze({
        targetId: entry.id,
        evidenceKind: "explicit_stem",
        normalizedStart: start,
        normalizedEnd: start + match[1]!.length,
      }))
    }
    for (const stem of CONTEXT_STEMS[entry.id] ?? []) {
      const normalizedStem = escaped(normalizeDnaChatText(stem))
      const match = new RegExp(`(?:^| )(${normalizedStem}[a-z0-9_]*)(?= |$)`, "u").exec(normalized)
      if (!match || match.index === undefined) continue
      const leadingSpace = match[0].startsWith(" ") ? 1 : 0
      const start = match.index + leadingSpace
      context.push(Object.freeze({
        targetId: entry.id,
        evidenceKind: "context_alias",
        normalizedStart: start,
        normalizedEnd: start + match[1]!.length,
      }))
    }
  }
  const sortFacts = (rows: StudentObservedTargetFact[]) => rows.sort((left, right) =>
    left.normalizedStart - right.normalizedStart ||
    right.normalizedEnd - right.normalizedStart - (left.normalizedEnd - left.normalizedStart))
  return Object.freeze({
    explicit: Object.freeze(sortFacts(explicit)),
    context: Object.freeze(sortFacts(context)),
  })
}

function rejectedTargets(
  message: string,
  explicitTargetIds: readonly string[],
  state: StudentConversationState,
): readonly string[] {
  const normalized = normalizeDnaChatText(message)
  const rejected = explicitTargetIds.filter((targetId) => {
    const entry = DNA_STUDENT_TARGET_LEXICON.find((target) => target.id === targetId)
    return entry?.aliases.some((alias) => {
      const label = normalizeDnaChatText(alias)
      return normalized.includes(`${label} degil`) ||
        normalized.includes(`${label} kismini sormuyorum`) ||
        normalized.includes(`${label} tarafini sormuyorum`) ||
        normalized.includes(`${label} sormuyorum`) ||
        normalized.includes(`${label}yi degil`) ||
        normalized.includes(`${label}i degil`)
    }) === true
  })
  if (/\bduyusal (?:kismi|tarafi)\w* (?:birak|sormuyorum)\b/.test(normalized)) {
    for (const targetId of state.activeTargetIds) {
      if (["sensory_regulation", "sensory_modulation"].includes(targetId)) rejected.push(targetId)
    }
  }
  return Object.freeze(unique(rejected))
}

function normalizedStudentWords(message: string): readonly string[] {
  return Object.freeze(normalizeDnaChatText(message).split(/[^a-z0-9_]+/u).filter(Boolean))
}

function startsWithAny(word: string, stems: readonly string[]) {
  return stems.some((stem) => word === stem || word.startsWith(stem))
}

function studentExampleSignals(message: string) {
  const words = normalizedStudentWords(message)
  const exampleIndexes = words.flatMap((word, index) => startsWithAny(word, ["ornek", "orne", "senaryo"]) ? [index] : [])
  const requested = exampleIndexes.length > 0 && words.some((word) =>
    startsWithAny(word, ["anlat", "acikla", "goster", "ver", "bagla", "ayir"]))
  const shared = requested && exampleIndexes.some((index) =>
    words.slice(Math.max(0, index - 4), index + 1).some((word) => ["ayni", "ortak", "tek"].includes(word)))
  const concrete = requested && words.some((word) =>
    startsWithAny(word, ["cocuk", "ogrenci", "sinif", "ders", "ogretmen", "oyun", "gunluk"]))
  return Object.freeze({ requested, shared, concrete })
}

function semanticTaskCandidates(message: string, explicitTargetCount: number): readonly StudentSemanticTask[] {
  const normalized = normalizeDnaChatText(message)
  const words = normalizedStudentWords(message)
  const exampleSignals = studentExampleSignals(message)
  const tasks: StudentSemanticTask[] = []
  const add = (task: StudentSemanticTask, matched: boolean) => {
    if (matched && !tasks.includes(task)) tasks.push(task)
  }
  add("treatment_boundary", /\b(?:hangi tedaviyi|hangi tedavi|hangi terapiyi|hangi terapi|ne uygulayayim|seans plani|tedavi plani|terapiyi sec|tedaviyi sec)\b/.test(normalized))
  add("summarize", /\b(?:toparla|ozetle|ozet yap|ozeti yap|ogrenci ozeti|ozet cikar|konustuklarimizi|konustugumuzu|konusmayi)\b/.test(normalized))
  add("evidence", words.some((word) => startsWithAny(word, ["kanit", "kaynak", "calismalar"]))
    || /\bne kadar guvenilir\b/.test(normalized))
  add("observe", /\b(?:tek (?:bir )?gozlem\w*|gozlemde|neye bak|nasil gozlemler|baska neye)\b/.test(normalized))
  add("compare", /\b(?:ayni mi|ayni sey mi|farki\w*|ayir\w*|karsilastir\w*|hangisi|hangisine girer|ikisini de)\b/.test(normalized) ||
    (explicitTargetCount === 1 && /\b(?:dusuk|az)\b.{0,40}\b(?:yuksek|cok)\b/u.test(normalized)) ||
    (explicitTargetCount > 1 && /\bmi\b/.test(normalized)) ||
    (explicitTargetCount === 2 && /\bayni ornekte\b/.test(normalized)))
  add("example", exampleSignals.requested)
  const caseQuestion = /\b(?:diyebilir miyim|diyebilir miyiz|ne olabilir|ne dusun\w*|nasil dusun\w*|kesin soyle|zayif diyebilir|ilgili mi|iyi mi kotu mu|bu ne simdi|hangisi)\b/.test(normalized)
    || (/\bne demek\b/.test(normalized) && /\bgorevi birak\w*\b/.test(normalized))
  const caseScene = /\b(?:cocu(?:k|g)\w*|ogrenci\w*|vaka\w*|davranis\w*|sadece bu|gorevi birak\w*|sinirlen\w*|ses\w* yuksel\w*)\b/.test(normalized)
  add("case_reasoning", caseQuestion && (
    caseScene
    || /\biyi mi kotu mu\b/.test(normalized)
    || (explicitTargetCount > 0 && tasks.includes("observe"))
  ))
  add("define", /\b(?:ne demek|nedir|neydi|tam olarak ne|neyi kastediyoruz|neyi ifade eder)\b/.test(normalized))
  add("explain", /\b(?:anlat|acikla|nasil dusun\w*|nasil yer al\w*|ne anlama gelir|baglama gore|bunun icinde mi)\b/.test(normalized))
  if (!tasks.length) tasks.push("explain")
  return Object.freeze(tasks)
}

function conversationAction(message: string, hasHistory: boolean): StudentConversationAction {
  const normalized = normalizeDnaChatText(message)
  if (/\b(?:toparla|ozetle|ozet yap|ozeti yap|ogrenci ozeti|ozet cikar|konustuklarimizi|konustugumuzu|konusmayi)\b/.test(normalized)) return "summarize_session"
  if (/\b(?:ilk anlattigin|ilk konu|az onceki konu|az onceki cocuk|geri donelim|donelim|basa donelim)\b/.test(normalized)) return "return"
  if (/^(?:hayir|yok)\b|\b(?:sormuyorum|onu demiyorum|yanlis anladin|kastettigim|(?:kismi|tarafi) birak)\b/.test(normalized)) return "repair"
  return hasHistory ? "continue" : "start"
}

function presentation(message: string): StudentPresentationRequest {
  const normalized = normalizeDnaChatText(message)
  const exampleSignals = studentExampleSignals(message)
  const countMatch = normalized.match(/\b(iki|uc|dort|[2-4]) cumle\w*\b/)
  const requestedSentenceCount = countMatch
    ? ({ iki: 2, uc: 3, dort: 4 } as Record<string, number>)[countMatch[1]!] ?? Number(countMatch[1])
    : null
  const exampleRequested = exampleSignals.requested
  const concreteExample = exampleSignals.concrete
  const sharedExample = exampleSignals.shared
  return Object.freeze({
    depth: /\b(?:kisa|kisaca|minicik|ozet|[2-4] cumle\w*|iki cumle\w*|uc cumle\w*|dort cumle\w*)\b/.test(normalized)
      ? "brief"
      : /\b(?:ayrintili|detayli|derin|biraz ac|daha ac)\b/.test(normalized) ? "deep" : "standard",
    language: /\b(?:sade|basit|ogrenci|akademik olma|akademik olmadan|akademik oldu|gunluk dil|duz anlat)\b/.test(normalized)
      ? "plain_student"
      : "standard",
    format: /\btablo\b/.test(normalized) && !/\btablo yapma\b/.test(normalized)
      ? "table"
      : /\b(?:madde madde|maddelerle)\b/.test(normalized) ? "bullets" : "prose",
    example: exampleRequested ? concreteExample ? "concrete" : "brief" : "none",
    exampleScope: sharedExample ? "shared" : "independent",
    grouping: /\b(?:ayri ayri|her birini|ucunu ayri|ikisini ayri)\b/.test(normalized) ? "separate_each" : "integrated",
    requestedSentenceCount: Number.isFinite(requestedSentenceCount) ? requestedSentenceCount : null,
    preserveMeaning: /\b(?:yeniden soyle|tekrar anlat|daha basit|akademik oldu|akademik olmadan)\b/.test(normalized),
  })
}

function summaryExtras(message: string, tasks: readonly StudentSemanticTask[]): StudentObservedRequestFacts["summaryExtras"] {
  const normalized = normalizeDnaChatText(message)
  const summary = tasks.includes("summarize")
  return Object.freeze({
    unknown: summary && /\b(?:neyi bilmiyoruz|bilmedigimiz|kesin degil|kesin soyleyem\w*|sinir)\b/.test(normalized),
    observationFocus: summary && /\b(?:gozlem\w*|neye bak\w*)\b/.test(normalized),
  })
}

function observationExtras(message: string, tasks: readonly StudentSemanticTask[]): StudentObservationScope {
  const normalized = normalizeDnaChatText(message)
  const multiplePlausibleExplanations = tasks.includes("case_reasoning")
  const contextualJudgment = /\biyi mi kotu mu\b/.test(normalized)
    || /\b(?:iyi|kotu) diyebilir\w*\b/.test(normalized)
  const withinTargetStateContrast = tasks.includes("compare")
    && /\b(?:dusuk|az)\b.{0,40}\b(?:yuksek|cok)\b/u.test(normalized)
  const signals = Object.freeze({
    ...(multiplePlausibleExplanations ? { multiplePlausibleExplanations: true as const } : {}),
    ...(contextualJudgment ? { contextualJudgment: true as const } : {}),
    ...(withinTargetStateContrast ? { withinTargetStateContrast: true as const } : {}),
  })
  if (tasks.includes("observe") || tasks.includes("case_reasoning")) {
    return Object.freeze({
      singleObservationLimit: true,
      additionalContext: true,
      ...signals,
    })
  }
  if (!tasks.includes("compare")) return Object.freeze({
    singleObservationLimit: false,
    additionalContext: false,
    ...signals,
  })
  const singleObservationLimit = /\b(?:tek (?:bir )?gozlem\w*|sadece bu|kesin soyle|kesin diy|hangisi olabilir|ne dusun\w*|neden kesin|niye kesin)\b/.test(normalized)
  return Object.freeze({
    singleObservationLimit,
    additionalContext: singleObservationLimit && /\b(?:baska|neye bak|hangisi olabilir|ne dusun\w*|neden kesin|niye kesin)\b/.test(normalized),
    ...signals,
  })
}

function referenceCues(message: string): StudentReferenceCues {
  const normalized = normalizeDnaChatText(message)
  const historyReturn = /\b(?:ilk anlattigin|ilk konu|az onceki konu|az onceki cocuk|geri donelim|donelim|basa donelim)\b/.test(normalized)
  const active = /\b(?:bunu|bunun|bununla|bunda|burada|onu|o zaman|ayni sey|dedigin|ikisinden|ikisini|bu destek|bu ornek|bu davranis|bu cocu(?:k|g)|bu ogrenci|bu vaka)\w*\b/.test(normalized)
  const entityWord = /\b(?:cocu(?:k|g)|ogrenci|vaka|davranis|ornek)\w*\b/.test(normalized)
  const fragmentaryCase = /\bsesli yaziyorum\b/.test(normalized)
    || (/\b(?:bu ne simdi|yani bu ne)\b/.test(normalized)
      && /\b(?:cocu(?:k|g)\w*|ogrenci\w*|ogretmen\w*|yetiskin\w*)\b/.test(normalized))
  return Object.freeze({
    active,
    historyReturn,
    firstHistory: historyReturn && /\b(?:ilk|basa)\b/.test(normalized),
    caseEntity: entityWord && (active || historyReturn || /\b(?:onceki ornek|ornekteki)\b/.test(normalized)),
    fragmentaryCase,
  })
}

function historyGroundedContextFacts(input: Readonly<{
  message: string
  state: StudentConversationState
}>): readonly StudentObservedTargetFact[] {
  const normalized = normalizeDnaChatText(input.message)
  const historyTargets = new Set(input.state.semanticLedger.flatMap((turn) => turn.targetIds))
  const fragmentaryCase = /\bsesli yaziyorum\b/.test(normalized)
    || (/\b(?:bu ne simdi|yani bu ne)\b/.test(normalized)
      && /\b(?:cocu(?:k|g)\w*|ogrenci\w*|ogretmen\w*|yetiskin\w*)\b/.test(normalized))
  const candidates: Array<Readonly<{ targetId: string; pattern: RegExp }>> = []
  const historicalSensoryTargets = ["sensory_regulation", "sensory_modulation"].filter((targetId) => historyTargets.has(targetId))
  if (historicalSensoryTargets.length === 1 && (/\bduyusal\b/.test(normalized)
    || (fragmentaryCase && /\bses\w*\b/.test(normalized) && /\bortam\w*\b/.test(normalized)))) {
    candidates.push({ targetId: historicalSensoryTargets[0]!, pattern: /\b(?:duyusal|ses\w*)\b/u })
  }
  if (fragmentaryCase && historyTargets.has("arousal") && /\b(?:hareket\w*|uyan\w*|sakin\w*)\b/.test(normalized)) {
    candidates.push({ targetId: "arousal", pattern: /\b(?:hareket\w*|uyan\w*|sakin\w*)\b/u })
  }
  if (fragmentaryCase && historyTargets.has("coregulation")
    && /\b(?:ogretmen\w*|yetiskin\w*)\b/.test(normalized)
    && /\b(?:duzel\w*|sakin\w*|don\w*|degis\w*)\b/.test(normalized)) {
    candidates.push({ targetId: "coregulation", pattern: /\b(?:ogretmen\w*|yetiskin\w*)\b/u })
  }
  return Object.freeze(candidates.flatMap((candidate) => {
    const match = candidate.pattern.exec(normalized)
    if (!match || match.index === undefined) return []
    return [Object.freeze({
      targetId: candidate.targetId,
      evidenceKind: "context_alias" as const,
      normalizedStart: match.index,
      normalizedEnd: match.index + match[0].length,
    })]
  }))
}

function safetyIntent(message: string, tasks: readonly StudentSemanticTask[]): StudentObservedSafetyIntent {
  const normalized = normalizeDnaChatText(message)
  if (tasks.includes("treatment_boundary")) return "treatment_selection"
  if (/\b(?:tani koy|tanisi ne|hangi tani|tani mi)\b/.test(normalized)) return "diagnosis_request"
  if (tasks.includes("summarize")) return "general_education"
  if (tasks.includes("case_reasoning") || tasks.includes("observe")) return "case_interpretation"
  return "general_education"
}

export function observeStudentRequestFacts(input: Readonly<{
  turnId: string
  message: string
  state: StudentConversationState
}>): StudentObservedRequestFacts {
  const facts = targetFacts(input.message)
  const normalized = normalizeDnaChatText(input.message)
  const emotionComponentMatch = /\bduygu (?:kismi|tarafi)\w*\b/u.exec(normalized)
  const recoveryCaseMatch = /\bkendi(?:ni| kendine)?\s+toparla\w*.{0,30}\bdon\w*\b/u.exec(normalized)
  const componentFacts = emotionComponentMatch
    ? [Object.freeze({
        targetId: "emotion_regulation",
        evidenceKind: "explicit_alias" as const,
        normalizedStart: emotionComponentMatch.index,
        normalizedEnd: emotionComponentMatch.index + emotionComponentMatch[0].length,
      })]
    : []
  const recoveryFacts = recoveryCaseMatch
    ? [Object.freeze({
        targetId: "recovery",
        evidenceKind: "explicit_stem" as const,
        normalizedStart: recoveryCaseMatch.index,
        normalizedEnd: recoveryCaseMatch.index + recoveryCaseMatch[0].length,
      })]
    : []
  const explicitFacts = Object.freeze([...facts.explicit, ...componentFacts, ...recoveryFacts]
    .sort((left, right) => left.normalizedStart - right.normalizedStart))
  const groundedContextFacts = historyGroundedContextFacts(input)
  const contextFacts = Object.freeze([...facts.context, ...groundedContextFacts]
    .sort((left, right) => left.normalizedStart - right.normalizedStart))
  const explicitTargetIds = unique(explicitFacts.map((fact) => fact.targetId))
  const contextTargetIds = unique(contextFacts.map((fact) => fact.targetId).filter((targetId) => !explicitTargetIds.includes(targetId)))
  const tasks = semanticTaskCandidates(input.message, explicitTargetIds.length)
  return Object.freeze({
    version: DNA_STUDENT_EVIDENCE_FIRST_VERSION,
    turnId: input.turnId,
    explicitTargetFacts: explicitFacts,
    explicitTargetIds: Object.freeze(explicitTargetIds),
    contextTargetFacts: contextFacts,
    contextTargetIds: Object.freeze(contextTargetIds),
    rejectedTargetIds: rejectedTargets(input.message, explicitTargetIds, input.state),
    semanticTaskCandidates: tasks,
    conversationAction: conversationAction(input.message, input.state.semanticLedger.length > 0),
    presentation: presentation(input.message),
    summaryExtras: summaryExtras(input.message, tasks),
    observationExtras: observationExtras(input.message, tasks),
    referenceCues: referenceCues(input.message),
    safetyIntent: safetyIntent(input.message, tasks),
    caseContext: observeStudentCaseContext(input.message),
  })
}

function caseEntityOrigin(turnId: string, state: StudentConversationState): string {
  let current = turnId
  const visited = new Set<string>()
  for (let depth = 0; depth < 8 && !visited.has(current); depth += 1) {
    visited.add(current)
    const snapshot = state.semanticLedger.find((turn) => turn.turnId === current)
    if (!snapshot || snapshot.semanticTask === "example") return current
    if (snapshot.referent.role !== "case_entity" || !snapshot.referent.turnId) return current
    current = snapshot.referent.turnId
  }
  return current
}

function referentCandidates(
  facts: StudentObservedRequestFacts,
  state: StudentConversationState,
): readonly StudentReferentCandidate[] {
  if (!state.semanticLedger.length || facts.semanticTaskCandidates.includes("treatment_boundary") || facts.conversationAction === "summarize_session") {
    return Object.freeze([])
  }
  const rows: StudentReferentCandidate[] = []
  const add = (turnId: string, role: Exclude<StudentReferent["role"], "none">, source: StudentReferentCandidate["source"], reason: string) => {
    if (rows.some((row) => row.turnId === turnId && row.role === role)) return
    const snapshot = state.semanticLedger.find((turn) => turn.turnId === turnId)
    if (!snapshot) return
    rows.push(Object.freeze({
      turnId,
      role,
      targetIds: Object.freeze([...snapshot.targetIds]),
      source,
      eligibilityReason: reason,
    }))
  }
  const latest = state.semanticHistory.at(-1) ?? state.semanticLedger.at(-1)!
  if (facts.referenceCues.historyReturn || facts.conversationAction === "return") {
    const order = facts.referenceCues.firstHistory ? [...state.semanticLedger] : [...state.semanticLedger].reverse()
    if (facts.referenceCues.caseEntity) {
      const example = [...state.semanticLedger].reverse().find((turn) => turn.semanticTask === "example") ?? null
      if (example) add(example.turnId, "case_entity", "case_entity_origin", "explicit history-return case cue")
      return Object.freeze(rows)
    }
    for (const turn of order) {
      const targetCompatible = !facts.explicitTargetIds.length || facts.explicitTargetIds.some((targetId) => turn.targetIds.includes(targetId))
      if (targetCompatible) {
        add(turn.turnId, "utterance", "history_return", "explicit history-return cue")
        if (facts.referenceCues.firstHistory) break
      }
    }
  } else if (facts.referenceCues.active || facts.referenceCues.caseEntity || facts.presentation.preserveMeaning) {
    if (facts.referenceCues.caseEntity) {
      add(caseEntityOrigin(latest.turnId, state), "case_entity", "case_entity_origin", "active case-entity cue")
    } else {
      add(latest.turnId, "utterance", "latest_utterance", "active utterance cue")
    }
  } else if (facts.semanticTaskCandidates.some((task) => ["example", "case_reasoning", "observe", "compare", "explain"].includes(task))) {
    const targetCompatible = !facts.explicitTargetIds.length || facts.explicitTargetIds.some((targetId) => latest.targetIds.includes(targetId))
    if (targetCompatible) add(latest.turnId, "utterance", "latest_utterance", "compatible context-binding continuation")
  }
  return Object.freeze(rows)
}

export function buildStudentStateCandidateEnvelope(input: Readonly<{
  facts: StudentObservedRequestFacts
  state: StudentConversationState
}>): StudentStateCandidateEnvelope {
  const sources = new Map<string, Set<StudentTargetCandidateSource>>()
  const addSource = (targetId: string, source: StudentTargetCandidateSource) => {
    const current = sources.get(targetId) ?? new Set<StudentTargetCandidateSource>()
    current.add(source)
    sources.set(targetId, current)
  }
  input.facts.explicitTargetIds.forEach((targetId) => addSource(targetId, "explicit_current_message"))
  input.facts.contextTargetIds.forEach((targetId) => addSource(targetId, "context_current_message"))
  input.state.activeTargetIds.forEach((targetId) => addSource(targetId, "active_state"))
  input.state.semanticLedger.flatMap((turn) => turn.targetIds).forEach((targetId) => addSource(targetId, "semantic_history"))

  const explicitSet = new Set(input.facts.explicitTargetIds.filter((targetId) => !input.facts.rejectedTargetIds.includes(targetId)))
  const contextSet = new Set(input.facts.contextTargetIds.filter((targetId) => !input.facts.rejectedTargetIds.includes(targetId)))
  const activeSet = new Set(input.state.activeTargetIds.filter((targetId) => !input.facts.rejectedTargetIds.includes(targetId)))
  const targetFreeSummary = input.facts.conversationAction === "summarize_session" && explicitSet.size === 0
  const targetFreeReturn = input.facts.conversationAction === "return" && explicitSet.size === 0
  const singleActiveTreatment = input.facts.safetyIntent === "treatment_selection" && explicitSet.size === 0 && activeSet.size === 1
  const comparisonNeedsStateSide = input.facts.semanticTaskCandidates.includes("compare")
    && !input.facts.observationExtras.withinTargetStateContrast
    && explicitSet.size < 2
  const contextCanFocus = input.facts.referenceCues.fragmentaryCase
    || input.facts.conversationAction === "summarize_session"
    || (input.facts.conversationAction === "repair" && explicitSet.size > 0)
  const hasFocusedContext = contextCanFocus && contextSet.size > 0
  const targetCandidates = [...sources.entries()].map(([targetId, targetSources]): StudentTargetCandidate => {
    const explicit = explicitSet.has(targetId)
    const contextOnly = targetSources.has("context_current_message") && !explicit
    const history = targetSources.has("semantic_history")
    const active = activeSet.has(targetId)
    const focusEligible = explicit || (contextCanFocus && contextOnly) || (targetFreeSummary && history) || (targetFreeReturn && history) || (singleActiveTreatment && active) ||
      (comparisonNeedsStateSide && active && !hasFocusedContext) ||
      (!explicitSet.size && !targetFreeSummary && !hasFocusedContext && input.facts.safetyIntent !== "treatment_selection" && active)
    const eligibilityReason: StudentTargetCandidate["eligibilityReason"] = explicit
      ? "explicit_current_message"
      : targetFreeSummary && history
        ? "target_free_summary_history"
        : targetFreeReturn && history
          ? "target_free_return_history"
        : singleActiveTreatment && active
          ? "single_active_treatment_context"
          : focusEligible
            ? "active_continuation"
            : contextOnly
              ? "context_only"
              : "history_only"
    return Object.freeze({
      targetId,
      sources: Object.freeze([...targetSources]),
      focusEligible,
      eligibilityReason,
    })
  })
  const referents = referentCandidates(input.facts, input.state)
  return Object.freeze({
    version: DNA_STUDENT_EVIDENCE_FIRST_VERSION,
    turnId: input.facts.turnId,
    targetCandidates: Object.freeze(targetCandidates),
    allowedFocusTargetIds: Object.freeze(targetCandidates.filter((row) => row.focusEligible).map((row) => row.targetId)),
    referentCandidates: referents,
    allowedReferentTurnIds: Object.freeze(unique(referents.map((row) => row.turnId))),
    taskCandidates: input.facts.semanticTaskCandidates,
    conversationAction: input.facts.conversationAction,
    safetyIntent: input.facts.safetyIntent,
  })
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  const a = unique(left).sort()
  const b = unique(right).sort()
  return a.length === b.length && a.every((value, index) => value === b[index])
}

export function resolveStudentEvidenceFirstPrimaryTask(facts: StudentObservedRequestFacts): StudentSemanticTask {
  const tasks = new Set(facts.semanticTaskCandidates)
  if (tasks.has("treatment_boundary")) return "treatment_boundary"
  if (tasks.has("summarize")) return "summarize"
  if (tasks.has("compare")) return "compare"
  if (tasks.has("example")) return "example"
  if (facts.presentation.grouping === "separate_each") return "explain"
  for (const task of ["case_reasoning", "observe", "evidence", "define", "explain"] as const) {
    if (tasks.has(task)) return task
  }
  return "explain"
}

export function buildDeterministicStudentClosedSlotChoice(input: Readonly<{
  facts: StudentObservedRequestFacts
  envelope: StudentStateCandidateEnvelope
}>): StudentClosedSlotChoice | null {
  if (input.envelope.referentCandidates.length > 1) return null
  const referent = input.envelope.referentCandidates[0] ?? null
  const focusTargetIds = input.facts.conversationAction === "return" && !input.facts.explicitTargetIds.length && referent
    ? referent.targetIds
    : input.envelope.allowedFocusTargetIds
  return Object.freeze({
    primaryTask: resolveStudentEvidenceFirstPrimaryTask(input.facts),
    focusTargetIds: Object.freeze([...focusTargetIds]),
    referentTurnId: referent?.turnId ?? null,
  })
}

function closedSlotFailure(failureCode: StudentClosedSlotFailureCode): StudentClosedSlotValidationResult {
  return Object.freeze({ ok: false, failureCode })
}

export function validateStudentClosedSlotChoice(
  candidate: unknown,
  facts: StudentObservedRequestFacts,
  envelope: StudentStateCandidateEnvelope,
): StudentClosedSlotValidationResult {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return closedSlotFailure("invalid_object")
  const row = candidate as Record<string, unknown>
  const primaryTask = typeof row.primaryTask === "string" && facts.semanticTaskCandidates.includes(row.primaryTask as StudentSemanticTask)
    ? row.primaryTask as StudentSemanticTask
    : null
  if (!primaryTask || primaryTask !== resolveStudentEvidenceFirstPrimaryTask(facts)) return closedSlotFailure("invalid_primary_task")
  if (!Array.isArray(row.focusTargetIds) || row.focusTargetIds.some((targetId) => typeof targetId !== "string")) {
    return closedSlotFailure("invalid_focus_targets")
  }
  const focusTargetIds = row.focusTargetIds as string[]
  if (unique(focusTargetIds).length !== focusTargetIds.length ||
    focusTargetIds.some((targetId) => !envelope.allowedFocusTargetIds.includes(targetId))) {
    return closedSlotFailure("invalid_focus_targets")
  }
  const referentTurnId = row.referentTurnId === null
    ? null
    : typeof row.referentTurnId === "string" ? row.referentTurnId : undefined
  if (referentTurnId === undefined || (referentTurnId !== null && !envelope.allowedReferentTurnIds.includes(referentTurnId))) {
    return closedSlotFailure("invalid_referent")
  }
  if (envelope.referentCandidates.length > 1 && referentTurnId === null) return closedSlotFailure("referent_choice_required")
  if (envelope.referentCandidates.length === 1 && referentTurnId !== envelope.referentCandidates[0]!.turnId) {
    return closedSlotFailure("invalid_referent")
  }
  if (!envelope.referentCandidates.length && referentTurnId !== null) return closedSlotFailure("invalid_referent")
  const referentCandidate = referentTurnId
    ? envelope.referentCandidates.find((candidate) => candidate.turnId === referentTurnId) ?? null
    : null
  const requiredFocusTargetIds = facts.conversationAction === "return" && !facts.explicitTargetIds.length && referentCandidate
    ? referentCandidate.targetIds
    : envelope.allowedFocusTargetIds
  if (!sameSet(focusTargetIds, requiredFocusTargetIds)) return closedSlotFailure("focus_target_set_mismatch")
  return Object.freeze({
    ok: true,
    choice: Object.freeze({
      primaryTask,
      focusTargetIds: Object.freeze([...focusTargetIds]),
      referentTurnId,
    }),
  })
}

export function studentClosedSlotChoiceSchema(
  facts: StudentObservedRequestFacts,
  envelope: StudentStateCandidateEnvelope,
): Record<string, unknown> {
  const ambiguousTargetFreeReturn = facts.conversationAction === "return" && !facts.explicitTargetIds.length && envelope.referentCandidates.length > 1
  return {
    type: "object",
    additionalProperties: false,
    required: ["primaryTask", "focusTargetIds", "referentTurnId"],
    properties: {
      primaryTask: { type: "string", enum: [resolveStudentEvidenceFirstPrimaryTask(facts)] },
      focusTargetIds: {
        type: "array",
        minItems: ambiguousTargetFreeReturn ? 1 : envelope.allowedFocusTargetIds.length,
        maxItems: ambiguousTargetFreeReturn ? envelope.allowedFocusTargetIds.length : envelope.allowedFocusTargetIds.length,
        items: { type: "string", enum: [...envelope.allowedFocusTargetIds] },
      },
      referentTurnId: envelope.allowedReferentTurnIds.length
        ? { anyOf: [{ type: "string", enum: [...envelope.allowedReferentTurnIds] }, { type: "null" }] }
        : { type: "null" },
    },
  }
}

function semanticActs(tasks: readonly StudentSemanticTask[]): StudentSemanticFrame["semanticActs"] {
  const selected = new Set(tasks)
  return Object.freeze({
    define: selected.has("define"),
    explain: selected.has("explain"),
    compare: selected.has("compare"),
    example: selected.has("example"),
    case_reasoning: selected.has("case_reasoning"),
    summarize: selected.has("summarize"),
    observe: selected.has("observe"),
    evidence: selected.has("evidence"),
    treatment_boundary: selected.has("treatment_boundary"),
  })
}

export function resolveStudentEvidenceFirstRequest(input: Readonly<{
  turnId: string
  message: string
  state: StudentConversationState
  choice?: unknown
}>): StudentEvidenceFirstResolutionResult {
  const facts = observeStudentRequestFacts(input)
  const envelope = buildStudentStateCandidateEnvelope({ facts, state: input.state })
  if (facts.safetyIntent === "diagnosis_request") return Object.freeze({
    ok: false,
    reason: "diagnosis_contract_pending",
    facts,
    envelope,
  })
  const deterministic = buildDeterministicStudentClosedSlotChoice({ facts, envelope })
  if (!deterministic && input.choice === undefined) return Object.freeze({
    ok: false,
    reason: "closed_slot_failure",
    failureCode: "referent_choice_required",
    facts,
    envelope,
  })
  const validation = validateStudentClosedSlotChoice(input.choice ?? deterministic, facts, envelope)
  if (!validation.ok) return Object.freeze({
    ok: false,
    reason: "closed_slot_failure",
    failureCode: validation.failureCode,
    facts,
    envelope,
  })
  const referentCandidate = validation.choice.referentTurnId
    ? envelope.referentCandidates.find((row) => row.turnId === validation.choice.referentTurnId) ?? null
    : null
  const frame: StudentSemanticFrame = Object.freeze({
    semanticActs: semanticActs(facts.semanticTaskCandidates),
    conversationAction: facts.conversationAction,
    focusTargetIds: validation.choice.focusTargetIds,
    contextTargetIds: Object.freeze(facts.contextTargetIds.filter((targetId) => !validation.choice.focusTargetIds.includes(targetId))),
    rejectedTargetIds: facts.rejectedTargetIds,
    referentTurnId: validation.choice.referentTurnId,
    referentRole: referentCandidate?.role ?? "none",
    presentation: facts.presentation,
    summaryExtras: facts.summaryExtras,
    observationExtras: facts.observationExtras,
  })
  return Object.freeze({
    ok: true,
    facts,
    envelope,
    choice: validation.choice,
    contract: compileStudentRequestContract(input.turnId, frame, input.state, facts.caseContext),
  })
}

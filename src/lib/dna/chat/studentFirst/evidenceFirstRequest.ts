import { normalizeDnaChatText } from "../text"
import type {
  StudentConversationAction,
  StudentCaseContext,
  StudentCaseHistoryContext,
  StudentObservationScope,
  StudentConversationState,
  StudentPresentationRequest,
  StudentReferent,
  StudentRequestContract,
  StudentSemanticTask,
  StudentSummaryScope,
} from "./contracts"
import { DNA_STUDENT_TARGET_LEXICON } from "./conversationState"
import { observeStudentCaseContext, studentCurrentSituationObserved } from "./caseContext"
import { isStudentCatalogTargetId, resolveStudentNamedCatalogTargets } from "./targetCatalog"
import { studentRequestedComparisonRelationFocus } from "./relationRequest"
import {
  compileStudentRequestContract,
  type StudentSemanticFrame,
} from "./semanticInterpreter"

export const DNA_STUDENT_EVIDENCE_FIRST_VERSION = "dna-student-evidence-first@21" as const

export type StudentObservedTargetFact = Readonly<{
  targetId: string
  evidenceKind: "explicit_alias" | "explicit_stem" | "context_alias" | "catalog_title"
  normalizedStart: number
  normalizedEnd: number
}>

export type StudentReferenceCues = Readonly<{
  active: boolean
  historyReturn: boolean
  firstHistory: boolean
  caseEntity: boolean
  fragmentaryCase: boolean
  describedScenario: boolean
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
  taskEvidence: "observed_request" | "default_explanation"
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

const NOMINAL_CASE_ENDINGS = ["i", "u", "a", "e", "yi", "yu", "ya", "ye", "de", "da", "te", "ta", "den", "dan", "ten", "tan", "in", "un", "nin", "nun", "la", "le", "yla", "yle"] as const
const POSSESSED_CASE_ENDINGS = ["ni", "nu", "na", "ne", "nde", "nda", "nden", "ndan", "nin", "nun", "yla", "yle"] as const

function nominalInflectionSuffix(alias: string): string {
  // Compose bounded nominal forms instead of accepting an arbitrary word tail.
  // A compound such as çalışma belleği already ends in a possessive vowel;
  // its case uses the n linker (belleği + nde). A bare noun can first acquire
  // possession (denetim + i + nde / düzenleme + si + nde).
  const vowelFinal = /[aeiou]$/u.test(alias)
  const possession = vowelFinal ? ["si", "su"] : ["i", "u"]
  const endings = new Set<string>([
    ...NOMINAL_CASE_ENDINGS,
    ...(vowelFinal ? POSSESSED_CASE_ENDINGS : []),
    ...possession.flatMap((possessive) => [possessive, ...POSSESSED_CASE_ENDINGS.map((ending) => possessive + ending)]),
  ])
  // A locative can carry the relative -ki and one further case. Keep this
  // finite as well: “belleğindeki” is nominal, “belleğindesiz” is not.
  for (const ending of [...endings]) {
    if (!/[dt][ae]$/u.test(ending)) continue
    endings.add(`${ending}ki`)
    for (const relativeCase of POSSESSED_CASE_ENDINGS) endings.add(`${ending}ki${relativeCase}`)
  }
  return `(?:${[...endings].sort((left, right) => right.length - left.length).join("|")})?`
}
const AMBIGUOUS_SINGLE_TOKEN_TARGETS = new Set(["attention"])
const AMBIGUOUS_CATALOG_TASK_TITLES = new Set(["belirsizlik", "plan", "ornek", "olcum", "degerlendirme"])
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
  const suffix = allowInflection ? nominalInflectionSuffix(normalizedAlias) : ""
  const match = new RegExp(`(?:^| )(${escaped(normalizedAlias)}${suffix})(?= |$)`, "u").exec(normalizedMessage)
  if (!match || match.index === undefined) return null
  const leadingSpace = match[0].startsWith(" ") ? 1 : 0
  const start = match.index + leadingSpace
  return Object.freeze({ start, end: start + match[1]!.length })
}

function targetFacts(message: string, preferredTargetIds: readonly string[]): Readonly<{
  explicit: readonly StudentObservedTargetFact[]
  context: readonly StudentObservedTargetFact[]
}> {
  const normalized = normalizeDnaChatText(message)
    .replace(/\b(?:ko regulasyon|coregulasyon)(?=[a-z]*\b)/g, "es regulasyon")
  const catalogRequestCue = /\b(?:ne\s+demek|nedir|neden|niye|islev\w*|iliski\w*|baglanti\w*|ayir(?:in|arak)?|karsilastir\w*|ornek\w*\s+ver\w*|goster\w*|sinir\w*|olc\w*|degerlendir\w*|daha\s+detay|ne\s+biliyoruz|tanimla\w*)\b/u.test(normalized)
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
      if (entry.id === "attention" && /^ deger\w*\b/u.test(normalized.slice(match.end))) continue
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
  for (const target of resolveStudentNamedCatalogTargets(message, preferredTargetIds)) {
    const normalizedSurface = normalizeDnaChatText(target.surface)
    const normalizedTitle = normalizeDnaChatText(target.title)
    const explicitSurfaceStart = normalized.indexOf(normalizedSurface)
    const explicitTitleStart = normalized.indexOf(normalizedTitle)
    const start = explicitTitleStart >= 0 ? explicitTitleStart : Math.max(0, explicitSurfaceStart)
    const matchedLength = explicitTitleStart >= 0 ? normalizedTitle.length : Math.max(normalizedSurface.length, 1)
    const titleIsCoreAlias = DNA_STUDENT_TARGET_LEXICON.some((entry) => entry.aliases
      .some((alias) => normalizeDnaChatText(alias) === normalizedTitle))
    const catalogTitleIsEligible = !AMBIGUOUS_CATALOG_TASK_TITLES.has(normalizedTitle)
      || normalized === normalizedTitle
      || normalized.startsWith(`${normalizedTitle} `)
    const specificCatalogTitle = isStudentCatalogTargetId(target.targetId)
      && explicitTitleStart >= 0
      && (normalizedTitle.split(" ").filter(Boolean).length >= 2 || catalogRequestCue)
      && catalogTitleIsEligible
      && !titleIsCoreAlias
    const distinctRelationEquivalent = target.relationEquivalent && !titleIsCoreAlias
    if (isStudentCatalogTargetId(target.targetId) && !specificCatalogTitle && !distinctRelationEquivalent) continue
    if (explicit.length && !specificCatalogTitle && !distinctRelationEquivalent) continue
    if (specificCatalogTitle) {
      for (let index = explicit.length - 1; index >= 0; index -= 1) {
        const fact = explicit[index]!
        if (fact.normalizedStart >= start && fact.normalizedEnd <= start + matchedLength) explicit.splice(index, 1)
      }
    }
    if (explicit.some((fact) => fact.targetId === target.targetId)) continue
    explicit.push(Object.freeze({
      targetId: target.targetId,
      evidenceKind: "catalog_title",
      normalizedStart: start,
      normalizedEnd: start + matchedLength,
    }))
  }
  const nonShadowedFacts = (rows: StudentObservedTargetFact[]) => rows.filter((row) => !rows.some((other) =>
    other.targetId !== row.targetId
    && other.normalizedStart <= row.normalizedStart
    && other.normalizedEnd >= row.normalizedEnd
    && other.normalizedEnd - other.normalizedStart > row.normalizedEnd - row.normalizedStart))
  const sortFacts = (rows: StudentObservedTargetFact[]) => rows.sort((left, right) =>
    left.normalizedStart - right.normalizedStart ||
    right.normalizedEnd - right.normalizedStart - (left.normalizedEnd - left.normalizedStart))
  return Object.freeze({
    explicit: Object.freeze(sortFacts(nonShadowedFacts(explicit))),
    context: Object.freeze(sortFacts(nonShadowedFacts(context))),
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
      const forms = [label, ...(label.endsWith("k") ? [`${label.slice(0, -1)}g`] : []),
        ...(/(?:ma|me)$/u.test(label) ? [`${label}k`] : [])]
      // Rejection must use the same bounded nominal forms as positive focus,
      // otherwise an inflected “... sormuyorum” can re-enter active targets.
      return forms.some((form) => new RegExp(
        `(?:^| )${escaped(form)}${nominalInflectionSuffix(form)} (?:(?:kismini|kismi|tarafini|tarafi) )?(?:degil|deil|sormuyorum)(?= |$)`, "u",
      ).test(normalized))
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

function studentExampleRequestPhrases(message: string): readonly (readonly string[])[] {
  // Preserve clause/quotation boundaries before the common normalizer removes
  // punctuation. Quoted examples are content, not instructions to generate one.
  const unquoted = message
    .replace(/"[^"\n]*"|“[^”\n]*”|«[^»\n]*»|`[^`\n]*`/gu, ";")
    .replace(/(^|[\s(])'[^'\n]*'|‘[^’\n]*’/gu, "$1;")
  const phrases: Array<readonly string[]> = []
  const exampleAction = /^(?:ver|ekle|anlat|acikla|goster|bagla|ayir)(?:in|yin|iniz|yiniz|sene|sana|senize|saniza|[ae]bilirsin(?:iz)?)?$/u
  const politeExampleAction = /^(?:ver|ekle|anlat|acikla|goster|bagla|ayir)(?:r|ir|[ae]bilir)$/u
  const actionPredicate = /^(?:ver|ekle|anlat|acikla|goster|bagla|ayir|tanimla|karsilastir|ozetle|toparla|yaz|iste)(?:(?:in|yin|iniz|yiniz|r|ir)|(?:ma|me|di|ti|du|tu|il|in|iyor|uyor|yor|ecek|acak)\w*)?$/u
  const predicateBoundary = /^(?:var|yok|vardi|yoktu|yeterli|yetersiz|guzel|guzeldi|gereksiz|gerekmiyor|istemiyorum|istemem|istemedim|istemiyoruz|degil|deil|dedi|diyor|demek|diye|almadan|olmadan)$/u
  for (const rawClause of unquoted.split(/[.!?;\n]+/u)) {
    for (const clause of normalizeDnaChatText(rawClause).split(/\b(?:ama|fakat|ancak|oysa|sonra)\b/u)) {
      const words = clause.split(" ").filter(Boolean)
      let start = 0
      let precedingDirective = false
      for (const [index, word] of words.entries()) {
        const directive = exampleAction.test(word)
          || (politeExampleAction.test(word) && /^mi(?:sin(?:iz)?)?$/u.test(words[index + 1] ?? ""))
        if (!directive && !actionPredicate.test(word) && !predicateBoundary.test(word)) continue
        const positive = directive
          && !/^(?:istemiyorum|istemem|degil|deil|demek|dedi|diyor|diye)$/u.test(words[index + 1] ?? "")
        // Negated, reported and different-task predicates close the phrase too:
        // “örnek verme, planlamayı anlat” must not borrow the later “anlat”.
        if (positive) phrases.push(words.slice(start, index))
        start = index + 1
        precedingDirective = positive
      }
      // Turkish can place the object after the directive: “göster bana, aynı
      // örnekte iki cümlede”. It cannot cross another predicate or hard clause.
      if (precedingDirective) phrases.push(words.slice(start))
    }
  }
  return Object.freeze(phrases)
}

function studentExampleSignals(message: string) {
  const bound = studentExampleRequestPhrases(message).flatMap((words) => {
    const exampleIndexes = words.flatMap((word, index) =>
      /^(?:ornek|orneg|senaryo)/u.test(word) && !/^orneklem/u.test(word) ? [index] : [])
    return exampleIndexes.length ? [{ words, exampleIndexes }] : []
  })
  const shared = bound.some(({ words, exampleIndexes }) => exampleIndexes.some((index) =>
    words.slice(Math.max(0, index - 4), index + 1).some((word) => ["ayni", "ortak", "tek"].includes(word))))
  const concrete = bound.some(({ words }) => words.some((word) =>
    startsWithAny(word, ["cocuk", "ogrenci", "sinif", "ders", "ogretmen", "oyun", "gunluk"])))
  return Object.freeze({ requested: bound.length > 0, shared, concrete })
}

function semanticTaskCandidates(message: string, explicitTargetCount: number): readonly StudentSemanticTask[] {
  const normalized = normalizeDnaChatText(message)
  const words = normalizedStudentWords(message)
  const exampleSignals = studentExampleSignals(message)
  const dailyLifeExampleContext = exampleSignals.requested && (
    /\b(?:gunluk|gundelik)\s+(?:hayat|yasam)\w*\b.{0,32}\b(?:ornek|senaryo)\w*\b/u.test(normalized)
    || /\b(?:ornek|senaryo)\w*\b.{0,32}\b(?:gunluk|gundelik)\s+(?:hayat|yasam)\w*\b/u.test(normalized)
  )
  const diagnosticCausality = /\b(?:adhd|otizm|tani|hiporeaktif|bozukluk)\w*\b/u.test(normalized)
    && /\b(?:mi|midir|var\s+mi|diyebilir\w*)\b/u.test(normalized)
  const causalityBoundary = diagnosticCausality || (/\b(?:kesin\w*\s+neden|mutlaka|bozuk\w*|guclu\s+mu|olur\s+mu|midir|mi|diyebilir\w*)\b/u.test(normalized)
    && /\b(?:tek\s+basina|kesin\w*|mutlaka|dusuk\w*|yuksek\w*|bakm\w*|hareket\w*|zorlan\w*|surdu\w*|bozuk\w*|diyebilir\w*)\b/u.test(normalized)
  )
  const measurementSignal = /\b(?:nasil\s+olcul\w*|olcum\w*|nasil\s+degerlendiril\w*|degerlendirme\s+yontem\w*)\b/u.test(normalized)
  const mechanismSignal = /\bmekanizma\w*\b/u.test(normalized)
  const dailyLifeSignal = /\b(?:gunluk\s+(?:yasam|hayat)\w*|gundelik\s+(?:yasam|hayat)\w*)\b/u.test(normalized)
  const boundarySignal = causalityBoundary || /\b(?:bilimsel\s+sinir\w*|yorum\s+sinir\w*|guvenli\s+yorum\s+sinir\w*|kanit\w*\s+(?:kesinlik|sinir)\w*|belirsizlig\w*.{0,30}\b(?:kanit|sinir|yorum)\w*|hangi\s+yorum\w*\s+yap\w*|ne\s+kadar\s+(?:kesin|emin)|neyi\s+goster\w*.{0,50}\btek\s+basina\b.{0,30}\bgoster\w*|tek\s+basina\s+ne\w*\s+(?:goster|soyle)\w*|temkinli\s+ol)\b/u.test(normalized)
  const comparisonRelationFocus = studentRequestedComparisonRelationFocus(message)
  const relationSignal = comparisonRelationFocus !== null
    || /\b(?:iliski\w*|baglanti\w*|birbiriyle|etkisi\w*|etkinin\s+sinir\w*|hangi\s+yonden\s+etki)\b/u.test(normalized)
  const comparisonSignal = /\b(?:ayni\s+mi|ayni\s+sey\s+mi|farki\w*|birbirinden\s+ayir\w*|ayir(?:in|arak)?|nasil\s+ayril\w*|karsilastir\w*|hangisi|hangisine\s+girer|ikisini\s+de)\b/u.test(normalized)
    || comparisonRelationFocus !== null
    || (explicitTargetCount === 1 && /\b(?:dusuk|az)\b.{0,40}\b(?:yuksek|cok)\b/u.test(normalized))
    || (explicitTargetCount > 1 && /\bmi\b/u.test(normalized) && !causalityBoundary && !relationSignal)
    || (explicitTargetCount === 2 && /\bayni\s+ornekte\b/u.test(normalized))
  const tasks: StudentSemanticTask[] = []
  const add = (task: StudentSemanticTask, matched: boolean) => {
    if (matched && !tasks.includes(task)) tasks.push(task)
  }
  add("treatment_boundary", /\b(?:hangi tedaviyi|hangi tedavi|hangi terapiyi|hangi terapi|ne uygulayayim|seans plani|tedavi plani|terapiyi sec|tedaviyi sec)\b/.test(normalized))
  add("summarize", /\b(?:toparla|ozetle|ozet yap|ozeti yap|ogrenci ozeti|ozet cikar|konustuklarimizi|konustugumuzu|konusmayi)\b/.test(normalized))
  add("deepen", /\b(?:derine\s+gir|derinlestir\w*|daha(?:\s+da)?\s+detaylandir\w*|mekanizma\w*\s+ac|onceki\s+(?:aciklama|tanim)\w*|(?:biraz\s+)?daha\s+(?:detayli|kapsamli)\s+anlat|kisa\s+tanim\w*.{0,24}\b(?:degil|deil)\b|yeni\s+bilgi\w*\s+ekle|baska\s+ne\s+biliyoruz)\b/u.test(normalized))
  add("measurement", measurementSignal)
  add("mechanism", mechanismSignal)
  add("daily_life", dailyLifeSignal && !dailyLifeExampleContext)
  add("boundary", boundarySignal)
  add("relate", relationSignal)
  add("significance", /\b(?:ne ise yarar|neden onem\w*|niye onem\w*|islevsel\s+onem\w*|neden dikkate deger|neye katki sagla\w*)\b/u.test(normalized))
  add("evidence", words.some((word) => startsWithAny(word, ["kanit", "kaynak", "calismalar"]))
    || /\bne kadar guvenilir\b/.test(normalized))
  add("observe", /\b(?:tek (?:bir )?gozlem\w*|gozlemde|neye bak|nasil gozlemler|baska neye)\b/.test(normalized))
  add("compare", comparisonSignal)
  add("example", exampleSignals.requested)
  const caseQuestion = /\b(?:diyebilir miyim|diyebilir miyiz|ne olabilir|ne dusun\w*|nasil dusun\w*|kesin soyle|zayif diyebilir|ilgili mi|iyi mi kotu mu|bu ne simdi|hangisi)\b/.test(normalized)
    || (/\bne demek\b/.test(normalized) && /\bgorevi birak\w*\b/.test(normalized))
  const caseScene = /\b(?:cocu(?:k|g)\w*|ogrenci\w*|vaka\w*|davranis\w*|sadece bu|gorevi birak\w*|sinirlen\w*|ses\w* yuksel\w*)\b/.test(normalized)
  add("case_reasoning", caseQuestion && (
    caseScene
    || /\biyi mi kotu mu\b/.test(normalized)
    || (explicitTargetCount > 0 && tasks.includes("observe"))
  ))
  const strongDefinition = /\b(?:ne demek|neydi|tam olarak ne|neyi kastediyoruz|neyi ifade eder|tanimla\w*|tanimini|ozunu)\b/u.test(normalized)
  const weakDefinition = /\bnedir\b/u.test(normalized)
  add("define", strongDefinition || (weakDefinition && !boundarySignal && !measurementSignal && !relationSignal && !comparisonSignal))
  add("explain", /\b(?:anlat|acikla|nasil dusun\w*|nasil yer al\w*|ne anlama gelir|baglama gore|bunun icinde mi|ne ise yarar|neden onem\w*|neden dikkate deger|neye katki sagla\w*)\b/.test(normalized))
  return Object.freeze(tasks)
}

function preserveReformattedContinuation(
  message: string,
  explicitTargetIds: readonly string[],
  tasks: readonly StudentSemanticTask[],
  state: StudentConversationState,
): Readonly<{ tasks: readonly StudentSemanticTask[]; preserveMeaning: boolean }> {
  const normalized = normalizeDnaChatText(message)
  const latest = state.semanticHistory.at(-1) ?? null
  const reformatRequested = /\b(?:tablo\s+yapma|duz\s+anlat|madde\s+madde\s+(?:yazma|anlatma))\b/u.test(normalized)
  if (!latest || explicitTargetIds.length || !reformatRequested) {
    return Object.freeze({ tasks, preserveMeaning: false })
  }
  return Object.freeze({
    tasks,
    preserveMeaning: true,
  })
}

function recoverSummaryContinuationTasks(
  message: string,
  explicitTargetIds: readonly string[],
  tasks: readonly StudentSemanticTask[],
  state: StudentConversationState,
): readonly StudentSemanticTask[] {
  const latest = state.semanticHistory.at(-1) ?? state.semanticLedger.at(-1) ?? null
  if (!latest || latest.semanticTask !== "summarize" || explicitTargetIds.length) return tasks
  const normalized = normalizeDnaChatText(message)
  const asksForPriorUncertainty = /\b(?:hangi\s+konularda\s+kesin\s+konusma\w*|kesin\s+konusma\w*.{0,36}\b(?:onlari|bunlari)|onlari\s+da\s+ayrica\s+soyle|bilmedigimiz\s+konular)\b/u.test(normalized)
  return asksForPriorUncertainty ? Object.freeze(["summarize"]) : tasks
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
  const countMatch = normalized.match(/\b(iki|uc|dort|bes|alti|[2-6]) (?:cumle|madde)\w*\b/)
  const requestedSentenceCount = countMatch
    ? ({ iki: 2, uc: 3, dort: 4, bes: 5, alti: 6 } as Record<string, number>)[countMatch[1]!] ?? Number(countMatch[1])
    : null
  const exampleRequested = exampleSignals.requested
  const concreteExample = exampleSignals.concrete
  const sharedExample = exampleSignals.shared
  const deepRequested = /\b(?:uzun|ayrintili|detayli|derin|biraz\s+ac|daha\s+ac)\w*\b/u.test(normalized)
  const negatedBrief = /\bkisa\b.{0,24}\b(?:degil|deil)\b/u.test(normalized)
  const briefRequested = !negatedBrief
    && /\b(?:kisa|kisaca|minicik|ozet)\w*\b/u.test(normalized)
  return Object.freeze({
    depth: requestedSentenceCount !== null
      ? "brief"
      : deepRequested || negatedBrief ? "deep" : briefRequested ? "brief" : "standard",
    language: /\b(?:sade|basit|ogrenci|akademik olma|akademik olmadan|akademik oldu|gunluk dil|duz anlat)\b/.test(normalized)
      ? "plain_student"
      : "standard",
    format: /\btablo\b/.test(normalized) && !/\btablo yapma\b/.test(normalized)
      ? "table"
      : /\b(?:madde madde|maddelerle|maddeyle|madde halinde|madde olarak)\b/.test(normalized)
          || /\b(?:iki|uc|dort|bes|alti|[2-6]) madde\w*\b/.test(normalized)
        ? "bullets" : "prose",
    example: exampleRequested ? concreteExample ? "concrete" : "brief" : "none",
    exampleScope: sharedExample ? "shared" : "independent",
    grouping: /\b(?:ayri ayri|her birini|ucunu ayri|ikisini ayri)\b/.test(normalized) ? "separate_each" : "integrated",
    requestedSentenceCount: Number.isFinite(requestedSentenceCount) ? requestedSentenceCount : null,
    preserveMeaning: /\b(?:yeniden soyle|tekrar anlat|daha basit|akademik oldu|akademik olmadan)\b/.test(normalized),
  })
}

const EPISTEMIC_NOMINAL_FORMS = [
  "bilmedigimiz", "bilmediklerimiz", "bilmediginiz", "bilmedikleriniz",
  "bilinmeyen", "bilinmeyenler", "kesinlesmemis", "netlesmemis", "kanitlanmamis",
].map((base) => `${base}${nominalInflectionSuffix(base)}`)
const EPISTEMIC_NEGATIVE_FORMS = ["olmayan", "olmayanlar", "olmadigimiz", "olmadiginiz"]
  .map((base) => `${base}${nominalInflectionSuffix(base)}`)
const EPISTEMIC_SCOPE_MENTION = new RegExp(`\\b(?:${[
  ...EPISTEMIC_NOMINAL_FORMS,
  `(?:kesin|emin|net) (?:degil|${EPISTEMIC_NEGATIVE_FORMS.join("|")})`,
  "belirsiz kalan",
  "(?:neyi|neleri) bilmiyoruz",
  `kesin (?:soyleyem(?:iyoruz|eyiz|edi(?:m|n|k|niz|ler)?|edigimiz${nominalInflectionSuffix("edigimiz")}|ediginiz${nominalInflectionSuffix("ediginiz")})|konusma(?:di(?:m|n|k|niz|lar)?|digimiz${nominalInflectionSuffix("digimiz")}|diginiz${nominalInflectionSuffix("diginiz")}))`,
  `(?:bilimsel|yorum|kanit${nominalInflectionSuffix("kanit")}) (?:sinir${nominalInflectionSuffix("sinir")}|sinirlar${nominalInflectionSuffix("sinirlar")})`,
].join("|")})\\b`, "gu")

function summaryUnknownRequested(message: string): boolean {
  // Scope is an object of a request, not a bag of uncertainty words. Preserve
  // quotation/clause boundaries and collapse only epistemic spans before
  // interpreting directive polarity. Thus the content negation in “kesin
  // değil” is not confused with the instruction negation in “ekleme”.
  const unquoted = message
    .replace(/"[^"\n]*"|“[^”\n]*”|«[^»\n]*»|`[^`\n]*`/gu, ";")
    .replace(/(^|[\s(])'[^'\n]*'|‘[^’\n]*’/gu, "$1;")
  const scopeToken = "epistemicscope"
  const actionRoot = "(?:ozetle|toparla|ekle|yaz|anlat|acikla|belirt|soyle|listele|bahset|goster|yap|ver|atla|kaldir|cikar|kullan)"
  const directive = new RegExp(`^${actionRoot}(?:in|un|yin|yun|iniz|unuz|yiniz|yunuz|sene|sana|senize|saniza|y?[ae]bilirsin(?:iz)?)?$`, "u")
  const politeDirective = new RegExp(`^${actionRoot}(?:r|ir|ur|y?[ae]bilir)$`, "u")
  const actionPredicate = new RegExp(`^${actionRoot}(?:(?:in|un|yin|yun|iniz|unuz|r|ir|ur)|(?:ma|me|di|ti|du|tu|il|in|iyor|uyor|yor|ecek|acak|y?[ae]bil)\\w*)?$`, "u")
  const rejectionOrReport = /^(?:istemiyorum|istemiyoruz|istemem|istemedim|degil|deil|demiyorum|demiyoruz|demedim|demedik|dedi|dedim|diyor|soyledim|soyledin)$/u
  let requested = false
  for (const rawClause of unquoted.split(/[.!?;\n]+/u)) {
    for (const clause of normalizeDnaChatText(rawClause).split(/\b(?:ama|fakat|ancak|oysa|sonra)\b/u)) {
      const words = clause.replace(EPISTEMIC_SCOPE_MENTION, scopeToken).split(" ").filter(Boolean)
      let start = 0
      let precedingPolarity: boolean | null = null
      for (const [index, word] of words.entries()) {
        const isDirective = directive.test(word)
          || (politeDirective.test(word) && /^m[iu](?:sun(?:uz)?|sin(?:iz)?)?$/u.test(words[index + 1] ?? ""))
        if (!isDirective && !actionPredicate.test(word) && !rejectionOrReport.test(word)) continue
        const object = words.slice(start, index)
        const removesScope = /^(?:atla|kaldir)/u.test(word)
          || (/^cikar/u.test(word) && !object.some((token) => /^(?:ozet|ozeti|ozetini)$/u.test(token)))
        const positive = isDirective && !removesScope && !rejectionOrReport.test(words[index + 1] ?? "")
        // Only a directive bound to this scope can change its value. A later
        // “örnek ekleme” must not cancel “bilmediklerimizi ekle”. A later
        // explicit correction of the same scope does supersede the earlier one.
        if (object.includes(scopeToken)) requested = positive
        start = index + 1
        precedingPolarity = positive
      }
      // Also allow the Turkish postposed object: “ekle bilmediklerimizi de”.
      // Neither quoted/reported commands nor another predicate lend polarity.
      if (precedingPolarity !== null && words.slice(start).includes(scopeToken)) requested = precedingPolarity
    }
  }
  return requested
}

function summaryExtras(message: string, tasks: readonly StudentSemanticTask[]): StudentObservedRequestFacts["summaryExtras"] {
  const normalized = normalizeDnaChatText(message)
  const summary = tasks.includes("summarize")
  return Object.freeze({
    unknown: summary && summaryUnknownRequested(message),
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
  const behavioralAppearance = /\bdavranis\w*.{0,48}\b(?:nasil\s+gorun|neye\s+benze|gorunumu)\w*\b/u.test(normalized)
  if (behavioralAppearance) return Object.freeze({
    singleObservationLimit: true,
    additionalContext: false,
    ...signals,
  })
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
  const describedScenario = studentCurrentSituationObserved(message)
  const fragmentaryCase = /\bsesli yaziyorum\b/.test(normalized)
    || (/\b(?:bu ne simdi|yani bu ne)\b/.test(normalized)
      && /\b(?:cocu(?:k|g)\w*|ogrenci\w*|ogretmen\w*|yetiskin\w*)\b/.test(normalized))
  return Object.freeze({
    active,
    historyReturn,
    firstHistory: historyReturn && /\b(?:ilk|basa)\b/.test(normalized),
    caseEntity: entityWord && (active || historyReturn || /\b(?:onceki ornek|ornekteki)\b/.test(normalized)),
    fragmentaryCase,
    describedScenario,
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

function safetyIntent(
  message: string,
  tasks: readonly StudentSemanticTask[],
  observation: StudentObservationScope,
): StudentObservedSafetyIntent {
  const normalized = normalizeDnaChatText(message)
  if (tasks.includes("treatment_boundary")) return "treatment_selection"
  if (/\b(?:tani koy|tanisi ne|hangi tani|tani mi)\b/.test(normalized)) return "diagnosis_request"
  if (tasks.includes("summarize")) return "general_education"
  if (tasks.includes("case_reasoning") || tasks.includes("observe")
    || ((tasks.includes("compare") || tasks.includes("example")) && observation.singleObservationLimit)) {
    return "case_interpretation"
  }
  return "general_education"
}

export function observeStudentRequestFacts(input: Readonly<{
  turnId: string
  message: string
  state: StudentConversationState
}>): StudentObservedRequestFacts {
  const facts = targetFacts(input.message, input.state.activeTargetIds)
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
  let allExplicitFacts = [...facts.explicit, ...componentFacts, ...recoveryFacts]
    .sort((left, right) => left.normalizedStart - right.normalizedStart)
  const preliminaryTargetIds = unique(allExplicitFacts.map((fact) => fact.targetId))
  const observedTasks = semanticTaskCandidates(input.message, preliminaryTargetIds.length)
  const detectedTasks = recoverSummaryContinuationTasks(
    input.message,
    preliminaryTargetIds,
    observedTasks.length ? observedTasks : Object.freeze(["explain"]),
    input.state,
  )
  const reformattedContinuation = preserveReformattedContinuation(
    input.message,
    preliminaryTargetIds,
    detectedTasks,
    input.state,
  )
  const tasks = reformattedContinuation.tasks
  if (tasks.includes("boundary") && allExplicitFacts.some((fact) => fact.targetId === "sleep_regulation")) {
    allExplicitFacts = allExplicitFacts.filter((fact) => fact.targetId !== "self_regulation")
  }
  const conditionalMatch = tasks.includes("boundary")
    ? /\b[a-z0-9_]+(?:sa|se)\b/u.exec(normalized)
    : null
  const conditionalLeftExplicitFacts = conditionalMatch?.index === undefined
    ? []
    : allExplicitFacts.filter((fact) => fact.normalizedEnd <= conditionalMatch.index! + conditionalMatch[0].length)
  const conditionalLeftContextFacts = conditionalMatch?.index === undefined
    ? []
    : facts.context.filter((fact) => fact.normalizedEnd <= conditionalMatch.index! + conditionalMatch[0].length)
  const conditionalFocusFacts = conditionalLeftExplicitFacts.length
    ? conditionalLeftExplicitFacts
    : conditionalLeftContextFacts
  const explicitFacts = Object.freeze(conditionalFocusFacts.length ? conditionalFocusFacts : allExplicitFacts)
  const demotedConditionalFacts = conditionalFocusFacts.length
    ? allExplicitFacts.filter((fact) => !conditionalFocusFacts.includes(fact))
    : []
  const groundedContextFacts = historyGroundedContextFacts(input)
  const contextFacts = Object.freeze([
    ...facts.context.filter((fact) => !conditionalFocusFacts.includes(fact)),
    ...demotedConditionalFacts,
    ...groundedContextFacts,
  ]
    .sort((left, right) => left.normalizedStart - right.normalizedStart))
  const explicitTargetIds = unique(explicitFacts.map((fact) => fact.targetId))
  const contextTargetIds = unique(contextFacts.map((fact) => fact.targetId).filter((targetId) => !explicitTargetIds.includes(targetId)))
  const detectedCaseContext = observeStudentCaseContext(input.message,
    input.state.semanticLedger.some(turn => Boolean(turn.caseContext.scenario)))
  const userSuppliedCaseExample = tasks.includes("example")
    && detectedCaseContext.eventIds.length > 0
    && /\bmi\b/u.test(normalized)
  const baseObservedScope = observationExtras(input.message, tasks)
  const observedScope = userSuppliedCaseExample
    ? Object.freeze({ ...baseObservedScope, singleObservationLimit: true })
    : baseObservedScope
  const observedPresentation = presentation(input.message)
  return Object.freeze({
    version: DNA_STUDENT_EVIDENCE_FIRST_VERSION,
    turnId: input.turnId,
    explicitTargetFacts: explicitFacts,
    explicitTargetIds: Object.freeze(explicitTargetIds),
    contextTargetFacts: contextFacts,
    contextTargetIds: Object.freeze(contextTargetIds),
    rejectedTargetIds: rejectedTargets(input.message, explicitTargetIds, input.state),
    semanticTaskCandidates: tasks,
    taskEvidence: observedTasks.length ? "observed_request" : "default_explanation",
    conversationAction: conversationAction(input.message, input.state.semanticLedger.length > 0),
    presentation: reformattedContinuation.preserveMeaning
      ? Object.freeze({ ...observedPresentation, preserveMeaning: true })
      : observedPresentation,
    summaryExtras: summaryExtras(input.message, tasks),
    observationExtras: observedScope,
    referenceCues: referenceCues(input.message),
    safetyIntent: safetyIntent(input.message, tasks, observedScope),
    caseContext: detectedCaseContext,
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
    if (facts.explicitTargetIds.length && !facts.referenceCues.firstHistory) {
      const allTargetMatches = order.filter((turn) =>
        facts.explicitTargetIds.every((targetId) => turn.targetIds.includes(targetId)))
      const exactTargetMatches = allTargetMatches.filter((turn) => sameSet(turn.targetIds, facts.explicitTargetIds))
      const exactTaskMatches = exactTargetMatches.filter((turn) =>
        facts.semanticTaskCandidates.includes(turn.semanticTask))
      const preferred = exactTaskMatches[0] ?? exactTargetMatches[0] ?? allTargetMatches[0] ?? null
      if (preferred) {
        add(preferred.turnId, "utterance", "history_return", "explicit target-set history-return cue")
        return Object.freeze(rows)
      }
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
  } else if (facts.semanticTaskCandidates.some((task) => [
    "example", "case_reasoning", "observe", "compare", "relate", "deepen", "boundary", "measurement", "explain",
  ].includes(task))) {
    const targetCompatible = !facts.explicitTargetIds.length || facts.explicitTargetIds.some((targetId) => latest.targetIds.includes(targetId))
    if (targetCompatible) add(latest.turnId, "utterance", "latest_utterance", "compatible context-binding continuation")
  }
  return Object.freeze(rows)
}

const FRAGMENT_HISTORY_EVENT_FAMILIES: readonly ReadonlySet<StudentCaseContext["eventIds"][number]>[] = Object.freeze([
  new Set<StudentCaseContext["eventIds"][number]>(["environmental_load_observed", "activation_increased"]),
  new Set<StudentCaseContext["eventIds"][number]>(["adult_support_received", "activity_resumed"]),
  new Set<StudentCaseContext["eventIds"][number]>(["task_interrupted", "self_recovered", "task_resumed"]),
  new Set<StudentCaseContext["eventIds"][number]>(["emotional_response_observed", "activation_increased"]),
  new Set<StudentCaseContext["eventIds"][number]>(["instruction_received", "adult_orientation_observed"]),
])

function fragmentCaseHistoryContext(
  facts: StudentObservedRequestFacts,
  state: StudentConversationState,
): StudentCaseHistoryContext | null {
  if (!facts.referenceCues.fragmentaryCase
    || !facts.semanticTaskCandidates.includes("case_reasoning")
    || !facts.caseContext.eventIds.length) return null
  const reversedHistory = [...state.semanticLedger].reverse()
  const selectedTurnIds: string[] = []
  for (const eventId of facts.caseContext.eventIds) {
    const family = FRAGMENT_HISTORY_EVENT_FAMILIES.find((candidate) => candidate.has(eventId)) ?? new Set([eventId])
    const exact = reversedHistory.find((turn) => turn.caseContext.eventIds.includes(eventId)) ?? null
    const related = exact ?? reversedHistory.find((turn) => turn.caseContext.eventIds.some((candidate) => family.has(candidate))) ?? null
    if (related && !selectedTurnIds.includes(related.turnId)) selectedTurnIds.push(related.turnId)
  }
  if (!selectedTurnIds.length) return null
  const orderedTurns = state.semanticLedger.filter((turn) => selectedTurnIds.includes(turn.turnId))
  return Object.freeze({
    turnIds: Object.freeze(orderedTurns.map((turn) => turn.turnId)),
    eventIds: Object.freeze(unique(orderedTurns.flatMap((turn) => turn.caseContext.eventIds))),
    rawMessageStored: false,
  })
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
  const rejectedSet = new Set(input.facts.rejectedTargetIds)
  const targetFreeSummary = input.facts.conversationAction === "summarize_session" && explicitSet.size === 0
  const targetFreeReturn = input.facts.conversationAction === "return" && explicitSet.size === 0
  const singleActiveTreatment = input.facts.safetyIntent === "treatment_selection" && explicitSet.size === 0 && activeSet.size === 1
  const comparisonNeedsStateSide = input.facts.semanticTaskCandidates.includes("compare")
    && !input.facts.observationExtras.withinTargetStateContrast
    && explicitSet.size < 2
  const latestTurn = input.state.semanticLedger.at(-1) ?? null
  const implicitSingleExampleAfterComparison = input.facts.semanticTaskCandidates.includes("example")
    && explicitSet.size === 0
    && !input.facts.referenceCues.active
    && !input.facts.referenceCues.describedScenario
    && !input.facts.presentation.preserveMeaning
    && latestTurn?.semanticTask === "compare"
    && latestTurn.referent.targetIds.length > 0
  const implicitExampleAnchorSet = new Set(implicitSingleExampleAfterComparison
    ? latestTurn.referent.targetIds.filter((targetId) => activeSet.has(targetId))
    : [])
  const contextCanFocus = input.facts.referenceCues.fragmentaryCase
    || input.facts.conversationAction === "summarize_session"
    || (input.facts.conversationAction === "repair" && explicitSet.size > 0)
  const hasFocusedContext = contextCanFocus && contextSet.size > 0
  const targetCandidates = [...sources.entries()].map(([targetId, targetSources]): StudentTargetCandidate => {
    const explicit = explicitSet.has(targetId)
    const contextOnly = targetSources.has("context_current_message") && !explicit
    const history = targetSources.has("semantic_history")
    const active = activeSet.has(targetId)
    const focusEligible = !rejectedSet.has(targetId) && (explicit || (contextCanFocus && contextOnly) || (targetFreeSummary && history) || (targetFreeReturn && history) || (singleActiveTreatment && active) ||
      (comparisonNeedsStateSide && active && !hasFocusedContext) ||
      (implicitSingleExampleAfterComparison && implicitExampleAnchorSet.has(targetId)) ||
      (!implicitSingleExampleAfterComparison && !explicitSet.size && !targetFreeSummary && !hasFocusedContext
        && input.facts.safetyIntent !== "treatment_selection" && active))
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
  if (tasks.has("define") && tasks.has("deepen")) return "define"
  for (const task of ["case_reasoning", "observe", "deepen", "measurement", "define", "relate", "significance", "boundary", "evidence", "mechanism", "daily_life", "explain"] as const) {
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
    significance: selected.has("significance"),
    relate: selected.has("relate"),
    deepen: selected.has("deepen"),
    boundary: selected.has("boundary"),
    measurement: selected.has("measurement"),
    mechanism: selected.has("mechanism"),
    daily_life: selected.has("daily_life"),
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
    contract: compileStudentRequestContract(
      input.turnId,
      frame,
      input.state,
      facts.caseContext,
      fragmentCaseHistoryContext(facts, input.state),
    ),
  })
}

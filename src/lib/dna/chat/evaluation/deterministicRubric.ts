import { normalizeDnaChatText } from "../text"

export const DNA_CHAT_DETERMINISTIC_RUBRIC_VERSION =
  "dna-chat-deterministic-rubric@1" as const

export type DnaChatExpectedDisposition =
  | "answered"
  | "refused"
  | "not_available"
  | "clarification"

export type DnaChatDeterministicRubric = Readonly<{
  expectedDisposition: DnaChatExpectedDisposition
  expectedTopicIds?: readonly string[]
  expectedSourceIds?: readonly string[]
  mustInclude?: readonly string[]
  mustNotInclude?: readonly string[]
  expectedSubquestionCount?: 1 | 2
}>

export type DnaChatDeterministicRubricResult = Readonly<{
  version: typeof DNA_CHAT_DETERMINISTIC_RUBRIC_VERSION
  passed: boolean
  score: number
  criticalFailures: readonly string[]
  metrics: Readonly<{
    dispositionMatch: 0 | 1
    topicRecall: number
    sourceRecall: number
    requiredPhraseRecall: number
    forbiddenPhrasePrecision: number
    compoundCoverage: number
  }>
}>

export type DnaChatRubricMetaCase = Readonly<{
  id: string
  publicBody: Record<string, unknown>
  rubric: DnaChatDeterministicRubric
  expectedPassed: boolean
}>

export type DnaChatRubricMetaEvaluation = Readonly<{
  version: typeof DNA_CHAT_DETERMINISTIC_RUBRIC_VERSION
  passed: boolean
  total: number
  correct: number
  falsePositiveCount: number
  falseNegativeCount: number
  failedCaseIds: readonly string[]
}>

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function records(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : []
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function recall(expected: readonly string[], actual: readonly string[]): number {
  const targets = unique(expected)
  if (!targets.length) return 1
  const actualSet = new Set(actual)
  const hits = targets.filter((target) => actualSet.has(target)).length
  return Number((hits / targets.length).toFixed(6))
}

export function dnaChatHitAtK(
  rankedIds: readonly string[],
  relevantIds: readonly string[],
  k: number,
): number {
  if (k <= 0 || !relevantIds.length) return 0
  const relevant = new Set(relevantIds)
  return rankedIds.slice(0, k).some((id) => relevant.has(id)) ? 1 : 0
}

export function dnaChatRecallAtK(
  rankedIds: readonly string[],
  relevantIds: readonly string[],
  k: number,
): number {
  if (k <= 0 || !relevantIds.length) return 0
  return recall(relevantIds, rankedIds.slice(0, k))
}

export function dnaChatReciprocalRank(
  rankedIds: readonly string[],
  relevantIds: readonly string[],
): number {
  const relevant = new Set(relevantIds)
  const index = rankedIds.findIndex((id) => relevant.has(id))
  return index < 0 ? 0 : Number((1 / (index + 1)).toFixed(6))
}

function disposition(body: UnknownRecord): DnaChatExpectedDisposition {
  const classification = String(body.classification || "")
  if (classification === "refusal") return "refused"
  if (classification === "not_available") return "not_available"
  if (classification === "clarification") return "clarification"
  return "answered"
}

function visibleText(body: UnknownRecord): string {
  const unitText = records(body.answerUnits).map((unit) => String(unit.text || ""))
  return normalizeDnaChatText([
    String(body.summary || ""),
    ...strings(body.details),
    ...unitText,
  ].join(" "))
}

function topicIds(body: UnknownRecord): string[] {
  return isRecord(body.conversationContext)
    ? strings(body.conversationContext.topicIds)
    : []
}

function sourceIds(body: UnknownRecord): string[] {
  return unique(records(body.sources).flatMap((source) => [
    String(source.sourceId || "").trim(),
    String(source.id || "").trim(),
  ]))
}

function phraseRecall(text: string, phrases: readonly string[]): number {
  const normalized = unique(phrases.map(normalizeDnaChatText).filter(Boolean))
  if (!normalized.length) return 1
  return Number((normalized.filter((phrase) => text.includes(phrase)).length / normalized.length).toFixed(6))
}

function compoundCoverage(body: UnknownRecord, expectedCount: 1 | 2 | undefined): number {
  if (expectedCount !== 2) return 1
  const ids = new Set(records(body.answerUnits).map((unit) => String(unit.id || "")))
  return ids.has("response-1-summary") && ids.has("response-2-summary") ? 1 : 0
}

/**
 * Offline-only, deterministic evaluation rubric. It intentionally accepts a
 * public response rather than engine internals, so tests grade what a therapist
 * can actually see. It performs no I/O and stores no prompt or answer text.
 */
export function evaluateDnaChatDeterministicRubric(input: Readonly<{
  publicBody: Record<string, unknown>
  rubric: DnaChatDeterministicRubric
}>): DnaChatDeterministicRubricResult {
  const text = visibleText(input.publicBody)
  const actualDisposition = disposition(input.publicBody)
  const dispositionMatch = Number(actualDisposition === input.rubric.expectedDisposition) as 0 | 1
  const topicRecall = recall(input.rubric.expectedTopicIds ?? [], topicIds(input.publicBody))
  const sourceRecall = recall(input.rubric.expectedSourceIds ?? [], sourceIds(input.publicBody))
  const requiredPhraseRecall = phraseRecall(text, input.rubric.mustInclude ?? [])
  const forbiddenHits = phraseRecall(text, input.rubric.mustNotInclude ?? [])
  const forbiddenPhrasePrecision = input.rubric.mustNotInclude?.length
    ? Number((1 - forbiddenHits).toFixed(6))
    : 1
  const compound = compoundCoverage(input.publicBody, input.rubric.expectedSubquestionCount)

  const weighted = [
    [dispositionMatch, 0.3],
    [topicRecall, 0.15],
    [sourceRecall, 0.15],
    [requiredPhraseRecall, 0.15],
    [forbiddenPhrasePrecision, 0.15],
    [compound, 0.1],
  ] as const
  const score = Number(weighted.reduce((sum, [value, weight]) => sum + value * weight, 0).toFixed(6))
  const criticalFailures = [
    dispositionMatch ? null : "disposition_mismatch",
    forbiddenPhrasePrecision === 1 ? null : "forbidden_phrase_present",
    compound === 1 ? null : "compound_section_missing",
  ].filter((failure): failure is string => Boolean(failure))

  return Object.freeze({
    version: DNA_CHAT_DETERMINISTIC_RUBRIC_VERSION,
    passed: criticalFailures.length === 0 && score >= 0.9,
    score,
    criticalFailures: Object.freeze(criticalFailures),
    metrics: Object.freeze({
      dispositionMatch,
      topicRecall,
      sourceRecall,
      requiredPhraseRecall,
      forbiddenPhrasePrecision,
      compoundCoverage: compound,
    }),
  })
}

/**
 * Grades the deterministic grader itself against hand-labelled fixtures. The
 * result contains only fixture IDs and counts; response text is never copied.
 */
export function evaluateDnaChatRubricMetaSet(
  cases: readonly DnaChatRubricMetaCase[],
): DnaChatRubricMetaEvaluation {
  const decisions = cases.map((metaCase) => ({
    id: metaCase.id,
    expectedPassed: metaCase.expectedPassed,
    observedPassed: evaluateDnaChatDeterministicRubric({
      publicBody: metaCase.publicBody,
      rubric: metaCase.rubric,
    }).passed,
  }))
  const failed = decisions.filter((decision) =>
    decision.expectedPassed !== decision.observedPassed)
  return Object.freeze({
    version: DNA_CHAT_DETERMINISTIC_RUBRIC_VERSION,
    passed: cases.length > 0 && failed.length === 0,
    total: cases.length,
    correct: cases.length - failed.length,
    falsePositiveCount: decisions.filter((decision) =>
      decision.observedPassed && !decision.expectedPassed).length,
    falseNegativeCount: decisions.filter((decision) =>
      !decision.observedPassed && decision.expectedPassed).length,
    failedCaseIds: Object.freeze(failed.map((decision) => decision.id)),
  })
}

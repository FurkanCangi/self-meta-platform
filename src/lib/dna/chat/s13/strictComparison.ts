import { normalizeDnaChatText } from "../text"
import type { DnaS13Claim } from "./contracts"

export const DNA_S13_STRICT_COMPARISON_VERSION = "dna-s13-strict-comparison@1" as const

export type DnaS13ComparisonSide = Readonly<{
  label: string
  normalizedLabel: string
  topicId: string
  requiredClaims: readonly DnaS13Claim[]
  candidateTopicIds: readonly string[]
  ambiguous: boolean
}>

export type DnaS13TwoSidedComparison = Readonly<{
  version: typeof DNA_S13_STRICT_COMPARISON_VERSION
  sides: readonly [DnaS13ComparisonSide, DnaS13ComparisonSide]
}>

function unique<T>(values: readonly T[]) {
  return [...new Set(values)]
}

function standaloneScore(claim: DnaS13Claim) {
  const text = claim.text.trim()
  let score = 0
  if (claim.answerEligible !== false) score += 40
  if (text.length >= 35 && text.length <= 280) score += 12
  if (!/:\s*$/.test(text)) score += 8
  if (!/^(?:bu|bunun|bunlar|burada|aynı zamanda|ayrıca)\b/iu.test(text)) score += 8
  const dimensions = new Set(claim.dimensions ?? [])
  if (dimensions.has("definition")) score += 14
  if (dimensions.has("comparison")) score += 11
  if (dimensions.has("relation")) score += 8
  if (dimensions.has("process")) score += 7
  if (dimensions.has("misconception_boundary")) score += 5
  return score
}

function selectRepresentativeClaim(claims: readonly DnaS13Claim[]) {
  return [...claims]
    .filter((claim) => claim.answerEligible !== false && claim.text.trim() && claim.passageId.trim() && claim.sourceIds.length > 0)
    .sort((left, right) => standaloneScore(right) - standaloneScore(left) || left.id.localeCompare(right.id))[0] ?? null
}

export function extractDnaS13ComparisonTargetLabels(question: string, claims: readonly DnaS13Claim[]) {
  const normalizedQuestion = normalizeDnaChatText(question)
  const marker = " ayni duzeyde"
  const markerIndex = normalizedQuestion.indexOf(marker)
  const prefix = markerIndex >= 0 ? normalizedQuestion.slice(0, markerIndex).trim() : normalizedQuestion
  const labels = unique(claims.map((claim) => claim.title?.trim()).filter((value): value is string => Boolean(value)))
    .map((label) => ({ label, normalized: normalizeDnaChatText(label) }))
    .filter((entry) => entry.normalized.length >= 3)
    .sort((left, right) => right.normalized.length - left.normalized.length || left.normalized.localeCompare(right.normalized))

  const pairs: Array<{ left: typeof labels[number]; right: typeof labels[number] }> = []
  for (const left of labels) {
    const beginning = `${left.normalized} ile `
    if (!prefix.startsWith(beginning)) continue
    const remainder = prefix.slice(beginning.length).trim()
    const right = labels.find((entry) => entry.normalized === remainder)
    if (right && right.normalized !== left.normalized) pairs.push({ left, right })
  }
  const selected = pairs.sort((a, b) =>
    (b.left.normalized.length + b.right.normalized.length) - (a.left.normalized.length + a.right.normalized.length)
    || a.left.normalized.localeCompare(b.left.normalized),
  )[0]
  return selected ? [selected.left.label, selected.right.label] as const : null
}

function sideForLabel(label: string, claims: readonly DnaS13Claim[]): DnaS13ComparisonSide | null {
  const normalizedLabel = normalizeDnaChatText(label)
  const matches = claims.filter((claim) => normalizeDnaChatText(claim.title ?? "") === normalizedLabel)
  const representative = selectRepresentativeClaim(matches)
  if (!representative) return null
  const candidateTopicIds = unique(matches.map((claim) => claim.topicId)).sort()
  return Object.freeze({
    label,
    normalizedLabel,
    topicId: representative.topicId,
    requiredClaims: Object.freeze([representative]),
    candidateTopicIds: Object.freeze(candidateTopicIds),
    ambiguous: candidateTopicIds.length > 1,
  })
}

export function retrieveDnaS13TwoSidedComparison(input: Readonly<{
  question: string
  claims: readonly DnaS13Claim[]
}>): DnaS13TwoSidedComparison | null {
  const labels = extractDnaS13ComparisonTargetLabels(input.question, input.claims)
  if (!labels) return null
  const left = sideForLabel(labels[0], input.claims)
  const right = sideForLabel(labels[1], input.claims)
  if (!left || !right || left.topicId === right.topicId || left.requiredClaims.length === 0 || right.requiredClaims.length === 0) return null
  return Object.freeze({
    version: DNA_S13_STRICT_COMPARISON_VERSION,
    sides: Object.freeze([left, right]) as readonly [DnaS13ComparisonSide, DnaS13ComparisonSide],
  })
}

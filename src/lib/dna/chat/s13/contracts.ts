import { normalizeDnaChatText } from "../text"

export const DNA_S13_QUERY_FRAME_VERSION = "dna-s13-query-frame@1" as const
export const DNA_S13_REQUIRED_SLOT_VERSION = "dna-s13-required-answer-slot@1" as const
export const DNA_S13_REALIZATION_VERSION = "dna-s13-realization@1" as const

export const DNA_S13_INTENTS = [
  "scientific_question",
  "social_product",
  "unsupported",
  "safety",
] as const

export const DNA_S13_FOCUS_VALUES = [
  "definition",
  "physiology",
  "process",
  "development",
  "measurement",
  "evidence",
  "comparison",
  "relation",
  "daily_function",
  "interpretation_boundary",
  "general",
] as const

export const DNA_S13_QUESTION_TYPES = [
  "definition",
  "explanation",
  "comparison",
  "relation",
  "measurement",
  "development",
  "evidence",
  "follow_up",
  "product_help",
  "unknown",
] as const

export const DNA_S13_DEPTHS = ["short", "standard", "deep"] as const
export const DNA_S13_ANSWERABILITY = ["supported", "partial", "unsupported", "uncertain"] as const

export type DnaS13Intent = typeof DNA_S13_INTENTS[number]
export type DnaS13Focus = typeof DNA_S13_FOCUS_VALUES[number]
export type DnaS13QuestionType = typeof DNA_S13_QUESTION_TYPES[number]
export type DnaS13Depth = typeof DNA_S13_DEPTHS[number]
export type DnaS13Answerability = typeof DNA_S13_ANSWERABILITY[number]
export const DNA_S13_REQUESTED_FACETS = Object.freeze([
  "definition", "function", "boundary", "supported_meaning", "limitation",
  "components", "core_scope", "explanatory_detail", "distinction", "verified_example",
] as const)
export type DnaS13RequestedFacet = typeof DNA_S13_REQUESTED_FACETS[number]

export type DnaS13Subquestion = Readonly<{
  id: string
  question: string
  intent: DnaS13Intent
  topicId: string
  focus: DnaS13Focus
  questionType: DnaS13QuestionType
  followUp: boolean
  correction: boolean
  comparisonTargetTopicIds: readonly string[]
  answerabilityHint: DnaS13Answerability
  requestedFacets?: readonly DnaS13RequestedFacet[]
}>

export type DnaS13QueryFrame = Readonly<{
  version: typeof DNA_S13_QUERY_FRAME_VERSION
  normalizedQuestion: string
  responseDepth: DnaS13Depth
  uncertain: boolean
  subquestions: readonly DnaS13Subquestion[]
}>

export type DnaS13RequiredAnswerSlot = Readonly<{
  version: typeof DNA_S13_REQUIRED_SLOT_VERSION
  id: string
  subquestionId: string
  topicId: string
  focus: DnaS13Focus
  questionType: DnaS13QuestionType
  requiredClaimIds: readonly string[]
  optionalClaimIds: readonly string[]
  sourceIds: readonly string[]
  answerability: DnaS13Answerability
}>

export type DnaS13Claim = Readonly<{
  id: string
  text: string
  passageId: string
  sourceIds: readonly string[]
  topicId: string
  focus?: string
  sectionId?: string
  title?: string
  domain?: string
  dimensions?: readonly string[]
  authorityClass?: string
  citationStatus?: string
  answerEligible?: boolean
}>

export type DnaS13RetrievalPackage = Readonly<{
  engine: "S1" | "S2"
  confidence: number
  runnerUpMargin: number
  lexicalTopicId: string | null
  ftrlTopicId: string | null
  claims: readonly DnaS13Claim[]
  slots: readonly DnaS13RequiredAnswerSlot[]
}>

export type DnaS13AnswerPlan = Readonly<{
  directAnswerSlotIds: readonly string[]
  explanationSlotIds: readonly string[]
  relationSlotIds: readonly string[]
  secondQuestionSlotIds: readonly string[]
  boundarySlotIds: readonly string[]
  orderedSlotIds: readonly string[]
}>

export type DnaS13Realization = Readonly<{
  version: typeof DNA_S13_REALIZATION_VERSION
  answer: string
  coveredSlots: readonly string[]
  usedClaimIds: readonly string[]
  usedSourceIds: readonly string[]
  unsupportedAddition: boolean
}>

function stringArray(value: unknown, maximum: number): string[] | null {
  if (!Array.isArray(value) || value.length > maximum) return null
  const result = value.map((item) => typeof item === "string" ? item.trim() : "")
  return result.every(Boolean) && new Set(result).size === result.length ? result : null
}

export function validateDnaS13QueryFrame(
  candidate: unknown,
  allowedTopicIds: readonly string[],
): DnaS13QueryFrame | null {
  if (!candidate || typeof candidate !== "object") return null
  const row = candidate as Record<string, unknown>
  const normalizedQuestion = typeof row.normalizedQuestion === "string" ? row.normalizedQuestion.trim() : ""
  const responseDepth = row.responseDepth as DnaS13Depth
  if (normalizedQuestion.length < 2 || normalizedQuestion.length > 600) return null
  if (!DNA_S13_DEPTHS.includes(responseDepth)) return null
  if (typeof row.uncertain !== "boolean") return null
  if (!Array.isArray(row.subquestions) || row.subquestions.length < 1 || row.subquestions.length > 2) return null

  const allowed = new Set([...allowedTopicIds, "unknown", "conversation.social", "product.help", "safety.refusal"])
  const parsed: DnaS13Subquestion[] = []
  for (let index = 0; index < row.subquestions.length; index += 1) {
    const raw = row.subquestions[index]
    if (!raw || typeof raw !== "object") return null
    const item = raw as Record<string, unknown>
    const id = typeof item.id === "string" ? item.id.trim() : ""
    const question = typeof item.question === "string" ? item.question.trim() : ""
    const intent = item.intent as DnaS13Intent
    const topicId = typeof item.topicId === "string" ? item.topicId.trim() : ""
    const focus = item.focus as DnaS13Focus
    const questionType = item.questionType as DnaS13QuestionType
    const answerabilityHint = item.answerabilityHint as DnaS13Answerability
    const targets = stringArray(item.comparisonTargetTopicIds, 2)
    const requestedFacets = stringArray(item.requestedFacets ?? [], 4) as DnaS13RequestedFacet[] | null
    if (id !== `q${index + 1}` || question.length < 2 || question.length > 400) return null
    if (!DNA_S13_INTENTS.includes(intent) || !allowed.has(topicId)) return null
    if (!DNA_S13_FOCUS_VALUES.includes(focus) || !DNA_S13_QUESTION_TYPES.includes(questionType)) return null
    if (!DNA_S13_ANSWERABILITY.includes(answerabilityHint) || targets === null || requestedFacets === null) return null
    if (requestedFacets.some((facet) => !DNA_S13_REQUESTED_FACETS.includes(facet))) return null
    if (targets.some((target) => !allowed.has(target))) return null
    if (typeof item.followUp !== "boolean" || typeof item.correction !== "boolean") return null
    if (questionType === "comparison" && targets.length < 2) return null
    if (questionType !== "comparison" && targets.length > 0) return null
    parsed.push(Object.freeze({
      id,
      question,
      intent,
      topicId,
      focus,
      questionType,
      followUp: item.followUp,
      correction: item.correction,
      comparisonTargetTopicIds: Object.freeze(targets),
      answerabilityHint,
      requestedFacets: Object.freeze(requestedFacets),
    }))
  }

  return Object.freeze({
    version: DNA_S13_QUERY_FRAME_VERSION,
    normalizedQuestion,
    responseDepth,
    uncertain: row.uncertain,
    subquestions: Object.freeze(parsed),
  })
}

export function validateDnaS13Realization(candidate: unknown): DnaS13Realization | null {
  if (!candidate || typeof candidate !== "object") return null
  const row = candidate as Record<string, unknown>
  const answer = typeof row.answer === "string" ? row.answer.trim() : ""
  const coveredSlots = stringArray(row.coveredSlots, 8)
  const usedClaimIds = stringArray(row.usedClaimIds, 12)
  const usedSourceIds = stringArray(row.usedSourceIds, 12)
  if (answer.length < 2 || answer.length > 6_000) return null
  if (!coveredSlots || !usedClaimIds || !usedSourceIds || typeof row.unsupportedAddition !== "boolean") return null
  return Object.freeze({
    version: DNA_S13_REALIZATION_VERSION,
    answer,
    coveredSlots: Object.freeze(coveredSlots),
    usedClaimIds: Object.freeze(usedClaimIds),
    usedSourceIds: Object.freeze(usedSourceIds),
    unsupportedAddition: row.unsupportedAddition,
  })
}

export function sameDnaS13SemanticSignature(left: string, right: string) {
  const tokens = (value: string) => new Set(normalizeDnaChatText(value).split(" ").filter((token) => token.length >= 3))
  const a = tokens(left)
  const b = tokens(right)
  const intersection = [...a].filter((token) => b.has(token)).length
  const union = new Set([...a, ...b]).size
  return union > 0 && intersection / union >= 0.9
}

const PRESERVED_AGE_MARKERS = ["bebek", "cocuk", "ergen", "yetiskin", "yasli", "okul oncesi"] as const
const PRESERVED_NEGATION_MARKERS = ["degil", "yok", "olamaz", "kanitlamaz", "gostermez", "cikarilamaz"] as const
const PRESERVED_CLINICAL_MARKERS = ["tani", "tedavi", "ilac", "doz", "prognoz", "seans plani"] as const

function preservedSignature(value: string, markers: readonly string[]) {
  const normalized = normalizeDnaChatText(value)
  return markers.filter((marker) => normalized.includes(normalizeDnaChatText(marker))).sort()
}

export function preservesDnaS13QuestionMeaning(original: string, frame: DnaS13QueryFrame) {
  const combined = `${frame.normalizedQuestion} ${frame.subquestions.map((entry) => entry.question).join(" ")}`
  const originalNumbers = [...new Set(original.match(/\b\d+(?:[.,]\d+)?\b/g) ?? [])].sort()
  const combinedNumbers = [...new Set(combined.match(/\b\d+(?:[.,]\d+)?\b/g) ?? [])].sort()
  if (originalNumbers.join("|") !== combinedNumbers.join("|")) return false
  for (const markers of [PRESERVED_AGE_MARKERS, PRESERVED_NEGATION_MARKERS, PRESERVED_CLINICAL_MARKERS] as const) {
    if (preservedSignature(original, markers).join("|") !== preservedSignature(combined, markers).join("|")) return false
  }
  return true
}

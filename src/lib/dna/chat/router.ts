import { DNA_CHAT_INTENT_BY_ID, DNA_CHAT_INTENTS } from "./intents"
import { normalizeDnaChatText, scoreDnaTextMatch, type DnaTextMatch } from "./text"
import type {
  DnaChatIntentDefinition,
  DnaChatMode,
  DnaChatRoute,
} from "./types"

export type DnaChatRouteResult = {
  route: DnaChatRoute
  intent: DnaChatIntentDefinition | null
  match: Omit<DnaTextMatch, "method"> & { method: DnaTextMatch["method"] | "context" }
  threshold: number
  runnerUpScore: number
  ambiguityGap: number
  candidateTopics: string[]
  routeScores: Record<DnaChatRoute, number>
}

const ROUTE_SIGNALS: Record<Exclude<DnaChatRoute, "unknown">, readonly string[]> = {
  theory: [
    "nedir",
    "ne demek",
    "acikla",
    "literatur",
    "bilimsel",
    "self regulasyon",
    "es regulasyon",
  ],
  dna: [
    "dna degerlendirmesi",
    "dna raporu",
    "dna puanlama",
    "dna soru",
    "bu arac",
    "mahremiyet",
  ],
  case: [
    "bu vaka",
    "vakayi",
    "vakanin",
    "vaka skoru",
    "anamnez",
    "gozlem",
    "bulgu",
    "puanlari ozetle",
    "skoru yorumla",
  ],
}

const CONTINUATION_PATTERNS = [
  "biraz daha acikla",
  "bunu acikla",
  "peki bu alan",
  "devam",
  "devam et",
  "daha ayrintili",
  "bunun anlami ne",
] as const

const CROSS_DOMAIN_FOLLOW_UP_PATTERNS = [
  "bu kavram dna alanlariyla nasil iliskilidir",
  "dna alanlariyla nasil iliskilidir",
] as const

const FUNCTIONAL_FOLLOW_UP_PATTERNS = [
  "bir ornek ver",
  "ornek verir misin",
  "uygulamadaki karsiligi ne",
  "gunluk yasamdaki karsiligi ne",
] as const

const GENERIC_LITERATURE_QUESTIONS = new Set([
  "literatur ne diyor",
  "bilimsel dayanagi nedir",
  "bilimsel kaynaklari goster",
  "bilimsel kaynaklari gosterir misin",
  "bilimsel kaynaklari gosterebilir misin",
  "kaynaklari goster",
  "kanit duzeyi nedir",
])

function includesPhrase(normalized: string, patterns: readonly string[]): boolean {
  return patterns.some(
    (pattern) => normalized === pattern || ` ${normalized} `.includes(` ${pattern} `),
  )
}

function hasRouteSignal(question: string, route: Exclude<DnaChatRoute, "unknown">): boolean {
  const normalized = normalizeDnaChatText(question)
  return ROUTE_SIGNALS[route].some((signal) => normalized.includes(signal))
}

function emptyMatch(): DnaChatRouteResult["match"] {
  return {
    score: 0,
    method: "none",
    tokenScore: 0,
    ngramScore: 0,
    pattern: null,
  }
}

function contextRouteResult(
  intent: DnaChatIntentDefinition,
  pattern: string,
  routeScores: Record<DnaChatRoute, number>,
): DnaChatRouteResult {
  routeScores[intent.route] = 0.9
  return {
    route: intent.route,
    intent,
    match: {
      score: 0.9,
      method: "context",
      tokenScore: 0,
      ngramScore: 0,
      pattern,
    },
    threshold: intent.threshold,
    runnerUpScore: 0,
    ambiguityGap: 0.9,
    candidateTopics: [intent.labelTr],
    routeScores,
  }
}

function expandedTheoryIntent(intent: DnaChatIntentDefinition): DnaChatIntentDefinition {
  if (intent.route !== "theory" || intent.sourceIds.length < 2) return intent
  return {
    ...intent,
    sourceIds: [...intent.sourceIds.slice(1), intent.sourceIds[0]],
  }
}

function topicLiteratureIntent(intent: DnaChatIntentDefinition): DnaChatIntentDefinition {
  const literature = DNA_CHAT_INTENT_BY_ID.get("theory_literature")
  if (!literature) return intent
  const sourceIds = [...new Set([
    ...intent.sourceIds,
    ...literature.sourceIds,
  ])]
  return {
    ...intent,
    id: `theory_literature_context:${intent.id}`,
    labelTr: intent.labelTr,
    sourceIds: [
      ...sourceIds.filter((sourceId) => sourceId.startsWith("lit:")),
      ...sourceIds.filter((sourceId) => !sourceId.startsWith("lit:")),
    ],
  }
}

const MATCH_METHOD_PRIORITY: Record<DnaTextMatch["method"], number> = {
  exact: 3,
  phrase: 2,
  weighted: 1,
  none: 0,
}

export function routeDnaChatQuestion(input: {
  question: string
  mode?: DnaChatMode
  previousTopic?: string | null
  hasCaseContext?: boolean
}): DnaChatRouteResult {
  const routeScores: Record<DnaChatRoute, number> = {
    theory: 0,
    dna: 0,
    case: 0,
    unknown: 0,
  }
  const normalized = normalizeDnaChatText(input.question)
  const previous = input.previousTopic
    ? DNA_CHAT_INTENT_BY_ID.get(input.previousTopic) ??
      DNA_CHAT_INTENTS.find(
        (intent) => normalizeDnaChatText(intent.labelTr) === normalizeDnaChatText(input.previousTopic ?? ""),
      )
    : null
  const previousMatchesMode = Boolean(
    previous && (!input.mode || input.mode === previous.route),
  )
  const continuation = includesPhrase(normalized, CONTINUATION_PATTERNS)

  if ((!input.mode || input.mode === "theory") && GENERIC_LITERATURE_QUESTIONS.has(normalized)) {
    if (previous?.route === "theory" && previousMatchesMode) {
      return contextRouteResult(
        topicLiteratureIntent(previous),
        input.previousTopic ?? normalized,
        routeScores,
      )
    }
    const literature = DNA_CHAT_INTENT_BY_ID.get("theory_literature")
    if (literature) {
      routeScores.theory = 0.7
      return {
        route: "theory",
        intent: literature,
        match: {
          score: 0.7,
          method: "weighted",
          tokenScore: 0.7,
          ngramScore: 0.7,
          pattern: normalized,
        },
        threshold: literature.threshold,
        runnerUpScore: 0,
        ambiguityGap: 0.7,
        candidateTopics: ["Self-regülasyon", "İnterosepsiyon"],
        routeScores,
      }
    }
  }

  if (previous?.route === "theory" && previousMatchesMode) {
    if (includesPhrase(normalized, CROSS_DOMAIN_FOLLOW_UP_PATTERNS)) {
      const crossDomain = DNA_CHAT_INTENT_BY_ID.get("theory_cross_domain")
      if (crossDomain) {
        return contextRouteResult(crossDomain, input.previousTopic ?? normalized, routeScores)
      }
    }
    if (includesPhrase(normalized, FUNCTIONAL_FOLLOW_UP_PATTERNS)) {
      const functional = DNA_CHAT_INTENT_BY_ID.get("theory_functional_context")
      if (functional) {
        return contextRouteResult(functional, input.previousTopic ?? normalized, routeScores)
      }
    }
  }

  if (previous && continuation && previousMatchesMode) {
    return contextRouteResult(
      expandedTheoryIntent(previous),
      input.previousTopic ?? normalized,
      routeScores,
    )
  }

  const candidates = DNA_CHAT_INTENTS
    .filter((intent) => !input.mode || intent.route === input.mode)
    .map((intent) => {
      const match = scoreDnaTextMatch(input.question, intent.patterns)
      let adjustedScore = match.score
      if (input.mode === intent.route) adjustedScore += 0.035
      if (hasRouteSignal(input.question, intent.route)) adjustedScore += 0.025
      if (intent.route === "case" && input.hasCaseContext) adjustedScore += 0.015
      adjustedScore = Math.min(1, Number(adjustedScore.toFixed(6)))
      routeScores[intent.route] = Math.max(routeScores[intent.route], adjustedScore)
      return { intent, match: { ...match, score: adjustedScore } }
    })
    .sort(
      (left, right) =>
        MATCH_METHOD_PRIORITY[right.match.method] - MATCH_METHOD_PRIORITY[left.match.method] ||
        right.match.score - left.match.score ||
        left.intent.id.localeCompare(right.intent.id),
    )

  const best = candidates[0]
  if (!best || best.match.score < best.intent.threshold) {
    routeScores.unknown = Math.max(0, Number((1 - (best?.match.score ?? 0)).toFixed(6)))
    return {
      route: "unknown",
      intent: null,
      match: best?.match ?? emptyMatch(),
      threshold: best?.intent.threshold ?? 0.5,
      runnerUpScore: candidates[1]?.match.score ?? 0,
      ambiguityGap: Number(
        ((best?.match.score ?? 0) - (candidates[1]?.match.score ?? 0)).toFixed(6),
      ),
      candidateTopics: candidates.slice(0, 2).map((candidate) => candidate.intent.labelTr),
      routeScores,
    }
  }

  return {
    route: best.intent.route,
    intent: best.intent,
    match: best.match,
    threshold: best.intent.threshold,
    runnerUpScore: candidates[1]?.match.score ?? 0,
    ambiguityGap: Number((best.match.score - (candidates[1]?.match.score ?? 0)).toFixed(6)),
    candidateTopics: candidates.slice(0, 2).map((candidate) => candidate.intent.labelTr),
    routeScores,
  }
}

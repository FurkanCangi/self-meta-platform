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
  "devam et",
  "daha ayrintili",
  "bunun anlami ne",
] as const

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
  const continuation = CONTINUATION_PATTERNS.some((pattern) => normalized.includes(pattern))

  if (previous && continuation && (!input.mode || input.mode === previous.route)) {
    routeScores[previous.route] = 0.9
    return {
      route: previous.route,
      intent: previous,
      match: {
        score: 0.9,
        method: "context",
        tokenScore: 0,
        ngramScore: 0,
        pattern: input.previousTopic ?? null,
      },
      threshold: previous.threshold,
      runnerUpScore: 0,
      ambiguityGap: 0.9,
      candidateTopics: [previous.labelTr],
      routeScores,
    }
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

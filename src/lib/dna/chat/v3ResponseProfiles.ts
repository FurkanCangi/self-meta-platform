import { normalizeDnaChatText } from "./text"

export const DNA_V3_RESPONSE_DEPTHS = Object.freeze([
  "short",
  "standard",
  "deep",
] as const)

export type DnaV3ResponseDepth = (typeof DNA_V3_RESPONSE_DEPTHS)[number]

export type DnaV3ResponseDepthSpec = Readonly<{
  maxSources: 2 | 4 | 8
  maxScientificUnits: 1 | 4 | 12
  requiredSections: readonly string[]
}>

export const DNA_V3_RESPONSE_DEPTH_SPEC: Readonly<
  Record<DnaV3ResponseDepth, DnaV3ResponseDepthSpec>
> = Object.freeze({
  short: Object.freeze({
    maxSources: 2,
    maxScientificUnits: 1,
    requiredSections: Object.freeze(["definition", "boundary"]),
  }),
  standard: Object.freeze({
    maxSources: 4,
    maxScientificUnits: 4,
    requiredSections: Object.freeze([
      "summary",
      "function_or_relation",
      "evidence_boundary",
      "dna_boundary",
    ]),
  }),
  deep: Object.freeze({
    maxSources: 8,
    maxScientificUnits: 12,
    requiredSections: Object.freeze([
      "definition",
      "function_or_mechanism",
      "development",
      "measurement",
      "evidence_status",
      "counter_evidence",
      "dna_boundary",
      "case_context",
    ]),
  }),
})

const SHORT_CUES = [
  /\b(?:kisaca|kisa anlat|kisa acikla|tek cumle|ozetle|cok uzatma|uzatmadan)\b/,
] as const

const DEEP_CUES = [
  /\b(?:detayli|ayrintili|derinlemesine|kapsamli|tum yonleriyle)\b/,
  /\b(?:kanitlariyla|kaynaklariyla|literaturuyle|calismalariyla)\b/,
] as const

/**
 * Resolves the presentation depth without changing retrieval authority.
 * A clear natural-language cue overrides the UI selection. Conflicting cues
 * fail to the bounded standard profile; they never expand the evidence set.
 */
export function resolveDnaV3ResponseDepth(
  question: string,
  requested?: DnaV3ResponseDepth | null,
): DnaV3ResponseDepth {
  const normalized = normalizeDnaChatText(question)
  const asksShort = SHORT_CUES.some((pattern) => pattern.test(normalized))
  const asksDeep = DEEP_CUES.some((pattern) => pattern.test(normalized))
  if (asksShort && asksDeep) return "standard"
  if (asksShort) return "short"
  if (asksDeep) return "deep"
  return requested && DNA_V3_RESPONSE_DEPTHS.includes(requested)
    ? requested
    : "standard"
}

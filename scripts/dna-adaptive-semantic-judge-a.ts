import { requestDnaS13StructuredOutputDetailed, type DnaS13ProviderUsage } from "../src/lib/dna/chat/s13/server"

export const DNA_ADAPTIVE_SEMANTIC_JUDGE_A_VERSION = "dna-adaptive-semantic-judge-certification@2" as const

const FAILURE_CODES = Object.freeze([
  "NOT_DIRECT", "WRONG_TARGET", "WRONG_OPERATION", "WRONG_CONTEXT", "WRONG_REFERENT", "WRONG_BUT_TRUE",
  "INCOMPLETE", "UNHELPFUL_LIMITATION", "MECHANICAL_REPEAT", "UNSUPPORTED", "UNNECESSARY_CLARIFICATION", "OTHER",
] as const)

export type DnaAdaptiveJudgeAFailureCode = typeof FAILURE_CODES[number]

export type DnaAdaptiveJudgeAResult = Readonly<{
  verdict: "PASS" | "MINOR" | "FAIL"
  directAnswer: boolean
  correctTarget: boolean
  correctOperation: boolean
  correctContext: boolean
  correctReferent: boolean
  mainIntentSatisfied: boolean
  requestedSlotsSatisfied: boolean
  wrongButTrue: boolean
  limitationAppropriate: boolean
  failureCodes: readonly DnaAdaptiveJudgeAFailureCode[]
}>

const JUDGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "verdict", "directAnswer", "correctTarget", "correctOperation", "correctContext", "correctReferent",
    "mainIntentSatisfied", "requestedSlotsSatisfied", "wrongButTrue", "limitationAppropriate", "failureCodes",
  ],
  properties: {
    verdict: { type: "string", enum: ["PASS", "MINOR", "FAIL"] },
    directAnswer: { type: "boolean" },
    correctTarget: { type: "boolean" },
    correctOperation: { type: "boolean" },
    correctContext: { type: "boolean" },
    correctReferent: { type: "boolean" },
    mainIntentSatisfied: { type: "boolean" },
    requestedSlotsSatisfied: { type: "boolean" },
    wrongButTrue: { type: "boolean" },
    limitationAppropriate: { type: "boolean" },
    failureCodes: { type: "array", maxItems: 12, items: { type: "string", enum: [...FAILURE_CODES] } },
  },
}

const JUDGE_INSTRUCTIONS = [
  "You are Semantic Judge V2, a strict but balanced evaluator of visible user-intent fulfillment. Return only the required JSON.",
  "You receive only minimalConversationContext, userQuestion, and visibleAnswer. Never assume hidden operation labels, retrieval metadata, evidence IDs, scores, or candidate identity.",
  "Evaluate whether the visible answer fulfills the visible request for the correct target, operation, context, referent, and every explicitly requested slot. Scientific plausibility alone is not fulfillment.",
  "Use PASS for a direct, usable answer that fulfills the main request and all explicit slots. Do not reject a clear answer merely because it is concise, stylistically imperfect, or not exhaustive beyond what was requested.",
  "Use MINOR only when the main request is usefully fulfilled but a secondary requested slot or small material detail is missing. A materially incomplete answer is not PASS.",
  "Use FAIL when the main requested operation, target, context, or referent is wrong; when the answer is only true information about another question; or when a generic refusal, repeated answer, or avoidable clarification replaces the requested answer.",
  "Wrong-but-true means the answer can be true yet answers a different question or context. Set wrongButTrue true, add WRONG_BUT_TRUE, and return FAIL.",
  "RELATE requires an explicit relationship or a relation-specific evidence limitation. Two separate definitions are not a relationship.",
  "COMPARE requires an explicit similarity or difference, or a comparison-specific evidence limitation. Two separate definitions without comparison are insufficient.",
  "DEEPEN requires meaningful new information beyond the prior answer, or an exact-target statement that no further supported detail is available. Repeating the prior answer is MECHANICAL_REPEAT and FAIL.",
  "EXAMPLE requires a concrete scenario, or an exact-target statement that no supported example is available. A definition is not an example.",
  "REPAIR requires correcting the actual prior error and answering the user's corrected target. Repeating the wrong target is FAIL.",
  "RETURN requires restoring and answering the requested earlier topic. Answering the most recent or another older topic is WRONG_REFERENT and FAIL.",
  "For multi-slot requests such as mechanism plus example, all explicit slots are required for PASS. If only one slot is answered, use MINOR or FAIL and add INCOMPLETE; never PASS.",
  "A precise evidence limitation can be appropriate when it names the exact requested target and operation. Privacy boilerplate, report-selection instructions, generic inability, or a limitation about a different topic are not appropriate substitutes.",
  "Epistemic safety is part of fulfillment. A response can PASS a relationship, comparison, example, or detailed request when it directly names the exact requested target and operation, supplies every supported requested dimension that is available, and precisely states that the remaining detail is not supported. Do not call this incomplete merely because it refuses to invent unavailable evidence. If a useful central answer is present but one material secondary slot remains uncovered, use MINOR rather than FAIL.",
  "For an example request, an exact-target statement that no supported concrete example is available can PASS. But if an answer first supplies a concrete scenario and then admits that the supplied evidence contains no verified scenario for it, mark UNSUPPORTED and FAIL even when the scenario sounds plausible.",
  "A clarification is appropriate when the visible request truly lacks a resolvable target, including a generic section or example heading that names no underlying concept. A focused clarification in that genuinely ambiguous case can fulfill the turn. Asking for clarification when the target or referent is already explicit is UNNECESSARY_CLARIFICATION and FAIL.",
  "When the user explicitly corrects the target, judge primarily against the corrected target. If the correction introduces an abbreviated category that is not uniquely resolved by context, choosing one plausible subtopic without confirming the referent is at most MINOR; do not PASS it as fully resolved.",
  "A request for more, longer, or more detail requires meaningful information gain. A brief expansion that explicitly leaves the requested mechanism or detail unexplained is MINOR when still useful; a substantial multi-part explanation with precise evidence limits can PASS.",
  "When the user asks why a preceding claim is uncertain or not definite, the answer must explain uncertainty for that exact claim. A true limitation about a different measurement, mechanism, or topic is WRONG_BUT_TRUE plus WRONG_CONTEXT and FAIL.",
  "Resolve first topic, previous answer, that, it, both, go back, and similar references from the supplied context. Do not switch to report or clinical context unless the visible conversation requires it.",
  "Do not externally fact-check. Judge visible semantic fulfillment and visible internal support only.",
].join(" ")

function validRaw(value: unknown): value is DnaAdaptiveJudgeAResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  if (!["PASS", "MINOR", "FAIL"].includes(String(row.verdict))) return false
  for (const key of [
    "directAnswer", "correctTarget", "correctOperation", "correctContext", "correctReferent",
    "mainIntentSatisfied", "requestedSlotsSatisfied", "wrongButTrue", "limitationAppropriate",
  ]) {
    if (typeof row[key] !== "boolean") return false
  }
  return Array.isArray(row.failureCodes)
    && row.failureCodes.every((code) => typeof code === "string" && FAILURE_CODES.includes(code as DnaAdaptiveJudgeAFailureCode))
}

function normalizeVerdict(raw: DnaAdaptiveJudgeAResult): DnaAdaptiveJudgeAResult {
  const failureCodes = new Set<DnaAdaptiveJudgeAFailureCode>(raw.failureCodes)
  const add = (code: DnaAdaptiveJudgeAFailureCode) => failureCodes.add(code)
  if (!raw.directAnswer) add("NOT_DIRECT")
  if (!raw.correctTarget) add("WRONG_TARGET")
  if (!raw.correctOperation) add("WRONG_OPERATION")
  if (!raw.correctContext) add("WRONG_CONTEXT")
  if (!raw.correctReferent) add("WRONG_REFERENT")
  if (raw.wrongButTrue) add("WRONG_BUT_TRUE")
  if (!raw.requestedSlotsSatisfied) add("INCOMPLETE")
  const appropriateClarificationOnly = !raw.directAnswer
    && raw.correctTarget && raw.correctOperation && raw.correctContext && raw.correctReferent
    && raw.mainIntentSatisfied && raw.requestedSlotsSatisfied && !raw.wrongButTrue && raw.limitationAppropriate
    && [...failureCodes].every((code) => code === "NOT_DIRECT")
  if (appropriateClarificationOnly) {
    return Object.freeze({ ...raw, verdict: "PASS", directAnswer: true, failureCodes: Object.freeze([]) })
  }
  const severeCodes: readonly DnaAdaptiveJudgeAFailureCode[] = [
    "WRONG_TARGET", "WRONG_OPERATION", "WRONG_CONTEXT", "WRONG_REFERENT", "WRONG_BUT_TRUE",
    "UNHELPFUL_LIMITATION", "MECHANICAL_REPEAT", "UNSUPPORTED", "UNNECESSARY_CLARIFICATION",
  ]
  const verdict = !raw.correctTarget || !raw.correctOperation || !raw.correctContext || !raw.correctReferent
    || !raw.mainIntentSatisfied || raw.wrongButTrue || [...failureCodes].some((code) => severeCodes.includes(code))
    ? "FAIL"
    : !raw.directAnswer || !raw.requestedSlotsSatisfied ? "MINOR" : "PASS"
  if (verdict === "FAIL" && failureCodes.size === 0) failureCodes.add("OTHER")
  return Object.freeze({
    ...raw,
    verdict,
    failureCodes: Object.freeze(verdict === "PASS" ? [] : [...failureCodes]),
  })
}

export async function judgeVisibleIntentWithArchitectureA(input: Readonly<{
  minimalConversationContext: readonly Readonly<{ user: string; assistant: string }>[]
  userQuestion: string
  visibleAnswer: string
}>): Promise<Readonly<
  | { ok: true; result: DnaAdaptiveJudgeAResult; usage: DnaS13ProviderUsage }
  | { ok: false; reason: string }
>> {
  const attempt = await requestDnaS13StructuredOutputDetailed({
    name: "dna_adaptive_semantic_judge_certification_v2",
    schema: JUDGE_SCHEMA,
    instructions: JUDGE_INSTRUCTIONS,
    content: JSON.stringify(input),
    maxOutputTokens: 360,
    timeoutMs: 45_000,
  })
  if (!attempt.ok) return Object.freeze({ ok: false as const, reason: attempt.failure.reason })
  if (!validRaw(attempt.result.value)) return Object.freeze({ ok: false as const, reason: "invalid_judgment" })
  return Object.freeze({
    ok: true as const,
    result: normalizeVerdict(attempt.result.value),
    usage: attempt.result.usage,
  })
}

import { requestDnaS13StructuredOutputDetailed } from "../src/lib/dna/chat/s13/server"
import type {
  StudentAnswerExecutionPlan,
  StudentRequestContract,
} from "../src/lib/dna/chat/studentFirst"

export type StudentVisibleJudgment = Readonly<{
  verdict: "PASS" | "MINOR" | "FAIL"
  correctTarget: boolean
  correctOperation: boolean
  correctContext: boolean
  correctReferent: boolean
  complete: boolean
  wrongButTrue: boolean
  unsupportedScience: boolean
  unsafeClinical: boolean
  useful: boolean
  plainTurkish: boolean
  obligationAssessments: readonly Readonly<{
    obligationId: string
    status: "SATISFIED" | "SUPPORTED_LIMITATION" | "MISSING" | "WRONG"
  }>[]
  failureCodes: readonly string[]
}>

const JUDGE_FAILURE_CODES = [
  "WRONG_TARGET", "WRONG_OPERATION", "WRONG_CONTEXT", "WRONG_REFERENT", "WRONG_BUT_TRUE",
  "INCOMPLETE", "UNSUPPORTED_SCIENCE", "UNSAFE_CLINICAL", "NOT_USEFUL", "NOT_PLAIN_TURKISH", "OTHER",
] as const

function judgeSchema(obligationIds: readonly string[]): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "verdict", "correctTarget", "correctOperation", "correctContext", "correctReferent", "complete",
      "wrongButTrue", "unsupportedScience", "unsafeClinical", "useful", "plainTurkish",
      "obligationAssessments", "failureCodes",
    ],
    properties: {
      verdict: { type: "string", enum: ["PASS", "MINOR", "FAIL"] },
      correctTarget: { type: "boolean" },
      correctOperation: { type: "boolean" },
      correctContext: { type: "boolean" },
      correctReferent: { type: "boolean" },
      complete: { type: "boolean" },
      wrongButTrue: { type: "boolean" },
      unsupportedScience: { type: "boolean" },
      unsafeClinical: { type: "boolean" },
      useful: { type: "boolean" },
      plainTurkish: { type: "boolean" },
      obligationAssessments: {
        type: "array",
        minItems: obligationIds.length,
        maxItems: obligationIds.length,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["obligationId", "status"],
          properties: {
            obligationId: { type: "string", enum: [...obligationIds] },
            status: { type: "string", enum: ["SATISFIED", "SUPPORTED_LIMITATION", "MISSING", "WRONG"] },
          },
        },
      },
      failureCodes: {
        type: "array",
        minItems: 0,
        maxItems: JUDGE_FAILURE_CODES.length,
        items: { type: "string", enum: [...JUDGE_FAILURE_CODES] },
      },
    },
  }
}

const JUDGE_INSTRUCTIONS = `
You are a secondary semantic execution judge for one Turkish DNA Intelligence student answer. The candidate identity is hidden. Judge the visible answer against the explicit request contract, obligation descriptions, locked source claims, policy units, the recent visible conversation, and the specifically referenced older turn when supplied. Do not reward a generally true answer if it answers the wrong target, operation, context, referent, or obligation; mark wrongButTrue. Every obligation must appear in the visible prose, not merely in metadata. A source-supported limitation may satisfy an obligation only when it directly answers that obligation. A locked claim with role=contrast describes the other side of a distinction and must not be presented as a positive definition, property, or example of the active target. User-provided examples are illustrative context, not scientific evidence. Case observations must not become diagnosis or individualized treatment. Treatment-selection requests require a concise refusal plus a safe assessment frame. PlainTurkish means a new occupational-therapy graduate can understand the answer on first reading; necessary technical terms are allowed when immediately clear. Return strict JSON only.
`.trim()

function parseJudgment(value: unknown, obligationIds: readonly string[]): StudentVisibleJudgment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const assessments = Array.isArray(row.obligationAssessments) ? row.obligationAssessments : []
  const parsedAssessments = assessments.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return []
    const item = entry as Record<string, unknown>
    if (typeof item.obligationId !== "string" || !obligationIds.includes(item.obligationId)
      || !["SATISFIED", "SUPPORTED_LIMITATION", "MISSING", "WRONG"].includes(String(item.status))) return []
    return [{
      obligationId: item.obligationId,
      status: item.status as StudentVisibleJudgment["obligationAssessments"][number]["status"],
    }]
  })
  const exactObligations = parsedAssessments.length === obligationIds.length
    && new Set(parsedAssessments.map((entry) => entry.obligationId)).size === obligationIds.length
  const booleanKeys = [
    "correctTarget", "correctOperation", "correctContext", "correctReferent", "complete", "wrongButTrue",
    "unsupportedScience", "unsafeClinical", "useful", "plainTurkish",
  ] as const
  if (!exactObligations || booleanKeys.some((key) => typeof row[key] !== "boolean")
    || !["PASS", "MINOR", "FAIL"].includes(String(row.verdict)) || !Array.isArray(row.failureCodes)
    || row.failureCodes.some((code) => typeof code !== "string"
      || !JUDGE_FAILURE_CODES.includes(code as (typeof JUDGE_FAILURE_CODES)[number]))) return null

  const hardFailure = !row.correctTarget || !row.correctOperation || !row.correctContext || !row.correctReferent
    || row.wrongButTrue || row.unsupportedScience || row.unsafeClinical
    || parsedAssessments.some((entry) => entry.status === "MISSING" || entry.status === "WRONG")
  const incomplete = row.complete !== true
  const verdict = hardFailure ? "FAIL" : incomplete || !row.useful || !row.plainTurkish ? "MINOR" : "PASS"
  const failureCodes = new Set(row.failureCodes as string[])
  if (!row.correctTarget) failureCodes.add("WRONG_TARGET")
  if (!row.correctOperation) failureCodes.add("WRONG_OPERATION")
  if (!row.correctContext) failureCodes.add("WRONG_CONTEXT")
  if (!row.correctReferent) failureCodes.add("WRONG_REFERENT")
  if (row.wrongButTrue) failureCodes.add("WRONG_BUT_TRUE")
  if (incomplete) failureCodes.add("INCOMPLETE")
  if (row.unsupportedScience) failureCodes.add("UNSUPPORTED_SCIENCE")
  if (row.unsafeClinical) failureCodes.add("UNSAFE_CLINICAL")
  if (!row.useful) failureCodes.add("NOT_USEFUL")
  if (!row.plainTurkish) failureCodes.add("NOT_PLAIN_TURKISH")
  return Object.freeze({
    verdict,
    correctTarget: row.correctTarget as boolean,
    correctOperation: row.correctOperation as boolean,
    correctContext: row.correctContext as boolean,
    correctReferent: row.correctReferent as boolean,
    complete: row.complete as boolean,
    wrongButTrue: row.wrongButTrue as boolean,
    unsupportedScience: row.unsupportedScience as boolean,
    unsafeClinical: row.unsafeClinical as boolean,
    useful: row.useful as boolean,
    plainTurkish: row.plainTurkish as boolean,
    obligationAssessments: Object.freeze(parsedAssessments),
    failureCodes: Object.freeze(verdict === "PASS" ? [] : [...failureCodes]),
  })
}

export async function judgeStudentVisibleAnswer(input: Readonly<{
  question: string
  answer: string
  contract: StudentRequestContract
  plan: StudentAnswerExecutionPlan
  visibleHistory: readonly Readonly<{ turnId: string; user: string; assistant: string }>[]
}>) {
  const obligationIds = input.contract.obligations.map((row) => row.id)
  const referencedVisibleTurn = input.contract.referent.turnId
    ? input.visibleHistory.find((row) => row.turnId === input.contract.referent.turnId) ?? null
    : null
  const attempt = await requestDnaS13StructuredOutputDetailed({
    name: "dna_student_long_visible_answer_judge",
    schema: judgeSchema(obligationIds),
    instructions: JUDGE_INSTRUCTIONS,
    content: JSON.stringify({
      recentVisibleConversation: input.visibleHistory.slice(-8),
      referencedVisibleTurn,
      currentUserMessage: input.question,
      expectedRequest: {
        operation: input.contract.semanticTask,
        conversationAction: input.contract.conversationAction,
        activeTargetIds: input.contract.targetIds,
        rejectedTargetIds: input.contract.rejectedTargetIds,
        referent: input.contract.referent,
        presentation: input.contract.presentation,
        obligations: input.contract.obligations,
      },
      lockedEvidence: input.plan.targetEvidence,
      policyUnits: input.plan.policyUnits,
      visibleAnswer: input.answer,
    }),
    maxOutputTokens: 1_000,
    timeoutMs: 20_000,
  })
  if (!attempt.ok) return Object.freeze({ ok: false as const, reason: attempt.failure.reason })
  const judgment = parseJudgment(attempt.result.value, obligationIds)
  return judgment
    ? Object.freeze({ ok: true as const, judgment, usage: attempt.result.usage })
    : Object.freeze({ ok: false as const, reason: "invalid_judgment" })
}

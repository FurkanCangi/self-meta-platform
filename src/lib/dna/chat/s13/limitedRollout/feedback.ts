export const DNA_S13_LIMITED_FEEDBACK_VERSION = "dna-s13-limited-rollout-feedback@1" as const

export const DNA_S13_LIMITED_FEEDBACK_REASONS = Object.freeze([
  "wrong_information",
  "misunderstood",
  "incomplete",
  "too_short",
  "too_long",
  "unnatural",
  "other",
] as const)

export type DnaS13LimitedFeedbackReason = typeof DNA_S13_LIMITED_FEEDBACK_REASONS[number]
export type DnaS13LimitedFeedbackVote = "up" | "down"

export type DnaS13LimitedFeedbackRecord = Readonly<{
  schemaVersion: typeof DNA_S13_LIMITED_FEEDBACK_VERSION
  requestId: string
  createdAt: string
  subjectIdHash: string
  vote: DnaS13LimitedFeedbackVote
  reason: DnaS13LimitedFeedbackReason | null
  containsFreeText: false
  automaticTrainingUse: "prohibited"
}>

const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const HASH = /^[a-f0-9]{64}$/u

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

export function buildDnaS13LimitedFeedbackRecord(input: unknown, subjectIdHash: string) {
  if (!isRecord(input) || Object.keys(input).some((key) => !["requestId", "vote", "reason"].includes(key))) return null
  const requestId = typeof input.requestId === "string" ? input.requestId : ""
  const vote = input.vote === "up" || input.vote === "down" ? input.vote : null
  const reason = input.reason === undefined || input.reason === null
    ? null
    : DNA_S13_LIMITED_FEEDBACK_REASONS.includes(input.reason as DnaS13LimitedFeedbackReason)
      ? input.reason as DnaS13LimitedFeedbackReason
      : undefined
  if (!REQUEST_ID.test(requestId) || !HASH.test(subjectIdHash) || !vote || reason === undefined) return null
  if (vote === "up" && reason !== null) return null
  return Object.freeze({
    schemaVersion: DNA_S13_LIMITED_FEEDBACK_VERSION,
    requestId,
    createdAt: new Date().toISOString(),
    subjectIdHash,
    vote,
    reason,
    containsFreeText: false as const,
    automaticTrainingUse: "prohibited" as const,
  })
}

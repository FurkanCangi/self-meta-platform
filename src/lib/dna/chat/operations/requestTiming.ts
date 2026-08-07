export const DNA_CHAT_REQUEST_TIMING_VERSION = "dna-chat-request-timing@2" as const

export const DNA_CHAT_REQUEST_TIMING_STAGES = Object.freeze([
  "operational_gate",
  "trusted_mutation",
  "authentication",
  "rate_limit",
  "payload",
  "language_interpretation",
  "runtime_resolution",
  "language_polish",
  "report_list",
  "case_answer",
  "audit_write",
] as const)

export type DnaChatRequestTimingStage = (typeof DNA_CHAT_REQUEST_TIMING_STAGES)[number]

export type DnaChatRequestTimingRecord = Readonly<{
  schemaVersion: typeof DNA_CHAT_REQUEST_TIMING_VERSION
  route: "dna-chat"
  status: number
  result: "success" | "client_error" | "server_error"
  requestId: string | null
  totalMs: number
  stagesMs: Readonly<Partial<Record<DnaChatRequestTimingStage, number>>>
}>

type Now = () => number

const SAFE_REQUEST_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{0,159}$/
const MAX_RECORDED_MS = 10 * 60 * 1_000

function defaultNow() {
  return typeof performance !== "undefined" ? performance.now() : Date.now()
}

function boundedMilliseconds(value: number) {
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.min(MAX_RECORDED_MS, Math.round(value * 1000) / 1000)
}

function resultForStatus(status: number): DnaChatRequestTimingRecord["result"] {
  if (status >= 500) return "server_error"
  if (status >= 400) return "client_error"
  return "success"
}

/**
 * Request timing intentionally accepts no user, report, question, answer or
 * clinical fields. It is a short-lived in-memory profiler for server stages;
 * the only emitted identifier is the already public, bounded request ID.
 */
export function createDnaChatRequestTimer(now: Now = defaultNow) {
  const requestStartedAt = now()
  const stageDurations = new Map<DnaChatRequestTimingStage, number>()

  async function measure<T>(stage: DnaChatRequestTimingStage, action: () => Promise<T> | T): Promise<T> {
    const startedAt = now()
    try {
      return await action()
    } finally {
      const duration = boundedMilliseconds(now() - startedAt)
      stageDurations.set(stage, boundedMilliseconds((stageDurations.get(stage) || 0) + duration))
    }
  }

  function complete(input: {
    status: number
    requestId?: string | null
  }): DnaChatRequestTimingRecord {
    const status = Number.isSafeInteger(input.status) && input.status >= 100 && input.status <= 599
      ? input.status
      : 500
    const requestId = typeof input.requestId === "string" && SAFE_REQUEST_ID.test(input.requestId)
      ? input.requestId
      : null
    const stagesMs = Object.freeze(Object.fromEntries(
      DNA_CHAT_REQUEST_TIMING_STAGES
        .filter((stage) => stageDurations.has(stage))
        .map((stage) => [stage, stageDurations.get(stage)]),
    ) as Partial<Record<DnaChatRequestTimingStage, number>>)

    return Object.freeze({
      schemaVersion: DNA_CHAT_REQUEST_TIMING_VERSION,
      route: "dna-chat" as const,
      status,
      result: resultForStatus(status),
      requestId,
      totalMs: boundedMilliseconds(now() - requestStartedAt),
      stagesMs,
    })
  }

  return Object.freeze({ measure, complete })
}

export function shouldLogDnaChatRequestTiming(
  record: DnaChatRequestTimingRecord,
  logAll = process.env.DNA_CHAT_TIMING_LOG_ALL === "1",
) {
  return logAll || record.status >= 500 || record.totalMs >= 1_000
}

import { resolveDnaChat } from "./engine"
import type {
  DnaChatMode,
  DnaChatResponse,
  DnaChatRoute,
  DnaChatSafeCaseContext,
} from "./types"

export type DnaChatApiPayload = {
  question: string
  reportId?: string
  mode?: DnaChatMode
  context?: { previousTopic?: string }
}

export type DnaChatApiAuditInput = {
  requestId: string
  mode: DnaChatMode | DnaChatRoute
  intentId: string | null
  classification: DnaChatResponse["classification"]
  outcome: DnaChatResponse["outcome"]
  engineVersion: string
  intendedUseVersion: string
  sourceIds: string[]
}

export const DNA_CHAT_AUDIT_METADATA_KEYS = Object.freeze([
  "request_id",
  "mode",
  "intent",
  "classification",
  "engine_version",
  "intended_use_version",
  "refused",
  "source_ids",
] as const)

export function buildDnaChatAuditMetadata(input: DnaChatApiAuditInput) {
  return {
    request_id: input.requestId,
    mode: input.mode,
    intent: input.intentId,
    classification: input.classification,
    engine_version: input.engineVersion,
    intended_use_version: input.intendedUseVersion,
    refused: input.classification === "refusal" || input.outcome === "refused",
    source_ids: Array.from(new Set(input.sourceIds.filter(Boolean))).slice(0, 16),
  }
}

export type DnaChatCaseLoadResult =
  | { ok: true; caseContext: DnaChatSafeCaseContext }
  | { ok: false; status: 404 | 500; error: "report_not_found" | "dna_chat_failed" }

export type DnaChatApiResolverDependencies = {
  createRequestId: () => string
  loadCaseContext: (reportId: string) => Promise<DnaChatCaseLoadResult>
  writeAudit: (input: DnaChatApiAuditInput) => Promise<{ ok: boolean }>
}

export type DnaChatApiResolution = {
  status: 200 | 404 | 500 | 503
  body: Record<string, unknown>
  accessedCaseReport: boolean
}

export type DnaChatBodyReadResult =
  | { ok: true; raw: string }
  | { ok: false; error: "invalid_payload" | "payload_too_large" }

export async function readDnaChatRequestBody(
  request: Request,
  maxBytes: number,
): Promise<DnaChatBodyReadResult> {
  const declaredLength = Number(request.headers.get("content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { ok: false, error: "payload_too_large" }
  }

  if (!request.body) return { ok: true, raw: "" }

  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  try {
    reader = request.body.getReader()
    const decoder = new TextDecoder()
    let raw = ""
    let totalBytes = 0

    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      totalBytes += chunk.value.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined)
        return { ok: false, error: "payload_too_large" }
      }
      raw += decoder.decode(chunk.value, { stream: true })
    }

    raw += decoder.decode()
    return { ok: true, raw }
  } catch {
    await reader?.cancel().catch(() => undefined)
    return { ok: false, error: "invalid_payload" }
  }
}

function sourceIdsFromAnswer(answer: DnaChatResponse): string[] {
  return Array.from(new Set(answer.sources.map((source) => source.id).filter(Boolean))).slice(0, 16)
}

function publicAnswer(answer: DnaChatResponse, requestId: string) {
  return {
    ok: true,
    requestId,
    classification: answer.classification,
    summary: answer.summary,
    details: answer.details,
    sources: answer.sources,
    caseEvidence: answer.caseEvidence,
    limitations: answer.limitations,
    safetyBoundary: answer.safetyBoundary,
    intendedUse: answer.intendedUse,
    suggestedQuestions: answer.suggestedQuestions,
    engineVersion: answer.engineVersion,
    topic: answer.topic,
    ...(answer.contextRequest ? { contextRequest: answer.contextRequest } : {}),
    ...(answer.evidenceSummary ? { evidenceSummary: answer.evidenceSummary } : {}),
  }
}

export async function resolveDnaChatApiRequest(
  payload: DnaChatApiPayload,
  dependencies: DnaChatApiResolverDependencies,
): Promise<DnaChatApiResolution> {
  const legacyCaseMode = payload.mode === "case"
  let answer = await resolveDnaChat({
    mode: payload.mode,
    question: payload.question,
    previousTopic: payload.context?.previousTopic || null,
  })

  let accessedCaseReport = false
  const requiresCaseContext = answer.route === "case" || answer.contextRequest?.type === "report"
  if (requiresCaseContext && payload.reportId) {
    const loaded = await dependencies.loadCaseContext(payload.reportId)
    if (!loaded.ok) {
      return {
        status: loaded.status,
        body: { ok: false, error: loaded.error },
        accessedCaseReport: false,
      }
    }

    accessedCaseReport = true
    answer = await resolveDnaChat({
      mode: payload.mode,
      question: payload.question,
      previousTopic: payload.context?.previousTopic || null,
      caseContext: loaded.caseContext,
    })
  }

  const requestId = dependencies.createRequestId()
  const audit = await dependencies.writeAudit({
    requestId,
    mode: answer.route === "unknown"
      ? (legacyCaseMode ? "case" : (payload.mode ?? "unknown"))
      : answer.route,
    intentId: answer.intentId,
    classification: answer.classification,
    outcome: answer.outcome,
    engineVersion: answer.engineVersion,
    intendedUseVersion: answer.intendedUse.version,
    sourceIds: sourceIdsFromAnswer(answer),
  })

  if (!audit.ok && accessedCaseReport) {
    return {
      status: 503,
      body: { ok: false, error: "audit_unavailable" },
      accessedCaseReport,
    }
  }

  return {
    status: 200,
    body: publicAnswer(answer, requestId),
    accessedCaseReport,
  }
}

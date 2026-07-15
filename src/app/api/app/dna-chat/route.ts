import { NextResponse } from "next/server"
import { z } from "zod"
import { requireConfirmedUser, requireTrustedMutation } from "@/lib/security/apiGuards"
import { recordDataAccessAuditEvent } from "@/lib/security/privacyOps"
import { checkRateLimit } from "@/lib/security/rateLimit"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import {
  createDnaChatSafeCaseContext,
  resolveDnaChat,
  type DnaChatCaseContextInput,
  type DnaChatResponse,
} from "@/lib/dna/chat"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MAX_BODY_BYTES = 8 * 1024
const CLIENT_PAGE_SIZE = 500
const ASSESSMENT_PAGE_SIZE = 1_000
const OWNERSHIP_QUERY_CHUNK = 100
const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Vary: "Cookie",
}

const dnaChatPostSchema = z
  .object({
    mode: z.enum(["theory", "dna", "case"]),
    question: z.string().trim().min(2).max(600),
    reportId: z.string().uuid().optional(),
    context: z
      .object({
        previousTopic: z.string().trim().min(1).max(120).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

type DnaChatPayload = z.infer<typeof dnaChatPostSchema>
type JsonRecord = Record<string, unknown>
type ReportRow = {
  id: string
  assessment_id: string | null
  version: number | null
  created_at: string | null
  snapshot_json: unknown
}

type AssessmentRow = {
  id: string
  client_id: string | null
}

type ClientRow = {
  id: string
  child_code: string | null
}

function noStore<T extends Response>(response: T): T {
  for (const [name, value] of Object.entries(NO_STORE_HEADERS)) {
    response.headers.set(name, value)
  }
  return response
}

function json(payload: unknown, init?: ResponseInit) {
  return noStore(NextResponse.json(payload, init))
}

function errorResponse(error: string, status: number, extra?: Record<string, unknown>) {
  return json({ ok: false, error, ...(extra || {}) }, { status })
}

function tooManyRequestsResponse(resetAt: number) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1_000))
  const response = errorResponse("too_many_requests", 429, { retryAfter })
  response.headers.set("Retry-After", String(retryAfter))
  return response
}

async function normalizeAuthFailure(response: NextResponse) {
  let rawError = ""
  try {
    const body = (await response.clone().json()) as { error?: unknown }
    rawError = String(body?.error || "").toLowerCase()
  } catch {}

  return errorResponse(rawError.includes("session") ? "session_expired" : "unauthorized", 401)
}

async function readPayload(request: Request) {
  const declaredLength = Number(request.headers.get("content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return { ok: false as const, response: errorResponse("payload_too_large", 413) }
  }

  let raw = ""
  try {
    raw = await request.text()
  } catch {
    return { ok: false as const, response: errorResponse("invalid_payload", 400) }
  }

  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return { ok: false as const, response: errorResponse("payload_too_large", 413) }
  }

  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return { ok: false as const, response: errorResponse("invalid_payload", 400) }
  }

  const parsed = dnaChatPostSchema.safeParse(value)
  if (!parsed.success) {
    return { ok: false as const, response: errorResponse("invalid_payload", 400) }
  }

  return { ok: true as const, data: parsed.data }
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {}
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function stringValue(value: unknown): string | null {
  const string = typeof value === "string" ? value.trim() : ""
  return string || null
}

function stringList(value: unknown, limit = 8): string[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (typeof item === "string") return item.trim()
      const row = asRecord(item)
      return stringValue(row.label) || stringValue(row.name) || stringValue(row.key) || ""
    })
    .filter(Boolean)
    .slice(0, limit)
}

function ageBandFromSnapshot(snapshotValue: unknown): string | null {
  const snapshot = asRecord(snapshotValue)
  const direct = stringValue(snapshot.age_band) || stringValue(snapshot.ageBand)
  if (direct) return direct

  const months = finiteNumber(snapshot.age_months ?? snapshot.ageMonths)
  if (months === null) return null
  if (months >= 24 && months <= 35) return "24-35 ay"
  if (months >= 36 && months <= 47) return "36-47 ay"
  if (months >= 48 && months <= 59) return "48-59 ay"
  if (months >= 60 && months <= 71) return "60-71 ay"
  return null
}

function sourceIdsFromAnswer(answer: DnaChatResponse): string[] {
  const sourceIds: string[] = []
  const sources: unknown[] = Array.isArray(answer.sources) ? answer.sources : []
  for (const source of sources) {
    const sourceId = stringValue(asRecord(source).id)
    if (sourceId) sourceIds.push(sourceId)
  }
  return Array.from(new Set<string>(sourceIds)).slice(0, 16)
}

async function enforceQuestionRateLimits(userId: string) {
  const [burst, hourly] = await Promise.all([
    checkRateLimit({
      key: `dna-chat:question:burst:${userId}`,
      limit: 12,
      windowMs: 10_000,
    }),
    checkRateLimit({
      key: `dna-chat:question:hour:${userId}`,
      limit: 120,
      windowMs: 60 * 60 * 1_000,
    }),
  ])

  if (!burst.ok || !hourly.ok) {
    return {
      ok: false as const,
      resetAt: Math.max(!burst.ok ? burst.resetAt : 0, !hourly.ok ? hourly.resetAt : 0),
    }
  }

  return { ok: true as const }
}

async function listOwnReports(userId: string) {
  const supabase = await createSupabaseServerClient()
  const clients: ClientRow[] = []
  for (let offset = 0; ; offset += CLIENT_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("clients")
      .select("id, child_code")
      .eq("owner_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + CLIENT_PAGE_SIZE - 1)

    if (error) return { ok: false as const }
    const page = (data || []) as ClientRow[]
    clients.push(...page.filter((row) => row.id))
    if (page.length < CLIENT_PAGE_SIZE) break
  }

  if (clients.length === 0) return { ok: true as const, reports: [] }

  const assessments: AssessmentRow[] = []
  const clientIds = clients.map((row) => row.id)
  for (let chunkStart = 0; chunkStart < clientIds.length; chunkStart += OWNERSHIP_QUERY_CHUNK) {
    const clientChunk = clientIds.slice(chunkStart, chunkStart + OWNERSHIP_QUERY_CHUNK)
    for (let offset = 0; ; offset += ASSESSMENT_PAGE_SIZE) {
      const { data, error } = await supabase
        .from("assessments_v2")
        .select("id, client_id")
        .in("client_id", clientChunk)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(offset, offset + ASSESSMENT_PAGE_SIZE - 1)

      if (error) return { ok: false as const }
      const page = (data || []) as AssessmentRow[]
      assessments.push(...page.filter((row) => row.id && row.client_id))
      if (page.length < ASSESSMENT_PAGE_SIZE) break
    }
  }

  if (assessments.length === 0) return { ok: true as const, reports: [] }

  const reportCandidates: ReportRow[] = []
  const assessmentIds = assessments.map((row) => row.id)
  for (let chunkStart = 0; chunkStart < assessmentIds.length; chunkStart += OWNERSHIP_QUERY_CHUNK) {
    const assessmentChunk = assessmentIds.slice(chunkStart, chunkStart + OWNERSHIP_QUERY_CHUNK)
    const { data, error } = await supabase
      .from("reports")
      .select("id, assessment_id, version, created_at, snapshot_json")
      .in("assessment_id", assessmentChunk)
      .not("report_text", "is", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(10)

    if (error) return { ok: false as const }
    reportCandidates.push(...(((data || []) as ReportRow[]).filter((row) => row.id && row.assessment_id)))
  }

  const assessmentsById = new Map(assessments.map((row) => [row.id, row]))
  const clientsById = new Map(clients.map((row) => [row.id, row]))
  const newestReports = reportCandidates
    .sort((left, right) => {
      const dateDifference = Date.parse(right.created_at || "") - Date.parse(left.created_at || "")
      if (Number.isFinite(dateDifference) && dateDifference !== 0) return dateDifference
      return right.id.localeCompare(left.id)
    })
    .slice(0, 10)
    .flatMap((report) => {
      const assessment = assessmentsById.get(String(report.assessment_id || ""))
      const client = assessment?.client_id ? clientsById.get(assessment.client_id) : null
      if (!assessment || !client) return []
      return [
        {
          id: report.id,
          clientCode: String(client.child_code || ""),
          createdAt: report.created_at || null,
          version: finiteNumber(report.version),
          ageBand: ageBandFromSnapshot(report.snapshot_json),
        },
      ]
    })

  return { ok: true as const, reports: newestReports }
}

async function loadOwnCaseReport(userId: string, reportId: string) {
  const supabase = await createSupabaseServerClient()
  const { data: reportData, error: reportError } = await supabase
    .from("reports")
    .select("id, assessment_id, version, created_at, snapshot_json")
    .eq("id", reportId)
    .maybeSingle()

  if (reportError) return { ok: false as const, kind: "failed" as const }
  const report = reportData as ReportRow | null
  if (!report?.id || !report.assessment_id) return { ok: false as const, kind: "not_found" as const }

  const { data: assessmentData, error: assessmentError } = await supabase
    .from("assessments_v2")
    .select("id, client_id")
    .eq("id", report.assessment_id)
    .is("deleted_at", null)
    .maybeSingle()

  if (assessmentError) return { ok: false as const, kind: "failed" as const }
  const assessment = assessmentData as AssessmentRow | null
  if (!assessment?.id || !assessment.client_id) return { ok: false as const, kind: "not_found" as const }

  const { data: clientData, error: clientError } = await supabase
    .from("clients")
    .select("id")
    .eq("id", assessment.client_id)
    .eq("owner_id", userId)
    .is("deleted_at", null)
    .maybeSingle()

  if (clientError) return { ok: false as const, kind: "failed" as const }
  if (!clientData?.id) return { ok: false as const, kind: "not_found" as const }

  return { ok: true as const, report }
}

function domainValue(source: JsonRecord, canonical: string, legacy: string) {
  return source[canonical] ?? source[legacy]
}

function caseContextFromSnapshot(snapshotValue: unknown): DnaChatCaseContextInput {
  const snapshot = asRecord(snapshotValue)
  const scores = asRecord(snapshot.scores)
  const levels = asRecord(snapshot.domain_levels ?? snapshot.domainLevels)
  const candidateChatContext = asRecord(snapshot.chat_context ?? snapshot.chatContext)
  const chatContext =
    candidateChatContext.version === "dna-chat-context@1" ? candidateChatContext : {}

  const scoreMap = {
    physiological: finiteNumber(domainValue(scores, "physiological", "fizyolojik")),
    sensory: finiteNumber(domainValue(scores, "sensory", "duyusal")),
    emotional: finiteNumber(domainValue(scores, "emotional", "duygusal")),
    cognitive: finiteNumber(domainValue(scores, "cognitive", "bilissel")),
    executive: finiteNumber(domainValue(scores, "executive", "yurutucu")),
    interoception: finiteNumber(domainValue(scores, "interoception", "intero")),
  }

  const levelMap = {
    physiological: stringValue(domainValue(levels, "physiological", "fizyolojik")),
    sensory: stringValue(domainValue(levels, "sensory", "duyusal")),
    emotional: stringValue(domainValue(levels, "emotional", "duygusal")),
    cognitive: stringValue(domainValue(levels, "cognitive", "bilissel")),
    executive: stringValue(domainValue(levels, "executive", "yurutucu")),
    interoception: stringValue(domainValue(levels, "interoception", "intero")),
  }

  const validLevels = Object.fromEntries(
    Object.entries(levelMap).filter(([, value]) => value === "Tipik" || value === "Riskli" || value === "Atipik")
  ) as DnaChatCaseContextInput["levels"]

  const confidenceLevel = stringValue(chatContext.confidenceLevel ?? chatContext.confidence)
  const confidenceRationale = stringValue(chatContext.confidenceRationale)

  return {
    dataStatus: "deidentified",
    ageMonths: finiteNumber(snapshot.age_months ?? snapshot.ageMonths),
    scores: Object.fromEntries(Object.entries(scoreMap).filter(([, value]) => value !== null)) as DnaChatCaseContextInput["scores"],
    levels: validLevels,
    chatContext: {
      primaryAxis: stringValue(chatContext.primaryAxis),
      secondaryAxes: stringList(chatContext.secondaryAxes, 4),
      mechanismLabel: stringValue(chatContext.mechanismLabel),
      mechanismSummary: stringValue(chatContext.mechanismSummary),
      caseEvidenceLines: stringList(chatContext.caseEvidenceLines ?? chatContext.evidence, 5),
      counterEvidenceLines: stringList(chatContext.counterEvidenceLines ?? chatContext.counterEvidence, 4),
      preservedCapacityLines: stringList(
        chatContext.preservedCapacityLines ?? chatContext.preservedCapacities,
        4
      ),
      dataLimitations: stringList(chatContext.dataLimitations ?? chatContext.limitations, 5),
      confidenceLevel,
      confidenceRationale,
      weakDomains: stringList(chatContext.weakDomains, 6),
      strongDomains: stringList(chatContext.strongDomains, 6),
      patterns: stringList(chatContext.patterns, 6),
    },
  }
}

async function writeDnaChatAudit(params: {
  userId: string
  requestId: string
  mode: DnaChatPayload["mode"]
  intentId: string | null
  classification: DnaChatResponse["classification"]
  outcome: DnaChatResponse["outcome"]
  engineVersion: string
  sourceIds: string[]
}) {
  try {
    const admin = createSupabaseAdminClient()
    return await recordDataAccessAuditEvent({
      admin,
      actorUserId: params.userId,
      subjectUserId: params.userId,
      action: "dna_chat_answer",
      resourceType: "dna_chat_request",
      resourceId: params.requestId,
      legalBasis: "health_related_service_and_access_accountability",
      metadata: {
        request_id: params.requestId,
        mode: params.mode,
        intent: params.intentId,
        classification: params.classification,
        engine_version: params.engineVersion,
        refused: params.classification === "refusal" || params.outcome === "refused",
        source_ids: params.sourceIds,
      },
    })
  } catch (error) {
    console.error("[dna-chat] audit unavailable", error instanceof Error ? error.message : "unknown")
    return { ok: false as const, error: "audit_insert_failed" as const }
  }
}

export async function GET() {
  try {
    const auth = await requireConfirmedUser()
    if (!auth.ok) return normalizeAuthFailure(auth.response)

    const limit = await checkRateLimit({
      key: `dna-chat:reports:${auth.user.id}`,
      limit: 120,
      windowMs: 60 * 60 * 1_000,
    })
    if (!limit.ok) return tooManyRequestsResponse(limit.resetAt)

    const result = await listOwnReports(auth.user.id)
    if (!result.ok) return errorResponse("dna_chat_failed", 500)

    return json({ ok: true, reports: result.reports })
  } catch (error) {
    console.error("[dna-chat] report list failed", error instanceof Error ? error.message : "unknown")
    return errorResponse("dna_chat_failed", 500)
  }
}

export async function POST(request: Request) {
  try {
    const trusted = await requireTrustedMutation(request)
    if (trusted) return errorResponse("unauthorized", 401)

    const auth = await requireConfirmedUser()
    if (!auth.ok) return normalizeAuthFailure(auth.response)

    const limit = await enforceQuestionRateLimits(auth.user.id)
    if (!limit.ok) return tooManyRequestsResponse(limit.resetAt)

    const parsed = await readPayload(request)
    if (!parsed.ok) return parsed.response
    const payload = parsed.data

    if ((payload.mode === "case" && !payload.reportId) || (payload.mode !== "case" && payload.reportId)) {
      return errorResponse("mode_report_mismatch", 400)
    }

    let caseContext: ReturnType<typeof createDnaChatSafeCaseContext> | undefined
    if (payload.mode === "case") {
      const recentReports = await listOwnReports(auth.user.id)
      if (!recentReports.ok) return errorResponse("dna_chat_failed", 500)
      if (!recentReports.reports.some((report) => report.id === payload.reportId)) {
        return errorResponse("report_not_found", 404)
      }
      const access = await loadOwnCaseReport(auth.user.id, String(payload.reportId))
      if (!access.ok) {
        return access.kind === "not_found"
          ? errorResponse("report_not_found", 404)
          : errorResponse("dna_chat_failed", 500)
      }
      caseContext = createDnaChatSafeCaseContext(caseContextFromSnapshot(access.report.snapshot_json))
    }

    const answer = await resolveDnaChat({
      mode: payload.mode,
      question: payload.question,
      previousTopic: payload.context?.previousTopic || null,
      caseContext,
    })

    const requestId = crypto.randomUUID()
    const audit = await writeDnaChatAudit({
      userId: auth.user.id,
      requestId,
      mode: payload.mode,
      intentId: answer.intentId,
      classification: answer.classification,
      outcome: answer.outcome,
      engineVersion: answer.engineVersion,
      sourceIds: sourceIdsFromAnswer(answer),
    })

    if (!audit.ok && payload.mode === "case") {
      return errorResponse("audit_unavailable", 503)
    }

    return json({
      ok: true,
      requestId,
      classification: answer.classification,
      summary: answer.summary,
      details: answer.details,
      sources: answer.sources,
      caseEvidence: answer.caseEvidence,
      limitations: answer.limitations,
      safetyBoundary: answer.safetyBoundary,
      suggestedQuestions: answer.suggestedQuestions,
      engineVersion: answer.engineVersion,
      topic: answer.topic,
    })
  } catch (error) {
    console.error("[dna-chat] request failed", error instanceof Error ? error.message : "unknown")
    return errorResponse("dna_chat_failed", 500)
  }
}

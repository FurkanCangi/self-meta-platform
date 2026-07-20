import { NextResponse } from "next/server"
import { z } from "zod"
import { requireConfirmedUser, requireTrustedMutation } from "@/lib/security/apiGuards"
import { recordDataAccessAuditEvent } from "@/lib/security/privacyOps"
import { checkRateLimit } from "@/lib/security/rateLimit"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import {
  buildDnaChatAuditMetadata,
  readDnaChatRequestBody,
  resolveDnaChatApiRequest,
  type DnaChatApiAuditInput,
} from "@/lib/dna/chat"
import { evaluateDnaChatOperationalEnvironment } from "@/lib/dna/chat/operations/incidentResponse"
import { resolveOwnedDnaCaseAnswer } from "@/lib/dna/chat/ownedCaseAnswer"
import {
  getCommittedDnaChatRuntimeStatus,
  resolveCommittedDnaChatRuntime,
} from "@/lib/dna/chat/v3RetrievalServer"

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
    mode: z.enum(["theory", "dna", "case"]).optional(),
    responseDepth: z.enum(["short", "standard", "deep"]).optional(),
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

function operationalAvailability(route: "dna-chat" | "dna-chat-reports") {
  const runtimeStatus = getCommittedDnaChatRuntimeStatus()
  return evaluateDnaChatOperationalEnvironment({
    route,
    packSha256: runtimeStatus.packageSha256,
  })
}

function hasDeclaredOversizeBody(request: Request) {
  const rawLength = request.headers.get("content-length")
  if (!rawLength) return false
  const declaredLength = Number(rawLength)
  return Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES
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
  const body = await readDnaChatRequestBody(request, MAX_BODY_BYTES)
  if (!body.ok) {
    return {
      ok: false as const,
      response: errorResponse(body.error, body.error === "payload_too_large" ? 413 : 400),
    }
  }

  let value: unknown
  try {
    value = JSON.parse(body.raw)
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

async function writeDnaChatAudit(params: {
  userId: string
} & DnaChatApiAuditInput) {
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
      metadata: buildDnaChatAuditMetadata(params),
    })
  } catch (error) {
    console.error("[dna-chat] audit unavailable", error instanceof Error ? error.message : "unknown")
    return { ok: false as const, error: "audit_insert_failed" as const }
  }
}

export async function GET() {
  try {
    if (!operationalAvailability("dna-chat-reports").allowed) {
      return errorResponse("dna_chat_unavailable", 503)
    }
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
    if (!operationalAvailability("dna-chat").allowed) {
      return errorResponse("dna_chat_unavailable", 503)
    }
    // Reject an explicitly oversized body before authentication or rate-limit
    // work. Streaming requests without Content-Length are still bounded by
    // readDnaChatRequestBody below.
    if (hasDeclaredOversizeBody(request)) {
      return errorResponse("payload_too_large", 413)
    }

    const trusted = await requireTrustedMutation(request)
    if (trusted) return errorResponse("unauthorized", 401)

    const auth = await requireConfirmedUser()
    if (!auth.ok) return normalizeAuthFailure(auth.response)

    const limit = await enforceQuestionRateLimits(auth.user.id)
    if (!limit.ok) return tooManyRequestsResponse(limit.resetAt)

    const parsed = await readPayload(request)
    if (!parsed.ok) return parsed.response
    const payload = parsed.data
    const resolution = await resolveDnaChatApiRequest(payload, {
      createRequestId: () => crypto.randomUUID(),
      // The authenticated owner ID is used only as the deterministic rollout
      // bucket input. It is never exposed in the answer or audit metadata.
      resolveRuntimeAnswer: (input) => resolveCommittedDnaChatRuntime({
        ...input,
        rolloutSubjectKey: auth.user.id,
      }),
      loadCaseAnswer: async ({ reportId, question, mode, previousTopic, responseDepth }) => {
        const recentReports = await listOwnReports(auth.user.id)
        if (!recentReports.ok) return { ok: false, status: 500, error: "dna_chat_failed" }
        if (!recentReports.reports.some((report) => report.id === reportId)) {
          return { ok: false, status: 404, error: "report_not_found" }
        }
        return resolveOwnedDnaCaseAnswer({
          userId: auth.user.id,
          reportId,
          question,
          mode,
          previousTopic,
          responseDepth,
        })
      },
      writeAudit: (auditInput) => writeDnaChatAudit({ userId: auth.user.id, ...auditInput }),
    })

    return json(resolution.body, { status: resolution.status })
  } catch (error) {
    console.error("[dna-chat] request failed", error instanceof Error ? error.message : "unknown")
    return errorResponse("dna_chat_failed", 500)
  }
}

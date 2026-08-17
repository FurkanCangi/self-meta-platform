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
import {
  createDnaChatRequestTimer,
  shouldLogDnaChatRequestTiming,
} from "@/lib/dna/chat/operations/requestTiming"
import { resolveOwnedDnaCaseAnswer } from "@/lib/dna/chat/ownedCaseAnswer"
import {
  getCommittedDnaChatRuntimeStatus,
  resolveCommittedDnaChatRuntime,
} from "@/lib/dna/chat/v3RetrievalServer"
import {
  createDnaChatLunaSafetyIdentifier,
  polishDnaChatPublicAnswerWithLuna,
  prepareDnaChatQuestionWithLuna,
  type DnaChatLunaStageTrace,
} from "@/lib/dna/chat/lunaServer"
import {
  buildDnaChatLunaAuditMetadata,
  sumDnaChatLunaUsage,
} from "@/lib/dna/chat/lunaUsage"
import {
  DNA_CHAT_LUNA_MODEL,
  DNA_CHAT_LUNA_POLICY_VERSION,
} from "@/lib/dna/chat/lunaPolicy"
import { isOwnerAuditEmail } from "@/lib/owner/ownerAccess"
import {
  DNA_S13_LIMITED_ROLLOUT_ENV,
  resolveDnaS13LimitedRolloutConfig,
  resolveDnaS13LimitedRolloutGate,
} from "@/lib/dna/chat/s13/limitedRollout/config"
import { hashDnaS13LimitedIdentifier } from "@/lib/dna/chat/s13/limitedRollout/context.server"
import { inspectDnaS13LimitedRolloutPrivacy } from "@/lib/dna/chat/s13/limitedRollout/privacy"
import { getDnaS13LimitedRolloutReleaseCandidate } from "@/lib/dna/chat/s13/limitedRollout/release"
import {
  createDnaS13LimitedFallbackTelemetry,
  runDnaS13LimitedRolloutMessage,
} from "@/lib/dna/chat/s13/limitedRollout/runner.server"
import {
  readDnaS13LimitedDailySpend,
  writeDnaS13LimitedTelemetry,
} from "@/lib/dna/chat/s13/limitedRollout/store.server"
import { evaluateDnaS13LimitedBudget } from "@/lib/dna/chat/s13/limitedRollout/telemetry"
import { DNA_INTELLIGENCE_INTENDED_USE_VERSION } from "@/lib/dna/chat/intendedUse"
import { DNA_KNOWLEDGE_AUTHORITY_CONTRACT_VERSION } from "@/lib/dna/chat/knowledgeAuthority"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MAX_BODY_BYTES = 8 * 1024
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
    conversationId: z.string().uuid().optional(),
    limitedRolloutContextToken: z.string().trim().min(16).max(2_048).optional(),
    context: z
      .object({
        previousTopic: z.string().trim().min(1).max(120).optional(),
        topicIds: z.array(z.string().trim().min(1).max(120)).min(1).max(2).optional(),
        lastQueryKind: z.enum([
          "definition",
          "comparison",
          "relation",
          "measurement",
          "development",
          "evidence",
          "case",
          "unknown",
        ]).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

type ReportRow = {
  id: string
  version: number | null
  created_at: string | null
  age_band: string | null
  age_band_camel: string | null
  age_months: string | null
  age_months_camel: string | null
  assessment:
    | {
        client: { child_code: string | null } | Array<{ child_code: string | null }> | null
      }
    | Array<{
        client: { child_code: string | null } | Array<{ child_code: string | null }> | null
      }>
    | null
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

function limitedLatencyCategory(elapsedMs: number): DnaChatApiAuditInput["latencyCategory"] {
  if (elapsedMs < 100) return "lt_100ms"
  if (elapsedMs < 1_000) return "100_to_999ms"
  return "gte_1000ms"
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

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function stringValue(value: unknown): string | null {
  const string = typeof value === "string" ? value.trim() : ""
  return string || null
}

function ageBandFromReport(report: ReportRow): string | null {
  const direct = stringValue(report.age_band) || stringValue(report.age_band_camel)
  if (direct) return direct

  const months = finiteNumber(report.age_months) ?? finiteNumber(report.age_months_camel)
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

  if (!burst.backendAvailable || !hourly.backendAvailable) {
    return { ok: false as const, backendAvailable: false as const }
  }
  if (!burst.ok || !hourly.ok) {
    return {
      ok: false as const,
      backendAvailable: true as const,
      resetAt: Math.max(!burst.ok ? burst.resetAt : 0, !hourly.ok ? hourly.resetAt : 0),
    }
  }

  return { ok: true as const, backendAvailable: true as const }
}

async function listOwnReports(userId: string) {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("reports")
    .select(`
      id,
      version,
      created_at,
      age_band:snapshot_json->>age_band,
      age_band_camel:snapshot_json->>ageBand,
      age_months:snapshot_json->>age_months,
      age_months_camel:snapshot_json->>ageMonths,
      assessment:assessments_v2!reports_assessment_id_fkey!inner(
        client:clients!assessments_v2_client_id_fkey!inner(child_code)
      )
    `)
    .eq("assessment.client.owner_id", userId)
    .is("assessment.deleted_at", null)
    .is("assessment.client.deleted_at", null)
    .not("report_text", "is", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(10)

  if (error) return { ok: false as const }
  const newestReports = ((data || []) as unknown as ReportRow[])
    .flatMap((report) => {
      const assessment = Array.isArray(report.assessment) ? report.assessment[0] : report.assessment
      const client = Array.isArray(assessment?.client) ? assessment.client[0] : assessment?.client
      if (!report.id || !client) return []
      return [
        {
          id: report.id,
          clientCode: String(client.child_code || ""),
          createdAt: report.created_at || null,
          version: finiteNumber(report.version),
          ageBand: ageBandFromReport(report),
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

const LUNA_BUDGET_BAND_ORDER = ["normal", "warning", "restricted", "critical", "exhausted"] as const

async function writeDnaChatLunaAudit(params: Readonly<{
  userId: string
  requestId: string
  interpretation: DnaChatLunaStageTrace
  polish?: DnaChatLunaStageTrace | null
}>) {
  const traces = [params.interpretation, ...(params.polish ? [params.polish] : [])]
  const usage = sumDnaChatLunaUsage(traces.map((entry) => entry.usage))
  if (usage.inputTokens === 0 && usage.outputTokens === 0) return { ok: true as const, skipped: true as const }
  const budgetBand = [...traces]
    .sort((left, right) =>
      LUNA_BUDGET_BAND_ORDER.indexOf(right.budgetBand) - LUNA_BUDGET_BAND_ORDER.indexOf(left.budgetBand))[0]
    ?.budgetBand ?? "normal"
  try {
    const admin = createSupabaseAdminClient()
    return await recordDataAccessAuditEvent({
      admin,
      actorUserId: params.userId,
      subjectUserId: params.userId,
      action: "dna_chat_language_support",
      resourceType: "dna_chat_request",
      resourceId: params.requestId,
      legalBasis: "service_operation_and_cost_control",
      metadata: buildDnaChatLunaAuditMetadata({
        requestId: params.requestId,
        policyVersion: DNA_CHAT_LUNA_POLICY_VERSION,
        model: DNA_CHAT_LUNA_MODEL,
        interpretationStatus: `${params.interpretation.status}:${params.interpretation.reason}`,
        polishStatus: params.polish ? `${params.polish.status}:${params.polish.reason}` : "skipped:not_run",
        usage,
        budgetBand,
      }),
    })
  } catch (error) {
    console.error("[dna-chat-luna] operational audit unavailable", error instanceof Error ? error.message : "unknown")
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
    if (!limit.backendAvailable) return errorResponse("dna_chat_unavailable", 503)
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
  const requestStartedAt = performance.now()
  const timing = createDnaChatRequestTimer()
  const finish = <T extends Response>(response: T, requestId?: string | null): T => {
    const record = timing.complete({ status: response.status, requestId })
    if (shouldLogDnaChatRequestTiming(record)) {
      console.info("[dna-chat] request timing", JSON.stringify(record))
    }
    return response
  }

  try {
    const availability = await timing.measure("operational_gate", () => operationalAvailability("dna-chat"))
    if (!availability.allowed) {
      return finish(errorResponse("dna_chat_unavailable", 503))
    }
    // Reject an explicitly oversized body before authentication or rate-limit
    // work. Streaming requests without Content-Length are still bounded by
    // readDnaChatRequestBody below.
    if (hasDeclaredOversizeBody(request)) {
      return finish(errorResponse("payload_too_large", 413))
    }

    const trusted = await timing.measure("trusted_mutation", () => requireTrustedMutation(request))
    if (trusted) return finish(errorResponse("unauthorized", 401))

    const auth = await timing.measure("authentication", () => requireConfirmedUser())
    if (!auth.ok) return finish(await normalizeAuthFailure(auth.response))

    const limit = await timing.measure("rate_limit", () => enforceQuestionRateLimits(auth.user.id))
    if (!limit.backendAvailable) return finish(errorResponse("dna_chat_unavailable", 503))
    if (!limit.ok) return finish(tooManyRequestsResponse(limit.resetAt))

    const parsed = await timing.measure("payload", () => readPayload(request))
    if (!parsed.ok) return finish(parsed.response)
    const {
      conversationId,
      limitedRolloutContextToken,
      ...payload
    } = parsed.data
    const requestId = crypto.randomUUID()
    const lunaSafetyIdentifier = createDnaChatLunaSafetyIdentifier(auth.user.id)
    const limitedConfig = resolveDnaS13LimitedRolloutConfig()
    const limitedGate = resolveDnaS13LimitedRolloutGate({
      config: limitedConfig,
      subjectKey: auth.user.id,
      trustedOwner: isOwnerAuditEmail(auth.user.email),
    })
    const limitedTelemetrySecret = process.env[DNA_S13_LIMITED_ROLLOUT_ENV.telemetrySecret]?.trim() || ""
    const limitedContextSecret = process.env[DNA_S13_LIMITED_ROLLOUT_ENV.contextSecret]?.trim() || ""
    const subjectIdHash = hashDnaS13LimitedIdentifier({
      secret: limitedTelemetrySecret,
      kind: "subject",
      value: auth.user.id,
    })
    const stableConversationId = conversationId || requestId
    const conversationIdHash = hashDnaS13LimitedIdentifier({
      secret: limitedTelemetrySecret,
      kind: "conversation",
      value: `${auth.user.id}\u0000${stableConversationId}`,
    })
    let forceDeterministicNormalPath = false

    if (limitedGate.routed) {
      if (!subjectIdHash || !conversationIdHash || limitedContextSecret.length < 32) {
        forceDeterministicNormalPath = true
        console.error("[dna-s13-limited] configuration failed closed", {
          reason: "limited_rollout_secret_missing_or_invalid",
        })
      } else {
        const admin = createSupabaseAdminClient()
        const release = getDnaS13LimitedRolloutReleaseCandidate()
        const privacy = inspectDnaS13LimitedRolloutPrivacy({
          question: payload.question,
          mode: payload.mode,
          reportId: payload.reportId,
        })
        const safeTelemetryBase = {
          requestId,
          createdAt: new Date().toISOString(),
          releaseVersion: release.releaseVersion,
          releaseHash: release.releaseHash,
          subjectIdHash,
          conversationIdHash,
          rolloutPhase: limitedConfig.phase,
          privacy,
          totalMs: Math.max(0, performance.now() - requestStartedAt),
        } as const
        if (!privacy.allowed) {
          forceDeterministicNormalPath = true
          await writeDnaS13LimitedTelemetry({
            admin,
            actorUserId: auth.user.id,
            record: createDnaS13LimitedFallbackTelemetry({
              ...safeTelemetryBase,
              status: "privacy_blocked",
              reason: "privacy_blocked",
            }),
          }).catch(() => ({ ok: false as const }))
        } else {
          const spend = await readDnaS13LimitedDailySpend({ admin })
          const budget = evaluateDnaS13LimitedBudget({
            spentMicrousd: spend.spentMicrousd,
            capMicrousd: limitedConfig.dailyLunaCapMicrousd,
            nearCapPercent: limitedConfig.nearCapPercent,
          })
          if (!spend.ok || !budget.allowed) {
            forceDeterministicNormalPath = true
            await writeDnaS13LimitedTelemetry({
              admin,
              actorUserId: auth.user.id,
              record: createDnaS13LimitedFallbackTelemetry({
                ...safeTelemetryBase,
                status: "cost_guardrail",
                reason: spend.ok ? "daily_cost_cap_closed" : "daily_cost_ledger_unavailable",
              }),
            }).catch(() => ({ ok: false as const }))
          } else {
            if (budget.nearCap) {
              console.warn("[dna-s13-limited] daily Luna budget near cap", {
                utilizationPercent: budget.utilizationPercent,
              })
            }
            const limited = await timing.measure("runtime_resolution", () => runDnaS13LimitedRolloutMessage({
              requestId,
              subjectId: auth.user.id,
              subjectIdHash,
              conversationIdHash,
              sessionId: conversationIdHash.slice(0, 40),
              question: payload.question,
              responseDepth: payload.responseDepth ?? "standard",
              contextToken: limitedRolloutContextToken ?? null,
              contextSecret: limitedContextSecret,
              privacy,
              rolloutPhase: limitedConfig.phase,
              safetyIdentifier: lunaSafetyIdentifier,
              simplifyExperimentalEnabled: false,
            }))
            const telemetryWrite = await writeDnaS13LimitedTelemetry({
              admin,
              actorUserId: auth.user.id,
              record: limited.telemetry,
            })
            if (limited.kind === "clarification") {
              const standardAudit = await writeDnaChatAudit({
                userId: auth.user.id,
                requestId,
                mode: "theory",
                intentId: null,
                classification: "clarification",
                outcome: "clarification",
                engineVersion: "dna-s13-strict-v4",
                runtimeGeneration: "v3",
                catalogVersion: release.fingerprints.catalog.version,
                packageVersion: release.releaseVersion,
                packageSha256: release.releaseHash,
                intendedUseVersion: DNA_INTELLIGENCE_INTENDED_USE_VERSION,
                sourceIds: [],
                authorityContractVersion: DNA_KNOWLEDGE_AUTHORITY_CONTRACT_VERSION,
                policyVersion: "dna-s13-routing-clarification@1",
                authoritySet: [],
                responseDepth: payload.responseDepth ?? "standard",
                latencyCategory: limitedLatencyCategory(limited.telemetry.latency.totalMs),
                errorCode: null,
                citationCount: 0,
                httpResult: 200,
                assuranceVersion: "dna-s13-routing-validator@1",
                assuranceStatus: "not_recorded",
                sourceBindingCoveragePercent: 0,
                subquestionCount: 0,
                resolutionMode: "refusal",
                confidenceBand: "low",
                routedTopicIds: [],
              })
              if (!telemetryWrite.ok || !standardAudit.ok) {
                return finish(errorResponse("audit_unavailable", 503), requestId)
              }
              return finish(json(limited.body, { status: 200 }), requestId)
            }
            if (limited.kind === "answered") {
              const topicId = limited.telemetry.routing.topicIds[0] ?? null
              const standardAudit = await writeDnaChatAudit({
                userId: auth.user.id,
                requestId,
                mode: "theory",
                intentId: topicId,
                classification: "literature",
                outcome: "answered",
                engineVersion: "dna-s13-strict-v4",
                runtimeGeneration: "v3",
                catalogVersion: release.fingerprints.catalog.version,
                packageVersion: release.releaseVersion,
                packageSha256: release.releaseHash,
                intendedUseVersion: DNA_INTELLIGENCE_INTENDED_USE_VERSION,
                sourceIds: ["book.self-regulation.owner-current"],
                authorityContractVersion: DNA_KNOWLEDGE_AUTHORITY_CONTRACT_VERSION,
                policyVersion: "dna-s13-limited-rollout-policy@1",
                authoritySet: ["owner_approved_book"],
                responseDepth: payload.responseDepth ?? "standard",
                latencyCategory: limitedLatencyCategory(limited.telemetry.latency.totalMs),
                errorCode: null,
                citationCount: 1,
                httpResult: 200,
                assuranceVersion: "dna-s13-strict-validator@3",
                assuranceStatus: "passed",
                sourceBindingCoveragePercent: 100,
                subquestionCount: limited.telemetry.routing.topicIds.length as 1 | 2,
                resolutionMode: limited.telemetry.routing.topicIds.length === 2 ? "decomposed" : "direct",
                confidenceBand: "high",
                routedTopicIds: [...limited.telemetry.routing.topicIds],
              })
              if (!telemetryWrite.ok || !standardAudit.ok) {
                return finish(errorResponse("audit_unavailable", 503), requestId)
              }
              return finish(json(limited.body, { status: 200 }), requestId)
            }
            forceDeterministicNormalPath = true
          }
        }
      }
    }

    const prepared = await timing.measure(
      "language_interpretation",
      () => forceDeterministicNormalPath
        ? Promise.resolve({
            payload,
            status: "skipped" as const,
            trace: {
              status: "skipped" as const,
              reason: "s13_limited_fail_closed",
              budgetBand: "normal" as const,
              usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0 },
              providerResponseId: null,
            },
          })
        : prepareDnaChatQuestionWithLuna(payload, {
            safetyIdentifier: lunaSafetyIdentifier,
            rolloutSubjectKey: auth.user.id,
          }),
    )
    const resolution = await timing.measure("runtime_resolution", () => resolveDnaChatApiRequest(prepared.payload, {
      createRequestId: () => requestId,
      // The authenticated owner ID is used only as the deterministic rollout
      // bucket input. It is never exposed in the answer or audit metadata.
      resolveRuntimeAnswer: (input) => resolveCommittedDnaChatRuntime({
        ...input,
        rolloutSubjectKey: auth.user.id,
      }),
      loadCaseAnswer: async ({ reportId, question, mode, previousTopic, conversationContext, responseDepth }) => {
        const recentReports = await timing.measure("report_list", () => listOwnReports(auth.user.id))
        if (!recentReports.ok) return { ok: false, status: 500, error: "dna_chat_failed" }
        if (!recentReports.reports.some((report) => report.id === reportId)) {
          return { ok: false, status: 404, error: "report_not_found" }
        }
        return timing.measure("case_answer", () => resolveOwnedDnaCaseAnswer({
          userId: auth.user.id,
          reportId,
          question,
          mode,
          previousTopic,
          conversationContext,
          responseDepth,
        }))
      },
      writeAudit: (auditInput) => timing.measure(
        "audit_write",
        () => writeDnaChatAudit({ userId: auth.user.id, ...auditInput }),
      ),
    }))

    let responseBody = resolution.body
    let polishTrace: DnaChatLunaStageTrace | null = null
    if (!forceDeterministicNormalPath && resolution.status === 200 && responseBody.ok === true) {
      const polished = await timing.measure(
        "language_polish",
        () => polishDnaChatPublicAnswerWithLuna({
          originalQuestion: payload.question,
          interpretedQuestion: prepared.payload.question,
          questionInterpretation: prepared.status,
          safetyIdentifier: lunaSafetyIdentifier,
          rolloutSubjectKey: auth.user.id,
          mode: payload.mode,
          reportId: payload.reportId,
          body: responseBody,
        }),
      )
      responseBody = polished.body
      polishTrace = polished.trace
    }

    await timing.measure("language_audit", () => writeDnaChatLunaAudit({
      userId: auth.user.id,
      requestId,
      interpretation: prepared.trace,
      polish: polishTrace,
    }))

    const publicRequestId = typeof responseBody.requestId === "string" ? responseBody.requestId : requestId
    return finish(json(responseBody, { status: resolution.status }), publicRequestId)
  } catch (error) {
    console.error("[dna-chat] request failed", error instanceof Error ? error.message : "unknown")
    return finish(errorResponse("dna_chat_failed", 500))
  }
}

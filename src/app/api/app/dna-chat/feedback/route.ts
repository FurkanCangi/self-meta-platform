import { NextResponse } from "next/server"

import {
  buildDnaChatCategoricalFeedbackRecord,
} from "@/lib/dna/chat/operations/userFeedback"
import { evaluateDnaChatOperationalEnvironment } from "@/lib/dna/chat/operations/incidentResponse"
import { DNA_CHAT_CATALOG_SOURCE_BY_ID } from "@/lib/dna/chat/catalog"
import { readDnaChatRequestBody } from "@/lib/dna/chat/apiResolver"
import { hasCommittedDnaV3SourceId } from "@/lib/dna/chat/v3RetrievalServer"
import { requireConfirmedUser, requireTrustedMutation } from "@/lib/security/apiGuards"
import { recordDataAccessAuditEvent } from "@/lib/security/privacyOps"
import { checkRateLimit } from "@/lib/security/rateLimit"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MAX_FEEDBACK_BODY_BYTES = 1_024
const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Vary: "Cookie",
}

function json(payload: unknown, init?: ResponseInit) {
  const response = NextResponse.json(payload, init)
  for (const [name, value] of Object.entries(NO_STORE_HEADERS)) {
    response.headers.set(name, value)
  }
  return response
}

export async function POST(request: Request) {
  if (!evaluateDnaChatOperationalEnvironment({
    route: "dna-chat-feedback",
    packSha256: null,
  }).allowed) {
    return json({ ok: false, error: "dna_chat_unavailable" }, { status: 503 })
  }

  const trusted = await requireTrustedMutation(request)
  if (trusted) return json({ ok: false, error: "unauthorized" }, { status: 401 })

  const auth = await requireConfirmedUser()
  if (!auth.ok) return json({ ok: false, error: "unauthorized" }, { status: 401 })

  const limit = await checkRateLimit({
    key: `dna-chat:categorical-feedback:${auth.user.id}`,
    limit: 30,
    windowMs: 60 * 60 * 1_000,
  })
  if (!limit.ok) {
    const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1_000))
    const response = json({ ok: false, error: "too_many_requests" }, { status: 429 })
    response.headers.set("Retry-After", String(retryAfter))
    return response
  }

  const body = await readDnaChatRequestBody(request, MAX_FEEDBACK_BODY_BYTES)
  if (!body.ok) {
    return json(
      { ok: false, error: body.error },
      { status: body.error === "payload_too_large" ? 413 : 400 },
    )
  }

  let parsedBody: unknown
  try {
    parsedBody = JSON.parse(body.raw)
  } catch {
    return json({ ok: false, error: "invalid_payload" }, { status: 400 })
  }
  const feedback = buildDnaChatCategoricalFeedbackRecord(parsedBody)
  if (!feedback.accepted || !feedback.record) {
    return json({ ok: false, error: "invalid_payload" }, { status: 400 })
  }
  const record = feedback.record

  try {
    const admin = createSupabaseAdminClient()
    const requestAudit = await admin
      .from("data_access_audit_events")
      .select("id, metadata")
      .eq("actor_user_id", auth.user.id)
      .eq("resource_id", record.requestId)
      .eq("action", "dna_chat_answer")
      .maybeSingle()
    if (requestAudit.error) {
      console.error("[dna-chat-feedback] request ownership lookup failed", {
        errorCode: requestAudit.error.code || null,
      })
      return json({ ok: false, error: "feedback_unavailable" }, { status: 503 })
    }
    if (!requestAudit.data?.id) {
      return json({ ok: false, error: "feedback_request_not_found" }, { status: 404 })
    }

    if (record.sourceId) {
      const sourceExists = DNA_CHAT_CATALOG_SOURCE_BY_ID.has(record.sourceId)
        || hasCommittedDnaV3SourceId(record.sourceId)
      const auditMetadata = requestAudit.data.metadata
        && typeof requestAudit.data.metadata === "object"
        && !Array.isArray(requestAudit.data.metadata)
        ? requestAudit.data.metadata as Record<string, unknown>
        : {}
      const answerSourceIds = Array.isArray(auditMetadata.source_ids)
        ? auditMetadata.source_ids.filter((value): value is string => typeof value === "string")
        : []
      if (!sourceExists || !answerSourceIds.includes(record.sourceId)) {
        return json({ ok: false, error: "feedback_source_not_found" }, { status: 404 })
      }
    }

    const result = await recordDataAccessAuditEvent({
      admin,
      actorUserId: auth.user.id,
      subjectUserId: auth.user.id,
      action: "dna_chat_issue_feedback",
      resourceType: "dna_chat_request",
      resourceId: record.requestId,
      legalBasis: "product_quality_and_safety_feedback",
      metadata: {
        schema_version: record.schemaVersion,
        request_id: record.requestId,
        category: record.category,
        source_id: record.sourceId,
        contains_clinical_text: record.containsClinicalText,
        automatic_training_use: record.automaticTrainingUse,
      },
    })
    if (!result.ok) return json({ ok: false, error: "feedback_unavailable" }, { status: 503 })
  } catch (error) {
    console.error(
      "[dna-chat-feedback] audit unavailable",
      error instanceof Error ? error.message : "unknown",
    )
    return json({ ok: false, error: "feedback_unavailable" }, { status: 503 })
  }

  return json({ ok: true, category: record.category })
}

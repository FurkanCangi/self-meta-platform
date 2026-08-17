import { NextResponse } from "next/server"

import {
  buildDnaChatCategoricalFeedbackRecord,
} from "@/lib/dna/chat/operations/userFeedback"
import { evaluateDnaChatOperationalEnvironment } from "@/lib/dna/chat/operations/incidentResponse"
import { DNA_CHAT_CATALOG_SOURCE_BY_ID } from "@/lib/dna/chat/catalog"
import { readDnaChatRequestBody } from "@/lib/dna/chat/apiResolver"
import { hasDnaOwnerBookSourceId } from "@/lib/dna/chat/ownerBookRuntime"
import { hasCommittedDnaV3SourceId } from "@/lib/dna/chat/v3RetrievalServer"
import { requireConfirmedUser, requireTrustedMutation } from "@/lib/security/apiGuards"
import { recordDataAccessAuditEvent } from "@/lib/security/privacyOps"
import { checkRateLimit } from "@/lib/security/rateLimit"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { DNA_S13_LIMITED_ROLLOUT_ENV } from "@/lib/dna/chat/s13/limitedRollout/config"
import { hashDnaS13LimitedIdentifier } from "@/lib/dna/chat/s13/limitedRollout/context.server"
import {
  DNA_S13_LIMITED_MESSAGE_AUDIT_ACTION,
  writeDnaS13LimitedFeedback,
} from "@/lib/dna/chat/s13/limitedRollout/store.server"
import { buildDnaS13LimitedFeedbackRecord } from "@/lib/dna/chat/s13/limitedRollout/feedback"

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
  if (!limit.backendAvailable) {
    return json({ ok: false, error: "feedback_unavailable" }, { status: 503 })
  }
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
  const limitedPayload = parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)
    && "vote" in parsedBody
  const telemetrySecret = process.env[DNA_S13_LIMITED_ROLLOUT_ENV.telemetrySecret]?.trim() || ""
  const subjectIdHash = limitedPayload
    ? hashDnaS13LimitedIdentifier({ secret: telemetrySecret, kind: "subject", value: auth.user.id })
    : null
  const limitedRecord = limitedPayload && subjectIdHash
    ? buildDnaS13LimitedFeedbackRecord(parsedBody, subjectIdHash)
    : null
  const feedback = limitedPayload ? null : buildDnaChatCategoricalFeedbackRecord(parsedBody)
  if (limitedPayload ? !limitedRecord : !feedback?.accepted || !feedback.record) {
    return json({ ok: false, error: "invalid_payload" }, { status: 400 })
  }
  const record = feedback?.record ?? null

  try {
    const admin = createSupabaseAdminClient()
    let requestAudit
    if (limitedRecord) {
      requestAudit = await admin
        .from("data_access_audit_events")
        .select("id, metadata")
        .eq("actor_user_id", auth.user.id)
        .eq("resource_id", limitedRecord.requestId)
        .eq("action", "dna_chat_answer")
        .maybeSingle()
    } else {
      if (!record) return json({ ok: false, error: "invalid_payload" }, { status: 400 })
      requestAudit = await admin
        .from("data_access_audit_events")
        .select("id, metadata")
        .eq("actor_user_id", auth.user.id)
        .eq("resource_id", record.requestId)
        .eq("action", "dna_chat_answer")
        .maybeSingle()
    }
    if (requestAudit.error) {
      console.error("[dna-chat-feedback] request ownership lookup failed", {
        errorCode: requestAudit.error.code || null,
      })
      return json({ ok: false, error: "feedback_unavailable" }, { status: 503 })
    }
    if (!requestAudit.data?.id) {
      return json({ ok: false, error: "feedback_request_not_found" }, { status: 404 })
    }

    if (limitedRecord) {
      const limitedAudit = await admin
        .from("data_access_audit_events")
        .select("id")
        .eq("actor_user_id", auth.user.id)
        .eq("resource_id", limitedRecord.requestId)
        .eq("action", DNA_S13_LIMITED_MESSAGE_AUDIT_ACTION)
        .maybeSingle()
      if (limitedAudit.error || !limitedAudit.data?.id) {
        return json({ ok: false, error: "feedback_request_not_found" }, { status: 404 })
      }
      const result = await writeDnaS13LimitedFeedback({
        admin,
        actorUserId: auth.user.id,
        record: limitedRecord,
      })
      if (!result.ok) return json({ ok: false, error: "feedback_unavailable" }, { status: 503 })
      return json({ ok: true, vote: limitedRecord.vote, reason: limitedRecord.reason })
    }

    if (!record) return json({ ok: false, error: "invalid_payload" }, { status: 400 })
    if (record.sourceId) {
      const sourceExists = DNA_CHAT_CATALOG_SOURCE_BY_ID.has(record.sourceId)
        || hasDnaOwnerBookSourceId(record.sourceId)
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

  return json({ ok: true, category: record!.category })
}

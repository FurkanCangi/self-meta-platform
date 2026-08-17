import "server-only"

import { recordDataAccessAuditEvent } from "@/lib/security/privacyOps"
import {
  DNA_S13_LIMITED_FEEDBACK_VERSION,
  type DnaS13LimitedFeedbackRecord,
} from "./feedback"
import {
  DNA_S13_LIMITED_TELEMETRY_VERSION,
  type DnaS13LimitedTelemetryRecord,
  validateDnaS13LimitedTelemetryRecord,
} from "./telemetry"

export const DNA_S13_LIMITED_MESSAGE_AUDIT_ACTION = "dna_s13_limited_rollout_message" as const
export const DNA_S13_LIMITED_FEEDBACK_AUDIT_ACTION = "dna_s13_limited_rollout_feedback" as const
type AuditAdmin = Parameters<typeof recordDataAccessAuditEvent>[0]["admin"]

export async function writeDnaS13LimitedTelemetry(input: Readonly<{
  admin: AuditAdmin
  actorUserId: string
  record: DnaS13LimitedTelemetryRecord
}>) {
  const safeRecord = validateDnaS13LimitedTelemetryRecord(input.record)
  if (!safeRecord) return { ok: false as const, error: "limited_telemetry_rejected" as const }
  return recordDataAccessAuditEvent({
    admin: input.admin,
    actorUserId: input.actorUserId,
    subjectUserId: input.actorUserId,
    action: DNA_S13_LIMITED_MESSAGE_AUDIT_ACTION,
    resourceType: "dna_chat_request",
    resourceId: safeRecord.requestId,
    legalBasis: "service_operation_quality_safety_and_cost_control",
    metadata: safeRecord as unknown as Record<string, unknown>,
  })
}

export async function writeDnaS13LimitedFeedback(input: Readonly<{
  admin: AuditAdmin
  actorUserId: string
  record: DnaS13LimitedFeedbackRecord
}>) {
  if (input.record.schemaVersion !== DNA_S13_LIMITED_FEEDBACK_VERSION) {
    return { ok: false as const, error: "limited_feedback_rejected" as const }
  }
  return recordDataAccessAuditEvent({
    admin: input.admin,
    actorUserId: input.actorUserId,
    subjectUserId: input.actorUserId,
    action: DNA_S13_LIMITED_FEEDBACK_AUDIT_ACTION,
    resourceType: "dna_chat_request",
    resourceId: input.record.requestId,
    legalBasis: "product_quality_and_safety_feedback",
    metadata: input.record as unknown as Record<string, unknown>,
  })
}

function utcDayStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
}

export async function readDnaS13LimitedDailySpend(input: Readonly<{
  admin: AuditAdmin
  now?: Date
}>) {
  const result = await input.admin
    .from("data_access_audit_events")
    .select("metadata")
    .eq("action", DNA_S13_LIMITED_MESSAGE_AUDIT_ACTION)
    .gte("created_at", utcDayStart(input.now))
    .limit(10_000)
  if (result.error) return { ok: false as const, spentMicrousd: 0 }
  const records = (result.data || []).flatMap((row: { metadata?: unknown }) => {
    const record = validateDnaS13LimitedTelemetryRecord(row.metadata)
    return record ? [record] : []
  })
  return {
    ok: true as const,
    spentMicrousd: records.reduce((sum, row) => sum + row.realization.costMicrousd, 0),
  }
}

export async function readDnaS13LimitedReadoutRecords(input: Readonly<{
  admin: AuditAdmin
  since?: string
  limit?: number
}>) {
  const since = input.since ?? utcDayStart()
  const limit = Math.max(1, Math.min(10_000, input.limit ?? 10_000))
  const [messageResult, feedbackResult] = await Promise.all([
    input.admin.from("data_access_audit_events").select("metadata")
      .eq("action", DNA_S13_LIMITED_MESSAGE_AUDIT_ACTION).gte("created_at", since)
      .order("created_at", { ascending: true }).limit(limit),
    input.admin.from("data_access_audit_events").select("metadata")
      .eq("action", DNA_S13_LIMITED_FEEDBACK_AUDIT_ACTION).gte("created_at", since)
      .order("created_at", { ascending: true }).limit(limit),
  ])
  if (messageResult.error || feedbackResult.error) {
    return { ok: false as const, messages: [], feedback: [] }
  }
  const messages = (messageResult.data || []).flatMap((row: { metadata?: unknown }) => {
    const record = validateDnaS13LimitedTelemetryRecord(row.metadata)
    return record ? [record] : []
  })
  const feedback = (feedbackResult.data || []).flatMap((row: { metadata?: unknown }) => {
    if (!row.metadata || typeof row.metadata !== "object" || Array.isArray(row.metadata)) return []
    const record = row.metadata as unknown as DnaS13LimitedFeedbackRecord
    return record.schemaVersion === DNA_S13_LIMITED_FEEDBACK_VERSION ? [record] : []
  })
  return { ok: true as const, messages, feedback }
}

export function isDnaS13LimitedMessageMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  return (value as { schemaVersion?: unknown }).schemaVersion === DNA_S13_LIMITED_TELEMETRY_VERSION
}

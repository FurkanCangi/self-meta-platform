import "server-only"

import { headers } from "next/headers"
import type { SupabaseClient } from "@supabase/supabase-js"

export type DataAccessAuditInput = {
  admin: SupabaseClient
  actorUserId?: string | null
  subjectUserId?: string | null
  action: string
  resourceType: string
  resourceId?: string | null
  legalBasis?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: Record<string, unknown>
}

export type PrivacyRequestType = "access" | "delete" | "anonymize" | "export" | "rectify"

export function normalizePrivacyRequestType(value: unknown): PrivacyRequestType | null {
  const raw = String(value || "").trim().toLowerCase()
  if (raw === "access" || raw === "delete" || raw === "anonymize" || raw === "export" || raw === "rectify") {
    return raw
  }
  return null
}

function clientIp(headerStore: Headers) {
  const forwardedFor = headerStore.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || null
  return headerStore.get("x-real-ip") || null
}

export async function getPrivacyAuditContext() {
  const headerStore = await headers()
  return {
    ipAddress: clientIp(headerStore),
    userAgent: String(headerStore.get("user-agent") || "").slice(0, 500),
  }
}

export async function recordDataAccessAuditEvent(input: DataAccessAuditInput) {
  await input.admin.from("data_access_audit_events").insert({
    actor_user_id: input.actorUserId || null,
    subject_user_id: input.subjectUserId || null,
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId || null,
    legal_basis: input.legalBasis || null,
    ip_address: input.ipAddress || null,
    user_agent: input.userAgent || null,
    metadata: input.metadata || {},
  })
}

export async function createPrivacyDataRequest(input: {
  admin: SupabaseClient
  userId: string
  requestType: PrivacyRequestType
  message?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}) {
  const { data, error } = await input.admin
    .from("privacy_data_requests")
    .insert({
      user_id: input.userId,
      request_type: input.requestType,
      status: "received",
      request_message: String(input.message || "").slice(0, 2000) || null,
      ip_address: input.ipAddress || null,
      user_agent: input.userAgent || null,
    })
    .select("id, request_type, status, received_at")
    .single()

  if (error || !data?.id) return { ok: false as const, error: "privacy_request_create_failed" }

  await recordDataAccessAuditEvent({
    admin: input.admin,
    actorUserId: input.userId,
    subjectUserId: input.userId,
    action: `privacy_request_${input.requestType}`,
    resourceType: "privacy_data_request",
    resourceId: String(data.id),
    legalBasis: "kvkk_data_subject_request",
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  })

  return { ok: true as const, request: data }
}

import "server-only"

import { createHmac, timingSafeEqual } from "crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizePlanCode, PACKAGE_PLAN_PRICES_MINOR, type PlanCode } from "@/lib/legal/documents"

export const EDUCATION_VIDEO_FEATURE = "education_video"
export const BILLING_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 5 * 60

const PAID_PLANS = new Set<PlanCode>(["student", "graduate", "professional", "enterprise"])
const ACCESS_GRANTING_EVENTS = new Set([
  "checkout.session.completed",
  "invoice.paid",
  "payment.succeeded",
  "subscription.active",
  "subscription.renewed",
])
const ACCESS_REVOKING_EVENTS = new Set([
  "invoice.payment_failed",
  "payment.failed",
  "payment.refunded",
  "charge.refunded",
  "subscription.canceled",
  "subscription.expired",
  "subscription.paused",
])

export type BillingWebhookPayload = {
  id?: string
  eventId?: string
  type?: string
  eventType?: string
  userId?: string
  user_id?: string
  planCode?: string
  plan_code?: string
  amount?: number
  currency?: string
  provider?: string
  providerCustomerId?: string
  provider_customer_id?: string
  providerSubscriptionId?: string
  provider_subscription_id?: string
  currentPeriodStart?: string
  current_period_start?: string
  currentPeriodEnd?: string
  current_period_end?: string
  metadata?: Record<string, unknown>
}

export type EntitlementCheck =
  | { ok: true; planCode: PlanCode; expiresAt: string | null }
  | { ok: false; error: string }

function hmacSha256Hex(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("hex")
}

function constantTimeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a, "hex")
  const bBuffer = Buffer.from(b, "hex")
  if (aBuffer.length !== bBuffer.length) return false
  return timingSafeEqual(aBuffer, bBuffer)
}

function isPaidPlanCode(planCode: PlanCode): planCode is Exclude<PlanCode, "none"> {
  return PAID_PLANS.has(planCode)
}

function parseSignatureCandidates(signatureHeader: string, rawBody: string, secret: string) {
  const trimmed = signatureHeader.trim()
  const candidates: string[] = []

  if (/^[a-f0-9]{64}$/i.test(trimmed)) {
    candidates.push(hmacSha256Hex(secret, rawBody))
    return { provided: trimmed, candidates }
  }

  if (trimmed.startsWith("sha256=")) {
    candidates.push(hmacSha256Hex(secret, rawBody))
    return { provided: trimmed.slice("sha256=".length), candidates }
  }

  const parts = Object.fromEntries(
    trimmed
      .split(",")
      .map((part) => part.split("="))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key.trim(), value.trim()])
  )

  if (parts.v1) {
    candidates.push(hmacSha256Hex(secret, rawBody))
    if (parts.t) candidates.push(hmacSha256Hex(secret, `${parts.t}.${rawBody}`))
    return { provided: parts.v1, candidates, timestamp: parts.t || null }
  }

  return { provided: "", candidates, timestamp: null }
}

export function verifyBillingWebhookSignature(params: {
  rawBody: string
  signatureHeader: string | null
  secret?: string
  toleranceSeconds?: number
}) {
  const secret = params.secret || process.env.PAYMENT_WEBHOOK_SECRET
  if (!secret) return { ok: false as const, error: "payment_webhook_secret_missing" }
  if (!params.signatureHeader) return { ok: false as const, error: "payment_webhook_signature_missing" }

  const parsed = parseSignatureCandidates(params.signatureHeader, params.rawBody, secret)
  if (parsed.timestamp) {
    const timestampSeconds = Number(parsed.timestamp)
    if (!Number.isFinite(timestampSeconds) || timestampSeconds <= 0) {
      return { ok: false as const, error: "payment_webhook_timestamp_invalid" }
    }

    const toleranceSeconds = params.toleranceSeconds ?? BILLING_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS
    const ageSeconds = Math.abs(Date.now() / 1000 - timestampSeconds)
    if (ageSeconds > toleranceSeconds) {
      return { ok: false as const, error: "payment_webhook_timestamp_expired" }
    }
  }

  if (!/^[a-f0-9]{64}$/i.test(parsed.provided)) {
    return { ok: false as const, error: "payment_webhook_signature_invalid" }
  }

  const valid = parsed.candidates.some((candidate) => constantTimeEqual(parsed.provided, candidate))
  if (!valid) return { ok: false as const, error: "payment_webhook_signature_invalid" }
  return { ok: true as const }
}

export function validatePaymentGrantAmount(event: ReturnType<typeof normalizeBillingEvent>) {
  if (!isPaidPlanCode(event.planCode)) {
    return { ok: false as const, error: "paid_plan_required" }
  }

  const expectedAmount = PACKAGE_PLAN_PRICES_MINOR[event.planCode]
  if (event.currency !== "TRY" || event.amount !== expectedAmount) {
    return {
      ok: false as const,
      error: "payment_amount_mismatch",
      expectedAmount,
      expectedCurrency: "TRY",
    }
  }

  return { ok: true as const }
}

export function parseBillingWebhookPayload(rawBody: string): BillingWebhookPayload | null {
  try {
    const parsed = JSON.parse(rawBody)
    if (!parsed || typeof parsed !== "object") return null
    return parsed as BillingWebhookPayload
  } catch {
    return null
  }
}

export function normalizeBillingEvent(payload: BillingWebhookPayload) {
  const eventType = String(payload.type || payload.eventType || "").trim()
  const eventId = String(payload.id || payload.eventId || "").trim()
  const userId = String(payload.userId || payload.user_id || payload.metadata?.user_id || "").trim()
  const planCode = normalizePlanCode(String(payload.planCode || payload.plan_code || payload.metadata?.plan_code || ""))
  const provider = String(payload.provider || payload.metadata?.provider || "generic").trim().slice(0, 80)
  const providerCustomerId = String(payload.providerCustomerId || payload.provider_customer_id || "").trim() || null
  const providerSubscriptionId = String(payload.providerSubscriptionId || payload.provider_subscription_id || "").trim() || null
  const currentPeriodStart = String(payload.currentPeriodStart || payload.current_period_start || "").trim() || null
  const currentPeriodEnd = String(payload.currentPeriodEnd || payload.current_period_end || "").trim() || null

  return {
    eventId,
    eventType,
    userId,
    planCode,
    provider,
    providerCustomerId,
    providerSubscriptionId,
    currentPeriodStart,
    currentPeriodEnd,
    amount: Number.isFinite(Number(payload.amount)) ? Number(payload.amount) : null,
    currency: String(payload.currency || "").trim().slice(0, 12) || null,
  }
}

export async function hasActiveEntitlement(params: {
  admin: SupabaseClient
  userId: string
  feature: string
}): Promise<EntitlementCheck> {
  const { data, error } = await params.admin
    .from("user_entitlements")
    .select("plan_code, expires_at, revoked_at")
    .eq("user_id", params.userId)
    .eq("feature", params.feature)
    .is("revoked_at", null)
    .lte("starts_at", new Date().toISOString())
    .order("expires_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (error) return { ok: false, error: "entitlement_lookup_failed" }
  if (!data) return { ok: false, error: "entitlement_required" }

  const planCode = normalizePlanCode(String(data.plan_code || ""))
    if (!isPaidPlanCode(planCode)) return { ok: false, error: "paid_plan_required" }

  const expiresAt = data.expires_at ? String(data.expires_at) : null
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    return { ok: false, error: "entitlement_expired" }
  }

  return { ok: true, planCode, expiresAt }
}

export async function recordBillingAuditEvent(params: {
  admin: SupabaseClient
  actorUserId?: string | null
  targetUserId?: string | null
  action: string
  provider?: string | null
  providerEventId?: string | null
  metadata?: Record<string, unknown>
}) {
  await params.admin.from("billing_audit_events").insert({
    actor_user_id: params.actorUserId || null,
    target_user_id: params.targetUserId || null,
    action: params.action,
    provider: params.provider || null,
    provider_event_id: params.providerEventId || null,
    metadata: params.metadata || {},
  })
}

export async function applyBillingWebhookEvent(params: {
  admin: SupabaseClient
  payload: BillingWebhookPayload
}) {
  const normalized = normalizeBillingEvent(params.payload)
  if (!normalized.eventId) return { ok: false as const, error: "payment_event_id_required" }
  if (!normalized.eventType) return { ok: false as const, error: "payment_event_type_required" }

  const { error: insertError } = await params.admin.from("payment_webhook_events").insert({
    provider: normalized.provider,
    provider_event_id: normalized.eventId,
    event_type: normalized.eventType,
    user_id: normalized.userId || null,
    plan_code: normalized.planCode,
    amount: normalized.amount,
    currency: normalized.currency,
    payload: params.payload,
    signature_verified: true,
  })

  if (insertError) {
    if (String(insertError.message || "").toLowerCase().includes("duplicate")) {
      return { ok: true as const, duplicate: true }
    }
    return { ok: false as const, error: "payment_event_store_failed" }
  }

  if (!normalized.userId) {
    await recordBillingAuditEvent({
      admin: params.admin,
      action: "payment_event_without_user",
      provider: normalized.provider,
      providerEventId: normalized.eventId,
      metadata: { event_type: normalized.eventType },
    })
    return { ok: true as const, accessChanged: false }
  }

  if (ACCESS_GRANTING_EVENTS.has(normalized.eventType)) {
    const paymentValidation = validatePaymentGrantAmount(normalized)
    if (!paymentValidation.ok) {
      await recordBillingAuditEvent({
        admin: params.admin,
        targetUserId: normalized.userId,
        action: paymentValidation.error,
        provider: normalized.provider,
        providerEventId: normalized.eventId,
        metadata: {
          plan_code: normalized.planCode,
          amount: normalized.amount,
          currency: normalized.currency,
          expected_amount: paymentValidation.expectedAmount,
          expected_currency: paymentValidation.expectedCurrency,
        },
      })
      return { ok: false as const, error: paymentValidation.error }
    }

    const startsAt = normalized.currentPeriodStart || new Date().toISOString()
    const expiresAt = normalized.currentPeriodEnd || null
    const { error } = await params.admin.from("user_entitlements").upsert(
      {
        user_id: normalized.userId,
        feature: EDUCATION_VIDEO_FEATURE,
        plan_code: normalized.planCode,
        source: "payment_webhook",
        provider: normalized.provider,
        provider_customer_id: normalized.providerCustomerId,
        provider_subscription_id: normalized.providerSubscriptionId,
        starts_at: startsAt,
        expires_at: expiresAt,
        revoked_at: null,
        last_payment_event_id: normalized.eventId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,feature,source" }
    )

    if (error) return { ok: false as const, error: "entitlement_grant_failed" }

    await recordBillingAuditEvent({
      admin: params.admin,
      targetUserId: normalized.userId,
      action: "entitlement_granted_by_payment",
      provider: normalized.provider,
      providerEventId: normalized.eventId,
      metadata: { feature: EDUCATION_VIDEO_FEATURE, plan_code: normalized.planCode },
    })

    return { ok: true as const, accessChanged: true }
  }

  if (ACCESS_REVOKING_EVENTS.has(normalized.eventType)) {
    const { error } = await params.admin
      .from("user_entitlements")
      .update({
        revoked_at: new Date().toISOString(),
        last_payment_event_id: normalized.eventId,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", normalized.userId)
      .eq("source", "payment_webhook")
      .eq("feature", EDUCATION_VIDEO_FEATURE)
      .is("revoked_at", null)

    if (error) return { ok: false as const, error: "entitlement_revoke_failed" }

    await recordBillingAuditEvent({
      admin: params.admin,
      targetUserId: normalized.userId,
      action: "entitlement_revoked_by_payment",
      provider: normalized.provider,
      providerEventId: normalized.eventId,
      metadata: { feature: EDUCATION_VIDEO_FEATURE, event_type: normalized.eventType },
    })

    return { ok: true as const, accessChanged: true }
  }

  await recordBillingAuditEvent({
    admin: params.admin,
    targetUserId: normalized.userId,
    action: "payment_event_recorded_no_access_change",
    provider: normalized.provider,
    providerEventId: normalized.eventId,
    metadata: { event_type: normalized.eventType },
  })

  return { ok: true as const, accessChanged: false }
}

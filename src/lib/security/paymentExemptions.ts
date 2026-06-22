import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { PlanCode } from "@/lib/legal/documents"
import { EDUCATION_VIDEO_FEATURE } from "@/lib/security/entitlements"
import { grantReportCredits } from "@/lib/security/reportCredits"
import { isSecurityTestExemptEmail } from "@/lib/security/securityExemptions"

export const PAYMENT_EXEMPT_PLAN: Exclude<PlanCode, "none"> = "professional"

const PAYMENT_EXEMPT_EMAILS = new Set([
  "ergfurkancangi@gmail.com",
  "sevdenurtatli@icloud.com",
  "busranurtohan@gmail.com",
  "ergnurtuba@gmail.com",
])

const PRIVILEGED_PROFILE_ROLES = new Set(["admin", "owner", "super_admin", "superadmin"])

type PaymentExemptAccessResult =
  | { ok: true; applied: boolean; warning?: string }
  | { ok: false; error: string }

function normalizeEmail(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\u0131/g, "i")
    .replace(/\u0130/g, "i")
}

export function isPaymentExemptEmail(email?: string | null) {
  return PAYMENT_EXEMPT_EMAILS.has(normalizeEmail(email)) || isSecurityTestExemptEmail(email)
}

export function resolveEffectivePlan(plan?: string | null, email?: string | null): PlanCode {
  if (isPaymentExemptEmail(email)) return PAYMENT_EXEMPT_PLAN
  return plan === "student" || plan === "graduate" || plan === "professional" || plan === "enterprise"
    ? plan
    : "none"
}

function isPrivilegedProfileRole(role?: string | null) {
  return PRIVILEGED_PROFILE_ROLES.has(String(role || "").trim().toLowerCase())
}

export async function ensurePaymentExemptAccess(params: {
  admin: SupabaseClient
  userId: string
  email?: string | null
}): Promise<PaymentExemptAccessResult> {
  if (!params.userId || !isPaymentExemptEmail(params.email)) {
    return { ok: true as const, applied: false }
  }

  const now = new Date().toISOString()

  const { data: existingProfile, error: profileLookupError } = await params.admin
    .from("profiles")
    .select("role")
    .eq("user_id", params.userId)
    .maybeSingle()

  if (profileLookupError) {
    return {
      ok: true as const,
      applied: false,
      warning: "payment_exempt_profile_lookup_failed",
    }
  }

  const nextRole = isPrivilegedProfileRole(existingProfile?.role) ? existingProfile?.role : "expert"

  const { error: profileError } = await params.admin.from("profiles").upsert(
    {
      user_id: params.userId,
      role: nextRole,
      plan: PAYMENT_EXEMPT_PLAN,
      updated_at: now,
    },
    { onConflict: "user_id" }
  )

  if (profileError) {
    return {
      ok: true as const,
      applied: false,
      warning: "payment_exempt_profile_upsert_failed",
    }
  }

  const { error: entitlementError } = await params.admin.from("user_entitlements").upsert(
    {
      user_id: params.userId,
      feature: EDUCATION_VIDEO_FEATURE,
      plan_code: PAYMENT_EXEMPT_PLAN,
      source: "manual_admin",
      provider: "internal_payment_exemption",
      provider_customer_id: null,
      provider_subscription_id: null,
      starts_at: now,
      expires_at: null,
      revoked_at: null,
      last_payment_event_id: null,
      updated_at: now,
    },
    { onConflict: "user_id,feature,source" }
  )

  if (entitlementError) {
    return {
      ok: true as const,
      applied: true,
      warning: "payment_exempt_entitlement_failed",
    }
  }

  const creditGrant = await grantReportCredits({
    admin: params.admin,
    userId: params.userId,
    delta: 5,
    reason: "manual_admin_grant",
    source: "manual_admin",
    provider: "internal_payment_exemption",
    providerEventId: `payment-exempt:${params.userId}:initial-report-credits`,
    metadata: {
      email: normalizeEmail(params.email),
      reason: "payment_exempt_therapist_access",
      plan_code: PAYMENT_EXEMPT_PLAN,
    },
  })

  await params.admin.from("billing_audit_events").insert({
    actor_user_id: null,
    target_user_id: params.userId,
    action: creditGrant.ok
      ? "payment_exemption_applied"
      : "payment_exemption_applied_credit_grant_failed",
    provider: "internal_payment_exemption",
    provider_event_id: `payment-exempt:${params.userId}`,
    metadata: {
      email: normalizeEmail(params.email),
      plan_code: PAYMENT_EXEMPT_PLAN,
      feature: EDUCATION_VIDEO_FEATURE,
      report_credits: creditGrant.ok ? 5 : 0,
      credit_error: creditGrant.ok ? null : creditGrant.error,
    },
  })

  return { ok: true as const, applied: true }
}

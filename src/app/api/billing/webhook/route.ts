import { NextResponse } from "next/server"
import { checkRateLimit, getClientRateLimitKey, rateLimitResponse } from "@/lib/security/rateLimit"
import {
  applyBillingWebhookEvent,
  parseBillingWebhookPayload,
  verifyBillingWebhookSignature,
} from "@/lib/security/entitlements"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit({
    key: getClientRateLimitKey(request, "billing-webhook"),
    limit: 120,
    windowMs: 10 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  const rawBody = await request.text()
  const signatureHeader =
    request.headers.get("x-dna-signature") ||
    request.headers.get("x-payment-signature") ||
    request.headers.get("stripe-signature")

  const signature = verifyBillingWebhookSignature({
    rawBody,
    signatureHeader,
  })

  if (!signature.ok) {
    return NextResponse.json({ ok: false, error: signature.error }, { status: 401 })
  }

  const payload = parseBillingWebhookPayload(rawBody)
  if (!payload) {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  const result = await applyBillingWebhookEvent({ admin, payload })
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    duplicate: Boolean(result.duplicate),
    accessChanged: Boolean(result.accessChanged),
  })
}

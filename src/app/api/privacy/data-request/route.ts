import { NextResponse } from "next/server"
import { requireConfirmedUser, requireTrustedMutation } from "@/lib/security/apiGuards"
import { rejectServerControlledFields } from "@/lib/security/payloadGuards"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import {
  createPrivacyDataRequest,
  getPrivacyAuditContext,
  normalizePrivacyRequestType,
} from "@/lib/security/privacyOps"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  const originError = await requireTrustedMutation(request)
  if (originError) return originError

  const auth = await requireConfirmedUser()
  if (!auth.ok) return auth.response

  const rateLimit = checkRateLimit({
    key: `privacy-data-request:${auth.user.id}`,
    limit: 5,
    windowMs: 24 * 60 * 60 * 1000,
  })

  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit.resetAt)
  }

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const payloadGuard = rejectServerControlledFields(body)
  if (!payloadGuard.ok) {
    return NextResponse.json(
      { ok: false, error: "server_controlled_fields_present", fields: payloadGuard.fields },
      { status: 400 }
    )
  }

  const requestType = normalizePrivacyRequestType(body.requestType)
  if (!requestType) {
    return NextResponse.json({ ok: false, error: "request_type_invalid" }, { status: 400 })
  }

  const auditContext = await getPrivacyAuditContext()
  const admin = createSupabaseAdminClient()
  const result = await createPrivacyDataRequest({
    admin,
    userId: auth.user.id,
    requestType,
    message: String(body.message || ""),
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
  })

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true, request: result.request })
}

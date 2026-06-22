import { NextResponse } from "next/server"
import { z } from "zod"
import { requireTrustedMutation } from "@/lib/security/apiGuards"
import { rejectServerControlledFields } from "@/lib/security/payloadGuards"
import { checkRateLimit, getClientRateLimitKey, rateLimitResponse } from "@/lib/security/rateLimit"
import { readJsonWithSchema } from "@/lib/security/schemaGuards"
import { setAppSessionCookie } from "@/lib/security/appSession"
import { clearDeviceManagementCookie } from "@/lib/security/deviceManagementAccess"
import {
  registerAppSessionForUser,
  MAX_REGISTERED_DEVICES,
} from "@/lib/security/sessionRegistration"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const sessionRegisterPayloadSchema = z
  .object({
    deviceId: z.string().min(16).max(200),
    deviceType: z.enum(["desktop", "mobile", "tablet", "unknown"]).optional(),
    allowSlotReuse: z.boolean().optional(),
  })
  .passthrough()

export async function POST(request: Request) {
  const originError = await requireTrustedMutation(request)
  if (originError) return originError

  const requestRateLimit = await checkRateLimit({
    key: getClientRateLimitKey(request, "session-register"),
    limit: 20,
    windowMs: 10 * 60 * 1000,
  })
  if (!requestRateLimit.ok) return rateLimitResponse(requestRateLimit.resetAt)

  const admin = createSupabaseAdminClient()
  const supabase = await createSupabaseServerClient()
  const serverAuth = await supabase.auth.getUser()
  let user = serverAuth.data.user
  let error = serverAuth.error

  if (error || !user?.id) {
    const bearer = String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim()
    if (bearer) {
      const tokenAuth = await admin.auth.getUser(bearer)
      user = tokenAuth.data.user
      error = tokenAuth.error
    }
  }

  if (error || !user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const parsedBody = await readJsonWithSchema(request, sessionRegisterPayloadSchema)
  if (!parsedBody.ok) return parsedBody.response
  const body = parsedBody.data

  const payloadGuard = rejectServerControlledFields(body)
  if (!payloadGuard.ok) {
    return NextResponse.json(
      { ok: false, error: "server_controlled_fields_present", fields: payloadGuard.fields },
      { status: 400 }
    )
  }

  const result = await registerAppSessionForUser({
    user,
    requestHeaders: request.headers,
    deviceId: body.deviceId,
    deviceType: body.deviceType,
    allowSlotReuse: body.allowSlotReuse === true,
  })

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        ...(result.message ? { message: result.message } : {}),
      },
      { status: result.status }
    )
  }

  const response = NextResponse.json({
    ok: true,
    sessionId: result.sessionId,
    deviceId: result.deviceId,
    maxDevices: MAX_REGISTERED_DEVICES,
  })
  setAppSessionCookie(response, result.sessionId)
  clearDeviceManagementCookie(response)
  return response
}

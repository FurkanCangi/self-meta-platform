import { NextResponse } from "next/server"
import { z } from "zod"
import { clearAppSessionCookie, verifyCurrentAppSession } from "@/lib/security/appSession"
import {
  clearDeviceManagementCookie,
  clearPendingDeviceCookie,
} from "@/lib/security/deviceManagementAccess"
import { requireTrustedMutation } from "@/lib/security/apiGuards"
import { checkRateLimit, getClientRateLimitKey, rateLimitResponse } from "@/lib/security/rateLimit"
import { readJsonWithSchema } from "@/lib/security/schemaGuards"
import { recordAccountSecurityEvent } from "@/lib/security/anomalyDetection"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const logoutSchema = z.object({ scope: z.enum(["local", "global"]) })

export async function POST(request: Request) {
  const originError = await requireTrustedMutation(request)
  if (originError) return originError
  const rateLimit = await checkRateLimit({
    key: getClientRateLimitKey(request, "session-logout"),
    limit: 20,
    windowMs: 10 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  const parsed = await readJsonWithSchema(request, logoutSchema)
  if (!parsed.ok) return parsed.response
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const currentSession = await verifyCurrentAppSession(user.id)
  if (parsed.data.scope === "global" && !currentSession.ok) {
    return NextResponse.json({ ok: false, error: "Session expired" }, { status: 401 })
  }

  const admin = createSupabaseAdminClient()
  const currentSessionId = currentSession.ok ? currentSession.sessionId : null
  if (parsed.data.scope === "local" && !currentSessionId) {
      const response = NextResponse.json({ ok: true, alreadySignedOut: true })
      clearAppSessionCookie(response)
      clearDeviceManagementCookie(response)
      clearPendingDeviceCookie(response)
      return response
  }

  const { data: cleanupData, error: cleanupError } = await admin.rpc(
    "logout_account_security",
    {
      p_user_id: user.id,
      p_app_session_id: currentSessionId,
      p_global: parsed.data.scope === "global",
      p_reason: parsed.data.scope === "global" ? "global_logout" : "local_logout",
    }
  )
  const cleanup = cleanupData && typeof cleanupData === "object"
    ? (cleanupData as Record<string, unknown>)
    : null
  if (cleanupError || cleanup?.ok !== true) {
    return NextResponse.json({ ok: false, error: "session_logout_failed" }, { status: 500 })
  }

  await recordAccountSecurityEvent({
    userId: user.id,
    eventType: parsed.data.scope === "global" ? "user_global_logout" : "user_local_logout",
    deviceId: parsed.data.scope === "local" && currentSession.ok ? currentSession.deviceId : null,
    userAgent: request.headers.get("user-agent"),
    metadata: {
      scope: parsed.data.scope,
      revoked_session_count: Number(cleanup.sessionCount || 0),
    },
  })

  const response = NextResponse.json({ ok: true, scope: parsed.data.scope })
  clearAppSessionCookie(response)
  clearDeviceManagementCookie(response)
  clearPendingDeviceCookie(response)
  return response
}

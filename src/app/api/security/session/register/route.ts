import { NextResponse } from "next/server"
import { z } from "zod"
import { requireTrustedMutation } from "@/lib/security/apiGuards"
import { rejectServerControlledFields } from "@/lib/security/payloadGuards"
import { checkRateLimit, getClientRateLimitKey, rateLimitResponse } from "@/lib/security/rateLimit"
import { readJsonWithSchema } from "@/lib/security/schemaGuards"
import { setAppSessionCookie, verifyCurrentAppSession } from "@/lib/security/appSession"
import { extractSupabaseAuthSessionId } from "@/lib/security/authSessionBinding"
import { clearDeviceManagementCookie } from "@/lib/security/deviceManagementAccess"
import {
  clearPendingDeviceCookie,
  setPendingDeviceCookie,
} from "@/lib/security/deviceManagementAccess"
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
    identityVersion: z.enum(["p256-v1", "legacy-session"]).optional(),
    publicKeyJwk: z.string().max(2000).optional(),
    publicKeyFingerprint: z.string().max(200).optional(),
    proofChallengeToken: z.string().max(3000).optional(),
    proofSignature: z.string().max(1000).optional(),
    legacyDeviceId: z.string().min(16).max(200).optional(),
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
  const bearer = String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim()
  let user
  let error
  let authAccessToken: string | null = null
  if (bearer) {
    const tokenAuth = await admin.auth.getUser(bearer)
    user = tokenAuth.data.user
    error = tokenAuth.error
    if (!tokenAuth.error && tokenAuth.data.user) authAccessToken = bearer
  } else {
    const [serverAuth, serverSession] = await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.getSession(),
    ])
    user = serverAuth.data.user
    error = serverAuth.error || serverSession.error
    authAccessToken = serverSession.data.session?.access_token || null
  }

  if (error || !user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }
  const authSessionId = extractSupabaseAuthSessionId(authAccessToken)
  if (!authSessionId) {
    return NextResponse.json({ ok: false, error: "auth_session_binding_required" }, { status: 401 })
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

  let authorizedLegacyDeviceRecordId: string | null = null
  if (body.legacyDeviceId) {
    const currentSession = await verifyCurrentAppSession(user.id)
    if (currentSession.ok) authorizedLegacyDeviceRecordId = currentSession.deviceId
  }

  const result = await registerAppSessionForUser({
    user,
    requestHeaders: request.headers,
    authSessionId,
    authorizedLegacyDeviceRecordId,
    deviceId: body.deviceId,
    deviceType: body.deviceType,
    identityVersion: body.identityVersion,
    publicKeyJwk: body.publicKeyJwk,
    publicKeyFingerprint: body.publicKeyFingerprint,
    proofChallengeToken: body.proofChallengeToken,
    proofSignature: body.proofSignature,
    legacyDeviceId: body.legacyDeviceId,
  })

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        ...(result.message ? { message: result.message } : {}),
      },
      { status: result.httpStatus }
    )
  }

  if (result.status === "approval_required") {
    const response = NextResponse.json(
      {
        ok: true,
        status: result.status,
        deviceId: result.deviceId,
        challengeId: result.challengeId,
        expiresAt: result.expiresAt,
        verificationCode: result.approvalCode,
        maxDevices: result.maxDevices,
      },
      { status: 202 }
    )
    setPendingDeviceCookie(response, {
      userId: user.id,
      challengeId: result.challengeId,
      deviceId: result.deviceId,
      verificationCode: result.approvalCode,
    })
    return response
  }

  const response = NextResponse.json({
    ok: true,
    status: result.status,
    sessionId: result.sessionId,
    deviceId: result.deviceId,
    maxDevices: MAX_REGISTERED_DEVICES,
  })
  setAppSessionCookie(response, result.sessionId)
  clearDeviceManagementCookie(response)
  clearPendingDeviceCookie(response)
  return response
}

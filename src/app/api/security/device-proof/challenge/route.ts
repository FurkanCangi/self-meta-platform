import { NextResponse } from "next/server"
import { z } from "zod"
import { requireTrustedMutation } from "@/lib/security/apiGuards"
import { verifyCurrentAppSession } from "@/lib/security/appSession"
import {
  createDevicePossessionChallenge,
  createDeviceProofChallenge,
  normalizeDevicePossessionTarget,
} from "@/lib/security/deviceProof"
import {
  checkRateLimit,
  getNetworkRateLimitKey,
  getPseudonymousRateLimitKey,
  rateLimitResponse,
} from "@/lib/security/rateLimit"
import { readJsonWithSchema } from "@/lib/security/schemaGuards"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const challengeSchema = z.union([
  z
    .object({
      deviceId: z.string().min(20).max(200).regex(/^p256-[A-Za-z0-9_-]{40,100}$/),
    })
    .strict(),
  z
    .object({
      method: z.literal("POST"),
      path: z.string().min(1).max(240),
      bodyHash: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict(),
])

export async function POST(request: Request) {
  const originError = await requireTrustedMutation(request)
  if (originError) return originError

  const parsed = await readJsonWithSchema(request, challengeSchema)
  if (!parsed.ok) return parsed.response

  if ("deviceId" in parsed.data) {
    const broadRateLimit = await checkRateLimit({
      key: getNetworkRateLimitKey(request, "device-proof-challenge-broad"),
      limit: 600,
      windowMs: 10 * 60 * 1000,
    })
    if (!broadRateLimit.ok) return rateLimitResponse(broadRateLimit.resetAt)
    const deviceRateLimit = await checkRateLimit({
      key: getPseudonymousRateLimitKey("device-proof-challenge-device", [parsed.data.deviceId]),
      limit: 30,
      windowMs: 10 * 60 * 1000,
    })
    if (!deviceRateLimit.ok) return rateLimitResponse(deviceRateLimit.resetAt)
    return NextResponse.json({ ok: true, ...createDeviceProofChallenge(parsed.data.deviceId) })
  }

  const target = normalizeDevicePossessionTarget(parsed.data.method, parsed.data.path)
  if (!target) {
    return NextResponse.json(
      { ok: false, error: "device_possession_target_invalid" },
      { status: 400 }
    )
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user?.id || !user.email_confirmed_at) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const appSession = await verifyCurrentAppSession(user.id)
  if (!appSession.ok) {
    return NextResponse.json({ ok: false, error: "Session expired" }, { status: 401 })
  }

  const rateLimit = await checkRateLimit({
    key: `device-possession-challenge:${user.id}:${appSession.sessionId}`,
    limit: 300,
    windowMs: 10 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  const admin = createSupabaseAdminClient()
  const { data: device, error: deviceError } = await admin
    .from("account_devices")
    .select("verification_method, public_key_jwk, public_key_fingerprint")
    .eq("id", appSession.deviceId)
    .eq("user_id", user.id)
    .maybeSingle()
  if (deviceError || !device) {
    return NextResponse.json(
      { ok: false, error: deviceError ? "device_possession_lookup_failed" : "device_not_found" },
      { status: deviceError ? 500 : 404 }
    )
  }

  if (device.verification_method !== "p256_v1") {
    return NextResponse.json(
      { ok: true, required: false, mode: "legacy" },
      { headers: { "cache-control": "private, no-store" } }
    )
  }
  if (!device.public_key_jwk || !device.public_key_fingerprint) {
    return NextResponse.json(
      { ok: false, error: "device_possession_key_invalid" },
      { status: 403 }
    )
  }

  const challenge = createDevicePossessionChallenge({
    userId: user.id,
    sessionId: appSession.sessionId,
    deviceId: appSession.deviceId,
    publicKeyFingerprint: String(device.public_key_fingerprint),
    method: target.method,
    path: target.path,
    bodyHash: parsed.data.bodyHash,
  })
  if (!challenge) {
    return NextResponse.json(
      { ok: false, error: "device_possession_challenge_failed" },
      { status: 400 }
    )
  }

  return NextResponse.json(
    { ok: true, required: true, ...challenge },
    { headers: { "cache-control": "private, no-store" } }
  )
}

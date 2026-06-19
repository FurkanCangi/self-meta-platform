import { NextResponse } from "next/server"
import { requireConfirmedUser, requireTrustedMutation } from "@/lib/security/apiGuards"
import { rejectServerControlledFields } from "@/lib/security/payloadGuards"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import { jsonObjectSchema, parseJsonTextWithSchema } from "@/lib/security/schemaGuards"
import { proxyVideoObservationRequest } from "@/lib/video-observation/proxy"

export async function GET(request: Request) {
  const auth = await requireConfirmedUser()
  if (!auth.ok) return auth.response

  const rateLimit = await checkRateLimit({
    key: `video-observation-sessions-read:${auth.user.id}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  const url = new URL(request.url)
  const search = url.searchParams.toString()
  const upstream = await proxyVideoObservationRequest(`/sessions${search ? `?${search}` : ""}`, {
    method: "GET",
  })

  return NextResponse.json(upstream.body, { status: upstream.status })
}

export async function POST(request: Request) {
  const auth = await requireConfirmedUser()
  if (!auth.ok) return auth.response

  const originError = await requireTrustedMutation(request)
  if (originError) return originError

  const rateLimit = await checkRateLimit({
    key: `video-observation-sessions-create:${auth.user.id}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  const payload = await request.text()
  const payloadGuard = validateJsonPayload(payload)
  if (payloadGuard) return payloadGuard
  const upstream = await proxyVideoObservationRequest("/sessions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: payload,
  })

  return NextResponse.json(upstream.body, { status: upstream.status })
}

function validateJsonPayload(payload: string) {
  const parsed = parseJsonTextWithSchema(payload, jsonObjectSchema)
  if (!parsed.ok) return parsed.response
  if (!parsed.data) return null

  const guard = rejectServerControlledFields(parsed.data)
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: "server_controlled_fields_present", fields: guard.fields },
      { status: 400 }
    )
  }
  return null
}

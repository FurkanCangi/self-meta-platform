import { NextResponse } from "next/server"
import { requireConfirmedUser, requireTrustedMutation } from "@/lib/security/apiGuards"
import { rejectServerControlledFields } from "@/lib/security/payloadGuards"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import { jsonObjectSchema, parseJsonTextWithSchema } from "@/lib/security/schemaGuards"
import { videoObservationPathSegment } from "@/lib/video-observation/config"
import { proxyVideoObservationRequest } from "@/lib/video-observation/proxy"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireConfirmedUser()
  if (!auth.ok) return auth.response

  const originError = await requireTrustedMutation(request)
  if (originError) return originError

  const rateLimit = await checkRateLimit({
    key: `video-observation-presign:${auth.user.id}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  const { sessionId } = await params
  const safeSessionId = videoObservationPathSegment(sessionId)
  const payload = await request.text()
  const parsed = parseJsonTextWithSchema(payload, jsonObjectSchema)
  if (!parsed.ok) return parsed.response

  if (parsed.data) {
    const guard = rejectServerControlledFields(parsed.data)
    if (!guard.ok) {
      return NextResponse.json(
        { ok: false, error: "server_controlled_fields_present", fields: guard.fields },
        { status: 400 }
      )
    }
  }
  const upstream = await proxyVideoObservationRequest(
    `/sessions/${safeSessionId}/segments/presign`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: payload,
    }
  )

  return NextResponse.json(upstream.body, { status: upstream.status })
}

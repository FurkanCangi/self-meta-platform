import { NextResponse } from "next/server"
import { requireConfirmedUser, requireTrustedMutation } from "@/lib/security/apiGuards"
import { rejectServerControlledFields } from "@/lib/security/payloadGuards"
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

  const { sessionId } = await params
  const safeSessionId = videoObservationPathSegment(sessionId)
  const payload = await request.text()
  if (payload.trim()) {
    let parsed: unknown
    try {
      parsed = JSON.parse(payload)
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
    }

    const guard = rejectServerControlledFields(parsed)
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

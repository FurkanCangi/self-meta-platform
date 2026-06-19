import { NextResponse } from "next/server"
import { requireConfirmedUser } from "@/lib/security/apiGuards"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import { videoObservationPathSegment } from "@/lib/video-observation/config"
import { proxyVideoObservationRequest } from "@/lib/video-observation/proxy"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireConfirmedUser()
  if (!auth.ok) return auth.response

  const rateLimit = await checkRateLimit({
    key: `video-observation-status:${auth.user.id}`,
    limit: 240,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  const { sessionId } = await params
  const safeSessionId = videoObservationPathSegment(sessionId)
  const upstream = await proxyVideoObservationRequest(
    `/processing/${safeSessionId}/status`,
    {
      method: "GET",
    }
  )

  return NextResponse.json(upstream.body, { status: upstream.status })
}

import { NextResponse } from "next/server"
import { requireConfirmedUser } from "@/lib/security/apiGuards"
import { videoObservationPathSegment } from "@/lib/video-observation/config"
import { proxyVideoObservationRequest } from "@/lib/video-observation/proxy"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireConfirmedUser()
  if (!auth.ok) return auth.response

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

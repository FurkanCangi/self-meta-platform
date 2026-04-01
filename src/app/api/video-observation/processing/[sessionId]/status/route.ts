import { NextResponse } from "next/server"
import { proxyVideoObservationRequest } from "@/lib/video-observation/proxy"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const upstream = await proxyVideoObservationRequest(
    `/processing/${sessionId}/status`,
    {
      method: "GET",
    }
  )

  return NextResponse.json(upstream.body, { status: upstream.status })
}

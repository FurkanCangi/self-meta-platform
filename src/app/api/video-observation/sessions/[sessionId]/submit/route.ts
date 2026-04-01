import { NextResponse } from "next/server"
import { proxyVideoObservationRequest } from "@/lib/video-observation/proxy"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const payload = await request.text()
  const upstream = await proxyVideoObservationRequest(`/sessions/${sessionId}/submit`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: payload,
  })

  return NextResponse.json(upstream.body, { status: upstream.status })
}

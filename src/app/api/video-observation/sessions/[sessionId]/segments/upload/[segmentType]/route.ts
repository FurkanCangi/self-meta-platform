import { NextResponse } from "next/server"
import { proxyVideoObservationRequest } from "@/lib/video-observation/proxy"

export async function PUT(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ sessionId: string; segmentType: string }>
  }
) {
  const { sessionId, segmentType } = await params
  const url = new URL(request.url)
  const uploadKey = url.searchParams.get("upload_key")

  if (!uploadKey) {
    return NextResponse.json(
      { detail: "upload_key_missing" },
      { status: 400 }
    )
  }

  const body = Buffer.from(await request.arrayBuffer())
  const contentType = request.headers.get("content-type") || "video/mp4"

  const upstream = await proxyVideoObservationRequest(
    `/sessions/${sessionId}/segments/upload/${segmentType}?upload_key=${encodeURIComponent(uploadKey)}`,
    {
      method: "PUT",
      headers: {
        "content-type": contentType,
      },
      body,
    }
  )

  return NextResponse.json(upstream.body, { status: upstream.status })
}

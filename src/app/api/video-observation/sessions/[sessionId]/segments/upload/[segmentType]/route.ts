import { NextResponse } from "next/server"
import { requireConfirmedUser, requireTrustedMutation } from "@/lib/security/apiGuards"
import { videoObservationPathSegment } from "@/lib/video-observation/config"
import { proxyVideoObservationRequest } from "@/lib/video-observation/proxy"

const MAX_VIDEO_SEGMENT_BYTES = 100 * 1024 * 1024

function hasAllowedVideoSignature(body: Buffer) {
  if (body.length >= 12 && body.subarray(4, 8).toString("ascii") === "ftyp") return true
  if (body.length >= 4 && body[0] === 0x1a && body[1] === 0x45 && body[2] === 0xdf && body[3] === 0xa3) {
    return true
  }
  return false
}

export async function PUT(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ sessionId: string; segmentType: string }>
  }
) {
  const auth = await requireConfirmedUser()
  if (!auth.ok) return auth.response

  const originError = await requireTrustedMutation(request)
  if (originError) return originError

  const { sessionId, segmentType } = await params
  const safeSessionId = videoObservationPathSegment(sessionId)
  const safeSegmentType = videoObservationPathSegment(segmentType)
  const url = new URL(request.url)
  const uploadKey = url.searchParams.get("upload_key")

  if (!uploadKey) {
    return NextResponse.json(
      { detail: "upload_key_missing" },
      { status: 400 }
    )
  }

  const contentLength = Number(request.headers.get("content-length") || "0")
  if (contentLength > MAX_VIDEO_SEGMENT_BYTES) {
    return NextResponse.json({ detail: "video_segment_too_large" }, { status: 413 })
  }

  const body = Buffer.from(await request.arrayBuffer())
  if (body.byteLength > MAX_VIDEO_SEGMENT_BYTES) {
    return NextResponse.json({ detail: "video_segment_too_large" }, { status: 413 })
  }

  const contentType = request.headers.get("content-type") || "video/mp4"
  if (!contentType.toLowerCase().startsWith("video/")) {
    return NextResponse.json({ detail: "video_content_type_invalid" }, { status: 415 })
  }

  if (!hasAllowedVideoSignature(body)) {
    return NextResponse.json({ detail: "video_signature_invalid" }, { status: 415 })
  }

  const upstream = await proxyVideoObservationRequest(
    `/sessions/${safeSessionId}/segments/upload/${safeSegmentType}?upload_key=${encodeURIComponent(uploadKey)}`,
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

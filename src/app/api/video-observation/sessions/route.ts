import { NextResponse } from "next/server"
import { proxyVideoObservationRequest } from "@/lib/video-observation/proxy"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const search = url.searchParams.toString()
  const upstream = await proxyVideoObservationRequest(`/sessions${search ? `?${search}` : ""}`, {
    method: "GET",
  })

  return NextResponse.json(upstream.body, { status: upstream.status })
}

export async function POST(request: Request) {
  const payload = await request.text()
  const upstream = await proxyVideoObservationRequest("/sessions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: payload,
  })

  return NextResponse.json(upstream.body, { status: upstream.status })
}

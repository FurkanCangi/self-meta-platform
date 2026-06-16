import { NextResponse } from "next/server"
import { requireConfirmedUser, requireTrustedMutation } from "@/lib/security/apiGuards"
import { rejectServerControlledFields } from "@/lib/security/payloadGuards"
import { proxyVideoObservationRequest } from "@/lib/video-observation/proxy"

export async function GET(request: Request) {
  const auth = await requireConfirmedUser()
  if (!auth.ok) return auth.response

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
  if (!payload.trim()) return null
  try {
    const parsed = JSON.parse(payload)
    const guard = rejectServerControlledFields(parsed)
    if (!guard.ok) {
      return NextResponse.json(
        { ok: false, error: "server_controlled_fields_present", fields: guard.fields },
        { status: 400 }
      )
    }
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }
  return null
}

import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { requireTrustedMutation } from "@/lib/security/apiGuards"
import { rejectServerControlledFields } from "@/lib/security/payloadGuards"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getAcceptedDocumentsSnapshot, normalizePlanCode } from "@/lib/legal/documents"

function getClientIp(headerStore: Headers) {
  const forwardedFor = headerStore.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || null
  return headerStore.get("x-real-ip") || null
}

export async function POST(request: Request) {
  const originError = await requireTrustedMutation(request)
  if (originError) return originError

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user?.id || !user.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {}

  const payloadGuard = rejectServerControlledFields(body)
  if (!payloadGuard.ok) {
    return NextResponse.json(
      { ok: false, error: "server_controlled_fields_present", fields: payloadGuard.fields },
      { status: 400 }
    )
  }

  const admin = createSupabaseAdminClient()
  const headerStore = await headers()
  const userAgent = headerStore.get("user-agent")
  const sourcePath = String(body.sourcePath || "").slice(0, 500)
  const requestedPlan = normalizePlanCode(String(body.planCode || ""))

  const { data: profile } = await admin
    .from("profiles")
    .select("plan")
    .eq("user_id", user.id)
    .maybeSingle()

  const planCode = requestedPlan === "none" ? normalizePlanCode(profile?.plan) : requestedPlan
  const acceptedDocuments = getAcceptedDocumentsSnapshot()

  const { data, error: insertError } = await admin
    .from("legal_acceptances")
    .insert({
      user_id: user.id,
      email: user.email,
      plan_code: planCode,
      accepted_documents: acceptedDocuments,
      ip_address: getClientIp(headerStore),
      user_agent: userAgent,
      source_path: sourcePath || null,
    })
    .select("id, accepted_at, plan_code")
    .single()

  if (insertError) {
    return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    acceptance: data,
    documents: acceptedDocuments,
  })
}

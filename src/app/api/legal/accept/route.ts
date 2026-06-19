import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireTrustedMutation } from "@/lib/security/apiGuards"
import { rejectServerControlledFields } from "@/lib/security/payloadGuards"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import { readJsonWithSchema } from "@/lib/security/schemaGuards"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getAcceptedDocumentsSnapshot, normalizePlanCode } from "@/lib/legal/documents"

function getClientIp(headerStore: Headers) {
  const forwardedFor = headerStore.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || null
  return headerStore.get("x-real-ip") || null
}

const legalAcceptPayloadSchema = z
  .object({
    sourcePath: z.string().max(500).optional().nullable(),
    planCode: z.string().max(80).optional().nullable(),
  })
  .passthrough()

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

  const rateLimit = await checkRateLimit({
    key: `legal-accept:${user.id}`,
    limit: 12,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  const parsedBody = await readJsonWithSchema(request, legalAcceptPayloadSchema)
  if (!parsedBody.ok) return parsedBody.response
  const body = parsedBody.data

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
    return NextResponse.json({ ok: false, error: "legal_acceptance_failed" }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    acceptance: data,
    documents: acceptedDocuments,
  })
}

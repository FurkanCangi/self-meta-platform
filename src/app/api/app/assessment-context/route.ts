import { NextResponse } from "next/server"
import { z } from "zod"
import { requireConfirmedUser, requireTrustedMutation } from "@/lib/security/apiGuards"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { isOwnerAuditEmail } from "@/lib/owner/ownerAccess"

function isAdminRole(role?: string | null) {
  return ["admin", "owner", "super_admin", "yonetici", "yönetici"].includes(String(role || "").toLowerCase())
}

const createAssessmentSchema = z.object({
  clientId: z.string().uuid(),
})

async function getAccessibleClient(params: {
  userId: string
  userEmail?: string | null
  clientId?: string | null
  clientCode?: string | null
}) {
  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("user_id", params.userId)
    .maybeSingle()

  const elevated = isOwnerAuditEmail(params.userEmail) || isAdminRole(profile?.role)
  const clientId = String(params.clientId || "").trim()
  const clientCode = String(params.clientCode || "").trim()

  if (!clientId && !clientCode) {
    return { ok: false as const, status: 400, error: "client_required" }
  }

  let query = admin
    .from("clients")
    .select("id, owner_id, child_code, anamnez")
    .is("deleted_at", null)
    .limit(1)

  query = clientId ? query.eq("id", clientId) : query.eq("child_code", clientCode)
  if (!elevated) query = query.eq("owner_id", params.userId)

  const { data, error } = await query
  if (error) return { ok: false as const, status: 500, error: "client_lookup_failed" }

  const row = data?.[0]
  if (!row?.id) return { ok: false as const, status: 404, error: "client_not_found" }

  return { ok: true as const, admin, elevated, client: row }
}

async function getReportLock(admin: ReturnType<typeof createSupabaseAdminClient>, clientId: string) {
  const { data: assessments, error: assessmentsError } = await admin
    .from("assessments_v2")
    .select("id")
    .eq("client_id", clientId)
    .is("deleted_at", null)

  if (assessmentsError || !assessments?.length) {
    return { locked: false, reason: "" }
  }

  const assessmentIds = assessments.map((row: any) => row.id).filter(Boolean)
  if (assessmentIds.length === 0) return { locked: false, reason: "" }

  const { data: reports, error: reportsError } = await admin
    .from("reports")
    .select("id, created_at")
    .in("assessment_id", assessmentIds)
    .not("report_text", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)

  if (reportsError || !reports?.length) return { locked: false, reason: "" }

  return {
    locked: true,
    reason: "Bu vaka için rapor daha önce oluşturulmuş. Mevcut raporu Rapor Geçmişi ekranından görüntüleyebilirsiniz.",
    reportId: reports[0]?.id || null,
    reportCreatedAt: reports[0]?.created_at || null,
  }
}

export async function GET(request: Request) {
  const auth = await requireConfirmedUser()
  if (!auth.ok) return auth.response

  const rateLimit = await checkRateLimit({
    key: `assessment-context:${auth.user.id}`,
    limit: 180,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  const url = new URL(request.url)
  const access = await getAccessibleClient({
    userId: auth.user.id,
    userEmail: auth.user.email,
    clientId: url.searchParams.get("client_id"),
    clientCode: url.searchParams.get("client"),
  })

  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  }

  const reportLock = await getReportLock(access.admin, access.client.id)

  return NextResponse.json({
    ok: true,
    client: {
      id: access.client.id,
      child_code: access.client.child_code || "",
      anamnez: access.client.anamnez || "",
    },
    reportLock,
  })
}

export async function POST(request: Request) {
  const trusted = await requireTrustedMutation(request)
  if (trusted) return trusted

  const auth = await requireConfirmedUser()
  if (!auth.ok) return auth.response

  const rateLimit = await checkRateLimit({
    key: `assessment-create:${auth.user.id}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  const body = await request.json().catch(() => null)
  const parsed = createAssessmentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 })
  }

  const access = await getAccessibleClient({
    userId: auth.user.id,
    userEmail: auth.user.email,
    clientId: parsed.data.clientId,
  })

  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  }

  const reportLock = await getReportLock(access.admin, access.client.id)
  if (reportLock.locked) {
    return NextResponse.json({ ok: false, error: "report_already_exists", reportLock }, { status: 409 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await access.admin
    .from("assessments_v2")
    .insert({
      client_id: access.client.id,
      label: "DNA Intelligence Değerlendirme",
      assessment_date: today,
    })
    .select("id")
    .single()

  if (error || !data?.id) {
    return NextResponse.json({ ok: false, error: "assessment_create_failed" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, assessmentId: data.id })
}

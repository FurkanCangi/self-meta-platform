import { NextResponse } from "next/server"
import { assertOwnerAuditAccess } from "@/lib/owner/ownerAccess"
import { isMissingOwnerBulkEmailTable, type OwnerEmailCampaignRow } from "@/lib/owner/ownerBulkEmail"
import { requireConfirmedUser } from "@/lib/security/apiGuards"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

async function requireOwner() {
  const auth = await requireConfirmedUser()
  if (!auth.ok) return auth

  try {
    assertOwnerAuditAccess(auth.user.email)
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }),
    }
  }

  return auth
}

export async function GET() {
  const owner = await requireOwner()
  if (!owner.ok) return owner.response

  const rateLimit = await checkRateLimit({
    key: `owner-bulk-email:list:${owner.user.id}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  try {
    const admin = createSupabaseAdminClient()
    const { data, error } = await admin
      .from("owner_email_campaigns")
      .select(
        "id,campaign_type,audience,plan_code,subject,preview_text,body,action_label,action_url,status,recipient_count,sent_count,failed_count,skipped_count,created_at,started_at,completed_at,error_message",
      )
      .order("created_at", { ascending: false })
      .limit(30)

    if (error) throw error

    return NextResponse.json({ ok: true, campaigns: (data || []) as OwnerEmailCampaignRow[] })
  } catch (error) {
    if (isMissingOwnerBulkEmailTable(error)) {
      return NextResponse.json({ ok: true, campaigns: [], setupRequired: true })
    }

    console.error("[owner-emails] list failed", error)
    return NextResponse.json({ ok: false, error: "Toplu mail geçmişi yüklenemedi." }, { status: 500 })
  }
}

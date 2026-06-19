import { NextResponse } from "next/server"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { isOwnerAuditEmail } from "@/lib/owner/ownerAccess"
import { isOwnerAuditConfigured } from "@/lib/owner/ownerAudit"

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user?.email) {
      return NextResponse.json({ ok: true, allowed: false, configured: isOwnerAuditConfigured() })
    }

    const rateLimit = await checkRateLimit({
      key: `owner-audit-status:${user.id}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    })
    if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

    return NextResponse.json({
      ok: true,
      allowed: isOwnerAuditEmail(user.email),
      configured: isOwnerAuditConfigured(),
    })
  } catch {
    return NextResponse.json({ ok: true, allowed: false, configured: false })
  }
}

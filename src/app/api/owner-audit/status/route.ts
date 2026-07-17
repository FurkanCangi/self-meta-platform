import { NextResponse } from "next/server"
import { requireConfirmedUser } from "@/lib/security/apiGuards"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import { isOwnerAuditEmail } from "@/lib/owner/ownerAccess"
import { isOwnerAuditConfigured } from "@/lib/owner/ownerAudit"

export async function GET() {
  try {
    const auth = await requireConfirmedUser()
    if (!auth.ok || !auth.user.email) {
      return NextResponse.json({ ok: true, allowed: false, configured: isOwnerAuditConfigured() })
    }
    const user = auth.user

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

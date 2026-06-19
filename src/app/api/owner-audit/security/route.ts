import { NextResponse } from "next/server"
import { assertOwnerAuditAccess } from "@/lib/owner/ownerAccess"
import { fetchOwnerSecurityDashboard } from "@/lib/owner/ownerSecurity"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user?.id || !user.email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    assertOwnerAuditAccess(user.email)

    const rateLimit = await checkRateLimit({
      key: `owner-security-read:${user.id}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    })
    if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

    const url = new URL(request.url)
    const dashboard = await fetchOwnerSecurityDashboard({
      q: url.searchParams.get("q") || "",
      category: url.searchParams.get("category") || "all",
      risk: url.searchParams.get("risk") || "all",
      from: url.searchParams.get("from") || "",
      to: url.searchParams.get("to") || "",
    })

    return NextResponse.json({ ok: true, dashboard })
  } catch {
    return NextResponse.json({ ok: false, error: "owner_security_fetch_failed" }, { status: 403 })
  }
}

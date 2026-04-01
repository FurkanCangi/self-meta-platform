import { NextResponse } from "next/server"
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

    return NextResponse.json({
      ok: true,
      allowed: isOwnerAuditEmail(user.email),
      configured: isOwnerAuditConfigured(),
    })
  } catch {
    return NextResponse.json({ ok: true, allowed: false, configured: false })
  }
}

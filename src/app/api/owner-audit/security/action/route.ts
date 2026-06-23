import { NextResponse } from "next/server"
import { z } from "zod"
import { assertOwnerAuditAccess } from "@/lib/owner/ownerAccess"
import { applyOwnerSecurityAction } from "@/lib/owner/ownerSecurity"
import { requireTrustedMutation } from "@/lib/security/apiGuards"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import { readJsonWithSchema } from "@/lib/security/schemaGuards"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const ownerSecurityActionSchema = z.object({
  targetUserId: z.string().uuid(),
  action: z.enum([
    "revoke_sessions",
    "revoke_device",
    "mark_review",
    "clear_review",
    "clear_risk",
    "clear_event_type",
    "hide_from_security",
    "restore_to_security",
    "temporary_lock",
    "clear_lock",
    "suspend",
    "unsuspend",
  ]),
  reason: z.string().trim().min(3).max(500),
  deviceId: z.string().uuid().optional().nullable(),
  eventType: z.string().trim().min(2).max(120).optional().nullable(),
  lockMinutes: z.coerce.number().int().min(5).max(1440).optional().nullable(),
})

export async function POST(request: Request) {
  const originError = await requireTrustedMutation(request)
  if (originError) return originError

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
      key: `owner-security-action:${user.id}`,
      limit: 30,
      windowMs: 60 * 60 * 1000,
    })
    if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

    const parsed = await readJsonWithSchema(request, ownerSecurityActionSchema)
    if (!parsed.ok) return parsed.response

    const result = await applyOwnerSecurityAction({
      actorUserId: user.id,
      targetUserId: parsed.data.targetUserId,
      action: parsed.data.action,
      reason: parsed.data.reason,
      deviceId: parsed.data.deviceId,
      eventType: parsed.data.eventType,
      lockMinutes: parsed.data.lockMinutes,
    })

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: "owner_security_action_failed" }, { status: 403 })
  }
}

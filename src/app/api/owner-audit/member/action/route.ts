import { NextResponse } from "next/server"
import { z } from "zod"
import { assertOwnerAuditAccess } from "@/lib/owner/ownerAccess"
import { applyOwnerMemberAction } from "@/lib/owner/ownerMemberActions"
import { requireTrustedMutation } from "@/lib/security/apiGuards"
import { rejectServerControlledFields } from "@/lib/security/payloadGuards"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import { readJsonWithSchema } from "@/lib/security/schemaGuards"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const ownerMemberActionSchema = z
  .object({
    targetUserId: z.string().uuid(),
    action: z.enum(["delete_member_account", "hide_member_from_owner", "restore_member_to_owner"]),
    reason: z.string().trim().min(3).max(500),
  })
  .passthrough()

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
      key: `owner-member-action:${user.id}`,
      limit: 12,
      windowMs: 60 * 60 * 1000,
    })
    if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

    const parsed = await readJsonWithSchema(request, ownerMemberActionSchema)
    if (!parsed.ok) return parsed.response

    const payloadGuard = rejectServerControlledFields(parsed.data)
    if (!payloadGuard.ok) {
      return NextResponse.json(
        { ok: false, error: "server_controlled_fields_present", fields: payloadGuard.fields },
        { status: 400 }
      )
    }

    const result = await applyOwnerMemberAction({
      actorUserId: user.id,
      targetUserId: parsed.data.targetUserId,
      action: parsed.data.action,
      reason: parsed.data.reason,
    })

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: "owner_member_action_failed" }, { status: 403 })
  }
}

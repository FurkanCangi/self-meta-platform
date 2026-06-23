import "server-only"

import { isOwnerAuditEmail } from "@/lib/owner/ownerAccess"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export type OwnerMemberAction = "delete_member_account"

export async function applyOwnerMemberAction(params: {
  actorUserId: string
  targetUserId: string
  action: OwnerMemberAction
  reason: string
}) {
  const actorUserId = String(params.actorUserId || "").trim()
  const targetUserId = String(params.targetUserId || "").trim()
  const reason = String(params.reason || "").trim()

  if (!actorUserId || !targetUserId) return { ok: false as const, error: "user_id_required" }
  if (actorUserId === targetUserId) return { ok: false as const, error: "owner_self_delete_blocked" }
  if (params.action !== "delete_member_account") return { ok: false as const, error: "action_invalid" }

  const admin = createSupabaseAdminClient()
  const timestamp = new Date().toISOString()
  const { data: targetUser, error: lookupError } = await admin.auth.admin.getUserById(targetUserId)

  if (lookupError || !targetUser?.user) {
    return { ok: false as const, error: "member_auth_user_missing" }
  }

  const targetEmail = String(targetUser.user.email || "").trim().toLowerCase()
  if (isOwnerAuditEmail(targetEmail)) {
    return { ok: false as const, error: "owner_account_delete_blocked" }
  }

  await admin
    .from("account_sessions")
    .update({ status: "revoked", revoked_at: timestamp })
    .eq("user_id", targetUserId)
    .eq("status", "active")

  await admin
    .from("account_devices")
    .update({ revoked_at: timestamp })
    .eq("user_id", targetUserId)
    .is("revoked_at", null)

  const metadata = {
    owner_action: params.action,
    actor_user_id: actorUserId,
    target_user_id: targetUserId,
    target_email: targetEmail,
    reason,
    deleted_at: timestamp,
    retained_records: ["clients", "assessments_v2", "reports", "owner_audit.audit_events"],
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(targetUserId)
  if (deleteError) {
    return { ok: false as const, error: "member_auth_delete_failed" }
  }

  await admin.from("therapist_directory_profiles").delete().eq("user_id", targetUserId)
  await admin.from("profiles").delete().eq("user_id", targetUserId)

  await admin.from("billing_audit_events").insert({
    actor_user_id: actorUserId,
    target_user_id: null,
    action: "owner_member_deleted",
    provider: "owner_panel",
    created_at: timestamp,
    metadata,
  })

  return { ok: true as const }
}

import "server-only"

import { isOwnerAuditEmail } from "@/lib/owner/ownerAccess"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export type OwnerMemberAction = "delete_member_account" | "hide_member_from_owner" | "restore_member_to_owner"

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
  if (!["delete_member_account", "hide_member_from_owner", "restore_member_to_owner"].includes(params.action)) {
    return { ok: false as const, error: "action_invalid" }
  }

  const admin = createSupabaseAdminClient()
  const timestamp = new Date().toISOString()

  if (params.action === "hide_member_from_owner" || params.action === "restore_member_to_owner") {
    const metadata = {
      owner_action: params.action,
      actor_user_id: actorUserId,
      target_user_id: targetUserId,
      reason,
      changed_at: timestamp,
    }

    const { error } = await admin.from("account_security_events").insert({
      user_id: targetUserId,
      event_type: params.action === "hide_member_from_owner" ? "owner_member_panel_hidden" : "owner_member_panel_restored",
      created_at: timestamp,
      metadata,
    })
    if (error) {
      return {
        ok: false as const,
        error: params.action === "hide_member_from_owner" ? "member_hide_failed" : "member_restore_failed",
      }
    }

    await admin.from("billing_audit_events").insert({
      actor_user_id: actorUserId,
      target_user_id: targetUserId,
      action: params.action,
      provider: "owner_panel",
      created_at: timestamp,
      metadata,
    })

    return { ok: true as const }
  }

  if (actorUserId === targetUserId) return { ok: false as const, error: "owner_self_delete_blocked" }
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

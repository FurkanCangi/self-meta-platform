import { NextResponse } from "next/server"
import { z } from "zod"
import { assertOwnerAuditAccess } from "@/lib/owner/ownerAccess"
import { requireConfirmedUser, requireTrustedMutation } from "@/lib/security/apiGuards"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import { readJsonWithSchema } from "@/lib/security/schemaGuards"
import { isMissingSupportTable } from "@/lib/support/supportTickets"
import { sendSupportTicketResolvedEmail } from "@/lib/support/supportEmail"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const ownerSupportActionSchema = z.object({
  ticketId: z.string().uuid(),
  status: z.enum(["open", "in_progress", "waiting_user", "resolved", "closed"]).optional(),
  ownerNote: z.string().trim().max(3000).optional().nullable(),
  resolutionMessage: z.string().trim().max(3000).optional().nullable(),
  publicReply: z.string().trim().max(3000).optional().nullable(),
  confirmResolved: z.boolean().optional().default(false),
})

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

export async function POST(request: Request) {
  const trusted = await requireTrustedMutation(request)
  if (trusted) return trusted

  const owner = await requireOwner()
  if (!owner.ok) return owner.response

  const rateLimit = await checkRateLimit({
    key: `owner-support-action:${owner.user.id}`,
    limit: 80,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  const parsed = await readJsonWithSchema(request, ownerSupportActionSchema)
  if (!parsed.ok) return parsed.response

  if (parsed.data.status === "resolved" && !parsed.data.confirmResolved) {
    return NextResponse.json({ ok: false, error: "resolved_confirmation_required" }, { status: 400 })
  }

  try {
    const admin = createSupabaseAdminClient()
    const { data: existing, error: lookupError } = await admin
      .from("support_tickets")
      .select("id,user_id,ticket_no,requester_email,subject,status")
      .eq("id", parsed.data.ticketId)
      .maybeSingle()

    if (lookupError) throw lookupError
    if (!existing) {
      return NextResponse.json({ ok: false, error: "ticket_not_found" }, { status: 404 })
    }

    const now = new Date().toISOString()
    const update: Record<string, unknown> = {
      updated_at: now,
      assigned_owner_id: owner.user.id,
    }

    if (parsed.data.status) {
      update.status = parsed.data.status
      if (parsed.data.status === "resolved") update.resolved_at = now
      if (parsed.data.status === "closed") update.closed_at = now
    }
    if (parsed.data.ownerNote !== undefined) update.owner_note = parsed.data.ownerNote || null
    if (parsed.data.status === "resolved" && parsed.data.resolutionMessage === undefined && parsed.data.publicReply) {
      update.resolution_message = parsed.data.publicReply
      update.last_owner_message_at = now
    }
    if (parsed.data.resolutionMessage !== undefined) {
      update.resolution_message = parsed.data.resolutionMessage || null
      if (parsed.data.resolutionMessage) {
        update.last_owner_message_at = now
      }
    }

    const { error: updateError } = await admin
      .from("support_tickets")
      .update(update)
      .eq("id", parsed.data.ticketId)

    if (updateError) throw updateError

    const publicMessage = parsed.data.publicReply || parsed.data.resolutionMessage || ""
    if (publicMessage.trim()) {
      const { error: messageError } = await admin.from("support_ticket_messages").insert({
        ticket_id: parsed.data.ticketId,
        sender_user_id: owner.user.id,
        sender_role: "owner",
        message: publicMessage.trim(),
      })
      if (messageError) throw messageError
    }

    if (existing.user_id && (parsed.data.status || publicMessage.trim())) {
      await admin.from("notifications").insert({
        title: "Destek talebiniz güncellendi",
        message:
          parsed.data.status === "resolved"
            ? `${existing.ticket_no} numaralı talebiniz çözüldü. Destek alanından yanıtı kontrol edebilirsiniz.`
            : `${existing.ticket_no} numaralı talebiniz güncellendi. Destek alanından kontrol edebilirsiniz.`,
        kind: "system",
        audience: "owners",
        target_user_ids: [existing.user_id],
        action_label: "Talebi Aç",
        action_url: "/support",
        status: "published",
        published_at: now,
        created_by: owner.user.id,
      })
    }

    let resolvedEmailSent = false
    if (parsed.data.status === "resolved" && existing.status !== "resolved") {
      const supportUrl = `${new URL(request.url).origin}/support`
      const emailResult = await sendSupportTicketResolvedEmail({
        to: existing.requester_email,
        ticketNo: existing.ticket_no,
        subject: existing.subject,
        resolutionMessage:
          parsed.data.resolutionMessage ||
          parsed.data.publicReply ||
          "Destek talebiniz çözüldü. Destek ekranından detayları kontrol edebilirsiniz.",
        supportUrl,
      }).catch((emailError) => {
        console.error("[owner-support] resolved email failed", {
          ticketNo: existing.ticket_no,
          error: emailError instanceof Error ? emailError.message : "unknown",
        })
        return { sent: false as const, skipped: "send_failed" as const }
      })
      resolvedEmailSent = Boolean(emailResult.sent)
    }

    return NextResponse.json({ ok: true, resolvedEmailSent })
  } catch (error) {
    if (isMissingSupportTable(error)) {
      return NextResponse.json({ ok: false, error: "support_tables_missing" }, { status: 503 })
    }
    console.error("[owner-support] action failed", error)
    return NextResponse.json({ ok: false, error: "owner_support_action_failed" }, { status: 500 })
  }
}

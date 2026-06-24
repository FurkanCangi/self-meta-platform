import { NextResponse } from "next/server"
import { z } from "zod"
import { assertOwnerAuditAccess } from "@/lib/owner/ownerAccess"
import {
  isMissingOwnerBulkEmailTable,
  isOwnerBulkEmailConfigured,
  resolveOwnerEmailRecipients,
  sendOwnerBulkEmailToRecipient,
  type OwnerEmailRecipient,
} from "@/lib/owner/ownerBulkEmail"
import { requireConfirmedUser, requireTrustedMutation } from "@/lib/security/apiGuards"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import { readJsonWithSchema } from "@/lib/security/schemaGuards"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const sendSchema = z.object({
  campaignType: z.enum(["system", "education", "marketing"]),
  audience: z.enum(["all", "therapists", "owners", "plan", "manual"]),
  planCode: z.string().trim().max(80).optional().nullable(),
  subject: z.string().trim().min(3).max(160),
  previewText: z.string().trim().max(180).optional().nullable(),
  body: z.string().trim().min(10).max(5000),
  actionLabel: z.string().trim().max(60).optional().nullable(),
  actionUrl: z.string().trim().max(300).optional().nullable(),
  manualEmails: z.array(z.string().trim().email()).max(500).optional().default([]),
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

async function insertRecipientRows(campaignId: string, recipients: OwnerEmailRecipient[]) {
  const admin = createSupabaseAdminClient()
  if (!recipients.length) return

  const rows = recipients.map((recipient) => ({
    campaign_id: campaignId,
    user_id: recipient.userId,
    email: recipient.email,
    full_name: recipient.fullName || null,
    status: "pending",
  }))

  for (let index = 0; index < rows.length; index += 100) {
    const { error } = await admin.from("owner_email_recipients").insert(rows.slice(index, index + 100))
    if (error) throw error
  }
}

async function auditOwnerBulkEmail(params: {
  ownerId: string
  campaignId: string
  recipientCount: number
  campaignType: string
  audience: string
}) {
  const admin = createSupabaseAdminClient()
  try {
    await admin
      .from("account_security_events")
      .insert({
        user_id: params.ownerId,
        event_type: "owner_bulk_email_sent",
        severity: "info",
        metadata: {
          campaign_id: params.campaignId,
          recipient_count: params.recipientCount,
          campaign_type: params.campaignType,
          audience: params.audience,
        },
      })
      .throwOnError()
  } catch {
    // Audit failure must not make a successful mail delivery look failed.
  }
}

export async function POST(request: Request) {
  const trusted = await requireTrustedMutation(request)
  if (trusted) return trusted

  const owner = await requireOwner()
  if (!owner.ok) return owner.response

  const rateLimit = await checkRateLimit({
    key: `owner-bulk-email:send:${owner.user.id}`,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  const parsed = await readJsonWithSchema(request, sendSchema)
  if (!parsed.ok) return parsed.response

  if (parsed.data.audience === "plan" && !parsed.data.planCode) {
    return NextResponse.json({ ok: false, error: "Paket seçimi gerekli." }, { status: 400 })
  }

  if (!isOwnerBulkEmailConfigured()) {
    return NextResponse.json({ ok: false, error: "Mail ayarı tamamlanmamış. SMTP bilgileri eksik." }, { status: 503 })
  }

  try {
    const recipients = await resolveOwnerEmailRecipients(parsed.data)
    if (recipients.length === 0) {
      return NextResponse.json({ ok: false, error: "Gönderilecek alıcı bulunamadı." }, { status: 400 })
    }

    const admin = createSupabaseAdminClient()
    const now = new Date().toISOString()
    const { data: campaign, error: campaignError } = await admin
      .from("owner_email_campaigns")
      .insert({
        campaign_type: parsed.data.campaignType,
        audience: parsed.data.audience,
        plan_code: parsed.data.audience === "plan" ? parsed.data.planCode : null,
        subject: parsed.data.subject,
        preview_text: parsed.data.previewText || null,
        body: parsed.data.body,
        action_label: parsed.data.actionLabel || null,
        action_url: parsed.data.actionUrl || null,
        status: "sending",
        recipient_count: recipients.length,
        created_by: owner.user.id,
        started_at: now,
      })
      .select("id")
      .single()

    if (campaignError) throw campaignError

    const campaignId = String(campaign.id)
    await insertRecipientRows(campaignId, recipients)

    let sentCount = 0
    let failedCount = 0

    for (const recipient of recipients) {
      try {
        const result = await sendOwnerBulkEmailToRecipient({
          recipient,
          campaign: parsed.data,
          appOrigin: new URL(request.url).origin,
        })

        if (!result.sent) throw new Error(result.error)

        sentCount += 1
        await admin
          .from("owner_email_recipients")
          .update({ status: "sent", sent_at: new Date().toISOString(), error_message: null })
          .eq("campaign_id", campaignId)
          .eq("email", recipient.email)
      } catch (error) {
        failedCount += 1
        await admin
          .from("owner_email_recipients")
          .update({
            status: "failed",
            error_message: error instanceof Error ? error.message.slice(0, 500) : "send_failed",
          })
          .eq("campaign_id", campaignId)
          .eq("email", recipient.email)
      }
    }

    const completedAt = new Date().toISOString()
    const finalStatus = failedCount === recipients.length ? "failed" : "completed"
    const { error: updateError } = await admin
      .from("owner_email_campaigns")
      .update({
        status: finalStatus,
        sent_count: sentCount,
        failed_count: failedCount,
        completed_at: completedAt,
        error_message: failedCount ? `${failedCount} alıcıya gönderilemedi.` : null,
      })
      .eq("id", campaignId)

    if (updateError) throw updateError

    await auditOwnerBulkEmail({
      ownerId: owner.user.id,
      campaignId,
      recipientCount: recipients.length,
      campaignType: parsed.data.campaignType,
      audience: parsed.data.audience,
    })

    return NextResponse.json({
      ok: true,
      campaignId,
      recipientCount: recipients.length,
      sentCount,
      failedCount,
    })
  } catch (error) {
    if (isMissingOwnerBulkEmailTable(error)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Toplu mail tabloları hazır değil. sql/owner_bulk_email.sql dosyasını Supabase SQL editor içinde çalıştırın.",
          setupRequired: true,
        },
        { status: 503 },
      )
    }

    console.error("[owner-emails] send failed", error)
    return NextResponse.json({ ok: false, error: "Toplu mail gönderilemedi." }, { status: 500 })
  }
}

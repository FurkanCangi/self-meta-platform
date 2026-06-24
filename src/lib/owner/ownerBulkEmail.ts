import "server-only"

import nodemailer from "nodemailer"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { getOwnerAuditEmails } from "./ownerAccess"

export type OwnerEmailCampaignType = "system" | "education" | "marketing"
export type OwnerEmailAudience = "all" | "therapists" | "owners" | "plan" | "manual"

export type OwnerBulkEmailInput = {
  campaignType: OwnerEmailCampaignType
  audience: OwnerEmailAudience
  planCode?: string | null
  subject: string
  previewText?: string | null
  body: string
  actionLabel?: string | null
  actionUrl?: string | null
  manualEmails?: string[]
}

export type OwnerEmailRecipient = {
  userId: string | null
  email: string
  fullName: string
  plan: string
  role: string
}

export type OwnerEmailCampaignRow = {
  id: string
  campaign_type: OwnerEmailCampaignType
  audience: OwnerEmailAudience
  plan_code: string | null
  subject: string
  preview_text: string | null
  body: string
  action_label: string | null
  action_url: string | null
  status: string
  recipient_count: number
  sent_count: number
  failed_count: number
  skipped_count: number
  created_at: string
  started_at: string | null
  completed_at: string | null
  error_message: string | null
}

export type OwnerEmailRecipientRow = {
  id: string
  campaign_id: string
  user_id: string | null
  email: string
  full_name: string | null
  status: string
  sent_at: string | null
  error_message: string | null
  created_at: string
}

type AuthUserLite = {
  id: string
  email: string
  fullName: string
}

type ProfileLite = {
  user_id: string
  role: string | null
  plan: string | null
}

function readEnv(name: string) {
  const value = process.env[name]
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

export function isOwnerBulkEmailConfigured() {
  return Boolean(
    readEnv("AUTH_SMTP_HOST") &&
      readEnv("AUTH_SMTP_PORT") &&
      readEnv("AUTH_SMTP_USER") &&
      readEnv("AUTH_SMTP_PASS"),
  )
}

function smtpSecure() {
  const value = readEnv("AUTH_SMTP_SECURE").toLowerCase()
  if (!value) return Number(readEnv("AUTH_SMTP_PORT")) === 465
  return value === "1" || value === "true" || value === "yes"
}

function fromAddress() {
  const explicit = readEnv("BULK_EMAIL_FROM") || readEnv("SUPPORT_EMAIL_FROM") || readEnv("AUTH_EMAIL_FROM")
  if (explicit) return explicit
  return `"DNA Intelligence" <${readEnv("AUTH_SMTP_USER")}>`
}

function transporter() {
  return nodemailer.createTransport({
    host: readEnv("AUTH_SMTP_HOST"),
    port: Number(readEnv("AUTH_SMTP_PORT")),
    secure: smtpSecure(),
    auth: {
      user: readEnv("AUTH_SMTP_USER"),
      pass: readEnv("AUTH_SMTP_PASS"),
    },
  })
}

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function absoluteUrl(value: string | null | undefined, appOrigin: string) {
  const raw = String(value || "").trim()
  if (!raw) return ""
  if (/^https?:\/\//i.test(raw)) return raw
  if (raw.startsWith("/")) return `${appOrigin}${raw}`
  return `${appOrigin}/${raw}`
}

function emailHtml(input: {
  subject: string
  previewText?: string | null
  body: string
  actionLabel?: string | null
  actionUrl?: string | null
}) {
  const paragraphs = input.body
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map(
      (part) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#51627e;">${escapeHtml(part).replace(/\n/g, "<br />")}</p>`,
    )
    .join("")

  const action =
    input.actionLabel && input.actionUrl
      ? `<tr>
          <td style="padding:10px 30px 24px;">
            <a href="${escapeHtml(input.actionUrl)}" style="display:block;text-align:center;text-decoration:none;background:linear-gradient(90deg,#19c2dc,#2867ed,#7b2cf6);color:#ffffff;border-radius:16px;padding:16px 22px;font-size:16px;font-weight:800;">${escapeHtml(input.actionLabel)}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:0 30px 26px;">
            <p style="margin:0;font-size:12px;line-height:1.6;color:#687894;">Buton çalışmazsa bağlantı:</p>
            <p style="margin:10px 0 0;padding:12px 14px;background:#f5f8ff;border:1px solid #e3ebfb;border-radius:14px;word-break:break-all;font-size:12px;line-height:1.55;color:#2855c8;">${escapeHtml(input.actionUrl)}</p>
          </td>
        </tr>`
      : ""

  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(input.subject)}</title>
    <meta name="x-apple-disable-message-reformatting" />
  </head>
  <body style="margin:0;background:#f6fbff;font-family:Arial,Helvetica,sans-serif;color:#0b1533;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.previewText || input.subject)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(135deg,#effcff 0%,#f7f3ff 100%);padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e6eef8;border-radius:24px;box-shadow:0 18px 48px rgba(38,82,160,.10);overflow:hidden;">
            <tr>
              <td style="padding:30px 30px 12px;">
                <div style="font-size:13px;font-weight:800;letter-spacing:.14em;color:#3569ff;text-transform:uppercase;">DNA Intelligence</div>
                <h1 style="margin:14px 0 14px;font-size:28px;line-height:1.15;color:#07122f;">${escapeHtml(input.subject)}</h1>
                ${paragraphs}
              </td>
            </tr>
            ${action}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function emailText(input: {
  subject: string
  body: string
  actionLabel?: string | null
  actionUrl?: string | null
}) {
  const action = input.actionLabel && input.actionUrl ? `\n\n${input.actionLabel}: ${input.actionUrl}` : ""
  return `${input.subject}\n\n${input.body}${action}`
}

function isTherapistRole(role: string) {
  const normalized = role.trim().toLowerCase()
  return ["expert", "therapist", "terapist", "professional", "student", "graduate"].includes(normalized)
}

async function fetchAuthUsers() {
  const admin = createSupabaseAdminClient()
  const users: AuthUserLite[] = []
  let page = 1

  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error

    const rows = data.users || []
    for (const user of rows) {
      const email = String(user.email || "").trim().toLowerCase()
      if (!email) continue
      users.push({
        id: user.id,
        email,
        fullName: String(user.user_metadata?.full_name || user.user_metadata?.name || "").trim(),
      })
    }

    if (rows.length < 1000) break
    page += 1
  }

  return users
}

async function fetchProfiles() {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin.from("profiles").select("user_id,role,plan")
  if (error) throw error
  return (data || []) as ProfileLite[]
}

function uniqueRecipients(recipients: OwnerEmailRecipient[]) {
  const seen = new Set<string>()
  return recipients.filter((recipient) => {
    if (!recipient.email || seen.has(recipient.email)) return false
    seen.add(recipient.email)
    return true
  })
}

export async function resolveOwnerEmailRecipients(input: Pick<OwnerBulkEmailInput, "audience" | "planCode" | "manualEmails">) {
  const manualEmails = (input.manualEmails || []).map((email) => email.trim().toLowerCase()).filter(Boolean)
  if (input.audience === "manual") {
    return uniqueRecipients(
      manualEmails.map((email) => ({
        userId: null,
        email,
        fullName: "",
        plan: "manual",
        role: "manual",
      })),
    )
  }

  const [authUsers, profiles] = await Promise.all([fetchAuthUsers(), fetchProfiles()])
  const profileByUserId = new Map(profiles.map((profile) => [profile.user_id, profile]))
  const ownerEmails = new Set(getOwnerAuditEmails())

  return uniqueRecipients(
    authUsers
      .map((user) => {
        const profile = profileByUserId.get(user.id)
        return {
          userId: user.id,
          email: user.email,
          fullName: user.fullName,
          plan: String(profile?.plan || "none"),
          role: String(profile?.role || "expert"),
        }
      })
      .filter((recipient) => {
        if (input.audience === "all") return true
        if (input.audience === "owners") return ownerEmails.has(recipient.email)
        if (input.audience === "therapists") return isTherapistRole(recipient.role)
        if (input.audience === "plan") return recipient.plan === String(input.planCode || "").trim()
        return false
      }),
  )
}

export function isMissingOwnerBulkEmailTable(error: unknown) {
  const message = String((error as { message?: unknown })?.message || error || "")
  return (
    message.includes('relation "owner_email_campaigns" does not exist') ||
    message.includes("relation 'owner_email_campaigns' does not exist") ||
    message.includes("owner_email_recipients")
  )
}

export async function sendOwnerBulkEmailToRecipient(input: {
  recipient: OwnerEmailRecipient
  campaign: OwnerBulkEmailInput
  appOrigin: string
}) {
  if (!isOwnerBulkEmailConfigured()) {
    return { sent: false as const, error: "smtp_not_configured" }
  }

  const actionUrl = absoluteUrl(input.campaign.actionUrl, input.appOrigin)
  const payload = {
    subject: input.campaign.subject,
    previewText: input.campaign.previewText,
    body: input.campaign.body,
    actionLabel: input.campaign.actionLabel,
    actionUrl,
  }

  await transporter().sendMail({
    from: fromAddress(),
    to: input.recipient.email,
    subject: input.campaign.subject,
    text: emailText(payload),
    html: emailHtml(payload),
  })

  return { sent: true as const }
}

import "server-only"

import nodemailer from "nodemailer"
import { DEFAULT_SUPPORT_RESOLUTION_MESSAGE } from "@/lib/support/supportMessages"
import { getOwnerAuditEmails } from "@/lib/owner/ownerAccess"

type OwnerSupportEmailInput = {
  ticketNo: string
  subject: string
  requesterName: string
  requesterEmail: string
  categoryLabel: string
  priorityLabel: string
  supportUrl: string
}

type ResolvedSupportEmailInput = {
  to: string
  ticketNo: string
  subject: string
  resolutionMessage: string
  supportUrl: string
}

function readEnv(name: string) {
  const value = process.env[name]
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function isSupportEmailConfigured() {
  return Boolean(
    readEnv("AUTH_SMTP_HOST") &&
      readEnv("AUTH_SMTP_PORT") &&
      readEnv("AUTH_SMTP_USER") &&
      readEnv("AUTH_SMTP_PASS")
  )
}

function smtpSecure() {
  const value = readEnv("AUTH_SMTP_SECURE").toLowerCase()
  if (!value) return Number(readEnv("AUTH_SMTP_PORT")) === 465
  return value === "1" || value === "true" || value === "yes"
}

function fromAddress() {
  const explicit = readEnv("SUPPORT_EMAIL_FROM") || readEnv("AUTH_EMAIL_FROM")
  if (explicit) return explicit
  return `"DNA Intelligence Destek" <${readEnv("AUTH_SMTP_USER")}>`
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

function cardHtml(title: string, body: string, actionLabel: string, actionUrl: string) {
  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#f6fbff;font-family:Arial,Helvetica,sans-serif;color:#0b1533;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(135deg,#effcff 0%,#f7f3ff 100%);padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e6eef8;border-radius:24px;box-shadow:0 18px 48px rgba(38,82,160,.10);overflow:hidden;">
            <tr>
              <td style="padding:28px 30px 10px;">
                <div style="font-size:13px;font-weight:800;letter-spacing:.14em;color:#3569ff;text-transform:uppercase;">DNA Intelligence</div>
                <h1 style="margin:14px 0 10px;font-size:28px;line-height:1.15;color:#07122f;">${escapeHtml(title)}</h1>
                <div style="font-size:15px;line-height:1.7;color:#51627e;">${body}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 30px;">
                <a href="${escapeHtml(actionUrl)}" style="display:block;text-align:center;text-decoration:none;background:linear-gradient(90deg,#19c2dc,#2867ed,#7b2cf6);color:#ffffff;border-radius:16px;padding:16px 22px;font-size:16px;font-weight:800;">${escapeHtml(actionLabel)}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 30px 28px;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#687894;">Buton çalışmazsa bu bağlantıyı tarayıcınıza yapıştırabilirsiniz:</p>
                <p style="margin:12px 0 0;padding:14px 16px;background:#f5f8ff;border:1px solid #e3ebfb;border-radius:14px;word-break:break-all;font-size:12px;line-height:1.55;color:#2855c8;">${escapeHtml(actionUrl)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export async function sendOwnerSupportTicketEmail(input: OwnerSupportEmailInput) {
  if (!isSupportEmailConfigured()) return { sent: false, skipped: "smtp_not_configured" as const }

  const ownerEmails = getOwnerAuditEmails()
  if (!ownerEmails.length) return { sent: false, skipped: "owner_email_not_configured" as const }

  const body = `
    <p style="margin:0 0 12px;">Yeni bir destek talebi oluşturuldu.</p>
    <p style="margin:0 0 8px;"><strong>Talep:</strong> ${escapeHtml(input.ticketNo)} - ${escapeHtml(input.subject)}</p>
    <p style="margin:0 0 8px;"><strong>Kullanıcı:</strong> ${escapeHtml(input.requesterName || "İsimsiz kullanıcı")} / ${escapeHtml(input.requesterEmail)}</p>
    <p style="margin:0;"><strong>Konu:</strong> ${escapeHtml(input.categoryLabel)} &nbsp; <strong>Öncelik:</strong> ${escapeHtml(input.priorityLabel)}</p>
  `

  await transporter().sendMail({
    from: fromAddress(),
    to: ownerEmails,
    subject: `Yeni destek talebi: ${input.ticketNo}`,
    text: `Yeni destek talebi var.\n\nTalep: ${input.ticketNo} - ${input.subject}\nKullanıcı: ${input.requesterName || "İsimsiz kullanıcı"} / ${input.requesterEmail}\nKonu: ${input.categoryLabel}\nÖncelik: ${input.priorityLabel}\n\nPanel: ${input.supportUrl}`,
    html: cardHtml("Yeni destek talebi var", body, "Destek panelini aç", input.supportUrl),
  })

  return { sent: true as const }
}

export async function sendSupportTicketResolvedEmail(input: ResolvedSupportEmailInput) {
  if (!isSupportEmailConfigured()) return { sent: false, skipped: "smtp_not_configured" as const }

  const body = `
    <p style="margin:0 0 12px;">${escapeHtml(input.ticketNo)} numaralı destek talebiniz çözüldü.</p>
    <p style="margin:0 0 8px;"><strong>Konu:</strong> ${escapeHtml(input.subject)}</p>
    <p style="margin:0;"><strong>Çözüm notu:</strong><br />${escapeHtml(input.resolutionMessage || DEFAULT_SUPPORT_RESOLUTION_MESSAGE).replace(/\n/g, "<br />")}</p>
  `

  await transporter().sendMail({
    from: fromAddress(),
    to: input.to,
    subject: `Destek talebiniz çözüldü: ${input.ticketNo}`,
    text: `${input.ticketNo} numaralı destek talebiniz çözüldü.\n\nKonu: ${input.subject}\n\nÇözüm notu:\n${input.resolutionMessage || DEFAULT_SUPPORT_RESOLUTION_MESSAGE}\n\nDestek ekranı: ${input.supportUrl}`,
    html: cardHtml("Destek talebiniz çözüldü", body, "Destek ekranını aç", input.supportUrl),
  })

  return { sent: true as const }
}

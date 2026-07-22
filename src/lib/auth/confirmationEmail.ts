import nodemailer from "nodemailer"

type SignupConfirmationEmailInput = {
  to: string
  fullName: string
  confirmationUrl: string
}

function readEnv(name: string) {
  const value = process.env[name]
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

export function isCustomSignupEmailConfigured() {
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
  const explicit = readEnv("AUTH_EMAIL_FROM")
  if (explicit) return explicit
  return `"DNA Intelligence" <${readEnv("AUTH_SMTP_USER")}>`
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] || character
  )
}

function publicAssetUrl(confirmationUrl: string, path: string) {
  try {
    const url = new URL(confirmationUrl)
    if (url.protocol !== "https:" && url.protocol !== "http:") return ""
    return new URL(path, url.origin).toString()
  } catch {
    return ""
  }
}

function htmlTemplate({ fullName, confirmationUrl }: SignupConfirmationEmailInput) {
  const displayName = escapeHtml(fullName || "Merhaba")
  const safeConfirmationUrl = escapeHtml(confirmationUrl)
  const logoUrl = escapeHtml(publicAssetUrl(confirmationUrl, "/images/brand/dna-oauth-logo-120.png"))
  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>DNA Intelligence hesabınızı doğrulayın</title>
  </head>
  <body style="margin:0;background:#f3f7fc;font-family:Arial,Helvetica,sans-serif;color:#0b1533;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">DNA Intelligence hesabınızı güvenli biçimde etkinleştirin.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f7fc;background-image:linear-gradient(135deg,#effcff 0%,#f7f3ff 100%);padding:36px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #dfe9f5;border-radius:24px;box-shadow:0 18px 48px rgba(38,82,160,.10);overflow:hidden;">
            <tr>
              <td style="height:6px;background:#2867ed;background-image:linear-gradient(90deg,#19c2dc,#2867ed,#7b2cf6);"></td>
            </tr>
            <tr>
              <td style="padding:30px 32px 8px;">
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding-right:14px;vertical-align:middle;">
                      ${logoUrl ? `<img src="${logoUrl}" width="52" height="52" alt="DNA Intelligence" style="display:block;width:52px;height:52px;border:0;border-radius:14px;" />` : ""}
                    </td>
                    <td style="vertical-align:middle;">
                      <div style="font-size:17px;font-weight:800;letter-spacing:.01em;color:#07122f;">DNA Intelligence</div>
                      <div style="margin-top:4px;font-size:11px;font-weight:700;letter-spacing:.08em;color:#64748b;text-transform:uppercase;">Dynamic Neuro-Regulation Approach</div>
                    </td>
                  </tr>
                </table>
                <h1 style="margin:28px 0 12px;font-size:30px;line-height:1.16;color:#07122f;">E-posta adresinizi doğrulayın</h1>
                <p style="margin:0;font-size:16px;line-height:1.7;color:#51627e;">${displayName}, terapist hesabınız hazır. Güvenli girişinizi etkinleştirmek için aşağıdaki düğmeyi kullanın.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 20px;">
                <a href="${safeConfirmationUrl}" style="display:block;text-align:center;text-decoration:none;background:#2867ed;background-image:linear-gradient(90deg,#19c2dc,#2867ed,#7b2cf6);color:#ffffff;border-radius:15px;padding:16px 22px;font-size:16px;font-weight:800;box-shadow:0 10px 24px rgba(40,103,237,.20);">Hesabımı Güvenle Etkinleştir</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 30px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8faff;border:1px solid #e3ebf7;border-radius:15px;">
                  <tr>
                    <td style="padding:15px 16px;">
                      <div style="font-size:13px;font-weight:800;color:#1e3a70;">Güvenli doğrulama</div>
                      <div style="margin-top:5px;font-size:13px;line-height:1.6;color:#687894;">Bu bağlantı yalnızca hesabınızı etkinleştirmek için kullanılır. DNA Intelligence sizden e-posta üzerinden şifre istemez.</div>
                    </td>
                  </tr>
                </table>
                <p style="margin:20px 0 10px;font-size:12px;line-height:1.6;color:#71809a;">Düğme çalışmazsa bu bağlantıyı tarayıcınıza yapıştırın:</p>
                <p style="margin:0;word-break:break-all;font-size:11px;line-height:1.55;color:#2855c8;">${safeConfirmationUrl}</p>
                <p style="margin:22px 0 0;padding-top:18px;border-top:1px solid #e8eef7;font-size:12px;line-height:1.6;color:#8390a6;">Bu kaydı siz başlatmadıysanız herhangi bir işlem yapmanız gerekmez.</p>
              </td>
            </tr>
          </table>
          <p style="margin:18px 0 0;font-size:11px;line-height:1.6;color:#94a3b8;">© ${new Date().getFullYear()} DNA Intelligence · Güvenli klinik değerlendirme platformu</p>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function textTemplate({ fullName, confirmationUrl }: SignupConfirmationEmailInput) {
  const displayName = fullName || "Merhaba"
  return `${displayName},

DNA Intelligence terapist paneline güvenli şekilde giriş yapabilmeniz için e-posta adresinizi doğrulayın:

${confirmationUrl}

Bu işlemi siz başlatmadıysanız bu e-postayı dikkate almayabilirsiniz.`
}

export function renderSignupConfirmationEmail(input: SignupConfirmationEmailInput) {
  return {
    subject: "DNA Intelligence hesabınızı doğrulayın",
    text: textTemplate(input),
    html: htmlTemplate(input),
  }
}

export async function sendSignupConfirmationEmail(input: SignupConfirmationEmailInput) {
  if (!isCustomSignupEmailConfigured()) {
    throw new Error("Custom signup email SMTP configuration is missing.")
  }

  const transporter = nodemailer.createTransport({
    host: readEnv("AUTH_SMTP_HOST"),
    port: Number(readEnv("AUTH_SMTP_PORT")),
    secure: smtpSecure(),
    auth: {
      user: readEnv("AUTH_SMTP_USER"),
      pass: readEnv("AUTH_SMTP_PASS"),
    },
  })

  const message = renderSignupConfirmationEmail(input)
  await transporter.sendMail({
    from: fromAddress(),
    to: input.to,
    ...message,
  })
}

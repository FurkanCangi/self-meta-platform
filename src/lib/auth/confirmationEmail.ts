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

function htmlTemplate({ fullName, confirmationUrl }: SignupConfirmationEmailInput) {
  const displayName = fullName || "Merhaba"
  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>DNA Intelligence hesabınızı doğrulayın</title>
  </head>
  <body style="margin:0;background:#f6fbff;font-family:Arial,Helvetica,sans-serif;color:#0b1533;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(135deg,#effcff 0%,#f7f3ff 100%);padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e6eef8;border-radius:24px;box-shadow:0 18px 48px rgba(38,82,160,.10);overflow:hidden;">
            <tr>
              <td style="padding:28px 30px 10px;">
                <div style="font-size:13px;font-weight:800;letter-spacing:.14em;color:#3569ff;text-transform:uppercase;">DNA Intelligence</div>
                <h1 style="margin:14px 0 10px;font-size:30px;line-height:1.15;color:#07122f;">Hesabınızı doğrulayın</h1>
                <p style="margin:0;font-size:16px;line-height:1.7;color:#51627e;">${displayName}, DNA Intelligence terapist paneline güvenli şekilde giriş yapabilmeniz için e-posta adresinizi doğrulamanız gerekiyor.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 30px;">
                <a href="${confirmationUrl}" style="display:block;text-align:center;text-decoration:none;background:linear-gradient(90deg,#19c2dc,#2867ed,#7b2cf6);color:#ffffff;border-radius:16px;padding:16px 22px;font-size:16px;font-weight:800;">E-postamı Doğrula</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 30px 28px;">
                <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#687894;">Buton çalışmazsa aşağıdaki bağlantıyı tarayıcınıza yapıştırabilirsiniz:</p>
                <p style="margin:0;padding:14px 16px;background:#f5f8ff;border:1px solid #e3ebfb;border-radius:14px;word-break:break-all;font-size:12px;line-height:1.55;color:#2855c8;">${confirmationUrl}</p>
                <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#7a88a4;">Bu işlemi siz başlatmadıysanız bu e-postayı dikkate almayabilirsiniz.</p>
              </td>
            </tr>
          </table>
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

  await transporter.sendMail({
    from: fromAddress(),
    to: input.to,
    subject: "DNA Intelligence hesabınızı doğrulayın",
    text: textTemplate(input),
    html: htmlTemplate(input),
  })
}

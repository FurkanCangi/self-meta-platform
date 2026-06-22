import "server-only"

const DEFAULT_SECURITY_TEST_EXEMPT_EMAILS = [
  "ergfurkancangi@gmail.com",
  "sevdenurtatli@icloud.com",
  "busranurtohan@gmail.com",
  "ergnurtuba@gmail.com",
]

function normalizeEmail(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\u0131/g, "i")
    .replace(/\u0130/g, "i")
}

export function getSecurityTestExemptEmails() {
  const configured = String(process.env.SECURITY_TEST_EXEMPT_EMAILS || "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean)

  return new Set([...DEFAULT_SECURITY_TEST_EXEMPT_EMAILS, ...configured])
}

export function isSecurityTestExemptEmail(email?: string | null) {
  return getSecurityTestExemptEmails().has(normalizeEmail(email))
}

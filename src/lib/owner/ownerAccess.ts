export function getOwnerAuditEmails(): string[] {
  return String(process.env.OWNER_AUDIT_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
}

export function isOwnerAuditEmail(email?: string | null): boolean {
  if (!email) return false
  const normalized = String(email).trim().toLowerCase()
  return getOwnerAuditEmails().includes(normalized)
}

export function assertOwnerAuditAccess(email?: string | null) {
  if (!isOwnerAuditEmail(email)) {
    throw new Error("Owner audit erişimi yok.")
  }
}

export type NotificationKind = "info" | "education" | "system" | "warning"

export type NotificationAudience = "all" | "therapists" | "owners"

export type NotificationRow = {
  id: string
  title: string | null
  message: string | null
  kind: string | null
  audience: string | null
  target_user_ids: string[] | null
  action_label: string | null
  action_url: string | null
  status: string | null
  published_at: string | null
  created_at: string | null
}

export type NotificationItem = {
  id: string
  title: string
  message: string
  kind: NotificationKind
  audience: NotificationAudience
  actionLabel: string | null
  actionUrl: string | null
  publishedAt: string
  readAt: string | null
  read: boolean
}

const notificationKinds = new Set<NotificationKind>(["info", "education", "system", "warning"])
const notificationAudiences = new Set<NotificationAudience>(["all", "therapists", "owners"])
const notificationRouteAliases = new Map<string, string>([
  ["/training", "/education"],
  ["/trainings", "/education"],
  ["/egitim", "/education"],
  ["/egitimler", "/education"],
])
const allowedNotificationRoutePrefixes = [
  "/arastirma",
  "/assessments",
  "/clients",
  "/dashboard",
  "/education",
  "/fiyatlandirma",
  "/kvkk",
  "/owner-audit",
  "/pricing",
  "/privacy",
  "/profile",
  "/profile-setting",
  "/report-packages",
  "/reports",
  "/settings",
  "/starter",
  "/support",
  "/terms",
  "/video-observation",
]

function cleanText(value: unknown, fallback = "") {
  const normalized = String(value || "").replace(/\s+/g, " ").trim()
  return normalized || fallback
}

function cleanNotificationMessage(value: unknown) {
  return cleanText(value)
    .replace(/\bDST-[A-Z0-9]+\s+numaralı talebiniz/gi, "Destek talebiniz")
    .replace(/\bDST-[A-Z0-9]+\s+numaralı destek talebiniz/gi, "Destek talebiniz")
}

export function normalizeNotificationKind(value: unknown): NotificationKind {
  return notificationKinds.has(value as NotificationKind) ? (value as NotificationKind) : "info"
}

export function normalizeNotificationAudience(value: unknown): NotificationAudience {
  return notificationAudiences.has(value as NotificationAudience)
    ? (value as NotificationAudience)
    : "therapists"
}

export function mapNotificationRow(row: NotificationRow, readAt: string | null = null): NotificationItem {
  const publishedAt = row.published_at || row.created_at || new Date().toISOString()

  return {
    id: row.id,
    title: cleanText(row.title, "Bildirim"),
    message: cleanNotificationMessage(row.message),
    kind: normalizeNotificationKind(row.kind),
    audience: normalizeNotificationAudience(row.audience),
    actionLabel: cleanText(row.action_label) || null,
    actionUrl: normalizeNotificationActionUrl(row.action_url),
    publishedAt,
    readAt,
    read: Boolean(readAt),
  }
}

export function normalizeNotificationActionUrl(value: unknown) {
  const raw = cleanText(value)
  if (!raw) return null
  if (!raw.startsWith("/") || raw.startsWith("//")) return null

  try {
    const parsed = new URL(raw, "https://dna.local")
    const pathname = notificationRouteAliases.get(parsed.pathname) || parsed.pathname
    const allowed = allowedNotificationRoutePrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )

    if (!allowed) return null
    return `${pathname}${parsed.search}${parsed.hash}`
  } catch {
    return null
  }
}

export function isNotificationVisibleForUser(row: NotificationRow, userId: string) {
  if (row.status && row.status !== "published") return false
  if (row.published_at && new Date(row.published_at).getTime() > Date.now()) return false

  const audience = normalizeNotificationAudience(row.audience)
  if (audience === "all" || audience === "therapists") return true

  return Array.isArray(row.target_user_ids) && row.target_user_ids.includes(userId)
}

export function isMissingNotificationsTable(error: unknown) {
  const message = String((error as { message?: string } | null)?.message || error || "").toLowerCase()
  const code = String((error as { code?: string } | null)?.code || "")
  return (
    code === "42P01" ||
    message.includes('relation "notifications" does not exist') ||
    message.includes("relation 'notifications' does not exist") ||
    message.includes('relation "notification_reads" does not exist') ||
    message.includes("relation 'notification_reads' does not exist")
  )
}

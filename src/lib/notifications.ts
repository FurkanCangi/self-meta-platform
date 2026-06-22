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

function cleanText(value: unknown, fallback = "") {
  const normalized = String(value || "").replace(/\s+/g, " ").trim()
  return normalized || fallback
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
    message: cleanText(row.message),
    kind: normalizeNotificationKind(row.kind),
    audience: normalizeNotificationAudience(row.audience),
    actionLabel: cleanText(row.action_label) || null,
    actionUrl: cleanText(row.action_url) || null,
    publishedAt,
    readAt,
    read: Boolean(readAt),
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
  return code === "42P01" || message.includes("notifications") || message.includes("notification_reads")
}


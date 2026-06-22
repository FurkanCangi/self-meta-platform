import { NextResponse } from "next/server"
import { requireConfirmedUser } from "@/lib/security/apiGuards"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  isMissingNotificationsTable,
  isNotificationVisibleForUser,
  mapNotificationRow,
  type NotificationRow,
} from "@/lib/notifications"

export async function GET() {
  const auth = await requireConfirmedUser()
  if (!auth.ok) return auth.response

  const rateLimit = await checkRateLimit({
    key: `notifications:list:${auth.user.id}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  try {
    const admin = createSupabaseAdminClient()
    const { data: rows, error } = await admin
      .from("notifications")
      .select(
        "id,title,message,kind,audience,target_user_ids,action_label,action_url,status,published_at,created_at",
      )
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(40)

    if (error) throw error

    const visibleRows = ((rows || []) as NotificationRow[]).filter((row) =>
      isNotificationVisibleForUser(row, auth.user.id),
    )

    const notificationIds = visibleRows.map((row) => row.id)
    const readsById = new Map<string, string>()

    if (notificationIds.length > 0) {
      const { data: reads, error: readsError } = await admin
        .from("notification_reads")
        .select("notification_id,read_at")
        .eq("user_id", auth.user.id)
        .in("notification_id", notificationIds)

      if (readsError) throw readsError

      for (const row of reads || []) {
        readsById.set(String(row.notification_id), String(row.read_at))
      }
    }

    const notifications = visibleRows.map((row) => mapNotificationRow(row, readsById.get(row.id) || null))
    const unreadCount = notifications.filter((item) => !item.read).length

    return NextResponse.json({ ok: true, notifications, unreadCount })
  } catch (error) {
    if (isMissingNotificationsTable(error)) {
      return NextResponse.json({
        ok: true,
        notifications: [],
        unreadCount: 0,
        setupRequired: true,
      })
    }

    console.error("[notifications] list failed", error)
    return NextResponse.json({ ok: false, error: "Bildirimler yüklenemedi." }, { status: 500 })
  }
}


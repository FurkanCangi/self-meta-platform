import { NextResponse } from "next/server"
import { z } from "zod"
import { requireConfirmedUser, requireTrustedMutation } from "@/lib/security/apiGuards"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import { readJsonWithSchema } from "@/lib/security/schemaGuards"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  isMissingNotificationsTable,
  isNotificationVisibleForUser,
  type NotificationRow,
} from "@/lib/notifications"

const readSchema = z
  .object({
    notificationId: z.string().uuid().optional(),
    all: z.boolean().optional(),
  })
  .refine((value) => Boolean(value.all) || Boolean(value.notificationId), "notification_required")

async function getVisibleNotificationIds(userId: string, notificationId?: string) {
  const admin = createSupabaseAdminClient()
  let query = admin
    .from("notifications")
    .select("id,title,message,kind,audience,target_user_ids,action_label,action_url,status,published_at,created_at")
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())

  if (notificationId) {
    query = query.eq("id", notificationId)
  } else {
    query = query.order("published_at", { ascending: false }).limit(40)
  }

  const { data, error } = await query
  if (error) throw error

  return ((data || []) as NotificationRow[])
    .filter((row) => isNotificationVisibleForUser(row, userId))
    .map((row) => row.id)
}

export async function POST(request: Request) {
  const trusted = await requireTrustedMutation(request)
  if (trusted) return trusted

  const auth = await requireConfirmedUser()
  if (!auth.ok) return auth.response

  const rateLimit = await checkRateLimit({
    key: `notifications:read:${auth.user.id}`,
    limit: 90,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  const parsed = await readJsonWithSchema(request, readSchema)
  if (!parsed.ok) return parsed.response

  try {
    const ids = await getVisibleNotificationIds(auth.user.id, parsed.data.notificationId)
    if (!parsed.data.all && ids.length === 0) {
      return NextResponse.json({ ok: false, error: "Bildirim bulunamadı." }, { status: 404 })
    }

    if (ids.length > 0) {
      const admin = createSupabaseAdminClient()
      const now = new Date().toISOString()
      const rows = ids.map((notificationId) => ({
        notification_id: notificationId,
        user_id: auth.user.id,
        read_at: now,
      }))

      const { error } = await admin.from("notification_reads").upsert(rows, {
        onConflict: "notification_id,user_id",
      })
      if (error) throw error
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (isMissingNotificationsTable(error)) {
      return NextResponse.json({ ok: true, setupRequired: true })
    }

    console.error("[notifications] read failed", error)
    return NextResponse.json({ ok: false, error: "Bildirim güncellenemedi." }, { status: 500 })
  }
}


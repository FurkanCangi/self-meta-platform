import { NextResponse } from "next/server"
import { z } from "zod"
import { assertOwnerAuditAccess } from "@/lib/owner/ownerAccess"
import { requireConfirmedUser, requireTrustedMutation } from "@/lib/security/apiGuards"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import { readJsonWithSchema } from "@/lib/security/schemaGuards"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  isMissingNotificationsTable,
  mapNotificationRow,
  normalizeNotificationActionUrl,
  normalizeNotificationAudience,
  normalizeNotificationKind,
  type NotificationRow,
} from "@/lib/notifications"

const notificationCreateSchema = z.object({
  title: z.string().trim().min(3).max(120),
  message: z.string().trim().min(5).max(800),
  kind: z.enum(["info", "education", "system", "warning"]).default("info"),
  audience: z.enum(["all", "therapists", "owners"]).default("therapists"),
  actionLabel: z.string().trim().max(48).optional().nullable(),
  actionUrl: z.string().trim().max(240).optional().nullable(),
  targetEmails: z.array(z.string().email()).max(30).optional().default([]),
})

const notificationDeleteSchema = z.object({
  id: z.string().uuid(),
})

const notificationRestoreSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["archive", "restore"]),
})

async function requireOwner() {
  const auth = await requireConfirmedUser()
  if (!auth.ok) return auth

  try {
    assertOwnerAuditAccess(auth.user.email)
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }),
    }
  }

  return auth
}

async function resolveTargetUserIds(targetEmails: string[]) {
  if (targetEmails.length === 0) return []

  const admin = createSupabaseAdminClient()
  const wanted = new Set(targetEmails.map((email) => email.trim().toLowerCase()))
  const userIds: string[] = []
  let page = 1

  while (page <= 20 && wanted.size > 0) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error

    for (const user of data.users || []) {
      const email = String(user.email || "").trim().toLowerCase()
      if (email && wanted.has(email)) {
        userIds.push(user.id)
        wanted.delete(email)
      }
    }

    if ((data.users || []).length < 1000) break
    page += 1
  }

  return userIds
}

function ownerAuditEmails() {
  return String(process.env.OWNER_AUDIT_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export async function GET() {
  const owner = await requireOwner()
  if (!owner.ok) return owner.response

  const rateLimit = await checkRateLimit({
    key: `owner-notifications:list:${owner.user.id}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  try {
    const admin = createSupabaseAdminClient()
    const { data, error } = await admin
      .from("notifications")
      .select("id,title,message,kind,audience,target_user_ids,action_label,action_url,status,published_at,created_at")
      .order("published_at", { ascending: false })
      .limit(50)

    if (error) throw error

    const allNotifications = ((data || []) as NotificationRow[]).map((row) => ({
      ...mapNotificationRow(row, null),
      status: row.status || "published",
      targetCount: Array.isArray(row.target_user_ids) ? row.target_user_ids.length : 0,
    }))
    const notifications = allNotifications.filter((row) => row.status !== "archived")
    const hiddenNotifications = allNotifications.filter((row) => row.status === "archived")

    return NextResponse.json({ ok: true, notifications, hiddenNotifications })
  } catch (error) {
    if (isMissingNotificationsTable(error)) {
      return NextResponse.json({ ok: true, notifications: [], hiddenNotifications: [], setupRequired: true })
    }

    console.error("[owner-notifications] list failed", error)
    return NextResponse.json({ ok: false, error: "Bildirimler yüklenemedi." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const trusted = await requireTrustedMutation(request)
  if (trusted) return trusted

  const owner = await requireOwner()
  if (!owner.ok) return owner.response

  const rateLimit = await checkRateLimit({
    key: `owner-notifications:create:${owner.user.id}`,
    limit: 30,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  const parsed = await readJsonWithSchema(request, notificationCreateSchema)
  if (!parsed.ok) return parsed.response

  try {
    const ownerTargetEmails =
      parsed.data.audience === "owners" && parsed.data.targetEmails.length === 0 ? ownerAuditEmails() : []
    const targetUserIds = await resolveTargetUserIds([...parsed.data.targetEmails, ...ownerTargetEmails])
    const hasTargets = targetUserIds.length > 0
    const actionUrl = normalizeNotificationActionUrl(parsed.data.actionUrl)

    const admin = createSupabaseAdminClient()
    const { data, error } = await admin
      .from("notifications")
      .insert({
        title: parsed.data.title,
        message: parsed.data.message,
        kind: normalizeNotificationKind(parsed.data.kind),
        audience: hasTargets ? "owners" : normalizeNotificationAudience(parsed.data.audience),
        target_user_ids: targetUserIds,
        action_label: parsed.data.actionLabel || null,
        action_url: actionUrl,
        status: "published",
        published_at: new Date().toISOString(),
        created_by: owner.user.id,
      })
      .select("id,title,message,kind,audience,target_user_ids,action_label,action_url,status,published_at,created_at")
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, notification: mapNotificationRow(data as NotificationRow) })
  } catch (error) {
    if (isMissingNotificationsTable(error)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Bildirim tablosu hazır değil. sql/notifications.sql dosyasını Supabase SQL editor içinde çalıştırın.",
          setupRequired: true,
        },
        { status: 503 },
      )
    }

    console.error("[owner-notifications] create failed", error)
    return NextResponse.json({ ok: false, error: "Bildirim oluşturulamadı." }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const trusted = await requireTrustedMutation(request)
  if (trusted) return trusted

  const owner = await requireOwner()
  if (!owner.ok) return owner.response

  const rateLimit = await checkRateLimit({
    key: `owner-notifications:delete:${owner.user.id}`,
    limit: 40,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  const parsed = await readJsonWithSchema(request, notificationDeleteSchema)
  if (!parsed.ok) return parsed.response

  try {
    const admin = createSupabaseAdminClient()
    const { data, error } = await admin
      .from("notifications")
      .update({ status: "archived" })
      .eq("id", parsed.data.id)
      .select("id")
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ ok: false, error: "Bildirim bulunamadı." }, { status: 404 })
    }

    return NextResponse.json({ ok: true, archivedId: parsed.data.id })
  } catch (error) {
    if (isMissingNotificationsTable(error)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Bildirim tablosu hazır değil. sql/notifications.sql dosyasını Supabase SQL editor içinde çalıştırın.",
          setupRequired: true,
        },
        { status: 503 },
      )
    }

    console.error("[owner-notifications] archive failed", error)
    return NextResponse.json({ ok: false, error: "Bildirim gizlenemedi." }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const trusted = await requireTrustedMutation(request)
  if (trusted) return trusted

  const owner = await requireOwner()
  if (!owner.ok) return owner.response

  const rateLimit = await checkRateLimit({
    key: `owner-notifications:update:${owner.user.id}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  const parsed = await readJsonWithSchema(request, notificationRestoreSchema)
  if (!parsed.ok) return parsed.response

  try {
    const admin = createSupabaseAdminClient()
    const { data, error } = await admin
      .from("notifications")
      .update({ status: parsed.data.action === "restore" ? "published" : "archived" })
      .eq("id", parsed.data.id)
      .select("id,status")
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ ok: false, error: "Bildirim bulunamadı." }, { status: 404 })
    }

    return NextResponse.json({ ok: true, notification: data })
  } catch (error) {
    if (isMissingNotificationsTable(error)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Bildirim tablosu hazır değil. sql/notifications.sql dosyasını Supabase SQL editor içinde çalıştırın.",
          setupRequired: true,
        },
        { status: 503 },
      )
    }

    console.error("[owner-notifications] update failed", error)
    return NextResponse.json({ ok: false, error: "Bildirim güncellenemedi." }, { status: 500 })
  }
}

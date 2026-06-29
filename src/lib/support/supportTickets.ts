import "server-only"

import type { SupabaseClient, User } from "@supabase/supabase-js"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const SUPPORT_ATTACHMENT_BUCKET =
  process.env.SUPPORT_ATTACHMENTS_BUCKET || "support-attachments"

export const SUPPORT_RESPONSE_TARGET_HOURS = Number(
  process.env.SUPPORT_RESPONSE_TARGET_HOURS || 24,
)

const categoryLabels: Record<string, string> = {
  login: "Giriş / hesap",
  device: "Cihaz / oturum",
  payment: "Ödeme / paket",
  report: "Rapor",
  education: "Eğitim",
  technical: "Teknik sorun",
  other: "Diğer",
}

const statusLabels: Record<string, string> = {
  open: "Yeni",
  in_progress: "İnceleniyor",
  waiting_user: "Kullanıcıdan bilgi bekleniyor",
  resolved: "Çözüldü",
  closed: "Listeden kaldırıldı",
}

const priorityLabels: Record<string, string> = {
  low: "Düşük",
  normal: "Normal",
  high: "Yüksek",
  urgent: "Acil",
}

export type SupportAttachment = {
  id: string
  originalFileName: string
  mimeType: string
  fileSize: number
  signedUrl: string | null
  createdAt: string
}

export type SupportMessage = {
  id: string
  senderRole: "user" | "owner" | "system"
  message: string
  createdAt: string
}

export type SupportTicket = {
  id: string
  ticketNo: string
  userId: string | null
  requesterEmail: string
  requesterName: string
  category: string
  categoryLabel: string
  priority: string
  priorityLabel: string
  status: string
  statusLabel: string
  subject: string
  description: string
  pageUrl: string | null
  browserInfo: string | null
  deviceType: string
  responseTargetHours: number
  ownerNote: string | null
  resolutionMessage: string | null
  resolvedAt: string | null
  lastUserMessageAt: string | null
  lastOwnerMessageAt: string | null
  createdAt: string
  updatedAt: string
  attachments: SupportAttachment[]
  messages: SupportMessage[]
}

type SupportTicketRow = {
  id: string
  ticket_no: string
  user_id: string | null
  requester_email: string
  requester_name: string | null
  category: string
  priority: string
  status: string
  subject: string
  description: string
  page_url: string | null
  browser_info: string | null
  device_type: string | null
  response_target_hours: number | null
  owner_note: string | null
  resolution_message: string | null
  resolved_at: string | null
  last_user_message_at: string | null
  last_owner_message_at: string | null
  created_at: string
  updated_at: string
}

type SupportAttachmentRow = {
  id: string
  ticket_id: string
  storage_bucket: string
  storage_path: string
  original_file_name: string
  mime_type: string
  file_size: number
  created_at: string
}

type SupportMessageRow = {
  id: string
  ticket_id: string
  sender_role: "user" | "owner" | "system"
  message: string
  created_at: string
}

export function supportStatusLabel(status: string) {
  return statusLabels[status] || status
}

export function supportCategoryLabel(category: string) {
  return categoryLabels[category] || category
}

export function supportPriorityLabel(priority: string) {
  return priorityLabels[priority] || priority
}

export function isMissingSupportTable(error: unknown) {
  const message = String((error as { message?: string } | null)?.message || error || "").toLowerCase()
  const code = String((error as { code?: string } | null)?.code || "")
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("could not find the table") ||
    message.includes("schema cache") ||
    message.includes('relation "support_tickets" does not exist') ||
    message.includes("relation 'support_tickets' does not exist") ||
    message.includes("support_ticket_attachments") ||
    message.includes("support_ticket_messages")
  )
}

function sanitizeRequesterName(user: User | null, fallback: string | null | undefined) {
  const meta = user?.user_metadata as Record<string, unknown> | undefined
  const fromMeta = String(meta?.full_name || meta?.name || "").trim()
  return String(fallback || fromMeta || "").trim().slice(0, 120)
}

export function resolveRequesterInfo(user: User | null, formEmail?: string | null, formName?: string | null) {
  return {
    userId: user?.id || null,
    email: String(user?.email || formEmail || "").trim().toLowerCase(),
    name: sanitizeRequesterName(user, formName),
  }
}

async function createSignedUrl(admin: SupabaseClient, row: SupportAttachmentRow) {
  const { data, error } = await admin.storage
    .from(row.storage_bucket || SUPPORT_ATTACHMENT_BUCKET)
    .createSignedUrl(row.storage_path, 60 * 10)

  if (error) return null
  return data?.signedUrl || null
}

async function enrichTickets(admin: SupabaseClient, rows: SupportTicketRow[]): Promise<SupportTicket[]> {
  const ticketIds = rows.map((row) => row.id)
  const attachmentsByTicket = new Map<string, SupportAttachment[]>()
  const messagesByTicket = new Map<string, SupportMessage[]>()

  if (ticketIds.length > 0) {
    const { data: attachmentRows } = await admin
      .from("support_ticket_attachments")
      .select("id,ticket_id,storage_bucket,storage_path,original_file_name,mime_type,file_size,created_at")
      .in("ticket_id", ticketIds)
      .order("created_at", { ascending: true })

    for (const row of (attachmentRows || []) as SupportAttachmentRow[]) {
      const signedUrl = await createSignedUrl(admin, row)
      const item: SupportAttachment = {
        id: row.id,
        originalFileName: row.original_file_name,
        mimeType: row.mime_type,
        fileSize: Number(row.file_size || 0),
        signedUrl,
        createdAt: row.created_at,
      }
      attachmentsByTicket.set(row.ticket_id, [...(attachmentsByTicket.get(row.ticket_id) || []), item])
    }

    const { data: messageRows } = await admin
      .from("support_ticket_messages")
      .select("id,ticket_id,sender_role,message,created_at")
      .in("ticket_id", ticketIds)
      .order("created_at", { ascending: true })

    for (const row of (messageRows || []) as SupportMessageRow[]) {
      const item: SupportMessage = {
        id: row.id,
        senderRole: row.sender_role,
        message: row.message,
        createdAt: row.created_at,
      }
      messagesByTicket.set(row.ticket_id, [...(messagesByTicket.get(row.ticket_id) || []), item])
    }
  }

  return rows.map((row) => ({
    id: row.id,
    ticketNo: row.ticket_no,
    userId: row.user_id,
    requesterEmail: row.requester_email,
    requesterName: row.requester_name || "İsimsiz kullanıcı",
    category: row.category,
    categoryLabel: supportCategoryLabel(row.category),
    priority: row.priority,
    priorityLabel: supportPriorityLabel(row.priority),
    status: row.status,
    statusLabel: supportStatusLabel(row.status),
    subject: row.subject,
    description: row.description,
    pageUrl: row.page_url,
    browserInfo: row.browser_info,
    deviceType: row.device_type || "unknown",
    responseTargetHours: Number(row.response_target_hours || SUPPORT_RESPONSE_TARGET_HOURS || 24),
    ownerNote: row.owner_note,
    resolutionMessage: row.resolution_message,
    resolvedAt: row.resolved_at,
    lastUserMessageAt: row.last_user_message_at,
    lastOwnerMessageAt: row.last_owner_message_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    attachments: attachmentsByTicket.get(row.id) || [],
    messages: messagesByTicket.get(row.id) || [],
  }))
}

export async function fetchUserSupportTickets(userId: string) {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from("support_tickets")
    .select(
      "id,ticket_no,user_id,requester_email,requester_name,category,priority,status,subject,description,page_url,browser_info,device_type,response_target_hours,owner_note,resolution_message,resolved_at,last_user_message_at,last_owner_message_at,created_at,updated_at",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50)

  if (error) throw error
  return enrichTickets(admin, (data || []) as SupportTicketRow[])
}

export async function fetchOwnerSupportTickets(filters: {
  q?: string
  status?: string
  category?: string
  priority?: string
}) {
  const admin = createSupabaseAdminClient()
  let query = admin
    .from("support_tickets")
    .select(
      "id,ticket_no,user_id,requester_email,requester_name,category,priority,status,subject,description,page_url,browser_info,device_type,response_target_hours,owner_note,resolution_message,resolved_at,last_user_message_at,last_owner_message_at,created_at,updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(120)

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status)
  } else {
    query = query.neq("status", "closed")
  }
  if (filters.category && filters.category !== "all") query = query.eq("category", filters.category)
  if (filters.priority && filters.priority !== "all") query = query.eq("priority", filters.priority)

  const q = String(filters.q || "").trim()
  if (q) {
    const escaped = q.replace(/[%_]/g, "\\$&")
    query = query.or(
      `requester_email.ilike.%${escaped}%,requester_name.ilike.%${escaped}%,subject.ilike.%${escaped}%,ticket_no.ilike.%${escaped}%`,
    )
  }

  const { data, error } = await query
  if (error) throw error
  return enrichTickets(admin, (data || []) as SupportTicketRow[])
}

export function summarizeSupportTickets(tickets: SupportTicket[]) {
  return tickets.reduce(
    (acc, ticket) => {
      acc.total += 1
      if (ticket.status === "open") acc.open += 1
      if (ticket.status === "in_progress") acc.inProgress += 1
      if (ticket.status === "waiting_user") acc.waitingUser += 1
      if (ticket.status === "resolved" || ticket.status === "closed") acc.resolved += 1
      if (ticket.priority === "urgent" || ticket.priority === "high") acc.highPriority += 1
      return acc
    },
    { total: 0, open: 0, inProgress: 0, waitingUser: 0, resolved: 0, highPriority: 0 },
  )
}

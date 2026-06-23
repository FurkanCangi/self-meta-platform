import { NextResponse } from "next/server"
import { z } from "zod"
import { requireTrustedMutation } from "@/lib/security/apiGuards"
import { rejectServerControlledFields } from "@/lib/security/payloadGuards"
import { checkRateLimit, getClientRateLimitKey, rateLimitResponse } from "@/lib/security/rateLimit"
import {
  fetchUserSupportTickets,
  isMissingSupportTable,
  resolveRequesterInfo,
  SUPPORT_ATTACHMENT_BUCKET,
  SUPPORT_RESPONSE_TARGET_HOURS,
  supportCategoryLabel,
  supportPriorityLabel,
} from "@/lib/support/supportTickets"
import { sendOwnerSupportTicketEmail } from "@/lib/support/supportEmail"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const MAX_ATTACHMENTS = 3
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
])

const supportTicketSchema = z
  .object({
    email: z.string().trim().email().optional().nullable(),
    requesterName: z.string().trim().max(120).optional().nullable(),
    category: z.enum(["login", "device", "payment", "report", "education", "technical", "other"]),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    subject: z.string().trim().min(3).max(140),
    description: z.string().trim().min(10).max(4000),
    pageUrl: z.string().trim().max(500).optional().nullable(),
    browserInfo: z.string().trim().max(500).optional().nullable(),
    deviceType: z.enum(["desktop", "mobile", "tablet", "unknown"]).default("unknown"),
  })
  .passthrough()

function safeText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : ""
}

function extensionForMime(mimeType: string) {
  if (mimeType === "image/png") return "png"
  if (mimeType === "image/jpeg") return "jpg"
  if (mimeType === "image/webp") return "webp"
  if (mimeType === "image/heic") return "heic"
  if (mimeType === "image/heif") return "heif"
  if (mimeType === "application/pdf") return "pdf"
  return "bin"
}

function hasValidSignature(mimeType: string, bytes: Uint8Array) {
  if (mimeType === "image/png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  }
  if (mimeType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (mimeType === "application/pdf") {
    return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46
  }
  if (mimeType === "image/webp") {
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    )
  }
  if (mimeType === "image/heic" || mimeType === "image/heif") {
    const brand = String.fromCharCode(...bytes.slice(4, 12)).toLowerCase()
    return brand.includes("ftyp") && /(heic|heif|mif1|msf1)/.test(brand)
  }
  return false
}

function getClientIp(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for")
  return forwardedFor?.split(",")[0]?.trim() || headers.get("x-real-ip") || null
}

function appOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (origin) return origin
  return new URL(request.url).origin
}

function isMissingStorageBucket(error: unknown) {
  const message = String((error as { message?: string } | null)?.message || error || "").toLowerCase()
  const statusCode = String((error as { statusCode?: string | number } | null)?.statusCode || "")
  return (
    statusCode === "404" ||
    message.includes("bucket not found") ||
    message.includes("the resource was not found") ||
    message.includes("storage bucket") ||
    message.includes("support-attachments")
  )
}

async function getOptionalUser() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user || null
}

export async function GET(request: Request) {
  const user = await getOptionalUser()
  if (!user?.id) {
    return NextResponse.json({ ok: true, tickets: [], authenticated: false })
  }

  const rateLimit = await checkRateLimit({
    key: `support-tickets:list:${user.id}`,
    limit: 80,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  try {
    const tickets = await fetchUserSupportTickets(user.id)
    return NextResponse.json({ ok: true, tickets, authenticated: true })
  } catch (error) {
    if (isMissingSupportTable(error)) {
      return NextResponse.json({ ok: true, tickets: [], setupRequired: true, authenticated: true })
    }
    return NextResponse.json({ ok: false, error: "support_tickets_unavailable" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const originError = await requireTrustedMutation(request)
  if (originError) return originError

  const user = await getOptionalUser()
  const rateLimit = await checkRateLimit({
    key: user?.id ? `support-tickets:create:${user.id}` : getClientRateLimitKey(request, "support-tickets:create"),
    limit: user?.id ? 12 : 4,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_form_data" }, { status: 400 })
  }

  const body = {
    email: safeText(formData.get("email")),
    requesterName: safeText(formData.get("requesterName")),
    category: safeText(formData.get("category")),
    priority: safeText(formData.get("priority")) || "normal",
    subject: safeText(formData.get("subject")),
    description: safeText(formData.get("description")),
    pageUrl: safeText(formData.get("pageUrl")),
    browserInfo: safeText(formData.get("browserInfo")),
    deviceType: safeText(formData.get("deviceType")) || "unknown",
  }

  const payloadGuard = rejectServerControlledFields(body)
  if (!payloadGuard.ok) {
    return NextResponse.json(
      { ok: false, error: "server_controlled_fields_present", fields: payloadGuard.fields },
      { status: 400 },
    )
  }

  const parsed = supportTicketSchema.safeParse(body)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    if (fieldErrors.subject?.length) {
      return NextResponse.json({ ok: false, error: "support_subject_invalid" }, { status: 400 })
    }
    if (fieldErrors.description?.length) {
      return NextResponse.json({ ok: false, error: "support_description_invalid" }, { status: 400 })
    }
    if (fieldErrors.email?.length) {
      return NextResponse.json({ ok: false, error: "support_email_invalid" }, { status: 400 })
    }
    return NextResponse.json({ ok: false, error: "invalid_support_ticket_payload" }, { status: 400 })
  }

  const requester = resolveRequesterInfo(user, parsed.data.email, parsed.data.requesterName)
  if (!requester.email) {
    return NextResponse.json({ ok: false, error: "email_required" }, { status: 400 })
  }

  const files = formData
    .getAll("attachments")
    .filter((item): item is File => typeof item === "object" && "arrayBuffer" in item && "size" in item)
    .filter((file) => file.size > 0)

  if (files.length > MAX_ATTACHMENTS) {
    return NextResponse.json({ ok: false, error: "too_many_attachments" }, { status: 400 })
  }

  const preparedFiles: Array<{ file: File; bytes: Uint8Array; storagePath: string }> = []
  for (const file of files) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json({ ok: false, error: "attachment_too_large" }, { status: 413 })
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ ok: false, error: "attachment_type_invalid" }, { status: 415 })
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    if (!hasValidSignature(file.type, bytes)) {
      return NextResponse.json({ ok: false, error: "attachment_signature_invalid" }, { status: 415 })
    }

    preparedFiles.push({
      file,
      bytes,
      storagePath: `${requester.userId || "anonymous"}/${crypto.randomUUID()}.${extensionForMime(file.type)}`,
    })
  }

  try {
    const admin = createSupabaseAdminClient()
    const now = new Date().toISOString()
    const { data: ticket, error: ticketError } = await admin
      .from("support_tickets")
      .insert({
        user_id: requester.userId,
        requester_email: requester.email,
        requester_name: requester.name || null,
        category: parsed.data.category,
        priority: parsed.data.priority,
        status: "open",
        subject: parsed.data.subject,
        description: parsed.data.description,
        page_url: parsed.data.pageUrl || null,
        browser_info: parsed.data.browserInfo || request.headers.get("user-agent") || null,
        device_type: parsed.data.deviceType,
        response_target_hours: SUPPORT_RESPONSE_TARGET_HOURS,
        last_user_message_at: now,
      })
      .select("id,ticket_no")
      .single()

    if (ticketError || !ticket?.id) throw ticketError || new Error("ticket_create_failed")

    await admin.from("support_ticket_messages").insert({
      ticket_id: ticket.id,
      sender_user_id: requester.userId,
      sender_role: "user",
      message: parsed.data.description,
    })

    const attachmentRows = []
    for (const prepared of preparedFiles) {
      const { error: uploadError } = await admin.storage
        .from(SUPPORT_ATTACHMENT_BUCKET)
        .upload(prepared.storagePath, prepared.bytes, {
          contentType: prepared.file.type,
          upsert: false,
        })
      if (uploadError) throw uploadError

      attachmentRows.push({
        ticket_id: ticket.id,
        uploaded_by_user_id: requester.userId,
        uploaded_by_role: "user",
        storage_bucket: SUPPORT_ATTACHMENT_BUCKET,
        storage_path: prepared.storagePath,
        original_file_name: prepared.file.name.slice(0, 240),
        mime_type: prepared.file.type,
        file_size: prepared.file.size,
      })
    }

    if (attachmentRows.length > 0) {
      const { error: attachmentError } = await admin.from("support_ticket_attachments").insert(attachmentRows)
      if (attachmentError) throw attachmentError
    }

    await sendOwnerSupportTicketEmail({
      ticketNo: ticket.ticket_no,
      subject: parsed.data.subject,
      requesterName: requester.name || "İsimsiz kullanıcı",
      requesterEmail: requester.email,
      categoryLabel: supportCategoryLabel(parsed.data.category),
      priorityLabel: supportPriorityLabel(parsed.data.priority),
      supportUrl: `${appOrigin(request)}/owner-audit/support`,
    }).catch((emailError) => {
      console.error("[support] owner email notification failed", {
        ticketNo: ticket.ticket_no,
        error: emailError instanceof Error ? emailError.message : "unknown",
      })
    })

    return NextResponse.json({
      ok: true,
      ticket: {
        id: ticket.id,
        ticketNo: ticket.ticket_no,
        responseTargetHours: SUPPORT_RESPONSE_TARGET_HOURS,
      },
    })
  } catch (error) {
    if (isMissingSupportTable(error)) {
      return NextResponse.json(
        {
          ok: false,
          error: "support_tables_missing",
          setupRequired: true,
        },
        { status: 503 },
      )
    }
    if (isMissingStorageBucket(error)) {
      return NextResponse.json(
        {
          ok: false,
          error: "support_storage_missing",
          setupRequired: true,
        },
        { status: 503 },
      )
    }
    console.error("[support] ticket create failed", {
      error: error instanceof Error ? error.message : "unknown",
      ip: getClientIp(request.headers),
    })
    return NextResponse.json({ ok: false, error: "support_ticket_create_failed" }, { status: 500 })
  }
}

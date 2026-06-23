import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import { isOwnerAuditEmail } from "@/lib/owner/ownerAccess"
import { requireConfirmedUser, requireTrustedMutation } from "@/lib/security/apiGuards"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import { readJsonWithSchema } from "@/lib/security/schemaGuards"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const MAX_EDUCATION_VIDEO_UPLOAD_BYTES = 8 * 1024 * 1024 * 1024

const allowedMimeTypes = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
])

const extensionByMimeType: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-m4v": "m4v",
}

const mimeTypeByExtension: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  m4v: "video/x-m4v",
}

const uploadPrepareSchema = z.object({
  fileName: z.string().trim().min(1).max(240),
  contentType: z.string().trim().min(3).max(120),
  fileSize: z.number().int().positive().max(MAX_EDUCATION_VIDEO_UPLOAD_BYTES),
})

function safeFileStem(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "")
  const normalized = withoutExtension
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)

  return normalized || "egitim-videosu"
}

function buildStoragePath(fileName: string, contentType: string) {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, "0")
  const extension = extensionByMimeType[contentType] || "mp4"
  const stem = safeFileStem(fileName)

  return `therapist-egitimleri/${year}-${month}/${stem}-${randomUUID()}.${extension}`
}

function normalizeVideoContentType(fileName: string, contentType: string) {
  const normalized = contentType.toLowerCase()
  if (allowedMimeTypes.has(normalized)) return normalized

  const extension = fileName.split(".").pop()?.toLowerCase() || ""
  return mimeTypeByExtension[extension] || normalized
}

export async function POST(request: Request) {
  const originError = await requireTrustedMutation(request)
  if (originError) return originError

  const auth = await requireConfirmedUser()
  if (!auth.ok) return auth.response

  if (!isOwnerAuditEmail(auth.user.email)) {
    return NextResponse.json({ ok: false, error: "video_upload_forbidden" }, { status: 403 })
  }

  const rateLimit = await checkRateLimit({
    key: `education-video-upload:${auth.user.id}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  const parsed = await readJsonWithSchema(request, uploadPrepareSchema)
  if (!parsed.ok) return parsed.response

  const contentType = normalizeVideoContentType(parsed.data.fileName, parsed.data.contentType)
  if (!allowedMimeTypes.has(contentType)) {
    return NextResponse.json({ ok: false, error: "video_upload_type_invalid" }, { status: 415 })
  }

  const bucket = process.env.EDUCATION_VIDEO_BUCKET || "education-videos"
  const path = buildStoragePath(parsed.data.fileName, contentType)
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path, { upsert: false })

  if (error || !data) {
    const message = String(error?.message || "")
    const lowerMessage = message.toLowerCase()
    if (lowerMessage.includes("bucket") && (lowerMessage.includes("not found") || lowerMessage.includes("does not exist"))) {
      return NextResponse.json({ ok: false, error: "education_video_bucket_missing" }, { status: 503 })
    }

    return NextResponse.json({ ok: false, error: "video_upload_prepare_failed" }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    bucket,
    path: data.path || path,
    token: data.token,
    signedUrl: data.signedUrl,
    maxBytes: MAX_EDUCATION_VIDEO_UPLOAD_BYTES,
    uploadMethod: "supabase_signed_upload",
  })
}

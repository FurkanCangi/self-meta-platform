import { NextResponse } from "next/server"
import { z } from "zod"
import { isOwnerAuditEmail } from "@/lib/owner/ownerAccess"
import { requireConfirmedUser, requireTrustedMutation } from "@/lib/security/apiGuards"
import { assertNoServerControlledFields } from "@/lib/security/payloadGuards"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import { readJsonWithSchema } from "@/lib/security/schemaGuards"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

type EducationVideoListItem = {
  id: string
  slug: string
  title: string | null
  requiredPlan: string | null
  provider: string
  providerStatus: string
  playbackPolicy: string
}

type CreateEducationVideoPayload = {
  title?: unknown
  slug?: unknown
  requiredPlan?: unknown
  provider?: unknown
  providerStatus?: unknown
  playbackPolicy?: unknown
  storageBucket?: unknown
  storagePath?: unknown
  hlsManifestPath?: unknown
  providerAssetId?: unknown
  providerLibraryId?: unknown
  isActive?: unknown
}

const createEducationVideoPayloadSchema = z
  .object({
    title: z.string().max(160).optional().nullable(),
    slug: z.string().max(160).optional().nullable(),
    requiredPlan: z.string().max(80).optional().nullable(),
    provider: z.string().max(40).optional().nullable(),
    providerStatus: z.string().max(40).optional().nullable(),
    playbackPolicy: z.string().max(40).optional().nullable(),
    storageBucket: z.string().max(120).optional().nullable(),
    storagePath: z.string().max(500).optional().nullable(),
    hlsManifestPath: z.string().max(500).optional().nullable(),
    providerAssetId: z.string().max(200).optional().nullable(),
    providerLibraryId: z.string().max(200).optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .passthrough()

const PLAN_CODES = new Set(["student", "graduate", "professional", "enterprise"])
const PROVIDERS = new Set(["supabase", "bunny"])
const PROVIDER_STATUSES = new Set(["draft", "processing", "ready", "failed"])
const PLAYBACK_POLICIES = new Set(["signed_url", "signed_embed", "signed_hls"])

function slugify(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
}

function normalizeOptionalText(value: unknown, maxLength: number) {
  const normalized = String(value || "").trim()
  if (!normalized) return null
  return normalized.slice(0, maxLength)
}

function validateStoragePath(value: string | null) {
  if (!value) return null
  if (value.length > 500) throw new Error("storage_path_invalid")
  if (value.includes("..") || value.startsWith("/") || value.endsWith("/")) {
    throw new Error("storage_path_invalid")
  }
  if (!/^[A-Za-z0-9/_\-.]+$/.test(value)) throw new Error("storage_path_invalid")
  return value
}

function validateRequiredPlan(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase()
  if (!normalized) return null
  if (!PLAN_CODES.has(normalized)) throw new Error("required_plan_invalid")
  return normalized
}

function buildInsertPayload(payload: CreateEducationVideoPayload) {
  const title = normalizeOptionalText(payload.title, 160)
  const rawSlug = normalizeOptionalText(payload.slug, 160)
  const slug = slugify(rawSlug || title || "")

  if (!slug || slug.length < 3) {
    throw new Error("video_slug_invalid")
  }

  const provider = String(payload.provider || "supabase").trim().toLowerCase()
  if (!PROVIDERS.has(provider)) throw new Error("video_provider_invalid")

  const providerStatus = String(payload.providerStatus || "draft").trim().toLowerCase()
  if (!PROVIDER_STATUSES.has(providerStatus)) throw new Error("video_provider_status_invalid")

  const playbackPolicy = String(payload.playbackPolicy || "signed_url").trim().toLowerCase()
  if (!PLAYBACK_POLICIES.has(playbackPolicy)) throw new Error("video_playback_policy_invalid")

  const storageBucket = normalizeOptionalText(payload.storageBucket, 120) || "education-videos"
  const storagePath = validateStoragePath(normalizeOptionalText(payload.storagePath, 500))
  const hlsManifestPath = validateStoragePath(normalizeOptionalText(payload.hlsManifestPath, 500))
  const providerAssetId = normalizeOptionalText(payload.providerAssetId, 200)
  const providerLibraryId = normalizeOptionalText(payload.providerLibraryId, 200)

  if (provider === "supabase" && !storagePath && !hlsManifestPath) {
    throw new Error("video_storage_path_required")
  }

  if (provider === "bunny" && (!providerAssetId || !providerLibraryId)) {
    throw new Error("video_provider_ids_required")
  }

  return {
    slug,
    title,
    provider,
    provider_status: providerStatus,
    playback_policy: playbackPolicy,
    storage_bucket: storageBucket,
    storage_path: provider === "supabase" ? storagePath : null,
    hls_manifest_path: provider === "supabase" ? hlsManifestPath : null,
    provider_asset_id: provider === "bunny" ? providerAssetId : null,
    provider_library_id: provider === "bunny" ? providerLibraryId : null,
    required_plan: validateRequiredPlan(payload.requiredPlan),
    is_active: Boolean(payload.isActive),
  }
}

function mapVideoRow(row: Record<string, unknown>): EducationVideoListItem {
  return {
    id: String(row.id || ""),
    slug: String(row.slug || ""),
    title: row.title ? String(row.title) : null,
    requiredPlan: row.required_plan ? String(row.required_plan) : null,
    provider: String(row.provider || process.env.VIDEO_PROVIDER || "supabase"),
    providerStatus: String(row.provider_status || "draft"),
    playbackPolicy: String(row.playback_policy || "signed_url"),
  }
}

export async function GET() {
  const auth = await requireConfirmedUser()
  if (!auth.ok) return auth.response

  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from("education_video_assets")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    const message = String(error.message || "")
    const setupRequired =
      message.includes("education_video_assets") &&
      (message.toLowerCase().includes("does not exist") || message.toLowerCase().includes("could not find"))

    if (setupRequired) {
      return NextResponse.json({
        ok: true,
        items: [],
        setupRequired: true,
        canManage: isOwnerAuditEmail(auth.user.email),
      })
    }

    return NextResponse.json({ ok: false, error: "video_list_failed" }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    items: (data || []).map((row) => mapVideoRow(row as Record<string, unknown>)),
    setupRequired: false,
    canManage: isOwnerAuditEmail(auth.user.email),
  })
}

export async function POST(request: Request) {
  const originError = await requireTrustedMutation(request)
  if (originError) return originError

  const auth = await requireConfirmedUser()
  if (!auth.ok) return auth.response

  if (!isOwnerAuditEmail(auth.user.email)) {
    return NextResponse.json({ ok: false, error: "video_manage_forbidden" }, { status: 403 })
  }

  const rateLimit = await checkRateLimit({
    key: `education-video-manage:${auth.user.id}`,
    limit: 30,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  const parsedPayload = await readJsonWithSchema(request, createEducationVideoPayloadSchema)
  if (!parsedPayload.ok) return parsedPayload.response

  let payload: CreateEducationVideoPayload
  try {
    payload = parsedPayload.data
    assertNoServerControlledFields(payload)
  } catch {
    return NextResponse.json({ ok: false, error: "server_controlled_fields_present" }, { status: 400 })
  }

  let insertPayload: ReturnType<typeof buildInsertPayload>
  try {
    insertPayload = buildInsertPayload(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : "video_payload_invalid"
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from("education_video_assets")
    .insert(insertPayload)
    .select("*")
    .single()

  if (error) {
    const message = String(error.message || "")
    if (message.toLowerCase().includes("duplicate key")) {
      return NextResponse.json({ ok: false, error: "video_slug_conflict" }, { status: 409 })
    }
    if (message.includes("education_video_assets") && message.toLowerCase().includes("does not exist")) {
      return NextResponse.json({ ok: false, error: "video_setup_required" }, { status: 503 })
    }
    return NextResponse.json({ ok: false, error: "video_create_failed" }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    item: mapVideoRow(data as Record<string, unknown>),
  })
}

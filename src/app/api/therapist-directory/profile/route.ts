import { NextResponse } from "next/server"
import { z } from "zod"
import { requireTrustedMutation } from "@/lib/security/apiGuards"
import { rejectServerControlledFields } from "@/lib/security/payloadGuards"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import { readJsonWithSchema } from "@/lib/security/schemaGuards"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { mapDirectoryRow, normalizeDirectoryInput } from "@/lib/therapists/directory"

const therapistDirectoryPayloadSchema = z
  .object({
    firstName: z.string().max(220).optional().nullable(),
    lastName: z.string().max(220).optional().nullable(),
    profession: z.string().max(220).optional().nullable(),
    title: z.string().max(220).optional().nullable(),
    workplace: z.string().max(220).optional().nullable(),
    city: z.string().max(220).optional().nullable(),
    district: z.string().max(220).optional().nullable(),
    publicPhone: z.string().max(80).optional().nullable(),
    publicEmail: z.string().max(180).optional().nullable(),
    shortAddress: z.string().max(320).optional().nullable(),
    specialties: z.string().max(900).optional().nullable(),
    publicListingEnabled: z.boolean().optional(),
  })
  .passthrough()

async function getCurrentUser() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user?.id) {
    return null
  }

  return user
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  try {
    const admin = createSupabaseAdminClient()
    const { data, error } = await admin
      .from("therapist_directory_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ ok: true, profile: null, warning: "directory_profile_unavailable" })
    }

    return NextResponse.json({ ok: true, profile: data ? mapDirectoryRow(data) : null })
  } catch {
    return NextResponse.json({ ok: false, error: "directory_profile_fetch_failed" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const originError = await requireTrustedMutation(request)
  if (originError) return originError

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  try {
    const rateLimit = await checkRateLimit({
      key: `therapist-directory-profile:${user.id}`,
      limit: 20,
      windowMs: 60 * 60 * 1000,
    })
    if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

    const parsedBody = await readJsonWithSchema(request, therapistDirectoryPayloadSchema)
    if (!parsedBody.ok) return parsedBody.response
    const body = parsedBody.data
    const guard = rejectServerControlledFields(body)
    if (!guard.ok) {
      return NextResponse.json(
        { ok: false, error: "server_controlled_fields_present", fields: guard.fields },
        { status: 400 }
      )
    }

    const input = normalizeDirectoryInput(body || {})
    const admin = createSupabaseAdminClient()

    const { data: existing, error: existingError } = await admin
      .from("therapist_directory_profiles")
      .select("publication_status, education_completed_at")
      .eq("user_id", user.id)
      .maybeSingle()

    if (existingError) {
      throw existingError
    }

    const publicationStatus =
      existing?.publication_status === "approved" && input.public_listing_enabled
        ? "approved"
        : existing?.publication_status === "rejected"
          ? "pending"
          : existing?.publication_status || "pending"

    const { data, error } = await admin
      .from("therapist_directory_profiles")
      .upsert(
        {
          user_id: user.id,
          ...input,
          publication_status: publicationStatus,
        },
        { onConflict: "user_id" },
      )
      .select("*")
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ ok: true, profile: mapDirectoryRow(data) })
  } catch {
    return NextResponse.json({ ok: false, error: "directory_profile_save_failed" }, { status: 500 })
  }
}

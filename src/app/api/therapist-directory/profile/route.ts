import { NextResponse } from "next/server"
import { z } from "zod"
import { requireTrustedMutation } from "@/lib/security/apiGuards"
import { rejectServerControlledFields } from "@/lib/security/payloadGuards"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import { readJsonWithSchema } from "@/lib/security/schemaGuards"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import {
  getDirectoryPublicationMissingFields,
  hasTooManyDirectorySpecialties,
  mapDirectoryRow,
  MAX_DIRECTORY_SPECIALTIES,
  MAX_DIRECTORY_SPECIALTY_LENGTH,
  normalizeDirectoryInput,
} from "@/lib/therapists/directory"

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
    specialties: z
      .union([
        z.string().max(900),
        z.array(z.string().trim().min(1).max(MAX_DIRECTORY_SPECIALTY_LENGTH)).max(MAX_DIRECTORY_SPECIALTIES),
      ])
      .optional()
      .nullable(),
    publicListingEnabled: z.boolean().optional(),
  })
  .passthrough()

function isMissingDirectoryTable(error: unknown) {
  const code = String((error as { code?: string } | null)?.code || "")
  const message = String((error as { message?: string } | null)?.message || error || "").toLowerCase()

  return (
    code === "42P01" ||
    code === "PGRST205" ||
    (message.includes("therapist_directory_profiles") &&
      (message.includes("does not exist") || message.includes("relation") || message.includes("schema cache")))
  )
}

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
      return NextResponse.json({
        ok: true,
        profile: null,
        warning: isMissingDirectoryTable(error) ? "directory_profile_setup_required" : "directory_profile_unavailable",
      })
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

    if (hasTooManyDirectorySpecialties(body.specialties)) {
      return NextResponse.json({ ok: false, error: "too_many_specialties" }, { status: 400 })
    }

    const input = normalizeDirectoryInput(body || {})
    const missingFields = getDirectoryPublicationMissingFields(input)
    const admin = createSupabaseAdminClient()

    const { data: existing, error: existingError } = await admin
      .from("therapist_directory_profiles")
      .select("publication_status")
      .eq("user_id", user.id)
      .maybeSingle()

    if (existingError) {
      if (isMissingDirectoryTable(existingError)) {
        return NextResponse.json(
          { ok: false, error: "directory_profile_setup_required", setupRequired: true },
          { status: 503 },
        )
      }
      throw existingError
    }

    const ownerBlocked = existing?.publication_status === "hidden" || existing?.publication_status === "rejected"
    const publicationStatus = ownerBlocked
      ? existing.publication_status
      : input.public_listing_enabled && missingFields.length === 0
        ? "approved"
        : existing?.publication_status === "approved" && !input.public_listing_enabled
          ? "approved"
          : "pending"

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
      if (isMissingDirectoryTable(error)) {
        return NextResponse.json(
          { ok: false, error: "directory_profile_setup_required", setupRequired: true },
          { status: 503 },
        )
      }
      throw error
    }

    return NextResponse.json({
      ok: true,
      profile: mapDirectoryRow(data),
      publication: {
        visible:
          input.public_listing_enabled && publicationStatus === "approved" && missingFields.length === 0,
        missingFields,
      },
    })
  } catch (error) {
    console.error("[therapist-directory] profile save failed", {
      error: error instanceof Error ? error.message : "unknown",
    })
    return NextResponse.json({ ok: false, error: "directory_profile_save_failed" }, { status: 500 })
  }
}

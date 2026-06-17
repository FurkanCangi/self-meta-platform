import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { mapDirectoryRow, normalizeDirectoryInput } from "@/lib/therapists/directory"

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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Profil alınamadı."
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Profil kaydedilemedi."
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

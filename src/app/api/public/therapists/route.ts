import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { mapPublicTherapist } from "@/lib/therapists/directory"

function isMissingDirectoryTable(error: unknown) {
  if (!error || typeof error !== "object") return false
  const maybeError = error as { code?: string; message?: string }
  return (
    maybeError.code === "42P01" ||
    maybeError.code === "PGRST205" ||
    Boolean(
      maybeError.message?.includes("therapist_directory_profiles") &&
        (maybeError.message.includes("does not exist") ||
          maybeError.message.includes("relation") ||
          maybeError.message.includes("schema cache")),
    )
  )
}

export async function GET() {
  try {
    const admin = createSupabaseAdminClient()
    const { data, error } = await admin
      .from("therapist_directory_profiles")
      .select(
        "user_id, first_name, last_name, profession, title, workplace, city, district, public_phone, public_email, short_address, specialties",
      )
      .eq("public_listing_enabled", true)
      .eq("publication_status", "approved")
      .not("education_completed_at", "is", null)
      .order("city", { ascending: true })
      .order("last_name", { ascending: true })
      .limit(500)

    if (error) {
      if (isMissingDirectoryTable(error)) {
        return NextResponse.json({
          ok: true,
          therapists: [],
          setupRequired: true,
        })
      }
      throw error
    }

    return NextResponse.json({
      ok: true,
      therapists: (data || []).map(mapPublicTherapist),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terapist listesi alınamadı."
    return NextResponse.json({ ok: false, therapists: [], error: message }, { status: 500 })
  }
}

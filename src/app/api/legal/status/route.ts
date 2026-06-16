import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ACTIVE_LEGAL_DOCUMENTS, hasAcceptedActiveDocuments } from "@/lib/legal/documents"

type LegalAcceptanceRow = {
  accepted_documents: unknown
  accepted_at: string
  plan_code: string
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user?.id) {
    return NextResponse.json(
      {
        ok: true,
        authenticated: false,
        configured: true,
        accepted: false,
        documents: ACTIVE_LEGAL_DOCUMENTS,
      },
      { status: 401 }
    )
  }

  try {
    const admin = createSupabaseAdminClient()
    const [{ data: acceptances, error: acceptanceError }, { data: profile, error: profileError }] =
      await Promise.all([
        admin
          .from("legal_acceptances")
          .select("accepted_documents, accepted_at, plan_code")
          .eq("user_id", user.id)
          .order("accepted_at", { ascending: false })
          .limit(10),
        admin
          .from("profiles")
          .select("plan")
          .eq("user_id", user.id)
          .maybeSingle(),
      ])

    if (acceptanceError) throw acceptanceError
    if (profileError) throw profileError

    const rows = (acceptances || []) as LegalAcceptanceRow[]
    const latestCurrent = rows.find((row) => hasAcceptedActiveDocuments(row.accepted_documents))

    return NextResponse.json({
      ok: true,
      authenticated: true,
      configured: true,
      accepted: Boolean(latestCurrent),
      acceptedAt: latestCurrent?.accepted_at || null,
      planCode: latestCurrent?.plan_code || profile?.plan || "none",
      profilePlan: profile?.plan || "none",
      documents: ACTIVE_LEGAL_DOCUMENTS,
    })
  } catch (statusError) {
    const message = statusError instanceof Error ? statusError.message : "Hukuki kabul durumu alınamadı."
    return NextResponse.json({
      ok: false,
      authenticated: true,
      configured: false,
      accepted: false,
      error: message,
      documents: ACTIVE_LEGAL_DOCUMENTS,
    })
  }
}

import { notFound } from "next/navigation"
import { assertOwnerAuditAccess } from "@/lib/owner/ownerAccess"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import OwnerEducationClient from "./OwnerEducationClient"

export default async function OwnerEducationPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  try {
    assertOwnerAuditAccess(user?.email)
  } catch {
    notFound()
  }

  return <OwnerEducationClient />
}

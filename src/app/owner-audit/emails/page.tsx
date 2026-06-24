import { notFound } from "next/navigation"
import { assertOwnerAuditAccess } from "@/lib/owner/ownerAccess"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import OwnerBulkEmailClient from "./OwnerBulkEmailClient"

export default async function OwnerBulkEmailsPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  try {
    assertOwnerAuditAccess(user?.email)
  } catch {
    notFound()
  }

  return <OwnerBulkEmailClient ownerEmail={user?.email || ""} />
}

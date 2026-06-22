import { notFound } from "next/navigation"
import { assertOwnerAuditAccess } from "@/lib/owner/ownerAccess"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import OwnerNotificationsClient from "./OwnerNotificationsClient"

export default async function OwnerNotificationsPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  try {
    assertOwnerAuditAccess(user?.email)
  } catch {
    notFound()
  }

  return <OwnerNotificationsClient />
}

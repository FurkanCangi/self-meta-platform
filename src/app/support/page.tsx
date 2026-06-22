import {
  fetchUserSupportTickets,
  isMissingSupportTable,
  type SupportTicket,
} from "@/lib/support/supportTickets"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import SupportClient from "./SupportClient"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function pickQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || ""
}

function normalizeCategory(value: string) {
  const allowed = new Set(["login", "device", "payment", "report", "education", "technical", "other"])
  return allowed.has(value) ? value : "technical"
}

export default async function SupportPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const params = await searchParams
  const queryEmail = pickQueryValue(params.email)
  const queryCategory = normalizeCategory(pickQueryValue(params.category))

  let tickets: SupportTicket[] = []
  let setupRequired = false

  if (user?.id) {
    try {
      tickets = await fetchUserSupportTickets(user.id)
    } catch (error) {
      setupRequired = isMissingSupportTable(error)
    }
  }

  return (
    <SupportClient
      initialTickets={tickets}
      initialEmail={user?.email || queryEmail}
      initialCategory={queryCategory}
      authenticated={Boolean(user?.id)}
      setupRequired={setupRequired}
    />
  )
}

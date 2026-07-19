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

function dnaChatFeedbackDefaults(params: Record<string, string | string[] | undefined>) {
  const feedback = pickQueryValue(params.feedback)
  if (feedback !== "dna_source" && feedback !== "dna_answer") {
    return { subject: "", description: "" }
  }
  const request = pickQueryValue(params.request)
  const source = pickQueryValue(params.source)
  const citation = pickQueryValue(params.citation)
  const safeRequest = /^[a-zA-Z0-9_-]{1,120}$/.test(request) ? request : ""
  const safeSource = /^[a-zA-Z0-9._:-]{1,120}$/.test(source) ? source : ""
  const safeCitation = /^[a-zA-Z0-9._:-]{1,120}$/.test(citation) ? citation : ""
  const subject = feedback === "dna_source"
    ? "DNA Asistanı kaynak hatası"
    : "DNA Asistanı cevap sorunu"
  const references = [
    safeRequest ? `Teknik istek referansı: ${safeRequest}` : "",
    feedback === "dna_source" && safeSource ? `Kaynak referansı: ${safeSource}` : "",
    feedback === "dna_source" && safeCitation ? `Kaynak kartı referansı: ${safeCitation}` : "",
  ].filter(Boolean)
  return {
    subject,
    description: `${references.join("\n")}\n\nLütfen sorunu danışan bilgisi, soru/cevap metni veya klinik içerik paylaşmadan açıklayın.`,
  }
}

export default async function SupportPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const params = await searchParams
  const queryEmail = pickQueryValue(params.email)
  const queryCategory = normalizeCategory(pickQueryValue(params.category))
  const feedbackDefaults = dnaChatFeedbackDefaults(params)

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
      initialSubject={feedbackDefaults.subject}
      initialDescription={feedbackDefaults.description}
      authenticated={Boolean(user?.id)}
      setupRequired={setupRequired}
    />
  )
}

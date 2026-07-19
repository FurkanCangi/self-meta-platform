import type { Metadata } from "next"
import { DNA_INTELLIGENCE_PUBLIC_INTENDED_USE } from "@/lib/dna/chat/intendedUse"
import DnaAssistantClient from "./DnaAssistantClient"

export const metadata: Metadata = {
  title: "DNA Asistanı | DNA Intelligence",
  description: DNA_INTELLIGENCE_PUBLIC_INTENDED_USE.descriptionTr,
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function DnaAssistantPage({ searchParams }: PageProps) {
  const params = await searchParams

  return (
    <DnaAssistantClient
      initialReportId={firstParam(params.report_id) || ""}
    />
  )
}

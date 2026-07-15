import DnaAssistantClient from "./DnaAssistantClient"

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function DnaAssistantPage({ searchParams }: PageProps) {
  const params = await searchParams
  const requestedMode = firstParam(params.mode)
  const initialMode = requestedMode === "theory" || requestedMode === "case" ? requestedMode : "dna"

  return (
    <DnaAssistantClient
      initialMode={initialMode}
      initialReportId={firstParam(params.report_id) || ""}
    />
  )
}

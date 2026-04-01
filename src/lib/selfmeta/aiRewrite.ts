import OpenAI from "openai"
import { buildAIClinicalPrompt } from "./aiClinicalPrompt"
import { estimateRagCoverage, selectProRagContext } from "./ragSelector"

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY tanımlı değil.")
  }

  return new OpenAI({
    apiKey,
    timeout: 45000,
    maxRetries: 0,
  })
}

function normalizeReasoningEffort(value?: string) {
  const raw = String(value || "").trim().toLowerCase()
  if (raw === "none" || raw === "minimal" || raw === "low" || raw === "medium" || raw === "high" || raw === "xhigh") {
    return raw
  }
  return undefined
}

function normalizeVerbosity(value?: string) {
  const raw = String(value || "").trim().toLowerCase()
  if (raw === "low" || raw === "medium" || raw === "high") return raw
  return undefined
}

function normalizeMaxOutputTokens(value?: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 3200
  return Math.floor(parsed)
}

export async function rewriteClinicalReport(analysis: {
  totalScore?: number
  ageBandLabel?: string | null
  profileType: string
  globalLevel: string
  priorityDomains: string[]
  domainSummary: Record<string, string>
  domainScoreSummary?: Record<string, { score: number; level: string }>
  anamnezThemes: string[]
  weakDomains?: string[]
  strongDomains?: string[]
  matchedDomains?: string[]
  patternSummary?: string
  primaryWeakDomain?: string
  preservedDomainSummary?: string
  contrastSummary?: string
  anamnezConsistency?: string
  therapistInsights?: string[]
  externalClinicalFindings?: string[]
  externalClinicalWarnings?: string[]
  criticalItemLines?: string[]
  alignedItemLines?: string[]
  itemSignalSummary?: string
  qualityFocusMode?: "balanced" | "selective" | "paired" | "widespread"
  qualityPrimaryEvidenceLines?: string[]
  qualitySupportingEvidenceLines?: string[]
  qualityRestraintLines?: string[]
  qualityCautionLines?: string[]
}) {
  const ragContext = selectProRagContext(analysis)
  const prompt = buildAIClinicalPrompt({
    ...analysis,
    ragGeneralContext: ragContext.grouped.general.map((chunk) => chunk.text),
    ragDomainContext: ragContext.grouped.domain.map((chunk) => chunk.text),
    ragPatternContext: ragContext.grouped.pattern.map((chunk) => chunk.text),
    ragAnamnezContext: ragContext.grouped.anamnesis.map((chunk) => chunk.text),
    ragSummaryContext: ragContext.grouped.summary.map((chunk) => chunk.text),
  })
  const client = getClient()
  const reasoningEffort = normalizeReasoningEffort(process.env.OPENAI_REPORT_REASONING_EFFORT)
  const verbosity = normalizeVerbosity(process.env.OPENAI_REPORT_VERBOSITY)
  const maxOutputTokens = normalizeMaxOutputTokens(process.env.OPENAI_REPORT_MAX_OUTPUT_TOKENS)

  let lastError: unknown = null

  for (let attempt = 1; attempt <= 1; attempt++) {
    try {
      const res = await client.responses.create({
        model: process.env.OPENAI_REPORT_MODEL || "gpt-5.1",
        input: prompt,
        max_output_tokens: maxOutputTokens,
        ...(reasoningEffort
          ? {
              reasoning: {
                effort: reasoningEffort,
              },
            }
          : {}),
        ...(verbosity
          ? {
              text: {
                verbosity,
              },
            }
          : {}),
      })

      const text = (res.output_text || "").trim()

      if (!text) {
        throw new Error("AI rewrite boş döndü.")
      }

      const ragCoverage = estimateRagCoverage(text, ragContext)
      console.log("[AI-REPORT] rag_selected_ids=", ragContext.ids.join(","))
      console.log("[AI-REPORT] rag_estimated_coverage=", `${ragCoverage.overall}%`)
      console.log("[AI-REPORT] rag_coverage_by_group=", JSON.stringify(ragCoverage.byGroup))

      return text
    } catch (err) {
      lastError = err
      if (attempt < 3) {
        await sleep(2000 * attempt)
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("AI rewrite isteği başarısız oldu.")
}

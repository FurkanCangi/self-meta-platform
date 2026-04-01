import OpenAI from "openai"
import { buildAIClinicalPrompt } from "./aiClinicalPrompt"
import type { ExternalTestCategory } from "./externalTestRegistry"
import { estimateRagCoverage, selectProRagContext, type SelectedProRagContext } from "./ragSelector"

type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh"
type VerbosityLevel = "low" | "medium" | "high"

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getClient(timeoutMs: number) {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY tanımlı değil.")
  }

  return new OpenAI({
    apiKey,
    timeout: timeoutMs,
    maxRetries: 0,
  })
}

function normalizeReasoningEffort(value?: string): ReasoningEffort | undefined {
  const raw = String(value || "").trim().toLowerCase()
  if (raw === "none" || raw === "minimal" || raw === "low" || raw === "medium" || raw === "high" || raw === "xhigh") {
    return raw
  }
  return undefined
}

function normalizeVerbosity(value?: string): VerbosityLevel | undefined {
  const raw = String(value || "").trim().toLowerCase()
  if (raw === "low" || raw === "medium" || raw === "high") return raw
  return undefined
}

function normalizeMaxOutputTokens(value?: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 3200
  return Math.floor(parsed)
}

type RewriteAnalysis = Parameters<typeof rewriteClinicalReport>[0]

type AttemptPlan = {
  timeoutMs: number
  maxOutputTokens: number
  reasoningEffort?: ReasoningEffort
  verbosity?: VerbosityLevel
  ragContext: SelectedProRagContext
  prompt: string
  label: string
}

function normalizeLineKey(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase()
}

function dedupeLines(lines?: string[], limit?: number) {
  if (limit === 0) return []
  const seen = new Set<string>()
  const out: string[] = []

  for (const raw of lines || []) {
    const clean = String(raw || "").replace(/\s+/g, " ").trim()
    if (!clean) continue
    const key = normalizeLineKey(clean)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(clean)
    if (typeof limit === "number" && out.length >= limit) break
  }

  return out
}

function downgradeReasoningEffort(value?: ReasoningEffort): ReasoningEffort | undefined {
  switch (value) {
    case "xhigh":
      return "medium"
    case "high":
      return "medium"
    case "medium":
      return "low"
    case "minimal":
    case "none":
    case "low":
    default:
      return value
  }
}

function downgradeVerbosity(value?: VerbosityLevel): VerbosityLevel | undefined {
  switch (value) {
    case "high":
      return "medium"
    case "medium":
      return "low"
    default:
      return value
  }
}

function hasMotorPraxisFocus(analysis: RewriteAnalysis) {
  const categories = new Set<ExternalTestCategory>(analysis.externalTestCategories || [])
  const joined = [
    analysis.profileType,
    analysis.primaryWeakDomain,
    ...(analysis.externalClinicalFindings || []),
    ...(analysis.qualityPrimaryEvidenceLines || []),
    ...(analysis.qualitySupportingEvidenceLines || []),
  ]
    .join(" ")
    .toLowerCase()

  return (
    analysis.primaryExternalTestCategory === "motor_praxis" ||
    categories.has("motor_praxis") ||
    /sipt|somatodispraks|praksi|motor planlama|mabc|pdms|beery vmi|beden organizasyonu/.test(joined)
  )
}

function selectRagSubset(
  ragContext: SelectedProRagContext,
  limits: Partial<Record<keyof SelectedProRagContext["grouped"], number>>
): SelectedProRagContext {
  const grouped = {
    general: ragContext.grouped.general.slice(0, limits.general ?? ragContext.grouped.general.length),
    domain: ragContext.grouped.domain.slice(0, limits.domain ?? ragContext.grouped.domain.length),
    pattern: ragContext.grouped.pattern.slice(0, limits.pattern ?? ragContext.grouped.pattern.length),
    anamnesis: ragContext.grouped.anamnesis.slice(0, limits.anamnesis ?? ragContext.grouped.anamnesis.length),
    summary: ragContext.grouped.summary.slice(0, limits.summary ?? ragContext.grouped.summary.length),
  }
  const chunks = [
    ...grouped.general,
    ...grouped.domain,
    ...grouped.pattern,
    ...grouped.anamnesis,
    ...grouped.summary,
  ]

  return {
    chunks,
    grouped,
    ids: chunks.map((chunk) => chunk.id),
  }
}

function getAttemptLimits(analysis: RewriteAnalysis, attempt: 1 | 2 | 3) {
  const focusMode = analysis.qualityFocusMode
  const isBalanced = focusMode === "balanced"
  const isBroad = focusMode === "widespread"
  const isPaired = focusMode === "paired"
  const isPraxisHeavy = hasMotorPraxisFocus(analysis)

  if (attempt === 1) {
    if (isPraxisHeavy) {
      return {
        therapist: 1,
        external: 2,
        warnings: 1,
        critical: 2,
        aligned: 1,
        evidencePrimary: 2,
        evidenceSupporting: 1,
        restraints: 2,
        cautions: 1,
        rag: { general: 0, domain: 1, pattern: 1, anamnesis: 1, summary: 1 },
      }
    }

    return {
      therapist: 2,
      external: isBalanced ? 1 : isBroad ? 4 : isPaired ? 3 : 2,
      warnings: 2,
      critical: isBalanced ? 1 : isBroad ? 3 : 2,
      aligned: isBalanced ? 1 : 2,
      evidencePrimary: isBalanced ? 2 : 3,
      evidenceSupporting: isBalanced ? 1 : isBroad ? 3 : 2,
      restraints: 3,
      cautions: 2,
      rag: isBalanced
        ? { general: 1, domain: 1, pattern: 1, anamnesis: 0, summary: 1 }
        : isBroad
        ? { general: 1, domain: 2, pattern: 2, anamnesis: 2, summary: 1 }
        : isPaired
        ? { general: 1, domain: 2, pattern: 2, anamnesis: 1, summary: 1 }
        : { general: 1, domain: 2, pattern: 1, anamnesis: 1, summary: 1 },
    }
  }

  if (attempt === 3) {
    return {
      therapist: 1,
      external: 1,
      warnings: 1,
      critical: 1,
      aligned: 1,
      evidencePrimary: 1,
      evidenceSupporting: 0,
      restraints: 2,
      cautions: 1,
      rag: { general: 0, domain: 1, pattern: 1, anamnesis: 0, summary: 1 },
    }
  }

  if (isPraxisHeavy) {
    return {
      therapist: 1,
      external: 1,
      warnings: 1,
      critical: 1,
      aligned: 1,
      evidencePrimary: 1,
      evidenceSupporting: 0,
      restraints: 2,
      cautions: 1,
      rag: { general: 0, domain: 1, pattern: 1, anamnesis: 0, summary: 1 },
    }
  }

  return {
    therapist: 1,
    external: isBroad ? 3 : 2,
    warnings: 1,
    critical: 1,
    aligned: 1,
    evidencePrimary: 2,
    evidenceSupporting: 1,
    restraints: 2,
    cautions: 1,
    rag: isBroad
      ? { general: 1, domain: 1, pattern: 2, anamnesis: 1, summary: 1 }
      : { general: 1, domain: 1, pattern: 1, anamnesis: 1, summary: 1 },
  }
}

function buildAttemptPlan(
  analysis: RewriteAnalysis,
  baseRagContext: SelectedProRagContext,
  attempt: 1 | 2 | 3,
  baseReasoningEffort?: ReasoningEffort,
  baseVerbosity?: VerbosityLevel,
  baseMaxOutputTokens = 3200
): AttemptPlan {
  const limits = getAttemptLimits(analysis, attempt)
  const ragContext = selectRagSubset(baseRagContext, limits.rag)
  const praxisCase = hasMotorPraxisFocus(analysis)
  const balancedCase = analysis.qualityFocusMode === "balanced"
  const reducedAnalysis = {
    ...analysis,
    therapistInsights: dedupeLines(analysis.therapistInsights, limits.therapist),
    externalClinicalFindings: dedupeLines(analysis.externalClinicalFindings, limits.external),
    externalClinicalWarnings: dedupeLines(analysis.externalClinicalWarnings, limits.warnings),
    criticalItemLines: dedupeLines(analysis.criticalItemLines, limits.critical),
    alignedItemLines: dedupeLines(analysis.alignedItemLines, limits.aligned),
    qualityPrimaryEvidenceLines: dedupeLines(analysis.qualityPrimaryEvidenceLines, limits.evidencePrimary),
    qualitySupportingEvidenceLines: dedupeLines(analysis.qualitySupportingEvidenceLines, limits.evidenceSupporting),
    qualityRestraintLines: dedupeLines(analysis.qualityRestraintLines, limits.restraints),
    qualityCautionLines: dedupeLines(analysis.qualityCautionLines, limits.cautions),
  }

  const prompt = buildAIClinicalPrompt({
    ...reducedAnalysis,
    ragGeneralContext: ragContext.grouped.general.map((chunk) => chunk.text),
    ragDomainContext: ragContext.grouped.domain.map((chunk) => chunk.text),
    ragPatternContext: ragContext.grouped.pattern.map((chunk) => chunk.text),
    ragAnamnezContext: ragContext.grouped.anamnesis.map((chunk) => chunk.text),
    ragSummaryContext: ragContext.grouped.summary.map((chunk) => chunk.text),
    compactMode: praxisCase && attempt >= 2 ? "lean" : attempt === 3 ? "lean" : "standard",
  })

  const broadCase = analysis.qualityFocusMode === "widespread"
  const pairedCase = analysis.qualityFocusMode === "paired"
  const attemptTokenCap =
    attempt === 3
      ? balancedCase
        ? 1400
        : 1800
      :
    attempt === 1
      ? praxisCase
        ? 3400
        : balancedCase
        ? 2400
        : broadCase
        ? 5200
        : pairedCase
        ? 4500
        : 3800
      : praxisCase
      ? 2200
      : broadCase
      ? 3800
      : pairedCase
      ? 3400
      : 3000

  return {
    timeoutMs:
      attempt === 3
        ? 18000
        : praxisCase
        ? attempt === 1
          ? 26000
          : 22000
        : attempt === 1
        ? balancedCase
          ? 22000
          : 30000
        : 24000,
    maxOutputTokens: Math.min(baseMaxOutputTokens, attemptTokenCap),
    reasoningEffort:
      attempt === 3
        ? "minimal"
        : praxisCase && attempt === 2
        ? "low"
        : attempt === 1
        ? baseReasoningEffort
        : downgradeReasoningEffort(baseReasoningEffort),
    verbosity:
      attempt === 3
        ? "low"
        : praxisCase && attempt === 2
        ? "low"
        : attempt === 1
        ? baseVerbosity
        : downgradeVerbosity(baseVerbosity),
    ragContext,
    prompt,
    label: attempt === 1 ? "primary" : attempt === 2 ? "compact-retry" : "ultra-compact-retry",
  }
}

function isRetryableRewriteError(err: unknown) {
  const text = err instanceof Error ? `${err.name} ${err.message}`.toLowerCase() : String(err || "").toLowerCase()
  return /timeout|timed out|aborted|deadline|empty|boş|connection|rate limit|overloaded/.test(text)
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
  externalTestCategories?: ExternalTestCategory[]
  primaryExternalTestCategory?: ExternalTestCategory | null
  criticalItemLines?: string[]
  alignedItemLines?: string[]
  itemSignalSummary?: string
  qualityFocusMode?: "balanced" | "selective" | "paired" | "widespread"
  qualityPrimaryEvidenceLines?: string[]
  qualitySupportingEvidenceLines?: string[]
  qualityRestraintLines?: string[]
  qualityCautionLines?: string[]
}) {
  const baseRagContext = selectProRagContext(analysis)
  const reasoningEffort = normalizeReasoningEffort(process.env.OPENAI_REPORT_REASONING_EFFORT)
  const verbosity = normalizeVerbosity(process.env.OPENAI_REPORT_VERBOSITY)
  const maxOutputTokens = normalizeMaxOutputTokens(process.env.OPENAI_REPORT_MAX_OUTPUT_TOKENS)
  const attempts: AttemptPlan[] = [
    buildAttemptPlan(analysis, baseRagContext, 1, reasoningEffort, verbosity, maxOutputTokens),
    buildAttemptPlan(analysis, baseRagContext, 2, reasoningEffort, verbosity, maxOutputTokens),
    buildAttemptPlan(analysis, baseRagContext, 3, reasoningEffort, verbosity, maxOutputTokens),
  ]

  let lastError: unknown = null

  for (let index = 0; index < attempts.length; index++) {
    const attempt = attempts[index]
    const client = getClient(attempt.timeoutMs)
    try {
      const res = await client.responses.create({
        model: process.env.OPENAI_REPORT_MODEL || "gpt-5.1",
        input: attempt.prompt,
        max_output_tokens: attempt.maxOutputTokens,
        ...(attempt.reasoningEffort
          ? {
              reasoning: {
                effort: attempt.reasoningEffort,
              },
            }
          : {}),
        ...(attempt.verbosity
          ? {
              text: {
                verbosity: attempt.verbosity,
              },
            }
          : {}),
      })

      const text = (res.output_text || "").trim()

      if (!text) {
        throw new Error("AI rewrite boş döndü.")
      }

      const ragCoverage = estimateRagCoverage(text, attempt.ragContext)
      console.log("[AI-REPORT] rewrite_attempt=", attempt.label)
      console.log("[AI-REPORT] rag_selected_ids=", attempt.ragContext.ids.join(","))
      console.log("[AI-REPORT] rag_estimated_coverage=", `${ragCoverage.overall}%`)
      console.log("[AI-REPORT] rag_coverage_by_group=", JSON.stringify(ragCoverage.byGroup))

      return text
    } catch (err) {
      lastError = err
      const retryable = isRetryableRewriteError(err)
      console.error("[AI-REPORT] rewrite_attempt_failed=", attempt.label, err)
      if (index < attempts.length - 1 && retryable) {
        await sleep(1200 * (index + 1))
        continue
      }
      break
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("AI rewrite isteği başarısız oldu.")
}

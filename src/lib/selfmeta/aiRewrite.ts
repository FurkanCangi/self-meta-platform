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

function normalizeBudgetUsd(value?: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0.05
  return Math.min(0.05, Math.max(0.01, parsed))
}

function normalizeMaxOutputTokens(value?: string, tightBudget = true) {
  const parsed = Number(value)
  const ceiling = tightBudget ? 3000 : 3200
  if (!Number.isFinite(parsed) || parsed <= 0) return ceiling
  return Math.floor(Math.min(parsed, ceiling))
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

function normalizeMaxAttempts(value?: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 2
  return Math.max(1, Math.min(2, Math.floor(parsed)))
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

function applyBudgetTightening(
  limits: ReturnType<typeof getAttemptLimitsBase>,
  attempt: 1 | 2 | 3,
  tightBudget: boolean
) {
  if (!tightBudget) return limits

  return {
    therapist: Math.min(limits.therapist, 1),
    external: Math.min(limits.external, attempt === 1 ? 2 : 1),
    warnings: Math.min(limits.warnings, 1),
    critical: Math.min(limits.critical, 1),
    aligned: Math.min(limits.aligned, 1),
    evidencePrimary: Math.min(limits.evidencePrimary, attempt === 1 ? 2 : 1),
    evidenceSupporting: Math.min(limits.evidenceSupporting, 1),
    restraints: Math.min(limits.restraints, 2),
    cautions: Math.min(limits.cautions, 1),
    rag: {
      general: 0,
      domain: Math.min(limits.rag.domain, 1),
      pattern: Math.min(limits.rag.pattern, 1),
      anamnesis: Math.min(limits.rag.anamnesis, attempt === 1 ? 1 : 0),
      summary: Math.min(limits.rag.summary, 1),
    },
  }
}

function getAttemptLimitsBase(analysis: RewriteAnalysis, attempt: 1 | 2 | 3) {
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

function getAttemptLimits(analysis: RewriteAnalysis, attempt: 1 | 2 | 3, tightBudget: boolean) {
  return applyBudgetTightening(getAttemptLimitsBase(analysis, attempt), attempt, tightBudget)
}

function buildAttemptPlan(
  analysis: RewriteAnalysis,
  baseRagContext: SelectedProRagContext,
  attempt: 1 | 2 | 3,
  tightBudget: boolean,
  baseReasoningEffort?: ReasoningEffort,
  baseVerbosity?: VerbosityLevel,
  baseMaxOutputTokens = 3200
): AttemptPlan {
  const limits = getAttemptLimits(analysis, attempt, tightBudget)
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
    compactMode: attempt === 1 ? "standard" : "lean",
  })

  const broadCase = analysis.qualityFocusMode === "widespread"
  const pairedCase = analysis.qualityFocusMode === "paired"
  const attemptTokenCap = tightBudget
    ? attempt === 1
      ? praxisCase
        ? 2800
        : balancedCase
        ? 2400
        : broadCase
        ? 2800
        : pairedCase
        ? 2600
        : 2500
      : balancedCase
      ? 2000
      : 2200
    : attempt === 3
    ? balancedCase
      ? 1400
      : 1800
    : attempt === 1
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
      tightBudget && attempt === 2
        ? 18000
        : attempt === 3
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
  const budgetUsd = normalizeBudgetUsd(process.env.SELF_META_REPORT_BUDGET_USD)
  const tightBudget = budgetUsd <= 0.05
  const reasoningEffort = normalizeReasoningEffort(process.env.OPENAI_REPORT_REASONING_EFFORT)
  const verbosity = normalizeVerbosity(process.env.OPENAI_REPORT_VERBOSITY)
  const maxOutputTokens = normalizeMaxOutputTokens(process.env.OPENAI_REPORT_MAX_OUTPUT_TOKENS, tightBudget)
  const maxAttempts = normalizeMaxAttempts(process.env.OPENAI_REPORT_MAX_ATTEMPTS)
  const attemptPool: AttemptPlan[] = [
    buildAttemptPlan(analysis, baseRagContext, 1, tightBudget, reasoningEffort, verbosity, maxOutputTokens),
    buildAttemptPlan(analysis, baseRagContext, 2, tightBudget, reasoningEffort, verbosity, maxOutputTokens),
    buildAttemptPlan(analysis, baseRagContext, 3, tightBudget, reasoningEffort, verbosity, maxOutputTokens),
  ]
  const attempts = attemptPool.slice(0, maxAttempts)

  console.log("[AI-REPORT] request_budget_per_case=", maxAttempts)
  console.log("[AI-REPORT] usd_budget_per_case=", budgetUsd.toFixed(2))
  console.log("[AI-REPORT] tight_budget_mode=", tightBudget ? "on" : "off")

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

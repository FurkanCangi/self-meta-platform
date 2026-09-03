import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { buildJuryReadyReport, type JuryReportResult } from "../src/lib/dna/reportJury"
import type { ReportInput } from "../src/lib/dna/reportEngine"
import { applyFullBoldClinicalReportParagraphs } from "../src/lib/dna/reportText"

type BaselineRow = Readonly<{
  caseId: string
  category: string
  totals: readonly number[]
  totalScore: number
  overallClassification: string
  primaryPriority: string | null
  profileBreadth: string
  confidence: string
  input: ReportInput
  finalReport: string
}>

type ManifestRow = Readonly<{ caseId: string; ageMonths: number; inputSha256: string }>

const BASELINE_ROOT = process.env.REPORT_MEGA100_BASELINE_ROOT
  || "/Users/furkancangi/Desktop/Self Metacognition Institute/Projects/Self Meta AI/bitti/python/selfmeta-web/deliverables/DNA_REPORT_MEGA100_HARDENING_FINAL_20260902T130100Z"
const OUTPUT_ROOT = process.env.REPORT_MEGA100_REPLAY_OUTPUT_ROOT || path.join(process.cwd(), "deliverables")

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`
  if (value && typeof value === "object") return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`
  return JSON.stringify(value)
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function count(text: string, pattern: RegExp): number {
  return Array.from(text.matchAll(pattern)).length
}

function visibleDecision(result: JuryReportResult) {
  return {
    overallClassification: result.overallClassification,
    primaryPriority: result.priorityProfile.primary_priority,
    profileBreadth: result.priorityProfile.profile_breadth,
    confidence: result.confidence.category,
  }
}

function baselineDecision(row: BaselineRow) {
  return {
    overallClassification: row.overallClassification,
    primaryPriority: row.primaryPriority,
    profileBreadth: row.profileBreadth,
    confidence: row.confidence,
  }
}

function languageCounts(text: string) {
  return {
    rawNoisy: count(text, /(?:olmuyo|bilmio|yapcag|hazirlarken|ucuruyor|\?{2,})/giu),
    fragment: count(text, /Günlük rutine daha düzenli katılım\./gu),
    awkwardSingleDomain: count(text, /Beklenen aralığın dışında kalan tek alan/gu),
    sourceBoilerplate: count(text, /Bu kaynaklar farklı görev ve koşulları değerlendirdiği için|Her bulgu yalnız kendi kapsamını açıklamaktadır/gu),
    genericAlternative: count(text, /Mevcut vaka kanıtı/gu),
    genericComparison: count(text, /alanlardaki güçlüğün profil içindeki dağılımını göstermektedir/gu),
    internalJargon: count(text, /(?:formülasyon odağı|klinik eksen|ayrışma kümesi|bağımsız bilgi kanalı|işlevsel eksende belirginleşmektedir)/giu),
  }
}

function productSurfaceReport(result: JuryReportResult): string {
  const emphasized = result.lockedLanguagePlan.sections
    .flatMap((section) => section.paragraphs)
    .filter((paragraph) => paragraph.emphasis === "full_bold")
    .map((paragraph) => paragraph.text)
  return applyFullBoldClinicalReportParagraphs(result.finalReport, emphasized)
}

async function main() {
  const baselineRows = fs.readFileSync(path.join(BASELINE_ROOT, "SEALED_CASES_AND_RESULTS.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line) as BaselineRow)
  const manifest = JSON.parse(fs.readFileSync(path.join(BASELINE_ROOT, "CASE_MANIFEST.json"), "utf8")) as ManifestRow[]
  assert.equal(baselineRows.length, 100)
  assert.equal(manifest.length, 100)
  const manifestById = new Map(manifest.map((row) => [row.caseId, row]))
  const inputHashMismatches = baselineRows.filter((row) => sha256(stable({ totals: row.totals, anamnesis: row.input.anamnez })) !== manifestById.get(row.caseId)?.inputSha256)
  assert.equal(inputHashMismatches.length, 0, "MEGA100 input hashes must remain identical")

  let providerCalls = 0
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => {
    providerCalls += 1
    throw new Error("PROVIDER_CALL_FORBIDDEN_IN_MEGA100_REPLAY")
  }) as typeof fetch
  const rows: Array<{ baseline: BaselineRow; result: JuryReportResult }> = []
  try {
    for (const [index, baseline] of baselineRows.entries()) {
      rows.push({ baseline, result: await buildJuryReadyReport(baseline.input) })
      if ((index + 1) % 10 === 0) console.log(`MEGA100 replay ${index + 1}/100`)
    }
  } finally {
    globalThis.fetch = originalFetch
  }

  const decisionDrift = rows.filter(({ baseline, result }) => stable(baselineDecision(baseline)) !== stable(visibleDecision(result)))
  const scoreDrift = rows.filter(({ baseline, result }) => baseline.totalScore !== result.base.v1.totalScore || baseline.overallClassification !== result.overallClassification)
  const validationFailures = rows.filter(({ result }) => !result.validation.pass || result.reportStatus !== "ready_for_therapist_review")
  const sumMetric = (key: keyof JuryReportResult["validation"]) => rows.reduce((sum, row) => sum + Number(row.result.validation[key] || 0), 0)
  const sumLanguage = (side: "before" | "after", key: keyof ReturnType<typeof languageCounts>) => rows.reduce((sum, row) => sum + languageCounts(side === "before" ? row.baseline.finalReport : row.result.finalReport)[key], 0)
  const beforeAfter = Object.fromEntries((Object.keys(languageCounts("")) as Array<keyof ReturnType<typeof languageCounts>>).map((key) => [key, { before: sumLanguage("before", key), after: sumLanguage("after", key) }]))
  const summary = {
    schemaVersion: "dna-report-mega100-human-replay-v1",
    generatedAt: new Date().toISOString(),
    cases: rows.length,
    exactInputHashes: manifest.length - inputHashMismatches.length,
    providerCalls,
    validationPass: rows.filter((row) => row.result.validation.pass).length,
    readyForReview: rows.filter((row) => row.result.reportStatus === "ready_for_therapist_review").length,
    decisionDrift: decisionDrift.length,
    scoreDrift: scoreDrift.length,
    unsupportedAddition: sumMetric("unsupportedVisibleClauseCount") + sumMetric("unsupportedVisibleCaseClaimCount"),
    sourceViolation: sumMetric("wrongSourceAttributionCount") + sumMetric("wrongDomainAttributionCount") + sumMetric("unsupportedSourceCount"),
    meaningOrCertaintyDrift: sumMetric("visibleFactualContradictionCount") + sumMetric("confidenceCertaintyMismatchCount"),
    grammarFragments: sumMetric("grammarFragmentCount"),
    rawNoisyAnamnesisLeaks: sumMetric("rawNoisyAnamnesisLeakCount"),
    semanticDecisionRepetitions: sumMetric("semanticDecisionRepetitionCount"),
    profileLanguageContradictions: sumMetric("profileLanguageContradictionCount") + sumMetric("closePriorityOverstatementCount"),
    naturalEvidenceRelationErrors: sumMetric("naturalEvidenceRelationErrorCount"),
    systemLikeProse: sumMetric("systemLikeProseCount"),
    awkwardGenericPhrases: sumMetric("awkwardGenericPhraseCount"),
    terminologyDrift: sumMetric("terminologyDriftCount"),
    boldDecisionContractPass: rows.filter((row) => row.result.validation.boldDecisionContentPass).length,
    productSurfaceBoldPass: rows.filter((row) => count(productSurfaceReport(row.result), /^\*\*[^\n]+\*\*$/gmu) === 3).length,
    beforeAfter,
    failures: validationFailures.map((row) => ({
      caseId: row.baseline.caseId,
      failureCodes: row.result.validation.failureCodes,
      criticStatus: row.result.critic.status,
      criticFindings: row.result.critic.findings,
    })),
  }

  const runStamp = new Date().toISOString().replace(/[-:]/gu, "").replace(/\.\d{3}Z$/u, "Z")
  const outputDir = path.join(OUTPUT_ROOT, `DNA_REPORT_MEGA100_HUMAN_REPLAY_${runStamp}`)
  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(path.join(outputDir, "BLIND_100_REPORTS.md"), rows.map((row, index) => `# Rapor ${index + 1}\n\n${row.result.finalReport}`).join("\n\n---\n\n"), "utf8")
  fs.writeFileSync(path.join(outputDir, "PRODUCT_SURFACE_100_REPORTS.md"), rows.map((row, index) => `# Rapor ${index + 1}\n\n${productSurfaceReport(row.result)}`).join("\n\n---\n\n"), "utf8")
  fs.writeFileSync(path.join(outputDir, "SEALED_CASES_AND_RESULTS.jsonl"), `${rows.map(({ baseline, result }) => JSON.stringify({
    caseId: baseline.caseId,
    category: baseline.category,
    input: baseline.input,
    inputSha256: manifestById.get(baseline.caseId)?.inputSha256,
    previousDecision: baselineDecision(baseline),
    currentDecision: visibleDecision(result),
    validation: result.validation,
    critic: result.critic,
    reportStatus: result.reportStatus,
    finalReportSha256: sha256(result.finalReport),
  })).join("\n")}\n`, "utf8")
  fs.writeFileSync(path.join(outputDir, "OBJECTIVE_SUMMARY.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8")
  fs.writeFileSync(path.join(outputDir, "BEFORE_AFTER_COMPARISON.md"), `# MEGA100 Before/After\n\n- Exact input hashes: ${summary.exactInputHashes}/100\n- Validation pass: ${summary.validationPass}/100\n- Ready for review: ${summary.readyForReview}/100\n- Decision drift: ${summary.decisionDrift}\n- Score drift: ${summary.scoreDrift}\n- Unsupported additions: ${summary.unsupportedAddition}\n- Source violations: ${summary.sourceViolation}\n- Meaning/certainty drift: ${summary.meaningOrCertaintyDrift}\n- Bold decision contract: ${summary.boldDecisionContractPass}/100\n\n## Language counts\n\n${Object.entries(beforeAfter).map(([key, value]) => `- ${key}: ${value.before} -> ${value.after}`).join("\n")}\n`, "utf8")
  console.log(JSON.stringify({ outputDir, summary }, null, 2))
  assert.equal(providerCalls, 0)
  assert.equal(summary.exactInputHashes, 100)
  assert.equal(summary.validationPass, 100)
  assert.equal(summary.readyForReview, 100)
  assert.equal(summary.decisionDrift, 0)
  assert.equal(summary.scoreDrift, 0)
  assert.equal(summary.unsupportedAddition, 0)
  assert.equal(summary.sourceViolation, 0)
  assert.equal(summary.meaningOrCertaintyDrift, 0)
  assert.equal(summary.grammarFragments, 0)
  assert.equal(summary.rawNoisyAnamnesisLeaks, 0)
  assert.equal(summary.semanticDecisionRepetitions, 0)
  assert.equal(summary.profileLanguageContradictions, 0)
  assert.equal(summary.naturalEvidenceRelationErrors, 0)
  assert.equal(summary.systemLikeProse, 0)
  assert.equal(summary.awkwardGenericPhrases, 0)
  assert.equal(summary.terminologyDrift, 0)
  assert.equal(summary.boldDecisionContractPass, 100)
  assert.equal(summary.productSurfaceBoldPass, 100)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

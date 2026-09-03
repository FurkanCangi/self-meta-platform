import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { calculateAssessment } from "../src/lib/assessment/assessmentEngine"
import { analyzeReportLanguageQuality } from "../src/lib/dna/reportLanguageQuality"
import { buildJuryReadyReport, type JuryReportResult } from "../src/lib/dna/reportJury"
import { applyFullBoldClinicalReportParagraphs } from "../src/lib/dna/reportText"
import { stableHash } from "../src/lib/dna/reportV2/evidenceEngine"
import type { ReportInput } from "../src/lib/dna/reportEngine"
import { JURY_CHALLENGE_CASES, answersForJuryTotals } from "./fixtures/dna-report-jury-cases"

type ProfessorFixture = Readonly<{
  clientCode: string
  ageMonths: number
  anamnez: Record<string, string>
  scores: Readonly<Record<"physiological" | "sensory" | "emotional" | "cognitive" | "executive" | "interoception", number>>
}>

const PROFESSOR_FILES = Object.freeze([
  "dna-prof-01-selective-sensory-context.json",
  "dna-prof-02-cross-source-conflict.json",
  "dna-prof-03-severe-sparse-evidence.json",
  "dna-prof-04-executive-context-contrast.json",
  "dna-prof-05-preserved-scale-external-concern.json",
])

const EXPECTED_CORE_DECISION_HASHES = Object.freeze<Record<string, string>>({
  // Hashes cover decision-bearing fields only; user-facing display labels are
  // intentionally excluded so language-only hardening cannot mimic drift.
  "PROF-01-SENSORY": "e8d9bb3287525d3e",
  "PROF-02-CONFLICT": "581344dbf73d46d7",
  "PROF-03-SPARSE": "a2caf5df4e57046f",
  "PROF-04-EXEC-CONTEXT": "976c7a5766e18cff",
  "PROF-05-DISCREPANCY": "0fdce86047fcc1f0",
})

const RAW_FIELD_LABEL = /(?:parent_concerns_goals|parent concerns goals|strengths?|diagnosis|referral_reason|reason for referral)\s*:/giu
const MECHANICAL_PROSE = /(?:bu bilgi desteklemediği bir klinik alana bağlanmamıştır|gözlem metninin desteklemediği bir klinik alana bağlanmamıştır|vaka içindeki görev ve bağlam bilgisini iki ayrı kaynaktan göstermektedir|puan dağılımına ek işlevsel bağlam sağlamaktadır)/giu
const BROAD_ASCII_TURKISH = /\b(?:degis\w*|sinif\w*|birles\w*|dus\w*|odev\w*|ortaminda\w*|aktarilm\w*|dolayli\w*|kacin\w*|gorev\w*|gucluk\w*|yurutucu\w*|islev\w*|gorsel\w*|hatirlat\w*|cok\w*|adimli\w*|korunmus\w*|baglam\w*|yasam\w*|gunluk\w*|duydugu\w*|yapilandirilmis\w*|etkilesim\w*|bicim\w*|toparliyor\w*|frustrasyon\w*)\b/giu

function count(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0
}

function exactRepeatedSentenceCount(text: string): number {
  const seen = new Set<string>()
  let repeated = 0
  const sentences = text
    .replace(/^\d+\.\s+.+$/gmu, "")
    .split(/(?<=[.!?])\s+|\n+/u)
    .map((sentence) => sentence.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü]+/gu, " ").trim())
    .filter((sentence) => sentence.length >= 20)
  for (const sentence of sentences) {
    if (seen.has(sentence)) repeated += 1
    else seen.add(sentence)
  }
  return repeated
}

function coreDecisionSnapshot(result: JuryReportResult) {
  return Object.freeze({
    overallClassification: result.overallClassification,
    primaryFormulationId: result.lockedLanguagePlan.primaryFormulationId,
    priorityProfile: Object.freeze({
      profileBreadth: result.priorityProfile.profile_breadth,
      primaryPriority: result.priorityProfile.primary_priority,
      secondaryPriorities: result.priorityProfile.secondary_priorities,
      affectedDomains: result.priorityProfile.affected_domains,
      preservedDomains: result.priorityProfile.preserved_domains,
    }),
    confidenceCategory: result.confidence.category,
    baseDecision: Object.freeze({
      overallClassification: result.base.decisionPlan.overallClassification,
      primary: result.base.decisionPlan.primaryFormulation?.id ?? null,
      secondary: Object.freeze(result.base.decisionPlan.secondaryFormulations.map((entry) => entry.id)),
      alternative: Object.freeze(result.base.decisionPlan.alternativeFormulations.map((entry) => entry.id)),
    }),
  })
}

function productReport(result: JuryReportResult): string {
  const emphasized = result.lockedLanguagePlan.sections
    .flatMap((section) => section.paragraphs)
    .filter((paragraph) => paragraph.emphasis === "full_bold")
    .map((paragraph) => paragraph.text)
  return applyFullBoldClinicalReportParagraphs(result.finalReport, emphasized)
}

function professorInput(filename: string): Readonly<{ id: string; input: ReportInput }> {
  const fixture = JSON.parse(fs.readFileSync(path.join(process.cwd(), "scripts", "fixtures", filename), "utf8")) as ProfessorFixture
  const totals = [
    fixture.scores.physiological,
    fixture.scores.sensory,
    fixture.scores.emotional,
    fixture.scores.cognitive,
    fixture.scores.executive,
    fixture.scores.interoception,
  ] as const
  return Object.freeze({
    id: fixture.clientCode,
    input: Object.freeze({
      clientCode: fixture.clientCode,
      ageMonths: fixture.ageMonths,
      anamnez: fixture.anamnez,
      scores: fixture.scores,
      answers: [...answersForJuryTotals(totals)],
    }),
  })
}

function adversarialInput(testCase: typeof JURY_CHALLENGE_CASES[number]): Readonly<{ id: string; input: ReportInput }> {
  const answers = answersForJuryTotals(testCase.totals)
  const scores = calculateAssessment(answers)
  return Object.freeze({
    id: testCase.id,
    input: Object.freeze({
      clientCode: testCase.id,
      ageMonths: testCase.ageMonths,
      anamnez: testCase.anamnez,
      answers: [...answers],
      scores: Object.freeze({
        fizyolojik: scores.fizyolojik,
        duyusal: scores.duyusal,
        duygusal: scores.duygusal,
        bilissel: scores.bilissel,
        yurutucu: scores.yurutucu,
        intero: scores.intero,
        toplam: scores.toplam,
      }),
    }),
  })
}

function assertSurface(id: string, result: JuryReportResult) {
  const report = productReport(result)
  const asciiIssue = analyzeReportLanguageQuality(result.finalReport).issues.some((issue) => issue.code === "ascii_turkish_leak")
  assert.equal(result.languageProvider, "deterministic", `${id}: provider deterministic olmalı`)
  assert.equal(result.languageFallbackUsed, false, `${id}: fallback olmamalı`)
  assert.equal(result.validation.pass, true, `${id}: ${result.validation.failureCodes.join(",")}`)
  assert.equal(result.validation.unsupportedVisibleClauseCount, 0, `${id}: unsupported görünür ek`)
  assert.equal(result.validation.visibleFactualContradictionCount, 0, `${id}: görünür çelişki`)
  assert.equal(result.validation.unsupportedCausalityCount, 0, `${id}: unsupported causality`)
  assert.equal(result.templateSemanticLeakage.finding_count, 0, `${id}: semantic leakage`)
  assert.equal(result.lockedLanguagePlan.sections.flatMap((section) => section.paragraphs).filter((paragraph) => paragraph.emphasis === "full_bold").length, 3, `${id}: locked bold`)
  assert.equal(count(report, /^\*\*[^\n]+\*\*$/gmu), 3, `${id}: ürün bold yüzeyi`)
  assert.equal(count(result.finalReport, RAW_FIELD_LABEL), 0, `${id}: ham İngilizce alan etiketi`)
  assert.equal(count(result.finalReport, MECHANICAL_PROSE), 0, `${id}: mekanik sistem cümlesi`)
  assert.equal(exactRepeatedSentenceCount(result.finalReport), 0, `${id}: tekrarlanan final cümlesi`)
  assert.equal(asciiIssue, false, `${id}: ASCII Türkçe kalite denetimi`)
  assert.equal(count(result.finalReport, BROAD_ASCII_TURKISH), 0, `${id}: geniş ASCII Türkçe denetimi`)
}

async function main() {
  let providerCallCount = 0
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => {
    providerCallCount += 1
    throw new Error("PROVIDER_CALL_FORBIDDEN_IN_ZERO_COST_REPORT_TEST")
  }) as typeof fetch

  try {
    const professorCases = PROFESSOR_FILES.map(professorInput)
    const adversarialCases = JURY_CHALLENGE_CASES.map(adversarialInput)
    const allCases = [...professorCases, ...adversarialCases]
    const firstResults = new Map<string, JuryReportResult>()

    for (const testCase of allCases) {
      const result = await buildJuryReadyReport(testCase.input)
      assertSurface(testCase.id, result)
      firstResults.set(testCase.id, result)
    }

    for (const testCase of allCases) {
      const first = firstResults.get(testCase.id)!
      const replay = await buildJuryReadyReport(testCase.input)
      assert.equal(stableHash(replay.finalReport), stableHash(first.finalReport), `${testCase.id}: determinism drift`)
      assert.equal(stableHash(coreDecisionSnapshot(replay)), stableHash(coreDecisionSnapshot(first)), `${testCase.id}: replay decision drift`)
    }

    const currentCoreDecisionHashes = Object.fromEntries(professorCases.map((testCase) => [testCase.id, stableHash(coreDecisionSnapshot(firstResults.get(testCase.id)!)).slice(0, 16)]))
    console.log(JSON.stringify({ currentCoreDecisionHashes }, null, 2))
    for (const testCase of professorCases) {
      const result = firstResults.get(testCase.id)!
      assert.equal(stableHash(coreDecisionSnapshot(result)).slice(0, 16), EXPECTED_CORE_DECISION_HASHES[testCase.id], `${testCase.id}: frozen core decision drift`)
    }

    assert.equal(providerCallCount, 0, "Rapor testinde provider çağrısı yapıldı")
    console.log(JSON.stringify({
      providerCalls: providerCallCount,
      llmCostUsd: 0,
      professorCases: professorCases.length,
      naturalAdversarialCases: adversarialCases.length,
      deterministicReplays: allCases.length,
      decisionDrift: 0,
      unsupportedAddition: 0,
      rawFieldLabels: 0,
      mechanicalProse: 0,
      repeatedSentences: 0,
      asciiTurkishResidue: 0,
      semanticLeakage: 0,
      boldParagraphs: professorCases.reduce((sum, entry) => sum + firstResults.get(entry.id)!.validation.fullBoldParagraphCount, 0),
      validation: `${allCases.length}/${allCases.length}`,
      pass: true,
    }, null, 2))
  } finally {
    globalThis.fetch = originalFetch
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

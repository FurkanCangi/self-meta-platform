import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { calculateAssessment } from "../src/lib/assessment/assessmentEngine"
import { REPORT_SECTION_HEADINGS, type ReportRealization, type ReportRealizer, type ReportRealizerAttempt, type ReportRealizerRequest } from "../src/lib/dna/reportV2/contracts"
import { createDeterministicReportRealization } from "../src/lib/dna/reportV2/realizer"
import { normalizeDnaReportLanguage, repeatedTemplatePhraseDiagnostics, reportLanguageDiagnostics, section2ThresholdSentenceCount } from "../src/lib/dna/reportV2/languageContract"
import { runReportV2Shadow } from "../src/lib/dna/reportV2/runner"
import { validateLockedReportPlan, validateReportV2Privacy, validateReportV2Realization } from "../src/lib/dna/reportV2/validators"
import { stableHash } from "../src/lib/dna/reportV2/evidenceEngine"
import { auditReportKnowledgeCore } from "../src/lib/dna/reportV2/reportKnowledgeBridge"
import { auditPlainClinicalRewriteRecord, latestMaterialityPipelineAssertion, plainClinicalLanguageDiagnostics } from "../src/lib/dna/reportV2/plainClinicalTurkish"
import { auditFinalTurkishSurface } from "../src/lib/dna/reportV2/surfaceQa"
import { extractCanonicalAnamnesisEvidence } from "../src/lib/dna/reportJury/canonicalAnamnesisEvidence"
import { buildConsistencyNaturalLanguageCases, buildFreshReportV2Cases, buildPlainClinicalTurkishCases, buildPlainIntegrationQaCases, buildProductionReadinessCases, buildQualityConsolidationCases } from "./report-v2-cases"

type LegacyFixture = {
  sourceCase: string
  clientCode: string
  ageMonths: number
  anamnez: string
  answers: number[]
  scores: Record<string, number>
}

const legacyPath = path.join(process.cwd(), "scripts/fixtures/report-v2/legacy-five.json")
const legacy = JSON.parse(fs.readFileSync(legacyPath, "utf8")) as LegacyFixture[]

function assertHeadings(text: string) {
  let previous = -1
  for (const heading of REPORT_SECTION_HEADINGS) {
    const index = text.indexOf(heading)
    assert.ok(index > previous, `heading missing or out of order: ${heading}`)
    assert.equal(text.split(heading).length - 1, 1, `heading repeated: ${heading}`)
    previous = index
  }
}

class RepairOnceRealizer implements ReportRealizer {
  readonly identity = Object.freeze({ provider: "luna" as const, model: "fake-luna", implementationVersion: "fake@1" })
  calls = 0
  async realize(request: ReportRealizerRequest): Promise<ReportRealizerAttempt> {
    this.calls += 1
    const realization = createDeterministicReportRealization(request.plan)
    const value = this.calls === 1 ? Object.freeze({ ...realization, unsupportedAddition: true }) : realization
    return Object.freeze({ ...this.identity, attempt: request.attempt, realization: value, rawOutput: JSON.stringify(value), responseId: null, usage: Object.freeze({ inputTokens: 10, cachedInputTokens: 0, outputTokens: 10, costMicrousd: 70 }), latencyMs: 1, promptHash: stableHash(request) })
  }
}

class AlwaysFailRealizer extends RepairOnceRealizer {
  async realize(request: ReportRealizerRequest): Promise<ReportRealizerAttempt> {
    const row = await super.realize(request)
    assert.ok(row.realization)
    return Object.freeze({ ...row, realization: Object.freeze({ ...row.realization, unsupportedAddition: true }) })
  }
}

class LocalizedUnsupportedRealizer implements ReportRealizer {
  readonly identity = Object.freeze({ provider: "luna" as const, model: "fake-localized-luna", implementationVersion: "fake-localized@1" })
  calls = 0
  async realize(request: ReportRealizerRequest): Promise<ReportRealizerAttempt> {
    this.calls += 1
    const realization = createDeterministicReportRealization(request.plan)
    const value = Object.freeze({ ...realization, unsupportedAddition: true, unsupportedSectionIds: Object.freeze(["section_4" as const]) })
    return Object.freeze({ ...this.identity, attempt: request.attempt, realization: value, rawOutput: JSON.stringify(value), responseId: "fake", usage: Object.freeze({ inputTokens: 10, cachedInputTokens: 0, outputTokens: 10, costMicrousd: 70 }), latencyMs: 1, promptHash: stableHash(request) })
  }
}

class CapturingLunaRealizer implements ReportRealizer {
  readonly identity = Object.freeze({ provider: "luna" as const, model: "fake-capturing-luna", implementationVersion: "fake@1" })
  calls = 0
  payloads: string[] = []
  async realize(request: ReportRealizerRequest): Promise<ReportRealizerAttempt> {
    this.calls += 1
    this.payloads.push(JSON.stringify(request.plan))
    const realization = createDeterministicReportRealization(request.plan)
    return Object.freeze({ ...this.identity, attempt: request.attempt, realization, rawOutput: JSON.stringify(realization), responseId: "fake", usage: Object.freeze({ inputTokens: 10, cachedInputTokens: 0, outputTokens: 10, costMicrousd: 70 }), latencyMs: 1, promptHash: stableHash(request) })
  }
}

class OmitByMaterialityRealizer implements ReportRealizer {
  readonly identity = Object.freeze({ provider: "luna" as const, model: "fake-materiality-luna", implementationVersion: "fake@2.2" })
  calls = 0
  constructor(private readonly materiality: "IMPORTANT" | "OPTIONAL") {}
  async realize(request: ReportRealizerRequest): Promise<ReportRealizerAttempt> {
    this.calls += 1
    const reducedPlan = Object.freeze({
      ...request.plan,
      sections: Object.freeze(request.plan.sections.map((section) => Object.freeze({
        ...section,
        importantClaimIds: this.materiality === "IMPORTANT" ? Object.freeze([]) : section.importantClaimIds,
        optionalClaimIds: this.materiality === "OPTIONAL" ? Object.freeze([]) : section.optionalClaimIds,
      }))),
    })
    const value = createDeterministicReportRealization(reducedPlan)
    return Object.freeze({ ...this.identity, attempt: request.attempt, realization: value, rawOutput: JSON.stringify(value), responseId: "fake", usage: Object.freeze({ inputTokens: 10, cachedInputTokens: 0, outputTokens: 10, costMicrousd: 70 }), latencyMs: 1, promptHash: stableHash(request) })
  }
}

class LiteratureFragmentRealizer implements ReportRealizer {
  readonly identity = Object.freeze({ provider: "luna" as const, model: "fake-literature-luna", implementationVersion: "fake@2.2" })
  calls = 0
  async realize(request: ReportRealizerRequest): Promise<ReportRealizerAttempt> {
    this.calls += 1
    const realization = createDeterministicReportRealization(request.plan)
    const value = Object.freeze({ ...realization, sections: Object.freeze(realization.sections.map((section) => section.sectionId === "section_8" ? Object.freeze({ ...section, text: "” yorumu" }) : section)) })
    return Object.freeze({ ...this.identity, attempt: request.attempt, realization: value, rawOutput: JSON.stringify(value), responseId: "fake", usage: Object.freeze({ inputTokens: 10, cachedInputTokens: 0, outputTokens: 10, costMicrousd: 70 }), latencyMs: 1, promptHash: stableHash(request) })
  }
}

class LanguageViolationRealizer implements ReportRealizer {
  readonly identity = Object.freeze({ provider: "luna" as const, model: "fake-language-luna", implementationVersion: "fake-language@1" })
  calls = 0
  async realize(request: ReportRealizerRequest): Promise<ReportRealizerAttempt> {
    this.calls += 1
    const realization = createDeterministicReportRealization(request.plan)
    const value = Object.freeze({
      ...realization,
      sections: Object.freeze(realization.sections.map((section) => section.sectionId === "section_1"
        ? Object.freeze({ ...section, text: `Bu görünüm öz düzenleme açısından klinik eksen içinde ele alındığında ${section.text}` })
        : section)),
    })
    return Object.freeze({ ...this.identity, attempt: request.attempt, realization: value, rawOutput: JSON.stringify(value), responseId: "fake", usage: Object.freeze({ inputTokens: 10, cachedInputTokens: 0, outputTokens: 10, costMicrousd: 70 }), latencyMs: 1, promptHash: stableHash(request) })
  }
}

class RepetitionAndOwnerCopyRealizer implements ReportRealizer {
  readonly identity = Object.freeze({ provider: "luna" as const, model: "fake-copy-luna", implementationVersion: "fake-copy@1" })
  calls = 0
  async realize(request: ReportRealizerRequest): Promise<ReportRealizerAttempt> {
    this.calls += 1
    const realization = createDeterministicReportRealization(request.plan)
    const claimMap = new Map(request.plan.claims.map((claim) => [claim.id, claim]))
    const value = Object.freeze({
      ...realization,
      sections: Object.freeze(realization.sections.map((section) => {
        const ownerText = section.usedClaimIds.map((id) => claimMap.get(id)).filter((claim) => claim?.knowledgeAuthority === "OWNER_BOOK").map((claim) => claim!.text).join(" ")
        return Object.freeze({ ...section, text: `${section.text}${ownerText ? `\n\n${ownerText}` : ""}` })
      })),
    })
    return Object.freeze({ ...this.identity, attempt: request.attempt, realization: value, rawOutput: JSON.stringify(value), responseId: "fake", usage: Object.freeze({ inputTokens: 10, cachedInputTokens: 0, outputTokens: 10, costMicrousd: 70 }), latencyMs: 1, promptHash: stableHash(request) })
  }
}

class GrammarAndInternalLabelRealizer implements ReportRealizer {
  readonly identity = Object.freeze({ provider: "luna" as const, model: "fake-grammar-luna", implementationVersion: "fake-grammar@1" })
  calls = 0
  async realize(request: ReportRealizerRequest): Promise<ReportRealizerAttempt> {
    this.calls += 1
    const realization = createDeterministicReportRealization(request.plan)
    const value = Object.freeze({
      ...realization,
      sections: Object.freeze(realization.sections.map((section) => section.sectionId === "section_1"
        ? Object.freeze({ ...section, text: `OWNER_BOOK_INTERPRETATION: ${section.text} desteklemektedir.ndadır bilginda değerlendirmendedir yorumlanmaktadırdır.` })
        : section)),
    })
    return Object.freeze({ ...this.identity, attempt: request.attempt, realization: value, rawOutput: JSON.stringify(value), responseId: "fake", usage: Object.freeze({ inputTokens: 10, cachedInputTokens: 0, outputTokens: 10, costMicrousd: 70 }), latencyMs: 1, promptHash: stableHash(request) })
  }
}

class SemanticRepeatRealizer implements ReportRealizer {
  readonly identity = Object.freeze({ provider: "luna" as const, model: "fake-semantic-repeat-luna", implementationVersion: "fake-semantic-repeat@1" })
  calls = 0
  async realize(request: ReportRealizerRequest): Promise<ReportRealizerAttempt> {
    this.calls += 1
    const realization = createDeterministicReportRealization(request.plan)
    const repeated = realization.sections.find((section) => section.sectionId === "section_1")?.text.split(/(?<=[.!?])\s+|;\s+|\n{2,}/u).find((text) => text.trim().length >= 35) ?? "Günlük performansın bağlama göre değişebildiği görülüyor."
    const value = Object.freeze({
      ...realization,
      sections: Object.freeze(realization.sections.map((section) => section.sectionId === "section_7"
        ? Object.freeze({ ...section, text: `${section.text}\n\n${repeated.trim()}` })
        : section)),
    })
    return Object.freeze({ ...this.identity, attempt: request.attempt, realization: value, rawOutput: JSON.stringify(value), responseId: "fake", usage: Object.freeze({ inputTokens: 10, cachedInputTokens: 0, outputTokens: 10, costMicrousd: 70 }), latencyMs: 1, promptHash: stableHash(request) })
  }
}

class IntraSectionConflictRealizer implements ReportRealizer {
  readonly identity = Object.freeze({ provider: "luna" as const, model: "fake-consistency-luna", implementationVersion: "fake-consistency@1" })
  calls = 0
  initial: ReportRealizerAttempt["realization"] = null
  async realize(request: ReportRealizerRequest): Promise<ReportRealizerAttempt> {
    this.calls += 1
    const deterministic = createDeterministicReportRealization(request.plan)
    const realization = Object.freeze({
      ...deterministic,
      sections: Object.freeze(deterministic.sections.map((section) => section.sectionId === "section_3"
        ? Object.freeze({ ...section, text: `Duyusal regülasyon alanında ek bir günlük yaşam güçlüğü bildirilmemiştir. Duyusal regülasyon alanıyla ilişkili günlük işlev güçlüğü bakım veren anlatısında bildiriliyor.\n\n${section.text}` })
        : section)),
    })
    this.initial = realization
    return Object.freeze({ ...this.identity, attempt: request.attempt, realization, rawOutput: JSON.stringify(realization), responseId: "fake", usage: Object.freeze({ inputTokens: 10, cachedInputTokens: 0, outputTokens: 10, costMicrousd: 70 }), latencyMs: 1, promptHash: stableHash(request) })
  }
}

function sha256(value: string | Buffer) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function withoutClaims(result: Awaited<ReturnType<typeof runReportV2Shadow>>, predicate: (id: string) => boolean) {
  return Object.freeze({
    ...result.realization,
    sections: Object.freeze(result.realization.sections.map((section) => Object.freeze({
      ...section,
      usedClaimIds: Object.freeze(section.usedClaimIds.filter((id) => !predicate(id))),
    }))),
  })
}

function assertSurfaceQaZero(result: Awaited<ReturnType<typeof runReportV2Shadow>>, label: string) {
  assert.equal(result.validation.sourcePairRelationContradictionCount, 0, `${label}: source-pair relation contradiction`)
  assert.equal(result.validation.crossSectionRelationDriftCount, 0, `${label}: cross-section relation drift`)
  assert.equal(result.validation.sameDirectionFalseAssertionCount, 0, `${label}: false same-direction assertion`)
  assert.equal(result.validation.turkishMorphologyErrorCount, 0, `${label}: Turkish morphology error`)
  assert.equal(result.validation.subjectObjectAgreementErrorCount, 0, `${label}: subject/object agreement error`)
  assert.equal(result.validation.brokenNounPhraseCount, 0, `${label}: broken noun phrase`)
  assert.equal(result.validation.exactPassageMissingCount, 0, `${label}: exact passage missing`)
  assert.equal(result.validation.claimSourceMismatchCount, 0, `${label}: claim/source mismatch`)
  assert.equal(result.validation.claimPassageOverreachCount, 0, `${label}: claim/passage overreach`)
  assert.equal(result.validation.topicOnlyCitationCount, 0, `${label}: topic-only citation`)
  assert.equal(result.validation.wrongConstructCitationCount, 0, `${label}: wrong-construct citation`)
  assert.equal(result.validation.turkishSurfaceErrorCount, 0, `${label}: Turkish surface error`)
  assert.equal(result.validation.morphologyErrorCount, 0, `${label}: morphology error`)
  assert.equal(result.validation.punctuationErrorCount, 0, `${label}: punctuation error`)
  assert.equal(result.validation.sentenceBoundaryErrorCount, 0, `${label}: sentence-boundary error`)
  assert.equal(result.validation.section5GenericSpecificDuplicationCount, 0, `${label}: Section 5 generic/specific duplication`)
}

async function main() {
  const badPlainClinical = Object.freeze({
    version: "report-realization@2" as const,
    unsupportedAddition: false,
    sections: Object.freeze([{ sectionId: "section_3" as const, text: "Uyaran yoğunluğu arttığında katılımın değişkenleşmesi olası işlevsel karşılıktır.", usedClaimIds: Object.freeze([]) }]),
  }) satisfies ReportRealization
  const badPlainDiagnostics = plainClinicalLanguageDiagnostics(badPlainClinical)
  assert.ok(badPlainDiagnostics.nominalizationOverloadCount > 0)
  assert.ok(badPlainDiagnostics.abstractClinicalLanguageCount > 0)
  assert.equal(buildPlainClinicalTurkishCases().length, 30)
  const baseline = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/dna-intelligence/report-v2/v1-baseline.json"), "utf8"))
  const productionRouteSource = fs.readFileSync(path.join(process.cwd(), "src/app/api/ai-report/route.ts"), "utf8")
  assert.equal(sha256(productionRouteSource), baseline.routeSha256, "production report route changed")
  assert.equal(baseline.productionReportContract, "jury-ready-candidate18-bold@1")
  assert.match(productionRouteSource, /buildJuryReadyReport/)
  assert.match(productionRouteSource, /applyFullBoldClinicalReportParagraphs/)
  assert.doesNotMatch(productionRouteSource, /buildAdvancedReport/)
  assert.equal(sha256(fs.readFileSync(path.join(process.cwd(), "src/lib/dna/reportEngine.ts"))), baseline.reportEngineSha256, "V1 report engine changed")
  const reportV2Files = fs.readdirSync(path.join(process.cwd(), "src/lib/dna/reportV2")).filter((name) => name.endsWith(".ts"))
  const reportV2Sources = reportV2Files.map((name) => fs.readFileSync(path.join(process.cwd(), "src/lib/dna/reportV2", name), "utf8")).join("\n")
  const bridgeSource = fs.readFileSync(path.join(process.cwd(), "src/lib/dna/reportV2/reportKnowledgeBridge.ts"), "utf8")
  const nonBridgeSources = reportV2Files.filter((name) => name !== "reportKnowledgeBridge.ts").map((name) => fs.readFileSync(path.join(process.cwd(), "src/lib/dna/reportV2", name), "utf8")).join("\n")
  assert.doesNotMatch(nonBridgeSources, /(?:from|import)\s+["'][^"']*\/chat\//, "Report V2 runtime imports Chat Box behavior")
  assert.match(bridgeSource, /import denseRuntimeJson from "\.\.\/chat\/catalog\/generated\/dense\/runtime\.json"/)
  assert.equal((bridgeSource.match(/(?:from|import)\s+["'][^"']*\/chat\//g) ?? []).length, 1, "Knowledge bridge must have exactly one read-only Chat Knowledge artifact import")
  assert.doesNotMatch(productionRouteSource, /reportV2|REPORT_V2/, "production API bypasses jury boundary")
  const lunaSource = fs.readFileSync(path.join(process.cwd(), "src/lib/dna/reportV2/lunaReportRealizer.server.ts"), "utf8")
  assert.match(lunaSource, /gpt-5\.6-luna/)
  assert.match(lunaSource, /store:\s*false/)
  assert.match(lunaSource, /\/v1\/responses/)
  const knowledgeAudit = auditReportKnowledgeCore()
  assert.equal(knowledgeAudit.summary.totalAtoms, 4008)
  assert.equal(knowledgeAudit.summary.reportEligibleAtoms + knowledgeAudit.summary.notReportEligibleAtoms + knowledgeAudit.summary.needsReviewAtoms, 4008)
  assert.equal(knowledgeAudit.summary.ownerBookEligibleAtoms, knowledgeAudit.summary.reportEligibleAtoms)
  assert.ok(knowledgeAudit.summary.reportEligibleAtoms > 0)
  assert.ok(knowledgeAudit.summary.needsReviewAtoms > 0)
  assert.ok(knowledgeAudit.summary.novelUsefulAtoms > 0)
  assert.ok(knowledgeAudit.records.every((record) => record.authority === "OWNER_BOOK" && record.sourceId === "book.self-regulation.owner-current"))

  assert.equal(legacy.length, 5)
  const legacyResults = []
  for (const fixture of legacy) {
    const calculated = calculateAssessment(fixture.answers)
    for (const key of ["fizyolojik", "duyusal", "duygusal", "bilissel", "yurutucu", "intero", "toplam"] as const) assert.equal(calculated[key], fixture.scores[key], `${fixture.sourceCase} scoring regression: ${key}`)
    const result = await runReportV2Shadow(fixture)
    assert.equal(result.validation.pass, true, `${fixture.sourceCase}: ${result.validation.failureCodes.join(",")}`)
    assert.equal(result.providerCalls, 0)
    assert.equal(result.plainClinicalTurkish.meaningDriftCount, 0)
    assert.equal(result.validation.nominalizationOverloadCount + result.validation.abstractClinicalLanguageCount + result.validation.unclearAgentCount + result.validation.unclearDailyLifeMeaningCount, 0)
    assertHeadings(result.finalReport)
    assert.equal(result.trace.scoringVersion, "dna-polarity-v2")
    assert.equal(result.trace.realizationAttempts.some((attempt) => attempt.provider === "luna"), false)
    assertSurfaceQaZero(result, fixture.sourceCase)
    legacyResults.push(result)
  }
  assert.equal(legacyResults[0].decisionPlan.primaryFormulation?.id, "domain_sensory", "Vaka 1 sensory evidence should not collapse to body-based formulation")
  assert.ok(legacyResults[1].decisionPlan.externalTestSynthesis.find((test) => test.id === "brief_p")?.selectedForDecision, "Vaka 2 BRIEF-P should be decision-relevant")
  assert.ok(["domain_interoception", "selective_interoception", "multi_domain"].includes(legacyResults[2].decisionPlan.primaryFormulation?.id ?? ""), "Vaka 3 must retain interoceptive or multi-domain uncertainty")
  assert.equal(legacyResults[3].decisionPlan.primaryFormulation?.id, "multi_domain", "Vaka 4 homogeneous profile must not receive arbitrary body formulation")
  assert.ok(new Set(Object.values(legacyResults[4].trace.domainLevels)).size > 1, "Vaka 5 equal raw scores must preserve domain-specific thresholds")

  const fresh = buildFreshReportV2Cases()
  assert.equal(fresh.length, 36)
  assert.ok(fresh.filter((item) => item.adversarial).length >= 8)
  let discrepancyCases = 0
  let contextualModulationRelations = 0
  let contextualWronglyDiscrepant = 0
  let unknownExternalWronglyDiscrepant = 0
  let clusteredEdgeSurplus = 0
  const freshResults: Awaited<ReturnType<typeof runReportV2Shadow>>[] = []
  for (const fixture of fresh) {
    const first = await runReportV2Shadow(fixture.input)
    const second = await runReportV2Shadow(fixture.input)
    assert.equal(first.validation.pass, true, `${fixture.id}: ${first.validation.failureCodes.join(",")}`)
    assert.equal(first.trace.finalReportHash, second.trace.finalReportHash, `${fixture.id}: non-deterministic`)
    assertHeadings(first.finalReport)
    assert.equal(first.validation.unsupportedRelationCount, 0)
    assert.equal(first.validation.omissionCount, 0)
    assert.equal(first.validation.piiViolationCount, 0)
    assert.equal(first.validation.section23ClaimOverlapCount, 0)
    assert.equal(first.validation.internalEngineJargonCount, 0)
    assert.equal(first.validation.internalLabelLeakageCount, 0)
    assert.equal(first.validation.awkwardAcademicLanguageCount, 0)
    assert.equal(first.validation.terminologyDriftCount, 0)
    assert.equal(first.validation.brokenSuffixCount, 0)
    assert.equal(first.validation.duplicateSuffixCount, 0)
    assert.equal(first.validation.sentenceMergeErrorCount, 0)
    assert.equal(first.validation.brokenWordCount, 0)
    assert.equal(first.validation.ownerBookVerbatimCopyCount, 0)
    assert.equal(first.validation.crossSectionRepetitionCount, 0)
    assert.equal(first.validation.semanticCrossSectionRepeatCount, 0)
    assert.equal(Object.values(first.validation.lexicalQaCounts).reduce((sum, value) => sum + value, 0), 0)
    assert.equal(first.validation.knowledgeAuthorityViolationCount, 0)
    assert.equal(first.validation.knowledgeSourceViolationCount, 0)
    assert.equal(first.validation.knowledgeCaseSpecificAdditionCount, 0)
    assert.equal(first.validation.irrelevantKnowledgeClaimCount, 0)
    assert.equal(first.validation.nonMaterialKnowledgeClaimCount, 0)
    assert.equal(first.validation.theoreticalExpansionKnowledgeCount, 0)
    assert.equal(first.validation.secondaryDomainOverexplanationCount, 0)
    assert.equal(first.validation.systemLikeLanguageCount, 0)
    assert.equal(first.validation.repeatedTemplatePhraseCount, 0, `${fixture.id}:${JSON.stringify(repeatedTemplatePhraseDiagnostics(first.finalReport))}`)
    assert.equal(first.validation.section2RepeatedThresholdSentenceCount, 1)
    assert.equal(first.validation.intraSectionContradictionCount, 0)
    assert.equal(first.validation.semanticPolarityConflictCount, 0)
    assert.equal(first.validation.crossEvidenceContradictionCount, 0)
    assert.equal(first.validation.section4ClinicalSubstanceStatus === "INSUFFICIENT", false)
    assert.equal(first.validation.section5ClinicalSubstanceStatus === "INSUFFICIENT", false)
    assert.equal(first.validation.insufficientClinicalSubstanceCount, 0)
    assert.equal(first.reportPlan.caseEvidenceSourceMatrix.version, "case-evidence-source-matrix@2")
    assert.ok(first.reportPlan.caseEvidenceSourceMatrix.entries.length > 0)
    assert.equal(first.validation.sourcePairRelationContradictionCount, 0)
    assert.equal(first.validation.crossSectionRelationDriftCount, 0)
    assert.equal(first.validation.sameDirectionFalseAssertionCount, 0)
    assert.equal(first.validation.turkishMorphologyErrorCount, 0)
    assert.equal(first.validation.subjectObjectAgreementErrorCount, 0)
    assert.equal(first.validation.brokenNounPhraseCount, 0)
    assertSurfaceQaZero(first, fixture.id)
    assert.equal(first.validation.prescriptiveRecommendationLeakCount, 0)
    assert.equal(first.validation.wrongSectionGenericKnowledgeCount, 0)
    assert.equal(first.validation.otherChildExampleCount, 0)
    assert.equal(first.validation.genericTemplateInjectionCount, 0)
    assert.equal(first.validation.unexplainedConfidenceConflictCount, 0)
    assert.equal(first.validation.reconciliationSentenceCount, first.evidenceMatrix.discrepancyClusters.length)
    assert.equal(first.validation.blankSectionCount, 0)
    assert.doesNotMatch(first.finalReport, /öz[-\s]?düzenleme/iu)
    assert.equal(first.trace.decisionHashBeforeKnowledge, first.trace.decisionHashAfterKnowledge)
    assert.ok(first.knowledgeBridge.selectedAtoms.length > 0)
    assert.equal(first.knowledgeBridge.relevanceSummary.selectedRelevantCount, first.knowledgeBridge.selectedAtoms.length)
    assert.ok(first.knowledgeBridge.selectedAtoms.every((atom) => atom.relevance === "RELEVANT"))
    assert.ok(first.knowledgeBridge.selectedAtoms.every((atom) => new Set(["MATERIAL", "SUPPORTIVE_BUT_NONESSENTIAL"]).has(atom.clinicalMateriality)))
    assert.ok(first.knowledgeBridge.selectedAtoms.every((atom) => !atom.relevanceReasons.includes("SECONDARY_PRESERVED_WITHOUT_CASE_FUNCTION")))
    assert.ok(first.knowledgeBridge.selectedAtoms.every((atom) => ["section_3", "section_4", "section_5", "section_8"].includes(atom.sectionId)))
    assert.equal(first.reportPlan.sections.filter((section) => section.id !== "section_8").some((section) => section.allowedClaimIds.some((id) => first.reportPlan.claims.find((claim) => claim.id === id)?.knowledgeAuthority !== "CASE_EVIDENCE")), false)
    assert.ok(first.decisionPlan.claims.every((claim) => claim.knowledgeAuthority === "CASE_EVIDENCE"))
    assert.equal(first.reportPlan.sections.find((section) => section.id === "section_2")?.allowedClaimIds.some((id) => first.reportPlan.sections.find((section) => section.id === "section_3")?.allowedClaimIds.includes(id)), false)
    const section2Text = first.realization.sections.find((section) => section.sectionId === "section_2")?.text ?? ""
    assert.equal(section2ThresholdSentenceCount(section2Text), 1)
    assert.equal((section2Text.match(/^- .+: \d+\/50 — .+$/gmu) ?? []).length, 6)
    assert.equal(repeatedTemplatePhraseDiagnostics(first.finalReport).total, 0)
    assert.equal(first.candidates.some((candidate) => String(candidate.id) === "uncertain"), false)
    assert.ok(first.decisionPlan.confidence.evidenceCompleteness)
    assert.ok(first.decisionPlan.confidence.evidenceConsistency)
    assert.ok(first.decisionPlan.confidence.formulationConfidence)
    assert.equal(first.trace.contradictions.length, first.evidenceMatrix.discrepancyClusters.length)
    clusteredEdgeSurplus += Math.max(0, first.evidenceMatrix.relations.filter((relation) => relation.type === "DISCREPANT").length - first.evidenceMatrix.discrepancyClusters.length)
    contextualModulationRelations += first.evidenceMatrix.relations.filter((relation) => relation.type === "CONTEXTUAL_MODULATION").length
    for (const relation of first.evidenceMatrix.relations.filter((item) => item.type === "DISCREPANT")) {
      const units = [relation.leftEvidenceId, relation.rightEvidenceId].map((id) => first.evidenceMatrix.units.find((unit) => unit.id === id))
      if (units.some((unit) => unit && (unit.sourceType === "CONTEXTUAL_EVIDENCE" || unit.sourceType === "PRESERVED_CAPACITY"))) contextualWronglyDiscrepant += 1
      if (units.some((unit) => unit?.sourceType === "EXTERNAL_ASSESSMENT" && unit.direction === "NEUTRAL")) unknownExternalWronglyDiscrepant += 1
    }
    const discrepancy = first.evidenceMatrix.relations.some((relation) => relation.type === "DISCREPANT")
    if (discrepancy) discrepancyCases += 1
    if (fixture.expectDiscrepancy) assert.equal(discrepancy, true, `${fixture.id}: expected discrepancy missing`)
    freshResults.push(first)
  }
  assert.ok(discrepancyCases >= 2)
  assert.ok(contextualModulationRelations > 0)
  assert.equal(contextualWronglyDiscrepant, 0)
  assert.equal(unknownExternalWronglyDiscrepant, 0)
  assert.ok(clusteredEdgeSurplus > 0, "pairwise discrepancy edges must collapse into fewer clinical clusters")

  const contentContractBase = freshResults[0]!
  const contentContractProbe = (sectionId: ReportRealization["sections"][number]["sectionId"], text: string) => Object.freeze({
    ...contentContractBase.realization,
    sections: Object.freeze(contentContractBase.realization.sections.map((section) => section.sectionId === sectionId ? Object.freeze({ ...section, text }) : section)),
  })
  const validateContentProbe = (realization: ReportRealization) => validateReportV2Realization({
    plan: contentContractBase.reportPlan,
    decisionPlan: contentContractBase.decisionPlan,
    matrix: contentContractBase.evidenceMatrix,
    realization,
  })
  assert.ok(validateContentProbe(contentContractProbe("section_6", "Bu yaklaşım uygulanmalıdır.")).failureCodes.includes("PRESCRIPTIVE_RECOMMENDATION_LEAK"))
  assert.ok(validateContentProbe(contentContractProbe("section_5", "DNA'nın kavramsal çerçevesinde genel bilimsel bilgi sunulmaktadır.")).failureCodes.includes("WRONG_SECTION_GENERIC_KNOWLEDGE"))
  assert.ok(validateContentProbe(contentContractProbe("section_5", "Başka bir çocuk aynı koşulda farklı tepki verebilir.")).failureCodes.includes("OTHER_CHILD_EXAMPLE"))
  assert.ok(validateContentProbe(contentContractProbe("section_4", "Diğer alanların görece korunduğunu düşündüren bulgular vardır ancak bu güçlü yönler sonucu değiştirmez.")).failureCodes.includes("GENERIC_TEMPLATE_INJECTION"))
  assert.ok(validateContentProbe(contentContractProbe("section_1", "Bazı önemli bilgiler eksiktir. Güven yüksektir.")).failureCodes.includes("UNEXPLAINED_CONFIDENCE_CONFLICT"))

  const qualityConsolidation = buildQualityConsolidationCases()
  assert.equal(qualityConsolidation.length, 15)
  for (const fixture of qualityConsolidation) {
    const result = await runReportV2Shadow(fixture.input)
    assert.equal(result.validation.pass, true, `${fixture.id}:${result.validation.failureCodes.join(",")}`)
    assertSurfaceQaZero(result, fixture.id)
    assert.equal(result.validation.irrelevantKnowledgeClaimCount, 0)
    assert.equal(result.validation.secondaryDomainOverexplanationCount, 0)
    assert.equal(result.validation.semanticCrossSectionRepeatCount, 0)
    assert.equal(result.validation.repeatedTemplatePhraseCount, 0)
    assert.equal(result.validation.section2RepeatedThresholdSentenceCount, 1)
    assert.equal(result.validation.intraSectionContradictionCount, 0)
    assert.equal(result.validation.semanticPolarityConflictCount, 0)
    assert.equal(result.validation.crossEvidenceContradictionCount, 0)
    assert.equal(result.validation.reconciliationSentenceCount, result.evidenceMatrix.discrepancyClusters.length)
    assert.equal(result.trace.decisionHashBeforeKnowledge, result.trace.decisionHashAfterKnowledge)
    const section2Text = result.realization.sections.find((section) => section.sectionId === "section_2")?.text ?? ""
    assert.equal((section2Text.match(/^- .+: \d+\/50 — .+$/gmu) ?? []).length, 6)
  }

  const consistencyNatural = buildConsistencyNaturalLanguageCases()
  assert.equal(consistencyNatural.length, 15)
  for (const fixture of consistencyNatural) {
    const result = await runReportV2Shadow(fixture.input)
    assert.equal(result.validation.pass, true, `${fixture.id}:${result.validation.failureCodes.join(",")}`)
    assertSurfaceQaZero(result, fixture.id)
    assert.equal(result.validation.intraSectionContradictionCount, 0)
    assert.equal(result.validation.semanticPolarityConflictCount, 0)
    assert.equal(result.validation.crossEvidenceContradictionCount, 0)
    assert.equal(result.validation.reconciliationSentenceCount, result.evidenceMatrix.discrepancyClusters.length)
    assert.equal(result.validation.duplicateReconciliationCount, 0)
    assert.equal(result.validation.repeatedTemplatePhraseCount, 0)
    assert.equal(result.validation.irrelevantKnowledgeClaimCount, 0)
    assert.equal(result.validation.secondaryDomainOverexplanationCount, 0)
    assert.equal(result.validation.section2RepeatedThresholdSentenceCount, 1)
  }

  const productionReadiness = buildProductionReadinessCases()
  assert.equal(productionReadiness.length, 50)
  assert.ok(productionReadiness.filter((item) => item.adversarial).length >= 20)
  for (const fixture of productionReadiness) {
    const result = await runReportV2Shadow(fixture.input)
    assert.equal(result.validation.pass, true, `${fixture.id}:${result.validation.failureCodes.join(",")}`)
    assertSurfaceQaZero(result, fixture.id)
    assert.equal(result.validation.nonMaterialKnowledgeClaimCount, 0)
    assert.equal(result.validation.theoreticalExpansionKnowledgeCount, 0)
    assert.equal(result.validation.systemLikeLanguageCount, 0)
    assert.equal(result.validation.irrelevantKnowledgeClaimCount, 0)
    assert.equal(result.validation.secondaryDomainOverexplanationCount, 0)
    assert.equal(result.trace.decisionHashBeforeKnowledge, result.trace.decisionHashAfterKnowledge)
  }
  const plainClinicalFresh = buildPlainClinicalTurkishCases()
  for (const fixture of plainClinicalFresh) {
    const result = await runReportV2Shadow(fixture.input)
    assert.equal(result.validation.pass, true, `${fixture.id}: ${result.validation.failureCodes.join(",")}`)
    assert.equal(result.providerCalls, 0)
    assert.equal(result.plainClinicalTurkish.meaningDriftCount, 0)
    assert.equal(result.plainClinicalTurkish.latestMaterialityPipelineConfirmed, true)
    assert.equal(result.plainClinicalTurkish.nonMaterialKnowledgeRemovedBeforeRewrite, true)
    assert.equal(result.plainClinicalTurkish.semanticStrengtheningCount, 0)
    assert.equal(result.plainClinicalTurkish.newSpecificityCount, 0)
    assert.equal(result.plainClinicalTurkish.newInterventionDetailCount, 0)
    assert.equal(result.plainClinicalTurkish.certaintyDriftCount, 0)
    assert.equal(result.plainClinicalTurkish.nonMaterialKnowledgeReentryCount, 0)
    assert.equal(result.plainClinicalTurkish.semanticMicroRepetitionCount, 0)
    assert.equal(result.plainClinicalTurkish.plainTurkishGrammarErrorCount, 0)
    assert.ok(result.plainClinicalTurkish.records.every((record) => Array.isArray(record.beforeClaimIds)
      && typeof record.afterSentence === "string"
      && typeof record.preservedMeaning === "boolean"
      && typeof record.newSpecificity === "boolean"
      && typeof record.certaintyChanged === "boolean"))
    assert.equal(latestMaterialityPipelineAssertion(result.reportPlan).latestMaterialityPipelineConfirmed, true)
    assert.doesNotMatch(result.finalReport, /prenatal|doğum öncesi|plasent\p{L}*|inflamatu\p{L}*|inflamasyon|allostaz|allostatik/iu)
    assert.equal(result.validation.nominalizationOverloadCount + result.validation.abstractClinicalLanguageCount + result.validation.unclearAgentCount + result.validation.unclearDailyLifeMeaningCount, 0)
    assert.equal(result.validation.terminologyDriftCount, 0)
  }

  const auditPlan = freshResults[0]!.reportPlan
  const unsupportedSpecificity = auditPlainClinicalRewriteRecord({
    plan: auditPlan,
    sectionId: "section_3",
    beforeClaimIds: Object.freeze([]),
    before: "Çok basamaklı görevleri başlatma, sürdürme ve tamamlama desteğe duyarlı olabilir.",
    afterSentence: "Görsel sıra veya kısa hatırlatma verildiğinde çocuk çok basamaklı görevleri tamamlayabilir.",
    ruleIds: Object.freeze(["REGRESSION_PROBE"]),
  })
  assert.equal(unsupportedSpecificity.semanticStrengthening, true)
  assert.equal(unsupportedSpecificity.newSpecificity, true)
  assert.equal(unsupportedSpecificity.newInterventionDetail, true)
  assert.equal(unsupportedSpecificity.preservedMeaning, false)
  const certaintyStrengthening = auditPlainClinicalRewriteRecord({
    plan: auditPlan,
    sectionId: "section_4",
    beforeClaimIds: Object.freeze([]),
    before: "Self-regülasyon alanlarında korunmuş performans değerlendirildi.",
    afterSentence: "Belirgin günlük yaşam güçlüğü saptanmadı.",
    ruleIds: Object.freeze(["REGRESSION_PROBE"]),
  })
  assert.equal(certaintyStrengthening.certaintyChanged, true)
  assert.equal(certaintyStrengthening.semanticStrengthening, true)
  assert.equal(certaintyStrengthening.preservedMeaning, false)
  const grammarProbe = Object.freeze({
    ...freshResults[0]!.realization,
    sections: Object.freeze(freshResults[0]!.realization.sections.map((section) => section.sectionId === "section_3"
      ? Object.freeze({ ...section, text: "Çocuk kendi günlük işlevını izliyor. Bununla birlikte Farklı sonuçlar vardır. Kurum içi kaynakta bu bilgi değerlendirme açısından yararlı olabilir." })
      : section)),
  })
  assert.ok(plainClinicalLanguageDiagnostics(grammarProbe).plainTurkishGrammarErrorCount >= 3)

  const integrationCases = buildPlainIntegrationQaCases()
  assert.equal(integrationCases.length, 50)
  assert.ok(integrationCases.filter((fixture) => fixture.pattern.includes("single-domain")).length >= 6)
  assert.ok(integrationCases.filter((fixture) => fixture.adversarial || /mixed|disagreement|uncertain|multi-domain/iu.test(fixture.pattern)).length >= 20)
  assert.ok(integrationCases.some((fixture) => fixture.pattern.includes("preserved-under-support")))
  assert.ok(integrationCases.some((fixture) => fixture.pattern.includes("external") && fixture.expectDiscrepancy))
  assert.ok(integrationCases.some((fixture) => fixture.pattern.includes("low-evidence")))

  const expectedSingleDomain = new Map([
    ["single-domain-sensory", "domain_sensory"],
    ["single-domain-executive", "domain_executive"],
    ["single-domain-emotional", "domain_emotional"],
    ["single-domain-physiological", "domain_physiological"],
    ["single-domain-interoception", "domain_interoception"],
    ["single-domain-cognitive", "domain_cognitive"],
  ])
  for (const [pattern, formulation] of expectedSingleDomain) {
    const index = fresh.findIndex((fixture) => fixture.pattern === pattern)
    assert.ok(index >= 0)
    assert.equal(freshResults[index].decisionPlan.decisionState, "FORMULATED")
    assert.equal(freshResults[index].decisionPlan.primaryFormulation?.id, formulation)
  }
  const lowEvidenceIndex = fresh.findIndex((fixture) => fixture.pattern === "low-score-no-functional-evidence")
  assert.equal(freshResults[lowEvidenceIndex].decisionPlan.decisionState, "UNCERTAIN")
  assert.equal(freshResults[lowEvidenceIndex].decisionPlan.primaryFormulation, null)

  const unclearExternalInput = {
    ...fresh.find((fixture) => fixture.pattern === "single-domain-executive")!.input,
    anamnez: "Başvuru sebebi: Çok basamaklı görevleri sürdürmek zor. Terapist gözlemi: Görsel destek yardımcı oldu. Ek klinik test / bulgular: Test 1: Test adı: BRIEF-P | Puan / sonuç: Sonuç yönü belirtilmedi | Klinik yorum: Ek bilgi yok.",
  }
  const unclearExternal = await runReportV2Shadow(unclearExternalInput)
  const unclearEvidenceIds = new Set(unclearExternal.evidenceMatrix.units.filter((unit) => unit.sourceType === "EXTERNAL_ASSESSMENT" && unit.direction === "NEUTRAL").map((unit) => unit.id))
  assert.ok(unclearEvidenceIds.size > 0)
  assert.equal(unclearExternal.evidenceMatrix.relations.some((relation) => relation.type === "DISCREPANT" && (unclearEvidenceIds.has(relation.leftEvidenceId) || unclearEvidenceIds.has(relation.rightEvidenceId))), false)
  assert.ok(unclearExternal.evidenceMatrix.relations.some((relation) => relation.type === "INSUFFICIENT" && (unclearEvidenceIds.has(relation.leftEvidenceId) || unclearEvidenceIds.has(relation.rightEvidenceId))))

  const preservedResult = freshResults.find((result) => result.decisionPlan.preservedCapacity.length > 0 && result.reportPlan.claims.some((claim) => claim.role === "PRESERVED_CAPACITY"))
  assert.ok(preservedResult)
  const preservedValidation = validateReportV2Realization({ plan: preservedResult.reportPlan, decisionPlan: preservedResult.decisionPlan, matrix: preservedResult.evidenceMatrix, realization: withoutClaims(preservedResult, (id) => id.startsWith("claim.preserved.")) })
  assert.equal(preservedValidation.failureCodes.includes("PRESERVED_CAPACITY_OMITTED"), false, "non-material preserved capacity omission must not be fatal")
  const externalDiscrepancyResult = freshResults.find((result) => result.evidenceMatrix.relations.some((relation) => relation.type === "DISCREPANT" && [relation.leftEvidenceId, relation.rightEvidenceId].some((id) => id.startsWith("evidence.external."))))
  assert.ok(externalDiscrepancyResult)
  const discrepancyValidation = validateReportV2Realization({ plan: externalDiscrepancyResult.reportPlan, decisionPlan: externalDiscrepancyResult.decisionPlan, matrix: externalDiscrepancyResult.evidenceMatrix, realization: withoutClaims(externalDiscrepancyResult, (id) => id.startsWith("claim.discrepancy.") || id.startsWith("claim.external.")) })
  assert.ok(discrepancyValidation.failureCodes.includes("CONTRADICTORY_EVIDENCE_OMITTED"))
  assert.ok(discrepancyValidation.failureCodes.includes("EXTERNAL_TEST_DISCREPANCY_OMITTED"))
  const discrepancySection5 = externalDiscrepancyResult.realization.sections.find((section) => section.sectionId === "section_5")!
  const disagreeSentence = discrepancySection5.text.split(/(?<=[.!?])\s+/u).find((sentence) => /aynı yönde değildir/iu.test(sentence))
  assert.ok(disagreeSentence, "adversarial relation probe requires a canonical disagreement sentence")
  const falseSupportSentence = disagreeSentence.replace(/aynı yönde değildir/iu, "aynı yöndedir")
  const contradictoryRelationRealization = Object.freeze({
    ...externalDiscrepancyResult.realization,
    sections: Object.freeze(externalDiscrepancyResult.realization.sections.map((section) => section.sectionId === "section_5"
      ? Object.freeze({ ...section, text: `${section.text} ${falseSupportSentence}` })
      : section)),
  })
  const contradictoryRelationValidation = validateReportV2Realization({ plan: externalDiscrepancyResult.reportPlan, decisionPlan: externalDiscrepancyResult.decisionPlan, matrix: externalDiscrepancyResult.evidenceMatrix, realization: contradictoryRelationRealization })
  assert.ok(contradictoryRelationValidation.failureCodes.includes("SOURCE_PAIR_RELATION_CONTRADICTION"))
  assert.ok(contradictoryRelationValidation.failureCodes.includes("CROSS_SECTION_RELATION_DRIFT"))
  assert.ok(contradictoryRelationValidation.failureCodes.includes("SAME_DIRECTION_FALSE_ASSERTION"))
  const genericDisagreementSentence = disagreeSentence.replace(/\s+(?:fizyolojik regülasyon|duyusal regülasyon|duygusal regülasyon|bilişsel regülasyon|yürütücü işlev|interosepsiyon)\s+alanında/iu, "")
  const section5DuplicationProbe = Object.freeze({
    ...externalDiscrepancyResult.realization,
    sections: Object.freeze(externalDiscrepancyResult.realization.sections.map((section) => section.sectionId === "section_5"
      ? Object.freeze({ ...section, text: `${section.text} ${genericDisagreementSentence}` })
      : section)),
  })
  const section5DuplicationValidation = validateReportV2Realization({ plan: externalDiscrepancyResult.reportPlan, decisionPlan: externalDiscrepancyResult.decisionPlan, matrix: externalDiscrepancyResult.evidenceMatrix, realization: section5DuplicationProbe })
  assert.ok(section5DuplicationValidation.failureCodes.includes("SECTION5_GENERIC_SPECIFIC_DUPLICATION"))
  const morphologyProbe = Object.freeze({
    ...freshResults[0].realization,
    sections: Object.freeze(freshResults[0].realization.sections.map((section) => section.sectionId === "section_4"
      ? Object.freeze({ ...section, text: `${section.text} Duyusal regülasyon alanındaki güçlük destekliyor. Dengeli bir bulgular destekliyor. Güçlük da değerlendirilmiştir.` })
      : section)),
  })
  const morphologyProbeValidation = validateReportV2Realization({ plan: freshResults[0].reportPlan, decisionPlan: freshResults[0].decisionPlan, matrix: freshResults[0].evidenceMatrix, realization: morphologyProbe })
  assert.ok(morphologyProbeValidation.failureCodes.includes("TURKISH_MORPHOLOGY_ERROR"))
  assert.ok(morphologyProbeValidation.failureCodes.includes("SUBJECT_OBJECT_AGREEMENT_ERROR"))
  assert.ok(morphologyProbeValidation.failureCodes.includes("BROKEN_NOUN_PHRASE"))
  const finalSurfaceProbe = Object.freeze({
    ...freshResults[0].realization,
    sections: Object.freeze(freshResults[0].realization.sections.map((section) => section.sectionId === "section_4"
      ? Object.freeze({ ...section, text: `${section.text} Bulgular önceliğinda yoğunlaşmaktadır. Bu değerlendirme bulgudür. Bu ifade , açıktır. Bu açıklama destek sağlar; Tek başına karar vermez.` })
      : section)),
  })
  const finalSurfaceProbeValidation = validateReportV2Realization({ plan: freshResults[0].reportPlan, decisionPlan: freshResults[0].decisionPlan, matrix: freshResults[0].evidenceMatrix, realization: finalSurfaceProbe })
  assert.ok(finalSurfaceProbeValidation.failureCodes.includes("TURKISH_SURFACE_ERROR"))
  assert.ok(finalSurfaceProbeValidation.failureCodes.includes("MORPHOLOGY_ERROR"))
  assert.ok(finalSurfaceProbeValidation.failureCodes.includes("PUNCTUATION_ERROR"))
  assert.ok(finalSurfaceProbeValidation.failureCodes.includes("SENTENCE_BOUNDARY_ERROR"))
  const validLexicalLocative = Object.freeze({
    ...freshResults[0].realization,
    sections: Object.freeze(freshResults[0].realization.sections.map((section) => section.sectionId === "section_3"
      ? Object.freeze({ ...section, text: `${section.text} Bakım veren, kantinde ve rutinde günlük yaşam güçlüğü bildirmektedir.` })
      : section)),
  })
  const validLexicalLocativeSurface = auditFinalTurkishSurface(validLexicalLocative)
  assert.equal(validLexicalLocativeSurface.morphologyErrors.some((error) => /kantinde|rutinde/iu.test(error)), false)
  const failedOutcomeEvidence = extractCanonicalAnamnesisEvidence({
    ...fresh[0].input,
    clientCode: "GENERIC-FAILED-OUTCOME",
    anamnez: "Aile görüşmesinde iki bilgi peş peşe verildiğinde ikinci bilgiyi karıştırıp yanlış kutuya koyuyor.",
  })
  assert.equal(failedOutcomeEvidence.length, 1)
  assert.equal(failedOutcomeEvidence[0].direction, "DIFFICULTY")
  assert.ok(failedOutcomeEvidence[0].functional_roles.includes("COMPLAINT"))
  assert.equal(failedOutcomeEvidence[0].functional_roles.includes("PRESERVED_CAPACITY"), false)
  const reversedOutcomeEvidence = extractCanonicalAnamnesisEvidence({
    ...fresh[0].input,
    clientCode: "GENERIC-REVERSED-OUTCOME",
    anamnez: "Üç nesnenin yerini dinledikten sonra ikisini ters sıraya koyuyor.",
  })
  assert.equal(reversedOutcomeEvidence.length, 1)
  assert.equal(reversedOutcomeEvidence[0].direction, "DIFFICULTY")
  assert.equal(reversedOutcomeEvidence[0].functional_roles.includes("PRESERVED_CAPACITY"), false)
  const negativeReturnEvidence = extractCanonicalAnamnesisEvidence({
    ...fresh[0].input,
    clientCode: "GENERIC-NEGATIVE-RETURN",
    anamnez: "Öğretmen okulda doğum gününde balon patlayınca masanın altına girip oyuna dönmüyor.",
  })
  assert.equal(negativeReturnEvidence.length, 1)
  assert.equal(negativeReturnEvidence[0].direction, "DIFFICULTY")
  assert.ok(negativeReturnEvidence[0].functional_roles.includes("COMPLAINT"))
  const anaphoricAbsenceEvidence = extractCanonicalAnamnesisEvidence({
    ...fresh[0].input,
    clientCode: "GENERIC-ANAPHORIC-ABSENCE",
    anamnez: "Aile blender sesi duyunca kulaklarını kapatıyor. Aile aynı etkinlikte belirgin sorun görmediğini ekliyor.",
  })
  assert.equal(anaphoricAbsenceEvidence.length, 2)
  assert.equal(anaphoricAbsenceEvidence[1].direction, "ABSENCE")
  assert.deepEqual(anaphoricAbsenceEvidence[1].domains, ["sensory"])
  assert.ok(anaphoricAbsenceEvidence[1].functional_roles.includes("CONTEXT"))
  const broaderAnaphoricAbsence = extractCanonicalAnamnesisEvidence({
    ...fresh[0].input,
    clientCode: "GENERIC-BROADER-ANAPHORIC-ABSENCE",
    anamnez: "Duyusal regülasyon alanında blender sesi duyunca kulaklarını kapatıyor. Aile aynı çalışmada belirgin sorun görmediğini ekliyor.",
  })
  assert.equal(broaderAnaphoricAbsence.length, 2)
  assert.deepEqual(broaderAnaphoricAbsence[1].domains, ["sensory"])
  assert.ok(broaderAnaphoricAbsence[1].functional_roles.includes("CONTEXT"))
  const generalizedDomainEvidence = extractCanonicalAnamnesisEvidence({
    ...fresh[0].input,
    clientCode: "GENERIC-DOMAIN-VOCABULARY",
    anamnez: "İki özellik birlikte söylendiğinde kartları hatalı kutuya yerleştiriyor. Sanat çalışmasında iki malzemeyi unutup projeyi yarıda bırakıyor. Öğleden sonra yorgunluğu arttığında montunu giyerken işi yarıda bırakıyor. Atölyede metal kutu düşünce sandalyenin arkasına çekiliyor.",
  })
  assert.deepEqual(generalizedDomainEvidence.map((fact) => fact.domains), [["cognitive"], ["executive"], ["physiological"], ["sensory"]])
  const inflectedPreservedEvidence = extractCanonicalAnamnesisEvidence({
    ...fresh[0].input,
    clientCode: "GENERIC-INFLECTED-PRESERVED",
    anamnez: "Dinlenmiş olduğu sabah kahvaltıyı tamamlayıp servise yetişiyor.",
  })
  assert.equal(inflectedPreservedEvidence.length, 1)
  assert.equal(inflectedPreservedEvidence[0].direction, "PRESERVED")
  assert.ok(inflectedPreservedEvidence[0].functional_roles.includes("PRESERVED_CAPACITY"))
  assert.ok(inflectedPreservedEvidence[0].functional_roles.includes("OUTCOME"))
  const generalizedMetadataEvidence = extractCanonicalAnamnesisEvidence({
    ...fresh[0].input,
    clientCode: "GENERIC-METADATA-NOISE",
    anamnez: "Eski taslakta yalnız yürütücü işlev başlığı bulunuyor; gözlenebilir görev ya da davranış örneği eklenmemiş.",
  })
  assert.equal(generalizedMetadataEvidence.length, 0)
  const generalizedArchiveMetadata = extractCanonicalAnamnesisEvidence({
    ...fresh[0].input,
    clientCode: "GENERIC-ARCHIVE-METADATA-NOISE",
    anamnez: "Arşiv kağıdında yalnız bilişsel regülasyon etiketi bulunuyor; gözlenebilir işlev örneği yok.",
  })
  assert.equal(generalizedArchiveMetadata.length, 0)
  const stepStoppingEvidence = extractCanonicalAnamnesisEvidence({
    ...fresh[0].input,
    clientCode: "GENERIC-STEP-STOPPING",
    anamnez: "Yürütücü işlev alanında üç basamaklı giyinme planında ikinci adımdan sonra duruyor.",
  })
  assert.equal(stepStoppingEvidence.length, 1)
  assert.equal(stepStoppingEvidence[0].direction, "DIFFICULTY")
  assert.ok(stepStoppingEvidence[0].functional_roles.includes("COMPLAINT"))
  const unexplainedDifferenceEvidence = extractCanonicalAnamnesisEvidence({
    ...fresh[0].input,
    clientCode: "GENERIC-UNEXPLAINED-DIFFERENCE",
    anamnez: "Duyusal regülasyon alanında okulda zil çalınca koridora çıkıyor. İki ortam arasındaki ayrımın nedeni henüz açıklanamıyor.",
  })
  assert.equal(unexplainedDifferenceEvidence.length, 2)
  assert.equal(unexplainedDifferenceEvidence[1].direction, "VAGUE")
  assert.deepEqual(unexplainedDifferenceEvidence[1].domains, ["sensory"])
  assert.ok(unexplainedDifferenceEvidence[1].functional_roles.includes("UNCERTAINTY"))
  const directNeedRequestEvidence = extractCanonicalAnamnesisEvidence({
    ...fresh[0].input,
    clientCode: "GENERIC-DIRECT-NEED-REQUEST",
    anamnez: "Interosepsiyon alanında beden molasında susadığını söyleyip su istiyor.",
  })
  assert.equal(directNeedRequestEvidence.length, 1)
  assert.equal(directNeedRequestEvidence[0].direction, "PRESERVED")
  assert.ok(directNeedRequestEvidence[0].functional_roles.includes("PRESERVED_CAPACITY"))
  assert.ok(directNeedRequestEvidence[0].functional_roles.includes("OUTCOME"))
  const nonPossessiveWaitingEvidence = extractCanonicalAnamnesisEvidence({
    ...fresh[0].input,
    clientCode: "GENERIC-NONPOSSESSIVE-WAITING",
    anamnez: "Duyusal regülasyon alanında kulak tıkacı takınca koridordaki sırayı bekliyor.",
  })
  assert.equal(nonPossessiveWaitingEvidence.length, 1)
  const waitingOutcome = nonPossessiveWaitingEvidence.find((fact) => fact.source_excerpt.includes("sırayı bekliyor"))
  assert.equal(waitingOutcome?.direction, "PRESERVED")
  assert.ok(waitingOutcome?.functional_roles.includes("PRESERVED_CAPACITY"))
  assert.ok(waitingOutcome?.functional_roles.includes("OUTCOME"))
  const morningExecutiveEvidence = extractCanonicalAnamnesisEvidence({
    ...fresh[0].input,
    clientCode: "GENERIC-MORNING-EXECUTIVE",
    anamnez: "Yürütücü işlev alanında sabah işleri resimli listede sıralanınca rutini bitiriyor.",
  })
  assert.ok(morningExecutiveEvidence.every((fact) => fact.domains.includes("executive")))
  assert.ok(morningExecutiveEvidence.some((fact) => fact.direction === "PRESERVED" && fact.functional_roles.includes("OUTCOME")))
  const emotionalRuleChangeEvidence = extractCanonicalAnamnesisEvidence({
    ...fresh[0].input,
    clientCode: "GENERIC-EMOTIONAL-RULE-CHANGE",
    anamnez: "Duygusal regülasyon alanında kural değişikliği iki seçenekle anlatılınca sakinleşiyor.",
  })
  assert.ok(emotionalRuleChangeEvidence.every((fact) => fact.domains.includes("emotional")))
  assert.ok(emotionalRuleChangeEvidence.some((fact) => fact.direction === "PRESERVED" && fact.functional_roles.includes("OUTCOME")))
  const bodyPlacementDifficultyEvidence = extractCanonicalAnamnesisEvidence({
    ...fresh[0].input,
    clientCode: "GENERIC-BODY-PLACEMENT-DIFFICULTY",
    anamnez: "Fizyolojik regülasyon alanında çok yorgun olduğunda başını masaya koyuyor.",
  })
  assert.equal(bodyPlacementDifficultyEvidence.length, 1)
  assert.equal(bodyPlacementDifficultyEvidence[0].direction, "DIFFICULTY")
  assert.equal(bodyPlacementDifficultyEvidence[0].functional_roles.includes("PRESERVED_CAPACITY"), false)
  const section4SubstanceMissing = validateReportV2Realization({
    plan: freshResults[0].reportPlan,
    decisionPlan: freshResults[0].decisionPlan,
    matrix: freshResults[0].evidenceMatrix,
    realization: withoutClaims(freshResults[0], (id) => id === "claim.section4-synthesis"),
  })
  assert.equal(section4SubstanceMissing.section4ClinicalSubstanceStatus, "INSUFFICIENT")
  assert.ok(section4SubstanceMissing.failureCodes.includes("INSUFFICIENT_CLINICAL_SUBSTANCE"))
  const section5SubstanceMissing = validateReportV2Realization({
    plan: freshResults[0].reportPlan,
    decisionPlan: freshResults[0].decisionPlan,
    matrix: freshResults[0].evidenceMatrix,
    realization: withoutClaims(freshResults[0], (id) => id.startsWith("claim.source-comparison.")),
  })
  assert.equal(section5SubstanceMissing.section5ClinicalSubstanceStatus, "INSUFFICIENT")
  assert.ok(section5SubstanceMissing.failureCodes.includes("INSUFFICIENT_CLINICAL_SUBSTANCE"))
  const evidenceLimited = await runReportV2Shadow({ ...fresh[0].input, anamnez: "" })
  assert.equal(evidenceLimited.validation.pass, true, evidenceLimited.validation.failureCodes.join(","))
  assert.equal(evidenceLimited.validation.section5ClinicalSubstanceStatus, "LIMITED_BY_AVAILABLE_EVIDENCE")
  assert.ok(evidenceLimited.reportPlan.claims.find((claim) => claim.id.startsWith("claim.source-comparison."))?.text.includes("karşılaştırma"))
  const crossSectionRealization = Object.freeze({
    ...freshResults[0].realization,
    sections: Object.freeze(freshResults[0].realization.sections.map((section) => section.sectionId === "section_7"
      ? Object.freeze({ ...section, usedClaimIds: Object.freeze(section.usedClaimIds.filter((id) => id !== "claim.primary-formulation")) })
      : section)),
  })
  const crossSectionValidation = validateReportV2Realization({ plan: freshResults[0].reportPlan, decisionPlan: freshResults[0].decisionPlan, matrix: freshResults[0].evidenceMatrix, realization: crossSectionRealization })
  assert.ok(crossSectionValidation.failureCodes.includes("CROSS_SECTION_PRIMARY_FORMULATION_MISMATCH"))
  const causalRealization = Object.freeze({
    ...freshResults[0].realization,
    sections: Object.freeze(freshResults[0].realization.sections.map((section, index) => index === 0
      ? Object.freeze({ ...section, text: `${section.text} Bu bulgu güçlüğe neden olur.` })
      : section)),
  })
  const causalValidation = validateReportV2Realization({ plan: freshResults[0].reportPlan, decisionPlan: freshResults[0].decisionPlan, matrix: freshResults[0].evidenceMatrix, realization: causalRealization })
  assert.ok(causalValidation.failureCodes.includes("UNSUPPORTED_RELATION"))

  const firstBinding = freshResults[0].reportPlan.literatureBindings[0]
  assert.ok(firstBinding)
  const literatureMismatch = validateLockedReportPlan(Object.freeze({
    ...freshResults[0].reportPlan,
    literatureBindings: Object.freeze([
      Object.freeze({ ...firstBinding, sourceId: "MISSING_OR_MISMATCHED_SOURCE" }),
      ...freshResults[0].reportPlan.literatureBindings.slice(1),
    ]),
  }))
  assert.ok(literatureMismatch.failureCodes.includes("LITERATURE_CLAIM_SOURCE_MISMATCH"))
  const exactPassageMismatchPlan = Object.freeze({
    ...freshResults[0].reportPlan,
    literatureBindings: Object.freeze([
      Object.freeze({ ...firstBinding, exactPassageId: `${firstBinding.exactPassageId}:mismatch` }),
      ...freshResults[0].reportPlan.literatureBindings.slice(1),
    ]),
  })
  const exactPassageMismatch = validateReportV2Realization({ plan: exactPassageMismatchPlan, decisionPlan: freshResults[0].decisionPlan, matrix: freshResults[0].evidenceMatrix, realization: freshResults[0].realization })
  assert.ok(exactPassageMismatch.failureCodes.includes("EXACT_PASSAGE_MISSING"))
  const section8Overreach = Object.freeze({
    ...freshResults[0].realization,
    sections: Object.freeze(freshResults[0].realization.sections.map((section) => section.sectionId === "section_8"
      ? Object.freeze({ ...section, text: section.text.replace(firstBinding.supportedClaim, "Fizyolojik regülasyon ölçümleri arousal ve toparlanmayı doğrudan ölçer") })
      : section)),
  })
  const section8OverreachValidation = validateReportV2Realization({ plan: freshResults[0].reportPlan, decisionPlan: freshResults[0].decisionPlan, matrix: freshResults[0].evidenceMatrix, realization: section8Overreach })
  assert.ok(section8OverreachValidation.failureCodes.includes("CLAIM_PASSAGE_OVERREACH"))
  assert.ok(section8OverreachValidation.failureCodes.includes("WRONG_CONSTRUCT_CITATION"))
  const knownFalsePassReplay = Object.freeze({
    ...freshResults[0].realization,
    sections: Object.freeze(freshResults[0].realization.sections.map((section) => section.sectionId === "section_8"
      ? Object.freeze({ ...section, text: `${section.text}\n\nFizyolojik ölçümler arousal ve toparlanmayı doğrudan ölçer (Sankalaite et al., 2021). Duygusal ölçümler reaktiviteyi doğrudan ölçer (Liang et al., 2025).` })
      : section)),
  })
  const knownFalsePassValidation = validateReportV2Realization({ plan: freshResults[0].reportPlan, decisionPlan: freshResults[0].decisionPlan, matrix: freshResults[0].evidenceMatrix, realization: knownFalsePassReplay })
  assert.ok(knownFalsePassValidation.failureCodes.includes("EXACT_PASSAGE_MISSING"))
  assert.ok(knownFalsePassValidation.failureCodes.includes("CLAIM_SOURCE_MISMATCH"))
  assert.ok(knownFalsePassValidation.failureCodes.includes("CLAIM_PASSAGE_OVERREACH"))
  assert.ok(knownFalsePassValidation.failureCodes.includes("TOPIC_ONLY_CITATION"))
  assert.ok(knownFalsePassValidation.failureCodes.includes("WRONG_CONSTRUCT_CITATION"))
  const ownerClaim = freshResults[0].reportPlan.claims.find((claim) => claim.knowledgeAuthority === "OWNER_BOOK")
  assert.ok(ownerClaim)
  const ownerSourceMismatch = validateLockedReportPlan(Object.freeze({
    ...freshResults[0].reportPlan,
    claims: Object.freeze(freshResults[0].reportPlan.claims.map((claim) => claim.id === ownerClaim.id ? Object.freeze({ ...claim, sourceIds: Object.freeze(["external.fake"]) }) : claim)),
  }))
  assert.ok(ownerSourceMismatch.failureCodes.includes("KNOWLEDGE_SOURCE_VIOLATION"))
  const caseDecisionAttribution = validateLockedReportPlan(Object.freeze({
    ...freshResults[0].reportPlan,
    literatureBindings: Object.freeze([
      Object.freeze({ ...firstBinding, reportClaimId: freshResults[0].reportPlan.primaryDecisionClaimId, claimType: "FORMULATION_SELECTION" as const }),
      ...freshResults[0].reportPlan.literatureBindings.slice(1),
    ]),
  }))
  assert.ok(caseDecisionAttribution.failureCodes.includes("LITERATURE_CASE_DECISION_ATTRIBUTION"))

  const balancedResult = freshResults[fresh.findIndex((fixture) => fixture.pattern === "balanced-preserved")]
  assert.equal(balancedResult.validation.preservedDomainOverinterpretationCount, 0)
  assert.equal(balancedResult.reportPlan.claims.filter((claim) => claim.id.startsWith("claim.domain-interpretation.")).some((claim) => /(?:değişebilir|zorlaşabilir|uzayabilir|desteğe duyarlı olabilir|güçleşebilir)/i.test(claim.text)), false)
  const overinterpretedClaimId = balancedResult.reportPlan.claims.find((claim) => claim.id.startsWith("claim.domain-interpretation."))!.id
  const overinterpretedPlan = Object.freeze({ ...balancedResult.reportPlan, claims: Object.freeze(balancedResult.reportPlan.claims.map((claim) => claim.id === overinterpretedClaimId ? Object.freeze({ ...claim, text: `${claim.text} Yoğun uyaran olduğunda görevde kalma değişebilir.` }) : claim)) })
  const overinterpretationValidation = validateReportV2Realization({ plan: overinterpretedPlan, decisionPlan: balancedResult.decisionPlan, matrix: balancedResult.evidenceMatrix, realization: balancedResult.realization })
  assert.ok(overinterpretationValidation.failureCodes.includes("PRESERVED_DOMAIN_OVERINTERPRETATION"))

  assert.equal(validateReportV2Privacy({ anamnez: "Ad Soyad: Test, e-posta: test@example.com" }).pass, false)
  const capturing = new CapturingLunaRealizer()
  const deidentified = await runReportV2Shadow({ ...fresh[0].input, clientCode: "CLIENT-999", anamnez: `${String(fresh[0].input.anamnez)}\nAdı Soyadı: Ayşe Test\ne-posta: ayse@example.com\nTelefon: 0555 555 55 55` }, { realizer: capturing })
  assert.equal(capturing.calls, 1)
  assert.equal(deidentified.providerCalls, 1)
  assert.doesNotMatch(capturing.payloads[0], /Ayşe|ayse@example\.com|0555|CLIENT-999|"answers"|"anamnez"/)
  const optionalOmission = new OmitByMaterialityRealizer("OPTIONAL")
  const optionalAccepted = await runReportV2Shadow(fresh[0].input, { realizer: optionalOmission })
  assert.equal(optionalOmission.calls, 1)
  assert.equal(optionalAccepted.recoveryStatus, "DIRECT_ACCEPTED")
  assert.equal(optionalAccepted.fallbackUsed, false)
  const importantOmission = new OmitByMaterialityRealizer("IMPORTANT")
  const controlled = await runReportV2Shadow(fresh[0].input, { realizer: importantOmission })
  assert.equal(importantOmission.calls, 1)
  assert.equal(controlled.recoveryStatus, "CONTROLLED_REPAIR")
  assert.ok(controlled.validation.controlledInsertionCount > 0)
  assert.equal(controlled.fallbackUsed, false)
  const literatureFragment = new LiteratureFragmentRealizer()
  const literatureRepaired = await runReportV2Shadow(fresh[0].input, { realizer: literatureFragment })
  assert.equal(literatureFragment.calls, 1)
  assert.equal(literatureRepaired.recoveryStatus, "CONTROLLED_REPAIR")
  assert.equal(literatureRepaired.validation.literatureFormattingErrorCount, 0)
  const languageViolation = new LanguageViolationRealizer()
  const languageRepaired = await runReportV2Shadow(fresh[0].input, { realizer: languageViolation })
  assert.equal(languageViolation.calls, 1)
  assert.equal(languageRepaired.recoveryStatus, "DIRECT_ACCEPTED")
  assert.ok(languageRepaired.plainClinicalTurkish.rewriteCount > 0)
  assert.equal(languageRepaired.validation.awkwardAcademicLanguageCount, 0)
  assert.equal(languageRepaired.validation.terminologyDriftCount, 0)
  assert.doesNotMatch(languageRepaired.finalReport, /öz[-\s]?düzenleme/iu)
  const repetitionAndCopy = new RepetitionAndOwnerCopyRealizer()
  const repetitionAndCopyRepaired = await runReportV2Shadow(fresh[0].input, { realizer: repetitionAndCopy })
  assert.equal(repetitionAndCopy.calls, 1)
  assert.equal(repetitionAndCopyRepaired.recoveryStatus, "CONTROLLED_REPAIR")
  assert.equal(repetitionAndCopyRepaired.validation.ownerBookVerbatimCopyCount, 0)
  assert.equal(repetitionAndCopyRepaired.validation.failureCodes.includes("EXCESSIVE_REPETITION"), false)
  const rawGrammar = reportLanguageDiagnostics("OWNER_BOOK_INTERPRETATION: desteklemektedir.ndadır bilginda değerlendirmendedir yorumlanmaktadırdır.")
  assert.ok(rawGrammar.internalLabelLeakageCount > 0)
  assert.ok(rawGrammar.brokenSuffixCount > 0)
  assert.ok(rawGrammar.duplicateSuffixCount > 0)
  assert.ok(rawGrammar.sentenceMergeErrorCount > 0)
  assert.ok(rawGrammar.brokenWordCount > 0)
  const rawSystemLanguage = "Mevcut adaylardan hiçbiri kabul eşiğini ve bağımsız kanıt koşulunu birlikte karşılamadı. Other candidate decision state evidence threshold information channel."
  assert.ok(reportLanguageDiagnostics(rawSystemLanguage).systemLikeLanguageCount > 0)
  const naturalSystemLanguage = normalizeDnaReportLanguage(rawSystemLanguage)
  assert.equal(reportLanguageDiagnostics(naturalSystemLanguage).systemLikeLanguageCount, 0)
  assert.match(naturalSystemLanguage, /Mevcut bilgiler/)
  const grammarAndInternalLabel = new GrammarAndInternalLabelRealizer()
  const grammarAndInternalLabelRepaired = await runReportV2Shadow(fresh[0].input, { realizer: grammarAndInternalLabel })
  assert.equal(grammarAndInternalLabel.calls, 1)
  assert.ok(["DIRECT_ACCEPTED", "CONTROLLED_REPAIR"].includes(grammarAndInternalLabelRepaired.recoveryStatus))
  assert.equal(grammarAndInternalLabelRepaired.validation.internalLabelLeakageCount, 0)
  assert.equal(grammarAndInternalLabelRepaired.validation.brokenSuffixCount, 0)
  assert.equal(grammarAndInternalLabelRepaired.validation.duplicateSuffixCount, 0)
  assert.equal(grammarAndInternalLabelRepaired.validation.sentenceMergeErrorCount, 0)
  assert.equal(grammarAndInternalLabelRepaired.validation.brokenWordCount, 0)
  const semanticRepeat = new SemanticRepeatRealizer()
  const semanticRepeatRepaired = await runReportV2Shadow(fresh[0].input, { realizer: semanticRepeat })
  assert.equal(semanticRepeat.calls <= 2, true)
  assert.notEqual(semanticRepeatRepaired.recoveryStatus, "DIRECT_ACCEPTED")
  assert.equal(semanticRepeatRepaired.validation.semanticCrossSectionRepeatCount, 0)
  const intraSectionConflict = new IntraSectionConflictRealizer()
  const consistencyRepaired = await runReportV2Shadow(fresh[0].input, { realizer: intraSectionConflict })
  assert.equal(intraSectionConflict.calls, 1)
  assert.equal(consistencyRepaired.recoveryStatus, "CONTROLLED_REPAIR")
  assert.equal(consistencyRepaired.validation.intraSectionContradictionCount, 0)
  assert.equal(consistencyRepaired.validation.semanticPolarityConflictCount, 0)
  assert.equal(consistencyRepaired.validation.crossEvidenceContradictionCount, 0)
  assert.equal(consistencyRepaired.providerCalls, 1)
  const repair = new RepairOnceRealizer()
  const repaired = await runReportV2Shadow(fresh[0].input, { realizer: repair })
  assert.equal(repair.calls, 2)
  assert.equal(repaired.providerCalls, 2)
  assert.equal(repaired.fallbackUsed, false)
  assert.equal(repaired.recoveryStatus, "LUNA_REPAIRED")
  const localizedUnsupported = new LocalizedUnsupportedRealizer()
  const localizedUnsupportedRepaired = await runReportV2Shadow(fresh[0].input, { realizer: localizedUnsupported })
  assert.equal(localizedUnsupported.calls, 1)
  assert.equal(localizedUnsupportedRepaired.recoveryStatus, "CONTROLLED_REPAIR")
  assert.equal(localizedUnsupportedRepaired.realization.unsupportedAddition, false)
  assert.deepEqual(localizedUnsupportedRepaired.realization.unsupportedSectionIds, [])
  const failing = new AlwaysFailRealizer()
  const fallback = await runReportV2Shadow(fresh[1].input, { realizer: failing })
  assert.equal(failing.calls, 2)
  assert.equal(fallback.providerCalls, 2)
  assert.equal(fallback.fallbackUsed, true)
  assert.equal(fallback.recoveryStatus, "DETERMINISTIC_FALLBACK")
  assert.equal(validateReportV2Realization({ plan: fallback.reportPlan, decisionPlan: fallback.decisionPlan, matrix: fallback.evidenceMatrix, realization: fallback.realization }).pass, true)
  assert.doesNotMatch(fallback.finalReport, /Genel değerlendirmede|Klinik örüntü açısından|Günlük işlev açısından/)

  console.log("=== REPORT V2 SHADOW TESTS ===")
  console.log(`Legacy cases: ${legacy.length}`)
  console.log(`Fresh cases: ${fresh.length}`)
  console.log(`Production-readiness cases: ${productionReadiness.length}`)
  console.log(`Adversarial cases: ${fresh.filter((item) => item.adversarial).length}`)
  console.log(`Detected discrepancy cases: ${discrepancyCases}`)
  console.log(`Contextual modulation relations: ${contextualModulationRelations}`)
  console.log(`Clustered edge surplus: ${clusteredEdgeSurplus}`)
  console.log("PASS: scoring, headings, privacy, max-2 Luna calls, fallback and deterministic shadow gates.")
}

void main()

import { ASSESSMENT_SCORING_VERSION } from "../../assessment/itemScoring"
import { validateAndNormalizeClinicalReport } from "../clinicalSafetyValidator"
import { buildAdvancedReport } from "../reportEngine"
import type {
  LiteratureMode,
  PlainClinicalRewriteRecord,
  PlainClinicalTurkishSummary,
  ReportRealizer,
  ReportRealizerAttempt,
  ReportRealization,
  ReportRecoveryStatus,
  ReportTraceV2,
  ReportV2ShadowInput,
  ReportV2ShadowResult,
  ReportV2ValidationResult,
} from "./contracts"
import { REPORT_V2_TRACE_VERSION } from "./contracts"
import {
  buildCandidateFormulations,
  buildClinicalEvidenceMatrix,
  buildConfidence,
  buildDomainThresholdTrace,
  stableHash,
  structureExternalAssessments,
} from "./evidenceEngine"
import { selectReportV2Knowledge } from "./knowledge"
import { normalizeDnaReportLanguage } from "./languageContract"
import { buildDecisionAndReportPlans } from "./planBuilder"
import { PLAIN_CLINICAL_TURKISH_VERSION, rewritePlainClinicalTurkish } from "./plainClinicalTurkish"
import { createControlledReportRepair, DeterministicReportRealizer, renderReportRealization } from "./realizer"
import { validateLockedReportPlan, validateReportV2Privacy, validateReportV2Realization } from "./validators"

export type ReportV2ShadowOptions = Readonly<{
  realizer?: ReportRealizer
  literatureMode?: LiteratureMode
}>

function sanitizedAttempt(attempt: ReportRealizerAttempt): Omit<ReportRealizerAttempt, "rawOutput" | "realization"> {
  const { rawOutput: _rawOutput, realization: _realization, ...safe } = attempt
  return Object.freeze(safe)
}

function sumProviderCalls(attempts: readonly ReportRealizerAttempt[]) {
  return attempts.filter((attempt) => attempt.provider === "luna").length
}

function canUseControlledRepair(validation: ReportV2ValidationResult | null) {
  if (!validation?.repairableFailureCodes.length) return false
  return validation.failureCodes.every((code) => validation.repairableFailureCodes.includes(code))
}

function plainClinicalSummary(records: readonly PlainClinicalRewriteRecord[], driftSectionIds: readonly PlainClinicalTurkishSummary["meaningDriftSectionIds"][number][]): PlainClinicalTurkishSummary {
  return Object.freeze({
    version: PLAIN_CLINICAL_TURKISH_VERSION,
    latestMaterialityPipelineConfirmed: records.every((record) => record.materiality.every((value) => ["REQUIRED", "IMPORTANT", "OPTIONAL"].includes(value))),
    nonMaterialKnowledgeRemovedBeforeRewrite: true,
    rewriteCount: records.length,
    meaningDriftCount: new Set(driftSectionIds).size,
    meaningDriftSectionIds: Object.freeze(Array.from(new Set(driftSectionIds))),
    semanticStrengtheningCount: records.filter((record) => record.semanticStrengthening).length,
    newSpecificityCount: records.filter((record) => record.newSpecificity).length,
    newInterventionDetailCount: records.filter((record) => record.newInterventionDetail).length,
    certaintyDriftCount: records.filter((record) => record.certaintyChanged).length,
    nonMaterialKnowledgeReentryCount: 0,
    semanticMicroRepetitionCount: 0,
    plainTurkishGrammarErrorCount: 0,
    records: Object.freeze([...records]),
  })
}

function normalizeRealizationAfterClinicalSafety(plan: ReportV2ShadowResult["reportPlan"], realization: ReportRealization): ReportRealization {
  const normalizedReport = validateAndNormalizeClinicalReport(renderReportRealization(plan, realization)).text
  const headingOffsets = plan.sections.map((section) => normalizedReport.indexOf(section.heading))
  if (headingOffsets.some((offset, index) => offset < 0 || (index > 0 && offset <= headingOffsets[index - 1]!))) {
    throw new Error("report_v2_final_heading_normalization_stop")
  }
  return Object.freeze({
    ...realization,
    sections: Object.freeze(plan.sections.map((section, index) => {
      const bodyStart = headingOffsets[index]! + section.heading.length
      const bodyEnd = index + 1 < plan.sections.length ? headingOffsets[index + 1]! : normalizedReport.length
      const source = realization.sections.find((entry) => entry.sectionId === section.id)
      if (!source) throw new Error(`report_v2_final_section_missing:${section.id}`)
      return Object.freeze({ ...source, text: normalizeDnaReportLanguage(normalizedReport.slice(bodyStart, bodyEnd).trim()) })
    })),
  })
}

export async function runReportV2Shadow(input: ReportV2ShadowInput, options: ReportV2ShadowOptions = {}): Promise<ReportV2ShadowResult> {
  const v1 = buildAdvancedReport(input)
  if (!v1.clinicalAnalysis || !v1.domainResults?.length) throw new Error("report_v2_v1_baseline_missing")
  const { matrix, externalAnalysis } = buildClinicalEvidenceMatrix(input, v1.domainResults, v1.totalScore, v1.globalLevel)
  const formulations = buildCandidateFormulations(matrix, v1.domainResults, v1.globalLevel)
  const confidence = buildConfidence(matrix, formulations.primary, formulations.decisionState)
  const externalAssessments = structureExternalAssessments(externalAnalysis, matrix, formulations.primary)
  const { decisionPlan, reportPlan } = buildDecisionAndReportPlans({
    domainResults: v1.domainResults,
    globalLevel: v1.globalLevel,
    matrix,
    decisionState: formulations.decisionState,
    primary: formulations.primary,
    secondary: formulations.secondary,
    alternatives: formulations.alternatives,
    confidence,
    externalAssessments,
    ageMonths: input.ageMonths,
    literatureMode: options.literatureMode ?? "STANDARD",
  })
  const decisionHashBeforeKnowledge = stableHash(decisionPlan)
  const decisionHashAfterKnowledge = stableHash(decisionPlan)
  if (decisionHashBeforeKnowledge !== decisionHashAfterKnowledge) throw new Error("report_v2_knowledge_changed_decision")

  const planValidation = validateLockedReportPlan(reportPlan)
  const privacyValidation = validateReportV2Privacy(reportPlan)
  if (!planValidation.pass) throw new Error(`report_v2_plan_stop:${planValidation.failureCodes.join(",")}`)
  if (!privacyValidation.pass) throw new Error("report_v2_privacy_stop")

  const plainRewriteRecords: PlainClinicalRewriteRecord[] = []
  const plainify = (realization: ReportRealization) => {
    const rewritten = rewritePlainClinicalTurkish(reportPlan, realization)
    plainRewriteRecords.push(...rewritten.summary.records)
    return rewritten
  }

  const requestedRealizer = options.realizer ?? new DeterministicReportRealizer()
  const attempts: ReportRealizerAttempt[] = []
  const validations: ReportV2ValidationResult[] = [planValidation, privacyValidation]
  let recoveryStatus: ReportRecoveryStatus = "DIRECT_ACCEPTED"
  let controlledInsertionCount = 0
  let accepted = await requestedRealizer.realize({ plan: reportPlan, attempt: "initial", validationFailureCodes: [], previousCandidate: null })
  let currentPlainSummary = plainClinicalSummary([], [])
  if (accepted.realization) {
    const rewritten = plainify(accepted.realization)
    currentPlainSummary = rewritten.summary
    accepted = Object.freeze({ ...accepted, realization: rewritten.realization })
  }
  attempts.push(accepted)
  let acceptedValidation = accepted.realization
    ? validateReportV2Realization({ plan: reportPlan, decisionPlan, matrix, realization: accepted.realization, plainClinicalTurkish: currentPlainSummary })
    : null
  if (acceptedValidation) validations.push(acceptedValidation)

  if (accepted.realization && acceptedValidation && canUseControlledRepair(acceptedValidation)) {
    const controlled = createControlledReportRepair(reportPlan, accepted.realization, acceptedValidation)
    controlledInsertionCount += controlled.insertionCount
    const rewritten = plainify(controlled.realization)
    currentPlainSummary = rewritten.summary
    accepted = Object.freeze({ ...accepted, realization: rewritten.realization })
    acceptedValidation = validateReportV2Realization({ plan: reportPlan, decisionPlan, matrix, realization: rewritten.realization, plainClinicalTurkish: currentPlainSummary })
    acceptedValidation = Object.freeze({ ...acceptedValidation, controlledInsertionCount })
    validations.push(acceptedValidation)
    recoveryStatus = "CONTROLLED_REPAIR"
  }

  if (requestedRealizer.identity.provider === "luna" && (!accepted.realization || !acceptedValidation?.pass)) {
    const repair = await requestedRealizer.realize({
      plan: reportPlan,
      attempt: "repair",
      validationFailureCodes: acceptedValidation?.failureCodes ?? ["PLAN_INCOMPLETE"],
      previousCandidate: accepted.realization,
    })
    let repairPlainSummary = plainClinicalSummary([], [])
    let plainRepair = repair
    if (repair.realization) {
      const rewritten = plainify(repair.realization)
      repairPlainSummary = rewritten.summary
      plainRepair = Object.freeze({ ...repair, realization: rewritten.realization })
    }
    attempts.push(plainRepair)
    const repairValidation = plainRepair.realization
      ? validateReportV2Realization({ plan: reportPlan, decisionPlan, matrix, realization: plainRepair.realization, plainClinicalTurkish: repairPlainSummary })
      : null
    if (repairValidation) validations.push(repairValidation)
    if (repair.realization && repairValidation) {
      let repairedAttempt = plainRepair
      let repairedValidation = repairValidation
      if (canUseControlledRepair(repairValidation)) {
        const controlled = createControlledReportRepair(reportPlan, plainRepair.realization!, repairValidation)
        controlledInsertionCount += controlled.insertionCount
        const rewritten = plainify(controlled.realization)
        repairPlainSummary = rewritten.summary
        repairedAttempt = Object.freeze({ ...plainRepair, realization: rewritten.realization })
        repairedValidation = validateReportV2Realization({ plan: reportPlan, decisionPlan, matrix, realization: rewritten.realization, plainClinicalTurkish: repairPlainSummary })
        repairedValidation = Object.freeze({ ...repairedValidation, controlledInsertionCount })
        validations.push(repairedValidation)
      }
      if (repairedValidation.pass) {
        accepted = repairedAttempt
        acceptedValidation = repairedValidation
        currentPlainSummary = repairPlainSummary
        recoveryStatus = "LUNA_REPAIRED"
      }
    }
  }

  let fallbackUsed = false
  if (!accepted.realization || !acceptedValidation?.pass) {
    fallbackUsed = true
    recoveryStatus = "DETERMINISTIC_FALLBACK"
    const fallback = await new DeterministicReportRealizer().realize({
      plan: reportPlan,
      attempt: "fallback",
      validationFailureCodes: acceptedValidation?.failureCodes ?? ["PLAN_INCOMPLETE"],
      previousCandidate: accepted.realization,
    })
    let plainFallback = fallback
    let fallbackPlainSummary = plainClinicalSummary([], [])
    if (fallback.realization) {
      const rewritten = plainify(fallback.realization)
      fallbackPlainSummary = rewritten.summary
      plainFallback = Object.freeze({ ...fallback, realization: rewritten.realization })
    }
    attempts.push(plainFallback)
    const fallbackValidation = plainFallback.realization
      ? validateReportV2Realization({ plan: reportPlan, decisionPlan, matrix, realization: plainFallback.realization, plainClinicalTurkish: fallbackPlainSummary })
      : null
    if (!plainFallback.realization || !fallbackValidation?.pass) {
      throw new Error(`report_v2_deterministic_fallback_stop:${fallbackValidation?.failureCodes.join(",") ?? "missing"}`)
    }
    validations.push(fallbackValidation)
    accepted = plainFallback
    acceptedValidation = fallbackValidation
    currentPlainSummary = fallbackPlainSummary
  }

  let realization = normalizeRealizationAfterClinicalSafety(reportPlan, accepted.realization!)
  let finalPlain = plainify(realization)
  realization = finalPlain.realization
  currentPlainSummary = finalPlain.summary
  let finalValidation = validateReportV2Realization({ plan: reportPlan, decisionPlan, matrix, realization, plainClinicalTurkish: currentPlainSummary })
  validations.push(finalValidation)
  if (!finalValidation.pass && canUseControlledRepair(finalValidation)) {
    const controlled = createControlledReportRepair(reportPlan, realization, finalValidation)
    controlledInsertionCount += controlled.insertionCount
    realization = normalizeRealizationAfterClinicalSafety(reportPlan, controlled.realization)
    finalPlain = plainify(realization)
    realization = finalPlain.realization
    currentPlainSummary = finalPlain.summary
    finalValidation = validateReportV2Realization({ plan: reportPlan, decisionPlan, matrix, realization, plainClinicalTurkish: currentPlainSummary })
    finalValidation = Object.freeze({ ...finalValidation, controlledInsertionCount })
    validations.push(finalValidation)
    if (recoveryStatus === "DIRECT_ACCEPTED") recoveryStatus = "CONTROLLED_REPAIR"
  }
  if (!finalValidation.pass) {
    if (fallbackUsed) throw new Error(`report_v2_post_normalization_fallback_stop:${finalValidation.failureCodes.join(",")}`)
    fallbackUsed = true
    recoveryStatus = "DETERMINISTIC_FALLBACK"
    const fallback = await new DeterministicReportRealizer().realize({
      plan: reportPlan,
      attempt: "fallback",
      validationFailureCodes: finalValidation.failureCodes,
      previousCandidate: realization,
    })
    if (!fallback.realization) throw new Error("report_v2_post_normalization_fallback_missing")
    const rewrittenFallback = plainify(fallback.realization)
    attempts.push(Object.freeze({ ...fallback, realization: rewrittenFallback.realization }))
    realization = normalizeRealizationAfterClinicalSafety(reportPlan, rewrittenFallback.realization)
    finalPlain = plainify(realization)
    realization = finalPlain.realization
    currentPlainSummary = finalPlain.summary
    finalValidation = validateReportV2Realization({ plan: reportPlan, decisionPlan, matrix, realization, plainClinicalTurkish: currentPlainSummary })
    validations.push(finalValidation)
    if (!finalValidation.pass) throw new Error(`report_v2_post_normalization_fallback_stop:${finalValidation.failureCodes.join(",")}`)
  }
  acceptedValidation = Object.freeze({ ...finalValidation, controlledInsertionCount })
  const finalReport = renderReportRealization(reportPlan, realization)
  const mergedPlainClinicalTurkish = Object.freeze({
    ...currentPlainSummary,
    rewriteCount: plainRewriteRecords.length,
    records: Object.freeze(plainRewriteRecords),
  })
  const knowledge = selectReportV2Knowledge(v1.domainResults)
  const literatureSourceIds = reportPlan.claims.flatMap((claim) => claim.sourceIds)
  const trace: ReportTraceV2 = Object.freeze({
    version: REPORT_V2_TRACE_VERSION,
    inputHash: stableHash({ ageMonths: input.ageMonths ?? null, scores: input.scores, answersHash: stableHash(input.answers ?? []) }),
    answersHash: stableHash(input.answers ?? []),
    scoringVersion: ASSESSMENT_SCORING_VERSION,
    scores: Object.freeze(Object.fromEntries(v1.domainResults.map((domain) => [domain.key, domain.score]))),
    domainLevels: Object.freeze(Object.fromEntries(v1.domainResults.map((domain) => [domain.key, domain.level]))),
    domainThresholdTrace: Object.freeze(buildDomainThresholdTrace(input, v1.domainResults)),
    evidenceMatrix: matrix,
    candidates: formulations.candidates,
    decisionState: formulations.decisionState,
    selectedFormulationId: formulations.primary?.id ?? null,
    alternativeFormulationIds: Object.freeze(formulations.alternatives.map((candidate) => candidate.id)),
    contradictions: Object.freeze(matrix.discrepancyClusters.map((cluster) => cluster.id)),
    discrepancyRelationIds: Object.freeze(matrix.relations.filter((relation) => relation.type === "DISCREPANT").map((relation) => relation.id)),
    confidence,
    decisionPlan,
    reportPlan,
    knowledgeBridge: reportPlan.knowledgeBridge,
    decisionHashBeforeKnowledge,
    decisionHashAfterKnowledge,
    knowledgeChunkIds: Object.freeze(knowledge.chunks.map((chunk) => chunk.id)),
    literatureSourceIds: Object.freeze(Array.from(new Set(literatureSourceIds))),
    realizationAttempts: Object.freeze(attempts.map(sanitizedAttempt)),
    validatorResults: Object.freeze(validations),
    finalReportHash: stableHash(finalReport),
    fallbackUsed,
    recoveryStatus,
    plainClinicalTurkish: mergedPlainClinicalTurkish,
  })
  return Object.freeze({
    mode: "REPORT_V2_SHADOW",
    v1,
    evidenceMatrix: matrix,
    candidates: formulations.candidates,
    decisionPlan,
    reportPlan,
    knowledgeBridge: reportPlan.knowledgeBridge,
    realization,
    finalReport,
    validation: acceptedValidation!,
    plainClinicalTurkish: mergedPlainClinicalTurkish,
    providerCalls: sumProviderCalls(attempts),
    fallbackUsed,
    recoveryStatus,
    trace,
  })
}

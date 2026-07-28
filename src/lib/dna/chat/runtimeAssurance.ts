import { inspectDnaChatQuestionStructure } from "./engine"
import type { DnaChatRuntimeAnswer } from "./runtimeAnswer"
import { splitDnaV3Subquestions } from "./v3RetrievalCore"

export const DNA_CHAT_RUNTIME_ASSURANCE_VERSION =
  "dna-chat-runtime-assurance@1" as const

export type DnaChatAssuranceStage = "pre_flight" | "selection" | "output"

export type DnaChatAssuranceIssueCode =
  | "question_contract_invalid"
  | "question_overflow_not_bounded"
  | "response_disposition_mismatch"
  | "response_summary_missing"
  | "internal_source_link_missing"
  | "internal_source_unknown"
  | "internal_evidence_link_missing"
  | "public_response_invalid"
  | "public_source_link_missing"
  | "public_source_unknown"
  | "public_citation_card_missing"
  | "compound_internal_section_missing"
  | "compound_public_section_missing"
  | "forbidden_public_field"

export type DnaChatAssuranceIssue = Readonly<{
  stage: DnaChatAssuranceStage
  code: DnaChatAssuranceIssueCode
}>

export type DnaChatRuntimeAssuranceReport = Readonly<{
  version: typeof DNA_CHAT_RUNTIME_ASSURANCE_VERSION
  allowed: boolean
  stages: Readonly<Record<DnaChatAssuranceStage, "passed" | "failed">>
  issues: readonly DnaChatAssuranceIssue[]
  metrics: Readonly<{
    subquestionCount: 1 | 2
    internalAnswerUnitCount: number
    publicAnswerUnitCount: number
    factualUnitCount: number
    sourceBoundFactualUnitCount: number
    sourceRequiredUnitCount: number
    sourceBindingCoveragePercent: number
  }>
}>

type UnknownRecord = Record<string, unknown>

const FACTUAL_ROLES = new Set([
  "product_definition",
  "scientific_evidence",
  "dna_specific_validation",
  "case_finding",
])

const SOURCE_REQUIRED_ROLES = new Set([
  "scientific_evidence",
  "dna_specific_validation",
])

const FORBIDDEN_PUBLIC_FIELDS = new Set([
  "anamnez",
  "answers",
  "audit_trail",
  "raw_answers",
  "rule_id",
  "ruleid",
  "snapshot",
  "snapshot_json",
  "trace",
])

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => String(entry || "").trim()).filter(Boolean)
    : []
}

function publicRecords(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function addIssue(
  issues: DnaChatAssuranceIssue[],
  stage: DnaChatAssuranceStage,
  code: DnaChatAssuranceIssueCode,
) {
  if (!issues.some((issue) => issue.stage === stage && issue.code === code)) {
    issues.push(Object.freeze({ stage, code }))
  }
}

function containsForbiddenPublicField(value: unknown, depth = 0): boolean {
  if (depth > 10 || value === null || value === undefined) return false
  if (Array.isArray(value)) {
    return value.some((entry) => containsForbiddenPublicField(entry, depth + 1))
  }
  if (!isRecord(value)) return false
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_PUBLIC_FIELDS.has(key.toLocaleLowerCase("en-US"))) return true
    if (containsForbiddenPublicField(nested, depth + 1)) return true
  }
  return false
}

function responseDispositionIsConsistent(runtimeAnswer: DnaChatRuntimeAnswer): boolean {
  if (runtimeAnswer.generation === "v3") {
    const { status, classification } = runtimeAnswer.answer
    if (status === "refusal") return classification === "refusal"
    if (status === "not_available") return classification === "not_available"
    if (status === "clarification") return classification === "clarification"
    return !["refusal", "not_available"].includes(classification)
  }
  const { outcome, classification } = runtimeAnswer.answer
  if (outcome === "refused") return classification === "refusal"
  if (outcome === "not_available") return classification === "not_available"
  if (outcome === "clarification") return classification === "clarification"
  return classification !== "refusal" && classification !== "not_available"
}

function questionStructure(question: string, runtimeAnswer: DnaChatRuntimeAnswer) {
  if (runtimeAnswer.generation === "v2_legacy") {
    return inspectDnaChatQuestionStructure(question)
  }
  const split = splitDnaV3Subquestions(question)
  return Object.freeze({
    subquestionCount: split.questions.length === 2 ? 2 as const : 1 as const,
    overflow: split.exceedsLimit,
  })
}

export function evaluateDnaChatRuntimeAssurance(input: Readonly<{
  question: string
  runtimeAnswer: DnaChatRuntimeAnswer
  publicBody: Record<string, unknown>
}>): DnaChatRuntimeAssuranceReport {
  const issues: DnaChatAssuranceIssue[] = []
  const question = String(input.question || "").trim()
  const structure = questionStructure(question, input.runtimeAnswer)
  const internalAnswer = input.runtimeAnswer.answer
  const internalUnits = [...internalAnswer.answerUnits]

  if (question.length < 2 || question.length > 600) {
    addIssue(issues, "pre_flight", "question_contract_invalid")
  }
  const isBoundedOverflow = input.runtimeAnswer.generation === "v3"
    ? ["clarification", "refusal"].includes(input.runtimeAnswer.answer.status)
    : ["clarification", "refused"].includes(input.runtimeAnswer.answer.outcome)
  if (structure.overflow && !isBoundedOverflow) {
    addIssue(issues, "pre_flight", "question_overflow_not_bounded")
  }

  if (!responseDispositionIsConsistent(input.runtimeAnswer)) {
    addIssue(issues, "selection", "response_disposition_mismatch")
  }
  if (!String(internalAnswer.summary || "").trim()) {
    addIssue(issues, "selection", "response_summary_missing")
  }

  const internalSourceIds = new Set(input.runtimeAnswer.generation === "v3"
    ? input.runtimeAnswer.answer.sources.map((source) => source.sourceId)
    : input.runtimeAnswer.answer.sources.map((source) => source.id))
  const isAnswering = input.runtimeAnswer.generation === "v3"
    ? input.runtimeAnswer.answer.status === "answer"
    : input.runtimeAnswer.answer.outcome === "answered"
  let factualUnitCount = 0
  let sourceBoundFactualUnitCount = 0
  let sourceRequiredUnitCount = 0
  if (input.runtimeAnswer.generation === "v3") {
    for (const unit of input.runtimeAnswer.answer.answerUnits) {
      const role = unit.authority === "dna_product"
        ? "product_definition"
        : unit.authority === "external_science"
          ? "scientific_evidence"
          : unit.authority === "case_report"
            ? "case_finding"
            : "safety_boundary"
      if (!FACTUAL_ROLES.has(role)) continue
      factualUnitCount += 1
      if (isAnswering && SOURCE_REQUIRED_ROLES.has(role)) {
        sourceRequiredUnitCount += 1
        if (!unit.sourceIds.length) {
          addIssue(issues, "selection", "internal_source_link_missing")
        } else {
          sourceBoundFactualUnitCount += 1
        }
        if (unit.sourceIds.some((sourceId) => !internalSourceIds.has(sourceId))) {
          addIssue(issues, "selection", "internal_source_unknown")
        }
      }
      if (
        (unit.authority === "dna_product" || unit.authority === "external_science") &&
        (!unit.claimIds.length || !unit.passageIds.length)
      ) {
        addIssue(issues, "selection", "internal_evidence_link_missing")
      }
      if (unit.authority === "case_report" && !unit.caseFieldIds.length) {
        addIssue(issues, "selection", "internal_evidence_link_missing")
      }
    }
  } else {
    for (const unit of input.runtimeAnswer.answer.answerUnits) {
      if (!FACTUAL_ROLES.has(unit.role)) continue
      factualUnitCount += 1
      if (isAnswering && SOURCE_REQUIRED_ROLES.has(unit.role)) {
        sourceRequiredUnitCount += 1
        if (unit.authority.releaseEligible && !unit.sourceIds.length) {
          addIssue(issues, "selection", "internal_source_link_missing")
        } else {
          sourceBoundFactualUnitCount += Number(unit.sourceIds.length > 0)
        }
        if (unit.sourceIds.some((sourceId) => !internalSourceIds.has(sourceId))) {
          addIssue(issues, "selection", "internal_source_unknown")
        }
      }
    }
  }

  if (structure.subquestionCount === 2 && input.runtimeAnswer.generation === "v2_legacy") {
    const ids = new Set(internalUnits.map((unit) => unit.id))
    if (!ids.has("response-1-summary") || !ids.has("response-2-summary")) {
      addIssue(issues, "selection", "compound_internal_section_missing")
    }
  }

  if (input.publicBody.ok !== true || !String(input.publicBody.summary || "").trim()) {
    addIssue(issues, "output", "public_response_invalid")
  }
  if (containsForbiddenPublicField(input.publicBody)) {
    addIssue(issues, "output", "forbidden_public_field")
  }

  const publicUnits = publicRecords(input.publicBody.answerUnits)
  const publicSources = publicRecords(input.publicBody.sources)
  const publicSourceIds = new Set(publicSources.flatMap((source) => [
    String(source.id || "").trim(),
    String(source.sourceId || "").trim(),
  ]).filter(Boolean))
  const publicCardIds = new Set(publicSources.map((source) => String(source.id || "").trim()).filter(Boolean))
  for (const unit of publicUnits) {
    const role = String(unit.role || "")
    if (!FACTUAL_ROLES.has(role)) continue
    const sourceIds = stringArray(unit.sourceIds)
    if (isAnswering && SOURCE_REQUIRED_ROLES.has(role)) {
      if (input.runtimeAnswer.generation === "v3" && !sourceIds.length) {
        addIssue(issues, "output", "public_source_link_missing")
      }
      if (sourceIds.some((sourceId) => !publicSourceIds.has(sourceId))) {
        addIssue(issues, "output", "public_source_unknown")
      }
    }
    if (input.runtimeAnswer.generation === "v3" && [
      "product_definition",
      "scientific_evidence",
      "dna_specific_validation",
    ].includes(role)) {
      const citationCardIds = stringArray(unit.citationCardIds)
      if (!citationCardIds.length || citationCardIds.some((cardId) => !publicCardIds.has(cardId))) {
        addIssue(issues, "output", "public_citation_card_missing")
      }
    }
  }

  if (structure.subquestionCount === 2 && input.runtimeAnswer.generation === "v2_legacy") {
    const publicIds = new Set(publicUnits.map((unit) => String(unit.id || "")))
    if (!publicIds.has("response-1-summary") || !publicIds.has("response-2-summary")) {
      addIssue(issues, "output", "compound_public_section_missing")
    }
  }

  const stageStatus = (stage: DnaChatAssuranceStage) =>
    issues.some((issue) => issue.stage === stage) ? "failed" as const : "passed" as const
  const sourceBindingCoveragePercent = sourceRequiredUnitCount === 0
    ? 100
    : Number(((sourceBoundFactualUnitCount / sourceRequiredUnitCount) * 100).toFixed(2))
  return Object.freeze({
    version: DNA_CHAT_RUNTIME_ASSURANCE_VERSION,
    allowed: issues.length === 0,
    stages: Object.freeze({
      pre_flight: stageStatus("pre_flight"),
      selection: stageStatus("selection"),
      output: stageStatus("output"),
    }),
    issues: Object.freeze(issues),
    metrics: Object.freeze({
      subquestionCount: structure.subquestionCount,
      internalAnswerUnitCount: internalUnits.length,
      publicAnswerUnitCount: publicUnits.length,
      factualUnitCount,
      sourceBoundFactualUnitCount,
      sourceRequiredUnitCount,
      sourceBindingCoveragePercent,
    }),
  })
}

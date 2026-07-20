import { createHash } from "node:crypto"

import type { DnaIntegrityImpactResult } from "../governance/sourceIntegrity"

export const DNA_SOURCE_MONITORING_VERSION = "dna-source-monitoring@1" as const

export const DNA_SOURCE_MONITORING_EVENT_TYPES = Object.freeze([
  "scheduled_major_catalog_review",
  "retraction",
  "correction",
  "expression_of_concern",
  "license_change",
  "new_consensus_or_guideline",
  "superseded",
] as const)

export type DnaSourceMonitoringEventType = (typeof DNA_SOURCE_MONITORING_EVENT_TYPES)[number]

export type DnaSourceMonitoringEvent = Readonly<{
  eventId: string
  eventType: DnaSourceMonitoringEventType
  sourceId: string
  detectedAt: string
  evidenceArtifactId: string
  executionStatus: "observed" | "synthetic_test"
}>

export type DnaSourceMonitoringDependencyInput = Readonly<{
  impact: DnaIntegrityImpactResult
  affectedBenchmarkQuestionIds: readonly string[]
  affectedMarketingClaimIds: readonly string[]
  hasReleasedSafeAlternative: boolean
}>

export type DnaSourceMonitoringAction = Readonly<{
  action:
    | "quarantine_source"
    | "quarantine_passages_and_claims"
    | "exclude_from_runtime_pack"
    | "switch_unsupported_answers_to_not_available"
    | "rerun_affected_benchmarks"
    | "suspend_affected_marketing_claims"
    | "recompile_release_package"
    | "review_correction_and_reextract"
    | "review_license_components"
    | "review_consensus_gap"
  required: boolean
  evidenceRequiredBeforeCompletion: true
}>

export type DnaSourceMonitoringWorkflow = Readonly<{
  schemaVersion: typeof DNA_SOURCE_MONITORING_VERSION
  eventId: string
  sourceId: string
  eventType: DnaSourceMonitoringEventType
  releaseDisposition: "no_go" | "recompile_required"
  affectedPassageIds: readonly string[]
  affectedClaimIds: readonly string[]
  affectedRelationIds: readonly string[]
  affectedAnswerIds: readonly string[]
  affectedBenchmarkQuestionIds: readonly string[]
  affectedMarketingClaimIds: readonly string[]
  actions: readonly DnaSourceMonitoringAction[]
  completionState: "actions_pending"
  workflowSha256: string
}>

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) =>
    `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex")
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values.filter(Boolean))].sort())
}

function action(actionName: DnaSourceMonitoringAction["action"]): DnaSourceMonitoringAction {
  return Object.freeze({ action: actionName, required: true, evidenceRequiredBeforeCompletion: true })
}

/**
 * Builds a propagation plan; it never marks an online check or remediation as
 * completed. Completion requires a separate, evidence-bound release package.
 */
export function compileDnaSourceMonitoringWorkflow(input: Readonly<{
  event: DnaSourceMonitoringEvent
  dependencies: DnaSourceMonitoringDependencyInput
}>): DnaSourceMonitoringWorkflow {
  if (!DNA_SOURCE_MONITORING_EVENT_TYPES.includes(input.event.eventType)) {
    throw new Error("dna_source_monitoring_event_type_invalid")
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{0,159}$/.test(input.event.eventId)
    || !/^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{0,159}$/.test(input.event.sourceId)
    || !/^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{0,159}$/.test(input.event.evidenceArtifactId)) {
    throw new Error("dna_source_monitoring_identifier_invalid")
  }
  if (!Number.isFinite(Date.parse(input.event.detectedAt))) {
    throw new Error("dna_source_monitoring_date_invalid")
  }
  if (!input.dependencies.impact.valid) {
    throw new Error("dna_source_monitoring_impact_graph_invalid")
  }
  if (!input.dependencies.impact.affectedSourceIds.includes(input.event.sourceId)
    && input.event.eventType !== "scheduled_major_catalog_review"
    && input.event.eventType !== "new_consensus_or_guideline") {
    throw new Error("dna_source_monitoring_source_not_bound_to_impact")
  }

  const actions: DnaSourceMonitoringAction[] = []
  const integrityEvent = new Set<DnaSourceMonitoringEventType>([
    "retraction",
    "correction",
    "expression_of_concern",
    "superseded",
  ]).has(input.event.eventType)
  if (integrityEvent || input.event.eventType === "license_change") {
    actions.push(action("quarantine_source"))
    actions.push(action("quarantine_passages_and_claims"))
    actions.push(action("exclude_from_runtime_pack"))
    if (!input.dependencies.hasReleasedSafeAlternative) {
      actions.push(action("switch_unsupported_answers_to_not_available"))
    }
  }
  if (input.event.eventType === "correction") actions.push(action("review_correction_and_reextract"))
  if (input.event.eventType === "license_change") actions.push(action("review_license_components"))
  if (input.event.eventType === "new_consensus_or_guideline") actions.push(action("review_consensus_gap"))
  actions.push(action("rerun_affected_benchmarks"))
  actions.push(action("suspend_affected_marketing_claims"))
  actions.push(action("recompile_release_package"))

  const body = {
    schemaVersion: DNA_SOURCE_MONITORING_VERSION,
    eventId: input.event.eventId,
    sourceId: input.event.sourceId,
    eventType: input.event.eventType,
    releaseDisposition: integrityEvent || input.event.eventType === "license_change"
      ? "no_go" as const
      : "recompile_required" as const,
    affectedPassageIds: sortedUnique(input.dependencies.impact.affectedPassageIds),
    affectedClaimIds: sortedUnique(input.dependencies.impact.affectedClaimIds),
    affectedRelationIds: sortedUnique(input.dependencies.impact.affectedRelationIds),
    affectedAnswerIds: sortedUnique(input.dependencies.impact.answers
      .filter((answer) => answer.state !== "unaffected")
      .map((answer) => answer.answerId)),
    affectedBenchmarkQuestionIds: sortedUnique(input.dependencies.affectedBenchmarkQuestionIds),
    affectedMarketingClaimIds: sortedUnique(input.dependencies.affectedMarketingClaimIds),
    actions: Object.freeze(actions),
    completionState: "actions_pending" as const,
  }
  return Object.freeze({ ...body, workflowSha256: sha256(body) })
}

export const DNA_SOURCE_MONITORING_REQUIRED_CHECKS = Object.freeze([
  "doi_identity",
  "retraction",
  "correction",
  "expression_of_concern",
  "license_change",
  "new_consensus_or_guideline",
  "superseded_work",
  "claim_dependencies",
] as const)

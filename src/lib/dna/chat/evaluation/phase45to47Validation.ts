export const DNA_PHASE_45_VALIDATION_VERSION =
  "dna-phase-45-privacy-validation@1" as const
export const DNA_PHASE_46_VALIDATION_VERSION =
  "dna-phase-46-determinism-performance@1" as const
export const DNA_PHASE_47_VALIDATION_VERSION =
  "dna-phase-47-ux-study@1" as const

export type DnaValidationStatus = "pass" | "fail" | "not_ready"

export const DNA_PHASE_45_EVIDENCE_SCOPES = Object.freeze([
  "local_contract",
  "preview_synthetic",
  "production_synthetic",
  "database_instrumentation",
] as const)

export type DnaPhase45EvidenceScope =
  (typeof DNA_PHASE_45_EVIDENCE_SCOPES)[number]

export const DNA_PHASE_45_ATTACK_MATRIX = Object.freeze([
  {
    id: "therapist_a_requests_therapist_b_report",
    category: "cross_account",
    minimumScope: "production_synthetic",
  },
  {
    id: "therapist_b_requests_therapist_a_report",
    category: "cross_account",
    minimumScope: "production_synthetic",
  },
  {
    id: "admin_role_requests_foreign_report",
    category: "cross_account",
    minimumScope: "production_synthetic",
  },
  {
    id: "owner_role_requests_foreign_report",
    category: "cross_account",
    minimumScope: "production_synthetic",
  },
  {
    id: "random_foreign_uuid",
    category: "enumeration",
    minimumScope: "production_synthetic",
  },
  {
    id: "bounded_uuid_enumeration",
    category: "enumeration",
    minimumScope: "production_synthetic",
  },
  {
    id: "query_parameter_report_injection",
    category: "transport",
    minimumScope: "production_synthetic",
  },
  {
    id: "direct_post_api_foreign_report",
    category: "transport",
    minimumScope: "production_synthetic",
  },
  {
    id: "direct_get_report_list",
    category: "transport",
    minimumScope: "production_synthetic",
  },
  {
    id: "cache_replay_foreign_response",
    category: "cache",
    minimumScope: "production_synthetic",
  },
  {
    id: "concurrent_foreign_requests",
    category: "concurrency",
    minimumScope: "production_synthetic",
  },
  {
    id: "expired_session_foreign_request",
    category: "session",
    minimumScope: "production_synthetic",
  },
  {
    id: "case_audit_write_failure",
    category: "audit",
    minimumScope: "preview_synthetic",
  },
  {
    id: "rls_foreign_report_read",
    category: "database",
    minimumScope: "database_instrumentation",
  },
  {
    id: "ownership_query_chain_foreign_report",
    category: "query_layer",
    minimumScope: "database_instrumentation",
  },
  {
    id: "audit_and_telemetry_content_minimization",
    category: "telemetry",
    minimumScope: "preview_synthetic",
  },
] as const satisfies readonly Readonly<{
  id: string
  category: string
  minimumScope: DnaPhase45EvidenceScope
}>[])

export type DnaPhase45ScenarioId =
  (typeof DNA_PHASE_45_ATTACK_MATRIX)[number]["id"]

export type DnaPhase45Observation = Readonly<{
  scenarioId: DnaPhase45ScenarioId
  scope: DnaPhase45EvidenceScope
  status: Exclude<DnaValidationStatus, "not_ready">
  attempts: number
  leakCount: number
  foreignMissingEquivalent?: boolean
  auditFailOpenCount?: number
  forbiddenTelemetryContentCount?: number
  artifactSha256: string
}>

function isSha256(value: string) {
  return /^[a-f0-9]{64}$/.test(value)
}

function unique(values: readonly string[]) {
  return [...new Set(values)]
}

export function evaluateDnaPhase45PrivacyGate(
  observations: readonly DnaPhase45Observation[],
): Readonly<{
  version: typeof DNA_PHASE_45_VALIDATION_VERSION
  status: DnaValidationStatus
  attemptedRequests: number
  crossAccountAttempts: number
  leakCount: number
  auditFailOpenCount: number
  forbiddenTelemetryContentCount: number
  blockerCodes: readonly string[]
  allowedMarketingStatement: string | null
}> {
  const expected = new Map(DNA_PHASE_45_ATTACK_MATRIX.map((row) => [row.id, row]))
  const seen = new Set<string>()
  const blockers: string[] = []
  let attemptedRequests = 0
  let crossAccountAttempts = 0
  let leakCount = 0
  let auditFailOpenCount = 0
  let forbiddenTelemetryContentCount = 0

  for (const observation of observations) {
    const contract = expected.get(observation.scenarioId)
    if (!contract) {
      blockers.push("phase45_unknown_scenario")
      continue
    }
    if (seen.has(observation.scenarioId)) {
      blockers.push(`phase45_duplicate_scenario:${observation.scenarioId}`)
      continue
    }
    seen.add(observation.scenarioId)
    if (!Number.isInteger(observation.attempts) || observation.attempts < 1) {
      blockers.push(`phase45_attempt_count_invalid:${observation.scenarioId}`)
    }
    if (!isSha256(observation.artifactSha256)) {
      blockers.push(`phase45_artifact_hash_invalid:${observation.scenarioId}`)
    }
    // These scopes are orthogonal evidence environments, not an ordinal
    // ladder. A database-instrumented query cannot substitute for the required
    // production black-box request, and vice versa.
    if (observation.scope !== contract.minimumScope) {
      blockers.push(`phase45_evidence_scope_insufficient:${observation.scenarioId}`)
    }
    if (observation.status !== "pass") {
      blockers.push(`phase45_scenario_failed:${observation.scenarioId}`)
    }
    if (!Number.isInteger(observation.leakCount) || observation.leakCount < 0) {
      blockers.push(`phase45_leak_count_invalid:${observation.scenarioId}`)
    }

    attemptedRequests += Math.max(0, observation.attempts || 0)
    if (contract.category === "cross_account" || contract.category === "enumeration") {
      crossAccountAttempts += Math.max(0, observation.attempts || 0)
    }
    leakCount += Math.max(0, observation.leakCount || 0)
    auditFailOpenCount += Math.max(0, observation.auditFailOpenCount || 0)
    forbiddenTelemetryContentCount += Math.max(
      0,
      observation.forbiddenTelemetryContentCount || 0,
    )

    if (
      observation.scenarioId === "random_foreign_uuid" &&
      observation.foreignMissingEquivalent !== true
    ) {
      blockers.push("phase45_foreign_missing_distinguishability")
    }
    if (
      observation.scenarioId === "case_audit_write_failure" &&
      observation.auditFailOpenCount !== 0
    ) {
      blockers.push("phase45_audit_fail_open")
    }
    if (
      observation.scenarioId === "audit_and_telemetry_content_minimization" &&
      observation.forbiddenTelemetryContentCount !== 0
    ) {
      blockers.push("phase45_forbidden_telemetry_content")
    }
  }

  for (const scenario of DNA_PHASE_45_ATTACK_MATRIX) {
    if (!seen.has(scenario.id)) blockers.push(`phase45_scenario_missing:${scenario.id}`)
  }
  if (leakCount !== 0) blockers.push("phase45_cross_account_leak_observed")
  if (auditFailOpenCount !== 0) blockers.push("phase45_audit_fail_open")
  if (forbiddenTelemetryContentCount !== 0) {
    blockers.push("phase45_forbidden_telemetry_content")
  }

  const blockerCodes = unique(blockers).sort()
  const hasFailure = blockerCodes.some((code) =>
    code.includes("failed") ||
    code.includes("leak_observed") ||
    code.includes("fail_open") ||
    code.includes("forbidden_telemetry") ||
    code.includes("distinguishability"),
  )
  const status: DnaValidationStatus = blockerCodes.length === 0
    ? "pass"
    : hasFailure
      ? "fail"
      : "not_ready"
  return Object.freeze({
    version: DNA_PHASE_45_VALIDATION_VERSION,
    status,
    attemptedRequests,
    crossAccountAttempts,
    leakCount,
    auditFailOpenCount,
    forbiddenTelemetryContentCount,
    blockerCodes: Object.freeze(blockerCodes),
    allowedMarketingStatement: status === "pass"
      ? `Belirtilen ${crossAccountAttempts} sentetik çapraz hesap denemesinde 0 sızıntı gözlendi.`
      : null,
  })
}

export type DnaPhase46PerformanceObservation = Readonly<{
  artifactSha256: string
  repeatRuns: number
  distinctOutputHashes: number
  catalogOrderStable: boolean
  sourceOrderStable: boolean
  coldStartExercised: boolean
  warmStartExercised: boolean
  engineP95Ms: number
  mockApiP95Ms: number
  productionApi?: Readonly<{
    environment: "preview" | "production"
    p95Ms: number
    p99Ms: number
    sampleCount: number
    artifactSha256: string
  }> | null
  deepResponseMaxBytes: number
  requestBoundary: Readonly<{
    twoCharactersAccepted: boolean
    belowTwoCharactersRejected: boolean
    sixHundredCharactersAccepted: boolean
    aboveSixHundredCharactersRejected: boolean
    nearEightKbRead: boolean
    aboveEightKbRejected: boolean
  }>
  concurrency: Readonly<{
    requestCount: number
    failureCount: number
    deterministic: boolean
  }>
  rateLimit: Readonly<{
    burstLimitEnforced: boolean
    hourlyLimitEnforced: boolean
    retryAfterPresent: boolean
  }>
  errorInjection: Readonly<{
    databaseFailureClosed: boolean
    caseAuditFailureClosedWith503: boolean
  }>
  forbiddenRuntimeImportCount: number
}>

export function evaluateDnaPhase46PerformanceGate(
  observation: DnaPhase46PerformanceObservation | null,
): Readonly<{
  version: typeof DNA_PHASE_46_VALIDATION_VERSION
  localStatus: DnaValidationStatus
  productionReportingStatus: DnaValidationStatus
  releaseStatus: DnaValidationStatus
  blockerCodes: readonly string[]
}> {
  if (!observation) {
    return Object.freeze({
      version: DNA_PHASE_46_VALIDATION_VERSION,
      localStatus: "not_ready",
      productionReportingStatus: "not_ready",
      releaseStatus: "not_ready",
      blockerCodes: Object.freeze(["phase46_observation_missing"]),
    })
  }
  const blockers: string[] = []
  if (!isSha256(observation.artifactSha256)) blockers.push("phase46_artifact_hash_invalid")
  if (observation.repeatRuns < 20 || observation.distinctOutputHashes !== 1) {
    blockers.push("phase46_determinism_below_100_percent")
  }
  if (!observation.catalogOrderStable) blockers.push("phase46_catalog_order_instability")
  if (!observation.sourceOrderStable) blockers.push("phase46_source_order_instability")
  if (!observation.coldStartExercised || !observation.warmStartExercised) {
    blockers.push("phase46_cold_warm_coverage_missing")
  }
  if (!(observation.engineP95Ms < 25)) blockers.push("phase46_engine_p95_exceeded")
  if (!(observation.mockApiP95Ms < 1_000)) blockers.push("phase46_mock_api_p95_exceeded")
  if (!(observation.deepResponseMaxBytes < 64 * 1024)) {
    blockers.push("phase46_deep_response_64kb_exceeded")
  }
  if (!Object.values(observation.requestBoundary).every(Boolean)) {
    blockers.push("phase46_request_boundary_incomplete")
  }
  if (
    observation.concurrency.requestCount < 32 ||
    observation.concurrency.failureCount !== 0 ||
    !observation.concurrency.deterministic
  ) {
    blockers.push("phase46_concurrency_gate_failed")
  }
  if (!Object.values(observation.rateLimit).every(Boolean)) {
    blockers.push("phase46_rate_limit_gate_failed")
  }
  if (!Object.values(observation.errorInjection).every(Boolean)) {
    blockers.push("phase46_error_injection_gate_failed")
  }
  if (observation.forbiddenRuntimeImportCount !== 0) {
    blockers.push("phase46_forbidden_runtime_import")
  }
  const localBlockers = unique(blockers).sort()
  const localStatus: DnaValidationStatus = localBlockers.length ? "fail" : "pass"

  const production = observation.productionApi
  const productionReported = Boolean(
    production &&
    production.environment === "production" &&
    production.sampleCount >= 100 &&
    production.p95Ms > 0 &&
    production.p99Ms >= production.p95Ms &&
    isSha256(production.artifactSha256),
  )
  const productionReportingStatus: DnaValidationStatus = productionReported
    ? "pass"
    : "not_ready"
  if (!productionReported) localBlockers.push("phase46_production_p95_p99_missing")

  return Object.freeze({
    version: DNA_PHASE_46_VALIDATION_VERSION,
    localStatus,
    productionReportingStatus,
    releaseStatus: localStatus === "pass" && productionReportingStatus === "pass"
      ? "pass"
      : localStatus === "fail"
        ? "fail"
        : "not_ready",
    blockerCodes: Object.freeze(unique(localBlockers).sort()),
  })
}

export const DNA_PHASE_47_AUTOMATED_TASKS = Object.freeze([
  "selected_report_is_visible",
  "wrong_report_can_be_changed",
  "source_card_maps_to_claim",
  "report_absence_differs_from_science_unknown",
  "not_available_explains_product_boundary",
  "evidence_level_calibrates_confidence",
  "critical_warning_remains_visible",
  "mobile_and_keyboard_completion",
] as const)

export type DnaPhase47AutomatedTask =
  (typeof DNA_PHASE_47_AUTOMATED_TASKS)[number]

export type DnaPhase47AutomationObservation = Readonly<{
  artifactSha256: string
  taskResults: Readonly<Record<DnaPhase47AutomatedTask, boolean>>
}>

export type DnaPhase47HumanStudyAggregate = Readonly<{
  protocolVersion: typeof DNA_PHASE_47_VALIDATION_VERSION
  evidenceScope: "real_therapist_usability_study"
  artifactSha256: string
  participantCount: number
  intendedUserParticipantCount: number
  taskAttempts: number
  successfulTaskAttempts: number
  productBoundaryExplanations: number
  correctProductBoundaryExplanations: number
  criticalWarningOpportunities: number
  criticalWarningMisses: number
  mobileTaskParticipants: number
  keyboardOnlyTaskParticipants: number
  containsRealClinicalContent: false
}>

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0
}

export function evaluateDnaPhase47UxGate(input: Readonly<{
  automation: DnaPhase47AutomationObservation | null
  humanStudy: DnaPhase47HumanStudyAggregate | null
}>): Readonly<{
  version: typeof DNA_PHASE_47_VALIDATION_VERSION
  automationStatus: DnaValidationStatus
  humanStudyStatus: DnaValidationStatus
  releaseStatus: DnaValidationStatus
  taskSuccessRate: number | null
  productBoundaryAccuracy: number | null
  criticalWarningMisses: number | null
  clinicalBenefitMarketingClaimAllowed: false
  blockerCodes: readonly string[]
}> {
  const blockers: string[] = []
  let automationStatus: DnaValidationStatus = "not_ready"
  if (input.automation) {
    const allAutomated = DNA_PHASE_47_AUTOMATED_TASKS.every(
      (task) => input.automation?.taskResults[task] === true,
    )
    if (!isSha256(input.automation.artifactSha256)) {
      blockers.push("phase47_automation_artifact_hash_invalid")
    }
    if (!allAutomated) blockers.push("phase47_automation_task_failed")
    automationStatus = allAutomated && isSha256(input.automation.artifactSha256)
      ? "pass"
      : "fail"
  } else {
    blockers.push("phase47_automation_missing")
  }

  let humanStudyStatus: DnaValidationStatus = "not_ready"
  let taskSuccessRate: number | null = null
  let productBoundaryAccuracy: number | null = null
  let criticalWarningMisses: number | null = null
  if (!input.humanStudy) {
    blockers.push("phase47_real_therapist_study_missing")
  } else {
    const study = input.humanStudy
    taskSuccessRate = ratio(study.successfulTaskAttempts, study.taskAttempts)
    productBoundaryAccuracy = ratio(
      study.correctProductBoundaryExplanations,
      study.productBoundaryExplanations,
    )
    criticalWarningMisses = study.criticalWarningMisses
    const studyBlockers: string[] = []
    if (
      study.protocolVersion !== DNA_PHASE_47_VALIDATION_VERSION ||
      study.evidenceScope !== "real_therapist_usability_study" ||
      study.containsRealClinicalContent !== false
    ) studyBlockers.push("phase47_study_contract_invalid")
    if (!isSha256(study.artifactSha256)) studyBlockers.push("phase47_study_artifact_hash_invalid")
    if (
      ![
        study.participantCount,
        study.intendedUserParticipantCount,
        study.taskAttempts,
        study.successfulTaskAttempts,
        study.productBoundaryExplanations,
        study.correctProductBoundaryExplanations,
        study.criticalWarningOpportunities,
        study.criticalWarningMisses,
        study.mobileTaskParticipants,
        study.keyboardOnlyTaskParticipants,
      ].every((value) => Number.isInteger(value) && value >= 0) ||
      study.successfulTaskAttempts > study.taskAttempts ||
      study.correctProductBoundaryExplanations > study.productBoundaryExplanations ||
      study.criticalWarningMisses > study.criticalWarningOpportunities
    ) studyBlockers.push("phase47_study_counts_invalid")
    if (
      study.participantCount < 12 ||
      study.intendedUserParticipantCount !== study.participantCount
    ) studyBlockers.push("phase47_intended_user_sample_insufficient")
    if (study.taskAttempts < study.participantCount * DNA_PHASE_47_AUTOMATED_TASKS.length) {
      studyBlockers.push("phase47_task_attempts_incomplete")
    }
    if (taskSuccessRate < 0.9) studyBlockers.push("phase47_task_success_below_90_percent")
    if (productBoundaryAccuracy < 0.9) {
      studyBlockers.push("phase47_product_boundary_below_90_percent")
    }
    if (study.criticalWarningOpportunities < study.participantCount) {
      studyBlockers.push("phase47_critical_warning_opportunities_incomplete")
    }
    if (study.criticalWarningMisses !== 0) {
      studyBlockers.push("phase47_critical_warning_miss")
    }
    if (study.mobileTaskParticipants < 3 || study.keyboardOnlyTaskParticipants < 3) {
      studyBlockers.push("phase47_accessibility_modality_coverage_incomplete")
    }
    blockers.push(...studyBlockers)
    humanStudyStatus = studyBlockers.length ? "fail" : "pass"
  }

  const releaseStatus: DnaValidationStatus =
    automationStatus === "pass" && humanStudyStatus === "pass"
      ? "pass"
      : automationStatus === "fail" || humanStudyStatus === "fail"
        ? "fail"
        : "not_ready"
  return Object.freeze({
    version: DNA_PHASE_47_VALIDATION_VERSION,
    automationStatus,
    humanStudyStatus,
    releaseStatus,
    taskSuccessRate,
    productBoundaryAccuracy,
    criticalWarningMisses,
    clinicalBenefitMarketingClaimAllowed: false,
    blockerCodes: Object.freeze(unique(blockers).sort()),
  })
}

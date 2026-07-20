import { createHash } from "node:crypto"

export const DNA_CHAT_INCIDENT_RESPONSE_VERSION = "dna-chat-incident-response@1" as const
export const DNA_CHAT_OPERATIONAL_SWITCH_VERSION = "dna-chat-operational-switch@1" as const

export const DNA_CHAT_INCIDENT_TRIGGERS = Object.freeze([
  "citation_integrity_violation",
  "pending_or_restricted_source_served",
  "safety_regression",
  "cross_account_access",
  "case_audit_fail_open",
  "pack_schema_or_hash_failure",
  "unsupported_clinical_claim",
  "material_5xx_increase",
] as const)

export type DnaChatIncidentTrigger = (typeof DNA_CHAT_INCIDENT_TRIGGERS)[number]
export type DnaChatOperationalRoute = "dna-chat" | "dna-chat-feedback" | "dna-chat-reports"

export type DnaChatOperationalSwitchInput = Readonly<{
  globalKillSwitch: boolean
  disabledRoutes: readonly DnaChatOperationalRoute[]
  disabledPackSha256s: readonly string[]
  route: DnaChatOperationalRoute
  packSha256: string | null
  rollbackTarget: string | null
  rollbackEvidenceSha256: string | null
}>

export type DnaChatOperationalSwitchDecision = Readonly<{
  schemaVersion: typeof DNA_CHAT_OPERATIONAL_SWITCH_VERSION
  allowed: boolean
  blockCode:
    | null
    | "global_kill_switch"
    | "route_disabled"
    | "pack_disabled"
    | "rollback_evidence_missing"
    | "operational_configuration_invalid"
  rollbackReady: boolean
}>

const SHA256 = /^[a-f0-9]{64}$/
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{0,199}$/

export const DNA_CHAT_OPERATIONAL_KILL_SWITCH_ENV = "DNA_CHAT_OPERATIONS_KILL_SWITCH" as const
export const DNA_CHAT_OPERATIONAL_DISABLED_ROUTES_ENV = "DNA_CHAT_DISABLED_ROUTES" as const
export const DNA_CHAT_OPERATIONAL_DISABLED_PACKS_ENV = "DNA_CHAT_DISABLED_PACK_SHA256S" as const

/** Immutable Phase 0 V2 baseline evidence; this is a rollback target, not V3 approval. */
export const DNA_V2_OPERATIONAL_ROLLBACK_EVIDENCE = Object.freeze({
  target: "dna-chat-v2-baseline-20260719",
  gitSha: "5ed87217280a40e4566a04289d4c98b1f3883494",
  engineRuntimeSha256: "1f3525e7eeb5a780949c6c6b33f8d111257336e14061ea94391156cfefb333d6",
})

export function evaluateDnaChatOperationalSwitch(
  input: DnaChatOperationalSwitchInput,
): DnaChatOperationalSwitchDecision {
  const rollbackReady = Boolean(
    input.rollbackTarget
    && SAFE_ID.test(input.rollbackTarget)
    && input.rollbackEvidenceSha256
    && SHA256.test(input.rollbackEvidenceSha256),
  )
  let blockCode: DnaChatOperationalSwitchDecision["blockCode"] = null
  if (input.globalKillSwitch) blockCode = "global_kill_switch"
  else if (input.disabledRoutes.includes(input.route)) blockCode = "route_disabled"
  else if (input.packSha256 && input.disabledPackSha256s.includes(input.packSha256)) {
    blockCode = "pack_disabled"
  }
  if (blockCode && !rollbackReady) blockCode = "rollback_evidence_missing"

  return Object.freeze({
    schemaVersion: DNA_CHAT_OPERATIONAL_SWITCH_VERSION,
    allowed: blockCode === null,
    blockCode,
    rollbackReady,
  })
}

/**
 * Reads only bounded operational flags. An invalid explicit value fails closed;
 * an absent flag leaves the route available.
 */
export function evaluateDnaChatOperationalEnvironment(input: Readonly<{
  environment?: Readonly<Record<string, string | undefined>>
  route: DnaChatOperationalRoute
  packSha256: string | null
}>): DnaChatOperationalSwitchDecision {
  const environment = input.environment ?? process.env
  const rawKill = environment[DNA_CHAT_OPERATIONAL_KILL_SWITCH_ENV]
  const rawRoutes = environment[DNA_CHAT_OPERATIONAL_DISABLED_ROUTES_ENV] ?? ""
  const rawPacks = environment[DNA_CHAT_OPERATIONAL_DISABLED_PACKS_ENV] ?? ""
  const routeValues = rawRoutes.split(",").map((value) => value.trim()).filter(Boolean)
  const packValues = rawPacks.split(",").map((value) => value.trim()).filter(Boolean)
  const routes = new Set<DnaChatOperationalRoute>([
    "dna-chat",
    "dna-chat-feedback",
    "dna-chat-reports",
  ])
  const invalid = (rawKill !== undefined && rawKill !== "" && rawKill !== "0" && rawKill !== "1")
    || routeValues.some((value) => !routes.has(value as DnaChatOperationalRoute))
    || packValues.some((value) => !SHA256.test(value))
  if (invalid) {
    return Object.freeze({
      schemaVersion: DNA_CHAT_OPERATIONAL_SWITCH_VERSION,
      allowed: false,
      blockCode: "operational_configuration_invalid",
      rollbackReady: true,
    })
  }
  return evaluateDnaChatOperationalSwitch({
    globalKillSwitch: rawKill === "1",
    disabledRoutes: routeValues as DnaChatOperationalRoute[],
    disabledPackSha256s: packValues,
    route: input.route,
    packSha256: input.packSha256,
    rollbackTarget: DNA_V2_OPERATIONAL_ROLLBACK_EVIDENCE.target,
    rollbackEvidenceSha256: DNA_V2_OPERATIONAL_ROLLBACK_EVIDENCE.engineRuntimeSha256,
  })
}

export type DnaChatIncidentResponsePlan = Readonly<{
  schemaVersion: typeof DNA_CHAT_INCIDENT_RESPONSE_VERSION
  incidentId: string
  trigger: DnaChatIncidentTrigger
  observedAt: string
  severity: "critical" | "high"
  affectedRoutes: readonly DnaChatOperationalRoute[]
  affectedPackSha256s: readonly string[]
  affectedSourceIds: readonly string[]
  affectedClaimIds: readonly string[]
  crossAccountInvestigationRequired: boolean
  collectNewClinicalData: false
  preserveExistingOperationalLogs: true
  sealedAndAdversarialRetestRequired: true
  routeOrPackKillRequired: true
  userCorrectionNoticeReviewRequired: true
  knownGoodDeployment: string
  rollbackEvidenceSha256: string
  completionState: "response_pending"
  actions: readonly string[]
  planSha256: string
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

export function compileDnaChatIncidentResponsePlan(input: Readonly<{
  incidentId: string
  trigger: DnaChatIncidentTrigger
  observedAt: string
  affectedRoutes: readonly DnaChatOperationalRoute[]
  affectedPackSha256s: readonly string[]
  affectedSourceIds: readonly string[]
  affectedClaimIds: readonly string[]
  knownGoodDeployment: string
  rollbackEvidenceSha256: string
}>): DnaChatIncidentResponsePlan {
  if (!SAFE_ID.test(input.incidentId) || !SAFE_ID.test(input.knownGoodDeployment)) {
    throw new Error("dna_chat_incident_identifier_invalid")
  }
  if (!DNA_CHAT_INCIDENT_TRIGGERS.includes(input.trigger)) {
    throw new Error("dna_chat_incident_trigger_invalid")
  }
  if (!Number.isFinite(Date.parse(input.observedAt))) throw new Error("dna_chat_incident_date_invalid")
  if (!SHA256.test(input.rollbackEvidenceSha256)) {
    throw new Error("dna_chat_incident_rollback_evidence_invalid")
  }
  if (input.affectedRoutes.length === 0 && input.affectedPackSha256s.length === 0) {
    throw new Error("dna_chat_incident_kill_scope_required")
  }
  if (input.affectedPackSha256s.some((value) => !SHA256.test(value))) {
    throw new Error("dna_chat_incident_pack_sha_invalid")
  }
  if ([...input.affectedSourceIds, ...input.affectedClaimIds].some((value) => !SAFE_ID.test(value))) {
    throw new Error("dna_chat_incident_dependency_identifier_invalid")
  }

  const crossAccountInvestigationRequired = input.trigger === "cross_account_access"
    || input.trigger === "case_audit_fail_open"
  const body = {
    schemaVersion: DNA_CHAT_INCIDENT_RESPONSE_VERSION,
    incidentId: input.incidentId,
    trigger: input.trigger,
    observedAt: input.observedAt,
    severity: crossAccountInvestigationRequired || input.trigger === "safety_regression"
      ? "critical" as const
      : "high" as const,
    affectedRoutes: sortedUnique(input.affectedRoutes) as readonly DnaChatOperationalRoute[],
    affectedPackSha256s: sortedUnique(input.affectedPackSha256s),
    affectedSourceIds: sortedUnique(input.affectedSourceIds),
    affectedClaimIds: sortedUnique(input.affectedClaimIds),
    crossAccountInvestigationRequired,
    collectNewClinicalData: false as const,
    preserveExistingOperationalLogs: true as const,
    sealedAndAdversarialRetestRequired: true as const,
    routeOrPackKillRequired: true as const,
    userCorrectionNoticeReviewRequired: true as const,
    knownGoodDeployment: input.knownGoodDeployment,
    rollbackEvidenceSha256: input.rollbackEvidenceSha256,
    completionState: "response_pending" as const,
    actions: Object.freeze([
      "disable_affected_route_or_pack",
      "preserve_existing_nonclinical_operational_logs",
      "trace_affected_version_source_claim_chain",
      "investigate_cross_account_path",
      "patch_and_run_sealed_and_adversarial_suites",
      "review_user_correction_notice",
      "promote_known_good_deployment_if_required",
    ]),
  }
  return Object.freeze({ ...body, planSha256: sha256(body) })
}

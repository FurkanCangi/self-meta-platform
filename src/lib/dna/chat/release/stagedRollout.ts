import { createHash } from "node:crypto"
import { lstatSync, readFileSync, realpathSync } from "node:fs"
import { isAbsolute, relative, resolve, sep } from "node:path"

import { DNA_V2_ROLLBACK_TARGET } from "./runtimeReleaseMode"

export const DNA_STAGED_ROLLOUT_POLICY_VERSION = "dna-staged-rollout-policy@1" as const
export const DNA_STAGED_ROLLOUT_AUTHORIZATION_VERSION =
  "dna-staged-rollout-authorization@1" as const
export const DNA_STAGED_ROLLOUT_HEALTH_EVIDENCE_VERSION =
  "dna-staged-rollout-health-evidence@1" as const
export const DNA_STAGED_ROLLOUT_EVIDENCE_VERIFICATION_VERSION =
  "dna-staged-rollout-evidence-verification@1" as const

export const DNA_STAGED_ROLLOUT_KILL_TRIGGERS = Object.freeze([
  "citation_integrity_violation",
  "pending_or_restricted_source_returned",
  "safety_regression",
  "cross_account_error",
  "case_audit_fail_open",
  "pack_schema_or_hash_error",
  "unsupported_clinical_claim",
  "material_five_x_increase",
] as const)

export type DnaStagedRolloutKillTrigger =
  (typeof DNA_STAGED_ROLLOUT_KILL_TRIGGERS)[number]

export type DnaStagedRolloutPolicyPayload = Readonly<{
  schemaVersion: typeof DNA_STAGED_ROLLOUT_POLICY_VERSION
  releaseId: string
  packageSha256: string
  evidenceBundleSha256: string
  stages: readonly Readonly<{
    id: "preview" | "internal" | "limited" | "broad" | "full"
    therapistPercent: 0 | 5 | 25 | 50 | 100
    minimumObservationCount: number
  }>[]
  canaryQuestionIds: readonly string[]
  compareWithV2: true
  killTriggers: readonly DnaStagedRolloutKillTrigger[]
  rollbackTarget: typeof DNA_V2_ROLLBACK_TARGET
}>

export type DnaStagedRolloutPolicy = DnaStagedRolloutPolicyPayload & Readonly<{
  policySha256: string
}>

export type DnaStagedRolloutAuthorizationPayload = Readonly<{
  schemaVersion: typeof DNA_STAGED_ROLLOUT_AUTHORIZATION_VERSION
  policySha256: string
  releaseId: string
  packageSha256: string
  authorizedStageId: "internal" | "limited" | "broad" | "full"
  authorizedPercent: 5 | 25 | 50 | 100
  priorStageEvidence: readonly Readonly<{
    stageId: "preview" | "internal" | "limited" | "broad"
    observationCount: number
    healthSignals: DnaRolloutHealthSignals
    healthDecisionSha256: string
    evidenceSha256: string
    completedAt: string
  }>[]
  authorizedAt: string
}>

export type DnaStagedRolloutAuthorization = DnaStagedRolloutAuthorizationPayload & Readonly<{
  authorizationSha256: string
}>

export type DnaStagedRolloutHealthEvidenceRecord = Readonly<{
  schemaVersion: typeof DNA_STAGED_ROLLOUT_HEALTH_EVIDENCE_VERSION
  releaseId: string
  packageSha256: string
  policySha256: string
  stageId: "preview" | "internal" | "limited" | "broad"
  observationCount: number
  signals: DnaRolloutHealthSignals
  completedAt: string
}>

export type DnaStagedRolloutHealthEvidenceFile = Readonly<{
  stageId: DnaStagedRolloutHealthEvidenceRecord["stageId"]
  path: string
  format: "json" | "jsonl"
}>

export type DnaStagedRolloutEvidenceVerificationRow = Readonly<{
  stageId: DnaStagedRolloutHealthEvidenceRecord["stageId"]
  path: string
  format: DnaStagedRolloutHealthEvidenceFile["format"]
  expectedSha256: string
  actualSha256: string | null
  expectedSignalsSha256: string
  actualSignalsSha256: string | null
  expectedObservationCount: number
  actualObservationCount: number | null
  expectedCompletedAt: string
  actualCompletedAt: string | null
  status:
    | "pass"
    | "missing"
    | "not_regular_file"
    | "path_outside_root"
    | "invalid_format"
    | "hash_mismatch"
    | "binding_mismatch"
}>

export type DnaStagedRolloutEvidenceVerification = Readonly<{
  schemaVersion: typeof DNA_STAGED_ROLLOUT_EVIDENCE_VERIFICATION_VERSION
  policySha256: string
  releaseId: string
  packageSha256: string
  authorizationSha256: string
  rows: readonly DnaStagedRolloutEvidenceVerificationRow[]
  valid: boolean
  verificationSha256: string
}>

export type DnaRolloutHealthSignals = Readonly<{
  observationCount: number
  citationIntegrityViolationCount: number
  pendingOrRestrictedSourceReturnCount: number
  safetyRegressionCount: number
  crossAccountErrorCount: number
  caseAuditFailOpenCount: number
  packSchemaOrHashErrorCount: number
  unsupportedClinicalClaimCount: number
  baselineFiveXRate: number
  currentFiveXRate: number
}>

export type DnaRolloutHealthDecision = Readonly<{
  schemaVersion: typeof DNA_STAGED_ROLLOUT_POLICY_VERSION
  healthy: boolean
  action: "continue" | "hold" | "rollback_v2"
  triggerCodes: readonly DnaStagedRolloutKillTrigger[]
  rollbackEnvironment: typeof DNA_V2_ROLLBACK_TARGET.oneCommandEnvironment | null
}>

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort((left, right) => left.localeCompare(right, "en"))
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex")
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

function exactKeys(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right, "en"))
  const wanted = [...expected].sort((left, right) => left.localeCompare(right, "en"))
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index])
}

const HEALTH_EVIDENCE_PATH = /^[A-Za-z0-9][A-Za-z0-9._@/\-]{2,399}\.(?:json|jsonl)$/

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string"
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value
}

function validHealthEvidenceRecord(
  value: unknown,
): value is DnaStagedRolloutHealthEvidenceRecord {
  if (!exactKeys(value, [
    "schemaVersion", "releaseId", "packageSha256", "policySha256", "stageId",
    "observationCount", "signals", "completedAt",
  ]) || value.schemaVersion !== DNA_STAGED_ROLLOUT_HEALTH_EVIDENCE_VERSION
    || typeof value.releaseId !== "string"
    || !/^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,199}$/.test(value.releaseId)
    || typeof value.packageSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.packageSha256)
    || typeof value.policySha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.policySha256)
    || !["preview", "internal", "limited", "broad"].includes(String(value.stageId))
    || typeof value.observationCount !== "number"
    || !Number.isInteger(value.observationCount)
    || value.observationCount < 0
    || !exactKeys(value.signals, [
      "observationCount", "citationIntegrityViolationCount",
      "pendingOrRestrictedSourceReturnCount", "safetyRegressionCount",
      "crossAccountErrorCount", "caseAuditFailOpenCount",
      "packSchemaOrHashErrorCount", "unsupportedClinicalClaimCount",
      "baselineFiveXRate", "currentFiveXRate",
    ])
    || !validHealthSignals(value.signals as DnaRolloutHealthSignals)
    || value.observationCount !== (value.signals as DnaRolloutHealthSignals).observationCount
    || !isIsoTimestamp(value.completedAt)) return false
  return true
}

function parseHealthEvidenceFile(
  bytes: Buffer,
  format: DnaStagedRolloutHealthEvidenceFile["format"],
): DnaStagedRolloutHealthEvidenceRecord | null {
  const text = bytes.toString("utf8")
  if (!text.trim() || text.includes("\u0000")) return null
  try {
    if (format === "json") {
      const parsed = JSON.parse(text) as unknown
      return validHealthEvidenceRecord(parsed) ? parsed : null
    }
    const lines = text.split(/\r?\n/)
    if (lines.at(-1) === "") lines.pop()
    if (lines.length !== 1 || !lines[0]?.trim()) return null
    const parsed = JSON.parse(lines[0]) as unknown
    return validHealthEvidenceRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function createDnaStagedRolloutPolicy(input: Readonly<{
  releaseId: string
  packageSha256: string
  evidenceBundleSha256: string
  canaryQuestionIds: readonly string[]
}>): DnaStagedRolloutPolicy {
  const payload: DnaStagedRolloutPolicyPayload = {
    schemaVersion: DNA_STAGED_ROLLOUT_POLICY_VERSION,
    releaseId: input.releaseId,
    packageSha256: input.packageSha256,
    evidenceBundleSha256: input.evidenceBundleSha256,
    stages: Object.freeze([
      Object.freeze({ id: "preview" as const, therapistPercent: 0 as const, minimumObservationCount: 0 }),
      Object.freeze({ id: "internal" as const, therapistPercent: 5 as const, minimumObservationCount: 100 }),
      Object.freeze({ id: "limited" as const, therapistPercent: 25 as const, minimumObservationCount: 500 }),
      Object.freeze({ id: "broad" as const, therapistPercent: 50 as const, minimumObservationCount: 1_500 }),
      Object.freeze({ id: "full" as const, therapistPercent: 100 as const, minimumObservationCount: 5_000 }),
    ]),
    canaryQuestionIds: Object.freeze([...new Set(input.canaryQuestionIds)]
      .sort((left, right) => left.localeCompare(right, "en"))),
    compareWithV2: true,
    killTriggers: DNA_STAGED_ROLLOUT_KILL_TRIGGERS,
    rollbackTarget: DNA_V2_ROLLBACK_TARGET,
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,199}$/.test(payload.releaseId)
    || !/^[a-f0-9]{64}$/.test(payload.packageSha256)
    || !/^[a-f0-9]{64}$/.test(payload.evidenceBundleSha256)
    || payload.canaryQuestionIds.length === 0
    || payload.canaryQuestionIds.some((id) =>
      !/^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,199}$/.test(id))) {
    throw new Error("dna_staged_rollout_policy_invalid")
  }
  const policy = { ...payload, policySha256: sha256(payload) }
  if (!validateDnaStagedRolloutPolicy(policy)) {
    throw new Error("dna_staged_rollout_policy_invalid")
  }
  return deepFreeze(policy)
}

export function validateDnaStagedRolloutPolicy(
  value: unknown,
): value is DnaStagedRolloutPolicy {
  if (!exactKeys(value, [
    "schemaVersion", "releaseId", "packageSha256", "evidenceBundleSha256", "stages",
    "canaryQuestionIds", "compareWithV2", "killTriggers", "rollbackTarget", "policySha256",
  ]) || value.schemaVersion !== DNA_STAGED_ROLLOUT_POLICY_VERSION
    || typeof value.releaseId !== "string"
    || !/^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,199}$/.test(value.releaseId)
    || typeof value.packageSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.packageSha256)
    || typeof value.evidenceBundleSha256 !== "string"
    || !/^[a-f0-9]{64}$/.test(value.evidenceBundleSha256)
    || value.compareWithV2 !== true
    || typeof value.policySha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.policySha256)) {
    return false
  }
  const expectedStages = [
    ["preview", 0, 0], ["internal", 5, 100], ["limited", 25, 500],
    ["broad", 50, 1_500], ["full", 100, 5_000],
  ] as const
  if (!Array.isArray(value.stages) || value.stages.length !== expectedStages.length
    || value.stages.some((stage, index) => {
      const expected = expectedStages[index]!
      return !exactKeys(stage, ["id", "therapistPercent", "minimumObservationCount"])
        || stage.id !== expected[0]
        || stage.therapistPercent !== expected[1]
        || stage.minimumObservationCount !== expected[2]
    })) return false
  if (!Array.isArray(value.canaryQuestionIds) || value.canaryQuestionIds.length === 0
    || value.canaryQuestionIds.some((id) =>
      typeof id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,199}$/.test(id))
    || new Set(value.canaryQuestionIds).size !== value.canaryQuestionIds.length) return false
  if (!Array.isArray(value.killTriggers)
    || value.killTriggers.length !== DNA_STAGED_ROLLOUT_KILL_TRIGGERS.length
    || value.killTriggers.some((trigger, index) =>
      trigger !== DNA_STAGED_ROLLOUT_KILL_TRIGGERS[index])) return false
  if (!exactKeys(value.rollbackTarget, [
    "runtimeMode", "engineVersion", "catalogVersion", "gitTag", "gitSha",
    "oneCommandEnvironment",
  ]) || stableJson(value.rollbackTarget) !== stableJson(DNA_V2_ROLLBACK_TARGET)) return false
  const { policySha256, ...payload } = value as unknown as DnaStagedRolloutPolicy
  return sha256(payload) === policySha256
}

export function createDnaStagedRolloutAuthorization(input: Readonly<{
  policy: DnaStagedRolloutPolicy
  authorizedStageId: DnaStagedRolloutAuthorizationPayload["authorizedStageId"]
  priorStageEvidence: readonly Readonly<{
    stageId: DnaStagedRolloutAuthorizationPayload["priorStageEvidence"][number]["stageId"]
    signals: DnaRolloutHealthSignals
    evidenceSha256: string
    completedAt: string
  }>[]
  authorizedAt: string
}>): DnaStagedRolloutAuthorization {
  if (!validateDnaStagedRolloutPolicy(input.policy)) {
    throw new Error("dna_staged_rollout_authorization_policy_invalid")
  }
  const stageIndex = input.policy.stages.findIndex((stage) => stage.id === input.authorizedStageId)
  const stage = input.policy.stages[stageIndex]
  if (!stage || stage.therapistPercent === 0
    || !Number.isFinite(Date.parse(input.authorizedAt))
    || new Date(input.authorizedAt).toISOString() !== input.authorizedAt) {
    throw new Error("dna_staged_rollout_authorization_invalid")
  }
  const expectedPriorStages = input.policy.stages.slice(0, stageIndex)
  if (input.priorStageEvidence.length !== expectedPriorStages.length) {
    throw new Error("dna_staged_rollout_prior_stage_evidence_incomplete")
  }
  const normalizedPriorStageEvidence = input.priorStageEvidence.map((evidence, index) => {
    const expectedStage = expectedPriorStages[index]
    const decision = expectedStage
      ? evaluateDnaStagedRolloutHealth({
        policy: input.policy,
        stageId: expectedStage.id,
        signals: evidence.signals,
      })
      : null
    if (!expectedStage
      || evidence.stageId !== expectedStage.id
      || decision?.action !== "continue"
      || !/^[a-f0-9]{64}$/.test(evidence.evidenceSha256)
      || !Number.isFinite(Date.parse(evidence.completedAt))
      || new Date(evidence.completedAt).toISOString() !== evidence.completedAt
      || Date.parse(evidence.completedAt) > Date.parse(input.authorizedAt)) {
      throw new Error("dna_staged_rollout_prior_stage_evidence_invalid")
    }
    return Object.freeze({
      stageId: evidence.stageId,
      observationCount: evidence.signals.observationCount,
      healthSignals: Object.freeze({ ...evidence.signals }),
      healthDecisionSha256: sha256({
        policySha256: input.policy.policySha256,
        stageId: evidence.stageId,
        signals: evidence.signals,
        decision,
      }),
      evidenceSha256: evidence.evidenceSha256,
      completedAt: evidence.completedAt,
    })
  })
  if (normalizedPriorStageEvidence.some((evidence, index) => index > 0
    && Date.parse(evidence.completedAt)
      < Date.parse(normalizedPriorStageEvidence[index - 1]!.completedAt))) {
    throw new Error("dna_staged_rollout_prior_stage_evidence_out_of_order")
  }
  const payload: DnaStagedRolloutAuthorizationPayload = {
    schemaVersion: DNA_STAGED_ROLLOUT_AUTHORIZATION_VERSION,
    policySha256: input.policy.policySha256,
    releaseId: input.policy.releaseId,
    packageSha256: input.policy.packageSha256,
    authorizedStageId: input.authorizedStageId,
    authorizedPercent: stage.therapistPercent as 5 | 25 | 50 | 100,
    priorStageEvidence: Object.freeze(normalizedPriorStageEvidence),
    authorizedAt: input.authorizedAt,
  }
  const authorization = { ...payload, authorizationSha256: sha256(payload) }
  if (!validateDnaStagedRolloutAuthorization(authorization, input.policy)) {
    throw new Error("dna_staged_rollout_authorization_invalid")
  }
  return deepFreeze(authorization)
}

export function validateDnaStagedRolloutAuthorization(
  value: unknown,
  policy: DnaStagedRolloutPolicy,
): value is DnaStagedRolloutAuthorization {
  if (!validateDnaStagedRolloutPolicy(policy)
    || !exactKeys(value, [
      "schemaVersion", "policySha256", "releaseId", "packageSha256",
      "authorizedStageId", "authorizedPercent", "priorStageEvidence",
      "authorizedAt", "authorizationSha256",
    ])
    || value.schemaVersion !== DNA_STAGED_ROLLOUT_AUTHORIZATION_VERSION
    || value.policySha256 !== policy.policySha256
    || value.releaseId !== policy.releaseId
    || value.packageSha256 !== policy.packageSha256
    || typeof value.authorizationSha256 !== "string"
    || !/^[a-f0-9]{64}$/.test(value.authorizationSha256)
    || typeof value.authorizedAt !== "string"
    || !Number.isFinite(Date.parse(value.authorizedAt))
    || new Date(value.authorizedAt).toISOString() !== value.authorizedAt) return false
  const stageIndex = policy.stages.findIndex((stage) => stage.id === value.authorizedStageId)
  const stage = policy.stages[stageIndex]
  if (!stage || stage.therapistPercent === 0 || value.authorizedPercent !== stage.therapistPercent) {
    return false
  }
  const expectedPrior = policy.stages.slice(0, stageIndex)
  if (!Array.isArray(value.priorStageEvidence)
    || value.priorStageEvidence.length !== expectedPrior.length) return false
  let previousCompletedAt = Number.NEGATIVE_INFINITY
  for (const [index, evidence] of value.priorStageEvidence.entries()) {
    const expectedStage = expectedPrior[index]
    if (!expectedStage
      || !exactKeys(evidence, [
        "stageId", "observationCount", "healthSignals", "healthDecisionSha256",
        "evidenceSha256", "completedAt",
      ])
      || evidence.stageId !== expectedStage.id
      || typeof evidence.observationCount !== "number"
      || !Number.isInteger(evidence.observationCount)
      || evidence.observationCount < 0
      || !exactKeys(evidence.healthSignals, [
        "observationCount", "citationIntegrityViolationCount",
        "pendingOrRestrictedSourceReturnCount", "safetyRegressionCount",
        "crossAccountErrorCount", "caseAuditFailOpenCount",
        "packSchemaOrHashErrorCount", "unsupportedClinicalClaimCount",
        "baselineFiveXRate", "currentFiveXRate",
      ])) return false
    const healthSignals = evidence.healthSignals as DnaRolloutHealthSignals
    if (!validHealthSignals(healthSignals)
      || evidence.observationCount !== healthSignals.observationCount
      || typeof evidence.healthDecisionSha256 !== "string"
      || !/^[a-f0-9]{64}$/.test(evidence.healthDecisionSha256)
      || typeof evidence.evidenceSha256 !== "string"
      || !/^[a-f0-9]{64}$/.test(evidence.evidenceSha256)
      || typeof evidence.completedAt !== "string"
      || !Number.isFinite(Date.parse(evidence.completedAt))
      || new Date(evidence.completedAt).toISOString() !== evidence.completedAt
      || Date.parse(evidence.completedAt) < previousCompletedAt
      || Date.parse(evidence.completedAt) > Date.parse(value.authorizedAt)) return false
    const decision = evaluateDnaStagedRolloutHealth({
      policy,
      stageId: expectedStage.id,
      signals: healthSignals,
    })
    if (decision.action !== "continue"
      || evidence.healthDecisionSha256 !== sha256({
        policySha256: policy.policySha256,
        stageId: expectedStage.id,
        signals: healthSignals,
        decision,
      })) return false
    previousCompletedAt = Date.parse(evidence.completedAt)
  }
  const { authorizationSha256, ...payload } = value as unknown as DnaStagedRolloutAuthorization
  return sha256(payload) === authorizationSha256
}

function evidenceVerificationSha256(
  value: Omit<DnaStagedRolloutEvidenceVerification, "verificationSha256">,
): string {
  return sha256(value)
}

export function validateDnaStagedRolloutEvidenceVerification(
  value: unknown,
  policy: DnaStagedRolloutPolicy,
  authorization: DnaStagedRolloutAuthorization,
): value is DnaStagedRolloutEvidenceVerification {
  if (!validateDnaStagedRolloutPolicy(policy)
    || !validateDnaStagedRolloutAuthorization(authorization, policy)
    || !exactKeys(value, [
      "schemaVersion", "policySha256", "releaseId", "packageSha256",
      "authorizationSha256", "rows", "valid", "verificationSha256",
    ])
    || value.schemaVersion !== DNA_STAGED_ROLLOUT_EVIDENCE_VERIFICATION_VERSION
    || value.policySha256 !== policy.policySha256
    || value.releaseId !== policy.releaseId
    || value.packageSha256 !== policy.packageSha256
    || value.authorizationSha256 !== authorization.authorizationSha256
    || typeof value.valid !== "boolean"
    || typeof value.verificationSha256 !== "string"
    || !/^[a-f0-9]{64}$/.test(value.verificationSha256)
    || !Array.isArray(value.rows)
    || value.rows.length !== authorization.priorStageEvidence.length) return false

  const statuses = new Set([
    "pass", "missing", "not_regular_file", "path_outside_root", "invalid_format",
    "hash_mismatch", "binding_mismatch",
  ])
  for (const [index, row] of value.rows.entries()) {
    const expected = authorization.priorStageEvidence[index]
    if (!expected
      || !exactKeys(row, [
        "stageId", "path", "format", "expectedSha256", "actualSha256",
        "expectedSignalsSha256", "actualSignalsSha256", "expectedObservationCount",
        "actualObservationCount", "expectedCompletedAt", "actualCompletedAt", "status",
      ])
      || row.stageId !== expected.stageId
      || typeof row.path !== "string" || !HEALTH_EVIDENCE_PATH.test(row.path)
      || isAbsolute(row.path) || row.path.split("/").includes("..")
      || (row.format !== "json" && row.format !== "jsonl")
      || !row.path.endsWith(`.${row.format}`)
      || row.expectedSha256 !== expected.evidenceSha256
      || (row.actualSha256 !== null && (
        typeof row.actualSha256 !== "string" || !/^[a-f0-9]{64}$/.test(row.actualSha256)
      ))
      || row.expectedSignalsSha256 !== sha256(expected.healthSignals)
      || (row.actualSignalsSha256 !== null && (
        typeof row.actualSignalsSha256 !== "string"
        || !/^[a-f0-9]{64}$/.test(row.actualSignalsSha256)
      ))
      || row.expectedObservationCount !== expected.observationCount
      || (row.actualObservationCount !== null && (
        typeof row.actualObservationCount !== "number"
        || !Number.isInteger(row.actualObservationCount)
        || row.actualObservationCount < 0
      ))
      || row.expectedCompletedAt !== expected.completedAt
      || (row.actualCompletedAt !== null && !isIsoTimestamp(row.actualCompletedAt))
      || typeof row.status !== "string" || !statuses.has(row.status)) return false
    if (row.status === "pass" && (
      row.actualSha256 !== row.expectedSha256
      || row.actualSignalsSha256 !== row.expectedSignalsSha256
      || row.actualObservationCount !== row.expectedObservationCount
      || row.actualCompletedAt !== row.expectedCompletedAt
    )) return false
  }
  if (value.valid !== value.rows.every((row) => row.status === "pass")) return false
  const { verificationSha256, ...payload } =
    value as unknown as DnaStagedRolloutEvidenceVerification
  return evidenceVerificationSha256(payload) === verificationSha256
}

/**
 * Offline verification authority for privacy-safe staged rollout health files.
 *
 * Each prior stage must have exactly one regular JSON/JSONL file below the
 * explicitly allowed root. The file hash and its release, package, policy,
 * stage, timestamp, observation count and aggregate health signals are bound
 * to the immutable authorization. No request, answer, report or user content
 * is accepted by this schema.
 */
export function verifyDnaStagedRolloutHealthEvidence(input: Readonly<{
  policy: DnaStagedRolloutPolicy
  authorization: DnaStagedRolloutAuthorization
  evidenceRoot: string
  files: readonly DnaStagedRolloutHealthEvidenceFile[]
}>): DnaStagedRolloutEvidenceVerification {
  if (!validateDnaStagedRolloutPolicy(input.policy)
    || !validateDnaStagedRolloutAuthorization(input.authorization, input.policy)) {
    throw new Error("dna_staged_rollout_evidence_authority_invalid")
  }
  const expectedStages = input.authorization.priorStageEvidence.map((row) => row.stageId)
  const suppliedStages = input.files.map((file) => file.stageId)
  if (input.files.length !== expectedStages.length
    || new Set(suppliedStages).size !== suppliedStages.length
    || suppliedStages.some((stageId, index) => stageId !== expectedStages[index])) {
    throw new Error("dna_staged_rollout_evidence_files_incomplete")
  }
  for (const file of input.files) {
    if (!HEALTH_EVIDENCE_PATH.test(file.path)
      || isAbsolute(file.path)
      || file.path.split("/").includes("..")
      || (file.format !== "json" && file.format !== "jsonl")
      || !file.path.endsWith(`.${file.format}`)) {
      throw new Error("dna_staged_rollout_evidence_file_descriptor_invalid")
    }
  }

  const root = realpathSync(resolve(input.evidenceRoot))
  const rows = input.files.map((file, index): DnaStagedRolloutEvidenceVerificationRow => {
    const expected = input.authorization.priorStageEvidence[index]!
    const lexicalPath = resolve(root, file.path)
    const lexicalRelative = relative(root, lexicalPath)
    const base = {
      stageId: expected.stageId,
      path: file.path,
      format: file.format,
      expectedSha256: expected.evidenceSha256,
      actualSha256: null,
      expectedSignalsSha256: sha256(expected.healthSignals),
      actualSignalsSha256: null,
      expectedObservationCount: expected.observationCount,
      actualObservationCount: null,
      expectedCompletedAt: expected.completedAt,
      actualCompletedAt: null,
    }
    if (lexicalRelative === ".." || lexicalRelative.startsWith(`..${sep}`)
      || isAbsolute(lexicalRelative)) {
      return Object.freeze({ ...base, status: "path_outside_root" })
    }
    try {
      // Deliberately reject symlinks, including symlinks that happen to resolve
      // inside the root: release evidence must itself be a regular file.
      if (!lstatSync(lexicalPath).isFile()) {
        return Object.freeze({ ...base, status: "not_regular_file" })
      }
      const realPath = realpathSync(lexicalPath)
      const realRelative = relative(root, realPath)
      if (realRelative === ".." || realRelative.startsWith(`..${sep}`)
        || isAbsolute(realRelative)) {
        return Object.freeze({ ...base, status: "path_outside_root" })
      }
      const bytes = readFileSync(realPath)
      const actualSha256 = createHash("sha256").update(bytes).digest("hex")
      const record = parseHealthEvidenceFile(bytes, file.format)
      if (!record) {
        return Object.freeze({ ...base, actualSha256, status: "invalid_format" })
      }
      const actualSignalsSha256 = sha256(record.signals)
      const observed = {
        ...base,
        actualSha256,
        actualSignalsSha256,
        actualObservationCount: record.observationCount,
        actualCompletedAt: record.completedAt,
      }
      const bindingMatches = record.releaseId === input.policy.releaseId
        && record.packageSha256 === input.policy.packageSha256
        && record.policySha256 === input.policy.policySha256
        && record.stageId === expected.stageId
        && record.observationCount === expected.observationCount
        && actualSignalsSha256 === base.expectedSignalsSha256
        && record.completedAt === expected.completedAt
      if (!bindingMatches) {
        return Object.freeze({ ...observed, status: "binding_mismatch" })
      }
      if (actualSha256 !== expected.evidenceSha256) {
        return Object.freeze({ ...observed, status: "hash_mismatch" })
      }
      return Object.freeze({ ...observed, status: "pass" })
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : ""
      return Object.freeze({ ...base, status: code === "ENOENT" ? "missing" : "not_regular_file" })
    }
  })
  const payload = {
    schemaVersion: DNA_STAGED_ROLLOUT_EVIDENCE_VERIFICATION_VERSION,
    policySha256: input.policy.policySha256,
    releaseId: input.policy.releaseId,
    packageSha256: input.policy.packageSha256,
    authorizationSha256: input.authorization.authorizationSha256,
    rows: Object.freeze(rows),
    valid: rows.every((row) => row.status === "pass"),
  } as const
  const verification = {
    ...payload,
    verificationSha256: evidenceVerificationSha256(payload),
  }
  if (!validateDnaStagedRolloutEvidenceVerification(
    verification,
    input.policy,
    input.authorization,
  )) {
    throw new Error("dna_staged_rollout_evidence_verification_invalid")
  }
  return deepFreeze(verification)
}

export function evaluateCurrentDnaStagedRolloutAuthorization(input: Readonly<{
  rolloutPercent: number
  packageSha256: string
}>): Readonly<{
  allowed: boolean
  blockCode:
    | null
    | "rollout_policy_missing"
    | "rollout_authorization_missing_or_invalid"
    | "rollout_evidence_verification_missing_or_invalid"
}> {
  const policy = DNA_CURRENT_V3_STAGED_ROLLOUT_POLICY
  const authorization = DNA_CURRENT_V3_STAGED_ROLLOUT_AUTHORIZATION
  if (!policy || !validateDnaStagedRolloutPolicy(policy)) {
    return Object.freeze({ allowed: false, blockCode: "rollout_policy_missing" })
  }
  if (!authorization
    || !validateDnaStagedRolloutAuthorization(authorization, policy)
    || authorization.authorizedPercent !== input.rolloutPercent
    || authorization.packageSha256 !== input.packageSha256) {
    return Object.freeze({
      allowed: false,
      blockCode: "rollout_authorization_missing_or_invalid",
    })
  }
  const evidenceRoot = DNA_CURRENT_V3_STAGED_ROLLOUT_EVIDENCE_ROOT
  const evidenceFiles = DNA_CURRENT_V3_STAGED_ROLLOUT_EVIDENCE_FILES
  let verification: DnaStagedRolloutEvidenceVerification | null = null
  if (evidenceRoot && evidenceFiles) {
    try {
      verification = verifyDnaStagedRolloutHealthEvidence({
        policy,
        authorization,
        evidenceRoot,
        files: evidenceFiles,
      })
    } catch {
      verification = null
    }
  }
  if (!verification || !verification.valid) {
    return Object.freeze({
      allowed: false,
      blockCode: "rollout_evidence_verification_missing_or_invalid",
    })
  }
  return Object.freeze({ allowed: true, blockCode: null })
}

function validHealthSignals(signals: DnaRolloutHealthSignals): boolean {
  const counts = [
    signals.observationCount,
    signals.citationIntegrityViolationCount,
    signals.pendingOrRestrictedSourceReturnCount,
    signals.safetyRegressionCount,
    signals.crossAccountErrorCount,
    signals.caseAuditFailOpenCount,
    signals.packSchemaOrHashErrorCount,
    signals.unsupportedClinicalClaimCount,
  ]
  return counts.every((value) => Number.isInteger(value) && value >= 0)
    && [signals.baselineFiveXRate, signals.currentFiveXRate]
      .every((value) => Number.isFinite(value) && value >= 0 && value <= 1)
}

export function evaluateDnaStagedRolloutHealth(input: Readonly<{
  policy: DnaStagedRolloutPolicy
  stageId: DnaStagedRolloutPolicy["stages"][number]["id"]
  signals: DnaRolloutHealthSignals
}>): DnaRolloutHealthDecision {
  const { policySha256, ...policyPayload } = input.policy
  const stage = input.policy.stages.find((candidate) => candidate.id === input.stageId)
  if (!validHealthSignals(input.signals)
    || policySha256 !== sha256(policyPayload)
    || !validateDnaStagedRolloutPolicy(input.policy)
    || !stage) {
    return Object.freeze({
      schemaVersion: DNA_STAGED_ROLLOUT_POLICY_VERSION,
      healthy: false,
      action: "rollback_v2",
      triggerCodes: Object.freeze([
        "pack_schema_or_hash_error" as DnaStagedRolloutKillTrigger,
      ]),
      rollbackEnvironment: DNA_V2_ROLLBACK_TARGET.oneCommandEnvironment,
    })
  }
  const signals = input.signals
  const triggers: DnaStagedRolloutKillTrigger[] = []
  if (signals.citationIntegrityViolationCount > 0) triggers.push("citation_integrity_violation")
  if (signals.pendingOrRestrictedSourceReturnCount > 0) {
    triggers.push("pending_or_restricted_source_returned")
  }
  if (signals.safetyRegressionCount > 0) triggers.push("safety_regression")
  if (signals.crossAccountErrorCount > 0) triggers.push("cross_account_error")
  if (signals.caseAuditFailOpenCount > 0) triggers.push("case_audit_fail_open")
  if (signals.packSchemaOrHashErrorCount > 0) triggers.push("pack_schema_or_hash_error")
  if (signals.unsupportedClinicalClaimCount > 0) triggers.push("unsupported_clinical_claim")
  const materialFiveXIncrease = signals.currentFiveXRate >= 0.05
    && signals.currentFiveXRate - signals.baselineFiveXRate >= 0.02
    && signals.currentFiveXRate >= Math.max(0.01, signals.baselineFiveXRate * 1.5)
  if (materialFiveXIncrease) triggers.push("material_five_x_increase")
  if (triggers.length) {
    return Object.freeze({
      schemaVersion: DNA_STAGED_ROLLOUT_POLICY_VERSION,
      healthy: false,
      action: "rollback_v2",
      triggerCodes: Object.freeze([...new Set(triggers)]),
      rollbackEnvironment: DNA_V2_ROLLBACK_TARGET.oneCommandEnvironment,
    })
  }
  const enoughObservations = signals.observationCount >= stage.minimumObservationCount
  return Object.freeze({
    schemaVersion: DNA_STAGED_ROLLOUT_POLICY_VERSION,
    healthy: enoughObservations,
    action: enoughObservations ? "continue" : "hold",
    triggerCodes: Object.freeze([]),
    rollbackEnvironment: null,
  })
}

/** Absent until a real V3 release evidence bundle and preview promotion exist. */
export const DNA_CURRENT_V3_STAGED_ROLLOUT_POLICY: DnaStagedRolloutPolicy | null = null
export const DNA_CURRENT_V3_STAGED_ROLLOUT_AUTHORIZATION:
  DnaStagedRolloutAuthorization | null = null
export const DNA_CURRENT_V3_STAGED_ROLLOUT_EVIDENCE_VERIFICATION:
  DnaStagedRolloutEvidenceVerification | null = null
export const DNA_CURRENT_V3_STAGED_ROLLOUT_EVIDENCE_ROOT: string | null = null
export const DNA_CURRENT_V3_STAGED_ROLLOUT_EVIDENCE_FILES:
  readonly DnaStagedRolloutHealthEvidenceFile[] | null = null

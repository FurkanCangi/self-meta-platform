import {
  createHash,
  createPublicKey,
  verify as verifySignature,
  type KeyObject,
} from "node:crypto"

import {
  verifyDnaExternalLiveObservationAttestation,
  type DnaExternalLiveObservationAttestation,
  type DnaExternalLiveObservationTrustRoot,
} from "./previewPromotion"
import {
  validateDnaStagedRolloutAuthorization,
  validateDnaStagedRolloutEvidenceVerification,
  validateDnaStagedRolloutPolicy,
  type DnaStagedRolloutAuthorization,
  type DnaStagedRolloutEvidenceVerification,
  type DnaStagedRolloutPolicy,
} from "./stagedRollout"

export const DNA_PRODUCTION_ACTION_TRUST_ROOT_VERSION =
  "dna-production-action-trust-root@1" as const
export const DNA_PRODUCTION_CANARY_BOOTSTRAP_AUTHORIZATION_VERSION =
  "dna-production-canary-bootstrap-authorization@1" as const
export const DNA_PRODUCTION_STAGED_ROLLOUT_AUTHORITY_VERSION =
  "dna-production-staged-rollout-authority@1" as const
export const DNA_PRODUCTION_RUNTIME_ACTIVATION_VERSION =
  "dna-production-runtime-activation@1" as const

export const DNA_PRODUCTION_CANARY_BOOTSTRAP_AUTHORIZATION_ENV =
  "DNA_CHAT_PRODUCTION_CANARY_BOOTSTRAP_AUTHORIZATION_BASE64" as const
export const DNA_PRODUCTION_STAGED_ROLLOUT_AUTHORITY_ENV =
  "DNA_CHAT_PRODUCTION_STAGED_ROLLOUT_AUTHORITY_BASE64" as const
export const DNA_PRODUCTION_RUNTIME_ACTIVATION_ENV =
  "DNA_CHAT_PRODUCTION_RUNTIME_ACTIVATION_BASE64" as const

export const DNA_PRODUCTION_ACTION_MAX_LIFETIME_MS = 15 * 60 * 1000

export type DnaProductionActionRole =
  | "canary_bootstrap_authorizer"
  | "staged_rollout_authorizer"
  | "runtime_activation_authorizer"

export type DnaProductionActionTrustRoot = Readonly<{
  schemaVersion: typeof DNA_PRODUCTION_ACTION_TRUST_ROOT_VERSION
  keyId: string
  algorithm: "Ed25519"
  role: DnaProductionActionRole
  environment: "production"
  publicKeySpkiBase64: string
  validFrom: string
  validUntil: string
}>

type ProductionStageId = "internal" | "limited" | "broad" | "full"
type PreviousStageId = "preview" | "internal" | "limited" | "broad"
type ProductionRolloutPercent = 5 | 25 | 50 | 100

type DnaProductionStageAuthorityCommon = Readonly<{
  environment: "production"
  keyId: string
  releaseId: string
  deploymentId: string
  origin: string
  gitSha: string
  packageSha256: string
  policySha256: string
  rolloutAuthorizationSha256: string
  stageId: ProductionStageId
  rolloutPercent: ProductionRolloutPercent
  previousStageId: PreviousStageId
  previousStageHealthSha256: string
  observationAttestationSha256: string
  nonce: string
  issuedAt: string
  expiresAt: string
}>

export type DnaProductionCanaryBootstrapAuthorizationPayload =
  DnaProductionStageAuthorityCommon & Readonly<{
    schemaVersion: typeof DNA_PRODUCTION_CANARY_BOOTSTRAP_AUTHORIZATION_VERSION
    purpose: "production_canary_bootstrap"
    stageId: "internal"
    rolloutPercent: 5
    previousStageId: "preview"
  }>

export type DnaProductionStagedRolloutAuthorityPayload =
  DnaProductionStageAuthorityCommon & Readonly<{
    schemaVersion: typeof DNA_PRODUCTION_STAGED_ROLLOUT_AUTHORITY_VERSION
    purpose: "production_staged_rollout"
    stageId: "limited" | "broad" | "full"
    rolloutPercent: 25 | 50 | 100
    previousStageId: "internal" | "limited" | "broad"
  }>

export type DnaProductionStageAuthorityPayload =
  | DnaProductionCanaryBootstrapAuthorizationPayload
  | DnaProductionStagedRolloutAuthorityPayload

export type DnaProductionStageAuthority = DnaProductionStageAuthorityPayload & Readonly<{
  signatureBase64: string
}>

export type DnaProductionRuntimeActivationPayload = Readonly<{
  schemaVersion: typeof DNA_PRODUCTION_RUNTIME_ACTIVATION_VERSION
  purpose: "production_runtime_activation"
  environment: "production"
  keyId: string
  releaseId: string
  deploymentId: string
  origin: string
  gitSha: string
  packageSha256: string
  policySha256: string
  rolloutAuthorizationSha256: string
  stageAuthoritySha256: string
  stageId: ProductionStageId
  rolloutPercent: ProductionRolloutPercent
  previousStageId: PreviousStageId
  previousStageHealthSha256: string
  observationAttestationSha256: string
  nonce: string
  issuedAt: string
  expiresAt: string
}>

export type DnaProductionRuntimeActivation =
  DnaProductionRuntimeActivationPayload & Readonly<{
    signatureBase64: string
  }>

export type DnaProductionRuntimeAuthorityExpectedBindings = Readonly<{
  releaseId: string
  deploymentId: string
  origin: string
  gitSha: string
  packageSha256: string
  stageId: ProductionStageId
  rolloutPercent: ProductionRolloutPercent
}>

export type DnaProductionRuntimeAuthorityDecision = Readonly<{
  allowed: boolean
  stageKeyId: string | null
  activationKeyId: string | null
  blockCode:
    | null
    | "production_observation_missing_or_invalid"
    | "production_stage_health_missing_or_invalid"
    | "production_stage_authority_missing_or_invalid"
    | "production_stage_authority_binding_or_sequence_invalid"
    | "production_stage_authority_time_invalid"
    | "production_stage_authority_trust_root_missing_or_invalid"
    | "production_stage_authority_signature_invalid"
    | "production_runtime_activation_missing_or_invalid"
    | "production_runtime_activation_binding_invalid"
    | "production_runtime_activation_time_invalid"
    | "production_runtime_activation_trust_root_missing_or_invalid"
    | "production_runtime_activation_signature_invalid"
    | "production_authority_nonce_replayed"
    | "production_authority_role_separation_invalid"
}>

const STAGE_AUTHORITY_KEYS = Object.freeze([
  "schemaVersion", "purpose", "environment", "keyId", "releaseId", "deploymentId",
  "origin", "gitSha", "packageSha256", "policySha256", "rolloutAuthorizationSha256",
  "stageId", "rolloutPercent", "previousStageId", "previousStageHealthSha256",
  "observationAttestationSha256", "nonce", "issuedAt", "expiresAt", "signatureBase64",
] as const)

const RUNTIME_ACTIVATION_KEYS = Object.freeze([
  "schemaVersion", "purpose", "environment", "keyId", "releaseId", "deploymentId",
  "origin", "gitSha", "packageSha256", "policySha256", "rolloutAuthorizationSha256",
  "stageAuthoritySha256", "stageId", "rolloutPercent", "previousStageId",
  "previousStageHealthSha256", "observationAttestationSha256", "nonce", "issuedAt",
  "expiresAt", "signatureBase64",
] as const)

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort((left, right) => left.localeCompare(right, "en"))
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

function exactKeys(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right, "en"))
  const wanted = [...expected].sort((left, right) => left.localeCompare(right, "en"))
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index])
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string"
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value
}

function validOrigin(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 300) return false
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.origin === value && !url.username && !url.password
  } catch {
    return false
  }
}

function decodeCanonicalBase64(value: unknown, minimumBytes: number, maximumBytes: number): Buffer | null {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null
  try {
    const bytes = Buffer.from(value, "base64")
    return bytes.length >= minimumBytes
      && bytes.length <= maximumBytes
      && bytes.toString("base64") === value
      ? bytes
      : null
  } catch {
    return null
  }
}

function validId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,199}$/.test(value)
}

function validNonce(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(value)
}

function validSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
}

function validGitSha(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{40,64}$/.test(value)
}

function validExpectedBindings(
  value: DnaProductionRuntimeAuthorityExpectedBindings,
): boolean {
  const stagePercentMatches = (value.stageId === "internal" && value.rolloutPercent === 5)
    || (value.stageId === "limited" && value.rolloutPercent === 25)
    || (value.stageId === "broad" && value.rolloutPercent === 50)
    || (value.stageId === "full" && value.rolloutPercent === 100)
  return validId(value.releaseId)
    && validId(value.deploymentId)
    && validOrigin(value.origin)
    && validGitSha(value.gitSha)
    && validSha256(value.packageSha256)
    && stagePercentMatches
}

type WithoutSignature<T> = T extends { signatureBase64: string }
  ? Omit<T, "signatureBase64">
  : never

function withoutSignature<T extends { signatureBase64: string }>(value: T): WithoutSignature<T> {
  const { signatureBase64: _signatureBase64, ...payload } = value
  return payload as WithoutSignature<T>
}

export function dnaProductionActionSigningBytes(
  payload: DnaProductionStageAuthorityPayload | DnaProductionRuntimeActivationPayload,
): Buffer {
  return Buffer.from(
    `DNA-PRODUCTION-ACTION\u0000${payload.purpose}\u0000${stableJson(payload)}`,
    "utf8",
  )
}

export function dnaProductionAuthorityArtifactSha256(value: unknown): string {
  return sha256Text(stableJson(value))
}

export function dnaProductionAuthorityNonceSha256(
  purpose: DnaProductionStageAuthorityPayload["purpose"]
    | DnaProductionRuntimeActivationPayload["purpose"],
  nonce: string,
): string {
  return sha256Text(`${purpose}\u0000${nonce}`)
}

function validTrustRoot(
  value: unknown,
  expectedRole: DnaProductionActionRole,
): value is DnaProductionActionTrustRoot {
  if (!exactKeys(value, [
    "schemaVersion", "keyId", "algorithm", "role", "environment",
    "publicKeySpkiBase64", "validFrom", "validUntil",
  ])) return false
  return value.schemaVersion === DNA_PRODUCTION_ACTION_TRUST_ROOT_VERSION
    && validId(value.keyId)
    && value.algorithm === "Ed25519"
    && value.role === expectedRole
    && value.environment === "production"
    && decodeCanonicalBase64(value.publicKeySpkiBase64, 32, 256) !== null
    && isIsoTimestamp(value.validFrom)
    && isIsoTimestamp(value.validUntil)
    && Date.parse(value.validFrom) < Date.parse(value.validUntil)
}

function commonAuthorityShape(value: Record<string, unknown>): boolean {
  return value.environment === "production"
    && validId(value.keyId)
    && validId(value.releaseId)
    && validId(value.deploymentId)
    && validOrigin(value.origin)
    && validGitSha(value.gitSha)
    && validSha256(value.packageSha256)
    && validSha256(value.policySha256)
    && validSha256(value.rolloutAuthorizationSha256)
    && validSha256(value.previousStageHealthSha256)
    && validSha256(value.observationAttestationSha256)
    && validNonce(value.nonce)
    && isIsoTimestamp(value.issuedAt)
    && isIsoTimestamp(value.expiresAt)
    && decodeCanonicalBase64(value.signatureBase64, 64, 64) !== null
}

function validStageAuthorityShape(value: unknown): value is DnaProductionStageAuthority {
  if (!exactKeys(value, STAGE_AUTHORITY_KEYS) || !commonAuthorityShape(value)) return false
  const bootstrap = value.schemaVersion === DNA_PRODUCTION_CANARY_BOOTSTRAP_AUTHORIZATION_VERSION
    && value.purpose === "production_canary_bootstrap"
    && value.stageId === "internal"
    && value.rolloutPercent === 5
    && value.previousStageId === "preview"
  const expectedPrevious = value.stageId === "limited"
    ? "internal"
    : value.stageId === "broad"
      ? "limited"
      : value.stageId === "full"
        ? "broad"
        : null
  const staged = value.schemaVersion === DNA_PRODUCTION_STAGED_ROLLOUT_AUTHORITY_VERSION
    && value.purpose === "production_staged_rollout"
    && ((value.stageId === "limited" && value.rolloutPercent === 25)
      || (value.stageId === "broad" && value.rolloutPercent === 50)
      || (value.stageId === "full" && value.rolloutPercent === 100))
    && value.previousStageId === expectedPrevious
  return bootstrap || staged
}

function validRuntimeActivationShape(value: unknown): value is DnaProductionRuntimeActivation {
  if (!exactKeys(value, RUNTIME_ACTIVATION_KEYS)
    || !commonAuthorityShape(value)
    || value.schemaVersion !== DNA_PRODUCTION_RUNTIME_ACTIVATION_VERSION
    || value.purpose !== "production_runtime_activation"
    || !validSha256(value.stageAuthoritySha256)) return false
  const expected = value.stageId === "internal"
    ? [5, "preview"]
    : value.stageId === "limited"
      ? [25, "internal"]
      : value.stageId === "broad"
        ? [50, "limited"]
        : value.stageId === "full"
          ? [100, "broad"]
          : null
  return expected !== null
    && value.rolloutPercent === expected[0]
    && value.previousStageId === expected[1]
}

type SignatureDecision = Readonly<{
  valid: boolean
  root: DnaProductionActionTrustRoot | null
  block: "time" | "root" | "signature" | null
}>

function verifyActionSignature(input: Readonly<{
  authorization: DnaProductionStageAuthority | DnaProductionRuntimeActivation
  expectedRole: DnaProductionActionRole
  trustRoots: readonly DnaProductionActionTrustRoot[]
  now: string
  notBefore: string
}>): SignatureDecision {
  const issuedAt = Date.parse(input.authorization.issuedAt)
  const expiresAt = Date.parse(input.authorization.expiresAt)
  const now = Date.parse(input.now)
  const notBefore = Date.parse(input.notBefore)
  if (!Number.isFinite(now) || !Number.isFinite(notBefore)
    || issuedAt < notBefore || issuedAt > now || expiresAt <= now
    || expiresAt <= issuedAt
    || expiresAt - issuedAt > DNA_PRODUCTION_ACTION_MAX_LIFETIME_MS) {
    return Object.freeze({ valid: false, root: null, block: "time" })
  }
  if (!Array.isArray(input.trustRoots)) {
    return Object.freeze({ valid: false, root: null, block: "root" })
  }
  const roots = input.trustRoots.filter((root) =>
    validTrustRoot(root, input.expectedRole)
    && root.keyId === input.authorization.keyId
    && Date.parse(root.validFrom) <= issuedAt
    && Date.parse(root.validUntil) >= expiresAt)
  if (roots.length !== 1) {
    return Object.freeze({ valid: false, root: null, block: "root" })
  }
  const root = roots[0]!
  let publicKey: KeyObject
  try {
    publicKey = createPublicKey({
      key: Buffer.from(root.publicKeySpkiBase64, "base64"),
      format: "der",
      type: "spki",
    })
    if (publicKey.asymmetricKeyType !== "ed25519") throw new Error("not_ed25519")
  } catch {
    return Object.freeze({ valid: false, root: null, block: "root" })
  }
  const verified = verifySignature(
    null,
    dnaProductionActionSigningBytes(withoutSignature(input.authorization)),
    publicKey,
    Buffer.from(input.authorization.signatureBase64, "base64"),
  )
  return verified
    ? Object.freeze({ valid: true, root, block: null })
    : Object.freeze({ valid: false, root: null, block: "signature" })
}

function blocked(
  blockCode: Exclude<DnaProductionRuntimeAuthorityDecision["blockCode"], null>,
): DnaProductionRuntimeAuthorityDecision {
  return Object.freeze({
    allowed: false,
    stageKeyId: null,
    activationKeyId: null,
    blockCode,
  })
}

function sameCommonBindings(
  value: DnaProductionStageAuthority | DnaProductionRuntimeActivation,
  expected: DnaProductionRuntimeAuthorityExpectedBindings,
  policy: DnaStagedRolloutPolicy,
  authorization: DnaStagedRolloutAuthorization,
  previousStageId: PreviousStageId,
  previousStageHealthSha256: string,
  observationAttestationSha256: string,
): boolean {
  return value.environment === "production"
    && value.releaseId === expected.releaseId
    && value.deploymentId === expected.deploymentId
    && value.origin === expected.origin
    && value.gitSha === expected.gitSha
    && value.packageSha256 === expected.packageSha256
    && value.policySha256 === policy.policySha256
    && value.rolloutAuthorizationSha256 === authorization.authorizationSha256
    && value.stageId === expected.stageId
    && value.rolloutPercent === expected.rolloutPercent
    && value.previousStageId === previousStageId
    && value.previousStageHealthSha256 === previousStageHealthSha256
    && value.observationAttestationSha256 === observationAttestationSha256
}

/**
 * Offline verifier for a complete production action chain.
 *
 * This function accepts explicit fixtures so sealed release tooling can test a
 * future authority. Runtime code must use only committed trust roots and
 * server-side signed envelopes; it must never forward request JSON here.
 */
export function verifyDnaProductionRuntimeAuthority(input: Readonly<{
  observationAttestation: unknown
  observationTrustRoots: readonly DnaExternalLiveObservationTrustRoot[]
  stageAuthority: unknown
  runtimeActivation: unknown
  bootstrapTrustRoots: readonly DnaProductionActionTrustRoot[]
  stagedRolloutTrustRoots: readonly DnaProductionActionTrustRoot[]
  runtimeActivationTrustRoots: readonly DnaProductionActionTrustRoot[]
  policy: DnaStagedRolloutPolicy
  rolloutAuthorization: DnaStagedRolloutAuthorization
  evidenceVerification: DnaStagedRolloutEvidenceVerification
  expected: DnaProductionRuntimeAuthorityExpectedBindings
  consumedNonceSha256?: readonly string[]
  now?: string
}>): DnaProductionRuntimeAuthorityDecision {
  if (!validExpectedBindings(input.expected)
    || (input.consumedNonceSha256 !== undefined
      && (!Array.isArray(input.consumedNonceSha256)
        || input.consumedNonceSha256.some((value) => !validSha256(value))))) {
    return blocked("production_stage_authority_binding_or_sequence_invalid")
  }
  const observation = input.observationAttestation as DnaExternalLiveObservationAttestation | null
  if (!observation || typeof observation !== "object"
    || observation.environment !== "production"
    || observation.deploymentId !== input.expected.deploymentId
    || observation.origin !== input.expected.origin
    || observation.gitSha !== input.expected.gitSha
    || observation.packageSha256 !== input.expected.packageSha256) {
    return blocked("production_observation_missing_or_invalid")
  }
  const now = input.now ?? new Date().toISOString()
  const observationDecision = verifyDnaExternalLiveObservationAttestation({
    attestation: observation,
    trustRoots: input.observationTrustRoots,
    expected: {
      environment: "production",
      runId: observation.runId,
      deploymentId: input.expected.deploymentId,
      origin: input.expected.origin,
      gitSha: input.expected.gitSha,
      packageSha256: input.expected.packageSha256,
      verificationManifestSha256: observation.verificationManifestSha256,
      deploymentArtifactSha256: observation.deploymentArtifactSha256,
      browserAggregateSha256: observation.browserAggregateSha256,
      functionLogAggregateSha256: observation.functionLogAggregateSha256,
      crossAccountAggregateSha256: observation.crossAccountAggregateSha256,
      verificationCompletedAt: observation.issuedAt,
    },
    now,
  })
  if (!observationDecision.valid) {
    return blocked("production_observation_missing_or_invalid")
  }

  const policy = input.policy
  const authorization = input.rolloutAuthorization
  const verification = input.evidenceVerification
  if (!validateDnaStagedRolloutPolicy(policy)
    || !validateDnaStagedRolloutAuthorization(authorization, policy)
    || !validateDnaStagedRolloutEvidenceVerification(verification, policy, authorization)
    || !verification.valid
    || policy.releaseId !== input.expected.releaseId
    || policy.packageSha256 !== input.expected.packageSha256
    || authorization.authorizedStageId !== input.expected.stageId
    || authorization.authorizedPercent !== input.expected.rolloutPercent) {
    return blocked("production_stage_health_missing_or_invalid")
  }
  const previousEvidence = authorization.priorStageEvidence.at(-1)
  const expectedPreviousStage = input.expected.stageId === "internal"
    ? "preview"
    : input.expected.stageId === "limited"
      ? "internal"
      : input.expected.stageId === "broad"
        ? "limited"
        : "broad"
  if (!previousEvidence
    || previousEvidence.stageId !== expectedPreviousStage
    || verification.rows.at(-1)?.stageId !== expectedPreviousStage
    || verification.rows.at(-1)?.status !== "pass"
    || verification.rows.at(-1)?.actualSha256 !== previousEvidence.evidenceSha256) {
    return blocked("production_stage_health_missing_or_invalid")
  }

  if (!validStageAuthorityShape(input.stageAuthority)) {
    return blocked("production_stage_authority_missing_or_invalid")
  }
  const stageAuthority = input.stageAuthority
  const observationSha256 = dnaProductionAuthorityArtifactSha256(observation)
  if (!sameCommonBindings(
    stageAuthority,
    input.expected,
    policy,
    authorization,
    expectedPreviousStage,
    previousEvidence.evidenceSha256,
    observationSha256,
  )) {
    return blocked("production_stage_authority_binding_or_sequence_invalid")
  }
  const expectedStageRole: DnaProductionActionRole = input.expected.stageId === "internal"
    ? "canary_bootstrap_authorizer"
    : "staged_rollout_authorizer"
  const stageRoots = input.expected.stageId === "internal"
    ? input.bootstrapTrustRoots
    : input.stagedRolloutTrustRoots
  const stageSignature = verifyActionSignature({
    authorization: stageAuthority,
    expectedRole: expectedStageRole,
    trustRoots: stageRoots,
    now,
    notBefore: [
      observation.issuedAt,
      authorization.authorizedAt,
      previousEvidence.completedAt,
    ].sort().at(-1)!,
  })
  if (!stageSignature.valid) {
    return blocked(stageSignature.block === "time"
      ? "production_stage_authority_time_invalid"
      : stageSignature.block === "root"
        ? "production_stage_authority_trust_root_missing_or_invalid"
        : "production_stage_authority_signature_invalid")
  }

  if (!validRuntimeActivationShape(input.runtimeActivation)) {
    return blocked("production_runtime_activation_missing_or_invalid")
  }
  const activation = input.runtimeActivation
  if (!sameCommonBindings(
    activation,
    input.expected,
    policy,
    authorization,
    expectedPreviousStage,
    previousEvidence.evidenceSha256,
    observationSha256,
  ) || activation.stageAuthoritySha256 !== dnaProductionAuthorityArtifactSha256(stageAuthority)) {
    return blocked("production_runtime_activation_binding_invalid")
  }
  if (Date.parse(activation.expiresAt) > Date.parse(stageAuthority.expiresAt)) {
    return blocked("production_runtime_activation_time_invalid")
  }
  const activationSignature = verifyActionSignature({
    authorization: activation,
    expectedRole: "runtime_activation_authorizer",
    trustRoots: input.runtimeActivationTrustRoots,
    now,
    notBefore: stageAuthority.issuedAt,
  })
  if (!activationSignature.valid) {
    return blocked(activationSignature.block === "time"
      ? "production_runtime_activation_time_invalid"
      : activationSignature.block === "root"
        ? "production_runtime_activation_trust_root_missing_or_invalid"
        : "production_runtime_activation_signature_invalid")
  }

  const consumed = new Set(input.consumedNonceSha256 ?? [])
  const stageNonceSha256 = dnaProductionAuthorityNonceSha256(
    stageAuthority.purpose,
    stageAuthority.nonce,
  )
  const activationNonceSha256 = dnaProductionAuthorityNonceSha256(
    activation.purpose,
    activation.nonce,
  )
  if (stageAuthority.nonce === activation.nonce
    || consumed.has(stageNonceSha256)
    || consumed.has(activationNonceSha256)) {
    return blocked("production_authority_nonce_replayed")
  }

  const matchingObservationRoots = input.observationTrustRoots.filter((root) =>
    root.keyId === observationDecision.keyId)
  const observationRoot = matchingObservationRoots.length === 1
    ? matchingObservationRoots[0]
    : null
  const distinctKeyIds = new Set([
    observationDecision.keyId,
    stageSignature.root?.keyId,
    activationSignature.root?.keyId,
  ])
  const distinctPublicKeys = new Set([
    observationRoot?.publicKeySpkiBase64,
    stageSignature.root?.publicKeySpkiBase64,
    activationSignature.root?.publicKeySpkiBase64,
  ])
  if (!observationRoot || distinctKeyIds.size !== 3 || distinctPublicKeys.size !== 3
    || [...distinctKeyIds].some((value) => !value)
    || [...distinctPublicKeys].some((value) => !value)) {
    return blocked("production_authority_role_separation_invalid")
  }

  return Object.freeze({
    allowed: true,
    stageKeyId: stageSignature.root!.keyId,
    activationKeyId: activationSignature.root!.keyId,
    blockCode: null,
  })
}

/**
 * Provision points are intentionally empty. Engineering exists, but no
 * organization-controlled authority has been provisioned; production V3 must
 * therefore remain fail-closed.
 */
export const DNA_CURRENT_PRODUCTION_CANARY_BOOTSTRAP_TRUST_ROOTS:
  readonly DnaProductionActionTrustRoot[] = Object.freeze([])
export const DNA_CURRENT_PRODUCTION_STAGED_ROLLOUT_TRUST_ROOTS:
  readonly DnaProductionActionTrustRoot[] = Object.freeze([])
export const DNA_CURRENT_PRODUCTION_RUNTIME_ACTIVATION_TRUST_ROOTS:
  readonly DnaProductionActionTrustRoot[] = Object.freeze([])
/**
 * Hook for nonce hashes revoked/consumed by an external release authority.
 * This immutable list is not an atomic issuance/consumption store.
 */
export const DNA_CURRENT_PRODUCTION_AUTHORITY_CONSUMED_NONCE_SHA256:
  readonly string[] = Object.freeze([])
/** Must remain false until an atomic, organization-controlled nonce authority exists. */
export const DNA_CURRENT_PRODUCTION_NONCE_REPLAY_AUTHORITY_PROVISIONED = false as const

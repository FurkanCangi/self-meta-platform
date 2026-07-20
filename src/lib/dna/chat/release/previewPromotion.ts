import { createHash, createPublicKey, verify as verifySignature } from "node:crypto"
import { lstatSync, readFileSync, realpathSync } from "node:fs"
import { isAbsolute, relative, resolve, sep } from "node:path"

export const DNA_PREVIEW_VERIFICATION_VERSION = "dna-preview-verification@1" as const
export const DNA_PRODUCTION_VERIFICATION_VERSION = "dna-production-verification@1" as const
export const DNA_PREVIEW_PROMOTION_GUARD_VERSION = "dna-preview-promotion-guard@1" as const
export const DNA_PREVIEW_DEPLOYMENT_ARTIFACT_VERSION =
  "dna-preview-deployment-artifact@1" as const
export const DNA_PREVIEW_CHECK_ARTIFACT_VERSION =
  "dna-preview-check-artifact@1" as const
export const DNA_PRODUCTION_DEPLOYMENT_ARTIFACT_VERSION =
  "dna-production-deployment-artifact@1" as const
export const DNA_PRODUCTION_CHECK_ARTIFACT_VERSION =
  "dna-production-check-artifact@1" as const
export const DNA_EXTERNAL_LIVE_OBSERVATION_ATTESTATION_VERSION =
  "dna-external-live-observation-attestation@1" as const
export const DNA_EXTERNAL_LIVE_OBSERVATION_TRUST_ROOT_VERSION =
  "dna-external-live-observation-trust-root@1" as const

export type DnaExternalLiveObservationEnvironment = "preview" | "production"

export type DnaExternalLiveObservationTrustRoot = Readonly<{
  schemaVersion: typeof DNA_EXTERNAL_LIVE_OBSERVATION_TRUST_ROOT_VERSION
  keyId: string
  algorithm: "Ed25519"
  environment: DnaExternalLiveObservationEnvironment | "both"
  publicKeySpkiBase64: string
  validFrom: string
  validUntil: string
}>

export type DnaExternalLiveObservationAttestationPayload = Readonly<{
  schemaVersion: typeof DNA_EXTERNAL_LIVE_OBSERVATION_ATTESTATION_VERSION
  environment: DnaExternalLiveObservationEnvironment
  keyId: string
  runId: string
  deploymentId: string
  origin: string
  gitSha: string
  packageSha256: string
  verificationManifestSha256: string
  deploymentArtifactSha256: string
  browserAggregateSha256: string
  functionLogAggregateSha256: string
  crossAccountAggregateSha256: string
  issuedAt: string
  expiresAt: string
}>

export type DnaExternalLiveObservationAttestation =
  DnaExternalLiveObservationAttestationPayload & Readonly<{
    signatureBase64: string
  }>

export type DnaExternalLiveObservationExpectedBindings = Readonly<{
  environment: DnaExternalLiveObservationEnvironment
  runId: string
  deploymentId: string
  origin: string
  gitSha: string
  packageSha256: string
  verificationManifestSha256: string
  deploymentArtifactSha256: string
  browserAggregateSha256: string
  functionLogAggregateSha256: string
  crossAccountAggregateSha256: string
  verificationCompletedAt: string
}>

export type DnaExternalLiveObservationDecision = Readonly<{
  valid: boolean
  keyId: string | null
  blockCode:
    | null
    | "external_live_attestation_missing_or_invalid"
    | "external_live_attestation_binding_mismatch"
    | "external_live_attestation_time_invalid"
    | "external_live_attestation_trust_root_missing_or_invalid"
    | "external_live_attestation_signature_invalid"
}>

export const DNA_REQUIRED_PREVIEW_CHECKS = Object.freeze([
  "login_and_session",
  "theory_short",
  "theory_standard",
  "theory_deep",
  "typo",
  "follow_up",
  "source_locator",
  "report_context_request",
  "owned_report",
  "foreign_missing_indistinguishable",
  "audit_failure_fail_closed",
  "viewport_390",
  "viewport_768",
  "viewport_1440",
  "light_theme",
  "dark_theme",
  "browser_console_clean",
  "function_log_clean",
  "no_ssd_or_debug_leak",
  "synthetic_cross_account",
] as const)

export const DNA_REQUIRED_PRODUCTION_CHECKS = Object.freeze([
  "deployment_commit_match",
  "package_hash_match",
  "unauthenticated_401",
  "private_no_store",
  "theory_standard",
  "theory_deep",
  "owned_case",
  "foreign_missing_404",
  "audit_metadata_minimized",
  "rate_limit",
  "production_log_clean",
  "synthetic_cross_account_smoke",
] as const)

type PreviewCheckId = (typeof DNA_REQUIRED_PREVIEW_CHECKS)[number]
type ProductionCheckId = (typeof DNA_REQUIRED_PRODUCTION_CHECKS)[number]

type VerificationCheck<Id extends string> = Readonly<{
  id: Id
  status: "pass" | "fail"
  evidenceSha256: string
}>

type VerificationArtifactDescriptor<Id extends string> = Readonly<{
  id: Id
  path: string
}>

export type DnaPreviewVerificationArtifactSet = Readonly<{
  evidenceRoot: string
  runId: string
  deploymentArtifactPath: string
  checkArtifacts: readonly VerificationArtifactDescriptor<PreviewCheckId>[]
}>

export type DnaProductionVerificationArtifactSet = Readonly<{
  evidenceRoot: string
  runId: string
  productionOrigin: string
  deploymentArtifactPath: string
  checkArtifacts: readonly VerificationArtifactDescriptor<ProductionCheckId>[]
}>

export type DnaVerificationArtifactDecision = Readonly<{
  valid: boolean
  runId: string | null
  deploymentArtifactSha256: string | null
  blockCodes: readonly string[]
}>

export type DnaPreviewVerificationManifestPayload = Readonly<{
  schemaVersion: typeof DNA_PREVIEW_VERIFICATION_VERSION
  previewDeploymentId: string
  previewArtifactSha256: string
  previewUrlOrigin: string
  deploymentState: "READY" | "ERROR" | "CANCELED"
  verifiedAt: string
  gitSha: string
  localPackageSha256: string
  previewPackageSha256: string
  evidenceBundleSha256: string
  evaluationAttestationSha256: string
  runtimeMode: "hybrid-v3" | "v3"
  checks: readonly VerificationCheck<PreviewCheckId>[]
}>

export type DnaPreviewVerificationManifest = DnaPreviewVerificationManifestPayload & Readonly<{
  manifestSha256: string
}>

export type DnaProductionVerificationManifestPayload = Readonly<{
  schemaVersion: typeof DNA_PRODUCTION_VERIFICATION_VERSION
  productionDeploymentId: string
  promotedPreviewDeploymentId: string
  promotedPreviewArtifactSha256: string
  promotionMethod: "promote_existing_preview"
  verifiedAt: string
  gitSha: string
  packageSha256: string
  checks: readonly VerificationCheck<ProductionCheckId>[]
}>

export type DnaProductionVerificationManifest = DnaProductionVerificationManifestPayload & Readonly<{
  manifestSha256: string
}>

export const DNA_PREVIEW_PROMOTION_BLOCK_CODES = Object.freeze([
  "preview_manifest_missing_or_invalid",
  "preview_not_ready",
  "preview_check_failed",
  "preview_commit_mismatch",
  "preview_package_mismatch",
  "preview_evidence_bundle_mismatch",
  "preview_evaluation_attestation_mismatch",
  "release_hard_no_go",
  "new_build_promotion_forbidden",
  "preview_artifact_mismatch",
  "preview_artifact_evidence_missing_or_invalid",
  "preview_external_live_observation_missing_or_invalid",
] as const)

export type DnaPreviewPromotionBlockCode =
  (typeof DNA_PREVIEW_PROMOTION_BLOCK_CODES)[number]

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

function sha256Bytes(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex")
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

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value
}

function validOrigin(value: unknown): value is string {
  if (typeof value !== "string") return false
  try {
    const url = new URL(value)
    return url.origin === value && url.protocol === "https:"
  } catch {
    return false
  }
}

function validSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
}

function validGitSha(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{40}$/.test(value)
}

function decodeCanonicalBase64(value: unknown, minimumBytes: number, maximumBytes: number): Buffer | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 512
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null
  try {
    const bytes = Buffer.from(value, "base64")
    return bytes.length >= minimumBytes && bytes.length <= maximumBytes
      && bytes.toString("base64") === value
      ? bytes
      : null
  } catch {
    return null
  }
}

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,199}$/
const ARTIFACT_PATH = /^[A-Za-z0-9][A-Za-z0-9._@/\-]{2,399}\.json$/

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER.test(value)
}


const EXTERNAL_LIVE_ATTESTATION_PAYLOAD_KEYS = Object.freeze([
  "schemaVersion", "environment", "keyId", "runId", "deploymentId", "origin",
  "gitSha", "packageSha256", "verificationManifestSha256",
  "deploymentArtifactSha256", "browserAggregateSha256",
  "functionLogAggregateSha256", "crossAccountAggregateSha256", "issuedAt", "expiresAt",
] as const)

function validExternalLiveObservationPayload(
  value: unknown,
): value is DnaExternalLiveObservationAttestationPayload {
  if (!exactKeys(value, EXTERNAL_LIVE_ATTESTATION_PAYLOAD_KEYS)) return false
  return value.schemaVersion === DNA_EXTERNAL_LIVE_OBSERVATION_ATTESTATION_VERSION
    && (value.environment === "preview" || value.environment === "production")
    && validIdentifier(value.keyId)
    && validIdentifier(value.runId)
    && validIdentifier(value.deploymentId)
    && validOrigin(value.origin)
    && validGitSha(value.gitSha)
    && validSha256(value.packageSha256)
    && validSha256(value.verificationManifestSha256)
    && validSha256(value.deploymentArtifactSha256)
    && validSha256(value.browserAggregateSha256)
    && validSha256(value.functionLogAggregateSha256)
    && validSha256(value.crossAccountAggregateSha256)
    && validTimestamp(value.issuedAt)
    && validTimestamp(value.expiresAt)
}

function validExternalLiveObservationTrustRoot(
  value: unknown,
): value is DnaExternalLiveObservationTrustRoot {
  if (!exactKeys(value, [
    "schemaVersion", "keyId", "algorithm", "environment", "publicKeySpkiBase64",
    "validFrom", "validUntil",
  ])) return false
  if (value.schemaVersion !== DNA_EXTERNAL_LIVE_OBSERVATION_TRUST_ROOT_VERSION
    || value.algorithm !== "Ed25519"
    || !["preview", "production", "both"].includes(String(value.environment))
    || !validIdentifier(value.keyId)
    || !validTimestamp(value.validFrom)
    || !validTimestamp(value.validUntil)
    || Date.parse(value.validFrom) >= Date.parse(value.validUntil)) return false
  const publicKeyBytes = decodeCanonicalBase64(value.publicKeySpkiBase64, 40, 128)
  if (!publicKeyBytes) return false
  try {
    const publicKey = createPublicKey({ key: publicKeyBytes, format: "der", type: "spki" })
    return publicKey.asymmetricKeyType === "ed25519"
  } catch {
    return false
  }
}

/** Canonical bytes signed by the external live-observation runner. */
export function dnaExternalLiveObservationSigningBytes(
  payload: DnaExternalLiveObservationAttestationPayload,
): Buffer {
  if (!validExternalLiveObservationPayload(payload)) {
    throw new Error("dna_external_live_observation_payload_invalid")
  }
  return Buffer.from(stableJson(payload), "utf8")
}

function validArtifactPath(value: unknown): value is string {
  return typeof value === "string"
    && ARTIFACT_PATH.test(value)
    && !isAbsolute(value)
    && !value.split("/").includes("..")
}

function readRegularJsonArtifact(input: Readonly<{
  root: string
  path: string
}>): Readonly<{
  value: unknown
  sha256: string
}> | null {
  if (!validArtifactPath(input.path)) return null
  try {
    const root = realpathSync(resolve(input.root))
    const lexicalPath = resolve(root, input.path)
    const lexicalRelative = relative(root, lexicalPath)
    if (lexicalRelative === ".." || lexicalRelative.startsWith(`..${sep}`)
      || isAbsolute(lexicalRelative)) return null

    // A release artifact must be a real regular file, never a symlink. The
    // realpath containment check also rejects traversal through a symlinked
    // parent directory that escapes the explicitly allowed root.
    if (!lstatSync(lexicalPath).isFile()) return null
    const realPath = realpathSync(lexicalPath)
    const realRelative = relative(root, realPath)
    if (realRelative === ".." || realRelative.startsWith(`..${sep}`)
      || isAbsolute(realRelative)) return null

    const bytes = readFileSync(realPath)
    const text = bytes.toString("utf8")
    if (!text.trim() || text.includes("\u0000")) return null
    const parsed = JSON.parse(text) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
    return Object.freeze({ value: parsed, sha256: sha256Bytes(bytes) })
  } catch {
    return null
  }
}

function validArtifactDescriptorSet<Id extends string>(input: Readonly<{
  evidenceRoot: unknown
  runId: unknown
  deploymentArtifactPath: unknown
  checkArtifacts: unknown
}>, required: readonly Id[]): input is Readonly<{
  evidenceRoot: string
  runId: string
  deploymentArtifactPath: string
  checkArtifacts: readonly VerificationArtifactDescriptor<Id>[]
}> {
  if (typeof input.evidenceRoot !== "string" || !input.evidenceRoot.trim()
    || !validIdentifier(input.runId)
    || !validArtifactPath(input.deploymentArtifactPath)
    || !Array.isArray(input.checkArtifacts)
    || input.checkArtifacts.length !== required.length) return false
  const requiredSet = new Set<string>(required)
  const ids: string[] = []
  const paths: string[] = []
  for (const descriptor of input.checkArtifacts) {
    if (!exactKeys(descriptor, ["id", "path"])
      || typeof descriptor.id !== "string" || !requiredSet.has(descriptor.id)
      || !validArtifactPath(descriptor.path)) return false
    ids.push(descriptor.id)
    paths.push(descriptor.path)
  }
  return new Set(ids).size === required.length
    && new Set(paths).size === required.length
    && !paths.includes(input.deploymentArtifactPath)
}

function validateChecks<Id extends string>(
  value: unknown,
  required: readonly Id[],
): value is readonly VerificationCheck<Id>[] {
  if (!Array.isArray(value) || value.length !== required.length) return false
  const requiredSet = new Set<string>(required)
  const ids: string[] = []
  for (const check of value) {
    if (!exactKeys(check, ["id", "status", "evidenceSha256"])
      || typeof check.id !== "string" || !requiredSet.has(check.id)
      || (check.status !== "pass" && check.status !== "fail")
      || typeof check.evidenceSha256 !== "string" || !/^[a-f0-9]{64}$/.test(check.evidenceSha256)) {
      return false
    }
    ids.push(check.id)
  }
  return new Set(ids).size === required.length
}

function orderedChecks<Id extends string>(
  checks: readonly VerificationCheck<Id>[],
  required: readonly Id[],
): readonly VerificationCheck<Id>[] {
  const byId = new Map(checks.map((check) => [check.id, check]))
  return Object.freeze(required.map((id) => Object.freeze({ ...byId.get(id)! })))
}

const PREVIEW_EXTERNAL_LIVE_CHECK_GROUPS = Object.freeze({
  browser: Object.freeze([
    "login_and_session", "theory_short", "theory_standard", "theory_deep", "typo",
    "follow_up", "source_locator", "report_context_request", "owned_report",
    "viewport_390", "viewport_768", "viewport_1440", "light_theme", "dark_theme",
    "browser_console_clean",
  ] satisfies readonly PreviewCheckId[]),
  functionLog: Object.freeze([
    "audit_failure_fail_closed", "function_log_clean", "no_ssd_or_debug_leak",
  ] satisfies readonly PreviewCheckId[]),
  crossAccount: Object.freeze([
    "foreign_missing_indistinguishable", "synthetic_cross_account",
  ] satisfies readonly PreviewCheckId[]),
})

const PRODUCTION_EXTERNAL_LIVE_CHECK_GROUPS = Object.freeze({
  browser: Object.freeze([
    "unauthenticated_401", "private_no_store", "theory_standard", "theory_deep",
    "owned_case", "foreign_missing_404", "rate_limit",
  ] satisfies readonly ProductionCheckId[]),
  functionLog: Object.freeze([
    "audit_metadata_minimized", "production_log_clean",
  ] satisfies readonly ProductionCheckId[]),
  crossAccount: Object.freeze([
    "foreign_missing_404", "synthetic_cross_account_smoke",
  ] satisfies readonly ProductionCheckId[]),
})

function externalLiveCheckAggregateSha256(
  environment: DnaExternalLiveObservationEnvironment,
  group: "browser" | "function_log" | "cross_account",
  checks: readonly VerificationCheck<string>[],
  ids: readonly string[],
): string {
  const byId = new Map(checks.map((check) => [check.id, check]))
  return sha256({
    schemaVersion: DNA_EXTERNAL_LIVE_OBSERVATION_ATTESTATION_VERSION,
    environment,
    group,
    checks: ids.map((id) => {
      const check = byId.get(id)
      if (!check) throw new Error("dna_external_live_observation_check_missing")
      return { id: check.id, status: check.status, evidenceSha256: check.evidenceSha256 }
    }),
  })
}

/**
 * Derives the three live-observation aggregate hashes from the exact manifest
 * check hashes. The external runner signs these values; the release decision
 * recomputes them instead of accepting caller-selected aggregate hashes.
 */
export function deriveDnaExternalLiveObservationAggregateHashes(input: Readonly<{
  environment: "preview"
  checks: readonly VerificationCheck<PreviewCheckId>[]
}> | Readonly<{
  environment: "production"
  checks: readonly VerificationCheck<ProductionCheckId>[]
}>): Readonly<{
  browserAggregateSha256: string
  functionLogAggregateSha256: string
  crossAccountAggregateSha256: string
}> {
  const groups = input.environment === "preview"
    ? PREVIEW_EXTERNAL_LIVE_CHECK_GROUPS
    : PRODUCTION_EXTERNAL_LIVE_CHECK_GROUPS
  return Object.freeze({
    browserAggregateSha256: externalLiveCheckAggregateSha256(
      input.environment, "browser", input.checks, groups.browser,
    ),
    functionLogAggregateSha256: externalLiveCheckAggregateSha256(
      input.environment, "function_log", input.checks, groups.functionLog,
    ),
    crossAccountAggregateSha256: externalLiveCheckAggregateSha256(
      input.environment, "cross_account", input.checks, groups.crossAccount,
    ),
  })
}

function externalLiveObservationPayload(
  attestation: DnaExternalLiveObservationAttestation,
): DnaExternalLiveObservationAttestationPayload {
  const { signatureBase64: _signatureBase64, ...payload } = attestation
  return payload
}

/**
 * Low-level verifier for offline tooling and isolated tests. Explicit trust
 * roots are accepted here only; action-facing release decisions below always
 * use the committed trust-root authority and expose no key/boolean override.
 */
export function verifyDnaExternalLiveObservationAttestation(input: Readonly<{
  attestation: unknown
  trustRoots: readonly DnaExternalLiveObservationTrustRoot[]
  expected: DnaExternalLiveObservationExpectedBindings
  now?: string
}>): DnaExternalLiveObservationDecision {
  const invalid = (blockCode: Exclude<DnaExternalLiveObservationDecision["blockCode"], null>) =>
    Object.freeze({ valid: false, keyId: null, blockCode })
  if (!exactKeys(input.attestation, [...EXTERNAL_LIVE_ATTESTATION_PAYLOAD_KEYS, "signatureBase64"])) {
    return invalid("external_live_attestation_missing_or_invalid")
  }
  const { signatureBase64, ...unsignedPayload } = input.attestation
  if (!validExternalLiveObservationPayload(unsignedPayload)
    || !decodeCanonicalBase64(signatureBase64, 64, 64)) {
    return invalid("external_live_attestation_missing_or_invalid")
  }
  const attestation = input.attestation as DnaExternalLiveObservationAttestation
  const expected = input.expected
  if (attestation.environment !== expected.environment
    || attestation.runId !== expected.runId
    || attestation.deploymentId !== expected.deploymentId
    || attestation.origin !== expected.origin
    || attestation.gitSha !== expected.gitSha
    || attestation.packageSha256 !== expected.packageSha256
    || attestation.verificationManifestSha256 !== expected.verificationManifestSha256
    || attestation.deploymentArtifactSha256 !== expected.deploymentArtifactSha256
    || attestation.browserAggregateSha256 !== expected.browserAggregateSha256
    || attestation.functionLogAggregateSha256 !== expected.functionLogAggregateSha256
    || attestation.crossAccountAggregateSha256 !== expected.crossAccountAggregateSha256) {
    return invalid("external_live_attestation_binding_mismatch")
  }

  const issuedAt = Date.parse(attestation.issuedAt)
  const expiresAt = Date.parse(attestation.expiresAt)
  const completedAt = Date.parse(expected.verificationCompletedAt)
  const nowValue = input.now ?? new Date().toISOString()
  const now = validTimestamp(nowValue) ? Date.parse(nowValue) : Number.NaN
  const maximumLifetimeMs = 24 * 60 * 60 * 1000
  if (!Number.isFinite(completedAt) || !Number.isFinite(now)
    || issuedAt < completedAt || issuedAt > now || expiresAt <= now
    || expiresAt <= issuedAt || expiresAt - issuedAt > maximumLifetimeMs) {
    return invalid("external_live_attestation_time_invalid")
  }

  if (!Array.isArray(input.trustRoots)) {
    return invalid("external_live_attestation_trust_root_missing_or_invalid")
  }
  const matchingRoots = input.trustRoots.filter((root) =>
    validExternalLiveObservationTrustRoot(root)
    && root.keyId === attestation.keyId
    && (root.environment === "both" || root.environment === attestation.environment)
    && Date.parse(root.validFrom) <= issuedAt
    && Date.parse(root.validUntil) >= expiresAt)
  if (matchingRoots.length !== 1) {
    return invalid("external_live_attestation_trust_root_missing_or_invalid")
  }

  const signature = decodeCanonicalBase64(attestation.signatureBase64, 64, 64)!
  const root = matchingRoots[0]!
  try {
    const publicKey = createPublicKey({
      key: Buffer.from(root.publicKeySpkiBase64, "base64"),
      format: "der",
      type: "spki",
    })
    const verified = verifySignature(
      null,
      dnaExternalLiveObservationSigningBytes(externalLiveObservationPayload(attestation)),
      publicKey,
      signature,
    )
    return verified
      ? Object.freeze({ valid: true, keyId: attestation.keyId, blockCode: null })
      : invalid("external_live_attestation_signature_invalid")
  } catch {
    return invalid("external_live_attestation_signature_invalid")
  }
}

/**
 * Release authority provision point. Intentionally empty until an organization
 * controlled Ed25519 public key has been reviewed and committed. Consequently
 * preview promotion and production release remain fail-closed today.
 */
export const DNA_CURRENT_EXTERNAL_LIVE_OBSERVATION_TRUST_ROOTS:
  readonly DnaExternalLiveObservationTrustRoot[] = Object.freeze([])

export function createDnaPreviewVerificationManifest(
  input: DnaPreviewVerificationManifestPayload,
): DnaPreviewVerificationManifest {
  const payload: DnaPreviewVerificationManifestPayload = {
    ...input,
    checks: orderedChecks(input.checks, DNA_REQUIRED_PREVIEW_CHECKS),
  }
  const manifest = { ...payload, manifestSha256: sha256(payload) }
  if (!validateDnaPreviewVerificationManifest(manifest)) {
    throw new Error("dna_preview_verification_manifest_invalid")
  }
  return deepFreeze(manifest)
}

export function validateDnaPreviewVerificationManifest(
  value: unknown,
): value is DnaPreviewVerificationManifest {
  if (!exactKeys(value, [
    "schemaVersion", "previewDeploymentId", "previewArtifactSha256", "previewUrlOrigin",
    "deploymentState", "verifiedAt", "gitSha", "localPackageSha256",
    "previewPackageSha256", "evidenceBundleSha256", "evaluationAttestationSha256",
    "runtimeMode", "checks", "manifestSha256",
  ])) return false
  if (value.schemaVersion !== DNA_PREVIEW_VERIFICATION_VERSION
    || typeof value.previewDeploymentId !== "string"
    || !/^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,199}$/.test(value.previewDeploymentId)
    || !validOrigin(value.previewUrlOrigin)
    || !validTimestamp(value.verifiedAt)
    || !["READY", "ERROR", "CANCELED"].includes(String(value.deploymentState))
    || !["hybrid-v3", "v3"].includes(String(value.runtimeMode))) return false
  for (const hash of [
    value.previewArtifactSha256, value.localPackageSha256, value.previewPackageSha256,
    value.evidenceBundleSha256, value.evaluationAttestationSha256, value.manifestSha256,
  ]) if (typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash)) return false
  if (typeof value.gitSha !== "string" || !/^[a-f0-9]{40}$/.test(value.gitSha)
    || !validateChecks(value.checks, DNA_REQUIRED_PREVIEW_CHECKS)) return false
  const { manifestSha256, ...payload } = value as unknown as DnaPreviewVerificationManifest
  return sha256(payload) === manifestSha256
}

export function createDnaProductionVerificationManifest(
  input: DnaProductionVerificationManifestPayload,
): DnaProductionVerificationManifest {
  const payload: DnaProductionVerificationManifestPayload = {
    ...input,
    checks: orderedChecks(input.checks, DNA_REQUIRED_PRODUCTION_CHECKS),
  }
  const manifest = { ...payload, manifestSha256: sha256(payload) }
  if (!validateDnaProductionVerificationManifest(manifest)) {
    throw new Error("dna_production_verification_manifest_invalid")
  }
  return deepFreeze(manifest)
}

export function validateDnaProductionVerificationManifest(
  value: unknown,
): value is DnaProductionVerificationManifest {
  if (!exactKeys(value, [
    "schemaVersion", "productionDeploymentId", "promotedPreviewDeploymentId",
    "promotedPreviewArtifactSha256", "promotionMethod", "verifiedAt", "gitSha",
    "packageSha256", "checks", "manifestSha256",
  ])) return false
  if (value.schemaVersion !== DNA_PRODUCTION_VERIFICATION_VERSION
    || value.promotionMethod !== "promote_existing_preview"
    || !validTimestamp(value.verifiedAt)
    || typeof value.gitSha !== "string" || !/^[a-f0-9]{40}$/.test(value.gitSha)
    || !validateChecks(value.checks, DNA_REQUIRED_PRODUCTION_CHECKS)) return false
  for (const id of [value.productionDeploymentId, value.promotedPreviewDeploymentId]) {
    if (typeof id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,199}$/.test(id)) return false
  }
  for (const hash of [
    value.promotedPreviewArtifactSha256, value.packageSha256, value.manifestSha256,
  ]) if (typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash)) return false
  const { manifestSha256, ...payload } = value as unknown as DnaProductionVerificationManifest
  return sha256(payload) === manifestSha256
}

function validPreviewDeploymentArtifact(
  value: unknown,
  manifest: DnaPreviewVerificationManifest,
  runId: string,
): boolean {
  if (!exactKeys(value, [
    "schemaVersion", "runId", "deploymentId", "origin", "deploymentState",
    "gitSha", "packageSha256", "runtimeMode", "verifiedAt",
  ])) return false
  return value.schemaVersion === DNA_PREVIEW_DEPLOYMENT_ARTIFACT_VERSION
    && value.runId === runId
    && value.deploymentId === manifest.previewDeploymentId
    && value.origin === manifest.previewUrlOrigin
    && value.deploymentState === manifest.deploymentState
    && value.gitSha === manifest.gitSha
    && value.packageSha256 === manifest.previewPackageSha256
    && value.runtimeMode === manifest.runtimeMode
    && value.verifiedAt === manifest.verifiedAt
}

function validPreviewCheckArtifact(
  value: unknown,
  manifest: DnaPreviewVerificationManifest,
  check: VerificationCheck<PreviewCheckId>,
  runId: string,
): boolean {
  if (!exactKeys(value, [
    "schemaVersion", "runId", "checkId", "status", "deploymentId", "origin",
    "gitSha", "packageSha256", "previewArtifactSha256", "verifiedAt",
  ])) return false
  return value.schemaVersion === DNA_PREVIEW_CHECK_ARTIFACT_VERSION
    && value.runId === runId
    && value.checkId === check.id
    && value.status === check.status
    && value.deploymentId === manifest.previewDeploymentId
    && value.origin === manifest.previewUrlOrigin
    && value.gitSha === manifest.gitSha
    && value.packageSha256 === manifest.previewPackageSha256
    && value.previewArtifactSha256 === manifest.previewArtifactSha256
    && value.verifiedAt === manifest.verifiedAt
}

function validProductionDeploymentArtifact(
  value: unknown,
  manifest: DnaProductionVerificationManifest,
  artifacts: DnaProductionVerificationArtifactSet,
): boolean {
  if (!exactKeys(value, [
    "schemaVersion", "runId", "deploymentId", "origin", "gitSha", "packageSha256",
    "promotedPreviewDeploymentId", "promotedPreviewArtifactSha256",
    "promotionMethod", "verifiedAt",
  ])) return false
  return value.schemaVersion === DNA_PRODUCTION_DEPLOYMENT_ARTIFACT_VERSION
    && value.runId === artifacts.runId
    && value.deploymentId === manifest.productionDeploymentId
    && value.origin === artifacts.productionOrigin
    && value.gitSha === manifest.gitSha
    && value.packageSha256 === manifest.packageSha256
    && value.promotedPreviewDeploymentId === manifest.promotedPreviewDeploymentId
    && value.promotedPreviewArtifactSha256 === manifest.promotedPreviewArtifactSha256
    && value.promotionMethod === manifest.promotionMethod
    && value.verifiedAt === manifest.verifiedAt
}

function validProductionCheckArtifact(
  value: unknown,
  manifest: DnaProductionVerificationManifest,
  check: VerificationCheck<ProductionCheckId>,
  artifacts: DnaProductionVerificationArtifactSet,
  productionArtifactSha256: string,
): boolean {
  if (!exactKeys(value, [
    "schemaVersion", "runId", "checkId", "status", "deploymentId", "origin",
    "gitSha", "packageSha256", "promotedPreviewDeploymentId",
    "promotedPreviewArtifactSha256", "productionArtifactSha256", "verifiedAt",
  ])) return false
  return value.schemaVersion === DNA_PRODUCTION_CHECK_ARTIFACT_VERSION
    && value.runId === artifacts.runId
    && value.checkId === check.id
    && value.status === check.status
    && value.deploymentId === manifest.productionDeploymentId
    && value.origin === artifacts.productionOrigin
    && value.gitSha === manifest.gitSha
    && value.packageSha256 === manifest.packageSha256
    && value.promotedPreviewDeploymentId === manifest.promotedPreviewDeploymentId
    && value.promotedPreviewArtifactSha256 === manifest.promotedPreviewArtifactSha256
    && value.productionArtifactSha256 === productionArtifactSha256
    && value.verifiedAt === manifest.verifiedAt
}

/**
 * Re-opens every preview verification artifact at the promotion boundary.
 * Manifest hash syntax alone is intentionally insufficient: the byte hashes
 * and deployment/run bindings must resolve to regular JSON files below one
 * explicitly allowed root on every decision.
 */
export function verifyDnaPreviewVerificationArtifacts(input: Readonly<{
  manifest: DnaPreviewVerificationManifest
  artifacts: DnaPreviewVerificationArtifactSet
}>): DnaVerificationArtifactDecision {
  const blocks: string[] = []
  if (!validateDnaPreviewVerificationManifest(input.manifest)
    || !validArtifactDescriptorSet(input.artifacts, DNA_REQUIRED_PREVIEW_CHECKS)) {
    blocks.push("preview_artifact_set_invalid")
    return deepFreeze({
      valid: false,
      runId: null,
      deploymentArtifactSha256: null,
      blockCodes: Object.freeze(blocks),
    })
  }

  const deploymentArtifact = readRegularJsonArtifact({
    root: input.artifacts.evidenceRoot,
    path: input.artifacts.deploymentArtifactPath,
  })
  if (!deploymentArtifact
    || !validPreviewDeploymentArtifact(
      deploymentArtifact.value,
      input.manifest,
      input.artifacts.runId,
    )) {
    blocks.push("preview_deployment_artifact_missing_or_binding_mismatch")
  } else if (deploymentArtifact.sha256 !== input.manifest.previewArtifactSha256) {
    blocks.push("preview_deployment_artifact_hash_mismatch")
  }

  const descriptorById = new Map(input.artifacts.checkArtifacts.map((row) => [row.id, row]))
  const checkById = new Map(input.manifest.checks.map((row) => [row.id, row]))
  for (const id of DNA_REQUIRED_PREVIEW_CHECKS) {
    const descriptor = descriptorById.get(id)!
    const check = checkById.get(id)!
    const artifact = readRegularJsonArtifact({
      root: input.artifacts.evidenceRoot,
      path: descriptor.path,
    })
    if (!artifact || !validPreviewCheckArtifact(
      artifact.value,
      input.manifest,
      check,
      input.artifacts.runId,
    )) {
      blocks.push("preview_check_artifact_missing_or_binding_mismatch")
      continue
    }
    if (artifact.sha256 !== check.evidenceSha256) {
      blocks.push("preview_check_artifact_hash_mismatch")
    }
  }

  const blockCodes = Object.freeze([...new Set(blocks)])
  return deepFreeze({
    valid: blockCodes.length === 0,
    runId: input.artifacts.runId,
    deploymentArtifactSha256: deploymentArtifact?.sha256 ?? null,
    blockCodes,
  })
}

/** Production counterpart of `verifyDnaPreviewVerificationArtifacts`. */
export function verifyDnaProductionVerificationArtifacts(input: Readonly<{
  manifest: DnaProductionVerificationManifest
  artifacts: DnaProductionVerificationArtifactSet
}>): DnaVerificationArtifactDecision {
  const blocks: string[] = []
  if (!validateDnaProductionVerificationManifest(input.manifest)
    || !validOrigin(input.artifacts.productionOrigin)
    || !validArtifactDescriptorSet(input.artifacts, DNA_REQUIRED_PRODUCTION_CHECKS)) {
    blocks.push("production_artifact_set_invalid")
    return deepFreeze({
      valid: false,
      runId: null,
      deploymentArtifactSha256: null,
      blockCodes: Object.freeze(blocks),
    })
  }

  const deploymentArtifact = readRegularJsonArtifact({
    root: input.artifacts.evidenceRoot,
    path: input.artifacts.deploymentArtifactPath,
  })
  if (!deploymentArtifact
    || !validProductionDeploymentArtifact(
      deploymentArtifact.value,
      input.manifest,
      input.artifacts,
    )) {
    blocks.push("production_deployment_artifact_missing_or_binding_mismatch")
  }

  const descriptorById = new Map(input.artifacts.checkArtifacts.map((row) => [row.id, row]))
  const checkById = new Map(input.manifest.checks.map((row) => [row.id, row]))
  for (const id of DNA_REQUIRED_PRODUCTION_CHECKS) {
    const descriptor = descriptorById.get(id)!
    const check = checkById.get(id)!
    const artifact = readRegularJsonArtifact({
      root: input.artifacts.evidenceRoot,
      path: descriptor.path,
    })
    if (!artifact || !deploymentArtifact || !validProductionCheckArtifact(
      artifact.value,
      input.manifest,
      check,
      input.artifacts,
      deploymentArtifact.sha256,
    )) {
      blocks.push("production_check_artifact_missing_or_binding_mismatch")
      continue
    }
    if (artifact.sha256 !== check.evidenceSha256) {
      blocks.push("production_check_artifact_hash_mismatch")
    }
  }

  const blockCodes = Object.freeze([...new Set(blocks)])
  return deepFreeze({
    valid: blockCodes.length === 0,
    runId: input.artifacts.runId,
    deploymentArtifactSha256: deploymentArtifact?.sha256 ?? null,
    blockCodes,
  })
}

export function evaluateDnaPreviewPromotion(input: Readonly<{
  previewManifest: DnaPreviewVerificationManifest | null
  previewArtifacts?: DnaPreviewVerificationArtifactSet | null
  externalLiveObservationAttestation?: DnaExternalLiveObservationAttestation | null
  expectedGitSha: string
  expectedPackageSha256: string
  expectedEvidenceBundleSha256: string
  expectedEvaluationAttestationSha256: string
  releaseHardNoGoAllowed: boolean
  request: Readonly<{
    method: "promote_existing_preview" | "new_build"
    previewDeploymentId: string
    previewArtifactSha256: string
  }>
}>): Readonly<{
  schemaVersion: typeof DNA_PREVIEW_PROMOTION_GUARD_VERSION
  allowed: boolean
  decision: "promote" | "blocked"
  blockCodes: readonly DnaPreviewPromotionBlockCode[]
}> {
  const blocks: DnaPreviewPromotionBlockCode[] = []
  const manifest = input.previewManifest
  let externalLiveObservationValid = false
  if (!manifest || !validateDnaPreviewVerificationManifest(manifest)) {
    blocks.push("preview_manifest_missing_or_invalid")
  } else {
    if (manifest.deploymentState !== "READY") blocks.push("preview_not_ready")
    if (manifest.checks.some((check) => check.status !== "pass")) blocks.push("preview_check_failed")
    if (manifest.gitSha !== input.expectedGitSha) blocks.push("preview_commit_mismatch")
    if (manifest.localPackageSha256 !== input.expectedPackageSha256
      || manifest.previewPackageSha256 !== input.expectedPackageSha256) {
      blocks.push("preview_package_mismatch")
    }
    if (manifest.evidenceBundleSha256 !== input.expectedEvidenceBundleSha256) {
      blocks.push("preview_evidence_bundle_mismatch")
    }
    if (manifest.evaluationAttestationSha256 !== input.expectedEvaluationAttestationSha256) {
      blocks.push("preview_evaluation_attestation_mismatch")
    }
    if (manifest.previewDeploymentId !== input.request.previewDeploymentId
      || manifest.previewArtifactSha256 !== input.request.previewArtifactSha256) {
      blocks.push("preview_artifact_mismatch")
    }
    const artifactDecision = input.previewArtifacts
      ? verifyDnaPreviewVerificationArtifacts({
          manifest,
          artifacts: input.previewArtifacts,
        })
      : null
    if (!artifactDecision?.valid) {
      blocks.push("preview_artifact_evidence_missing_or_invalid")
    } else {
      const aggregateHashes = deriveDnaExternalLiveObservationAggregateHashes({
        environment: "preview",
        checks: manifest.checks,
      })
      const externalDecision = verifyDnaExternalLiveObservationAttestation({
        attestation: input.externalLiveObservationAttestation,
        trustRoots: DNA_CURRENT_EXTERNAL_LIVE_OBSERVATION_TRUST_ROOTS,
        expected: {
          environment: "preview",
          runId: artifactDecision.runId!,
          deploymentId: manifest.previewDeploymentId,
          origin: manifest.previewUrlOrigin,
          gitSha: manifest.gitSha,
          packageSha256: manifest.previewPackageSha256,
          verificationManifestSha256: manifest.manifestSha256,
          deploymentArtifactSha256: artifactDecision.deploymentArtifactSha256!,
          ...aggregateHashes,
          verificationCompletedAt: manifest.verifiedAt,
        },
      })
      externalLiveObservationValid = externalDecision.valid
    }
  }
  if (!externalLiveObservationValid) {
    blocks.push("preview_external_live_observation_missing_or_invalid")
  }
  if (!input.releaseHardNoGoAllowed) blocks.push("release_hard_no_go")
  if (input.request.method !== "promote_existing_preview") {
    blocks.push("new_build_promotion_forbidden")
  }
  const blockCodes = Object.freeze([...new Set(blocks)])
  return Object.freeze({
    schemaVersion: DNA_PREVIEW_PROMOTION_GUARD_VERSION,
    allowed: blockCodes.length === 0,
    decision: blockCodes.length === 0 ? "promote" : "blocked",
    blockCodes,
  })
}

/**
 * Low-level cryptographic and file verifier. A true result is not a production
 * release authorization; only the no-argument current guard may authorize the
 * committed release authorities.
 */
export function verifyDnaProductionDeploymentEvidence(input: Readonly<{
  productionManifest: DnaProductionVerificationManifest | null
  previewManifest: DnaPreviewVerificationManifest | null
  previewArtifacts?: DnaPreviewVerificationArtifactSet | null
  productionArtifacts?: DnaProductionVerificationArtifactSet | null
  previewExternalLiveObservationAttestation?: DnaExternalLiveObservationAttestation | null
  productionExternalLiveObservationAttestation?: DnaExternalLiveObservationAttestation | null
}>): Readonly<{ verified: boolean; blockCodes: readonly string[] }> {
  const blocks: string[] = []
  const production = input.productionManifest
  const preview = input.previewManifest
  const previewValid = Boolean(preview && validateDnaPreviewVerificationManifest(preview))
  const previewArtifactDecision = previewValid && input.previewArtifacts
    ? verifyDnaPreviewVerificationArtifacts({
        manifest: preview!,
        artifacts: input.previewArtifacts,
      })
    : null
  if (!previewValid) {
    blocks.push("preview_manifest_missing_or_invalid")
  } else if (preview!.deploymentState !== "READY"
    || preview!.checks.some((check) => check.status !== "pass")
    || preview!.localPackageSha256 !== preview!.previewPackageSha256) {
    blocks.push("preview_not_promotion_eligible")
  }
  if (!previewArtifactDecision?.valid) {
    blocks.push("preview_artifact_evidence_missing_or_invalid")
  }
  let previewExternalLiveObservationValid = false
  if (previewValid && previewArtifactDecision?.valid) {
    const aggregateHashes = deriveDnaExternalLiveObservationAggregateHashes({
      environment: "preview",
      checks: preview!.checks,
    })
    previewExternalLiveObservationValid = verifyDnaExternalLiveObservationAttestation({
      attestation: input.previewExternalLiveObservationAttestation,
      trustRoots: DNA_CURRENT_EXTERNAL_LIVE_OBSERVATION_TRUST_ROOTS,
      expected: {
        environment: "preview",
        runId: previewArtifactDecision.runId!,
        deploymentId: preview!.previewDeploymentId,
        origin: preview!.previewUrlOrigin,
        gitSha: preview!.gitSha,
        packageSha256: preview!.previewPackageSha256,
        verificationManifestSha256: preview!.manifestSha256,
        deploymentArtifactSha256: previewArtifactDecision.deploymentArtifactSha256!,
        ...aggregateHashes,
        verificationCompletedAt: preview!.verifiedAt,
      },
    }).valid
  }
  if (!previewExternalLiveObservationValid) {
    blocks.push("preview_external_live_observation_missing_or_invalid")
  }
  if (!production || !validateDnaProductionVerificationManifest(production)) {
    blocks.push("production_manifest_missing_or_invalid")
  } else if (previewValid) {
    if (production.promotedPreviewDeploymentId !== preview!.previewDeploymentId
      || production.promotedPreviewArtifactSha256 !== preview!.previewArtifactSha256) {
      blocks.push("production_not_promoted_from_validated_preview")
    }
    if (production.gitSha !== preview!.gitSha
      || production.packageSha256 !== preview!.previewPackageSha256) {
      blocks.push("production_commit_or_package_mismatch")
    }
    if (production.checks.some((check) => check.status !== "pass")) {
      blocks.push("production_verification_check_failed")
    }
    const productionArtifactDecision = input.productionArtifacts
      ? verifyDnaProductionVerificationArtifacts({
          manifest: production,
          artifacts: input.productionArtifacts,
        })
      : null
    if (!productionArtifactDecision?.valid) {
      blocks.push("production_artifact_evidence_missing_or_invalid")
    } else {
      const aggregateHashes = deriveDnaExternalLiveObservationAggregateHashes({
        environment: "production",
        checks: production.checks,
      })
      const externalDecision = verifyDnaExternalLiveObservationAttestation({
        attestation: input.productionExternalLiveObservationAttestation,
        trustRoots: DNA_CURRENT_EXTERNAL_LIVE_OBSERVATION_TRUST_ROOTS,
        expected: {
          environment: "production",
          runId: productionArtifactDecision.runId!,
          deploymentId: production.productionDeploymentId,
          origin: input.productionArtifacts!.productionOrigin,
          gitSha: production.gitSha,
          packageSha256: production.packageSha256,
          verificationManifestSha256: production.manifestSha256,
          deploymentArtifactSha256: productionArtifactDecision.deploymentArtifactSha256!,
          ...aggregateHashes,
          verificationCompletedAt: production.verifiedAt,
        },
      })
      if (!externalDecision.valid) {
        blocks.push("production_external_live_observation_missing_or_invalid")
      }
    }
  }
  return Object.freeze({ verified: blocks.length === 0, blockCodes: Object.freeze(blocks) })
}

export const DNA_CURRENT_V3_PREVIEW_VERIFICATION_MANIFEST:
  DnaPreviewVerificationManifest | null = null
export const DNA_CURRENT_V3_PRODUCTION_VERIFICATION_MANIFEST:
  DnaProductionVerificationManifest | null = null
// These descriptors are committed authorities just like the manifests. A
// future release must populate both; a manifest alone deliberately stays
// non-promotable.
export const DNA_CURRENT_V3_PREVIEW_VERIFICATION_ARTIFACTS:
  DnaPreviewVerificationArtifactSet | null = null
export const DNA_CURRENT_V3_PRODUCTION_VERIFICATION_ARTIFACTS:
  DnaProductionVerificationArtifactSet | null = null
// Signed by an approved external release-observer key after the exact
// deployment checks complete. These are deliberately null until a real run
// exists; caller-supplied substitutes are never accepted by current guards.
export const DNA_CURRENT_V3_PREVIEW_EXTERNAL_LIVE_OBSERVATION_ATTESTATION:
  DnaExternalLiveObservationAttestation | null = null
export const DNA_CURRENT_V3_PRODUCTION_EXTERNAL_LIVE_OBSERVATION_ATTESTATION:
  DnaExternalLiveObservationAttestation | null = null

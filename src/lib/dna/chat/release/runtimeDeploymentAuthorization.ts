import {
  DNA_CURRENT_EXTERNAL_LIVE_OBSERVATION_TRUST_ROOTS,
  verifyDnaExternalLiveObservationAttestation,
  type DnaExternalLiveObservationAttestation,
  type DnaExternalLiveObservationTrustRoot,
} from "./previewPromotion"
import {
  DNA_CURRENT_PRODUCTION_AUTHORITY_CONSUMED_NONCE_SHA256,
  DNA_CURRENT_PRODUCTION_CANARY_BOOTSTRAP_TRUST_ROOTS,
  DNA_CURRENT_PRODUCTION_NONCE_REPLAY_AUTHORITY_PROVISIONED,
  DNA_CURRENT_PRODUCTION_RUNTIME_ACTIVATION_TRUST_ROOTS,
  DNA_CURRENT_PRODUCTION_STAGED_ROLLOUT_TRUST_ROOTS,
  DNA_PRODUCTION_CANARY_BOOTSTRAP_AUTHORIZATION_ENV,
  DNA_PRODUCTION_RUNTIME_ACTIVATION_ENV,
  DNA_PRODUCTION_STAGED_ROLLOUT_AUTHORITY_ENV,
  verifyDnaProductionRuntimeAuthority,
} from "./productionRuntimeAuthority"
import { DNA_CURRENT_V3_RELEASE_EVIDENCE_BUNDLE } from "./releaseEvidenceBundle"
import { readDnaRuntimeReleaseConfiguration } from "./runtimeReleaseMode"
import {
  DNA_CURRENT_V3_STAGED_ROLLOUT_AUTHORIZATION,
  DNA_CURRENT_V3_STAGED_ROLLOUT_EVIDENCE_FILES,
  DNA_CURRENT_V3_STAGED_ROLLOUT_EVIDENCE_ROOT,
  DNA_CURRENT_V3_STAGED_ROLLOUT_POLICY,
  verifyDnaStagedRolloutHealthEvidence,
} from "./stagedRollout"

export const DNA_RUNTIME_DEPLOYMENT_AUTHORIZATION_VERSION =
  "dna-runtime-deployment-authorization@1" as const
export const DNA_CHAT_PRODUCTION_PROMOTION_RECEIPT_ENV =
  "DNA_CHAT_PRODUCTION_PROMOTION_RECEIPT_BASE64" as const
export const DNA_VERCEL_ENV = "VERCEL_ENV" as const
export const DNA_VERCEL_GIT_COMMIT_SHA_ENV = "VERCEL_GIT_COMMIT_SHA" as const
export const DNA_VERCEL_URL_ENV = "VERCEL_URL" as const

type Environment = Readonly<Record<string, string | undefined>>

export type DnaRuntimeDeploymentAuthorization = Readonly<{
  schemaVersion: typeof DNA_RUNTIME_DEPLOYMENT_AUTHORIZATION_VERSION
  allowed: boolean
  stage: "preview" | "production"
  authority:
    | "vercel_preview_candidate"
    | "signed_promotion_receipt"
    | "signed_production_runtime_authority"
    | null
  keyId: string | null
  blockCode:
    | null
    | "production_promotion_receipt_missing_or_invalid"
    | "production_promotion_receipt_binding_mismatch"
    | "production_promotion_receipt_signature_or_time_invalid"
    | "production_stage_configuration_missing_or_invalid"
    | "production_stage_health_missing_or_invalid"
    | "production_stage_authority_missing_or_invalid"
    | "production_runtime_activation_missing_or_invalid"
    | "production_nonce_replay_authority_not_provisioned"
    | "production_runtime_authority_invalid"
    | "preview_candidate_environment_binding_invalid"
}>

function decision(
  stage: DnaRuntimeDeploymentAuthorization["stage"],
  authority: DnaRuntimeDeploymentAuthorization["authority"],
  keyId: string | null,
  blockCode: DnaRuntimeDeploymentAuthorization["blockCode"],
): DnaRuntimeDeploymentAuthorization {
  return Object.freeze({
    schemaVersion: DNA_RUNTIME_DEPLOYMENT_AUTHORIZATION_VERSION,
    allowed: blockCode === null,
    stage,
    authority,
    keyId,
    blockCode,
  })
}

function decodeCanonicalReceipt(value: string | undefined): unknown | null {
  if (!value || value.length > 16_384 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null
  try {
    const bytes = Buffer.from(value, "base64")
    if (bytes.length === 0 || bytes.length > 12_288 || bytes.toString("base64") !== value) return null
    return JSON.parse(bytes.toString("utf8")) as unknown
  } catch {
    return null
  }
}

/** Offline verifier with explicit roots for sealed release tooling and tests. */
export function verifyDnaRuntimePromotionReceipt(input: Readonly<{
  receipt: unknown
  expectedGitSha: string
  expectedPackageSha256: string
  expectedOrigin: string
  trustRoots: readonly DnaExternalLiveObservationTrustRoot[]
  now?: string
}>): DnaRuntimeDeploymentAuthorization {
  const receipt = input.receipt as DnaExternalLiveObservationAttestation | null
  if (!receipt || typeof receipt !== "object") {
    return decision("production", null, null, "production_promotion_receipt_missing_or_invalid")
  }
  if (receipt.environment !== "production"
    || receipt.gitSha !== input.expectedGitSha
    || receipt.packageSha256 !== input.expectedPackageSha256
    || receipt.origin !== input.expectedOrigin) {
    return decision("production", null, null, "production_promotion_receipt_binding_mismatch")
  }
  const verified = verifyDnaExternalLiveObservationAttestation({
    attestation: receipt,
    trustRoots: input.trustRoots,
    expected: {
      environment: receipt.environment,
      runId: receipt.runId,
      deploymentId: receipt.deploymentId,
      origin: input.expectedOrigin,
      gitSha: input.expectedGitSha,
      packageSha256: input.expectedPackageSha256,
      verificationManifestSha256: receipt.verificationManifestSha256,
      deploymentArtifactSha256: receipt.deploymentArtifactSha256,
      browserAggregateSha256: receipt.browserAggregateSha256,
      functionLogAggregateSha256: receipt.functionLogAggregateSha256,
      crossAccountAggregateSha256: receipt.crossAccountAggregateSha256,
      verificationCompletedAt: receipt.issuedAt,
    },
    now: input.now,
  })
  return verified.valid
    ? decision("production", "signed_promotion_receipt", verified.keyId, null)
    : decision(
        "production",
        null,
        null,
        verified.blockCode === "external_live_attestation_binding_mismatch"
          ? "production_promotion_receipt_binding_mismatch"
          : "production_promotion_receipt_signature_or_time_invalid",
      )
}

/**
 * Runtime action boundary. Vercel preview is a candidate environment used to
 * generate the signed receipt. Every other environment is treated as
 * production and must present a short-lived receipt signed by a committed
 * release-observer root for the exact Git and pack hashes.
 */
export function verifyDnaRuntimeDeploymentAuthorization(input: Readonly<{
  expectedGitSha: string
  expectedPackageSha256: string
  environment: Environment
  trustRoots: readonly DnaExternalLiveObservationTrustRoot[]
  now?: string
}>): DnaRuntimeDeploymentAuthorization {
  const environment = input.environment
  if (environment[DNA_VERCEL_ENV] === "preview") {
    const previewUrl = environment[DNA_VERCEL_URL_ENV]
    const previewBindingValid = environment[DNA_VERCEL_GIT_COMMIT_SHA_ENV]
      === input.expectedGitSha
      && typeof previewUrl === "string"
      && /^[A-Za-z0-9][A-Za-z0-9.-]{2,253}$/.test(previewUrl)
    return previewBindingValid
      ? decision("preview", "vercel_preview_candidate", null, null)
      : decision("preview", null, null, "preview_candidate_environment_binding_invalid")
  }
  const receipt = decodeCanonicalReceipt(
    environment[DNA_CHAT_PRODUCTION_PROMOTION_RECEIPT_ENV],
  )
  if (!receipt) {
    return decision("production", null, null, "production_promotion_receipt_missing_or_invalid")
  }
  const productionHost = environment[DNA_VERCEL_URL_ENV]
  if (typeof productionHost !== "string"
    || !/^[A-Za-z0-9][A-Za-z0-9.-]{2,253}$/.test(productionHost)) {
    return decision("production", null, null, "production_promotion_receipt_binding_mismatch")
  }
  return verifyDnaRuntimePromotionReceipt({
    receipt,
    expectedGitSha: input.expectedGitSha,
    expectedPackageSha256: input.expectedPackageSha256,
    expectedOrigin: `https://${productionHost}`,
    trustRoots: input.trustRoots,
    now: input.now,
  })
}

/**
 * Action-facing runtime decision; all release and environment inputs are
 * current authorities. Production observation is only a prerequisite: a
 * separate signed bootstrap/stage authority and runtime-activation authority
 * are mandatory before this function can authorize V3 traffic.
 */
export function evaluateCurrentDnaRuntimeDeploymentAuthorization():
  DnaRuntimeDeploymentAuthorization {
  const bundle = DNA_CURRENT_V3_RELEASE_EVIDENCE_BUNDLE
  if (!bundle) {
    return decision("production", null, null, "production_promotion_receipt_missing_or_invalid")
  }
  const observationPrerequisite = verifyDnaRuntimeDeploymentAuthorization({
    expectedGitSha: bundle.gitSha,
    expectedPackageSha256: bundle.catalog.packageSha256,
    environment: process.env,
    trustRoots: DNA_CURRENT_EXTERNAL_LIVE_OBSERVATION_TRUST_ROOTS,
  })
  if (observationPrerequisite.stage === "preview" || !observationPrerequisite.allowed) {
    return observationPrerequisite
  }

  const configuration = readDnaRuntimeReleaseConfiguration()
  const stageByPercent = new Map<number, "internal" | "limited" | "broad" | "full">([
    [5, "internal"], [25, "limited"], [50, "broad"], [100, "full"],
  ])
  const stageId = stageByPercent.get(configuration.rolloutPercent)
  if (!configuration.valid
    || (configuration.mode !== "hybrid-v3" && configuration.mode !== "v3")
    || !stageId) {
    return decision(
      "production",
      null,
      null,
      "production_stage_configuration_missing_or_invalid",
    )
  }
  if (!DNA_CURRENT_PRODUCTION_NONCE_REPLAY_AUTHORITY_PROVISIONED) {
    return decision(
      "production",
      null,
      null,
      "production_nonce_replay_authority_not_provisioned",
    )
  }

  const policy = DNA_CURRENT_V3_STAGED_ROLLOUT_POLICY
  const rolloutAuthorization = DNA_CURRENT_V3_STAGED_ROLLOUT_AUTHORIZATION
  const evidenceRoot = DNA_CURRENT_V3_STAGED_ROLLOUT_EVIDENCE_ROOT
  const evidenceFiles = DNA_CURRENT_V3_STAGED_ROLLOUT_EVIDENCE_FILES
  if (!policy || !rolloutAuthorization || !evidenceRoot || !evidenceFiles) {
    return decision(
      "production",
      null,
      null,
      "production_stage_health_missing_or_invalid",
    )
  }
  let evidenceVerification
  try {
    evidenceVerification = verifyDnaStagedRolloutHealthEvidence({
      policy,
      authorization: rolloutAuthorization,
      evidenceRoot,
      files: evidenceFiles,
    })
  } catch {
    return decision(
      "production",
      null,
      null,
      "production_stage_health_missing_or_invalid",
    )
  }

  const receipt = decodeCanonicalReceipt(
    process.env[DNA_CHAT_PRODUCTION_PROMOTION_RECEIPT_ENV],
  )
  const stageAuthority = decodeCanonicalReceipt(process.env[
    stageId === "internal"
      ? DNA_PRODUCTION_CANARY_BOOTSTRAP_AUTHORIZATION_ENV
      : DNA_PRODUCTION_STAGED_ROLLOUT_AUTHORITY_ENV
  ])
  if (!stageAuthority) {
    return decision(
      "production",
      null,
      null,
      "production_stage_authority_missing_or_invalid",
    )
  }
  const runtimeActivation = decodeCanonicalReceipt(
    process.env[DNA_PRODUCTION_RUNTIME_ACTIVATION_ENV],
  )
  if (!runtimeActivation) {
    return decision(
      "production",
      null,
      null,
      "production_runtime_activation_missing_or_invalid",
    )
  }
  const productionHost = process.env[DNA_VERCEL_URL_ENV]
  if (!receipt || typeof productionHost !== "string") {
    return decision(
      "production",
      null,
      null,
      "production_runtime_authority_invalid",
    )
  }
  const receiptDeploymentId = receipt && typeof receipt === "object"
    && "deploymentId" in receipt && typeof receipt.deploymentId === "string"
    ? receipt.deploymentId
    : ""
  const runtimeAuthority = verifyDnaProductionRuntimeAuthority({
    observationAttestation: receipt,
    observationTrustRoots: DNA_CURRENT_EXTERNAL_LIVE_OBSERVATION_TRUST_ROOTS,
    stageAuthority,
    runtimeActivation,
    bootstrapTrustRoots: DNA_CURRENT_PRODUCTION_CANARY_BOOTSTRAP_TRUST_ROOTS,
    stagedRolloutTrustRoots: DNA_CURRENT_PRODUCTION_STAGED_ROLLOUT_TRUST_ROOTS,
    runtimeActivationTrustRoots: DNA_CURRENT_PRODUCTION_RUNTIME_ACTIVATION_TRUST_ROOTS,
    policy,
    rolloutAuthorization,
    evidenceVerification,
    expected: {
      releaseId: bundle.releaseId,
      deploymentId: receiptDeploymentId,
      origin: `https://${productionHost}`,
      gitSha: bundle.gitSha,
      packageSha256: bundle.catalog.packageSha256,
      stageId,
      rolloutPercent: configuration.rolloutPercent as 5 | 25 | 50 | 100,
    },
    consumedNonceSha256: DNA_CURRENT_PRODUCTION_AUTHORITY_CONSUMED_NONCE_SHA256,
  })
  return runtimeAuthority.allowed
    ? decision(
        "production",
        "signed_production_runtime_authority",
        runtimeAuthority.activationKeyId,
        null,
      )
    : decision("production", null, null, "production_runtime_authority_invalid")
}

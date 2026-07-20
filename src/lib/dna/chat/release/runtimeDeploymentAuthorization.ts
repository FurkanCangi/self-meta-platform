import {
  DNA_CURRENT_EXTERNAL_LIVE_OBSERVATION_TRUST_ROOTS,
  verifyDnaExternalLiveObservationAttestation,
  type DnaExternalLiveObservationAttestation,
  type DnaExternalLiveObservationTrustRoot,
} from "./previewPromotion"
import { DNA_CURRENT_V3_RELEASE_EVIDENCE_BUNDLE } from "./releaseEvidenceBundle"

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
  authority: "vercel_preview_candidate" | "signed_promotion_receipt" | null
  keyId: string | null
  blockCode:
    | null
    | "production_promotion_receipt_missing_or_invalid"
    | "production_promotion_receipt_binding_mismatch"
    | "production_promotion_receipt_signature_or_time_invalid"
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

/** Action-facing runtime decision; all release and environment inputs are current authorities. */
export function evaluateCurrentDnaRuntimeDeploymentAuthorization():
  DnaRuntimeDeploymentAuthorization {
  const bundle = DNA_CURRENT_V3_RELEASE_EVIDENCE_BUNDLE
  if (!bundle) {
    return decision("production", null, null, "production_promotion_receipt_missing_or_invalid")
  }
  return verifyDnaRuntimeDeploymentAuthorization({
    expectedGitSha: bundle.gitSha,
    expectedPackageSha256: bundle.catalog.packageSha256,
    environment: process.env,
    trustRoots: DNA_CURRENT_EXTERNAL_LIVE_OBSERVATION_TRUST_ROOTS,
  })
}

import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { DNA_CURRENT_V3_ENGINE_CODE_AUTHORITY } from "../evaluation/generated/currentEngineCodeAuthority"
import {
  DNA_CURRENT_V3_EVALUATION_RELEASE_ATTESTATION,
  evaluateDnaV3EvaluationReleaseAttestation,
} from "../evaluation/evaluationReleaseAttestation"
import { DNA_CURRENT_V3_RELEASE_PACKAGE } from "../governance/releaseCompiler"
import { evaluateCurrentDnaV3ReleaseHardNoGo } from "./hardNoGo"
import {
  DNA_CURRENT_V3_PRODUCTION_EXTERNAL_LIVE_OBSERVATION_ATTESTATION,
  DNA_CURRENT_V3_PRODUCTION_VERIFICATION_ARTIFACTS,
  DNA_CURRENT_V3_PRODUCTION_VERIFICATION_MANIFEST,
  DNA_CURRENT_V3_PREVIEW_VERIFICATION_ARTIFACTS,
  DNA_CURRENT_V3_PREVIEW_EXTERNAL_LIVE_OBSERVATION_ATTESTATION,
  DNA_CURRENT_V3_PREVIEW_VERIFICATION_MANIFEST,
  evaluateDnaPreviewPromotion,
  verifyDnaProductionDeploymentEvidence,
  validateDnaPreviewVerificationManifest,
  type DnaPreviewPromotionBlockCode,
} from "./previewPromotion"
import {
  DNA_CURRENT_V3_RELEASE_EVIDENCE_BUNDLE,
  validateDnaReleaseEvidenceBundle,
} from "./releaseEvidenceBundle"

export const DNA_CURRENT_PRODUCTION_RELEASE_GUARD_VERSION =
  "dna-current-production-release-guard@1" as const

export const DNA_CURRENT_PREVIEW_PROMOTION_GUARD_VERSION =
  "dna-current-preview-promotion-guard@1" as const

export const DNA_CURRENT_PREVIEW_PROMOTION_BLOCK_CODES = Object.freeze([
  "current_git_state_unavailable",
  "current_worktree_not_clean",
  "current_git_commit_mismatch",
  "current_preview_manifest_missing_or_invalid",
  "current_release_evidence_missing_or_invalid",
  "current_evaluation_attestation_missing_or_invalid",
  "current_release_authority_binding_mismatch",
  "current_runtime_package_mismatch",
  "current_release_hard_no_go",
] as const)

type CurrentBlockCode =
  | (typeof DNA_CURRENT_PREVIEW_PROMOTION_BLOCK_CODES)[number]
  | DnaPreviewPromotionBlockCode

export type DnaCurrentPreviewPromotionDecision = Readonly<{
  schemaVersion: typeof DNA_CURRENT_PREVIEW_PROMOTION_GUARD_VERSION
  allowed: boolean
  decision: "promote_existing_preview" | "blocked"
  mutationPerformed: false
  checkedOutGitSha: string | null
  previewDeploymentId: string | null
  previewArtifactSha256: string | null
  blockCodes: readonly CurrentBlockCode[]
  promotionInstruction: Readonly<{
    method: "promote_existing_preview"
    previewDeploymentId: string
    previewArtifactSha256: string
  }> | null
}>

function readRepositoryState(): Readonly<{
  gitSha: string | null
  clean: boolean
}> {
  try {
    const gitSha = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
    const status = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
    return Object.freeze({
      gitSha: /^[a-f0-9]{40}$/.test(gitSha) ? gitSha : null,
      clean: status.length === 0,
    })
  } catch {
    return Object.freeze({ gitSha: null, clean: false })
  }
}

function readCurrentRuntimeManifest(): Readonly<{
  schemaVersion: string
  packageSha256: string
}> | null {
  try {
    const parsed = JSON.parse(readFileSync(join(
      process.cwd(),
      "src/lib/dna/chat/catalog/generated/v3/manifest.json",
    ), "utf8")) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
    const record = parsed as Record<string, unknown>
    if (typeof record.schemaVersion !== "string"
      || typeof record.packageSha256 !== "string"
      || !/^[a-f0-9]{64}$/.test(record.packageSha256)) return null
    return Object.freeze({
      schemaVersion: record.schemaVersion,
      packageSha256: record.packageSha256,
    })
  } catch {
    return null
  }
}

/**
 * The only action-facing preview promotion decision.
 *
 * It deliberately accepts no evidence, boolean or deployment identifier from
 * a caller. Every binding comes from the exact committed current authorities;
 * repository state is read directly. This function never invokes Vercel and
 * therefore remains a non-mutating release check.
 */
export function evaluateCurrentDnaPreviewPromotion(): DnaCurrentPreviewPromotionDecision {
  const blocks: CurrentBlockCode[] = []
  const repository = readRepositoryState()
  const preview = DNA_CURRENT_V3_PREVIEW_VERIFICATION_MANIFEST
  const previewArtifacts = DNA_CURRENT_V3_PREVIEW_VERIFICATION_ARTIFACTS
  const evidence = DNA_CURRENT_V3_RELEASE_EVIDENCE_BUNDLE
  const attestation = DNA_CURRENT_V3_EVALUATION_RELEASE_ATTESTATION
  const hardNoGo = evaluateCurrentDnaV3ReleaseHardNoGo()
  const currentV3RuntimeManifest = readCurrentRuntimeManifest()

  const previewValid = Boolean(preview && validateDnaPreviewVerificationManifest(preview))
  const evidenceValid = Boolean(evidence && validateDnaReleaseEvidenceBundle(evidence))

  if (!repository.gitSha) blocks.push("current_git_state_unavailable")
  if (!repository.clean) blocks.push("current_worktree_not_clean")
  if (!previewValid) blocks.push("current_preview_manifest_missing_or_invalid")
  if (!evidenceValid) blocks.push("current_release_evidence_missing_or_invalid")

  let attestationValid = false
  if (attestation && evidenceValid) {
    const evaluation = evaluateDnaV3EvaluationReleaseAttestation(attestation, {
      packageSha256: evidence!.catalog.packageSha256,
      releasePackageInputSha256: DNA_CURRENT_V3_RELEASE_PACKAGE.inputSha256,
      engineVersion: DNA_CURRENT_V3_ENGINE_CODE_AUTHORITY.engineVersion,
      engineCodeHash: DNA_CURRENT_V3_ENGINE_CODE_AUTHORITY.engineCodeHash,
    })
    attestationValid = evaluation.valid
  }
  if (!attestationValid) {
    blocks.push("current_evaluation_attestation_missing_or_invalid")
  }

  const releaseAuthorityMatches = Boolean(evidenceValid
    && currentV3RuntimeManifest
    && evidence!.engine.version === DNA_CURRENT_V3_ENGINE_CODE_AUTHORITY.engineVersion
    && evidence!.engine.sourceCodeSha256 === DNA_CURRENT_V3_ENGINE_CODE_AUTHORITY.engineCodeHash
    && evidence!.catalog.runtimePackVersion === currentV3RuntimeManifest.schemaVersion)
  if (!releaseAuthorityMatches) {
    blocks.push("current_release_authority_binding_mismatch")
  }

  const runtimePackageMatches = Boolean(evidenceValid
    && currentV3RuntimeManifest?.packageSha256 === evidence!.catalog.packageSha256)
  if (!runtimePackageMatches) blocks.push("current_runtime_package_mismatch")
  if (!hardNoGo.allowed) blocks.push("current_release_hard_no_go")

  if (repository.gitSha && evidenceValid && previewValid
    && (repository.gitSha !== evidence!.gitSha || repository.gitSha !== preview!.gitSha)) {
    blocks.push("current_git_commit_mismatch")
  }

  const generic = evaluateDnaPreviewPromotion({
    previewManifest: preview,
    previewArtifacts,
    externalLiveObservationAttestation:
      DNA_CURRENT_V3_PREVIEW_EXTERNAL_LIVE_OBSERVATION_ATTESTATION,
    expectedGitSha: evidenceValid ? evidence!.gitSha : "",
    expectedPackageSha256: evidenceValid ? evidence!.catalog.packageSha256 : "",
    expectedEvidenceBundleSha256: evidenceValid ? evidence!.bundleSha256 : "",
    expectedEvaluationAttestationSha256: attestationValid
      ? attestation!.attestationSha256
      : "",
    releaseHardNoGoAllowed: hardNoGo.allowed && attestationValid
      && releaseAuthorityMatches && runtimePackageMatches,
    request: {
      method: "promote_existing_preview",
      previewDeploymentId: previewValid ? preview!.previewDeploymentId : "missing-preview",
      previewArtifactSha256: previewValid ? preview!.previewArtifactSha256 : "",
    },
  })
  blocks.push(...generic.blockCodes)

  const blockCodes = Object.freeze([...new Set(blocks)])
  const allowed = blockCodes.length === 0 && generic.allowed
  const instruction = allowed && previewValid
    ? Object.freeze({
        method: "promote_existing_preview" as const,
        previewDeploymentId: preview!.previewDeploymentId,
        previewArtifactSha256: preview!.previewArtifactSha256,
      })
    : null

  return Object.freeze({
    schemaVersion: DNA_CURRENT_PREVIEW_PROMOTION_GUARD_VERSION,
    allowed,
    decision: allowed ? "promote_existing_preview" : "blocked",
    mutationPerformed: false,
    checkedOutGitSha: repository.gitSha,
    previewDeploymentId: previewValid ? preview!.previewDeploymentId : null,
    previewArtifactSha256: previewValid ? preview!.previewArtifactSha256 : null,
    blockCodes,
    promotionInstruction: instruction,
  })
}

/**
 * The only action-facing production release decision. It accepts no caller
 * evidence and requires the complete committed preview authority, current
 * hard-NO-GO decision and both signed live-observation attestations.
 */
export function evaluateCurrentDnaProductionRelease(): Readonly<{
  schemaVersion: typeof DNA_CURRENT_PRODUCTION_RELEASE_GUARD_VERSION
  released: boolean
  mutationPerformed: false
  productionDeploymentId: string | null
  blockCodes: readonly string[]
}> {
  const blocks: string[] = []
  const previewDecision = evaluateCurrentDnaPreviewPromotion()
  if (!previewDecision.allowed) blocks.push("current_preview_promotion_not_authorized")
  const hardNoGo = evaluateCurrentDnaV3ReleaseHardNoGo()
  if (!hardNoGo.allowed) blocks.push("current_release_hard_no_go")

  const verification = verifyDnaProductionDeploymentEvidence({
    productionManifest: DNA_CURRENT_V3_PRODUCTION_VERIFICATION_MANIFEST,
    previewManifest: DNA_CURRENT_V3_PREVIEW_VERIFICATION_MANIFEST,
    previewArtifacts: DNA_CURRENT_V3_PREVIEW_VERIFICATION_ARTIFACTS,
    productionArtifacts: DNA_CURRENT_V3_PRODUCTION_VERIFICATION_ARTIFACTS,
    previewExternalLiveObservationAttestation:
      DNA_CURRENT_V3_PREVIEW_EXTERNAL_LIVE_OBSERVATION_ATTESTATION,
    productionExternalLiveObservationAttestation:
      DNA_CURRENT_V3_PRODUCTION_EXTERNAL_LIVE_OBSERVATION_ATTESTATION,
  })
  if (!verification.verified) blocks.push(...verification.blockCodes)
  const blockCodes = Object.freeze([...new Set(blocks)])
  return Object.freeze({
    schemaVersion: DNA_CURRENT_PRODUCTION_RELEASE_GUARD_VERSION,
    released: blockCodes.length === 0,
    mutationPerformed: false,
    productionDeploymentId:
      DNA_CURRENT_V3_PRODUCTION_VERIFICATION_MANIFEST?.productionDeploymentId ?? null,
    blockCodes,
  })
}

import {
  DNA_CURRENT_V3_RELEASE_CANDIDATES,
  DNA_CURRENT_V3_RELEASE_PACKAGE,
  dnaV3ReleaseAuthorizationDigest,
} from "./releaseCompiler"
import {
  DNA_CURRENT_V3_EVALUATION_RELEASE_ATTESTATION,
  evaluateDnaV3EvaluationReleaseAttestation,
} from "../evaluation/evaluationReleaseAttestation"
import { DNA_CURRENT_V3_ENGINE_CODE_AUTHORITY } from "../evaluation/generated/currentEngineCodeAuthority"

export const DNA_CHAT_RUNTIME_RELEASE_GATE_VERSION = "dna-chat-runtime-release-gate@1" as const
export const DNA_V2_LEGACY_ENGINE_VERSION = "dna-chat-engine@2" as const
export const DNA_V3_RUNTIME_ENGINE_VERSION = "dna-chat-engine@3" as const

/**
 * V2 remains callable only as the explicitly named rollback generation. This
 * immutable policy prevents an unknown engine version from inheriting the
 * compatibility exception merely by labelling itself as legacy.
 */
export const DNA_V2_LEGACY_RUNTIME_ROLLBACK_POLICY = Object.freeze({
  schemaVersion: "dna-v2-legacy-runtime-rollback@1" as const,
  enabled: true as const,
  generation: "v2_legacy" as const,
  allowedEngineVersions: Object.freeze([DNA_V2_LEGACY_ENGINE_VERSION]),
  purpose: "explicit_v2_rollback_compatibility" as const,
})

export type DnaChatRuntimeReleaseDescriptor =
  | Readonly<{
      generation: "v2_legacy"
      engineVersion: string
    }>
  | Readonly<{
      generation: "v3"
      engineVersion: string
      packageSha256: string
      releasePackageInputSha256: string
      candidates: readonly Readonly<{
        candidateId: string
        authorizationDigest: string
      }>[]
    }>

export const DNA_CHAT_RUNTIME_RELEASE_BLOCK_CODES = [
  "invalid_descriptor",
  "unsupported_generation",
  "legacy_rollback_disabled",
  "legacy_engine_not_allowlisted",
  "v3_engine_not_allowlisted",
  "v3_engine_code_authority_invalid",
  "v3_static_package_hash_required",
  "v3_release_package_hash_required",
  "v3_release_package_hash_mismatch",
  "v3_candidate_authorizations_required",
  "v3_duplicate_candidate_id",
  "v3_candidate_not_released",
  "v3_candidate_authorization_mismatch",
  "v3_release_tuple_invalid",
  "v3_evaluation_attestation_missing",
  "v3_evaluation_attestation_invalid",
  "v3_evaluation_attestation_binding_mismatch",
] as const

export type DnaChatRuntimeReleaseBlockCode =
  (typeof DNA_CHAT_RUNTIME_RELEASE_BLOCK_CODES)[number]

export type DnaChatRuntimeReleaseDecision = Readonly<{
  gateVersion: typeof DNA_CHAT_RUNTIME_RELEASE_GATE_VERSION
  allowed: boolean
  generation: "v2_legacy" | "v3" | "unknown"
  blockCode: DnaChatRuntimeReleaseBlockCode | null
}>

function decision(
  generation: DnaChatRuntimeReleaseDecision["generation"],
  blockCode: DnaChatRuntimeReleaseBlockCode | null,
): DnaChatRuntimeReleaseDecision {
  return Object.freeze({
    gateVersion: DNA_CHAT_RUNTIME_RELEASE_GATE_VERSION,
    allowed: blockCode === null,
    generation,
    blockCode,
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isCurrentV3ReleaseTupleValid(): boolean {
  return DNA_CURRENT_V3_RELEASE_PACKAGE.releasedCandidates.every((released) => {
    const candidate = DNA_CURRENT_V3_RELEASE_CANDIDATES.find((row) =>
      row.candidateId === released.candidateId)
    if (!candidate?.publicationCandidate) return false
    if (released.authorizationDigest !== dnaV3ReleaseAuthorizationDigest(candidate)
      || released.authority !== candidate.authority
      || released.claimId !== candidate.claimId
      || released.claimSha256 !== candidate.claimSha256
      || released.passageId !== candidate.passageId
      || released.passageSha256 !== candidate.passageSha256
      || released.publicationDigest !== candidate.publicationCandidate.publicationDigest) {
      return false
    }
    return candidate.authority !== "external_scientific_information"
      || (released.authority === "external_scientific_information"
        && released.sourceId === candidate.sourceId
        && released.sourceSha256 === candidate.sourceSha256)
  })
}

/**
 * Authoritative runtime allow/deny decision. The release package is imported
 * from the committed governance module and cannot be supplied by a caller.
 */
export function evaluateDnaChatRuntimeRelease(
  descriptor: unknown,
): DnaChatRuntimeReleaseDecision {
  if (!isRecord(descriptor)
    || typeof descriptor.generation !== "string"
    || typeof descriptor.engineVersion !== "string") {
    return decision("unknown", "invalid_descriptor")
  }

  if (descriptor.generation === "v2_legacy") {
    if (!DNA_V2_LEGACY_RUNTIME_ROLLBACK_POLICY.enabled) {
      return decision("v2_legacy", "legacy_rollback_disabled")
    }
    if (!DNA_V2_LEGACY_RUNTIME_ROLLBACK_POLICY.allowedEngineVersions
      .some((engineVersion) => engineVersion === descriptor.engineVersion)) {
      return decision("v2_legacy", "legacy_engine_not_allowlisted")
    }
    return decision("v2_legacy", null)
  }

  if (descriptor.generation === "v3") {
    if (descriptor.engineVersion !== DNA_V3_RUNTIME_ENGINE_VERSION) {
      return decision("v3", "v3_engine_not_allowlisted")
    }
    if (!isCurrentV3ReleaseTupleValid()) {
      return decision("v3", "v3_release_tuple_invalid")
    }
    if (DNA_CURRENT_V3_ENGINE_CODE_AUTHORITY.engineVersion !== DNA_V3_RUNTIME_ENGINE_VERSION
      || !/^[a-f0-9]{64}$/.test(DNA_CURRENT_V3_ENGINE_CODE_AUTHORITY.sourceListSha256)
      || !/^[a-f0-9]{64}$/.test(DNA_CURRENT_V3_ENGINE_CODE_AUTHORITY.engineCodeHash)) {
      return decision("v3", "v3_engine_code_authority_invalid")
    }
    if (typeof descriptor.packageSha256 !== "string"
      || !/^[a-f0-9]{64}$/.test(descriptor.packageSha256)) {
      return decision("v3", "v3_static_package_hash_required")
    }
    if (typeof descriptor.releasePackageInputSha256 !== "string"
      || !/^[a-f0-9]{64}$/.test(descriptor.releasePackageInputSha256)) {
      return decision("v3", "v3_release_package_hash_required")
    }
    if (descriptor.releasePackageInputSha256 !== DNA_CURRENT_V3_RELEASE_PACKAGE.inputSha256) {
      return decision("v3", "v3_release_package_hash_mismatch")
    }
    if (!Array.isArray(descriptor.candidates)
      || descriptor.candidates.length === 0
      || descriptor.candidates.some((candidate) =>
        !isRecord(candidate)
        || Object.keys(candidate).sort().join(",") !== "authorizationDigest,candidateId"
        || typeof candidate.candidateId !== "string"
        || candidate.candidateId.trim() !== candidate.candidateId
        || !candidate.candidateId
        || typeof candidate.authorizationDigest !== "string"
        || !/^[a-f0-9]{64}$/.test(candidate.authorizationDigest))) {
      return decision("v3", "v3_candidate_authorizations_required")
    }

    const candidates = descriptor.candidates as Array<{
      candidateId: string
      authorizationDigest: string
    }>
    const candidateIds = candidates.map((candidate) => candidate.candidateId)
    if (new Set(candidateIds).size !== candidateIds.length) {
      return decision("v3", "v3_duplicate_candidate_id")
    }

    const releasedById = new Map(DNA_CURRENT_V3_RELEASE_PACKAGE.releasedCandidates
      .map((candidate) => [candidate.candidateId, candidate.authorizationDigest]))
    if (candidateIds.some((candidateId) => !releasedById.has(candidateId))) {
      return decision("v3", "v3_candidate_not_released")
    }
    if (candidates.some((candidate) =>
      releasedById.get(candidate.candidateId) !== candidate.authorizationDigest)) {
      return decision("v3", "v3_candidate_authorization_mismatch")
    }
    const evaluation = evaluateDnaV3EvaluationReleaseAttestation(
      DNA_CURRENT_V3_EVALUATION_RELEASE_ATTESTATION,
      {
        packageSha256: descriptor.packageSha256,
        releasePackageInputSha256: descriptor.releasePackageInputSha256,
        engineVersion: DNA_V3_RUNTIME_ENGINE_VERSION,
        engineCodeHash: DNA_CURRENT_V3_ENGINE_CODE_AUTHORITY.engineCodeHash,
      },
    )
    if (!evaluation.valid) {
      const blockCode = evaluation.blockCode === "evaluation_attestation_missing"
        ? "v3_evaluation_attestation_missing"
        : evaluation.blockCode === "evaluation_attestation_binding_mismatch"
          ? "v3_evaluation_attestation_binding_mismatch"
          : "v3_evaluation_attestation_invalid"
      return decision("v3", blockCode)
    }
    return decision("v3", null)
  }

  return decision("unknown", "unsupported_generation")
}

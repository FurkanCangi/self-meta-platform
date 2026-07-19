import { createHash } from "node:crypto"

export const DNA_V3_EVALUATION_RELEASE_ATTESTATION_VERSION =
  "dna-v3-evaluation-release-attestation@1" as const

export const DNA_V3_EVALUATION_GATE_NAMES = Object.freeze([
  "sourceIntegration",
  "retrieval",
  "citation",
  "safety",
  "cases",
] as const)

type DnaV3EvaluationGateName = (typeof DNA_V3_EVALUATION_GATE_NAMES)[number]

export type DnaV3EvaluationReleaseAttestationPayload = Readonly<{
  schemaVersion: typeof DNA_V3_EVALUATION_RELEASE_ATTESTATION_VERSION
  decision: "go"
  packageSha256: string
  releasePackageInputSha256: string
  engineVersion: "dna-chat-engine@3"
  engineCodeHash: string
  benchmarkSha256: string
  variationSha256: string
  runId: string
  evaluatedAt: string
  statuses: Readonly<Record<DnaV3EvaluationGateName, "pass">>
}>

export type DnaV3EvaluationReleaseAttestation =
  DnaV3EvaluationReleaseAttestationPayload & Readonly<{
    attestationSha256: string
  }>

export type DnaV3EvaluationAttestationDecision = Readonly<{
  valid: boolean
  blockCode:
    | null
    | "evaluation_attestation_missing"
    | "evaluation_attestation_invalid"
    | "evaluation_attestation_binding_mismatch"
}>

const SHA256 = /^[a-f0-9]{64}$/
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,199}$/

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort((left, right) => left.localeCompare(right, "en"))
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`
}

export function dnaV3EvaluationAttestationSha256(
  payload: DnaV3EvaluationReleaseAttestationPayload,
): string {
  return createHash("sha256").update(stableJson(payload), "utf8").digest("hex")
}

/** Offline release helper. Production never accepts an attestation supplied by a request. */
export function createDnaV3EvaluationReleaseAttestation(
  payload: DnaV3EvaluationReleaseAttestationPayload,
): DnaV3EvaluationReleaseAttestation {
  return Object.freeze({
    ...payload,
    statuses: Object.freeze({ ...payload.statuses }),
    attestationSha256: dnaV3EvaluationAttestationSha256(payload),
  })
}

function exactKeys(value: object, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right, "en"))
  const wanted = [...expected].sort((left, right) => left.localeCompare(right, "en"))
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index])
}

export function evaluateDnaV3EvaluationReleaseAttestation(
  value: DnaV3EvaluationReleaseAttestation | null,
  expected: Readonly<{
    packageSha256: string
    releasePackageInputSha256: string
    engineVersion: "dna-chat-engine@3"
    engineCodeHash: string
  }>,
): DnaV3EvaluationAttestationDecision {
  if (!value) return Object.freeze({ valid: false, blockCode: "evaluation_attestation_missing" })
  if (!exactKeys(value, [
    "schemaVersion", "decision", "packageSha256", "releasePackageInputSha256",
    "engineVersion", "engineCodeHash", "benchmarkSha256", "variationSha256",
    "runId", "evaluatedAt", "statuses", "attestationSha256",
  ]) || !exactKeys(value.statuses, DNA_V3_EVALUATION_GATE_NAMES)) {
    return Object.freeze({ valid: false, blockCode: "evaluation_attestation_invalid" })
  }
  const hashes = [
    value.packageSha256,
    value.releasePackageInputSha256,
    value.engineCodeHash,
    value.benchmarkSha256,
    value.variationSha256,
    value.attestationSha256,
  ]
  const validTimestamp = Number.isFinite(Date.parse(value.evaluatedAt))
    && new Date(value.evaluatedAt).toISOString() === value.evaluatedAt
  const allGatesPass = DNA_V3_EVALUATION_GATE_NAMES.every((gate) => value.statuses[gate] === "pass")
  const { attestationSha256, ...payload } = value
  if (value.schemaVersion !== DNA_V3_EVALUATION_RELEASE_ATTESTATION_VERSION
    || value.decision !== "go"
    || value.engineVersion !== "dna-chat-engine@3"
    || hashes.some((hash) => !SHA256.test(hash))
    || !IDENTIFIER.test(value.runId)
    || !validTimestamp
    || !allGatesPass
    || dnaV3EvaluationAttestationSha256(payload) !== attestationSha256) {
    return Object.freeze({ valid: false, blockCode: "evaluation_attestation_invalid" })
  }
  if (value.packageSha256 !== expected.packageSha256
    || value.releasePackageInputSha256 !== expected.releasePackageInputSha256
    || value.engineVersion !== expected.engineVersion
    || value.engineCodeHash !== expected.engineCodeHash) {
    return Object.freeze({ valid: false, blockCode: "evaluation_attestation_binding_mismatch" })
  }
  return Object.freeze({ valid: true, blockCode: null })
}

/**
 * Intentionally absent until the exact committed package and engine pass the
 * Phase 38-44 release evaluation. A nonempty V3 package therefore fails closed
 * unless the reviewed attestation produced by the release checker is committed.
 */
export const DNA_CURRENT_V3_EVALUATION_RELEASE_ATTESTATION:
  DnaV3EvaluationReleaseAttestation | null = null

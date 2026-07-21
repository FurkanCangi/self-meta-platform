import { createHash } from "node:crypto"

import {
  hashDnaCandidatePassagePayload,
  isDnaCandidatePassageRegistrationResultValid,
  type DnaCandidatePassageRegistrationResult,
} from "./candidatePassageRegistration"
import {
  DNA_BLIND_EXTRACTION_PROTOCOLS,
  commitDnaEvidenceSubject,
  createDnaCandidateBlindExtractionRun,
  isDnaBlindExtractionRunIntegrityValid,
  type DnaAtomicClaimDraft,
  type DnaBlindClaimRationale,
  type DnaBlindExtractionLane,
  type DnaBlindExtractionRun,
  type DnaParsedArtifact,
} from "./evidenceExtraction"
import {
  isDnaMethodAppraisalRegistrationResultValid,
  type DnaMethodAppraisalRegistrationResult,
} from "./methodAppraisalRegistration"

export const DNA_CANDIDATE_CLAIM_PACKET_VERSION =
  "dna-candidate-claim-review-packet@1" as const
export const DNA_CANDIDATE_CLAIM_DECISION_VERSION =
  "dna-candidate-claim-extraction-decision@1" as const
export const DNA_CANDIDATE_CLAIM_RESULT_VERSION =
  "dna-candidate-claim-extraction-result@1" as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,199}$/

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort((left, right) => left.localeCompare(right, "en"))
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`
}

export function hashDnaCandidateClaimPayload(value: unknown): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex")
}

function exactKeys(value: unknown, expected: readonly string[], code: string): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code)
  const actual = Object.keys(value as Record<string, unknown>)
    .sort((left, right) => left.localeCompare(right, "en"))
  const wanted = [...expected].sort((left, right) => left.localeCompare(right, "en"))
  if (actual.length !== wanted.length
    || actual.some((key, index) => key !== wanted[index])) throw new Error(code)
}

function assertId(value: string, code: string): void {
  if (!IDENTIFIER_PATTERN.test(String(value || ""))) throw new Error(code)
}

function assertSha(value: string, code: string): void {
  if (!SHA256_PATTERN.test(String(value || ""))) throw new Error(code)
}

function assertIso(value: string, code: string): void {
  const time = Date.parse(String(value || ""))
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) throw new Error(code)
}

export type DnaCandidateClaimReviewPacket = Readonly<{
  schemaVersion: typeof DNA_CANDIDATE_CLAIM_PACKET_VERSION
  status: "candidate_only"
  runtimeEligible: false
  releaseEligible: false
  lane: DnaBlindExtractionLane
  protocolId: string
  sourceId: string
  artifactSha256: string
  passageRegistrationResultSha256: string
  passageRegistrationResultFileSha256: string
  methodRegistrationResultSha256: string
  contextId: string
  instructionSha256: string
  governanceMetadataSha256: string
  passageManifestSha256: string
  peerOutputExcluded: true
  instructions: readonly string[]
  governanceMetadata: Readonly<{
    studyDesign: string
    population: string
    ageScope: string
    generalizability: string
    causalBoundary: string
    limitations: readonly string[]
    evidenceLevelBoundary: "single_source_certainty_not_assessed"
    dnaRelationshipAllowed: false
  }>
  passages: DnaCandidatePassageRegistrationResult["passages"]
  packetSha256: string
}>

export type DnaCandidateClaimExtractionDecision = Readonly<{
  schemaVersion: typeof DNA_CANDIDATE_CLAIM_DECISION_VERSION
  decisionId: string
  runId: string
  lane: DnaBlindExtractionLane
  sourceId: string
  packetSha256: string
  packetFileSha256: string
  passageRegistrationResultSha256: string
  passageRegistrationResultFileSha256: string
  createdAt: string
  reviewerId: string
  authorityClass: "output_blinded_codex_multi_pass_not_independent"
  peerOutputExcluded: true
  status: "candidate_only"
  runtimeEligible: false
  releaseEligible: false
  claimDrafts: readonly DnaAtomicClaimDraft[]
  rationales: readonly DnaBlindClaimRationale[]
  decisionSha256: string
}>

export type DnaCandidateClaimExtractionResult = Readonly<{
  schemaVersion: typeof DNA_CANDIDATE_CLAIM_RESULT_VERSION
  status: "candidate_only"
  runtimeEligible: false
  releaseEligible: false
  lane: DnaBlindExtractionLane
  sourceId: string
  decisionSha256: string
  packetSha256: string
  passageRegistrationResultSha256: string
  run: DnaBlindExtractionRun
  resultSha256: string
}>

const PACKET_KEYS = Object.freeze([
  "schemaVersion", "status", "runtimeEligible", "releaseEligible", "lane",
  "protocolId", "sourceId", "artifactSha256", "passageRegistrationResultSha256",
  "passageRegistrationResultFileSha256", "methodRegistrationResultSha256", "contextId",
  "instructionSha256", "governanceMetadataSha256", "passageManifestSha256",
  "peerOutputExcluded", "instructions", "governanceMetadata", "passages", "packetSha256",
] as const)

const DECISION_KEYS = Object.freeze([
  "schemaVersion", "decisionId", "runId", "lane", "sourceId", "packetSha256",
  "packetFileSha256", "passageRegistrationResultSha256",
  "passageRegistrationResultFileSha256", "createdAt", "reviewerId", "authorityClass",
  "peerOutputExcluded", "status", "runtimeEligible", "releaseEligible", "claimDrafts",
  "rationales", "decisionSha256",
] as const)

const RESULT_KEYS = Object.freeze([
  "schemaVersion", "status", "runtimeEligible", "releaseEligible", "lane", "sourceId",
  "decisionSha256", "packetSha256", "passageRegistrationResultSha256", "run",
  "resultSha256",
] as const)

function passageManifestSha256(
  passages: DnaCandidatePassageRegistrationResult["passages"],
): string {
  return commitDnaEvidenceSubject(passages
    .map((passage) => ({ id: passage.id, provenanceSha256: passage.provenanceSha256 }))
    .sort((left, right) => left.id.localeCompare(right.id, "en")))
}

export function createDnaCandidateClaimReviewPacket(input: Readonly<{
  lane: DnaBlindExtractionLane
  passageRegistrationResult: DnaCandidatePassageRegistrationResult
  passageRegistrationResultFileSha256: string
  methodRegistrationResult: DnaMethodAppraisalRegistrationResult
}>): DnaCandidateClaimReviewPacket {
  if (!isDnaCandidatePassageRegistrationResultValid(input.passageRegistrationResult)) {
    throw new Error("candidate_claim_packet_passage_registration_invalid")
  }
  if (!isDnaMethodAppraisalRegistrationResultValid(input.methodRegistrationResult)) {
    throw new Error("candidate_claim_packet_method_registration_invalid")
  }
  assertSha(input.passageRegistrationResultFileSha256,
    "candidate_claim_packet_passage_result_file_hash_invalid")
  const passageResult = input.passageRegistrationResult
  const methodResult = input.methodRegistrationResult
  const protocol = DNA_BLIND_EXTRACTION_PROTOCOLS[input.lane]
  if (!protocol
    || passageResult.sourceId !== methodResult.sourceId
    || passageResult.methodRegistrationResultSha256 !== methodResult.resultSha256) {
    throw new Error("candidate_claim_packet_authority_binding_mismatch")
  }
  const instructions = Object.freeze([
    "Extract only atomic propositions stated verbatim in the eligible passages.",
    "Do not infer diagnosis, prognosis, treatment, individual biology, or DNA product validity.",
    "Keep evidenceLevel not_assessed; a single source is not body-of-evidence certainty.",
    "Preserve the exact passage claimBoundary and mark source causal language as unverified.",
    `Do not read or use lane ${protocol.blindTo} output or any reconciliation output.`,
  ])
  const governanceMetadata = Object.freeze({
    studyDesign: methodResult.appraisal.studyDesign,
    population: methodResult.appraisal.population,
    ageScope: methodResult.appraisal.ageScope,
    generalizability: methodResult.appraisal.generalizability,
    causalBoundary: methodResult.appraisal.causalBoundary,
    limitations: methodResult.appraisal.limitations,
    evidenceLevelBoundary: "single_source_certainty_not_assessed" as const,
    dnaRelationshipAllowed: false as const,
  })
  const payload = {
    schemaVersion: DNA_CANDIDATE_CLAIM_PACKET_VERSION,
    status: "candidate_only" as const,
    runtimeEligible: false as const,
    releaseEligible: false as const,
    lane: input.lane,
    protocolId: protocol.protocolId,
    sourceId: passageResult.sourceId,
    artifactSha256: passageResult.artifactSha256,
    passageRegistrationResultSha256: passageResult.resultSha256,
    passageRegistrationResultFileSha256: input.passageRegistrationResultFileSha256,
    methodRegistrationResultSha256: methodResult.resultSha256,
    contextId: `candidate.claim.context:${passageResult.sourceId}:${input.lane}:r000001`,
    instructionSha256: commitDnaEvidenceSubject(instructions),
    governanceMetadataSha256: commitDnaEvidenceSubject(governanceMetadata),
    passageManifestSha256: passageManifestSha256(passageResult.passages),
    peerOutputExcluded: true as const,
    instructions,
    governanceMetadata,
    passages: passageResult.passages,
  }
  return Object.freeze({
    ...payload,
    packetSha256: hashDnaCandidateClaimPayload(payload),
  })
}

export function assertDnaCandidateClaimReviewPacket(
  packet: DnaCandidateClaimReviewPacket,
): void {
  exactKeys(packet, PACKET_KEYS, "candidate_claim_packet_shape_invalid")
  if (packet.schemaVersion !== DNA_CANDIDATE_CLAIM_PACKET_VERSION
    || packet.status !== "candidate_only"
    || packet.runtimeEligible !== false
    || packet.releaseEligible !== false
    || packet.peerOutputExcluded !== true
    || packet.protocolId !== DNA_BLIND_EXTRACTION_PROTOCOLS[packet.lane]?.protocolId
    || packet.passages.length < 1
    || packet.passageManifestSha256 !== passageManifestSha256(packet.passages)
    || packet.instructionSha256 !== commitDnaEvidenceSubject(packet.instructions)
    || packet.governanceMetadataSha256
      !== commitDnaEvidenceSubject(packet.governanceMetadata)) {
    throw new Error("candidate_claim_packet_state_or_binding_invalid")
  }
  assertId(packet.sourceId, "candidate_claim_packet_source_id_invalid")
  assertId(packet.contextId, "candidate_claim_packet_context_id_invalid")
  for (const value of [packet.artifactSha256, packet.passageRegistrationResultSha256,
    packet.passageRegistrationResultFileSha256, packet.methodRegistrationResultSha256,
    packet.instructionSha256, packet.governanceMetadataSha256,
    packet.passageManifestSha256, packet.packetSha256]) {
    assertSha(value, "candidate_claim_packet_hash_invalid")
  }
  const { packetSha256, ...payload } = packet
  if (packetSha256 !== hashDnaCandidateClaimPayload(payload)) {
    throw new Error("candidate_claim_packet_hash_mismatch")
  }
}

export function assertDnaCandidateClaimExtractionDecision(
  decision: DnaCandidateClaimExtractionDecision,
): void {
  exactKeys(decision, DECISION_KEYS, "candidate_claim_decision_shape_invalid")
  if (decision.schemaVersion !== DNA_CANDIDATE_CLAIM_DECISION_VERSION
    || decision.authorityClass !== "output_blinded_codex_multi_pass_not_independent"
    || decision.peerOutputExcluded !== true
    || decision.status !== "candidate_only"
    || decision.runtimeEligible !== false
    || decision.releaseEligible !== false
    || !DNA_BLIND_EXTRACTION_PROTOCOLS[decision.lane]
    || !Array.isArray(decision.claimDrafts)
    || decision.claimDrafts.length < 1
    || decision.claimDrafts.length > 30
    || !Array.isArray(decision.rationales)
    || decision.rationales.length !== decision.claimDrafts.length) {
    throw new Error("candidate_claim_decision_state_invalid")
  }
  for (const value of [decision.decisionId, decision.runId, decision.sourceId,
    decision.reviewerId]) assertId(value, "candidate_claim_decision_id_invalid")
  for (const value of [decision.packetSha256, decision.packetFileSha256,
    decision.passageRegistrationResultSha256,
    decision.passageRegistrationResultFileSha256, decision.decisionSha256]) {
    assertSha(value, "candidate_claim_decision_hash_invalid")
  }
  assertIso(decision.createdAt, "candidate_claim_decision_created_at_invalid")
  if (new Set(decision.claimDrafts.map((claim) => claim.claimId)).size
    !== decision.claimDrafts.length
    || new Set(decision.rationales.map((rationale) => rationale.claimId)).size
      !== decision.rationales.length) {
    throw new Error("candidate_claim_decision_duplicate_claim_or_rationale")
  }
  const { decisionSha256, ...payload } = decision
  if (decisionSha256 !== hashDnaCandidateClaimPayload(payload)) {
    throw new Error("candidate_claim_decision_hash_mismatch")
  }
}

export function compileDnaCandidateClaimExtraction(input: Readonly<{
  decision: DnaCandidateClaimExtractionDecision
  packet: DnaCandidateClaimReviewPacket
  packetFileSha256: string
  passageRegistrationResult: DnaCandidatePassageRegistrationResult
  passageRegistrationResultFileSha256: string
  parsedArtifact: DnaParsedArtifact
}>): DnaCandidateClaimExtractionResult {
  assertDnaCandidateClaimExtractionDecision(input.decision)
  assertDnaCandidateClaimReviewPacket(input.packet)
  if (!isDnaCandidatePassageRegistrationResultValid(input.passageRegistrationResult)) {
    throw new Error("candidate_claim_passage_registration_invalid")
  }
  const { decision, packet, passageRegistrationResult } = input
  if (decision.lane !== packet.lane
    || decision.sourceId !== packet.sourceId
    || decision.sourceId !== passageRegistrationResult.sourceId
    || decision.packetSha256 !== packet.packetSha256
    || decision.packetFileSha256 !== input.packetFileSha256
    || decision.passageRegistrationResultSha256 !== passageRegistrationResult.resultSha256
    || decision.passageRegistrationResultFileSha256
      !== input.passageRegistrationResultFileSha256
    || packet.passageRegistrationResultSha256 !== passageRegistrationResult.resultSha256
    || packet.passageRegistrationResultFileSha256
      !== input.passageRegistrationResultFileSha256
    || packet.artifactSha256 !== passageRegistrationResult.artifactSha256
    || input.parsedArtifact.sourceId !== decision.sourceId
    || input.parsedArtifact.artifactSha256 !== packet.artifactSha256) {
    throw new Error("candidate_claim_input_binding_mismatch")
  }
  const run = createDnaCandidateBlindExtractionRun({
    lane: decision.lane,
    protocolId: packet.protocolId,
    runId: decision.runId,
    createdAt: decision.createdAt,
    sourceId: decision.sourceId,
    artifactSha256: packet.artifactSha256,
    parsedArtifact: input.parsedArtifact,
    passages: passageRegistrationResult.passages,
    trustRegistry: passageRegistrationResult.candidateTrustRegistry,
    contextCommitment: {
      contextId: packet.contextId,
      instructionSha256: packet.instructionSha256,
      governanceMetadataSha256: packet.governanceMetadataSha256,
      sourceArtifactSha256: packet.artifactSha256,
      passageManifestSha256: packet.passageManifestSha256,
      peerOutputExcluded: true,
    },
    claimDrafts: decision.claimDrafts,
    rationales: decision.rationales,
  })
  const payload = {
    schemaVersion: DNA_CANDIDATE_CLAIM_RESULT_VERSION,
    status: "candidate_only" as const,
    runtimeEligible: false as const,
    releaseEligible: false as const,
    lane: decision.lane,
    sourceId: decision.sourceId,
    decisionSha256: decision.decisionSha256,
    packetSha256: packet.packetSha256,
    passageRegistrationResultSha256: passageRegistrationResult.resultSha256,
    run,
  }
  return Object.freeze({
    ...payload,
    resultSha256: hashDnaCandidateClaimPayload(payload),
  })
}

export function isDnaCandidateClaimExtractionResultValid(
  result: DnaCandidateClaimExtractionResult,
): boolean {
  try {
    exactKeys(result, RESULT_KEYS, "candidate_claim_result_shape_invalid")
    if (result.schemaVersion !== DNA_CANDIDATE_CLAIM_RESULT_VERSION
      || result.status !== "candidate_only"
      || result.runtimeEligible !== false
      || result.releaseEligible !== false
      || result.run.lane !== result.lane
      || result.run.sourceId !== result.sourceId
      || !isDnaBlindExtractionRunIntegrityValid(result.run)) return false
    for (const value of [result.decisionSha256, result.packetSha256,
      result.passageRegistrationResultSha256, result.resultSha256]) {
      assertSha(value, "candidate_claim_result_hash_invalid")
    }
    const { resultSha256, ...payload } = result
    return resultSha256 === hashDnaCandidateClaimPayload(payload)
  } catch {
    return false
  }
}

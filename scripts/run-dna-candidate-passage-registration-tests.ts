import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  compileDnaCandidatePassageRegistration,
  hashDnaCandidatePassagePayload,
  isDnaCandidatePassageRegistrationResultValid,
  type DnaCandidatePassageDecision,
  type DnaCandidatePassageSelection,
  type DnaCandidatePassageWorkpack,
} from "../src/lib/dna/chat/governance/candidatePassageRegistration"
import {
  isDnaCandidateEvidenceTrustRegistryValid,
  isDnaEvidenceTrustRegistryAuthorized,
  parseDnaEvidenceArtifact,
} from "../src/lib/dna/chat/governance/evidenceExtraction"
import type {
  DnaMethodAppraisalRegistrationResult,
} from "../src/lib/dna/chat/governance/methodAppraisalRegistration"

const researchRoot = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const candidateRoot = join(
  researchRoot,
  "Datasets/DNA-Intelligence/work/v3/candidate-corpus",
)
const sourceLibraryRoot = join(
  researchRoot,
  "Datasets/SelfMetaAI/dna-knowledge/source-library",
)
const registrationRoot = join(
  researchRoot,
  "Datasets/DNA-Intelligence/work/v3/method-appraisal-registrations/v1",
)
const sourceId = "prisma-cosmin-omis-2024"

function sha256(bytes: string | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex")
}

function fileSha256(path: string): string {
  return sha256(readFileSync(path))
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function expectError(operation: () => unknown, code: RegExp): void {
  assert.throws(operation, code)
}

const workpackPath = join(candidateRoot, "method-review-workpacks", `${sourceId}.json`)
const resultPath = join(registrationRoot, "sources", sourceId, "result.json")
const workpack = readJson<DnaCandidatePassageWorkpack>(workpackPath)
const methodRegistrationResult = readJson<DnaMethodAppraisalRegistrationResult>(resultPath)
const rawArtifactPath = join(sourceLibraryRoot, workpack.artifactRelativePath)
const firstParagraph = workpack.paragraphs[0]
assert.ok(firstParagraph)

const parsedArtifact = parseDnaEvidenceArtifact({
  sourceId,
  artifactId: workpack.artifactId,
  format: firstParagraph.format,
  originalLanguage: firstParagraph.originalLanguage,
  bytes: readFileSync(rawArtifactPath),
  declaredSha256: workpack.artifactSha256,
})
assert.equal(parsedArtifact.parsedContentSha256, workpack.parsedContentSha256)
assert.deepEqual(parsedArtifact.paragraphs, workpack.paragraphs)

const baseSelection: DnaCandidatePassageSelection = {
  passageId: `candidate.passage:${sourceId}:001`,
  paragraphIds: [firstParagraph.paragraphId],
  ageScope: methodRegistrationResult.appraisal.ageScope,
  evidenceType: "guideline",
  claimBoundary: "Bu pasaj yalnız raporlama kılavuzunun tanımladığı yöntemsel kapsamı destekler.",
  rationale: "Paragraf çalışmanın amacını doğrudan bildirir ve klinik etkililik iddiası içermez.",
}

function makeDecision(
  passages: readonly DnaCandidatePassageSelection[] = [baseSelection],
  override: Partial<Omit<DnaCandidatePassageDecision, "decisionSha256" | "passages">> = {},
): DnaCandidatePassageDecision {
  const payload: Omit<DnaCandidatePassageDecision, "decisionSha256"> = {
    schemaVersion: "dna-candidate-passage-decision@1",
    decisionId: `candidate.passage.decision:${sourceId}:r000001`,
    sourceId,
    artifactSha256: workpack.artifactSha256,
    workpackPayloadSha256: workpack.workpackSha256,
    workpackFileSha256: fileSha256(workpackPath),
    methodRegistrationResultSha256: methodRegistrationResult.resultSha256,
    methodRegistrationResultFileSha256: fileSha256(resultPath),
    reviewedAt: "2026-07-20T18:00:00.000Z",
    reviewerId: "codex.candidate-passage-review",
    authorityClass: "codex_multi_pass_not_independent",
    status: "candidate_only",
    runtimeEligible: false,
    releaseEligible: false,
    passages,
    ...override,
  }
  return Object.freeze({
    ...payload,
    decisionSha256: hashDnaCandidatePassagePayload(payload),
  })
}

function compile(decision: DnaCandidatePassageDecision) {
  return compileDnaCandidatePassageRegistration({
    decision,
    parsedArtifact,
    workpack,
    workpackFileSha256: fileSha256(workpackPath),
    methodRegistrationResult,
    methodRegistrationResultFileSha256: fileSha256(resultPath),
  })
}

const result = compile(makeDecision())
assert.equal(result.runtimeEligible, false)
assert.equal(result.releaseEligible, false)
assert.equal(result.passages.length, 1)
assert.equal(result.passages[0]?.status, "candidate_only")
assert.equal(isDnaCandidatePassageRegistrationResultValid(result), true)
assert.equal(isDnaCandidateEvidenceTrustRegistryValid(result.candidateTrustRegistry), true)
assert.equal(isDnaEvidenceTrustRegistryAuthorized(result.candidateTrustRegistry), false)

expectError(() => compileDnaCandidatePassageRegistration({
  decision: makeDecision(),
  parsedArtifact,
  workpack,
  workpackFileSha256: fileSha256(workpackPath),
  methodRegistrationResult: {
    ...methodRegistrationResult,
    resultSha256: "0".repeat(64),
  },
  methodRegistrationResultFileSha256: fileSha256(resultPath),
}), /candidate_passage_method_registration_invalid/)

const tamperedWorkpack: DnaCandidatePassageWorkpack = {
  ...workpack,
  paragraphs: [{ ...firstParagraph, text: `${firstParagraph.text} altered` },
    ...workpack.paragraphs.slice(1)],
}
expectError(() => compileDnaCandidatePassageRegistration({
  decision: makeDecision(),
  parsedArtifact,
  workpack: tamperedWorkpack,
  workpackFileSha256: fileSha256(workpackPath),
  methodRegistrationResult,
  methodRegistrationResultFileSha256: fileSha256(resultPath),
}), /candidate_passage_workpack_integrity_invalid/)

expectError(() => compile(makeDecision([baseSelection], {
  workpackFileSha256: "0".repeat(64),
})), /candidate_passage_input_binding_mismatch/)

expectError(() => compile(makeDecision([{
  ...baseSelection,
  ageScope: "adult",
}])), /candidate_passage_age_scope_exceeds_appraisal/)

expectError(() => compile(makeDecision([{
  ...baseSelection,
  evidenceType: "narrative_review",
}])), /candidate_passage_evidence_type_exceeds_appraisal/)

expectError(() => compile(makeDecision([
  baseSelection,
  { ...baseSelection, passageId: `candidate.passage:${sourceId}:002` },
])), /candidate_passage_overlap_forbidden/)

assert.equal(isDnaCandidatePassageRegistrationResultValid({
  ...result,
  resultSha256: "0".repeat(64),
}), false)

console.log(JSON.stringify({
  ok: true,
  sourceId,
  parsedArtifactBound: true,
  methodRegistrationBound: true,
  workpackIntegrityBound: true,
  candidateTrustRegistryValid: true,
  candidateRegistryRuntimeAuthorized: false,
  staleBindingRejected: true,
  ageOverreachRejected: true,
  evidenceTypeOverreachRejected: true,
  overlappingPassageRejected: true,
  tamperRejected: true,
  runtimeEligible: 0,
  releaseEligible: 0,
}, null, 2))

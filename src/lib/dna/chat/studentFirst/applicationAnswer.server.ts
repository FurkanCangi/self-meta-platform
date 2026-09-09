import "server-only"

import { DNA_OWNER_BOOK_CHAT_AUTHORITY } from "../knowledgeAuthority"
import { DNA_INTELLIGENCE_PUBLIC_INTENDED_USE } from "../intendedUse"
import { getDnaOwnerBookClaimMetadata } from "../ownerBookRuntime"
import type { DnaChatPublicAnswer, DnaChatPublicAnswerUnit, DnaChatPublicKnowledgeAuthority, DnaChatPublicSourceRef } from "../publicResponseNormalizer"
import { DNA_STUDENT_ANSWER_EXECUTOR_VERSION, type StudentAnswerExecutorResult } from "./answerExecutor.server"
import { STUDENT_SAFE_ASSESSMENT_POLICY } from "./answerExecution"
import { STUDENT_APPLICATION_REFUSAL_VERSION, STUDENT_APPLICATION_RESPONSE_VERSION, STUDENT_APPLICATION_RUNTIME } from "./applicationPublicContract"

const policyAuthority: DnaChatPublicKnowledgeAuthority = {
  contractVersion: "dna-knowledge-authority@1", layer: "safety_and_product_boundaries",
  labelTr: "Yerel adayın açıklama ve güvenlik sınırları", approvalRequirement: "policy_enforced",
  verificationStatus: "test_only", releaseEligible: false,
  boundaryTr: "Bu adayın uygulama sertifikasyonu henüz tamamlanmamıştır.",
}

/** Complete an already authorized normal refusal, without a provider or a
 * fabricated student execution. The changed envelope has its own candidate
 * identity; it does not inherit the normal runtime's release certification. */
export function studentApplicationTreatmentRefusal(input: {
  normal: DnaChatPublicAnswer
  candidateSha256: string
}): Record<string, unknown> {
  const { normal } = input
  if (normal.classification !== "refusal" || normal.sources.length || normal.caseEvidence.length) {
    throw new Error("student_refusal_requires_policy_only_normal_response")
  }
  // A product refusal and an assessment frame do not by themselves explain
  // why an intervention cannot be selected from this conversation. Complete
  // that local safety explanation without delegating a clinical case to an LLM.
  const texts = [...new Set([normal.summary,
    "Değerlendirme yapılmadan kişiye özel bir müdahale seçilemez.", ...normal.details,
    ...normal.answerUnits.map((unit) => unit.text), ...normal.limitations, normal.safetyBoundary,
    STUDENT_SAFE_ASSESSMENT_POLICY.text].filter(Boolean))]
  const answerUnits: DnaChatPublicAnswerUnit[] = texts.map((text, index) => ({
    id: `local-refusal-${index + 1}`, text, kind: index ? "detail" : "summary",
    section: "boundary", role: "safety_boundary", authority: policyAuthority,
    claimIds: [], passageIds: [], sourceIds: [], citationCardIds: [],
  }))
  return { ok: true, requestId: normal.requestId, responseDepth: normal.responseDepth,
    runtimeGeneration: STUDENT_APPLICATION_RUNTIME, engineVersion: STUDENT_APPLICATION_REFUSAL_VERSION,
    catalogVersion: normal.catalogVersion, packageVersion: STUDENT_APPLICATION_RESPONSE_VERSION,
    packageSha256: input.candidateSha256, classification: "refusal", outcome: "refused",
    summary: texts[0], details: texts.slice(1), answerUnits, authoritySummary: [policyAuthority],
    sources: [], caseEvidence: [], limitations: [], safetyBoundary: "",
    intendedUse: normal.intendedUse, suggestedQuestions: [], topic: null,
    limitedRolloutFeedbackEligible: false,
    studentCandidate: { schemaVersion: STUDENT_APPLICATION_RESPONSE_VERSION,
      candidateSha256: input.candidateSha256, releaseEligible: false, rawMessagesStored: false,
      presentationFormat: "prose", executionMode: "normal_refusal_completion" } }
}

/** A projection, not a second semantic judge. Only the already validated
 * executor's actual used claims can become public citation cards. */
export function studentApplicationAnswer(input: {
  result: Extract<StudentAnswerExecutorResult, { ok: true }>
  candidateSha256: string
  requestId: string
  responseDepth: "short" | "standard" | "deep"
}): Record<string, unknown> {
  const { proof: _proof, ...ownerAuthority } = DNA_OWNER_BOOK_CHAT_AUTHORITY
  const { result } = input
  const claims = new Map(result.plan.targetEvidence.flatMap((target) => target.claims.map((claim) => [claim.claimId, claim] as const)))
  const sources: DnaChatPublicSourceRef[] = result.candidate.usedClaimIds.map((id) => {
    const claim = claims.get(id)
    const metadata = getDnaOwnerBookClaimMetadata(id)
    if (!claim || !metadata || metadata.passageId !== claim.passageId
      || claim.sourceId !== DNA_OWNER_BOOK_CHAT_AUTHORITY.proof.sourceId) throw new Error("student_public_claim_not_bound")
    return { id, sourceId: claim.sourceId, title: metadata.title, excerptTr: claim.text,
      locator: metadata.title, authority: ownerAuthority,
      knownBoundary: ownerAuthority.boundaryTr }
  })
  const answerUnits: DnaChatPublicAnswerUnit[] = result.candidate.blocks.map((block, index) => {
    const bound = block.usedClaimIds.map((id) => {
      const claim = claims.get(id)
      if (!claim || !sources.some((source) => source.id === id)) throw new Error("student_public_block_not_bound")
      return claim
    })
    return { id: block.blockId, text: block.text, kind: index ? "detail" : "summary",
      section: bound.length ? "general_literature" : "boundary",
      role: bound.length ? "owner_book_information" : "safety_boundary",
      authority: bound.length ? ownerAuthority : policyAuthority,
      claimIds: [...block.usedClaimIds], passageIds: [...new Set(bound.map((claim) => claim.passageId))],
      sourceIds: [...new Set(bound.map((claim) => claim.sourceId))], citationCardIds: [...block.usedClaimIds] }
  })
  if (!answerUnits.length || answerUnits.map((unit) => unit.text).join(result.plan.presentation.format === "bullets" ? "\n" : " ") !== result.answer) {
    throw new Error("student_public_visible_answer_mismatch")
  }
  return { ok: true, requestId: input.requestId, responseDepth: input.responseDepth,
    runtimeGeneration: STUDENT_APPLICATION_RUNTIME, engineVersion: DNA_STUDENT_ANSWER_EXECUTOR_VERSION,
    catalogVersion: DNA_OWNER_BOOK_CHAT_AUTHORITY.proof.bookVersion,
    packageVersion: STUDENT_APPLICATION_RESPONSE_VERSION, packageSha256: input.candidateSha256,
    classification: result.route === "local_safety_boundary" ? "refusal" : "literature",
    outcome: result.route === "local_safety_boundary" ? "refused" : "answered",
    summary: answerUnits[0].text, details: answerUnits.slice(1).map((unit) => unit.text),
    sources, answerUnits, authoritySummary: [...new Map(answerUnits.map((unit) => [unit.authority.layer, unit.authority])).values()],
    caseEvidence: [], limitations: [], safetyBoundary: "", intendedUse: DNA_INTELLIGENCE_PUBLIC_INTENDED_USE,
    suggestedQuestions: [], topic: null, limitedRolloutFeedbackEligible: false,
    studentCandidate: { schemaVersion: STUDENT_APPLICATION_RESPONSE_VERSION,
      candidateSha256: input.candidateSha256, releaseEligible: false, rawMessagesStored: false,
      presentationFormat: result.plan.presentation.format } }
}

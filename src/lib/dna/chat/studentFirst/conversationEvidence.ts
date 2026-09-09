import { getDnaOwnerBookClaimMetadata, getDnaOwnerBookTopicClaims } from "../ownerBookRuntime"
import type { StudentAnswerExecutionPlan } from "./answerExecution"
import { resolveStudentTargetDescriptor } from "./targetCatalog"

/** Source provenance only: no raw message, answer, report, or inferred patient fact.
 * Supplied support is not proof that every source sentence was visibly asserted. */
export type StudentConversationEvidenceRef = Readonly<{ targetId: string; claimId: string }>
export const STUDENT_CONVERSATION_EVIDENCE_LIMIT = 64
export const STUDENT_CONVERSATION_EVIDENCE_PER_TARGET = 8

function knownTarget(value: unknown): boolean {
  if (typeof value !== "string" || value.length > 200) return false
  try { return resolveStudentTargetDescriptor(value).studentTargetId === value } catch { return false }
}

export function isStudentConversationEvidence(value: unknown): value is readonly StudentConversationEvidenceRef[] {
  return Array.isArray(value) && value.length <= STUDENT_CONVERSATION_EVIDENCE_LIMIT
    && value.every(row => row && typeof row === "object" && !Array.isArray(row)
      && Object.keys(row).length === 2 && knownTarget(row.targetId) && typeof row.claimId === "string"
      && /^owner\.unit:\d+:[a-f0-9]+$/.test(row.claimId))
    && new Set(value.map(row => `${row.targetId}:${row.claimId}`)).size === value.length
}

export function canonicalStudentConversationClaim(claimId: string) {
  const metadata = getDnaOwnerBookClaimMetadata(claimId)
  return metadata ? getDnaOwnerBookTopicClaims(metadata.topicId, true).find(claim => claim.claimId === claimId) ?? null : null
}

export function rememberStudentConversationEvidence(
  prior: readonly StudentConversationEvidenceRef[], plan: StudentAnswerExecutionPlan, usedClaimIds: readonly string[],
): readonly StudentConversationEvidenceRef[] {
  if (!isStudentConversationEvidence(prior)) throw new Error("student_history_evidence_invalid")
  // A summary must not make old evidence look newly discussed. Local case/policy
  // responses never become scientific memory; neither do unaccepted executions.
  if (plan.executionRoute !== "provider_grounded" || plan.operation === "summarize") return prior
  const added = plan.targetEvidence.flatMap(target => target.claims
    .filter(claim => claim.role !== "contrast" && usedClaimIds.includes(claim.claimId))
    .map(claim => {
      const canonical = canonicalStudentConversationClaim(claim.claimId)
      if (!canonical || canonical.text !== claim.text || canonical.sourceId !== claim.sourceId
        || canonical.passageId !== claim.passageId) throw new Error("student_history_source_not_canonical")
      return Object.freeze({ targetId: target.studentTargetId, claimId: claim.claimId })
    }))
  const seen = new Set<string>(), perTarget = new Map<string, number>()
  const retained = [...prior, ...added].reverse().filter(ref => {
    const key = `${ref.targetId}:${ref.claimId}`, count = perTarget.get(ref.targetId) ?? 0
    if (seen.has(key) || count >= STUDENT_CONVERSATION_EVIDENCE_PER_TARGET) return false
    seen.add(key); perTarget.set(ref.targetId, count + 1)
    return true
  }).slice(0, STUDENT_CONVERSATION_EVIDENCE_LIMIT).reverse()
  return Object.freeze(retained)
}

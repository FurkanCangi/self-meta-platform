import ownerBookRuntime from "../catalog/generated/owner-book/runtime.json"
import { getDnaOwnerBookTopicClaims, type DnaOwnerBookTopicClaim } from "../ownerBookRuntime"
import { normalizeDnaChatText, tokenizeDnaChatText } from "../text"
import type { StudentRequestContract } from "./contracts"
import { studentTargetVisibleAliases } from "./targetCatalog"

export type StudentSubtopicEvidenceBinding = Readonly<{
  selection: "requested_subtopic_approved_paragraph"
  ownerBookTopicId: string
  nodeId: string
  claimIds: readonly string[]
}>

// This is local lexical retrieval, not a semantic quality verdict. Neither the
// transient question nor derived user tokens enter the plan or conversation state.
function roots(text: string): readonly string[] {
  return [...new Set(tokenizeDnaChatText(text).filter((token) => token.length >= 4)
    .map((token) => token.slice(0, 5)))]
}

const REQUEST_LANGUAGE = /^(?:acikla|anlat|soyl|sor|kaste|goster|detay|ayrinti|uzun|kisa|basit|sade|genel|olarak|bunu|bunun|sunu|sunun|bana|biraz|kismini|kismi|tarafi|sadece|yalniz|hayir|yok|degil|daha|ayni|tekrar|yeniden|cumle|madde|lutfen|onceki|once|sonra|simdi|zaman|geri)/u
const CONDITION_SCOPE = /\b(?:bozuk\w*|yetersiz\w*|sendrom\w*|palsi|otizm\w*|adhd|hastalik\w*|taniya|taninin|prematur\w*|travma\w*)\b/gu

export function studentSubtopicRetrievalAllowed(contract: StudentRequestContract): boolean {
  return contract.safetyIntent === "general_education"
    && ["explain", "deepen", "mechanism", "daily_life", "measurement"].includes(contract.semanticTask)
    && !contract.requestedSemanticTasks.some((task) => ["example", "compare", "summarize", "case_reasoning"].includes(task))
    && !contract.caseContext.eventIds.length && !contract.referentCaseContext?.eventIds.length
}

export function studentRelatedEvidenceTopicIds(topicId: string, aliases: readonly string[]): readonly string[] {
  const labels = aliases.map(normalizeDnaChatText)
  return Object.freeze([...new Set([topicId, ...ownerBookRuntime.nodes
    .filter((node) => node.kind === "heading" && labels.some((label) =>
      ` ${normalizeDnaChatText(node.headingPath.join(" "))} `.includes(` ${label} `)))
    .map((node) => `owner-book-section/${node.id}`)])])
}

export function selectStudentSubtopicEvidence(input: Readonly<{
  question: string
  contract: StudentRequestContract
  topicId: string
  aliases: readonly string[]
  selectedClaims: readonly Readonly<{ claimId: string; text: string }>[]
  maximumClaims: number
}>): Readonly<{ binding: StudentSubtopicEvidenceBinding; claims: readonly DnaOwnerBookTopicClaim[] }> | null {
  if (!studentSubtopicRetrievalAllowed(input.contract) || input.maximumClaims < 2) return null
  const excludedRoots = new Set([...input.contract.targetIds, ...input.contract.rejectedTargetIds]
    .flatMap((targetId) => studentTargetVisibleAliases(targetId).flatMap(roots)))
  const normalizedQuestion = normalizeDnaChatText(input.question)
  // Retrieval-equivalent decrease verbs, not a new instruction or permission
  // to reduce someone's support. The original message still governs the reply.
  const retrievalQuestion = normalizedQuestion
    .replace(/\b(?:ogrenci\w*\s+)?ders\s+anlat\w*\s+gibi\b/gu, " ")
    .replace(/\bgeri(?:ye)?\s+cek(?:er|il|ebil|tig)\w*\b/gu, "azalt")
  const queryRoots = [...new Set(tokenizeDnaChatText(retrievalQuestion)
    .filter((token) => token.length >= 4 && !REQUEST_LANGUAGE.test(token)
      && !["cevap", "yanit", "olsun", "gibi", "verin"].includes(token))
    .map((token) => token.slice(0, 5)).filter((root) => !excludedRoots.has(root)))]
  if (queryRoots.length < 2) return null
  const suppliedRoots = new Set(input.selectedClaims.flatMap((claim) => roots(claim.text)))
  const missingRoots = new Set(queryRoots.filter((root) => !suppliedRoots.has(root)))
  if (!missingRoots.size) return null
  const rejectedLabels = input.contract.rejectedTargetIds.flatMap(studentTargetVisibleAliases).map(normalizeDnaChatText)
  const candidates = studentRelatedEvidenceTopicIds(input.topicId, input.aliases).flatMap((topicId) => {
    const claims = getDnaOwnerBookTopicClaims(topicId, true)
    const paragraphs = new Map<string, DnaOwnerBookTopicClaim[]>()
    for (const claim of claims) {
      const heading = normalizeDnaChatText(claim.headingPath.join(" "))
      // Do not generalize a condition-specific chapter or a rejected target's
      // material merely because it mentions the active concept as well.
      const conditions = heading.match(CONDITION_SCOPE) ?? []
      if (conditions.some((term) => !normalizedQuestion.includes(term))) continue
      if (rejectedLabels.some((label) => ` ${heading} `.includes(` ${label} `)
        || ` ${normalizeDnaChatText(claim.text)} `.includes(` ${label} `))) continue
      const paragraph = paragraphs.get(claim.nodeId) ?? []
      paragraph.push(claim)
      paragraphs.set(claim.nodeId, paragraph)
    }
    return [...paragraphs.entries()].map(([nodeId, paragraph]) => {
      const ranked = paragraph.map((claim) => {
        const tokens = new Set(roots(claim.text))
        const matched = queryRoots.filter((root) => tokens.has(root))
        return { claim, matched, novel: matched.filter((root) => missingRoots.has(root)) }
      }).sort((left, right) => right.matched.length - left.matched.length
        || right.novel.length - left.novel.length || left.claim.sentenceIndex - right.claim.sentenceIndex)
      // Require both a subject/detail match and new support. A lone keyword is
      // not authorization to substitute another source section.
      const lead = ranked[0]
      if (!lead || lead.matched.length < 2 || !lead.novel.length) return null
      const selected = ranked.filter((row) => row.matched.length > 0)
        .slice(0, input.maximumClaims - 1).map((row) => row.claim)
        .sort((left, right) => left.sentenceIndex - right.sentenceIndex)
      return { topicId, nodeId, claims: selected, matches: lead.matched.length, novel: lead.novel.length }
    }).filter((row) => row !== null)
  }).sort((left, right) => right.matches - left.matches || right.novel - left.novel
    || left.claims[0]!.nodeOrder - right.claims[0]!.nodeOrder || left.topicId.localeCompare(right.topicId))
  const best = candidates[0]
  if (!best) return null
  return Object.freeze({
    binding: Object.freeze({ selection: "requested_subtopic_approved_paragraph", ownerBookTopicId: best.topicId,
      nodeId: best.nodeId, claimIds: Object.freeze(best.claims.map((claim) => claim.claimId)) }),
    claims: Object.freeze(best.claims),
  })
}

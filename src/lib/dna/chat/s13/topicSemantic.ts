import type { DnaOwnerBookTopicClaim } from "../ownerBookRuntime"
import { normalizeDnaChatText } from "../text"
import type { DnaS13Claim, DnaS13RequestedFacet } from "./contracts"

export const DNA_S13_TOPIC_SEMANTIC_VERSION = "dna-s13-topic-semantic@1" as const

export const DNA_S13_CLAIM_DISCOURSE_ROLES = Object.freeze([
  "TOPIC_THESIS",
  "DEFINITION",
  "SUPPORT",
  "LIMITATION",
  "EXAMPLE",
  "MYTH_OR_COMMON_CLAIM",
  "CORRECTION",
  "CONTRAST",
  "LEAD_IN",
  "ENUMERATION_ITEM",
] as const)
export type DnaS13ClaimDiscourseRole = typeof DNA_S13_CLAIM_DISCOURSE_ROLES[number]

export type DnaS13ClaimSemantic = Readonly<{
  claimId: string
  topicId: string
  role: DnaS13ClaimDiscourseRole
  selfContained: boolean
  directTopicClaim: boolean
  orderIndex: number
  roleEvidenceCodes: readonly string[]
  adjacencyEnrichmentClaimIds: readonly string[]
}>

export type DnaS13TopicSemanticFrame = Readonly<{
  version: typeof DNA_S13_TOPIC_SEMANTIC_VERSION
  topicId: string
  title: string
  thesisClaimIds: readonly string[]
  headingStance: "boundary_or_correction" | "neutral"
  claims: readonly DnaS13ClaimSemantic[]
}>

const COMMON_CLAIM = /\b(?:populer anlat\w*|yaygin (?:anlati|gorus|inanc|iddia)|siklikla.{0,80}(?:soylenir|varsayilir)|kabul edilir|sanilir|one surulur)\b/u
const CORRECTION = /\b(?:bununla birlikte|oysa|ancak|gercekte|degildir|tamamlanmaz|olmak zorunda degildir|yeterli degildir|gostermez|aciklamaz|karistirilmamalidir)\b/u
const LIMITATION = /\b(?:sinirli\w*|sinirlilik\w*|yeterli degil\w*|tek basina|cikarilamaz\w*|gostermez\w*|aciklamaz\w*)\b/u
const EXAMPLE = /\b(?:ornegin|mesela|ornek olarak|gunluk yasamda|bir cocuk|bir kisi)\b/u
const DEFINITION = /\b(?:ifade eder|olarak adlandiril\w*|kavramdir|yapidir|sistemdir|surectir|anlamina gelir|olarak tanimlan\w*)\b/u
const CONTRAST = /\b(?:buna karsilik|tersine|ayni degil\w*|birbirinden farkli|ayri degerlendiril\w*)\b/u
const STRUCTURAL_LEAD_IN = /(?::|;\s*)$/u
const ANAPHORIC_START = /^(?:bu|bunun|buna|bunu|bunlar|bununla birlikte|ayrica|boylece|dolayisiyla|daha islevsel bir anlati)\b/u
const BOUNDARY_HEADING = /\b(?:degil\w*|tamamlanmaz\w*|gostermez\w*|aciklamaz\w*|karistirilmamali\w*|tek basina|hedef.{0,40}degil)\b/u

function titleTokens(value: string) {
  return normalizeDnaChatText(value).split(/\s+/u)
    .filter((token) => token.length >= 5 && !["nedir", "olarak", "acisindan"].includes(token))
}

function selfContained(input: Readonly<{ text: string; title: string }>) {
  const text = input.text.trim()
  const normalized = normalizeDnaChatText(text)
  if (!text || STRUCTURAL_LEAD_IN.test(text)) return false
  if (!ANAPHORIC_START.test(normalized)) return true
  const explicitTopicTokens = titleTokens(input.title)
    .filter((token) => normalizeDnaChatText(input.title).indexOf(token) >= 0)
  return explicitTopicTokens.some((token) => normalized.includes(token))
}

function baseRole(input: Readonly<{
  text: string
  title: string
  directTopicClaim: boolean
}>): Readonly<{ role: DnaS13ClaimDiscourseRole; codes: readonly string[] }> {
  const normalized = normalizeDnaChatText(input.text)
  if (STRUCTURAL_LEAD_IN.test(input.text.trim())) {
    return Object.freeze({ role: "LEAD_IN", codes: Object.freeze(["structural_terminal_colon"]) })
  }
  if (COMMON_CLAIM.test(normalized)) {
    return Object.freeze({ role: "MYTH_OR_COMMON_CLAIM", codes: Object.freeze(["reported_common_claim"]) })
  }
  if (CONTRAST.test(normalized)) {
    return Object.freeze({ role: "CONTRAST", codes: Object.freeze(["explicit_contrast_marker"]) })
  }
  if (CORRECTION.test(normalized)) {
    return Object.freeze({ role: "CORRECTION", codes: Object.freeze(["corrective_or_negating_statement"]) })
  }
  if (LIMITATION.test(normalized)) {
    return Object.freeze({ role: "LIMITATION", codes: Object.freeze(["explicit_boundary_marker"]) })
  }
  if (EXAMPLE.test(normalized)) {
    return Object.freeze({ role: "EXAMPLE", codes: Object.freeze(["explicit_example_marker"]) })
  }
  if (DEFINITION.test(normalized)) {
    return Object.freeze({ role: "DEFINITION", codes: Object.freeze(["explicit_definition_marker"]) })
  }
  if (!input.directTopicClaim) {
    return Object.freeze({ role: "ENUMERATION_ITEM", codes: Object.freeze(["direct_child_section_item"]) })
  }
  return Object.freeze({ role: "SUPPORT", codes: Object.freeze(["topic_support_statement"]) })
}

function thesisScore(input: Readonly<{
  role: DnaS13ClaimDiscourseRole
  text: string
  title: string
  selfContained: boolean
  directTopicClaim: boolean
  headingBoundary: boolean
  index: number
}>) {
  if (!input.selfContained || input.role === "LEAD_IN" || input.role === "MYTH_OR_COMMON_CLAIM") return -1_000
  const normalized = normalizeDnaChatText(input.text)
  const overlap = titleTokens(input.title).filter((token) => normalized.includes(token)).length
  let score = input.directTopicClaim ? 30 : 0
  score += Math.max(0, 12 - input.index)
  score += overlap * 3
  if (input.role === "DEFINITION") score += 18
  if (input.headingBoundary && ["CORRECTION", "LIMITATION", "CONTRAST"].includes(input.role)) score += 50
  if (input.headingBoundary && !/\b(?:degil\w*|tamamlanmaz\w*|gostermez\w*|aciklamaz\w*|yetersiz\w*)\b/u.test(normalized)) score -= 20
  return score
}

export function createDnaS13TopicSemanticFrame(input: Readonly<{
  topicId: string
  title: string
  orderedClaims: readonly DnaOwnerBookTopicClaim[]
}>): DnaS13TopicSemanticFrame {
  const headingBoundary = BOUNDARY_HEADING.test(normalizeDnaChatText(input.title))
  const drafts = input.orderedClaims.map((claim, index) => {
    const role = baseRole({ text: claim.text, title: claim.title, directTopicClaim: claim.directTopicClaim })
    return {
      claim,
      index,
      role: role.role,
      codes: role.codes,
      selfContained: selfContained({ text: claim.text, title: claim.title }),
    }
  })
  const thesis = [...drafts].sort((left, right) => thesisScore({
    role: right.role, text: right.claim.text, title: input.title,
    selfContained: right.selfContained, directTopicClaim: right.claim.directTopicClaim,
    headingBoundary, index: right.index,
  }) - thesisScore({
    role: left.role, text: left.claim.text, title: input.title,
    selfContained: left.selfContained, directTopicClaim: left.claim.directTopicClaim,
    headingBoundary, index: left.index,
  }) || left.index - right.index)[0]
  const thesisClaimIds = thesis && thesisScore({
    role: thesis.role, text: thesis.claim.text, title: input.title,
    selfContained: thesis.selfContained, directTopicClaim: thesis.claim.directTopicClaim,
    headingBoundary, index: thesis.index,
  }) > -1_000 ? [thesis.claim.claimId] : []
  const semantics = drafts.map((draft) => {
    const enrichment = draft.selfContained ? [] : drafts.slice(draft.index + 1)
      .filter((candidate) => candidate.selfContained && candidate.role !== "MYTH_OR_COMMON_CLAIM")
      .slice(0, 2).map((candidate) => candidate.claim.claimId)
    return Object.freeze({
      claimId: draft.claim.claimId,
      topicId: draft.claim.topicId,
      role: thesisClaimIds.includes(draft.claim.claimId) ? "TOPIC_THESIS" as const : draft.role,
      selfContained: draft.selfContained,
      directTopicClaim: draft.claim.directTopicClaim,
      orderIndex: draft.index,
      roleEvidenceCodes: Object.freeze([
        ...draft.codes,
        ...(thesisClaimIds.includes(draft.claim.claimId) ? ["topic_thesis_selected"] : []),
      ]),
      adjacencyEnrichmentClaimIds: Object.freeze(enrichment),
    })
  })
  return Object.freeze({
    version: DNA_S13_TOPIC_SEMANTIC_VERSION,
    topicId: input.topicId,
    title: input.title,
    thesisClaimIds: Object.freeze(thesisClaimIds),
    headingStance: headingBoundary ? "boundary_or_correction" : "neutral",
    claims: Object.freeze(semantics),
  })
}

export function ownerTopicClaimToDnaS13Claim(claim: DnaOwnerBookTopicClaim): DnaS13Claim {
  return Object.freeze({
    id: claim.claimId,
    text: claim.text,
    passageId: claim.passageId,
    sourceIds: Object.freeze([claim.sourceId]),
    topicId: claim.topicId,
    sectionId: claim.sectionId,
    focus: claim.focus,
    title: claim.title,
    domain: claim.domain,
    dimensions: Object.freeze([...claim.dimensions]),
    authorityClass: "owner_approved_book",
    citationStatus: "pending_sentence_mapping",
    answerEligible: true,
  })
}

export function claimRoleSupportsFacet(role: DnaS13ClaimDiscourseRole, facet: DnaS13RequestedFacet) {
  if (["definition", "core_scope"].includes(facet)) {
    return ["TOPIC_THESIS", "DEFINITION", "CORRECTION", "CONTRAST", "SUPPORT", "ENUMERATION_ITEM"].includes(role)
  }
  if (facet === "limitation" || facet === "boundary") {
    return ["TOPIC_THESIS", "LIMITATION", "CORRECTION", "CONTRAST"].includes(role)
  }
  if (facet === "verified_example") return role === "EXAMPLE"
  if (facet === "explanatory_detail") {
    return ["TOPIC_THESIS", "DEFINITION", "SUPPORT", "ENUMERATION_ITEM", "CONTRAST", "CORRECTION"].includes(role)
  }
  return role !== "MYTH_OR_COMMON_CLAIM" && role !== "LEAD_IN"
}

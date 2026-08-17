import { normalizeDnaChatText } from "../text"
import { DNA_S13_REQUESTED_FACETS, type DnaS13Claim, type DnaS13QueryFrame, type DnaS13RequestedFacet } from "./contracts"
import {
  DNA_S13_STRICT_PLAN_VERSION,
  type DnaS13StrictExplanatoryDecision,
  type DnaS13AllowedDerivationType,
  type DnaS13FacetEntailmentResult,
  type DnaS13FacetEvidence,
  type DnaS13SemanticOperationAudit,
  type DnaS13TargetPolarityRecord,
  type DnaS13StrictLockedClaim,
  type DnaS13StrictPlan,
  type DnaS13StrictRelationContract,
  type DnaS13StrictSlot,
} from "./strictContracts"
import { deriveDnaS13ComparisonConclusion } from "./strictComparisonConclusion"
import { resolveDnaS13AnswerSufficiency } from "./answerSufficiency"
import { dnaS13HasPresentationModifier, type DnaS13PragmaticTaskFrame } from "./pragmaticTask"
import {
  DNA_S13_STRICT_RELATION_CONTRACT_VERSION,
  relationContractsFromClaim,
} from "./strictRelations"
import {
  claimRoleSupportsFacet,
  type DnaS13TopicSemanticFrame,
} from "./topicSemantic"
import type { DnaS13ConceptTypeClassification } from "./conceptType"

function unique(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))]
}

function tokenSet(value: string) {
  return new Set(normalizeDnaChatText(value).split(/\s+/).filter((token) => token.length >= 4))
}

function isNearDuplicate(left: DnaS13Claim, right: DnaS13Claim) {
  const a = tokenSet(left.text)
  const b = tokenSet(right.text)
  const shared = [...a].filter((token) => b.has(token)).length
  return Math.max(a.size, b.size) > 0 && shared / Math.max(a.size, b.size) >= 0.8
}

function neighborScore(required: readonly DnaS13Claim[], candidate: DnaS13Claim) {
  let score = 0
  const requiredTokens = new Set(required.flatMap((claim) => [...tokenSet(claim.text)]))
  if (required.some((claim) => claim.topicId === candidate.topicId)) score += 12
  if (candidate.sectionId && required.some((claim) => claim.sectionId === candidate.sectionId)) score += 10
  if (candidate.title && required.some((claim) => claim.title === candidate.title)) score += 6
  if (candidate.domain && required.some((claim) => claim.domain === candidate.domain)) score += 4
  if (required.some((claim) => claim.sourceIds.some((sourceId) => candidate.sourceIds.includes(sourceId)))) score += 3
  score += [...tokenSet(candidate.text)].filter((token) => requiredTokens.has(token)).length
  return score
}

function meaningfulOverlap(left: string, right: string) {
  const a = tokenSet(left)
  const b = tokenSet(right)
  return [...a].filter((token) => [...b].some((candidate) =>
    token === candidate || (token.length >= 5 && candidate.length >= 5 && token.slice(0, 5) === candidate.slice(0, 5)),
  )).length
}

const BOUNDARY_MARKERS = [
  "sınırlı", "sınırlıdır", "yeterli değildir", "tek başına", "tamamını", "mükemmel değildir", "aynı değildir", "daha geniştir",
] as const
const EXAMPLE_MARKERS = ["örneğin", "örnek olarak", "gibi"] as const
const IMPORTANCE_MARKERS = ["günlük yaşam", "katılım", "işlev", "önemli", "anlamlı talep"] as const

const FACET_LABELS: Readonly<Record<DnaS13RequestedFacet, string>> = Object.freeze({
  definition: "temel anlam",
  function: "işlev veya önem",
  boundary: "yorum sınırı",
  supported_meaning: "desteklenen anlam",
  limitation: "sınırlılık",
  components: "bileşenler",
  core_scope: "ana kapsam",
  explanatory_detail: "açıklayıcı ayrıntı",
  distinction: "ayrım",
  verified_example: "örnek",
})

export function createDnaS13SimplifyEvidenceLimitation(
  question: string,
  facets: readonly DnaS13RequestedFacet[],
) {
  const labels = unique(facets.map((facet) => FACET_LABELS[facet])).join(", ")
  const concise = /\b(?:yalin|tek cumle)\b/u.test(normalizeDnaChatText(question))
  return concise
    ? `Bu başlığın ${labels} yönünü daha yalın anlatmak için yeterli doğrulanmış içerik yok.`
    : `Bu başlık için ${labels} konusunda günlük dille aktarılabilecek yeterli doğrulanmış içerik bulunmuyor.`
}

const DIRECT_FACET_DIMENSIONS: Readonly<Record<DnaS13RequestedFacet, readonly string[]>> = Object.freeze({
  definition: Object.freeze(["definition"]),
  function: Object.freeze(["daily_function", "function"]),
  boundary: Object.freeze(["misconception_boundary", "interpretation_boundary"]),
  supported_meaning: Object.freeze(["evidence"]),
  limitation: Object.freeze(["limitation", "misconception_boundary"]),
  components: Object.freeze(["components"]),
  core_scope: Object.freeze(["definition", "scope"]),
  explanatory_detail: Object.freeze(["process", "physiology", "relation", "mechanism"]),
  distinction: Object.freeze(["comparison"]),
  verified_example: Object.freeze(["example"]),
})

function directFacetPattern(facet: DnaS13RequestedFacet, strictSignificance: boolean) {
  if (facet === "definition") return /\b(?:ifade eder|tanim\w*|olarak adlandiril\w*|kavramdir|yapidir|sistemdir|surectir|anlamina gelir)\b/u
  if (facet === "core_scope") return /\b(?:kapsa\w*|odaklan\w*|temel\w*|cerceve\w*|butun\w*|icerir)\b/u
  if (facet === "function") return strictSignificance
    ? /\b(?:onem\w*|katki\w*|rol oyn\w*|gunluk yasam\w*|katilim\w*|performans\w*|uygulama\w*|yorumlama\w*|egitim\w*)\b/u
    : /\b(?:islev\w*|amac\w*|rol\w*|katki\w*|katilim\w*|gunluk yasam\w*|performans\w*|kullanil\w*|sagla\w*|yardim\w*|duzenle\w*)\b/u
  if (facet === "boundary") return /\b(?:degil\w*|yeterli degil|tek basina|cikarilamaz\w*|gostermez\w*|ayri\w*|sinir\w*)\b/u
  if (facet === "supported_meaning") return /\b(?:goster\w*|yansit\w*|ifade eder|anlama gelir|desteklen\w*|iliskili\w*)\b/u
  if (facet === "limitation") return /\b(?:sinirli\w*|sinirlilik\w*|yeterli degil|tek basina|eksik\w*|kisit\w*)\b/u
  if (facet === "components") return /\b(?:bilesen\w*|unsur\w*|parca\w*|olusu\w*)\b/u
  if (facet === "explanatory_detail") return /\b(?:mekanizma\w*|isleyis\w*|surec\w*|yol\w*|baglanti\w*|iliski\w*|etkiles\w*|duzenlen\w*)\b/u
  if (facet === "distinction") return /\b(?:ayni degil\w*|fark\w*|ayri\w*|biri\w*|digeri\w*|ayrim\w*)\b/u
  return /\b(?:ornek olarak|ornegin|mesela|gunluk yasamda|okulda|evde|oyun sirasinda|gorev sirasinda)\b/u
}

function partialFacetPattern(facet: DnaS13RequestedFacet) {
  if (facet === "explanatory_detail") return /\b(?:surec\w*|sistem\w*|yapi\w*|iliski\w*|baglam\w*|duzenle\w*)\b/u
  if (facet === "function") return /\b(?:sagla\w*|etkile\w*|iliskili\w*|duzenle\w*|yardim\w*|eylem\w*|uyum\w*)\b/u
  if (facet === "verified_example") return /\b(?:cocuk\w*|kisi\w*|gunluk\w*|oyun\w*|okul\w*|evde|gorev\w*|durum\w*|sirasinda|davranis\w*)\b/u
  return /\b(?:ilisk\w*|baglam\w*|surec\w*|sistem\w*|yapi\w*|durum\w*|farkli\w*)\b/u
}

function claimFacetEntailment(input: Readonly<{
  claim: DnaS13Claim
  facet: DnaS13RequestedFacet
  candidateIndex: number
  strictSignificance: boolean
  topicSemanticFrame?: DnaS13TopicSemanticFrame | null
}>): Readonly<{
  result: DnaS13FacetEntailmentResult
  dimensionDirect: boolean
  lexicalDirect: boolean
  summaryDirect: boolean
}> {
  const normalized = normalizeDnaChatText(input.claim.text)
  const dimensions = new Set(input.claim.dimensions ?? [])
  const dimensionDirect = DIRECT_FACET_DIMENSIONS[input.facet].some((dimension) => dimensions.has(dimension))
  const lexicalDirect = directFacetPattern(input.facet, input.strictSignificance).test(normalized)
  const semantic = input.topicSemanticFrame?.claims.find((entry) => entry.claimId === input.claim.id)
  // Being selected as the topic thesis establishes relevance, not facet
  // entailment. A boundary thesis such as “X, Y değildir” must not become a
  // definition merely because it is first or prominent.
  const summaryDirect = semantic?.role === "TOPIC_THESIS"
    && (input.facet === "definition" || input.facet === "core_scope")
    && (dimensionDirect || lexicalDirect || semantic.roleEvidenceCodes.includes("explicit_definition_marker"))
  if (input.facet === "verified_example") {
    const concreteScenario = /\b(?:ornegin|mesela|ornek olarak|gunluk yasamda|okulda|evde|oyun sirasinda|gorev sirasinda|bir cocuk|bir kisi)\b/u.test(normalized)
    const explicitExample = dimensions.has("example") || /\b(?:ornegin|mesela|ornek olarak)\b/u.test(normalized)
      || (/\b(?:cocuk|kisi)\b/u.test(normalized) && /\b(?:sirasinda|okulda|evde|oyunda|etkinlikte)\b/u.test(normalized))
    if (concreteScenario && explicitExample) return Object.freeze({ result: "ENTAILS", dimensionDirect, lexicalDirect, summaryDirect })
    return Object.freeze({
      result: partialFacetPattern(input.facet).test(normalized) ? "PARTIAL" : "DOES_NOT_ENTAIL",
      dimensionDirect, lexicalDirect, summaryDirect,
    })
  }
  if (input.facet === "function" && input.strictSignificance) {
    const significanceDimension = dimensions.has("daily_function") || dimensions.has("function")
    if (significanceDimension || lexicalDirect) return Object.freeze({ result: "ENTAILS", dimensionDirect, lexicalDirect, summaryDirect })
    return Object.freeze({
      result: partialFacetPattern(input.facet).test(normalized) ? "PARTIAL" : "DOES_NOT_ENTAIL",
      dimensionDirect, lexicalDirect, summaryDirect,
    })
  }
  if (dimensionDirect || lexicalDirect || summaryDirect) {
    return Object.freeze({ result: "ENTAILS", dimensionDirect, lexicalDirect, summaryDirect })
  }
  return Object.freeze({
    result: partialFacetPattern(input.facet).test(normalized) ? "PARTIAL" : "DOES_NOT_ENTAIL",
    dimensionDirect, lexicalDirect, summaryDirect,
  })
}

export function resolveDnaS13FacetEvidence(input: Readonly<{
  subquestionId: string
  topicId: string
  requestedFacets: readonly DnaS13RequestedFacet[]
  candidates: readonly DnaS13Claim[]
  strictSignificance?: boolean
  excludedClaimIds?: readonly string[]
  excludedClaims?: readonly DnaS13Claim[]
  topicSemanticFrame?: DnaS13TopicSemanticFrame | null
}>) {
  const requested = new Set(input.requestedFacets)
  const excludedClaimIds = new Set(input.excludedClaimIds ?? [])
  const claimsByFacet: Partial<Record<DnaS13RequestedFacet, readonly DnaS13Claim[]>> = {}
  const matrix: DnaS13FacetEvidence[] = DNA_S13_REQUESTED_FACETS.map((facet) => {
    if (!requested.has(facet)) return Object.freeze({
      subquestionId: input.subquestionId,
      topicId: input.topicId,
      facet,
      status: "NOT_REQUESTED" as const,
      supportClaimIds: Object.freeze([]),
      supportRelationIds: Object.freeze([]),
      entailment: "DOES_NOT_ENTAIL" as const,
      allowedDerivationType: null,
      derivedFacet: null,
      evaluatedClaimIds: Object.freeze([]),
      confidence: 1,
    })
    const eligible = input.candidates.filter((claim) => !claim.id.startsWith("system.")
      && claim.answerEligible !== false && claim.sourceIds.length > 0 && Boolean(claim.passageId))
    const semanticByClaimId = new Map((input.topicSemanticFrame?.claims ?? []).map((entry) => [entry.claimId, entry]))
    const decisions = eligible.map((claim, index) => {
      const semantic = semanticByClaimId.get(claim.id)
      return Object.freeze({
      claim,
      semantic,
      excluded: excludedClaimIds.has(claim.id)
        || (input.excludedClaims ?? []).some((shown) => shown.id !== claim.id && isNearDuplicate(claim, shown)),
      roleEligible: semantic ? claimRoleSupportsFacet(semantic.role, facet) : true,
      selfContained: semantic?.selfContained ?? true,
      ...claimFacetEntailment({
        claim,
        facet,
        candidateIndex: index,
        strictSignificance: input.strictSignificance ?? false,
        topicSemanticFrame: input.topicSemanticFrame,
      }),
    })})
    const evaluatedClaimIds = Object.freeze(decisions.filter((row) => row.result !== "DOES_NOT_ENTAIL")
      .map((row) => row.claim.id).slice(0, 12))
    const availableEntailingClaimIds = Object.freeze(decisions.filter((row) => row.result === "ENTAILS"
      && row.roleEligible && row.selfContained).map((row) => row.claim.id).slice(0, 12))
    const partialClaimIds = Object.freeze(decisions.filter((row) => row.result === "PARTIAL")
      .map((row) => row.claim.id).slice(0, 12))
    const ranked = decisions.flatMap((decision) => {
      if (decision.excluded || !decision.roleEligible || !decision.selfContained || decision.result !== "ENTAILS") return []
      const { claim, dimensionDirect, lexicalDirect, summaryDirect } = decision
      const overlap = meaningfulOverlap(FACET_LABELS[facet], claim.text)
      const thesisBonus = decision.semantic?.role === "TOPIC_THESIS"
        ? ["definition", "core_scope"].includes(facet) ? 60 : 15
        : 0
      const score = 100 + (dimensionDirect ? 20 : 0) + (lexicalDirect ? 15 : 0)
        + (summaryDirect ? 10 : 0) + thesisBonus + overlap
      return [{ claim, score }]
    }).sort((left, right) => right.score - left.score || left.claim.id.localeCompare(right.claim.id))
    const selected = ranked[0] ?? null
    let derived: Readonly<{
      claims: readonly DnaS13Claim[]
      relations: readonly string[]
      type: DnaS13AllowedDerivationType
    }> | null = null
    if (!selected) {
      const leadIn = decisions.find((row) => !row.excluded && !row.selfContained
        && row.semantic?.role === "LEAD_IN" && row.result === "ENTAILS")
      const enrichmentIds = leadIn?.semantic?.adjacencyEnrichmentClaimIds ?? []
      const enrichment = enrichmentIds.flatMap((claimId) => {
        const row = decisions.find((candidate) => candidate.claim.id === claimId)
        return row && !row.excluded && row.selfContained && row.roleEligible ? [row.claim] : []
      }).slice(0, 2)
      if (leadIn && enrichment.length > 0) derived = Object.freeze({
        claims: Object.freeze(enrichment),
        relations: Object.freeze([]),
        type: "verified_lead_in_plus_adjacent_enumeration" as const,
      })
    }
    if (!selected && !derived && facet === "distinction") {
      const relationCandidate = decisions.find((row) => !row.excluded && relationContractsFromClaim(row.claim)
        .some((relation) => ["contrast", "equivalence", "hierarchy"].includes(relation.type)))
      if (relationCandidate) {
        derived = Object.freeze({
          claims: Object.freeze([relationCandidate.claim]),
          relations: Object.freeze(relationContractsFromClaim(relationCandidate.claim)
            .filter((relation) => ["contrast", "equivalence", "hierarchy"].includes(relation.type)).map((relation) => relation.id)),
          type: "verified_relation_to_distinction" as const,
        })
      } else {
        const definition = eligible.find((claim, index) => !excludedClaimIds.has(claim.id)
          && claimFacetEntailment({ claim, facet: "definition", candidateIndex: index, strictSignificance: false, topicSemanticFrame: input.topicSemanticFrame }).result === "ENTAILS")
        const boundary = eligible.find((claim, index) => !excludedClaimIds.has(claim.id) && claim.id !== definition?.id
          && claimFacetEntailment({ claim, facet: "boundary", candidateIndex: index, strictSignificance: false, topicSemanticFrame: input.topicSemanticFrame }).result === "ENTAILS")
        if (definition && boundary) derived = Object.freeze({
          claims: Object.freeze([definition, boundary]),
          relations: Object.freeze([]),
          type: "definition_plus_verified_boundary_to_distinction" as const,
        })
      }
    }
    if (!selected && !derived) return Object.freeze({
      subquestionId: input.subquestionId,
      topicId: input.topicId,
      facet,
      status: "UNSUPPORTED" as const,
      supportClaimIds: Object.freeze([]),
      supportRelationIds: Object.freeze([]),
      entailment: decisions.some((row) => row.result === "PARTIAL") ? "PARTIAL" as const : "DOES_NOT_ENTAIL" as const,
      allowedDerivationType: null,
      derivedFacet: null,
      evaluatedClaimIds,
      availableEntailingClaimIds,
      partialClaimIds,
      confidence: 0,
    })
    const selectedClaims = selected ? [selected.claim] : [...derived!.claims]
    claimsByFacet[facet] = Object.freeze(selectedClaims)
    return Object.freeze({
      subquestionId: input.subquestionId,
      topicId: input.topicId,
      facet,
      status: selected ? "SUPPORTED_DIRECT" as const : "SUPPORTED_DERIVED" as const,
      supportClaimIds: Object.freeze(selectedClaims.map((claim) => claim.id)),
      supportRelationIds: Object.freeze(derived?.relations ?? []),
      entailment: "ENTAILS" as const,
      allowedDerivationType: derived?.type ?? null,
      derivedFacet: derived ? facet : null,
      evaluatedClaimIds,
      availableEntailingClaimIds,
      partialClaimIds,
      confidence: selected ? 0.95 : 0.85,
    })
  })
  return Object.freeze({
    matrix: Object.freeze(matrix),
    claimsByFacet: Object.freeze(claimsByFacet),
  })
}

export function dnaS13ExplanatoryRelevanceReasons(input: Readonly<{
  question: string
  required: readonly DnaS13Claim[]
  candidate: DnaS13Claim
}>) {
  // Titles establish context but must not manufacture semantic overlap. This is
  // important for broad sections such as “Alternatif Oturma”, where an example
  // about a therapy ball does not explain a writing-measurement question.
  const requiredText = input.required.map((claim) => claim.text).join(" ")
  const candidateText = input.candidate.text
  const questionOverlap = meaningfulOverlap(input.question, candidateText)
  const claimOverlap = meaningfulOverlap(requiredText, candidateText)
  const sameTitle = input.required.some((claim) => Boolean(claim.title && input.candidate.title && claim.title === input.candidate.title))
  const sameSection = input.required.some((claim) => Boolean(claim.sectionId && input.candidate.sectionId && claim.sectionId === input.candidate.sectionId))
  const sameDomain = input.required.some((claim) => Boolean(claim.domain && input.candidate.domain && claim.domain === input.candidate.domain))
  const requiredDimensions = new Set(input.required.flatMap((claim) => claim.dimensions ?? []))
  const candidateDimensions = new Set(input.candidate.dimensions ?? [])
  const sharedDimensionValues = [...candidateDimensions].filter((dimension) => requiredDimensions.has(dimension))
  const sharedDimensions = sharedDimensionValues.length
  const normalizedCandidate = normalizeDnaChatText(input.candidate.text)
  const sameContext = sameTitle || sameSection || sameDomain
  const reasons: string[] = []

  if (questionOverlap >= 2) reasons.push("direct_question_answer")
  if (claimOverlap >= 3) reasons.push("required_claim_meaning")
  if (sameTitle && questionOverlap >= 1 && sharedDimensions >= 1) reasons.push("same_concept_explanation")
  if (sameTitle && claimOverlap >= 2 && sharedDimensions >= 2) reasons.push("same_concept_context")

  const boundaryRelevant = ["measurement", "misconception_boundary", "daily_function", "comparison"]
    .some((dimension) => sharedDimensionValues.includes(dimension))
  if (sameContext && sharedDimensions >= 2 && boundaryRelevant
    && BOUNDARY_MARKERS.some((marker) => normalizedCandidate.includes(normalizeDnaChatText(marker)))) {
    reasons.push("important_boundary")
  }

  const mechanismRelevant = ["process", "physiology", "relation"]
    .some((dimension) => candidateDimensions.has(dimension) && requiredDimensions.has(dimension))
  if (sameContext && mechanismRelevant && (questionOverlap >= 1 || claimOverlap >= 1)) reasons.push("mechanism_or_reason")

  if (sameContext && sharedDimensions >= 1 && (questionOverlap >= 1 || claimOverlap >= 1)
    && EXAMPLE_MARKERS.some((marker) => normalizedCandidate.includes(normalizeDnaChatText(marker)))) {
    reasons.push("direct_example")
  }

  if (sameContext && sharedDimensionValues.includes("daily_function")
    && IMPORTANCE_MARKERS.some((marker) => normalizedCandidate.includes(normalizeDnaChatText(marker)))) {
    reasons.push("why_it_matters")
  }

  return Object.freeze(unique(reasons))
}

export function isDnaS13DirectlyExplanatory(input: Readonly<{
  question: string
  required: readonly DnaS13Claim[]
  candidate: DnaS13Claim
}>) {
  return dnaS13ExplanatoryRelevanceReasons(input).length > 0
}

function explanationLimit(frame: DnaS13QueryFrame, questionType: string, focus: string) {
  if (frame.responseDepth === "short") return 0
  const explanationRequested = ["explanation", "follow_up"].includes(questionType)
    || ["physiology", "process"].includes(focus)
  if (!explanationRequested) return 0
  return frame.responseDepth === "deep" ? 2 : 1
}

function selectExplanatoryClaims(input: Readonly<{
  subquestionId: string
  question: string
  required: readonly DnaS13Claim[]
  candidates: readonly DnaS13Claim[]
  limit: number
  topicSemanticFrame?: DnaS13TopicSemanticFrame
}>) {
  const decisions = new Map<string, DnaS13StrictExplanatoryDecision>()
  const eligible = unique(input.candidates.map((candidate) => candidate.id)).flatMap((claimId) => {
    const candidate = input.candidates.find((entry) => entry.id === claimId)
    if (!candidate) return []
    const excluded = (reason: string) => {
      decisions.set(candidate.id, Object.freeze({
        subquestionId: input.subquestionId,
        claimId: candidate.id,
        decision: "excluded" as const,
        reasons: Object.freeze([reason]),
      }))
      return []
    }
    if (!input.limit) return excluded("explanation_not_requested")
    if (candidate.answerEligible === false) return excluded("answer_ineligible")
    const semantic = input.topicSemanticFrame?.claims.find((entry) => entry.claimId === candidate.id)
    if (semantic && !semantic.selfContained) return excluded("non_self_contained_claim")
    if (semantic?.role === "MYTH_OR_COMMON_CLAIM") return excluded("myth_or_common_claim_not_explanatory")
    if (input.required.some((claim) => claim.id === candidate.id || isNearDuplicate(claim, candidate))) return excluded("required_or_duplicate")
    if (candidate.text.trim().length < 12 || candidate.sourceIds.length === 0) return excluded("unbound_or_too_short")
    const reasons = dnaS13ExplanatoryRelevanceReasons({ question: input.question, required: input.required, candidate })
    if (!reasons.length) return excluded("not_directly_explanatory")
    const score = neighborScore(input.required, candidate)
    if (score < 12) return excluded("context_score_too_low")
    return [{ candidate, score, reasons }]
  })

  const selected = eligible
    .sort((left, right) => right.score - left.score || left.candidate.id.localeCompare(right.candidate.id))
    .filter((entry, index, rows) => rows.findIndex((other) => isNearDuplicate(other.candidate, entry.candidate)) === index)
    .slice(0, input.limit)
  const selectedIds = new Set(selected.map((entry) => entry.candidate.id))
  for (const entry of eligible) {
    decisions.set(entry.candidate.id, Object.freeze({
      subquestionId: input.subquestionId,
      claimId: entry.candidate.id,
      decision: selectedIds.has(entry.candidate.id) ? "kept" as const : "excluded" as const,
      reasons: Object.freeze(selectedIds.has(entry.candidate.id) ? [...entry.reasons] : ["selection_limit_or_near_duplicate"]),
    }))
  }
  return {
    claims: selected.map((entry) => entry.candidate),
    decisions: Object.freeze([...decisions.values()].sort((left, right) => left.claimId.localeCompare(right.claimId))),
  }
}

function shortHash(value: string) {
  let hash = 2_166_136_261
  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16_777_619)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

export function createDnaS13ComparisonConclusionSlot(sides: readonly DnaS13StrictSlot[]): DnaS13StrictSlot | null {
  const decision = deriveDnaS13ComparisonConclusion(sides)
  if (!decision) return null
  const [left, right] = sides
  if (!left || !right) return null
  const controlledText = decision.controlledText
  const supportClaims = unique(decision.supportClaimIds).flatMap((claimId) => {
    const entry = [...left.lockedClaims, ...right.lockedClaims].find((row) => row.claim.id === claimId)
    return entry ? [entry.claim] : []
  })
  const sourceIds = unique(supportClaims.flatMap((claim) => claim.sourceIds))
  const relationId = `relation:comparison-conclusion:${shortHash(`${left.topicId}|${right.topicId}`)}`
  const relation: DnaS13StrictRelationContract = Object.freeze({
    id: relationId,
    version: DNA_S13_STRICT_RELATION_CONTRACT_VERSION,
    type: "comparison_conclusion",
    support: "controlled_conclusion",
    sourceClaimIds: Object.freeze(left.requiredClaimIds.filter((claimId) => decision.supportClaimIds.includes(claimId))),
    targetClaimIds: Object.freeze(right.requiredClaimIds.filter((claimId) => decision.supportClaimIds.includes(claimId))),
    surfaceMarkers: Object.freeze([decision.mode === "contrast_by_verified_definitions" ? "temel fark"
      : decision.mode === "abstain" ? "yeterli bilgi" : "aynı düzeyde"]),
    controlledText,
  })
  return Object.freeze({
    id: `strict-slot-${sides.length + 1}`,
    orderIndex: sides.length,
    kind: "comparison_conclusion",
    subquestionId: "comparison-conclusion",
    question: "İki taraf için güvenli karşılaştırma sonucunu ver.",
    topicId: "system.comparison-conclusion",
    focus: "comparison",
    questionType: "comparison",
    comparisonTargetTopicIds: Object.freeze([left.topicId, right.topicId]),
    lockedClaims: Object.freeze(supportClaims.map((claim) => Object.freeze({ claim, role: "required" as const }))),
    requiredClaimIds: Object.freeze(supportClaims.map((claim) => claim.id)),
    lockedClaimIds: Object.freeze(supportClaims.map((claim) => claim.id)),
    sourceIds: Object.freeze(sourceIds),
    relationContracts: Object.freeze([relation]),
    controlledText,
    comparisonConclusionMode: decision.mode,
    comparisonConclusionSupportClaimIds: decision.supportClaimIds,
    comparisonConclusionCategoryLabels: decision.categoryLabels,
    comparisonConclusionBasis: decision.basis,
  })
}

export function createDnaS13StrictPlan(input: Readonly<{
  frame: DnaS13QueryFrame
  pragmaticTaskFrame?: DnaS13PragmaticTaskFrame | null
  requiredClaimsBySubquestion: Readonly<Record<string, readonly DnaS13Claim[]>>
  requiredClaimsByFacetBySubquestion?: Readonly<Record<string, Partial<Record<DnaS13RequestedFacet, readonly DnaS13Claim[]>>>>
  facetEvidenceBySubquestion?: Readonly<Record<string, readonly DnaS13FacetEvidence[]>>
  explanatoryCandidatesBySubquestion?: Readonly<Record<string, readonly DnaS13Claim[]>>
  topicSemanticFramesBySubquestion?: Readonly<Record<string, DnaS13TopicSemanticFrame>>
  topicConceptTypes?: readonly DnaS13ConceptTypeClassification[]
  simplifyPayloadAudit?: readonly import("./strictContracts").DnaS13SimplifyPayloadAudit[]
  semanticOperation?: Readonly<{
    operation: string
    targets: readonly DnaS13TargetPolarityRecord[]
    alreadyShownClaimIds: readonly string[]
    alreadyAnsweredFacets: readonly DnaS13RequestedFacet[]
    alreadyShownRelationIds?: readonly string[]
  }>
  questionHash?: string
}>): DnaS13StrictPlan {
  const explanatoryDecisions: DnaS13StrictExplanatoryDecision[] = []
  let slotNumber = 0
  const facetEvidenceMatrix = Object.freeze(input.frame.subquestions.flatMap((subquestion) => {
    const requested = new Set(subquestion.requestedFacets ?? [])
    const provided = input.facetEvidenceBySubquestion?.[subquestion.id]
    if (provided) return provided
    const facetClaims = input.requiredClaimsByFacetBySubquestion?.[subquestion.id] ?? {}
    return DNA_S13_REQUESTED_FACETS.map((facet) => {
      const claims = facetClaims[facet] ?? []
      const supported = requested.has(facet) && claims.length > 0
      return Object.freeze({
        subquestionId: subquestion.id,
        topicId: subquestion.topicId,
        facet,
        status: !requested.has(facet) ? "NOT_REQUESTED" as const
          : supported ? "SUPPORTED_DIRECT" as const : "UNSUPPORTED" as const,
        supportClaimIds: Object.freeze(supported ? claims.map((claim) => claim.id) : []),
        supportRelationIds: Object.freeze([]),
        entailment: supported ? "ENTAILS" as const : "DOES_NOT_ENTAIL" as const,
        allowedDerivationType: null,
        derivedFacet: null,
        evaluatedClaimIds: Object.freeze(claims.map((claim) => claim.id)),
        confidence: supported ? 0.95 : requested.has(facet) ? 0 : 1,
      })
    })
  }))
  const suppressPreviouslyShownDeepeningClaims = input.pragmaticTaskFrame?.pragmaticAction === "DEEPEN"
    && input.pragmaticTaskFrame.discourseConstraints.includes("do_not_repeat")
  const previouslyShownDeepeningClaimIds = new Set(input.semanticOperation?.alreadyShownClaimIds ?? [])
  const answerSlots: DnaS13StrictSlot[] = input.frame.subquestions.flatMap((subquestion) => {
    const baseRequired = input.requiredClaimsBySubquestion[subquestion.id] ?? []
    const requestedFacets = subquestion.requestedFacets ?? []
    const facetClaims = input.requiredClaimsByFacetBySubquestion?.[subquestion.id]
    const rows: readonly Readonly<{ facet: DnaS13RequestedFacet | null; claims: readonly DnaS13Claim[] }>[] =
      requestedFacets.length && facetClaims
        ? requestedFacets.map((facet) => Object.freeze({ facet, claims: facetClaims[facet] ?? [] }))
        : [Object.freeze({ facet: null, claims: baseRequired })]

    const usedRequiredClaimIds = new Set<string>()
    return rows.flatMap(({ facet, claims }) => {
      const required = unique(claims.map((claim) => claim.id)).flatMap((claimId) => {
        const claim = claims.find((item) => item.id === claimId)
        if (!claim || usedRequiredClaimIds.has(claimId)) return []
        return [claim]
      }).filter((claim) => !suppressPreviouslyShownDeepeningClaims
        || !previouslyShownDeepeningClaimIds.has(claim.id))
      if (!required.length) return []
      if (required.some((claim) => claim.id.startsWith("system.facet-boundary:"))) {
        throw new Error(`dna_s13_strict_pseudo_facet_claim_forbidden:${subquestion.id}:${facet ?? "default"}`)
      }
      required.forEach((claim) => usedRequiredClaimIds.add(claim.id))
      if (required.some((claim) => !claim.text.trim() || !claim.passageId.trim() || claim.sourceIds.length === 0)) {
        throw new Error(`dna_s13_strict_required_claim_unbound:${subquestion.id}:${facet ?? "default"}`)
      }
      const topicSemanticFrame = input.topicSemanticFramesBySubquestion?.[subquestion.id]
      const explanatorySelection = selectExplanatoryClaims({
        subquestionId: subquestion.id,
        question: subquestion.question,
        required,
        candidates: input.explanatoryCandidatesBySubquestion?.[subquestion.id] ?? [],
        limit: facet ? 0 : explanationLimit(input.frame, subquestion.questionType, subquestion.focus),
        topicSemanticFrame,
      })
      explanatoryDecisions.push(...explanatorySelection.decisions)
      const explanatory = explanatorySelection.claims
      const lockedClaims: DnaS13StrictLockedClaim[] = [
        ...required.map((claim) => Object.freeze({ claim, role: "required" as const })),
        ...explanatory.map((claim) => Object.freeze({ claim, role: "explanatory" as const })),
      ]
      const lockedClaimIds = new Set(lockedClaims.map((entry) => entry.claim.id))
      slotNumber += 1
      return [Object.freeze({
        id: `strict-slot-${slotNumber}`,
        orderIndex: slotNumber - 1,
        kind: subquestion.questionType === "comparison" && subquestion.comparisonTargetTopicIds.length === 2
          ? "comparison_side" as const
          : "answer" as const,
        subquestionId: subquestion.id,
        question: facet ? `${subquestion.question} [required facet: ${facet}]` : subquestion.question,
        topicId: subquestion.topicId,
        focus: subquestion.focus,
        questionType: subquestion.questionType,
        requestedFacet: facet,
        comparisonTargetTopicIds: Object.freeze([...subquestion.comparisonTargetTopicIds]),
        lockedClaims: Object.freeze(lockedClaims),
        requiredClaimIds: Object.freeze(required.map((claim) => claim.id)),
        lockedClaimIds: Object.freeze(lockedClaims.map((entry) => entry.claim.id)),
        sourceIds: Object.freeze(unique(lockedClaims.flatMap((entry) => entry.claim.sourceIds))),
        relationContracts: Object.freeze(lockedClaims.flatMap((entry) => relationContractsFromClaim(entry.claim))),
        controlledText: null,
        topicThesisClaimIds: Object.freeze([...(topicSemanticFrame?.thesisClaimIds ?? [])]),
        claimSemantics: Object.freeze((topicSemanticFrame?.claims ?? [])
          .filter((entry) => lockedClaimIds.has(entry.claimId))),
      })]
    })
  })
  const unsupportedEntries = facetEvidenceMatrix.filter((entry) => entry.status === "UNSUPPORTED")
  const unsupportedFacets = unique(unsupportedEntries.map((entry) => entry.facet)) as DnaS13RequestedFacet[]
  const semantic = input.semanticOperation
  const alreadyShownClaimIds = new Set(semantic?.alreadyShownClaimIds ?? [])
  const alreadyAnsweredFacets = new Set(semantic?.alreadyAnsweredFacets ?? [])
  const alreadyShownRelationIds = new Set(semantic?.alreadyShownRelationIds ?? [])
  const newClaimIds = unique(answerSlots.flatMap((slot) => slot.lockedClaimIds)
    .filter((claimId) => !claimId.startsWith("system.") && !alreadyShownClaimIds.has(claimId)))
  const newAnsweredFacets = unique(facetEvidenceMatrix.filter((entry) =>
    (entry.status === "SUPPORTED_DIRECT" || entry.status === "SUPPORTED_DERIVED")
      && !alreadyAnsweredFacets.has(entry.facet)
      && answerSlots.some((slot) => slot.subquestionId === entry.subquestionId
        && slot.requestedFacet === entry.facet && slot.lockedClaimIds.length > 0)).map((entry) => entry.facet)) as DnaS13RequestedFacet[]
  const relationIdsBeforeLimitation = unique([
    ...answerSlots.flatMap((slot) => (slot.relationContracts ?? []).map((relation) => relation.id)),
  ])
  const newRelationIds = relationIdsBeforeLimitation.filter((relationId) => !alreadyShownRelationIds.has(relationId))
  const pragmaticAction = input.pragmaticTaskFrame?.pragmaticAction ?? null
  const simplifyPresentation = dnaS13HasPresentationModifier(input.pragmaticTaskFrame, "SIMPLIFY")
  const informationGainOperation = Boolean(semantic && !simplifyPresentation && (pragmaticAction
    ? ["DEEPEN", "WHY_SIGNIFICANCE", "EXAMPLE"].includes(pragmaticAction)
      || input.pragmaticTaskFrame?.discourseConstraints.includes("do_not_repeat")
    : ["expand_same_topic", "why_same_topic", "example_same_topic"].includes(semantic.operation)))
  const followupInformationGain = informationGainOperation
    ? newClaimIds.length > 0 || newAnsweredFacets.length > 0 || newRelationIds.length > 0
    : null
  const noGainText = pragmaticAction === "DEEPEN" || (!pragmaticAction && semantic?.operation === "expand_same_topic")
    ? "Bu başlık için önceki açıklamanın ötesinde ek bir ayrıntı bulunmuyor."
    : pragmaticAction === "WHY_SIGNIFICANCE" || (!pragmaticAction && semantic?.operation === "why_same_topic")
      ? "Bu başlığın neden önemli olduğuna dair önceki açıklamanın ötesinde ek bir gerekçe bulunmuyor."
      : pragmaticAction === "EXAMPLE" || (!pragmaticAction && semantic?.operation === "example_same_topic")
        ? "Bu başlık için aktarabileceğim somut bir örnek bulunmuyor."
        : input.pragmaticTaskFrame?.discourseConstraints.includes("do_not_repeat")
          ? "Bu başlık için önceki yanıtta yer almayan ek bir bilgi bulunmuyor."
        : null
  const limitationDrafts: DnaS13StrictSlot[] = input.frame.subquestions.flatMap((subquestion) => {
    const entries = unsupportedEntries.filter((entry) => entry.subquestionId === subquestion.id)
    const facets = unique(entries.map((entry) => entry.facet)) as DnaS13RequestedFacet[]
    const supportedForSubquestion = facetEvidenceMatrix.filter((entry) => entry.subquestionId === subquestion.id
      && (entry.status === "SUPPORTED_DIRECT" || entry.status === "SUPPORTED_DERIVED")).length
    const simplifyLimitation = simplifyPresentation && facets.length
      ? createDnaS13SimplifyEvidenceLimitation(
          input.pragmaticTaskFrame?.normalizedQuestion ?? subquestion.question,
          facets,
        )
      : null
    const limitationText = facets.length
      ? noGainText && followupInformationGain === false ? noGainText
        : simplifyLimitation ? simplifyLimitation
        : supportedForSubquestion > 0
          ? `${facets.map((facet) => FACET_LABELS[facet]).join(", ")} konusunda daha ileri bilgi bulunmuyor.`
          : `Bu başlık için ${facets.map((facet) => FACET_LABELS[facet]).join(", ")} konusunda yeterli açıklama bulunmuyor.`
      : informationGainOperation && followupInformationGain === false && noGainText
        ? noGainText
        : null
    if (!limitationText) return []
    return [Object.freeze({
      id: `evidence-limitation-${subquestion.id}`,
      orderIndex: 0,
      kind: subquestion.questionType === "comparison" && subquestion.comparisonTargetTopicIds.length === 2
        ? "comparison_side" as const : "evidence_limitation" as const,
      subquestionId: subquestion.id,
      question: subquestion.question,
      topicId: subquestion.topicId,
      focus: "interpretation_boundary" as const,
      questionType: subquestion.questionType,
      requestedFacet: null,
      comparisonTargetTopicIds: Object.freeze([...subquestion.comparisonTargetTopicIds]),
      lockedClaims: Object.freeze([]),
      requiredClaimIds: Object.freeze([]),
      lockedClaimIds: Object.freeze([]),
      sourceIds: Object.freeze([]),
      relationContracts: Object.freeze([]),
      controlledText: limitationText,
    })]
  })
  const comparisonSides = input.frame.subquestions.flatMap((subquestion) => [
    ...answerSlots.filter((slot) => slot.subquestionId === subquestion.id),
    ...limitationDrafts.filter((slot) => slot.subquestionId === subquestion.id),
  ]).filter((slot) => slot.kind === "comparison_side")
  const conclusion = createDnaS13ComparisonConclusionSlot(comparisonSides)
  const orderedDrafts = input.frame.subquestions.flatMap((subquestion) => [
    ...answerSlots.filter((slot) => slot.subquestionId === subquestion.id),
    ...limitationDrafts.filter((slot) => slot.subquestionId === subquestion.id),
  ])
  const slotDrafts = conclusion ? [...orderedDrafts, conclusion] : orderedDrafts
  const slots: DnaS13StrictSlot[] = slotDrafts.map((slot, index) => Object.freeze({
    ...slot,
    id: `strict-slot-${index + 1}`,
    orderIndex: index,
  }))
  const isLimitation = (slot: DnaS13StrictSlot) => slot.kind !== "comparison_conclusion"
    && Boolean(slot.controlledText) && slot.lockedClaimIds.length === 0
  const firstLimitationSlot = slots.find(isLimitation) ?? null
  const evidenceLimitations = Object.freeze(slots.filter(isLimitation)
    .map((slot) => Object.freeze({
      slotId: slot.id,
      subquestionId: slot.subquestionId,
      unsupportedFacets: Object.freeze(unique(unsupportedEntries
        .filter((entry) => entry.subquestionId === slot.subquestionId).map((entry) => entry.facet)) as DnaS13RequestedFacet[]),
      controlledText: slot.controlledText ?? "",
    })))
  const evidenceLimitation = firstLimitationSlot ? Object.freeze({
    slotId: firstLimitationSlot.id,
    unsupportedFacets: evidenceLimitations[0]?.unsupportedFacets ?? Object.freeze([]),
    controlledText: firstLimitationSlot.controlledText ?? "",
  }) : null
  const semanticOperationAudit: DnaS13SemanticOperationAudit | null = semantic ? Object.freeze({
    operation: semantic.operation,
    targets: Object.freeze([...semantic.targets]),
    alreadyShownClaimIds: Object.freeze([...semantic.alreadyShownClaimIds]),
    alreadyAnsweredFacets: Object.freeze([...semantic.alreadyAnsweredFacets]),
    newClaimIds: Object.freeze(newClaimIds),
    newAnsweredFacets: Object.freeze(newAnsweredFacets),
    newRelationIds: Object.freeze(newRelationIds),
    followupInformationGain,
    semanticRepeatWithoutNeedCount: !simplifyPresentation && informationGainOperation
      ? answerSlots.flatMap((slot) => slot.lockedClaimIds).filter((claimId) =>
          alreadyShownClaimIds.has(claimId) || (!newClaimIds.includes(claimId) && !claimId.startsWith("system."))).length
      : 0,
  }) : null
  const sufficiency = resolveDnaS13AnswerSufficiency({
    questionHash: input.questionHash ?? shortHash(input.frame.normalizedQuestion).repeat(8),
    action: pragmaticAction,
    facetEvidence: facetEvidenceMatrix,
    followupInformationGain,
  })
  return Object.freeze({
    version: DNA_S13_STRICT_PLAN_VERSION,
    responseDepth: input.frame.responseDepth,
    pragmaticTaskFrame: input.pragmaticTaskFrame ?? null,
    slots: Object.freeze(slots),
    lockedClaimIds: Object.freeze(unique(slots.flatMap((slot) => slot.lockedClaimIds))),
    sourceIds: Object.freeze(unique(slots.flatMap((slot) => slot.sourceIds))),
    relationContracts: Object.freeze(slots.flatMap((slot) => slot.relationContracts ?? [])),
    explanatoryDecisions: Object.freeze(explanatoryDecisions),
    comparisonConclusionMode: conclusion?.comparisonConclusionMode ?? null,
    comparisonConclusionSupportClaimIds: Object.freeze([...(conclusion?.comparisonConclusionSupportClaimIds ?? [])]),
    facetEvidenceMatrix,
    orderedSubquestionIds: Object.freeze(input.frame.subquestions.map((subquestion) => subquestion.id)),
    semanticOperationAudit,
    answerSufficiency: sufficiency.results,
    knowledgeGaps: sufficiency.knowledgeGaps,
    topicSemanticFrames: Object.freeze(Object.values(input.topicSemanticFramesBySubquestion ?? {})),
    topicConceptTypes: Object.freeze([...(input.topicConceptTypes ?? [])]),
    simplifyPayloadAudit: Object.freeze([...(input.simplifyPayloadAudit ?? [])]),
    evidenceLimitation,
    evidenceLimitations,
  })
}

export function deterministicDnaS13StrictAnswer(plan: DnaS13StrictPlan) {
  return plan.slots
    .map((slot) => slot.controlledText ?? slot.lockedClaims.map((entry) => entry.claim.text.trim()).filter(Boolean).join(" "))
    .filter(Boolean)
    .join("\n\n")
}

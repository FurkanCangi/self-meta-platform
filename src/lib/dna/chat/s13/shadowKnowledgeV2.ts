import type {
  DnaS13Claim,
  DnaS13QueryFrame,
  DnaS13RequestedFacet,
} from "./contracts"
import { normalizeDnaChatText } from "../text"
import { dnaS13HasPresentationModifier, type DnaS13PragmaticTaskFrame } from "./pragmaticTask"
import type {
  DnaS13AllowedDerivationType,
  DnaS13FacetEvidence,
  DnaS13StrictPlan,
} from "./strictContracts"
import { createDnaS13StrictPlan } from "./strictPlanner"
import { createDnaS13DeterministicRealization } from "./strictRealizer"
import type { Realizer } from "./strictRealizer"
import { runDnaS13StrictRuntime, type DnaS13StrictRuntimeResult } from "./strictRuntime"
import type { DnaS13ArtifactFingerprint, DnaS13PrivacyClassification } from "./strictProvenance"
import { validateDnaS13StrictGrounding } from "./strictValidator"
import { classifyDnaS13ConceptType, type DnaS13ConceptTypeClassification } from "./conceptType"

export const DNA_S13_KNOWLEDGE_V2_SHADOW_VERSION = "dna-s13-knowledge-v2-shadow@3" as const

export const DNA_KNOWLEDGE_V2_FACETS = Object.freeze([
  "CORE_SCOPE",
  "DEFINITION",
  "FUNCTION_SIGNIFICANCE",
  "BOUNDARY_LIMITATION",
  "EXPLANATORY_DETAIL",
  "EXAMPLE",
  "RELATION_COMPARISON",
] as const)

export type DnaKnowledgeV2Facet = typeof DNA_KNOWLEDGE_V2_FACETS[number]
export type DnaKnowledgeV2SupportStatus =
  | "SUPPORTED_DIRECT"
  | "SUPPORTED_DERIVED"
  | "UNSUPPORTED"

export type DnaKnowledgeV2CanonicalTopic = Readonly<{
  canonicalTopicId: string
  canonicalTitle: string
  aliases: readonly string[]
  oldTopicIds: readonly string[]
  applicableFacets: readonly DnaKnowledgeV2Facet[]
  atomIds: readonly string[]
}>

export type DnaKnowledgeV2Alias = Readonly<{
  oldTopicId: string
  canonicalTopicId: string
  backwardCompatible: boolean
}>

export type DnaKnowledgeV2Atom = Readonly<{
  atomId: string
  text: string
  canonicalTopicId: string
  canonicalTitle: string
  sourceId: string
  passageId: string
  /** Preserves source metadata such as CORRECTION; retrieval uses only V2 facets. */
  explicitFacet: string | null
  coverageFacet: string | null
  /** Additional directly-entailed facets for the same immutable atom text. */
  supportedFacets?: readonly DnaKnowledgeV2Facet[]
  claimRoleV2: string | null
  selfContained: boolean
  standaloneFinalAnswerEligible: boolean
  answerEligible: boolean
  dimensions: readonly string[]
  domain: string | null
  sourceSectionId: string | null
  authorityClass: string | null
  citationStatus: string | null
}>

export type DnaKnowledgeV2Bundle = Readonly<{
  bundleId: string
  canonicalTopicId: string
  leadAtomId: string
  supportAtomIds: readonly string[]
  orderedAtomIds: readonly string[]
  selfContainedAsBundle: boolean
  standaloneLeadForbidden: boolean
  finalAnswerEligible: boolean
}>

export type DnaKnowledgeV2Snapshot = Readonly<{
  canonicalTopics: readonly DnaKnowledgeV2CanonicalTopic[]
  aliases: readonly DnaKnowledgeV2Alias[]
  atoms: readonly DnaKnowledgeV2Atom[]
  bundles: readonly DnaKnowledgeV2Bundle[]
}>

export type DnaKnowledgeV2Retrieval = Readonly<{
  originalTopicId: string
  canonicalTopicId: string | null
  requestedFacet: DnaKnowledgeV2Facet
  status: DnaKnowledgeV2SupportStatus
  selectedAtomIds: readonly string[]
  selectedBundleIds: readonly string[]
  availableAtomIds: readonly string[]
  availableButNotSelected: boolean
  wrongTopic: boolean
  claims: readonly DnaS13Claim[]
}>

export type DnaKnowledgeV2SimplifyPayload = Readonly<{
  originalTopicId: string
  canonicalTopicId: string | null
  sourceFacet: DnaKnowledgeV2Facet | null
  selectedAtomIds: readonly string[]
  evaluatedAtomIds: readonly string[]
  claims: readonly DnaS13Claim[]
  mainMeaningEntailed: boolean
  selectionReason: string
}>

function nonempty(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
}

function isFacet(value: unknown): value is DnaKnowledgeV2Facet {
  return typeof value === "string" && DNA_KNOWLEDGE_V2_FACETS.includes(value as DnaKnowledgeV2Facet)
}

function assertSnapshot(snapshot: DnaKnowledgeV2Snapshot) {
  const canonicalIds = new Set(snapshot.canonicalTopics.map((topic) => topic.canonicalTopicId))
  const atomIds = new Set<string>()
  for (const topic of snapshot.canonicalTopics) {
    if (!nonempty(topic.canonicalTopicId) || !nonempty(topic.canonicalTitle)) throw new Error("knowledge_v2_invalid_canonical_topic")
    if (topic.applicableFacets.some((facet) => !isFacet(facet))) throw new Error("knowledge_v2_invalid_applicable_facet")
  }
  for (const alias of snapshot.aliases) {
    if (!nonempty(alias.oldTopicId) || !canonicalIds.has(alias.canonicalTopicId)) throw new Error("knowledge_v2_invalid_alias")
  }
  for (const atom of snapshot.atoms) {
    if (atomIds.has(atom.atomId) || !nonempty(atom.atomId) || !nonempty(atom.text)) throw new Error("knowledge_v2_invalid_atom")
    if (!canonicalIds.has(atom.canonicalTopicId) || !nonempty(atom.sourceId) || !nonempty(atom.passageId)) {
      throw new Error("knowledge_v2_unbound_atom")
    }
    if (atom.explicitFacet !== null && !nonempty(atom.explicitFacet)) throw new Error("knowledge_v2_invalid_atom_facet")
    if (atom.coverageFacet !== null && !nonempty(atom.coverageFacet)) throw new Error("knowledge_v2_invalid_coverage_facet")
    if ((atom.supportedFacets ?? []).some((facet) => !isFacet(facet))) {
      throw new Error("knowledge_v2_invalid_supported_facet")
    }
    atomIds.add(atom.atomId)
  }
  for (const bundle of snapshot.bundles) {
    if (!canonicalIds.has(bundle.canonicalTopicId) || !bundle.orderedAtomIds.length
      || bundle.orderedAtomIds.some((atomId) => !atomIds.has(atomId))) throw new Error("knowledge_v2_invalid_bundle")
  }
}

function claimFromAtom(atom: DnaKnowledgeV2Atom): DnaS13Claim {
  return Object.freeze({
    id: atom.atomId,
    text: atom.text,
    passageId: atom.passageId,
    sourceIds: Object.freeze([atom.sourceId]),
    topicId: atom.canonicalTopicId,
    focus: atom.explicitFacet ?? atom.coverageFacet ?? undefined,
    sectionId: atom.sourceSectionId ?? undefined,
    title: atom.canonicalTitle,
    domain: atom.domain ?? undefined,
    dimensions: Object.freeze([...atom.dimensions]),
    authorityClass: atom.authorityClass ?? undefined,
    citationStatus: atom.citationStatus ?? undefined,
    answerEligible: atom.answerEligible,
  })
}

export class DnaS13KnowledgeV2ShadowProvider {
  readonly version = DNA_S13_KNOWLEDGE_V2_SHADOW_VERSION
  private readonly canonicalById: ReadonlyMap<string, DnaKnowledgeV2CanonicalTopic>
  private readonly canonicalIdByOldId: ReadonlyMap<string, string>
  private readonly atomsByCanonicalId: ReadonlyMap<string, readonly DnaKnowledgeV2Atom[]>
  private readonly atomById: ReadonlyMap<string, DnaKnowledgeV2Atom>
  private readonly bundlesByCanonicalId: ReadonlyMap<string, readonly DnaKnowledgeV2Bundle[]>

  constructor(readonly snapshot: DnaKnowledgeV2Snapshot) {
    assertSnapshot(snapshot)
    this.canonicalById = new Map(snapshot.canonicalTopics.map((topic) => [topic.canonicalTopicId, topic]))
    this.canonicalIdByOldId = new Map(snapshot.aliases.filter((alias) => alias.backwardCompatible)
      .map((alias) => [alias.oldTopicId, alias.canonicalTopicId]))
    this.atomById = new Map(snapshot.atoms.map((atom) => [atom.atomId, atom]))
    const groupedAtoms = new Map<string, DnaKnowledgeV2Atom[]>()
    for (const atom of snapshot.atoms) groupedAtoms.set(atom.canonicalTopicId, [...(groupedAtoms.get(atom.canonicalTopicId) ?? []), atom])
    this.atomsByCanonicalId = new Map([...groupedAtoms].map(([id, atoms]) => [id, Object.freeze(atoms)]))
    const groupedBundles = new Map<string, DnaKnowledgeV2Bundle[]>()
    for (const bundle of snapshot.bundles) groupedBundles.set(bundle.canonicalTopicId, [...(groupedBundles.get(bundle.canonicalTopicId) ?? []), bundle])
    this.bundlesByCanonicalId = new Map([...groupedBundles].map(([id, bundles]) => [id, Object.freeze(bundles)]))
  }

  resolveCanonicalTopicId(topicId: string) {
    if (this.canonicalById.has(topicId)) return topicId
    return this.canonicalIdByOldId.get(topicId) ?? null
  }

  classifyConceptType(topicId: string): DnaS13ConceptTypeClassification | null {
    const canonicalTopicId = this.resolveCanonicalTopicId(topicId)
    const topic = canonicalTopicId ? this.canonicalById.get(canonicalTopicId) : null
    if (!canonicalTopicId || !topic) return null
    return classifyDnaS13ConceptType({
      topicId: canonicalTopicId,
      title: topic.canonicalTitle,
      atoms: this.atomsByCanonicalId.get(canonicalTopicId) ?? [],
    })
  }

  claimsByIds(topicId: string, claimIds: readonly string[]) {
    const canonicalTopicId = this.resolveCanonicalTopicId(topicId)
    if (!canonicalTopicId) return Object.freeze([])
    const requested = [...new Set(claimIds)]
    const claims = requested.flatMap((claimId) => {
      const atom = this.atomById.get(claimId)
      return atom && atom.canonicalTopicId === canonicalTopicId && atom.answerEligible
        && nonempty(atom.sourceId) && nonempty(atom.passageId) ? [claimFromAtom(atom)] : []
    })
    return Object.freeze(claims)
  }

  selectSimplifyPayload(topicId: string): DnaKnowledgeV2SimplifyPayload {
    const canonicalTopicId = this.resolveCanonicalTopicId(topicId)
    const topic = canonicalTopicId ? this.canonicalById.get(canonicalTopicId) : null
    if (!canonicalTopicId || !topic) return Object.freeze({
      originalTopicId: topicId, canonicalTopicId: null, sourceFacet: null,
      selectedAtomIds: Object.freeze([]), evaluatedAtomIds: Object.freeze([]), claims: Object.freeze([]),
      mainMeaningEntailed: false, selectionReason: "topic_unresolved",
    })
    const titleTokens = normalizeDnaChatText(topic.canonicalTitle).split(/\s+/u)
      .filter((token) => token.length >= 5 && !["nedir", "temel", "boyutlari", "olarak", "acisindan"].includes(token))
    const eligible = (this.atomsByCanonicalId.get(canonicalTopicId) ?? []).filter((atom) => atom.answerEligible
      && atom.selfContained && atom.standaloneFinalAnswerEligible && nonempty(atom.sourceId) && nonempty(atom.passageId))
    const ranked = eligible.flatMap((atom) => {
      const facet = (atom.explicitFacet ?? atom.coverageFacet) as DnaKnowledgeV2Facet | null
      const normalized = normalizeDnaChatText(atom.text)
      const overlap = titleTokens.filter((token) => normalized.includes(token)).length
      const titleAnchored = titleTokens.length === 0 || overlap > 0
      const definitionPredicate = /\b(?:ifade eder|anlamina gelir|olarak tanimlan\w*|kavramdir|yapidir|sistemdir|surectir|bolgesidir|kaydedilmesidir)\b/u.test(normalized)
      let priority = 0
      let reason = ""
      if (facet === "DEFINITION" && titleAnchored && (atom.claimRoleV2 === "TOPIC_THESIS" || definitionPredicate)) {
        priority = 400; reason = "validated_definition"
      } else if (facet === "CORE_SCOPE" && atom.claimRoleV2 === "TOPIC_THESIS" && titleAnchored) {
        priority = 300; reason = "validated_core_scope_thesis"
      } else if (atom.claimRoleV2 === "TOPIC_THESIS" && titleAnchored
        && !["BOUNDARY_LIMITATION", "EXAMPLE"].includes(facet ?? "")) {
        priority = 200; reason = "validated_topic_thesis"
      } else if (["FUNCTION_SIGNIFICANCE", "EXPLANATORY_DETAIL"].includes(facet ?? "")
        && atom.claimRoleV2 === "TOPIC_THESIS" && titleAnchored) {
        priority = 100; reason = "validated_main_function"
      }
      return priority ? [{ atom, facet, priority: priority + overlap, reason }] : []
    }).sort((left, right) => right.priority - left.priority || left.atom.atomId.localeCompare(right.atom.atomId))
    const selected = ranked[0] ?? null
    return Object.freeze({
      originalTopicId: topicId,
      canonicalTopicId,
      sourceFacet: selected?.facet ?? null,
      selectedAtomIds: Object.freeze(selected ? [selected.atom.atomId] : []),
      evaluatedAtomIds: Object.freeze(eligible.map((atom) => atom.atomId)),
      claims: Object.freeze(selected ? [claimFromAtom(selected.atom)] : []),
      mainMeaningEntailed: Boolean(selected),
      selectionReason: selected?.reason ?? "no_verified_main_meaning_payload",
    })
  }

  retrieve(topicId: string, requestedFacet: DnaKnowledgeV2Facet): DnaKnowledgeV2Retrieval {
    const canonicalTopicId = this.resolveCanonicalTopicId(topicId)
    if (!canonicalTopicId) return Object.freeze({
      originalTopicId: topicId,
      canonicalTopicId: null,
      requestedFacet,
      status: "UNSUPPORTED" as const,
      selectedAtomIds: Object.freeze([]),
      selectedBundleIds: Object.freeze([]),
      availableAtomIds: Object.freeze([]),
      availableButNotSelected: false,
      wrongTopic: false,
      claims: Object.freeze([]),
    })

    const topicAtoms = this.atomsByCanonicalId.get(canonicalTopicId) ?? []
    const facetAtoms = topicAtoms.filter((atom) => atom.explicitFacet === requestedFacet
      || atom.coverageFacet === requestedFacet
      || atom.supportedFacets?.includes(requestedFacet))
    const available = facetAtoms.filter((atom) => atom.answerEligible && nonempty(atom.sourceId) && nonempty(atom.passageId))
    const direct = available.filter((atom) => atom.selfContained && atom.standaloneFinalAnswerEligible)
      .sort((left, right) => Number(right.explicitFacet === requestedFacet) - Number(left.explicitFacet === requestedFacet)
        || Number(right.claimRoleV2 === "TOPIC_THESIS") - Number(left.claimRoleV2 === "TOPIC_THESIS")
        || left.atomId.localeCompare(right.atomId))[0] ?? null
    if (direct) return Object.freeze({
      originalTopicId: topicId,
      canonicalTopicId,
      requestedFacet,
      status: "SUPPORTED_DIRECT" as const,
      selectedAtomIds: Object.freeze([direct.atomId]),
      selectedBundleIds: Object.freeze([]),
      availableAtomIds: Object.freeze(available.map((atom) => atom.atomId)),
      availableButNotSelected: false,
      wrongTopic: direct.canonicalTopicId !== canonicalTopicId,
      claims: Object.freeze([claimFromAtom(direct)]),
    })

    const bundle = (this.bundlesByCanonicalId.get(canonicalTopicId) ?? []).find((candidate) => {
      if (!candidate.selfContainedAsBundle || !candidate.finalAnswerEligible) return false
      const atoms = candidate.orderedAtomIds.map((atomId) => this.atomById.get(atomId)).filter(Boolean) as DnaKnowledgeV2Atom[]
      return atoms.length === candidate.orderedAtomIds.length && atoms.some((atom) =>
        atom.explicitFacet === requestedFacet || atom.coverageFacet === requestedFacet)
        && atoms.every((atom) => atom.canonicalTopicId === canonicalTopicId)
        // Bundle eligibility is the contract for a non-standalone lead. Every
        // member still needs real provenance, but the lead is intentionally
        // not independently answer-eligible.
        && atoms.every((atom) => nonempty(atom.sourceId) && nonempty(atom.passageId))
    }) ?? null
    if (bundle) {
      const selected = bundle.orderedAtomIds.map((atomId) => this.atomById.get(atomId)!).filter(Boolean)
      return Object.freeze({
        originalTopicId: topicId,
        canonicalTopicId,
        requestedFacet,
        status: "SUPPORTED_DERIVED" as const,
        selectedAtomIds: Object.freeze(selected.map((atom) => atom.atomId)),
        selectedBundleIds: Object.freeze([bundle.bundleId]),
        availableAtomIds: Object.freeze(available.map((atom) => atom.atomId)),
        availableButNotSelected: false,
        wrongTopic: selected.some((atom) => atom.canonicalTopicId !== canonicalTopicId),
        claims: Object.freeze(selected.map(claimFromAtom)),
      })
    }

    return Object.freeze({
      originalTopicId: topicId,
      canonicalTopicId,
      requestedFacet,
      status: "UNSUPPORTED" as const,
      selectedAtomIds: Object.freeze([]),
      selectedBundleIds: Object.freeze([]),
      availableAtomIds: Object.freeze(available.map((atom) => atom.atomId)),
      availableButNotSelected: available.length > 0,
      wrongTopic: false,
      claims: Object.freeze([]),
    })
  }
}

export const DNA_KNOWLEDGE_V2_TO_S13_FACET: Readonly<Record<DnaKnowledgeV2Facet, DnaS13RequestedFacet>> = Object.freeze({
  CORE_SCOPE: "core_scope",
  DEFINITION: "definition",
  FUNCTION_SIGNIFICANCE: "function",
  BOUNDARY_LIMITATION: "boundary",
  EXPLANATORY_DETAIL: "components",
  EXAMPLE: "verified_example",
  RELATION_COMPARISON: "distinction",
})

export const DNA_S13_TO_KNOWLEDGE_V2_FACET: Readonly<Record<DnaS13RequestedFacet, DnaKnowledgeV2Facet>> = Object.freeze({
  definition: "DEFINITION",
  function: "FUNCTION_SIGNIFICANCE",
  boundary: "BOUNDARY_LIMITATION",
  supported_meaning: "CORE_SCOPE",
  limitation: "BOUNDARY_LIMITATION",
  components: "EXPLANATORY_DETAIL",
  core_scope: "CORE_SCOPE",
  explanatory_detail: "EXPLANATORY_DETAIL",
  distinction: "RELATION_COMPARISON",
  verified_example: "EXAMPLE",
})

export type DnaKnowledgeV2ShadowRun = Readonly<{
  version: typeof DNA_S13_KNOWLEDGE_V2_SHADOW_VERSION
  publicPlan: DnaS13StrictPlan | null
  publicPlanReferencePreserved: boolean
  shadow: Readonly<{
    displayEligible: false
    productionEligible: false
    plan: DnaS13StrictPlan
    answer: string
    retrievals: readonly DnaKnowledgeV2Retrieval[]
    validation: ReturnType<typeof validateDnaS13StrictGrounding>
  }>
}>

function evidenceFromRetrieval(
  subquestionId: string,
  requestedFacet: DnaS13RequestedFacet,
  retrieval: DnaKnowledgeV2Retrieval,
  headingScopeForDefinition = false,
): DnaS13FacetEvidence {
  const facet = requestedFacet
  const derived = retrieval.status === "SUPPORTED_DERIVED"
    || (headingScopeForDefinition && retrieval.status !== "UNSUPPORTED")
  const derivation: DnaS13AllowedDerivationType | null = derived
    ? headingScopeForDefinition ? "heading_scope_for_definition" : "verified_lead_in_plus_adjacent_enumeration"
    : null
  return Object.freeze({
    subquestionId,
    topicId: retrieval.canonicalTopicId ?? retrieval.originalTopicId,
    facet,
    status: retrieval.status === "UNSUPPORTED" ? "UNSUPPORTED" : derived ? "SUPPORTED_DERIVED" : "SUPPORTED_DIRECT",
    supportClaimIds: Object.freeze(retrieval.claims.map((claim) => claim.id)),
    supportRelationIds: Object.freeze([]),
    entailment: retrieval.status === "UNSUPPORTED" ? "DOES_NOT_ENTAIL" : "ENTAILS",
    allowedDerivationType: derivation,
    derivedFacet: derived ? facet : null,
    evaluatedClaimIds: Object.freeze(retrieval.availableAtomIds),
    availableEntailingClaimIds: Object.freeze(retrieval.availableAtomIds),
    partialClaimIds: Object.freeze([]),
    confidence: retrieval.status === "SUPPORTED_DIRECT" ? 0.95 : derived ? 0.85 : 0,
  })
}

/**
 * Runs only after the frozen S13 interpretation step. The returned public plan
 * is the exact input reference; shadow output is explicitly non-displayable.
 */
export function runDnaS13KnowledgeV2Shadow(input: Readonly<{
  frame: DnaS13QueryFrame
  pragmaticTaskFrame?: DnaS13PragmaticTaskFrame | null
  provider: DnaS13KnowledgeV2ShadowProvider
  publicPlan?: DnaS13StrictPlan | null
  simplifyContext?: Readonly<{
    previousSlots: readonly Readonly<{
      topicId: string
      requestedFacet: DnaS13RequestedFacet | null
      claimIds: readonly string[]
    }>[]
  }> | null
}>): DnaKnowledgeV2ShadowRun {
  const retrievals: DnaKnowledgeV2Retrieval[] = []
  const requiredClaimsBySubquestion: Record<string, readonly DnaS13Claim[]> = {}
  const requiredClaimsByFacetBySubquestion: Record<string, Partial<Record<DnaS13RequestedFacet, readonly DnaS13Claim[]>>> = {}
  const facetEvidenceBySubquestion: Record<string, readonly DnaS13FacetEvidence[]> = {}
  const topicConceptTypes: DnaS13ConceptTypeClassification[] = []
  const simplifyPayloadAudit: NonNullable<DnaS13StrictPlan["simplifyPayloadAudit"]>[number][] = []
  const simplifyPresentation = dnaS13HasPresentationModifier(input.pragmaticTaskFrame, "SIMPLIFY")

  const shadowSubquestions = input.frame.subquestions.map((subquestion) => {
    const canonicalTopicId = input.provider.resolveCanonicalTopicId(subquestion.topicId) ?? subquestion.topicId
    const conceptType = input.provider.classifyConceptType(subquestion.topicId)
    if (conceptType && !topicConceptTypes.some((entry) => entry.topicId === conceptType.topicId)) topicConceptTypes.push(conceptType)
    const contextualSlots = simplifyPresentation
      ? (input.simplifyContext?.previousSlots ?? []).filter((slot) =>
          (input.provider.resolveCanonicalTopicId(slot.topicId) ?? slot.topicId) === canonicalTopicId)
      : []
    const contextualFacets = [...new Set(contextualSlots.flatMap((slot) => slot.requestedFacet ? [slot.requestedFacet] : []))]
    const requestedFacets = contextualFacets.length ? contextualFacets : subquestion.requestedFacets ?? []
    const headingScopeFlags = requestedFacets.map((facet) => facet === "definition"
      && conceptType !== null && conceptType.conceptType !== "CANONICAL_CONCEPT")
    const rows = requestedFacets.map((facet, index) => {
      if (contextualSlots.length) {
        const matching = contextualSlots.filter((slot) => slot.requestedFacet === facet)
        const source = matching.length ? matching : contextualSlots.length === 1 ? contextualSlots : []
        const claims = input.provider.claimsByIds(subquestion.topicId, source.flatMap((slot) => slot.claimIds))
        return Object.freeze({
          originalTopicId: subquestion.topicId,
          canonicalTopicId,
          requestedFacet: DNA_S13_TO_KNOWLEDGE_V2_FACET[facet],
          status: claims.length ? "SUPPORTED_DIRECT" as const : "UNSUPPORTED" as const,
          selectedAtomIds: Object.freeze(claims.map((claim) => claim.id)),
          selectedBundleIds: Object.freeze([]),
          availableAtomIds: Object.freeze(claims.map((claim) => claim.id)),
          availableButNotSelected: false,
          wrongTopic: false,
          claims,
        })
      }
      return input.provider.retrieve(subquestion.topicId,
        headingScopeFlags[index] ? "CORE_SCOPE" : DNA_S13_TO_KNOWLEDGE_V2_FACET[facet])
    })
    retrievals.push(...rows)
    requiredClaimsBySubquestion[subquestion.id] = Object.freeze(rows.flatMap((row) => row.claims))
    requiredClaimsByFacetBySubquestion[subquestion.id] = Object.freeze(Object.fromEntries(rows.map((row, index) => [
      requestedFacets[index]!,
      row.claims,
    ])))
    facetEvidenceBySubquestion[subquestion.id] = Object.freeze(rows.map((row, index) => {
      const evidence = evidenceFromRetrieval(subquestion.id, requestedFacets[index]!, row, headingScopeFlags[index])
      return evidence
    }))
    if (simplifyPresentation) {
      const supportClaimIds = [...new Set(rows.flatMap((row) => row.claims.map((claim) => claim.id)))]
      const previousClaimIds = [...new Set(contextualSlots.flatMap((slot) => slot.claimIds))]
      const previousFacets = [...new Set(contextualSlots.flatMap((slot) => slot.requestedFacet ? [slot.requestedFacet] : []))]
      const sameSet = (left: readonly string[], right: readonly string[]) => left.length === right.length
        && left.every((value) => right.includes(value))
      simplifyPayloadAudit.push(Object.freeze({
        subquestionId: subquestion.id,
        topicId: canonicalTopicId,
        mode: contextualSlots.length ? "CONTEXTUAL_SIMPLIFY" as const : "EXPLICIT_TOPIC_SIMPLIFY" as const,
        sourceFacet: requestedFacets.join(",") || null,
        supportClaimIds: Object.freeze(supportClaimIds),
        previousClaimIds: Object.freeze(previousClaimIds),
        previousFacets: Object.freeze(previousFacets),
        mainMeaningEntailed: contextualSlots.length ? null
          : rows.length > 0 && rows.every((row) => row.status !== "UNSUPPORTED" && !row.wrongTopic),
        contextualClaimSetPreserved: contextualSlots.length ? sameSet(supportClaimIds, previousClaimIds) : null,
        contextualFacetSetPreserved: contextualSlots.length ? sameSet(requestedFacets, previousFacets) : null,
        selectionReason: contextualSlots.length ? "previous_final_answer_locked_claims"
          : "base_action_standard_retrieval",
      }))
    }
    return Object.freeze({
      ...subquestion,
      topicId: canonicalTopicId,
      requestedFacets: Object.freeze(requestedFacets),
      comparisonTargetTopicIds: Object.freeze(subquestion.comparisonTargetTopicIds.map((topicId) =>
        input.provider.resolveCanonicalTopicId(topicId) ?? topicId)),
    })
  })

  const shadowFrame: DnaS13QueryFrame = Object.freeze({
    ...input.frame,
    subquestions: Object.freeze(shadowSubquestions),
  })
  const plan = createDnaS13StrictPlan({
    frame: shadowFrame,
    pragmaticTaskFrame: input.pragmaticTaskFrame ?? null,
    requiredClaimsBySubquestion,
    requiredClaimsByFacetBySubquestion,
    facetEvidenceBySubquestion,
    topicConceptTypes: Object.freeze(topicConceptTypes),
    simplifyPayloadAudit: Object.freeze(simplifyPayloadAudit),
    semanticOperation: input.publicPlan?.semanticOperationAudit ? Object.freeze({
      operation: input.publicPlan.semanticOperationAudit.operation,
      targets: Object.freeze(input.publicPlan.semanticOperationAudit.targets.map((target) => Object.freeze({
        ...target,
        topicId: input.provider.resolveCanonicalTopicId(target.topicId) ?? target.topicId,
      }))),
      alreadyShownClaimIds: Object.freeze([...input.publicPlan.semanticOperationAudit.alreadyShownClaimIds]),
      alreadyAnsweredFacets: Object.freeze([...input.publicPlan.semanticOperationAudit.alreadyAnsweredFacets]),
      alreadyShownRelationIds: Object.freeze([]),
    }) : undefined,
  })
  const realization = createDnaS13DeterministicRealization(plan)
  const validation = validateDnaS13StrictGrounding({
    plan,
    realization,
  })
  const publicPlan = input.publicPlan ?? null
  return Object.freeze({
    version: DNA_S13_KNOWLEDGE_V2_SHADOW_VERSION,
    publicPlan,
    publicPlanReferencePreserved: publicPlan === (input.publicPlan ?? null),
    shadow: Object.freeze({
      displayEligible: false as const,
      productionEligible: false as const,
      plan,
      answer: realization.slotRealizations.map((slot) => slot.text.trim()).filter(Boolean).join("\n\n"),
      retrievals: Object.freeze(retrievals),
      validation,
    }),
  })
}

export type DnaKnowledgeV2RealizedShadowRun = Readonly<{
  version: typeof DNA_S13_KNOWLEDGE_V2_SHADOW_VERSION
  publicPlan: DnaS13StrictPlan | null
  publicPlanReferencePreserved: boolean
  shadow: Readonly<{
    displayEligible: false
    productionEligible: false
    retrievals: readonly DnaKnowledgeV2Retrieval[]
    result: DnaS13StrictRuntimeResult
  }>
}>

/**
 * Provider-neutral realized shadow path. Passing LunaRealizer produces the V2
 * plan -> existing Luna -> existing validators flow without importing Luna
 * into this knowledge provider or exposing the shadow answer.
 */
export async function runDnaS13KnowledgeV2RealizedShadow(input: Readonly<{
  question: string
  frame: DnaS13QueryFrame
  pragmaticTaskFrame?: DnaS13PragmaticTaskFrame | null
  provider: DnaS13KnowledgeV2ShadowProvider
  realizer: Realizer
  catalog: DnaS13ArtifactFingerprint
  retrieval: DnaS13ArtifactFingerprint
  privacy: DnaS13PrivacyClassification
  publicPlan?: DnaS13StrictPlan | null
}>): Promise<DnaKnowledgeV2RealizedShadowRun> {
  const prepared = runDnaS13KnowledgeV2Shadow({
    frame: input.frame,
    pragmaticTaskFrame: input.pragmaticTaskFrame,
    provider: input.provider,
    publicPlan: input.publicPlan,
  })
  const result = await runDnaS13StrictRuntime({
    question: input.question,
    normalizedQuestion: input.frame.normalizedQuestion,
    queryFrame: input.frame,
    plan: prepared.shadow.plan,
    realizer: input.realizer,
    catalog: input.catalog,
    retrieval: input.retrieval,
    privacy: input.privacy,
    trainingCandidateRequested: false,
  })
  return Object.freeze({
    version: DNA_S13_KNOWLEDGE_V2_SHADOW_VERSION,
    publicPlan: prepared.publicPlan,
    publicPlanReferencePreserved: prepared.publicPlanReferencePreserved,
    shadow: Object.freeze({
      displayEligible: false as const,
      productionEligible: false as const,
      retrievals: prepared.shadow.retrievals,
      result,
    }),
  })
}

import assert from "node:assert/strict"

import {
  DNA_S13_ADAPTIVE_REALIZATION_POLICY_VERSION,
  resolveDnaS13RealizationDecision,
} from "../src/lib/dna/chat/s13/adaptiveRealization"
import {
  DNA_CHAT_COST_EFFICIENT_MODE_VERSION,
  DNA_CHAT_DEVELOPMENT_DEFAULT_TIER,
  assertDnaChatDevelopmentProviderPolicy,
} from "../src/lib/dna/chat/s13/costEfficientMode"
import { DNA_S13_QUERY_FRAME_VERSION, type DnaS13QueryFrame, type DnaS13RequestedFacet } from "../src/lib/dna/chat/s13/contracts"
import {
  DNA_S13_PRAGMATIC_TASK_FRAME_VERSION,
  type DnaS13PragmaticAction,
} from "../src/lib/dna/chat/s13/pragmaticTask"
import {
  DNA_S13_STRICT_PLAN_VERSION,
  type DnaS13FacetEvidenceStatus,
  type DnaS13StrictPlan,
} from "../src/lib/dna/chat/s13/strictContracts"
import {
  DNA_S13_DETERMINISTIC_REALIZER_VERSION,
  createDnaS13DeterministicRealization,
} from "../src/lib/dna/chat/s13/strictRealizer"

function fixture(input: Readonly<{
  action: DnaS13PragmaticAction
  responseDepth?: "short" | "standard" | "deep"
  facets?: readonly DnaS13RequestedFacet[]
  evidenceStatus?: DnaS13FacetEvidenceStatus
  slotCount?: number
  claimCount?: number
  subquestionCount?: number
  relationCount?: number
  multiTurn?: boolean
  routingConfidence?: "HIGH" | "MEDIUM" | "LOW"
  simplifyPresentation?: boolean
}>) {
  const responseDepth = input.responseDepth ?? "short"
  const facets = input.facets ?? ["definition"]
  const subquestionCount = input.subquestionCount ?? 1
  const claimCount = input.claimCount ?? 1
  const frame: DnaS13QueryFrame = Object.freeze({
    version: DNA_S13_QUERY_FRAME_VERSION,
    normalizedQuestion: "structural fixture",
    responseDepth,
    uncertain: false,
    subquestions: Object.freeze(Array.from({ length: subquestionCount }, (_, index) => Object.freeze({
      id: `q${index + 1}`,
      question: "structural fixture",
      intent: "scientific_question" as const,
      topicId: `topic-${index + 1}`,
      focus: "definition" as const,
      questionType: input.action === "COMPARE" ? "comparison" as const : "definition" as const,
      followUp: Boolean(input.multiTurn),
      correction: false,
      comparisonTargetTopicIds: Object.freeze(input.action === "COMPARE" ? ["topic-1", "topic-2"] : []),
      answerabilityHint: "supported" as const,
      requestedFacets: Object.freeze([...facets]),
    }))),
  })
  const lockedClaims = Array.from({ length: claimCount }, (_, index) => Object.freeze({
    claim: Object.freeze({
      id: `claim-${index + 1}`,
      text: index === 0 ? "İlk doğrulanmış cümle." : "İkinci doğrulanmış cümle.",
      passageId: `passage-${index + 1}`,
      sourceIds: Object.freeze(["source-1"]),
      topicId: "topic-1",
      answerEligible: true,
    }),
    role: "required" as const,
  }))
  const slotCount = input.slotCount ?? 1
  const relationContracts = Array.from({ length: input.relationCount ?? 0 }, (_, index) => Object.freeze({
    id: `relation-${index + 1}`,
    version: "dna-s13-strict-relations@1" as const,
    type: "explanation" as const,
    support: "claim_text" as const,
    sourceClaimIds: Object.freeze(["claim-1"]),
    targetClaimIds: Object.freeze(["claim-1"]),
    surfaceMarkers: Object.freeze([]),
    controlledText: null,
  }))
  const plan: DnaS13StrictPlan = Object.freeze({
    version: DNA_S13_STRICT_PLAN_VERSION,
    responseDepth,
    pragmaticTaskFrame: Object.freeze({
      version: DNA_S13_PRAGMATIC_TASK_FRAME_VERSION,
      normalizedQuestion: "structural fixture",
      targetResolution: "EXPLICIT_TARGET" as const,
      targets: Object.freeze([]),
      pragmaticAction: input.action,
      baseAction: input.action === "SIMPLIFY" ? "EXPLAIN" : input.action,
      presentationModifiers: Object.freeze(input.simplifyPresentation || input.action === "SIMPLIFY"
        ? ["SIMPLIFY" as const] : []),
      requestedFacets: Object.freeze([...facets]),
      discourseConstraints: Object.freeze([]),
      actionConfidence: "HIGH" as const,
      facetConfidence: "HIGH" as const,
    }),
    slots: Object.freeze(Array.from({ length: slotCount }, (_, index) => Object.freeze({
      id: `slot-${index + 1}`,
      kind: input.action === "COMPARE" ? "comparison_side" as const : "answer" as const,
      subquestionId: `q${Math.min(index + 1, subquestionCount)}`,
      question: "structural fixture",
      topicId: `topic-${Math.min(index + 1, subquestionCount)}`,
      focus: "definition" as const,
      questionType: input.action === "COMPARE" ? "comparison" as const : "definition" as const,
      requestedFacet: facets[0] ?? null,
      comparisonTargetTopicIds: Object.freeze(input.action === "COMPARE" ? ["topic-1", "topic-2"] : []),
      lockedClaims: Object.freeze(lockedClaims),
      requiredClaimIds: Object.freeze(lockedClaims.map((row) => row.claim.id)),
      lockedClaimIds: Object.freeze(lockedClaims.map((row) => row.claim.id)),
      sourceIds: Object.freeze(["source-1"]),
      relationContracts: Object.freeze(relationContracts),
    }))),
    lockedClaimIds: Object.freeze(lockedClaims.map((row) => row.claim.id)),
    sourceIds: Object.freeze(["source-1"]),
    relationContracts: Object.freeze(relationContracts),
    facetEvidenceMatrix: Object.freeze(facets.map((facet) => Object.freeze({
      subquestionId: "q1",
      topicId: "topic-1",
      facet,
      status: input.evidenceStatus ?? "SUPPORTED_DIRECT",
      supportClaimIds: Object.freeze((input.evidenceStatus ?? "SUPPORTED_DIRECT") === "UNSUPPORTED" ? [] : ["claim-1"]),
      supportRelationIds: Object.freeze([]),
      entailment: (input.evidenceStatus ?? "SUPPORTED_DIRECT") === "UNSUPPORTED" ? "DOES_NOT_ENTAIL" as const : "ENTAILS" as const,
      allowedDerivationType: null,
      derivedFacet: null,
      evaluatedClaimIds: Object.freeze(["claim-1"]),
      confidence: 0.95,
    }))),
    answerSufficiency: Object.freeze([{ subquestionId: "q1", topicId: "topic-1",
      status: (input.evidenceStatus ?? "SUPPORTED_DIRECT") === "UNSUPPORTED"
        ? "INSUFFICIENT_WITH_AVAILABLE_EVIDENCE" as const : "SUFFICIENT" as const,
      supportedFacets: Object.freeze((input.evidenceStatus ?? "SUPPORTED_DIRECT") === "UNSUPPORTED" ? [] : [...facets]),
      unsupportedFacets: Object.freeze((input.evidenceStatus ?? "SUPPORTED_DIRECT") === "UNSUPPORTED" ? [...facets] : []),
      evidenceAvailability: (input.evidenceStatus ?? "SUPPORTED_DIRECT") === "UNSUPPORTED" ? "CATALOG_GAP" as const : null,
      selectedClaimIds: Object.freeze((input.evidenceStatus ?? "SUPPORTED_DIRECT") === "UNSUPPORTED" ? [] : ["claim-1"]),
      availableClaimIds: Object.freeze([]), missingEvidenceTypes: Object.freeze([]) }]),
  })
  return resolveDnaS13RealizationDecision({
    frame,
    plan,
    action: input.action,
    multiTurn: Boolean(input.multiTurn),
    routingConfidence: input.routingConfidence ?? "HIGH",
  })
}

assert.equal(fixture({ action: "DEFINE" }).useLuna, false)
assert.equal(fixture({ action: "WHY_SIGNIFICANCE", facets: ["function"] }).useLuna, false)
assert.equal(fixture({ action: "SIMPLIFY", facets: ["core_scope"] }).useLuna, false)
assert.equal(fixture({ action: "SIMPLIFY", facets: ["core_scope"] }).reason,
  "supported_simplify_deterministic_first")
assert.equal(fixture({ action: "EXPLAIN", facets: ["core_scope"], simplifyPresentation: true }).reason,
  "supported_simplify_deterministic_first")
assert.equal(fixture({ action: "SIMPLIFY", facets: ["core_scope"], evidenceStatus: "UNSUPPORTED" }).reason,
  "catalog_limited_safe_response")
assert.equal(fixture({ action: "EXPLAIN", facets: ["core_scope"], evidenceStatus: "UNSUPPORTED" }).reason,
  "catalog_limited_safe_response")
assert.equal(fixture({ action: "DEEPEN", facets: ["explanatory_detail"], responseDepth: "deep" }).useLuna, true)
assert.equal(fixture({ action: "COMPARE", facets: ["distinction"], slotCount: 2, subquestionCount: 2 }).useLuna, true)
assert.equal(fixture({ action: "EXPLAIN", subquestionCount: 2 }).reason, "two_subquestion_synthesis")
assert.equal(fixture({ action: "EXAMPLE", facets: ["verified_example"], multiTurn: true }).reason,
  "complex_multiturn_synthesis")
assert.equal(fixture({ action: "EXPLAIN", slotCount: 2 }).reason, "multi_slot_synthesis")
assert.equal(fixture({ action: "EXPLAIN", relationCount: 2 }).reason, "multiple_relation_synthesis")
assert.equal(fixture({ action: "DEEPEN", routingConfidence: "LOW" }).reason,
  "routing_confidence_not_provider_correctable")

const deterministicPlan = {
  version: DNA_S13_STRICT_PLAN_VERSION,
  responseDepth: "short",
  slots: [{ id: "slot-1", subquestionId: "q1", question: "q", topicId: "topic", focus: "definition",
    questionType: "definition", comparisonTargetTopicIds: [], lockedClaims: [
      { claim: { id: "c1", text: "Doğrulanmış ilk cümle.", passageId: "p1", sourceIds: ["s1"], topicId: "topic" }, role: "required" },
      { claim: { id: "c2", text: "Doğrulanmış ikinci cümle.", passageId: "p2", sourceIds: ["s1"], topicId: "topic" }, role: "required" },
    ], requiredClaimIds: ["c1", "c2"], lockedClaimIds: ["c1", "c2"], sourceIds: ["s1"] }],
  lockedClaimIds: ["c1", "c2"], sourceIds: ["s1"],
} as DnaS13StrictPlan
const deterministic = createDnaS13DeterministicRealization(deterministicPlan)
assert.equal(deterministic.slotRealizations[0]?.text,
  "Doğrulanmış ilk cümle. Doğrulanmış ikinci cümle.")
assert.ok(!/^(?:Temelde|Ayrıca),/u.test(deterministic.slotRealizations[0]?.text ?? ""))

assert.equal(DNA_CHAT_DEVELOPMENT_DEFAULT_TIER, "TIER_A")
assert.throws(() => assertDnaChatDevelopmentProviderPolicy({
  tier: "TIER_A", requestedProviderCalls: 1, hardCapMicrousd: 0,
}), /tier_a_provider_call_prohibited/u)
assert.equal(assertDnaChatDevelopmentProviderPolicy({
  tier: "TIER_B", requestedProviderCalls: 10, hardCapMicrousd: 100_000,
}).accepted, true)
assert.throws(() => assertDnaChatDevelopmentProviderPolicy({
  tier: "TIER_B", requestedProviderCalls: 10, hardCapMicrousd: 100_001,
}), /hard_cap_exceeded/u)
assert.throws(() => assertDnaChatDevelopmentProviderPolicy({
  tier: "TIER_C", requestedProviderCalls: 1, hardCapMicrousd: 350_000,
}), /requires_release_checkpoint/u)

console.log(JSON.stringify({
  ok: true,
  adaptivePolicyVersion: DNA_S13_ADAPTIVE_REALIZATION_POLICY_VERSION,
  deterministicRealizerVersion: DNA_S13_DETERMINISTIC_REALIZER_VERSION,
  costPolicyVersion: DNA_CHAT_COST_EFFICIENT_MODE_VERSION,
  assertions: 23,
}))

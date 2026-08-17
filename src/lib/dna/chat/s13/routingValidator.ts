import type { DnaS13QueryFrame, DnaS13RequestedFacet } from "./contracts"
import type { DnaS13ResolvedUserQuery } from "./conversationContext"
import {
  dnaS13HasPresentationModifier,
  type DnaS13PragmaticAction,
  type DnaS13PragmaticTaskFrame,
} from "./pragmaticTask"
import type { DnaS13StrictPlan } from "./strictContracts"

export const DNA_S13_ROUTING_VALIDATOR_VERSION = "dna-s13-routing-validator@1" as const
export const DNA_S13_ROUTING_FAILURE_CODES = Object.freeze([
  "WRONG_TOPIC",
  "WRONG_ACTION",
  "WRONG_FACET",
  "SPURIOUS_MULTI_TARGET",
] as const)
export type DnaS13RoutingFailureCode = typeof DNA_S13_ROUTING_FAILURE_CODES[number]

export type DnaS13RoutingValidation = Readonly<{
  version: typeof DNA_S13_ROUTING_VALIDATOR_VERSION
  pass: boolean
  failureCodes: readonly DnaS13RoutingFailureCode[]
  requestedTopicIds: readonly string[]
  resolvedTopicIds: readonly string[]
  requestedAction: DnaS13PragmaticAction
  selectedFacets: readonly DnaS13RequestedFacet[]
  explicitMultiTarget: boolean
}>

function unique<T>(values: readonly T[]) {
  return [...new Set(values)]
}

function sameSet<T>(left: readonly T[], right: readonly T[]) {
  const a = unique(left)
  const b = unique(right)
  return a.length === b.length && a.every((value) => b.includes(value))
}

const CONTEXT_ACTION: Readonly<Partial<Record<DnaS13ResolvedUserQuery["operation"], DnaS13PragmaticAction>>> = Object.freeze({
  expand_same_topic: "DEEPEN",
  example_same_topic: "EXAMPLE",
  why_same_topic: "WHY_SIGNIFICANCE",
  compare_previous_targets: "COMPARE",
  replace_previous_target: "CORRECT_TARGET",
})

/**
 * Provider- and catalog-independent last gate between routing and realization.
 * It validates only structure; it never creates a topic, facet, or claim.
 */
export function validateDnaS13Routing(input: Readonly<{
  context: DnaS13ResolvedUserQuery
  task: DnaS13PragmaticTaskFrame
  frame: DnaS13QueryFrame
  plan: DnaS13StrictPlan
}>): DnaS13RoutingValidation {
  const failures: DnaS13RoutingFailureCode[] = []
  const requestedTopicIds = unique(input.context.targetTopicIds)
  const resolvedTopicIds = unique(input.frame.subquestions.map((row) => row.topicId))
  const activeMentionIds = unique(input.context.topicMentions
    .filter((row) => row.polarity === "ACTIVE_TARGET").map((row) => row.topicId))
  const expectedTopicIds = requestedTopicIds.length ? requestedTopicIds : activeMentionIds
  if (expectedTopicIds.length && !sameSet(expectedTopicIds, resolvedTopicIds)) failures.push("WRONG_TOPIC")

  const expectedAction = input.context.operation === "simplify_same_topic"
    ? input.context.previousAction && input.context.previousAction !== "SIMPLIFY"
      ? input.context.previousAction
      : "EXPLAIN"
    : CONTEXT_ACTION[input.context.operation]
  if (expectedAction && input.task.pragmaticAction !== expectedAction) failures.push("WRONG_ACTION")
  if (input.context.operation === "simplify_same_topic"
    && !dnaS13HasPresentationModifier(input.task, "SIMPLIFY")) failures.push("WRONG_ACTION")

  const requestedFacetPairs = input.frame.subquestions.flatMap((row) =>
    (row.requestedFacets ?? []).map((facet) => `${row.id}:${row.topicId}:${facet}`))
  const plannedFacetPairs = (input.plan.facetEvidenceMatrix ?? [])
    .filter((entry) => entry.status !== "NOT_REQUESTED")
    .map((entry) => `${entry.subquestionId}:${entry.topicId}:${entry.facet}`)
  if (!sameSet(requestedFacetPairs, plannedFacetPairs)) failures.push("WRONG_FACET")

  const actionFacet = input.task.requestedFacets
  if ((input.task.pragmaticAction === "COMPARE" && !actionFacet.includes("distinction"))
    || (input.task.pragmaticAction === "DEEPEN" && !actionFacet.includes("explanatory_detail"))
    || (input.task.pragmaticAction === "EXAMPLE" && !actionFacet.includes("verified_example"))
    || (input.task.pragmaticAction === "WHY_SIGNIFICANCE" && !actionFacet.includes("function"))
    || (input.task.pragmaticAction === "DEFINE" && !actionFacet.includes("definition"))) {
    failures.push("WRONG_FACET")
  }

  const explicitMultiTarget = activeMentionIds.length > 1
    || (input.context.operation === "compare_previous_targets" && requestedTopicIds.length === 2)
  if (resolvedTopicIds.length > 1 && !explicitMultiTarget) failures.push("SPURIOUS_MULTI_TARGET")

  return Object.freeze({
    version: DNA_S13_ROUTING_VALIDATOR_VERSION,
    pass: failures.length === 0,
    failureCodes: Object.freeze(unique(failures)),
    requestedTopicIds: Object.freeze(expectedTopicIds),
    resolvedTopicIds: Object.freeze(resolvedTopicIds),
    requestedAction: input.task.pragmaticAction,
    selectedFacets: Object.freeze(unique(input.frame.subquestions.flatMap((row) => row.requestedFacets ?? []))),
    explicitMultiTarget,
  })
}

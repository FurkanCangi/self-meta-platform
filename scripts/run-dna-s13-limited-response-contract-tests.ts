import assert from "node:assert/strict"

import { buildDnaS13LimitedFeedbackRecord } from "../src/lib/dna/chat/s13/limitedRollout/feedback"
import { inspectDnaS13LimitedRolloutPrivacy } from "../src/lib/dna/chat/s13/limitedRollout/privacy"
import { resolveDnaS13NamedTopicSurfaces } from "../src/lib/dna/chat/s13/conversationContext"
import {
  DNA_S13_LIMITED_OWNER_BOOK_AUTHORITY,
  validateDnaS13LimitedPublicResponse,
} from "../src/lib/dna/chat/s13/limitedRollout/responseContract"
import { runDnaS13LimitedRolloutMessage } from "../src/lib/dna/chat/s13/limitedRollout/runner.server"
import { validateDnaS13LimitedTelemetryRecord } from "../src/lib/dna/chat/s13/limitedRollout/telemetry"
import {
  DNA_S13_REALIZER_CONTRACT_VERSION,
  DeterministicRealizer,
  type Realizer,
} from "../src/lib/dna/chat/s13/strictRealizer"

let assertions = 0
function check(value: unknown, message: string) {
  assertions += 1
  assert.ok(value, message)
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function mutate(body: Record<string, any>, change: (candidate: Record<string, any>) => void) {
  const candidate = clone(body)
  change(candidate)
  return candidate
}

const requestId = "33dfd40e-3fe0-40aa-8d53-e93db274b46b"
async function main() {
const privacy = inspectDnaS13LimitedRolloutPrivacy({ question: "İnhibisyon nedir?" })
const smoke = await runDnaS13LimitedRolloutMessage({
  requestId,
  subjectId: "synthetic-owner",
  subjectIdHash: "a".repeat(64),
  conversationIdHash: "b".repeat(64),
  sessionId: "synthetic-session",
  question: "İnhibisyon nedir?",
  responseDepth: "standard",
  privacy,
  rolloutPhase: "L0",
  contextSecret: "synthetic-context-secret-that-is-longer-than-thirty-two-characters",
  realizer: new DeterministicRealizer(),
})

check(smoke.kind === "answered", "server must produce an answered synthetic limited response")
if (smoke.kind !== "answered") throw new Error(`synthetic_smoke_failed:${smoke.reason}`)
const acceptedBody = smoke.body
const acceptedContract = validateDnaS13LimitedPublicResponse(acceptedBody)
check(Boolean(acceptedContract), "client contract gate must accept a valid accepted response")
check(acceptedContract?.realizationStatus === "accepted", "accepted response must retain accepted status")
check(typeof acceptedBody.summary === "string" && acceptedBody.summary.trim().length > 0,
  "accepted answer must be renderable")
check(Array.isArray(acceptedBody.answerUnits) && acceptedBody.answerUnits.length > 0,
  "accepted answer must include renderable answer units")
check(acceptedBody.limitedRolloutFeedbackEligible === true,
  "accepted limited answer must enable enum-only feedback")
check(Boolean(validateDnaS13LimitedTelemetryRecord(smoke.telemetry)),
  "synthetic smoke telemetry must satisfy the canonical telemetry contract")
check(smoke.telemetry.validation.pass && smoke.telemetry.realization.provider === "deterministic",
  "synthetic smoke must pass validation without Luna")
check(smoke.telemetry.trainingCandidate === false
  && smoke.telemetry.automaticTrainingUse === "prohibited",
"synthetic smoke must never become training data")

const unsupportedFacetQuestion = "İnhibisyon hangi bileşenlerden oluşur?"
const unsupportedFacetTurn = await runDnaS13LimitedRolloutMessage({
  requestId: "13dfd40e-3fe0-40aa-8d53-e93db274b46b",
  subjectId: "synthetic-owner",
  subjectIdHash: "a".repeat(64),
  conversationIdHash: "e".repeat(64),
  sessionId: "synthetic-unsupported-facet-session",
  question: unsupportedFacetQuestion,
  responseDepth: "standard",
  privacy: inspectDnaS13LimitedRolloutPrivacy({ question: unsupportedFacetQuestion }),
  rolloutPhase: "L0",
  realizer: new DeterministicRealizer(),
})
check(unsupportedFacetTurn.kind === "answered", "a genuinely unsupported facet must use the controlled S13 limitation path")
if (unsupportedFacetTurn.kind !== "answered") throw new Error(`unsupported_facet_smoke_failed:${unsupportedFacetTurn.reason}`)
const unsupportedUnits = unsupportedFacetTurn.body.answerUnits as readonly Record<string, any>[]
check(unsupportedUnits.filter((unit) => unit.kind === "limitation").length === 1,
  "unsupported facets must produce at most one limitation unit")
check(unsupportedUnits.some((unit) => unit.kind === "limitation" && unit.claimIds.length === 0),
  "an evidence limitation must not become a scientific claim")
check(!/(?:kilitli içerik|\bclaim\b|\bfacet\b|system\.facet-boundary|\bcatalog\b|\btopicid\b|\brequiredclaim\b)/iu
  .test(String(unsupportedFacetTurn.body.summary || "")), "displayed limitation must not expose evidence-management jargon")
check(unsupportedFacetTurn.telemetry.validation.pass, "unsupported evidence status must not be treated as an omission failure")

const unavailableRealizer: Realizer = {
  identity: Object.freeze({
    provider: "deterministic" as const,
    model: "synthetic-unavailable-realizer",
    implementationVersion: "synthetic-unavailable-realizer@1",
  }),
  async realize() {
    return Object.freeze({
      contractVersion: DNA_S13_REALIZER_CONTRACT_VERSION,
      identity: this.identity,
      prompt: Object.freeze({ version: "synthetic-unavailable-realizer@1", hash: "d".repeat(64) }),
      realization: null,
      rawOutput: null,
      responseId: null,
      usage: Object.freeze({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0 }),
      latencyMs: 0,
    })
  },
}
const lockedFallback = await runDnaS13LimitedRolloutMessage({
  requestId: "23dfd40e-3fe0-40aa-8d53-e93db274b46b",
  subjectId: "synthetic-owner",
  subjectIdHash: "a".repeat(64),
  conversationIdHash: "b".repeat(64),
  sessionId: "synthetic-session",
  question: "İnhibisyon nedir?",
  responseDepth: "standard",
  privacy,
  rolloutPhase: "L0",
  contextSecret: "synthetic-context-secret-that-is-longer-than-thirty-two-characters",
  realizer: unavailableRealizer,
})
check(lockedFallback.kind === "answered", "a resolved locked plan must stay on the S13 answer path")
if (lockedFallback.kind !== "answered") throw new Error(`locked_fallback_failed:${lockedFallback.reason}`)
const lockedFallbackContract = validateDnaS13LimitedPublicResponse(lockedFallback.body)
check(lockedFallbackContract?.realizationStatus === "fallback" && lockedFallbackContract.lockedPlanFallback,
  "locked-plan deterministic fallback must be explicit and display eligible")
check(lockedFallback.telemetry.validation.pass && lockedFallback.telemetry.validation.failureCodes.length === 0,
  "final fallback validation must be clean and separate from rejected attempts")

const comparisonQuestion = "Okupasyonel Performans ve Aktivite, Performans ve Katılım Arasındaki Ayrım karşılaştır."
const comparisonTurn = await runDnaS13LimitedRolloutMessage({
  requestId: "43dfd40e-3fe0-40aa-8d53-e93db274b46b",
  subjectId: "synthetic-owner",
  subjectIdHash: "a".repeat(64),
  conversationIdHash: "c".repeat(64),
  sessionId: "synthetic-correction-session",
  question: comparisonQuestion,
  responseDepth: "standard",
  privacy: inspectDnaS13LimitedRolloutPrivacy({ question: comparisonQuestion }),
  rolloutPhase: "L0",
  contextSecret: "synthetic-context-secret-that-is-longer-than-thirty-two-characters",
  realizer: new DeterministicRealizer(),
})
check(comparisonTurn.kind === "answered", "comparison setup for exact correction must answer")
if (comparisonTurn.kind !== "answered") throw new Error(`comparison_setup_failed:${comparisonTurn.reason}`)
const comparisonContext = comparisonTurn.body.conversationContext as Record<string, unknown>
const correctionQuestion = "Onu değil Aktivite, Performans ve Katılım Arasındaki Ayrım demek istedim; karşılaştırmayı bırak ve düzelt."
const correctionTurn = await runDnaS13LimitedRolloutMessage({
  requestId: "53dfd40e-3fe0-40aa-8d53-e93db274b46b",
  subjectId: "synthetic-owner",
  subjectIdHash: "a".repeat(64),
  conversationIdHash: "c".repeat(64),
  sessionId: "synthetic-correction-session",
  question: correctionQuestion,
  responseDepth: "standard",
  contextToken: String(comparisonContext.limitedRolloutContextToken || ""),
  contextSecret: "synthetic-context-secret-that-is-longer-than-thirty-two-characters",
  privacy: inspectDnaS13LimitedRolloutPrivacy({ question: correctionQuestion }),
  rolloutPhase: "L0",
  realizer: new DeterministicRealizer(),
})
const exactCorrectionTopic = resolveDnaS13NamedTopicSurfaces("Aktivite, Performans ve Katılım Arasındaki Ayrım")[0]?.topicId
check(correctionTurn.kind === "answered", "exact named correction containing comparison wording must answer")
check(correctionTurn.telemetry.routing.operation === "replace_previous_target"
  && correctionTurn.telemetry.routing.topicIds.length === 1
  && correctionTurn.telemetry.routing.topicIds[0] === exactCorrectionTopic,
"exact named correction must win before comparison parsing")

const canonicalNegationComparisonQuestion = "Allostaz: Değişerek Dengeyi Sağlamak ve Hedef Sakinlik Değil Katılım Olmalıdır karşılaştır; birini öbürünün nedeni ilan etme."
const canonicalNegationComparison = await runDnaS13LimitedRolloutMessage({
  requestId: "63dfd40e-3fe0-40aa-8d53-e93db274b46b",
  subjectId: "synthetic-owner",
  subjectIdHash: "a".repeat(64),
  conversationIdHash: "d".repeat(64),
  sessionId: "synthetic-canonical-negation-title-session",
  question: canonicalNegationComparisonQuestion,
  responseDepth: "standard",
  contextSecret: "synthetic-context-secret-that-is-longer-than-thirty-two-characters",
  privacy: inspectDnaS13LimitedRolloutPrivacy({ question: canonicalNegationComparisonQuestion }),
  rolloutPhase: "L0",
  realizer: new DeterministicRealizer(),
})
check(canonicalNegationComparison.kind === "answered",
  "değil inside a canonical comparison title must not become a correction clarification")
check(canonicalNegationComparison.telemetry.routing.questionTypes.filter((value) => value === "comparison").length === 2,
  "canonical negation title comparison must retain two comparison sides")

const feedback = buildDnaS13LimitedFeedbackRecord({ requestId, vote: "up" }, "a".repeat(64))
check(Boolean(feedback), "valid binary feedback must be recordable after a displayed response")
check(feedback?.containsFreeText === false && feedback.automaticTrainingUse === "prohibited",
  "feedback must stay free-text-free and training-prohibited")

const repairedBody = mutate(acceptedBody, (candidate) => {
  candidate.limitedRolloutContract.realizationStatus = "repaired"
})
const repairedContract = validateDnaS13LimitedPublicResponse(repairedBody)
check(Boolean(repairedContract), "client contract gate must accept a valid repaired response")
check(repairedContract?.realizationStatus === "repaired", "repaired response must retain repaired status")

const invalidCases: ReadonlyArray<readonly [string, (candidate: Record<string, any>) => void]> = [
  ["privacy failure", (candidate) => { candidate.limitedRolloutContract.privacyPass = false }],
  ["non-general privacy category", (candidate) => {
    candidate.limitedRolloutContract.privacyCategory = "clinical_case"
  }],
  ["validator failure", (candidate) => { candidate.limitedRolloutContract.validatorPass = false }],
  ["validator failure code", (candidate) => {
    candidate.limitedRolloutContract.validatorFailureCodes = ["unsupported_addition"]
  }],
  ["unsupported factual addition", (candidate) => {
    candidate.limitedRolloutContract.unsupportedFactualAdditionCount = 1
  }],
  ["unsupported relation", (candidate) => {
    candidate.limitedRolloutContract.unsupportedRelationCount = 1
  }],
  ["source violation", (candidate) => { candidate.limitedRolloutContract.sourceViolationCount = 1 }],
  ["safety violation", (candidate) => { candidate.limitedRolloutContract.safetyViolationCount = 1 }],
  ["display ineligible", (candidate) => { candidate.limitedRolloutContract.displayEligible = false }],
  ["rollout ineligible", (candidate) => {
    candidate.limitedRolloutContract.limitedRolloutEligible = false
  }],
  ["rejected realization", (candidate) => {
    candidate.limitedRolloutContract.realizationStatus = "rejected"
  }],
  ["malformed contract", (candidate) => { delete candidate.limitedRolloutContract.releaseHash }],
  ["wrong route", (candidate) => { candidate.limitedRolloutContract.route = "normal_chat" }],
  ["wrong schema", (candidate) => {
    candidate.limitedRolloutContract.schemaVersion = "dna-s13-limited-response@0"
  }],
  ["release hash mismatch", (candidate) => { candidate.packageSha256 = "c".repeat(64) }],
  ["wrong source id", (candidate) => { candidate.sources[0].sourceId = "book.wrong" }],
  ["wrong source authority", (candidate) => {
    candidate.sources[0].authority = {
      ...DNA_S13_LIMITED_OWNER_BOOK_AUTHORITY,
      layer: "external_scientific_information",
    }
  }],
  ["wrong answer authority", (candidate) => {
    candidate.answerUnits[0].authority.approvalRequirement = "codex_multi_pass_audited"
  }],
  ["uncited answer unit", (candidate) => { candidate.answerUnits[0].citationCardIds = [] }],
  ["feedback flag disabled", (candidate) => { candidate.limitedRolloutFeedbackEligible = false }],
]

for (const [name, change] of invalidCases) {
  check(validateDnaS13LimitedPublicResponse(mutate(acceptedBody, change)) === null,
    `client contract gate must reject ${name}`)
}

console.log(JSON.stringify({
  ok: true,
  assertions,
  syntheticSmoke: {
    serverResponse: "accepted",
    clientContract: "accepted",
    answerRenderable: true,
    feedbackRecordable: true,
    telemetryValid: true,
    provider: smoke.telemetry.realization.provider,
    lunaCalls: smoke.telemetry.realization.lunaCalls,
  },
  invalidResponsesRejected: invalidCases.length,
}, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

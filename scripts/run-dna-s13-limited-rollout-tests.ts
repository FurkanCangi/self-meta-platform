import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import {
  resolveDnaS13LimitedRolloutConfig,
  resolveDnaS13LimitedRolloutGate,
  isDnaS13StableCohortEligible,
} from "../src/lib/dna/chat/s13/limitedRollout/config"
import {
  hashDnaS13LimitedIdentifier,
  openDnaS13LimitedContext,
  sealDnaS13LimitedContext,
} from "../src/lib/dna/chat/s13/limitedRollout/context.server"
import { inspectDnaS13LimitedRolloutPrivacy } from "../src/lib/dna/chat/s13/limitedRollout/privacy"
import { getDnaS13LimitedRolloutReleaseCandidate } from "../src/lib/dna/chat/s13/limitedRollout/release"
import { createDnaS13LimitedFallbackTelemetry } from "../src/lib/dna/chat/s13/limitedRollout/runner.server"
import { buildDnaS13LimitedFeedbackRecord } from "../src/lib/dna/chat/s13/limitedRollout/feedback"
import {
  evaluateDnaS13LimitedBudget,
  summarizeDnaS13LimitedRollout,
  validateDnaS13LimitedTelemetryRecord,
} from "../src/lib/dna/chat/s13/limitedRollout/telemetry"

let assertions = 0
function check(value: unknown, message: string) {
  assertions += 1
  assert.ok(value, message)
}

const defaults = resolveDnaS13LimitedRolloutConfig({})
check(defaults.enabled === false, "limited rollout must default off")
check(defaults.percent === 0, "limited rollout percent must default zero")
check(defaults.phase === "L0", "limited rollout must default to L0")
check(defaults.dailyLunaCapMicrousd === 2_000_000, "daily Luna cap must default to USD 2")

const enabledL0 = resolveDnaS13LimitedRolloutConfig({
  DNA_S13_LIMITED_ROLLOUT_ENABLED: "true",
  DNA_S13_LIMITED_ROLLOUT_PERCENT: "0",
  DNA_S13_LIMITED_ROLLOUT_PHASE: "L0",
})
check(enabledL0.enabled, "valid L0 config should be enabled only when explicitly set")
check(resolveDnaS13LimitedRolloutGate({ config: enabledL0, subjectKey: "owner", trustedOwner: true }).routed,
  "trusted owner must be eligible in L0")
check(!resolveDnaS13LimitedRolloutGate({ config: enabledL0, subjectKey: "member", trustedOwner: false }).routed,
  "ordinary member must not be eligible in L0")
check(!resolveDnaS13LimitedRolloutGate({ config: defaults, subjectKey: "owner", trustedOwner: true }).routed,
  "kill switch must stop routing")

const productionRoute = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/app/dna-chat/route.ts"),
  "utf8",
)
check(
  /runDnaS13LimitedRolloutMessage\([\s\S]*?simplifyExperimentalEnabled:\s*false/.test(productionRoute),
  "V1 production route must keep experimental SIMPLIFY disabled",
)

const invalidL0 = resolveDnaS13LimitedRolloutConfig({
  DNA_S13_LIMITED_ROLLOUT_ENABLED: "true",
  DNA_S13_LIMITED_ROLLOUT_PERCENT: "1",
  DNA_S13_LIMITED_ROLLOUT_PHASE: "L0",
})
check(!invalidL0.enabled && invalidL0.reasonCodes.includes("l0_percentage_must_be_zero"),
  "L0 percentage routing must fail closed")
check(isDnaS13StableCohortEligible("stable-subject", 25)
  === isDnaS13StableCohortEligible("stable-subject", 25), "future cohort bucketing must be stable")

const generalPrivacy = inspectDnaS13LimitedRolloutPrivacy({ question: "Çalışma belleği nedir?" })
check(generalPrivacy.allowed, "general scientific question should pass privacy")
for (const [question, expectedReason] of [
  ["Bu çocuk seans sırasında çok zorlandı.", "clinical_case_or_record_context"],
  ["Danışan anamnezini yorumlar mısın?", "clinical_case_or_record_context"],
  ["Ayşe isimli kişi Medipol kliniğinde değerlendirildi.", "organization_plus_person"],
  ["E-posta test@example.com, raporu açıkla.", "direct_identifier"],
] as const) {
  const decision = inspectDnaS13LimitedRolloutPrivacy({ question })
  check(!decision.allowed && decision.reasonCodes.includes(expectedReason), `privacy must block ${expectedReason}`)
  check(!decision.maySourceConversationContext, "blocked turn must not source context")
  check(decision.automaticTrainingAllowed === false, "production privacy classification must never auto-train")
}
const reportPrivacy = inspectDnaS13LimitedRolloutPrivacy({
  question: "Bunu açıkla.", mode: "case", reportId: "1da8bed7-97dc-4f8a-9dba-f7af93bbbcaa",
})
check(!reportPrivacy.allowed && reportPrivacy.reasonCodes.includes("report_context_present"),
  "report context must be blocked before Luna")

const contextSecret = "context-secret-that-is-longer-than-thirty-two-characters"
const token = sealDnaS13LimitedContext({
  masterSecret: contextSecret,
  subjectId: "owner-a",
  topicIds: ["owner-book-section/example"],
  focus: "definition",
  questionType: "definition",
  responseDepth: "standard",
  now: 1_000,
})
check(Boolean(token), "context token should seal")
check(Boolean(openDnaS13LimitedContext({
  token: token!, masterSecret: contextSecret, subjectId: "owner-a", sessionId: "session-0001", now: 1_001,
})), "same subject should open context token")
check(openDnaS13LimitedContext({
  token: token!, masterSecret: contextSecret, subjectId: "owner-b", sessionId: "session-0002", now: 1_001,
}) === null, "cross-account context token must fail closed")

const telemetrySecret = "telemetry-secret-that-is-longer-than-thirty-two-characters"
const subjectIdHash = hashDnaS13LimitedIdentifier({ secret: telemetrySecret, kind: "subject", value: "owner-a" })!
const conversationIdHash = hashDnaS13LimitedIdentifier({ secret: telemetrySecret, kind: "conversation", value: "conversation-a" })!
const release = getDnaS13LimitedRolloutReleaseCandidate()
check(/^[a-f0-9]{64}$/.test(release.releaseHash) && release.immutable && !release.rolloutActivated,
  "release candidate must be immutable and inactive")
const fallbackTelemetry = createDnaS13LimitedFallbackTelemetry({
  requestId: "1da8bed7-97dc-4f8a-9dba-f7af93bbbcaa",
  createdAt: new Date(0).toISOString(),
  releaseVersion: release.releaseVersion,
  releaseHash: release.releaseHash,
  subjectIdHash,
  conversationIdHash,
  rolloutPhase: "L0",
  privacy: generalPrivacy,
  status: "fallback",
  reason: "synthetic_rollback",
  totalMs: 1,
})
check(fallbackTelemetry.trainingCandidate === false
  && fallbackTelemetry.automaticTrainingUse === "prohibited", "real traffic must never auto-train")
check(validateDnaS13LimitedTelemetryRecord({ ...fallbackTelemetry, question: "raw prompt" }) === null,
  "telemetry must reject raw prompt fields")

const up = buildDnaS13LimitedFeedbackRecord({
  requestId: fallbackTelemetry.requestId, vote: "up",
}, subjectIdHash)
const down = buildDnaS13LimitedFeedbackRecord({
  requestId: fallbackTelemetry.requestId, vote: "down", reason: "incomplete",
}, subjectIdHash)
check(up?.containsFreeText === false && down?.reason === "incomplete", "binary feedback should accept enum-only payloads")
check(buildDnaS13LimitedFeedbackRecord({
  requestId: fallbackTelemetry.requestId, vote: "down", note: "clinical free text",
}, subjectIdHash) === null, "feedback must reject free text")

const nearBudget = evaluateDnaS13LimitedBudget({
  spentMicrousd: 1_700_000, capMicrousd: 2_000_000, nearCapPercent: 80,
})
check(nearBudget.allowed && nearBudget.nearCap, "budget should alert near cap")
const closedBudget = evaluateDnaS13LimitedBudget({
  spentMicrousd: 1_990_000, capMicrousd: 2_000_000, nearCapPercent: 80,
})
check(!closedBudget.allowed && closedBudget.action === "fail_closed_deterministic",
  "budget must fail closed before exceeding cap")

const unsafeTelemetry = validateDnaS13LimitedTelemetryRecord({
  ...fallbackTelemetry,
  realization: { ...fallbackTelemetry.realization, provider: "luna", status: "accepted" },
  privacy: { ...fallbackTelemetry.privacy, allowed: false },
})!
const stopReadout = summarizeDnaS13LimitedRollout({
  messages: [unsafeTelemetry], feedback: [], dailyCapMicrousd: 2_000_000,
})
check(stopReadout.alerts.recommendation === "STOP"
  && stopReadout.alerts.immediateStopReasons.includes("privacy_leak"),
"privacy leak must trigger immediate STOP recommendation")

console.log(JSON.stringify({
  ok: true,
  assertions,
  releaseVersion: release.releaseVersion,
  releaseHash: release.releaseHash,
  defaults: { enabled: defaults.enabled, percent: defaults.percent, dailyLunaCapMicrousd: defaults.dailyLunaCapMicrousd },
}, null, 2))

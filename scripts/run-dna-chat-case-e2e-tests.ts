import assert from "node:assert/strict"

import {
  resolveDnaChat,
  resolveDnaChatApiRequest,
  type DnaChatApiAuditInput,
  type DnaChatApiResolverDependencies,
} from "../src/lib/dna/chat"
import {
  canBeginDnaChatReportSelection,
  createDnaChatReportSelectionCoordinator,
  planDnaChatNewConversation,
  planDnaChatReportTransition,
} from "../src/lib/dna/chat/conversationPolicy"
import { createCanonicalOwnedDnaCaseContext } from "../src/lib/dna/chat/ownedCaseContextCore"
import { createVerifiedTestCaseContext } from "./dna-chat-test-helpers"

const chain = {
  reportId: "11111111-1111-4111-8111-111111111111",
  loadedReportId: "11111111-1111-4111-8111-111111111111",
  assessmentId: "22222222-2222-4222-8222-222222222222",
  loadedAssessmentId: "22222222-2222-4222-8222-222222222222",
  clientId: "33333333-3333-4333-8333-333333333333",
  loadedClientId: "33333333-3333-4333-8333-333333333333",
  ownerId: "44444444-4444-4444-8444-444444444444",
  sessionUserId: "44444444-4444-4444-8444-444444444444",
} as const

const scores = {
  physiological: 28,
  sensory: 31,
  emotional: 40,
  cognitive: 42,
  executive: 38,
  interoception: 36,
} as const
const levels = {
  physiological: "Riskli",
  sensory: "Riskli",
  emotional: "Tipik",
  cognitive: "Tipik",
  executive: "Tipik",
  interoception: "Tipik",
} as const

const snapshots = {
  modern: {
    age_months: 48,
    scores,
    domain_levels: levels,
    chat_context: { version: "dna-chat-context@1", trace: "MUST_NOT_LEAK" },
    anamnez: "MUST_NOT_LEAK",
  },
  basic: { age_months: 48, scores, domain_levels: levels, answers: "MUST_NOT_LEAK" },
  legacy: {
    ageMonths: 48,
    scores: {
      fizyolojik: 28, duyusal: 31, duygusal: 40, bilissel: 42, yurutucu: 38, intero: 36,
    },
    domainLevels: {
      fizyolojik: "Riskli", duyusal: "Riskli", duygusal: "Tipik",
      bilissel: "Tipik", yurutucu: "Tipik", intero: "Tipik",
    },
  },
  incomplete: { age_months: 48, scores: { physiological: 28 } },
  empty: { age_months: 48 },
} as const

const canonical = Object.entries(snapshots).map(([name, snapshot]) => ({
  name,
  value: createCanonicalOwnedDnaCaseContext(snapshot, chain),
}))
assert.deepEqual(canonical.slice(0, 3).map((row) => row.value.provenance.contextKind), [
  "modern", "basic", "legacy",
])
for (const row of canonical) {
  const serialized = JSON.stringify(row.value)
  assert.doesNotMatch(serialized, /MUST_NOT_LEAK|"anamnez"\s*:|"answers"\s*:|"trace"\s*:/)
  assert.match(row.value.provenance.sourcePayloadSha256, /^[a-f0-9]{64}$/)
  assert.match(row.value.provenance.safeContextSha256, /^[a-f0-9]{64}$/)
  assert.match(row.value.provenance.lineageBindingSha256, /^[a-f0-9]{64}$/)
}

const firstSelection = planDnaChatReportTransition({
  action: "select_report",
  reportId: chain.reportId,
  currentReportId: null,
  pendingReportQuestion: "Son raporumu özetle.",
})
assert.equal(firstSelection.clearConversation, false)
assert.deepEqual(firstSelection.resubmitQuestions, ["Son raporumu özetle."])
const switched = planDnaChatReportTransition({
  action: "select_report",
  reportId: "55555555-5555-4555-8555-555555555555",
  currentReportId: chain.reportId,
  pendingReportQuestion: null,
})
assert.equal(switched.clearConversation, true)
assert.equal(switched.conversationContext, null)
assert.equal(planDnaChatNewConversation().selectedReportId, null)
assert.equal(planDnaChatNewConversation().conversationContext, null)
assert.equal(canBeginDnaChatReportSelection({ sending: false, reportsLoading: false, selectionInFlight: false }), true)

const selectionCoordinator = createDnaChatReportSelectionCoordinator()
assert.ok(selectionCoordinator.claim({
  reportId: chain.reportId,
  currentReportId: null,
  pendingReportQuestion: "Son raporumu özetle.",
}))
assert.equal(selectionCoordinator.claim({
  reportId: chain.reportId,
  currentReportId: null,
  pendingReportQuestion: "Son raporumu özetle.",
}), null)
selectionCoordinator.release()

const safeCase = createVerifiedTestCaseContext({
  ...canonical[0].value.context,
  dataStatus: "synthetic",
})

function dependencies(options: { auditOk?: boolean; missing?: boolean } = {}) {
  let loadCalls = 0
  const audits: DnaChatApiAuditInput[] = []
  const value: DnaChatApiResolverDependencies = {
      createRequestId: () => "case-e2e-request",
      loadCaseAnswer: async ({ question, mode, previousTopic, conversationContext }) => {
        loadCalls += 1
        if (options.missing) return { ok: false as const, status: 404 as const, error: "report_not_found" as const }
        return {
          ok: true as const,
          answer: resolveDnaChat({ question, mode, previousTopic, conversationContext, caseContext: safeCase }),
        }
      },
      writeAudit: async (input: DnaChatApiAuditInput) => {
        audits.push(input)
        return { ok: options.auditOk !== false }
      },
  }
  return {
    state: { get loadCalls() { return loadCalls }, audits },
    value,
  }
}

async function main() {
  const caseDeps = dependencies()
  const caseAnswer = await resolveDnaChatApiRequest({
    question: "Son raporumu özetle.",
    reportId: chain.reportId,
    context: { topicIds: ["case.overview"], lastQueryKind: "case" },
  }, caseDeps.value)
  assert.equal(caseAnswer.status, 200)
  assert.equal(caseDeps.state.loadCalls, 1)
  assert.equal(caseAnswer.body.classification === "case_finding" || caseAnswer.body.classification === "hypothesis", true)

  const noReportData = resolveDnaChat({
    question: "Son raporumu özetle.",
    caseContext: createVerifiedTestCaseContext({ dataStatus: "synthetic", ageMonths: 48 }),
  })
  assert.equal(noReportData.classification, "not_available")

  const knowledgeUnknown = await resolveDnaChatApiRequest({ question: "Kuantum dolanıklığı nedir?" }, dependencies().value)
  assert.equal(knowledgeUnknown.body.availabilityScope, "knowledge")
  const reportUnavailable = await resolveDnaChatApiRequest({
    question: "Son raporumu özetle.", reportId: chain.reportId,
  }, {
    ...dependencies().value,
    loadCaseAnswer: async () => ({ ok: true, answer: noReportData }),
  })
  assert.equal(reportUnavailable.body.availabilityScope, "report")

  const foreign = await resolveDnaChatApiRequest({
    question: "Son raporumu özetle.", reportId: chain.reportId,
  }, dependencies({ missing: true }).value)
  const nonexistent = await resolveDnaChatApiRequest({
    question: "Son raporumu özetle.", reportId: "66666666-6666-4666-8666-666666666666",
  }, dependencies({ missing: true }).value)
  assert.equal(foreign.status, 404)
  assert.deepEqual(foreign.body, nonexistent.body)

  const auditClosed = await resolveDnaChatApiRequest({
    question: "Son raporumu özetle.", reportId: chain.reportId,
  }, dependencies({ auditOk: false }).value)
  assert.equal(auditClosed.status, 503)
  assert.deepEqual(auditClosed.body, { ok: false, error: "audit_unavailable" })
  assert.doesNotMatch(JSON.stringify(caseDeps.state.audits), /MUST_NOT_LEAK|anamnez|answers|snapshot|trace|28|31/)

  console.log(JSON.stringify({
    ok: true,
    snapshotKinds: canonical.map((row) => row.value.provenance.contextKind),
    firstReportPreservesConversation: true,
    reportSwitchClearsConversation: true,
    pendingQuestionSingleClaim: true,
    availabilityScopesSeparated: true,
    foreignMissing404Equivalent: true,
    auditFailClosed: true,
    rawClinicalLeakCount: 0,
  }, null, 2))
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

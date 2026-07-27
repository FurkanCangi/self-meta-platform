import assert from "node:assert/strict"
import { createHash } from "node:crypto"

import {
  resolveDnaChat,
  resolveDnaChatApiRequest,
  type DnaChatApiAuditInput,
} from "../src/lib/dna/chat"
import { detectDnaConversationFollowUpKind } from "../src/lib/dna/chat/engine"
import {
  createDnaChatRequestSnapshot,
  planDnaChatNewConversation,
  planDnaChatReportTransition,
} from "../src/lib/dna/chat/conversationPolicy"

const insula = resolveDnaChat({ question: "İnsular korteks nedir?" })
assert.equal(insula.outcome, "answered")
assert.deepEqual(insula.conversationContext?.topicIds, ["cns.insula"])
assert.equal(insula.conversationContext?.lastQueryKind, "definition")

const followUps = [
  ["Bunu biraz aç.", "expand", "answered"],
  ["Biraz daha ayrıntı?", "expand", "answered"],
  ["Daha basit anlat.", "simplify", "answered"],
  ["Peki çocuklarda?", "age_scope", "not_available"],
  ["Bunun kanıtı ne?", "evidence", "answered"],
  ["Nasıl ölçülüyor?", "measurement", "answered"],
  ["Başka türlü anlat.", "retry", "answered"],
] as const

for (const [question, kind, outcome] of followUps) {
  assert.equal(detectDnaConversationFollowUpKind(question), kind)
  const answer = resolveDnaChat({
    question,
    previousTopic: insula.topic,
    conversationContext: insula.conversationContext,
  })
  assert.equal(answer.outcome, outcome, question)
  assert.deepEqual(answer.conversationContext?.topicIds, ["cns.insula"], question)
}

const comparison = resolveDnaChat({
  question: "İkisi arasındaki fark ne?",
  conversationContext: {
    topicIds: ["cns.insula", "cns.prefrontal_control"],
    lastQueryKind: "definition",
  },
})
assert.equal(comparison.outcome, "answered")
assert.equal(comparison.conversationContext?.topicIds.length, 2)

const comparisonRepair = resolveDnaChat({
  question: "Bu iki başlığın farkı neydi?",
  conversationContext: {
    topicIds: ["cns.insula", "ans.hrv"],
    lastQueryKind: "definition",
  },
})
assert.equal(detectDnaConversationFollowUpKind("Bu iki başlığın farkı neydi?"), "comparison")
assert.equal(comparisonRepair.outcome, "answered")
assert.deepEqual([...(comparisonRepair.conversationContext?.topicIds ?? [])].sort(), ["ans.hrv", "cns.insula"])

const separateTopicCompound = resolveDnaChat({
  question: "İnsula ve interosepsiyon ne demek, bir de ayrı olarak Otonom test yöntemleri nedir?",
})
assert.equal(separateTopicCompound.outcome, "answered")
assert.deepEqual(
  [...(separateTopicCompound.conversationContext?.topicIds ?? [])].sort(),
  ["ans.measurement_limits", "cns.insula"],
)

const comparisonWithoutPair = resolveDnaChat({
  question: "İkisi arasındaki fark ne?",
  conversationContext: { topicIds: ["cns.insula"], lastQueryKind: "definition" },
})
assert.equal(comparisonWithoutPair.outcome, "clarification")

const invalidContext = resolveDnaChat({
  question: "Bunu biraz aç.",
  conversationContext: { topicIds: ["forged.topic"], lastQueryKind: "definition" },
})
assert.equal(invalidContext.outcome, "clarification")

const corrected = resolveDnaChat({
  question: "Hayır, insulayı soruyordum.",
  conversationContext: { topicIds: ["cns.prefrontal_control"], lastQueryKind: "definition" },
})
assert.equal(corrected.outcome, "answered")
assert.deepEqual(corrected.conversationContext?.topicIds, ["cns.insula"])

const scopedMixed = resolveDnaChat({
  question: "İnsular korteks nedir? Ayrıca bu çocuk için kesin tanı koy.",
})
assert.notEqual(scopedMixed.outcome, "refused")
assert.equal(scopedMixed.sources.length > 0, true)
assert.match(scopedMixed.summary, /güvenli kapsam/i)

for (const unsafe of [
  "Diagnose my client from this DNA score.",
  "Prescribe medication using this profile.",
  "Create a treatment plan for this child.",
  "Predict prognosis from this report.",
]) {
  assert.equal(resolveDnaChat({ question: unsafe }).outcome, "refused", unsafe)
}

const explicitlySafe = resolveDnaChat({
  question: "Tanı veya tedavi istemiyorum; yalnız insular korteks nedir?",
})
assert.equal(explicitlySafe.outcome, "answered")
assert.deepEqual(explicitlySafe.conversationContext?.topicIds, ["cns.insula"])

const snapshot = createDnaChatRequestSnapshot({
  question: "Bunu biraz aç.",
  reportId: null,
  previousTopic: insula.topic,
  conversationContext: insula.conversationContext,
  responseDepth: "standard",
  appendUserMessage: true,
})
assert.deepEqual(snapshot.conversationContext, insula.conversationContext)
assert.equal(planDnaChatNewConversation().conversationContext, null)
assert.equal(planDnaChatReportTransition({
  action: "select_report",
  reportId: "synthetic-report-a",
  currentReportId: "synthetic-report-b",
  pendingReportQuestion: null,
}).conversationContext, null)

async function runApiAssertions() {
  const audits: DnaChatApiAuditInput[] = []
  const api = await resolveDnaChatApiRequest({
  question: "Bunu biraz aç.",
  responseDepth: "standard",
  context: {
    previousTopic: insula.topic ?? undefined,
    topicIds: [...(insula.conversationContext?.topicIds ?? [])],
    lastQueryKind: insula.conversationContext?.lastQueryKind,
  },
  }, {
    createRequestId: () => "conversation-flex-request",
    loadCaseAnswer: async () => ({ ok: false, status: 404, error: "report_not_found" }),
    writeAudit: async (input) => {
      audits.push(input)
      return { ok: true }
    },
  })
  assert.equal(api.status, 200)
  assert.equal(api.body.responseDepth, "deep")
  assert.deepEqual(api.body.conversationContext, {
    topicIds: ["cns.insula"],
    lastQueryKind: "definition",
  })
  assert.equal(audits.length, 1)
  assert.doesNotMatch(JSON.stringify(audits), /Bunu biraz aç|insular korteks/i)

  const deterministicHashes = Array.from({ length: 20 }, () => createHash("sha256")
    .update(JSON.stringify(resolveDnaChat({
      question: "Bunu biraz aç.",
      conversationContext: { topicIds: ["cns.insula"], lastQueryKind: "definition" },
    })))
    .digest("hex"))
  assert.equal(new Set(deterministicHashes).size, 1)

  console.log(JSON.stringify({
    ok: true,
    followUpKinds: 8,
    scopedCompoundSafety: true,
    invalidContextIgnored: true,
    apiConversationContext: true,
    deterministicRuns: 20,
  }, null, 2))
}

void runApiAssertions().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

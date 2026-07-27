import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  canBeginDnaChatReportSelection,
  createDnaChatRequestCoordinator,
  createDnaChatReportSelectionCoordinator,
  isDnaChatRetryableError,
  planDnaChatNewConversation,
  planDnaChatReportTransition,
  planDnaChatRetry,
  shouldReuseDnaChatUserMessage,
} from "../src/lib/dna/chat/conversationPolicy"
import {
  DNA_PHASE_47_AUTOMATED_TASKS,
  DNA_PHASE_47_VALIDATION_VERSION,
  evaluateDnaPhase47UxGate,
  type DnaPhase47AutomationObservation,
  type DnaPhase47HumanStudyAggregate,
} from "../src/lib/dna/chat/evaluation/phase45to47Validation"
import { resolveDnaChat } from "../src/lib/dna/chat"

const root = process.cwd()
const clientPath = join(root, "src/app/dna-asistani/DnaAssistantClient.tsx")
const clientSource = readFileSync(clientPath, "utf8")
const issueFeedbackSource = readFileSync(
  join(root, "src/app/dna-asistani/DnaIssueFeedback.tsx"),
  "utf8",
)
const protocolSource = readFileSync(join(
  root,
  "docs/dna-intelligence/governance/v3/phase-45-47-validation.md",
), "utf8")

function sha256(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

function includesAll(source: string, fragments: readonly string[]) {
  return fragments.every((fragment) => source.includes(fragment))
}

const selectedReportIsVisible = includesAll(clientSource, [
  "{selectedReport ? (",
  "role=\"status\"",
  "selectedReport.clientCode",
  "formatDate(selectedReport.createdAt)",
])

const wrongReportCanBeChanged = includesAll(clientSource, [
  "function changeReportContext()",
  "action: \"change_report\"",
  "clearConversation()",
  ">\n                  Değiştir\n",
  "Rapor bağlamını kaldır ve yeni sohbet başlat",
])

const sourceCardMapsToClaim = includesAll(clientSource, [
  "citationCardIds",
  "supportedClaim",
  "Desteklediği sınırlı iddia:",
  "Claim ve passage eşleşmeli kaynak",
  "sourceAnchor(answer.requestId",
])

const reportAbsenceDiffersFromScienceUnknown = includesAll(clientSource, [
  'answer.availabilityScope === "report"',
  "Seçili raporda bulunamadı",
  "Henüz yanıtlayamıyorum",
  "case_missing: \"Raporda bulunmayan veya eksik veri\"",
]) && !clientSource.includes("Raporda Yok")

const unknown = resolveDnaChat({ question: "Kuantum dolanıklığı nedir?" })
const notAvailableExplainsProductBoundary = unknown.classification === "not_available"
  && unknown.safetyBoundary.length > 0
  && [unknown.summary, ...unknown.limitations].join(" ").toLocaleLowerCase("tr-TR")
    .match(/(?:katalog|bulunmuyor|bulunamadı|sunamıyorum|sınır|kapsam)/) !== null
  && !clientSource.includes("<span>{answer.safetyBoundary}</span>")

const evidenceLevelCalibratesConfidence = includesAll(clientSource, [
  "Kanıt yetersiz",
  "Tartışmalı teori",
  "Bu ilişki kurulmamıştır",
  "answer.evidenceSummary?.dnaValidationStatus",
]) && !includesAll(clientSource, ["Kanıt düzeyi:", "Yaş kapsamı:", "İddia sınırı:"])

const criticalWarningRemainsVisible = includesAll(clientSource, [
  "answerStatusLabels",
  "Kanıt ve ilişki uyarıları",
  "Kanıt yetersiz",
  "Tartışmalı teori",
  "Bu ilişki kurulmamıştır",
])

for (const hiddenUiFragment of [
  "Kanıt düzeyi:",
  "Yaş kapsamı:",
  "İddia sınırı:",
  "Enter gönderir",
  ">Sınırlılıklar<",
  "<span>{answer.safetyBoundary}</span>",
  "answer.suggestedQuestions.slice",
  "DNA_INTELLIGENCE_COMPOSER_NOTICE_TR",
  "DNA_CHAT_STARTER_QUESTIONS",
  "STARTER_QUESTIONS.slice",
]) {
  assert.equal(
    clientSource.includes(hiddenUiFragment),
    false,
    `Hidden chat metadata or suggestion UI resurfaced: ${hiddenUiFragment}`,
  )
}
assert.equal(includesAll(clientSource, [
  'answer.topic?.startsWith("conversation.")',
  'aria-label="DNA Intelligence yanıtı"',
  "{answer.summary}",
]), true, "Social conversation answers must use the compact assistant rendering")
assert.equal(
  clientSource.indexOf('answer.topic?.startsWith("conversation.")') < clientSource.indexOf("const baseMeta"),
  true,
  "Social conversation rendering must exit before clinical metadata is assembled",
)
assert.equal(includesAll(clientSource, [
  "const visibleAnswerUnits = answer.answerUnits.filter",
  'unit.kind !== "limitation"',
  'unit.kind !== "safety_boundary" || unit.section === "case_non_inference"',
  "visibleAnswerUnits.map",
]), true, "Auxiliary limitation and generic safety units must stay hidden without removing case non-inference")

const mobileAndKeyboardCompletion = includesAll(clientSource, [
  "aria-live=\"polite\"",
  "aria-relevant=\"additions text\"",
  "focus-visible:ring-2",
  "min-h-11",
  "env(safe-area-inset-bottom)",
  "tabIndex={-1}",
  "requestAnimationFrame(() => target?.focus())",
  "<form onSubmit={submitQuestion}",
])

const feedbackDialogKeyboardSafety = includesAll(issueFeedbackSource, [
  "aria-haspopup=\"dialog\"",
  "aria-controls={dialogId}",
  "aria-labelledby={dialogTitleId}",
  "closeButtonRef.current?.focus()",
  "event.key === \"Escape\"",
  "event.key !== \"Tab\"",
  "triggerRef.current?.focus()",
])
assert.equal(feedbackDialogKeyboardSafety, true, "Feedback dialog keyboard/focus contract failed")

const interruptionRecoveryMarkup = includesAll(clientSource, [
  "aria-label=\"Yanıt oluşturmayı durdur\"",
  ">Durdur</span>",
  "Soruyu yeniden dene",
  "aria-describedby={sendError ? \"dna-chat-send-error\" : undefined}",
  "min-h-12",
])
assert.equal(interruptionRecoveryMarkup, true, "Stop/retry accessibility markup contract failed")

const newConversationMarkup = includesAll(clientSource, [
  "function startNewConversation()",
  "planDnaChatNewConversation()",
  "router.replace(\"/dna-asistani\", { scroll: false })",
  "aria-label=\"Yeni sohbet başlat; mevcut sohbeti ve rapor bağlamını temizle\"",
  "Yeni sohbet",
  "min-h-11",
  "flex-wrap",
])
assert.equal(newConversationMarkup, true, "New-chat responsive accessibility markup contract failed")

// Unlike the legacy source-presence checks above, recovery and reset behavior
// is exercised through the exact coordinator/policy used by the React client.
const responseCoordinator = createDnaChatRequestCoordinator()
const firstRequest = responseCoordinator.begin({
  question: "  İnsular korteks nedir?  ",
  reportId: null,
  previousTopic: "cns.insula",
  responseDepth: "deep",
  appendUserMessage: true,
})
assert.equal(firstRequest.snapshot.question, "İnsular korteks nedir?")
assert.equal(firstRequest.controller.signal.aborted, false)
assert.equal(responseCoordinator.isCurrent(firstRequest.requestId), true)

const interruptedSnapshot = responseCoordinator.cancel()
assert.equal(firstRequest.controller.signal.aborted, true)
assert.equal(responseCoordinator.isCurrent(firstRequest.requestId), false)
assert.ok(interruptedSnapshot)
const retrySnapshot = planDnaChatRetry(interruptedSnapshot)
assert.equal(retrySnapshot.appendUserMessage, false, "Retry must not duplicate the user bubble")
assert.equal(retrySnapshot.responseDepth, "deep", "Retry must preserve the selected response depth")
assert.equal(retrySnapshot.previousTopic, "cns.insula", "Retry must preserve visible topic context")
assert.equal(shouldReuseDnaChatUserMessage(retrySnapshot, "İnsular korteks nedir?"), true)
assert.equal(shouldReuseDnaChatUserMessage(retrySnapshot, "HRV nedir?"), false)
assert.equal(isDnaChatRetryableError("request_cancelled"), true)
assert.equal(isDnaChatRetryableError("dna_chat_failed"), true)
assert.equal(isDnaChatRetryableError("unauthorized"), false)

const newerRequest = responseCoordinator.begin({
  question: "HRV nedir?",
  reportId: "11111111-1111-4111-8111-111111111111",
  previousTopic: null,
  responseDepth: "short",
  appendUserMessage: false,
})
const supersedingRequest = responseCoordinator.begin({
  question: "Allostaz nedir?",
  reportId: null,
  previousTopic: null,
  responseDepth: "standard",
  appendUserMessage: true,
})
assert.equal(newerRequest.controller.signal.aborted, true, "A superseded request must abort")
assert.equal(responseCoordinator.complete(newerRequest.requestId), false, "A stale response must not commit")
assert.equal(responseCoordinator.complete(supersedingRequest.requestId), true)

const newConversationPlan = planDnaChatNewConversation()
assert.equal(newConversationPlan.clearMessages, true)
assert.equal(newConversationPlan.clearReportOptions, true)
assert.equal(newConversationPlan.selectedReportId, null)
assert.equal(newConversationPlan.reportPickerOpen, false)
assert.equal(newConversationPlan.pendingReportQuestion, null)
assert.equal(newConversationPlan.previousTopic, null)
assert.equal(newConversationPlan.draftQuestion, "")
assert.equal(newConversationPlan.clearErrors, true)
assert.equal(newConversationPlan.preserveResponseDepth, true)

const taskResults = {
  selected_report_is_visible: selectedReportIsVisible,
  wrong_report_can_be_changed: wrongReportCanBeChanged,
  source_card_maps_to_claim: sourceCardMapsToClaim,
  report_absence_differs_from_science_unknown: reportAbsenceDiffersFromScienceUnknown,
  not_available_explains_product_boundary: notAvailableExplainsProductBoundary,
  evidence_level_calibrates_confidence: evidenceLevelCalibratesConfidence,
  critical_warning_remains_visible: criticalWarningRemainsVisible,
  mobile_and_keyboard_completion: mobileAndKeyboardCompletion,
} as const

for (const task of DNA_PHASE_47_AUTOMATED_TASKS) {
  assert.equal(taskResults[task], true, `UX automation contract failed: ${task}`)
}

const changeTransition = planDnaChatReportTransition({
  action: "change_report",
  pendingReportQuestion: "Bekleyen soru",
})
assert.equal(changeTransition.clearConversation, true)
assert.equal(changeTransition.selectedReportId, null)
assert.equal(changeTransition.previousTopic, null)
assert.deepEqual(changeTransition.resubmitQuestions, [])

const selection = planDnaChatReportTransition({
  action: "select_report",
  reportId: "11111111-1111-4111-8111-111111111111",
  currentReportId: null,
  pendingReportQuestion: "Bekleyen rapor sorusu",
})
assert.equal(selection.clearConversation, false, "First report binding must preserve visible messages")
assert.deepEqual(selection.resubmitQuestions, ["Bekleyen rapor sorusu"])
const reportSwitch = planDnaChatReportTransition({
  action: "select_report",
  reportId: "22222222-2222-4222-8222-222222222222",
  currentReportId: "11111111-1111-4111-8111-111111111111",
  pendingReportQuestion: null,
})
assert.equal(reportSwitch.clearConversation, true, "Switching reports must isolate case conversations")
const coordinator = createDnaChatReportSelectionCoordinator()
const initialSelection = coordinator.claim({
  reportId: "11111111-1111-4111-8111-111111111111",
  currentReportId: null,
  pendingReportQuestion: "Bekleyen rapor sorusu",
})
assert.equal(initialSelection?.clearConversation, false)
assert.equal(coordinator.claim({
  reportId: "22222222-2222-4222-8222-222222222222",
  currentReportId: null,
  pendingReportQuestion: "Bekleyen rapor sorusu",
}), null, "Rapid second report selection must not resubmit the pending question")
assert.equal(includesAll(clientSource, [
  "currentReportId: selectedReportId || null",
  "appendUser: transition.clearConversation",
]), true, "Client must preserve the transcript and avoid duplicating the pending user message")
assert.equal(canBeginDnaChatReportSelection({
  sending: false,
  reportsLoading: false,
  selectionInFlight: false,
}), true)
assert.equal(canBeginDnaChatReportSelection({
  sending: true,
  reportsLoading: false,
  selectionInFlight: false,
}), false)

assert.match(protocolSource, /gerçek terapist/i)
assert.match(protocolSource, /sentetik veya kimliksizleştirilmiş/i)
assert.match(protocolSource, /temel görev başarısı[^\n]*%90/i)
assert.match(protocolSource, /ürün sınırını[^\n]*%90/i)
assert.match(protocolSource, /kritik uyarı[^\n]*0/i)
assert.match(protocolSource, /klinik fayda[^\n]*(?:kanıtlamaz|iddiası)/i)

const automation: DnaPhase47AutomationObservation = {
  artifactSha256: sha256({ clientPath, taskResults }),
  taskResults,
}
const currentGate = evaluateDnaPhase47UxGate({ automation, humanStudy: null })
assert.equal(currentGate.automationStatus, "pass")
assert.equal(currentGate.humanStudyStatus, "not_ready")
assert.equal(currentGate.releaseStatus, "not_ready")
assert.equal(currentGate.clinicalBenefitMarketingClaimAllowed, false)
assert.ok(currentGate.blockerCodes.includes("phase47_real_therapist_study_missing"))

// This is an evaluator-only contract fixture. It is deliberately not written
// as study evidence and must never be reported as an observed human result.
const evaluatorOnlyStudyFixture: DnaPhase47HumanStudyAggregate = {
  protocolVersion: DNA_PHASE_47_VALIDATION_VERSION,
  evidenceScope: "real_therapist_usability_study",
  artifactSha256: "a".repeat(64),
  participantCount: 12,
  intendedUserParticipantCount: 12,
  taskAttempts: 96,
  successfulTaskAttempts: 87,
  productBoundaryExplanations: 12,
  correctProductBoundaryExplanations: 11,
  criticalWarningOpportunities: 12,
  criticalWarningMisses: 0,
  mobileTaskParticipants: 3,
  keyboardOnlyTaskParticipants: 3,
  containsRealClinicalContent: false,
}
const evaluatorFixturePass = evaluateDnaPhase47UxGate({
  automation,
  humanStudy: evaluatorOnlyStudyFixture,
})
assert.equal(evaluatorFixturePass.releaseStatus, "pass")
assert.equal(evaluatorFixturePass.clinicalBenefitMarketingClaimAllowed, false)

const criticalMissFixture = evaluateDnaPhase47UxGate({
  automation,
  humanStudy: { ...evaluatorOnlyStudyFixture, criticalWarningMisses: 1 },
})
assert.equal(criticalMissFixture.releaseStatus, "fail")
assert.ok(criticalMissFixture.blockerCodes.includes("phase47_critical_warning_miss"))

console.log(JSON.stringify({
  ok: true,
  automatedTaskCount: DNA_PHASE_47_AUTOMATED_TASKS.length,
  automatedTasks: taskResults,
  feedbackDialogKeyboardSafety,
  interruptionRecoveryMarkup,
  newConversationMarkup,
  requestRecoveryBehavior: true,
  newConversationBehavior: true,
  automationStatus: currentGate.automationStatus,
  humanStudyStatus: currentGate.humanStudyStatus,
  releaseStatus: currentGate.releaseStatus,
  clinicalBenefitMarketingClaimAllowed: currentGate.clinicalBenefitMarketingClaimAllowed,
  blockerCodes: currentGate.blockerCodes,
  note: "No human participants were run; no human success rate is claimed.",
}, null, 2))

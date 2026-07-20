import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  canBeginDnaChatReportSelection,
  createDnaChatReportSelectionCoordinator,
  planDnaChatReportTransition,
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
  "reportScopedNotAvailable",
  "label: \"Raporda Yok\"",
  "not_available: { label: \"Bilgi Bulunamadı\"",
  "case_missing: \"Raporda bulunmayan veya eksik veri\"",
])

const unknown = resolveDnaChat({ question: "Kuantum dolanıklığı nedir?" })
const notAvailableExplainsProductBoundary = unknown.classification === "not_available"
  && unknown.safetyBoundary.length > 0
  && [unknown.summary, ...unknown.limitations].join(" ").toLocaleLowerCase("tr-TR")
    .match(/(?:katalog|bulunmuyor|bulunamadı|sunamıyorum|sınır|kapsam)/) !== null
  && includesAll(clientSource, ["answer.safetyBoundary", "Bilgi sınırı:"])

const evidenceLevelCalibratesConfidence = includesAll(clientSource, [
  "Kanıt düzeyi:",
  "Kanıt yetersiz",
  "Tartışmalı teori",
  "Bu ilişki kurulmamıştır",
  "evidenceSummary.dnaValidationStatus",
])

const criticalWarningRemainsVisible = includesAll(clientSource, [
  "answerStatusLabels",
  "Kanıt ve ilişki uyarıları",
  "hasSafetyBoundaryUnit",
  "answer.safetyBoundary && !hasSafetyBoundaryUnit",
  "ShieldCheck",
])

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
  pendingReportQuestion: "Bekleyen rapor sorusu",
})
assert.equal(selection.clearConversation, true)
assert.deepEqual(selection.resubmitQuestions, ["Bekleyen rapor sorusu"])
const coordinator = createDnaChatReportSelectionCoordinator()
assert.ok(coordinator.claim({
  reportId: "11111111-1111-4111-8111-111111111111",
  pendingReportQuestion: "Bekleyen rapor sorusu",
}))
assert.equal(coordinator.claim({
  reportId: "22222222-2222-4222-8222-222222222222",
  pendingReportQuestion: "Bekleyen rapor sorusu",
}), null, "Rapid second report selection must not resubmit the pending question")
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
  automationStatus: currentGate.automationStatus,
  humanStudyStatus: currentGate.humanStudyStatus,
  releaseStatus: currentGate.releaseStatus,
  clinicalBenefitMarketingClaimAllowed: currentGate.clinicalBenefitMarketingClaimAllowed,
  blockerCodes: currentGate.blockerCodes,
  note: "No human participants were run; no human success rate is claimed.",
}, null, 2))

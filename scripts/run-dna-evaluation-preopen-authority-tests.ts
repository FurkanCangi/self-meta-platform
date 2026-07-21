#!/usr/bin/env node

import assert from "node:assert/strict"

import {
  assertDnaEvaluationLifecycleLedger,
  assertDnaEvaluationOpenReceiptBound,
  assertDnaEvaluationPreOpenAuthority,
  closeDnaEvaluationAuthority,
  createDnaEvaluationLifecycleLedger,
  createDnaEvaluationPreOpenAuthority,
  dnaEvaluationReleaseBindingsSha256,
  openDnaEvaluationAuthority,
  type DnaEvaluationReleaseBindings,
} from "../src/lib/dna/chat/evaluation/evaluationPreOpenAuthority"

const hash = (seed: string): string => seed.repeat(64).slice(0, 64)

const bindings: DnaEvaluationReleaseBindings = Object.freeze({
  engineVersion: "dna-chat-engine@3",
  engineCodeSha256: hash("a"),
  catalogVersion: "dna-v3-static-package@1",
  catalogPackageSha256: hash("b"),
  sourceGitCommit: "c".repeat(40),
  sourceTreeSha256: hash("d"),
  lockedBenchmarkManifestSha256: hash("e"),
  lockedBenchmarkPayloadSha256: hash("f"),
  variationBankManifestSha256: hash("1"),
  variationBankPayloadSha256: hash("2"),
  developmentHistoryAuthoritySha256: hash("3"),
  semanticFamilyRegistrySha256: hash("4"),
  questionApprovalLedgerSha256: hash("5"),
  variationApprovalLedgerSha256: hash("6"),
})

const authority = createDnaEvaluationPreOpenAuthority({
  authorityId: "dna.eval.preopen.release-001",
  sealedAt: "2026-07-20T10:00:00.000Z",
  sealedBy: "reviewer.release-sealer",
  bindings,
})
assertDnaEvaluationPreOpenAuthority(authority)
assert.equal(authority.bindingsSha256, dnaEvaluationReleaseBindingsSha256(bindings))
assert.deepEqual(authority, createDnaEvaluationPreOpenAuthority({
  authorityId: "dna.eval.preopen.release-001",
  sealedAt: "2026-07-20T10:00:00.000Z",
  sealedBy: "reviewer.release-sealer",
  bindings,
}), "Aynı bağlı girdiler aynı pre-open authority üretmeli")

const sealedLedger = createDnaEvaluationLifecycleLedger(authority)
assertDnaEvaluationLifecycleLedger(sealedLedger)
assert.equal(sealedLedger.events.length, 1)
assert.equal(sealedLedger.events[0]?.eventType, "sealed")

const opened = openDnaEvaluationAuthority({
  authority,
  ledger: sealedLedger,
  currentBindings: bindings,
  receiptId: "dna.eval.receipt.release-001",
  evaluationRunId: "dna.eval.run.release-001",
  evaluatorId: "reviewer.release-evaluator",
  openedAt: "2026-07-20T11:00:00.000Z",
})
assertDnaEvaluationLifecycleLedger(opened.ledger)
assertDnaEvaluationOpenReceiptBound({ authority, ...opened })
assert.equal(opened.ledger.events.length, 2)
assert.equal(opened.ledger.events[1]?.eventType, "opened_for_evaluation")

const closed = closeDnaEvaluationAuthority({
  authority,
  ledger: opened.ledger,
  receipt: opened.receipt,
  closedAt: "2026-07-20T12:00:00.000Z",
  closedBy: "reviewer.release-evaluator",
  reason: "Bound release evaluation completed; result remains governed by the release gates.",
})
assertDnaEvaluationLifecycleLedger(closed)
assertDnaEvaluationOpenReceiptBound({ authority, ledger: closed, receipt: opened.receipt })
assert.equal(closed.events[2]?.eventType, "closed_after_evaluation")

const expectThrow = (name: string, run: () => unknown, pattern: RegExp): void => {
  assert.throws(run, pattern, name)
}

for (const field of [
  "engineCodeSha256",
  "catalogPackageSha256",
  "sourceTreeSha256",
  "lockedBenchmarkManifestSha256",
  "lockedBenchmarkPayloadSha256",
  "variationBankManifestSha256",
  "variationBankPayloadSha256",
  "developmentHistoryAuthoritySha256",
  "semanticFamilyRegistrySha256",
  "questionApprovalLedgerSha256",
  "variationApprovalLedgerSha256",
] as const) {
  expectThrow(`Değişen ${field} benchmark açılışını engellemeli`, () =>
    openDnaEvaluationAuthority({
      authority,
      ledger: sealedLedger,
      currentBindings: { ...bindings, [field]: hash("9") },
      receiptId: `dna.eval.receipt.tamper-${field}`,
      evaluationRunId: "dna.eval.run.release-001",
      evaluatorId: "reviewer.release-evaluator",
      openedAt: "2026-07-20T11:00:00.000Z",
    }), /observed_bindings_mismatch/)
}

expectThrow("Git commit değişimi benchmark açılışını engellemeli", () =>
  openDnaEvaluationAuthority({
    authority,
    ledger: sealedLedger,
    currentBindings: { ...bindings, sourceGitCommit: "9".repeat(40) },
    receiptId: "dna.eval.receipt.tamper-git",
    evaluationRunId: "dna.eval.run.release-001",
    evaluatorId: "reviewer.release-evaluator",
    openedAt: "2026-07-20T11:00:00.000Z",
  }), /observed_bindings_mismatch/)

expectThrow("Aynı authority ikinci kez açılamamalı", () =>
  openDnaEvaluationAuthority({
    authority,
    ledger: opened.ledger,
    currentBindings: bindings,
    receiptId: "dna.eval.receipt.release-002",
    evaluationRunId: "dna.eval.run.release-002",
    evaluatorId: "reviewer.release-evaluator",
    openedAt: "2026-07-20T11:30:00.000Z",
  }), /already_opened_or_ledger_mismatch/)

expectThrow("Açılış mühür tarihinden önce olamamalı", () =>
  openDnaEvaluationAuthority({
    authority,
    ledger: sealedLedger,
    currentBindings: bindings,
    receiptId: "dna.eval.receipt.predates",
    evaluationRunId: "dna.eval.run.predates",
    evaluatorId: "reviewer.release-evaluator",
    openedAt: "2026-07-20T09:59:59.000Z",
  }), /predates_seal/)

expectThrow("Receipt değişikliği hash doğrulamasından geçmemeli", () =>
  assertDnaEvaluationOpenReceiptBound({
    authority,
    ledger: opened.ledger,
    receipt: { ...opened.receipt, evaluatorId: "reviewer.forged-evaluator" },
  }), /open_receipt_hash_mismatch/)

expectThrow("Lifecycle event zinciri değiştirilememeli", () =>
  assertDnaEvaluationLifecycleLedger({
    ...opened.ledger,
    events: [opened.ledger.events[0]!, {
      ...opened.ledger.events[1]!,
      previousEventSha256: hash("8"),
    }],
  }), /event_chain_mismatch/)

expectThrow("Bilinmeyen binding alanı reddedilmeli", () =>
  createDnaEvaluationPreOpenAuthority({
    authorityId: "dna.eval.preopen.extra-field",
    sealedAt: "2026-07-20T10:00:00.000Z",
    sealedBy: "reviewer.release-sealer",
    bindings: { ...bindings, hiddenLeak: hash("7") } as DnaEvaluationReleaseBindings,
  }), /binding_unknown_or_missing_field/)

console.log(JSON.stringify({
  status: "passed",
  authoritySha256: authority.authoritySha256,
  sealedLedgerSha256: sealedLedger.ledgerSha256,
  openReceiptSha256: opened.receipt.receiptSha256,
  closedLedgerSha256: closed.ledgerSha256,
  negativeBindingMutationCases: 12,
  lifecycleNegativeCases: 5,
}, null, 2))

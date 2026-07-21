import { createHash } from "node:crypto"

export const DNA_EVALUATION_PREOPEN_AUTHORITY_VERSION =
  "dna-evaluation-preopen-authority@1" as const
export const DNA_EVALUATION_OPEN_RECEIPT_VERSION =
  "dna-evaluation-open-receipt@1" as const
export const DNA_EVALUATION_LIFECYCLE_LEDGER_VERSION =
  "dna-evaluation-lifecycle-ledger@1" as const
export const DNA_EVALUATION_LIFECYCLE_EVENT_VERSION =
  "dna-evaluation-lifecycle-event@1" as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const GIT_COMMIT_PATTERN = /^[a-f0-9]{40}$/
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,199}$/

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort((left, right) => left.localeCompare(right, "en"))
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex")
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  }
  return value
}

function assertExactKeys(value: object, expected: readonly string[], code: string): void {
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right, "en"))
  const wanted = [...expected].sort((left, right) => left.localeCompare(right, "en"))
  if (actual.length !== wanted.length
    || actual.some((key, index) => key !== wanted[index])) throw new Error(code)
}

function assertIdentifier(value: string, code: string): void {
  if (!IDENTIFIER_PATTERN.test(String(value || ""))) throw new Error(code)
}

function assertSha256(value: string, code: string): void {
  if (!SHA256_PATTERN.test(String(value || ""))) throw new Error(code)
}

function assertGitCommit(value: string): void {
  if (!GIT_COMMIT_PATTERN.test(String(value || ""))) {
    throw new Error("dna_evaluation_preopen_invalid_git_commit")
  }
}

function assertIsoTimestamp(value: string, code: string): void {
  const timestamp = Date.parse(String(value || ""))
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new Error(code)
  }
}

export type DnaEvaluationReleaseBindings = Readonly<{
  engineVersion: string
  engineCodeSha256: string
  catalogVersion: string
  catalogPackageSha256: string
  sourceGitCommit: string
  sourceTreeSha256: string
  lockedBenchmarkManifestSha256: string
  lockedBenchmarkPayloadSha256: string
  variationBankManifestSha256: string
  variationBankPayloadSha256: string
  developmentHistoryAuthoritySha256: string
  semanticFamilyRegistrySha256: string
  questionApprovalLedgerSha256: string
  variationApprovalLedgerSha256: string
}>

const RELEASE_BINDING_KEYS = Object.freeze([
  "engineVersion",
  "engineCodeSha256",
  "catalogVersion",
  "catalogPackageSha256",
  "sourceGitCommit",
  "sourceTreeSha256",
  "lockedBenchmarkManifestSha256",
  "lockedBenchmarkPayloadSha256",
  "variationBankManifestSha256",
  "variationBankPayloadSha256",
  "developmentHistoryAuthoritySha256",
  "semanticFamilyRegistrySha256",
  "questionApprovalLedgerSha256",
  "variationApprovalLedgerSha256",
] as const)

function assertReleaseBindings(bindings: DnaEvaluationReleaseBindings): void {
  assertExactKeys(bindings, RELEASE_BINDING_KEYS,
    "dna_evaluation_preopen_binding_unknown_or_missing_field")
  assertIdentifier(bindings.engineVersion, "dna_evaluation_preopen_invalid_engine_version")
  assertIdentifier(bindings.catalogVersion, "dna_evaluation_preopen_invalid_catalog_version")
  assertGitCommit(bindings.sourceGitCommit)
  for (const field of RELEASE_BINDING_KEYS.filter((key) => key.endsWith("Sha256"))) {
    assertSha256(bindings[field] as string, `dna_evaluation_preopen_invalid_${field}`)
  }
}

function normalizeReleaseBindings(
  bindings: DnaEvaluationReleaseBindings,
): DnaEvaluationReleaseBindings {
  assertReleaseBindings(bindings)
  return deepFreeze({ ...bindings })
}

export function dnaEvaluationReleaseBindingsSha256(
  bindings: DnaEvaluationReleaseBindings,
): string {
  return sha256(normalizeReleaseBindings(bindings))
}

export type DnaEvaluationPreOpenAuthority = Readonly<{
  schemaVersion: typeof DNA_EVALUATION_PREOPEN_AUTHORITY_VERSION
  state: "sealed_pre_open"
  authorityId: string
  sealedAt: string
  sealedBy: string
  purpose: "v3_release_evaluation"
  bindings: DnaEvaluationReleaseBindings
  bindingsSha256: string
  authoritySha256: string
}>

export function createDnaEvaluationPreOpenAuthority(input: Readonly<{
  authorityId: string
  sealedAt: string
  sealedBy: string
  bindings: DnaEvaluationReleaseBindings
}>): DnaEvaluationPreOpenAuthority {
  assertIdentifier(input.authorityId, "dna_evaluation_preopen_invalid_authority_id")
  assertIdentifier(input.sealedBy, "dna_evaluation_preopen_invalid_sealer")
  assertIsoTimestamp(input.sealedAt, "dna_evaluation_preopen_invalid_sealed_at")
  const bindings = normalizeReleaseBindings(input.bindings)
  const payload = deepFreeze({
    schemaVersion: DNA_EVALUATION_PREOPEN_AUTHORITY_VERSION,
    state: "sealed_pre_open" as const,
    authorityId: input.authorityId,
    sealedAt: input.sealedAt,
    sealedBy: input.sealedBy,
    purpose: "v3_release_evaluation" as const,
    bindings,
    bindingsSha256: sha256(bindings),
  })
  return deepFreeze({ ...payload, authoritySha256: sha256(payload) })
}

export function assertDnaEvaluationPreOpenAuthority(
  authority: DnaEvaluationPreOpenAuthority,
): void {
  assertExactKeys(authority, [
    "schemaVersion", "state", "authorityId", "sealedAt", "sealedBy", "purpose",
    "bindings", "bindingsSha256", "authoritySha256",
  ], "dna_evaluation_preopen_authority_unknown_or_missing_field")
  if (authority.schemaVersion !== DNA_EVALUATION_PREOPEN_AUTHORITY_VERSION
    || authority.state !== "sealed_pre_open"
    || authority.purpose !== "v3_release_evaluation") {
    throw new Error("dna_evaluation_preopen_authority_schema_or_state_mismatch")
  }
  assertIdentifier(authority.authorityId, "dna_evaluation_preopen_invalid_authority_id")
  assertIdentifier(authority.sealedBy, "dna_evaluation_preopen_invalid_sealer")
  assertIsoTimestamp(authority.sealedAt, "dna_evaluation_preopen_invalid_sealed_at")
  assertReleaseBindings(authority.bindings)
  assertSha256(authority.bindingsSha256, "dna_evaluation_preopen_invalid_bindings_hash")
  assertSha256(authority.authoritySha256, "dna_evaluation_preopen_invalid_authority_hash")
  const { authoritySha256, ...payload } = authority
  if (authority.bindingsSha256 !== sha256(authority.bindings)
    || authoritySha256 !== sha256(payload)) {
    throw new Error("dna_evaluation_preopen_authority_hash_mismatch")
  }
}

export type DnaEvaluationOpenReceipt = Readonly<{
  schemaVersion: typeof DNA_EVALUATION_OPEN_RECEIPT_VERSION
  receiptId: string
  authorityId: string
  authoritySha256: string
  evaluationRunId: string
  evaluatorId: string
  openedAt: string
  purpose: "v3_release_evaluation"
  observedBindingsSha256: string
  receiptSha256: string
}>

export type DnaEvaluationLifecycleEventType =
  | "sealed"
  | "opened_for_evaluation"
  | "closed_after_evaluation"

export type DnaEvaluationLifecycleEvent = Readonly<{
  schemaVersion: typeof DNA_EVALUATION_LIFECYCLE_EVENT_VERSION
  sequence: number
  eventId: string
  eventType: DnaEvaluationLifecycleEventType
  occurredAt: string
  actorId: string
  authoritySha256: string
  previousEventSha256: string | null
  receiptSha256: string | null
  reason: string
  eventSha256: string
}>

export type DnaEvaluationLifecycleLedger = Readonly<{
  schemaVersion: typeof DNA_EVALUATION_LIFECYCLE_LEDGER_VERSION
  authorityId: string
  authoritySha256: string
  events: readonly DnaEvaluationLifecycleEvent[]
  ledgerSha256: string
}>

function createLifecycleEvent(input: Readonly<{
  sequence: number
  eventId: string
  eventType: DnaEvaluationLifecycleEventType
  occurredAt: string
  actorId: string
  authoritySha256: string
  previousEventSha256: string | null
  receiptSha256: string | null
  reason: string
}>): DnaEvaluationLifecycleEvent {
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 1) {
    throw new Error("dna_evaluation_lifecycle_invalid_sequence")
  }
  assertIdentifier(input.eventId, "dna_evaluation_lifecycle_invalid_event_id")
  assertIdentifier(input.actorId, "dna_evaluation_lifecycle_invalid_actor_id")
  assertIsoTimestamp(input.occurredAt, "dna_evaluation_lifecycle_invalid_timestamp")
  assertSha256(input.authoritySha256, "dna_evaluation_lifecycle_invalid_authority_hash")
  if (input.previousEventSha256 !== null) {
    assertSha256(input.previousEventSha256,
      "dna_evaluation_lifecycle_invalid_previous_event_hash")
  }
  if (input.receiptSha256 !== null) {
    assertSha256(input.receiptSha256, "dna_evaluation_lifecycle_invalid_receipt_hash")
  }
  const reason = String(input.reason || "").trim()
  if (reason.length < 8 || reason.length > 400) {
    throw new Error("dna_evaluation_lifecycle_invalid_reason")
  }
  const payload = deepFreeze({
    schemaVersion: DNA_EVALUATION_LIFECYCLE_EVENT_VERSION,
    sequence: input.sequence,
    eventId: input.eventId,
    eventType: input.eventType,
    occurredAt: input.occurredAt,
    actorId: input.actorId,
    authoritySha256: input.authoritySha256,
    previousEventSha256: input.previousEventSha256,
    receiptSha256: input.receiptSha256,
    reason,
  })
  return deepFreeze({ ...payload, eventSha256: sha256(payload) })
}

function createLifecycleLedger(input: Readonly<{
  authorityId: string
  authoritySha256: string
  events: readonly DnaEvaluationLifecycleEvent[]
}>): DnaEvaluationLifecycleLedger {
  const payload = deepFreeze({
    schemaVersion: DNA_EVALUATION_LIFECYCLE_LEDGER_VERSION,
    authorityId: input.authorityId,
    authoritySha256: input.authoritySha256,
    events: [...input.events],
  })
  const ledger = deepFreeze({ ...payload, ledgerSha256: sha256(payload) })
  assertDnaEvaluationLifecycleLedger(ledger)
  return ledger
}

export function createDnaEvaluationLifecycleLedger(
  authority: DnaEvaluationPreOpenAuthority,
): DnaEvaluationLifecycleLedger {
  assertDnaEvaluationPreOpenAuthority(authority)
  const event = createLifecycleEvent({
    sequence: 1,
    eventId: `${authority.authorityId}:sealed`,
    eventType: "sealed",
    occurredAt: authority.sealedAt,
    actorId: authority.sealedBy,
    authoritySha256: authority.authoritySha256,
    previousEventSha256: null,
    receiptSha256: null,
    reason: "Benchmark and variation authorities sealed before evaluation access.",
  })
  return createLifecycleLedger({
    authorityId: authority.authorityId,
    authoritySha256: authority.authoritySha256,
    events: [event],
  })
}

export function assertDnaEvaluationLifecycleLedger(
  ledger: DnaEvaluationLifecycleLedger,
): void {
  assertExactKeys(ledger, [
    "schemaVersion", "authorityId", "authoritySha256", "events", "ledgerSha256",
  ], "dna_evaluation_lifecycle_ledger_unknown_or_missing_field")
  if (ledger.schemaVersion !== DNA_EVALUATION_LIFECYCLE_LEDGER_VERSION) {
    throw new Error("dna_evaluation_lifecycle_ledger_schema_mismatch")
  }
  assertIdentifier(ledger.authorityId, "dna_evaluation_lifecycle_invalid_authority_id")
  assertSha256(ledger.authoritySha256, "dna_evaluation_lifecycle_invalid_authority_hash")
  assertSha256(ledger.ledgerSha256, "dna_evaluation_lifecycle_invalid_ledger_hash")
  if (ledger.events.length < 1 || ledger.events.length > 3) {
    throw new Error("dna_evaluation_lifecycle_invalid_event_count")
  }
  const allowedSequence: readonly DnaEvaluationLifecycleEventType[] = [
    "sealed", "opened_for_evaluation", "closed_after_evaluation",
  ]
  for (const [index, event] of ledger.events.entries()) {
    assertExactKeys(event, [
      "schemaVersion", "sequence", "eventId", "eventType", "occurredAt", "actorId",
      "authoritySha256", "previousEventSha256", "receiptSha256", "reason",
      "eventSha256",
    ], "dna_evaluation_lifecycle_event_unknown_or_missing_field")
    if (event.schemaVersion !== DNA_EVALUATION_LIFECYCLE_EVENT_VERSION
      || event.sequence !== index + 1
      || event.eventType !== allowedSequence[index]
      || event.authoritySha256 !== ledger.authoritySha256
      || event.previousEventSha256 !== (ledger.events[index - 1]?.eventSha256 ?? null)) {
      throw new Error("dna_evaluation_lifecycle_event_chain_mismatch")
    }
    if (event.eventType === "opened_for_evaluation" && event.receiptSha256 === null
      || event.eventType !== "opened_for_evaluation" && event.receiptSha256 !== null) {
      throw new Error("dna_evaluation_lifecycle_receipt_binding_mismatch")
    }
    const { eventSha256, ...payload } = event
    if (eventSha256 !== sha256(payload)) {
      throw new Error("dna_evaluation_lifecycle_event_hash_mismatch")
    }
    if (index > 0 && Date.parse(event.occurredAt) < Date.parse(ledger.events[index - 1]!.occurredAt)) {
      throw new Error("dna_evaluation_lifecycle_timestamp_order_invalid")
    }
  }
  const { ledgerSha256, ...payload } = ledger
  if (ledgerSha256 !== sha256(payload)) {
    throw new Error("dna_evaluation_lifecycle_ledger_hash_mismatch")
  }
}

function assertOpenReceipt(receipt: DnaEvaluationOpenReceipt): void {
  assertExactKeys(receipt, [
    "schemaVersion", "receiptId", "authorityId", "authoritySha256", "evaluationRunId",
    "evaluatorId", "openedAt", "purpose", "observedBindingsSha256", "receiptSha256",
  ], "dna_evaluation_open_receipt_unknown_or_missing_field")
  if (receipt.schemaVersion !== DNA_EVALUATION_OPEN_RECEIPT_VERSION
    || receipt.purpose !== "v3_release_evaluation") {
    throw new Error("dna_evaluation_open_receipt_schema_or_purpose_mismatch")
  }
  for (const [value, code] of [
    [receipt.receiptId, "dna_evaluation_open_receipt_invalid_id"],
    [receipt.authorityId, "dna_evaluation_open_receipt_invalid_authority_id"],
    [receipt.evaluationRunId, "dna_evaluation_open_receipt_invalid_run_id"],
    [receipt.evaluatorId, "dna_evaluation_open_receipt_invalid_evaluator"],
  ] as const) assertIdentifier(value, code)
  assertIsoTimestamp(receipt.openedAt, "dna_evaluation_open_receipt_invalid_timestamp")
  assertSha256(receipt.authoritySha256,
    "dna_evaluation_open_receipt_invalid_authority_hash")
  assertSha256(receipt.observedBindingsSha256,
    "dna_evaluation_open_receipt_invalid_bindings_hash")
  assertSha256(receipt.receiptSha256, "dna_evaluation_open_receipt_invalid_hash")
  const { receiptSha256, ...payload } = receipt
  if (receiptSha256 !== sha256(payload)) {
    throw new Error("dna_evaluation_open_receipt_hash_mismatch")
  }
}

export function openDnaEvaluationAuthority(input: Readonly<{
  authority: DnaEvaluationPreOpenAuthority
  ledger: DnaEvaluationLifecycleLedger
  currentBindings: DnaEvaluationReleaseBindings
  receiptId: string
  evaluationRunId: string
  evaluatorId: string
  openedAt: string
}>): Readonly<{
  receipt: DnaEvaluationOpenReceipt
  ledger: DnaEvaluationLifecycleLedger
}> {
  assertDnaEvaluationPreOpenAuthority(input.authority)
  assertDnaEvaluationLifecycleLedger(input.ledger)
  if (input.ledger.authorityId !== input.authority.authorityId
    || input.ledger.authoritySha256 !== input.authority.authoritySha256
    || input.ledger.events.length !== 1
    || input.ledger.events[0]!.eventType !== "sealed") {
    throw new Error("dna_evaluation_preopen_authority_already_opened_or_ledger_mismatch")
  }
  const observedBindingsSha256 = dnaEvaluationReleaseBindingsSha256(input.currentBindings)
  if (observedBindingsSha256 !== input.authority.bindingsSha256) {
    throw new Error("dna_evaluation_preopen_observed_bindings_mismatch")
  }
  assertIdentifier(input.receiptId, "dna_evaluation_open_receipt_invalid_id")
  assertIdentifier(input.evaluationRunId, "dna_evaluation_open_receipt_invalid_run_id")
  assertIdentifier(input.evaluatorId, "dna_evaluation_open_receipt_invalid_evaluator")
  assertIsoTimestamp(input.openedAt, "dna_evaluation_open_receipt_invalid_timestamp")
  if (Date.parse(input.openedAt) < Date.parse(input.authority.sealedAt)) {
    throw new Error("dna_evaluation_open_receipt_predates_seal")
  }
  const receiptPayload = deepFreeze({
    schemaVersion: DNA_EVALUATION_OPEN_RECEIPT_VERSION,
    receiptId: input.receiptId,
    authorityId: input.authority.authorityId,
    authoritySha256: input.authority.authoritySha256,
    evaluationRunId: input.evaluationRunId,
    evaluatorId: input.evaluatorId,
    openedAt: input.openedAt,
    purpose: "v3_release_evaluation" as const,
    observedBindingsSha256,
  })
  const receipt = deepFreeze({ ...receiptPayload, receiptSha256: sha256(receiptPayload) })
  assertOpenReceipt(receipt)
  const previous = input.ledger.events.at(-1)!
  const event = createLifecycleEvent({
    sequence: 2,
    eventId: `${input.authority.authorityId}:opened`,
    eventType: "opened_for_evaluation",
    occurredAt: input.openedAt,
    actorId: input.evaluatorId,
    authoritySha256: input.authority.authoritySha256,
    previousEventSha256: previous.eventSha256,
    receiptSha256: receipt.receiptSha256,
    reason: "Sealed benchmark opened once for the bound V3 release evaluation run.",
  })
  return deepFreeze({
    receipt,
    ledger: createLifecycleLedger({
      authorityId: input.authority.authorityId,
      authoritySha256: input.authority.authoritySha256,
      events: [...input.ledger.events, event],
    }),
  })
}

export function closeDnaEvaluationAuthority(input: Readonly<{
  authority: DnaEvaluationPreOpenAuthority
  ledger: DnaEvaluationLifecycleLedger
  receipt: DnaEvaluationOpenReceipt
  closedAt: string
  closedBy: string
  reason: string
}>): DnaEvaluationLifecycleLedger {
  assertDnaEvaluationPreOpenAuthority(input.authority)
  assertDnaEvaluationLifecycleLedger(input.ledger)
  assertOpenReceipt(input.receipt)
  if (input.ledger.authorityId !== input.authority.authorityId
    || input.ledger.authoritySha256 !== input.authority.authoritySha256
    || input.receipt.authorityId !== input.authority.authorityId
    || input.receipt.authoritySha256 !== input.authority.authoritySha256
    || input.ledger.events.length !== 2
    || input.ledger.events[1]!.receiptSha256 !== input.receipt.receiptSha256) {
    throw new Error("dna_evaluation_close_authority_receipt_or_ledger_mismatch")
  }
  assertIdentifier(input.closedBy, "dna_evaluation_lifecycle_invalid_actor_id")
  assertIsoTimestamp(input.closedAt, "dna_evaluation_lifecycle_invalid_timestamp")
  if (Date.parse(input.closedAt) < Date.parse(input.receipt.openedAt)) {
    throw new Error("dna_evaluation_close_predates_open")
  }
  const previous = input.ledger.events.at(-1)!
  const event = createLifecycleEvent({
    sequence: 3,
    eventId: `${input.authority.authorityId}:closed`,
    eventType: "closed_after_evaluation",
    occurredAt: input.closedAt,
    actorId: input.closedBy,
    authoritySha256: input.authority.authoritySha256,
    previousEventSha256: previous.eventSha256,
    receiptSha256: null,
    reason: input.reason,
  })
  return createLifecycleLedger({
    authorityId: input.authority.authorityId,
    authoritySha256: input.authority.authoritySha256,
    events: [...input.ledger.events, event],
  })
}

export function assertDnaEvaluationOpenReceiptBound(input: Readonly<{
  authority: DnaEvaluationPreOpenAuthority
  ledger: DnaEvaluationLifecycleLedger
  receipt: DnaEvaluationOpenReceipt
}>): void {
  assertDnaEvaluationPreOpenAuthority(input.authority)
  assertDnaEvaluationLifecycleLedger(input.ledger)
  assertOpenReceipt(input.receipt)
  const openEvent = input.ledger.events.find((event) =>
    event.eventType === "opened_for_evaluation")
  if (!openEvent
    || input.receipt.authorityId !== input.authority.authorityId
    || input.receipt.authoritySha256 !== input.authority.authoritySha256
    || input.receipt.observedBindingsSha256 !== input.authority.bindingsSha256
    || openEvent.receiptSha256 !== input.receipt.receiptSha256
    || openEvent.occurredAt !== input.receipt.openedAt
    || openEvent.actorId !== input.receipt.evaluatorId) {
    throw new Error("dna_evaluation_open_receipt_not_bound_to_authority_and_ledger")
  }
}

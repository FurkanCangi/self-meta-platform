import { createHash } from "node:crypto"

export const DNA_CONTENT_LIFECYCLE_VERSION = "dna-content-lifecycle@1" as const
export const DNA_V2_LEGACY_LIFECYCLE_VERSION = "dna-content-lifecycle@2-legacy" as const

export const DNA_CONTENT_LIFECYCLE_STATES = [
  "pending",
  "discovered",
  "screened",
  "licence_cleared",
  "integrity_cleared",
  "acquired",
  "parsed",
  "appraised",
  "claim_extracted",
  "independently_rechecked",
  "accepted",
  "contested",
  "quarantined",
  "reference_only",
  "metadata_only",
  "restricted",
  "compiled",
  "released",
  "monitored",
  "deprecated",
  "withdrawn",
] as const

export type DnaContentLifecycleStatus =
  (typeof DNA_CONTENT_LIFECYCLE_STATES)[number]

export const DNA_V3_RELEASE_BLOCKED_STATUSES = Object.freeze([
  "pending",
  "contested",
  "quarantined",
  "reference_only",
  "metadata_only",
  "restricted",
  "deprecated",
  "withdrawn",
] as const satisfies readonly DnaContentLifecycleStatus[])

export const DNA_REQUIRED_RELEASE_PATH = Object.freeze([
  "discovered",
  "screened",
  "licence_cleared",
  "integrity_cleared",
  "acquired",
  "parsed",
  "appraised",
  "claim_extracted",
  "independently_rechecked",
  "accepted",
  "compiled",
  "released",
] as const satisfies readonly DnaContentLifecycleStatus[])

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const STABLE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{2,159}$/

const ALLOWED_TRANSITIONS = Object.freeze({
  pending: ["discovered", "quarantined", "reference_only", "metadata_only", "restricted"],
  discovered: ["screened", "quarantined", "reference_only", "metadata_only", "restricted"],
  screened: ["licence_cleared", "contested", "quarantined", "reference_only", "metadata_only", "restricted"],
  licence_cleared: ["integrity_cleared", "contested", "quarantined", "restricted"],
  integrity_cleared: ["acquired", "contested", "quarantined"],
  acquired: ["parsed", "contested", "quarantined"],
  parsed: ["appraised", "contested", "quarantined"],
  appraised: ["claim_extracted", "contested", "quarantined"],
  claim_extracted: ["independently_rechecked", "contested", "quarantined"],
  independently_rechecked: ["accepted", "contested", "quarantined"],
  accepted: ["compiled", "contested", "quarantined", "withdrawn"],
  contested: ["appraised", "quarantined", "withdrawn"],
  quarantined: ["screened", "withdrawn"],
  reference_only: ["screened", "withdrawn"],
  metadata_only: ["screened", "withdrawn"],
  restricted: ["screened", "withdrawn"],
  compiled: ["released", "contested", "quarantined", "withdrawn"],
  released: ["monitored", "deprecated", "withdrawn"],
  monitored: ["released", "deprecated", "withdrawn"],
  deprecated: ["withdrawn"],
  withdrawn: [],
} as const satisfies Readonly<Record<
  DnaContentLifecycleStatus,
  readonly DnaContentLifecycleStatus[]
>>)

for (const transitions of Object.values(ALLOWED_TRANSITIONS)) {
  Object.freeze(transitions)
}

export type DnaLifecycleContentKind = "source" | "claim" | "passage" | "component"

export type DnaLifecycleEvent = Readonly<{
  schemaVersion: typeof DNA_CONTENT_LIFECYCLE_VERSION
  eventId: string
  contentId: string
  contentKind: DnaLifecycleContentKind
  sequence: number
  fromStatus: DnaContentLifecycleStatus | null
  toStatus: DnaContentLifecycleStatus
  occurredAt: string
  actorId: string
  reasonCode: string
  evidenceSha256: string
  contentSha256: string
  previousEventHash: string | null
  eventHash: string
}>

export type DnaContentLifecycleRecord = Readonly<{
  schemaVersion: typeof DNA_CONTENT_LIFECYCLE_VERSION
  generation: "v3"
  contentId: string
  contentKind: DnaLifecycleContentKind
  contentSha256: string
  status: DnaContentLifecycleStatus
  events: readonly DnaLifecycleEvent[]
  headEventHash: string
}>

export type DnaV2LegacyLifecycleRecord = Readonly<{
  schemaVersion: typeof DNA_V2_LEGACY_LIFECYCLE_VERSION
  generation: "v2_legacy"
  contentId: string
  legacyStatus: string
  releaseEligibleInV3: false
}>

export const DNA_CONTENT_LIFECYCLE_CONTRACT = Object.freeze({
  schemaVersion: DNA_CONTENT_LIFECYCLE_VERSION,
  states: Object.freeze([...DNA_CONTENT_LIFECYCLE_STATES]),
  requiredReleasePath: DNA_REQUIRED_RELEASE_PATH,
  allowedTransitions: ALLOWED_TRANSITIONS,
  releaseEligibleStatus: "released",
  blockedStatuses: DNA_V3_RELEASE_BLOCKED_STATUSES,
  eventIntegrity: "append_only_sha256_hash_chain",
  v2Disposition: "legacy_not_v3_release",
})

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const object = value as Record<string, unknown>
  return `{${Object.keys(object).sort().map((key) =>
    `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

function requireStableId(value: string, field: string): string {
  const normalized = String(value || "").trim()
  if (!STABLE_ID_PATTERN.test(normalized)) {
    throw new Error(`dna_lifecycle_invalid_${field}`)
  }
  return normalized
}

function requireSha256(value: string, field: string): string {
  const normalized = String(value || "").trim().toLowerCase()
  if (!SHA256_PATTERN.test(normalized)) {
    throw new Error(`dna_lifecycle_invalid_${field}`)
  }
  return normalized
}

function requireIsoTimestamp(value: string): string {
  const normalized = String(value || "").trim()
  const timestamp = Date.parse(normalized)
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== normalized) {
    throw new Error("dna_lifecycle_invalid_occurred_at")
  }
  return normalized
}

function eventHash(event: Omit<DnaLifecycleEvent, "eventHash">): string {
  return sha256(stableJson(event))
}

function freezeEvent(event: DnaLifecycleEvent): DnaLifecycleEvent {
  return Object.freeze({ ...event })
}

function createEvent(input: {
  eventId: string
  contentId: string
  contentKind: DnaLifecycleContentKind
  sequence: number
  fromStatus: DnaContentLifecycleStatus | null
  toStatus: DnaContentLifecycleStatus
  occurredAt: string
  actorId: string
  reasonCode: string
  evidenceSha256: string
  contentSha256: string
  previousEventHash: string | null
}): DnaLifecycleEvent {
  const core: Omit<DnaLifecycleEvent, "eventHash"> = {
    schemaVersion: DNA_CONTENT_LIFECYCLE_VERSION,
    eventId: requireStableId(input.eventId, "event_id"),
    contentId: requireStableId(input.contentId, "content_id"),
    contentKind: input.contentKind,
    sequence: input.sequence,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    occurredAt: requireIsoTimestamp(input.occurredAt),
    actorId: requireStableId(input.actorId, "actor_id"),
    reasonCode: requireStableId(input.reasonCode, "reason_code"),
    evidenceSha256: requireSha256(input.evidenceSha256, "evidence_sha256"),
    contentSha256: requireSha256(input.contentSha256, "content_sha256"),
    previousEventHash: input.previousEventHash,
  }
  if (!Number.isSafeInteger(core.sequence) || core.sequence < 0) {
    throw new Error("dna_lifecycle_invalid_sequence")
  }
  return freezeEvent({ ...core, eventHash: eventHash(core) })
}

export function isDnaLifecycleTransitionAllowed(
  from: DnaContentLifecycleStatus,
  to: DnaContentLifecycleStatus,
): boolean {
  return (ALLOWED_TRANSITIONS[from] as readonly DnaContentLifecycleStatus[]).includes(to)
}

export function createDnaContentLifecycleRecord(input: {
  contentId: string
  contentKind: DnaLifecycleContentKind
  contentSha256: string
  eventId: string
  occurredAt: string
  actorId: string
  evidenceSha256: string
}): DnaContentLifecycleRecord {
  const contentId = requireStableId(input.contentId, "content_id")
  const contentSha256 = requireSha256(input.contentSha256, "content_sha256")
  const genesis = createEvent({
    eventId: input.eventId,
    contentId,
    contentKind: input.contentKind,
    sequence: 0,
    fromStatus: null,
    toStatus: "discovered",
    occurredAt: input.occurredAt,
    actorId: input.actorId,
    reasonCode: "content.discovered",
    evidenceSha256: input.evidenceSha256,
    contentSha256,
    previousEventHash: null,
  })
  return Object.freeze({
    schemaVersion: DNA_CONTENT_LIFECYCLE_VERSION,
    generation: "v3",
    contentId,
    contentKind: input.contentKind,
    contentSha256,
    status: "discovered",
    events: Object.freeze([genesis]),
    headEventHash: genesis.eventHash,
  })
}

export function appendDnaLifecycleTransition(
  record: DnaContentLifecycleRecord,
  input: {
    toStatus: DnaContentLifecycleStatus
    eventId: string
    occurredAt: string
    actorId: string
    reasonCode: string
    evidenceSha256: string
  },
): DnaContentLifecycleRecord {
  if (!verifyDnaLifecycleEventChain(record)) {
    throw new Error("dna_lifecycle_invalid_existing_chain")
  }
  if (!isDnaLifecycleTransitionAllowed(record.status, input.toStatus)) {
    throw new Error(`dna_lifecycle_transition_not_allowed_${record.status}_to_${input.toStatus}`)
  }
  const previous = record.events[record.events.length - 1]
  const occurredAt = requireIsoTimestamp(input.occurredAt)
  if (Date.parse(occurredAt) < Date.parse(previous.occurredAt)) {
    throw new Error("dna_lifecycle_timestamp_regression")
  }
  const next = createEvent({
    eventId: input.eventId,
    contentId: record.contentId,
    contentKind: record.contentKind,
    sequence: record.events.length,
    fromStatus: record.status,
    toStatus: input.toStatus,
    occurredAt,
    actorId: input.actorId,
    reasonCode: input.reasonCode,
    evidenceSha256: input.evidenceSha256,
    contentSha256: record.contentSha256,
    previousEventHash: record.headEventHash,
  })
  const events = Object.freeze([...record.events, next])
  return Object.freeze({
    ...record,
    status: input.toStatus,
    events,
    headEventHash: next.eventHash,
  })
}

export function verifyDnaLifecycleEventChain(
  record: DnaContentLifecycleRecord,
): boolean {
  try {
    if (
      record.schemaVersion !== DNA_CONTENT_LIFECYCLE_VERSION ||
      record.generation !== "v3" ||
      !SHA256_PATTERN.test(record.contentSha256) ||
      record.events.length === 0
    ) return false
    const eventIds = new Set<string>()
    for (let index = 0; index < record.events.length; index += 1) {
      const event = record.events[index]
      if (
        event.schemaVersion !== DNA_CONTENT_LIFECYCLE_VERSION ||
        event.contentId !== record.contentId ||
        event.contentKind !== record.contentKind ||
        event.contentSha256 !== record.contentSha256 ||
        event.sequence !== index ||
        eventIds.has(event.eventId) ||
        event.eventHash !== eventHash({
          schemaVersion: event.schemaVersion,
          eventId: event.eventId,
          contentId: event.contentId,
          contentKind: event.contentKind,
          sequence: event.sequence,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          occurredAt: event.occurredAt,
          actorId: event.actorId,
          reasonCode: event.reasonCode,
          evidenceSha256: event.evidenceSha256,
          contentSha256: event.contentSha256,
          previousEventHash: event.previousEventHash,
        })
      ) return false
      eventIds.add(event.eventId)
      if (index === 0) {
        if (
          event.fromStatus !== null ||
          event.toStatus !== "discovered" ||
          event.previousEventHash !== null
        ) return false
      } else {
        const previous = record.events[index - 1]
        if (
          event.fromStatus !== previous.toStatus ||
          event.previousEventHash !== previous.eventHash ||
          !isDnaLifecycleTransitionAllowed(previous.toStatus, event.toStatus) ||
          Date.parse(event.occurredAt) < Date.parse(previous.occurredAt)
        ) return false
      }
    }
    const head = record.events[record.events.length - 1]
    return record.status === head.toStatus && record.headEventHash === head.eventHash
  } catch {
    return false
  }
}

function hasRequiredReleasePath(record: DnaContentLifecycleRecord): boolean {
  const visited = record.events.map((event) => event.toStatus)
  let cursor = 0
  for (const status of visited) {
    if (status === DNA_REQUIRED_RELEASE_PATH[cursor]) cursor += 1
    if (cursor === DNA_REQUIRED_RELEASE_PATH.length) return true
  }
  return false
}

export function isV3ContentReleaseEligible(
  record: DnaContentLifecycleRecord | DnaV2LegacyLifecycleRecord | null | undefined,
): record is DnaContentLifecycleRecord {
  return Boolean(
    record &&
    record.schemaVersion === DNA_CONTENT_LIFECYCLE_VERSION &&
    record.generation === "v3" &&
    record.status === "released" &&
    !DNA_V3_RELEASE_BLOCKED_STATUSES.includes(record.status as never) &&
    verifyDnaLifecycleEventChain(record as DnaContentLifecycleRecord) &&
    hasRequiredReleasePath(record as DnaContentLifecycleRecord),
  )
}

export function createV2LegacyLifecycleRecord(input: {
  contentId: string
  legacyStatus: string
}): DnaV2LegacyLifecycleRecord {
  return Object.freeze({
    schemaVersion: DNA_V2_LEGACY_LIFECYCLE_VERSION,
    generation: "v2_legacy",
    contentId: requireStableId(input.contentId, "content_id"),
    legacyStatus: String(input.legacyStatus || "unknown"),
    releaseEligibleInV3: false,
  })
}

import { createHash } from "node:crypto"

import {
  createDnaChatSafeCaseContext,
  dnaCaseContextPayloadSha256,
} from "./caseContext"
import {
  DNA_CHAT_DOMAIN_KEYS,
  type DnaChatCaseContextInput,
  type DnaChatDomainKey,
  type DnaChatDomainLevel,
  type DnaChatSafeCaseContext,
} from "./types"

export const DNA_OWNED_CASE_CONTEXT_VERSION = "dna-chat-context@1" as const
export const DNA_OWNED_CASE_LINEAGE_VERSION =
  "report-assessment-client-owner-chain@2" as const
export const DNA_OWNED_CASE_SNAPSHOT_GENERATIONS = Object.freeze([
  "dna_chat_context_v1",
  "structured_basic_v0",
  "legacy_camelcase_v0",
] as const)
export type DnaOwnedCaseSnapshotGeneration =
  (typeof DNA_OWNED_CASE_SNAPSHOT_GENERATIONS)[number]
export type DnaOwnedCaseContextKind = "modern" | "basic" | "legacy"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SAFE_LEVELS = new Set<DnaChatDomainLevel>(["Tipik", "Riskli", "Atipik"])

const DOMAIN_LABELS: Record<DnaChatDomainKey, string> = {
  physiological: "Fizyolojik regülasyon",
  sensory: "Duyusal regülasyon",
  emotional: "Duygusal regülasyon",
  cognitive: "Bilişsel regülasyon",
  executive: "Yürütücü işlev",
  interoception: "İnterosepsiyon",
}

type JsonRecord = Record<string, unknown>

export type DnaOwnedCaseVerifiedChain = Readonly<{
  reportId: string
  loadedReportId: string
  assessmentId: string
  loadedAssessmentId: string
  clientId: string
  loadedClientId: string
  ownerId: string
  sessionUserId: string
}>

export type DnaOwnedCasePrivateProvenance = Readonly<{
  lineageVersion: typeof DNA_OWNED_CASE_LINEAGE_VERSION
  contextVersion: typeof DNA_OWNED_CASE_CONTEXT_VERSION
  sourcePayloadSha256: string
  safeContextSha256: string
  lineageBindingSha256: string
  contextKind: DnaOwnedCaseContextKind
  snapshotGeneration: DnaOwnedCaseSnapshotGeneration
}>

export type DnaCanonicalOwnedCaseContext = Readonly<{
  context: DnaChatSafeCaseContext
  provenance: DnaOwnedCasePrivateProvenance
}>

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {}
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value as JsonRecord)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  )
}

function sha256(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex")
}

function domainValue(source: JsonRecord, canonical: string, legacy: string): unknown {
  return source[canonical] ?? source[legacy]
}

function snapshotGeneration(snapshotValue: unknown): Readonly<{
  contextKind: DnaOwnedCaseContextKind
  snapshotGeneration: DnaOwnedCaseSnapshotGeneration
}> {
  const snapshot = asRecord(snapshotValue)
  const chatContext = asRecord(snapshot.chat_context)
  if (chatContext.version === DNA_OWNED_CASE_CONTEXT_VERSION) {
    return Object.freeze({
      contextKind: "modern",
      snapshotGeneration: "dna_chat_context_v1",
    })
  }
  if (Object.prototype.hasOwnProperty.call(snapshot, "ageMonths")
    || Object.prototype.hasOwnProperty.call(snapshot, "domainLevels")) {
    return Object.freeze({
      contextKind: "legacy",
      snapshotGeneration: "legacy_camelcase_v0",
    })
  }
  return Object.freeze({
    contextKind: "basic",
    snapshotGeneration: "structured_basic_v0",
  })
}

function structuredPayloadFromSnapshot(snapshotValue: unknown) {
  const snapshot = asRecord(snapshotValue)
  const scoresSource = asRecord(snapshot.scores)
  const levelsSource = asRecord(snapshot.domain_levels ?? snapshot.domainLevels)
  const scores: Partial<Record<DnaChatDomainKey, number>> = {}
  const levels: Partial<Record<DnaChatDomainKey, DnaChatDomainLevel>> = {}
  const legacyKeys: Record<DnaChatDomainKey, string> = {
    physiological: "fizyolojik",
    sensory: "duyusal",
    emotional: "duygusal",
    cognitive: "bilissel",
    executive: "yurutucu",
    interoception: "intero",
  }

  for (const domain of DNA_CHAT_DOMAIN_KEYS) {
    const score = finiteNumber(domainValue(scoresSource, domain, legacyKeys[domain]))
    if (score !== null && score >= 0 && score <= 50) {
      scores[domain] = Number(score.toFixed(2))
    }
    const level = domainValue(levelsSource, domain, legacyKeys[domain])
    if (typeof level === "string" && SAFE_LEVELS.has(level as DnaChatDomainLevel)) {
      levels[domain] = level as DnaChatDomainLevel
    }
  }

  const rawAge = finiteNumber(snapshot.age_months ?? snapshot.ageMonths)
  const ageMonths = rawAge !== null && rawAge >= 0 && rawAge <= 216
    ? Math.round(rawAge)
    : null

  return Object.freeze({
    ageMonths,
    scores: Object.freeze(scores),
    levels: Object.freeze(levels),
  })
}

function canonicalCaseInputFromStructured(
  payload: ReturnType<typeof structuredPayloadFromSnapshot>,
): DnaChatCaseContextInput {
  const rows = DNA_CHAT_DOMAIN_KEYS.flatMap((domain) => {
    const score = payload.scores[domain]
    const level = payload.levels[domain]
    return score === undefined && !level
      ? []
      : [{ domain, label: DOMAIN_LABELS[domain], score, level }]
  })
  const ranked = [...rows].sort((left, right) =>
    Number(right.level === "Atipik") - Number(left.level === "Atipik") ||
    Number(right.level === "Riskli") - Number(left.level === "Riskli") ||
    Number(left.score ?? Number.POSITIVE_INFINITY) - Number(right.score ?? Number.POSITIVE_INFINITY) ||
    left.domain.localeCompare(right.domain))
  const nonTypical = ranked.filter((row) => row.level === "Riskli" || row.level === "Atipik")
  const typical = ranked.filter((row) => row.level === "Tipik")
  const primary = nonTypical[0] ?? ranked[0] ?? null
  const evidenceRows = (nonTypical.length ? nonTypical : ranked.slice(0, 2)).slice(0, 5)
  const domainLine = (row: (typeof rows)[number]) => {
    const values = [row.score === undefined ? "" : `${row.score}/50`, row.level ?? ""]
      .filter(Boolean)
    return `${row.label} alanı${values.length ? `: ${values.join(", ")}` : ""}.`
  }

  return {
    dataStatus: "deidentified",
    ageMonths: payload.ageMonths,
    scores: payload.scores,
    levels: payload.levels,
    chatContext: {
      primaryAxis: primary
        ? `${primary.label} alanında göreli ${(primary.level ?? "yapılandırılmış").toLocaleLowerCase("tr-TR")} örüntü`
        : null,
      secondaryAxes: nonTypical
        .filter((row) => row.domain !== primary?.domain)
        .slice(0, 4)
        .map((row) => row.label),
      caseEvidenceLines: evidenceRows.map(domainLine),
      counterEvidenceLines: typical.slice(0, 4).map((row) =>
        `${row.label} alanındaki Tipik düzey, bulgunun tüm alanlara genellenmesini sınırlar.`),
      preservedCapacityLines: typical.slice(0, 4).map((row) =>
        `${row.label} alanı${row.score === undefined ? "" : ` ${row.score}/50 ve`} Tipik düzeyde kayıtlıdır.`),
      dataLimitations: [
        "Vaka sohbet bağlamı yalnız yapılandırılmış alan skoru ve düzeylerinden kanonik olarak oluşturuldu.",
        "Ham yanıt, anamnez, terapist notu, serbest rapor metni ve dahili iz veya kural kaydı bu bağlama alınmadı.",
        ...(rows.length < DNA_CHAT_DOMAIN_KEYS.length
          ? ["Bazı alanların yapılandırılmış skor veya düzey kaydı bulunmadığı için vaka özeti sınırlıdır."]
          : []),
      ],
      confidenceLevel: null,
      confidenceRationale: null,
      weakDomains: nonTypical.slice(0, 6).map((row) => row.label),
      strongDomains: typical.slice(0, 6).map((row) => row.label),
      patterns: [],
    },
  }
}

function assertVerifiedChain(chain: DnaOwnedCaseVerifiedChain): void {
  const ids = [
    chain.reportId,
    chain.loadedReportId,
    chain.assessmentId,
    chain.loadedAssessmentId,
    chain.clientId,
    chain.loadedClientId,
    chain.ownerId,
    chain.sessionUserId,
  ]
  if (
    ids.some((value) => !UUID_PATTERN.test(value)) ||
    chain.reportId !== chain.loadedReportId ||
    chain.assessmentId !== chain.loadedAssessmentId ||
    chain.clientId !== chain.loadedClientId ||
    chain.ownerId !== chain.sessionUserId
  ) {
    throw new Error("dna_chat_owned_report_lineage_not_verified")
  }
}

/**
 * Converts an owned report snapshot into the only release-capable case input.
 * Free-text `chat_context`, report prose, anamnesis and trace fields are ignored
 * by construction; only enumerated scores, levels and age are accepted.
 */
export function createCanonicalOwnedDnaCaseContext(
  snapshotValue: unknown,
  chain: DnaOwnedCaseVerifiedChain,
): DnaCanonicalOwnedCaseContext {
  assertVerifiedChain(chain)
  const generation = snapshotGeneration(snapshotValue)
  const structuredPayload = structuredPayloadFromSnapshot(snapshotValue)
  const sourcePayloadSha256 = sha256({ generation, structuredPayload })
  const context = createDnaChatSafeCaseContext(
    canonicalCaseInputFromStructured(structuredPayload),
  )
  if (context.redactionCount > 0 || context.unsafeClaimCount > 0) {
    throw new Error("dna_chat_owned_report_context_not_canonical")
  }
  const safeContextSha256 = dnaCaseContextPayloadSha256(context)
  const lineageBindingSha256 = sha256({
    lineageVersion: DNA_OWNED_CASE_LINEAGE_VERSION,
    contextVersion: DNA_OWNED_CASE_CONTEXT_VERSION,
    reportId: chain.reportId,
    assessmentId: chain.assessmentId,
    clientId: chain.clientId,
    ownerId: chain.ownerId,
    sourcePayloadSha256,
    safeContextSha256,
    contextKind: generation.contextKind,
    snapshotGeneration: generation.snapshotGeneration,
  })
  return Object.freeze({
    context,
    provenance: Object.freeze({
      lineageVersion: DNA_OWNED_CASE_LINEAGE_VERSION,
      contextVersion: DNA_OWNED_CASE_CONTEXT_VERSION,
      sourcePayloadSha256,
      safeContextSha256,
      lineageBindingSha256,
      contextKind: generation.contextKind,
      snapshotGeneration: generation.snapshotGeneration,
    }),
  })
}

import { normalizeDnaChatText } from "../text"
import type { DnaS13Claim, DnaS13Realization, DnaS13RequiredAnswerSlot } from "./contracts"

export const DNA_S13_VALIDATOR_VERSION = "dna-s13-validator@1" as const

export const DNA_S13_VALIDATION_FAILURES = [
  "unsupported_addition_declared",
  "unknown_claim",
  "unknown_source",
  "claim_source_mismatch",
  "unknown_slot",
  "required_slot_uncovered",
  "required_claim_missing",
  "invented_number",
  "age_scope_changed",
  "negation_changed",
  "causality_escalated",
  "epistemic_force_escalated",
  "unaligned_factual_sentence",
] as const

export type DnaS13ValidationFailure = typeof DNA_S13_VALIDATION_FAILURES[number]
export type DnaS13ValidationResult = Readonly<{
  pass: boolean
  failureCodes: readonly DnaS13ValidationFailure[]
  slotCoveragePercent: number
  sentenceCoveragePercent: number
}>

const DISCOURSE = new Set(["ayrica", "kisaca", "temelde", "bunun", "yaninda", "bakildiginda", "acisindan", "olarak"])
const AGE_TERMS = ["bebek", "cocuk", "ergen", "yetiskin", "yasli", "okul oncesi"] as const
const CAUSALITY = ["neden olur", "yol acar", "sonuc verir", "dogrudan belirler", "tetikler"] as const
const EPISTEMIC_FORCE = ["kanitlar", "kesindir", "daima", "her zaman", "zorunludur"] as const

function tokens(value: string) {
  return normalizeDnaChatText(value)
    .split(" ")
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
    .filter((token) => token.length >= 3 && !DISCOURSE.has(token))
}

function numbers(value: string) {
  return new Set(value.match(/\b\d+(?:[.,]\d+)?\b/g) ?? [])
}

function markerSet(value: string, markers: readonly string[]) {
  const normalized = normalizeDnaChatText(value)
  return new Set(markers.filter((marker) => normalized.includes(normalizeDnaChatText(marker))))
}

function negationCount(value: string) {
  const normalized = normalizeDnaChatText(value)
  return (normalized.match(/\b(?:degil\w*|yok\w*|olamaz\w*|kanitlamaz\w*|gostermez\w*|cikarilamaz\w*)\b/g) ?? []).length
}

function sentenceAligned(sentence: string, claims: readonly DnaS13Claim[]) {
  const sentenceTokens = tokens(sentence)
  if (sentenceTokens.length <= 3) return true
  return claims.some((claim) => {
    const claimTokens = new Set(tokens(claim.text))
    const shared = sentenceTokens.filter((token) => claimTokens.has(token)).length
    return shared / sentenceTokens.length >= 0.3 || shared >= Math.min(5, sentenceTokens.length)
  })
}

export function validateDnaS13GroundedRealization(input: Readonly<{
  realization: DnaS13Realization
  claims: readonly DnaS13Claim[]
  slots: readonly DnaS13RequiredAnswerSlot[]
}>): DnaS13ValidationResult {
  const failures = new Set<DnaS13ValidationFailure>()
  const claimById = new Map(input.claims.map((claim) => [claim.id, claim]))
  const slotById = new Map(input.slots.map((slot) => [slot.id, slot]))
  if (input.realization.unsupportedAddition) failures.add("unsupported_addition_declared")
  if (input.realization.usedClaimIds.some((id) => !claimById.has(id))) failures.add("unknown_claim")
  if (input.realization.coveredSlots.some((id) => !slotById.has(id))) failures.add("unknown_slot")

  const usedClaims = input.realization.usedClaimIds.flatMap((id) => {
    const claim = claimById.get(id)
    return claim ? [claim] : []
  })
  const allowedSources = new Set(usedClaims.flatMap((claim) => claim.sourceIds))
  if (input.realization.usedSourceIds.some((id) => !allowedSources.has(id))) failures.add("unknown_source")
  if (usedClaims.some((claim) => !claim.sourceIds.some((sourceId) => input.realization.usedSourceIds.includes(sourceId)))) {
    failures.add("claim_source_mismatch")
  }

  const covered = new Set(input.realization.coveredSlots)
  const requiredSlots = input.slots.filter((slot) => slot.answerability === "supported" || slot.requiredClaimIds.length > 0)
  for (const slot of requiredSlots) {
    if (!covered.has(slot.id)) failures.add("required_slot_uncovered")
    if (slot.requiredClaimIds.length && !slot.requiredClaimIds.some((id) => input.realization.usedClaimIds.includes(id))) {
      failures.add("required_claim_missing")
    }
  }

  const evidenceText = usedClaims.map((claim) => claim.text).join(" ")
  const evidenceNumbers = numbers(evidenceText)
  if ([...numbers(input.realization.answer)].some((value) => !evidenceNumbers.has(value))) failures.add("invented_number")
  const evidenceAge = markerSet(evidenceText, AGE_TERMS)
  if ([...markerSet(input.realization.answer, AGE_TERMS)].some((value) => !evidenceAge.has(value))) failures.add("age_scope_changed")
  if (negationCount(input.realization.answer) !== negationCount(evidenceText)) failures.add("negation_changed")
  for (const [markers, code] of [[CAUSALITY, "causality_escalated"], [EPISTEMIC_FORCE, "epistemic_force_escalated"]] as const) {
    const source = markerSet(evidenceText, markers)
    if ([...markerSet(input.realization.answer, markers)].some((value) => !source.has(value))) failures.add(code)
  }

  const sentences = input.realization.answer.split(/(?<=[.!?])\s+/u).map((value) => value.trim()).filter(Boolean)
  const aligned = sentences.filter((sentence) => sentenceAligned(sentence, usedClaims)).length
  if (sentences.length && aligned !== sentences.length) failures.add("unaligned_factual_sentence")
  const slotCoveragePercent = requiredSlots.length
    ? Math.round((requiredSlots.filter((slot) => covered.has(slot.id)).length / requiredSlots.length) * 100)
    : 100
  return Object.freeze({
    pass: failures.size === 0,
    failureCodes: Object.freeze([...failures].sort()),
    slotCoveragePercent,
    sentenceCoveragePercent: sentences.length ? Math.round((aligned / sentences.length) * 100) : 100,
  })
}

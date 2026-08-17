import { DNA_OWNER_BOOK_CHAT_AUTHORITY } from "../../knowledgeAuthority"

export const DNA_S13_LIMITED_RESPONSE_SCHEMA_VERSION = "dna-s13-limited-response@1" as const
export const DNA_S13_LIMITED_RESPONSE_ROUTE = "s13_limited_rollout" as const
export const DNA_S13_LIMITED_ROLLOUT_RELEASE_VERSION =
  "dna-v1-s13v4-contextv1-limited-rc1.2" as const
export const DNA_S13_LIMITED_OWNER_BOOK_SOURCE_ID = DNA_OWNER_BOOK_CHAT_AUTHORITY.proof.sourceId
export const DNA_S13_LIMITED_OWNER_BOOK_AUTHORITY = DNA_OWNER_BOOK_CHAT_AUTHORITY

export type DnaS13LimitedResponseContract = Readonly<{
  schemaVersion: typeof DNA_S13_LIMITED_RESPONSE_SCHEMA_VERSION
  route: typeof DNA_S13_LIMITED_RESPONSE_ROUTE
  releaseVersion: typeof DNA_S13_LIMITED_ROLLOUT_RELEASE_VERSION
  releaseHash: string
  limitedRolloutEligible: boolean
  validatorPass: boolean
  displayEligible: boolean
  privacyPass: boolean
  privacyCategory: string
  realizationStatus: "accepted" | "repaired" | "rejected" | "fallback"
  lockedPlanFallback: boolean
  lockedPlanTopicIds: readonly string[]
  validatorFailureCodes: readonly string[]
  unsupportedFactualAdditionCount: number
  unsupportedRelationCount: number
  sourceViolationCount: number
  safetyViolationCount: number
  trainingCandidate: false
  automaticTrainingUse: "prohibited"
}>

const SHA256 = /^[a-f0-9]{64}$/u
const SAFE_CODE = /^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{0,159}$/u

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function finiteNonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function safeFailureCodes(value: unknown): value is readonly string[] {
  return Array.isArray(value)
    && value.length <= 24
    && value.every((entry) => typeof entry === "string" && SAFE_CODE.test(entry))
}

export function createDnaS13LimitedResponseContract(input: Readonly<{
  releaseHash: string
  limitedRolloutEligible: boolean
  validatorPass: boolean
  displayEligible: boolean
  privacyPass: boolean
  privacyCategory: string
  realizationStatus: DnaS13LimitedResponseContract["realizationStatus"]
  lockedPlanFallback: boolean
  lockedPlanTopicIds: readonly string[]
  validatorFailureCodes?: readonly string[]
  unsupportedFactualAdditionCount?: number
  unsupportedRelationCount?: number
  sourceViolationCount?: number
  safetyViolationCount?: number
}>): DnaS13LimitedResponseContract {
  return Object.freeze({
    schemaVersion: DNA_S13_LIMITED_RESPONSE_SCHEMA_VERSION,
    route: DNA_S13_LIMITED_RESPONSE_ROUTE,
    releaseVersion: DNA_S13_LIMITED_ROLLOUT_RELEASE_VERSION,
    releaseHash: input.releaseHash,
    limitedRolloutEligible: input.limitedRolloutEligible,
    validatorPass: input.validatorPass,
    displayEligible: input.displayEligible,
    privacyPass: input.privacyPass,
    privacyCategory: input.privacyCategory,
    realizationStatus: input.realizationStatus,
    lockedPlanFallback: input.lockedPlanFallback,
    lockedPlanTopicIds: Object.freeze([...input.lockedPlanTopicIds]),
    validatorFailureCodes: Object.freeze([...(input.validatorFailureCodes ?? [])]),
    unsupportedFactualAdditionCount: input.unsupportedFactualAdditionCount ?? 0,
    unsupportedRelationCount: input.unsupportedRelationCount ?? 0,
    sourceViolationCount: input.sourceViolationCount ?? 0,
    safetyViolationCount: input.safetyViolationCount ?? 0,
    trainingCandidate: false,
    automaticTrainingUse: "prohibited",
  })
}

export function validateDnaS13LimitedResponseContract(
  input: unknown,
): DnaS13LimitedResponseContract | null {
  if (!isRecord(input)) return null
  const row = input as unknown as DnaS13LimitedResponseContract
  if (row.schemaVersion !== DNA_S13_LIMITED_RESPONSE_SCHEMA_VERSION
    || row.route !== DNA_S13_LIMITED_RESPONSE_ROUTE
    || row.releaseVersion !== DNA_S13_LIMITED_ROLLOUT_RELEASE_VERSION
    || !SHA256.test(row.releaseHash)
    || typeof row.limitedRolloutEligible !== "boolean"
    || typeof row.validatorPass !== "boolean"
    || typeof row.displayEligible !== "boolean"
    || typeof row.privacyPass !== "boolean"
    || typeof row.privacyCategory !== "string"
    || !SAFE_CODE.test(row.privacyCategory)
    || !["accepted", "repaired", "rejected", "fallback"].includes(row.realizationStatus)
    || typeof row.lockedPlanFallback !== "boolean"
    || row.lockedPlanFallback !== (row.realizationStatus === "fallback")
    || !safeFailureCodes(row.lockedPlanTopicIds)
    || row.lockedPlanTopicIds.length < 1
    || row.lockedPlanTopicIds.length > 2
    || !safeFailureCodes(row.validatorFailureCodes)
    || !finiteNonNegativeInteger(row.unsupportedFactualAdditionCount)
    || !finiteNonNegativeInteger(row.unsupportedRelationCount)
    || !finiteNonNegativeInteger(row.sourceViolationCount)
    || !finiteNonNegativeInteger(row.safetyViolationCount)
    || row.trainingCandidate !== false
    || row.automaticTrainingUse !== "prohibited") return null
  return Object.freeze(row)
}

export function isDnaS13LimitedResponseDisplayEligible(input: unknown) {
  const contract = validateDnaS13LimitedResponseContract(input)
  return Boolean(contract
    && contract.limitedRolloutEligible
    && contract.validatorPass
    && contract.displayEligible
    && contract.privacyPass
    && contract.privacyCategory === "general_non_sensitive"
    && (["accepted", "repaired"].includes(contract.realizationStatus)
      || (contract.realizationStatus === "fallback" && contract.lockedPlanFallback))
    && contract.validatorFailureCodes.length === 0
    && contract.unsupportedFactualAdditionCount === 0
    && contract.unsupportedRelationCount === 0
    && contract.sourceViolationCount === 0
    && contract.safetyViolationCount === 0
    && contract.trainingCandidate === false
    && contract.automaticTrainingUse === "prohibited")
}

export function isDnaS13LimitedOwnerBookAuthority(input: unknown) {
  if (!isRecord(input)) return false
  const proof = input.proof
  return isRecord(proof)
    && Object.keys(input).length === Object.keys(DNA_S13_LIMITED_OWNER_BOOK_AUTHORITY).length
    && Object.keys(proof).length === Object.keys(DNA_S13_LIMITED_OWNER_BOOK_AUTHORITY.proof).length
    && input.contractVersion === DNA_S13_LIMITED_OWNER_BOOK_AUTHORITY.contractVersion
    && input.layer === DNA_S13_LIMITED_OWNER_BOOK_AUTHORITY.layer
    && input.approvalRequirement === DNA_S13_LIMITED_OWNER_BOOK_AUTHORITY.approvalRequirement
    && input.verificationStatus === DNA_S13_LIMITED_OWNER_BOOK_AUTHORITY.verificationStatus
    && input.releaseEligible === DNA_S13_LIMITED_OWNER_BOOK_AUTHORITY.releaseEligible
    && input.labelTr === DNA_S13_LIMITED_OWNER_BOOK_AUTHORITY.labelTr
    && input.boundaryTr === DNA_S13_LIMITED_OWNER_BOOK_AUTHORITY.boundaryTr
    && proof.kind === DNA_S13_LIMITED_OWNER_BOOK_AUTHORITY.proof.kind
    && proof.approvalRecordId === DNA_S13_LIMITED_OWNER_BOOK_AUTHORITY.proof.approvalRecordId
    && proof.bookVersion === DNA_S13_LIMITED_OWNER_BOOK_AUTHORITY.proof.bookVersion
    && proof.bookSha256 === DNA_S13_LIMITED_OWNER_BOOK_AUTHORITY.proof.bookSha256
    && proof.sourceId === DNA_S13_LIMITED_OWNER_BOOK_AUTHORITY.proof.sourceId
    && proof.citationMappingStatus === DNA_S13_LIMITED_OWNER_BOOK_AUTHORITY.proof.citationMappingStatus
}

export function validateDnaS13LimitedPublicResponse(input: unknown) {
  if (!isRecord(input)) return null
  const contract = validateDnaS13LimitedResponseContract(input.limitedRolloutContract)
  if (!contract || !isDnaS13LimitedResponseDisplayEligible(contract)
    || input.ok !== true
    || input.runtimeGeneration !== "v3"
    || input.classification !== "literature"
    || input.engineVersion !== "dna-s13-strict-v4"
    || input.packageVersion !== contract.releaseVersion
    || input.packageSha256 !== contract.releaseHash
    || input.limitedRolloutFeedbackEligible !== true) return null

  const sources = Array.isArray(input.sources) ? input.sources : []
  const units = Array.isArray(input.answerUnits) ? input.answerUnits : []
  const authorities = Array.isArray(input.authoritySummary) ? input.authoritySummary : []
  const context = isRecord(input.conversationContext) ? input.conversationContext : null
  const finalTopicIds = context && Array.isArray(context.topicIds)
    ? context.topicIds.filter((topicId): topicId is string => typeof topicId === "string") : []
  if (!sources.length || !units.length || authorities.length !== 1
    || finalTopicIds.length < 1
    || finalTopicIds.some((topicId) => !contract.lockedPlanTopicIds.includes(topicId))
    || !isDnaS13LimitedOwnerBookAuthority(authorities[0])) return null
  const sourceCardIds = new Set<string>()
  for (const source of sources) {
    if (!isRecord(source)
      || typeof source.id !== "string"
      || !source.id.trim()
      || source.sourceId !== DNA_S13_LIMITED_OWNER_BOOK_SOURCE_ID
      || !isDnaS13LimitedOwnerBookAuthority(source.authority)) return null
    sourceCardIds.add(source.id)
  }
  for (const unit of units) {
    if (!isRecord(unit)
      || unit.role !== "owner_book_information"
      || typeof unit.text !== "string"
      || !unit.text.trim()
      || !isDnaS13LimitedOwnerBookAuthority(unit.authority)
      || !Array.isArray(unit.sourceIds)
      || unit.sourceIds.length !== 1
      || unit.sourceIds[0] !== DNA_S13_LIMITED_OWNER_BOOK_SOURCE_ID
      || !Array.isArray(unit.citationCardIds)
      || !unit.citationCardIds.length
      || unit.citationCardIds.some((id) => typeof id !== "string" || !sourceCardIds.has(id))) return null
  }
  return contract
}

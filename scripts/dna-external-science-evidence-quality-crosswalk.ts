#!/usr/bin/env node

import { createHash } from "node:crypto"
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs"
import { dirname, join, relative, resolve, sep } from "node:path"

import {
  assertContained,
  canonicalSha256,
  resolveSecureRoot,
  secureAtomicWriteFile,
} from "./dna-secure-artifact"

export const CROSSWALK_VERSION = "dna-external-science-evidence-quality-crosswalk@1"
const MANIFEST_VERSION = "dna-external-science-evidence-quality-crosswalk-manifest@1"
const EXPECTED_SOURCE_COUNT = 14
const CANDIDATE_RELATIVE_PATH =
  "Datasets/DNA-Intelligence/work/v3/prebook-closure/v1/external-science-candidate-package.json"
const REGISTRATION_RELATIVE_ROOT =
  "Datasets/DNA-Intelligence/work/v3/method-appraisal-registrations/v1"
const TRUSTED_REGISTRY_RELATIVE_PATH =
  `${REGISTRATION_RELATIVE_ROOT}/trusted-method-appraisal-registry.json`
const RAW_OUTPUT_RELATIVE_PATH =
  "Outputs/SelfMetaAI/dna-intelligence/evidence-quality-crosswalk/candidate-only-v1/crosswalk.json"
const REPO_MANIFEST_RELATIVE_PATH =
  "docs/dna-intelligence/program/evidence/external-science-evidence-quality-crosswalk-current.json"
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const SOURCE_ID_PATTERN = /^[a-z0-9._-]+$/

type CandidateSource = {
  id: string
  title: string
  artifactId: string
  artifactSha256: string
  sourceSha256: string
  runtimeEligible: boolean
  releaseEligible: boolean
}

type CandidateClaim = {
  id: string
  sourceId: string
  topicId: string
  passageId: string
  evidenceLevel: string
  claimSha256: string
  runtimeEligible: boolean
  releaseEligible: boolean
}

type CandidatePackage = {
  schemaVersion: string
  basisAt: string
  authorityClass: string
  runtimeEligible: boolean
  releaseEligible: boolean
  activationAllowed: boolean
  activeRuntimeGeneration: string
  sources: CandidateSource[]
  claims: CandidateClaim[]
  counts: Record<string, number>
  packageSha256: string
}

type AdaptedGradeDimensions = {
  riskOfBias: string
  inconsistency: string
  indirectness: string
  imprecision: string
  publicationBias: string
}

type Appraisal = {
  schemaVersion: string
  id: string
  sourceId: string
  studyDesign: string
  sampleSize: unknown
  population: string
  ageScope: string
  inclusionCriteria: string
  exclusionCriteria: string
  measures: string
  blinding: string
  randomization: string
  missingData: string
  confounding: string
  multiplicity: string
  effectSize: string
  confidenceInterval: string
  preregistration: string
  reproducibility: string
  funding: string
  conflictOfInterest: string
  generalizability: string
  causalBoundary: string
  adaptedGradeDimensions: AdaptedGradeDimensions
  gradeScope: string
  bodyOfEvidenceCertainty: string
  evidenceRefs: Record<string, unknown>[]
  reviewPasses: Record<string, unknown>[]
  reviewStatus: string
  disposition: string
  limitations: string[]
  sourceEvidencePayloadSha256: string
  appraisalPayloadSha256: string
}

type RegistrationDecision = {
  schemaVersion: string
  decisionId: string
  sourceId: string
  appraisalId: string
  candidateSha256: string
  authorityClass: string
  disposition: string
  mapping: Record<string, unknown>
  decisionSha256: string
}

type RegistrationResult = {
  schemaVersion: string
  sourceId: string
  candidateSha256: string
  decisionSha256: string
  appraisal: Appraisal
  trustRegistry: TrustedRegistry
  evidenceParagraphCount: number
  resultSha256: string
}

type RegistrationReceipt = {
  schemaVersion: string
  receiptId: string
  sourceId: string
  decisionFileSha256: string
  decisionSha256: string
  resultFileSha256: string
  resultSha256: string
  appraisalPayloadSha256: string
  compiledTrustRegistrySha256: string
  appraisalCollectionSha256: string
  runtimeEligible: boolean
  releaseEligible: boolean
  canonicalPayloadSha256: string
}

type TrustedRegistry = {
  registryKind: string
  evidenceRefs: Record<string, unknown>[]
  passEvidence: Record<string, unknown>[]
  appraisals: Record<string, unknown>[]
}

type SourceChainInput = {
  candidateSource: CandidateSource
  decision: RegistrationDecision
  decisionFileSha256: string
  result: RegistrationResult
  resultFileSha256: string
  receipt: RegistrationReceipt
  receiptFileSha256: string
}

export type CrosswalkInputs = {
  researchRoot: string
  candidate: CandidatePackage
  candidateFileSha256: string
  trustedRegistry: TrustedRegistry
  trustedRegistryFileSha256: string
  sourceChains: SourceChainInput[]
}

type SourceCrosswalk = {
  id: string
  sourceId: string
  candidateSourceSha256: string
  artifactSha256: string
  registration: Record<string, unknown>
  studyDesign: string
  population: string
  ageScope: string
  causalBoundary: string
  adaptedGradeDimensions: AdaptedGradeDimensions
  bodyOfEvidenceCertainty: string
  reviewStatus: string
  disposition: string
  limitations: string[]
  limitationCount: number
  limitationsSha256: string
  boundary: Record<string, unknown>
  runtimeEligible: false
  releaseEligible: false
  sourceCrosswalkSha256: string
}

type ClaimCrosswalk = {
  id: string
  claimId: string
  claimSha256: string
  sourceId: string
  sourceCrosswalkSha256: string
  claimEvidenceLevel: string
  sourceBodyOfEvidenceCertainty: string
  sourceAppraisalIsClaimCertainty: false
  certaintyInheritance: "forbidden"
  boundary: string
  runtimeEligible: false
  releaseEligible: false
  claimCrosswalkSha256: string
}

export type CrosswalkArtifact = {
  schemaVersion: string
  basisAt: string
  authorityClass: string
  runtimeEligible: false
  releaseEligible: false
  activationAllowed: false
  activeRuntimeGeneration: "v2_legacy"
  inputs: Record<string, unknown>
  sources: SourceCrosswalk[]
  claims: ClaimCrosswalk[]
  counts: Record<string, number>
  distributions: Record<string, Record<string, number>>
  verification: Record<string, number | boolean>
  boundary: Record<string, unknown>
  crosswalkSha256: string
}

export type CrosswalkManifest = {
  schemaVersion: string
  recordedAt: string
  crosswalkVersion: string
  inputHashes: Record<string, unknown>
  rawOutput: Record<string, unknown>
  counts: Record<string, number>
  statusCounts: Record<string, Record<string, number>>
  sourceStatus: Record<string, unknown>[]
  acceptance: Record<string, unknown>
  boundaryStatus: Record<string, unknown>
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function rawSha256(bytes: string | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex")
}

function omitKey<T extends Record<string, unknown>>(value: T, key: string): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...value }
  delete copy[key]
  return copy
}

function seal<T extends Record<string, unknown>, K extends string>(
  value: T,
  hashKey: K,
): T & Record<K, string> {
  return { ...value, [hashKey]: canonicalSha256(value) } as T & Record<K, string>
}

function assertHash(value: unknown, message: string): asserts value is string {
  assert(typeof value === "string" && SHA256_PATTERN.test(value), message)
}

function assertReadableFile(root: string, requested: string): string {
  const secureRoot = resolveSecureRoot(root)
  const path = assertContained(secureRoot, requested)
  const delta = relative(secureRoot, path)
  let current = secureRoot
  for (const segment of delta.split(sep).filter(Boolean)) {
    current = join(current, segment)
    assert(existsSync(current), `evidence_quality_crosswalk_input_missing:${current}`)
    const metadata = lstatSync(current)
    assert(!metadata.isSymbolicLink(), `evidence_quality_crosswalk_input_symlink_rejected:${current}`)
    if (current !== path) {
      assert(metadata.isDirectory(), `evidence_quality_crosswalk_input_parent_not_directory:${current}`)
    } else {
      assert(metadata.isFile(), `evidence_quality_crosswalk_input_not_file:${current}`)
    }
  }
  const real = realpathSync(path)
  const realDelta = relative(secureRoot, real)
  assert(
    realDelta !== ".." && !realDelta.startsWith(`..${sep}`) && !realDelta.startsWith(sep),
    `evidence_quality_crosswalk_input_realpath_escape:${path}`,
  )
  return path
}

function readJsonFile<T>(root: string, path: string): { value: T; fileSha256: string } {
  const safePath = assertReadableFile(root, path)
  const bytes = readFileSync(safePath)
  return { value: JSON.parse(bytes.toString("utf8")) as T, fileSha256: rawSha256(bytes) }
}

function setHash(values: readonly unknown[]): string {
  const sealed = values.map((value) => canonicalSha256(value)).sort()
  assert(new Set(sealed).size === sealed.length, "evidence_quality_crosswalk_duplicate_registry_entry")
  return canonicalSha256(sealed)
}

function distribution(values: readonly string[]): Record<string, number> {
  return Object.fromEntries([...new Set(values)].sort().map((value) => [
    value,
    values.filter((candidate) => candidate === value).length,
  ]))
}

export function loadCrosswalkInputs(
  requestedRoot = process.env.RESEARCH_SSD_ROOT ?? "/Volumes/ResearchSSD",
): CrosswalkInputs {
  const researchRoot = resolveSecureRoot(requestedRoot, true)
  const candidatePath = join(researchRoot, CANDIDATE_RELATIVE_PATH)
  const registryPath = join(researchRoot, TRUSTED_REGISTRY_RELATIVE_PATH)
  const candidateRead = readJsonFile<CandidatePackage>(researchRoot, candidatePath)
  const registryRead = readJsonFile<TrustedRegistry>(researchRoot, registryPath)
  const sourceChains = candidateRead.value.sources.map((candidateSource) => {
    assert(SOURCE_ID_PATTERN.test(candidateSource.id),
      `evidence_quality_crosswalk_source_id_invalid:${candidateSource.id}`)
    const sourceRoot = join(
      researchRoot,
      REGISTRATION_RELATIVE_ROOT,
      "sources",
      candidateSource.id,
    )
    const decision = readJsonFile<RegistrationDecision>(researchRoot, join(sourceRoot, "decision.json"))
    const result = readJsonFile<RegistrationResult>(researchRoot, join(sourceRoot, "result.json"))
    const receipt = readJsonFile<RegistrationReceipt>(researchRoot, join(sourceRoot, "receipt.json"))
    return {
      candidateSource,
      decision: decision.value,
      decisionFileSha256: decision.fileSha256,
      result: result.value,
      resultFileSha256: result.fileSha256,
      receipt: receipt.value,
      receiptFileSha256: receipt.fileSha256,
    }
  })
  return {
    researchRoot,
    candidate: candidateRead.value,
    candidateFileSha256: candidateRead.fileSha256,
    trustedRegistry: registryRead.value,
    trustedRegistryFileSha256: registryRead.fileSha256,
    sourceChains,
  }
}

const MAPPING_FIELDS = [
  "studyDesign", "sampleSize", "population", "ageScope", "inclusionCriteria",
  "exclusionCriteria", "measures", "blinding", "randomization", "missingData",
  "confounding", "multiplicity", "effectSize", "confidenceInterval", "preregistration",
  "reproducibility", "funding", "conflictOfInterest", "generalizability",
  "causalBoundary", "adaptedGradeDimensions",
] as const

function sourceRegistrySubset(registry: TrustedRegistry, appraisal: Appraisal): TrustedRegistry {
  return {
    registryKind: registry.registryKind,
    evidenceRefs: registry.evidenceRefs.filter((entry) => entry.sourceId === appraisal.sourceId),
    passEvidence: registry.passEvidence.filter((entry) => entry.appraisalId === appraisal.id),
    appraisals: registry.appraisals.filter((entry) => entry.sourceId === appraisal.sourceId),
  }
}

function validateSourceChain(
  chain: SourceChainInput,
  registry: TrustedRegistry,
  currentRegistrySha256: string,
): SourceCrosswalk {
  const { candidateSource, decision, result, receipt } = chain
  const sourceId = candidateSource.id
  assertHash(candidateSource.sourceSha256, `evidence_quality_crosswalk_source_hash_invalid:${sourceId}`)
  assert(
    canonicalSha256(omitKey(candidateSource as unknown as Record<string, unknown>, "sourceSha256"))
      === candidateSource.sourceSha256,
    `evidence_quality_crosswalk_candidate_source_hash_mismatch:${sourceId}`,
  )
  assert(decision.schemaVersion === "dna-method-appraisal-registration-decision@1",
    `evidence_quality_crosswalk_decision_schema:${sourceId}`)
  assert(result.schemaVersion === "dna-method-appraisal-registration-result@1",
    `evidence_quality_crosswalk_result_schema:${sourceId}`)
  assert(receipt.schemaVersion === "dna-method-appraisal-registration-receipt@1",
    `evidence_quality_crosswalk_receipt_schema:${sourceId}`)
  assert([decision.sourceId, result.sourceId, receipt.sourceId, result.appraisal.sourceId]
    .every((value) => value === sourceId),
  `evidence_quality_crosswalk_source_id_chain_mismatch:${sourceId}`)

  assert(canonicalSha256(omitKey(decision as unknown as Record<string, unknown>, "decisionSha256"))
    === decision.decisionSha256, `evidence_quality_crosswalk_decision_hash_mismatch:${sourceId}`)
  assert(canonicalSha256(omitKey(result as unknown as Record<string, unknown>, "resultSha256"))
    === result.resultSha256, `evidence_quality_crosswalk_result_hash_mismatch:${sourceId}`)
  assert(canonicalSha256(omitKey(receipt as unknown as Record<string, unknown>, "canonicalPayloadSha256"))
    === receipt.canonicalPayloadSha256, `evidence_quality_crosswalk_receipt_hash_mismatch:${sourceId}`)
  assert(canonicalSha256(omitKey(
    result.appraisal as unknown as Record<string, unknown>, "appraisalPayloadSha256",
  )) === result.appraisal.appraisalPayloadSha256,
  `evidence_quality_crosswalk_appraisal_hash_mismatch:${sourceId}`)

  assert(chain.decisionFileSha256 === receipt.decisionFileSha256,
    `evidence_quality_crosswalk_decision_file_hash_mismatch:${sourceId}`)
  assert(chain.resultFileSha256 === receipt.resultFileSha256,
    `evidence_quality_crosswalk_result_file_hash_mismatch:${sourceId}`)
  assert(decision.decisionSha256 === result.decisionSha256
    && result.decisionSha256 === receipt.decisionSha256,
  `evidence_quality_crosswalk_decision_link_mismatch:${sourceId}`)
  assert(result.resultSha256 === receipt.resultSha256,
    `evidence_quality_crosswalk_result_link_mismatch:${sourceId}`)
  assert(result.appraisal.appraisalPayloadSha256 === receipt.appraisalPayloadSha256,
    `evidence_quality_crosswalk_appraisal_link_mismatch:${sourceId}`)
  assert(decision.candidateSha256 === result.candidateSha256,
    `evidence_quality_crosswalk_registration_candidate_mismatch:${sourceId}`)
  assert(decision.appraisalId === result.appraisal.id,
    `evidence_quality_crosswalk_appraisal_id_mismatch:${sourceId}`)
  assert(decision.authorityClass === "codex_multi_pass_not_independent",
    `evidence_quality_crosswalk_decision_authority_mismatch:${sourceId}`)
  assert(decision.disposition === "register_with_limits",
    `evidence_quality_crosswalk_registration_disposition_mismatch:${sourceId}`)
  assert(receipt.runtimeEligible === false && receipt.releaseEligible === false,
    `evidence_quality_crosswalk_receipt_eligibility_mismatch:${sourceId}`)

  for (const field of MAPPING_FIELDS) {
    assert(canonicalSha256(decision.mapping[field])
      === canonicalSha256(result.appraisal[field] as unknown),
    `evidence_quality_crosswalk_mapping_mismatch:${sourceId}:${field}`)
  }

  const expectedRegistry = sourceRegistrySubset(registry, result.appraisal)
  assert(expectedRegistry.registryKind === "production_compiled",
    `evidence_quality_crosswalk_registry_kind_mismatch:${sourceId}`)
  assert(setHash(expectedRegistry.evidenceRefs) === setHash(result.trustRegistry.evidenceRefs),
    `evidence_quality_crosswalk_registry_evidence_mismatch:${sourceId}`)
  assert(setHash(expectedRegistry.passEvidence) === setHash(result.trustRegistry.passEvidence),
    `evidence_quality_crosswalk_registry_pass_mismatch:${sourceId}`)
  assert(setHash(expectedRegistry.appraisals) === setHash(result.trustRegistry.appraisals),
    `evidence_quality_crosswalk_registry_appraisal_mismatch:${sourceId}`)
  assert(expectedRegistry.appraisals.length === 1,
    `evidence_quality_crosswalk_registry_appraisal_cardinality:${sourceId}`)
  const registeredAppraisal = expectedRegistry.appraisals[0]
  assert(registeredAppraisal.appraisalPayloadSha256 === result.appraisal.appraisalPayloadSha256
    && registeredAppraisal.sourceEvidencePayloadSha256
      === result.appraisal.sourceEvidencePayloadSha256,
  `evidence_quality_crosswalk_registry_appraisal_hash_link:${sourceId}`)
  assert(expectedRegistry.passEvidence.length === result.appraisal.reviewPasses.length,
    `evidence_quality_crosswalk_review_pass_count_mismatch:${sourceId}`)
  assert(expectedRegistry.evidenceRefs.length === result.appraisal.evidenceRefs.length,
    `evidence_quality_crosswalk_evidence_ref_count_mismatch:${sourceId}`)
  assert(expectedRegistry.evidenceRefs.every((entry) =>
    entry.artifactSha256 === candidateSource.artifactSha256),
  `evidence_quality_crosswalk_artifact_hash_binding_mismatch:${sourceId}`)

  const limitations = [...result.appraisal.limitations]
  const base = {
    id: `quality:${sourceId}`,
    sourceId,
    candidateSourceSha256: candidateSource.sourceSha256,
    artifactSha256: candidateSource.artifactSha256,
    registration: {
      decisionFileSha256: chain.decisionFileSha256,
      decisionSha256: decision.decisionSha256,
      resultFileSha256: chain.resultFileSha256,
      resultSha256: result.resultSha256,
      receiptFileSha256: chain.receiptFileSha256,
      receiptSha256: receipt.canonicalPayloadSha256,
      appraisalId: result.appraisal.id,
      appraisalPayloadSha256: result.appraisal.appraisalPayloadSha256,
      sourceEvidencePayloadSha256: result.appraisal.sourceEvidencePayloadSha256,
      trustedRegistryCurrentSha256: currentRegistrySha256,
      trustedRegistrySourceSubsetSha256: canonicalSha256({
        registryKind: expectedRegistry.registryKind,
        evidenceRefsSetSha256: setHash(expectedRegistry.evidenceRefs),
        passEvidenceSetSha256: setHash(expectedRegistry.passEvidence),
        appraisalsSetSha256: setHash(expectedRegistry.appraisals),
      }),
      receiptCompiledRegistrySha256: receipt.compiledTrustRegistrySha256,
      receiptRegistrySnapshotMatchesCurrent:
        receipt.compiledTrustRegistrySha256 === currentRegistrySha256,
      receiptAppraisalCollectionSha256: receipt.appraisalCollectionSha256,
      historicalReceiptRegistrySnapshotReproducibleFromAllowedInputs: false,
    },
    studyDesign: result.appraisal.studyDesign,
    population: result.appraisal.population,
    ageScope: result.appraisal.ageScope,
    causalBoundary: result.appraisal.causalBoundary,
    adaptedGradeDimensions: { ...result.appraisal.adaptedGradeDimensions },
    bodyOfEvidenceCertainty: result.appraisal.bodyOfEvidenceCertainty,
    reviewStatus: result.appraisal.reviewStatus,
    disposition: result.appraisal.disposition,
    limitations,
    limitationCount: limitations.length,
    limitationsSha256: canonicalSha256(limitations),
    boundary: {
      appraisalScope: "source_level_method_appraisal_only",
      sourceAppraisalIsClaimCertainty: false,
      claimCertaintyInheritance: "forbidden",
      bodyOfEvidenceCertaintyPreservedVerbatim: true,
      codexMultiPassIsIndependentHumanReview: false,
      dnaProductValidityEstablished: false,
    },
    runtimeEligible: false as const,
    releaseEligible: false as const,
  }
  return seal(base, "sourceCrosswalkSha256") as SourceCrosswalk
}

export function buildCrosswalk(inputs: CrosswalkInputs): CrosswalkArtifact {
  const candidate = inputs.candidate
  assert(candidate.schemaVersion === "dna-external-science-candidate@1",
    "evidence_quality_crosswalk_candidate_schema_mismatch")
  assert(canonicalSha256(omitKey(candidate as unknown as Record<string, unknown>, "packageSha256"))
    === candidate.packageSha256, "evidence_quality_crosswalk_candidate_package_hash_mismatch")
  assert(candidate.runtimeEligible === false && candidate.releaseEligible === false
    && candidate.activationAllowed === false && candidate.activeRuntimeGeneration === "v2_legacy",
  "evidence_quality_crosswalk_candidate_boundary_mismatch")
  assert(candidate.sources.length === EXPECTED_SOURCE_COUNT,
    "evidence_quality_crosswalk_source_count_mismatch")
  assert(new Set(candidate.sources.map((source) => source.id)).size === candidate.sources.length,
    "evidence_quality_crosswalk_duplicate_candidate_source")
  assert(inputs.sourceChains.length === candidate.sources.length,
    "evidence_quality_crosswalk_registration_chain_count_mismatch")
  assert(new Set(inputs.sourceChains.map((chain) => chain.candidateSource.id)).size
    === candidate.sources.length, "evidence_quality_crosswalk_duplicate_registration_chain")
  assert(inputs.trustedRegistry.registryKind === "production_compiled",
    "evidence_quality_crosswalk_trusted_registry_kind_mismatch")

  const registrySha256 = canonicalSha256(inputs.trustedRegistry)
  const sources = inputs.sourceChains
    .map((chain) => validateSourceChain(chain, inputs.trustedRegistry, registrySha256))
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId, "en"))
  assert(setHash(sources.map((source) => source.sourceId))
    === setHash(candidate.sources.map((source) => source.id)),
  "evidence_quality_crosswalk_source_set_mismatch")
  const sourceById = new Map(sources.map((source) => [source.sourceId, source]))

  const claims = candidate.claims.map((claim) => {
    assert(canonicalSha256(omitKey(claim as unknown as Record<string, unknown>, "claimSha256"))
      === claim.claimSha256, `evidence_quality_crosswalk_claim_hash_mismatch:${claim.id}`)
    const source = sourceById.get(claim.sourceId)
    assert(source, `evidence_quality_crosswalk_claim_source_missing:${claim.id}`)
    const base = {
      id: `quality-binding:${claim.id}`,
      claimId: claim.id,
      claimSha256: claim.claimSha256,
      sourceId: claim.sourceId,
      sourceCrosswalkSha256: source.sourceCrosswalkSha256,
      claimEvidenceLevel: claim.evidenceLevel,
      sourceBodyOfEvidenceCertainty: source.bodyOfEvidenceCertainty,
      sourceAppraisalIsClaimCertainty: false as const,
      certaintyInheritance: "forbidden" as const,
      boundary: "Source-level method appraisal is not claim-level certainty and must not be inherited as such.",
      runtimeEligible: false as const,
      releaseEligible: false as const,
    }
    return seal(base, "claimCrosswalkSha256") as ClaimCrosswalk
  }).sort((left, right) => left.claimId.localeCompare(right.claimId, "en"))

  const sourceRegistryCurrentMatches = sources.filter((source) =>
    source.registration.receiptRegistrySnapshotMatchesCurrent === true).length
  const limitationCount = sources.reduce((sum, source) => sum + source.limitationCount, 0)
  const base = {
    schemaVersion: CROSSWALK_VERSION,
    basisAt: candidate.basisAt,
    authorityClass: "external_science_candidate_quality_crosswalk",
    runtimeEligible: false as const,
    releaseEligible: false as const,
    activationAllowed: false as const,
    activeRuntimeGeneration: "v2_legacy" as const,
    inputs: {
      candidateRelativePath: CANDIDATE_RELATIVE_PATH,
      candidateFileSha256: inputs.candidateFileSha256,
      candidatePackageSha256: candidate.packageSha256,
      trustedRegistryRelativePath: TRUSTED_REGISTRY_RELATIVE_PATH,
      trustedRegistryFileSha256: inputs.trustedRegistryFileSha256,
      trustedRegistryCanonicalSha256: registrySha256,
      allowedInputKinds: ["candidate_package", "registration_decision", "registration_result", "registration_receipt", "trusted_registry"],
    },
    sources,
    claims,
    counts: {
      sources: sources.length,
      claims: claims.length,
      limitations: limitationCount,
      registryEvidenceRefs: inputs.trustedRegistry.evidenceRefs.length,
      registryPassEvidence: inputs.trustedRegistry.passEvidence.length,
      registryAppraisals: inputs.trustedRegistry.appraisals.length,
      receiptRegistrySnapshotsMatchingCurrent: sourceRegistryCurrentMatches,
      historicalReceiptRegistrySnapshotsNotReproducibleFromAllowedInputs:
        sources.length - sourceRegistryCurrentMatches,
    },
    distributions: {
      studyDesign: distribution(sources.map((source) => source.studyDesign)),
      population: distribution(sources.map((source) => source.population)),
      ageScope: distribution(sources.map((source) => source.ageScope)),
      causalBoundary: distribution(sources.map((source) => source.causalBoundary)),
      bodyOfEvidenceCertainty: distribution(sources.map((source) => source.bodyOfEvidenceCertainty)),
      reviewStatus: distribution(sources.map((source) => source.reviewStatus)),
      disposition: distribution(sources.map((source) => source.disposition)),
    },
    verification: {
      exactSourceCoverage: sources.length === EXPECTED_SOURCE_COUNT,
      exactClaimCoverage: claims.length === candidate.claims.length,
      sourceHashMismatches: 0,
      decisionResultReceiptMismatches: 0,
      trustedRegistryBindingMismatches: 0,
      mappingMismatches: 0,
      limitationHashMismatches: 0,
      claimCertaintyInheritanceViolations: 0,
      runtimeEligibleRecords: 0,
      releaseEligibleRecords: 0,
    },
    boundary: {
      candidateOnly: true,
      sourceAppraisalIsClaimCertainty: false,
      claimCertaintyInheritance: "forbidden",
      bodyOfEvidenceCertaintyIsSourceLevelOnly: true,
      ownerBookAuthorityUsed: false,
      dnaProductValidityEstablished: false,
      runtimeAuthority: "none",
      releaseAuthority: "none",
      historicalReceiptRegistryHashes:
        "Receipt hashes are preserved, but historical registry snapshots are not reconstructed from disallowed inputs.",
    },
  }
  const artifact = seal(base, "crosswalkSha256") as CrosswalkArtifact
  validateCrosswalkArtifact(artifact)
  return artifact
}

export function validateCrosswalkArtifact(artifact: CrosswalkArtifact): true {
  assert(artifact.schemaVersion === CROSSWALK_VERSION,
    "evidence_quality_crosswalk_artifact_schema_mismatch")
  assert(canonicalSha256(omitKey(artifact as unknown as Record<string, unknown>, "crosswalkSha256"))
    === artifact.crosswalkSha256, "evidence_quality_crosswalk_artifact_hash_mismatch")
  assert(artifact.runtimeEligible === false && artifact.releaseEligible === false
    && artifact.activationAllowed === false && artifact.activeRuntimeGeneration === "v2_legacy",
  "evidence_quality_crosswalk_artifact_boundary_mismatch")
  assert(artifact.sources.length === artifact.counts.sources
    && artifact.claims.length === artifact.counts.claims,
  "evidence_quality_crosswalk_artifact_count_mismatch")
  assert(artifact.sources.every((source) =>
    canonicalSha256(omitKey(source as unknown as Record<string, unknown>, "sourceCrosswalkSha256"))
      === source.sourceCrosswalkSha256
      && source.limitationCount === source.limitations.length
      && source.limitationsSha256 === canonicalSha256(source.limitations)
      && source.boundary.sourceAppraisalIsClaimCertainty === false
      && source.boundary.claimCertaintyInheritance === "forbidden"
      && source.runtimeEligible === false
      && source.releaseEligible === false),
  "evidence_quality_crosswalk_source_record_invalid")
  const sourceById = new Map(artifact.sources.map((source) => [source.sourceId, source]))
  assert(artifact.claims.every((claim) => {
    const source = sourceById.get(claim.sourceId)
    return canonicalSha256(omitKey(claim as unknown as Record<string, unknown>, "claimCrosswalkSha256"))
      === claim.claimCrosswalkSha256
      && source?.sourceCrosswalkSha256 === claim.sourceCrosswalkSha256
      && source?.bodyOfEvidenceCertainty === claim.sourceBodyOfEvidenceCertainty
      && claim.sourceAppraisalIsClaimCertainty === false
      && claim.certaintyInheritance === "forbidden"
      && claim.runtimeEligible === false
      && claim.releaseEligible === false
  }), "evidence_quality_crosswalk_claim_boundary_invalid")
  assert(artifact.boundary.sourceAppraisalIsClaimCertainty === false
    && artifact.boundary.claimCertaintyInheritance === "forbidden"
    && artifact.boundary.runtimeAuthority === "none"
    && artifact.boundary.releaseAuthority === "none",
  "evidence_quality_crosswalk_global_boundary_invalid")
  return true
}

export function buildManifest(
  artifact: CrosswalkArtifact,
  rawOutputSha256: string,
): CrosswalkManifest {
  return {
    schemaVersion: MANIFEST_VERSION,
    recordedAt: new Date().toISOString(),
    crosswalkVersion: CROSSWALK_VERSION,
    inputHashes: {
      candidatePackageSha256: artifact.inputs.candidatePackageSha256,
      candidateFileSha256: artifact.inputs.candidateFileSha256,
      trustedRegistryCanonicalSha256: artifact.inputs.trustedRegistryCanonicalSha256,
      trustedRegistryFileSha256: artifact.inputs.trustedRegistryFileSha256,
    },
    rawOutput: {
      researchSsdRelativePath: RAW_OUTPUT_RELATIVE_PATH,
      rawSha256: rawOutputSha256,
      crosswalkSha256: artifact.crosswalkSha256,
      fileMode: "0600",
    },
    counts: {
      sources: artifact.counts.sources,
      claims: artifact.counts.claims,
      limitations: artifact.counts.limitations,
      registryEvidenceRefs: artifact.counts.registryEvidenceRefs,
      registryPassEvidence: artifact.counts.registryPassEvidence,
      registryAppraisals: artifact.counts.registryAppraisals,
      receiptRegistrySnapshotsMatchingCurrent:
        artifact.counts.receiptRegistrySnapshotsMatchingCurrent,
      historicalReceiptRegistrySnapshotsNotReproducibleFromAllowedInputs:
        artifact.counts.historicalReceiptRegistrySnapshotsNotReproducibleFromAllowedInputs,
    },
    statusCounts: artifact.distributions,
    sourceStatus: artifact.sources.map((source) => ({
      sourceId: source.sourceId,
      candidateSourceSha256: source.candidateSourceSha256,
      sourceCrosswalkSha256: source.sourceCrosswalkSha256,
      limitationCount: source.limitationCount,
      limitationsSha256: source.limitationsSha256,
      bodyOfEvidenceCertaintyStatus: source.bodyOfEvidenceCertainty,
      reviewStatus: source.reviewStatus,
      disposition: source.disposition,
      runtimeEligible: false,
      releaseEligible: false,
    })),
    acceptance: {
      exactSourceCoverage: artifact.verification.exactSourceCoverage,
      exactClaimCoverage: artifact.verification.exactClaimCoverage,
      chainIntegrity: "pass",
      trustedRegistryBinding: "pass",
      claimCertaintyBoundary: "pass",
      candidateOnly: true,
      runtimeAuthority: "none",
      releaseAuthority: "none",
      v3ReleaseDecision: "no_go_unchanged",
    },
    boundaryStatus: {
      sourceAppraisalIsClaimCertainty: false,
      claimCertaintyInheritance: "forbidden",
      bodyOfEvidenceCertainty: "preserved_source_level_only",
      rawLimitationsInRepo: false,
      ownerBookAuthorityUsed: false,
      candidateActivated: false,
    },
  }
}

function manifestProjection(manifest: CrosswalkManifest) {
  const { recordedAt: _recordedAt, ...projection } = manifest
  return projection
}

export function assertCrosswalkManifestMatch(
  recorded: CrosswalkManifest,
  expected: CrosswalkManifest,
): true {
  assert(canonicalSha256(manifestProjection(recorded))
    === canonicalSha256(manifestProjection(expected)),
  "evidence_quality_crosswalk_repo_manifest_drift")
  return true
}

export function assertManifestContainsNoRawLimitations(
  manifest: CrosswalkManifest,
  artifact: CrosswalkArtifact,
): true {
  const serialized = JSON.stringify(manifest)
  const hasRawLimitationsArray = (value: unknown): boolean => {
    if (!value || typeof value !== "object") return false
    if (Array.isArray(value)) return value.some(hasRawLimitationsArray)
    return Object.entries(value as Record<string, unknown>).some(([key, child]) =>
      (key === "limitations" && Array.isArray(child)) || hasRawLimitationsArray(child))
  }
  assert(!hasRawLimitationsArray(manifest),
    "evidence_quality_crosswalk_repo_manifest_limitations_array_forbidden")
  for (const limitation of artifact.sources.flatMap((source) => source.limitations)) {
    assert(!serialized.includes(limitation),
      "evidence_quality_crosswalk_repo_manifest_raw_limitation_leak")
  }
  return true
}

export function runCrosswalk() {
  const repoRoot = resolveSecureRoot(process.cwd())
  assert(existsSync(join(repoRoot, "package.json")), "evidence_quality_crosswalk_repo_root_invalid")
  const inputs = loadCrosswalkInputs()
  const artifact = buildCrosswalk(inputs)
  const repeatHashes = Array.from({ length: 20 }, () => buildCrosswalk(inputs).crosswalkSha256)
  assert(new Set(repeatHashes).size === 1 && repeatHashes[0] === artifact.crosswalkSha256,
    "evidence_quality_crosswalk_determinism_failed")
  const rawText = `${JSON.stringify(artifact, null, 2)}\n`
  const rawOutputSha256 = rawSha256(rawText)
  const manifest = buildManifest(artifact, rawOutputSha256)
  assertManifestContainsNoRawLimitations(manifest, artifact)

  const rawPath = assertContained(inputs.researchRoot, join(inputs.researchRoot, RAW_OUTPUT_RELATIVE_PATH))
  const manifestPath = assertContained(repoRoot, join(repoRoot, REPO_MANIFEST_RELATIVE_PATH))
  const writeManifest = process.argv.includes("--write-manifest")
  if (!writeManifest) {
    assert(existsSync(manifestPath),
      "evidence_quality_crosswalk_repo_manifest_missing_run_with_write_manifest")
    assert(!lstatSync(manifestPath).isSymbolicLink(),
      "evidence_quality_crosswalk_repo_manifest_symlink_rejected")
    const recorded = JSON.parse(readFileSync(manifestPath, "utf8")) as CrosswalkManifest
    assertCrosswalkManifestMatch(recorded, manifest)
  }

  const rawWrite = secureAtomicWriteFile(inputs.researchRoot, rawPath, rawText)
  assert(rawWrite.sha256 === rawOutputSha256,
    "evidence_quality_crosswalk_raw_write_hash_mismatch")
  if (writeManifest) {
    const manifestText = `${JSON.stringify(manifest, null, 2)}\n`
    secureAtomicWriteFile(repoRoot, manifestPath, manifestText)
  }

  console.log(JSON.stringify({
    ok: true,
    schemaVersion: artifact.schemaVersion,
    counts: artifact.counts,
    distributions: artifact.distributions,
    deterministicRepeats: repeatHashes.length,
    uniqueDeterministicHashes: new Set(repeatHashes).size,
    crosswalkSha256: artifact.crosswalkSha256,
    rawOutputSha256,
    acceptance: manifest.acceptance,
    boundaryStatus: manifest.boundaryStatus,
  }, null, 2))
}

if (require.main === module) {
  try {
    runCrosswalk()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

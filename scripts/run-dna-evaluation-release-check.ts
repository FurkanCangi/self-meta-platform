import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { join, relative, resolve } from "node:path"

import { z } from "zod"

import { DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS } from "../src/lib/dna/chat/catalog"
import claimPassageLinksJson from "../src/lib/dna/chat/catalog/generated/v3/claim-passage-links.json"
import claimsJson from "../src/lib/dna/chat/catalog/generated/v3/claims.json"
import lexicalIndexJson from "../src/lib/dna/chat/catalog/generated/v3/lexical-index.json"
import manifestJson from "../src/lib/dna/chat/catalog/generated/v3/manifest.json"
import passagesJson from "../src/lib/dna/chat/catalog/generated/v3/passages.json"
import relationsJson from "../src/lib/dna/chat/catalog/generated/v3/relations.json"
import sourcesJson from "../src/lib/dna/chat/catalog/generated/v3/sources.json"
import type { DnaV3StaticPackage } from "../src/lib/dna/chat/catalog/generated/v3/types"
import {
  assertDnaEvaluationRunBindings,
  assertDnaEvaluationExecutionDigests,
  assertCurrentDnaEvaluationEngineSourceClosure,
  assertDnaVariationManifestMatchesSealedPayload,
  computeDnaEvaluationEngineCodeHash,
  createDnaDevelopmentAssignmentLedger,
  createDnaEvaluationPackageIndex,
  DNA_FORBIDDEN_INFERENCE_IDS,
  sealDnaLockedBenchmark,
  sealDnaVariationBank,
  type DnaApprovedVariation,
  type DnaLockedBenchmarkManifest,
  type DnaLockedBenchmarkQuestion,
  type DnaReviewerTransformEvidenceLedger,
  type DnaVariationBankManifest,
} from "../src/lib/dna/chat/evaluation/evaluationGovernance"
import {
  DNA_CASE_EVALUATION_SCENARIOS,
  DNA_CASE_SCENARIO_BEHAVIORS,
  DNA_CRITICAL_SAFETY_FAMILIES,
  assertDnaAnswerAtomChecksAreEngineDerived,
  assertDnaCaseFixtureScenarioInvariants,
  assertDnaCaseChecksAreEngineDerived,
  assertDnaRetrievalObservationsBoundToBenchmark,
  assertDnaSafetyObservationsBoundToBenchmark,
  assertDnaVariationObservationsBoundToBank,
  containsForbiddenPublicOutputSubstring,
  deriveDnaAnswerAtomSemanticChecks,
  deriveDnaSourceIntegrationSignalsFromAuthoritativePackage,
  doesDnaSafetyRefusalSatisfyLockedQuestion,
  doesDnaCaseAnswerSatisfyScenario,
  evaluateDnaCaseAccuracyGate,
  evaluateDnaClaimCitationGate,
  evaluateDnaRetrievalGate,
  evaluateDnaSafetyGate,
  evaluateDnaSourceIntegrationGate,
  findDnaForbiddenInferenceViolations,
  isDnaRelationshipPolicyBoundaryExact,
  type DnaAnswerAtomAudit,
  type DnaCaseEvaluationObservation,
  type DnaRetrievalEvaluationObservation,
  type DnaSafetyFamilyObservation,
  type DnaVariationEvaluationObservation,
} from "../src/lib/dna/chat/evaluation/evaluationGates"
import {
  createDnaChatReportSelectionCoordinator,
  planDnaChatReportTransition,
} from "../src/lib/dna/chat/conversationPolicy"
import { DNA_CURRENT_V3_RELEASE_PACKAGE } from "../src/lib/dna/chat/governance/releaseCompiler"
import { validateCurrentDnaV3StaticPackage } from "../src/lib/dna/chat/governance/v3StaticPackage"
import {
  DNA_OWNED_CASE_CONTEXT_VERSION,
  DNA_OWNED_CASE_SNAPSHOT_GENERATIONS,
  createCanonicalOwnedDnaCaseContext,
} from "../src/lib/dna/chat/ownedCaseContextCore"
import {
  attachVerifiedReportCaseAuthorityInternal,
  dnaCaseContextPayloadSha256,
} from "../src/lib/dna/chat/caseContext"
import { createVerifiedReportCaseAuthorityInternal } from "../src/lib/dna/chat/knowledgeAuthority"
import {
  DNA_V3_RETRIEVAL_ENGINE_VERSION,
  dnaV3RelationshipBoundary,
  rankDnaV3RetrievalCandidates,
  resolveDnaV3Retrieval,
} from "../src/lib/dna/chat/v3RetrievalCore"
import { adaptDnaV3StaticPackageForRetrieval } from "../src/lib/dna/chat/v3RetrievalPackageAdapter"
import { doesDnaV3CaseAnswerMatchContext } from "../src/lib/dna/chat/v3CaseTheoryAssembler"
import { validateDnaV3AnswerEvidence } from "../src/lib/dna/chat/v3AnswerEvidence"
import {
  DNA_V3_AGE_GROUPS,
  dnaV3AgeGroupsForScope,
  dnaV3CaseAgeGroupFromMonths,
  doesDnaV3LockedAgeBoundaryMatchCase,
  isDnaV3AgeScopeCompatibleWithGroup,
} from "../src/lib/dna/chat/v3AgePolicy"

const DEFAULT_RESEARCH_SSD_ROOT = "/Volumes/ResearchSSD"
const EVALUATION_RELATIVE_ROOT = "Datasets/DNA-Intelligence/evaluation/v3"

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,199}$/)
const sha256 = z.string().regex(/^[a-f0-9]{64}$/)
const outcome = z.enum(["answer", "clarification", "not_available", "refusal"])
const perRowExecutionBinding = {
  inputSha256: sha256,
  outputSha256: sha256,
}
const benchmarkQuestionSchema = z.object({
  id: identifier,
  familyId: identifier,
  bucket: z.enum(["supported", "unsupported", "safety", "case_robustness"]),
  expectedSafetyFamily: z.enum(DNA_CRITICAL_SAFETY_FAMILIES).nullable(),
  semanticFamilyProvenanceSha256: sha256,
  question: z.string().min(2).max(600),
  expectedTopic: z.string().min(1).nullable(),
  expectedQueryKind: z.string().min(1),
  acceptableClaimIds: z.array(identifier),
  requiredPassageIds: z.array(identifier),
  forbiddenInferences: z.array(z.enum(DNA_FORBIDDEN_INFERENCE_IDS)).min(1),
  forbiddenOutputSubstrings: z.array(z.string().min(8).max(200)),
  ageBoundary: z.string().min(1),
  expectedOutcome: outcome,
  requiredSafetyStatement: z.string().min(1).nullable(),
  allowedReportFields: z.array(z.string().min(1)),
  reviewerApprovalId: identifier,
}).strict()
const lockedManifestSchema = z.object({
  schemaVersion: z.literal("dna-locked-internal-benchmark@1"),
  state: z.enum(["sealed", "opened_for_evaluation", "retired"]),
  itemCount: z.literal(2_400),
  familyCount: z.number().int().positive(),
  distribution: z.object({
    supported: z.literal(1_000),
    unsupported: z.literal(400),
    safety: z.literal(600),
    caseRobustness: z.literal(400),
  }).strict(),
  benchmarkSha256: sha256,
  familyAssignmentSha256: sha256,
  developmentAssignmentLedgerSha256: sha256,
  releasedTopicCoverageSha256: sha256,
  sourcePackageSha256: sha256,
  sealedAt: z.string().datetime({ offset: true }),
  openedAt: z.string().datetime({ offset: true }).nullable(),
  tuningUseProhibited: z.literal(true),
  questionFamiliesKeptTogether: z.literal(true),
  independentClinicalValidation: z.literal(false),
}).strict()
const variationSchema = z.object({
  id: identifier,
  baseQuestionId: identifier,
  baseQuestionSha256: sha256,
  familyId: identifier,
  kind: z.enum([
    "typo", "turkish_character_loss", "inflection", "synonym",
    "mixed_turkish_english", "negation", "length_change", "follow_up",
    "two_subquestions", "safe_plus_risky", "prompt_manipulation", "false_premise",
  ]),
  question: z.string().min(2).max(600),
  expectedOutcome: outcome,
  expectationRelation: z.enum(["preserves", "reviewer_changed"]),
  transformationEvidence: z.object({
    schemaVersion: z.literal("dna-variation-transform-evidence@1"),
    beforeTextSha256: sha256,
    afterTextSha256: sha256,
    tokenDiffSha256: sha256,
    reviewerTransformEvidenceId: identifier.nullable(),
    reviewerTransformEvidenceSha256: sha256.nullable(),
  }).strict(),
  reviewerApprovalId: identifier,
}).strict()
const variationManifestSchema = z.object({
  schemaVersion: z.literal("dna-variation-bank@1"),
  state: z.enum(["sealed", "opened_for_evaluation", "retired"]),
  itemCount: z.number().int().min(10_000),
  baseQuestionCount: z.number().int().positive(),
  familyCount: z.number().int().positive(),
  kindCounts: z.record(z.string(), z.number().int().nonnegative()),
  kindBaseCounts: z.record(z.string(), z.number().int().nonnegative()),
  kindFamilyCounts: z.record(z.string(), z.number().int().nonnegative()),
  coverageSha256: sha256,
  reviewerTransformEvidenceLedgerSha256: sha256,
  variationSha256: sha256,
  lockedBenchmarkSha256: sha256,
  sealedAt: z.string().datetime({ offset: true }),
  marketingClassification: z.literal("test_variations_not_knowledge"),
}).strict()
const reviewerTransformEvidenceLedgerSchema = z.object({
  schemaVersion: z.literal("dna-reviewer-transform-evidence-ledger@1"),
  records: z.array(z.object({
    id: identifier,
    variationId: identifier,
    baseQuestionSha256: sha256,
    variationQuestionSha256: sha256,
    kind: z.enum([
      "typo", "turkish_character_loss", "inflection", "synonym",
      "mixed_turkish_english", "negation", "length_change", "follow_up",
      "two_subquestions", "safe_plus_risky", "prompt_manipulation", "false_premise",
    ]),
    changedTokenPairs: z.array(z.object({
      before: z.string().min(1).nullable(),
      after: z.string().min(1).nullable(),
    }).strict().refine((pair) => pair.before !== null || pair.after !== null,
      "reviewer token pair must contain an actual change")).min(1),
    semanticJudgment: z.enum(["preserved", "changed_outcome"]),
    expectedOutcome: outcome,
    reviewerApprovalId: identifier,
    reviewerId: identifier,
    reviewRunId: identifier,
    reviewedAt: z.string().datetime({ offset: true }),
    recordSha256: sha256,
  }).strict()),
  ledgerSha256: sha256,
}).strict()
const retrievalObservationSchema = z.object({
  ...perRowExecutionBinding,
  id: identifier,
  category: z.string().min(1),
  expectedTopic: z.string().min(1).nullable(),
  actualTopic: z.string().min(1).nullable(),
  expectedQueryKind: z.string().min(1),
  actualQueryKind: z.string().min(1),
  expectedOutcome: outcome,
  actualOutcome: outcome,
  relevantClaimIds: z.array(identifier),
  rankedClaimIds: z.array(identifier),
  clarificationCorrect: z.boolean(),
  materialAnswerProduced: z.boolean(),
  safeQuestion: z.boolean(),
}).strict()
const variationObservationSchema = z.object({
  ...perRowExecutionBinding,
  id: identifier,
  baseQuestionId: identifier,
  kind: z.string().min(1),
  expectedTopic: z.string().min(1).nullable(),
  actualTopic: z.string().min(1).nullable(),
  expectedQueryKind: z.string().min(1),
  actualQueryKind: z.string().min(1),
  expectedOutcome: outcome,
  actualOutcome: outcome,
}).strict()
const runBindingSchema = {
  engineVersion: z.literal(DNA_V3_RETRIEVAL_ENGINE_VERSION),
  engineCodeHash: sha256,
  runId: identifier,
  evaluatedAt: z.string().datetime({ offset: true }),
}
const retrievalEnvelopeSchema = z.object({
  schemaVersion: z.literal("dna-retrieval-observations@2"),
  ...runBindingSchema,
  sourcePackageSha256: sha256,
  benchmarkSha256: sha256,
  variationSha256: sha256,
  caseFixtureSha256: sha256,
  baseObservations: z.array(retrievalObservationSchema),
  variationObservations: z.array(variationObservationSchema),
}).strict()
const atomSchema = z.object({
  responseId: identifier,
  atomId: identifier,
  answerUnitId: identifier,
  responseOutputSha256: sha256,
  material: z.boolean(),
  claimId: identifier.nullable(),
  passageId: identifier.nullable(),
  visibleCitationClaimId: identifier.nullable(),
  visibleCitationPassageId: identifier.nullable(),
  sourceSupportsAtom: z.boolean(),
  correctPassage: z.boolean(),
  studyTypeCorrect: z.boolean(),
  ageBoundaryPreserved: z.boolean(),
  correlationNotMadeCausal: z.boolean(),
  animalFindingNotHumanized: z.boolean(),
  theoryNotPresentedAsFact: z.boolean(),
  dnaRelationshipNotExaggerated: z.boolean(),
  uncertaintyAppropriate: z.boolean(),
  fabricatedOrWrongSource: z.boolean(),
  criticalClinicalError: z.boolean(),
}).strict()
const safetyObservationSchema = z.object({
  ...perRowExecutionBinding,
  family: z.enum(DNA_CRITICAL_SAFETY_FAMILIES),
  questionId: identifier,
  correctRefusal: z.boolean(),
  leakedProtectedContent: z.boolean(),
}).strict()
const caseObservationSchema = z.object({
  ...perRowExecutionBinding,
  scenario: z.enum(DNA_CASE_EVALUATION_SCENARIOS),
  questionId: identifier,
  caseId: identifier,
  hallucinatedReportFinding: z.boolean(),
  unauthorizedSnapshotFieldUsed: z.boolean(),
  reportTheorySeparated: z.boolean(),
  mixedAnswer: z.boolean(),
  biologicalMeasurementBoundaryPresent: z.boolean(),
  rawDataLeak: z.boolean(),
  ageBoundaryPreserved: z.boolean(),
  reportChangeIsolationPreserved: z.boolean(),
  pendingQuestionResubmittedExactlyOnce: z.boolean(),
  scenarioBehaviorPreserved: z.boolean(),
}).strict()
const observationEnvelopeBase = {
  ...runBindingSchema,
  sourcePackageSha256: sha256,
  benchmarkSha256: sha256,
  caseFixtureSha256: sha256,
}
const atomEnvelopeSchema = z.object({
  schemaVersion: z.literal("dna-claim-atom-observations@2"),
  ...observationEnvelopeBase,
  observations: z.array(atomSchema),
}).strict()
const safetyEnvelopeSchema = z.object({
  schemaVersion: z.literal("dna-safety-observations@2"),
  ...observationEnvelopeBase,
  observations: z.array(safetyObservationSchema),
}).strict()
const caseEnvelopeSchema = z.object({
  schemaVersion: z.literal("dna-case-observations@2"),
  ...observationEnvelopeBase,
  observations: z.array(caseObservationSchema),
}).strict()
const domainScoresSchema = z.object({
  physiological: z.number().min(0).max(50).optional(),
  sensory: z.number().min(0).max(50).optional(),
  emotional: z.number().min(0).max(50).optional(),
  cognitive: z.number().min(0).max(50).optional(),
  executive: z.number().min(0).max(50).optional(),
  interoception: z.number().min(0).max(50).optional(),
}).strict()
const domainLevelsSchema = z.object({
  physiological: z.enum(["Tipik", "Riskli", "Atipik"]).optional(),
  sensory: z.enum(["Tipik", "Riskli", "Atipik"]).optional(),
  emotional: z.enum(["Tipik", "Riskli", "Atipik"]).optional(),
  cognitive: z.enum(["Tipik", "Riskli", "Atipik"]).optional(),
  executive: z.enum(["Tipik", "Riskli", "Atipik"]).optional(),
  interoception: z.enum(["Tipik", "Riskli", "Atipik"]).optional(),
}).strict()
const caseFixtureSchema = z.object({
  id: identifier,
  questionId: identifier,
  scenario: z.enum(DNA_CASE_EVALUATION_SCENARIOS),
  expectedBehavior: z.enum(["case_only", "case_scientific_mixed", "transition_only"]),
  contextKind: z.enum(["modern", "basic", "legacy"]),
  snapshotGeneration: z.enum(DNA_OWNED_CASE_SNAPSHOT_GENERATIONS),
  expectedIncompatibleTheoryAgeScope: z.string().min(1).nullable(),
  ageMonths: z.number().int().min(0).max(216).nullable(),
  scores: domainScoresSchema,
  domainLevels: domainLevelsSchema,
  forbiddenOutputSubstrings: z.array(z.string().min(8).max(200)).min(1),
}).strict()
const caseFixtureEnvelopeSchema = z.object({
  schemaVersion: z.literal("dna-case-evaluation-fixtures@1"),
  sourcePackageSha256: sha256,
  benchmarkSha256: sha256,
  fixtureSha256: sha256,
  fixtures: z.array(caseFixtureSchema),
}).strict()

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const object = value as Record<string, unknown>
  return `{${Object.keys(object).sort((a, b) => a.localeCompare(b, "en"))
    .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`
}

function contentSha256(value: unknown): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex")
}

function deterministicUuid(seed: string, label: string): string {
  const hex = createHash("sha256").update(`${seed}\u0000${label}`, "utf8").digest("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

type CaseFixture = z.infer<typeof caseFixtureSchema>

function snapshotForCaseFixture(fixture: CaseFixture): unknown {
  if (fixture.contextKind === "modern") {
    return Object.freeze({
      age_months: fixture.ageMonths,
      scores: fixture.scores,
      domain_levels: fixture.domainLevels,
      chat_context: Object.freeze({ version: DNA_OWNED_CASE_CONTEXT_VERSION }),
    })
  }
  if (fixture.contextKind === "basic") {
    return Object.freeze({
      age_months: fixture.ageMonths,
      scores: fixture.scores,
      domain_levels: fixture.domainLevels,
    })
  }
  const legacyKey = {
    physiological: "fizyolojik",
    sensory: "duyusal",
    emotional: "duygusal",
    cognitive: "bilissel",
    executive: "yurutucu",
    interoception: "intero",
  } as const
  return Object.freeze({
    ageMonths: fixture.ageMonths,
    scores: Object.fromEntries(Object.entries(fixture.scores)
      .map(([domain, value]) => [legacyKey[domain as keyof typeof legacyKey], value])),
    domainLevels: Object.fromEntries(Object.entries(fixture.domainLevels)
      .map(([domain, value]) => [legacyKey[domain as keyof typeof legacyKey], value])),
  })
}

function forbiddenOutputKeyPresent(value: unknown): boolean {
  if (!value || typeof value !== "object") return false
  if (Array.isArray(value)) return value.some(forbiddenOutputKeyPresent)
  return Object.entries(value as Record<string, unknown>).some(([key, child]) =>
    /^(?:answers?|anamnesis|snapshot(?:_json)?|trace|reasoningTrace|internalRuleId|reportId|clientCode)$/i.test(key)
    || forbiddenOutputKeyPresent(child))
}
function readJson(path: string): unknown {
  if (!existsSync(path)) throw new Error(`evaluation_artifact_missing:${path}`)
  return JSON.parse(readFileSync(path, "utf8"))
}

function assertInside(base: string, target: string): void {
  const rel = relative(base, target)
  if (!rel || rel.startsWith("..") || rel.includes("../") || rel.startsWith("/")) {
    throw new Error("evaluation_data_root_outside_research_ssd")
  }
}

function assertExactIdSet(actual: readonly string[], expected: readonly string[], code: string): void {
  assert.equal(new Set(actual).size, actual.length, `${code}:duplicate`)
  assert.deepEqual([...new Set(actual)].sort(), [...new Set(expected)].sort(), code)
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function normalizeComparableText(value: string): string {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9çğıöşü]+/gi, " ")
    .trim()
}

function textContainsBoundary(text: string, boundary: string): boolean {
  const normalizedText = normalizeComparableText(text)
  const normalizedBoundary = normalizeComparableText(boundary)
  return Boolean(normalizedBoundary && normalizedText.includes(normalizedBoundary))
}

const researchSsdRoot = resolve(process.env.RESEARCH_SSD_ROOT || DEFAULT_RESEARCH_SSD_ROOT)
const evaluationRoot = resolve(
  process.env.DNA_EVALUATION_DATA_ROOT || join(researchSsdRoot, EVALUATION_RELATIVE_ROOT),
)

try {
  const exactEngineSourceClosure = assertCurrentDnaEvaluationEngineSourceClosure(process.cwd())
  assert.equal(exactEngineSourceClosure.length, 105,
    "evaluation_engine_source_authority_count_mismatch")
  if (!researchSsdRoot.startsWith(`${DEFAULT_RESEARCH_SSD_ROOT}/`) && researchSsdRoot !== DEFAULT_RESEARCH_SSD_ROOT) {
    throw new Error("evaluation_requires_research_ssd")
  }
  if (!existsSync(researchSsdRoot)) throw new Error("research_ssd_not_mounted")
  assertInside(researchSsdRoot, evaluationRoot)

  const pkg = validateCurrentDnaV3StaticPackage({
    manifest: manifestJson,
    sources: sourcesJson,
    passages: passagesJson,
    claims: claimsJson,
    relations: relationsJson,
    claimPassageLinks: claimPassageLinksJson,
    lexicalIndex: lexicalIndexJson,
  } as unknown as DnaV3StaticPackage)
  const packageIndex = createDnaEvaluationPackageIndex(pkg)
  const retrievalPackage = adaptDnaV3StaticPackageForRetrieval(pkg)
  assert.equal(pkg.manifest.releasePackageInputSha256, DNA_CURRENT_V3_RELEASE_PACKAGE.inputSha256,
    "evaluation_package_not_bound_to_authoritative_release_compiler")
  const engineCodeHash = computeDnaEvaluationEngineCodeHash((relativePath) =>
    readFileSync(join(process.cwd(), relativePath), "utf8"))

  const questions = z.array(benchmarkQuestionSchema).parse(readJson(join(
    evaluationRoot, "locked-benchmark/questions.json",
  ))) as DnaLockedBenchmarkQuestion[]
  const lockedManifest = lockedManifestSchema.parse(readJson(join(
    evaluationRoot, "locked-benchmark/manifest.json",
  ))) as DnaLockedBenchmarkManifest
  if (lockedManifest.state !== "opened_for_evaluation" || !lockedManifest.openedAt) {
    throw new Error("locked_benchmark_not_opened_for_release_evaluation")
  }
  const recomputedLocked = sealDnaLockedBenchmark({
    questions,
    packageIndex,
    developmentAssignmentLedger: createDnaDevelopmentAssignmentLedger(
      DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS,
    ),
    sealedAt: lockedManifest.sealedAt,
  })
  if (recomputedLocked.manifest.benchmarkSha256 !== lockedManifest.benchmarkSha256
    || recomputedLocked.manifest.familyAssignmentSha256 !== lockedManifest.familyAssignmentSha256
    || recomputedLocked.manifest.developmentAssignmentLedgerSha256
      !== lockedManifest.developmentAssignmentLedgerSha256
    || recomputedLocked.manifest.releasedTopicCoverageSha256
      !== lockedManifest.releasedTopicCoverageSha256
    || recomputedLocked.manifest.sourcePackageSha256 !== lockedManifest.sourcePackageSha256
    || recomputedLocked.manifest.familyCount !== lockedManifest.familyCount
    || !sameJson(recomputedLocked.manifest.distribution, lockedManifest.distribution)) {
    throw new Error("locked_benchmark_manifest_hash_mismatch")
  }

  const variations = z.array(variationSchema).parse(readJson(join(
    evaluationRoot, "variation-bank/variations.json",
  ))) as DnaApprovedVariation[]
  const variationManifest = variationManifestSchema.parse(readJson(join(
    evaluationRoot, "variation-bank/manifest.json",
  ))) as DnaVariationBankManifest
  const reviewerTransformEvidenceLedger = reviewerTransformEvidenceLedgerSchema.parse(readJson(join(
    evaluationRoot, "variation-bank/reviewer-transform-evidence.json",
  ))) as DnaReviewerTransformEvidenceLedger
  if (Date.parse(variationManifest.sealedAt) > Date.parse(lockedManifest.openedAt)) {
    throw new Error("variation_bank_sealed_after_locked_benchmark_opened")
  }
  const recomputedVariations = sealDnaVariationBank({
    variations,
    lockedQuestions: recomputedLocked.questions,
    lockedManifest: recomputedLocked.manifest,
    reviewerTransformEvidenceLedger,
    sealedAt: variationManifest.sealedAt,
  })
  assertDnaVariationManifestMatchesSealedPayload(
    variationManifest,
    recomputedVariations.manifest,
  )

  const caseFixtureEnvelope = caseFixtureEnvelopeSchema.parse(readJson(join(
    evaluationRoot, "case-fixtures.json",
  )))
  assert.equal(caseFixtureEnvelope.sourcePackageSha256, pkg.manifest.packageSha256,
    "case_fixture_package_hash_mismatch")
  assert.equal(caseFixtureEnvelope.benchmarkSha256, lockedManifest.benchmarkSha256,
    "case_fixture_benchmark_hash_mismatch")
  assert.equal(caseFixtureEnvelope.fixtureSha256, contentSha256(caseFixtureEnvelope.fixtures),
    "case_fixture_payload_hash_mismatch")
  const caseQuestionIds = questions
    .filter((row) => row.bucket === "case_robustness")
    .map((row) => row.id)
  assertExactIdSet(
    caseFixtureEnvelope.fixtures.map((row) => row.questionId),
    caseQuestionIds,
    "case_fixture_question_set_mismatch",
  )
  for (const fixture of caseFixtureEnvelope.fixtures) {
    const question = questions.find((candidate) => candidate.id === fixture.questionId)
    if (!question || !sameJson(
      [...fixture.forbiddenOutputSubstrings].sort(),
      [...question.forbiddenOutputSubstrings].sort(),
    )) throw new Error("case_fixture_forbidden_output_sentinel_mismatch")
    if (fixture.expectedBehavior !== DNA_CASE_SCENARIO_BEHAVIORS[fixture.scenario]) {
      throw new Error("case_fixture_scenario_behavior_contract_mismatch")
    }
    if (fixture.expectedBehavior !== "transition_only"
      && question.expectedOutcome !== "answer") {
      throw new Error("case_fixture_content_scenario_must_expect_answer")
    }
  }
  const fixtureByQuestionId = new Map(caseFixtureEnvelope.fixtures.map((fixture) => {
    const reportId = deterministicUuid(fixture.id, "report")
    const assessmentId = deterministicUuid(fixture.id, "assessment")
    const clientId = deterministicUuid(fixture.id, "client")
    const ownerId = deterministicUuid(fixture.id, "owner")
    const canonical = createCanonicalOwnedDnaCaseContext(snapshotForCaseFixture(fixture), {
      reportId,
      loadedReportId: reportId,
      assessmentId,
      loadedAssessmentId: assessmentId,
      clientId,
      loadedClientId: clientId,
      ownerId,
      sessionUserId: ownerId,
    })
    assert.equal(canonical.provenance.contextKind, fixture.contextKind,
      "case_fixture_context_kind_not_engine_derived")
    assert.equal(canonical.provenance.snapshotGeneration, fixture.snapshotGeneration,
      "case_fixture_snapshot_generation_not_engine_derived")
    assertDnaCaseFixtureScenarioInvariants({
      scenario: fixture.scenario,
      contextKind: canonical.provenance.contextKind,
      snapshotGeneration: canonical.provenance.snapshotGeneration,
      expectedIncompatibleTheoryAgeScope: fixture.expectedIncompatibleTheoryAgeScope,
      context: canonical.context,
    })
    const authority = createVerifiedReportCaseAuthorityInternal(
      DNA_OWNED_CASE_CONTEXT_VERSION,
    )
    attachVerifiedReportCaseAuthorityInternal(canonical.context, authority)
    return [fixture.questionId, Object.freeze({ fixture, context: canonical.context })] as const
  }))

  const sourceClaimByRetrievalClaimId = new Map(retrievalPackage.claims
    .map((claim) => [claim.id, claim.sourceClaimId] as const))
  const executeItem = (
    itemId: string,
    questionText: string,
    baseQuestion: DnaLockedBenchmarkQuestion,
    variationKind: string | null,
  ) => {
    const fixtureRecord = fixtureByQuestionId.get(baseQuestion.id) ?? null
    const previousTopic = variationKind === "follow_up" ? baseQuestion.expectedTopic : null
    const inputPayload = Object.freeze({
      schemaVersion: "dna-evaluation-engine-input@1",
      itemId,
      baseQuestionId: baseQuestion.id,
      question: questionText,
      previousTopic,
      responseDepth: "standard",
      caseFixtureId: fixtureRecord?.fixture.id ?? null,
      caseContextSha256: fixtureRecord
        ? dnaCaseContextPayloadSha256(fixtureRecord.context)
        : null,
      sourcePackageSha256: pkg.manifest.packageSha256,
      engineVersion: DNA_V3_RETRIEVAL_ENGINE_VERSION,
      engineCodeHash,
    })
    const answer = resolveDnaV3Retrieval({
      question: questionText,
      previousTopic,
      responseDepth: "standard",
      caseContext: fixtureRecord?.context ?? null,
    }, retrievalPackage)
    const rankedClaimIds = [...new Set(rankDnaV3RetrievalCandidates(
      questionText,
      retrievalPackage,
      { previousTopic },
    ).flatMap((rank) => {
      const sourceClaimId = sourceClaimByRetrievalClaimId.get(rank.claimId)
      return sourceClaimId ? [sourceClaimId] : []
    }))].slice(0, 10)
    return Object.freeze({
      inputSha256: contentSha256(inputPayload),
      outputSha256: contentSha256(answer),
      answer,
      rankedClaimIds: Object.freeze(rankedClaimIds),
      materialAnswerProduced: answer.status === "answer"
        && answer.answerUnits.some((unit) => unit.text.trim().length > 0),
      clarificationCorrect: answer.status === "clarification"
        && (answer.suggestedQuestions.length > 0 || Boolean(answer.contextRequest)),
    })
  }
  const baseExecutionById = new Map(questions.map((question) => [
    question.id,
    executeItem(question.id, question.question, question, null),
  ] as const))
  const questionById = new Map(questions.map((question) => [question.id, question]))
  const variationExecutionById = new Map(variations.map((variation) => {
    const baseQuestion = questionById.get(variation.baseQuestionId)
    if (!baseQuestion) throw new Error("variation_execution_base_question_missing")
    return [variation.id, executeItem(
      variation.id,
      variation.question,
      baseQuestion,
      variation.kind,
    )] as const
  }))

  for (const question of questions) {
    const execution = baseExecutionById.get(question.id)
    if (!execution) throw new Error("forbidden_inference_base_execution_missing")
    const violations = findDnaForbiddenInferenceViolations(
      execution.answer,
      question.forbiddenInferences,
    )
    if (violations.length) {
      throw new Error(`forbidden_inference_violation:${question.id}:${violations.join(",")}`)
    }
    if (containsForbiddenPublicOutputSubstring(
      execution.answer,
      question.forbiddenOutputSubstrings,
    )) throw new Error(`forbidden_output_sentinel_leak:${question.id}`)
  }
  for (const variation of variations) {
    const baseQuestion = questionById.get(variation.baseQuestionId)
    const execution = variationExecutionById.get(variation.id)
    if (!baseQuestion || !execution) {
      throw new Error("forbidden_inference_variation_execution_missing")
    }
    const violations = findDnaForbiddenInferenceViolations(
      execution.answer,
      baseQuestion.forbiddenInferences,
    )
    if (violations.length) {
      throw new Error(`forbidden_inference_variation_violation:${variation.id}:${violations.join(",")}`)
    }
    if (containsForbiddenPublicOutputSubstring(
      execution.answer,
      baseQuestion.forbiddenOutputSubstrings,
    )) throw new Error(`forbidden_output_variation_sentinel_leak:${variation.id}`)
  }

  const retrievalEnvelope = retrievalEnvelopeSchema.parse(readJson(join(
    evaluationRoot, "observations/retrieval.json",
  )))
  const atomEnvelope = atomEnvelopeSchema.parse(readJson(join(
    evaluationRoot, "observations/claim-atoms.json",
  )))
  const safetyEnvelope = safetyEnvelopeSchema.parse(readJson(join(
    evaluationRoot, "observations/safety.json",
  )))
  const caseEnvelope = caseEnvelopeSchema.parse(readJson(join(
    evaluationRoot, "observations/case.json",
  )))
  const sourceSignals = deriveDnaSourceIntegrationSignalsFromAuthoritativePackage(
    pkg,
    DNA_CURRENT_V3_RELEASE_PACKAGE.releasedCandidates,
  )

  for (const envelope of [retrievalEnvelope, atomEnvelope, safetyEnvelope, caseEnvelope]) {
    assert.equal(envelope.sourcePackageSha256, pkg.manifest.packageSha256,
      "evaluation_observation_package_hash_mismatch")
    assert.equal(envelope.benchmarkSha256, lockedManifest.benchmarkSha256,
      "evaluation_observation_benchmark_hash_mismatch")
    assert.equal(envelope.caseFixtureSha256, caseFixtureEnvelope.fixtureSha256,
      "evaluation_observation_case_fixture_hash_mismatch")
  }
  assert.equal(retrievalEnvelope.variationSha256, variationManifest.variationSha256,
    "evaluation_observation_variation_hash_mismatch")
  assertDnaEvaluationRunBindings(
    [retrievalEnvelope, atomEnvelope, safetyEnvelope, caseEnvelope],
    {
      engineVersion: DNA_V3_RETRIEVAL_ENGINE_VERSION,
      engineCodeHash,
      notBefore: lockedManifest.openedAt,
    },
  )

  assertExactIdSet(
    retrievalEnvelope.baseObservations.map((row) => row.id),
    questions.map((row) => row.id),
    "retrieval_observation_question_set_mismatch",
  )
  assertDnaRetrievalObservationsBoundToBenchmark(
    retrievalEnvelope.baseObservations as DnaRetrievalEvaluationObservation[],
    recomputedLocked.questions,
    packageIndex,
  )
  for (const row of retrievalEnvelope.baseObservations) {
    const execution = baseExecutionById.get(row.id)
    if (!execution) throw new Error("retrieval_observation_execution_missing")
    assertDnaEvaluationExecutionDigests(row, execution, "retrieval_observation")
    assert.equal(row.actualTopic, execution.answer.topic,
      "retrieval_observation_actual_topic_mismatch")
    assert.equal(row.actualQueryKind, execution.answer.queryKind,
      "retrieval_observation_actual_query_kind_mismatch")
    assert.equal(row.actualOutcome, execution.answer.status,
      "retrieval_observation_actual_outcome_mismatch")
    assert.deepEqual(row.rankedClaimIds, execution.rankedClaimIds,
      "retrieval_observation_ranked_claims_mismatch")
    assert.equal(row.materialAnswerProduced, execution.materialAnswerProduced,
      "retrieval_observation_material_answer_mismatch")
    assert.equal(row.clarificationCorrect, execution.clarificationCorrect,
      "retrieval_observation_clarification_mismatch")
  }
  assertExactIdSet(
    retrievalEnvelope.variationObservations.map((row) => row.id),
    variations.map((row) => row.id),
    "variation_observation_set_mismatch",
  )
  assertDnaVariationObservationsBoundToBank(
    retrievalEnvelope.variationObservations as DnaVariationEvaluationObservation[],
    recomputedVariations.variations,
    recomputedLocked.questions,
  )
  for (const row of retrievalEnvelope.variationObservations) {
    const execution = variationExecutionById.get(row.id)
    if (!execution) throw new Error("variation_observation_execution_missing")
    assertDnaEvaluationExecutionDigests(row, execution, "variation_observation")
    assert.equal(row.actualTopic, execution.answer.topic,
      "variation_observation_actual_topic_mismatch")
    assert.equal(row.actualQueryKind, execution.answer.queryKind,
      "variation_observation_actual_query_kind_mismatch")
    assert.equal(row.actualOutcome, execution.answer.status,
      "variation_observation_actual_outcome_mismatch")
  }
  const safetyQuestionIds = questions.filter((row) => row.bucket === "safety").map((row) => row.id)
  assertExactIdSet(
    safetyEnvelope.observations.map((row) => row.questionId),
    safetyQuestionIds,
    "safety_observation_question_set_mismatch",
  )
  assertDnaSafetyObservationsBoundToBenchmark(
    safetyEnvelope.observations as DnaSafetyFamilyObservation[],
    recomputedLocked.questions,
  )
  assertExactIdSet(
    caseEnvelope.observations.map((row) => row.questionId),
    caseQuestionIds,
    "case_observation_question_set_mismatch",
  )
  for (const row of safetyEnvelope.observations) {
    const execution = baseExecutionById.get(row.questionId)
    const question = questionById.get(row.questionId)
    if (!execution || !question || !question.requiredSafetyStatement) {
      throw new Error("safety_observation_execution_or_locked_statement_missing")
    }
    assertDnaEvaluationExecutionDigests(row, execution, "safety_observation")
    const safetyText = [
      execution.answer.summary,
      ...execution.answer.details,
      ...execution.answer.limitations,
      execution.answer.safetyBoundary,
      ...execution.answer.answerUnits.map((unit) => unit.text),
    ].join(" ")
    const refusalAndStatementPresent = doesDnaSafetyRefusalSatisfyLockedQuestion({
      status: execution.answer.status,
      outputText: safetyText,
      question,
    })
    assert.equal(row.correctRefusal, refusalAndStatementPresent,
      "safety_observation_refusal_not_engine_derived")
    const protectedContentLeaked = forbiddenOutputKeyPresent(execution.answer)
      || containsForbiddenPublicOutputSubstring(
        execution.answer,
        question.forbiddenOutputSubstrings,
      )
    assert.equal(row.leakedProtectedContent, protectedContentLeaked,
      "safety_observation_leak_not_engine_derived")
  }
  for (const row of caseEnvelope.observations) {
    const execution = baseExecutionById.get(row.questionId)
    const fixtureRecord = fixtureByQuestionId.get(row.questionId)
    const question = questionById.get(row.questionId)
    if (!execution || !fixtureRecord || !question) {
      throw new Error("case_observation_execution_or_fixture_missing")
    }
    assert.equal(row.caseId, fixtureRecord.fixture.id,
      "case_observation_fixture_id_mismatch")
    assert.equal(row.scenario, fixtureRecord.fixture.scenario,
      "case_observation_scenario_fixture_mismatch")
    assertDnaEvaluationExecutionDigests(row, execution, "case_observation")
    const caseFields = execution.answer.answerUnits.flatMap((unit) => unit.caseFieldIds)
    const fieldAllowed = (field: string) => question.allowedReportFields.some((allowed) =>
      field === allowed || field.startsWith(`${allowed}[`))
    const unauthorizedField = caseFields.some((field) => !fieldAllowed(field))
    const hallucinatedReportFinding = !doesDnaV3CaseAnswerMatchContext(
      fixtureRecord.context,
      execution.answer,
    )
    const mixedAnswer = execution.answer.intent === "case_theory"
      && execution.answer.status === "answer"
    const authorities = new Set(execution.answer.answerUnits.map((unit) => unit.authority))
    const separated = !mixedAnswer || (authorities.has("case_report")
      && (authorities.has("external_science") || authorities.has("dna_product"))
      && execution.answer.sections.some((section) => section.kind === "case_non_inference"))
    const allText = [
      execution.answer.summary,
      ...execution.answer.details,
      ...execution.answer.limitations,
      execution.answer.safetyBoundary,
      ...execution.answer.answerUnits.map((unit) => unit.text),
    ].join(" ")
    const biologicalBoundaryPresent = allText.includes(
      "Bu rapor biyolojik mekanizmayı doğrudan ölçmez; rapor bulguları genel literatürle birlikte fakat ondan ayrı değerlendirilmelidir.",
    )
    const scientificUnits = execution.answer.answerUnits.filter((unit) =>
      unit.authority === "external_science" || unit.authority === "dna_product")
    const caseAgeGroup = dnaV3CaseAgeGroupFromMonths(fixtureRecord.fixture.ageMonths)
    const scientificAgeScopesCompatible = !caseAgeGroup || scientificUnits.every((unit) =>
      unit.claimIds.every((claimId) => {
        const claim = pkg.claims.find((candidate) => candidate.id === claimId)
        return Boolean(claim
          && isDnaV3AgeScopeCompatibleWithGroup(claim.ageScope, caseAgeGroup)
          && claim.passageIds.every((passageId) => {
            const passage = pkg.passages.find((candidate) => candidate.id === passageId)
            return Boolean(passage
              && isDnaV3AgeScopeCompatibleWithGroup(passage.ageScope, caseAgeGroup))
          }))
      }))
    const ageBoundaryPreserved = doesDnaV3LockedAgeBoundaryMatchCase(
      question.ageBoundary,
      fixtureRecord.fixture.ageMonths,
    ) && scientificAgeScopesCompatible
    const pendingQuestion = "Bu rapordaki bulguyu genel literatürle birlikte açıkla."
    const changeTransition = planDnaChatReportTransition({
      action: "change_report",
      pendingReportQuestion: pendingQuestion,
    })
    const selectionCoordinator = createDnaChatReportSelectionCoordinator()
    const selectTransition = selectionCoordinator.claim({
      reportId: fixtureRecord.fixture.id,
      pendingReportQuestion: pendingQuestion,
    })
    const duplicateSelectTransition = selectionCoordinator.claim({
      reportId: fixtureRecord.fixture.id,
      pendingReportQuestion: pendingQuestion,
    })
    selectionCoordinator.release()
    const reportChangeIsolationPreserved = changeTransition.clearConversation
      && changeTransition.selectedReportId === null
      && changeTransition.reportPickerOpen
      && changeTransition.previousTopic === null
      && changeTransition.pendingReportQuestion === null
      && changeTransition.resubmitQuestions.length === 0
    const pendingQuestionResubmittedExactlyOnce = Boolean(selectTransition
      && selectTransition.clearConversation
      && selectTransition.selectedReportId === fixtureRecord.fixture.id
      && !selectTransition.reportPickerOpen
      && selectTransition.previousTopic === null
      && selectTransition.pendingReportQuestion === null
      && selectTransition.resubmitQuestions.length === 1
      && selectTransition.resubmitQuestions[0] === pendingQuestion
      && duplicateSelectTransition === null)
    const scenarioBehaviorPreserved = doesDnaCaseAnswerSatisfyScenario(
      fixtureRecord.fixture.scenario,
      execution.answer,
    )
    assertDnaCaseChecksAreEngineDerived(row, {
      unauthorizedSnapshotFieldUsed: unauthorizedField,
      hallucinatedReportFinding,
      mixedAnswer,
      reportTheorySeparated: separated,
      biologicalMeasurementBoundaryPresent: biologicalBoundaryPresent,
      rawDataLeak: forbiddenOutputKeyPresent(execution.answer)
        || containsForbiddenPublicOutputSubstring(
          execution.answer,
          question.forbiddenOutputSubstrings,
        ),
      ageBoundaryPreserved,
      reportChangeIsolationPreserved,
      pendingQuestionResubmittedExactlyOnce,
      scenarioBehaviorPreserved,
    })
  }
  const answeredQuestionIds = questions
    .filter((row) => row.expectedOutcome === "answer")
    .map((row) => row.id)
  const materialEvidenceRequiredResponseIds = answeredQuestionIds.filter((responseId) => {
    const question = questionById.get(responseId)
    const fixture = fixtureByQuestionId.get(responseId)?.fixture
    return question?.bucket === "supported"
      || fixture?.expectedBehavior === "case_scientific_mixed"
  })
  const caseOnlyExemptResponseIds = answeredQuestionIds.filter((responseId) =>
    !materialEvidenceRequiredResponseIds.includes(responseId))
  const requiredMaterialUnitIdsByResponseId = new Map(answeredQuestionIds.map((responseId) => {
    const execution = baseExecutionById.get(responseId)
    if (!execution) throw new Error("claim_atom_answer_execution_missing")
    const evidenceErrors = validateDnaV3AnswerEvidence({
      summary: execution.answer.summary,
      details: execution.answer.details,
      limitations: execution.answer.limitations,
      units: execution.answer.answerUnits,
      sources: execution.answer.sources,
      pkg: retrievalPackage,
    })
    if (evidenceErrors.length) {
      throw new Error(`claim_atom_engine_evidence_invalid:${evidenceErrors.join("|")}`)
    }
    const unitIds = execution.answer.answerUnits
      .filter((unit) => unit.text.trim()
        && (unit.authority === "external_science" || unit.authority === "dna_product"))
      .map((unit) => unit.id)
    if (new Set(unitIds).size !== unitIds.length) {
      throw new Error("claim_atom_engine_duplicate_material_answer_unit_id")
    }
    return [responseId, new Set(unitIds)] as const
  }))
  const allowedClaimPassageKeysByResponseId = new Map(answeredQuestionIds.map((responseId) => {
    const question = questionById.get(responseId)
    if (!question) throw new Error("claim_atom_locked_question_missing")
    return [responseId, new Set(question.acceptableClaimIds.flatMap((claimId) =>
      question.requiredPassageIds
        .filter((passageId) => packageIndex.claimPassageKeys.has(`${claimId}\u0000${passageId}`))
        .map((passageId) => `${claimId}\u0000${passageId}`)))] as const
  }))
  assertExactIdSet(
    [...new Set(atomEnvelope.observations.map((row) => row.responseId))],
    materialEvidenceRequiredResponseIds,
    "claim_atom_response_set_mismatch",
  )
  const staticClaimById = new Map(pkg.claims.map((claim) => [claim.id, claim]))
  const staticPassageById = new Map(pkg.passages.map((passage) => [passage.id, passage]))
  const staticSourceById = new Map(pkg.sources.map((source) => [source.id, source]))
  for (const atom of atomEnvelope.observations) {
    const execution = baseExecutionById.get(atom.responseId)
    const question = questionById.get(atom.responseId)
    if (!execution || !question) throw new Error("claim_atom_execution_or_question_missing")
    assert.equal(atom.responseOutputSha256, execution.outputSha256,
      "claim_atom_response_output_digest_mismatch")
    if (!atom.material) {
      throw new Error("claim_atom_non_material_observation_not_permitted")
    }
    const unit = execution.answer.answerUnits.find((candidate) =>
      candidate.id === atom.answerUnitId)
    const claim = atom.claimId ? staticClaimById.get(atom.claimId) : null
    const passage = atom.passageId ? staticPassageById.get(atom.passageId) : null
    const visibleCard = execution.answer.sources.find((source) =>
      source.supportedClaimId === atom.visibleCitationClaimId
      && source.passageId === atom.visibleCitationPassageId)
    const source = visibleCard ? staticSourceById.get(visibleCard.sourceId) : null
    const packageLinkBound = Boolean(atom.claimId && atom.passageId
      && packageIndex.claimPassageKeys.has(`${atom.claimId}\u0000${atom.passageId}`))
    const lockedAnnotationBound = Boolean(atom.claimId && atom.passageId
      && question.acceptableClaimIds.includes(atom.claimId)
      && question.requiredPassageIds.includes(atom.passageId))
    const unitBound = Boolean(unit && atom.claimId && atom.passageId
      && (unit.authority === "external_science" || unit.authority === "dna_product")
      && unit.text.trim()
      && unit.claimIds.includes(atom.claimId)
      && unit.passageIds.includes(atom.passageId)
      && claim?.passageIds.includes(atom.passageId)
      && claim.sourceIds.every((sourceId) => unit.sourceIds.includes(sourceId)))
    const visibleCardBound = Boolean(atom.visibleCitationClaimId && atom.visibleCitationPassageId
      && atom.visibleCitationClaimId === atom.claimId
      && atom.visibleCitationPassageId === atom.passageId
      && visibleCard
      && Boolean(claim?.sourceIds.includes(visibleCard.sourceId)))
    const releaseAuthorization = DNA_CURRENT_V3_RELEASE_PACKAGE.releasedCandidates.find((candidate) =>
      candidate.claimId === atom.claimId
      && candidate.passageId === atom.passageId
      && candidate.claimSha256 === claim?.sha256
      && candidate.passageSha256 === passage?.sha256
      && candidate.authority === claim?.authority
      && (candidate.authority !== "external_scientific_information"
        || (candidate.sourceId === visibleCard?.sourceId
          && candidate.sourceSha256 === source?.sha256)))
    const releasedCandidateExact = Boolean(releaseAuthorization
      && /^[a-f0-9]{64}$/.test(releaseAuthorization.authorizationDigest)
      && /^[a-f0-9]{64}$/.test(releaseAuthorization.publicationDigest))
    const canonicalTexts = new Set([
      claim?.text ?? "",
      claim?.detail ?? "",
      claim?.claimBoundary ?? "",
      ...pkg.relations.filter((relation) => relation.claimId === claim?.id)
        .map((relation) => relation.summary),
    ].filter(Boolean))
    const canonicalReleasedTextExact = Boolean(unit && canonicalTexts.has(unit.text))
    const sourceBindingExact = Boolean(unit && claim && passage && source && visibleCard
      && passage.sourceId === source.id
      && claim.sourceIds.includes(source.id)
      && unit.sourceIds.includes(source.id)
      && visibleCard.sourceId === source.id)
    const passageBindingExact = Boolean(packageLinkBound && lockedAnnotationBound
      && unitBound && visibleCardBound && passage)
    const reviewAuthorizationExact = releasedCandidateExact
      && pkg.manifest.releasePackageInputSha256 === DNA_CURRENT_V3_RELEASE_PACKAGE.inputSha256
    const studyDesignMetadataExact = Boolean(source && visibleCard
      && source.studyDesign.trim()
      && visibleCard.sourceType === source.studyDesign)
    const ageMetadataExact = Boolean(claim && passage && visibleCard
      && visibleCard.ageScope === claim.ageScope
      && claim.ageScope.trim()
      && passage.ageScope.trim())
    const normalizedAgeBoundary = normalizeComparableText(question.ageBoundary)
      .replace(/ /g, "_")
    const requestedAgeGroup = DNA_V3_AGE_GROUPS.find((group) =>
      group === normalizedAgeBoundary) ?? null
    const genericAgeBoundary = new Set(["mixed", "all_ages", "not_applicable"])
      .has(normalizedAgeBoundary)
    const ageQueryCompatible = Boolean(claim && passage && (
      genericAgeBoundary
      || (requestedAgeGroup
        && dnaV3AgeGroupsForScope(claim.ageScope).has(requestedAgeGroup)
        && dnaV3AgeGroupsForScope(passage.ageScope).has(requestedAgeGroup))
    ))
    const visibleEvidenceText = [
      execution.answer.summary,
      ...execution.answer.details,
      ...execution.answer.limitations,
      execution.answer.safetyBoundary,
      ...execution.answer.answerUnits.map((answerUnit) => answerUnit.text),
      ...execution.answer.sources.flatMap((card) => [
        card.supportedClaim,
        card.knownBoundary,
        card.supportedBoundary,
      ]),
    ].join(" ")
    const semanticMetadata = normalizeComparableText([
      claim?.claimType ?? "",
      claim?.claimBoundary ?? "",
      passage?.claimBoundary ?? "",
      passage?.population ?? "",
    ].join(" "))
    const normalizedUnitText = normalizeComparableText(unit?.text ?? "")
    const associationLimited = /(?:associat|correl|gozlemsel|iliski|baglanti)/
      .test(semanticMetadata)
    const causalEscalation = /(?:neden olur|sebep olur|yol acar|kesin olarak belirler|causes|leads to|results in)/
      .test(normalizedUnitText)
    const causalityGuardPass = !associationLimited || !causalEscalation
    const animalPopulation = /(?:animal|mouse|mice|rat|rodent|hayvan|fare|sican)/
      .test(normalizeComparableText(passage?.population ?? ""))
    const visibleAnimalBoundary = /(?:animal|mouse|mice|rat|rodent|hayvan|fare|sican)/
      .test(normalizeComparableText(visibleEvidenceText))
    const unqualifiedHumanization = /(?:insanlarda|cocuklarda|ergenlerde|yetiskinlerde|patients|participants|humans)/
      .test(normalizedUnitText)
    const animalPopulationGuardPass = !animalPopulation
      || (visibleAnimalBoundary && !unqualifiedHumanization)
    const theoryLimited = claim?.dnaRelation === "theory_only"
      || /(?:theory|teori|hipotez|model)/.test(semanticMetadata)
    const theoryBoundaryGuardPass = !theoryLimited
      || /(?:theory|teori|hipotez|model|oner)/
        .test(normalizeComparableText(visibleEvidenceText))
    const retrievalClaim = retrievalPackage.claims.find((candidate) =>
      candidate.sourceClaimId === claim?.id)
    const dnaRelationshipMetadataExact = Boolean(claim && retrievalClaim
      && retrievalClaim.dnaRelationship === claim.dnaRelation
      && retrievalClaim.authority === claim.authority)
    const exactClaimBoundaryVisible = Boolean(claim?.claimBoundary
      && textContainsBoundary(visibleEvidenceText, claim.claimBoundary))
    const expectedDnaRelationshipBoundary = retrievalClaim
      ? dnaV3RelationshipBoundary(retrievalClaim.dnaRelationship)
      : null
    const dnaRelationshipBoundaryVisible = dnaRelationshipMetadataExact
      && Boolean(claim)
      && isDnaRelationshipPolicyBoundaryExact({
        expectedBoundary: expectedDnaRelationshipBoundary,
        expectedUnitIdSuffix: `policy::${claim!.id}-dna-boundary`,
        answerUnits: execution.answer.answerUnits,
        limitations: execution.answer.limitations,
      })
    const uncertaintyMetadataExact = Boolean(claim && visibleCard
      && visibleCard.evidenceLevel === claim.evidenceLevel
      && visibleCard.knownBoundary === claim.claimBoundary)
    const uncertaintyBoundaryVisible = uncertaintyMetadataExact
      && exactClaimBoundaryVisible
    const derivedChecks = deriveDnaAnswerAtomSemanticChecks({
      releasedCandidateExact,
      sourceBindingExact,
      passageBindingExact,
      canonicalReleasedTextExact,
      phase20SourceFidelityAuthorized: reviewAuthorizationExact,
      phase21MethodAuthorized: reviewAuthorizationExact,
      phase23ClinicalSafetyAuthorized: reviewAuthorizationExact,
      phase24TurkishTransferAuthorized: reviewAuthorizationExact,
      publicationBoundaryAuthorized: reviewAuthorizationExact,
      studyDesignMetadataExact,
      ageMetadataExact,
      ageQueryCompatible,
      causalityGuardPass,
      animalPopulationGuardPass,
      theoryBoundaryGuardPass,
      dnaRelationshipMetadataExact,
      dnaRelationshipBoundaryVisible,
      uncertaintyMetadataExact,
      uncertaintyBoundaryVisible,
    })
    assertDnaAnswerAtomChecksAreEngineDerived(atom, derivedChecks)
  }

  const sourceIntegration = evaluateDnaSourceIntegrationGate(pkg, sourceSignals)
  const retrieval = evaluateDnaRetrievalGate({
    baseObservations: retrievalEnvelope.baseObservations as DnaRetrievalEvaluationObservation[],
    variationObservations: retrievalEnvelope.variationObservations as DnaVariationEvaluationObservation[],
    engineVerifiedBaseIds: new Set(baseExecutionById.keys()),
    engineVerifiedVariationIds: new Set(variationExecutionById.keys()),
    requiredReleasedTopicIds: packageIndex.releasedTopicIds,
    minimumSupportedExamplesPerReleasedTopic: 2,
  })
  const citation = evaluateDnaClaimCitationGate(
    atomEnvelope.observations as DnaAnswerAtomAudit[],
    packageIndex,
    answeredQuestionIds,
    new Map([...baseExecutionById].map(([questionId, execution]) =>
      [questionId, execution.outputSha256] as const)),
    requiredMaterialUnitIdsByResponseId,
    allowedClaimPassageKeysByResponseId,
    materialEvidenceRequiredResponseIds,
    caseOnlyExemptResponseIds,
  )
  const safety = evaluateDnaSafetyGate(
    safetyEnvelope.observations as DnaSafetyFamilyObservation[],
    new Set(safetyEnvelope.observations.map((row) => row.questionId)),
  )
  const cases = evaluateDnaCaseAccuracyGate(
    caseEnvelope.observations as DnaCaseEvaluationObservation[],
    new Set(caseEnvelope.observations.map((row) => row.questionId)),
  )
  const statuses = {
    sourceIntegration: sourceIntegration.releaseReady ? "pass" : "fail",
    retrieval: retrieval.status,
    citation: citation.status,
    safety: safety.status,
    cases: cases.status,
  }
  console.log(JSON.stringify({
    ok: Object.values(statuses).every((status) => status === "pass"),
    dataRoot: evaluationRoot,
    packageSha256: pkg.manifest.packageSha256,
    benchmarkSha256: lockedManifest.benchmarkSha256,
    variationSha256: variationManifest.variationSha256,
    engineVersion: DNA_V3_RETRIEVAL_ENGINE_VERSION,
    engineSourceCount: exactEngineSourceClosure.length,
    engineCodeHash,
    runId: retrievalEnvelope.runId,
    evaluatedAt: retrievalEnvelope.evaluatedAt,
    sourceIntegrationEvidence: "derived_from_validated_static_package_and_release_registry",
    statuses,
  }, null, 2))
  if (Object.values(statuses).some((status) => status !== "pass")) {
    console.error("DNA evaluation release check: NO-GO")
    process.exitCode = 1
  } else {
    console.log("DNA evaluation release check: GO")
  }
} catch (error) {
  console.error("DNA evaluation release check: NO-GO")
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}

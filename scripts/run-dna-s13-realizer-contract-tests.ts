import assert from "node:assert/strict"

import {
  DNA_S13_QUERY_FRAME_VERSION,
  type DnaS13Claim,
  type DnaS13QueryFrame,
} from "../src/lib/dna/chat/s13/contracts"
import {
  classifyDnaS13Privacy,
  serializeDnaS13TrainingJsonl,
  toDnaS13TrainingExportRecord,
} from "../src/lib/dna/chat/s13/strictProvenance"
import {
  DNA_S13_DETERMINISTIC_REALIZER_VERSION,
  DNA_S13_REALIZER_CONTRACT_VERSION,
  DeterministicRealizer,
  createDnaS13DeterministicRealization,
  type DnaS13RealizerAttempt,
  type DnaS13RealizerRequest,
  type LocalRealizer,
} from "../src/lib/dna/chat/s13/strictRealizer"
import {
  runDnaS13StrictRuntime,
  runDnaS13StrictShadow,
} from "../src/lib/dna/chat/s13/strictRuntime"
import {
  DNA_S13_STRICT_PLAN_VERSION,
  DNA_S13_STRICT_REALIZATION_VERSION,
  type DnaS13StrictPlan,
} from "../src/lib/dna/chat/s13/strictContracts"

const requiredClaim: DnaS13Claim = Object.freeze({
  id: "claim.hrv.measurement",
  text: "HRV ölçümü kalp atımları arasındaki zaman değişkenliğini inceler.",
  passageId: "passage.hrv.1",
  sourceIds: Object.freeze(["source.hrv.1"]),
  topicId: "ans.hrv",
  focus: "measurement",
})
const explanatoryClaim: DnaS13Claim = Object.freeze({
  id: "claim.hrv.context",
  text: "Kayıt koşulları ve artefakt kontrolü yorumun güvenilirliğini etkiler.",
  passageId: "passage.hrv.2",
  sourceIds: Object.freeze(["source.hrv.1"]),
  topicId: "ans.hrv",
  focus: "measurement",
})

const frame: DnaS13QueryFrame = Object.freeze({
  version: DNA_S13_QUERY_FRAME_VERSION,
  normalizedQuestion: "HRV nasıl ölçülür?",
  responseDepth: "standard",
  uncertain: false,
  subquestions: Object.freeze([Object.freeze({
    id: "q1",
    question: "HRV nasıl ölçülür?",
    intent: "scientific_question" as const,
    topicId: "ans.hrv",
    focus: "measurement" as const,
    questionType: "measurement" as const,
    followUp: false,
    correction: false,
    comparisonTargetTopicIds: Object.freeze([]),
    answerabilityHint: "supported" as const,
  })]),
})

const plan: DnaS13StrictPlan = Object.freeze({
  version: DNA_S13_STRICT_PLAN_VERSION,
  responseDepth: "standard",
  slots: Object.freeze([Object.freeze({
    id: "strict-slot-1",
    subquestionId: "q1",
    question: "HRV nasıl ölçülür?",
    topicId: "ans.hrv",
    focus: "measurement" as const,
    questionType: "measurement" as const,
    comparisonTargetTopicIds: Object.freeze([]),
    lockedClaims: Object.freeze([
      Object.freeze({ claim: requiredClaim, role: "required" as const }),
      Object.freeze({ claim: explanatoryClaim, role: "explanatory" as const }),
    ]),
    requiredClaimIds: Object.freeze([requiredClaim.id]),
    lockedClaimIds: Object.freeze([requiredClaim.id, explanatoryClaim.id]),
    sourceIds: Object.freeze(["source.hrv.1"]),
  })]),
  lockedClaimIds: Object.freeze([requiredClaim.id, explanatoryClaim.id]),
  sourceIds: Object.freeze(["source.hrv.1"]),
})

const catalog = Object.freeze({ version: "catalog@test", hash: "a".repeat(64) })
const retrieval = Object.freeze({ version: "retrieval@test", hash: "b".repeat(64) })

async function main() {
  const syntheticPrivacy = classifyDnaS13Privacy({
    question: "HRV nasıl ölçülür?",
    context: "synthetic",
  })
  assert.equal(syntheticPrivacy.category, "synthetic_non_sensitive")
  assert.equal(syntheticPrivacy.automaticTrainingAllowed, true)

  const deterministic = new DeterministicRealizer()
  assert.equal(deterministic.identity.provider, "deterministic")
  assert.equal(deterministic.identity.implementationVersion, DNA_S13_DETERMINISTIC_REALIZER_VERSION)

  const accepted = await runDnaS13StrictRuntime({
    question: "HRV nasıl ölçülür?",
    normalizedQuestion: frame.normalizedQuestion,
    queryFrame: frame,
    plan,
    realizer: deterministic,
    catalog,
    retrieval,
    privacy: syntheticPrivacy,
  })
  assert.equal(accepted.status, "realized")
  assert.equal(accepted.provenance.status, "accepted")
  assert.equal(accepted.provenance.realizer.provider, "deterministic")
  assert.deepEqual(accepted.provenance.requiredClaimIds, [requiredClaim.id])
  assert.deepEqual(accepted.provenance.explanatoryClaimIds, [explanatoryClaim.id])
  assert.equal(accepted.provenance.training_candidate, true)
  assert.equal(accepted.provenance.exclude_from_training, false)
  assert.equal(accepted.provenance.exclusion_reason, null)
  assert.match(accepted.provenance.prompt.hash, /^[a-f0-9]{64}$/)
  assert.match(accepted.provenance.validator.hash, /^[a-f0-9]{64}$/)
  assert.match(accepted.provenance.provenanceHash, /^[a-f0-9]{64}$/)
  assert.equal(accepted.provenance.costMicrousd, 0)
  assert.ok(accepted.provenance.rawFirstOutput)

  const exportRecord = toDnaS13TrainingExportRecord(accepted.provenance)
  assert.ok(exportRecord)
  assert.deepEqual(Object.keys(exportRecord!).sort(), [
    "approved_claims", "locked_plan", "metadata", "query_frame", "question", "schema_version", "target_answer",
  ])
  assert.deepEqual(exportRecord?.approved_claims.map((claim) => claim.id), [requiredClaim.id, explanatoryClaim.id])
  const jsonl = serializeDnaS13TrainingJsonl([accepted.provenance])
  assert.equal(jsonl.trim().split("\n").length, 1)
  assert.equal(JSON.parse(jsonl).target_answer, accepted.answer)

  const clinicalPrivacy = classifyDnaS13Privacy({
    question: "Bu danışanın raporundaki HRV sonucu ne anlama geliyor?",
    context: "general",
  })
  assert.equal(clinicalPrivacy.category, "clinical_case")
  assert.equal(clinicalPrivacy.automaticTrainingAllowed, false)
  const clinical = await runDnaS13StrictRuntime({
    question: "Bu danışanın raporundaki HRV sonucu ne anlama geliyor?",
    normalizedQuestion: "Bu danışanın raporundaki HRV sonucu ne anlama geliyor?",
    queryFrame: frame,
    plan,
    realizer: deterministic,
    catalog,
    retrieval,
    privacy: clinicalPrivacy,
  })
  assert.equal(clinical.provenance.training_candidate, false)
  assert.equal(clinical.provenance.exclude_from_training, true)
  assert.equal(clinical.provenance.exclusion_reason, "privacy_sensitive")
  assert.equal(toDnaS13TrainingExportRecord(clinical.provenance), null)
  assert.equal(serializeDnaS13TrainingJsonl([clinical.provenance]), "")

  let rejectedCalls = 0
  const rejectedLocal: LocalRealizer = {
    identity: Object.freeze({
      provider: "local",
      model: "unimplemented-local-test-double",
      implementationVersion: "local-test-double@1",
    }),
    async realize(input: DnaS13RealizerRequest): Promise<DnaS13RealizerAttempt> {
      rejectedCalls += 1
      const realization = Object.freeze({
        version: DNA_S13_STRICT_REALIZATION_VERSION,
        unsupportedAddition: true,
        slotRealizations: Object.freeze([Object.freeze({
          slotId: "strict-slot-1",
          text: "Bu değer kesin tanı koyar ve 20 dakikada sonucu kanıtlar.",
          usedClaimIds: Object.freeze([requiredClaim.id, explanatoryClaim.id]),
        })]),
      })
      return Object.freeze({
        contractVersion: DNA_S13_REALIZER_CONTRACT_VERSION,
        identity: this.identity,
        prompt: Object.freeze({ version: "local-test-prompt@1", hash: `${input.attempt === "repair" ? "d" : "c"}`.repeat(64) }),
        realization,
        rawOutput: JSON.stringify(realization),
        responseId: null,
        usage: Object.freeze({ inputTokens: 10, cachedInputTokens: 0, outputTokens: 5, costMicrousd: 0 }),
        latencyMs: 2,
      })
    },
  }
  const fallback = await runDnaS13StrictRuntime({
    question: "HRV nasıl ölçülür?",
    normalizedQuestion: frame.normalizedQuestion,
    queryFrame: frame,
    plan,
    realizer: rejectedLocal,
    catalog,
    retrieval,
    privacy: syntheticPrivacy,
  })
  assert.equal(rejectedCalls, 2)
  assert.equal(fallback.status, "deterministic_fallback")
  assert.equal(fallback.provenance.status, "fallback")
  assert.ok(fallback.provenance.rawRepairOutput)
  assert.equal(fallback.provenance.training_candidate, false)
  assert.equal(fallback.provenance.exclusion_reason, "fallback_or_rejected")
  assert.equal(fallback.provenance.usage.inputTokens, 20)
  assert.equal(fallback.provenance.latencyMs, 4)

  const localPassing: LocalRealizer = {
    identity: Object.freeze({
      provider: "local",
      model: "unimplemented-local-test-double",
      implementationVersion: "local-test-double@1",
    }),
    async realize(input) {
      const realization = createDnaS13DeterministicRealization(input.plan)
      return Object.freeze({
        contractVersion: DNA_S13_REALIZER_CONTRACT_VERSION,
        identity: this.identity,
        prompt: Object.freeze({ version: "local-test-prompt@1", hash: "e".repeat(64) }),
        realization,
        rawOutput: JSON.stringify(realization),
        responseId: null,
        usage: Object.freeze({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0 }),
        latencyMs: 0,
      })
    },
  }
  const shadow = await runDnaS13StrictShadow({
    primary: {
      question: "HRV nasıl ölçülür?",
      normalizedQuestion: frame.normalizedQuestion,
      queryFrame: frame,
      plan,
      realizer: deterministic,
      catalog,
      retrieval,
      privacy: syntheticPrivacy,
    },
    shadow: { realizer: localPassing },
  })
  assert.equal(shadow.publicAnswer, shadow.primary.answer)
  assert.equal(shadow.shadow.displayEligible, false)
  assert.equal(shadow.comparison.primaryProvider, "deterministic")
  assert.equal(shadow.comparison.shadowProvider, "local")
  assert.equal(shadow.comparison.exactAnswerMatch, true)
  assert.equal(shadow.shadow.result.provenance.training_candidate, false)
  assert.equal(shadow.shadow.result.provenance.exclusion_reason, "not_requested")

  console.log(JSON.stringify({
    ok: true,
    realizerContract: DNA_S13_REALIZER_CONTRACT_VERSION,
    provenanceFieldsVerified: true,
    privacyExclusionVerified: true,
    jsonlPreparedWithoutExport: true,
    shadowDisplayEligible: shadow.shadow.displayEligible,
  }))
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

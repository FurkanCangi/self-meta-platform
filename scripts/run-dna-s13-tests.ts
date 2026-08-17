import assert from "node:assert/strict"

import {
  DNA_S13_QUERY_FRAME_VERSION,
  DNA_S13_REALIZATION_VERSION,
  preservesDnaS13QuestionMeaning,
  validateDnaS13QueryFrame,
  validateDnaS13Realization,
  type DnaS13Claim,
  type DnaS13QueryFrame,
  type DnaS13RetrievalPackage,
} from "../src/lib/dna/chat/s13/contracts"
import {
  DNA_S13_CONTEXT_TTL_MS,
  openDnaS13ConversationState,
  sealDnaS13ConversationState,
} from "../src/lib/dna/chat/s13/contextToken"
import { createDnaS13AnswerPlan, createDnaS13RequiredSlots } from "../src/lib/dna/chat/s13/planner"
import { runDnaS13Pipeline } from "../src/lib/dna/chat/s13/pipeline"
import { validateDnaS13GroundedRealization } from "../src/lib/dna/chat/s13/validator"
import { validateDnaS13StrictRealization } from "../src/lib/dna/chat/s13/strictContracts"
import { retrieveDnaS13TwoSidedComparison } from "../src/lib/dna/chat/s13/strictComparison"
import { runDnaS13StrictPipeline } from "../src/lib/dna/chat/s13/strictPipeline"
import {
  createDnaS13SimplifyEvidenceLimitation,
  createDnaS13StrictPlan,
  dnaS13ExplanatoryRelevanceReasons,
  isDnaS13DirectlyExplanatory,
  resolveDnaS13FacetEvidence,
} from "../src/lib/dna/chat/s13/strictPlanner"
import { detectDnaS13Relations } from "../src/lib/dna/chat/s13/strictRelations"
import { validateDnaS13StrictGrounding } from "../src/lib/dna/chat/s13/strictValidator"
import { resolveDnaTournamentComponentPlan } from "../src/lib/dna/chat/tournament/componentFlags"

const topics = ["ans.hrv", "ans.interoception"]
const parsed = validateDnaS13QueryFrame({
  normalizedQuestion: "HRV çocuklarda nasıl ölçülür?",
  responseDepth: "standard",
  uncertain: false,
  subquestions: [{
    id: "q1",
    question: "HRV çocuklarda nasıl ölçülür?",
    intent: "scientific_question",
    topicId: "ans.hrv",
    focus: "measurement",
    questionType: "measurement",
    followUp: false,
    correction: false,
    comparisonTargetTopicIds: [],
    answerabilityHint: "supported",
  }],
}, topics)
assert.ok(parsed)
assert.equal(parsed?.version, DNA_S13_QUERY_FRAME_VERSION)
assert.equal(preservesDnaS13QuestionMeaning("HRV çocuklarda nasıl ölçülür?", parsed!), true)
assert.equal(preservesDnaS13QuestionMeaning("HRV yetişkinlerde nasıl ölçülür?", parsed!), false)

const dailySimplifyLimitation = createDnaS13SimplifyEvidenceLimitation(
  "Bunu daha sade ve günlük Türkçeyle söyler misin?",
  ["definition"],
)
const conciseSimplifyLimitation = createDnaS13SimplifyEvidenceLimitation(
  "Aynı anlamı koruyup bir cümleyle daha yalın söyler misin?",
  ["definition"],
)
assert.match(dailySimplifyLimitation, /günlük dille/u)
assert.match(conciseSimplifyLimitation, /daha yalın/u)
assert.notEqual(dailySimplifyLimitation, conciseSimplifyLimitation)

assert.equal(validateDnaS13QueryFrame({
  normalizedQuestion: "İki konu",
  responseDepth: "standard",
  uncertain: false,
  subquestions: [1, 2, 3],
}, topics), null, "QueryFrame must contain at most two subquestions")
assert.equal(validateDnaS13QueryFrame({
  normalizedQuestion: "HRV ile interosepsiyonu karşılaştır",
  responseDepth: "standard",
  uncertain: false,
  subquestions: [{
    id: "q1", question: "Karşılaştır", intent: "scientific_question", topicId: "ans.hrv",
    focus: "comparison", questionType: "comparison", followUp: false, correction: false,
    comparisonTargetTopicIds: ["ans.hrv"], answerabilityHint: "supported",
  }],
}, topics), null, "A comparison must have exactly two targets")

const secret = "s13-context-secret-for-tests-at-least-32-bytes"
const now = 1_786_200_000_000
const token = sealDnaS13ConversationState({
  topicIds: ["ans.hrv", "ans.interoception"],
  focus: "comparison",
  questionType: "comparison",
  responseDepth: "deep",
  secret,
  now,
})
assert.equal(token.includes("ans.hrv"), false)
assert.equal(token.includes("claim"), false)
assert.deepEqual(openDnaS13ConversationState({ token, secret, now: now + 1_000 })?.topicIds, topics)
assert.equal(openDnaS13ConversationState({ token: `${token}x`, secret, now: now + 1_000 }), null)
assert.equal(openDnaS13ConversationState({ token, secret, now: now + DNA_S13_CONTEXT_TTL_MS }), null)

const claims: DnaS13Claim[] = [{
  id: "claim.hrv.measurement",
  text: "HRV ölçümü, kalp atımları arasındaki zaman değişkenliğini uygun kayıt ve artefakt kontrolüyle inceler.",
  passageId: "passage.hrv.1",
  sourceIds: ["source.hrv.1"],
  topicId: "ans.hrv",
  focus: "measurement",
}]
const slots = createDnaS13RequiredSlots({ frame: parsed!, claimsBySubquestion: { q1: claims } })
assert.equal(slots.length, 1)
assert.deepEqual(slots[0]?.requiredClaimIds, [claims[0]?.id])
const plan = createDnaS13AnswerPlan(slots)
assert.deepEqual(plan.orderedSlotIds, ["slot-1"])

const validRealization = validateDnaS13Realization({
  answer: claims[0]?.text,
  coveredSlots: ["slot-1"],
  usedClaimIds: [claims[0]?.id],
  usedSourceIds: ["source.hrv.1"],
  unsupportedAddition: false,
})
assert.ok(validRealization)
assert.equal(validRealization?.version, DNA_S13_REALIZATION_VERSION)
assert.equal(validateDnaS13GroundedRealization({ realization: validRealization!, claims, slots }).pass, true)

const invented = validateDnaS13Realization({
  answer: `${claims[0]?.text} Kesin olarak hastalığa neden olur ve 20 dakikada ölçülür.`,
  coveredSlots: ["slot-1"],
  usedClaimIds: [claims[0]?.id],
  usedSourceIds: ["source.hrv.1"],
  unsupportedAddition: false,
})!
const inventedValidation = validateDnaS13GroundedRealization({ realization: invented, claims, slots })
assert.equal(inventedValidation.pass, false)
assert.ok(inventedValidation.failureCodes.includes("invented_number"))
assert.ok(inventedValidation.failureCodes.includes("causality_escalated"))

const retrieval: DnaS13RetrievalPackage = {
  engine: "S1",
  confidence: 0.8,
  runnerUpMargin: 0.2,
  lexicalTopicId: "ans.hrv",
  ftrlTopicId: "ans.hrv",
  claims,
  slots,
}
async function runPipelineAssertions() {
let realizationCall = 0
const repaired = await runDnaS13Pipeline({
  variant: "S13-A",
  deterministicFallback: "fallback",
  query: async () => parsed!,
  retrieveS1: () => retrieval,
  retrieveS2: () => retrieval,
  realize: async () => {
    realizationCall += 1
    return realizationCall === 1 ? invented : validRealization
  },
})
assert.equal(repaired.status, "repaired")
assert.equal(repaired.providerCalls, 3)
assert.equal(repaired.answer, claims[0]?.text)

const permanentFailure = await runDnaS13Pipeline({
  variant: "S13-A",
  deterministicFallback: "fallback",
  query: async () => parsed!,
  retrieveS1: () => retrieval,
  retrieveS2: () => retrieval,
  realize: async () => invented,
})
assert.equal(permanentFailure.status, "deterministic_fallback")
assert.equal(permanentFailure.providerCalls, 3)
assert.equal(permanentFailure.answer, "fallback")

const strictSecondClaim: DnaS13Claim = {
  id: "claim.interoception.definition",
  text: "İnterosepsiyon, bedenin içinden gelen sinyallerin algılanması ve anlamlandırılmasıyla ilgilidir.",
  passageId: "passage.interoception.1",
  sourceIds: ["source.interoception.1"],
  topicId: "ans.interoception",
  focus: "definition",
  sectionId: "section.interoception",
  answerEligible: true,
}
const strictNeighbor: DnaS13Claim = {
  id: "claim.hrv.context",
  text: "Kayıt koşulları ve artefakt kontrolü HRV ölçümünün yorumlanmasını etkiler.",
  passageId: "passage.hrv.2",
  sourceIds: ["source.hrv.1"],
  topicId: "ans.hrv",
  focus: "measurement",
  sectionId: "section.hrv",
  answerEligible: true,
}
const strictFrame: DnaS13QueryFrame = {
  version: DNA_S13_QUERY_FRAME_VERSION,
  normalizedQuestion: "HRV nasıl ölçülür ve interosepsiyon nedir?",
  responseDepth: "standard",
  uncertain: false,
  subquestions: [
    { ...parsed!.subquestions[0]!, id: "q1", questionType: "explanation", focus: "measurement" },
    {
      id: "q2", question: "İnterosepsiyon nedir?", intent: "scientific_question",
      topicId: "ans.interoception", focus: "definition", questionType: "definition",
      followUp: false, correction: false, comparisonTargetTopicIds: [], answerabilityHint: "supported",
    },
  ],
}
const strictClaims = [{ ...claims[0]!, sectionId: "section.hrv", answerEligible: true }, strictSecondClaim]
const strictPlan = createDnaS13StrictPlan({
  frame: strictFrame,
  requiredClaimsBySubquestion: { q1: [strictClaims[0]!], q2: [strictSecondClaim] },
  explanatoryCandidatesBySubquestion: { q1: [strictNeighbor], q2: [] },
})
assert.equal(strictPlan.slots.length, 2)
assert.deepEqual(strictPlan.slots[0]?.lockedClaimIds, [strictClaims[0]?.id, strictNeighbor.id])
assert.deepEqual(strictPlan.slots[1]?.requiredClaimIds, [strictSecondClaim.id])

const strictValid = validateDnaS13StrictRealization({
  slotRealizations: [
    { slotId: "strict-slot-1", text: `${strictClaims[0]?.text} ${strictNeighbor.text}`, usedClaimIds: [strictClaims[0]?.id, strictNeighbor.id] },
    { slotId: "strict-slot-2", text: strictSecondClaim.text, usedClaimIds: [strictSecondClaim.id] },
  ],
  unsupportedAddition: false,
}, strictPlan.slots.map((slot) => slot.id), strictPlan.lockedClaimIds)
assert.ok(strictValid)
const strictValidation = validateDnaS13StrictGrounding({ plan: strictPlan, realization: strictValid! })
assert.equal(strictValidation.pass, true)
assert.equal(strictValidation.requiredSlotCoveragePercent, 100)
assert.equal(strictValidation.requiredClaimCoveragePercent, 100)

const facetClaims: DnaS13Claim[] = [
  {
    ...strictClaims[0]!,
    id: "owner.unit:facet-definition",
    text: "Düzenleme, kişinin durumunu bağlama göre ayarlayabilmesini ifade eden geniş bir kavramdır.",
    dimensions: ["definition"],
  },
  {
    ...strictClaims[0]!,
    id: "owner.unit:facet-function",
    text: "Bu kapasite günlük etkinliklere katılım ve değişen taleplere uyum ile ilişkilidir.",
    dimensions: ["daily_function"],
  },
  {
    ...strictClaims[0]!,
    id: "owner.unit:facet-example",
    text: "Çocuk oyun sırasında sırasını bekleyip etkinliğe yeniden dönebilir.",
    dimensions: ["process"],
  },
]
const facetFrame: DnaS13QueryFrame = {
  ...strictFrame,
  subquestions: [{
    ...strictFrame.subquestions[0]!,
    id: "q1",
    question: "Temel anlamını, işlevini, sınırını ve bir örneğini açıkla.",
    topicId: "ans.hrv",
    questionType: "explanation",
    requestedFacets: ["core_scope", "function", "boundary", "verified_example"],
  }],
}
const facetResolution = resolveDnaS13FacetEvidence({
  subquestionId: "q1",
  topicId: "ans.hrv",
  requestedFacets: facetFrame.subquestions[0]!.requestedFacets!,
  candidates: facetClaims,
})
assert.equal(facetResolution.matrix.find((row) => row.facet === "core_scope")?.status, "SUPPORTED_DIRECT")
assert.equal(facetResolution.matrix.find((row) => row.facet === "function")?.status, "SUPPORTED_DIRECT")
assert.equal(facetResolution.matrix.find((row) => row.facet === "boundary")?.status, "UNSUPPORTED")
assert.equal(facetResolution.matrix.find((row) => row.facet === "verified_example")?.status, "SUPPORTED_DIRECT")
assert.equal(facetResolution.matrix.some((row) => row.supportClaimIds.some((id) => id.startsWith("system.facet-boundary:"))), false)
const facetPlan = createDnaS13StrictPlan({
  frame: facetFrame,
  requiredClaimsBySubquestion: { q1: Object.values(facetResolution.claimsByFacet).flat() },
  requiredClaimsByFacetBySubquestion: { q1: facetResolution.claimsByFacet },
  facetEvidenceBySubquestion: { q1: facetResolution.matrix },
})
assert.equal(facetPlan.lockedClaimIds.some((id) => id.startsWith("system.facet-boundary:")), false)
assert.equal(facetPlan.evidenceLimitation?.unsupportedFacets.includes("boundary"), true)
assert.equal(facetPlan.slots.filter((slot) => slot.kind === "evidence_limitation").length, 1)
const facetRealization = validateDnaS13StrictRealization({
  slotRealizations: facetPlan.slots.map((slot) => ({
    slotId: slot.id,
    text: slot.controlledText ?? slot.lockedClaims.map((entry) => entry.claim.text).join(" "),
    usedClaimIds: slot.lockedClaimIds,
  })),
  unsupportedAddition: false,
}, facetPlan.slots.map((slot) => slot.id), facetPlan.lockedClaimIds)!
const facetValidation = validateDnaS13StrictGrounding({ plan: facetPlan, realization: facetRealization })
assert.equal(facetValidation.pass, true)
assert.equal(facetValidation.requestedFacetCount, 4)
assert.equal(facetValidation.directSupportedFacetCount, 3)
assert.equal(facetValidation.derivedSupportedFacetCount, 0)
assert.equal(facetValidation.unsupportedFacetCount, 1)
assert.equal(facetValidation.omittedSupportedFacetCount, 0)
const functionClaimId = facetResolution.matrix.find((row) => row.facet === "function")!.supportClaimIds[0]!
const omittedFacetRealization = {
  ...facetRealization,
  slotRealizations: facetRealization.slotRealizations.map((slot) => slot.usedClaimIds.includes(functionClaimId)
    ? { ...slot, usedClaimIds: [], text: "Bu konu kısaca ele alınabilir." }
    : slot),
}
const omittedFacetValidation = validateDnaS13StrictGrounding({ plan: facetPlan, realization: omittedFacetRealization })
assert.ok(omittedFacetValidation.failureCodes.includes("SUPPORTED_FACET_OMITTED"))
assert.equal(omittedFacetValidation.omittedSupportedFacetCount, 1)
const jargonRealization = {
  ...facetRealization,
  slotRealizations: facetRealization.slotRealizations.map((slot, index) => index === 0
    ? { ...slot, text: `${slot.text} Bu facet kilitli içerikte yer alır.` }
    : slot),
}
assert.ok(validateDnaS13StrictGrounding({ plan: facetPlan, realization: jargonRealization })
  .failureCodes.includes("internal_evidence_jargon"))

const strictSubstitution = validateDnaS13StrictRealization({
  slotRealizations: [
    { slotId: "strict-slot-1", text: strictSecondClaim.text, usedClaimIds: [strictSecondClaim.id] },
    { slotId: "strict-slot-2", text: strictSecondClaim.text, usedClaimIds: [strictSecondClaim.id] },
  ],
  unsupportedAddition: false,
}, strictPlan.slots.map((slot) => slot.id), strictPlan.lockedClaimIds)!
const strictSubstitutionValidation = validateDnaS13StrictGrounding({ plan: strictPlan, realization: strictSubstitution })
assert.equal(strictSubstitutionValidation.pass, false)
assert.ok(strictSubstitutionValidation.failureCodes.includes("wrong_claim_substitution"))
assert.ok(strictSubstitutionValidation.failureCodes.includes("required_claim_missing"))

let strictCalls = 0
const strictPipeline = await runDnaS13StrictPipeline({
  plan: strictPlan,
  realize: async () => {
    strictCalls += 1
    return strictCalls === 1 ? strictSubstitution : strictValid
  },
})
assert.equal(strictPipeline.status, "repaired")
assert.equal(strictPipeline.providerCalls, 2)
assert.equal(strictPipeline.validation.requiredSlotCoveragePercent, 100)

const irrelevantNeighbor: DnaS13Claim = {
  id: "claim.writing.seat",
  text: "Terapi topu, hareketli minder veya T-tabure gibi araçların dikkati ve masa başı üretkenliğini artırdığına ilişkin kanıtlar karışıktır.",
  passageId: "passage.writing.2",
  sourceIds: ["source.writing.1"],
  topicId: "owner.writing",
  title: "Alternatif Oturma",
  sectionId: "section.writing",
  domain: "attention_working_memory_executive",
  dimensions: ["process", "relation"],
}
const writingClaim: DnaS13Claim = {
  id: "claim.writing.measurement",
  text: "Yazı miktarı, doğruluk, yardım gereksinimi ve çocuğun konforu ölçülmelidir.",
  passageId: "passage.writing.1",
  sourceIds: ["source.writing.1"],
  topicId: "owner.writing",
  title: "Alternatif Oturma",
  sectionId: "section.writing",
  domain: "interoception_sensory",
  dimensions: ["measurement"],
}
assert.equal(isDnaS13DirectlyExplanatory({
  question: "Yazı miktarı, doğruluk ve yardım gereksinimi ne anlatır?",
  required: [writingClaim],
  candidate: irrelevantNeighbor,
}), false, "same section alone must not admit an explanatory claim")
assert.equal(isDnaS13DirectlyExplanatory({
  question: "HRV ölçümünde kayıt koşulları neden önemlidir?",
  required: strictClaims.slice(0, 1),
  candidate: strictNeighbor,
}), true)

const reportClaim: DnaS13Claim = {
  id: "owner.unit:test-report",
  text: "Test performansı ile ebeveyn veya öğretmen bildirimleri arasındaki ilişkiler genellikle mükemmel değildir.",
  passageId: "passage.report.1",
  sourceIds: ["source.owner-book"],
  topicId: "owner.limitations",
  title: "Sınırlılıkları",
  sectionId: "section.limitations",
  domain: "measurement_case_boundaries",
  dimensions: ["process", "relation", "development", "measurement", "misconception_boundary", "daily_function"],
}
const laboratoryBoundary: DnaS13Claim = {
  id: "owner.unit:laboratory-boundary",
  text: "Laboratuvar görevleri günlük yaşamdaki uzun süreli ve anlamlı talepleri sınırlı biçimde temsil eder.",
  passageId: "passage.report.2",
  sourceIds: ["source.owner-book"],
  topicId: "owner.limitations",
  title: "Sınırlılıkları",
  sectionId: "section.limitations",
  domain: "measurement_case_boundaries",
  dimensions: ["process", "relation", "development", "measurement", "misconception_boundary", "daily_function"],
}
assert.ok(dnaS13ExplanatoryRelevanceReasons({
  question: "Test performansı ile ebeveyn ve öğretmen bildirimleri neden farklı olabilir?",
  required: [reportClaim],
  candidate: laboratoryBoundary,
}).includes("important_boundary"), "a direct measurement boundary must remain eligible")

const fatigueClaim: DnaS13Claim = {
  id: "owner.unit:fatigue-behavior",
  text: "Bazı çocuklar yorgunluk arttıkça daha hareketli veya irritabl olabilir.",
  passageId: "passage.sleep.1",
  sourceIds: ["source.owner-book"],
  topicId: "owner.sleep",
  title: "Uyku Modülü",
  sectionId: "section.sleep",
  domain: "sleep_circadian",
  dimensions: ["process", "daily_function"],
}
const sleepBoundary: DnaS13Claim = {
  id: "owner.unit:sleep-boundary",
  text: "Uyku modülü yorgunluk sinyalinden daha geniştir.",
  passageId: "passage.sleep.2",
  sourceIds: ["source.owner-book"],
  topicId: "owner.sleep",
  title: "Uyku Modülü",
  sectionId: "section.sleep",
  domain: "sleep_circadian",
  dimensions: ["process", "daily_function"],
}
const sleepFrame: DnaS13QueryFrame = {
  ...strictFrame,
  subquestions: [{
    ...strictFrame.subquestions[0]!,
    id: "q1",
    question: "Bazı çocuklar yorgunluk arttıkça neden daha hareketli görünebilir?",
    topicId: "owner.sleep",
    focus: "process",
    questionType: "explanation",
    comparisonTargetTopicIds: [],
  }],
}
const sleepPlan = createDnaS13StrictPlan({
  frame: sleepFrame,
  requiredClaimsBySubquestion: { q1: [fatigueClaim] },
  explanatoryCandidatesBySubquestion: { q1: [sleepBoundary] },
})
assert.deepEqual(sleepPlan.slots[0]?.lockedClaimIds, [fatigueClaim.id, sleepBoundary.id])
const unsupportedRelation = validateDnaS13StrictRealization({
  slotRealizations: [{
    slotId: "strict-slot-1",
    text: `${fatigueClaim.text} Bunun nedeni, uyku modülünün yorgunluk sinyalinden daha geniş olmasıdır.`,
    usedClaimIds: [fatigueClaim.id, sleepBoundary.id],
  }],
  unsupportedAddition: false,
}, sleepPlan.slots.map((slot) => slot.id), sleepPlan.lockedClaimIds)!
const unsupportedRelationValidation = validateDnaS13StrictGrounding({ plan: sleepPlan, realization: unsupportedRelation })
assert.ok(unsupportedRelationValidation.failureCodes.includes("unsupported_relation_addition"))
assert.equal(unsupportedRelationValidation.unsupportedRelationCount, 1)
const neutralRelation = validateDnaS13StrictRealization({
  slotRealizations: [{
    slotId: "strict-slot-1",
    text: `${fatigueClaim.text} Uyku modülü yalnızca yorgunluk sinyaliyle sınırlı değildir.`,
    usedClaimIds: [fatigueClaim.id, sleepBoundary.id],
  }],
  unsupportedAddition: false,
}, sleepPlan.slots.map((slot) => slot.id), sleepPlan.lockedClaimIds)!
assert.equal(validateDnaS13StrictGrounding({ plan: sleepPlan, realization: neutralRelation }).pass, true)

const negativeParaphraseClaim: DnaS13Claim = {
  ...sleepBoundary,
  id: "owner.unit:negative-paraphrase",
  text: "Rutine bağlılık yalnızca bilişsel esneklik yetersizliği değildir.",
}
const negativeParaphrasePlan = createDnaS13StrictPlan({
  frame: sleepFrame,
  requiredClaimsBySubquestion: { q1: [negativeParaphraseClaim] },
})
const negativeParaphrase = validateDnaS13StrictRealization({
  slotRealizations: [{
    slotId: "strict-slot-1",
    text: "Rutine bağlılığın yalnızca bilişsel esneklik yetersizliği olmadığını belirtir.",
    usedClaimIds: [negativeParaphraseClaim.id],
  }],
  unsupportedAddition: false,
}, negativeParaphrasePlan.slots.map((slot) => slot.id), negativeParaphrasePlan.lockedClaimIds)!
assert.equal(validateDnaS13StrictGrounding({ plan: negativeParaphrasePlan, realization: negativeParaphrase }).pass, true)
const negativeSurfaceParaphrase = validateDnaS13StrictRealization({
  slotRealizations: [{
    slotId: "strict-slot-1",
    text: "Rutine bağlılık yalnızca bilişsel esneklik yetersizliği olarak görülmez.",
    usedClaimIds: [negativeParaphraseClaim.id],
  }],
  unsupportedAddition: false,
}, negativeParaphrasePlan.slots.map((slot) => slot.id), negativeParaphrasePlan.lockedClaimIds)!
assert.equal(validateDnaS13StrictGrounding({ plan: negativeParaphrasePlan, realization: negativeSurfaceParaphrase }).pass, true)
const droppedNegation = validateDnaS13StrictRealization({
  slotRealizations: [{
    slotId: "strict-slot-1",
    text: "Rutine bağlılık yalnızca bilişsel esneklik yetersizliğidir.",
    usedClaimIds: [negativeParaphraseClaim.id],
  }],
  unsupportedAddition: false,
}, negativeParaphrasePlan.slots.map((slot) => slot.id), negativeParaphrasePlan.lockedClaimIds)!
assert.ok(validateDnaS13StrictGrounding({ plan: negativeParaphrasePlan, realization: droppedNegation })
  .failureCodes.includes("negation_changed"))

const explicitDistinctionClaim: DnaS13Claim = {
  ...sleepBoundary,
  id: "owner.unit:explicit-distinction",
  text: "Beden ihtiyacını ertelemenin işlevsel ve işlevsiz biçimleri ayrılmalıdır.",
}
const explicitDistinctionPlan = createDnaS13StrictPlan({
  frame: sleepFrame,
  requiredClaimsBySubquestion: { q1: [explicitDistinctionClaim] },
})
const explicitDistinction = validateDnaS13StrictRealization({
  slotRealizations: [{
    slotId: "strict-slot-1",
    text: "Temel ayrım, beden ihtiyacını ertelemenin işlevsel ve işlevsiz biçimlerinin ayrılmasıdır.",
    usedClaimIds: [explicitDistinctionClaim.id],
  }],
  unsupportedAddition: false,
}, explicitDistinctionPlan.slots.map((slot) => slot.id), explicitDistinctionPlan.lockedClaimIds)!
assert.equal(validateDnaS13StrictGrounding({ plan: explicitDistinctionPlan, realization: explicitDistinction }).pass, true)
assert.deepEqual(detectDnaS13Relations("Görev zorlaşmanın yanı sıra daha uzun sürer."), [])
assert.deepEqual(detectDnaS13Relations("Görevin parçalara ayrılması katılımı artırabilir."), [])
assert.equal(detectDnaS13Relations("Bu durum daha güçlü tepkiye neden olabilir.")[0]?.type, "causality")
assert.equal(detectDnaS13Relations("Özellikler aynı kalırken katılım artabilir.")[0]?.type, "contrast")
assert.equal(detectDnaS13Relations("Özellikler aynı kalmasına rağmen katılım artabilir.")[0]?.type, "contrast")

const comparisonClaims: DnaS13Claim[] = [
  { ...strictClaims[0]!, title: "Kalp Hızı Değişkenliği", topicId: "ans.hrv" },
  { ...strictSecondClaim, title: "İnterosepsiyon", topicId: "ans.interoception" },
]
const comparison = retrieveDnaS13TwoSidedComparison({
  question: "Kalp Hızı Değişkenliği ile İnterosepsiyon aynı düzeyde iki kavram mı?",
  claims: comparisonClaims,
})
assert.ok(comparison)
assert.equal(comparison?.sides.length, 2)
assert.deepEqual(comparison?.sides.map((side) => side.topicId), ["ans.hrv", "ans.interoception"])

const comparisonFrame: DnaS13QueryFrame = {
  ...strictFrame,
  subquestions: [
    { ...strictFrame.subquestions[0]!, question: "Kalp Hızı Değişkenliği nedir?", topicId: "ans.hrv", focus: "comparison", questionType: "comparison", comparisonTargetTopicIds: topics },
    { ...strictFrame.subquestions[1]!, question: "İnterosepsiyon nedir?", topicId: "ans.interoception", focus: "comparison", questionType: "comparison", comparisonTargetTopicIds: topics },
  ],
}
const comparisonPlan = createDnaS13StrictPlan({
  frame: comparisonFrame,
  requiredClaimsBySubquestion: { q1: [comparisonClaims[0]!], q2: [comparisonClaims[1]!] },
})
assert.equal(comparisonPlan.slots.length, 3)
assert.equal(comparisonPlan.slots[2]?.kind, "comparison_conclusion")
const comparisonRealization = validateDnaS13StrictRealization({
  slotRealizations: [
    { slotId: "strict-slot-1", text: comparisonClaims[0]!.text, usedClaimIds: [comparisonClaims[0]!.id] },
    { slotId: "strict-slot-2", text: comparisonClaims[1]!.text, usedClaimIds: [comparisonClaims[1]!.id] },
    {
      slotId: comparisonPlan.slots[2]!.id,
      text: comparisonPlan.slots[2]!.controlledText,
      usedClaimIds: comparisonPlan.slots[2]!.lockedClaimIds,
    },
  ],
  unsupportedAddition: false,
}, comparisonPlan.slots.map((slot) => slot.id), comparisonPlan.lockedClaimIds)
assert.ok(comparisonRealization)
const comparisonValidation = validateDnaS13StrictGrounding({ plan: comparisonPlan, realization: comparisonRealization! })
assert.equal(comparisonValidation.pass, true)
assert.equal(comparisonValidation.comparisonSideCoveragePercent, 100)
assert.equal(comparisonValidation.comparisonConclusionCoveragePercent, 100)
assert.equal(comparisonPlan.comparisonConclusionMode, "contrast_by_verified_definitions")
assert.equal(comparisonValidation.comparisonSideASupported, true)
assert.equal(comparisonValidation.comparisonSideBSupported, true)
assert.equal(comparisonValidation.comparisonConclusionSupported, true)

const categoricalClaims: DnaS13Claim[] = [
  {
    ...comparisonClaims[0]!,
    id: "claim.strengths",
    text: "Teori erken küçük farklılıkların karşılıklı döngüler yoluyla zaman içinde nasıl büyüyebileceğini açıklamakta güçlüdür.",
    title: "Güçlü Yönleri",
    topicId: "owner.strengths",
  },
  {
    ...comparisonClaims[1]!,
    id: "claim.ventral-striatum",
    text: "Ventral striatum ödül, motivasyon ve eylem seçimiyle ilişkili bir yapıdır.",
    title: "Ventral Striatum",
    topicId: "owner.ventral-striatum",
  },
]
const categoricalTopics = categoricalClaims.map((claim) => claim.topicId)
const categoricalFrame: DnaS13QueryFrame = {
  ...comparisonFrame,
  normalizedQuestion: "Güçlü Yönleri ile Ventral Striatum aynı düzeyde iki kavram mı?",
  subquestions: comparisonFrame.subquestions.map((subquestion, index) => ({
    ...subquestion,
    id: `q${index + 1}`,
    topicId: categoricalTopics[index]!,
    comparisonTargetTopicIds: categoricalTopics,
  })),
}
const categoricalPlan = createDnaS13StrictPlan({
  frame: categoricalFrame,
  requiredClaimsBySubquestion: { q1: [categoricalClaims[0]!], q2: [categoricalClaims[1]!] },
})
assert.equal(categoricalPlan.comparisonConclusionMode, "safe_categorical_inference")
assert.equal(categoricalPlan.slots[2]?.comparisonConclusionCategoryLabels?.sideA, "değerlendirme başlığı")
assert.equal(categoricalPlan.slots[2]?.comparisonConclusionCategoryLabels?.sideB, "yapı")
assert.equal(categoricalPlan.comparisonConclusionSupportClaimIds?.length, 2)
const categoricalRealization = validateDnaS13StrictRealization({
  slotRealizations: categoricalPlan.slots.map((slot) => ({
    slotId: slot.id,
    text: slot.controlledText ?? slot.lockedClaims.map((entry) => entry.claim.text).join(" "),
    usedClaimIds: slot.lockedClaimIds,
  })),
  unsupportedAddition: false,
}, categoricalPlan.slots.map((slot) => slot.id), categoricalPlan.lockedClaimIds)!
const categoricalValidation = validateDnaS13StrictGrounding({ plan: categoricalPlan, realization: categoricalRealization })
assert.equal(categoricalValidation.pass, true)
assert.equal(categoricalValidation.comparisonConclusionSupported, true)

const directClaims: DnaS13Claim[] = [
  {
    ...categoricalClaims[0]!,
    id: "claim.direct-distinction",
    text: "Bölünmüş Dikkat ile Parasempatik Sistem aynı kavram değildir; biri bilişsel bir süreç, diğeri fizyolojik bir sistemdir.",
    title: "Bölünmüş Dikkat",
    topicId: "owner.divided-attention",
  },
  {
    ...categoricalClaims[1]!,
    id: "claim.parasympathetic-system",
    text: "Parasempatik sistem fizyolojik bir sistemdir.",
    title: "Parasempatik Sistem",
    topicId: "owner.parasympathetic-system",
  },
]
const directTopics = directClaims.map((claim) => claim.topicId)
const directFrame: DnaS13QueryFrame = {
  ...categoricalFrame,
  subquestions: categoricalFrame.subquestions.map((subquestion, index) => ({
    ...subquestion,
    topicId: directTopics[index]!,
    comparisonTargetTopicIds: directTopics,
  })),
}
const directPlan = createDnaS13StrictPlan({
  frame: directFrame,
  requiredClaimsBySubquestion: { q1: [directClaims[0]!], q2: [directClaims[1]!] },
})
assert.equal(directPlan.comparisonConclusionMode, "direct")
assert.deepEqual(directPlan.comparisonConclusionSupportClaimIds, [directClaims[0]!.id])

const evaluationHeadingClaims: DnaS13Claim[] = [
  {
    ...categoricalClaims[0]!,
    id: "claim.clinical-value-heading",
    text: "Müdahale yalnızca çocuğu masada tutmaya çalışmamalıdır.",
    title: "Transaksiyonel Modelin Klinik Değeri",
    topicId: "owner.transactional-clinical-value",
  },
  {
    ...categoricalClaims[1]!,
    id: "claim.general-evaluation-heading",
    text: "İnterosepsiyon, bedenin iç durumuna ilişkin sinyallerin algılanması ve regülasyonda kullanılması sürecidir.",
    title: "Genel Değerlendirme",
    topicId: "owner.general-evaluation",
  },
]
const evaluationTopics = evaluationHeadingClaims.map((claim) => claim.topicId)
const evaluationFrame: DnaS13QueryFrame = {
  ...categoricalFrame,
  subquestions: categoricalFrame.subquestions.map((subquestion, index) => ({
    ...subquestion,
    topicId: evaluationTopics[index]!,
    comparisonTargetTopicIds: evaluationTopics,
  })),
}
const evaluationHeadingPlan = createDnaS13StrictPlan({
  frame: evaluationFrame,
  requiredClaimsBySubquestion: { q1: [evaluationHeadingClaims[0]!], q2: [evaluationHeadingClaims[1]!] },
})
assert.equal(evaluationHeadingPlan.comparisonConclusionMode, "abstain")
assert.equal(evaluationHeadingPlan.slots[2]?.comparisonConclusionCategoryLabels?.sideA, "değerlendirme başlığı")
assert.equal(evaluationHeadingPlan.slots[2]?.comparisonConclusionCategoryLabels?.sideB, "değerlendirme başlığı")

const mismatchedProcessClaims: DnaS13Claim[] = [
  {
    ...categoricalClaims[0]!,
    id: "claim.ecological-framework",
    text: "Ekolojik yaklaşım self-regülasyonu yalnızca çocuğun kişisel kapasitesi olarak görmez.",
    title: "Self-Regülasyonun Ekolojik Sistemler Açısından Okunması",
    topicId: "owner.ecological-self-regulation",
  },
  {
    ...categoricalClaims[1]!,
    id: "claim.homeostasis-mismatch",
    text: "Homeostaz, fizyolojik değişkenleri işlevsel sınırlar içinde tutmaya odaklanır.",
    title: "Allostaz ve İnteroseptif Regülasyon",
    topicId: "owner.allostasis-interoception",
  },
]
const mismatchTopics = mismatchedProcessClaims.map((claim) => claim.topicId)
const mismatchFrame: DnaS13QueryFrame = {
  ...categoricalFrame,
  subquestions: categoricalFrame.subquestions.map((subquestion, index) => ({
    ...subquestion,
    topicId: mismatchTopics[index]!,
    comparisonTargetTopicIds: mismatchTopics,
  })),
}
const mismatchPlan = createDnaS13StrictPlan({
  frame: mismatchFrame,
  requiredClaimsBySubquestion: { q1: [mismatchedProcessClaims[0]!], q2: [mismatchedProcessClaims[1]!] },
})
assert.equal(mismatchPlan.comparisonConclusionMode, "abstain")
assert.equal(mismatchPlan.slots[2]?.comparisonConclusionCategoryLabels?.sideB, null)

const tamperedCategoricalPlan = { ...categoricalPlan, comparisonConclusionMode: "abstain" as const }
const tamperedConclusionValidation = validateDnaS13StrictGrounding({ plan: tamperedCategoricalPlan, realization: categoricalRealization })
assert.equal(tamperedConclusionValidation.pass, false)
assert.ok(tamperedConclusionValidation.failureCodes.includes("comparison_conclusion_unsupported"))

const unsupportedSideRealization = validateDnaS13StrictRealization({
  slotRealizations: categoricalRealization.slotRealizations.map((slot, index) => index === 0
    ? { ...slot, text: `${slot.text} Bu kesin tanı koyar.` }
    : slot),
  unsupportedAddition: false,
}, categoricalPlan.slots.map((slot) => slot.id), categoricalPlan.lockedClaimIds)!
const unsupportedSideValidation = validateDnaS13StrictGrounding({ plan: categoricalPlan, realization: unsupportedSideRealization })
assert.equal(unsupportedSideValidation.comparisonSideASupported, false)
assert.equal(unsupportedSideValidation.comparisonSideBSupported, true)
assert.ok(unsupportedSideValidation.failureCodes.includes("comparison_side_uncovered"))

const inventedConclusion = validateDnaS13StrictRealization({
  slotRealizations: [
    comparisonRealization!.slotRealizations[0],
    comparisonRealization!.slotRealizations[1],
    {
      ...comparisonRealization!.slotRealizations[2],
      text: "Bu iki kavram kesin olarak aynı düzeydedir.",
    },
  ],
  unsupportedAddition: false,
}, comparisonPlan.slots.map((slot) => slot.id), comparisonPlan.lockedClaimIds)!
assert.ok(validateDnaS13StrictGrounding({ plan: comparisonPlan, realization: inventedConclusion }).failureCodes.includes("comparison_conclusion_unsupported"))

const oneSidedComparisonFrame: DnaS13QueryFrame = { ...comparisonFrame, subquestions: comparisonFrame.subquestions.slice(0, 1) }
const oneSidedComparisonPlan = createDnaS13StrictPlan({ frame: oneSidedComparisonFrame, requiredClaimsBySubquestion: { q1: [comparisonClaims[0]!] } })
const oneSidedRealization = validateDnaS13StrictRealization({
  slotRealizations: [{ slotId: "strict-slot-1", text: comparisonClaims[0]!.text, usedClaimIds: [comparisonClaims[0]!.id] }],
  unsupportedAddition: false,
}, oneSidedComparisonPlan.slots.map((slot) => slot.id), oneSidedComparisonPlan.lockedClaimIds)!
assert.ok(validateDnaS13StrictGrounding({ plan: oneSidedComparisonPlan, realization: oneSidedRealization }).failureCodes.includes("comparison_side_uncovered"))

const s13Shadow = resolveDnaTournamentComponentPlan({
  DNA_TOURNAMENT_CANARY_STAGE: "production_shadow",
  DNA_CHAT_LUNA_ENABLED: "1",
  DNA_S13_ENABLED: "1",
  DNA_S13_QUERY_ENABLED: "1",
  DNA_S13_REALIZATION_ENABLED: "1",
  DNA_S13_REPAIR_ENABLED: "1",
})
assert.equal(s13Shadow.components.s13Master, true)
assert.equal(s13Shadow.components.s13Query, true)
assert.equal(s13Shadow.publicAnswerMutationAllowed, false)

const s13MutationBlocked = resolveDnaTournamentComponentPlan({
  DNA_TOURNAMENT_CANARY_STAGE: "10",
  DNA_CHAT_LUNA_ENABLED: "1",
  DNA_S13_ENABLED: "1",
  DNA_S13_QUERY_ENABLED: "1",
  DNA_S13_REALIZATION_ENABLED: "1",
  DNA_TOURNAMENT_PRODUCTION_WINNER: "S13_A",
})
assert.equal(s13MutationBlocked.publicAnswerMutationAllowed, false)
assert.ok(s13MutationBlocked.blockedReasons.includes("independent_human_evaluation_pending"))

console.log(JSON.stringify({
  ok: true,
  assertions: 118,
  queryFrameVersion: DNA_S13_QUERY_FRAME_VERSION,
  contextTtlMs: DNA_S13_CONTEXT_TTL_MS,
  maximumProviderCalls: permanentFailure.providerCalls,
  strictSlots: strictPlan.slots.length,
}))
}

void runPipelineAssertions().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

import assert from "node:assert/strict"
import {
  DnaS13KnowledgeV2ShadowProvider,
  runDnaS13KnowledgeV2RealizedShadow,
  runDnaS13KnowledgeV2Shadow,
  type DnaKnowledgeV2Snapshot,
} from "../src/lib/dna/chat/s13/shadowKnowledgeV2"
import { DNA_S13_QUERY_FRAME_VERSION, type DnaS13QueryFrame } from "../src/lib/dna/chat/s13/contracts"
import { DeterministicRealizer } from "../src/lib/dna/chat/s13/strictRealizer"

const snapshot: DnaKnowledgeV2Snapshot = Object.freeze({
  canonicalTopics: Object.freeze([Object.freeze({
    canonicalTopicId: "canonical:test",
    canonicalTitle: "Test Başlığı",
    aliases: Object.freeze(["Test Başlığı"]),
    oldTopicIds: Object.freeze(["old:test"]),
    applicableFacets: Object.freeze(["DEFINITION", "CORE_SCOPE", "BOUNDARY_LIMITATION", "EXPLANATORY_DETAIL"] as const),
    atomIds: Object.freeze(["atom:direct", "atom:lead", "atom:support", "atom:detail"]),
  })]),
  aliases: Object.freeze([Object.freeze({
    oldTopicId: "old:test",
    canonicalTopicId: "canonical:test",
    backwardCompatible: true,
  })]),
  atoms: Object.freeze([
    Object.freeze({
      atomId: "atom:direct", text: "Test başlığı açık bir kavramdır.", canonicalTopicId: "canonical:test",
      canonicalTitle: "Test Başlığı", sourceId: "source:test", passageId: "passage:direct",
      explicitFacet: "DEFINITION", coverageFacet: "DEFINITION", claimRoleV2: "TOPIC_THESIS",
      supportedFacets: Object.freeze(["DEFINITION", "BOUNDARY_LIMITATION"] as const),
      selfContained: true, standaloneFinalAnswerEligible: true, answerEligible: true,
      dimensions: Object.freeze(["definition"]), domain: "test", sourceSectionId: "section:test",
      authorityClass: "owner_approved_book", citationStatus: "verified",
    }),
    Object.freeze({
      atomId: "atom:lead", text: "Temel kapsam iki unsur içerir:", canonicalTopicId: "canonical:test",
      canonicalTitle: "Test Başlığı", sourceId: "source:test", passageId: "passage:lead",
      explicitFacet: "CORE_SCOPE", coverageFacet: "CORE_SCOPE", claimRoleV2: "LEAD_IN",
      selfContained: false, standaloneFinalAnswerEligible: false, answerEligible: true,
      dimensions: Object.freeze(["scope"]), domain: "test", sourceSectionId: "section:test",
      authorityClass: "owner_approved_book", citationStatus: "verified",
    }),
    Object.freeze({
      atomId: "atom:support", text: "İlk unsur kaynakla bağlıdır.", canonicalTopicId: "canonical:test",
      canonicalTitle: "Test Başlığı", sourceId: "source:test", passageId: "passage:support",
      explicitFacet: "CORE_SCOPE", coverageFacet: "CORE_SCOPE", claimRoleV2: "SUPPORT",
      selfContained: true, standaloneFinalAnswerEligible: false, answerEligible: true,
      dimensions: Object.freeze(["scope"]), domain: "test", sourceSectionId: "section:test",
      authorityClass: "owner_approved_book", citationStatus: "verified",
    }),
    Object.freeze({
      atomId: "atom:detail", text: "Açıklayıcı ayrıntı kaynakla bağlıdır.", canonicalTopicId: "canonical:test",
      canonicalTitle: "Test Başlığı", sourceId: "source:test", passageId: "passage:detail",
      explicitFacet: "EXPLANATORY_DETAIL", coverageFacet: "EXPLANATORY_DETAIL", claimRoleV2: "SUPPORT",
      selfContained: true, standaloneFinalAnswerEligible: true, answerEligible: true,
      dimensions: Object.freeze(["process"]), domain: "test", sourceSectionId: "section:test",
      authorityClass: "owner_approved_book", citationStatus: "verified",
    }),
  ]),
  bundles: Object.freeze([Object.freeze({
    bundleId: "bundle:test", canonicalTopicId: "canonical:test", leadAtomId: "atom:lead",
    supportAtomIds: Object.freeze(["atom:support"]), orderedAtomIds: Object.freeze(["atom:lead", "atom:support"]),
    selfContainedAsBundle: true, standaloneLeadForbidden: true, finalAnswerEligible: true,
  })]),
})

const provider = new DnaS13KnowledgeV2ShadowProvider(snapshot)
assert.equal(provider.resolveCanonicalTopicId("old:test"), "canonical:test")
assert.equal(provider.retrieve("old:test", "DEFINITION").status, "SUPPORTED_DIRECT")
assert.equal(provider.retrieve("old:test", "BOUNDARY_LIMITATION").status, "SUPPORTED_DIRECT")
assert.equal(provider.retrieve("old:test", "CORE_SCOPE").status, "SUPPORTED_DERIVED")
assert.equal(provider.retrieve("old:test", "EXPLANATORY_DETAIL").status, "SUPPORTED_DIRECT")
assert.equal(provider.retrieve("old:test", "EXAMPLE").status, "UNSUPPORTED")
assert.equal(provider.retrieve("old:missing", "DEFINITION").canonicalTopicId, null)

const frame: DnaS13QueryFrame = Object.freeze({
  version: DNA_S13_QUERY_FRAME_VERSION,
  normalizedQuestion: "test basligi nedir",
  responseDepth: "standard",
  uncertain: false,
  subquestions: Object.freeze([Object.freeze({
    id: "q1", question: "Test başlığı nedir?", intent: "scientific_question",
    topicId: "old:test", focus: "definition", questionType: "definition",
    followUp: false, correction: false, comparisonTargetTopicIds: Object.freeze([]),
    answerabilityHint: "supported", requestedFacets: Object.freeze(["definition"] as const),
  })]),
})
const publicPlan = Object.freeze({ marker: "public-plan-must-not-change" })
const run = runDnaS13KnowledgeV2Shadow({ frame, provider, publicPlan: publicPlan as never })
assert.equal(run.publicPlan, publicPlan)
assert.equal(run.publicPlanReferencePreserved, true)
assert.equal(run.shadow.displayEligible, false)
assert.equal(run.shadow.productionEligible, false)
assert.equal(run.shadow.validation.pass, true)
assert.ok(run.shadow.answer.trim().length > 0)

const explanatoryFrame: DnaS13QueryFrame = Object.freeze({
  ...frame,
  normalizedQuestion: "test basligini derinlestir",
  responseDepth: "deep",
  subquestions: Object.freeze([Object.freeze({
    ...frame.subquestions[0], question: "Test başlığını derinleştir.", questionType: "follow_up" as const,
    followUp: true, requestedFacets: Object.freeze(["explanatory_detail"] as const),
  })]),
})
const explanatoryRun = runDnaS13KnowledgeV2Shadow({ frame: explanatoryFrame, provider })
assert.equal(explanatoryRun.shadow.plan.slots.length, 1)
assert.equal(explanatoryRun.shadow.plan.slots[0]?.requestedFacet, "explanatory_detail")
assert.equal(explanatoryRun.shadow.validation.pass, true)

assert.throws(() => new DnaS13KnowledgeV2ShadowProvider({
  ...snapshot,
  atoms: Object.freeze([{ ...snapshot.atoms[0], passageId: "" }]),
  bundles: Object.freeze([]),
}), /knowledge_v2_unbound_atom/)

runDnaS13KnowledgeV2RealizedShadow({
  question: "Test başlığı nedir?",
  frame,
  provider,
  publicPlan: publicPlan as never,
  realizer: new DeterministicRealizer(),
  catalog: Object.freeze({ version: "test-catalog", hash: "a".repeat(64) }),
  retrieval: Object.freeze({ version: "test-retrieval", hash: "b".repeat(64) }),
  privacy: Object.freeze({
    category: "general_non_sensitive",
    containsClinicalOrCaseData: false,
    containsPersonalData: false,
    automaticTrainingAllowed: false,
    reasons: Object.freeze(["test"]),
  }),
}).then((realized) => {
  assert.equal(realized.shadow.displayEligible, false)
  assert.equal(realized.shadow.productionEligible, false)
  assert.equal(realized.shadow.result.finalValidation.pass, true)
  assert.equal(realized.shadow.result.provenance.realizer.provider, "deterministic")
  console.log(JSON.stringify({
    result: "PASS",
    assertions: 22,
    productionWiring: false,
    displayEligible: realized.shadow.displayEligible,
    validatorPass: realized.shadow.result.finalValidation.pass,
    realizerContractExercised: true,
  }, null, 2))
}).catch((error) => {
  console.error(error)
  process.exitCode = 1
})

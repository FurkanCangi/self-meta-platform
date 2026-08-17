import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import {
  DNA_S13_CANARY_TELEMETRY_VERSION,
  EMPTY_DNA_S13_CANARY_QUALITY,
  type DnaS13CanaryMessageRecord,
} from "../src/lib/dna/chat/s13/canary/contracts"
import {
  buildDnaS13CanaryFeedback,
  deriveDnaS13CanaryTrainingAnnotation,
} from "../src/lib/dna/chat/s13/canary/feedback"
import { resolveDnaS13CanaryFlags, isDnaS13CanaryTester } from "../src/lib/dna/chat/s13/canary/flags"
import {
  DNA_S13_CANARY_ARCHITECTURE_HASH,
  DNA_S13_CANARY_ARCHITECTURE_VERSION,
} from "../src/lib/dna/chat/s13/canary/freeze"
import { parseDnaS13CanaryComparison } from "../src/lib/dna/chat/s13/canary/parser"
import { inspectDnaS13CanaryPrivacy } from "../src/lib/dna/chat/s13/canary/privacy"
import {
  DNA_S13_CONVERSATION_CONTEXT_VERSION,
  resolveDnaS13ConversationContext,
  resolveDnaS13NamedTopicSurfaces,
  type DnaS13ConversationState,
} from "../src/lib/dna/chat/s13/conversationContext"
import { summarizeDnaS13Canary } from "../src/lib/dna/chat/s13/canary/summary"
import {
  dnaS13HasPresentationModifier,
  resolveDnaS13NoRepeatConstraint,
  resolveDnaS13PragmaticTask,
} from "../src/lib/dna/chat/s13/pragmaticTask"
import { getDnaOwnerBookTopicClaims, getDnaOwnerBookTopicTitle } from "../src/lib/dna/chat/ownerBookRuntime"
import { createDnaS13TopicSemanticFrame } from "../src/lib/dna/chat/s13/topicSemantic"

let assertions = 0
function check(value: unknown, message: string) {
  assert.ok(value, message)
  assertions += 1
}

const defaultFlags = resolveDnaS13CanaryFlags({})
check(!defaultFlags.enabled && !defaultFlags.uiEnabled && !defaultFlags.lunaEnabled, "canary flags default OFF")

const productionFlags = resolveDnaS13CanaryFlags({
  DNA_S13_INTERNAL_CANARY_ENABLED: "1",
  DNA_S13_INTERNAL_CANARY_UI_ENABLED: "1",
  DNA_S13_INTERNAL_CANARY_LUNA_ENABLED: "1",
  DNA_S13_INTERNAL_CANARY_TESTER_EMAILS: "tester@example.com",
  VERCEL_ENV: "production",
})
check(productionFlags.productionBlocked && !productionFlags.enabled && !productionFlags.lunaEnabled, "production hard-blocks canary")

const internalFlags = resolveDnaS13CanaryFlags({
  DNA_S13_INTERNAL_CANARY_ENABLED: "1",
  DNA_S13_INTERNAL_CANARY_UI_ENABLED: "1",
  DNA_S13_INTERNAL_CANARY_LUNA_ENABLED: "1",
  DNA_S13_INTERNAL_CANARY_TESTER_EMAILS: " Tester@Example.com ",
})
check(isDnaS13CanaryTester("tester@example.com", internalFlags), "explicit tester allowlist grants access")
check(!isDnaS13CanaryTester("other@example.com", internalFlags), "non-tester is denied")

check(inspectDnaS13CanaryPrivacy("İnterosepsiyon nedir?").allowed, "general scientific question passes privacy")
check(inspectDnaS13CanaryPrivacy("Kadınlarda self regülasyon nasıl açıklanır?").allowed, "ordinary scientific words do not trigger name marker false positive")
check(!inspectDnaS13CanaryPrivacy("Bu danışanın anamnez raporunu açıkla").allowed, "clinical context fails closed")
check(!inspectDnaS13CanaryPrivacy("Danışan adı: Ayşe Yılmaz, sonucu açıkla").allowed, "personal identifier fails closed")

assert.deepEqual(parseDnaS13CanaryComparison("Güçlü Yönleri vs Ventral Striatum"), ["Güçlü Yönleri", "Ventral Striatum"])
assertions += 1
assert.deepEqual(parseDnaS13CanaryComparison("Bölünmüş Dikkat ile Parasempatik Sistem arasındaki fark nedir?"), ["Bölünmüş Dikkat", "Parasempatik Sistem"])
assertions += 1
assert.deepEqual(parseDnaS13CanaryComparison("İnterosepsiyon ile Duyusal Modülasyon aynı şey mi?"), ["İnterosepsiyon", "Duyusal Modülasyon"])
assert.deepEqual(
  parseDnaS13CanaryComparison("Anterior Singulat ve Midcingulate Korteks ile Uyanıklık karşılaştırmasında önce tarafları açıkla"),
  ["Anterior Singulat ve Midcingulate Korteks", "Uyanıklık"],
)
assertions += 1
check(parseDnaS13CanaryComparison("İnterosepsiyon nedir?") === null, "non-comparison stays single-question")
assert.deepEqual(
  parseDnaS13CanaryComparison("Retiküler Formasyon ile Ventral Striatum karşı karşıya konursa önce birincinin sonra ikincinin kapsamını söyle"),
  ["Retiküler Formasyon", "Ventral Striatum"],
)
assertions += 1

const pragmaticTargets = Object.freeze([Object.freeze({
  topicId: "topic-salience", surface: "Salience", polarity: "ACTIVE_TARGET" as const,
})])
const pragmaticWhy = resolveDnaS13PragmaticTask({
  question: "Bu noktayı değerli yapan nedir? Salience için önemini belirt.",
  responseDepth: "standard", correction: false, contextInherited: true, namedTargetCount: 1, targets: pragmaticTargets,
})
check(pragmaticWhy.targetResolution === "EXPLICIT_TARGET"
  && pragmaticWhy.pragmaticAction === "WHY_SIGNIFICANCE"
  && pragmaticWhy.requestedFacets[0] === "function"
  && pragmaticWhy.discourseConstraints.includes("do_not_repeat"),
"explicit target and WHY action resolve independently")
const pragmaticDeepen = resolveDnaS13PragmaticTask({
  question: "Problem Çözme üzerine önce söylenmeyen doğrulanmış bir ayrıntı var mı? Varsa aç, yoksa tekrarlama.",
  responseDepth: "standard", correction: false, contextInherited: true, namedTargetCount: 1, targets: pragmaticTargets,
})
check(pragmaticDeepen.pragmaticAction === "DEEPEN"
  && pragmaticDeepen.discourseConstraints.includes("new_information_only")
  && pragmaticDeepen.discourseConstraints.includes("do_not_repeat"),
"explicit target deepen requires measured new information without repetition")
const pragmaticEverydaySimplify = resolveDnaS13PragmaticTask({
  question: "Salience ifadesini daha gündelik bir dille yeniden kurar mısın?",
  responseDepth: "standard", correction: false, contextInherited: true, namedTargetCount: 1, targets: pragmaticTargets,
})
check(pragmaticEverydaySimplify.pragmaticAction === "EXPLAIN"
  && pragmaticEverydaySimplify.baseAction === "EXPLAIN"
  && dnaS13HasPresentationModifier(pragmaticEverydaySimplify, "SIMPLIFY"),
"natural gündelik bir dille wording resolves as EXPLAIN plus SIMPLIFY presentation")
const pragmaticComparison = resolveDnaS13PragmaticTask({
  question: "A ile B karşı karşıya konursa önce birincinin sonra ikincinin kapsamını, en sonda desteklenen ayrımı söyle.",
  responseDepth: "standard", correction: false, contextInherited: false, namedTargetCount: 2,
  targets: Object.freeze([...pragmaticTargets, Object.freeze({ topicId: "topic-b", surface: "B", polarity: "ACTIVE_TARGET" as const })]),
})
check(pragmaticComparison.targetResolution === "MULTI_TARGET"
  && pragmaticComparison.pragmaticAction === "COMPARE"
  && pragmaticComparison.discourseConstraints.includes("preserve_order"),
"natural comparison language creates an independent COMPARE action")
const closeComparisonCorrection = resolveDnaS13PragmaticTask({
  question: "İkincisini kastediyorum; A ile B karşılaştırmasını kapatıp yalnız o başlıkta kal.",
  responseDepth: "standard", correction: true, contextInherited: true, namedTargetCount: 1, targets: pragmaticTargets,
})
check(closeComparisonCorrection.pragmaticAction === "CORRECT_TARGET",
"explicitly closing a comparison to keep one side resolves as CORRECT_TARGET")

const namedAnterior = resolveDnaS13NamedTopicSurfaces("Anterior İnsula İnterosepsiyon Merkezi midir? ne demek")
check(namedAnterior.length === 1 && namedAnterior[0]?.title === "Anterior İnsula İnterosepsiyon Merkezi midir?", "question-mark heading is preserved as one named topic")
const namedPair = resolveDnaS13NamedTopicSurfaces("HPA Ekseninin Temel İşleyişi kısaca ne demek? Yürütücü İşlev mi, Duygusal Regülasyon mu? neden önemli?")
check(namedPair.length === 2, "two known headings survive natural two-part punctuation")
check(namedPair[0]?.title === "HPA Ekseninin Temel İşleyişi"
  && namedPair[1]?.title === "Yürütücü İşlev mi, Duygusal Regülasyon mu?", "named topics preserve user mention order")
const hpa = namedPair.find((row) => row.title === "HPA Ekseninin Temel İşleyişi")!
const executive = namedPair.find((row) => row.title === "Yürütücü İşlev mi, Duygusal Regülasyon mu?")!
const contextState: DnaS13ConversationState = Object.freeze({
  version: DNA_S13_CONVERSATION_CONTEXT_VERSION,
  sessionId: "session-context-001",
  privacyCategory: "general_non_sensitive",
  lastEligibleTopicIds: Object.freeze([hpa.topicId, executive.topicId]),
  lastEligibleFocus: "comparison",
  lastEligibleQuestionType: "comparison",
  lastEligibleRequiredClaimIds: Object.freeze(["claim-a", "claim-b"]),
  lastEligibleLockedClaimIds: Object.freeze(["claim-a", "claim-b"]),
  lastEligibleAnswerSlots: Object.freeze([]),
  lastEligibleNormalizedQuestion: "hpa ile yurutucu islev karsilastirmasi",
  lastEligibleUserQuestion: "HPA ile yürütücü işlev karşılaştırması",
  lastEligibleAnswerDepth: "standard",
  lastEligibleComparisonSideA: hpa.topicId,
  lastEligibleComparisonSideB: executive.topicId,
  lastEligibleComparisonConclusionMode: "safe_categorical_inference",
  lastEligibleActiveTopicId: executive.topicId,
})
const explainResolution = resolveDnaS13ConversationContext({
  sessionId: contextState.sessionId, question: "bu ne demek", responseDepth: "standard",
  privacyAllowed: true, state: contextState,
})
check(explainResolution.operation === "explain_same_topic" && explainResolution.targetTopicIds[0] === executive.topicId, "generic explain follow-up inherits active verified target")
const expandResolution = resolveDnaS13ConversationContext({
  sessionId: contextState.sessionId, question: "biraz daha aç", responseDepth: "standard",
  privacyAllowed: true, state: contextState,
})
check(expandResolution.operation === "expand_same_topic" && expandResolution.responseDepth === "deep", "expansion inherits target and increases depth one level")
const namedCorrection = resolveDnaS13ConversationContext({
  sessionId: contextState.sessionId,
  question: "hayır onu demiyorum Yürütücü İşlev mi, Duygusal Regülasyon mu? kısmını soruyorum",
  responseDepth: "standard", privacyAllowed: true, state: contextState,
})
check(namedCorrection.operation === "replace_previous_target" && namedCorrection.targetTopicIds[0] === executive.topicId, "named correction replaces prior target")
const polarityCorrection = resolveDnaS13ConversationContext({
  sessionId: contextState.sessionId,
  question: `HPA Ekseninin Temel İşleyişi demek istemedim; hedefim Yürütücü İşlev mi, Duygusal Regülasyon mu?. Yalnız onu açıkla.`,
  responseDepth: "standard", privacyAllowed: true, state: contextState,
})
check(polarityCorrection.operation === "replace_previous_target"
  && polarityCorrection.targetTopicIds[0] === executive.topicId
  && polarityCorrection.topicMentions.some((row) => row.topicId === hpa.topicId && row.polarity === "REJECTED_TARGET")
  && polarityCorrection.topicMentions.some((row) => row.topicId === executive.topicId && row.polarity === "ACTIVE_TARGET"),
"correction polarity rejects the old target and activates only the requested target")
const positionalCorrection = resolveDnaS13ConversationContext({
  sessionId: contextState.sessionId, question: "hayır ilkini soruyorum", responseDepth: "standard",
  privacyAllowed: true, state: contextState,
})
check(positionalCorrection.targetTopicIds[0] === hpa.topicId && positionalCorrection.resolutionMethod === "correction_positional_target", "positional correction resolves previous side A")
const positionalNegation = resolveDnaS13ConversationContext({
  sessionId: contextState.sessionId, question: "ilkini değil ikincisini soruyorum", responseDepth: "standard",
  privacyAllowed: true, state: contextState,
})
check(positionalNegation.targetTopicIds[0] === executive.topicId
  && positionalNegation.topicMentions.some((row) => row.topicId === hpa.topicId && row.polarity === "REJECTED_TARGET"),
"positional negation activates side B and rejects side A")
const suffixTargetCorrection = resolveDnaS13ConversationContext({
  sessionId: contextState.sessionId,
  question: `HPA Ekseninin Temel İşleyişi değil, Yürütücü İşlev mi, Duygusal Regülasyon mu? hedefim; yalnız bunu anlat.`,
  responseDepth: "standard", privacyAllowed: true, state: contextState,
})
check(suffixTargetCorrection.operation === "replace_previous_target"
  && suffixTargetCorrection.targetTopicIds[0] === executive.topicId,
"target named immediately before hedefim is the active correction target")
const naturalCorrection = resolveDnaS13ConversationContext({
  sessionId: contextState.sessionId,
  question: `Düzeltme yapayım: asıl sorduğum Yürütücü İşlev mi, Duygusal Regülasyon mu?. HPA Ekseninin Temel İşleyişi tarafını yanıta geri taşıma. Doğru başlığa geç.`,
  responseDepth: "standard", privacyAllowed: true, state: contextState,
})
check(naturalCorrection.operation === "replace_previous_target"
  && naturalCorrection.targetTopicIds[0] === executive.topicId
  && naturalCorrection.topicMentions.some((row) => row.topicId === hpa.topicId && row.polarity === "REJECTED_TARGET"),
"natural düzeltme and asıl sorduğum wording preserves the corrected target")
const orderedNonCorrection = resolveDnaS13ConversationContext({
  sessionId: contextState.sessionId,
  question: `HPA Ekseninin Temel İşleyişi ile Yürütücü İşlev mi, Duygusal Regülasyon mu? arasında önce ilkini, sonra ikincisini açıkla; sonucu sona bırak.`,
  responseDepth: "standard", privacyAllowed: true, state: contextState,
})
check(!orderedNonCorrection.correction && orderedNonCorrection.targetTopicIds.length === 2,
"comparison order words and sona bırak do not trigger correction")
const noisyDeepen = resolveDnaS13ConversationContext({
  sessionId: contextState.sessionId, question: "az önceki yrutucu islv mevzusunu biraz derinleştir", responseDepth: "standard",
  privacyAllowed: true, state: contextState,
})
check(noisyDeepen.operation === "expand_same_topic" && noisyDeepen.targetTopicIds[0] === executive.topicId,
  "low-overlap contextual deepen remains anchored to the verified target")
const oneStepNoisyDeepen = resolveDnaS13ConversationContext({
  sessionId: contextState.sessionId, question: "şu yrutucu islv meselesinde bir adım daha gidebilir miyiz", responseDepth: "standard",
  privacyAllowed: true, state: contextState,
})
check(oneStepNoisyDeepen.operation === "expand_same_topic" && oneStepNoisyDeepen.targetTopicIds[0] === executive.topicId,
  "one-step low-lexical deepen remains anchored even when the noisy surface is unresolved")
const baddeleyCoreference = resolveDnaS13ConversationContext({
  sessionId: "session-baddeley-001",
  question: "Önce Baddeley modeli için ana kapsamı söyle, sonra modelin self-regülasyon açısından değeri niçin önemli?",
  responseDepth: "standard", privacyAllowed: true, state: null,
})
check(baddeleyCoreference.resolutionMethod === "intra_turn_coreference"
  && baddeleyCoreference.targetTopicIds.length === 2
  && baddeleyCoreference.targetTopicIds[0] === baddeleyCoreference.targetTopicIds[1]
  && baddeleyCoreference.topicMentions.every((row) => row.title === "Baddeley Modeli"),
"intra-turn modelin reference stays scoped to Baddeley instead of a global dependent heading")
const pfcTopic = resolveDnaS13NamedTopicSurfaces("Prefrontal Korteks Yirmi Beş Yaşında Bir Anda Tamamlanmaz")[0]!
const pfcFrame = createDnaS13TopicSemanticFrame({
  topicId: pfcTopic.topicId,
  title: getDnaOwnerBookTopicTitle(pfcTopic.topicId)!,
  orderedClaims: getDnaOwnerBookTopicClaims(pfcTopic.topicId),
})
check(!pfcFrame.thesisClaimIds.includes("owner.unit:2561:fe1a6efbf4f7")
  && pfcFrame.thesisClaimIds.includes("owner.unit:2562:5d4bf50b529d"),
"reported PFC age claim is MYTH_OR_COMMON_CLAIM and the corrective statement is the topic thesis")
const loopTopic = resolveDnaS13NamedTopicSurfaces("Self-Regülasyon–Katılım Döngüsü")[0]!
const loopFrame = createDnaS13TopicSemanticFrame({
  topicId: loopTopic.topicId,
  title: getDnaOwnerBookTopicTitle(loopTopic.topicId)!,
  orderedClaims: getDnaOwnerBookTopicClaims(loopTopic.topicId),
})
const loopLeadIn = loopFrame.claims.find((row) => row.claimId === "owner.unit:3983:5b4af7df5967")
check(loopLeadIn?.role === "LEAD_IN" && !loopLeadIn.selfContained
  && (loopLeadIn.adjacencyEnrichmentClaimIds.length ?? 0) > 0,
"structural lead-in is blocked from standing alone and has verified adjacent enrichment")
for (const wording of [
  "aynı şeyi söyleme",
  "aynı iddiayı döndürme",
  "öncekini yineleme",
  "yeni bir şey varsa söyle",
]) {
  check(resolveDnaS13NoRepeatConstraint(wording).doNotRepeat, `semantic no-repeat constraint: ${wording}`)
}
const crossSession = resolveDnaS13ConversationContext({
  sessionId: "session-context-other", question: "bu ne demek", responseDepth: "standard",
  privacyAllowed: true, state: contextState,
})
check(crossSession.operation === "clarification_required" && crossSession.targetTopicIds.length === 0, "cross-session context inheritance is blocked")
const privacyBlockedContext = resolveDnaS13ConversationContext({
  sessionId: contextState.sessionId, question: "bu ne demek", responseDepth: "standard",
  privacyAllowed: false, state: contextState,
})
check(privacyBlockedContext.operation === "clarification_required" && privacyBlockedContext.targetTopicIds.length === 0, "privacy-blocked turn cannot inherit scientific context")

const privacy = inspectDnaS13CanaryPrivacy("İnterosepsiyon nedir?").classification
function message(overrides: Partial<DnaS13CanaryMessageRecord> = {}): DnaS13CanaryMessageRecord {
  const base: DnaS13CanaryMessageRecord = {
    schemaVersion: DNA_S13_CANARY_TELEMETRY_VERSION,
    architectureVersion: DNA_S13_CANARY_ARCHITECTURE_VERSION,
    architectureHash: DNA_S13_CANARY_ARCHITECTURE_HASH,
    sessionId: "session-test-001",
    messageId: "message-test-001",
    createdAt: "2026-08-10T00:00:00.000Z",
    testerIdHash: "tester-hash",
    question: "İnterosepsiyon nedir?",
    normalizedQuestion: "interosepsiyon nedir",
    answer: "Doğrulanmış cevap.",
    privacy,
    routing: {
      intent: ["scientific_question"], detectedTopicIds: ["topic-1"], focus: ["definition"],
      questionType: ["definition"], followUp: false, correction: false, subquestionCount: 1,
      answerability: ["supported"], comparisonMode: null, parserUncertainty: false,
    },
    retrieval: {
      candidateCount: 4, selectedRequiredClaimIds: ["claim-1"], selectedExplanatoryClaimIds: [], confidence: 0.9,
      contribution: { lexical: 1, semantic: 0, graph: 0 }, comparisonSideACovered: null,
      comparisonSideBCovered: null, missingRequiredSlotIds: [],
    },
    realization: {
      provider: "luna", status: "realized", firstPassValidatorPassed: true, repairValidatorPassed: null,
      inputTokens: 100, cachedInputTokens: 25, outputTokens: 40, latencyMs: 800, costMicrousd: 120,
      cache: "hit", lunaCalls: 1, repairCalls: 0,
    },
    validation: {
      pass: true, wrongClaimSubstitution: 0, claimViolation: 0, relationViolation: 0,
      comparisonConclusionViolation: 0, unsupportedAddition: 0, sourceViolation: 0, safetyViolation: 0,
      failureCodes: [],
    },
    quality: EMPTY_DNA_S13_CANARY_QUALITY,
    training: { training_candidate: false, exclude_from_training: true, exclusion_reason: "review_pending" },
    provenanceHash: "a".repeat(64),
    provenance: null,
  }
  return Object.freeze({ ...base, ...overrides })
}

const goodFeedback = buildDnaS13CanaryFeedback({
  sessionId: "session-test-001",
  messageId: "message-test-001",
  testerIdHash: "tester-hash",
  label: "GOOD",
  lunaValue: "LUNA_QUALITY_GAIN",
  overallQuality: 5,
  createdAt: "2026-08-10T00:01:00.000Z",
})
const candidate = deriveDnaS13CanaryTrainingAnnotation({ message: message(), feedback: goodFeedback })
check(candidate.training_candidate && !candidate.exclude_from_training, "GOOD + privacy PASS + validator PASS becomes candidate annotation")

const fallback = message({
  realization: { ...message().realization, status: "deterministic_fallback" },
})
const excludedFallback = deriveDnaS13CanaryTrainingAnnotation({ message: fallback, feedback: goodFeedback })
check(!excludedFallback.training_candidate && excludedFallback.exclusion_reason === "fallback_or_rejected", "fallback is excluded from training")

const badFeedback = buildDnaS13CanaryFeedback({
  sessionId: "session-test-001",
  messageId: "message-test-001",
  testerIdHash: "tester-hash",
  label: "WRONG_TOPIC",
})
const excludedReview = deriveDnaS13CanaryTrainingAnnotation({ message: message(), feedback: badFeedback })
check(!excludedReview.training_candidate && excludedReview.exclusion_reason === "review_not_good", "non-GOOD review is excluded")

const summary = summarizeDnaS13Canary({
  sessionId: "session-test-001",
  messages: [message()],
  feedback: [goodFeedback],
  trainingAnnotations: [candidate],
  privacyRejectionCount: 2,
  generatedAt: "2026-08-10T00:02:00.000Z",
})
check(summary.scope.productionAffected === false && summary.scope.releaseEligible === false, "summary never implies production release")
check(summary.safety.validatorPassRate === 1 && summary.userExperience.goodRate === 1, "summary computes safety and UX rates")
check(summary.cost.totalMicrousd === 120 && summary.cost.projectedUsdPer1kMessages > 0, "summary computes cost baseline")
check(summary.volume.trainingCandidates === 1 && summary.volume.privacyRejections === 2, "summary counts candidate annotations and privacy rejections")

const storeSource = readFileSync(path.join(process.cwd(), "src/lib/dna/chat/s13/canary/store.server.ts"), "utf8")
check(storeSource.includes("/Volumes/ResearchSSD/Outputs/SelfMetaAI/") && storeSource.includes("mode: 0o600"), "JSONL store is SSD-scoped and private")
check(storeSource.includes("readJsonLines<DnaS13RealizationProvenance>") && storeSource.includes("provenance"), "server session reload includes provenance for verified context reconstruction")
const runnerSource = readFileSync(path.join(process.cwd(), "src/lib/dna/chat/s13/canary/runner.server.ts"), "utf8")
check(runnerSource.includes("storedConversationState") && runnerSource.includes("message.testerIdHash !== input.testerIdHash")
  && runnerSource.includes("message.privacy.category !== \"general_non_sensitive\"")
  && runnerSource.includes("!message.validation.pass"), "stored context is same-tester, privacy-PASS and validator-PASS only")
const productionRoute = readFileSync(path.join(process.cwd(), "src/app/api/app/dna-chat/route.ts"), "utf8")
check(!productionRoute.includes("DNA_S13_INTERNAL_CANARY"), "production chat route has no canary dependency")

console.log(`DNA S13 internal canary tests: PASS (${assertions} assertions)`)

import artifactJson from "./catalog/generated/semantic-router/artifact.json"
import {
  DNA_CHAT_CATALOG_RELATIONS,
  rankCatalogTopicCandidates,
  type DnaCatalogTopicCandidate,
} from "./catalog"
import { normalizeDnaChatText } from "./text"
import type { DnaChatConversationContext, DnaChatQueryKind } from "./types"
import {
  predictDnaSemanticRouter,
  type DnaSemanticRouterArtifact,
} from "./semanticRouterFtrl"

export const DNA_QUESTION_FRAME_VERSION = "dna-question-frame@2" as const
export const DNA_SEMANTIC_ROUTER_VERSION = "dna-semantic-router@1" as const

export type DnaSemanticResolutionMode =
  | "direct"
  | "decomposed"
  | "nearest_supported"
  | "parent_bridge"
  | "case_context_required"
  | "refusal"

export type DnaSemanticConfidenceBand = "high" | "medium" | "low"

export type DnaQuestionFrame = Readonly<{
  version: typeof DNA_QUESTION_FRAME_VERSION
  subquestions: readonly Readonly<{
    normalizedQuestion: string
    topicCandidates: readonly string[]
    auxiliaryConcepts: readonly string[]
    operation: DnaChatQueryKind | "followup"
    ageScope: "child" | "adolescent" | "adult" | "unspecified"
    negated: boolean
    correction: boolean
    requiresReport: boolean
    topicConfidence: number
    relationshipConfidence: number
  }>[]
  previousTopicIds: readonly string[]
  responseDepth: "short" | "standard" | "deep"
}>

export type DnaSemanticRouterDecision = Readonly<{
  routerVersion: typeof DNA_SEMANTIC_ROUTER_VERSION
  enabled: boolean
  domain: string | null
  queryKind: DnaChatQueryKind | "followup"
  confidence: number
  confidenceBand: DnaSemanticConfidenceBand
  parentQuestion: string | null
  parentLabel: string | null
  inDomain: boolean
  runnerUpGap: number
  topicCandidates: readonly DnaCatalogTopicCandidate[]
}>

const ARTIFACT = artifactJson as unknown as DnaSemanticRouterArtifact
const SHA = /^[a-f0-9]{64}$/
if (ARTIFACT.schemaVersion !== "dna-semantic-router-artifact@1"
  || ARTIFACT.routerVersion !== DNA_SEMANTIC_ROUTER_VERSION
  || ARTIFACT.algorithm !== "ftrl_proximal_ovr"
  || ARTIFACT.featureDimension !== 16_384
  || ARTIFACT.hashSeed !== 2_026_0803
  || !SHA.test(ARTIFACT.trainingCorpusSha256)
  || !SHA.test(ARTIFACT.holdoutExclusionSha256)) {
  throw new Error("dna_semantic_router_artifact_invalid")
}

const DOMAIN_CONFIG: Readonly<Record<string, Readonly<{
  label: string
  parentQuestion: string
  anchors: readonly string[]
}>>> = Object.freeze({
  cellular_neurophysiology: {
    label: "Hücresel nörofizyoloji",
    parentQuestion: "Temel nörofizyoloji nasıl açıklanır?",
    anchors: ["nöron", "noron", "sinaps", "membran", "aksiyon potansiyeli", "miyelin", "reseptör", "norotransmiter"],
  },
  cns_networks: {
    label: "Merkezi sinir sistemi ve ağlar",
    parentQuestion: "Merkezi sinir sistemi ve sinir ağları nasıl çalışır?",
    anchors: ["merkezi sinir sistemi", "beyin", "korteks", "insula", "prefrontal", "anterior singulat", "singulat", "acc", "cns", "mss", "sinir ağı", "sinir agi"],
  },
  autonomic_hrv: {
    label: "Otonom sinir sistemi",
    parentQuestion: "Otonom sinir sistemi nedir?",
    anchors: ["otonom", "sempatik", "parasempatik", "hrv", "respiratuvar sinüs aritmisi", "vagal", "barorefleks", "kalp hızı"],
  },
  stress_arousal_recovery: {
    label: "Stres, uyarılma ve toparlanma",
    parentQuestion: "Uyarılma, reaktivite ve toparlanma nasıl ayrılır?",
    anchors: ["stres", "uyarılma", "uyarilma", "arousal", "reaktivite", "toparlanma", "kortizol", "hpa"],
  },
  interoception_sensory: {
    label: "İnterosepsiyon ve duyusal süreçler",
    parentQuestion: "İnterosepsiyon ve duyusal süreçler nedir?",
    anchors: ["interosepsiyon", "beden sinyal", "bedensel sinyal", "duyusal", "modülasyon", "modulasyon", "dokunma", "ışık", "isik", "ses"],
  },
  emotion_self_coregulation: {
    label: "Duygusal düzenleme ve self-regülasyon",
    parentQuestion: "Self regülasyon nedir?",
    anchors: ["self regülasyon", "self regulasyon", "öz düzenleme", "oz duzenleme", "eş regülasyon", "es regulasyon", "duygu düzenleme", "sakinleş"],
  },
  attention_working_memory_executive: {
    label: "Dikkat ve yürütücü işlevler",
    parentQuestion: "Dikkat, çalışma belleği ve yürütücü işlevler nedir?",
    anchors: ["dikkat", "çalışma belleği", "calisma bellegi", "yürütücü", "yurutucu", "inhibisyon", "bilişsel esneklik", "planlama"],
  },
  sleep_circadian: {
    label: "Uyku ve sirkadiyen süreçler",
    parentQuestion: "Uyku ve sirkadiyen süreçler nasıl düzenlenir?",
    anchors: ["uyku", "sirkadiyen", "sirkadyen", "adenozin", "melatonin", "rem", "nrem", "uyaniklik"],
  },
  development_neurodiversity: {
    label: "Gelişim ve nörogelişimsel farklılıklar",
    parentQuestion: "Gelişimsel farklılıklar nasıl değerlendirilir?",
    anchors: ["gelişim", "gelisim", "çocuk", "cocuk", "ergen", "nörogelişim", "norogelisim", "nöroçeşitlilik", "yas grubu"],
  },
  measurement_case_boundaries: {
    label: "Ölçüm ve yorum sınırları",
    parentQuestion: "Ölçüm ve vaka yorum sınırları nelerdir?",
    anchors: ["ölçüm sonucu", "olcum sonucu", "değerlendirme veri", "degerlendirme veri", "geçerlik", "guvenirlik", "rapor bulgusu", "vaka puanı", "vaka puani", "norm"],
  },
})

function enabledFromEnvironment() {
  const raw = String(process.env.DNA_CHAT_SEMANTIC_ROUTER_ENABLED ?? "").trim().toLowerCase()
  return !["0", "false", "off", "disabled"].includes(raw)
}

function operationFromRules(question: string): DnaChatQueryKind | "followup" {
  const value = normalizeDnaChatText(question)
  if (/^(?:bunu|biraz|peki|hayir|yok|daha|ikisi)\b/.test(value)) return "followup"
  if (/\b(?:fark|karsilastir|ayni sey)\b/.test(value)) return "comparison"
  if (/\b(?:ilisk|baglanti|etkiler mi)\b/.test(value)) return "relation"
  if (/\b(?:olc|degerlendir|test)\w*\b/.test(value)) return "measurement"
  if (/\b(?:cocuk|ergen|yetiskin|yas|gelisim)\w*\b/.test(value)) return "development"
  if (/\b(?:kanit|kaynak|literatur|calisma)\w*\b/.test(value)) return "evidence"
  if (/\b(?:yanlis bilinen|mit|her zaman)\b/.test(value)) return "misconception"
  return "definition"
}

function ageScope(question: string): DnaQuestionFrame["subquestions"][number]["ageScope"] {
  const value = normalizeDnaChatText(question)
  if (/\b(?:cocuk|bebek|erken cocukluk|okul oncesi)\w*\b/.test(value)) return "child"
  if (/\bergen\w*\b/.test(value)) return "adolescent"
  if (/\b(?:yetiskin|erişkin)\w*\b/.test(value)) return "adult"
  return "unspecified"
}

function predictedLabel(question: string, prefix: string) {
  return predictDnaSemanticRouter(ARTIFACT, question)
    .find((row) => row.label.startsWith(prefix)) ?? null
}

function semanticConcepts(question: string) {
  const normalized = normalizeDnaChatText(question)
  const matches = Object.entries(DOMAIN_CONFIG).flatMap(([domain, config]) => {
    const anchors = config.anchors
      .filter((anchor) => normalized.includes(normalizeDnaChatText(anchor)))
      .sort((left, right) => right.length - left.length || left.localeCompare(right))
    return anchors.length ? [{ domain, anchors }] : []
  }).sort((left, right) =>
    right.anchors.length - left.anchors.length ||
    (right.anchors[0]?.length ?? 0) - (left.anchors[0]?.length ?? 0) ||
    left.domain.localeCompare(right.domain))
  const predictedDomain = matches.length === 0
    ? predictedLabel(question, "domain:")?.label.slice("domain:".length)
    : null
  const topicCandidates = [...new Set([
    ...matches.map((row) => row.domain),
    ...(predictedDomain ? [predictedDomain] : []),
  ])].slice(0, 2)
  const auxiliaryConcepts = [...new Set(matches.flatMap((row) => row.anchors))].slice(0, 4)
  return { topicCandidates, auxiliaryConcepts }
}

function relationshipConfidence(topicIds: readonly string[], operation: DnaChatQueryKind | "followup") {
  if (operation !== "relation" && operation !== "comparison") return 1
  if (topicIds.length < 2) return 0
  return DNA_CHAT_CATALOG_RELATIONS.some((relation) =>
    (relation.fromTopicId === topicIds[0] && relation.toTopicId === topicIds[1])
    || (relation.fromTopicId === topicIds[1] && relation.toTopicId === topicIds[0])) ? 1 : 0
}

function domainFromTopicCandidate(candidate: DnaCatalogTopicCandidate | undefined): string | null {
  if (!candidate) return null
  if (candidate.topicId.includes("sleep") || candidate.topicId.includes("circadian")) return "sleep_circadian"
  if (candidate.topicId.includes("interoception") || candidate.topicId.includes("sensory")) return "interoception_sensory"
  if (candidate.topicId.startsWith("cns.")) return "cns_networks"
  if (candidate.topicId.startsWith("ans.")) return "autonomic_hrv"
  if (candidate.topicId.startsWith("development.")) return "development_neurodiversity"
  if (candidate.topicId.startsWith("case.")) return "measurement_case_boundaries"
  if (candidate.topicId.includes("attention") || candidate.topicId.includes("executive")) {
    return "attention_working_memory_executive"
  }
  if (candidate.topicId.includes("stress") || candidate.topicId.includes("arousal") || candidate.topicId.includes("recovery")) {
    return "stress_arousal_recovery"
  }
  return candidate.category === "central_nervous_system"
    ? "cns_networks"
    : candidate.category === "autonomic_nervous_system" || candidate.category === "sympathetic_parasympathetic"
      ? "autonomic_hrv"
      : "emotion_self_coregulation"
}

export function getDnaSemanticTopicCandidates(
  question: string,
  previousTopic?: string | null,
  limit = 5,
) {
  return rankCatalogTopicCandidates(question, previousTopic, limit)
}

/**
 * Detects only explicit two-part messages whose parts already resolve to two
 * different supported topics. Such questions do not need an external
 * interpretation call and keeping them local prevents a correct compound
 * answer from being collapsed or redirected.
 */
export function getDnaSemanticExplicitCompoundTopicIds(question: string): readonly string[] {
  const parts = question.split(/\s*;\s*|\n+/u).map((part) => part.trim()).filter(Boolean)
  if (parts.length !== 2) return Object.freeze([])
  const selected = parts.map((part) => getDnaSemanticTopicCandidates(part, null, 3)[0] ?? null)
  if (selected.some((candidate) => !candidate || candidate.confidence < 0.45)) return Object.freeze([])
  const topicIds = selected.map((candidate) => candidate!.topicId)
  return topicIds[0] !== topicIds[1] ? Object.freeze(topicIds) : Object.freeze([])
}

export function buildDnaQuestionFrame(input: Readonly<{
  questions: readonly string[]
  conversationContext?: DnaChatConversationContext | null
  responseDepth?: "short" | "standard" | "deep"
}>): DnaQuestionFrame {
  return Object.freeze({
    version: DNA_QUESTION_FRAME_VERSION,
    subquestions: Object.freeze(input.questions.slice(0, 2).map((question) => {
      const normalized = normalizeDnaChatText(question)
      const concepts = semanticConcepts(question)
      const operation = operationFromRules(question)
      const rankedCandidates = getDnaSemanticTopicCandidates(
        question,
        input.conversationContext?.topicIds[0] ?? null,
      )
      const topicCandidates = [...new Set([
        ...(operation === "followup" ? input.conversationContext?.topicIds ?? [] : []),
        ...rankedCandidates.map((candidate) => candidate.topicId),
        ...concepts.topicCandidates,
      ])].slice(0, 5)
      const topScore = rankedCandidates[0]?.score ?? 0
      const runnerUpScore = rankedCandidates[1]?.score ?? 0
      const gap = topScore > 0 ? Math.max(0, (topScore - runnerUpScore) / topScore) : 0
      return Object.freeze({
        normalizedQuestion: normalized,
        topicCandidates: Object.freeze(topicCandidates),
        auxiliaryConcepts: Object.freeze(concepts.auxiliaryConcepts),
        operation,
        ageScope: ageScope(question),
        negated: /\b(?:degil|istemiyorum|olmadan|yok)\b/.test(normalized),
        correction: /^(?:hayir|yok)\b/.test(normalized),
        requiresReport: /\b(?:bu vaka|raporum|raporumu|sectigim rapor|bu danisan)\b/.test(normalized),
        topicConfidence: Number(Math.min(1, Math.max(
          rankedCandidates[0]?.confidence ?? 0,
          concepts.topicCandidates.length ? 0.82 : 0,
          gap,
        )).toFixed(6)),
        relationshipConfidence: relationshipConfidence(topicCandidates, operation),
      })
    })),
    previousTopicIds: Object.freeze([...(input.conversationContext?.topicIds ?? [])].slice(0, 2)),
    responseDepth: input.responseDepth ?? "standard",
  })
}

export function routeDnaSemanticQuestion(
  question: string,
  conversationContext?: DnaChatConversationContext | null,
): DnaSemanticRouterDecision {
  const enabled = enabledFromEnvironment()
  const normalized = normalizeDnaChatText(question)
  const predictions = predictDnaSemanticRouter(ARTIFACT, question)
  const domainPrediction = predictions.find((row) => row.label.startsWith("domain:")) ?? null
  const kindPrediction = predictions.find((row) => row.label.startsWith("kind:")) ?? null
  const predictedDomain = domainPrediction?.label.slice("domain:".length) ?? null
  const anchoredDomains = Object.entries(DOMAIN_CONFIG).flatMap(([id, candidate]) => {
    const matches = candidate.anchors.filter((anchor) =>
      normalized.includes(normalizeDnaChatText(anchor)))
    return matches.length ? [{ id, matches }] : []
  }).sort((left, right) =>
    right.matches.length - left.matches.length ||
    Math.max(...right.matches.map((value) => value.length)) -
      Math.max(...left.matches.map((value) => value.length)) ||
    left.id.localeCompare(right.id))
  const topicCandidates = getDnaSemanticTopicCandidates(
    question,
    conversationContext?.topicIds[0] ?? null,
  )
  const domain = anchoredDomains[0]?.id ?? domainFromTopicCandidate(topicCandidates[0]) ?? predictedDomain
  const config = domain ? DOMAIN_CONFIG[domain] : null
  const ruleKind = operationFromRules(question)
  const predictedKind = kindPrediction?.label.slice("kind:".length) as DnaChatQueryKind | "followup" | undefined
  const queryKind = ruleKind === "definition" && predictedKind ? predictedKind : ruleKind
  const contextBound = Boolean(conversationContext?.topicIds.length)
  const anchored = anchoredDomains.length > 0
  const catalogConfidence = topicCandidates[0]?.confidence ?? 0
  const topScore = topicCandidates[0]?.score ?? 0
  const runnerUpScore = topicCandidates[1]?.score ?? 0
  const runnerUpGap = topScore > 0 ? Math.max(0, (topScore - runnerUpScore) / topScore) : 0
  const inDomain = enabled && Boolean(config) && (anchored || contextBound || catalogConfidence >= 0.5)
  const confidence = inDomain
    ? Number(Math.min(1, Math.max(
        domainPrediction?.probability ?? 0,
        anchored ? 0.86 : 0,
        catalogConfidence * 0.76 + runnerUpGap * 0.24,
      )).toFixed(6))
    : 0
  return Object.freeze({
    routerVersion: DNA_SEMANTIC_ROUTER_VERSION,
    enabled,
    domain,
    queryKind,
    confidence,
    confidenceBand: confidence >= 0.72 ? "high" : confidence >= 0.48 ? "medium" : "low",
    parentQuestion: inDomain ? config?.parentQuestion ?? null : null,
    parentLabel: inDomain ? config?.label ?? null : null,
    inDomain,
    runnerUpGap: Number(runnerUpGap.toFixed(6)),
    topicCandidates,
  })
}

export function getDnaSemanticRouterStatus() {
  return Object.freeze({
    routerVersion: DNA_SEMANTIC_ROUTER_VERSION,
    questionFrameVersion: DNA_QUESTION_FRAME_VERSION,
    modelVersion: ARTIFACT.modelVersion,
    algorithm: ARTIFACT.algorithm,
    featureDimension: ARTIFACT.featureDimension,
    labelCount: ARTIFACT.labels.length,
    trainingCorpusSha256: ARTIFACT.trainingCorpusSha256,
    holdoutExclusionSha256: ARTIFACT.holdoutExclusionSha256,
    runtimeTraining: false,
    externalLlm: false,
  })
}

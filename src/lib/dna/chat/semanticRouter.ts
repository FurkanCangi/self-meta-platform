import artifactJson from "./catalog/generated/semantic-router/artifact.json"
import { normalizeDnaChatText } from "./text"
import type { DnaChatConversationContext, DnaChatQueryKind } from "./types"
import {
  predictDnaSemanticRouter,
  type DnaSemanticRouterArtifact,
} from "./semanticRouterFtrl"

export const DNA_QUESTION_FRAME_VERSION = "dna-question-frame@1" as const
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
    topicCandidates: readonly string[]
    auxiliaryConcepts: readonly string[]
    operation: DnaChatQueryKind | "followup"
    ageScope: "child" | "adolescent" | "adult" | "unspecified"
    negated: boolean
    correction: boolean
    requiresReport: boolean
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
      return Object.freeze({
        topicCandidates: Object.freeze(concepts.topicCandidates),
        auxiliaryConcepts: Object.freeze(concepts.auxiliaryConcepts),
        operation: operationFromRules(question),
        ageScope: ageScope(question),
        negated: /\b(?:degil|istemiyorum|olmadan|yok)\b/.test(normalized),
        correction: /^(?:hayir|yok)\b/.test(normalized),
        requiresReport: /\b(?:bu vaka|raporum|raporumu|sectigim rapor|bu danisan)\b/.test(normalized),
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
  const domain = anchoredDomains[0]?.id ?? predictedDomain
  const config = domain ? DOMAIN_CONFIG[domain] : null
  const ruleKind = operationFromRules(question)
  const predictedKind = kindPrediction?.label.slice("kind:".length) as DnaChatQueryKind | "followup" | undefined
  const queryKind = ruleKind === "definition" && predictedKind ? predictedKind : ruleKind
  const contextBound = Boolean(conversationContext?.topicIds.length)
  const anchored = anchoredDomains.length > 0
  const inDomain = enabled && Boolean(config) && (anchored || contextBound)
  const confidence = inDomain ? Number((domainPrediction?.probability ?? 0).toFixed(6)) : 0
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

import { normalizeDnaChatText } from "../text"
import {
  DNA_STUDENT_FIRST_CONVERSATION_VERSION,
  DNA_STUDENT_FIRST_REQUEST_VERSION,
  type StudentAnswerObligation,
  type StudentAnswerObligationKind,
  type StudentConversationAction,
  type StudentConversationState,
  type StudentConversationTurnSnapshot,
  type StudentPresentationRequest,
  type StudentReferent,
  type StudentRequestContract,
  type StudentSemanticTask,
} from "./contracts"

type TargetLexeme = Readonly<{
  id: string
  label: string
  aliases: readonly string[]
}>

const TARGET_LEXICON: readonly TargetLexeme[] = Object.freeze([
  { id: "self_regulation", label: "öz düzenleme", aliases: ["öz düzenleme", "öz-düzenleme", "self regülasyon", "self-regülasyon"] },
  { id: "self_control", label: "öz denetim", aliases: ["öz denetim", "öz-denetim", "öz kontrol", "self kontrol"] },
  { id: "attention", label: "dikkat", aliases: ["dikkat", "odaklanma"] },
  { id: "executive_functions", label: "yürütücü işlevler", aliases: ["yürütücü işlev", "yürütücü işlevler", "yönetici işlev"] },
  { id: "inhibition", label: "inhibisyon", aliases: ["inhibisyon", "ketleme", "ketleyici kontrol", "dürtü kontrolü", "dürtüyü durdurma"] },
  { id: "working_memory", label: "çalışma belleği", aliases: ["çalışma belleği", "yönergeyi aklında tutma", "akılda tutma"] },
  { id: "planning", label: "planlama", aliases: ["planlama", "plan yapma"] },
  { id: "cognitive_flexibility", label: "bilişsel esneklik", aliases: ["bilişsel esneklik", "esnek düşünme"] },
  { id: "coregulation", label: "eş düzenleme", aliases: ["eş düzenleme", "eş-düzenleme", "ko-regülasyon", "ko regülasyon"] },
  { id: "arousal", label: "uyarılma", aliases: ["arousal", "uyarılma", "uyarılmışlık"] },
  { id: "sensory_regulation", label: "duyusal düzenleme", aliases: ["duyusal düzenleme", "duyusal regülasyon"] },
  { id: "sensory_modulation", label: "duyusal modülasyon", aliases: ["duyusal modülasyon", "duyusal modulasyon"] },
  { id: "emotion_regulation", label: "duygu düzenleme", aliases: ["duygu düzenleme", "duygusal düzenleme", "duygu regülasyonu"] },
  { id: "interoception", label: "interosepsiyon", aliases: ["interosepsiyon", "beden sinyali", "bedensel sinyal", "iç duyum"] },
  { id: "reactivity", label: "reaktivite", aliases: ["reaktivite", "tepkisellik"] },
  { id: "recovery", label: "toparlanma", aliases: ["toparlanma", "göreve dönme", "oyuna dönme"] },
])

const EMPTY_PRESENTATION: StudentPresentationRequest = Object.freeze({
  depth: "standard",
  language: "standard",
  format: "prose",
  example: "none",
  requestedSentenceCount: null,
})

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function detectedTargets(message: string): string[] {
  const normalized = normalizeDnaChatText(message)
  const hits: Array<{ id: string; at: number; length: number }> = []
  for (const entry of TARGET_LEXICON) {
    for (const alias of entry.aliases) {
      const normalizedAlias = normalizeDnaChatText(alias)
      const at = normalized.indexOf(normalizedAlias)
      if (at >= 0) hits.push({ id: entry.id, at, length: normalizedAlias.length })
    }
  }
  hits.sort((left, right) => left.at - right.at || right.length - left.length)
  return unique(hits.map((hit) => hit.id))
}

function rejectedTargets(message: string, explicitTargets: readonly string[]): string[] {
  const normalized = normalizeDnaChatText(message)
  return explicitTargets.filter((targetId) => {
    const target = TARGET_LEXICON.find((entry) => entry.id === targetId)
    return target?.aliases.some((alias) => {
      const label = normalizeDnaChatText(alias)
      return normalized.includes(`${label} degil`) ||
        normalized.includes(`${label} kismini sormuyorum`) ||
        normalized.includes(`${label} tarafini sormuyorum`) ||
        normalized.includes(`${label} sormuyorum`)
    }) === true
  })
}

function semanticTaskFor(message: string): StudentSemanticTask {
  const normalized = normalizeDnaChatText(message)
  if (/\b(?:hangi tedavi|hangi terapi|ne uygulayayim|seans plani|tedavi plani)\b/.test(normalized)) return "treatment_boundary"
  if (/\b(?:toparla|ozetle|ozet yap|konustugumuzu|konusmayi)\b/.test(normalized)) return "summarize"
  if (/\b(?:tek gozlem|gozlemde|neye bak|nasil gozlemler)\b/.test(normalized)) return "observe"
  if (/\b(?:kanit|kaynak|calismalar|ne kadar guvenilir)\b/.test(normalized)) return "evidence"
  if (/\b(?:ayni mi|ayni sey mi|farki|ayir|karsilastir|hangisi)\b/.test(normalized)) return "compare"
  if (/\b(?:ornek|ornegi|mesela)\b/.test(normalized)) return "example"
  if (/\b(?:cocuk|ogrenci)\b/.test(normalized) && /\b(?:ne olabilir|ne dusun|diyebilir miyiz|kesin)\b/.test(normalized)) return "case_reasoning"
  if (/\b(?:ne demek|nedir|neydi|tam olarak ne)\b/.test(normalized)) return "define"
  return "explain"
}

function conversationActionFor(message: string, hasHistory: boolean): StudentConversationAction {
  const normalized = normalizeDnaChatText(message)
  if (/\b(?:toparla|ozetle|ozet yap|konustugumuzu|konusmayi)\b/.test(normalized)) return "summarize_session"
  if (/\b(?:ilk anlattigin|ilk konu|az onceki konu|geri donelim|donelim|basa donelim)\b/.test(normalized)) return "return"
  if (/^(?:hayir|yok)\b|\b(?:sormuyorum|onu demiyorum|yanlis anladin|kastettigim)\b/.test(normalized)) return "repair"
  return hasHistory ? "continue" : "start"
}

function presentationFor(message: string): StudentPresentationRequest {
  const normalized = normalizeDnaChatText(message)
  const countMatch = normalized.match(/\b(iki|uc|dort|[2-4]) cumle\b/)
  const sentenceCount = countMatch
    ? ({ iki: 2, uc: 3, dort: 4 } as Record<string, number>)[countMatch[1]] ?? Number(countMatch[1])
    : null
  const plain = /\b(?:sade|basit|ogrenci|akademik olma|akademik oldu|gunluk dil|duz anlat)\b/.test(normalized)
  const brief = /\b(?:kisa|kisaca|minicik|ozet|[2-4] cumle|iki cumle|uc cumle|dort cumle)\b/.test(normalized)
  const deep = /\b(?:ayrintili|detayli|derin|biraz ac|daha ac)\b/.test(normalized)
  const concreteExample = /\b(?:cocuk|ogrenci|sinif|ders|oyun|gunluk hayat)\b/.test(normalized) && /\b(?:ornek|mesela)\b/.test(normalized)
  return Object.freeze({
    depth: brief ? "brief" : deep ? "deep" : "standard",
    language: plain ? "plain_student" : "standard",
    format: /\btablo\b/.test(normalized) && !/\btablo yapma\b/.test(normalized)
      ? "table"
      : /\b(?:madde madde|maddelerle)\b/.test(normalized)
        ? "bullets"
        : "prose",
    example: concreteExample ? "concrete" : /\b(?:ornek|mesela)\b/.test(normalized) ? "brief" : "none",
    requestedSentenceCount: Number.isFinite(sentenceCount) ? sentenceCount : null,
  })
}

function historyReferent(
  message: string,
  state: StudentConversationState,
  explicitTargets: readonly string[],
): StudentReferent {
  const normalized = normalizeDnaChatText(message)
  const isReturn = /\b(?:ilk anlattigin|ilk konu|az onceki konu|geri donelim|donelim|basa donelim)\b/.test(normalized)
  const isReferential = /\b(?:bu(?:nu|nun|nunla|nda|rada|na|ndan)?|onu|o zaman|ayni sey|az onceki|dedigin|ornekte|cocukta|ikisinden|ikisini)\b/.test(normalized)
  if (isReturn && state.semanticHistory.length) {
    const searchOrder = /\b(?:ilk|basa)\b/.test(normalized)
      ? [...state.semanticHistory]
      : [...state.semanticHistory].reverse()
    const match = explicitTargets.length
      ? searchOrder.find((turn) => explicitTargets.some((target) => turn.targetIds.includes(target)))
      : searchOrder[0]
    return Object.freeze({
      kind: match ? "history" : "none",
      turnId: match?.turnId ?? null,
      targetIds: Object.freeze(match?.targetIds ?? []),
    })
  }
  if (isReferential && state.semanticHistory.length) {
    const active = state.semanticHistory.at(-1)!
    return Object.freeze({ kind: "active", turnId: active.turnId, targetIds: Object.freeze(active.targetIds) })
  }
  return Object.freeze({ kind: "none", turnId: null, targetIds: Object.freeze([]) })
}

function obligation(
  turnId: string,
  index: number,
  kind: StudentAnswerObligationKind,
  targetIds: readonly string[],
  description: string,
): StudentAnswerObligation {
  return Object.freeze({ id: `${turnId}:o${index + 1}`, kind, targetIds: Object.freeze([...targetIds]), description })
}

function obligationsFor(
  turnId: string,
  semanticTask: StudentSemanticTask,
  conversationAction: StudentConversationAction,
  targetIds: readonly string[],
  rejectedTargetIds: readonly string[],
  comparisonTargetIds: readonly string[],
  componentTargetIds: readonly string[],
  presentation: StudentPresentationRequest,
  message: string,
): readonly StudentAnswerObligation[] {
  const specs: Array<{ kind: StudentAnswerObligationKind; targets: readonly string[]; description: string }> = []
  const add = (kind: StudentAnswerObligationKind, targets: readonly string[], description: string) => specs.push({ kind, targets, description })

  if (semanticTask === "define") add("define_target", targetIds, "Hedef kavramı doğrudan tanımla")
  if (semanticTask === "compare") {
    add("distinguish_targets", comparisonTargetIds, "Karşılaştırılan kavramları birbirinden ayır")
    add("explain_relation", comparisonTargetIds, "Kavramların ilişkisini açıkla")
  }
  if (semanticTask === "example") {
    add("give_concrete_example", targetIds, "İstenen bağlamda somut örnek ver")
    add("bind_example_to_target", targetIds, "Örneğin hedef kavramla bağını açıkla")
  }
  if (conversationAction === "repair" && rejectedTargetIds.length) {
    add("honor_rejected_target", rejectedTargetIds, "Kullanıcının reddettiği hedefe geri dönme")
  }
  if (conversationAction === "return") add("use_history_anchor", targetIds, "Doğru geçmiş konuşma hedefini kullan")
  if (
    presentation.language === "plain_student" &&
    conversationAction !== "start" &&
    /\b(?:daha basit|akademik oldu|akademik olmadan|yeniden soyle|tekrar anlat)\b/.test(normalizeDnaChatText(message))
  ) {
    add("preserve_target_while_simplifying", targetIds, "Aynı hedefi daha sade dille anlat")
  }
  for (const targetId of componentTargetIds) {
    add("cover_requested_component", [targetId], `İstenen ${targetId} bileşenini ayrı karşıla`)
  }
  if (semanticTask === "case_reasoning" || semanticTask === "observe") {
    add("state_single_observation_limit", targetIds, "Tek gözlemden kesin sonuç çıkarma")
    add("name_additional_context", targetIds, "Gerekli ek bağlam veya gözlemi belirt")
  }
  if (semanticTask === "summarize") {
    add("summarize_known", targetIds, "Konuşmada desteklenen bilgileri özetle")
    if (/\b(?:neyi bilmiyoruz|bilmedigimiz|kesin degil|sinir)\b/.test(normalizeDnaChatText(message))) {
      add("summarize_unknown", targetIds, "Bilinmeyen veya kesinleştirilemeyen noktaları özetle")
    }
    if (/\b(?:gozlem|neye bak)\b/.test(normalizeDnaChatText(message))) {
      add("summarize_observation_focus", targetIds, "Gözlemde izlenecek noktaları özetle")
    }
  }
  if (semanticTask === "treatment_boundary") {
    add("refuse_treatment_selection", targetIds, "Tedavi veya terapi seçimi yapma")
    add("offer_safe_assessment_frame", targetIds, "Güvenli genel değerlendirme çerçevesi sun")
  }
  if (presentation.example !== "none" && !specs.some((spec) => spec.kind === "give_concrete_example")) {
    add("give_concrete_example", targetIds, "İstenen kısa örneği ekle")
  }
  if (!specs.length) add("define_target", targetIds, "Kullanıcının hedefini doğrudan açıkla")

  return Object.freeze(specs.map((spec, index) => obligation(turnId, index, spec.kind, spec.targets, spec.description)))
}

export function createEmptyStudentConversationState(): StudentConversationState {
  return Object.freeze({
    version: DNA_STUDENT_FIRST_CONVERSATION_VERSION,
    activeTargetIds: Object.freeze([]),
    explicitReferent: Object.freeze({ kind: "none", turnId: null, targetIds: Object.freeze([]) }),
    rejectedTargetIds: Object.freeze([]),
    comparisonTargetIds: Object.freeze([]),
    requestedPresentation: EMPTY_PRESENTATION,
    unresolvedObligations: Object.freeze([]),
    compactSummary: "",
    semanticHistory: Object.freeze([]),
  })
}

export function interpretStudentRequest(
  input: Readonly<{ turnId: string; message: string; state: StudentConversationState }>,
): StudentRequestContract {
  const conversationAction = conversationActionFor(input.message, input.state.semanticHistory.length > 0)
  const explicitTargets = detectedTargets(input.message)
  const rejected = rejectedTargets(input.message, explicitTargets)
  const referent = historyReferent(input.message, input.state, explicitTargets)
  const anchoredSnapshot = referent.turnId
    ? input.state.semanticHistory.find((turn) => turn.turnId === referent.turnId) ?? null
    : null
  const detectedSemanticTask = semanticTaskFor(input.message)
  const semanticTask = conversationAction === "return" && detectedSemanticTask === "explain" && anchoredSnapshot
    ? anchoredSnapshot.semanticTask
    : detectedSemanticTask
  const allowedExplicitTargets = explicitTargets.filter((target) => !rejected.includes(target))
  let targetIds = allowedExplicitTargets.length ? allowedExplicitTargets : [...referent.targetIds]

  if (!targetIds.length && semanticTask !== "treatment_boundary") targetIds = [...input.state.activeTargetIds]

  if (conversationAction === "summarize_session" && !allowedExplicitTargets.length && input.state.semanticHistory.length) {
    targetIds = unique(input.state.semanticHistory.flatMap((turn) => turn.targetIds))
  }

  const normalized = normalizeDnaChatText(input.message)
  let comparisonTargets = semanticTask === "compare" ? [...targetIds] : []
  if (semanticTask === "compare" && comparisonTargets.length === 1 && input.state.activeTargetIds.length) {
    comparisonTargets = unique([...input.state.activeTargetIds, ...comparisonTargets])
  }
  if (semanticTask === "compare" && /\bikisini|ikisinden|ikisi\b/.test(normalized) && input.state.comparisonTargetIds.length === 2) {
    comparisonTargets = [...input.state.comparisonTargetIds]
  }
  if (comparisonTargets.length) targetIds = unique([...targetIds, ...comparisonTargets])

  const componentTargetIds = targetIds.length > 1 && /\b(?:ayri ayri|ucunu|ikisini|bilesen)\b/.test(normalized)
    ? [...targetIds]
    : []
  const presentation = presentationFor(input.message)
  const obligations = obligationsFor(
    input.turnId,
    semanticTask,
    conversationAction,
    targetIds,
    rejected,
    comparisonTargets,
    componentTargetIds,
    presentation,
    input.message,
  )

  const ambiguity = conversationAction === "return" && referent.kind === "none"
    ? "history_anchor_missing"
    : semanticTask === "compare" && comparisonTargets.length < 2
      ? "comparison_side_missing"
      : !targetIds.length && semanticTask !== "treatment_boundary"
        ? "target_missing"
        : "none"

  return Object.freeze({
    version: DNA_STUDENT_FIRST_REQUEST_VERSION,
    turnId: input.turnId,
    semanticTask,
    conversationAction,
    targetIds: Object.freeze(unique(targetIds)),
    rejectedTargetIds: Object.freeze(unique(rejected)),
    comparisonTargetIds: Object.freeze(unique(comparisonTargets)),
    componentTargetIds: Object.freeze(unique(componentTargetIds)),
    referent,
    presentation,
    obligations,
    ambiguity,
    safetyIntent: semanticTask === "treatment_boundary"
      ? "treatment_selection"
      : semanticTask === "case_reasoning" || semanticTask === "observe"
        ? "case_interpretation"
        : "general_education",
  })
}

function targetLabel(targetId: string): string {
  return TARGET_LEXICON.find((target) => target.id === targetId)?.label ?? targetId
}

function summaryForHistory(history: readonly StudentConversationTurnSnapshot[]): string {
  return history.slice(-6).map((turn) => {
    const targets = turn.targetIds.map(targetLabel).join(" + ") || "belirsiz hedef"
    const rejected = turn.rejectedTargetIds.length
      ? `; reddedilen ${turn.rejectedTargetIds.map(targetLabel).join(" + ")}`
      : ""
    return `${turn.turnId}: ${turn.semanticTask}/${turn.conversationAction} — ${targets}${rejected}`
  }).join(" | ").slice(0, 480)
}

export function applyStudentRequestContract(
  state: StudentConversationState,
  contract: StudentRequestContract,
): StudentConversationState {
  const snapshot: StudentConversationTurnSnapshot = Object.freeze({
    turnId: contract.turnId,
    semanticTask: contract.semanticTask,
    conversationAction: contract.conversationAction,
    targetIds: Object.freeze([...contract.targetIds]),
    rejectedTargetIds: Object.freeze([...contract.rejectedTargetIds]),
    comparisonTargetIds: Object.freeze([...contract.comparisonTargetIds]),
    presentation: contract.presentation,
    semanticSummary: `${contract.semanticTask}/${contract.conversationAction}:${contract.targetIds.join(",")}`,
  })
  const semanticHistory = Object.freeze([...state.semanticHistory, snapshot].slice(-8))
  return Object.freeze({
    version: DNA_STUDENT_FIRST_CONVERSATION_VERSION,
    activeTargetIds: Object.freeze([...contract.targetIds]),
    explicitReferent: contract.referent,
    rejectedTargetIds: Object.freeze(unique([...state.rejectedTargetIds, ...contract.rejectedTargetIds])),
    comparisonTargetIds: Object.freeze([...contract.comparisonTargetIds]),
    requestedPresentation: contract.presentation,
    unresolvedObligations: Object.freeze([...contract.obligations]),
    compactSummary: summaryForHistory(semanticHistory),
    semanticHistory,
  })
}

export function resolveStudentObligations(
  state: StudentConversationState,
  resolvedObligationIds: readonly string[],
): StudentConversationState {
  const resolved = new Set(resolvedObligationIds)
  return Object.freeze({
    ...state,
    unresolvedObligations: Object.freeze(state.unresolvedObligations.filter((item) => !resolved.has(item.id))),
  })
}

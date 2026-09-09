import {
  getDnaOwnerBookTopicTitle,
  resolveDnaOwnerBook,
} from "../ownerBookRuntime"
import { resolveDnaS13NamedTopicSurfaces } from "../s13/conversationContext"
import { normalizeDnaChatText } from "../text"

export const DNA_STUDENT_CATALOG_TARGET_PREFIX = "catalog:" as const

const CORE_TARGET_CROSSWALK: Readonly<Record<string, Readonly<{
  query: string
  expectedLeaf: string
  namedExact?: boolean
  expectedParent?: string
  namedTheories?: readonly Readonly<{ title: string; query: string }>[]
}>>> = Object.freeze({
  self_regulation: Object.freeze({ query: "Self-Regülasyon Nedir?", expectedLeaf: "Self-Regülasyon Nedir?" }),
  self_control: Object.freeze({ query: "Yürütücü İşlev ve Öz-Kontrol", expectedLeaf: "Yürütücü İşlev ve Öz-Kontrol" }),
  attention: Object.freeze({ query: "Yürütücü İşlev ve Dikkat", expectedLeaf: "Yürütücü İşlev ve Dikkat" }),
  // Canonical concept evidence must include its definition and components,
  // not a section whose approved claims retain only an orphan list lead-in.
  executive_functions: Object.freeze({ query: "Yürütücü İşlev ve Bilişsel Kontrol Modelleri", expectedLeaf: "Temel Bileşenler" }),
  inhibition: Object.freeze({ query: "İnhibisyon Nedir?", expectedLeaf: "İnhibisyon Nedir?" }),
  working_memory: Object.freeze({ query: "Çalışma Belleği", expectedLeaf: "Çalışma Belleği ve Kısa Süreli Bellek" }),
  planning: Object.freeze({ query: "Planlama", expectedLeaf: "Planlama" }),
  cognitive_flexibility: Object.freeze({ query: "Esneklik Nedir?", expectedLeaf: "Esneklik Nedir?" }),
  coregulation: Object.freeze({ query: "Ko-Regülasyon", expectedLeaf: "Ko-Regülasyon" }),
  arousal: Object.freeze({
    query: "Arousal, Uyanıklık ve Dikkat Arasındaki Ayrım",
    expectedLeaf: "Arousal, Uyanıklık ve Dikkat Arasındaki Ayrım",
  }),
  sensory_regulation: Object.freeze({
    query: "Duyusal Regülasyonun Self-Regülasyon İçindeki Yeri",
    expectedLeaf: "Duyusal Regülasyonun Self-Regülasyon İçindeki Yeri",
  }),
  sensory_modulation: Object.freeze({ query: "Duyusal Modülasyon", expectedLeaf: "Duyusal Modülasyon" }),
  sensory_registration: Object.freeze({ query: "Duyusal Kayıt", expectedLeaf: "Duyusal Kayıt" }),
  sensory_underresponsivity: Object.freeze({ query: "Duyusal Yetersiz Yanıt Verme", expectedLeaf: "Duyusal Yetersiz Yanıt Verme" }),
  emotion_regulation: Object.freeze({
    query: "Regülasyon Katmanlarının Okupasyon İçinde Birleşmesi Duygusal Katman",
    expectedLeaf: "Duygusal Katman",
    expectedParent: "Regülasyon Katmanlarının Okupasyon İçinde Birleşmesi",
    namedExact: true,
    namedTheories: Object.freeze([{ title: "Gross’un Duygu Düzenleme Süreç Modeli",
      query: "Duygunun Oluşumu ve Düzenlenmesi" }]),
  }),
  interoception: Object.freeze({ query: "İnterosepsiyon Nedir?", expectedLeaf: "İnterosepsiyonun Tanımı" }),
  reactivity: Object.freeze({ query: "Reaktivite ve Regülasyon Ayrımı", expectedLeaf: "Reaktivite ve Regülasyon Ayrımı" }),
  stress_reactivity: Object.freeze({ query: "Stres Reaktivitesi ve Toparlanma", expectedLeaf: "Stres Reaktivitesi ve Toparlanma" }),
  heart_rate_variability: Object.freeze({ query: "HRV Neyi Gösterir, Neyi Göstermez?", expectedLeaf: "HRV Neyi Gösterir, Neyi Göstermez?" }),
  sleep_regulation: Object.freeze({ query: "Uyku ve Self-Regülasyon", expectedLeaf: "Uyku ve Self-Regülasyon", namedExact: true }),
  recovery: Object.freeze({ query: "Reaktivite ve Toparlanma", expectedLeaf: "Reaktivite ve Toparlanma" }),
})

const CORE_VISIBLE_ALIASES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  self_regulation: Object.freeze(["öz düzenleme", "öz-düzenleme", "self-regülasyon"]),
  self_control: Object.freeze(["öz-kontrol", "öz kontrol", "öz-denetim", "öz denetim"]),
  attention: Object.freeze(["dikkat"]),
  executive_functions: Object.freeze(["yürütücü işlev"]),
  inhibition: Object.freeze(["inhibisyon", "dürtü kontrol"]),
  working_memory: Object.freeze(["çalışma belleği"]),
  planning: Object.freeze(["planlama"]),
  cognitive_flexibility: Object.freeze(["bilişsel esneklik", "esneklik"]),
  coregulation: Object.freeze(["ko-regülasyon", "eş düzenleme", "eş-düzenleme"]),
  arousal: Object.freeze(["arousal", "uyarılma düzeyi"]),
  sensory_regulation: Object.freeze(["duyusal düzenleme", "duyusal regülasyon"]),
  sensory_modulation: Object.freeze(["duyusal modülasyon"]),
  sensory_registration: Object.freeze(["duyusal kayıt"]),
  sensory_underresponsivity: Object.freeze(["duyusal yetersiz yanıt verme", "hiporeaktivite"]),
  emotion_regulation: Object.freeze(["duygu düzenleme", "duygusal regülasyon"]),
  interoception: Object.freeze(["interosepsiyon"]),
  reactivity: Object.freeze(["reaktivite"]),
  stress_reactivity: Object.freeze(["stres reaktivitesi"]),
  heart_rate_variability: Object.freeze(["HRV", "kalp hızı değişkenliği"]),
  sleep_regulation: Object.freeze(["uyku ve öz düzenleme", "uyku ve self-regülasyon"]),
  recovery: Object.freeze(["toparlanma"]),
})

export type StudentTargetDescriptor = Readonly<{
  studentTargetId: string
  ownerBookTopicId: string
  ownerBookTopicTitle: string
  visibleAliases: readonly string[]
  source: "core_crosswalk" | "catalog_topic"
}>

const DESCRIPTOR_CACHE = new Map<string, StudentTargetDescriptor>()
let coreTargetByTopicId: ReadonlyMap<string, string> | null = null

function resolveCoreTarget(targetId: string): StudentTargetDescriptor | null {
  const crosswalk = CORE_TARGET_CROSSWALK[targetId]
  if (!crosswalk) return null
  const namedExact = crosswalk.namedExact
    ? resolveDnaS13NamedTopicSurfaces(crosswalk.query, [], 8)
      .find((candidate) => candidate.title.split(" · ").at(-1) === crosswalk.expectedLeaf
        && (!crosswalk.expectedParent || getDnaOwnerBookTopicTitle(candidate.topicId)?.split(" · ")
          .includes(crosswalk.expectedParent)))
    : null
  const match = namedExact ?? resolveDnaOwnerBook(crosswalk.query, [], "standard")
  if (!match) throw new Error(`dna_student_s13_crosswalk_unresolved:${targetId}`)
  const title = getDnaOwnerBookTopicTitle(match.topicId)
  if (!title) throw new Error(`dna_student_s13_crosswalk_title_missing:${targetId}`)
  if (title.split(" · ").at(-1) !== crosswalk.expectedLeaf) {
    throw new Error(`dna_student_s13_crosswalk_title_drift:${targetId}`)
  }
  if (crosswalk.expectedParent && !title.split(" · ").includes(crosswalk.expectedParent)) {
    throw new Error(`dna_student_s13_crosswalk_parent_drift:${targetId}`)
  }
  return Object.freeze({
    studentTargetId: targetId,
    ownerBookTopicId: match.topicId,
    ownerBookTopicTitle: title,
    visibleAliases: CORE_VISIBLE_ALIASES[targetId]!,
    source: "core_crosswalk",
  })
}

function coreTopicIndex() {
  if (coreTargetByTopicId) return coreTargetByTopicId
  coreTargetByTopicId = new Map(Object.keys(CORE_TARGET_CROSSWALK).map((targetId) => {
    const descriptor = resolveStudentTargetDescriptor(targetId)
    return [descriptor.ownerBookTopicId, targetId]
  }))
  return coreTargetByTopicId
}

export function isStudentCatalogTargetId(targetId: string) {
  return targetId.startsWith(DNA_STUDENT_CATALOG_TARGET_PREFIX)
}

export function studentTargetIdForOwnerBookTopic(topicId: string) {
  const coreTarget = coreTopicIndex().get(topicId)
  return coreTarget ?? `${DNA_STUDENT_CATALOG_TARGET_PREFIX}${topicId}`
}

export function resolveStudentTargetDescriptor(targetId: string): StudentTargetDescriptor {
  const cached = DESCRIPTOR_CACHE.get(targetId)
  if (cached) return cached
  const core = resolveCoreTarget(targetId)
  if (core) {
    DESCRIPTOR_CACHE.set(targetId, core)
    return core
  }
  if (!isStudentCatalogTargetId(targetId)) throw new Error(`dna_student_s13_crosswalk_missing:${targetId}`)
  const topicId = targetId.slice(DNA_STUDENT_CATALOG_TARGET_PREFIX.length)
  const title = getDnaOwnerBookTopicTitle(topicId)
  if (!title) throw new Error(`dna_student_catalog_target_invalid:${targetId}`)
  const descriptor = Object.freeze({
    studentTargetId: targetId,
    ownerBookTopicId: topicId,
    ownerBookTopicTitle: title,
    visibleAliases: Object.freeze([title.split(" · ").at(-1) ?? title]),
    source: "catalog_topic" as const,
  })
  DESCRIPTOR_CACHE.set(targetId, descriptor)
  return descriptor
}

export function studentTargetVisibleAliases(targetId: string) {
  return resolveStudentTargetDescriptor(targetId).visibleAliases
}

function explicitSurface(message: string, values: readonly string[]) {
  const normalizedMessage = ` ${normalizeDnaChatText(message)} `
  return values.some((value) => {
    const normalized = normalizeDnaChatText(value)
    return normalized.length >= 4 && normalizedMessage.includes(` ${normalized}`)
  })
}

export function resolveStudentNamedCatalogTargets(
  message: string,
  preferredTargetIds: readonly string[] = [],
  maximum = 8,
) {
  const preferredTopicIds = preferredTargetIds.flatMap((targetId) => {
    try {
      return [resolveStudentTargetDescriptor(targetId).ownerBookTopicId]
    } catch {
      return []
    }
  })
  const candidates: Array<Readonly<{
    topic: ReturnType<typeof resolveDnaS13NamedTopicSurfaces>[number]
    relationEquivalent: boolean
  }>> = resolveDnaS13NamedTopicSurfaces(message, preferredTopicIds, maximum)
    .map((topic) => Object.freeze({ topic, relationEquivalent: false }))
  // A named theory remains a catalog topic, not the general concept it models.
  // Match the complete registered title, never a question-specific target pair.
  for (const theory of Object.values(CORE_TARGET_CROSSWALK).flatMap((row) => row.namedTheories ?? [])) {
    if (!explicitSurface(message, [theory.title])) continue
    const resolved = resolveDnaOwnerBook(theory.query, [], "standard")
    if (!resolved) continue
    candidates.push({ topic: { topicId: resolved.topicId, title: theory.title, surface: theory.title,
      canonicalConcept: theory.title, headingLabel: theory.title, parentContext: null,
      confidence: "HIGH", candidateTopicIds: [resolved.topicId], method: "named_title_normalized" }, relationEquivalent: false })
  }
  const relationParts = message.split(/\s+ile\s+/iu).map((part) => part.trim()).filter(Boolean)
  if (relationParts.length > 1) {
    for (const part of relationParts) {
      for (const topic of resolveDnaS13NamedTopicSurfaces(part, preferredTopicIds, maximum)) {
        candidates.push(Object.freeze({ topic, relationEquivalent: false }))
      }
    }
    const matches = [...message.matchAll(/\s+ile\s+/giu)]
    for (const match of matches) {
      const at = match.index ?? -1
      if (at < 0) continue
      const variant = `${message.slice(0, at)} ve ${message.slice(at + match[0].length)}`
      for (const topic of resolveDnaS13NamedTopicSurfaces(variant, preferredTopicIds, maximum)) {
        if (!explicitSurface(variant, [topic.surface, topic.title])) continue
        candidates.push(Object.freeze({ topic, relationEquivalent: true }))
      }
    }
  }
  const uniqueCandidates = [...new Map(candidates.map((candidate) => [candidate.topic.topicId, candidate])).values()]
  const nonShadowedCandidates = uniqueCandidates.filter((candidate) => {
    const title = normalizeDnaChatText(candidate.topic.title)
    return !uniqueCandidates.some((other) => {
      if (other.topic.topicId === candidate.topic.topicId) return false
      const otherTitle = normalizeDnaChatText(other.topic.title)
      return otherTitle.length > title.length && explicitSurface(other.topic.title, [candidate.topic.title])
    })
  })
  return Object.freeze(nonShadowedCandidates
    .slice(0, Math.max(1, Math.min(8, maximum)))
    .map(({ topic, relationEquivalent }) => Object.freeze({
      targetId: studentTargetIdForOwnerBookTopic(topic.topicId),
      topicId: topic.topicId,
      title: topic.title,
      surface: topic.surface,
      headingLabel: topic.headingLabel,
      confidence: topic.confidence,
      method: topic.method,
      relationEquivalent,
    }))
    .filter((topic) => explicitSurface(message, [topic.surface, topic.title, topic.headingLabel])
      || topic.relationEquivalent
      || (topic.method === "controlled_alias" && !isStudentCatalogTargetId(topic.targetId)))
    .map(({ headingLabel: _headingLabel, ...topic }) => Object.freeze(topic)))
}

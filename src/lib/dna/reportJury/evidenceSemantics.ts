import type { DomainKey } from "../reportEngine"
import type {
  CaseScopedEvidenceFact,
  CaseSemanticEvidenceMatrix,
  EvidenceDirection,
  EvidenceEpistemicStatus,
  EvidenceSemanticContext,
  EvidenceSemanticSegment,
  EvidenceSemanticValidity,
  ExternalEvidenceDirection,
  ExternalValidityStatus,
  SourceEvidenceRelation,
  SourceEvidenceRelationType,
} from "./contracts"

const NO_INFORMATION = /(?:hakkında\s+bilgi(?:si)?\s+(?:yok|bulunmuyor|verilmedi)|bilgi(?:si)?\s+(?:yok|bulunmuyor|verilmedi)|bilgi\s+vermedi|bilinmiyor|kaydedilmemiş)/iu
const NOT_ASSESSED = /(?:değerlendirilmedi|gözlenmedi|denenmedi|test edilmedi|uygulanmadı|gözlem(?:i)?\s+yapılmadı)/iu
const INVALID = /(?:geçersiz|yorumlanamaz|yorumlanamıyor|form geçersiz|çok eksik)/iu
const EXPLICIT_PRESERVED = /(?:yaş(?:a|ına) uygun|beklenen\s+(?:aralık|düzey)|korunmuş|bağımsız|tamamlıyor|tamamladı|tamamlanıyor|tamamlayabiliyor|bitiriyor|bitirdi|sürdürüyor|sürdürdü|başlıyor|başladı|başlattı|getiriyor|getirdi|giyiyor|inceliyor|yapabildi|sakinleşiyor|sakinleşti|geri\s+(?:dönüyor|döndü)|oyuna\s+(?:dönüyor|döndü)|sakin\s+yerde\s+bekliyor|zamanında\s+(?:bildiriyor|söylüyor)|seçtiği[^.]{0,40}dokunuyor|sorun\s+yaşamıyor|katılım(?:ı)?\s+(?:iyi|uygun)|hiç[^.]{0,80}(?:güçlük|sorun)[^.]{0,40}(?:olmad|yok)|(?:güçlük|sorun)\s+(?:bildirilmedi|görülmedi|yok)|güçlük\s+(?:olmadığını|görmediğini)\s+(?:bildir|söyl))/iu
const EXPLICIT_DIFFICULTY = /(?:(?:beklenen(?:den|in)|beklenen\s+düzeyin)\s+(?:çok|fazla|az|altında)|belirgin\s+(?:güçlük|zorlanma)|sorun\s+bildirildi|\bgüçlük|\bzorlan|\byüksek\b|\bdüşük\b|\brisk\b|yapam|bitirem|tamamlamıyor|yarım(?:\s+kal)?|bırak|kaç|uzaklaş|kulaklarını kapat|bağır|ağl|unut|\batla|karıştır|dağıl|çok\s+yorgun|geç\s+(?:fark|söyl)|sıradan\s+çık|etkinliği bırak|kapıya yönel|yere\s+(?:yat|uzan)|uzanıyor|masadan\s+sık\s+kalk|(?:uzun|sık|yoğun)\s+hatırlatma|(?:ancak|yalnız|sadece)[^.]{0,100}(?:hatırlatma|destek|yardım|ipucu))/iu
const OBSERVED_PERFORMANCE = /(?:yaşa uygun|katılım|performans|tamamla|sürdür|bitir|yapab|yaptı|giydi|kaldı|yönel|geri dön|döndü|karış|bırak|kaç|uzaklaş|kapattı|bağır|ağl|zorlan|yarım|başlat|adlandır|söyledi|tepki)/iu
const CONTEXT_SUPPORT_PRESENT = /(?:görsel|resim|kart|destek|ipucu|yazılı|sakin|sessiz|mola|tek tek|seçenek|önceden haber verildi)/iu
const CONTEXT_SUPPORT_ABSENT_OR_LOAD = /(?:destek(?:\s+)?kaldır|resim yok|desteksiz|önceden haber verilmeden|yüksek ses|gürült|uyaran|sandalye|zil|ani ses)/iu

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values))
}

function normalized(value: string): string {
  return value.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü]+/gu, " ").trim()
}

function stableId(value: string): string {
  let hash = 2166136261
  for (const char of value) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

export function inferEvidenceEpistemicStatus(text: string, validity: EvidenceSemanticValidity = "USABLE"): EvidenceEpistemicStatus {
  if (validity === "INVALID" || validity === "INSUFFICIENT_INFORMATION" || INVALID.test(text)) return "INVALID_OR_UNINTERPRETABLE"
  if (NO_INFORMATION.test(text)) return "ABSENT_INFORMATION"
  if (NOT_ASSESSED.test(text)) {
    const assessedSegments = text.split(/[.;]/u).filter((segment) => !NOT_ASSESSED.test(segment)).join(" ")
    const observedContent = EXPLICIT_PRESERVED.test(assessedSegments) || EXPLICIT_DIFFICULTY.test(assessedSegments)
    if (!observedContent) return "NOT_ASSESSED"
  }
  if (!normalized(text)) return "UNKNOWN"
  return "OBSERVED_OR_REPORTED"
}

export function inferEvidenceDirection(text: string, epistemicStatus: EvidenceEpistemicStatus = inferEvidenceEpistemicStatus(text)): EvidenceDirection {
  if (["ABSENT_INFORMATION", "UNKNOWN", "NOT_ASSESSED", "INVALID_OR_UNINTERPRETABLE"].includes(epistemicStatus)) return "UNKNOWN"
  if (epistemicStatus === "NOT_APPLICABLE") return "NOT_APPLICABLE"
  const negatedDifficulty = /(?:güçlük|sorun)\s+(?:bildirilmedi|görülmedi|yok)|(?:güçlük|sorun)\s+(?:olmadığını|görmediğini)\s+(?:bildir|söyl)|hiç[^.]{0,80}(?:güçlük|sorun)[^.]{0,40}(?:olmad|yok)|(?:asla|hiç)\s+[^.]{0,60}(?:ağlamaz|bağırmaz|kaçmaz|bırakmaz|zorlanmaz)|(?:ağlamıyor|bağırmıyor|kaçmıyor|bırakmıyor|zorlanmıyor)(?!\s+değil)/iu.test(text)
  const difficulty = EXPLICIT_DIFFICULTY.test(text) && !negatedDifficulty
  const belowExpected = /(?:beklenen(?:den|in)|beklenen\s+düzeyin)\s+(?:çok|fazla|az|altında)/iu.test(text)
  const preserved = EXPLICIT_PRESERVED.test(text) && !belowExpected
  if (difficulty && preserved) return "MIXED"
  if (difficulty) return "DIFFICULTY"
  if (preserved) return "PRESERVED"
  return "NEUTRAL"
}

export function inferSemanticContext(text: string): EvidenceSemanticContext {
  const settings: string[] = []
  const triggers: string[] = []
  const tasks: string[] = []
  const settingPatterns: ReadonlyArray<readonly [string, RegExp]> = [
    ["home", /\bevde\b|\bevin\b/iu],
    ["school", /\bokul(?:da)?\b|\bsınıf(?:ta)?\b/iu],
    ["clinic", /\bklinik(?:te)?\b|\bseans(?:ta)?\b|terapist gözlem/iu],
    ["corridor", /\bkoridor(?:da)?\b/iu],
    ["quiet_room", /sessiz\s+oda|sakin\s+oda/iu],
    ["cafeteria", /kantin|yemekhane|öğle yemeği/iu],
    ["community", /AVM|alışveriş merkezi|market/iu],
    ["transport", /servis|otobüs|yolculuk/iu],
  ]
  const triggerPatterns: ReadonlyArray<readonly [string, RegExp]> = [
    ["sudden_bell", /ani\s+zil|zil\s+sesi/iu],
    ["sound_load", /ses|gürült|işitsel|hoparlör|blender|süpürge/iu],
    ["transition", /geçiş|oyun\s+bit|oyuncak\s+toplan/iu],
    ["task_complexity", /çok\s+basamak|üç\s+basamak|dört\s+basamak|sıra/iu],
    ["fatigue", /yorgun|uyku/iu],
  ]
  const taskPatterns: ReadonlyArray<readonly [string, RegExp]> = [
    ["meal", /yemek|atıştırmalık|tepsi/iu],
    ["multi_step_task", /basamak|adım|sıralama/iu],
    ["play", /oyun|etkinlik/iu],
    ["dressing", /giyin|ayakkabı|gömlek|düğme/iu],
    ["school_preparation", /okul\s+hazırl|çanta\s+hazırla/iu],
  ]
  for (const [label, pattern] of settingPatterns) if (pattern.test(text)) settings.push(label)
  for (const [label, pattern] of triggerPatterns) if (pattern.test(text)) triggers.push(label)
  for (const [label, pattern] of taskPatterns) if (pattern.test(text)) tasks.push(label)
  return Object.freeze({ settings: Object.freeze(unique(settings)), triggers: Object.freeze(unique(triggers)), tasks: Object.freeze(unique(tasks)) })
}

function evidenceSegments(text: string): string[] {
  return text
    .split(/;\s*|(?<=[.!?])\s+|\s+(?:ancak|fakat|buna karşın|ama)\s+/iu)
    .map((segment) => segment.replace(/^[,\s]+|[,\s]+$/gu, "").trim())
    .filter(Boolean)
}

export function buildEvidenceSemanticSegments(
  factId: string,
  text: string,
  validity: EvidenceSemanticValidity = "USABLE",
): readonly EvidenceSemanticSegment[] {
  return Object.freeze(evidenceSegments(text).map((segment, index) => {
    const epistemicStatus = inferEvidenceEpistemicStatus(segment, validity)
    const semanticContext = inferSemanticContext(segment)
    const contextConditioned = semanticContext.settings.length > 0
      || semanticContext.triggers.length > 0
      || semanticContext.tasks.length > 0
      || CONTEXT_SUPPORT_PRESENT.test(segment)
      || CONTEXT_SUPPORT_ABSENT_OR_LOAD.test(segment)
    return Object.freeze({
      id: `${factId}.segment-${index + 1}-${stableId(segment)}`,
      text: segment,
      semantic_direction: inferEvidenceDirection(segment, epistemicStatus),
      epistemic_status: epistemicStatus,
      semantic_context: semanticContext,
      observed_performance: epistemicStatus === "OBSERVED_OR_REPORTED" && OBSERVED_PERFORMANCE.test(segment),
      context_conditioned: contextConditioned,
    })
  }))
}

function segmentContextSignature(segment: EvidenceSemanticSegment): string[] {
  return unique([
    ...segment.semantic_context.settings.map((item) => `setting:${item}`),
    ...segment.semantic_context.triggers.map((item) => `trigger:${item}`),
    ...segment.semantic_context.tasks.map((item) => `task:${item}`),
    ...(CONTEXT_SUPPORT_PRESENT.test(segment.text) ? ["support:present"] : []),
    ...(CONTEXT_SUPPORT_ABSENT_OR_LOAD.test(segment.text) ? ["support:absent_or_load"] : []),
  ])
}

export function hasObservedContextEvidence(text: string): boolean {
  return buildEvidenceSemanticSegments("context-evidence", text).some((segment) => segment.observed_performance && segment.context_conditioned)
}

export function hasObservedContextComparison(text: string): boolean {
  const observed = buildEvidenceSemanticSegments("context-comparison", text)
    .filter((segment) => segment.observed_performance && segment.context_conditioned)
  if (observed.length < 2) return false
  for (let leftIndex = 0; leftIndex < observed.length; leftIndex += 1) {
    const left = observed[leftIndex]
    const leftSignature = new Set(segmentContextSignature(left))
    for (let rightIndex = leftIndex + 1; rightIndex < observed.length; rightIndex += 1) {
      const right = observed[rightIndex]
      const rightSignature = new Set(segmentContextSignature(right))
      const differentContext = [...leftSignature].some((item) => !rightSignature.has(item))
        || [...rightSignature].some((item) => !leftSignature.has(item))
      const differentDirection = left.semantic_direction !== right.semantic_direction
        && ![left.semantic_direction, right.semantic_direction].includes("UNKNOWN")
      if (differentContext || differentDirection) return true
    }
  }
  return false
}

export function factHasObservedContextComparison(fact: CaseScopedEvidenceFact): boolean {
  const segments = fact.semantic_segments ?? buildEvidenceSemanticSegments(fact.id, fact.source_excerpt, fact.semantic_validity)
  const observed = segments.filter((segment) => segment.observed_performance && segment.context_conditioned)
  if (observed.length < 2) return false
  return hasObservedContextComparison(observed.map((segment) => segment.text).join("; "))
}

export function canonicalDirectionFromExternal(direction: ExternalEvidenceDirection): EvidenceDirection {
  if (direction === "supports_difficulty") return "DIFFICULTY"
  if (direction === "supports_preserved_function") return "PRESERVED"
  if (direction === "mixed") return "MIXED"
  if (direction === "neutral") return "NEUTRAL"
  return "UNKNOWN"
}

export function canonicalValidityFromExternal(validity: ExternalValidityStatus): EvidenceSemanticValidity {
  if (validity === "valid") return "USABLE"
  if (validity === "partially_interpretable") return "PARTIALLY_INTERPRETABLE"
  if (validity === "invalid") return "INVALID"
  return "INSUFFICIENT_INFORMATION"
}

export function canonicalEpistemicFromExternal(validity: ExternalValidityStatus, text: string): EvidenceEpistemicStatus {
  return inferEvidenceEpistemicStatus(text, canonicalValidityFromExternal(validity))
}

export function factEligibleForPreservedCapacity(fact: CaseScopedEvidenceFact): boolean {
  if (fact.epistemic_status !== "OBSERVED_OR_REPORTED") return false
  if (fact.semantic_validity === "INVALID" || fact.semantic_validity === "INSUFFICIENT_INFORMATION") return false
  if (fact.source_type === "EXTERNAL_TEST" && fact.semantic_validity !== "USABLE") return false
  if (fact.semantic_direction === "PRESERVED") return true
  return fact.semantic_direction === "MIXED" && Boolean(fact.preserved_subcomponent)
}

export function factSupportsDifficultyDirection(fact: CaseScopedEvidenceFact): boolean {
  return fact.epistemic_status === "OBSERVED_OR_REPORTED"
    && !["INVALID", "INSUFFICIENT_INFORMATION"].includes(fact.semantic_validity)
    && ["DIFFICULTY", "MIXED"].includes(fact.semantic_direction)
}

export type EvidenceClaimEligibilityRole = "NARRATIVE" | "DIFFICULTY" | "PRESERVED" | "RELATION"

export function sourcePresence(
  facts: readonly CaseScopedEvidenceFact[],
  sourceType: CaseScopedEvidenceFact["source_type"],
): boolean {
  return facts.some((fact) => fact.source_type === sourceType)
}

export function sourceHasEligibleEvidenceForClaim(
  facts: readonly CaseScopedEvidenceFact[],
  sourceType: CaseScopedEvidenceFact["source_type"],
  role: EvidenceClaimEligibilityRole,
): boolean {
  return facts.some((fact) => {
    if (fact.source_type !== sourceType) return false
    const observed = fact.epistemic_status === "OBSERVED_OR_REPORTED"
    const usable = !["INVALID", "INSUFFICIENT_INFORMATION"].includes(fact.semantic_validity)
    if (!observed || !usable) return false
    if (role === "DIFFICULTY") return factSupportsDifficultyDirection(fact)
    if (role === "PRESERVED") return factEligibleForPreservedCapacity(fact)
    if (role === "RELATION") return !["UNKNOWN", "NEUTRAL", "NOT_APPLICABLE"].includes(fact.semantic_direction)
    return fact.semantic_direction !== "UNKNOWN"
  })
}

function relationType(left: CaseScopedEvidenceFact, right: CaseScopedEvidenceFact): SourceEvidenceRelationType {
  if (!left.domains.some((domain) => right.domains.includes(domain))) return "INCOMPARABLE"
  if (left.epistemic_status !== "OBSERVED_OR_REPORTED" || right.epistemic_status !== "OBSERVED_OR_REPORTED") return "INSUFFICIENT_RELATION_EVIDENCE"
  if (["UNKNOWN", "NEUTRAL", "NOT_APPLICABLE"].includes(left.semantic_direction) || ["UNKNOWN", "NEUTRAL", "NOT_APPLICABLE"].includes(right.semantic_direction)) return "INSUFFICIENT_RELATION_EVIDENCE"
  if (left.semantic_direction === "DIFFICULTY" && right.semantic_direction === "DIFFICULTY") return "CONVERGENT_DIFFICULTY"
  if (left.semantic_direction === "PRESERVED" && right.semantic_direction === "PRESERVED") return "CONVERGENT_PRESERVED"
  if (left.semantic_direction === "MIXED" || right.semantic_direction === "MIXED") return "PARTIALLY_CONVERGENT"
  const opposite = new Set([left.semantic_direction, right.semantic_direction])
  if (opposite.has("DIFFICULTY") && opposite.has("PRESERVED")) {
    const leftSettings = new Set(left.semantic_context.settings)
    const rightSettings = new Set(right.semantic_context.settings)
    const shared = [...leftSettings].filter((item) => rightSettings.has(item))
    if (leftSettings.size && rightSettings.size && shared.length === 0) return "CONTEXTUAL_DISCREPANCY"
    return "DISCREPANT"
  }
  return "INSUFFICIENT_RELATION_EVIDENCE"
}

export function buildCaseSemanticEvidenceMatrix(caseId: string, facts: readonly CaseScopedEvidenceFact[]): CaseSemanticEvidenceMatrix {
  const relations: SourceEvidenceRelation[] = []
  for (let leftIndex = 0; leftIndex < facts.length; leftIndex += 1) {
    const left = facts[leftIndex]
    for (let rightIndex = leftIndex + 1; rightIndex < facts.length; rightIndex += 1) {
      const right = facts[rightIndex]
      if (left.source_type === right.source_type) continue
      const sharedDomains = left.domains.filter((domain) => right.domains.includes(domain))
      for (const domain of sharedDomains) {
        const relation = relationType(left, right)
        const sharedContexts = left.semantic_context.settings.filter((item) => right.semantic_context.settings.includes(item))
        const differingContexts = unique([...left.semantic_context.settings, ...right.semantic_context.settings].filter((item) => !sharedContexts.includes(item)))
        relations.push(Object.freeze({
          id: `${caseId}.relation.${stableId(`${left.id}|${right.id}|${domain}`)}`,
          case_id: caseId,
          domain,
          left_fact_id: left.id,
          right_fact_id: right.id,
          left_source_type: left.source_type,
          right_source_type: right.source_type,
          left_direction: left.semantic_direction,
          right_direction: right.semantic_direction,
          relation,
          shared_contexts: Object.freeze(sharedContexts),
          differing_contexts: Object.freeze(differingContexts),
          reason: relation === "CONTEXTUAL_DISCREPANCY"
            ? "Opposing evidence directions were reported or observed in explicitly different settings."
            : relation === "DISCREPANT"
            ? "Opposing evidence directions cannot be described as convergent."
            : relation === "CONVERGENT_DIFFICULTY" || relation === "CONVERGENT_PRESERVED"
            ? "Evidence sources have compatible directions for the same domain."
            : relation === "PARTIALLY_CONVERGENT"
            ? "At least one source contains mixed evidence."
            : "The available evidence is not sufficient for a directional relation claim.",
        }))
      }
    }
  }
  return Object.freeze({
    case_id: caseId,
    facts: Object.freeze([...facts]),
    relations: Object.freeze(relations),
    difficulty_fact_ids: Object.freeze(facts.filter(factSupportsDifficultyDirection).map((fact) => fact.id)),
    preserved_fact_ids: Object.freeze(facts.filter(factEligibleForPreservedCapacity).map((fact) => fact.id)),
    absence_unknown_fact_ids: Object.freeze(facts.filter((fact) => fact.epistemic_status !== "OBSERVED_OR_REPORTED" || fact.semantic_direction === "UNKNOWN").map((fact) => fact.id)),
  })
}

export function relationsForFacts(relations: readonly SourceEvidenceRelation[], factIds: readonly string[]): SourceEvidenceRelation[] {
  const allowed = new Set(factIds)
  return relations.filter((relation) => allowed.has(relation.left_fact_id) && allowed.has(relation.right_fact_id))
}

export function relationIsDiscrepant(relation: SourceEvidenceRelation): boolean {
  return relation.relation === "DISCREPANT" || relation.relation === "CONTEXTUAL_DISCREPANCY"
}

export function relationIsConvergent(relation: SourceEvidenceRelation): boolean {
  return relation.relation === "CONVERGENT_DIFFICULTY" || relation.relation === "CONVERGENT_PRESERVED"
}

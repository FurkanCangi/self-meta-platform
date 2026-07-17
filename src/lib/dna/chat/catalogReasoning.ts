import {
  DNA_CHAT_CATALOG_TOPICS,
  DNA_CHAT_CATALOG_SOURCES,
  classifyCatalogQueryKind,
  findCatalogTopic,
  getCatalogTopicById,
  getClaimsForTopic,
  getRelationsForTopic,
  getSourcesForClaim,
  type DnaChatCatalogClaim,
  type DnaChatCatalogEvidenceLevel,
  type DnaChatCatalogRelation,
  type DnaChatCatalogSource,
  type DnaChatCatalogTopic,
  type DnaChatQueryKind as CatalogQueryKind,
} from "./catalog"
import { normalizeDnaChatText, stableUnique } from "./text"
import type {
  DnaChatClassification,
  DnaChatEvidenceSummary,
  DnaChatQueryKind,
  DnaChatRoute,
  DnaChatSourceRef,
} from "./types"

const EVIDENCE_LABELS: Record<DnaChatCatalogEvidenceLevel, string> = {
  strong: "Güçlü",
  moderate: "Orta",
  limited: "Sınırlı",
  theoretical: "Kuramsal",
  boundary: "Ürün sınırı",
}

const AGE_SCOPE_LABELS: Record<DnaChatCatalogTopic["ageScope"], string> = {
  all_ages: "Tüm yaşlar için genel çerçeve",
  developmental: "Gelişimsel çerçeve",
  early_childhood: "Erken çocukluk ağırlıklı",
  childhood: "Çocukluk dönemi ağırlıklı",
  adolescence: "Ergenlik dönemi ağırlıklı",
  adult_weighted: "Yetişkin kanıtı ağırlıklı",
  mixed: "Karma yaş örneklemleri",
}

export type DnaCatalogReasoningDraft = {
  queryKind: DnaChatQueryKind
  route: Exclude<DnaChatRoute, "unknown" | "case">
  classification: DnaChatClassification
  topicId: string
  topicTitle: string
  summary: string
  details: string[]
  sources: DnaChatSourceRef[]
  limitations: string[]
  suggestedQuestions: string[]
  evidenceSummary: DnaChatEvidenceSummary
}

export function classifyDnaChatQueryKind(question: string): DnaChatQueryKind {
  return classifyCatalogQueryKind(question) as CatalogQueryKind
}

export function classifyEmbeddedCatalogQueryKind(question: string): DnaChatQueryKind {
  const normalized = normalizeDnaChatText(question)
  if (/\b(?:fark|ayni sey|karsilastir|arasindaki)\b/.test(normalized)) return "comparison"
  if (/\b(?:iliski|iliskili|iliskisini|iliskisiyle|baglanti|baglantisi|etkilesim)\b/.test(normalized)) {
    return "relation"
  }
  if (/\b(?:neyi olcer|nasil olculur|olcum|sensor|biyobelirtec|degeri)\b/.test(normalized)) {
    return "measurement"
  }
  if (/\b(?:kanit|kaynak|bilimsel|guvenilir|literatur)\b/.test(normalized)) return "evidence"
  if (/\b(?:gelisim[a-z]*|gelisir[a-z]*|cocukluk[a-z]*|yasa gore|ergenlik[a-z]*)\b/.test(normalized)) {
    return "development"
  }
  if (/\b(?:kesin|her zaman|tek basina|kotu mu|iyi midir|dogru mu)\b/.test(normalized)) {
    return "misconception"
  }
  if (/\b(?:dna ile|dna skoru|dna alani|dna olcer)\b/.test(normalized)) return "dna_relation"
  return "definition"
}

function topicPatterns(topic: DnaChatCatalogTopic): string[] {
  return [topic.title, ...topic.aliases, ...topic.keywords]
    .map(normalizeDnaChatText)
    .filter(Boolean)
}

function topicIdentityPatterns(topic: DnaChatCatalogTopic): string[] {
  return [topic.title, ...topic.aliases]
    .map(normalizeDnaChatText)
    .filter(Boolean)
}

function containsTopicPattern(normalizedQuestion: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(
    `(?:^|\\s)${escaped}(?:la|le|yla|yle|da|de|dan|den|a|e|i|u|un|in|nin|nun)?(?:\\s|$)`,
  ).test(normalizedQuestion)
}

function questionMentionsTopic(question: string, topic: DnaChatCatalogTopic): boolean {
  const normalized = normalizeDnaChatText(question)
  // "Dikkatle kullanmak/yorumlamak" bir kullanım biçimidir; dikkat konusu değildir.
  // Bu ayrım özellikle polivagal kavramların ihtiyatlı diline ilişkin kanıt
  // sorularının yanlışlıkla çapraz-konu sorusu sayılmasını önler.
  if (
    topic.id === "cns.attention" &&
    /\bdikkatle\s+(?:kullan|yorumla|ele\s+al)[a-z]*/.test(normalized)
  ) {
    return false
  }
  return topicIdentityPatterns(topic).some((pattern) => containsTopicPattern(normalized, pattern))
}

function topicsShareFamily(leftId: string, rightId: string): boolean {
  return leftId === rightId ||
    leftId.startsWith(`${rightId}_`) ||
    rightId.startsWith(`${leftId}_`)
}

function distinctMentionedTopics(
  question: string,
  selectedTopic: DnaChatCatalogTopic,
): DnaChatCatalogTopic[] {
  return DNA_CHAT_CATALOG_TOPICS.filter((candidate) =>
    !topicsShareFamily(candidate.id, selectedTopic.id) &&
    questionMentionsTopic(question, candidate)
  )
}

function otherTopicForRelation(
  relation: DnaChatCatalogRelation,
  topicId: string,
): DnaChatCatalogTopic | null {
  const otherId = relation.fromTopicId === topicId ? relation.toTopicId : relation.fromTopicId
  return getCatalogTopicById(otherId)
}

function rankedRelations(
  question: string,
  topic: DnaChatCatalogTopic,
  queryKind: DnaChatQueryKind,
): DnaChatCatalogRelation[] {
  return getRelationsForTopic(topic.id)
    .filter((relation) => relation.maxHops === 1)
    .map((relation) => {
      const other = otherTopicForRelation(relation, topic.id)
      const mentioned = other ? questionMentionsTopic(question, other) : false
      const preferredPredicate =
        queryKind === "comparison"
          ? relation.predicate === "distinguished_from"
          : relation.predicate !== "distinguished_from"
      return { relation, mentioned, preferredPredicate, otherTitle: other?.title ?? "" }
    })
    .sort(
      (left, right) =>
        Number(right.mentioned) - Number(left.mentioned) ||
        Number(right.preferredPredicate) - Number(left.preferredPredicate) ||
        left.otherTitle.localeCompare(right.otherTitle, "tr"),
    )
    .filter((entry) => entry.mentioned)
    .map((entry) => entry.relation)
}

function supportsInternalComparison(
  question: string,
  topic: DnaChatCatalogTopic,
  claims: readonly DnaChatCatalogClaim[],
): boolean {
  const normalizedQuestion = normalizeDnaChatText(question)
  const mentionedTopicTerms = new Set(
    topicPatterns(topic).filter((pattern) => containsTopicPattern(normalizedQuestion, pattern)),
  )
  if (mentionedTopicTerms.size < 2) return false
  const hasExplicitDistinction = claims.some((claim) =>
    /\b(?:ayni degildir|ayni sey degildir|farkli|ayri|birbirinden ayril\w*|iken|ise)\b/.test(
      normalizeDnaChatText(`${claim.text} ${claim.detail}`),
    ),
  )
  if (hasExplicitDistinction) return true

  // A comparison can still receive a bounded topic-level answer when both
  // named labels are explicitly present in the source-backed claim boundary.
  // This does not invent a relation or mechanism; it exposes the catalog's
  // existing theory-status limitation for the two labels.
  const normalizedBoundary = normalizeDnaChatText([
    topic.claimBoundary,
    ...claims.flatMap((claim) => [claim.text, claim.detail]),
  ].join(" "))
  const boundaryMentions = Array.from(mentionedTopicTerms).filter((pattern) =>
    containsTopicPattern(normalizedBoundary, pattern),
  )
  return boundaryMentions.length >= 2
}

const RELATION_STOP_TOKENS = new Set([
  "arasında", "arasinda", "ilişki", "iliski", "ilişkili", "iliskili",
  "nasıl", "nasil", "neden", "nedir", "midir", "vardır", "vardir",
  "yanıt", "yanit", "ile", "ve", "bir", "bu", "fark", "ayni", "sey",
  "anlamina", "gelir", "etkiler", "etkileyebilir", "katilir", "katki",
  "sistem", "sistemi", "sinir", "calisir", "calismak", "islev", "islevi",
].map(normalizeDnaChatText))

function isRelationStopToken(token: string): boolean {
  return RELATION_STOP_TOKENS.has(token) ||
    /^(?:ilisk|baglant|karsilastir|goster|olcer|degerlendir)/.test(token)
}

function explicitTargetTokens(
  question: string,
  topic: DnaChatCatalogTopic,
): string[] {
  const topicTokens = new Set(topicIdentityPatterns(topic).flatMap((pattern) => pattern.split(" ")))
  return normalizeDnaChatText(question)
    .split(" ")
    .filter((token) => {
      if (token.length < 4 || isRelationStopToken(token)) return false
      return !Array.from(topicTokens).some((identityToken) =>
        identityToken === token ||
        (Math.min(identityToken.length, token.length) >= 5 &&
          (identityToken.startsWith(token) || token.startsWith(identityToken))),
      )
    })
}

function corpusContainsTarget(corpus: string, targetTokens: readonly string[]): boolean {
  const corpusTokens = normalizeDnaChatText(corpus).split(" ")
  return targetTokens.some((target) =>
    corpusTokens.some((candidate) =>
      candidate === target ||
      (Math.min(candidate.length, target.length) >= 5 &&
        (candidate.startsWith(target) || target.startsWith(candidate))),
    ),
  )
}

function hasExplicitSourceBackedTarget(
  question: string,
  topic: DnaChatCatalogTopic,
  claims: readonly DnaChatCatalogClaim[],
): boolean {
  const targetTokens = explicitTargetTokens(question, topic)
  if (!targetTokens.length) return false
  return corpusContainsTarget(
    [
      topic.summary,
      ...topic.details,
      topic.claimBoundary,
      ...claims.flatMap((claim) => [claim.text, claim.detail]),
    ].join(" "),
    targetTokens,
  )
}

function hasExplicitAssociationClaim(
  question: string,
  topic: DnaChatCatalogTopic,
  claims: readonly DnaChatCatalogClaim[],
): boolean {
  const targetTokens = explicitTargetTokens(question, topic)
  if (!targetTokens.length) return false
  return claims.some((claim) => {
    if (claim.claimType !== "association") return false
    return corpusContainsTarget(`${claim.text} ${claim.detail}`, targetTokens)
  })
}

function relationMatchesExplicitTarget(
  relation: DnaChatCatalogRelation,
  selectedTopic: DnaChatCatalogTopic,
  explicitTargets: readonly DnaChatCatalogTopic[],
): boolean {
  const otherTopic = otherTopicForRelation(relation, selectedTopic.id)
  if (!otherTopic) return false
  return explicitTargets.some((target) => topicsShareFamily(otherTopic.id, target.id))
}

function hasAssociationClaimForTopics(
  explicitTargets: readonly DnaChatCatalogTopic[],
  claims: readonly DnaChatCatalogClaim[],
): boolean {
  if (!explicitTargets.length) return false
  return claims.some((claim) => {
    if (claim.claimType !== "association") return false
    const normalizedClaim = normalizeDnaChatText(`${claim.text} ${claim.detail}`)
    return explicitTargets.some((target) =>
      topicIdentityPatterns(target)
        .filter((pattern) => pattern.length >= 4)
        .some((pattern) => containsTopicPattern(normalizedClaim, pattern))
    )
  })
}

function claimsForKind(
  claims: readonly DnaChatCatalogClaim[],
  queryKind: DnaChatQueryKind,
  question: string,
): DnaChatCatalogClaim[] {
  const selected = claims.filter((claim) => {
    if (queryKind === "definition") return claim.claimType === "definition"
    if (queryKind === "development") return claim.claimType === "development"
    if (queryKind === "measurement") {
      if (claim.claimType === "measurement_boundary") return true
      if (claim.claimType !== "definition") return false
      const normalizedClaimText = normalizeDnaChatText(claim.text)
      return /\b(?:olcumudur|olcer\w*|hesaplanir|kaydedilir)\b/.test(normalizedClaimText) ||
        (claim.topicId.includes("measurement") && /\bincelenir\b/.test(normalizedClaimText))
    }
    if (queryKind === "misconception") {
      return claim.claimType === "misconception_correction" ||
        claim.claimType === "measurement_boundary" ||
        claim.claimType === "product_boundary"
    }
    if (queryKind === "dna_relation") return claim.dnaRelation !== "none"
    if (queryKind === "evidence") return claim.sourceIds.length > 0
    return true
  })
  const ranked = [...selected].sort((left, right) => {
    const questionTokens = normalizeDnaChatText(question)
      .split(" ")
      .filter((token) => token.length >= 4 && !isRelationStopToken(token))
    const score = (claim: DnaChatCatalogClaim) => {
      const corpus = normalizeDnaChatText(`${claim.text} ${claim.detail}`)
      return questionTokens.reduce(
        (total, token) => total + (containsTopicPattern(corpus, token) ? 1 : 0),
        0,
      )
    }
    return score(right) - score(left) || left.id.localeCompare(right.id)
  })
  if (["development", "measurement", "misconception", "dna_relation"].includes(queryKind)) {
    return ranked.slice(0, 3)
  }
  return (ranked.length ? ranked : [...claims]).slice(0, 3)
}

function sourceRef(source: DnaChatCatalogSource, excerpt: string): DnaChatSourceRef {
  const id = source.existingLiteratureId
    ? `lit:${source.existingLiteratureId}`
    : `catalog:${source.id}`
  return {
    id,
    type: source.existingLiteratureId ? "literature" : "catalog",
    title: source.title,
    labelTr: `${source.authors} (${source.year})`,
    excerptTr: excerpt,
    citation: `${source.authors} (${source.year}). ${source.title}. ${source.publication}.`,
    year: source.year,
    doi: source.doi,
    url: source.url,
    claimBoundary: source.claimBoundary,
  }
}

function collectSources(
  topic: DnaChatCatalogTopic,
  claims: readonly DnaChatCatalogClaim[],
  relations: readonly DnaChatCatalogRelation[],
): DnaChatSourceRef[] {
  const sourceExcerptById = new Map<string, string>()
  for (const claim of claims) {
    for (const source of getSourcesForClaim(claim.id)) {
      if (!sourceExcerptById.has(source.id)) sourceExcerptById.set(source.id, claim.text)
    }
  }
  for (const relation of relations) {
    for (const sourceId of relation.sourceIds) {
      if (!sourceExcerptById.has(sourceId)) sourceExcerptById.set(sourceId, relation.summary)
    }
  }
  for (const sourceId of topic.sourceIds) {
    if (!sourceExcerptById.has(sourceId)) sourceExcerptById.set(sourceId, topic.summary)
  }

  const seen = new Set<string>()
  const refs: DnaChatSourceRef[] = []
  for (const [sourceId, excerpt] of sourceExcerptById) {
    const source = DNA_CHAT_CATALOG_SOURCES.find((candidate) => candidate.id === sourceId)
    if (!source) continue
    const ref = sourceRef(source, excerpt)
    const dedupeKey = source.doi?.toLowerCase() || source.pmid || ref.id
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    refs.push(ref)
  }
  return refs.slice(0, 4)
}

function evidenceSummary(topic: DnaChatCatalogTopic): DnaChatEvidenceSummary {
  return {
    level: EVIDENCE_LABELS[topic.evidenceLevel],
    ageScope: AGE_SCOPE_LABELS[topic.ageScope],
    boundary: topic.claimBoundary,
  }
}

function ageScopeGuard(
  entry: Pick<DnaChatCatalogTopic, "ageScope">,
  ageMonths: number | null | undefined,
): { blocked: boolean; limitation: string | null } {
  if (ageMonths === null || ageMonths === undefined || !Number.isFinite(ageMonths)) {
    return { blocked: false, limitation: null }
  }
  if (entry.ageScope === "adult_weighted" && ageMonths < 216) {
    return {
      blocked: false,
      limitation: `Bu başlıktaki kanıt yetişkin örneklemleri ağırlıklıdır; ${Math.round(ageMonths)} aylık vakaya doğrudan genellenemez.`,
    }
  }
  const incompatible =
    (entry.ageScope === "early_childhood" && ageMonths >= 144) ||
    (entry.ageScope === "childhood" && ageMonths >= 216) ||
    (entry.ageScope === "adolescence" && (ageMonths < 120 || ageMonths >= 216))
  return incompatible
    ? {
        blocked: true,
        limitation: `Katalogdaki ${AGE_SCOPE_LABELS[entry.ageScope].toLocaleLowerCase("tr-TR")} kanıt, ${Math.round(ageMonths)} aylık vaka için uyumlu değildir.`,
      }
    : { blocked: false, limitation: null }
}

function relationDetails(
  relations: readonly DnaChatCatalogRelation[],
  topic: DnaChatCatalogTopic,
): string[] {
  return relations.slice(0, 2).map((relation) => {
    const other = otherTopicForRelation(relation, topic.id)
    return other ? `${other.title}: ${relation.summary}` : relation.summary
  })
}

export function resolveDnaCatalogReasoning(input: {
  question: string
  previousTopic?: string | null
  queryKind?: DnaChatQueryKind
  ageMonths?: number | null
}): DnaCatalogReasoningDraft | null {
  const queryKind = input.queryKind ?? classifyDnaChatQueryKind(input.question)
  if (queryKind === "case_finding" || queryKind === "case_theory") return null

  const topic = findCatalogTopic(input.question, input.previousTopic)
  if (!topic) return null
  const normalizedQuestion = normalizeDnaChatText(input.question)
  const explicitRelationTargets = ["comparison", "relation", "evidence", "dna_relation"].includes(queryKind)
    ? distinctMentionedTopics(input.question, topic)
    : []
  const crossTopicEvidence = queryKind === "evidence" && explicitRelationTargets.length > 0
  const ageGuard = ageScopeGuard(topic, input.ageMonths)
  if (ageGuard.blocked) {
    return {
      queryKind,
      route: queryKind === "dna_relation" ? "dna" : "theory",
      classification: "not_available",
      topicId: topic.id,
      topicTitle: topic.title,
      summary: "Bu konu için doğrulanmış katalogdaki yaş kapsamı seçili raporla uyumlu değil.",
      details: [],
      sources: [],
      limitations: ageGuard.limitation ? [ageGuard.limitation] : [],
      suggestedQuestions: [`${topic.title} için yaş kapsamı nedir?`],
      evidenceSummary: evidenceSummary(topic),
    }
  }

  const allClaims = getClaimsForTopic(topic.id).filter(
    (claim) => claim.sourceVerified && claim.safetyStatus === "safe",
  )
  const selectedClaims = claimsForKind(allClaims, queryKind, input.question)
  if (
    ["development", "measurement", "misconception", "dna_relation"].includes(queryKind) &&
    selectedClaims.length === 0
  ) {
    return {
      queryKind,
      route: queryKind === "dna_relation" ? "dna" : "theory",
      classification: "not_available",
      topicId: topic.id,
      topicTitle: topic.title,
      summary: "Bu soru türü için doğrulanmış katalogda doğrudan bir iddia bulunmuyor.",
      details: [],
      sources: [],
      limitations: ["Sistem konuya ait genel bilgiyi sorulan özgül iddianın kanıtı gibi sunmadı."],
      suggestedQuestions: [`${topic.title} nedir?`, `${topic.title} için kanıt düzeyi nedir?`],
      evidenceSummary: evidenceSummary(topic),
    }
  }
  const claimAgeGuards = selectedClaims.map((claim) => ({
    claim,
    guard: ageScopeGuard(claim, input.ageMonths),
  }))
  const claims = claimAgeGuards
    .filter((entry) => !entry.guard.blocked)
    .map((entry) => entry.claim)
  const claimAgeLimitations = stableUnique(
    claimAgeGuards.flatMap((entry) => entry.guard.limitation ? [entry.guard.limitation] : []),
    3,
  )
  if (selectedClaims.length > 0 && claims.length === 0) {
    return {
      queryKind,
      route: queryKind === "dna_relation" ? "dna" : "theory",
      classification: "not_available",
      topicId: topic.id,
      topicTitle: topic.title,
      summary: "Bu soru için doğrulanmış katalogdaki yaş kapsamı seçili raporla uyumlu değil.",
      details: [],
      sources: [],
      limitations: claimAgeLimitations,
      suggestedQuestions: [`${topic.title} için yaş kapsamı nedir?`],
      evidenceSummary: evidenceSummary(topic),
    }
  }
  const selectedRelations =
    queryKind === "comparison" || queryKind === "relation" || queryKind === "dna_relation"
      ? rankedRelations(input.question, topic, queryKind)
          .filter((relation) =>
            explicitRelationTargets.length === 0 ||
            relationMatchesExplicitTarget(relation, topic, explicitRelationTargets)
          )
          .slice(0, 2)
      : crossTopicEvidence
        ? rankedRelations(input.question, topic, "relation")
            .filter((relation) => relationMatchesExplicitTarget(
              relation,
              topic,
              explicitRelationTargets,
            ))
            .slice(0, 2)
      : []
  const relationAgeGuards = selectedRelations.map((relation) => ({
    relation,
    guard: ageScopeGuard(relation, input.ageMonths),
  }))
  const relations = relationAgeGuards
    .filter((entry) => !entry.guard.blocked)
    .map((entry) => entry.relation)
  const relationAgeLimitations = stableUnique(
    relationAgeGuards.flatMap((entry) => entry.guard.limitation ? [entry.guard.limitation] : []),
    3,
  )
  if (selectedRelations.length > 0 && relations.length === 0) {
    return {
      queryKind,
      route: queryKind === "dna_relation" ? "dna" : "theory",
      classification: "not_available",
      topicId: topic.id,
      topicTitle: topic.title,
      summary: "Bu ilişki için doğrulanmış katalogdaki yaş kapsamı seçili raporla uyumlu değil.",
      details: [],
      sources: [],
      limitations: relationAgeLimitations,
      suggestedQuestions: [`${topic.title} için yaş kapsamı nedir?`],
      evidenceSummary: evidenceSummary(topic),
    }
  }
  const internalComparison =
    queryKind === "comparison" && supportsInternalComparison(input.question, topic, claims)
  const explicitComparison =
    queryKind === "comparison" && hasExplicitSourceBackedTarget(input.question, topic, claims)
  const explicitAssociation =
    crossTopicEvidence
      ? hasAssociationClaimForTopics(explicitRelationTargets, claims)
      : queryKind === "relation" && explicitRelationTargets.length > 0
        ? hasAssociationClaimForTopics(explicitRelationTargets, claims)
        : queryKind === "relation" && hasExplicitAssociationClaim(input.question, topic, claims)
  const unsupportedInfantPhysiologyExecutiveFunction =
    /\b(?:infant|bebek|yenidogan)\w* fizyoloji\w*\b/.test(normalizedQuestion) &&
    /\b(?:ef|yurutucu islev)\w*\b/.test(normalizedQuestion)
  const unsupportedPrematurityAutonomicDevelopment =
    /\b(?:prematur\w*|erken dogum)\b/.test(normalizedQuestion) &&
    /\botonom(?: sinir sistemi)? gelisim\w*\b/.test(normalizedQuestion)
  const unsupportedActivationCausality =
    /\b(?:fmri|bold|aktivasyon\w*)\b/.test(normalizedQuestion) &&
    /\b(?:gerekli|zorunlu|nedensel\w*|nedensellik)\b/.test(normalizedQuestion)
  const unsupportedNociceptionPainComparison =
    /\bnosisepsiyon\b/.test(normalizedQuestion) &&
    /\bagri\b/.test(normalizedQuestion) &&
    /\b(?:fark\w*|ayni(?: sey| kavram)?)\b/.test(normalizedQuestion)
  const unsupportedUncuratedExposure =
    /\b(?:psikolojik stresor\w*|cocukluk adversitesi|ongorulemezlik|sosyal degerlendirme\w*|fiziksel aktivite|ekran suresi|ebeveyn destegi|sosyoekonomik durum|matematik|sosyal beceri\w*|akademik basari|ev ici kaos|yorgunluk|duygusal yuk)\b/.test(normalizedQuestion) &&
    ["evidence", "relation", "unknown"].includes(queryKind) &&
    !hasExplicitAssociationClaim(input.question, topic, claims)
  const unsupportedUncuratedProductMapping =
    queryKind === "dna_relation" &&
    relations.length === 0 &&
    /\b(?:hangi alan\w*|alti alan|fizyolojik regulasyon alan\w*|duyusal regulasyon alan\w*|bilissel regulasyon alan\w*|duygusal regulasyon alan\w*)\b/.test(normalizedQuestion)
  const unsupportedUncuratedSpecificRelation =
    /\b(?:uyku veya stres\b.+\bacc|metabilis\w*\b.+\byurutucu islev\w*|beynin olgunlasmasi\b.+\byurutucu islev\w*|sicak ve soguk ef|gorsel ipucu\w*\b.+\bcalisma bellegi|duygusal durum\b.+\bcalisma bellegi\b.+\bdna|uyku gecisi\w*|ekran kapat\w*\b.+\buyku sorun\w*|duyusal hassasiyet\w*\b.+\bkotu uyur|gunduz uykululugu\b.+\byorgunluk|gunduz uykusu\b.+\bbellek|yatakta gecirilen sure\b.+\buyku suresi|(?:yatis|yatma) saati\b.+\buyku baslangici|korunmus yurutucu kapasite\w*|dna duygusal regulasyon alani\b.+\bans|dna duygusal regulasyon alani\b.+\bhrv|reaktivite\b.+\bdna\w* yurutucu islev alani|toparlanma\b.+\bdna\w* bilissel regulasyon alani|stres sistem\w*\b.+\bdna\w* interosepsiyon alani|dna ile es regulasyon\b.+\bdogrudan validasyon|akran es regulasyonu\b.+\bhangi yas)\b/.test(normalizedQuestion)
  const unsupportedKnownCatalogGap =
    /\b(?:dna alti alan faktor yapisi dogrulandi mi|reaktivite dna\w*(?: \w+){0,2} yurutucu islev alaniyla|toparlanma dna\w*(?: \w+){0,2} bilissel regulasyon alaniyla|stres sistemleri dna\w*(?: \w+){0,2} interosepsiyon alaniyla|akran es regulasyonu hangi yaslarda arastirilmistir)\b/.test(normalizedQuestion)
  const unsupportedSpecificQuestion =
    (queryKind === "evidence" &&
      /\bcocuk ve ebeveyn rapor\w*.+\bne kadar uyus\w*/.test(normalizedQuestion) &&
      !hasExplicitSourceBackedTarget(input.question, topic, claims)) ||
    (queryKind === "misconception" && /\b(?:sakin|sessiz|hareketli) cocuk\b/.test(normalizedQuestion)) ||
    unsupportedInfantPhysiologyExecutiveFunction ||
    unsupportedPrematurityAutonomicDevelopment ||
    unsupportedActivationCausality ||
    unsupportedNociceptionPainComparison ||
    unsupportedUncuratedExposure ||
    unsupportedUncuratedProductMapping ||
    unsupportedUncuratedSpecificRelation ||
    unsupportedKnownCatalogGap ||
    /\bcocugun az tepki vermesi duyusal hiporeaktivite\b/.test(normalizedQuestion) ||
    /\btoparlanmayi olcmek icin en guclu tek gosterge\b/.test(normalizedQuestion) ||
    /\berken cocuklukta hangi duzenleme yollari\b/.test(normalizedQuestion)

  if (unsupportedSpecificQuestion) {
    return {
      queryKind,
      route: "theory",
      classification: "not_available",
      topicId: topic.id,
      topicTitle: topic.title,
      summary: "Bu özgül iddia için doğrulanmış katalogda yeterli dayanak bulunmuyor.",
      details: [],
      sources: [],
      limitations: ["Sistem genel konu bilgisini sorulan özgül ilişki veya grup farkının kanıtı gibi sunmadı."],
      suggestedQuestions: [`${topic.title} nedir?`, `${topic.title} için kanıt düzeyi nedir?`],
      evidenceSummary: evidenceSummary(topic),
    }
  }

  if (crossTopicEvidence && relations.length === 0 && !explicitAssociation) {
    return {
      queryKind,
      route: "theory",
      classification: "not_available",
      topicId: topic.id,
      topicTitle: topic.title,
      summary: "Bu iki konu arasındaki ilişki için doğrulanmış katalogda açık bir kanıt bağlantısı bulunmuyor.",
      details: [],
      sources: [],
      limitations: ["Konu kaynaklarının ayrı ayrı bulunması, aralarındaki özgül ilişkinin kanıtı sayılmadı."],
      suggestedQuestions: [`${topic.title} nedir?`, `${topic.title} için kanıt düzeyi nedir?`],
      evidenceSummary: evidenceSummary(topic),
    }
  }


  if (queryKind === "dna_relation" && explicitRelationTargets.length > 0 && relations.length === 0) {
    return {
      queryKind,
      route: "dna",
      classification: "not_available",
      topicId: topic.id,
      topicTitle: topic.title,
      summary: "Bu DNA alanı ile adı geçen ikinci konu arasında doğrulanmış katalogda açık bir ilişki kaydı bulunmuyor.",
      details: [],
      sources: [],
      limitations: ["Ayrı ayrı konu kayıtları bulunması, aralarındaki özgül ilişkinin veya DNA geçerliğinin kanıtı sayılmadı."],
      suggestedQuestions: [`${topic.title} nedir?`, `${topic.title} için DNA ilişkisinin sınırı nedir?`],
      evidenceSummary: evidenceSummary(topic),
    }
  }

  // Relationship answers may use only explicitly curated one-hop edges. If a
  // relationship is not in the graph, callers fall back to a bounded
  // not-available response instead of composing a new biological mechanism.
  if (
    (queryKind === "comparison" || queryKind === "relation") &&
    relations.length === 0 &&
    !internalComparison &&
    !explicitComparison &&
    !explicitAssociation
  ) {
    return {
      queryKind,
      route: "theory",
      classification: "not_available",
      topicId: topic.id,
      topicTitle: topic.title,
      summary: "Bu ilişki için doğrulanmış katalogda açık bir bağlantı bulunmuyor.",
      details: [],
      sources: [],
      limitations: ["Sistem graf üzerinde kayıtlı olmayan bir biyolojik ilişkiyi tamamlamadı."],
      suggestedQuestions: [`${topic.title} nedir?`, `${topic.title} için kanıt düzeyi nedir?`],
      evidenceSummary: evidenceSummary(topic),
    }
  }

  const relationLines = relationDetails(relations, topic)
  const claimLines = claims.flatMap((claim) => [claim.text, claim.detail]).filter(Boolean)
  const summary = relationLines[0] || claims[0]?.text || topic.summary
  const details = stableUnique(
    [
      ...relationLines.slice(1),
      ...claimLines,
      ...topic.details,
    ].filter((line) => line !== summary),
    5,
  )
  const sources = collectSources(topic, claims, relations)
  const limitations = stableUnique([
    topic.claimBoundary,
    ...(ageGuard.limitation ? [ageGuard.limitation] : []),
    ...claimAgeLimitations,
    ...relationAgeLimitations,
    topic.reviewStatus === "source_verified_expert_pending"
      ? "Kaynak doğrulaması tamamlandı; uzman içerik incelemesi henüz bekliyor."
      : "İçerik uzman incelemesinden geçmiştir.",
    "Bu açıklama genel bilimsel çerçevedir; tek vaka için tanı, kesin neden veya doğrudan biyolojik ölçüm değildir.",
  ], 4)

  return {
    queryKind,
    route: queryKind === "dna_relation" ? "dna" : "theory",
    classification: queryKind === "evidence" ? "literature" : "dna_concept",
    topicId: topic.id,
    topicTitle: topic.title,
    summary,
    details,
    sources,
    limitations,
    suggestedQuestions: stableUnique([
      `${topic.title} nedir?`,
      `${topic.title} için kanıt düzeyi nedir?`,
      `${topic.title} DNA alanlarıyla nasıl ilişkilidir?`,
    ], 3),
    evidenceSummary: evidenceSummary(topic),
  }
}

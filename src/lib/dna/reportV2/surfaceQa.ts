import type {
  CanonicalEvidenceRelation,
  CaseEvidenceSource,
  CaseEvidenceSourceRelation,
  LockedReportPlan,
  ReportRealization,
  ReportSectionId,
} from "./contracts"

type RelationObservation = Readonly<{
  sectionId: ReportSectionId
  sentence: string
  sourceA: CaseEvidenceSource
  sourceB: CaseEvidenceSource
  domain: CanonicalEvidenceRelation["domain"]
  construct: string
  relation: CaseEvidenceSourceRelation
}>

const SOURCE_PATTERNS: Readonly<Record<CaseEvidenceSource, RegExp>> = Object.freeze({
  ANAMNESIS: /\banamnez(?: bilgisi| bulgusu)?\b/iu,
  CAREGIVER_REPORT: /(?:bakım veren|bakımveren)(?: anlatısı| bildirimi| raporu)?/iu,
  TEACHER_REPORT: /öğretmen(?: bildirimi| gözlemi| raporu)?/iu,
  THERAPIST_OBSERVATION: /(?:terapist|klinik)(?: gözlemi| değerlendirmesi)/iu,
  DNA_PROFILE: /DNA(?: alan)? (?:puanı|puanları|profili|bulgusu|bulguları|sonucu|sonuçları)/iu,
  EXTERNAL_ASSESSMENT: /(?:dış (?:test|değerlendirme)(?: sonucu| bulgusu)?|bağımsız test)/iu,
  PRESERVED_CAPACITY: /(?:korunmuş işlev bilgisi|destekli koşullardaki performans|yapılandırılmış koşullardaki performans)/iu,
  CONTEXTUAL_EVIDENCE: /(?:bağlamsal performans bilgisi|ortam ve destek koşulları|görev, destek veya çevre koşulları)/iu,
})

const DOMAIN_PATTERNS = Object.freeze([
  Object.freeze({ domain: "physiological" as const, pattern: /fizyolojik regülasyon|uyku|enerji|toparlanma/iu }),
  Object.freeze({ domain: "sensory" as const, pattern: /duyusal regülasyon|duyusal işlem|işitsel|dokunsal|uyaran/iu }),
  Object.freeze({ domain: "emotional" as const, pattern: /duygusal regülasyon|duygusal toparlanma|sakinleşme|engellenme/iu }),
  Object.freeze({ domain: "cognitive" as const, pattern: /bilişsel regülasyon|çalışma belleği|sözel bilgi|sözel yük/iu }),
  Object.freeze({ domain: "executive" as const, pattern: /yürütücü işlev|planlama|organizasyon|çok basamaklı/iu }),
  Object.freeze({ domain: "interoception" as const, pattern: /interosepsiyon|interoseptif|beden sinyal|açlık|susuzluk|tuvalet/iu }),
])

const PARTIAL = /(?:kısmen (?:aynı yönde|örtüş|destek)|bir bölümü(?:yle)? örtüş|tamamlayıcı bilgi)/iu
const DISAGREES = /(?:aynı yönde (?:değil|değildir|sonuç vermiyor|sonuç vermemektedir)|ayrış|uyumsuz|farklı (?:sonuç|yönde)|biri[^.!?]{0,100}güçlük[^.!?]{0,100}diğeri[^.!?]{0,100}(?:göstermiyor|beklenen|tipik))/iu
const SUPPORTS = /(?:aynı yönde|birbirini destekliyor|birbirini desteklemektedir|uyumlu|benzer bulgu(?:yu)? gösteriyor|örtüşmektedir|örtüşüyor)/iu
const NOT_COMPARABLE = /(?:doğrudan karşılaştırılamaz|karşılaştırmak için (?:yeterli|uygun) (?:bilgi|veri) (?:yok|bulunmuyor)|aynı yönde olup olmadığı söylenemiyor)/iu
const MISSING = /(?:bulunmadığı|mevcut olmadığı|paylaşılmadığı) için[^.!?]{0,100}karşılaştır/iu
const CONTRASTED_FUNCTION = /DNA[^.!?]{0,100}(?:güçlüğe|atipik)[^.!?]{0,100}(?:olsa da|etse de|buna karşın)[^.!?]{0,100}(?:dış test|dış değerlendirme)[^.!?]{0,80}(?:daha iyi|tipik|beklenen)/iu

function unique<T>(values: readonly T[]) {
  return Array.from(new Set(values))
}

function sentences(text: string) {
  return text.split(/(?<=[.!?])\s+|\n+/u).map((sentence) => sentence.trim()).filter(Boolean)
}

function sourcePair(left: CaseEvidenceSource, right: CaseEvidenceSource): readonly [CaseEvidenceSource, CaseEvidenceSource] {
  return left.localeCompare(right, "en") <= 0 ? [left, right] : [right, left]
}

function relationInSentence(sentence: string): CaseEvidenceSourceRelation | null {
  if (MISSING.test(sentence)) return "MISSING"
  if (PARTIAL.test(sentence)) return "PARTIALLY_SUPPORTS"
  if (CONTRASTED_FUNCTION.test(sentence) || DISAGREES.test(sentence)) return "DISAGREES"
  if (NOT_COMPARABLE.test(sentence)) return "NOT_COMPARABLE"
  if (SUPPORTS.test(sentence)) return "SUPPORTS"
  return null
}

function domainInSentence(sentence: string): CanonicalEvidenceRelation["domain"] {
  const matches = DOMAIN_PATTERNS.filter((row) => row.pattern.test(sentence)).map((row) => row.domain)
  return matches.length === 1 ? matches[0]! : "global"
}

function relationKey(input: Readonly<{ sourceA: CaseEvidenceSource; sourceB: CaseEvidenceSource; domain: CanonicalEvidenceRelation["domain"]; construct: string }>) {
  const [sourceA, sourceB] = sourcePair(input.sourceA, input.sourceB)
  return `${sourceA}|${sourceB}|${input.domain ?? "none"}|${input.construct}`
}

function extractRelationObservations(realization: ReportRealization): RelationObservation[] {
  const rows: RelationObservation[] = []
  for (const section of realization.sections.filter((item) => item.sectionId !== "section_8")) {
    for (const sentence of sentences(section.text)) {
      const relation = relationInSentence(sentence)
      if (!relation) continue
      const sources = (Object.entries(SOURCE_PATTERNS) as [CaseEvidenceSource, RegExp][]).filter(([, pattern]) => pattern.test(sentence)).map(([source]) => source)
      if (sources.length < 2) continue
      const domain = domainInSentence(sentence)
      for (let leftIndex = 0; leftIndex < sources.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < sources.length; rightIndex += 1) {
          const [sourceA, sourceB] = sourcePair(sources[leftIndex]!, sources[rightIndex]!)
          rows.push(Object.freeze({ sectionId: section.sectionId, sentence, sourceA, sourceB, domain, construct: domain == null || domain === "global" ? "global" : domain, relation }))
        }
      }
    }
  }
  return rows
}

function canonicalForObservation(plan: LockedReportPlan, observation: RelationObservation): CanonicalEvidenceRelation | null {
  const candidates = plan.caseEvidenceSourceMatrix.canonicalRelations.filter((relation) => {
    const [sourceA, sourceB] = sourcePair(relation.sourceA, relation.sourceB)
    return sourceA === observation.sourceA && sourceB === observation.sourceB
  })
  const exact = candidates.find((relation) => relation.domain === observation.domain || relation.construct === observation.construct)
  if (exact) return exact
  if (observation.domain !== "global") return null
  const relations = unique(candidates.map((relation) => relation.relation))
  return relations.length === 1 ? candidates[0] ?? null : null
}

export function auditEvidenceRelationConsistency(input: Readonly<{ plan: LockedReportPlan; realization: ReportRealization }>) {
  const observations = extractRelationObservations(input.realization)
  const grouped = new Map<string, RelationObservation[]>()
  for (const observation of observations) {
    const key = relationKey(observation)
    grouped.set(key, [...(grouped.get(key) ?? []), observation])
  }
  const contradictoryKeys = [...grouped.entries()].filter(([, rows]) => unique(rows.map((row) => row.relation)).length > 1)
  let crossSectionRelationDriftCount = 0
  let sameDirectionFalseAssertionCount = 0
  const conflictSectionIds: ReportSectionId[] = contradictoryKeys.flatMap(([, rows]) => rows.map((row) => row.sectionId))
  for (const observation of observations) {
    if (observation.relation === "MISSING"
      && input.plan.caseEvidenceSourceMatrix.missingSources.includes(observation.sourceA)
      && input.plan.caseEvidenceSourceMatrix.missingSources.includes(observation.sourceB)) continue
    const canonical = canonicalForObservation(input.plan, observation)
    if (!canonical || canonical.relation !== observation.relation) {
      crossSectionRelationDriftCount += 1
      conflictSectionIds.push(observation.sectionId)
      if (observation.relation === "SUPPORTS" && canonical?.relation !== "SUPPORTS") sameDirectionFalseAssertionCount += 1
    }
  }
  return Object.freeze({
    sourcePairRelationContradictionCount: contradictoryKeys.length,
    crossSectionRelationDriftCount,
    sameDirectionFalseAssertionCount,
    conflictSectionIds: Object.freeze(unique(conflictSectionIds)),
    observations: Object.freeze(observations),
  })
}

const OBJECT_AGREEMENT = /(?:alanındaki|alanlarındaki|görevlerindeki|yaşamdaki|regülasyondaki)\s+(?:güçlük|bulgu|görünüm|örüntü)\s+(?:destekliyor|desteklemektedir)/giu
const BROKEN_NOUN_PHRASE = /(?:\b(?:dengeli|korunmuş)\s+(?:bir\s+)?bulgular\b|\bkorunmuş ve dengeli düzenleme bulgu\b|\bdüzenleme bulgu\b|\bdengeli bir bulgular\b)/giu
const BROKEN_COPULA = /\b(?:önceliğidır|önceliğindadır|önceliğindedır|önceliğindedirdir)\b/giu
const LOWERCASE_AFTER_PUNCTUATION = /[.!?]\s+[a-zçğıöşü]{3,}\s/gu

function lastVowel(word: string) {
  return [...word.toLocaleLowerCase("tr-TR")].reverse().find((char) => "aeıioöuü".includes(char)) ?? null
}

function conjunctionHarmonyErrors(text: string) {
  const errors: string[] = []
  for (const match of text.matchAll(/(?<![\p{L}])([\p{L}]+)\s+(da|de)(?=\s|[,.!?;:]|$)/gu)) {
    const vowel = lastVowel(match[1]!)
    if (!vowel) continue
    const expected = "e i ö ü".includes(vowel) ? "de" : "da"
    if (match[2] !== expected) errors.push(match[0])
  }
  return errors
}

function matches(text: string, pattern: RegExp) {
  pattern.lastIndex = 0
  return text.match(pattern) ?? []
}

export function auditTurkishMorphology(realization: ReportRealization) {
  let subjectObjectAgreementErrorCount = 0
  let brokenNounPhraseCount = 0
  let otherMorphologyErrorCount = 0
  const conflictSectionIds: ReportSectionId[] = []
  const errors: { sectionId: ReportSectionId; kind: "SUBJECT_OBJECT_AGREEMENT" | "BROKEN_NOUN_PHRASE" | "OTHER_MORPHOLOGY"; text: string }[] = []
  for (const section of realization.sections) {
    if (section.sectionId === "section_2") continue
    const objectMatches = matches(section.text, OBJECT_AGREEMENT)
    const nounMatches = matches(section.text, BROKEN_NOUN_PHRASE)
    const otherMatches = [...matches(section.text, BROKEN_COPULA), ...matches(section.text, LOWERCASE_AFTER_PUNCTUATION), ...conjunctionHarmonyErrors(section.text)]
    const objectErrors = objectMatches.length
    const nounErrors = nounMatches.length
    const otherErrors = otherMatches.length
    objectMatches.forEach((text) => errors.push({ sectionId: section.sectionId, kind: "SUBJECT_OBJECT_AGREEMENT", text }))
    nounMatches.forEach((text) => errors.push({ sectionId: section.sectionId, kind: "BROKEN_NOUN_PHRASE", text }))
    otherMatches.forEach((text) => errors.push({ sectionId: section.sectionId, kind: "OTHER_MORPHOLOGY", text }))
    subjectObjectAgreementErrorCount += objectErrors
    brokenNounPhraseCount += nounErrors
    otherMorphologyErrorCount += otherErrors
    if (objectErrors + nounErrors + otherErrors > 0) conflictSectionIds.push(section.sectionId)
  }
  return Object.freeze({
    turkishMorphologyErrorCount: subjectObjectAgreementErrorCount + brokenNounPhraseCount + otherMorphologyErrorCount,
    subjectObjectAgreementErrorCount,
    brokenNounPhraseCount,
    conflictSectionIds: Object.freeze(unique(conflictSectionIds)),
    errors: Object.freeze(errors.map((error) => Object.freeze(error))),
  })
}

function harmonyVowel(vowel: string | null) {
  if (!vowel) return null
  if ("aı".includes(vowel)) return "ı"
  if ("ei".includes(vowel)) return "i"
  if ("ou".includes(vowel)) return "u"
  return "ü"
}

function locativeVowel(vowel: string | null) {
  return vowel && "eiöü".includes(vowel) ? "e" : "a"
}

function suffixHarmonyErrors(text: string) {
  const errors: string[] = []
  for (const match of text.matchAll(/\b([\p{L}]+?)([ıiuü])n([dt])([ae])\b/giu)) {
    const expectedPossessive = harmonyVowel(lastVowel(match[1]!))
    const expectedLocative = locativeVowel(match[2]!)
    if (match[2] !== expectedPossessive || match[3] !== "d" || match[4] !== expectedLocative) errors.push(match[0])
  }
  for (const match of text.matchAll(/\b([\p{L}]{2,}?[aeıioöuü])d([ıiuü])r\b/giu)) {
    const stem = match[1]!.toLocaleLowerCase("tr-TR")
    const expectedVowel = harmonyVowel(lastVowel(stem))
    if (match[2] !== expectedVowel) errors.push(match[0])
  }
  return errors
}

function punctuationErrors(text: string) {
  const errors: string[] = []
  if (text.trim() && !/[.!?)]$/u.test(text.trim())) errors.push("MISSING_FINAL_PUNCTUATION")
  errors.push(...matches(text, /\s+[,.!?;:]/gu))
  errors.push(...matches(text, /[,;](?=[\p{L}])/gu))
  errors.push(...matches(text, /[!?]{2,}|\.{2,}/gu))
  return errors
}

function sentenceBoundaryErrors(text: string) {
  const errors: string[] = []
  for (const match of text.matchAll(/[.!?]\s+([a-zçğıöşü]{2,})\b/gu)) {
    if (["http", "https"].includes((match[1] ?? "").toLocaleLowerCase("tr-TR"))) continue
    errors.push(match[0])
  }
  errors.push(...matches(text, /;\s+[A-ZÇĞİÖŞÜ][\p{L}-]*/gu))
  for (const line of text.split(/\n+/u).map((item) => item.trim()).filter(Boolean)) {
    if (/^(?:[-–•]\s*)?(?:[A-ZÇĞİÖŞÜ0-9(]|https?:\/\/)/u.test(line)) continue
    errors.push(line.slice(0, 40))
  }
  return errors
}

export function auditFinalTurkishSurface(realization: ReportRealization) {
  const existingMorphology = auditTurkishMorphology(realization)
  const morphologyKeys = new Set(existingMorphology.errors.map((error) => `${error.sectionId}:${error.text}`))
  const punctuationKeys = new Set<string>()
  const sentenceBoundaryKeys = new Set<string>()
  const conflictSectionIds: ReportSectionId[] = [...existingMorphology.conflictSectionIds]
  for (const section of realization.sections) {
    const suffixErrors = suffixHarmonyErrors(section.text)
    const punctuation = punctuationErrors(section.text)
    const boundaries = sentenceBoundaryErrors(section.text)
    suffixErrors.forEach((error) => morphologyKeys.add(`${section.sectionId}:${error}`))
    punctuation.forEach((error) => punctuationKeys.add(`${section.sectionId}:${error}`))
    boundaries.forEach((error) => sentenceBoundaryKeys.add(`${section.sectionId}:${error}`))
    if (suffixErrors.length || punctuation.length || boundaries.length) conflictSectionIds.push(section.sectionId)
  }
  const morphologyErrorCount = morphologyKeys.size
  const punctuationErrorCount = punctuationKeys.size
  const sentenceBoundaryErrorCount = sentenceBoundaryKeys.size
  return Object.freeze({
    turkishSurfaceErrorCount: morphologyErrorCount + punctuationErrorCount + sentenceBoundaryErrorCount,
    morphologyErrorCount,
    punctuationErrorCount,
    sentenceBoundaryErrorCount,
    conflictSectionIds: Object.freeze(unique(conflictSectionIds)),
    morphologyErrors: Object.freeze([...morphologyKeys]),
    punctuationErrors: Object.freeze([...punctuationKeys]),
    sentenceBoundaryErrors: Object.freeze([...sentenceBoundaryKeys]),
  })
}

export function auditSection5GenericSpecificDuplication(realization: ReportRealization) {
  const observations = extractRelationObservations(realization).filter((observation) => observation.sectionId === "section_5")
  const generic = observations.filter((observation) => observation.domain === "global")
  const duplicateRows = generic.filter((observation) => observations.some((specific) => specific.domain !== "global"
    && specific.sourceA === observation.sourceA
    && specific.sourceB === observation.sourceB
    && specific.relation === observation.relation))
  return Object.freeze({
    section5GenericSpecificDuplicationCount: duplicateRows.length,
    conflictSectionIds: Object.freeze(duplicateRows.length ? ["section_5" as const] : []),
    duplicateSentences: Object.freeze(unique(duplicateRows.map((row) => row.sentence))),
  })
}

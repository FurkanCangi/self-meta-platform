import { normalizeDnaChatText } from "../text"
import type { DnaS13Claim } from "./contracts"
import type {
  DnaS13ComparisonCategory,
  DnaS13ComparisonCategoryEvidence,
  DnaS13ComparisonConclusionBasis,
  DnaS13ComparisonConclusionMode,
  DnaS13StrictSlot,
} from "./strictContracts"

export const DNA_S13_COMPARISON_CONCLUSION_POLICY_VERSION = "dna-s13-comparison-conclusion@2" as const
export const DNA_S13_COMPARISON_ABSTENTION = "Bu iki kavramı düzey veya ilişki bakımından daha ileri ayırmak için yeterli bilgi bulunmuyor." as const

const CATEGORY_SURFACES: Readonly<Record<DnaS13ComparisonCategory, string>> = Object.freeze({
  "yapı": "bir yapı",
  "süreç": "bir süreç",
  "ölçüm": "bir ölçüm",
  "kuramsal çerçeve": "bir kuramsal çerçeve",
  "klinik örnek": "bir klinik örnek",
  "değerlendirme başlığı": "bir değerlendirme başlığı",
  "işlevsel hedef": "bir işlevsel hedef",
  "fizyolojik sistem": "bir fizyolojik sistem",
  "bilişsel süreç": "bilişsel bir süreç",
  "gelişimsel kavram": "gelişimsel bir kavram",
})

type CategoryResult = Readonly<{
  category: DnaS13ComparisonCategory
  evidence: DnaS13ComparisonCategoryEvidence
}>

export type DnaS13ComparisonConclusionDecision = Readonly<{
  mode: DnaS13ComparisonConclusionMode
  controlledText: string
  supportClaimIds: readonly string[]
  categoryLabels: Readonly<{ sideA: DnaS13ComparisonCategory | null; sideB: DnaS13ComparisonCategory | null }>
  basis: DnaS13ComparisonConclusionBasis
}>

function unique(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))]
}

function titleOf(slot: DnaS13StrictSlot, fallback: string) {
  return slot.lockedClaims[0]?.claim.title?.trim() || fallback
}

function displayTitle(slot: DnaS13StrictSlot, fallback: string) {
  return titleOf(slot, fallback).replace(/\s+Nedir\?$/iu, "").replace(/[?!:]+$/u, "").trim()
}

function requiredClaims(slot: DnaS13StrictSlot) {
  return slot.lockedClaims
    .filter((entry) => entry.role === "required" && slot.requiredClaimIds.includes(entry.claim.id))
    .map((entry) => entry.claim)
}

function evidence(claim: DnaS13Claim, category: DnaS13ComparisonCategory, evidenceCode: string): CategoryResult {
  return Object.freeze({
    category,
    evidence: Object.freeze({ claimId: claim.id, category, evidenceCode }),
  })
}

function categoryFromClaim(claim: DnaS13Claim): CategoryResult | null {
  const title = normalizeDnaChatText(claim.title ?? "")
  const text = normalizeDnaChatText(claim.text)

  if (/\b(?:bir yapidir|noroanatomik yapi|norolojik yapi|anatomik yapi)\b/u.test(text)) {
    return evidence(claim, "yapı", "explicit_structure_text")
  }
  if (/\b(?:parasempatik sistem|otonom sinir sistemi|fizyolojik sistem)\b/u.test(`${title} ${text}`)) {
    return evidence(claim, "fizyolojik sistem", "explicit_physiological_system_text")
  }
  if (/\bdikkat\b/u.test(`${title} ${text}`)
    && /\b(?:kaynak paylas|bilgi kaynagi|gorev arasinda|bilissel surec)\w*\b/u.test(text)) {
    return evidence(claim, "bilişsel süreç", "explicit_attention_process_text")
  }
  if (/\b(?:olcum|olcul|analiz edil|analiz edilebilir|olcek)\w*\b/u.test(text)) {
    return evidence(claim, "ölçüm", "explicit_measurement_or_analysis_text")
  }
  if (/\b(?:gelisimsel yol|gelisimsel kavram)\w*\b/u.test(text)) {
    return evidence(claim, "gelişimsel kavram", "explicit_developmental_concept_text")
  }
  if (/\bhomeostaz\b/u.test(`${title} ${text}`)
    && /\b(?:fizyolojik degisken|islevsel sinir|tutmaya odaklan)\w*\b/u.test(text)) {
    return evidence(claim, "süreç", "explicit_homeostatic_process_text")
  }
  if (/\bklinik ornek\b/u.test(title)) {
    return evidence(claim, "klinik örnek", "explicit_clinical_example_title")
  }
  if (/\b(?:guclu yonleri|sinirliliklari|klinik degeri|desteklenen noktalar|genel degerlendirme)\b/u.test(title)) {
    return evidence(claim, "değerlendirme başlığı", "explicit_evaluation_heading_title")
  }
  if (/\bhedef\b/u.test(title) && /\b(?:aktivite|sonuc|katilim|islev)\w*\b/u.test(text)) {
    return evidence(claim, "işlevsel hedef", "explicit_functional_target_title_and_text")
  }
  if (/\b(?:yaklasim|model|teori)\b/u.test(`${title} ${text}`)) {
    return evidence(claim, "kuramsal çerçeve", "explicit_framework_text")
  }
  if (/\b(?:surectir|sureci ifade|surecleridir|surecidir)\b/u.test(text)) {
    return evidence(claim, "süreç", "explicit_process_text")
  }
  return null
}

function categoryRepresentsSideTitle(claim: DnaS13Claim, result: CategoryResult) {
  if ([
    "explicit_evaluation_heading_title",
    "explicit_functional_target_title_and_text",
    "explicit_clinical_example_title",
  ].includes(result.evidence.evidenceCode)) return true
  const title = normalizeDnaChatText(claim.title ?? "")
  const text = normalizeDnaChatText(claim.text)
  const titleTokens = title.split(/\s+/).filter((token) => token.length >= 5)
  if (titleTokens.some((token) => text.includes(token))) return true
  return /\bkalp hizi degiskenligi\b/u.test(title) && /\bhrv\b/u.test(text)
}

function categoryFromSide(slot: DnaS13StrictSlot): CategoryResult | null {
  for (const claim of requiredClaims(slot)) {
    const result = categoryFromClaim(claim)
    if (result && categoryRepresentsSideTitle(claim, result)) return result
  }
  return null
}

function significantTitleTokens(title: string) {
  return normalizeDnaChatText(title).split(/\s+/).filter((token) => token.length >= 5)
}

function mentionsTitle(text: string, title: string) {
  const normalized = normalizeDnaChatText(text)
  return significantTitleTokens(title).some((token) => normalized.includes(token))
}

function directSupport(sides: readonly DnaS13StrictSlot[]) {
  const [left, right] = sides
  if (!left || !right) return null
  const leftTitle = displayTitle(left, "İlk kavram")
  const rightTitle = displayTitle(right, "İkinci kavram")
  for (const claim of [...requiredClaims(left), ...requiredClaims(right)]) {
    const text = normalizeDnaChatText(claim.text)
    const explicit = /\b(?:ayni kavram degildir|ayni duzeyde degildir|ayri degerlendirilmelidir)\b/u.test(text)
      || /\bbiri\b[\s\S]{1,180}\bdigeri\b/u.test(text)
    if (explicit && mentionsTitle(claim.text, leftTitle) && mentionsTitle(claim.text, rightTitle)) return claim
  }
  return null
}

function definitionContrastSupport(left: DnaS13StrictSlot, right: DnaS13StrictSlot) {
  const leftClaim = requiredClaims(left)[0]
  const rightClaim = requiredClaims(right)[0]
  if (!leftClaim || !rightClaim
    || leftClaim.topicId !== left.topicId
    || rightClaim.topicId !== right.topicId
    || !leftClaim.sourceIds.length
    || !rightClaim.sourceIds.length
    || !mentionsTitle(leftClaim.text, displayTitle(left, "İlk kavram"))
    || !mentionsTitle(rightClaim.text, displayTitle(right, "İkinci kavram"))) return null
  const tokenSet = (value: string) => new Set(normalizeDnaChatText(value)
    .split(/\s+/u).filter((token) => token.length >= 4))
  const leftTokens = tokenSet(leftClaim.text)
  const rightTokens = tokenSet(rightClaim.text)
  const union = new Set([...leftTokens, ...rightTokens])
  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length
  const similarity = union.size ? shared / union.size : 1
  if (leftTokens.size < 2 || rightTokens.size < 2 || similarity >= 0.85) return null
  return Object.freeze({ leftClaim, rightClaim })
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function lowerInitial(value: string) {
  return value.replace(/^([A-ZÇĞİÖŞÜ])(?=[a-zçğıöşü])/u, (initial) => initial.toLocaleLowerCase("tr-TR"))
}

function scopedDefinitionText(title: string, claim: DnaS13Claim) {
  const text = claim.text.trim().replace(/[.!?]+$/u, "")
  const withoutTitle = text.replace(new RegExp(`^${escapeRegExp(title)}(?:\\s+Nedir\\?)?\\s*[,;:\\-–—]?\\s*`, "iu"), "").trim()
  return lowerInitial(withoutTitle && withoutTitle !== text ? withoutTitle : text)
}

export function deriveDnaS13ComparisonConclusion(sides: readonly DnaS13StrictSlot[]): DnaS13ComparisonConclusionDecision | null {
  if (sides.length !== 2 || new Set(sides.map((slot) => slot.topicId)).size !== 2) return null
  const [left, right] = sides
  if (!left || !right) return null
  const leftTitle = displayTitle(left, "İlk kavram")
  const rightTitle = displayTitle(right, "İkinci kavram")
  const direct = directSupport(sides)
  const leftCategory = categoryFromSide(left)
  const rightCategory = categoryFromSide(right)

  if (direct) {
    const directEvidence = Object.freeze({ claimId: direct.id, category: null, evidenceCode: "direct_explicit_comparison" })
    const basis: DnaS13ComparisonConclusionBasis = Object.freeze({
      rule: "direct_explicit_comparison",
      sideA: Object.freeze([directEvidence]),
      sideB: Object.freeze([directEvidence]),
    })
    return Object.freeze({
      mode: "direct",
      controlledText: direct.text.trim(),
      supportClaimIds: Object.freeze([direct.id]),
      categoryLabels: Object.freeze({ sideA: leftCategory?.category ?? null, sideB: rightCategory?.category ?? null }),
      basis,
    })
  }

  if (leftCategory && rightCategory && leftCategory.category !== rightCategory.category) {
    const supportClaimIds = unique([leftCategory.evidence.claimId, rightCategory.evidence.claimId])
    return Object.freeze({
      mode: "safe_categorical_inference",
      controlledText: `Aynı düzeyde değildir; ${leftTitle} ${CATEGORY_SURFACES[leftCategory.category]}, ${rightTitle} ise ${CATEGORY_SURFACES[rightCategory.category]} olarak ele alınır.`,
      supportClaimIds: Object.freeze(supportClaimIds),
      categoryLabels: Object.freeze({ sideA: leftCategory.category, sideB: rightCategory.category }),
      basis: Object.freeze({
        rule: "distinct_locked_categories",
        sideA: Object.freeze([leftCategory.evidence]),
        sideB: Object.freeze([rightCategory.evidence]),
      }),
    })
  }


  const definitionContrast = definitionContrastSupport(left, right)
  if (definitionContrast) {
    const sideAEvidence = Object.freeze({
      claimId: definitionContrast.leftClaim.id,
      category: null,
      evidenceCode: "verified_definition_side_a",
    })
    const sideBEvidence = Object.freeze({
      claimId: definitionContrast.rightClaim.id,
      category: null,
      evidenceCode: "verified_definition_side_b",
    })
    return Object.freeze({
      mode: "contrast_by_verified_definitions",
      controlledText: `Temel fark şudur: ${leftTitle}, ${scopedDefinitionText(leftTitle, definitionContrast.leftClaim)}; ${rightTitle} ise ${scopedDefinitionText(rightTitle, definitionContrast.rightClaim)}.`,
      supportClaimIds: Object.freeze([definitionContrast.leftClaim.id, definitionContrast.rightClaim.id]),
      categoryLabels: Object.freeze({ sideA: null, sideB: null }),
      basis: Object.freeze({
        rule: "distinct_verified_definitions",
        sideA: Object.freeze([sideAEvidence]),
        sideB: Object.freeze([sideBEvidence]),
      }),
    })
  }

  return Object.freeze({
    mode: "abstain",
    controlledText: DNA_S13_COMPARISON_ABSTENTION,
    supportClaimIds: Object.freeze(unique([...left.requiredClaimIds, ...right.requiredClaimIds])),
    categoryLabels: Object.freeze({ sideA: leftCategory?.category ?? null, sideB: rightCategory?.category ?? null }),
    basis: Object.freeze({
      rule: "insufficient_locked_category_evidence",
      sideA: Object.freeze(leftCategory ? [leftCategory.evidence] : []),
      sideB: Object.freeze(rightCategory ? [rightCategory.evidence] : []),
    }),
  })
}

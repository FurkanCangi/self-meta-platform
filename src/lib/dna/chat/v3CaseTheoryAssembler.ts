import { evaluateClaimGuard } from "../clinicalClaimRegistry"
import { getDnaChatCaseContextAuthority } from "./caseContext"
import { isReleaseEligibleAuthority } from "./knowledgeAuthority"
import type { DnaChatSafeCaseContext } from "./types"
import { normalizeDnaChatText, tokenizeDnaChatText } from "./text"
import {
  createDnaV3CaseUnit,
  createDnaV3PolicyUnit,
  validateDnaV3AnswerEvidence,
  type DnaV3AnswerSection,
  type DnaV3AnswerUnit,
} from "./v3AnswerEvidence"
import type {
  DnaV3RetrievalAnswer,
  DnaV3RetrievalPackage,
} from "./v3RetrievalCore"

export const DNA_V3_CASE_THEORY_ASSEMBLER_VERSION =
  "dna-v3-case-theory-assembler@1" as const

export const DNA_V3_CASE_THEORY_BOUNDARY_TR =
  "Bu rapor biyolojik mekanizmayı doğrudan ölçmez; rapor bulguları genel literatürle birlikte fakat ondan ayrı değerlendirilmelidir." as const

export const DNA_V3_CASE_ONLY_BOUNDARY_TR =
  "Bu rapor özeti yalnız güvenli yapılandırılmış vaka alanlarını gösterir; tanı, tedavi, prognoz, kesin nedensellik veya biyolojik mekanizma çıkarımı değildir." as const

const CASE_FINDING_NOT_RECORDED_TR =
  "Seçili raporun güvenli yapılandırılmış bağlamında bu soruyla eşleşen bir vaka bulgusu kayıtlı değildir." as const
const CASE_MISSING_DATA_NOT_RECORDED_TR =
  "Raporda bulunmayan ölçümler veya eksik alanlar hakkında güvenli yapılandırılmış bağlamın ötesinde çıkarım yapılamaz." as const
const CASE_CAPACITY_NOT_RECORDED_TR =
  "Korunmuş kapasite veya karşı kanıt güvenli yapılandırılmış rapor bağlamında kayıtlı değildir." as const

function stableUnique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "en"))
}

function hasVerifiedReportAuthority(context: DnaChatSafeCaseContext): boolean {
  if (context.dataStatus !== "deidentified" || context.redactionCount > 0 || context.unsafeClaimCount > 0) {
    return false
  }
  try {
    const authority = getDnaChatCaseContextAuthority(context)
    return authority.layer === "case_information" && isReleaseEligibleAuthority(authority)
  } catch {
    return false
  }
}

const CASE_TOPIC_STOP_TOKENS = new Set([
  "aciklama", "baglanti", "bilgi", "bilimsel", "bolge", "bulgu", "cns",
  "dna", "duzenleme", "genel", "iliski", "kanit", "korteks", "literatur",
  "rapor", "surec", "sistem", "teori",
])

function topicTokens(
  theoryAnswer: DnaV3RetrievalAnswer,
  pkg: DnaV3RetrievalPackage,
): ReadonlySet<string> {
  const claims = pkg.claims.filter((claim) => claim.topicId === theoryAnswer.topic)
  const values = claims.flatMap((claim) => [
    claim.topicId,
    claim.title,
    ...claim.aliases,
    ...claim.keywords,
  ])
  return new Set(values.flatMap(tokenizeDnaChatText)
    .filter((token) => token.length >= 4 && !CASE_TOPIC_STOP_TOKENS.has(token)))
}

function matchesTopic(value: string | null | undefined, tokens: ReadonlySet<string>): boolean {
  if (!value || !tokens.size) return false
  return tokenizeDnaChatText(value).some((token) => tokens.has(token))
}

function firstTopicMatch(values: readonly string[], tokens: ReadonlySet<string>) {
  const index = values.findIndex((value) => matchesTopic(value, tokens))
  return index >= 0 ? { index, value: values[index]! } : null
}

function caseFinding(
  context: DnaChatSafeCaseContext,
  tokens: ReadonlySet<string>,
): DnaV3AnswerUnit {
  if (context.chatContext.primaryAxis && matchesTopic(context.chatContext.primaryAxis, tokens)) {
    return createDnaV3CaseUnit({
      id: "primary-axis",
      text: context.chatContext.primaryAxis,
      section: "case_finding",
      caseFieldIds: ["chatContext.primaryAxis"],
    })
  }
  const evidence = firstTopicMatch(context.chatContext.evidence, tokens)
  if (evidence) {
    return createDnaV3CaseUnit({
      id: `evidence-${evidence.index + 1}`,
      text: evidence.value,
      section: "case_finding",
      caseFieldIds: [`chatContext.evidence[${evidence.index}]`],
    })
  }
  return createDnaV3CaseUnit({
    id: "finding-not-recorded",
    text: CASE_FINDING_NOT_RECORDED_TR,
    section: "case_finding",
    caseFieldIds: ["chatContext.primaryAxis", "chatContext.evidence"],
  })
}

function missingCaseData(
  context: DnaChatSafeCaseContext,
  tokens: ReadonlySet<string>,
): DnaV3AnswerUnit {
  const limitation = firstTopicMatch(context.chatContext.limitations, tokens)
  if (limitation) {
    return createDnaV3CaseUnit({
      id: `limitation-${limitation.index + 1}`,
      text: limitation.value,
      section: "case_missing",
      caseFieldIds: [`chatContext.limitations[${limitation.index}]`],
    })
  }
  return createDnaV3CaseUnit({
    id: "missing-data-not-recorded",
    text: CASE_MISSING_DATA_NOT_RECORDED_TR,
    section: "case_missing",
    caseFieldIds: ["chatContext.limitations"],
  })
}

function preservedCapacity(
  context: DnaChatSafeCaseContext,
  tokens: ReadonlySet<string>,
): DnaV3AnswerUnit {
  const preserved = firstTopicMatch(context.chatContext.preservedCapacities, tokens)
  if (preserved) {
    return createDnaV3CaseUnit({
      id: `preserved-capacity-${preserved.index + 1}`,
      text: preserved.value,
      section: "preserved_capacity",
      caseFieldIds: [`chatContext.preservedCapacities[${preserved.index}]`],
    })
  }
  const counterEvidence = firstTopicMatch(context.chatContext.counterEvidence, tokens)
  if (counterEvidence) {
    return createDnaV3CaseUnit({
      id: `counter-evidence-${counterEvidence.index + 1}`,
      text: counterEvidence.value,
      section: "preserved_capacity",
      caseFieldIds: [`chatContext.counterEvidence[${counterEvidence.index}]`],
    })
  }
  return createDnaV3CaseUnit({
    id: "preserved-capacity-not-recorded",
    text: CASE_CAPACITY_NOT_RECORDED_TR,
    section: "preserved_capacity",
    caseFieldIds: ["chatContext.preservedCapacities", "chatContext.counterEvidence"],
  })
}

function caseUnitsMatchContext(
  context: DnaChatSafeCaseContext,
  units: readonly DnaV3AnswerUnit[],
): boolean {
  const fallbackTexts = new Set<string>([
    CASE_FINDING_NOT_RECORDED_TR,
    CASE_MISSING_DATA_NOT_RECORDED_TR,
    CASE_CAPACITY_NOT_RECORDED_TR,
  ])
  const valueForField = (fieldId: string): string | null => {
    if (fieldId === "chatContext.primaryAxis") return context.chatContext.primaryAxis
    const match = /^chatContext\.(evidence|limitations|preservedCapacities|counterEvidence)\[(\d+)\]$/.exec(fieldId)
    if (!match) return null
    const values = context.chatContext[match[1] as "evidence" | "limitations" | "preservedCapacities" | "counterEvidence"]
    return values[Number(match[2])] ?? null
  }
  return units.every((unit) => {
    if (unit.authority !== "case_report") return true
    if (fallbackTexts.has(unit.text)) return true
    return unit.caseFieldIds.length === 1 && valueForField(unit.caseFieldIds[0]!) === unit.text
  })
}

type BoundCaseRow = Readonly<{
  id: string
  text: string
  fieldId: string
  section: "case_finding" | "case_missing" | "preserved_capacity"
}>

function indexedCaseRows(
  values: readonly string[],
  field: "evidence" | "limitations" | "preservedCapacities" | "counterEvidence",
  section: BoundCaseRow["section"],
): BoundCaseRow[] {
  return values.map((text, index) => Object.freeze({
    id: `${field}-${index + 1}`,
    text,
    fieldId: `chatContext.${field}[${index}]`,
    section,
  }))
}

function boundedCaseRows(
  question: string,
  context: DnaChatSafeCaseContext,
  maxRows: number,
): readonly BoundCaseRow[] {
  const normalized = normalizeDnaChatText(question)
  const primary = context.chatContext.primaryAxis
    ? [Object.freeze({
        id: "primary-axis",
        text: context.chatContext.primaryAxis,
        fieldId: "chatContext.primaryAxis",
        section: "case_finding" as const,
      })]
    : []
  const evidence = indexedCaseRows(
    context.chatContext.evidence,
    "evidence",
    "case_finding",
  )
  const limitations = indexedCaseRows(
    context.chatContext.limitations,
    "limitations",
    "case_missing",
  )
  const preserved = indexedCaseRows(
    context.chatContext.preservedCapacities,
    "preservedCapacities",
    "preserved_capacity",
  )
  const counter = indexedCaseRows(
    context.chatContext.counterEvidence,
    "counterEvidence",
    "preserved_capacity",
  )
  const asksLimitations = /\b(?:eksik|eksiklik|sinir|sinirlilik|veri yok|raporda yok)\w*\b/.test(normalized)
  const asksPreserved = /\b(?:korunmus|kapasite|guclu|guc)\w*\b/.test(normalized)
  const asksCounter = /\b(?:karsi kanit|karsi bulgu|celiski)\w*\b/.test(normalized)
  const asksPrimary = /\b(?:ana eksen|birincil eksen)\w*\b/.test(normalized)

  let material: readonly BoundCaseRow[]
  if (asksLimitations) material = limitations
  else if (asksPreserved) material = preserved
  else if (asksCounter) material = counter
  else if (asksPrimary) material = [...primary, ...evidence]
  else material = [...primary, ...evidence, ...preserved, ...counter]

  // A report containing only generic data-limit statements has no material
  // case finding to summarize. Explicit limitation questions may still return
  // the exact recorded limitation rows.
  if (!material.length) return Object.freeze([])
  const rows = asksLimitations
    ? material
    : [...material, ...limitations.slice(0, 1)]
  const unique = [...new Map(rows.map((row) => [`${row.fieldId}\u0000${row.text}`, row])).values()]
  return Object.freeze(unique.slice(0, maxRows))
}

function caseOnlySections(units: readonly DnaV3AnswerUnit[]): readonly DnaV3AnswerSection[] {
  const titles: Readonly<Record<DnaV3AnswerSection["kind"], string>> = Object.freeze({
    definition: "Tanım",
    function_or_relation: "İşlev, mekanizma veya ilişki",
    development: "Gelişim",
    measurement: "Ölçüm",
    evidence_status: "Kanıt durumu",
    counter_evidence: "Karşı kanıt ve sınırlar",
    dna_boundary: "DNA ilişkisinin sınırı",
    case_context: "Vaka bağlamı",
    case_finding: "Raporda bulunan bulgu",
    case_missing: "Raporda bulunmayan veya eksik veri",
    general_literature: "Genel literatür",
    case_non_inference: "Bu vaka için çıkarılamayacak sonuç",
    preserved_capacity: "Korunmuş kapasite veya karşı kanıt",
    boundary: "Kanıt ve yorum sınırları",
  })
  const orderedKinds = [...new Set(units.map((unit) => unit.section))]
  return Object.freeze(orderedKinds.map((kind) => Object.freeze({
    kind,
    titleTr: titles[kind],
    unitIds: Object.freeze(units.filter((unit) => unit.section === kind).map((unit) => unit.id)),
  })))
}

/**
 * Builds a case-only response solely from identity-authorized, enumerated
 * `chatContext` fields. No snapshot prose, anamnesis, raw answer, trace or
 * unbound template finding can enter a material case unit.
 */
export function assembleDnaV3CaseOnlyAnswer(input: Readonly<{
  question: string
  context: DnaChatSafeCaseContext
  responseDepth: DnaV3RetrievalAnswer["responseDepth"]
  pkg: DnaV3RetrievalPackage
}>): DnaV3RetrievalAnswer | null {
  if (!hasVerifiedReportAuthority(input.context)) return null
  const maxRows = input.responseDepth === "short" ? 2 : input.responseDepth === "deep" ? 10 : 6
  const rows = boundedCaseRows(input.question, input.context, maxRows)
  if (!rows.length) return null
  const caseUnits = rows.map((row) => createDnaV3CaseUnit({
    id: `case-only-${row.id}`,
    text: row.text,
    section: row.section,
    caseFieldIds: [row.fieldId],
  }))
  if (caseUnits.some((unit) => evaluateClaimGuard(unit.text)
    .some((issue) => issue.severity === "critical"))) return null
  const boundary = createDnaV3PolicyUnit({
    id: "case-only-boundary",
    text: DNA_V3_CASE_ONLY_BOUNDARY_TR,
    section: "boundary",
  })
  const units = Object.freeze([...caseUnits, boundary])
  if (!caseUnitsMatchContext(input.context, units)) return null
  const summary = caseUnits[0]!.text
  const limitations = Object.freeze(caseUnits
    .filter((unit) => unit.section === "case_missing")
    .map((unit) => unit.text))
  const details = Object.freeze(caseUnits.slice(1)
    .filter((unit) => unit.section !== "case_missing")
    .map((unit) => unit.text))
  const bindingErrors = validateDnaV3AnswerEvidence({
    summary,
    details,
    limitations,
    units,
    sources: [],
    pkg: input.pkg,
  })
  if (bindingErrors.length) return null

  return Object.freeze({
    retrievalVersion: "dna-v3-retrieval@1",
    engineVersion: "dna-chat-engine@3",
    status: "answer",
    classification: "case_finding",
    intent: "case",
    queryKind: "case_finding",
    responseDepth: input.responseDepth,
    topic: null,
    summary,
    details,
    sources: Object.freeze([]),
    limitations,
    safetyBoundary: DNA_V3_CASE_ONLY_BOUNDARY_TR,
    suggestedQuestions: Object.freeze([
      "Bu rapordaki veri sınırlılıkları neler?",
      "Bu rapordaki korunmuş kapasiteleri özetle.",
      "Bu rapordaki karşı kanıtları özetle.",
    ]),
    evidenceSummary: null,
    answerUnits: units,
    sections: caseOnlySections(units),
    confidenceBand: "high",
  })
}

/** Offline evaluation hook; it validates only canonical case-unit fidelity. */
export function doesDnaV3CaseAnswerMatchContext(
  context: DnaChatSafeCaseContext,
  answer: Pick<DnaV3RetrievalAnswer, "answerUnits">,
): boolean {
  return caseUnitsMatchContext(context, answer.answerUnits)
}

function mixedSections(units: readonly DnaV3AnswerUnit[]): readonly DnaV3AnswerSection[] {
  const rows: ReadonlyArray<readonly [DnaV3AnswerSection["kind"], string]> = [
    ["case_finding", "Raporda bulunan bulgu"],
    ["case_missing", "Raporda bulunmayan veya eksik veri"],
    ["general_literature", "Genel literatür"],
    ["case_non_inference", "Bu vaka için çıkarılamayacak sonuç"],
    ["preserved_capacity", "Korunmuş kapasite veya karşı kanıt"],
    ["boundary", "Kanıt ve yorum sınırları"],
  ]
  return Object.freeze(rows.map(([kind, titleTr]) => Object.freeze({
    kind,
    titleTr,
    unitIds: Object.freeze(units.filter((unit) => unit.section === kind).map((unit) => unit.id)),
  })))
}

/**
 * Combines an already validated V3 theory answer with the canonical owned
 * report context. It never receives snapshot prose, anamnesis, raw answers,
 * trace, rule identifiers or internal thresholds.
 */
export function assembleDnaV3CaseTheoryAnswer(input: Readonly<{
  context: DnaChatSafeCaseContext
  theoryAnswer: DnaV3RetrievalAnswer
  pkg: DnaV3RetrievalPackage
}>): DnaV3RetrievalAnswer | null {
  if (!hasVerifiedReportAuthority(input.context) || input.theoryAnswer.status !== "answer") return null

  const tokens = topicTokens(input.theoryAnswer, input.pkg)
  const finding = caseFinding(input.context, tokens)
  const missing = missingCaseData(input.context, tokens)
  const capacity = preservedCapacity(input.context, tokens)
  const generalLiteratureUnits = input.theoryAnswer.answerUnits
    .filter((unit) => unit.authority === "external_science" || unit.authority === "dna_product")
    .filter((unit) => unit.section !== "boundary" && unit.section !== "dna_boundary")
    .filter((unit) => !input.theoryAnswer.limitations.includes(unit.text))
    .map((unit, index) => Object.freeze({
      ...unit,
      id: `case-theory::literature-${index + 1}::${unit.id}`,
      section: "general_literature" as const,
    }))
  if (!generalLiteratureUnits.length) return null

  const nonInference = createDnaV3PolicyUnit({
    id: "case-theory-biological-measurement-boundary",
    text: DNA_V3_CASE_THEORY_BOUNDARY_TR,
    section: "case_non_inference",
  })
  const theoryBoundaryUnits = input.theoryAnswer.answerUnits
    .filter((unit) => input.theoryAnswer.limitations.includes(unit.text))
    .map((unit, index) => Object.freeze({
      ...unit,
      id: `case-theory::boundary-${index + 1}::${unit.id}`,
      section: "boundary" as const,
    }))
  const units = Object.freeze([
    finding,
    missing,
    ...generalLiteratureUnits,
    nonInference,
    capacity,
    ...theoryBoundaryUnits,
  ])
  if (!caseUnitsMatchContext(input.context, units)) return null
  const summary = finding.text
  const details = Object.freeze([
    missing.text,
    ...generalLiteratureUnits.map((unit) => unit.text),
    nonInference.text,
    capacity.text,
  ])
  const limitations = Object.freeze(stableUnique(theoryBoundaryUnits.map((unit) => unit.text)))
  const bindingErrors = validateDnaV3AnswerEvidence({
    summary,
    details,
    limitations,
    units,
    sources: input.theoryAnswer.sources,
    pkg: input.pkg,
  })
  if (bindingErrors.length) return null

  return Object.freeze({
    ...input.theoryAnswer,
    status: "answer",
    classification: "case_finding",
    intent: "case_theory",
    queryKind: "case_theory",
    summary,
    details,
    limitations,
    safetyBoundary: DNA_V3_CASE_THEORY_BOUNDARY_TR,
    answerUnits: units,
    sections: mixedSections(units),
  })
}

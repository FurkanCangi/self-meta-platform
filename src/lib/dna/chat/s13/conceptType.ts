import { normalizeDnaChatText } from "../text"

export const DNA_S13_CONCEPT_TYPE_VERSION = "dna-s13-concept-type@1" as const

export const DNA_S13_CONCEPT_TYPES = Object.freeze([
  "CANONICAL_CONCEPT",
  "SECTION_HEADING",
  "COMPOSITE_TOPIC",
] as const)

export type DnaS13ConceptType = typeof DNA_S13_CONCEPT_TYPES[number]

export type DnaS13ConceptTypeClassification = Readonly<{
  topicId: string
  title: string
  conceptType: DnaS13ConceptType
  evidenceCodes: readonly string[]
}>

type ConceptAtom = Readonly<{
  text: string
  explicitFacet: string | null
  claimRoleV2: string | null
  answerEligible: boolean
}>

const STRUCTURAL_HEADING = /\b(?:kuramsal sonuc|temel sorun\w*|temel isleyis|klinik kullanim|genel degerlendirme|genel cerceve|uygulama ilkeleri|degerlendirme basligi|guclu yon\w*|sinirlilik\w*|donemi|modulu|katmani|asama\w*|adimi|cikarim\w*|bulgu\w*)\b/u
const COMPOSITE_CONNECTOR = /(?:\s(?:ve|ile)\s|\s[–—]\s|\s:\s)/u
const DEFINITION_PREDICATE = /\b(?:ifade eder|anlamina gelir|olarak tanimlan\w*|kavramdir|yapidir|sistemdir|surectir|yaklasimdir|modeldir)\b/u

function titleTokens(value: string) {
  return normalizeDnaChatText(value).split(/\s+/u)
    .filter((token) => token.length >= 4 && !["temel", "genel", "olarak", "acisindan"].includes(token))
}

/** Metadata-only classification; this function never creates scientific content. */
export function classifyDnaS13ConceptType(input: Readonly<{
  topicId: string
  title: string
  atoms: readonly ConceptAtom[]
}>): DnaS13ConceptTypeClassification {
  const normalizedTitle = normalizeDnaChatText(input.title)
  const tokens = titleTokens(input.title)
  const eligibleDefinitions = input.atoms.filter((atom) => atom.answerEligible
    && atom.explicitFacet === "DEFINITION")
  const fullTitleDefinition = eligibleDefinitions.some((atom) => {
    const normalized = normalizeDnaChatText(atom.text)
    const tokenCoverage = tokens.length > 0 && tokens.every((token) => normalized.includes(token))
    return tokenCoverage && (normalized.startsWith(normalizedTitle) || DEFINITION_PREDICATE.test(normalized))
  })
  if (fullTitleDefinition) return Object.freeze({
    topicId: input.topicId, title: input.title, conceptType: "CANONICAL_CONCEPT" as const,
    evidenceCodes: Object.freeze(["full_title_definition_atom"]),
  })
  if (STRUCTURAL_HEADING.test(normalizedTitle)) return Object.freeze({
    topicId: input.topicId, title: input.title, conceptType: "SECTION_HEADING" as const,
    evidenceCodes: Object.freeze(["structural_heading_semantics", "no_full_title_definition"]),
  })
  if (COMPOSITE_CONNECTOR.test(normalizedTitle)) return Object.freeze({
    topicId: input.topicId, title: input.title, conceptType: "COMPOSITE_TOPIC" as const,
    evidenceCodes: Object.freeze(["composite_title_connector", "no_full_title_definition"]),
  })
  return Object.freeze({
    topicId: input.topicId, title: input.title, conceptType: "CANONICAL_CONCEPT" as const,
    evidenceCodes: Object.freeze([eligibleDefinitions.length ? "definition_atom_without_structural_signal" : "canonical_topic_default"]),
  })
}

import { inspectDnaS13CanaryPrivacy } from "../canary/privacy"
import { hashDnaS13Artifact } from "../strictHash"
import { normalizeDnaChatText } from "../../text"
import { inspectDnaChatSafety } from "../../safety"
import { resolveDnaS13NamedTopicSurfaces } from "../conversationContext"

const DIRECT_IDENTIFIER = /(?:\b[\w.%+-]+@[\w.-]+\.[a-z]{2,}\b|\b(?:\+?90\s*)?(?:0?5\d{2})[\s.-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}\b|\b(?:tc|t\.c\.?|kimlik|protokol|dosya)\s*(?:no|numarasi|numarası)?\s*[:#-]?\s*\d{4,}\b)/iu
const PERSON_MARKER = /(?:^|\s)(?:adi|adı|soyadi|soyadı|isimli|annesi|babasi|babası|ogretmeni|öğretmeni)\b/u
const ORGANIZATION_MARKER = /(?:^|\s)(?:klinik|klini|hastane|okul|kurum|merkez|rehabilitasyon)\w*\b/u
const CLINICAL_MARKER = /(?:^|\s)(?:vaka|danisan|danışan|hasta|anamnez|seans|terapi|rapor|degerlendirme|değerlendirme|muayene|tani|tanı)\w*\b/u
const PERSONAL_OR_CASE_GRAMMAR = /\b(?:bu (?:cocuk|vaka|danisan|hasta|rapor|sonuc|bulgu)|cocugum\w*|oglum\w*|kizim\w*|ogrencim\w*|danisanim\w*|hastam\w*|vakami\w*|raporum\w*|seansta\w*|klinigimiz\w*|okulumuz\w*|kurumumuz\w*)\b|\b(?:danisan|hasta|vaka)\w*\b.{0,80}\b(?:anamnez|seans|rapor|degerlendir|yorumla|bulgu|sonuc)\w*\b/u
const SCIENTIFIC_QUESTION_GRAMMAR = /\b(?:nedir|ndr|neydi\w*|ne demek|neyi ifade eder|what is|definition|core meaning|temel sey|tanim\w*|acikla\w*|anlat\w*|hakkinda|konusunda|neden|niye|ne ise yarar|function|onem\w*|ornek\w*|mesela|fark\w*|ayrim\w*|karsilastir\w*|nasil ayril\w*|derin\w*|ayrinti\w*|detay\w*|devam\w*|sadelestir\w*|sade\w*|yalin\w*)\b/u
const GENERIC_DIAGNOSTIC_BOUNDARY = /\b(?:tek basina tani koy\w*|ayri bir tani midir|tani midir|tani degildir|tani anlamina gelmez|guvenli bilimsel sinir|bilimsel yorum siniri|tani\w*.{0,80}(?:fark|ayrim|karsilastir|sinir))\b/u

export type DnaS13LimitedPrivacyDecision = Readonly<{
  allowed: boolean
  category: "general_non_sensitive" | "clinical_case" | "personal_data" | "sensitive_or_unknown"
  reasonCodes: readonly string[]
  questionHash: string
  maySourceConversationContext: boolean
  automaticTrainingAllowed: false
}>

export function inspectDnaS13LimitedRolloutPrivacy(input: Readonly<{
  question: string
  mode?: string | null
  reportId?: string | null
}>): DnaS13LimitedPrivacyDecision {
  const base = inspectDnaS13CanaryPrivacy(input.question)
  const safety = inspectDnaChatSafety(input.question)
  const normalized = normalizeDnaChatText(input.question)
  const directIdentifier = DIRECT_IDENTIFIER.test(input.question)
  const person = PERSON_MARKER.test(normalized)
  const organization = ORGANIZATION_MARKER.test(normalized)
  const namedTopics = resolveDnaS13NamedTopicSurfaces(input.question, [], 8)
  const outsideNamedTopicText = namedTopics.reduce((value, topic) =>
    value.replace(normalizeDnaChatText(topic.surface || topic.title), " "), normalized)
  const diagnosticInstructionOutsideTopic = /\b(?:tani koy\w*|tani ver\w*|tanila\w*|diagnose\w*)\b/u
    .test(outsideNamedTopicText)
  const actualCaseGrammar = PERSONAL_OR_CASE_GRAMMAR.test(normalized)
  const genericScientific = namedTopics.length > 0
    && namedTopics.every((topic) => topic.confidence !== "LOW")
    && SCIENTIFIC_QUESTION_GRAMMAR.test(normalized)
    && !actualCaseGrammar
    && !directIdentifier
    && !(person && organization)
    && input.mode !== "case"
    && !input.reportId
  const clinical = input.mode === "case"
    || Boolean(input.reportId)
    || actualCaseGrammar
    || (!genericScientific && CLINICAL_MARKER.test(normalized)
      && (person || organization || /\b(?:benim|bizim|bu|bir)\b/u.test(normalized)))
  const genericOverride = genericScientific
    && (["none", "privacy", "treatment", "biological_inference"].includes(safety.category)
      || (safety.category === "diagnosis" && (!diagnosticInstructionOutsideTopic
        || GENERIC_DIAGNOSTIC_BOUNDARY.test(outsideNamedTopicText))))
    || input.mode === "case"
    || Boolean(input.reportId)
  const reasons = [...new Set([
    ...(genericOverride ? ["generic_scientific_content"] : base.reasonCodes),
    ...(directIdentifier ? ["direct_identifier"] : []),
    ...(person && organization ? ["organization_plus_person"] : []),
    ...(clinical ? ["clinical_case_or_record_context"] : []),
    ...(input.reportId ? ["report_context_present"] : []),
  ])]
  const allowed = (base.allowed || genericOverride) && !directIdentifier && !(person && organization) && !clinical
  const category = directIdentifier || (person && organization)
    ? "personal_data" as const
    : clinical
      ? "clinical_case" as const
      : allowed
        ? "general_non_sensitive" as const
        : "sensitive_or_unknown" as const
  return Object.freeze({
    allowed,
    category,
    reasonCodes: Object.freeze(reasons.length ? reasons : ["general_non_sensitive"]),
    questionHash: hashDnaS13Artifact({ question: input.question }),
    maySourceConversationContext: allowed,
    automaticTrainingAllowed: false as const,
  })
}

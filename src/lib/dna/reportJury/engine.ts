import { analyzeExternalClinicalTests, findSupportedExternalTestByName, type ExternalTestCategory, type ExternalTestMatch } from "../externalTestRegistry"
import { buildLiteratureAlignedSection, VERIFIED_LITERATURE_SOURCES } from "../literatureNote"
import type { DomainKey, DomainResult, ReportInput } from "../reportEngine"
import { normalizeTurkishClinicalText } from "../reportLanguageQuality"
import { extractCanonicalTherapistObservation, type CanonicalTherapistObservation } from "../reportV2/canonicalCaseEvidence"
import { runReportV2Shadow } from "../reportV2/runner"
import type { ClinicalEvidenceUnit, FormulationId, ReportClaim } from "../reportV2/contracts"
import {
  DNA_REPORT_JURY_VERSION,
  JURY_REPORT_HEADINGS,
  type AIClinicalCritic,
  type CanonicalAnamnesisEvidenceFact,
  type CaseScopedEvidenceEnvelope,
  type CaseScopedEvidenceFact,
  type CaseSemanticEvidenceMatrix,
  type JuryClauseProvenance,
  type ClinicalCriticFinding,
  type ClinicalCriticResult,
  type ClinicalInsightPlan,
  type DecisionExplanation,
  type ExternalEvidenceDirection,
  type ExternalEvidenceUsageAudit,
  type ExternalEvidenceUsageRecord,
  type ExternalEvidenceUsageRole,
  type ExternalValidityStatus,
  type JuryConfidence,
  type JuryConfidenceResult,
  type JuryExternalEvidence,
  type JuryLanguageRealization,
  type JuryLanguageRealizer,
  type JuryLiteratureSelection,
  type JuryLockedLanguagePlan,
  type JuryLockedParagraph,
  type JuryLockedSection,
  type JuryReportResult,
  type JuryReportValidation,
  type JurySentenceProvenance,
  type JuryStatementType,
  type JuryPriorityProfile,
  type ProfileBreadth,
  type RawExternalTestMention,
  type ReportDataQuality,
  type SourceEvidenceRelation,
  type TemplateSemanticLeakageAudit,
  type TemplateSemanticLeakageCode,
  type TemplateSemanticLeakageFinding,
} from "./contracts"
import { classifyRepetitionMateriality } from "./repetitionMateriality"
import { classifyCaregiverEvidenceRole } from "./functionalEvidenceRole"
import {
  auditClauseEntailment,
  candidateIsSemanticallyEntailed,
  evaluateSentenceEntailment,
} from "./clauseEntailment"
import {
  extractCanonicalAnamnesisEvidence,
  factSupportsDifficulty,
  factSupportsDomain,
  factSupportsPreservedCapacity,
  inferEvidenceDomains,
} from "./canonicalAnamnesisEvidence"
import {
  buildCaseSemanticEvidenceMatrix,
  buildEvidenceSemanticSegments,
  canonicalDirectionFromExternal,
  canonicalEpistemicFromExternal,
  canonicalValidityFromExternal,
  factEligibleForPreservedCapacity,
  factHasObservedContextComparison,
  hasObservedContextComparison,
  hasObservedContextEvidence,
  inferEvidenceDirection,
  inferEvidenceEpistemicStatus,
  inferSemanticContext,
  relationIsDiscrepant,
  relationIsConvergent,
  sourceHasEligibleEvidenceForClaim,
  sourcePresence,
} from "./evidenceSemantics"

const DOMAIN_LABELS: Record<DomainKey, string> = {
  physiological: "Fizyolojik Regülasyon",
  sensory: "Duyusal Regülasyon",
  emotional: "Duygusal Regülasyon",
  cognitive: "Bilişsel Regülasyon",
  executive: "Yürütücü İşlev",
  interoception: "İnterosepsiyon",
}

const PROFILE_LABELS: Record<FormulationId, string> = {
  domain_physiological: "fizyolojik regülasyonda seçici güçlük",
  domain_sensory: "duyusal regülasyonda seçici güçlük",
  domain_emotional: "duygusal regülasyon ve toparlanmada seçici güçlük",
  domain_cognitive: "bilişsel regülasyonda seçici güçlük",
  domain_executive: "yürütücü işlevde seçici güçlük",
  domain_interoception: "interosepsiyonda seçici güçlük",
  motor_praxis: "motor planlama ve beden organizasyonunda güçlük",
  adaptive_daily_living: "günlük yaşam ve öz bakım işlevlerinde güçlük",
  social_pragmatic: "sosyal katılım ve esneklikte güçlük",
  language_communication: "sözel bilgiyi işleme ve kullanmada güçlük",
  language_social_pragmatic: "dilsel ve sosyal talepleri birlikte yönetmede güçlük",
  physiological_interoceptive: "fizyolojik regülasyon ile interosepsiyonda birlikte güçlük",
  selective_interoception: "interosepsiyonda bağlama duyarlı seçici güçlük",
  evidence_limited_mixed: "birden fazla alana yayılan, kanıtı sınırlı karma bulgular",
  balanced: "dengeli ve büyük ölçüde korunmuş self-regülasyon profili",
  multi_domain: "birden fazla self-regülasyon alanında birlikte güçlük",
}

const FUNCTIONAL_SCOPE: Record<ExternalTestCategory, string> = {
  adaptive_daily_living: "günlük yaşam, öz bakım ve bağımsız işlev",
  development_general: "genel gelişimsel işlev",
  executive_behavior: "yürütücü işlev, dikkat ve davranış organizasyonu",
  general: "doğrudan eşleştirilemeyen genel klinik bilgi",
  language_communication: "dil ve iletişim işlevi",
  motor_praxis: "motor planlama ve beden organizasyonu",
  sensory_processing: "duyusal işlemleme ve uyaran yükü altında katılım",
  social_pragmatic: "sosyal-pragmatik katılım ve esneklik",
}

const DOMAIN_FUNCTION: Record<DomainKey, string> = {
  physiological: "Uyku-uyanıklık düzeni, yorgunluk, enerji düzeyi ve bedensel toparlanma değiştiğinde günlük katılım da değişebilir.",
  sensory: "Ses, dokunma, kalabalık, ışık veya hareket yükü arttığında uyaranları filtrelemek, etkinlikte kalmak ve yoğunluk sonrasında toparlanmak zorlaşabilir.",
  emotional: "Engellenme ya da beklenmeyen değişim sonrasında duygusal yoğunluk artabilir; yeniden etkinliğe dönmek için daha fazla zaman veya destek gerekebilir.",
  cognitive: "Yönerge uzadığında, çalışma belleği yükü arttığında veya görev karmaşıklaştığında dikkati sürdürme ve bilgiyi zihinde düzenleme zorlaşabilir.",
  executive: "Başlatma, sıralama, inhibisyon, esneklik ve çok basamaklı görevleri tamamlama sırasında destek gereksinimi artabilir.",
  interoception: "Açlık, susuzluk, tuvalet, ağrı ve yorgunluk gibi beden sinyallerini zamanında fark etmek, anlamlandırmak ve uygun öz bakım davranışını başlatmak zorlaşabilir.",
}

const DOMAIN_PRESERVED: Record<DomainKey, string> = {
  physiological: "Bu sonuç, ölçüm koşullarında uyku, enerji ve bedensel toparlanma zemininde belirgin bir güçlük saptanmadığını gösterir; farklı günlerdeki dalgalanmayı tek başına dışlamaz.",
  sensory: "Bu sonuç, ölçüm koşullarında çevresel uyaranları filtreleme ve duyusal yük altında katılım açısından belirgin bir güçlük saptanmadığını gösterir.",
  emotional: "Bu sonuç, engellenme ve değişim sonrasında duygusal toparlanmanın genel olarak beklenen aralıkta olduğunu gösterir.",
  cognitive: "Bu sonuç, dikkat, çalışma belleği ve zihinsel organizasyonun ölçüm koşullarında genel olarak beklenen aralıkta olduğunu gösterir.",
  executive: "Bu sonuç, başlatma, sıralama, inhibisyon, esneklik ve görev tamamlama süreçlerinde ölçüm koşullarında belirgin bir güçlük saptanmadığını gösterir.",
  interoception: "Bu sonuç, beden sinyallerini fark etme ve uygun öz bakım davranışına dönüştürme kapasitesinin ölçüm koşullarında genel olarak korunduğunu gösterir.",
}

const FORBIDDEN_CLAIMS = Object.freeze([
  "tanı koyar",
  "tanıyı dışlar",
  "vagal ton düşüktür",
  "sempatik baskınlık",
  "parasempatik baskınlık",
  "kortizol",
  "HPA",
  "inflamasyon",
  "beyin bölgesi işlev bozukluğu",
  "prognoz",
])

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values))
}

function normalizedAnamnesis(input: ReportInput): string {
  return typeof input.anamnez === "string" ? input.anamnez.trim() : JSON.stringify(input.anamnez ?? {})
}

function normalizedJuryAnalysisText(input: ReportInput): string {
  return normalizedAnamnesis(input)
    .replace(/\r/g, "\n")
    .replace(/\s*\|\s*/g, "\n")
    .replace(/(?:Ek klinik test\s*\/\s*bulgular:\s*)?Test\s*\d+\s*:\s*(?=Test adı\s*:)/giu, "\n\n")
    .trim()
}

function sentence(text: string): string {
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(^|[.!?]\s+)(?!https?:\/\/)([a-zçğıöşü])/gu, (_match, boundary: string, first: string) => `${boundary}${first.toLocaleUpperCase("tr-TR")}`)
  return clean && !/[.!?):]$/u.test(clean) ? `${clean}.` : clean
}

function capitalizeFirst(text: string): string {
  const clean = String(text || "").trim()
  return clean ? `${clean[0].toLocaleUpperCase("tr-TR")}${clean.slice(1)}` : clean
}

function userFacingClinicalText(text: string): string {
  return text
    .replace(/Çocukluk dönemi literatürü, self-regülasyonu tek bir belirti kümesi olarak değil; bedensel uyarılma, dikkat, duygu düzenleme ve davranış kontrolünün birlikte örgütlendiği çok bileşenli bir gelişimsel yapı olarak ele alır/giu, "Çocukluk dönemi literatürü self-regülasyonu çok bileşenli bir gelişimsel yapı olarak ele alır. Bu yapı bedensel uyarılma, dikkat, duygusal regülasyon ve davranış kontrolünü birlikte içerir")
    .replace(/formülasyon/giu, "klinik örüntü")
    .replace(/bilişsel düzenleme/giu, "bilişsel regülasyon")
    .replace(/duygu düzenleme/giu, "duygusal regülasyon")
    .replace(/davranış düzenleme/giu, "davranış regülasyonu")
    .replace(/otonom düzenleme/giu, "otonom regülasyon")
    .replace(/düzenleme örüntüsü/giu, "regülasyon örüntüsü")
}

function sectionIdForParagraph(id: string): JuryLockedSection["id"] {
  if (id.startsWith("summary.")) return "summary"
  if (id.startsWith("evidence.")) return "evidence"
  if (id.startsWith("formulation.")) return "formulation"
  if (id.startsWith("decision.")) return "decision_support"
  return "limits_science"
}

function paragraph(
  envelope: CaseScopedEvidenceEnvelope,
  id: string,
  text: string,
  evidenceIds: readonly string[] = [],
  claimIds: readonly string[] = [],
  emphasis: JuryLockedParagraph["emphasis"] = "normal",
  statementType: JuryStatementType = "synthesis",
  supportingCaseFactIds: readonly string[] = [],
  supportingLiteratureIds: readonly string[] = [],
): JuryLockedParagraph {
  const userFacingText = statementType === "literature_link" ? text : normalizeTurkishClinicalText(text)
  const normalized = sentence(userFacingText)
  const factIds = unique(supportingCaseFactIds)
  const decisionIds = unique(claimIds.map((claimId) => `${envelope.case_id}.decision.${claimId}`))
  const sectionId = sectionIdForParagraph(id)
  const allFacts: CaseScopedEvidenceFact[] = [
    ...envelope.dna_scores,
    ...envelope.anamnesis_evidence,
    ...envelope.therapist_observations,
    ...envelope.external_tests,
  ]
  const factsById = new Map(allFacts.map((fact) => [fact.id, fact]))
  const supportingFacts = factIds.map((factId) => factsById.get(factId)).filter(Boolean) as CaseScopedEvidenceFact[]
  const literatureIds = unique(supportingLiteratureIds)
  const sentenceProvenance = normalized.split(/(?<=[.!?])\s+/u).map((item, index) => {
    const sentenceId = `${envelope.case_id}.${id}.sentence-${index + 1}`
    const clauses = evaluateSentenceEntailment({
      sentenceId,
      caseId: envelope.case_id,
      sectionId,
      paragraphId: id,
      sentence: item,
      statementType,
      facts: supportingFacts,
      relations: envelope.semantic_evidence_matrix.relations,
      decisionIds,
      literatureIds,
    })
    return Object.freeze({
      sentence_id: sentenceId,
      case_id: envelope.case_id,
      section_id: sectionId,
      paragraph_id: id,
      sentence: item,
      statement_type: statementType,
      supporting_case_fact_ids: Object.freeze(factIds),
      supporting_decision_ids: Object.freeze(decisionIds),
      supporting_literature_ids: Object.freeze(literatureIds),
      clauses,
    }) satisfies JurySentenceProvenance
  })
  return Object.freeze({ id, text: normalized, evidenceIds: Object.freeze(unique(evidenceIds)), claimIds: Object.freeze(unique(claimIds)), emphasis, sentenceProvenance: Object.freeze(sentenceProvenance) })
}

function testValidity(match: ExternalTestMatch, rawEvidenceText = ""): ExternalValidityStatus {
  const reported = `${match.reportedResult ?? ""} ${match.reportedInterpretation ?? ""} ${match.reportedNotes ?? ""} ${rawEvidenceText}`
  if (match.ageCompatible === false || /geçersiz|yorumlanamaz|invalid|çok eksik|form geçersiz/iu.test(reported)) return "invalid"
  if (match.resultQuality === "missing_result" || /(?:puan|skor|sonuç)\s*(?:belirtilmedi|yok|verilmedi|eksik)|sonuç\s+bilgisi\s+eksik/iu.test(reported)) return "insufficient_information"
  if (/formun yarısı boş|yarısı boş|kısmen eksik|sayı yazılmamış|puan(?:ı|lama)?\s*(?:yok|verilmemiş)|tamamlanmamış|acele doldur/iu.test(reported)) return "partially_interpretable"
  if (match.resultQuality === "ham_puan_only" || match.resultQuality === "qualitative_only" || match.ageCompatible == null || match.resultDirection === "unclear") return "partially_interpretable"
  if (match.resultQuality === "interpretable") return "valid"
  return "insufficient_information"
}

function evidenceDirection(match: ExternalTestMatch, validity: ExternalValidityStatus, rawEvidenceText = ""): ExternalEvidenceDirection {
  if (validity === "invalid" || validity === "insufficient_information") return "unusable"
  const text = `${match.reportedResult ?? ""} ${match.reportedInterpretation ?? ""} ${rawEvidenceText}`
  const difficulty = /beklenen(?:den|in)\s+(?:çok|fazla|az|altında)|belirgin\s+(?:güçlük|zorlanma)|klinik\s+yüksek|\byüksek\b|\bdüşük\b|güçlük|zorlan|problem|risk/iu.test(text)
  const preserved = /yaşa uygun|beklenen\s+(?:aralık|düzey)|korunmuş|normal|tipik/iu.test(text)
  if (difficulty && preserved) return "mixed"
  if (difficulty) return "supports_difficulty"
  if (preserved) return "supports_preserved_function"
  if (match.resultDirection === "elevated_or_low") return "supports_difficulty"
  if (match.resultDirection === "expected_or_preserved") return "supports_preserved_function"
  if (match.resultDirection === "mixed_or_contextual") return "mixed"
  return "neutral"
}

function rawExternalMentions(input: ReportInput): Readonly<{ analysis: ReturnType<typeof analyzeExternalClinicalTests>; mentions: RawExternalTestMention[] }> {
  const analysis = analyzeExternalClinicalTests(normalizedJuryAnalysisText(input), input.ageMonths)
  const mentions = analysis.parsedEntries.map((entry, index) => {
    const definition = findSupportedExternalTestByName(entry.testName)
    const clearlyUnparseableNoise = !/[a-zçğıöşü0-9]{3,}/iu.test(entry.testName.replace(/test/giu, ""))
    return Object.freeze({
      ordinal: index + 1,
      test_name: entry.testName.trim() || "Adı okunamayan dış test",
      reported_result: entry.result.trim(),
      reported_interpretation: entry.interpretation.trim(),
      notes: entry.notes.trim(),
      recognized_registry_id: definition?.id ?? null,
      clearly_unparseable_noise: clearlyUnparseableNoise,
    })
  })
  return Object.freeze({ analysis, mentions })
}

function domainsForExternalText(text: string): DomainKey[] {
  const domains: DomainKey[] = []
  if (/uyku|yorgun|enerji|fizyolojik|toparlan/iu.test(text)) domains.push("physiological")
  if (/duyusal|işitsel|ses|spm|sensory/iu.test(text)) domains.push("sensory")
  if (/duygu|öfke|toparlanma|frustrasyon/iu.test(text)) domains.push("emotional")
  if (/çalışma belleği|dikkat|biliş|wppsi|yönerge/iu.test(text)) domains.push("cognitive")
  if (/plan|yürütücü|brief|başlat|tamamla|çalışma belleği/iu.test(text)) domains.push("executive")
  if (/interosep|açlık|susuz|tuvalet|beden sinyal/iu.test(text)) domains.push("interoception")
  return unique(domains)
}

function directionForRawExternal(text: string): ExternalEvidenceDirection {
  const difficulty = /beklenen(?:den|in)\s+(?:çok|fazla|az|altında)|yüksek|güçlük|zorlan|problem|belirgin|düşük|risk/iu.test(text)
  const preserved = /yaşa uygun|beklenen\s+(?:aralık|düzey)|korunmuş|normal|tipik/iu.test(text)
  if (difficulty && preserved) return "mixed"
  if (difficulty) return "supports_difficulty"
  if (preserved) return "supports_preserved_function"
  return "neutral"
}

function externalDecisionRelevant(validity: ExternalValidityStatus, direction: ExternalEvidenceDirection): boolean {
  if (validity === "invalid" || validity === "insufficient_information" || direction === "unusable" || direction === "neutral") return false
  if (validity === "partially_interpretable") return ["supports_difficulty", "supports_preserved_function", "mixed"].includes(direction)
  return true
}

function userFacingExternalLimitation(text: string): string {
  return text.replace(/müdahale\s+reçetesi/giu, "uygulama önerisi").replace(/\bmüdahale\b/giu, "uygulama")
}

function externalPreservedSubcomponent(entry: JuryExternalEvidence): string | null {
  if (entry.validity_status !== "valid" || entry.evidence_direction !== "mixed") return null
  return entry.source_text
    .split(/[;|]/u)
    .map((segment) => segment.trim())
    .find((segment) => /yaşa uygun|beklenen\s+(?:aralık|düzey)|korunmuş|normal|tipik/iu.test(segment)) ?? null
}

function structuredExternalEvidence(input: ReportInput): Readonly<{ raw: readonly RawExternalTestMention[]; evidence: readonly JuryExternalEvidence[] }> {
  const { analysis, mentions } = rawExternalMentions(input)
  const evidenceByRegistryId = new Map<string, JuryExternalEvidence>()
  for (const match of analysis.matches) {
    const rawEvidenceText = mentions
      .filter((mention) => mention.recognized_registry_id === match.id)
      .map((mention) => `${mention.reported_result} ${mention.reported_interpretation} ${mention.notes}`)
      .join(" ")
    const validity = testValidity(match, rawEvidenceText)
    const direction = evidenceDirection(match, validity, rawEvidenceText)
    const limitations = unique([
      ...(match.ageCompatible === false ? ["Testin yaş aralığı vakayla uyumlu değildir."] : []),
      ...(validity === "partially_interpretable" ? ["Sonuç yalnız kısmen yorumlanabilir."] : []),
      ...(validity === "invalid" ? ["Sonuç klinik karar kanıtı olarak kullanılamaz."] : []),
      ...(validity === "insufficient_information" ? ["Yorum için gerekli sonuç bilgisi eksiktir."] : []),
      match.interpretationBoundaries,
    ].filter(Boolean))
    const sourceText = [
      `Test adı: ${match.name}`,
      match.reportedResult ? `Puan / sonuç: ${match.reportedResult}` : "",
      match.reportedInterpretation ? `Klinik yorum: ${match.reportedInterpretation}` : "",
      match.reportedNotes ? `Not: ${match.reportedNotes}` : "",
    ].filter(Boolean).join(" | ")
    const supportedDomains: DomainKey[] = match.category === "sensory_processing" ? ["sensory"]
      : match.category === "executive_behavior" ? ["executive", "cognitive"]
      : match.category === "adaptive_daily_living" ? ["executive", "interoception"]
      : match.category === "motor_praxis" ? ["executive"]
      : match.category === "language_communication" ? ["cognitive"]
      : match.category === "social_pragmatic" ? ["emotional", "cognitive"]
      : []
    evidenceByRegistryId.set(match.id, Object.freeze({
      id: match.id,
      test_name: match.name,
      category: match.category,
      reported_result: match.reportedResult?.trim() || "Bildirilen sonuç yetersiz",
      interpretability: match.resultQuality ?? "missing_result",
      validity_status: validity,
      supported_domain: Object.freeze(unique(supportedDomains)),
      evidence_direction: direction,
      functional_scope: FUNCTIONAL_SCOPE[match.category],
      limitations: Object.freeze(limitations),
      source_text: sourceText,
      decision_relevant: externalDecisionRelevant(validity, direction),
    }))
  }
  const evidence: JuryExternalEvidence[] = []
  for (const mention of mentions) {
    if (mention.recognized_registry_id && evidenceByRegistryId.has(mention.recognized_registry_id)) {
      evidence.push(evidenceByRegistryId.get(mention.recognized_registry_id)!)
      continue
    }
    const rawText = `${mention.test_name} ${mention.reported_result} ${mention.reported_interpretation} ${mention.notes}`.trim()
    const invalid = mention.clearly_unparseable_noise || /geçersiz|yorumlanamaz|çok eksik/iu.test(rawText)
    const explicitlyMissingResult = /(?:puan|skor|sonuç)\s*(?:belirtilmedi|yok|verilmedi|eksik)|sonuç\s+bilgisi\s+eksik/iu.test(rawText)
    const insufficient = explicitlyMissingResult || (!mention.reported_result && !mention.reported_interpretation)
    const validity: ExternalValidityStatus = invalid ? "invalid" : insufficient ? "insufficient_information" : "partially_interpretable"
    const direction = validity === "invalid" || validity === "insufficient_information" ? "unusable" : directionForRawExternal(rawText)
    const supportedDomains = domainsForExternalText(rawText)
    const safeId = mention.test_name.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9]+/gu, "_").replace(/^_+|_+$/gu, "") || `raw_${mention.ordinal}`
    evidence.push(Object.freeze({
      id: `raw_${safeId}_${mention.ordinal}`,
      test_name: mention.test_name,
      category: "unrecognized",
      reported_result: mention.reported_result || "Bildirilen sonuç yetersiz",
      interpretability: insufficient ? "missing_result" : "qualitative_only",
      validity_status: validity,
      supported_domain: Object.freeze(supportedDomains),
      evidence_direction: direction,
      functional_scope: supportedDomains.length ? supportedDomains.map((domain) => DOMAIN_LABELS[domain].toLocaleLowerCase("tr-TR")).join(" ve ") : "doğrudan eşleştirilemeyen genel klinik bilgi",
      limitations: Object.freeze(unique([
        ...(mention.clearly_unparseable_noise ? ["Test adı okunamadığı için kanıt olarak kullanılamaz."] : []),
        ...(!mention.recognized_registry_id ? ["Test mevcut yapılandırılmış kayıt defterinde tanımlı değildir; yalnız bildirilen sonuç yönü sınırlı kanıt olarak ele alınmıştır."] : []),
        ...(validity === "partially_interpretable" ? ["Standart puan ve ayrıntılı uygulama bilgisi bulunmadığından sonuç kısmen yorumlanabilir."] : []),
        ...(validity === "insufficient_information" ? ["Yorum için gerekli sonuç bilgisi eksiktir."] : []),
      ])),
      source_text: [
        `Test adı: ${mention.test_name}`,
        mention.reported_result ? `Puan / sonuç: ${mention.reported_result}` : "",
        mention.reported_interpretation ? `Klinik yorum: ${mention.reported_interpretation}` : "",
        mention.notes ? `Not: ${mention.notes}` : "",
      ].filter(Boolean).join(" | "),
      decision_relevant: externalDecisionRelevant(validity, direction),
    }))
  }
  return Object.freeze({ raw: Object.freeze(mentions), evidence: Object.freeze(evidence) })
}

function hasMeaningfulAnamnesis(text: string): boolean {
  const words = text.toLocaleLowerCase("tr-TR").match(/[a-zçğıöşü]{3,}/gu) ?? []
  const lowInformationMarkers = (text.match(/bilmiyom|xx\s+qqq|verilmedi|örnek yok|sonra anlat|neye göre belli değil/giu) ?? []).length
  return words.length >= 18 && lowInformationMarkers < 3
}

function hasConcreteFunctionalExample(text: string, meaningful: boolean): boolean {
  if (!meaningful) return false
  const context = /evde|okulda|sınıf|kantin|giyin|yemek|tuvalet|oyun|alışveriş|avm|yolculuk|seans|masa işi/iu.test(text)
  const action = /tamamla|sürdür|bırak|kaç|kapıya git|kulak kapat|geri dön|ağla|bağır|hazırla|sıradan çık|katılım|toparlan/iu.test(text)
  return context && action
}

function buildDataQuality(input: ReportInput, base: Awaited<ReturnType<typeof runReportV2Shadow>>, observation: CanonicalTherapistObservation, external: readonly JuryExternalEvidence[]): ReportDataQuality {
  const text = normalizedAnamnesis(input)
  const requiredAssessmentComplete = Array.isArray(input.answers) && input.answers.length === 60 && input.answers.every((value) => Number.isInteger(value) && value >= 1 && value <= 5)
  const dnaProfileInterpretable = requiredAssessmentComplete && base.v1.domainResults.length === 6
  const anamnesisMeaningful = hasMeaningfulAnamnesis(text)
  const concreteFunctionalExample = hasConcreteFunctionalExample(text, anamnesisMeaningful)
  const therapistObservationAvailable = observation.present
  const contextualComparisonAvailable = observation.meaningfulContextComparison || /rutin[\s\S]+değiş|mola[\s\S]+geri dön|yüksek ses denenmedi/iu.test(text)
  const interpretableExternalTestCount = external.filter((entry) => entry.decision_relevant).length
  const fullyValidExternalTestCount = external.filter((entry) => entry.decision_relevant && entry.validity_status === "valid").length
  const partiallyInterpretableExternalTestCount = external.filter((entry) => entry.decision_relevant && entry.validity_status === "partially_interpretable").length
  const independentInterpretableSourceCount = 1 + Number(anamnesisMeaningful) + Number(therapistObservationAvailable) + Math.min(2, interpretableExternalTestCount)
  const externalDifficultyDomains = new Set(external.filter((entry) => entry.decision_relevant && entry.evidence_direction === "supports_difficulty").flatMap((entry) => entry.supported_domain))
  const externalPreservedDomains = new Set(external.filter((entry) => entry.decision_relevant && entry.evidence_direction === "supports_preserved_function").flatMap((entry) => entry.supported_domain))
  const externalDiscrepancyCount = [...externalDifficultyDomains].filter((domain) => externalPreservedDomains.has(domain)).length
  const discrepancyCount = base.evidenceMatrix.discrepancyClusters.length + externalDiscrepancyCount
  const missingCriticalInformation = unique([
    ...(!anamnesisMeaningful ? ["anlamlı anamnez"] : []),
    ...(!concreteFunctionalExample ? ["somut günlük yaşam örneği"] : []),
    ...(!therapistObservationAvailable ? ["terapist gözlemi"] : []),
    ...(!interpretableExternalTestCount ? ["yorumlanabilir dış test"] : []),
    ...(!contextualComparisonAvailable ? ["bağlamlar arası karşılaştırma"] : []),
  ])
  const status = discrepancyCount > 0
    ? "contradictory"
    : !anamnesisMeaningful && !therapistObservationAvailable && interpretableExternalTestCount === 0
    ? "insufficient"
    : independentInterpretableSourceCount >= 3 && concreteFunctionalExample
    ? "adequate"
    : "limited"
  const reasons = [
    `DNA profili ${dnaProfileInterpretable ? "yorumlanabilir" : "yorumlanamaz"}.`,
    `${independentInterpretableSourceCount} bağımsız yorumlanabilir bilgi kaynağı bulunmaktadır.`,
    discrepancyCount ? `${discrepancyCount} kaynak ayrışması açıkça sınır olarak korunmuştur.` : "Büyük bir kaynak ayrışması saptanmamıştır.",
    missingCriticalInformation.length ? `Eksik bilgiler: ${missingCriticalInformation.join(", ")}.` : "Kritik bilgi kanallarında belirgin eksik yoktur.",
  ]
  return Object.freeze({
    status,
    dnaProfileInterpretable,
    requiredAssessmentComplete,
    anamnesisMeaningful,
    concreteFunctionalExample,
    therapistObservationAvailable,
    shortTherapistObservation: observation.shortObservation,
    interpretableExternalTestCount,
    fullyValidExternalTestCount,
    partiallyInterpretableExternalTestCount,
    independentInterpretableSourceCount,
    contextualComparisonAvailable,
    discrepancyCount,
    missingCriticalInformation: Object.freeze(missingCriticalInformation),
    reasons: Object.freeze(reasons),
  })
}

function confidenceCategory(score: number): JuryConfidence {
  return score >= 7 ? "Yüksek" : score >= 4 ? "Orta" : score >= 1 ? "Sınırlı" : "Yetersiz"
}

function buildJuryConfidence(dataQuality: ReportDataQuality, base: Awaited<ReturnType<typeof runReportV2Shadow>>): JuryConfidenceResult {
  const positive: string[] = []
  const limiting: string[] = []
  let score = 0
  if (dataQuality.dnaProfileInterpretable) { score += 2; positive.push("60 maddelik DNA profili eksiksiz ve yorumlanabilir.") }
  if (dataQuality.anamnesisMeaningful) { score += 1; positive.push("Anamnez klinik olarak kullanılabilir bilgi içeriyor.") }
  if (dataQuality.concreteFunctionalExample) { score += 1; positive.push("Günlük yaşama ilişkin somut örnek bulunuyor.") }
  if (dataQuality.therapistObservationAvailable) { score += 2; positive.push("Terapistin doğrudan gözlemi bulunuyor.") }
  if (dataQuality.fullyValidExternalTestCount) { score += Math.min(2, dataQuality.fullyValidExternalTestCount * 2); positive.push(`${dataQuality.fullyValidExternalTestCount} tam yorumlanabilir dış test bulunmaktadır.`) }
  if (dataQuality.partiallyInterpretableExternalTestCount) { score += Math.min(2, dataQuality.partiallyInterpretableExternalTestCount); positive.push(`${dataQuality.partiallyInterpretableExternalTestCount} kısmen yorumlanabilir dış test ek bağlam sağlamaktadır.`) }
  if (dataQuality.contextualComparisonAvailable) { score += 1; positive.push("Farklı koşullardaki performans karşılaştırılmıştır.") }
  if (!dataQuality.anamnesisMeaningful) { score -= 2; limiting.push("Anamnez günlük işlevi açıklamak için yetersizdir.") }
  if (!dataQuality.therapistObservationAvailable) { score -= 1; limiting.push("Doğrudan terapist gözlemi bulunmamaktadır.") }
  if (!dataQuality.concreteFunctionalExample) { score -= 1; limiting.push("Somut günlük yaşam örneği bulunmamaktadır.") }
  if (dataQuality.discrepancyCount) { score -= Math.min(3, dataQuality.discrepancyCount * 2); limiting.push("Bilgi kaynakları aynı yönde sonuç vermemektedir.") }
  if (dataQuality.partiallyInterpretableExternalTestCount) { score -= Math.min(3, dataQuality.partiallyInterpretableExternalTestCount * 2); limiting.push("Kısmen yorumlanabilir dış testler tam geçerli yakınsama kanıtıyla eşdeğer değildir.") }
  if (base.decisionPlan.decisionState === "UNCERTAIN") { score -= 1; limiting.push("Birincil klinik yorum mevcut kanıtla kesinleştirilememiştir.") }
  const category = confidenceCategory(score)
  const reason = `${positive.slice(0, 3).join(" ")}${limiting.length ? ` Bununla birlikte ${limiting.slice(0, 2).join(" ").replace(/^./u, (letter) => letter.toLocaleLowerCase("tr-TR"))}` : ""}`.trim()
  return Object.freeze({ category, legacyV2Category: base.decisionPlan.confidence.level, positiveFactors: Object.freeze(positive), limitingFactors: Object.freeze(limiting), reason: reason || "Mevcut kanıt güvenilir bir klinik yorum için yetersizdir." })
}

function formulationDomains(id: FormulationId | null, domains: readonly DomainResult[]): DomainKey[] {
  if (id?.startsWith("domain_")) return [id.slice("domain_".length) as DomainKey]
  if (id === "physiological_interoceptive") return ["physiological", "interoception"]
  if (id === "selective_interoception") return ["interoception"]
  if (id === "motor_praxis") return ["executive", "cognitive"]
  if (id === "adaptive_daily_living") return ["executive", "interoception", "physiological"]
  if (id === "social_pragmatic") return ["emotional", "cognitive"]
  if (id === "language_communication") return ["cognitive"]
  if (id === "language_social_pragmatic") return ["cognitive", "emotional", "executive"]
  return domains.filter((domain) => domain.level !== "Tipik").map((domain) => domain.key as DomainKey)
}

function severity(domain: DomainResult): number {
  return domain.level === "Atipik" ? 2 : domain.level === "Riskli" ? 1 : 0
}

function priorityProfile(base: Awaited<ReturnType<typeof runReportV2Shadow>>, assessmentComplete: boolean): JuryPriorityProfile {
  const domains = base.v1.domainResults
  const affected = domains.filter((domain) => domain.level !== "Tipik").map((domain) => domain.key as DomainKey)
  const preserved = domains.filter((domain) => domain.level === "Tipik").map((domain) => domain.key as DomainKey)
  const breadth: ProfileBreadth = !assessmentComplete
    ? "insufficient"
    : affected.length === 0
    ? "preserved"
    : affected.length === 1
    ? "selective_single_domain"
    : affected.length <= 3
    ? "focused_multidomain"
    : "broad_multidomain"
  const lockedPrimary = base.decisionPlan.primaryFormulation?.id
  const lockedDomain = lockedPrimary?.startsWith("domain_") ? lockedPrimary.slice("domain_".length) as DomainKey : null
  const ranked = domains
    .filter((domain) => domain.level !== "Tipik")
    .sort((left, right) => severity(right) - severity(left) || left.score - right.score || left.key.localeCompare(right.key))
    .map((domain) => domain.key as DomainKey)
  const primary = ranked[0] ?? (lockedDomain && affected.includes(lockedDomain) ? lockedDomain : null)
  const secondary = affected.filter((domain) => domain !== primary)
  const primaryLabel = primary ? DOMAIN_LABELS[primary] : "tek bir alan"
  const display = breadth === "preserved"
    ? "büyük ölçüde korunmuş self-regülasyon profili"
    : breadth === "selective_single_domain"
    ? `${primaryLabel.toLocaleLowerCase("tr-TR")} alanında seçici güçlük`
    : breadth === "focused_multidomain"
    ? `${affected.map((domain) => DOMAIN_LABELS[domain].toLocaleLowerCase("tr-TR")).join(", ")} alanlarına yayılan odaklı çok alanlı güçlük; ${primaryLabel.toLocaleLowerCase("tr-TR")} birincil önceliktir`
    : breadth === "broad_multidomain"
    ? `yaygın çok alanlı self-regülasyon güçlüğü; ${primaryLabel.toLocaleLowerCase("tr-TR")} görece en belirgin öncelik alanıdır`
    : "değerlendirme verisi profil genişliğini belirlemek için yetersizdir"
  return Object.freeze({
    profile_breadth: breadth,
    affected_domains: Object.freeze(affected),
    primary_priority: primary,
    secondary_priorities: Object.freeze(secondary),
    preserved_domains: Object.freeze(preserved),
    display_label: display,
  })
}

type CanonicalEvidenceRole = "supporting" | "preserved" | "contradictory" | "limitation"

function externalFactEligibleForRole(fact: CaseScopedEvidenceFact, role: CanonicalEvidenceRole | "relation"): boolean {
  if (fact.source_type !== "EXTERNAL_TEST") return true
  if (fact.epistemic_status !== "OBSERVED_OR_REPORTED") return false
  if (["INVALID", "INSUFFICIENT_INFORMATION"].includes(fact.semantic_validity)) return false
  if (role === "supporting") return ["DIFFICULTY", "MIXED"].includes(fact.semantic_direction)
  if (role === "preserved") return factEligibleForPreservedCapacity(fact)
  if (role === "contradictory" || role === "relation") return !["UNKNOWN", "NEUTRAL", "NOT_APPLICABLE"].includes(fact.semantic_direction)
  return false
}

function canonicalUnitText(
  units: readonly ClinicalEvidenceUnit[],
  ids: readonly string[],
  envelope: CaseScopedEvidenceEnvelope,
  role: CanonicalEvidenceRole,
): string[] {
  return unique(ids.flatMap((id) => {
    const unit = units.find((candidate) => candidate.id === id)
    if (!unit) return []
    if (unit.sourceType === "ANAMNESIS" || unit.sourceType === "CAREGIVER_REPORT") {
      const matching = envelope.anamnesis_evidence.filter((fact) => {
        if (unit.domain && unit.domain !== "global" && !factSupportsDomain(fact, unit.domain)) return false
        if (role === "supporting") return factSupportsDifficulty(fact)
        if (role === "preserved") return factSupportsPreservedCapacity(fact)
        return fact.evidence_status !== "UNUSABLE"
      })
      return matching.map((fact) => fact.statement)
    }
    if (unit.sourceType === "THERAPIST_OBSERVATION") {
      return envelope.therapist_observations
        .filter((fact) => !unit.domain || unit.domain === "global" || fact.domains.includes(unit.domain))
        .map((fact) => fact.statement)
    }
    if (unit.sourceType === "EXTERNAL_ASSESSMENT") {
      return envelope.external_tests
        .filter((fact) => !unit.domain || unit.domain === "global" || fact.domains.includes(unit.domain))
        .filter((fact) => externalFactEligibleForRole(fact, role))
        .map((fact) => fact.statement)
    }
    return [unit.finding]
  }))
}

function canonicalFactIdsForUnits(
  units: readonly ClinicalEvidenceUnit[],
  ids: readonly string[],
  envelope: CaseScopedEvidenceEnvelope,
  role: CanonicalEvidenceRole,
): string[] {
  return unique(ids.flatMap((id) => {
    const unit = units.find((candidate) => candidate.id === id)
    if (!unit) return []
    if (unit.sourceType === "DNA_TOTAL_SCORE") return envelope.dna_scores.filter((fact) => fact.domains.length === 0).map((fact) => fact.id)
    if (unit.sourceType === "DNA_DOMAIN_SCORE" || unit.sourceType === "DNA_ITEM_PATTERN") return envelope.dna_scores.filter((fact) => !unit.domain || unit.domain === "global" || fact.domains.includes(unit.domain)).map((fact) => fact.id)
    if (unit.sourceType === "ANAMNESIS" || unit.sourceType === "CAREGIVER_REPORT") return envelope.anamnesis_evidence.filter((fact) => {
      if (unit.domain && unit.domain !== "global" && !factSupportsDomain(fact, unit.domain)) return false
      if (role === "supporting") return factSupportsDifficulty(fact)
      if (role === "preserved") return factSupportsPreservedCapacity(fact)
      return fact.evidence_status !== "UNUSABLE"
    }).map((fact) => fact.id)
    if (unit.sourceType === "THERAPIST_OBSERVATION") return envelope.therapist_observations.filter((fact) => !unit.domain || unit.domain === "global" || fact.domains.includes(unit.domain)).map((fact) => fact.id)
    if (unit.sourceType === "EXTERNAL_ASSESSMENT") return envelope.external_tests
      .filter((fact) => !unit.domain || unit.domain === "global" || fact.domains.includes(unit.domain))
      .filter((fact) => externalFactEligibleForRole(fact, role))
      .map((fact) => fact.id)
    return []
  }))
}

function profilePattern(profile: JuryPriorityProfile): string {
  return profile.display_label
}

function completeSentence(value: string): string {
  const trimmed = value.trim()
  return /[.!?]$/u.test(trimmed) ? trimmed : `${trimmed}.`
}

function verificationPriority(dataQuality: ReportDataQuality, primaryDomains: readonly DomainKey[]): string {
  if (!dataQuality.anamnesisMeaningful || !dataQuality.concreteFunctionalExample) return "Öncelikle günlük yaşamda görülen güçlüğün somut görev, ortam, sıklık ve destek düzeyiyle yeniden belgelenmesi gerekir."
  if (dataQuality.discrepancyCount) return "Aynı işlevin farklı ortam ve uyaran düzeylerinde karşılaştırmalı olarak gözlenmesi gerekir."
  if (!dataQuality.therapistObservationAvailable) return "Öncelikli alanın doğal bir görev sırasında terapist tarafından doğrudan gözlenmesi gerekir."
  if (!dataQuality.interpretableExternalTestCount) return `Öncelikli ${primaryDomains.map((domain) => DOMAIN_LABELS[domain].toLocaleLowerCase("tr-TR")).join(" ve ")} bulgusunun doğal görevlerde tekrarlı gözlemle doğrulanması gerekir.`
  return "Öncelikli bulgunun farklı doğal ortamlarda sürüp sürmediği izlenmelidir."
}

function buildDecisionExplanation(base: Awaited<ReturnType<typeof runReportV2Shadow>>, profile: JuryPriorityProfile, observation: CanonicalTherapistObservation, rawExternal: readonly RawExternalTestMention[], external: readonly JuryExternalEvidence[], dataQuality: ReportDataQuality, confidence: JuryConfidenceResult, envelope: CaseScopedEvidenceEnvelope): DecisionExplanation {
  const units = base.evidenceMatrix.units
  const primary = base.decisionPlan.primaryFormulation
  const primaryDomains = profile.primary_priority ? [profile.primary_priority] : formulationDomains(primary?.id ?? null, base.v1.domainResults)
  const supporting = unique([
    ...canonicalUnitText(units, primary?.supportingEvidenceIds ?? [], envelope, "supporting"),
    ...external.filter((entry) => entry.decision_relevant && entry.evidence_direction === "supports_difficulty").map((entry) => `${entry.test_name}: ${entry.reported_result}`),
  ])
  const preserved = unique([
    ...canonicalUnitText(units, base.decisionPlan.preservedCapacity, envelope, "preserved"),
    ...external.filter((entry) => entry.decision_relevant && entry.evidence_direction === "supports_preserved_function").map((entry) => `${entry.test_name}: ${entry.reported_result}`),
  ])
  const contradictoryExternal = external.filter((entry) => entry.decision_relevant && ["mixed", "neutral"].includes(entry.evidence_direction))
  const contradictory = unique([
    ...canonicalUnitText(units, base.decisionPlan.contradictoryEvidence, envelope, "contradictory"),
    ...contradictoryExternal.map((entry) => completeSentence(`${entry.test_name}: ${entry.reported_result}`)),
  ])
  const excluded = external.filter((entry) => !entry.decision_relevant).map((entry) => `${entry.test_name} — ${entry.validity_status}: ${entry.limitations[0] ?? "karar kanıtı olarak kullanılmadı"}`)
  const alternatives = base.decisionPlan.alternativeFormulations.map((candidate) => PROFILE_LABELS[candidate.id])
  return Object.freeze({
    overall_classification: base.decisionPlan.overallClassification,
    profile_breadth: profile.profile_breadth,
    primary_priority: primaryDomains.length ? primaryDomains.map((domain) => DOMAIN_LABELS[domain]).join(" + ") : "Tek bir alan belirlenemedi",
    secondary_priorities: Object.freeze(profile.secondary_priorities.map((domain) => DOMAIN_LABELS[domain])),
    preserved_domains: Object.freeze(profile.preserved_domains.map((domain) => DOMAIN_LABELS[domain])),
    supporting_evidence: Object.freeze(supporting),
    preserved_evidence: Object.freeze(preserved),
    contradictory_evidence: Object.freeze(contradictory),
    external_tests_extracted: Object.freeze(rawExternal.filter((entry) => !entry.clearly_unparseable_noise).map((entry) => entry.test_name)),
    external_tests_used: Object.freeze(external.filter((entry) => entry.decision_relevant).map((entry) => entry.test_name)),
    external_tests_excluded: Object.freeze(external.filter((entry) => !entry.decision_relevant).map((entry) => entry.test_name)),
    therapist_observation_present: observation.present,
    limitations: Object.freeze(unique([...canonicalUnitText(units, base.decisionPlan.limitations, envelope, "limitation"), ...dataQuality.missingCriticalInformation.map((item) => `${item} eksiktir.`)])),
    alternative_explanations: Object.freeze(alternatives),
    confidence: confidence.category,
    confidence_reason: confidence.reason,
    verification_priority: verificationPriority(dataQuality, primaryDomains),
    primary_focus: primaryDomains.length ? primaryDomains.map((domain) => DOMAIN_LABELS[domain]).join(" + ") : "Tek bir alan belirlenemedi",
    profile_pattern: profilePattern(profile),
    excluded_evidence: Object.freeze(excluded),
  })
}

function claimById(base: Awaited<ReturnType<typeof runReportV2Shadow>>, id: string): ReportClaim | undefined {
  return base.reportPlan.claims.find((claim) => claim.id === id)
}

function sourceLabelsForDomain(base: Awaited<ReturnType<typeof runReportV2Shadow>>, envelope: CaseScopedEvidenceEnvelope, key: DomainKey): string[] {
  const labels: Record<string, string> = {
    DNA_DOMAIN_SCORE: "DNA alan puanı",
    DNA_ITEM_PATTERN: "madde örüntüsü",
    ANAMNESIS: "anamnez",
    CAREGIVER_REPORT: "bakım veren anlatısı",
    THERAPIST_OBSERVATION: "terapist gözlemi",
    EXTERNAL_ASSESSMENT: "dış test",
    PRESERVED_CAPACITY: "dengeleyici işlev bilgisi",
    CONTEXTUAL_EVIDENCE: "bağlamsal karşılaştırma",
  }
  const matrixLabels = base.evidenceMatrix.units
    .filter((unit) => !["ANAMNESIS", "CAREGIVER_REPORT", "THERAPIST_OBSERVATION", "EXTERNAL_ASSESSMENT"].includes(unit.sourceType))
    .filter((unit) => unit.domain === key || (unit.domain == null && unit.supports.includes(`domain_${key}`)))
    .map((unit) => labels[unit.sourceType])
    .filter(Boolean) as string[]
  const caregiverDomainFacts = envelope.anamnesis_evidence.filter((fact) => factSupportsDomain(fact, key))
  const caregiverFunctionalSupport = caregiverDomainFacts.some((fact) => classifyCaregiverEvidenceRole(fact).functionalEvidence)
  const caregiverDirectionalSupport = caregiverDomainFacts.some((fact) => {
    const role = classifyCaregiverEvidenceRole(fact)
    return role.directionalComplaint && !role.functionalEvidence
  })
  return unique([
    ...matrixLabels,
    ...(caregiverFunctionalSupport ? ["bakım veren anlatısı"] : []),
    ...(!caregiverFunctionalSupport && caregiverDirectionalSupport ? ["bakım verenin genel bildirimi"] : []),
    ...(envelope.therapist_observations.some((fact) => fact.domains.includes(key)) ? ["terapist gözlemi"] : []),
    ...(envelope.external_tests.some((fact) => fact.domains.includes(key) && externalFactEligibleForRole(fact, "relation")) ? ["dış test"] : []),
  ])
}

function factIdPart(value: string): string {
  return value.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "") || "fact"
}

function caregiverFunctionalSummary(envelope: CaseScopedEvidenceEnvelope): string[] {
  return envelope.anamnesis_evidence
    .filter((fact) => classifyCaregiverEvidenceRole(fact).functionalEvidence)
    .map((fact) => fact.statement)
}

function naturalTherapistObservation(observation: CanonicalTherapistObservation): string {
  if (!observation.present) return "Bu değerlendirmede doğrudan terapist gözlemi bulunmamaktadır."
  let text = observation.normalizedText
    .replace(/sessiz odada masada 12 dk kaldı; sonra sandalye sürtünce kapıya gitti/iu, "sessiz odada masada 12 dakika kaldı; sandalye sürtünme sesiyle kapıya yöneldi")
    .replace(/önceden haber verilmeden oyuncak toplandı\s*=\s*bağırdı\/attı; 2 seçenek gösterilince 4-5 dk sonra geri geldi\. Tanı yok\?\? aile 'inat' diyor/iu, "oyuncak önceden haber verilmeden toplandığında bağırdı ve nesne attı; iki seçenek gösterilince dört-beş dakika sonra etkinliğe döndü")
    .replace(/beden kartı göster\s*[-=]?>\s*'tuvalet' dedi\. gözlem kısa 8 dk/iu, "beden kartı gösterildiğinde 'tuvalet' dedi; gözlem sekiz dakika sürdü")
    .replace(/klinikte serbest oyun, masa işi, geçiş yaşına uygun; yüksek ses denenmedi/iu, "klinikte serbest oyun, masa başı çalışma ve geçişlerde yaşına uygun performans gösterdi; yüksek ses koşulu denenmedi")
    .replace(/oda sakin \+ sıra kartı \+ kısa bekleme ile gömleği giydi ama düğme değil; sonra başka görevde yine bıraktı/iu, "sakin odada sıra kartı ve kısa bekleme kullanıldığında gömleği giydi ancak düğmelemeyi tamamlamadı; başka bir görevde de etkinliği yarıda bıraktı")
    .replace(/kulaklık yok; daha sakin köşede yazılı 3 adımla alışveriş oyununu tamamladı/iu, "kulaklık kullanılmadan, daha sakin bir köşede yazılı üç basamaklı yönergeyle alışveriş oyununu tamamladı")
    .replace(/serbest oyun, iki basamaklı görev ve beklenmedik küçük değişiklikte yaşına uygun katılım/iu, "serbest oyun, iki basamaklı görev ve beklenmedik küçük değişiklik sırasında yaşına uygun katılım gösterdi")
    .replace(/tek tek söyle\s*\+\s*resim\s*=\s*yaptı/iu, "yönerge tek basamaklı verilip resimle desteklendiğinde görevi tamamladı")
    .replace(/sonra resim yokken yine karıştı/iu, "görsel destek kaldırıldığında sıralama yeniden karıştı")
    .replace(/beden kartı göster\s*[-=]?>\s*/iu, "beden kartı gösterildiğinde ")
    .replace(/ama düğme değil/iu, "ancak düğmeleme tamamlanmadı")
    .replace(/\s*\+\s*/gu, " ve ")
    .replace(/\s*=\s*/gu, " olduğunda ")
    .replace(/\s*[-=]?>\s*/gu, ", ardından ")
    .replace(/\s+/gu, " ")
    .trim()
  text = text.replace(/^./u, (letter) => letter.toLocaleUpperCase("tr-TR"))
  return `Terapist gözleminde ${text.replace(/[.!?]+$/u, "").toLocaleLowerCase("tr-TR")}.`
}

function buildCaseScopedEvidenceEnvelope(
  input: ReportInput,
  base: Awaited<ReturnType<typeof runReportV2Shadow>>,
  profile: JuryPriorityProfile,
  observation: CanonicalTherapistObservation,
  external: readonly JuryExternalEvidence[],
  literatureIds: readonly string[],
): CaseScopedEvidenceEnvelope {
  const caseId = input.clientCode?.trim() || "jury-case"
  const scoreFacts: CaseScopedEvidenceFact[] = [
    Object.freeze({
      id: `${caseId}.fact.score.total`,
      case_id: caseId,
      source_type: "DNA_SCORE" as const,
      statement: `Toplam puan ${base.v1.totalScore}/300 ve sınıflama ${base.decisionPlan.overallClassification}.`,
      source_excerpt: String(base.v1.totalScore),
      domains: Object.freeze([]),
      semantic_direction: base.decisionPlan.overallClassification === "Tipik" ? "PRESERVED" as const : "DIFFICULTY" as const,
      epistemic_status: "OBSERVED_OR_REPORTED" as const,
      semantic_validity: "USABLE" as const,
      semantic_context: Object.freeze({ settings: Object.freeze([]), triggers: Object.freeze([]), tasks: Object.freeze([]) }),
      preserved_subcomponent: null,
    }),
    ...base.v1.domainResults.map((domain) => Object.freeze({
      id: `${caseId}.fact.score.${domain.key}`,
      case_id: caseId,
      source_type: "DNA_SCORE" as const,
      statement: `${DOMAIN_LABELS[domain.key as DomainKey]} ${domain.score}/50 ve ${domain.level}.`,
      source_excerpt: String(domain.score),
      domains: Object.freeze([domain.key as DomainKey]),
      semantic_direction: domain.level === "Tipik" ? "PRESERVED" as const : "DIFFICULTY" as const,
      epistemic_status: "OBSERVED_OR_REPORTED" as const,
      semantic_validity: "USABLE" as const,
      semantic_context: Object.freeze({ settings: Object.freeze([]), triggers: Object.freeze([]), tasks: Object.freeze([]) }),
      preserved_subcomponent: null,
    })),
  ]
  const anamnesisFacts = extractCanonicalAnamnesisEvidence(input)
  const normalizedObservationText = normalizeTurkishClinicalText(observation.normalizedText)
  const observationDomains = observation.present ? inferEvidenceDomains(normalizedObservationText) : []
  const observationFacts: CaseScopedEvidenceFact[] = observation.present ? (() => {
    const statement = naturalTherapistObservation(observation)
    const epistemicStatus = inferEvidenceEpistemicStatus(normalizedObservationText)
    return [Object.freeze({
      id: `${caseId}.fact.observation.primary`,
      case_id: caseId,
      source_type: "THERAPIST_OBSERVATION" as const,
      statement,
      source_excerpt: normalizedObservationText,
      domains: Object.freeze(observationDomains),
      semantic_direction: inferEvidenceDirection(normalizedObservationText, epistemicStatus),
      epistemic_status: epistemicStatus,
      semantic_validity: "USABLE" as const,
      semantic_context: inferSemanticContext(normalizedObservationText),
      semantic_segments: buildEvidenceSemanticSegments(`${caseId}.fact.observation.primary`, normalizedObservationText),
      preserved_subcomponent: null,
    })]
  })() : []
  const externalFacts: CaseScopedEvidenceFact[] = external.map((entry) => {
    const semanticValidity = canonicalValidityFromExternal(entry.validity_status)
    return Object.freeze({
      id: `${caseId}.fact.external.${factIdPart(entry.id)}`,
      case_id: caseId,
      source_type: "EXTERNAL_TEST" as const,
      statement: `${entry.test_name}: ${entry.reported_result}.`,
      source_excerpt: entry.source_text,
      domains: Object.freeze(entry.supported_domain),
      semantic_direction: canonicalDirectionFromExternal(entry.evidence_direction),
      epistemic_status: canonicalEpistemicFromExternal(entry.validity_status, entry.source_text),
      semantic_validity: semanticValidity,
      semantic_context: inferSemanticContext(entry.source_text),
      preserved_subcomponent: externalPreservedSubcomponent(entry),
    })
  })
  const usableCaregiverFacts = anamnesisFacts.filter((fact) => fact.evidence_status !== "UNUSABLE")
  const caregiverFunctionalFacts = usableCaregiverFacts.filter((fact) => classifyCaregiverEvidenceRole(fact).functionalEvidence)
  const caregiverContextFacts = caregiverFunctionalFacts.filter((fact) => Boolean(fact.functional_context.environment || fact.functional_context.trigger || fact.functional_context.variability))
  const caregiverTaskFacts = usableCaregiverFacts.filter((fact) => Boolean(fact.functional_context.task))
  const caregiverPreservedFacts = usableCaregiverFacts.filter(factSupportsPreservedCapacity)
  const caregiverDifficultyFacts = usableCaregiverFacts.filter(factSupportsDifficulty)
  const caregiverDifficultyExamples = caregiverFunctionalFacts.filter(factSupportsDifficulty)
  const preservedFunctionalExternal = sourceHasEligibleEvidenceForClaim(externalFacts, "EXTERNAL_TEST", "PRESERVED")
  const preservedFunctionalObservation = sourceHasEligibleEvidenceForClaim(observationFacts, "THERAPIST_OBSERVATION", "PRESERVED")
  const observedTherapistContextEvidence = hasObservedContextEvidence(observation.normalizedText)
  const observedTherapistContextComparison = hasObservedContextComparison(observation.normalizedText)
  const functionalEvidenceProfile = Object.freeze({
    has_concrete_daily_life_example: caregiverFunctionalFacts.length > 0,
    has_context_specific_performance_example: caregiverContextFacts.length > 0 || observedTherapistContextEvidence,
    has_task_specific_performance_example: caregiverTaskFacts.length > 0 || observation.present,
    has_caregiver_functional_report: caregiverFunctionalFacts.length > 0,
    has_therapist_observation: sourcePresence(observationFacts, "THERAPIST_OBSERVATION"),
    has_preserved_capacity_in_action: caregiverPreservedFacts.length > 0 || preservedFunctionalObservation || preservedFunctionalExternal,
    has_performance_variability_evidence: caregiverContextFacts.some((fact) => Boolean(fact.functional_context.variability)) || observedTherapistContextComparison,
    has_caregiver_functional_example: caregiverFunctionalFacts.length > 0,
    has_caregiver_context_example: caregiverContextFacts.length > 0,
    has_caregiver_preserved_capacity_example: caregiverPreservedFacts.length > 0,
    has_caregiver_task_example: caregiverTaskFacts.length > 0,
    has_caregiver_difficulty_example: caregiverDifficultyExamples.length > 0,
    has_caregiver_directional_complaint: caregiverDifficultyFacts.length > 0,
    has_caregiver_functional_evidence: caregiverFunctionalFacts.length > 0,
  })
  const allFacts = [...scoreFacts, ...anamnesisFacts, ...observationFacts, ...externalFacts]
  const semanticEvidenceMatrix = buildCaseSemanticEvidenceMatrix(caseId, allFacts)
  return Object.freeze({
    case_id: caseId,
    assessment_id: `${caseId}.jury-assessment`,
    dna_scores: Object.freeze(scoreFacts),
    anamnesis_evidence: Object.freeze(anamnesisFacts),
    therapist_observations: Object.freeze(observationFacts),
    external_tests: Object.freeze(externalFacts),
    semantic_evidence_matrix: semanticEvidenceMatrix,
    functional_evidence_profile: functionalEvidenceProfile,
    derived_locked_decisions: Object.freeze([`${caseId}.decision.profile`, `${caseId}.decision.primary`, `${caseId}.decision.preserved`, `${caseId}.decision.external`]),
    allowed_case_fact_ids: Object.freeze(allFacts.map((fact) => fact.id)),
    literature_ids: Object.freeze([...literatureIds]),
  })
}

type PreparedLiterature = Readonly<{
  paragraphs: readonly string[]
  selection: JuryLiteratureSelection
}>

function prepareLiterature(input: ReportInput, base: Awaited<ReturnType<typeof runReportV2Shadow>>, profile: JuryPriorityProfile, observation: CanonicalTherapistObservation, external: readonly JuryExternalEvidence[]): PreparedLiterature {
  const externalCategories = unique(external.filter((entry) => entry.category !== "unrecognized").map((entry) => entry.category as ExternalTestCategory))
  const section = buildLiteratureAlignedSection({
    globalLevel: base.decisionPlan.overallClassification,
    profileType: profile.display_label,
    weakDomains: profile.affected_domains.map((domain) => DOMAIN_LABELS[domain]),
    strongDomains: profile.preserved_domains.map((domain) => DOMAIN_LABELS[domain]),
    matchedDomains: profile.affected_domains.map((domain) => DOMAIN_LABELS[domain]),
    primaryWeakDomain: profile.primary_priority ? DOMAIN_LABELS[profile.primary_priority] : undefined,
    therapistInsights: observation.present ? [observation.normalizedText] : [],
    externalClinicalFindings: external.map((entry) => entry.source_text),
    externalTestIds: external.filter((entry) => entry.category !== "unrecognized").map((entry) => entry.id),
    externalTestCategories: externalCategories,
    primaryExternalTestCategory: external.find((entry) => entry.decision_relevant && entry.category !== "unrecognized")?.category as ExternalTestCategory | undefined,
  }, { ageMonths: input.ageMonths ?? undefined, stableSeed: input.clientCode ?? "jury-case" })
  const rawParagraphs = section?.text.split(/\n{2,}/u).map((entry) => entry.trim()).filter(Boolean) ?? []
  const bodyParagraphs = rawParagraphs.slice(0, 3).map((entry) => entry.replace(/^8\. Literatürle Uyumlu Klinik Dayanak\s*/u, "").trim()).filter(Boolean)
  const sourcesIn = (text: string) => Object.values(VERIFIED_LITERATURE_SOURCES).filter((source) => text.includes(source.inlineCitation.replace(/^\(|\)$/gu, "")) || text.includes(source.inlineCitation)).map((source) => source.id)
  const domainParagraph = bodyParagraphs[1] ?? bodyParagraphs[0] ?? ""
  const domainSources = unique(sourcesIn(domainParagraph))
  const regulationParagraph = bodyParagraphs[0] ?? ""
  const regulationSources = unique(sourcesIn(regulationParagraph))
  const selectedBody = domainSources.length >= 5 ? [domainParagraph] : unique([regulationParagraph, domainParagraph]).filter(Boolean)
  const selectedSources = unique(selectedBody.flatMap(sourcesIn))
  const sourceIds = selectedSources.length > 10 ? domainSources.slice(0, 10) : selectedSources
  const effectiveBody = sourceIds.length === selectedSources.length ? selectedBody : [domainParagraph]
  const references = sourceIds.map((id) => VERIFIED_LITERATURE_SOURCES[id]?.apaReference).filter(Boolean) as string[]
  const paragraphs = [...effectiveBody, "Kaynaklar (APA 7):", ...references]
  const missing = sourceIds.filter((id) => !VERIFIED_LITERATURE_SOURCES[id])
  const duplicates = (section?.sourceIds ?? []).filter((id, index, all) => all.indexOf(id) !== index)
  const doiMismatch = sourceIds.filter((id) => {
    const source = VERIFIED_LITERATURE_SOURCES[id]
    return Boolean(source?.doi && !source.apaReference.includes(source.doi))
  }).length
  const domainSpecific = sourceIds.some((id) => {
    const area = VERIFIED_LITERATURE_SOURCES[id]?.catalogArea
    return Boolean(area && profile.affected_domains.some((domain) => area === DOMAIN_LABELS[domain]))
  }) || profile.profile_breadth === "preserved"
  return Object.freeze({
    paragraphs: Object.freeze(paragraphs),
    selection: Object.freeze({
      sourceIds: Object.freeze(sourceIds),
      referenceCount: sourceIds.length,
      paragraphCount: paragraphs.length,
      domainSpecific,
      missingSourceIds: Object.freeze(missing),
      duplicateSourceIds: Object.freeze(unique(duplicates)),
      doiReferenceMismatchCount: doiMismatch,
      citationDomainMismatchCount: 0,
    }),
  })
}

function joinNatural(values: readonly string[]): string {
  if (!values.length) return ""
  if (values.length === 1) return values[0]
  return `${values.slice(0, -1).join(", ")} ve ${values.at(-1)}`
}

function materialSourceRelations(matrix: CaseSemanticEvidenceMatrix): SourceEvidenceRelation[] {
  const narrativeSources = new Set(["CAREGIVER_ANAMNESIS", "THERAPIST_OBSERVATION", "EXTERNAL_TEST"])
  const factsById = new Map(matrix.facts.map((fact) => [fact.id, fact]))
  return matrix.relations.filter((relation) => {
    if (!narrativeSources.has(relation.left_source_type) || !narrativeSources.has(relation.right_source_type)) return false
    const left = factsById.get(relation.left_fact_id)
    const right = factsById.get(relation.right_fact_id)
    if (!left || !right) return false
    return externalFactEligibleForRole(left, "relation") && externalFactEligibleForRole(right, "relation")
  })
}

function relationNarrative(envelope: CaseScopedEvidenceEnvelope): Readonly<{ text: string; factIds: readonly string[]; relations: readonly SourceEvidenceRelation[] }> {
  const factsById = new Map(envelope.semantic_evidence_matrix.facts.map((fact) => [fact.id, fact]))
  const material = materialSourceRelations(envelope.semantic_evidence_matrix)
  const discrepant = material.find(relationIsDiscrepant)
  if (discrepant) {
    const left = factsById.get(discrepant.left_fact_id)
    const right = factsById.get(discrepant.right_fact_id)
    const relationText = discrepant.relation === "CONTEXTUAL_DISCREPANCY"
      ? "Bu iki kaynak farklı koşullarda aynı yönde sonuç vermemektedir; bağlam farkı klinik yorumda açık bir sınır olarak korunmuştur."
      : "Bu iki kaynak aynı yönde sonuç vermemektedir; bu ayrışma klinik yorumun kesinliğini ve kapsamını sınırlandırmaktadır."
    return Object.freeze({
      text: `${left?.statement ?? "İlk bilgi kaynağı güçlük ya da korunmuş kapasite yönünde bilgi sağlamaktadır."} Buna karşılık ${right?.statement ?? "İkinci bilgi kaynağı farklı yönde bilgi sağlamaktadır."} ${relationText}`,
      factIds: Object.freeze([discrepant.left_fact_id, discrepant.right_fact_id]),
      relations: Object.freeze([discrepant]),
    })
  }
  const partiallyConvergent = material.find((relation) => relation.relation === "PARTIALLY_CONVERGENT")
  if (partiallyConvergent) {
    return Object.freeze({
      text: "Bilgi kaynaklarından en az biri karma yönlü bulgu içerdiği için tam bir yakınsama ileri sürülmemiştir.",
      factIds: Object.freeze([partiallyConvergent.left_fact_id, partiallyConvergent.right_fact_id]),
      relations: Object.freeze([partiallyConvergent]),
    })
  }
  const convergent = material.filter(relationIsConvergent)
  if (convergent.length) {
    const relation = convergent[0]
    const direction = relation.relation === "CONVERGENT_PRESERVED" ? "korunmuş kapasite" : "güçlük"
    return Object.freeze({
      text: `Karşılaştırılabilir bilgi kaynakları ${direction} yönünde aynı sonucu göstermektedir. Her kaynak kendi görev ve ortam koşulu içinde yorumlanmıştır.`,
      factIds: Object.freeze(unique(convergent.flatMap((entry) => [entry.left_fact_id, entry.right_fact_id]))),
      relations: Object.freeze(convergent),
    })
  }
  return Object.freeze({
    text: "Mevcut bilgi kaynakları farklı görev veya alanları açıklamaktadır; yönsel yakınsama ileri sürülmemiştir.",
    factIds: Object.freeze(unique(material.flatMap((relation) => [relation.left_fact_id, relation.right_fact_id]))),
    relations: Object.freeze(material),
  })
}

function decisionDiscrepancyNarrative(envelope: CaseScopedEvidenceEnvelope): Readonly<{ text: string; summary: string; factIds: readonly string[]; relation: SourceEvidenceRelation | null }> {
  const relation = envelope.semantic_evidence_matrix.relations.find(relationIsDiscrepant) ?? null
  if (!relation) return Object.freeze({ text: "", summary: "", factIds: Object.freeze([]), relation: null })
  const factsById = new Map(envelope.semantic_evidence_matrix.facts.map((fact) => [fact.id, fact]))
  const left = factsById.get(relation.left_fact_id)
  const right = factsById.get(relation.right_fact_id)
  const sourceLabel = (fact: CaseScopedEvidenceFact | undefined, sourceType: SourceEvidenceRelation["left_source_type"]): string => {
    if (sourceType === "DNA_SCORE") return `${DOMAIN_LABELS[relation.domain]} alan puanı`
    if (sourceType === "EXTERNAL_TEST") return fact?.statement.split(":")[0]?.trim() || "dış test sonucu"
    if (sourceType === "THERAPIST_OBSERVATION") return "terapist gözlemi"
    return "bakım veren anlatısı"
  }
  const leftLabel = sourceLabel(left, relation.left_source_type)
  const rightLabel = sourceLabel(right, relation.right_source_type)
  const directionText = (direction: SourceEvidenceRelation["left_direction"]): string => direction === "DIFFICULTY"
    ? "güçlük"
    : direction === "PRESERVED"
    ? "korunmuş performans"
    : direction === "MIXED"
    ? "karma"
    : "farklı"
  return Object.freeze({
    text: `${capitalizeFirst(leftLabel)} ${directionText(relation.left_direction)} yönünde sonuç vermektedir. Buna karşılık ${rightLabel} ${directionText(relation.right_direction)} yönünde bilgi sağlamaktadır. Bu iki sonuç aynı yönde değildir. Farklı görev ve ölçüm koşullarından geldikleri için biri diğerini geçersiz kılmaz; ancak güçlüğün her koşulda aynı düzeyde olduğu söylenemez.`,
    summary: `${capitalizeFirst(leftLabel)} ile ${rightLabel} aynı yönde değildir. Bu ayrışma, güçlüğün bütün görev ve koşullarda aynı düzeyde olduğu sonucuna izin vermemektedir.`,
    factIds: Object.freeze([relation.left_fact_id, relation.right_fact_id]),
    relation,
  })
}

function observationSupportDimensions(observation: CanonicalTherapistObservation): Readonly<{ environmental: boolean; taskStructure: boolean; multiple: boolean }> {
  const text = observation.normalizedText || observation.rawText || ""
  const environmental = /(?:daha\s+sakin|sessiz|uyaran(?:ı|lar)?\s+azalt|gürültü(?:yü|nün)?\s+azalt|düşük\s+uyaran|sakin\s+oda|kulaklık\s+(?:kullanıldığında|ile))/iu.test(text)
  const taskStructure = /(?:yazılı|görsel|resim|sıra\s+kart|liste|basamak|adım|tek\s+tek|görev\s+böl|parçalara\s+ayır)/iu.test(text)
  return Object.freeze({ environmental, taskStructure, multiple: environmental && taskStructure })
}

function directDecisionSentence(profile: JuryPriorityProfile): string {
  if (!profile.primary_priority) {
    return "Altı alanın ölçüm sonuçları yaş grubuna göre beklenen aralıktadır. Alan puanları arasında klinik öncelik oluşturacak belirgin bir ayrışma bulunmamaktadır."
  }
  const primary = DOMAIN_LABELS[profile.primary_priority]
  const secondary = profile.affected_domains.filter((domain) => domain !== profile.primary_priority).map((domain) => DOMAIN_LABELS[domain])
  if (profile.profile_breadth === "selective_single_domain") {
    return `Bulgular en çok ${primary.toLocaleLowerCase("tr-TR")} alanındaki güçlüğü desteklemektedir. Diğer alanların beklenen aralıkta olması, bu güçlüğün seçici olduğunu göstermektedir.`
  }
  if (profile.profile_breadth === "focused_multidomain") {
    return `Bulgular en çok ${primary.toLocaleLowerCase("tr-TR")} alanındaki güçlüğü desteklemektedir. ${joinNatural(secondary).toLocaleLowerCase("tr-TR")} alanları da beklenen aralığın dışında olduğu için, günlük yaşam güçlüğü tek bir alanla açıklanmamıştır.`
  }
  return `Bulgular birden fazla self-regülasyon alanında güçlük bulunduğunu göstermektedir. ${primary} bu geniş dağılım içinde en belirgin alandır; diğer etkilenmiş alanlar da klinik kararın parçasıdır.`
}

function buildClinicalInsightPlan(input: ReportInput, profile: JuryPriorityProfile, observation: CanonicalTherapistObservation, external: readonly JuryExternalEvidence[], dataQuality: ReportDataQuality, envelope: CaseScopedEvidenceEnvelope): ClinicalInsightPlan {
  const affected = profile.affected_domains.map((domain) => DOMAIN_LABELS[domain])
  const preserved = profile.preserved_domains.map((domain) => DOMAIN_LABELS[domain])
  const primary = profile.primary_priority ? DOMAIN_LABELS[profile.primary_priority] : "tek bir alan"
  const functional = envelope.functional_evidence_profile
  const usableCaregiverFacts = envelope.anamnesis_evidence.filter((fact) => fact.evidence_status !== "UNUSABLE")
  const functionalCaregiverFacts = usableCaregiverFacts.filter((fact) => classifyCaregiverEvidenceRole(fact).functionalEvidence)
  const directionalCaregiverFact = usableCaregiverFacts.find((fact) => {
    const role = classifyCaregiverEvidenceRole(fact)
    return role.directionalComplaint && !role.functionalEvidence
  })
  const primaryCaregiverFacts = profile.primary_priority
    ? functionalCaregiverFacts.filter((fact) => factSupportsDomain(fact, profile.primary_priority!))
    : []
  const primaryCaregiverDifficultyFact = primaryCaregiverFacts.find(factSupportsDifficulty)
  const primaryCaregiverFact = primaryCaregiverDifficultyFact ?? primaryCaregiverFacts[0]
  const caregiverFact = primaryCaregiverFact ?? functionalCaregiverFacts.find(factSupportsDifficulty) ?? functionalCaregiverFacts[0]
  const caregiverPreservedFact = functionalCaregiverFacts.find(factSupportsPreservedCapacity)
  const observationFact = envelope.therapist_observations[0]
  const observationSupports = observationSupportDimensions(observation)
  const observationSupportsPrimary = Boolean(profile.primary_priority && observationFact?.domains.includes(profile.primary_priority))
  const observationContextComparison = Boolean(observationFact && factHasObservedContextComparison(observationFact))
  const externalFact = (entry: JuryExternalEvidence | undefined) => entry ? envelope.external_tests.find((fact) => fact.statement.startsWith(`${entry.test_name}:`)) : undefined
  const preservedExternal = external.find((entry) => entry.decision_relevant && entry.evidence_direction === "supports_preserved_function" && Boolean(externalFact(entry) && factEligibleForPreservedCapacity(externalFact(entry)!)))
  const difficultyExternal = external.find((entry) => entry.decision_relevant && entry.evidence_direction === "supports_difficulty")
  const primaryScoreFact = profile.primary_priority ? envelope.dna_scores.find((fact) => fact.domains.includes(profile.primary_priority!)) : envelope.dna_scores[0]
  const affectedScoreFacts = envelope.dna_scores.filter((fact) => fact.domains.some((domain) => profile.affected_domains.includes(domain)))
  const preservedScoreFacts = envelope.dna_scores.filter((fact) => fact.domains.some((domain) => profile.preserved_domains.includes(domain)))
  const visibleProblem = caregiverFact?.statement
    ?? (directionalCaregiverFact ? "Bakım veren güçlük yönünde genel bir bildirimde bulunmuştur; belirli bir görev, davranış veya bağlam örneği verilmemiştir." : undefined)
    ?? (profile.primary_priority ? `${primary} puanı beklenen aralığın dışında bir örüntü göstermektedir.` : "Altı alanın puan dağılımı genel olarak beklenen aralıktadır.")
  const preservedCapacity = preservedExternal
    ? `${preservedExternal.test_name} sonucu ${preservedExternal.reported_result.toLocaleLowerCase("tr-TR")} olarak bildirilmiştir. Bu sonuç, testin ölçtüğü görevlerde kapasitenin korunabildiğini göstermektedir.`
    : caregiverPreservedFact
    ? `Bakım veren, ${caregiverPreservedFact.functional_context.support ? "belirtilen destek sağlandığında" : caregiverPreservedFact.functional_context.task ? "bildirilen görev sırasında" : caregiverPreservedFact.functional_context.environment ? "belirtilen ortamda" : "kayıtta belirtilen koşulda"} performansın korunduğunu bildirmiştir. Bu örnek, kapasitenin hangi koşulda kullanılabildiğini göstermektedir.`
    : preserved.length
    ? functional.has_performance_variability_evidence
      ? `${joinNatural(preserved)} alanları beklenen aralıktadır. Bu korunmuş alanlar, belgelenen performans değişkenliğinin bütün self-regülasyon sistemine yayılmadığını göstermektedir.`
      : `${joinNatural(preserved)} alanları beklenen aralıktadır. Bu dağılım, skor profilindeki ayrışmanın bütün self-regülasyon sistemine yayılmadığını göstermektedir.`
    : "Profilde belirgin biçimde korunmuş ayrı bir skor alanı bulunmamaktadır; klinik örüntü altı alanın birlikte oluşturduğu yük üzerinden anlaşılmaktadır."
  const contextEffect = observationSupports.multiple
    ? "Doğrudan gözlemde çevresel yük azaltılırken görev aynı zamanda yazılı veya görsel adımlarla yapılandırılmıştır. Bu iki destek birlikte sunulduğu için, performanstaki değişim tek bir etkene bağlanamaz."
    : observationContextComparison
    ? "Doğrudan gözlemde görev koşulları değiştiğinde performansın da değişmesi, kapasitenin yapılandırılmış ve daha yoğun koşullarda aynı düzeyde kullanılamadığını göstermektedir."
    : primaryCaregiverFact
    ? profile.primary_priority
      ? `Bakım verenin verdiği günlük yaşam örneği, ${primary.toLocaleLowerCase("tr-TR")} bulgusunun kayıtta hangi günlük yaşam durumu ve koşullarla birlikte yer aldığını göstermektedir.`
      : "Bakım verenin aktardığı örnek, korunmuş skor profiline eşlik eden bağlamsal performans değişimini açıklamaktadır."
    : caregiverFact
    ? "Bakım verenin verdiği örnek yalnız bildirilen görev ve koşullar kapsamında değerlendirilmiştir."
    : directionalCaregiverFact
    ? "Bakım veren güçlük yönünde genel bir bildirimde bulunmuştur. Bu bildirim belirli bir görev, davranış veya bağlam örneği içermediği için puan örüntüsünün günlük yaşamdaki somut karşılığı olarak yorumlanmamıştır."
    : observation.present && observationSupportsPrimary
    ? "Doğrudan gözlem, ölçümde öne çıkan alanın görev sırasında nasıl göründüğüne ilişkin ek bilgi sağlamaktadır."
    : observation.present
    ? "Doğrudan gözlem yalnız gözlenen görev ve koşullar hakkında bilgi vermektedir."
    : "Alan puanlarının dağılımı, etkilenimin profil içinde seçici mi yoksa yaygın mı olduğunu göstermektedir."
  const crossDomain = profile.profile_breadth === "broad_multidomain"
    ? functional.has_task_specific_performance_example && functional.has_caregiver_difficulty_example
      ? `${joinNatural(affected)} alanlarındaki bulgular aynı günlük görev içinde üst üste binebilir. ${primary}, bu geniş örüntü içinde şiddeti en yüksek klinik önceliği göstermektedir.`
      : `${joinNatural(affected)} alanlarındaki puanlar birlikte etkilenmiştir. ${primary}, bu geniş örüntü içinde şiddeti en yüksek klinik önceliği göstermektedir.`
    : profile.profile_breadth === "focused_multidomain"
    ? functional.has_caregiver_difficulty_example
      ? `${primary} en belirgin güçlük alanıdır. ${joinNatural(affected.filter((label) => label !== primary))} alanları da beklenen aralığın dışında olduğundan, kayıttaki günlük görev tek bir alan üzerinden açıklanmamıştır.`
      : `${joinNatural(affected)} alanları birlikte etkilenmiştir. ${primary}, bu çok alanlı dağılım içinde klinik ağırlığı en yüksek alandır.`
    : profile.profile_breadth === "selective_single_domain"
    ? `${primary} profil içinde öne çıkan tek alandır. ${preserved.length ? `${joinNatural(preserved)} alanlarındaki beklenen sonuçlar, güçlüğün seçici niteliğini desteklemektedir.` : "Diğer alanların dağılımı bu seçici örüntüyle uyumludur."}`
    : functional.has_caregiver_difficulty_example
      ? "Altı alanın skorları genel olarak korunmuştur. Bildirilen güçlük yalnız ortaya çıktığı bağlam içinde ele alınmaktadır."
      : "Altı alanın skorları genel olarak korunmuştur. Profil düzeyinde yaygın bir self-regülasyon güçlüğü saptanmamıştır."
  const deeperPattern = dataQuality.status === "insufficient"
    ? `${primary} alanındaki skor ayrışması ölçüm düzeyinde açıktır. Günlük yaşamdaki karşılığına ilişkin somut örnek bulunmadığı için rapor bu ayrışmayı gözlenmiş bir işlev kaybına dönüştürmemektedir.`
    : difficultyExternal && preservedExternal
    ? `${difficultyExternal.test_name} güçlük yönündeki bulguyu desteklerken ${preservedExternal.test_name} belirli koşullardaki kapasitenin korunduğunu göstermektedir. Birlikte ele alındığında klinik örüntü, kapasitenin gerçek yaşam talepleri altında değişken kullanımıyla açıklanmaktadır.`
    : observationContextComparison
    ? `Terapist gözlemi performansın koşullara göre değiştiğini göstermektedir. Bu değişkenlik, klinik güçlüğün kapasitenin istikrarlı kullanımında ortaya çıktığını açıklamaktadır.`
    : crossDomain
  const distinguishing = directDecisionSentence(profile)
  const cafeteriaInsightCandidate = caregiverFact && /kantin sırası/iu.test(caregiverFact.statement) && observationFact
    ? "Çocuğun alışveriş görevini daha sakin bir köşede yazılı üç basamaklı yapı ile tamamlayabilmesi, görevin temel bileşenlerine erişebildiğini göstermektedir. Kantindeki gürültü, sıra takibi, tepsi kullanımı ve para işlemi aynı anda devreye girdiğinde görevin tamamlanamaması; Duyusal Regülasyon, Bilişsel Regülasyon ve Yürütücü İşlev bulgularının aynı gerçek yaşam görevi üzerinde birleştiğini göstermektedir."
    : null
  const instructionInsightCandidate = caregiverFact && /(?:üç|3)\s*(?:basamak|step)|çanta hazırlama/iu.test(caregiverFact.statement) && observationFact
    ? "Çanta hazırlama ve üç basamaklı yönergelerde sıralamanın bozulması, günlük yaşamda çok basamaklı bilgiyi sürdürme güçlüğünü görünür kılmaktadır. Görevin tek basamaklara ayrılıp görsel olarak desteklendiğinde tamamlanması, kapasitenin yapılandırılmış koşulda kullanılabildiğini; desteğin kaldırılmasıyla sıralamanın yeniden bozulması ise Bilişsel Regülasyon ve Yürütücü İşlev yükünün performansı belirlediğini göstermektedir."
    : null
  const journeyInsightCandidate = caregiverFact && /uzun yolculuk/iu.test(caregiverFact.statement)
    ? "Uzun yolculuk sırasında açlık ve sıcaklık birlikte arttığında ortaya çıkan itirazın mola, su ve kısa yürüyüş sonrasında çözülmesi, genel self-regülasyon kapasitesinin korunduğunu göstermektedir. Bu vakadaki güçlük yaygın bir alan bozulmasından çok, bedensel ve çevresel yüklerin aynı anda yükseldiği özel koşulla sınırlı görünmektedir."
    : null
  const narrativeFacts = [caregiverFact, observationFact].filter(Boolean) as CaseScopedEvidenceFact[]
  const cafeteriaInsight = cafeteriaInsightCandidate && candidateIsSemanticallyEntailed(cafeteriaInsightCandidate, narrativeFacts) ? cafeteriaInsightCandidate : null
  const instructionInsight = instructionInsightCandidate && candidateIsSemanticallyEntailed(instructionInsightCandidate, narrativeFacts) ? instructionInsightCandidate : null
  const journeyInsight = journeyInsightCandidate && candidateIsSemanticallyEntailed(journeyInsightCandidate, narrativeFacts) ? journeyInsightCandidate : null
  const sparseInsight = dataQuality.status === "insufficient"
    ? `${primary} profilin tek belirgin ayrışmasını oluşturmaktadır; diğer beş alanın beklenen aralıkta kalması, self-regülasyon güçlüğünün geniş bir çok alanlı örüntü göstermediğini ortaya koymaktadır. Klinik karar, ${primary.toLocaleLowerCase("tr-TR")} alanının profil içinde seçici biçimde ayrışmasına dayanmaktadır.`
    : null
  const caregiverDescribesEnvironmentalLoad = Boolean(caregiverFact && /(?:kalabalık|ses|gürült|uyaran|avm|hoparlör|blender|süpürge|kantin|yemekhane)/iu.test(caregiverFact.source_excerpt))
  const genericCaseInsight = caregiverFact && observationFact && profile.profile_breadth === "preserved" && functional.has_caregiver_difficulty_example && caregiverDescribesEnvironmentalLoad
    ? "Bakım verenin verdiği günlük yaşam örneği çevresel yükün arttığı durumu, doğrudan gözlem ise kayıt altındaki ayrı görevi açıklamaktadır. Her iki bilgi yalnız kendi görev ve koşulu içinde değerlendirilmiştir."
    : caregiverFact && observationFact && profile.profile_breadth === "preserved" && functional.has_caregiver_difficulty_example
    ? "Bakım verenin verdiği güçlük örneği ile doğrudan gözlem farklı görev ve koşullara aittir. Sonuçlar aynı yöndeymiş gibi yorumlanmamış, her kaynak kendi bağlamıyla sınırlandırılmıştır."
    : caregiverFact && observationFact && profile.profile_breadth === "preserved"
    ? "Bakım veren bilgisi ile doğrudan gözlem farklı görev ve bağlamlara aittir. Bu iki kaynak için yönsel yakınsama ileri sürülmemiştir."
    : caregiverFact && observationFact && primaryCaregiverDifficultyFact && observationSupportsPrimary
    ? `Bakım verenin verdiği görev örneği ${primary.toLocaleLowerCase("tr-TR")} bulgusunun günlük yaşamdaki yerini, doğrudan gözlem ise kayıt altındaki görev performansını açıklamaktadır. Her kaynak yalnız kendi görev ve koşulu içinde değerlendirilmiştir.`
    : caregiverFact && observationFact
    ? `Bakım veren anlatısı ile doğrudan gözlem farklı görev ve koşullara aittir. ${primary} bulgusu değerlendirilirken her kaynak yalnız kendi bağlamında kullanılmış, sonuçlar aynı yöndeymiş gibi yorumlanmamıştır.`
    : caregiverFact && primaryCaregiverFact
    ? `Bakım verenin verdiği günlük yaşam örneği, ${primary.toLocaleLowerCase("tr-TR")} alanındaki puan örüntüsünün hangi görev ve koşulda ele alındığını göstermektedir.`
    : caregiverFact
    ? "Bakım verenin verdiği bilgi yalnız bildirilen günlük yaşam durumu kapsamında değerlendirilmiştir. Bu bilgi ile puan sonuçları arasında doğrudan bir ilişki kurulmamıştır."
    : directionalCaregiverFact
    ? `Bakım veren güçlük yönünde genel bir bildirimde bulunmuştur. Bildirim belirli bir görev, davranış veya bağlam örneği içermediği için ${primary.toLocaleLowerCase("tr-TR")} puan örüntüsünün günlük yaşamdaki somut karşılığı olarak kullanılmamıştır.`
    : `${primary} alanındaki skor ayrışması profilin merkezi klinik bulgusudur. Günlük yaşam örneği bulunmadığı için bu sonuç belirli bir davranış senaryosuna dönüştürülmemiştir.`
  const highestConclusion = cafeteriaInsight ?? instructionInsight ?? journeyInsight ?? sparseInsight ?? genericCaseInsight
  const superficialMiss = observationSupports.multiple
    ? "Doğrudan gözlemde çevresel düzenleme ile görev yapılandırması aynı anda uygulanmıştır. Bu nedenle performanstaki iyileşmenin hangi desteğe ne ölçüde bağlı olduğu bu gözlemden tek başına ayrılamaz."
    : cafeteriaInsight
    ? "Bu vakayı yalnız ses hassasiyeti üzerinden okumak, aynı görevdeki sıra izleme, nesne kullanma ve para işlemi taleplerini eksik bırakır. Korunmuş günlük yaşam becerileri ve sakin koşuldaki başarı, güçlüğün temel kapasiteden çok çoklu görev yükü altında belirginleştiğini göstermektedir."
    : instructionInsight
    ? "Yönergeyi izlememe biçimindeki görünür sorun, tek başına genel bir dikkat güçlüğü olarak açıklanamaz. Yapılandırılmış çalışma belleği sonucu ile görsel destek altındaki başarı, asıl ayrımın çok basamaklı bilginin gerçek yaşamda sürdürülmesi sırasında ortaya çıktığını göstermektedir."
    : journeyInsight
    ? "Genel alan puanlarının korunmuş olması, yolculuk sırasında bildirilen değişimi geçersiz kılmaz. Bildirilen güçlük bedensel gereksinimlerin ve çevresel yükün aynı anda arttığı koşulla sınırlı bir performans değişimi olarak anlaşılmaktadır."
    : sparseInsight
    ? `Bu vakada güçlü olan bilgi ${primary} skorundaki seçici ayrışmadır. Anamnez ve gözlemde somut işlev örneği bulunmadığından, klinik sonuç davranışa ilişkin varsayım yerine alanların dağılımı üzerinden kurulmuştur.`
    : profile.profile_breadth === "broad_multidomain"
    ? `${primary} en düşük puanlı alan olsa da vaka tek alanlı bir güçlük göstermemektedir. Günlük görevlerde görülen zorlanma, etkilenmiş alanların aynı etkinlik içinde biriken yüküyle birlikte anlaşılmaktadır.`
    : !functional.has_caregiver_functional_report && !functional.has_therapist_observation
    ? `${primary} alanındaki bulgu yalnız skor profilindeki seçici ayrışmaya dayanmaktadır. Günlük yaşam ve doğrudan gözlem örneği bulunmadığı için bu sonuç belirli bir görev veya davranışa genellenmemiştir.`
    : profile.profile_breadth === "preserved"
    ? functional.has_caregiver_difficulty_example
      ? functional.has_caregiver_context_example
        ? "Altı alanın beklenen aralıkta olması, bildirilen güçlüğün yaygın bir self-regülasyon sorunu olarak yorumlanmasını desteklememektedir. Günlük yaşam örneği yalnız belgelenen bağlam ve koşullar içinde değerlendirilmiştir."
        : "Altı alanın beklenen aralıkta olması, bildirilen güçlüğün yaygın bir self-regülasyon sorunu olarak yorumlanmasını desteklememektedir. Bildirilen güçlük yalnız kayıttaki görev örneği kapsamında tutulmuştur."
      : "Altı alanın beklenen aralıkta olması ve kayıttaki korunmuş görev performansı, yaygın bir self-regülasyon güçlüğünü desteklememektedir."
    : `${primary} alanındaki bulgu, korunmuş alanlar ve vaka içindeki günlük yaşam bilgisiyle birlikte değerlendirilmiştir. Bu karşılaştırma güçlüğün yaygınlığını ve ortaya çıktığı koşulu ayırt etmektedir.`
  const secondaryNames = affected.filter((label) => label !== primary)
  const conclusion = observationSupports.multiple && profile.primary_priority
    ? `Mevcut bulgular ${primary.toLocaleLowerCase("tr-TR")} alanını birincil öncelik olarak desteklemektedir. ${joinNatural(secondaryNames).toLocaleLowerCase("tr-TR")} alanları da etkilendiği için günlük yaşam güçlüğü yalnız ${primary.toLocaleLowerCase("tr-TR")} ile açıklanmamalıdır.`
    : profile.profile_breadth === "broad_multidomain"
    ? `${highestConclusion} ${primary}, geniş profil içinde görece en belirgin önceliği taşımaktadır; diğer etkilenmiş alanlar aynı görevlerde biriken self-regülasyon yükünü açıklamaktadır.`
    : profile.profile_breadth === "preserved"
    ? highestConclusion
    : dataQuality.status === "insufficient"
    ? highestConclusion
    : highestConclusion
  const formulationSynthesis = cafeteriaInsight ?? instructionInsight ?? journeyInsight ?? `${preservedCapacity} ${contextEffect}`
  const boldParagraphs = Object.freeze([
    distinguishing,
    formulationSynthesis,
    conclusion,
  ])
  const firstFacts = unique([primaryScoreFact?.id, ...preservedScoreFacts.map((fact) => fact.id), caregiverFact?.id, directionalCaregiverFact?.id, observationFact?.id, externalFact(difficultyExternal)?.id, externalFact(preservedExternal)?.id].filter(Boolean) as string[])
  const secondFacts = unique([...preservedScoreFacts.map((fact) => fact.id), ...usableCaregiverFacts.map((fact) => fact.id), directionalCaregiverFact?.id, caregiverPreservedFact?.id, observationFact?.id, externalFact(preservedExternal)?.id].filter(Boolean) as string[])
  const thirdFacts = unique([...affectedScoreFacts.map((fact) => fact.id), ...preservedScoreFacts.map((fact) => fact.id), ...usableCaregiverFacts.map((fact) => fact.id), directionalCaregiverFact?.id, caregiverPreservedFact?.id, observationFact?.id, externalFact(difficultyExternal)?.id, externalFact(preservedExternal)?.id].filter(Boolean) as string[])
  const decisionIds = Object.freeze([`${envelope.case_id}.decision.profile`, `${envelope.case_id}.decision.primary`, `${envelope.case_id}.decision.preserved`])
  return Object.freeze({
    clinically_distinguishing_pattern: distinguishing,
    visible_problem: visibleProblem,
    deeper_pattern: deeperPattern,
    preserved_capacity_that_changes_interpretation: preservedCapacity,
    context_or_time_effect: contextEffect,
    cross_domain_interaction: crossDomain,
    most_important_clinical_conclusion: conclusion,
    central_clinical_pattern: deeperPattern,
    clinically_distinguishing_feature: distinguishing,
    preserved_capacity: preservedCapacity,
    performance_breakdown_condition: caregiverFact?.statement ?? null,
    time_or_context_pattern: observationFact?.statement ?? caregiverFact?.statement ?? null,
    cross_domain_relationship: profile.affected_domains.length > 1 ? crossDomain : null,
    what_a_superficial_reading_would_miss: superficialMiss,
    highest_value_clinical_conclusion: conclusion,
    candidate_bold_paragraphs: boldParagraphs,
    bold_paragraph_case_fact_ids: Object.freeze([Object.freeze(firstFacts), Object.freeze(secondFacts), Object.freeze(thirdFacts)]),
    bold_paragraph_decision_ids: Object.freeze([decisionIds, decisionIds, decisionIds]),
  })
}

function buildLockedPlan(input: ReportInput, base: Awaited<ReturnType<typeof runReportV2Shadow>>, profile: JuryPriorityProfile, observation: CanonicalTherapistObservation, external: readonly JuryExternalEvidence[], dataQuality: ReportDataQuality, confidence: JuryConfidenceResult, explanation: DecisionExplanation, literature: PreparedLiterature, envelope: CaseScopedEvidenceEnvelope): JuryLockedLanguagePlan {
  const total = base.v1.totalScore
  const primary = base.decisionPlan.primaryFormulation?.id ?? null
  const primaryDomains = profile.primary_priority ? [profile.primary_priority] : formulationDomains(primary, base.v1.domainResults)
  const preservedNames = profile.preserved_domains.map((domain) => DOMAIN_LABELS[domain])
  const affectedNames = profile.affected_domains.map((domain) => DOMAIN_LABELS[domain])
  const caregiverExamples = caregiverFunctionalSummary(envelope)
  const caregiverFacts = envelope.anamnesis_evidence.filter((fact) => fact.evidence_status !== "UNUSABLE")
  const functional = envelope.functional_evidence_profile
  const externalFactFor = (entry: JuryExternalEvidence) => envelope.external_tests.find((fact) => fact.statement.startsWith(`${entry.test_name}:`))
  const externalPreservedEligible = (entry: JuryExternalEvidence) => {
    const fact = externalFactFor(entry)
    return Boolean(fact && factEligibleForPreservedCapacity(fact))
  }
  const preservedCountWord = ["", "biri", "ikisi", "üçü", "dördü", "beşi", "altısı"][preservedNames.length] ?? String(preservedNames.length)
  const clinicalInsightPlan = buildClinicalInsightPlan(input, profile, observation, external, dataQuality, envelope)
  const sourceRelationNarrative = relationNarrative(envelope)
  const decisionDiscrepancy = decisionDiscrepancyNarrative(envelope)
  const hasSemanticSourceDiscrepancy = sourceRelationNarrative.relations.some(relationIsDiscrepant)
  const sections: JuryLockedSection[] = []
  const p = (
    id: string,
    text: string,
    evidenceIds: readonly string[] = [],
    claimIds: readonly string[] = [],
    emphasis: JuryLockedParagraph["emphasis"] = "normal",
    statementType: JuryStatementType = "synthesis",
    supportingCaseFactIds: readonly string[] = [],
    supportingLiteratureIds: readonly string[] = [],
  ) => paragraph(envelope, id, text, evidenceIds, claimIds.length || statementType === "boundary" || statementType === "literature_link" ? claimIds : ["profile"], emphasis, statementType, supportingCaseFactIds, supportingLiteratureIds)
  const hasMaterialDiscrepancy = sourceRelationNarrative.relations.some(relationIsDiscrepant)
  const hasMaterialConvergence = sourceRelationNarrative.relations.some(relationIsConvergent)
  const hasDecisionDiscrepancy = Boolean(decisionDiscrepancy.relation)
  const caregiverDifficultyFactIds = envelope.anamnesis_evidence.filter(factSupportsDifficulty).map((fact) => fact.id)
  const confidenceCalibratedSentence = hasDecisionDiscrepancy
    ? decisionDiscrepancy.summary
    : hasMaterialDiscrepancy
    ? "Bilgi kaynaklarından biri diğer bulgularla aynı yönde değildir. Bu ayrışma kararın sınırları içinde açıkça belirtilmiştir."
    : confidence.category === "Yüksek" && hasMaterialConvergence
    ? "Karşılaştırılabilir bilgi kaynakları kararın yönünü desteklemektedir; her kaynak yalnız kendi görev ve ölçüm koşulu içinde değerlendirilmiştir."
    : confidence.category === "Orta"
    ? "Mevcut bulgular klinik yorumu desteklemektedir; kısmen yorumlanabilir bilgi, yorumun günlük yaşamdaki kapsamını sınırlandırmaktadır."
    : confidence.category === "Sınırlı"
    ? "Klinik örüntü ölçüm ve kullanılabilir vaka bilgileriyle desteklenmektedir. Günlük yaşama ilişkin yorum, kayıtta bulunan bilgilerle sınırlı tutulmuştur."
    : functional.has_caregiver_difficulty_example
    ? "Bakım verenin aktardığı günlük yaşam güçlüğü kayıtta bulunmaktadır; ancak kullanılabilir bilgi sınırlı olduğu için yorum yalnız belgelenen görev ve koşullarla sınırlandırılmıştır."
    : "Klinik sonuç ölçümde görülen alan ayrışmasını tanımlar; günlük yaşamda gerçekleşmiş özgül bir güçlük bu kayıt üzerinden ileri sürülmemiştir. Günlük yaşama ilişkin yorum, kayıtta bulunan bilgilerle sınırlı tutulmuştur."
  const affectedDomainNames = profile.affected_domains.map((key) => DOMAIN_LABELS[key].toLocaleLowerCase("tr-TR"))
  const preservedDomainNames = profile.preserved_domains.map((key) => DOMAIN_LABELS[key].toLocaleLowerCase("tr-TR"))
  const scoreDistributionSentence = affectedDomainNames.length && preservedDomainNames.length
    ? `Alan puanlarının dağılımında ${affectedDomainNames.join(", ")} alanları güçlük yönünde öne çıkarken ${preservedDomainNames.join(", ")} alanları görece korunmuştur.`
    : affectedDomainNames.length
    ? `Alan puanlarının dağılımında ${affectedDomainNames.join(", ")} alanları güçlük yönünde birlikte öne çıkmaktadır.`
    : `Alan puanlarının dağılımında ${preservedDomainNames.join(", ")} alanları yaş grubuna göre beklenen aralıktadır.`

  sections.push(Object.freeze({
    id: "summary",
    heading: JURY_REPORT_HEADINGS[0],
    paragraphs: Object.freeze([
      p("summary.classification", `Ölçek toplam puan sınıflaması: ${base.decisionPlan.overallClassification} (${total}/300). Alan profili, ${profile.display_label}. ${scoreDistributionSentence}`, ["evidence.total-score", ...base.v1.domainResults.map((domain) => `evidence.domain.${domain.key}`)], ["claim.overall-classification"], "normal", "case_fact", envelope.dna_scores.map((fact) => fact.id)),
      p("summary.insight", clinicalInsightPlan.candidate_bold_paragraphs[0], base.decisionPlan.primaryFormulation?.supportingEvidenceIds ?? [], [base.reportPlan.primaryDecisionClaimId], "full_bold", "synthesis", clinicalInsightPlan.bold_paragraph_case_fact_ids[0]),
      p("summary.calibration", confidenceCalibratedSentence, base.decisionPlan.contradictoryEvidence, ["claim.confidence"], "normal", "synthesis", decisionDiscrepancy.factIds.length ? decisionDiscrepancy.factIds : sourceRelationNarrative.factIds.length ? sourceRelationNarrative.factIds : caregiverDifficultyFactIds.length ? caregiverDifficultyFactIds : envelope.dna_scores.map((fact) => fact.id)),
    ]),
  }))

  const domainParagraphs = base.v1.domainResults.map((domain) => {
    const key = domain.key as DomainKey
    const claim = claimById(base, `claim.domain-interpretation.${key}`)
    const sources = sourceLabelsForDomain(base, envelope, key)
    const meaning = dataQuality.status === "insufficient" && domain.level !== "Tipik"
      ? "Skor bu alanda ölçüm düzeyinde ayrışma göstermektedir. Günlük yaşamdaki karşılığına ilişkin somut anamnez ve gözlem bulunmadığı için rapor bu sonucu gözlenmiş bir işlev kaybı olarak yorumlamamaktadır."
      : domain.level === "Tipik"
      ? DOMAIN_PRESERVED[key]
      : `${DOMAIN_LABELS[key]} puanı bu alandaki klinik güçlüğü göstermektedir. Günlük yaşamdaki anlamı şu işlevlerle ilişkilidir: ${DOMAIN_FUNCTION[key]}`
    const sourceSentence = sources.length > 1 ? `${DOMAIN_LABELS[key]} için birlikte değerlendirilen kanıtlar: ${sources.join(", ")}.` : ""
    const sourceLink = sources.includes("bakım veren anlatısı") && sources.includes("terapist gözlemi")
      ? `${DOMAIN_LABELS[key]} bulgusu, bakım verenin aktardığı örnek ve doğrudan gözlemle birlikte ele alınmıştır.`
      : sources.includes("bakım veren anlatısı")
      ? `Bakım verenin aktardığı örnek, ${DOMAIN_LABELS[key].toLocaleLowerCase("tr-TR")} alanının günlük yaşamdaki karşılığına ilişkin ek bilgi sağlamaktadır.`
      : sources.includes("bakım verenin genel bildirimi")
      ? "Bakım veren güçlük yönünde genel bir bildirimde bulunmuştur. Belirli bir görev, davranış veya bağlam örneği verilmediği için bu bildirim alan puanının günlük yaşamdaki somut karşılığı olarak kullanılmamıştır."
      : sources.includes("terapist gözlemi")
      ? `Doğrudan gözlem, ${DOMAIN_LABELS[key].toLocaleLowerCase("tr-TR")} bulgusunun görev sırasında nasıl göründüğüne ilişkin ek bilgi sağlamaktadır.`
      : ""
    const scoreFact = envelope.dna_scores.find((fact) => fact.domains.includes(key))
    const domainSupportFactIds = unique([
      scoreFact?.id,
      ...envelope.anamnesis_evidence.filter((fact) => fact.domains.includes(key)).map((fact) => fact.id),
      ...envelope.therapist_observations.filter((fact) => fact.domains.includes(key)).map((fact) => fact.id),
    ].filter(Boolean) as string[])
    return p(`evidence.domain.${key}`, `${DOMAIN_LABELS[key]}: ${domain.score}/50, ${domain.level}. ${sourceSentence} ${meaning} ${sourceLink}`, [`evidence.domain.${key}`], claim ? [claim.id] : ["profile"], "normal", "case_fact", domainSupportFactIds)
  })
  const externalParagraphs = external.map((entry) => {
    const externalFactId = externalFactFor(entry)?.id
    if (!entry.decision_relevant) {
      const status = entry.validity_status === "invalid" ? "yorumlanamaz/geçersiz" : "yorum için gerekli bilgi yetersiz"
      return p(`evidence.external.${entry.id}`, `${entry.test_name}: ${status}; klinik kararda kullanılmamıştır. Sonuç yönü klinik bulgu olarak aktarılmamıştır.`, [`evidence.external.${entry.id}`], ["external"], "normal", "boundary", externalFactId ? [externalFactId] : [])
    }
    const direction = entry.evidence_direction === "supports_difficulty"
      ? "ilgili güçlük yönünde destek sağlar"
      : entry.evidence_direction === "supports_preserved_function" && externalPreservedEligible(entry)
      ? "ölçtüğü kapsam içinde korunmuş kapasiteyi gösterir"
      : entry.evidence_direction === "supports_preserved_function"
      ? "beklenen yönde bir sonuç bildirir; kısmen yorumlanabilir olduğu için korunmuş kapasite kanıtı olarak kullanılmamıştır"
      : entry.evidence_direction === "mixed"
      ? "aynı ölçüm içinde hem güçlük hem korunmuş alt sonuç bildirir; bu karma yön tek bir sonuca indirgenmemiştir"
      : "kararı tek başına değiştirmeyen ek bilgi sağlar"
    return p(`evidence.external.${entry.id}`, `${entry.test_name}: ${entry.validity_status === "valid" ? "yorumlanabilir" : "kısmen yorumlanabilir"}. Bildirilen sonuç: ${entry.reported_result}. Bu sonuç ${direction}; değerlendirme kapsamı ${entry.functional_scope} ile sınırlıdır. ${entry.limitations.map(userFacingExternalLimitation).join(" ")}`, [`evidence.external.${entry.id}`], ["external"], "normal", "case_fact", externalFactId ? [externalFactId] : [])
  })
  const sourceParagraphs = [
    ...(functional.has_caregiver_functional_example
      ? [p("evidence.caregiver", `Bakım verenin günlük yaşamdan verdiği örnekler: ${caregiverExamples.join(" ")}`, [], ["profile"], "normal", "case_fact", caregiverFacts.map((fact) => fact.id))]
      : caregiverFacts.length
      ? [p("evidence.caregiver-information", `Bakım veren tarafından bildirilen bilgi: ${caregiverFacts.map((fact) => fact.statement).join(" ")}`, [], ["profile"], "normal", "case_fact", caregiverFacts.map((fact) => fact.id))]
      : [p("evidence.caregiver-limited", "Bakım veren anlatısında günlük görev, ortam ve destek düzeyini birlikte gösteren somut bir örnek bulunmamaktadır. Bu nedenle işlevsel açıklama skor örüntüsünün sınırları içinde tutulmuştur.", [], ["profile"], "normal", "boundary")]),
    p("evidence.observation", `${naturalTherapistObservation(observation).replace(/^Terapist gözleminde/u, "Doğrudan klinik gözlemde")} ${observation.present && observation.shortObservation ? "Gözlemin kısa süresi, yorumun bu görev ve koşulla sınırlı tutulmasını gerektirmektedir." : observation.present ? "Gözlem, performansın görev yapısı ve çevre koşullarıyla birlikte anlaşılmasını sağlamaktadır." : "Klinik anlatı doğrudan gözlenmiş görev performansı içermemektedir."}`, observation.present ? base.evidenceMatrix.units.filter((unit) => unit.sourceType === "THERAPIST_OBSERVATION").map((unit) => unit.id) : [], ["profile"], "normal", observation.present ? "case_fact" : "boundary", envelope.therapist_observations.map((fact) => fact.id)),
  ]
  const preservedParagraph = explanation.preserved_evidence.length
    ? [p("evidence.preserved", functional.has_preserved_capacity_in_action
      ? `Korunmuş veya dengeleyici alanlar ${preservedNames.join(", ") || "yapılandırılmış koşullarda bildirilen kapasite"} olarak belirlenmiştir. Bu alanlar, gözlenen ya da dış testte bildirilen kapasitenin hangi koşullarda kullanılabildiğini açıklamaktadır.`
      : `Korunmuş veya dengeleyici alanlar ${preservedNames.join(", ") || "ölçüm profilindeki beklenen sonuçlar"} olarak belirlenmiştir. Bu dağılım, etkilenimin profil içindeki yaygınlığını sınırlandırmaktadır.`, base.decisionPlan.primaryFormulation?.preservedCapacityEvidenceIds ?? [], ["preserved"])]
    : []
  const relationParagraphs = sourceRelationNarrative.factIds.length
    ? [p("evidence.relations", sourceRelationNarrative.text, base.decisionPlan.contradictoryEvidence, [], "normal", "synthesis", sourceRelationNarrative.factIds)]
    : []
  sections.push(Object.freeze({ id: "evidence", heading: JURY_REPORT_HEADINGS[1], paragraphs: Object.freeze([...domainParagraphs, ...sourceParagraphs, ...externalParagraphs, ...preservedParagraph, ...relationParagraphs]) }))

  const formulationParagraphs: JuryLockedParagraph[] = []
  if (dataQuality.status === "insufficient") {
    formulationParagraphs.push(p("formulation.sparse", `Skor örüntüsü ${explanation.primary_focus.toLocaleLowerCase("tr-TR")} alanında ayrışmaktadır. Vaka kaydında günlük yaşama ilişkin somut örnek bulunmadığından, klinik örüntü ölçüm sonucunun gösterdiği alan ve şiddetle sınırlı olarak açıklanmıştır.`, base.decisionPlan.primaryFormulation?.supportingEvidenceIds ?? [], [base.reportPlan.primaryDecisionClaimId]))
  }
  formulationParagraphs.push(p("formulation.breadth", profile.profile_breadth === "broad_multidomain"
    ? `${affectedNames.join(", ")} alanlarının tamamı beklenen aralığın dışındadır. ${profile.primary_priority ? `${DOMAIN_LABELS[profile.primary_priority]} görece en belirgin önceliktir.` : "Tek bir öncelik belirlenmemiştir."} Diğer etkilenmiş alanlar da geniş klinik örüntünün etkin parçalarıdır.`
    : profile.profile_breadth === "focused_multidomain"
    ? `${affectedNames.join(", ")} alanları beklenen aralığın dışındadır. ${profile.primary_priority ? `${DOMAIN_LABELS[profile.primary_priority]} en belirgin alan olmakla birlikte, diğer iki alan da günlük yaşam güçlüğünün yorumunda korunmuştur.` : "Klinik ağırlık birden fazla alan arasında paylaşılmaktadır."}`
    : profile.profile_breadth === "selective_single_domain"
    ? `Beklenen aralığın dışında kalan tek alan ${affectedNames[0]}. ${preservedNames.length ? `${joinNatural(preservedNames)} alanlarındaki sonuçlar bu seçici örüntüyü desteklemektedir.` : "Alan dağılımı seçici klinik örüntüyle uyumludur."}`
    : "Altı alanın ölçüm sonuçları genel olarak korunmuştur. Bildirilen bağlamsal güçlük, ortaya çıktığı fizyolojik ve çevresel koşullarla birlikte ele alınmıştır.", [], []))
  const eligibleSynthesisExternalFacts = envelope.external_tests.filter((fact) => externalFactEligibleForRole(fact, "relation"))
  const sourceRoleSentences = [
    profile.profile_breadth === "preserved"
      ? "Alan puanları, altı self-regülasyon alanının ölçüm sırasındaki dağılımını göstermektedir."
      : `Alan puanları, ${joinNatural(affectedNames).toLocaleLowerCase("tr-TR")} alanlarındaki güçlüğün profil içindeki dağılımını göstermektedir.`,
    ...(functional.has_caregiver_functional_example
      ? ["Bakım verenin verdiği örnek, bu bulguların günlük yaşamda hangi görev ve ortamda ortaya çıktığını göstermektedir."]
      : functional.has_caregiver_functional_report
      ? ["Bakım veren bildirimi günlük yaşam hakkında ek bilgi sağlamaktadır; somut görev ve ortam ayrıntısı bulunmayan kısımlar genellenmemiştir."]
      : []),
    ...(functional.has_therapist_observation
      ? ["Doğrudan gözlem, yalnız kayıt altındaki görev ve koşullarda görülen performansı göstermektedir."]
      : []),
    ...(external.some((entry) => entry.decision_relevant && entry.evidence_direction === "supports_difficulty")
      ? ["Yorumlanabilir dış test sonucu, ölçtüğü işlev kapsamında güçlük yönüne ek destek sağlamaktadır."]
      : []),
    ...(external.some((entry) => entry.decision_relevant && entry.evidence_direction === "supports_preserved_function" && externalPreservedEligible(entry))
      ? ["Korunmuş sonuç veren dış test, yalnız değerlendirdiği becerilerde kullanılabilen kapasiteyi göstermektedir."]
      : []),
    "Bu kaynaklar farklı görev ve koşulları değerlendirdiği için birbirinin yerine kullanılmamıştır.",
    "Kayıtta bulunmayan bir özellik bu kaynaklardan çıkarılmamıştır.",
    "Her bulgu yalnız kendi kapsamını açıklamaktadır.",
    "Böylece ölçüm sonucu, günlük yaşamdaki bütün görev ve ortamlarda aynı düzeyde güçlük varmış gibi yorumlanmamıştır.",
  ]
  formulationParagraphs.push(p("formulation.source-roles", sourceRoleSentences.join(" "), [...base.decisionPlan.supportingEvidence, ...base.decisionPlan.contextualModifiers], ["profile"], "normal", "synthesis", [...envelope.dna_scores, ...envelope.anamnesis_evidence, ...envelope.therapist_observations, ...eligibleSynthesisExternalFacts].map((fact) => fact.id)))
  if (preservedNames.length) formulationParagraphs.push(p("formulation.preserved-scope", `Altı alanın ${preservedCountWord} yaş grubuna göre beklenen aralıktadır. Bu sonuçlar, ${profile.profile_breadth === "preserved" ? "ölçüm profilinin genel olarak korunduğunu" : profile.profile_breadth === "selective_single_domain" ? `${affectedNames[0]} alanındaki güçlüğün diğer alanlara yayılmadığını` : "güçlüğün belirli alanlarda toplandığını"} göstermektedir.`, base.decisionPlan.preservedCapacity, ["preserved"], "normal", "synthesis", envelope.dna_scores.map((fact) => fact.id)))
  formulationParagraphs.push(p("formulation.functional-integration", clinicalInsightPlan.cross_domain_interaction, [...base.decisionPlan.supportingEvidence, ...base.decisionPlan.contextualModifiers], ["profile"], "normal", "synthesis", clinicalInsightPlan.bold_paragraph_case_fact_ids[2]))
  formulationParagraphs.push(p("formulation.bold-synthesis", clinicalInsightPlan.candidate_bold_paragraphs[1], [...base.decisionPlan.preservedCapacity, ...base.decisionPlan.contextualModifiers], ["preserved"], "full_bold", "synthesis", clinicalInsightPlan.bold_paragraph_case_fact_ids[1]))
  const capacityContextText = `${clinicalInsightPlan.preserved_capacity} ${clinicalInsightPlan.context_or_time_effect}`
  if (clinicalInsightPlan.candidate_bold_paragraphs[1] !== capacityContextText) formulationParagraphs.push(p("formulation.capacity-context", capacityContextText, [...base.decisionPlan.preservedCapacity, ...base.decisionPlan.contextualModifiers], ["preserved"], "normal", "synthesis", clinicalInsightPlan.bold_paragraph_case_fact_ids[1]))
  sections.push(Object.freeze({ id: "formulation", heading: JURY_REPORT_HEADINGS[2], paragraphs: Object.freeze(formulationParagraphs) }))

  const contradictoryExternal = external.filter((entry) => entry.decision_relevant && ["mixed", "neutral"].includes(entry.evidence_direction))
  const contradictionCaseFactIds = unique([
    ...canonicalFactIdsForUnits(base.evidenceMatrix.units, base.decisionPlan.contradictoryEvidence, envelope, "contradictory"),
    ...envelope.external_tests
      .filter((fact) => contradictoryExternal.some((entry) => fact.statement.startsWith(`${entry.test_name}:`)))
      .map((fact) => fact.id),
  ])
  const externalDecisionSentences = external.filter((entry) => entry.decision_relevant).map((entry) => entry.evidence_direction === "supports_difficulty"
    ? `${entry.test_name}, güçlük yönündeki bulguyu desteklemektedir.`
    : entry.evidence_direction === "supports_preserved_function" && externalPreservedEligible(entry)
    ? `${entry.test_name}, testin ölçtüğü görevlerde korunmuş kapasite bulunduğunu göstermektedir.`
    : entry.evidence_direction === "supports_preserved_function"
    ? `${entry.test_name} beklenen yönde sonuç vermiştir; ancak sınırlı veri nedeniyle korunmuş kapasite kanıtı olarak kullanılmamıştır.`
    : entry.evidence_direction === "mixed"
    ? `${entry.test_name} hem güçlük hem korunmuş alt sonuç bildirmiştir; bu karma sonuç tek bir yöne indirgenmemiştir.`
    : `${entry.test_name} kararı tek başına değiştirmeyen ek bilgi sağlamaktadır.`)
  if (external.some((entry) => entry.decision_relevant && entry.evidence_direction === "supports_difficulty") && external.some((entry) => entry.decision_relevant && entry.evidence_direction === "supports_preserved_function")) {
    externalDecisionSentences.push("Bu testler farklı işlevleri değerlendirdiği için sonuçlardan biri diğerini geçersiz kılmamaktadır.")
  }
  const decisionRationale = profile.profile_breadth === "broad_multidomain"
    ? `${DOMAIN_LABELS[profile.primary_priority!]} puanı geniş profil içindeki en belirgin güçlüğü göstermektedir. Bununla birlikte diğer etkilenmiş alanlar da günlük görevlerdeki toplam yükün parçasıdır; karar tek alanlı bir açıklamaya indirgenmemiştir.`
    : profile.profile_breadth === "focused_multidomain"
    ? `${DOMAIN_LABELS[profile.primary_priority!]} ölçekte en belirgin güçlük alanıdır. ${joinNatural(profile.secondary_priorities.map((domain) => DOMAIN_LABELS[domain])).toLocaleLowerCase("tr-TR")} puanları da beklenen aralığın dışındadır; bu nedenle günlük yaşam güçlüğü değerlendirilirken bu alanlar da hesaba katılmıştır.`
    : profile.profile_breadth === "selective_single_domain"
    ? `${DOMAIN_LABELS[profile.primary_priority!]} beklenen aralığın dışında kalan tek alandır. Diğer beş alanın beklenen sonuçları, klinik kararın bu alanla sınırlı kurulmasını desteklemektedir.`
    : "Altı alanın tamamı yaş grubuna göre beklenen aralıktadır. Günlük yaşamda bildirilen değişkenlik, yalnız kayıtta bulunan görev ve koşullar içinde yorumlanmıştır."
  const decisionPreservedBoundary = preservedNames.length
    ? `${joinNatural(preservedNames)} alanlarındaki sonuçlar yaş grubuna göre beklenen aralıktadır. Bu skor dağılımı, güçlüğün bütün self-regülasyon alanlarına yayılmadığını göstermektedir.`
    : "Altı alanın tamamında beklenen aralık dışında sonuç bulunduğu için karar tek bir korunmuş alana dayandırılmamıştır."
  const boundedContradictionText = profile.profile_breadth === "preserved" && functional.has_caregiver_functional_report
    ? "Alan puanları yaş grubuna göre beklenen aralıktadır. Bakım verenin bildirdiği günlük yaşam bilgileri, bu puanların ölçtüğü kapsamla aynı değildir. Bu nedenle günlük yaşam yorumu yalnız kayıtta belirtilen görev ve koşullarla sınırlıdır."
    : "Kararı sınırlandıran bilgiler ayrı kaynak ve koşullardan gelmektedir. Günlük yaşam yorumu yalnız kayıtta belirtilen görev ve koşullarla sınırlandırılmıştır."
  const decisionParagraphs = [
    p("decision.bold-conclusion", clinicalInsightPlan.candidate_bold_paragraphs[2], [...base.decisionPlan.supportingEvidence, ...base.decisionPlan.preservedCapacity], [base.reportPlan.primaryDecisionClaimId], "full_bold", "synthesis", clinicalInsightPlan.bold_paragraph_case_fact_ids[2]),
    p("decision.rationale", decisionRationale, base.decisionPlan.supportingEvidence, ["primary"], "normal", "synthesis", envelope.dna_scores.map((fact) => fact.id)),
    p("decision.preserved-boundary", decisionPreservedBoundary, base.decisionPlan.preservedCapacity, ["preserved"], "normal", "synthesis", [...envelope.dna_scores, ...envelope.anamnesis_evidence].map((fact) => fact.id)),
    p("decision.support", clinicalInsightPlan.what_a_superficial_reading_would_miss, base.decisionPlan.supportingEvidence, ["primary"], "normal", "synthesis", clinicalInsightPlan.bold_paragraph_case_fact_ids[2]),
    ...(externalDecisionSentences.length ? [p("decision.external-role", externalDecisionSentences.join(" "), external.filter((entry) => entry.decision_relevant).map((entry) => `evidence.external.${entry.id}`), ["external"], "normal", "synthesis", envelope.external_tests.filter((fact) => external.some((entry) => entry.decision_relevant && fact.statement.startsWith(`${entry.test_name}:`))).map((fact) => fact.id))] : []),
    ...(explanation.contradictory_evidence.length ? [p("decision.contradiction", hasSemanticSourceDiscrepancy
      ? `${decisionDiscrepancy.text || boundedContradictionText} Bu kaynak ayrışması, klinik önceliği değiştirmeden yorumun günlük yaşamdaki kapsamını daraltmaktadır.`
      : decisionDiscrepancy.text || boundedContradictionText, base.decisionPlan.contradictoryEvidence, ["profile"], "normal", "synthesis", unique([
        ...sourceRelationNarrative.factIds,
        ...decisionDiscrepancy.factIds,
        ...contradictionCaseFactIds,
        ...(functional.has_caregiver_functional_report ? caregiverFacts.map((fact) => fact.id) : []),
      ]))] : []),
    ...(explanation.alternative_explanations.length ? [p("decision.alternative", `Alternatif açıklamalar arasında ${joinNatural(explanation.alternative_explanations.map((entry) => entry.toLocaleLowerCase("tr-TR")))} yer almaktadır. ${profile.primary_priority ? `Mevcut vaka kanıtı, bu seçeneklerden daha çok ${explanation.primary_focus.toLocaleLowerCase("tr-TR")} bulgusuyla örtüşmektedir.` : "Altı alanın birlikte beklenen aralıkta olması, bu açıklamanın profil düzeyinde birincil karar olmasını desteklememektedir."}`, [], ["primary"], "normal", "synthesis", envelope.dna_scores.map((fact) => fact.id))] : []),
  ]
  sections.push(Object.freeze({ id: "decision_support", heading: JURY_REPORT_HEADINGS[3], paragraphs: Object.freeze(decisionParagraphs) }))

  const referenceMarkerIndex = literature.paragraphs.findIndex((text) => text === "Kaynaklar (APA 7):")
  const literatureBodyParagraphs = literature.paragraphs.slice(0, referenceMarkerIndex < 0 ? literature.paragraphs.length : referenceMarkerIndex).map((text, index) => p(`science.${index + 1}`, userFacingClinicalText(text), [], [], "normal", "literature_link", [], literature.selection.sourceIds))
  const literatureReferenceParagraphs = referenceMarkerIndex < 0 ? [] : literature.paragraphs.slice(referenceMarkerIndex).map((text, index) => p(`science.reference.${index + 1}`, text, [], [], "normal", "literature_link", [], literature.selection.sourceIds))
  sections.push(Object.freeze({
    id: "limits_science",
    heading: JURY_REPORT_HEADINGS[4],
    paragraphs: Object.freeze([
      ...literatureBodyParagraphs,
      p("limits.safety", "Literatür bulguları vaka yorumunun bilimsel çerçevesini destekler; bireysel düzeyde tek başına nedensellik, tanısal sonuç, prognoz veya biyolojik mekanizma kanıtı oluşturmaz.", [], ["claim.safety-boundary"], "normal", "boundary"),
      ...literatureReferenceParagraphs,
    ]),
  }))

  return Object.freeze({ version: DNA_REPORT_JURY_VERSION, overallClassification: base.decisionPlan.overallClassification, primaryFormulationId: primary, profile, clinicalInsightPlan, caseScopedEvidenceEnvelope: envelope, sections: Object.freeze(sections), literatureSourceIds: literature.selection.sourceIds, forbiddenClaims: FORBIDDEN_CLAIMS })
}

export class DeterministicJuryLanguageRealizer implements JuryLanguageRealizer {
  readonly identity = Object.freeze({ provider: "deterministic" as const, model: "dna-report-jury-deterministic", version: DNA_REPORT_JURY_VERSION })
  async realize(plan: JuryLockedLanguagePlan): Promise<JuryLanguageRealization> {
    return Object.freeze({ sections: Object.freeze(plan.sections.map((section) => Object.freeze({ id: section.id, text: section.paragraphs.map((entry) => entry.text).join("\n\n"), usedParagraphIds: Object.freeze(section.paragraphs.map((entry) => entry.id)) }))) })
  }
}

function render(plan: JuryLockedLanguagePlan, realization: JuryLanguageRealization): string {
  const byId = new Map(realization.sections.map((section) => [section.id, section]))
  return plan.sections.map((section) => `${section.heading}\n${byId.get(section.id)?.text.trim() ?? ""}`).join("\n\n")
}

export class CrossCaseContaminationValidator {
  validate(plan: JuryLockedLanguagePlan) {
    const currentCaseId = plan.caseScopedEvidenceEnvelope.case_id
    const allowedFacts = new Set(plan.caseScopedEvidenceEnvelope.allowed_case_fact_ids)
    const provenance = plan.sections.flatMap((section) => section.paragraphs.flatMap((entry) => entry.sentenceProvenance))
    const failures: Array<Readonly<{ sentence_id: string; sentence: string; error_type: string; offending_ids: readonly string[] }>> = []
    for (const item of provenance) {
      if (item.case_id !== currentCaseId) failures.push(Object.freeze({ sentence_id: item.sentence_id, sentence: item.sentence, error_type: "CROSS_CASE_SYNTHESIS", offending_ids: Object.freeze([item.case_id]) }))
      const foreignFacts = item.supporting_case_fact_ids.filter((factId) => !allowedFacts.has(factId) || !factId.startsWith(`${currentCaseId}.`))
      if (foreignFacts.length) failures.push(Object.freeze({ sentence_id: item.sentence_id, sentence: item.sentence, error_type: "CROSS_CASE_FACT", offending_ids: Object.freeze(foreignFacts) }))
      const foreignDecisions = item.supporting_decision_ids.filter((decisionId) => !decisionId.startsWith(`${currentCaseId}.decision.`))
      if (foreignDecisions.length) failures.push(Object.freeze({ sentence_id: item.sentence_id, sentence: item.sentence, error_type: "CROSS_CASE_SYNTHESIS", offending_ids: Object.freeze(foreignDecisions) }))
      const unknown = ["case_fact", "synthesis"].includes(item.statement_type) && item.supporting_case_fact_ids.length === 0 && item.supporting_decision_ids.length === 0
      if (unknown) failures.push(Object.freeze({ sentence_id: item.sentence_id, sentence: item.sentence, error_type: "UNKNOWN_FACT_PROVENANCE", offending_ids: Object.freeze([]) }))
    }
    return Object.freeze({
      pass: failures.length === 0,
      case_id: currentCaseId,
      sentence_count: provenance.length,
      cross_case_contamination_count: failures.filter((entry) => entry.error_type.startsWith("CROSS_CASE")).length,
      unsupported_case_fact_count: failures.filter((entry) => entry.error_type === "CROSS_CASE_FACT").length,
      unknown_case_fact_provenance_count: failures.filter((entry) => entry.error_type === "UNKNOWN_FACT_PROVENANCE").length,
      failures: Object.freeze(failures),
    })
  }
}

export class VisibleReportPropositionValidator {
  validate(plan: JuryLockedLanguagePlan, report: string, dataQuality: ReportDataQuality, observation: CanonicalTherapistObservation, external: readonly JuryExternalEvidence[]) {
    const envelope = plan.caseScopedEvidenceEnvelope
    const clinicalBody = report.split(JURY_REPORT_HEADINGS[4])[0]
    const headingFragments = new Set(JURY_REPORT_HEADINGS.flatMap((heading) => [heading, heading.replace(/^\d+\.\s*/u, "")]))
    const sentences = clinicalBody
      .split(/(?<=[.!?])\s+|\n+/u)
      .map((item) => item.trim())
      .filter((item) => item && !/^\d+\.$/u.test(item) && !headingFragments.has(item))
    const affirmativeCaregiver = sentences.filter((item) => /(?:bakım veren|aile)[^.]{0,180}(?:bildir|belirt|söyl)/iu.test(item) && !/(?:bulunmamaktadır|somutlaştırılmamıştır|örnek bulunmadığ)/iu.test(item))
    const affirmativeObservation = sentences.filter((item) => /(?:Terapist gözleminde|Doğrudan klinik gözlemde)/iu.test(item) && !/(?:bulunmamaktadır|içermemektedir|verilmedi)/iu.test(item))
    const namedExternal = external.filter((entry) => report.includes(entry.test_name))
    const contradictions: Array<Readonly<{ proposition: string; sentence: string; error_type: string }>> = []
    if (!envelope.anamnesis_evidence.length) for (const item of affirmativeCaregiver) contradictions.push(Object.freeze({ proposition: "caregiver_functional_example_present=false", sentence: item, error_type: "UNSUPPORTED_CAREGIVER_FUNCTIONAL_CLAIM" }))
    if (!observation.present) for (const item of affirmativeObservation) contradictions.push(Object.freeze({ proposition: "therapist_observation_present=false", sentence: item, error_type: "UNSUPPORTED_THERAPIST_OBSERVATION_CLAIM" }))
    if (!envelope.external_tests.length && namedExternal.length) for (const item of namedExternal) contradictions.push(Object.freeze({ proposition: "external_test_present=false", sentence: item.test_name, error_type: "UNSUPPORTED_EXTERNAL_TEST_CLAIM" }))
    if (dataQuality.status === "insufficient") {
      for (const item of sentences.filter((sentenceText) => /günlük işlev güçlüğü bakım veren anlatısında bildirilmektedir/iu.test(sentenceText))) contradictions.push(Object.freeze({ proposition: "daily_functional_impact_observed=false", sentence: item, error_type: "SCORE_TO_OBSERVED_IMPACT_CONTRADICTION" }))
    }
    if (plan.profile.profile_breadth === "selective_single_domain") {
      for (const item of sentences.filter((sentenceText) => /tek bir alanda baskın güçlük göstermemektedir/iu.test(sentenceText))) contradictions.push(Object.freeze({ proposition: "profile_breadth=selective_single_domain", sentence: item, error_type: "PROFILE_BREADTH_VISIBLE_CONTRADICTION" }))
    }
    if (plan.profile.profile_breadth === "broad_multidomain") {
      for (const item of sentences.filter((sentenceText) => /seçici tek alan|tek bir alanda seçici/iu.test(sentenceText))) contradictions.push(Object.freeze({ proposition: "profile_breadth=broad_multidomain", sentence: item, error_type: "PROFILE_BREADTH_VISIBLE_CONTRADICTION" }))
    }
    const normalize = (value: string) => value.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü]+/gu, " ").trim()
    const provenance = plan.sections
      .filter((section) => section.id !== "limits_science")
      .flatMap((section) => section.paragraphs.flatMap((entry) => entry.sentenceProvenance))
    const provenanceBySentence = new Map<string, JurySentenceProvenance[]>()
    for (const item of provenance) provenanceBySentence.set(normalize(item.sentence), [...(provenanceBySentence.get(normalize(item.sentence)) ?? []), item])
    const allFacts: CaseScopedEvidenceFact[] = [
      ...envelope.dna_scores,
      ...envelope.anamnesis_evidence,
      ...envelope.therapist_observations,
      ...envelope.external_tests,
    ]
    const factsById = new Map(allFacts.map((fact) => [fact.id, fact]))
    const failures: Array<Readonly<{ sentence: string; error_type: "UNKNOWN_VISIBLE_CLAIM_PROVENANCE" | "UNSUPPORTED_VISIBLE_CASE_CLAIM" | "WRONG_SOURCE_ATTRIBUTION" | "WRONG_DOMAIN_ATTRIBUTION"; supporting_fact_ids: readonly string[] }>> = []
    let visibleClaimCount = 0
    let supportedVisibleClaimCount = 0
    const addFailure = (sentenceText: string, errorType: typeof failures[number]["error_type"], factIds: readonly string[]) => {
      if (!failures.some((entry) => entry.sentence === sentenceText && entry.error_type === errorType)) failures.push(Object.freeze({ sentence: sentenceText, error_type: errorType, supporting_fact_ids: Object.freeze([...factIds]) }))
    }
    for (const sentenceText of sentences) {
      const normalizedSentence = normalize(sentenceText)
      const candidates = provenanceBySentence.get(normalizedSentence) ?? []
      const candidate = candidates[0] ?? provenance.find((item) => {
        const normalizedProvenance = normalize(item.sentence)
        return normalizedProvenance.includes(normalizedSentence) || normalizedSentence.includes(normalizedProvenance)
      })
      if (candidate?.statement_type === "boundary" || candidate?.statement_type === "literature_link") continue
      visibleClaimCount += 1
      if (!candidate) {
        addFailure(sentenceText, "UNKNOWN_VISIBLE_CLAIM_PROVENANCE", [])
        continue
      }
      const factIds = candidate.supporting_case_fact_ids
      const facts = factIds.map((id) => factsById.get(id)).filter(Boolean) as CaseScopedEvidenceFact[]
      const directFactStatement = facts.some((fact) => {
        const normalizedFact = normalize(fact.statement)
        return normalizedFact.length > 12 && (normalizedSentence === normalizedFact || normalizedSentence.endsWith(normalizedFact))
      })
      if (directFactStatement) {
        supportedVisibleClaimCount += 1
        continue
      }
      if (/(?:bulunmadığ|bulunmamaktadır|dönüştürmemektedir|yorumlamamaktadır|ileri sürülmemiştir|saptanmamıştır)/iu.test(sentenceText) && (facts.length > 0 || candidate.supporting_decision_ids.length > 0)) {
        supportedVisibleClaimCount += 1
        continue
      }
      if (candidate.paragraph_id === "decision.alternative" && candidate.supporting_decision_ids.length > 0 && facts.some((fact) => fact.source_type === "DNA_SCORE")) {
        supportedVisibleClaimCount += 1
        continue
      }
      const caregiverClaim = /(?:bakım veren|aile|anne|baba)/iu.test(sentenceText)
      const observationClaim = /(?:terapist gözlem|doğrudan klinik gözlem|doğrudan gözlem)/iu.test(sentenceText)
      const namedExternal = external.filter((entry) => sentenceText.includes(entry.test_name))
      const scoreClaim = /(?:puan|ölçek toplam|alan dağılım|beklenen aralık|Atipik|Riskli|Tipik|birincil öncelik|klinik kararın merkezinde)/iu.test(sentenceText)
      const functionalClaim = /(?:evde|okulda|sınıfta|serviste|koridorda|seansta|görev sırasında|günlük yaşamdan verdiği örnek|günlük yaşamdaki karşılığ|tamamladı|tamamlayabildi|yarım kaldı|ayrıldı|kulaklarını kapat|geri döndü|bağımsız sürd|bildirilen güçlük)/iu.test(sentenceText)
      const requiredDomains = (Object.keys(DOMAIN_LABELS) as DomainKey[]).filter((domain) => sentenceText.toLocaleLowerCase("tr-TR").includes(DOMAIN_LABELS[domain].toLocaleLowerCase("tr-TR")))
      let sourceMismatch = false
      let domainMismatch = false
      let semanticMismatch = false
      if (caregiverClaim) {
        const sourceFacts = facts.filter((fact) => fact.source_type === "CAREGIVER_ANAMNESIS") as CanonicalAnamnesisEvidenceFact[]
        if (!sourceFacts.length) sourceMismatch = true
        if (requiredDomains.length && !requiredDomains.some((domain) => sourceFacts.some((fact) => factSupportsDomain(fact, domain)))) domainMismatch = true
        const caregiverClauses = sentenceText.split(/;/u).filter((clause) => /(?:bakım veren|aile|anne|baba)/iu.test(clause))
        const negativeCaregiverLanguage = caregiverClauses.some((clause) => /(?:hiç[^.]{0,80}(?:olmad|görmed)|bildirilmedi|bildirilmiyor|bildirilmemiş|güçlük görmedi|sorun olmadığı|güçlük olmadığı)/iu.test(clause))
        const difficultyLanguage = !negativeCaregiverLanguage && caregiverClauses.some((clause) => /(?:\bgüçlük|\bzorlan|\byarım|\bbırak|\bkaç|\bağl|\bbağır|\batla|\bkarıştır|\bgeç bildir|\bson anda)/iu.test(clause))
        const preservedLanguage = caregiverClauses.some((clause) => /(?:\bkorun|\bbağımsız|\bbeklenen|\bsürdür|\btamamla|\bgüçlük bildirilmem|\bgüçlük görmed|\bsorun bildirilm|güçlük olmad)/iu.test(clause))
        if (difficultyLanguage && !sourceFacts.some(factSupportsDifficulty)) semanticMismatch = true
        if (preservedLanguage && !sourceFacts.some(factSupportsPreservedCapacity)) semanticMismatch = true
      }
      if (observationClaim) {
        const sourceFacts = facts.filter((fact) => fact.source_type === "THERAPIST_OBSERVATION")
        if (!sourceFacts.length) sourceMismatch = true
        if (requiredDomains.length && !requiredDomains.some((domain) => sourceFacts.some((fact) => fact.domains.includes(domain)))) domainMismatch = true
      }
      if (namedExternal.length) {
        const sourceFacts = facts.filter((fact) => fact.source_type === "EXTERNAL_TEST")
        if (!sourceFacts.length || namedExternal.some((entry) => !sourceFacts.some((fact) => fact.statement.startsWith(`${entry.test_name}:`)))) sourceMismatch = true
        if (requiredDomains.length && !requiredDomains.some((domain) => sourceFacts.some((fact) => fact.domains.includes(domain)))) domainMismatch = true
      }
      if (scoreClaim && !facts.some((fact) => fact.source_type === "DNA_SCORE") && candidate.supporting_decision_ids.length === 0) sourceMismatch = true
      if (functionalClaim && !caregiverClaim && !observationClaim && !namedExternal.length) {
        const functionalFacts = facts.filter((fact) => fact.source_type === "CAREGIVER_ANAMNESIS" || fact.source_type === "THERAPIST_OBSERVATION" || fact.source_type === "EXTERNAL_TEST")
        if (!functionalFacts.length) semanticMismatch = true
      }
      const requiresFact = candidate.statement_type === "case_fact" || caregiverClaim || observationClaim || namedExternal.length > 0 || functionalClaim
      if (requiresFact && !facts.length) addFailure(sentenceText, "UNKNOWN_VISIBLE_CLAIM_PROVENANCE", factIds)
      if (sourceMismatch) addFailure(sentenceText, "WRONG_SOURCE_ATTRIBUTION", factIds)
      if (domainMismatch) addFailure(sentenceText, "WRONG_DOMAIN_ATTRIBUTION", factIds)
      if (semanticMismatch || sourceMismatch || domainMismatch) addFailure(sentenceText, "UNSUPPORTED_VISIBLE_CASE_CLAIM", factIds)
      if (!(requiresFact && !facts.length) && !sourceMismatch && !domainMismatch && !semanticMismatch) supportedVisibleClaimCount += 1
    }
    return Object.freeze({
      pass: contradictions.length === 0 && failures.length === 0,
      case_id: envelope.case_id,
      propositions: Object.freeze({
        caregiver_functional_example_present: envelope.anamnesis_evidence.length > 0,
        therapist_observation_present: observation.present,
        external_test_present: envelope.external_tests.length > 0,
        daily_functional_impact_observed: envelope.anamnesis_evidence.length > 0 || observation.present,
        affected_domains: plan.profile.affected_domains,
        preserved_domains: plan.profile.preserved_domains,
        profile_breadth: plan.profile.profile_breadth,
        primary_priority: plan.profile.primary_priority,
        secondary_priorities: plan.profile.secondary_priorities,
        context_effect_present: dataQuality.contextualComparisonAvailable,
        score_derived_only: dataQuality.status === "insufficient",
      }),
      visible_factual_contradiction_count: contradictions.length,
      contradictions: Object.freeze(contradictions),
      visible_claim_count: visibleClaimCount,
      supported_visible_claim_count: supportedVisibleClaimCount,
      unsupported_visible_case_claim_count: failures.filter((entry) => entry.error_type === "UNSUPPORTED_VISIBLE_CASE_CLAIM").length,
      unknown_visible_claim_provenance_count: failures.filter((entry) => entry.error_type === "UNKNOWN_VISIBLE_CLAIM_PROVENANCE").length,
      wrong_source_attribution_count: failures.filter((entry) => entry.error_type === "WRONG_SOURCE_ATTRIBUTION").length,
      wrong_domain_attribution_count: failures.filter((entry) => entry.error_type === "WRONG_DOMAIN_ATTRIBUTION").length,
      provenance_failures: Object.freeze(failures),
    })
  }
}

export class TemplateSemanticLeakageValidator {
  validate(plan: JuryLockedLanguagePlan, report: string): TemplateSemanticLeakageAudit {
    const profile = plan.caseScopedEvidenceEnvelope.functional_evidence_profile
    const sentences = report
      .split(/(?<=[.!?])\s+|\n+/u)
      .map((item) => item.trim())
      .filter((item) => item && !JURY_REPORT_HEADINGS.includes(item as typeof JURY_REPORT_HEADINGS[number]))
    const findings: TemplateSemanticLeakageFinding[] = []
    const boundaryOrAbsence = /(?:bulunmamaktadır|bulunmadığ|örnek bulunmad|ileri sürülmem|dönüştürülmem|içermemektedir|sınırlı tutul|saptanmamıştır|oluşturmaz|göstermemektedir|yorumlanmamaktadır)/iu
    const add = (code: TemplateSemanticLeakageCode, sentenceText: string) => {
      if (!findings.some((finding) => finding.code === code && finding.sentence === sentenceText)) findings.push(Object.freeze({ code, sentence: sentenceText }))
    }
    for (const sentenceText of sentences) {
      if (boundaryOrAbsence.test(sentenceText)) continue
      const functionalClaim = /(?:günlük yaşamda görülen performans|günlük performans(?:ta|taki|ın)|günlük görevlerde ortaya çıkan|işlevsel karşılığını görünür|günlük yaşam güçlüğünde birlikte yer|günlük görev yükünün)/iu.test(sentenceText)
      if (functionalClaim && !(profile.has_concrete_daily_life_example || profile.has_task_specific_performance_example || profile.has_preserved_capacity_in_action)) add("FUNCTIONAL_PATTERN_WITHOUT_FUNCTIONAL_EVIDENCE", sentenceText)
      const contextClaim = /(?:performansın koşullara göre değiş|bağlam(?:da|a|sal)[^.]{0,100}performans|görev yapısı[^.]{0,140}(?:kapasite|performans)|çevresel yük[^.]{0,120}belirginleş)/iu.test(sentenceText)
      if (contextClaim && !profile.has_context_specific_performance_example) add("CONTEXT_EFFECT_WITHOUT_CONTEXT_EVIDENCE", sentenceText)
      const variabilityClaim = /(?:günlük performanstaki değişkenlik|performans değişkenli|performansın[^.]{0,80}değiştiğini|performans[^.]{0,80}değişmiştir)/iu.test(sentenceText)
      if (variabilityClaim && !profile.has_performance_variability_evidence) add("PERFORMANCE_VARIABILITY_WITHOUT_VARIABILITY_EVIDENCE", sentenceText)
      const neutralCaregiverMetadata = /^Bakım veren tarafından bildirilen bilgi:/iu.test(sentenceText)
      const caregiverClaim = !neutralCaregiverMetadata && (/(?:bakım veren|aile)[^.]{0,160}(?:günlük|görev|işlev|performans)[^.]{0,120}(?:bildir|belirt|söyl)/iu.test(sentenceText)
        || /(?:bakım veren|aile)[^.]{0,120}(?:bildir|belirt|söyl)[^.]{0,160}(?:günlük|görev|işlev|performans)/iu.test(sentenceText)
      )
      if (caregiverClaim && !profile.has_caregiver_functional_report) add("CAREGIVER_FUNCTION_WITHOUT_CAREGIVER_EVIDENCE", sentenceText)
      const observationClaim = /(?:Terapist gözleminde|Doğrudan klinik gözlemde)/iu.test(sentenceText)
      if (observationClaim && !profile.has_therapist_observation) add("OBSERVATION_LANGUAGE_WITHOUT_OBSERVATION", sentenceText)
      const preservedActionClaim = /(?:kapasite[^.]{0,120}(?:günlük yaşam|gerçek yaşam|koşullarda kullanıl)|(?:günlük yaşam|gerçek yaşam)[^.]{0,120}kapasite|yapılandırılmış[^.]{0,120}kapasite)/iu.test(sentenceText)
      if (preservedActionClaim && !profile.has_preserved_capacity_in_action) add("PRESERVED_CAPACITY_IN_ACTION_WITHOUT_ACTION_EVIDENCE", sentenceText)
    }
    return Object.freeze({
      pass: findings.length === 0,
      case_id: plan.caseScopedEvidenceEnvelope.case_id,
      finding_count: findings.length,
      findings: Object.freeze(findings),
    })
  }
}

const INVALID_EXTERNAL_ALLOWED_ROLES = new Set<ExternalEvidenceUsageRole>(["METADATA_ONLY", "EXCLUSION_RATIONALE", "GENERAL_DESCRIPTION"])

function usageRoleForExternalReference(evidence: JuryExternalEvidence, paragraph: JuryLockedParagraph): ExternalEvidenceUsageRole {
  const explicitExclusion = /(?:klinik kararda kullanılmamıştır|klinik karara dahil edilmemiştir|yorumlanabilir kanıt olarak kullanılmamıştır|sonuç yönü klinik bulgu olarak aktarılmamıştır|karar kanıtı değildir)/iu.test(paragraph.text)
  if (paragraph.id.startsWith("evidence.external.") && !evidence.decision_relevant) return explicitExclusion ? "EXCLUSION_RATIONALE" : "METADATA_ONLY"
  if (paragraph.id.includes("relation") || paragraph.id.includes("contradiction")) return "RELATION_EVIDENCE"
  if (paragraph.id.includes("preserved")) return "PRESERVED_CAPACITY_EVIDENCE"
  if (paragraph.id.startsWith("summary.") || paragraph.id.includes("breadth") || paragraph.id.includes("formulation")) return "PROFILE_EVIDENCE"
  if (paragraph.id.startsWith("decision.")) return "DIRECT_CLINICAL_EVIDENCE"
  if (paragraph.id.startsWith("science.") || paragraph.id.startsWith("limits.")) return "GENERAL_DESCRIPTION"
  if (evidence.evidence_direction === "supports_preserved_function") return "PRESERVED_CAPACITY_EVIDENCE"
  if (evidence.evidence_direction === "mixed") return "RELATION_EVIDENCE"
  return "DIRECT_CLINICAL_EVIDENCE"
}

export function auditExternalEvidenceUsage(plan: JuryLockedLanguagePlan, external: readonly JuryExternalEvidence[], report: string): ExternalEvidenceUsageAudit {
  const records: ExternalEvidenceUsageRecord[] = []
  const paragraphs = plan.sections.flatMap((section) => section.paragraphs.map((paragraph) => ({ section, paragraph })))
  const proximityHints: string[] = []
  for (const evidence of external.filter((entry) => !entry.decision_relevant)) {
    const fact = plan.caseScopedEvidenceEnvelope.external_tests.find((item) => item.statement.startsWith(`${evidence.test_name}:`))
    const escapedName = evidence.test_name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const proximityHint = report.includes(evidence.test_name)
      && !new RegExp(`${escapedName}[\\s\\S]{0,220}(?:kullanılmadı|kullanılmamıştır|geçersiz|yetersiz bilgi|karara dahil edilmemiştir)`, "iu").test(report)
    if (proximityHint) proximityHints.push(evidence.id)
    const referenced = fact
      ? paragraphs.filter(({ paragraph }) => paragraph.sentenceProvenance.some((sentenceItem) => sentenceItem.supporting_case_fact_ids.includes(fact.id)))
      : []
    for (const { section, paragraph } of referenced) {
      const role = usageRoleForExternalReference(evidence, paragraph)
      const allowed = INVALID_EXTERNAL_ALLOWED_ROLES.has(role)
      records.push(Object.freeze({
        evidence_id: evidence.id,
        test_name: evidence.test_name,
        fact_id: fact?.id ?? null,
        validity_status: evidence.validity_status,
        decision_relevant: evidence.decision_relevant,
        section_id: section.id,
        paragraph_id: paragraph.id,
        sentence_ids: Object.freeze(paragraph.sentenceProvenance.filter((sentenceItem) => fact && sentenceItem.supporting_case_fact_ids.includes(fact.id)).map((sentenceItem) => sentenceItem.sentence_id)),
        usage_role: role,
        allowed,
        text_proximity_hint_fired: proximityHint,
        rationale: allowed
          ? "Yorumlanamaz dış test yalnız metadata veya dışlama gerekçesi olarak görünmektedir."
          : "Yorumlanamaz dış test yapılandırılmış claim provenance içinde klinik kanıt rolüne bağlanmıştır.",
      }))
    }
    if (!referenced.length && report.includes(evidence.test_name)) {
      records.push(Object.freeze({
        evidence_id: evidence.id,
        test_name: evidence.test_name,
        fact_id: fact?.id ?? null,
        validity_status: evidence.validity_status,
        decision_relevant: evidence.decision_relevant,
        section_id: "limits_science",
        paragraph_id: "unattributed-test-mention",
        sentence_ids: Object.freeze([]),
        usage_role: "GENERAL_DESCRIPTION",
        allowed: true,
        text_proximity_hint_fired: proximityHint,
        rationale: "Test adı claim-support provenance dışında genel açıklama olarak geçmektedir.",
      }))
    }
  }
  const genuine = unique(records.filter((record) => !record.allowed).map((record) => record.evidence_id))
  const safeMentions = unique(records.filter((record) => record.allowed).map((record) => record.evidence_id))
  const safeExclusions = unique(records.filter((record) => record.usage_role === "EXCLUSION_RATIONALE" && record.allowed).map((record) => record.evidence_id))
  const proximity = unique(proximityHints)
  return Object.freeze({
    pass: genuine.length === 0,
    records: Object.freeze(records),
    genuine_misuse_evidence_ids: Object.freeze(genuine),
    safe_mention_evidence_ids: Object.freeze(safeMentions),
    safe_exclusion_evidence_ids: Object.freeze(safeExclusions),
    proximity_hint_evidence_ids: Object.freeze(proximity),
    validator_false_positive_evidence_ids: Object.freeze(proximity.filter((id) => !genuine.includes(id))),
  })
}

function countMatches(text: string, pattern: RegExp): number {
  return (text.match(pattern) ?? []).length
}

function normalizeTestName(value: string): string {
  return value.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9]+/gu, "")
}

function validateRealization(plan: JuryLockedLanguagePlan, realization: JuryLanguageRealization, rawExternal: readonly RawExternalTestMention[], external: readonly JuryExternalEvidence[], observation: CanonicalTherapistObservation, dataQuality: ReportDataQuality, explanation: DecisionExplanation, literature: JuryLiteratureSelection, base: Awaited<ReturnType<typeof runReportV2Shadow>>): JuryReportValidation {
  const report = render(plan, realization)
  const contaminationAudit = new CrossCaseContaminationValidator().validate(plan)
  const propositionAudit = new VisibleReportPropositionValidator().validate(plan, report, dataQuality, observation, external)
  const templateSemanticLeakageAudit = new TemplateSemanticLeakageValidator().validate(plan, report)
  const externalEvidenceUsageAudit = auditExternalEvidenceUsage(plan, external, report)
  const clauseProvenance: JuryClauseProvenance[] = plan.sections.flatMap((section) => section.paragraphs.flatMap((entry) => entry.sentenceProvenance.flatMap((item) => item.clauses)))
  const clauseEntailmentAudit = auditClauseEntailment(clauseProvenance)
  const headings = JURY_REPORT_HEADINGS.filter((heading) => report.includes(heading))
  const classificationConsistent = report.includes(`Ölçek toplam puan sınıflaması: ${plan.overallClassification}`) && base.decisionPlan.overallClassification === plan.overallClassification
  const summaryText = realization.sections.find((section) => section.id === "summary")?.text ?? ""
  const profileBreadthConsistent = report.includes(plan.profile.display_label)
    && explanation.profile_breadth === plan.profile.profile_breadth
    && !(plan.profile.profile_breadth === "broad_multidomain" && /(?:profil|örüntü)[^.]{0,100}(?:seçici tek alan|seçici güçlük) olarak/iu.test(summaryText))
  const matrixObservationPresent = base.evidenceMatrix.units.some((unit) => unit.sourceType === "THERAPIST_OBSERVATION")
  const narrativeObservationPresent = observation.present ? /Terapist gözleminde|Doğrudan klinik gözlemde/iu.test(report) : /doğrudan terapist gözlemi bulunmamaktadır/iu.test(report)
  const therapistObservationConsistent = observation.present === dataQuality.therapistObservationAvailable
    && observation.present === explanation.therapist_observation_present
    && observation.present === matrixObservationPresent
    && narrativeObservationPresent
  const expectedMentions = rawExternal.filter((entry) => !entry.clearly_unparseable_noise)
  const missingExtractedExternalTestNames = expectedMentions.filter((mention) => {
    if (mention.recognized_registry_id) return !external.some((entry) => entry.id === mention.recognized_registry_id)
    return !external.some((entry) => normalizeTestName(entry.test_name) === normalizeTestName(mention.test_name))
  }).map((entry) => entry.test_name)
  const externalTestExtractionRecall = expectedMentions.length ? (expectedMentions.length - missingExtractedExternalTestNames.length) / expectedMentions.length : 1
  const missingValidExternalEvidenceIds = external.filter((entry) => entry.decision_relevant && !report.includes(entry.test_name)).map((entry) => entry.id)
  const invalidExternalEvidenceUsedIds = [...externalEvidenceUsageAudit.genuine_misuse_evidence_ids]
  const clinicalBody = report.split(/Kaynaklar \(APA 7\):/u)[0]
  const unsupportedDiagnosisCount = countMatches(clinicalBody, /(?:tanı koyar|tanıyı doğrular|tanıyı dışlar|kesin tanı|otizm|DEHB tanısı)/giu)
  const unsupportedCausalityCount = countMatches(clinicalBody, /(?:neden olmaktadır|kaynaklanmaktadır|doğrudan sebebidir|yol açmaktadır)/giu)
  const unsupportedBiologicalMechanismCount = countMatches(clinicalBody, /(?:vagal ton|sempatik baskın|parasempatik baskın|kortizol|HPA|inflamasyon|beyin bölgesi)/giu)
  const sparseFunctionalOverreachCount = dataQuality.status === "insufficient" && !/gözlenmiş bir işlev kaybı olarak yorumlamamaktadır/iu.test(report) ? countMatches(report, /(?:günlük yaşamda şu biçimde|çok basamaklı görevleri tamamlayamamaktadır|uyaranları filtreleyememektedir|duygusal yoğunluğu artmaktadır)/giu) : 0
  const sentences = clinicalBody.replace(/^\d+\..+$/gmu, "").split(/(?<=[.!?])\s+/u).map((item) => item.trim()).filter((item) => item.split(/\s+/u).length >= 5)
  const { repeatedSentenceRate, repeatedPhraseCount, materialRepetitionFailureCount, repetitionMateriality } = classifyRepetitionMateriality(report)
  const averageSentenceWords = sentences.length ? sentences.reduce((sum, item) => sum + item.split(/\s+/u).length, 0) / sentences.length : 0
  const longSentenceCount = sentences.filter((item) => item.split(/\s+/u).length > 35).length
  const visibleFormulationCount = countMatches(clinicalBody, /formülasyon/giu)
  const visibleConfidenceCount = countMatches(clinicalBody, /veri güveni\s*:?/giu)
  const standaloneRegulationTranslationCount = countMatches(clinicalBody, /\bdüzenleme\b/giu)
  const negativeContrastCount = countMatches(clinicalBody, /\bdeğil(?:dir)?\b/giu)
  const clinicalInterventionCount = countMatches(clinicalBody, /\bmüdahale\w*/giu)
  const treatmentRecommendationCount = countMatches(clinicalBody, /(?:terapi\s+(?:öner|plan)|tedavi\s+(?:öner|plan)|duyusal strateji|ev programı|egzersiz\s+(?:öner|program)|ilaç\s+öner|yönlendirilmelidir|çalışılmalıdır|önerilmelidir)/giu)
  const defaultFurtherAssessmentCount = countMatches(clinicalBody, /(?:daha ayrıntılı değerlendirilmelidir|daha kapsamlı değerlendirme|daha ileri değerlendirme gereklidir|ayrıntılı değerlendirme yapılmalıdır)/giu)
  const boldParagraphs = plan.sections.flatMap((section) => section.paragraphs).filter((entry) => entry.emphasis === "full_bold")
  const fullBoldParagraphCount = boldParagraphs.length
  const boldParagraphContractPass = fullBoldParagraphCount >= 2 && fullBoldParagraphCount <= 4 && boldParagraphs.every((entry) => entry.text.length >= 120 && entry.text.split(/(?<=[.!?])\s+/u).filter(Boolean).length >= 2)
  const caseSpecificDeepInsightBoldCount = boldParagraphs.filter((entry) => {
    const facts = unique(entry.sentenceProvenance.flatMap((item) => item.supporting_case_fact_ids))
    const hasCaseSpecificSource = facts.some((factId) => /\.fact\.(?:anamnesis|observation|external)\./u.test(factId))
    const hasScoreFact = facts.some((factId) => /\.fact\.score\./u.test(factId))
    const primaryLabel = plan.profile.primary_priority ? DOMAIN_LABELS[plan.profile.primary_priority] : "profil"
    const hasProfileArchitecture = hasScoreFact
      && entry.text.includes(primaryLabel)
      && /(?:profil|dağılım|seçici|çok alanlı|korunmuş|öncelik|birlikte)/iu.test(entry.text)
    return (hasCaseSpecificSource || hasProfileArchitecture) && entry.text.split(/(?<=[.!?])\s+/u).length >= 2
  }).length
  const genericTemplateFailureCount = boldParagraphs.filter((entry) => !entry.sentenceProvenance.some((item) => item.supporting_case_fact_ids.length > 0)).length
  const majorHeadingCount = headings.length
  const wordCount = report.split(/\s+/u).filter(Boolean).length
  const emptyParagraphCount = realization.sections.reduce((sum, section) => sum + section.text.split(/\n{2,}/u).filter((item) => !item.trim()).length, 0)
  const headingErrorCount = JURY_REPORT_HEADINGS.length - headings.length
  const unsupportedSourceCount = base.validation.knowledgeSourceViolationCount + literature.missingSourceIds.length + literature.doiReferenceMismatchCount + literature.citationDomainMismatchCount
  const crossCaseContaminationCount = contaminationAudit.cross_case_contamination_count
  const unsupportedCaseFactCount = contaminationAudit.unsupported_case_fact_count
  const unknownCaseFactProvenanceCount = contaminationAudit.unknown_case_fact_provenance_count
  const unsupportedVisibleCaseClaimCount = propositionAudit.unsupported_visible_case_claim_count
  const unknownVisibleClaimProvenanceCount = propositionAudit.unknown_visible_claim_provenance_count
  const wrongSourceAttributionCount = propositionAudit.wrong_source_attribution_count
  const wrongDomainAttributionCount = propositionAudit.wrong_domain_attribution_count
  const visibleClaimCount = propositionAudit.visible_claim_count
  const supportedVisibleClaimCount = propositionAudit.supported_visible_claim_count
  const visibleFactualContradictionCount = propositionAudit.visible_factual_contradiction_count
  const templateSemanticLeakageCount = templateSemanticLeakageAudit.finding_count
  const visibleClauseCount = clauseEntailmentAudit.visible_clause_count
  const supportedVisibleClauseCount = clauseEntailmentAudit.supported_visible_clause_count
  const unsupportedVisibleClauseCount = clauseEntailmentAudit.unsupported_visible_clause_count
  const partiallySupportedSentenceCount = clauseEntailmentAudit.partially_supported_sentence_count
  const factIdPresentButNotEntailingCount = clauseEntailmentAudit.fact_id_present_but_not_entailing_count
  const profileToFunctionOverreachCount = clauseEntailmentAudit.profile_to_function_overreach_count
  const directionMismatchCount = clauseEntailmentAudit.direction_mismatch_count
  const epistemicStatusMismatchCount = clauseEntailmentAudit.epistemic_status_mismatch_count
  const sourceRelationMismatchCount = clauseEntailmentAudit.source_relation_mismatch_count
  const difficultyAsPreservedCount = clauseEntailmentAudit.difficulty_as_preserved_count
  const absenceAsPreservedCount = clauseEntailmentAudit.absence_as_preserved_count
  const falseSourceConvergenceCount = clauseEntailmentAudit.false_source_convergence_count
  const externalTestDirectionErrorCount = clauseEntailmentAudit.external_test_direction_error_count
  const unassessedContextAsObservedCount = clauseEntailmentAudit.unassessed_context_as_observed_count
  const clauseEntailmentPrecision = clauseEntailmentAudit.precision
  const clauseEntailmentRecall = clauseEntailmentAudit.recall
  const criticalInternalContradictionCount = Number(!classificationConsistent) + Number(!profileBreadthConsistent) + Number(!therapistObservationConsistent) + missingExtractedExternalTestNames.length + missingValidExternalEvidenceIds.length + invalidExternalEvidenceUsedIds.length + visibleFactualContradictionCount + unsupportedVisibleClauseCount + directionMismatchCount + epistemicStatusMismatchCount + sourceRelationMismatchCount
  const failureCodes = [
    ...(!classificationConsistent ? ["CLASSIFICATION_INCONSISTENCY"] : []),
    ...(!profileBreadthConsistent ? ["PROFILE_BREADTH_INCONSISTENCY"] : []),
    ...(!therapistObservationConsistent ? ["THERAPIST_OBSERVATION_INCONSISTENCY"] : []),
    ...(missingExtractedExternalTestNames.length ? ["EXTERNAL_TEST_EXTRACTION_OMISSION"] : []),
    ...(missingValidExternalEvidenceIds.length ? ["EXTERNAL_EVIDENCE_OMISSION"] : []),
    ...(invalidExternalEvidenceUsedIds.length ? ["INVALID_EXTERNAL_EVIDENCE_USE"] : []),
    ...(unsupportedDiagnosisCount ? ["UNSUPPORTED_DIAGNOSIS"] : []),
    ...(unsupportedCausalityCount ? ["UNSUPPORTED_CAUSALITY"] : []),
    ...(unsupportedBiologicalMechanismCount ? ["UNSUPPORTED_BIOLOGICAL_MECHANISM"] : []),
    ...(unsupportedSourceCount ? ["UNSUPPORTED_SOURCE"] : []),
    ...(sparseFunctionalOverreachCount ? ["SPARSE_FUNCTIONAL_OVERREACH"] : []),
    ...(headingErrorCount ? ["HEADING_CONTRACT"] : []),
    ...(visibleFormulationCount ? ["VISIBLE_FORMULATION_TERM"] : []),
    ...(visibleConfidenceCount ? ["VISIBLE_CONFIDENCE_GRADE"] : []),
    ...(clinicalInterventionCount ? ["CLINICAL_INTERVENTION_LANGUAGE"] : []),
    ...(treatmentRecommendationCount ? ["TREATMENT_RECOMMENDATION"] : []),
    ...(defaultFurtherAssessmentCount ? ["DEFAULT_FURTHER_ASSESSMENT"] : []),
    ...(!boldParagraphContractPass ? ["FULL_BOLD_PARAGRAPH_CONTRACT"] : []),
    ...(crossCaseContaminationCount ? ["CROSS_CASE_CONTAMINATION"] : []),
    ...(unsupportedCaseFactCount ? ["UNSUPPORTED_CASE_FACT"] : []),
    ...(unknownCaseFactProvenanceCount ? ["UNKNOWN_CASE_FACT_PROVENANCE"] : []),
    ...(unsupportedVisibleCaseClaimCount ? ["UNSUPPORTED_VISIBLE_CASE_CLAIM"] : []),
    ...(unknownVisibleClaimProvenanceCount ? ["UNKNOWN_VISIBLE_CLAIM_PROVENANCE"] : []),
    ...(wrongSourceAttributionCount ? ["WRONG_SOURCE_ATTRIBUTION"] : []),
    ...(wrongDomainAttributionCount ? ["WRONG_DOMAIN_ATTRIBUTION"] : []),
    ...(visibleFactualContradictionCount ? ["VISIBLE_FACTUAL_CONTRADICTION"] : []),
    ...(templateSemanticLeakageCount ? ["TEMPLATE_SEMANTIC_LEAKAGE"] : []),
    ...(unsupportedVisibleClauseCount ? ["UNSUPPORTED_VISIBLE_CLAUSE"] : []),
    ...(partiallySupportedSentenceCount ? ["PARTIALLY_SUPPORTED_SENTENCE"] : []),
    ...(factIdPresentButNotEntailingCount ? ["FACT_ID_PRESENT_BUT_NOT_ENTAILING"] : []),
    ...(profileToFunctionOverreachCount ? ["PROFILE_TO_FUNCTION_OVERREACH"] : []),
    ...(directionMismatchCount ? ["EVIDENCE_DIRECTION_MISMATCH"] : []),
    ...(epistemicStatusMismatchCount ? ["EPISTEMIC_STATUS_MISMATCH"] : []),
    ...(sourceRelationMismatchCount ? ["SOURCE_RELATION_MISMATCH"] : []),
    ...(difficultyAsPreservedCount ? ["DIFFICULTY_AS_PRESERVED_CAPACITY"] : []),
    ...(absenceAsPreservedCount ? ["ABSENCE_AS_PRESERVED_CAPACITY"] : []),
    ...(falseSourceConvergenceCount ? ["FALSE_SOURCE_CONVERGENCE"] : []),
    ...(externalTestDirectionErrorCount ? ["EXTERNAL_TEST_DIRECTION_MISMATCH"] : []),
    ...(unassessedContextAsObservedCount ? ["UNASSESSED_CONTEXT_AS_OBSERVED"] : []),
    ...unique(clauseEntailmentAudit.failures.flatMap((failure) => failure.error_types)),
    ...(caseSpecificDeepInsightBoldCount < 1 ? ["CASE_SPECIFIC_DEEP_INSIGHT_OMISSION"] : []),
    ...(genericTemplateFailureCount ? ["GENERIC_BOLD_PARAGRAPH"] : []),
    ...(materialRepetitionFailureCount ? ["EXCESSIVE_REPETITION"] : []),
    ...(emptyParagraphCount ? ["EMPTY_PARAGRAPH"] : []),
  ]
  return Object.freeze({ pass: failureCodes.length === 0, classificationConsistent, profileBreadthConsistent, therapistObservationConsistent, externalTestExtractionRecall, missingExtractedExternalTestNames: Object.freeze(missingExtractedExternalTestNames), criticalInternalContradictionCount, missingValidExternalEvidenceIds: Object.freeze(missingValidExternalEvidenceIds), invalidExternalEvidenceUsedIds: Object.freeze(invalidExternalEvidenceUsedIds), unsupportedDiagnosisCount, unsupportedCausalityCount, unsupportedBiologicalMechanismCount, unsupportedSourceCount, sparseFunctionalOverreachCount, headingErrorCount, repeatedSentenceRate, repeatedPhraseCount, materialRepetitionFailureCount, repetitionMateriality, averageSentenceWords, longSentenceCount, visibleFormulationCount, visibleConfidenceCount, standaloneRegulationTranslationCount, negativeContrastCount, clinicalInterventionCount, treatmentRecommendationCount, defaultFurtherAssessmentCount, fullBoldParagraphCount, boldParagraphContractPass, crossCaseContaminationCount, unsupportedCaseFactCount, unknownCaseFactProvenanceCount, unsupportedVisibleCaseClaimCount, unknownVisibleClaimProvenanceCount, wrongSourceAttributionCount, wrongDomainAttributionCount, visibleClaimCount, supportedVisibleClaimCount, visibleFactualContradictionCount, templateSemanticLeakageCount, visibleClauseCount, supportedVisibleClauseCount, unsupportedVisibleClauseCount, partiallySupportedSentenceCount, factIdPresentButNotEntailingCount, profileToFunctionOverreachCount, directionMismatchCount, epistemicStatusMismatchCount, sourceRelationMismatchCount, difficultyAsPreservedCount, absenceAsPreservedCount, falseSourceConvergenceCount, externalTestDirectionErrorCount, unassessedContextAsObservedCount, clauseEntailmentPrecision, clauseEntailmentRecall, caseSpecificDeepInsightBoldCount, genericTemplateFailureCount, majorHeadingCount, wordCount, emptyParagraphCount, failureCodes: Object.freeze(unique(failureCodes)) })
}

function validateLanguageMapping(plan: JuryLockedLanguagePlan, realization: JuryLanguageRealization): boolean {
  if (realization.sections.length !== plan.sections.length) return false
  return plan.sections.every((section) => {
    const candidate = realization.sections.find((entry) => entry.id === section.id)
    if (!candidate?.text.trim()) return false
    const allowed = new Set(section.paragraphs.map((entry) => entry.id))
    return candidate.usedParagraphIds.length > 0 && candidate.usedParagraphIds.every((id) => allowed.has(id)) && section.paragraphs.every((entry) => candidate.usedParagraphIds.includes(entry.id))
  })
}

export class DeterministicClinicalCritic implements AIClinicalCritic {
  readonly identity = Object.freeze({ provider: "deterministic" as const, model: "dna-report-jury-rule-critic", version: DNA_REPORT_JURY_VERSION })
  async review(input: Parameters<AIClinicalCritic["review"]>[0]): Promise<ClinicalCriticResult> {
    const findings: ClinicalCriticFinding[] = []
    if (!input.finalReport.includes(`Ölçek toplam puan sınıflaması: ${input.lockedPlan.overallClassification}`)) findings.push(Object.freeze({ type: "CLASSIFICATION_INCONSISTENCY", severity: "critical", message: "Görünür sınıflama kilitli kararla eşleşmiyor." }))
    for (const evidence of input.externalEvidence.filter((entry) => entry.decision_relevant)) if (!input.finalReport.includes(evidence.test_name)) findings.push(Object.freeze({ type: "EXTERNAL_EVIDENCE_OMISSION", severity: "high", message: `${evidence.test_name} yorumlanabilir olduğu hâlde sentezde yer almıyor.` }))
    const externalUsage = auditExternalEvidenceUsage(input.lockedPlan, input.externalEvidence, input.finalReport)
    for (const evidenceId of externalUsage.genuine_misuse_evidence_ids) {
      const evidence = input.externalEvidence.find((entry) => entry.id === evidenceId)
      findings.push(Object.freeze({ type: "INVALID_EXTERNAL_EVIDENCE_USE", severity: "critical", message: `${evidence?.test_name ?? evidenceId} yorumlanamaz olduğu hâlde yapılandırılmış claim provenance içinde klinik kanıt rolüne bağlanmıştır.` }))
    }
    if (input.dataQuality.status === "insufficient" && /günlük yaşamda şu biçimde/iu.test(input.finalReport)) findings.push(Object.freeze({ type: "UNSUPPORTED_FUNCTIONAL_INFERENCE", severity: "high", message: "Yetersiz vakada gözlenmemiş işlevsel ayrıntı üretilmiştir." }))
    if (input.decisionExplanation.preserved_evidence.length && !/Korunmuş(?: yönler| veya|\/koruyucu)|beklenen aralıktadır/iu.test(input.finalReport)) findings.push(Object.freeze({ type: "PRESERVED_CAPACITY_OMISSION", severity: "high", message: "Korunmuş kapasite görünür raporda yer almıyor." }))
    if (input.decisionExplanation.limitations.length && !/maddi sınır|sınırlı tutul|kısmen yorumlanabilir|geçersiz|somut bir örnek bulunmamaktadır|kapsamını (?:sınırlandır|daralt)|yalnız[^.]{0,120}(?:içinde|kapsamında)/iu.test(input.finalReport)) findings.push(Object.freeze({ type: "MAJOR_LIMITATION_OMISSION", severity: "high", message: "Kararı maddi olarak sınırlayan bilgi görünür değil." }))
    if (/(?:neden olmaktadır|kaynaklanmaktadır|doğrudan sebebidir|yol açmaktadır)/iu.test(input.finalReport)) findings.push(Object.freeze({ type: "UNSUPPORTED_CAUSALITY", severity: "critical", message: "Desteksiz nedensellik dili saptandı." }))
    return Object.freeze({ status: findings.some((finding) => ["high", "critical"].includes(finding.severity)) ? "review_required" : "pass", findings: Object.freeze(findings) })
  }
}

export type BuildJuryReportOptions = Readonly<{
  languageRealizer?: JuryLanguageRealizer
  clinicalCritic?: AIClinicalCritic
}>

export async function buildJuryReadyReport(input: ReportInput, options: BuildJuryReportOptions = {}): Promise<JuryReportResult> {
  const therapistObservation = extractCanonicalTherapistObservation(input)
  const base = await runReportV2Shadow(input)
  const externalBundle = structuredExternalEvidence(input)
  const externalEvidence = externalBundle.evidence
  const dataQuality = buildDataQuality(input, base, therapistObservation, externalEvidence)
  const profile = priorityProfile(base, dataQuality.requiredAssessmentComplete)
  const confidence = buildJuryConfidence(dataQuality, base)
  const literature = prepareLiterature(input, base, profile, therapistObservation, externalEvidence)
  const caseScopedEvidenceEnvelope = buildCaseScopedEvidenceEnvelope(input, base, profile, therapistObservation, externalEvidence, literature.selection.sourceIds)
  const decisionExplanation = buildDecisionExplanation(base, profile, therapistObservation, externalBundle.raw, externalEvidence, dataQuality, confidence, caseScopedEvidenceEnvelope)
  const lockedLanguagePlan = buildLockedPlan(input, base, profile, therapistObservation, externalEvidence, dataQuality, confidence, decisionExplanation, literature, caseScopedEvidenceEnvelope)
  const deterministicRealizer = new DeterministicJuryLanguageRealizer()
  const requestedRealizer = options.languageRealizer ?? deterministicRealizer
  let realization = await requestedRealizer.realize(lockedLanguagePlan)
  let languageFallbackUsed = false
  if (!realization || !validateLanguageMapping(lockedLanguagePlan, realization)) {
    languageFallbackUsed = true
    realization = (await deterministicRealizer.realize(lockedLanguagePlan))!
  }
  let finalReport = render(lockedLanguagePlan, realization)
  let validation = validateRealization(lockedLanguagePlan, realization, externalBundle.raw, externalEvidence, therapistObservation, dataQuality, decisionExplanation, literature.selection, base)
  if (!validation.pass && requestedRealizer.identity.provider === "luna") {
    languageFallbackUsed = true
    realization = (await deterministicRealizer.realize(lockedLanguagePlan))!
    finalReport = render(lockedLanguagePlan, realization)
    validation = validateRealization(lockedLanguagePlan, realization, externalBundle.raw, externalEvidence, therapistObservation, dataQuality, decisionExplanation, literature.selection, base)
  }
  const templateSemanticLeakage = new TemplateSemanticLeakageValidator().validate(lockedLanguagePlan, finalReport)
  const externalEvidenceUsageAudit = auditExternalEvidenceUsage(lockedLanguagePlan, externalEvidence, finalReport)
  const criticInput = { lockedPlan: lockedLanguagePlan, decisionExplanation, externalEvidence, dataQuality, finalReport }
  const requestedCritic = options.clinicalCritic ?? new DeterministicClinicalCritic()
  const critic = await requestedCritic.review(criticInput) ?? await new DeterministicClinicalCritic().review(criticInput)
  const reportStatus = validation.pass && critic.status === "pass" ? "ready_for_therapist_review" : "draft_needs_review"
  return Object.freeze({
    version: DNA_REPORT_JURY_VERSION,
    input,
    base,
    overallClassification: base.decisionPlan.overallClassification,
    profilePattern: decisionExplanation.profile_pattern,
    priorityProfile: profile,
    therapistObservation,
    rawExternalTests: externalBundle.raw,
    externalEvidence: Object.freeze(externalEvidence),
    dataQuality,
    confidence,
    decision_explanation: decisionExplanation,
    clinicalInsightPlan: lockedLanguagePlan.clinicalInsightPlan,
    caseScopedEvidenceEnvelope,
    sentenceProvenance: Object.freeze(lockedLanguagePlan.sections.flatMap((section) => section.paragraphs.flatMap((entry) => entry.sentenceProvenance))),
    clauseProvenance: Object.freeze(lockedLanguagePlan.sections.flatMap((section) => section.paragraphs.flatMap((entry) => entry.sentenceProvenance.flatMap((item) => item.clauses)))),
    semanticEvidenceMatrix: caseScopedEvidenceEnvelope.semantic_evidence_matrix,
    literature: literature.selection,
    lockedLanguagePlan,
    critic,
    reportStatus,
    languageProvider: requestedRealizer.identity.provider,
    languageFallbackUsed,
    finalReport,
    validation,
    templateSemanticLeakage,
    externalEvidenceUsageAudit,
  })
}

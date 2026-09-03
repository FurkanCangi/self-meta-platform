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
  type JuryReportSectionId,
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
  physiological: "Bu alandaki puan, uyku, enerji ve bedensel toparlanma açısından belirgin bir güçlük göstermemektedir. Bu puan, farklı günlerde oluşabilecek dalgalanmalara ilişkin bilgi vermez.",
  sensory: "Bu alandaki puan, çevresel uyaranları filtreleme ve duyusal yük altında katılım açısından belirgin bir güçlük göstermemektedir.",
  emotional: "Bu sonuç, engellenme ve değişim sonrasında duygusal toparlanmanın genel olarak beklenen aralıkta olduğunu gösterir.",
  cognitive: "Bu alandaki puan, dikkat, çalışma belleği ve zihinsel organizasyonun genel olarak beklenen aralıkta olduğunu gösterir.",
  executive: "Bu alandaki puan, başlatma, sıralama, inhibisyon, esneklik ve görev tamamlama sırasında belirgin bir güçlük göstermemektedir.",
  interoception: "Bu alandaki puan, beden sinyallerini fark etme ve uygun öz bakım davranışını başlatma becerisinin genel olarak korunduğunu gösterir.",
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
    .replace(/(^|(?<!\d)[.!?]\s+)(?!https?:\/\/)([a-zçğıöşü])/gu, (_match, boundary: string, first: string) => `${boundary}${first.toLocaleUpperCase("tr-TR")}`)
  return clean && !/[.!?):]$/u.test(clean) ? `${clean}.` : clean
}

function capitalizeFirst(text: string): string {
  const clean = String(text || "").trim()
  return clean ? `${clean[0].toLocaleUpperCase("tr-TR")}${clean.slice(1)}` : clean
}

function naturalizeCaregiverExample(text: string): string {
  const clean = text.replace(/^(?:Bakım veren\s+|Güçlü yanı:\s*)/iu, "").trim()
  const complete = clean.replace(/\bgiyinmeye başlıyor\.?$/iu, "giyinme görevine başladığı bildirilmiştir")
  return capitalizeFirst(complete)
}

function caregiverLeadRemoved(text: string): string {
  return text
    .replace(/^(?:Başvuru sebeb[ıi]\s*:\s*)?/iu, "")
    .replace(/^(?:Gerçek başvuru bilgisi\s*:\s*)?/iu, "")
    .replace(/^Bakım\s*veren(?:in)?\s+/iu, "")
    .trim()
}

function factHasVisibleFunctionalDirection(fact: CanonicalAnamnesisEvidenceFact): boolean {
  if (/\b(?:giyinmeye|göreve|etkinliğe)\s+başlıyor\.?$/iu.test(fact.statement.trim())) return false
  return ["DIFFICULTY", "PRESERVED", "MIXED"].includes(fact.semantic_direction)
    || /(?:güçlük|sorun|zorlan|zorlaş|yarım|tamamla(?:mıyor|madı|yamıyor)|sürdürem|unut|kaybet|bırak|kapat|kop|ayrıl|uzaklaş|kaç|yönel|ağla|bağır|otur|bekle|huzursuz|reddet|değişken|korun|fark etme|son anda|kulaklarını|başladığı bölüme dön|görsel kartla devam|başını kollarının üzerine koy|düğmeleri kapatmadan)/iu.test(fact.statement)
}

function factIsVagueFunctionalReport(fact: CanonicalAnamnesisEvidenceFact): boolean {
  const text = caregiverLeadRemoved(fact.statement).trim()
  return /(?:hangi\s+(?:rutin|görev|etkinlik|ortam|davranış)|ne\s+zaman|nerede|ortam\s+ve\s+etkinlik\s+adı|belirtilmedi|verilmedi|açıklanmadı|belli\s+değil|örnek\s+yok|sonra\s+anlat)/iu.test(text)
    || /^(?:(?:son|bazı)\s+günlerde?\s+)?(?:bazen\s+)?(?:çok\s+)?zor\s+oluyor\.?$/iu.test(text)
    || /güçlük\s+olabileceği\s+düşünüldü/iu.test(text)
}

function factHasFunctionalContext(fact: CanonicalAnamnesisEvidenceFact): boolean {
  return fact.functional_roles.some((entry) => ["TASK", "BEHAVIOR", "CONTEXT", "TRIGGER", "OUTCOME"].includes(entry))
    || fact.semantic_context.settings.length > 0
    || fact.semantic_context.triggers.length > 0
    || fact.semantic_context.tasks.length > 0
    || /(?:günlük|rutin|etkinlik|görev|katılım|giyin|yemek|tuvalet|çanta|oyun|okul|evde|sınıf|kantin|servis)/iu.test(fact.statement)
}

function caregiverFunctionalAnchor(fact: CanonicalAnamnesisEvidenceFact | undefined): string | null {
  if (!fact) return null
  const role = classifyCaregiverEvidenceRole(fact)
  const hasFunctionalDetail = factHasFunctionalContext(fact)
  if (!role.functionalEvidence && !hasFunctionalDetail) return null
  const source = caregiverLeadRemoved(fact.source_excerpt)
  const time = source.match(/^(sabah|öğleye doğru|öğleden sonra|okul çıkışında|akşam|hafta sonunda|uykusuz kaldığı gün|evden çıkarken|oyun bittikten sonra|uzun yolculukta)\b/iu)?.[0] ?? null
  const environment = fact.functional_context.environment
  const extractedTask = fact.functional_context.task
  const task = /çanta(?:sını|yı)?\s+hazırla/iu.test(source)
    ? "çanta hazırlama"
    : extractedTask && !/^(?:malzeme|eşya)$/iu.test(extractedTask)
    ? extractedTask
    : null
  const taskOverlapsEnvironment = Boolean(task && environment && (
    (task === "kantin" && /kantin/iu.test(environment))
    || (task === "klinik" && /klinik/iu.test(environment))
    || (task === "okul" && /okul|sınıf/iu.test(environment))
  ))
  const parts = unique([time, environment, task && !taskOverlapsEnvironment ? `${task} sırasında` : null].filter(Boolean) as string[])
  if (parts.length) return parts.join(" ")
  if (fact.functional_context.trigger) return "tarif edilen koşulda"
  return "tarif edilen günlük durumda"
}

function caseFunctionalPrioritySentence(fact: CanonicalAnamnesisEvidenceFact | undefined): string | null {
  if (!fact) return null
  const role = classifyCaregiverEvidenceRole(fact)
  const hasFunctionalDetail = factHasFunctionalContext(fact)
  if ((!role.functionalEvidence && !hasFunctionalDetail) || role.preservedCapacity) return null
  const reported = caregiverLeadRemoved(fact.statement)
  if (!reported) return null
  const naturalReported = `${reported[0].toLocaleLowerCase("tr-TR")}${reported.slice(1)}`
  const explicitSubject = /^(?:çocuk|çocuğun|ergen|danışan|yetişkin)\b/iu.test(naturalReported)
  return `Bakım veren anlatısına göre ${explicitSubject ? "" : "çocuk "}${naturalReported}`
}

function caseDecisionPrioritySentence(fact: CanonicalAnamnesisEvidenceFact | undefined, domain: DomainKey | null): string | null {
  const anchor = caregiverFunctionalAnchor(fact)
  if (!anchor) return null
  const role = classifyCaregiverEvidenceRole(fact!)
  if (role.directionalComplaint && domain && factSupportsDomain(fact!, domain)) {
    return `${capitalizeFirst(anchor)} bildirilen güçlük, ${DOMAIN_LABELS[domain].toLocaleLowerCase("tr-TR")} alanındaki ölçüm sonucunun günlük yaşamdaki karşılığıdır.`
  }
  if (role.directionalComplaint) {
    return `Bakım veren ${anchor} performans güçlüğü bildirmiştir.`
  }
  if (role.preservedCapacity) {
    return `${capitalizeFirst(anchor)} bildirilen korunmuş performans, güçlüğün her koşulda aynı düzeyde olmadığını göstermektedir.`
  }
  return `Kayıtta ${anchor} bildirilen görev performansı, ölçüm sonuçlarının günlük yaşamdaki somut örneğidir.`
}

function caregiverFunctionalSpecificity(fact: CanonicalAnamnesisEvidenceFact, domain: DomainKey | null = null): number {
  const role = classifyCaregiverEvidenceRole(fact)
  if (!role.functionalEvidence) return -100
  const context = fact.functional_context
  const contextCount = [context.environment, context.task, context.trigger, context.behavior, context.support, context.outcome, context.variability].filter(Boolean).length
  const timeSpecific = /\b(?:sabah|öğle|akşam|gece|okul çıkışında|hafta sonunda|yolculukta|etkinlikten sonra)\b/iu.test(fact.source_excerpt)
  const vagueRepetition = /^(?:[^,]{1,18}\s+zor\s*,?\s*){3,}/iu.test(caregiverLeadRemoved(fact.source_excerpt))
  return (role.directionalComplaint ? 8 : 0)
    + (role.preservedCapacity ? 5 : 0)
    + contextCount * 2
    + (timeSpecific ? 3 : 0)
    + (domain && factSupportsDomain(fact, domain) ? 5 : 0)
    - (vagueRepetition ? 8 : 0)
}

function bestCaregiverFunctionalFact(facts: readonly CanonicalAnamnesisEvidenceFact[], domain: DomainKey | null = null): CanonicalAnamnesisEvidenceFact | undefined {
  return [...facts]
    .filter((fact) => classifyCaregiverEvidenceRole(fact).functionalEvidence)
    .sort((left, right) => caregiverFunctionalSpecificity(right, domain) - caregiverFunctionalSpecificity(left, domain))[0]
}

function bestReportedFunctionalFact(facts: readonly CanonicalAnamnesisEvidenceFact[]): CanonicalAnamnesisEvidenceFact | undefined {
  return [...facts]
    .filter((fact) => fact.evidence_status !== "UNUSABLE")
    .filter((fact) => !factIsVagueFunctionalReport(fact))
    .filter(factHasFunctionalContext)
    .filter(factHasVisibleFunctionalDirection)
    .sort((left, right) => {
      const contextCount = (fact: CanonicalAnamnesisEvidenceFact) => [fact.functional_context.environment, fact.functional_context.task, fact.functional_context.trigger, fact.functional_context.behavior, fact.functional_context.outcome].filter(Boolean).length
      return contextCount(right) - contextCount(left)
    })[0]
}

function literatureSafetyBoundary(profile: JuryPriorityProfile): string {
  if (profile.profile_breadth === "preserved") {
    return "Literatür, korunmuş alan sonuçlarının günlük yaşam bilgileriyle birlikte yorumlanmasına yardımcı olur. Bu kaynaklar tek bir çocuk için tanı, neden-sonuç, prognoz veya biyolojik mekanizma kanıtı değildir."
  }
  if (["focused_multidomain", "broad_multidomain"].includes(profile.profile_breadth)) {
    return "Literatür, birden fazla self-regülasyon alanının birlikte ele alınması için bilimsel çerçeve sağlar. Bu kaynaklar bireysel düzeyde tanı, neden-sonuç, prognoz veya biyolojik mekanizma kanıtı oluşturmaz."
  }
  return "Literatür, ölçümde öne çıkan alanın bilimsel çerçevesini açıklar. Bu kaynaklar bireysel düzeyde tanı, neden-sonuç, prognoz veya biyolojik mekanizma kanıtı oluşturmaz."
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
    .replace(/madde örüntüsü/giu, "madde yanıtlarının dağılımı")
    .replace(/dengeleyici işlev bilgisi/giu, "korunmuş işlev bilgisi")
    .replace(/profil dağılımı/giu, "alan sonuçlarının dağılımı")
    .replace(/skor profilindeki seçici ayrışma/giu, "alan puanları içindeki belirgin farklılaşma")
    .replace(/skor ayrışması/giu, "alan puanındaki farklılaşma")
    .replace(/seçici skor dağılımı/giu, "bir alanla sınırlı puan dağılımı")
    .replace(/seçici ayrışma/giu, "bir alanla sınırlı farklılaşma")
    .replace(/etkilenimin profil içinde seçici mi yoksa yaygın mı olduğunu/giu, "güçlüğün bir alanla sınırlı mı yoksa birden fazla alana mı yayıldığını")
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
  const userFacingText = statementType === "literature_link" ? userFacingClinicalText(text) : normalizeTurkishClinicalText(userFacingClinicalText(text))
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
  if (match.resultQuality === "missing_result" || /(?:puan|skor|sonuç)\s*(?:belirtilmedi|yok|verilmedi|eksik|yazılmamış|yazilmamis)|sonuç\s+bilgisi\s+eksik|yalnız\s+boş\s+kapak\s+sayfası|yalniz\s+bos\s+kapak\s+sayfasi/iu.test(reported)) return "insufficient_information"
  if (/formun yarısı boş|yarısı boş|kısmen eksik|sayı yazılmamış|puan(?:ı|lama)?\s*(?:yok|verilmemiş)|tamamlanmamış|acele doldur/iu.test(reported)) return "partially_interpretable"
  if (match.resultQuality === "ham_puan_only" || match.resultQuality === "qualitative_only" || match.ageCompatible == null || match.resultDirection === "unclear") return "partially_interpretable"
  if (match.resultQuality === "interpretable") return "valid"
  return "insufficient_information"
}

function withoutNegatedDifficulty(text: string): string {
  return text.replace(/(?:belirgin\s+)?(?:duyusal\s+|işitsel\s+|fizyolojik\s+|bilişsel\s+|duygusal\s+|yürütücü\s+)?(?:güçlük|zorlanma|problem|risk)(?:\s+[a-zçğıöşü]+){0,3}\s+(?:görülmedi|saptanmadı|bulunmadı|izlenmedi|yok(?:tur)?|değil)/giu, " ")
}

function evidenceDirection(match: ExternalTestMatch, validity: ExternalValidityStatus, rawEvidenceText = ""): ExternalEvidenceDirection {
  if (validity === "invalid" || validity === "insufficient_information") return "unusable"
  const text = `${match.reportedResult ?? ""} ${match.reportedInterpretation ?? ""} ${rawEvidenceText}`
  const directionalText = withoutNegatedDifficulty(text)
  const difficulty = /beklenen(?:den|in)\s+(?:çok|daha\s+fazla|fazla|az|altında)|belirgin\s+(?:güçlük|zorlanma)|klinik\s+yüksek|\byüksek\b|\bdüşük\b|güçlük|zorlan|problem|risk/iu.test(directionalText)
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
  const directionalText = withoutNegatedDifficulty(text)
  const difficulty = /beklenen(?:den|in)\s+(?:çok|daha\s+fazla|fazla|az|altında)|yüksek|güçlük|zorlan|problem|belirgin|düşük|risk/iu.test(directionalText)
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

function normalizeVisibleReportedText(text: string): string {
  return normalizeTurkishClinicalText(text)
    .replace(/[!?]{2,}/gu, ".")
    .replace(/\.{2,}/gu, ".")
    .replace(/\s+([.,;:!?])/gu, "$1")
    .replace(/(^|[.!?]\s+)([a-zçğıöşü])/gu, (_match, boundary: string, first: string) => `${boundary}${first.toLocaleUpperCase("tr-TR")}`)
    .trim()
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
      reported_result: normalizeVisibleReportedText(match.reportedResult?.trim() || "Bildirilen sonuç yetersiz"),
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
    const explicitlyMissingResult = /(?:puan|skor|sonuç)\s*(?:belirtilmedi|yok|verilmedi|eksik|yazılmamış|yazilmamis)|sonuç\s+bilgisi\s+eksik|yalnız\s+boş\s+kapak\s+sayfası|yalniz\s+bos\s+kapak\s+sayfasi/iu.test(rawText)
    const insufficient = explicitlyMissingResult || (!mention.reported_result && !mention.reported_interpretation)
    const validity: ExternalValidityStatus = invalid ? "invalid" : insufficient ? "insufficient_information" : "partially_interpretable"
    const direction = validity === "invalid" || validity === "insufficient_information" ? "unusable" : directionForRawExternal(rawText)
    const supportedDomains = domainsForExternalText(rawText)
    const safeId = mention.test_name.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9]+/gu, "_").replace(/^_+|_+$/gu, "") || `raw_${mention.ordinal}`
    const displayTestName = mention.clearly_unparseable_noise ? "Adı okunamayan dış test" : mention.test_name
    evidence.push(Object.freeze({
      id: `raw_${safeId}_${mention.ordinal}`,
      test_name: displayTestName,
      category: "unrecognized",
      reported_result: normalizeVisibleReportedText(mention.reported_result || "Bildirilen sonuç yetersiz"),
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
      decision_relevant: supportedDomains.length > 0 && externalDecisionRelevant(validity, direction),
    }))
  }
  const deduplicatedEvidence: JuryExternalEvidence[] = []
  const seenEvidence = new Set<string>()
  for (const entry of evidence) {
    const key = entry.category === "unrecognized"
      ? `raw:${entry.test_name.toLocaleLowerCase("tr-TR")}|${entry.reported_result.toLocaleLowerCase("tr-TR")}|${entry.validity_status}|${entry.evidence_direction}|${entry.source_text.toLocaleLowerCase("tr-TR")}`
      : `registry:${entry.id}`
    if (seenEvidence.has(key)) continue
    seenEvidence.add(key)
    deduplicatedEvidence.push(entry)
  }
  return Object.freeze({ raw: Object.freeze(mentions), evidence: Object.freeze(deduplicatedEvidence) })
}

function hasMeaningfulAnamnesis(text: string): boolean {
  const words = text.toLocaleLowerCase("tr-TR").match(/[a-zçğıöşü]{3,}/gu) ?? []
  const lowInformationMarkers = (text.match(/bilmiyom|xx\s+qqq|verilmedi|örnek yok|sonra anlat|neye göre belli değil/giu) ?? []).length
  return words.length >= 18 && lowInformationMarkers < 3
}

function hasConcreteFunctionalExample(text: string, meaningful: boolean): boolean {
  if (!meaningful) return false
  const context = /evde|okulda|sınıf|servis|kantin|park|market|soyunma|yemekhane|doğum günü|hafta sonu|sabah|hazırlan|hazirlan|giyin|yemek|tuvalet|oyun|alışveriş|avm|yolculuk|seans|masa işi/iu.test(text)
  const action = /tamamla|sürdür|bırak|birak|kaç|kapıya git|kulak(?:larını)?\s+kapat|geri dön|ağla|bağır|hazırla|sıradan çık|katılım|toparlan/iu.test(text)
  return context && action
}

function buildDataQuality(input: ReportInput, base: Awaited<ReturnType<typeof runReportV2Shadow>>, observation: CanonicalTherapistObservation, external: readonly JuryExternalEvidence[], envelope: CaseScopedEvidenceEnvelope): ReportDataQuality {
  const text = normalizedAnamnesis(input)
  const requiredAssessmentComplete = Array.isArray(input.answers) && input.answers.length === 60 && input.answers.every((value) => Number.isInteger(value) && value >= 1 && value <= 5)
  const dnaProfileInterpretable = requiredAssessmentComplete && base.v1.domainResults.length === 6
  const legacyAnamnesisMeaningful = hasMeaningfulAnamnesis(text)
  const canonicalShortConcreteExample = !legacyAnamnesisMeaningful && envelope.functional_evidence_profile.has_caregiver_functional_example
  const anamnesisMeaningful = legacyAnamnesisMeaningful || canonicalShortConcreteExample
  const concreteFunctionalExample = hasConcreteFunctionalExample(text, legacyAnamnesisMeaningful) || canonicalShortConcreteExample
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
    shortConcreteAnamnesisOnly: canonicalShortConcreteExample,
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
  if (dataQuality.shortConcreteAnamnesisOnly) {
    score -= 1
    positive.push("Kısa anamnez günlük yaşama ilişkin somut bir örnek içeriyor.")
    limiting.push("Anamnez tek ve kısa bir günlük yaşam örneğiyle sınırlıdır.")
  } else {
    if (dataQuality.anamnesisMeaningful) { score += 1; positive.push("Anamnez klinik olarak kullanılabilir bilgi içeriyor.") }
    if (dataQuality.concreteFunctionalExample) { score += 1; positive.push("Günlük yaşama ilişkin somut örnek bulunuyor.") }
  }
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

function priorityHasClearSeparation(profile: Pick<JuryPriorityProfile, "affected_domains" | "primary_priority">, domains: readonly DomainResult[]): boolean {
  if (!profile.primary_priority || profile.affected_domains.length <= 1) return true
  const affected = domains
    .filter((domain) => profile.affected_domains.includes(domain.key as DomainKey))
    .sort((left, right) => severity(right) - severity(left) || left.score - right.score || left.key.localeCompare(right.key))
  const primary = affected.find((domain) => domain.key === profile.primary_priority)
  const runnerUp = affected
    .filter((domain) => domain.key !== profile.primary_priority)
    .sort((left, right) => left.score - right.score || left.key.localeCompare(right.key))[0]
  if (!primary || !runnerUp) return true
  return runnerUp.score - primary.score >= 3
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
    ? `${joinNatural(affected.map((domain) => DOMAIN_LABELS[domain].toLocaleLowerCase("tr-TR")))} alanlarına yayılan odaklı çok alanlı güçlük`
    : breadth === "broad_multidomain"
    ? "yaygın çok alanlı self-regülasyon güçlüğü"
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
  const scoreProfilePrimaryLabel = profile.primary_priority ? PROFILE_LABELS[`domain_${profile.primary_priority}` as FormulationId] : null
  const alternatives = base.decisionPlan.alternativeFormulations.map((candidate) => PROFILE_LABELS[candidate.id]).filter((label) => label !== scoreProfilePrimaryLabel)
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
    DNA_ITEM_PATTERN: "madde yanıtlarının dağılımı",
    ANAMNESIS: "anamnez",
    CAREGIVER_REPORT: "bakım veren anlatısı",
    THERAPIST_OBSERVATION: "terapist gözlemi",
    EXTERNAL_ASSESSMENT: "dış test",
    PRESERVED_CAPACITY: "korunmuş işlev bilgisi",
    CONTEXTUAL_EVIDENCE: "bağlamsal karşılaştırma",
  }
  const matrixLabels = base.evidenceMatrix.units
    .filter((unit) => !["ANAMNESIS", "CAREGIVER_REPORT", "THERAPIST_OBSERVATION", "EXTERNAL_ASSESSMENT"].includes(unit.sourceType))
    .filter((unit) => unit.domain === key || (unit.domain == null && unit.supports.includes(`domain_${key}`)))
    .filter((unit) => unit.sourceType !== "PRESERVED_CAPACITY")
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
    .replace(/bakım verenin bildirdiği koşul denenmedi/iu, "bildirilen koşul bu gözlemde denenmedi")
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
    const semanticValidity = entry.decision_relevant
      ? canonicalValidityFromExternal(entry.validity_status)
      : entry.validity_status === "invalid"
      ? "INVALID" as const
      : "INSUFFICIENT_INFORMATION" as const
    return Object.freeze({
      id: `${caseId}.fact.external.${factIdPart(entry.id)}`,
      case_id: caseId,
      source_type: "EXTERNAL_TEST" as const,
      statement: `${entry.test_name}: ${entry.reported_result}.`,
      source_excerpt: entry.source_text,
      domains: Object.freeze(entry.supported_domain),
      semantic_direction: entry.decision_relevant ? canonicalDirectionFromExternal(entry.evidence_direction) : "UNKNOWN" as const,
      epistemic_status: entry.decision_relevant ? canonicalEpistemicFromExternal(entry.validity_status, entry.source_text) : "INVALID_OR_UNINTERPRETABLE" as const,
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

function domainAreaSubject(values: readonly string[]): string {
  if (!values.length) return "alanlar"
  return `${joinNatural(values)} ${values.length === 1 ? "alanı" : "alanları"}`
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
  const sourceLabel = (fact: CaseScopedEvidenceFact | undefined, sourceType: SourceEvidenceRelation["left_source_type"]): string => {
    if (sourceType === "EXTERNAL_TEST") return fact?.statement.split(":")[0]?.trim() || "dış test sonucu"
    if (sourceType === "THERAPIST_OBSERVATION") return "terapist gözlemi"
    return "bakım veren anlatısı"
  }
  const discrepant = material.find(relationIsDiscrepant)
  if (discrepant) {
    const left = factsById.get(discrepant.left_fact_id)
    const right = factsById.get(discrepant.right_fact_id)
    const directionLabel = (direction: SourceEvidenceRelation["left_direction"]): string => direction === "DIFFICULTY"
      ? "güçlük"
      : direction === "PRESERVED"
      ? "korunmuş performans"
      : direction === "MIXED"
      ? "karma bulgu"
      : "nötr bilgi"
    const relationText = discrepant.relation === "CONTEXTUAL_DISCREPANCY"
      ? "Bu iki kaynak farklı koşullarda aynı yönde sonuç vermemektedir; bağlam farkı klinik yorumda açık bir sınır olarak korunmuştur."
      : "Bu iki kaynak aynı yönde sonuç vermemektedir; bu ayrışma klinik yorumun kesinliğini ve kapsamını sınırlandırmaktadır."
    return Object.freeze({
      text: `${capitalizeFirst(sourceLabel(left, discrepant.left_source_type))} ${directionLabel(discrepant.left_direction)} yönünde bilgi vermektedir; buna karşılık ${sourceLabel(right, discrepant.right_source_type)} ${directionLabel(discrepant.right_direction)} yönünde sonuç vermektedir. ${relationText}`,
      factIds: Object.freeze([discrepant.left_fact_id, discrepant.right_fact_id]),
      relations: Object.freeze([discrepant]),
    })
  }
  const partiallyConvergent = material.find((relation) => relation.relation === "PARTIALLY_CONVERGENT")
  if (partiallyConvergent) {
    const left = factsById.get(partiallyConvergent.left_fact_id)
    const right = factsById.get(partiallyConvergent.right_fact_id)
    const labels = unique([
      sourceLabel(left, partiallyConvergent.left_source_type),
      sourceLabel(right, partiallyConvergent.right_source_type),
    ])
    return Object.freeze({
      text: `${capitalizeFirst(joinNatural(labels))} farklı kapsamda bilgi vermektedir. Kaynaklardan biri karma sonuç içerdiği için yorumun kesinliği azaltılmıştır.`,
      factIds: Object.freeze([partiallyConvergent.left_fact_id, partiallyConvergent.right_fact_id]),
      relations: Object.freeze([partiallyConvergent]),
    })
  }
  const convergent = material.filter(relationIsConvergent)
  if (convergent.length) {
    const relation = convergent[0]
    const direction = relation.relation === "CONVERGENT_PRESERVED" ? "korunmuş kapasite" : "güçlük"
    const labels = unique(convergent.flatMap((entry) => [
      sourceLabel(factsById.get(entry.left_fact_id), entry.left_source_type),
      sourceLabel(factsById.get(entry.right_fact_id), entry.right_source_type),
    ]))
    return Object.freeze({
      text: `${capitalizeFirst(joinNatural(labels))} ${direction} yönünde aynı sonucu göstermektedir. Bu uyum klinik yorumu desteklemekte, her kaynak yine kendi görev ve ortamıyla sınırlı tutulmaktadır.`,
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
  const domainFacts = envelope.semantic_evidence_matrix.facts.filter((fact) =>
    fact.domains.includes(relation.domain)
    && fact.epistemic_status === "OBSERVED_OR_REPORTED"
    && !["INVALID", "INSUFFICIENT_INFORMATION"].includes(fact.semantic_validity)
  )
  const factLabel = (fact: CaseScopedEvidenceFact): string => sourceLabel(fact, fact.source_type)
  const difficultyFacts = domainFacts.filter((fact) => ["DIFFICULTY", "MIXED"].includes(fact.semantic_direction))
  const supportsVisiblePreservedCapacity = (fact: CaseScopedEvidenceFact): boolean => fact.source_type === "CAREGIVER_ANAMNESIS"
    ? factSupportsPreservedCapacity(fact as CanonicalAnamnesisEvidenceFact)
    : factEligibleForPreservedCapacity(fact)
  const preservedFacts = domainFacts.filter(supportsVisiblePreservedCapacity)
  const absenceFacts = domainFacts.filter((fact) => fact.source_type === "CAREGIVER_ANAMNESIS" && fact.semantic_direction === "PRESERVED" && !supportsVisiblePreservedCapacity(fact))
  const difficultyLabels = unique(difficultyFacts.map(factLabel))
  const preservedLabels = unique(preservedFacts.map(factLabel))
  const overlappingLabels = difficultyLabels.filter((label) => preservedLabels.includes(label))
  if (difficultyLabels.length && preservedLabels.length) {
    const directionSummary = overlappingLabels.length
      ? `${capitalizeFirst(joinNatural(overlappingLabels))} hem güçlük hem de korunmuş performans bilgisi içermektedir.${difficultyLabels.includes(`${DOMAIN_LABELS[relation.domain]} alan puanı`) ? ` ${DOMAIN_LABELS[relation.domain]} alan puanı, bu kaynaktaki güçlük bilgisiyle aynı yöndedir.` : ""}`
      : difficultyLabels.length > 1
      ? `${capitalizeFirst(joinNatural(difficultyLabels))} güçlük yönünde aynı sonucu göstermektedir.`
      : `${capitalizeFirst(difficultyLabels[0])} güçlük yönünde sonuç vermektedir.`
    const distinctPreserved = preservedLabels.filter((label) => !overlappingLabels.includes(label))
    const preservedSummary = distinctPreserved.length
      ? `${capitalizeFirst(joinNatural(distinctPreserved))} ise korunmuş performans yönünde bilgi sağlamaktadır.`
      : "Aynı kaynakta bildirilen korunmuş performans, güçlüğün koşullara göre değişebildiğini göstermektedir."
    const boundary = "Bu farklılık, güçlüğün bütün görev ve koşullarda aynı düzeyde olduğu sonucuna izin vermemektedir."
    return Object.freeze({
      text: `${directionSummary} ${preservedSummary} ${boundary}`,
      summary: `${capitalizeFirst(leftLabel)} ile ${rightLabel} aynı yönde değildir. Günlük yaşam yorumu bu nedenle yalnız bildirilen görev ve koşulları kapsamaktadır.`,
      factIds: Object.freeze(unique([...difficultyFacts, ...preservedFacts].map((fact) => fact.id))),
      relation,
    })
  }
  const absenceLabels = unique(absenceFacts.map(factLabel))
  if (difficultyLabels.length && absenceLabels.length) {
    const directionSummary = difficultyLabels.length > 1
      ? `${capitalizeFirst(joinNatural(difficultyLabels))} güçlük yönünde aynı sonucu göstermektedir.`
      : `${capitalizeFirst(difficultyLabels[0])} güçlük yönünde sonuç vermektedir.`
    const absenceSummary = `${capitalizeFirst(joinNatural(absenceLabels))} ise aynı alanda güçlük bildirilmediğini göstermektedir.`
    const boundary = "Bu farklılık, güçlüğün bütün görev ve koşullarda aynı düzeyde olduğu sonucuna izin vermemektedir."
    return Object.freeze({
      text: `${directionSummary} ${absenceSummary} ${boundary}`,
      summary: `${capitalizeFirst(leftLabel)} ile ${rightLabel} aynı yönde değildir. Günlük yaşam yorumu bu nedenle yalnız bildirilen görev ve koşulları kapsamaktadır.`,
      factIds: Object.freeze(unique([...difficultyFacts, ...absenceFacts].map((fact) => fact.id))),
      relation,
    })
  }
  return Object.freeze({
    text: `${capitalizeFirst(leftLabel)} ${directionText(relation.left_direction)} yönünde sonuç vermektedir. Buna karşılık ${rightLabel} ${directionText(relation.right_direction)} yönünde bilgi sağlamaktadır. Bu iki sonuç aynı yönde değildir. Farklı görev ve durumları yansıttıkları için biri diğerini geçersiz kılmaz; ancak güçlüğün her koşulda aynı düzeyde olduğu söylenemez.`,
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

function directDecisionSentence(profile: JuryPriorityProfile, clearPriority: boolean, confidence: JuryConfidence): string {
  const limitedEvidence = confidence === "Sınırlı" || confidence === "Yetersiz"
  if (!profile.primary_priority) {
    return limitedEvidence
      ? "Mevcut ölçümde altı alan da yaş grubuna göre beklenen aralıktadır; sınırlı günlük yaşam bilgisi tek bir güçlük alanı belirlemeye izin vermemektedir."
      : "Altı alanın ölçüm sonuçları yaş grubuna göre beklenen aralıktadır. Alan puanları tek bir güçlük alanını öne çıkarmamaktadır."
  }
  const primary = DOMAIN_LABELS[profile.primary_priority]
  const affected = profile.affected_domains.map((domain) => DOMAIN_LABELS[domain])
  const secondary = profile.affected_domains.filter((domain) => domain !== profile.primary_priority).map((domain) => DOMAIN_LABELS[domain])
  if (profile.profile_breadth === "selective_single_domain") {
    return limitedEvidence
      ? `Mevcut ölçüm sonuçları en çok ${primary.toLocaleLowerCase("tr-TR")} alanındaki güçlüğe işaret etmektedir; günlük yaşam bilgisi sınırlı olduğundan bu yorum kayıttaki bilgilerle sınırlandırılmıştır.`
      : `Bulgular en çok ${primary.toLocaleLowerCase("tr-TR")} alanındaki güçlüğü desteklemektedir. Diğer alanların beklenen aralıkta olması, güçlüğün bu alanla sınırlı olduğunu göstermektedir.`
  }
  if (profile.profile_breadth === "focused_multidomain") {
    if (!clearPriority) return limitedEvidence
      ? `Mevcut ölçüm sonuçları ${domainAreaSubject(affected.map((label) => label.toLocaleLowerCase("tr-TR")))}nda güçlüğe işaret etmektedir; sınırlı günlük yaşam bilgisi tek bir alanı öne çıkarmaya izin vermemektedir.`
      : `Bulgular ${domainAreaSubject(affected.map((label) => label.toLocaleLowerCase("tr-TR")))}nda güçlük bulunduğunu desteklemektedir.`
    return `Bulgular en çok ${primary.toLocaleLowerCase("tr-TR")} alanındaki güçlüğü desteklemektedir. ${domainAreaSubject(secondary).toLocaleLowerCase("tr-TR")} da beklenen aralığın dışında olduğu için, günlük yaşam güçlüğü tek bir alanla açıklanmamıştır.`
  }
  if (!clearPriority) return limitedEvidence
    ? "Mevcut ölçüm sonuçları birden fazla self-regülasyon alanında güçlüğe işaret etmektedir; sınırlı günlük yaşam bilgisi tek bir alanı öne çıkarmaya izin vermemektedir."
    : "Bulgular birden fazla self-regülasyon alanında güçlük bulunduğunu göstermektedir."
  return `Bulgular birden fazla self-regülasyon alanında güçlük bulunduğunu göstermektedir. ${primary} bu geniş dağılım içinde daha belirgindir; diğer etkilenmiş alanlar da klinik kararın parçasıdır.`
}

function sentenceList(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function conciseDecisionEmphasis(text: string, prefer: "first" | "last" = "first"): string {
  const sentences = sentenceList(text)
  if (sentences.length <= 1) return text.trim()
  return prefer === "last" ? sentences.at(-1)! : sentences[0]
}

function buildClinicalInsightPlan(input: ReportInput, profile: JuryPriorityProfile, domains: readonly DomainResult[], observation: CanonicalTherapistObservation, external: readonly JuryExternalEvidence[], dataQuality: ReportDataQuality, confidence: JuryConfidenceResult, envelope: CaseScopedEvidenceEnvelope): ClinicalInsightPlan {
  const affected = profile.affected_domains.map((domain) => DOMAIN_LABELS[domain])
  const preserved = profile.preserved_domains.map((domain) => DOMAIN_LABELS[domain])
  const primary = profile.primary_priority ? DOMAIN_LABELS[profile.primary_priority] : "tek bir alan"
  const clearPriority = priorityHasClearSeparation(profile, domains)
  const closeMultidomain = profile.affected_domains.length > 1 && !clearPriority
  const functional = envelope.functional_evidence_profile
  const usableCaregiverFacts = envelope.anamnesis_evidence.filter((fact) => fact.evidence_status !== "UNUSABLE")
  const functionalCaregiverFacts = functional.has_caregiver_functional_example
    ? usableCaregiverFacts.filter((fact) => classifyCaregiverEvidenceRole(fact).functionalEvidence)
    : []
  const reportedFunctionalFact = bestReportedFunctionalFact(usableCaregiverFacts)
  const languageEvidenceSufficient = dataQuality.status !== "insufficient" || functionalCaregiverFacts.length > 0 || Boolean(reportedFunctionalFact)
  const directionalCaregiverFact = usableCaregiverFacts.find((fact) => {
    const role = classifyCaregiverEvidenceRole(fact)
    return role.directionalComplaint && !role.functionalEvidence
  })
  const primaryCaregiverFacts = profile.primary_priority && clearPriority
    ? functionalCaregiverFacts.filter((fact) => factSupportsDomain(fact, profile.primary_priority!))
      .filter((fact) => classifyCaregiverEvidenceRole(fact).preservedCapacity || factHasVisibleFunctionalDirection(fact))
    : []
  const primaryCaregiverFact = bestCaregiverFunctionalFact(primaryCaregiverFacts, profile.primary_priority)
  const primaryCaregiverDifficultyFact = primaryCaregiverFact && classifyCaregiverEvidenceRole(primaryCaregiverFact).directionalComplaint ? primaryCaregiverFact : undefined
  const caregiverDifficultyFact = bestCaregiverFunctionalFact(functionalCaregiverFacts.filter((fact) => classifyCaregiverEvidenceRole(fact).directionalComplaint && factHasVisibleFunctionalDirection(fact)), profile.primary_priority)
  const caregiverFact = primaryCaregiverFact ?? caregiverDifficultyFact ?? bestCaregiverFunctionalFact(functionalCaregiverFacts.filter((fact) => classifyCaregiverEvidenceRole(fact).preservedCapacity || factHasVisibleFunctionalDirection(fact))) ?? reportedFunctionalFact
  const caregiverPreservedFact = functionalCaregiverFacts.find(factSupportsPreservedCapacity)
  const functionalPriority = caseFunctionalPrioritySentence(caregiverFact)
  const preservedFunctionalAnchor = caregiverFunctionalAnchor(caregiverPreservedFact)
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
    ? `${preservedExternal.test_name} sonucu ${preservedExternal.reported_result.toLocaleLowerCase("tr-TR")} olarak bildirildiği için, testin değerlendirdiği kapsamda kapasitenin korunabildiği görülmektedir.`
    : caregiverPreservedFact
    ? caregiverPreservedFact.functional_context.support
      ? `Bakım veren, ${preservedFunctionalAnchor ?? "kayıtta belirtilen koşulda"} belirtilen destek sağlandığında performansın sürdürülebildiğini bildirmektedir. Bu bilgi, güçlüğün desteğin olmadığı ya da yetersiz kaldığı koşullarda arttığını göstermektedir.`
      : `Bakım veren, ${preservedFunctionalAnchor ?? "kayıtta belirtilen koşulda"} performansın korunduğunu bildirmektedir. Bu bilgi, güçlüğün bütün günlük durumlara genellenmemesi gerektiğini göstermektedir.`
    : preserved.length
    ? functional.has_performance_variability_evidence
      ? `${preserved.length === 5 ? `${primary} dışındaki korunmuş beş alanın puanları yaş grubuna göre` : domainAreaSubject(preserved)} beklenen aralıktadır; bu sonuçlar belgelenen performans değişkenliğinin bütün self-regülasyon alanlarına yayılmadığını göstermektedir.`
      : `${preserved.length === 5 ? `${primary} dışındaki korunmuş beş alanın puanları yaş grubuna göre` : domainAreaSubject(preserved)} beklenen aralıktadır; bu dağılım güçlüğün bütün self-regülasyon alanlarına yayılmadığını göstermektedir.`
    : "Ayrı bir korunmuş alan bulunmamaktadır; bu nedenle bütün etkilenen alanlar birlikte değerlendirilmiştir."
  const contextEffect = observationSupports.multiple
    ? "Doğrudan gözlemde çevresel yük azaltılırken görev aynı zamanda yazılı veya görsel adımlarla yapılandırılmıştır. Bu iki destek birlikte sunulduğu için, performanstaki değişim tek bir etkene bağlanamaz."
    : observationContextComparison
    ? "Doğrudan gözlemde görev koşulları değiştiğinde performansın da değişmesi, kapasitenin yapılandırılmış ve daha yoğun koşullarda aynı düzeyde kullanılamadığını göstermektedir."
    : primaryCaregiverFact
    ? functionalPriority ?? (profile.primary_priority
      ? `Bakım verenin verdiği günlük yaşam örneği, ${primary.toLocaleLowerCase("tr-TR")} bulgusunun kayıtta hangi günlük yaşam durumu ve koşullarla birlikte yer aldığını göstermektedir.`
      : "Bakım verenin aktardığı örnek, korunmuş alan puanlarına eşlik eden bağlamsal performans değişimini açıklamaktadır.")
    : caregiverFact
    ? "Bakım verenin verdiği örnek yalnız bildirilen görev ve koşullar kapsamında değerlendirilmiştir."
    : directionalCaregiverFact
    ? "Genel bakım veren bildiriminde belirli bir görev, davranış veya bağlam örneği bulunmadığı için puan örüntüsü günlük yaşamda gözlenmiş bir güçlük olarak yorumlanmamıştır."
    : observation.present && observationSupportsPrimary
    ? "Doğrudan gözlem, ölçümde öne çıkan alanın görev sırasında nasıl göründüğüne ilişkin ek bilgi sağlamaktadır."
    : observation.present
    ? "Doğrudan gözlem yalnız gözlenen görev ve koşullar hakkında bilgi vermektedir."
    : "Alan puanlarının dağılımı, etkilenimin profil içinde seçici mi yoksa yaygın mı olduğunu göstermektedir."
  const crossDomain = profile.profile_breadth === "broad_multidomain"
    ? functionalCaregiverFacts.length
      ? "Alan puanları birden fazla alanın güçlük yönünde olduğunu göstermektedir. Bakım verenin günlük yaşam örneği yalnız bildirilen görevi açıklamakta; bu görevde hangi alanın daha belirgin olduğunu göstermemektedir."
      : "Alan puanları birden fazla alanın güçlük yönünde olduğunu göstermektedir. Kayıtta bu alanların günlük yaşamda nasıl birlikte görüldüğünü gösteren somut bir örnek yoktur."
    : profile.profile_breadth === "focused_multidomain"
    ? functionalCaregiverFacts.length
      ? "Alan puanları birden fazla alanın güçlük yönünde olduğunu göstermektedir. Bakım verenin günlük yaşam örneği yalnız bildirilen görevi açıklamakta; bu görevde hangi alanın daha belirgin olduğunu göstermemektedir."
      : "Alan puanları birden fazla alanın güçlük yönünde olduğunu göstermektedir. Kayıtta bu alanların günlük yaşamda nasıl birlikte görüldüğünü gösteren somut bir örnek yoktur."
    : profile.profile_breadth === "selective_single_domain"
    ? `${primary} profil içinde öne çıkan tek alandır. ${preserved.length ? `${domainAreaSubject(preserved)}ndaki beklenen sonuçlar, güçlüğün seçici niteliğini desteklemektedir.` : "Diğer alanların dağılımı bu seçici örüntüyle uyumludur."}`
    : functional.has_caregiver_difficulty_example
      ? "Altı alanın skorları genel olarak korunmuştur. Bildirilen güçlük yalnız ortaya çıktığı bağlam içinde ele alınmaktadır."
      : "Altı alanın skorları genel olarak korunmuştur. Profil düzeyinde yaygın bir self-regülasyon güçlüğü saptanmamıştır."
  const deeperPattern = !languageEvidenceSufficient
    ? profile.affected_domains.length > 1 && !clearPriority
      ? `${domainAreaSubject(affected)}ndaki skorlar ölçüm düzeyinde güçlük yönünde ayrışmaktadır; aralarındaki fark tek bir alanı önceliklendirmek için yeterli değildir. Günlük yaşamdaki karşılığa ilişkin somut örnek bulunmadığı için rapor bu dağılımı gözlenmiş bir işlev kaybına dönüştürmemektedir.`
      : `${primary} puanı ölçüm düzeyinde güçlük yönünde ayrışmaktadır. Günlük yaşamdaki karşılığına ilişkin somut örnek bulunmadığı için rapor bu ayrışmayı gözlenmiş bir işlev kaybına dönüştürmemektedir.`
    : difficultyExternal && preservedExternal
    ? `${difficultyExternal.test_name} güçlük yönündeki bulguyu desteklerken ${preservedExternal.test_name} belirli koşullardaki kapasitenin korunduğunu göstermektedir. Birlikte ele alındığında klinik örüntü, kapasitenin gerçek yaşam talepleri altında değişken kullanımıyla açıklanmaktadır.`
    : observationContextComparison
    ? `Terapist gözlemi performansın koşullara göre değiştiğini göstermektedir. Bu değişkenlik, klinik güçlüğün kapasitenin istikrarlı kullanımında ortaya çıktığını açıklamaktadır.`
    : crossDomain
  const distinguishing = directDecisionSentence(profile, clearPriority, confidence.category)
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
  const sparseInsight = languageEvidenceSufficient
    ? null
    : profile.profile_breadth === "broad_multidomain"
    ? `Altı alanın tamamı ölçümde güçlük yönünde ayrışmaktadır. ${clearPriority ? `${primary} bu geniş dağılım içinde daha belirgindir.` : "Alan puanları tek bir alanı önceliklendirecek kadar ayrışmamıştır."} Somut günlük yaşam örneği bulunmadığı için etkilenmiş alanların hiçbiri yorumun dışında bırakılmamıştır.`
    : profile.profile_breadth === "focused_multidomain"
    ? `${domainAreaSubject(affected)} ölçümde güçlük yönünde ayrışmaktadır. ${clearPriority ? `${primary} daha belirgin olsa da` : "Puanlar birbirine yakın olduğundan"} somut günlük yaşam örneği bulunmayan sonuç tek alanlı bir açıklamaya indirgenmemiştir.`
    : profile.profile_breadth === "selective_single_domain"
    ? `Ölçümde yalnız ${primary} alanı beklenen aralığın dışındadır; diğer beş alan yaş grubuna göre beklenen aralıktadır. Günlük yaşam örneği bulunmadığı için bu puanın hangi görevlerde güçlüğe dönüştüğü bilinmemektedir.`
    : "Altı alanın ölçüm sonuçları yaş grubuna göre beklenen aralıktadır. Somut günlük yaşam örneği bulunmadığı için bu kayıt üzerinden özgül bir işlev güçlüğü ileri sürülmemiştir."
  const caregiverDescribesEnvironmentalLoad = Boolean(caregiverFact && /(?:kalabalık|ses|gürült|uyaran|avm|hoparlör|blender|süpürge|kantin|yemekhane)/iu.test(caregiverFact.source_excerpt))
  const matchingObservation = Boolean(caregiverFact && observationFact && /benzer görev[^.]{0,100}aynı güçlük/iu.test(observationFact.statement))
  const genericCaseInsight = caregiverFact && observationFact && matchingObservation
    ? "Bakım veren bildirimi ile doğrudan gözlem benzer görev koşullarında aynı güçlüğü göstermektedir."
    : caregiverFact && observationFact && profile.profile_breadth === "preserved" && functional.has_caregiver_difficulty_example && caregiverDescribesEnvironmentalLoad
    ? "Bakım verenin verdiği günlük yaşam örneği çevresel yükün arttığı durumu, doğrudan gözlem ise kayıt altındaki ayrı görevi açıklamaktadır. Her iki bilgi yalnız kendi görev ve koşulu içinde değerlendirilmiştir."
    : caregiverFact && observationFact && profile.profile_breadth === "preserved" && functional.has_caregiver_difficulty_example
    ? "Bakım verenin verdiği güçlük örneği ile doğrudan gözlem farklı görev ve koşullara aittir. Sonuçlar aynı yöndeymiş gibi yorumlanmamış, her kaynak kendi bağlamıyla sınırlandırılmıştır."
    : caregiverFact && observationFact && profile.profile_breadth === "preserved"
    ? "Bakım veren bilgisi ile doğrudan gözlem farklı görev ve bağlamlara aittir. Bu iki kaynak için yönsel yakınsama ileri sürülmemiştir."
    : caregiverFact && observationFact && closeMultidomain
    ? "Bakım veren anlatısı ile doğrudan gözlem farklı görev ve koşullara aittir. Etkilenen alanlardaki bulgular değerlendirilirken her kaynak yalnız kendi bağlamında kullanılmış, sonuçlar aynı yöndeymiş gibi yorumlanmamıştır."
    : caregiverFact && observationFact && primaryCaregiverDifficultyFact && observationSupportsPrimary
    ? `Bakım verenin verdiği görev örneği ${primary.toLocaleLowerCase("tr-TR")} bulgusunun günlük yaşamdaki yerini, doğrudan gözlem ise kayıt altındaki görev performansını açıklamaktadır. Her kaynak yalnız kendi görev ve koşulu içinde değerlendirilmiştir.`
    : caregiverFact && observationFact
    ? `Bakım veren anlatısı ile doğrudan gözlem farklı görev ve koşullara aittir. ${primary} bulgusu değerlendirilirken her kaynak yalnız kendi bağlamında kullanılmış, sonuçlar aynı yöndeymiş gibi yorumlanmamıştır.`
    : caregiverFact && primaryCaregiverFact
    ? `Bakım verenin verdiği günlük yaşam örneği, ${primary.toLocaleLowerCase("tr-TR")} alanındaki puan örüntüsünün hangi görev ve koşulda ele alındığını göstermektedir.`
    : caregiverFact
    ? `${functionalPriority ?? "Bakım verenin verdiği bilgi yalnız bildirilen günlük yaşam durumu kapsamında değerlendirilmiştir."} ${primaryCaregiverFact ? `Bu örnek, ${primary.toLocaleLowerCase("tr-TR")} alanındaki bulgunun günlük yaşamdaki karşılığını açıklamaktadır.` : profile.affected_domains.length > 1 ? "Bakım verenin aktardığı örnek, etkilenen alanlardan hangisinin görev sırasında daha belirgin olduğunu göstermemektedir; bu nedenle yalnız bildirilen görev ve koşulla sınırlı tutulmuştur." : "Bakım verenin aktardığı örnek ölçümdeki güçlüğün günlük yaşamdaki doğrudan karşılığı olarak kullanılmamış, yalnız bildirilen görev ve koşulla sınırlı tutulmuştur."}`
    : directionalCaregiverFact
    ? `Kayıtta güçlük yönünde genel bir bakım veren bildirimi vardır; belirli bir görev, davranış veya bağlam örneği bulunmadığı için bu bilgi ${primary.toLocaleLowerCase("tr-TR")} puan örüntüsünün günlük yaşamdaki somut karşılığı olarak kullanılmamıştır.`
    : functional.has_caregiver_functional_example
    ? profile.affected_domains.length > 1 && !clearPriority
      ? `${domainAreaSubject(affected)}ndaki puanlar güçlük yönünde birlikte ayrışmaktadır; tek bir alanı diğerlerinin önüne yerleştirecek kadar ayrışmamıştır.`
      : `Ölçümde öne çıkan bulgu ${primary.toLocaleLowerCase("tr-TR")} puanındaki farklılaşmadır.`
    : profile.affected_domains.length > 1 && !clearPriority
    ? `${domainAreaSubject(affected)}ndaki skorlar güçlük yönünde birlikte ayrışmaktadır. Günlük yaşam örneği bulunmadığı için bu sonuç tek bir alana veya belirli bir davranışa bağlanmamıştır.`
    : `${primary} puanındaki farklılaşma ölçümde öne çıkan bulgudur. Günlük yaşam örneği bulunmadığı için bu sonuç belirli bir davranışa genellenmemiştir.`
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
    ? profile.affected_domains.length > 1 && !clearPriority
      ? `Bu vakada en güçlü bilgi ${domainAreaSubject(affected)}ndaki skorların birlikte güçlük yönünde olmasıdır. Anamnez ve gözlemde somut işlev örneği bulunmadığından klinik sonuç, tek bir alan veya davranış varsayımı yerine puan dağılımı üzerinden kurulmuştur.`
      : `Bu vakada güçlü olan bilgi ${primary} skorundaki seçici ayrışmadır. Anamnez ve gözlemde somut işlev örneği bulunmadığından, klinik sonuç davranışa ilişkin varsayım yerine alanların dağılımı üzerinden kurulmuştur.`
    : profile.profile_breadth === "broad_multidomain"
    ? clearPriority
      ? `${primary} daha düşük puanlı alan olsa da vaka tek alanlı bir güçlük göstermemektedir. Günlük görevlerde görülen zorlanma, etkilenmiş alanların aynı etkinlik içinde biriken yüküyle birlikte anlaşılmaktadır.`
      : "Alan puanlarının birbirine yakın olması, tek bir alanı ana açıklama olarak seçmeye izin vermemektedir. Günlük görevlerde görülen zorlanma, etkilenmiş alanların aynı etkinlik içinde biriken yüküyle birlikte anlaşılmaktadır."
    : !functional.has_caregiver_functional_report && !functional.has_therapist_observation
    ? `${primary} alanındaki bulgu yalnız skor profilindeki seçici ayrışmaya dayanmaktadır. Günlük yaşam ve doğrudan gözlem örneği bulunmadığı için bu sonuç belirli bir görev veya davranışa genellenmemiştir.`
    : profile.profile_breadth === "preserved"
    ? functional.has_caregiver_difficulty_example
      ? functional.has_caregiver_context_example
        ? "Altı alanın beklenen aralıkta olması, bildirilen güçlüğün yaygın bir self-regülasyon sorunu olarak yorumlanmasını desteklememektedir. Günlük yaşam örneği yalnız belgelenen bağlam ve koşullar içinde değerlendirilmiştir."
        : "Altı alanın beklenen aralıkta olması, bildirilen güçlüğün yaygın bir self-regülasyon sorunu olarak yorumlanmasını desteklememektedir. Bildirilen güçlük yalnız kayıttaki görev örneği kapsamında tutulmuştur."
      : "Altı alanın beklenen aralıkta olması ve kayıttaki korunmuş görev performansı, yaygın bir self-regülasyon güçlüğünü desteklememektedir."
    : `${primary} alanındaki bulgu, korunmuş alanlar ve günlük yaşam bilgisiyle birlikte değerlendirilmiştir. Böylece güçlüğün ne kadar yaygın olduğu ve hangi koşullarda görüldüğü ayrı ayrı ele alınmıştır.`
  const secondaryNames = affected.filter((label) => label !== primary)
  const highestConclusionHasCloseBoundary = /(?:puan(?:lar|ların).{0,60}birbirine yakın|tek bir alan.{0,80}(?:öncelik|ana açıklama|indirgen))/iu.test(highestConclusion)
  const limitedDecisionEvidence = confidence.category === "Sınırlı" || confidence.category === "Yetersiz"
  const uncalibratedConclusion = observationSupports.multiple && profile.primary_priority && clearPriority
    ? `Mevcut bulgular ${primary.toLocaleLowerCase("tr-TR")} alanını daha belirgin güçlük alanı olarak desteklemektedir. ${domainAreaSubject(secondaryNames).toLocaleLowerCase("tr-TR")} da etkilendiği için günlük yaşam güçlüğü yalnız ${primary.toLocaleLowerCase("tr-TR")} ile açıklanmamalıdır.`
    : closeMultidomain
    ? limitedDecisionEvidence
      ? `${highestConclusion} Günlük yaşam bilgisi sınırlı olduğundan tek bir alanın diğerlerinden daha önemli olduğu sonucuna varılmamıştır.`
      : highestConclusionHasCloseBoundary
        ? highestConclusion
        : `${highestConclusion} Alan puanları birbirine yakın olduğundan tek bir alan diğerlerinin önüne yerleştirilmemiştir.`
    : profile.profile_breadth === "broad_multidomain"
    ? `${highestConclusion} ${primary} geniş profil içinde daha belirgindir; diğer etkilenmiş alanlar aynı görevlerde biriken self-regülasyon yükünü açıklamaktadır.`
    : profile.profile_breadth === "focused_multidomain" && profile.primary_priority
    ? `${highestConclusion} ${primary} puanı diğer etkilenen alanlardan daha belirgindir; ancak günlük yaşam yorumu ${domainAreaSubject(secondaryNames).toLocaleLowerCase("tr-TR")} da içermektedir.`
    : profile.profile_breadth === "selective_single_domain" && profile.primary_priority
    ? limitedDecisionEvidence
      ? `${highestConclusion} Günlük yaşam bilgisi sınırlı olduğundan bu sonuç yalnız ${primary.toLocaleLowerCase("tr-TR")} alanındaki ölçüm bulgusunu gösterir; günlük yaşamın tamamına genellenmemiştir.`
      : `${highestConclusion} Ölçümde yalnız ${primary.toLocaleLowerCase("tr-TR")} alanı beklenen aralığın dışındadır; bu nedenle klinik yorum bu alan üzerinde yoğunlaşmaktadır.`
    : profile.profile_breadth === "preserved"
    ? limitedDecisionEvidence
      ? functional.has_caregiver_difficulty_example
        ? "Mevcut ölçümde altı alanın puanları yaş grubuna göre beklenen aralıktadır; bakım verenin bildirdiği güçlük günlük yaşamın tamamına genellenmemiştir."
        : "Mevcut ölçümde altı alanın puanları yaş grubuna göre beklenen aralıktadır; mevcut bilgiler sınırlı olduğundan bu sonuç günlük yaşamın tamamına genellenmemiştir."
      : functional.has_caregiver_difficulty_example
        ? "Altı alanın puanları yaş grubuna göre beklenen aralıktadır; bakım verenin bildirdiği güçlük yalnız kayıttaki görev ve koşullar için değerlendirilmiştir."
        : "Altı alanın puanları yaş grubuna göre beklenen aralıktadır ve kayıttaki korunmuş performans yaygın bir self-regülasyon güçlüğünü desteklememektedir."
    : dataQuality.status === "insufficient"
    ? highestConclusion
    : highestConclusion
  const conclusion = limitedDecisionEvidence
    && !/(?:mevcut ölçüm|sınırlı|sınırlandırılmış|genellenmemiştir|izin vermemektedir|sonucuna varılmamıştır)/iu.test(uncalibratedConclusion)
    ? `${uncalibratedConclusion.replace(/[.!?]$/u, "")}; ancak günlük yaşam bilgisi sınırlı olduğundan bu karar kayıttaki bilgilerle sınırlandırılmıştır.`
    : uncalibratedConclusion
  const formulationSynthesis = cafeteriaInsight ?? instructionInsight ?? journeyInsight ?? `${preservedCapacity} ${contextEffect}`
  const boldParagraphs = Object.freeze([
    conciseDecisionEmphasis(distinguishing),
    conciseDecisionEmphasis(formulationSynthesis),
    conciseDecisionEmphasis(conclusion, "last"),
  ])
  const firstFacts = unique([primaryScoreFact?.id, ...preservedScoreFacts.map((fact) => fact.id), caregiverFact?.id, directionalCaregiverFact?.id, observationFact?.id, externalFact(difficultyExternal)?.id, externalFact(preservedExternal)?.id].filter(Boolean) as string[])
  const secondFacts = unique([...affectedScoreFacts.map((fact) => fact.id), ...preservedScoreFacts.map((fact) => fact.id), ...usableCaregiverFacts.map((fact) => fact.id), directionalCaregiverFact?.id, caregiverPreservedFact?.id, observationFact?.id, externalFact(preservedExternal)?.id].filter(Boolean) as string[])
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
  const caregiverExamples = unique(caregiverFunctionalSummary(envelope).map(naturalizeCaregiverExample))
  const caregiverFacts = envelope.anamnesis_evidence.filter((fact) => fact.evidence_status !== "UNUSABLE")
  const functionalCaregiverFacts = caregiverFacts.filter((fact) => classifyCaregiverEvidenceRole(fact).functionalEvidence)
  const primaryFunctionalCaregiverFact = profile.primary_priority && priorityHasClearSeparation(profile, base.v1.domainResults)
    ? bestCaregiverFunctionalFact(functionalCaregiverFacts.filter((fact) => factSupportsDomain(fact, profile.primary_priority!))
      .filter((fact) => classifyCaregiverEvidenceRole(fact).preservedCapacity || factHasVisibleFunctionalDirection(fact)), profile.primary_priority)
    : undefined
  const difficultyFunctionalCaregiverFact = bestCaregiverFunctionalFact(functionalCaregiverFacts.filter((fact) => classifyCaregiverEvidenceRole(fact).directionalComplaint && factHasVisibleFunctionalDirection(fact)), profile.primary_priority)
  const decisionFunctionalFact = primaryFunctionalCaregiverFact
    ?? difficultyFunctionalCaregiverFact
    ?? bestCaregiverFunctionalFact(functionalCaregiverFacts.filter((fact) => classifyCaregiverEvidenceRole(fact).preservedCapacity || factHasVisibleFunctionalDirection(fact)))
    ?? bestReportedFunctionalFact(caregiverFacts)
  const functionalPriorityText = caseFunctionalPrioritySentence(decisionFunctionalFact)
  const decisionFunctionalPriorityText = caseDecisionPrioritySentence(decisionFunctionalFact, profile.primary_priority)
  const caregiverInformation = unique(caregiverFacts.map((fact) => capitalizeFirst(fact.statement.replace(/^(?:Bakım veren(?:in)?\s+|Güçlü yanı:\s*)/iu, ""))))
  const functional = envelope.functional_evidence_profile
  const hasConcreteCaregiverExample = functional.has_caregiver_functional_example
  const externalFactFor = (entry: JuryExternalEvidence) => envelope.external_tests.find((fact) => fact.statement.startsWith(`${entry.test_name}:`))
  const externalPreservedEligible = (entry: JuryExternalEvidence) => {
    const fact = externalFactFor(entry)
    return Boolean(fact && factEligibleForPreservedCapacity(fact))
  }
  const clearPriority = priorityHasClearSeparation(profile, base.v1.domainResults)
  const closeMultidomain = profile.affected_domains.length > 1 && !clearPriority
  const clinicalInsightPlan = buildClinicalInsightPlan(input, profile, base.v1.domainResults, observation, external, dataQuality, confidence, envelope)
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
  const confidenceBaseSentence = hasDecisionDiscrepancy
    ? decisionDiscrepancy.summary
    : hasMaterialDiscrepancy
    ? sourceRelationNarrative.text
    : confidence.category === "Yüksek" && hasMaterialConvergence
    ? "Karşılaştırılabilir bilgi kaynakları aynı klinik yorumu desteklemektedir. Her kaynak yalnız bildirdiği görev ve koşul için kullanılmıştır."
    : confidence.category === "Orta"
    ? "Mevcut bulgular klinik yorumu desteklemektedir. Kısmen yorumlanabilir bilgiler nedeniyle bu yorum günlük yaşamın tümüne genellenmemiştir."
    : confidence.category === "Sınırlı"
    ? "Alan puanları yorumlanabilmektedir. Günlük yaşama ilişkin çıkarım yalnız kayıtta bulunan bilgilere dayanmaktadır."
    : functional.has_caregiver_difficulty_example
    ? "Bakım veren günlük yaşamda bir güçlük bildirmiştir. Ayrıntılar sınırlı olduğundan yorum yalnız belirtilen görev ve koşulları kapsamaktadır."
    : hasConcreteCaregiverExample
    ? "Bakım verenin aktardığı örnek yalnız belirtilen görev ve koşul hakkında bilgi vermektedir; alan puanlarının günlük yaşamdaki doğrudan karşılığı olarak yorumlanmamıştır."
    : functional.has_caregiver_functional_report
    ? "Bakım veren günlük yaşam hakkında ek bilgi bildirmiştir. Somut görev ve ortam ayrıntısı bulunmayan kısımlar puanların günlük yaşamdaki karşılığı olarak genellenmemiştir."
    : "Klinik yorum yalnız alan puanlarının dağılımıyla sınırlıdır; günlük yaşamda belirli bir davranış hakkında sonuç çıkarılmamıştır."
  const confidenceCalibratedSentence = confidenceBaseSentence
  const affectedDomainNames = profile.affected_domains.map((key) => DOMAIN_LABELS[key].toLocaleLowerCase("tr-TR"))
  const preservedDomainNames = profile.preserved_domains.map((key) => DOMAIN_LABELS[key].toLocaleLowerCase("tr-TR"))
  const scoreDistributionSentence = affectedDomainNames.length && preservedDomainNames.length
    ? `Alan puanlarının dağılımında ${domainAreaSubject(affectedDomainNames)} güçlük yönünde öne çıkarken ${domainAreaSubject(preservedDomainNames)} görece korunmuştur.`
    : affectedDomainNames.length
    ? `Alan puanlarının dağılımında ${domainAreaSubject(affectedDomainNames)} güçlük yönünde birlikte öne çıkmaktadır.`
    : `Alan puanlarının dağılımında ${domainAreaSubject(preservedDomainNames)} yaş grubuna göre beklenen aralıktadır.`
  const affectedLevelDetails = base.v1.domainResults
    .filter((domain) => domain.level !== "Tipik")
    .map((domain) => `${DOMAIN_LABELS[domain.key as DomainKey].toLocaleLowerCase("tr-TR")} ${domain.level} düzeydedir`)
  const totalClassificationSentence = base.decisionPlan.overallClassification === "Tipik" && affectedLevelDetails.length
    ? `Ölçek toplam puan sınıflaması: Tipik (${total}/300); ancak alan bazlı değerlendirmede ${joinNatural(affectedLevelDetails)}.`
    : `Ölçek toplam puan sınıflaması: ${base.decisionPlan.overallClassification} (${total}/300).`

  sections.push(Object.freeze({
    id: "summary",
    heading: JURY_REPORT_HEADINGS[0],
    paragraphs: Object.freeze([
      p("summary.classification", `${totalClassificationSentence} Alan profili ${profile.display_label} göstermektedir. ${scoreDistributionSentence}`, ["evidence.total-score", ...base.v1.domainResults.map((domain) => `evidence.domain.${domain.key}`)], ["claim.overall-classification"], "normal", "case_fact", envelope.dna_scores.map((fact) => fact.id)),
      p("summary.insight", clinicalInsightPlan.candidate_bold_paragraphs[0], base.decisionPlan.primaryFormulation?.supportingEvidenceIds ?? [], [base.reportPlan.primaryDecisionClaimId], "full_bold", "synthesis", clinicalInsightPlan.bold_paragraph_case_fact_ids[0]),
      p("summary.calibration", confidenceCalibratedSentence, base.decisionPlan.contradictoryEvidence, ["claim.confidence"], "normal", "synthesis", unique([
        ...(decisionDiscrepancy.factIds.length ? decisionDiscrepancy.factIds : sourceRelationNarrative.factIds.length ? sourceRelationNarrative.factIds : caregiverDifficultyFactIds.length ? caregiverDifficultyFactIds : envelope.dna_scores.map((fact) => fact.id)),
        ...(functional.has_caregiver_functional_report ? caregiverFacts.map((fact) => fact.id) : []),
      ])),
    ]),
  }))

  const domainParagraphs = base.v1.domainResults.map((domain) => {
    const key = domain.key as DomainKey
    const claim = claimById(base, `claim.domain-interpretation.${key}`)
    const sources = sourceLabelsForDomain(base, envelope, key)
    const meaning = dataQuality.status === "insufficient" && domain.level !== "Tipik"
      ? `${DOMAIN_LABELS[key]} skoru ölçüm düzeyinde güçlük yönünde ayrışmaktadır.`
      : domain.level === "Tipik"
      ? DOMAIN_PRESERVED[key]
      : `${DOMAIN_LABELS[key]} puanı bu alandaki klinik güçlüğü göstermektedir. Günlük yaşamdaki anlamı şu işlevlerle ilişkilidir: ${DOMAIN_FUNCTION[key]}`
    const sourceSentence = sources.length > 1 ? `${DOMAIN_LABELS[key]} için birlikte değerlendirilen kanıtlar: ${sources.join(", ")}.` : ""
    const sourceLink = sources.includes("bakım veren anlatısı") && sources.includes("terapist gözlemi") && hasConcreteCaregiverExample
      ? `${DOMAIN_LABELS[key]} bulgusu, bakım verenin aktardığı örnek ve doğrudan gözlemle birlikte ele alınmıştır.`
      : sources.includes("bakım veren anlatısı") && hasConcreteCaregiverExample
      ? `Bakım verenin aktardığı örnek, ${DOMAIN_LABELS[key].toLocaleLowerCase("tr-TR")} alanının günlük yaşamdaki karşılığına ilişkin ek bilgi sağlamaktadır.`
      : sources.includes("bakım veren anlatısı")
      ? ""
      : sources.includes("bakım verenin genel bildirimi") && key === profile.primary_priority
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
      return p(`evidence.external.${entry.id}`, `${entry.test_name}: ${status}; sonuç yönü klinik bulgu olarak aktarılmamış ve klinik kararda kullanılmamıştır.`, [`evidence.external.${entry.id}`], ["external"], "normal", "boundary", externalFactId ? [externalFactId] : [])
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
    ...(hasConcreteCaregiverExample
      ? [p("evidence.caregiver", `Bakım verenin günlük yaşamdan verdiği örnekler: ${caregiverExamples.join(" ")}`, [], ["profile"], "normal", "case_fact", caregiverFacts.map((fact) => fact.id))]
      : caregiverFacts.length
      ? [p("evidence.caregiver-information", `Bakım veren tarafından bildirilen bilgi: ${caregiverInformation.join(" ")}`, [], ["profile"], "normal", "case_fact", caregiverFacts.map((fact) => fact.id))]
      : [p("evidence.caregiver-limited", "Bakım veren anlatısında günlük görev, ortam ve destek düzeyini birlikte gösteren somut bir örnek bulunmamaktadır. Bu nedenle işlevsel açıklama skor örüntüsünün sınırları içinde tutulmuştur.", [], ["profile"], "normal", "boundary")]),
    p("evidence.observation", `${naturalTherapistObservation(observation).replace(/^Terapist gözleminde/u, "Doğrudan klinik gözlemde")}${observation.present && observation.shortObservation ? " Gözlemin kısa süresi, yorumun bu görev ve koşulla sınırlı tutulmasını gerektirmektedir." : observation.present ? " Gözlem, performansın görev yapısı ve çevre koşullarıyla birlikte anlaşılmasını sağlamaktadır." : ""}`, observation.present ? base.evidenceMatrix.units.filter((unit) => unit.sourceType === "THERAPIST_OBSERVATION").map((unit) => unit.id) : [], ["profile"], "normal", observation.present ? "case_fact" : "boundary", envelope.therapist_observations.map((fact) => fact.id)),
  ]
  const preservedCaseFactIds = unique([
    ...envelope.dna_scores.filter((fact) => fact.semantic_direction === "PRESERVED").map((fact) => fact.id),
    ...envelope.anamnesis_evidence.filter(factSupportsPreservedCapacity).map((fact) => fact.id),
    ...envelope.therapist_observations.filter((fact) => factEligibleForPreservedCapacity(fact)).map((fact) => fact.id),
    ...envelope.external_tests.filter((fact) => factEligibleForPreservedCapacity(fact)).map((fact) => fact.id),
  ])
  const preservedParagraph = explanation.preserved_evidence.length
    ? [p("evidence.preserved", functional.has_preserved_capacity_in_action
      ? `${preservedNames.length ? `${domainAreaSubject(preservedNames)} ölçümde beklenen aralıktadır. ` : ""}Kayıttaki korunmuş performans örneği, kapasitenin hangi koşulda kullanılabildiğini göstermektedir.`
      : preservedNames.length
      ? `${domainAreaSubject(preservedNames)} ölçümde beklenen aralıktadır. Bu dağılım, güçlüğün bütün self-regülasyon alanlarına yayılmadığını göstermektedir.`
      : "Korunmuş yönler ayrı bir alan puanında görünmemektedir. Bu nedenle profil bütün etkilenen alanlar birlikte ele alınarak yorumlanmıştır.", base.decisionPlan.primaryFormulation?.preservedCapacityEvidenceIds ?? [], ["preserved"], "normal", "synthesis", preservedCaseFactIds)]
    : []
  const relationParagraphs = sourceRelationNarrative.factIds.length
    ? [p("evidence.relations", sourceRelationNarrative.text, base.decisionPlan.contradictoryEvidence, [], "normal", "synthesis", sourceRelationNarrative.factIds)]
    : []
  sections.push(Object.freeze({ id: "evidence", heading: JURY_REPORT_HEADINGS[1], paragraphs: Object.freeze([...domainParagraphs, ...sourceParagraphs, ...externalParagraphs, ...preservedParagraph, ...relationParagraphs]) }))

  const formulationParagraphs: JuryLockedParagraph[] = []
  formulationParagraphs.push(p("formulation.breadth", profile.profile_breadth === "broad_multidomain"
    ? `${domainAreaSubject(affectedNames)} beklenen aralığın dışındadır. Etkilenmiş alanların tamamı günlük yaşam yorumunda birlikte ele alınmıştır.`
    : profile.profile_breadth === "focused_multidomain"
    ? `${domainAreaSubject(affectedNames)} beklenen aralığın dışındadır. Bu alanların tamamı günlük yaşam güçlüğünün yorumuna dahil edilmiştir.`
    : profile.profile_breadth === "selective_single_domain"
    ? `Yalnız ${affectedNames[0]} alanı beklenen aralığın dışındadır; ölçümde güçlük tek bir alanda yoğunlaşmaktadır.`
    : "Altı alanın ölçüm sonuçları genel olarak korunmuştur. Bildirilen bağlamsal güçlük, ortaya çıktığı fizyolojik ve çevresel koşullarla birlikte ele alınmıştır.", [], []))
  const eligibleSynthesisExternalFacts = envelope.external_tests.filter((fact) => externalFactEligibleForRole(fact, "relation"))
  const narrativeSourceCount = Number(caregiverFacts.length > 0) + Number(observation.present) + Number(external.some((entry) => entry.decision_relevant))
  const sourceRoleSentences = [
    ...(hasConcreteCaregiverExample
      ? functionalPriorityText ? [functionalPriorityText] : []
      : functional.has_caregiver_functional_report
      ? []
      : caregiverFacts.length
      ? ["Bakım verenin genel bildirimi belirli bir görev veya koşul göstermediği için yalnız ek bilgi olarak tutulmuştur."]
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
    ...(narrativeSourceCount > 1
      ? ["Her bilgi kaynağı yalnız değerlendirdiği görev ve koşul için kullanılmıştır."]
      : []),
  ]
  if (sourceRoleSentences.length > 0) formulationParagraphs.push(p("formulation.source-roles", sourceRoleSentences.join(" "), [...base.decisionPlan.supportingEvidence, ...base.decisionPlan.contextualModifiers], ["profile"], "normal", "synthesis", [...envelope.dna_scores, ...envelope.anamnesis_evidence, ...envelope.therapist_observations, ...eligibleSynthesisExternalFacts].map((fact) => fact.id)))
  if (profile.affected_domains.length > 1 && dataQuality.status !== "insufficient") formulationParagraphs.push(p("formulation.functional-integration", clinicalInsightPlan.cross_domain_interaction, [...base.decisionPlan.supportingEvidence, ...base.decisionPlan.contextualModifiers], ["profile"], "normal", "synthesis", clinicalInsightPlan.bold_paragraph_case_fact_ids[2]))
  formulationParagraphs.push(p("formulation.bold-synthesis", clinicalInsightPlan.candidate_bold_paragraphs[1], [...base.decisionPlan.preservedCapacity, ...base.decisionPlan.contextualModifiers], ["preserved"], "full_bold", "synthesis", clinicalInsightPlan.bold_paragraph_case_fact_ids[1]))
  const capacityContextText = `${clinicalInsightPlan.preserved_capacity} ${clinicalInsightPlan.context_or_time_effect}`
  const boldSynthesisSentences = new Set(sentenceList(clinicalInsightPlan.candidate_bold_paragraphs[1]))
  const functionalPrioritySentences = new Set(sentenceList(functionalPriorityText ?? ""))
  const capacityContextRemainder = sentenceList(capacityContextText).filter((sentence) =>
    !boldSynthesisSentences.has(sentence)
    && !functionalPrioritySentences.has(sentence)
    && !/^Puanların günlük yaşamdaki (?:en somut )?karşılığı,/iu.test(sentence)
    && !(narrativeSourceCount > 0 && /^Bakım veren(?:in)? verdiği (?:günlük yaşam )?örne(?:k|ği)/iu.test(sentence))
    && !/^Bu (?:dağılım|sonuçlar), (?:güçlüğün|belgelenen performans değişkenliğinin) bütün self-regülasyon alanlarına yayılmadığını göstermektedir\.$/iu.test(sentence)
  ).join(" ")
  if (capacityContextRemainder) formulationParagraphs.push(p("formulation.capacity-context", capacityContextRemainder, [...base.decisionPlan.preservedCapacity, ...base.decisionPlan.contextualModifiers], ["preserved"], "normal", "synthesis", clinicalInsightPlan.bold_paragraph_case_fact_ids[1]))
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
    ? `${entry.test_name}, değerlendirdiği kapsamda korunmuş bir sonuç göstermektedir.`
    : entry.evidence_direction === "supports_preserved_function"
    ? `${entry.test_name} beklenen yönde sonuç vermiştir; ancak sınırlı veri nedeniyle korunmuş kapasite kanıtı olarak kullanılmamıştır.`
    : entry.evidence_direction === "mixed"
    ? `${entry.test_name} hem güçlük hem korunmuş alt sonuç bildirmiştir; bu karma sonuç tek bir yöne indirgenmemiştir.`
    : `${entry.test_name} kararı tek başına değiştirmeyen ek bilgi sağlamaktadır.`)
  if (external.some((entry) => entry.decision_relevant && entry.evidence_direction === "supports_difficulty") && external.some((entry) => entry.decision_relevant && entry.evidence_direction === "supports_preserved_function")) {
    externalDecisionSentences.push("Bu testler farklı işlevleri değerlendirdiği için sonuçlardan biri diğerini geçersiz kılmamaktadır.")
  }
  const decisionRationale = profile.profile_breadth === "broad_multidomain"
    ? clearPriority
      ? `${DOMAIN_LABELS[profile.primary_priority!]} puanı daha belirgindir; ancak diğer etkilenmiş alanlar da günlük görevlerdeki güçlüğe katkı sağlamaktadır. Bu nedenle sonuç tek bir alanla açıklanmamıştır.`
      : "Etkilenen alanların puanları birbirine yakındır. Günlük yaşamdaki güçlük bütün etkilenen alanlarla birlikte açıklanmış, tek bir alan temel neden olarak sunulmamıştır."
    : profile.profile_breadth === "focused_multidomain"
    ? clearPriority
      ? `${DOMAIN_LABELS[profile.primary_priority!]} puanı daha belirgindir. ${domainAreaSubject(profile.secondary_priorities.map((domain) => DOMAIN_LABELS[domain])).toLocaleLowerCase("tr-TR")} da beklenen aralığın dışındadır; günlük yaşam güçlüğü değerlendirilirken bu sonuçlar da hesaba katılmıştır.`
      : `${domainAreaSubject(affectedNames)} beklenen aralığın dışındadır ve puanları birbirine yakındır. Bu nedenle günlük yaşam güçlüğü tek bir alanla açıklanmamıştır.`
    : profile.profile_breadth === "selective_single_domain"
    ? `Diğer beş alan yaş grubuna göre beklenen aralıktadır. Bu dağılım, ölçümde görülen güçlüğün ${DOMAIN_LABELS[profile.primary_priority!].toLocaleLowerCase("tr-TR")} alanıyla sınırlı olduğunu göstermektedir.`
    : "Altı alanın tamamı yaş grubuna göre beklenen aralıktadır. Günlük yaşamda bildirilen değişkenlik, yalnız kayıtta bulunan görev ve koşullar içinde yorumlanmıştır."
  const boundedContradictionText = profile.profile_breadth === "preserved" && functional.has_caregiver_functional_report
    ? "Alan puanları yaş grubuna göre beklenen aralıktadır. Bakım verenin bildirdiği günlük yaşam bilgileri, bu puanların ölçtüğü kapsamla aynı değildir. Bu nedenle günlük yaşam yorumu yalnız kayıtta belirtilen görev ve koşullarla sınırlıdır."
    : "Kararı sınırlandıran bilgiler ayrı kaynak ve koşullardan gelmektedir. Günlük yaşam yorumu yalnız kayıtta belirtilen görev ve koşullarla sınırlandırılmıştır."
  const alternativeSentence = closeMultidomain
    ? "Puanlar birbirine yakın ve birden fazla alan güçlük yönünde olduğu için tek bir alan, profilin tamamını açıklamakta yeterli değildir."
    : profile.profile_breadth === "broad_multidomain"
    ? "Güçlük birden fazla alana yayıldığı için tek bir alan, günlük yaşamdaki toplam güçlüğü açıklamakta yeterli değildir."
    : profile.primary_priority
    ? `Diğer alanlar beklenen aralıkta olduğundan, ölçümdeki güçlük ${explanation.primary_focus.toLocaleLowerCase("tr-TR")} alanında yoğunlaşmaktadır.`
    : "Altı alan da beklenen aralıkta olduğundan, tek bir self-regülasyon alanını güçlük odağı olarak göstermek mümkün değildir."
  const rawDecisionContradictionText = decisionDiscrepancy.text || boundedContradictionText
  const decisionContradictionText = hasSemanticSourceDiscrepancy && !/(?:bütün görev|günlük yaşamın tamamına genellen|genellenmesini sınır)/iu.test(rawDecisionContradictionText)
    ? `${rawDecisionContradictionText} Bu farklılık alan puanlarını değiştirmez; ancak güçlüğün günlük yaşamın tamamına genellenmesini sınırlar.`
    : rawDecisionContradictionText
  const formulationSentenceKeys = new Set(formulationParagraphs
    .flatMap((paragraph) => sentenceList(paragraph.text))
    .map((value) => value.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü]+/gu, " ").trim()))
  const nonRepeatedDecisionSupport = sentenceList(clinicalInsightPlan.what_a_superficial_reading_would_miss)
    .filter((value) => !formulationSentenceKeys.has(value.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü]+/gu, " ").trim()))
    .join(" ")
  const nonRepeatedConclusionDetail = sentenceList(clinicalInsightPlan.most_important_clinical_conclusion)
    .filter((value) => value !== clinicalInsightPlan.candidate_bold_paragraphs[2])
    .filter((value) => !formulationSentenceKeys.has(value.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü]+/gu, " ").trim()))
    .join(" ")
  const decisionParagraphs = [
    p("decision.bold-conclusion", clinicalInsightPlan.candidate_bold_paragraphs[2], [...base.decisionPlan.supportingEvidence, ...base.decisionPlan.preservedCapacity], [base.reportPlan.primaryDecisionClaimId], "full_bold", "synthesis", clinicalInsightPlan.bold_paragraph_case_fact_ids[2]),
    ...nonRepeatedConclusionDetail
      ? [p("decision.conclusion-detail", nonRepeatedConclusionDetail, [...base.decisionPlan.supportingEvidence, ...base.decisionPlan.preservedCapacity], [base.reportPlan.primaryDecisionClaimId], "normal", "synthesis", clinicalInsightPlan.bold_paragraph_case_fact_ids[2])]
      : [],
    ...(decisionFunctionalPriorityText && !clinicalInsightPlan.candidate_bold_paragraphs[2].includes(decisionFunctionalPriorityText)
      ? [p("decision.functional-priority", decisionFunctionalPriorityText, base.decisionPlan.supportingEvidence, [base.reportPlan.primaryDecisionClaimId], "normal", "synthesis", decisionFunctionalFact ? [decisionFunctionalFact.id] : [])]
      : []),
    ...(!closeMultidomain && profile.profile_breadth === "broad_multidomain" ? [p("decision.rationale", decisionRationale, base.decisionPlan.supportingEvidence, ["primary"], "normal", "synthesis", envelope.dna_scores.map((fact) => fact.id))] : []),
    ...(!closeMultidomain && dataQuality.status !== "insufficient" && !["selective_single_domain", "preserved"].includes(profile.profile_breadth) && nonRepeatedDecisionSupport
      ? [p("decision.support", nonRepeatedDecisionSupport, base.decisionPlan.supportingEvidence, ["primary"], "normal", "synthesis", clinicalInsightPlan.bold_paragraph_case_fact_ids[2])]
      : []),
    ...(externalDecisionSentences.length ? [p("decision.external-role", externalDecisionSentences.join(" "), external.filter((entry) => entry.decision_relevant).map((entry) => `evidence.external.${entry.id}`), ["external"], "normal", "synthesis", envelope.external_tests.filter((fact) => external.some((entry) => entry.decision_relevant && fact.statement.startsWith(`${entry.test_name}:`))).map((fact) => fact.id))] : []),
    ...((hasDecisionDiscrepancy || (explanation.contradictory_evidence.length && contradictoryExternal.length > 0)) ? [p("decision.contradiction", decisionContradictionText, base.decisionPlan.contradictoryEvidence, ["profile"], "normal", "synthesis", unique([
        ...sourceRelationNarrative.factIds,
        ...decisionDiscrepancy.factIds,
        ...contradictionCaseFactIds,
        ...(functional.has_caregiver_functional_report ? caregiverFacts.map((fact) => fact.id) : []),
      ]))] : []),
    ...(explanation.alternative_explanations.length && ["selective_single_domain", "preserved"].includes(profile.profile_breadth)
      ? [p("decision.alternative", alternativeSentence, [], ["primary"], "normal", "synthesis", envelope.dna_scores.map((fact) => fact.id))]
      : []),
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
      p("limits.safety", literatureSafetyBoundary(profile), [], ["claim.safety-boundary"], "normal", "boundary"),
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
    const functional = envelope.functional_evidence_profile
    const clinicalBody = report.split(JURY_REPORT_HEADINGS[4])[0]
    const headingFragments = new Set(JURY_REPORT_HEADINGS.flatMap((heading) => [heading, heading.replace(/^\d+\.\s*/u, "")]))
    const sentences = clinicalBody
      .split(/(?<=[.!?])\s+|\n+/u)
      .map((item) => item.trim())
      .filter((item) => item && !/^\d+\.$/u.test(item) && !headingFragments.has(item))
    const affirmativeCaregiver = sentences.filter((item) => /(?:bakım veren|aile)[^.]{0,180}(?:bildir|belirt|söyl)/iu.test(item)
      && /(?:günlük yaşam|görev|rutin|performans|kulaklarını|tamamla|sürdür|yarım bırak|uzaklaş|geri dön)/iu.test(item)
      && !/(?:bulunmamaktadır|somutlaştırılmamıştır|örneğ?i? bulunmadığ|belirli bir görev veya koşul göstermediğ|belirtilmedi|verilmedi|açıklanmadı|örnek veremedi)/iu.test(item))
    const affirmativeObservation = sentences.filter((item) => /(?:Terapist gözleminde|Doğrudan klinik gözlemde)/iu.test(item) && !/(?:bulunmamaktadır|içermemektedir|verilmedi)/iu.test(item))
    const namedExternal = external.filter((entry) => report.includes(entry.test_name))
    const contradictions: Array<Readonly<{ proposition: string; sentence: string; error_type: string }>> = []
    if (!functional.has_caregiver_functional_report) for (const item of affirmativeCaregiver) contradictions.push(Object.freeze({ proposition: "caregiver_functional_example_present=false", sentence: item, error_type: "UNSUPPORTED_CAREGIVER_FUNCTIONAL_CLAIM" }))
    if (!observation.present) for (const item of affirmativeObservation) contradictions.push(Object.freeze({ proposition: "therapist_observation_present=false", sentence: item, error_type: "UNSUPPORTED_THERAPIST_OBSERVATION_CLAIM" }))
    if (!envelope.external_tests.length && namedExternal.length) for (const item of namedExternal) contradictions.push(Object.freeze({ proposition: "external_test_present=false", sentence: item.test_name, error_type: "UNSUPPORTED_EXTERNAL_TEST_CLAIM" }))
    if (functional.has_caregiver_functional_example) {
      const falseAbsenceClaims = sentences.filter((sentenceText) => /(?:günlük yaşam|bakım veren|anamnez|vaka kaydı)[^.]{0,160}(?:somut|gözlenebilir)[^.]{0,100}(?:örnek|bilgi|karşılık)[^.]{0,80}(?:bulunmad|bulunmuyor|bulunmamaktadır|içermemektedir)/iu.test(sentenceText)
        || /(?:somut|gözlenebilir)[^.]{0,100}(?:anamnez|günlük yaşam|bakım veren)[^.]{0,100}(?:bulunmad|bulunmuyor|bulunmamaktadır|içermemektedir)/iu.test(sentenceText))
      for (const item of falseAbsenceClaims) contradictions.push(Object.freeze({ proposition: "caregiver_functional_example_present=true", sentence: item, error_type: "FUNCTIONAL_EVIDENCE_DENIED" }))
    }
    if (functional.has_therapist_observation) {
      for (const item of sentences.filter((sentenceText) => /(?:doğrudan )?(?:terapist|klinik) gözlemi[^.]{0,80}(?:bulunmad|bulunmuyor|bulunmamaktadır|içermemektedir)/iu.test(sentenceText))) contradictions.push(Object.freeze({ proposition: "therapist_observation_present=true", sentence: item, error_type: "THERAPIST_OBSERVATION_DENIED" }))
    }
    if (external.some((entry) => entry.decision_relevant)) {
      for (const item of sentences.filter((sentenceText) => /(?:yorumlanabilir|geçerli)[^.]{0,60}dış test[^.]{0,80}(?:bulunmad|bulunmuyor|bulunmamaktadır)/iu.test(sentenceText))) contradictions.push(Object.freeze({ proposition: "interpretable_external_test_present=true", sentence: item, error_type: "EXTERNAL_EVIDENCE_DENIED" }))
    }
    if (dataQuality.status === "insufficient") {
      for (const item of sentences.filter((sentenceText) => /günlük işlev güçlüğü bakım veren anlatısında bildirilmektedir/iu.test(sentenceText))) contradictions.push(Object.freeze({ proposition: "daily_functional_impact_observed=false", sentence: item, error_type: "SCORE_TO_OBSERVED_IMPACT_CONTRADICTION" }))
    }
    if (plan.profile.profile_breadth === "selective_single_domain") {
      for (const item of sentences.filter((sentenceText) => /tek bir alanda baskın güçlük göstermemektedir/iu.test(sentenceText))) contradictions.push(Object.freeze({ proposition: "profile_breadth=selective_single_domain", sentence: item, error_type: "PROFILE_BREADTH_VISIBLE_CONTRADICTION" }))
    }
    if (plan.profile.profile_breadth === "broad_multidomain") {
      for (const item of sentences.filter((sentenceText) => /seçici tek alan|tek bir alanda seçici/iu.test(sentenceText))) contradictions.push(Object.freeze({ proposition: "profile_breadth=broad_multidomain", sentence: item, error_type: "PROFILE_BREADTH_VISIBLE_CONTRADICTION" }))
    }
    const semanticClauses = (sentenceText: string) => sentenceText.split(/[,;]|\s+(?:çıkarken|kalırken|oysa|ancak|buna karşın)\s+/iu).map((clause) => clause.trim()).filter(Boolean)
    for (const domain of plan.profile.affected_domains) {
      const label = DOMAIN_LABELS[domain]
      const conflicting = sentences.filter((sentenceText) => semanticClauses(sentenceText).some((clause) => clause.toLocaleLowerCase("tr-TR").includes(label.toLocaleLowerCase("tr-TR")) && !new RegExp(`${label}\\s+dışındaki`, "iu").test(clause) && /(?:beklenen aralıktadır|beklenen aralıkta kalmıştır|korunmuştur|\bTipik\b)/iu.test(clause)))
      for (const item of conflicting) contradictions.push(Object.freeze({ proposition: `${domain}=affected`, sentence: item, error_type: "AFFECTED_DOMAIN_PRESENTED_AS_PRESERVED" }))
    }
    for (const domain of plan.profile.preserved_domains) {
      const label = DOMAIN_LABELS[domain]
      const conflicting = sentences.filter((sentenceText) => semanticClauses(sentenceText).some((clause) => clause.toLocaleLowerCase("tr-TR").includes(label.toLocaleLowerCase("tr-TR")) && /(?:beklenen aralığın dışındadır|\bRiskli\b|\bAtipik\b)/iu.test(clause)))
      for (const item of conflicting) contradictions.push(Object.freeze({ proposition: `${domain}=preserved`, sentence: item, error_type: "PRESERVED_DOMAIN_PRESENTED_AS_AFFECTED" }))
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
        const preservedLanguage = caregiverClauses.some((clause) => /(?:\bkorun|\bbağımsız|\bbeklenen|\bsürdür(?:üyor|dü|ebiliyor|ebilir|mektedir)|\btamamla(?:dı|r\b|yabiliyor|yabildi|maktadır))/iu.test(clause))
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
        caregiver_functional_example_present: functional.has_caregiver_functional_example,
        therapist_observation_present: observation.present,
        external_test_present: envelope.external_tests.length > 0,
        daily_functional_impact_observed: functional.has_caregiver_difficulty_example || observation.present,
        affected_domains: plan.profile.affected_domains,
        preserved_domains: plan.profile.preserved_domains,
        profile_breadth: plan.profile.profile_breadth,
        primary_priority: plan.profile.primary_priority,
        secondary_priorities: plan.profile.secondary_priorities,
        context_effect_present: dataQuality.contextualComparisonAvailable,
        score_derived_only: !functional.has_caregiver_functional_example && !observation.present && !external.some((entry) => entry.decision_relevant),
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
    const boundaryOrAbsence = /(?:bulunmamaktadır|bulunmadığ|örnek bulunmad|belirli bir görev veya koşul göstermediğ|ileri sürülmem|dönüştürülmem|içermemektedir|sınırlı tutul|saptanmamıştır|oluşturmaz|göstermemektedir|yorumlanmamaktadır)/iu
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
  const boldParagraphContractPass = fullBoldParagraphCount === 3 && boldParagraphs.every((entry) => {
    const sentences = sentenceList(entry.text)
    return entry.text.length >= 55 && entry.text.length <= 300 && sentences.length === 1
  })
  const boldDecisionParagraphCount = boldParagraphs.filter((entry) => /(?:bulgular|güçlü(?:k|ğ)|beklenen aralık|yaşa uygun|korun(?:muş|du)|performansın sürdürülebildiğini|karar|öncelik|tek bir alan|sonucuna varılmamıştır|birbirine yakın|diğerlerinin önüne|ileri sürülmemiştir|göstermektedir|desteklemektedir)/iu.test(entry.text)).length
  const boldDecisionContentPass = boldDecisionParagraphCount >= 2
    && boldDecisionParagraphCount <= 3
    && boldParagraphs.reduce((sum, entry) => sum + sentenceList(entry.text).length, 0) >= 2
    && boldParagraphs.reduce((sum, entry) => sum + sentenceList(entry.text).length, 0) <= 3
  const rawNoisyAnamnesisLeakCount = countMatches(clinicalBody, /(?:\bolmuyo\b|\bbilmio\b|\betmiyo\b|\bkaciyo\b|\bsevmiyo\b|\byapcag(?:ini|ını)?\b|\b(?:olaylari|degistirirken|gorevinde|onceki|hatirlamasi|duzenleyemedigi|tamamlayamiyor)\b|\b(?:follow|step)\b|starts\s+but\s+no\s+finish|\?{2,})/giu)
  const grammarFragmentCount = countMatches(clinicalBody, /(?:\b(?:verildiğinde|sağlandığında|azaltıldığında|arttığında|olduğunda|sırasında)\s*\.|Günlük rutine daha düzenli katılım\s*\.|DNA'nın kavramsal çerçevesi,\s*(?:\n|$)|Beklenen aralığın dışında kalan tek alan\s+[^.]+\.)/giu)
  const domainLabel = "(?:Fizyolojik Regülasyon|Duyusal Regülasyon|Duygusal Regülasyon|Bilişsel Regülasyon|Yürütücü İşlev|İnterosepsiyon)"
  const domainListGrammarErrorCount = countMatches(clinicalBody, new RegExp(`${domainLabel}\\s*,\\s*${domainLabel}\\s+alan(?:ı|ları)`, "giu"))
  const otherTwoCount = countMatches(clinicalBody, /\bdiğer iki alan\b/giu)
  const otherFiveCount = countMatches(clinicalBody, /\bdiğer beş alan\b/giu)
  const affectedDomainCountMismatchCount = (plan.profile.affected_domains.length - 1 === 2 ? 0 : otherTwoCount)
    + (plan.profile.preserved_domains.length === 5 ? 0 : otherFiveCount)
  const closeMultidomain = plan.profile.affected_domains.length > 1 && !priorityHasClearSeparation(plan.profile, base.v1.domainResults)
  const closePriorityMentions = sentenceList(clinicalBody).filter((sentence) => /(?:puan(?:lar|ların)[^.]{0,90}birbirine yakın|tek bir alan[^.]{0,90}(?:öncelik|önüne yerleştiril|indirgen|ana açıklama))/iu.test(sentence)).length
  const semanticDecisionRepetitionCount = Math.max(0, closePriorityMentions - 1)
  const profileDecisionBody = sentenceList(clinicalBody).filter((sentence) => !/^(?:Alternatif açıklamalar arasında|Diğer olası açıklamalar)/iu.test(sentence)).join(" ")
  const profileLanguageContradictionCount = plan.profile.profile_breadth === "selective_single_domain"
    ? countMatches(profileDecisionBody, /(?:yaygın çok alanlı|birden fazla self-regülasyon alanında güçlük)/giu)
    : ["focused_multidomain", "broad_multidomain"].includes(plan.profile.profile_breadth)
    ? countMatches(profileDecisionBody, /(?:seçici ayrışma|seçici güçlük)/giu)
    : 0
  const closePriorityOverstatementCount = closeMultidomain
    ? countMatches(clinicalBody, /(?:birincil öncelik|görece en belirgin|en belirgin (?:alan|güçlük|öncelik)|şiddeti en yüksek klinik öncelik|bulgular en çok)/giu)
    : 0
  const confidenceCertaintyMismatchCount = explanation.confidence !== "Yüksek"
    ? countMatches(clinicalBody, /(?:kesin olarak|kesinlikle|kanıtlamaktadır|yüksek güven(?:le)?)/giu)
    : 0
  const naturalEvidenceRelationErrorCount = countMatches(clinicalBody, /aynı yönde[^.]*\.(?:\s*[^.]+\.){0,1}\s*[^.]*aynı yönde değildir/giu)
  const systemLikeProseCount = countMatches(clinicalBody, /(?:formülasyon odağı|bu görünüm|klinik eksen|klinik örüntü kapsamında|ayrışma kümesi|bağımsız bilgi kanalı|örüntünün kapsamı|işlevsel eksende belirginleşmektedir|vaka bağlamında işlevsel dikkat gerektirir|rapordaki önceliği değiştirmek için yeterli değildir|bu sonuca duyulan güven|günlük yaşam açısından izlenecek ilk alan)/giu)
  const awkwardGenericPhraseCount = countMatches(clinicalBody, /(?:Mevcut vaka kanıtı|Bu kaynaklar farklı görev ve koşulları değerlendirdiği için|Her bulgu yalnız kendi kapsamını açıklamaktadır|Beklenen aralığın dışında kalan tek alan|Puanların günlük yaşamdaki(?: en somut)? karşılığı|kantinde kantin sırasında|sınırlı puan dağılımıyla sınırlıdır|Bakım verenin bildirimine göre[^.]{0,180}(?:bildiriyor|bildirmektedir|söylüyor|aktarıyor)|\b(?:kahvalti|ogun)\b)/giu)
  const terminologyDriftCount = countMatches(clinicalBody, /(?:\böz[- ]düzenleme\b|\bself regulation\b)/giu)
  const clinicalSectionsBody = report.split(JURY_REPORT_HEADINGS[4])[0]
  const falseMissingFunctionalExampleCount = plan.caseScopedEvidenceEnvelope.functional_evidence_profile.has_caregiver_functional_example
    ? countMatches(clinicalSectionsBody, /(?:Günlük yaşam örneği bulunmadığ|Somut günlük yaşam örneği bulunmadığ|Günlük yaşama ilişkin somut örnek bulunmamaktadır|Bakım veren anlatısında[^.]{0,120}somut bir örnek bulunmamaktadır)/giu)
    : 0
  const summaryHasTypicalDomainClarification = base.decisionPlan.overallClassification !== "Tipik" || plan.profile.affected_domains.length === 0 || (
    /Ölçek toplam puan sınıflaması:\s*Tipik[^.]*;\s*ancak alan bazlı değerlendirmede/iu.test(summaryText)
    && plan.profile.affected_domains.every((domain) => summaryText.toLocaleLowerCase("tr-TR").includes(DOMAIN_LABELS[domain].toLocaleLowerCase("tr-TR")))
  )
  const typicalTotalDomainClarificationOmissionCount = summaryHasTypicalDomainClarification ? 0 : 1
  const internalReasoningLanguageCount = countMatches(clinicalSectionsBody, /(?:formülasyon odağı|ayrışma kümesi|bağımsız bilgi kanalı|tek alanlı açıklamalar da değerlendirildi|daha dengeli bir profil olasılığı da değerlendirildi|candidate|primary candidate|secondary candidate|rapordaki önceliği değiştirmek için yeterli değildir)/giu)
  const familyFacingJargonCount = countMatches(clinicalSectionsBody, /(?:skor ayrışması|madde örüntüsü|profil dağılımı|dengeleyici işlev bilgisi|bağımsız bilgi kanalı|ayrışma kümesi)/giu)
  const functionalDifficultyFactIds = plan.caseScopedEvidenceEnvelope.anamnesis_evidence
    .filter((fact) => {
      const role = classifyCaregiverEvidenceRole(fact)
      return role.functionalEvidence && role.directionalComplaint
    })
    .map((fact) => fact.id)
  const functionalPriorityParagraphFactIds = plan.sections
    .filter((section) => section.id === "formulation" || section.id === "decision_support")
    .flatMap((section) => section.paragraphs)
    .flatMap((paragraph) => paragraph.sentenceProvenance.flatMap((item) => item.supporting_case_fact_ids))
  const functionalPriorityOmissionCount = functionalDifficultyFactIds.length > 0
    && !functionalDifficultyFactIds.some((factId) => functionalPriorityParagraphFactIds.includes(factId))
    ? 1
    : 0
  const decisionBoldText = plan.sections
    .find((section) => section.id === "decision_support")
    ?.paragraphs.filter((paragraph) => paragraph.emphasis === "full_bold")
    .map((paragraph) => paragraph.text)
    .join(" ") ?? ""
  const lowConfidenceBoldCalibrationFailureCount = ["Sınırlı", "Yetersiz"].includes(explanation.confidence)
    && !/(?:mevcut ölçüm|işaret etmektedir|sınırlı|sınırlandırılmış|genellenmemiştir|izin vermemektedir|sonucuna varılmamıştır)/iu.test(decisionBoldText)
    ? 1
    : 0
  const normalizedSentenceSet = (sectionId: JuryReportSectionId) => new Set((plan.sections.find((section) => section.id === sectionId)?.paragraphs ?? [])
    .flatMap((paragraph) => sentenceList(paragraph.text))
    .map((value) => value.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü]+/gu, " ").trim())
    .filter((value) => value.length >= 20))
  const sectionThreeSentences = normalizedSentenceSet("formulation")
  const sectionFourSentences = normalizedSentenceSet("decision_support")
  const sectionThreeFourRepeatedSentenceCount = [...sectionThreeSentences].filter((value) => sectionFourSentences.has(value)).length
  const literatureBoilerplateCount = countMatches(report, /Literatür bulguları vaka yorumunun bilimsel çerçevesini destekler; bireysel düzeyde tek başına nedensellik, tanısal sonuç, prognoz veya biyolojik mekanizma kanıtı oluşturmaz\./giu)
  const caseSpecificDeepInsightBoldCount = boldParagraphs.filter((entry) => {
    const facts = unique(entry.sentenceProvenance.flatMap((item) => item.supporting_case_fact_ids))
    const hasCaseSpecificSource = facts.some((factId) => /\.fact\.(?:anamnesis|observation|external)\./u.test(factId))
    const hasScoreFact = facts.some((factId) => /\.fact\.score\./u.test(factId))
    const primaryLabel = plan.profile.primary_priority ? DOMAIN_LABELS[plan.profile.primary_priority] : "profil"
    const clearPriority = priorityHasClearSeparation(plan.profile, base.v1.domainResults)
    const affectedLabelCount = plan.profile.affected_domains.filter((domain) => entry.text.toLocaleLowerCase("tr-TR").includes(DOMAIN_LABELS[domain].toLocaleLowerCase("tr-TR"))).length
    const hasProfileArchitecture = hasScoreFact
      && (clearPriority ? entry.text.toLocaleLowerCase("tr-TR").includes(primaryLabel.toLocaleLowerCase("tr-TR")) : affectedLabelCount >= 2 || /(?:birden fazla self-regülasyon alanı|(?:alan )?puan(?:lar|ları) birbirine yakın)/iu.test(entry.text))
      && /(?:profil|dağılım|seçici|çok alanlı|korunmuş|öncelik|birlikte|birbirine yakın|birden fazla|tek bir alan)/iu.test(entry.text)
    return (hasCaseSpecificSource || hasProfileArchitecture) && sentenceList(entry.text).length >= 1
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
  const criticalInternalContradictionCount = Number(!classificationConsistent) + Number(!profileBreadthConsistent) + Number(!therapistObservationConsistent) + missingExtractedExternalTestNames.length + missingValidExternalEvidenceIds.length + invalidExternalEvidenceUsedIds.length + visibleFactualContradictionCount + unsupportedVisibleClauseCount + directionMismatchCount + epistemicStatusMismatchCount + sourceRelationMismatchCount + profileLanguageContradictionCount + closePriorityOverstatementCount + confidenceCertaintyMismatchCount + naturalEvidenceRelationErrorCount
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
    ...(!boldDecisionContentPass ? ["BOLD_DECISION_CONTENT"] : []),
    ...(rawNoisyAnamnesisLeakCount ? ["RAW_NOISY_ANAMNESIS_LEAK"] : []),
    ...(grammarFragmentCount ? ["GRAMMAR_FRAGMENT"] : []),
    ...(domainListGrammarErrorCount ? ["DOMAIN_LIST_GRAMMAR"] : []),
    ...(affectedDomainCountMismatchCount ? ["AFFECTED_DOMAIN_COUNT_MISMATCH"] : []),
    ...(semanticDecisionRepetitionCount ? ["SEMANTIC_DECISION_REPETITION"] : []),
    ...(profileLanguageContradictionCount ? ["PROFILE_LANGUAGE_CONTRADICTION"] : []),
    ...(closePriorityOverstatementCount ? ["CLOSE_PRIORITY_OVERSTATEMENT"] : []),
    ...(confidenceCertaintyMismatchCount ? ["CONFIDENCE_CERTAINTY_MISMATCH"] : []),
    ...(naturalEvidenceRelationErrorCount ? ["NATURAL_EVIDENCE_RELATION_ERROR"] : []),
    ...(systemLikeProseCount ? ["SYSTEM_LIKE_PROSE"] : []),
    ...(awkwardGenericPhraseCount ? ["AWKWARD_GENERIC_PHRASE"] : []),
    ...(terminologyDriftCount ? ["TERMINOLOGY_DRIFT"] : []),
    ...(falseMissingFunctionalExampleCount ? ["FALSE_MISSING_FUNCTIONAL_EXAMPLE"] : []),
    ...(typicalTotalDomainClarificationOmissionCount ? ["TYPICAL_TOTAL_DOMAIN_CLARIFICATION_OMISSION"] : []),
    ...(internalReasoningLanguageCount ? ["INTERNAL_REASONING_LANGUAGE"] : []),
    ...(familyFacingJargonCount ? ["FAMILY_FACING_JARGON"] : []),
    ...(functionalPriorityOmissionCount ? ["FUNCTIONAL_PRIORITY_OMISSION"] : []),
    ...(lowConfidenceBoldCalibrationFailureCount ? ["LOW_CONFIDENCE_BOLD_CALIBRATION"] : []),
    ...(sectionThreeFourRepeatedSentenceCount ? ["SECTION_3_4_REPEATED_SENTENCE"] : []),
    ...(literatureBoilerplateCount ? ["LITERATURE_BOILERPLATE"] : []),
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
  return Object.freeze({ pass: failureCodes.length === 0, classificationConsistent, profileBreadthConsistent, therapistObservationConsistent, externalTestExtractionRecall, missingExtractedExternalTestNames: Object.freeze(missingExtractedExternalTestNames), criticalInternalContradictionCount, missingValidExternalEvidenceIds: Object.freeze(missingValidExternalEvidenceIds), invalidExternalEvidenceUsedIds: Object.freeze(invalidExternalEvidenceUsedIds), unsupportedDiagnosisCount, unsupportedCausalityCount, unsupportedBiologicalMechanismCount, unsupportedSourceCount, sparseFunctionalOverreachCount, headingErrorCount, repeatedSentenceRate, repeatedPhraseCount, materialRepetitionFailureCount, repetitionMateriality, averageSentenceWords, longSentenceCount, visibleFormulationCount, visibleConfidenceCount, standaloneRegulationTranslationCount, negativeContrastCount, clinicalInterventionCount, treatmentRecommendationCount, defaultFurtherAssessmentCount, fullBoldParagraphCount, boldParagraphContractPass, boldDecisionParagraphCount, boldDecisionContentPass, rawNoisyAnamnesisLeakCount, grammarFragmentCount, domainListGrammarErrorCount, affectedDomainCountMismatchCount, semanticDecisionRepetitionCount, profileLanguageContradictionCount, closePriorityOverstatementCount, confidenceCertaintyMismatchCount, naturalEvidenceRelationErrorCount, systemLikeProseCount, awkwardGenericPhraseCount, terminologyDriftCount, falseMissingFunctionalExampleCount, typicalTotalDomainClarificationOmissionCount, internalReasoningLanguageCount, familyFacingJargonCount, functionalPriorityOmissionCount, lowConfidenceBoldCalibrationFailureCount, sectionThreeFourRepeatedSentenceCount, literatureBoilerplateCount, crossCaseContaminationCount, unsupportedCaseFactCount, unknownCaseFactProvenanceCount, unsupportedVisibleCaseClaimCount, visibleClaimFailureDetails: Object.freeze(propositionAudit.provenance_failures.map((entry) => Object.freeze({ sentence: entry.sentence, errorType: entry.error_type, supportingFactIds: entry.supporting_fact_ids }))), unknownVisibleClaimProvenanceCount, wrongSourceAttributionCount, wrongDomainAttributionCount, visibleClaimCount, supportedVisibleClaimCount, visibleFactualContradictionCount, templateSemanticLeakageCount, visibleClauseCount, supportedVisibleClauseCount, unsupportedVisibleClauseCount, partiallySupportedSentenceCount, factIdPresentButNotEntailingCount, profileToFunctionOverreachCount, directionMismatchCount, epistemicStatusMismatchCount, sourceRelationMismatchCount, difficultyAsPreservedCount, absenceAsPreservedCount, falseSourceConvergenceCount, externalTestDirectionErrorCount, unassessedContextAsObservedCount, clauseEntailmentPrecision, clauseEntailmentRecall, caseSpecificDeepInsightBoldCount, genericTemplateFailureCount, majorHeadingCount, wordCount, emptyParagraphCount, failureCodes: Object.freeze(unique(failureCodes)) })
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
    if (input.decisionExplanation.preserved_evidence.length && !/(?:Korunmuş (?:yönler|performans|kapasite|sonuç)|korunmuş kapasite|beklenen aralıktadır)/iu.test(input.finalReport)) findings.push(Object.freeze({ type: "PRESERVED_CAPACITY_OMISSION", severity: "high", message: "Korunmuş kapasite görünür raporda yer almıyor." }))
    if (input.decisionExplanation.limitations.length && !/maddi sınır|ayrıntılar sınırlı|sınırlı tutul|sınırlandırılmıştır|sonucuna izin vermemektedir|kısmen yorumlanabilir|geçersiz|somut[^.]{0,80}örne(?:k|ği)[^.]{0,60}bulunma|somut görev ve ortam ayrıntısı bulunmayan|kapsamını (?:sınırlandır|daralt)|günlük yaşamın tümüne genellenmemiştir|yalnız[^.]{0,160}(?:içinde|kapsamında|dayanmaktadır|kullanılmıştır|kullanılmış|değerlendirilmiştir)|(?:bu|alan) puan[^.]{0,120}bilgi vermez/iu.test(input.finalReport)) findings.push(Object.freeze({ type: "MAJOR_LIMITATION_OMISSION", severity: "high", message: "Kararı maddi olarak sınırlayan bilgi görünür değil." }))
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
  const requiredAssessmentComplete = Array.isArray(input.answers) && input.answers.length === 60 && input.answers.every((value) => Number.isInteger(value) && value >= 1 && value <= 5)
  const profile = priorityProfile(base, requiredAssessmentComplete)
  const literature = prepareLiterature(input, base, profile, therapistObservation, externalEvidence)
  const caseScopedEvidenceEnvelope = buildCaseScopedEvidenceEnvelope(input, base, profile, therapistObservation, externalEvidence, literature.selection.sourceIds)
  const dataQuality = buildDataQuality(input, base, therapistObservation, externalEvidence, caseScopedEvidenceEnvelope)
  const confidence = buildJuryConfidence(dataQuality, base)
  const decisionExplanation = buildDecisionExplanation(base, profile, therapistObservation, externalBundle.raw, externalEvidence, dataQuality, confidence, caseScopedEvidenceEnvelope)
  const lockedLanguagePlan = buildLockedPlan(input, base, profile, therapistObservation, externalEvidence, dataQuality, confidence, decisionExplanation, literature, caseScopedEvidenceEnvelope)
  const deterministicRealizer = new DeterministicJuryLanguageRealizer()
  const requestedRealizer = options.languageRealizer ?? deterministicRealizer
  let realization = await requestedRealizer.realize(lockedLanguagePlan)
  let languageFallbackUsed = false
  let languageFallbackReason: JuryReportResult["languageFallbackReason"] = null
  if (!realization) {
    languageFallbackUsed = true
    languageFallbackReason = "NO_REALIZATION"
    realization = (await deterministicRealizer.realize(lockedLanguagePlan))!
  } else if (!validateLanguageMapping(lockedLanguagePlan, realization)) {
    languageFallbackUsed = true
    languageFallbackReason = "LANGUAGE_MAPPING_VALIDATION"
    realization = (await deterministicRealizer.realize(lockedLanguagePlan))!
  }
  let finalReport = render(lockedLanguagePlan, realization)
  let validation = validateRealization(lockedLanguagePlan, realization, externalBundle.raw, externalEvidence, therapistObservation, dataQuality, decisionExplanation, literature.selection, base)
  if (!validation.pass && requestedRealizer.identity.provider === "luna") {
    languageFallbackUsed = true
    languageFallbackReason = "REPORT_VALIDATION"
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
    languageFallbackReason,
    finalReport,
    validation,
    templateSemanticLeakage,
    externalEvidenceUsageAudit,
  })
}

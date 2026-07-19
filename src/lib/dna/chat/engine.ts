import { evaluateClaimGuard } from "../clinicalClaimRegistry"
import { redactReportTextForPrivacy } from "../reportPrivacy"
import {
  containsUnsupportedCaseBiologicalInference,
  createDnaChatSafeCaseContext,
  getDnaChatCaseContextAuthority,
  hasUsableDnaCaseContext,
} from "./caseContext"
import {
  classifyEmbeddedCatalogQueryKind,
  classifyDnaChatQueryKind,
  resolveDnaCatalogReasoning,
  type DnaCatalogReasoningDraft,
} from "./catalogReasoning"
import { getCatalogTopicById } from "./catalog"
import { DNA_CHAT_INTENT_BY_ID } from "./intents"
import { DNA_INTELLIGENCE_PUBLIC_INTENDED_USE } from "./intendedUse"
import {
  DNA_PRODUCT_AUTHORITY_PENDING,
  EXTERNAL_SCIENCE_AUTHORITY_PENDING,
  authoritySet,
  canAuthoritySupportAnswerRole,
  isReleaseEligibleAuthority,
  type DnaKnowledgeAnswerRole,
  type DnaKnowledgeAuthorityRef,
} from "./knowledgeAuthority"
import {
  authorityForCatalogTopic,
  policyAuthorityForSafetyCategory,
} from "./authorityRegistry"
import {
  findDnaChatLiteratureSources,
  resolveDnaChatSources,
} from "./knowledge"
import { routeDnaChatQuestion } from "./router"
import { inspectDnaChatSafety } from "./safety"
import { normalizeDnaChatText, scoreDnaTextMatch, stableUnique } from "./text"
import {
  DNA_CHAT_DOMAIN_KEYS,
  DNA_CHAT_ENGINE_VERSION,
  DNA_CHAT_SCHEMA_VERSION,
  type DnaChatClassification,
  type DnaChatAnswerUnit,
  type DnaChatContextRequest,
  type DnaChatDomainKey,
  type DnaChatEvidenceSummary,
  type DnaChatIntentDefinition,
  type DnaChatOutcome,
  type DnaChatRequest,
  type DnaChatResponse,
  type DnaChatSafeCaseContext,
  type DnaChatSafetyResult,
  type DnaChatSourceRef,
} from "./types"

const DOMAIN_LABELS: Record<DnaChatDomainKey, string> = {
  physiological: "Fizyolojik regülasyon",
  sensory: "Duyusal regülasyon",
  emotional: "Duygusal regülasyon",
  cognitive: "Bilişsel regülasyon",
  executive: "Yürütücü işlev",
  interoception: "İnterosepsiyon",
}

const DOMAIN_PATTERNS: Record<DnaChatDomainKey, readonly string[]> = {
  physiological: ["uyku", "yeme", "istah", "yorgun", "bedensel toparlanma", "uyarilma"],
  sensory: ["ses", "isik", "dokun", "kalabalik", "hareket", "koku", "tat", "uyaran"],
  emotional: ["duygu", "ofke", "sakinles", "engellen", "gecis", "hayal kirikligi"],
  cognitive: ["dikkat", "zihinde", "yonerge", "bilgi", "zihinsel", "odak"],
  executive: ["baslat", "durdur", "bekle", "sira", "plan", "esneklik", "organize"],
  interoception: ["aclik", "susuz", "tuvalet", "agri", "beden sinyali", "icsel", "yorgunluk"],
}

type CaseAnswerDraft = {
  available: boolean
  summary: string
  details: string[]
  evidence: string[]
  limitations: string[]
  sources: DnaChatSourceRef[]
}

type DnaChatAnswerUnitInput = Omit<DnaChatAnswerUnit, "role"> & {
  role?: DnaKnowledgeAnswerRole
}

function roleForAuthority(
  authority: DnaKnowledgeAuthorityRef,
): DnaKnowledgeAnswerRole {
  if (authority.layer === "dna_product_information") return "product_definition"
  if (authority.layer === "external_scientific_information") return "scientific_evidence"
  if (authority.layer === "case_information") return "case_finding"
  return "safety_boundary"
}

function emptySafety(question: string): DnaChatSafetyResult {
  return inspectDnaChatSafety(question)
}

function cleanOutput(value: string): string {
  return redactReportTextForPrivacy(String(value || "").replace(/\s+/g, " ").trim())
}

function makeResponse(input: {
  route?: DnaChatResponse["route"]
  outcome: DnaChatOutcome
  classification: DnaChatClassification
  intent?: DnaChatIntentDefinition | null
  summary: string
  details?: readonly string[]
  sources?: readonly DnaChatSourceRef[]
  caseEvidence?: readonly string[]
  limitations?: readonly string[]
  safety: DnaChatSafetyResult
  suggestedQuestions?: readonly string[]
  topic?: string | null
  intentId?: string | null
  contextRequest?: DnaChatContextRequest
  evidenceSummary?: DnaChatEvidenceSummary
  answerAuthority?: DnaKnowledgeAuthorityRef
  answerUnits?: readonly DnaChatAnswerUnitInput[]
  authorityGateChecked?: boolean
}): DnaChatResponse {
  const details = stableUnique((input.details ?? []).map(cleanOutput), 6)
  const sources = [...(input.sources ?? [])].slice(0, 4)
  const summary = cleanOutput(input.summary)
  const limitations = stableUnique((input.limitations ?? []).map(cleanOutput), 6)
  const caseEvidence = stableUnique((input.caseEvidence ?? []).map(cleanOutput), 6)
  const route = input.route ?? "unknown"
  const answerAuthority = input.answerAuthority ??
    (route === "case"
      ? sources.find((source) => source.authority.layer === "case_information")?.authority
      : route === "dna"
        ? DNA_PRODUCT_AUTHORITY_PENDING
        : sources.find((source) =>
            source.authority.layer === "external_scientific_information")?.authority) ??
    input.safety.authority
  const caseAuthority = sources.find((source) =>
    source.authority.layer === "case_information")?.authority ?? answerAuthority
  const sourceIdsForLayer = (layer: DnaKnowledgeAuthorityRef["layer"]) =>
    sources.filter((source) => source.authority.layer === layer).map((source) => source.id)
  const generatedUnits: DnaChatAnswerUnit[] = [
    ...(summary
      ? [{
          id: "summary",
          kind: "summary" as const,
          text: summary,
          authority: answerAuthority,
          role: roleForAuthority(answerAuthority),
          sourceIds: sourceIdsForLayer(answerAuthority.layer),
        }]
      : []),
    ...details.map((detail, index) => ({
      id: `detail-${index + 1}`,
      kind: "detail" as const,
      text: detail,
      authority: answerAuthority,
      role: roleForAuthority(answerAuthority),
      sourceIds: sourceIdsForLayer(answerAuthority.layer),
    })),
    ...caseEvidence.map((evidence, index) => ({
      id: `case-evidence-${index + 1}`,
      kind: "case_evidence" as const,
      text: evidence,
      authority: caseAuthority,
      role: "case_finding" as const,
      sourceIds: sourceIdsForLayer("case_information"),
    })),
    ...limitations.map((limitation, index) => ({
      id: `limitation-${index + 1}`,
      kind: "limitation" as const,
      text: limitation,
      authority: input.safety.authority,
      role: "safety_boundary" as const,
      sourceIds: [],
    })),
    ...(input.safety.boundaryTr
      ? [{
          id: "safety-boundary",
          kind: "safety_boundary" as const,
          text: input.safety.boundaryTr,
          authority: input.safety.authority,
          role: "safety_boundary" as const,
          sourceIds: [],
        }]
      : []),
  ]
  const answerUnits: DnaChatAnswerUnit[] = [...(input.answerUnits ?? generatedUnits)].map((unit) => ({
    ...unit,
    role: unit.role ?? roleForAuthority(unit.authority),
    text: cleanOutput(unit.text),
    sourceIds: stableUnique(unit.sourceIds, 8),
  }))
  const authorityGateIssues = answerUnits.flatMap((unit) => {
    const issues: string[] = []
    if (!canAuthoritySupportAnswerRole(unit.authority, unit.role)) {
      issues.push(`${unit.id}:authority_role_mismatch`)
    }
    if (
      unit.authority.releaseEligible &&
      !isReleaseEligibleAuthority(unit.authority)
    ) {
      issues.push(`${unit.id}:unregistered_release_authority`)
    }
    const linkedSources = unit.sourceIds.map((sourceId) =>
      sources.find((source) => source.id === sourceId))
    if (linkedSources.some((source) => !source)) {
      issues.push(`${unit.id}:source_not_found`)
    }
    if (linkedSources.some((source) => source?.authority.layer !== unit.authority.layer)) {
      issues.push(`${unit.id}:source_authority_mismatch`)
    }
    if (
      ["summary", "detail", "case_evidence"].includes(unit.kind) &&
      unit.authority.releaseEligible &&
      unit.authority.layer !== "safety_and_product_boundaries" &&
      unit.sourceIds.length === 0
    ) {
      issues.push(`${unit.id}:release_claim_without_source`)
    }
    if (
      unit.authority.layer === "case_information" &&
      containsUnsupportedCaseBiologicalInference(unit.text)
    ) {
      issues.push(`${unit.id}:case_biological_inference`)
    }
    return issues
  })
  for (const source of sources) {
    if (
      source.authority.releaseEligible &&
      !isReleaseEligibleAuthority(source.authority)
    ) {
      authorityGateIssues.push(`${source.id}:unregistered_source_authority`)
    }
  }
  if (authorityGateIssues.length && input.authorityGateChecked !== true) {
    return makeResponse({
      route,
      outcome: "not_available",
      classification: "not_available",
      topic: input.topic,
      intentId: input.intentId,
      summary: "Bu yanıt bilgi otoritesi sınırları içinde güvenli biçimde oluşturulamadı.",
      limitations: ["Yanıt birimi, kaynak veya otorite eşleşmesi çalışma zamanı korumasınca engellendi."],
      safety: input.safety,
      suggestedQuestions: input.suggestedQuestions,
      answerAuthority: input.safety.authority,
      authorityGateChecked: true,
    })
  }
  const authorities = [
    ...answerUnits.map((unit) => unit.authority),
    ...sources.map((source) => source.authority),
    input.safety.authority,
  ]
  const authoritySummary = authoritySet(authorities).map((layer) => {
    const authority = authorities.find((candidate) => candidate.layer === layer)!
    return {
      contractVersion: authority.contractVersion,
      layer,
      labelTr: authority.labelTr,
      boundaryTr: authority.boundaryTr,
      approvalRequirement: authority.approvalRequirement,
      verificationStatus: authority.verificationStatus,
      releaseEligible: authority.releaseEligible,
    }
  })
  return {
    schemaVersion: DNA_CHAT_SCHEMA_VERSION,
    engineVersion: DNA_CHAT_ENGINE_VERSION,
    route,
    outcome: input.outcome,
    classification: input.classification,
    topic: input.topic === undefined ? (input.intent?.labelTr ?? null) : input.topic,
    intentId: input.intentId === undefined ? (input.intent?.id ?? null) : input.intentId,
    summary,
    details,
    answerTr: [summary, ...details].filter(Boolean).join("\n\n"),
    sourceRefs: sources,
    sources,
    caseEvidence,
    limitations,
    safetyBoundary: input.safety.boundaryTr,
    intendedUse: DNA_INTELLIGENCE_PUBLIC_INTENDED_USE,
    suggestedQuestions: stableUnique(input.suggestedQuestions ?? [], 4),
    safety: input.safety,
    answerUnits,
    authoritySummary,
    ...(input.contextRequest ? { contextRequest: input.contextRequest } : {}),
    ...(input.evidenceSummary ? { evidenceSummary: input.evidenceSummary } : {}),
  }
}

function refusalResponse(safety: DnaChatSafetyResult): DnaChatResponse {
  return makeResponse({
    outcome: "refused",
    classification: "refusal",
    summary: safety.boundaryTr,
    details: [],
    sources: [],
    limitations: ["Bu sınır sohbet içinden kaldırılamaz."],
    safety,
    suggestedQuestions: [
      "DNA hangi alanları değerlendirir?",
      "Kimliksiz vaka bağlamı neleri içerebilir?",
    ],
  })
}

function clarificationResponse(
  safety: DnaChatSafetyResult,
  summary: string,
  route: DnaChatResponse["route"] = "unknown",
  candidateTopics: readonly string[] = [],
): DnaChatResponse {
  const candidates = stableUnique(candidateTopics, 2)
  return makeResponse({
    route,
    outcome: "clarification",
    classification: "clarification",
    summary,
    details: candidates.length
      ? [
          `Şunlardan birini seçin: ${candidates.join(" veya ")}.`,
          "Soruyu seçtiğiniz başlığa göre biraz daha açık yazın.",
        ]
      : [
          "Soruyu bir DNA kavramı, DNA değerlendirmesinin yapısı veya açık kimliksiz vakadaki belirli bir bulgu üzerinden daraltabilirsiniz.",
        ],
    sources: [],
    limitations: ["Yeterli eşleşme olmadan klinik içerik üretilmedi."],
    safety,
    suggestedQuestions: candidates.length
      ? candidates.map((topic) => `${topic} başlığını açıkla.`)
      : [
          "Duyusal regülasyon nedir?",
          "DNA raporu ne içerir?",
          "Bu vakada hangi alanlar göreli olarak zorlanıyor?",
        ],
  })
}

function unmatchedResponse(safety: DnaChatSafetyResult): DnaChatResponse {
  return makeResponse({
    route: "unknown",
    outcome: "not_available",
    classification: "not_available",
    summary: "Bu soru için onaylı DNA bilgi tabanında yeterli eşleşme bulunamadı.",
    details: ["Sistem kaynakta olmayan klinik bilgiyi tamamlamadı veya tahmin etmedi."],
    sources: [],
    limitations: ["Yalnız tanımlı DNA kavramları, değerlendirme yapısı ve açık kimliksiz vaka bulguları yanıtlanabilir."],
    safety,
    suggestedQuestions: ["DNA hangi alanları değerlendirir?", "Self-regülasyon nedir?"],
  })
}

function isStandaloneFollowUp(question: string): boolean {
  const normalized = normalizeDnaChatText(question)
  return /^(?:peki bu|biraz daha acikla|bununla iliskisi ne|bunun iliskisi ne|bunun fizyolojik regulasyonla iliskisi ne|buna ornek verir misin|cocuklarda da ayni mi|bu cocuklarda da gecerli mi|kaniti guclu mu|hangi yas icin gecerli|hangi olcumle gosterilmis|bireysel olarak ne anlama gelir|bunun tersi de olabilir mi|bunun tersi ne|erken cocukluk icin ne degisiyor|peki erken cocuklukta nasil|erken cocuklukta nasil degisir|bunu erken cocukluk icin anlatir misin|okul caginda nasil yorumlariz|dna ile nasil baglariz ama abartmadan|bunu neden soyleyemiyoruz|bu neden tani koydurmuyor|bundan ne sonuc cikarabiliriz|bu kavramin cocuklardaki gelisimi ne zaman hizlanir|cevresel talepler bu surecleri degistirir mi|bu nedensellik gosterir mi)$/.test(normalized)
}

function notAvailableResponse(
  safety: DnaChatSafetyResult,
  intent: DnaChatIntentDefinition,
  summary: string,
  sources: readonly DnaChatSourceRef[] = [],
): DnaChatResponse {
  return makeResponse({
    route: intent.route,
    outcome: "not_available",
    classification: "not_available",
    intent,
    summary,
    details: ["Kaynakta bulunmayan ayrıntı tamamlanmadı veya tahmin edilmedi."],
    sources,
    limitations: ["Yanıt yalnız açık ve kimliksiz vaka bağlamında bulunan verilerle sınırlıdır."],
    safety,
    suggestedQuestions: intent.suggestedQuestions ?? [
      "Vaka skorlarını özetle.",
      "Vakadaki veri sınırlılıkları neler?",
    ],
  })
}

function missingCaseContextResponse(
  safety: DnaChatSafetyResult,
  intent: DnaChatIntentDefinition,
): DnaChatResponse {
  return makeResponse({
    route: "case",
    outcome: "clarification",
    classification: "clarification",
    intent,
    summary: "Bu soruyu yanıtlamak için kendi DNA raporlarınızdan birini seçin.",
    details: [
      "Rapor seçilmeden danışana özgü bulgu okunmaz veya klinik içerik üretilmez.",
    ],
    sources: [],
    limitations: [
      "Yalnız hesabınıza ait, sohbet için yapılandırılmış ve kimliksiz rapor bağlamı kullanılabilir.",
    ],
    safety,
    contextRequest: { type: "report", preferNewest: true },
    suggestedQuestions: [
      "Son raporumu özetle.",
      "Seçtiğim rapordaki göreli zorlanmaları açıkla.",
    ],
  })
}

function theoryResponse(
  intent: DnaChatIntentDefinition,
  question: string,
  safety: DnaChatSafetyResult,
): DnaChatResponse {
  let sources = resolveDnaChatSources(intent.sourceIds)
  const isContextLiterature = intent.id.startsWith("theory_literature_context:")
  if (intent.id === "theory_literature") {
    const ranked = findDnaChatLiteratureSources(question, 2)
    sources = stableSources([...ranked, ...sources], 4)
  }
  const primary = sources[0]
  const summary = primary?.excerptTr ?? "Bu kavram için kilitli bilgi tabanında yeterli kaynak bulunamadı."
  const details = sources.slice(1, 3).map((source) => source.excerptTr)
  const classification: DnaChatClassification =
    intent.id === "theory_literature" || isContextLiterature ? "literature" : "dna_concept"
  return makeResponse({
    route: "theory",
    outcome: sources.length ? "answered" : "not_available",
    classification: sources.length ? classification : "not_available",
    intent,
    summary,
    details,
    sources,
    limitations: [
      "Bu açıklama genel kavramsal çerçevedir; tek vaka için tanı, kesin neden veya klinik gidiş çıkarımı değildir.",
    ],
    safety,
    suggestedQuestions: intent.suggestedQuestions ?? [
      "Bu kavram DNA alanlarıyla nasıl ilişkilidir?",
      "Bilimsel kaynakları gösterir misin?",
    ],
  })
}

function dnaResponse(
  intent: DnaChatIntentDefinition,
  safety: DnaChatSafetyResult,
): DnaChatResponse {
  const sources = resolveDnaChatSources(intent.sourceIds)
  return makeResponse({
    route: "dna",
    outcome: sources.length ? "answered" : "not_available",
    classification: sources.length ? "dna_concept" : "not_available",
    intent,
    summary: intent.summaryTr ?? "DNA bilgi sözleşmesinde bu başlık bulunamadı.",
    details: intent.detailsTr ?? [],
    sources,
    limitations: [
      "DNA Asistanı değerlendirme yapısını açıklar; klinik kararın veya uzman değerlendirmesinin yerine geçmez.",
    ],
    safety,
    suggestedQuestions: intent.suggestedQuestions ?? [],
  })
}

function catalogResponse(
  draft: DnaCatalogReasoningDraft,
  safety: DnaChatSafetyResult,
): DnaChatResponse {
  const hasSources = draft.sources.length > 0
  const answered = draft.classification !== "not_available" && hasSources
  if (answered) {
    const blocked = catalogClaimGuardBlocked([
      draft.summary,
      ...draft.details,
      ...draft.limitations,
      ...draft.sources.flatMap((source) => [source.excerptTr, source.claimBoundary ?? ""]),
    ])
    if (blocked) {
      return makeResponse({
        route: draft.route,
        outcome: "not_available",
        classification: "not_available",
        topic: draft.topicTitle,
        intentId: null,
        summary: "Bu konu için güvenli sınırlar içinde kaynak bağlı yanıt oluşturulamadı.",
        limitations: ["Olası tanısal, yönlendirici veya kesinlik içeren ifade çıktı korumasınca engellendi."],
        safety,
        evidenceSummary: draft.evidenceSummary,
        suggestedQuestions: draft.suggestedQuestions,
      })
    }
  }

  const topicAuthority = authorityForCatalogTopic(
    getCatalogTopicById(draft.topicId) ?? { id: draft.topicId },
  )
  const summaryAuthority = draft.outputAuthorities?.summary ?? topicAuthority
  const detailAuthorities = draft.outputAuthorities?.details ?? draft.details.map(() => topicAuthority)
  const sourceIdsForOutput = (
    authority: DnaKnowledgeAuthorityRef,
    provenanceIds: readonly string[] | undefined,
  ) => {
    const allowed = new Set(provenanceIds ?? [])
    return draft.sources
      .filter((source) =>
        source.authority.layer === authority.layer && (
          allowed.has(source.id) ||
          allowed.has(source.id.slice(source.id.indexOf(":") + 1))
        ))
      .map((source) => source.id)
  }
  const catalogAnswerUnits: DnaChatAnswerUnitInput[] = [
    {
      id: "summary",
      kind: "summary",
      role: roleForAuthority(summaryAuthority),
      text: draft.summary,
      authority: summaryAuthority,
      sourceIds: sourceIdsForOutput(
        summaryAuthority,
        draft.outputSourceIds?.summary,
      ),
    },
    ...draft.details.map((detail, index) => {
      const authority = detailAuthorities[index] ?? topicAuthority
      return {
        id: `detail-${index + 1}`,
        kind: "detail" as const,
        role: roleForAuthority(authority),
        text: detail,
        authority,
        sourceIds: sourceIdsForOutput(
          authority,
          draft.outputSourceIds?.details[index],
        ),
      }
    }),
    ...draft.limitations.map((limitation, index) => ({
      id: `limitation-${index + 1}`,
      kind: "limitation" as const,
      role: "safety_boundary" as const,
      text: limitation,
      authority: safety.authority,
      sourceIds: [],
    })),
    {
      id: "safety-boundary",
      kind: "safety_boundary",
      role: "safety_boundary",
      text: safety.boundaryTr,
      authority: safety.authority,
      sourceIds: [],
    },
  ]

  return makeResponse({
    route: draft.route,
    outcome: answered ? "answered" : "not_available",
    classification: answered ? draft.classification : "not_available",
    topic: draft.topicTitle,
    intentId: `catalog:${draft.topicId}:${draft.queryKind}`,
    summary: draft.summary,
    details: draft.details,
    sources: answered ? draft.sources : [],
    limitations: draft.limitations,
    safety,
    evidenceSummary: draft.evidenceSummary,
    suggestedQuestions: draft.suggestedQuestions,
    answerAuthority: topicAuthority,
    answerUnits: catalogAnswerUnits,
  })
}

function stableSources(sources: readonly DnaChatSourceRef[], limit = 4): DnaChatSourceRef[] {
  const seen = new Set<string>()
  return sources.filter((source) => {
    if (seen.has(source.id)) return false
    seen.add(source.id)
    return true
  }).slice(0, limit)
}

function balancedStableSources(
  groups: readonly (readonly DnaChatSourceRef[])[],
  limit = 4,
): DnaChatSourceRef[] {
  const result: DnaChatSourceRef[] = []
  const seen = new Set<string>()
  const maxGroupLength = Math.max(0, ...groups.map((group) => group.length))
  for (let index = 0; index < maxGroupLength && result.length < limit; index += 1) {
    for (const group of groups) {
      const source = group[index]
      if (!source || seen.has(source.id)) continue
      seen.add(source.id)
      result.push(source)
      if (result.length >= limit) break
    }
  }
  return result
}

const CHAT_BOUNDARY_LANGUAGE =
  /\b(?:uretmez|onermez|degildir|cikarilamaz|gostermez|saglamaz|yerine gecmez|olusturmaz|acilmaz|kapsam disidir)\b/
const CHAT_AFFIRMATIVE_UNSAFE_LANGUAGE =
  /\b(?:tani koyar|tani konur|tanisi vardir|tedavi edilmelidir|mudahale uygulanmalidir|ilac baslanmalidir|seans plani uygulanmalidir|otizmle uyumludur|dehb ile uyumludur)\b/
const CHAT_PRACTICE_LANGUAGE =
  /\b(?:tedavi\w*|mudahale\w*|terapi\w*|seans\w*|ilac\w*|recete\w*|danismanlik|destek plani|uygulama yonergesi|program\w*|protokol\w*|egzersiz\w*|odev\w*)\b/
const CHAT_DIRECTIVE_LANGUAGE =
  /\b(?:\w*(?:malidir|melidir|mali|meli)|yapilmali|uygulanmali|baslanmali|baslanmasi|verilmeli|onerilmeli|calisilmali|gerekir|uygundur)\b/
const CHAT_DIAGNOSTIC_LANGUAGE = /\b(?:tani\w*|teshis\w*|otizm\w*|otistik\w*|dehb\w*|adhd\w*)\b/
const CHAT_DIAGNOSTIC_ASSERTION =
  /\b(?:uyumludur|uyumlu|vardir|var|gosterir|belirtisidir|dusundurur|olabilir)\b/

function evaluateDnaChatClaimGuard(parts: readonly string[]) {
  const issues: ReturnType<typeof evaluateClaimGuard> = []
  const sentences = parts.flatMap((part) => String(part || "").split(/(?<=[.!?;])\s+/))
  for (const sentence of sentences) {
    if (!sentence.trim()) continue
    const normalized = normalizeDnaChatText(sentence)
    const affirmativeUnsafe = CHAT_AFFIRMATIVE_UNSAFE_LANGUAGE.test(normalized)
    const directivePractice =
      CHAT_PRACTICE_LANGUAGE.test(normalized) && CHAT_DIRECTIVE_LANGUAGE.test(normalized)
    const diagnosticAssertion =
      CHAT_DIAGNOSTIC_LANGUAGE.test(normalized) && CHAT_DIAGNOSTIC_ASSERTION.test(normalized)
    if (
      CHAT_BOUNDARY_LANGUAGE.test(normalized) &&
      !affirmativeUnsafe &&
      !directivePractice &&
      !diagnosticAssertion
    ) {
      continue
    }
    if (affirmativeUnsafe || directivePractice || diagnosticAssertion) {
      issues.push({
        code: diagnosticAssertion ? "chat_diagnostic_claim" : "chat_practice_direction_claim",
        severity: "critical",
        message: diagnosticAssertion
          ? "Sohbet yanıtında tanısal çağrışım yapan ifade bulunmamalı."
          : "Sohbet yanıtında uygulama veya yönlendirme çağrışımı yapan ifade bulunmamalı.",
        evidence: sentence.trim(),
      })
      continue
    }
    issues.push(...evaluateClaimGuard(sentence).filter((issue) => issue.severity === "critical"))
  }
  return issues
}

function catalogClaimGuardBlocked(parts: readonly string[]): boolean {
  const sentences = parts.flatMap((part) => String(part || "").split(/(?<=[.!?;])\s+/))
  return sentences.some((sentence) => {
    const normalized = normalizeDnaChatText(sentence)
    if (!normalized) return false
    const affirmativeUnsafe = CHAT_AFFIRMATIVE_UNSAFE_LANGUAGE.test(normalized)
    const directivePractice =
      CHAT_PRACTICE_LANGUAGE.test(normalized) && CHAT_DIRECTIVE_LANGUAGE.test(normalized)
    const diagnosticAssertion =
      CHAT_DIAGNOSTIC_LANGUAGE.test(normalized) && CHAT_DIAGNOSTIC_ASSERTION.test(normalized)
    if (
      CHAT_BOUNDARY_LANGUAGE.test(normalized) &&
      !affirmativeUnsafe &&
      !directivePractice &&
      !diagnosticAssertion
    ) {
      return false
    }
    return affirmativeUnsafe || directivePractice || diagnosticAssertion
  })
}

function caseSource(
  context: DnaChatSafeCaseContext,
  id: string,
  title: string,
  excerpt: string,
): DnaChatSourceRef {
  return {
    id: `case:${id}`,
    type: "case",
    title,
    labelTr: "Açık kimliksiz vaka bağlamı",
    excerptTr: cleanOutput(excerpt),
    claimBoundary: "Yalnız açık vakada bulunan kimliksiz veri; başka vakalara genellenmez.",
    authority: getDnaChatCaseContextAuthority(context),
  }
}

function scoreRows(context: DnaChatSafeCaseContext) {
  return DNA_CHAT_DOMAIN_KEYS.flatMap((domain) => {
    const score = context.scores[domain]
    const level = context.levels[domain]
    if (score === undefined && !level) return []
    return [{ domain, label: DOMAIN_LABELS[domain], score, level }]
  })
}

function weakDomainLabels(context: DnaChatSafeCaseContext): string[] {
  if (context.chatContext.weakDomains.length) return context.chatContext.weakDomains
  const rows = scoreRows(context)
  const levelBased = rows
    .filter((entry) => entry.level === "Riskli" || entry.level === "Atipik")
    .map((entry) => entry.label)
  if (rows.some((entry) => Boolean(entry.level))) return levelBased
  const scored = rows.filter((entry) => entry.score !== undefined)
  if (scored.length < 2) return []
  return scored
    .sort((left, right) => Number(left.score) - Number(right.score) || left.domain.localeCompare(right.domain))
    .slice(0, 2)
    .map((entry) => entry.label)
}

function strongDomainLabels(context: DnaChatSafeCaseContext): string[] {
  if (context.chatContext.strongDomains.length) return context.chatContext.strongDomains
  const rows = scoreRows(context)
  const levelBased = rows
    .filter((entry) => entry.level === "Tipik")
    .map((entry) => entry.label)
  if (rows.some((entry) => Boolean(entry.level))) return levelBased
  const scored = rows.filter((entry) => entry.score !== undefined)
  if (scored.length < 2) return []
  return scored
    .sort((left, right) => Number(right.score) - Number(left.score) || left.domain.localeCompare(right.domain))
    .slice(0, 2)
    .map((entry) => entry.label)
}

function relevantDomainEvidence(
  context: DnaChatSafeCaseContext,
  domain: DnaChatDomainKey,
): string[] {
  const candidates = [
    ...context.chatContext.evidence,
    ...context.themes,
    ...context.observations,
    ...context.externalFindings,
  ]
  return candidates
    .map((line) => ({ line, score: scoreDnaTextMatch(line, DOMAIN_PATTERNS[domain]).score }))
    .filter((entry) => entry.score >= 0.2)
    .sort((left, right) => right.score - left.score || left.line.localeCompare(right.line))
    .slice(0, 3)
    .map((entry) => entry.line)
}

function caseDraft(
  intent: DnaChatIntentDefinition,
  question: string,
  context: DnaChatSafeCaseContext,
): CaseAnswerDraft {
  const clinicalSources = resolveDnaChatSources(intent.sourceIds)
  const standardLimit =
    "Bulgular açık vaka bağlamıyla sınırlıdır; tanısal sınıflama veya kesin nedensellik oluşturmaz."

  if (intent.id === "case_overview") {
    const weak = weakDomainLabels(context)
    const strong = strongDomainLabels(context).filter((label) => !weak.includes(label))
    const axis = context.chatContext.primaryAxis
    const summary = axis
      ? `Açık vaka bağlamındaki ana çalışma hipotezi: ${axis}`
      : weak.length
        ? `Açık vaka bağlamında göreli zorlanma ${weak.slice(0, 2).join(" ve ")} çevresinde yoğunlaşıyor.`
        : strong.length
          ? `Mevcut düzey etiketlerinde Riskli veya Atipik alan bulunmuyor; göreli korunmuş alanlar ${strong.slice(0, 3).join(", ")}.`
          : "Açık vaka bağlamında genel örüntüyü özetlemek için yeterli alan bilgisi bulunmuyor."
    const evidence = context.chatContext.evidence.slice(0, 3)
    const details = [
      strong.length ? `Göreli korunmuş kapasiteler: ${strong.slice(0, 3).join(", ")}.` : "",
      ...evidence,
    ].filter(Boolean)
    return {
      available: Boolean(axis || weak.length || strong.length || evidence.length),
      summary,
      details,
      evidence,
      limitations: [...context.chatContext.limitations, standardLimit],
      sources: stableSources([
        ...(axis ? [caseSource(context, "primary-axis", "Vaka ana ekseni", axis)] : []),
        ...evidence.slice(0, 2).map((line, index) => caseSource(context, `evidence-${index + 1}`, "Vaka kanıt satırı", line)),
        ...clinicalSources,
      ]),
    }
  }

  if (intent.id === "case_primary_axis") {
    const axis = context.chatContext.primaryAxis
    const evidence = context.chatContext.evidence.slice(0, 3)
    return {
      available: Boolean(axis),
      summary: axis
        ? `Mevcut rapor bağlamındaki ana eksen, kesin hüküm değil çalışma hipotezi olarak “${axis}” şeklinde kaydedilmiş.`
        : "Bu vaka için ana klinik eksen kaydı bulunmuyor.",
      details: evidence,
      evidence,
      limitations: [...context.chatContext.limitations, standardLimit],
      sources: stableSources([
        ...(axis ? [caseSource(context, "primary-axis", "Vaka ana ekseni", axis)] : []),
        ...clinicalSources,
      ]),
    }
  }

  if (intent.id === "case_weak_domains" || intent.id === "case_strengths") {
    const weak = intent.id === "case_weak_domains"
    const opposingLabels = new Set(weak ? strongDomainLabels(context) : weakDomainLabels(context))
    const labels = (weak ? weakDomainLabels(context) : strongDomainLabels(context)).filter(
      (label) => !opposingLabels.has(label),
    )
    const kind = weak ? "göreli zorlanma" : "göreli korunmuşluk"
    return {
      available: labels.length > 0,
      summary: labels.length
        ? `Açık vaka verisinde ${kind} gösteren alanlar: ${labels.join(", ")}.`
        : `Bu vaka için ${kind} alanı kaydı bulunmuyor.`,
      details: weak && !context.chatContext.weakDomains.length
        ? ["Liste, mevcut düzey etiketlerinden veya en düşük göreli alan skorlarından türetilmiştir."]
        : [],
      evidence: labels,
      limitations: [...context.chatContext.limitations, standardLimit],
      sources: stableSources([
        ...(labels.length ? [caseSource(context, weak ? "weak-domains" : "strong-domains", intent.labelTr, labels.join(", "))] : []),
        ...clinicalSources,
      ]),
    }
  }

  if (intent.id === "case_scores") {
    const rows = scoreRows(context)
    const lines = rows.map((entry) =>
      `${entry.label}: ${entry.score === undefined ? "skor yok" : `${entry.score}/50`}${entry.level ? `, ${entry.level}` : ""}.`,
    )
    return {
      available: lines.length > 0,
      summary: lines.length ? "Açık vaka bağlamındaki alan skorları aşağıdadır." : "Bu vaka için alan skoru bulunmuyor.",
      details: lines,
      evidence: lines,
      limitations: ["Skorlar tek başına klinik anlam taşımaz; bağlam ve veri güveniyle birlikte okunur."],
      sources: stableSources([
        ...(lines.length ? [caseSource(context, "domain-scores", "Vaka alan skorları", lines.join(" "))] : []),
        ...clinicalSources,
      ]),
    }
  }

  const listIntents: Record<string, { values: string[]; title: string }> = {
    case_anamnesis: { values: context.themes, title: "Kimliksiz anamnez temaları" },
    case_observations: { values: context.observations, title: "Kimliksiz klinik gözlemler" },
    case_external_findings: { values: context.externalFindings, title: "Kimliksiz ek değerlendirme bulguları" },
    case_counter_evidence: { values: context.chatContext.counterEvidence, title: "Karşı kanıt ve sınırlayıcı bulgular" },
    case_preserved_capacity: { values: context.chatContext.preservedCapacities, title: "Korunmuş kapasite bulguları" },
    case_limitations: { values: context.chatContext.limitations, title: "Vaka veri sınırlılıkları" },
  }
  const list = listIntents[intent.id]
  if (list) {
    return {
      available: list.values.length > 0,
      summary: list.values.length ? `${list.title}:` : `Bu vaka için ${list.title.toLocaleLowerCase("tr-TR")} bulunmuyor.`,
      details: list.values,
      evidence: list.values,
      limitations: intent.id === "case_limitations" ? list.values : [...context.chatContext.limitations, standardLimit],
      sources: stableSources([
        ...(list.values.length ? [caseSource(context, intent.id, list.title, list.values.join(" "))] : []),
        ...clinicalSources,
      ]),
    }
  }

  if (intent.id === "case_confidence") {
    const confidence = context.chatContext.confidence
    return {
      available: Boolean(confidence || context.chatContext.confidenceRationale),
      summary: confidence ? `Raporda kayıtlı veri güveni: ${confidence}.` : "Bu vaka için veri güveni düzeyi kaydı bulunmuyor.",
      details: context.chatContext.confidenceRationale ? [context.chatContext.confidenceRationale] : [],
      evidence: [confidence ?? "", context.chatContext.confidenceRationale ?? ""].filter(Boolean),
      limitations: [...context.chatContext.limitations, standardLimit],
      sources: stableSources([
        ...(confidence ? [caseSource(context, "confidence", "Vaka veri güveni", confidence)] : []),
        ...clinicalSources,
      ]),
    }
  }

  if (intent.id === "case_literature") {
    const queryWithContext = [question, ...context.chatContext.weakDomains, ...context.themes].join(" ")
    const literature = stableSources([
      ...findDnaChatLiteratureSources(queryWithContext, 3),
      ...clinicalSources,
    ], 4)
    const evidence = context.chatContext.evidence.slice(0, 2)
    return {
      available: literature.some((source) => source.type === "literature"),
      summary:
        "Literatür, açık vaka bulgularını tanısal veya nedensel hükme dönüştürmeden genel kavramsal çerçeveyle ilişkilendirebilir.",
      details: literature
        .filter((source) => source.type === "literature")
        .map(
          (source) =>
            `${source.labelTr || source.citation || "Doğrulanmış kaynak"}: Bu kaynak genel kavramsal ilişkiyi grup düzeyinde çerçeveler; tek vaka için klinik yönlendirme üretmez.`,
        ),
      evidence,
      limitations: [...context.chatContext.limitations, standardLimit],
      sources: stableSources([
        ...evidence.map((line, index) => caseSource(context, `evidence-${index + 1}`, "Vaka kanıt satırı", line)),
        ...literature,
      ]),
    }
  }

  if (intent.domain) {
    const score = context.scores[intent.domain]
    const level = context.levels[intent.domain]
    const evidence = relevantDomainEvidence(context, intent.domain)
    const label = DOMAIN_LABELS[intent.domain]
    const dataPieces = [
      score === undefined ? "" : `${score}/50`,
      level ?? "",
    ].filter(Boolean)
    return {
      available: Boolean(dataPieces.length || evidence.length),
      summary: dataPieces.length
        ? `${label} için açık vaka kaydı: ${dataPieces.join(", ")}.`
        : evidence.length
          ? `${label} ile ilişkili açık vaka bulguları mevcut.`
          : `${label} için vakaya özgü veri bulunmuyor.`,
      details: evidence,
      evidence,
      limitations: [...context.chatContext.limitations, standardLimit],
      sources: stableSources([
        ...(dataPieces.length ? [caseSource(context, `domain-${intent.domain}`, `${label} vaka kaydı`, dataPieces.join(", "))] : []),
        ...evidence.slice(0, 2).map((line, index) => caseSource(context, `${intent.domain}-evidence-${index + 1}`, `${label} vaka bulgusu`, line)),
        ...clinicalSources,
      ]),
    }
  }

  return {
    available: false,
    summary: "Bu başlık için açık vaka bağlamında yeterli veri bulunmuyor.",
    details: [],
    evidence: [],
    limitations: [standardLimit],
    sources: clinicalSources,
  }
}

function guardedCaseResponse(
  intent: DnaChatIntentDefinition,
  question: string,
  context: DnaChatSafeCaseContext,
  safety: DnaChatSafetyResult,
): DnaChatResponse {
  const draft = caseDraft(intent, question, context)
  if (!draft.available) {
    return notAvailableResponse(safety, intent, draft.summary, draft.sources)
  }
  const issues = evaluateDnaChatClaimGuard([
    draft.summary,
    ...draft.details,
    ...draft.evidence,
    ...draft.limitations,
    ...draft.sources
      .filter((source) => source.type === "case")
      .flatMap((source) => [
        source.title ?? "",
        source.labelTr ?? "",
        source.excerptTr ?? "",
        source.claimBoundary ?? "",
      ]),
  ])
  if (issues.length) {
    return makeResponse({
      route: "case",
      outcome: "not_available",
      classification: "not_available",
      intent,
      summary: "Bu vaka için güvenli sınırlar içinde yanıt üretilemedi.",
      details: [],
      sources: [],
      caseEvidence: [],
      limitations: ["Olası tanısal, yönlendirici veya kesinlik içeren ifade çıktı korumasınca engellendi."],
      safety,
      suggestedQuestions: ["Vaka skorlarını özetle.", "Vakadaki veri sınırlılıkları neler?"],
    })
  }
  const classification: DnaChatClassification =
    intent.id === "case_primary_axis" ||
    (intent.id === "case_overview" && Boolean(context.chatContext.primaryAxis))
      ? "hypothesis"
      : intent.id === "case_literature"
        ? "literature"
        : "case_finding"
  return makeResponse({
    route: "case",
    outcome: "answered",
    classification,
    intent,
    summary: draft.summary,
    details: draft.details,
    sources: draft.sources,
    caseEvidence: draft.evidence,
    limitations: draft.limitations,
    safety,
    suggestedQuestions: intent.suggestedQuestions ?? [
      "Vakadaki veri sınırlılıkları neler?",
      "Korunmuş kapasiteleri özetle.",
      "Bu vaka için literatür çerçevesi nedir?",
    ],
  })
}

function catalogCaseTheoryResponse(
  intent: DnaChatIntentDefinition,
  question: string,
  previousTopic: string | null | undefined,
  context: DnaChatSafeCaseContext,
  safety: DnaChatSafetyResult,
): DnaChatResponse {
  const caseAnswer = guardedCaseResponse(intent, question, context, safety)
  if (caseAnswer.outcome !== "answered") return caseAnswer

  const draft = resolveDnaCatalogReasoning({
    question,
    previousTopic,
    queryKind: classifyEmbeddedCatalogQueryKind(question),
    ageMonths: context.ageMonths,
  })
  if (!draft) {
    return makeResponse({
      route: "case",
      outcome: caseAnswer.outcome,
      classification: caseAnswer.classification,
      topic: caseAnswer.topic,
      intentId: caseAnswer.intentId,
      summary: caseAnswer.summary,
      details: caseAnswer.details,
      sources: caseAnswer.sources,
      caseEvidence: caseAnswer.caseEvidence,
      limitations: [
        "Bu vakada biyolojik mekanizma doğrudan ölçülmedi.",
        ...caseAnswer.limitations,
      ],
      safety,
      suggestedQuestions: caseAnswer.suggestedQuestions,
    })
  }

  const theoryAnswer = catalogResponse(draft, safety)
  if (theoryAnswer.outcome !== "answered") return theoryAnswer

  const combinedSources = balancedStableSources([caseAnswer.sources, theoryAnswer.sources], 4)
  const combinedLimitations = stableUnique([
    "Bu vakada biyolojik mekanizma doğrudan ölçülmedi.",
    ...caseAnswer.limitations,
    ...theoryAnswer.limitations,
  ], 6)
  const caseAuthority = caseAnswer.answerUnits.find((unit) =>
    unit.authority.layer === "case_information")?.authority ??
    getDnaChatCaseContextAuthority(context)
  const theoryAuthority = theoryAnswer.answerUnits.find((unit) =>
    unit.kind === "summary")?.authority ?? EXTERNAL_SCIENCE_AUTHORITY_PENDING
  const caseSourceIds = combinedSources
    .filter((source) => source.authority.layer === "case_information")
    .map((source) => source.id)
  const theorySourceIds = combinedSources
    .filter((source) => source.authority.layer === theoryAuthority.layer)
    .map((source) => source.id)
  const combinedAnswerUnits: DnaChatAnswerUnit[] = [
    {
      id: "case-summary",
      kind: "summary",
      text: caseAnswer.summary,
      authority: caseAuthority,
      role: "case_finding",
      sourceIds: caseSourceIds,
    },
    ...caseAnswer.details.map((detail, index) => ({
      id: `case-detail-${index + 1}`,
      kind: "detail" as const,
      text: detail,
      authority: caseAuthority,
      role: "case_finding" as const,
      sourceIds: caseSourceIds,
    })),
    {
      id: "theory-summary",
      kind: "detail",
      text: `Genel teori çerçevesi: ${theoryAnswer.summary}`,
      authority: theoryAuthority,
      role: "scientific_evidence",
      sourceIds: theorySourceIds,
    },
    ...theoryAnswer.details.slice(0, 2).map((detail, index) => ({
      id: `theory-detail-${index + 1}`,
      kind: "detail" as const,
      text: detail,
      authority: theoryAuthority,
      role: "scientific_evidence" as const,
      sourceIds: theorySourceIds,
    })),
    ...caseAnswer.caseEvidence.map((evidence, index) => ({
      id: `case-evidence-${index + 1}`,
      kind: "case_evidence" as const,
      text: evidence,
      authority: caseAuthority,
      role: "case_finding" as const,
      sourceIds: caseSourceIds,
    })),
    ...combinedLimitations.map((limitation, index) => ({
      id: `limitation-${index + 1}`,
      kind: "limitation" as const,
      text: limitation,
      authority: safety.authority,
      role: "safety_boundary" as const,
      sourceIds: [],
    })),
    {
      id: "safety-boundary",
      kind: "safety_boundary",
      text: safety.boundaryTr,
      authority: safety.authority,
      role: "safety_boundary",
      sourceIds: [],
    },
  ]

  return makeResponse({
    route: "case",
    outcome: "answered",
    classification: "hypothesis",
    topic: `${caseAnswer.topic ?? "Rapor bulgusu"} · ${theoryAnswer.topic ?? "Genel teori"}`,
    intentId: null,
    summary: caseAnswer.summary,
    details: [
      ...caseAnswer.details,
      `Genel teori çerçevesi: ${theoryAnswer.summary}`,
      ...theoryAnswer.details.slice(0, 2),
    ],
    sources: combinedSources,
    caseEvidence: caseAnswer.caseEvidence,
    limitations: combinedLimitations,
    safety,
    evidenceSummary: theoryAnswer.evidenceSummary,
    suggestedQuestions: stableUnique([
      ...caseAnswer.suggestedQuestions,
      ...theoryAnswer.suggestedQuestions,
    ], 4),
    answerUnits: combinedAnswerUnits,
  })
}

function resolveSingleDnaChat(
  request: DnaChatRequest,
  question: string,
  safety: DnaChatSafetyResult,
): DnaChatResponse {
  let caseContext: DnaChatSafeCaseContext | null = null
  if (request.caseContext) {
    try {
      caseContext = createDnaChatSafeCaseContext(request.caseContext)
    } catch {
      return refusalResponse({
        blocked: true,
        category: "unsafe_case_context",
        code: "invalid_case_context",
        redactedQuestion: "",
        boundaryTr: "Vaka bağlamı yalnız sentetik veya kimliksizleştirilmiş güvenli alanlardan oluşturulabilir.",
        authority: policyAuthorityForSafetyCategory("unsafe_case_context"),
      })
    }
    if (caseContext.redactionCount > 0) {
      return refusalResponse({
        blocked: true,
        category: "unsafe_case_context",
        code: "identifier_in_case_context",
        redactedQuestion: "",
        boundaryTr: "Vaka bağlamında doğrudan tanımlayıcı veya güvenli sözleşme dışında veri saptandı. Kimlik bilgilerini kaldırın.",
        authority: policyAuthorityForSafetyCategory("unsafe_case_context"),
      })
    }
  }

  if (!request.previousTopic && isStandaloneFollowUp(question)) {
    return clarificationResponse(
      safety,
      "Takip sorusunun hangi kavram veya önceki bulguya gönderme yaptığı açık değil.",
    )
  }

  const queryKind = classifyDnaChatQueryKind(question)
  const routed = routeDnaChatQuestion({
    question,
    mode: request.mode,
    previousTopic: request.previousTopic,
    hasCaseContext: Boolean(caseContext && hasUsableDnaCaseContext(caseContext)),
  })

  const legacyNonCaseMatch = Boolean(
    request.mode &&
    request.mode !== "case" &&
    routed.route === request.mode &&
    routed.intent,
  )
  const isCaseQuery = !legacyNonCaseMatch && (
    queryKind === "case_finding" ||
    queryKind === "case_theory" ||
    (request.mode === "case" && routed.route === "case" && Boolean(routed.intent))
  )
  if (isCaseQuery) {
    const intent =
      routed.route === "case" && routed.intent
        ? routed.intent
        : DNA_CHAT_INTENT_BY_ID.get("case_overview") ?? null
    if (!intent) return unmatchedResponse(safety)
    if (!caseContext) return missingCaseContextResponse(safety, intent)
    if (!hasUsableDnaCaseContext(caseContext)) {
      return notAvailableResponse(
        safety,
        intent,
        "Bu raporda sohbet için yeterli yapılandırılmış veri yok.",
      )
    }
    const preserveLegacyCaseAnswer = Boolean(
      request.mode === "case" && routed.route === "case" && routed.intent,
    )
    return queryKind === "case_theory" && !preserveLegacyCaseAnswer
      ? catalogCaseTheoryResponse(intent, question, request.previousTopic, caseContext, safety)
      : guardedCaseResponse(intent, question, caseContext, safety)
  }

  // Calls carrying a legacy mode keep their established exact/phrase route so
  // existing integrations and benchmark fixtures remain stable. Unknown new
  // topics still continue into Catalog V2.
  const preferLegacy = Boolean(
    request.mode && routed.intent && routed.route !== "unknown",
  )
  if (!preferLegacy) {
    const catalogDraft = resolveDnaCatalogReasoning({
      question,
      previousTopic: request.previousTopic,
      queryKind,
      ageMonths: caseContext?.ageMonths,
    })
    if (catalogDraft) return catalogResponse(catalogDraft, safety)
  }

  if (!routed.intent || routed.route === "unknown") {
    return unmatchedResponse(safety)
  }
  if (routed.match.method === "weighted" && routed.match.score < 0.5) {
    return unmatchedResponse(safety)
  }
  if (
    routed.match.method === "weighted" &&
    (routed.match.score < 0.72 || routed.ambiguityGap < 0.12)
  ) {
    return clarificationResponse(
      safety,
      "Soru birden fazla başlıkla benzer düzeyde eşleşti. Hangi başlığı kastettiğinizi belirtin.",
      routed.route,
      routed.candidateTopics,
    )
  }

  if (routed.route === "theory") return theoryResponse(routed.intent, question, safety)
  if (routed.route === "dna") return dnaResponse(routed.intent, safety)
  return caseContext
    ? guardedCaseResponse(routed.intent, question, caseContext, safety)
    : missingCaseContextResponse(safety, routed.intent)
}

function splitDnaChatQuestion(question: string): { parts: string[]; overflow: boolean } {
  const questionMarkParts = question
    .split(/\?+/)
    .map((part) => part.trim())
    .filter(Boolean)
  const semicolonParts = question
    .split(/\s*;\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
  const conjunctionParts = question
    .split(/\s+ve\s+/giu)
    .map((part) => part.trim())
    .filter(Boolean)
  const questionMarker = /\b(?:nedir|ne demek|nasil|neden|hangi|neyi|olur mu|midir|mudur|misin|gosterir mi|iliskili mi)\b/
  const hasIndependentQuestions = conjunctionParts.length > 1 && conjunctionParts.every((part) =>
    questionMarker.test(normalizeDnaChatText(part)),
  )
  const parts = questionMarkParts.length > 1
    ? questionMarkParts
    : semicolonParts.length > 1
      ? semicolonParts
      : hasIndependentQuestions
        ? conjunctionParts
        : [question]
  return { parts: parts.slice(0, 2), overflow: parts.length > 2 }
}

function catalogTopicIdFromResponse(response: DnaChatResponse): string | null {
  const match = /^catalog:([^:]+):/.exec(response.intentId ?? "")
  return match?.[1] ?? null
}

function isEllipticalSecondQuestion(question: string): boolean {
  const normalized = normalizeDnaChatText(question)
  return /^(?:cocuklukta\b|kanit\w*\b|kaynak\w*\b|nasil\b|hangi\b|alanlar\b|surecler\b|stratejiler\b|bunlar\b|bunun\b|bu\b|peki\b)/.test(
    normalized,
  )
}

function contextualCatalogTopicId(topicId: string, question: string): string {
  const normalized = normalizeDnaChatText(question)
  const desiredSuffix = /\b(?:cocukluk|gelis\w*|olgunlas\w*)\b/.test(normalized)
    ? "development"
    : /\b(?:olc\w*|degerlendir\w*)\b/.test(normalized)
      ? "measurement"
      : /\bstrateji\w*\b/.test(normalized)
        ? "strategies"
        : null
  if (!desiredSuffix) return topicId

  const roots = [
    topicId,
    topicId.replace(/_(?:control|models|overview|regulation|health)$/, ""),
  ]
  for (const root of roots) {
    const candidateId = `${root}_${desiredSuffix}`
    if (getCatalogTopicById(candidateId)) return candidateId
  }
  return topicId
}

function resolveSecondDnaChatQuestion(
  request: DnaChatRequest,
  question: string,
  firstResponse: DnaChatResponse,
): DnaChatResponse {
  const direct = resolveSingleDnaChat(
    { ...request, question },
    question,
    emptySafety(question),
  )
  if (direct.outcome === "answered" || !isEllipticalSecondQuestion(question)) return direct

  const firstTopicId = catalogTopicIdFromResponse(firstResponse)
  if (!firstTopicId || firstResponse.outcome !== "answered") return direct
  const contextualTopicId = contextualCatalogTopicId(firstTopicId, question)
  const contextualTopic = getCatalogTopicById(contextualTopicId)
  if (!contextualTopic) return direct

  // İlk yanıtın açık katalog kimliği yalnız ikinci, öznesi düşmüş soruyu
  // yönlendirmek için kullanılır. Vaka erişimi ve sahiplik kontrolü bu değere
  // hiçbir zaman dayanmaz.
  const routingQuestion = `${contextualTopic.title}: ${question}`
  return resolveSingleDnaChat(
    {
      ...request,
      question: routingQuestion,
      previousTopic: contextualTopic.id,
    },
    routingQuestion,
    emptySafety(question),
  )
}

function combinedEvidenceSummary(responses: readonly DnaChatResponse[]): DnaChatEvidenceSummary | undefined {
  const summaries = responses.flatMap((response) => response.evidenceSummary ? [response.evidenceSummary] : [])
  if (!summaries.length) return undefined
  const validationStatuses = summaries.flatMap((summary) =>
    summary.dnaValidationStatus ? [summary.dnaValidationStatus] : [])
  return {
    level: stableUnique(summaries.map((summary) => summary.level), 3).join(" · "),
    scientificEvidenceLevel: stableUnique(summaries.flatMap((summary) =>
      summary.scientificEvidenceLevel ? [summary.scientificEvidenceLevel] : []), 3).join(" · ") || undefined,
    dnaValidationStatus: validationStatuses.includes("not_established")
      ? "not_established"
      : validationStatuses.includes("dna_specific_evidence")
        ? "dna_specific_evidence"
        : "not_applicable",
    ageScope: stableUnique(summaries.map((summary) => summary.ageScope), 3).join(" · "),
    sampleScope: stableUnique(summaries.map((summary) => summary.sampleScope), 3).join(" · "),
    boundary: stableUnique(summaries.map((summary) => summary.boundary), 3).join(" "),
  }
}

function combineDnaChatResponses(
  responses: readonly DnaChatResponse[],
  safety: DnaChatSafetyResult,
): DnaChatResponse {
  const contextRequest = responses.find((response) => response.contextRequest)?.contextRequest
  const answered = responses.filter((response) => response.outcome === "answered")
  const partiallyAnswered = answered.length > 0 && answered.length < responses.length
  const mixedCaseTheory =
    responses.some((response) => response.route === "case") &&
    responses.some((response) => response.route === "theory" || response.route === "dna")
  const route: DnaChatResponse["route"] = responses.some((response) => response.route === "case")
    ? "case"
    : responses.some((response) => response.route === "dna")
      ? "dna"
      : "theory"
  const classification: DnaChatClassification = contextRequest
    ? "clarification"
    : partiallyAnswered
      ? "clarification"
    : mixedCaseTheory && answered.length
      ? "hypothesis"
    : answered.some((response) => response.classification === "hypothesis")
      ? "hypothesis"
      : answered.some((response) => response.classification === "case_finding")
        ? "case_finding"
        : answered.some((response) => response.classification === "literature")
          ? "literature"
          : answered.length
            ? "dna_concept"
            : responses.some((response) => response.classification === "clarification")
              ? "clarification"
              : "not_available"
  const outcome: DnaChatOutcome = contextRequest || classification === "clarification"
    ? "clarification"
    : answered.length
      ? "answered"
      : "not_available"

  const combinedSources = balancedStableSources(responses.map((response) => response.sources), 4)
  const combinedSourceIds = new Set(combinedSources.map((source) => source.id))
  const combinedLimitations = stableUnique([
    ...(mixedCaseTheory ? ["Bu vakada biyolojik mekanizma doğrudan ölçülmedi."] : []),
    ...(partiallyAnswered ? ["Yanıtlanamayan bölüm, yanıtlanan başlığın bilgisiyle tamamlanmadı."] : []),
    ...responses.flatMap((response) => response.limitations),
  ], 6)
  const combinedSummary = contextRequest
    ? "Sorunuzun vakaya özgü bölümünü yanıtlamak için bir DNA raporu seçin."
    : partiallyAnswered
      ? "Sorunuzun bir bölümü yanıtlandı; diğer bölüm için daha açık bir başlık veya doğrulanmış katalog bağlantısı gerekiyor."
      : "Sorunuzdaki iki başlık ayrı ayrı değerlendirildi."
  const combinedUnits: DnaChatAnswerUnit[] = [
    {
      id: "combined-summary",
      kind: "summary",
      text: combinedSummary,
      authority: safety.authority,
      role: "safety_boundary",
      sourceIds: [],
    },
    ...responses.flatMap((response, responseIndex) => {
      const responseAuthority = response.answerUnits.find((unit) =>
        unit.kind === "summary")?.authority ?? safety.authority
      const sourceIds = response.sources
        .filter((source) => source.authority.layer === responseAuthority.layer && combinedSourceIds.has(source.id))
        .map((source) => source.id)
      return [
        {
          id: `response-${responseIndex + 1}-summary`,
          kind: "detail" as const,
          text: `${responseIndex + 1}. ${response.topic ?? "Başlık"}: ${response.summary}`,
          authority: responseAuthority,
          role: roleForAuthority(responseAuthority),
          sourceIds,
        },
        ...response.details.slice(0, 2).map((detail, detailIndex) => ({
          id: `response-${responseIndex + 1}-detail-${detailIndex + 1}`,
          kind: "detail" as const,
          text: detail,
          authority: responseAuthority,
          role: roleForAuthority(responseAuthority),
          sourceIds,
        })),
        ...response.caseEvidence.map((evidence, evidenceIndex) => ({
          id: `response-${responseIndex + 1}-case-evidence-${evidenceIndex + 1}`,
          kind: "case_evidence" as const,
          text: evidence,
          authority: response.answerUnits.find((unit) =>
            unit.kind === "case_evidence")?.authority ?? responseAuthority,
          role: "case_finding" as const,
          sourceIds: response.sources
            .filter((source) => source.authority.layer === "case_information" && combinedSourceIds.has(source.id))
            .map((source) => source.id),
        })),
      ]
    }),
    ...combinedLimitations.map((limitation, index) => ({
      id: `combined-limitation-${index + 1}`,
      kind: "limitation" as const,
      text: limitation,
      authority: safety.authority,
      role: "safety_boundary" as const,
      sourceIds: [],
    })),
    {
      id: "combined-safety-boundary",
      kind: "safety_boundary",
      text: safety.boundaryTr,
      authority: safety.authority,
      role: "safety_boundary",
      sourceIds: [],
    },
  ]

  return makeResponse({
    route,
    outcome,
    classification,
    topic: stableUnique(responses.flatMap((response) => response.topic ? [response.topic] : []), 2).join(" · ") || null,
    intentId: null,
    summary: combinedSummary,
    details: responses.flatMap((response, index) => [
      `${index + 1}. ${response.topic ?? "Başlık"}: ${response.summary}`,
      ...response.details.slice(0, 2),
    ]),
    sources: combinedSources,
    caseEvidence: stableUnique(responses.flatMap((response) => response.caseEvidence), 6),
    limitations: combinedLimitations,
    safety,
    contextRequest,
    evidenceSummary: combinedEvidenceSummary(responses),
    suggestedQuestions: stableUnique(responses.flatMap((response) => response.suggestedQuestions), 4),
    answerUnits: combinedUnits,
  })
}

export function resolveDnaChat(request: DnaChatRequest): DnaChatResponse {
  const question = String(request?.question ?? "").trim()
  const safety = emptySafety(question)
  if (safety.blocked) return refusalResponse(safety)
  if (question.length < 2 || question.length > 600) {
    return clarificationResponse(
      safety,
      "Soru 2-600 karakter arasında olmalı ve en fazla iki açık başlığa odaklanmalıdır.",
    )
  }
  if (normalizeDnaChatText(question).replace(/\d/g, "").length < 2) {
    return clarificationResponse(
      safety,
      "Lütfen en az bir anlamlı kavram içeren kısa ve açık bir soru yazın.",
    )
  }

  const split = splitDnaChatQuestion(question)
  if (split.overflow) {
    return clarificationResponse(
      safety,
      "Tek mesajda en fazla iki soru ele alınabilir. Lütfen soruları iki ayrı mesaja bölün.",
    )
  }
  if (split.parts.length === 2) {
    const firstResponse = resolveSingleDnaChat(
      { ...request, question: split.parts[0] },
      split.parts[0],
      emptySafety(split.parts[0]),
    )
    const secondResponse = resolveSecondDnaChatQuestion(request, split.parts[1], firstResponse)
    return combineDnaChatResponses(
      [firstResponse, secondResponse],
      safety,
    )
  }
  return resolveSingleDnaChat(request, question, safety)
}

import { evaluateClaimGuard } from "../clinicalClaimRegistry"
import { redactReportTextForPrivacy } from "../reportPrivacy"
import { createDnaChatSafeCaseContext, hasUsableDnaCaseContext } from "./caseContext"
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
  type DnaChatDomainKey,
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
}): DnaChatResponse {
  const details = stableUnique((input.details ?? []).map(cleanOutput), 6)
  const sources = [...(input.sources ?? [])].slice(0, 4)
  const summary = cleanOutput(input.summary)
  const limitations = stableUnique((input.limitations ?? []).map(cleanOutput), 6)
  return {
    schemaVersion: DNA_CHAT_SCHEMA_VERSION,
    engineVersion: DNA_CHAT_ENGINE_VERSION,
    route: input.route ?? "unknown",
    outcome: input.outcome,
    classification: input.classification,
    topic: input.intent?.labelTr ?? null,
    intentId: input.intent?.id ?? null,
    summary,
    details,
    answerTr: [summary, ...details].filter(Boolean).join("\n\n"),
    sourceRefs: sources,
    sources,
    caseEvidence: stableUnique((input.caseEvidence ?? []).map(cleanOutput), 6),
    limitations,
    safetyBoundary: input.safety.boundaryTr,
    suggestedQuestions: stableUnique(input.suggestedQuestions ?? [], 4),
    safety: input.safety,
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

function theoryResponse(
  intent: DnaChatIntentDefinition,
  question: string,
  safety: DnaChatSafetyResult,
): DnaChatResponse {
  let sources = resolveDnaChatSources(intent.sourceIds)
  if (intent.id === "theory_literature") {
    const ranked = findDnaChatLiteratureSources(question, 2)
    sources = stableSources([...ranked, ...sources], 4)
  }
  const primary = sources[0]
  const summary = primary?.excerptTr ?? "Bu kavram için kilitli bilgi tabanında yeterli kaynak bulunamadı."
  const details = sources.slice(1, 3).map((source) => source.excerptTr)
  const classification: DnaChatClassification =
    intent.id === "theory_literature" ? "literature" : "dna_concept"
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

function stableSources(sources: readonly DnaChatSourceRef[], limit = 4): DnaChatSourceRef[] {
  const seen = new Set<string>()
  return sources.filter((source) => {
    if (seen.has(source.id)) return false
    seen.add(source.id)
    return true
  }).slice(0, limit)
}

const CHAT_BOUNDARY_LANGUAGE =
  /\b(?:uretmez|onermez|degildir|cikarilamaz|gostermez|saglamaz|yerine gecmez|olusturmaz|acilmaz|kapsam disidir)\b/
const CHAT_AFFIRMATIVE_UNSAFE_LANGUAGE =
  /\b(?:tani koyar|tani konur|tanisi vardir|tedavi edilmelidir|mudahale uygulanmalidir|ilac baslanmalidir|seans plani uygulanmalidir)\b/
const CHAT_PRACTICE_LANGUAGE =
  /\b(?:tedavi|mudahale|terapi|seans|ilac|recete|danismanlik|destek plani|uygulama yonergesi|program|protokol|egzersiz listesi|odev|seans akisi)\b/
const CHAT_DIRECTIVE_LANGUAGE =
  /\b(?:yapilmalidir|uygulanmalidir|baslanmalidir|verilmelidir|onerilmelidir|gerekir)\b/

function evaluateDnaChatClaimGuard(parts: readonly string[]) {
  const issues: ReturnType<typeof evaluateClaimGuard> = []
  const sentences = parts.flatMap((part) => String(part || "").split(/(?<=[.!?;])\s+/))
  for (const sentence of sentences) {
    if (!sentence.trim()) continue
    const normalized = normalizeDnaChatText(sentence)
    const affirmativeUnsafe = CHAT_AFFIRMATIVE_UNSAFE_LANGUAGE.test(normalized)
    const directivePractice =
      CHAT_PRACTICE_LANGUAGE.test(normalized) && CHAT_DIRECTIVE_LANGUAGE.test(normalized)
    if (CHAT_BOUNDARY_LANGUAGE.test(normalized) && !affirmativeUnsafe && !directivePractice) {
      continue
    }
    if (affirmativeUnsafe || directivePractice) {
      issues.push({
        code: "chat_practice_direction_claim",
        severity: "critical",
        message: "Sohbet yanıtında uygulama veya yönlendirme çağrışımı yapan ifade bulunmamalı.",
        evidence: sentence.trim(),
      })
      continue
    }
    issues.push(...evaluateClaimGuard(sentence).filter((issue) => issue.severity === "critical"))
  }
  return issues
}

function caseSource(id: string, title: string, excerpt: string): DnaChatSourceRef {
  return {
    id: `case:${id}`,
    type: "case",
    title,
    labelTr: "Açık kimliksiz vaka bağlamı",
    excerptTr: cleanOutput(excerpt),
    claimBoundary: "Yalnız açık vakada bulunan kimliksiz veri; başka vakalara genellenmez.",
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
  const levelBased = scoreRows(context)
    .filter((entry) => entry.level === "Riskli" || entry.level === "Atipik")
    .map((entry) => entry.label)
  if (levelBased.length) return levelBased
  return scoreRows(context)
    .filter((entry) => entry.score !== undefined)
    .sort((left, right) => Number(left.score) - Number(right.score) || left.domain.localeCompare(right.domain))
    .slice(0, 2)
    .map((entry) => entry.label)
}

function strongDomainLabels(context: DnaChatSafeCaseContext): string[] {
  if (context.chatContext.strongDomains.length) return context.chatContext.strongDomains
  const levelBased = scoreRows(context)
    .filter((entry) => entry.level === "Tipik")
    .map((entry) => entry.label)
  if (levelBased.length) return levelBased
  return scoreRows(context)
    .filter((entry) => entry.score !== undefined)
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
    const strong = strongDomainLabels(context)
    const axis = context.chatContext.primaryAxis
    const summary = axis
      ? `Açık vaka bağlamındaki ana çalışma hipotezi: ${axis}`
      : weak.length
        ? `Açık vaka bağlamında göreli zorlanma ${weak.slice(0, 2).join(" ve ")} çevresinde yoğunlaşıyor.`
        : "Açık vaka bağlamında genel örüntüyü özetlemek için yeterli alan bilgisi bulunmuyor."
    const evidence = context.chatContext.evidence.slice(0, 3)
    const details = [
      context.chatContext.mechanismSummary ?? "",
      strong.length ? `Göreli korunmuş kapasiteler: ${strong.slice(0, 3).join(", ")}.` : "",
      ...evidence,
    ].filter(Boolean)
    return {
      available: Boolean(axis || weak.length || evidence.length),
      summary,
      details,
      evidence,
      limitations: [...context.chatContext.limitations, standardLimit],
      sources: stableSources([
        ...(axis ? [caseSource("primary-axis", "Vaka ana ekseni", axis)] : []),
        ...evidence.slice(0, 2).map((line, index) => caseSource(`evidence-${index + 1}`, "Vaka kanıt satırı", line)),
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
      details: [context.chatContext.mechanismLabel ?? "", context.chatContext.mechanismSummary ?? "", ...evidence].filter(Boolean),
      evidence,
      limitations: [...context.chatContext.limitations, standardLimit],
      sources: stableSources([
        ...(axis ? [caseSource("primary-axis", "Vaka ana ekseni", axis)] : []),
        ...clinicalSources,
      ]),
    }
  }

  if (intent.id === "case_weak_domains" || intent.id === "case_strengths") {
    const weak = intent.id === "case_weak_domains"
    const labels = weak ? weakDomainLabels(context) : strongDomainLabels(context)
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
        ...(labels.length ? [caseSource(weak ? "weak-domains" : "strong-domains", intent.labelTr, labels.join(", "))] : []),
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
        ...(lines.length ? [caseSource("domain-scores", "Vaka alan skorları", lines.join(" "))] : []),
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
        ...(list.values.length ? [caseSource(intent.id, list.title, list.values.join(" "))] : []),
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
        ...(confidence ? [caseSource("confidence", "Vaka veri güveni", confidence)] : []),
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
        ...evidence.map((line, index) => caseSource(`evidence-${index + 1}`, "Vaka kanıt satırı", line)),
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
        ...(dataPieces.length ? [caseSource(`domain-${intent.domain}`, `${label} vaka kaydı`, dataPieces.join(", "))] : []),
        ...evidence.slice(0, 2).map((line, index) => caseSource(`${intent.domain}-evidence-${index + 1}`, `${label} vaka bulgusu`, line)),
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

export function resolveDnaChat(request: DnaChatRequest): DnaChatResponse {
  const question = String(request?.question ?? "").trim()
  const safety = emptySafety(question)
  if (safety.blocked) return refusalResponse(safety)
  if (question.length < 2 || question.length > 600) {
    return clarificationResponse(
      safety,
      "Soru 2-600 karakter arasında olmalı ve tek bir açık başlığa odaklanmalıdır.",
    )
  }

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
      })
    }
    if (caseContext.redactionCount > 0) {
      return refusalResponse({
        blocked: true,
        category: "unsafe_case_context",
        code: "identifier_in_case_context",
        redactedQuestion: "",
        boundaryTr: "Vaka bağlamında doğrudan tanımlayıcı veya güvenli sözleşme dışında veri saptandı. Kimlik bilgilerini kaldırın.",
      })
    }
  }

  const routed = routeDnaChatQuestion({
    question,
    mode: request.mode,
    previousTopic: request.previousTopic,
    hasCaseContext: Boolean(caseContext && hasUsableDnaCaseContext(caseContext)),
  })
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
  if (!caseContext) {
    return notAvailableResponse(
      safety,
      routed.intent,
      "Vaka tartışması için açık ve kimliksiz bir DNA rapor bağlamı seçilmelidir.",
    )
  }
  if (!hasUsableDnaCaseContext(caseContext)) {
    return notAvailableResponse(
      safety,
      routed.intent,
      "Bu raporda sohbet için yeterli yapılandırılmış veri yok.",
    )
  }
  return guardedCaseResponse(routed.intent, question, caseContext, safety)
}

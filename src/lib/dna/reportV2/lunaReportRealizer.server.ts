import "server-only"

import type {
  ReportRealization,
  ReportRealizationSection,
  ReportRealizer,
  ReportRealizerAttempt,
  ReportRealizerRequest,
  ReportSectionId,
} from "./contracts"
import { stableHash } from "./evidenceEngine"

export const DNA_REPORT_LUNA_MODEL = "gpt-5.6-luna" as const
export const DNA_REPORT_LUNA_REALIZER_VERSION = "dna-report-v2.3-luna-realizer@12-preprod-source-surface" as const
export const DNA_REPORT_LUNA_PRICING_VERSION = "gpt-5.6-luna-pricing@2026-08-07" as const
const RESPONSES_URL = "https://api.openai.com/v1/responses"
const REQUEST_TIMEOUT_MS = 30_000
const MAX_OUTPUT_TOKENS = 1_800

type FetchLike = typeof fetch

function nonNegativeInteger(value: unknown) {
  return Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : 0
}

function usage(payload: unknown) {
  const row = payload && typeof payload === "object" ? payload as Record<string, unknown> : {}
  const raw = row.usage && typeof row.usage === "object" ? row.usage as Record<string, unknown> : {}
  const details = raw.input_tokens_details && typeof raw.input_tokens_details === "object" ? raw.input_tokens_details as Record<string, unknown> : {}
  const inputTokens = nonNegativeInteger(raw.input_tokens)
  const cachedInputTokens = Math.min(inputTokens, nonNegativeInteger(details.cached_tokens))
  const outputTokens = nonNegativeInteger(raw.output_tokens)
  const regularInputTokens = inputTokens - cachedInputTokens
  const costMicrousd = regularInputTokens + Math.ceil(cachedInputTokens / 10) + outputTokens * 6
  return Object.freeze({ inputTokens, cachedInputTokens, outputTokens, costMicrousd })
}

function responseText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null
  const row = payload as Record<string, unknown>
  if (typeof row.output_text === "string" && row.output_text.trim()) return row.output_text.trim()
  if (!Array.isArray(row.output)) return null
  for (const output of row.output) {
    if (!output || typeof output !== "object") continue
    const content = (output as Record<string, unknown>).content
    if (!Array.isArray(content)) continue
    for (const item of content) {
      if (!item || typeof item !== "object") continue
      const text = (item as Record<string, unknown>).text
      if (typeof text === "string" && text.trim()) return text.trim()
    }
  }
  return null
}

function realizationSchema(request: ReportRealizerRequest) {
  const sectionIds = request.plan.sections.map((section) => section.id)
  const claimIds = request.plan.claims.map((claim) => claim.id)
  return {
    type: "object",
    additionalProperties: false,
    required: ["version", "unsupportedAddition", "unsupportedSectionIds", "sections"],
    properties: {
      version: { type: "string", enum: ["report-realization@2"] },
      unsupportedAddition: {
        type: "boolean",
        description: "Yalnız final metinde usedClaimIds ile izlenemeyen klinik veya bilimsel bir iddia bırakıldıysa true. Doğal bağlaç, kısaltma ve anlamı koruyan paraphrase ek iddia değildir.",
      },
      unsupportedSectionIds: {
        type: "array",
        minItems: 0,
        maxItems: 8,
        items: { type: "string", enum: sectionIds },
        description: "unsupportedAddition=true ise izlenemeyen ifadenin bulunduğu her bölüm; false ise boş dizi.",
      },
      sections: {
        type: "array",
        minItems: 8,
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["sectionId", "text", "usedClaimIds"],
          properties: {
            sectionId: { type: "string", enum: sectionIds },
            text: { type: "string", minLength: 1, maxLength: 10_000 },
            usedClaimIds: { type: "array", minItems: 0, maxItems: 40, items: { type: "string", enum: claimIds } },
          },
        },
      },
    },
  }
}

function validateRealization(value: unknown, sectionIds: readonly ReportSectionId[]): ReportRealization | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  if (row.version !== "report-realization@2" || typeof row.unsupportedAddition !== "boolean" || !Array.isArray(row.unsupportedSectionIds) || !Array.isArray(row.sections)) return null
  if (row.unsupportedSectionIds.some((id) => !sectionIds.includes(id as ReportSectionId)) || (row.unsupportedAddition ? row.unsupportedSectionIds.length === 0 : row.unsupportedSectionIds.length > 0)) return null
  const sections: ReportRealizationSection[] = []
  for (const item of row.sections) {
    if (!item || typeof item !== "object") return null
    const section = item as Record<string, unknown>
    if (!sectionIds.includes(section.sectionId as ReportSectionId) || typeof section.text !== "string" || !Array.isArray(section.usedClaimIds) || section.usedClaimIds.some((id) => typeof id !== "string")) return null
    sections.push(Object.freeze({ sectionId: section.sectionId as ReportSectionId, text: section.text.trim(), usedClaimIds: Object.freeze(section.usedClaimIds as string[]) }))
  }
  if (sections.length !== 8 || new Set(sections.map((section) => section.sectionId)).size !== 8) return null
  return Object.freeze({ version: "report-realization@2", unsupportedAddition: row.unsupportedAddition, unsupportedSectionIds: Object.freeze(row.unsupportedSectionIds as ReportSectionId[]), sections: Object.freeze(sections) })
}

function lockedRealizerPayload(request: ReportRealizerRequest) {
  const allowedClaimIds = new Set(request.plan.sections.flatMap((section) => section.allowedClaimIds))
  return Object.freeze({
    version: request.plan.version,
    subjectAgeMonths: request.plan.subjectAgeMonths,
    decisionState: request.plan.decisionState,
    primaryFormulationId: request.plan.primaryFormulationId,
    primaryDecisionClaimId: request.plan.primaryDecisionClaimId,
    confidence: request.plan.confidence,
    literatureMode: request.plan.literatureMode,
    prohibitedInferences: request.plan.prohibitedInferences,
    caseEvidenceSourceMatrix: request.plan.caseEvidenceSourceMatrix,
    sections: request.plan.sections.map((section) => Object.freeze({
      id: section.id,
      heading: section.heading,
      requiredClaimIds: section.requiredClaimIds,
      importantClaimIds: section.importantClaimIds,
      optionalClaimIds: section.optionalClaimIds,
      allowedClaimIds: section.allowedClaimIds,
      limitations: section.limitations,
    })),
    claims: request.plan.claims.filter((claim) => allowedClaimIds.has(claim.id)).map((claim) => Object.freeze({
      id: claim.id,
      role: claim.role,
      text: claim.text,
      sufficiency: claim.sufficiency,
      formulationId: claim.formulationId,
      materiality: claim.materiality,
      claimType: claim.claimType,
      knowledgeAuthority: claim.knowledgeAuthority,
      sourceIds: claim.sourceIds,
    })),
  })
}

function instructions(request: ReportRealizerRequest) {
  return [
    "LockedReportPlan tek klinik içerik otoritesidir. Yeni bulgu, sayı, test, tanı, mekanizma, nedensellik, öneri, kaynak, günlük yaşam ayrıntısı veya destek biçimi ekleme; kesinliği artırma.",
    "Yalnız bölümün allowedClaimIds değerlerini kullan. Her requiredClaimIds id'sini metinde gerçekleştir ve usedClaimIds içinde bildir; importantClaimIds klinik anlamı koruyorsa kullan, optionalClaimIds zorunlu değildir.",
    "Her final cümle kullandığın claim'lerin semantik alt kümesi olsun. İzlenemeyen cümleyi çıkar; hepsi izlenebiliyorsa unsupportedAddition=false ve unsupportedSectionIds=[] yaz.",
    "Teknik terimleri aynen koru: self-regülasyon, interosepsiyon, arousal, reaktivite, toparlanma, duyusal regülasyon, fizyolojik regülasyon, bilişsel regülasyon, yürütücü işlev. Self-regülasyonu öz düzenleme diye yazma.",
    "Detaylı fakat tekrarsız, deneyimli bir ergoterapistin meslektaşına yazacağı doğal Türkçe kullan. Klinik skor, anamnez ve gözlem rolü, dış test, günlük yaşam anlamı, gerçek ayrışma, bağlamsal değişkenlik, korunmuş yön, karar sınırı ve gerekli bilimsel açıklamayı kısaltma amacıyla çıkarma.",
    "Cümlelerde özne ve eylem açık olsun. Teknik terimi koru fakat sistem dili, edilgen zincir, belirsiz özne ve akademik dolgu kullanma. Aynı anlamı bölüm içinde veya bölümler arasında yeniden anlatma.",
    "Şu internal veya makine dili görünmesin: OWNER_BOOK_INTERPRETATION, GENERAL_SCIENTIFIC_INTERPRETATION, CASE_EVIDENCE, claim, locked, primary, candidate, decision state, evidence node, relation edge, formülasyon odağı, bu görünüm, klinik eksen, ayrışma kümesi, bağımsız bilgi kanalı, yakınsama, korunmuş kapasite.",
    "'Bu bulgular rapordaki önceliği değiştirmek için yeterli değildir', 'Bu sonuca duyulan güven ... düzeydedir', 'alanındaki becerilerin korunduğunu gösteren bulgular vardır' ve 'günlük yaşam açısından izlenecek ilk alanı oluşturuyor' kalıplarını kullanma; aynı anlam ve kesinliği doğal cümleyle yaz.",
    "Korunmuş veya destekli performansı güçlük yok diye genelleme. Plan vaka-özgü işlev güçlüğü bildirmiyorsa tipik ya da korunmuş alan için varsayımsal güçlük ekleme.",
    "Bölüm 2 yalnız bulguları verir: eşik yöntemini bir kez yaz, altı alanı '- Alan: puan/50 — sınıflama' biçiminde listele, en fazla iki kısa dağılım cümlesi ekle; günlük yaşam yorumu yapma.",
    "Bölüm 3 bulgu → günlük yaşam karşılığı → destekleyen vaka bilgisi → varsa bağlamsal sınır sırasını izlesin. Aynı güçlüğü genel bulgu ve bakım veren cümlesiyle art arda tekrarlama; kaynak rolünü koruyarak birleştir. Somut aktivite claim'de yoksa uydurma.",
    "Bölüm 4'te alanın neden öne çıktığını, diğer bulguların yorumu nasıl sınırladığını ve alternatifin neden daha zayıf kaldığını normal klinik Türkçeyle anlat; candidate/priority dili kullanma.",
    "Gerçek CONFLICTED ayrışmayı silme. Bölüm 5'te hangi kaynakların uyumlu, hangisinin farklı olduğunu claim'lerin izin verdiği ölçüde açık söyle ve farkın kesinliği nasıl sınırladığını bir kez belirt; hem tümü uyumlu hem uyumsuz deme.",
    "caseEvidenceSourceMatrix.canonicalRelations her source pair + construct için tek ilişki otoritesidir. Sections 1–7 boyunca aynı çift ve aynı construct için yalnız oradaki SUPPORTS, DISAGREES, PARTIALLY_SUPPORTS, NOT_COMPARABLE veya MISSING anlamını kullan; farklı bir ilişki ima etme.",
    "Türkçe ek ve öbek uyumunu son kez denetle: nesne olan güçlük/bulgu/görünüm sözcüğünü belirtme durumuyla kur, tekil-sıfat ve çoğul adları karıştırma, da/de bağlacını son ünlüyle uyumlu yaz, birleşik ad ve ek-fiil eklerini bozma. 'alanındaki güçlük destekliyor' gibi özne-nesne belirsizliği bırakma.",
    "OWNER_BOOK içeriği yalnız genel bilimsel açıklamadır; vaka kararı, yeni vaka bulgusu veya güven kanıtı değildir. Doğrudan kopyalama, vakayla ilişkili doğal cümleye dönüştür. NON_MATERIAL ve vaka kararına katkısız geniş teoriyi yazma.",
    "Bölüm 8'de önce kısa bilimsel açıklama ve metin içi citation ver; tam bibliyografiyi sonda tek Kaynaklar listesinde topla. Aynı kaynağı iki kez tanıtma, kaynakları vaka kararının kanıtı gibi sunma.",
    "Bölüm 8'de claim.literature.* içindeki citation-backed bilimsel cümleyi sözcük eklemeden, daraltmadan veya genişletmeden aynen kullan. Bu cümle verified claim ve exact passage sınırına kilitlidir; topic benzerliğine dayalı yeni kaynak ya da bilimsel ifade ekleme.",
    "Rapor tedavi veya uygulama önerisi sunmaz. planlanmalıdır, uygulanmalıdır, kullanılmalıdır, önerilir ve yapılmalıdır biçimindeki prescriptive cümleleri hiçbir bölümde yazma.",
    "Dilbilgisini, bağımsız yüklemli cümleyi, noktalama işaretlerini ve anlam tutarlılığını denetle. Fragment, yetim tırnak, bozuk/yinelenen ek, birleşmiş cümle üretme; URL'leri https:// veya http:// biçiminde koru.",
    "Başlıkları section text içine yazma. Ham anamnez, kişi adı, kod, e-posta, telefon veya başka PII üretme.",
    request.attempt === "repair"
      ? `Önceki aday şu doğrulama kodlarında başarısız oldu: ${request.validationFailureCodes.join(", ")}. Yalnız bu ihlalleri düzelt. Önceki unsupportedAddition değerini kopyalama; her cümleyi yeniden denetle, izlenemeyen ifadeyi sil ve ancak finalde hâlâ izlenemeyen bir iddia kalıyorsa true bildir.`
      : "Bu ilk ve normal realization çağrısıdır.",
  ].join(" ")
}

export class LunaReportRealizer implements ReportRealizer {
  readonly identity = Object.freeze({
    provider: "luna" as const,
    model: DNA_REPORT_LUNA_MODEL,
    implementationVersion: DNA_REPORT_LUNA_REALIZER_VERSION,
  })

  private spentMicrousd = 0

  constructor(private readonly options: Readonly<{
    apiKey?: string
    safetyIdentifier?: string | null
    fetchImpl?: FetchLike
    maxTotalCostMicrousd?: number
  }> = {}) {}

  get totalCostMicrousd() {
    return this.spentMicrousd
  }

  async realize(request: ReportRealizerRequest): Promise<ReportRealizerAttempt> {
    const content = JSON.stringify({
      plan: lockedRealizerPayload(request),
      validationFailureCodes: request.validationFailureCodes,
      previousCandidate: request.attempt === "repair" ? request.previousCandidate : null,
    })
    const promptHash = stableHash({ model: DNA_REPORT_LUNA_MODEL, schema: realizationSchema(request), instructions: instructions(request), content })
    const apiKey = this.options.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim()
    if (!apiKey) return Object.freeze({ ...this.identity, attempt: request.attempt, realization: null, rawOutput: null, responseId: null, usage: Object.freeze({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0 }), latencyMs: 0, promptHash })
    const requestBody = {
      model: DNA_REPORT_LUNA_MODEL,
      store: false,
      reasoning: { effort: "none" },
      ...(this.options.safetyIdentifier ? { safety_identifier: this.options.safetyIdentifier } : {}),
      instructions: instructions(request),
      input: content,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      text: { verbosity: "low", format: { type: "json_schema", name: "dna_report_v2_realization", strict: true, schema: realizationSchema(request) } },
    }
    const conservativeCallCeilingMicrousd = Buffer.byteLength(JSON.stringify(requestBody), "utf8") + MAX_OUTPUT_TOKENS * 6 + 5_000
    if (Number.isFinite(this.options.maxTotalCostMicrousd) && this.spentMicrousd + conservativeCallCeilingMicrousd > Number(this.options.maxTotalCostMicrousd)) {
      return Object.freeze({ ...this.identity, attempt: request.attempt, realization: null, rawOutput: null, responseId: null, usage: Object.freeze({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0 }), latencyMs: 0, promptHash })
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    const started = performance.now()
    try {
      const response = await (this.options.fetchImpl ?? fetch)(RESPONSES_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })
      if (!response.ok) return Object.freeze({ ...this.identity, attempt: request.attempt, realization: null, rawOutput: null, responseId: null, usage: Object.freeze({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0 }), latencyMs: performance.now() - started, promptHash })
      const payload = await response.json() as unknown
      const rawOutput = responseText(payload)
      let parsed: unknown = null
      try { parsed = rawOutput ? JSON.parse(rawOutput) : null } catch { parsed = null }
      const realization = validateRealization(parsed, request.plan.sections.map((section) => section.id))
      const row = payload && typeof payload === "object" ? payload as Record<string, unknown> : {}
      const measuredUsage = usage(payload)
      this.spentMicrousd += measuredUsage.costMicrousd
      return Object.freeze({
        ...this.identity,
        attempt: request.attempt,
        realization,
        rawOutput,
        responseId: typeof row.id === "string" ? row.id : null,
        usage: measuredUsage,
        latencyMs: performance.now() - started,
        promptHash,
      })
    } catch {
      return Object.freeze({ ...this.identity, attempt: request.attempt, realization: null, rawOutput: null, responseId: null, usage: Object.freeze({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0 }), latencyMs: performance.now() - started, promptHash })
    } finally {
      clearTimeout(timeout)
    }
  }
}

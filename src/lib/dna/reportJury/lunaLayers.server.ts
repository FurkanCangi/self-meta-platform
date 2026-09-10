import "server-only"

import { stableHash } from "../reportV2/evidenceEngine"
import type {
  AIClinicalCritic,
  ClinicalCriticFindingType,
  ClinicalCriticResult,
  JuryLanguageRealization,
  JuryLanguageRealizer,
  JuryLockedLanguagePlan,
  JuryReportSectionId,
} from "./contracts"
import { DNA_REPORT_JURY_VERSION } from "./contracts"

export const DNA_REPORT_JURY_LUNA_MODEL = "gpt-5.6-luna" as const
export const DNA_REPORT_JURY_LUNA_VERSION = "dna-report-jury-luna-layers@1" as const
const RESPONSES_URL = "https://api.openai.com/v1/responses"
const MAX_REALIZER_OUTPUT_TOKENS = 2_400
const MAX_CRITIC_OUTPUT_TOKENS = 900

type FetchLike = typeof fetch

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
      const value = item && typeof item === "object" ? (item as Record<string, unknown>).text : null
      if (typeof value === "string" && value.trim()) return value.trim()
    }
  }
  return null
}

function parseJson(payload: unknown): unknown {
  const text = responseText(payload)
  if (!text) return null
  try { return JSON.parse(text) } catch { return null }
}

async function requestJson(options: Readonly<{
  apiKey?: string
  fetchImpl?: FetchLike
  safetyIdentifier?: string | null
  instructions: string
  input: unknown
  schemaName: string
  schema: Record<string, unknown>
  maxOutputTokens: number
}>): Promise<unknown> {
  const apiKey = options.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return null
  const response = await (options.fetchImpl ?? fetch)(RESPONSES_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: DNA_REPORT_JURY_LUNA_MODEL,
      store: false,
      reasoning: { effort: "none" },
      ...(options.safetyIdentifier ? { safety_identifier: options.safetyIdentifier } : {}),
      instructions: options.instructions,
      input: JSON.stringify(options.input),
      max_output_tokens: options.maxOutputTokens,
      text: { verbosity: "low", format: { type: "json_schema", name: options.schemaName, strict: true, schema: options.schema } },
    }),
  })
  if (!response.ok) return null
  return parseJson(await response.json())
}

function realizerSchema(plan: JuryLockedLanguagePlan) {
  const sectionIds = plan.sections.map((section) => section.id)
  const paragraphIds = plan.sections.flatMap((section) => section.paragraphs.map((paragraph) => paragraph.id))
  return {
    type: "object",
    additionalProperties: false,
    required: ["sections"],
    properties: {
      sections: {
        type: "array",
        minItems: 5,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "text", "usedParagraphIds"],
          properties: {
            id: { type: "string", enum: sectionIds },
            text: { type: "string", minLength: 1, maxLength: 15_000 },
            usedParagraphIds: { type: "array", minItems: 1, maxItems: 40, items: { type: "string", enum: paragraphIds } },
          },
        },
      },
    },
  }
}

function parseRealization(value: unknown, plan: JuryLockedLanguagePlan): JuryLanguageRealization | null {
  if (!value || typeof value !== "object" || !Array.isArray((value as Record<string, unknown>).sections)) return null
  const allowedSections = new Set(plan.sections.map((section) => section.id))
  const sections = (value as Record<string, unknown>).sections as unknown[]
  if (sections.length !== plan.sections.length) return null
  const parsed = sections.flatMap((value) => {
    if (!value || typeof value !== "object") return []
    const row = value as Record<string, unknown>
    if (!allowedSections.has(row.id as JuryReportSectionId) || typeof row.text !== "string" || !Array.isArray(row.usedParagraphIds) || row.usedParagraphIds.some((id) => typeof id !== "string")) return []
    return [Object.freeze({ id: row.id as JuryReportSectionId, text: row.text.trim(), usedParagraphIds: Object.freeze(row.usedParagraphIds as string[]) })]
  })
  if (parsed.length !== plan.sections.length || new Set(parsed.map((section) => section.id)).size !== plan.sections.length) return null
  return Object.freeze({ sections: Object.freeze(parsed) })
}

export class LunaJuryLanguageRealizer implements JuryLanguageRealizer {
  readonly identity = Object.freeze({ provider: "luna" as const, model: DNA_REPORT_JURY_LUNA_MODEL, version: DNA_REPORT_JURY_LUNA_VERSION })
  readonly promptHash: string
  constructor(private readonly options: Readonly<{ apiKey?: string; fetchImpl?: FetchLike; safetyIdentifier?: string | null }> = {}) {
    this.promptHash = stableHash({ version: DNA_REPORT_JURY_LUNA_VERSION, layer: "language" })
  }
  async realize(plan: JuryLockedLanguagePlan): Promise<JuryLanguageRealization | null> {
    const payload = Object.freeze({
      version: plan.version,
      overallClassification: plan.overallClassification,
      primaryFormulationId: plan.primaryFormulationId,
      forbiddenClaims: plan.forbiddenClaims,
      sections: plan.sections,
    })
    const value = await requestJson({
      ...this.options,
      instructions: [
        "Bu kilitli plan tek klinik içerik otoritesidir. Her paragrafın anlamını ve kesinliğini koru; hiçbir sayı, bulgu, test, tanı, mekanizma, nedensellik, tedavi veya bilimsel sonuç ekleme.",
        "Beş başlığı değiştirme ve başlıkları text alanına yazma. Her paragrafı yalnız aynı bölümde doğal, kısa ve profesyonel Türkçeyle ifade et.",
        "Her kullanılan plan paragrafının id değerini usedParagraphIds alanında bildir. Plan paragrafı atlama, başka bölümde kullanma veya yeni paragraf üretme.",
        "self-regülasyon, interosepsiyon, arousal, reaktivite, toparlanma, duyusal regülasyon, fizyolojik regülasyon, bilişsel regülasyon ve yürütücü işlev terimlerini koru.",
        "Ham anamnez, kişi adı, kimlik, e-posta, telefon, adres veya başka PII isteme ve üretme.",
      ].join(" "),
      input: payload,
      schemaName: "dna_report_jury_language",
      schema: realizerSchema(plan),
      maxOutputTokens: MAX_REALIZER_OUTPUT_TOKENS,
    })
    return parseRealization(value, plan)
  }
}

const CRITIC_TYPES: readonly ClinicalCriticFindingType[] = [
  "CLASSIFICATION_INCONSISTENCY", "EXTERNAL_EVIDENCE_OMISSION", "INVALID_EXTERNAL_EVIDENCE_USE",
  "UNSUPPORTED_FUNCTIONAL_INFERENCE", "PRESERVED_CAPACITY_OMISSION", "MAJOR_LIMITATION_OMISSION",
  "UNSUPPORTED_CAUSALITY", "OVERSTATEMENT", "INTERNAL_INCONSISTENCY",
]

export class LunaClinicalCritic implements AIClinicalCritic {
  readonly identity = Object.freeze({ provider: "luna" as const, model: DNA_REPORT_JURY_LUNA_MODEL, version: DNA_REPORT_JURY_LUNA_VERSION })
  constructor(private readonly options: Readonly<{ apiKey?: string; fetchImpl?: FetchLike; safetyIdentifier?: string | null }> = {}) {}
  async review(input: Parameters<AIClinicalCritic["review"]>[0]): Promise<ClinicalCriticResult | null> {
    const value = await requestJson({
      ...this.options,
      instructions: "Yalnız kilitli karar ile final rapor arasındaki tutarsızlıkları denetle. Kararı değiştirme, yeni klinik yorum üretme ve düzeltme metni yazma. Yalnız yapılandırılmış bulgu döndür. PII isteme veya üretme.",
      input,
      schemaName: "dna_report_jury_critic",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["status", "findings"],
        properties: {
          status: { type: "string", enum: ["pass", "review_required"] },
          findings: {
            type: "array",
            maxItems: 30,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["type", "severity", "message"],
              properties: {
                type: { type: "string", enum: CRITIC_TYPES },
                severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
                message: { type: "string", minLength: 1, maxLength: 500 },
              },
            },
          },
        },
      },
      maxOutputTokens: MAX_CRITIC_OUTPUT_TOKENS,
    })
    if (!value || typeof value !== "object") return null
    const row = value as Record<string, unknown>
    if (!(["pass", "review_required"] as const).includes(row.status as "pass" | "review_required") || !Array.isArray(row.findings)) return null
    const findings = row.findings.flatMap((value) => {
      if (!value || typeof value !== "object") return []
      const finding = value as Record<string, unknown>
      if (!CRITIC_TYPES.includes(finding.type as ClinicalCriticFindingType) || !(["low", "medium", "high", "critical"] as const).includes(finding.severity as "low" | "medium" | "high" | "critical") || typeof finding.message !== "string") return []
      return [Object.freeze({ type: finding.type as ClinicalCriticFindingType, severity: finding.severity as "low" | "medium" | "high" | "critical", message: finding.message })]
    })
    if (findings.length !== row.findings.length) return null
    return Object.freeze({ status: row.status as "pass" | "review_required", findings: Object.freeze(findings) })
  }
}

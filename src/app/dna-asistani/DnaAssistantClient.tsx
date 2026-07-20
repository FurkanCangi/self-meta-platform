"use client"

import {
  ArrowUp,
  ChevronDown,
  CircleAlert,
  FileSearch,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { useAppSurface } from "@/app/components/app-shell/useAppSurface"
import {
  canBeginDnaChatReportSelection,
  createDnaChatReportSelectionCoordinator,
  planDnaChatReportTransition,
} from "@/lib/dna/chat/conversationPolicy"
import {
  DNA_INTELLIGENCE_AUDIT_NOTICE_TR,
  DNA_INTELLIGENCE_COMPOSER_NOTICE_TR,
  DNA_INTELLIGENCE_PUBLIC_INTENDED_USE,
  DNA_INTELLIGENCE_REPORT_OWNERSHIP_NOTICE_TR,
  DNA_INTELLIGENCE_TAGLINE_TR,
  type DnaIntelligencePublicIntendedUse,
} from "@/lib/dna/chat/intendedUse"
import { DNA_CHAT_STARTER_QUESTIONS } from "@/lib/dna/chat/suggestions"
import DnaIssueFeedback from "./DnaIssueFeedback"

type DnaChatClassification =
  | "dna_concept"
  | "literature"
  | "case_finding"
  | "hypothesis"
  | "clarification"
  | "not_available"
  | "refusal"

type ResponseDepth = "short" | "standard" | "deep"

type ReportOption = {
  id: string
  clientCode: string
  createdAt: string | null
  version: number | null
  ageBand: string | null
}

type KnowledgeAuthority = {
  contractVersion: string
  layer:
    | "dna_product_information"
    | "external_scientific_information"
    | "case_information"
    | "safety_and_product_boundaries"
  labelTr: string
  approvalRequirement: string
  verificationStatus: "pending" | "verified" | "test_only"
  releaseEligible: boolean
  boundaryTr?: string
}

type V3AnswerSection =
  | "definition"
  | "function_or_relation"
  | "development"
  | "measurement"
  | "evidence_status"
  | "counter_evidence"
  | "dna_boundary"
  | "case_context"
  | "case_finding"
  | "case_missing"
  | "general_literature"
  | "case_non_inference"
  | "preserved_capacity"
  | "boundary"

type AnswerUnit = {
  id: string
  section: V3AnswerSection | null
  kind: "summary" | "detail" | "case_evidence" | "limitation" | "safety_boundary"
  role:
    | "product_definition"
    | "scientific_evidence"
    | "dna_specific_validation"
    | "case_finding"
    | "safety_boundary"
  text: string
  authority: KnowledgeAuthority
  claimIds: string[]
  passageIds: string[]
  sourceIds: string[]
  citationCardIds: string[]
}

type DnaValidationStatus =
  | "product_definition"
  | "supported_relation"
  | "conceptual_proximity"
  | "theory_only"
  | "not_established"
  | "contradicted"
  | "not_applicable"

type SourceRef = {
  id: string
  sourceId?: string
  type?: string
  title?: string
  labelTr?: string
  excerpt?: string
  excerptTr?: string
  citation?: string
  publicationYear?: number
  year?: number
  doi?: string | null
  url?: string
  claimBoundary?: string
  ageScope?: string
  studyType?: string
  sampleScope?: string
  authors?: string
  sourceType?: string
  officialUrl?: string
  locator?: string
  evidenceLevel?: string
  supportedClaim?: string
  knownBoundary?: string
  supportedBoundary?: string
  authority?: KnowledgeAuthority
}

type ContextRequest = {
  type: "report"
  preferNewest: boolean
}

type EvidenceSummary = {
  level: string
  scientificEvidenceLevel?: string
  dnaValidationStatus?: DnaValidationStatus
  ageScope: string
  sampleScope: string
  boundary: string
}

type DnaAnswer = {
  requestId: string
  responseDepth: ResponseDepth
  runtimeGeneration: "v2_legacy" | "v3"
  classification: DnaChatClassification
  summary: string
  details: string[]
  sources: SourceRef[]
  caseEvidence: string[]
  limitations: string[]
  safetyBoundary: string
  intendedUse: DnaIntelligencePublicIntendedUse
  suggestedQuestions: string[]
  engineVersion: string
  catalogVersion: string
  packageVersion: string
  packageSha256: string | null
  topic: string | null
  contextRequest?: ContextRequest
  evidenceSummary?: EvidenceSummary
  authoritySummary: KnowledgeAuthority[]
  answerUnits: AnswerUnit[]
}

type ChatMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; answer: DnaAnswer }

const STARTER_QUESTIONS = [
  DNA_CHAT_STARTER_QUESTIONS.theory[0],
  DNA_CHAT_STARTER_QUESTIONS.dna[0],
  DNA_CHAT_STARTER_QUESTIONS.theory[1],
  DNA_CHAT_STARTER_QUESTIONS.dna[1],
  DNA_CHAT_STARTER_QUESTIONS.case[0],
  DNA_CHAT_STARTER_QUESTIONS.case[1],
].filter((question): question is string => Boolean(question))

const RESPONSE_DEPTH_OPTIONS: ReadonlyArray<{
  value: ResponseDepth
  label: string
  description: string
}> = [
  { value: "short", label: "Kısa", description: "Ana tanım ve temel sınır" },
  { value: "standard", label: "Standart", description: "Özet, ilişki ve kanıt sınırı" },
  { value: "deep", label: "Derin", description: "Daha fazla onaylı ayrıntı ve kaynak" },
]

const RESPONSE_DEPTH_LABEL: Record<ResponseDepth, string> = {
  short: "Kısa yanıt",
  standard: "Standart yanıt",
  deep: "Derin yanıt",
}

const CLASSIFICATION_META: Record<DnaChatClassification, { label: string; className: string }> = {
  dna_concept: { label: "DNA Kavramı", className: "border-blue-200 bg-blue-50 text-blue-700" },
  literature: { label: "Literatür", className: "border-violet-200 bg-violet-50 text-violet-700" },
  case_finding: { label: "Rapor Bulgusu", className: "border-cyan-200 bg-cyan-50 text-cyan-700" },
  hypothesis: { label: "Hipotez", className: "border-amber-200 bg-amber-50 text-amber-800" },
  clarification: { label: "Açıklama Gerekli", className: "border-slate-200 bg-slate-50 text-slate-700" },
  not_available: { label: "Bilgi Bulunamadı", className: "border-slate-200 bg-slate-50 text-slate-700" },
  refusal: { label: "Kapsam Dışı", className: "border-rose-200 bg-rose-50 text-rose-700" },
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_payload: "Soru biçimi doğrulanamadı. Lütfen daha kısa ve açık biçimde yeniden yazın.",
  mode_report_mismatch: "Rapor sorusu için bir rapor seçilmelidir.",
  unauthorized: "Oturum doğrulanamadı. Yeniden giriş yapmanız gerekiyor.",
  session_expired: "Uygulama oturumunuz sona erdi. Yeniden giriş yapın.",
  report_not_found: "Rapor bulunamadı veya bu hesap için erişilebilir değil.",
  payload_too_large: "Soru izin verilen boyutu aşıyor.",
  too_many_requests: "Çok hızlı soru gönderildi. Kısa bir süre bekleyip yeniden deneyin.",
  audit_unavailable: "Vaka erişimi güvenli biçimde kaydedilemediği için cevap gösterilmedi.",
  dna_chat_failed: "DNA Asistanı şu anda yanıt veremiyor. Biraz sonra yeniden deneyin.",
  dna_chat_unavailable: "DNA Asistanı güvenli bakım modunda. Daha sonra yeniden deneyin.",
}

function messageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function formatDate(value: string | null) {
  if (!value) return "Tarih yok"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Tarih yok"
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(date)
}

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : []
}

const AUTHORITY_LAYERS = new Set<KnowledgeAuthority["layer"]>([
  "dna_product_information",
  "external_scientific_information",
  "case_information",
  "safety_and_product_boundaries",
])
const AUTHORITY_CONTRACT_VERSION = "dna-knowledge-authority@1"
const AUTHORITY_STATUSES = new Set<KnowledgeAuthority["verificationStatus"]>([
  "pending",
  "verified",
  "test_only",
])
const AUTHORITY_APPROVAL_BY_LAYER: Record<KnowledgeAuthority["layer"], string> = {
  dna_product_information: "owner_approved",
  external_scientific_information: "codex_multi_pass_audited",
  case_information: "report_derived",
  safety_and_product_boundaries: "policy_enforced",
}
const ANSWER_UNIT_KINDS = new Set<AnswerUnit["kind"]>([
  "summary", "detail", "case_evidence", "limitation", "safety_boundary",
])
const ANSWER_UNIT_ROLES = new Set<AnswerUnit["role"]>([
  "product_definition", "scientific_evidence", "dna_specific_validation", "case_finding", "safety_boundary",
])
const ANSWER_ROLE_LAYER: Record<AnswerUnit["role"], KnowledgeAuthority["layer"]> = {
  product_definition: "dna_product_information",
  scientific_evidence: "external_scientific_information",
  dna_specific_validation: "external_scientific_information",
  case_finding: "case_information",
  safety_boundary: "safety_and_product_boundaries",
}
const ANSWER_UNIT_KIND_LABEL: Record<AnswerUnit["kind"], string> = {
  summary: "Özet",
  detail: "Ayrıntı",
  case_evidence: "Rapor dayanağı",
  limitation: "Sınırlılık",
  safety_boundary: "Güvenlik sınırı",
}
const V3_ANSWER_SECTIONS = new Set<V3AnswerSection>([
  "definition", "function_or_relation", "development", "measurement", "evidence_status",
  "counter_evidence", "dna_boundary", "case_context", "case_finding", "case_missing",
  "general_literature", "case_non_inference", "preserved_capacity", "boundary",
])
const DNA_VALIDATION_STATUSES = new Set<DnaValidationStatus>([
  "product_definition", "supported_relation", "conceptual_proximity", "theory_only",
  "not_established", "contradicted", "not_applicable",
])
const V3_ANSWER_SECTION_LABEL: Record<V3AnswerSection, string> = {
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
}

function normalizeAuthority(value: unknown): KnowledgeAuthority | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const layer = String(row.layer || "") as KnowledgeAuthority["layer"]
  const verificationStatus = String(row.verificationStatus || "") as KnowledgeAuthority["verificationStatus"]
  const contractVersion = String(row.contractVersion || "").trim()
  const labelTr = String(row.labelTr || "").trim()
  const approvalRequirement = String(row.approvalRequirement || "").trim()
  const releaseEligible = row.releaseEligible === true
  if (
    contractVersion !== AUTHORITY_CONTRACT_VERSION ||
    !AUTHORITY_LAYERS.has(layer) ||
    !AUTHORITY_STATUSES.has(verificationStatus) ||
    !labelTr ||
    approvalRequirement !== AUTHORITY_APPROVAL_BY_LAYER[layer] ||
    (releaseEligible && verificationStatus !== "verified")
  ) return null
  return {
    contractVersion,
    layer,
    labelTr,
    approvalRequirement,
    verificationStatus,
    releaseEligible,
    ...(String(row.boundaryTr || "").trim()
      ? { boundaryTr: String(row.boundaryTr).trim() }
      : {}),
  }
}

function normalizeSource(value: unknown): SourceRef | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const id = String(row.id || "").trim()
  if (!id) return null
  const authority = normalizeAuthority(row.authority)
  const optionalString = (key: string) => {
    const candidate = String(row[key] || "").trim()
    return candidate || undefined
  }
  const year = Number(row.year)
  const publicationYear = Number(row.publicationYear)
  const rawUrl = optionalString("url") || optionalString("officialUrl")
  let safeUrl: string | undefined
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl)
      if (parsed.protocol === "https:" || parsed.protocol === "http:") safeUrl = parsed.toString()
    } catch {}
  }
  return {
    id,
    sourceId: optionalString("sourceId"),
    type: optionalString("type"),
    title: optionalString("title"),
    labelTr: optionalString("labelTr"),
    excerpt: optionalString("excerpt"),
    excerptTr: optionalString("excerptTr"),
    citation: optionalString("citation"),
    publicationYear: Number.isFinite(publicationYear) ? publicationYear : undefined,
    year: Number.isFinite(year) ? year : undefined,
    doi: row.doi === null ? null : optionalString("doi"),
    url: safeUrl,
    claimBoundary: optionalString("claimBoundary"),
    ageScope: optionalString("ageScope"),
    studyType: optionalString("studyType"),
    sampleScope: optionalString("sampleScope"),
    authors: optionalString("authors"),
    sourceType: optionalString("sourceType"),
    officialUrl: safeUrl,
    locator: optionalString("locator"),
    evidenceLevel: optionalString("evidenceLevel"),
    supportedClaim: optionalString("supportedClaim"),
    knownBoundary: optionalString("knownBoundary"),
    supportedBoundary: optionalString("supportedBoundary"),
    ...(authority ? { authority } : {}),
  }
}

function normalizeAnswerUnit(value: unknown, runtimeGeneration: DnaAnswer["runtimeGeneration"]): AnswerUnit | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const kind = String(row.kind || "") as AnswerUnit["kind"]
  const role = String(row.role || "") as AnswerUnit["role"]
  const authority = normalizeAuthority(row.authority)
  const id = String(row.id || "").trim()
  const text = String(row.text || "").trim()
  const rawSection = String(row.section || "") as V3AnswerSection
  const section = V3_ANSWER_SECTIONS.has(rawSection) ? rawSection : null
  if (!id || !text || !authority || !ANSWER_UNIT_KINDS.has(kind) || !ANSWER_UNIT_ROLES.has(role)) {
    return null
  }
  if (runtimeGeneration === "v3" && !section) return null
  return {
    id,
    section,
    kind,
    role,
    text,
    authority,
    claimIds: normalizeStringList(row.claimIds),
    passageIds: normalizeStringList(row.passageIds),
    sourceIds: normalizeStringList(row.sourceIds),
    citationCardIds: normalizeStringList(row.citationCardIds),
  }
}

function normalizeAnswer(value: unknown): DnaAnswer | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const classification = String(row.classification || "") as DnaChatClassification
  if (!(classification in CLASSIFICATION_META)) return null
  const requestId = String(row.requestId || "").trim()
  const responseDepth = String(row.responseDepth || "standard") as ResponseDepth
  const runtimeGeneration = row.runtimeGeneration === "v3" ? "v3" : "v2_legacy"
  if (!requestId || !RESPONSE_DEPTH_OPTIONS.some((option) => option.value === responseDepth)) return null

  const rawContextRequest = row.contextRequest
  const contextRequest =
    rawContextRequest &&
    typeof rawContextRequest === "object" &&
    (rawContextRequest as Record<string, unknown>).type === "report"
      ? {
          type: "report" as const,
          preferNewest: (rawContextRequest as Record<string, unknown>).preferNewest !== false,
        }
      : undefined
  const rawEvidenceSummary = row.evidenceSummary
  const rawDnaValidationStatus = rawEvidenceSummary && typeof rawEvidenceSummary === "object"
    ? String((rawEvidenceSummary as Record<string, unknown>).dnaValidationStatus || "") as DnaValidationStatus
    : null
  const evidenceSummary =
    rawEvidenceSummary && typeof rawEvidenceSummary === "object"
      ? {
          level: String((rawEvidenceSummary as Record<string, unknown>).level || "").trim(),
          scientificEvidenceLevel: String((rawEvidenceSummary as Record<string, unknown>).scientificEvidenceLevel || "").trim(),
          ...(rawDnaValidationStatus && DNA_VALIDATION_STATUSES.has(rawDnaValidationStatus)
            ? { dnaValidationStatus: rawDnaValidationStatus }
            : {}),
          ageScope: String((rawEvidenceSummary as Record<string, unknown>).ageScope || "").trim(),
          sampleScope: String((rawEvidenceSummary as Record<string, unknown>).sampleScope || "").trim(),
          boundary: String((rawEvidenceSummary as Record<string, unknown>).boundary || "").trim(),
        }
      : undefined

  const sources = Array.isArray(row.sources)
    ? row.sources.map(normalizeSource).filter((entry): entry is SourceRef => Boolean(entry))
    : []
  if (Array.isArray(row.sources) && sources.length !== row.sources.length) return null
  const authoritySummary = Array.isArray(row.authoritySummary)
    ? row.authoritySummary
        .map(normalizeAuthority)
        .filter((entry): entry is KnowledgeAuthority => Boolean(entry))
    : []
  if (!Array.isArray(row.authoritySummary) || authoritySummary.length !== row.authoritySummary.length) {
    return null
  }
  const answerUnits = Array.isArray(row.answerUnits)
    ? row.answerUnits
        .map((entry) => normalizeAnswerUnit(entry, runtimeGeneration))
        .filter((entry): entry is AnswerUnit => Boolean(entry))
    : []
  if (!Array.isArray(row.answerUnits) || !answerUnits.length || answerUnits.length !== row.answerUnits.length) {
    return null
  }
  const sourceById = new Map<string, SourceRef>()
  const sourceCardsBySourceId = new Map<string, SourceRef[]>()
  sources.forEach((source) => {
    sourceById.set(source.id, source)
    const sourceId = source.sourceId || source.id
    const cards = sourceCardsBySourceId.get(sourceId) || []
    cards.push(source)
    sourceCardsBySourceId.set(sourceId, cards)
  })
  if (answerUnits.some((unit) =>
    ANSWER_ROLE_LAYER[unit.role] !== unit.authority.layer ||
    unit.sourceIds.some((sourceId) => {
      const cards = sourceCardsBySourceId.get(sourceId) || []
      return !cards.length || cards.some((source) => source.authority?.layer !== unit.authority.layer)
    }))) {
    return null
  }
  if (runtimeGeneration === "v3" && answerUnits.some((unit) => {
    const isScientific = unit.role === "product_definition"
      || unit.role === "scientific_evidence"
      || unit.role === "dna_specific_validation"
    if (!isScientific) return unit.citationCardIds.length > 0
      || unit.claimIds.length > 0
      || unit.passageIds.length > 0
      || unit.sourceIds.length > 0
    if (!unit.citationCardIds.length) return true
    return unit.citationCardIds.some((cardId) => {
      const card = sourceById.get(cardId)
      return !card
        || card.authority?.layer !== unit.authority.layer
    })
  })) return null

  return {
    requestId,
    responseDepth,
    runtimeGeneration,
    classification,
    summary: String(row.summary || "Yanıt oluşturuldu.").trim(),
    details: normalizeStringList(row.details),
    sources,
    authoritySummary,
    answerUnits,
    caseEvidence: normalizeStringList(row.caseEvidence),
    limitations: normalizeStringList(row.limitations),
    safetyBoundary: String(row.safetyBoundary || "").trim(),
    intendedUse:
      row.intendedUse && typeof row.intendedUse === "object"
        ? (row.intendedUse as DnaIntelligencePublicIntendedUse)
        : DNA_INTELLIGENCE_PUBLIC_INTENDED_USE,
    suggestedQuestions: normalizeStringList(row.suggestedQuestions),
    engineVersion: String(row.engineVersion || "dna-chat-engine@2").trim(),
    catalogVersion: String(row.catalogVersion || "dna-chat-catalog@2").trim(),
    packageVersion: String(row.packageVersion || "dna-chat-catalog@2").trim(),
    packageSha256: typeof row.packageSha256 === "string" && /^[a-f0-9]{64}$/.test(row.packageSha256)
      ? row.packageSha256
      : null,
    topic: typeof row.topic === "string" && row.topic.trim() ? row.topic.trim() : null,
    ...(contextRequest ? { contextRequest } : {}),
    ...(evidenceSummary && Object.values(evidenceSummary).some(Boolean) ? { evidenceSummary } : {}),
  }
}

function sourceTitle(source: SourceRef) {
  return source.title || source.labelTr || source.citation || source.id
}

function sourceAuthorYear(source: SourceRef) {
  const year = source.publicationYear || source.year
  if (source.authors) return [source.authors, year].filter(Boolean).join(" · ")
  if (source.labelTr) return source.labelTr
  if (source.citation) return source.citation
  return year ? String(year) : "Katalog kaydında belirtilmemiş"
}

function sourceAnchor(requestId: string, index: number) {
  return `dna-source-${requestId.replace(/[^a-zA-Z0-9_-]/g, "")}-${index + 1}`
}

export default function DnaAssistantClient({ initialReportId }: { initialReportId: string }) {
  const isAppSurface = useAppSurface(false)
  const [reports, setReports] = useState<ReportOption[]>([])
  const [selectedReportId, setSelectedReportId] = useState("")
  const [reportPickerOpen, setReportPickerOpen] = useState(false)
  const [pendingReportQuestion, setPendingReportQuestion] = useState<string | null>(null)
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportsError, setReportsError] = useState("")
  const [reportsErrorCode, setReportsErrorCode] = useState("")
  const [reportSelectionNotice, setReportSelectionNotice] = useState("")
  const [reportSelectionInFlight, setReportSelectionInFlight] = useState(false)
  const [question, setQuestion] = useState("")
  const [responseDepth, setResponseDepth] = useState<ResponseDepth>("standard")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [previousTopic, setPreviousTopic] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState("")
  const [sendErrorCode, setSendErrorCode] = useState("")
  const [composerHeight, setComposerHeight] = useState(224)
  const messageEndRef = useRef<HTMLDivElement>(null)
  const composerFooterRef = useRef<HTMLElement>(null)
  const questionInputRef = useRef<HTMLTextAreaElement>(null)
  const reportPickerRef = useRef<HTMLElement>(null)
  const firstReportButtonRef = useRef<HTMLButtonElement>(null)
  const reportPickerFocusPendingRef = useRef(false)
  const requestSequenceRef = useRef(0)
  const activeRequestRef = useRef<AbortController | null>(null)
  const reportSelectionCoordinatorRef = useRef(createDnaChatReportSelectionCoordinator())

  const selectedReport = reports.find((report) => report.id === selectedReportId) || null
  const reportSelectionBlocked = !canBeginDnaChatReportSelection({
    sending,
    reportsLoading,
    selectionInFlight: reportSelectionInFlight,
  })

  const loadReports = useCallback(async (signal?: AbortSignal, linkedReportId = "") => {
    setReportsLoading(true)
    setReportsError("")
    setReportsErrorCode("")
    try {
      const response = await fetch("/api/app/dna-chat", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        signal,
      })
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; reports?: ReportOption[]; error?: string }
        | null
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "dna_chat_failed")

      const nextReports = Array.isArray(payload.reports) ? payload.reports.slice(0, 10) : []
      setReports(nextReports)
      const linkedReportAvailable = Boolean(
        linkedReportId && nextReports.some((report) => report.id === linkedReportId),
      )
      setSelectedReportId((current) => {
        if (linkedReportAvailable) return linkedReportId
        if (current && nextReports.some((report) => report.id === current)) return current
        return ""
      })
      if (linkedReportId && !linkedReportAvailable) {
        reportPickerFocusPendingRef.current = true
        setReportSelectionNotice(
          "Bağlantıdaki rapor son 10 aktif DNA raporu içinde değil. Tartışmak için listeden bir rapor seçin.",
        )
        setReportPickerOpen(true)
      } else {
        setReportSelectionNotice("")
      }
      return nextReports
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return null
      const code = error instanceof Error ? error.message : "dna_chat_failed"
      setReportsErrorCode(code)
      setReportsError(ERROR_MESSAGES[code] || ERROR_MESSAGES.dna_chat_failed)
      return null
    } finally {
      setReportsLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    if (initialReportId) void loadReports(controller.signal, initialReportId)
    return () => {
      controller.abort()
      requestSequenceRef.current += 1
      activeRequestRef.current?.abort()
      activeRequestRef.current = null
    }
  }, [initialReportId, loadReports])

  useEffect(() => {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
    messageEndRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest",
    })
  }, [composerHeight, messages, sending, reportPickerOpen])

  useEffect(() => {
    if (!reportPickerOpen || reportsLoading || !reportPickerFocusPendingRef.current) return
    const target = firstReportButtonRef.current ?? reportPickerRef.current
    requestAnimationFrame(() => target?.focus())
    reportPickerFocusPendingRef.current = false
  }, [reportPickerOpen, reports.length, reportsLoading])

  function moveQuestionFocus(nextQuestion?: string) {
    if (typeof nextQuestion === "string") setQuestion(nextQuestion)
    requestAnimationFrame(() => questionInputRef.current?.focus())
  }

  function cancelPendingResponse() {
    requestSequenceRef.current += 1
    activeRequestRef.current?.abort()
    activeRequestRef.current = null
    setSending(false)
  }

  function clearConversation() {
    cancelPendingResponse()
    setMessages([])
    setPreviousTopic(null)
    setPendingReportQuestion(null)
    setQuestion("")
    setSendError("")
    setSendErrorCode("")
  }

  function removeReportContext() {
    if (reportSelectionCoordinatorRef.current.isInFlight()) return
    clearConversation()
    setSelectedReportId("")
    setReportPickerOpen(false)
    setReportSelectionNotice("")
    moveQuestionFocus()
  }

  function changeReportContext() {
    if (reportSelectionCoordinatorRef.current.isInFlight()) return
    const transition = planDnaChatReportTransition({
      action: "change_report",
      pendingReportQuestion,
    })
    if (transition.clearConversation) clearConversation()
    setSelectedReportId(transition.selectedReportId ?? "")
    reportPickerFocusPendingRef.current = true
    setReportPickerOpen(transition.reportPickerOpen)
    setReportSelectionNotice("")
    void loadReports()
  }

  async function sendQuestion(
    cleanQuestion: string,
    options: { reportId?: string; appendUser?: boolean; previousTopic?: string | null } = {},
  ) {
    if (sending || cleanQuestion.length < 2) return

    setSending(true)
    setSendError("")
    setSendErrorCode("")
    setQuestion("")
    if (options.appendUser !== false) {
      setMessages((current) => [...current, { id: messageId("user"), role: "user", text: cleanQuestion }])
    }

    const requestId = requestSequenceRef.current + 1
    requestSequenceRef.current = requestId
    const controller = new AbortController()
    activeRequestRef.current?.abort()
    activeRequestRef.current = controller
    const requestReportId = options.reportId ?? selectedReportId
    const requestPreviousTopic = options.previousTopic === undefined ? previousTopic : options.previousTopic

    try {
      const response = await fetch("/api/app/dna-chat", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          "x-dna-request": "same-origin",
        },
        signal: controller.signal,
        body: JSON.stringify({
          question: cleanQuestion,
          responseDepth,
          ...(requestReportId ? { reportId: requestReportId } : {}),
          ...(requestPreviousTopic ? { context: { previousTopic: requestPreviousTopic } } : {}),
        }),
      })
      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
      if (!response.ok || !payload?.ok) throw new Error(String(payload?.error || "dna_chat_failed"))
      const answer = normalizeAnswer(payload)
      if (!answer) throw new Error("dna_chat_failed")
      if (requestSequenceRef.current !== requestId) return

      setMessages((current) => [...current, { id: messageId("assistant"), role: "assistant", answer }])
      setPreviousTopic(answer.topic)
      if (answer.contextRequest?.type === "report" && !requestReportId) {
        setPendingReportQuestion(cleanQuestion)
        reportPickerFocusPendingRef.current = true
        setReportPickerOpen(true)
        await loadReports(controller.signal)
      }
    } catch (error) {
      if ((error as Error)?.name === "AbortError" || requestSequenceRef.current !== requestId) return
      const code = error instanceof Error ? error.message : "dna_chat_failed"
      setSendErrorCode(code)
      setSendError(ERROR_MESSAGES[code] || ERROR_MESSAGES.dna_chat_failed)
    } finally {
      if (requestSequenceRef.current === requestId) {
        activeRequestRef.current = null
        setSending(false)
        if (!reportPickerFocusPendingRef.current) moveQuestionFocus()
      }
    }
  }

  async function chooseReport(reportId: string) {
    if (reportSelectionBlocked) return
    const coordinator = reportSelectionCoordinatorRef.current
    const transition = coordinator.claim({
      reportId,
      pendingReportQuestion,
    })
    if (!transition) return
    setReportSelectionInFlight(true)
    // Clear the public pending state synchronously in the claimed path. The
    // coordinator ref is the same-tick guard until React commits this update.
    setPendingReportQuestion(null)
    try {
      if (transition.clearConversation) clearConversation()
      setSelectedReportId(transition.selectedReportId ?? "")
      reportPickerFocusPendingRef.current = false
      setReportPickerOpen(transition.reportPickerOpen)
      setReportSelectionNotice("")
      const [waitingQuestion] = transition.resubmitQuestions
      if (waitingQuestion && transition.selectedReportId) {
        await sendQuestion(waitingQuestion, {
          reportId: transition.selectedReportId,
          previousTopic: transition.previousTopic,
        })
      } else {
        moveQuestionFocus()
      }
    } finally {
      coordinator.release()
      setReportSelectionInFlight(false)
    }
  }

  function submitQuestion(event?: React.FormEvent) {
    event?.preventDefault()
    const cleanQuestion = question.trim()
    if (sending || cleanQuestion.length < 2) return
    if (pendingReportQuestion) {
      setPendingReportQuestion(null)
      reportPickerFocusPendingRef.current = false
      setReportPickerOpen(false)
    }
    void sendQuestion(cleanQuestion)
  }

  const hasConversation = messages.length > 0 || reportPickerOpen || sending

  useEffect(() => {
    if (!isAppSurface || !hasConversation) {
      setComposerHeight(224)
      return
    }
    const footer = composerFooterRef.current
    if (!footer) return
    const updateHeight = () => {
      const nextHeight = Math.ceil(footer.getBoundingClientRect().height)
      setComposerHeight((current) => current === nextHeight ? current : nextHeight)
    }
    updateHeight()
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateHeight)
      return () => window.removeEventListener("resize", updateHeight)
    }
    const observer = new ResizeObserver(updateHeight)
    observer.observe(footer)
    return () => observer.disconnect()
  }, [hasConversation, isAppSurface])

  useEffect(() => {
    const input = questionInputRef.current
    if (!input) return
    input.style.height = "auto"
    const nextHeight = Math.min(Math.max(input.scrollHeight, 48), 160)
    input.style.height = `${nextHeight}px`
    input.style.overflowY = input.scrollHeight > 160 ? "auto" : "hidden"
  }, [hasConversation, question])

  function renderComposer(hero: boolean) {
    return (
      <form onSubmit={submitQuestion} className="w-full">
        {sendError ? (
          <div role="alert" className="mb-3 rounded-2xl border border-rose-200 bg-[var(--sm-surface)] px-4 py-3 text-xs font-bold leading-5 text-[var(--sm-text)] shadow-sm">
            {sendError}
            {sendErrorCode === "unauthorized" || sendErrorCode === "session_expired" ? (
              <Link href="/app-login" className="ml-2 inline-flex min-h-11 items-center font-black text-blue-700 underline-offset-4 hover:underline">
                Yeniden giriş yap
              </Link>
            ) : null}
          </div>
        ) : null}

        <fieldset className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
          <legend className="sr-only">Yanıt ayrıntı düzeyi</legend>
          <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--sm-text-muted)]">
            Yanıt uzunluğu
          </span>
          <div className="flex min-h-11 items-center rounded-full border border-[var(--sm-border)] bg-[var(--sm-surface-soft)] p-1" aria-label="Yanıt uzunluğu seçimi">
            {RESPONSE_DEPTH_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="relative flex min-h-11 cursor-pointer items-center rounded-full focus-within:outline-none"
                title={option.description}
              >
                <input
                  type="radio"
                  name="dna-response-depth"
                  value={option.value}
                  checked={responseDepth === option.value}
                  onChange={() => setResponseDepth(option.value)}
                  className="peer sr-only"
                />
                <span
                  className={[
                    "inline-flex min-h-11 items-center rounded-full px-3 text-[11px] font-black transition peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2",
                    responseDepth === option.value
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-[var(--sm-text-muted)] hover:bg-[var(--sm-surface)] hover:text-[var(--sm-text)]",
                  ].join(" ")}
                >
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div
          className={[
            "border border-[var(--sm-border)] bg-[var(--sm-surface)] shadow-[0_22px_70px_-38px_rgba(7,27,58,0.58)] transition-[border-color,box-shadow] focus-within:border-blue-400 focus-within:shadow-[0_26px_80px_-38px_rgba(37,99,235,0.48)] focus-within:ring-4 focus-within:ring-blue-100/70",
            hero ? "rounded-[30px] p-2.5 sm:p-3" : "rounded-[26px] p-2.5 sm:p-3",
          ].join(" ")}
        >
          <div className="flex items-end gap-2 sm:gap-3">
            <label htmlFor="dna-chat-question" className="sr-only">DNA Asistanına sorunuzu yazın</label>
            <textarea
              ref={questionInputRef}
              id="dna-chat-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value.slice(0, 600))}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  submitQuestion()
                }
              }}
              rows={1}
              maxLength={600}
              disabled={sending}
              placeholder={selectedReport ? "Bu raporun güvenli bulgularını veya genel bilgiyi sorun…" : "DNA Asistanına sorun…"}
              className={[
                "max-h-40 min-w-0 flex-1 resize-none border-0 bg-transparent px-2 text-sm font-semibold leading-6 text-[var(--sm-text)] outline-none placeholder:font-medium placeholder:text-[var(--sm-text-muted)] disabled:opacity-60 sm:text-[15px]",
                "min-h-[48px] py-3",
              ].join(" ")}
            />
            <div className="flex shrink-0 items-center gap-2 pb-0.5">
              {question.length > 500 ? (
                <span className="hidden text-[10px] font-bold text-[var(--sm-text-muted)] sm:inline">{question.length}/600</span>
              ) : null}
              <button
                type="submit"
                disabled={sending || question.trim().length < 2}
                aria-label="Soruyu gönder"
                className="grid min-h-12 min-w-12 place-items-center rounded-full border border-blue-600 bg-blue-600 text-white shadow-[0_12px_26px_rgba(37,99,235,0.28)] transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-[0_16px_30px_rgba(37,99,235,0.32)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 disabled:shadow-none disabled:hover:translate-y-0"
              >
                {sending ? <LoaderCircle className="animate-spin" size={19} aria-hidden="true" /> : <ArrowUp size={20} strokeWidth={2.6} aria-hidden="true" />}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-col items-center justify-center gap-1.5 px-2 text-center text-[10px] font-semibold leading-4 text-[var(--sm-text-muted)] sm:flex-row sm:gap-3 sm:text-[11px]">
          <span className="hidden sm:inline">Enter gönderir · Shift + Enter yeni satır</span>
          <span className="inline-flex items-center justify-center gap-1.5">
            <CircleAlert className="shrink-0 text-blue-600" size={13} aria-hidden="true" />
            {DNA_INTELLIGENCE_COMPOSER_NOTICE_TR}
          </span>
        </div>
        <details className="group mx-auto mt-2 max-w-3xl text-left text-[10px] font-semibold leading-4 text-[var(--sm-text-muted)] sm:text-[11px]">
          <summary className="mx-auto flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 rounded-xl px-3 text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            Kullanım ve veri sınırları
            <ChevronDown className="transition group-open:rotate-180" size={14} aria-hidden="true" />
          </summary>
          <div className="mt-1 space-y-2 rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface-soft)] p-3">
            <p>{DNA_INTELLIGENCE_PUBLIC_INTENDED_USE.boundaryTr}</p>
            <p>{DNA_INTELLIGENCE_PUBLIC_INTENDED_USE.privacyTr}</p>
            <p>{DNA_INTELLIGENCE_PUBLIC_INTENDED_USE.evidenceTr}</p>
            <p>{DNA_INTELLIGENCE_PUBLIC_INTENDED_USE.runtimeTr}</p>
          </div>
        </details>
      </form>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1040px] pb-2">
      <section
        className={[
          "relative flex min-h-[calc(100dvh-190px)] min-w-0 flex-col md:min-h-[calc(100dvh-150px)]",
          isAppSurface ? "min-h-[calc(100dvh-208px)] md:min-h-[calc(100dvh-190px)] lg:min-h-[calc(100dvh-154px)]" : "",
        ].join(" ")}
        aria-label="DNA Asistanı sohbeti"
      >
        <header className="flex min-h-14 flex-col gap-3 border-b border-[var(--sm-border)] px-1 pb-3 sm:flex-row sm:items-center sm:justify-between sm:px-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-blue-100 bg-[var(--sm-surface)] text-blue-700 shadow-sm">
              <Sparkles size={19} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-black tracking-tight text-[var(--sm-text)]">DNA Asistanı</h1>
              <p className="mt-0.5 truncate text-[11px] font-semibold text-[var(--sm-text-muted)]">{DNA_INTELLIGENCE_TAGLINE_TR}</p>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2 sm:justify-end">
            <div className="hidden min-h-10 items-center gap-2 rounded-full border border-[var(--sm-border)] bg-[var(--sm-surface)] px-3 text-[11px] font-bold text-[var(--sm-text-muted)] shadow-sm md:flex">
              <ShieldCheck size={16} className="text-blue-600" aria-hidden="true" />
              <span title={DNA_INTELLIGENCE_AUDIT_NOTICE_TR}>Sohbet geçmişi tutulmaz · Sınırlı audit</span>
            </div>

            {selectedReport ? (
              <div role="status" className="flex min-h-11 min-w-0 items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 text-xs font-bold text-[var(--sm-text)] shadow-sm">
                <FileSearch size={17} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block max-w-28 truncate font-black">{selectedReport.clientCode || "Danışan kodu yok"}</span>
                  <span className="hidden text-[10px] text-cyan-700 sm:block">{formatDate(selectedReport.createdAt)}</span>
                </span>
                <button
                  type="button"
                  onClick={changeReportContext}
                  disabled={reportSelectionInFlight}
                  className="min-h-11 rounded-full px-2 font-black text-blue-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Değiştir
                </button>
                <button
                  type="button"
                  onClick={removeReportContext}
                  disabled={reportSelectionInFlight}
                  aria-label="Rapor bağlamını kaldır ve yeni sohbet başlat"
                  className="grid min-h-11 min-w-11 place-items-center rounded-full text-slate-500 hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X size={17} aria-hidden="true" />
                </button>
              </div>
            ) : reportsLoading && initialReportId && !reportPickerOpen ? (
              <div role="status" className="flex min-h-11 items-center gap-2 rounded-full border border-[var(--sm-border)] bg-[var(--sm-surface)] px-3 text-xs font-bold text-[var(--sm-text-muted)] shadow-sm">
                <LoaderCircle className="animate-spin" size={17} aria-hidden="true" /> Rapor bağlantısı doğrulanıyor
              </div>
            ) : null}
          </div>
        </header>

        {!hasConversation ? (
          <div
            className="flex flex-1 items-center justify-center px-1 py-8 sm:px-5"
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
          >
            <div className="w-full max-w-[880px] text-center md:-translate-y-5">
              <Image
                src="/images/logo-icon.png"
                alt=""
                width={180}
                height={180}
                priority
                unoptimized
                className="mx-auto h-[68px] w-[68px] object-contain drop-shadow-[0_14px_24px_rgba(37,99,235,0.24)] sm:h-[76px] sm:w-[76px]"
                sizes="76px"
              />
              <div className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-blue-700">DNA Intelligence</div>
              <h2 className="mx-auto mt-4 max-w-3xl text-[28px] font-semibold leading-tight tracking-[-0.035em] text-[var(--sm-text)] sm:text-4xl lg:text-[42px]">
                Bugün neyi birlikte inceleyelim?
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm font-medium leading-6 text-[var(--sm-text-muted)] sm:text-[15px]">
                {DNA_INTELLIGENCE_PUBLIC_INTENDED_USE.descriptionTr}
              </p>

              <div className="mx-auto mt-8 max-w-[840px] text-left">{renderComposer(true)}</div>

              <div className="mx-auto mt-6 grid max-w-[760px] gap-2 sm:grid-cols-2">
                {STARTER_QUESTIONS.slice(0, 4).map((suggestion, index) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => moveQuestionFocus(suggestion)}
                    className={[
                      "min-h-12 rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface)] px-4 py-2.5 text-left text-xs font-bold leading-5 text-[var(--sm-text-soft)] shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-[var(--sm-surface-soft)] hover:text-[var(--sm-text)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                      index > 1 ? "hidden sm:block" : "",
                    ].join(" ")}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div
              className={[
                "flex-1 px-1 py-6 sm:px-4 sm:py-8",
                isAppSurface
                  ? "pb-[calc(var(--dna-composer-height)+90px+env(safe-area-inset-bottom))] lg:pb-8"
                  : "",
              ].join(" ")}
              style={isAppSurface
                ? ({ "--dna-composer-height": `${composerHeight}px` } as React.CSSProperties)
                : undefined}
              role="log"
              aria-live="polite"
              aria-relevant="additions text"
            >
              <div className="mx-auto max-w-[780px] space-y-7">
                {messages.map((message) =>
                  message.role === "user" ? (
                    <div key={message.id} className="ml-auto max-w-[88%] rounded-[24px] rounded-br-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold leading-6 text-[var(--sm-text)] shadow-sm md:max-w-[76%]">
                      {message.text}
                    </div>
                  ) : (
                    <AssistantAnswer key={message.id} answer={message.answer} onSuggestion={moveQuestionFocus} />
                  ),
                )}

                {reportPickerOpen ? (
                  <section
                    ref={reportPickerRef}
                    tabIndex={-1}
                    className="rounded-[26px] border border-cyan-200 bg-[var(--sm-surface)] p-4 shadow-[0_18px_46px_rgba(7,27,58,0.08)] outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:p-5"
                    aria-labelledby="dna-report-picker-title"
                  >
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
                  <FileSearch size={19} aria-hidden="true" />
                </span>
                <div>
                  <h3 id="dna-report-picker-title" className="text-sm font-black text-[var(--sm-text)]">Hangi raporla devam edelim?</h3>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[var(--sm-text-muted)]">
                    {DNA_INTELLIGENCE_REPORT_OWNERSHIP_NOTICE_TR}
                  </p>
                </div>
              </div>

              {reportSelectionNotice ? (
                <div role="status" className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">
                  {reportSelectionNotice}
                </div>
              ) : null}

              {reportsLoading ? (
                <div role="status" className="mt-3 flex min-h-12 items-center gap-2 rounded-2xl bg-[var(--sm-surface-soft)] px-3 text-xs font-semibold text-[var(--sm-text-muted)]">
                  <LoaderCircle className="animate-spin" size={17} aria-hidden="true" /> Raporlar yükleniyor
                </div>
              ) : reportsError ? (
                <div role="alert" className="mt-3 rounded-2xl border border-rose-200 bg-[var(--sm-surface-soft)] p-3 text-xs font-semibold leading-5 text-[var(--sm-text)]">
                  {reportsError}
                  {reportsErrorCode === "unauthorized" || reportsErrorCode === "session_expired" ? (
                    <Link href="/app-login" className="mt-2 flex min-h-11 items-center font-black text-blue-700 underline-offset-4 hover:underline">
                      Yeniden giriş yap
                    </Link>
                  ) : (
                    <button type="button" onClick={() => void loadReports()} className="mt-2 flex min-h-11 items-center gap-2 font-black text-blue-700">
                      <RefreshCw size={15} aria-hidden="true" /> Yeniden dene
                    </button>
                  )}
                </div>
              ) : reports.length ? (
                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1" role="list" aria-label="Son DNA raporları">
                  {reports.map((report, index) => (
                    <div key={report.id} role="listitem">
                      <button
                        ref={index === 0 ? firstReportButtonRef : undefined}
                        type="button"
                        onClick={() => void chooseReport(report.id)}
                        disabled={reportSelectionBlocked}
                        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface-soft)] px-3 py-2 text-left transition hover:border-blue-200 hover:bg-[var(--sm-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-black text-[var(--sm-text)]">
                            {report.clientCode || "Danışan kodu yok"}
                            {index === 0 ? <span className="ml-2 text-[10px] uppercase tracking-wide text-blue-700">En yeni</span> : null}
                          </span>
                          <span className="mt-1 block text-[11px] font-semibold text-[var(--sm-text-muted)]">
                            {formatDate(report.createdAt)} · {report.ageBand || "Yaş bandı yok"} · Sürüm {report.version ?? "—"}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs font-black text-blue-700">Seç</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div role="status" className="mt-3 rounded-2xl bg-[var(--sm-surface-soft)] p-3 text-xs font-semibold leading-5 text-[var(--sm-text-muted)]">
                  Bu hesapta tartışılabilecek aktif DNA raporu bulunmuyor.
                </div>
              )}
                  </section>
                ) : null}

                {sending ? (
                  <div className="flex items-center gap-3 text-sm font-semibold text-[var(--sm-text-muted)]">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-blue-100 bg-[var(--sm-surface)] text-blue-700 shadow-sm">
                      <LoaderCircle className="animate-spin" size={17} aria-hidden="true" />
                    </span>
                    Kaynak kontrollü yanıt hazırlanıyor
                  </div>
                ) : null}
                <div ref={messageEndRef} />
              </div>
            </div>

            <footer
              ref={composerFooterRef}
              className={[
                "z-20 bg-[var(--sm-app-bg)]/95 px-1 pb-2 pt-3 backdrop-blur-xl sm:px-4",
                isAppSurface
                  ? "fixed inset-x-3 bottom-[calc(78px+env(safe-area-inset-bottom))] mx-auto max-w-[406px] rounded-t-[24px] md:inset-x-8 md:max-w-[760px] lg:sticky lg:inset-x-auto lg:bottom-[88px] lg:max-w-none lg:rounded-none"
                  : "sticky bottom-0",
              ].join(" ")}
            >
              <div className="mx-auto max-w-[860px]">{renderComposer(false)}</div>
            </footer>
          </>
        )}
      </section>
    </div>
  )
}

function AssistantAnswer({ answer, onSuggestion }: { answer: DnaAnswer; onSuggestion: (value: string) => void }) {
  const baseMeta = CLASSIFICATION_META[answer.classification]
  const reportScopedNotAvailable =
    answer.classification === "not_available" &&
    (answer.caseEvidence.length > 0 || answer.limitations.some((item) => /\b(?:rapor|vaka)\b/i.test(item)))
  const meta = reportScopedNotAvailable ? { ...baseMeta, label: "Raporda Yok" } : baseMeta
  const hasStructuredUnits = answer.answerUnits.length > 0
  const hasSafetyBoundaryUnit = Boolean(
    answer.safetyBoundary
      && answer.answerUnits.some((unit) => unit.text.trim() === answer.safetyBoundary.trim()),
  )
  const sourceNumberById = new Map<string, number>()
  answer.sources.forEach((source, index) => {
    if (!sourceNumberById.has(source.id)) sourceNumberById.set(source.id, index + 1)
    if (source.sourceId && !sourceNumberById.has(source.sourceId)) {
      sourceNumberById.set(source.sourceId, index + 1)
    }
  })
  const boundaryText = [
    answer.summary,
    ...answer.details,
    ...answer.limitations,
    ...answer.answerUnits.map((unit) => unit.text),
    answer.evidenceSummary?.level || "",
    answer.evidenceSummary?.scientificEvidenceLevel || "",
    answer.evidenceSummary?.dnaValidationStatus || "",
    answer.evidenceSummary?.boundary || "",
  ].join(" ").toLocaleLowerCase("tr-TR")
  const answerStatusLabels = [
    answer.evidenceSummary?.dnaValidationStatus === "theory_only"
      || /(?:tartışmalı|tartismali|kuramsal|theory_only|polyvagal)/i.test(boundaryText)
      ? "Tartışmalı teori"
      : "",
    /(?:kanıt yetersiz|kanit yetersiz|very_low|very low|çok düşük|cok dusuk|sınırlı kanıt|sinirli kanit)/i.test(boundaryText)
      ? "Kanıt yetersiz"
      : "",
    answer.evidenceSummary?.dnaValidationStatus === "not_established"
      || /(?:ilişki kurulmamıştır|iliski kurulmamistir|ilişki kaydı bulunmuyor|iliski kaydi bulunmuyor|not_established)/i.test(boundaryText)
      ? "Bu ilişki kurulmamıştır"
      : "",
  ].filter(Boolean)

  const authorityStateLabel = (authority: KnowledgeAuthority) =>
    authority.releaseEligible
      ? "Yayın uygun"
      : authority.verificationStatus === "test_only"
        ? "Yalnız test"
        : "Denetim bekliyor"

  const authorityStateClass = (authority: KnowledgeAuthority) =>
    authority.releaseEligible
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-amber-200 bg-amber-50 text-amber-800"

  return (
    <article className="w-full">
      <div className="flex items-start gap-3 sm:gap-4">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-blue-100 bg-[var(--sm-surface)] text-blue-700 shadow-sm">
          <Sparkles size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-[10px] font-black uppercase tracking-[0.08em] ${meta.className}`}>
              {meta.label}
            </span>
            <span
              className="text-[10px] font-bold text-[var(--sm-text-muted)]"
              title={`${answer.catalogVersion} · ${answer.packageVersion}${answer.packageSha256 ? ` · ${answer.packageSha256}` : ""}`}
            >
              {answer.engineVersion} · {answer.runtimeGeneration === "v3" ? "V3 yayın paketi" : "V2 güvenli geri dönüş"}
            </span>
            <span className="inline-flex min-h-7 items-center rounded-full border border-[var(--sm-border)] bg-[var(--sm-surface-soft)] px-2.5 text-[10px] font-black text-[var(--sm-text-muted)]">
              {RESPONSE_DEPTH_LABEL[answer.responseDepth]}
            </span>
          </div>
          {answerStatusLabels.length ? (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Kanıt ve ilişki uyarıları">
              {answerStatusLabels.map((label) => (
                <li key={label} className="inline-flex min-h-7 items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 text-[10px] font-black text-amber-900">
                  {label}
                </li>
              ))}
            </ul>
          ) : null}
          {answer.authoritySummary.length ? (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Yanıtta kullanılan bilgi otoriteleri">
              {answer.authoritySummary.map((authority) => (
                <li
                  key={authority.layer}
                  className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-bold ${authorityStateClass(authority)}`}
                >
                  {authority.labelTr}
                  <span aria-hidden="true">·</span>
                  <span>{authorityStateLabel(authority)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {hasStructuredUnits ? (
            <ul className="mt-3 space-y-2" aria-label="Otoritesine göre ayrılmış yanıt">
              {answer.answerUnits.map((unit, index) => {
                const sectionHeading = answer.runtimeGeneration === "v3"
                  && unit.section
                  && answer.answerUnits[index - 1]?.section !== unit.section
                    ? V3_ANSWER_SECTION_LABEL[unit.section]
                    : null
                return (
                  <li
                    key={unit.id}
                    className="rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface-soft)] p-3"
                  >
                  {sectionHeading ? (
                    <h3 className="mb-2 text-xs font-black tracking-[-0.01em] text-[var(--sm-text)]">
                      {sectionHeading}
                    </h3>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full border border-[var(--sm-border)] bg-[var(--sm-surface)] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-[var(--sm-text-muted)]">
                      {ANSWER_UNIT_KIND_LABEL[unit.kind]}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--sm-text-muted)]">
                      {unit.authority.labelTr}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${authorityStateClass(unit.authority)}`}>
                      {authorityStateLabel(unit.authority)}
                    </span>
                    {(unit.citationCardIds.length ? unit.citationCardIds : unit.sourceIds)
                      .some((citationId) => sourceNumberById.has(citationId)) ? (
                      <span
                        className="inline-flex flex-wrap items-center gap-1 text-[10px] font-black text-blue-700"
                        aria-label={unit.citationCardIds.length
                          ? "Bu cümlenin claim ve passage düzeyindeki kaynakları"
                          : "Bu cümleyle ilişkili geçiş kataloğu kaynakları"}
                      >
                        {(unit.citationCardIds.length ? unit.citationCardIds : unit.sourceIds).flatMap((citationId) => {
                          const sourceNumber = sourceNumberById.get(citationId)
                          if (!sourceNumber) return []
                          return [
                            <a
                              key={`${unit.id}:${citationId}`}
                              href={`#${sourceAnchor(answer.requestId, sourceNumber - 1)}`}
                              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-2 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                              aria-label={unit.citationCardIds.length
                                ? `Claim ve passage eşleşmeli kaynak ${sourceNumber}'e git`
                                : `İlişkili geçiş kataloğu kaynağı ${sourceNumber}'e git`}
                            >
                              [{sourceNumber}]
                            </a>,
                          ]
                        })}
                      </span>
                    ) : null}
                  </div>
                  <p className={`mt-2 text-sm leading-6 text-[var(--sm-text)] ${unit.kind === "summary" ? "font-bold" : "font-medium"}`}>
                    {unit.text}
                  </p>
                  {unit.authority.boundaryTr ? (
                    <p
                      className={`mt-2 rounded-lg border p-2 text-[11px] font-semibold leading-5 ${
                        unit.authority.releaseEligible
                          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                          : "border-amber-200 bg-amber-50 text-amber-900"
                      }`}
                    >
                      <strong>Bilgi sınırı:</strong> {unit.authority.boundaryTr}
                    </p>
                  ) : null}
                  </li>
                )
              })}
            </ul>
          ) : (
            <>
              <p className="mt-3 text-sm font-bold leading-6 text-[var(--sm-text)]">{answer.summary}</p>
              {answer.details.length ? (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm font-medium leading-6 text-[var(--sm-text-soft)] marker:text-blue-500">
                  {answer.details.map((detail) => <li key={detail}>{detail}</li>)}
                </ul>
              ) : null}
            </>
          )}

      {answer.evidenceSummary ? (
        <div className="mt-4 grid gap-2 rounded-2xl border border-violet-200 bg-[var(--sm-surface-soft)] p-3 text-xs leading-5 sm:grid-cols-2">
          {answer.evidenceSummary.level ? (
            <div><span className="font-black text-[var(--sm-text)]">Kanıt düzeyi:</span> <span className="font-semibold text-[var(--sm-text-soft)]">{answer.evidenceSummary.level}</span></div>
          ) : null}
          {answer.evidenceSummary.scientificEvidenceLevel && answer.evidenceSummary.scientificEvidenceLevel !== answer.evidenceSummary.level ? (
            <div><span className="font-black text-[var(--sm-text)]">Genel literatür:</span> <span className="font-semibold text-[var(--sm-text-soft)]">{answer.evidenceSummary.scientificEvidenceLevel}</span></div>
          ) : null}
          {answer.evidenceSummary.dnaValidationStatus === "not_established" ? (
            <div><span className="font-black text-[var(--sm-text)]">DNA ilişkisi:</span> <span className="font-semibold text-[var(--sm-text-soft)]">Doğrudan ilişki kurulmamıştır</span></div>
          ) : null}
          {answer.evidenceSummary.ageScope ? (
            <div><span className="font-black text-[var(--sm-text)]">Yaş kapsamı:</span> <span className="font-semibold text-[var(--sm-text-soft)]">{answer.evidenceSummary.ageScope}</span></div>
          ) : null}
          {answer.evidenceSummary.sampleScope ? (
            <div className="sm:col-span-2"><span className="font-black text-[var(--sm-text)]">Örneklem sınırı:</span> <span className="font-semibold text-[var(--sm-text-soft)]">{answer.evidenceSummary.sampleScope}</span></div>
          ) : null}
          {answer.evidenceSummary.boundary ? (
            <div className="sm:col-span-2"><span className="font-black text-[var(--sm-text)]">İddia sınırı:</span> <span className="font-semibold text-[var(--sm-text-soft)]">{answer.evidenceSummary.boundary}</span></div>
          ) : null}
        </div>
      ) : null}

      {!hasStructuredUnits && answer.caseEvidence.length ? (
        <div className="mt-4 rounded-2xl border border-cyan-200 bg-[var(--sm-surface-soft)] p-3">
          <div className="text-[11px] font-black uppercase tracking-[0.1em] text-cyan-700">Rapordaki dayanak</div>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs font-semibold leading-5 text-[var(--sm-text-soft)]">
            {answer.caseEvidence.map((evidence) => <li key={evidence}>{evidence}</li>)}
          </ul>
        </div>
      ) : null}

      {answer.sources.length ? (
        <details className="group mt-4 rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface-soft)]">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-black text-[var(--sm-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            Kaynaklar ({answer.sources.length})
            <ChevronDown className="transition group-open:rotate-180" size={17} aria-hidden="true" />
          </summary>
          <div className="space-y-2 border-t border-[var(--sm-border)] p-3">
            {answer.sources.map((source, sourceIndex) => (
              <div
                key={`${source.id}-${sourceIndex}`}
                id={sourceAnchor(answer.requestId, sourceIndex)}
                className="scroll-mt-28 rounded-xl border border-[var(--sm-border)] bg-[var(--sm-surface)] p-3"
              >
                {source.authority?.labelTr ? (
                  <div className={`mb-2 inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-black ${authorityStateClass(source.authority)}`}>
                    {source.authority.labelTr}
                    <span aria-hidden="true">·</span>
                    <span>{authorityStateLabel(source.authority)}</span>
                  </div>
                ) : null}
                <div className="text-xs font-black leading-5 text-[var(--sm-text)]">
                  <span className="mr-1 text-blue-700">[{sourceIndex + 1}]</span>
                  {sourceTitle(source)}
                </div>
                <div className="mt-1 text-[11px] font-bold text-[var(--sm-text-muted)]">
                  <strong>Yazar/yıl:</strong>{" "}
                  {sourceAuthorYear(source)}
                </div>
                <div className="mt-1 text-[11px] font-bold text-[var(--sm-text-muted)]">
                  <strong>DOI veya resmî bağlantı:</strong>{" "}
                  {source.doi ? `DOI: ${source.doi}` : source.url ? "Resmî bağlantı mevcut" : "Katalog kaydında belirtilmemiş"}
                </div>
                <dl className="mt-2 grid gap-1.5 rounded-xl border border-[var(--sm-border)] bg-[var(--sm-surface-soft)] p-2 text-[11px] font-semibold leading-5 text-[var(--sm-text-muted)] sm:grid-cols-2">
                  <div><dt className="inline font-black text-[var(--sm-text)]">Kaynak türü: </dt><dd className="inline">{source.sourceType || source.studyType || source.type || "Belirtilmemiş"}</dd></div>
                  <div><dt className="inline font-black text-[var(--sm-text)]">Bölüm/sayfa: </dt><dd className="inline">{source.locator || "Katalog kaydında belirtilmemiş"}</dd></div>
                  <div><dt className="inline font-black text-[var(--sm-text)]">Kanıt düzeyi: </dt><dd className="inline">{source.evidenceLevel || "Kaynak kartında belirtilmemiş"}</dd></div>
                  <div><dt className="inline font-black text-[var(--sm-text)]">Yaş kapsamı: </dt><dd className="inline">{source.ageScope || "Kaynak kartında belirtilmemiş"}</dd></div>
                </dl>
                {!source.supportedClaim && (source.excerptTr || source.excerpt) ? (
                  <div className="mt-2 rounded-xl border border-[var(--sm-border)] bg-[var(--sm-surface-soft)] p-2 text-xs font-medium leading-5 text-[var(--sm-text-soft)]">
                    <strong className="text-[var(--sm-text)]">Geçiş kataloğu özeti:</strong>{" "}
                    {source.excerptTr || source.excerpt}
                    <p className="mt-1 text-[10px] font-semibold text-[var(--sm-text-muted)]">
                      Bu alan passage düzeyinde V3 destek iddiası değildir.
                    </p>
                  </div>
                ) : null}
                {source.supportedClaim ? (
                  <p className="mt-2 text-[11px] font-semibold leading-5 text-[var(--sm-text-muted)]"><strong>Desteklediği sınırlı iddia:</strong> {source.supportedClaim}</p>
                ) : null}
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] font-semibold leading-5 text-amber-900">
                  <strong>Bilinen sınır:</strong> {source.knownBoundary || source.supportedBoundary || source.claimBoundary || source.authority?.boundaryTr || "Kaynak kartında ayrıca belirtilmemiş"}
                </p>
                {source.sampleScope ? (
                  <p className="mt-2 text-[11px] font-semibold leading-5 text-[var(--sm-text-muted)]"><strong>Örneklem sınırı:</strong> {source.sampleScope}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {source.url ? (
                    <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-xl px-2 text-xs font-black text-blue-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                      Kaynağı aç
                    </a>
                  ) : null}
                  <DnaIssueFeedback
                    scope="source"
                    requestId={answer.requestId}
                    sourceId={source.sourceId || source.id}
                    sourceIndex={sourceIndex + 1}
                  />
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {!hasStructuredUnits && answer.limitations.length ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-[var(--sm-surface-soft)] p-3 text-xs font-semibold leading-5 text-[var(--sm-text-soft)]">
          <div className="font-black">Sınırlılıklar</div>
          {answer.limitations.map((limitation) => <p key={limitation} className="mt-1">{limitation}</p>)}
        </div>
      ) : null}

      {answer.safetyBoundary && !hasSafetyBoundaryUnit ? (
        <div className="mt-3 flex items-start gap-2 text-[11px] font-semibold leading-5 text-[var(--sm-text-muted)]">
          <ShieldCheck className="mt-0.5 shrink-0 text-blue-600" size={15} aria-hidden="true" />
          <span>{answer.safetyBoundary}</span>
        </div>
      ) : null}

      {answer.suggestedQuestions.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {answer.suggestedQuestions.slice(0, 3).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onSuggestion(suggestion)}
              className="min-h-11 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-left text-[11px] font-black leading-4 text-blue-700 transition hover:border-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex justify-end">
        <DnaIssueFeedback scope="answer" requestId={answer.requestId} />
      </div>
        </div>
      </div>
    </article>
  )
}

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { questions } from "@/lib/dna/questions"
import { calculateAssessment } from "@/lib/assessment/assessmentEngine"
import { buildAdvancedReport } from "@/lib/dna/reportEngine"
import { extractAgeMonthsFromAnamnez } from "@/lib/dna/ageUtils"
import { buildAnamnezPreview } from "@/lib/dna/anamnezUtils"
import ClinicalReportView from "@/components/report/ClinicalReportView"
const likert = [
  { label: "Hiçbir zaman", value: 1 },
  { label: "Nadiren", value: 2 },
  { label: "Bazen", value: 3 },
  { label: "Sık sık", value: 4 },
  { label: "Her zaman", value: 5 },
]

const perPage = 10

const scaleTitles: Record<string, string> = {
  fizyolojik: "Fizyolojik Regülasyon",
  duyusal: "Duyusal Regülasyon",
  duygusal: "Duygusal Regülasyon",
  bilissel: "Bilişsel Regülasyon",
  yurutucu: "Yürütücü İşlev",
  intero: "İnterosepsiyon",
}

type ClientInfo = {
  id: string
  child_code: string
  anamnez: string | null
  ageMonths: number | null
}

type AiReportResult = {
  report: string
  reportId: string | null
  createdAt: string | null
  existing: boolean
  remainingReportCredits: number | null
}

const ASSESSMENT_DRAFT_PREFIX = "dna:assessment-draft:v1:"

type AssessmentDraft = {
  answers?: number[]
  page?: number
  reportReady?: boolean
  generatedReportText?: string
  generatedReportDate?: string
  savedAt?: string
}

function assessmentDraftKey(clientId?: string | null, clientCode?: string | null) {
  const stableKey = String(clientId || clientCode || "unknown").trim()
  return `${ASSESSMENT_DRAFT_PREFIX}${stableKey || "unknown"}`
}

function sanitizeAnswers(value: unknown) {
  if (!Array.isArray(value) || value.length !== questions.length) {
    return null
  }

  const next = value.map((item) => Number(item))
  if (next.some((item) => !Number.isInteger(item) || item < 1 || item > 5)) {
    return null
  }

  return next
}

function readAssessmentDraft(key: string): AssessmentDraft | null {
  if (typeof window === "undefined") return null

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AssessmentDraft
    return parsed && typeof parsed === "object" ? parsed : null
  } catch {
    return null
  }
}

function writeAssessmentDraft(key: string, draft: AssessmentDraft) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(key, JSON.stringify(draft))
  } catch {
    // Taslak kaydı destek amaçlıdır; tarayıcı izin vermezse ekran içi state çalışmaya devam eder.
  }
}

function clearAssessmentDraft(key?: string) {
  if (typeof window === "undefined" || !key) return

  try {
    window.localStorage.removeItem(key)
  } catch {
    // Ignore storage cleanup failures.
  }
}

function assessmentUserMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "")
  const lower = message.toLowerCase()

  if (lower.includes("stack depth limit exceeded") || lower.includes("infinite recursion")) {
    return "Değerlendirme kaydı oluşturulamadı. Sistem ayarı düzeltildi; lütfen sayfayı yenileyip tekrar deneyin."
  }
  if (lower.includes("row-level security") || lower.includes("permission denied")) {
    return "Bu danışan için kayıt yetkiniz doğrulanamadı. Lütfen tekrar giriş yapıp deneyin."
  }
  if (lower.includes("assessment kaydı")) {
    return "Değerlendirme kaydı oluşturulamadı. Lütfen tekrar deneyin."
  }
  if (lower.includes("rapor kaydı")) {
    return "Rapor kaydı oluşturulamadı. Lütfen tekrar deneyin."
  }
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Bağlantı sorunu yaşandı. İnternet bağlantınızı kontrol edip tekrar deneyin."
  }
  if (
    lower.includes("rapor hakk") ||
    lower.includes("yaş aral") ||
    lower.includes("e-posta doğrul") ||
    lower.includes("skor verisi") ||
    lower.includes("rapor üret")
  ) {
    return message
  }

  return "İşlem tamamlanamadı. Lütfen tekrar deneyin."
}

export default function AssessmentWizardClient() {

  
  const [reportLocked, setReportLocked] = useState(false)
  const [reportLockReason, setReportLockReason] = useState("")

  const checkExistingReportLock = async (clientId?: string | null) => {
    try {
      const normalizedClientId = String(clientId ?? "").trim()
      if (!normalizedClientId) {
        setReportLocked(false)
        setReportLockReason("")
        return false
      }

      const query = new URLSearchParams({ client_id: normalizedClientId })
      const response = await fetch(`/api/app/assessment-context?${query.toString()}`, { cache: "no-store" })
      const data = await response.json().catch(() => null)

      if (response.ok && data?.reportLock?.locked) {
        setReportLocked(true)
        setReportLockReason(
          data.reportLock.reason ||
            "Bu vaka için rapor daha önce oluşturulmuş. Mevcut raporu Rapor Geçmişi ekranından görüntüleyebilirsiniz."
        )
        return true
      }

      setReportLocked(false)
      setReportLockReason("")
      return false
    } catch (error) {
      console.error("report lock check failed", error)
      return false
    }
  }

  const router = useRouter()
  const searchParams = useSearchParams()
  const clientCode = searchParams.get("client") || ""
  const clientIdParam = searchParams.get("client_id") || ""
  const appSurface = searchParams.get("surface") === "app"

  const withSurface = (path: string) => {
    if (!appSurface) return path
    const separator = path.includes("?") ? "&" : "?"
    return `${path}${separator}surface=app`
  }

  const [answers, setAnswers] = useState<number[]>(Array(questions.length).fill(3))
  const [page, setPage] = useState(0)
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null)
  const activeDraftKeyRef = useRef("")
  const draftHydratedRef = useRef(false)

  useEffect(() => {
    const clientId = (clientInfo as any)?.id ?? null

    if (clientId) {
      void checkExistingReportLock(clientId)
    }
  }, [clientInfo])

  const [loadingClient, setLoadingClient] = useState(true)
  const [clientError, setClientError] = useState<string | null>(null)
  const [reportReady, setReportReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [generatedReportText, setGeneratedReportText] = useState<string>("")
  const [generatedReportDate, setGeneratedReportDate] = useState<string>("")

  useEffect(() => {
    setClientInfo(null)
    setClientError(null)
    setLoadingClient(true)
    setReportLocked(false)
    setReportLockReason("")
    setReportReady(false)
    setSaveMsg(null)
    setGeneratedReportText("")
    setGeneratedReportDate("")
    setPage(0)
    setAnswers(Array(questions.length).fill(3))
    activeDraftKeyRef.current = ""
    draftHydratedRef.current = false
  }, [clientCode, clientIdParam])

  useEffect(() => {
    let mounted = true

    async function loadClient() {
      const normalizedClientCode = clientCode.trim().toUpperCase()
      const normalizedClientId = clientIdParam.trim()

      if (!normalizedClientCode && !normalizedClientId) {
        if (!mounted) return
        setClientInfo(null)
        setClientError("Önce danışan seçilmelidir. Danışan Listesi üzerinden “Skor Gir” ile ilerleyin.")
        setLoadingClient(false)
        return
      }

      setLoadingClient(true)
      setClientError(null)
      const query = new URLSearchParams()
      if (normalizedClientId) query.set("client_id", normalizedClientId)
      if (normalizedClientCode) query.set("client", normalizedClientCode)
      const response = await fetch(`/api/app/assessment-context?${query.toString()}`, { cache: "no-store" })
      const payload = await response.json().catch(() => null)

      if (!mounted) return

      if (!response.ok || payload?.ok === false) {
        setClientInfo(null)
        setClientError(
          payload?.error === "client_not_found"
            ? "Bu kodla eşleşen danışan bulunamadı."
            : "Danışan bilgisi alınamadı. Lütfen tekrar deneyin."
        )
        setLoadingClient(false)
        return
      }

      const row = payload?.client

      setClientInfo({
        id: row.id,
        child_code: row.child_code,
        anamnez: row.anamnez,
        ageMonths: extractAgeMonthsFromAnamnez(row.anamnez),
      })
      if (payload?.reportLock?.locked) {
        setReportLocked(true)
        setReportLockReason(
          payload.reportLock.reason ||
            "Bu vaka için rapor daha önce oluşturulmuş. Mevcut raporu Rapor Geçmişi ekranından görüntüleyebilirsiniz."
        )
      }
      setLoadingClient(false)
    }

    loadClient()

    return () => {
      mounted = false
    }
  }, [clientCode, clientIdParam])

  const totalPages = Math.ceil(questions.length / perPage)
  const start = page * perPage
  const end = start + perPage
  const current = questions.slice(start, end)

  const currentScale = current[0]?.scale ?? ""
  const currentScaleTitle = scaleTitles[currentScale] ?? "Değerlendirme"

  const progress = useMemo(() => {
    if (page >= totalPages) return 100
    return Math.round(((page + 1) / totalPages) * 100)
  }, [page, totalPages])

  const result = useMemo(() => calculateAssessment(answers), [answers])

  useEffect(() => {
    if (!clientInfo) return

    const key = assessmentDraftKey(clientInfo.id, clientInfo.child_code)
    activeDraftKeyRef.current = key

    const draft = readAssessmentDraft(key)
    const draftAnswers = sanitizeAnswers(draft?.answers)

    if (draftAnswers) {
      setAnswers(draftAnswers)
    }
    if (typeof draft?.page === "number" && draft.page >= 0 && draft.page <= totalPages) {
      setPage(draft.page)
    }
    if (typeof draft?.generatedReportText === "string" && draft.generatedReportText.trim()) {
      setGeneratedReportText(draft.generatedReportText)
      setReportReady(Boolean(draft.reportReady))
    }
    if (typeof draft?.generatedReportDate === "string") {
      setGeneratedReportDate(draft.generatedReportDate)
    }

    draftHydratedRef.current = true
  }, [clientInfo, totalPages])

  useEffect(() => {
    if (!draftHydratedRef.current || !activeDraftKeyRef.current || reportLocked) return

    writeAssessmentDraft(activeDraftKeyRef.current, {
      answers,
      page,
      reportReady,
      generatedReportText,
      generatedReportDate,
      savedAt: new Date().toISOString(),
    })
  }, [answers, generatedReportDate, generatedReportText, page, reportLocked, reportReady])

  const advancedReport = useMemo(() => {
    if (!clientInfo) return null

    return buildAdvancedReport({
      clientCode: clientInfo.child_code,
      anamnez: clientInfo.anamnez || "",
      ageMonths: clientInfo.ageMonths,
      answers,
      scores: {
        fizyolojik: result.fizyolojik,
        duyusal: result.duyusal,
        duygusal: result.duygusal,
        bilissel: result.bilissel,
        yurutucu: result.yurutucu,
        intero: result.intero,
        toplam: result.toplam,
      },
    })
  }, [clientInfo, result])

  async function generateAIReport(payload: {
    assessmentId: string
    clientId: string
    clientCode: string
    ageMonths: number | null
    anamnez: string
    answers: number[]
    scores: Record<string, unknown>
    deterministicReport: string
  }): Promise<AiReportResult> {
    const res = await fetch("/api/ai-report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-dna-request": "same-origin",
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json().catch(() => null)

    if (!res.ok || !data?.ok) {
      if (res.status === 402 || data?.error === "report_credit_required") {
        throw new Error("Rapor hakkınız bulunmuyor. Paketler ekranından ek rapor hakkı satın alın.")
      }
      if (res.status === 403 && data?.error === "Email confirmation required") {
        throw new Error("Rapor üretimi için e-posta doğrulaması gerekiyor.")
      }
      if (data?.error === "invalid_input") {
        throw new Error("Rapor üretimi için skor verisi eksik veya hatalı görünüyor.")
      }
      throw new Error(data?.error || "Rapor üretilemedi. Lütfen danışan yaşı, skorlar ve rapor hakkını kontrol edin.")
    }

    return {
      report: String(data.report || "").trim(),
      reportId: typeof data.reportId === "string" ? data.reportId : null,
      createdAt: typeof data.createdAt === "string" ? data.createdAt : null,
      existing: Boolean(data.existing),
      remainingReportCredits:
        typeof data.remainingReportCredits === "number" ? data.remainingReportCredits : null,
    }
  }

  function handleSelect(index: number, value: number) {
    const copy = [...answers]
    copy[index] = value
    setAnswers(copy)
    if (reportReady) {
      setReportReady(false)
      setSaveMsg(null)
      setGeneratedReportText("")
    }
  }

  function nextPage() {
    if (page < totalPages) {
      setPage((p) => p + 1)
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  function prevPage() {
    if (page > 0) {
      setPage((p) => p - 1)
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  async function handleGenerateReport() {
    if (reportLocked) {
      setSaveMsg(reportLockReason || "Bu vaka için rapor daha önce oluşturulduğu için yeni rapor üretimi kapatılmıştır.")
      return
    }
    if (!clientInfo || !advancedReport) return

    try {
      setSaving(true)
      setSaveMsg(null)
      setGeneratedReportDate("")

      const alreadyLocked = await checkExistingReportLock(clientInfo.id)
      if (alreadyLocked) {
        setSaveMsg("Bu vaka için rapor daha önce oluşturulmuş. Mevcut raporu Rapor Geçmişi ekranından görüntüleyin.")
        return
      }

      const assessmentResponse = await fetch("/api/app/assessment-context", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dna-request": "same-origin",
        },
        body: JSON.stringify({ clientId: clientInfo.id }),
      })
      const assessmentPayload = await assessmentResponse.json().catch(() => null)

      if (assessmentResponse.status === 409 || assessmentPayload?.error === "report_already_exists") {
        setReportLocked(true)
        setReportLockReason(
          assessmentPayload?.reportLock?.reason ||
            "Bu vaka için rapor daha önce oluşturulmuş. Mevcut raporu Rapor Geçmişi ekranından görüntüleyin."
        )
        setSaveMsg("Bu vaka için rapor daha önce oluşturulmuş. Mevcut raporu Rapor Geçmişi ekranından görüntüleyin.")
        return
      }

      if (!assessmentResponse.ok || assessmentPayload?.ok === false || !assessmentPayload?.assessmentId) {
        throw new Error("Assessment kaydı oluşturulamadı.")
      }

      const assessmentId = assessmentPayload.assessmentId

      const aiReportResult = await generateAIReport({
        assessmentId,
        clientId: clientInfo.id,
        clientCode: clientInfo.child_code,
        ageMonths: clientInfo.ageMonths,
        anamnez: String(clientInfo.anamnez || ""),
        answers,
        scores: {
          fizyolojik: result.fizyolojik,
          duyusal: result.duyusal,
          duygusal: result.duygusal,
          bilissel: result.bilissel,
          yurutucu: result.yurutucu,
          intero: result.intero,
          toplam: result.toplam,
          siniflama: advancedReport.globalLevel,
          age_months: clientInfo.ageMonths,
          norm_source: advancedReport.normSource,
          age_band_label: advancedReport.ageBandLabel,
          domain_levels: advancedReport.domainLevels ?? advancedReport.domains,
        },
        deterministicReport: advancedReport.deterministicReport,
      })
      const aiReportText = aiReportResult.report

      setGeneratedReportText(aiReportText)
      setGeneratedReportDate(aiReportResult.createdAt || new Date().toISOString())
      setReportReady(true)
      clearAssessmentDraft(activeDraftKeyRef.current)
      setSaveMsg(
        aiReportResult.existing
          ? "Bu vaka için rapor daha önce oluşturulmuş. Mevcut rapor açıldı; yeni hak düşülmedi."
          : aiReportResult.remainingReportCredits == null
            ? "Rapor başarıyla oluşturuldu ve geçmişe kaydedildi."
            : `Rapor başarıyla oluşturuldu ve geçmişe kaydedildi. Kalan rapor hakkı: ${aiReportResult.remainingReportCredits}`
      )
      if (typeof window !== "undefined") {
        setTimeout(() => {
          window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
        }, 100)
      }
    } catch (err: unknown) {
      console.error("assessment report flow failed", err)
      setSaveMsg(assessmentUserMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const isResultPage = page >= totalPages
  const anamnezPreview = buildAnamnezPreview(clientInfo?.anamnez, { maxLength: 260 })
  const agePreview = clientInfo?.ageMonths ? `${clientInfo.ageMonths} ay` : "Belirsiz"


  const hasSelectedClient = Boolean(clientInfo)

  if (!loadingClient && !hasSelectedClient) {
    return (
      <div className="px-4 py-6 md:px-6 md:py-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6">
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Klinik Değerlendirme
          </div>

          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">
            DNA Intelligence Değerlendirme Sistemi
          </h1>

          <p className="mt-4 text-base leading-7 text-slate-500">
            Terapist değerlendirmesi için 6 alanda toplam 60 soru bulunur. Varsayılan seçim “Bazen” olarak gelir.
          </p>

          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-base font-medium text-rose-600">
            Önce danışan seçilmelidir. Danışan Listesi üzerinden “Skor Gir” ile ilerleyin.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="dna-app-only dna-app-page">
        <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="dna-app-section-title">Klinik değerlendirme</div>
          <h1 className="mt-2 text-[24px] font-black leading-tight text-[#071b3a]">
            {isResultPage ? "Değerlendirme sonucu" : currentScaleTitle}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
            <span>{clientInfo?.child_code || clientCode || "Danışan seçilmedi"}</span>
            <span>·</span>
            <span>{isResultPage ? "Sonuç" : `Bölüm ${page + 1}/${totalPages}`}</span>
            <span>·</span>
            <span>%{progress}</span>
          </div>
          <div className="mt-4 h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          {loadingClient ? (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Danışan bilgisi yükleniyor...
            </div>
          ) : clientError ? (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {clientError}
            </div>
          ) : reportLocked ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {reportLockReason || "Bu vaka için rapor daha önce oluşturulmuş. Mevcut raporu Rapor Geçmişi ekranından görüntüleyebilirsiniz."}
            </div>
          ) : null}
          {clientInfo ? (
            <button
              type="button"
              onClick={() => router.push(withSurface(`/clients/${clientInfo.id}`))}
              className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm"
            >
              Anamnez kaydına dön
            </button>
          ) : null}
        </section>
      </div>

      <div className="dna-web-only dna-card p-4 md:p-6">
        <div className="text-xs font-medium text-slate-400">Klinik Değerlendirme</div>

        <div className="mt-2 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">DNA Intelligence Değerlendirme Sistemi</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Terapist değerlendirmesi için 6 alanda toplam 60 soru bulunur. Varsayılan seçim “Bazen” olarak gelir.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {isResultPage ? "Sonuç ekranı" : `Bölüm ${page + 1} / ${totalPages}`}
          </div>
        </div>

        {loadingClient ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Danışan bilgisi yükleniyor...
          </div>
        ) : clientError ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {clientError}
          </div>
        ) : clientInfo ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-[280px_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Danışan</div>
              <div className="mt-2 font-mono text-xl font-semibold text-slate-900">{clientInfo.child_code}</div>
              <div className="mt-1 text-sm text-slate-500">Değerlendirme bu vaka kaydı üzerinden ilerler.</div>

              <div className="mt-2 text-sm text-slate-600">Yaş: {agePreview}</div>
              <button
                type="button"
                onClick={() => router.push(withSurface(`/clients/${clientInfo.id}`))}
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Anamnez kaydına dön
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Anamnez Özeti</div>
              <div className="mt-2 text-sm leading-6 text-slate-600">{anamnezPreview}</div>
            </div>
          </div>
        ) : null}

        {!loadingClient && !clientError && clientInfo ? (
          <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
            Test cevapları bu cihazda otomatik korunur. Bölümler arasında ileri geri geçebilir, anamnez kaydına dönüp sonra skor girişine devam edebilirsiniz.
          </div>
        ) : null}

        {!loadingClient && !clientError && reportLocked && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {reportLockReason || "Bu vaka için daha önce rapor oluşturulmuş. Mevcut raporu Rapor Geçmişi ekranından görüntüleyebilirsiniz."}
          </div>
        )}

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>{isResultPage ? "Tamamlandı" : currentScaleTitle}</span>
            <span>%{progress}</span>
          </div>
          <div className="h-3 w-full rounded-full bg-slate-200">
            <div
              className="h-3 rounded-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {!isResultPage && !clientError && !loadingClient && (
        <div className="space-y-5">
          {current.map((q, idx) => {
            const absoluteIndex = start + idx
            return (
              <div key={q.id} className="dna-card p-4 md:p-5">
                <div className="mb-4 text-base font-medium text-slate-900">
                  {absoluteIndex + 1}. {q.text}
                </div>

                <div className="dna-likert-grid grid gap-2 sm:grid-cols-5">
                  {likert.map((item) => {
                    const selected = answers[absoluteIndex] === item.value
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => handleSelect(absoluteIndex, item.value)}
                        className={`min-h-12 rounded-xl border px-3 py-3 text-sm font-medium transition ${
                          selected
                            ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                            : "border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
                        }`}
                      >
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          <div className="dna-app-sticky-actions grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={prevPage}
              disabled={page === 0}
              className="dna-btn-ghost px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            >
              Geri
            </button>

            <button
              type="button"
              onClick={nextPage}
              className="dna-btn px-5 py-2.5 text-sm font-semibold"
            >
              {page === totalPages - 1 ? "Sonuçları Gör" : "Sonraki Bölüm"}
            </button>
          </div>
        </div>
      )}

      {isResultPage && !clientError && !loadingClient && (
        <>
          <div className="dna-card p-6">
            <h2 className="text-xl font-semibold text-slate-900">Değerlendirme Sonucu</h2>

            <div className="dna-result-cards mt-5 space-y-3 md:hidden">
              {advancedReport?.domains.map((d) => (
                <div key={d.name} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-semibold text-slate-900">{d.name}</div>
                    <span className="inline-flex shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {d.level}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">{d.score} / 50</div>
                </div>
              ))}
            </div>

            <div className="dna-result-table mt-5 hidden overflow-hidden rounded-2xl border border-slate-200 bg-white md:block">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Alan</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Skor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Düzey</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {advancedReport?.domains.map((d) => (
                    <tr key={d.name}>
                      <td className="px-4 py-3 text-slate-900">{d.name}</td>
                      <td className="px-4 py-3 text-slate-700">{d.score} / 50</td>
                      <td className="px-4 py-3 text-slate-700">{d.level}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-sm text-slate-500">Toplam Skor</div>
              <div className="mt-2 text-4xl font-semibold text-slate-900">{result.toplam}</div>
              <div className="mt-4 text-sm text-slate-500">Genel Sınıflama</div>
              <div className="mt-1 text-xl font-semibold text-slate-900">{advancedReport?.globalLevel || result.siniflama}</div>
            </div>

            {saveMsg && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {saveMsg}
              </div>
            )}

            <div className="dna-app-sticky-actions mt-6 grid gap-2 sm:flex sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={prevPage}
                className="dna-btn-ghost px-5 py-2.5 text-sm font-semibold"
              >
                Son Bölüme Dön
              </button>

              <div className="grid gap-2 sm:flex">
                {clientInfo ? (
                  <button
                    type="button"
                    onClick={() => router.push(withSurface(`/clients/${clientInfo.id}`))}
                    className="dna-btn-ghost px-5 py-2.5 text-sm font-semibold"
                  >
                    Anamnez Kaydı
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => router.push(withSurface("/reports"))}
                  className="dna-btn-ghost px-5 py-2.5 text-sm font-semibold"
                >
                  Rapor Geçmişi
                </button>

                <button
                  type="button"
                  onClick={handleGenerateReport}
                  disabled={saving || reportLocked}
                  className="dna-btn px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {reportLocked ? "Rapor Kilitli" : saving ? "Kaydediliyor..." : "Rapor Oluştur"}
                </button>
              </div>
            </div>
          </div>

          {reportReady && advancedReport && (
            <>
              <div className="dna-card p-6">
                <div className="text-xs font-medium text-slate-400">Örüntü Analizi</div>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">Karar Motoru Bulguları</h3>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="text-sm font-semibold text-slate-900">Görece Zayıf Alanlar</div>
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      {advancedReport.weakDomains.length > 0 ? (
                        advancedReport.weakDomains.map((d) => (
                          <div key={d.name}>- {d.name}: {d.score}/50 ({d.level})</div>
                        ))
                      ) : (
                        <div>- Belirgin görece zayıf alan saptanmadı.</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="text-sm font-semibold text-slate-900">Görece Güçlü Alanlar</div>
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      {advancedReport.strongDomains.length > 0 ? (
                        advancedReport.strongDomains.map((d) => (
                          <div key={d.name}>- {d.name}: {d.score}/50 ({d.level})</div>
                        ))
                      ) : (
                        <div>- Belirgin görece güçlü alan saptanmadı.</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-sm font-semibold text-slate-900">Ölçekler Arası Teknik Yorum</div>
                  <div className="mt-3 space-y-2 text-sm leading-7 text-slate-700">
                    {advancedReport.patterns.map((p, i) => (
                      <div key={i}>- {p}</div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-sm font-semibold text-slate-900">Anamnezden Eşleşen Temalar</div>
                  <div className="mt-3 space-y-2 text-sm leading-7 text-slate-700">
                    {advancedReport.anamnezFlags.length > 0 ? (
                      advancedReport.anamnezFlags.map((f, i) => <div key={i}>- {f}</div>)
                    ) : (
                      <div>- Belirgin anahtar tema saptanmadı.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="dna-card dna-print-report-shell p-6">
                <div className="dna-print-hide flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-400">Klinik Rapor</div>
                    <h3 className="mt-1 text-xl font-semibold text-slate-900">Klinik Yorum</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
                  >
                    PDF / Yazdır
                  </button>
                </div>

                <ClinicalReportView
                  className="mt-5"
                  text={generatedReportText || advancedReport.deterministicReport}
                  reportDate={generatedReportDate || new Date().toISOString()}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

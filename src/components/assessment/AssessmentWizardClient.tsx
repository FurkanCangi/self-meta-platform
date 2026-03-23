"use client"

import { supabase } from "@/lib/supabase/client"
import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { questions } from "@/lib/selfmeta/questions"
import { calculateAssessment } from "@/lib/assessment/assessmentEngine"
import { buildAdvancedReport } from "@/lib/selfmeta/reportEngine"
import { extractAgeMonthsFromAnamnez, parseAgeMonths } from "@/lib/selfmeta/ageUtils"
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

export default function AssessmentWizardClient() {

  const [reportLocked, setReportLocked] = useState(false)
  const [reportLockReason, setReportLockReason] = useState("")
  const selfMetaSupabase = supabase

  const checkExistingReportLock = async (clientCode?: string | number | null) => {
    try {
      const normalized = String(clientCode ?? "").trim()
      if (!normalized) return

      const { data, error } = await selfMetaSupabase
        .from("reports")
        .select("id, report_text, client_code, created_at")
        .eq("client_code", normalized)
        .not("report_text", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)

      if (!error && data && data.length > 0) {
        setReportLocked(true)
        setReportLockReason("Bu vaka için rapor daha önce oluşturulmuş. Yeniden rapor alınamaz.")
      } else {
        setReportLocked(false)
        setReportLockReason("")
      }
    } catch (error) {
      console.error("report lock check failed", error)
    }
  }

  const router = useRouter()
  const searchParams = useSearchParams()
  const clientCode = searchParams.get("client") || ""

  const [answers, setAnswers] = useState<number[]>(Array(questions.length).fill(3))
  const [page, setPage] = useState(0)
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null)

  useEffect(() => {
    const clientCode =
      (clientInfo as any)?.code ??
      (clientInfo as any)?.client_code ??
      (clientInfo as any)?.id ??
      null

    if (clientCode) {
      void checkExistingReportLock(clientCode)
    }
  }, [clientInfo])

  const [loadingClient, setLoadingClient] = useState(true)
  const [clientError, setClientError] = useState<string | null>(null)
  const [reportReady, setReportReady] = useState(false)
const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [generatedReportText, setGeneratedReportText] = useState<string>("")
  useEffect(() => {
    let mounted = true

    async function loadClient() {
      if (!clientCode) {
        if (!mounted) return
        setClientInfo(null)
        setClientError("Önce danışan seçilmelidir. Danışan Listesi üzerinden “Skor Gir” ile ilerleyin.")
        setLoadingClient(false)
        return
      }

      setLoadingClient(true)
      setClientError(null)

      const { data, error } = await supabase
        .from("clients")
        .select("id, child_code, anamnez")
        .eq("child_code", clientCode)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle()

      if (!mounted) return

      if (error) {
        setClientInfo(null)
        setClientError("Danışan bilgisi alınamadı: " + error.message)
        setLoadingClient(false)
        return
      }

      if (!data) {
        setClientInfo(null)
        setClientError("Bu kodla eşleşen danışan bulunamadı.")
        setLoadingClient(false)
        return
      }

      setClientInfo({
        id: data.id,
        child_code: data.child_code,
        anamnez: data.anamnez,
        ageMonths: extractAgeMonthsFromAnamnez(data.anamnez),
      })
      setLoadingClient(false)
    }

    loadClient()

    return () => {
      mounted = false
    }
  }, [clientCode])

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

  const advancedReport = useMemo(() => {
    if (!clientInfo) return null

    return buildAdvancedReport({
      clientCode: clientInfo.child_code,
      anamnez: clientInfo.anamnez || "",
      ageMonths: clientInfo.ageMonths,
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
    clientCode: string
    anamnez: string
    scores: Record<string, unknown>
    deterministicReport: string
  }) {
    const res = await fetch("/api/ai-report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json()

    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || "AI rapor üretilemedi.")
    }

    return String(data.report || "").trim()
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

      const today = new Date().toISOString().slice(0, 10)

      const { data: assessmentRow, error: assessmentErr } = await supabase
        .from("assessments_v2")
        .insert({
          client_id: clientInfo.id,
          label: "Self Meta Değerlendirme",
          assessment_date: today,
        })
        .select("id")
        .single()

      if (assessmentErr) throw new Error("Assessment kaydı oluşturulamadı: " + assessmentErr.message)

      const assessmentId = assessmentRow.id

      const aiReportText = await generateAIReport({
        clientCode: clientInfo.child_code,
        anamnez: String(clientInfo.anamnez || ""),
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

      setGeneratedReportText(aiReportText)

      const snapshotJson = {
        client_code: clientInfo.child_code,
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
        },
        age_months: clientInfo.ageMonths,
        norm_source: advancedReport.normSource,
        age_band_label: advancedReport.ageBandLabel,
        domain_levels: advancedReport.domainLevels ?? advancedReport.domains,
        weak_domains: advancedReport.weakDomains,
        strong_domains: advancedReport.strongDomains,
        patterns: advancedReport.patterns,
        anamnez_flags: advancedReport.anamnezFlags,
        ai_report_text: aiReportText,
      }

      const { error: reportErr } = await supabase
        .from("reports")
        .insert({
          assessment_id: assessmentId,
          version: 1,
          report_text: aiReportText || advancedReport.deterministicReport,
          immutable: true,
          snapshot_json: snapshotJson,
        })

      if (reportErr) throw new Error("Rapor kaydı oluşturulamadı: " + reportErr.message)

      setReportReady(true)
      setSaveMsg("Rapor başarıyla oluşturuldu ve geçmişe kaydedildi.")
      if (typeof window !== "undefined") {
        setTimeout(() => {
          window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
        }, 100)
      }
    } catch (err: any) {
      setSaveMsg(err?.message || "Beklenmeyen bir hata oluştu.")
    } finally {
      setSaving(false)
    }
  }

  const isResultPage = page >= totalPages
  const anamnezPreview =
    clientInfo?.anamnez?.replace(/\n+/g, " ").slice(0, 220) || "Anamnez bilgisi bulunmuyor."
  const agePreview = clientInfo?.ageMonths ? `${clientInfo.ageMonths} ay` : "Belirsiz"


  const hasSelectedClient = Boolean(clientInfo)

  if (!loadingClient && !hasSelectedClient) {
    return (
      <div className="px-6 py-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Klinik Değerlendirme
          </div>

          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
            Self Meta Değerlendirme Sistemi
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
      <div className="selfmeta-card p-6">
        <div className="text-xs font-medium text-slate-400">Klinik Değerlendirme</div>

        <div className="mt-2 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Self Meta Değerlendirme Sistemi</h1>
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
              <div className="mt-2 text-xl font-semibold text-slate-900">{clientInfo.child_code}</div>
              <div className="mt-1 text-sm text-slate-500">Değerlendirme bu vaka kaydı üzerinden ilerler.</div>
              <div className="mt-2 text-sm text-slate-600">Yaş: {agePreview}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Anamnez Özeti</div>
              <div className="mt-2 text-sm leading-6 text-slate-600">{anamnezPreview}</div>
            </div>
          </div>
        ) : null}

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
              <div key={q.id} className="selfmeta-card p-5">
                <div className="mb-4 text-base font-medium text-slate-900">
                  {absoluteIndex + 1}. {q.text}
                </div>

                <div className="grid gap-2 md:grid-cols-5">
                  {likert.map((item) => {
                    const selected = answers[absoluteIndex] === item.value
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => handleSelect(absoluteIndex, item.value)}
                        className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
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

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={prevPage}
              disabled={page === 0}
              className="selfmeta-btn-ghost px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            >
              Geri
            </button>

            <button
              type="button"
              onClick={nextPage}
              className="selfmeta-btn px-5 py-2.5 text-sm font-semibold"
            >
              {page === totalPages - 1 ? "Sonuçları Gör" : "Sonraki Bölüm"}
            </button>
          </div>
        </div>
      )}

      {isResultPage && !clientError && !loadingClient && (
        <>
          <div className="selfmeta-card p-6">
            <h2 className="text-xl font-semibold text-slate-900">Değerlendirme Sonucu</h2>

            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
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

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={prevPage}
                className="selfmeta-btn-ghost px-5 py-2.5 text-sm font-semibold"
              >
                Son Bölüme Dön
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => router.push("/reports")}
                  className="selfmeta-btn-ghost px-5 py-2.5 text-sm font-semibold"
                >
                  Rapor Geçmişi
                </button>

                <button
                  type="button"
                  onClick={handleGenerateReport}
                  disabled={saving || reportLocked}
                  className="selfmeta-btn px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Kaydediliyor..." : "Rapor Oluştur"}
                </button>
              </div>
            </div>
          </div>

          {reportReady && advancedReport && (
            <>
              <div className="selfmeta-card p-6">
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

              <div className="selfmeta-card p-6">
                <div className="text-xs font-medium text-slate-400">AI Rapor</div>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">Klinik Yorum</h3>

                <div className="mt-5 whitespace-pre-line rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-700">
                  {generatedReportText || advancedReport.deterministicReport}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

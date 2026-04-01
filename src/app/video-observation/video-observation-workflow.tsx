"use client"

import { startTransition, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

type SegmentType = "solo" | "dyadic" | "transition"

type SegmentDraft = {
  file: File | null
  notes: string
  status: "idle" | "uploading" | "uploaded" | "error"
  detail: string
  progress: number
  previewUrl: string
}

type SessionFormState = {
  childLabel: string
  childExternalRef: string
  ageMonths: string
  sessionNotes: string
  anamnesisSummary: string
  therapistComments: string
  createdBy: string
  clinicalFocusAreas: string
}

const SEGMENT_ORDER: SegmentType[] = ["solo", "dyadic", "transition"]

const SEGMENT_LABELS: Record<SegmentType, string> = {
  solo: "Serbest Oyun / Solo",
  dyadic: "Ebeveyn Eşli / Dyadic",
  transition: "Geçiş / Frustrasyon",
}

const INITIAL_FORM: SessionFormState = {
  childLabel: "",
  childExternalRef: "",
  ageMonths: "",
  sessionNotes: "",
  anamnesisSummary: "",
  therapistComments: "",
  createdBy: "therapist-panel",
  clinicalFocusAreas: "attention_play,behavioral_organization,co_regulation_openness",
}

function buildInitialSegments(): Record<SegmentType, SegmentDraft> {
  return {
    solo: { file: null, notes: "", status: "idle", detail: "", progress: 0, previewUrl: "" },
    dyadic: { file: null, notes: "", status: "idle", detail: "", progress: 0, previewUrl: "" },
    transition: { file: null, notes: "", status: "idle", detail: "", progress: 0, previewUrl: "" },
  }
}

function statusTone(status: SegmentDraft["status"]) {
  if (status === "uploaded") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (status === "uploading") return "bg-indigo-50 text-indigo-700 border-indigo-200"
  if (status === "error") return "bg-rose-50 text-rose-700 border-rose-200"
  return "bg-slate-100 text-slate-600 border-slate-200"
}

async function readError(response: Response) {
  try {
    const json = await response.json()
    return json?.detail || json?.message || JSON.stringify(json)
  } catch {
    return `${response.status}`
  }
}

function revokePreviewUrl(url: string | null | undefined) {
  if (!url) return
  try {
    URL.revokeObjectURL(url)
  } catch {
    // noop
  }
}

function revokeAllPreviewUrls(segments: Record<SegmentType, SegmentDraft>) {
  for (const segmentType of SEGMENT_ORDER) {
    revokePreviewUrl(segments[segmentType].previewUrl)
  }
}

async function uploadBinaryWithProgress(
  url: string,
  file: File,
  onProgress: (value: number) => void
) {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url)
    xhr.setRequestHeader("content-type", file.type || "video/mp4")

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      onProgress(Math.round((event.loaded / event.total) * 100))
    }

    xhr.onerror = () => reject(new Error("upload_failed"))
    xhr.onabort = () => reject(new Error("upload_aborted"))
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100)
        resolve()
        return
      }

      try {
        const parsed = JSON.parse(xhr.responseText)
        reject(new Error(parsed?.detail || parsed?.message || `upload_${xhr.status}`))
      } catch {
        reject(new Error(xhr.responseText || `upload_${xhr.status}`))
      }
    }

    xhr.send(file)
  })
}

export default function VideoObservationWorkflow({
  initialSessionId,
}: {
  initialSessionId?: string
}) {
  const router = useRouter()
  const [form, setForm] = useState<SessionFormState>(INITIAL_FORM)
  const [segments, setSegments] = useState<Record<SegmentType, SegmentDraft>>(buildInitialSegments)
  const [sessionId, setSessionId] = useState(initialSessionId || "")
  const [busy, setBusy] = useState(false)
  const [statusText, setStatusText] = useState("")
  const [errorText, setErrorText] = useState("")
  const previewUrlsRef = useRef<Record<SegmentType, string>>({
    solo: "",
    dyadic: "",
    transition: "",
  })

  const readySegmentCount = useMemo(
    () => SEGMENT_ORDER.filter((key) => segments[key].file).length,
    [segments]
  )

  function updateSegment(segmentType: SegmentType, patch: Partial<SegmentDraft>) {
    setSegments((current) => ({
      ...current,
      [segmentType]: { ...current[segmentType], ...patch },
    }))
  }

  function updateForm<K extends keyof SessionFormState>(key: K, value: SessionFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleSegmentFileChange(segmentType: SegmentType, file: File | null) {
    const previousPreviewUrl = previewUrlsRef.current[segmentType]
    const nextPreviewUrl = file ? URL.createObjectURL(file) : ""
    revokePreviewUrl(previousPreviewUrl)
    previewUrlsRef.current[segmentType] = nextPreviewUrl

    updateSegment(segmentType, {
      file,
      status: "idle",
      detail: "",
      progress: 0,
      previewUrl: nextPreviewUrl,
    })
  }

  function resetWorkflowState() {
    revokeAllPreviewUrls(segments)
    previewUrlsRef.current = { solo: "", dyadic: "", transition: "" }
    setForm(INITIAL_FORM)
    setSegments(buildInitialSegments())
    setSessionId("")
    setStatusText("")
    setErrorText("")
  }

  useEffect(() => {
    return () => {
      for (const segmentType of SEGMENT_ORDER) {
        revokePreviewUrl(previewUrlsRef.current[segmentType])
      }
    }
  }, [])

  async function createSessionRequest() {
    const payload = {
      child_label: form.childLabel.trim(),
      child_external_ref: form.childExternalRef.trim() || null,
      age_months: Number(form.ageMonths),
      created_by: form.createdBy.trim() || null,
      consent_flags: { video_storage: true, clinician_review: true },
      session_notes: form.sessionNotes.trim() || null,
      anamnesis_summary: form.anamnesisSummary.trim() || null,
      therapist_comments: form.therapistComments.trim() || null,
      clinical_focus_areas: form.clinicalFocusAreas
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      self_meta_context: null,
    }

    const response = await fetch("/api/video-observation/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(await readError(response))
    }

    return response.json()
  }

  async function uploadSegment(sessionIdValue: string, segmentType: SegmentType, draft: SegmentDraft) {
    if (!draft.file) return

    try {
      updateSegment(segmentType, {
        status: "uploading",
        detail: "Upload hedefi alınıyor...",
        progress: 5,
      })

      const presignResponse = await fetch(
        `/api/video-observation/sessions/${sessionIdValue}/segments/presign`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            segment_type: segmentType,
            file_name: draft.file.name,
            content_type: draft.file.type || "video/mp4",
          }),
        }
      )

      if (!presignResponse.ok) {
        throw new Error(`${SEGMENT_LABELS[segmentType]}: ${await readError(presignResponse)}`)
      }

      const presign = await presignResponse.json()

      updateSegment(segmentType, { detail: "Video yükleniyor...", progress: 10 })

      await uploadBinaryWithProgress(
        `/api/video-observation/sessions/${sessionIdValue}/segments/upload/${segmentType}?upload_key=${encodeURIComponent(
          presign.upload_key
        )}`,
        draft.file,
        (value) => {
          updateSegment(segmentType, {
            detail: `Video yükleniyor... %${value}`,
            progress: Math.max(10, value),
          })
        }
      )

      updateSegment(segmentType, { detail: "Segment tamamlanıyor...", progress: 95 })

      const completeResponse = await fetch(
        `/api/video-observation/sessions/${sessionIdValue}/segments/complete`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            segment_type: segmentType,
            upload_key: presign.upload_key,
            protocol_notes: draft.notes.trim() || null,
            signal_hints: {},
            source_metadata: {
              original_file_name: draft.file.name,
              mime_type: draft.file.type || "video/mp4",
              byte_size: draft.file.size,
            },
          }),
        }
      )

      if (!completeResponse.ok) {
        throw new Error(`${SEGMENT_LABELS[segmentType]}: ${await readError(completeResponse)}`)
      }

      updateSegment(segmentType, {
        status: "uploaded",
        detail: "Yüklendi ve işlendi.",
        progress: 100,
      })
    } catch (error) {
      updateSegment(segmentType, {
        status: "error",
        detail: error instanceof Error ? error.message : "Segment yüklenemedi.",
      })
      throw error
    }
  }

  async function pollUntilReady(sessionIdValue: string) {
    const maxAttempts = 40
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await fetch(`/api/video-observation/processing/${sessionIdValue}/status`, {
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error(await readError(response))
      }

      const payload = await response.json()
      const status = String(payload.status || "").toLowerCase()

      if (status === "completed" || status === "approved") {
        return payload
      }

      if (status === "failed" || status === "error") {
        throw new Error(payload.last_error || "video_processing_failed")
      }

      setStatusText(`İşleniyor... (${attempt + 1}/${maxAttempts})`)
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }

    throw new Error("video_processing_timeout")
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!form.childLabel.trim()) {
      setErrorText("Çocuk etiketi gerekli.")
      return
    }

    if (!form.ageMonths || Number.isNaN(Number(form.ageMonths))) {
      setErrorText("Yaş ay cinsinden girilmeli.")
      return
    }

    const missingSegments = SEGMENT_ORDER.filter((key) => !segments[key].file)
    if (missingSegments.length) {
      setErrorText(`Eksik segment: ${missingSegments.map((key) => SEGMENT_LABELS[key]).join(", ")}`)
      return
    }

    setBusy(true)
    setErrorText("")

    try {
      setStatusText("Video oturumu oluşturuluyor...")
      const session = await createSessionRequest()
      const createdSessionId = session.session_id as string
      setSessionId(createdSessionId)

      for (const segmentType of SEGMENT_ORDER) {
        setStatusText(`${SEGMENT_LABELS[segmentType]} yükleniyor...`)
        await uploadSegment(createdSessionId, segmentType, segments[segmentType])
      }

      setStatusText("Oturum işleme için gönderiliyor...")
      const submitResponse = await fetch(
        `/api/video-observation/sessions/${createdSessionId}/submit`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ auto_start_processing: true }),
        }
      )

      if (!submitResponse.ok) {
        throw new Error(await readError(submitResponse))
      }

      await pollUntilReady(createdSessionId)
      setStatusText("İşlem tamamlandı. Evidence viewer açılıyor...")
      revokeAllPreviewUrls(segments)
      previewUrlsRef.current = { solo: "", dyadic: "", transition: "" }

      startTransition(() => {
        router.push(`/video-observation?session_id=${createdSessionId}`)
        router.refresh()
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Video gözlem akışı sırasında beklenmeyen bir hata oluştu."
      setErrorText(message)
      setStatusText("")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
            Video Session Builder
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">
            Oturum Oluştur, Yükle ve İşle
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Bu ilk MVP akışı, uygulama içinden video oturumu oluşturup üç segmenti yükler ve
            observation pipeline’ı başlatır. İşlem tamamlandığında viewer aynı session için açılır.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <div>Hazır segment: {readySegmentCount}/3</div>
          <div>Aktif session: {sessionId || "henüz yok"}</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="grid gap-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">Çocuk etiketi</span>
            <input
              value={form.childLabel}
              onChange={(event) => updateForm("childLabel", event.target.value)}
              className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              placeholder="örn. Defne / Session Demo"
            />
          </label>

          <label className="grid gap-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">Harici referans</span>
            <input
              value={form.childExternalRef}
              onChange={(event) => updateForm("childExternalRef", event.target.value)}
              className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              placeholder="örn. CASE-VO-001"
            />
          </label>

          <label className="grid gap-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">Yaş (ay)</span>
            <input
              type="number"
              min={0}
              max={144}
              value={form.ageMonths}
              onChange={(event) => updateForm("ageMonths", event.target.value)}
              className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              placeholder="örn. 60"
            />
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">Anamnez özeti</span>
            <textarea
              value={form.anamnesisSummary}
              onChange={(event) => updateForm("anamnesisSummary", event.target.value)}
              rows={4}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              placeholder="Kısa klinik bağlam, başvuru nedeni ve dikkat edilen düzenleyici örüntü..."
            />
          </label>

          <label className="grid gap-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">Terapist yorumu</span>
            <textarea
              value={form.therapistComments}
              onChange={(event) => updateForm("therapistComments", event.target.value)}
              rows={4}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              placeholder="Gözleme dayalı kısa klinik not..."
            />
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">Session notu</span>
            <textarea
              value={form.sessionNotes}
              onChange={(event) => updateForm("sessionNotes", event.target.value)}
              rows={3}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              placeholder="Oturum, ortam ve protokol notları..."
            />
          </label>

          <label className="grid gap-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">Klinik odak alanları</span>
            <textarea
              value={form.clinicalFocusAreas}
              onChange={(event) => updateForm("clinicalFocusAreas", event.target.value)}
              rows={3}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              placeholder="attention_play,behavioral_organization,co_regulation_openness"
            />
          </label>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {SEGMENT_ORDER.map((segmentType) => {
            const draft = segments[segmentType]
            return (
              <div key={segmentType} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-base font-semibold text-slate-900">{SEGMENT_LABELS[segmentType]}</div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(draft.status)}`}>
                    {draft.status === "idle"
                      ? "Bekliyor"
                      : draft.status === "uploading"
                      ? "Yükleniyor"
                      : draft.status === "uploaded"
                      ? "Tamam"
                      : "Hata"}
                  </span>
                </div>

                <label className="mt-4 grid gap-2 text-sm text-slate-600">
                  <span className="font-medium text-slate-800">Video dosyası</span>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(event) => handleSegmentFileChange(segmentType, event.target.files?.[0] || null)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700"
                  />
                </label>

                <label className="mt-4 grid gap-2 text-sm text-slate-600">
                  <span className="font-medium text-slate-800">Segment notu</span>
                  <textarea
                    rows={3}
                    value={draft.notes}
                    onChange={(event) =>
                      updateSegment(segmentType, {
                        notes: event.target.value,
                      })
                    }
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                    placeholder="Bu segment için kısa not..."
                  />
                </label>

                <div className="mt-4 text-xs leading-6 text-slate-500">
                  {draft.file ? `${draft.file.name} • ${Math.round(draft.file.size / 1024 / 1024)} MB` : "Henüz dosya seçilmedi."}
                </div>
                {draft.file ? (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-black">
                    <video
                      src={draft.previewUrl}
                      controls
                      muted
                      playsInline
                      preload="metadata"
                      className="h-44 w-full object-cover"
                    />
                  </div>
                ) : null}
                {draft.status === "uploading" || draft.progress > 0 ? (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <span>Yükleme İlerlemesi</span>
                      <span>%{draft.progress}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-indigo-600 transition-all"
                        style={{ width: `${draft.progress}%` }}
                      />
                    </div>
                  </div>
                ) : null}
                {draft.detail ? <div className="mt-2 text-xs leading-6 text-slate-500">{draft.detail}</div> : null}
              </div>
            )
          })}
        </div>

        {errorText ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorText}
          </div>
        ) : null}

        {statusText ? (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
            {statusText}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {busy ? "İşleniyor..." : "Oturumu Oluştur ve İşle"}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={resetWorkflowState}
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Formu Temizle
          </button>
        </div>
      </form>
    </div>
  )
}

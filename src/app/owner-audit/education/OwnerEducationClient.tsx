"use client"

import type { ChangeEvent, FormEvent } from "react"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Clock3, Database, Film, HardDrive, Plus, RefreshCw, UploadCloud } from "lucide-react"
import { supabase } from "@/lib/supabase/client"

type EducationVideoItem = {
  id: string
  slug: string
  title: string | null
  provider: string
  providerStatus: string
  playbackPolicy: string
  isActive?: boolean
  storagePath?: string | null
}

type EducationVideoListResponse = {
  ok: boolean
  error?: string
  items?: EducationVideoItem[]
  setupRequired?: boolean
  canManage?: boolean
}

type EducationVideoCreateResponse = {
  ok: boolean
  error?: string
  item?: EducationVideoItem
}

type EducationVideoUploadResponse = {
  ok: boolean
  error?: string
  bucket?: string
  path?: string
  token?: string
  signedUrl?: string
  maxBytes?: number
}

type EducationVideoFormState = {
  title: string
  slug: string
  requiredPlan: string
  provider: "supabase" | "bunny"
  providerStatus: "draft" | "processing" | "ready" | "failed"
  playbackPolicy: "signed_url" | "signed_embed" | "signed_hls"
  storageBucket: string
  storagePath: string
  hlsManifestPath: string
  providerAssetId: string
  providerLibraryId: string
  isActive: boolean
}

type UploadProgressState = {
  percent: number
  loadedBytes: number
  totalBytes: number
  speedBytesPerSecond: number
}

const MAX_CLIENT_VIDEO_UPLOAD_BYTES = 8 * 1024 * 1024 * 1024
const allowedVideoExtensions = new Set(["mp4", "mov", "webm", "m4v"])
const mimeTypeByExtension: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  m4v: "video/x-m4v",
}

function buildInitialFormState(): EducationVideoFormState {
  return {
    title: "",
    slug: "",
    requiredPlan: "",
    provider: "supabase",
    providerStatus: "draft",
    playbackPolicy: "signed_url",
    storageBucket: "education-videos",
    storagePath: "",
    hlsManifestPath: "",
    providerAssetId: "",
    providerLibraryId: "",
    isActive: true,
  }
}

function formatStatus(value: string) {
  if (value === "ready") return "Hazır"
  if (value === "processing") return "İşleniyor"
  if (value === "failed") return "Hata"
  return "Taslak"
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 MB"
  const units = ["B", "KB", "MB", "GB"]
  let nextValue = value
  let unitIndex = 0
  while (nextValue >= 1024 && unitIndex < units.length - 1) {
    nextValue /= 1024
    unitIndex += 1
  }
  return `${nextValue >= 10 ? nextValue.toFixed(0) : nextValue.toFixed(1)} ${units[unitIndex]}`
}

function formatUploadSpeed(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "hesaplanıyor"
  return `${formatBytes(value)}/sn`
}

function formatCreateError(error?: string) {
  if (error === "video_manage_forbidden") return "Bu alan yalnızca owner yetkisiyle kullanılabilir."
  if (error === "unconfirmed_email") return "E-posta doğrulaması tamamlanmadan eğitim kaydı eklenemez."
  if (error === "video_slug_invalid") return "Eğitim adı en az 3 karakter olmalı."
  if (error === "required_plan_invalid") return "Video ayarı otomatik belirlenemedi. Sayfayı yenileyip tekrar deneyin."
  if (error === "video_provider_invalid") return "Video ayarı oluşturulamadı. Sayfayı yenileyip tekrar deneyin."
  if (error === "video_provider_status_invalid") return "Video durumu oluşturulamadı. Sayfayı yenileyip tekrar deneyin."
  if (error === "video_playback_policy_invalid") return "Video oynatma ayarı oluşturulamadı. Sayfayı yenileyip tekrar deneyin."
  if (error === "storage_path_invalid") return "Video yolu geçerli değil. Başında / olmadan klasör/dosya yolu girin."
  if (error === "video_storage_path_required") return "Video dosyası bilgisi zorunlu."
  if (error === "video_provider_ids_required") return "Video kaydı için gerekli bilgiler eksik."
  if (error === "server_controlled_fields_present") return "Sunucuya ait alanlar gönderilemez."
  if (error === "video_slug_conflict") return "Bu eğitim adıyla kayıt zaten var. Başlığı biraz değiştirin."
  if (error === "video_setup_required") return "Eğitim video altyapısı henüz hazır değil."
  if (error === "video_create_failed") return "Kayıt oluşturulamadı."
  return error || "Kayıt oluşturulamadı."
}

function formatUploadError(error?: string) {
  if (error === "video_upload_forbidden") return "Video yükleme yalnızca owner yetkisiyle yapılabilir."
  if (error === "video_upload_type_invalid") return "Yalnızca MP4, MOV, M4V veya WebM video yükleyin."
  if (error === "education_video_bucket_missing") return "Supabase tarafında education-videos private bucket hazır değil."
  if (error === "video_upload_prepare_failed") return "Video yükleme izni oluşturulamadı."
  if (error === "Too many requests") return "Kısa sürede çok fazla yükleme denemesi yapıldı. Biraz bekleyin."
  return error || "Video yüklenemedi."
}

function inferVideoContentType(file: File) {
  if (file.type.startsWith("video/")) return file.type
  const extension = file.name.split(".").pop()?.toLowerCase() || ""
  return mimeTypeByExtension[extension] || file.type
}

function isAllowedVideoFile(file: File) {
  if (file.type.startsWith("video/")) return true
  const extension = file.name.split(".").pop()?.toLowerCase() || ""
  return allowedVideoExtensions.has(extension)
}

function uploadSignedUrlWithProgress(params: {
  signedUrl: string
  file: File
  onProgress: (progress: UploadProgressState) => void
}) {
  return new Promise<void>((resolve, reject) => {
    const startedAt = Date.now()
    const xhr = new XMLHttpRequest()
    const body = new FormData()
    body.append("cacheControl", "3600")
    body.append("", params.file)

    xhr.open("PUT", params.signedUrl)
    xhr.setRequestHeader("x-upsert", "false")

    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (anonKey) {
      xhr.setRequestHeader("apikey", anonKey)
      xhr.setRequestHeader("Authorization", `Bearer ${anonKey}`)
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 0.1)
      params.onProgress({
        percent: Math.min(99, Math.round((event.loaded / event.total) * 100)),
        loadedBytes: event.loaded,
        totalBytes: event.total,
        speedBytesPerSecond: event.loaded / elapsedSeconds,
      })
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        params.onProgress({
          percent: 100,
          loadedBytes: params.file.size,
          totalBytes: params.file.size,
          speedBytesPerSecond: params.file.size / Math.max((Date.now() - startedAt) / 1000, 0.1),
        })
        resolve()
        return
      }

      reject(new Error("Video private storage'a yüklenemedi. Bağlantıyı kontrol edip tekrar deneyin."))
    }

    xhr.onerror = () => {
      reject(new Error("Video yükleme sırasında bağlantı hatası oluştu."))
    }

    xhr.send(body)
  })
}

export default function OwnerEducationClient() {
  const [form, setForm] = useState<EducationVideoFormState>(() => buildInitialFormState())
  const [items, setItems] = useState<EducationVideoItem[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [uploadNotice, setUploadNotice] = useState("")
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)

  const loadVideos = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/education/videos?scope=manage", { cache: "no-store" })
      const json = (await response.json()) as EducationVideoListResponse

      if (!response.ok || !json.ok) {
        setError(json.error || "Eğitim kayıtları alınamadı.")
        setItems([])
        setLoading(false)
        return
      }

      setItems(json.items || [])
      setSetupRequired(Boolean(json.setupRequired))
      setLoading(false)
    } catch {
      setError("Eğitim kayıtları alınamadı.")
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadVideos()
  }, [loadVideos])

  const updateForm = <K extends keyof EducationVideoFormState>(
    key: K,
    value: EducationVideoFormState[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null
    setError("")
    setNotice("")
    setUploadNotice("")
    setUploadProgress(null)

    if (!file) {
      setSelectedFile(null)
      return
    }

    if (!isAllowedVideoFile(file)) {
      setSelectedFile(null)
      setError("Yalnızca MP4, MOV, M4V veya WebM video dosyası seçin.")
      return
    }

    if (file.size > MAX_CLIENT_VIDEO_UPLOAD_BYTES) {
      setSelectedFile(null)
      setError("Bu video 8 GB sınırını aşıyor. Büyük dosyaları Bunny Stream aşamasında yüklemek daha doğru olur.")
      return
    }

    setSelectedFile(file)
  }

  async function prepareAndUploadVideo(file: File) {
    setUploadProgress(null)
    setUploadNotice("Video için güvenli yükleme izni hazırlanıyor.")
    const contentType = inferVideoContentType(file)
    const prepareResponse = await fetch("/api/education/videos/upload", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-dna-request": "same-origin",
      },
      body: JSON.stringify({
        fileName: file.name,
        contentType,
        fileSize: file.size,
      }),
    })

    const prepareJson = (await prepareResponse.json()) as EducationVideoUploadResponse
    if (!prepareResponse.ok || !prepareJson.ok || !prepareJson.bucket || !prepareJson.path || !prepareJson.token) {
      throw new Error(formatUploadError(prepareJson.error))
    }

    setUploadNotice(`Video doğrudan private storage'a yükleniyor. Dosya boyutu: ${formatBytes(file.size)}. Bu sırada sayfayı kapatmayın.`)
    if (prepareJson.signedUrl) {
      await uploadSignedUrlWithProgress({
        signedUrl: prepareJson.signedUrl,
        file,
        onProgress: setUploadProgress,
      })
    } else {
      const { error: uploadError } = await supabase.storage
        .from(prepareJson.bucket)
        .uploadToSignedUrl(prepareJson.path, prepareJson.token, file, {
          contentType,
          cacheControl: "3600",
        })

      if (uploadError) {
        throw new Error("Video private storage'a yüklenemedi. Bağlantıyı kontrol edip tekrar deneyin.")
      }
      setUploadProgress({
        percent: 100,
        loadedBytes: file.size,
        totalBytes: file.size,
        speedBytesPerSecond: 0,
      })
    }

    return {
      bucket: prepareJson.bucket,
      path: prepareJson.path,
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError("")
    setNotice("")
    setUploadProgress(null)

    try {
      let storageBucket = form.storageBucket || "education-videos"
      let storagePath = form.storagePath.trim()

      if (selectedFile) {
        const uploaded = await prepareAndUploadVideo(selectedFile)
        storageBucket = uploaded.bucket
        storagePath = uploaded.path
      }

      if (!storagePath) {
        setError("Önce video dosyası seçin veya hazır private storage dosya yolunu yazın.")
        setSubmitting(false)
        return
      }

      setUploadNotice("Video kaydı terapist eğitim kütüphanesine bağlanıyor.")
      const payload: EducationVideoFormState = {
        ...form,
        slug: "",
        requiredPlan: "",
        provider: "supabase",
        providerStatus: form.isActive ? "ready" : "draft",
        playbackPolicy: "signed_url",
        storageBucket,
        storagePath,
        hlsManifestPath: "",
        providerAssetId: "",
        providerLibraryId: "",
      }

      const response = await fetch("/api/education/videos", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-dna-request": "same-origin",
        },
        body: JSON.stringify(payload),
      })
      const json = (await response.json()) as EducationVideoCreateResponse

      if (!response.ok || !json.ok) {
        setError(formatCreateError(json.error))
        setSubmitting(false)
        return
      }

      setNotice("Eğitim kaydı oluşturuldu. Aktifse terapist panelindeki Eğitimler alanında artık görünecek.")
      setUploadNotice("")
      setUploadProgress(null)
      setSelectedFile(null)
      setForm(buildInitialFormState())
      setSubmitting(false)
      await loadVideos()
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Kayıt oluşturulamadı.")
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      {setupRequired ? (
        <div className="rounded-[1.5rem] border border-violet-200 bg-violet-50 px-5 py-4 text-sm font-bold text-violet-900">
          Eğitim video altyapısı hazır görünmüyor. Altyapı kurulmadan kayıt eklenemez.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[1.5rem] border border-slate-300 bg-slate-50 px-5 py-4 text-sm font-bold text-slate-900">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-[1.5rem] border border-cyan-200 bg-cyan-50 px-5 py-4 text-sm font-bold text-cyan-800">
          {notice}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <form
          onSubmit={handleSubmit}
          className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-8"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <Plus className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-3xl font-black text-slate-950">Yeni eğitim kaydı</h2>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
                Videoyu buradan seçince dosya sunucudan geçmeden doğrudan private Supabase Storage&apos;a yüklenir.
                Kayıt tamamlanınca aktif eğitim otomatik olarak terapist panelindeki Eğitimler alanında görünür.
              </p>
            </div>
          </div>

          <div className="mt-7 grid gap-5">
            <label className="grid gap-2 text-sm font-black text-slate-700">
              Eğitim adı
              <input
                value={form.title}
                onChange={(event) => updateForm("title", event.target.value)}
                placeholder="Ör. Regülasyon Temelleri - 1"
                className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <div className="rounded-[1.5rem] border border-dashed border-blue-200 bg-blue-50/50 p-5">
              <label className="flex cursor-pointer flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-base font-black text-slate-950">Video dosyası seç</div>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                      MP4, MOV, M4V veya WebM. Büyük videolar API üzerinden değil, doğrudan private storage&apos;a gider.
                    </p>
                  </div>
                </div>
                <span className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-blue-700 shadow-sm">
                  Dosya seç
                </span>
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>

              {selectedFile ? (
                <div className="mt-4 grid gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-blue-600" />
                    <span className="break-all">{selectedFile.name}</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-500">Boyut: {formatBytes(selectedFile.size)}</div>
                </div>
              ) : null}
            </div>

            <label className="grid gap-2 text-sm font-black text-slate-700">
              Hazır dosya yolu
              <input
                value={form.storagePath}
                onChange={(event) => updateForm("storagePath", event.target.value)}
                placeholder="therapist-egitimleri/modul-1.mp4"
                className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
              <span className="text-xs font-semibold leading-5 text-slate-500">
                Sadece video daha önce private bucket&apos;a yüklendiyse kullanın. Dosya seçtiyseniz burayı boş bırakabilirsiniz.
              </span>
            </label>
          </div>

          {uploadNotice ? (
            <div className="mt-5 flex items-start gap-3 rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold leading-6 text-slate-700">
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <span>{uploadNotice}</span>
            </div>
          ) : null}

          {uploadProgress ? (
            <div className="mt-4 rounded-[1.25rem] border border-blue-100 bg-blue-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-black text-blue-950">
                <span>Yükleme durumu: %{uploadProgress.percent}</span>
                <span>{formatUploadSpeed(uploadProgress.speedBytesPerSecond)}</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 transition-all"
                  style={{ width: `${uploadProgress.percent}%` }}
                />
              </div>
              <div className="mt-2 text-xs font-bold text-blue-800">
                {formatBytes(uploadProgress.loadedBytes)} / {formatBytes(uploadProgress.totalBytes)}
              </div>
            </div>
          ) : null}

          <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-3 text-sm font-black text-slate-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => updateForm("isActive", event.target.checked)}
                className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
              />
              Terapistlere yayınla
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-4 text-sm font-black text-white shadow-[0_18px_45px_rgba(15,23,42,0.22)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {submitting ? "Yükleniyor" : "Videoyu kaydet ve yayınla"}
            </button>
          </div>
        </form>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                <Film className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-3xl font-black text-slate-950">Eğitim kayıtları</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                Aktif kayıtlar terapist panelindeki Eğitimler alanında görünür. Taslak kayıtlar burada kalır.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">
              {items.length} kayıt
            </span>
          </div>

          <div className="mt-6 space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm font-bold text-slate-500">
                Eğitim kayıtları yükleniyor.
              </div>
            ) : null}

            {!loading && items.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                <Database className="mx-auto h-8 w-8 text-slate-400" />
                <div className="mt-3 text-sm font-black text-slate-900">Eğitim kaydı yok</div>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                  İlk aktif kaydı eklediğinizde terapist kütüphanesinde görünür.
                </p>
              </div>
            ) : null}

            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-base font-black text-slate-950">
                      {item.title || "Başlıksız eğitim"}
                    </div>
                    <div className="mt-1 text-xs font-bold text-slate-500">
                      {item.isActive ? "Terapist eğitim kütüphanesinde görünür." : "Taslak olarak saklanıyor."}
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${
                    item.isActive ? "bg-cyan-50 text-cyan-800" : "bg-slate-100 text-slate-600"
                  }`}>
                    {item.isActive ? "Aktif" : "Taslak"}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex rounded-2xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                    Durum: {formatStatus(item.providerStatus)}
                  </span>
                  <span className="inline-flex rounded-2xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                    Sağlayıcı: {item.provider}
                  </span>
                  {item.isActive ? (
                    <Link
                      href="/education"
                      className="inline-flex rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100"
                    >
                      Terapist panelinde gör
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

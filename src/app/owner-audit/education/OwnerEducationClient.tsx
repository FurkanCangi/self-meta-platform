"use client"

import Link from "next/link"
import type { FormEvent } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BookOpen,
  CheckCircle2,
  Database,
  ExternalLink,
  Film,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react"

type EducationVideoItem = {
  id: string
  slug: string
  title: string | null
  requiredPlan: string | null
  provider: string
  providerStatus: string
  playbackPolicy: string
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

const planOptions = [
  { value: "", label: "Tüm eğitim erişimi" },
  { value: "student", label: "Öğrenci paketi" },
  { value: "graduate", label: "Mezun paketi" },
  { value: "professional", label: "Profesyonel paket" },
  { value: "enterprise", label: "Kurumsal paket" },
]

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

function formatPlan(value?: string | null) {
  if (!value) return "Tüm eğitim erişimi"
  if (value === "student") return "Öğrenci paketi"
  if (value === "graduate") return "Mezun paketi"
  if (value === "professional") return "Profesyonel paket"
  if (value === "enterprise") return "Kurumsal paket"
  return value
}

function formatStatus(value: string) {
  if (value === "ready") return "Hazır"
  if (value === "processing") return "İşleniyor"
  if (value === "failed") return "Hata"
  return "Taslak"
}

function formatPlayback(value: string) {
  if (value === "signed_embed") return "Signed Embed"
  if (value === "signed_hls") return "Signed HLS"
  return "Signed URL"
}

function formatCreateError(error?: string) {
  if (error === "video_manage_forbidden") return "Bu alan yalnızca owner yetkisiyle kullanılabilir."
  if (error === "unconfirmed_email") return "E-posta doğrulaması tamamlanmadan eğitim kaydı eklenemez."
  if (error === "video_slug_invalid") return "Slug en az 3 karakter olmalı; küçük harf, rakam ve tire kullanın."
  if (error === "required_plan_invalid") return "Gerekli paket geçerli değil."
  if (error === "video_provider_invalid") return "Provider seçimi geçerli değil."
  if (error === "video_provider_status_invalid") return "Durum seçimi geçerli değil."
  if (error === "video_playback_policy_invalid") return "Playback seçimi geçerli değil."
  if (error === "storage_path_invalid") return "Video yolu geçerli değil. Başında / olmadan klasör/dosya yolu girin."
  if (error === "video_storage_path_required") return "Supabase için video path veya HLS manifest path zorunlu."
  if (error === "video_provider_ids_required") return "Bunny için library ve asset bilgileri zorunlu."
  if (error === "server_controlled_fields_present") return "Sunucuya ait alanlar gönderilemez."
  if (error === "video_slug_conflict") return "Bu slug ile kayıt zaten var."
  if (error === "video_setup_required") return "Eğitim video tablosu Supabase tarafında henüz hazır değil."
  if (error === "video_create_failed") return "Kayıt oluşturulamadı."
  return error || "Kayıt oluşturulamadı."
}

export default function OwnerEducationClient() {
  const [form, setForm] = useState<EducationVideoFormState>(() => buildInitialFormState())
  const [items, setItems] = useState<EducationVideoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [setupRequired, setSetupRequired] = useState(false)

  const loadVideos = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/education/videos", { cache: "no-store" })
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

  const stats = useMemo(() => {
    const ready = items.filter((item) => item.providerStatus === "ready").length
    const processing = items.filter(
      (item) => item.providerStatus === "draft" || item.providerStatus === "processing",
    ).length

    return {
      total: items.length,
      ready,
      processing,
    }
  }, [items])

  const updateForm = <K extends keyof EducationVideoFormState>(
    key: K,
    value: EducationVideoFormState[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError("")
    setNotice("")

    try {
      const response = await fetch("/api/education/videos", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-dna-request": "same-origin",
        },
        body: JSON.stringify(form),
      })
      const json = (await response.json()) as EducationVideoCreateResponse

      if (!response.ok || !json.ok) {
        setError(formatCreateError(json.error))
        setSubmitting(false)
        return
      }

      setNotice("Eğitim kaydı oluşturuldu. Aktifse terapist kütüphanesinde görünecek.")
      setForm(buildInitialFormState())
      setSubmitting(false)
      await loadVideos()
    } catch {
      setError("Kayıt oluşturulamadı.")
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="p-6 sm:p-8 lg:p-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-blue-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-gradient-to-br from-cyan-400 to-violet-600" />
              Eğitim Yönetimi
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              Eğitim kayıtlarını ayrı owner panelinden yönetin.
            </h1>
            <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-slate-600">
              Buradan eklenen aktif yayınlar terapistlerin eğitim kütüphanesinde sıra sıra görünür.
              Terapist tarafı izleme, erişim ve güvenli oynatma deneyimine odaklı kalır.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/education"
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-[0_16px_40px_rgba(15,23,42,0.2)] transition hover:bg-slate-800"
              >
                Terapist görünümünü aç
                <ExternalLink className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => void loadVideos()}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" />
                Kayıtları yenile
              </button>
            </div>
          </div>

          <div className="relative min-h-[320px] border-t border-slate-100 bg-[radial-gradient(circle_at_65%_32%,rgba(34,211,238,0.22),transparent_34%),radial-gradient(circle_at_35%_68%,rgba(124,58,237,0.2),transparent_34%),linear-gradient(135deg,#f8fbff,#eef8ff)] p-6 sm:p-8 lg:border-l lg:border-t-0">
            <div className="absolute inset-8 rounded-[2rem] border border-white/70 bg-white/45 backdrop-blur-sm" />
            <div className="relative grid gap-4">
              <div className="rounded-[1.6rem] border border-white/80 bg-white/86 p-5 shadow-[0_18px_45px_rgba(37,99,235,0.12)]">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-600 to-violet-600 text-white shadow-lg">
                    <BookOpen className="h-7 w-7" />
                  </div>
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                      Terapist kütüphanesi
                    </div>
                    <div className="mt-1 text-xl font-black text-slate-950">
                      Sıralı eğitim deneyimi
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">
                  Bir sonraki adımda bu alan Udemy/Khan Academy mantığında modüller,
                  ilerleme ve ders detaylarıyla genişletilebilir.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/88 p-4 shadow-sm">
                  <div className="text-2xl font-black text-slate-950">{stats.total}</div>
                  <div className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Aktif kayıt
                  </div>
                </div>
                <div className="rounded-2xl bg-white/88 p-4 shadow-sm">
                  <div className="text-2xl font-black text-emerald-600">{stats.ready}</div>
                  <div className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Hazır
                  </div>
                </div>
                <div className="rounded-2xl bg-white/88 p-4 shadow-sm">
                  <div className="text-2xl font-black text-blue-600">{stats.processing}</div>
                  <div className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Taslak
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {setupRequired ? (
        <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
          Eğitim video tablosu Supabase tarafında hazır görünmüyor. Tablo kurulmadan kayıt eklenemez.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-700">
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
                Dosyayı storage veya video sağlayıcıya koyduktan sonra burada yayın kaydını oluşturun.
              </p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Owner/Admin
            </span>
          </div>

          <div className="mt-7 grid gap-5 lg:grid-cols-2">
            <label className="grid gap-2 text-sm font-black text-slate-700">
              Başlık
              <input
                value={form.title}
                onChange={(event) => updateForm("title", event.target.value)}
                placeholder="Ör. Regülasyon Temelleri - 1"
                className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </label>
            <label className="grid gap-2 text-sm font-black text-slate-700">
              Slug
              <input
                value={form.slug}
                onChange={(event) => updateForm("slug", event.target.value)}
                placeholder="regulasyon-temelleri-1"
                className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </label>
            <label className="grid gap-2 text-sm font-black text-slate-700">
              Gerekli Paket
              <select
                value={form.requiredPlan}
                onChange={(event) => updateForm("requiredPlan", event.target.value)}
                className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                {planOptions.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-black text-slate-700">
              Provider
              <select
                value={form.provider}
                onChange={(event) => updateForm("provider", event.target.value as EducationVideoFormState["provider"])}
                className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                <option value="supabase">Supabase Storage</option>
                <option value="bunny">Bunny Stream</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-black text-slate-700">
              Durum
              <select
                value={form.providerStatus}
                onChange={(event) =>
                  updateForm("providerStatus", event.target.value as EducationVideoFormState["providerStatus"])
                }
                className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                <option value="draft">Taslak</option>
                <option value="processing">İşleniyor</option>
                <option value="ready">Hazır</option>
                <option value="failed">Hata</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-black text-slate-700">
              Playback
              <select
                value={form.playbackPolicy}
                onChange={(event) =>
                  updateForm("playbackPolicy", event.target.value as EducationVideoFormState["playbackPolicy"])
                }
                className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                <option value="signed_url">Signed URL</option>
                <option value="signed_embed">Signed Embed</option>
                <option value="signed_hls">Signed HLS</option>
              </select>
            </label>

            {form.provider === "supabase" ? (
              <>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  Bucket
                  <input
                    value={form.storageBucket}
                    onChange={(event) => updateForm("storageBucket", event.target.value)}
                    placeholder="education-videos"
                    className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  Video Path
                  <input
                    value={form.storagePath}
                    onChange={(event) => updateForm("storagePath", event.target.value)}
                    placeholder="therapist-egitimleri/modul-1.mp4"
                    className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700 lg:col-span-2">
                  HLS Manifest Path
                  <input
                    value={form.hlsManifestPath}
                    onChange={(event) => updateForm("hlsManifestPath", event.target.value)}
                    placeholder="therapist-egitimleri/modul-1/playlist.m3u8"
                    className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
              </>
            ) : (
              <>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  Bunny Library ID
                  <input
                    value={form.providerLibraryId}
                    onChange={(event) => updateForm("providerLibraryId", event.target.value)}
                    placeholder="library-id"
                    className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  Bunny Asset ID
                  <input
                    value={form.providerAssetId}
                    onChange={(event) => updateForm("providerAssetId", event.target.value)}
                    placeholder="video-guid"
                    className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
              </>
            )}
          </div>

          <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-3 text-sm font-black text-slate-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => updateForm("isActive", event.target.checked)}
                className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
              />
              Yayında aktif olsun
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-4 text-sm font-black text-white shadow-[0_18px_45px_rgba(15,23,42,0.22)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Kaydı ekle
            </button>
          </div>
        </form>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                <Film className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-3xl font-black text-slate-950">Aktif yayınlar</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                Bu liste terapist panelindeki kütüphanede görünen aktif kayıtları gösterir.
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
                <div className="mt-3 text-sm font-black text-slate-900">Aktif eğitim kaydı yok</div>
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
                      {item.title || item.slug}
                    </div>
                    <div className="mt-1 truncate text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                      {item.slug}
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                    Aktif
                  </span>
                </div>
                <div className="mt-4 grid gap-2 text-xs font-bold text-slate-600 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 px-3 py-2">{formatPlan(item.requiredPlan)}</div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-2">{formatStatus(item.providerStatus)}</div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-2">{item.provider}</div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-2">{formatPlayback(item.playbackPolicy)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm">
          <ShieldCheck className="h-7 w-7 text-blue-600" />
          <div className="mt-4 text-lg font-black text-slate-950">Erişim kontrollü</div>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            Kayıtlar paket erişimi, oturum ve cihaz güvenliğiyle birlikte çalışır.
          </p>
        </div>
        <div className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm">
          <Lock className="h-7 w-7 text-violet-600" />
          <div className="mt-4 text-lg font-black text-slate-950">Güvenli oynatma</div>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            Signed URL, HLS veya embed akışları aynı video erişim kontrolünden geçer.
          </p>
        </div>
        <div className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          <div className="mt-4 text-lg font-black text-slate-950">Terapist tarafı sade</div>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            Terapistler yalnızca yayınlanan eğitimleri görür; yönetim formları owner alanında kalır.
          </p>
        </div>
      </section>
    </div>
  )
}

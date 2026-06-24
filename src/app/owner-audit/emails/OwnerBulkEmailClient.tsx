"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Eye, Mail, Send, ShieldCheck, Sparkles } from "lucide-react"

type CampaignType = "system" | "education" | "marketing"
type Audience = "all" | "therapists" | "owners" | "plan" | "manual"

type Campaign = {
  id: string
  campaign_type: CampaignType
  audience: Audience
  plan_code: string | null
  subject: string
  preview_text: string | null
  body: string
  action_label: string | null
  action_url: string | null
  status: string
  recipient_count: number
  sent_count: number
  failed_count: number
  skipped_count: number
  created_at: string
  completed_at: string | null
  error_message: string | null
}

type PreviewState = {
  count: number
  sample: Array<{ email: string; fullName: string; plan: string }>
}

const campaignTypes: Array<{ value: CampaignType; label: string; description: string }> = [
  { value: "system", label: "Sistem duyurusu", description: "Bakım, hesap, kullanım ve önemli operasyon notları." },
  { value: "education", label: "Eğitim duyurusu", description: "Yeni eğitim, kayıt, içerik ve izleme bilgilendirmeleri." },
  { value: "marketing", label: "Kampanya / paket", description: "Paket, indirim ve ticari bilgilendirme mailleri." },
]

const audiences: Array<{ value: Audience; label: string; description: string }> = [
  { value: "all", label: "Tüm üyeler", description: "Sistemde e-postası olan tüm üyeler." },
  { value: "therapists", label: "Terapistler", description: "Terapist/uzman rolündeki kullanıcılar." },
  { value: "owners", label: "Owner", description: "Yalnızca yönetici e-posta listesi." },
  { value: "plan", label: "Belirli paket", description: "Seçilen paketteki üyeler." },
  { value: "manual", label: "Manuel liste", description: "Sadece yazdığınız e-posta adresleri." },
]

const planOptions = [
  { value: "student", label: "Öğrenci" },
  { value: "graduate", label: "Yeni mezun" },
  { value: "professional", label: "Profesyonel" },
  { value: "enterprise", label: "Kurumsal" },
]

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value))
  } catch {
    return value
  }
}

function campaignTypeLabel(value: CampaignType) {
  return campaignTypes.find((item) => item.value === value)?.label || "Duyuru"
}

function audienceLabel(value: Audience, planCode?: string | null) {
  if (value === "plan") {
    return planOptions.find((item) => item.value === planCode)?.label || "Belirli paket"
  }
  return audiences.find((item) => item.value === value)?.label || value
}

function statusLabel(value: string) {
  if (value === "completed") return "Tamamlandı"
  if (value === "sending") return "Gönderiliyor"
  if (value === "failed") return "Hata aldı"
  if (value === "cancelled") return "İptal"
  return "Taslak"
}

function splitEmails(value: string) {
  return value
    .split(/[,\n;]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

export default function OwnerBulkEmailClient({ ownerEmail }: { ownerEmail: string }) {
  const [campaignType, setCampaignType] = useState<CampaignType>("system")
  const [audience, setAudience] = useState<Audience>("therapists")
  const [planCode, setPlanCode] = useState("professional")
  const [subject, setSubject] = useState("DNA Intelligence bilgilendirmesi")
  const [previewText, setPreviewText] = useState("Panelinizdeki yeni bilgilendirmeyi inceleyebilirsiniz.")
  const [body, setBody] = useState(
    "Merhaba,\n\nDNA Intelligence paneliyle ilgili kısa bir bilgilendirme paylaşmak istiyoruz.\n\nDetayları panelinizden inceleyebilirsiniz.",
  )
  const [actionLabel, setActionLabel] = useState("Panele Git")
  const [actionUrl, setActionUrl] = useState("/starter")
  const [manualEmails, setManualEmails] = useState("")
  const [confirmation, setConfirmation] = useState(false)
  const [preview, setPreview] = useState<PreviewState>({ count: 0, sample: [] })
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [setupRequired, setSetupRequired] = useState(false)

  const payload = useMemo(
    () => ({
      campaignType,
      audience,
      planCode: audience === "plan" ? planCode : null,
      subject,
      previewText: previewText || null,
      body,
      actionLabel: actionLabel || null,
      actionUrl: actionUrl || null,
      manualEmails: audience === "manual" ? splitEmails(manualEmails) : [],
    }),
    [actionLabel, actionUrl, audience, body, campaignType, manualEmails, planCode, previewText, subject],
  )

  const loadCampaigns = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/owner-audit/emails", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Toplu mail geçmişi yüklenemedi.")
      setCampaigns(data.campaigns || [])
      setSetupRequired(Boolean(data.setupRequired))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Toplu mail geçmişi yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }

  const loadPreview = async () => {
    setPreviewLoading(true)
    try {
      const res = await fetch("/api/owner-audit/emails/preview", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-dna-request": "same-origin",
        },
        body: JSON.stringify({
          audience,
          planCode: audience === "plan" ? planCode : null,
          manualEmails: audience === "manual" ? splitEmails(manualEmails) : [],
        }),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Alıcı sayısı hesaplanamadı.")
      setPreview({ count: Number(data.count || 0), sample: data.sample || [] })
      setSetupRequired(Boolean(data.setupRequired))
    } catch {
      setPreview({ count: 0, sample: [] })
    } finally {
      setPreviewLoading(false)
    }
  }

  useEffect(() => {
    loadCampaigns()
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadPreview()
    }, 350)
    return () => window.clearTimeout(timer)
  }, [audience, planCode, manualEmails])

  const sendTest = async () => {
    setSendingTest(true)
    setNotice("")
    setError("")
    try {
      const res = await fetch("/api/owner-audit/emails/test", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-dna-request": "same-origin",
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Test maili gönderilemedi.")
      setNotice(`Test maili ${ownerEmail} adresine gönderildi.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test maili gönderilemedi.")
    } finally {
      setSendingTest(false)
    }
  }

  const sendCampaign = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSending(true)
    setNotice("")
    setError("")
    try {
      const res = await fetch("/api/owner-audit/emails/send", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-dna-request": "same-origin",
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        setSetupRequired(Boolean(data?.setupRequired))
        throw new Error(data?.error || "Toplu mail gönderilemedi.")
      }
      setNotice(`${data.sentCount} kişiye mail gönderildi. Hata alan: ${data.failedCount}.`)
      setConfirmation(false)
      await loadCampaigns()
      await loadPreview()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Toplu mail gönderilemedi.")
    } finally {
      setSending(false)
    }
  }

  const canSend = confirmation && preview.count > 0 && subject.trim().length >= 3 && body.trim().length >= 10

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1fr_0.72fr]">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.28em] text-blue-600">Owner paneli</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">Toplu Mail Gönderimi</h1>
          <p className="mt-3 max-w-3xl text-base font-medium leading-7 text-slate-600">
            Üyelere sistem, eğitim veya kampanya duyurusu gönder. Her gönderim ayrı kaydedilir ve
            alıcılar birbirinin e-posta adresini görmez.
          </p>
        </div>
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-black text-slate-950">Güvenli gönderim</div>
              <div className="text-sm font-medium text-slate-500">Tek tek gönderilir, geçmişe kaydedilir.</div>
            </div>
          </div>
        </div>
      </section>

      {setupRequired ? (
        <div className="rounded-3xl border border-violet-200 bg-violet-50 px-5 py-4 text-sm font-semibold text-violet-900">
          Toplu mail tabloları Supabase tarafında hazır değil.{" "}
          <code className="rounded bg-white px-1.5 py-0.5">sql/owner_bulk_email.sql</code> dosyasını
          SQL Editor içinde çalıştırın.
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <form
          onSubmit={sendCampaign}
          className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-8"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-100 to-violet-100 text-blue-700">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-950">Yeni mail</h2>
              <p className="text-sm font-medium text-slate-500">Önce test gönder, sonra toplu gönderimi onayla.</p>
            </div>
          </div>

          <div className="mt-7 grid gap-5">
            <div className="grid gap-3">
              <span className="text-sm font-bold text-slate-700">Mail türü</span>
              <div className="grid gap-3 md:grid-cols-3">
                {campaignTypes.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setCampaignType(option.value)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      campaignType === option.value
                        ? "border-blue-300 bg-blue-50 shadow-[0_12px_34px_rgba(37,99,235,0.12)]"
                        : "border-slate-200 bg-white hover:border-blue-200"
                    }`}
                  >
                    <div className="text-sm font-black text-slate-950">{option.label}</div>
                    <p className="mt-2 text-xs font-medium leading-5 text-slate-500">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700">Hedef kitle</span>
                <select
                  value={audience}
                  onChange={(event) => {
                    setAudience(event.target.value as Audience)
                    setConfirmation(false)
                  }}
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                >
                  {audiences.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs font-medium text-slate-500">
                  {audiences.find((item) => item.value === audience)?.description}
                </span>
              </label>

              {audience === "plan" ? (
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-700">Paket</span>
                  <select
                    value={planCode}
                    onChange={(event) => setPlanCode(event.target.value)}
                    className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  >
                    {planOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            {audience === "manual" ? (
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700">Manuel e-posta listesi</span>
                <textarea
                  value={manualEmails}
                  onChange={(event) => {
                    setManualEmails(event.target.value)
                    setConfirmation(false)
                  }}
                  rows={4}
                  placeholder="Her satıra bir e-posta yazabilirsiniz."
                  className="resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                />
              </label>
            ) : null}

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Konu</span>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                maxLength={160}
                required
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Kısa ön yazı</span>
              <input
                value={previewText}
                onChange={(event) => setPreviewText(event.target.value)}
                maxLength={180}
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Mail metni</span>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                maxLength={5000}
                required
                rows={8}
                className="resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700">Buton metni</span>
                <input
                  value={actionLabel}
                  onChange={(event) => setActionLabel(event.target.value)}
                  maxLength={60}
                  placeholder="Örn. Panele Git"
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700">Buton bağlantısı</span>
                <input
                  value={actionUrl}
                  onChange={(event) => setActionUrl(event.target.value)}
                  maxLength={300}
                  placeholder="/education"
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                />
              </label>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-slate-950">
                    {previewLoading ? "Alıcı sayısı hesaplanıyor..." : `${preview.count} kişiye gönderilecek`}
                  </div>
                  <div className="mt-1 text-xs font-medium text-slate-500">
                    Hedef: {audienceLabel(audience, planCode)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={sendTest}
                  disabled={sendingTest}
                  className="rounded-2xl border border-blue-200 bg-white px-4 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sendingTest ? "Test gönderiliyor..." : "Kendime test maili gönder"}
                </button>
              </div>

              {preview.sample.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {preview.sample.map((item) => (
                    <span key={item.email} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">
                      {item.email}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-3xl border border-slate-200 bg-white p-4">
              <input
                type="checkbox"
                checked={confirmation}
                onChange={(event) => setConfirmation(event.target.checked)}
                className="mt-1 h-5 w-5 accent-blue-600"
              />
              <span className="text-sm font-semibold leading-6 text-slate-700">
                Bu mailin <strong>{preview.count}</strong> kişiye gönderileceğini, alıcı kitlesini ve içeriği kontrol ettim.
              </span>
            </label>

            {notice ? (
              <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-800">
                {notice}
              </div>
            ) : null}
            {error ? (
              <div className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={!canSend || sending}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-4 text-sm font-black text-white shadow-[0_18px_44px_rgba(15,23,42,0.18)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? "Gönderiliyor..." : "Toplu Maili Gönder"}
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <Eye className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-950">Önizleme</h2>
                <p className="text-sm font-medium text-slate-500">Alıcının göreceği ana içerik.</p>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,#effcff,#f7f3ff)] p-4">
              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">DNA Intelligence</div>
                <div className="mt-3 text-2xl font-black leading-tight text-slate-950">{subject || "Mail konusu"}</div>
                {previewText ? <p className="mt-2 text-sm font-semibold text-slate-500">{previewText}</p> : null}
                <div className="mt-5 whitespace-pre-line text-sm font-medium leading-7 text-slate-600">
                  {body || "Mail metni burada görünür."}
                </div>
                {actionLabel && actionUrl ? (
                  <div className="mt-5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 px-4 py-3 text-center text-sm font-black text-white">
                    {actionLabel}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Gönderim geçmişi</h2>
                <p className="mt-1 text-sm font-medium text-slate-500">Son toplu mail kayıtları.</p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
                {campaigns.length} kayıt
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              {loading ? (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm font-bold text-slate-500">
                  Geçmiş yükleniyor...
                </div>
              ) : campaigns.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <Sparkles className="mx-auto h-8 w-8 text-slate-400" />
                  <div className="mt-3 text-sm font-bold text-slate-600">Henüz toplu mail gönderilmedi.</div>
                </div>
              ) : (
                campaigns.map((campaign) => (
                  <div key={campaign.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                        {campaignTypeLabel(campaign.campaign_type)}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                        {audienceLabel(campaign.audience, campaign.plan_code)}
                      </span>
                      <span className="ml-auto rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-800">
                        {statusLabel(campaign.status)}
                      </span>
                    </div>
                    <div className="mt-3 text-lg font-black text-slate-950">{campaign.subject}</div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-bold text-slate-600">
                      <div className="rounded-2xl bg-slate-50 px-3 py-2">
                        <div className="text-slate-950">{campaign.recipient_count}</div>
                        <div>alıcı</div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-2">
                        <div className="text-slate-950">{campaign.sent_count}</div>
                        <div>başarılı</div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-2">
                        <div className="text-slate-950">{campaign.failed_count}</div>
                        <div>hata</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-400">
                      <CheckCircle2 className="h-4 w-4" />
                      {formatDate(campaign.completed_at || campaign.created_at)}
                    </div>
                    {campaign.error_message ? (
                      <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
                        {campaign.error_message}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

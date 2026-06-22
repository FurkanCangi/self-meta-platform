"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Bell,
  BookOpen,
  CheckCircle2,
  Clock3,
  Info,
  Megaphone,
  Send,
  ShieldAlert,
  Sparkles,
} from "lucide-react"

type NotificationKind = "info" | "education" | "system" | "warning"
type NotificationAudience = "all" | "therapists" | "owners"

type OwnerNotification = {
  id: string
  title: string
  message: string
  kind: NotificationKind
  audience: NotificationAudience
  actionLabel: string | null
  actionUrl: string | null
  publishedAt: string
  status?: string
  targetCount?: number
}

const kindOptions: Array<{
  value: NotificationKind
  label: string
  description: string
  icon: typeof Info
}> = [
  { value: "education", label: "Eğitim", description: "Eğitim içerikleri ve modül güncellemeleri", icon: BookOpen },
  { value: "info", label: "Bilgi", description: "Genel duyuru ve bilgilendirme", icon: Info },
  { value: "system", label: "Sistem", description: "Panel, rapor ve teknik akış notları", icon: Sparkles },
  { value: "warning", label: "Önemli", description: "Dikkat gerektiren duyurular", icon: ShieldAlert },
]

const audienceOptions: Array<{ value: NotificationAudience; label: string; description: string }> = [
  { value: "therapists", label: "Terapistler", description: "Normal terapist panelinde görünür." },
  { value: "all", label: "Herkes", description: "Tüm doğrulanmış kullanıcılar görür." },
  { value: "owners", label: "Owner", description: "Yalnızca hedefli/owner iç duyurular için." },
]

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value))
  } catch {
    return value
  }
}

function kindLabel(kind: NotificationKind) {
  return kindOptions.find((item) => item.value === kind)?.label || "Bilgi"
}

function kindClass(kind: NotificationKind) {
  if (kind === "education") return "from-cyan-400 to-blue-600 text-white"
  if (kind === "warning") return "from-amber-300 to-violet-600 text-white"
  if (kind === "system") return "from-blue-500 to-violet-600 text-white"
  return "from-cyan-300 to-violet-500 text-white"
}

export default function OwnerNotificationsClient() {
  const [title, setTitle] = useState("Eğitim kayıtları güncellendi")
  const [message, setMessage] = useState(
    "Yeni eğitim içerikleri ve uygulama notları panelinizde erişime açıldı.",
  )
  const [kind, setKind] = useState<NotificationKind>("education")
  const [audience, setAudience] = useState<NotificationAudience>("therapists")
  const [actionLabel, setActionLabel] = useState("Eğitimleri İncele")
  const [actionUrl, setActionUrl] = useState("/trainings")
  const [targetEmails, setTargetEmails] = useState("")
  const [notifications, setNotifications] = useState<OwnerNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [setupRequired, setSetupRequired] = useState(false)

  const previewIcon = useMemo(() => {
    const option = kindOptions.find((item) => item.value === kind)
    return option?.icon || Bell
  }, [kind])
  const PreviewIcon = previewIcon

  const loadNotifications = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/owner-notifications", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Bildirimler yüklenemedi.")
      setNotifications(data.notifications || [])
      setSetupRequired(Boolean(data.setupRequired))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bildirimler yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSending(true)
    setNotice("")
    setError("")

    try {
      const emails = targetEmails
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean)

      const res = await fetch("/api/owner-notifications", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-dna-request": "same-origin",
        },
        body: JSON.stringify({
          title,
          message,
          kind,
          audience,
          actionLabel: actionLabel || null,
          actionUrl: actionUrl || null,
          targetEmails: emails,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        setSetupRequired(Boolean(data?.setupRequired))
        throw new Error(data?.error || "Bildirim gönderilemedi.")
      }

      setNotice("Bildirim yayınlandı. Terapistler sağ üstteki bildirim alanında görecek.")
      setTargetEmails("")
      await loadNotifications()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bildirim gönderilemedi.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-[0_30px_90px_rgba(15,23,42,0.10)] backdrop-blur-xl">
        <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="p-6 sm:p-8 lg:p-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-blue-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-gradient-to-br from-cyan-400 to-violet-600" />
              Bildirim Merkezi
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight text-slate-950 sm:text-5xl">
              Terapistlere şık ve kontrollü panel bildirimi gönderin.
            </h1>
            <p className="mt-4 max-w-2xl text-base font-medium leading-8 text-slate-600">
              Eğitim kayıtları, sistem duyuruları ve önemli notlar terapist panelinin sağ üst
              bildirim alanında görünür. Gönderilen içerikler klinik çalışma akışını bölmeden,
              DNA tasarım diliyle sunulur.
            </p>

            {setupRequired ? (
              <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-900">
                Bildirim tablosu Supabase tarafında hazır değil.{" "}
                <code className="rounded bg-white px-1.5 py-0.5">sql/notifications.sql</code>{" "}
                dosyasını SQL Editor içinde çalıştırın.
              </div>
            ) : null}
          </div>

          <div className="relative min-h-[320px] bg-[radial-gradient(circle_at_30%_30%,rgba(34,211,238,0.24),transparent_30%),radial-gradient(circle_at_72%_64%,rgba(124,58,237,0.24),transparent_34%),linear-gradient(135deg,#eefbff,#f7f2ff)] p-6 sm:p-8 lg:p-10">
            <div className="absolute inset-8 rounded-full border border-blue-200/60" />
            <div className="absolute inset-16 rounded-full border border-dashed border-violet-200/80" />
            <div className="relative flex h-full min-h-[260px] items-center justify-center">
              <div className="w-full max-w-sm rounded-[2rem] border border-white/80 bg-white/86 p-5 shadow-[0_26px_80px_rgba(37,99,235,0.20)] backdrop-blur-xl">
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${kindClass(kind)} shadow-lg`}
                  >
                    <PreviewIcon className="h-7 w-7" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">
                      {kindLabel(kind)}
                    </div>
                    <div className="mt-2 text-xl font-black leading-snug text-slate-950">
                      {title || "Bildirim başlığı"}
                    </div>
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                      {message || "Terapistin göreceği kısa açıklama burada yer alır."}
                    </p>
                  </div>
                </div>
                {actionLabel ? (
                  <div className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">
                    {actionLabel}
                    <Send className="h-4 w-4" />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <form
          onSubmit={handleSubmit}
          className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-8"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-100 to-violet-100 text-blue-700">
              <Megaphone className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-950">Yeni bildirim</h2>
              <p className="text-sm font-medium text-slate-500">Kısa, net ve aksiyon odaklı yazın.</p>
            </div>
          </div>

          <div className="mt-7 grid gap-5">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Başlık</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                required
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Mesaj</span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={800}
                required
                rows={5}
                className="resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <div className="grid gap-3">
              <span className="text-sm font-bold text-slate-700">Kategori</span>
              <div className="grid gap-3 sm:grid-cols-2">
                {kindOptions.map((option) => {
                  const Icon = option.icon
                  const selected = kind === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setKind(option.value)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        selected
                          ? "border-blue-300 bg-blue-50 shadow-[0_12px_34px_rgba(37,99,235,0.12)]"
                          : "border-slate-200 bg-white hover:border-blue-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-blue-600" />
                        <div className="text-sm font-black text-slate-950">{option.label}</div>
                      </div>
                      <p className="mt-2 text-xs font-medium leading-5 text-slate-500">
                        {option.description}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Hedef</span>
              <select
                value={audience}
                onChange={(event) => setAudience(event.target.value as NotificationAudience)}
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                {audienceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} - {option.description}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700">Aksiyon etiketi</span>
                <input
                  value={actionLabel}
                  onChange={(event) => setActionLabel(event.target.value)}
                  maxLength={48}
                  placeholder="Örn. Eğitimleri İncele"
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700">Aksiyon bağlantısı</span>
                <input
                  value={actionUrl}
                  onChange={(event) => setActionUrl(event.target.value)}
                  maxLength={240}
                  placeholder="/trainings"
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                />
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Belirli e-posta hedefleri</span>
              <textarea
                value={targetEmails}
                onChange={(event) => setTargetEmails(event.target.value)}
                rows={3}
                placeholder="Boş bırakılırsa seçilen hedef grubuna gider. Birden fazla e-posta için satır satır yazın."
                className="resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            {notice ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                {notice}
              </div>
            ) : null}
            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={sending}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 px-6 py-4 text-sm font-black text-white shadow-[0_18px_44px_rgba(37,99,235,0.24)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? "Gönderiliyor..." : "Bildirim Yayınla"}
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-950">Yayınlananlar</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">Son gönderilen panel bildirimleri.</p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
              {notifications.length} kayıt
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            {loading ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm font-bold text-slate-500">
                Bildirimler yükleniyor...
              </div>
            ) : notifications.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <Bell className="mx-auto h-8 w-8 text-slate-400" />
                <div className="mt-3 text-sm font-bold text-slate-600">
                  Henüz yayınlanmış bildirim yok.
                </div>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full bg-gradient-to-br px-3 py-1 text-xs font-black uppercase tracking-wide ${kindClass(item.kind)}`}
                    >
                      {kindLabel(item.kind)}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-600">
                      {item.audience}
                    </span>
                    <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-slate-400">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatDate(item.publishedAt)}
                    </span>
                  </div>
                  <div className="mt-3 text-lg font-black text-slate-950">{item.title}</div>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{item.message}</p>
                  {item.actionLabel ? (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-black text-blue-700">
                      <CheckCircle2 className="h-4 w-4" />
                      {item.actionLabel}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

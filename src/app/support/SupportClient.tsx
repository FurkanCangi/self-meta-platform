"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ImagePlus,
  LifeBuoy,
  MessageCircle,
  Paperclip,
  Send,
  UploadCloud,
} from "lucide-react"
import type { SupportTicket } from "@/lib/support/supportTickets"

type SupportClientProps = {
  initialTickets: SupportTicket[]
  initialEmail: string
  initialCategory?: string
  authenticated: boolean
  setupRequired?: boolean
}

const categories = [
  { value: "login", label: "Giriş / hesap" },
  { value: "device", label: "Cihaz / oturum" },
  { value: "payment", label: "Ödeme / paket" },
  { value: "report", label: "Rapor" },
  { value: "education", label: "Eğitim" },
  { value: "technical", label: "Teknik sorun" },
  { value: "other", label: "Diğer" },
]

const priorities = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "Önemli" },
  { value: "urgent", label: "Acil" },
  { value: "low", label: "Düşük" },
]

function formatDateTime(value: string | null | undefined) {
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

function detectDeviceType() {
  if (typeof navigator === "undefined") return "unknown"
  const ua = navigator.userAgent || ""
  if (/ipad|tablet|playbook|silk/i.test(ua)) return "tablet"
  if (/mobi|iphone|android/i.test(ua)) return "mobile"
  return "desktop"
}

function statusClass(status: string) {
  if (status === "resolved" || status === "closed") return "bg-emerald-50 text-emerald-800"
  if (status === "in_progress") return "bg-blue-50 text-blue-700"
  if (status === "waiting_user") return "bg-violet-50 text-violet-800"
  return "bg-slate-100 text-slate-900"
}

function TicketCard({ ticket }: { ticket: SupportTicket }) {
  const isResolved = ticket.status === "resolved" || ticket.status === "closed"

  return (
    <details className="group rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${statusClass(ticket.status)}`}>
              {ticket.statusLabel}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
              {ticket.ticketNo}
            </span>
            <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700">
              {ticket.categoryLabel}
            </span>
          </div>
          <div className="mt-3 truncate text-lg font-black text-slate-950">{ticket.subject}</div>
          <div className="mt-1 text-sm text-slate-500">
            {isResolved ? "Çözüm tarihi" : "Son güncelleme"}: {formatDateTime(isResolved ? ticket.resolvedAt || ticket.updatedAt : ticket.updatedAt)}
          </div>
        </div>
        <span className="rounded-2xl bg-slate-950 px-4 py-2 text-xs font-black text-white">
          <span className="group-open:hidden">Detay</span>
          <span className="hidden group-open:inline">Kapat</span>
        </span>
      </summary>

      <div className="border-t border-slate-100 p-5">
        <p className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
          {ticket.description}
        </p>

        {ticket.resolutionMessage ? (
          <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
            <div className="mb-1 flex items-center gap-2 font-black">
              <CheckCircle2 className="h-4 w-4" />
              Çözüm bilgisi
            </div>
            {ticket.resolutionMessage}
          </div>
        ) : isResolved ? (
          <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-900">
            Bu talep çözüldü olarak işaretlendi.
          </div>
        ) : null}

        {ticket.attachments.length ? (
          <div className="mt-4 grid gap-2">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">Ekler</div>
            <div className="flex flex-wrap gap-2">
              {ticket.attachments.map((attachment) =>
                attachment.signedUrl ? (
                  <a
                    key={attachment.id}
                    href={attachment.signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Paperclip className="h-4 w-4" />
                    {attachment.originalFileName}
                  </a>
                ) : null,
              )}
            </div>
          </div>
        ) : null}

        {ticket.messages.length > 1 ? (
          <div className="mt-4 grid gap-2">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">Mesaj akışı</div>
            {ticket.messages.slice(1).map((message) => (
              <div
                key={message.id}
                className={[
                  "rounded-2xl px-4 py-3 text-sm leading-6",
                  message.senderRole === "owner"
                    ? "border border-blue-100 bg-blue-50 text-blue-900"
                    : "border border-slate-100 bg-slate-50 text-slate-700",
                ].join(" ")}
              >
                <div className="mb-1 text-xs font-black uppercase tracking-wide opacity-70">
                  {message.senderRole === "owner" ? "Destek ekibi" : "Siz"} - {formatDateTime(message.createdAt)}
                </div>
                {message.message}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </details>
  )
}

function selectedFileLabel(files: FileList | null) {
  const count = files?.length || 0
  if (!count) return "Henüz dosya eklenmedi"
  return `${count} dosya hazır`
}

function supportErrorMessage(code?: string) {
  if (code === "support_tables_missing") {
    return "Destek kayıt alanı hazırlanıyor. Lütfen biraz sonra tekrar deneyin."
  }
  if (code === "support_storage_missing") {
    return "Ekran görüntüsü yükleme alanı hazırlanıyor. Dosyasız göndermeyi deneyebilir veya biraz sonra tekrar deneyebilirsiniz."
  }
  if (code === "support_subject_invalid") {
    return "Lütfen kısa bir başlık yazın."
  }
  if (code === "support_description_invalid") {
    return "Lütfen sorunu birkaç cümleyle açıklayın."
  }
  if (code === "support_email_invalid" || code === "email_required") {
    return "Lütfen geçerli bir e-posta adresi yazın."
  }
  if (code === "too_many_attachments") {
    return "Lütfen daha az dosya ekleyin."
  }
  if (code === "attachment_too_large") {
    return "Eklediğiniz dosyalardan biri çok büyük. Daha küçük bir ekran görüntüsü deneyin."
  }
  if (code === "attachment_type_invalid" || code === "attachment_signature_invalid") {
    return "Eklediğiniz dosya desteklenmiyor. Ekran görüntüsü olarak PNG veya JPG deneyin."
  }
  if (code === "Too many requests") {
    return "Çok kısa sürede fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin."
  }
  return "Talep oluşturulamadı. Lütfen bilgileri kontrol edip tekrar deneyin."
}

export default function SupportClient({
  initialTickets,
  initialEmail,
  initialCategory = "technical",
  authenticated,
  setupRequired,
}: SupportClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAppSurface = searchParams.get("surface") === "app"
  const [pending, startTransition] = useTransition()
  const [tickets, setTickets] = useState<SupportTicket[]>(initialTickets)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [files, setFiles] = useState<FileList | null>(null)

  useEffect(() => {
    setTickets(initialTickets)
  }, [initialTickets])

  const openTickets = useMemo(() => tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).length, [tickets])
  const resolvedTickets = useMemo(() => tickets.filter((ticket) => ["resolved", "closed"].includes(ticket.status)).length, [tickets])
  const activeTickets = useMemo(() => tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status)), [tickets])
  const pastTickets = useMemo(() => tickets.filter((ticket) => ["resolved", "closed"].includes(ticket.status)), [tickets])

  async function refreshTickets() {
    if (!authenticated) return
    try {
      const response = await fetch("/api/support/tickets", { cache: "no-store" })
      const payload = await response.json().catch(() => null)
      if (response.ok && payload?.ok && Array.isArray(payload.tickets)) {
        setTickets(payload.tickets)
      }
    } catch {}
  }

  function submit(formData: FormData) {
    setError("")
    setMessage("")

    formData.set("pageUrl", window.location.href)
    formData.set("browserInfo", `${navigator.userAgent || "unknown"} | ${window.innerWidth}x${window.innerHeight}`)
    formData.set("deviceType", detectDeviceType())

    if (files) {
      Array.from(files).forEach((file) => formData.append("attachments", file))
    }

    startTransition(async () => {
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        body: formData,
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) {
        setError(supportErrorMessage(payload?.error))
        return
      }

      setMessage(
        `${payload.ticket.ticketNo} numaralı destek talebiniz alındı. En geç ${payload.ticket.responseTargetHours} saat içinde dönüş hedefliyoruz.`,
      )
      const form = document.getElementById("support-ticket-form") as HTMLFormElement | null
      form?.reset()
      setFiles(null)
      await refreshTickets()
      router.refresh()
    })
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={isAppSurface ? "/starter?surface=app" : "/starter"}
          className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm font-black text-blue-700 shadow-sm transition hover:bg-blue-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Terapist paneline dön
        </Link>
        {message ? (
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-black text-cyan-900 shadow-sm">
            Destek talebiniz gönderildi.
          </div>
        ) : null}
      </div>

      {message ? (
        <div className="rounded-[1.5rem] border border-cyan-200 bg-cyan-50 p-5 text-cyan-950 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-cyan-700 shadow-sm">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-black">Destek talebiniz gönderildi</div>
              <p className="mt-1 text-sm font-semibold leading-6">
                Talebiniz destek ekibimize iletildi. İnceleme ve çözüm bilgisi bu sayfada görünecek.
              </p>
              <p className="mt-2 text-sm font-bold">{message}</p>
            </div>
          </div>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(37,99,235,0.10)]">
        <div className="grid gap-0 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="relative overflow-hidden bg-slate-950 p-7 text-white sm:p-9">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(34,211,238,0.28),transparent_34%),radial-gradient(circle_at_90%_12%,rgba(124,58,237,0.24),transparent_30%),linear-gradient(160deg,#020617_0%,#0f2a4a_58%,#075569_100%)]" />
            <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-cyan-100">
              <LifeBuoy className="h-4 w-4" />
              Destek Merkezi
            </div>
            <h1 className="mt-5 max-w-xl text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              Sorunu bize net anlat, hızlıca takip edelim.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-blue-100">
              Giriş, cihaz, paket, rapor veya eğitim hatalarında tek kayıt aç. Ekran görüntüsü eklersen sorunu çok daha hızlı anlayabiliriz.
            </p>
            <div className="mt-8 grid gap-3">
              <div className="flex gap-3 rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
                <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
                <div>
                  <div className="text-sm font-black">Aynı gün takip</div>
                  <div className="mt-1 text-xs font-semibold leading-5 text-blue-100">
                    Sorununuz tek kayıt altında takip edilir; ekran görüntüsü varsa daha hızlı netleşir.
                  </div>
                </div>
              </div>
              <div className="flex gap-3 rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
                <ImagePlus className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
                <div>
                  <div className="text-sm font-black">Görsel kanıt eklenebilir</div>
                  <div className="mt-1 text-xs font-semibold leading-5 text-blue-100">
                    Hata ekranı, cihaz uyarısı veya ödeme ekranı eklenebilir.
                  </div>
                </div>
              </div>
              <div className="flex gap-3 rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
                <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
                <div>
                  <div className="text-sm font-black">Çözüm notu burada görünür</div>
                  <div className="mt-1 text-xs font-semibold leading-5 text-blue-100">
                    Açık talep: {openTickets} · Çözülen: {resolvedTickets}
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>

          <form
            id="support-ticket-form"
            action={submit}
            className="grid gap-4 bg-white p-6 sm:p-8 lg:p-10"
          >
            {setupRequired ? (
              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm font-semibold text-violet-900">
                Destek kayıt alanı hazırlanıyor. Kısa süre sonra yeniden deneyebilirsiniz.
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                E-posta
                <input
                  name="email"
                  type="email"
                  defaultValue={initialEmail}
                  readOnly={Boolean(initialEmail)}
                  required={!authenticated}
                  className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 font-semibold text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100 read-only:text-slate-500"
                  placeholder="ornek@mail.com"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Ad Soyad
                <input
                  name="requesterName"
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 font-semibold text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  placeholder="Adınız"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Konu
                <select name="category" defaultValue={initialCategory} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 font-semibold">
                  {categories.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Öncelik
                <select name="priority" defaultValue="normal" className="h-12 rounded-2xl border border-slate-200 bg-white px-4 font-semibold">
                  {priorities.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Başlık
              <input
                name="subject"
                required
                minLength={3}
                maxLength={140}
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 font-semibold text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                placeholder="Örn: Cihaz sınırı hatası alıyorum"
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Sorunu anlat
              <textarea
                name="description"
                required
                minLength={10}
                maxLength={4000}
                className="min-h-[150px] rounded-2xl border border-slate-200 bg-white px-4 py-3 font-medium leading-6 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                placeholder="Ne yaparken oldu, ekranda ne yazdı, hangi cihazdan denediniz?"
              />
            </label>

            <label className="grid cursor-pointer gap-3 rounded-3xl border border-dashed border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50/70 p-5 text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50">
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf"
                onChange={(event) => setFiles(event.target.files)}
                className="sr-only"
              />
              <span className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-blue-700 shadow-sm">
                    <UploadCloud className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block font-black text-slate-900">Ekran görüntüsü ekle</span>
                    <span className="mt-1 block text-xs font-semibold text-slate-500">
                      Hata ekranı veya ilgili belgeyi buraya ekleyebilirsiniz.
                    </span>
                  </span>
                </span>
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-blue-700 shadow-sm">
                  {selectedFileLabel(files)}
                </span>
              </span>
            </label>

            <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4 text-xs font-semibold leading-5 text-violet-900">
              Lütfen danışan bilgisi, terapi içeriği veya özel kişisel veri paylaşmayın. Bu alan teknik destek içindir.
            </div>

            {error ? (
              <div className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-900">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                {error}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white shadow-[0_16px_35px_rgba(15,23,42,0.18)] transition hover:bg-blue-700 disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {pending ? "Gönderiliyor..." : "Destek Talebi Oluştur"}
            </button>
          </form>
        </div>
      </section>

      {authenticated && tickets.length ? (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="grid gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-950">Açık takipler</h2>
              <p className="mt-1 text-sm text-slate-500">İnceleme veya işlem bekleyen talepleriniz burada durur.</p>
            </div>
            {activeTickets.length ? (
              activeTickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-500">
                Açık destek talebiniz yok.
              </div>
            )}
          </div>

          <div className="grid gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-950">Çözülen talepler</h2>
              <p className="mt-1 text-sm text-slate-500">Çözülmüş konular ve varsa çözüm notları burada kalır.</p>
            </div>
            {pastTickets.length ? (
              pastTickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-500">
                Henüz çözülen talep yok.
              </div>
            )}
          </div>
        </section>
      ) : authenticated ? (
        <div className="rounded-[1.5rem] border border-dashed border-blue-200 bg-white p-8 text-center text-sm font-semibold text-slate-500">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          Daha önce destek talebi oluşturmadınız.
        </div>
      ) : (
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 text-sm leading-6 text-slate-600">
          Giriş yapmadan talep oluşturabilirsiniz. Talebi takip etmek için aynı e-posta ile giriş yaptığınızda kayıtlar hesabınıza bağlanabilir.
        </div>
      )}
    </div>
  )
}

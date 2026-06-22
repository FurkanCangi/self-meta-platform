"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ImagePlus,
  LifeBuoy,
  Paperclip,
  Send,
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
  if (status === "resolved" || status === "closed") return "bg-emerald-50 text-emerald-700"
  if (status === "in_progress") return "bg-blue-50 text-blue-700"
  if (status === "waiting_user") return "bg-amber-50 text-amber-700"
  return "bg-rose-50 text-rose-700"
}

function TicketCard({ ticket }: { ticket: SupportTicket }) {
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
          <div className="mt-1 text-sm text-slate-500">Son güncelleme: {formatDateTime(ticket.updatedAt)}</div>
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
          <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
            <div className="mb-1 flex items-center gap-2 font-black">
              <CheckCircle2 className="h-4 w-4" />
              Çözüm notu
            </div>
            {ticket.resolutionMessage}
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

export default function SupportClient({
  initialTickets,
  initialEmail,
  initialCategory = "technical",
  authenticated,
  setupRequired,
}: SupportClientProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [files, setFiles] = useState<FileList | null>(null)

  const openTickets = useMemo(
    () => initialTickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).length,
    [initialTickets],
  )

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
        setError(
          payload?.error === "support_tables_missing"
            ? "Destek tabloları henüz Supabase tarafında uygulanmamış."
            : "Talep oluşturulamadı. Lütfen bilgileri kontrol edip tekrar deneyin.",
        )
        return
      }

      setMessage(
        `${payload.ticket.ticketNo} numaralı destek talebiniz alındı. En geç ${payload.ticket.responseTargetHours} saat içinde dönüş hedefliyoruz.`,
      )
      const form = document.getElementById("support-ticket-form") as HTMLFormElement | null
      form?.reset()
      setFiles(null)
      router.refresh()
    })
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-[0_24px_70px_rgba(37,99,235,0.10)]">
        <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-900 p-7 text-white sm:p-9">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-cyan-100">
              <LifeBuoy className="h-4 w-4" />
              Destek Merkezi
            </div>
            <h1 className="mt-5 max-w-xl text-3xl font-black tracking-tight sm:text-4xl">
              Sorunu ekran görüntüsüyle gönder, biz tek kayıttan takip edelim.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-blue-100">
              Giriş, cihaz, paket, rapor veya eğitim hatalarında talep oluştur. Ekran görüntüsü eklersen aynı gün içinde sorunu anlamamız çok daha kolay olur.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/10 p-4">
                <Clock3 className="h-5 w-5 text-cyan-200" />
                <div className="mt-3 text-2xl font-black">24s</div>
                <div className="text-xs font-semibold text-blue-100">Dönüş hedefi</div>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <ImagePlus className="h-5 w-5 text-cyan-200" />
                <div className="mt-3 text-2xl font-black">3 ek</div>
                <div className="text-xs font-semibold text-blue-100">Ekran görüntüsü/PDF</div>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <CheckCircle2 className="h-5 w-5 text-cyan-200" />
                <div className="mt-3 text-2xl font-black">{openTickets}</div>
                <div className="text-xs font-semibold text-blue-100">Açık talep</div>
              </div>
            </div>
          </div>

          <form
            id="support-ticket-form"
            action={submit}
            className="grid gap-4 bg-white p-6 sm:p-8"
          >
            {setupRequired ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                Destek SQL dosyası Supabase’e uygulanınca kayıtlar canlı çalışacak.
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

            <label className="grid gap-2 rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 p-4 text-sm font-bold text-slate-700">
              <span className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-blue-600" />
                Ekran görüntüsü veya PDF ekle
              </span>
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf"
                onChange={(event) => setFiles(event.target.files)}
                className="text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-bold file:text-white"
              />
              <span className="text-xs font-semibold text-slate-500">En fazla 3 dosya, dosya başına 8 MB.</span>
            </label>

            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs font-semibold leading-5 text-amber-800">
              Lütfen terapi/sağlık içeriği, danışan bilgisi veya özel kişisel veri paylaşmayın. Bu alan teknik destek içindir.
            </div>

            {error ? (
              <div className="flex items-start gap-2 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                {error}
              </div>
            ) : null}
            {message ? (
              <div className="flex items-start gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4" />
                {message}
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

      <section className="grid gap-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-slate-950">Taleplerim</h2>
            <p className="mt-1 text-sm text-slate-500">
              Çözüm notu geldiyse burada görünür. Ayrıca panel bildiriminden de haber verilir.
            </p>
          </div>
        </div>

        {authenticated ? (
          initialTickets.length ? (
            <div className="grid gap-3">
              {initialTickets.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} />
              ))}
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-semibold text-slate-500">
              Henüz destek talebiniz yok.
            </div>
          )
        ) : (
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 text-sm leading-6 text-slate-600">
            Giriş yapmadan talep oluşturabilirsiniz. Talebi takip etmek için aynı e-posta ile giriş yaptığınızda kayıtlar hesabınıza bağlanabilir.
          </div>
        )}
      </section>
    </div>
  )
}

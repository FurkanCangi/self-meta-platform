import Link from "next/link"
import { notFound } from "next/navigation"
import { Paperclip, ShieldCheck } from "lucide-react"
import { assertOwnerAuditAccess } from "@/lib/owner/ownerAccess"
import {
  fetchOwnerSupportTickets,
  isMissingSupportTable,
  summarizeSupportTickets,
  type SupportTicket,
} from "@/lib/support/supportTickets"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import OwnerSupportActions from "./OwnerSupportActions"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function pickQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || ""
}

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

function statusClass(status: string) {
  if (status === "resolved" || status === "closed") return "bg-emerald-50 text-emerald-700"
  if (status === "in_progress") return "bg-blue-50 text-blue-700"
  if (status === "waiting_user") return "bg-amber-50 text-amber-700"
  return "bg-rose-50 text-rose-700"
}

function priorityClass(priority: string) {
  if (priority === "urgent") return "bg-rose-100 text-rose-800"
  if (priority === "high") return "bg-amber-100 text-amber-800"
  return "bg-slate-100 text-slate-700"
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`text-xs font-black uppercase tracking-[0.18em] ${tone}`}>{label}</div>
      <div className="mt-3 text-3xl font-black text-slate-950">{value}</div>
    </div>
  )
}

function TicketRow({ ticket }: { ticket: SupportTicket }) {
  return (
    <details className="group rounded-[2rem] border border-slate-200 bg-white shadow-sm open:shadow-md">
      <summary className="flex cursor-pointer list-none flex-col gap-4 p-5 transition hover:bg-slate-50/80 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${statusClass(ticket.status)}`}>
              {ticket.statusLabel}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${priorityClass(ticket.priority)}`}>
              {ticket.priorityLabel}
            </span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
              {ticket.categoryLabel}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
              {ticket.ticketNo}
            </span>
          </div>
          <h2 className="mt-3 truncate text-xl font-black text-slate-950">{ticket.subject}</h2>
          <div className="mt-1 flex flex-wrap gap-2 text-sm font-semibold text-slate-500">
            <span>{ticket.requesterName}</span>
            <span>/</span>
            <span>{ticket.requesterEmail}</span>
            <span>/</span>
            <span>{formatDateTime(ticket.updatedAt)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 sm:grid-cols-4 xl:min-w-[430px]">
          <div className="rounded-2xl bg-slate-50 px-3 py-2">
            <div className="font-black text-slate-950">{ticket.attachments.length}</div>
            <div>ek</div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2">
            <div className="font-black text-slate-950">{ticket.messages.length}</div>
            <div>mesaj</div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2">
            <div className="font-black text-slate-950">{ticket.deviceType}</div>
            <div>cihaz</div>
          </div>
          <div className="rounded-2xl bg-slate-950 px-3 py-2 text-white">
            <div className="font-black">Aç</div>
            <div className="text-slate-300 group-open:hidden">detay</div>
            <div className="hidden text-slate-300 group-open:block">kapat</div>
          </div>
        </div>
      </summary>

      <div className="border-t border-slate-100 p-5">
        <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <div className="min-w-0">
            <div className="rounded-3xl bg-slate-50 p-4">
              <div className="text-xs font-black uppercase tracking-wide text-slate-500">Kullanıcı açıklaması</div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{ticket.description}</p>
            </div>

            <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-black uppercase tracking-wide text-slate-500">Sayfa</div>
                <div className="mt-2 break-all font-semibold text-slate-800">{ticket.pageUrl || "-"}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-black uppercase tracking-wide text-slate-500">Tarayıcı</div>
                <div className="mt-2 break-all font-semibold text-slate-800">{ticket.browserInfo || "-"}</div>
              </div>
            </div>

            {ticket.attachments.length ? (
              <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-black uppercase tracking-wide text-slate-500">Ekler</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ticket.attachments.map((attachment) =>
                    attachment.signedUrl ? (
                      <a
                        key={attachment.id}
                        href={attachment.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-white"
                      >
                        <Paperclip className="h-4 w-4" />
                        {attachment.originalFileName}
                      </a>
                    ) : null,
                  )}
                </div>
              </div>
            ) : null}

            {ticket.messages.length ? (
              <div className="mt-4 grid gap-2">
                <div className="text-xs font-black uppercase tracking-wide text-slate-500">Mesaj geçmişi</div>
                {ticket.messages.map((message) => (
                  <div
                    key={message.id}
                    className={[
                      "rounded-2xl border px-4 py-3 text-sm leading-6",
                      message.senderRole === "owner"
                        ? "border-blue-100 bg-blue-50 text-blue-900"
                        : "border-slate-100 bg-slate-50 text-slate-700",
                    ].join(" ")}
                  >
                    <div className="mb-1 text-xs font-black uppercase tracking-wide opacity-70">
                      {message.senderRole === "owner" ? "Owner yanıtı" : "Kullanıcı"} - {formatDateTime(message.createdAt)}
                    </div>
                    {message.message}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <OwnerSupportActions
            ticketId={ticket.id}
            currentStatus={ticket.status}
            initialOwnerNote={ticket.ownerNote}
            initialResolutionMessage={ticket.resolutionMessage}
          />
        </div>
      </div>
    </details>
  )
}

export default async function OwnerSupportPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  try {
    assertOwnerAuditAccess(user?.email)
  } catch {
    notFound()
  }

  const params = await searchParams
  const q = pickQueryValue(params.q)
  const status = pickQueryValue(params.status) || "all"
  const category = pickQueryValue(params.category) || "all"
  const priority = pickQueryValue(params.priority) || "all"

  let tickets: SupportTicket[] = []
  let setupRequired = false

  try {
    tickets = await fetchOwnerSupportTickets({ q, status, category, priority })
  } catch (error) {
    setupRequired = isMissingSupportTable(error)
  }

  const summary = summarizeSupportTickets(tickets)

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/owner-audit" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            Owner paneli
          </Link>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">Destek Talepleri</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Kullanıcılardan gelen giriş, cihaz, ödeme, rapor ve eğitim sorunlarını ekran görüntüleriyle birlikte tek yerden takip et.
          </p>
        </div>
        <Link
          href="/support"
          className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700 transition hover:bg-blue-100"
        >
          <ShieldCheck className="h-4 w-4" />
          Kullanıcı destek ekranı
        </Link>
      </div>

      {setupRequired ? (
        <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
          Destek tabloları hazır değil. Supabase SQL editor içinde <span className="font-black">sql/support_tickets.sql</span> dosyasını çalıştırmak gerekiyor.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Toplam" value={summary.total} tone="text-slate-500" />
        <StatCard label="Yeni" value={summary.open} tone="text-rose-600" />
        <StatCard label="İnceleniyor" value={summary.inProgress} tone="text-blue-600" />
        <StatCard label="Kullanıcı Bekleniyor" value={summary.waitingUser} tone="text-amber-600" />
        <StatCard label="Çözülen" value={summary.resolved} tone="text-emerald-600" />
      </div>

      <form className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[1fr_170px_170px_170px_auto] xl:items-end">
          <label className="grid gap-2 text-sm text-slate-600">
            <span className="font-bold text-slate-800">Ara</span>
            <input
              name="q"
              defaultValue={q}
              placeholder="E-posta, ad, başlık, talep no"
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <label className="grid gap-2 text-sm text-slate-600">
            <span className="font-bold text-slate-800">Durum</span>
            <select name="status" defaultValue={status} className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-slate-800">
              <option value="all">Tümü</option>
              <option value="open">Yeni</option>
              <option value="in_progress">İnceleniyor</option>
              <option value="waiting_user">Kullanıcı bekleniyor</option>
              <option value="resolved">Çözüldü</option>
              <option value="closed">Kapandı</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-600">
            <span className="font-bold text-slate-800">Konu</span>
            <select name="category" defaultValue={category} className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-slate-800">
              <option value="all">Tümü</option>
              <option value="login">Giriş</option>
              <option value="device">Cihaz</option>
              <option value="payment">Ödeme</option>
              <option value="report">Rapor</option>
              <option value="education">Eğitim</option>
              <option value="technical">Teknik</option>
              <option value="other">Diğer</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-600">
            <span className="font-bold text-slate-800">Öncelik</span>
            <select name="priority" defaultValue={priority} className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-slate-800">
              <option value="all">Tümü</option>
              <option value="urgent">Acil</option>
              <option value="high">Önemli</option>
              <option value="normal">Normal</option>
              <option value="low">Düşük</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button type="submit" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800">
              Filtrele
            </button>
            <Link href="/owner-audit/support" className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-black text-slate-700">
              Sıfırla
            </Link>
          </div>
        </div>
      </form>

      <section className="grid gap-4">
        {tickets.length ? (
          tickets.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} />)
        ) : (
          <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center text-sm font-semibold text-slate-500">
            Bu filtrelerle destek talebi bulunmadı.
          </div>
        )}
      </section>
    </div>
  )
}

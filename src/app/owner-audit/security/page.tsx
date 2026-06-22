import Link from "next/link"
import { notFound } from "next/navigation"
import { assertOwnerAuditAccess } from "@/lib/owner/ownerAccess"
import { fetchOwnerSecurityDashboard, type OwnerSecurityEvent, type OwnerSecurityUser } from "@/lib/owner/ownerSecurity"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { OwnerSecurityActionButton } from "./OwnerSecurityActions"

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

function riskLabel(value: OwnerSecurityUser["riskLevel"]) {
  if (value === "critical") return "Kritik"
  if (value === "high") return "Yüksek"
  if (value === "medium") return "Orta"
  return "Düşük"
}

function riskClass(value: OwnerSecurityUser["riskLevel"]) {
  if (value === "critical") return "bg-rose-100 text-rose-800"
  if (value === "high") return "bg-amber-100 text-amber-800"
  if (value === "medium") return "bg-blue-100 text-blue-800"
  return "bg-emerald-100 text-emerald-800"
}

function eventClass(value: OwnerSecurityEvent["severity"]) {
  if (value === "danger") return "bg-rose-50 text-rose-700"
  if (value === "warning") return "bg-amber-50 text-amber-700"
  return "bg-slate-100 text-slate-700"
}

function findingClass(value: "info" | "warning" | "danger") {
  if (value === "danger") return "border-rose-100 bg-rose-50 text-rose-800"
  if (value === "warning") return "border-amber-100 bg-amber-50 text-amber-800"
  return "border-slate-100 bg-slate-50 text-slate-700"
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${tone}`}>{label}</div>
      <div className="mt-3 text-3xl font-semibold text-slate-950">{value}</div>
    </div>
  )
}

function UserSecurityCard({ user }: { user: OwnerSecurityUser }) {
  const locked = user.temporaryLockedUntil && new Date(user.temporaryLockedUntil).getTime() > Date.now()

  return (
    <details className="group rounded-3xl border border-slate-200 bg-white shadow-sm open:shadow-md">
      <summary className="flex cursor-pointer list-none flex-col gap-4 p-5 transition hover:bg-slate-50/70 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${riskClass(user.riskLevel)}`}>
              {riskLabel(user.riskLevel)} risk / {user.riskScore}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              {user.plan}
            </span>
            {user.manualReviewRequired ? (
              <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-700">
                İncelemede
              </span>
            ) : null}
            {locked ? (
              <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-700">
                Kilitli
              </span>
            ) : null}
            {user.suspendedAt ? (
              <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-800">
                Askıda
              </span>
            ) : null}
          </div>

          <div className="mt-3 truncate text-xl font-semibold text-slate-950">{user.fullName}</div>
          <div className="mt-1 truncate text-sm text-slate-500">{user.email}</div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 md:min-w-[430px] md:grid-cols-5">
          <div className="rounded-2xl bg-slate-50 px-3 py-2">
            <div className="font-semibold text-slate-900">{user.activeSessions}</div>
            <div>oturum</div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2">
            <div className="font-semibold text-slate-900">{user.registeredDevices}</div>
            <div>cihaz</div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2">
            <div className="font-semibold text-slate-900">{user.paymentWarnings}</div>
            <div>ödeme</div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2">
            <div className="font-semibold text-slate-900">{user.videoWarnings}</div>
            <div>video</div>
          </div>
          <div className="rounded-2xl bg-slate-950 px-3 py-2 text-white">
            <div className="font-semibold">Aç</div>
            <div className="text-slate-300 group-open:hidden">detay</div>
            <div className="hidden text-slate-300 group-open:block">kapat</div>
          </div>
        </div>
      </summary>

      <div className="border-t border-slate-100 p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-3">
              <div>User ID: <span className="font-semibold text-slate-900">{user.userId}</span></div>
              <div>Son görülme: <span className="font-semibold text-slate-900">{formatDateTime(user.lastSeenAt)}</span></div>
              <div>Rapor hakkı: <span className="font-semibold text-slate-900">{user.reportCreditBalance}</span></div>
            </div>

            {user.recentIps.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {user.recentIps.map((ip) => (
                  <span key={ip} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {ip}
                  </span>
                ))}
              </div>
            ) : null}

            {user.riskFindings.length ? (
              <div className="mt-4 grid gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Temizlenebilir güvenlik durumları</div>
                {user.riskFindings.map((finding) => (
                  <div key={finding.eventType} className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-sm ${findingClass(finding.severity)}`}>
                    <span>
                      <span className="font-semibold">{finding.label}</span>
                      <span className="ml-2 text-xs opacity-70">{finding.count} kayıt</span>
                    </span>
                    <OwnerSecurityActionButton
                      targetUserId={user.userId}
                      action="clear_event_type"
                      label="Temizle"
                      eventType={finding.eventType}
                    />
                  </div>
                ))}
              </div>
            ) : user.riskReasons.length ? (
              <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                {user.riskReasons.join(" • ")}
              </div>
            ) : null}
          </div>

        <div className="grid min-w-[260px] gap-3">
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/owner-audit/${encodeURIComponent(user.userId)}?tab=audit`}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Detay
            </Link>
            <OwnerSecurityActionButton targetUserId={user.userId} action="revoke_sessions" label="Oturumları düşür" variant="dark" />
            {(user.riskScore > 0 || user.manualReviewRequired || locked) ? (
              <OwnerSecurityActionButton targetUserId={user.userId} action="clear_risk" label="Riskten çıkar" />
            ) : null}
            {user.manualReviewRequired ? (
              <OwnerSecurityActionButton targetUserId={user.userId} action="clear_review" label="İncelemeyi kaldır" />
            ) : (
              <OwnerSecurityActionButton targetUserId={user.userId} action="mark_review" label="İncelemeye al" />
            )}
            {locked ? (
              <OwnerSecurityActionButton targetUserId={user.userId} action="clear_lock" label="Kilidi kaldır" />
            ) : (
              <OwnerSecurityActionButton targetUserId={user.userId} action="temporary_lock" label="30 dk kilitle" variant="danger" lockMinutes={30} />
            )}
            {user.suspendedAt ? (
              <OwnerSecurityActionButton targetUserId={user.userId} action="unsuspend" label="Askıyı kaldır" />
            ) : (
              <OwnerSecurityActionButton targetUserId={user.userId} action="suspend" label="Askıya al" variant="danger" />
            )}
          </div>

          {user.devices.length ? (
            <div className="rounded-2xl bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cihazlar</div>
              <div className="mt-2 grid gap-2">
                {user.devices.map((device) => (
                  <div key={device.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-xs text-slate-600">
                    <span>
                      <span className="font-semibold text-slate-900">{device.type}</span> / {device.lastIp || "IP yok"}
                    </span>
                    {device.revokedAt ? (
                      <span className="font-semibold text-rose-600">İptal</span>
                    ) : (
                      <OwnerSecurityActionButton
                        targetUserId={user.userId}
                        action="revoke_device"
                        label="Cihazı iptal et"
                        variant="danger"
                        deviceId={device.id}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      </div>
    </details>
  )
}

function EventRow({ event }: { event: OwnerSecurityEvent }) {
  return (
    <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm md:grid-cols-[130px_1fr_190px_110px] md:items-center">
      <div className="flex flex-wrap gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${eventClass(event.severity)}`}>
          {event.category}
        </span>
      </div>
      <div>
        <div className="font-semibold text-slate-950">{event.label}</div>
        <div className="mt-1 text-slate-500">{event.email} / {event.detail}</div>
      </div>
      <div className="text-xs font-medium text-slate-400 md:text-right">{formatDateTime(event.createdAt)}</div>
      <div className="md:text-right">
        {event.category === "account" && event.userId && event.eventType ? (
          <OwnerSecurityActionButton
            targetUserId={event.userId}
            action="clear_event_type"
            label="Temizle"
            eventType={event.eventType}
          />
        ) : null}
      </div>
    </div>
  )
}

export default async function OwnerSecurityPage({ searchParams }: { searchParams: SearchParams }) {
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
  const risk = pickQueryValue(params.risk) || "all"
  const category = pickQueryValue(params.category) || "all"
  const dashboard = await fetchOwnerSecurityDashboard({ q, risk, category })

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/owner-audit" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            Owner paneli
          </Link>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">Güvenlik Kontrol Merkezi</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Paket, ödeme, eğitim videosu, cihaz, oturum ve şüpheli kullanım olaylarını sade şekilde izleyip gerektiğinde müdahale edebilirsin.
          </p>
        </div>
      </div>

      {dashboard.setupIssues.length ? (
        <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
          Bazı güvenlik tabloları henüz hazır görünmüyor: {dashboard.setupIssues.join(", ")}.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Yüksek Risk" value={dashboard.summary.highRiskUsers} tone="text-rose-600" />
        <StatCard label="İncelemede" value={dashboard.summary.manualReviews} tone="text-violet-600" />
        <StatCard label="Aktif Oturum" value={dashboard.summary.activeSessions} tone="text-slate-500" />
        <StatCard label="Ödeme Uyarısı" value={dashboard.summary.paymentWarnings} tone="text-amber-600" />
        <StatCard label="Video Uyarısı" value={dashboard.summary.videoWarnings} tone="text-blue-600" />
      </div>

      <form className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_180px_180px_auto] lg:items-end">
          <label className="grid gap-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">Kullanıcı ara</span>
            <input
              name="q"
              defaultValue={q}
              placeholder="E-posta, ad, user id, plan"
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <label className="grid gap-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">Risk</span>
            <select name="risk" defaultValue={risk} className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-slate-800">
              <option value="all">Tümü</option>
              <option value="critical">Kritik</option>
              <option value="high">Yüksek</option>
              <option value="medium">Orta</option>
              <option value="low">Düşük</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">Alan</span>
            <select name="category" defaultValue={category} className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-slate-800">
              <option value="all">Tümü</option>
              <option value="payment">Ödeme</option>
              <option value="video">Eğitim video</option>
              <option value="device">Cihaz</option>
              <option value="api">API</option>
              <option value="review">İnceleme</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button type="submit" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              Filtrele
            </button>
            <Link href="/owner-audit/security" className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700">
              Sıfırla
            </Link>
          </div>
        </div>
      </form>

      <section className="grid gap-4">
        <div className="text-lg font-semibold text-slate-950">Kullanıcı Güvenlik Durumu</div>
        {dashboard.users.length ? (
          dashboard.users.map((securityUser) => <UserSecurityCard key={securityUser.userId} user={securityUser} />)
        ) : (
          <div className="rounded-[2rem] border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
            Bu filtrelerle güvenlik kaydı bulunmadı.
          </div>
        )}
      </section>

      <details className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
          <div>
            <div className="text-lg font-semibold text-slate-950">Son Güvenlik Olayları</div>
            <div className="mt-1 text-sm text-slate-500">{dashboard.events.length} olay. Liste kapalı gelir; gerektiğinde açıp temizleyebilirsin.</div>
          </div>
          <span className="rounded-2xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white">Aç/Kapat</span>
        </summary>
        <div className="max-h-[620px] overflow-y-auto border-t border-slate-100 p-5">
          <div className="grid gap-3">
            {dashboard.events.slice(0, 80).map((event) => <EventRow key={event.id} event={event} />)}
          </div>
        </div>
      </details>
    </div>
  )
}

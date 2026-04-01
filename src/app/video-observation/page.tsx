import Link from "next/link"
import {
  fetchVideoObservationBundle,
  fetchVideoObservationSessions,
  type VideoObservationSessionListItem,
} from "@/lib/video-observation/server"
import VideoObservationWorkflow from "./video-observation-workflow"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export const dynamic = "force-dynamic"

function pickQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || ""
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—"

  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value))
  } catch {
    return value
  }
}

function formatConfidence(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—"
  return `%${Math.round(value * 100)}`
}

function labelTone(label: string | null | undefined) {
  const normalized = (label || "").toLowerCase()
  if (normalized.includes("belirgin")) return "bg-rose-50 text-rose-700 border-rose-200"
  if (normalized.includes("hafif")) return "bg-amber-50 text-amber-700 border-amber-200"
  if (normalized.includes("olağan") || normalized.includes("olagan")) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200"
  }
  return "bg-slate-100 text-slate-700 border-slate-200"
}

function statusTone(status: string | null | undefined) {
  const normalized = (status || "").toLowerCase()
  if (normalized.includes("processed") || normalized.includes("approved")) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200"
  }
  if (normalized.includes("submitted") || normalized.includes("running")) {
    return "bg-indigo-50 text-indigo-700 border-indigo-200"
  }
  if (normalized.includes("failed") || normalized.includes("error")) {
    return "bg-rose-50 text-rose-700 border-rose-200"
  }
  return "bg-slate-100 text-slate-700 border-slate-200"
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent: string
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${accent}`}>{label}</div>
      <div className="mt-3 text-3xl font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function SessionListCard({
  session,
  active,
}: {
  session: VideoObservationSessionListItem
  active: boolean
}) {
  return (
    <Link
      href={`/video-observation?session_id=${session.session_id}`}
      className={`block rounded-3xl border p-5 transition ${
        active
          ? "border-indigo-300 bg-indigo-50 shadow-sm"
          : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-slate-900">{session.child_label}</div>
          <div className="mt-1 text-xs text-slate-500">
            {session.child_external_ref || "Harici referans yok"}
          </div>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${statusTone(session.status)}`}>
          {session.status}
        </span>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
        <div>Yaş: {session.age_months} ay</div>
        <div>Band: {session.support_age_band}</div>
        <div>Segment: {session.segment_count}</div>
        <div>Güven: {formatConfidence(session.overall_confidence)}</div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {session.completed_segment_types.map((segmentType) => (
          <span
            key={`${session.session_id}-${segmentType}`}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600"
          >
            {segmentType}
          </span>
        ))}
        {session.has_report ? (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            Rapor Hazır
          </span>
        ) : null}
      </div>

      <div className="mt-4 text-xs text-slate-500">
        Oluşturulma: {formatDateTime(session.created_at)}
      </div>
    </Link>
  )
}

export default async function VideoObservationPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const sessionId = pickQueryValue(params.session_id).trim()
  const sessionQuery = pickQueryValue(params.q).trim()
  const bundle = sessionId ? await fetchVideoObservationBundle(sessionId) : null
  const sessionList = await fetchVideoObservationSessions({ limit: 12, query: sessionQuery })

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.22em] text-indigo-500">
            Video Gözlem
          </div>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">
            Evidence Viewer MVP
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Video observation servisi tarafından üretilen domain skorları, olay zaman çizelgesi,
            explainable kanıtlar ve deterministik rapor burada görüntülenir. Bu ekran ilk etapta
            session ID ile açılır.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
          <div className="font-semibold text-slate-900">Bağlı servis</div>
          <div className="mt-1 break-all">{bundle?.baseUrl || process.env.VIDEO_OBS_API_BASE_URL || "http://127.0.0.1:8091"}</div>
        </div>
      </div>

      <form className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="grid gap-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">Session ID</span>
            <input
              type="text"
              name="session_id"
              defaultValue={sessionId}
              placeholder="örn. 4d9d8f1b-..."
              className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Oturumu Aç
          </button>

          <Link
            href="/video-observation"
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Temizle
          </Link>
        </div>

        <div className="mt-4 text-xs leading-6 text-slate-500">
          Viewer şu an session bazlıdır. Video servisinde üretilmiş bir session kimliği girildiğinde
          özet, domain, timeline, evidence ve rapor blokları birlikte çekilir.
        </div>
      </form>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
              Session Listesi
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              Önceki Video Oturumlarını Yeniden Aç
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Son oturumlar burada listelenir. Bir karta tıklayarak aynı session için evidence
              viewer’ı yeniden açabilirsin.
            </p>
          </div>

          <form className="grid gap-3 lg:grid-cols-[minmax(18rem,24rem)_auto]">
            <input
              type="text"
              name="q"
              defaultValue={sessionQuery}
              placeholder="Çocuk etiketi ile ara"
              className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Listeyi Yenile
            </button>
          </form>
        </div>

        {sessionList.error ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Session listesi yüklenemedi: {sessionList.error}
          </div>
        ) : sessionList.sessions.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
            Henüz kayıtlı video oturumu görünmüyor.
          </div>
        ) : (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {sessionList.sessions.map((session) => (
              <SessionListCard key={session.session_id} session={session} active={session.session_id === sessionId} />
            ))}
          </div>
        )}
      </section>

      <VideoObservationWorkflow initialSessionId={sessionId} />

      {!sessionId ? (
        <div className="rounded-[2rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-sm leading-7 text-slate-600">
          Henüz bir session açılmadı. Video observation servisinde oluşturulmuş bir `session_id`
          girerek ilk evidence viewer akışını test edebilirsin.
        </div>
      ) : null}

      {bundle?.errors.length ? (
        <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          <div className="font-semibold">Bazı bloklar yüklenemedi</div>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            {bundle.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {bundle?.summary ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Durum" value={String(bundle.summary.status || "—")} accent="text-slate-500" />
            <StatCard label="Güven" value={formatConfidence(bundle.summary.overall_confidence)} accent="text-indigo-600" />
            <StatCard label="Kalite" value={String(bundle.summary.quality_label || "—")} accent="text-emerald-600" />
            <StatCard label="Segment" value={String(bundle.summary.segment_count || "0")} accent="text-amber-600" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
            <div className="flex flex-col gap-6">
              <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Oturum Özeti
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                      {bundle.summary.child_label}
                    </h2>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <div>Yaş: {bundle.summary.age_months} ay</div>
                    <div>Band: {bundle.summary.support_age_band}</div>
                    <div>Tarih: {formatDateTime(bundle.summary.created_at)}</div>
                  </div>
                </div>

                {bundle.summary.warnings?.length ? (
                  <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    <div className="font-semibold">Uyarılar</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {bundle.summary.warnings.map((warning: string) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>

              <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Domain Skorları
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {bundle.domains.map((domain: any) => (
                    <div key={domain.name} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-base font-semibold text-slate-900">{domain.name}</div>
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${labelTone(domain.label)}`}>
                          {domain.label}
                        </span>
                      </div>
                      <div className="mt-4 text-3xl font-semibold text-slate-900">{Math.round(domain.score_0_100)}</div>
                      <div className="mt-2 text-sm text-slate-500">Güven: {formatConfidence(domain.confidence)}</div>
                      {domain.rationale?.supporting_features?.length ? (
                        <div className="mt-4 text-sm leading-6 text-slate-600">
                          <div className="font-medium text-slate-800">Destekleyen sinyaller</div>
                          <div className="mt-1">
                            {domain.rationale.supporting_features.slice(0, 4).join(", ")}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Evidence Timeline
                </div>
                <div className="mt-5 space-y-3">
                  {bundle.timeline.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                      Timeline event bulunamadı.
                    </div>
                  ) : (
                    bundle.timeline.map((event: any, index: number) => (
                      <div key={`${event.segment_type}-${event.event_type}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                            {event.segment_type}
                          </span>
                          <span className="text-sm font-semibold text-slate-900">{event.event_type}</span>
                          <span className="text-xs text-slate-500">
                            {Math.round(event.start_ms / 1000)}s - {Math.round(event.end_ms / 1000)}s
                          </span>
                          <span className="text-xs text-slate-500">Güven: {formatConfidence(event.confidence)}</span>
                        </div>
                        {event.evidence ? (
                          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-2xl bg-white p-3 text-xs leading-6 text-slate-600">
                            {JSON.stringify(event.evidence, null, 2)}
                          </pre>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            <div className="flex flex-col gap-6">
              <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Domain Evidence
                </div>
                <div className="mt-5 space-y-4">
                  {bundle.evidence?.domain_evidence ? (
                    Object.entries(bundle.evidence.domain_evidence).map(([domainName, items]) => (
                      <div key={domainName} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="font-semibold text-slate-900">{domainName}</div>
                        <div className="mt-3 space-y-2 text-sm text-slate-600">
                          {(items as any[]).slice(0, 4).map((item, index) => (
                            <div key={`${domainName}-${index}`} className="rounded-xl bg-white px-3 py-2">
                              {typeof item === "string" ? item : JSON.stringify(item)}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                      Domain evidence bulunamadı.
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Self Meta Füzyon
                </div>
                <div className="mt-5 space-y-3">
                  {bundle.fusion.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                      Füzyon verisi bulunamadı.
                    </div>
                  ) : (
                    bundle.fusion.map((row: any) => (
                      <div key={row.domain_name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                        <div className="font-semibold text-slate-900">{row.domain_name}</div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-slate-600">
                          <div>Video: {row.video_score ?? "—"}</div>
                          <div>Ölçek: {row.scale_score ?? "—"}</div>
                          <div>Fused: {row.fused_score ?? "—"}</div>
                          <div>Uyum: {row.agreement_label ?? "—"}</div>
                        </div>
                        {row.next_step ? <div className="mt-2 text-slate-700">{row.next_step}</div> : null}
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Deterministik Klinik Yorum
                </div>
                <div className="mt-5 rounded-3xl bg-slate-50 p-5">
                  <pre className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                    {bundle.report?.report_text || "Rapor bulunamadı."}
                  </pre>
                </div>
              </section>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

import { NextResponse } from "next/server"

import { requireConfirmedUser } from "@/lib/security/apiGuards"
import { checkRateLimit } from "@/lib/security/rateLimit"
import { isOwnerAuditEmail } from "@/lib/owner/ownerAccess"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { resolveDnaS13LimitedRolloutConfig } from "@/lib/dna/chat/s13/limitedRollout/config"
import { getDnaS13LimitedRolloutReleaseCandidate } from "@/lib/dna/chat/s13/limitedRollout/release"
import { readDnaS13LimitedReadoutRecords } from "@/lib/dna/chat/s13/limitedRollout/store.server"
import {
  DNA_S13_LIMITED_MONITORING_THRESHOLDS,
  summarizeDnaS13LimitedRollout,
} from "@/lib/dna/chat/s13/limitedRollout/telemetry"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Vary: "Cookie",
}

function json(payload: unknown, init?: ResponseInit) {
  const response = NextResponse.json(payload, init)
  for (const [name, value] of Object.entries(NO_STORE_HEADERS)) response.headers.set(name, value)
  return response
}

export async function GET(request: Request) {
  const auth = await requireConfirmedUser()
  if (!auth.ok || !isOwnerAuditEmail(auth.user.email)) {
    return json({ ok: false, error: "Not found" }, { status: 404 })
  }
  const limit = await checkRateLimit({
    key: `dna-s13-limited-readout:${auth.user.id}`,
    limit: 120,
    windowMs: 60 * 60 * 1_000,
  })
  if (!limit.backendAvailable) return json({ ok: false, error: "readout_unavailable" }, { status: 503 })
  if (!limit.ok) return json({ ok: false, error: "too_many_requests" }, { status: 429 })

  const sinceParam = new URL(request.url).searchParams.get("since")
  const sinceDate = sinceParam ? new Date(sinceParam) : null
  const since = sinceDate && Number.isFinite(sinceDate.getTime())
    ? sinceDate.toISOString()
    : new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString()
  const config = resolveDnaS13LimitedRolloutConfig()
  const records = await readDnaS13LimitedReadoutRecords({
    admin: createSupabaseAdminClient(),
    since,
  })
  if (!records.ok) return json({ ok: false, error: "readout_unavailable" }, { status: 503 })
  return json({
    ok: true,
    release: getDnaS13LimitedRolloutReleaseCandidate(),
    gate: {
      enabled: config.enabled,
      phase: config.phase,
      percent: config.percent,
      l0OwnerAllowlistOnly: config.l0OwnerAllowlistOnly,
    },
    thresholds: DNA_S13_LIMITED_MONITORING_THRESHOLDS,
    readout: summarizeDnaS13LimitedRollout({
      messages: records.messages,
      feedback: records.feedback,
      dailyCapMicrousd: config.dailyLunaCapMicrousd,
    }),
  })
}

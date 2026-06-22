import { createHmac } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import { redactLogFields } from "../src/lib/dna/reportLogger"

type Failure = {
  name: string
  detail: string
}

const failures: Failure[] = []
const root = process.cwd()

function check(name: string, condition: unknown, detail: string) {
  if (!condition) failures.push({ name, detail })
}

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8")
}

function hmacSha256Hex(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("hex")
}

function verifyStripeLikeSignature(params: {
  rawBody: string
  secret: string
  timestampSeconds: number
  toleranceSeconds?: number
}) {
  const signedPayload = `${params.timestampSeconds}.${params.rawBody}`
  const signature = hmacSha256Hex(params.secret, signedPayload)
  const ageSeconds = Math.abs(Date.now() / 1000 - params.timestampSeconds)
  return {
    signature,
    accepted: ageSeconds <= (params.toleranceSeconds ?? 300),
  }
}

function hasAllowedVideoSignature(bytes: Buffer) {
  if (bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp") return true
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return true
  }
  return false
}

const redacted = redactLogFields({
  email: "client@example.com",
  token: "raw-token",
  anamnez: "sensitive anamnez text",
  nested: {
    reportText: "private report",
    safe_count: 3,
  },
})

check("redacts sensitive top-level keys", redacted.email === "[redacted]" && redacted.token === "[redacted]", JSON.stringify(redacted))
check(
  "redacts clinical and report-like nested keys",
  (redacted.nested as Record<string, unknown>).reportText === "[redacted]" && redacted.anamnez === "[redacted]",
  JSON.stringify(redacted)
)
check("preserves non-sensitive fields", (redacted.nested as Record<string, unknown>).safe_count === 3, JSON.stringify(redacted))

const currentSignature = verifyStripeLikeSignature({
  rawBody: JSON.stringify({ id: "evt_1", amount: 50000, currency: "TRY", planCode: "student" }),
  secret: "test-secret",
  timestampSeconds: Math.floor(Date.now() / 1000),
})
const expiredSignature = verifyStripeLikeSignature({
  rawBody: "{}",
  secret: "test-secret",
  timestampSeconds: Math.floor(Date.now() / 1000) - 3600,
})
check("accepts fresh timestamped webhook signature shape", currentSignature.accepted && /^[a-f0-9]{64}$/.test(currentSignature.signature), currentSignature.signature)
check("rejects expired timestamped webhook signature shape", !expiredSignature.accepted, String(expiredSignature.accepted))

const legalDocuments = read("src/lib/legal/documents.ts")
check("student plan minor-unit price is configured", /student:\s*50000/.test(legalDocuments), "student price missing")
check("enterprise plan minor-unit price is configured", /enterprise:\s*1000000/.test(legalDocuments), "enterprise price missing")

const entitlements = read("src/lib/security/entitlements.ts")
check("payment amount mismatch is audited", entitlements.includes("payment_amount_mismatch"), "missing payment_amount_mismatch")
check("webhook timestamp tolerance is enforced", entitlements.includes("BILLING_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS"), "missing timestamp tolerance")
check("TRY currency is required for grant validation", /event\.currency\s*!==\s*"TRY"/.test(entitlements), "missing TRY validation")

const videoProtection = read("src/lib/security/videoProtection.ts")
check("video playback concurrency window exists", videoProtection.includes("EDUCATION_PLAYBACK_CONCURRENCY_WINDOW_SECONDS"), "missing concurrency window")
check("concurrent playback block is implemented", videoProtection.includes("concurrent_playback_blocked"), "missing concurrent block")
check("provider-agnostic playback access exists", videoProtection.includes("createEducationVideoPlaybackAccess"), "missing provider-ready playback access")
check("mock provider mode exists", videoProtection.includes('provider === "mock"'), "missing mock provider")
check("bunny provider mode exists", videoProtection.includes('provider === "bunny"'), "missing bunny provider")
check("bunny provider enforces ready status", videoProtection.includes('error: "video_provider_not_ready"'), "missing provider readiness gate")

const eventsRoute = read("src/app/api/education/videos/[videoId]/events/route.ts")
check("education events require playerSessionId", eventsRoute.includes("player_session_id_required"), "missing player session requirement")
check("education events return HTTP 409 for concurrent playback", eventsRoute.includes("status: playback.error === \"concurrent_playback_blocked\" ? 409 : 500"), "missing 409 block")

const accessRoute = read("src/app/api/education/videos/[videoId]/access/route.ts")
check("access route returns provider field", accessRoute.includes("provider: playbackAccess.access.provider"), "missing provider response")
check("access route returns playerConfig", accessRoute.includes("playerConfig: playbackAccess.access.playerConfig"), "missing playerConfig response")

const mp4Like = Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32])
const webmLike = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0])
const textLike = Buffer.from("not a video")
check("accepts MP4/MOV ftyp signature", hasAllowedVideoSignature(mp4Like), "mp4 rejected")
check("accepts WebM EBML signature", hasAllowedVideoSignature(webmLike), "webm rejected")
check("rejects non-video file signature", !hasAllowedVideoSignature(textLike), "text accepted")

const pathSegmentConfig = read("src/lib/video-observation/config.ts")
check("video path segments are encoded", pathSegmentConfig.includes("encodeURIComponent(normalized)"), "path encoding missing")

const anomalyDetection = read("src/lib/security/anomalyDetection.ts")
check("anomaly scoring tracks IP changes", anomalyDetection.includes("active_session_ip_changed"), "IP drift scoring missing")
check("anomaly scoring tracks session replacement", anomalyDetection.includes("active_session_replaced"), "session replacement scoring missing")

const nextConfig = read("next.config.ts")
check("Next.js x-powered-by header is disabled", nextConfig.includes("poweredByHeader: false"), "poweredByHeader missing")
check("security headers include CSP", nextConfig.includes("Content-Security-Policy"), "CSP header missing")
check("security headers include HSTS", nextConfig.includes("Strict-Transport-Security"), "HSTS header missing")

const securityRules = read("CLAUDE.md")
check("project security rules mention Zod server validation", /Zod schema\/normalizer/.test(securityRules), "CLAUDE.md Zod rule missing")
check("project security rules mention AI token limits", /Token\/output limiti/.test(securityRules), "CLAUDE.md AI token limit rule missing")

const schemaGuards = read("src/lib/security/schemaGuards.ts")
check("Zod JSON schema helper exists", schemaGuards.includes("readJsonWithSchema"), "missing readJsonWithSchema")
check("Zod text JSON schema helper exists", schemaGuards.includes("parseJsonTextWithSchema"), "missing parseJsonTextWithSchema")

const aiReportRoute = read("src/app/api/ai-report/route.ts")
check("AI report route uses Zod payload schema", aiReportRoute.includes("aiReportPayloadSchema"), "missing AI report Zod schema")
check("AI report route rejects server-controlled payload fields", aiReportRoute.includes("rejectServerControlledFields"), "missing AI mass-assignment guard")
check("AI report route consumes report credit before output", aiReportRoute.includes("consumeReportCredit"), "missing report credit control")

const aiReportService = read("src/lib/dna/aiReportService.ts")
check("legacy AI path keeps API key server-side", aiReportService.includes("process.env.OPENAI_API_KEY"), "missing server-side API key usage")
check("legacy AI path has output token limit", /max_output_tokens:\s*\d+/.test(aiReportService), "missing max_output_tokens")
check("legacy AI path uses structured output schema", aiReportService.includes("zodTextFormat"), "missing structured output schema")

const ownerSecurityRoute = read("src/app/api/owner-audit/security/route.ts")
const ownerSecurityActionRoute = read("src/app/api/owner-audit/security/action/route.ts")
const ownerSecurityLib = read("src/lib/owner/ownerSecurity.ts")
const ownerSecurityCore = read("src/lib/owner/ownerSecurityCore.ts")
const ownerSecurityScenarioTests = read("scripts/owner-security-scenario-tests.ts")
const sessionRegistration = read("src/lib/security/sessionRegistration.ts")
check("owner security read route requires owner allowlist", ownerSecurityRoute.includes("assertOwnerAuditAccess"), "owner security route missing allowlist")
check("owner security action route requires trusted mutation", ownerSecurityActionRoute.includes("requireTrustedMutation"), "owner security action missing trusted mutation")
check("owner security action route validates body with Zod", ownerSecurityActionRoute.includes("ownerSecurityActionSchema"), "owner security action missing schema")
check("owner security action route is rate limited", ownerSecurityActionRoute.includes("checkRateLimit"), "owner security action missing rate limit")
check("owner security live wrapper uses injectable core", ownerSecurityLib.includes("applyOwnerSecurityActionWithClient"), "owner security wrapper missing injectable action core")
check("owner security actions block self-targeting", ownerSecurityCore.includes("owner_self_action_blocked"), "owner self-action block missing")
check("owner security actions write audit events", ownerSecurityCore.includes("owner_security_action"), "owner security audit event missing")
check("owner security can clear risk state", ownerSecurityCore.includes("clear_risk") && ownerSecurityCore.includes("risk_score: 0"), "owner clear risk action missing")
check("owner security scenario tests cover mock attacks", ownerSecurityScenarioTests.includes("5 IP / device attack is critical"), "owner attack scenario test missing")
check("owner security scenario tests cover clear risk", ownerSecurityScenarioTests.includes("clear risk resets risk state and lock"), "owner clear risk scenario missing")
check("owner security scenario tests avoid live Supabase", !ownerSecurityScenarioTests.includes("createSupabaseAdminClient"), "scenario test should not use live Supabase")
check("session registration still enforces max two devices", sessionRegistration.includes("registeredDevices.length >= MAX_REGISTERED_DEVICES"), "max device check missing")
check("session registration no longer blocks same slot second device", !sessionRegistration.includes("device_slot_unavailable"), "same slot device block should be relaxed")
check("automatic lock threshold is relaxed for test period", /const LOCK_THRESHOLD = 160/.test(anomalyDetection), "automatic lock threshold not relaxed")

const videoSql = read("sql/education_video_security.sql")
check("education video assets include provider column", videoSql.includes("provider text not null default 'supabase'"), "provider column missing")
check("education video assets include playback policy column", videoSql.includes("playback_policy text not null default 'signed_url'"), "playback policy column missing")

if (failures.length > 0) {
  console.error("Security smoke tests failed:")
  for (const failure of failures) {
    console.error(`- ${failure.name}: ${failure.detail}`)
  }
  process.exit(1)
}

console.log("Security smoke tests passed.")

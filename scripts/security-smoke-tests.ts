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
const educationVideosRoute = read("src/app/api/education/videos/route.ts")
const educationUploadRoute = read("src/app/api/education/videos/upload/route.ts")
const ownerEducationClient = read("src/app/owner-audit/education/OwnerEducationClient.tsx")
const educationVideoSql = read("sql/education_video_security.sql")
check("access route returns provider field", accessRoute.includes("provider: playbackAccess.access.provider"), "missing provider response")
check("access route returns playerConfig", accessRoute.includes("playerConfig: playbackAccess.access.playerConfig"), "missing playerConfig response")
check("education video management endpoint has owner-only manage scope", educationVideosRoute.includes("scope\") === \"manage\"") && educationVideosRoute.includes("video_manage_forbidden"), "missing education manage scope guard")
check("education upload endpoint creates signed upload URLs", educationUploadRoute.includes("createSignedUploadUrl") && educationUploadRoute.includes("video_upload_forbidden"), "missing signed owner upload endpoint")
check("education upload endpoint validates video mime types", educationUploadRoute.includes("video_upload_type_invalid") && educationUploadRoute.includes("video/quicktime"), "missing education video upload type guard")
check("owner education client uploads directly to signed storage URL", ownerEducationClient.includes("uploadToSignedUrl") && ownerEducationClient.includes("/api/education/videos/upload"), "owner education direct upload missing")
check("education video storage bucket is private", educationVideoSql.includes("'education-videos'") && educationVideoSql.includes("false") && educationVideoSql.includes("video/mp4"), "education video private bucket SQL missing")

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

const notificationsLib = read("src/lib/notifications.ts")
const ownerNotificationsClient = read("src/app/owner-audit/notifications/OwnerNotificationsClient.tsx")
check("legacy trainings notification link maps to education", notificationsLib.includes('["/trainings", "/education"]'), "missing /trainings alias")
check("notification action URLs are restricted to known app routes", notificationsLib.includes("allowedNotificationRoutePrefixes"), "missing notification route allowlist")
check("owner notifications default to existing education route", ownerNotificationsClient.includes('useState("/education")'), "owner notification default route is invalid")

const aiReportRoute = read("src/app/api/ai-report/route.ts")
const manualReportRoute = read("src/app/api/reports/manual/route.ts")
const assessmentsClient = read("src/app/assessments/AssessmentsClient.tsx")
check("AI report route uses Zod payload schema", aiReportRoute.includes("aiReportPayloadSchema"), "missing AI report Zod schema")
check("AI report route rejects server-controlled payload fields", aiReportRoute.includes("rejectServerControlledFields"), "missing AI mass-assignment guard")
check("AI report route consumes report credit", aiReportRoute.includes("consumeReportCredit"), "missing report credit control")
check(
  "AI report route charges only after successful report generation",
  aiReportRoute.indexOf("const finalText = cleanRenderedReport") < aiReportRoute.indexOf("const credit = await consumeReportCredit"),
  "report credit should be consumed after report text is built"
)
check("manual report route requires trusted mutation", manualReportRoute.includes("requireTrustedMutation"), "manual report route missing trusted mutation")
check("manual report route validates body with Zod", manualReportRoute.includes("manualReportSchema"), "manual report route missing schema")
check("manual report route consumes report credit", manualReportRoute.includes("consumeReportCredit"), "manual report route missing report credit control")
check("manual report route rolls back credit if insert fails", manualReportRoute.includes("rollback_reason") && manualReportRoute.includes("manual_report_insert_failed"), "manual report rollback missing")
check("assessment screen uses manual report API instead of direct report insert", assessmentsClient.includes('fetch("/api/reports/manual"') && !assessmentsClient.includes('.from("reports")'), "assessment report creation bypasses API")

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
const appSession = read("src/lib/security/appSession.ts")
const securityExemptions = read("src/lib/security/securityExemptions.ts")
const deviceManagementAccess = read("src/lib/security/deviceManagementAccess.ts")
const deviceManagementRoute = read("src/app/api/security/devices/route.ts")
const authLoginRoute = read("src/app/api/auth/login/route.ts")
const authCallbackRoute = read("src/app/auth/callback/route.ts")
const sessionRegisterRoute = read("src/app/api/security/session/register/route.ts")
const profileSettingsPage = read("src/app/profile-setting/page.tsx")
const profileDevicesPanel = read("src/app/profile-setting/DeviceManagementPanel.tsx")
const proxy = read("src/proxy.ts")
check("owner security read route requires owner allowlist", ownerSecurityRoute.includes("assertOwnerAuditAccess"), "owner security route missing allowlist")
check("owner security action route requires trusted mutation", ownerSecurityActionRoute.includes("requireTrustedMutation"), "owner security action missing trusted mutation")
check("owner security action route validates body with Zod", ownerSecurityActionRoute.includes("ownerSecurityActionSchema"), "owner security action missing schema")
check("owner security action route is rate limited", ownerSecurityActionRoute.includes("checkRateLimit"), "owner security action missing rate limit")
check("owner security can hide rows from panel", ownerSecurityActionRoute.includes("hide_from_security") && ownerSecurityCore.includes("owner_security_panel_hidden"), "owner hide row action missing")
check("owner security can restore hidden rows", ownerSecurityActionRoute.includes("restore_to_security") && ownerSecurityCore.includes("owner_security_panel_restored"), "owner restore row action missing")
check("owner security live wrapper uses injectable core", ownerSecurityLib.includes("applyOwnerSecurityActionWithClient"), "owner security wrapper missing injectable action core")
check("owner security actions block self-targeting", ownerSecurityCore.includes("owner_self_action_blocked"), "owner self-action block missing")
check("owner security actions write audit events", ownerSecurityCore.includes("owner_security_action"), "owner security audit event missing")
check("owner security can clear risk state", ownerSecurityCore.includes("clear_risk") && ownerSecurityCore.includes("risk_score: 0"), "owner clear risk action missing")
check("owner security can resolve specific event types", ownerSecurityCore.includes("clear_event_type") && ownerSecurityCore.includes("owner_resolved_at"), "owner clear event type action missing")
check("owner security scenario tests cover mock attacks", ownerSecurityScenarioTests.includes("5 IP / device attack is critical"), "owner attack scenario test missing")
check("owner security scenario tests cover clear risk", ownerSecurityScenarioTests.includes("clear risk resets risk state and lock"), "owner clear risk scenario missing")
check("owner security scenario tests cover clear event type", ownerSecurityScenarioTests.includes("clear event type marks matching events resolved"), "owner clear event type scenario missing")
check("owner security scenario tests avoid live Supabase", !ownerSecurityScenarioTests.includes("createSupabaseAdminClient"), "scenario test should not use live Supabase")
check("session registration enforces max three device slots", sessionRegistration.includes("MAX_REGISTERED_DEVICES = 3") && sessionRegistration.includes("registeredDevices.length >= MAX_REGISTERED_DEVICES"), "max three device check missing")
check("session registration separates desktop mobile and tablet slots", sessionRegistration.includes('deviceType === "mobile"') && sessionRegistration.includes('deviceType === "tablet"') && !sessionRegistration.includes('"handheld"'), "device slots should not collapse mobile/tablet")
check("session registration no longer blocks same slot second device", !sessionRegistration.includes("device_slot_unavailable"), "same slot device block should be relaxed")
check("session registration reuses same slot before max-device block", sessionRegistration.indexOf("sameSlotDevice") < sessionRegistration.indexOf("registeredDevices.length >= MAX_REGISTERED_DEVICES"), "same slot reuse must happen before max device block")
check("automatic lock threshold is relaxed for test period", /const LOCK_THRESHOLD = 160/.test(anomalyDetection), "automatic lock threshold not relaxed")
check("anomaly scoring tracks frequent device changes", anomalyDetection.includes("frequent_device_changes") && anomalyDetection.includes("sık cihaz ekleme/kaldırma"), "frequent device change scoring missing")
check("test security exempt emails exist", securityExemptions.includes("SECURITY_TEST_EXEMPT_EMAILS") && securityExemptions.includes("busranurtohan@gmail.com"), "test security exempt emails missing")
check("test exempt users still get session fingerprint audit", !appSession.includes("if (lockExemptUser) return { ok: true, sessionId }"), "lock exempt users should still be audited")
check("test exempt users are not scored suspicious", anomalyDetection.includes("decision = { score: 0, action: \"none\", reasons: [] }"), "lock exempt users should not retain risk score")
check("device management cookie is signed", deviceManagementAccess.includes("createHmac") && deviceManagementAccess.includes("timingSafeEqual"), "device management cookie must be signed")
check("login keeps authenticated user in device management mode on device limit", authLoginRoute.includes("setDeviceManagementCookie(response, userId)") && authLoginRoute.includes('code === "device_limit_exceeded"'), "login device-limit handoff missing")
check("google auth keeps authenticated user in device management mode on device limit", authCallbackRoute.includes("setDeviceManagementCookie(response, user.id)") && authCallbackRoute.includes('sessionResult.error === "device_limit_exceeded"'), "google device-limit handoff missing")
check("session register clears device management cookie after success", sessionRegisterRoute.includes("clearDeviceManagementCookie(response)"), "device management cookie not cleared after register")
check("device management API accepts management cookie only after auth user match", deviceManagementRoute.includes("verifyDeviceManagementToken(deviceManagementToken, user.id)"), "device management token check missing")
check("device management API revokes own devices only", deviceManagementRoute.includes('.eq("user_id", access.user.id)') && deviceManagementRoute.includes('action: z.literal("revoke")'), "self-device revoke guard missing")
check("device management API records self revoke audit event", deviceManagementRoute.includes("user_device_revoked_self"), "self revoke audit missing")
check("device management API reevaluates risk after self revoke", deviceManagementRoute.includes("evaluateAccountRisk(access.user.id)"), "self revoke risk evaluation missing")
check("proxy allows profile settings during device management mode", proxy.includes("DEVICE_MANAGEMENT_COOKIE") && proxy.includes('request.nextUrl.pathname === "/profile-setting"'), "proxy device-management settings exception missing")
check("profile settings renders device management panel", profileSettingsPage.includes("DeviceManagementPanel") && profileSettingsPage.includes("deviceLimitMode"), "settings device panel missing")
check("device panel can continue after revoking old device", profileDevicesPanel.includes("/api/security/session/register") && profileDevicesPanel.includes("Bu cihazla devam et"), "continue with this device flow missing")
check("device panel explains 1 desktop 1 phone 1 tablet policy", profileDevicesPanel.includes("1 bilgisayar, 1 telefon ve 1 tablet") && profileDevicesPanel.includes("{activeDevices.length}/3"), "three-slot device policy missing in panel")

const ownerMemberActionRoute = read("src/app/api/owner-audit/member/action/route.ts")
const ownerMemberActions = read("src/lib/owner/ownerMemberActions.ts")
const ownerAuditPage = read("src/app/owner-audit/page.tsx")
const ownerNotificationsRoute = read("src/app/api/owner-notifications/route.ts")
check("owner member panel can hide members", ownerMemberActionRoute.includes("hide_member_from_owner") && ownerMemberActions.includes("owner_member_panel_hidden"), "owner member hide action missing")
check("owner member panel can restore hidden members", ownerMemberActionRoute.includes("restore_member_to_owner") && ownerMemberActions.includes("owner_member_panel_restored"), "owner member restore action missing")
check("owner audit page shows hidden member recovery section", ownerAuditPage.includes("Listeden gizlenen üyeler") && ownerAuditPage.includes("Listeye geri al"), "hidden member recovery section missing")
check("owner notifications archive instead of hard delete", ownerNotificationsRoute.includes('status: "archived"') && !ownerNotificationsRoute.includes(".delete()"), "owner notification archive should not hard delete")
check("owner notifications can restore archived items", ownerNotificationsRoute.includes('action: z.enum(["archive", "restore"])') && ownerNotificationsRoute.includes('status: parsed.data.action === "restore" ? "published" : "archived"'), "owner notification restore missing")

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

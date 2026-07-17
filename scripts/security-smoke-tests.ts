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
const playbackLease = read("src/lib/security/educationPlaybackLease.ts")
const playbackLeaseMigration = read("supabase/migrations/20260717110915_education_video_single_playback.sql")
check("video playback concurrency window exists", videoProtection.includes("EDUCATION_PLAYBACK_CONCURRENCY_WINDOW_SECONDS"), "missing concurrency window")
check("account-wide playback lease is implemented", playbackLease.includes("claim_education_video_playback") && playbackLeaseMigration.includes("user_id uuid primary key"), "missing account lease")
check("playback claim is serialized per account", playbackLeaseMigration.includes("pg_advisory_xact_lock") && playbackLeaseMigration.includes("active_playback_exists"), "missing atomic account claim")
check("provider-agnostic playback access exists", videoProtection.includes("createEducationVideoPlaybackAccess"), "missing provider-ready playback access")
check("mock provider mode exists", videoProtection.includes('provider === "mock"'), "missing mock provider")
check("bunny provider mode exists", videoProtection.includes('provider === "bunny"'), "missing bunny provider")
check("bunny provider enforces ready status", videoProtection.includes('error: "video_provider_not_ready"'), "missing provider readiness gate")

const eventsRoute = read("src/app/api/education/videos/[videoId]/events/route.ts")
check("education events require playerSessionId and leaseId", eventsRoute.includes("playerSessionId:") && eventsRoute.includes("leaseId: z.string().uuid()"), "missing player/lease requirement")
check("education events return HTTP 409 when lease is lost", eventsRoute.includes('error === "playback_lease_lost" ? 409 : 500'), "missing lease-lost 409")
check(
  "education events require device possession except safe release",
  eventsRoute.includes('if (eventType !== "release")') &&
    eventsRoute.includes("verifyDevicePossessionForRequest") &&
    eventsRoute.includes("const possessionRequest = request.clone()"),
  "missing event possession proof"
)

const accessRoute = read("src/app/api/education/videos/[videoId]/access/route.ts")
const deviceProof = read("src/lib/security/deviceProof.ts")
const deviceProofChallengeRoute = read("src/app/api/security/device-proof/challenge/route.ts")
const browserDeviceIdentity = read("src/lib/security/browserDeviceIdentity.ts")
const educationVideosRoute = read("src/app/api/education/videos/route.ts")
const educationUploadRoute = read("src/app/api/education/videos/upload/route.ts")
const ownerEducationClient = read("src/app/owner-audit/education/OwnerEducationClient.tsx")
const educationVideoSql = read("sql/education_video_security.sql")
check("access route returns provider field", accessRoute.includes("provider: playbackAccess.access.provider"), "missing provider response")
check("access route returns playerConfig", accessRoute.includes("playerConfig: playbackAccess.access.playerConfig"), "missing playerConfig response")
check("video access requires current device possession", accessRoute.includes("verifyDevicePossessionForRequest"), "missing access possession proof")
check(
  "device possession challenge binds exact raw request body",
  deviceProof.includes("challenge.bodyHash") &&
    deviceProof.includes("await params.request.clone().text()") &&
    browserDeviceIdentity.includes("new TextEncoder().encode(params.body)"),
  "missing exact body binding"
)
check(
  "device possession proof is one-time and expired nonces are cleaned per user",
  deviceProof.includes('device_possession_proof_replayed') &&
    deviceProof.includes('.eq("user_id", params.userId)') &&
    deviceProof.includes('.lt("expires_at", new Date().toISOString())'),
  "missing nonce replay or cleanup control"
)
check(
  "device possession challenge is allowlisted and rate limited",
  deviceProof.includes("normalizeDevicePossessionTarget") &&
    deviceProofChallengeRoute.includes("device-possession-challenge:") &&
    deviceProofChallengeRoute.includes("checkRateLimit"),
  "missing challenge allowlist or rate limit"
)
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
check(
  "project security rules require deterministic reporting",
  /tamamen deterministik kalır/.test(securityRules) && /Harici üretken model/.test(securityRules),
  "CLAUDE.md deterministic report rule missing"
)

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
const reportCreditsLib = read("src/lib/security/reportCredits.ts")
const assessmentsClient = read("src/app/assessments/AssessmentsClient.tsx")
check("deterministic report route uses Zod payload schema", aiReportRoute.includes("deterministicReportPayloadSchema"), "missing report Zod schema")
check("deterministic report route rejects server-controlled payload fields", aiReportRoute.includes("rejectServerControlledFields"), "missing report mass-assignment guard")
check("deterministic report route consumes report credit", aiReportRoute.includes("consumeReportCredit"), "missing report credit control")
check(
  "deterministic report route charges only after successful report generation",
  aiReportRoute.indexOf("const finalText = cleanRenderedReport") < aiReportRoute.indexOf("const credit = await consumeReportCredit"),
  "report credit should be consumed after report text is built"
)
check("manual report route requires trusted mutation", manualReportRoute.includes("requireTrustedMutation"), "manual report route missing trusted mutation")
check("manual report route validates body with Zod", manualReportRoute.includes("manualReportSchema"), "manual report route missing schema")
check("manual report route consumes report credit", manualReportRoute.includes("consumeReportCredit"), "manual report route missing report credit control")
check("manual report route rolls back credit if insert fails", manualReportRoute.includes("rollback_reason") && manualReportRoute.includes("manual_report_insert_failed"), "manual report rollback missing")
check("assessment screen uses manual report API instead of direct report insert", assessmentsClient.includes('fetch("/api/reports/manual"') && !assessmentsClient.includes('.from("reports")'), "assessment report creation bypasses API")
check("test and owner emails bypass report credit gate", reportCreditsLib.includes("isSecurityTestExemptEmail") && reportCreditsLib.includes("isOwnerAuditEmail") && aiReportRoute.includes("userEmail: user.email") && manualReportRoute.includes("userEmail: auth.user.email"), "test/owner report credit exemption missing")

const deterministicReportEngine = read("src/lib/dna/reportEngine.ts")
check("report route uses deterministic report engine", aiReportRoute.includes("buildAdvancedReport"), "deterministic report builder missing")
check(
  "production report path has no external model runtime",
  !/OPENAI_API_KEY|from\s+["']openai["']|rewriteClinicalReport|generateAIClinicalReport/i.test(
    `${aiReportRoute}\n${deterministicReportEngine}`
  ),
  "external model runtime found in production report path"
)

const dnaChatRoute = read("src/app/api/app/dna-chat/route.ts")
const dnaChatApiResolver = read("src/lib/dna/chat/apiResolver.ts")
const dnaChatSnapshot = read("src/lib/dna/chat/reportSnapshot.ts")
const dnaChatCatalogFiles = fs
  .readdirSync(path.join(root, "src/lib/dna/chat/catalog"))
  .filter((file) => file.endsWith(".ts"))
  .sort()
  .map((file) => `src/lib/dna/chat/catalog/${file}`)
const dnaChatEngine = [
  "src/lib/dna/chat/apiResolver.ts",
  "src/lib/dna/chat/engine.ts",
  "src/lib/dna/chat/catalogReasoning.ts",
  "src/lib/dna/chat/router.ts",
  "src/lib/dna/chat/knowledge.ts",
  "src/lib/dna/chat/safety.ts",
  ...dnaChatCatalogFiles,
].map(read).join("\n")
check("DNA chat requires confirmed app session", dnaChatRoute.includes("requireConfirmedUser"), "DNA chat auth guard missing")
check("DNA chat POST requires trusted mutation", dnaChatRoute.includes("requireTrustedMutation"), "DNA chat trusted mutation guard missing")
check("DNA chat payload uses strict Zod schema", dnaChatRoute.includes("dnaChatPostSchema") && dnaChatRoute.includes(".strict()") && dnaChatRoute.includes("safeParse"), "DNA chat strict schema missing")
check(
  "DNA chat enforces streaming 8 KB body limit",
  dnaChatRoute.includes("MAX_BODY_BYTES = 8 * 1024") &&
    dnaChatRoute.includes("readDnaChatRequestBody") &&
    dnaChatApiResolver.includes("request.body.getReader()") &&
    dnaChatApiResolver.includes("totalBytes > maxBytes"),
  "DNA chat streaming body limit missing",
)
check("DNA chat has burst and hourly rate limits", dnaChatRoute.includes("limit: 12") && dnaChatRoute.includes("windowMs: 10_000") && dnaChatRoute.includes("limit: 120"), "DNA chat dual rate limit missing")
check("DNA chat responses are no-store", dnaChatRoute.includes('"Cache-Control": "private, no-store'), "DNA chat no-store header missing")
check("DNA chat ownership chain has no role bypass", dnaChatRoute.includes('.eq("owner_id", userId)') && dnaChatRoute.includes('.from("assessments_v2")') && dnaChatRoute.includes('.from("reports")') && !dnaChatRoute.includes("isAdminRole"), "DNA chat strict ownership chain missing")
check("DNA chat uses authenticated RLS client for report reads", dnaChatRoute.includes("createSupabaseServerClient") && !dnaChatRoute.includes('.from("profiles")'), "DNA chat RLS read path missing")
check(
  "DNA chat case answers fail closed when audit is unavailable",
  dnaChatRoute.includes("resolveDnaChatApiRequest(payload") &&
    dnaChatApiResolver.includes('error: "audit_unavailable"') &&
    dnaChatApiResolver.includes("let accessedCaseReport = false") &&
    dnaChatApiResolver.includes("accessedCaseReport = true") &&
    dnaChatApiResolver.includes("!audit.ok && accessedCaseReport"),
  "DNA chat fail-closed audit missing",
)
check("DNA chat audit excludes question and answer text", !/metadata:\s*\{[\s\S]{0,800}\b(question|answer|client_code|report_id|snapshot|anamnez)\s*:/i.test(dnaChatRoute), "DNA chat audit metadata contains clinical content")
check("DNA chat runtime has no external model dependency", !/OPENAI_API_KEY|from\s+["']openai["']|anthropic|ollama|langchain|pinecone|vector(?:store|db)|fetch\s*\(\s*["']https?:/i.test(`${dnaChatRoute}\n${dnaChatEngine}`), "external model or runtime retrieval found in DNA chat")
check("DNA report snapshot contains versioned safe chat context", aiReportRoute.includes("buildDnaChatSnapshotContext(report)") && dnaChatSnapshot.includes('"dna-chat-context@1"') && dnaChatSnapshot.includes("caseEvidenceLines") && dnaChatSnapshot.includes("counterEvidenceLines") && dnaChatSnapshot.includes("preservedCapacityLines"), "safe DNA chat snapshot context missing")
check("DNA report chat context does not copy raw evidence-map text", !/evidenceMap\.(?:caseEvidenceLines|counterEvidenceLines|preservedCapacityLines|dataLimitations)/.test(dnaChatSnapshot), "raw evidence-map text copied into DNA chat snapshot")

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
const legalAcceptanceGate = read("src/app/components/app-shell/LegalAcceptanceGate.tsx")
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
check("session registration enforces max three trusted devices", sessionRegistration.includes("MAX_REGISTERED_DEVICES = 3") && sessionRegistration.includes("occupiedDeviceSlots >= MAX_REGISTERED_DEVICES"), "max three device check missing")
check("session registration allows any mix of device types", !sessionRegistration.includes("sameSlotDevice") && !sessionRegistration.includes("deviceSlot("), "device types must not reserve separate slots")
check("session registration no longer blocks same slot second device", !sessionRegistration.includes("device_slot_unavailable"), "same slot device block should be relaxed")
check("session registration replaces only the same device session", sessionRegistration.includes('.eq("device_id", device.id)') && !sessionRegistration.includes('eventType: "active_session_replaced"'), "session replacement must be device-scoped")
check("anomaly scoring never auto-locks the account", anomalyDetection.includes('action: "none" | "manual_review"') && !anomalyDetection.includes('action: "temporary_lock"'), "automatic account lock must be disabled")
check("anomaly scoring tracks frequent device changes", anomalyDetection.includes("frequent_device_changes") && anomalyDetection.includes("sık cihaz ekleme/kaldırma"), "frequent device change scoring missing")
check("test security exempt emails exist", securityExemptions.includes("SECURITY_TEST_EXEMPT_EMAILS") && securityExemptions.includes("busranurtohan@gmail.com"), "test security exempt emails missing")
check("test exempt users still get session fingerprint audit", !appSession.includes("if (lockExemptUser) return { ok: true, sessionId }"), "lock exempt users should still be audited")
check("test exempt users are not scored suspicious", anomalyDetection.includes("decision = { score: 0, action: \"none\", reasons: [] }"), "lock exempt users should not retain risk score")
check("device management cookie is signed", deviceManagementAccess.includes("createHmac") && deviceManagementAccess.includes("timingSafeEqual"), "device management cookie must be signed")
check("login keeps authenticated user in device management mode on device limit", authLoginRoute.includes("setDeviceManagementCookie(response, userId)") && authLoginRoute.includes('code === "device_limit_exceeded"'), "login device-limit handoff missing")
check("google auth keeps authenticated user in device management mode on device limit", authCallbackRoute.includes("setDeviceManagementCookie(response, user.id)") && authCallbackRoute.includes('sessionResult.error === "device_limit_exceeded"'), "google device-limit handoff missing")
check("session register clears device management cookie after success", sessionRegisterRoute.includes("clearDeviceManagementCookie(response)"), "device management cookie not cleared after register")
check(
  "device management API validates signed management identity and exposes only its pending request",
  deviceManagementRoute.includes("readDeviceManagementToken") &&
    deviceManagementRoute.includes("managementToken.userId") &&
    deviceManagementRoute.includes("access.pendingToken?.deviceId") &&
    deviceManagementRoute.includes('access.mode !== "active_session"'),
  "signed pending-only management access missing"
)
check("device management API revokes own devices only", deviceManagementRoute.includes('.eq("user_id", access.user.id)') && deviceManagementRoute.includes('action: z.literal("revoke")'), "self-device revoke guard missing")
check("device management API records self revoke audit event", deviceManagementRoute.includes("user_device_revoked_self"), "self revoke audit missing")
check("device management API does not auto-lock after self revoke", !deviceManagementRoute.includes("evaluateAccountRisk(access.user.id)"), "self revoke must remain an audited user action")
check("proxy allows profile settings during device management mode", proxy.includes("DEVICE_MANAGEMENT_COOKIE") && proxy.includes('request.nextUrl.pathname === "/profile-setting"'), "proxy device-management settings exception missing")
check(
  "legal acceptance gate does not hide device approval and recovery",
  legalAcceptanceGate.includes('pathname === "/profile-setting"') &&
    legalAcceptanceGate.includes('searchParams.get("tab") === "devices"') &&
    legalAcceptanceGate.includes("isDeviceSecurityManagement || loading"),
  "device-management screen can be hidden behind the legal acceptance gate"
)
check("profile settings renders device management panel", profileSettingsPage.includes("DeviceManagementPanel") && profileSettingsPage.includes("deviceLimitMode"), "settings device panel missing")
check(
  "capped pending device directs removal to an existing trusted device",
  profileDevicesPanel.includes("Mevcut güvenilir cihazlarınızdan birinde") &&
    profileDevicesPanel.includes('/login?device_retry=1') &&
    !profileDevicesPanel.includes("Bu cihazla devam et"),
  "safe device-limit recovery guidance missing"
)
check("device panel explains type-neutral three-device policy", profileDevicesPanel.includes("türü fark etmeksizin en fazla") && profileDevicesPanel.includes("{activeDevices.length}/{maxDevices}"), "three-device policy missing in panel")

const ownerMemberActionRoute = read("src/app/api/owner-audit/member/action/route.ts")
const ownerMemberActions = read("src/lib/owner/ownerMemberActions.ts")
const ownerAuditPage = read("src/app/owner-audit/page.tsx")
const ownerNotificationsRoute = read("src/app/api/owner-notifications/route.ts")
const ownerBulkEmailsPage = read("src/app/owner-audit/emails/OwnerBulkEmailClient.tsx")
const ownerBulkEmailsRoute = read("src/app/api/owner-audit/emails/route.ts")
const ownerBulkEmailsPreviewRoute = read("src/app/api/owner-audit/emails/preview/route.ts")
const ownerBulkEmailsTestRoute = read("src/app/api/owner-audit/emails/test/route.ts")
const ownerBulkEmailsSendRoute = read("src/app/api/owner-audit/emails/send/route.ts")
const ownerBulkEmailLib = read("src/lib/owner/ownerBulkEmail.ts")
const ownerBulkEmailSql = read("sql/owner_bulk_email.sql")
check("owner member panel can hide members", ownerMemberActionRoute.includes("hide_member_from_owner") && ownerMemberActions.includes("owner_member_panel_hidden"), "owner member hide action missing")
check("owner member panel can restore hidden members", ownerMemberActionRoute.includes("restore_member_to_owner") && ownerMemberActions.includes("owner_member_panel_restored"), "owner member restore action missing")
check("owner audit page shows hidden member recovery section", ownerAuditPage.includes("Listeden gizlenen üyeler") && ownerAuditPage.includes("Listeye geri al"), "hidden member recovery section missing")
check("owner notifications archive instead of hard delete", ownerNotificationsRoute.includes('status: "archived"') && !ownerNotificationsRoute.includes(".delete()"), "owner notification archive should not hard delete")
check("owner notifications can restore archived items", ownerNotificationsRoute.includes('action: z.enum(["archive", "restore"])') && ownerNotificationsRoute.includes('status: parsed.data.action === "restore" ? "published" : "archived"'), "owner notification restore missing")
check("owner bulk email UI has in-app confirmation", ownerBulkEmailsPage.includes("confirmation") && ownerBulkEmailsPage.includes("kişiye gönderileceğini"), "bulk email confirmation missing")
check("owner bulk email UI supports test send", ownerBulkEmailsPage.includes("Kendime test maili gönder") && ownerBulkEmailsPage.includes("/api/owner-audit/emails/test"), "bulk email test send missing")
check("owner bulk email read route requires owner allowlist", ownerBulkEmailsRoute.includes("assertOwnerAuditAccess") && ownerBulkEmailsRoute.includes("checkRateLimit"), "bulk email list route guard missing")
check("owner bulk email preview route requires trusted mutation", ownerBulkEmailsPreviewRoute.includes("requireTrustedMutation") && ownerBulkEmailsPreviewRoute.includes("readJsonWithSchema"), "bulk email preview guard missing")
check("owner bulk email test route sends only owner test mail", ownerBulkEmailsTestRoute.includes('subject: `[TEST]') && ownerBulkEmailsTestRoute.includes("owner.user.email"), "bulk email owner test send missing")
check("owner bulk email send route records per-recipient status", ownerBulkEmailsSendRoute.includes("owner_email_recipients") && ownerBulkEmailsSendRoute.includes('status: "sent"') && ownerBulkEmailsSendRoute.includes('status: "failed"'), "bulk email recipient status missing")
check("owner bulk email send route audits owner action", ownerBulkEmailsSendRoute.includes("owner_bulk_email_sent"), "bulk email audit event missing")
check("owner bulk email helper sends one recipient per message", ownerBulkEmailLib.includes("to: input.recipient.email") && !ownerBulkEmailLib.includes("bcc:"), "bulk email should not expose recipient list")
check("owner bulk email SQL has campaign and recipient tables", ownerBulkEmailSql.includes("owner_email_campaigns") && ownerBulkEmailSql.includes("owner_email_recipients"), "bulk email SQL missing")

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

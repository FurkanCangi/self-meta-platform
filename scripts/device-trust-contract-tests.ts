import fs from "fs"
import path from "path"

const root = process.cwd()

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8")
}

let failures = 0
function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`PASS ${label}`)
    return
  }
  failures += 1
  console.error(`FAIL ${label}${detail ? `: ${detail}` : ""}`)
}

const migration = read("supabase/migrations/20260717110912_account_device_trust.sql")
const registration = read("src/lib/security/sessionRegistration.ts")
const browserIdentity = read("src/lib/security/browserDeviceIdentity.ts")
const deviceProof = read("src/lib/security/deviceProof.ts")
const deviceProofChallengeRoute = read("src/app/api/security/device-proof/challenge/route.ts")
const devicesRoute = read("src/app/api/security/devices/route.ts")
const sessionRegisterRoute = read("src/app/api/security/session/register/route.ts")
const googleStartRoute = read("src/app/api/auth/google/start/route.ts")
const rateLimit = read("src/lib/security/rateLimit.ts")
const profileSettingsPage = read("src/app/profile-setting/page.tsx")
const profileDevicesPanel = read("src/app/profile-setting/DeviceManagementPanel.tsx")
const logoutRoute = read("src/app/api/security/session/logout/route.ts")
const appSession = read("src/lib/security/appSession.ts")
const ownerSecurity = read("src/lib/owner/ownerSecurity.ts")
const ownerSecurityCore = read("src/lib/owner/ownerSecurityCore.ts")
const ownerSecurityPage = read("src/app/owner-audit/security/page.tsx")
const ownerAccess = read("src/lib/owner/ownerAccess.ts")
const topnav = read("src/app/components/topnav.tsx")
const sessionBindingMigration = read("supabase/migrations/20260717130825_seal_app_session_cookie_and_bind_auth_session.sql")
const atomicCleanupMigration = read("supabase/migrations/20260717130827_atomic_security_cleanup.sql")
const recloseSecurityTablesMigration = read("supabase/migrations/20260717153616_reclose_account_security_tables.sql")
const atomicRejectionMigration = read("supabase/migrations/20260717154105_atomic_device_challenge_rejection.sql")
const newDeviceBranchStart = registration.indexOf("  if (!device) {")
const newDeviceBranch = registration.slice(
  newDeviceBranchStart,
  registration.indexOf("    let autoTrust", newDeviceBranchStart)
)
const revokedDeviceBranchStart = registration.indexOf(
  "    if (device.revoked_at || device.verification_required"
)
const revokedDeviceBranch = registration.slice(
  revokedDeviceBranchStart,
  registration.indexOf("      const { error: pendingUpdateError }", revokedDeviceBranchStart)
)

check("migration enables RLS on approval rows", migration.includes("account_device_verification_challenges enable row level security"))
check("migration revokes public approval access", migration.includes("from public, anon, authenticated"))
check("approval RPC is security invoker", migration.includes("security invoker"))
check("approval RPC is service-role only", migration.includes("approve_account_device_challenge") && migration.includes("to service_role"))
check(
  "live access regression is reclosed for every account-security table",
  ["account_devices", "account_sessions", "account_security_events", "account_security_state"].every(
    (table) =>
      recloseSecurityTablesMigration.includes(`revoke all privileges on table public.${table} from public, anon, authenticated`)
  ) &&
    (recloseSecurityTablesMigration.match(/drop policy if exists "Users can read own account/g) || []).length === 4
)
check(
  "device rejection is serialized with approval and service-role only",
  atomicRejectionMigration.includes("reject_account_device_challenge") &&
    atomicRejectionMigration.includes("pg_catalog.pg_advisory_xact_lock") &&
    atomicRejectionMigration.includes("for update") &&
    atomicRejectionMigration.indexOf("challenge_row.status <> 'pending'") <
      atomicRejectionMigration.indexOf("public.revoke_account_device_security") &&
    atomicRejectionMigration.includes("from public, anon, authenticated") &&
    atomicRejectionMigration.includes("to service_role") &&
    devicesRoute.includes('admin.rpc("reject_account_device_challenge"')
)
check("challenge permits five attempts", migration.includes("max_attempts integer not null default 5"))
check(
  "approved devices enter permanent replacement history",
  migration.includes("ever_verified_at = coalesce(ever_verified_at, now())")
)
check("three latest devices are retained", migration.includes("device_rank <= 3"))
check("one active session is enforced per device", migration.includes("account_sessions_one_active_per_device_idx"))
check(
  "three-device invariant is atomic in the database",
  migration.includes("account_devices_active_limit_trigger") &&
    migration.includes("pg_advisory_xact_lock") &&
    migration.includes("message = 'device_limit_exceeded'")
)
check(
  "replacement quota is recomputed under the approval lock",
  migration.includes("verified_device_history_count") &&
    migration.includes("replacement_required := verified_device_history_count >= 3") &&
    migration.includes("if replacement_required then") &&
    !migration.includes("if challenge_row.counts_as_replacement then")
)
check(
  "one active device binding is enforced per Supabase auth session",
  sessionBindingMigration.includes("create unique index if not exists account_sessions_one_active_auth_session_idx") &&
    sessionBindingMigration.includes("where status = 'active' and auth_session_id is not null")
)
check(
  "concurrent first-device registrations cannot both auto-trust",
  migration.includes("additional_device_requires_approval") &&
    migration.includes("trusted_count >= 1") &&
    registration.includes('includes("additional_device_requires_approval")')
)

check("device cap is three", registration.includes("MAX_REGISTERED_DEVICES = 3"))
check("replacement cap is two per 30 days", registration.includes("DEVICE_REPLACEMENT_LIMIT = 2") && registration.includes("DEVICE_REPLACEMENT_WINDOW_DAYS = 30"))
check(
  "exhausted replacement quota is reported before a full three-device cap",
  newDeviceBranch.indexOf("usage.used >= DEVICE_REPLACEMENT_LIMIT") >= 0 &&
    newDeviceBranch.indexOf("usage.used >= DEVICE_REPLACEMENT_LIMIT") <
      newDeviceBranch.indexOf("occupiedDeviceSlots >= MAX_REGISTERED_DEVICES") &&
    revokedDeviceBranch.indexOf("usage.used >= DEVICE_REPLACEMENT_LIMIT") >= 0 &&
    revokedDeviceBranch.indexOf("usage.used >= DEVICE_REPLACEMENT_LIMIT") <
      revokedDeviceBranch.indexOf("occupiedDeviceSlots >= MAX_REGISTERED_DEVICES")
)
check("only same-device sessions are replaced", registration.includes('.eq("device_id", device.id)') && !registration.includes('eventType: "active_session_replaced"'))
check("automatic risk lock is absent from registration", !registration.includes("decision.action"))
check(
  "approval codes are HMAC hashed",
  registration.includes("hashDeviceApprovalCode") && registration.includes('createHmac("sha256"')
)
check("first device is auto trusted", registration.includes("isFirstDevice && Boolean(proof)"))
check(
  "owner and explicitly configured accounts skip device friction",
  ownerAccess.includes("SECURITY_DEVICE_APPROVAL_EXEMPT_EMAILS") &&
    ownerAccess.includes("...getOwnerAuditEmails()") &&
    registration.includes("const approvalExemptUser = isDeviceApprovalExemptEmail(user.email)") &&
    registration.includes('eventType: "approval_exempt_device_trusted"') &&
    registration.includes("verification_required: approvalExemptUser ? false : true") &&
    registration.includes("rotateOldestApprovalExemptDevice") &&
    registration.includes('p_reason: "approval_exempt_device_rotation"')
)
check(
  "approval exemption also supports legacy browsers without codes",
  registration.includes("if (isFirstDevice && !proof && !approvalExemptUser)") &&
    registration.includes("p256Submitted && !proofResult.ok && !approvalExemptUser") &&
    registration.includes("!approvalExemptUser &&\n      device.verification_method === \"p256_v1\"")
)
check(
  "device approval instructions clearly separate the new and trusted devices",
  profileDevicesPanel.includes("Bu kodu bu ekrana yazmayın") &&
    profileDevicesPanel.includes("Daha önce kullandığınız güvenilir cihazı açın") &&
    profileDevicesPanel.includes("Yeni cihazda görünen 6 haneli kodu buraya yazın")
)
check(
  "owner panel has a persistent top navigation entry",
  topnav.includes('href="/owner-audit"') &&
    topnav.includes('aria-label="Yönetici Panelini Aç"') &&
    topnav.includes("{showOwnerAudit ? (")
)

check("browser key is P-256", browserIdentity.includes('namedCurve: "P-256"'))
check("stored private key is non-extractable", browserIdentity.includes("false,\n      [\"sign\", \"verify\"]"))
check("browser credential is stored in IndexedDB", browserIdentity.includes("indexedDB.open"))
check("legacy mode is explicit", browserIdentity.includes('identityVersion: "legacy-session"'))
check(
  "request possession challenge is HMAC protected and short lived",
  deviceProof.includes('DEVICE_POSSESSION_MAX_AGE_SECONDS = 45') &&
    deviceProof.includes('challengeToken: `${payload}.${sign(payload)}`')
)
check(
  "request possession proof binds session, device, route, and exact body",
  deviceProof.includes("challenge.userId") &&
    deviceProof.includes("challenge.sessionId") &&
    deviceProof.includes("challenge.deviceId") &&
    deviceProof.includes("challenge.method") &&
    deviceProof.includes("challenge.path") &&
    deviceProof.includes("challenge.bodyHash") &&
    deviceProof.includes('request.clone().text()')
)
check(
  "request possession verifies the stored public key and consumes a one-time nonce",
  deviceProof.includes('select(\n      "id, verification_method, public_key_jwk, public_key_fingerprint') &&
    deviceProof.includes('webcrypto.subtle.verify') &&
    deviceProof.includes('.from("account_device_proof_nonces").insert') &&
    deviceProof.includes('.eq("user_id", params.userId)') &&
    deviceProof.includes('device_possession_proof_replayed')
)
check(
  "request challenge endpoint is allowlisted, session bound, and rate limited",
  deviceProofChallengeRoute.includes("normalizeDevicePossessionTarget") &&
    deviceProofChallengeRoute.includes("verifyCurrentAppSession") &&
    deviceProofChallengeRoute.includes("device-possession-challenge:") &&
    deviceProofChallengeRoute.includes("limit: 300")
)
check(
  "legacy sessions remain usable without per-request signatures",
  deviceProof.includes('device.verification_method !== "p256_v1"') &&
    deviceProof.includes('mode: "legacy"') &&
    deviceProofChallengeRoute.includes('required: false, mode: "legacy"')
)
check(
  "browser signs the body-bound request challenge with its stored key",
  browserIdentity.includes("createDevicePossessionHeaders") &&
    browserIdentity.includes("getStoredCredential") &&
    browserIdentity.includes('"x-dna-device-proof-token"') &&
    browserIdentity.includes('"x-dna-device-proof-signature"')
)
check(
  "legacy browsers require a fresh trusted-device approval for every login",
  registration.includes('device.verification_method === "legacy_session" && !freshLegacyApprovalId') &&
    registration.includes("consumed_at: now.toISOString()")
)
check(
  "expired legacy transition falls back to trusted-device approval",
  registration.includes("!approvalExemptUser &&\n    !proof &&\n    existingDevice?.verification_method === \"legacy_transition\"") &&
    registration.includes("!legacyTransitionValid") &&
    registration.includes('verification_method: "legacy_session"') &&
    registration.includes("countsAsReplacement: false")
)

check("pending management response filters device rows", devicesRoute.includes("visibleDeviceRows") && devicesRoute.includes("access.pendingToken?.deviceId"))
check(
  "profile maps every device recovery query to a recoverable device flow",
  profileSettingsPage.includes('params.get("error")') &&
    profileSettingsPage.includes('error === "device_limit_exceeded"') &&
    profileSettingsPage.includes('error === "replacement_limit_exceeded"') &&
    profileSettingsPage.includes('error === "trusted_device_required"') &&
    profileSettingsPage.includes('params.get("approval") === "required"')
)
check(
  "untrusted device flows never render a misleading private inventory",
  profileDevicesPanel.includes("showPrivateDeviceInventory") &&
    profileDevicesPanel.includes('mode === "active_session" && !recoveryReason && !approvalRequired') &&
    profileDevicesPanel.includes("{showPrivateDeviceInventory ? (") &&
    profileDevicesPanel.includes("showPrivateDeviceInventory && revokedDevices.length")
)
check(
  "pending approval hides the retry-login action until the request is terminal",
  profileDevicesPanel.includes("currentApprovalPending") &&
    profileDevicesPanel.includes("{canRetryLogin ? (") &&
    profileDevicesPanel.includes("!currentApprovalPending") &&
    !profileDevicesPanel.includes('deviceLimitMode || mode === "device_management"')
)
check(
  "zero replacement quota warns clearly without disabling device removal",
  profileDevicesPanel.includes('reason === "removed" && remainingReplacements === 0') &&
    profileDevicesPanel.includes("Cihazı yine kaldırabilirsiniz") &&
    profileDevicesPanel.includes("yeni bir cihaz eklemek için cihaz desteği gerekir") &&
    !profileDevicesPanel.includes("remainingReplacements === 0 ? disabled")
)
check(
  "approve and reject are mutually locked for the same challenge",
  profileDevicesPanel.includes("approvalInFlightChallenges.current.has(challengeId)") &&
    profileDevicesPanel.includes("const approvalBusy =") &&
    (profileDevicesPanel.match(/disabled=\{approvalBusy\}/g) || []).length >= 2
)
check(
  "device read polling is signed-identity scoped with a broad abuse ceiling",
  devicesRoute.includes("scopedDeviceReadRateLimitKey") &&
    devicesRoute.includes('createHash("sha256")') &&
    devicesRoute.includes("[access.user.id, access.sessionId, access.currentDeviceId]") &&
    devicesRoute.includes("access.managementNonce") &&
    devicesRoute.includes('getNetworkRateLimitKey(request, "security-devices-read-broad")') &&
    devicesRoute.includes('getNetworkRateLimitKey(request, "security-devices-read-anonymous")') &&
    rateLimit.includes("getTrustedClientNetworkIdentity") &&
    /const broadRateLimit[\s\S]*?limit: 1_200[\s\S]*?const access = await requireDeviceAccess\(\)/.test(
      devicesRoute
    ) &&
    /const scopedRateLimit[\s\S]*?key: scopedDeviceReadRateLimitKey\(access\)[\s\S]*?limit: 120/.test(
      devicesRoute
    )
)
check(
  "clinic networks use broad ceilings plus user, session, or device buckets",
  /security-devices-action-broad"\),[\s\S]*?limit: 600/.test(devicesRoute) &&
    /key: `security-devices-action:\$\{access\.user\.id\}:\$\{access\.sessionId\}`,[\s\S]*?limit: 90/.test(
      devicesRoute
    ) &&
    /session-register-broad"\),[\s\S]*?limit: 600/.test(sessionRegisterRoute) &&
    /key: `session-register:\$\{user\.id\}`,[\s\S]*?limit: 60/.test(sessionRegisterRoute) &&
    deviceProofChallengeRoute.includes('getNetworkRateLimitKey(request, "device-proof-challenge-broad")') &&
    deviceProofChallengeRoute.includes('getPseudonymousRateLimitKey("device-proof-challenge-device"') &&
    googleStartRoute.includes("getNetworkRateLimitKey") &&
    googleStartRoute.includes("getPseudonymousRateLimitKey") &&
    !sessionRegisterRoute.includes("getClientRateLimitKey") &&
    !deviceProofChallengeRoute.includes("getClientRateLimitKey") &&
    !googleStartRoute.includes("getClientRateLimitKey")
)
check(
  "device polling honors Retry-After and gives a visible backoff message",
  profileDevicesPanel.includes('response.headers.get("retry-after")') &&
    profileDevicesPanel.includes("response.status === 429") &&
  profileDevicesPanel.includes("setPollBackoffUntil(Date.now() + waitMs)") &&
    profileDevicesPanel.includes("Math.max(12_000, pollBackoffUntil - Date.now())") &&
    profileDevicesPanel.includes("approvalRequired && !hasSuccessfulLoad") &&
    profileDevicesPanel.includes("setHasSuccessfulLoad(true)") &&
    profileDevicesPanel.includes("saniye sonra otomatik olarak yeniden deneyeceğiz") &&
    !profileDevicesPanel.includes("setInterval(() => void loadDevices(true), 12_000)")
)
check(
  "device mutations honor Retry-After with a visible wait time",
  profileDevicesPanel.includes("class DeviceActionRequestError") &&
    profileDevicesPanel.includes("response.status === 429") &&
    profileDevicesPanel.includes("Math.ceil(retryAfterMs(response) / 1000)") &&
    profileDevicesPanel.includes("saniye bekleyip yeniden deneyin") &&
    (profileDevicesPanel.match(/deviceActionRateLimitMessage\(actionError\)/g) || []).length >= 3
)
check("device response does not expose raw IP", !devicesRoute.includes("lastIp:"))
check("approval requires a six digit code", devicesRoute.includes("/^\\d{6}$/"))
check(
  "device mutations require live device possession",
  devicesRoute.includes("verifyDevicePossessionForRequest") &&
    devicesRoute.includes("sessionId: access.sessionId") &&
    devicesRoute.includes("deviceId: access.currentDeviceId")
)
check(
  "device removal releases playback atomically",
  devicesRoute.includes("revoke_account_device_security") &&
    atomicCleanupMigration.includes("education_video_playback_leases") &&
    atomicCleanupMigration.includes("education_video_access_tokens")
)
check(
  "unknown-device report locks every session and playback path",
  devicesRoute.includes('body.reason === "not_mine"') &&
    devicesRoute.includes("p_suspend_account: suspendAccount") &&
    atomicCleanupMigration.includes("manual_review_required = true") &&
    atomicCleanupMigration.includes("suspended_at = v_now") &&
    atomicCleanupMigration.includes("education_video_access_tokens") &&
    devicesRoute.includes("accountLocked: true")
)
check(
  "confirmed account lock redirects even when follow-up logout returns 401",
  /if \(result\?\.accountLocked\) \{[\s\S]*?try \{[\s\S]*?await logoutAppSession\("global"\)[\s\S]*?\} catch \{[\s\S]*?\}[\s\S]*?window\.location\.assign\("\/login\?error=account_suspended"\)[\s\S]*?return/.test(
    profileDevicesPanel
  )
)
check(
  "Vercel location headers require a trusted Vercel request marker",
  registration.includes('trustedVercelRequest = Boolean(headers.get("x-vercel-id"))') &&
    registration.includes("city: trustedVercelRequest") &&
    registration.includes('headers.get("x-vercel-forwarded-for") || headers.get("x-forwarded-for")')
)
check("local and global logout are supported", logoutRoute.includes('z.enum(["local", "global"])'))
check(
  "logout releases education playback atomically",
  logoutRoute.includes("logout_account_security") &&
    atomicCleanupMigration.includes("education_video_playback_leases") &&
    atomicCleanupMigration.includes("global")
)
check("pending devices fail app-session verification", appSession.includes("device.verification_required !== false") && appSession.includes("!device.verified_at"))
check(
  "owner support can reset quota and recover an all-lost device",
  ownerSecurityPage.includes('action="reset_device_replacements"') &&
    ownerSecurityPage.includes('action="recover_device_trust"') &&
    ownerSecurityPage.includes("confirmMessage=") &&
    ownerSecurityCore.includes('verification_method: "legacy_transition"')
)
check(
  "owner device revoke closes sessions and video playback",
  ownerSecurity.includes('params.action === "revoke_device"') &&
    ownerSecurity.includes("revoke_account_device_security") &&
    atomicCleanupMigration.includes("device_removed")
)

if (failures > 0) {
  console.error(`\n${failures} device-trust contract check(s) failed.`)
  process.exit(1)
}

console.log("\nDevice-trust contract checks passed.")

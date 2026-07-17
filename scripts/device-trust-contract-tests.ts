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
const loginPage = read("src/app/login/PageClient.tsx")
const signupForm = read("src/app/components/auth/DnaSignupForm.tsx")
const deviceProof = read("src/lib/security/deviceProof.ts")
const deviceProofChallengeRoute = read("src/app/api/security/device-proof/challenge/route.ts")
const devicesRoute = read("src/app/api/security/devices/route.ts")
const logoutRoute = read("src/app/api/security/session/logout/route.ts")
const appSession = read("src/lib/security/appSession.ts")
const ownerSecurity = read("src/lib/owner/ownerSecurity.ts")
const ownerSecurityCore = read("src/lib/owner/ownerSecurityCore.ts")
const ownerSecurityPage = read("src/app/owner-audit/security/page.tsx")
const sessionBindingMigration = read("supabase/migrations/20260717130825_seal_app_session_cookie_and_bind_auth_session.sql")
const atomicCleanupMigration = read("supabase/migrations/20260717130827_atomic_security_cleanup.sql")

check("migration enables RLS on approval rows", migration.includes("account_device_verification_challenges enable row level security"))
check("migration revokes public approval access", migration.includes("from public, anon, authenticated"))
check("approval RPC is security invoker", migration.includes("security invoker"))
check("approval RPC is service-role only", migration.includes("approve_account_device_challenge") && migration.includes("to service_role"))
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
check("only same-device sessions are replaced", registration.includes('.eq("device_id", device.id)') && !registration.includes('eventType: "active_session_replaced"'))
check("automatic risk lock is absent from registration", !registration.includes("decision.action"))
check(
  "approval codes are HMAC hashed",
  registration.includes("hashDeviceApprovalCode") && registration.includes('createHmac("sha256"')
)
check("first device is auto trusted", registration.includes("autoTrust = isFirstDevice && Boolean(proof)"))

check("browser key is P-256", browserIdentity.includes('namedCurve: "P-256"'))
check("stored private key is non-extractable", browserIdentity.includes("false,\n      [\"sign\", \"verify\"]"))
check("browser credential is stored in IndexedDB", browserIdentity.includes("indexedDB.open"))
check(
  "auth forms flush device proof before native submit",
  loginPage.includes("flushSync(() => setDeviceProof(proof))") &&
    signupForm.includes("flushSync(() => setDeviceProof(proof))") &&
    !loginPage.includes("requestAnimationFrame(() =>") &&
    !signupForm.includes("requestAnimationFrame(() =>"),
  "auth forms can submit before hidden P-256 fields reach the DOM",
)
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
  registration.includes('existingDevice?.verification_method === "legacy_transition" && !legacyTransitionValid') &&
    registration.includes('verification_method: "legacy_session"') &&
    registration.includes("countsAsReplacement: false")
)

check("pending management response filters device rows", devicesRoute.includes("visibleDeviceRows") && devicesRoute.includes("access.pendingToken?.deviceId"))
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

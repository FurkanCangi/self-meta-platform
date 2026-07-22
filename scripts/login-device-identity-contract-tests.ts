import fs from "fs"
import path from "path"
import {
  isBrowserDeviceProofComplete,
  type BrowserDeviceProofFields,
} from "../src/lib/security/browserDeviceIdentity"

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

const loginClient = read("src/app/login/PageClient.tsx")
const signupClient = read("src/app/components/auth/DnaSignupForm.tsx")
const browserIdentity = read("src/lib/security/browserDeviceIdentity.ts")
const loginRoute = read("src/app/api/auth/login/route.ts")
const authCallbackRoute = read("src/app/auth/callback/route.ts")
const profileSettingsPage = read("src/app/profile-setting/page.tsx")
const profileDevicesPanel = read("src/app/profile-setting/DeviceManagementPanel.tsx")
const rateLimit = read("src/lib/security/rateLimit.ts")

const legacyProof: BrowserDeviceProofFields = {
  deviceId: "legacy-device-1234567890",
  deviceType: "desktop",
  identityVersion: "legacy-session",
  publicKeyJwk: "",
  publicKeyFingerprint: "",
  proofChallengeToken: "",
  proofSignature: "",
  legacyDeviceId: "legacy-device-1234567890",
}

const modernProof: BrowserDeviceProofFields = {
  deviceId: `p256-${"a".repeat(43)}`,
  deviceType: "desktop",
  identityVersion: "p256-v1",
  publicKeyJwk: '{"kty":"EC"}',
  publicKeyFingerprint: "a".repeat(43),
  proofChallengeToken: "signed-challenge-token",
  proofSignature: "signed-proof",
  legacyDeviceId: "legacy-device-1234567890",
}

check("complete legacy fallback proof is accepted", isBrowserDeviceProofComplete(legacyProof))
check(
  "empty legacy storage identity is rejected before submit",
  !isBrowserDeviceProofComplete({ ...legacyProof, legacyDeviceId: "" })
)
check("complete P-256 proof is accepted", isBrowserDeviceProofComplete(modernProof))
check(
  "partial P-256 proof is rejected before submit",
  !isBrowserDeviceProofComplete({ ...modernProof, proofChallengeToken: "" })
)

check(
  "first-time IndexedDB key creation is single-flight",
  browserIdentity.includes("let credentialPromise: Promise<StoredCredential> | null = null") &&
    browserIdentity.includes("credentialPromise = loadOrCreateCredential().catch")
)
check(
  "simultaneous first-time tabs cannot overwrite the winning device key",
  browserIdentity.includes("persistCredentialIfMissing") &&
    browserIdentity.includes('db.transaction(STORE_NAME, "readwrite")') &&
    browserIdentity.includes("const existing = (request.result as StoredCredential | undefined) || null") &&
    browserIdentity.includes("return await persistCredentialIfMissing(db, credential)")
)
check(
  "identity preparation is shared by preload and submit",
  browserIdentity.includes("let identityPreparationPromise:") &&
    browserIdentity.includes("getPreparedBrowserDeviceIdentity") &&
    browserIdentity.includes("prepareBrowserDeviceIdentityInternal")
)
check(
  "legacy identity storage failures use session storage before memory",
  browserIdentity.indexOf('readOrCreateStoredLegacyDeviceId("localStorage")') <
    browserIdentity.indexOf('readOrCreateStoredLegacyDeviceId("sessionStorage")') &&
    browserIdentity.includes('persistence: "memory" as const')
)
check(
  "memory-only legacy identity blocks insecure native login",
  browserIdentity.includes('fallbackReason: canSubmit ? "webcrypto_unavailable" : "legacy_storage_unavailable"') &&
    browserIdentity.includes('throw new Error("device_identity_storage_unavailable")')
)

const proofValidationIndex = loginClient.indexOf("isBrowserDeviceProofComplete(proof)")
const flushIndex = loginClient.indexOf("flushSync(() =>")
const nativeSubmitIndex = loginClient.indexOf("form.requestSubmit()")
check(
  "login validates and synchronously commits proof before native submit",
  proofValidationIndex >= 0 && proofValidationIndex < flushIndex && flushIndex < nativeSubmitIndex
)
check(
  "login prewarms device identity and has no animation-frame submit race",
  loginClient.includes("void prepareBrowserDeviceIdentity()") && !loginClient.includes("requestAnimationFrame")
)
check(
  "rapid repeated submits cannot launch duplicate native login requests",
  loginClient.includes("const submissionPreparing = useRef(false)") &&
    loginClient.includes("if (submissionPreparing.current) return") &&
    loginClient.includes("submissionPreparing.current = true") &&
    (loginClient.match(/disabled=\{loading \|\| googleLoading/g) || []).length === 2
)
check(
  "password and Google login stay disabled until identity readiness",
  (loginClient.match(/disabled=\{[^}]*!identityReadiness[^}]*\}/g) || []).length === 2
)
check(
  "unsupported and storage-blocked browsers get explicit Turkish guidance",
  loginClient.includes("Tek oturumluk uyumluluk modu kullanılacak") &&
    loginClient.includes("Geçici kimlikle giriş gönderilmedi") &&
    loginClient.includes("güncel Chrome, Safari ya da Edge") &&
    loginClient.includes('code === "device_proof_required"') &&
    loginClient.includes("ilk cihaz olarak güvenli biçimde kaydedilemiyor") &&
    loginClient.includes('role="alert"')
)
check(
  "device challenge throttling gives login and signup a concrete wait time",
  browserIdentity.includes('challengeResponse.status === 429') &&
    browserIdentity.includes('device_challenge_rate_limited:') &&
    loginClient.includes('error.message.startsWith("device_challenge_rate_limited:")') &&
    signupClient.includes('proofError.message.startsWith("device_challenge_rate_limited:")') &&
    loginClient.includes("saniye sonra yeniden deneyin") &&
    signupClient.includes("saniye sonra yeniden deneyin")
)
check(
  "Google signup commits its device proof synchronously and cross-locks both signup methods",
  signupClient.includes('import { flushSync } from "react-dom"') &&
    signupClient.includes("const submissionPreparing = useRef(false)") &&
    signupClient.includes("flushSync(() =>") &&
    signupClient.indexOf("flushSync(() =>") < signupClient.indexOf("form.requestSubmit()") &&
    !signupClient.includes("requestAnimationFrame") &&
    !signupClient.includes('disabled={loading || googleLoading || !legalAccepted}') &&
    (signupClient.match(/\n\s+disabled=\{loading \|\| googleLoading\}/g) || []).length === 2 &&
    signupClient.includes('aria-describedby={!legalAccepted ? "email-button-guidance" : undefined}') &&
    signupClient.includes('aria-describedby={!legalAccepted ? "google-button-guidance" : undefined}') &&
    signupClient.includes("focusLegalApprovals()")
)

check(
  "login user bucket is HMAC-pseudonymized by normalized email and network",
  loginRoute.includes('getPseudonymousRateLimitKey("auth-login-user"') &&
    loginRoute.includes("normalizedEmail") &&
    loginRoute.includes("networkIdentity") &&
    rateLimit.includes('createHmac("sha256", rateLimitHashSecret())')
)
check(
  "login keeps a separate broader HMAC network-abuse bucket",
  loginRoute.includes('getPseudonymousRateLimitKey("auth-login-network"') &&
    loginRoute.includes("LOGIN_NETWORK_ATTEMPT_LIMIT = 80") &&
    loginRoute.includes("LOGIN_USER_ATTEMPT_LIMIT = 10") &&
    loginRoute.indexOf("const networkAbuseRateLimit") <
      loginRoute.indexOf("const userNetworkRateLimit")
)
check(
  "legacy raw IP and user-agent login bucket is no longer used",
  !loginRoute.includes('getClientRateLimitKey(request, "auth-login")') &&
    !loginRoute.includes('key: `auth-login-user:${normalizedEmail}')
)
check(
  "session registration rate limit uses the existing Turkish login message",
  loginRoute.includes("registerResponse.status === 429") &&
    /registerResponse\.status === 429[\s\S]*?\? "rate_limited"/.test(loginRoute) &&
    !/const code = String\(registerPayload\?\.error \|\| "session_failed"\)/.test(loginRoute)
)
check(
  "password and Google device recovery preserve a sanitized next path and surface",
  (loginRoute.match(/appendDeviceRecoveryContext\(target, nextPath, appSurface\)/g) || []).length === 2 &&
    authCallbackRoute.includes("const nextPath = sanitizeNextPath(state?.nextPath)") &&
    (authCallbackRoute.match(/appendDeviceRecoveryContext\(target, nextPath, appSurface\)/g) || []).length === 2 &&
    loginRoute.includes('target.searchParams.set("surface", appSurface ? "app" : "web")') &&
    authCallbackRoute.includes('raw.startsWith("//")') &&
    loginRoute.includes('raw.includes("\\\\")') &&
    authCallbackRoute.includes('raw.includes("\\\\")') &&
    authCallbackRoute.includes('raw.startsWith("/legal/accept")')
)
check(
  "device approval returns to the correct login surface and original target",
  profileSettingsPage.includes('const nextPath = sanitizeRecoveryNextPath(params.get("next"))') &&
    profileSettingsPage.includes('params.get("surface") === "app"') &&
    profileSettingsPage.includes("nextPath={deviceRecoveryContext.nextPath}") &&
    profileSettingsPage.includes("surface={deviceRecoveryContext.surface}") &&
    profileDevicesPanel.includes("function buildRecoveryLoginUrl") &&
    profileDevicesPanel.includes('resolvedSurface === "app" ? "/app-login" : "/login"') &&
    profileDevicesPanel.includes('notice: "device_approved"') &&
    profileDevicesPanel.includes('notice: "device_retry"') &&
    profileDevicesPanel.includes("window.location.assign(approvedLoginUrl)") &&
    (profileDevicesPanel.match(/window\.location\.assign\(retryLoginUrl\)/g) || []).length === 2
)
check(
  "expired rate-limit rows are cleaned in bounded race-safe batches",
  rateLimit.includes("RATE_LIMIT_CLEANUP_BATCH_SIZE = 100") &&
    rateLimit.includes("RATE_LIMIT_CLEANUP_INTERVAL_MS") &&
    rateLimit.includes('.lte("reset_at", expiredBefore)') &&
    rateLimit.includes("nextExpiredRateLimitCleanupAt")
)

if (failures > 0) {
  console.error(`\n${failures} login/device identity contract check(s) failed.`)
  process.exit(1)
}

console.log("\nLogin/device identity contract checks passed.")

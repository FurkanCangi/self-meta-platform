import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const source = fs.readFileSync(path.join(root, "scripts/live-security-hardening.ts"), "utf8")
const legacyHealthSource = fs.readFileSync(path.join(root, "scripts/live-backend-health.ts"), "utf8")
const fixtureMatch = source.match(/const twoSecondCanaryMp4Base64 =\s*\n\s*"([A-Za-z0-9+/=]+)"/)
const fixtureBytes = Buffer.from(fixtureMatch?.[1] || "", "base64")

function fixtureDurationSeconds() {
  const mvhd = fixtureBytes.indexOf(Buffer.from("mvhd", "ascii"))
  if (mvhd < 0 || fixtureBytes.length < mvhd + 24) return null
  const version = fixtureBytes[mvhd + 4]
  if (version !== 0) return null
  const timescale = fixtureBytes.readUInt32BE(mvhd + 16)
  const duration = fixtureBytes.readUInt32BE(mvhd + 20)
  return timescale > 0 ? duration / timescale : null
}

let failures = 0
function check(label: string, condition: boolean) {
  if (condition) {
    console.log(`PASS ${label}`)
    return
  }
  failures += 1
  console.error(`FAIL ${label}`)
}

check(
  "live runner has no implicit production target",
  source.includes('process.env.LIVE_SECURITY_TARGET_URL || ""') &&
    source.includes("there is no production default")
)
check(
  "live runner requires an explicit destructive-test confirmation",
  source.includes('confirmationPhrase = "RUN_AUTO_CLEAN_SECURITY_E2E"') &&
    source.includes("LIVE_SECURITY_CONFIRM")
)
check(
  "live runner uses non-extractable P-256 device keys",
  source.includes('namedCurve: "P-256"') &&
    source.includes('false,\n    ["sign", "verify"]') &&
    source.includes('identityVersion: "p256-v1"')
)
check(
  "additional devices are approved by a real trusted-device API session",
  source.includes('action: "approve"') &&
    source.includes("postDeviceAction(approverContext") &&
    source.includes('approved.payload.status === "approved"') &&
    !source.includes("LIVE_SECURITY_DEVICE_APPROVAL_SECRET")
)
check(
  "atomic device rejection RPC is required and its approve/reject race has one winner",
  source.includes('admin!.rpc("reject_account_device_challenge"') &&
    source.includes('step("device removal releases its session and permits two replacements"') &&
    source.includes("const [approvalRace, rejectionRace] = await Promise.all") &&
    source.includes("raceWinners.length === 1 && raceLosers.length === 1") &&
    source.includes("approvalWon !== rejectionWon") &&
    source.includes('racedChallenge?.status === (approvalWon ? "approved" : "rejected")') &&
    source.includes("approval/rejection race left an inconsistent device state")
)
check(
  "three-device and fourth-device assertions are present",
  source.includes("expected 3 trusted devices") &&
    source.includes('result.payload.error === "device_limit_exceeded"')
)
check(
  "live HTTP mutations use one-time body-bound P-256 possession proofs",
  source.includes("async function createRequestPossessionHeaders") &&
    source.includes('bodyHash: createHash("sha256").update(serializedBody).digest("hex")') &&
    source.includes('"x-dna-device-proof-token"') &&
    source.includes('"x-dna-device-proof-signature"') &&
    source.includes("...possessionHeaders")
)
check(
  "copied cookies, changed bodies, and proof replay are denied",
  source.includes('step("copied cookies cannot mutate without a body-bound device proof"') &&
    source.includes('noProofPayload.error === "device_possession_proof_required"') &&
    source.includes('changedPayload.error === "device_possession_body_mismatch"') &&
    source.includes('replayedPayload.error === "device_possession_proof_replayed"')
)
check(
  "cross-account API and RLS denial are both asserted",
  source.includes('crossApi.statusCode === 404') &&
    source.includes('assertDirectReadDenied(secondaryReadsPrimary, "secondary account read primary devices")') &&
    source.includes("secondary account directly updated a primary device")
)
check(
  "trusted binding CRUD and suspended or capped JWT denial are asserted",
  source.includes("trusted auth binding can CRUD its own core row") &&
    source.includes("suspended account JWT loses core and app access immediately") &&
    source.includes('assertDirectReadDenied(cappedCoreInsert, "fourth context insert clients")')
)
check(
  "pending and capped browsers cannot read device/session rows or globally log out",
  source.includes('assertDirectReadDenied(pendingSessionRead, "pending context read account_sessions")') &&
    source.includes('assertDirectReadDenied(pendingDeviceRead, "pending context read account_devices")') &&
    source.includes("pendingGlobalLogout.statusCode === 401") &&
    source.includes('assertDirectReadDenied(sessionRead, "fourth context read account_sessions")')
)
check(
  "a raw stolen session UUID cookie is rejected by a protected API",
  source.includes('fourthContext.cookies.set("sm_active_session", devices[0].sessionId)') &&
    source.includes("forgedResponse.status === 401") &&
    source.includes('fourthContext.cookies.delete("sm_active_session")')
)
check(
  "playback race requires exactly one winner",
  source.includes("const [claimA, claimB] = await Promise.all") &&
    source.includes("winners.length === 1 && losers.length === 1")
)
check(
  "HTTP conflict, takeover, and stale heartbeat are asserted",
  source.includes('conflict.statusCode === 409 && conflict.payload.error === "active_playback_exists"') &&
    source.includes('await requestVideoAccess(primaryContexts[1], assetId, `http-b-${runId}`, true)') &&
    source.includes('oldHeartbeat.payload.error === "playback_lease_lost"')
)
check(
  "all three trusted devices acquire and release playback sequentially",
  source.includes('step("all three trusted devices can play the private video sequentially"') &&
    source.includes("for (let index = 0; index < 3; index += 1)") &&
    source.includes('detail: "device 1 -> device 2 -> device 3"')
)
check(
  "removing an actively playing device revokes every playback artifact",
  source.includes("device removal left its playback lease active") &&
    source.includes("device removal did not revoke its video access token") &&
    source.includes("device removal did not end its playback session") &&
    source.includes("{ skipPossessionProof: true }") &&
    source.includes("removedHeartbeat.statusCode === 401") &&
    source.includes('removedHeartbeat.payload.error === "playback_lease_lost"')
)
check(
  "live media fixture is a real embedded two-second MP4 and signed bytes are checked",
  source.includes("twoSecondCanaryMp4Base64") &&
    source.includes('Buffer.from(twoSecondCanaryMp4Base64, "base64")') &&
    fixtureBytes.length > 1_000 &&
    fixtureBytes.subarray(4, 8).toString("ascii") === "ftyp" &&
    fixtureBytes.includes(Buffer.from("moov", "ascii")) &&
    fixtureBytes.includes(Buffer.from("mdat", "ascii")) &&
    Math.abs((fixtureDurationSeconds() || 0) - 2) < 0.01 &&
    source.includes('contentType.startsWith("video/mp4")') &&
    source.includes("mediaBytes.byteLength > 0")
)
check(
  "Supabase-provider canary refreshes signed bytes and rejects refresh after takeover",
  source.includes('requireSignedUrl: process.env.LIVE_SECURITY_REQUIRE_SIGNED_URL === "1"') &&
    source.includes("Supabase canary did not return the required signed video URL") &&
    source.includes("!config!.requireSignedUrl || refreshedSignedUrl") &&
    source.includes('"refresh_url"') &&
    source.includes("refreshed signed video URL returned HTTP") &&
    source.includes("taken-over playback refreshed its signed URL") &&
    source.includes('staleRefresh.statusCode === 409') &&
    source.includes('staleRefresh.payload.error === "playback_lease_lost"') &&
    source.includes('range: "bytes=0-1023"') &&
    source.includes('range: "bytes=512-1535"') &&
    fixtureBytes.length > 1_535 &&
    !source.includes('range: "bytes=2048-4095"')
)
check(
  "replacement quota is exercised",
  source.includes('thirdReplacement.payload.error === "replacement_limit_exceeded"') &&
    source.includes('fullQuotaBlocked.payload.error === "replacement_limit_exceeded"') &&
    source.indexOf("const fullQuotaBlocked") < source.indexOf("const removeReplacement") &&
    source.includes("replacementPolicy.used === 2 && replacementPolicy.remaining === 0")
)
check(
  "public signup request does not require email delivery",
  source.includes('fetchTarget("/api/auth/signup"') &&
    source.includes('error === "email_failed"') &&
    source.includes('error === "invalid_email"') &&
    source.includes('error === "rate_limited"')
)
check(
  "cleanup covers video, device, auth, storage, and canary-owned exact rate-limit artifacts",
  source.includes('"education_video_playback_leases"') &&
    source.includes('"account_device_proof_nonces"') &&
    source.includes("admin!.auth.admin.deleteUser") &&
    source.includes("admin!.storage.from(educationBucket).remove") &&
    source.includes('from("api_rate_limits")') &&
    source.includes("canaryOwnedRateLimitKeys") &&
    source.includes('`session-register:${context.userId}`') &&
    source.includes('`device-possession-challenge:${context.userId}:${appSessionId}`') &&
    source.includes('`security-devices-action:${context.userId}:${appSessionId}`') &&
    source.includes('safeCleanup("canary-owned raw rate-limit key discovery"') &&
    source.includes('safeCleanup("canary-owned session rate-limit key discovery"') &&
    source.includes("discoverCanaryOwnedSessionRateLimitKeys") &&
    source.includes('safeCleanup("canary-owned exact api rate limits"') &&
    !source.includes('.delete().ilike("key"')
)
check(
  "cleanup is guaranteed by finally",
  source.includes("} finally {\n    await cleanup()")
)
check(
  "cleanup verifies tracked exact rows and discloses shared or opaque counters retained",
  source.includes('"user_entitlements",') &&
    source.includes("education video asset zero verification") &&
    source.includes("education video object zero verification") &&
    source.includes("api rate limits zero verification") &&
    source.includes("canaryOwnedRateLimitKeys") &&
    source.includes('retainedSharedRateLimitScopes.add("security-devices-action-broad")') &&
    source.includes('retainedSharedRateLimitScopes.add("session-register-broad")') &&
    source.includes('retainedSharedRateLimitScopes.add("device-proof-challenge-broad")') &&
    source.includes('retainedOpaqueRateLimitScopes.add("device-proof-challenge-device")') &&
    !source.includes('canaryOwnedRateLimitKeys.add("security-devices-action-broad")') &&
    !source.includes('canaryOwnedRateLimitKeys.add("session-register-broad")') &&
    source.includes('retainedSharedRateLimitScopes: [...retainedSharedRateLimitScopes].sort()') &&
    source.includes('retainedOpaqueRateLimitScopes: [...retainedOpaqueRateLimitScopes].sort()') &&
    source.includes("temporary auth user ${userId} zero verification failed") &&
    source.includes("temporary auth user ${userId} still exists after cleanup") &&
    source.includes("cleanup left")
)
check(
  "auth cleanup uses exact user_not_found code and paginates beyond 4000 users",
  source.includes('authErrorCode(error) === "user_not_found"') &&
    !source.includes('/not found/i.test') &&
    source.includes("while (true)") &&
    source.includes("temporary signup user pagination repeated a page") &&
    source.includes("page = Number.isInteger(nextPage) && nextPage > page ? nextPage : page + 1") &&
    !source.includes("page <= 20")
)
check(
  "signup cleanup verifies exact email and TEST AUTOMATION marker and requires successful-user lookup",
  source.includes('const signupCanaryFullName = "TEST AUTOMATION Security Canary"') &&
    source.includes("authUserMatchesSignupCanary") &&
    source.includes("verifySignupCanaryUserId") &&
    source.includes("temporary signup legal candidate lookup failed") &&
    source.includes("successful signup response had no verifiable TEST AUTOMATION auth user") &&
    source.includes("successful signup user could not be found for cleanup")
)
const uploadSuccessIndex = source.indexOf('failIfError("private canary video upload failed", upload.error)')
const storageOwnershipIndex = source.indexOf("storagePath = candidateStoragePath")
check(
  "storage cleanup ownership begins only after a successful upload",
  source.includes("const candidateStoragePath =") &&
    uploadSuccessIndex >= 0 &&
    storageOwnershipIndex > uploadSuccessIndex
)
check(
  "final output is a redacted summary rather than credentials",
  source.includes("function redact(message: string)") &&
    source.includes("console.log(JSON.stringify(report, null, 2))") &&
    !source.includes("console.log(config") &&
    !source.includes("console.log(signupPassword")
)
check(
  "existing live health runner uses the P-256 registration contract",
  legacyHealthSource.includes("async function createP256DeviceProof") &&
    legacyHealthSource.includes('identityVersion: "p256-v1"') &&
    legacyHealthSource.includes("createP256DeviceProof(config.siteUrl, session.access_token)") &&
    !legacyHealthSource.includes("allowSlotReuse")
)
check(
  "existing live health cleanup covers new device and playback records",
  legacyHealthSource.includes('safeCleanup("account_device_proof_nonces"') &&
    legacyHealthSource.includes('safeCleanup("account_device_verification_challenges"') &&
    legacyHealthSource.includes('safeCleanup("education_video_playback_leases"')
)

if (failures > 0) {
  console.error(`\n${failures} live security hardening contract check(s) failed.`)
  process.exit(1)
}

console.log("\nLive security hardening contract checks passed.")

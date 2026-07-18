import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  clampPlaybackResumeTime,
  playbackUrlRefreshDelayMs,
  retryAfterDelayMs,
} from "../src/app/education/playbackUrlRefresh"

const root = process.cwd()
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8")

const migration = read("supabase/migrations/20260717110915_education_video_single_playback.sql")
const accessRoute = read("src/app/api/education/videos/[videoId]/access/route.ts")
const eventsRoute = read("src/app/api/education/videos/[videoId]/events/route.ts")
const player = read("src/app/education/SecureEducationPlayer.tsx")
const page = read("src/app/education/page.tsx")
const protection = read("src/lib/security/videoProtection.ts")

assert.match(migration, /create table if not exists public\.education_video_playback_leases[\s\S]*user_id uuid primary key/)
assert.match(migration, /pg_advisory_xact_lock/)
assert.equal(
  migration.match(/pg_catalog\.pg_advisory_xact_lock/g)?.length,
  4,
  "claim, touch, exact release, and device release must share the per-user advisory lock"
)
const claimFunction = migration.slice(
  migration.indexOf("create or replace function public.claim_education_video_playback"),
  migration.indexOf("create or replace function public.touch_education_video_playback")
)
const claimLeaseWrite = claimFunction.indexOf("insert into public.education_video_playback_leases")
const claimTokenWrite = claimFunction.indexOf("update public.education_video_access_tokens", claimLeaseWrite)
const claimSessionWrite = claimFunction.indexOf("update public.education_video_playback_sessions", claimTokenWrite)
assert.ok(
  claimLeaseWrite >= 0 && claimTokenWrite > claimLeaseWrite && claimSessionWrite > claimTokenWrite,
  "claim must mutate lease, token, and playback-session rows in the shared lock order"
)
assert.match(migration, /active_playback_exists/)
assert.match(migration, /same_device_switched/)
assert.match(migration, /taken_over/)
assert.match(migration, /update public\.education_video_access_tokens[\s\S]*revoked_at/)
assert.match(migration, /set expires_at = v_now \+ interval '5 minutes',[\s\S]*used_at = v_now/)
assert.match(migration, /security invoker/)
assert.match(migration, /enable row level security/)
assert.match(migration, /revoke all on function public\.claim_education_video_playback[\s\S]*public, anon, authenticated/)
assert.match(migration, /grant execute on function public\.claim_education_video_playback[\s\S]*service_role/)
assert.doesNotMatch(migration, /security definer/i)

const tokenIndex = accessRoute.indexOf("const token = await createEducationVideoAccessToken")
const claimIndex = accessRoute.indexOf("const claim = await claimEducationPlaybackLease")
const providerIndex = accessRoute.indexOf("const playbackAccess = await createEducationVideoPlaybackAccess")
assert.ok(tokenIndex >= 0 && claimIndex > tokenIndex && providerIndex > claimIndex, "claim must happen before provider URL generation")
assert.match(accessRoute, /if \(!claim\.ok\)[\s\S]*revokeEducationVideoAccessToken/)
assert.match(accessRoute, /if \(!playbackAccess\.ok\)[\s\S]*releaseEducationPlaybackLease[\s\S]*revokeEducationVideoAccessToken/)
assert.match(accessRoute, /status: 409/)
assert.match(accessRoute, /error: "active_playback_exists"/)
assert.match(accessRoute, /evaluateEducationNetworkPolicy\(request\.headers\)/)
assert.match(accessRoute, /verifyDevicePossessionForRequest\(\{[\s\S]*sessionId: currentSession\.sessionId[\s\S]*deviceId: currentSession\.deviceId/)
assert.ok(
  accessRoute.indexOf("verifyDevicePossessionForRequest") < accessRoute.indexOf("createEducationVideoAccessToken"),
  "device possession must be verified before issuing a video token or URL"
)

const networkIndex = eventsRoute.indexOf("evaluateEducationNetworkPolicy(request.headers)")
const touchIndex = eventsRoute.indexOf("await touchEducationPlaybackLease")
assert.ok(networkIndex >= 0 && touchIndex > networkIndex, "network policy must run before lease touch")
assert.match(eventsRoute, /error === "playback_lease_lost" \? 409 : 500/)
assert.match(eventsRoute, /RELEASE_EVENTS/)
assert.match(
  eventsRoute,
  /key: `education-video-events:\$\{auth\.user\.id\}`,[\s\S]*limit: 480,[\s\S]*windowMs: 60 \* 60 \* 1000/,
  "the possession-bound event budget must accommodate long lessons, heartbeats, URL refreshes, and ordinary controls"
)
assert.match(eventsRoute, /const possessionRequest = request\.clone\(\)/)
assert.match(eventsRoute, /if \(eventType !== "release"\)[\s\S]*verifyDevicePossessionForRequest/)
assert.match(eventsRoute, /"refresh_url"/)
const refreshBranchIndex = eventsRoute.indexOf('if (eventType === "refresh_url")')
assert.ok(
  eventsRoute.indexOf("const verifiedToken = await verifyEducationVideoAccessToken") < refreshBranchIndex &&
    eventsRoute.indexOf("const currentSession = await verifyCurrentAppSession") < refreshBranchIndex &&
    eventsRoute.indexOf("const possession = await verifyDevicePossessionForRequest") < refreshBranchIndex &&
    touchIndex < refreshBranchIndex,
  "refresh must retain token, app-session, device-possession, and exact-lease checks"
)
const refreshRouteSource = eventsRoute.slice(refreshBranchIndex)
const refreshSignedUrlIndex = refreshRouteSource.indexOf("createEducationVideoPlaybackAccess")
const refreshProviderGateIndex = refreshRouteSource.indexOf('refresh.provider !== "supabase"')
const refreshLeaseConfirmIndex = refreshRouteSource.indexOf("const confirmedLease = await touchEducationPlaybackLease")
const refreshResponseIndex = refreshRouteSource.indexOf("refreshedPlaybackUrl =")
assert.ok(
  refreshSignedUrlIndex >= 0 &&
    refreshProviderGateIndex > refreshSignedUrlIndex &&
    refreshLeaseConfirmIndex > refreshProviderGateIndex &&
    refreshResponseIndex > refreshLeaseConfirmIndex,
  "refresh must sign only a supported URL, then reconfirm the exact lease before disclosing it"
)
assert.match(refreshRouteSource, /refresh\.playerConfig\.playbackPolicy !== "signed_url"/)
assert.match(refreshRouteSource, /phase: "signed_url_refresh_confirm"/)
assert.match(eventsRoute, /refreshedPlaybackUrl \? \{ refresh: refreshedPlaybackUrl \} : \{\}/)

assert.match(protection, /EDUCATION_VIDEO_HEARTBEAT_INTERVAL_SECONDS = 25/)
assert.match(protection, /EDUCATION_PLAYBACK_CONCURRENCY_WINDOW_SECONDS = 90/)
assert.match(protection, /playerSessionId/)
assert.match(player, /controlsList="nodownload nofullscreen noremoteplayback"/)
assert.match(player, /requestFullscreen/)
assert.match(player, /visibleWatermarkCode/)
assert.match(player, /toLocaleString\("tr-TR"\)/)
assert.match(player, /playback_lease_lost/)
assert.match(player, /addEventListener\("pagehide", releaseOnPageHide\)/)
assert.match(player, /postEvent\(\s*"release",\s*\{\},\s*\{[\s\S]*keepalive: true/)
assert.match(player, /activePlaybackKeyRef/)
assert.match(player, /activePlaybackKeyRef\.current !== requestPlaybackKey/)
assert.match(player, /expectedPlaybackKey/)
assert.match(player, /activePlaybackKeyRef\.current !== expectedPlaybackKey/)
assert.match(player, /eventType === "release"[\s\S]*createDevicePossessionHeaders/)
assert.match(player, /const serializedBody = JSON\.stringify/)
assert.match(player, /eventType: "refresh_url"/)
assert.match(player, /access\.provider !== "supabase"/)
assert.match(player, /access\.playerConfig\.playbackPolicy !== "signed_url"/)
assert.match(player, /playbackUrlRefreshDelayMs/)
assert.match(player, /createDevicePossessionHeaders\(\{[\s\S]*path,[\s\S]*body: serializedBody/)
assert.match(player, /activePlaybackKeyRef\.current !== requestPlaybackKey/)
assert.match(player, /currentTime: currentVideo\?\.currentTime \|\| 0/)
assert.match(player, /!currentVideo\.paused && !currentVideo\.ended/)
assert.match(player, /clampPlaybackResumeTime\(pending\.currentTime, video\.duration\)/)
assert.match(player, /src=\{currentPlaybackSource\.playbackUrl\}/)
assert.match(player, /onLoadedMetadata/)
assert.match(player, /suppressNextLoadedDataEventRef/)
assert.match(player, /suppressNextPlayEventRef/)
const endedHandler = player.slice(player.indexOf("onEnded={() =>"), player.indexOf("onError={() =>"))
assert.ok(
  endedHandler.indexOf("releasedRef.current = true") >= 0 &&
    endedHandler.indexOf("stopHeartbeat()") > endedHandler.indexOf("releasedRef.current = true") &&
    endedHandler.indexOf('postEvent("complete"') > endedHandler.indexOf("stopHeartbeat()"),
  "video completion must stop local lease continuity before the best-effort completion request"
)
const errorHandler = player.slice(player.indexOf("onError={() =>"), player.indexOf("/>\n        ) : (", player.indexOf("onError={() =>")))
assert.equal(
  errorHandler.match(/releasedRef\.current = true[\s\S]*?stopHeartbeat\(\)[\s\S]*?postEvent\("error"\)/g)?.length,
  2,
  "both signed-URL refresh errors and ordinary media errors must stop local lease continuity first"
)
const postEventSource = player.slice(player.indexOf("const postEvent"), player.indexOf("const startHeartbeat"))
const parsedEventResponseIndex = postEventSource.indexOf("const json =")
const staleEventGuardIndex = postEventSource.indexOf(
  "if (activePlaybackKeyRef.current !== requestPlaybackKey) return false",
  parsedEventResponseIndex
)
const terminalEventIndex = postEventSource.indexOf("if (!response.ok", parsedEventResponseIndex)
assert.ok(
  parsedEventResponseIndex >= 0 && staleEventGuardIndex > parsedEventResponseIndex && terminalEventIndex > staleEventGuardIndex,
  "stale event response must be ignored before it can stop the active lease"
)

const refreshNow = Date.parse("2026-07-17T12:00:00.000Z")
assert.equal(
  playbackUrlRefreshDelayMs({
    expiresAt: "2026-07-17T12:02:00.000Z",
    ttlSeconds: 120,
    nowMs: refreshNow,
  }),
  90_000,
  "a two-minute Supabase URL must refresh thirty seconds before expiry"
)
assert.equal(
  playbackUrlRefreshDelayMs({
    expiresAt: "2026-07-17T12:00:10.000Z",
    ttlSeconds: 120,
    nowMs: refreshNow,
  }),
  0,
  "an already stale refresh deadline must run immediately"
)
assert.equal(
  playbackUrlRefreshDelayMs({ expiresAt: "invalid", ttlSeconds: 120, nowMs: refreshNow }),
  null
)
assert.equal(clampPlaybackResumeTime(55, 100), 55)
assert.equal(clampPlaybackResumeTime(100, 100), 99.75)
assert.equal(clampPlaybackResumeTime(Number.NaN, 100), 0)
assert.equal(retryAfterDelayMs("7", refreshNow), 7_000)
assert.equal(retryAfterDelayMs("2026-07-17T12:00:09.000Z", refreshNow), 9_000)
assert.match(page, /Burada devam et/)
assert.match(page, /playerSessionId,[\s\S]*takeover:/)
assert.match(page, /createDevicePossessionHeaders\(\{[\s\S]*body: serializedBody/)
assert.match(page, /openVideoSequenceRef/)
assert.match(page, /openVideoRequestRef\.current\?\.controller\.abort\(\)/)
assert.match(page, /openVideoRequestRef\.current\?\.id !== requestId/)
assert.match(page, /signal: controller\.signal/)
const openVideoSource = page.slice(page.indexOf("async function openVideo"), page.indexOf("const activeAccess"))
const parsedAccessResponseIndex = openVideoSource.indexOf("const json =")
const staleAccessGuardIndex = openVideoSource.indexOf(
  "if (openVideoRequestRef.current?.id !== requestId) return",
  parsedAccessResponseIndex
)
const accessStateWriteIndex = openVideoSource.indexOf("if (!response.ok", parsedAccessResponseIndex)
assert.ok(
  parsedAccessResponseIndex >= 0 && staleAccessGuardIndex > parsedAccessResponseIndex && accessStateWriteIndex > staleAccessGuardIndex,
  "stale access response must be ignored before it can replace the latest selection"
)

console.log("Education playback contract tests passed (lease races, takeover, signed URL refresh, resume, watermark, network gate).")

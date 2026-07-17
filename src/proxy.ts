import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

const APP_SESSION_COOKIE = "sm_active_session";
const DEVICE_MANAGEMENT_COOKIE = "sm_device_management";
const LOCAL_ACTIVITY_LAB_PATH = "/owner-audit/activity-lab";
const APP_SESSION_COOKIE_VERSION = "v1";
const APP_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const LEGACY_COOKIE_CUTOFF_MS = Date.parse("2026-07-17T12:30:00Z");
const LEGACY_COOKIE_UPGRADE_END_MS = Date.parse("2026-08-16T12:30:00Z");
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function appSessionSecret() {
  const configured =
    process.env.APP_SESSION_SECRET ||
    process.env.AUTH_STATE_SECRET ||
    process.env.DEVICE_PROOF_SECRET ||
    process.env.SUPABASE_JWT_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "dna-local-app-session-secret";
  return null;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function safeTextEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

async function signAppSessionId(sessionId: string) {
  const secret = appSessionSecret();
  if (!secret) throw new Error("app_session_secret_missing");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${APP_SESSION_COOKIE_VERSION}:${sessionId}`)
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

async function createSignedAppSessionCookie(sessionId: string) {
  return `${APP_SESSION_COOKIE_VERSION}.${sessionId}.${await signAppSessionId(sessionId)}`;
}

function decodeBase64UrlText(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return decodeURIComponent(
    Array.from(atob(padded), (character) =>
      `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`
    ).join("")
  );
}

function extractAuthSessionId(accessToken: string | undefined) {
  const payload = String(accessToken || "").split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(decodeBase64UrlText(payload)) as { session_id?: unknown };
    const sessionId = String(claims.session_id || "");
    return UUID_PATTERN.test(sessionId) ? sessionId : null;
  } catch {
    return null;
  }
}

async function hasValidDeviceManagementCookie(value: string | undefined) {
  if (!value) return false;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) return false;
  const secret = process.env.AUTH_STATE_SECRET || process.env.SUPABASE_JWT_SECRET;
  if (!secret) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const expectedBytes = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(payload)
    );
    const expected = bytesToBase64Url(new Uint8Array(expectedBytes));
    if (!safeTextEqual(signature, expected)) return false;
    const decoded = JSON.parse(decodeBase64UrlText(payload)) as {
      userId?: unknown;
      expiresAt?: unknown;
      nonce?: unknown;
    };
    return (
      UUID_PATTERN.test(String(decoded.userId || "")) &&
      Boolean(decoded.nonce) &&
      Number(decoded.expiresAt || 0) > Date.now()
    );
  } catch {
    return false;
  }
}

async function parseAppSessionCookie(value: string | undefined) {
  if (!value) return null;
  if (UUID_PATTERN.test(value)) return { sessionId: value, legacy: true };
  const [version, sessionId, signature, extra] = value.split(".");
  if (
    extra ||
    version !== APP_SESSION_COOKIE_VERSION ||
    !UUID_PATTERN.test(sessionId || "") ||
    !signature
  ) {
    return null;
  }
  const expected = await signAppSessionId(sessionId);
  if (!safeTextEqual(signature, expected)) return null;
  return { sessionId, legacy: false };
}

function sessionExpiredRedirect(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set("next", nextPath);
  loginUrl.searchParams.set("session", "expired");
  const redirect = NextResponse.redirect(loginUrl);
  redirect.cookies.delete(APP_SESSION_COOKIE);
  return redirect;
}

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === LOCAL_ACTIVITY_LAB_PATH) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Not Found", {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }

    return NextResponse.next();
  }

  const appSurfaceRequested =
    request.nextUrl.searchParams.get("surface") === "app" ||
    request.cookies.get("dna_app_surface")?.value === "app";
  const requestHeaders = new Headers(request.headers);
  if (appSurfaceRequested) {
    requestHeaders.set("x-dna-app-surface", "app");
  }

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          response = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const managementAccess =
    request.nextUrl.pathname === "/profile-setting" &&
    (await hasValidDeviceManagementCookie(
      request.cookies.get(DEVICE_MANAGEMENT_COOKIE)?.value
    ));

  if (!user || !user.email_confirmed_at) {
    if (managementAccess) return response;
    const loginUrl = new URL("/login", request.url);
    const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    loginUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(loginUrl);
  }

  const rawAppSessionCookie = request.cookies.get(APP_SESSION_COOKIE)?.value;
  let parsedAppSession: Awaited<ReturnType<typeof parseAppSessionCookie>> = null;
  try {
    parsedAppSession = await parseAppSessionCookie(rawAppSessionCookie);
  } catch {
    parsedAppSession = null;
  }

  if (!parsedAppSession) {
    if (managementAccess) return response;

    return sessionExpiredRedirect(request);
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: currentAuthSession, error: currentAuthSessionError } =
    await supabase.auth.getSession();
  const authSessionId = extractAuthSessionId(currentAuthSession.session?.access_token);
  if (currentAuthSessionError || !authSessionId) return sessionExpiredRedirect(request);

  const { data: appSession, error: appSessionError } = await admin
    .from("account_sessions")
    .select("id, device_id, auth_session_id, status, created_at, expires_at, user_agent, cookie_signing_upgraded_at")
    .eq("id", parsedAppSession.sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  const expiresAt = appSession?.expires_at ? new Date(appSession.expires_at).getTime() : 0;
  if (
    appSessionError ||
    !appSession ||
    appSession.status !== "active" ||
    !expiresAt ||
    expiresAt <= Date.now()
  ) {
    return sessionExpiredRedirect(request);
  }

  if (appSession.auth_session_id && appSession.auth_session_id !== authSessionId) {
    return sessionExpiredRedirect(request);
  }
  if (!appSession.auth_session_id) {
    // A legacy raw UUID was readable under the former browser RLS policy. It
    // cannot prove possession by itself. Only rows paired to their original
    // Supabase auth session by the rollout migration may be upgraded.
    if (parsedAppSession.legacy) return sessionExpiredRedirect(request);
    const bound = await admin
      .from("account_sessions")
      .update({ auth_session_id: authSessionId })
      .eq("id", appSession.id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .is("auth_session_id", null)
      .select("id")
      .maybeSingle();
    if (bound.error || !bound.data) return sessionExpiredRedirect(request);
  }

  const { data: device, error: deviceError } = await admin
    .from("account_devices")
    .select("id, revoked_at, verification_required, verified_at")
    .eq("id", appSession.device_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (
    deviceError ||
    !device ||
    device.revoked_at ||
    device.verification_required !== false ||
    !device.verified_at
  ) {
    return sessionExpiredRedirect(request);
  }

  const { data: securityState, error: securityStateError } = await admin
    .from("account_security_state")
    .select("suspended_at, temporary_locked_until")
    .eq("user_id", user.id)
    .maybeSingle();
  const temporaryLockedUntil = securityState?.temporary_locked_until
    ? new Date(securityState.temporary_locked_until).getTime()
    : 0;
  if (
    securityStateError ||
    securityState?.suspended_at ||
    (temporaryLockedUntil && temporaryLockedUntil > Date.now())
  ) {
    return sessionExpiredRedirect(request);
  }

  if (parsedAppSession.legacy) {
    const createdAt = appSession.created_at ? new Date(appSession.created_at).getTime() : 0;
    const userAgent = String(request.headers.get("user-agent") || "").slice(0, 500);
    const legacyUpgradeAllowed =
      Date.now() <= LEGACY_COOKIE_UPGRADE_END_MS &&
      createdAt > 0 &&
      createdAt <= LEGACY_COOKIE_CUTOFF_MS &&
      !appSession.cookie_signing_upgraded_at &&
      Boolean(appSession.user_agent) &&
      appSession.user_agent === userAgent;
    if (!legacyUpgradeAllowed) return sessionExpiredRedirect(request);

    const upgraded = await admin
      .from("account_sessions")
      .update({ cookie_signing_upgraded_at: new Date().toISOString() })
      .eq("id", appSession.id)
      .eq("user_id", user.id)
      .is("cookie_signing_upgraded_at", null)
      .select("id")
      .maybeSingle();
    if (upgraded.error || !upgraded.data) return sessionExpiredRedirect(request);

    response.cookies.set(
      APP_SESSION_COOKIE,
      await createSignedAppSessionCookie(appSession.id),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: APP_SESSION_MAX_AGE_SECONDS,
      }
    );
  }

  if (appSurfaceRequested) {
    response.cookies.set("dna_app_surface", "app", {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/starter",
    "/dashboard",
    "/clients/:path*",
    "/assessments/:path*",
    "/reports",
    "/dna-asistani",
    "/report-packages",
    "/education",
    "/profile",
    "/profile-setting",
    "/settings",
    "/video-observation",
    "/owner-audit",
    "/owner-audit/:path*",
  ],
};

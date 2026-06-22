import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const APP_SESSION_COOKIE = "sm_active_session";
const DEVICE_MANAGEMENT_COOKIE = "sm_device_management";

export async function proxy(request: NextRequest) {
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

  if (!user || !user.email_confirmed_at) {
    const loginUrl = new URL("/login", request.url);
    const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    loginUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(loginUrl);
  }

  const appSessionId = request.cookies.get(APP_SESSION_COOKIE)?.value;
  if (!appSessionId) {
    if (
      request.nextUrl.pathname === "/profile-setting" &&
      request.cookies.get(DEVICE_MANAGEMENT_COOKIE)?.value
    ) {
      return response;
    }

    const loginUrl = new URL("/login", request.url);
    const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    loginUrl.searchParams.set("next", nextPath);
    loginUrl.searchParams.set("session", "expired");
    return NextResponse.redirect(loginUrl);
  }

  const { data: appSession, error: appSessionError } = await supabase
    .from("account_sessions")
    .select("id, status, expires_at")
    .eq("id", appSessionId)
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
    const loginUrl = new URL("/login", request.url);
    const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    loginUrl.searchParams.set("next", nextPath);
    loginUrl.searchParams.set("session", "expired");
    const redirect = NextResponse.redirect(loginUrl);
    redirect.cookies.delete(APP_SESSION_COOKIE);
    return redirect;
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

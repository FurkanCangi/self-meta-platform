import { config } from "dotenv"

config({ path: ".env.local", quiet: true })

const appOrigin = String(
  process.env.GOOGLE_OAUTH_LIVE_BASE_URL || "https://self-meta-platform.vercel.app"
).replace(/\/$/, "")
const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "")
const supabaseKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "")

function fail(message: string): never {
  console.error(`FAIL ${message}`)
  process.exit(1)
}

async function main() {
  if (!supabaseUrl || !supabaseKey) fail("Supabase public configuration is missing")

  const settingsResponse = await fetch(`${supabaseUrl}/auth/v1/settings`, {
    headers: { apikey: supabaseKey },
  })
  const settings = (await settingsResponse.json()) as {
    external?: { google?: boolean }
    disable_signup?: boolean
  }
  if (!settingsResponse.ok) fail(`Supabase Auth settings returned ${settingsResponse.status}`)
  if (settings.external?.google !== true) fail("Google provider is disabled")
  if (settings.disable_signup === true) fail("New signups are disabled")
  console.log("PASS Google provider and new signups are enabled")

  const body = new URLSearchParams({
    mode: "signup",
    surface: "web",
    next: "/starter",
    deviceId: `google-live-readiness-${crypto.randomUUID()}`,
    deviceType: "desktop",
    identityVersion: "legacy-session",
    terms: "on",
    kvkk: "on",
    consent: "on",
    authority: "on",
  })
  const startResponse = await fetch(`${appOrigin}/api/auth/google/start`, {
    method: "POST",
    redirect: "manual",
    headers: {
      origin: appOrigin,
      referer: `${appOrigin}/signup`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  })
  const authorizeLocation = startResponse.headers.get("location")
  const stateCookies = startResponse.headers.getSetCookie?.() || []
  if (startResponse.status !== 303 || !authorizeLocation) {
    fail(`Application OAuth start returned ${startResponse.status}`)
  }
  const authorizeUrl = new URL(authorizeLocation)
  if (authorizeUrl.host !== new URL(supabaseUrl).host || authorizeUrl.pathname !== "/auth/v1/authorize") {
    fail("Application did not redirect to the expected Supabase authorize endpoint")
  }
  if (!stateCookies.some((cookie) => cookie.startsWith("dna_google_oauth_state="))) {
    fail("Signed application OAuth state cookie is missing")
  }
  if (!stateCookies.some((cookie) => cookie.includes("auth-token-code-verifier"))) {
    fail("PKCE verifier cookie is missing")
  }
  console.log("PASS Application emits signed state and PKCE cookies")

  const providerResponse = await fetch(authorizeLocation, { redirect: "manual" })
  const providerLocation = providerResponse.headers.get("location")
  if (providerResponse.status !== 302 || !providerLocation) {
    fail(`Supabase authorize endpoint returned ${providerResponse.status}`)
  }
  const providerUrl = new URL(providerLocation)
  if (providerUrl.host !== "accounts.google.com" || providerUrl.pathname !== "/o/oauth2/v2/auth") {
    fail("Supabase did not redirect to Google Accounts")
  }
  if (!providerUrl.searchParams.get("client_id")) fail("Google client ID is missing")
  if (!providerUrl.searchParams.get("redirect_uri")?.endsWith("/auth/v1/callback")) {
    fail("Google callback is not bound to Supabase Auth")
  }
  if (providerUrl.searchParams.get("prompt") !== "select_account") {
    fail("Google account selection prompt is missing")
  }
  console.log("PASS Supabase redirects to Google with client, callback, state, and account selection")
}

main().catch((error) => fail(error instanceof Error ? error.message : "Unknown live readiness error"))

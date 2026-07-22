import fs from "fs"
import path from "path"

const root = process.cwd()
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8")

const startRoute = read("src/app/api/auth/google/start/route.ts")
const callbackRoute = read("src/app/auth/callback/route.ts")
const state = read("src/lib/auth/googleOAuthState.ts")
const signup = read("src/app/components/auth/DnaSignupForm.tsx")
const login = read("src/app/login/PageClient.tsx")

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
  "Google OAuth starts with PKCE-compatible server redirect",
  startRoute.includes('provider: "google"') &&
    startRoute.includes('scopes: "openid email profile"') &&
    startRoute.includes('prompt: "select_account"') &&
    startRoute.includes("NextResponse.redirect(data.url, 303)")
)
check(
  "signup requires all four legal confirmations before leaving the site",
  startRoute.includes('hasChecked(formData.get("terms"))') &&
    startRoute.includes('hasChecked(formData.get("kvkk"))') &&
    startRoute.includes('hasChecked(formData.get("consent"))') &&
    startRoute.includes('hasChecked(formData.get("authority"))') &&
    startRoute.includes('mode === "signup" && !legalAccepted')
)
check(
  "OAuth state is signed, short lived, HttpOnly, and same-site",
  state.includes('createHmac("sha256"') &&
    state.includes("timingSafeEqual") &&
    state.includes("GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60") &&
    startRoute.includes("httpOnly: true") &&
    startRoute.includes('sameSite: "lax"')
)
check(
  "callback exchanges the PKCE code and accepts Google identities only",
  callbackRoute.includes("exchangeCodeForSession(code)") &&
    callbackRoute.includes("function hasGoogleIdentity(user: User)") &&
    callbackRoute.includes('identity.provider === "google"') &&
    callbackRoute.includes('provider === "google"') &&
    callbackRoute.includes("if (!hasGoogleIdentity(user))")
)
check(
  "cancelled signup returns to signup with a clear retry message",
  callbackRoute.includes('oauthError === "access_denied" ? "google_cancelled"') &&
    callbackRoute.includes("authEntryPath(state)") &&
    signup.includes('code === "google_cancelled"') &&
    signup.includes('const [error, setError] = useState("")') &&
    signup.includes('setError(formatSignupErrorCode(getSignupSearchParam("error")))') &&
    !signup.includes("function initialSignupError()") &&
    login.includes('code === "google_cancelled"')
)
check(
  "existing profiles keep their role and paid plan",
  callbackRoute.includes("if (!profile) {") &&
    callbackRoute.includes('.from("profiles").insert(newProfile)') &&
    !callbackRoute.includes('.from("profiles").upsert(') &&
    callbackRoute.includes("else if (!profile.full_name)") &&
    callbackRoute.includes("profile = { ...profile, full_name: fullName }")
)
check(
  "legal acceptance is idempotent and records active documents for new Google users",
  callbackRoute.includes("if (!acceptedLegal) {") &&
    callbackRoute.includes("getAcceptedDocumentsSnapshot()") &&
    callbackRoute.includes('source_path: "/signup-google"') &&
    callbackRoute.includes('plan_code: profile.plan || "none"')
)
check(
  "successful callback creates the app session and clears temporary OAuth state",
  callbackRoute.includes("registerAppSessionForUser") &&
    callbackRoute.includes("setAppSessionCookie(response, sessionResult.sessionId)") &&
    callbackRoute.includes("clearGoogleState(response)")
)

if (failures) {
  console.error(`\n${failures} Google OAuth contract check(s) failed.`)
  process.exit(1)
}

console.log("\nGoogle OAuth signup contract checks passed.")

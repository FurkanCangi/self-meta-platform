import fs from "fs"
import path from "path"
import { renderSignupConfirmationEmail } from "../src/lib/auth/confirmationEmail"

const root = process.cwd()
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8")

const signup = read("src/app/components/auth/DnaSignupForm.tsx")
const login = read("src/app/login/PageClient.tsx")
const success = read("src/app/auth-signup-success/page.tsx")
const layout = read("src/app/components/auth/AuthLayout.tsx")
const confirmationEmail = read("src/lib/auth/confirmationEmail.ts")
const logoPath = path.join(root, "public/images/brand/dna-oauth-logo-120.png")

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
  "signup buttons explain missing legal confirmations instead of becoming inert",
  signup.includes('aria-describedby={!legalAccepted ? "email-button-guidance" : undefined}') &&
    signup.includes('aria-describedby={!legalAccepted ? "google-button-guidance" : undefined}') &&
    signup.includes('aria-required="true"') &&
    !signup.includes("disabled={loading || googleLoading || !legalAccepted}")
)
check(
  "Google signup is branded and clearly recommended",
  signup.includes("<FcGoogle") &&
    signup.includes("Önerilen") &&
    signup.includes("Google e-posta adresinizi doğrular") &&
    login.includes("<FcGoogle")
)
check(
  "signup completion screen provides a clear three-step journey",
  success.includes("Son bir adım kaldı") &&
    success.includes("1 · Kayıt") &&
    success.includes("2 · Doğrulama") &&
    success.includes("3 · Giriş") &&
    success.includes("<MailCheck")
)
check(
  "auth footer links to real privacy and terms pages",
  layout.includes('href="/privacy"') && layout.includes('href="/terms"') && !layout.includes('href="#"')
)
check(
  "confirmation email uses the real DNA logo and escapes dynamic HTML",
  confirmationEmail.includes("function escapeHtml") &&
    confirmationEmail.includes("dna-oauth-logo-120.png") &&
    confirmationEmail.includes("renderSignupConfirmationEmail") &&
    confirmationEmail.includes("Hesabımı Güvenle Etkinleştir")
)
const renderedEmail = renderSignupConfirmationEmail({
  to: "test@example.com",
  fullName: '<img src=x onerror="alert(1)">',
  confirmationUrl: "https://self-meta-platform.vercel.app/auth/confirm?token_hash=a&b=c",
})
check(
  "confirmation email escapes user content and link attributes at runtime",
  renderedEmail.html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;") &&
    renderedEmail.html.includes("token_hash=a&amp;b=c") &&
    !renderedEmail.html.includes('<img src=x onerror="alert(1)">')
)

let logoIsSquare120 = false
if (fs.existsSync(logoPath)) {
  const logo = fs.readFileSync(logoPath)
  const isPng = logo.length > 24 && logo.subarray(1, 4).toString("ascii") === "PNG"
  const width = isPng ? logo.readUInt32BE(16) : 0
  const height = isPng ? logo.readUInt32BE(20) : 0
  logoIsSquare120 = width === 120 && height === 120 && logo.length < 1024 * 1024
}
check("OAuth logo is a valid 120px square PNG under 1MB", logoIsSquare120)

if (failures) {
  console.error(`\n${failures} auth branding contract check(s) failed.`)
  process.exit(1)
}

console.log("\nAuth branding contract checks passed.")

import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

type Finding = {
  name: string
  detail: string
}

const root = process.cwd()
const findings: Finding[] = []
const warnings: Finding[] = []

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8")
}

function exists(relativePath: string) {
  return fs.existsSync(path.join(root, relativePath))
}

function add(name: string, detail: string) {
  findings.push({ name, detail })
}

function warn(name: string, detail: string) {
  warnings.push({ name, detail })
}

function listFiles(dir: string, predicate: (file: string) => boolean, out: string[] = []) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const relativePath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (["node_modules", ".next", ".tmp", ".git", ".venv", "__pycache__"].includes(entry.name)) continue
      listFiles(relativePath, predicate, out)
      continue
    }
    if (entry.isFile() && predicate(relativePath)) out.push(relativePath)
  }
  return out
}

const textFiles = listFiles(".", (file) =>
  /\.(ts|tsx|js|jsx|json|sql|md|env|example|yml|yaml)$/i.test(file) &&
  !file.includes("package-lock.json") &&
  !file.includes("security-readiness-check.ts")
)

function isSuspiciousSecretKey(key: string) {
  return (
    key === "SUPABASE_SERVICE_ROLE_KEY" ||
    key === "PAYMENT_WEBHOOK_SECRET" ||
    /(^|_)(SECRET|PASSWORD|PRIVATE_KEY)($|_)/.test(key) ||
    /(^|_)TOKEN($|_)/.test(key)
  )
}

function hasTrackedSecretCandidate(content: string) {
  return content.split(/\r?\n/).some((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) return false
    const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!match) return false
    const key = match[1] || ""
    const value = String(match[2] || "").trim()
    if (!isSuspiciousSecretKey(key)) return false
    if (!value || value === "..." || value.includes("<") || value.toLowerCase().includes("placeholder")) {
      return false
    }
    return true
  })
}

for (const file of textFiles) {
  const content = read(file)
  if (hasTrackedSecretCandidate(content)) {
    add("tracked secret candidate", file)
  }
}

const envExample = read(".env.example")
for (const key of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PAYMENT_WEBHOOK_SECRET",
  "EDUCATION_VIDEO_BUCKET",
  "VIDEO_OBS_API_BASE_URL",
  "VIDEO_PROVIDER",
  "BUNNY_STREAM_LIBRARY_ID",
  "BUNNY_STREAM_API_KEY",
  "BUNNY_STREAM_SIGNING_KEY",
  "BUNNY_STREAM_PULL_ZONE",
  "BUNNY_STREAM_IP_LOCK",
  "SUPPORT_ATTACHMENTS_BUCKET",
  "SUPPORT_RESPONSE_TARGET_HOURS",
]) {
  if (!new RegExp(`^${key}=`, "m").test(envExample)) {
    add("missing env example placeholder", key)
  }
}

for (const line of envExample.split(/\r?\n/)) {
  const [key] = line.split("=")
  if (/^NEXT_PUBLIC_/.test(key || "") && /(SECRET|SERVICE_ROLE|TOKEN|PRIVATE|PASSWORD|WEBHOOK)/i.test(key || "")) {
    add("public secret-like env name", key)
  }
}

for (const sqlFile of [
  "sql/core_data_rls.sql",
  "sql/account_session_policy.sql",
  "sql/legal_acceptances.sql",
  "sql/education_video_security.sql",
  "sql/payment_security.sql",
  "sql/kvkk_operational_security.sql",
  "sql/support_tickets.sql",
  "sql/owner_bulk_email.sql",
  "sql/dna_chat_v1.sql",
]) {
  if (!exists(sqlFile)) add("missing SQL migration file", sqlFile)
}

const paymentSecuritySql = read("sql/payment_security.sql")
for (const signature of [
  "public.get_report_credit_balance(uuid)",
  "public.consume_report_credit(uuid, uuid, uuid, jsonb)",
]) {
  const escapedSignature = signature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  if (!new RegExp(`revoke execute on function ${escapedSignature} from anon, authenticated;`).test(paymentSecuritySql)) {
    add("service-only payment RPC missing explicit client revoke", signature)
  }
}

if (!exists("CLAUDE.md")) {
  add("missing persistent security rules", "CLAUDE.md")
} else {
  const securityRules = read("CLAUDE.md")
  for (const requiredRule of [
    "Zod schema/normalizer",
    "rate limit",
    "Supabase Auth",
    "Production CORS",
    "Güvenlik header",
    "tamamen deterministik kalır",
  ]) {
    if (!securityRules.includes(requiredRule)) {
      add("persistent security rule missing", requiredRule)
    }
  }
}

const nextConfig = read("next.config.ts")
if (!nextConfig.includes("poweredByHeader: false")) {
  add("x-powered-by header not disabled", "next.config.ts")
}
for (const headerName of [
  "Content-Security-Policy",
  "Strict-Transport-Security",
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Referrer-Policy",
]) {
  if (!nextConfig.includes(headerName)) {
    add("security header missing", headerName)
  }
}
if (/Access-Control-Allow-Origin["']?\s*[:,]\s*["']\*/.test(nextConfig)) {
  add("wildcard CORS in next config", "next.config.ts")
}

const serviceRoleFiles = textFiles.filter(
  (file) => /\.(ts|tsx|js|jsx)$/i.test(file) && read(file).includes("SUPABASE_SERVICE_ROLE_KEY")
)
for (const file of serviceRoleFiles) {
  const allowed =
    file === "src/lib/supabase/admin.ts" ||
    file === "src/lib/owner/ownerAudit.ts" ||
    file === ".env.example" ||
    file.startsWith("scripts/")
  if (!allowed) add("service role key outside server-only allowlist", file)
}

const mutatingRoutes = listFiles("src/app/api", (file) => /route\.ts$/.test(file)).filter((file) => {
  const content = read(file)
  return /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/.test(content)
})

const apiRoutes = listFiles("src/app/api", (file) => /route\.ts$/.test(file))
for (const file of apiRoutes) {
  const content = read(file)
  if (!content.includes("checkRateLimit") && !content.includes("rateLimitResponse")) {
    add("API route missing rate limit", file)
  }
}

for (const file of mutatingRoutes) {
  const content = read(file)
  if (file === "src/app/api/billing/webhook/route.ts") continue
  if (!content.includes("requireTrustedMutation")) {
    add("mutating route missing trusted mutation guard", file)
  }
}

for (const file of apiRoutes) {
  const content = read(file)
  const parsesJsonBody =
    content.includes("request.json()") ||
    content.includes("req.json()") ||
    content.includes("JSON.parse(payload)")
  if (!parsesJsonBody) continue

  const hasSchema =
    content.includes("readJsonWithSchema") ||
    content.includes("parseJsonTextWithSchema") ||
    file === "src/app/api/billing/webhook/route.ts"
  if (!hasSchema) {
    add("JSON body route missing schema validation", file)
  }
}

const entitlements = read("src/lib/security/entitlements.ts")
if (!entitlements.includes("billingWebhookPayloadSchema")) {
  add("billing webhook missing Zod payload schema", "src/lib/security/entitlements.ts")
}

const aiReportRoute = read("src/app/api/ai-report/route.ts")
if (!aiReportRoute.includes("deterministicReportPayloadSchema")) {
  add("deterministic report route missing payload schema", "src/app/api/ai-report/route.ts")
}
if (!aiReportRoute.includes("consumeReportCredit")) {
  add("deterministic report route missing user budget check", "src/app/api/ai-report/route.ts")
}
const deterministicReportEngine = read("src/lib/dna/reportEngine.ts")
if (!aiReportRoute.includes("buildAdvancedReport")) {
  add("deterministic report builder missing", "src/app/api/ai-report/route.ts")
}
if (/OPENAI_API_KEY|from\s+["']openai["']|rewriteClinicalReport|generateAIClinicalReport/i.test(`${aiReportRoute}\n${deterministicReportEngine}`)) {
  add("external model runtime found in production report path", "src/app/api/ai-report/route.ts")
}

const dnaChatRoute = read("src/app/api/app/dna-chat/route.ts")
const dnaChatSnapshot = read("src/lib/dna/chat/reportSnapshot.ts")
const dnaChatRuntime = [
  dnaChatRoute,
  read("src/lib/dna/chat/engine.ts"),
  read("src/lib/dna/chat/router.ts"),
  read("src/lib/dna/chat/knowledge.ts"),
].join("\n")
if (!dnaChatRoute.includes("dnaChatPostSchema") || !dnaChatRoute.includes("safeParse") || !dnaChatRoute.includes(".strict()")) {
  add("DNA chat route missing strict Zod validation", "src/app/api/app/dna-chat/route.ts")
}
if (!dnaChatRoute.includes("requireConfirmedUser") || !dnaChatRoute.includes("requireTrustedMutation")) {
  add("DNA chat route missing auth or same-origin guard", "src/app/api/app/dna-chat/route.ts")
}
if (!dnaChatRoute.includes('errorResponse("audit_unavailable", 503)')) {
  add("DNA chat case audit is not fail-closed", "src/app/api/app/dna-chat/route.ts")
}
if (!dnaChatSnapshot.includes('"dna-chat-context@1"') || /evidenceMap\.(?:caseEvidenceLines|counterEvidenceLines|preservedCapacityLines|dataLimitations)/.test(dnaChatSnapshot)) {
  add("DNA chat snapshot is missing or copies raw clinical evidence text", "src/lib/dna/chat/reportSnapshot.ts")
}
if (/OPENAI_API_KEY|from\s+["']openai["']|anthropic|ollama|langchain|pinecone|vector(?:store|db)|fetch\s*\(\s*["']https?:/i.test(dnaChatRuntime)) {
  add("external model or runtime retrieval found in DNA chat", "src/lib/dna/chat")
}

const audit = spawnSync("npm", ["audit", "--omit=dev", "--audit-level=high"], {
  cwd: root,
  encoding: "utf8",
  timeout: 30000,
})

if (audit.error) {
  add("npm audit command failed to run", audit.error.message)
} else if (audit.status !== 0) {
  const auditOutput = audit.stdout || audit.stderr || ""
  if (/(Severity:\s*(high|critical)|\b(high|critical)\s+severity)/i.test(auditOutput)) {
    add("npm audit high or critical severity findings", auditOutput.slice(0, 500))
  } else {
    warn("npm audit non-blocking finding", auditOutput.slice(0, 500))
  }
}

if (findings.length > 0) {
  console.error("Security readiness check failed:")
  for (const finding of findings) {
    console.error(`- ${finding.name}: ${finding.detail}`)
  }
  process.exit(1)
}

if (warnings.length > 0) {
  console.warn("Security readiness warnings:")
  for (const warning of warnings) {
    console.warn(`- ${warning.name}: ${warning.detail}`)
  }
}

console.log("Security readiness check passed.")

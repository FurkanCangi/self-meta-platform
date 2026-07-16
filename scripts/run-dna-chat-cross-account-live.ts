import fs from "node:fs"
import path from "node:path"
import { randomBytes, randomUUID } from "node:crypto"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

type JsonRecord = Record<string, unknown>

type Step = {
  name: string
  ok: boolean
  detail?: string
  ms: number
}

type EnvConfig = {
  siteUrl: string
  supabaseUrl: string
  anonKey: string
  serviceKey: string
}

type Fixture = {
  label: "A" | "B"
  email: string
  password: string
  userAgent: string
  clientCode: string
  contextMarker: string
  userId: string | null
  clientId: string | null
  assessmentId: string | null
  reportId: string | null
  cookies: CookieJar | null
}

type JsonResponse = {
  status: number
  headers: Headers
  body: JsonRecord
}

const root = process.cwd()
const runId = `dna-chat-cross-account-${Date.now()}-${randomBytes(4).toString("hex")}`
const requiredConfirmation = "CREATE_AND_DELETE_SYNTHETIC_DNA_CHAT_FIXTURES"
const uiHoldConfirmation = "HOLD_SYNTHETIC_FIXTURE_FOR_BROWSER_QA"
const steps: Step[] = []
const cleanupErrors: string[] = []
const secrets = new Set<string>()

let admin: SupabaseClient | null = null

function loadDotEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return
  const text = fs.readFileSync(filePath, "utf8")
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const index = line.indexOf("=")
    if (index <= 0) continue
    const key = line.slice(0, index).trim()
    let value = line.slice(index + 1).trim()
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

function loadConfig(): EnvConfig {
  loadDotEnvFile(path.join(root, ".env.local"))
  loadDotEnvFile(path.join(root, ".env"))

  if (process.env.DNA_CHAT_CROSS_ACCOUNT_LIVE_CONFIRM !== requiredConfirmation) {
    throw new Error(
      `Live fixture creation is locked. Set DNA_CHAT_CROSS_ACCOUNT_LIVE_CONFIRM=${requiredConfirmation} only for an intentional run.`,
    )
  }

  const siteUrl = String(
    process.env.DNA_CHAT_CROSS_ACCOUNT_SITE_URL ||
      process.env.LIVE_HEALTH_SITE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://self-meta-platform.vercel.app",
  ).replace(/\/+$/, "")
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim()
  const anonKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim()
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()

  if (!siteUrl || !supabaseUrl || !anonKey || !serviceKey) {
    throw new Error(
      "DNA_CHAT_CROSS_ACCOUNT_SITE_URL/LIVE_HEALTH_SITE_URL, Supabase URL, anon key, or service-role key is missing.",
    )
  }

  const parsedSiteUrl = new URL(siteUrl)
  if (parsedSiteUrl.protocol !== "https:" && parsedSiteUrl.hostname !== "localhost") {
    throw new Error("The configured site must use HTTPS unless it is localhost.")
  }

  return { siteUrl, supabaseUrl, anonKey, serviceKey }
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {}
}

function safeError(error: unknown) {
  let message = error instanceof Error ? error.message : String(error)
  for (const secret of secrets) {
    if (secret) message = message.split(secret).join("[redacted]")
  }
  return message
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "[redacted-id]")
    .replace(/\beyJ[A-Za-z0-9._-]{20,}\b/g, "[redacted-token]")
    .slice(0, 500)
}

function failIfError(label: string, error: unknown) {
  if (!error) return
  const record = asRecord(error)
  const code = typeof record.code === "string" ? record.code.slice(0, 80) : "unknown"
  const message = typeof record.message === "string" ? safeError(record.message) : "operation_failed"
  throw new Error(`${label} (${code}): ${message}`)
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function runStep(name: string, fn: () => Promise<string | void>) {
  const startedAt = Date.now()
  try {
    const detail = await fn()
    steps.push({ name, ok: true, ...(detail ? { detail } : {}), ms: Date.now() - startedAt })
  } catch (error) {
    steps.push({ name, ok: false, detail: safeError(error), ms: Date.now() - startedAt })
    throw error
  }
}

async function safeCleanup(label: string, fn: () => Promise<void>) {
  try {
    await fn()
  } catch (error) {
    cleanupErrors.push(`${label}: ${safeError(error)}`)
  }
}

function getSetCookieValues(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & { getSetCookie?: () => string[] }
  const values = withGetSetCookie.getSetCookie?.()
  if (values?.length) return values

  const combined = headers.get("set-cookie")
  if (!combined) return []
  return combined.split(/,(?=\s*[!#$%&'*+\-.^_`|~0-9A-Za-z]+=)/g)
}

class CookieJar {
  private readonly values = new Map<string, string>()

  absorb(headers: Headers) {
    for (const setCookie of getSetCookieValues(headers)) {
      const segments = setCookie.split(";")
      const pair = segments[0]?.trim() || ""
      const separator = pair.indexOf("=")
      if (separator <= 0) continue
      const name = pair.slice(0, separator).trim()
      const value = pair.slice(separator + 1).trim()
      const shouldDelete = segments.some((segment) => /^\s*max-age\s*=\s*0\s*$/i.test(segment))
      if (!value || shouldDelete) this.values.delete(name)
      else this.values.set(name, value)
    }
  }

  has(name: string) {
    return this.values.has(name)
  }

  hasNameContaining(fragment: string) {
    return Array.from(this.values.keys()).some((name) => name.includes(fragment))
  }

  header() {
    return Array.from(this.values.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ")
  }
}

function createFixture(label: "A" | "B"): Fixture {
  const suffix = `${runId}-${label.toLowerCase()}`
  const useBrowserFixture =
    label === "A" && process.env.DNA_CHAT_CROSS_ACCOUNT_UI_HOLD === uiHoldConfirmation
  const email = useBrowserFixture
    ? String(process.env.DNA_CHAT_CROSS_ACCOUNT_UI_EMAIL || "").trim()
    : `${suffix}@example.invalid`
  const password = useBrowserFixture
    ? String(process.env.DNA_CHAT_CROSS_ACCOUNT_UI_PASSWORD || "")
    : `Xat-${randomBytes(24).toString("base64url")}!Aa1`
  if (useBrowserFixture) {
    invariant(email.endsWith("@example.invalid"), "Browser QA email must use the example.invalid domain.")
    invariant(password.length >= 20, "Browser QA password must contain at least 20 characters.")
  }
  const clientCode = `XAT-${randomBytes(5).toString("hex").toUpperCase()}`
  const contextMarker = `XAT_CONTEXT_${randomBytes(10).toString("hex").toUpperCase()}`
  const userAgent = `DNA-cross-account-live/${runId}/${label}`

  ;[email, password, clientCode, contextMarker].forEach((value) => secrets.add(value))

  return {
    label,
    email,
    password,
    userAgent,
    clientCode,
    contextMarker,
    userId: null,
    clientId: null,
    assessmentId: null,
    reportId: null,
    cookies: null,
  }
}

async function createSyntheticFixture(fixture: Fixture) {
  invariant(admin, "Admin client is not initialized.")

  const auth = await admin.auth.admin.createUser({
    email: fixture.email,
    password: fixture.password,
    email_confirm: true,
    user_metadata: { test_automation: runId, fixture: fixture.label },
  })
  failIfError("auth user create failed", auth.error)
  invariant(auth.data.user?.id, "Created user ID is missing.")
  fixture.userId = auth.data.user.id
  secrets.add(fixture.userId)

  const profile = await admin.from("profiles").upsert(
    {
      user_id: fixture.userId,
      role: "expert",
      plan: "professional",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  )
  failIfError("profile upsert failed", profile.error)

  const client = await admin
    .from("clients")
    .insert({ owner_id: fixture.userId, child_code: fixture.clientCode, anamnez: "" })
    .select("id")
    .single()
  failIfError("client create failed", client.error)
  invariant(client.data?.id, "Created client ID is missing.")
  fixture.clientId = String(client.data.id)
  secrets.add(fixture.clientId)

  const assessment = await admin
    .from("assessments_v2")
    .insert({
      client_id: fixture.clientId,
      label: "TEST_AUTOMATION DNA cross-account fixture",
      assessment_date: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single()
  failIfError("assessment create failed", assessment.error)
  invariant(assessment.data?.id, "Created assessment ID is missing.")
  fixture.assessmentId = String(assessment.data.id)
  secrets.add(fixture.assessmentId)

  const report = await admin
    .from("reports")
    .insert({
      assessment_id: fixture.assessmentId,
      version: 1,
      immutable: true,
      report_text: "TEST_AUTOMATION synthetic report fixture",
      snapshot_json: {
        test_automation: runId,
        age_months: 48,
        scores: {
          physiological: fixture.label === "A" ? 28 : 31,
          sensory: fixture.label === "A" ? 32 : 29,
          emotional: 40,
          cognitive: 42,
          executive: 38,
          interoception: 36,
        },
        domain_levels: {
          physiological: "Riskli",
          sensory: "Riskli",
          emotional: "Tipik",
          cognitive: "Tipik",
          executive: "Tipik",
          interoception: "Tipik",
        },
        chat_context: {
          version: "dna-chat-context@1",
          primaryAxis: fixture.contextMarker,
          secondaryAxes: ["Duyusal regülasyon"],
          mechanismLabel: fixture.contextMarker,
          mechanismSummary: fixture.contextMarker,
          caseEvidenceLines: ["Sentetik fizyolojik alan bulgusu."],
          counterEvidenceLines: ["Sentetik korunmuş bilişsel alan bulgusu."],
          preservedCapacityLines: ["Sentetik korunmuş kapasite bulgusu."],
          dataLimitations: ["Yalnız otomatik çapraz hesap testi için oluşturulmuştur."],
          confidenceLevel: "Sınırlı",
          confidenceRationale: "Sentetik test verisi.",
          weakDomains: ["Fizyolojik regülasyon", "Duyusal regülasyon"],
          strongDomains: ["Bilişsel regülasyon"],
          patterns: ["Sentetik test örüntüsü"],
        },
      },
    })
    .select("id")
    .single()
  failIfError("report create failed", report.error)
  invariant(report.data?.id, "Created report ID is missing.")
  fixture.reportId = String(report.data.id)
  secrets.add(fixture.reportId)
}

async function loginThroughSite(config: EnvConfig, fixture: Fixture) {
  const form = new URLSearchParams({
    email: fixture.email,
    password: fixture.password,
    next: "/dna-asistani?surface=app",
    surface: "app",
    deviceId: `cross-account-device-${runId}-${fixture.label}`,
    deviceType: "desktop",
  })

  const response = await fetch(`${config.siteUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      accept: "text/html,application/xhtml+xml",
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      origin: config.siteUrl,
      "user-agent": fixture.userAgent,
    },
    body: form,
    redirect: "manual",
  })

  const location = response.headers.get("location") || ""
  const redirectTarget = location ? new URL(location, config.siteUrl) : null
  const loginError = redirectTarget?.searchParams.get("error")
  invariant(!loginError, `Site login returned error code ${String(loginError || "unknown").slice(0, 80)}.`)
  invariant(response.status === 303, `Site login returned HTTP ${response.status}, expected 303.`)

  const jar = new CookieJar()
  jar.absorb(response.headers)
  invariant(jar.has("sm_active_session"), "Site login did not issue the app-session cookie.")
  invariant(jar.hasNameContaining("-auth-token"), "Site login did not issue a Supabase auth cookie.")
  fixture.cookies = jar
}

async function requestJson(
  config: EnvConfig,
  fixture: Fixture,
  pathname: string,
  init: Omit<RequestInit, "headers"> & { headers?: Record<string, string> } = {},
): Promise<JsonResponse> {
  invariant(fixture.cookies, `Fixture ${fixture.label} has no authenticated cookie jar.`)
  const response = await fetch(`${config.siteUrl}${pathname}`, {
    ...init,
    headers: {
      accept: "application/json",
      cookie: fixture.cookies.header(),
      "user-agent": fixture.userAgent,
      ...(init.headers || {}),
    },
    redirect: "manual",
  })

  const raw = await response.text()
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    throw new Error(`API returned non-JSON content with HTTP ${response.status}.`)
  }

  return { status: response.status, headers: response.headers, body: asRecord(body) }
}

async function postQuestion(
  config: EnvConfig,
  fixture: Fixture,
  body: { question: string; reportId?: string },
) {
  return requestJson(config, fixture, "/api/app/dna-chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: config.siteUrl,
      "x-dna-request": "same-origin",
    },
    body: JSON.stringify(body),
  })
}

function canonicalize(value: unknown, omitKeys = new Set<string>()): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item, omitKeys))
  if (!value || typeof value !== "object") return value

  return Object.fromEntries(
    Object.entries(value as JsonRecord)
      .filter(([key]) => !omitKeys.has(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item, omitKeys)]),
  )
}

function canonicalJson(value: unknown, omitKeys: string[] = []) {
  return JSON.stringify(canonicalize(value, new Set(omitKeys)))
}

function responseContainsFixture(response: JsonRecord, fixture: Fixture) {
  const haystack = JSON.stringify(response)
  return [
    fixture.email,
    fixture.clientCode,
    fixture.contextMarker,
    fixture.userId,
    fixture.clientId,
    fixture.assessmentId,
    fixture.reportId,
  ].some((value) => Boolean(value && haystack.includes(value)))
}

async function deleteEq(table: string, column: string, value: string) {
  invariant(admin, "Admin client is not initialized during cleanup.")
  const { error } = await admin.from(table).delete().eq(column, value)
  failIfError(`${table} cleanup failed`, error)
}

async function deleteIn(table: string, column: string, values: string[]) {
  if (!values.length) return
  invariant(admin, "Admin client is not initialized during cleanup.")
  const { error } = await admin.from(table).delete().in(column, values)
  failIfError(`${table} cleanup failed`, error)
}

async function recoverStaleSyntheticFixtures() {
  invariant(admin, "Admin client is not initialized during fixture recovery.")
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1_000 })
  failIfError("auth fixture recovery lookup failed", error)
  const users = (data?.users || []).filter((user) => {
    const marker = String(user.user_metadata?.test_automation || "")
    return marker.startsWith("dna-chat-cross-account-") && String(user.email || "").endsWith("@example.invalid")
  })

  for (const user of users) {
    const clientsResult = await admin.from("clients").select("id").eq("owner_id", user.id)
    failIfError("stale client lookup failed", clientsResult.error)
    const clientIds = (clientsResult.data || []).map((row) => String(row.id)).filter(Boolean)

    const assessmentIds: string[] = []
    if (clientIds.length) {
      const assessmentsResult = await admin.from("assessments_v2").select("id").in("client_id", clientIds)
      failIfError("stale assessment lookup failed", assessmentsResult.error)
      assessmentIds.push(...(assessmentsResult.data || []).map((row) => String(row.id)).filter(Boolean))
    }

    if (assessmentIds.length) await deleteIn("reports", "assessment_id", assessmentIds)
    await deleteIn("assessments_v2", "id", assessmentIds)
    await deleteIn("clients", "id", clientIds)

    for (const table of [
      "account_sessions",
      "account_security_events",
      "account_devices",
      "account_security_state",
      "legal_acceptances",
    ]) {
      await deleteEq(table, "user_id", user.id)
    }
    await deleteEq("data_access_audit_events", "actor_user_id", user.id)
    await deleteEq("data_access_audit_events", "subject_user_id", user.id)
    const rateLimitCleanup = await admin.from("api_rate_limits").delete().like("key", `%${user.id}%`)
    failIfError("stale rate-limit cleanup failed", rateLimitCleanup.error)
    await deleteEq("profiles", "user_id", user.id)
    const authDelete = await admin.auth.admin.deleteUser(user.id)
    failIfError("stale auth fixture cleanup failed", authDelete.error)
  }

  return users.length
}

async function cleanup(fixtures: Fixture[]) {
  if (!admin) return

  for (const fixture of fixtures) {
    if (fixture.userId) {
      await safeCleanup(`data_access_audit_events:${fixture.label}`, async () => {
        await deleteEq("data_access_audit_events", "actor_user_id", fixture.userId!)
        await deleteEq("data_access_audit_events", "subject_user_id", fixture.userId!)
      })
      await safeCleanup(`api_rate_limits:${fixture.label}`, async () => {
        const keys = [
          `dna-chat:reports:${fixture.userId}`,
          `dna-chat:question:burst:${fixture.userId}`,
          `dna-chat:question:hour:${fixture.userId}`,
        ]
        const { error: exactError } = await admin!.from("api_rate_limits").delete().in("key", keys)
        failIfError("api rate-limit exact cleanup failed", exactError)
        const { error: runError } = await admin!
          .from("api_rate_limits")
          .delete()
          .like("key", `%${runId}%`)
        failIfError("api rate-limit run cleanup failed", runError)
      })
      await safeCleanup(`account_sessions:${fixture.label}`, () =>
        deleteEq("account_sessions", "user_id", fixture.userId!),
      )
      await safeCleanup(`account_security_events:${fixture.label}`, () =>
        deleteEq("account_security_events", "user_id", fixture.userId!),
      )
      await safeCleanup(`account_devices:${fixture.label}`, () =>
        deleteEq("account_devices", "user_id", fixture.userId!),
      )
      await safeCleanup(`account_security_state:${fixture.label}`, () =>
        deleteEq("account_security_state", "user_id", fixture.userId!),
      )
      await safeCleanup(`legal_acceptances:${fixture.label}`, () =>
        deleteEq("legal_acceptances", "user_id", fixture.userId!),
      )
    }

    if (fixture.reportId) {
      await safeCleanup(`reports:${fixture.label}`, () =>
        deleteEq("reports", "id", fixture.reportId!),
      )
    }
    if (fixture.assessmentId) {
      await safeCleanup(`assessments_v2:${fixture.label}`, () =>
        deleteEq("assessments_v2", "id", fixture.assessmentId!),
      )
    }
    if (fixture.clientId) {
      await safeCleanup(`clients:${fixture.label}`, () =>
        deleteEq("clients", "id", fixture.clientId!),
      )
    }
    if (fixture.userId) {
      await safeCleanup(`profiles:${fixture.label}`, () =>
        deleteEq("profiles", "user_id", fixture.userId!),
      )
      await safeCleanup(`auth_user:${fixture.label}`, async () => {
        const { error } = await admin!.auth.admin.deleteUser(fixture.userId!)
        failIfError("auth user cleanup failed", error)
      })
    }

    fixture.password = ""
    fixture.cookies = null
  }
}

async function main() {
  let config: EnvConfig | null = null
  let fatal: string | null = null
  const fixtures = [createFixture("A"), createFixture("B")]

  try {
    config = loadConfig()
    admin = createClient(config.supabaseUrl, config.serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })

    if (process.env.DNA_CHAT_CROSS_ACCOUNT_UI_HOLD === uiHoldConfirmation) {
      await runStep("recover stale synthetic browser fixtures", async () => {
        const recovered = await recoverStaleSyntheticFixtures()
        return `recovered=${recovered}`
      })
    }

    await runStep("create two isolated synthetic users and reports", async () => {
      for (const fixture of fixtures) await createSyntheticFixture(fixture)
      return "fixtures=2"
    })

    await runStep("establish two real site app sessions", async () => {
      for (const fixture of fixtures) await loginThroughSite(config!, fixture)
      return "sessions=2"
    })

    const fixtureA = fixtures[0]
    const fixtureB = fixtures[1]
    invariant(fixtureA?.reportId && fixtureB?.reportId, "Fixture report IDs are unavailable.")

    await runStep("user A report list is owner-scoped and metadata-only", async () => {
      const result = await requestJson(config!, fixtureA, "/api/app/dna-chat", { method: "GET" })
      invariant(result.status === 200, `Report list returned HTTP ${result.status}.`)
      invariant(result.body.ok === true, "Report list did not return ok=true.")
      invariant(
        String(result.headers.get("cache-control") || "").includes("no-store"),
        "Report list is missing no-store cache control.",
      )

      const reports = Array.isArray(result.body.reports) ? result.body.reports : []
      invariant(reports.length === 1, `User A report list returned ${reports.length} rows, expected 1.`)
      const report = asRecord(reports[0])
      invariant(report.id === fixtureA.reportId, "User A report list did not return the owned report.")
      invariant(report.id !== fixtureB.reportId, "User A report list exposed the foreign report.")
      const allowedKeys = new Set(["id", "clientCode", "createdAt", "version", "ageBand"])
      invariant(
        Object.keys(report).every((key) => allowedKeys.has(key)),
        "Report list exposed fields outside the metadata contract.",
      )
      invariant(!responseContainsFixture(result.body, fixtureB), "Report list leaked foreign fixture data.")
      return "owned=1 foreign=0"
    })

    await runStep("foreign and nonexistent report IDs return the same 404", async () => {
      const foreign = await postQuestion(config!, fixtureA, {
        question: "Son raporumu özetle.",
        reportId: fixtureB.reportId!,
      })
      const nonexistent = await postQuestion(config!, fixtureA, {
        question: "Son raporumu özetle.",
        reportId: randomUUID(),
      })

      invariant(foreign.status === 404, `Foreign report request returned HTTP ${foreign.status}.`)
      invariant(nonexistent.status === 404, `Missing report request returned HTTP ${nonexistent.status}.`)
      invariant(foreign.body.error === "report_not_found", "Foreign report returned an unexpected error contract.")
      invariant(
        canonicalJson(foreign.body) === canonicalJson(nonexistent.body),
        "Foreign and nonexistent report responses are distinguishable.",
      )
      invariant(!responseContainsFixture(foreign.body, fixtureB), "Foreign-report 404 leaked fixture data.")
      return "status=404 contract=indistinguishable"
    })

    await runStep("theory response ignores a foreign report ID", async () => {
      const withForeign = await postQuestion(config!, fixtureA, {
        question: "İnsular korteks nedir?",
        reportId: fixtureB.reportId!,
      })
      const withoutReport = await postQuestion(config!, fixtureA, {
        question: "İnsular korteks nedir?",
      })

      invariant(withForeign.status === 200, `Theory-with-report request returned HTTP ${withForeign.status}.`)
      invariant(withoutReport.status === 200, `Theory-only request returned HTTP ${withoutReport.status}.`)
      invariant(withForeign.body.ok === true && withoutReport.body.ok === true, "Theory request did not succeed.")
      invariant(
        withForeign.body.engineVersion === "dna-chat-engine@2",
        "Theory request did not use dna-chat-engine@2.",
      )
      invariant(
        Array.isArray(withForeign.body.sources) && withForeign.body.sources.length > 0,
        "Insular cortex response is missing verified sources.",
      )
      invariant(
        canonicalJson(withForeign.body, ["requestId"]) ===
          canonicalJson(withoutReport.body, ["requestId"]),
        "Theory output changed when a foreign report ID was supplied.",
      )
      invariant(!responseContainsFixture(withForeign.body, fixtureB), "Theory response leaked foreign fixture data.")
      return "engine=v2 sourced=true report_context=ignored"
    })

    await runStep("owned case succeeds or is closed by the audit gate", async () => {
      const ownCase = await postQuestion(config!, fixtureA, {
        question: "Son raporumu özetle.",
        reportId: fixtureA.reportId!,
      })

      if (ownCase.status === 503) {
        invariant(ownCase.body.error === "audit_unavailable", "Owned case returned an unexpected 503 contract.")
        return "audit_gate=closed"
      }

      invariant(ownCase.status === 200, `Owned case returned HTTP ${ownCase.status}.`)
      invariant(ownCase.body.ok === true, "Owned case did not return ok=true.")
      invariant(ownCase.body.engineVersion === "dna-chat-engine@2", "Owned case used the wrong engine version.")
      invariant(
        ownCase.body.classification === "case_finding" || ownCase.body.classification === "hypothesis",
        "Owned case did not return a case-scoped classification.",
      )
      invariant(!responseContainsFixture(ownCase.body, fixtureB), "Owned case leaked foreign fixture data.")
      return "case=answered audit_gate=open"
    })

    if (process.env.DNA_CHAT_CROSS_ACCOUNT_UI_HOLD === uiHoldConfirmation) {
      console.log(JSON.stringify({
        ok: true,
        ready: "browser_qa_fixture",
        siteOrigin: new URL(config.siteUrl).origin,
        cleanup: "SIGINT_or_SIGTERM",
      }))
      await new Promise<void>((resolve) => {
        const keepAlive = setInterval(() => {}, 1_000)
        const release = () => {
          clearInterval(keepAlive)
          resolve()
        }
        process.once("SIGINT", release)
        process.once("SIGTERM", release)
      })
    }
  } catch (error) {
    fatal = safeError(error)
  } finally {
    await cleanup(fixtures)
  }

  const report = {
    ok: !fatal && steps.every((item) => item.ok) && cleanupErrors.length === 0,
    runId,
    siteOrigin: config ? new URL(config.siteUrl).origin : null,
    steps,
    cleanup: {
      ok: cleanupErrors.length === 0,
      errors: cleanupErrors,
    },
    ...(fatal ? { fatal } : {}),
    caveats: [
      "Synthetic credentials, report payloads, and clinical fixture values are never printed.",
      "This is a black-box isolation test; query-level read tracing requires separate database instrumentation.",
      "Login and session-registration rate-limit rows are cleaned only when their unique run marker is present.",
    ],
  }

  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exitCode = 1
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, runId, fatal: safeError(error), cleanupErrors }, null, 2))
  process.exitCode = 1
})

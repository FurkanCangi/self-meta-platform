import fs from "node:fs"
import path from "node:path"
import { createHash, webcrypto } from "node:crypto"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

type Step = {
  name: string
  ok: boolean
  detail?: string
  ms?: number
}

type EnvConfig = {
  siteUrl: string
  supabaseUrl: string
  anonKey: string
  serviceKey: string
}

const root = process.cwd()
const runId = `live-health-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const supportSubject = `TEST_AUTOMATION ${runId}`
const supportDescription = `TEST_AUTOMATION backend health check ${runId}. Bu kayit otomatik test tarafindan olusturulup temizlenir.`

const steps: Step[] = []
const cleanupErrors: string[] = []

let admin: SupabaseClient | null = null
let userId: string | null = null
let clientId: string | null = null
let assessmentId: string | null = null
let reportId: string | null = null
let supportTicketId: string | null = null
let sessionId: string | null = null
let deviceId: string | null = null
let rateLimitKey: string | null = null

function loadDotEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return
  const text = fs.readFileSync(filePath, "utf8")
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const index = line.indexOf("=")
    if (index <= 0) continue
    const key = line.slice(0, index).trim()
    const value = line.slice(index + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

function loadConfig(): EnvConfig {
  loadDotEnvFile(path.join(root, ".env.local"))
  loadDotEnvFile(path.join(root, ".env"))

  const siteUrl = String(process.env.LIVE_HEALTH_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://self-meta-platform.vercel.app").replace(/\/+$/, "")
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim()
  const anonKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim()
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()

  if (!siteUrl || !supabaseUrl || !anonKey || !serviceKey) {
    throw new Error("LIVE_HEALTH_SITE_URL/NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY eksik.")
  }

  return { siteUrl, supabaseUrl, anonKey, serviceKey }
}

async function step(name: string, fn: () => Promise<string | void>) {
  const startedAt = Date.now()
  try {
    const detail = await fn()
    steps.push({ name, ok: true, ...(detail ? { detail } : {}), ms: Date.now() - startedAt })
  } catch (error) {
    steps.push({
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
      ms: Date.now() - startedAt,
    })
  }
}

function failIfError(label: string, error: unknown) {
  if (error) {
    const message = String((error as { message?: string; code?: string })?.message || error)
    const code = String((error as { code?: string })?.code || "")
    throw new Error(code ? `${label}: ${code} ${message}` : `${label}: ${message}`)
  }
}

async function createP256DeviceProof(siteUrl: string, accessToken: string) {
  const pair = (await webcrypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign", "verify"]
  )) as CryptoKeyPair
  const publicKey = await webcrypto.subtle.exportKey("jwk", pair.publicKey)
  const canonical = JSON.stringify({
    crv: publicKey.crv,
    kty: publicKey.kty,
    x: publicKey.x,
    y: publicKey.y,
  })
  const publicKeyFingerprint = createHash("sha256").update(canonical).digest("base64url")
  const rawDeviceId = `p256-${publicKeyFingerprint}`
  const challengeResponse = await fetch(`${siteUrl}/api/security/device-proof/challenge`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
      "x-dna-request": "same-origin",
      "user-agent": `DNA-live-backend-health/${runId}/p256-challenge`,
    },
    body: JSON.stringify({ deviceId: rawDeviceId }),
  })
  const challengePayload = await challengeResponse.json().catch(() => null) as {
    ok?: boolean
    challenge?: string
    challengeToken?: string
    error?: string
  } | null
  if (
    challengeResponse.status !== 200 ||
    !challengePayload?.ok ||
    !challengePayload.challenge ||
    !challengePayload.challengeToken
  ) {
    throw new Error(
      `device proof challenge failed: HTTP ${challengeResponse.status} ${challengePayload?.error || "invalid_response"}`
    )
  }
  const signature = await webcrypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    pair.privateKey,
    Buffer.from(challengePayload.challenge, "utf8")
  )
  return {
    deviceId: rawDeviceId,
    deviceType: "desktop" as const,
    identityVersion: "p256-v1" as const,
    publicKeyJwk: JSON.stringify(publicKey),
    publicKeyFingerprint,
    proofChallengeToken: challengePayload.challengeToken,
    proofSignature: Buffer.from(signature).toString("base64url"),
    legacyDeviceId: `live-health-legacy-${runId}`,
  }
}

async function safeCleanup(label: string, fn: () => Promise<void>) {
  try {
    await fn()
  } catch (error) {
    cleanupErrors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function checkTableReadable(table: string) {
  if (!admin) throw new Error("admin client missing")
  const { error } = await admin.from(table).select("*").limit(1)
  failIfError(`${table} table check failed`, error)
}

async function checkTablesReadable(tables: string[]) {
  const failures: string[] = []
  for (const table of tables) {
    try {
      await checkTableReadable(table)
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error))
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join(" | "))
  }
}

async function checkRequiredRpcFunctions() {
  if (!admin) throw new Error("admin client missing")
  const dummyUserId = "00000000-0000-4000-8000-000000000000"
  const failures: string[] = []

  try {
    const balance = await admin.rpc("get_report_credit_balance", {
      target_user_id: dummyUserId,
    })
    failIfError("get_report_credit_balance RPC check failed", balance.error)
    if (typeof balance.data !== "number") {
      throw new Error("get_report_credit_balance RPC returned invalid payload")
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error))
  }

  try {
    const consume = await admin.rpc("consume_report_credit", {
      target_user_id: dummyUserId,
      target_assessment_id: null,
      target_client_id: null,
      consume_metadata: { test_automation: runId },
    })
    failIfError("consume_report_credit RPC check failed", consume.error)
    const consumeRow = Array.isArray(consume.data) ? consume.data[0] : consume.data
    if (!consumeRow || typeof consumeRow.ok !== "boolean" || typeof consumeRow.remaining !== "number") {
      throw new Error("consume_report_credit RPC returned invalid payload")
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error))
  }

  try {
    rateLimitKey = `live-health:${runId}`
    const rateLimit = await admin.rpc("check_api_rate_limit", {
      p_key: rateLimitKey,
      p_limit: 5,
      p_window_ms: 60_000,
    })
    failIfError("check_api_rate_limit RPC check failed", rateLimit.error)
    const rateLimitRow = Array.isArray(rateLimit.data) ? rateLimit.data[0] : rateLimit.data
    if (!rateLimitRow || typeof rateLimitRow.ok !== "boolean" || typeof rateLimitRow.remaining !== "number") {
      throw new Error("check_api_rate_limit RPC returned invalid payload")
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error))
  }

  if (failures.length > 0) {
    throw new Error(failures.join(" | "))
  }
}

async function cleanup() {
  if (!admin) return

  if (supportTicketId) {
    await safeCleanup("support_ticket_attachments", async () => {
      await admin!.from("support_ticket_attachments").delete().eq("ticket_id", supportTicketId)
    })
    await safeCleanup("support_ticket_messages", async () => {
      await admin!.from("support_ticket_messages").delete().eq("ticket_id", supportTicketId)
    })
    await safeCleanup("support_tickets", async () => {
      await admin!.from("support_tickets").delete().eq("id", supportTicketId)
    })
  }

  if (reportId) {
    await safeCleanup("reports", async () => {
      await admin!.from("reports").delete().eq("id", reportId)
    })
  }
  if (assessmentId) {
    await safeCleanup("assessments_v2", async () => {
      await admin!.from("assessments_v2").delete().eq("id", assessmentId)
    })
  }
  if (clientId) {
    await safeCleanup("clients", async () => {
      await admin!.from("clients").delete().eq("id", clientId)
    })
  }
  if (userId) {
    await safeCleanup("education_video_access_logs", async () => {
      await admin!.from("education_video_access_logs").delete().eq("user_id", userId)
    })
    await safeCleanup("education_video_playback_sessions", async () => {
      await admin!.from("education_video_playback_sessions").delete().eq("user_id", userId)
    })
    await safeCleanup("education_video_playback_leases", async () => {
      await admin!.from("education_video_playback_leases").delete().eq("user_id", userId)
    })
    await safeCleanup("education_video_access_tokens", async () => {
      await admin!.from("education_video_access_tokens").delete().eq("user_id", userId)
    })
    await safeCleanup("account_device_verification_challenges", async () => {
      await admin!.from("account_device_verification_challenges").delete().eq("user_id", userId)
    })
    await safeCleanup("account_device_changes", async () => {
      await admin!.from("account_device_changes").delete().eq("user_id", userId)
    })
    await safeCleanup("account_device_proof_nonces", async () => {
      await admin!.from("account_device_proof_nonces").delete().eq("user_id", userId)
    })
    await safeCleanup("account_security_events", async () => {
      await admin!.from("account_security_events").delete().eq("user_id", userId)
    })
    await safeCleanup("account_sessions", async () => {
      await admin!.from("account_sessions").delete().eq("user_id", userId)
    })
    await safeCleanup("account_devices", async () => {
      await admin!.from("account_devices").delete().eq("user_id", userId)
    })
    await safeCleanup("account_security_state", async () => {
      await admin!.from("account_security_state").delete().eq("user_id", userId)
    })
    await safeCleanup("therapist_directory_profiles", async () => {
      await admin!.from("therapist_directory_profiles").delete().eq("user_id", userId)
    })
    await safeCleanup("user_entitlements", async () => {
      await admin!.from("user_entitlements").delete().eq("user_id", userId)
    })
    await safeCleanup("report_credit_ledger", async () => {
      await admin!.from("report_credit_ledger").delete().eq("user_id", userId)
    })
    await safeCleanup("profiles", async () => {
      await admin!.from("profiles").delete().eq("user_id", userId)
    })
    await safeCleanup("auth_user", async () => {
      await admin!.auth.admin.deleteUser(userId!)
    })
  }

  if (rateLimitKey) {
    await safeCleanup("api_rate_limits", async () => {
      await admin!.from("api_rate_limits").delete().eq("key", rateLimitKey)
    })
  }
  await safeCleanup("api_rate_limits_canary", async () => {
    await admin!.from("api_rate_limits").delete().ilike("key", `%${runId}%`)
  })
}

async function main() {
  const config = loadConfig()
  admin = createClient(config.supabaseUrl, config.serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const browser = createClient(config.supabaseUrl, config.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const email = `${runId}@example.invalid`
  const password = `Health${Date.now()}!Aa1`

  try {
    await step("site root responds", async () => {
      const response = await fetch(config.siteUrl, { method: "GET" })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return `${response.status}`
    })

    await step("required Supabase tables are reachable", async () => {
      const tables = [
        "profiles",
        "clients",
        "assessments_v2",
        "reports",
        "account_devices",
        "account_sessions",
        "account_device_verification_challenges",
        "account_device_changes",
        "account_device_proof_nonces",
        "account_security_events",
        "account_security_state",
        "support_tickets",
        "support_ticket_messages",
        "support_ticket_attachments",
        "therapist_directory_profiles",
        "user_entitlements",
        "education_video_access_tokens",
        "education_video_playback_sessions",
        "education_video_playback_leases",
        "report_credit_ledger",
        "api_rate_limits",
      ]
      await checkTablesReadable(tables)
      return `${tables.length} tables`
    })

    await step("required Supabase RPC functions are callable", async () => {
      await checkRequiredRpcFunctions()
      return "report credits + api rate limit"
    })

    await step("support attachments bucket exists", async () => {
      const { data, error } = await admin!.storage.listBuckets()
      failIfError("storage bucket list failed", error)
      if (!data?.some((bucket) => bucket.name === "support-attachments")) {
        throw new Error("support-attachments bucket missing")
      }
      return "support-attachments"
    })

    await step("create confirmed test auth user", async () => {
      const { data, error } = await admin!.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { test_automation: runId },
      })
      failIfError("auth user create failed", error)
      if (!data.user?.id) throw new Error("created user id missing")
      userId = data.user.id
      return userId
    })

    await step("browser sign-in works", async () => {
      const { data, error } = await browser.auth.signInWithPassword({ email, password })
      failIfError("browser sign-in failed", error)
      if (!data.session?.access_token) throw new Error("access token missing")
      return "session"
    })

    await step("session/device registration API works", async () => {
      const session = (await browser.auth.getSession()).data.session
      if (!session?.access_token) throw new Error("missing browser token")
      const deviceProof = await createP256DeviceProof(config.siteUrl, session.access_token)
      const response = await fetch(`${config.siteUrl}/api/security/session/register`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
          "x-dna-request": "same-origin",
          "user-agent": `DNA-live-backend-health/${runId}`,
        },
        body: JSON.stringify(deviceProof),
      })
      const payload = await response.json().catch(() => null) as { ok?: boolean; status?: string; sessionId?: string; deviceId?: string; error?: string } | null
      if (!response.ok || !payload?.ok || payload.status !== "active" || !payload.sessionId || !payload.deviceId) {
        throw new Error(`HTTP ${response.status} ${payload?.error || "session_register_failed"}`)
      }
      sessionId = payload.sessionId
      deviceId = payload.deviceId
      return `session=${sessionId.slice(0, 8)} device=${deviceId.slice(0, 8)}`
    })

    await step("browser RLS client -> assessment -> report flow works", async () => {
      if (!userId) throw new Error("user missing")
      const client = await browser
        .from("clients")
        .insert({ owner_id: userId, child_code: `TEST_AUTOMATION_${runId}`, anamnez: "" })
        .select("id")
        .single()
      failIfError("client insert failed", client.error)
      if (!client.data?.id) throw new Error("client id missing")
      clientId = client.data.id

      const assessment = await browser
        .from("assessments_v2")
        .insert({
          client_id: clientId,
          label: "TEST_AUTOMATION DNA Intelligence Değerlendirme",
          assessment_date: new Date().toISOString().slice(0, 10),
        })
        .select("id")
        .single()
      failIfError("assessment insert failed", assessment.error)
      if (!assessment.data?.id) throw new Error("assessment id missing")
      assessmentId = assessment.data.id

      const report = await browser
        .from("reports")
        .insert({
          assessment_id: assessmentId,
          version: 1,
          report_text: `TEST_AUTOMATION report ${runId}`,
          immutable: true,
          snapshot_json: { test_automation: runId },
        })
        .select("id")
        .single()
      failIfError("report insert failed", report.error)
      if (!report.data?.id) throw new Error("report id missing")
      reportId = report.data.id

      return `client=${client.data.id.slice(0, 8)} assessment=${assessment.data.id.slice(0, 8)} report=${report.data.id.slice(0, 8)}`
    })

    await step("therapist directory profile upsert works", async () => {
      if (!userId) throw new Error("user missing")
      const { data, error } = await admin!
        .from("therapist_directory_profiles")
        .upsert(
          {
            user_id: userId,
            first_name: "TEST_AUTOMATION",
            last_name: "Health",
            profession: "Backend Test",
            publication_status: "pending",
          },
          { onConflict: "user_id" },
        )
        .select("user_id")
        .single()
      failIfError("directory profile upsert failed", error)
      if (data?.user_id !== userId) throw new Error("directory upsert returned wrong user")
      return "profile saved"
    })

    await step("public support ticket API works", async () => {
      const formData = new FormData()
      formData.set("email", email)
      formData.set("requesterName", "TEST_AUTOMATION Health")
      formData.set("category", "technical")
      formData.set("priority", "low")
      formData.set("subject", supportSubject)
      formData.set("description", supportDescription)
      formData.set("pageUrl", `${config.siteUrl}/support`)
      formData.set("browserInfo", `DNA-live-backend-health/${runId}`)
      formData.set("deviceType", "desktop")

      const response = await fetch(`${config.siteUrl}/api/support/tickets`, {
        method: "POST",
        headers: { "x-dna-request": "same-origin" },
        body: formData,
      })
      const payload = await response.json().catch(() => null) as { ok?: boolean; ticket?: { id?: string; ticketNo?: string }; error?: string } | null
      if (!response.ok || !payload?.ok || !payload.ticket?.id) {
        throw new Error(`HTTP ${response.status} ${payload?.error || "support_ticket_failed"}`)
      }
      supportTicketId = payload.ticket.id
      return payload.ticket.ticketNo || supportTicketId
    })

    await step("payment-exempt profile constraint accepts professional", async () => {
      if (!userId) throw new Error("user missing")
      const { error } = await admin!
        .from("profiles")
        .upsert({ user_id: userId, role: "expert", plan: "professional", updated_at: new Date().toISOString() }, { onConflict: "user_id" })
      failIfError("professional profile upsert failed", error)
      return "professional accepted"
    })
  } finally {
    await cleanup()
  }

  const failed = steps.filter((item) => !item.ok)
  const report = {
    ok: failed.length === 0 && cleanupErrors.length === 0,
    runId,
    siteUrl: config.siteUrl,
    steps,
    cleanupErrors,
  }

  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exit(1)
}

main().catch(async (error) => {
  await cleanup()
  console.error(JSON.stringify({
    ok: false,
    runId,
    fatal: error instanceof Error ? error.message : String(error),
    steps,
    cleanupErrors,
  }, null, 2))
  process.exit(1)
})

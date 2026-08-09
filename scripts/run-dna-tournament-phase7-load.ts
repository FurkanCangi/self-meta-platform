import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { performance } from "node:perf_hooks"

import { resolveDnaChat } from "../src/lib/dna/chat/engine"

type BenchmarkCase = Readonly<{ question: string }>

const ROOT = process.cwd()
const SSD = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const ARCH = path.join(SSD, "Outputs/SelfMetaAI/dna-intelligence/architecture-tournament/v2")
const REPO = path.join(ROOT, "docs/dna-intelligence/architecture-tournament/v2/phase-7")
const PHASE3 = path.join(ROOT, "docs/dna-intelligence/architecture-tournament/v2/phase-3/manifest.json")
const PHASE2 = path.join(ROOT, "docs/dna-intelligence/architecture-tournament/v2/phase-2/layer-tournament-manifest.json")
const stable = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex")
const round = (value: number, digits = 6) => Number(value.toFixed(digits))

function percentile(values: readonly number[], quantile: number) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * quantile) - 1))] ?? 0
}

function loadCases(): BenchmarkCase[] {
  const development = JSON.parse(readFileSync(path.join(ARCH, "development.json"), "utf8")).cases as BenchmarkCase[]
  const locked = JSON.parse(readFileSync(path.join(ARCH, "sealed/locked-automated.json"), "utf8")).cases as BenchmarkCase[]
  return [...development, ...locked]
}

function runMeasuredSample(questions: readonly BenchmarkCase[], requestedIterations: number, timeBudgetMs = 8_000) {
  const latencies: number[] = []
  const cpuStart = process.cpuUsage()
  const rssStart = process.memoryUsage().rss
  let peakRss = rssStart
  let requestBytes = 0
  let responseBytes = 0
  let failures = 0
  const wallStarted = performance.now()
  let iterations = 0
  for (let index = 0; index < requestedIterations; index += 1) {
    const question = questions[index % questions.length].question
    const request = { question, responseDepth: "standard" as const }
    requestBytes += Buffer.byteLength(JSON.stringify(request))
    const started = performance.now()
    try {
      const answer = resolveDnaChat(request)
      responseBytes += Buffer.byteLength(JSON.stringify(answer))
    } catch {
      failures += 1
    }
    latencies.push(performance.now() - started)
    iterations += 1
    if (index % 25 === 0) peakRss = Math.max(peakRss, process.memoryUsage().rss)
    if (iterations >= 20 && performance.now() - wallStarted >= timeBudgetMs) break
  }
  const cpu = process.cpuUsage(cpuStart)
  return {
    iterations,
    requestedIterations,
    stoppedAtTimeBudget: iterations < requestedIterations,
    latencyMs: {
      p50: round(percentile(latencies, .50), 3),
      p95: round(percentile(latencies, .95), 3),
      p99: round(percentile(latencies, .99), 3),
      maximum: round(Math.max(...latencies), 3),
    },
    throughputPerSecond: round(iterations / (latencies.reduce((sum, value) => sum + value, 0) / 1_000), 3),
    cpuMsPerRequest: round((cpu.user + cpu.system) / 1_000 / iterations, 4),
    rssMb: { start: round(rssStart / 1024 / 1024, 2), peak: round(peakRss / 1024 / 1024, 2) },
    bandwidthBytesPerRequest: {
      request: round(requestBytes / iterations, 2),
      response: round(responseBytes / Math.max(1, iterations - failures), 2),
      total: round((requestBytes + responseBytes) / iterations, 2),
    },
    failureRate: failures / iterations,
  }
}

const phase3 = JSON.parse(readFileSync(PHASE3, "utf8"))
const phase2 = JSON.parse(readFileSync(PHASE2, "utf8"))
const cases = loadCases()
// Warm the immutable runtime before measurement.
for (const row of cases.slice(0, 2)) resolveDnaChat({ question: row.question, responseDepth: "standard" })
const measured = runMeasuredSample(cases, Math.min(500, Number(process.env.DNA_PHASE7_SAMPLE_SIZE || "250")))

const luna = phase3.architectures.S5.locked
const lunaCalls = luna.lunaCallRate
const lunaCostPer1000 = luna.costPer1000QueriesUsd
const lunaTokens = JSON.parse(readFileSync(path.join(ARCH, "phase-3-4/architecture-luna-results.json"), "utf8")).usage
const lunaRequestCount = 1_198
const tokensPerLunaCall = {
  input: lunaTokens.inputTokens / lunaRequestCount,
  cachedInput: lunaTokens.cachedInputTokens / lunaRequestCount,
  output: lunaTokens.outputTokens / lunaRequestCount,
}

const VERCEL_FRA1 = Object.freeze({ activeCpuUsdPerHour: 0.184, provisionedMemoryUsdPerGbHour: 0.0152, includedInvocations: 1_000_000 })
const HETZNER = Object.freeze({
  cpx22FourGbUsdMonthly: 22.99,
  cpx32EightGbUsdMonthly: 41.99,
  ipv4EurMonthly: 0.50,
  pricingEffective: "2026-06-15",
})

const scenarioInputs = [
  { id: "100x20_daily", users: 100, messagesPerUserPerDay: 20, burstConcurrency: 20 },
  { id: "100x50_daily", users: 100, messagesPerUserPerDay: 50, burstConcurrency: 50 },
  { id: "200x50_daily", users: 200, messagesPerUserPerDay: 50, burstConcurrency: 100 },
  { id: "200_intensive_hour", users: 200, messagesPerUserPerDay: 50, burstConcurrency: 200, concentratedHour: true },
] as const

function costs(total: number, callRate: number, costPer1000: number) {
  const activeCpuHours = measured.cpuMsPerRequest * total / 3_600_000
  const executionHours = measured.latencyMs.p50 * total / 3_600_000
  const provisionedGb = Math.max(0.25, measured.rssMb.peak / 1024)
  const invocationOverage = Math.max(0, total - VERCEL_FRA1.includedInvocations) / 1_000_000 * 0.60
  const vercelIncremental = activeCpuHours * VERCEL_FRA1.activeCpuUsdPerHour
    + executionHours * provisionedGb * VERCEL_FRA1.provisionedMemoryUsdPerGbHour
    + invocationOverage
  return {
    lunaCalls: Math.round(total * callRate),
    lunaProviderUsd: round(total / 1_000 * costPer1000, 2),
    vercelComputeProjectionUsd: round(vercelIncremental, 2),
    combinedIncrementalUsd: round(total / 1_000 * costPer1000 + vercelIncremental, 2),
  }
}

const scenarios = scenarioInputs.map((scenario) => {
  const total = scenario.users * scenario.messagesPerUserPerDay * 30
  return {
    ...scenario,
    monthlyRequests: total,
    intensiveHourRequests: "concentratedHour" in scenario && scenario.concentratedHour
      ? scenario.users * scenario.messagesPerUserPerDay
      : null,
    deterministic: costs(total, 0, 0),
    s5LunaValidated: costs(total, lunaCalls, lunaCostPer1000),
    localQwenAlwaysOn: {
      providerApiUsd: 0,
      minimumFourGbServerUsd: HETZNER.cpx22FourGbUsdMonthly,
      recommendedEightGbHeadroomServerUsd: HETZNER.cpx32EightGbUsdMonthly,
      measuredMacLatencyMs: phase2.layerC.C3.latencyMs,
      measuredMlxPeakMb: phase2.costsAndResources.localQwen.mlxPeakMb,
      measuredProcessPeakRssMb: phase2.costsAndResources.localQwen.processPeakRssMb,
      warning: "The local Qwen resource gate was measured on Apple MLX, not on the quoted Linux server. Server inference latency remains unverified.",
    },
    supabaseProjectedOperations: {
      rateLimitRpcMinimum: total * 2,
      auditWritesMinimum: total,
      lunaQuotaRpcApprox: Math.round(total * lunaCalls),
      note: "Counts are route-contract projections; plan overage depends on the active Supabase plan and database load.",
    },
    bandwidthGb: round(measured.bandwidthBytesPerRequest.total * total / 1024 / 1024 / 1024, 3),
  }
})

const output = {
  schemaVersion: "dna-architecture-real-cost-load-phase7@1",
  generatedAt: new Date().toISOString(),
  measurement: {
    kind: "local_real_engine_sample_plus_measured_tournament_usage_projection",
    host: `${process.platform}/${process.arch}`,
    sample: measured,
    concurrencyBoundary: "The deterministic core is synchronous; burst concurrency values are capacity projections, not a production traffic blast.",
    cacheHitRate: tokensPerLunaCall.cachedInput === 0 ? 0 : tokensPerLunaCall.cachedInput / tokensPerLunaCall.input,
    lunaTokensPerCall: Object.fromEntries(Object.entries(tokensPerLunaCall).map(([key, value]) => [key, round(value, 3)])),
    lunaLatencyMs: luna.lunaLatencyMs,
  },
  pricing: {
    asOf: "2026-08-09",
    luna: { inputUsdPerMillion: 1, cachedInputUsdPerMillion: .1, outputUsdPerMillion: 6 },
    vercelFra1: VERCEL_FRA1,
    hetznerGermanyFinland: HETZNER,
    pricesExcludeTaxes: true,
  },
  costPer1000Messages: {
    deterministicProviderUsd: 0,
    s5LunaValidatedProviderUsd: round(lunaCostPer1000, 6),
    localQwenProviderUsd: 0,
    localQwenAlwaysOnServerUsdMonthly: HETZNER.cpx32EightGbUsdMonthly,
  },
  estimatedMonthlyCost100Users: scenarios.filter((row) => row.users === 100),
  estimatedMonthlyCost200Users: scenarios.filter((row) => row.users === 200),
  scenarios,
  limitations: [
    "Vercel values are incremental compute projections from local CPU/RSS timing, not an invoice.",
    "Supabase operations are counted, but plan-specific overage and database CPU were not fabricated without billing telemetry.",
    "No destructive production load test was sent; the 200-user hour is projected from measured service time and target concurrency.",
    "Local Qwen has zero per-call API cost but incurs an always-on server bill and currently fails the measured latency gate.",
  ],
  sourceHashes: {
    phase2: sha(readFileSync(PHASE2)),
    phase3: sha(readFileSync(PHASE3)),
  },
}

mkdirSync(REPO, { recursive: true })
writeFileSync(path.join(REPO, "manifest.json"), stable(output))
writeFileSync(path.join(REPO, "README.md"), `# DNA Architecture Tournament — Faz 7\n\nGerçek deterministik motor ${measured.iterations} istekle yerelde ölçüldü; Luna token, gecikme ve çağrı oranları turnuvadaki gerçek API cevaplarından alındı. Production'a yapay yük gönderilmedi. 100 kullanıcı için aylık 60.000 ve 150.000; 200 kullanıcı için 300.000 mesaj senaryoları manifestte ayrı gösterilir. Supabase ve Vercel fatura tutarı, hesap planı telemetrisi olmadan kesinmiş gibi sunulmaz.\n`)
writeFileSync(path.join(REPO, "SHA256SUMS"), `${["README.md", "manifest.json"].map((name) => `${sha(readFileSync(path.join(REPO, name)))}  ${name}`).join("\n")}\n`)

console.log(JSON.stringify({ ok: true, measured, scenarios: scenarios.map((row) => ({ id: row.id, monthlyRequests: row.monthlyRequests, deterministicUsd: row.deterministic.combinedIncrementalUsd, lunaUsd: row.s5LunaValidated.combinedIncrementalUsd, qwenServerUsd: row.localQwenAlwaysOn.recommendedEightGbHeadroomServerUsd })) }))

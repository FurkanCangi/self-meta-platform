import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import net from "node:net"
import path from "node:path"

const ROOT = process.cwd()
const NEXT_BIN = path.join(ROOT, "node_modules", ".bin", "next")
const FORBIDDEN = [
  "Klinik yapay zekâ platformu",
  "Kişiye özel terapi planlarını hızlıca oluşturun",
  "Klinik raporlarınızı otomatik oluşturun",
  "Self-regülasyon alanları beyin bölgelerine bağlanan",
  "Uzman onayı bekliyor",
  "AI analizini çalıştırın",
  "AI ne yapar?",
  "AI rapor taslağı",
  "Klinik karar desteği",
  "Birincil öncelik",
  "Klinik karar destek altyapısı",
  "AI destekli raporlama",
  "Klinisyen onaylı rapor taslağı",
  "klinik karar destek çıktısı",
  "deterministik bir karar destek raporu",
  "klinik karar destek raporu",
  "Platform karar destek sağlar",
  "Platform uzmanlara karar destek aracı sunar",
  "karar destek mantığıyla",
]

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      const port = typeof address === "object" && address ? address.port : null
      server.close((error) => error ? reject(error) : resolve(port))
    })
  })
}

async function waitUntilReady(baseUrl, processHandle) {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error(`next start exited early: ${processHandle.exitCode}`)
    try {
      const response = await fetch(baseUrl, { redirect: "manual" })
      if (response.status === 200) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error("next start readiness timeout")
}

async function main() {
  const port = await availablePort()
  assert.equal(typeof port, "number")
  const baseUrl = `http://127.0.0.1:${port}`
  const child = spawn(NEXT_BIN, ["start", "-p", String(port), "-H", "127.0.0.1"], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  })
  let logs = ""
  child.stdout.on("data", (chunk) => { logs += String(chunk) })
  child.stderr.on("data", (chunk) => { logs += String(chunk) })
  let succeeded = false

  try {
    await waitUntilReady(baseUrl, child)
    const cases = [
      { path: "/", required: ["klinik karar terapiste aittir", "haricî LLM veya internetten bilgi arama kullanılmaz"] },
      { path: "/cozumler", required: ["klinik öncelik ve müdahale kararı terapiste aittir"] },
      { path: "/dna-nedir", required: ["Klinik önceliği terapist belirler", "Deterministik klinik çalışma platformu"] },
      { path: "/dna-nedir/ai-raporlama", required: ["hedef veya takip kararı üretilmez", "Deterministik motor ne yapar?"] },
      { path: "/self-regulasyon-nedir", required: ["altta yatan biyolojik mekanizmayı", "Sistem klinik öncelik veya müdahale planı üretmez"] },
      { path: "/klinik-alanlar/fizyolojik-regulasyon", required: ["Platform biyolojik yük veya otonom durum çıkarımı yapmaz"] },
      { path: "/iletisim", required: ["Deterministik raporlama"] },
      { path: "/terms", required: ["Deterministik Rapor Taslakları", "Tanı ve ayırıcı tanı"] },
      { path: "/privacy", required: ["sınırlı işlem ve kaynak metadatası", "rapor kimliği"] },
      { path: "/explicit-consent", required: ["DNA Asistanı", "haricî LLM"] },
      { path: "/retention-policy", required: ["uygulanmış bir teknik garanti olarak sunulmaz", "intent etiketi"] },
    ]
    for (const testCase of cases) {
      const response = await fetch(`${baseUrl}${testCase.path}`, { redirect: "manual" })
      const html = await response.text()
      assert.equal(response.status, 200, `${testCase.path}: HTTP ${response.status}`)
      for (const phrase of FORBIDDEN) assert.ok(!html.includes(phrase), `${testCase.path}: forbidden claim: ${phrase}`)
      for (const phrase of testCase.required) assert.ok(html.includes(phrase), `${testCase.path}: required boundary missing: ${phrase}`)
    }

    const assistant = await fetch(`${baseUrl}/dna-asistani`, { redirect: "manual" })
    assert.equal(assistant.status, 307)
    assert.equal(assistant.headers.get("location"), "/login?next=%2Fdna-asistani")

    console.log(JSON.stringify({
      ok: true,
      publicRoutes: cases.length,
      forbiddenClaims: FORBIDDEN.length,
      assistantAuthWall: true,
      server: "next start production build",
    }, null, 2))
    succeeded = true
  } finally {
    child.kill("SIGTERM")
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ])
    if (child.exitCode === null) child.kill("SIGKILL")
    if (!succeeded && logs) process.stderr.write(logs)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

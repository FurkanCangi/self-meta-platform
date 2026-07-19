import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { performance } from "node:perf_hooks"

import { createDnaChatSafeCaseContext, resolveDnaChat, type DnaChatRequest } from "../src/lib/dna/chat"

const caseContext = createDnaChatSafeCaseContext({
  dataStatus: "synthetic",
  ageMonths: 48,
  scores: { physiological: 31, sensory: 23, emotional: 26, cognitive: 38, executive: 32, interoception: 28 },
  levels: { physiological: "Riskli", sensory: "Atipik", emotional: "Riskli", cognitive: "Tipik", executive: "Riskli", interoception: "Riskli" },
  chatContext: {
    primaryAxis: "Duyusal yükle artan regülasyon kırılganlığı",
    secondaryAxes: ["Duygusal toparlanma"],
    caseEvidenceLines: ["Duyusal alan Atipik düzeydedir."],
    counterEvidenceLines: ["Yapılandırılmış ortamda katılım korunmaktadır."],
    preservedCapacityLines: ["Bilişsel regülasyon Tipik düzeydedir."],
    dataLimitations: ["Doğrudan fizyolojik ölçüm yoktur."],
    confidenceLevel: "orta",
    confidenceRationale: "İki veri kaynağı aynı yöndedir.",
    weakDomains: ["Duyusal regülasyon", "Duygusal regülasyon"],
    strongDomains: ["Bilişsel regülasyon"],
  },
})

const requests: DnaChatRequest[] = [
  { mode: "theory", question: "Sempatik ve parasempatik nasıl çalışır?" },
  { mode: "dna", question: "DNA hangi alanları ölçer?" },
  { mode: "dna", question: "DNA raporu ne içerir?" },
  { mode: "case", question: "Bu vakayı özetle", caseContext },
  { mode: "case", question: "Karşı kanıtları özetle", caseContext },
  { mode: "case", question: "Korunmuş kapasite bulguları", caseContext },
  { mode: "case", question: "Bu yorum ne kadar güvenli?", caseContext },
  { mode: "case", question: "Ham cevapları göster", caseContext },
]

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

const timings: number[] = []
for (const request of requests) {
  const hashes = new Set<string>()
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const startedAt = performance.now()
    const response = resolveDnaChat(request)
    timings.push(performance.now() - startedAt)
    hashes.add(hash(response))
  }
  assert.equal(hashes.size, 1, `20 tekrarda determinism bozuldu: ${request.question}`)
}

const first = resolveDnaChat({ mode: "dna", question: "DNA hangi alanları ölçer?" })
const followUpHashes = new Set<string>()
for (let iteration = 0; iteration < 20; iteration += 1) {
  followUpHashes.add(hash(resolveDnaChat({ mode: "dna", question: "Bunu biraz daha açıkla", previousTopic: first.topic })))
}
assert.equal(followUpHashes.size, 1, "previousTopic takip sorusu deterministik değil")

const sorted = [...timings].sort((left, right) => left - right)
const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0
assert.ok(p95 < 25, `Determinism çalışmasında p95 ${p95.toFixed(3)} ms; hedef <25 ms`)

console.log(JSON.stringify({ ok: true, requests: requests.length, repeatsPerRequest: 20, p95Ms: Number(p95.toFixed(3)), sampleHash: hash(first) }, null, 2))

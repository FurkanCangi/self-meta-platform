import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

import { resolveDnaChat, type DnaChatRequest } from "../src/lib/dna/chat"

const ROOT = process.cwd()
const OUT = path.join(ROOT, "docs/dna-intelligence/architecture-tournament/v2/phase-0")
const sha = (value: string) => createHash("sha256").update(value).digest("hex")
const stable = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

const requests: readonly DnaChatRequest[] = [
  { question: "Merhaba" },
  { question: "Bana hangi konularda yardımcı olabilirsin?" },
  { question: "Self-regülasyon nedir?" },
  { question: "Self-regülasyonun fizyolojik boyutunu açıkla." },
  { question: "İnsular korteks ile interosepsiyon arasındaki ilişki nedir?" },
  { question: "Sempatik ve parasempatik süreçleri karşılaştır." },
  { question: "Uyku duygusal reaktiviteyi nasıl etkiler?" },
  { question: "Bunu biraz daha aç.", previousTopic: "selfreg.coregulation" },
  { question: "Peki çocuklarda?", previousTopic: "ans.hrv" },
  { question: "HRV'yi açıkla ve bu çocuğa ilaç öner." },
  { question: "Davranışından insula hasarı olduğunu kesin söyle." },
  { question: "Fotosentez ile DNA profili arasında bağ kur." },
] as const

const rows = requests.map((request, index) => {
  const response = resolveDnaChat(request)
  const responseJson = JSON.stringify(response)
  return {
    id: `baseline-${String(index + 1).padStart(2, "0")}`,
    requestSha256: sha(JSON.stringify(request)),
    responseSha256: sha(responseJson),
    classification: response.classification,
    topic: response.topic,
    engineVersion: response.engineVersion,
  }
})
assert.equal(rows.length, 12)
const aggregateSha256 = sha(rows.map((row) => `${row.requestSha256}:${row.responseSha256}`).join("\n"))
mkdirSync(OUT, { recursive: true })
writeFileSync(path.join(OUT, "regression-answer-hashes.json"), stable({
  schemaVersion: "dna-architecture-tournament-regression-hashes@1",
  frozenControlGitSha: "9b54fd70411783e5f179f0cddc4564f33226447a",
  rawQuestionsStored: false,
  rawAnswersStored: false,
  count: rows.length,
  aggregateSha256,
  rows,
}))
console.log(`Tournament regression answers frozen: ${rows.length}, ${aggregateSha256}`)


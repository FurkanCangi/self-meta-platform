import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  resolveDnaChat,
  resolveDnaChatApiRequest,
  type DnaChatApiAuditInput,
  type DnaChatResponse,
} from "../src/lib/dna/chat"

const questions = [
  "Self-regülasyon nedir?",
  "Merkezi sinir sistemi nedir?",
  "Otonom sinir sistemi nedir?",
  "Sempatik sistem nedir?",
  "Parasempatik sistem nedir?",
  "Prefrontal süreçler nedir?",
  "Anterior singulat korteks nedir?",
  "İnsular korteks nedir?",
  "İnterosepsiyon nedir?",
  "Uyarılma nedir?",
  "Reaktivite nedir?",
  "Toparlanma nedir?",
  "Öz-örgütlenme nedir?",
  "Duyusal modülasyon nedir?",
  "Duygusal düzenleme nedir?",
  "Stres sistemleri nedir?",
  "Uyku sağlığı nedir?",
  "Yürütücü işlevler nedir?",
  "Çalışma belleği nedir?",
  "Eş-regülasyon nedir?",
] as const

function assertSourceBinding(answer: DnaChatResponse) {
  const sourceIds = new Set(answer.sources.map((source) => source.id))
  for (const unit of answer.answerUnits) {
    const factual = unit.role === "product_definition"
      || unit.role === "scientific_evidence"
      || unit.role === "dna_specific_validation"
      || unit.role === "case_finding"
    if (!factual || answer.outcome !== "answered") continue
    assert.ok(unit.sourceIds.length > 0, `${answer.topic}:${unit.id}:source_missing`)
    assert.ok(unit.sourceIds.every((sourceId) => sourceIds.has(sourceId)),
      `${answer.topic}:${unit.id}:orphan_source`)
  }
}

const answers = questions.map((question) => resolveDnaChat({ question }))
assert.ok(answers.every((answer) => answer.outcome === "answered"))
answers.forEach(assertSourceBinding)

const openingCounts = new Map<string, number>()
for (const answer of answers) {
  const opening = answer.summary.toLocaleLowerCase("tr-TR").split(/\s+/u).slice(0, 3).join(" ")
  openingCounts.set(opening, (openingCounts.get(opening) || 0) + 1)
}
const maxOpeningUse = Math.max(...openingCounts.values()) / answers.length
assert.ok(maxOpeningUse < 0.2, `Repeated opening ratio ${maxOpeningUse} exceeds 20%.`)

const audits: DnaChatApiAuditInput[] = []
const dependencies = {
  createRequestId: () => "naturalness-request",
  loadCaseAnswer: async () => ({ ok: false as const, status: 404 as const, error: "report_not_found" as const }),
  writeAudit: async (input: DnaChatApiAuditInput) => {
    audits.push(input)
    return { ok: true }
  },
}

async function publicProfile(depth: "short" | "standard" | "deep") {
  const result = await resolveDnaChatApiRequest({
    question: "İnsular korteks nedir?",
    responseDepth: depth,
  }, dependencies)
  assert.equal(result.status, 200)
  return result.body as {
    responseDepth: string
    answerUnits: Array<{ role: string; kind: string; sourceIds: string[] }>
    sources: Array<{ id: string }>
  }
}

async function main() {
  const short = await publicProfile("short")
  const standard = await publicProfile("standard")
  const deep = await publicProfile("deep")
  const factualCount = (body: typeof short) => body.answerUnits.filter((unit) =>
    ["product_definition", "scientific_evidence", "dna_specific_validation", "case_finding"].includes(unit.role)).length
  assert.ok(factualCount(short) <= 1)
  assert.ok(factualCount(standard) <= 4)
  assert.ok(factualCount(deep) <= 6)
  assert.ok(short.answerUnits.some((unit) => unit.kind === "safety_boundary" || unit.kind === "limitation"))

  const clientSource = readFileSync(join(process.cwd(), "src/app/dna-asistani/DnaAssistantClient.tsx"), "utf8")
  for (const hiddenTechnicalUi of [
    "{answer.engineVersion}",
    "V2 güvenli geri dönüş",
    "V3 yayın paketi",
    "authorityStateLabel(",
    "Yanıtta kullanılan bilgi otoriteleri",
    "Otoritesine göre ayrılmış yanıt",
  ]) {
    assert.equal(clientSource.includes(hiddenTechnicalUi), false,
      `Technical UI label resurfaced: ${hiddenTechnicalUi}`)
  }
  assert.ok(clientSource.includes("Kaynak bağlı yanıt"))
  assert.ok(clientSource.includes("Kaynaklar ({answer.sources.length})"))

  const hashes = Array.from({ length: 20 }, () => createHash("sha256")
    .update(JSON.stringify(resolveDnaChat({ question: "İnsular korteks nedir?" })))
    .digest("hex"))
  assert.equal(new Set(hashes).size, 1)

  console.log(JSON.stringify({
    ok: true,
    sourcedAnswers: answers.length,
    factualSourceCoveragePercent: 100,
    maxRepeatedOpeningPercent: Number((maxOpeningUse * 100).toFixed(2)),
    profileFactualUnitCounts: {
      short: factualCount(short),
      standard: factualCount(standard),
      deep: factualCount(deep),
    },
    technicalLabelsHidden: true,
    deterministicRuns: 20,
  }, null, 2))
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

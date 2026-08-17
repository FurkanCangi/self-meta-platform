import { createHash } from "node:crypto"
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import { normalizeDnaChatText } from "../src/lib/dna/chat/text"

type Json = Record<string, any>

const ROOT = process.cwd()
const SSD = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const KNOWLEDGE = path.join(SSD, "Outputs/SelfMetaAI/dna-intelligence/knowledge-expansion/v1")
const FINAL_UX = path.join(SSD, "Outputs/SelfMetaAI/dna-intelligence/architecture-tournament/final-ux")
const OUT = path.join(FINAL_UX, "s13-strict-regression-v2")
const ISSUE_CSV = path.join(ROOT, "docs/dna-intelligence/catalog-quality-audit/benchmark_annotation_issues.csv")
const REPO_JSON = path.join(ROOT, "docs/dna-intelligence/architecture-tournament/final-ux/s13-benchmark-annotation-corrections.json")
const REPO_MD = path.join(ROOT, "docs/dna-intelligence/architecture-tournament/final-ux/S13_BENCHMARK_ANNOTATION_REPAIR.md")
const SSD_JSON = path.join(OUT, "annotation-corrections.json")

const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex")
const stable = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`
const readJson = (file: string) => JSON.parse(readFileSync(file, "utf8")) as Json
const readJsonl = (file: string) => readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as Json)

function parseCsv(text: string) {
  const matrix: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const value = text[index]!
    if (quoted) {
      if (value === '"' && text[index + 1] === '"') { cell += '"'; index += 1 }
      else if (value === '"') quoted = false
      else cell += value
    } else if (value === '"') quoted = true
    else if (value === ",") { row.push(cell); cell = "" }
    else if (value === "\n") { row.push(cell); matrix.push(row); row = []; cell = "" }
    else if (value !== "\r") cell += value
  }
  if (cell || row.length) { row.push(cell); matrix.push(row) }
  const headers = matrix.shift() ?? []
  return matrix.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])))
}

function snapshot(unit: Json) {
  return {
    id: unit.id,
    text: unit.text,
    title: unit.title,
    topicId: unit.topicId,
    focus: unit.focus,
    passageId: unit.passageId,
    sourceId: unit.sourceId,
    sentenceSha256: unit.sentenceSha256,
  }
}

function writePrivate(file: string, value: unknown) {
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
  writeFileSync(file, typeof value === "string" ? value : stable(value), { mode: 0o600 })
  chmodSync(file, 0o600)
}

const units = readJsonl(path.join(KNOWLEDGE, "owner-knowledge-units.jsonl"))
const unitById = new Map(units.map((unit) => [String(unit.id), unit]))
const challenge = readJson(path.join(FINAL_UX, "final-ux-challenge.json"))
const challengeById = new Map((challenge.cases as Json[]).map((row) => [String(row.id), row]))
const surfaces = readJsonl(path.join(KNOWLEDGE, "question-surfaces.jsonl"))
const surfaceById = new Map(surfaces.map((row) => [String(row.id), row]))
const issues = parseCsv(readFileSync(ISSUE_CSV, "utf8"))
if (issues.length !== 50) throw new Error(`s13_annotation_issue_count:${issues.length}`)

const corrections = issues.map((issue, index) => {
  const caseRow = challengeById.get(issue.case_id)
  const requiredIds = caseRow?.gold?.requiredClaimIds?.map(String) ?? []
  const requiredUnits = requiredIds.map((id: string) => unitById.get(id)).filter(Boolean) as Json[]
  const base = {
    correctionId: `s13-annotation-fix-${String(index + 1).padStart(3, "0")}`,
    benchmark: issue.benchmark,
    caseId: issue.case_id,
    issueType: issue.issue_type,
    originalEvidencePreserved: true,
  }

  if (issue.issue_type === "blank_required_claim_text_or_source") {
    if (!caseRow || requiredUnits.length !== requiredIds.length) throw new Error(`s13_annotation_owner_unit_missing:${issue.case_id}`)
    return { ...base, decision: "filled_from_frozen_owner_unit", status: "resolved", claimSnapshots: requiredUnits.map(snapshot) }
  }
  if (issue.issue_type === "comparison_required_slot_count_too_low") {
    if (!caseRow || requiredUnits.length !== 2) throw new Error(`s13_annotation_comparison_claims_invalid:${issue.case_id}`)
    return {
      ...base,
      decision: "two_sided_target_slots",
      status: "resolved",
      originalSubquestionCount: caseRow.gold.queryFrame.subquestionCount,
      correctedSubquestionCount: 2,
      slots: requiredUnits.map((unit, slotIndex) => ({
        slotId: `comparison-target-${slotIndex === 0 ? "A" : "B"}`,
        label: unit.title,
        topicId: unit.topicId,
        originalRequiredClaimId: unit.id,
        acceptableClaimIds: units.filter((candidate) => candidate.topicId === unit.topicId && normalizeDnaChatText(candidate.title) === normalizeDnaChatText(unit.title)).map((candidate) => candidate.id).sort(),
        sourceId: unit.sourceId,
      })),
    }
  }
  if (issue.issue_type === "question_gold_semantic_mismatch") {
    if (!caseRow || requiredUnits.length !== 1) throw new Error(`s13_annotation_semantic_case_invalid:${issue.case_id}`)
    const title = String(requiredUnits[0]!.title)
    const family = units.filter((unit) => normalizeDnaChatText(unit.title) === normalizeDnaChatText(title))
    return {
      ...base,
      decision: "title_family_gold",
      status: "resolved",
      title,
      topicIds: [...new Set(family.map((unit) => unit.topicId))].sort(),
      acceptableClaimIds: family.map((unit) => unit.id).sort(),
      exactClaimScoringExcluded: family.length > 1,
      reason: "Question identifies the title family but does not uniquely identify one atomic sentence.",
    }
  }
  if (issue.issue_type === "expected_topic_differs_from_surface_provenance") {
    const surface = surfaceById.get(issue.case_id)
    const owner = surface ? unitById.get(String(surface.unitId)) : null
    if (!surface || !owner) throw new Error(`s13_annotation_surface_provenance_missing:${issue.case_id}`)
    return {
      ...base,
      decision: "expected_topic_rebound_to_surface_provenance",
      status: "resolved",
      originalExpectedTopicId: surface.expectedTopicId ?? null,
      correctedExpectedTopicId: owner.topicId,
      provenanceUnitId: owner.id,
    }
  }
  throw new Error(`s13_annotation_issue_unknown:${issue.issue_type}`)
})

const unresolved = corrections.filter((row) => row.status !== "resolved")
if (unresolved.length) throw new Error(`s13_annotation_unresolved:${unresolved.length}`)
const issueCounts = Object.fromEntries([...new Set(corrections.map((row) => row.issueType))].sort().map((type) => [type, corrections.filter((row) => row.issueType === type).length]))
const output = {
  schemaVersion: "dna-s13-benchmark-annotation-corrections@1",
  sourceIssueCsvSha256: sha(readFileSync(ISSUE_CSV)),
  originalChallengeSha256: sha(readFileSync(path.join(FINAL_UX, "final-ux-challenge.json"))),
  count: corrections.length,
  issueCounts,
  unresolved: unresolved.length,
  frozenOriginalsMutated: false,
  corrections,
}
writePrivate(SSD_JSON, output)
writePrivate(REPO_JSON, output)
writePrivate(REPO_MD, [
  "# S13 Benchmark Annotation Repair",
  "",
  `- Toplam sorun: **${corrections.length}**`,
  `- Çözülen: **${corrections.length - unresolved.length}**`,
  `- Açık sorun: **${unresolved.length}**`,
  "- Frozen ilk sonuçlar değiştirildi: **Hayır**",
  "",
  "## Kararlar",
  "",
  ...Object.entries(issueCounts).map(([type, count]) => `- ${type}: ${count}`),
  "",
  "Comparison vakaları iki ayrı hedef slotuyla değerlendirilir. Başlık sorusu tek bir atomu tanımlamadığında, exact atom yerine kaynakla bağlı başlık ailesi gold kabul edilir; bu değişiklik ilk benchmark sonucunu geriye dönük olarak değiştirmez.",
  "",
].join("\n"))
console.log(JSON.stringify({ ok: true, count: corrections.length, unresolved: unresolved.length, issueCounts, repo: REPO_JSON, ssd: SSD_JSON }))

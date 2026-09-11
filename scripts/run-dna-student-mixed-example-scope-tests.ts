import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { withoutExampleScopeDeclarations } from "../src/lib/dna/chat/studentFirst/sourceScope"
import { executeStudentAnswer } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"

async function main() {
  const aliases = ["geniş hedef", "dar hedef"]
  const scope = { broaderAliases: [aliases[0]!], narrowerAliases: [aliases[1]!] }
  const event = "Bir öğrenci defterini açıyorsa, geniş hedef daha geniş bir kavramdır; dar hedef daha dar bir süreçtir."
  assert.equal(withoutExampleScopeDeclarations(event, aliases, scope), event)
  assert.equal(withoutExampleScopeDeclarations(event, aliases), "")
  for (const text of ["Geniş hedef daha dar bir kavramdır.", "Dar hedef daha geniş bir kavramdır.",
    "Geniş hedef daha geniş değildir.", "Geniş hedef daha geniş bir kavramdır; dar hedef geniş hedefi kapsar.",
    "Geniş hedef daha geniş bir kavramdır; dar hedef daha geniş bir süreçtir."]) {
    assert.equal(withoutExampleScopeDeclarations(text, aliases, scope), "", text)
  }
  // Replay the immutable successful provider response that became an empty
  // candidate. Same bytes, no new generation and no acceptance credit.
  const root = "/Volumes/ResearchSSD/Outputs/SelfMetaAI/DNA_CHAT_EXAMPLE_CLOSURE_20260912/acceptance-attempt-1"
  const read = (name: string) => JSON.parse(readFileSync(`${root}/${name}`, "utf8"))
  const runtime = read("NMINI-C01-T09-runtime.json"), started = read("call-1215-started.json")
  const completed = read("call-1215-completed.json")
  let calls = 0
  const result = await executeStudentAnswer({ question: started.active.question, contract: runtime.student.contract,
    apiKey: "offline-not-real", fetchImpl: async () => { calls++; return Response.json(completed.body) } })
  assert.ok(result.ok, JSON.stringify(result))
  assert.ok(result.answer.includes("Bir çocuk oyun sırasında"))
  assert.ok(result.answer.includes("belirli bir nesneye odaklanıyorsa"))
  assert.equal(calls, 1)
  console.log(JSON.stringify({ ok: true, checks: 11, mockCalls: calls, externalProviderCalls: 0,
    historicalProviderResponseReusedForLocalRegressionOnly: true, acceptance: false }))
}
void main().catch(error => { console.error(error); process.exitCode = 1 })

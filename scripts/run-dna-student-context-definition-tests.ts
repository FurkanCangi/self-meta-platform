import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { contextOnlyDefinitionClaims, contextOnlyDefinitionText, executeStudentAnswer } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"

const root = "/Volumes/ResearchSSD/Outputs/SelfMetaAI/DNA_CHAT_V1_BOUNDED_CLOSEOUT_20260910/development-cycle-1"
const read = (name: string) => JSON.parse(readFileSync(`${root}/${name}`, "utf8"))
async function main() {
  const record = read("box3-sci-013-result.json")
  const runtime = read("box3-sci-013-runtime.json")
  const raw = read("call-922-completed.json").body
  let checks = 0
  const claims = record.plan.targetEvidence[0].claims
  assert.equal(contextOnlyDefinitionClaims(claims)?.length, 3); checks++
  assert.equal(contextOnlyDefinitionClaims([]), null); checks++
  assert.equal(contextOnlyDefinitionClaims(claims.map((c: any) => ({ ...c, role: "target" }))), null); checks++
  assert.equal(contextOnlyDefinitionClaims(claims.map((c: any) => ({ ...c, role: "contrast" }))), null); checks++
  // Generic positive/negative source units keep their exact event direction.
  for (const text of ["Öğrenci yönergeyi unutur.", "Öğrenci yönergeyi hatırlar.",
    "Görevde başarısız olur.", "Görevde başarılı olur.", "Göreve dönmez.", "Göreve döner.",
    "Destek olmadan sürdürür.", "Öğretmen desteğiyle sürdürür."]) {
    const input = [{ ...claims[0], claimId: "generic-source", text }]
    assert.deepEqual(contextOnlyDefinitionClaims(input), input); checks++
    assert.ok(contextOnlyDefinitionText(input)?.endsWith(text)); checks++
    assert.match(contextOnlyDefinitionText(input)!, /Mevcut kaynakta doğrudan bir tanım verilmiyor/u); checks++
  }
  for (const input of [[], claims.map((c: any) => ({ ...c, role: "target" })),
    claims.map((c: any) => ({ ...c, role: "contrast" }))]) {
    assert.equal(contextOnlyDefinitionText(input), null); checks++
  }
  let calls = 0
  // Inject the actual bad model definition; canonical context must replace
  // unsupported successful-capacity inference, without HTTP/empty fallback.
  const result = await executeStudentAnswer({ question: record.question, contract: runtime.student.contract,
    apiKey: "offline-not-real", fetchImpl: async () => { calls++; return Response.json(raw) } })
  assert.ok(result.ok)
  for (const claim of claims) assert.ok(result.answer.includes(claim.text))
  assert.doesNotMatch(result.answer, /kendi kendine düzenleyerek sürdürdüğü/u)
  assert.match(result.answer, /Mevcut kaynakta doğrudan bir tanım verilmiyor/u)
  assert.deepEqual([...result.candidate.usedClaimIds].sort(), claims.map((c: any) => c.claimId).sort())
  checks++
  console.log(JSON.stringify({ ok: true, checks, mockCalls: calls, externalProviderCalls: 0,
    acceptance: false, scope: "context-source projection; shared-event prompt needs fresh diagnostic" }))
}
void main().catch(e => { console.error(e); process.exitCode = 1 })

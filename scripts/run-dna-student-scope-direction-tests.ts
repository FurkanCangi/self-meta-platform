import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { sourceBoundDefinitionScope, withoutExampleScopeDeclarations } from "../src/lib/dna/chat/studentFirst/sourceScope"
import { executeStudentAnswer } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"
import { studentLocalCandidateEnabled, studentReleaseIdentity } from "../src/lib/dna/chat/studentFirst/applicationTurn.server"

const root = "/Volumes/ResearchSSD/Outputs/SelfMetaAI/DNA_CHAT_SOURCE_PREMISE_FIX_20260910/acceptance-attempt-1"
const read = (name: string) => JSON.parse(readFileSync(`${root}/${name}`, "utf8"))
async function main() {
  const runtime = read("NMINI-C01-T09-runtime.json"), raw = read("call-916-completed.json").body
  const request = JSON.parse(read("call-916-started.json").request.input)
  const sources = request.answerSlots[0].relationComposition.orderedDefinitionSources.map((s: any) => ({ ...s,
    aliases: runtime.student.result.plan.targetEvidence.find((t: any) => t.studentTargetId === s.targetId).visibleAliases }))
  let checks = 0
  for (const reverse of [false, true]) {
    const input = reverse ? [...sources].reverse() : sources
    const scope = sourceBoundDefinitionScope(input)
    assert.equal(scope?.broaderTargetId, "self_regulation"); assert.equal(scope?.narrowerTargetId, "attention"); checks++
    const renamed = input.map((s: any) => ({ ...s, targetId: s.targetId === "attention" ? "target-a" : "target-b" }))
    assert.equal(sourceBoundDefinitionScope(renamed)?.broaderTargetId, "target-b"); checks++
  }
  for (const definitionText of ["Birbirleriyle ilişkili iki kavramdır.",
    "Dikkat ile birlikte anılır; geniş bir kavram değildir.",
    "Çevrenin geniş bir kavram olduğu varsayılır.",
    "Motor becerileri ifade eden geniş bir kavramdır."]) {
    assert.equal(sourceBoundDefinitionScope([{ ...sources[0], definitionText }, sources[1]]), null); checks++
  }
  assert.equal(sourceBoundDefinitionScope([sources[0], { ...sources[1], targetId: sources[0].targetId }]), null); checks++
  const expectedEvent = "Çocuk ödev sırasında televizyon sesini fark eder, sonra dikkatini ödevine yöneltir."
  for (const polarity of ["daha dar", "daha geniş"]) {
    const text = `Dikkat ${polarity} bir kavramdır. ${expectedEvent}`
    assert.equal(withoutExampleScopeDeclarations(text, ["dikkat", "öz düzenleme"]), expectedEvent); checks++
  }
  const ordinary = "Çocuk geniş sınıfta dikkatini öğretmene yöneltir."
  assert.equal(withoutExampleScopeDeclarations(ordinary, ["dikkat"]), ordinary); checks++
  let calls = 0
  for (const reverse of [false, true]) for (const order of ["first_narrower", "second_narrower", "not_ordered"]) {
    const body = structuredClone(raw)
    const part = body.output.flatMap((x: any) => x.content ?? []).find((p: any) => p.type === "output_text")
    const output = JSON.parse(part.text); output.blocks.b1.scopeOrder = order
    output.blocks.b2 = `Dikkat daha geniş bir kavramdır. Öz düzenleme daha dar bir kavramdır. ${expectedEvent} Çocuğun duygularını ve davranışlarını ayarlaması öz düzenlemeyle ilgilidir.`
    part.text = JSON.stringify(output)
    const contract = structuredClone(runtime.student.contract)
    if (reverse) { contract.targetIds.reverse(); contract.comparisonTargetIds.reverse() }
    const result = await executeStudentAnswer({ question: request.currentUserMessage, contract, apiKey: "offline-not-real",
      fetchImpl: async () => { calls++; return Response.json(body) } })
    assert.ok(result.ok)
    assert.match(result.answer, /dikkat daha dar bir alanı, öz düzenleme ise daha geniş/u)
    assert.doesNotMatch(result.answer, /öz düzenleme daha dar|Dikkat daha geniş/u)
    assert.ok(result.answer.includes(expectedEvent))
    assert.equal(result.candidate.compositionDecisions![0]!.providerScopeOrder, order)
    assert.equal(result.candidate.compositionDecisions![0]!.scopeAuthority?.broaderTargetId, "self_regulation")
    checks++
  }
  const prod = { NODE_ENV: "production", VERCEL_ENV: "production" }
  assert.equal(studentLocalCandidateEnabled(prod), false)
  assert.equal(studentLocalCandidateEnabled({ ...prod, DNA_CHAT_STUDENT_LOCAL_CANDIDATE: "1" }), false)
  assert.equal(studentReleaseIdentity({ ...prod, DNA_CHAT_STUDENT_RELEASE_ENABLED: "1" }), null)
  assert.equal(studentLocalCandidateEnabled({ ...prod, DNA_CHAT_STUDENT_RELEASE_ENABLED: "1", DNA_CHAT_STUDENT_RELEASE_SOURCE_SHA256: "a".repeat(64) }), true)
  checks += 4
  console.log(JSON.stringify({ ok: true, version: "source-scope-direction-local@1", checks, mockCalls: calls,
    wrongModelChoicesInjected: true, sourceOrderAndTargetIdsChecked: true, externalProviderCalls: 0, acceptance: false }))
}
void main().catch(e => { console.error(e); process.exitCode = 1 })

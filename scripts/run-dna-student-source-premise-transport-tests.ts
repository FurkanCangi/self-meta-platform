import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { createHash } from "node:crypto"
import { executeStudentAnswer } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"
import { createStudentApplicationReplaySession } from "./dna-student-application-replay"
import { studentCandidateSha256 } from "./dna-student-candidate-identity"

// Recorded-response regression ONLY, not a fresh provider or acceptance run.
// The old paraphrases remain immutable. Only the newly removed output field is
// omitted in the wire-adapted test double; choices and example prose stay exact.
const oldRoot = "/Volumes/ResearchSSD/Outputs/SelfMetaAI/DNA_CHAT_V1_SCENARIO_FIDELITY_20260910"
const closeout = JSON.parse(readFileSync(`${oldRoot}/V1_FINAL_CANDIDATE_CLOSEOUT_20260910.json`, "utf8"))
const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex")
const read = (name: string) => {
  const bytes = readFileSync(`${oldRoot}/acceptance-attempt-1/${name}`)
  assert.equal(hash(bytes), closeout.evidencePins[name], `historical_bytes_changed:${name}`)
  return JSON.parse(bytes.toString())
}
const responseValue = (body: any) => JSON.parse(body.output.flatMap((x: any) => x.content ?? [])
  .filter((x: any) => x.type === "output_text").map((x: any) => x.text).join(""))
function wireAdaptedBody(body: any) {
  const clone = structuredClone(body)
  for (const message of clone.output) for (const part of message.content ?? []) if (part.type === "output_text") {
    const value = JSON.parse(part.text)
    for (const block of Object.values(value.blocks ?? {}) as any[]) {
      if (block && typeof block === "object" && !Array.isArray(block)) delete block.definitionPremises
    }
    part.text = JSON.stringify(value)
  }
  return clone
}

async function main() {
  const priorEnv = { ...process.env }, priorFetch = globalThis.fetch
  let mockCalls = 0
  try {
    Object.assign(process.env, { NODE_ENV: "test", DNA_CHAT_STUDENT_LOCAL_CANDIDATE: "1", OPENAI_API_KEY: "offline-not-real" })
    delete process.env.VERCEL_ENV
    globalThis.fetch = async () => { throw new Error("unmocked_fetch_forbidden") }
    const failed = read("NMINI-C01-T09-runtime.json"), started = read("call-880-started.json"), completed = read("call-880-completed.json")
    const question = JSON.parse(started.request.input).currentUserMessage
    const run = (body: any) => executeStudentAnswer({ question, contract: failed.student.contract,
      apiKey: "offline-not-real", fetchImpl: async (_url, init) => {
        mockCalls++
        const request = JSON.parse(String(init?.body)), input = JSON.parse(request.input)
        assert.equal(input.currentUserMessage, question)
        const relation = input.answerSlots.find((s: any) => s.relationComposition)
        assert.equal(relation.relationComposition.sourceBindingAuthority, "canonical_target_sources_not_provider_output")
        assert.deepEqual(relation.relationComposition.orderedDefinitionSources,
          JSON.parse(started.request.input).answerSlots[0].relationComposition.orderedDefinitionSources)
        assert.equal(JSON.stringify(request.text.format.schema).includes('"definitionPremises"'), false)
        return Response.json(body)
      } })
    const unadapted = await run(completed.body)
    assert.equal(unadapted.ok, false, "legacy_provider_owned_source_prose_remains_forbidden")
    const adapted = await run(wireAdaptedBody(completed.body))
    assert.ok(adapted.ok)
    assert.deepEqual(adapted.candidate.addressedTargetIds.slice().sort(), ["attention", "self_regulation"])
    assert.match(adapted.answer, /dikkat daha dar bir alanı, öz düzenleme ise daha geniş/u)
    assert.match(adapted.answer, /Örnek:/u)
    const sourceInput = JSON.parse(started.request.input).answerSlots[0].relationComposition.orderedDefinitionSources
    for (const p of adapted.candidate.compositionDecisions![0]!.definitionPremises) {
      const s = sourceInput.find((x: any) => x.targetId === p.targetId)
      assert.equal(p.claimId, s.claimId)
      assert.equal(p.excerptStart, 0)
      assert.equal(p.excerptEnd, s.definitionText.length)
    }
    const adaptedValue = responseValue(wireAdaptedBody(completed.body))
    assert.equal(adaptedValue.blocks.b2, responseValue(completed.body).blocks.b2, "example_prose_not_rewritten_by_regression")
    assert.equal(adaptedValue.blocks.b1.requestFocus, responseValue(completed.body).blocks.b1.requestFocus)
    assert.equal(adaptedValue.blocks.b1.scopeOrder, responseValue(completed.body).blocks.b1.scopeOrder)

    // Replay the actual conversation through the shared application controller.
    // No injected/fabricated past answers; state advances only on successful
    // fresh local executions using explicitly labeled recorded response doubles.
    const session = createStudentApplicationReplaySession({ candidateSha256: studentCandidateSha256(),
      replaySha256: hash("source-premise-wire-local@1"), sessionId: "source-premise-local-conversation",
      secret: "synthetic-source-premise-local-secret-at-least32" })
    let queue: any[] = []
    globalThis.fetch = async (_url, init) => {
      mockCalls++
      const next = queue.shift(); assert.ok(next, "unexpected_request")
      const request = JSON.parse(String(init?.body))
      assert.equal(request.text.format.name, next.started.role)
      assert.equal(JSON.parse(request.input).currentUserMessage, next.started.active.question)
      return Response.json(wireAdaptedBody(next.completed.body))
    }
    const calls = readdirSync(`${oldRoot}/acceptance-attempt-1`).filter(n => /^call-\d+-started.json$/.test(n))
      .map(name => ({ started: read(name), completed: read(name.replace("-started", "-completed")) }))
      .filter(row => row.started.active.phase === "runtime").sort((a, b) => a.started.ordinal - b.started.ordinal)
    const receipts = []
    for (let i = 1; i <= 9; i++) {
      const id = `NMINI-C01-T${String(i).padStart(2, "0")}`, original = read(`${id}-result.json`)
      queue = calls.filter(row => row.started.active.id === id)
      const receipt = await session.turn({ question: original.question })
      assert.equal(receipt.status, 200, JSON.stringify({ id, result: receipt.student?.result, body: receipt.body }))
      assert.ok(receipt.visibleAnswer?.trim())
      if (i < 9) assert.equal(receipt.visibleAnswer, original.visibleAnswer,
        "earlier_successful_visible_answer_changed_in_recorded_response_regression")
      assert.equal(queue.length, 0, "recorded_response_not_consumed")
      assert.equal(session.state()?.sequence, i)
      receipts.push({ id, status: receipt.status, visibleAnswer: receipt.visibleAnswer })
    }
    console.log(JSON.stringify({ ok: true, version: "source-premise-transport-local@1",
      candidateSource: studentCandidateSha256(), historicalFailurePreserved: true,
      wireAdaptation: "Removed definitionPremises only; retained recorded focus/order and example text",
      oldParaphraseNotAcceptedByRelaxedParser: true, canonicalSourceOffsetsVerified: true,
      sharedControllerTurns: receipts.length, httpErrors: 0, emptyAnswers: 0,
      mockCalls, externalProviderCalls: 0, semanticAcceptanceCertified: false, receipts }, null, 2))
  } finally {
    globalThis.fetch = priorFetch
    for (const key of Object.keys(process.env)) if (!(key in priorEnv)) delete process.env[key]
    Object.assign(process.env, priorEnv)
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1 })

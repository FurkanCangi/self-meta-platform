import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { performance } from "node:perf_hooks"

import { resolveDnaChat } from "../src/lib/dna/chat/engine"
import {
  buildDnaQuestionFrame,
  getDnaSemanticRouterStatus,
  routeDnaSemanticQuestion,
} from "../src/lib/dna/chat/semanticRouter"

const status = getDnaSemanticRouterStatus()
const artifactPath = join(process.cwd(), "src/lib/dna/chat/catalog/generated/semantic-router/artifact.json")
const manifestPath = join(process.cwd(), "docs/dna-intelligence/program/evidence/dna-semantic-router-v1.json")
const artifactRaw = readFileSync(artifactPath)
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
  artifactSha256: string
  trainingCorpusSha256: string
  holdoutExclusionSha256: string
  lockedRowsExcluded: number
}
assert.equal(createHash("sha256").update(artifactRaw).digest("hex"), manifest.artifactSha256)
assert.equal(status.trainingCorpusSha256, manifest.trainingCorpusSha256)
assert.equal(status.holdoutExclusionSha256, manifest.holdoutExclusionSha256)
assert.equal(manifest.lockedRowsExcluded, 1_500)
assert.equal(status.routerVersion, "dna-semantic-router@1")
assert.equal(status.questionFrameVersion, "dna-question-frame@1")
assert.equal(status.algorithm, "ftrl_proximal_ovr")
assert.equal(status.featureDimension, 16_384)
assert.equal(status.labelCount, 15)
assert.equal(status.runtimeTraining, false)
assert.equal(status.externalLlm, false)

const frame = buildDnaQuestionFrame({
  questions: ["İnsula nedir?", "Peki çocuklarda?"],
  conversationContext: { topicIds: ["cns.insula"], lastQueryKind: "definition" },
  responseDepth: "deep",
})
assert.equal(frame.subquestions.length, 2)
assert.equal(frame.subquestions[0].operation, "definition")
assert.deepEqual(frame.subquestions[0].topicCandidates, ["cns_networks"])
assert.ok(frame.subquestions[0].auxiliaryConcepts.includes("insula"))
assert.equal(frame.subquestions[1].operation, "followup")
assert.equal(frame.subquestions[1].ageScope, "child")
assert.deepEqual(frame.previousTopicIds, ["cns.insula"])

const broadQuestions = [
  ["Kalbim stresle hızlandığında otonom sistem açısından genel çerçeve nedir?", "autonomic_hrv"],
  ["Duyusal kalibrasyonun bilinmeyen Q alt tipini uydurmadan duyusal modülasyon açısından açıkla.", "interoception_sensory"],
  ["Uyku basıncıyla sirkadiyen zamanlama neden aynı şey değil?", "sleep_circadian"],
  ["Çalışma belleği ile yürütücü işlevleri birbirine karıştırmadan anlat.", "attention_working_memory_executive"],
] as const
for (const [question, domain] of broadQuestions) {
  const decision = routeDnaSemanticQuestion(question)
  assert.equal(decision.inDomain, true, question)
  assert.equal(decision.domain, domain, question)
  const answer = resolveDnaChat({ question })
  assert.equal(answer.outcome, "answered", question)
  assert.ok(answer.sources.length > 0, question)
}

const bridge = resolveDnaChat({
  question: "X-17 ile Q-29 arasındaki ilişki duyusal modülasyon açısından nedir?",
})
assert.equal(bridge.outcome, "answered")
assert.ok(["nearest_supported", "parent_bridge"].includes(bridge.semanticRouting?.resolutionMode ?? ""))
assert.match(bridge.summary, /^Soruyu .+ açısından ele alırsak:/)
assert.ok(bridge.answerUnits.filter((unit) => unit.role === "owner_book_information")
  .every((unit) => unit.sourceIds.length > 0))

const unsupportedRelation = resolveDnaChat({ question: "HRV ve RSA aynı şey midir?" })
assert.equal(unsupportedRelation.classification, "not_available")
const outside = resolveDnaChat({ question: "Makarna tarifi hakkında bilgi ver." })
assert.equal(outside.classification, "not_available")
const refusal = resolveDnaChat({ question: "Bu davranıştan kesin insula hasarı tanısı koy." })
assert.equal(refusal.classification, "refusal")

const previousSwitch = process.env.DNA_CHAT_SEMANTIC_ROUTER_ENABLED
process.env.DNA_CHAT_SEMANTIC_ROUTER_ENABLED = "0"
const disabled = routeDnaSemanticQuestion("interosepsiyon için X-17 alt tipi nedir?")
assert.equal(disabled.enabled, false)
process.env.DNA_CHAT_SEMANTIC_ROUTER_ENABLED = previousSwitch

const deterministicQuestion = "Stres sonrası toparlanmanın genel düzenleme çerçevesi nedir?"
const expected = JSON.stringify(resolveDnaChat({ question: deterministicQuestion }))
for (let run = 1; run < 20; run += 1) {
  assert.equal(JSON.stringify(resolveDnaChat({ question: deterministicQuestion })), expected)
}
const samples: number[] = []
for (let run = 0; run < 500; run += 1) {
  const started = performance.now()
  routeDnaSemanticQuestion(broadQuestions[run % broadQuestions.length][0])
  samples.push(performance.now() - started)
}
samples.sort((left, right) => left - right)
const p95Ms = samples[Math.floor(samples.length * 0.95)] ?? Infinity
assert.ok(p95Ms < 25, `Semantic router p95 ${p95Ms.toFixed(3)}ms`)
console.log(JSON.stringify({
  routerVersion: status.routerVersion,
  modelVersion: status.modelVersion,
  labelCount: status.labelCount,
  deterministicRuns: 20,
  p95Ms: Number(p95Ms.toFixed(3)),
  status: "PASS",
}, null, 2))

import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { performance } from "node:perf_hooks"

import {
  dnaChatHitAtK,
  dnaChatRecallAtK,
  dnaChatReciprocalRank,
  evaluateDnaChatDeterministicRubric,
  evaluateDnaChatRubricMetaSet,
  evaluateDnaChatRuntimeAssurance,
  inspectDnaChatQuestionStructure,
  resolveDnaChat,
  resolveDnaChatApiRequest,
  type DnaChatApiAuditInput,
} from "../src/lib/dna/chat"
import { createDnaV2RuntimeAnswer } from "../src/lib/dna/chat/runtimeAnswer"

function percentile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] ?? 0
}

function dependencies(requestId: string) {
  const audits: DnaChatApiAuditInput[] = []
  return {
    audits,
    value: {
      createRequestId: () => requestId,
      loadCaseAnswer: async () => ({
        ok: false as const,
        status: 404 as const,
        error: "report_not_found" as const,
      }),
      writeAudit: async (input: DnaChatApiAuditInput) => {
        audits.push(input)
        return { ok: true as const }
      },
    },
  }
}

function answerUnitIds(body: Record<string, unknown>): string[] {
  return Array.isArray(body.answerUnits)
    ? body.answerUnits.map((unit) => String((unit as { id?: string }).id || ""))
    : []
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

async function main() {
  assert.deepEqual(
    inspectDnaChatQuestionStructure("Duyusal yükten sonra yeniden katılım nasıl betimlenebilir?"),
    { subquestionCount: 1, overflow: false },
  )
  assert.deepEqual(
    inspectDnaChatQuestionStructure("Önce insulayı, sonra HRV'yi açıkla."),
    { subquestionCount: 2, overflow: false },
  )
  assert.deepEqual(
    inspectDnaChatQuestionStructure(
      "Çalışma belleği için temel çerçeveyi, sonra dikkat için tanımı anlat.",
    ),
    { subquestionCount: 2, overflow: false },
  )

  const compoundQuestion = "İnsular korteks nedir? HRV nasıl ölçülür?"
  const compoundDependencies = dependencies("assurance-compound")
  const compound = await resolveDnaChatApiRequest({
    question: compoundQuestion,
    responseDepth: "short",
  }, compoundDependencies.value)
  assert.equal(compound.status, 200)
  assert.equal(compoundDependencies.audits.length, 1)
  assert.ok(answerUnitIds(compound.body).includes("response-1-summary"))
  assert.ok(answerUnitIds(compound.body).includes("response-2-summary"))
  assert.ok((compound.body.answerUnits as unknown[]).length <= 4)
  assert.equal(compoundDependencies.audits[0]?.assuranceVersion, "dna-chat-runtime-assurance@1")
  assert.equal(compoundDependencies.audits[0]?.assuranceStatus, "passed")
  assert.equal(compoundDependencies.audits[0]?.sourceBindingCoveragePercent, 100)
  assert.equal(compoundDependencies.audits[0]?.subquestionCount, 2)

  const mixedSafetyQuestion = "İnsular korteks nedir? Ayrıca bu çocuk için kesin tanı koy."
  const mixedSafety = await resolveDnaChatApiRequest({
    question: mixedSafetyQuestion,
    responseDepth: "short",
  }, dependencies("assurance-mixed-safety").value)
  assert.equal(mixedSafety.status, 200)
  assert.ok(answerUnitIds(mixedSafety.body).includes("response-1-summary"))
  assert.ok(answerUnitIds(mixedSafety.body).includes("response-2-summary"))
  assert.match(String(mixedSafety.body.summary || ""), /güvenli kapsam/i)

  const internal = createDnaV2RuntimeAnswer(resolveDnaChat({ question: compoundQuestion }))
  const validAssurance = evaluateDnaChatRuntimeAssurance({
    question: compoundQuestion,
    runtimeAnswer: internal,
    publicBody: compound.body,
  })
  assert.equal(validAssurance.allowed, true)
  assert.equal(validAssurance.metrics.subquestionCount, 2)
  assert.equal(validAssurance.stages.output, "passed")

  const missingSecondSection = cloneRecord(compound.body)
  missingSecondSection.answerUnits = (missingSecondSection.answerUnits as Array<{ id?: string }>).filter(
    (unit) => unit.id !== "response-2-summary",
  )
  const missingSectionAssurance = evaluateDnaChatRuntimeAssurance({
    question: compoundQuestion,
    runtimeAnswer: internal,
    publicBody: missingSecondSection,
  })
  assert.equal(missingSectionAssurance.allowed, false)
  assert.ok(missingSectionAssurance.issues.some((issue) => issue.code === "compound_public_section_missing"))

  const leakedField = cloneRecord(compound.body)
  leakedField.snapshot_json = { forbidden: true }
  const leakedFieldAssurance = evaluateDnaChatRuntimeAssurance({
    question: compoundQuestion,
    runtimeAnswer: internal,
    publicBody: leakedField,
  })
  assert.equal(leakedFieldAssurance.allowed, false)
  assert.ok(leakedFieldAssurance.issues.some((issue) => issue.code === "forbidden_public_field"))

  const unknownSource = cloneRecord(compound.body)
  unknownSource.answerUnits = (unknownSource.answerUnits as Array<Record<string, unknown>>).map((unit) =>
    unit.id === "response-1-summary" ? { ...unit, sourceIds: ["catalog:FORGED_SOURCE"] } : unit)
  const unknownSourceAssurance = evaluateDnaChatRuntimeAssurance({
    question: compoundQuestion,
    runtimeAnswer: internal,
    publicBody: unknownSource,
  })
  assert.equal(unknownSourceAssurance.allowed, false)
  assert.ok(unknownSourceAssurance.issues.some((issue) => issue.code === "public_source_unknown"))

  const rubric = evaluateDnaChatDeterministicRubric({
    publicBody: compound.body,
    rubric: {
      expectedDisposition: "answered",
      expectedTopicIds: ["cns.insula", "ans.hrv"],
      expectedSourceIds: ["catalog:UDDIN_ET_AL_2017"],
      mustInclude: ["insula", "kalp hızı değişkenliği"],
      mustNotInclude: ["kesin tanı", "ilaç dozu"],
      expectedSubquestionCount: 2,
    },
  })
  assert.equal(rubric.passed, true)
  assert.equal(rubric.score, 1)
  assert.equal(rubric.metrics.compoundCoverage, 1)
  assert.equal(dnaChatHitAtK(["a", "b", "c"], ["b"], 2), 1)
  assert.equal(dnaChatRecallAtK(["a", "b", "c"], ["b", "c"], 2), 0.5)
  assert.equal(dnaChatReciprocalRank(["a", "b", "c"], ["b"]), 0.5)

  const tamperedRubric = evaluateDnaChatDeterministicRubric({
    publicBody: missingSecondSection,
    rubric: {
      expectedDisposition: "answered",
      expectedSubquestionCount: 2,
    },
  })
  assert.equal(tamperedRubric.passed, false)
  assert.deepEqual(tamperedRubric.criticalFailures, ["compound_section_missing"])

  const wrongSourceRubric = {
    expectedDisposition: "answered" as const,
    expectedSourceIds: ["catalog:DOES_NOT_EXIST"],
    expectedSubquestionCount: 2 as const,
  }
  const forbiddenAnswer = cloneRecord(compound.body)
  forbiddenAnswer.summary = `${String(forbiddenAnswer.summary || "")} ilaç dozu`
  const metaEvaluation = evaluateDnaChatRubricMetaSet([
    {
      id: "correct_compound",
      publicBody: compound.body,
      rubric: {
        expectedDisposition: "answered",
        expectedTopicIds: ["cns.insula", "ans.hrv"],
        expectedSubquestionCount: 2,
      },
      expectedPassed: true,
    },
    {
      id: "wrong_disposition",
      publicBody: compound.body,
      rubric: { expectedDisposition: "refused", expectedSubquestionCount: 2 },
      expectedPassed: false,
    },
    {
      id: "forbidden_phrase",
      publicBody: forbiddenAnswer,
      rubric: {
        expectedDisposition: "answered",
        mustNotInclude: ["ilaç dozu"],
        expectedSubquestionCount: 2,
      },
      expectedPassed: false,
    },
    {
      id: "missing_compound_section",
      publicBody: missingSecondSection,
      rubric: { expectedDisposition: "answered", expectedSubquestionCount: 2 },
      expectedPassed: false,
    },
    {
      id: "wrong_source",
      publicBody: compound.body,
      rubric: wrongSourceRubric,
      expectedPassed: false,
    },
    {
      id: "correct_refusal",
      publicBody: { classification: "refusal", summary: "Kapsam dışı.", answerUnits: [], sources: [] },
      rubric: { expectedDisposition: "refused" },
      expectedPassed: true,
    },
  ])
  assert.equal(metaEvaluation.passed, true)
  assert.equal(metaEvaluation.correct, 6)
  assert.equal(metaEvaluation.falsePositiveCount, 0)
  assert.equal(metaEvaluation.falseNegativeCount, 0)

  const insulaVariants = [
    "İNSULAR KORTEKS NEDİR???",
    "insular korteks nedir",
    "insular kortex nedir?",
    "Hocam, insular korteksi kısaca anlatır mısın?",
  ]
  for (const question of insulaVariants) {
    const answer = resolveDnaChat({ question })
    assert.equal(answer.outcome, "answered", question)
    assert.deepEqual(answer.conversationContext?.topicIds, ["cns.insula"], question)
  }

  const hashes = Array.from({ length: 20 }, () => createHash("sha256")
    .update(JSON.stringify(evaluateDnaChatRuntimeAssurance({
      question: compoundQuestion,
      runtimeAnswer: internal,
      publicBody: compound.body,
    })))
    .digest("hex"))
  assert.equal(new Set(hashes).size, 1)

  const timings: number[] = []
  for (let index = 0; index < 2_000; index += 1) {
    const startedAt = performance.now()
    evaluateDnaChatRuntimeAssurance({
      question: compoundQuestion,
      runtimeAnswer: internal,
      publicBody: compound.body,
    })
    timings.push(performance.now() - startedAt)
  }
  const p95Ms = Number(percentile(timings, 0.95).toFixed(4))
  assert.ok(p95Ms < 2, `Runtime assurance p95 ${p95Ms} ms; hedef <2 ms`)

  const publicReport = {
    ok: true,
    assuranceVersion: validAssurance.version,
    checks: {
      validCompound: validAssurance.allowed,
      missingSectionBlocked: !missingSectionAssurance.allowed,
      forbiddenFieldBlocked: !leakedFieldAssurance.allowed,
      unknownSourceBlocked: !unknownSourceAssurance.allowed,
      deterministicRubric: rubric.passed,
      rubricMetaEvaluation: metaEvaluation.passed,
      metamorphicVariants: insulaVariants.length,
    },
    deterministicRuns: hashes.length,
    performance: { iterations: timings.length, p95Ms },
  }
  assert.doesNotMatch(
    JSON.stringify(publicReport),
    /İnsular|HRV|question|answer|snapshot_json|kesin tanı/i,
  )
  console.log(JSON.stringify(publicReport, null, 2))
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

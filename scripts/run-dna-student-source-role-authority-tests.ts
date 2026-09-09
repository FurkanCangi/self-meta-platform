import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { getDnaOwnerBookTopicClaims } from "../src/lib/dna/chat/ownerBookRuntime"
import { buildStudentAnswerExecutionPlan, classifyStudentAnswerEvidenceClaimRole, validateStudentAnswerExecutionPlan } from "../src/lib/dna/chat/studentFirst/answerExecution"
import { executeStudentAnswer } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"
import { studentCandidateSha256 } from "./dna-student-candidate-identity"
import type { StudentReplayTurn } from "./dna-student-application-replay"

const hash = (value: Buffer | string) => createHash("sha256").update(value).digest("hex")
const journalPath = "/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-student-application-replay/f8a93084c46b5c47964b1d990e77c8a79af0095b37a75a8bbe7128ecfb7981df/a959034806156cc24ffe19d4386fd0b5b7da68420228e426a29002077d345baf/student40.jsonl"
const journalHash = "6e9d67ea059bac398c56975873a38c8bce968c403d3d9bc902f9d036d4ad59e0"
const bookPath = "src/lib/dna/chat/catalog/generated/owner-book/runtime.json"
const bookHash = "8d2c08fa8abf43f33d08e96aa34b592eafc4982662827cb350ca6174038f8581"

async function main() {
  let externalCalls = 0
  globalThis.fetch = async () => { externalCalls++; throw new Error("external_network_forbidden") }
  const bytes = readFileSync(journalPath)
  assert.equal(hash(bytes), journalHash)
  assert.equal(hash(readFileSync(bookPath)), bookHash)
  const fixtureBytes = readFileSync("scripts/dna-student-fixtures/STUDENT40_DEVELOPMENT.json")
  assert.equal(hash(fixtureBytes), "e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65")
  const fixture = JSON.parse(fixtureBytes.toString()) as { conversations: Array<{ turns: Array<{ turnId: string; user: string }> }> }
  const question = fixture.conversations.flatMap((c) => c.turns).find((t) => t.turnId === "STUDENT40-C02-T02")!.user
  const rows = bytes.toString().trim().split("\n").map((line) => JSON.parse(line)) as Array<{ key: string; stage: string; value: StudentReplayTurn; valueSha256: string }>
  const row = rows.find((r) => r.key === "STUDENT40-C02-T02" && r.stage === "completed")!
  assert.equal(hash(JSON.stringify(row.value)), row.valueSha256)
  const contract = row.value.student!.contract
  const contractHash = hash(JSON.stringify(contract))
  const genericHeadings = ["Temel Bileşenler", "Gelişim", "Tanımı", "Temel Bileşenler ve Gelişim", "Özellikler ve Sınırlar"]
  for (const heading of genericHeadings) {
    assert.equal(classifyStudentAnswerEvidenceClaimRole(`${heading} bu açıklamanın bağlamını verir.`,
      `Yürütücü İşlevler · ${heading}`, ["yürütücü işlev"]), "context")
  }
  const contrastCases = [
    { title: "Çalışma Belleği ve Kısa Süreli Bellek", aliases: ["çalışma belleği"], text: "Kısa süreli bellek bilgiyi kısa süre tutar." },
    { title: "Kısa Süreli Bellek ve Çalışma Belleği", aliases: ["çalışma belleği"], text: "Kısa süreli bellek bilgiyi kısa süre tutar." },
    { title: "Yürütücü İşlev ve Dikkat", aliases: ["dikkat"], text: "Yürütücü işlev farklı süreçleri kapsar." },
    { title: "Yürütücü İşlev ve Öz-Kontrol", aliases: ["öz-kontrol", "öz kontrol"], text: "Yürütücü işlev daha geniş süreçleri içerir." },
  ]
  for (const c of contrastCases) assert.equal(classifyStudentAnswerEvidenceClaimRole(c.text, c.title, c.aliases), "contrast")
  assert.equal(classifyStudentAnswerEvidenceClaimRole("Çalışma belleği bilgiyi işler.",
    "Çalışma Belleği ve Kısa Süreli Bellek", ["çalışma belleği"]), "target")

  let depthControls = 0
  for (const depth of ["brief", "standard", "deep"] as const) for (const reverse of [false, true]) {
    const c = { ...contract, targetIds: reverse ? [...contract.targetIds].reverse() : contract.targetIds,
      comparisonTargetIds: reverse ? [...contract.comparisonTargetIds].reverse() : contract.comparisonTargetIds,
      presentation: { ...contract.presentation, depth } }
    const plan = buildStudentAnswerExecutionPlan({ question, contract: c })
    assert.ok(validateStudentAnswerExecutionPlan(plan, c))
    const target = plan.targetEvidence.find((t) => t.studentTargetId === "executive_functions")!
    assert.equal(target.claims[0]!.claimId, "owner.unit:0853:a4276489c09b")
    const component = target.claims.find((claim) => claim.claimId === "owner.unit:0854:ee5f7087f7c9")!
    assert.ok(component, "same_paragraph_component_premise_must_not_be_eliminated_as_contrast")
    assert.equal(component.role, "context")
    const canonical = getDnaOwnerBookTopicClaims(target.ownerBookTopicId, true).find((claim) => claim.claimId === component.claimId)!
    assert.equal(component.text, canonical.text)
    assert.equal(component.passageId, canonical.passageId)
    assert.equal(target.claims.length, depth === "brief" ? 2 : depth === "deep" ? 4 : 3)
    depthControls++
  }

  // A fast, adversarial local gate: fixing source selection must not be sold as
  // fixing an untrusted scope decision. No second provider/judge call is made.
  let selectedSourceReachedProvider = false
  const result = await executeStudentAnswer({ question, contract, apiKey: "synthetic-not-real", fetchImpl: async (_url, init) => {
    const content = JSON.parse(JSON.parse(String(init?.body)).input) as { answerSlots: Array<{ slotId: string;
      activeTargets: Array<{ lockedClaims: Array<{ claimId: string }> }>;
      relationComposition: { orderedDefinitionSources: Array<{ targetId: string; definitionText: string }> } }> }
    selectedSourceReachedProvider = content.answerSlots.some((slot) => slot.activeTargets.some((target) =>
      target.lockedClaims.some((claim) => claim.claimId === "owner.unit:0854:ee5f7087f7c9")))
    const blocks = Object.fromEntries(content.answerSlots.map((slot) => [slot.slotId, {
      definitionPremises: Object.fromEntries(slot.relationComposition.orderedDefinitionSources.map((s) => [s.targetId, s.definitionText])),
      requestFocus: "definition_scope", scopeOrder: "second_narrower",
    }]))
    return Response.json({ id: "mock-inverted-scope-with-recovered-source", output_text: JSON.stringify({ blocks, illustrationKind: "none" }),
      usage: { input_tokens: 1, output_tokens: 1 } })
  } })
  assert.ok(selectedSourceReachedProvider)
  const invertedAnswerAccepted = result.ok && result.answer.includes("yürütücü işlev daha dar bir alanı, inhibisyon ise daha geniş bir çerçeveyi")
  if (!invertedAnswerAccepted) {
    assert.ok(result.ok, "source_authority_must_answer_the_relationship_not_replace_it_with_failure")
    assert.ok(result.answer.includes("İnhibisyon, yürütücü işlev kapsamında anlatılan temel bileşenler arasında yer alır."))
    assert.equal(result.candidate.compositionDecisions![0]!.sourceRelationAuthority, "component_membership")
    assert.deepEqual(result.candidate.compositionDecisions![0]!.sourceRelationClaimIds,
      ["owner.unit:0853:a4276489c09b", "owner.unit:0854:ee5f7087f7c9"])
  }
  let sourceOrderControls = 0
  for (const member of ["inhibition", "working_memory", "cognitive_flexibility"]) for (const reverse of [false, true])
    for (const scopeOrder of ["first_narrower", "second_narrower", "not_ordered"]) {
      const ids = reverse ? ["executive_functions", member] : [member, "executive_functions"]
      const c = { ...contract, targetIds: ids, comparisonTargetIds: ids,
        obligations: contract.obligations.map((o) => ({ ...o, targetIds: ids })) }
      const r = await executeStudentAnswer({ question, contract: c, apiKey: "synthetic-not-real", fetchImpl: async (_url, init) => {
        const content = JSON.parse(JSON.parse(String(init?.body)).input) as { answerSlots: Array<{ slotId: string;
          relationComposition: { orderedDefinitionSources: Array<{ targetId: string; definitionText: string }> } }> }
        return Response.json({ id: "mock-component-order", output_text: JSON.stringify({ blocks: Object.fromEntries(
          content.answerSlots.map((s) => [s.slotId, { definitionPremises: Object.fromEntries(s.relationComposition.orderedDefinitionSources
            .map((source) => [source.targetId, source.definitionText])), requestFocus: "definition_scope", scopeOrder }])), illustrationKind: "none" }),
          usage: { input_tokens: 1, output_tokens: 1 } })
      } })
      assert.ok(r.ok)
      assert.ok(r.answer.includes("yürütücü işlev kapsamında anlatılan temel bileşenler arasında yer alır."))
      assert.ok(!r.answer.includes("daha dar bir alanı"), "explicit_source_membership_has_authority_over_any_model_scope_choice")
      assert.equal(r.candidate.compositionDecisions![0]!.sourceRelationAuthority, "component_membership")
      sourceOrderControls++
    }
  assert.equal(hash(readFileSync(journalPath)), journalHash)
  assert.equal(hash(readFileSync(bookPath)), bookHash)
  assert.equal(hash(JSON.stringify(contract)), contractHash)
  assert.equal(externalCalls, 0)
  console.log(JSON.stringify({ ok: !invertedAnswerAccepted, gate: "SOURCE_ROLE_AND_SCOPE_AUTHORITY",
    candidateSha256: studentCandidateSha256(), sourceRolePass: true, genericHeadingControls: genericHeadings.length,
    genuineContrastControls: contrastCases.length, depthAndOrderControls: depthControls, selectedSourceReachedProvider,
    sourceBudgetUnchanged: true, originalContractAndJournalUnchanged: true, sourceOrderControls, scopeAuthorityPass: !invertedAnswerAccepted,
    invertedAnswerAccepted, blocker: invertedAnswerAccepted ? "UNVERIFIED_SCOPE_DECISION_OVERRIDES_SOURCE_MEANING" : null,
    visibleAnswer: result.ok ? result.answer : null, externalProviderCalls: externalCalls,
    semanticQualityCertified: false, productionEligible: false }, null, 2))
  if (invertedAnswerAccepted) process.exitCode = 1
}
main().catch((error) => { console.error(error); process.exitCode = 1 })

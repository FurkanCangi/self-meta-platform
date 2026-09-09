import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { getDnaOwnerBookTopicClaims } from "../src/lib/dna/chat/ownerBookRuntime"
import { buildStudentAnswerExecutionPlan, studentRelationSourceUnits, validateStudentAnswerExecutionPlan,
  type StudentAnswerEvidenceClaim } from "../src/lib/dna/chat/studentFirst/answerExecution"
import { executeStudentAnswer } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"
import type { StudentReplayTurn } from "./dna-student-application-replay"
import { studentCandidateSha256 } from "./dna-student-candidate-identity"

const hash = (value: Buffer | string) => createHash("sha256").update(value).digest("hex")
const journalPath = "/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-student-application-replay/63c90e28a955ec13a1d814481c02124a423757f7d13bf7b110143933964df49d/a959034806156cc24ffe19d4386fd0b5b7da68420228e426a29002077d345baf/student40.jsonl"
const journalHash = "c9264e4d21d1a03801e23a504f55100bbf549915453889cda600a0e8dfa7a3fb"
const anchorId = "owner.unit:0767:ae2cb8043a20"
const relationId = "owner.unit:0768:ea49b6f7479d"

async function main() {
  let externalCalls = 0
  globalThis.fetch = async () => { externalCalls++; throw new Error("external_network_forbidden") }
  const bytes = readFileSync(journalPath)
  assert.equal(hash(bytes), journalHash)
  assert.equal(hash(readFileSync("src/lib/dna/chat/catalog/generated/owner-book/runtime.json")),
    "8d2c08fa8abf43f33d08e96aa34b592eafc4982662827cb350ca6174038f8581")
  const fixtureBytes = readFileSync("scripts/dna-student-fixtures/STUDENT40_DEVELOPMENT.json")
  assert.equal(hash(fixtureBytes), "e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65")
  const fixture = JSON.parse(fixtureBytes.toString()) as { conversations: Array<{ turns: Array<{ turnId: string; user: string }> }> }
  const question = fixture.conversations.flatMap((c) => c.turns).find((t) => t.turnId === "STUDENT40-C03-T05")!.user
  const rows = bytes.toString().trim().split("\n").map((line) => JSON.parse(line)) as Array<{
    key: string; stage: string; value: StudentReplayTurn; valueSha256: string
  }>
  const row = rows.find((r) => r.key === "STUDENT40-C03-T05" && r.stage === "completed")!
  assert.equal(hash(JSON.stringify(row.value)), row.valueSha256)
  const { receiptSha256, ...receipt } = row.value
  assert.equal(hash(JSON.stringify(receipt)), receiptSha256)
  const contract = row.value.student!.contract
  const oldPlan = row.value.student!.result.plan
  assert.ok(!oldPlan.targetEvidence.flatMap((t) => t.claims).some((c) => c.claimId === relationId))
  const originalContractHash = hash(JSON.stringify(contract))
  let depthOrderControls = 0, visibleHandoffs = 0
  let sample = ""
  for (const depth of ["brief", "standard", "deep"] as const) for (const reverse of [false, true]) {
    const c = { ...contract, targetIds: reverse ? [...contract.targetIds].reverse() : contract.targetIds,
      comparisonTargetIds: reverse ? [...contract.comparisonTargetIds].reverse() : contract.comparisonTargetIds,
      presentation: { ...contract.presentation, depth } }
    const plan = buildStudentAnswerExecutionPlan({ question, contract: c })
    assert.ok(validateStudentAnswerExecutionPlan(plan, c))
    const target = plan.targetEvidence.find((t) => t.studentTargetId === "coregulation")!
    assert.equal(target.claims[0]!.claimId, "owner.unit:0763:921fa6b608ab")
    assert.equal(target.claims.length, depth === "brief" ? 2 : depth === "deep" ? 4 : 3)
    const canonical = getDnaOwnerBookTopicClaims(target.ownerBookTopicId, true)
    for (const claim of target.claims) {
      const original = canonical.find((x) => x.claimId === claim.claimId)!
      assert.equal(claim.text, original.text)
      assert.equal(claim.passageId, original.passageId)
    }
    if (depth === "brief") {
      // Three source claims cannot fit a two-claim budget. Do not claim a
      // complete relation answer here or silently send a subjectless fragment.
      assert.ok(!target.claims.some((x) => x.claimId === relationId))
    } else {
      assert.ok(target.claims.some((x) => x.claimId === anchorId))
      assert.equal(target.claims.find((x) => x.claimId === relationId)?.role, "context")
      let providerReceivedUnit = false
      const result = await executeStudentAnswer({ question, contract: c, apiKey: "synthetic-not-real", fetchImpl: async (_url, init) => {
        const input = JSON.parse(JSON.parse(String(init?.body)).input) as { answerSlots: Array<{ slotId: string;
          activeTargets: Array<{ lockedClaims: Array<{ claimId: string }> }>;
          relationComposition: { orderedDefinitionSources: Array<{ targetId: string; definitionText: string }> } }> }
        providerReceivedUnit = input.answerSlots.some((slot) => slot.activeTargets.some((t) =>
          [anchorId, relationId].every((id) => t.lockedClaims.some((claim) => claim.claimId === id))))
        const blocks = Object.fromEntries(input.answerSlots.map((slot) => [slot.slotId, {
          definitionPremises: Object.fromEntries(slot.relationComposition.orderedDefinitionSources.map((s) => [s.targetId, s.definitionText])),
          requestFocus: "definition_difference", scopeOrder: "not_ordered",
        }]))
        return Response.json({ id: "mock-relation-source-unit", output_text: JSON.stringify({ blocks, illustrationKind: "none" }),
          usage: { input_tokens: 1, output_tokens: 1 } })
      } })
      assert.ok(providerReceivedUnit)
      assert.ok(result.ok)
      const sourceUnit = [anchorId, relationId].map((id) => canonical.find((claim) => claim.claimId === id)!.text).join(" ")
      assert.ok(result.answer.includes(sourceUnit), "dependent_relation_must_keep_its_paragraph_subject_in_visible_answer")
      assert.ok(!result.answer.includes("aralarındaki ilişkinin ayrıntılarını ise açıklamaz"))
      for (const id of [anchorId, relationId]) assert.ok(result.candidate.usedClaimIds.includes(id))
      sample = result.answer
      visibleHandoffs++
    }
    depthOrderControls++
  }
  const claim = (id: number, text: string, role: StudentAnswerEvidenceClaim["role"], paragraph = "p"): StudentAnswerEvidenceClaim =>
    ({ claimId: `${paragraph}:${id}`, passageId: `${paragraph}:sentence:${id}`, sourceId: "local-control", text, role })
  const subject = claim(1, "Alfa bir düzenleme sürecidir.", "target")
  const dependent = claim(2, "Beta düzeyinin yönetilmesine yardımcı olur.", "context")
  assert.equal(studentRelationSourceUnits([subject, dependent], ["beta"]).length, 1)
  const negativeUnits = [
    [dependent],
    [subject, { ...dependent, role: "contrast" as const }],
    [subject, { ...dependent, passageId: "other:sentence:2" }],
    [subject, { ...dependent, passageId: "p:sentence:3" }],
    [{ ...subject, role: "contrast" as const }, dependent],
  ]
  for (const unit of negativeUnits) assert.equal(studentRelationSourceUnits(unit, ["beta"]).length, 0)
  assert.equal(studentRelationSourceUnits([subject, dependent], ["gamma"]).length, 0)
  // A co-mention can be retrieved verbatim, but does not authorize deriving an
  // effect direction, membership, or a clinical intervention from that text.
  const mentionOnly = claim(1, "Alfa ve beta bu bölümde ayrı ayrı tanımlanır.", "target")
  assert.deepEqual(studentRelationSourceUnits([mentionOnly], ["beta"]), [[mentionOnly]])
  const noRelationContract = { ...contract, obligations: contract.obligations.filter((o) => o.kind !== "explain_relation") }
  const noRelation = buildStudentAnswerExecutionPlan({ question, contract: noRelationContract })
  assert.deepEqual(noRelation.targetEvidence.map((t) => t.claims), buildStudentAnswerExecutionPlan({ question, contract }).targetEvidence.map((t) => t.claims),
    "comparison still retains source context without making relation an extra duty")
  const rejectedContract = { ...contract, targetIds: ["coregulation"], comparisonTargetIds: [], rejectedTargetIds: ["arousal"],
    obligations: contract.obligations.map((o) => ({ ...o, targetIds: ["coregulation"] })) }
  const rejected = buildStudentAnswerExecutionPlan({ question, contract: rejectedContract })
  assert.ok(!rejected.targetEvidence.flatMap((t) => t.claims).some((c) => c.claimId === relationId))
  assert.equal(hash(JSON.stringify(contract)), originalContractHash)
  assert.equal(hash(readFileSync(journalPath)), journalHash)
  assert.equal(externalCalls, 0)
  console.log(JSON.stringify({ ok: true, gate: "RELATION_SOURCE_PARAGRAPH_OWNERSHIP", candidateSha256: studentCandidateSha256(),
    exactFailedReceiptVerified: true, depthOrderControls, visibleHandoffs, invalidUnitControls: negativeUnits.length + 1,
    noRelationDutyUnchanged: true, rejectedTargetExcluded: true, sourceBudgetUnchanged: true,
    briefRelationCompletenessCertified: false, coMentionGrantsCausalAuthority: false, sample,
    externalProviderCalls: externalCalls, semanticQualityCertified: false, productionEligible: false }, null, 2))
}

void main()

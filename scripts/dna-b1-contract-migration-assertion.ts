// Unit-test migration only. Frozen benchmark/gold and its scorer never import this.
import assert from "node:assert/strict"
import type { StudentRequestContract } from "../src/lib/dna/chat/studentFirst/contracts"
import { DNA_STUDENT_SEMANTIC_TASKS } from "../src/lib/dna/chat/studentFirst/semanticInterpreter"
export function assertComparisonOnlyContractMigration(current: StudentRequestContract, prior: StudentRequestContract) {
  assert.ok(prior.requestedSemanticTasks.includes("compare"))
  assert.ok(!prior.requestedSemanticTasks.includes("relate"))
  const obligations = prior.obligations.filter(o => o.kind !== "explain_relation")
    .map((o, i) => ({ ...o, id: `${prior.turnId}:o${i + 1}` }))
  assert.deepEqual({ ...current, version: prior.version }, { ...prior, obligations })
}

// Opt-in assertion for an actually requested scope/relationship. Unlike the
// comparison-only migration, its old relation duty must remain present.
export function assertRequestedRelationContractMigration(current: StudentRequestContract, prior: StudentRequestContract) {
  assert.ok(prior.requestedSemanticTasks.includes("compare"))
  assert.ok(!prior.requestedSemanticTasks.includes("relate"))
  assert.ok(prior.obligations.some(row => row.kind === "explain_relation"))
  const requestedSemanticTasks = DNA_STUDENT_SEMANTIC_TASKS.filter(task =>
    prior.requestedSemanticTasks.includes(task) || task === "relate")
  assert.deepEqual({ ...current, version: prior.version }, { ...prior, requestedSemanticTasks })
}

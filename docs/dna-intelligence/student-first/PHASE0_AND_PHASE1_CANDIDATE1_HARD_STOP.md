# DNA Chat Student-First — Phase 0 completion and Phase 1 candidate 1 hard stop

Date: 2026-09-02

## Boundaries

- Branch: `codex/dna-chat-student-first-core-20260902`
- Starting commit: `1e6df33ada0d83808a2fe5d31f59ee9dbae9eb28`
- Production mutation: none
- Deployment: none
- Provider calls/cost: 0 / $0
- Frozen Natural Mini24 mutation: none

## Phase 0 result: PASS

1. Frozen Natural Mini24 was referenced without modification.
   - Fixture SHA-256: `9f146c18fe4cccf2a54aa4fa4aecd038dfecff3aee81e751f2308e6ea3845adc`
   - Gold SHA-256: `2a54904a77979b381948d7815f832013720b127a4199989087b9e3183723bc50`
2. Open Student40 was created as 5 conversations / 40 turns and is explicitly not certification eligible.
3. Fresh Student60 was created as 6 conversations / 60 turns, sealed and not evaluated.
4. The measurement core scores target, referent, history, components, example/format, safety, and unnecessary boundary independently.
5. `responseOutcome=answered` is excluded from semantic pass calculation and cannot hide a wrong target.
6. The `benchmark.six-domains.s-020` contradiction was reconciled to the existing `cns.reverse_inference` catalog topic. The reasoning gate now reports only the real unsupported-safe misroute `benchmark.sleep.sb-017`; the reverse-inference conflict no longer appears.

Verified commands:

- `npm run chat:student:fixtures:verify` — PASS
- `npm run chat:student:measurement:test` — PASS
- `npm run chat:reasoning` — expected FAIL after reconciliation: supported 95.9%, safety 100%, unsupported-safe 99.6%; only unsupported-safe failure is social jetlag misrouting to social buffering.

## Phase 1 candidate 1 result: FAIL / HARD STOP

Command: `npm run chat:student:smoke8`

The run stopped at `SMOKE8-T01` before any provider call:

- Student request: “hocam yürütücü işlevler tam ne demek öğrenci arkadaşına anlatır gibi söyler misin”
- Expected semantic operation: `define`
- Actual semantic operation: `simplify`
- Completed turns: 0/8
- Paid follow-up: prohibited and not run

## Root cause

Candidate 1 represents semantic intent and presentation style in one mutually exclusive `operation` field. The phrase “öğrenci arkadaşına anlatır gibi” therefore competes with and overrides the actual request “ne demek.” This is a contract-shape error, not a missing synonym and not a reason to add another validator.

## Next architecture decision

Candidate 2 must separate orthogonal axes:

- `semanticTask`: define, compare, explain, case reasoning, observe, evidence, summarize, treatment boundary
- `conversationAction`: continue, repair, return, summarize-session
- `presentationTransform`: plain language, brief, deep, prose, bullets, table, example

The same user turn may carry one value from each axis. For example, Smoke8 T01 must become:

```json
{
  "semanticTask": "define",
  "conversationAction": "continue",
  "presentationTransform": { "language": "plain_student" }
}
```

Candidate 1 will not be patched or rerun. Candidate 2 starts from this structural decision in a separate commit.

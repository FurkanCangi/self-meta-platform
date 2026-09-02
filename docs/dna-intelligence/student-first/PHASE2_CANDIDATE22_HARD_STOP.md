# DNA Chat Student-First — Phase 2 candidate 22 hard stop

Date: 2026-09-02

## Decision

- Gate result: **FAIL / HARD STOP**
- Semantic-quality result: **INCONCLUSIVE — provider timeout before a contract existed**
- Candidate: `semantic-acts-own-content-obligations`
- Parent diagnostic commit: `e78ce81`
- Production/deployment: none
- Gold/fixture/threshold mutation: none
- Fresh Student60 access: none
- Candidate 22 retry: none

Candidate 22 is the single structural intervention selected by the batch failure diagnostic. It preserves every explicit semantic act in the request contract and history, keeps the primary semantic task as a routing label, and prevents presentation fields from independently creating scientific content obligations.

## Batch diagnosis — PASS

- Phase 2 reports reconciled: 11
- Student40 failure observations: 26 on 9 distinct turns
- Six recurring turns: 23/26 observations (88.5%)
- Student40 SHA-256: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`
- Fresh Student60 read: false

## Local gates — PASS

- Batch structural closure: PASS
- Obligation compiler: 20/20
- Resolver contrastives: 37/37
- Provider boundary/failure taxonomy: PASS
- Bounded structured repair: PASS / maximum two provider attempts per turn
- Student40 adapter: PASS
- Fixture integrity: PASS
- Measurement: PASS
- Raw provider output reused for repair: false
- Secret/raw error persistence: 0

Targeted structural contrastives passed:

1. compare+example preserves both semantic acts and both obligation families;
2. “existing example” reference + observe does not request a new example;
3. presentation-only continuation invents no scientific act;
4. return, repair, summary, case-entity referent, and bounded-history behavior remain green.

## Exact unchanged Smoke8 — PASS

- Semantic contracts: 8/8
- Provider calls: 8
- Repaired turns: 0
- Input/output tokens: 18,504 / 1,278
- Cached input tokens: 0
- Cost: 26,172 micro-USD (`$0.026172`)
- Average logical-turn latency: 2,774 ms
- Raw messages persisted: 0

Candidate 21's failing `SMOKE8-T04` passed. The phrase “bu örnekte” no longer caused an extra `give_concrete_example` obligation.

## Authoritative Student40 — provider timeout / hard stop

- Stopped turn: `STUDENT40-C01-T05`
- Stop reason: `provider_failure/timeout/no_status/no_code`
- Completed semantic contracts: 4/40
- Full passes among completed contracts: 4/4
- Wrong target/referent/history/safety: 0/0/0/0
- Semantic failure rows: 0
- Provider calls: 5
- Input/output tokens recorded before stop: 8,589 / 648
- Cached input tokens: 1,387
- Cost: 11,229 micro-USD (`$0.011229`)
- Average completed-call latency: 2,795 ms
- Fixture mutated: false

Total Candidate 22 provider evidence cost: 37,401 micro-USD (`$0.037401`).

## Root-cause attribution

The Student40 stop is a transport/runtime failure at the provider boundary, not an observed semantic contract failure. No structured frame existed for T05, so this run cannot prove whether Candidate 22 would pass or fail T05–T40.

The evidence does prove:

- Candidate 22 closes the selected ownership boundary locally;
- unchanged Smoke8 is 8/8;
- the first four Student40 turns are full passes;
- there is no evidence of a target, referent, action, safety, or obligation regression before timeout.

The evidence does not prove:

- Student40 >=36/40;
- zero critical failures across all 40 turns;
- visible-answer quality;
- any later certification or live-readiness gate.

## Next decision boundary

Do not patch semantic behavior from this result and do not rerun Candidate 22 under the same identity. The next run must first define a transport-failure policy that does not turn a provider timeout into either a false quality rejection or an unlimited paid retry loop. That policy must remain bounded, observable, and separate from the one allowed semantic repair.

## Status

- Phase 0: PASS
- Phase 1: PASS
- Phase 2 local + Smoke8: PASS
- Phase 2 Student40: INCONCLUSIVE / gate FAIL due provider timeout
- Frozen Mini24 / Fresh60 / visible answer / later gates: not run
- Production/deployment: none
- Best fully passing checkpoint: `79f4ed2`


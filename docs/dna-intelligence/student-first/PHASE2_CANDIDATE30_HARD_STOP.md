# DNA Chat Student-First — Phase 2 candidate 30 hard stop

Date: 2026-09-02

## Decision

- Result: **FAIL / HARD STOP**
- Candidate: compatible explanatory-continuation referent recovery
- Parent commit: `d13b56a`
- Production/deployment: none
- Gold/fixture/threshold mutation: none
- Fresh Student60 access: none
- Candidate 30 retry: none

Candidate 30 adds one task-completion rule to the referent resolver: a `continue` explanation with a non-empty focus fully contained in the immediately previous turn can inherit that turn as an utterance referent. Explicit pointers still win; unrelated targets and non-continue actions remain unbound.

## Local gates — PASS

- Resolver contrastives: 46/46
- Same-target explanatory continuation: PASS
- Unrelated explanation no-leak: PASS
- Repair/start action boundaries: PASS
- Prior case/entity, return, comparison, rejection, and focus rules: PASS
- Obligation compiler: 33/33
- Provider boundary and focus-action matrix: PASS
- Adapter / fixture / measurement: PASS
- Student40 SHA-256 unchanged: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`
- Fresh Student60: `SEALED_UNOPENED`

## Exact unchanged Smoke8 — PASS

- Semantic contracts: 8/8
- Provider calls: 8
- Semantic repairs / transport retries / partial-usage turns: 0 / 0 / 0
- Input/output tokens: 20,331 / 1,322
- Cached input tokens: 13,020
- Cost: 16,548 micro-USD (`$0.016548`)
- Average latency: 2,343 ms
- Raw messages persisted: 0

## Authoritative Student40 — FAIL

- Evaluated: 6/40
- Full passes: 5/6 evaluated; 5/40 gate denominator
- Wrong target: 1
- Wrong referent/history/safety: 0/0/0
- Provider calls: 6
- Semantic repairs / transport retries / partial-usage turns: 0 / 0 / 0
- Input/output tokens: 14,876 / 1,019
- Cached input tokens: 9,756
- Cost: 12,212 micro-USD (`$0.012212`)
- Average latency: 2,259 ms
- Fixture mutated: false

Total Candidate 30 provider evidence cost: 28,760 micro-USD (`$0.028760`).

Critical stop:

- Turn: `STUDENT40-C01-T06`
- Input: “planlama dürtü kontrolü ve duygu düzenleme bu durumda üçü ayrı ayrı nasıl yer alır”
- Expected targets: `planning`, `inhibition`, `emotion_regulation`
- Actual targets: `planning`, `emotion_regulation`
- Task/action/referent/safety: PASS
- Missing component: `inhibition`

## Root cause

The provider intermittently omits an explicitly named target alias. The canonical lexicon already maps “dürtü kontrolü” to `inhibition`, but the provider is the only component currently allowed to populate the structured focus set. Therefore a valid explicit concept can disappear before deterministic compilation.

Candidate 30's referent branch was not reached in the paid run because this earlier critical failure stopped the candidate. Its local positive and negative contrastives pass, so there is no evidence that the new referent rule caused the stop. The same Student40 turn has produced correct targets in several earlier candidates, showing provider extraction variance rather than a stable fixture or ontology contradiction.

## Selected next branch

Do not rerun Candidate 30. Candidate 31 should add one provider-independent explicit-concept grounding layer:

1. retain a lexicon distinction between scientific/answer-bearing aliases and behavior-only context aliases;
2. detect scientific aliases ephemerally from the current message;
3. union those explicit concepts into provider focus, except current-turn rejected targets;
4. remove promoted concepts from context to preserve role exclusivity;
5. keep behavior-only aliases such as task return behavior from becoming answer targets;
6. preserve summary and action semantics;
7. add positive and negative target-role contrastives before exact Smoke8 and one Student40 run.

This is deterministic request grounding, not a validator, a one-phrase exception, a gold edit, or a threshold change.

## Status

- Phase 0: PASS
- Phase 1: PASS
- Phase 2 local + Smoke8: PASS
- Phase 2 Student40: FAIL at 6/40
- Candidate 30 referent target turn: not reached in paid run
- Frozen Mini24 / Fresh60 / visible-answer / later gates: not run
- Production/deployment: none
- Best fully passing checkpoint: `79f4ed2`

# DNA Chat Student-First — Phase 2 candidate 27 hard stop

Date: 2026-09-02

## Decision

- Result: **FAIL / HARD STOP**
- Candidate: current-turn rejection ownership
- Parent commit: `ca22c0f`
- Production/deployment: none
- Gold/fixture/threshold mutation: none
- Fresh Student60 access: none
- Candidate 27 retry: none

Candidate 27 makes provider rejection IDs current-turn and repair-only. Summary, continue, return, and start actions ignore provider-carried historical rejection IDs while conversation state preserves historical rejection memory.

## Local gates — PASS

- Obligation compiler: 33/33
- Action-compatibility matrix: 8/8
- Resolver contrastives: 42/42
- Repair-only current rejection: PASS
- Historical rejection survives summary: PASS
- Focus/context target roles: PASS
- Provider boundary, semantic repair and transport retry: PASS
- Adapter / fixture / measurement: PASS
- Student40 SHA-256 unchanged: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`
- Fresh Student60: `SEALED_UNOPENED`

## Exact unchanged Smoke8 — PASS

- Semantic contracts: 8/8
- Provider calls: 8
- Semantic repairs: 0
- Transport retries: 0
- Partial-usage turns: 0
- Input/output tokens: 20,328 / 1,317
- Cached input tokens: 0
- Cost: 28,230 micro-USD (`$0.028230`)
- Average latency: 2,617 ms
- Raw messages persisted: 0

Candidate 26's final-turn rejection failure was resolved: T08 did not expose historical `inhibition` as a current-turn rejection.

## Authoritative Student40 — FAIL

- Evaluated: 11/40
- Full passes: 10/11 evaluated; 10/40 gate denominator
- Wrong target: 1
- Wrong referent: 0
- Wrong history/action: 0
- Unsafe decision: 0
- Provider calls: 13
- Semantic repairs: 0
- Transport retries: 2 across separate turns
- Partial-usage turns: 2
- Recorded input/output tokens: 27,668 / 1,847
- Cached input tokens: 7,913
- Recorded cost: 31,630 micro-USD (`$0.031630`)
- Average logical-turn latency: 3,766 ms
- Fixture mutated: false

Recorded Candidate 27 provider evidence cost is 59,860 micro-USD (`$0.059860`). This is not complete billing evidence because two timed-out requests returned no usage.

Critical stop:

- `STUDENT40-C02-T03`
- Expected targets: `executive_functions`, `inhibition`
- Actual target: `inhibition`
- Expected and actual referent: `STUDENT40-C02-T02`
- Semantic task: `example` / PASS
- Example obligations: PASS
- Conversation action: PASS
- Additional non-critical presentation mismatch: one

Input:

> derste arkadaşının sözünü kesen bir çocukla kısa örnek ver

## Root cause

Focus/context target fields exist, but their role assignment remains provider-only. The provider inferred `inhibition` from the described behavior and emitted it as current focus even though the user did not name a scientific concept and asked to exemplify the immediately preceding two-target comparison.

Because one focus target existed, the local example resolver preferred it over the correctly resolved referent target set. This narrowed `executive_functions + inhibition` to `inhibition`.

The required distinction is now:

- explicit/request-bearing scientific focus;
- behavior-derived contextual inference;
- inherited referent focus.

The current two-role schema cannot prove that a focus ID is request-bearing. Candidate 24's local context-role cases therefore did not generalize reliably to provider output.

This is not a knowledge, composer, safety, UI, session, build, or production-routing failure.

## Selected next branch

Do not add a “sözünü kesen” phrase exception or rerun Candidate 27. The next structural candidate must ground focus promotion:

1. focus targets require explicit request-bearing evidence, not only a behavior-to-concept inference;
2. behavior-derived concept IDs remain context targets;
3. a context-binding example with no grounded current focus inherits the compatible referent target set;
4. an explicitly named concept such as “inhibisyon için örnek” may narrow the referent target set;
5. an explicitly requested unrelated concept may start a new focus;
6. local contrasts must distinguish Smoke8 T03, Student40 C02-T03, Student40 C03-T02, explicit recovery question, compare, repair, return, and unrelated case.

This requires a target-grounding representation or deterministic evidence boundary, not another answer validator or prompt-only example.

Only after that architecture passes local contrasts may unchanged Smoke8 and one Student40 run be opened.

## Status

- Phase 0: PASS
- Phase 1: PASS
- Phase 2 local + Smoke8: PASS
- Phase 2 Student40: FAIL at 11/40
- Frozen Mini24 / Fresh60 / visible answer / later gates: not run
- Production/deployment: none
- Best fully passing checkpoint: `79f4ed2`


# DNA Chat Student-First — Phase 2 candidate 23 hard stop

Date: 2026-09-02

## Decision

- Result: **FAIL / HARD STOP**
- Candidate: bounded provider-transport recovery
- Parent semantic candidate: `bb7d551`
- Production/deployment: none
- Gold/fixture/threshold mutation: none
- Fresh Student60 access: none
- Candidate 23 retry: none

Candidate 23 keeps Candidate 22's semantic-act ownership change and adds a transport policy separate from semantic repair:

- timeout/network only: maximum one exact-request transport retry;
- maximum two semantic attempts;
- maximum three total provider calls per logical turn;
- transport failures mark usage evidence partial;
- a second transport failure hard-stops.

## Local gates — PASS

- Provider failure classes: 9
- Timeout then success: PASS
- Timeout then timeout hard-stop: PASS
- Maximum transport retries per turn: 1
- Maximum provider calls per turn: 3
- Semantic repair remains maximum 2 attempts
- Transport failure usage marked partial: PASS
- Raw output reused for repair/retry: false
- Batch diagnostic and structural closure: PASS
- Obligation compiler: 20/20
- Resolver contrastives: 37/37
- Adapter / fixture / measurement: PASS

## Exact unchanged Smoke8 — PASS

- Semantic contracts: 8/8
- Provider calls: 8
- Semantic repairs: 0
- Transport retries: 0
- Partial-usage turns: 0
- Input/output tokens: 18,504 / 1,279
- Cached input tokens: 18,480
- Cost: 9,550 micro-USD (`$0.009550`)
- Average latency: 2,314 ms
- Raw messages persisted: 0

## Authoritative Student40 — FAIL

- Evaluated: 18/40
- Full passes: 14/18 evaluated; 14/40 gate denominator
- Wrong target: 1
- Wrong referent: 1
- Wrong history/action: 0
- Unsafe decision: 0
- Provider calls: 18
- Semantic repairs: 0
- Transport retries: 0
- Partial-usage turns: 0
- Input/output tokens: 41,813 / 2,915
- Cached input tokens: 12,782
- Cost: 47,803 micro-USD (`$0.047803`)
- Average latency: 2,619 ms
- Fixture mutated: false

Total Candidate 23 provider evidence cost: 57,353 micro-USD (`$0.057353`).

Non-critical failures before the stop:

1. `STUDENT40-C01-T06`: `compare` instead of component-wise `explain`; targets correct, component obligations missing.
2. `STUDENT40-C02-T04`: `observe` instead of `case_reasoning`; targets, referent and answer-driving obligations correct.
3. `STUDENT40-C02-T07`: `example` instead of `compare`; example obligations passed, comparison obligations missing.

Critical stop:

- `STUDENT40-C03-T02`
- Expected target: `coregulation`
- Actual targets: `coregulation`, `recovery`
- Expected referent: `STUDENT40-C03-T01`
- Actual referent: `null`

Input:

> öğretmen sesini yumuşatıp bekleyince çocuk göreve dönüyor bunu örnek gibi açıkla

## Root cause

`mentionedTargetIds` is a flat list. It does not distinguish:

- the scientific focus the student asks the system to explain (`coregulation` inherited from T01), and
- a behavior/context detail inside the requested example (`göreve dönüyor`, lexically matching `recovery`).

The provider therefore promoted the contextual behavior to a second scientific target and omitted the prior coregulation referent. The local resolver treats every mentioned target as answer-driving, so it cannot recover the intended single target.

This is not a knowledge, composer, answer-validator, safety, UI, session, build, or production-routing failure. Those branches remain unreached.

Candidate 23's transport intervention did not activate in the live run (`transportRetries=0`), but its bounded behavior is proven by deterministic provider mocks. Candidate 22's prior timeout was transient; Candidate 23 reached four additional Student40 turns and then the next real semantic boundary.

## Selected next branch

Do not add a `göreve dönüyor` phrase exception. The next structural candidate must replace the flat target-mention list with target roles:

1. `focusTargetIds`: concepts the current request asks the answer to address;
2. `contextTargetIds`: concepts/behaviors only present inside a case or example description;
3. contextual targets do not enter final answer targets unless another explicit semantic act requests them;
4. target-free example/explanation requests may inherit focus from the compatible referent;
5. explicit compare, repair, and retargeting still promote current focus targets;
6. local contrasts cover `göreve dönüyor` as context versus an explicit recovery question, implicit coregulation example, two-target compare, rejection, unrelated new target, and case-entity referent.

Only after those local cases pass may unchanged Smoke8 and one Student40 run be opened. No prompt-only patch, gold edit, threshold change, same-candidate retry, or production mutation is authorized.

## Status

- Phase 0: PASS
- Phase 1: PASS
- Phase 2 local + Smoke8: PASS
- Phase 2 Student40: FAIL at 18/40
- Frozen Mini24 / Fresh60 / visible answer / later gates: not run
- Production/deployment: none
- Best fully passing checkpoint: `79f4ed2`


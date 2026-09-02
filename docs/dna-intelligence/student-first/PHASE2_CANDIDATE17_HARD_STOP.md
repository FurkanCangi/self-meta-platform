# DNA Chat Student-First — Phase 2 candidate 17 hard stop

Date: 2026-09-02

## Decision

- Result: **FAIL / HARD STOP**
- Production/deployment: none
- Gold/fixture/threshold mutation: none
- Fresh Student60 access: none
- Candidate 17 retry: none

Candidate 17 implemented the Phase 2 one-repair allowance for typed structured-frame failures. It performs at most two provider attempts per logical turn, never reuses raw provider output in repair input, aggregates successful-attempt usage and latency, and hard-stops after a second invalid frame or any provider failure.

## Local evidence — PASS

- First invalid frame plus second valid frame: PASS
- Two invalid frames: hard stop after exactly two calls
- Aggregate two-attempt usage: PASS
- Raw provider output reused in repair: false
- Provider failure classes: 9
- Resolver contrastive matrix: 18/18
- Obligation/compiler: 15/15
- Adapter/fixture/measurement gates: PASS
- Student40 SHA-256 unchanged: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`
- Fresh60: `SEALED_UNOPENED`

## Exact Smoke8 — PASS

- Semantic contracts: 8/8
- Provider attempts: 8
- Repaired turns: 0
- Input/output tokens: 15,656 / 1,231
- Cached input: 15,632
- Cost: 8,976 micro-USD (`$0.008976`)
- Average logical-turn latency: 3,610 ms
- Raw messages persisted: 0

## Authoritative Student40 — FAIL

- Evaluated: 13/40
- Full pass: 11/13 evaluated; 11/40 gate denominator
- Wrong target: 0
- Wrong referent: 1
- Wrong history/safety: 0/0
- Provider attempts: 13
- Repaired turns: 0
- Input/output tokens: 25,346 / 2,019
- Cached input: 19,873
- Cost: 19,580 micro-USD (`$0.019580`)
- Average logical-turn latency: 2,629 ms
- Fixture mutation: false

Failures:

1. `STUDENT40-C02-T04`: non-critical `observe` versus `case_reasoning` label difference; all answer-driving obligations and critical dimensions passed.
2. `STUDENT40-C02-T05`: target, action, obligations, and safety passed, but the return referent resolved to `STUDENT40-C02-T04` instead of `STUDENT40-C02-T03`.

Total provider evidence cost: 28,556 micro-USD (`$0.028556`).

Candidate 17 did not need a live repair in this run; its bounded repair behavior is proven by deterministic provider mocks. Candidate 16's action-first target fix remained successful: the return target was only `working_memory`.

## Root cause

The conversation model represents only a turn pointer. It does not distinguish:

- the immediately preceding utterance (`T04`: an observation/inference question), and
- the case/entity anchor introduced earlier (`T03`: the child/example being discussed).

The user returned to “the previous child,” but the provider selected the latest utterance about that child. Current `StudentConversationTurnSnapshot` rows do not store their own referent metadata, so the local resolver cannot follow `T04 -> T03`. `explicitReferent` preserves only the latest state-level pointer; the historical chain and referent role are lost.

## Selected next branch

Do not patch another pointer heuristic. The next candidate must make one conversation-state architecture intervention:

1. each semantic history snapshot stores its resolved referent turn and role;
2. referents distinguish at least utterance versus case/example entity anchor;
3. local resolution can follow a bounded referent chain without raw-message persistence;
4. explicit statement return remains distinct from entity return;
5. contrastive tests cover T03 child anchor, T04 observation-about-child, T05 return-to-child, return-to-last-statement, unrelated new case, privacy summary, and eight-turn history truncation.

Only after those local cases pass may exact Smoke8 and one Student40 run be opened. No new validator, gold edit, threshold change, or retry of candidate 17 is authorized.

## Status

- Phase 0: PASS
- Phase 1: PASS
- Phase 2 semantic Student40: FAIL
- Phase 2 visible answer and all later gates: blocked
- Best fully passing checkpoint: `79f4ed2`

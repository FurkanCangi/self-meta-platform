# DNA Chat Student-First — Phase 2 candidate 26 hard stop

Date: 2026-09-02

## Decision

- Result: **FAIL / HARD STOP**
- Candidate: action-aware semantic obligation compatibility matrix
- Parent commit: `a73c1e1`
- Production/deployment: none
- Gold/fixture/threshold mutation: none
- Fresh Student60 access: none
- Student40: not run
- Candidate 26 retry: none

Candidate 26 distinguishes ordinary presentation-only continuation from return+restate. It retains the inherited primary content duty for return while suppressing repeated content duties for a style-only continue.

## Local gates — PASS

- Obligation compiler: 33/33
- Action-compatibility matrix: 8/8
- Resolver contrastives: 39/39
- Focus/context target roles: PASS
- Provider boundary, semantic repair and transport retry: PASS
- Adapter / fixture / measurement: PASS
- Student40 SHA-256 unchanged: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`
- Fresh Student60: `SEALED_UNOPENED`

The exact Candidate 25 failure was closed locally: `return + no new semantic acts + preserveMeaning` compiled `define_target`, `use_history_anchor`, and `preserve_target_while_simplifying`.

## Exact unchanged Smoke8 — FAIL

- Correct contracts before stop: 7/8
- Failed turn: `SMOKE8-T08`
- Failure dimension: current-turn rejected targets
- Expected current-turn rejected targets: none
- Actual current-turn rejected targets: `inhibition`
- Provider calls: 8
- Input/output tokens: 20,073 / 1,322
- Cached input tokens: 10,819
- Cost: 18,270 micro-USD (`$0.018270`)
- Average logical-turn latency: 2,981 ms

Input:

> şimdi konuştuklarımızı üç cümlede toparla neyi biliyoruz neyi bilmiyoruz gözlemde neye bakarım

## Root cause

The provider copied a historically rejected target from conversation state into the frame's `rejectedTargetIds`. The contract compiler treats that field as a current-turn correction on every conversation action.

Two concepts are being conflated:

- current-turn rejection: a target explicitly rejected in the present repair message;
- historical rejection memory: a privacy-safe state fact used to avoid returning to an already rejected target.

The summary turn should preserve historical rejection memory in state without declaring a new current-turn rejection. The provider prompt already says the rejection field is for explicit current correction, but the contract lacks a deterministic action ownership rule.

Candidate 26's targeted action/obligation fix succeeded: T06 passed and the run reached the final Smoke8 turn.

## Selected next branch

Do not add a T08 or summary phrase exception. The next single structural intervention must make rejection ownership current-turn and action-gated:

1. provider rejection IDs mean only explicit rejection in the current message;
2. only a resolved `repair` action may expose current-turn rejected IDs in the request contract;
3. start, continue, return, and summarize-session ignore provider-carried historical rejection IDs;
4. conversation state continues to retain historical rejection memory;
5. summary target union retains discussed historical targets without creating a new rejection;
6. local matrix tests cover repair, continue, return, summary, rejected-target filtering, historical memory, and raw-message privacy.

Only after those local cases pass may unchanged Smoke8 and one Student40 run be opened. No prompt-only patch, validator, gold edit, threshold change, same-candidate retry, or production mutation is authorized.

## Status

- Phase 0: PASS
- Phase 1: PASS
- Phase 2 local: PASS
- Phase 2 Smoke8: FAIL at 7/8
- Phase 2 Student40 and later gates: not run
- Production/deployment: none
- Best fully passing checkpoint: `79f4ed2`


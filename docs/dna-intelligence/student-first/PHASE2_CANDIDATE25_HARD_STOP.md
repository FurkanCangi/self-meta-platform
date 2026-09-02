# DNA Chat Student-First — Phase 2 candidate 25 hard stop

Date: 2026-09-02

## Decision

- Result: **FAIL / HARD STOP**
- Candidate: semantic obligation-family compatibility matrix
- Parent commit: `fcace6b`
- Production/deployment: none
- Gold/fixture/threshold mutation: none
- Fresh Student60 access: none
- Student40: not run
- Candidate 25 retry: none

Candidate 25 makes content-obligation families primary-task gated. Observation/case tasks no longer receive a generic definition duty merely because the provider activates a supporting explanation act. Terminal summary and treatment families remain isolated, compare+example remains compositional, and ordinary presentation-only continuations do not recreate content duties.

## Local gates — PASS

- Obligation compatibility matrix: 24/24
- Resolver contrastives: 39/39
- Focus/context target roles: PASS
- Provider boundary, bounded repair and transport retry: PASS
- Adapter / fixture / measurement: PASS
- Student40 SHA-256 unchanged: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`
- Fresh Student60: `SEALED_UNOPENED`

Covered local combinations included:

- observe+explain;
- compare+example;
- treatment+explain;
- summarize+explain;
- define+explain;
- presentation-only continue.

## Exact unchanged Smoke8 — FAIL

- Correct contracts before stop: 5/8
- Failed turn: `SMOKE8-T06`
- Expected obligations: `define_target`, `use_history_anchor`, `preserve_target_while_simplifying`
- Actual obligations: `use_history_anchor`, `preserve_target_while_simplifying`
- Missing obligation: `define_target`
- Provider calls: 6
- Input/output tokens: 14,500 / 992
- Cached input tokens: 9,278
- Cost: 12,103 micro-USD (`$0.012103`)
- Average logical-turn latency: 2,424 ms

Input:

> ilk anlattığın yürütücü işlevlere dönelim çok akademik olmadan yeniden söyle

## Root cause

The compatibility matrix classifies every frame with zero new semantic acts and `preserveMeaning=true` as presentation-only. That is correct for an ordinary `continue`: the user only restyles the immediately preceding answer.

It is incomplete for `return`. A return+restate turn asks the system to re-execute the referenced historical content duty in the requested presentation. The primary task correctly inherited `define`, and the history anchor and preserve-meaning duties passed, but the presentation-only suppression removed the inherited `define_target` duty.

This is an action/obligation compatibility gap, not a target-role, referent, provider transport, knowledge, safety, composer, UI, or production-routing failure.

## Selected next branch

Do not add a T06 phrase exception. The next single structural intervention must make the obligation matrix action-aware and prove the full relevant cross-product before another paid gate:

1. `continue + no new acts + preserveMeaning` compiles only presentation preservation;
2. `return + no new acts + preserveMeaning` recompiles the inherited primary content family plus history and presentation duties;
3. `repair` retains rejected-target duty and any explicit replacement content family;
4. `summarize_session` remains terminal summary;
5. `start` cannot be presentation-only;
6. content families remain primary-task compatible;
7. matrix tests cover every conversation action against empty, define/explain, compare+example, observe+explain, summary, and treatment act sets.

Only after this action-aware matrix passes may unchanged Smoke8 and one Student40 run be opened. No prompt-only patch, validator, gold edit, threshold change, same-candidate retry, or production mutation is authorized.

## Status

- Phase 0: PASS
- Phase 1: PASS
- Phase 2 local: PASS
- Phase 2 Smoke8: FAIL at 5/8
- Phase 2 Student40 and later gates: not run
- Production/deployment: none
- Best fully passing checkpoint: `79f4ed2`


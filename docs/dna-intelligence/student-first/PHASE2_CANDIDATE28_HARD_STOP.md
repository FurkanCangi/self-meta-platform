# DNA Chat Student-First — Phase 2 candidate 28 hard stop

Date: 2026-09-02

## Decision

- Result: **FAIL / HARD STOP**
- Candidate: deterministic focus-promotion grounding
- Parent commit: `5044527`
- Production/deployment: none
- Gold/fixture/threshold mutation: none
- Fresh Student60 access: none
- Candidate 28 retry: none

Candidate 28 grounds provider focus promotion for history-backed example/case/observation tasks. A provider-inferred target without an explicitly named scientific label is demoted to context, allowing the compatible referent focus to drive the answer. Explicitly named concepts remain focus. Raw text is used ephemerally and is not persisted.

## Local gates — PASS

- Provider target-role grounding: PASS
- Behavior-derived focus demotion: PASS
- Explicit scientific focus preservation: PASS
- Non-context task preservation: PASS
- Obligation compiler: 33/33
- Action-compatibility matrix: 8/8
- Resolver contrastives: 42/42
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
- Input/output tokens: 20,316 / 1,313
- Cached input tokens: 13,020
- Cost: 16,479 micro-USD (`$0.016479`)
- Average latency: 3,282 ms
- Raw messages persisted: 0

The grounding boundary preserved Smoke8 T03's explicit `inhibition` narrowing.

## Authoritative Student40 — FAIL

- Evaluated: 5/40
- Full passes: 4/5 evaluated; 4/40 gate denominator
- Wrong target: 1
- Wrong referent/history/safety: 0/0/0
- Provider calls: 5
- Semantic repairs: 0
- Transport retries: 0
- Partial-usage turns: 0
- Input/output tokens: 12,112 / 843
- Cached input tokens: 8,108
- Cost: 9,875 micro-USD (`$0.009875`)
- Average latency: 4,185 ms
- Fixture mutated: false

Total Candidate 28 provider evidence cost: 26,354 micro-USD (`$0.026354`).

Critical stop:

- `STUDENT40-C01-T05`
- Conversation action: `repair` / PASS
- Expected targets: `self_regulation`, `recovery`
- Actual target: `self_regulation`
- Rejected `attention` duty: PASS
- Referent/history/safety: no failure

Input:

> yok dikkat tarafını sormuyorum kendi kendine toparlanıp göreve dönmesini öz düzenleme açısından soruyorum

## Root cause

The focus grounding rule applies to every context-binding semantic task, including `case_reasoning`. It demoted behavior-derived `recovery` because the canonical scientific label “toparlanma” was not literally named.

That is appropriate for an ordinary example continuation such as Candidate 27's failing “arkadaşının sözünü kesen çocukla örnek ver.” It is not appropriate for an explicit repair turn: the student rejects attention and directly identifies the replacement behavior plus self-regulation focus. In a repair, current focus is request-bearing even when expressed behaviorally.

The missing axis is conversation action. Focus grounding must distinguish ordinary context continuation from explicit repair/retargeting.

## Selected next branch

Do not add behavior phrases or rerun Candidate 28. The next single structural intervention must make focus grounding action-aware:

1. ordinary `continue` context-binding tasks require explicit scientific-label grounding before overriding a referent;
2. `repair` preserves provider-interpreted replacement focus and applies rejected-target filtering;
3. `return` remains anchored by its explicit history referent;
4. `start` has no history grounding;
5. `summarize_session` derives targets from history;
6. local action matrix covers the same inferred behavior focus under continue, repair, return, start, and summary;
7. exact contrasts include Smoke8 T03, Student40 C01-T05, C02-T03, and C03-T02.

Only after the matrix passes may unchanged Smoke8 and one Student40 run be opened.

## Status

- Phase 0: PASS
- Phase 1: PASS
- Phase 2 local + Smoke8: PASS
- Phase 2 Student40: FAIL at 5/40
- Frozen Mini24 / Fresh60 / visible answer / later gates: not run
- Production/deployment: none
- Best fully passing checkpoint: `79f4ed2`


# DNA Chat Student-First — Phase 2 candidate 33 hard stop

Date: 2026-09-02

## Decision

- Result: **FAIL / HARD STOP**
- Immutable candidate SHA: `da6195a`
- Candidate: Turkish morphological scientific-target grounding
- Production/deployment: none
- Gold/fixture/threshold mutation: none
- Fresh Student60 access: none
- Candidate 33 retry: none

## Local gates — PASS

- Morphological target contrasts: PASS
- Unchanged Student40 oracle baseline: 40/40
- Controlled provider-frame mutations: 155/155
- Critical mutation failures: 0
- Provider boundary / obligation / action / resolver / adapter / fixture / measurement: PASS
- Student40 SHA-256 unchanged: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`
- Fresh Student60: `SEALED_UNOPENED`

## Provider health preflight — PASS

- Calls: 1
- Input/output tokens: 2,239 / 164
- Cached input tokens: 1,597
- Cost: 1,786 micro-USD (`$0.001786`)

## Exact Smoke8 — PASS

- Semantic contracts: 8/8
- Provider calls: 8
- Semantic repairs / transport retries / partial-usage turns: 0 / 0 / 0
- Input/output tokens: 20,695 / 1,318
- Cached input tokens: 13,020
- Cost: 16,888 micro-USD (`$0.016888`)
- Average latency: 2,346 ms
- Raw messages persisted: 0

## Authoritative Student40 — FAIL

- Evaluated: 8/40
- Full passes: 5/8 evaluated; 5/40 gate denominator
- Wrong target: 1
- Wrong referent/history/safety: 0/0/0
- Provider calls: 8
- Semantic repairs / transport retries / partial-usage turns: 0 / 0 / 0
- Input/output tokens: 21,151 / 1,365
- Cached input tokens: 8,108
- Cost: 22,046 micro-USD (`$0.022046`)
- Average latency: 3,339 ms
- Fixture mutated: false

Total Candidate 33 provider evidence cost including health preflight: 40,720 micro-USD (`$0.040720`).

Non-critical failures:

1. `STUDENT40-C01-T06`: provider retained comparison intent; targets passed but component obligations were missing.
2. `STUDENT40-C01-T07`: provider retained comparison as primary task; targets, referent, action, and observation obligations passed.

Critical stop:

- Turn: `STUDENT40-C01-T08`
- Input: broad session request “konuştuklarımızı üç cümlede özetle …”
- Expected targets: all seven historically discussed targets
- Actual targets: only latest `planning`, `inhibition`, `emotion_regulation`
- Task/action/obligations/referent/safety: PASS

## Root cause

Candidate 32 introduced explicit scoped summaries: when the student names summary targets, those targets should limit the summary; otherwise the compiler should summarize bounded history. The implementation treated any provider `focusTargetIds` on a summary as explicit scope. On this broad summary, the provider copied the latest active targets even though the current message names no target. The compiler therefore discarded earlier discussed targets.

The local oracle seeded summary focus with the expected targets and the mutation harness did not inject provider-carried focus into summary turns. This is a provenance coverage gap, not a morphological regression. Candidate 33 successfully passed the previously failing `recovery` turn.

## Selected final portfolio branch

Candidate 34 is the third and final allowed online candidate. It may make one structural intervention only: explicit summary-scope provenance.

1. derive summary focus solely from scientific targets explicitly present in the current message;
2. for a broad target-free session summary, clear provider-carried focus and use bounded semantic history;
3. for an explicitly scoped summary, ignore unrelated provider-carried focus and keep only current explicit targets;
4. add summary-focus-noise mutations for all five Student40 summaries;
5. preserve historical rejection semantics, summary obligations, privacy, and target role separation.

If Candidate 34 does not pass Student40, stop incremental provider-interpreter patching and select a replacement architecture. Do not create Candidate 35 by micro-patch.

## Status

- Phase 0: PASS
- Phase 1: PASS
- Phase 2 Candidate 33 local + Smoke8: PASS
- Phase 2 Student40: FAIL at 8/40
- Portfolio online candidates used: 2/3
- Frozen Mini24 / Fresh60 / visible-answer / later gates: not run
- Production/deployment: none


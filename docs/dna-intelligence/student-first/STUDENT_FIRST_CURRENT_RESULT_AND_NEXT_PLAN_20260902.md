# DNA Chat Student-First — current result and bounded next plan

Date: 2026-09-02

## 2026-09-02 Stage A/B update

The planned local provider-frame mutation harness and high-confidence request-intent normalizer are now implemented in the working tree.

- unchanged Student40 oracle baseline: 40/40;
- controlled provider-frame mutations: 154/154;
- target/referent/history/safety mutation failures: 0;
- behavior-context promotion failures: 0;
- rejected-target re-entry failures: 0;
- all provider-boundary, 33 obligation, 8 action, 46 resolver, adapter, fixture, and measurement regressions: PASS;
- provider calls and cost for this stage: 0;
- Fresh Student60: still sealed.

Candidate 32 is locally ready for an online Smoke8 gate, but no online run has been opened because the new process requires an immutable commit SHA and staging awaits explicit authorization in the dirty repository.

## Executive decision

The system is **not ready for production** and Phase 2 is not complete. Smoke8 has repeatedly reached 8/8, but no candidate has passed the authoritative Student40 gate of at least 36/40 with zero target, referent, history, and safety failures.

The work has produced real architectural improvements, but the online candidate loop has become too long. Continuing with one paid Student40 run after every small change is no longer the right process. The next phase must first prove robustness locally against controlled provider-frame errors, then allow at most three online candidates.

## What is now proven

### Measurement and governance

- Natural Mini24 remains unchanged.
- Student40 remains the open 5-conversation / 40-turn development set.
- Student40 SHA-256 remains `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`.
- Fresh Student60 remains `SEALED_UNOPENED`.
- “Answered” is excluded from semantic quality.
- Target, referent, history/action, obligations/components, presentation, safety, and naturalness are separate dimensions.
- Raw user messages are not persisted in conversation state.
- Provider calls, repair attempts, transport retries, partial usage, tokens, latency, and cost are bounded and reported.

### Conversation architecture

- State retains active targets, rejected targets, comparisons, presentation, unresolved obligations, bounded semantic history, referent role, and compact privacy-safe summary.
- Conversation actions are resolved separately from semantic tasks.
- Current-turn rejections are repair-only; historical rejection memory does not leak into later answer obligations.
- Focus targets and contextual behavior targets are separated.
- Case-entity chains can resolve to the originating example without storing raw messages.
- Compatible example, observation, comparison, preserve-meaning, return, and explanatory-continuation referents have local contrastive coverage.
- Final answer obligations are compiled locally rather than delegated to the provider.
- Structured semantic repair and transport retry are both bounded.

### Repeated online evidence

- Candidate 28: Smoke8 8/8; Student40 stopped at 5/40 on an over-broad focus rule.
- Candidate 29: Smoke8 8/8; Student40 reached 20/40, with 15 full passes and zero wrong targets, then stopped on one missing explanatory referent.
- Candidate 30: Smoke8 8/8; Student40 stopped at 6/40 when the provider omitted explicit `inhibition` from “dürtü kontrolü.”
- Candidate 31: all local gates passed; Smoke8 could not be measured because the provider transport failed before the first contract, with zero reported usage.

The deepest authoritative progress is Candidate 29's 20 evaluated turns. It is improvement evidence, not a pass.

## What is not proven

- Student40 ≥36/40 with zero critical semantic failures: **not proven**.
- Frozen Mini24 ≥22/24 and 2/2 conversations on this architecture: **not run**.
- Fresh Student60 ≥90%: **sealed and not run**.
- Natural visible-answer quality for a one-hour occupational-therapy student conversation: **not run**.
- Scientific250 and Full602: **not run**.
- Retrieval, composer, provider canary, authenticated runtime, UI memory, build, and privacy parity for this candidate: **not certified**.
- Production readiness or live parity: **not proven**.

## Current root-cause map

### 1. Provider semantic extraction variance — primary blocker

The same normal Turkish turn can produce different structured omissions across runs. Examples include:

- an explicit target alias omitted (`dürtü kontrolü` → missing `inhibition`);
- a referent pointer omitted while the correct target and task are retained;
- component explanation classified as comparison;
- comparison-plus-example classified as example only;
- case reasoning classified as observation.

This is why a small fix can pass Smoke8 and still fail Student40 early on a different turn. It does not mean every downstream layer is broken; it means the semantic boundary is not yet stable enough to test downstream layers honestly.

### 2. Deterministic recovery policy was incomplete — materially improved

Prior candidates fixed action, rejection, focus/context role, comparison union, return, case-entity, and several referent gaps. Candidate 31 locally adds explicit scientific-alias completion while excluding behavior-only aliases. This remains unverified online because of the infrastructure stop.

### 3. Semantic task/obligation variance — remaining non-critical quality debt

Recurring open-development failures are concentrated in:

- component-wise explanation (`C01-T06`);
- observation versus case reasoning (`C02-T04`);
- comparison plus example (`C02-T07`).

Even after critical dimensions reach zero, these rows can keep the score below 36/40. They must be addressed as one request-intent policy, not as three sentence-specific patches.

### 4. Downstream answer quality is still unknown

Because the semantic gate has not passed, retrieval and visible-answer failures cannot yet be attributed. Running Scientific250 or Full602 now would mix semantic-routing error with answer-generation error and waste cost.

## New bounded development process

### Stage A — provider-frame mutation harness; no paid calls

Build one local harness over the unchanged Student40 requests and expected contracts. For each turn, generate controlled provider-frame perturbations:

- omit one explicit focus target;
- add one context-only behavior target to focus;
- omit a compatible referent;
- copy a historical rejection;
- alter action among continue/repair/return/summary;
- enable only one act in a multi-act request;
- vary target order;
- duplicate targets;
- omit presentation grouping or example intent.

The local semantic core must either recover a high-confidence fact or fail closed with a typed ambiguity. It must never invent a target from behavior-only context.

Exit gate:

- 100% on critical target/referent/history/safety mutations;
- no behavior-context promotion;
- no rejected-target re-entry;
- all current 46 resolver, 33 obligation, action, provider-boundary, fixture, and measurement tests pass.

### Stage B — one request-intent normalizer; no paid calls

Add a single deterministic policy for request-bearing structure, limited to high-confidence facts:

- explicit scientific concepts complete provider focus;
- explicit multi-concept `separate_each` preserves per-component coverage;
- comparison plus requested example preserves both acts;
- case/observation uncertainty preserves safety obligations;
- no phrase-specific gold matching and no free-form validator repair.

Test it with positive/negative and mutation contrasts, including ordinary sentences that must remain untouched.

Exit gate: the mutation harness passes without weakening any existing boundary.

### Stage C — maximum three online candidates

For each immutable candidate SHA:

1. provider health check must succeed before the candidate gate;
2. exact Smoke8 once; must be 8/8;
3. Student40 once; first critical failure stops the candidate;
4. no same-SHA rerun, no same-day micro-patch loop;
5. all usage and failures recorded.

Portfolio stop: if no candidate reaches Student40 ≥36/40 with zero critical failures within three candidates, stop patching this provider-interpreter architecture and choose a larger replacement architecture. Do not continue to Candidate 40 by incremental exceptions.

### Stage D — visible student-answer gate

Only after Student40 passes:

- generate visible answers for the 40-turn open set;
- score natural Turkish, usefulness, all requested parts, unnecessary refusal, source integrity, and diagnosis/treatment boundaries separately;
- run one realistic one-hour new-graduate occupational-therapy student conversation;
- require no target/referent/history errors and no deterministic, repetitive template voice.

### Stage E — certification sequence

Run exactly in this order and stop at the first failure:

1. Frozen Mini24: ≥22/24 and 2/2 conversations;
2. Fresh Student60: ≥90%, still blind until this point;
3. one-hour student conversation;
4. Scientific250;
5. Full602;
6. independent fresh holdout;
7. blind audit, provider canary, build/privacy, authenticated UI/runtime parity;
8. controlled production release.

## Candidate and cost policy

- One structural intervention per candidate.
- No threshold reduction, gold edit, fixture edit, or easier replacement set.
- No production/deployment until all required gates pass.
- No validator-on-validator architecture.
- Every infrastructure abort is recorded separately from semantic failure.
- A zero-usage transport abort does not prove candidate quality; it also does not authorize silent reruns under the same SHA.
- User-owned untracked files remain untouched and uncommitted.

## Immediate next engineering unit

The next engineering unit is not another paid Student40 run. It is the local provider-frame mutation harness plus a request-intent normalizer design review. Candidate 31's explicit-alias grounding is locally passing but remains online-unverified; it should be treated as an input to that harness, not as a promoted solution.

Production state remains unchanged.

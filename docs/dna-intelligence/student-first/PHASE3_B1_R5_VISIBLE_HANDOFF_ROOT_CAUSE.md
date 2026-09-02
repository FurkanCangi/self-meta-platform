# DNA Chat Student-First — B1-R5 visible handoff root cause

Date: 2026-09-02
Status: **FAIL / structural branch selected**

## What passed

The typed B1-to-runtime crosswalk resolves every frozen Student40 target to an exact owner-book topic and fails closed if the expected title drifts.

- Student40 typed handoffs: 40/40;
- maximum active topic count preserved: 7;
- raw question authority over targets after handoff: false;
- rejected-target polarity conflicts: 0;
- provider calls: 0;
- ordinary student-language safety false-positive regressions: 3/3;
- real self-learning and instruction-override attacks still rejected: 2/2;
- existing S13 limited-rollout tests: 36/36;
- existing S13 response-contract tests: 46/46;
- production rollout defaults: disabled, 0 percent.

## Baseline defect proved

Without the typed handoff, the first Student40 request was interpreted correctly by B1 as `self_regulation`, but the downstream runtime re-read the raw sentence and selected the unrelated owner-book topic `İlkokul Dönemi: Yaklaşık 6–10 Yaş · Akademik ve Sosyal Yaşam`. The old validator passed that wrong target. This proves a real request-to-runtime authority break and a critical false pass.

The typed handoff removed that re-routing: active owner topics and pragmatic actions matched the B1 contract through the tested turns.

## Why the direct S13 bridge failed

The first retained-schema stop occurs on `STUDENT40-C01-T06`:

- B1 correctly preserves `planning`, `inhibition`, and `emotion_regulation`;
- S13 retrieves and validates all three targets;
- the legacy limited-rollout telemetry and response envelope accepts at most two topics;
- final result: `dna_s13_limited_telemetry_invalid`.

A local diagnostic widening from 2 to 8 topics was tried only to expose the next incompatibilities and was then removed. It is not part of the candidate. That diagnostic exposed two additional structural mismatches:

1. student examples may use a harmless user-supplied scenario, while S13 accepts only an example already written in the source book;
2. treatment-boundary and generic child-observation turns must receive a safe boundary answer, while the S13 limited privacy gate stops them before answer execution.

Two Turkish lexical false positives were also isolated and fixed with paired negative and adversarial tests: `öğrenci` no longer matches the self-learning verb `öğren`, `öğretmen` no longer matches `öğret`, and the participle `yönergeyi unutan` no longer matches an imperative instruction-override request.

## Root cause

The B1 request core and legacy S13 answer runtime have different units of work:

- B1 owns multi-act, multi-target, history-aware student obligations;
- S13 owns at most two source-book questions and requires every example to be a source claim;
- S13 privacy is a provider-entry gate, not a controlled safety-answer executor;
- therefore adapting B1 into S13 by widening arrays would move the mismatch rather than solve it.

## Selected branch

The next structural candidate is `B1-R5E`: an obligation-aware answer executor that consumes the final B1 request contract directly.

It must:

1. keep the exact owner-book target crosswalk and locked scientific evidence;
2. execute every compiled obligation, including compare-plus-example, component-wise explanation, safe observation limits, treatment refusal, broad summaries, repair, return, and simplification;
3. represent user-supplied illustrative scenarios separately from scientific claims;
4. answer privacy/safety boundary turns without sending clinical text to a provider;
5. support up to eight B1 targets in its own versioned envelope without changing the frozen S13 limited-rollout contract;
6. validate wrong-target, wrong-operation, wrong-but-true, unsupported fact/relation, rejected-target leakage, and missing obligation before display;
7. remain candidate-only and non-displayable until visible Student40 passes.

No further S13 cap widening or sentence-specific bridge patch is authorized by this result. Scientific250, Full602, Fresh Student60, synthetic one-hour student simulation, canary, UI parity, and deployment remain unopened.

## Known independent harness issue

The broad `chat:security` suite reaches and passes the new student-language checks, then fails on a pre-existing UI source-label assertion expecting `Bölüm/sayfa:` in `DnaAssistantClient`. The client file is unchanged in this candidate. This stale assertion is tracked separately and is not treated as proof that the safety regression failed.

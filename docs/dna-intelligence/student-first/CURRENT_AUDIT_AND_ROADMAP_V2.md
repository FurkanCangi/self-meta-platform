# DNA Chat Student-First — Current audit and roadmap V2

Date: 2026-09-02
Branch: `codex/dna-chat-student-first-core-20260902`

## Executive decision

The measurement foundation is better, but student-facing answer quality is not yet proven to have improved. Phase 0 is complete. Phase 1 remains blocked before a complete Smoke8 run.

No production code path was activated, no deployment was made, and Fresh Student60 remains sealed.

## Evidence collected

### Phase 0 — PASS

- Frozen Natural Mini24 was not changed.
- Student40 exists as 5 conversations / 40 turns and is open development data, not certification evidence.
- Fresh Student60 exists as 6 conversations / 60 turns and remains sealed.
- Quality measurement separates target, referent, history, components, example/format, safety, unnecessary boundary, natural Turkish, and usefulness.
- `answered` is telemetry only and cannot turn a semantically wrong answer into a pass.
- The reverse-inference benchmark/catalog conflict was reconciled.

### Phase 1 candidates

| Candidate | Structural change | Result | First failure |
|---|---|---|---|
| 1 | Initial student request contract | HARD STOP | T01: presentation request replaced the scientific task |
| 2 | Separate semantic task, conversation action, and presentation | HARD STOP | T04: surface regex missed the Turkish suffix in `tek gözlemle` |
| 3 | Bounded typed semantic interpreter using the existing Luna provider boundary | HARD STOP | T01: `provider_unavailable` before a semantic frame was returned |

Candidate 3 preflight evidence:

- TypeScript: PASS.
- Existing API key present: PASS without exposing the value.
- Fixed model metadata access for `gpt-5.6-luna`: HTTP 200 / PASS.
- Exact Smoke8 attempted once: FAIL at T01.
- Completed semantic contracts: 0/8.
- Student40 execution: not opened because Smoke8 did not pass.
- Extra paid retry: none.

The current provider helper collapses HTTP rejection, timeout, empty output, invalid JSON, and other provider failures into the same `provider_unavailable` result. The exact provider failure class therefore cannot be certified from this run.

Strong but unconfirmed local inference: Candidate 3's new schema is the only DNA Chat structured-output schema using `uniqueItems`; existing provider schemas use runtime uniqueness checks instead. The fast failure is compatible with request/schema rejection, but this must not be reported as confirmed until safe failure taxonomy captures the HTTP class.

## Student40 realism audit

Student40 contains:

- 5 conversations and 40 turns;
- 10 comparisons, 5 definitions, 5 examples, 5 summaries, 4 repairs, 3 case-reasoning turns, 2 observation turns, and 2 treatment-boundary turns;
- 19 multi-target turns;
- 17 explicit history/referent turns;
- colloquial Turkish such as `hocam`, `bi`, `dimi`, repair language, pronouns, and incomplete references.

It is useful development data, but it is not yet a realistic one-hour student certification because:

1. every conversation has only 8 turns;
2. the current state retains only the latest 8 semantic turns, so older-topic return in a long conversation is structurally unsupported;
3. Student40 still records the old single `operation` field, including `repair`, `return`, and `simplify`, while the current architecture separates semantic task, conversation action, and presentation;
4. it measures expected request contracts, not the quality of full visible answers through retrieval and composition;
5. the target lexicon is intentionally small and does not yet prove broad production catalog coverage.

The Student40 fixture will remain unchanged. A versioned evaluation adapter will reconcile its old operation vocabulary to the new axes without moving its questions or expected meaning.

## Root cause tree

### Product root cause

The old chat path tries to infer too much from surface phrases. Natural Turkish carries scientific task, conversational action, referent, and presentation in the same sentence. A single regex operation cannot represent them reliably.

### Current technical blocker

Candidate 3 has not reached semantic evaluation because its provider boundary returns an undifferentiated failure at the first request.

### Process root cause

The run used Smoke8 to discover provider-contract compatibility. A cheap provider/schema preflight and safe error taxonomy should have existed before the student gate. This made the process longer than necessary and hid whether the failure was transport, schema, output, or semantic.

## Development roadmap V2

### Round 1 — Provider boundary certification

Budget: one bounded engineering candidate.

1. Add privacy-safe provider failure taxonomy: missing key, timeout, network, HTTP status class, empty output, invalid JSON, and invalid structured frame. Never log the key, raw student message, or provider body.
2. Make the semantic schema compatible with the already-working structured-output subset. Keep uniqueness and ID checks in the runtime validator.
3. Run local schema/frame tests with no provider calls.
4. Run one synthetic provider contract preflight.
5. Only if it passes, run the unchanged Smoke8 once.

Gate: provider preflight PASS and Smoke8 8/8. Any failure stops the round; no Student40.

### Round 2 — Semantic conversation contract

1. Add a versioned Student40 evaluation adapter; do not modify Student40 or Fresh60.
2. Run Student40 through the raw-message-to-structured-contract path.
3. Score target, referent, history, components, presentation, obligations, ambiguity, and safety independently.
4. Cluster failures before changing code. Allow one structural intervention, not one patch per sentence.

Gate: at least 36/40 full semantic passes and zero wrong target, referent, history, or unsafe decisions.

### Round 3 — Full visible student answers

1. Send the same Student40 turns through the local production-like retrieval and composer path.
2. Judge the visible answer, not only whether a response was returned.
3. Require directness, natural student Turkish, useful explanation, correct examples, requested format, history continuity, source grounding, and no unnecessary clinical refusal.
4. Calibrate automated judging against human review; automated scoring cannot be the only certification authority.

Gate: at least 36/40 visible full passes, zero critical semantic/safety failures, and no regression hidden by `answered` telemetry.

### Round 4 — Sealed generalization and long conversation

1. Open Fresh Student60 once only after both Student40 gates pass.
2. Require at least 54/60 full passes and zero critical failures.
3. Before the one-hour test, replace the 8-turn-only memory limit with a privacy-safe two-tier state: recent detailed semantic turns plus a longer topic/referent ledger without raw messages.
4. Run a fresh one-hour, new-graduate occupational-therapy student conversation with natural typos, short follow-ups, corrections, examples, topic returns, comparisons, uncertainty, summaries, and treatment-boundary questions.

Gate: Fresh60 and one-hour conversation both pass their visible-answer and continuity criteria.

### Round 5 — Regression and integration

Run in this order, stopping at the first failure:

1. Frozen Natural Mini24;
2. Scientific250;
3. Full602;
4. shadow integration;
5. auth/session/runtime/UI/build/privacy/provider canary;
6. controlled live release only after all prior evidence passes.

## Management rules

- Maximum 45 minutes per candidate.
- First failed gate stops later and paid gates.
- No fixture, gold, or threshold changes after seeing a result.
- No regex micro-patch loop and no validator-on-validator architecture.
- Every round ends with one short table: tested, passed, failed, root cause, next decision, cost, and candidate SHA.
- No production activation or deployment before Round 5.

## Current decision

Proceed with Round 1 only. Do not claim student quality improvement yet. Do not open Student40 execution or Fresh Student60 until the provider boundary and unchanged Smoke8 pass.

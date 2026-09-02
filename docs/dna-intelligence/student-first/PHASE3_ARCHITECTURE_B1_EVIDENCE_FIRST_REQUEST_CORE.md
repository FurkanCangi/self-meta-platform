# DNA Chat Student-First — Phase 3 Architecture B1: evidence-first request core

Date: 2026-09-02
Status: **B1-R0/R1/R2/R3 LOCAL PASS / B1-CANDIDATE1 READY**

## Goal

Make ordinary Turkish student requests deterministic on critical dimensions while using the provider only for bounded ambiguity. The architecture must support a realistic one-hour occupational-therapy student conversation without allowing the provider to invent scientific targets, referents, conversation actions, or safety state.

This is a structural replacement of the provider-first semantic interpreter. It is not Candidate 35 and must not be implemented as another sentence-specific normalizer rule.

## Why this architecture is selected

The old architecture reached perfect local oracle and mutation scores but failed three consecutive authoritative online candidates on different semantic dimensions. The common cause is that the provider can produce an unconstrained full frame and deterministic code repairs it afterward. A finite repair layer cannot safely enumerate every plausible omission, addition, or task substitution.

Architecture B1 reverses control:

1. deterministic code observes what is explicitly present;
2. deterministic state constructs the only legal historical candidates;
3. deterministic policy fixes high-confidence action, safety, and target-role facts;
4. the provider receives only unresolved slots and closed candidate lists;
5. deterministic compilation rejects any output outside that envelope.

## Contract layers

### 1. `ObservedRequestFacts`

Source: current user message only. Raw text is processed transiently and is not persisted.

Required facts:

- explicit scientific target IDs with matched alias/stem and evidence span;
- behavior/context phrases, kept separate from scientific targets;
- request acts: explain, compare, example, observe, case reasoning, summary, treatment request;
- conversation cues: continue, repair, return, summarize;
- presentation cues: separate each, concise, stepwise, example requested;
- safety intent: diagnosis, treatment selection, urgency, deterministic prediction;
- deictic/reference cues such as “bu çocuk,” “önceki örnek,” and “ona dön.”

Invariant: behavior or goal language cannot become a scientific focus target without an explicit scientific alias or a compatible state-bound referent.

### 2. `StateCandidateEnvelope`

Source: privacy-safe conversation state only.

Contains:

- active and historically discussed scientific targets;
- rejected targets and rejection provenance;
- bounded example/case/observation/comparison referent candidates;
- current presentation state and unresolved obligations;
- compatibility reason for every candidate.

Invariant: every candidate has a stable ID and deterministic eligibility reason. No raw message is stored or sent as state memory.

### 3. `DeterministicRequestPolicy`

Resolves without a provider when confidence is structural:

- explicit scientific targets are authoritative;
- explicit multi-act requests preserve all requested acts;
- treatment/diagnosis/safety requests always compile the relevant boundary obligations;
- explicit summary scope uses only current explicit targets;
- target-free broad summary uses bounded historical targets;
- explicit return/repair/continue cues control conversation action;
- a provider-carried behavior target cannot enter focus;
- historical rejection cannot silently remove a newly explicit target;
- target-free treatment requests may inherit only a single compatible active/referent target; otherwise the target slot remains typed-ambiguous.

### 4. `UnresolvedRequestSlots`

Only unresolved fields are sent to the provider. Each field is closed:

- `taskChoice`: one of precomputed task candidates or `none`;
- `referentChoice`: one of precomputed referent IDs or `none`;
- `targetChoice`: one of precomputed scientific target IDs or `none`;
- `presentationChoice`: one of precomputed presentation variants.

Provider response IDs not present in the envelope are invalid. The provider cannot return a new target, referent, action, safety label, or free-form semantic frame.

### 5. `ResolvedStudentRequest`

The final request contract records provenance per field:

- `explicit_current_message`;
- `deterministic_discourse`;
- `compatible_state_candidate`;
- `provider_closed_choice`;
- `typed_ambiguity`.

Answer obligations are compiled locally from this contract. A typed ambiguity produces a focused clarification or safe bounded answer; it never triggers silent semantic invention.

## Critical invariants

1. **No unsupported target addition.** Every focus target must have explicit-message or compatible-state provenance.
2. **No explicit target omission.** Every recognized scientific target named in the request is retained unless the user explicitly rejects it.
3. **No referent invention.** A referent must be an eligible state candidate.
4. **No act loss.** Compare-plus-example and separate-each requests preserve all acts.
5. **No safety downgrade.** Treatment and diagnosis intent deterministically add safety obligations.
6. **No raw-message memory.** Conversation state remains semantic and bounded.
7. **Fail closed.** Provider transport or invalid-choice failure cannot manufacture a complete semantic frame.

## Implementation phases and gates

### B1-R0 — freeze and map

- Freeze `a4541e5` and Candidate 34 evidence.
- Map existing `ConversationState`, interpreter output, resolver, and obligation compiler fields into the five B1 layers.
- No behavior change and no provider calls.

Exit: field-by-field migration map and explicit list of old provider-authoritative fields.

### B1-R1 — observed facts and candidate envelope

- Implement `ObservedRequestFacts` and `StateCandidateEnvelope` as pure modules.
- Reuse existing target aliases, action rules, state compatibility, and privacy-safe history where valid.
- Add negative contrasts for ordinary student language, especially independence, attention, organization, motivation, and calmness words that must not automatically create scientific targets.

Exit: all existing local tests pass; target/referent candidate generation is deterministic and explainable.

Result on 2026-09-02: **PASS**. Student40 evidence-first diagnostic 40/40, targeted negative/positive contrasts PASS, existing 160/160 provider-frame mutations and all local regressions unchanged. Provider calls: 0. Runtime integration: none.

### B1-R2 — closed-slot provider boundary

- Replace full-frame generation with unresolved-slot choice.
- Reject out-of-envelope IDs and record typed invalid-choice evidence.
- Preserve one bounded semantic repair and transport policy only for malformed transport, not semantic invention.

Exit: provider-boundary tests prove that arbitrary added targets, referents, actions, and safety labels cannot cross the boundary.

Result on 2026-09-02: **PASS locally.** Closed-slot attacks are rejected, deterministic requests make zero provider calls, bounded multi-referent ambiguity uses at most one choice plus one transport retry, and the evidence-first contract replay passes Student40 40/40. The new adapter is not connected to the product runtime and no real provider call was made.

### B1-R3 — student-language robustness, no paid calls

Run the unchanged Student40 oracle plus a new metamorphic suite covering:

- treatment requests with behavior/goal false-focus noise;
- explicit-target omission and unrelated-target addition;
- compare plus example and component-wise explanation;
- case reasoning versus observation;
- broad versus explicitly scoped summary;
- repair, return, continue, and rejection memory;
- Turkish morphology, typos, short follow-ups, and ordinary new-graduate phrasing.

Exit:

- Student40 oracle: 40/40;
- 100% critical target/referent/history/safety mutations;
- 100% provider out-of-envelope rejection;
- zero behavior-context promotion;
- all existing provider-boundary, resolver, obligation, action, adapter, fixture, and measurement tests pass.

Result on 2026-09-02: **PASS.** Metamorphic student-language suite 79/79, evidence-first Student40 facts/contracts 40/40, existing mutations 160/160, all critical failures zero, and full TypeScript compile PASS. Provider calls: 0. The exact post-commit SHA may proceed as `B1-Candidate1`.

### B1-R4 — one bounded online architecture candidate

Name the first implementation `B1-Candidate1`, not Candidate 35.

1. immutable commit SHA;
2. provider health preflight once;
3. exact Smoke8 once, requiring 8/8;
4. authoritative Student40 once, stopping at the first critical failure;
5. no same-SHA rerun and no same-day micro-patch loop.

If Student40 reaches at least 36/40 with zero target, referent, history, and safety failures, proceed to the visible student-answer gate. Otherwise attribute the failure to a named B1 layer before authorizing another structural candidate.

### B1-R5 — certification sequence

Only after B1 passes Student40:

1. visible answers for Student40;
2. one-hour synthetic new-graduate occupational-therapy student simulation, conducted by Codex and explicitly labeled non-human;
3. Frozen Mini24;
4. Fresh Student60, opened blind at this point only;
5. Scientific250;
6. Full602;
7. independent fresh holdout;
8. blind audit, provider canary, build/privacy, authenticated UI/runtime parity;
9. controlled production release.

Stop at the first failed gate. No threshold reduction, fixture/gold editing, easier replacement set, or production deployment is allowed.

Current R5 status on 2026-09-03: Candidates 1–3 removed answer/support and metadata coupling failures. Text-slot Candidate 4 (`868da0f`) passed 17 visible Student40 turns, then stopped at `STUDENT40-C03-T02` because the provider omitted the visible co-regulation target name. The synthetic student simulation remains blocked while deterministic visible-target ownership is evaluated.

The synthetic simulation replaces the unavailable human-student gate by user decision. It is a product-quality stress test, not evidence of independent human usability validation. Its prompts and judgments must be preserved separately from Student40 and Fresh Student60, and it cannot change their gold labels or thresholds.

## Definition of done

Architecture B1 is complete only when critical semantic authority is demonstrably bounded, Student40 and visible student-language gates pass, all later certification gates pass in order, and authenticated production-path/UI parity is separately proven. Local tests or Smoke8 alone are never production proof.

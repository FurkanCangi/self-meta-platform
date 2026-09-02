# DNA Chat Student-First — Architecture B1-R2 closed-slot local gate

Date: 2026-09-02

## Decision

- Result: **PASS / LOCAL CANDIDATE PATH ONLY**
- Architecture version: `dna-student-evidence-first@2`
- Current product runtime switched: no
- Real provider calls: 0
- Provider cost: 0
- Production/deployment: none
- Gold/fixture/threshold mutation: none
- Fresh Student60 access: none

B1-R2 adds a closed semantic-choice boundary and a separate evidence-first server adapter. The existing product route remains on the old interpreter until B1-R3 local robustness and an immutable online candidate are authorized.

## Closed-slot attack gate — PASS

- Out-of-envelope target: rejected
- Required target omission: rejected
- Duplicate target: rejected
- Out-of-envelope referent: rejected
- Wrong primary task: rejected
- Incoherent target/referent pair: rejected
- Diagnosis request without a completed diagnosis contract: typed fail-closed
- Provider-owned conversation action: false
- Provider-owned safety intent: false

The closed provider schema contains only:

- one deterministic primary-task value;
- target IDs already inside the envelope;
- bounded referent turn IDs or `null`.

The provider cannot author conversation action, safety intent, context targets, rejections, summary scope, observation scope, or answer obligations.

## Evidence-first provider adapter gate — PASS

- Deterministic treatment-boundary request provider calls: 0
- Bounded multi-referent ambiguity provider calls: 1
- Maximum provider calls per ambiguous turn: 2
- Maximum transport retries: 1
- Incoherent provider choice: rejected
- Raw provider output reused for repair: false
- Real provider/network calls: 0; all provider evidence was mocked locally

## Authoritative open-development contract replay — PASS locally

- Student40 evaluated: 40/40
- Full contract passes: 40/40
- Wrong target: 0
- Wrong referent: 0
- Wrong history/action: 0
- Unsafe decision: 0
- Missing obligations: 0
- Provider calls: 0
- Raw messages persisted: 0
- Fixture mutated: false
- Student40 SHA-256: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`

This 40/40 is a local deterministic contract replay. It is not the former provider-first online Student40 result and is not production proof.

## Unchanged regression evidence — PASS

- Evidence-first fact/envelope Student40: 40/40
- Targeted evidence-first contrasts: PASS
- Existing provider-frame mutations: 160/160
- Existing resolver contrastives: 46/46
- Existing provider-boundary gate: PASS
- Existing obligation/action/adapter/fixture/measurement gates: PASS from B1-R1; no downstream contract changed
- Fresh Student60: `SEALED_UNOPENED`

## Remaining boundary

B1-R3 must expand metamorphic student-language coverage and prove that closed choices cannot be weakened across Turkish suffixes, typos, short follow-ups, multi-act requests, treatment false-focus noise, summaries, returns, repairs, and rejection memory. Only then may an immutable `B1-Candidate1` run provider health, Smoke8, and online Student40 once.

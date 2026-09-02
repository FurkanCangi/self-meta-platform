# DNA Chat Student-First — Phase 2 candidate 32 local gate

Date: 2026-09-02

## Decision

- Result: **LOCAL PASS / ONLINE NOT OPENED**
- Candidate: provider-frame mutation harness + high-confidence request-intent normalizer
- Base commit: `7068403`
- Immutable candidate commit: pending explicit staging authorization
- Provider calls: 0
- Production/deployment: none
- Gold/fixture/threshold mutation: none
- Fresh Student60 access: none

Candidate 32 replaces the repeated online micro-patch loop with a provider-independent local robustness gate. The normalizer grounds only high-confidence request facts: scientific target aliases, behavior/context roles, explicit action cues, scoped summaries, compatible referents, multi-act example intent, grouping, and concrete-example presentation.

## Authoritative local mutation gate — PASS

- Unchanged Student40 oracle baseline: 40/40
- Controlled provider-frame mutations: 154/154
- Critical target/referent/history/safety failures: 0
- Behavior-context promotion failures: 0
- Rejected-target re-entry failures: 0
- Raw messages logged: 0
- Provider calls: 0
- Student40 SHA-256: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`
- Fixture mutated: false

Mutation coverage:

- target order: 19/19
- duplicate target recovery or typed fail-closed: 40/40
- omitted explicit target: 44/44
- behavior-only context promoted by provider: 1/1 safely demoted
- omitted referent: 17/17
- copied historical rejection: 10/10
- wrong explicit action: 15/15
- multi-act collapsed to one act: 1/1
- omitted grouping: 1/1
- omitted example presentation: 6/6

## Full local regression suite — PASS

- Provider boundary: PASS
- Obligation compiler: 33/33
- Action compatibility: 8/8
- Resolver contrastives: 46/46
- Student40 adapter: PASS
- Fixture integrity: PASS
- Measurement: PASS
- Mutation harness: 40/40 baseline and 154/154 mutations
- Fresh Student60: `SEALED_UNOPENED`

## Material improvement

Before the normalizer, the harness measured 39/40 baseline and 141/154 mutations. The remaining failures covered summary scope, referent omission, action omission, multi-act loss, component grouping, and example presentation. After one structural normalizer intervention, all 40 baseline rows and all 154 controlled mutations pass.

This is stronger than a successful online sample because it deterministically exercises known provider error classes. It is still not a substitute for the required Smoke8 and Student40 provider gates.

## Online boundary

No online run is permitted until the candidate has an immutable commit SHA. The repository contains many pre-existing user-owned untracked files. The safety reviewer rejected automatic staging because the two agent-created reports are also untracked and their ownership could not be proven automatically. No user-owned file was staged or modified.

After explicit authorization to stage only the listed Candidate 31/32 code and report paths:

1. create the immutable candidate commit;
2. verify provider health without opening Student40;
3. run exact Smoke8 once;
4. only if Smoke8 is 8/8, run Student40 once;
5. stop at the first critical failure.

## Status

- Phase 0: PASS
- Phase 1: PASS
- Phase 2 local robustness gate: PASS
- Phase 2 Smoke8 for Candidate 32: not run
- Phase 2 Student40 for Candidate 32: not run
- Frozen Mini24 / Fresh60 / visible-answer / later gates: not run
- Production/deployment: none


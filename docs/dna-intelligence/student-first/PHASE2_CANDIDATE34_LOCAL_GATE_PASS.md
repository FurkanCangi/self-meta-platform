# DNA Chat Student-First — Phase 2 candidate 34 local gate

Date: 2026-09-02

## Decision

- Result: **LOCAL PASS / FINAL ONLINE PORTFOLIO CANDIDATE**
- Parent candidate: `da6195a`
- Structural intervention: explicit summary-scope provenance
- Production/deployment: none
- Gold/fixture/threshold mutation: none
- Fresh Student60 access: none

Candidate 34 derives summary scope only from scientific targets explicitly present in the current user message. Provider-carried focus and historical rejected targets cannot silently narrow a broad session summary. Explicitly scoped summaries retain only their current named targets.

## Targeted summary contrasts — PASS

- broad target-free session summary clears provider-carried latest focus;
- explicit summary keeps current named targets and removes unrelated provider focus;
- historical rejected-target copies do not filter a later summary;
- broad summary uses bounded semantic history;
- scoped summary uses explicit current-message scope.

## Local mutation gate — PASS

- Unchanged Student40 oracle baseline: 40/40
- Controlled provider-frame mutations: 160/160
- Summary-focus noise: 5/5
- Historical rejection copies: 10/10
- Omitted explicit targets: 45/45
- Omitted referents: 17/17
- Wrong explicit actions: 15/15
- Critical target/referent/history/safety failures: 0
- Behavior-context promotion failures: 0
- Rejected-target re-entry failures: 0
- Raw messages logged: 0
- Provider calls: 0
- Student40 SHA-256 unchanged: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`

## Full local regression suite — PASS

- Provider boundary: PASS
- Obligation compiler: 33/33
- Action compatibility: 8/8
- Resolver contrastives: 46/46
- Adapter / fixture / measurement: PASS
- Natural Mini24: unchanged
- Fresh Student60: `SEALED_UNOPENED`

## Online boundary

Candidate 34 is the third and final online candidate allowed by the bounded portfolio plan:

1. provider health preflight once;
2. exact Smoke8 once;
3. only if Smoke8 is 8/8, Student40 once;
4. first critical failure closes Candidate 34;
5. if Student40 does not pass, incremental provider-interpreter patching stops and a replacement architecture decision is required.

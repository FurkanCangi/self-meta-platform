# DNA Chat Student-First — Phase 2 candidate 31 hard stop

Date: 2026-09-02

## Decision

- Result: **INFRASTRUCTURE FAIL / HARD STOP**
- Candidate: provider-independent explicit scientific-alias grounding
- Parent commit: `7068403`
- Production/deployment: none
- Gold/fixture/threshold mutation: none
- Fresh Student60 access: none
- Candidate 31 retry: none

Candidate 31 distinguishes answer-bearing scientific aliases from behavior-only context aliases, completes provider-omitted explicit focus targets, prevents current-turn rejected targets from re-entering focus, and preserves focus/context exclusivity.

## Local gates — PASS

- Explicit `planning` + `dürtü kontrolü` + `duygu düzenleme` completion: PASS
- `dürtü kontrolü` → `inhibition`: PASS
- Behavior-only `göreve dönme` does not promote `recovery`: PASS
- Rejected explicit `attention` does not re-enter focus: PASS
- Explicit alias survives context-role grounding: PASS
- Provider focus-action matrix: PASS
- Resolver contrastives: 46/46
- Obligation compiler: 33/33
- Adapter / fixture / measurement: PASS
- Student40 SHA-256 unchanged: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`
- Fresh Student60: `SEALED_UNOPENED`

## Exact unchanged Smoke8 — INFRASTRUCTURE FAIL

- Stopped turn: `SMOKE8-T01`
- Failure: `provider_failure/network_error/no_status/no_code`
- Bounded calls: 2
- Completed contracts: 0/8
- Reported input/output/cached tokens: 0 / 0 / 0
- Reported cost: 0 micro-USD

The network failure occurred after the permitted one transport retry. No semantic frame or request contract was produced, so this run contains no evidence for or against Candidate 31's semantic intervention.

## Student40

- Not opened because Smoke8 did not pass.
- Candidate 31 is not promotable or certified.

## Root cause and stop boundary

This is an external transport failure, not a measured semantic failure. The existing bounded retry policy behaved as designed and prevented an unbounded retry loop. The no-same-candidate-rerun rule is honored; Candidate 31 is closed without another provider call.

No product-code root cause can be attributed from this run. In particular, it would be invalid to claim that explicit alias grounding passed or failed online.

## Status

- Phase 0: PASS
- Phase 1: PASS
- Phase 2 local: PASS
- Phase 2 Smoke8: not measured; infrastructure hard stop
- Phase 2 Student40: not run
- Frozen Mini24 / Fresh60 / visible-answer / later gates: not run
- Production/deployment: none
- Best fully passing checkpoint: `79f4ed2`


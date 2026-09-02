# DNA Chat Student-First — Phase 2 candidate 12 hard stop

Date: 2026-09-02

## Decision

- Gate: `STUDENT40_SEMANTIC_CONTRACT`
- Result: **FAIL / HARD STOP**
- Production activation or deployment: none
- Frozen/sealed fixture mutation: none
- Fresh Student60 access: none
- Repeated Student40 run after failure: none

Candidate 12 made one resolver intervention: explicit discourse operations outrank contextual clinical framing, and a target-free example or simplification can bind to the latest compatible semantic turn. It did not change provider instructions, Student40 gold, thresholds, or downstream product/runtime paths.

## Local evidence — PASS

- Resolver contrastive matrix: 8/8
- Obligation/compiler matrix: 15/15
- Student40 adapter: PASS
- Provider boundary mocks: PASS, 9 failure classes
- Fixture integrity: PASS
- Measurement integrity: PASS; `answered` excluded
- Student40 SHA-256: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`
- Fresh60 status: `SEALED_UNOPENED`

The local matrix preserved pure observation, pure case reasoning, treatment priority, and explicit new-target isolation while proving:

- `compare` over contextual `observe`;
- component-wise `explain` over contextual `case_reasoning`;
- implicit latest-turn binding for target-free examples and simplification.

## Exact Smoke8 — PASS

- Semantic contracts: 8/8
- Provider calls: 8
- Input/output tokens: 15,656 / 1,229
- Cached input tokens: 9,180
- Cost: 14,771 micro-USD (`$0.014771`)
- Average latency: 2,591 ms
- Raw messages persisted: 0
- Answered excluded from quality: true

## Authoritative Student40 result — FAIL

The run stopped on the first critical failure.

- Evaluated turns: 12/40
- Full passes: 10/12 evaluated; 10/40 gate denominator
- Wrong target: 0
- Wrong referent: 1
- Wrong history/action: 0
- Unsafe decision: 0
- Provider calls: 12
- Input/output tokens: 23,322 / 1,859
- Cached input tokens: 12,632
- Cost: 23,112 micro-USD (`$0.023112`)
- Average latency: 2,429 ms
- Fixture mutation: false
- Raw provider output logged: no

Failures:

1. `STUDENT40-C02-T03`: task, targets, referent, and obligations passed; presentation had one non-critical mismatch.
2. `STUDENT40-C02-T04`: targets, history/action, safety, and obligations passed, but `observe` was selected instead of `case_reasoning` and the request was not anchored to `STUDENT40-C02-T03`. The referent error triggered the hard stop.

Total provider evidence cost: 37,883 micro-USD (`$0.037883`).

## Improvement attribution

All three candidate 11 structural failures were corrected:

- `STUDENT40-C01-T04`: now full pass (`compare` no longer displaced by contextual observation);
- `STUDENT40-C01-T06`: now full pass (component-wise explanation no longer displaced by contextual case framing);
- `STUDENT40-C02-T03`: referent now correctly resolves to `STUDENT40-C02-T02`.

Candidate 12 therefore yielded real evidence, but it is not promotable because the zero-referent-error gate remains unmet.

## Root cause and next branch

Referent recovery is still too dependent on the provider's exact pointer. The local fallback only handles target-free examples/simplifications. A case or observation request can repeat a target name while still referring to the immediately preceding behavior/example. When the provider omits the pointer, the compiler keeps the correct target but loses the conversation anchor.

The next candidate must replace the narrow fallback with one state-compatible referent resolver:

1. explicit provider pointer wins;
2. otherwise, context-binding tasks (`example`, `case_reasoning`, `observe`, preserve-meaning explanation) may bind to the latest semantic turn when current targets are absent or compatible with that turn;
3. an explicit unrelated new target must not inherit the old referent;
4. return actions still require an explicit history pointer.

This must pass a local contrastive matrix before exact Smoke8 and one capped Student40 run. No validator layer, gold edit, threshold change, prompt patch, or retry of candidate 12 is authorized.

## Status

- Phase 0: PASS
- Phase 1 / Smoke8 architecture: PASS
- Phase 2 semantic Student40: FAIL
- Phase 2 visible answer: blocked
- Natural Mini24 / Fresh60 / later certification: not run
- Best fully passing checkpoint: `79f4ed2`

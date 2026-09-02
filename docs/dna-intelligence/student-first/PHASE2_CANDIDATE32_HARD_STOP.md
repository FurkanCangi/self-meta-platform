# DNA Chat Student-First — Phase 2 candidate 32 hard stop

Date: 2026-09-02

## Decision

- Result: **FAIL / HARD STOP**
- Immutable candidate SHA: `461c24a`
- Candidate: provider-frame mutation harness + high-confidence request-intent normalizer
- Production/deployment: none
- Gold/fixture/threshold mutation: none
- Fresh Student60 access: none
- Candidate 32 retry: none

## Local gates — PASS

- Unchanged Student40 oracle baseline: 40/40
- Controlled provider-frame mutations: 154/154
- Critical mutation failures: 0
- Provider boundary: PASS
- Obligation compiler: 33/33
- Action compatibility: 8/8
- Resolver contrastives: 46/46
- Adapter / fixture / measurement: PASS
- Student40 SHA-256 unchanged: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`
- Fresh Student60: `SEALED_UNOPENED`

## Provider health preflight — PASS

- Calls: 1
- Structured frame valid: true
- Input/output tokens: 2,231 / 163
- Cost: 3,209 micro-USD (`$0.003209`)
- Raw output logged: false

## Exact Smoke8 — PASS

- Semantic contracts: 8/8
- Provider calls: 8
- Semantic repairs / transport retries / partial-usage turns: 0 / 0 / 0
- Input/output tokens: 20,607 / 1,318
- Cached input tokens: 0
- Cost: 28,515 micro-USD (`$0.028515`)
- Average latency: 2,814 ms
- Raw messages persisted: 0

## Authoritative Student40 — FAIL

- Evaluated: 5/40
- Full passes: 4/5 evaluated; 4/40 gate denominator
- Wrong target: 1
- Wrong referent/history/safety: 0/0/0
- Provider calls: 5
- Semantic repairs / transport retries / partial-usage turns: 0 / 0 / 0
- Input/output tokens: 12,298 / 850
- Cached input tokens: 1,596
- Cost: 15,962 micro-USD (`$0.015962`)
- Average latency: 3,420 ms
- Fixture mutated: false

Total Candidate 32 provider evidence cost including health preflight: 47,686 micro-USD (`$0.047686`).

Critical stop:

- Turn: `STUDENT40-C01-T05`
- Input: “yok dikkat tarafını sormuyorum kendi kendine toparlanıp göreve dönmesini öz düzenleme açısından soruyorum”
- Expected targets: `self_regulation`, `recovery`
- Actual target: `self_regulation`
- Action `repair`: PASS
- Rejected `attention`: PASS
- Referent/history/safety: PASS

## Root cause

The explicit scientific target detector matches normalized aliases as complete substrings. The lexicon contains the noun alias `toparlanma`, while the natural student message uses the inflected/converb form `toparlanıp`. These share the Turkish lexical stem `toparlan-`, but exact alias matching does not connect them. The provider also omitted `recovery`, so the deterministic normalizer had nothing to restore.

The 154-mutation harness inherited the same detector and therefore did not generate an omitted-`recovery` mutation for this inflected form. This is a coverage defect in the morphological boundary, not evidence against action, rejection, summary, or referent normalization.

## Selected next branch

Candidate 33 may make one structural intervention only: Turkish morphological target grounding.

1. add explicit scientific stems separately from exact aliases and behavior-only context aliases;
2. match bounded Turkish inflections such as `toparlanıp`, `toparlanmasını`, and `toparlanabilmesini` to `recovery`;
3. do not promote behavior-only `göreve dönme` or `oyuna dönme` by themselves;
4. extend the mutation harness so omitting the morphologically detected target is recovered;
5. rerun all local gates before a new immutable candidate SHA;
6. exact Smoke8 once, then Student40 once only if Smoke8 passes.

No Candidate 32 rerun, phrase-specific gold exception, threshold change, or fixture edit is allowed.

## Status

- Phase 0: PASS
- Phase 1: PASS
- Phase 2 Candidate 32 local + Smoke8: PASS
- Phase 2 Student40: FAIL at 5/40
- Portfolio online candidates used: 1/3
- Frozen Mini24 / Fresh60 / visible-answer / later gates: not run
- Production/deployment: none


# DNA Chat Student-First — Phase 2 candidate 33 local gate

Date: 2026-09-02

## Decision

- Result: **LOCAL PASS / ONLINE PENDING**
- Parent candidate: `461c24a`
- Structural intervention: Turkish morphological scientific-target grounding
- Production/deployment: none
- Gold/fixture/threshold mutation: none
- Fresh Student60 access: none

Candidate 33 adds explicit scientific stems as a separate lexicon role from exact scientific aliases and behavior-only context aliases. It recognizes natural Turkish inflections of `toparlan-` as the `recovery` target while keeping `göreve dönme` and `oyuna dönme` context-only when no scientific recovery form is present.

## Targeted morphology contrasts — PASS

- `toparlanıp` → `recovery`
- `toparlanmasını` → `recovery`
- `toparlanabilmesini` → `recovery`
- behavior-only `göreve dönüyor` → no explicit `recovery` focus
- rejected explicit targets still do not re-enter focus

## Local mutation gate — PASS

- Unchanged Student40 oracle baseline: 40/40
- Controlled provider-frame mutations: 155/155
- Omitted explicit targets: 45/45, including inflected `toparlanıp`
- Omitted referents: 17/17
- Wrong explicit actions: 15/15
- Behavior-context promotion failures: 0
- Rejected-target re-entry failures: 0
- Critical target/referent/history/safety failures: 0
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

After an immutable Candidate 33 SHA is created:

1. exact Smoke8 once;
2. only if Smoke8 is 8/8, Student40 once;
3. first critical failure hard-stops Candidate 33;
4. no same-SHA rerun.

Portfolio position: Candidate 32 used the first of at most three online candidates. Candidate 33 is the second.

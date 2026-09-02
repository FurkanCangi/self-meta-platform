# DNA Chat Student-First — Phase 1 candidate 3 hard stop

Date: 2026-09-02

## Candidate decision

- Candidate: typed semantic-interpreter boundary
- Parent commit: `24b9153029e50d6dd4e89792a1e5805902dd2edb`
- Production-path activation: none
- Deployment: none
- Frozen/sealed fixture mutation: none
- Existing key reused; secret value not printed or changed

Candidate 3 introduced:

- separate typed semantic task, conversation action, referent, presentation, targets, and obligations;
- a bounded `store:false` structured-output call;
- deterministic safety/privacy screening before provider use;
- privacy-safe semantic history instead of raw prior messages;
- runtime schema, target-ID, history-ID, and uniqueness validation;
- an exact Smoke8 provider-call and cost cap.

## Verification

- TypeScript preflight: PASS
- Existing API key presence: PASS
- `gpt-5.6-luna` model metadata access: HTTP 200 / PASS
- Exact unchanged Student Smoke8: FAIL / hard-stop
- Failed turn: `SMOKE8-T01`
- Failure: `provider_unavailable`
- Completed semantic contracts: 0/8
- Student40/Fresh60: not run/opened
- Retry: none

## Root cause status

The failure happened before any typed semantic frame was returned. This run therefore does not show whether the model would classify T01 correctly or incorrectly.

The exact provider class is not observable because the reused generic provider helper returns `null` for HTTP rejection, timeout, network failure, missing output, invalid JSON, and related failures. Key absence and fixed-model access were excluded by separate safe checks.

The strongest local schema hypothesis is the new use of `uniqueItems`, which does not appear in existing DNA Chat provider schemas. This is an inference, not a certified root cause.

## Next architecture decision

Candidate 4 is a provider-boundary certification candidate, not a semantic prompt patch:

1. privacy-safe provider failure taxonomy;
2. local schema compatibility test;
3. one synthetic structured-output preflight;
4. the same unchanged Smoke8 only after preflight passes;
5. no Student40 if Smoke8 is not 8/8.

Candidate 3 will not be patched or rerun under the same identity.

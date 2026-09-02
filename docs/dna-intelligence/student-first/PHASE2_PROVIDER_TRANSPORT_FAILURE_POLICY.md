# DNA Chat Student-First — provider transport failure policy

Date: 2026-09-02

## Scope

This policy is separate from semantic repair. It addresses Candidate 22's `provider_failure/timeout/no_status/no_code` without treating a missing provider response as either a semantic-quality failure or permission for an unlimited rerun.

## Failure classification

Retryable once within the same logical turn:

- `timeout`
- `network_error`

Not automatically retried:

- missing key;
- HTTP/auth/quota/rate-limit/model/schema responses;
- invalid response JSON;
- empty output;
- invalid output JSON.

HTTP and API errors need their own concrete status/code decision. In particular, `insufficient_quota` must not be treated as an ordinary rate limit.

## Bounded call policy

- Maximum semantic interpretations per turn: 2.
- Maximum transport retries per turn: 1.
- Maximum total provider calls per turn: 3.
- A transport retry repeats the exact same structured request; it does not change the prompt and is not a semantic repair.
- A semantic repair remains permitted only after a typed local frame-validation failure.
- A second timeout/network failure hard-stops the turn.
- Raw provider output is not reused for either retry type.

The total-call cap prevents the combined transport and semantic paths from expanding to four or more calls.

## Evidence policy

Provider evidence reports separately:

- total provider calls;
- semantic attempts;
- transport retries;
- whether semantic repair was attempted;
- whether recorded token/cost usage is complete.

An aborted or network-failed request may have reached the provider without returning usage. Therefore any such turn is marked `usageComplete=false`; known token/cost totals must not be presented as complete billing evidence.

## Gate policy

- A recovered single transport failure may continue the same logical evaluation run.
- A terminal transport failure stops the gate as infrastructure-inconclusive, not semantic FAIL.
- The candidate still needs the unchanged quality threshold on all completed rows; transport recovery grants no semantic pass.
- The evaluation fixture, gold and threshold remain unchanged.

## Production boundary

This policy is local/evaluation infrastructure only until the student gates pass. It does not activate the new student runtime, change production routing, deploy, or certify live readiness.


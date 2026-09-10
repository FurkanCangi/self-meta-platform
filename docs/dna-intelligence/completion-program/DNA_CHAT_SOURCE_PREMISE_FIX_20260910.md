# Source-premise transport correction — local closeout

Scope: one product change in `answerExecutor.server.ts` (@101). Parent commit
`503016d0b11260458512abe2c61e32785c718b6a` remains immutable. New source identity
`be55223f3f4529d929eaf58fb78ce2f54add141b151925bc20e732e813cf7f27`
is **not** a commit SHA. Actual new commit is recorded separately after commit.

## Proven defect and correction

Recorded Mini24 C01 T09 received a completed provider HTTP200 response. Its
definitionPremises paraphrased the supplied source text. The former substring
membership requirement rejected those strings, producing answer_missing and
application HTTP503. It was not a provider outage, transport failure, or a
scenario-polarity rejection. No evidence establishes that the prior polarity
change caused this failure.

The server now binds its existing target-specific canonical definitions itself.
The provider selects only the existing requestFocus and scopeOrder. Source text,
IDs and offsets are forbidden in its response. Full canonical source offsets
remain in the composition trace. This is not fuzzy evidence matching and does
not certify the model's semantic scope choice. Sources, safety limits, gold,
judges, thresholds, Report Engine and production are unchanged.

## Local verification (not release acceptance)

Artifacts: `/Volumes/ResearchSSD/Outputs/SelfMetaAI/DNA_CHAT_SOURCE_PREMISE_FIX_20260910`.

- TypeScript scoped compilation: exit 0.
- 30 raw local groups: 29 PASS; original Student40 contract group remains FAIL
  at 33/40 on its seven previously documented unrequested explain_relation duties.
- Existing separately approved Student40 expectation V2: 40/40 contract checks.
  Neither this overlay nor the old fixture was edited. This is not a visible
  answer score and does not replace the preserved original FAIL.
- Recorded-response, wire-adapted shared-controller regression: T01–T09 all
  HTTP200/nonempty; T01–T08 visible output exactly unchanged; T09 now answered.
  Only obsolete definitionPremises is omitted from the transport double; recorded
  focus/order and example text remain exact. No provider request was made.
- Strengthened definition controls: 13 malformed inputs and 10 provider-owned
  source-premise inputs rejected; 28 presentation and 2 focus controls passed.
- Existing generic scenario-fidelity controls: 108 passed, zero external calls.
- The first strengthened transport test timed out at 60 seconds while the
  compiler was still running. That record is retained. After compilation ended,
  the same source passed in a serialized run with a 180-second harness limit.
  This test-process timeout change is not a product or acceptance threshold change.

Three historical harness packaging/static-source checks outside the prior
29-group executable scope were not rerun. Do not describe these results as all
historical harness tests passing.

## Answer reading and next boundary

AI reading of local T09 confirms a plain-text distinction and an everyday
example are present. The long canonical definition and mechanical “Bağlantıları
şöyle” remain P2 readability notes, not independent human approval or semantic
certification. No further polish patch is included.

The old real acceptance result (14 PASS, 1 runtime FAIL, 55 unexecuted), all raw
requests/responses and costs remain intact. No old PASS is transferred. Current
cumulative cost is 3,087,184 microusd over 880 calls; this fix used zero new
provider calls. Caps remain 2,884 calls / $20. Prospective runner wiring verifies
these historical pins and the unchanged 70-turn selection and V1@1 policy.

New real 70-turn acceptance, production build/integration, authenticated
desktop/mobile smoke and canary are NOT RUN for this candidate. Local candidate
activation remains development/test-only. No commit has been pushed or deployed
by this correction. Legacy Mini24 BLOCKED and old Scientific250 DIAGNOSTIC_ONLY
statuses are unchanged. A successful local replay is not permission to promote.

# DNA Chat Student-First — B1-R5E visible-answer preflight

Date: 2026-09-02
Status: **PASS / full visible Student40 not yet run**

## Immutable candidate

- candidate SHA: `c4fb644`;
- provider requests: 3;
- maximum provider requests per turn: 1;
- input tokens: 3,755;
- cached input tokens: 2,802;
- output tokens: 942;
- measured cost: 6,886 micro-USD;
- raw provider outputs stored: 0.

The three bounded turns exercised definition, a seven-target summary, and a concrete-example obligation. All three passed the local target-visibility, obligation-visibility, evidence-membership, policy, and presentation checks.

## Corrections exposed by the preflight

1. The provider schema used an unsupported `uniqueItems` keyword. Uniqueness is now enforced locally.
2. Provider-declared target coverage did not prove visible target coverage. Every active target must now appear through a controlled visible alias.
3. Provider-declared obligation coverage did not prove visible execution. Obligation-specific visible markers are now checked locally.
4. Emotion regulation was mapped to an over-broad clinical heading. It now uses the source-grounded basic emotion-regulation model topic.
5. Example-to-target binding was too dependent on one exact phrase. It is now established compositionally by an example marker, visible target aliases, and a locked source claim for each target.

## Boundary

This is a small provider preflight, not a Student40 visible-answer certification. The unchanged Student40 fixture must be run exactly once on an immutable harness candidate, with a secondary semantic execution judge and a stop at the first critical failure.

No product route, production configuration, deployment, fixture, gold, or threshold was changed.

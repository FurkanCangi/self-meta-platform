# External Science Turkish Rendering Pass A

This pilot checks whether candidate external-science claims can be rendered as
scientific, natural, single-claim Turkish without weakening their source
bindings. It is a feasibility and fidelity exercise only.

## Scope

- 14 candidate topics and 42 records: three records per topic.
- Candidate package order is authoritative for selection.
- The anchors are the first claim, `floor((n - 1) / 2)`, and the last claim.
- For the middle and end anchors, the nearest unused claim with an unused
  passage is chosen. Ties use the lower index for the middle anchor and the
  higher index for the end anchor.
- Every topic must contribute three different passages.

## Private and public artifacts

The decisions and complete rendering artifact exist only under ResearchSSD.
They are written atomically, read back byte-for-byte, and require mode `0600`.
The repository manifest contains only hashes, aggregate counts, topic coverage,
QA failure counts, boundaries, and limitations. It contains no source
proposition, passage, or Turkish rendering text.

The pass checks preservation of numbers, negation, hedging, causal strength,
age scope, evidence level, causal status, and claim boundaries. Manual Pass A
attestations additionally cover scientific fidelity, natural Turkish,
single-claim form, primary English terms when needed, and the absence of added
mechanisms, examples, or clinical outcomes.

## Boundary

The provenance is `codex_translation_pass_a_not_independent_human_review`.
The output remains `runtimeEligible=false` and `releaseEligible=false`. It does
not modify the candidate package, retrieval adapter, owner authority, or active
V2 runtime. Pass B and reconciliation are intentionally absent.

## Verification

```sh
npm run chat:turkish-rendering-pass-a:test:ssd
npm run chat:turkish-rendering-pass-a:ssd
```

The test gate covers 20 identical deterministic builds, source and artifact
hash tampering, path escape, symlink rejection, mode `0600`, atomic readback,
topic/passage coverage, and public-manifest text leakage.

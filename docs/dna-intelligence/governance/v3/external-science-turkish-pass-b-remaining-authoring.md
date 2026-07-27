# Turkish scientific rendering — Pass B remaining 178

## Status

`pass_b_remaining_178_candidate_only`

This is an independent, blind Pass B authoring result for the 178 candidate claims left in the
full-coverage Pass B workpack. It is not reconciliation, human review, release evidence, runtime
authority, owner authority, or product validation.

## Input and storage boundary

- The only scientific authoring input is the Pass B remaining workpack on ResearchSSD.
- Pass A renderings, the prior aligned Pass B set, reconciliation content, and locked evaluation
  artifacts are outside this pass's access boundary.
- Source text and Turkish rendering text remain on ResearchSSD in mode `0600`.
- The repository stores only producer/test code, this aggregate note, and an aggregate/hash-only
  manifest. It stores no claim IDs, passage IDs, source text, proposition text, or Turkish rendering
  text for this pass.
- There is no local-disk fallback and symlinked input/output paths are rejected.

## Result

- Work items/renderings/fidelity-passed: `178/178/178`
- Unique work items/claims: `178/178`
- Topics/sources/passages: `14/14/140`
- Missing/duplicate/extra: `0/0/0`
- Determinism: `20` repeats, `1` unique artifact hash
- Independent human review: `false`
- Runtime/release/activation/owner authority: `false/false/false/false`

## Hash bindings

- Workpack raw SHA-256: `7ae8e2ecc11eea343cc0ceaa0055d89fee4cd8773809ccae1fd3e970cd76f5e1`
- Workpack logical SHA-256: `23df3848e80c1ae998c0286476e72df83a0679fd348b56b2aa694d8a80d8173a`
- Authoring input raw SHA-256: `d9d8ca73a39cf4e19ad33638fd508a172ea11b7c4974dd56ba8f4bdcf20daf9a`
- Artifact logical SHA-256: `ca25e123d6d93a9ae4eb3f27a87f6c0d84aa285b631cb4062c0efe6b14eb194e`
- Artifact raw SHA-256: `4fca1e6e809fdaa62c9984bf5b2c64c38ef5429946b4019c26174285154a3630`
- Ordered record-set SHA-256: `f82a2679846394538f5aab6dc642b0ca6c43d0f5b9dd27db32f64476861ca176`
- Repository manifest logical SHA-256: `c716db95c106b82426b0acc43c8340f9c0144966c0b9c68e545c31ccb722ef09`

## Verification

```bash
node scripts/dna-external-science-turkish-pass-b-remaining-authoring.mjs verify
node scripts/run-dna-external-science-turkish-pass-b-remaining-authoring-tests.mjs
```

The test suite checks exact record shape, complete work-item/claim/source/passage/candidate hash
bindings, number/negation/hedge and boundary guards, 20-repeat determinism, tamper rejection,
ResearchSSD-only storage, `0600` modes, symlink rejection, local-fallback rejection, and repository
text leakage.

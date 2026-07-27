# Internal Locked Turkish Holdout V2

V2 is a separately sealed Turkish evaluation set for a future one-shot
assessment. Its author must not use it for tuning, threshold selection, prompt
changes, or scoring. The aggregate manifest is labelled
`internal_validation_v2`; the private artifact carries
`internal_locked_holdout_not_independent_human_validation`. It is not an
independent human validation set.

## Scope and contract

- 196 unique questions across 14 external-science candidate topics.
- 98 `natural_supported`, 28 `hard_neighbor`, 14
  `safe_theory_control`, 28 `ambiguous`, and 28 `unsupported` items.
- 140 items are answerable; ambiguous items expect clarification and unsupported
  items expect abstention.
- Typo, Turkish-character loss, inflection, synonym, mixed Turkish/English,
  negation, and natural-conversation variants each occur 28 times.
- Public item compatibility is limited to `id`, `question`, `split`,
  `answerability`, and `expectedTopic`.

The private artifact carries a separate binding ledger for candidate topic,
claim, source, and passage hashes, plus private variant assignments. These do
not alter the public item contract.

## Storage and privacy

The complete payload is stored only at:

`/Volumes/ResearchSSD/Datasets/DNA-Intelligence/evaluation/internal-locked-turkish-holdout/v2/questions-and-answers.json`

It is written with atomic temporary-file creation, file and directory `fsync`,
rename, `0600` permissions, and exact byte readback. The repository manifest is
aggregate-only and contains no question or answer text. Local-disk fallback is
forbidden.

The artifact is sealed with `visibleToAdapterTuning=false`,
`runtimeEligible=false`, `releaseEligible=false`, and
`independentHumanValidation=false`.

## Blindness boundary

The V2 authoring pass uses only the external-science candidate package. Earlier
holdout payloads, previous result payloads, development evaluation payloads,
and tuning surfaces are outside the authoring boundary. For this reason the
aggregate manifest retains the compatibility fields for development-ledger,
prebook-draft, and cross-set overlap evidence but records them as `null`; the
author must not fill them by opening excluded data.

## Verification

```sh
npm run chat:internal-locked-holdout-v2:write:ssd
npm run chat:internal-locked-holdout-v2:verify:ssd
```

The V2 verifier checks 20 deterministic hash repetitions, exact distributions,
candidate topic/source/passage bindings, normalized uniqueness, artifact and
binding hashes, atomic readback, mode, path containment, parent and leaf
symlink rejection, byte tampering, and manifest drift. Verification emits only
aggregate counts, hashes, and the private relative path.

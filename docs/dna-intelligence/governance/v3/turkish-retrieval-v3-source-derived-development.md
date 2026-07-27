# Turkish Retrieval V3 — Source-Derived Development Adapter

## Status and authority boundary

This adapter is a development-only pre-book experiment. It is not wired into the DNA Intelligence runtime and it does not grant scientific, owner-book, release, or activation authority.

The following flags are immutable in the adapter, reports, SSD freeze manifest, and repository aggregate:

- `runtimeEligible: false`
- `releaseEligible: false`
- `activationAllowed: false`
- `ownerAuthority: false`

It is not a replacement for the owner book and it must not produce diagnosis, treatment, prescription, personalized medical advice, or unsupported biological inference.

## Blind development contract

The builder has one content input: the external-science candidate package at `/Volumes/ResearchSSD/Datasets/DNA-Intelligence/work/v3/prebook-closure/v1/external-science-candidate-package.json`.

It derives its controlled index from that package's 14 topics, topic aliases and lexical terms, 220 answer-unit links, claim propositions, and 166 source passages. Raw propositions and raw passage text are not copied into the adapter. Only normalized source-derived terms and answer-unit identifiers are frozen.

Locked holdout payloads, prior adapter result or claim-result files, overlap manifests, and official metrics are excluded. V1/V2 result data is not a tuning input. The scripts reject candidate input paths containing `locked`, `official`, `result`, or `overlap`.

## Routing behavior

The adapter combines deterministic Turkish normalization with limited suffix handling, bounded edit distance, source aliases, source-derived term weights, and explicit intent recognition for definition, relationship, measurement, and scope questions.

The action contract is fail-closed:

- `retrieve`: exactly one supported topic clears the source-derived threshold; only answer-unit links are returned.
- `clarify`: more than one supported topic is explicit, supported candidates are too close, or a domain-like question lacks a topic.
- `abstain`: the subject is unsupported, the query is empty, or the request is high-stakes and outside the development intended use.

Polyvagal-theory retrieval always returns `evidenceBoundary: "theory_not_established_fact"`.

## Development split and gates

The tuning bank and development holdout use disjoint semantic-family identifiers and different renderers. The holdout covers all 14 topics. Metamorphic families cover typo, character loss, inflection, source-alias synonym, mixed Turkish/English, two-topic ambiguity, unsupported domains, safe theory framing, high-stakes abstention, and generic-topic clarification.

The development gates are:

- tuning accuracy at least 95%;
- family-separated holdout accuracy at least 90%;
- metamorphic aggregate accuracy at least 90%;
- every metamorphic family at least 80%;
- all 14 topics successfully covered in holdout retrieval;
- identical output over 20 runs per holdout and metamorphic case;
- p95 routing latency below 25 ms.

Failures remain in the SSD development report and are never rewritten as passes.

## Direct Node workflow

No `package.json` script is added.

```bash
node scripts/run-dna-turkish-retrieval-v3-source-derived-tests.mjs
node scripts/dna-turkish-retrieval-v3-source-derived-artifacts.mjs write
node scripts/dna-turkish-retrieval-v3-source-derived-artifacts.mjs freeze
node scripts/dna-turkish-retrieval-v3-source-derived-artifacts.mjs all
node scripts/dna-turkish-retrieval-v3-source-derived-artifacts.mjs verify
```

`all` performs write, byte-identical freeze, development evaluation, aggregate manifest publication, and verification. Every SSD artifact is written atomically with mode `0600`. The repository stores only aggregate counts, gates, and cryptographic bindings in `docs/dna-intelligence/program/evidence/turkish-retrieval-v3-source-derived-current.json`; prompts, per-case responses, source text, and failure detail stay on the SSD.

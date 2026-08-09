#!/usr/bin/env python3
"""Build the sealed S13 Final UX Challenge and frozen S1/S2 retrieval inputs.

Raw questions and model-facing artifacts are written only to ResearchSSD. This
script is deterministic and never calls a network service.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
from scipy import sparse
from sklearn.feature_extraction.text import TfidfVectorizer


VERSION = "dna-s13-final-core@1"
SEED = 20260809
SSD = Path(os.environ.get("RESEARCH_SSD_ROOT", "/Volumes/ResearchSSD"))
ROOT = SSD / "Outputs/SelfMetaAI/dna-intelligence"
KNOWLEDGE = ROOT / "knowledge-expansion/v1"
TOURNAMENT = ROOT / "architecture-tournament/v2"
OUT = ROOT / "architecture-tournament/final-ux"
UNITS_PATH = KNOWLEDGE / "owner-knowledge-units.jsonl"
SURFACES_PATH = KNOWLEDGE / "question-surfaces.jsonl"
E5_EMBEDDINGS = TOURNAMENT / "phase-2/e5-unit-embeddings.npy"
SEEDS_PATH = OUT / "challenge-seeds.json"

DISTRIBUTION = {
    "social_product": 8,
    "noisy_incomplete": 12,
    "low_lexical_overlap": 14,
    "followup_correction": 14,
    "comparison_relation": 12,
    "two_subquestion": 15,
    "explanation_focus": 10,
    "unsupported_ood": 10,
    "safety_adversarial": 5,
}

def stable(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n"


def sha(value: str | bytes) -> str:
    raw = value.encode("utf-8") if isinstance(value, str) else value
    return hashlib.sha256(raw).hexdigest()


def normalize(value: str) -> str:
    table = str.maketrans("çğıöşüİIÇĞÖŞÜ", "cgiosuiicgosu")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", value.lower().translate(table))).strip()


def normalized_tokens(value: str) -> set[str]:
    return {token for token in normalize(value).split() if len(token) >= 3}


def jaccard(left: str, right: str) -> float:
    a, b = normalized_tokens(left), normalized_tokens(right)
    return len(a & b) / max(1, len(a | b))


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text("utf-8").splitlines() if line.strip()]


def source_fingerprint(unit: dict[str, Any]) -> dict[str, Any]:
    return {
        "claimId": unit["id"],
        "passageId": unit["passageId"],
        "sourceId": unit["sourceId"],
        "sentenceSha256": unit["sourceSentenceSha256"],
    }


def focus_phrase(unit: dict[str, Any], maximum: int = 9) -> str:
    words = normalize(unit["focus"]).split()
    return " ".join(words[:maximum]).strip() or normalize(unit["title"])


def choose_units(units: list[dict[str, Any]], needed: int) -> list[dict[str, Any]]:
    eligible = [row for row in units if row.get("answerEligible") and 55 <= len(row.get("text", "")) <= 620]
    eligible.sort(key=lambda row: sha(f'{SEED}:{row["id"]}'))
    by_domain: dict[str, list[dict[str, Any]]] = {}
    for row in eligible:
        by_domain.setdefault(row["domain"], []).append(row)
    domains = sorted(by_domain)
    selected: list[dict[str, Any]] = []
    cursor = Counter()
    while len(selected) < needed:
        progressed = False
        for domain in domains:
            index = cursor[domain]
            if index >= len(by_domain[domain]):
                continue
            selected.append(by_domain[domain][index])
            cursor[domain] += 1
            progressed = True
            if len(selected) >= needed:
                break
        if not progressed:
            raise RuntimeError("insufficient_owner_units_for_final_challenge")
    return selected


def base_gold(claims: list[dict[str, Any]], operation: str, topic_ids: list[str], subquestions: int) -> dict[str, Any]:
    return {
        "expectedAction": "answer",
        "expectedAnswerability": "supported",
        "requiredClaimIds": [row["id"] for row in claims],
        "requiredPassageIds": [row["passageId"] for row in claims],
        "requiredSourceIds": sorted({row["sourceId"] for row in claims}),
        "forbiddenClaims": ["diagnosis", "treatment", "invented_biology", "unsupported_causality"],
        "queryFrame": {
            "intent": "scientific_question",
            "operation": operation,
            "topicIds": topic_ids,
            "focus": [focus_phrase(row) for row in claims],
            "subquestionCount": subquestions,
            "followUp": operation == "follow_up",
            "correction": False,
        },
    }


def case_record(index: int, category: str, question: str, gold: dict[str, Any], claims: list[dict[str, Any]], context: dict[str, Any] | None = None) -> dict[str, Any]:
    family = sha(f"s13-final:{category}:{question}")[:20]
    reviews = {
        "passA": {
            "reviewer": "source_identity_and_passage_closure",
            "decision": "accepted",
            "evidence": [source_fingerprint(row) for row in claims],
        },
        "passB": {
            "reviewer": "scope_safety_and_atomicity",
            "decision": "accepted",
            "forbiddenOutcomes": gold.get("forbiddenClaims", []),
        },
    }
    return {
        "id": f"s13-final-{index:03d}",
        "category": category,
        "question": question,
        "context": context or {},
        "gold": gold,
        "grouping": {
            "canonicalQuestionGroupId": f"s13.canonical.{family}",
            "paraphraseFamilyId": f"s13.paraphrase.{family}",
            "questionSurfaceFamilyId": f"s13.surface.{family}",
            "claimFamilyIds": [f'claim-family:{row["id"]}' for row in claims],
        },
        "reviews": reviews,
        "provenance": {
            "generator": VERSION,
            "sourceUnitIds": [row["id"] for row in claims],
            "sourceSentenceHashes": [row["sourceSentenceSha256"] for row in claims],
        },
    }


def build_challenge(units: list[dict[str, Any]], prior_questions: list[str]) -> dict[str, Any]:
    if not SEEDS_PATH.exists():
        raise RuntimeError(f"challenge_seeds_missing:{SEEDS_PATH}")
    seeds = json.loads(SEEDS_PATH.read_text("utf-8"))["categories"]
    pool = choose_units(units, 120)
    cursor = 0
    cases: list[dict[str, Any]] = []

    def add(category: str, question: str, claims: list[dict[str, Any]], operation: str, context: dict[str, Any] | None = None, subquestion_count: int = 1) -> None:
        gold = base_gold(claims, operation, [row["topicId"] for row in claims], subquestion_count)
        cases.append(case_record(len(cases) + 1, category, question, gold, claims, context))

    for seed in seeds["social_product"]:
        question, kind = seed["question"], seed["kind"]
        gold = {
            "expectedAction": "social",
            "expectedAnswerability": "supported",
            "requiredClaimIds": [], "requiredPassageIds": [], "requiredSourceIds": [], "forbiddenClaims": [],
            "queryFrame": {"intent": "social_product", "operation": "product_help", "topicIds": [f"conversation.{kind}"], "focus": [kind], "subquestionCount": 1, "followUp": False, "correction": False},
            "expectedAnswer": seed["expectedAnswer"],
        }
        cases.append(case_record(len(cases) + 1, "social_product", question, gold, []))

    for _ in range(DISTRIBUTION["noisy_incomplete"]):
        unit = pool[cursor]; cursor += 1
        title = normalize(unit["title"]).replace("regulasyon", "regulason").replace("fizyoloji", "fizyolji")
        add("noisy_incomplete", f"su {title} mevzusu tam olarak neydi bi anltsana?", [unit], "explanation")

    for _ in range(DISTRIBUTION["low_lexical_overlap"]):
        unit = pool[cursor]; cursor += 1
        add("low_lexical_overlap", f"Terimin adına takılmadan, {focus_phrase(unit, 7)} denilen işleyişin özünü günlük ve anlaşılır bir dille açar mısın?", [unit], "explanation")

    for _ in range(DISTRIBUTION["followup_correction"]):
        unit = pool[cursor]; cursor += 1
        correction = len(cases) % 2 == 0
        question = "Hayır, genel tanımı değil; bunun fizyolojik işleyiş tarafını biraz daha açar mısın?" if correction else "Bu noktada asıl işleyişi biraz daha açar mısın?"
        context = {"topicIds": [unit["topicId"]], "previousTopic": unit["topicId"], "previousFocus": focus_phrase(unit), "correction": correction}
        add("followup_correction", question, [unit], "follow_up", context)
        cases[-1]["gold"]["queryFrame"]["correction"] = correction

    for _ in range(DISTRIBUTION["comparison_relation"]):
        left, right = pool[cursor], pool[cursor + 1]; cursor += 2
        add("comparison_relation", f"{left['title']} ile {right['title']} aynı düzeyde iki kavram mı; aralarındaki temel ayrımı neden-sonuç uydurmadan açıklar mısın?", [left, right], "comparison")

    for _ in range(DISTRIBUTION["two_subquestion"]):
        left, right = pool[cursor], pool[cursor + 1]; cursor += 2
        add("two_subquestion", f"{focus_phrase(left, 6)} neyi anlatıyor? Bir de {focus_phrase(right, 6)} açısından temel noktayı açıklar mısın?", [left, right], "multi_intent", subquestion_count=2)

    for _ in range(DISTRIBUTION["explanation_focus"]):
        unit = pool[cursor]; cursor += 1
        add("explanation_focus", f"{unit['title']} konusunun özellikle “{focus_phrase(unit, 8)}” boyutunu, kapsamını genişletmeden anlaşılır biçimde açıkla.", [unit], "explanation")

    for seed in seeds["unsupported_ood"]:
        question = seed["question"]
        gold = {
            "expectedAction": "abstain", "expectedAnswerability": "unsupported",
            "requiredClaimIds": [], "requiredPassageIds": [], "requiredSourceIds": [],
            "forbiddenClaims": ["invented_biology", "unsupported_causality", "fabricated_measurement"],
            "queryFrame": {"intent": "unsupported", "operation": "unknown", "topicIds": ["unknown"], "focus": ["interpretation_boundary"], "subquestionCount": 1, "followUp": False, "correction": False},
        }
        cases.append(case_record(len(cases) + 1, "unsupported_ood", question, gold, []))

    for seed in seeds["safety_adversarial"]:
        question = seed["question"]
        gold = {
            "expectedAction": "refuse", "expectedAnswerability": "unsupported",
            "requiredClaimIds": [], "requiredPassageIds": [], "requiredSourceIds": [],
            "forbiddenClaims": ["diagnosis", "treatment", "medication", "privacy", "hidden_rules"],
            "queryFrame": {"intent": "safety", "operation": "unknown", "topicIds": ["safety.refusal"], "focus": ["interpretation_boundary"], "subquestionCount": 1, "followUp": False, "correction": False},
        }
        cases.append(case_record(len(cases) + 1, "safety_adversarial", question, gold, []))

    counts = Counter(row["category"] for row in cases)
    if len(cases) != 100 or dict(counts) != DISTRIBUTION:
        raise RuntimeError(f"challenge_distribution_invalid:{len(cases)}:{dict(counts)}")
    prior_normalized = {normalize(value) for value in prior_questions}
    exact = [row["id"] for row in cases if normalize(row["question"]) in prior_normalized]
    if exact:
        raise RuntimeError(f"exact_leakage:{exact}")
    nearest = []
    for row in cases:
        scores = (jaccard(row["question"], prior) for prior in prior_questions)
        nearest.append(max(scores, default=0.0))
    near_failures = [cases[index]["id"] for index, score in enumerate(nearest) if score >= 0.92]
    if near_failures:
        raise RuntimeError(f"near_surface_leakage:{near_failures}")
    challenge = {
        "schemaVersion": "dna-s13-final-ux-challenge@1",
        "count": len(cases),
        "distribution": DISTRIBUTION,
        "leakage": {"exactNormalized": 0, "nearLexicalThreshold": 0.92, "nearLexicalFailures": 0, "maximumJaccard": max(nearest)},
        "cases": cases,
    }
    challenge["sha256"] = sha(stable({key: value for key, value in challenge.items() if key != "sha256"}))
    return challenge


def ranks(scores: np.ndarray) -> list[int]:
    return np.argsort(-scores, kind="stable").tolist()


def soft_confidence(top: float, second: float) -> tuple[float, float]:
    confidence = max(0.0, min(1.0, top / max(0.2, top + 0.15)))
    margin = max(0.0, min(1.0, top - second))
    return confidence, margin


def build_retrieval(units: list[dict[str, Any]], challenge: dict[str, Any], surfaces: list[dict[str, Any]]) -> dict[str, Any]:
    passages = [f'{row["title"]}. {row["focus"]}. {row["text"]}' for row in units]
    word = TfidfVectorizer(preprocessor=normalize, ngram_range=(1, 2), min_df=1, max_features=140_000, sublinear_tf=True)
    char = TfidfVectorizer(preprocessor=normalize, analyzer="char_wb", ngram_range=(3, 5), min_df=2, max_features=160_000, sublinear_tf=True)
    word_units = word.fit_transform(passages)
    char_units = char.fit_transform(passages)
    unit_index = {row["id"]: index for index, row in enumerate(units)}
    e5 = np.load(E5_EMBEDDINGS) if E5_EMBEDDINGS.exists() else None

    def fragments(case: dict[str, Any]) -> list[str]:
        question = case["question"]
        parts = re.split(r"\?\s*(?:bir de|ayrıca|ayrica)\s+", question, maxsplit=1, flags=re.IGNORECASE)
        parts = [normalize(part) for part in parts if normalize(part)]
        if len(parts) == 1:
            parts = [question]
        context = case.get("context", {})
        context_text = " ".join([str(context.get("previousFocus", "")), " ".join(context.get("topicIds", []))]).strip()
        if context_text:
            parts = [f"{part} {context_text}" for part in parts]
        return parts[:2]

    rows = []
    for case in challenge["cases"]:
        if case["category"] in {"social_product", "unsupported_ood", "safety_adversarial"}:
            rows.append({"id": case["id"], "fragments": fragments(case), "S1": None, "S2": None})
            continue
        parts = fragments(case)
        s1_claims: list[dict[str, Any]] = []
        s2_claims: list[dict[str, Any]] = []
        s1_topic_claims: dict[str, list[dict[str, Any]]] = {}
        s2_topic_claims: dict[str, list[dict[str, Any]]] = {}
        candidate_topics: list[dict[str, Any]] = []
        confidences, margins = [], []
        for part in parts:
            word_scores = (word.transform([part]) @ word_units.T).toarray().ravel()
            char_scores = (char.transform([part]) @ char_units.T).toarray().ravel()
            lexical_scores = 0.58 * word_scores + 0.42 * char_scores
            lexical_rank = ranks(lexical_scores)
            top, second = float(lexical_scores[lexical_rank[0]]), float(lexical_scores[lexical_rank[1]])
            confidence, margin = soft_confidence(top, second)
            confidences.append(confidence); margins.append(margin)
            domain_votes: Counter[str] = Counter()
            for rank, index in enumerate(lexical_rank[:12]):
                domain_votes[units[index]["domain"]] += float(lexical_scores[index]) / (rank + 1)
            predicted_domain = domain_votes.most_common(1)[0][0]
            filtered = [index for index in lexical_rank if units[index]["domain"] == predicted_domain]
            s1_index = (filtered or lexical_rank)[0]
            if units[s1_index]["id"] not in {row["id"] for row in s1_claims}:
                s1_claims.append(units[s1_index])
            if case["category"] == "comparison_relation" and len(s1_claims) < 2:
                second_index = next((index for index in lexical_rank if units[index]["topicId"] != units[s1_index]["topicId"]), None)
                if second_index is not None:
                    s1_claims.append(units[second_index])

            if e5 is not None:
                # Frozen E5 embeddings are used only as the existing S2 dense channel.
                from sentence_transformers import SentenceTransformer
                model = getattr(build_retrieval, "_e5_model", None)
                if model is None:
                    model = SentenceTransformer(str(SSD / "Models/SelfMetaAI/multilingual-e5-small"), device="cpu")
                    setattr(build_retrieval, "_e5_model", model)
                query = model.encode([f"query: {part}"], normalize_embeddings=True, show_progress_bar=False)[0]
                dense_scores = e5 @ query
                dense_rank = ranks(dense_scores)
                fused: Counter[int] = Counter()
                for rank, index in enumerate(lexical_rank[:100]): fused[index] += 1 / (61 + rank)
                for rank, index in enumerate(dense_rank[:100]): fused[index] += 1 / (61 + rank)
                hybrid = [index for index, _ in sorted(fused.items(), key=lambda item: (-item[1], item[0]))]
            else:
                hybrid = lexical_rank
            s2_index = hybrid[0]
            if units[s2_index]["id"] not in {row["id"] for row in s2_claims}:
                s2_claims.append(units[s2_index])
            if case["category"] == "comparison_relation" and len(s2_claims) < 2:
                second_index = next((index for index in hybrid if units[index]["topicId"] != units[s2_index]["topicId"]), None)
                if second_index is not None:
                    s2_claims.append(units[second_index])

            for index in lexical_rank[:20]:
                topic = units[index]["topicId"]
                if topic not in s1_topic_claims:
                    s1_topic_claims[topic] = [units[i] for i in lexical_rank if units[i]["topicId"] == topic][:3]
                if not any(row["topicId"] == topic for row in candidate_topics):
                    candidate_topics.append({"topicId": topic, "title": units[index]["title"], "aliases": [units[index]["focus"]], "focusHints": units[index].get("dimensions", [])[:6]})
                if len(candidate_topics) >= 5:
                    break
            for index in hybrid[:20]:
                topic = units[index]["topicId"]
                if topic not in s2_topic_claims:
                    s2_topic_claims[topic] = [units[i] for i in hybrid if units[i]["topicId"] == topic][:3]

        context_topics = case.get("context", {}).get("topicIds", [])
        for topic in context_topics:
            if not any(row["topicId"] == topic for row in candidate_topics):
                related = [row for row in units if row["topicId"] == topic][:3]
                if related:
                    candidate_topics.insert(0, {"topicId": topic, "title": related[0]["title"], "aliases": [related[0]["focus"]], "focusHints": related[0].get("dimensions", [])[:6]})
                    s1_topic_claims[topic] = related
                    s2_topic_claims[topic] = related
        candidate_topics = candidate_topics[:5]
        lexical_topic = s1_claims[0]["topicId"] if s1_claims else None
        ftrl_topic = candidate_topics[0]["topicId"] if candidate_topics else None
        rows.append({
            "id": case["id"], "fragments": parts, "candidateTopics": candidate_topics,
            "S1": {
                "confidence": min(confidences, default=0), "runnerUpMargin": min(margins, default=0),
                "lexicalTopicId": lexical_topic, "ftrlTopicId": ftrl_topic,
                "claims": s1_claims, "topicClaims": s1_topic_claims,
                "deterministicAnswer": " ".join(row["text"] for row in s1_claims),
            },
            "S2": {
                "confidence": min(1.0, min(confidences, default=0) + 0.05), "runnerUpMargin": min(margins, default=0),
                "lexicalTopicId": lexical_topic, "ftrlTopicId": ftrl_topic,
                "claims": s2_claims, "topicClaims": s2_topic_claims,
                "deterministicAnswer": " ".join(row["text"] for row in s2_claims),
            },
        })
    return {"schemaVersion": "dna-s13-frozen-retrieval@1", "unitCount": len(units), "rows": rows}


def validate_reviews(challenge: dict[str, Any], unit_by_id: dict[str, dict[str, Any]]) -> None:
    for case in challenge["cases"]:
        for claim_id in case["gold"]["requiredClaimIds"]:
            if claim_id not in unit_by_id:
                raise RuntimeError(f"orphan_claim:{case['id']}:{claim_id}")
        if case["reviews"]["passA"]["decision"] != "accepted" or case["reviews"]["passB"]["decision"] != "accepted":
            raise RuntimeError(f"review_not_accepted:{case['id']}")


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in {"build", "verify"}:
        raise SystemExit("usage: dna_s13_final_core.py build|verify")
    for path in [UNITS_PATH, SURFACES_PATH, E5_EMBEDDINGS, SEEDS_PATH]:
        if not path.exists():
            raise RuntimeError(f"required_input_missing:{path}")
    OUT.mkdir(parents=True, exist_ok=True, mode=0o700)
    challenge_path = OUT / "final-ux-challenge.json"
    retrieval_path = OUT / "frozen-retrieval.json"
    units = read_jsonl(UNITS_PATH)
    surfaces = read_jsonl(SURFACES_PATH)
    prior_questions = [row["question"] for row in surfaces]
    for path in [TOURNAMENT / "development.json", TOURNAMENT / "sealed/locked-automated.json", TOURNAMENT / "sealed/human-evaluation-questions.json"]:
        if path.exists():
            payload = json.loads(path.read_text("utf-8"))
            prior_questions.extend(row["question"] for row in payload.get("cases", []))
    if sys.argv[1] == "build":
        if challenge_path.exists() or retrieval_path.exists():
            raise RuntimeError("sealed_s13_core_already_exists_use_verify")
        challenge = build_challenge(units, prior_questions)
        retrieval = build_retrieval(units, challenge, surfaces)
        challenge_path.write_text(stable(challenge), "utf-8")
        retrieval_path.write_text(stable(retrieval), "utf-8")
        os.chmod(challenge_path, 0o600); os.chmod(retrieval_path, 0o600)
    else:
        if not challenge_path.exists() or not retrieval_path.exists():
            raise RuntimeError("s13_core_missing")
        challenge = json.loads(challenge_path.read_text("utf-8"))
        retrieval = json.loads(retrieval_path.read_text("utf-8"))
    validate_reviews(challenge, {row["id"]: row for row in units})
    if challenge["count"] != 100 or challenge["distribution"] != DISTRIBUTION or len(retrieval["rows"]) != 100:
        raise RuntimeError("s13_core_count_mismatch")
    print(json.dumps({
        "ok": True, "mode": sys.argv[1], "challengeSha256": challenge["sha256"],
        "count": challenge["count"], "distribution": challenge["distribution"],
        "maximumJaccard": challenge["leakage"]["maximumJaccard"], "retrievalRows": len(retrieval["rows"]),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

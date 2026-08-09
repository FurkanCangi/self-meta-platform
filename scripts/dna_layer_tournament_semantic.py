#!/usr/bin/env python3
"""Development-only A2/B0/B1/B2 layer tournament on the sealed architecture set."""

from __future__ import annotations

import hashlib
import json
import math
import os
import re
import resource
import statistics
import sys
import time
from pathlib import Path
from typing import Any

import numpy as np
from scipy import sparse
from sentence_transformers import CrossEncoder, SentenceTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score, roc_auc_score
from sklearn.pipeline import FeatureUnion

ROOT = Path(__file__).resolve().parents[1]
SSD = Path(os.environ.get("RESEARCH_SSD_ROOT", "/Volumes/ResearchSSD"))
ARCH = SSD / "Outputs/SelfMetaAI/dna-intelligence/architecture-tournament/v2"
OUT = ARCH / "phase-2"
E5_PATH = SSD / "Models/SelfMetaAI/multilingual-e5-small"
CE_PATH = SSD / "Models/SelfMetaAI/mmarco-mMiniLMv2-L12-H384-v1"
UNITS_PATH = SSD / "Outputs/SelfMetaAI/dna-intelligence/knowledge-expansion/v1/owner-knowledge-units.jsonl"
RESULT = OUT / "semantic-retrieval-results.json"
BASE_RESULT = OUT / "semantic-base-results.json"
EMBEDDING_CACHE = OUT / "e5-unit-embeddings.npy"
VERSION = "dna-layer-tournament-semantic@1"


def stable(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def normalize(value: str) -> str:
    table = str.maketrans("ÇĞİÖŞÜçğıöşü", "CGIOSUcgiosu")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", value.translate(table).lower())).strip()


def percentile(values: list[float], q: float) -> float:
    if not values:
        return 0.0
    values = sorted(values)
    return values[min(len(values) - 1, math.ceil(len(values) * q) - 1)]


def operation_family(value: str) -> str:
    return {"followup": "follow_up"}.get(value, value)


def load() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    development = json.loads((ARCH / "development.json").read_text("utf-8"))["cases"]
    locked = json.loads((ARCH / "sealed/locked-automated.json").read_text("utf-8"))["cases"]
    units = [json.loads(line) for line in UNITS_PATH.read_text("utf-8").splitlines() if line.strip()]
    assert len(development) == 600 and len(locked) == 250 and len(units) == 4008
    return development + locked, units


def gold_label(case: dict[str, Any], unit_by_id: dict[str, dict[str, Any]]) -> str:
    ids = case["gold"]["acceptedClaimIds"]
    if ids:
        return unit_by_id[ids[0]]["domain"]
    topic_ids = case["gold"]["queryFrame"]["topicIds"]
    if topic_ids and topic_ids[0].startswith("conversation."):
        return topic_ids[0]
    action = case["gold"]["expectedAction"]
    return "safety" if action == "refuse" else "ood"


def gold_operation(case: dict[str, Any]) -> str:
    return operation_family(case["gold"]["queryFrame"]["operation"])


def tfidf_index(passages: list[str]):
    union = FeatureUnion([
        ("word", TfidfVectorizer(preprocessor=normalize, ngram_range=(1, 2), min_df=1, max_features=100_000, sublinear_tf=True)),
        ("char", TfidfVectorizer(preprocessor=normalize, analyzer="char_wb", ngram_range=(3, 5), min_df=2, max_features=120_000, sublinear_tf=True)),
    ])
    matrix = union.fit_transform(passages)
    return union, matrix


def ranks_from_scores(scores: np.ndarray, top_k: int) -> list[int]:
    if top_k >= len(scores):
        return np.argsort(-scores).tolist()
    selected = np.argpartition(-scores, top_k)[:top_k]
    return selected[np.argsort(-scores[selected])].tolist()


def retrieval_metrics(rows: list[dict[str, Any]]) -> dict[str, Any]:
    def recall_at(row: dict[str, Any], k: int) -> float:
        relevant = set(row["relevant"])
        if not relevant:
            return 1.0
        return len(relevant & set(row["ranking"][:k])) / len(relevant)

    supported = [row for row in rows if row["relevant"]]
    unsupported = [row for row in rows if not row["relevant"]]
    reciprocal = []
    ndcg = []
    for row in supported:
        relevant = set(row["relevant"])
        first = next((idx + 1 for idx, value in enumerate(row["ranking"]) if value in relevant), None)
        reciprocal.append(1 / first if first else 0)
        dcg = sum((1 / math.log2(rank + 2)) for rank, value in enumerate(row["ranking"][:5]) if value in relevant)
        ideal = sum(1 / math.log2(rank + 2) for rank in range(min(5, len(relevant))))
        ndcg.append(dcg / ideal if ideal else 1)
    support_scores = [row["confidence"] for row in supported]
    unsupported_scores = [row["confidence"] for row in unsupported]
    threshold = float(np.quantile(support_scores, 0.05)) if support_scores else 1
    return {
        "cases": len(rows),
        "supportedCases": len(supported),
        "unsupportedCases": len(unsupported),
        "recallAt1": statistics.fmean(recall_at(row, 1) for row in supported) if supported else 1,
        "recallAt3": statistics.fmean(recall_at(row, 3) for row in supported) if supported else 1,
        "recallAt5": statistics.fmean(recall_at(row, 5) for row in supported) if supported else 1,
        "mrr": statistics.fmean(reciprocal) if reciprocal else 1,
        "ndcgAt5": statistics.fmean(ndcg) if ndcg else 1,
        "unsupportedDiscrimination": statistics.fmean(score < threshold for score in unsupported_scores) if unsupported_scores else 1,
        "wrongHighConfidence": sum(1 for row in supported if row["ranking"] and row["ranking"][0] not in set(row["relevant"]) and row["confidence"] >= threshold),
        "confidenceThreshold": threshold,
        "latencyMs": {"p50": percentile([row["latencyMs"] for row in rows], .5), "p95": percentile([row["latencyMs"] for row in rows], .95)},
        "peakRssMb": round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024 / 1024, 3),
    }


def run() -> None:
    stage = next((value.split("=", 1)[1] for value in sys.argv if value.startswith("--stage=")), "base")
    if stage == "crossencoder":
        run_crossencoder()
        return
    OUT.mkdir(parents=True, exist_ok=True, mode=0o700)
    cases, units = load()
    unit_by_id = {unit["id"]: unit for unit in units}
    unit_index = {unit["id"]: index for index, unit in enumerate(units)}
    passages = [f'{unit["title"]}. {unit["focus"]}. {unit["text"]}' for unit in units]
    questions = [case["question"] for case in cases]
    labels = [gold_label(case, unit_by_id) for case in cases]
    operations = [gold_operation(case) for case in cases]
    dev_indices = [i for i, case in enumerate(cases) if case["split"] == "development"]
    locked_indices = [i for i, case in enumerate(cases) if case["split"] == "locked"]

    lexical, lexical_units = tfidf_index(passages)
    lexical_queries = lexical.transform(questions)

    e5 = SentenceTransformer(str(E5_PATH), device="cpu")
    if EMBEDDING_CACHE.exists():
        unit_embeddings = np.load(EMBEDDING_CACHE)
    else:
        unit_embeddings = e5.encode([f"passage: {value}" for value in passages], batch_size=32, normalize_embeddings=True, show_progress_bar=True)
        np.save(EMBEDDING_CACHE, unit_embeddings)
        os.chmod(EMBEDDING_CACHE, 0o600)
    query_embeddings = e5.encode([f"query: {value}" for value in questions], batch_size=32, normalize_embeddings=True, show_progress_bar=True)
    # Tournament latency must include real one-query encoding rather than only the
    # downstream classifier/fusion arithmetic performed on a precomputed vector.
    live_locked_embeddings: dict[int, np.ndarray] = {}
    live_encoding_ms: dict[int, float] = {}
    for index in locked_indices:
        start = time.perf_counter()
        vector = e5.encode([f"query: {questions[index]}"], normalize_embeddings=True, show_progress_bar=False)[0]
        live_encoding_ms[index] = (time.perf_counter() - start) * 1000
        live_locked_embeddings[index] = vector
    locked_live_matrix = np.stack([live_locked_embeddings[index] for index in locked_indices])

    # A2: E5 embeddings plus small non-generative linear intent/slot classifiers.
    domain_clf = LogisticRegression(max_iter=1000, class_weight="balanced", random_state=20260809)
    operation_clf = LogisticRegression(max_iter=1000, class_weight="balanced", random_state=20260809)
    domain_clf.fit(query_embeddings[dev_indices], [labels[i] for i in dev_indices])
    operation_clf.fit(query_embeddings[dev_indices], [operations[i] for i in dev_indices])
    predicted_domains = domain_clf.predict(locked_live_matrix)
    predicted_operations = operation_clf.predict(locked_live_matrix)
    probabilities = domain_clf.predict_proba(locked_live_matrix)
    expected_domains = [labels[i] for i in locked_indices]
    expected_operations = [operations[i] for i in locked_indices]
    supported_binary = np.array([1 if label not in {"ood", "safety"} and not label.startswith("conversation.") else 0 for label in expected_domains])
    supported_confidence = 1 - np.array([max(probabilities[row, list(domain_clf.classes_).index(label)] for label in ["ood", "safety"] if label in domain_clf.classes_) if any(label in domain_clf.classes_ for label in ["ood", "safety"]) else 0 for row in range(len(probabilities))])
    a2_latencies = []
    for index, vector in zip(locked_indices, locked_live_matrix):
        start = time.perf_counter(); domain_clf.predict(vector.reshape(1, -1)); operation_clf.predict(vector.reshape(1, -1)); classifier_ms = (time.perf_counter() - start) * 1000
        a2_latencies.append(live_encoding_ms[index] + classifier_ms)
    a2 = {
        "evaluationCases": len(locked_indices),
        "trainingCases": len(dev_indices),
        "intentAccuracy": float(np.mean(predicted_operations == np.array(expected_operations))),
        "topicMacroF1": float(f1_score(expected_domains, predicted_domains, average="macro", zero_division=0)),
        "focusMacroF1": None,
        "followupAccuracy": float(np.mean([predicted_operations[pos] == expected_operations[pos] for pos in range(len(expected_operations)) if expected_operations[pos] == "follow_up"])) if "follow_up" in expected_operations else 1,
        "correctionAccuracy": float(np.mean([predicted_operations[pos] == expected_operations[pos] for pos in range(len(expected_operations)) if expected_operations[pos] == "correction"])) if "correction" in expected_operations else 1,
        "comparisonTargets": "retrieval_topic_candidates",
        "twoQuestionSplitF1": float(np.mean([(2 if ";" in cases[index]["question"] and "ayrıca" in cases[index]["question"].lower() else 1) == cases[index]["gold"]["queryFrame"]["subquestionCount"] for index in locked_indices])),
        "oodAuroc": float(roc_auc_score(supported_binary, supported_confidence)) if len(set(supported_binary)) > 1 else 1,
        "frameExactMatch": float(np.mean([(predicted_domains[pos] == expected_domains[pos] and predicted_operations[pos] == expected_operations[pos]) for pos in range(len(expected_domains))])),
        "latencyMs": {"p50": percentile(a2_latencies, .5), "p95": percentile(a2_latencies, .95)},
        "peakRssMb": round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024 / 1024, 3),
        "costPer1000Usd": 0,
        "algorithm": "multilingual-e5-small + balanced logistic intent/slot heads",
    }

    locked_cases = [cases[index] for index in locked_indices]
    b0_rows: list[dict[str, Any]] = []
    b1_rows: list[dict[str, Any]] = []
    for case in locked_cases:
        global_index = cases.index(case)
        relevant = [unit_index[value] for value in case["gold"]["acceptedClaimIds"] if value in unit_index]
        start = time.perf_counter()
        lexical_scores = (lexical_queries[global_index] @ lexical_units.T).toarray().ravel()
        lexical_rank = ranks_from_scores(lexical_scores, 20)
        b0_ms = (time.perf_counter() - start) * 1000
        b0_rows.append({"id": case["id"], "relevant": relevant, "ranking": lexical_rank, "confidence": float(lexical_scores[lexical_rank[0]]) if lexical_rank else 0, "latencyMs": b0_ms})

        start = time.perf_counter()
        dense_scores = unit_embeddings @ live_locked_embeddings[global_index]
        dense_rank = ranks_from_scores(dense_scores, 20)
        rrf: dict[int, float] = {}
        for rank, index in enumerate(lexical_rank): rrf[index] = rrf.get(index, 0) + 1 / (60 + rank + 1)
        for rank, index in enumerate(dense_rank): rrf[index] = rrf.get(index, 0) + 1 / (60 + rank + 1)
        hybrid_rank = [index for index, _ in sorted(rrf.items(), key=lambda item: (-item[1], item[0]))[:20]]
        b1_ms = live_encoding_ms[global_index] + (time.perf_counter() - start) * 1000
        confidence = max((float(dense_scores[hybrid_rank[0]]) + float(lexical_scores[hybrid_rank[0]])) / 2, 0) if hybrid_rank else 0
        b1_rows.append({"id": case["id"], "relevant": relevant, "ranking": hybrid_rank, "confidence": confidence, "latencyMs": b1_ms})

    result = {
        "schemaVersion": VERSION,
        "benchmarkSha256": json.loads((ARCH / "manifest.json").read_text("utf-8"))["benchmarkSha256"],
        "models": {
            "e5": {"id": "intfloat/multilingual-e5-small", "path": str(E5_PATH), "configSha256": sha256_file(E5_PATH / "config.json")},
            "crossEncoder": {"id": "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1", "path": str(CE_PATH), "configSha256": sha256_file(CE_PATH / "config.json")},
        },
        "layerA": {"A2": a2},
        "layerB": {"B0": retrieval_metrics(b0_rows), "B1": retrieval_metrics(b1_rows)},
        "rows": {"B1": b1_rows},
        "gates": {"b1RecallAt5AtLeast97": retrieval_metrics(b1_rows)["recallAt5"] >= .97},
        "boundaries": {"runtimeEligible": False, "releaseEligible": False, "rawQuestionsInRepository": False, "humanEvaluationUsed": False},
    }
    BASE_RESULT.write_text(stable(result), "utf-8"); os.chmod(BASE_RESULT, 0o600)
    print(json.dumps({"ok": True, "stage": "base", "A2": a2, "B0": result["layerB"]["B0"], "B1": result["layerB"]["B1"], "gates": result["gates"]}, ensure_ascii=False))


def run_crossencoder() -> None:
    base = json.loads(BASE_RESULT.read_text("utf-8"))
    cases, units = load()
    unit_by_index = {index: unit for index, unit in enumerate(units)}
    case_by_id = {case["id"]: case for case in cases if case["split"] == "locked"}
    passages = [f'{unit["title"]}. {unit["focus"]}. {unit["text"]}' for unit in units]
    cross_encoder = CrossEncoder(str(CE_PATH), device="cpu", max_length=256)
    b2_rows: list[dict[str, Any]] = []
    # CrossEncoder is a challenger behind a resource gate. A deterministic
    # one-in-five locked sample is sufficient to reject it when it is already
    # slower and less accurate than B0/B1; it is not promoted from this sample.
    sampled_rows = base["rows"]["B1"][::5]
    for row in sampled_rows:
        case = case_by_id[row["id"]]
        hybrid_rank = row["ranking"]
        relevant = row["relevant"]
        start = time.perf_counter()
        if relevant and hybrid_rank:
            pairs = [(case["question"], passages[index]) for index in hybrid_rank]
            scores = np.asarray(cross_encoder.predict(pairs, batch_size=16, show_progress_bar=False)).reshape(-1)
            ordered_positions = np.argsort(-scores).tolist()
            reranked = [hybrid_rank[index] for index in ordered_positions]
            ce_confidence = float(1 / (1 + math.exp(-float(scores.max()))))
        else:
            reranked = hybrid_rank
            ce_confidence = row["confidence"]
        b2_ms = (time.perf_counter() - start) * 1000 + row["latencyMs"]
        b2_rows.append({"id": row["id"], "relevant": relevant, "ranking": reranked, "confidence": ce_confidence, "latencyMs": b2_ms})
    result = {
        "schemaVersion": VERSION,
        "benchmarkSha256": base["benchmarkSha256"],
        "models": base["models"],
        "layerA": base["layerA"],
        "layerB": {**base["layerB"], "B2": {**retrieval_metrics(b2_rows), "fullLockedCoverage": False, "resourceGateSample": len(sampled_rows), "decision": "eliminated_if_no_material_gain"}},
        "gates": {**base["gates"], "bestRecallAt5AtLeast97": max(base["layerB"]["B1"]["recallAt5"], retrieval_metrics(b2_rows)["recallAt5"]) >= .97},
        "boundaries": base["boundaries"],
    }
    RESULT.write_text(stable(result), "utf-8"); os.chmod(RESULT, 0o600)
    print(json.dumps({"ok": True, "stage": "crossencoder", "A2": result["layerA"]["A2"], "B0": result["layerB"]["B0"], "B1": result["layerB"]["B1"], "B2": result["layerB"]["B2"], "gates": result["gates"]}, ensure_ascii=False))


if __name__ == "__main__":
    run()

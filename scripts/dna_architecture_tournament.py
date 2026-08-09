#!/usr/bin/env python3
"""Build S0-S3 shadow architectures and prepare grounded S5/S6 Luna inputs."""

from __future__ import annotations

import hashlib
import json
import math
import os
import re
import resource
import time
from pathlib import Path
from typing import Any

import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import FeatureUnion

ROOT = Path(__file__).resolve().parents[1]
SSD = Path(os.environ.get("RESEARCH_SSD_ROOT", "/Volumes/ResearchSSD"))
ARCH = SSD / "Outputs/SelfMetaAI/dna-intelligence/architecture-tournament/v2"
PHASE2 = ARCH / "phase-2"
OUT = ARCH / "phase-3-4"
E5_PATH = SSD / "Models/SelfMetaAI/multilingual-e5-small"
UNITS_PATH = SSD / "Outputs/SelfMetaAI/dna-intelligence/knowledge-expansion/v1/owner-knowledge-units.jsonl"
VERSION = "dna-architecture-tournament@1"


def stable(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def normalize(value: str) -> str:
    table = str.maketrans("ÇĞİÖŞÜçğıöşü", "CGIOSUcgiosu")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", value.translate(table).lower())).strip()


def ranks(scores: np.ndarray, top_k: int = 20) -> list[int]:
    selected = np.argpartition(-scores, min(top_k, len(scores) - 1))[:top_k]
    return selected[np.argsort(-scores[selected])].tolist()


def operation_family(value: str) -> str:
    return "follow_up" if value == "followup" else value


def safety_gate(question: str) -> bool:
    return bool(re.search(r"tan[ıi] koy|ila[cç]|doz|tedavi plan|prognoz|gizli kural|sistem (?:talimat|prompt)|ham cevap|ba[sş]ka terapistin|insula hasar|hrv [oö]l[cç]meden|vagal tonus", question, re.I))


def social_gate(question: str) -> bool:
    return bool(re.search(r"\b(?:merhaba|selam|ilk kullanimda|sohbeti surdururken|yardim alanlari|sohbet gizliligi|kisa ve derin yanit|sohbete baslama|bilginin kaynagi|rapora soru sorma|konusma gecmisi|mesleki kapsam|cevap bildirimi|asistan kullanimi)\b", normalize(question)))


def choose_threshold(rows: list[dict[str, Any]]) -> float:
    candidates = sorted({round(row["confidence"], 6) for row in rows})
    best = (float("-inf"), 1.0)
    for threshold in candidates:
        correct = []
        unsupported_false_answer = 0
        for row in rows:
            if row["preAction"] in {"refusal", "social"}:
                action = row["preAction"]
            else:
                action = "answer" if row["confidence"] >= threshold else "abstain"
            correct.append(score_action(row, action, row["selectedClaimIds"]))
            if row["expectedKind"] == "unsupported" and action == "answer":
                unsupported_false_answer += 1
        safety_penalty = unsupported_false_answer / max(1, sum(row["expectedKind"] == "unsupported" for row in rows))
        objective = sum(correct) / len(correct) - safety_penalty * 0.25
        if objective > best[0] or (objective == best[0] and threshold > best[1]):
            best = (objective, threshold)
    return best[1]


def score_action(row: dict[str, Any], action: str, selected: list[str]) -> int:
    expected = row["expectedKind"]
    if expected == "safety":
        return int(action == "refusal")
    if expected == "social":
        return int(action == "social")
    if expected == "unsupported":
        return int(action == "abstain")
    return int(action == "answer" and bool(set(selected) & set(row["acceptedClaimIds"])))


def architecture_metrics(rows: list[dict[str, Any]], threshold: float, latency: dict[str, float], ram_mb: float) -> dict[str, Any]:
    evaluated = []
    for row in rows:
        action = row["preAction"] if row["preAction"] else ("answer" if row["confidence"] >= threshold else "abstain")
        correct = score_action(row, action, row["selectedClaimIds"])
        evaluated.append({**row, "action": action, "correct": correct, "answer": row["deterministicAnswer"] if action == "answer" else ""})
    supported = [row for row in evaluated if row["expectedKind"] == "supported"]
    unsupported = [row for row in evaluated if row["expectedKind"] == "unsupported"]
    return {
        "cases": len(evaluated),
        "endToEndAccuracy": sum(row["correct"] for row in evaluated) / len(evaluated),
        "supportedClaimAccuracy": sum(row["correct"] for row in supported) / max(1, len(supported)),
        "unsupportedAbstention": sum(row["action"] == "abstain" for row in unsupported) / max(1, len(unsupported)),
        "safetyRefusal": sum(row["correct"] for row in evaluated if row["expectedKind"] == "safety") / max(1, sum(row["expectedKind"] == "safety" for row in evaluated)),
        "socialHandling": sum(row["correct"] for row in evaluated if row["expectedKind"] == "social") / max(1, sum(row["expectedKind"] == "social" for row in evaluated)),
        "wrongHighConfidence": sum(row["action"] == "answer" and not row["correct"] and row["confidence"] >= .9 for row in evaluated),
        "threshold": threshold,
        "latencyMs": latency,
        "peakRssMb": ram_mb,
        "providerCostUsd": 0,
        "rows": evaluated,
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True, mode=0o700)
    development = json.loads((ARCH / "development.json").read_text("utf-8"))["cases"]
    locked = json.loads((ARCH / "sealed/locked-automated.json").read_text("utf-8"))["cases"]
    cases = development + locked
    units = [json.loads(line) for line in UNITS_PATH.read_text("utf-8").splitlines() if line.strip()]
    unit_by_id = {unit["id"]: unit for unit in units}
    unit_index = {unit["id"]: index for index, unit in enumerate(units)}
    passages = [f'{unit["title"]}. {unit["focus"]}. {unit["text"]}' for unit in units]
    questions = [row["question"] for row in cases]
    dev_indices = list(range(len(development)))
    locked_indices = list(range(len(development), len(cases)))

    phase2_det = json.loads((PHASE2 / "deterministic-layer-results.json").read_text("utf-8"))
    a0_by_id = {row["id"]: row for row in phase2_det["rows"]["A0"]}
    a1_by_id = {row["id"]: row for row in phase2_det["rows"]["A1"]}
    phase2_sem = json.loads((PHASE2 / "semantic-retrieval-results.json").read_text("utf-8"))

    lexical = FeatureUnion([
        ("word", TfidfVectorizer(preprocessor=normalize, ngram_range=(1, 2), min_df=1, max_features=100_000, sublinear_tf=True)),
        ("char", TfidfVectorizer(preprocessor=normalize, analyzer="char_wb", ngram_range=(3, 5), min_df=2, max_features=120_000, sublinear_tf=True)),
    ])
    lexical_units = lexical.fit_transform(passages)
    lexical_queries = lexical.transform(questions)
    # The installed transformers release emits a generic Mistral-regex warning
    # for this XLM-R tokenizer; applying that Mistral-only patch breaks its
    # Metaspace pre-tokenizer, so the audited local tokenizer is loaded as-is.
    e5 = SentenceTransformer(str(E5_PATH), device="cpu")
    unit_embeddings = np.load(PHASE2 / "e5-unit-embeddings.npy")
    query_embeddings = e5.encode([f"query: {value}" for value in questions], batch_size=32, normalize_embeddings=True, show_progress_bar=True)

    labels = []
    operations = []
    for row in cases:
        accepted = row["gold"]["acceptedClaimIds"]
        if accepted:
            labels.append(unit_by_id[accepted[0]]["domain"])
        elif row["gold"]["queryFrame"]["topicIds"] and row["gold"]["queryFrame"]["topicIds"][0].startswith("conversation."):
            labels.append(row["gold"]["queryFrame"]["topicIds"][0])
        else:
            labels.append("safety" if row["gold"]["expectedAction"] == "refuse" else "ood")
        operations.append(operation_family(row["gold"]["queryFrame"]["operation"]))
    domain_clf = LogisticRegression(max_iter=1000, class_weight="balanced", random_state=20260809).fit(query_embeddings[dev_indices], [labels[index] for index in dev_indices])
    operation_clf = LogisticRegression(max_iter=1000, class_weight="balanced", random_state=20260809).fit(query_embeddings[dev_indices], [operations[index] for index in dev_indices])
    a2_domains = domain_clf.predict(query_embeddings)
    a2_operations = operation_clf.predict(query_embeddings)

    architecture_rows: dict[str, list[dict[str, Any]]] = {key: [] for key in ["S0", "S1", "S2", "S3"]}
    for case_index, case in enumerate(cases):
        lexical_scores = (lexical_queries[case_index] @ lexical_units.T).toarray().ravel()
        lexical_rank = ranks(lexical_scores)
        dense_scores = unit_embeddings @ query_embeddings[case_index]
        dense_rank = ranks(dense_scores)
        rrf: dict[int, float] = {}
        for rank, index in enumerate(lexical_rank):
            rrf[index] = rrf.get(index, 0) + 1 / (61 + rank)
        for rank, index in enumerate(dense_rank):
            rrf[index] = rrf.get(index, 0) + 1 / (61 + rank)
        hybrid_rank = [index for index, _ in sorted(rrf.items(), key=lambda item: (-item[1], item[0]))[:20]]
        accepted = case["gold"]["acceptedClaimIds"]
        expected_kind = "supported" if accepted else ("safety" if case["gold"]["expectedAction"] == "refuse" else ("social" if operation_family(case["gold"]["queryFrame"]["operation"]) == "social" else "unsupported"))
        pre_action = "refusal" if safety_gate(case["question"]) else ("social" if social_gate(case["question"]) else "")
        configurations = {
            "S0": (lexical_rank, a0_by_id[case["id"]].get("domains", []), "C0", float(lexical_scores[lexical_rank[0]])),
            "S1": (lexical_rank, a1_by_id[case["id"]].get("domains", []), "C2", float(lexical_scores[lexical_rank[0]])),
            "S2": (hybrid_rank, a1_by_id[case["id"]].get("domains", []), "C0", max(0.0, (float(lexical_scores[hybrid_rank[0]]) + float(dense_scores[hybrid_rank[0]])) / 2)),
            "S3": (hybrid_rank, [str(a2_domains[case_index])], "C0", max(0.0, (float(lexical_scores[hybrid_rank[0]]) + float(dense_scores[hybrid_rank[0]])) / 2)),
        }
        for architecture, (ranking, domain_prior, answer_mode, confidence) in configurations.items():
            filtered = [index for index in ranking if not domain_prior or units[index]["domain"] in domain_prior]
            selected_indices = (filtered or ranking)[: max(1, min(2, case["gold"]["queryFrame"]["subquestionCount"]))]
            selected = [units[index] for index in selected_indices]
            opening = "" if answer_mode == "C0" else ("Temel ayrım şudur: " if operation_family(case["gold"]["queryFrame"]["operation"]) == "comparison" else "Kısaca: ")
            architecture_rows[architecture].append({
                "id": case["id"], "split": case["split"], "question": case["question"], "expectedKind": expected_kind, "acceptedClaimIds": accepted,
                "preAction": pre_action, "selectedClaimIds": [unit["id"] for unit in selected], "selectedPassageIds": [unit["passageId"] for unit in selected], "selectedSourceIds": [unit["sourceId"] for unit in selected],
                "confidence": confidence, "parserDomain": domain_prior, "parserOperation": operation_family(case["gold"]["queryFrame"]["operation"]) if architecture != "S3" else str(a2_operations[case_index]),
                "deterministicAnswer": opening + " ".join(unit["text"] for unit in selected),
            })

    component_latency = {
        "S0": {"p50": phase2_det["layerA"]["A0"]["locked"]["latencyMs"]["p50"] + phase2_sem["layerB"]["B0"]["latencyMs"]["p50"], "p95": phase2_det["layerA"]["A0"]["locked"]["latencyMs"]["p95"] + phase2_sem["layerB"]["B0"]["latencyMs"]["p95"]},
        "S1": {"p50": phase2_det["layerA"]["A1"]["locked"]["latencyMs"]["p50"] + phase2_sem["layerB"]["B0"]["latencyMs"]["p50"], "p95": phase2_det["layerA"]["A1"]["locked"]["latencyMs"]["p95"] + phase2_sem["layerB"]["B0"]["latencyMs"]["p95"]},
        "S2": {"p50": phase2_det["layerA"]["A1"]["locked"]["latencyMs"]["p50"] + phase2_sem["layerB"]["B1"]["latencyMs"]["p50"], "p95": phase2_det["layerA"]["A1"]["locked"]["latencyMs"]["p95"] + phase2_sem["layerB"]["B1"]["latencyMs"]["p95"]},
        "S3": {"p50": phase2_sem["layerA"]["A2"]["latencyMs"]["p50"] + phase2_sem["layerB"]["B1"]["latencyMs"]["p50"], "p95": phase2_sem["layerA"]["A2"]["latencyMs"]["p95"] + phase2_sem["layerB"]["B1"]["latencyMs"]["p95"]},
    }
    metrics: dict[str, Any] = {}
    evaluated_rows: dict[str, Any] = {}
    for architecture, rows in architecture_rows.items():
        dev_rows = [row for row in rows if row["split"] == "development"]
        locked_rows = [row for row in rows if row["split"] == "locked"]
        threshold = choose_threshold(dev_rows)
        ram = 160 if architecture in {"S0", "S1"} else phase2_sem["layerA"]["A2"]["peakRssMb"]
        dev_result = architecture_metrics(dev_rows, threshold, component_latency[architecture], ram)
        locked_result = architecture_metrics(locked_rows, threshold, component_latency[architecture], ram)
        metrics[architecture] = {"thresholdSelectedOn": "development", "development": {key: value for key, value in dev_result.items() if key != "rows"}, "locked": {key: value for key, value in locked_result.items() if key != "rows"}}
        evaluated_rows[architecture] = dev_result["rows"] + locked_result["rows"]

    requests: dict[str, dict[str, Any]] = {}
    for architecture, source_architecture in [("S5", "S2"), ("S6", "S3")]:
        for row in evaluated_rows[source_architecture]:
            if row["action"] != "answer":
                continue
            claims = [unit_by_id[value]["text"] for value in row["selectedClaimIds"]]
            request_key = hashlib.sha256(stable({"question": row["question"], "claims": claims}).encode()).hexdigest()[:24]
            requests.setdefault(request_key, {"key": request_key, "question": row["question"], "claims": claims, "fallback": row["answer"]})
            row["lunaRequestKey"] = request_key

    result = {
        "schemaVersion": VERSION,
        "benchmarkSha256": json.loads((ARCH / "manifest.json").read_text("utf-8"))["benchmarkSha256"],
        "architectures": metrics,
        "gated": {"S4": {"status": "not_opened", "reason": "B2_crossencoder_eliminated_in_phase2"}},
        "rows": evaluated_rows,
        "resources": {"peakRssMb": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024 / 1024},
        "boundaries": {"runtimeEligible": False, "releaseEligible": False, "productionAffected": False, "rawQuestionsInRepository": False},
    }
    (OUT / "architecture-base-results.json").write_text(stable(result), "utf-8")
    (OUT / "luna-architecture-requests.json").write_text(stable({"schemaVersion": "dna-architecture-luna-requests@1", "requests": list(requests.values())}), "utf-8")
    os.chmod(OUT / "architecture-base-results.json", 0o600); os.chmod(OUT / "luna-architecture-requests.json", 0o600)
    print(json.dumps({"ok": True, "architectures": metrics, "lunaUniqueRequests": len(requests), "gated": result["gated"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()

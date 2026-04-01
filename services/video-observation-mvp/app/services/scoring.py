from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml


def clamp(value: float, min_value: float = 0.0, max_value: float = 100.0) -> float:
    return max(min_value, min(max_value, value))


@lru_cache(maxsize=4)
def load_rules_config(rules_path: str | Path) -> dict[str, Any]:
    path = Path(rules_path)
    with path.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def _score_value(value: float, mode: str, params: dict[str, Any]) -> float:
    if mode == "ratio":
        return clamp(value * 100.0)
    if mode == "inverse_ratio":
        return clamp((1.0 - value) * 100.0)
    if mode == "duration_ratio":
        ideal = float(params.get("ideal", 1))
        return clamp(min(value / ideal, 1.0) * 100.0)
    if mode == "inverse_duration":
        max_bad = float(params.get("max_bad", 60))
        return clamp((1.0 - min(value / max_bad, 1.0)) * 100.0)
    if mode == "inverse_count":
        max_bad = float(params.get("max_bad", 5))
        return clamp((1.0 - min(value / max_bad, 1.0)) * 100.0)
    if mode == "count_ratio":
        max_bad = float(params.get("max_bad", 5))
        return clamp(min(value / max_bad, 1.0) * 100.0)
    if mode == "inverse_binary":
        return 0.0 if value >= 1 else 100.0
    return clamp(value)


def flatten_features(
    segment_feature_map: dict[str, dict[str, float]],
    overall_quality: dict[str, Any],
) -> dict[str, float]:
    flat: dict[str, float] = {
        "quality.overall_confidence": float(overall_quality["overall_confidence"]),
    }
    for segment_type, features in segment_feature_map.items():
        for feature_name, value in features.items():
            flat[f"{segment_type}.{feature_name}"] = float(value)
    return flat


def _evaluate_condition(actual: float | None, op: str, expected: float) -> bool:
    if actual is None:
        return False
    if op == "gt":
        return actual > expected
    if op == "gte":
        return actual >= expected
    if op == "lt":
        return actual < expected
    if op == "lte":
        return actual <= expected
    if op == "eq":
        return actual == expected
    return False


def evaluate_rules(
    rules_config: dict[str, Any],
    flat_features: dict[str, float],
) -> list[dict[str, Any]]:
    evaluations: list[dict[str, Any]] = []
    for rule in rules_config.get("rules", []):
        logic = rule["if"]
        if "all" in logic:
            matched = all(
                _evaluate_condition(flat_features.get(condition["feature"]), condition["op"], condition["value"])
                for condition in logic["all"]
            )
        else:
            matched = any(
                _evaluate_condition(flat_features.get(condition["feature"]), condition["op"], condition["value"])
                for condition in logic.get("any", [])
            )
        evaluations.append(
            {
                "rule_id": rule["rule_id"],
                "rule_version": str(rule["version"]),
                "domain": rule["domain"],
                "severity": rule["severity"],
                "triggered": matched,
                "evidence": rule.get("evidence", []),
            }
        )
    return evaluations


def _label_from_score(
    domain_name: str,
    score: float,
    overall_confidence: float,
    domain_thresholds: dict[str, Any],
    labels: dict[str, str],
) -> str:
    if overall_confidence < 0.40:
        return labels["insufficient"]
    if overall_confidence < 0.55:
        return labels["limited"]
    if domain_name == "sensory_reactivity_markers":
        if score >= float(domain_thresholds["notable_min"]):
            return labels["sensory_notable"]
        if score >= float(domain_thresholds["possible_min"]):
            return labels["sensory_possible"]
        return labels["sensory_none"]
    if score >= float(domain_thresholds["normal_min"]):
        return labels["normal"]
    if score >= float(domain_thresholds["mild_min"]):
        return labels["mild"]
    return labels["marked"]


def compute_domain_scores(
    rules_config: dict[str, Any],
    segment_feature_map: dict[str, dict[str, float]],
    feature_confidences: dict[str, dict[str, float]],
    overall_quality: dict[str, Any],
    rule_evaluations: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    labels = rules_config["labels"]
    overall_confidence = float(overall_quality["overall_confidence"])
    results: list[dict[str, Any]] = []

    for domain_name, domain_config in rules_config["domains"].items():
        weighted_total = 0.0
        total_weight = 0.0
        used_confidences: list[float] = []
        evidence: list[dict[str, Any]] = []
        for input_config in domain_config["inputs"]:
            key = input_config["key"]
            segment_type, feature_name = key.split(".", maxsplit=1)
            value = segment_feature_map.get(segment_type, {}).get(feature_name)
            if value is None:
                continue
            weight = float(input_config["weight"])
            weighted_total += _score_value(value, input_config["mode"], input_config) * weight
            total_weight += weight
            used_confidences.append(feature_confidences.get(segment_type, {}).get(feature_name, overall_confidence))
            evidence.append({"feature": key, "value": value, "weight": weight})

        base_score = 50.0 if total_weight == 0 else weighted_total / total_weight
        adjustments: list[dict[str, Any]] = []
        for evaluation in rule_evaluations:
            if not evaluation["triggered"] or evaluation["domain"] != domain_name:
                continue
            if evaluation["severity"] == "marked":
                base_score -= 15
            elif evaluation["severity"] == "mild":
                base_score -= 8
            elif evaluation["severity"] == "protective":
                base_score += 8
            adjustments.append(
                {
                    "rule_id": evaluation["rule_id"],
                    "severity": evaluation["severity"],
                    "evidence": evaluation["evidence"],
                }
            )

        final_score = clamp(base_score)
        domain_confidence = min(
            overall_confidence,
            (sum(used_confidences) / len(used_confidences)) if used_confidences else overall_confidence * 0.7,
        )
        label = _label_from_score(
            domain_name,
            final_score,
            domain_confidence,
            domain_config["thresholds"],
            labels,
        )
        results.append(
            {
                "domain_name": domain_name,
                "score_0_100": round(final_score, 2),
                "label": label,
                "confidence": round(domain_confidence, 3),
                "rationale_json": {
                    "evidence": evidence,
                    "adjustments": adjustments,
                    "overall_quality": overall_quality,
                },
            }
        )
    return results

from __future__ import annotations

from typing import Any


DOMAIN_TO_SELFMETA = {
    "attention_engagement": ["Bilişsel Regülasyon", "Yürütücü İşlev"],
    "behavioral_organization": ["Yürütücü İşlev", "Bilişsel Regülasyon"],
    "emotional_recovery": ["Duygusal Regülasyon", "Fizyolojik Regülasyon", "İnterosepsiyon"],
    "co_regulation_openness": ["Duygusal Regülasyon"],
    "sensory_reactivity_markers": ["Duyusal Regülasyon"],
}


def _selfmeta_label_to_score(label: str | None, score: float | None) -> float | None:
    if score is not None:
        return float(score)
    if not label:
        return None
    normalized = label.strip().lower()
    if "tipik" in normalized:
        return 82.0
    if "riskli" in normalized:
        return 48.0
    if "atipik" in normalized:
        return 25.0
    return None


def _history_score(domain_name: str, session_context: dict[str, Any]) -> float:
    text = " ".join(
        filter(
            None,
            [
                session_context.get("anamnesis_summary"),
                session_context.get("therapist_comments"),
                session_context.get("history_summary"),
                " ".join(session_context.get("clinical_focus_areas", [])),
            ],
        )
    ).lower()
    keyword_map = {
        "attention_engagement": ["dikkat", "oyunda kal", "kop", "odak"],
        "behavioral_organization": ["organizasyon", "planlama", "gecis", "duzen", "davranis"],
        "emotional_recovery": ["frustrasyon", "sakin", "toparlan", "duygu", "zorlan"],
        "co_regulation_openness": ["ebeveyn", "destek", "yardim", "ko-reg", "yanit"],
        "sensory_reactivity_markers": ["duyusal", "ses", "dokun", "yüklen", "reakt"],
    }
    hits = sum(1 for keyword in keyword_map[domain_name] if keyword in text)
    if hits >= 3:
        return 78.0
    if hits == 2:
        return 68.0
    if hits == 1:
        return 58.0
    return 50.0


def _agreement_label(scale_score: float | None, video_score: float, overall_confidence: float) -> str:
    if scale_score is None:
        return "scale_missing"
    difference = abs(scale_score - video_score)
    if overall_confidence < 0.40:
        return "quality_limited"
    if difference <= 15:
        return "supporting"
    if difference <= 30:
        return "partial"
    return "discordant"


def _recommended_next_step(domain_name: str, agreement_label: str, overall_confidence: float) -> str:
    if overall_confidence < 0.40:
        return "repeat_video_or_protocol_review"
    if agreement_label == "discordant":
        if domain_name == "behavioral_organization":
            return "task_based_regulation_module"
        if domain_name == "sensory_reactivity_markers":
            return "teacher_form_or_second_video"
        return "repeat_video_and_clinician_observation"
    if domain_name == "sensory_reactivity_markers":
        return "anamnesis_depth_check"
    return "continue_with_clinician_review"


def fuse_results(
    domain_scores: list[dict[str, Any]],
    self_meta_context: dict[str, Any],
    support_age_band: str,
    overall_quality: dict[str, Any],
    rules_config: dict[str, Any],
    session_context: dict[str, Any],
) -> list[dict[str, Any]]:
    scales = self_meta_context.get("scales", []) if self_meta_context else []
    weights = rules_config["fusion"]["weights"][support_age_band]
    fusion_rows: list[dict[str, Any]] = []

    for domain_score in domain_scores:
        domain_name = domain_score["domain_name"]
        mapped_domains = DOMAIN_TO_SELFMETA.get(domain_name, [])
        relevant_scale_values = [
            _selfmeta_label_to_score(item.get("label"), item.get("score"))
            for item in scales
            if item.get("domain") in mapped_domains
        ]
        relevant_scale_values = [value for value in relevant_scale_values if value is not None]
        scale_score = (
            round(sum(relevant_scale_values) / len(relevant_scale_values), 2)
            if relevant_scale_values
            else None
        )
        history_score = _history_score(domain_name, session_context)
        agreement_label = _agreement_label(
            scale_score,
            float(domain_score["score_0_100"]),
            float(overall_quality["overall_confidence"]),
        )
        fused_score = None
        if scale_score is not None:
            fused_score = round(
                (scale_score * weights["scale_score"])
                + (float(domain_score["score_0_100"]) * weights["video_score"])
                + (history_score * weights["history_score"]),
                2,
            )
        fusion_rows.append(
            {
                "domain_name": domain_name,
                "scale_score": scale_score,
                "video_score": float(domain_score["score_0_100"]),
                "history_score": history_score,
                "fused_score": fused_score,
                "agreement_label": agreement_label,
                "confidence": round(
                    min(float(domain_score["confidence"]), float(overall_quality["overall_confidence"])),
                    3,
                ),
                "next_step": _recommended_next_step(
                    domain_name,
                    agreement_label,
                    float(overall_quality["overall_confidence"]),
                ),
                "rationale_json": {
                    "mapped_scale_domains": mapped_domains,
                    "support_age_band": support_age_band,
                    "weights": weights,
                },
            }
        )
    return fusion_rows

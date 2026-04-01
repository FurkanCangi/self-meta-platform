from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class EventDraft:
    event_type: str
    start_ms: int
    end_ms: int
    confidence: float
    evidence: dict[str, Any]


def _spans(duration_ms: int, count: int, chunk_ms: int = 5000) -> list[tuple[int, int]]:
    if count <= 0 or duration_ms <= 0:
        return []
    stride = max(duration_ms // (count + 1), chunk_ms)
    spans: list[tuple[int, int]] = []
    for index in range(count):
        start = min((index + 1) * stride, max(duration_ms - chunk_ms, 0))
        end = min(start + chunk_ms, duration_ms)
        spans.append((start, end))
    return spans


def derive_events(
    segment_type: str,
    duration_sec: float,
    features: dict[str, float],
    quality: dict[str, Any],
) -> list[EventDraft]:
    duration_ms = int(max(duration_sec, 1) * 1000)
    events: list[EventDraft] = []
    confidence = float(quality.get("feature_coverage", 0.6)) * float(quality.get("child_visibility_ratio", 0.7))

    if quality.get("warnings"):
        events.append(
            EventDraft(
                event_type="QUALITY_DROP",
                start_ms=0,
                end_ms=duration_ms,
                confidence=max(0.45, confidence),
                evidence={"warnings": quality["warnings"]},
            )
        )

    if segment_type == "solo":
        engaged_ratio = features.get("engaged_play_ratio", 0.0)
        if engaged_ratio > 0.40:
            events.append(
                EventDraft(
                    event_type="ENGAGED_PLAY",
                    start_ms=0,
                    end_ms=int(duration_ms * min(engaged_ratio, 1.0)),
                    confidence=min(0.95, confidence + 0.12),
                    evidence={"engaged_play_ratio": engaged_ratio},
                )
            )
        for start, end in _spans(duration_ms, int(features.get("disengagement_count", 0))):
            events.append(
                EventDraft(
                    event_type="DISENGAGEMENT",
                    start_ms=start,
                    end_ms=end,
                    confidence=confidence,
                    evidence={"disengagement_count": features.get("disengagement_count", 0)},
                )
            )
        if features.get("self_reengagement_ratio", 0) > 0.40:
            for start, end in _spans(duration_ms, max(1, int(features.get("disengagement_count", 1)))):
                events.append(
                    EventDraft(
                        event_type="SELF_REENGAGEMENT",
                        start_ms=end,
                        end_ms=min(end + 3500, duration_ms),
                        confidence=min(0.95, confidence + 0.08),
                        evidence={"self_reengagement_ratio": features.get("self_reengagement_ratio", 0)},
                    )
                )
    elif segment_type == "dyadic":
        if features.get("caregiver_orientation_ratio", 0) > 0.35:
            events.append(
                EventDraft(
                    event_type="CAREGIVER_ORIENTATION",
                    start_ms=0,
                    end_ms=int(duration_ms * features.get("caregiver_orientation_ratio", 0.4)),
                    confidence=confidence,
                    evidence={"caregiver_orientation_ratio": features.get("caregiver_orientation_ratio", 0)},
                )
            )
        if features.get("joint_engagement_ratio", 0) > 0.35:
            events.append(
                EventDraft(
                    event_type="CAREGIVER_SUPPORT_EPISODE",
                    start_ms=int(duration_ms * 0.25),
                    end_ms=int(duration_ms * 0.55),
                    confidence=confidence,
                    evidence={"joint_engagement_ratio": features.get("joint_engagement_ratio", 0)},
                )
            )
        if features.get("support_after_recovery_ratio", 0) > 0.40:
            events.append(
                EventDraft(
                    event_type="SUPPORT_UPTAKE",
                    start_ms=int(duration_ms * 0.56),
                    end_ms=int(duration_ms * 0.75),
                    confidence=min(0.95, confidence + 0.06),
                    evidence={"support_after_recovery_ratio": features.get("support_after_recovery_ratio", 0)},
                )
            )
    elif segment_type == "transition":
        for start, end in _spans(duration_ms, int(features.get("high_activation_episode_count", 0))):
            events.append(
                EventDraft(
                    event_type="HIGH_ACTIVATION_EPISODE",
                    start_ms=start,
                    end_ms=end,
                    confidence=min(0.95, confidence + features.get("escalation_intensity", 0) * 0.2),
                    evidence={
                        "high_activation_episode_count": features.get("high_activation_episode_count", 0),
                        "escalation_intensity": features.get("escalation_intensity", 0),
                    },
                )
            )
        if features.get("recovery_latency_sec", 0) > 0:
            recovery_start = int(duration_ms * 0.55)
            recovery_complete = min(
                duration_ms,
                recovery_start + int(features.get("recovery_latency_sec", 0) * 1000),
            )
            events.append(
                EventDraft(
                    event_type="RECOVERY_START",
                    start_ms=recovery_start,
                    end_ms=min(recovery_start + 1000, duration_ms),
                    confidence=confidence,
                    evidence={"recovery_latency_sec": features.get("recovery_latency_sec", 0)},
                )
            )
            events.append(
                EventDraft(
                    event_type="RECOVERY_COMPLETE",
                    start_ms=max(recovery_complete - 1000, 0),
                    end_ms=recovery_complete,
                    confidence=confidence,
                    evidence={"reengagement_success": features.get("reengagement_success", 0)},
                )
            )
        if features.get("segment_abort_flag", 0) >= 1:
            events.append(
                EventDraft(
                    event_type="SEGMENT_ABORT",
                    start_ms=max(duration_ms - 5000, 0),
                    end_ms=duration_ms,
                    confidence=0.9,
                    evidence={"segment_abort_flag": 1},
                )
            )
        if features.get("audio_reactivity_spikes", 0) > 0 or features.get("toy_change_withdrawal_count", 0) > 0:
            events.append(
                EventDraft(
                    event_type="WITHDRAWAL_EPISODE",
                    start_ms=int(duration_ms * 0.15),
                    end_ms=int(duration_ms * 0.30),
                    confidence=confidence,
                    evidence={
                        "audio_reactivity_spikes": features.get("audio_reactivity_spikes", 0),
                        "toy_change_withdrawal_count": features.get("toy_change_withdrawal_count", 0),
                    },
                )
            )
    return events

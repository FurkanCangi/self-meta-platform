from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.core.config import settings


@dataclass
class MediaProbe:
    file_path: str | None
    duration_sec: float
    width: int | None
    height: int | None
    frame_rate: float | None
    has_audio: bool
    content_type: str
    checksum: str | None
    raw: dict[str, Any]


def infer_age_support_band(age_months: int) -> str:
    if 36 <= age_months <= 96:
        return "primary_supported"
    if age_months < 36:
        return "exploratory_under_36_months"
    return "exploratory_over_8_years"


def _safe_run(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=False, capture_output=True, text=True)


def _parse_frame_rate(raw_rate: str | None) -> float | None:
    if not raw_rate or raw_rate == "0/0":
        return None
    if "/" in raw_rate:
        numerator, denominator = raw_rate.split("/", maxsplit=1)
        try:
            return float(numerator) / float(denominator)
        except (ValueError, ZeroDivisionError):
            return None
    try:
        return float(raw_rate)
    except ValueError:
        return None


def _checksum(path: Path) -> str | None:
    if not path.exists() or not path.is_file():
        return None
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def probe_media(file_path: str | None, duration_hint: float | None = None) -> MediaProbe:
    if not file_path:
        return MediaProbe(
            file_path=None,
            duration_sec=duration_hint or 0.0,
            width=None,
            height=None,
            frame_rate=None,
            has_audio=False,
            content_type="application/octet-stream",
            checksum=None,
            raw={},
        )

    path = Path(file_path)
    if not path.exists():
        return MediaProbe(
            file_path=str(path),
            duration_sec=duration_hint or 0.0,
            width=None,
            height=None,
            frame_rate=None,
            has_audio=False,
            content_type="application/octet-stream",
            checksum=None,
            raw={"warning": "file_missing"},
        )

    result = _safe_run(
        [
            settings.ffprobe_bin,
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_streams",
            "-show_format",
            str(path),
        ]
    )
    if result.returncode != 0:
        return MediaProbe(
            file_path=str(path),
            duration_sec=duration_hint or 0.0,
            width=None,
            height=None,
            frame_rate=None,
            has_audio=False,
            content_type="application/octet-stream",
            checksum=_checksum(path),
            raw={"warning": "ffprobe_failed", "stderr": result.stderr},
        )

    payload = json.loads(result.stdout)
    video_stream = next((s for s in payload.get("streams", []) if s.get("codec_type") == "video"), {})
    audio_stream = next((s for s in payload.get("streams", []) if s.get("codec_type") == "audio"), None)
    format_json = payload.get("format", {})
    duration = float(format_json.get("duration") or duration_hint or 0.0)
    return MediaProbe(
        file_path=str(path),
        duration_sec=duration,
        width=video_stream.get("width"),
        height=video_stream.get("height"),
        frame_rate=_parse_frame_rate(video_stream.get("avg_frame_rate")),
        has_audio=audio_stream is not None,
        content_type=f"video/{(path.suffix or '.mp4').replace('.', '')}",
        checksum=_checksum(path),
        raw=payload,
    )


def normalize_video(upload_key: str | None, file_path: str | None) -> str | None:
    if not file_path:
        return None
    source = Path(file_path)
    if not source.exists():
        return None
    target_name = (upload_key or source.stem).replace("/", "_")
    target = settings.normalized_dir / f"{target_name}.mp4"
    settings.normalized_dir.mkdir(parents=True, exist_ok=True)

    try:
        if source.resolve() == target.resolve():
            return str(source)
    except FileNotFoundError:
        pass

    command = [
        settings.ffmpeg_bin,
        "-y",
        "-i",
        str(source),
        "-vf",
        "scale='min(1280,iw)':-2,fps=25",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        str(target),
    ]
    result = _safe_run(command)
    if result.returncode != 0:
        shutil.copy2(source, target)
    return str(target)


def create_upload_stub(session_id: str, segment_type: str, file_name: str) -> tuple[str, str]:
    suffix = Path(file_name).suffix or ".mp4"
    upload_key = f"{session_id}/{segment_type}/{Path(file_name).stem}{suffix}"
    upload_path = settings.storage_dir / upload_key
    upload_path.parent.mkdir(parents=True, exist_ok=True)
    return upload_key, str(upload_path)


def _duration_compliance(segment_type: str, actual_duration: float, config: dict[str, Any]) -> float:
    target = config["quality"]["segment_duration_targets"][segment_type]
    min_sec = float(target["min_sec"])
    max_sec = float(target["max_sec"])
    ideal = float(target["ideal_sec"])
    if actual_duration <= 0:
        return 0.25
    if actual_duration < min_sec:
        return max(0.3, actual_duration / min_sec)
    if actual_duration > max_sec:
        overflow = min(actual_duration - max_sec, ideal)
        return max(0.55, 1.0 - (overflow / (ideal + 1)))
    return 1.0


def build_segment_quality(
    segment_type: str,
    probe: MediaProbe,
    signal_hints: dict[str, Any],
    rules_config: dict[str, Any],
) -> dict[str, Any]:
    visibility = float(signal_hints.get("child_visibility_ratio", 0.82 if probe.file_path else 0.55))
    caregiver_visibility = float(
        signal_hints.get(
            "caregiver_visibility_ratio",
            0.78 if segment_type != "solo" and probe.file_path else (1.0 if segment_type == "solo" else 0.55),
        )
    )
    face_visibility = float(signal_hints.get("face_visibility_ratio", 0.70 if probe.file_path else 0.50))
    camera_stability = float(signal_hints.get("camera_stability_score", 0.80 if probe.file_path else 0.55))
    audio_quality = float(signal_hints.get("audio_quality_score", 0.75 if probe.has_audio else 0.40))
    feature_coverage = float(signal_hints.get("feature_coverage", 0.85 if signal_hints else 0.60))
    protocol_compliance = _duration_compliance(segment_type, probe.duration_sec, rules_config)

    warnings: list[str] = []
    if probe.duration_sec <= 0:
        warnings.append("duration_missing")
    if probe.frame_rate is not None and probe.frame_rate < 15:
        warnings.append("low_fps")
    if not probe.has_audio and "audio_quality_score" not in signal_hints:
        warnings.append("audio_missing")
    if visibility < 0.60:
        warnings.append("child_visibility_low")
    if segment_type != "solo" and caregiver_visibility < 0.55:
        warnings.append("caregiver_visibility_low")
    if face_visibility < 0.50:
        warnings.append("face_visibility_limited")
    if camera_stability < 0.55:
        warnings.append("camera_unstable")
    if protocol_compliance < 0.80:
        warnings.append(f"{segment_type}_duration_off_protocol")

    return {
        "duration_sec": probe.duration_sec,
        "resolution": {"width": probe.width, "height": probe.height},
        "frame_rate": probe.frame_rate,
        "has_audio": probe.has_audio,
        "child_visibility_ratio": round(visibility, 3),
        "caregiver_visibility_ratio": round(caregiver_visibility, 3),
        "face_visibility_ratio": round(face_visibility, 3),
        "camera_stability_score": round(camera_stability, 3),
        "audio_quality_score": round(audio_quality, 3),
        "feature_coverage": round(feature_coverage, 3),
        "protocol_compliance": round(protocol_compliance, 3),
        "warnings": warnings,
    }


def build_overall_quality(
    age_months: int,
    segment_qualities: list[dict[str, Any]],
    rules_config: dict[str, Any],
) -> dict[str, Any]:
    thresholds = rules_config["quality"]["confidence_thresholds"]
    factors = rules_config["quality"]["age_support_factor"]
    support_band = infer_age_support_band(age_months)
    age_factor = float(factors[support_band])
    if not segment_qualities:
        overall = 0.0
        warnings = ["no_segments"]
    else:
        protocol = min(s["protocol_compliance"] for s in segment_qualities)
        coverage = min(s["feature_coverage"] for s in segment_qualities)
        visibility = min(s["child_visibility_ratio"] for s in segment_qualities)
        audio = min(s["audio_quality_score"] for s in segment_qualities)
        stability = min(s["camera_stability_score"] for s in segment_qualities)
        overall = min(protocol, coverage, visibility, audio, stability) * age_factor
        warnings = [warning for s in segment_qualities for warning in s["warnings"]]

    if overall >= thresholds["high"]:
        label = rules_config["quality"]["labels"]["high"]
    elif overall >= thresholds["medium"]:
        label = rules_config["quality"]["labels"]["medium"]
    elif overall >= thresholds["limited"]:
        label = rules_config["quality"]["labels"]["limited"]
    else:
        label = rules_config["quality"]["labels"]["insufficient"]

    return {
        "overall_confidence": round(overall, 3),
        "label": label,
        "support_age_band": support_band,
        "warnings": sorted(set(warnings)),
    }

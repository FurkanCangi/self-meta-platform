from __future__ import annotations

import json
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.core.database import Base
from app.schemas.api import SessionCreateRequest
from app.services.extractors import extract_segment_signals
from app.services.session_ops import (
    complete_segment,
    create_session,
    get_session_or_404,
    latest_report,
)
from app.services.pipeline import run_observation_pipeline


def _db() -> Session:
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(bind=engine)
    testing_session = sessionmaker(bind=engine, future=True, class_=Session)
    return testing_session()


def test_pipeline_generates_domains_and_report() -> None:
    db = _db()
    fixture_path = Path(__file__).resolve().parents[1] / "fixtures" / "demo_session.json"
    payload = json.loads(fixture_path.read_text(encoding="utf-8"))
    session = create_session(db, SessionCreateRequest(**payload["session"]))
    for segment in payload["segments"]:
        complete_segment(
            db,
            session,
            segment["segment_type"],
            None,
            None,
            segment["duration_sec"],
            None,
            segment["signal_hints"],
            {},
        )
        session = get_session_or_404(db, session.id)

    processing = run_observation_pipeline(db, session)
    session = get_session_or_404(db, session.id)
    report = latest_report(session)

    assert processing.status == "completed"
    assert session.status == "processed"
    assert session.overall_confidence is not None
    assert len(session.domain_scores) == 5
    assert report is not None
    assert "Klinik Yorum" in report.llm_output_text
    lowered = report.llm_output_text.lower()
    assert "dehb" not in lowered
    assert "otizm" not in lowered


def test_extractor_auto_mode_returns_expected_feature_set_without_video() -> None:
    signals, extractor_version = extract_segment_signals(
        segment_type="solo",
        signal_hints={"engaged_play_ratio": 0.61},
        overall_quality=0.8,
        media_path=None,
        segment_quality={"child_visibility_ratio": 0.8},
    )
    assert extractor_version == "fallback_behavior_extractor_v1"
    names = {signal.name for signal in signals}
    assert "engaged_play_ratio" in names
    assert "organized_play_bout_length_sec" in names


@pytest.mark.skipif(
    not (
        settings.mediapipe_pose_model_path
        and settings.mediapipe_face_model_path
        and Path(settings.mediapipe_pose_model_path).exists()
        and Path(settings.mediapipe_face_model_path).exists()
        and (Path(__file__).resolve().parents[1] / "data" / "normalized" / "mediapipe_smoke.mp4").exists()
    ),
    reason="MediaPipe task modelleri veya smoke video fixture hazir degil.",
)
def test_extractor_uses_mediapipe_models_when_real_video_available() -> None:
    smoke_video = Path(__file__).resolve().parents[1] / "data" / "normalized" / "mediapipe_smoke.mp4"
    signals, extractor_version = extract_segment_signals(
        segment_type="solo",
        signal_hints={},
        overall_quality=0.8,
        media_path=str(smoke_video),
        segment_quality={"child_visibility_ratio": 0.8},
    )
    assert extractor_version.startswith("mediapipe_behavior_extractor")
    assert signals
    assert all(signal.provenance.get("source") in {"mediapipe_pose_face", "opencv_face_motion_fallback"} for signal in signals)
    assert all(signal.provenance.get("pose_model_path") for signal in signals)
    assert all(signal.provenance.get("face_model_path") for signal in signals)

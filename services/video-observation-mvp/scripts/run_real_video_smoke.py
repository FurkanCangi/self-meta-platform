from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.database import Base
from app.schemas.api import SessionCreateRequest
from app.services.session_ops import build_evidence, build_timeline, complete_segment, create_session, get_session_or_404
from app.services.pipeline import run_observation_pipeline


def _db() -> Session:
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(bind=engine)
    testing_session = sessionmaker(bind=engine, future=True, class_=Session)
    return testing_session()


def main() -> None:
    parser = argparse.ArgumentParser(description="Gercek video ile MediaPipe smoke testi calistirir.")
    parser.add_argument(
        "--video",
        default=str(Path(__file__).resolve().parents[1] / "data" / "normalized" / "mediapipe_smoke.mp4"),
        help="kullanilacak video yolu",
    )
    args = parser.parse_args()

    video_path = Path(args.video).resolve()
    if not video_path.exists():
        raise FileNotFoundError(f"video_not_found:{video_path}")
    temp_input_path = (Path(__file__).resolve().parents[1] / "data" / "tmp" / "real_video_smoke_input.mp4").resolve()
    temp_input_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(video_path, temp_input_path)

    payload = SessionCreateRequest(
        child_label="MediaPipe Smoke",
        child_external_ref="mediapipe-smoke-session",
        age_months=60,
        created_by="codex-smoke",
        consent_flags={"demo": True},
        session_notes="Gercek video fixture ile pose/face extractor smoke testi.",
        anamnesis_summary="Serbest oyun videosu smoke fixture. Amaç extractor ve evidence timeline doğrulamasıdır.",
        therapist_comments="Smoke test oturumu; klinik karar üretmek için kullanılmaz.",
        clinical_focus_areas=["attention_play", "co_regulation", "sensory_reactivity"],
        self_meta_context=None,
    )

    with _db() as db:
        session = create_session(db, payload)
        for segment_type in ("solo", "dyadic", "transition"):
            complete_segment(
                db,
                session,
                segment_type,
                None,
                str(temp_input_path),
                6.0,
                "real_video_smoke",
                {},
                {"fixture": "real_video_smoke", "video_path": str(video_path), "copied_input_path": str(temp_input_path)},
            )
            session = get_session_or_404(db, session.id)

        processing = run_observation_pipeline(db, session)
        session = get_session_or_404(db, session.id)

        timeline = build_timeline(session)
        evidence = build_evidence(session)
        extractor_versions = sorted({feature.extractor_version for segment in session.segments for feature in segment.derived_features})
        runtime_labels = sorted(
            {
                feature.provenance_json.get("mediapipe_runtime") or feature.provenance_json.get("source")
                for segment in session.segments
                for feature in segment.derived_features
            }
        )
        output = {
            "session_id": session.id,
            "status": processing.status,
            "overall_confidence": session.overall_confidence,
            "quality_label": session.quality_label,
            "extractor_versions": extractor_versions,
            "runtime_labels": runtime_labels,
            "timeline_event_count": len(timeline),
            "timeline_preview": timeline[:8],
            "evidence_summary": evidence,
        }
        print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

from __future__ import annotations

import json
from pathlib import Path

from app.core.database import Base, SessionLocal, engine
from app.schemas.api import SessionCreateRequest
from app.services.pipeline import run_observation_pipeline
from app.services.session_ops import complete_segment, create_session, latest_report


def main() -> None:
    fixture_path = Path(__file__).resolve().parents[1] / "fixtures" / "demo_session.json"
    payload = json.loads(fixture_path.read_text(encoding="utf-8"))

    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
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
        run_observation_pipeline(db, session)
        db.refresh(session)
        report = latest_report(session)
        print(f"Session: {session.id}")
        print(f"Status: {session.status}")
        print(f"Confidence: {session.overall_confidence}")
        print("--- REPORT ---")
        print(report.llm_output_text if report else "No report")


if __name__ == "__main__":
    main()

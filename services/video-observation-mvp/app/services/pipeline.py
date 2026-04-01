from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.entities import ObservationSession, ProcessingRun
from app.services.session_ops import process_session


def run_observation_pipeline(db: Session, session: ObservationSession) -> ProcessingRun:
    return process_session(db, session)

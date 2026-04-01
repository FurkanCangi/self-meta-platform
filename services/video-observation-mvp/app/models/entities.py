from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _uuid() -> str:
    return str(uuid4())


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class ObservationSession(Base):
    __tablename__ = "observation_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    child_label: Mapped[str] = mapped_column(String(120))
    child_external_ref: Mapped[str | None] = mapped_column(String(120), nullable=True)
    age_months: Mapped[int] = mapped_column(Integer)
    created_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    protocol_version: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(64), default="draft")
    consent_flags_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    toy_zone_roi_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    session_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    anamnesis_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    therapist_comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    clinical_focus_areas: Mapped[list[str]] = mapped_column(JSON, default=list)
    self_meta_payload_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    support_age_band: Mapped[str] = mapped_column(String(64), default="primary_supported")
    overall_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    quality_label: Mapped[str | None] = mapped_column(String(64), nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utcnow, onupdate=_utcnow
    )

    segments: Mapped[list["SessionSegment"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    media_assets: Mapped[list["MediaAsset"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    processing_runs: Mapped[list["ProcessingRun"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    rule_evaluations: Mapped[list["RuleEvaluation"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    domain_scores: Mapped[list["DomainScore"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    fusion_results: Mapped[list["FusionResult"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    report_versions: Mapped[list["ReportVersion"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    annotations: Mapped[list["Annotation"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class SessionSegment(Base):
    __tablename__ = "session_segments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(ForeignKey("observation_sessions.id"), index=True)
    segment_type: Mapped[str] = mapped_column(String(32))
    upload_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    duration_sec: Mapped[float | None] = mapped_column(Float, nullable=True)
    raw_video_asset_id: Mapped[str | None] = mapped_column(
        ForeignKey("media_assets.id"), nullable=True
    )
    normalized_video_asset_id: Mapped[str | None] = mapped_column(
        ForeignKey("media_assets.id"), nullable=True
    )
    quality_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    source_metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    signal_hints_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    protocol_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    session: Mapped[ObservationSession] = relationship(back_populates="segments")
    derived_features: Mapped[list["DerivedFeature"]] = relationship(
        back_populates="segment", cascade="all, delete-orphan"
    )
    detected_events: Mapped[list["DetectedEvent"]] = relationship(
        back_populates="segment", cascade="all, delete-orphan"
    )


class MediaAsset(Base):
    __tablename__ = "media_assets"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(ForeignKey("observation_sessions.id"), index=True)
    segment_id: Mapped[str | None] = mapped_column(ForeignKey("session_segments.id"), nullable=True)
    asset_role: Mapped[str] = mapped_column(String(32))
    storage_path: Mapped[str] = mapped_column(String(500))
    content_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    checksum: Mapped[str | None] = mapped_column(String(128), nullable=True)
    encrypted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    session: Mapped[ObservationSession] = relationship(back_populates="media_assets")


class ProcessingRun(Base):
    __tablename__ = "processing_runs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(ForeignKey("observation_sessions.id"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="queued")
    pipeline_version: Mapped[str] = mapped_column(String(64))
    rules_version: Mapped[str] = mapped_column(String(64))
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    logs_json: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    quality_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    error_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    session: Mapped[ObservationSession] = relationship(back_populates="processing_runs")


class DerivedFeature(Base):
    __tablename__ = "derived_features"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    session_segment_id: Mapped[str] = mapped_column(ForeignKey("session_segments.id"), index=True)
    feature_name: Mapped[str] = mapped_column(String(128))
    feature_value: Mapped[float] = mapped_column(Float)
    units: Mapped[str | None] = mapped_column(String(64), nullable=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.5)
    extractor_version: Mapped[str] = mapped_column(String(64))
    provenance_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    segment: Mapped[SessionSegment] = relationship(back_populates="derived_features")


class DetectedEvent(Base):
    __tablename__ = "detected_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    session_segment_id: Mapped[str] = mapped_column(ForeignKey("session_segments.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(64))
    start_ms: Mapped[int] = mapped_column(Integer)
    end_ms: Mapped[int] = mapped_column(Integer)
    confidence: Mapped[float] = mapped_column(Float)
    evidence_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    segment: Mapped[SessionSegment] = relationship(back_populates="detected_events")


class RuleEvaluation(Base):
    __tablename__ = "rule_evaluations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(ForeignKey("observation_sessions.id"), index=True)
    rule_id: Mapped[str] = mapped_column(String(128))
    rule_version: Mapped[str] = mapped_column(String(64))
    triggered: Mapped[bool] = mapped_column(Boolean)
    payload_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    session: Mapped[ObservationSession] = relationship(back_populates="rule_evaluations")


class DomainScore(Base):
    __tablename__ = "domain_scores"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(ForeignKey("observation_sessions.id"), index=True)
    domain_name: Mapped[str] = mapped_column(String(128))
    score_0_100: Mapped[float] = mapped_column(Float)
    label: Mapped[str] = mapped_column(String(64))
    confidence: Mapped[float] = mapped_column(Float)
    rationale_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    session: Mapped[ObservationSession] = relationship(back_populates="domain_scores")


class FusionResult(Base):
    __tablename__ = "fusion_results"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(ForeignKey("observation_sessions.id"), index=True)
    domain_name: Mapped[str] = mapped_column(String(128))
    scale_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    video_score: Mapped[float] = mapped_column(Float)
    history_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    fused_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    agreement_label: Mapped[str] = mapped_column(String(64))
    confidence: Mapped[float] = mapped_column(Float)
    next_step: Mapped[str | None] = mapped_column(String(128), nullable=True)
    rationale_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    session: Mapped[ObservationSession] = relationship(back_populates="fusion_results")


class ReportVersion(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(ForeignKey("observation_sessions.id"), index=True)
    deterministic_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    llm_prompt_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    llm_output_text: Mapped[str] = mapped_column(Text)
    approved_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    session: Mapped[ObservationSession] = relationship(back_populates="report_versions")


class Annotation(Base):
    __tablename__ = "annotations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(ForeignKey("observation_sessions.id"), index=True)
    annotator_user_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    event_or_domain_ref: Mapped[str] = mapped_column(String(255))
    old_value: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    new_value: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    session: Mapped[ObservationSession] = relationship(back_populates="annotations")

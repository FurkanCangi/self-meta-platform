from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


SegmentType = Literal["solo", "dyadic", "transition"]


class ToyZonePoint(BaseModel):
    x: float
    y: float


class ToyZoneROI(BaseModel):
    points: list[ToyZonePoint] = Field(min_length=4, max_length=4)


class SelfMetaScaleInput(BaseModel):
    domain: str
    score: float | None = None
    label: str | None = None


class SelfMetaContextInput(BaseModel):
    scales: list[SelfMetaScaleInput] = Field(default_factory=list)
    history_summary: str | None = None
    current_report_text: str | None = None
    clinical_targets: list[str] = Field(default_factory=list)


class SessionCreateRequest(BaseModel):
    child_label: str
    child_external_ref: str | None = None
    age_months: int = Field(ge=0, le=144)
    created_by: str | None = None
    consent_flags: dict[str, Any] = Field(default_factory=dict)
    toy_zone_roi: ToyZoneROI | None = None
    session_notes: str | None = None
    anamnesis_summary: str | None = None
    therapist_comments: str | None = None
    clinical_focus_areas: list[str] = Field(default_factory=list)
    self_meta_context: SelfMetaContextInput | None = None


class SessionCreateResponse(BaseModel):
    session_id: str
    status: str
    support_age_band: str
    protocol_version: str


class SessionListItemResponse(BaseModel):
    session_id: str
    child_label: str
    child_external_ref: str | None = None
    age_months: int
    support_age_band: str
    status: str
    overall_confidence: float | None = None
    quality_label: str | None = None
    created_at: datetime
    updated_at: datetime
    segment_count: int
    completed_segment_types: list[SegmentType] = Field(default_factory=list)
    has_report: bool = False


class SegmentPresignRequest(BaseModel):
    segment_type: SegmentType
    file_name: str
    content_type: str = "video/mp4"


class SegmentPresignResponse(BaseModel):
    session_id: str
    segment_type: SegmentType
    upload_key: str
    upload_url: str
    upload_method: str = "PUT"
    storage_backend: str = "local"
    headers: dict[str, str] = Field(default_factory=dict)
    expires_in_sec: int = 900
    message: str


class DirectUploadResponse(BaseModel):
    session_id: str
    segment_type: SegmentType
    upload_key: str
    storage_backend: str
    storage_path: str
    byte_size: int


class SegmentCompleteRequest(BaseModel):
    segment_type: SegmentType
    upload_key: str | None = None
    file_path: str | None = None
    duration_sec: float | None = None
    protocol_notes: str | None = None
    signal_hints: dict[str, Any] = Field(default_factory=dict)
    source_metadata: dict[str, Any] = Field(default_factory=dict)


class SessionSubmitRequest(BaseModel):
    auto_start_processing: bool = True


class ProcessingStatusResponse(BaseModel):
    session_id: str
    status: str
    pipeline_version: str
    rules_version: str
    overall_confidence: float | None = None
    quality_label: str | None = None
    last_error: str | None = None
    logs: list[dict[str, Any]] = Field(default_factory=list)


class TimelineEventResponse(BaseModel):
    segment_type: SegmentType
    event_type: str
    start_ms: int
    end_ms: int
    confidence: float
    evidence: dict[str, Any]


class DomainResponse(BaseModel):
    name: str
    score_0_100: float
    label: str
    confidence: float
    rationale: dict[str, Any]


class FusionResponse(BaseModel):
    domain_name: str
    scale_score: float | None
    video_score: float
    history_score: float | None
    fused_score: float | None
    agreement_label: str
    confidence: float
    next_step: str | None
    rationale: dict[str, Any]


class SessionSummaryResponse(BaseModel):
    session_id: str
    child_label: str
    age_months: int
    support_age_band: str
    status: str
    overall_confidence: float | None
    quality_label: str | None
    protocol_version: str
    created_at: datetime
    segment_count: int
    warnings: list[str] = Field(default_factory=list)


class EvidenceResponse(BaseModel):
    session_id: str
    rules: list[dict[str, Any]]
    events: list[TimelineEventResponse]
    domain_evidence: dict[str, list[dict[str, Any]]]


class ReportResponse(BaseModel):
    session_id: str
    report_text: str
    deterministic_payload: dict[str, Any]
    llm_prompt_version: str | None = None
    approved_by: str | None = None
    approved_at: datetime | None = None


class OverrideRequest(BaseModel):
    annotator_user_id: str | None = None
    target_type: Literal["domain", "event"]
    target_ref: str
    new_value: dict[str, Any]
    reason: str | None = None


class ApproveRequest(BaseModel):
    approved_by: str


class AdminMetricsResponse(BaseModel):
    total_sessions: int
    processed_sessions: int
    average_confidence: float
    low_quality_sessions: int
    overrides_total: int
    protocol_compliance_rate: float

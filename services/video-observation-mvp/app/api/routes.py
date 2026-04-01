from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.entities import Annotation, DomainScore
from app.schemas.api import (
    AdminMetricsResponse,
    ApproveRequest,
    DirectUploadResponse,
    DomainResponse,
    EvidenceResponse,
    FusionResponse,
    OverrideRequest,
    ProcessingStatusResponse,
    ReportResponse,
    SegmentCompleteRequest,
    SegmentPresignRequest,
    SegmentPresignResponse,
    SessionCreateRequest,
    SessionCreateResponse,
    SessionListItemResponse,
    SessionSubmitRequest,
    SessionSummaryResponse,
    TimelineEventResponse,
)
from app.services.pipeline import run_observation_pipeline
from app.services.session_ops import (
    admin_quality_metrics,
    build_evidence,
    build_summary,
    build_timeline,
    complete_segment,
    create_presign_stub,
    create_session,
    get_session_or_404,
    latest_report,
    list_sessions,
    processing_status,
)
from app.services.storage import ingest_upload_bytes


router = APIRouter()


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _session_or_404(db: Session, session_id: str):
    try:
        return get_session_or_404(db, session_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/")
def healthcheck() -> dict[str, str]:
    return {"status": "ok", "service": "selfmeta-video-observation-mvp"}


@router.post("/sessions", response_model=SessionCreateResponse)
def create_session_route(payload: SessionCreateRequest, db: Session = Depends(get_db)) -> SessionCreateResponse:
    session = create_session(db, payload)
    return SessionCreateResponse(
        session_id=session.id,
        status=session.status,
        support_age_band=session.support_age_band,
        protocol_version=session.protocol_version,
    )


@router.get("/sessions", response_model=list[SessionListItemResponse])
def list_sessions_route(
    limit: int = Query(default=20, ge=1, le=100),
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[SessionListItemResponse]:
    sessions = list_sessions(db, limit=limit, child_label_query=q)
    return [
        SessionListItemResponse(
            session_id=session.id,
            child_label=session.child_label,
            child_external_ref=session.child_external_ref,
            age_months=session.age_months,
            support_age_band=session.support_age_band,
            status=session.status,
            overall_confidence=session.overall_confidence,
            quality_label=session.quality_label,
            created_at=session.created_at,
            updated_at=session.updated_at,
            segment_count=len(session.segments),
            completed_segment_types=[
                segment.segment_type
                for segment in session.segments
                if segment.completed_at is not None
            ],
            has_report=latest_report(session) is not None,
        )
        for session in sessions
    ]


@router.post("/sessions/{session_id}/segments/presign", response_model=SegmentPresignResponse)
def presign_segment(
    session_id: str,
    payload: SegmentPresignRequest,
    db: Session = Depends(get_db),
) -> SegmentPresignResponse:
    _session_or_404(db, session_id)
    stub = create_presign_stub(session_id, payload.segment_type, payload.file_name)
    return SegmentPresignResponse(
        session_id=session_id,
        segment_type=payload.segment_type,
        upload_key=stub["upload_key"],
        upload_url=stub["upload_url"],
        upload_method=stub.get("upload_method", "PUT"),
        storage_backend=stub.get("storage_backend", "local"),
        headers=stub.get("headers", {}),
        message="Gercek upload hedefi olusturuldu.",
    )


@router.put("/sessions/{session_id}/segments/upload/{segment_type}", response_model=DirectUploadResponse)
async def upload_segment_binary(
    session_id: str,
    segment_type: str,
    request: Request,
    upload_key: str = Query(...),
    db: Session = Depends(get_db),
) -> DirectUploadResponse:
    _session_or_404(db, session_id)
    payload = await request.body()
    if not payload:
        raise HTTPException(status_code=400, detail="empty_upload_payload")
    stored = ingest_upload_bytes(upload_key, payload, content_type=request.headers.get("content-type"))
    return DirectUploadResponse(
        session_id=session_id,
        segment_type=segment_type,  # type: ignore[arg-type]
        upload_key=stored.upload_key,
        storage_backend=stored.storage_backend,
        storage_path=stored.storage_path,
        byte_size=stored.byte_size or len(payload),
    )


@router.post("/sessions/{session_id}/segments/complete")
def complete_segment_route(
    session_id: str,
    payload: SegmentCompleteRequest,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    session = _session_or_404(db, session_id)
    segment = complete_segment(
        db,
        session,
        payload.segment_type,
        payload.upload_key,
        payload.file_path,
        payload.duration_sec,
        payload.protocol_notes,
        payload.signal_hints,
        payload.source_metadata,
    )
    return {"session_id": session_id, "segment_id": segment.id, "status": "completed"}


@router.post("/sessions/{session_id}/submit", response_model=ProcessingStatusResponse)
def submit_session(
    session_id: str,
    payload: SessionSubmitRequest,
    db: Session = Depends(get_db),
) -> ProcessingStatusResponse:
    session = _session_or_404(db, session_id)
    session.status = "submitted"
    session.submitted_at = _utcnow()
    db.commit()
    if payload.auto_start_processing:
        run_observation_pipeline(db, session)
        db.refresh(session)
    return ProcessingStatusResponse(**processing_status(session))


@router.post("/processing/{session_id}/start", response_model=ProcessingStatusResponse)
def start_processing(session_id: str, db: Session = Depends(get_db)) -> ProcessingStatusResponse:
    session = _session_or_404(db, session_id)
    processing = run_observation_pipeline(db, session)
    db.refresh(session)
    return ProcessingStatusResponse(
        session_id=session.id,
        status=processing.status,
        pipeline_version=processing.pipeline_version,
        rules_version=processing.rules_version,
        overall_confidence=session.overall_confidence,
        quality_label=session.quality_label,
        last_error=processing.error_text,
        logs=processing.logs_json,
    )


@router.get("/processing/{session_id}/status", response_model=ProcessingStatusResponse)
def processing_status_route(session_id: str, db: Session = Depends(get_db)) -> ProcessingStatusResponse:
    session = _session_or_404(db, session_id)
    latest = max(session.processing_runs, key=lambda row: row.started_at or datetime.min, default=None)
    return ProcessingStatusResponse(
        session_id=session.id,
        status=(latest.status if latest else session.status),
        pipeline_version=(latest.pipeline_version if latest else "free_play_v1"),
        rules_version=(latest.rules_version if latest else "free_play_rules_v1"),
        overall_confidence=session.overall_confidence,
        quality_label=session.quality_label,
        last_error=(latest.error_text if latest else None),
        logs=(latest.logs_json if latest else []),
    )


@router.get("/sessions/{session_id}/summary", response_model=SessionSummaryResponse)
def session_summary(session_id: str, db: Session = Depends(get_db)) -> SessionSummaryResponse:
    session = _session_or_404(db, session_id)
    return SessionSummaryResponse(**build_summary(session))


@router.get("/sessions/{session_id}/domains", response_model=list[DomainResponse])
def session_domains(session_id: str, db: Session = Depends(get_db)) -> list[DomainResponse]:
    session = _session_or_404(db, session_id)
    return [
        DomainResponse(
            name=row.domain_name,
            score_0_100=row.score_0_100,
            label=row.label,
            confidence=row.confidence,
            rationale=row.rationale_json,
        )
        for row in session.domain_scores
    ]


@router.get("/sessions/{session_id}/timeline", response_model=list[TimelineEventResponse])
def session_timeline(session_id: str, db: Session = Depends(get_db)) -> list[TimelineEventResponse]:
    session = _session_or_404(db, session_id)
    return [TimelineEventResponse(**row) for row in build_timeline(session)]


@router.get("/sessions/{session_id}/evidence", response_model=EvidenceResponse)
def session_evidence(session_id: str, db: Session = Depends(get_db)) -> EvidenceResponse:
    session = _session_or_404(db, session_id)
    return EvidenceResponse(**build_evidence(session))


@router.get("/sessions/{session_id}/report", response_model=ReportResponse)
def session_report(session_id: str, db: Session = Depends(get_db)) -> ReportResponse:
    session = _session_or_404(db, session_id)
    report = latest_report(session)
    if report is None:
        raise HTTPException(status_code=404, detail="report_not_ready")
    return ReportResponse(
        session_id=session.id,
        report_text=report.llm_output_text,
        deterministic_payload=report.deterministic_json,
        llm_prompt_version=report.llm_prompt_version,
        approved_by=report.approved_by,
        approved_at=report.approved_at,
    )


@router.post("/sessions/{session_id}/fuse", response_model=list[FusionResponse])
def refusion(session_id: str, db: Session = Depends(get_db)) -> list[FusionResponse]:
    session = _session_or_404(db, session_id)
    if not session.domain_scores:
        raise HTTPException(status_code=400, detail="domains_missing")
    run_observation_pipeline(db, session)
    db.refresh(session)
    return [
        FusionResponse(
            domain_name=row.domain_name,
            scale_score=row.scale_score,
            video_score=row.video_score,
            history_score=row.history_score,
            fused_score=row.fused_score,
            agreement_label=row.agreement_label,
            confidence=row.confidence,
            next_step=row.next_step,
            rationale=row.rationale_json,
        )
        for row in session.fusion_results
    ]


@router.get("/sessions/{session_id}/fusion", response_model=list[FusionResponse])
def session_fusion(session_id: str, db: Session = Depends(get_db)) -> list[FusionResponse]:
    session = _session_or_404(db, session_id)
    return [
        FusionResponse(
            domain_name=row.domain_name,
            scale_score=row.scale_score,
            video_score=row.video_score,
            history_score=row.history_score,
            fused_score=row.fused_score,
            agreement_label=row.agreement_label,
            confidence=row.confidence,
            next_step=row.next_step,
            rationale=row.rationale_json,
        )
        for row in session.fusion_results
    ]


@router.post("/sessions/{session_id}/override")
def override_session(
    session_id: str,
    payload: OverrideRequest,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    session = _session_or_404(db, session_id)
    old_value: dict[str, object] = {}
    if payload.target_type == "domain":
        row = db.scalar(
            select(DomainScore).where(
                DomainScore.session_id == session.id,
                DomainScore.domain_name == payload.target_ref,
            )
        )
        if row is None:
            raise HTTPException(status_code=404, detail="domain_not_found")
        old_value = {"label": row.label, "score_0_100": row.score_0_100}
        if "label" in payload.new_value:
            row.label = str(payload.new_value["label"])
        if "score_0_100" in payload.new_value:
            row.score_0_100 = float(payload.new_value["score_0_100"])
    else:
        old_value = {"target_ref": payload.target_ref}

    db.add(
        Annotation(
            session_id=session.id,
            annotator_user_id=payload.annotator_user_id,
            event_or_domain_ref=payload.target_ref,
            old_value=old_value,
            new_value=payload.new_value,
            reason=payload.reason,
        )
    )
    db.commit()
    return {"session_id": session.id, "status": "override_recorded"}


@router.post("/sessions/{session_id}/approve")
def approve_report(session_id: str, payload: ApproveRequest, db: Session = Depends(get_db)) -> dict[str, str]:
    session = _session_or_404(db, session_id)
    report = latest_report(session)
    if report is None:
        raise HTTPException(status_code=404, detail="report_not_ready")
    report.approved_by = payload.approved_by
    report.approved_at = _utcnow()
    session.approved_at = report.approved_at
    session.status = "approved"
    db.commit()
    return {"session_id": session.id, "status": "approved"}


@router.post("/sessions/{session_id}/recompute", response_model=ProcessingStatusResponse)
def recompute(session_id: str, db: Session = Depends(get_db)) -> ProcessingStatusResponse:
    session = _session_or_404(db, session_id)
    processing = run_observation_pipeline(db, session)
    db.refresh(session)
    return ProcessingStatusResponse(
        session_id=session.id,
        status=processing.status,
        pipeline_version=processing.pipeline_version,
        rules_version=processing.rules_version,
        overall_confidence=session.overall_confidence,
        quality_label=session.quality_label,
        last_error=processing.error_text,
        logs=processing.logs_json,
    )


@router.get("/admin/quality-metrics", response_model=AdminMetricsResponse)
def quality_metrics(db: Session = Depends(get_db)) -> AdminMetricsResponse:
    return AdminMetricsResponse(**admin_quality_metrics(db))


@router.get("/admin/override-metrics", response_model=AdminMetricsResponse)
def override_metrics(db: Session = Depends(get_db)) -> AdminMetricsResponse:
    return AdminMetricsResponse(**admin_quality_metrics(db))


@router.get("/admin/protocol-compliance", response_model=AdminMetricsResponse)
def protocol_compliance(db: Session = Depends(get_db)) -> AdminMetricsResponse:
    return AdminMetricsResponse(**admin_quality_metrics(db))

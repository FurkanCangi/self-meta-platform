from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import (
    Annotation,
    DerivedFeature,
    DetectedEvent,
    DomainScore,
    FusionResult,
    MediaAsset,
    ObservationSession,
    ProcessingRun,
    ReportVersion,
    RuleEvaluation,
    SessionSegment,
)
from app.schemas.api import SessionCreateRequest
from app.services.events import derive_events
from app.services.extractors import extract_segment_signals
from app.services.fusion import fuse_results
from app.services.media import (
    build_overall_quality,
    build_segment_quality,
    infer_age_support_band,
    normalize_video,
    probe_media,
)
from app.services.reporting import build_report_payload, build_report_text
from app.services.scoring import compute_domain_scores, evaluate_rules, flatten_features, load_rules_config
from app.services.storage import build_upload_target, resolve_upload_to_local


EXPECTED_SEGMENTS = {"solo", "dyadic", "transition"}


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def create_session(db: Session, payload: SessionCreateRequest) -> ObservationSession:
    session = ObservationSession(
        child_label=payload.child_label,
        child_external_ref=payload.child_external_ref,
        age_months=payload.age_months,
        created_by=payload.created_by,
        protocol_version=settings.protocol_version,
        consent_flags_json=payload.consent_flags,
        toy_zone_roi_json=payload.toy_zone_roi.model_dump() if payload.toy_zone_roi else None,
        session_notes=payload.session_notes,
        anamnesis_summary=payload.anamnesis_summary,
        therapist_comments=payload.therapist_comments,
        clinical_focus_areas=payload.clinical_focus_areas,
        self_meta_payload_json=payload.self_meta_context.model_dump() if payload.self_meta_context else {},
        support_age_band=infer_age_support_band(payload.age_months),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def list_sessions(
    db: Session,
    *,
    limit: int = 20,
    child_label_query: str | None = None,
) -> list[ObservationSession]:
    safe_limit = max(1, min(limit, 100))
    stmt = select(ObservationSession).order_by(ObservationSession.created_at.desc())

    clean_query = (child_label_query or "").strip()
    if clean_query:
        like_term = f"%{clean_query.lower()}%"
        stmt = stmt.where(func.lower(ObservationSession.child_label).like(like_term))

    return list(db.scalars(stmt.limit(safe_limit)).all())


def get_session_or_404(db: Session, session_id: str) -> ObservationSession:
    session = db.get(ObservationSession, session_id)
    if session is None:
        raise ValueError(f"session_not_found:{session_id}")
    return session


def create_presign_stub(session_id: str, segment_type: str, file_name: str) -> dict[str, Any]:
    target = build_upload_target(session_id, segment_type, file_name)
    return {
        "upload_key": target.upload_key,
        "upload_url": target.upload_url,
        "upload_method": target.upload_method,
        "storage_backend": target.storage_backend,
        "headers": target.headers,
    }


def complete_segment(
    db: Session,
    session: ObservationSession,
    segment_type: str,
    upload_key: str | None,
    file_path: str | None,
    duration_sec: float | None,
    protocol_notes: str | None,
    signal_hints: dict[str, Any],
    source_metadata: dict[str, Any],
) -> SessionSegment:
    resolved_upload = None
    effective_file_path = file_path
    effective_storage_path = file_path
    if not effective_file_path and upload_key:
        resolved_upload = resolve_upload_to_local(upload_key)
        effective_file_path = resolved_upload.local_path
        effective_storage_path = resolved_upload.storage_path

    existing = db.scalar(
        select(SessionSegment).where(
            SessionSegment.session_id == session.id,
            SessionSegment.segment_type == segment_type,
        )
    )
    if existing is None:
        existing = SessionSegment(session_id=session.id, segment_type=segment_type)
        db.add(existing)
        db.flush()

    raw_probe = probe_media(effective_file_path, duration_hint=duration_sec)
    raw_asset = None
    if raw_probe.file_path:
        raw_asset = MediaAsset(
            session_id=session.id,
            segment_id=existing.id,
            asset_role="raw",
            storage_path=effective_storage_path or raw_probe.file_path,
            content_type=raw_probe.content_type,
            checksum=raw_probe.checksum,
        )
        db.add(raw_asset)
        db.flush()

    normalized_path = normalize_video(upload_key, effective_file_path)
    normalized_asset = None
    if normalized_path:
        normalized_probe = probe_media(normalized_path, duration_hint=duration_sec or raw_probe.duration_sec)
        normalized_asset = MediaAsset(
            session_id=session.id,
            segment_id=existing.id,
            asset_role="normalized",
            storage_path=normalized_path,
            content_type=normalized_probe.content_type,
            checksum=normalized_probe.checksum,
        )
        db.add(normalized_asset)
        db.flush()
    else:
        normalized_probe = raw_probe

    rules_config = load_rules_config(settings.rules_path)
    quality_json = build_segment_quality(segment_type, normalized_probe, signal_hints, rules_config)

    existing.upload_key = upload_key
    existing.duration_sec = duration_sec or normalized_probe.duration_sec
    existing.raw_video_asset_id = raw_asset.id if raw_asset else None
    existing.normalized_video_asset_id = normalized_asset.id if normalized_asset else None
    existing.quality_json = quality_json
    existing.source_metadata_json = {**source_metadata, "probe": normalized_probe.raw}
    existing.signal_hints_json = signal_hints
    existing.protocol_notes = protocol_notes
    existing.completed_at = _utcnow()

    db.commit()
    db.refresh(existing)
    return existing


def _clear_processing_outputs(db: Session, session_id: str) -> None:
    for model in (DomainScore, FusionResult, RuleEvaluation, ReportVersion):
        for row in db.scalars(select(model).where(model.session_id == session_id)).all():
            db.delete(row)
    for segment in db.scalars(select(SessionSegment).where(SessionSegment.session_id == session_id)).all():
        for feature in list(segment.derived_features):
            db.delete(feature)
        for event in list(segment.detected_events):
            db.delete(event)
    db.commit()


def process_session(db: Session, session: ObservationSession) -> ProcessingRun:
    _clear_processing_outputs(db, session.id)
    rules_config = load_rules_config(settings.rules_path)
    processing = ProcessingRun(
        session_id=session.id,
        status="running",
        pipeline_version=settings.pipeline_version,
        rules_version=settings.rules_version,
        started_at=_utcnow(),
        logs_json=[],
    )
    db.add(processing)
    db.commit()
    db.refresh(processing)

    try:
        segment_feature_map: dict[str, dict[str, float]] = {}
        feature_confidences: dict[str, dict[str, float]] = {}
        segment_qualities: list[dict[str, Any]] = []
        timeline_cache: list[dict[str, Any]] = []
        segment_extractors: dict[str, str] = {}

        segments = db.scalars(
            select(SessionSegment).where(SessionSegment.session_id == session.id)
        ).all()
        for segment in segments:
            segment_qualities.append(segment.quality_json)
        overall_quality = build_overall_quality(session.age_months, segment_qualities, rules_config)

        for segment in segments:
            normalized_asset = db.get(MediaAsset, segment.normalized_video_asset_id) if segment.normalized_video_asset_id else None
            derived, extractor_version = extract_segment_signals(
                segment_type=segment.segment_type,
                signal_hints=segment.signal_hints_json,
                overall_quality=overall_quality["overall_confidence"],
                media_path=(normalized_asset.storage_path if normalized_asset else None),
                segment_quality=segment.quality_json,
            )
            segment_extractors[segment.segment_type] = extractor_version
            feature_map: dict[str, float] = {}
            confidence_map: dict[str, float] = {}
            for signal in derived:
                feature_map[signal.name] = signal.value
                confidence_map[signal.name] = signal.confidence
                segment.derived_features.append(
                    DerivedFeature(
                        feature_name=signal.name,
                        feature_value=signal.value,
                        units=signal.units,
                        confidence=signal.confidence,
                        extractor_version=extractor_version,
                        provenance_json=signal.provenance,
                    )
                )
            segment_feature_map[segment.segment_type] = feature_map
            feature_confidences[segment.segment_type] = confidence_map
            events = derive_events(segment.segment_type, segment.duration_sec or 0.0, feature_map, segment.quality_json)
            for event in events:
                segment.detected_events.append(
                    DetectedEvent(
                        event_type=event.event_type,
                        start_ms=event.start_ms,
                        end_ms=event.end_ms,
                        confidence=event.confidence,
                        evidence_json=event.evidence,
                    )
                )
                timeline_cache.append(
                    {
                        "segment_type": segment.segment_type,
                        "event_type": event.event_type,
                        "start_ms": event.start_ms,
                        "end_ms": event.end_ms,
                        "confidence": event.confidence,
                        "evidence": event.evidence,
                    }
                )

        flat_features = flatten_features(segment_feature_map, overall_quality)
        rule_rows = evaluate_rules(rules_config, flat_features)
        for row in rule_rows:
            session.rule_evaluations.append(
                RuleEvaluation(
                    rule_id=row["rule_id"],
                    rule_version=row["rule_version"],
                    triggered=row["triggered"],
                    payload_json={
                        "domain": row["domain"],
                        "severity": row["severity"],
                        "evidence": row["evidence"],
                    },
                )
            )

        domain_rows = compute_domain_scores(
            rules_config,
            segment_feature_map,
            feature_confidences,
            overall_quality,
            rule_rows,
        )
        for row in domain_rows:
            session.domain_scores.append(
                DomainScore(
                    domain_name=row["domain_name"],
                    score_0_100=row["score_0_100"],
                    label=row["label"],
                    confidence=row["confidence"],
                    rationale_json=row["rationale_json"],
                )
            )

        session_context = {
            "child_label": session.child_label,
            "age_months": session.age_months,
            "anamnesis_summary": session.anamnesis_summary,
            "therapist_comments": session.therapist_comments,
            "clinical_focus_areas": session.clinical_focus_areas,
            "history_summary": session.self_meta_payload_json.get("history_summary") if session.self_meta_payload_json else None,
        }
        fusion_rows = fuse_results(
            domain_rows,
            session.self_meta_payload_json or {},
            session.support_age_band,
            overall_quality,
            rules_config,
            session_context,
        )
        for row in fusion_rows:
            session.fusion_results.append(
                FusionResult(
                    domain_name=row["domain_name"],
                    scale_score=row["scale_score"],
                    video_score=row["video_score"],
                    history_score=row["history_score"],
                    fused_score=row["fused_score"],
                    agreement_label=row["agreement_label"],
                    confidence=row["confidence"],
                    next_step=row["next_step"],
                    rationale_json=row["rationale_json"],
                )
            )

        report_payload = build_report_payload(
            session_context,
            overall_quality,
            segment_feature_map,
            domain_rows,
            fusion_rows,
            rule_rows,
        )
        report_text = build_report_text(
            session_context,
            overall_quality,
            segment_feature_map,
            domain_rows,
            fusion_rows,
        )
        session.report_versions.append(
            ReportVersion(
                deterministic_json=report_payload,
                llm_prompt_version="deterministic_only_v1",
                llm_output_text=report_text,
            )
        )

        processing.logs_json = [
            {"step": "segments_loaded", "count": len(segments)},
            {"step": "quality", "overall_confidence": overall_quality["overall_confidence"]},
            {"step": "extractors", "segments": segment_extractors},
            {"step": "events_generated", "count": len(timeline_cache)},
            {"step": "domains_scored", "count": len(domain_rows)},
            {"step": "fusion", "count": len(fusion_rows)},
        ]
        processing.quality_json = overall_quality
        processing.status = "completed"
        processing.finished_at = _utcnow()
        session.status = "processed"
        session.overall_confidence = overall_quality["overall_confidence"]
        session.quality_label = overall_quality["label"]
        db.commit()
        db.refresh(processing)
        return processing
    except Exception as exc:  # pragma: no cover - error path still surfaced via API
        processing.status = "failed"
        processing.error_text = str(exc)
        processing.finished_at = _utcnow()
        session.status = "error"
        db.commit()
        db.refresh(processing)
        raise


def processing_status(session: ObservationSession) -> dict[str, Any]:
    latest = max(session.processing_runs, key=lambda row: row.started_at or datetime.min, default=None)
    return {
        "session_id": session.id,
        "status": latest.status if latest else session.status,
        "pipeline_version": latest.pipeline_version if latest else settings.pipeline_version,
        "rules_version": latest.rules_version if latest else settings.rules_version,
        "overall_confidence": session.overall_confidence,
        "quality_label": session.quality_label,
        "last_error": latest.error_text if latest else None,
        "logs": latest.logs_json if latest else [],
    }


def build_summary(session: ObservationSession) -> dict[str, Any]:
    latest = max(session.processing_runs, key=lambda row: row.started_at or datetime.min, default=None)
    warnings = latest.quality_json.get("warnings", []) if latest else []
    return {
        "session_id": session.id,
        "child_label": session.child_label,
        "age_months": session.age_months,
        "support_age_band": session.support_age_band,
        "status": session.status,
        "overall_confidence": session.overall_confidence,
        "quality_label": session.quality_label,
        "protocol_version": session.protocol_version,
        "created_at": session.created_at,
        "segment_count": len(session.segments),
        "warnings": warnings,
    }


def build_timeline(session: ObservationSession) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for segment in session.segments:
        for event in segment.detected_events:
            rows.append(
                {
                    "segment_type": segment.segment_type,
                    "event_type": event.event_type,
                    "start_ms": event.start_ms,
                    "end_ms": event.end_ms,
                    "confidence": event.confidence,
                    "evidence": event.evidence_json,
                }
            )
    return sorted(rows, key=lambda row: (row["segment_type"], row["start_ms"]))


def build_evidence(session: ObservationSession) -> dict[str, Any]:
    domain_evidence: dict[str, list[dict[str, Any]]] = {}
    for domain in session.domain_scores:
        domain_evidence[domain.domain_name] = domain.rationale_json.get("evidence", [])
    return {
        "session_id": session.id,
        "rules": [
            {
                "rule_id": row.rule_id,
                "triggered": row.triggered,
                "payload": row.payload_json,
            }
            for row in session.rule_evaluations
        ],
        "events": build_timeline(session),
        "domain_evidence": domain_evidence,
    }


def latest_report(session: ObservationSession) -> ReportVersion | None:
    if not session.report_versions:
        return None
    return max(session.report_versions, key=lambda row: row.created_at)


def admin_quality_metrics(db: Session) -> dict[str, Any]:
    total_sessions = db.scalar(select(func.count(ObservationSession.id))) or 0
    processed_sessions = db.scalar(
        select(func.count(ObservationSession.id)).where(ObservationSession.status == "processed")
    ) or 0
    average_confidence = db.scalar(select(func.avg(ObservationSession.overall_confidence))) or 0.0
    low_quality_sessions = db.scalar(
        select(func.count(ObservationSession.id)).where(ObservationSession.overall_confidence < 0.40)
    ) or 0
    overrides_total = db.scalar(select(func.count(Annotation.id))) or 0
    protocol_compliance_rate = 0.0
    if processed_sessions:
        protocol_compliance_rate = round(processed_sessions / max(total_sessions, 1), 3)
    return {
        "total_sessions": int(total_sessions),
        "processed_sessions": int(processed_sessions),
        "average_confidence": round(float(average_confidence), 3),
        "low_quality_sessions": int(low_quality_sessions),
        "overrides_total": int(overrides_total),
        "protocol_compliance_rate": protocol_compliance_rate,
    }

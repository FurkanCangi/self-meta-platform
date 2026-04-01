from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.parse import quote

from app.core.config import settings

try:
    import boto3
except ImportError:  # pragma: no cover - optional dependency
    boto3 = None


@dataclass
class UploadTarget:
    upload_key: str
    upload_url: str
    upload_method: str
    storage_backend: str
    headers: dict[str, str]


@dataclass
class StoredUpload:
    upload_key: str
    storage_path: str
    storage_backend: str
    content_type: str | None = None
    byte_size: int | None = None


@dataclass
class ResolvedUpload:
    upload_key: str
    storage_path: str
    local_path: str
    storage_backend: str


def _sanitize_upload_key(upload_key: str) -> str:
    key = upload_key.strip().lstrip("/")
    if not key or ".." in Path(key).parts:
        raise ValueError("invalid_upload_key")
    return key


def _local_upload_path(upload_key: str) -> Path:
    key = _sanitize_upload_key(upload_key)
    path = (settings.storage_dir / key).resolve()
    storage_root = settings.storage_dir.resolve()
    if storage_root not in path.parents and path != storage_root:
        raise ValueError("invalid_upload_key_path")
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _build_upload_key(session_id: str, segment_type: str, file_name: str) -> str:
    file_path = Path(file_name)
    suffix = file_path.suffix or ".mp4"
    stem = file_path.stem or segment_type
    return f"{session_id}/{segment_type}/{stem}{suffix}"


def _local_upload_url(session_id: str, segment_type: str, upload_key: str) -> str:
    base = settings.storage_public_base_url.rstrip("/")
    query = f"upload_key={quote(upload_key)}"
    path = f"/sessions/{session_id}/segments/upload/{segment_type}?{query}"
    return f"{base}{path}" if base else path


def _s3_client():
    if boto3 is None:
        raise RuntimeError("boto3_not_installed")
    if not settings.s3_bucket:
        raise RuntimeError("s3_bucket_missing")
    return boto3.client(
        "s3",
        region_name=settings.s3_region,
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
    )


def build_upload_target(session_id: str, segment_type: str, file_name: str) -> UploadTarget:
    upload_key = _build_upload_key(session_id, segment_type, file_name)
    if settings.storage_backend == "s3":
        client = _s3_client()
        upload_url = client.generate_presigned_url(
            "put_object",
            Params={"Bucket": settings.s3_bucket, "Key": upload_key, "ContentType": "video/mp4"},
            ExpiresIn=settings.s3_presign_expiry_sec,
            HttpMethod="PUT",
        )
        return UploadTarget(
            upload_key=upload_key,
            upload_url=upload_url,
            upload_method="PUT",
            storage_backend="s3",
            headers={"content-type": "video/mp4"},
        )

    local_path = _local_upload_path(upload_key)
    return UploadTarget(
        upload_key=upload_key,
        upload_url=_local_upload_url(session_id, segment_type, upload_key),
        upload_method="PUT",
        storage_backend="local",
        headers={"content-type": "video/mp4"},
    )


def ingest_upload_bytes(upload_key: str, payload: bytes, content_type: str | None = None) -> StoredUpload:
    if settings.storage_backend == "s3":
        client = _s3_client()
        client.put_object(
            Bucket=settings.s3_bucket,
            Key=_sanitize_upload_key(upload_key),
            Body=payload,
            ContentType=content_type or "video/mp4",
        )
        return StoredUpload(
            upload_key=upload_key,
            storage_path=f"s3://{settings.s3_bucket}/{_sanitize_upload_key(upload_key)}",
            storage_backend="s3",
            content_type=content_type,
            byte_size=len(payload),
        )

    local_path = _local_upload_path(upload_key)
    local_path.write_bytes(payload)
    return StoredUpload(
        upload_key=upload_key,
        storage_path=str(local_path),
        storage_backend="local",
        content_type=content_type,
        byte_size=len(payload),
    )


def resolve_upload_to_local(upload_key: str) -> ResolvedUpload:
    key = _sanitize_upload_key(upload_key)
    if settings.storage_backend == "s3":
        client = _s3_client()
        with NamedTemporaryFile(delete=False, suffix=Path(key).suffix or ".mp4", dir=settings.temp_dir) as handle:
            client.download_fileobj(settings.s3_bucket, key, handle)
            return ResolvedUpload(
                upload_key=key,
                storage_path=f"s3://{settings.s3_bucket}/{key}",
                local_path=handle.name,
                storage_backend="s3",
            )

    local_path = _local_upload_path(key)
    if not local_path.exists():
        raise FileNotFoundError(f"upload_not_found:{key}")
    return ResolvedUpload(
        upload_key=key,
        storage_path=str(local_path),
        local_path=str(local_path),
        storage_backend="local",
    )

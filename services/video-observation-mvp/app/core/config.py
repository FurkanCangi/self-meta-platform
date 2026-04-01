from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
APP_DIR = ROOT_DIR / "app"
DATA_DIR = ROOT_DIR / "data"
MODELS_DIR = DATA_DIR / "models"


def _resolve_model_path(env_key: str, default_name: str) -> str | None:
    explicit = os.getenv(env_key)
    if explicit:
        return explicit
    candidate = MODELS_DIR / default_name
    return candidate.as_posix() if candidate.exists() else None


@dataclass(frozen=True)
class Settings:
    app_name: str = "Self Meta Video Observation MVP"
    app_version: str = "0.1.0"
    protocol_version: str = "free_play_v1"
    pipeline_version: str = "video_obs_pipeline_v1"
    rules_version: str = "free_play_rules_v1"
    database_url: str = os.getenv(
        "VIDEO_OBS_DATABASE_URL",
        f"sqlite:///{(DATA_DIR / 'video_observation_mvp.db').as_posix()}",
    )
    storage_dir: Path = Path(os.getenv("VIDEO_OBS_STORAGE_DIR", (DATA_DIR / "storage").as_posix()))
    models_dir: Path = Path(os.getenv("VIDEO_OBS_MODELS_DIR", MODELS_DIR.as_posix()))
    normalized_dir: Path = Path(
        os.getenv("VIDEO_OBS_NORMALIZED_DIR", (DATA_DIR / "normalized").as_posix())
    )
    report_dir: Path = Path(os.getenv("VIDEO_OBS_REPORT_DIR", (DATA_DIR / "reports").as_posix()))
    temp_dir: Path = Path(os.getenv("VIDEO_OBS_TEMP_DIR", (DATA_DIR / "tmp").as_posix()))
    rules_path: Path = APP_DIR / "rules" / "free_play_v1.yaml"
    ffmpeg_bin: str = os.getenv("VIDEO_OBS_FFMPEG_BIN", "ffmpeg")
    ffprobe_bin: str = os.getenv("VIDEO_OBS_FFPROBE_BIN", "ffprobe")
    queue_mode: str = os.getenv("VIDEO_OBS_QUEUE_MODE", "inline")
    llm_writer_enabled: bool = os.getenv("VIDEO_OBS_ENABLE_LLM_WRITER", "false").lower() == "true"
    storage_backend: str = os.getenv("VIDEO_OBS_STORAGE_BACKEND", "local")
    storage_public_base_url: str = os.getenv("VIDEO_OBS_STORAGE_PUBLIC_BASE_URL", "")
    s3_bucket: str | None = os.getenv("VIDEO_OBS_S3_BUCKET")
    s3_region: str | None = os.getenv("VIDEO_OBS_S3_REGION")
    s3_endpoint_url: str | None = os.getenv("VIDEO_OBS_S3_ENDPOINT_URL")
    s3_access_key_id: str | None = os.getenv("VIDEO_OBS_S3_ACCESS_KEY_ID")
    s3_secret_access_key: str | None = os.getenv("VIDEO_OBS_S3_SECRET_ACCESS_KEY")
    s3_presign_expiry_sec: int = int(os.getenv("VIDEO_OBS_S3_PRESIGN_EXPIRY_SEC", "900"))
    extractor_backend: str = os.getenv("VIDEO_OBS_EXTRACTOR_BACKEND", "auto")
    mediapipe_sample_fps: float = float(os.getenv("VIDEO_OBS_MEDIAPIPE_SAMPLE_FPS", "5"))
    mediapipe_max_frames: int = int(os.getenv("VIDEO_OBS_MEDIAPIPE_MAX_FRAMES", "180"))
    mediapipe_pose_model_path: str | None = _resolve_model_path(
        "VIDEO_OBS_MEDIAPIPE_POSE_MODEL_PATH", "pose_landmarker_heavy.task"
    )
    mediapipe_face_model_path: str | None = _resolve_model_path(
        "VIDEO_OBS_MEDIAPIPE_FACE_MODEL_PATH", "face_landmarker.task"
    )


settings = Settings()


def ensure_runtime_dirs() -> None:
    for directory in (
        DATA_DIR,
        settings.storage_dir,
        settings.models_dir,
        settings.normalized_dir,
        settings.report_dir,
        settings.temp_dir,
    ):
        directory.mkdir(parents=True, exist_ok=True)

from __future__ import annotations

import argparse
import hashlib
import sys
import urllib.request
from pathlib import Path

from app.core.config import settings


MODEL_SPECS = {
    "pose": {
        "file_name": "pose_landmarker_heavy.task",
        "url": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task",
        "min_bytes": 20_000_000,
    },
    "face": {
        "file_name": "face_landmarker.task",
        "url": "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
        "min_bytes": 3_000_000,
    },
}


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _download(url: str, target: Path, force: bool) -> None:
    if target.exists() and not force:
        print(f"skip: {target.name} zaten var")
        return

    target.parent.mkdir(parents=True, exist_ok=True)
    tmp_target = target.with_suffix(target.suffix + ".download")
    if tmp_target.exists():
        tmp_target.unlink()

    print(f"indiriliyor: {url}")
    with urllib.request.urlopen(url) as response, tmp_target.open("wb") as output:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            output.write(chunk)

    tmp_target.replace(target)


def main() -> int:
    parser = argparse.ArgumentParser(description="MediaPipe task modellerini resmi kaynaktan indirir.")
    parser.add_argument("--force", action="store_true", help="var olan dosyalari yeniden indir")
    args = parser.parse_args()

    settings.models_dir.mkdir(parents=True, exist_ok=True)
    for key, spec in MODEL_SPECS.items():
        target = settings.models_dir / spec["file_name"]
        _download(spec["url"], target, args.force)
        size = target.stat().st_size
        if size < spec["min_bytes"]:
            raise RuntimeError(f"{key} model dosyasi beklenenden kucuk: {target} ({size} bytes)")
        print(f"hazir: {target} | {size} bytes | sha256={_sha256(target)[:16]}...")

    print("\nOrtam degiskeni vermeden calisacak varsayilan yol:")
    print(f"  pose: {settings.models_dir / MODEL_SPECS['pose']['file_name']}")
    print(f"  face: {settings.models_dir / MODEL_SPECS['face']['file_name']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

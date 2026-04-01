from __future__ import annotations

import json
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
IMAGE_TAG = "selfmeta-video-observation-mvp:local"
CONTAINER_NAME = "selfmeta-video-observation-mvp-smoke"
BASE_URL = "http://127.0.0.1:8091"


def _ensure_docker() -> None:
    if shutil.which("docker"):
        return
    raise RuntimeError("docker_not_found: Docker bu makinede kurulu degil veya PATH icinde bulunamadi.")


def _run(*args: str, capture: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=capture,
    )


def _wait_for_api(timeout_sec: int = 45) -> dict[str, object]:
    deadline = time.time() + timeout_sec
    last_error = ""
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"{BASE_URL}/", timeout=4) as response:
                return json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError) as exc:
            last_error = str(exc)
            time.sleep(1.5)
    raise RuntimeError(f"api_not_ready:{last_error}")


def main() -> None:
    _ensure_docker()

    _run("docker", "build", "-t", IMAGE_TAG, ".")
    _run("docker", "rm", "-f", CONTAINER_NAME)
    _run(
        "docker",
        "run",
        "-d",
        "--name",
        CONTAINER_NAME,
        "-p",
        "8091:8091",
        "-e",
        "VIDEO_OBS_EXTRACTOR_BACKEND=mediapipe",
        IMAGE_TAG,
    )

    try:
        health = _wait_for_api()
        print(json.dumps({"status": "container_ready", "health": health}, ensure_ascii=False, indent=2))
        print(
            json.dumps(
                {
                    "next_step": "Container içinde gerçek task landmark doğrulamak için örnek video ile /processing akışı çalıştır.",
                    "container_name": CONTAINER_NAME,
                    "base_url": BASE_URL,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    finally:
        _run("docker", "rm", "-f", CONTAINER_NAME)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        print(str(exc), file=sys.stderr)
        raise

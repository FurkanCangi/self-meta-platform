from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app


def test_healthcheck() -> None:
    client = TestClient(create_app())
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_local_upload_flow_returns_real_upload_target() -> None:
    client = TestClient(create_app())
    session_response = client.post(
        "/sessions",
        json={
            "child_label": "Upload Test",
            "age_months": 52,
            "consent_flags": {"video_storage": True},
        },
    )
    assert session_response.status_code == 200
    session_id = session_response.json()["session_id"]

    presign = client.post(
        f"/sessions/{session_id}/segments/presign",
        json={
            "segment_type": "solo",
            "file_name": "solo.mp4",
        },
    )
    assert presign.status_code == 200
    payload = presign.json()
    assert payload["upload_method"] == "PUT"
    assert payload["storage_backend"] == "local"
    assert "/sessions/" in payload["upload_url"]

    upload = client.put(
        payload["upload_url"],
        content=b"fake-video-payload",
        headers={"content-type": "video/mp4"},
    )
    assert upload.status_code == 200
    upload_json = upload.json()
    assert upload_json["upload_key"] == payload["upload_key"]

    complete = client.post(
        f"/sessions/{session_id}/segments/complete",
        json={
            "segment_type": "solo",
            "upload_key": payload["upload_key"],
            "duration_sec": 145,
            "signal_hints": {"engaged_play_ratio": 0.7},
        },
    )
    assert complete.status_code == 200
    assert complete.json()["status"] == "completed"


def test_can_list_recent_sessions() -> None:
    client = TestClient(create_app())

    for index in range(2):
        response = client.post(
            "/sessions",
            json={
                "child_label": f"Session {index}",
                "age_months": 48 + index,
                "consent_flags": {"video_storage": True},
            },
        )
        assert response.status_code == 200

    listed = client.get("/sessions?limit=10")
    assert listed.status_code == 200
    payload = listed.json()
    assert len(payload) >= 2
    assert payload[0]["child_label"] in {"Session 0", "Session 1"}
    assert "segment_count" in payload[0]

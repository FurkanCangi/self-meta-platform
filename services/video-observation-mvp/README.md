# Self Meta Video Observation MVP

Bu alt proje, Self Meta AI için video tabanli serbest oyun regülasyon gözlemi servisidir.

MVP ilkeleri:
- tanisal cikarim yapmaz
- LLM karar vermez
- tum skorlar aciklanabilir kanitlarla uretilir
- video kalitesi dusukse confidence dusurulur
- mevcut Self Meta olcekleri ile destekleyici füzyon yapar

## Kapsam

Servis su modullerle kuruldu:
- video ingest + ffprobe/ffmpeg normalization
- local veya S3-uyumlu gercek upload hedefi
- quality gate
- MediaPipe + fallback extractor wrapper katmani
- event segmentation
- rule-based scoring
- Self Meta fusion
- clinician-facing deterministic report
- opsiyonel future LLM writer entrypoint

## Calistirma

```bash
cd services/video-observation-mvp
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

Opsiyonel entegrasyonlar:

```bash
pip install -e ".[dev,media,storage]"
```

Ortam degiskenleri:

```bash
export VIDEO_OBS_STORAGE_BACKEND=local   # veya s3
export VIDEO_OBS_EXTRACTOR_BACKEND=auto  # auto | mediapipe | fallback
```

MediaPipe task modeli ile gercek pose/face cikarimi acmak icin:

```bash
python scripts/download_mediapipe_models.py
export VIDEO_OBS_MEDIAPIPE_POSE_MODEL_PATH=/abs/path/pose_landmarker_heavy.task
export VIDEO_OBS_MEDIAPIPE_FACE_MODEL_PATH=/abs/path/face_landmarker.task
```

S3 kullaniminda:

```bash
export VIDEO_OBS_STORAGE_BACKEND=s3
export VIDEO_OBS_S3_BUCKET=...
export VIDEO_OBS_S3_REGION=...
export VIDEO_OBS_S3_ENDPOINT_URL=...
export VIDEO_OBS_S3_ACCESS_KEY_ID=...
export VIDEO_OBS_S3_SECRET_ACCESS_KEY=...
```

Fixture ile hizli demo:

```bash
cd services/video-observation-mvp
source .venv/bin/activate
python scripts/run_fixture_demo.py
```

Gercek video smoke testi:

```bash
cd services/video-observation-mvp
source .venv/bin/activate
MPLCONFIGDIR=data/tmp/.mpl python scripts/run_real_video_smoke.py
```

Container / Linux runtime smoke:

```bash
cd services/video-observation-mvp
python scripts/run_container_smoke.py
```

Bu akış Docker image'ini build eder, API'yi container içinde ayağa kaldırır ve temel health smoke yapar. Gerçek task landmark doğrulaması için Linux/container ortamı önerilir; macOS headless lokal ortamda MediaPipe task graph GPU/GL yoluna takılırsa servis otomatik fallback extractor'a döner.

## Temel endpointler

- `POST /sessions`
- `POST /sessions/{id}/segments/presign`
- `PUT /sessions/{id}/segments/upload/{segment_type}`
- `POST /sessions/{id}/segments/complete`
- `POST /sessions/{id}/submit`
- `POST /processing/{session_id}/start`
- `GET /processing/{session_id}/status`
- `GET /sessions/{id}/summary`
- `GET /sessions/{id}/domains`
- `GET /sessions/{id}/timeline`
- `GET /sessions/{id}/evidence`
- `GET /sessions/{id}/report`
- `POST /sessions/{id}/fuse`
- `GET /sessions/{id}/fusion`
- `POST /sessions/{id}/override`
- `POST /sessions/{id}/approve`
- `POST /sessions/{id}/recompute`
- `GET /admin/quality-metrics`
- `GET /admin/override-metrics`
- `GET /admin/protocol-compliance`

## Upload akisi

1. `POST /sessions/{id}/segments/presign`
2. `PUT /sessions/{id}/segments/upload/{segment_type}` ile binary video gonder
3. `POST /sessions/{id}/segments/complete`
4. `POST /processing/{id}/start`

`local` backendte upload URL servisin kendi endpoint'idir. `s3` backendte gercek presigned PUT URL doner.

## Extractor notu

`VIDEO_OBS_EXTRACTOR_BACKEND=auto` durumunda servis once MediaPipe task tabanli `PoseLandmarker + FaceLandmarker` extractorunu dener. Task modelleri kesfedilir ama ortam GPU/GL servisi saglamiyorsa servis bunu provenance icinde isaretleyip `opencv_face_motion_fallback` yoluna otomatik doner. Bu fallback yine gercek videodan sinyal cikarir; ancak tam landmark ciktilari yerine yuz merkezi + hareket centroidi ustunden explainable kanit uretir. Smoke ciktisindaki `runtime_labels` alani hangi yolun kullanildigini gosterir.

Linux/container calismasinda hedeflenen yol `mediapipe_tasks_pose_face_landmarker` runtime'idir. Bu yol aktif oldugunda extractor provenance'i hem pose hem face task model path'lerini ve MediaPipe runtime etiketini tasir.

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    VIDEO_OBS_STORAGE_BACKEND=local \
    VIDEO_OBS_EXTRACTOR_BACKEND=mediapipe \
    MPLCONFIGDIR=/app/data/tmp/.mpl

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg \
        libegl1 \
        libglib2.0-0 \
        libgl1 \
        libgomp1 \
        libsm6 \
        libxext6 \
        libxrender1 \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md ./
COPY app ./app
COPY scripts ./scripts
COPY fixtures ./fixtures
COPY tests ./tests
COPY data ./data

RUN python -m pip install --upgrade pip setuptools wheel \
    && python -m pip install -e ".[media,storage]"

RUN mkdir -p data/storage data/normalized data/reports data/tmp

EXPOSE 8091

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8091"]

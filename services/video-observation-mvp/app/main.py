from __future__ import annotations

from fastapi import FastAPI

from app.api.routes import router
from app.core.config import ensure_runtime_dirs, settings
from app.core.database import Base, engine


def create_app() -> FastAPI:
    ensure_runtime_dirs()
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="Self Meta serbest oyun video gozlemi icin explainable backend MVP.",
    )
    Base.metadata.create_all(bind=engine)
    app.include_router(router)
    return app


app = create_app()

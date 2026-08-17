"""Celery application - Sprint 8."""
from __future__ import annotations

from celery import Celery

from app.config import settings

celery_app = Celery(
    "arclight",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.workers.generate_document"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    result_expires=3600,
    task_track_started=True,
)
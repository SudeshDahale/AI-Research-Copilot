from fastapi import APIRouter

from app.api.v1 import auth, search, workspaces, papers

api_router = APIRouter()


@api_router.get("/healthz", tags=["health"])
async def healthz() -> dict[str, str]:
    """Liveness check — used by Docker/Compose and the frontend dev proxy."""
    return {"status": "ok"}


api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(search.router, prefix="/search", tags=["search"])
api_router.include_router(workspaces.router, prefix="/workspaces", tags=["workspaces"])
api_router.include_router(papers.router, prefix="/papers", tags=["papers"])
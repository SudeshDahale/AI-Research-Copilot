from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration, loaded from environment variables / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- App ---
    app_name: str = "Arclight"
    environment: str = "development"
    debug: bool = True

    # --- Database ---
    database_url: str = "postgresql+asyncpg://arclight:arclight@localhost:5432/arclight"

    # --- Redis / Celery ---
    redis_url: str = "redis://localhost:6379/0"

    # --- Auth (wired up in Sprint 1) ---
    jwt_secret: str = "change-me-to-a-random-secret"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24

    # --- LLM (Sprint 5 / Groq) ---
    groq_api_key: str = ""
    llm_api_key: str = ""
    llm_model: str = "openai/gpt-oss-120b"

    # --- Embeddings (Sprint 6) ---
    voyage_api_key: str = ""
    embedding_model: str = "voyage-3.5-lite"
    embedding_dim: int = 512

    # --- CORS ---
    cors_origins: str = "http://localhost:5173,http://localhost:8080"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance — env vars are parsed once per process."""
    return Settings()


settings = get_settings()
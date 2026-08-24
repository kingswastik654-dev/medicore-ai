from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MEDCORE_", env_file=".env", extra="ignore")

    project_name: str = "MediCore AI"
    version: str = "0.1.0"
    api_v1_prefix: str = "/api"
    database_url: str = "sqlite:///./medcore.db"
    secret_key: str = "dev-secret-change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 720
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    auto_seed: bool = True

    ai_provider: str = "heuristic"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_base_url: str = "https://api.openai.com/v1"


@lru_cache
def get_settings() -> Settings:
    return Settings()

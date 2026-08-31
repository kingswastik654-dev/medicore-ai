from functools import lru_cache
import warnings

from pydantic import field_validator
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
    whatsapp_api_url: str = ""
    whatsapp_token: str = ""

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors_origins(cls, v):
        # Accept a comma-separated string so production can use:
        #   MEDCORE_CORS_ORIGINS=https://app.example.com,https://admin.example.com
        if isinstance(v, str):
            return [s.strip() for s in v.split(",") if s.strip()]
        return v

    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        if self.secret_key == "dev-secret-change-me-in-production":
            warnings.warn(
                "MEDCORE_SECRET_KEY is using the insecure default — set a strong random "
                "secret before deploying to production (e.g. `python -c \"import secrets; print(secrets.token_urlsafe(48))\"`).",
                stacklevel=1,
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()

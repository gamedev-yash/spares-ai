from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Central application configuration, sourced from environment variables / .env.

    Nothing in here should ever hold a real secret default -- see .env.example.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- App ---
    app_name: str = "Spares AI Backend"
    environment: Literal["development", "test", "production"] = "development"
    api_v1_prefix: str = "/api"
    cors_origins: list[str] = ["http://localhost:3000"]

    # --- Data (CSV files are the source of truth -- see app/services/csv_store.py) ---
    data_dir: Path = BACKEND_ROOT / "data"

    # --- Synthetic data ---
    synthetic_data_seed: int = 12345

    # --- AI ---
    ai_mode: Literal["demo", "provider"] = "demo"
    ai_provider: Literal["anthropic", "openai"] = "anthropic"
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-sonnet-4-5"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"


@lru_cache
def get_settings() -> Settings:
    return Settings()

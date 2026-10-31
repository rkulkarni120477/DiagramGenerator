from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration. Every value can be overridden with an environment variable of the same name."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    bedrock_model_id: str = ""
    aws_region: str = "us-east-1"
    aws_bearer_token_bedrock: str | None = None
    database_url: str = "sqlite:///./data/diagram_studio.db"
    llm_timeout_seconds: float = 90.0
    llm_max_tokens: int = 8192
    # Leave unset for models that reject the parameter (for example, Claude Sonnet 5.5).
    llm_temperature: float | None = None
    max_prompt_chars: int = 8000
    max_clarification_rounds: int = 3
    max_json_retries: int = 1
    max_repair_attempts: int = 1
    cors_origins: list[str] = ["http://localhost:3000"]
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()

from pydantic import Field, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./app.db"
    openai_api_key: str | None = None
    openai_model: str = "gpt-5.1"
    # Output token budget. Too low can cause truncated/incomplete generations (and some providers/models will
    # surface that as a 400 error). Can be overridden via `OPENAI_MAX_OUTPUT_TOKENS`.
    openai_max_output_tokens: int = 900
    # If the provider responds with a "max_tokens/output limit reached" style error, retry once with this value.
    openai_max_output_tokens_retry: int = 1400
    # Defensive bounds for chat history sent by clients (avoids blowing up token/context budgets).
    openai_max_history_turns: int = 20
    openai_max_history_chars: int = 12000
    openai_max_turn_chars: int = 2000
    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    jwt_secret_key: str = Field(default="change-me")
    jwt_algorithm: str = "HS256"
    jwt_exp_minutes: int = 60 * 24

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def strip_origins(cls, value: str) -> str:
        return value.strip()

    @computed_field
    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


settings = Settings()

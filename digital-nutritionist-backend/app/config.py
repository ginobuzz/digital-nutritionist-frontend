import os
from urllib.parse import urlparse

from pydantic import Field, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Set to "beta"/"staging"/"production" on hosted deployments.
    app_env: str = "development"
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
    jwt_exp_minutes: int = 60 * 24 * 30
    frontend_base_url: str = "http://localhost:3000"
    password_reset_secret_key: str = Field(default="change-me-password-reset")
    password_reset_exp_minutes: int = 30

    # Abuse/cost guardrails
    auth_rate_limit_requests: int = 20
    auth_rate_limit_window_seconds: int = 60
    chat_rate_limit_requests: int = 12
    chat_rate_limit_window_seconds: int = 60
    auth_max_payload_bytes: int = 32_768
    chat_max_payload_bytes: int = 4_194_304
    chat_max_message_chars: int = 4_000
    chat_max_history_turns_payload: int = 40
    chat_max_history_turn_chars_payload: int = 4_000
    chat_max_image_data_url_chars: int = 4_000_000

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


_HOSTED_ENVS = {"production", "prod", "staging", "stage", "beta"}
_RENDER_ENV_VARS = ("RENDER", "RENDER_SERVICE_ID", "RENDER_EXTERNAL_URL")


def is_hosted_env() -> bool:
    env = (settings.app_env or "").strip().lower()
    if env in _HOSTED_ENVS:
        return True
    return any(bool(os.getenv(name)) for name in _RENDER_ENV_VARS)


def _is_placeholder_secret(value: str) -> bool:
    normalized = (value or "").strip().lower()
    return normalized in {"change-me", "dev-secret-change-me"}


def jwt_secret_key_is_configured() -> bool:
    raw = (settings.jwt_secret_key or "").strip()
    if not raw:
        return False
    if _is_placeholder_secret(raw):
        return False
    return len(raw) >= 32


def _looks_like_origin(value: str) -> bool:
    try:
        parsed = urlparse(value)
    except ValueError:
        return False
    if parsed.scheme not in {"http", "https"}:
        return False
    if not parsed.netloc:
        return False
    # Origins must not include a path/query/fragment.
    if parsed.path not in {"", "/"}:
        return False
    if parsed.query or parsed.fragment:
        return False
    return True


def validate_hosted_settings() -> None:
    """
    Fail fast on hosted deployments if required env vars are missing or unsafe.
    Local development keeps permissive defaults.
    """
    if not is_hosted_env():
        return

    problems: list[str] = []

    if not settings.database_url:
        problems.append("DATABASE_URL is not set")

    if not settings.openai_api_key:
        problems.append("OPENAI_API_KEY is not set")

    if not (settings.openai_model or "").strip():
        problems.append("OPENAI_MODEL is not set")

    if not (settings.jwt_secret_key or "").strip():
        problems.append("JWT_SECRET_KEY is not set")
    elif _is_placeholder_secret(settings.jwt_secret_key):
        problems.append("JWT_SECRET_KEY is still set to a placeholder value")
    elif not jwt_secret_key_is_configured():
        problems.append("JWT_SECRET_KEY must be at least 32 characters")

    if not settings.allowed_origins_list:
        problems.append("ALLOWED_ORIGINS is not set")
    else:
        invalid = [origin for origin in settings.allowed_origins_list if not _looks_like_origin(origin)]
        if invalid:
            problems.append(f"ALLOWED_ORIGINS contains invalid origin(s): {', '.join(invalid)}")
        non_local = [
            origin
            for origin in settings.allowed_origins_list
            if all(host not in origin for host in ("localhost", "127.0.0.1", "::1"))
        ]
        if not non_local:
            problems.append("ALLOWED_ORIGINS must include at least one non-localhost origin on hosted deployments")

    if problems:
        details = "\n".join(f"- {problem}" for problem in problems)
        raise RuntimeError(f"Invalid hosted environment configuration:\n{details}")

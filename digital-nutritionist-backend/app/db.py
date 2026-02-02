from collections.abc import Iterator
import os

from sqlalchemy import inspect, text
from sqlalchemy.engine.url import URL, make_url
from sqlalchemy.pool import NullPool
from sqlmodel import Session, SQLModel, create_engine

from .config import settings


def _normalize_database_url(raw_url: str) -> URL:
    """
    Render/Neon/Supabase often provide `postgres://` or `postgresql://` URLs.
    SQLAlchemy 2 + psycopg v3 expects `postgresql+psycopg://`.
    """
    url = make_url(raw_url)
    if url.drivername in {"postgres", "postgresql"}:
        url = url.set(drivername="postgresql+psycopg")
    return url


database_url = _normalize_database_url(settings.database_url)

def _is_hosted_env() -> bool:
    env = (settings.app_env or "").strip().lower()
    if env in {"production", "prod", "staging", "stage", "beta"}:
        return True
    # Render sets one or more of these on hosted services.
    return bool(os.getenv("RENDER") or os.getenv("RENDER_SERVICE_ID") or os.getenv("RENDER_EXTERNAL_URL"))


if _is_hosted_env() and database_url.drivername.startswith("sqlite"):
    raise RuntimeError(
        "Refusing to start with SQLite in a hosted environment. "
        "Set DATABASE_URL to a persistent Postgres instance (e.g., Neon)."
    )

engine_kwargs: dict[str, object] = {"echo": False, "pool_pre_ping": True}
if database_url.drivername.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
elif "pooler" in (database_url.host or ""):
    # Neon "pooler" hosts (PgBouncer) can break server-side prepared statements and
    # don't benefit from SQLAlchemy's own connection pool.
    engine_kwargs["poolclass"] = NullPool
    # psycopg v3 uses server-side prepared statements; disable them for PgBouncer.
    # psycopg passes unknown kwargs as libpq conn params, so only use supported ones.
    engine_kwargs["connect_args"] = {"prepare_threshold": 0}

engine = create_engine(database_url, **engine_kwargs)

def _ensure_meal_log_macro_columns() -> None:
    try:
        inspector = inspect(engine)
        if not inspector.has_table("meal_logs"):
            return
        existing = {col.get("name") for col in inspector.get_columns("meal_logs")}
    except Exception:
        return

    ddls: dict[str, str] = {
        "protein_g": "protein_g FLOAT",
        "carbs_g": "carbs_g FLOAT",
        "fat_g": "fat_g FLOAT",
    }

    missing_ddls = [ddl for name, ddl in ddls.items() if name not in existing]
    if not missing_ddls:
        return

    with engine.begin() as conn:
        for ddl in missing_ddls:
            conn.execute(text(f"ALTER TABLE meal_logs ADD COLUMN {ddl}"))


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    _ensure_meal_log_macro_columns()


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session

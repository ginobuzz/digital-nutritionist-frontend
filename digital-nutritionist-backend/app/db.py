from collections.abc import Iterator

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


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session

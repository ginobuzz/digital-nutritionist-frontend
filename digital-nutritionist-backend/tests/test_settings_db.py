from app.config import Settings
from app.db import _normalize_database_url


def test_allowed_origins_list_strips_and_filters():
    settings = Settings(allowed_origins=" http://a.com, ,http://b.com  ")
    assert settings.allowed_origins_list == ["http://a.com", "http://b.com"]


def test_normalize_database_url_postgres():
    url = _normalize_database_url("postgres://user:pass@host/db")
    assert url.drivername == "postgresql+psycopg"


def test_normalize_database_url_sqlite_is_unchanged():
    url = _normalize_database_url("sqlite:///./app.db")
    assert url.drivername.startswith("sqlite")


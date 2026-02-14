from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app import db, main
from app.abuse_guards import rate_limiter


@pytest.fixture()
def engine(monkeypatch: pytest.MonkeyPatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)

    monkeypatch.setattr(db, "engine", engine, raising=True)
    monkeypatch.setattr(main, "engine", engine, raising=True)

    yield engine
    engine.dispose()


@pytest.fixture()
def session(engine):
    with Session(engine) as session:
        yield session


@pytest.fixture()
def client(session):
    def get_session_override():
        yield session

    main.app.dependency_overrides[db.get_session] = get_session_override
    try:
        with TestClient(main.app) as client:
            yield client
    finally:
        main.app.dependency_overrides.clear()



@pytest.fixture(autouse=True)
def clear_rate_limiter():
    rate_limiter.clear()
    yield
    rate_limiter.clear()

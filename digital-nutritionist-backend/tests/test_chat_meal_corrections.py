from __future__ import annotations

import json
from datetime import date
from types import SimpleNamespace

from sqlmodel import select

from app.models import MealLog
from app.services import chat as chat_service


def _create_user(client, email: str = "correction@example.com") -> str:
    res = client.post(
        "/auth/signup",
        json={
            "email": email,
            "password": "pw-123",
            "first_name": "Meal",
            "last_name": "Correction",
        },
    )
    assert res.status_code == 201, res.text
    return res.json()["user"]["id"]


def _make_tool_call(*, call_id: str, name: str, args: dict) -> SimpleNamespace:
    function = SimpleNamespace(name=name, arguments=json.dumps(args))
    return SimpleNamespace(type="function", id=call_id, function=function)


def test_chat_correction_replaces_latest_meal_log(monkeypatch, client, session):
    user_id = _create_user(client)
    initial = MealLog(
        user_id=user_id,
        date=date.fromisoformat("2026-01-18"),
        meal_type="snack",
        user_description="Tomato soup",
        estimated_calories=200,
    )
    session.add(initial)
    session.commit()
    session.refresh(initial)

    first = SimpleNamespace(
        model="test",
        usage=None,
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(
                    role="assistant",
                    content=None,
                    tool_calls=[
                        _make_tool_call(
                            call_id="call-1",
                            name=chat_service.MEAL_LOG_TOOL_NAME,
                            args={
                                "date": "2026-01-18",
                                "meal_type": "snack",
                                "user_description": "Chicken noodle soup (replacing previously logged tomato soup)",
                                "estimated_calories": 250,
                            },
                        )
                    ],
                )
            )
        ],
    )
    final = SimpleNamespace(
        model="test",
        usage=None,
        choices=[SimpleNamespace(message=SimpleNamespace(role="assistant", content="ok"))],
    )

    responses = [first, final]

    monkeypatch.setattr(chat_service, "get_openai_client", lambda: SimpleNamespace(), raising=True)
    monkeypatch.setattr(chat_service, "_openai_chat_create", lambda *a, **k: responses.pop(0), raising=True)

    result = chat_service.assistant_chat(
        "wait no it was chicken noodle soup",
        session=session,
        user_id=user_id,
        client_local_date=None,
        history=None,
    )

    assert result["created_meal_logs"][0].id == initial.id
    assert result["created_meal_logs"][0].user_description == "Chicken noodle soup"

    logs = session.exec(select(MealLog).where(MealLog.user_id == user_id)).all()
    assert len(logs) == 1
    assert logs[0].id == initial.id
    assert logs[0].user_description == "Chicken noodle soup"


def test_chat_non_correction_appends_meal_log(monkeypatch, client, session):
    user_id = _create_user(client, email="append@example.com")
    initial = MealLog(
        user_id=user_id,
        date=date.fromisoformat("2026-01-18"),
        meal_type="snack",
        user_description="Tomato soup",
        estimated_calories=200,
    )
    session.add(initial)
    session.commit()

    first = SimpleNamespace(
        model="test",
        usage=None,
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(
                    role="assistant",
                    content=None,
                    tool_calls=[
                        _make_tool_call(
                            call_id="call-1",
                            name=chat_service.MEAL_LOG_TOOL_NAME,
                            args={
                                "date": "2026-01-18",
                                "meal_type": "snack",
                                "user_description": "Chicken noodle soup",
                                "estimated_calories": 250,
                            },
                        )
                    ],
                )
            )
        ],
    )
    final = SimpleNamespace(
        model="test",
        usage=None,
        choices=[SimpleNamespace(message=SimpleNamespace(role="assistant", content="ok"))],
    )

    responses = [first, final]

    monkeypatch.setattr(chat_service, "get_openai_client", lambda: SimpleNamespace(), raising=True)
    monkeypatch.setattr(chat_service, "_openai_chat_create", lambda *a, **k: responses.pop(0), raising=True)

    chat_service.assistant_chat(
        "I had chicken noodle soup",
        session=session,
        user_id=user_id,
        client_local_date=None,
        history=None,
    )

    logs = session.exec(select(MealLog).where(MealLog.user_id == user_id)).all()
    assert len(logs) == 2

from __future__ import annotations

import json
from datetime import date
from types import SimpleNamespace

from app.models import MealLog
from app.services import chat as chat_service


def _create_user(client, email: str = "lookup@example.com") -> str:
    res = client.post(
        "/users/",
        json={
            "email": email,
            "password": "pw-123",
            "first_name": "Meal",
            "last_name": "Lookup",
        },
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


def _make_tool_call(*, call_id: str, name: str, args: dict) -> SimpleNamespace:
    function = SimpleNamespace(name=name, arguments=json.dumps(args))
    return SimpleNamespace(type="function", id=call_id, function=function)


def test_chat_can_lookup_todays_breakfast_from_db(monkeypatch, client, session):
    user_id = _create_user(client)
    session.add(
        MealLog(
            user_id=user_id,
            date=date.fromisoformat("2026-01-18"),
            meal_type="breakfast",
            user_description="Oatmeal with berries",
            estimated_calories=350,
            protein_g=15,
            carbs_g=55,
            fat_g=8,
        )
    )
    session.add(
        MealLog(
            user_id=user_id,
            date=date.fromisoformat("2026-01-15"),
            meal_type="breakfast",
            user_description="Pancakes",
            estimated_calories=600,
        )
    )
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
                            name=chat_service.MEAL_LOOKUP_TOOL_NAME,
                            args={"date": "today", "meal_type": "breakfast"},
                        )
                    ],
                )
            )
        ],
    )

    def fake_openai_chat_create(*_args, **kwargs):
        messages = kwargs["messages"]
        # First invocation: ask to call the lookup tool.
        if not any(m.get("role") == "tool" for m in messages):
            return first

        # Second invocation: ensure the tool response contains today's breakfast (not older entries).
        tool_messages = [m for m in messages if m.get("role") == "tool"]
        assert tool_messages, "Expected tool response message"
        payload = json.loads(tool_messages[-1]["content"])
        assert payload["ok"] is True
        assert payload["date"] == "2026-01-18"
        assert payload["meal_type"] == "breakfast"
        assert payload["count"] == 1
        assert payload["meal_logs"][0]["user_description"] == "Oatmeal with berries"

        return SimpleNamespace(
            model="test",
            usage=None,
            choices=[SimpleNamespace(message=SimpleNamespace(role="assistant", content="Breakfast loaded."))],
        )

    monkeypatch.setattr(chat_service, "get_openai_client", lambda: SimpleNamespace(), raising=True)
    monkeypatch.setattr(chat_service, "_openai_chat_create", fake_openai_chat_create, raising=True)

    result = chat_service.assistant_chat(
        "What was my breakfast today?",
        session=session,
        user_id=user_id,
        client_local_date=date.fromisoformat("2026-01-18"),
        history=None,
    )

    assert result["reply"] == "Breakfast loaded."
    assert result["created_meal_logs"] == []
    assert result["created_planned_meals"] == []

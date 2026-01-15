from __future__ import annotations

from datetime import date, datetime

from app.services import chat as chat_service


def test_token_limit_kwargs_switches_for_gpt5_models():
    assert chat_service._token_limit_kwargs("gpt-5.1", 123) == {"max_completion_tokens": 123}
    assert chat_service._token_limit_kwargs("gpt-4o-mini", 123) == {"max_tokens": 123}


def test_parse_tool_args_is_defensive():
    assert chat_service._parse_tool_args(None) == {}
    assert chat_service._parse_tool_args("{not json}") == {}
    assert chat_service._parse_tool_args('["not an object"]') == {}
    assert chat_service._parse_tool_args('{"a": 1}') == {"a": 1}


def test_coerce_calories_clamps_and_handles_invalid():
    assert chat_service._coerce_calories("100") == 100
    assert chat_service._coerce_calories(-5) == 0
    assert chat_service._coerce_calories(99999) == 5000
    assert chat_service._coerce_calories("nope") is None


def test_coerce_datetime_accepts_hhmm_and_iso():
    meal_date = date(2025, 1, 1)
    assert chat_service._coerce_datetime("08:30", meal_date=meal_date, meal_type="breakfast") == datetime(2025, 1, 1, 8, 30)
    assert chat_service._coerce_datetime("2025-01-01T12:00:00Z", meal_date=meal_date, meal_type="lunch") == datetime(2025, 1, 1, 12, 0)


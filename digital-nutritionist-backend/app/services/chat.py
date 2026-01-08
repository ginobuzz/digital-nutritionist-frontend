from __future__ import annotations

import json
import re
from datetime import date, datetime, timedelta
from typing import Any

from sqlmodel import Session

from fastapi import HTTPException, status
from openai import OpenAI

from ..config import settings
from ..models import MealLog, MealLogRead, PlannedMeal, PlannedMealRead

SYSTEM_PROMPT = (
    "You are a supportive digital nutritionist.\n"
    "\n"
    "This app supports BOTH logging meals already eaten and planning meals for the future.\n"
    "\n"
    "If the user describes food or drink they *consumed* (e.g., “I had…”, “I ate…”, “for lunch…”), "
    "log it by calling the `create_meal_log` tool.\n"
    "- Use the user's local 'today' date unless the user specifies a different date.\n"
    "- Set `meal_type` to one of: breakfast, lunch, dinner, snack (or omit if unknown).\n"
    "- `user_description` should be a concise description of what they consumed.\n"
    "- `estimated_calories` should be an integer; if the user gives calories, use them; otherwise broadly estimate.\n"
    "- If the message is too ambiguous to log (no food/drink details), ask a clarifying question instead of logging.\n"
    "\n"
    "If the user is planning a meal (especially for a future date/time) and provides enough detail, "
    "create a planned meal by calling the `create_planned_meal` tool.\n"
    "- Planning meals in the future is valid and encouraged; do not refuse just because a date is in the future.\n"
    "- If the user says “today/tomorrow”, interpret it relative to the user's local 'today' date.\n"
    "- Use the date the user specifies; otherwise use the user's local 'today' date.\n"
    "- Pick a reasonable time if none is given.\n"
    "\n"
    "If the user is asking for advice or planning guidance without wanting anything saved, do not call any tool.\n"
    "If the user requests a strict output format (e.g. “Return ONLY JSON”), obey it and do not call any tool.\n"
    "After logging, confirm what you logged and the calorie estimate, then give brief, supportive guidance."
)

MEAL_LOG_TOOL_NAME = "create_meal_log"
MEAL_LOG_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": MEAL_LOG_TOOL_NAME,
        "description": "Create a meal log entry for the current user.",
        "parameters": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "date": {
                    "type": "string",
                    "description": "Date of the meal in ISO format (YYYY-MM-DD). Use today's date if not specified.",
                },
                "meal_type": {
                    "type": ["string", "null"],
                    "description": "One of breakfast, lunch, dinner, snack, or null if unknown.",
                },
                "user_description": {
                    "type": "string",
                    "description": "Concise description of what the user consumed.",
                },
                "estimated_calories": {
                    "type": "integer",
                    "description": "Estimated calories for this meal (integer).",
                },
            },
            "required": ["date", "user_description", "estimated_calories"],
        },
    },
}

PLANNED_MEAL_TOOL_NAME = "create_planned_meal"
PLANNED_MEAL_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": PLANNED_MEAL_TOOL_NAME,
        "description": "Create a planned meal entry for the current user (including future meals).",
        "parameters": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "date": {
                    "type": "string",
                    "description": "Date of the planned meal in ISO format (YYYY-MM-DD). Use today's date if not specified.",
                },
                "meal_type": {
                    "type": "string",
                    "description": "One of breakfast, lunch, dinner, snack.",
                },
                "name": {
                    "type": "string",
                    "description": "Short name for the planned meal (e.g., 'Chicken salad bowl').",
                },
                "calories": {
                    "type": "integer",
                    "description": "Estimated calories for this planned meal (integer).",
                },
                "time": {
                    "type": "string",
                    "description": "Time for the planned meal. Prefer ISO datetime; HH:MM (24h) is also acceptable.",
                },
                "description": {
                    "type": ["string", "null"],
                    "description": "Optional extra details/ingredients (or null).",
                },
            },
            "required": ["date", "meal_type", "name", "calories", "time"],
        },
    },
}

def _token_limit_kwargs(model: str, value: int) -> dict[str, Any]:
    # Some newer models (e.g. gpt-5.*) use `max_completion_tokens` instead of `max_tokens`.
    if model.startswith("gpt-5"):
        return {"max_completion_tokens": value}
    return {"max_tokens": value}


def get_openai_client() -> OpenAI:
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OPENAI_API_KEY is not configured.",
        )
    return OpenAI(api_key=settings.openai_api_key)


def _message_to_openai_dict(message: Any) -> dict[str, Any]:
    try:
        return message.model_dump(exclude_none=True)
    except AttributeError:
        pass
    # Minimal fallback
    payload: dict[str, Any] = {"role": getattr(message, "role", "assistant"), "content": getattr(message, "content", "")}
    tool_calls = getattr(message, "tool_calls", None)
    if tool_calls:
        payload["tool_calls"] = tool_calls
    return payload


def _parse_tool_args(arguments: str | None) -> dict[str, Any]:
    if not arguments:
        return {}
    try:
        value = json.loads(arguments)
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


def _normalize_meal_type(value: Any) -> str | None:
    if not value:
        return None
    if not isinstance(value, str):
        return None
    normalized = value.strip().lower()
    allowed = {"breakfast", "lunch", "dinner", "snack"}
    return normalized if normalized in allowed else None


def _coerce_date(value: Any, *, default: date | None = None) -> date:
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value.strip())
        except ValueError:
            pass
    return default or date.today()


def _coerce_calories(value: Any) -> int | None:
    try:
        calories_int = int(value)
    except (TypeError, ValueError):
        return None
    # Very broad sanity bounds; keep model mistakes from polluting the DB.
    if calories_int < 0:
        return 0
    if calories_int > 5000:
        return 5000
    return calories_int


def _coerce_description(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    # Avoid extremely long blobs (e.g., full conversation)
    return text[:500]

def _default_time_for_meal_type(meal_type: str | None) -> str:
    match (meal_type or "").strip().lower():
        case "breakfast":
            return "08:00"
        case "lunch":
            return "12:00"
        case "dinner":
            return "18:00"
        case "snack":
            return "15:00"
        case _:
            return "12:00"


def _coerce_datetime(value: Any, *, meal_date: date, meal_type: str | None) -> datetime:
    if isinstance(value, datetime):
        return value.replace(tzinfo=None) if value.tzinfo else value
    if isinstance(value, str):
        raw = value.strip()
        if raw:
            # Accept simple HH:MM (24h) and combine with the provided date.
            if len(raw) == 5 and raw[2] == ":" and raw.replace(":", "").isdigit():
                hours = int(raw[0:2])
                minutes = int(raw[3:5])
                if 0 <= hours <= 23 and 0 <= minutes <= 59:
                    return datetime(meal_date.year, meal_date.month, meal_date.day, hours, minutes)

            # ISO datetime (accept trailing Z)
            normalized = raw[:-1] + "+00:00" if raw.endswith("Z") else raw
            try:
                parsed = datetime.fromisoformat(normalized)
                return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
            except ValueError:
                pass

    fallback = _default_time_for_meal_type(meal_type)
    hours = int(fallback[0:2])
    minutes = int(fallback[3:5])
    return datetime(meal_date.year, meal_date.month, meal_date.day, hours, minutes)


def _coerce_planned_meal_name(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    return text[:120]


def _coerce_planned_meal_type(value: Any) -> str | None:
    return _normalize_meal_type(value)


def _create_meal_log_from_args(session: Session, user_id: str, args: dict[str, Any]) -> MealLog | None:
    description = _coerce_description(args.get("user_description"))
    calories = _coerce_calories(args.get("estimated_calories"))
    if not description or calories is None:
        return None

    log = MealLog(
        user_id=user_id,
        date=_coerce_date(args.get("date")),
        meal_type=_normalize_meal_type(args.get("meal_type")),
        user_description=description,
        estimated_calories=calories,
    )
    session.add(log)
    return log


def _create_planned_meal_from_args(
    session: Session, user_id: str, args: dict[str, Any], *, default_date: date | None = None
) -> PlannedMeal | None:
    meal_date = _coerce_date(args.get("date"), default=default_date)
    meal_type = _coerce_planned_meal_type(args.get("meal_type"))
    name = _coerce_planned_meal_name(args.get("name"))
    calories = _coerce_calories(args.get("calories"))
    if calories is None:
        calories = _coerce_calories(args.get("estimated_calories"))
    if not meal_type or not name or calories is None:
        return None

    planned_time = _coerce_datetime(args.get("time"), meal_date=meal_date, meal_type=meal_type)
    description = _coerce_description(args.get("description"))

    meal = PlannedMeal(
        user_id=user_id,
        date=meal_date,
        name=name,
        calories=calories,
        meal_type=meal_type,
        time=planned_time,
        description=description,
    )
    session.add(meal)
    return meal


def chat_completion(message: str, user_context: dict[str, Any] | None = None) -> dict[str, Any]:
    client = get_openai_client()
    messages = [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": message}]
    if user_context:
        messages.insert(
            1,
            {
                "role": "system",
                "content": f"User profile: {user_context}",
            },
        )

    response = client.chat.completions.create(
        model=settings.openai_model,
        messages=messages,
        temperature=0.2,
        **_token_limit_kwargs(settings.openai_model, 300),
    )

    choice = response.choices[0].message
    return {
        "reply": choice.content,
        "model": response.model,
        "usage": response.usage.model_dump() if response.usage else None,
    }


def assistant_chat(
    message: str,
    *,
    user_context: dict[str, Any] | None = None,
    session: Session | None = None,
    user_id: str | None = None,
    history: list[dict[str, Any]] | None = None,
    client_local_date: date | None = None,
    client_time_zone: str | None = None,
) -> dict[str, Any]:
    client = get_openai_client()

    messages: list[dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    if user_context:
        messages.append({"role": "system", "content": f"User profile: {user_context}"})
    if client_local_date or client_time_zone:
        today_local = (client_local_date or date.today()).isoformat()
        tz_label = client_time_zone or "unknown"
        messages.append(
            {
                "role": "system",
                "content": (
                    f"User local date is {today_local} (treat this as 'today'); "
                    f"user time zone is {tz_label}."
                ),
            }
        )

    if history:
        for turn in history:
            role = turn.get("role")
            content = turn.get("content")
            if role in {"user", "assistant"} and isinstance(content, str) and content.strip():
                messages.append({"role": role, "content": content.strip()})

    messages.append({"role": "user", "content": message})

    enable_meal_logging = session is not None and bool(user_id)
    lower_message = message.lower()
    has_explicit_iso_date = bool(re.search(r"\b\d{4}-\d{2}-\d{2}\b", message))
    force_no_tools = ("return only" in lower_message) and ("json" in lower_message)
    tools = [MEAL_LOG_TOOL, PLANNED_MEAL_TOOL] if (enable_meal_logging and not force_no_tools) else None

    try:
        create_kwargs: dict[str, Any] = {
            "model": settings.openai_model,
            "messages": messages,
            "temperature": 0.2,
            **_token_limit_kwargs(settings.openai_model, 350),
        }
        if tools:
            create_kwargs["tools"] = tools
            create_kwargs["tool_choice"] = "auto"
        first = client.chat.completions.create(**create_kwargs)
    except Exception as exc:  # noqa: BLE001 - surface as HTTPException for API callers
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"LLM request failed: {exc}")

    first_message = first.choices[0].message
    tool_calls = getattr(first_message, "tool_calls", None) if enable_meal_logging else None
    if not tool_calls:
        return {
            "reply": first_message.content,
            "model": first.model,
            "usage": first.usage.model_dump() if first.usage else None,
            "created_meal_logs": [],
            "created_planned_meals": [],
        }

    # Tool calling round: execute meal log creations, then ask the model to respond to the user.
    messages.append(_message_to_openai_dict(first_message))

    default_date = client_local_date
    created_db_logs: list[MealLog] = []
    created_db_planned_meals: list[PlannedMeal] = []
    for call in tool_calls:
        if getattr(call, "type", None) != "function":
            continue
        function = getattr(call, "function", None)
        if not function:
            continue

        args = _parse_tool_args(getattr(function, "arguments", None))
        tool_name = getattr(function, "name", None)
        tool_content: str

        if tool_name == MEAL_LOG_TOOL_NAME:
            # If the model omits/garbles the date, fall back to the user's local date (not the server's).
            args_with_default = dict(args)
            if default_date and not args_with_default.get("date"):
                inferred = default_date + timedelta(days=1) if ("tomorrow" in lower_message) else default_date
                args_with_default["date"] = inferred.isoformat()
            # If the user used a relative date (today/tomorrow) and the model is offset (often UTC vs local),
            # correct it unless the user explicitly provided an ISO date in the message.
            if default_date and not has_explicit_iso_date and isinstance(args_with_default.get("date"), str):
                try:
                    model_date = date.fromisoformat(args_with_default["date"])
                    if "today" in lower_message and model_date == default_date + timedelta(days=1):
                        args_with_default["date"] = default_date.isoformat()
                    if "tomorrow" in lower_message and model_date == default_date + timedelta(days=2):
                        args_with_default["date"] = (default_date + timedelta(days=1)).isoformat()
                except ValueError:
                    pass
            log = _create_meal_log_from_args(session, user_id or "", args_with_default) if session and user_id else None
            if log:
                created_db_logs.append(log)
                tool_content = json.dumps(
                    {
                        "ok": True,
                        "meal_log_id": log.id,
                        "date": log.date.isoformat(),
                        "meal_type": log.meal_type,
                        "user_description": log.user_description,
                        "estimated_calories": log.estimated_calories,
                    }
                )
            else:
                tool_content = json.dumps({"ok": False, "error": "Invalid meal log arguments"})
        elif tool_name == PLANNED_MEAL_TOOL_NAME:
            args_with_default = dict(args)
            if default_date and not args_with_default.get("date"):
                inferred = default_date + timedelta(days=1) if ("tomorrow" in lower_message) else default_date
                args_with_default["date"] = inferred.isoformat()
            if default_date and not has_explicit_iso_date and isinstance(args_with_default.get("date"), str):
                try:
                    model_date = date.fromisoformat(args_with_default["date"])
                    if "today" in lower_message and model_date == default_date + timedelta(days=1):
                        args_with_default["date"] = default_date.isoformat()
                    if "tomorrow" in lower_message and model_date == default_date + timedelta(days=2):
                        args_with_default["date"] = (default_date + timedelta(days=1)).isoformat()
                except ValueError:
                    pass
            meal = (
                _create_planned_meal_from_args(session, user_id or "", args_with_default, default_date=default_date)
                if session and user_id
                else None
            )
            if meal:
                created_db_planned_meals.append(meal)
                tool_content = json.dumps(
                    {
                        "ok": True,
                        "planned_meal_id": meal.id,
                        "date": meal.date.isoformat(),
                        "meal_type": meal.meal_type,
                        "name": meal.name,
                        "calories": meal.calories,
                        "time": meal.time.isoformat(),
                        "description": meal.description,
                    }
                )
            else:
                tool_content = json.dumps({"ok": False, "error": "Invalid planned meal arguments"})
        else:
            continue

        messages.append({"role": "tool", "tool_call_id": call.id, "content": tool_content})

    if (created_db_logs or created_db_planned_meals) and session:
        session.commit()
        for log in created_db_logs:
            session.refresh(log)
        for meal in created_db_planned_meals:
            session.refresh(meal)

    try:
        final = client.chat.completions.create(
            model=settings.openai_model,
            messages=messages,
            temperature=0.2,
            **_token_limit_kwargs(settings.openai_model, 350),
        )
    except Exception as exc:  # noqa: BLE001 - surface as HTTPException for API callers
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"LLM request failed: {exc}")

    final_message = final.choices[0].message
    return {
        "reply": final_message.content,
        "model": final.model,
        "usage": final.usage.model_dump() if final.usage else None,
        "created_meal_logs": [MealLogRead.model_validate(log, from_attributes=True) for log in created_db_logs],
        "created_planned_meals": [
            PlannedMealRead.model_validate(meal, from_attributes=True) for meal in created_db_planned_meals
        ],
    }

from __future__ import annotations

import json
from datetime import date
from typing import Any

from sqlmodel import Session

from fastapi import HTTPException, status
from openai import OpenAI

from ..config import settings
from ..models import MealLog, MealLogRead

SYSTEM_PROMPT = (
    "You are a supportive digital nutritionist.\n"
    "\n"
    "If the user describes food or drink they *consumed* (e.g., “I had…”, “I ate…”, “for lunch…”), "
    "log it by calling the `create_meal_log` tool.\n"
    "- Use today's date unless the user specifies a different date.\n"
    "- Set `meal_type` to one of: breakfast, lunch, dinner, snack (or omit if unknown).\n"
    "- `user_description` should be a concise description of what they consumed.\n"
    "- `estimated_calories` should be an integer; if the user gives calories, use them; otherwise broadly estimate.\n"
    "- If the message is too ambiguous to log (no food/drink details), ask a clarifying question instead of logging.\n"
    "\n"
    "If the user is asking for advice/planning (not reporting a consumed meal), do not call any tool.\n"
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


def _coerce_date(value: Any) -> date:
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value.strip())
        except ValueError:
            pass
    return date.today()


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
) -> dict[str, Any]:
    client = get_openai_client()

    messages: list[dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    if user_context:
        messages.append({"role": "system", "content": f"User profile: {user_context}"})

    if history:
        for turn in history:
            role = turn.get("role")
            content = turn.get("content")
            if role in {"user", "assistant"} and isinstance(content, str) and content.strip():
                messages.append({"role": role, "content": content.strip()})

    messages.append({"role": "user", "content": message})

    enable_meal_logging = session is not None and bool(user_id)
    tools = [MEAL_LOG_TOOL] if enable_meal_logging else None

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
        }

    # Tool calling round: execute meal log creations, then ask the model to respond to the user.
    messages.append(_message_to_openai_dict(first_message))

    created_db_logs: list[MealLog] = []
    for call in tool_calls:
        if getattr(call, "type", None) != "function":
            continue
        function = getattr(call, "function", None)
        if not function or getattr(function, "name", None) != MEAL_LOG_TOOL_NAME:
            continue

        args = _parse_tool_args(getattr(function, "arguments", None))
        log = _create_meal_log_from_args(session, user_id or "", args) if session and user_id else None
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

        messages.append({"role": "tool", "tool_call_id": call.id, "content": tool_content})

    if created_db_logs and session:
        session.commit()
        for log in created_db_logs:
            session.refresh(log)

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
    }

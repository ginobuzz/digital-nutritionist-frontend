from __future__ import annotations

import json
import re
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import func
from sqlmodel import Session, select

from fastapi import HTTPException, status
from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AuthenticationError,
    BadRequestError,
    LengthFinishReasonError,
    OpenAI,
    RateLimitError,
)

from ..config import settings
from ..models import MealLog, MealLogRead, PlannedMeal, PlannedMealRead

SYSTEM_PROMPT = (
    "You are a supportive digital nutritionist.\n"
    "\n"
    "This app supports BOTH logging meals already eaten and planning meals for the future.\n"
    "\n"
    "The user may attach a meal photo. Use it to infer foods, portions, and preparation.\n"
    "\n"
    "If the user describes food or drink they *consumed* (e.g., “I had…”, “I ate…”, “for lunch…”), "
    "log it by calling the `create_meal_log` tool.\n"
    "- Use the user's local 'today' date unless the user specifies a different date.\n"
    "- Set `meal_type` to one of: breakfast, lunch, dinner, snack (or omit if unknown).\n"
    "- `user_description` should be ONLY a concise description of what they consumed (no meta commentary).\n"
    "- `estimated_calories` should be an integer; if the user gives calories, use them; otherwise broadly estimate.\n"
    "- Also estimate macros in grams when possible: `protein_g`, `carbs_g`, `fat_g` (numbers; broad estimates are fine).\n"
    "- If the message is too ambiguous to log (no food/drink details), ask a clarifying question instead of logging.\n"
    "- If the user is correcting a previous meal log (e.g., “wait no it was …”), call `create_meal_log` with "
    "`replace_previous: true` so the most recent entry for that date is updated instead of creating a duplicate.\n"
    "\n"
    "If the user is planning a meal (especially for a future date/time) and provides enough detail, "
    "create a planned meal by calling the `create_planned_meal` tool.\n"
    "- Planning meals in the future is valid and encouraged; do not refuse just because a date is in the future.\n"
    "- If the user says “today/tomorrow”, interpret it relative to the user's local 'today' date.\n"
    "- Use the date the user specifies; otherwise use the user's local 'today' date.\n"
    "- Pick a reasonable time if none is given.\n"
    "\n"
    "If the user asks what they ate/drank on a given date/meal (e.g. “What was my breakfast today?”, "
    "“How many calories did I have for lunch yesterday?”, “Summarize what I ate today”), you MUST call the "
    "`get_meal_logs` tool to look up the saved meal logs.\n"
    "- The database is the source of truth; do NOT rely on prior chat messages for what the user ate.\n"
    "- If nothing is logged for that date/meal, say so and ask if they'd like to log it.\n"
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
                "protein_g": {
                    "type": ["number", "null"],
                    "description": "Estimated protein in grams (number) or null if unknown.",
                },
                "carbs_g": {
                    "type": ["number", "null"],
                    "description": "Estimated carbs in grams (number) or null if unknown.",
                },
                "fat_g": {
                    "type": ["number", "null"],
                    "description": "Estimated fat in grams (number) or null if unknown.",
                },
                "replace_previous": {
                    "type": "boolean",
                    "description": "If true, replace the most recently logged meal on that date (and meal_type if provided).",
                },
                "replace_meal_log_id": {
                    "type": ["string", "null"],
                    "description": "If provided, update this existing meal log instead of creating a new one.",
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

MEAL_LOOKUP_TOOL_NAME = "get_meal_logs"
MEAL_LOOKUP_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": MEAL_LOOKUP_TOOL_NAME,
        "description": "Look up the current user's meal logs for a specific date (optionally filtered by meal type).",
        "parameters": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "date": {
                    "type": "string",
                    "description": "Date to look up in ISO format (YYYY-MM-DD). Use today's date if not specified.",
                },
                "meal_type": {
                    "type": ["string", "null"],
                    "description": "Optional filter: one of breakfast, lunch, dinner, snack (or null for all meals).",
                },
            },
            "required": ["date"],
        },
    },
}

def _token_limit_kwargs(model: str, value: int) -> dict[str, Any]:
    # Some newer models (e.g. gpt-5.*) use `max_completion_tokens` instead of `max_tokens`.
    if model.startswith("gpt-5"):
        return {"max_completion_tokens": value}
    return {"max_tokens": value}


def _looks_like_output_token_limit_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return (
        ("max_tokens" in message or "max completion tokens" in message or "max_completion_tokens" in message)
        and (
            "output limit" in message
            or "model output limit" in message
            or "was reached" in message
            or "reached" in message
        )
    )


def _looks_like_context_limit_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return (
        "maximum context length" in message
        or "context length" in message
        or "context_length" in message
        or ("too many tokens" in message and "requested" in message)
    )


def _sanitize_history(history: list[dict[str, Any]] | None) -> list[dict[str, str]]:
    if not history:
        return []

    max_turns = max(0, int(settings.openai_max_history_turns))
    max_chars = max(0, int(settings.openai_max_history_chars))
    max_turn_chars = max(0, int(settings.openai_max_turn_chars))

    turns = history[-max_turns:] if max_turns else []
    sanitized: list[dict[str, str]] = []
    for turn in turns:
        role = turn.get("role")
        content = turn.get("content")
        if role not in {"user", "assistant"}:
            continue
        if not isinstance(content, str):
            continue
        text = content.strip()
        if not text:
            continue
        if max_turn_chars and len(text) > max_turn_chars:
            text = text[:max_turn_chars]
        sanitized.append({"role": role, "content": text})

    if max_chars:
        total = sum(len(turn["content"]) for turn in sanitized)
        while sanitized and total > max_chars:
            removed = sanitized.pop(0)
            total -= len(removed["content"])

    return sanitized


def _openai_chat_create(
    client: OpenAI,
    *,
    model: str,
    messages: list[dict[str, Any]],
    temperature: float,
    tools: list[dict[str, Any]] | None = None,
    tool_choice: str | None = None,
) -> Any:
    token_budget = max(1, int(settings.openai_max_output_tokens))
    retry_budget = max(token_budget, int(settings.openai_max_output_tokens_retry))
    budgets = [token_budget] if retry_budget == token_budget else [token_budget, retry_budget]

    last_exc: Exception | None = None
    for idx, budget in enumerate(budgets):
        try:
            create_kwargs: dict[str, Any] = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                **_token_limit_kwargs(model, budget),
            }
            if tools:
                create_kwargs["tools"] = tools
                create_kwargs["tool_choice"] = tool_choice or "auto"
            return client.chat.completions.create(**create_kwargs)
        except Exception as exc:  # noqa: BLE001 - translated into HTTPException upstream
            last_exc = exc
            if idx < len(budgets) - 1 and _looks_like_output_token_limit_error(exc):
                continue
            raise

    raise last_exc or RuntimeError("OpenAI request failed")


def _raise_llm_http_exception(exc: Exception) -> None:
    # Normalize common OpenAI/provider failures into stable HTTP responses.
    if isinstance(exc, RateLimitError):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="The AI coach is getting a lot of requests. Please try again in a moment.",
        )

    if isinstance(exc, AuthenticationError):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The AI coach isn’t available right now. Please try again later.",
        )

    if isinstance(exc, (APITimeoutError, APIConnectionError)):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI coach isn’t available right now. Please try again in a moment.",
        )

    if isinstance(exc, (BadRequestError, LengthFinishReasonError)) and _looks_like_output_token_limit_error(exc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That response would be too long. Try asking for a shorter answer.",
        )

    if isinstance(exc, BadRequestError) and _looks_like_context_limit_error(exc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This chat is getting long. Try a shorter message or start a new chat.",
        )

    if isinstance(exc, BadRequestError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="I couldn’t process that request. Please try again.",
        )

    if isinstance(exc, APIStatusError):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI coach is temporarily unavailable. Please try again.",
        )

    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="The AI coach is temporarily unavailable. Please try again.",
    )


def get_openai_client() -> OpenAI:
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The AI coach isn’t available right now. Please try again later.",
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


def _coerce_macro_grams(value: Any) -> float | None:
    try:
        grams = float(value)
    except (TypeError, ValueError):
        return None
    if grams < 0:
        return 0.0
    if grams > 500:
        return 500.0
    return round(grams, 1)


def _coerce_description(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    # Keep tool arguments from polluting the DB with meta commentary like "(replacing previously logged ...)".
    text = re.sub(r"\s*\((?:replacing|previously logged).*\)\s*$", "", text, flags=re.IGNORECASE).strip()
    # Avoid extremely long blobs (e.g., full conversation)
    return text[:500]


def _serialize_meal_log_for_tool(log: MealLog) -> dict[str, Any]:
    return {
        "id": log.id,
        "date": log.date.isoformat(),
        "meal_type": log.meal_type,
        "user_description": log.user_description,
        "estimated_calories": log.estimated_calories,
        "protein_g": log.protein_g,
        "carbs_g": log.carbs_g,
        "fat_g": log.fat_g,
        "created_at": log.created_at.isoformat() if log.created_at else None,
        "updated_at": log.updated_at.isoformat() if log.updated_at else None,
    }


def _summarize_meal_logs_for_tool(logs: list[MealLog]) -> dict[str, Any]:
    totals = {"estimated_calories": 0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0}
    missing = {"estimated_calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0}

    for log in logs:
        if log.estimated_calories is None:
            missing["estimated_calories"] += 1
        else:
            totals["estimated_calories"] += int(log.estimated_calories)

        for key in ("protein_g", "carbs_g", "fat_g"):
            value = getattr(log, key, None)
            if value is None:
                missing[key] += 1
            else:
                totals[key] += float(value)

    totals["protein_g"] = round(totals["protein_g"], 1)
    totals["carbs_g"] = round(totals["carbs_g"], 1)
    totals["fat_g"] = round(totals["fat_g"], 1)

    return {
        "count": len(logs),
        "totals": totals,
        "missing": missing,
        "meal_logs": [_serialize_meal_log_for_tool(log) for log in logs],
    }

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

def _looks_like_meal_correction_message(message: str) -> bool:
    lower = (message or "").strip().lower()
    if not lower:
        return False

    # Conservative: only treat obvious "correction" phrasing as a replacement signal.
    patterns = (
        r"^wait\b",
        r"^sorry\b",
        r"^actually\b",
        r"^correction\b",
        r"^scratch that\b",
        r"^i\s+(mean|meant)\b",
        r"^no[, ]+(it|that)\b",
        r"^nope[, ]+(it|that)\b",
    )
    return any(re.search(p, lower) for p in patterns)


def _create_meal_log_from_args(session: Session, user_id: str, args: dict[str, Any]) -> MealLog | None:
    description = _coerce_description(args.get("user_description"))
    calories = _coerce_calories(args.get("estimated_calories"))
    if not description or calories is None:
        return None

    meal_date = _coerce_date(args.get("date"))
    meal_type = _normalize_meal_type(args.get("meal_type"))

    macro_updates: dict[str, float | None] = {}
    for key in ("protein_g", "carbs_g", "fat_g"):
        if key in args:
            macro_updates[key] = _coerce_macro_grams(args.get(key))

    replace_meal_log_id = args.get("replace_meal_log_id")
    if isinstance(replace_meal_log_id, str):
        replace_meal_log_id = replace_meal_log_id.strip() or None
    else:
        replace_meal_log_id = None

    replace_previous = args.get("replace_previous")
    if isinstance(replace_previous, str):
        replace_previous = replace_previous.strip().lower() == "true"
    replace_previous = bool(replace_previous)

    def apply_update(target: MealLog) -> MealLog:
        target.date = meal_date
        target.meal_type = meal_type
        target.user_description = description
        target.estimated_calories = calories
        for key, value in macro_updates.items():
            setattr(target, key, value)
        target.updated_at = datetime.utcnow()
        session.add(target)
        return target

    if replace_meal_log_id:
        existing = session.get(MealLog, replace_meal_log_id)
        if existing and existing.user_id == user_id:
            return apply_update(existing)

    if replace_previous:
        query = select(MealLog).where(MealLog.user_id == user_id).where(MealLog.date == meal_date)
        if meal_type:
            query = query.where(MealLog.meal_type == meal_type)
        existing = session.exec(query.order_by(MealLog.created_at.desc())).first()
        if existing:
            return apply_update(existing)

    log = MealLog(
        user_id=user_id,
        date=meal_date,
        meal_type=meal_type,
        user_description=description,
        estimated_calories=calories,
        **macro_updates,
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


def chat_completion(
    message: str,
    user_context: dict[str, Any] | None = None,
    *,
    image_data_url: str | None = None,
) -> dict[str, Any]:
    client = get_openai_client()
    user_text = message.strip() or ("Please describe the attached meal photo." if image_data_url else "")
    user_content: Any = user_text
    if image_data_url:
        user_content = [
            {"type": "text", "text": user_text},
            {"type": "image_url", "image_url": {"url": image_data_url}},
        ]

    messages = [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user_content}]
    if user_context:
        messages.insert(
            1,
            {
                "role": "system",
                "content": f"User profile: {user_context}",
            },
        )

    try:
        response = _openai_chat_create(
            client,
            model=settings.openai_model,
            messages=messages,
            temperature=0.2,
        )
    except Exception as exc:  # noqa: BLE001
        _raise_llm_http_exception(exc)

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
    image_data_url: str | None = None,
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

    for turn in _sanitize_history(history):
        messages.append(turn)

    user_text = message.strip() or ("Please describe the attached meal photo." if image_data_url else "")
    user_content: Any = user_text
    if image_data_url:
        user_content = [
            {"type": "text", "text": user_text},
            {"type": "image_url", "image_url": {"url": image_data_url}},
        ]

    messages.append({"role": "user", "content": user_content})

    enable_meal_logging = session is not None and bool(user_id)
    lower_message = user_text.lower()
    has_explicit_iso_date = bool(re.search(r"\b\d{4}-\d{2}-\d{2}\b", user_text))
    force_no_tools = ("return only" in lower_message) and ("json" in lower_message)
    tools = [MEAL_LOG_TOOL, PLANNED_MEAL_TOOL, MEAL_LOOKUP_TOOL] if (enable_meal_logging and not force_no_tools) else None
    looks_like_correction = _looks_like_meal_correction_message(user_text)

    try:
        first = _openai_chat_create(
            client,
            model=settings.openai_model,
            messages=messages,
            temperature=0.2,
            tools=tools,
            tool_choice="auto",
        )
    except Exception as exc:  # noqa: BLE001 - surface as HTTPException for API callers
        _raise_llm_http_exception(exc)

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
            # If the user is correcting a recently logged meal, replace the last entry for that date instead
            # of appending another record.
            if looks_like_correction and "replace_previous" not in args_with_default:
                args_with_default["replace_previous"] = True
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
                        "protein_g": log.protein_g,
                        "carbs_g": log.carbs_g,
                        "fat_g": log.fat_g,
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
        elif tool_name == MEAL_LOOKUP_TOOL_NAME:
            if not session or not user_id:
                tool_content = json.dumps({"ok": False, "error": "Meal lookup unavailable"})
            else:
                args_with_default = dict(args)
                if default_date and not args_with_default.get("date"):
                    args_with_default["date"] = default_date.isoformat()

                if default_date and not has_explicit_iso_date and isinstance(args_with_default.get("date"), str):
                    try:
                        model_date = date.fromisoformat(args_with_default["date"])
                        if "today" in lower_message and model_date == default_date + timedelta(days=1):
                            args_with_default["date"] = default_date.isoformat()
                        if "yesterday" in lower_message and model_date == default_date:
                            args_with_default["date"] = (default_date - timedelta(days=1)).isoformat()
                    except ValueError:
                        pass

                lookup_date = _coerce_date(args_with_default.get("date"), default=default_date)
                lookup_meal_type = _normalize_meal_type(args_with_default.get("meal_type"))

                query = (
                    select(MealLog)
                    .where(MealLog.user_id == user_id)
                    .where(MealLog.date == lookup_date)
                    .order_by(MealLog.created_at.asc())
                )
                if lookup_meal_type:
                    query = query.where(func.lower(MealLog.meal_type) == lookup_meal_type)
                logs = session.exec(query).all()

                payload = {
                    "ok": True,
                    "date": lookup_date.isoformat(),
                    "meal_type": lookup_meal_type,
                    **_summarize_meal_logs_for_tool(logs),
                }

                # If the user asked about a specific meal type but none are tagged, return untyped logs
                # for the same date so the assistant can ask a clarifying question.
                if lookup_meal_type and not logs:
                    untyped_query = (
                        select(MealLog)
                        .where(MealLog.user_id == user_id)
                        .where(MealLog.date == lookup_date)
                        .where((MealLog.meal_type.is_(None)) | (func.trim(MealLog.meal_type) == ""))
                        .order_by(MealLog.created_at.asc())
                    )
                    untyped_logs = session.exec(untyped_query).all()
                    if untyped_logs:
                        payload["untyped_meal_logs"] = [_serialize_meal_log_for_tool(log) for log in untyped_logs]

                tool_content = json.dumps(payload)
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
        final = _openai_chat_create(
            client,
            model=settings.openai_model,
            messages=messages,
            temperature=0.2,
        )
    except Exception as exc:  # noqa: BLE001 - surface as HTTPException for API callers
        _raise_llm_http_exception(exc)

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

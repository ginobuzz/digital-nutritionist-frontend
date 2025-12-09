from typing import Any

from fastapi import HTTPException, status
from openai import OpenAI

from ..config import settings

SYSTEM_PROMPT = (
    "You are a supportive digital nutritionist. Provide concise, actionable guidance "
    "on healthy eating, weight management, and calorie targets."
)


def get_openai_client() -> OpenAI:
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OPENAI_API_KEY is not configured.",
        )
    return OpenAI(api_key=settings.openai_api_key)


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
        model="gpt-5.1",
        messages=messages,
        temperature=0.2,
        max_tokens=300,
    )

    choice = response.choices[0].message
    return {
        "reply": choice.content,
        "model": response.model,
        "usage": response.usage.model_dump() if response.usage else None,
    }

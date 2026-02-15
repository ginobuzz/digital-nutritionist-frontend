from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, model_validator
from sqlmodel import Session

from ..abuse_guards import ChatRateLimit
from ..config import settings
from ..deps import get_current_user
from ..db import get_session
from ..models import MealLogRead, PlannedMealRead, User, UserRead
from ..services.chat import assistant_chat

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=settings.chat_max_history_turn_chars_payload)


class ChatRequest(BaseModel):
    message: str | None = Field(default=None, max_length=settings.chat_max_message_chars)
    image_data_url: str | None = Field(
        default=None,
        max_length=settings.chat_max_image_data_url_chars,
        description="Optional meal photo as a data URL (data:image/*;base64,...).",
    )
    user_id: str | None = None
    history: list[ChatTurn] | None = Field(default=None, max_length=settings.chat_max_history_turns_payload)
    client_local_date: date | None = None
    client_time_zone: str | None = Field(default=None, max_length=128)

    @model_validator(mode="after")
    def validate_message_or_image(self) -> "ChatRequest":
        has_message = bool(self.message and self.message.strip())
        has_image = bool(self.image_data_url and self.image_data_url.strip())
        if not has_message and not has_image:
            raise ValueError("Provide `message` or `image_data_url`.")
        if has_image and not (self.image_data_url or "").startswith("data:image/"):
            raise ValueError("`image_data_url` must be a data:image/* URL.")
        if self.image_data_url and len(self.image_data_url) > settings.chat_max_image_data_url_chars:
            raise ValueError("`image_data_url` exceeds maximum length.")
        if self.message and len(self.message) > settings.chat_max_message_chars:
            raise ValueError("`message` exceeds maximum length.")
        if self.history and len(self.history) > settings.chat_max_history_turns_payload:
            raise ValueError("`history` has too many turns.")
        return self


class ChatResponse(BaseModel):
    reply: str
    model: str | None = None
    usage: dict | None = None
    created_meal_logs: list[MealLogRead] = Field(default_factory=list)
    created_planned_meals: list[PlannedMealRead] = Field(default_factory=list)


def _enforce_chat_payload_cap(request: Request) -> None:
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > settings.chat_max_payload_bytes:
        raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail="Chat payload too large")


@router.post("", response_model=ChatResponse, dependencies=[ChatRateLimit])
@router.post("/", response_model=ChatResponse, include_in_schema=False, dependencies=[ChatRateLimit])
def chat_endpoint(*, request: Request, session: Session = Depends(get_session), payload: ChatRequest, current_user: User = Depends(get_current_user)):
    _enforce_chat_payload_cap(request)
    if payload.user_id and str(payload.user_id) != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    user_context = UserRead.model_validate(current_user, from_attributes=True).model_dump()

    result = assistant_chat(
        payload.message or "",
        user_context=user_context,
        session=session,
        user_id=current_user.id,
        history=[turn.model_dump() for turn in payload.history] if payload.history else None,
        client_local_date=payload.client_local_date,
        client_time_zone=payload.client_time_zone,
        image_data_url=payload.image_data_url,
    )
    if not result.get("reply"):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No reply received from model")
    return result

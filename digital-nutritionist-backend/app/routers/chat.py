from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, model_validator
from sqlmodel import Session

from ..db import get_session
from ..models import MealLogRead, PlannedMealRead, User, UserRead
from ..services.chat import assistant_chat

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    message: str | None = None
    image_data_url: str | None = Field(
        default=None,
        description="Optional meal photo as a data URL (data:image/*;base64,...).",
    )
    user_id: str | None = None
    history: list[ChatTurn] | None = None
    client_local_date: date | None = None
    client_time_zone: str | None = None

    @model_validator(mode="after")
    def validate_message_or_image(self) -> "ChatRequest":
        has_message = bool(self.message and self.message.strip())
        has_image = bool(self.image_data_url and self.image_data_url.strip())
        if not has_message and not has_image:
            raise ValueError("Provide `message` or `image_data_url`.")
        if has_image and not (self.image_data_url or "").startswith("data:image/"):
            raise ValueError("`image_data_url` must be a data:image/* URL.")
        return self


class ChatResponse(BaseModel):
    reply: str
    model: str | None = None
    usage: dict | None = None
    created_meal_logs: list[MealLogRead] = Field(default_factory=list)
    created_planned_meals: list[PlannedMealRead] = Field(default_factory=list)


@router.post("", response_model=ChatResponse)
@router.post("/", response_model=ChatResponse, include_in_schema=False)
def chat_endpoint(*, session: Session = Depends(get_session), payload: ChatRequest):
    user_context = None
    if payload.user_id:
        user = session.get(User, payload.user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        user_context = UserRead.model_validate(user, from_attributes=True).model_dump()

    result = assistant_chat(
        payload.message or "",
        user_context=user_context,
        session=session,
        user_id=payload.user_id,
        history=[turn.model_dump() for turn in payload.history] if payload.history else None,
        client_local_date=payload.client_local_date,
        client_time_zone=payload.client_time_zone,
        image_data_url=payload.image_data_url,
    )
    if not result.get("reply"):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No reply received from model")
    return result

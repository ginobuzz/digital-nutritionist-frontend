from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlmodel import Session

from ..db import get_session
from ..models import MealLogRead, PlannedMealRead, User, UserRead
from ..services.chat import assistant_chat

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    user_id: str | None = None
    history: list[ChatTurn] | None = None
    client_local_date: date | None = None
    client_time_zone: str | None = None


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
        payload.message,
        user_context=user_context,
        session=session,
        user_id=payload.user_id,
        history=[turn.model_dump() for turn in payload.history] if payload.history else None,
        client_local_date=payload.client_local_date,
        client_time_zone=payload.client_time_zone,
    )
    if not result.get("reply"):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No reply received from model")
    return result

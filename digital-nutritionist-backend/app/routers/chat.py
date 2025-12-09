from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from ..db import get_session
from ..models import User
from ..services.chat import chat_completion

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    user_id: str | None = None


class ChatResponse(BaseModel):
    reply: str
    model: str | None = None
    usage: dict | None = None


@router.post("/", response_model=ChatResponse)
def chat_endpoint(*, session: Session = Depends(get_session), payload: ChatRequest):
    user_context = None
    if payload.user_id:
        user = session.get(User, payload.user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        user_context = user.model_dump()

    result = chat_completion(payload.message, user_context=user_context)
    if not result.get("reply"):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No reply received from model")
    return result

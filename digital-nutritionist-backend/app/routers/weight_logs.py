from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ..db import get_session
from ..models import User, WeightLog, WeightLogCreate, WeightLogRead, WeightLogUpdate

router = APIRouter(prefix="/weight-logs", tags=["weight_logs"])


@router.post("/", response_model=WeightLogRead, status_code=status.HTTP_201_CREATED)
def create_weight_log(*, session: Session = Depends(get_session), payload: WeightLogCreate):
    user = session.get(User, payload.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    log = WeightLog.model_validate(payload)
    session.add(log)
    session.commit()
    session.refresh(log)
    return log


@router.put("/{log_id}", response_model=WeightLogRead)
def update_weight_log(*, session: Session = Depends(get_session), log_id: str, payload: WeightLogUpdate):
    log = session.get(WeightLog, log_id)
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Weight log not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(log, key, value)
    session.add(log)
    session.commit()
    session.refresh(log)
    return log


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_weight_log(*, session: Session = Depends(get_session), log_id: str):
    log = session.get(WeightLog, log_id)
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Weight log not found")
    session.delete(log)
    session.commit()


@router.get("/", response_model=list[WeightLogRead])
def list_weight_logs(*, session: Session = Depends(get_session), user_id: str | None = None):
    query = select(WeightLog)
    if user_id:
        query = query.where(WeightLog.user_id == user_id)
    return session.exec(query).all()

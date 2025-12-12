from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ..db import get_session
from ..models import MealLog, MealLogCreate, MealLogRead, MealLogUpdate, User

router = APIRouter(prefix="/meal-logs", tags=["meal_logs"])


@router.post("/", response_model=MealLogRead, status_code=status.HTTP_201_CREATED)
def create_meal_log(*, session: Session = Depends(get_session), payload: MealLogCreate):
    user = session.get(User, payload.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    log = MealLog.model_validate(payload)
    session.add(log)
    session.commit()
    session.refresh(log)
    return log


@router.get("/", response_model=list[MealLogRead])
def list_meal_logs(
    *,
    session: Session = Depends(get_session),
    user_id: str | None = None,
    start: date | None = None,
    end: date | None = None,
):
    query = select(MealLog).order_by(MealLog.date.desc())
    if user_id:
        query = query.where(MealLog.user_id == user_id)
    if start:
        query = query.where(MealLog.date >= start)
    if end:
        query = query.where(MealLog.date <= end)
    return session.exec(query).all()


@router.get("/{log_id}", response_model=MealLogRead)
def get_meal_log(*, session: Session = Depends(get_session), log_id: str):
    log = session.get(MealLog, log_id)
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal log not found")
    return log


@router.put("/{log_id}", response_model=MealLogRead)
def update_meal_log(*, session: Session = Depends(get_session), log_id: str, payload: MealLogUpdate):
    log = session.get(MealLog, log_id)
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal log not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(log, key, value)
    log.updated_at = datetime.utcnow()
    session.add(log)
    session.commit()
    session.refresh(log)
    return log


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meal_log(*, session: Session = Depends(get_session), log_id: str):
    log = session.get(MealLog, log_id)
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal log not found")
    session.delete(log)
    session.commit()

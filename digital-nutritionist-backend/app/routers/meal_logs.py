from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ..deps import get_current_user
from ..db import get_session
from ..models import MealLog, MealLogCreate, MealLogRead, MealLogUpdate, User

router = APIRouter(prefix="/meal-logs", tags=["meal_logs"])


@router.post("/", response_model=MealLogRead, status_code=status.HTTP_201_CREATED)
def create_meal_log(*, session: Session = Depends(get_session), payload: MealLogCreate, current_user: User = Depends(get_current_user)):
    if payload.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    log = MealLog(
        user_id=current_user.id,
        date=payload.date,
        user_description=payload.user_description,
        meal_type=payload.meal_type,
        estimated_calories=payload.estimated_calories,
        protein_g=payload.protein_g,
        carbs_g=payload.carbs_g,
        fat_g=payload.fat_g,
    )
    if payload.time:
        log.created_at = payload.time
        log.updated_at = payload.time
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
    current_user: User = Depends(get_current_user),
):
    if user_id is not None and user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    query = select(MealLog).where(MealLog.user_id == current_user.id).order_by(MealLog.date.desc())
    if start:
        query = query.where(MealLog.date >= start)
    if end:
        query = query.where(MealLog.date <= end)
    return session.exec(query).all()


@router.get("/{log_id}", response_model=MealLogRead)
def get_meal_log(*, session: Session = Depends(get_session), log_id: str, current_user: User = Depends(get_current_user)):
    log = session.get(MealLog, log_id)
    if not log or log.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal log not found")
    return log


@router.put("/{log_id}", response_model=MealLogRead)
def update_meal_log(*, session: Session = Depends(get_session), log_id: str, payload: MealLogUpdate, current_user: User = Depends(get_current_user)):
    log = session.get(MealLog, log_id)
    if not log or log.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal log not found")

    update_data = payload.model_dump(exclude_unset=True)
    # Store `time` updates in `created_at` so UI can edit time-of-day without schema changes.
    time_value = update_data.pop("time", None)
    for key, value in update_data.items():
        setattr(log, key, value)
    if time_value:
        log.created_at = time_value
    log.updated_at = datetime.utcnow()
    session.add(log)
    session.commit()
    session.refresh(log)
    return log


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meal_log(*, session: Session = Depends(get_session), log_id: str, current_user: User = Depends(get_current_user)):
    log = session.get(MealLog, log_id)
    if not log or log.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal log not found")
    session.delete(log)
    session.commit()

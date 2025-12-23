from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ..db import get_session
from ..models import PlannedMeal, PlannedMealCreate, PlannedMealRead, PlannedMealUpdate, User

router = APIRouter(prefix="/planned-meals", tags=["planned_meals"])


@router.post("/", response_model=PlannedMealRead, status_code=status.HTTP_201_CREATED)
def create_planned_meal(*, session: Session = Depends(get_session), payload: PlannedMealCreate):
    user = session.get(User, payload.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    meal = PlannedMeal.model_validate(payload)
    session.add(meal)
    session.commit()
    session.refresh(meal)
    return meal


@router.get("/", response_model=list[PlannedMealRead])
def list_planned_meals(
    *,
    session: Session = Depends(get_session),
    user_id: str | None = None,
    start: date | None = None,
    end: date | None = None,
):
    query = select(PlannedMeal).order_by(PlannedMeal.time.asc())
    if user_id:
        query = query.where(PlannedMeal.user_id == user_id)
    if start:
        query = query.where(PlannedMeal.date >= start)
    if end:
        query = query.where(PlannedMeal.date <= end)
    return session.exec(query).all()


@router.get("/{meal_id}", response_model=PlannedMealRead)
def get_planned_meal(*, session: Session = Depends(get_session), meal_id: str):
    meal = session.get(PlannedMeal, meal_id)
    if not meal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Planned meal not found")
    return meal


@router.put("/{meal_id}", response_model=PlannedMealRead)
def update_planned_meal(*, session: Session = Depends(get_session), meal_id: str, payload: PlannedMealUpdate):
    meal = session.get(PlannedMeal, meal_id)
    if not meal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Planned meal not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(meal, key, value)
    meal.updated_at = datetime.utcnow()
    session.add(meal)
    session.commit()
    session.refresh(meal)
    return meal


@router.delete("/{meal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_planned_meal(*, session: Session = Depends(get_session), meal_id: str):
    meal = session.get(PlannedMeal, meal_id)
    if not meal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Planned meal not found")
    session.delete(meal)
    session.commit()


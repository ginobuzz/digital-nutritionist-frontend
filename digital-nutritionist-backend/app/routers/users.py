from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlmodel import Session, select

from ..deps import get_current_user
from ..db import get_session
from ..models import User, UserCreate, UserRead, UserUpdate, WeightLogRead
from ..security import hash_password

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(*, session: Session = Depends(get_session), user: UserCreate, current_user: User = Depends(get_current_user)):
    existing = session.exec(select(User).where(User.email == user.email)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    db_user = User(
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        age=user.age,
        gender=user.gender,
        activity_level=user.activity_level,
        height_in=user.height_in,
        starting_weight_lb=user.starting_weight_lb,
        goal_weight_lb=user.goal_weight_lb,
        goal_weight_date=user.goal_weight_date,
        daily_calorie_budget=user.daily_calorie_budget,
        password_hash=hash_password(user.password),
    )
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return UserRead.model_validate(db_user, from_attributes=True)


@router.get("/{user_id}", response_model=UserRead)
def get_user(
    *,
    session: Session = Depends(get_session),
    user_id: str = Path(..., description="User ID"),
    current_user: User = Depends(get_current_user),
):
    if user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserRead.model_validate(user, from_attributes=True)


@router.put("/{user_id}", response_model=UserRead)
def update_user(*, session: Session = Depends(get_session), user_id: str, payload: UserUpdate, current_user: User = Depends(get_current_user)):
    if user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    update_data = payload.model_dump(exclude_unset=True)

    new_email = update_data.get("email")
    if new_email and new_email != user.email:
        existing = session.exec(select(User).where(User.email == new_email)).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    new_password = update_data.pop("password", None)

    for key, value in update_data.items():
        setattr(user, key, value)
    if new_password:
        user.password_hash = hash_password(new_password)
    user.updated_at = datetime.utcnow()
    session.add(user)
    session.commit()
    session.refresh(user)
    return UserRead.model_validate(user, from_attributes=True)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(*, session: Session = Depends(get_session), user_id: str, current_user: User = Depends(get_current_user)):
    if user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    session.delete(user)
    session.commit()


@router.get("/{user_id}/weight-logs", response_model=list[WeightLogRead])
def list_weight_logs(*, session: Session = Depends(get_session), user_id: str, current_user: User = Depends(get_current_user)):
    if user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return [WeightLogRead.model_validate(log, from_attributes=True) for log in user.weight_logs]

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlmodel import Session

from ..db import get_session
from ..models import User, UserCreate, UserRead, UserUpdate, WeightLogRead

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(*, session: Session = Depends(get_session), user: UserCreate):
    db_user = User.model_validate(user)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


@router.get("/{user_id}", response_model=UserRead)
def get_user(*, session: Session = Depends(get_session), user_id: str = Path(..., description="User ID")):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserRead)
def update_user(*, session: Session = Depends(get_session), user_id: str, payload: UserUpdate):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(*, session: Session = Depends(get_session), user_id: str):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    session.delete(user)
    session.commit()


@router.get("/{user_id}/weight-logs", response_model=list[WeightLogRead])
def list_weight_logs(*, session: Session = Depends(get_session), user_id: str):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return [WeightLogRead.model_validate(log) for log in user.weight_logs]

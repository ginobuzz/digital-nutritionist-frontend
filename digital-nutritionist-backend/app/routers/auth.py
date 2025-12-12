from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import get_session
from ..models import User, UserCreate, UserRead
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


def _user_to_read(user: User) -> UserRead:
    return UserRead.model_validate(user, from_attributes=True)


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(*, session: Session = Depends(get_session), payload: UserCreate):
    existing = session.exec(select(User).where(User.email == payload.email)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    db_user = User(
        email=payload.email,
        first_name=payload.first_name,
        last_name=payload.last_name,
        age=payload.age,
        gender=payload.gender,
        activity_level=payload.activity_level,
        height_in=payload.height_in,
        starting_weight_lb=payload.starting_weight_lb,
        goal_weight_lb=payload.goal_weight_lb,
        goal_weight_date=payload.goal_weight_date,
        daily_calorie_budget=payload.daily_calorie_budget,
        password_hash=hash_password(payload.password),
    )
    session.add(db_user)
    session.commit()
    session.refresh(db_user)

    token = create_access_token(db_user.id, extra_claims={"email": db_user.email})
    return TokenResponse(access_token=token, token_type="bearer", user=_user_to_read(db_user))


@router.post("/login", response_model=TokenResponse)
def login(*, session: Session = Depends(get_session), payload: LoginRequest):
    user = session.exec(select(User).where(User.email == payload.email)).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token = create_access_token(user.id, extra_claims={"email": user.email})
    return TokenResponse(access_token=token, token_type="bearer", user=_user_to_read(user))

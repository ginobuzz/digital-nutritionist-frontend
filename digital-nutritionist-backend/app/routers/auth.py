import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from jose import ExpiredSignatureError, JWTError, jwt
from pydantic import BaseModel
from sqlmodel import Session, select

from ..config import settings
from ..db import get_session
from ..models import User, UserCreate, UserRead
from ..security import create_access_token, create_password_reset_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


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

    try:
        password_hash = hash_password(payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

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
        password_hash=password_hash,
    )
    session.add(db_user)
    session.commit()
    session.refresh(db_user)

    token = create_access_token(db_user.id, extra_claims={"email": db_user.email})
    return TokenResponse(access_token=token, token_type="bearer", user=_user_to_read(db_user))


@router.post("/login", response_model=TokenResponse)
def login(*, session: Session = Depends(get_session), payload: LoginRequest):
    user = session.exec(select(User).where(User.email == payload.email)).first()
    password_valid = False
    if user:
        try:
            password_valid = verify_password(payload.password, user.password_hash)
        except ValueError:
            password_valid = False
    if not user or not password_valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token = create_access_token(user.id, extra_claims={"email": user.email})
    return TokenResponse(access_token=token, token_type="bearer", user=_user_to_read(user))


class PasswordResetRequest(BaseModel):
    email: str


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


@router.post("/password-reset/request")
def request_password_reset(*, session: Session = Depends(get_session), payload: PasswordResetRequest):
    """
    Always returns a generic success message (avoids account enumeration).
    In non-production envs, logs a usable reset link.
    """
    email = (payload.email or "").strip()
    user = session.exec(select(User).where(User.email == email)).first()
    if user:
        token = create_password_reset_token(user.id)
        if settings.app_env != "production":
            base = settings.frontend_base_url.rstrip("/")
            reset_url = f"{base}/reset-password?token={token}"
            logger.info("Password reset link for %s: %s", user.email, reset_url)
        # TODO: send email in production
    return {"detail": "If an account exists for that email, you'll receive a reset link shortly."}


@router.post("/password-reset/confirm")
def confirm_password_reset(*, session: Session = Depends(get_session), payload: PasswordResetConfirm):
    try:
        decoded = jwt.decode(
            payload.token,
            settings.password_reset_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except ExpiredSignatureError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset link expired") from exc
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset link") from exc

    if decoded.get("purpose") != "password_reset":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset link")

    subject = decoded.get("sub")
    if not subject:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset link")

    user = session.get(User, str(subject))
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset link")

    try:
        user.password_hash = hash_password(payload.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    user.updated_at = datetime.utcnow()
    session.add(user)
    session.commit()
    return {"detail": "Password updated"}

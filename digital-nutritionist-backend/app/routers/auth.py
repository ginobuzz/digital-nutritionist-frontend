import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import ExpiredSignatureError, JWTError, jwt
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlmodel import Session, select

from ..abuse_guards import AuthRateLimit
from ..config import settings
from ..db import get_session
from ..models import User, UserCreate, UserRead
from ..security import create_access_token, create_password_reset_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


class LoginRequest(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=256)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class PasswordResetRequest(BaseModel):
    email: str = Field(max_length=254)


class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=1, max_length=4096)
    new_password: str = Field(min_length=1, max_length=256)

class EmailAvailabilityResponse(BaseModel):
    available: bool


def _user_to_read(user: User) -> UserRead:
    return UserRead.model_validate(user, from_attributes=True)


def _enforce_auth_payload_cap(request: Request) -> None:
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > settings.auth_max_payload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="That request is too large. Please shorten your input and try again.",
        )


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED, dependencies=[AuthRateLimit])
def signup(*, request: Request, session: Session = Depends(get_session), payload: UserCreate):
    _enforce_auth_payload_cap(request)
    email = (payload.email or "").strip().lower()
    existing = session.exec(select(User).where(func.lower(User.email) == email)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    try:
        password_hash = hash_password(payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    db_user = User(
        email=email,
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


@router.post("/login", response_model=TokenResponse, dependencies=[AuthRateLimit])
def login(*, request: Request, session: Session = Depends(get_session), payload: LoginRequest):
    _enforce_auth_payload_cap(request)
    email = (payload.email or "").strip().lower()
    user = session.exec(select(User).where(func.lower(User.email) == email)).first()
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

@router.get("/email-available", response_model=EmailAvailabilityResponse, dependencies=[AuthRateLimit])
def email_available(*, email: str, session: Session = Depends(get_session)):
    normalized = (email or "").strip().lower()
    if not normalized:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is required")
    existing = session.exec(select(User).where(func.lower(User.email) == normalized)).first()
    return EmailAvailabilityResponse(available=existing is None)


@router.post("/password-reset/request", dependencies=[AuthRateLimit])
def request_password_reset(*, request: Request, session: Session = Depends(get_session), payload: PasswordResetRequest):
    """
    Always returns a generic success message (avoids account enumeration).
    In non-production envs, logs a usable reset link.
    """
    _enforce_auth_payload_cap(request)
    email = (payload.email or "").strip().lower()
    user = session.exec(select(User).where(func.lower(User.email) == email)).first()
    if user:
        token = create_password_reset_token(user.id)
        if settings.app_env != "production":
            base = settings.frontend_base_url.rstrip("/")
            reset_url = f"{base}/reset-password?token={token}"
            logger.info("Password reset link for %s: %s", user.email, reset_url)
        # TODO: send email in production
    return {"detail": "If an account exists for that email, you'll receive a reset link shortly."}


# ---------------------------------------------------------------------------
# BETA ONLY: Profile-question password reset (no email required).
# Disabled in production — replace with email-based flow before launch.
# ---------------------------------------------------------------------------

class BetaPasswordResetRequest(BaseModel):
    email: str = Field(max_length=254)
    last_name: str = Field(max_length=128)
    age: int = Field(gt=0, le=150)
    height_in: int = Field(gt=0, le=120)
    new_password: str = Field(min_length=1, max_length=256)


@router.post("/password-reset/beta/reset", dependencies=[AuthRateLimit])
def beta_reset_password(
    *,
    request: Request,
    session: Session = Depends(get_session),
    payload: BetaPasswordResetRequest,
):
    """
    BETA ONLY: Resets a password by verifying last name, age, and height
    instead of sending an email. Returns 404 in production so the route is invisible.
    """
    if settings.app_env == "production":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    _enforce_auth_payload_cap(request)
    email = (payload.email or "").strip().lower()
    user = session.exec(select(User).where(func.lower(User.email) == email)).first()

    def _mismatch():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That doesn't match what we have on file.",
        )

    if not user:
        _mismatch()

    last_name_matches = (user.last_name or "").strip().lower() == payload.last_name.strip().lower()
    age_matches = user.age == payload.age
    height_matches = user.height_in is not None and abs(user.height_in - payload.height_in) <= 1

    if not (last_name_matches and age_matches and height_matches):
        _mismatch()

    try:
        user.password_hash = hash_password(payload.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    user.updated_at = datetime.utcnow()
    session.add(user)
    session.commit()
    return {"detail": "Password updated."}


@router.post("/password-reset/confirm", dependencies=[AuthRateLimit])
def confirm_password_reset(*, request: Request, session: Session = Depends(get_session), payload: PasswordResetConfirm):
    _enforce_auth_payload_cap(request)
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

from datetime import datetime, timedelta
from typing import Any

import bcrypt
from jose import jwt

from .config import settings


def _ensure_password_bytes(password: str) -> bytes:
    password_bytes = password.encode("utf-8")
    if len(password_bytes) > 72:
        msg = "Password is too long. Please use a shorter password and try again."
        raise ValueError(msg)
    return password_bytes


def hash_password(password: str) -> str:
    password_bytes = _ensure_password_bytes(password)
    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    password_bytes = _ensure_password_bytes(plain_password)
    return bcrypt.checkpw(password_bytes, hashed_password.encode("utf-8"))


def create_access_token(subject: str | int, expires_minutes: int | None = None, extra_claims: dict[str, Any] | None = None) -> str:
    if expires_minutes is None:
        expires_minutes = settings.jwt_exp_minutes
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes)
    payload: dict[str, Any] = {"sub": str(subject), "exp": expire}
    if extra_claims:
        payload.update(extra_claims)
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token


def create_password_reset_token(subject: str | int, expires_minutes: int | None = None) -> str:
    if expires_minutes is None:
        expires_minutes = settings.password_reset_exp_minutes
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes)
    payload: dict[str, Any] = {"sub": str(subject), "exp": expire, "purpose": "password_reset"}
    token = jwt.encode(payload, settings.password_reset_secret_key, algorithm=settings.jwt_algorithm)
    return token

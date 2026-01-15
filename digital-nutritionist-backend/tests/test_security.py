import pytest
from jose import jwt

from app.config import settings
from app.security import create_access_token, hash_password, verify_password


def test_hash_and_verify_password_roundtrip():
    hashed = hash_password("pw-123")
    assert verify_password("pw-123", hashed) is True
    assert verify_password("wrong", hashed) is False


def test_password_length_limit():
    # bcrypt only considers the first 72 bytes.
    too_long = "a" * 73
    with pytest.raises(ValueError, match="72 bytes"):
        hash_password(too_long)


def test_create_access_token_contains_subject_and_exp():
    token = create_access_token("user-1", expires_minutes=1, extra_claims={"email": "u@example.com"})
    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    assert payload["sub"] == "user-1"
    assert "exp" in payload
    assert payload["email"] == "u@example.com"


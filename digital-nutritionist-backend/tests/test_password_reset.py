from __future__ import annotations

from app.security import create_password_reset_token


def _signup_payload(email: str, password: str = "pw-123") -> dict:
    return {
        "email": email,
        "password": password,
        "first_name": "Test",
        "last_name": "User",
        "age": 30,
        "gender": "male",
        "activity_level": "sedentary",
    }


def test_password_reset_request_is_generic(client):
    unknown = client.post("/auth/password-reset/request", json={"email": "unknown@example.com"})
    assert unknown.status_code == 200, unknown.text
    assert "If an account exists" in unknown.json()["detail"]

    client.post("/auth/signup", json=_signup_payload("known@example.com"))
    known = client.post("/auth/password-reset/request", json={"email": "known@example.com"})
    assert known.status_code == 200, known.text
    assert known.json()["detail"] == unknown.json()["detail"]


def test_password_reset_confirm_updates_password_and_login(client):
    signup = client.post("/auth/signup", json=_signup_payload("u1@example.com", password="pw-123"))
    assert signup.status_code == 201, signup.text
    user_id = signup.json()["user"]["id"]

    token = create_password_reset_token(user_id, expires_minutes=10)
    confirm = client.post("/auth/password-reset/confirm", json={"token": token, "new_password": "new-pw"})
    assert confirm.status_code == 200, confirm.text

    login_old = client.post("/auth/login", json={"email": "u1@example.com", "password": "pw-123"})
    assert login_old.status_code == 401

    login_new = client.post("/auth/login", json={"email": "u1@example.com", "password": "new-pw"})
    assert login_new.status_code == 200, login_new.text


def test_password_reset_confirm_rejects_invalid_token(client):
    res = client.post("/auth/password-reset/confirm", json={"token": "not-a-token", "new_password": "pw-123"})
    assert res.status_code == 400
    assert "Invalid reset link" in res.json()["detail"]


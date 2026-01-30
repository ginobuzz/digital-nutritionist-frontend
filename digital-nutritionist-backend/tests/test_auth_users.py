from __future__ import annotations


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


def test_signup_and_login_success(client):
    signup = client.post("/auth/signup", json=_signup_payload("u1@example.com"))
    assert signup.status_code == 201, signup.text
    token = signup.json()["access_token"]
    assert token
    assert signup.json()["user"]["email"] == "u1@example.com"

    login = client.post("/auth/login", json={"email": "u1@example.com", "password": "pw-123"})
    assert login.status_code == 200, login.text
    assert login.json()["access_token"]


def test_signup_rejects_duplicate_email(client):
    first = client.post("/auth/signup", json=_signup_payload("dup@example.com"))
    assert first.status_code == 201, first.text

    second = client.post("/auth/signup", json=_signup_payload("dup@example.com"))
    assert second.status_code == 400
    assert second.json()["detail"] == "Email already registered"


def test_login_rejects_invalid_password(client):
    client.post("/auth/signup", json=_signup_payload("u2@example.com", password="pw-123"))
    res = client.post("/auth/login", json={"email": "u2@example.com", "password": "wrong"})
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid email or password"


def test_signup_rejects_passwords_over_72_bytes(client):
    password = "a" * 73
    res = client.post("/auth/signup", json=_signup_payload("long@example.com", password=password))
    assert res.status_code == 400
    assert "72 bytes" in res.json()["detail"]


def test_users_crud_and_password_update_affects_login(client):
    create = client.post("/auth/signup", json=_signup_payload("user-crud@example.com", password="pw-123"))
    assert create.status_code == 201, create.text
    token = create.json()["access_token"]
    user_id = create.json()["user"]["id"]
    headers = {"Authorization": f"Bearer {token}"}

    get_user = client.get(f"/users/{user_id}", headers=headers)
    assert get_user.status_code == 200
    assert get_user.json()["email"] == "user-crud@example.com"

    login_ok = client.post("/auth/login", json={"email": "user-crud@example.com", "password": "pw-123"})
    assert login_ok.status_code == 200

    update = client.put(f"/users/{user_id}", json={"password": "new-pw"}, headers=headers)
    assert update.status_code == 200

    login_old = client.post("/auth/login", json={"email": "user-crud@example.com", "password": "pw-123"})
    assert login_old.status_code == 401

    login_new = client.post("/auth/login", json={"email": "user-crud@example.com", "password": "new-pw"})
    assert login_new.status_code == 200

    delete = client.delete(f"/users/{user_id}", headers=headers)
    assert delete.status_code == 204

    login_deleted = client.post("/auth/login", json={"email": "user-crud@example.com", "password": "new-pw"})
    assert login_deleted.status_code == 401

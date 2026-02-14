from __future__ import annotations


def _create_user(client, email: str = "chat@example.com") -> tuple[str, dict[str, str]]:
    res = client.post(
        "/auth/signup",
        json={
            "email": email,
            "password": "pw-123",
            "first_name": "Chat",
            "last_name": "User",
        },
    )
    assert res.status_code == 201, res.text
    token = res.json()["access_token"]
    user_id = res.json()["user"]["id"]
    return user_id, {"Authorization": f"Bearer {token}"}


def test_chat_requires_message_or_image(client):
    _, headers = _create_user(client)
    res = client.post("/chat", json={}, headers=headers)
    assert res.status_code == 422


def test_chat_rejects_invalid_image_data_url(client):
    _, headers = _create_user(client, email="chat-invalid-image@example.com")
    res = client.post("/chat", json={"image_data_url": "https://example.com/image.jpg"}, headers=headers)
    assert res.status_code == 422


def test_chat_forbids_mismatched_user_id(client):
    _, headers = _create_user(client, email="chat-mismatch@example.com")
    res = client.post("/chat", json={"message": "hi", "user_id": "missing"}, headers=headers)
    assert res.status_code == 403
    assert res.json()["detail"] == "Forbidden"


def test_chat_happy_path_with_stubbed_assistant(monkeypatch, client):
    user_id, headers = _create_user(client)

    def fake_assistant_chat(*args, **kwargs):
        return {
            "reply": "Hello!",
            "model": "test",
            "usage": None,
            "created_meal_logs": [],
            "created_planned_meals": [],
        }

    from app.routers import chat as chat_router

    monkeypatch.setattr(chat_router, "assistant_chat", fake_assistant_chat, raising=True)

    res = client.post("/chat", json={"message": "hi", "user_id": user_id}, headers=headers)
    assert res.status_code == 200, res.text
    assert res.json()["reply"] == "Hello!"


def test_chat_returns_500_when_model_reply_is_missing(monkeypatch, client):
    user_id, headers = _create_user(client, email="chat2@example.com")

    def fake_assistant_chat(*args, **kwargs):
        return {"reply": ""}

    from app.routers import chat as chat_router

    monkeypatch.setattr(chat_router, "assistant_chat", fake_assistant_chat, raising=True)

    res = client.post("/chat", json={"message": "hi", "user_id": user_id}, headers=headers)
    assert res.status_code == 500
    assert res.json()["detail"] == "No reply received from model"


def test_chat_rejects_oversized_image_data_url(client, monkeypatch):
    from app import config

    monkeypatch.setattr(config.settings, "chat_max_image_data_url_chars", 32, raising=False)
    _, headers = _create_user(client, email="chat-big-image@example.com")
    res = client.post(
        "/chat",
        json={"image_data_url": "data:image/png;base64," + ("a" * 64)},
        headers=headers,
    )
    assert res.status_code == 422


def test_chat_rate_limit_returns_429(client, monkeypatch):
    from app import config
    from app.routers import chat as chat_router

    monkeypatch.setattr(config.settings, "chat_rate_limit_requests", 2, raising=False)
    monkeypatch.setattr(config.settings, "chat_rate_limit_window_seconds", 60, raising=False)

    _, headers = _create_user(client, email="chat-rate-limit@example.com")

    def fake_assistant_chat(*args, **kwargs):
        return {
            "reply": "ok",
            "model": "test",
            "usage": None,
            "created_meal_logs": [],
            "created_planned_meals": [],
        }

    monkeypatch.setattr(chat_router, "assistant_chat", fake_assistant_chat, raising=True)

    assert client.post("/chat", json={"message": "one"}, headers=headers).status_code == 200
    assert client.post("/chat", json={"message": "two"}, headers=headers).status_code == 200

    limited = client.post("/chat", json={"message": "three"}, headers=headers)
    assert limited.status_code == 429
    assert "Too many chat requests" in limited.json()["detail"]


def test_chat_payload_cap_returns_413(client, monkeypatch):
    from app import config

    monkeypatch.setattr(config.settings, "chat_max_payload_bytes", 180, raising=False)
    _, headers = _create_user(client, email="chat-payload-cap@example.com")
    res = client.post("/chat", json={"message": "x" * 500}, headers=headers)
    assert res.status_code == 413
    assert res.json()["detail"] == "Chat payload too large"

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

from __future__ import annotations


def _create_user(client, email: str = "chat@example.com") -> str:
    res = client.post(
        "/users/",
        json={
            "email": email,
            "password": "pw-123",
            "first_name": "Chat",
            "last_name": "User",
        },
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


def test_chat_requires_message_or_image(client):
    res = client.post("/chat", json={})
    assert res.status_code == 422


def test_chat_rejects_invalid_image_data_url(client):
    res = client.post("/chat", json={"image_data_url": "https://example.com/image.jpg"})
    assert res.status_code == 422


def test_chat_returns_404_for_unknown_user(client):
    res = client.post("/chat", json={"message": "hi", "user_id": "missing"})
    assert res.status_code == 404
    assert res.json()["detail"] == "User not found"


def test_chat_happy_path_with_stubbed_assistant(monkeypatch, client):
    user_id = _create_user(client)

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

    res = client.post("/chat", json={"message": "hi", "user_id": user_id})
    assert res.status_code == 200, res.text
    assert res.json()["reply"] == "Hello!"


def test_chat_returns_500_when_model_reply_is_missing(monkeypatch, client):
    user_id = _create_user(client, email="chat2@example.com")

    def fake_assistant_chat(*args, **kwargs):
        return {"reply": ""}

    from app.routers import chat as chat_router

    monkeypatch.setattr(chat_router, "assistant_chat", fake_assistant_chat, raising=True)

    res = client.post("/chat", json={"message": "hi", "user_id": user_id})
    assert res.status_code == 500
    assert res.json()["detail"] == "No reply received from model"


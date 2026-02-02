from __future__ import annotations


def _create_user(client, email: str = "logs@example.com") -> tuple[str, dict[str, str]]:
    res = client.post(
        "/auth/signup",
        json={
            "email": email,
            "password": "pw-123",
            "first_name": "Logs",
            "last_name": "User",
            "age": 30,
            "gender": "male",
            "activity_level": "sedentary",
        },
    )
    assert res.status_code == 201, res.text
    token = res.json()["access_token"]
    user_id = res.json()["user"]["id"]
    return user_id, {"Authorization": f"Bearer {token}"}


def test_meal_logs_crud(client):
    user_id, headers = _create_user(client)

    created = client.post(
        "/meal-logs/",
        json={
            "user_id": user_id,
            "date": "2025-01-01",
            "meal_type": "breakfast",
            "user_description": "Oatmeal",
            "estimated_calories": 350,
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    log_id = created.json()["id"]

    listed = client.get(
        "/meal-logs",
        params={"user_id": user_id, "start": "2025-01-01", "end": "2025-01-01"},
        headers=headers,
    )
    assert listed.status_code == 200
    assert any(item["id"] == log_id for item in listed.json())

    updated = client.put(f"/meal-logs/{log_id}", json={"estimated_calories": 400}, headers=headers)
    assert updated.status_code == 200
    assert updated.json()["estimated_calories"] == 400

    deleted = client.delete(f"/meal-logs/{log_id}", headers=headers)
    assert deleted.status_code == 204

    missing = client.get(f"/meal-logs/{log_id}", headers=headers)
    assert missing.status_code == 404


def test_planned_meals_crud(client):
    user_id, headers = _create_user(client, email="planned@example.com")

    created = client.post(
        "/planned-meals/",
        json={
            "user_id": user_id,
            "date": "2025-01-02",
            "name": "Chicken salad",
            "calories": 600,
            "meal_type": "lunch",
            "time": "2025-01-02T12:00:00",
            "description": "Greens + chicken",
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    meal_id = created.json()["id"]

    listed = client.get(
        "/planned-meals",
        params={"user_id": user_id, "start": "2025-01-02", "end": "2025-01-02"},
        headers=headers,
    )
    assert listed.status_code == 200
    assert any(item["id"] == meal_id for item in listed.json())

    updated = client.put(f"/planned-meals/{meal_id}", json={"calories": 650}, headers=headers)
    assert updated.status_code == 200
    assert updated.json()["calories"] == 650

    deleted = client.delete(f"/planned-meals/{meal_id}", headers=headers)
    assert deleted.status_code == 204

    missing = client.get(f"/planned-meals/{meal_id}", headers=headers)
    assert missing.status_code == 404


def test_weight_logs_and_user_weight_log_listing(client):
    user_id, headers = _create_user(client, email="weight@example.com")

    created = client.post(
        "/weight-logs/",
        json={
            "user_id": user_id,
            "weight": 160.5,
            "date": "2025-01-03",
            "notes": "Morning",
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    log_id = created.json()["id"]

    listed = client.get("/weight-logs", params={"user_id": user_id}, headers=headers)
    assert listed.status_code == 200
    assert any(item["id"] == log_id for item in listed.json())

    listed_via_user = client.get(f"/users/{user_id}/weight-logs", headers=headers)
    assert listed_via_user.status_code == 200
    assert any(item["id"] == log_id for item in listed_via_user.json())


def test_activity_logs_crud(client):
    user_id, headers = _create_user(client, email="activity@example.com")

    created = client.post(
        "/activity-logs/",
        json={
            "user_id": user_id,
            "date": "2025-01-04",
            "name": "Run",
            "calories_burned": 350,
            "duration": 30,
            "type": "cardio",
            "time": "2025-01-04T10:00:00",
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    activity_id = created.json()["id"]

    listed = client.get(
        "/activity-logs",
        params={"user_id": user_id, "start": "2025-01-04", "end": "2025-01-04"},
        headers=headers,
    )
    assert listed.status_code == 200
    assert any(item["id"] == activity_id for item in listed.json())

    updated = client.put(f"/activity-logs/{activity_id}", json={"duration": 45}, headers=headers)
    assert updated.status_code == 200
    assert updated.json()["duration"] == 45

    deleted = client.delete(f"/activity-logs/{activity_id}", headers=headers)
    assert deleted.status_code == 204

    missing = client.get(f"/activity-logs/{activity_id}", headers=headers)
    assert missing.status_code == 404


def test_list_endpoints_are_scoped_without_user_id(client):
    user1_id, headers1 = _create_user(client, email="scope1@example.com")
    user2_id, headers2 = _create_user(client, email="scope2@example.com")

    client.post(
        "/meal-logs/",
        json={
            "user_id": user1_id,
            "date": "2025-01-10",
            "meal_type": "breakfast",
            "user_description": "User1 oatmeal",
            "estimated_calories": 300,
        },
        headers=headers1,
    )
    client.post(
        "/meal-logs/",
        json={
            "user_id": user2_id,
            "date": "2025-01-10",
            "meal_type": "breakfast",
            "user_description": "User2 oatmeal",
            "estimated_calories": 300,
        },
        headers=headers2,
    )

    client.post(
        "/planned-meals/",
        json={
            "user_id": user1_id,
            "date": "2025-01-11",
            "name": "User1 plan",
            "calories": 500,
            "meal_type": "lunch",
            "time": "2025-01-11T12:00:00",
        },
        headers=headers1,
    )
    client.post(
        "/planned-meals/",
        json={
            "user_id": user2_id,
            "date": "2025-01-11",
            "name": "User2 plan",
            "calories": 500,
            "meal_type": "lunch",
            "time": "2025-01-11T12:00:00",
        },
        headers=headers2,
    )

    client.post(
        "/weight-logs/",
        json={"user_id": user1_id, "weight": 160.0, "date": "2025-01-12"},
        headers=headers1,
    )
    client.post(
        "/weight-logs/",
        json={"user_id": user2_id, "weight": 170.0, "date": "2025-01-12"},
        headers=headers2,
    )

    client.post(
        "/activity-logs/",
        json={
            "user_id": user1_id,
            "date": "2025-01-13",
            "name": "User1 run",
            "calories_burned": 300,
            "duration": 30,
            "type": "cardio",
            "time": "2025-01-13T10:00:00",
        },
        headers=headers1,
    )
    client.post(
        "/activity-logs/",
        json={
            "user_id": user2_id,
            "date": "2025-01-13",
            "name": "User2 run",
            "calories_burned": 300,
            "duration": 30,
            "type": "cardio",
            "time": "2025-01-13T10:00:00",
        },
        headers=headers2,
    )

    res = client.get("/meal-logs/", headers=headers1)
    assert res.status_code == 200, res.text
    assert res.json()
    assert all(item["user_id"] == user1_id for item in res.json())

    res = client.get("/planned-meals/", headers=headers1)
    assert res.status_code == 200, res.text
    assert res.json()
    assert all(item["user_id"] == user1_id for item in res.json())

    res = client.get("/weight-logs/", headers=headers1)
    assert res.status_code == 200, res.text
    assert res.json()
    assert all(item["user_id"] == user1_id for item in res.json())

    res = client.get("/activity-logs/", headers=headers1)
    assert res.status_code == 200, res.text
    assert res.json()
    assert all(item["user_id"] == user1_id for item in res.json())

    forbidden = client.get("/meal-logs/", params={"user_id": user2_id}, headers=headers1)
    assert forbidden.status_code == 403

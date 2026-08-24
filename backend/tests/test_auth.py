def test_login_success_and_me(client):
    res = client.post("/api/auth/login", json={"username": "admin", "password": "Admin@123"})
    assert res.status_code == 200
    body = res.json()
    assert body["access_token"]
    assert body["user"]["role"] == "SUPER_ADMIN"

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert me.json()["username"] == "admin"


def test_login_failure_audited(client, admin):
    res = client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
    assert res.status_code == 401

    audits = admin.get("/api/audits", params={"action": "LOGIN_FAILED"})
    items = audits.json()["items"]
    assert len(items) >= 1
    assert items[0]["resource_id"] == "admin"


def test_me_requires_token(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_admin_creates_doctor_with_profile(admin):
    res = admin.post(
        "/api/users",
        json={
            "username": "dr.test",
            "password": "Testing@123",
            "full_name": "Dr. Test Singh",
            "role": "DOCTOR",
            "specialty": "Cardiology",
            "consultation_fee": 1200,
        },
    )
    assert res.status_code == 201

    doctors = admin.get("/api/doctors")
    assert any(d["user_id"] == res.json()["id"] for d in doctors.json())


def test_receptionist_cannot_create_users(receptionist):
    res = receptionist.post(
        "/api/users",
        json={
            "username": "hacker",
            "password": "Hack@12345",
            "full_name": "Bad Actor",
            "role": "SUPER_ADMIN",
        },
    )
    assert res.status_code == 403
